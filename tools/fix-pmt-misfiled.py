"""Reassign PMT invoices misfiled under ACM (or blank company). Dry-run unless --apply."""
import csv, sys, pyodbc
APPLY = '--apply' in sys.argv
rows = [r for r in csv.DictReader(open(r'C:\Users\Administrator\Documents\GitHub\INtranet\tools\pmt-misfiled.csv')) if r['DbCustomer'] == r['FileCustomer'] and r['Type'] == 'IN']
nums = [r['TransactionNumber'] for r in rows]
cn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost,1435;DATABASE=ProjectTrackerDB;UID=sa;PWD=YourStrong@Passw0rd;TrustServerCertificate=yes')
cur = cn.cursor()
ph = ','.join('?' * len(nums))
cur.execute(f"SELECT TransactionNumber, COUNT(*) FROM ImportedInvoices WHERE SourceCompany='PMT' AND TransactionNumber IN ({ph}) GROUP BY TransactionNumber", nums)
dups = cur.fetchall(); print('already under PMT (would duplicate):', dups)
cur.execute(f"SELECT ISNULL(SourceCompany,'<blank>'), COUNT(*), SUM(SalesAmount), MIN(TransactionDate), MAX(TransactionDate), COUNT(DISTINCT LoadId) FROM ImportedInvoices WHERE (SourceCompany='ACM' OR SourceCompany IS NULL) AND TransactionNumber IN ({ph}) GROUP BY SourceCompany", nums)
for r in cur.fetchall(): print('to fix:', r)
cur.execute(f"SELECT ImportBatchId, SourceSystem, COUNT(*) FROM ImportedInvoices WHERE (SourceCompany='ACM' OR SourceCompany IS NULL) AND TransactionNumber IN ({ph}) GROUP BY ImportBatchId, SourceSystem", nums)
print('batches:', cur.fetchall())
# Related rows that carry company too
cur.execute(f"SELECT COUNT(*) FROM PodDocumentInvoiceLinks l JOIN ImportedInvoices i ON i.Id=l.InvoiceId WHERE (i.SourceCompany='ACM' OR i.SourceCompany IS NULL) AND i.TransactionNumber IN ({ph})", nums)
print('POD links on these invoices:', cur.fetchone()[0])
if APPLY:
    skip = {d[0] for d in dups}
    todo = [n for n in nums if n not in skip]
    ph2 = ','.join('?' * len(todo))
    cur.execute(f"UPDATE ImportedInvoices SET SourceCompany='PMT', UpdatedAt=SYSUTCDATETIME() WHERE (SourceCompany='ACM' OR SourceCompany IS NULL) AND TransactionNumber IN ({ph2})", todo)
    print('updated rows:', cur.rowcount); cn.commit()
    cur.execute(f"SELECT ISNULL(SourceCompany,'<blank>'), COUNT(*) FROM ImportedInvoices WHERE TransactionNumber IN ({ph}) GROUP BY SourceCompany", nums)
    print('after:', cur.fetchall())
