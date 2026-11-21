"""Load the KZN DAMAGED-EXPIRED tab into the DAMAGED-EXPIRED company (WarehouseId 1)."""
import openpyxl, re, subprocess
SRC = r'C:\Users\Administrator\Documents\GitHub\INtranet\docs\Updates\kzn\KZN STOCK SHEET .xlsx'
OUT = r'C:\Users\Administrator\Documents\GitHub\INtranet\Database\ApplyDamagedExpiredKznNov2026.sql'
WH = 1; ASAT = '2026-11-02'
BRAND = {'ACCESS': 'ACCESS', 'PROCARE': 'PROMED', 'PROMED': 'PROMED', 'PPH': 'PHARMACARE', 'PHARMACARE': 'PHARMACARE', 'SEBENZANI': 'SEBENZANI'}

ws = openpyxl.load_workbook(SRC, data_only=True)['DAMAGED-EXPIRED']
rows = list(ws.iter_rows(values_only=True))
hdr = [str(c or '').strip().upper() for c in rows[0]]
ci = {h: i for i, h in enumerate(hdr)}
lines = []
for r in rows[1:]:
    code, desc, brand, uom, qty, flag = (r[ci[k]] if k in ci and ci[k] < len(r) else None for k in ('CODE', 'DESCRIPTION', 'BRAND', 'UOM', 'QUANTITY', 'DAMAGED / EXPIRED'))
    if not desc or qty in (None, '', 0) or not flag: continue
    try: qty = float(str(qty).replace(',', ''))
    except ValueError: continue
    flag = str(flag).strip().upper()
    tag = 'EXPIRED' if 'EXPIRED' in flag and 'NOT' not in flag else 'SHORT-DATED' if 'SHORT' in flag else 'DAMAGED'
    orig = BRAND.get(str(brand or '').strip().upper(), str(brand or '').strip().upper() or None)
    desc = str(desc).strip()
    base = str(code).strip() if code else re.sub(r'[^A-Z0-9]+', '', desc.upper())[:40]
    lines.append(dict(code=f'DE-{base}'[:100], name=f'[{tag}] {desc}'[:200], desc=f'{tag} stock, originally {orig or "unknown"} code {code or "n/a"}: {desc}'[:500],
                      uom=str(uom or 'Each')[:20], qty=qty, tag=tag, orig=orig))

esc = lambda s: str(s).replace("'", "''")
sql = [f"""-- KZN DAMAGED-EXPIRED tab (Nov 2026 count) -> company DAMAGED-EXPIRED, warehouse {WH}
SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRAN;
CREATE TABLE #d (Code NVARCHAR(100), Name NVARCHAR(200), Descr NVARCHAR(500), Uom NVARCHAR(20), Qty DECIMAL(18,2), Tag NVARCHAR(20));
INSERT INTO #d VALUES
""" + ",\n".join(f"('{esc(l['code'])}','{esc(l['name'])}','{esc(l['desc'])}','{esc(l['uom'])}',{l['qty']},'{l['tag']}')" for l in lines) + ";",
f"""
-- same code listed twice on the sheet (e.g. U-slot drape 40 + 1173) -> one item, summed
SELECT Code, MIN(Name) Name, MIN(Descr) Descr, MIN(Uom) Uom, SUM(Qty) Qty, MIN(Tag) Tag INTO #a FROM #d GROUP BY Code;

INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT a.Name, a.Code, a.Descr, 'DAMAGED-EXPIRED', a.Uom, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM #a a WHERE NOT EXISTS (SELECT 1 FROM Commodities c WHERE c.Code = a.Code AND c.Category = 'DAMAGED-EXPIRED');

INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt)
SELECT {WH}, c.Id, 'Receive', a.Qty, a.Qty, 'Nov 2026 count: KZN DAMAGED-EXPIRED sheet (' + a.Tag + ')', 'COUNT-{ASAT}', 'Approved', 'Stock count import', SYSUTCDATETIME()
FROM #a a JOIN Commodities c ON c.Code = a.Code AND c.Category = 'DAMAGED-EXPIRED'
WHERE NOT EXISTS (SELECT 1 FROM WarehouseInventory i WHERE i.WarehouseId = {WH} AND i.CommodityId = c.Id);

INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt)
SELECT {WH}, c.Id, a.Qty, '{ASAT}', SYSUTCDATETIME(), SYSUTCDATETIME()
FROM #a a JOIN Commodities c ON c.Code = a.Code AND c.Category = 'DAMAGED-EXPIRED'
WHERE NOT EXISTS (SELECT 1 FROM WarehouseInventory i WHERE i.WarehouseId = {WH} AND i.CommodityId = c.Id);

DROP TABLE #a; DROP TABLE #d; COMMIT;
SELECT c.Code, c.Name, i.QuantityOnHand FROM WarehouseInventory i JOIN Commodities c ON c.Id = i.CommodityId WHERE c.Category = 'DAMAGED-EXPIRED' ORDER BY c.Name;
"""]
open(OUT, 'w', encoding='utf-8').write("\n".join(sql))
print(len(lines), 'lines ->', OUT)
