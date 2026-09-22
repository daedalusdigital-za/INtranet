using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// A trip sheet drafted by a sales agent. It follows a two-stage workflow:
    ///   Stage 1 (Create)  - a sales agent builds the trip sheet -> Status = "PendingApproval"
    ///   Stage 2 (Check)   - a DIFFERENT sales agent checks/signs/approves it -> Status = "Approved"
    /// Only once approved is it pushed into the logistics module (a Load is created)
    /// so it appears in the logistics Tripsheets tab.
    /// </summary>
    public class SalesTripSheet
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string TripSheetNumber { get; set; } = string.Empty; // e.g. STS-000001

        [MaxLength(50)]
        public string Status { get; set; } = "PendingApproval"; // PendingSignature, PendingApproval, Approved, Rejected

        // Header / meta
        [MaxLength(50)]
        public string? WarehouseCode { get; set; }   // GP, CPT, KZN, etc.

        public int? WarehouseId { get; set; }

        [MaxLength(200)]
        public string? RouteArea { get; set; }        // free text route/area description

        public DateTime? ScheduledDate { get; set; }

        [MaxLength(2000)]
        public string? Notes { get; set; }

        // Stage 1 - Created by (the sales agent who built it)
        public int? CreatedByUserId { get; set; }

        [MaxLength(200)]
        public string? CreatedByName { get; set; }

        // Signer (the agent responsible for the sheet — usually the creator)
        public int? SignerUserId { get; set; }

        [MaxLength(200)]
        public string? SignerName { get; set; }

        // Designated approver (the DIFFERENT agent who must check & sign it)
        public int? ApproverUserId { get; set; }

        [MaxLength(200)]
        public string? ApproverName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Stage 1b - Signed by the designated signer (a colleague) before it goes for approval
        public int? SignedByUserId { get; set; }

        [MaxLength(200)]
        public string? SignedByName { get; set; }

        public DateTime? SignedAt { get; set; }

        // Stage 2 - Checked / signed / approved by (a DIFFERENT sales agent)
        public int? CheckedByUserId { get; set; }

        [MaxLength(200)]
        public string? CheckedByName { get; set; }

        public DateTime? CheckedAt { get; set; }

        [MaxLength(2000)]
        public string? ApprovalNotes { get; set; }

        [MaxLength(2000)]
        public string? RejectionReason { get; set; }

        // Link to the logistics Load created on approval
        public int? ConvertedLoadId { get; set; }

        [MaxLength(50)]
        public string? ConvertedLoadNumber { get; set; }

        // Lines
        public virtual ICollection<SalesTripSheetLine> Lines { get; set; } = new List<SalesTripSheetLine>();
    }

    /// <summary>
    /// A single delivery line/stop on a sales trip sheet.
    /// </summary>
    public class SalesTripSheetLine
    {
        [Key]
        public int Id { get; set; }

        public int SalesTripSheetId { get; set; }

        public int Sequence { get; set; }

        [MaxLength(200)]
        public string? CustomerName { get; set; }

        [MaxLength(100)]
        public string? InvoiceNumber { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(100)]
        public string? Province { get; set; }

        [MaxLength(100)]
        public string? ContactPerson { get; set; }

        [MaxLength(50)]
        public string? ContactPhone { get; set; }

        [MaxLength(500)]
        public string? ProductDescription { get; set; }

        public decimal Quantity { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Value { get; set; }

        [ForeignKey("SalesTripSheetId")]
        public virtual SalesTripSheet? SalesTripSheet { get; set; }
    }
}
