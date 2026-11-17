import sys, glob, os, xlrd
folder = r"C:\Users\Administrator\Desktop\finance"
maxrows = int(sys.argv[1]) if len(sys.argv) > 1 else 40
for f in sorted(glob.glob(os.path.join(folder, "*.xls"))):
    wb = xlrd.open_workbook(f, formatting_info=False)
    print("=" * 100)
    print(os.path.basename(f), "sheets:", wb.sheet_names())
    for sh in wb.sheets():
        print(f"--- sheet '{sh.name}' rows={sh.nrows} cols={sh.ncols}")
        for r in range(min(sh.nrows, maxrows)):
            vals = []
            for c in range(sh.ncols):
                v = sh.cell_value(r, c)
                if v == "" or v is None: continue
                if isinstance(v, float) and v.is_integer(): v = int(v)
                vals.append(f"{xlrd.colname(c)}={v!r}")
            if vals: print(f"r{r+1}: " + " | ".join(vals))
        if sh.nrows > maxrows:
            print(f"... ({sh.nrows - maxrows} more rows) ... last rows:")
            for r in range(max(maxrows, sh.nrows - 6), sh.nrows):
                vals = [f"{xlrd.colname(c)}={sh.cell_value(r, c)!r}" for c in range(sh.ncols) if sh.cell_value(r, c) not in ("", None)]
                if vals: print(f"r{r+1}: " + " | ".join(vals))
