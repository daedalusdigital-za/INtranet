using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Tenders
{
    /// <summary>
    /// Knowledge base entries for tender templates and responses
    /// </summary>
    public class TenderKnowledgeBase
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty; 
        // SBDTemplate, TechnicalResponse, WinningProposal, PricingBenchmark, LegalClause, FAQ, Other

        [MaxLength(100)]
        public string? SubCategory { get; set; }

        public string? Content { get; set; }

        [MaxLength(500)]
        public string? FilePath { get; set; }

        [MaxLength(200)]
        public string? FileName { get; set; }

        [MaxLength(50)]
        public string? FileType { get; set; }

        // Metadata
        [MaxLength(500)]
        public string? Tags { get; set; } // Comma-separated

        [MaxLength(100)]
        public string? DepartmentCategory { get; set; } // Which department this applies to

        [MaxLength(50)]
        public string? Province { get; set; }

        public bool IsActive { get; set; } = true;

        public int ViewCount { get; set; }

        public int UseCount { get; set; }

        public int CreatedByUserId { get; set; }

        [MaxLength(100)]
        public string? CreatedByUserName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }
    }

    /// <summary>
    /// Tender analytics/statistics cache
    /// </summary>
    public class TenderStats
    {
        public int ActiveTenders { get; set; }
        public int ClosingThisWeek { get; set; }
        public int ComplianceExpiring { get; set; }
        public int AwardedYTD { get; set; }
        public int LostYTD { get; set; }
        public decimal TotalValueSubmitted { get; set; }
        public decimal TotalValueAwarded { get; set; }
        public decimal WinRate { get; set; }
        public Dictionary<string, int> ByProvince { get; set; } = new();
        public Dictionary<string, int> ByDepartment { get; set; } = new();
        public Dictionary<string, int> ByStatus { get; set; } = new();
        public Dictionary<string, int> ByCompany { get; set; } = new();
    }
}
