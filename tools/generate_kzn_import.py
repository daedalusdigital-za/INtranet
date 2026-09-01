import json, re
from datetime import datetime

with open('kzn_tripsheet_data.json', 'r') as f:
    all_data = json.load(f)

# ── Driver name → DB Driver Id mapping ──
# Existing drivers in DB that appear in KZN tripsheets:
#   AJ=22, Buhle=23, Cebo=21, Lucas=26, Mzila=25, Ngubane=24,
#   Nhkala=17 (NHLAKA in sheets), Siyabonga=18, Sizwe=20, Zolani=36
# SIYA → Siyanda (Id 37) – short name
# MASIYA and SMANGA are new – will be inserted first

driver_map = {
    'AJ': 22,
    'BUHLE': 23,
    'CEBO': 21,
    'LUCAS': 26,
    'MASIYA': None,   # Will be inserted, ID assigned dynamically
    'MZILA': 25,
    'MZILA\\': 25,    # Trailing backslash artifact from Excel
    'NGUBANE': 24,
    'NHLAKA': 17,     # DB has "Nhkala"
    'SIYA': 37,       # Short for Siyanda
    'SIYABONGA': 18,
    'SIZWE': 20,
    'SMANGA': None,    # Will be inserted, ID assigned dynamically
    'ZOLANI': 36,
}

# KZN Warehouse ID
WAREHOUSE_ID = 1

# Next load number (current max is RF-000400)
next_load_num = 401

# Detect duplicate "Copy" files – check if the original also exists
# For "Copy" files: they represent DIFFERENT routes driven by different drivers on same date to same area
# e.g., "DURBAN 02.02.26 - Copy.xlsx" (LUCAS) vs "DURBAN 02.02.26.xlsx" (NGUBANE) = 2 different trips
# So we keep ALL files including copies – they're separate loads

# Skip the file with 0 invoices
skip_files = set()
for key, data in all_data.items():
    if data['count'] == 0:
        skip_files.add(key)
        print(f"Skipping (0 invoices): {key}")

# Also detect true duplicates: "Copy of STANGER..." and "STANGER..." with same driver
# Check: MARCH/24.03.26/Copy of STANGER GREYTOWN TUGELA FERRY 24.03.26.xlsx (SIYABONGA, 5 invs)
# vs:    MARCH/24.03.26/STANGER GREYTOWN TUGELA FERRY 24.03.26.xlsx (SIYABONGA, 5 invs)
# Same driver, same inv count = likely duplicate
orig_key = 'MARCH/24.03.26/STANGER GREYTOWN TUGELA FERRY 24.03.26.xlsx'
copy_key = 'MARCH/24.03.26/Copy of STANGER GREYTOWN TUGELA FERRY 24.03.26.xlsx'
if orig_key in all_data and copy_key in all_data:
    orig_invs = set(inv['inv'] for inv in all_data[orig_key]['invoices'])
    copy_invs = set(inv['inv'] for inv in all_data[copy_key]['invoices'])
    if orig_invs == copy_invs:
        skip_files.add(copy_key)
        print(f"Skipping (duplicate of original): {copy_key}")


def parse_date(date_str):
    """Parse date from format like '05.02.26' or '25.03.2026' to SQL date"""
    date_str = date_str.strip().replace(',', '.').replace('/', '.')
    # Remove trailing dots
    date_str = date_str.rstrip('.')
    for fmt in ['%d.%m.%y', '%d.%m.%Y']:
        try:
            d = datetime.strptime(date_str, fmt)
            return d.strftime('%Y-%m-%d')
        except:
            continue
    return None


def escape_sql(s):
    """Escape single quotes for SQL"""
    return s.replace("'", "''")


sql_lines = []
sql_lines.append("-- KZN Tripsheet Import Script")
sql_lines.append("-- Generated from 'docs/KZN TRIPSHEET' folder")
sql_lines.append(f"-- KZN Warehouse ID = {WAREHOUSE_ID}")
sql_lines.append("")
sql_lines.append("BEGIN TRANSACTION;")
sql_lines.append("")

# ── Insert new drivers that don't exist yet ──
sql_lines.append("-- ═══ Insert new drivers ═══")
sql_lines.append("IF NOT EXISTS (SELECT 1 FROM Drivers WHERE FirstName = 'Masiya')")
sql_lines.append("  INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, EmployeeNumber, PhoneNumber, Status, CreatedAt, UpdatedAt)")
sql_lines.append("  VALUES ('Masiya', '-', '-', '-', '-', '-', 'Active', GETDATE(), GETDATE());")
sql_lines.append("")
sql_lines.append("IF NOT EXISTS (SELECT 1 FROM Drivers WHERE FirstName = 'Smanga')")
sql_lines.append("  INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, EmployeeNumber, PhoneNumber, Status, CreatedAt, UpdatedAt)")
sql_lines.append("  VALUES ('Smanga', '-', '-', '-', '-', '-', 'Active', GETDATE(), GETDATE());")
sql_lines.append("")
sql_lines.append("-- Store new driver IDs for use below")
sql_lines.append("DECLARE @MasiyaId INT = (SELECT Id FROM Drivers WHERE FirstName = 'Masiya');")
sql_lines.append("DECLARE @SmangaId INT = (SELECT Id FROM Drivers WHERE FirstName = 'Smanga');")
sql_lines.append("")

imported_count = 0
total_invoices_linked = 0
no_driver_count = 0
no_date_count = 0

sql_lines.append("-- ═══ Create Loads and Link Invoices ═══")
sql_lines.append("")

