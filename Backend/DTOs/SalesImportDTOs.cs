namespace ProjectTracker.API.DTOs;

/// <summary>
/// Response from uploading a sales report
/// </summary>
public class SalesImportUploadResponse
{
    public bool Success { get; set; }
    public Guid ImportId { get; set; }
    public SalesImportSummary Summary { get; set; } = new();
    public List<SalesImportIssueDto> Issues { get; set; } = new();
    public string Status { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Summary of parsed sales data
/// </summary>
public class SalesImportSummary
{
    public int Customers { get; set; }
    public int Transactions { get; set; }
    public string? DateMin { get; set; }
    public string? DateMax { get; set; }
    public decimal SalesTotal { get; set; }
    public decimal SalesReturnsTotal { get; set; }
    public decimal CostTotal { get; set; }
    public decimal GrossProfit { get; set; }
    public List<CustomerSummary> TopCustomers { get; set; } = new();
    
    // Duplicate detection info
    public int DuplicateCount { get; set; }
    public decimal DuplicateSalesTotal { get; set; }
    public List<DuplicateInfo> Duplicates { get; set; } = new();
}

/// <summary>
/// Information about a detected duplicate transaction
/// </summary>
public class DuplicateInfo
{
    public int RowIndex { get; set; }
    public string TransactionNumber { get; set; } = string.Empty;
    public string CustomerNumber { get; set; } = string.Empty;
    public string TransactionDate { get; set; } = string.Empty;
    public decimal SalesAmount { get; set; }
    public decimal ExistingSalesAmount { get; set; }
    public string ExistingImportBatchId { get; set; } = string.Empty;
    public DateTime ExistingImportedAt { get; set; }
}

/// <summary>
/// Summary per customer
/// </summary>
public class CustomerSummary
{
    public string CustomerNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public int TransactionCount { get; set; }
    public decimal SalesAmount { get; set; }
}

/// <summary>
/// Issue found during parsing (DTO for API response)
/// </summary>
public class SalesImportIssueDto
{
    public string Severity { get; set; } = "warning";
    public int RowIndex { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Single parsed transaction row
/// </summary>
public class SalesTransactionDto
{
    public int Id { get; set; }
    public int RowIndex { get; set; }
    public string CustomerNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public int? Year { get; set; }
    public string? Period { get; set; }
    public string? Type { get; set; }
    public string? TransactionDate { get; set; }
    public string TransactionNumber { get; set; } = string.Empty;
    public int? Salesperson { get; set; }
    public int? Category { get; set; }
    public int? Location { get; set; }
    public decimal? Quantity { get; set; }
    public decimal? SalesAmount { get; set; }
    public decimal? SalesReturns { get; set; }
    public decimal? CostOfSales { get; set; }
    public decimal? Percent { get; set; }
    public bool HasIssues { get; set; }
}

/// <summary>
/// Paginated response for transactions
/// </summary>
public class SalesTransactionPagedResponse
{
    public Guid ImportId { get; set; }
    public List<SalesTransactionDto> Transactions { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

/// <summary>
/// Request to upload a sales report
/// </summary>
public class SalesImportRequest
{
    public string SourceCompany { get; set; } = string.Empty;
    public bool StrictMode { get; set; } = false;
}

/// <summary>
/// Result of committing an import
/// </summary>
public class SalesImportCommitResponse
{
    public Guid ImportId { get; set; }
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int TransactionsCommitted { get; set; }
}

/// <summary>
/// Import batch status response
/// </summary>
public class ImportBatchStatusResponse
{
    public Guid ImportId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string SourceFileName { get; set; } = string.Empty;
    public string SourceCompany { get; set; } = string.Empty;
    public DateTime UploadedAt { get; set; }
    public SalesImportSummary Summary { get; set; } = new();
    public List<SalesImportIssueDto> Issues { get; set; } = new();
}
