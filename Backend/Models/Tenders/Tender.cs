using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Tenders
{
    /// <summary>
    /// Main Tender entity for tracking government and corporate tenders
    /// </summary>
    public class Tender
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string TenderNumber { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Description { get; set; }

        // Issuing Authority
        [Required]
        [MaxLength(200)]
        public string IssuingDepartment { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? DepartmentCategory { get; set; } // Municipality, Health, Correctional Services, Education, etc.

        [MaxLength(50)]
        public string? Province { get; set; } // KZN, WC, EC, GP, etc.

        [MaxLength(200)]
        public string? ContactPerson { get; set; }

        [MaxLength(100)]
        public string? ContactEmail { get; set; }

        [MaxLength(50)]
        public string? ContactPhone { get; set; }

        // Company Assignment
        [Required]
        [MaxLength(10)]
        public string CompanyCode { get; set; } = string.Empty; // PMT, SBT, ACM

        // Financial
        [Column(TypeName = "decimal(18,2)")]
        public decimal? EstimatedValue { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? AwardedValue { get; set; }

        [MaxLength(20)]
        public string? EvaluationCriteria { get; set; } // "80/20", "90/10"

        // Important Dates
        public DateTime? PublishedDate { get; set; }

        public DateTime? CompulsoryBriefingDate { get; set; }

        [MaxLength(500)]
        public string? BriefingVenue { get; set; }

        public DateTime? SiteVisitDate { get; set; }

        public DateTime? ClarificationDeadline { get; set; }

        [Required]
        public DateTime ClosingDate { get; set; }

        public DateTime? EvaluationDate { get; set; }

        public DateTime? AwardDate { get; set; }

        // Status
        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "Draft"; // Draft, Submitted, Clarification, Evaluation, Awarded, Lost, Cancelled

        [MaxLength(50)]
        public string? WorkflowStatus { get; set; } = "Draft"; // Draft, Review, DirectorSignoff, SubmissionReady

        // Submission Details
        public DateTime? SubmittedAt { get; set; }

        [MaxLength(100)]
        public string? SubmissionMethod { get; set; } // Email, Portal, Hand Delivery, Courier

        [MaxLength(500)]
        public string? SubmissionReference { get; set; }

        // Result
        [MaxLength(1000)]
        public string? ResultNotes { get; set; }

        [MaxLength(500)]
        public string? LossReason { get; set; }

        // Risk & Priority
        [MaxLength(20)]
        public string Priority { get; set; } = "Medium"; // Low, Medium, High, Critical

        public int? RiskScore { get; set; } // 1-100

        [MaxLength(500)]
        public string? RiskNotes { get; set; }

        // Metadata
        public int CreatedByUserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        // Navigation Properties
        public virtual ICollection<TenderDocument> Documents { get; set; } = new List<TenderDocument>();
        public virtual ICollection<TenderTeamMember> TeamMembers { get; set; } = new List<TenderTeamMember>();
        public virtual ICollection<TenderActivity> Activities { get; set; } = new List<TenderActivity>();
        public virtual ICollection<TenderBOQItem> BOQItems { get; set; } = new List<TenderBOQItem>();

        [ForeignKey("CreatedByUserId")]
        public virtual User? CreatedByUser { get; set; }
    }

    /// <summary>
    /// Documents attached to a tender
    /// </summary>
    public class TenderDocument
    {
        [Key]
        public int Id { get; set; }

        public int TenderId { get; set; }

        [Required]
        [MaxLength(200)]
        public string FileName { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? FilePath { get; set; }

        [MaxLength(50)]
        public string DocumentType { get; set; } = string.Empty; // RFQ, RFP, BOQ, Addendum, Submission, Pricing, Technical, SBD, Other

        [MaxLength(20)]
        public string? Version { get; set; }

        public long? FileSize { get; set; }

        [MaxLength(50)]
        public string? MimeType { get; set; }

        public bool IsEditable { get; set; } = true;

        public int UploadedByUserId { get; set; }

        [MaxLength(100)]
        public string? UploadedByUserName { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(500)]
        public string? Notes { get; set; }

        [ForeignKey("TenderId")]
        public virtual Tender? Tender { get; set; }
    }

    /// <summary>
    /// Team members assigned to a tender
    /// </summary>
    public class TenderTeamMember
    {
        [Key]
        public int Id { get; set; }

        public int TenderId { get; set; }

        public int? UserId { get; set; }

        [MaxLength(100)]
        public string? UserName { get; set; }

        [Required]
        [MaxLength(50)]
        public string Role { get; set; } = string.Empty; // Technical, Financial, Compliance, DirectorApproval, ProjectLead

        [MaxLength(30)]
        public string Status { get; set; } = "Pending"; // Pending, InProgress, Completed, Approved

        public DateTime? CompletedAt { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("TenderId")]
        public virtual Tender? Tender { get; set; }
    }

    /// <summary>
    /// Activity log for tender
    /// </summary>
    public class TenderActivity
    {
        [Key]
        public int Id { get; set; }

        public int TenderId { get; set; }

        [Required]
        [MaxLength(50)]
        public string ActivityType { get; set; } = string.Empty; // StatusChange, DocumentUpload, TeamAssignment, Comment, Submission, etc.

        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        public int? UserId { get; set; }

        [MaxLength(100)]
        public string? UserName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(1000)]
        public string? Metadata { get; set; } // JSON for additional data

        [ForeignKey("TenderId")]
        public virtual Tender? Tender { get; set; }
    }

    /// <summary>
    /// BOQ (Bill of Quantities) line items
    /// </summary>
    public class TenderBOQItem
    {
        [Key]
        public int Id { get; set; }

        public int TenderId { get; set; }

        public int LineNumber { get; set; }

        [MaxLength(100)]
        public string? ItemCode { get; set; }

        [Required]
        [MaxLength(500)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? Unit { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal Quantity { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? UnitCost { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal UnitPrice { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalPrice => Quantity * UnitPrice;

        [Column(TypeName = "decimal(18,2)")]
        public decimal? MarginPercent { get; set; }

        public bool IsBelowCost { get; set; }

        [MaxLength(200)]
        public string? Notes { get; set; }

        [ForeignKey("TenderId")]
        public virtual Tender? Tender { get; set; }
    }

    /// <summary>
    /// Reminder/notification linked to a tender event (Closing, Briefing, Site Visit, Clarification, Evaluation)
    /// </summary>
    public class TenderReminder
    {
        [Key]
        public int Id { get; set; }

        public int TenderId { get; set; }

        [Required]
        [MaxLength(50)]
        public string EventType { get; set; } = string.Empty; // ClosingDate, Briefing, SiteVisit, Clarification, Evaluation

        public DateTime EventDate { get; set; }

        public int DaysBefore { get; set; } = 3; // Number of days before the event to send reminder

        [MaxLength(1000)]
        public string? EmailRecipients { get; set; } // Comma-separated email addresses

        [MaxLength(500)]
        public string? Notes { get; set; }

        public bool IsSent { get; set; } = false;

        public DateTime? SentAt { get; set; }

        public bool IsActive { get; set; } = true;

        public int CreatedByUserId { get; set; }

        [MaxLength(100)]
        public string? CreatedByUserName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation
        [ForeignKey("TenderId")]
        public virtual Tender? Tender { get; set; }
    }
}
