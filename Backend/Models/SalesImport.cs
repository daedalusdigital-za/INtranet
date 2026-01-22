using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models;

/// <summary>
/// Tracks each sales report import batch
/// </summary>
public class SalesImportBatch
{
    [Key]
    public Guid ImportBatchId { get; set; } = Guid.NewGuid();
    
    public int UploadedBy { get; set; }
    
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    
    [Required]
    [MaxLength(255)]
    public string SourceFileName { get; set; } = string.Empty;
    
    [MaxLength(50)]
    public string SourceCompany { get; set; } = string.Empty;
    
    [MaxLength(20)]
    public string ParsingStatus { get; set; } = "Pending"; // Pending, Parsed, Failed, Committed, Cancelled
    
    public string? SummaryJson { get; set; }
    
    public int TotalCustomers { get; set; }
    
    public int TotalTransactions { get; set; }
    
    public DateTime? DateMin { get; set; }
    
    public DateTime? DateMax { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal SalesTotal { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal CostTotal { get; set; }
    
    public DateTime? CommittedAt { get; set; }
    
    // Navigation properties
    public virtual ICollection<SalesTransactionStaging> Transactions { get; set; } = new List<SalesTransactionStaging>();
    public virtual ICollection<SalesImportIssue> Issues { get; set; } = new List<SalesImportIssue>();
}

/// <summary>
/// Staging table for parsed sales transactions
/// </summary>
public class SalesTransactionStaging
{
    [Key]
    public int Id { get; set; }
    
    public Guid ImportBatchId { get; set; }
    
    public int RowIndex { get; set; }
    
    [MaxLength(50)]
    public string CustomerNumber { get; set; } = string.Empty;
    
    [MaxLength(255)]
    public string CustomerName { get; set; } = string.Empty;
    
    public int? Year { get; set; }
    
    [MaxLength(10)]
    public string? Period { get; set; }
    
    [MaxLength(20)]
    public string? Type { get; set; }
    
    public DateTime? TransactionDate { get; set; }
    
    [MaxLength(50)]
    public string TransactionNumber { get; set; } = string.Empty;
    
    public int? Salesperson { get; set; }
    
    public int? Category { get; set; }
    
    public int? Location { get; set; }
    
    [Column(TypeName = "decimal(18,4)")]
    public decimal? Quantity { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal? SalesAmount { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal? SalesReturns { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal? CostOfSales { get; set; }
    
    [Column(TypeName = "decimal(18,6)")]
    public decimal? Percent { get; set; }
    
    public bool HasIssues { get; set; }
    
    // Navigation property
    [ForeignKey("ImportBatchId")]
    public virtual SalesImportBatch? ImportBatch { get; set; }
}

/// <summary>
/// Tracks parsing issues for each import
/// </summary>
public class SalesImportIssue
{
    [Key]
    public int Id { get; set; }
    
    public Guid ImportBatchId { get; set; }
    
    public int RowIndex { get; set; }
    
    [MaxLength(20)]
    public string Severity { get; set; } = "warning"; // warning, error
    
    [MaxLength(50)]
    public string Code { get; set; } = string.Empty;
    
    [MaxLength(500)]
    public string Message { get; set; } = string.Empty;
    
    public string? RawRowJson { get; set; }
    
    // Navigation property
    [ForeignKey("ImportBatchId")]
    public virtual SalesImportBatch? ImportBatch { get; set; }
}
