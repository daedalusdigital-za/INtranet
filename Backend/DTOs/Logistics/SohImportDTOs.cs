namespace ProjectTracker.API.DTOs.Logistics;

/// <summary>
/// Response from uploading a Stock on Hand report
/// </summary>
public class SohImportUploadResponse
{
    public bool Success { get; set; }
    public Guid ImportId { get; set; }
    public SohImportSummary Summary { get; set; } = new();
    public List<SohImportIssueDto> Issues { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Summary of parsed SOH data
/// </summary>
public class SohImportSummary
{
    public int OperatingCompanyId { get; set; }
    public string OperatingCompanyName { get; set; } = string.Empty;
    public int Lines { get; set; }
    public int Items { get; set; }
    public List<string> Locations { get; set; } = new();
    public string? AsAtDate { get; set; }
    public decimal TotalQtyOnHand { get; set; }
    public decimal TotalStockValue { get; set; }
    public int WarningCount { get; set; }
    public int ErrorCount { get; set; }
}

/// <summary>
/// Issue found during parsing (DTO for API response)
/// </summary>
public class SohImportIssueDto
{
    public string Severity { get; set; } = "warning";
    public int RowIndex { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? ItemCode { get; set; }
    public string? Location { get; set; }
}

/// <summary>
/// Single parsed SOH row for preview
/// </summary>
public class SohLineDto
{
    public int RowIndex { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string? ItemDescription { get; set; }
    public string Location { get; set; } = string.Empty;
    public string Uom { get; set; } = string.Empty;
    public decimal? QtyOnHand { get; set; }
    public decimal? QtyOnPO { get; set; }
    public decimal? QtyOnSO { get; set; }
    public decimal? StockAvailable { get; set; }
    public decimal? TotalCostForQOH { get; set; }
    public decimal? UnitCostForQOH { get; set; }
    public bool HasIssues { get; set; }
}

/// <summary>
/// Paginated response for SOH lines preview
/// </summary>
public class SohLinesPagedResponse
{
    public Guid ImportId { get; set; }
    public List<SohLineDto> Lines { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

/// <summary>
/// Result of committing an SOH import
/// </summary>
public class SohImportCommitResponse
{
    public Guid ImportId { get; set; }
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int LinesCommitted { get; set; }
    public int LinesDeleted { get; set; }
}

/// <summary>
/// Import batch status response
/// </summary>
public class SohImportStatusResponse
{
    public Guid ImportId { get; set; }
    public int OperatingCompanyId { get; set; }
    public string OperatingCompanyName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string SourceFileName { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public string? AsAtDate { get; set; }
    public SohImportSummary Summary { get; set; } = new();
    public List<SohImportIssueDto> Issues { get; set; } = new();
}

/// <summary>
/// Staging model for parsed SOH data (in-memory, not persisted)
/// </summary>
public class SohLineStaging
{
    public int RowIndex { get; set; }
    public string ItemCode { get; set; } = string.Empty;
    public string? ItemDescription { get; set; }
    public string Location { get; set; } = string.Empty;
    public string Uom { get; set; } = string.Empty;
    public decimal? QtyOnHand { get; set; }
    public decimal? QtyOnPO { get; set; }
    public decimal? QtyOnSO { get; set; }
    public decimal? StockAvailable { get; set; }
    public decimal? TotalCostForQOH { get; set; }
    public decimal? UnitCostForQOH { get; set; }
    public bool HasIssues { get; set; }
}

/// <summary>
/// Issue found during parsing (internal model)
/// </summary>
public class SohImportIssue
{
    public Guid ImportBatchId { get; set; }
    public string Severity { get; set; } = "warning";
    public int RowIndex { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string? ItemCode { get; set; }
    public string? Location { get; set; }
}

/// <summary>
/// Import batch tracking (in-memory cache)
/// </summary>
public class SohImportBatch
{
    public Guid ImportBatchId { get; set; } = Guid.NewGuid();
    public int OperatingCompanyId { get; set; }
    public string OperatingCompanyName { get; set; } = string.Empty;
    public string SourceFileName { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    public DateTime? AsAtDate { get; set; }
    public string Status { get; set; } = "Parsing";
    public List<SohLineStaging> Lines { get; set; } = new();
    public List<SohImportIssue> Issues { get; set; } = new();
    public SohImportSummary Summary { get; set; } = new();
}
