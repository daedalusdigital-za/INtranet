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

    // Column indices based on expected Sage report format
    private const int COL_YEAR = 0;
    private const int COL_PERIOD = 1;
    private const int COL_TYPE = 2;
    private const int COL_DATE = 3;
    private const int COL_TRANSACTION_NUMBER = 4;
    private const int COL_SALESPERSON = 5;
    private const int COL_CATEGORY = 6;
    private const int COL_LOCATION = 7;
    private const int COL_QUANTITY = 8;
    private const int COL_SALES_AMOUNT = 9;
    private const int COL_SALES_RETURNS = 10;
    private const int COL_COST_OF_SALES = 11;
    private const int COL_PERCENT = 12;
    
    // Extended columns - detected from header row
    private int? _colProductCode = null;
    private int? _colProductDescription = null;
    private int _lastUsedColumn = 12;

    public SalesReportImportService(ApplicationDbContext context, ILogger<SalesReportImportService> logger)
    {
        _context = context;
        _logger = logger;
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
            using var workbook = new XLWorkbook(fileStream);
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
            var headerRow = worksheet.Row(1);
            var lastColUsed = headerRow.LastCellUsed()?.Address?.ColumnNumber ?? 13;
            for (int col = 1; col <= lastColUsed; col++)
            {
                var headerText = headerRow.Cell(col).GetString()?.Trim().ToLower() ?? "";
                if (headerText.Contains("product code") || headerText.Contains("productcode") || 
                    headerText.Contains("stock code") || headerText.Contains("stockcode") ||
                    headerText.Contains("item code") || headerText.Contains("itemcode"))
                {
                    _colProductCode = col - 1; // 0-indexed
                    _logger.LogInformation("Detected product code column at index {Col}: {Header}", col, headerText);
                }
                else if (headerText.Contains("product desc") || headerText.Contains("productdesc") ||
                         headerText.Contains("item desc") || headerText.Contains("itemdesc") ||
                         headerText.Contains("stock desc") || headerText.Contains("stockdesc") ||
                         headerText.Contains("description") || headerText.Contains("product name") ||
                         headerText.Contains("item name") || headerText.Contains("stock item"))
                {
                    _colProductDescription = col - 1; // 0-indexed
                    _logger.LogInformation("Detected product description column at index {Col}: {Header}", col, headerText);
                }
            }
            if (lastColUsed > 13) _lastUsedColumn = lastColUsed - 1;

            for (int rowIndex = 2; rowIndex <= lastRowUsed; rowIndex++)
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
                throw new InvalidOperationException("No valid transactions found in the file. Please check the file format.");
            }

            if (customerSet.Count == 0)
            {
                throw new InvalidOperationException("No customer headers found. Please ensure the file contains 'Customer Number:' rows.");
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
            var dateCellStr = row.Cell(COL_DATE + 1).GetString()?.Trim() ?? "";
            var txnNumStr = row.Cell(COL_TRANSACTION_NUMBER + 1).GetString()?.Trim() ?? "";
            
            // Product header: has text in first column, possibly description in second,
            // and no date or transaction number in their expected columns
            bool hasDate = false;
            if (row.Cell(COL_DATE + 1).DataType == XLDataType.DateTime) hasDate = true;
            else if (DateTime.TryParse(dateCellStr, out _)) hasDate = true;
            
            if (!hasDate && string.IsNullOrEmpty(txnNumStr))
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
        transaction.Quantity = ParseNullableDecimal(row.Cell(COL_QUANTITY + 1), rowIndex, "Quantity", issues, batchId);
        transaction.SalesAmount = ParseNullableDecimal(row.Cell(COL_SALES_AMOUNT + 1), rowIndex, "SalesAmount", issues, batchId);
        transaction.SalesReturns = ParseNullableDecimal(row.Cell(COL_SALES_RETURNS + 1), rowIndex, "SalesReturns", issues, batchId);
        transaction.CostOfSales = ParseNullableDecimal(row.Cell(COL_COST_OF_SALES + 1), rowIndex, "CostOfSales", issues, batchId);
        transaction.Percent = ParseNullableDecimal(row.Cell(COL_PERCENT + 1), rowIndex, "Percent", issues, batchId);

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

        return transaction;
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
                    TransactionNumber = staging.TransactionNumber,
                    TransactionDate = staging.TransactionDate ?? DateTime.UtcNow,
                    CustomerNumber = staging.CustomerNumber,
                    CustomerName = staging.CustomerName,
                    Year = staging.Year ?? 0,
                    Period = staging.Period ?? string.Empty,
                    TransactionType = staging.Type ?? string.Empty,
                    ProductCode = !string.IsNullOrEmpty(staging.ProductCode) 
                        ? staging.ProductCode 
                        : (staging.Category.HasValue ? $"CAT-{staging.Category}" : string.Empty),
                    ProductDescription = !string.IsNullOrEmpty(staging.ProductDescription) 
                        ? staging.ProductDescription 
                        : string.Empty,
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

            // Update batch status
            batch.ParsingStatus = "Committed";
            batch.CommittedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation(
                "Import {ImportId} committed: {Count} transactions by user {UserId}",
                importId, stagingTransactions.Count, userId);

            return new SalesImportCommitResponse
            {
                ImportId = importId,
                Success = true,
                Message = $"Successfully committed {stagingTransactions.Count} transactions.",
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
