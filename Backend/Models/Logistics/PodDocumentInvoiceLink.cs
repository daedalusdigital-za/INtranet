using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Junction table allowing one POD scan to be linked to multiple invoices.
    /// </summary>
    public class PodDocumentInvoiceLink
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int PodDocumentId { get; set; }

        [Required]
        public int InvoiceId { get; set; }

        public DateTime LinkedAt { get; set; } = DateTime.UtcNow;

        [ForeignKey("PodDocumentId")]
        public virtual PodDocument? PodDocument { get; set; }

        [ForeignKey("InvoiceId")]
        public virtual ImportedInvoice? Invoice { get; set; }
    }
}
