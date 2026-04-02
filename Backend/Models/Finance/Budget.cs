using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    public class Budget
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Description { get; set; }

        // Period
        [Required]
        [MaxLength(20)]
        public string FiscalYear { get; set; } = DateTime.UtcNow.Year.ToString();

        [MaxLength(20)]
        public string? Period { get; set; } // Q1, Q2, Q3, Q4, Full Year, Jan, Feb, etc.

        [MaxLength(200)]
        public string? Department { get; set; }

        // Status: Draft, Active, Closed, OverBudget
        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Draft";

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalBudget { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AllocatedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SpentAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal RemainingAmount { get; set; }

        [MaxLength(10)]
        public string Currency { get; set; } = "ZAR";

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        [MaxLength(200)]
        public string? CreatedBy { get; set; }

        [MaxLength(200)]
        public string? ApprovedBy { get; set; }

        public DateTime? ApprovedDate { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public ICollection<BudgetLineItem> LineItems { get; set; } = new List<BudgetLineItem>();
    }

    public class BudgetLineItem
    {
        [Key]
        public int Id { get; set; }

        public int BudgetId { get; set; }

        [ForeignKey("BudgetId")]
        public Budget? Budget { get; set; }

        [Required]
        [MaxLength(300)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public int? CategoryId { get; set; }

        [ForeignKey("CategoryId")]
        public FinanceCategory? Category { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AllocatedAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SpentAmount { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal RemainingAmount { get; set; }
    }
}
