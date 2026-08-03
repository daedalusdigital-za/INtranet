namespace ProjectTracker.API.DTOs.Auth
{
    public class LoginDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string? RefreshToken { get; set; }
        public DateTime? AccessTokenExpiresAt { get; set; }
        public UserDto User { get; set; } = null!;
    }

    public class RefreshRequestDto
    {
        public string RefreshToken { get; set; } = string.Empty;
        public string? ClientId { get; set; }
    }

    public class RegisterDto
    {
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = "Employee";
        public int? DepartmentId { get; set; }
    }
}
