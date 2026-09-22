using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Junction table allowing one POD scan to be linked to multiple invoices.
    /// The InvoiceNumber is always stored (as typed/normalised). InvoiceId is
    /// nullable so a POD can be tagged with an invoice number BEFORE that invoice
    /// has been imported — the importer may be running behind while staff back-fill
    /// PODs. A reconciliation pass later fills InvoiceId once the invoice arrives.
    /// </summary>
    public class PodDocumentInvoiceLink
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PodDocumentId { get; set; }

        /// <summary>
        /// The matched invoice, if it exists yet. Null when the invoice number has
        /// been tagged but the invoice has not been imported (pending reconciliation).
        /// </summary>
        public int? InvoiceId { get; set; }

        /// <summary>
        /// The invoice number as typed/normalised. Retained even when InvoiceId is
        /// null so unmatched (pending) invoices can be reconciled later.
        /// </summary>
        [MaxLength(100)]
        public string? InvoiceNumber { get; set; }

        public DateTime LinkedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("PodDocumentId")]
        public virtual PodDocument? PodDocument { get; set; }

        [ForeignKey("InvoiceId")]
        public virtual ImportedInvoice? Invoice { get; set; }
    }
}
