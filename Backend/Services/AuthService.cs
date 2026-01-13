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
            Console.WriteLine($"[AUTH] Login attempt for email: '{loginDto.Email}'");
            
            var user = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Email == loginDto.Email && u.IsActive);

            if (user == null)
            {
                Console.WriteLine($"[AUTH] User not found or inactive for email: '{loginDto.Email}'");
                return null;
            }

            Console.WriteLine($"[AUTH] User found: {user.Email}, PasswordHash starts with: '{user.PasswordHash.Substring(0, Math.Min(10, user.PasswordHash.Length))}'");

            // Verify password - support both plain text (for dev) and BCrypt hashed
            bool passwordValid = false;
            
            // Check if password is BCrypt hashed (starts with $2)
            if (user.PasswordHash.StartsWith("$2"))
            {
                Console.WriteLine("[AUTH] Using BCrypt verification");
                passwordValid = BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash);
            }
            else
            {
                Console.WriteLine($"[AUTH] Using plain text comparison: '{user.PasswordHash}' == '{loginDto.Password}'");
                // Plain text comparison (for development/testing)
                passwordValid = user.PasswordHash == loginDto.Password;
            }

            Console.WriteLine($"[AUTH] Password valid: {passwordValid}");

            if (!passwordValid)
            {
                return null;
            }

            // Update last login time
            user.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var token = _tokenService.GenerateToken(user);

            return new LoginResponseDto
            {
                Token = token,
                User = new UserDto
                {
                    UserId = user.UserId,
                    Name = user.Name,
                    Surname = user.Surname,
                    Email = user.Email,
                    Role = user.Role,
                    Title = user.Title,
                    Permissions = user.Permissions,
                    DepartmentId = user.DepartmentId,
                    DepartmentName = user.Department?.Name,
                    ProfilePictureUrl = user.ProfilePictureUrl,
                    LastLoginAt = user.LastLoginAt
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