for key in sorted(all_data.keys()):
    if key in skip_files:
        continue

    data = all_data[key]
    driver_name = data['driver'].strip().upper()
    date_sql = parse_date(data['date']) if data['date'] else None
    route = data.get('route', '')
    vehicle_reg = data.get('vehicle_reg', '')
    load_number = f"RF-{next_load_num:06d}"

    # Handle missing date – try to extract from folder path (e.g., MARCH/04.03.26/)
    if not date_sql:
        # Extract date from the folder path in the key
        date_match = re.search(r'(\d{2}\.\d{2}\.\d{2,4})', key)
        if date_match:
            date_sql = parse_date(date_match.group(1))
    
    if not date_sql:
        print(f"WARNING: No date for {key}, skipping")
        no_date_count += 1
        continue

    # Determine driver ID
    if not driver_name:
        # No driver assigned – still create the load but with NULL driver
        driver_sql = "NULL"
        no_driver_count += 1
    elif driver_name in ('MASIYA',):
        driver_sql = "@MasiyaId"
    elif driver_name in ('SMANGA',):
        driver_sql = "@SmangaId"
    else:
        driver_id = driver_map.get(driver_name)
        if not driver_id:
            print(f"WARNING: Unknown driver '{driver_name}' in {key}")
            driver_sql = "NULL"
            no_driver_count += 1
        else:
            driver_sql = str(driver_id)

    # Get unique invoice numbers
    file_invs = list(set(inv['inv'] for inv in data['invoices']))

    # Clean route name (remove trailing dashes, extra spaces)
    route_clean = re.sub(r'\s*-\s*$', '', route).strip()
    route_clean = re.sub(r'\s+', ' ', route_clean)

    sql_lines.append(f"-- {key}: Driver={data['driver'] or '(none)'}, Date={data['date']}, Route={route_clean}, Invoices={len(file_invs)}")

    # Create the Load with route in Notes field
    notes = escape_sql(f"Route: {route_clean}") if route_clean else ''
    vehicle_note = escape_sql(vehicle_reg) if vehicle_reg else ''
    special_instructions = vehicle_note  # Store vehicle reg in SpecialInstructions

    sql_lines.append(f"INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)")
    sql_lines.append(f"VALUES ('{load_number}', {WAREHOUSE_ID}, {driver_sql}, 'Delivered', '{date_sql}', '{notes}', '{special_instructions}', GETDATE(), GETDATE());")
    sql_lines.append("")

    # Link invoices to this load
    if file_invs:
        inv_list = "','".join(file_invs)
        sql_lines.append(f"-- Link {len(file_invs)} invoices to {load_number}")
        sql_lines.append(f"UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = '{load_number}')")
        sql_lines.append(f"WHERE TransactionNumber IN ('{inv_list}')")
        sql_lines.append(f"AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = {WAREHOUSE_ID}));")
        sql_lines.append("")
        total_invoices_linked += len(file_invs)

    imported_count += 1
    next_load_num += 1

sql_lines.append("COMMIT;")
sql_lines.append("")
sql_lines.append(f"-- ═══ Summary ═══")
sql_lines.append(f"-- Tripsheets created: {imported_count}")
sql_lines.append(f"-- Invoice groups linked: {total_invoices_linked}")
sql_lines.append(f"-- Loads with no driver: {no_driver_count}")
sql_lines.append(f"-- Load numbers: RF-000401 to RF-{next_load_num-1:06d}")
sql_lines.append("")
sql_lines.append("-- ═══ Verification Queries ═══")
sql_lines.append("SELECT 'New KZN Loads' AS [Check], COUNT(*) AS [Count] FROM Loads WHERE WarehouseId = 1 AND LoadNumber >= 'RF-000401';")
sql_lines.append("SELECT 'Linked Invoices' AS [Check], COUNT(*) AS [Count] FROM ImportedInvoices ii JOIN Loads l ON ii.LoadId = l.Id WHERE l.WarehouseId = 1 AND l.LoadNumber >= 'RF-000401';")
sql_lines.append("")
sql_lines.append("-- Sample data:")
sql_lines.append("SELECT TOP 20 l.LoadNumber, l.Status, d.FirstName AS Driver, w.Name AS Warehouse,")
sql_lines.append("  CONVERT(varchar, l.ScheduledDeliveryDate, 23) AS DeliveryDate, l.Notes AS Route,")
sql_lines.append("  (SELECT COUNT(*) FROM ImportedInvoices ii WHERE ii.LoadId = l.Id) AS InvoiceCount")
sql_lines.append("FROM Loads l")
sql_lines.append("LEFT JOIN Drivers d ON l.DriverId = d.Id")
sql_lines.append("LEFT JOIN Warehouses w ON l.WarehouseId = w.Id")
sql_lines.append("WHERE l.LoadNumber >= 'RF-000401'")
sql_lines.append("ORDER BY l.LoadNumber;")

sql_content = '\n'.join(sql_lines)

output_file = 'Database/ImportKznTripsheets.sql'
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(sql_content)

print(f"\nGenerated SQL: {output_file}")
print(f"Tripsheets to create: {imported_count}")
print(f"Invoice groups to link: {total_invoices_linked}")
print(f"Load numbers: RF-000401 to RF-{next_load_num-1:06d}")
print(f"Loads with no driver assigned: {no_driver_count}")
print(f"Files skipped: {len(skip_files)}")
for s in sorted(skip_files):
    print(f"  {s}")
if no_date_count:
    print(f"Skipped due to no date: {no_date_count}")
