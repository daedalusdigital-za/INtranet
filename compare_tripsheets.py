import json

# Load parsed data
with open('cpt_tripsheet_data.json', 'r') as f:
    all_data = json.load(f)

# Existing invoice numbers in DB Cape Town tripsheets
existing_invs = set([
    'IN142779', 'IN142818', 'IN142953', 'IN143173', 'IN143261',
    'IN161668', 'IN161821', 'IN161828', 'IN161831', 'IN161835',
    'IN161914', 'IN161942', 'IN161943', 'IN161955', 'IN162021',
    'IN162028', 'IN162036', 'IN162037', 'IN162038', 'IN162175',
    'IN162240', 'IN162296', 'IN162309', 'IN162350', 'IN162531',
    'IN162532', 'IN162546', 'IN162635', 'IN162779', 'IN162780',
    'IN162781', 'IN162904', 'IN162958'
])

print(f"Existing unique invoice numbers in DB: {len(existing_invs)}")
print(f"Total Excel files: {len(all_data)}")
print()

# For each Excel file, check if ALL its invoices are already in DB
new_tripsheets = []
existing_tripsheets = []
partial_tripsheets = []

for fname, data in sorted(all_data.items()):
    file_invs = set(inv['inv'] for inv in data['invoices'])
    matched = file_invs & existing_invs
    unmatched = file_invs - existing_invs
    
    if len(matched) == len(file_invs) and len(file_invs) > 0:
        existing_tripsheets.append(fname)
        status = "ALREADY EXISTS"
    elif len(matched) > 0 and len(unmatched) > 0:
        partial_tripsheets.append((fname, data, matched, unmatched))
        status = "PARTIAL MATCH"
    else:
        new_tripsheets.append((fname, data))
        status = "NEW"
    
    print(f"{status}: {fname} - Driver={data['driver']}, Date={data['date']}, Invoices={data['count']}")
    if matched:
        print(f"  Matched: {sorted(matched)}")
    if unmatched:
        print(f"  New:     {sorted(unmatched)}")

print(f"\n=== SUMMARY ===")
print(f"Already in DB (all invoices match): {len(existing_tripsheets)}")
print(f"Partial match (some invoices exist): {len(partial_tripsheets)}")
print(f"Completely new (no invoices in DB):  {len(new_tripsheets)}")

# Check for duplicate files (same invoices)
print(f"\n=== DUPLICATE CHECK ===")
seen = {}
for fname, data in sorted(all_data.items()):
    key = tuple(sorted(set(inv['inv'] for inv in data['invoices'])))
    if key in seen:
        print(f"DUPLICATE: {fname} has same invoices as {seen[key]}")
    else:
        seen[key] = fname
