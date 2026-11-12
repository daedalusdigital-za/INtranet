using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    /// <summary>
    /// The stock side of a credit note. When a credit is reasoned as Return or Damaged, goods physically came
    /// back (or were written off at the customer), so a pending return is raised for the branch to confirm.
    /// Confirming posts the ledger movement (Return → stock, Damaged → written off) against the CN reference.
    /// Pricing / short-delivery / goodwill credits never touch stock and raise no return.
    /// </summary>
    [Table("StockReturns")]
    public class StockReturn
    {
        public int Id { get; set; }
        [Required, MaxLength(50)] public string CreditNoteNumber { get; set; } = string.Empty;
        /// <summary>PMT / ACM / PHT / SBT</summary>
        [MaxLength(10)] public string? Company { get; set; }
        [MaxLength(50)] public string? CustomerNumber { get; set; }
        [MaxLength(255)] public string? CustomerName { get; set; }
        public int? CreditNoteDocumentId { get; set; }
        /// <summary>Return (goods back to shelf) | Damaged (goods written off) | Expired (written off)</summary>
        [Required, MaxLength(20)] public string ReturnType { get; set; } = "Return";
        /// <summary>Pending | Confirmed | Rejected</summary>
        [Required, MaxLength(20)] public string Status { get; set; } = "Pending";
        /// <summary>Branch warehouse the goods came back to (chosen when confirming).</summary>
        public int? WarehouseId { get; set; }
        [MaxLength(1000)] public string? Notes { get; set; }
        public int CreatedBy { get; set; }
        [MaxLength(150)] public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public int? ConfirmedBy { get; set; }
        [MaxLength(150)] public string? ConfirmedByName { get; set; }
        public DateTime? ConfirmedAt { get; set; }
        public virtual ICollection<StockReturnLine> Lines { get; set; } = new List<StockReturnLine>();
    }

    [Table("StockReturnLines")]
    public class StockReturnLine
    {
        public int Id { get; set; }
        public int StockReturnId { get; set; }
        [Required, MaxLength(50)] public string ProductCode { get; set; } = string.Empty;
        [MaxLength(500)] public string? ProductDescription { get; set; }
        [Column(TypeName = "decimal(18,4)")] public decimal Quantity { get; set; }
        /// <summary>Quantity actually received/confirmed by the branch (defaults to Quantity).</summary>
        [Column(TypeName = "decimal(18,4)")] public decimal? ConfirmedQuantity { get; set; }
        public int? CommodityId { get; set; }
        /// <summary>Ledger movement posted on confirmation.</summary>
        public int? MovementId { get; set; }
        [ForeignKey(nameof(StockReturnId))] public virtual StockReturn Return { get; set; } = null!;
    }
}
