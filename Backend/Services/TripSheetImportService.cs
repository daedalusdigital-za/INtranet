using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services;

/// <summary>
/// Service for parsing and importing Trip Sheet Excel files with smart matching
/// </summary>
public class TripSheetImportService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TripSheetImportService> _logger;

    // Invoice number patterns (e.g., IN161765, INV12345, etc.)
    private static readonly Regex InvoicePattern = new(@"^(IN|INV|SI|TAX)\d+$", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    
    // Footer/summary markers that signal end of data
    private static readonly string[] FooterMarkers = new[]
    {
        "LOGISTICS CLERK", "LOGISTICS MANAGER", "VEHICLE MAKE", "SUMMARY OF FUEL",
        "TOLL COST", "FUEL COST", "SIGNATURE", "AUTHORIZED BY", "APPROVED BY",
        "TOTAL:", "GRAND TOTAL", "SUB TOTAL", "SUBTOTAL", "DRIVER SIGNATURE"
    };

    // Header markers to detect the data table start
    private static readonly string[] HeaderMarkers = new[]
    {
        "INV NO", "INVOICE", "CUSTOMER NAME", "CUSTOMER", "PRODUCT", "QTY", "VALUE", "AMOUNT"
    };

    public TripSheetImportService(ApplicationDbContext context, ILogger<TripSheetImportService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Parse and preview a Trip Sheet Excel file with matching
    /// </summary>
    public async Task<TripSheetImportPreviewResponse> ParseAndPreviewAsync(
        Stream fileStream, 
        string fileName,
        string? sheetName = null)
    {
        var response = new TripSheetImportPreviewResponse
        {
            BatchId = Guid.NewGuid().ToString(),
            FileName = fileName,
            Rows = new List<TripSheetImportPreviewRow>()
        };

        try
        {
            using var workbook = new XLWorkbook(fileStream);
            
            // Select worksheet
            var worksheet = string.IsNullOrEmpty(sheetName) 
                ? workbook.Worksheets.FirstOrDefault(ws => !IsEmptySheet(ws))
                : workbook.Worksheets.FirstOrDefault(ws => ws.Name.Equals(sheetName, StringComparison.OrdinalIgnoreCase));

            if (worksheet == null)
            {
                response.Rows.Add(new TripSheetImportPreviewRow
                {
                    RowIndex = 0,
                    Status = ImportRowStatus.Error,
                    ValidationErrors = new List<string> { "No valid worksheet found in the Excel file" }
                });
                return response;
            }

            response.SheetName = worksheet.Name;

            // Clean and parse the worksheet
            var extractedRows = ExtractDeliveryRows(worksheet, fileName);
            response.TotalRowsExtracted = extractedRows.Count;

            // Load existing data for matching
            var existingCustomers = await _context.LogisticsCustomers.AsNoTracking().ToListAsync();
            var existingInvoices = await _context.ImportedInvoices
                .AsNoTracking()
                .Where(i => i.Status != "Cancelled")
                .ToListAsync();

            // Process each extracted row
            foreach (var row in extractedRows)
            {
                var previewRow = new TripSheetImportPreviewRow
                {
                    RowIndex = row.SourceRowIndex,
                    Data = row,
                    ValidationErrors = new List<string>()
                };

                // Validate required fields
                ValidateRow(previewRow);

                // If no hard errors, attempt matching
                if (previewRow.Status != ImportRowStatus.Error)
                {
                    await MatchRowAsync(previewRow, existingCustomers, existingInvoices);
                }

                response.Rows.Add(previewRow);
            }

            // Calculate summary
            response.MatchedCount = response.Rows.Count(r => r.Status == ImportRowStatus.Matched);
            response.PartialMatchCount = response.Rows.Count(r => r.Status == ImportRowStatus.PartialMatch);
            response.UnmatchedCount = response.Rows.Count(r => r.Status == ImportRowStatus.Unmatched);
            response.ErrorCount = response.Rows.Count(r => r.Status == ImportRowStatus.Error);

            _logger.LogInformation(
                "Parsed {FileName}: {Total} rows, {Matched} matched, {Partial} partial, {Unmatched} unmatched, {Errors} errors",
                fileName, response.TotalRowsExtracted, response.MatchedCount, 
                response.PartialMatchCount, response.UnmatchedCount, response.ErrorCount);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error parsing Trip Sheet file {FileName}", fileName);
            response.Rows.Add(new TripSheetImportPreviewRow
            {
                RowIndex = 0,
                Status = ImportRowStatus.Error,
                ValidationErrors = new List<string> { $"Failed to parse file: {ex.Message}" }
            });
        }

        return response;
    }

    /// <summary>
    /// Commit the import after user review/confirmation
    /// </summary>
    public async Task<TripSheetImportCommitResponse> CommitImportAsync(
        TripSheetImportCommitRequest request,
        int? userId = null)
    {
        var response = new TripSheetImportCommitResponse
        {
            BatchId = request.BatchId,
            Success = true
        };

        try
        {
            // Generate TripSheet number
            var lastLoad = await _context.Loads
                .Where(l => l.LoadNumber.StartsWith("RF-"))
                .OrderByDescending(l => l.LoadNumber)
                .FirstOrDefaultAsync();

            int nextNumber = 1;
            if (lastLoad != null && lastLoad.LoadNumber.StartsWith("RF-"))
            {
                var numPart = lastLoad.LoadNumber.Substring(3);
                if (int.TryParse(numPart, out int parsed))
                {
                    nextNumber = parsed + 1;
                }
            }
            var tripSheetNumber = $"RF-{nextNumber:D6}";

            // Get warehouse for origin
            Warehouse? warehouse = null;
            string pickupLocation = "Warehouse";
            if (request.WarehouseId.HasValue)
            {
                warehouse = await _context.Warehouses.FindAsync(request.WarehouseId.Value);
                if (warehouse != null)
                {
                    pickupLocation = !string.IsNullOrEmpty(warehouse.Address) 
                        ? warehouse.Address 
                        : warehouse.City ?? warehouse.Name ?? "Warehouse";
                }
            }

            // Create the Load (Trip Sheet)
            var load = new Load
            {
                LoadNumber = tripSheetNumber,
                Status = request.DriverId.HasValue && request.VehicleId.HasValue ? "Assigned" : "Available",
                Priority = "Normal",
                DriverId = request.DriverId,
                VehicleId = request.VehicleId,
                WarehouseId = request.WarehouseId,
                PickupLocation = pickupLocation,
                ScheduledPickupDate = request.ScheduledDate ?? DateTime.Today,
                CreatedAt = DateTime.UtcNow,
                CreatedByUserId = userId,
                SpecialInstructions = request.Notes,
                Notes = $"Contains {request.Confirmations.Count} stops imported on {DateTime.Now:yyyy-MM-dd HH:mm}"
            };

            _context.Loads.Add(load);
            await _context.SaveChangesAsync();

            int successCount = 0;
            int errorCount = 0;
            var errors = new List<string>();
            int stopSequence = 1;
            decimal totalDistance = 0;
            decimal totalValue = 0;

            // Group confirmations by customer/address to create stops
            var stopGroups = request.Confirmations
                .GroupBy(c => new { 
                    Customer = (c.CustomerName ?? "").ToLower().Trim(),
                    Address = (c.DeliveryAddress ?? "").ToLower().Trim()
                })
                .ToList();

            foreach (var stopGroup in stopGroups)
            {
                var firstItem = stopGroup.First();
                
                try
                {
                    // Create LoadStop for this customer/address
                    var stop = new LoadStop
                    {
                        LoadId = load.Id,
                        StopSequence = stopSequence++,
                        StopType = "Delivery",
                        CompanyName = firstItem.CustomerName ?? "Unknown Customer",
                        CustomerId = firstItem.ConfirmedCustomerId,
                        Address = firstItem.DeliveryAddress,
                        City = firstItem.City,
                        Province = firstItem.Province,
                        ContactPerson = firstItem.ContactPerson,
                        ContactPhone = firstItem.ContactPhone,
                        Status = "Pending",
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.LoadStops.Add(stop);
                    await _context.SaveChangesAsync();

                    // Create commodities and invoices for each item in this stop group
                    foreach (var confirmation in stopGroup)
                    {
                        try
                        {
                            // Create StopCommodity for the PDF
                            var commodity = new StopCommodity
                            {
                                LoadStopId = stop.Id,
                                Quantity = confirmation.Quantity ?? 1,
                                UnitPrice = confirmation.SalesAmount ?? 0,
                                TotalPrice = confirmation.SalesAmount ?? 0,
                                Comment = confirmation.ProductDescription ?? "Imported Item",
                                CreatedAt = DateTime.UtcNow
                            };
                            _context.StopCommodities.Add(commodity);

                            totalValue += confirmation.SalesAmount ?? 0;

                            // Create or update ImportedInvoice
                            var invoice = new ImportedInvoice
                            {
                                TransactionNumber = confirmation.InvoiceNumber ?? $"IMP-{Guid.NewGuid().ToString().Substring(0, 8).ToUpper()}",
                                CustomerName = confirmation.CustomerName ?? "Unknown Customer",
                                CustomerNumber = confirmation.CustomerNumber ?? string.Empty,
                                ProductCode = "IMP",
                                ProductDescription = confirmation.ProductDescription ?? "Imported Item",
                                DeliveryAddress = confirmation.DeliveryAddress,
                                DeliveryCity = confirmation.City,
                                DeliveryProvince = confirmation.Province,
                                ContactPerson = confirmation.ContactPerson,
                                ContactPhone = confirmation.ContactPhone,
                                Quantity = confirmation.Quantity ?? 1,
                                SalesAmount = confirmation.SalesAmount ?? 0,
                                ImportedAt = DateTime.UtcNow,
                                ImportBatchId = request.BatchId,
                                SourceSystem = $"TripSheet-{tripSheetNumber}",
                                Status = "Assigned",
                                LoadId = load.Id,
                                CustomerId = confirmation.ConfirmedCustomerId
                            };

                            // If matched to existing invoice, update that instead
                            if (confirmation.ConfirmedInvoiceId.HasValue)
                            {
                                var existingInvoice = await _context.ImportedInvoices
                                    .FirstOrDefaultAsync(i => i.Id == confirmation.ConfirmedInvoiceId.Value);
                                
                                if (existingInvoice != null)
                                {
                                    existingInvoice.LoadId = load.Id;
                                    existingInvoice.Status = "Assigned";
                                    if (confirmation.ConfirmedCustomerId.HasValue)
                                    {
                                        existingInvoice.CustomerId = confirmation.ConfirmedCustomerId;
                                    }
                                }
                            }
                            else
                            {
                                _context.ImportedInvoices.Add(invoice);
                            }

                            // Update stop with invoice number if we have one
                            if (!string.IsNullOrEmpty(confirmation.InvoiceNumber) && string.IsNullOrEmpty(stop.InvoiceNumber))
                            {
                                stop.InvoiceNumber = confirmation.InvoiceNumber;
                            }

                            successCount++;
                        }
                        catch (Exception ex)
                        {
                            errorCount++;
                            errors.Add($"Row {confirmation.RowIndex}: {ex.Message}");
                        }
                    }
                }
                catch (Exception ex)
                {
                    errorCount++;
                    errors.Add($"Stop for {firstItem.CustomerName}: {ex.Message}");
                }
            }

            // Update load with calculated values
            load.EstimatedDistance = totalDistance > 0 ? totalDistance : null;

            await _context.SaveChangesAsync();

            response.TripSheetNumber = tripSheetNumber;
            response.LoadId = load.Id;
            response.ImportedCount = successCount;
            response.ErrorCount = errorCount;
            response.Errors = errors;
            response.TotalStops = stopSequence - 1;
            response.TotalValue = totalValue;

            _logger.LogInformation(
                "Committed import batch {BatchId} as {TripSheetNumber}: {Success} success, {Errors} errors, {Stops} stops",
                request.BatchId, tripSheetNumber, successCount, errorCount, stopSequence - 1);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error committing import batch {BatchId}", request.BatchId);
            response.Success = false;
            response.Errors = new List<string> { ex.Message };
        }

        return response;
    }

    #region Private Methods - Extraction

    private bool IsEmptySheet(IXLWorksheet worksheet)
    {
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 0;
        var lastCol = worksheet.LastColumnUsed()?.ColumnNumber() ?? 0;
        return lastRow < 2 || lastCol < 2;
    }

    private List<TripSheetImportRowDto> ExtractDeliveryRows(IXLWorksheet worksheet, string fileName)
    {
        var rows = new List<TripSheetImportRowDto>();
        
        var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 0;
        var lastCol = worksheet.LastColumnUsed()?.ColumnNumber() ?? 0;

        if (lastRow < 2 || lastCol < 1)
        {
            return rows;
        }

        // Step 1: Find the header row
        var (headerRowIndex, columnMap) = FindHeaderRow(worksheet, lastRow, lastCol);
        
        if (headerRowIndex == 0 || columnMap.Count == 0)
        {
            _logger.LogWarning("Could not find header row in {FileName}, trying simple column mapping", fileName);
            // Fallback: try first row as header
            columnMap = BuildColumnMapFromRow(worksheet.Row(1), lastCol);
            headerRowIndex = 1;
        }

        _logger.LogInformation("Found header at row {Row} with {ColCount} mapped columns", headerRowIndex, columnMap.Count);

        // Step 2: Extract data rows
        string? pendingAddress = null;
        TripSheetImportRowDto? lastRow2 = null;
        
        for (int rowIndex = headerRowIndex + 1; rowIndex <= lastRow; rowIndex++)
        {
            var row = worksheet.Row(rowIndex);
            
            // Check for footer markers
            if (IsFooterRow(row, lastCol))
            {
                _logger.LogInformation("Found footer marker at row {Row}, stopping extraction", rowIndex);
                break;
            }

            // Try to extract invoice number
            var invoiceNumber = GetCellValue(row, columnMap, "InvoiceNumber");
            var customerName = GetCellValue(row, columnMap, "CustomerName");
            var address = GetCellValue(row, columnMap, "DeliveryAddress");
            
            // Check if this is an invoice row (has invoice number matching pattern)
            var isInvoiceRow = !string.IsNullOrEmpty(invoiceNumber) && InvoicePattern.IsMatch(invoiceNumber.Trim());
            
            if (isInvoiceRow)
            {
                // This is a new invoice row
                var dto = new TripSheetImportRowDto
                {
                    CustomerName = customerName?.Trim(),
                    CustomerNumber = GetCellValue(row, columnMap, "CustomerNumber"),
                    DeliveryAddress = address?.Trim(),
                    City = GetCellValue(row, columnMap, "City"),
                    Province = GetCellValue(row, columnMap, "Province"),
                    PostalCode = GetCellValue(row, columnMap, "PostalCode"),
                    InvoiceNumber = invoiceNumber?.Trim(),
                    ProductDescription = GetCellValue(row, columnMap, "ProductDescription"),
                    QuantityText = GetCellValue(row, columnMap, "Quantity"),
                    ContactPerson = GetCellValue(row, columnMap, "ContactPerson"),
                    ContactPhone = GetCellValue(row, columnMap, "ContactPhone"),
                    ContactEmail = GetCellValue(row, columnMap, "ContactEmail"),
                    SourceFileName = fileName,
                    SourceSheetName = worksheet.Name,
                    SourceRowIndex = rowIndex
                };

                // Parse quantity
                var qtyStr = dto.QuantityText;
                if (!string.IsNullOrEmpty(qtyStr) && decimal.TryParse(
                    Regex.Replace(qtyStr, @"[^\d.]", ""), out decimal qty))
                {
                    dto.Quantity = qty;
                }

                // Parse sales amount
                var amountStr = GetCellValue(row, columnMap, "SalesAmount");
                if (!string.IsNullOrEmpty(amountStr))
                {
                    var cleanAmount = Regex.Replace(amountStr, @"[^\d.,\-]", "");
                    if (decimal.TryParse(cleanAmount, out decimal amount))
                    {
                        dto.SalesAmount = amount;
                    }
                }

                rows.Add(dto);
                lastRow2 = dto;
            }
            else if (lastRow2 != null && string.IsNullOrEmpty(lastRow2.DeliveryAddress))
            {
                // This might be an address continuation row
                // Look for address-like content in the customer/address column
                var potentialAddress = customerName ?? address;
                if (!string.IsNullOrWhiteSpace(potentialAddress) && 
                    !IsLabelRow(potentialAddress) &&
                    !InvoicePattern.IsMatch(potentialAddress))
                {
                    lastRow2.DeliveryAddress = potentialAddress.Trim();
                    
                    // Check next row for additional address lines
                    if (rowIndex + 1 <= lastRow)
                    {
                        var nextRow = worksheet.Row(rowIndex + 1);
                        var nextValue = GetCellValue(nextRow, columnMap, "CustomerName") ?? 
                                       GetCellValue(nextRow, columnMap, "DeliveryAddress");
                        
                        if (!string.IsNullOrWhiteSpace(nextValue) && 
                            !IsLabelRow(nextValue) &&
                            !InvoicePattern.IsMatch(nextValue) &&
                            nextValue.Length < 100)
                        {
                            lastRow2.DeliveryAddress += ", " + nextValue.Trim();
                        }
                    }
                }
            }
        }

        return rows;
    }

    private (int RowIndex, Dictionary<string, int> ColumnMap) FindHeaderRow(
        IXLWorksheet worksheet, int lastRow, int lastCol)
    {
        for (int rowIndex = 1; rowIndex <= Math.Min(lastRow, 20); rowIndex++)
        {
            var row = worksheet.Row(rowIndex);
            var rowText = string.Join(" ", 
                Enumerable.Range(1, lastCol)
                    .Select(c => row.Cell(c).GetValue<string>()?.ToUpper() ?? "")
                    .Where(s => !string.IsNullOrEmpty(s)));

            // Check if this row contains header markers
            var matchCount = HeaderMarkers.Count(marker => rowText.Contains(marker));
            if (matchCount >= 2)
            {
                var columnMap = BuildColumnMapFromRow(row, lastCol);
                if (columnMap.Count >= 2)
                {
                    return (rowIndex, columnMap);
                }
            }
        }

        return (0, new Dictionary<string, int>());
    }

    private Dictionary<string, int> BuildColumnMapFromRow(IXLRow row, int lastCol)
    {
        var columnMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        for (int col = 1; col <= lastCol; col++)
        {
            var header = row.Cell(col).GetValue<string>()?.Trim();
            if (!string.IsNullOrEmpty(header))
            {
                var normalizedHeader = NormalizeColumnHeader(header);
                if (!string.IsNullOrEmpty(normalizedHeader) && !columnMap.ContainsKey(normalizedHeader))
                {
                    columnMap[normalizedHeader] = col;
                }
            }
        }

        return columnMap;
    }

    private bool IsFooterRow(IXLRow row, int lastCol)
    {
        var rowText = string.Join(" ",
            Enumerable.Range(1, Math.Min(lastCol, 10))
                .Select(c => row.Cell(c).GetValue<string>()?.ToUpper() ?? "")
                .Where(s => !string.IsNullOrEmpty(s)));

        return FooterMarkers.Any(marker => rowText.Contains(marker));
    }

    private bool IsLabelRow(string text)
    {
        if (string.IsNullOrEmpty(text)) return true;
        var upper = text.ToUpper().Trim();
        return FooterMarkers.Any(m => upper.Contains(m)) ||
               upper == "TOTAL" || upper == "SUBTOTAL" ||
               upper.StartsWith("PAGE ") || 
               upper.Contains("SIGNATURE");
    }

    private string? GetCellValue(IXLRow row, Dictionary<string, int> columnMap, string fieldName)
    {
        if (columnMap.TryGetValue(fieldName, out int col))
        {
            var value = row.Cell(col).GetValue<string>();
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
        return null;
    }

    private string? NormalizeColumnHeader(string header)
    {
        var normalized = header.ToLower()
            .Replace(" ", "")
            .Replace("_", "")
            .Replace("-", "")
            .Replace(".", "")
            .Replace("#", "")
            .Replace("no", "number");

        return normalized switch
        {
            // Invoice number variations
            var h when h.Contains("inv") && (h.Contains("number") || h.Contains("num") || h.EndsWith("inv")) 
                => "InvoiceNumber",
            "invoicenumber" or "invoice" or "invnumber" or "transactionnumber" or "transnumber" or "docnumber" 
                => "InvoiceNumber",

            // Customer name variations  
            var h when h.Contains("customer") && h.Contains("name") => "CustomerName",
            "customername" or "customer" or "companyname" or "company" or "accountname" or "name" or "recipient" or "client"
                => "CustomerName",

            // Customer number variations
            var h when h.Contains("customer") && (h.Contains("number") || h.Contains("code")) => "CustomerNumber",
            "customernumber" or "customercode" or "accountnumber" or "accountcode" or "custnumber" or "accnumber"
                => "CustomerNumber",

            // Address variations
            var h when h.Contains("delivery") && h.Contains("address") => "DeliveryAddress",
            var h when h.Contains("address") && !h.Contains("email") => "DeliveryAddress",
            "deliveryaddress" or "address" or "streetaddress" or "street" or "address1" or "deliverylocation" or "location"
                => "DeliveryAddress",

            // City variations
            "city" or "town" or "deliverycity" or "suburb" or "area" => "City",

            // Province variations
            "province" or "state" or "region" or "deliveryprovince" => "Province",

            // Postal code variations
            "postalcode" or "postcode" or "zipcode" or "zip" or "code" => "PostalCode",

            // Product variations
            var h when h.Contains("product") && h.Contains("description") => "ProductDescription",
            "productdescription" or "product" or "description" or "itemdescription" or "item" or "productname" or "goods"
                => "ProductDescription",

            // Quantity variations
            "quantity" or "qty" or "units" or "count" or "pcs" or "pieces" => "Quantity",

            // Amount variations
            var h when h.Contains("sales") || h.Contains("value") || h.Contains("amount") || h.Contains("total") 
                => "SalesAmount",
            "salesamount" or "amount" or "total" or "value" or "netsales" or "invoiceamount" or "invoicevalue" or "price"
                => "SalesAmount",

            // Contact variations
            var h when h.Contains("contact") && h.Contains("person") => "ContactPerson",
            "contactperson" or "contact" or "contactname" or "receiver" or "attentionof" or "attn" or "attention"
                => "ContactPerson",

            var h when h.Contains("contact") && (h.Contains("phone") || h.Contains("tel")) => "ContactPhone",
            "contactphone" or "phone" or "telephone" or "tel" or "mobile" or "cellphone" or "phonenumber" or "cell"
                => "ContactPhone",

            var h when h.Contains("email") => "ContactEmail",
            "contactemail" or "email" or "emailaddress" => "ContactEmail",

            _ => null
        };
    }

    #endregion

    #region Private Methods - Validation

    private void ValidateRow(TripSheetImportPreviewRow row)
    {
        var errors = new List<string>();
        var data = row.Data;

        // Hard validation - required fields
        if (string.IsNullOrWhiteSpace(data.CustomerName))
        {
            errors.Add("Customer name is required");
        }
        else if (IsLabelRow(data.CustomerName))
        {
            errors.Add("Customer name appears to be a label/header");
        }

        if (string.IsNullOrWhiteSpace(data.DeliveryAddress))
        {
            errors.Add("Delivery address is required");
        }

        if (string.IsNullOrWhiteSpace(data.InvoiceNumber))
        {
            errors.Add("Invoice number is required");
        }

        // Soft validation - warnings
        if (!data.SalesAmount.HasValue || data.SalesAmount == 0)
        {
            row.Warnings ??= new List<string>();
            row.Warnings.Add("Sales amount is missing or zero");
        }

        if (string.IsNullOrWhiteSpace(data.QuantityText) && !data.Quantity.HasValue)
        {
            row.Warnings ??= new List<string>();
            row.Warnings.Add("Quantity is missing");
        }

        row.ValidationErrors = errors;
        row.Status = errors.Count > 0 ? ImportRowStatus.Error : ImportRowStatus.Unmatched;
    }

    #endregion

    #region Private Methods - Matching

    private async Task MatchRowAsync(
        TripSheetImportPreviewRow row,
        List<Customer> customers,
        List<ImportedInvoice> invoices)
    {
        var data = row.Data;
        row.SuggestedCustomers = new List<SuggestedMatch>();
        row.SuggestedInvoices = new List<SuggestedMatch>();

        // Step 1: Try invoice matching first (highest priority)
        if (!string.IsNullOrEmpty(data.InvoiceNumber))
        {
            var invoiceMatch = invoices.FirstOrDefault(i => 
                i.TransactionNumber.Equals(data.InvoiceNumber.Trim(), StringComparison.OrdinalIgnoreCase));

            if (invoiceMatch != null)
            {
                row.MatchedInvoiceId = invoiceMatch.Id;
                
                // If invoice has customer, use that
                if (invoiceMatch.CustomerId.HasValue)
                {
                    row.MatchedCustomerId = invoiceMatch.CustomerId;
                    row.Status = ImportRowStatus.Matched;
                    row.ConfidenceScore = 1.0;
                    return;
                }
            }

            // Fuzzy invoice matching
            var invoiceSuggestions = invoices
                .Select(i => new { Invoice = i, Score = CalculateSimilarity(data.InvoiceNumber, i.TransactionNumber) })
                .Where(x => x.Score >= 0.7)
                .OrderByDescending(x => x.Score)
                .Take(3)
                .ToList();

            foreach (var suggestion in invoiceSuggestions)
            {
                row.SuggestedInvoices.Add(new SuggestedMatch
                {
                    Id = suggestion.Invoice.Id,
                    DisplayName = $"{suggestion.Invoice.TransactionNumber} - {suggestion.Invoice.CustomerName}",
                    Score = suggestion.Score
                });
            }
        }

        // Step 2: Customer matching
        if (!string.IsNullOrEmpty(data.CustomerName))
        {
            var normalizedName = NormalizeName(data.CustomerName);

            // Exact match by customer code
            if (!string.IsNullOrEmpty(data.CustomerNumber))
            {
                var codeMatch = customers.FirstOrDefault(c => 
                    !string.IsNullOrEmpty(c.CustomerCode) &&
                    c.CustomerCode.Equals(data.CustomerNumber.Trim(), StringComparison.OrdinalIgnoreCase));

                if (codeMatch != null)
                {
                    row.MatchedCustomerId = codeMatch.Id;
                    row.Status = ImportRowStatus.Matched;
                    row.ConfidenceScore = 1.0;
                    return;
                }
            }

            // Exact name match
            var exactMatch = customers.FirstOrDefault(c => 
                NormalizeName(c.Name).Equals(normalizedName, StringComparison.OrdinalIgnoreCase));

            if (exactMatch != null)
            {
                row.MatchedCustomerId = exactMatch.Id;
                row.Status = ImportRowStatus.Matched;
                row.ConfidenceScore = 0.95;
                return;
            }

            // Fuzzy name matching with address consideration
            var customerScores = customers
                .Select(c => new 
                { 
                    Customer = c, 
                    NameScore = CalculateSimilarity(normalizedName, NormalizeName(c.Name)),
                    AddressScore = !string.IsNullOrEmpty(data.DeliveryAddress) && !string.IsNullOrEmpty(c.DeliveryAddress)
                        ? CalculateSimilarity(
                            NormalizeAddress(data.DeliveryAddress), 
                            NormalizeAddress(c.DeliveryAddress))
                        : 0.0
                })
                .Select(x => new 
                { 
                    x.Customer, 
                    x.NameScore, 
                    x.AddressScore,
                    // Combined score: 70% name, 30% address (if address available)
                    CombinedScore = x.AddressScore > 0 
                        ? (x.NameScore * 0.7) + (x.AddressScore * 0.3)
                        : x.NameScore
                })
                .Where(x => x.CombinedScore >= 0.6)
                .OrderByDescending(x => x.CombinedScore)
                .Take(5)
                .ToList();

            if (customerScores.Any())
            {
                var bestMatch = customerScores.First();
                
                if (bestMatch.CombinedScore >= 0.92)
                {
                    // Auto-match
                    row.MatchedCustomerId = bestMatch.Customer.Id;
                    row.Status = ImportRowStatus.Matched;
                    row.ConfidenceScore = bestMatch.CombinedScore;
                }
                else if (bestMatch.CombinedScore >= 0.80)
                {
                    // Partial match - needs review
                    row.Status = ImportRowStatus.PartialMatch;
                    row.ConfidenceScore = bestMatch.CombinedScore;
                }
                else
                {
                    row.Status = ImportRowStatus.Unmatched;
                }

                // Add suggestions
                foreach (var score in customerScores.Take(3))
                {
                    row.SuggestedCustomers.Add(new SuggestedMatch
                    {
                        Id = score.Customer.Id,
                        DisplayName = $"{score.Customer.Name}" + 
                            (!string.IsNullOrEmpty(score.Customer.CustomerCode) ? $" ({score.Customer.CustomerCode})" : ""),
                        Score = score.CombinedScore
                    });
                }
            }
            else
            {
                row.Status = ImportRowStatus.Unmatched;
            }
        }
    }

    private string NormalizeName(string name)
    {
        if (string.IsNullOrEmpty(name)) return string.Empty;
        
        return Regex.Replace(name.ToUpper(), @"[^A-Z0-9\s]", "")
            .Replace("  ", " ")
            .Trim();
    }

    private string NormalizeAddress(string address)
    {
        if (string.IsNullOrEmpty(address)) return string.Empty;
        
        return Regex.Replace(address.ToUpper(), @"[^A-Z0-9\s]", "")
            .Replace("STREET", "ST")
            .Replace("ROAD", "RD")
            .Replace("AVENUE", "AVE")
            .Replace("DRIVE", "DR")
            .Replace("  ", " ")
            .Trim();
    }

    /// <summary>
    /// Calculate Jaro-Winkler similarity between two strings
    /// </summary>
    private double CalculateSimilarity(string s1, string s2)
    {
        if (string.IsNullOrEmpty(s1) || string.IsNullOrEmpty(s2)) return 0.0;
        if (s1.Equals(s2, StringComparison.OrdinalIgnoreCase)) return 1.0;

        s1 = s1.ToLower();
        s2 = s2.ToLower();

        // Jaro similarity
        int s1Len = s1.Length;
        int s2Len = s2.Length;
        int matchDistance = Math.Max(s1Len, s2Len) / 2 - 1;
        if (matchDistance < 0) matchDistance = 0;

        var s1Matches = new bool[s1Len];
        var s2Matches = new bool[s2Len];
        int matches = 0;
        int transpositions = 0;

        for (int i = 0; i < s1Len; i++)
        {
            int start = Math.Max(0, i - matchDistance);
            int end = Math.Min(i + matchDistance + 1, s2Len);

            for (int j = start; j < end; j++)
            {
                if (s2Matches[j] || s1[i] != s2[j]) continue;
                s1Matches[i] = true;
                s2Matches[j] = true;
                matches++;
                break;
            }
        }

        if (matches == 0) return 0.0;

        int k = 0;
        for (int i = 0; i < s1Len; i++)
        {
            if (!s1Matches[i]) continue;
            while (!s2Matches[k]) k++;
            if (s1[i] != s2[k]) transpositions++;
            k++;
        }

        double jaro = ((double)matches / s1Len + (double)matches / s2Len + 
                       (double)(matches - transpositions / 2) / matches) / 3;

        // Winkler modification - boost for common prefix
        int prefix = 0;
        for (int i = 0; i < Math.Min(4, Math.Min(s1Len, s2Len)); i++)
        {
            if (s1[i] == s2[i]) prefix++;
            else break;
        }

        return jaro + (prefix * 0.1 * (1 - jaro));
    }

    #endregion
}

#region DTOs

public class TripSheetImportRowDto
{
    public string? CustomerName { get; set; }
    public string? CustomerNumber { get; set; }
    public string? DeliveryAddress { get; set; }
    public string? City { get; set; }
    public string? Province { get; set; }
    public string? PostalCode { get; set; }
    public string? InvoiceNumber { get; set; }
    public string? ProductDescription { get; set; }
    public string? QuantityText { get; set; }
    public decimal? Quantity { get; set; }
    public decimal? SalesAmount { get; set; }
    public string? ContactPerson { get; set; }
    public string? ContactPhone { get; set; }
    public string? ContactEmail { get; set; }
    public string? SourceFileName { get; set; }
    public string? SourceSheetName { get; set; }
    public int SourceRowIndex { get; set; }
}

public class TripSheetImportPreviewResponse
{
    public string BatchId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? SheetName { get; set; }
    public int TotalRowsExtracted { get; set; }
    public int MatchedCount { get; set; }
    public int PartialMatchCount { get; set; }
    public int UnmatchedCount { get; set; }
    public int ErrorCount { get; set; }
    public List<TripSheetImportPreviewRow> Rows { get; set; } = new();
}

public class TripSheetImportPreviewRow
{
    public int RowIndex { get; set; }
    public TripSheetImportRowDto Data { get; set; } = new();
    public ImportRowStatus Status { get; set; }
    public int? MatchedCustomerId { get; set; }
    public int? MatchedInvoiceId { get; set; }
    public double? ConfidenceScore { get; set; }
    public List<SuggestedMatch>? SuggestedCustomers { get; set; }
    public List<SuggestedMatch>? SuggestedInvoices { get; set; }
    public List<string>? ValidationErrors { get; set; }
    public List<string>? Warnings { get; set; }
}

public class SuggestedMatch
{
    public int Id { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public double Score { get; set; }
}

public enum ImportRowStatus
{
    Matched,
    PartialMatch,
    Unmatched,
    Error
}

public class TripSheetImportConfirmation
{
    public int RowIndex { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerNumber { get; set; }
    public string? DeliveryAddress { get; set; }
    public string? City { get; set; }
    public string? Province { get; set; }
    public string? InvoiceNumber { get; set; }
    public string? ProductDescription { get; set; }
    public decimal? Quantity { get; set; }
    public decimal? SalesAmount { get; set; }
    public string? ContactPerson { get; set; }
    public string? ContactPhone { get; set; }
    public int? ConfirmedCustomerId { get; set; }
    public int? ConfirmedInvoiceId { get; set; }
    public bool CreateNewCustomer { get; set; }
}

public class TripSheetImportCommitRequest
{
    public string BatchId { get; set; } = string.Empty;
    public int? DriverId { get; set; }
    public int? VehicleId { get; set; }
    public int? WarehouseId { get; set; }
    public DateTime? ScheduledDate { get; set; }
    public string? Notes { get; set; }
    public List<TripSheetImportConfirmation> Confirmations { get; set; } = new();
}

public class TripSheetImportCommitResponse
{
    public string BatchId { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string? TripSheetNumber { get; set; }
    public int? LoadId { get; set; }
    public int ImportedCount { get; set; }
    public int TotalStops { get; set; }
    public decimal TotalValue { get; set; }
    public int ErrorCount { get; set; }
    public List<string>? Errors { get; set; }
}

#endregion
