namespace ProjectTracker.API.DTOs
{
    public class EmailAccountDto
    {
        public int EmailAccountId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public string? Department { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class CreateEmailAccountDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string? DisplayName { get; set; }
        public string? Department { get; set; }
    }

    public class UpdateEmailAccountDto
    {
        public string? Email { get; set; }
        public string? Password { get; set; }
        public string? DisplayName { get; set; }
        public string? Department { get; set; }
        public bool? IsActive { get; set; }
    }
}
