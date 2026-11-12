"""Find Promed Technologies (PMT) transactions from OEDHISTC.xlsx that were imported under another company.
Writes tools/pmt-misfiled.csv with the list of (TransactionNumber, StoredCompany, lines, amount)."""
import openpyxl, csv, sys, pyodbc, os

XLSX = r'C:\Users\Administrator\Documents\GitHub\INtranet\uploads\OEDHISTC.xlsx'
CONN = os.environ.get('SQL_CONN') or 'DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost,1433;DATABASE=ProjectTrackerDb;UID=sa;PWD=' + os.environ.get('SA_PASSWORD', '') + ';TrustServerCertificate=yes'

wb = openpyxl.load_workbook(XLSX, read_only=True)
ws = wb[wb.sheetnames[0]]
txns = {}  # number -> (type, customer, date, sum amount)
cust = None
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[0] == 'Customer Number:':
        cust = (r[1], r[3]); continue
    if r[2] in ('IN', 'CR') and r[4]:
        n = str(r[4]).strip()
        t = txns.setdefault(n, {'type': r[2], 'cust': cust, 'date': r[3], 'amt': 0.0, 'lines': 0})
        t['amt'] += float(r[9] or 0); t['lines'] += 1
print(f'file: {len(txns)} transactions, IN={sum(1 for t in txns.values() if t["type"]=="IN")} CR={sum(1 for t in txns.values() if t["type"]=="CR")}')

cn = pyodbc.connect(CONN); cur = cn.cursor()
cur.execute("SELECT TransactionNumber, ISNULL(SourceCompany,''), COUNT(*), SUM(SalesAmount), MIN(CustomerNumber) FROM ImportedInvoices GROUP BY TransactionNumber, SourceCompany")
db = {}
for num, co, cnt, amt, custno in cur.fetchall():
    db.setdefault(num, []).append((co, cnt, float(amt or 0), custno))

mis = []
for n, t in txns.items():
    for co, cnt, amt, custno in db.get(n, []):
        if co != 'PMT':
            mis.append((n, t['type'], co, cnt, amt, t['amt'], custno, t['cust'][0] if t['cust'] else '', t['cust'][1] if t['cust'] else '', t['date']))
mis.sort()
print(f'misfiled: {len(mis)} transactions')
by = {}
for m in mis: by[m[2]] = by.get(m[2], 0) + 1
print('by stored company:', by)
# Numbers also present under PMT already (duplicate) vs not
dup = sum(1 for m in mis if any(c == 'PMT' for c, *_ in db.get(m[0], [])))
print(f'of which also already exist under PMT (duplicates): {dup}')
cust_mismatch = sum(1 for m in mis if (m[6] or '') != (m[7] or ''))
print(f'customer number differs between DB row and file: {cust_mismatch}')
with open(r'C:\Users\Administrator\Documents\GitHub\INtranet\tools\pmt-misfiled.csv', 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['TransactionNumber', 'Type', 'StoredCompany', 'DbLines', 'DbAmount', 'FileAmount', 'DbCustomer', 'FileCustomer', 'FileCustomerName', 'Date'])
    w.writerows(mis)
for m in mis[:15]: print(m)
