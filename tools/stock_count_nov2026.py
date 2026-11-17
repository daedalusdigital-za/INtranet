"""
Parse the Nov-2026 regional stock count workbooks (docs/Updates/{CPT,GP,PE,kzn}) and
emit (a) a match report against Commodities/WarehouseInventory and (b) a SQL script
that applies the counts as the new stock on hand.

Usage:
  python tools/stock_count_nov2026.py report   -> prints match report (no changes)
  python tools/stock_count_nov2026.py sql      -> writes Database/ApplyStockCountNov2026.sql
"""
import glob, os, re, sys, json, subprocess
import openpyxl

ROOT = r'C:\Users\Administrator\Documents\GitHub\INtranet'
SRC = os.path.join(ROOT, 'docs', 'Updates')
OUT_SQL = os.path.join(ROOT, 'Database', 'ApplyStockCountNov2026.sql')
ASAT = '2026-11-02'
# When False, DB items that do not appear on any count sheet are left untouched (needs confirmation to zero).
ZERO_MISSING = '--zero-missing' in sys.argv

# folder -> WarehouseId
WH = {'kzn': 1, 'GP': 2, 'CPT': 3, 'PE': 4}
WH_NAME = {1: 'KZN Distribution Centre', 2: 'Gauteng Main Warehouse', 3: 'Cape Town Hub', 4: 'Eastern Cape Depot'}

def company_from(name):
    n = name.upper()
    for k in ('ACCESS', 'PROMED', 'SEBENZANI'):
        if k in n: return k
    if 'PHARMA' in n or n == 'PPH': return 'PHARMACARE'
    return None

def norm_code(c):
    return re.sub(r'[^A-Z0-9]', '', str(c).upper()) if c is not None else ''

def norm_name(s):
    return re.sub(r'\s+', ' ', str(s or '').strip().upper())

def num(v):
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace(',', '').replace(' ', '')
    if s in ('', '-'): return None
    try: return float(s)
    except ValueError: return None

def parse_sheet(ws, source):
    """Return list of dict(code, desc, uom, qty, row) using CLOSING BALANCE or QUANTITY."""
    rows = list(ws.iter_rows(values_only=True))
    col = {}
    header_end = 0
    for i, row in enumerate(rows[:5]):
        for j, c in enumerate(row):
            if c is None: continue
            h = str(c).strip().upper()
            if h in ('CODE', 'ITEM CODE') and 'code' not in col: col['code'] = j
            elif h in ('DESCRIPTION', 'ITEM DESCRIPTION') and 'desc' not in col: col['desc'] = j
            elif h == 'UOM' and 'uom' not in col: col['uom'] = j
            elif h.startswith('CLOSING') or h == 'QUANTITY': col['qty'] = j
            elif h.startswith('OPENING'): col['open'] = j
            elif h.startswith('STOCK IN'): col['in'] = j
            elif h.startswith('STOCK') and 'OUT' in h: col['out'] = j
            elif h.startswith('DAMAGED'): col['dmg'] = j
            elif h == 'BRAND': col['brand'] = j
        if 'qty' in col and 'desc' in col:
            header_end = i + 1
            break
    if 'qty' not in col or 'desc' not in col:
        raise RuntimeError(f'{source}: could not find header columns, got {col}')
    out = []
    for r, row in enumerate(rows[header_end:], start=header_end + 1):
        desc = row[col['desc']] if col['desc'] < len(row) else None
        code = row[col['code']] if 'code' in col and col['code'] < len(row) else None
        if desc is None and code is None: continue
        desc = str(desc or '').strip()
        if not desc and code is None: continue
        if desc.upper() in ('TOTAL', 'TOTALS'): continue
        qty = num(row[col['qty']]) if col['qty'] < len(row) else None
        if qty is None:
            # derive from open+in-out if closing blank
            o, i_, u = (num(row[col[k]]) if k in col and col[k] < len(row) else None for k in ('open', 'in', 'out'))
            if o is not None or i_ is not None or u is not None:
                qty = (o or 0) + (i_ or 0) - (u or 0)
        uom = row[col['uom']] if 'uom' in col and col['uom'] < len(row) else None
        out.append({
            'code': (str(code).strip() if code is not None else None),
            'desc': desc, 'uom': (str(uom).strip() if uom is not None else None),
            'qty': qty, 'row': r,
            'brand': (row[col['brand']] if 'brand' in col and col['brand'] < len(row) else None),
            'flag': (row[col['dmg']] if 'dmg' in col and col['dmg'] < len(row) else None),
        })
    return out

