import openpyxl, glob, os
root = r'C:\Users\Administrator\Documents\GitHub\INtranet\docs\Updates'
for f in sorted(glob.glob(os.path.join(root, '*', '*.xlsx'))):
    wb = openpyxl.load_workbook(f, data_only=True)
    print('='*100)
    print(os.path.relpath(f, root))
    for ws in wb.worksheets:
        print(f'  --- sheet "{ws.title}" max_row={ws.max_row} max_col={ws.max_column}')
        for i, row in enumerate(ws.iter_rows(values_only=True)):
            if i >= 6: break
            print('   ', [str(c)[:28] if c is not None else None for c in row[:14]])
