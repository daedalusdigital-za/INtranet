using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.DTOs.Logistics
{
    // DTO for returning customer delivery address data
    public class CustomerDeliveryAddressDto
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        public string? CustomerName { get; set; }
        public string? AddressLabel { get; set; }
        public string Address { get; set; } = string.Empty;
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public string? Country { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string? GooglePlaceId { get; set; }
        public string? FormattedAddress { get; set; }
        public bool IsDefault { get; set; }
        public bool IsActive { get; set; }
        public string? DeliveryInstructions { get; set; }
        public int UsageCount { get; set; }
        public DateTime? LastUsedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // DTO for creating a new delivery address
    public class CreateCustomerDeliveryAddressDto
    {
        [Required]
        public int CustomerId { get; set; }

        [MaxLength(100)]
        public string? AddressLabel { get; set; }

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

        [MaxLength(100)]
        public string? ContactPerson { get; set; }

        [MaxLength(50)]
        public string? ContactPhone { get; set; }

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        [MaxLength(100)]
        public string? GooglePlaceId { get; set; }

        [MaxLength(500)]
        public string? FormattedAddress { get; set; }

        public bool IsDefault { get; set; } = false;

        [MaxLength(1000)]
        public string? DeliveryInstructions { get; set; }
    }

    // DTO for updating an existing delivery address
    public class UpdateCustomerDeliveryAddressDto
    {
        [MaxLength(100)]
        public string? AddressLabel { get; set; }

        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(100)]
        public string? Province { get; set; }

        [MaxLength(20)]
        public string? PostalCode { get; set; }

        [MaxLength(100)]
        public string? ContactPerson { get; set; }

        [MaxLength(50)]
        public string? ContactPhone { get; set; }

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        [MaxLength(100)]
        public string? GooglePlaceId { get; set; }

        [MaxLength(500)]
        public string? FormattedAddress { get; set; }

        public bool? IsDefault { get; set; }
        public bool? IsActive { get; set; }

        [MaxLength(1000)]
        public string? DeliveryInstructions { get; set; }
    }

    // DTO for saving address during tripsheet creation (simpler version)
    public class SaveDeliveryAddressDto
    {
        [Required]
        public int CustomerId { get; set; }

        /// <summary>
        /// Customer name (for lookup if customerId is 0)
        /// </summary>
        public string? CustomerName { get; set; }

        /// <summary>
        /// Customer code/number (for lookup if customerId is 0)
        /// </summary>
        public string? CustomerCode { get; set; }

        [MaxLength(100)]
        public string? AddressLabel { get; set; }

        [Required]
        [MaxLength(500)]
        public string Address { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? City { get; set; }

        [MaxLength(100)]
        public string? Province { get; set; }

        public double? Latitude { get; set; }
        public double? Longitude { get; set; }

        [MaxLength(500)]
        public string? FormattedAddress { get; set; }

        [MaxLength(100)]
        public string? GooglePlaceId { get; set; }
    }

    // DTO for batch saving multiple addresses at once (e.g., when creating tripsheet)
    public class BatchSaveDeliveryAddressesDto
    {
        [Required]
        public List<SaveDeliveryAddressDto> Addresses { get; set; } = new();
    }
}
