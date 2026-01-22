using ClosedXML.Excel;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using Microsoft.EntityFrameworkCore;
using System.Collections.Concurrent;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Services;

/// <summary>
/// Service for parsing and importing Stock on Hand (SOH) Excel reports
/// Handles snapshot data for inventory levels at a point in time
/// </summary>
public class StockOnHandImportService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<StockOnHandImportService> _logger;
    
    // In-memory cache for staging data (cleared after commit or timeout)
    private static readonly ConcurrentDictionary<Guid, SohImportBatch> _importCache = new();

    // Column name mappings (aliases)
    private static readonly Dictionary<string, string> ColumnMappings = new(StringComparer.OrdinalIgnoreCase)
    {
        // Primary names
        { "Item Number-Description", "ItemNumberDescription" },
        { "Location", "Location" },
        { "UOM", "Uom" },
        { "Qty on Hand", "QtyOnHand" },
        { "Qty on PO", "QtyOnPO" },
        { "Qty on SO", "QtyOnSO" },
        { "Stock Available", "StockAvailable" },
        { "Total Cost for Q", "TotalCostForQOH" },
        { "Unit Cost for QOH", "UnitCostForQOH" },
        
        // Aliases
        { "Item Number Description", "ItemNumberDescription" },
        { "ItemNumber-Description", "ItemNumberDescription" },
        { "Item Code-Description", "ItemNumberDescription" },
        { "QOH", "QtyOnHand" },
        { "Quantity on Hand", "QtyOnHand" },
        { "Quantity on PO", "QtyOnPO" },
        { "Quantity on SO", "QtyOnSO" },
        { "Total Cost for QOH", "TotalCostForQOH" },
        { "Total Cost", "TotalCostForQOH" },
        { "Unit Cost", "UnitCostForQOH" },
        { "Available Stock", "StockAvailable" },
        { "Available", "StockAvailable" },
    };

    // Required normalized column names
    private static readonly HashSet<string> RequiredColumns = new()
    {
        "ItemNumberDescription",
        "Location",
        "Uom",
        "QtyOnHand",
        "QtyOnPO",
        "QtyOnSO",
        "StockAvailable",
        "TotalCostForQOH",
        "UnitCostForQOH"
    };

    public StockOnHandImportService(ApplicationDbContext context, ILogger<StockOnHandImportService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Parse and validate a Stock on Hand Excel file
    /// </summary>
    public async Task<SohImportUploadResponse> ParseAndValidateAsync(
        Stream fileStream,
        string fileName,
        int operatingCompanyId,
        string operatingCompanyName,
        DateTime? asAtDate,
        bool strictMode = false)
    {
        var response = new SohImportUploadResponse();
        var issues = new List<SohImportIssue>();
        var lines = new List<SohLineStaging>();
        var batch = new SohImportBatch
        {
            SourceFileName = fileName,
            OperatingCompanyId = operatingCompanyId,
            OperatingCompanyName = operatingCompanyName,
            AsAtDate = asAtDate ?? DateTime.Today,
            Status = "Parsing"
        };

        try
        {
            // Validate file extension
            if (!fileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Only .xlsx files are supported. Please upload an Excel file.");
            }

            using var workbook = new XLWorkbook(fileStream);
            var worksheet = workbook.Worksheets.First();

            // Find and validate header row
            var headerRow = worksheet.Row(1);
            var columnMap = MapColumns(headerRow);
            
            // Check for required columns
            var missingColumns = RequiredColumns.Where(c => !columnMap.ContainsKey(c)).ToList();
            if (missingColumns.Any())
            {
                throw new InvalidOperationException(
                    $"Missing required columns: {string.Join(", ", missingColumns)}. " +
                    "Please ensure the Excel file has all required columns.");
            }

            var lastRowUsed = worksheet.LastRowUsed()?.RowNumber() ?? 0;
            if (lastRowUsed < 2)
            {
                throw new InvalidOperationException("File appears to be empty or has no data rows.");
            }

            var locationSet = new HashSet<string>();
            var itemCodeSet = new HashSet<string>();
            decimal totalQtyOnHand = 0;
            decimal totalStockValue = 0;

            // Process each data row (starting from row 2)
            for (int rowIndex = 2; rowIndex <= lastRowUsed; rowIndex++)
            {
                var row = worksheet.Row(rowIndex);
                
                // Skip completely empty rows
                if (row.IsEmpty())
                    continue;

                try
                {
                    var line = ParseRow(row, rowIndex, columnMap, issues, batch.ImportBatchId, strictMode);
                    
                    if (line != null)
                    {
                        lines.Add(line);
                        
                        if (!string.IsNullOrEmpty(line.Location))
                            locationSet.Add(line.Location);
                        
                        if (!string.IsNullOrEmpty(line.ItemCode))
                            itemCodeSet.Add(line.ItemCode);

                        totalQtyOnHand += line.QtyOnHand ?? 0;
                        totalStockValue += line.TotalCostForQOH ?? 0;

                        // Derived checks
                        PerformDerivedChecks(line, issues, batch.ImportBatchId);
                    }
                }
                catch (Exception ex)
                {
                    issues.Add(new SohImportIssue
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
            if (lines.Count == 0)
            {
                throw new InvalidOperationException("No valid lines found in the file. Please check the file format and data.");
            }

            // Build summary
            batch.Lines = lines;
            batch.Issues = issues;
            batch.Status = "Parsed";
            batch.Summary = new SohImportSummary
            {
                OperatingCompanyId = operatingCompanyId,
                OperatingCompanyName = operatingCompanyName,
                Lines = lines.Count,
                Items = itemCodeSet.Count,
                Locations = locationSet.OrderBy(l => l).ToList(),
                AsAtDate = batch.AsAtDate?.ToString("yyyy-MM-dd"),
                TotalQtyOnHand = totalQtyOnHand,
                TotalStockValue = totalStockValue,
                WarningCount = issues.Count(i => i.Severity == "warning"),
                ErrorCount = issues.Count(i => i.Severity == "error")
            };

            // Store in cache
            _importCache[batch.ImportBatchId] = batch;

            // Clean up old cache entries (older than 1 hour)
            CleanupCache();

            response.ImportId = batch.ImportBatchId;
            response.Success = true;
            response.Status = "Parsed";
            response.Message = $"Successfully parsed {lines.Count} lines from {locationSet.Count} location(s).";
            response.Summary = batch.Summary;
            response.Issues = issues.Select(i => new SohImportIssueDto
            {
                Severity = i.Severity,
                RowIndex = i.RowIndex,
                Code = i.Code,
                Message = i.Message,
                ItemCode = i.ItemCode,
                Location = i.Location
            }).ToList();

            _logger.LogInformation(
                "SOH import parsed: {FileName}, {Lines} lines, {Items} items, {Locations} locations, {Issues} issues",
                fileName, lines.Count, itemCodeSet.Count, locationSet.Count, issues.Count);

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse SOH report: {FileName}", fileName);

            response.Success = false;
            response.Status = "Failed";
            response.Message = $"Import failed: {ex.Message}";
            return response;
        }
    }

    /// <summary>
    /// Map Excel column headers to normalized field names
    /// </summary>
    private Dictionary<string, int> MapColumns(IXLRow headerRow)
    {
        var columnMap = new Dictionary<string, int>();
        var lastCell = headerRow.LastCellUsed()?.Address.ColumnNumber ?? 0;

        for (int col = 1; col <= lastCell; col++)
        {
            var headerValue = headerRow.Cell(col).GetString()?.Trim();
            if (string.IsNullOrEmpty(headerValue))
                continue;

            if (ColumnMappings.TryGetValue(headerValue, out var normalizedName))
            {
                columnMap[normalizedName] = col;
            }
        }

        return columnMap;
    }

    /// <summary>
    /// Parse a single row into a staging line
    /// </summary>
    private SohLineStaging? ParseRow(
        IXLRow row,
        int rowIndex,
        Dictionary<string, int> columnMap,
        List<SohImportIssue> issues,
        Guid batchId,
        bool strictMode)
    {
        var line = new SohLineStaging { RowIndex = rowIndex };

        // Parse Item Number-Description (split on first hyphen)
        var itemNumberDesc = GetCellString(row, columnMap, "ItemNumberDescription");
        if (string.IsNullOrWhiteSpace(itemNumberDesc))
        {
            if (strictMode)
            {
                issues.Add(new SohImportIssue
                {
                    ImportBatchId = batchId,
                    RowIndex = rowIndex,
                    Severity = "error",
                    Code = "MISSING_ITEM",
                    Message = "Item Number-Description is required."
                });
            }
            return null; // Skip row
        }

        var hyphenIndex = itemNumberDesc.IndexOf('-');
        if (hyphenIndex > 0)
        {
            line.ItemCode = itemNumberDesc.Substring(0, hyphenIndex).Trim();
            line.ItemDescription = itemNumberDesc.Substring(hyphenIndex + 1).Trim();
        }
        else
        {
            line.ItemCode = itemNumberDesc.Trim();
            line.ItemDescription = null;
        }

        // Parse Location (with normalization)
        var location = GetCellString(row, columnMap, "Location");
        line.Location = NormalizeLocation(location);

        if (string.IsNullOrWhiteSpace(line.Location))
        {
            issues.Add(new SohImportIssue
            {
                ImportBatchId = batchId,
                RowIndex = rowIndex,
                Severity = strictMode ? "error" : "warning",
                Code = "MISSING_LOCATION",
                Message = "Location is required.",
                ItemCode = line.ItemCode
            });

            if (strictMode) return null;
            line.HasIssues = true;
        }

        // Parse UOM
        line.Uom = GetCellString(row, columnMap, "Uom") ?? string.Empty;
        if (string.IsNullOrWhiteSpace(line.Uom))
        {
            issues.Add(new SohImportIssue
            {
                ImportBatchId = batchId,
                RowIndex = rowIndex,
                Severity = strictMode ? "error" : "warning",
                Code = "MISSING_UOM",
                Message = "UOM is required.",
                ItemCode = line.ItemCode,
                Location = line.Location
            });

            if (strictMode) return null;
            line.HasIssues = true;
        }

        // Parse numeric fields
        line.QtyOnHand = ParseDecimal(row, columnMap, "QtyOnHand", rowIndex, issues, batchId, strictMode, line);
        line.QtyOnPO = ParseDecimal(row, columnMap, "QtyOnPO", rowIndex, issues, batchId, strictMode, line);
        line.QtyOnSO = ParseDecimal(row, columnMap, "QtyOnSO", rowIndex, issues, batchId, strictMode, line);
        line.StockAvailable = ParseDecimal(row, columnMap, "StockAvailable", rowIndex, issues, batchId, strictMode, line);
        line.TotalCostForQOH = ParseDecimal(row, columnMap, "TotalCostForQOH", rowIndex, issues, batchId, strictMode, line);
        line.UnitCostForQOH = ParseDecimal(row, columnMap, "UnitCostForQOH", rowIndex, issues, batchId, strictMode, line);

        return line;
    }

    /// <summary>
    /// Normalize location values
    /// </summary>
    private string NormalizeLocation(string? location)
    {
        if (string.IsNullOrWhiteSpace(location))
            return string.Empty;

        // Trim and collapse multiple spaces
        location = Regex.Replace(location.Trim(), @"\s+", " ");

        // Normalize KZN NEW ROAD variants to KZN
        if (location.Contains("NEW ROAD", StringComparison.OrdinalIgnoreCase) ||
            location.Contains("NEW RD", StringComparison.OrdinalIgnoreCase))
        {
            return "KZN";
        }

        return location;
    }

    /// <summary>
    /// Get string value from cell
    /// </summary>
    private string? GetCellString(IXLRow row, Dictionary<string, int> columnMap, string fieldName)
    {
        if (!columnMap.TryGetValue(fieldName, out var colIndex))
            return null;

        return row.Cell(colIndex).GetString()?.Trim();
    }

    /// <summary>
    /// Parse decimal value from cell with error handling
    /// </summary>
    private decimal? ParseDecimal(
        IXLRow row,
        Dictionary<string, int> columnMap,
        string fieldName,
        int rowIndex,
        List<SohImportIssue> issues,
        Guid batchId,
        bool strictMode,
        SohLineStaging line)
    {
        if (!columnMap.TryGetValue(fieldName, out var colIndex))
            return null;

        var cell = row.Cell(colIndex);
        
        if (cell.IsEmpty())
            return null;

        // Try to get as number directly
        if (cell.DataType == XLDataType.Number)
        {
            return (decimal)cell.GetDouble();
        }

        // Try to parse string value
        var value = cell.GetString()?.Trim();
        if (string.IsNullOrEmpty(value))
            return null;

        // Clean up value (remove currency symbols, spaces, thousands separators)
        var cleanValue = value
            .Replace("R", "")
            .Replace("$", "")
            .Replace(" ", "")
            .Replace(",", "");

        if (decimal.TryParse(cleanValue, out var result))
        {
            return result;
        }

        // Invalid numeric value
        issues.Add(new SohImportIssue
        {
            ImportBatchId = batchId,
            RowIndex = rowIndex,
            Severity = strictMode ? "error" : "warning",
            Code = $"INVALID_{fieldName.ToUpper()}",
            Message = $"{fieldName} value '{value}' is not a valid number.",
            ItemCode = line.ItemCode,
            Location = line.Location
        });

        if (strictMode)
            throw new InvalidOperationException($"Invalid {fieldName} value at row {rowIndex}");

        line.HasIssues = true;
        return null;
    }

    /// <summary>
    /// Perform derived validation checks
    /// </summary>
    private void PerformDerivedChecks(SohLineStaging line, List<SohImportIssue> issues, Guid batchId)
    {
        // Check 1: Stock Available = QtyOnHand + QtyOnPO - QtyOnSO
        if (line.QtyOnHand.HasValue && line.QtyOnPO.HasValue && line.QtyOnSO.HasValue && line.StockAvailable.HasValue)
        {
            var computedAvailable = line.QtyOnHand.Value + line.QtyOnPO.Value - line.QtyOnSO.Value;
            if (Math.Abs(computedAvailable - line.StockAvailable.Value) > 0.01m)
            {
                issues.Add(new SohImportIssue
                {
                    ImportBatchId = batchId,
                    RowIndex = line.RowIndex,
                    Severity = "warning",
                    Code = "STOCK_AVAILABLE_MISMATCH",
                    Message = $"Reported stockAvailable ({line.StockAvailable:N2}) differs from computed value ({computedAvailable:N2}).",
                    ItemCode = line.ItemCode,
                    Location = line.Location
                });
            }
        }

        // Check 2: Unit Cost = TotalCost / QtyOnHand (if QtyOnHand > 0)
        if (line.QtyOnHand.HasValue && line.QtyOnHand.Value > 0 && 
            line.TotalCostForQOH.HasValue && line.UnitCostForQOH.HasValue)
        {
            var computedUnitCost = line.TotalCostForQOH.Value / line.QtyOnHand.Value;
            if (Math.Abs(computedUnitCost - line.UnitCostForQOH.Value) > 0.01m)
            {
                issues.Add(new SohImportIssue
                {
                    ImportBatchId = batchId,
                    RowIndex = line.RowIndex,
                    Severity = "warning",
                    Code = "UNIT_COST_MISMATCH",
                    Message = $"Reported unitCostForQOH ({line.UnitCostForQOH:N2}) differs from computed value ({computedUnitCost:N2}).",
                    ItemCode = line.ItemCode,
                    Location = line.Location
                });
            }
        }
    }

    /// <summary>
    /// Get import status
    /// </summary>
    public SohImportStatusResponse? GetImportStatus(Guid importId)
    {
        if (!_importCache.TryGetValue(importId, out var batch))
            return null;

        return new SohImportStatusResponse
        {
            ImportId = batch.ImportBatchId,
            OperatingCompanyId = batch.OperatingCompanyId,
            OperatingCompanyName = batch.OperatingCompanyName,
            Status = batch.Status,
            SourceFileName = batch.SourceFileName,
            UploadedAt = batch.UploadedAt,
            AsAtDate = batch.AsAtDate?.ToString("yyyy-MM-dd"),
            Summary = batch.Summary,
            Issues = batch.Issues.Select(i => new SohImportIssueDto
            {
                Severity = i.Severity,
                RowIndex = i.RowIndex,
                Code = i.Code,
                Message = i.Message,
                ItemCode = i.ItemCode,
                Location = i.Location
            }).ToList()
        };
    }

    /// <summary>
    /// Get paginated lines for preview
    /// </summary>
    public SohLinesPagedResponse? GetLines(Guid importId, int page = 1, int pageSize = 50)
    {
        if (!_importCache.TryGetValue(importId, out var batch))
            return null;

        var totalCount = batch.Lines.Count;
        var totalPages = (int)Math.Ceiling(totalCount / (double)pageSize);

        var lines = batch.Lines
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new SohLineDto
            {
                RowIndex = l.RowIndex,
                ItemCode = l.ItemCode,
                ItemDescription = l.ItemDescription,
                Location = l.Location,
                Uom = l.Uom,
                QtyOnHand = l.QtyOnHand,
                QtyOnPO = l.QtyOnPO,
                QtyOnSO = l.QtyOnSO,
                StockAvailable = l.StockAvailable,
                TotalCostForQOH = l.TotalCostForQOH,
                UnitCostForQOH = l.UnitCostForQOH,
                HasIssues = l.HasIssues
            })
            .ToList();

        return new SohLinesPagedResponse
        {
            ImportId = importId,
            Lines = lines,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    /// <summary>
    /// Commit the import to the database
    /// Deletes existing snapshot for the same AsAtDate and locations, then inserts new data
    /// </summary>
    public async Task<SohImportCommitResponse> CommitImportAsync(Guid importId, int userId)
    {
        if (!_importCache.TryGetValue(importId, out var batch))
        {
            return new SohImportCommitResponse
            {
                ImportId = importId,
                Success = false,
                Message = "Import batch not found or has expired."
            };
        }

        if (batch.Status != "Parsed")
        {
            return new SohImportCommitResponse
            {
                ImportId = importId,
                Success = false,
                Message = $"Cannot commit import with status '{batch.Status}'. Only 'Parsed' imports can be committed."
            };
        }

        try
        {
            var asAtDate = batch.AsAtDate ?? DateTime.Today;
            var locations = batch.Summary.Locations;

            // Delete existing snapshots for this company, date and these locations
            var existingSnapshots = await _context.Set<StockOnHandSnapshot>()
                .Where(s => s.OperatingCompanyId == batch.OperatingCompanyId 
                         && s.AsAtDate.Date == asAtDate.Date 
                         && locations.Contains(s.Location))
                .ToListAsync();

            var deletedCount = existingSnapshots.Count;
            if (existingSnapshots.Any())
            {
                _context.Set<StockOnHandSnapshot>().RemoveRange(existingSnapshots);
                _logger.LogInformation(
                    "Deleting {Count} existing snapshot records for company {CompanyId}, date {Date} and locations {Locations}",
                    deletedCount, batch.OperatingCompanyId, asAtDate.ToString("yyyy-MM-dd"), string.Join(", ", locations));
            }

            // Insert new snapshot records
            var snapshots = batch.Lines
                .Where(l => !string.IsNullOrEmpty(l.ItemCode) && !string.IsNullOrEmpty(l.Location))
                .Select(l => new StockOnHandSnapshot
                {
                    OperatingCompanyId = batch.OperatingCompanyId,
                    AsAtDate = asAtDate,
                    ItemCode = l.ItemCode,
                    ItemDescription = l.ItemDescription,
                    Location = l.Location,
                    Uom = l.Uom,
                    QtyOnHand = l.QtyOnHand,
                    QtyOnPO = l.QtyOnPO,
                    QtyOnSO = l.QtyOnSO,
                    StockAvailable = l.StockAvailable,
                    TotalCostForQOH = l.TotalCostForQOH,
                    UnitCostForQOH = l.UnitCostForQOH,
                    ImportBatchId = importId.ToString(),
                    RowIndex = l.RowIndex,
                    CreatedAt = DateTime.UtcNow
                })
                .ToList();

            await _context.Set<StockOnHandSnapshot>().AddRangeAsync(snapshots);
            await _context.SaveChangesAsync();

            // Update batch status and remove from cache
            batch.Status = "Committed";
            _importCache.TryRemove(importId, out _);

            _logger.LogInformation(
                "SOH import {ImportId} committed: {Inserted} inserted, {Deleted} deleted by user {UserId}",
                importId, snapshots.Count, deletedCount, userId);

            return new SohImportCommitResponse
            {
                ImportId = importId,
                Success = true,
                Message = $"Successfully committed {snapshots.Count} stock on hand records.",
                LinesCommitted = snapshots.Count,
                LinesDeleted = deletedCount
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to commit SOH import {ImportId}", importId);
            return new SohImportCommitResponse
            {
                ImportId = importId,
                Success = false,
                Message = $"Failed to commit import: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Cancel an import and remove from cache
    /// </summary>
    public bool CancelImport(Guid importId)
    {
        return _importCache.TryRemove(importId, out _);
    }

    /// <summary>
    /// Export issues as CSV
    /// </summary>
    public string? ExportIssuesToCsv(Guid importId)
    {
        if (!_importCache.TryGetValue(importId, out var batch))
            return null;

        var csv = new System.Text.StringBuilder();
        csv.AppendLine("RowIndex,Severity,Code,Message,ItemCode,Location");

        foreach (var issue in batch.Issues)
        {
            csv.AppendLine($"{issue.RowIndex},{issue.Severity},\"{issue.Code}\",\"{issue.Message?.Replace("\"", "\"\"")}\",\"{issue.ItemCode}\",\"{issue.Location}\"");
        }

        return csv.ToString();
    }

    /// <summary>
    /// Clean up old cache entries
    /// </summary>
    private void CleanupCache()
    {
        var cutoff = DateTime.UtcNow.AddHours(-1);
        var oldEntries = _importCache.Where(kv => kv.Value.UploadedAt < cutoff).Select(kv => kv.Key).ToList();
        
        foreach (var key in oldEntries)
        {
            _importCache.TryRemove(key, out _);
        }
    }
}
