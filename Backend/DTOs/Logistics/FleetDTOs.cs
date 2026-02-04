namespace ProjectTracker.API.DTOs.Logistics
{
    // Vehicle DTOs
    public class VehicleDto
    {
        public int Id { get; set; }
        public string RegistrationNumber { get; set; } = string.Empty;
        public string? VinNumber { get; set; }
        public string Make { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public int? Year { get; set; }
        public string? Color { get; set; }
        public int VehicleTypeId { get; set; }
        public string? VehicleTypeName { get; set; }
        public int? CurrentDriverId { get; set; }
        public string? CurrentDriverName { get; set; }
        public string? CarTrackId { get; set; }
        public string? CarTrackName { get; set; }
        
        // TFN Integration
        public string? TfnVehicleId { get; set; }
        public string? TfnSubAccountNumber { get; set; }
        public string? TfnVirtualCardNumber { get; set; }
        public decimal? TfnCreditLimit { get; set; }
        public decimal? TfnCurrentBalance { get; set; }
        public DateTime? TfnLastSyncedAt { get; set; }
        public decimal? TankSize { get; set; }
        public string? FuelType { get; set; }
        public decimal? AverageFuelConsumption { get; set; }
        
        // Live tracking data (from CarTrack)
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string? LastLocation { get; set; }
        public double? Speed { get; set; }
        public double? Heading { get; set; }
        public DateTime? LastUpdate { get; set; }
        public string? LiveStatus { get; set; }  // moving, stopped, idling, offline
        
        // Status flags
        public bool IsLinkedToCarTrack => !string.IsNullOrEmpty(CarTrackId);
        public bool IsLinkedToTfn => !string.IsNullOrEmpty(TfnVehicleId);
        
        public string Status { get; set; } = string.Empty;
        public decimal? FuelCapacity { get; set; }
        public decimal? CurrentOdometer { get; set; }
        public DateTime? LastServiceDate { get; set; }
        public decimal? NextServiceOdometer { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateVehicleDto
    {
        public string RegistrationNumber { get; set; } = string.Empty;
        public string? VinNumber { get; set; }
        public string Make { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public int? Year { get; set; }
        public string? Color { get; set; }
        public int VehicleTypeId { get; set; }
        public int? CurrentDriverId { get; set; }
        public string? CarTrackId { get; set; }
        public string? CarTrackName { get; set; }
        public decimal? FuelCapacity { get; set; }
        public decimal? CurrentOdometer { get; set; }
    }

    public class UpdateVehicleDto
    {
        public string? RegistrationNumber { get; set; }
        public string? VinNumber { get; set; }
        public string? Make { get; set; }
        public string? Model { get; set; }
        public int? Year { get; set; }
        public string? Color { get; set; }
        public int? VehicleTypeId { get; set; }
        public int? CurrentDriverId { get; set; }
        public string? CarTrackId { get; set; }
        public string? CarTrackName { get; set; }
        public string? Status { get; set; }
        public decimal? FuelCapacity { get; set; }
        public decimal? CurrentOdometer { get; set; }
        public DateTime? LastServiceDate { get; set; }
        public decimal? NextServiceOdometer { get; set; }
    }

    // Driver DTOs
    public class DriverDto
    {
        public int Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string FullName => $"{FirstName} {LastName}";
        public string LicenseNumber { get; set; } = string.Empty;
        public string LicenseType { get; set; } = string.Empty;
        public DateTime? LicenseExpiryDate { get; set; }
        public string? EmployeeNumber { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? DateOfBirth { get; set; }
        public DateTime? HireDate { get; set; }
    }

    public class CreateDriverDto
    {
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string LicenseNumber { get; set; } = string.Empty;
        public string LicenseType { get; set; } = string.Empty;
        public DateTime? LicenseExpiryDate { get; set; }
        public string? EmployeeNumber { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public DateTime? HireDate { get; set; }
    }

    public class UpdateDriverDto
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? LicenseNumber { get; set; }
        public string? LicenseType { get; set; }
        public DateTime? LicenseExpiryDate { get; set; }
        public string? EmployeeNumber { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }
        public string? Status { get; set; }
        public DateTime? DateOfBirth { get; set; }
        public DateTime? HireDate { get; set; }
    }

    // Customer DTOs
    public class CustomerDto
    {
        public int Id { get; set; }
        public string? CustomerCode { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ShortName { get; set; }
        public string? CompanyRegistration { get; set; }
        public string? VatNumber { get; set; }
        public string? ContactPerson { get; set; }
        public string? Email { get; set; }
        public string? ContactEmail { get; set; }
        public string? PhoneNumber { get; set; }
        public string? MobileNumber { get; set; }
        public string? Fax { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactFax { get; set; }
        public string? Address { get; set; }
        public string? PhysicalAddress { get; set; }
        public string? PostalAddress { get; set; }
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public string? Province { get; set; }
        public string? Country { get; set; }
        public List<string>? AddressLines { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? DeliveryCity { get; set; }
        public string? DeliveryProvince { get; set; }
        public string? DeliveryPostalCode { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? PaymentTerms { get; set; }
        public decimal? CreditLimit { get; set; }
        public DateTime? LastMaintained { get; set; }
        public string? SourceSystem { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateCustomerDto
    {
        public string? CustomerCode { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ShortName { get; set; }
        public string? CompanyRegistration { get; set; }
        public string? VatNumber { get; set; }
        public string? ContactPerson { get; set; }
        public string? Email { get; set; }
        public string? ContactEmail { get; set; }
        public string? PhoneNumber { get; set; }
        public string? MobileNumber { get; set; }
        public string? Fax { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactFax { get; set; }
        public string? PhysicalAddress { get; set; }
        public string? PostalAddress { get; set; }
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public string? Province { get; set; }
        public string? Country { get; set; }
        public List<string>? AddressLines { get; set; }
        public string? PaymentTerms { get; set; }
        public decimal? CreditLimit { get; set; }
    }

    // ==========================================
    // Customer Import DTOs (for ERP Integration)
    // ==========================================

    /// <summary>
    /// DTO for importing a customer from ERP system (matches the JSON structure)
    /// </summary>
    public class ImportCustomerDto
    {
        public string CustomerNumber { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? ShortName { get; set; }
        public string? LastMaintained { get; set; }
        public List<string>? AddressLines { get; set; }
        public string? Email { get; set; }
        public string? ContactEmail { get; set; }
        public string? Phone { get; set; }
        public string? Fax { get; set; }
        public string? Contact { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactFax { get; set; }
        public string? VatNo { get; set; }
    }

    /// <summary>
    /// DTO for bulk importing multiple customers
    /// </summary>
    public class BulkImportCustomersDto
    {
        public List<ImportCustomerDto> Customers { get; set; } = new();
        public string? SourceSystem { get; set; }
        public string? FileName { get; set; }
    }

    /// <summary>
    /// Response for customer import operation
    /// </summary>
    public class CustomerImportResultDto
    {
        public bool Success { get; set; }
        public string BatchId { get; set; } = string.Empty;
        public int TotalRecords { get; set; }
        public int CreatedRecords { get; set; }
        public int UpdatedRecords { get; set; }
        public int FailedRecords { get; set; }
        public List<string> Errors { get; set; } = new();
        public List<CustomerDto> ImportedCustomers { get; set; } = new();
    }

    /// <summary>
    /// Summary of customers in the system
    /// </summary>
    public class CustomerSummaryDto
    {
        public int TotalCustomers { get; set; }
        public int ActiveCustomers { get; set; }
        public int InactiveCustomers { get; set; }
        public int CustomersWithEmail { get; set; }
        public int CustomersWithPhone { get; set; }
        public int CustomersFromERP { get; set; }
    }

    // ==========================================
    // Customer Address Issues DTOs
    // ==========================================

    /// <summary>
    /// DTO for customers with address issues
    /// </summary>
    public class CustomerAddressIssueDto
    {
        public int Id { get; set; }
        public string? CustomerCode { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? ShortName { get; set; }
        public string? Address { get; set; }
        public string? PhysicalAddress { get; set; }
        public string? DeliveryAddress { get; set; }
        public string? City { get; set; }
        public string? DeliveryCity { get; set; }
        public string? Province { get; set; }
        public string? DeliveryProvince { get; set; }
        public string? PostalCode { get; set; }
        public string? DeliveryPostalCode { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public bool HasMissingAddress { get; set; }
        public bool HasMissingCity { get; set; }
        public bool HasMissingProvince { get; set; }
        public bool HasMissingCoordinates { get; set; }
    }

    /// <summary>
    /// Response for address issues query
    /// </summary>
    public class AddressIssuesResponseDto
    {
        public List<CustomerAddressIssueDto> Customers { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
    }

    /// <summary>
    /// DTO for updating customer address
    /// </summary>
    public class UpdateCustomerAddressDto
    {
        public string? DeliveryAddress { get; set; }
        public string? DeliveryCity { get; set; }
        public string? DeliveryProvince { get; set; }
        public string? DeliveryPostalCode { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
    }
}
