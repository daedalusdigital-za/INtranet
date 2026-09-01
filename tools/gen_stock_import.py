import openpyxl, os

folder = r"c:\Users\Administrator\Documents\GitHub\INtranet\uploads"
out_sql = r"c:\Users\Administrator\Documents\GitHub\INtranet\Database\ImportCompanyStock.sql"

# company -> (display name, company-prefix, file, {sheet: province})
companies = [
    ("Access Medical", "ACC", "ACCESS SOH.xlsx",
     {"KZN ACCESS": "KZN", "GP ACCESS": "GP", "PE ACCESS": "PE", "CPT ACCESS": "CPT"}),
    ("KOG Trading Enterprise", "KOG", "KOG SOH.xlsx",
     {"KZN KOG": "KZN", "GP KOG": "GP", "PE KOG": "PE"}),
    ("Promed Technologies", "PRO", "PROMED SOH.xlsx",
     {"PROMED KZN": "KZN", "GP PROMED": "GP", "PE PROMED": "PE", "CPT PROMED": "CPT"}),
    ("Sebenzani Trading", "SEB", "SEB SOH.xlsx",
     {"SEB KZN": "KZN", "SEB GP": "GP", "SEB PE": "PE", "SEB CPT": "CPT"}),
]

PROVINCE_META = {
    "KZN": ("KwaZulu-Natal", "Verulam"),
    "GP":  ("Gauteng", "Johannesburg"),
    "PE":  ("Eastern Cape", "Gqeberha"),
    "CPT": ("Western Cape", "Cape Town"),
}

def esc(s):
    return str(s).replace("'", "''")

def looks_like_header(row):
    return row and row[0] is not None and str(row[0]).strip().upper() == "CODE"

def parse_qty(v):
    if v in (None, ""):
        return 0.0
    try:
        return float(str(v).replace(",", "").strip())
    except ValueError:
        return 0.0

lines = []
lines.append("-- ============================================================")
lines.append("-- Company stock import (Option A): company-province warehouses")
lines.append("-- Auto-generated. Idempotent-ish: creates company/warehouses/buildings if missing,")
lines.append("-- and REPLACES BuildingInventory for the affected buildings.")
lines.append("-- ============================================================")
lines.append("SET NOCOUNT ON;")
lines.append("SET XACT_ABORT ON;")
lines.append("BEGIN TRAN;")
lines.append("DECLARE @whId INT, @bldId INT;")
lines.append("")
lines.append("-- 0) Clean up any prior partial import of these company warehouses")
lines.append("DELETE bi FROM BuildingInventory bi")
lines.append("  JOIN WarehouseBuildings b ON b.Id = bi.BuildingId")
lines.append("  JOIN Warehouses w ON w.Id = b.WarehouseId")
lines.append("  WHERE w.Code LIKE 'ACC-%' OR w.Code LIKE 'PRO-%' OR w.Code LIKE 'SEB-%' OR w.Code LIKE 'KOG-%';")
lines.append("DELETE b FROM WarehouseBuildings b")
lines.append("  JOIN Warehouses w ON w.Id = b.WarehouseId")
lines.append("  WHERE w.Code LIKE 'ACC-%' OR w.Code LIKE 'PRO-%' OR w.Code LIKE 'SEB-%' OR w.Code LIKE 'KOG-%';")
lines.append("DELETE FROM Warehouses WHERE Code LIKE 'ACC-%' OR Code LIKE 'PRO-%' OR Code LIKE 'SEB-%' OR Code LIKE 'KOG-%';")
lines.append("")
lines.append("-- 1) Ensure KOG operating company exists")
lines.append("IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code='KOG')")
lines.append("  INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt)")
lines.append("  VALUES ('KOG Trading Enterprise', 'KOG', 'KOG Trading Enterprise stock', 1, SYSUTCDATETIME());")
lines.append("")