def load_files():
    """Yield (warehouseId, company, source, lines, is_damaged_sheet)."""
    for folder, wh in WH.items():
        for f in sorted(glob.glob(os.path.join(SRC, folder, '*.xlsx'))):
            wb = openpyxl.load_workbook(f, data_only=True)
            fname = os.path.basename(f)
            for ws in wb.worksheets:
                dmg = 'DAMAGED' in ws.title.upper()
                comp = company_from(ws.title) if len(wb.worksheets) > 1 else company_from(fname)
                if comp is None and not dmg:
                    comp = company_from(fname)
                src = f'{folder}/{fname}::{ws.title}'
                yield wh, comp, src, parse_sheet(ws, src), dmg

def sql(q):
    pw = subprocess.check_output(['docker', 'exec', 'projecttracker-db', 'printenv', 'SA_PASSWORD'], text=True).strip()
    cmd = ['docker', 'exec', 'projecttracker-db', '/opt/mssql-tools18/bin/sqlcmd', '-C', '-S', 'localhost', '-U', 'sa', '-P', pw,
           '-d', 'ProjectTrackerDB', '-h', '-1', '-W', '-s', '\t', '-Q', 'SET NOCOUNT ON; ' + q]
    return subprocess.check_output(cmd, text=True, encoding='utf-8', errors='replace')

def load_db(pre_import=False):
    comm_filter = " WHERE Description IS NULL OR Description NOT IN ('Created from Nov 2026 stock count')" if pre_import else ''
    inv_table = '_bak_WarehouseInventory_20261102' if pre_import else 'WarehouseInventory'
    rows = sql(f"SELECT Id, ISNULL(Code,''), ISNULL(Name,''), ISNULL(Category,'') FROM Commodities{comm_filter}")
    comms = []
    for ln in rows.splitlines():
        p = ln.split('\t')
        if len(p) < 4 or not p[0].strip().isdigit(): continue
        comms.append({'id': int(p[0]), 'code': p[1].strip(), 'name': p[2].strip(), 'cat': p[3].strip()})
    inv = {}
    for ln in sql(f"SELECT WarehouseId, CommodityId, QuantityOnHand FROM {inv_table}").splitlines():
        p = ln.split('\t')
        if len(p) < 3 or not p[0].strip().isdigit(): continue
        inv[(int(p[0]), int(p[1]))] = float(p[2])
    return comms, inv

def build_index(comms):
    by_code = {}
    by_name = {}
    for c in comms:
        if c['code']:
            by_code.setdefault(norm_code(c['code']), []).append(c)
        if c['name']:
            by_name.setdefault(norm_name(c['name']), []).append(c)
    return by_code, by_name

