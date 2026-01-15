namespace ProjectTracker.API.DTOs.Users
{
    public class ExtensionInfoDto
    {
        public int ExtensionId { get; set; }
        public string ExtensionNumber { get; set; } = string.Empty;
        public string? Label { get; set; }
        public string? ExtensionType { get; set; }
        public bool IsPrimary { get; set; }
    }

    public class UserDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Surname { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? Permissions { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime? Birthday { get; set; }
        public string? PrimaryExtension { get; set; }
        public List<ExtensionInfoDto> Extensions { get; set; } = new();
    }

    public class UserProfileDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Surname { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? Permissions { get; set; }
        public int? DepartmentId { get; set; }
        public string? DepartmentName { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public bool IsActive { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? Birthday { get; set; }
        public string? PrimaryExtension { get; set; }
        public List<ExtensionInfoDto> Extensions { get; set; } = new();
    }

    public class UpdateProfileDto
    {
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Title { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime? Birthday { get; set; }
    }

    public class ChangePasswordDto
    {
        public string CurrentPassword { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class UserListDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Surname { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? DepartmentName { get; set; }
        public bool IsActive { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime? Birthday { get; set; }
        public string? PrimaryExtension { get; set; }
    }

    public class UserDetailDto : UserDto
    {
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateUserDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Surname { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Role { get; set; } = "Employee";
        public string? Title { get; set; }
        public string? Permissions { get; set; }
        public int? DepartmentId { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public DateTime? Birthday { get; set; }
        public int? ExtensionId { get; set; } // Link an existing extension during user creation
    }

    public class UpdateUserDto
    {
        public string? Name { get; set; }
        public string? Surname { get; set; }
        public string? Email { get; set; }
        public string? Role { get; set; }
        public string? Title { get; set; }
        public string? Permissions { get; set; }
        public int? DepartmentId { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public bool? IsActive { get; set; }
        public DateTime? Birthday { get; set; }
    }

    public class ResetPasswordDto
    {
        public string NewPassword { get; set; } = string.Empty;
    }

    public class UserBirthdayDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Surname { get; set; }
        public DateTime Birthday { get; set; }
        public string? DepartmentName { get; set; }
        public string? ProfilePictureUrl { get; set; }
    }
}
