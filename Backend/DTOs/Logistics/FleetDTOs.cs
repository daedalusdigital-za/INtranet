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
        public string Name { get; set; } = string.Empty;
        public string? CompanyRegistration { get; set; }
        public string? VatNumber { get; set; }
        public string? ContactPerson { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? MobileNumber { get; set; }
        public string? PhysicalAddress { get; set; }
        public string? PostalAddress { get; set; }
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public string? Province { get; set; }
        public string? Country { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? PaymentTerms { get; set; }
        public decimal? CreditLimit { get; set; }
    }

    public class CreateCustomerDto
    {
        public string Name { get; set; } = string.Empty;
        public string? CompanyRegistration { get; set; }
        public string? VatNumber { get; set; }
        public string? ContactPerson { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? MobileNumber { get; set; }
        public string? PhysicalAddress { get; set; }
        public string? PostalAddress { get; set; }
        public string? City { get; set; }
        public string? PostalCode { get; set; }
        public string? Province { get; set; }
        public string? Country { get; set; }
        public string? PaymentTerms { get; set; }
        public decimal? CreditLimit { get; set; }
    }
}
