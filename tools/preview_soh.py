import openpyxl, os

folder = r"c:\Users\Administrator\Documents\GitHub\INtranet\uploads"

# company -> (file, {sheet_name: province})
companies = {
    "Access Medical": ("ACCESS SOH.xlsx", {
        "KZN ACCESS": "KZN", "GP ACCESS": "GP", "PE ACCESS": "PE", "CPT ACCESS": "CPT"}),
    "KOG Trading Enterprise": ("KOG SOH.xlsx", {
        "KZN KOG": "KZN", "GP KOG": "GP", "PE KOG": "PE"}),
    "Promed Technologies": ("PROMED SOH.xlsx", {
        "PROMED KZN": "KZN", "GP PROMED": "GP", "PE PROMED": "PE", "CPT PROMED": "CPT"}),
    "Sebenzani Trading": ("SEB SOH.xlsx", {
        "SEB KZN": "KZN", "SEB GP": "GP", "SEB PE": "PE", "SEB CPT": "CPT"}),
}

def looks_like_header(row):
    return row and str(row[0]).strip().upper() == "CODE"

grand_items = 0
grand_skipped_zero = 0

for company, (fname, sheets) in companies.items():
    path = os.path.join(folder, fname)
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    print("=" * 70)
    print(f"{company}   ({fname})")
    for sheet, province in sheets.items():
        ws = wb[sheet]
        items = 0
        zeros = 0
        total_qty = 0.0
        blank_code = 0
        first = True
        for row in ws.iter_rows(values_only=True):
            if first:
                first = False
                if looks_like_header(row):
                    continue  # skip header
                # else: no header (KOG PE) -> treat row 1 as data, fall through
            if not row:
                continue
            code = row[0]
            if code is None or str(code).strip() == "":
                blank_code += 1
                continue
            qty_raw = row[3] if len(row) > 3 else None
            try:
                qty = float(str(qty_raw).replace(",", "").strip()) if qty_raw not in (None, "") else 0.0
            except ValueError:
                qty = 0.0
            if qty == 0:
                zeros += 1
                continue  # skipping zeros per decision #2
            items += 1
            total_qty += qty
        grand_items += items
        grand_skipped_zero += zeros
        print(f"   {province:4} <- '{sheet}': {items:6} items (nonzero), "
              f"{zeros:6} zero-qty skipped, {blank_code} blank-code, totalQty={total_qty:,.0f}")
    wb.close()

print("=" * 70)
print(f"GRAND TOTAL to import (nonzero): {grand_items:,} rows")
print(f"Zero-qty rows skipped:          {grand_skipped_zero:,}")
