using ClosedXML.Excel;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.Logistics;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace ProjectTracker.API.Services;

/// <summary>
/// Service for parsing and importing Sage-style sales reports
/// Uses stateful parsing to handle the hierarchical customer->transaction structure
/// </summary>
public class SalesReportImportService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SalesReportImportService> _logger;

    // Default column indices based on the classic Sage report format.
    // These are the fallbacks; DetectColumns() may override them per-file.
    private const int DEFAULT_COL_YEAR = 0;
    private const int DEFAULT_COL_PERIOD = 1;
    private const int DEFAULT_COL_TYPE = 2;
    private const int DEFAULT_COL_DATE = 3;
    private const int DEFAULT_COL_TRANSACTION_NUMBER = 4;
    private const int DEFAULT_COL_SALESPERSON = 5;
    private const int DEFAULT_COL_CATEGORY = 6;
    private const int DEFAULT_COL_LOCATION = 7;
    private const int DEFAULT_COL_QUANTITY = 8;
    private const int DEFAULT_COL_SALES_AMOUNT = 9;
    private const int DEFAULT_COL_SALES_RETURNS = 10;
    private const int DEFAULT_COL_COST_OF_SALES = 11;
    private const int DEFAULT_COL_PERCENT = 12;

    // Active (possibly remapped) column indices used during parsing (0-based).
    private int COL_YEAR = DEFAULT_COL_YEAR;
    private int COL_PERIOD = DEFAULT_COL_PERIOD;
    private int COL_TYPE = DEFAULT_COL_TYPE;
    private int COL_DATE = DEFAULT_COL_DATE;
    private int COL_TRANSACTION_NUMBER = DEFAULT_COL_TRANSACTION_NUMBER;
    private int COL_SALESPERSON = DEFAULT_COL_SALESPERSON;
    private int COL_CATEGORY = DEFAULT_COL_CATEGORY;
    private int COL_LOCATION = DEFAULT_COL_LOCATION;
    private int COL_QUANTITY = DEFAULT_COL_QUANTITY;
    private int COL_SALES_AMOUNT = DEFAULT_COL_SALES_AMOUNT;
    private int COL_SALES_RETURNS = DEFAULT_COL_SALES_RETURNS;
    private int COL_COST_OF_SALES = DEFAULT_COL_COST_OF_SALES;
    private int COL_PERCENT = DEFAULT_COL_PERCENT;

    // Optional per-row customer columns (flat/non-hierarchical exports)
    private int? _colCustomerNumber = null;
    private int? _colCustomerName = null;
    private int? _colOrderNumber = null;

    // The 1-based worksheet row that holds the column headers (data starts after it)
    private int _headerRowNumber = 1;
    // True when the file is a "flat" export (customer on every row, no marker rows)
    private bool _flatFormat = false;
    
    // Extended columns - detected from header row
    private int? _colProductCode = null;
    private int? _colProductDescription = null;
    private int _lastUsedColumn = 12;

    public SalesReportImportService(ApplicationDbContext context, ILogger<SalesReportImportService> logger)
    {
        _context = context;
        _logger = logger;
    }

    // Ensures the code-page encodings required by ExcelDataReader (for legacy .xls) are registered once.
    private static bool _encodingRegistered = false;

    /// <summary>
    /// Opens an uploaded spreadsheet as a ClosedXML workbook regardless of format.
    /// Modern .xlsx (OOXML) files are opened directly. Legacy .xls files (Excel 97-2003,
    /// OLE2 / BIFF8 binary format) are NOT supported by ClosedXML, so they are read with
    /// ExcelDataReader and rebuilt into an in-memory .xlsx workbook, preserving cell value
    /// types (dates/numbers/strings) so the downstream parser behaves identically.
    /// </summary>
    private XLWorkbook OpenExcelWorkbook(Stream fileStream, string fileName)
    {
        // Buffer the stream so we can inspect the file signature and re-read it.
        var buffer = new MemoryStream();
        fileStream.CopyTo(buffer);
        buffer.Position = 0;

        // Detect the legacy OLE2 compound-document signature (real .xls files).
        bool isLegacyXls = false;
        if (buffer.Length >= 8)
        {
            var sig = new byte[8];
            buffer.Read(sig, 0, 8);
            buffer.Position = 0;
            isLegacyXls = sig[0] == 0xD0 && sig[1] == 0xCF && sig[2] == 0x11 && sig[3] == 0xE0
                       && sig[4] == 0xA1 && sig[5] == 0xB1 && sig[6] == 0x1A && sig[7] == 0xE1;
        }

        if (!isLegacyXls)
        {
            // Modern .xlsx (ZIP/OOXML) — ClosedXML reads it directly.
            return new XLWorkbook(buffer);
        }

        _logger.LogInformation("Detected legacy .xls (BIFF8) file '{FileName}'; converting to .xlsx for parsing.", fileName);

        if (!_encodingRegistered)
        {
            System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);
            _encodingRegistered = true;
        }

        var wb = new XLWorkbook();
        try
        {
            using var reader = ExcelDataReader.ExcelReaderFactory.CreateReader(buffer);
            var sheetIndex = 0;
            do
            {
                sheetIndex++;
                var sheetName = string.IsNullOrWhiteSpace(reader.Name) ? $"Sheet{sheetIndex}" : reader.Name;
                // ClosedXML sheet names must be <= 31 chars and unique.
                if (sheetName.Length > 31) sheetName = sheetName.Substring(0, 31);
                if (wb.Worksheets.Contains(sheetName)) sheetName = $"Sheet{sheetIndex}";
                var ws = wb.AddWorksheet(sheetName);

                var rowNum = 0;
                while (reader.Read())
                {
                    rowNum++;
                    for (var c = 0; c < reader.FieldCount; c++)
                    {
                        var val = reader.GetValue(c);
                        if (val == null) continue;
                        var cell = ws.Cell(rowNum, c + 1);
                        switch (val)
                        {
                            case DateTime dt: cell.SetValue(dt); break;
                            case double d: cell.SetValue(d); break;
                            case decimal m: cell.SetValue(m); break;
                            case int i: cell.SetValue(i); break;
                            case long l: cell.SetValue(l); break;
                            case bool b: cell.SetValue(b); break;
                            default: cell.SetValue(val.ToString() ?? string.Empty); break;
                        }
                    }
                }
            } while (reader.NextResult());
        }
        catch (Exception ex)
        {
            wb.Dispose();
            throw new InvalidOperationException(
                $"Failed to read legacy .xls file '{fileName}'. It may be corrupt or password-protected. ({ex.Message})", ex);
        }

        return wb;
    }

    /// <summary>
    /// Parse and store a sales report file
    /// </summary>
    public async Task<SalesImportUploadResponse> ParseAndStoreAsync(
        Stream fileStream, 
        string fileName, 
        string sourceCompany, 
        int uploadedBy, 
        bool strictMode = false)
    {
        var response = new SalesImportUploadResponse();
        var issues = new List<SalesImportIssue>();
        var transactions = new List<SalesTransactionStaging>();

        // Create the import batch record
        var batch = new SalesImportBatch
        {
            SourceFileName = fileName,
            SourceCompany = sourceCompany,
            UploadedBy = uploadedBy,
            ParsingStatus = "Parsing"
        };

        try
        {
            using var workbook = OpenExcelWorkbook(fileStream, fileName);
            var worksheet = workbook.Worksheets.First();
            
            // Validate worksheet has data
            var lastRowUsed = worksheet.LastRowUsed()?.RowNumber() ?? 0;
            if (lastRowUsed < 2)
            {
                throw new InvalidOperationException("File appears to be empty or has no data rows.");
            }

            // Parser state
            string? currentCustomerNumber = null;
            string? currentCustomerName = null;
            string? currentProductCode = null;
            string? currentProductDescription = null;
            var customerSet = new HashSet<string>();
            DateTime? minDate = null;
            DateTime? maxDate = null;
            decimal salesTotal = 0;
            decimal costTotal = 0;

            // Process each row (start from row 2, assuming row 1 is header)
            // But first, scan the header row for product-related columns
            _colProductCode = null;
            _colProductDescription = null;
            _lastUsedColumn = 12;

            // Detect the header row and map columns by name (flexible layout support).
            var detection = DetectColumns(worksheet, lastRowUsed);
            _logger.LogInformation("Column detection for {FileName}: {Summary}", fileName, detection.Summary);

            for (int rowIndex = _headerRowNumber + 1; rowIndex <= lastRowUsed; rowIndex++)
            {
                var row = worksheet.Row(rowIndex);
                
                try
                {
                    var result = ProcessRow(
                        row, 
                        rowIndex, 
                        ref currentCustomerNumber, 
                        ref currentCustomerName,
                        ref currentProductCode,
                        ref currentProductDescription,
                        strictMode,
                        issues,
                        batch.ImportBatchId);

                    if (result != null)
                    {
                        transactions.Add(result);
                        
                        if (!string.IsNullOrEmpty(result.CustomerNumber))
                        {
                            customerSet.Add(result.CustomerNumber);
                        }

                        if (result.TransactionDate.HasValue)
                        {
                            if (!minDate.HasValue || result.TransactionDate < minDate)
                                minDate = result.TransactionDate;
                            if (!maxDate.HasValue || result.TransactionDate > maxDate)
                                maxDate = result.TransactionDate;
                        }

                        salesTotal += result.SalesAmount ?? 0;
                        costTotal += result.CostOfSales ?? 0;
                    }
                }
                catch (Exception ex)
                {
                    issues.Add(new SalesImportIssue
                    {
                        ImportBatchId = batch.ImportBatchId,
                        RowIndex = rowIndex,
                        Severity = "error",
                        Code = "ROW_PARSE_ERROR",
                        Message = $"Failed to parse row: {ex.Message}"
                    });

                    if (strictMode)
                    {
                        throw new InvalidOperationException($"Strict mode: Failed to parse row {rowIndex}: {ex.Message}");
                    }
                }
            }

            // Validate we have meaningful data
            if (transactions.Count == 0)
            {
                throw new InvalidOperationException(
                    "No valid transactions found in the file. " +
                    "A valid row needs a recognisable Date and an Invoice/Transaction number. " +
                    detection.Summary +
                    " If the columns above look wrong, the file layout may differ from what's expected " +
                    "(check for extra title rows at the top, or renamed/re-ordered columns).");
            }

            if (customerSet.Count == 0 && !_flatFormat)
            {
                throw new InvalidOperationException(
                    "No customer information found. For grouped Sage reports the file must contain 'Customer Number:' rows; " +
                    "for flat reports include a Customer / Account column. " + detection.Summary);
            }

            // Check for duplicates in existing ImportedInvoices
            var duplicates = new List<DuplicateInfo>();
            var duplicateCount = 0;
            decimal duplicateSalesTotal = 0;

            // Get unique transaction identifiers from the uploaded data
            var transactionKeys = transactions
                .Where(t => !string.IsNullOrEmpty(t.TransactionNumber) && t.TransactionDate.HasValue)
                .Select(t => new { t.TransactionNumber, t.CustomerNumber, t.TransactionDate, t.RowIndex, t.SalesAmount })
                .ToList();

            if (transactionKeys.Any())
            {
                // Query existing invoices for potential duplicates
                var transactionNumbers = transactionKeys.Select(t => t.TransactionNumber).Distinct().ToList();
                var existingInvoices = await _context.ImportedInvoices
                    .Where(i => transactionNumbers.Contains(i.TransactionNumber) && i.SourceCompany == sourceCompany)
                    .Select(i => new { i.TransactionNumber, i.CustomerNumber, i.TransactionDate, i.SalesAmount, i.ImportBatchId, i.ImportedAt })
                    .ToListAsync();

                if (existingInvoices.Any())
                {
                    foreach (var tx in transactionKeys)
                    {
                        var existing = existingInvoices.FirstOrDefault(e => 
                            e.TransactionNumber == tx.TransactionNumber && 
                            e.CustomerNumber == tx.CustomerNumber &&
                            e.TransactionDate.Date == tx.TransactionDate!.Value.Date);

                        if (existing != null)
                        {
                            duplicateCount++;
                            duplicateSalesTotal += tx.SalesAmount ?? 0;

                            // Add issue for this duplicate
                            issues.Add(new SalesImportIssue
                            {
                                ImportBatchId = batch.ImportBatchId,
                                RowIndex = tx.RowIndex,
                                Severity = "warning",
                                Code = "DUPLICATE_TRANSACTION",
                                Message = $"Transaction {tx.TransactionNumber} for customer {tx.CustomerNumber} already exists in database (imported previously)."
                            });

                            // Track detailed duplicate info (limit to first 50)
                            if (duplicates.Count < 50)
                            {
                                duplicates.Add(new DuplicateInfo
                                {
                                    RowIndex = tx.RowIndex,
                                    TransactionNumber = tx.TransactionNumber ?? string.Empty,
                                    CustomerNumber = tx.CustomerNumber ?? string.Empty,
                                    TransactionDate = tx.TransactionDate?.ToString("yyyy-MM-dd") ?? string.Empty,
                                    SalesAmount = tx.SalesAmount ?? 0,
                                    ExistingSalesAmount = existing.SalesAmount,
                                    ExistingImportBatchId = existing.ImportBatchId ?? string.Empty,
                                    ExistingImportedAt = existing.ImportedAt
                                });
                            }
                        }
                    }

                    if (duplicateCount > 0)
                    {
                        _logger.LogWarning(
                            "Found {DuplicateCount} duplicate transactions in import {FileName} for company {Company}",
                            duplicateCount, fileName, sourceCompany);
                    }
                }
            }

            // Update batch with summary
            batch.ParsingStatus = "Parsed";
            batch.TotalCustomers = customerSet.Count;
            batch.TotalTransactions = transactions.Count;
            batch.DateMin = minDate;
            batch.DateMax = maxDate;
            batch.SalesTotal = salesTotal;
            batch.CostTotal = costTotal;

            // Calculate top customers
            var topCustomers = transactions
                .GroupBy(t => new { t.CustomerNumber, t.CustomerName })
                .Select(g => new CustomerSummary
                {
                    CustomerNumber = g.Key.CustomerNumber,
                    CustomerName = g.Key.CustomerName,
                    TransactionCount = g.Count(),
                    SalesAmount = g.Sum(t => t.SalesAmount ?? 0)
                })
                .OrderByDescending(c => c.SalesAmount)
                .Take(10)
                .ToList();

            var summary = new SalesImportSummary
            {
                Customers = customerSet.Count,
                Transactions = transactions.Count,
                DateMin = minDate?.ToString("yyyy-MM-dd"),
                DateMax = maxDate?.ToString("yyyy-MM-dd"),
                SalesTotal = salesTotal,
                SalesReturnsTotal = transactions.Sum(t => t.SalesReturns ?? 0),
                CostTotal = costTotal,
                GrossProfit = salesTotal - costTotal,
                TopCustomers = topCustomers,
                DuplicateCount = duplicateCount,
                DuplicateSalesTotal = duplicateSalesTotal,
                Duplicates = duplicates
            };

            batch.SummaryJson = JsonSerializer.Serialize(summary);

            // Save to database
            await _context.SalesImportBatches.AddAsync(batch);
            await _context.SalesTransactionStagings.AddRangeAsync(transactions);
            if (issues.Any())
            {
                await _context.SalesImportIssues.AddRangeAsync(issues);
            }
            await _context.SaveChangesAsync();

            // Build response
            response.ImportId = batch.ImportBatchId;
            response.Success = true;
            response.Status = "Parsed";
            response.Message = $"Successfully parsed {transactions.Count} transactions from {customerSet.Count} customers.";
            response.Summary = summary;
            response.Issues = issues.Select(i => new SalesImportIssueDto
            {
                Severity = i.Severity,
                RowIndex = i.RowIndex,
                Code = i.Code,
                Message = i.Message
            }).ToList();

            _logger.LogInformation(
                "Sales report import parsed: {FileName}, {Transactions} transactions, {Customers} customers, {Issues} issues",
                fileName, transactions.Count, customerSet.Count, issues.Count);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse sales report: {FileName}", fileName);

            batch.ParsingStatus = "Failed";
            batch.SummaryJson = JsonSerializer.Serialize(new { error = ex.Message });
            
            await _context.SalesImportBatches.AddAsync(batch);
            await _context.SaveChangesAsync();

            response.ImportId = batch.ImportBatchId;
            response.Success = false;
            response.Status = "Failed";
            response.Message = $"Import failed: {ex.Message}";
            return response;
        }
    }

    /// <summary>
    /// Result of scanning a worksheet to locate the header row and map columns by name.
    /// </summary>
    private class ColumnDetectionResult
    {
        public string Summary { get; set; } = string.Empty;
    }

    private static readonly string[] DateAliases = { "date", "trans date", "transaction date", "inv date", "invoice date", "doc date", "document date" };
    private static readonly string[] TxnAliases = { "invoice no", "invoice number", "inv no", "invno", "transaction number", "trans no", "transaction no", "document no", "doc no", "reference", "ref no" };
    private static readonly string[] YearAliases = { "year", "yr" };
    private static readonly string[] PeriodAliases = { "period", "prd", "prd." };
    private static readonly string[] TypeAliases = { "type", "trans type", "transaction type", "doc type" };
    private static readonly string[] SalespersonAliases = { "salesperson", "sales person", "rep", "sales rep", "agent" };
    private static readonly string[] CategoryAliases = { "category", "cat", "item cat", "category code" };
    private static readonly string[] LocationAliases = { "location", "loc", "warehouse", "store" };
    private static readonly string[] QtyAliases = { "qty", "quantity", "qty sold", "units", "qty invoiced" };
    private static readonly string[] SalesAliases = { "sales amnt", "sales amount", "sales", "amount", "net sales", "value", "line total", "ext price", "extended price", "total" };
    private static readonly string[] ReturnsAliases = { "sales returns", "returns", "credit", "credits" };
    private static readonly string[] CostAliases = { "cost of sales", "cost", "ext cost", "extended cost", "cost amount", "cost amnt" };
    private static readonly string[] PercentAliases = { "percent", "%", "margin", "gp %", "gp%", "margin %" };
    private static readonly string[] ProductCodeAliases = { "product code", "productcode", "stock code", "stockcode", "item code", "itemcode", "item", "sku", "product" };
    private static readonly string[] ProductDescAliases = { "product desc", "productdesc", "item desc", "itemdesc", "stock desc", "stockdesc", "description", "desc", "product name", "item name", "stock item" };
    private static readonly string[] CustNumberAliases = { "cust no", "customer no", "customer number", "custno", "account no", "account number", "acc no", "debtor", "debtor code" };
    private static readonly string[] CustNameAliases = { "customer name", "cust name", "customer", "account name", "debtor name", "name" };
    private static readonly string[] OrderNoAliases = { "order no", "order number", "ord no", "orderno", "customer order", "po no", "po number" };

    private static bool MatchesAlias(string headerText, string[] aliases)
    {
        // Prefer exact match, then a whole-token contains to avoid false positives.
        foreach (var a in aliases)
        {
            if (headerText == a) return true;
        }
        foreach (var a in aliases)
        {
            if (headerText.Contains(a)) return true;
        }
        return false;
    }

    /// <summary>
    /// Scans the first several rows to find the header row and map each known field to a
    /// column index. Falls back to the classic fixed Sage layout if no header is recognised.
    /// Sets the instance COL_* fields, _headerRowNumber, _flatFormat and product/customer columns.
    /// </summary>
    private ColumnDetectionResult DetectColumns(IXLWorksheet worksheet, int lastRowUsed)
    {
        int bestRow = -1;
        int bestScore = 0;
        var bestMap = new Dictionary<string, int>();

        int scanLimit = Math.Min(15, lastRowUsed);
        for (int r = 1; r <= scanLimit; r++)
        {
            var row = worksheet.Row(r);
            int lastCol = row.LastCellUsed()?.Address?.ColumnNumber ?? 0;
            if (lastCol == 0) continue;

            var map = new Dictionary<string, int>();
            for (int c = 1; c <= lastCol; c++)
            {
                var h = row.Cell(c).GetString()?.Trim().ToLowerInvariant() ?? "";
                if (string.IsNullOrEmpty(h)) continue;
                int idx = c - 1; // 0-based

                void TryMap(string key, string[] aliases)
                {
                    if (!map.ContainsKey(key) && MatchesAlias(h, aliases)) map[key] = idx;
                }

                // Order matters: map the more specific fields before generic ones.
                TryMap("date", DateAliases);
                TryMap("txn", TxnAliases);
                TryMap("custno", CustNumberAliases);
                TryMap("custname", CustNameAliases);
                TryMap("orderno", OrderNoAliases);
                TryMap("productcode", ProductCodeAliases);
                TryMap("productdesc", ProductDescAliases);
                TryMap("year", YearAliases);
                TryMap("period", PeriodAliases);
                TryMap("type", TypeAliases);
                TryMap("salesperson", SalespersonAliases);
                TryMap("category", CategoryAliases);
                TryMap("location", LocationAliases);
                TryMap("qty", QtyAliases);
                TryMap("returns", ReturnsAliases);
                TryMap("cost", CostAliases);
                TryMap("percent", PercentAliases);
                TryMap("sales", SalesAliases);
            }

            // Score a candidate header row: the essential fields carry the most weight.
            int score = 0;
            if (map.ContainsKey("date")) score += 3;
            if (map.ContainsKey("txn")) score += 3;
            if (map.ContainsKey("sales")) score += 2;
            if (map.ContainsKey("custname") || map.ContainsKey("custno")) score += 2;
            if (map.ContainsKey("qty")) score += 1;
            if (map.ContainsKey("productdesc")) score += 1;

            if (score > bestScore)
            {
                bestScore = score;
                bestRow = r;
                bestMap = map;
            }
        }

        // Require the two essentials (date + transaction) to trust detection.
        if (bestRow > 0 && bestMap.ContainsKey("date") && bestMap.ContainsKey("txn"))
        {
            _headerRowNumber = bestRow;
            COL_DATE = bestMap["date"];
            COL_TRANSACTION_NUMBER = bestMap["txn"];
            if (bestMap.TryGetValue("year", out var vy)) COL_YEAR = vy;
            if (bestMap.TryGetValue("period", out var vp)) COL_PERIOD = vp;
            if (bestMap.TryGetValue("type", out var vt)) COL_TYPE = vt;
            if (bestMap.TryGetValue("salesperson", out var vs)) COL_SALESPERSON = vs;
            if (bestMap.TryGetValue("category", out var vc)) COL_CATEGORY = vc;
            if (bestMap.TryGetValue("location", out var vl)) COL_LOCATION = vl;
            if (bestMap.TryGetValue("qty", out var vq)) COL_QUANTITY = vq;
            if (bestMap.TryGetValue("sales", out var vsa)) COL_SALES_AMOUNT = vsa;
            if (bestMap.TryGetValue("returns", out var vr)) COL_SALES_RETURNS = vr;
            if (bestMap.TryGetValue("cost", out var vco)) COL_COST_OF_SALES = vco;
            if (bestMap.TryGetValue("percent", out var vpc)) COL_PERCENT = vpc;

            // CRITICAL: once we trust the detected header, any optional numeric column that was
            // NOT actually found must be marked absent (-1) rather than left on its fixed default
            // index. Otherwise a leftover default (e.g. Returns=10) can collide with a real
            // detected column (e.g. Sales detected at 10) and read the SAME cell — which made
            // SalesAmount == SalesReturns, netting sales to R0.00.
            if (!bestMap.ContainsKey("qty")) COL_QUANTITY = -1;
            if (!bestMap.ContainsKey("returns")) COL_SALES_RETURNS = -1;
            if (!bestMap.ContainsKey("cost")) COL_COST_OF_SALES = -1;
            if (!bestMap.ContainsKey("percent")) COL_PERCENT = -1;
            if (bestMap.TryGetValue("productcode", out var vpcode)) _colProductCode = vpcode;
            if (bestMap.TryGetValue("productdesc", out var vpdesc)) _colProductDescription = vpdesc;
            if (bestMap.TryGetValue("custno", out var vcn)) _colCustomerNumber = vcn;
            if (bestMap.TryGetValue("custname", out var vcnm)) _colCustomerName = vcnm;
            if (bestMap.TryGetValue("orderno", out var von)) _colOrderNumber = von;

            // Flat format = a customer column exists on each row (no "Customer Number:" markers needed).
            _flatFormat = _colCustomerNumber.HasValue || _colCustomerName.HasValue;

            var found = new List<string>();
            void Note(string label, int idx) => found.Add($"{label}=col{idx + 1}");
            Note("Date", COL_DATE);
            Note("Invoice", COL_TRANSACTION_NUMBER);
            if (bestMap.ContainsKey("sales")) Note("Sales", COL_SALES_AMOUNT);
            if (_colCustomerName.HasValue) Note("Customer", _colCustomerName.Value);
            else if (_colCustomerNumber.HasValue) Note("CustNo", _colCustomerNumber.Value);
            if (_colProductDescription.HasValue) Note("Description", _colProductDescription.Value);
            if (bestMap.ContainsKey("qty")) Note("Qty", COL_QUANTITY);

            return new ColumnDetectionResult
            {
                Summary = $"Detected header on row {bestRow} ({(_flatFormat ? "flat" : "grouped")} format): {string.Join(", ", found)}."
            };
        }

        // No recognisable header — fall back to the classic fixed Sage layout.
        _headerRowNumber = 1;
        _flatFormat = false;
        var headerRow = worksheet.Row(1);
        var lastColUsed = headerRow.LastCellUsed()?.Address?.ColumnNumber ?? 13;
        for (int col = 1; col <= lastColUsed; col++)
        {
            var headerText = headerRow.Cell(col).GetString()?.Trim().ToLower() ?? "";
            if (MatchesAlias(headerText, ProductCodeAliases)) _colProductCode = col - 1;
            else if (MatchesAlias(headerText, ProductDescAliases)) _colProductDescription = col - 1;
        }
        if (lastColUsed > 13) _lastUsedColumn = lastColUsed - 1;

        return new ColumnDetectionResult
        {
            Summary = "No named header recognised — assuming the classic Sage layout " +
                      "(col4=Date, col5=Invoice No). Expected columns: Year, Period, Type, Date, Invoice No, Salesperson, Category, Location, Qty, Sales, Returns, Cost, %."
        };
    }

    /// <summary>
    /// Process a single row using stateful parsing
    /// </summary>
    private SalesTransactionStaging? ProcessRow(
        IXLRow row,
        int rowIndex,
        ref string? currentCustomerNumber,
        ref string? currentCustomerName,
        ref string? currentProductCode,
        ref string? currentProductDescription,
        bool strictMode,
        List<SalesImportIssue> issues,
        Guid batchId)
    {
        // Read the Year cell (first column) to determine row type
        var yearCell = row.Cell(COL_YEAR + 1).GetString()?.Trim() ?? "";

        // ── Flat format: customer is on every row; no marker/product-header rows ──
        if (_flatFormat)
        {
            if (_colCustomerName.HasValue)
            {
                var nm = row.Cell(_colCustomerName.Value + 1).GetString()?.Trim();
                if (!string.IsNullOrEmpty(nm)) currentCustomerName = nm;
            }
            if (_colCustomerNumber.HasValue)
            {
                var no = row.Cell(_colCustomerNumber.Value + 1).GetString()?.Trim();
                if (!string.IsNullOrEmpty(no)) currentCustomerNumber = no;
            }
            // If only a name column exists, use the name as the customer key too.
            if (string.IsNullOrEmpty(currentCustomerNumber) && !string.IsNullOrEmpty(currentCustomerName))
            {
                currentCustomerNumber = currentCustomerName;
            }
        }
        else
        {
            // Check for Customer Header Row
            if (yearCell.Equals("Customer Number:", StringComparison.OrdinalIgnoreCase))
            {
                // Extract customer number from Period column and name from Date column
                currentCustomerNumber = row.Cell(COL_PERIOD + 1).GetString()?.Trim();
                currentCustomerName = row.Cell(COL_DATE + 1).GetString()?.Trim();
                currentProductCode = null;  // Reset product context on new customer
                currentProductDescription = null;

                _logger.LogDebug("Found customer header: {Number} - {Name}", currentCustomerNumber, currentCustomerName);
                return null; // Header row, not a transaction
            }

            // Check for Customer Total Row
            if (yearCell.Equals("Customer Total:", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogDebug("Found customer total for: {Number}", currentCustomerNumber);
                currentCustomerNumber = null;
                currentCustomerName = null;
                currentProductCode = null;
                currentProductDescription = null;
                return null; // Total row, not a transaction
            }

            // Check for Total Sales Row
            if (yearCell.StartsWith("Total Sales", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            // Check for Product Header Row: a row where Col1 has an alphanumeric product code
            // (not a year number), and there's no valid date or transaction number.
            // Sage format: Col1 = product code (e.g. RT4208001), Col2 = product description
            if (!string.IsNullOrEmpty(yearCell) && !int.TryParse(yearCell, out _))
            {
                // Not a year number - could be a product header
                var periodCell = row.Cell(COL_PERIOD + 1).GetString()?.Trim() ?? "";
                var dateCellStr2 = row.Cell(COL_DATE + 1).GetString()?.Trim() ?? "";
                var txnNumStr = row.Cell(COL_TRANSACTION_NUMBER + 1).GetString()?.Trim() ?? "";

                // Product header: has text in first column, possibly description in second,
                // and no date or transaction number in their expected columns
                bool hasDateHdr = false;
                if (row.Cell(COL_DATE + 1).DataType == XLDataType.DateTime) hasDateHdr = true;
                else if (DateTime.TryParse(dateCellStr2, out _)) hasDateHdr = true;

                if (!hasDateHdr && string.IsNullOrEmpty(txnNumStr))
                {
                    // This is a product header row
                    currentProductCode = yearCell;
                    currentProductDescription = periodCell;

                    // If description is empty, check if it spans across other cells
                    if (string.IsNullOrEmpty(currentProductDescription))
                    {
                        var descParts = new List<string>();
                        for (int c = COL_PERIOD + 1; c <= COL_PERCENT + 1; c++)
                        {
                            var cellVal = row.Cell(c).GetString()?.Trim();
                            if (!string.IsNullOrEmpty(cellVal))
                                descParts.Add(cellVal);
                        }
                        currentProductDescription = string.Join(" ", descParts);
                    }

                    _logger.LogDebug("Found product header: {Code} - {Description}", currentProductCode, currentProductDescription);
                    return null; // Product header row, not a transaction
                }
            }
        }

        // Try to parse as a transaction row
        // A valid transaction should have a parseable date and transaction number
        var dateCell = row.Cell(COL_DATE + 1);
        var transactionNumberCell = row.Cell(COL_TRANSACTION_NUMBER + 1);
        
        DateTime? transactionDate = null;
        string? transactionNumber = transactionNumberCell.GetString()?.Trim();

        // Try to parse the date
        if (dateCell.DataType == XLDataType.DateTime)
        {
            transactionDate = dateCell.GetDateTime();
        }
        else
        {
            var dateStr = dateCell.GetString()?.Trim();
            if (DateTime.TryParse(dateStr, out var parsedDate))
            {
                transactionDate = parsedDate;
            }
        }

        // If we don't have a date and transaction number, skip this row
        if (!transactionDate.HasValue || string.IsNullOrEmpty(transactionNumber))
        {
            return null; // Not a valid transaction row
        }

        // Check if we have a customer context
        if (string.IsNullOrEmpty(currentCustomerNumber))
        {
            issues.Add(new SalesImportIssue
            {
                ImportBatchId = batchId,
                RowIndex = rowIndex,
                Severity = strictMode ? "error" : "warning",
                Code = "NO_CUSTOMER_CONTEXT",
                Message = "Transaction found without a customer header. Customer set to 'UNKNOWN'.",
                RawRowJson = SerializeRowToJson(row)
            });

            if (strictMode)
            {
                throw new InvalidOperationException($"Row {rowIndex}: Transaction without customer context.");
            }

            currentCustomerNumber = "UNKNOWN";
            currentCustomerName = "Unknown Customer";
        }

        // Build the transaction record
        var transaction = new SalesTransactionStaging
        {
            ImportBatchId = batchId,
            RowIndex = rowIndex,
            CustomerNumber = currentCustomerNumber,
            CustomerName = currentCustomerName ?? "",
            TransactionDate = transactionDate,
            TransactionNumber = transactionNumber
        };

        // Parse Year
        if (int.TryParse(yearCell, out var year))
        {
            transaction.Year = year;
        }

        // Parse Period
        transaction.Period = row.Cell(COL_PERIOD + 1).GetString()?.Trim();

        // Parse Type
        transaction.Type = row.Cell(COL_TYPE + 1).GetString()?.Trim();

        // Parse numeric fields with validation
        transaction.Salesperson = ParseNullableInt(row.Cell(COL_SALESPERSON + 1), rowIndex, "Salesperson", issues, batchId);
        transaction.Category = ParseNullableInt(row.Cell(COL_CATEGORY + 1), rowIndex, "Category", issues, batchId);
        transaction.Location = ParseNullableInt(row.Cell(COL_LOCATION + 1), rowIndex, "Location", issues, batchId);
        transaction.Quantity = COL_QUANTITY >= 0 ? ParseNullableDecimal(row.Cell(COL_QUANTITY + 1), rowIndex, "Quantity", issues, batchId) : null;
        transaction.SalesAmount = COL_SALES_AMOUNT >= 0 ? ParseNullableDecimal(row.Cell(COL_SALES_AMOUNT + 1), rowIndex, "SalesAmount", issues, batchId) : null;
        transaction.SalesReturns = COL_SALES_RETURNS >= 0 ? ParseNullableDecimal(row.Cell(COL_SALES_RETURNS + 1), rowIndex, "SalesReturns", issues, batchId) : null;
        transaction.CostOfSales = COL_COST_OF_SALES >= 0 ? ParseNullableDecimal(row.Cell(COL_COST_OF_SALES + 1), rowIndex, "CostOfSales", issues, batchId) : null;
        transaction.Percent = COL_PERCENT >= 0 ? ParseNullableDecimal(row.Cell(COL_PERCENT + 1), rowIndex, "Percent", issues, batchId) : null;

        // Mark if this transaction has any issues
        transaction.HasIssues = issues.Any(i => i.RowIndex == rowIndex);

        // Apply product context from product header rows (Sage hierarchical format)
        if (!string.IsNullOrEmpty(currentProductCode))
        {
            transaction.ProductCode = currentProductCode;
        }
        if (!string.IsNullOrEmpty(currentProductDescription))
        {
            transaction.ProductDescription = currentProductDescription;
        }

        // Try to get product information from detected header columns (overrides if present)
        if (_colProductCode.HasValue)
        {
            transaction.ProductCode = row.Cell(_colProductCode.Value + 1).GetString()?.Trim();
        }
        if (_colProductDescription.HasValue)
        {
            transaction.ProductDescription = row.Cell(_colProductDescription.Value + 1).GetString()?.Trim();
        }

        // If no product columns were detected in header, check for extra text columns beyond the standard 13
        if (!_colProductCode.HasValue && !_colProductDescription.HasValue)
        {
            // Check columns after COL_PERCENT (13+) for any text that could be product info
            for (int extraCol = COL_PERCENT + 2; extraCol <= _lastUsedColumn + 1; extraCol++)
            {
                var extraVal = row.Cell(extraCol).GetString()?.Trim();
                if (!string.IsNullOrEmpty(extraVal) && extraVal.Length > 2)
                {
                    // First extra text column = product code, second = product description
                    if (string.IsNullOrEmpty(transaction.ProductCode))
                    {
                        // If it looks like a description (long text), put in description instead
                        if (extraVal.Length > 20)
                            transaction.ProductDescription = extraVal;
                        else
                            transaction.ProductCode = extraVal;
                    }
                    else if (string.IsNullOrEmpty(transaction.ProductDescription))
                    {
                        transaction.ProductDescription = extraVal;
                    }
                }
            }
        }

        // Defensively clamp string fields to their DB column limits so an unexpected
        // column layout (e.g. a long value landing in a short column) can't crash the save.
        transaction.CustomerNumber = Clamp(transaction.CustomerNumber, 50) ?? string.Empty;
        transaction.CustomerName = Clamp(transaction.CustomerName, 255) ?? string.Empty;
        transaction.Period = Clamp(transaction.Period, 10);
        transaction.Type = Clamp(transaction.Type, 20);
        transaction.TransactionNumber = Clamp(transaction.TransactionNumber, 50) ?? string.Empty;
        transaction.ProductCode = Clamp(transaction.ProductCode, 100);
        transaction.ProductDescription = Clamp(transaction.ProductDescription, 500);

        return transaction;
    }

    /// <summary>Trim a string to a maximum length, returning null for null/empty input.</summary>
    private static string? Clamp(string? value, int maxLength)
    {
        if (string.IsNullOrEmpty(value)) return value;
        value = value.Trim();
        return value.Length <= maxLength ? value : value.Substring(0, maxLength);
    }

    private int? ParseNullableInt(IXLCell cell, int rowIndex, string fieldName, List<SalesImportIssue> issues, Guid batchId)
    {
        if (cell.IsEmpty()) return null;
        
        var value = cell.GetString()?.Trim();
        if (string.IsNullOrEmpty(value) || value.Equals("NaN", StringComparison.OrdinalIgnoreCase))
            return null;

        if (cell.DataType == XLDataType.Number)
        {
            return (int)cell.GetDouble();
        }

        if (int.TryParse(value, out var result))
        {
            return result;
        }

        issues.Add(new SalesImportIssue
        {
            ImportBatchId = batchId,
            RowIndex = rowIndex,
            Severity = "warning",
            Code = $"INVALID_{fieldName.ToUpper()}",
            Message = $"{fieldName} value '{value}' is not a valid integer; set to null."
        });

        return null;
    }

    private decimal? ParseNullableDecimal(IXLCell cell, int rowIndex, string fieldName, List<SalesImportIssue> issues, Guid batchId)
    {
        if (cell.IsEmpty()) return null;

        var value = cell.GetString()?.Trim();
        if (string.IsNullOrEmpty(value) || value.Equals("NaN", StringComparison.OrdinalIgnoreCase))
            return null;

        if (cell.DataType == XLDataType.Number)
        {
            return (decimal)cell.GetDouble();
        }

        // Try to parse, removing currency symbols and spaces
        var cleanValue = value.Replace("R", "").Replace(" ", "").Replace(",", "");
        if (decimal.TryParse(cleanValue, out var result))
        {
            return result;
        }

        issues.Add(new SalesImportIssue
        {
            ImportBatchId = batchId,
            RowIndex = rowIndex,
            Severity = "warning",
            Code = $"INVALID_{fieldName.ToUpper()}",
            Message = $"{fieldName} value '{value}' is not a valid decimal; set to null."
        });

        return null;
    }

    private string SerializeRowToJson(IXLRow row)
    {
        var rowData = new Dictionary<string, string>();
        var lastCol = Math.Max(13, _lastUsedColumn + 1);
        for (int i = 1; i <= lastCol; i++)
        {
            rowData[$"Col{i}"] = row.Cell(i).GetString() ?? "";
        }
        return JsonSerializer.Serialize(rowData);
    }

    /// <summary>
    /// Get import batch status and summary
    /// </summary>
    public async Task<ImportBatchStatusResponse?> GetImportStatusAsync(Guid importId)
    {
        var batch = await _context.SalesImportBatches
            .Include(b => b.Issues)
            .FirstOrDefaultAsync(b => b.ImportBatchId == importId);

        if (batch == null) return null;

        var summary = !string.IsNullOrEmpty(batch.SummaryJson) 
            ? JsonSerializer.Deserialize<SalesImportSummary>(batch.SummaryJson) 
            : new SalesImportSummary();

        return new ImportBatchStatusResponse
        {
            ImportId = batch.ImportBatchId,
            Status = batch.ParsingStatus,
            SourceFileName = batch.SourceFileName,
            SourceCompany = batch.SourceCompany,
            UploadedAt = batch.UploadedAt,
            Summary = summary ?? new SalesImportSummary(),
            Issues = batch.Issues.Select(i => new SalesImportIssueDto
            {
                Severity = i.Severity,
                RowIndex = i.RowIndex,
                Code = i.Code,
                Message = i.Message
            }).ToList()
        };
    }

    /// <summary>
    /// Get paginated transactions for an import
    /// </summary>
    public async Task<SalesTransactionPagedResponse> GetTransactionsAsync(Guid importId, int page = 1, int pageSize = 50)
    {
        var query = _context.SalesTransactionStagings
            .Where(t => t.ImportBatchId == importId)
            .OrderBy(t => t.RowIndex);

        var totalCount = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var transactions = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new SalesTransactionDto
            {
                Id = t.Id,
                RowIndex = t.RowIndex,
                CustomerNumber = t.CustomerNumber,
                CustomerName = t.CustomerName,
                Year = t.Year,
                Period = t.Period,
                Type = t.Type,
                TransactionDate = t.TransactionDate.HasValue ? t.TransactionDate.Value.ToString("yyyy-MM-dd") : null,
                TransactionNumber = t.TransactionNumber,
                Salesperson = t.Salesperson,
                Category = t.Category,
                Location = t.Location,
                Quantity = t.Quantity,
                SalesAmount = t.SalesAmount,
                SalesReturns = t.SalesReturns,
                CostOfSales = t.CostOfSales,
                Percent = t.Percent,
                ProductCode = t.ProductCode,
                ProductDescription = t.ProductDescription,
                HasIssues = t.HasIssues
            })
            .ToListAsync();

        return new SalesTransactionPagedResponse
        {
            ImportId = importId,
            Transactions = transactions,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    /// <summary>
    /// Commit an import - move staging data to production tables
    /// </summary>
    public async Task<SalesImportCommitResponse> CommitImportAsync(Guid importId, int userId)
    {
        var batch = await _context.SalesImportBatches
            .FirstOrDefaultAsync(b => b.ImportBatchId == importId);

        if (batch == null)
        {
            return new SalesImportCommitResponse
            {
                ImportId = importId,
                Success = false,
                Message = "Import batch not found."
            };
        }

        if (batch.ParsingStatus != "Parsed")
        {
            return new SalesImportCommitResponse
            {
                ImportId = importId,
                Success = false,
                Message = $"Cannot commit import with status '{batch.ParsingStatus}'. Only 'Parsed' imports can be committed."
            };
        }

        try
        {
            // Get all staging transactions
            var stagingTransactions = await _context.SalesTransactionStagings
                .Where(t => t.ImportBatchId == importId)
                .ToListAsync();

            // Insert into ImportedInvoices table (using existing table structure)
            foreach (var staging in stagingTransactions)
            {
                var invoice = new ImportedInvoice
                {
                    SourceCompany = batch.SourceCompany,
                    TransactionNumber = Clamp(staging.TransactionNumber, 50) ?? string.Empty,
                    TransactionDate = staging.TransactionDate ?? DateTime.UtcNow,
                    CustomerNumber = Clamp(staging.CustomerNumber, 50) ?? string.Empty,
                    CustomerName = Clamp(staging.CustomerName, 200) ?? string.Empty,
                    Year = staging.Year ?? 0,
                    Period = Clamp(staging.Period, 10) ?? string.Empty,
                    TransactionType = Clamp(staging.Type, 10) ?? string.Empty,
                    ProductCode = Clamp(!string.IsNullOrEmpty(staging.ProductCode) 
                        ? staging.ProductCode 
                        : (staging.Category.HasValue ? $"CAT-{staging.Category}" : string.Empty), 50) ?? string.Empty,
                    ProductDescription = Clamp(!string.IsNullOrEmpty(staging.ProductDescription) 
                        ? staging.ProductDescription 
                        : string.Empty, 500) ?? string.Empty,
                    SalesAmount = staging.SalesAmount ?? 0,
                    SalesReturns = staging.SalesReturns ?? 0,
                    CostOfSales = staging.CostOfSales ?? 0,
                    Quantity = staging.Quantity ?? 0,
                    Category = staging.Category,
                    Location = staging.Location,
                    ImportedAt = DateTime.UtcNow,
                    ImportBatchId = importId.ToString()
                };

                _context.ImportedInvoices.Add(invoice);
            }

            // ── Link uploaded invoices to existing Sales History records ──
            // Match by invoice number (+ company). Existing history rows get flagged as
            // reconciled/linked; invoices not yet in history get a new header created so
            // the upload actually feeds the Sales History tab.
            var linkResult = await LinkToSalesHistoryAsync(stagingTransactions, batch, importId);

            // Update batch status
            batch.ParsingStatus = "Committed";
            batch.CommittedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Import {ImportId} committed: {Count} transactions by user {UserId}. " +
                "Sales History linked: {Linked} matched, {Created} created.",
                importId, stagingTransactions.Count, userId, linkResult.Matched, linkResult.Created);

            return new SalesImportCommitResponse
            {
                ImportId = importId,
                Success = true,
                Message = $"Successfully committed {stagingTransactions.Count} transactions. " +
                          $"Sales History: {linkResult.Matched} linked to existing invoices, {linkResult.Created} new invoices added.",
                TransactionsCommitted = stagingTransactions.Count
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to commit import {ImportId}", importId);
            return new SalesImportCommitResponse
            {
                ImportId = importId,
                Success = false,
                Message = $"Failed to commit import: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Link committed transactions to the Sales History tab: existing history invoices are
    /// flagged as reconciled/linked, and invoices not yet present get a new history header
    /// created (aggregated per invoice number). Matching is by InvoiceNumber + SourceCompany.
    /// </summary>
    private async Task<(int Matched, int Created)> LinkToSalesHistoryAsync(
        List<SalesTransactionStaging> stagingTransactions,
        SalesImportBatch batch,
        Guid importId)
    {
        var company = batch.SourceCompany;
        var hasCompany = !string.IsNullOrWhiteSpace(company);

        // Aggregate the uploaded rows per invoice number (a detail file has many rows/invoice).
        var perInvoice = stagingTransactions
            .Where(t => !string.IsNullOrWhiteSpace(t.TransactionNumber))
            .GroupBy(t => t.TransactionNumber.Trim())
            .Select(g => new
            {
                InvoiceNumber = g.Key,
                CustomerName = g.Select(x => x.CustomerName).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)) ?? string.Empty,
                CustomerNumber = g.Select(x => x.CustomerNumber).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)),
                InvoiceDate = g.Where(x => x.TransactionDate.HasValue).Select(x => x.TransactionDate!.Value).DefaultIfEmpty(DateTime.UtcNow).Min(),
                Location = g.Select(x => x.Period).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)),
                SalesAmount = g.Sum(x => (x.SalesAmount ?? 0) - (x.SalesReturns ?? 0)),
                TotalCost = g.Any(x => x.CostOfSales.HasValue) ? g.Sum(x => x.CostOfSales ?? 0) : (decimal?)null
            })
            .ToList();

        if (perInvoice.Count == 0) return (0, 0);

        var invoiceNumbers = perInvoice.Select(p => p.InvoiceNumber).ToList();

        // Existing history headers for these invoices (same company when specified).
        var existing = await _context.SalesHistoryRecords
            .Where(r => invoiceNumbers.Contains(r.InvoiceNumber)
                        && (!hasCompany || r.SourceCompany == company))
            .ToListAsync();
        var existingByInvoice = existing
            .GroupBy(r => r.InvoiceNumber, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        int matched = 0, created = 0;

        foreach (var inv in perInvoice)
        {
            if (existingByInvoice.TryGetValue(inv.InvoiceNumber, out var header))
            {
                // Existing history invoice — flag as reconciled/linked and enrich cost if missing.
                header.IsReconciled = true;

                // Repair a wrong/zero sales value: if the freshly-parsed amount is non-zero and
                // differs from what's stored (e.g. an old import saved R0.00), refresh it and
                // recompute the derived profit/margin.
                if (inv.SalesAmount != 0m && header.SalesAmount != inv.SalesAmount)
                {
                    header.SalesAmount = inv.SalesAmount;
                    var cost = inv.TotalCost ?? header.TotalCost;
                    if (cost.HasValue)
                    {
                        header.GrossProfit = header.SalesAmount - cost.Value;
                        header.MarginPercent = header.SalesAmount != 0
                            ? Math.Round((header.SalesAmount - cost.Value) / header.SalesAmount * 100m, 4)
                            : (decimal?)null;
                    }
                }

                if (!header.TotalCost.HasValue && inv.TotalCost.HasValue)
                {
                    header.TotalCost = inv.TotalCost;
                    header.GrossProfit = header.SalesAmount - inv.TotalCost;
                    header.MarginPercent = header.SalesAmount != 0
                        ? Math.Round((header.SalesAmount - inv.TotalCost.Value) / header.SalesAmount * 100m, 4)
                        : (decimal?)null;
                }
                matched++;
            }
            else
            {
                // Not in history yet — create a new header so the upload feeds the tab.
                var gp = inv.TotalCost.HasValue ? inv.SalesAmount - inv.TotalCost : (decimal?)null;
                _context.SalesHistoryRecords.Add(new SalesHistoryRecord
                {
                    CustomerName = Clamp(inv.CustomerName, 200) ?? string.Empty,
                    CustomerNumber = Clamp(inv.CustomerNumber, 50),
                    InvoiceNumber = Clamp(inv.InvoiceNumber, 50) ?? string.Empty,
                    InvoiceDate = inv.InvoiceDate,
                    Location = Clamp(inv.Location, 20),
                    SalesAmount = inv.SalesAmount,
                    TotalCost = inv.TotalCost,
                    GrossProfit = gp,
                    MarginPercent = (gp.HasValue && inv.SalesAmount != 0)
                        ? Math.Round(gp.Value / inv.SalesAmount * 100m, 4)
                        : (decimal?)null,
                    HasLineDetail = false,
                    SourceCompany = hasCompany ? company : null,
                    ImportBatchId = importId.ToString(),
                    SourceFileName = batch.SourceFileName,
                    IsReconciled = true
                });
                created++;
            }
        }

        return (matched, created);
    }

    /// <summary>
    /// Cancel an import - delete staging data
    /// </summary>
    public async Task<bool> CancelImportAsync(Guid importId)
    {
        var batch = await _context.SalesImportBatches
            .FirstOrDefaultAsync(b => b.ImportBatchId == importId);

        if (batch == null || batch.ParsingStatus == "Committed")
        {
            return false;
        }

        // Delete staging data
        var transactions = await _context.SalesTransactionStagings
            .Where(t => t.ImportBatchId == importId)
            .ToListAsync();
        
        var issues = await _context.SalesImportIssues
            .Where(i => i.ImportBatchId == importId)
            .ToListAsync();

        _context.SalesTransactionStagings.RemoveRange(transactions);
        _context.SalesImportIssues.RemoveRange(issues);
        
        batch.ParsingStatus = "Cancelled";
        
        await _context.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Get list of all import batches
    /// </summary>
    public async Task<List<ImportBatchStatusResponse>> GetImportBatchesAsync(string? sourceCompany = null)
    {
        var query = _context.SalesImportBatches.AsQueryable();
        
        if (!string.IsNullOrEmpty(sourceCompany))
        {
            query = query.Where(b => b.SourceCompany == sourceCompany);
        }

        var batches = await query
            .OrderByDescending(b => b.UploadedAt)
            .Take(50)
            .ToListAsync();

        return batches.Select(b => new ImportBatchStatusResponse
        {
            ImportId = b.ImportBatchId,
            Status = b.ParsingStatus,
            SourceFileName = b.SourceFileName,
            SourceCompany = b.SourceCompany,
            UploadedAt = b.UploadedAt,
            Summary = new SalesImportSummary
            {
                Customers = b.TotalCustomers,
                Transactions = b.TotalTransactions,
                DateMin = b.DateMin?.ToString("yyyy-MM-dd"),
                DateMax = b.DateMax?.ToString("yyyy-MM-dd"),
                SalesTotal = b.SalesTotal,
                CostTotal = b.CostTotal,
                GrossProfit = b.SalesTotal - b.CostTotal
            }
        }).ToList();
    }
}
