"""
Fix 'Filed under another company' rows: the count sheet is authoritative for the company label.
  python tools/relabel_companies.py          -> plan only (prints)
  python tools/relabel_companies.py apply    -> writes Database/RelabelCompaniesNov2026.sql and runs it
Rule per (warehouse, code, sheetCompany, systemCompany):
  - if the system record (code, systemCompany) is not counted on any other sheet and holds no stock elsewhere
    -> re-tag Commodities.Category to the sheet company (history preserved)
  - else -> ensure a sibling commodity (code, sheetCompany) exists and move this warehouse's stock onto it
"""
import runpy, sys, os, collections, io, contextlib
ROOT = r'C:\Users\Administrator\Documents\GitHub\INtranet'
APPLY = 'apply' in sys.argv
sys.argv = [a for a in sys.argv if a != 'apply']
with contextlib.redirect_stdout(io.StringIO()):
    ns = runpy.run_path(os.path.join(ROOT, 'tools', 'count_accuracy.py'))
sql, nc, esc, db, sheet_seen, issues, WHN = ns['sql'], ns['nc'], ns['esc'], ns['db'], ns['sheet_seen'], ns['issues'], ns['WHN']

# commodity ids by (ncode, category)
cid = {}
for ln in sql("SELECT Id, ISNULL(Code,''), ISNULL(UPPER(Category),'') FROM Commodities").splitlines():
    p = ln.split('\t')
    if len(p) < 3 or not p[0].strip().isdigit(): continue
    cid.setdefault((nc(p[1]), p[2].strip()), int(p[0]))

label = [i for i in issues if i[4] == 'Filed under another company']
label_keys = {(i[0], nc(i[2])) for i in label}
retag, move = [], []
for wh, comp, code, desc, _, detail in label:
    k = nc(code)
    syscat = detail.split('labelled ')[1].split(' ')[0]
    old_id = cid.get((k, syscat))
    # genuinely counted under the system's label (an exact match, not another mislabel) at some warehouse?
    counted_elsewhere = any((k, syscat) in sheet_seen[w] and (w, k) not in label_keys for w in WHN)
    stock_elsewhere = any(q != 0 and (w, k) not in label_keys for (w, c, cat), q in db.items() if c == k and cat == syscat and w != wh)
    already_retagged = any(r[1] == old_id for r in retag)
    if not counted_elsewhere and not stock_elsewhere and (already_retagged or (k, comp) not in cid):
        retag.append((wh, old_id, code, syscat, comp, desc))
    else:
        move.append((wh, old_id, code, syscat, comp, desc, db[(wh, k, syscat)]))

print(f'label issues {len(label)}: re-tag {len(retag)} commodities, move {len(move)} warehouse rows to sibling')
for r in retag: print(f'  RETAG {WHN[r[0]]:3} {r[2]:18} {r[3]:10} -> {r[4]:10} {r[5][:40]}')
for m in move:  print(f'  MOVE  {WHN[m[0]]:3} {m[2]:18} {m[3]:10} -> {m[4]:10} qty {m[6]:g} {m[5][:40]}')

out = ["SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRAN;"]
for wh, old_id, code, syscat, comp, desc in {(r[1]): r for r in retag}.values():
    out.append(f"UPDATE Commodities SET Category=N'{comp}', UpdatedAt=SYSUTCDATETIME() WHERE Id={old_id};")
for wh, old_id, code, syscat, comp, desc, q in move:
    out.append(f"""
IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'{esc(code)}' AND UPPER(Category)=N'{comp}')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'{comp}', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id={old_id};
DECLARE @n{wh}_{old_id} INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'{esc(code)}' AND UPPER(Category)=N'{comp}');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId={wh} AND CommodityId=@n{wh}_{old_id})
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES ({wh}, @n{wh}_{old_id}, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 ({wh}, {old_id}, 'Adjustment', {-q}, 0, 'Stock count 2026-11-02: counted on the {comp} sheet - moved to {comp} record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 ({wh}, @n{wh}_{old_id}, 'Adjustment', {q}, {q}, 'Stock count 2026-11-02: counted on the {comp} sheet - moved from {syscat} record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId={wh} AND CommodityId={old_id};
UPDATE WarehouseInventory SET QuantityOnHand={q}, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId={wh} AND CommodityId=@n{wh}_{old_id};""")
out.append("COMMIT;")
path = os.path.join(ROOT, 'Database', 'RelabelCompaniesNov2026.sql')
with open(path, 'w', encoding='utf-8') as f: f.write('\n'.join(out))
print('wrote', path)
if APPLY:
    import subprocess
    subprocess.check_call(['docker', 'cp', path, 'projecttracker-db:/tmp/relabel.sql'])
    print(sql('/tmp/relabel.sql', file=True))
