import openpyxl, pyodbc
ws = openpyxl.load_workbook(r'C:\Users\Administrator\Documents\GitHub\INtranet\uploads\OEDHISTC.xlsx', read_only=True).active
nums = set(); dates = []
for r in ws.iter_rows(min_row=2, values_only=True):
    if r[2] in ('IN', 'CR') and r[4]: nums.add(str(r[4]).strip()); dates.append(r[3])
lo, hi = min(dates), max(dates); print('file range', lo.date(), hi.date())
cn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost,1435;DATABASE=ProjectTrackerDB;UID=sa;PWD=YourStrong@Passw0rd;TrustServerCertificate=yes'); c = cn.cursor()
c.execute("SELECT TransactionNumber, TransactionType, MIN(CustomerNumber), MIN(CustomerName), MIN(TransactionDate), SUM(SalesAmount), MIN(ImportBatchId) FROM ImportedInvoices WHERE SourceCompany='PMT' AND TransactionDate BETWEEN ? AND ? GROUP BY TransactionNumber, TransactionType", lo, hi)
rows = c.fetchall()
base = lambda n: n.split('-')[0]
missing = [r for r in rows if base(r[0]) not in nums]
print(f'PMT in DB within range: {len(rows)}; not in PMT file: {len(missing)}')
from collections import Counter
print(Counter((r[1], r[0][:4]) for r in missing))
for r in sorted(missing, key=lambda r: r[4])[:30]: print(' ', r[0], r[1], r[2], r[3], r[4].date(), r[5], r[6])
