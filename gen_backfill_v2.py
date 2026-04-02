#!/usr/bin/env python3
"""
Comprehensive product backfill generator.
Parses both kzn_tripsheet_data.json and cpt_tripsheet_data.json,
builds a complete invoice→product mapping, and outputs SQL UPDATEs.
"""
import json
import re

def parse_inv_entry(entry):
    """Parse invoice entry - either a dict or a @{inv=...} string"""
    if isinstance(entry, dict):
        inv_num = entry.get('inv', '').strip()
        product = entry.get('product', '').strip()
        code = entry.get('brand', '').strip()
        return inv_num or None, product or None, code
    else:
        # Fallback: parse as string
        s = str(entry)
        inv_match = re.search(r'inv=([A-Z0-9\-]+)', s)
        prod_match = re.search(r'product=([^;]+)', s)
        code_match = re.search(r'brand=([^;]+)', s)
        if inv_match and prod_match:
            return inv_match.group(1).strip(), prod_match.group(1).strip(), code_match.group(1).strip() if code_match else ''
        return None, None, None

def escape_sql(s):
    return s.replace("'", "''")

# Collect all invoice-product mappings
# Key: invoice_number, Value: (product_description, product_code)
all_mappings = {}

# Process KZN
print("Processing kzn_tripsheet_data.json...")
with open('kzn_tripsheet_data.json', 'r') as f:
    kzn = json.load(f)

for key, trip in kzn.items():
    for inv_str in trip.get('invoices', []):
        inv_num, product, code = parse_inv_entry(inv_str)
        if inv_num and product and product.strip() and product.strip() not in ('', ';'):
            if inv_num not in all_mappings:
                all_mappings[inv_num] = (product.strip(), code.strip() if code else '')

# Process CPT
print("Processing cpt_tripsheet_data.json...")
with open('cpt_tripsheet_data.json', 'r') as f:
    cpt = json.load(f)

for key, trip in cpt.items():
    for inv_str in trip.get('invoices', []):
        inv_num, product, code = parse_inv_entry(inv_str)
        if inv_num and product and product.strip() and product.strip() not in ('', ';'):
            if inv_num not in all_mappings:
                all_mappings[inv_num] = (product.strip(), code.strip() if code else '')

print(f"Total unique invoice-product mappings: {len(all_mappings)}")

# Generate SQL
sql_lines = [
    "-- Comprehensive Product Backfill v2",
    "-- Generated from kzn_tripsheet_data.json + cpt_tripsheet_data.json",
    "-- Only updates rows where ProductDescription is currently NULL or empty",
    "",
    "BEGIN TRANSACTION;",
    "",
]

count = 0
for inv_num, (product, code) in sorted(all_mappings.items()):
    safe_product = escape_sql(product)
    safe_code = escape_sql(code) if code else ''
    
    if safe_code:
        sql = (
            f"UPDATE ImportedInvoices "
            f"SET ProductDescription = '{safe_product}', ProductCode = '{safe_code}' "
            f"WHERE TransactionNumber = '{inv_num}' "
            f"AND (ProductDescription IS NULL OR ProductDescription = '');"
        )
    else:
        sql = (
            f"UPDATE ImportedInvoices "
            f"SET ProductDescription = '{safe_product}' "
            f"WHERE TransactionNumber = '{inv_num}' "
            f"AND (ProductDescription IS NULL OR ProductDescription = '');"
        )
    
    sql_lines.append(sql)
    count += 1

sql_lines.extend([
    "",
    "COMMIT;",
    "",
    f"-- Total UPDATE statements: {count}",
    "SELECT COUNT(*) as UpdatedRows FROM ImportedInvoices WHERE ProductDescription IS NOT NULL AND ProductDescription != '';",
])

output_file = 'Database/BackfillProductDescriptions_v2.sql'
with open(output_file, 'w') as f:
    f.write('\n'.join(sql_lines))

print(f"Written {count} UPDATE statements to {output_file}")
print("\nSample entries:")
for k, (p, c) in list(all_mappings.items())[:10]:
    print(f"  {k}: {p}" + (f" [{c}]" if c else ""))
