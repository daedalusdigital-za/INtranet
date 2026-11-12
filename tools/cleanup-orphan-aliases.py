import pyodbc, sys
CO = next((a for a in sys.argv[1:] if not a.startswith('--')), 'ACM')
NAME = {'ACM': 'Access Medical', 'PMT': 'Promed Technologies', 'PHT': 'Promed Pharmatech', 'SBT': 'Sebenzani Trading'}[CO]
cn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost,1435;DATABASE=ProjectTrackerDB;UID=sa;PWD=YourStrong@Passw0rd;TrustServerCertificate=yes'); cur = cn.cursor()
cur.execute("""SELECT a.Id, a.CustomerCode, a.CustomerName, a.CustomerMasterId FROM CustomerAliases a WHERE a.Company=?
  AND NOT EXISTS (SELECT 1 FROM ImportedInvoices i WHERE i.SourceCompany=? AND i.CustomerNumber=a.CustomerCode)
  AND NOT EXISTS (SELECT 1 FROM ArAgingItems g JOIN ArAgingSnapshots s ON s.Id=g.SnapshotId WHERE s.Company=? AND g.CustomerCode=a.CustomerCode)""", CO, CO, NAME)
orph = cur.fetchall(); print(f'orphan {CO} aliases:', len(orph))
for r in orph[:40]: print(' ', r)
cur.execute("SELECT TransactionNumber, CustomerNumber, CustomerName, TransactionDate, SUM(SalesAmount) FROM ImportedInvoices WHERE SourceCompany IS NULL OR SourceCompany='' GROUP BY TransactionNumber, CustomerNumber, CustomerName, TransactionDate ORDER BY TransactionDate")
rest = cur.fetchall(); print('still blank company:', len(rest))
for r in rest: print(' ', r)
if '--apply' in sys.argv and orph:
    ids = [r[0] for r in orph]
    cur.execute(f"DELETE FROM CustomerAliases WHERE Id IN ({','.join('?'*len(ids))})", ids); print('deleted aliases:', cur.rowcount)
    cur.execute("DELETE FROM CustomerMasters WHERE NOT EXISTS (SELECT 1 FROM CustomerAliases a WHERE a.CustomerMasterId=CustomerMasters.Id)"); print('deleted empty masters:', cur.rowcount)
    cn.commit()
