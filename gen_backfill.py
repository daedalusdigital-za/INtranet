import json

with open('kzn_tripsheet_data.json') as f:
    kzn = json.load(f)
with open('cpt_tripsheet_data.json') as f:
    cpt = json.load(f)

mapping = {}
for data in [kzn, cpt]:
    for trip in data.values():
        for inv in trip.get('invoices', []):
            inv_num = inv.get('inv', '').strip()
            product = inv.get('product', '').strip()
            brand = inv.get('brand', '').strip()
            if inv_num and product:
                mapping[inv_num] = (product, brand)

lines = ['-- Backfill ProductDescription from tripsheet JSON data', 'BEGIN TRANSACTION;', '']
for inv_num, (product, brand) in mapping.items():
    product_safe = product.replace("'", "''")
    brand_safe = brand.replace("'", "''")
    lines.append(
        "UPDATE ImportedInvoices SET ProductDescription = '" + product_safe +
        "', ProductCode = '" + brand_safe +
        "' WHERE TransactionNumber = '" + inv_num +
        "' AND (ProductDescription IS NULL OR ProductDescription = '');"
    )

lines.append('')
lines.append('COMMIT;')
lines.append("SELECT COUNT(*) as UpdatedRows FROM ImportedInvoices WHERE ProductDescription IS NOT NULL AND ProductDescription != '';")

with open('Database/BackfillProductDescriptions.sql', 'w') as f:
    f.write('\n'.join(lines))

print('Generated SQL with ' + str(len(mapping)) + ' UPDATE statements')
