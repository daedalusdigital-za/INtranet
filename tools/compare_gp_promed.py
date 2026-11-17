import openpyxl, subprocess, csv, io, sys

SRC = r'C:\Users\Administrator\Documents\GitHub\INtranet\docs\Updates\GP\promed.xlsx'
wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
ws = wb[wb.sheetnames[0]]
print('sheets:', wb.sheetnames)

rows = list(ws.iter_rows(values_only=True))
for r in rows[:4]:
    print(r)

# find header row
hdr_i = next(i for i, r in enumerate(rows) if r and any(isinstance(c, str) and c.strip().upper() == 'CODE' for c in r))
hdr = [str(c).strip().upper() if c else '' for c in rows[hdr_i]]
ci = hdr.index('CODE'); di = hdr.index('DESCRIPTION'); cl = hdr.index('CLOSING BALANCE')
sheet = {}
noc = []
for r in rows[hdr_i + 1:]:
    if not r or len(r) <= cl: continue
    code, desc, close = r[ci], r[di], r[cl]
    if not desc: continue
    q = close if isinstance(close, (int, float)) else 0
    if not code:
        noc.append((desc, q)); continue
    code = str(code).strip()
    sheet[code] = sheet.get(code, 0) + q
print('sheet codes', len(sheet), 'no-code rows', len(noc), 'sheet total', sum(sheet.values()))

q = """SET NOCOUNT ON; SELECT c.Code, c.Name, c.Category, wi.QuantityOnHand FROM WarehouseInventory wi JOIN Commodities c ON c.Id=wi.CommodityId WHERE wi.WarehouseId=2"""
out = subprocess.run(['docker', 'exec', 'projecttracker-db', '/opt/mssql-tools18/bin/sqlcmd', '-S', 'localhost', '-U', 'sa', '-P', sys.argv[1], '-C', '-I', '-d', 'ProjectTrackerDB', '-h', '-1', '-W', '-s', '|', '-Q', q], capture_output=True, text=True).stdout
db = {}
for line in out.splitlines():
    p = line.split('|')
    if len(p) < 4: continue
    db[p[0].strip()] = (p[1].strip(), p[2].strip(), float(p[3]))
print('db GP rows', len(db))
cats = {}
for code, (n, cat, qty) in db.items(): cats[cat] = cats.get(cat, 0) + 1
print('db categories', cats)

diff = []
for code, sq in sheet.items():
    if code in db:
        if abs(db[code][2] - sq) > 0.01: diff.append((code, db[code][0][:45], db[code][1], db[code][2], sq))
    else:
        diff.append((code, '<<MISSING IN DB>>', '', None, sq))
print('\nMISMATCHES (code, name, dbCat, dbQty, sheetQty):', len(diff))
for d in diff[:80]: print(d)
print('\nno-code rows:', noc)
