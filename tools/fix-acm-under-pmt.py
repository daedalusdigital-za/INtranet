import openpyxl, pyodbc, sys
APPLY = '--apply' in sys.argv
ws = openpyxl.load_workbook(r'C:\Users\Administrator\Documents\GitHub\INtranet\uploads\OEDHISTC.xlsx', read_only=True).active
nums = {str(r[4]).strip() for r in ws.iter_rows(min_row=2, values_only=True) if r[2] in ('IN', 'CR') and r[4]}
cn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost,1435;DATABASE=ProjectTrackerDB;UID=sa;PWD=YourStrong@Passw0rd;TrustServerCertificate=yes'); c = cn.cursor()
c.execute("SELECT Id, TransactionNumber, CustomerNumber, SalesAmount FROM ImportedInvoices WHERE SourceCompany='PMT' AND TransactionNumber LIKE 'IN14%'")
rows = [r for r in c.fetchall() if r[1].split('-')[0] not in nums]
tn = sorted({r[1] for r in rows}); print('ACM-range invoices under PMT:', len(tn), 'lines:', len(rows), 'value:', sum(float(r[3]) for r in rows))
ph = ','.join('?' * len(tn))
c.execute(f"SELECT TransactionNumber, COUNT(*), SUM(SalesAmount) FROM ImportedInvoices WHERE SourceCompany='ACM' AND TransactionNumber IN ({ph}) GROUP BY TransactionNumber", tn)
dup = c.fetchall(); print('already under ACM (duplicate):', len(dup))
for d in dup[:10]: print(' ', d)
if APPLY:
    dupset = {d[0] for d in dup}
    ids = [r[0] for r in rows if r[1] not in dupset]
    if ids:
        c.execute(f"UPDATE ImportedInvoices SET SourceCompany='ACM', UpdatedAt=SYSUTCDATETIME() WHERE Id IN ({','.join('?'*len(ids))})", ids); print('moved to ACM:', c.rowcount)
    dids = [r[0] for r in rows if r[1] in dupset]
    if dids:
        # Exact duplicate of the earlier ACM import (same lines, load, POD links) — remove the second copy.
        p = ','.join('?' * len(dids))
        c.execute(f"DELETE FROM PodDocumentInvoiceLinks WHERE InvoiceId IN ({p})", dids); print('duplicate POD links removed:', c.rowcount)
        c.execute(f"DELETE FROM ImportedInvoices WHERE Id IN ({p})", dids); print('duplicate PMT copies deleted:', c.rowcount)
    cn.commit()
