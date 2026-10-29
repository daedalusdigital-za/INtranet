using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using ProjectTracker.API.Models.Logistics.Shipments;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Settings shared by the portal bearer scheme and the portal token issuer.
    /// Configuration (all optional):
    ///   Portal:Audience   – defaults to "&lt;JwtSettings:Audience&gt;-portal"
    ///   Portal:SecretKey  – defaults to JwtSettings:SecretKey (audience still separates the two)
    ///   Portal:TokenHours – defaults to 12
    /// </summary>
    public static class PortalAuth
    {
        public const string Scheme = "Portal";
        public const string ClaimPortalUserId = "portal_uid";
        public const string ClaimCustomerId = "portal_cid";
        public const string ClaimScope = "scope";
        public const string ScopeValue = "portal";

        public static string Audience(IConfiguration c) => c["Portal:Audience"] ?? $"{c["JwtSettings:Audience"]}-portal";
        public static string SigningKey(IConfiguration c) => c["Portal:SecretKey"] ?? c["JwtSettings:SecretKey"] ?? throw new InvalidOperationException("JwtSettings:SecretKey missing");
        public static int TokenHours(IConfiguration c) => int.TryParse(c["Portal:TokenHours"], out var h) && h > 0 ? h : 12;
    }

    public interface IPortalTokenService
    {
        (string token, DateTime expiresAt) Issue(PortalUser user);
    }

    public class PortalTokenService : IPortalTokenService
    {
        private readonly IConfiguration _config;
        public PortalTokenService(IConfiguration config) => _config = config;

        public (string token, DateTime expiresAt) Issue(PortalUser user)
        {
            // Deliberately NOT ClaimTypes.NameIdentifier: intranet controllers read that claim as an
            // intranet user id, and a portal id must never be mistaken for one.
            var claims = new List<Claim>
            {
                new(PortalAuth.ClaimScope, PortalAuth.ScopeValue),
                new(PortalAuth.ClaimPortalUserId, user.Id.ToString()),
                new(PortalAuth.ClaimCustomerId, user.CustomerId.ToString()),
                new(ClaimTypes.Email, user.Email),
                new("name", user.Name),
                new("portal_role", user.Role),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
            };
            var expires = DateTime.UtcNow.AddHours(PortalAuth.TokenHours(_config));
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(PortalAuth.SigningKey(_config)));
            var jwt = new JwtSecurityToken(
                issuer: _config["JwtSettings:Issuer"],
                audience: PortalAuth.Audience(_config),
                claims: claims,
                expires: expires,
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
            return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
        }
    }
}
