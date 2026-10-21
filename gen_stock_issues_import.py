"""Generate SQL to import Data Issues sheets from the 4 consolidated stock workbooks."""
import openpyxl

FILES = {
    'CPT': ('C:/Users/Administrator/Desktop/CPT_Consolidated_Stock.xlsx', 3),
    'GP':  ('C:/Users/Administrator/Desktop/GP_Consolidated_Stock.xlsx', 2),
    'KZN': ('C:/Users/Administrator/Desktop/KZN_Consolidated_Stock.xlsx', 1),
    'PE':  ('C:/Users/Administrator/Desktop/PE_Consolidated_Stock.xlsx', 4),
}

def esc(v):
    if v is None:
        return 'NULL'
    return "N'" + str(v).replace("'", "''") + "'"

rows = []
for region, (path, wh_id) in FILES.items():
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb['Data Issues']
    for r in ws.iter_rows(min_row=2, values_only=True):
        client, item_id, code, desc, date, issue, detail = (list(r) + [None]*7)[:7]
        if not issue:
            continue
        code_v = code or item_id
        date_v = f"'{date:%Y-%m-%d}'" if date else 'NULL'
        rows.append(
            f"({wh_id}, {esc(client)}, {esc(code_v)}, {esc(desc)}, {esc(issue)}, {esc(detail)}, {date_v})"
        )

print(f"-- {len(rows)} issues")
with open('Database/ImportStockIssues.sql', 'w', encoding='utf-8') as f:
    f.write("-- Imported Data Issues from consolidated stock workbooks (Oct 2026)\n")
    f.write("DELETE FROM StockIssues WHERE Source = 'Import';\n")
    for i in range(0, len(rows), 500):
        chunk = rows[i:i+500]
        f.write("INSERT INTO StockIssues (WarehouseId, Company, ItemCode, ItemDescription, IssueType, Detail, IssueDate, Status, CreatedBy, Source) SELECT v.*, 'Open', 'Excel Import', 'Import' FROM (VALUES\n")
        f.write(",\n".join(chunk))
        f.write("\n) v(WarehouseId, Company, ItemCode, ItemDescription, IssueType, Detail, IssueDate);\n")
print("written Database/ImportStockIssues.sql")
