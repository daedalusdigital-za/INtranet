using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;
using BCrypt.Net;

namespace ProjectTracker.API.Services
{
    public interface IAuthService
    {
        Task<LoginResponseDto?> LoginAsync(LoginDto loginDto);
        Task<UserDto?> RegisterAsync(RegisterDto registerDto);
        string GenerateToken(int userId, string name, string email, string role);
    }

    public class AuthService : IAuthService
    {
        private readonly ApplicationDbContext _context;
        private readonly ITokenService _tokenService;

        public AuthService(ApplicationDbContext context, ITokenService tokenService)
        {
            _context = context;
            _tokenService = tokenService;
        }

        public async Task<LoginResponseDto?> LoginAsync(LoginDto loginDto)
        {
            var user = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Email == loginDto.Email);

            if (user == null)
            {
                return null;
            }

            // Verify password using BCrypt
            if (!BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash))
            {
                return null;
            }

            var token = _tokenService.GenerateToken(user);

            return new LoginResponseDto
            {
                Token = token,
                User = new UserDto
                {
                    UserId = user.UserId,
                    Name = user.Name,
                    Email = user.Email,
                    Role = user.Role,
                    DepartmentId = user.DepartmentId,
                    DepartmentName = user.Department?.Name
                }
            };
        }

        public async Task<UserDto?> RegisterAsync(RegisterDto registerDto)
        {
            // Check if user already exists
            if (await _context.Users.AnyAsync(u => u.Email == registerDto.Email))
            {
                return null;
            }

            var user = new User
            {
                Name = registerDto.Name,
                Email = registerDto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(registerDto.Password),
                Role = registerDto.Role,
                DepartmentId = registerDto.DepartmentId,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return new UserDto
            {
                UserId = user.UserId,
                Name = user.Name,
                Email = user.Email,
                Role = user.Role,
                DepartmentId = user.DepartmentId
            };
        }

        public string GenerateToken(int userId, string name, string email, string role)
        {
            var user = new User
            {
                UserId = userId,
                Name = name,
                Email = email,
                Role = role
            };
            return _tokenService.GenerateToken(user);
        }
    }
}