total_rows = 0
for display, prefix, fname, sheets in companies:
    path = os.path.join(folder, fname)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    lines.append(f"-- ==================== {display} ====================")
    for sheet, prov in sheets.items():
        ws = wb[sheet]
        province_full, city = PROVINCE_META[prov]
        wh_code = f"{prefix}-{prov}"           # e.g. ACC-KZN
        wh_name = f"{display} \u2013 {prov}"    # e.g. Access Medical – KZN
        bld_code = f"{wh_code}-01"              # collective building
        bld_name = f"{wh_name} (Collective)"

        # Aggregate nonzero items by code (dedupe -> sum qty), keep first desc/uom
        agg = {}
        first = True
        for row in ws.iter_rows(values_only=True):
            if first:
                first = False
                if looks_like_header(row):
                    continue
            if not row:
                continue
            code = row[0]
            if code is None or str(code).strip() == "":
                continue
            code = str(code).strip()[:50]
            desc = (str(row[1]).strip()[:500] if len(row) > 1 and row[1] is not None else "")
            uom = (str(row[2]).strip()[:20] if len(row) > 2 and row[2] is not None else "Each")
            if uom == "":
                uom = "Each"
            qty = parse_qty(row[3] if len(row) > 3 else None)
            if qty == 0:
                continue
            if code in agg:
                agg[code][2] += qty
            else:
                agg[code] = [desc, uom, qty]

        lines.append(f"-- {wh_name}: {len(agg)} items")
        # Warehouse upsert by Code
        lines.append("SET @whId = NULL; SET @bldId = NULL;")
        lines.append(f"SELECT @whId = Id FROM Warehouses WHERE Code = '{wh_code}';")
        lines.append("IF @whId IS NULL BEGIN")
        lines.append(f"  INSERT INTO Warehouses (Name, Code, City, Province, Status, CreatedAt, UpdatedAt)")
        lines.append(f"  VALUES ('{esc(wh_name)}', '{wh_code}', '{esc(city)}', '{esc(province_full)}', 'Active', SYSUTCDATETIME(), SYSUTCDATETIME());")
        lines.append("  SET @whId = SCOPE_IDENTITY();")
        lines.append("END")
        # Building upsert by Code
        lines.append(f"SELECT @bldId = Id FROM WarehouseBuildings WHERE Code = '{bld_code}';")
        lines.append("IF @bldId IS NULL BEGIN")
        lines.append(f"  INSERT INTO WarehouseBuildings (WarehouseId, Code, Name, IsActive, CreatedAt, UpdatedAt)")
        lines.append(f"  VALUES (@whId, '{bld_code}', '{esc(bld_name)}', 1, SYSUTCDATETIME(), SYSUTCDATETIME());")
        lines.append("  SET @bldId = SCOPE_IDENTITY();")
        lines.append("END")
        # Clear existing inventory for this building (clean re-import)
        lines.append("DELETE FROM BuildingInventory WHERE BuildingId = @bldId;")

        # Insert rows in batches of 200
        rows = []
        for code, (desc, uom, qty) in agg.items():
            rows.append(f"(@bldId, '{esc(code)}', '{esc(desc)}', '{esc(uom)}', {qty:.2f}, 0, 0, 0)")
            total_rows += 1
        for i in range(0, len(rows), 200):
            chunk = rows[i:i+200]
            lines.append("INSERT INTO BuildingInventory (BuildingId, ItemCode, ItemDescription, Uom, QuantityOnHand, QuantityReserved, QuantityOnOrder, UnitCost, CreatedAt, UpdatedAt)")
            # need CreatedAt/UpdatedAt too -> add via SELECT wrapper
            lines.append("SELECT v.*, SYSUTCDATETIME(), SYSUTCDATETIME() FROM (VALUES")
            lines.append(",\n".join(chunk))
            lines.append(") AS v(BuildingId, ItemCode, ItemDescription, Uom, QuantityOnHand, QuantityReserved, QuantityOnOrder, UnitCost);")
        lines.append("")
    wb.close()

lines.append("COMMIT;")
lines.append(f"PRINT 'Imported {total_rows} inventory rows across company-province warehouses.';")
lines.append("SELECT w.Code AS Warehouse, COUNT(bi.Id) AS Items, SUM(bi.QuantityOnHand) AS TotalQty")
lines.append("FROM Warehouses w JOIN WarehouseBuildings b ON b.WarehouseId=w.Id")
lines.append("JOIN BuildingInventory bi ON bi.BuildingId=b.Id")
lines.append("WHERE w.Code LIKE 'ACC-%' OR w.Code LIKE 'PRO-%' OR w.Code LIKE 'SEB-%' OR w.Code LIKE 'KOG-%'")
lines.append("GROUP BY w.Code ORDER BY w.Code;")

with open(out_sql, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))

print(f"Wrote {out_sql}")
print(f"Total inventory rows: {total_rows}")
