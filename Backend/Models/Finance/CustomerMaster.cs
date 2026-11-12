using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Finance
{
    /// <summary>
    /// One real-world customer (a hospital, a depot, a pharmacy group) regardless of how many Sage
    /// account codes it has across Promed Technologies, Access Medical, Pharmatech and Sebenzani.
    /// Aliases map each (company, customer code) to the master so sales, aging, credits, remittances,
    /// PODs, backorders and loads can be rolled up to a single Customer 360 view.
    /// </summary>
    [Table("CustomerMasters")]
    public class CustomerMaster
    {
        public int Id { get; set; }
        [Required, MaxLength(255)] public string Name { get; set; } = string.Empty;
        /// <summary>Upper-cased, punctuation-stripped, legal-suffix-stripped name used for auto-matching.</summary>
        [Required, MaxLength(255)] public string NormalizedName { get; set; } = string.Empty;
        /// <summary>Optional parent group (e.g. "Netcare", "Gauteng DoH").</summary>
        [MaxLength(150)] public string? Group { get; set; }
        /// <summary>Hospital | Depot | Pharmacy | Clinic | Distributor | Other</summary>
        [MaxLength(50)] public string? Type { get; set; }
        [MaxLength(100)] public string? Province { get; set; }
        [MaxLength(1000)] public string? Notes { get; set; }
        /// <summary>Link to the logistics Customer record when one exists.</summary>
        public int? LogisticsCustomerId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public virtual ICollection<CustomerAlias> Aliases { get; set; } = new List<CustomerAlias>();
    }

    /// <summary>A Sage account (company + customer code) belonging to a master customer.</summary>
    [Table("CustomerAliases")]
    public class CustomerAlias
    {
        public int Id { get; set; }
        public int CustomerMasterId { get; set; }
        /// <summary>PMT / ACM / PHT / SBT</summary>
        [Required, MaxLength(10)] public string Company { get; set; } = string.Empty;
        [Required, MaxLength(50)] public string CustomerCode { get; set; } = string.Empty;
        [MaxLength(255)] public string? CustomerName { get; set; }
        /// <summary>Auto (matched on name) | Manual (set by a user)</summary>
        [Required, MaxLength(10)] public string Source { get; set; } = "Auto";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        [ForeignKey(nameof(CustomerMasterId))] public virtual CustomerMaster Master { get; set; } = null!;
    }
}