def resolve(line, company, by_code, by_name):
    """Return (commodity or None, how).

    A code is only matched to a commodity of the SAME company. The same code is reused by different companies
    for different products (151 such codes in GP alone), so matching by code alone merges two products into one
    row. If the code exists only under another company, the line is treated as NEW (a commodity is created for
    this company under the same code)."""
    if line['code']:
        cands = by_code.get(norm_code(line['code']), [])
        if company:
            mine = [c for c in cands if c['cat'].upper() == company]
            if len(mine) >= 1: return mine[0], 'code'
            uncat = [c for c in cands if not c['cat']]
            if len(cands) == 1 and uncat: return cands[0], 'code*'   # uncategorised: adopt it
            return None, None
        if len(cands) == 1: return cands[0], 'code'
        return None, None
    cands = by_name.get(norm_name(line['desc']), [])
    if cands:
        pref = [c for c in cands if c['cat'].upper() == (company or '')]
        if company == 'PHARMACARE':
            # prefer the canonical M-/R- coded rows over JELLY-* duplicates
            pref2 = [c for c in pref if re.match(r'^[MR]-', c['code'])]
            if pref2: return pref2[0], 'name'
        if pref: return pref[0], 'name'
        if len(cands) == 1: return cands[0], 'name~'
    return None, None

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'report'
    comms, inv = load_db(pre_import=(mode == 'issues'))
    by_code, by_name = build_index(comms)
    plan = []       # per-warehouse resolved lines
    damaged = []
    issues = []
    for wh, comp, src, lines, dmg in load_files():
        if dmg:
            for l in lines:
                if l['qty'] is not None and l['qty'] != 0:
                    damaged.append((src, l))
            continue
        matched_code = matched_name = unmatched = blank = 0
        for l in lines:
            if l['qty'] is None:
                blank += 1
                if l['desc']: issues.append(f'{src} row {l["row"]}: no quantity for "{l["desc"]}" (code {l["code"]}) -> treated as 0')
                l['qty'] = 0
            c, how = resolve(l, comp, by_code, by_name)
            if c is None:
                unmatched += 1
            elif how.startswith('code'): matched_code += 1
            else: matched_name += 1
            plan.append({'wh': wh, 'company': comp, 'src': src, 'line': l, 'comm': c, 'how': how})
        print(f'{src:60s} wh={wh} company={comp or "?":10s} rows={len(lines):4d} byCode={matched_code:4d} byName={matched_name:3d} NEW={unmatched:3d} blankQty={blank}')

    # duplicates within the same warehouse (same commodity on two sheets or twice in one sheet)
    seen = {}
    for p in plan:
        key = (p['wh'], p['comm']['id'] if p['comm'] else ('new', norm_code(p['line']['code']) or norm_name(p['line']['desc'])))
        seen.setdefault(key, []).append(p)
    dups = {k: v for k, v in seen.items() if len(v) > 1}

    print('\n=== Summary per warehouse (sheet totals vs current DB) ===')
    for wh in sorted(WH.values()):
        ps = [p for p in plan if p['wh'] == wh]
        sheet_qty = sum(p['line']['qty'] for p in ps)
        matched_ids = {p['comm']['id'] for p in ps if p['comm']}
        db_items = [k for k in inv if k[0] == wh]
        db_qty = sum(inv[k] for k in db_items)
        not_in_sheet = [k for k in db_items if k[1] not in matched_ids and inv[k] != 0]
        new_items = [p for p in ps if p['comm'] is None]
        print(f'  {WH_NAME[wh]:26s} sheetLines={len(ps):4d} sheetQty={sheet_qty:14,.0f} | dbItems={len(db_items):4d} dbQty={db_qty:14,.0f} | '
              f'newCommodities={len(new_items):3d} dbItemsNotOnSheet(qty!=0)={len(not_in_sheet)}')

    print('\n=== DB items with stock on hand that are NOT on any count sheet (will be set to 0) ===')
    cid_info = {c['id']: c for c in comms}
    for wh in sorted(WH.values()):
        matched_ids = {p['comm']['id'] for p in plan if p['wh'] == wh and p['comm']}
        miss = sorted([(inv[k], k[1]) for k in inv if k[0] == wh and k[1] not in matched_ids and inv[k] != 0], reverse=True)
        print(f'  {WH_NAME[wh]}: {len(miss)} items, qty {sum(q for q, _ in miss):,.0f}')
        for q, cid in miss[:200]:
            c = cid_info.get(cid, {})
            print(f'     #{cid:<5} {c.get("code",""):18s} [{c.get("cat",""):10s}] {c.get("name","")[:45]:45s} qty={q:,.0f}')

    print(f'\n=== Duplicate lines within a warehouse: {len(dups)} ===')
    for k, v in list(dups.items())[:40]:
        print('  ', WH_NAME[k[0]], '|', ' + '.join(f'{p["src"].split("::")[0]} r{p["line"]["row"]} {p["line"]["code"]} "{p["line"]["desc"][:30]}" qty={p["line"]["qty"]}' for p in v))

    print(f'\n=== Unmatched (will be created as new Commodities): {sum(1 for p in plan if p["comm"] is None)} ===')
    for p in plan:
        if p['comm'] is None:
            l = p['line']
            print(f'  {WH_NAME[p["wh"]][:10]:10s} {p["company"] or "?":10s} code={str(l["code"]):16s} "{l["desc"][:45]}" uom={l["uom"]} qty={l["qty"]}')

    print(f'\n=== Matched by NAME only (code blank or unknown): {sum(1 for p in plan if p["how"] and p["how"].startswith("name"))} ===')
    for p in plan:
        if p['how'] and p['how'].startswith('name'):
            l = p['line']
            print(f'  {WH_NAME[p["wh"]][:10]:10s} {p["company"] or "?":10s} sheetCode={str(l["code"]):16s} "{l["desc"][:40]}" -> #{p["comm"]["id"]} {p["comm"]["code"]} [{p["comm"]["cat"]}] "{p["comm"]["name"][:40]}" ({p["how"]})')

    print(f'\n=== Damaged / expired sheet lines: {len(damaged)} ===')
    for src, l in damaged:
        print(f'  {src.split("::")[0]} r{l["row"]}: code={l["code"]} brand={l["brand"]} "{l["desc"][:40]}" qty={l["qty"]} flag={l["flag"]}')

    print(f'\n=== Data issues: {len(issues)} ===')
    for s in issues[:60]: print('  ', s)

    if mode == 'sql':
        write_sql(plan)
    if mode in ('sql', 'issues'):
        write_issues_sql(plan, dups, damaged, issues, inv, comms)

