using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// Stores multiple delivery addresses for a customer.
    /// Addresses are saved when creating tripsheets for future reuse.
    /// </summary>
    public class CustomerDeliveryAddress
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int CustomerId { get; set; }

        /// <summary>
        /// User-friendly label for the address (e.g., "Main Warehouse", "Store #5", "Head Office")
        /// </summary>
        [MaxLength(100)]
        public string? AddressLabel { get; set; }

        /// <summary>
        /// Full delivery address
        /// </summary>
        [Required]
        [MaxLength(500)]
        public string Address { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(100)]
        public string? Province { get; set; }

        [MaxLength(20)]
        public string? PostalCode { get; set; }

        [MaxLength(100)]
        public string? Country { get; set; } = "South Africa";

        /// <summary>
        /// Contact person at this delivery location
        /// </summary>
        [MaxLength(100)]
        public string? ContactPerson { get; set; }

        /// <summary>
        /// Contact phone number for this delivery location
        /// </summary>
        [MaxLength(50)]
        public string? ContactPhone { get; set; }

        /// <summary>
        /// GPS Latitude from Google Maps geocoding
        /// </summary>
        public double? Latitude { get; set; }

        /// <summary>
        /// GPS Longitude from Google Maps geocoding
        /// </summary>
        public double? Longitude { get; set; }

        /// <summary>
        /// Google Place ID for address verification
        /// </summary>
        [MaxLength(100)]
        public string? GooglePlaceId { get; set; }

        /// <summary>
        /// Formatted address from Google Maps geocoding
        /// </summary>
        [MaxLength(500)]
        public string? FormattedAddress { get; set; }

        /// <summary>
        /// Whether this is the default/primary delivery address for the customer
        /// </summary>
        public bool IsDefault { get; set; } = false;

        /// <summary>
        /// Whether this address is currently active/usable
        /// </summary>
        public bool IsActive { get; set; } = true;

        /// <summary>
        /// Special delivery instructions for this location
        /// </summary>
        [MaxLength(1000)]
        public string? DeliveryInstructions { get; set; }

        /// <summary>
        /// Number of times this address has been used in tripsheets
        /// </summary>
        public int UsageCount { get; set; } = 0;

        /// <summary>
        /// Last time this address was used in a tripsheet
        /// </summary>
        public DateTime? LastUsedAt { get; set; }

        /// <summary>
        /// User who created/saved this address
        /// </summary>
        public int? CreatedByUserId { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation property
        [ForeignKey("CustomerId")]
        public virtual Customer? Customer { get; set; }
    }
}
