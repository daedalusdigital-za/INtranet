using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    public class LoadStop
    {
        [Key]
        public int Id { get; set; }

        public int LoadId { get; set; }
        public int? CustomerId { get; set; }
        public int? WarehouseId { get; set; }

        public int StopSequence { get; set; }

        [MaxLength(50)]
        public string StopType { get; set; } = "Delivery"; // Pickup, Delivery, Stop, Destination

        // Location
        [MaxLength(200)]
        public string? LocationName { get; set; }

        [MaxLength(200)]
        public string? CompanyName { get; set; }

        [Required]
        [MaxLength(500)]
        public string Address { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(100)]
        public string? Province { get; set; }

        [MaxLength(20)]
        public string? PostalCode { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? Latitude { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? Longitude { get; set; }

        // Contact
        [MaxLength(100)]
        public string? ContactPerson { get; set; }

        [MaxLength(20)]
        public string? ContactPhone { get; set; }

        [MaxLength(200)]
        public string? ContactEmail { get; set; }

        // Reference Numbers
        [MaxLength(100)]
        public string? OrderNumber { get; set; }

        [MaxLength(100)]
        public string? InvoiceNumber { get; set; }

        // Timing
        public DateTime? ScheduledArrival { get; set; }
        public DateTime? ActualArrival { get; set; }
        public DateTime? ActualDeparture { get; set; }

        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, EnRoute, Arrived, Completed, Skipped

        [MaxLength(1000)]
        public string? Notes { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        [ForeignKey("LoadId")]
        public virtual Load Load { get; set; } = null!;

        [ForeignKey("CustomerId")]
        public virtual Customer? Customer { get; set; }

        [ForeignKey("WarehouseId")]
        public virtual Warehouse? Warehouse { get; set; }

        public virtual ICollection<StopCommodity> Commodities { get; set; } = new List<StopCommodity>();
    }
}
