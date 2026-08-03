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
        Task<LoginResponseDto?> RefreshAsync(string refreshToken, string? clientId = null);
        Task RevokeRefreshTokenAsync(string refreshToken);
    }

    public class AuthService : IAuthService
    {
        private readonly ApplicationDbContext _context;
        private readonly ITokenService _tokenService;
        private readonly ILogger<AuthService> _logger;

        public AuthService(ApplicationDbContext context, ITokenService tokenService, ILogger<AuthService> logger)
        {
            _context = context;
            _tokenService = tokenService;
            _logger = logger;
        }

        public async Task<LoginResponseDto?> LoginAsync(LoginDto loginDto)
        {
            _logger.LogDebug("Login attempt for email: {Email}", loginDto.Email);
            
            var user = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.Email == loginDto.Email && u.IsActive);

            if (user == null)
            {
                _logger.LogWarning("User not found or inactive for email: {Email}", loginDto.Email);
                return null;
            }

            _logger.LogDebug("User found: {Email}", user.Email);

            // Verify password using BCrypt only
            bool passwordValid = false;
            if (user.PasswordHash.StartsWith("$2"))
            {
                passwordValid = BCrypt.Net.BCrypt.Verify(loginDto.Password, user.PasswordHash);
            }
            else
            {
                // Password not hashed — reject and log a warning so it can be corrected
                _logger.LogWarning("User {Email} has an unhashed password stored. Login denied. Please re-hash this user's password.", user.Email);
                passwordValid = false;
            }

            _logger.LogDebug("Password valid: {IsValid}", passwordValid);

            if (!passwordValid)
            {
                return null;
            }

            // Update last login time
            user.LastLoginAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var token = _tokenService.GenerateToken(user);
            var refreshToken = await CreateRefreshTokenAsync(user.UserId, null);

            return new LoginResponseDto
            {
                Token = token,
                RefreshToken = refreshToken,
                AccessTokenExpiresAt = DateTime.UtcNow.AddHours(24),
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

        // ---- Refresh token support ----
        private async Task<string> CreateRefreshTokenAsync(int userId, string? clientId)
        {
            var bytes = new byte[64];
            using (var rng = System.Security.Cryptography.RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            var tokenValue = Convert.ToBase64String(bytes)
                .Replace("+", "-").Replace("/", "_").Replace("=", "");

            _context.RefreshTokens.Add(new RefreshToken
            {
                UserId = userId,
                Token = tokenValue,
                ExpiresAt = DateTime.UtcNow.AddDays(14),
                IsRevoked = false,
                CreatedAt = DateTime.UtcNow,
                ClientId = clientId
            });
            await _context.SaveChangesAsync();
            return tokenValue;
        }

        public async Task<LoginResponseDto?> RefreshAsync(string refreshToken, string? clientId = null)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return null;

            var existing = await _context.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.Token == refreshToken);

            if (existing == null || existing.IsRevoked || existing.ExpiresAt <= DateTime.UtcNow)
            {
                return null;
            }

            var user = await _context.Users
                .Include(u => u.Department)
                .FirstOrDefaultAsync(u => u.UserId == existing.UserId && u.IsActive);

            if (user == null) return null;

            // Rotate: revoke old token, issue a new one
            existing.IsRevoked = true;
            await _context.SaveChangesAsync();

            var token = _tokenService.GenerateToken(user);
            var newRefresh = await CreateRefreshTokenAsync(user.UserId, clientId ?? existing.ClientId);

            return new LoginResponseDto
            {
                Token = token,
                RefreshToken = newRefresh,
                AccessTokenExpiresAt = DateTime.UtcNow.AddHours(24),
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

        public async Task RevokeRefreshTokenAsync(string refreshToken)
        {
            if (string.IsNullOrWhiteSpace(refreshToken)) return;
            var existing = await _context.RefreshTokens
                .FirstOrDefaultAsync(rt => rt.Token == refreshToken);
            if (existing != null && !existing.IsRevoked)
            {
                existing.IsRevoked = true;
                await _context.SaveChangesAsync();
            }
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
