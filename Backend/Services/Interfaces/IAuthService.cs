using ProjectTracker.API.DTOs;

namespace ProjectTracker.API.Services.Interfaces
{
    public interface IAuthService
    {
        Task<LoginResponseDto?> LoginAsync(LoginDto loginDto);
        Task<UserDto?> RegisterAsync(RegisterDto registerDto);
        string GenerateToken(int userId, string name, string email, string role);
    }
}