def write_issues_sql(plan, dups, damaged, data_issues, inv, comms):
    """Issues found in THIS batch -> StockIssues (Source='Import'). Also closes every earlier open issue."""
    out_path = os.path.join(ROOT, 'Database', 'StockIssuesNov2026Count.sql')
    rows = []  # (wh, company, code, desc, type, detail)
    def add(wh, comp, code, desc, typ, detail):
        rows.append((wh, comp, code, desc, typ, detail))

    # blank quantities / parse problems
    for s in data_issues:
        m = re.match(r'(.+?) row (\d+): no quantity for "(.*)" \(code (.*?)\)', s)
        src = s.split('::')[0]
        wh = WH[src.split('/')[0]]
        if m:
            code = None if m.group(4) == 'None' else m.group(4)
            add(wh, company_from(m.group(1)) or '', code, m.group(3), 'Closing balance not filled in',
                f'{src} row {m.group(2)}: no closing quantity - taken as 0. Please confirm the count.')
        else:
            add(wh, '', None, None, 'Sheet problem', s)

    # lines with no code
    for p in plan:
        l = p['line']
        if not l['code']:
            add(p['wh'], p['company'] or '', None, l['desc'], 'Missing item code',
                f'{p["src"].split("::")[0]} row {l["row"]}: "{l["desc"]}" has no code; '
                + (f'matched by name to stock item {p["comm"]["code"]}.' if p['comm'] else f'created as a new stock item with no code (qty {l["qty"]:g}).'))

    # sheet codes not in system (only ones with stock, zero-qty catalogue rows are noise)
    for p in plan:
        l = p['line']
        if p['comm'] is None and l['code'] and l['qty']:
            add(p['wh'], p['company'] or '', l['code'], l['desc'], 'New item on count sheet',
                f'{p["src"].split("::")[0]} row {l["row"]}: code not previously in the system; created with qty {l["qty"]:g}.')

    # duplicate codes within a warehouse with differing descriptions or both non-zero
    for k, v in dups.items():
        descs = {norm_name(p['line']['desc']) for p in v}
        nonzero = [p for p in v if p['line']['qty']]
        if len(descs) > 1 or len(nonzero) > 1:
            l0 = v[0]['line']
            total = sum(p['line']['qty'] for p in v)
            where = '; '.join(f'{p["src"].split("::")[0].split("/")[-1]} r{p["line"]["row"]} "{p["line"]["desc"][:40]}" = {p["line"]["qty"]:g}' for p in v)
            add(v[0]['wh'], v[0]['company'] or '', l0['code'], l0['desc'],
                'Duplicate code' if len(nonzero) > 1 else 'Duplicate description',
                f'Same code appears {len(v)}x - quantities summed to {total:g}. {where}')

    # negative closing balances
    for p in plan:
        if p['line']['qty'] < 0:
            add(p['wh'], p['company'] or '', p['line']['code'], p['line']['desc'], 'Negative balance',
                f'{p["src"].split("::")[0]} row {p["line"]["row"]}: closing balance {p["line"]["qty"]:g}.')

    # DB items with stock not on any sheet
    cid_info = {c['id']: c for c in comms}
    for wh in sorted(WH.values()):
        matched = {p['comm']['id'] for p in plan if p['wh'] == wh and p['comm']}
        for k, q in inv.items():
            if k[0] == wh and k[1] not in matched and q:
                c = cid_info.get(k[1], {})
                add(wh, c.get('cat', ''), c.get('code'), c.get('name'), 'Item not on count sheet',
                    f'System had {q:g} on hand but the item is on none of the {WH_NAME[wh]} count sheets. Left unchanged - confirm count or write off.')

    # damaged / expired sheet
    for src, l in damaged:
        add(1, str(l['brand'] or ''), l['code'], l['desc'], 'Damaged / expired stock',
            f'{l["flag"]}: {l["qty"]:g} {l["uom"] or ""} - moved to DAMAGED-EXPIRED company for write-off / repack decision.')

    sql = [f"""-- Stock issues found in the Nov 2026 count import. Closes all earlier open import issues first.
SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRAN;
UPDATE StockIssues SET Status = 'Dismissed', Resolution = 'Superseded by the 2 Nov 2026 full stock count - all balances replaced.',
       ResolvedBy = 'Stock count import', ResolvedAt = SYSUTCDATETIME()
WHERE Status IN ('Open','InProgress') AND CreatedAt < '{ASAT}';
"""]
    def v(x): return 'NULL' if x is None or x == '' else f"N'{esc(str(x))}'"
    batch = []
    for wh, comp, code, desc, typ, detail in rows:
        batch.append(f"({wh},{v(comp[:100] if comp else None)},{v(code and str(code)[:100])},{v(desc and str(desc)[:500])},{v(typ[:200])},{v(detail[:2000])},'{ASAT}','Open','Stock count import',SYSUTCDATETIME(),'Import')")
        if len(batch) == 300:
            sql.append("INSERT INTO StockIssues (WarehouseId,Company,ItemCode,ItemDescription,IssueType,Detail,IssueDate,Status,CreatedBy,CreatedAt,Source) VALUES\n" + ",\n".join(batch) + ";"); batch = []
    if batch:
        sql.append("INSERT INTO StockIssues (WarehouseId,Company,ItemCode,ItemDescription,IssueType,Detail,IssueDate,Status,CreatedBy,CreatedAt,Source) VALUES\n" + ",\n".join(batch) + ";")
    sql.append("COMMIT;\nSELECT Status, COUNT(*) n FROM StockIssues GROUP BY Status; SELECT IssueType, COUNT(*) n FROM StockIssues WHERE Status='Open' GROUP BY IssueType ORDER BY n DESC;")
    with open(out_path, 'w', encoding='utf-8') as f: f.write("\n".join(sql))
    print('wrote', out_path, f'({len(rows)} issues)')

