namespace ProjectTracker.API.DTOs
{
    public class ExtensionDto
    {
        public int ExtensionId { get; set; }
        public string ExtensionNumber { get; set; } = string.Empty;
        public string? Label { get; set; }
        public string? ExtensionType { get; set; }
        public string? Description { get; set; }
        public int? UserId { get; set; }
        public string? UserName { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public string? PbxDeviceId { get; set; }
        public string? MacAddress { get; set; }
        public string? PhoneModel { get; set; }
        public string? Location { get; set; }
        public bool IsActive { get; set; }
        public bool IsPrimary { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class ExtensionSummaryDto
    {
        public int ExtensionId { get; set; }
        public string ExtensionNumber { get; set; } = string.Empty;
        public string? Label { get; set; }
        public string? ExtensionType { get; set; }
        public bool IsPrimary { get; set; }
    }

    public class CreateExtensionDto
    {
        public string ExtensionNumber { get; set; } = string.Empty;
        public string? Label { get; set; }
        public string? ExtensionType { get; set; }
        public string? Description { get; set; }
        public int? UserId { get; set; }
        public int? DepartmentId { get; set; }
        public string? PbxDeviceId { get; set; }
        public string? MacAddress { get; set; }
        public string? PhoneModel { get; set; }
        public string? Location { get; set; }
        public bool IsPrimary { get; set; } = false;
    }

    public class UpdateExtensionDto
    {
        public string? ExtensionNumber { get; set; }
        public string? Label { get; set; }
        public string? ExtensionType { get; set; }
        public string? Description { get; set; }
        public int? UserId { get; set; }
        public int? DepartmentId { get; set; }
        public string? PbxDeviceId { get; set; }
        public string? MacAddress { get; set; }
        public string? PhoneModel { get; set; }
        public string? Location { get; set; }
        public bool? IsActive { get; set; }
        public bool? IsPrimary { get; set; }
    }

    public class AssignExtensionDto
    {
        public int? UserId { get; set; }
        public bool IsPrimary { get; set; } = false;
    }
}
