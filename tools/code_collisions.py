import openpyxl, glob, os, collections
base = r'C:\Users\Administrator\Documents\GitHub\INtranet\docs\Updates'
codes = collections.defaultdict(list)
for f in glob.glob(base + r'\**\*.xlsx', recursive=True):
    region = os.path.basename(os.path.dirname(f)).upper()
    comp = os.path.splitext(os.path.basename(f))[0].upper()
    wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        hi = next((i for i, r in enumerate(rows) if r and any(isinstance(c, str) and c.strip().upper() == 'CODE' for c in r)), None)
        if hi is None: continue
        hdr = [str(c).strip().upper() if c else '' for c in rows[hi]]
        ci = hdr.index('CODE'); di = hdr.index('DESCRIPTION')
        cl = next((i for i, h in enumerate(hdr) if h.startswith('CLOSING')), None)
        if cl is None: cl = len(hdr) - 1
        n = 0
        for r in rows[hi + 1:]:
            if not r or len(r) <= cl or not r[ci]: continue
            q = r[cl] if isinstance(r[cl], (int, float)) else 0
            codes[(region, str(r[ci]).strip())].append((comp, ws.title, str(r[di] or '')[:40], q))
            n += 1
        print(f'{region:4} {comp:22} {ws.title:12} rows={n}')
print()
for region in ['GP', 'CPT', 'PE', 'KZN']:
    col = {k: v for k, v in codes.items() if k[0] == region and len({x[0] for x in v}) > 1}
    print(f'{region}: codes shared by >1 company = {len(col)}')
    for k, v in list(col.items())[:6]:
        print('   ', k[1], v)
