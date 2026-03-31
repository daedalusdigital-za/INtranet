using ClosedXML.Excel;
var file = @"C:\Users\Administrator\Documents\GitHub\INtranet\docs\GP  Tripsheets\GP TRIP SHEET FOR  25.03.2026  SIMO.xlsx";
using var wb = new XLWorkbook(file);
var ws = wb.Worksheets.First();
Console.WriteLine($"Sheet: {ws.Name}");
for (int r = 1; r <= Math.Min(35, ws.LastRowUsed()?.RowNumber() ?? 0); r++) {
    var vals = new System.Collections.Generic.List<string>();
    for (int c = 1; c <= Math.Min(15, ws.LastColumnUsed()?.ColumnNumber() ?? 0); c++) {
        var v = ws.Cell(r,c).GetString().Trim();
        if (!string.IsNullOrEmpty(v)) vals.Add($"C{c}:{v}");
    }
    if (vals.Count > 0) Console.WriteLine($"R{r}: {string.Join(" | ", vals)}");
}
