"""
Accuracy report: docs/Updates sheets vs WarehouseInventory, by code + company, and a StockIssues rebuild.
  python tools/count_accuracy.py          -> report only
  python tools/count_accuracy.py apply    -> also dismiss all open issues and insert these
"""
import openpyxl, glob, os, subprocess, re, sys, collections
ROOT = r'C:\Users\Administrator\Documents\GitHub\INtranet'
base = os.path.join(ROOT, 'docs', 'Updates')
WH = {'kzn': 1, 'GP': 2, 'CPT': 3, 'PE': 4}
WHN = {1: 'KZN', 2: 'GP', 3: 'CPT', 4: 'PE'}
APPLY = 'apply' in sys.argv

def company_from(n):
    n = n.upper()
    for k in ('ACCESS', 'PROMED', 'SEBENZANI'):
        if k in n: return k
    # Pharmacare is written many ways on the sheets: PHARMACARE, pharmatech, PPH
    if 'PHARMA' in n or re.search(r'\bPPH\b', n): return 'PHARMACARE'
    return None
def nc(c): return re.sub(r'[^A-Z0-9]', '', str(c).upper())
def esc(s): return str(s).replace("'", "''")

pw = subprocess.check_output(['docker', 'exec', 'projecttracker-db', 'printenv', 'SA_PASSWORD'], text=True).strip()
def sql(q, file=False):
    args = ['docker', 'exec', 'projecttracker-db', '/opt/mssql-tools18/bin/sqlcmd', '-C', '-S', 'localhost', '-U', 'sa', '-P', pw, '-d', 'ProjectTrackerDB', '-I', '-h', '-1', '-W', '-s', '\t']
    args += ['-i', q] if file else ['-Q', 'SET NOCOUNT ON; ' + q]
    return subprocess.check_output(args, text=True, encoding='utf-8', errors='replace')

db = {}      # (wh, ncode, company) -> qty
dbname = {}  # (wh, ncode, company) -> name
dbuom = {}   # (wh, ncode, company) -> unit of measure
dbprice = {} # (wh, ncode, company) -> unit price (None when blank)
for ln in sql("SELECT wi.WarehouseId, ISNULL(c.Code,''), ISNULL(UPPER(c.Category),''), wi.QuantityOnHand, ISNULL(c.UnitOfMeasure,''), ISNULL(CAST(wi.UnitPrice AS NVARCHAR(30)),''), c.Name FROM WarehouseInventory wi JOIN Commodities c ON c.Id=wi.CommodityId").splitlines():
    p = ln.split('\t')
    if len(p) < 7 or not p[0].strip().isdigit(): continue
    k = (int(p[0]), nc(p[1]) or ('~' + nc(p[6])), p[2].strip())   # uncoded items keyed by description
    db[k] = db.get(k, 0) + float(p[3]); dbname[k] = p[6].strip(); dbuom[k] = p[4].strip(); dbprice[k] = p[5].strip() or None
bycode = collections.defaultdict(list)
for (wh, code, cat), q in db.items():
    if code and not code.startswith('~'): bycode[(wh, code)].append((cat, q))
# description index for sheets that carry no code column (Pharmacare): (wh, company, ndesc) -> [(ncode, qty)]
bydesc = collections.defaultdict(list)
for (wh, code, cat), q in db.items():
    bydesc[(wh, cat, nc(dbname[(wh, code, cat)]))].append((code, q))

