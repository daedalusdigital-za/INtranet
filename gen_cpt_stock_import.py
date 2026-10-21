import openpyxl, re
from collections import OrderedDict

SRC = r'C:\Users\Administrator\Desktop\CPT_Consolidated_Stock.xlsx'
OUT = r'C:\Users\Administrator\Documents\GitHub\INtranet\Database\ImportCptConsolidatedStock.sql'
ASAT = (2026, 10, 15)

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)

# Item master from Consolidated Stock sheet
items = OrderedDict()  # itemid -> (client, code, desc, uom)
ws = wb['Consolidated Stock']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0:
        continue
    itemid, client, code, desc, uom = row[0], row[1], row[2], row[3], row[4]
    if not itemid:
        continue
    items[str(itemid)] = (str(client or ''), str(code or ''), str(desc or ''), str(uom or ''))

# Closing recorded on as-at date from Daily Movements
closing = {}
ws = wb['Daily Movements']
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0:
        continue
    itemid, date, closing_rec = row[0], row[5], row[10]
    if not itemid or date is None:
        continue
    if (date.year, date.month, date.day) == ASAT:
        q = closing_rec if isinstance(closing_rec, (int, float)) else 0
        closing[str(itemid)] = closing.get(str(itemid), 0) + (q or 0)

def esc(s):
    return s.replace("'", "''")

lines = []
lines.append("""-- Import CPT consolidated stock (as at 15 Oct 2026) into Cape Town Hub (WarehouseId=3)
SET NOCOUNT ON;
BEGIN TRAN;

-- 1. Remove all current stock across the stock module
DELETE FROM Backorders WHERE InventoryId IN (SELECT Id FROM WarehouseInventory);
DELETE FROM WarehouseInventory;

-- 2. Staging table
CREATE TABLE #stg (Code NVARCHAR(100), Name NVARCHAR(200), Client NVARCHAR(50), Uom NVARCHAR(20), Qty DECIMAL(18,2));
""")

n = 0
batch = []
for itemid, (client, code, desc, uom) in items.items():
    qty = closing.get(itemid, 0)
    name = esc(desc[:200]) if desc else esc(code)
    batch.append(f"('{esc(code[:100])}','{name}','{esc(client[:50])}','{esc(uom[:20])}',{qty})")
    n += 1
    if len(batch) == 500:
        lines.append("INSERT INTO #stg (Code,Name,Client,Uom,Qty) VALUES\n" + ",\n".join(batch) + ";")
        batch = []
if batch:
    lines.append("INSERT INTO #stg (Code,Name,Client,Uom,Qty) VALUES\n" + ",\n".join(batch) + ";")

lines.append("""
-- Collapse duplicate codes (same item may appear per client; keep max qty per code+client key handled by unique code)
-- 3. Upsert commodities by Code
UPDATE c SET c.Name = s.Name, c.Category = s.Client, c.UnitOfMeasure = s.Uom, c.UpdatedAt = SYSUTCDATETIME()
FROM Commodities c JOIN (SELECT Code, MAX(Name) Name, MAX(Client) Client, MAX(Uom) Uom FROM #stg GROUP BY Code) s ON s.Code = c.Code;

INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT s.Name, s.Code, s.Name, s.Client, s.Uom, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM (SELECT Code, MAX(Name) Name, MAX(Client) Client, MAX(Uom) Uom FROM #stg GROUP BY Code) s
WHERE NOT EXISTS (SELECT 1 FROM Commodities c WHERE c.Code = s.Code);

-- 4. Insert Cape Town Hub stock
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, ReorderLevel, MaximumLevel, LastCountDate, CreatedAt, UpdatedAt)
SELECT 3, c.Id, s.Qty, NULL, NULL, '2026-10-15', SYSUTCDATETIME(), SYSUTCDATETIME()
FROM (SELECT Code, SUM(Qty) Qty FROM #stg GROUP BY Code) s
JOIN Commodities c ON c.Code = s.Code;

DROP TABLE #stg;
COMMIT;

SELECT COUNT(*) AS CptItems, SUM(QuantityOnHand) AS TotalQty FROM WarehouseInventory WHERE WarehouseId = 3;
""")

with open(OUT, 'w', encoding='utf-8') as f:
    f.write("\n".join(lines))

print(f"items: {n}, with closing qty: {len(closing)}, sample:", list(closing.items())[:5])
print("wrote", OUT)
