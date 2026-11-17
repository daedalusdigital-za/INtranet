"""
Corrective split for the Nov-2026 count: codes that two companies use for DIFFERENT products were merged into
one stock row (GP 151 codes, CPT 10). For each (warehouse, code) collision:
  * the existing commodity keeps the quantity of ITS company's sheet line
  * a new commodity (same code, other company's description/UOM/category) gets that company's quantity
  * both changes are logged as Adjustments (Reference COUNT-2026-11-02-SPLIT)
  * un-deducted tripsheet lines of the other company that were linked to the merged row are re-pointed
Input: tools/collisions.json (from collisions_check.py). Output: Database/SplitSharedCodesNov2026.sql
"""
import json, os, subprocess

ROOT = r'C:\Users\Administrator\Documents\GitHub\INtranet'
col = json.load(open(os.path.join(ROOT, 'tools', 'collisions.json')))

def esc(s): return str(s).replace("'", "''")

rows = []
for c in col:
    for l in c['lines']:
        rows.append(f"({c['wh']},'{esc(c['code'])}','{esc(l['company'])}','{esc(l['desc'][:200])}','{esc(l['uom'][:20])}',{l['qty']:.2f})")

sql = f"""-- Split stock rows where one code is a different product under two companies (GP/CPT Nov 2026 count).
-- Existing commodity keeps its own company's quantity; a sibling commodity (same code, other company) takes the rest.
SET NOCOUNT ON; SET XACT_ABORT ON;
BEGIN TRAN;
CREATE TABLE #s (WarehouseId INT, Code NVARCHAR(100), Company NVARCHAR(50), Name NVARCHAR(200), Uom NVARCHAR(20), Qty DECIMAL(18,2), CommodityId INT NULL);
INSERT INTO #s (WarehouseId, Code, Company, Name, Uom, Qty) VALUES
{",\n".join(rows)};

-- Sanity: every (wh, code) here must currently be ONE commodity whose on-hand equals the sum of the sheet lines
IF EXISTS (
  SELECT 1 FROM (SELECT WarehouseId, Code, SUM(Qty) Total FROM #s GROUP BY WarehouseId, Code) g
  LEFT JOIN (SELECT c.Code, wi.WarehouseId, COUNT(*) n, SUM(wi.QuantityOnHand) OnHand
             FROM Commodities c JOIN WarehouseInventory wi ON wi.CommodityId = c.Id GROUP BY c.Code, wi.WarehouseId) d
    ON d.Code = g.Code AND d.WarehouseId = g.WarehouseId
  WHERE d.n IS NULL OR d.n <> 1 OR d.OnHand <> g.Total)
BEGIN RAISERROR('Collision rows no longer match the merged quantities - aborting (stock moved since the count?)', 16, 1); END

-- 1. Existing commodity for each code (the one that currently holds the merged quantity)
UPDATE s SET CommodityId = c.Id
FROM #s s JOIN Commodities c ON c.Code = s.Code AND ISNULL(UPPER(c.Category),'') = s.Company;

-- 1b. If the merged row belongs to a THIRD company (neither sheet line), it holds none of this stock -> 0
INSERT INTO #s (WarehouseId, Code, Company, Name, Uom, Qty, CommodityId)
SELECT DISTINCT s.WarehouseId, s.Code, ISNULL(UPPER(c.Category),''), c.Name, c.UnitOfMeasure, 0, c.Id
FROM #s s JOIN Commodities c ON c.Code = s.Code
WHERE NOT EXISTS (SELECT 1 FROM #s x WHERE x.WarehouseId = s.WarehouseId AND x.Code = s.Code AND x.CommodityId IS NOT NULL);

-- 2. Sibling commodities for the other company (one per code+company, shared by GP and CPT)
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT MIN(s.Name), s.Code, 'Created from Nov 2026 stock count (code shared between companies)', s.Company, MAX(ISNULL(NULLIF(s.Uom,''),'Each')), 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM #s s WHERE s.CommodityId IS NULL
GROUP BY s.Code, s.Company;

UPDATE s SET CommodityId = c.Id
FROM #s s JOIN Commodities c ON c.Code = s.Code AND UPPER(c.Category) = s.Company
WHERE s.CommodityId IS NULL;
IF EXISTS (SELECT 1 FROM #s WHERE CommodityId IS NULL) BEGIN RAISERROR('unresolved split rows', 16, 1); END

-- 3. Ledger entries: existing row goes from merged total -> own qty; new row goes 0 -> other qty
;WITH cur AS (
  SELECT s.WarehouseId, s.CommodityId, s.Qty NewQty, ISNULL(wi.QuantityOnHand, 0) OldQty, s.Company
  FROM #s s LEFT JOIN WarehouseInventory wi ON wi.WarehouseId = s.WarehouseId AND wi.CommodityId = s.CommodityId
)
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt)
SELECT WarehouseId, CommodityId, 'Adjustment', NewQty - OldQty, NewQty,
       'Stock count 2026-11-02: code shared between companies, split to ' + Company + ' line', 'COUNT-2026-11-02-SPLIT', 'Approved', 'Stock count import', SYSUTCDATETIME()
FROM cur WHERE NewQty <> OldQty;

-- 4. Apply quantities
UPDATE wi SET QuantityOnHand = s.Qty, LastCountDate = '2026-11-02', UpdatedAt = SYSUTCDATETIME()
FROM WarehouseInventory wi JOIN #s s ON s.WarehouseId = wi.WarehouseId AND s.CommodityId = wi.CommodityId;

INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt)
SELECT s.WarehouseId, s.CommodityId, s.Qty, '2026-11-02', SYSUTCDATETIME(), SYSUTCDATETIME()
FROM #s s WHERE NOT EXISTS (SELECT 1 FROM WarehouseInventory wi WHERE wi.WarehouseId = s.WarehouseId AND wi.CommodityId = s.CommodityId);

-- 5. Re-point un-deducted tripsheet lines of the other company that were linked to the merged row
;WITH pairs AS (
  SELECT DISTINCT a.Code, a.CommodityId OldId, b.Company NewCompany, b.CommodityId NewId
  FROM #s a JOIN #s b ON b.Code = a.Code AND b.Company <> a.Company
  JOIN Commodities ca ON ca.Id = a.CommodityId
  WHERE ca.Description NOT LIKE 'Created from Nov 2026 stock count (code shared%'   -- a = pre-existing row
),
inv AS (
  SELECT DISTINCT TransactionNumber, UPPER(CASE SourceCompany WHEN 'PMT' THEN 'PROMED' WHEN 'ACM' THEN 'ACCESS' WHEN 'SBT' THEN 'SEBENZANI' WHEN 'PHT' THEN 'PHARMACARE' ELSE SourceCompany END) Company
  FROM ImportedInvoices WHERE SourceCompany IS NOT NULL
)
UPDATE sc SET CommodityId = p.NewId
FROM StopCommodities sc
JOIN LoadStops ls ON ls.Id = sc.LoadStopId
JOIN pairs p ON p.OldId = sc.CommodityId
JOIN inv i ON i.TransactionNumber = sc.InvoiceNumber AND i.Company = p.NewCompany
WHERE NOT EXISTS (SELECT 1 FROM WarehouseStockMovements m WHERE m.LoadId = ls.LoadId AND m.MovementType = 'Dispatch' AND m.Status = 'Approved' AND m.ReversedByMovementId IS NULL);

SELECT @@ROWCOUNT AS StopLinesRepointed;
SELECT COUNT(*) AS SiblingCommoditiesCreated FROM Commodities WHERE Description = 'Created from Nov 2026 stock count (code shared between companies)';
SELECT COUNT(*) AS Adjustments FROM WarehouseStockMovements WHERE Reference = 'COUNT-2026-11-02-SPLIT';
SELECT w.Name, c.Category, COUNT(*) Items, SUM(wi.QuantityOnHand) Qty
FROM WarehouseInventory wi JOIN Warehouses w ON w.Id = wi.WarehouseId JOIN Commodities c ON c.Id = wi.CommodityId
WHERE wi.WarehouseId IN (2,3) GROUP BY w.Name, c.Category ORDER BY w.Name, c.Category;
DROP TABLE #s;
COMMIT;
"""
out = os.path.join(ROOT, 'Database', 'SplitSharedCodesNov2026.sql')
open(out, 'w', encoding='utf-8').write(sql)
print('wrote', out, len(rows), 'lines')
