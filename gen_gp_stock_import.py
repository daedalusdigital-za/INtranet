import openpyxl
from collections import OrderedDict

SRC = r'C:\Users\Administrator\Desktop\GP_Consolidated_Stock.xlsx'
OUT = r'C:\Users\Administrator\Documents\GitHub\INtranet\Database\ImportGpConsolidatedStock.sql'
WAREHOUSE_ID = 2  # Gauteng Main Warehouse
ASAT = '2026-10-15'

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb['Consolidated Stock']

items = OrderedDict()  # code -> (client, desc, uom, qty)
n = 0
for i, row in enumerate(ws.iter_rows(values_only=True)):
    if i == 0:
        continue
    itemid, client, code, desc, uom, closing = row[0], row[1], row[2], row[3], row[4], row[9]
    if not itemid or not code:
        continue
    qty = closing if isinstance(closing, (int, float)) else 0
    code = str(code)
    if code in items:
        c, d, u, q = items[code]
        items[code] = (c, d, u, q + (qty or 0))
    else:
        items[code] = (str(client or ''), str(desc or ''), str(uom or ''), qty or 0)
    n += 1

def esc(s):
    return s.replace("'", "''")

lines = [f"""-- Import GP consolidated stock (as at 15 Oct 2026) into Gauteng Main Warehouse (WarehouseId={WAREHOUSE_ID})
SET NOCOUNT ON;
BEGIN TRAN;

DELETE FROM Backorders WHERE InventoryId IN (SELECT Id FROM WarehouseInventory WHERE WarehouseId = {WAREHOUSE_ID});
DELETE FROM WarehouseInventory WHERE WarehouseId = {WAREHOUSE_ID};

CREATE TABLE #stg (Code NVARCHAR(100), Name NVARCHAR(200), Client NVARCHAR(50), Uom NVARCHAR(20), Qty DECIMAL(18,2));
"""]

batch = []
for code, (client, desc, uom, qty) in items.items():
    name = esc(desc[:200]) if desc else esc(code)
    batch.append(f"('{esc(code[:100])}','{name}','{esc(client[:50])}','{esc(uom[:20])}',{qty})")
    if len(batch) == 500:
        lines.append("INSERT INTO #stg (Code,Name,Client,Uom,Qty) VALUES\n" + ",\n".join(batch) + ";")
        batch = []
if batch:
    lines.append("INSERT INTO #stg (Code,Name,Client,Uom,Qty) VALUES\n" + ",\n".join(batch) + ";")

lines.append(f"""
-- Insert only NEW commodities (do NOT overwrite names from other regions' imports,
-- since some codes are reused with different descriptions per region)
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT s.Name, s.Code, s.Name, s.Client, s.Uom, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM (SELECT Code, MAX(Name) Name, MAX(Client) Client, MAX(Uom) Uom FROM #stg GROUP BY Code) s
WHERE NOT EXISTS (SELECT 1 FROM Commodities c WHERE c.Code = s.Code);

INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, ReorderLevel, MaximumLevel, LastCountDate, CreatedAt, UpdatedAt)
SELECT {WAREHOUSE_ID}, c.Id, s.Qty, NULL, NULL, '{ASAT}', SYSUTCDATETIME(), SYSUTCDATETIME()
FROM (SELECT Code, SUM(Qty) Qty FROM #stg GROUP BY Code) s
JOIN Commodities c ON c.Code = s.Code;

DROP TABLE #stg;
COMMIT;

SELECT COUNT(*) AS GpItems, SUM(QuantityOnHand) AS TotalQty FROM WarehouseInventory WHERE WarehouseId = {WAREHOUSE_ID};
""")

with open(OUT, 'w', encoding='utf-8') as f:
    f.write("\n".join(lines))

print(f"rows read: {n}, unique codes: {len(items)}")
print("wrote", OUT)
