using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics.TFN
{
    /// <summary>
    /// TruckFuelNet Depot/Fuel Point
    /// </summary>
    public class TfnDepot
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string TfnDepotId { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Code { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(100)]
        public string? Province { get; set; }

        [MaxLength(20)]
        public string? PostalCode { get; set; }

    [Column(TypeName = "decimal(18,2)")]
    public decimal? Latitude { get; set; }
    
    [Column(TypeName = "decimal(18,2)")]
    public decimal? Longitude { get; set; }

        [MaxLength(200)]
        public string? ContactPerson { get; set; }

        [MaxLength(50)]
        public string? ContactPhone { get; set; }

        [MaxLength(100)]
        public string? ContactEmail { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? LastSyncedAt { get; set; }

        // Navigation
        public virtual ICollection<TfnTransaction> Transactions { get; set; } = new List<TfnTransaction>();
    }
}
