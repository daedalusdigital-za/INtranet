"""Verify every company sheet in docs/Updates against WarehouseInventory, matching by code AND company."""
import openpyxl, glob, os, subprocess, re, sys
base = r'C:\Users\Administrator\Documents\GitHub\INtranet\docs\Updates'
WH = {'kzn': 1, 'GP': 2, 'CPT': 3, 'PE': 4}
def company_from(n):
    n = n.upper()
    for k in ('ACCESS', 'PROMED', 'SEBENZANI'):
        if k in n: return k
    return 'PHARMACARE' if 'PHARMA' in n else None
pw = subprocess.check_output(['docker', 'exec', 'projecttracker-db', 'printenv', 'SA_PASSWORD'], text=True).strip()
q = "SET NOCOUNT ON; SELECT wi.WarehouseId, ISNULL(c.Code,''), ISNULL(UPPER(c.Category),''), wi.QuantityOnHand, c.Name FROM WarehouseInventory wi JOIN Commodities c ON c.Id=wi.CommodityId"
res = subprocess.check_output(['docker', 'exec', 'projecttracker-db', '/opt/mssql-tools18/bin/sqlcmd', '-C', '-S', 'localhost', '-U', 'sa', '-P', pw, '-d', 'ProjectTrackerDB', '-h', '-1', '-W', '-s', '\t', '-Q', q], text=True, encoding='utf-8', errors='replace')
db = {}
for ln in res.splitlines():
    p = ln.split('\t')
    if len(p) < 5 or not p[0].strip().isdigit(): continue
    key = (int(p[0]), re.sub(r'[^A-Z0-9]', '', p[1].upper()), p[2].strip())
    db[key] = db.get(key, 0) + float(p[3])
dbcodes = {}
for (wh, code, cat), qty in db.items(): dbcodes.setdefault((wh, code), []).append((cat, qty))

total_bad = 0
for region, wh in WH.items():
    for f in sorted(glob.glob(os.path.join(base, region, '*.xlsx'))):
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        for ws in wb.worksheets:
            comp = company_from(ws.title) if len(wb.worksheets) > 1 else company_from(os.path.basename(f))
            if comp is None: continue
            rows = list(ws.iter_rows(values_only=True))
            hi = next((i for i, r in enumerate(rows) if r and any(isinstance(c, str) and c.strip().upper() == 'CODE' for c in r)), None)
            if hi is None: continue
            hdr = [str(c).strip().upper() if c else '' for c in rows[hi]]
            ci = hdr.index('CODE'); di = hdr.index('DESCRIPTION')
            cl = next((i for i, h in enumerate(hdr) if h.startswith('CLOSING') or h == 'QUANTITY'), len(hdr) - 1)
            sheet = {}
            for r in rows[hi + 1:]:
                if not r or len(r) <= cl or not r[ci]: continue
                v = r[cl]
                if v is None and len(r) > 5 and all(h in hdr for h in ('OPENING BALANCE',)):
                    o, i_, u = (r[hdr.index(h)] if h in hdr and isinstance(r[hdr.index(h)], (int, float)) else 0 for h in ('OPENING BALANCE', 'STOCK IN', 'STOCK OUT'))
                    v = o + i_ - u
                qv = float(v) if isinstance(v, (int, float)) else 0.0
                code = re.sub(r'[^A-Z0-9]', '', str(r[ci]).upper())
                sheet[code] = sheet.get(code, 0) + qv
            bad = []
            for code, sq in sheet.items():
                dq = db.get((wh, code, comp))
                if dq is None:
                    alts = dbcodes.get((wh, code), [])
                    bad.append((code, sq, 'MISSING for ' + comp, alts))
                elif abs(dq - sq) > 0.01:
                    bad.append((code, sq, dq, ''))
            total_bad += len(bad)
            print(f'{region:4} {os.path.basename(f):26} {ws.title:16} {comp:10} rows={len(sheet):4} sheetQty={sum(sheet.values()):>12,.0f} mismatches={len(bad)}')
            for b in bad[:15]: print('      ', b)
print('TOTAL mismatches', total_bad)
