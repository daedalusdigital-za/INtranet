import openpyxl, glob, os, collections, subprocess, sys, json
base = r'C:\Users\Administrator\Documents\GitHub\INtranet\docs\Updates'
WH = {'GP': 2, 'CPT': 3, 'kzn': 1, 'PE': 4}
ONLY = sys.argv[1].split(',') if len(sys.argv) > 1 else list(WH)
def company_from(n):
    n = n.upper()
    for k in ('ACCESS', 'PROMED', 'SEBENZANI'):
        if k in n: return k
    return 'PHARMACARE' if 'PHARMA' in n else None
codes = collections.defaultdict(list)
for region, wh in WH.items():
    if region not in ONLY: continue
    for f in glob.glob(os.path.join(base, region, '*.xlsx')):
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        for ws in wb.worksheets:
            comp = company_from(ws.title) if len(wb.worksheets) > 1 else company_from(os.path.basename(f))
            if comp is None: continue
            rows = list(ws.iter_rows(values_only=True))
            hi = next((i for i, r in enumerate(rows[:6]) if r and any(isinstance(c, str) and c.strip().upper() in ('CODE', 'ITEM CODE') for c in r)), None)
            if hi is None: continue
            hdr = [str(c).strip().upper() if c else '' for c in rows[hi]]
            nxt = [str(c).strip().upper() if c else '' for c in rows[hi + 1]] if hi + 1 < len(rows) else []
            if not any(h.startswith('CLOSING') for h in hdr) and any(h.startswith('CLOSING') for h in nxt):
                hdr = [h or (nxt[j] if j < len(nxt) else '') for j, h in enumerate(hdr)] + nxt[len(hdr):]
                hi += 1
            ci = next(i for i, h in enumerate(hdr) if h in ('CODE', 'ITEM CODE'))
            di = next(i for i, h in enumerate(hdr) if h in ('DESCRIPTION', 'ITEM DESCRIPTION'))
            ui = hdr.index('UOM') if 'UOM' in hdr else None
            cl = next((i for i, h in enumerate(hdr) if h.startswith('CLOSING')), len(hdr) - 1)
            for r in rows[hi + 1:]:
                if not r or len(r) <= cl or not r[ci]: continue
                q = r[cl] if isinstance(r[cl], (int, float)) else 0
                codes[(wh, str(r[ci]).strip())].append({'company': comp, 'desc': str(r[di] or '').strip(), 'uom': str(r[ui]).strip() if ui is not None and r[ui] else 'Each', 'qty': float(q)})
col = {k: v for k, v in codes.items() if len({x['company'] for x in v}) > 1}
# merge dup lines within same company
out = []
for (wh, code), v in col.items():
    per = collections.OrderedDict()
    for x in v:
        p = per.setdefault(x['company'], {'company': x['company'], 'desc': x['desc'], 'uom': x['uom'], 'qty': 0.0})
        p['qty'] += x['qty']
    out.append({'wh': wh, 'code': code, 'lines': list(per.values())})
json.dump(out, open(r'C:\Users\Administrator\Documents\GitHub\INtranet\tools\collisions.json', 'w'), indent=1)
for wh in sorted({o['wh'] for o in out}):
    mine = [o for o in out if o['wh'] == wh]
    multi = [o for o in mine if sum(1 for l in o['lines'] if l['qty']) > 1]
    print(f'wh {wh}: shared codes {len(mine)}, with >1 company non-zero {len(multi)}')
    for o in multi[:10]: print('    ', o['code'], [(l['company'], l['qty'], l['desc'][:30]) for l in o['lines']])
if not out: sys.exit()
# compare to DB
pw = subprocess.check_output(['docker', 'exec', 'projecttracker-db', 'printenv', 'SA_PASSWORD'], text=True).strip()
codelist = ",".join(f"'{o['code']}'" for o in out)
q = f"""SET NOCOUNT ON;
SELECT c.Id, c.Code, ISNULL(c.Category,''), c.Name, wi.WarehouseId, wi.QuantityOnHand,
 ISNULL((SELECT SUM(m.Quantity) FROM WarehouseStockMovements m WHERE m.CommodityId=c.Id AND m.WarehouseId=wi.WarehouseId AND m.Status='Approved' AND m.Reference<>'COUNT-2026-11-02' AND m.CreatedAt>(SELECT MIN(CreatedAt) FROM WarehouseStockMovements WHERE Reference='COUNT-2026-11-02')),0) postMov
FROM Commodities c JOIN WarehouseInventory wi ON wi.CommodityId=c.Id WHERE c.Code IN ({codelist}) AND wi.WarehouseId IN (1,2,3,4)"""
res = subprocess.check_output(['docker', 'exec', 'projecttracker-db', '/opt/mssql-tools18/bin/sqlcmd', '-C', '-S', 'localhost', '-U', 'sa', '-P', pw, '-d', 'ProjectTrackerDB', '-h', '-1', '-W', '-s', '\t', '-Q', q], text=True)
db = {}
for ln in res.splitlines():
    p = ln.split('\t')
    if len(p) < 7: continue
    k = (int(p[4]), p[1].strip())
    d = db.setdefault(k, {'id': int(p[0]), 'cat': p[2].strip(), 'name': p[3].strip(), 'qty': 0.0, 'post': 0.0, 'rows': 0})
    d['qty'] += float(p[5]); d['post'] += float(p[6]); d['rows'] += 1
withpost = [(k, v) for k, v in db.items() if v['post'] != 0]
print('db rows', len(db), 'with post-count movements', len(withpost))
for k, v in withpost: print('  ', k, v)
bad = 0; already = 0
for o in out:
    d = db.get((o['wh'], o['code']))
    if not d: print('NOT IN DB', o); continue
    total = sum(l['qty'] for l in o['lines'])
    if d['rows'] > 1: already += 1
    if abs(d['qty'] - d['post'] - total) > 0.01: bad += 1; print('  unexpected', o['code'], d, total)
print('rows where DB total = summed sheet total:', len(out) - bad, '| already split into >1 row:', already)
