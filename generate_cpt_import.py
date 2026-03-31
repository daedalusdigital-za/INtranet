import json, re
from datetime import datetime

with open('cpt_tripsheet_data.json', 'r') as f:
    all_data = json.load(f)

# Existing invoice numbers already in Cape Town tripsheets
existing_invs = set([
    'IN142779', 'IN142818', 'IN142953', 'IN143173', 'IN143261',
    'IN161668', 'IN161821', 'IN161828', 'IN161831', 'IN161835',
    'IN161914', 'IN161942', 'IN161943', 'IN161955', 'IN162021',
    'IN162028', 'IN162036', 'IN162037', 'IN162038', 'IN162175',
    'IN162240', 'IN162296', 'IN162309', 'IN162350', 'IN162531',
    'IN162532', 'IN162546', 'IN162635', 'IN162779', 'IN162780',
    'IN162781', 'IN162904', 'IN162958'
])

# Files to SKIP (all invoices already in DB)
skip_files = {'JIM 02.02.26.xlsx', 'JIM 30.01.26.xlsx', 'LUNGELO 03.02.2026.xlsx'}

# Duplicate: LUNGELO 22.01.2026.xlsx and LUNGELO 22.01.26.xlsx are near-identical
# Keep 22.01.2026 (has IN161823), skip 22.01.26 (has IN142737 instead)
skip_files.add('LUNGELO 22.01.26.xlsx')

# Driver name -> DB Driver Id
driver_map = {
    'JIM': 30,
    'LUNGELO': 1,
    'LUNGELO & SIHLE': 1,  # Primary driver Lungelo
    'NATHI': 38,
    'SABELO': 32,
    'ZOLANI': 36,
    'SIHLE': 28
}

# Cape Town Warehouse ID
WAREHOUSE_ID = 3

# Next load number starts at 373
next_load_num = 373

def parse_date(date_str):
    """Parse date from Excel format like '05,01,26' or '29,01,2026' to SQL date"""
    date_str = date_str.strip().replace(',', '/')
    # Try different formats
    for fmt in ['%d/%m/%y', '%d/%m/%Y']:
        try:
            d = datetime.strptime(date_str, fmt)
            return d.strftime('%Y-%m-%d')
        except:
            continue
    return None

sql_lines = []
sql_lines.append("-- CPT Tripsheet Import Script")
sql_lines.append("-- Generated from 'CPT TRIPSHEET 2026' folder")
sql_lines.append(f"-- Skipping {len(skip_files)} files (already in DB or duplicates)")
sql_lines.append("-- Cape Town Warehouse ID = 3")
sql_lines.append("")
sql_lines.append("BEGIN TRANSACTION;")
sql_lines.append("")

imported_count = 0
total_invoices_linked = 0

for fname in sorted(all_data.keys()):
    if fname in skip_files:
        continue
    
    data = all_data[fname]
    driver_name = data['driver'].upper().strip()
    driver_id = driver_map.get(driver_name)
    date_sql = parse_date(data['date'])
    load_number = f"RF-{next_load_num:06d}"
    
    if not driver_id:
        print(f"WARNING: Unknown driver '{driver_name}' in {fname}")
        continue
    
    if not date_sql:
        print(f"WARNING: Could not parse date '{data['date']}' in {fname}")
        continue
    
    # Get unique invoice numbers from this file
    file_invs = list(set(inv['inv'] for inv in data['invoices']))
    
    # Determine which are new (not already in a Cape Town load)
    new_invs = [inv for inv in file_invs if inv not in existing_invs]
    
    sql_lines.append(f"-- {fname}: Driver={data['driver']}, Date={data['date']}, Invoices={len(file_invs)} (new={len(new_invs)})")
    
    # Create the Load
    sql_lines.append(f"INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)")
    sql_lines.append(f"VALUES ('{load_number}', {WAREHOUSE_ID}, {driver_id}, 'Delivered', '{date_sql}', GETDATE(), GETDATE());")
    sql_lines.append("")
    
    # Link invoices - update ImportedInvoices that match these invoice numbers and don't already have a LoadId
    if new_invs:
        inv_list = "','".join(new_invs)
        sql_lines.append(f"-- Link {len(new_invs)} new invoices to {load_number}")
        sql_lines.append(f"UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = '{load_number}')")
        sql_lines.append(f"WHERE TransactionNumber IN ('{inv_list}')")
        sql_lines.append(f"AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = {WAREHOUSE_ID}));")
        sql_lines.append("")
        total_invoices_linked += len(new_invs)
    
    imported_count += 1
    next_load_num += 1

sql_lines.append("COMMIT;")
sql_lines.append("")
sql_lines.append(f"-- Summary: {imported_count} tripsheets created, {total_invoices_linked} invoice groups linked")
sql_lines.append(f"-- Load numbers: RF-000373 to RF-{next_load_num-1:06d}")
sql_lines.append("")
sql_lines.append("-- Verify:")
sql_lines.append("SELECT l.LoadNumber, l.Status, d.FirstName AS Driver, CONVERT(varchar, l.ScheduledDeliveryDate, 23) AS DeliveryDate,")
sql_lines.append("  (SELECT COUNT(*) FROM ImportedInvoices ii WHERE ii.LoadId = l.Id) AS InvoiceCount")
sql_lines.append("FROM Loads l")
sql_lines.append("JOIN Drivers d ON l.DriverId = d.Id")
sql_lines.append(f"WHERE l.LoadNumber >= 'RF-000373'")
sql_lines.append("ORDER BY l.LoadNumber;")

sql_content = '\n'.join(sql_lines)

with open('Database/ImportCptTripsheets.sql', 'w') as f:
    f.write(sql_content)

print(f"Generated SQL: Database/ImportCptTripsheets.sql")
print(f"Tripsheets to create: {imported_count}")
print(f"Invoice groups to link: {total_invoices_linked}")
print(f"Load numbers: RF-000373 to RF-{next_load_num-1:06d}")
print(f"\nFiles skipped:")
for s in sorted(skip_files):
    print(f"  {s}")