def esc(s): return str(s).replace("'", "''")

def write_sql(plan):
    # aggregate per (wh, key)
    agg = {}
    for p in plan:
        l = p['line']
        key = (p['wh'], p['comm']['id']) if p['comm'] else (p['wh'], 'NEW', (norm_code(l['code']) or norm_name(l['desc'])) + '|' + (p['company'] or ''))
        a = agg.setdefault(key, {'wh': p['wh'], 'comm': p['comm'], 'code': l['code'], 'desc': l['desc'], 'uom': l['uom'],
                                 'company': p['company'], 'qty': 0.0, 'src': p['src'].split('::')[0]})
        a['qty'] += l['qty']
    out = [f"""-- Apply Nov 2026 regional stock counts (docs/Updates) as stock on hand, as at {ASAT}.
-- Every counted item gets LastCountDate={ASAT} so all loads dispatched before the count are treated as
-- already reflected (baseline) by the dispatch-approval rule. Items in DB but not on the sheet are {'set to 0' if ZERO_MISSING else 'LEFT UNCHANGED'}.
SET NOCOUNT ON; SET XACT_ABORT ON;
BEGIN TRAN;
CREATE TABLE #stg (WarehouseId INT, CommodityId INT NULL, Code NVARCHAR(100) NULL, Name NVARCHAR(200), Company NVARCHAR(50) NULL, Uom NVARCHAR(20) NULL, Qty DECIMAL(18,2), Src NVARCHAR(200));
"""]
    batch = []
    for a in agg.values():
        cid = a['comm']['id'] if a['comm'] else 'NULL'
        code = f"'{esc(a['code'][:100])}'" if a['code'] else 'NULL'
        comp = f"'{esc(a['company'])}'" if a['company'] else 'NULL'
        uom = f"'{esc(a['uom'][:20])}'" if a['uom'] else 'NULL'
        batch.append(f"({a['wh']},{cid},{code},'{esc(a['desc'][:200]) or esc(a['code'])}',{comp},{uom},{a['qty']:.2f},'{esc(a['src'][:200])}')")
        if len(batch) == 500:
            out.append("INSERT INTO #stg VALUES\n" + ",\n".join(batch) + ";"); batch = []
    if batch: out.append("INSERT INTO #stg VALUES\n" + ",\n".join(batch) + ";")
    out.append(f"""
-- 1. Create commodities for unmatched sheet lines (one per distinct code+company, or name when there is no code)
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT s.Name, s.Code, 'Created from Nov 2026 stock count', s.Company, ISNULL(s.Uom,'Each'), 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM (SELECT MIN(Name) Name, Code, Company, MAX(Uom) Uom FROM #stg WHERE CommodityId IS NULL GROUP BY Code, Company, CASE WHEN Code IS NULL THEN Name ELSE '' END) s;

UPDATE s SET CommodityId = c.Id FROM #stg s JOIN Commodities c ON c.Description = 'Created from Nov 2026 stock count'
  AND ISNULL(c.Category,'') = ISNULL(s.Company,'')
  AND ((s.Code IS NOT NULL AND c.Code = s.Code) OR (s.Code IS NULL AND c.Code IS NULL AND c.Name = s.Name))
WHERE s.CommodityId IS NULL;
IF EXISTS (SELECT 1 FROM #stg WHERE CommodityId IS NULL) BEGIN RAISERROR('unresolved staging rows', 16, 1); END

-- 2. Collapse to one row per warehouse/commodity
SELECT WarehouseId, CommodityId, SUM(Qty) Qty, MIN(Src) Src INTO #cnt FROM #stg GROUP BY WarehouseId, CommodityId;

-- 3. Ledger: one Adjustment per item whose quantity changes
;WITH target AS (
  SELECT i.WarehouseId, i.CommodityId, i.QuantityOnHand AS OldQty, ISNULL(c.Qty, 0) AS NewQty, ISNULL(c.Src, 'not on count sheet') Src
  FROM WarehouseInventory i {'LEFT' if ZERO_MISSING else 'INNER'} JOIN #cnt c ON c.WarehouseId = i.WarehouseId AND c.CommodityId = i.CommodityId
  WHERE i.WarehouseId IN (1,2,3,4)
  UNION ALL
  SELECT c.WarehouseId, c.CommodityId, 0, c.Qty, c.Src
  FROM #cnt c WHERE NOT EXISTS (SELECT 1 FROM WarehouseInventory i WHERE i.WarehouseId = c.WarehouseId AND i.CommodityId = c.CommodityId)
)
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt)
SELECT WarehouseId, CommodityId, 'Adjustment', NewQty - OldQty, NewQty,
       'Stock count {ASAT} (' + Src + ')', 'COUNT-{ASAT}', 'Approved', 'Stock count import', SYSUTCDATETIME()
FROM target WHERE NewQty <> OldQty;

-- 4. Apply quantities (+ stamp LastCountDate so earlier dispatches are treated as already reflected)
UPDATE i SET QuantityOnHand = ISNULL(c.Qty, 0), LastCountDate = '{ASAT}', UpdatedAt = SYSUTCDATETIME()
FROM WarehouseInventory i {'LEFT' if ZERO_MISSING else 'INNER'} JOIN #cnt c ON c.WarehouseId = i.WarehouseId AND c.CommodityId = i.CommodityId
WHERE i.WarehouseId IN (1,2,3,4);

INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt)
SELECT c.WarehouseId, c.CommodityId, c.Qty, '{ASAT}', SYSUTCDATETIME(), SYSUTCDATETIME()
FROM #cnt c WHERE NOT EXISTS (SELECT 1 FROM WarehouseInventory i WHERE i.WarehouseId = c.WarehouseId AND i.CommodityId = c.CommodityId);

DROP TABLE #cnt; DROP TABLE #stg;
COMMIT;

SELECT w.Name, COUNT(*) Items, SUM(CASE WHEN i.QuantityOnHand <> 0 THEN 1 ELSE 0 END) NonZero, SUM(i.QuantityOnHand) Qty
FROM WarehouseInventory i JOIN Warehouses w ON w.Id = i.WarehouseId GROUP BY w.Name ORDER BY w.Name;
SELECT COUNT(*) AdjustmentsLogged FROM WarehouseStockMovements WHERE Reference = 'COUNT-{ASAT}';
""")
    with open(OUT_SQL, 'w', encoding='utf-8') as f: f.write("\n".join(out))
    print('\nwrote', OUT_SQL, f'({len(agg)} warehouse/item rows)')

if __name__ == '__main__':
    main()
