import sys, glob, os
import openpyxl

root = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Administrator\Desktop\STOCK"
for f in sorted(glob.glob(os.path.join(root, "*", "*.xlsx"))):
    wb = openpyxl.load_workbook(f, data_only=True)
    print("####", os.path.relpath(f, root), "sheets:", wb.sheetnames)
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        print(f"  -- {ws.title}: rows={len(rows)} cols={ws.max_column}")
        for i, r in enumerate(rows[:3]):
            print("    r%d:" % (i + 1), [c for c in r])
        # count rows with a code and numeric closing
        hdr = [str(c or "").strip().upper() for c in rows[1]] if len(rows) > 1 else []
        print("    hdr:", hdr)
        n = sum(1 for r in rows[2:] if r and r[0] not in (None, ""))
        nclose = sum(1 for r in rows[2:] if r and len(r) > 6 and isinstance(r[6], (int, float)))
        print(f"    data rows={n} closing-numeric={nclose}")
        print("    last:", rows[-1] if rows else None)