issues = []  # (wh, company, code, desc, type, detail)
tot_rows = exact = qty_ok_label_off = qty_wrong = 0
tot_sheet_qty = tot_matched_qty = 0.0
sheet_seen = collections.defaultdict(set)  # wh -> set of (ncode, company) matched
per = []
for region, wh in WH.items():
    for f in sorted(glob.glob(os.path.join(base, region, '*.xlsx'))):
        wb = openpyxl.load_workbook(f, read_only=True, data_only=True)
        fname = os.path.basename(f)
        for ws in wb.worksheets:
            if 'DAMAGED' in ws.title.upper(): continue
            comp = company_from(ws.title) if len(wb.worksheets) > 1 else company_from(fname)
            if comp is None: continue
            rows = list(ws.iter_rows(values_only=True))
            hi = next((i for i, r in enumerate(rows[:6]) if r and any(isinstance(c, str) and c.strip().upper() in ('CODE', 'ITEM CODE', 'DESCRIPTION', 'ITEM DESCRIPTION') for c in r)), None)
            if hi is None:
                print(f'!! {region}/{fname} [{ws.title}] skipped: no header row found'); continue
            # header may be split over two rows (PE sheets): merge the next row's labels in
            hdr = [str(c).strip().upper() if c else '' for c in rows[hi]]
            nxt = [str(c).strip().upper() if c else '' for c in rows[hi + 1]] if hi + 1 < len(rows) else []
            if not any(h.startswith('CLOSING') for h in hdr) and any(h.startswith('CLOSING') for h in nxt):
                hdr = [h or (nxt[j] if j < len(nxt) else '') for j, h in enumerate(hdr)] + nxt[len(hdr):]
                hi += 1
            ci = next((i for i, h in enumerate(hdr) if h in ('CODE', 'ITEM CODE')), None)
            di = next(i for i, h in enumerate(hdr) if h in ('DESCRIPTION', 'ITEM DESCRIPTION'))
            desc_only = ci is None
            cl = next((i for i, h in enumerate(hdr) if h.startswith('CLOSING') or h == 'QUANTITY'), len(hdr) - 1)
            ui = next((i for i, h in enumerate(hdr) if h in ('UOM', 'UNIT', 'UNIT OF MEASURE')), None)
            src = f'{region}/{fname} [{ws.title}]'
            seen_codes = collections.Counter()
            lines = []
            for rn, r in enumerate(rows[hi + 1:], start=hi + 2):
                if not r or len(r) <= cl: continue
                code, desc, v = (r[ci] if ci is not None else None), r[di], r[cl]
                if code is None and not desc: continue
                if str(desc or '').strip().upper() in ('TOTAL', 'TOTALS'): continue
                blank = v is None or (isinstance(v, str) and not v.strip())
                qv = float(v) if isinstance(v, (int, float)) else 0.0
                lines.append((rn, code, str(desc or '').strip(), qv, blank, str(r[ui] or '').strip() if ui is not None and len(r) > ui else ''))
                if code is not None: seen_codes[nc(code)] += 1
            n = ok = label = wrong = 0; sq = 0.0; mq = 0.0
            code_sum = collections.defaultdict(float)
            for rn, code, desc, qv, blank, uom in lines:
                if code is not None: code_sum[nc(code)] += qv
            for rn, code, desc, qv, blank, uom in lines:
                if blank and (code or desc):
                    stored = db.get((wh, nc(code), comp)) if code is not None else None
                    issues.append((wh, comp, code, desc, 'Closing balance not filled in', f'{src} row {rn}: closing balance blank. System holds {stored:g}. Confirm the count.' if stored is not None else f'{src} row {rn}: closing balance blank. Confirm the count.'))
                if qv < 0:
                    issues.append((wh, comp, code, desc, 'Negative balance', f'{src} row {rn}: closing balance {qv:g}. Stock cannot be negative - check stock out entries.'))
                if code is None:
                    if desc_only:
                        # no code column on this sheet: match by description within the same warehouse + company
                        n += 1; sq += qv
                        cands = bydesc.get((wh, comp, nc(desc)), [])
                        total = sum(q for _, q in cands)
                        if cands and abs(total - qv) < 0.01:
                            ok += 1; mq += qv
                            for c, _ in cands: sheet_seen[wh].add((c, comp))
                        else:
                            wrong += 1
                            issues.append((wh, comp, None, desc, 'Quantity differs from sheet', f'{src} row {rn}: sheet {qv:g}, system {total if cands else "not found"} (matched by description - sheet has no code column).'))
                        continue
                    k = (wh, '', comp)
                    sheet_seen[wh].add(('~' + nc(desc), comp))
                    issues.append((wh, comp, None, desc, 'Missing item code', f'{src} row {rn}: "{desc}" has no code (qty {qv:g}). Loaded as an uncoded item - please add the Sage code.'))
                    continue
                n += 1; sq += qv
                k = nc(code)
                if seen_codes[k] > 1:
                    issues.append((wh, comp, code, desc, 'Duplicate code on sheet', f'{src} row {rn}: code appears {seen_codes[k]}x on this sheet; quantities were added together.'))
                    seen_codes[k] = -1  # report once
                own = db.get((wh, k, comp))
                cmp_q = code_sum[k] if seen_codes[k] != 1 else qv   # duplicated code: system holds the sum
                if own is not None and abs(own - cmp_q) < 0.01:
                    ok += 1; mq += qv; sheet_seen[wh].add((k, comp))
                    su, du = nc(uom), nc(dbuom.get((wh, k, comp), ''))
                    if qv != 0 and su and du and su != du and not su.isdigit() and not du.isdigit() and not (su in ('EA', 'EACH', 'UNIT') and du in ('EA', 'EACH', 'UNIT')):
                        issues.append((wh, comp, code, desc, 'Unit of measure differs', f'{src} row {rn}: sheet counts in {uom}, system item is {dbuom[(wh, k, comp)]}. Confirm whether {qv:,.0f} is packs or units.'))
                    if qv != 0 and dbprice.get((wh, k, comp)) in (None, '0.00', '0'):
                        issues.append((wh, comp, code, desc, 'Stock with no unit price', f'{src} row {rn}: {qv:g} on hand but no unit price - excluded from stock value.'))
                    continue
                alts = [(c, q) for c, q in bycode.get((wh, k), []) if c != comp]
                hit = [(c, q) for c, q in alts if abs(q - cmp_q) < 0.01]
                if own is None and hit:
                    label += 1; mq += qv; sheet_seen[wh].add((k, hit[0][0]))
                    issues.append((wh, comp, code, desc, 'Filed under another company', f'{src} row {rn}: qty {qv:g} is correct but the item is labelled {hit[0][0]} in the system (code only ever existed under {hit[0][0]}).'))
                else:
                    wrong += 1
                    have = own if own is not None else (alts[0][1] if alts else None)
                    issues.append((wh, comp, code, desc, 'Quantity differs from sheet', f'{src} row {rn}: sheet {qv:g}, system {have if have is not None else "not found"}.'))
            per.append((src, comp, n, ok, label, wrong, sq, mq))
            tot_rows += n; exact += ok; qty_ok_label_off += label; qty_wrong += wrong; tot_sheet_qty += sq; tot_matched_qty += mq

# DB items with stock that no sheet counted
not_on_sheet = []
for (wh, code, cat), q in db.items():
    if q == 0 or cat == 'DAMAGED-EXPIRED' or wh not in WHN: continue
    if (code, cat) in sheet_seen[wh]: continue
    not_on_sheet.append((wh, cat, code, dbname[(wh, code, cat)], q))
    issues.append((wh, cat, code, dbname[(wh, code, cat)], 'Item not on count sheet', f'System has {q:g} on hand but {WHN[wh]} {cat} did not count this item. Left as is - confirm or write off.'))

print(f'{"sheet":44} {"co":10} {"rows":>5} {"exact":>5} {"label":>5} {"wrong":>5}  rowAcc  qtyAcc')
for src, comp, n, ok, label, wrong, sq, mq in per:
    print(f'{src[:44]:44} {comp:10} {n:5} {ok:5} {label:5} {wrong:5}  {(ok+label)/n*100 if n else 0:5.1f}%  {mq/sq*100 if sq else 100:5.1f}%')
print(f'\nTOTAL rows {tot_rows}: quantity correct {exact+qty_ok_label_off} ({(exact+qty_ok_label_off)/tot_rows*100:.2f}%), of which under wrong company label {qty_ok_label_off} ({qty_ok_label_off/tot_rows*100:.2f}%); quantity wrong {qty_wrong} ({qty_wrong/tot_rows*100:.2f}%)')
print(f'Units: sheet {tot_sheet_qty:,.0f}, in system at the right quantity {tot_matched_qty:,.0f} ({tot_matched_qty/tot_sheet_qty*100:.3f}%)')
print(f'System items with stock not on any sheet: {len(not_on_sheet)} items, {sum(x[4] for x in not_on_sheet):,.0f} units')
print('\nIssues by type:')
for t, c in collections.Counter(i[4] for i in issues).most_common(): print(f'  {c:5} {t}')
if 'detail' in sys.argv:
    for x in sorted(not_on_sheet, key=lambda t: -t[4]):
        print(f'  NOT-ON-SHEET {WHN[x[0]]:3} {x[1]:10} {x[2]!r:18} {x[3][:40]:40} {x[4]:g}')
    for i in issues:
        if i[4] in ('Quantity differs from sheet', 'Duplicate code on sheet', 'Negative balance'):
            print(f'  {WHN[i[0]]:3} {i[1]:10} {str(i[2]):16} {(i[3] or "")[:36]:36} | {i[5].split(": ", 1)[1]}')

if APPLY:
    def v(x): return 'NULL' if x is None or x == '' else f"N'{esc(str(x))}'"
    out = ["SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRAN;",
           "UPDATE StockIssues SET Status='Dismissed', Resolution='Replaced by the Nov 2026 count accuracy review (code + company matching).', ResolvedBy='Stock count import', ResolvedAt=SYSUTCDATETIME() WHERE Status IN ('Open','InProgress');"]
    batch = []
    for wh, comp, code, desc, typ, detail in issues:
        batch.append(f"({wh},{v(comp and comp[:100])},{v(code and str(code)[:100])},{v(desc and str(desc)[:500])},{v(typ[:200])},{v(detail[:2000])},'2026-11-02','Open','Stock count import',SYSUTCDATETIME(),'Import')")
        if len(batch) == 300:
            out.append("INSERT INTO StockIssues (WarehouseId,Company,ItemCode,ItemDescription,IssueType,Detail,IssueDate,Status,CreatedBy,CreatedAt,Source) VALUES\n" + ",\n".join(batch) + ";"); batch = []
    if batch: out.append("INSERT INTO StockIssues (WarehouseId,Company,ItemCode,ItemDescription,IssueType,Detail,IssueDate,Status,CreatedBy,CreatedAt,Source) VALUES\n" + ",\n".join(batch) + ";")
    out.append("COMMIT; SELECT Status, COUNT(*) n FROM StockIssues GROUP BY Status; SELECT IssueType, COUNT(*) n FROM StockIssues WHERE Status='Open' GROUP BY IssueType ORDER BY n DESC;")
    path = os.path.join(ROOT, 'Database', 'StockIssuesNov2026Accuracy.sql')
    open(path, 'w', encoding='utf-8').write("\n".join(out))
    subprocess.run(['docker', 'cp', path, 'projecttracker-db:/tmp/issues.sql'], check=True, capture_output=True)
    print(sql('/tmp/issues.sql', file=True))
