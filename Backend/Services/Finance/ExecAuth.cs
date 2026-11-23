using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Services.Finance
{
    /// <summary>
    /// Executive approvals portal (exec-portal/ on Azure Static Web Apps → portal-edge → here).
    ///
    /// Directors / accountants / treasurer approve creditor payment packs from outside the LAN.
    /// The exec token carries the SAME identity claims as an intranet token (so every creditors
    /// permission check behaves identically) but a DIFFERENT audience, and the bearer scheme only
    /// accepts it on the small allow-list in <see cref="Allows"/>. An exec token therefore cannot be
    /// used to edit packs, download bank files, or touch any other module — on the LAN or off it.
    ///
    /// Configuration (optional):
    ///   Exec:Audience    – default "&lt;JwtSettings:Audience&gt;-exec"
    ///   Exec:TokenHours  – default 4
    ///   Exec:PublicUrl   – https://… of the exec portal; used in approval e-mails when set
    ///   Exec:RequireCode – default true: 6-digit e-mailed code on every sign-in
    /// </summary>
    public static class ExecAuth
    {
        public const string Scheme = "Exec";
        public const string ClaimScope = "scope";
        public const string ScopeValue = "exec";

        public static string Audience(IConfiguration c) => c["Exec:Audience"] ?? $"{c["JwtSettings:Audience"]}-exec";
        public static string SigningKey(IConfiguration c) => c["JwtSettings:SecretKey"] ?? throw new InvalidOperationException("JwtSettings:SecretKey missing");
        public static int TokenHours(IConfiguration c) => int.TryParse(c["Exec:TokenHours"], out var h) && h > 0 ? h : 4;
        public static bool RequireCode(IConfiguration c) => !string.Equals(c["Exec:RequireCode"], "false", StringComparison.OrdinalIgnoreCase);
        public static string? PublicUrl(IConfiguration c) => string.IsNullOrWhiteSpace(c["Exec:PublicUrl"]) ? null : c["Exec:PublicUrl"]!.TrimEnd('/');

        /// <summary>Paths an exec token (and the public edge) may reach. Everything else is 404 / 401.</summary>
        public static bool Allows(PathString path, string method)
        {
            var p = path.Value ?? "";
            var get = HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method);
            var post = HttpMethods.IsPost(method) || HttpMethods.IsOptions(method);
            if (p.StartsWith("/api/exec/", StringComparison.OrdinalIgnoreCase)) return true;
            if (p.Equals("/health", StringComparison.OrdinalIgnoreCase)) return get;
            if (p.Equals("/api/users/me/signature", StringComparison.OrdinalIgnoreCase)) return get;
            const string cr = "/api/finance/creditors";
            if (!p.StartsWith(cr, StringComparison.OrdinalIgnoreCase)) return false;
            var rest = p[cr.Length..];
            if (rest is "/meta" or "/inbox") return get;
            // /batches/{id}, /batches/{id}/review-pack.pdf, /batches/{id}/approval-sheet.pdf, /batches/{id}/documents/{docId}/file
            var seg = rest.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (seg.Length < 2 || seg[0] != "batches" || !int.TryParse(seg[1], out _)) return false;
            if (seg.Length == 2) return get;
            if (seg.Length == 3 && seg[2] is "review-pack.pdf" or "approval-sheet.pdf" or "signed-pack.pdf" or "schedule.pdf") return get;
            if (seg.Length == 5 && seg[2] == "documents" && int.TryParse(seg[3], out _) && seg[4] == "file") return get;
            if (seg.Length == 5 && seg[2] == "items" && int.TryParse(seg[3], out _) && seg[4] == "decision") return post;
            if (seg.Length == 3 && seg[2] == "sign") return post;
            if (seg.Length == 3 && seg[2] == "accountant") return post;
            return false;
        }

        public static void Configure(JwtBearerOptions options, IConfiguration config)
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = config["JwtSettings:Issuer"],
                ValidAudience = Audience(config),
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(SigningKey(config))),
                ClockSkew = TimeSpan.FromMinutes(1)
            };
            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = ctx =>
                {
                    var req = ctx.HttpContext.Request;
                    if (!Allows(req.Path, req.Method)) ctx.Fail("This token is only valid for the executive approvals surface.");
                    return Task.CompletedTask;
                }
            };
        }
    }

    public interface IExecTokenService
    {
        (string token, DateTime expiresAt) Issue(User user);
    }

    public class ExecTokenService : IExecTokenService
    {
        private readonly IConfiguration _config;
        public ExecTokenService(IConfiguration config) => _config = config;

        public (string token, DateTime expiresAt) Issue(User user)
        {
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new(ClaimTypes.Email, user.Email),
                new(ClaimTypes.Name, user.Name),
                new(ClaimTypes.Role, user.Role),
                new(ExecAuth.ClaimScope, ExecAuth.ScopeValue),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N"))
            };
            if (user.DepartmentId.HasValue) claims.Add(new Claim("DepartmentId", user.DepartmentId.Value.ToString()));
            var expires = DateTime.UtcNow.AddHours(ExecAuth.TokenHours(_config));
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ExecAuth.SigningKey(_config)));
            var jwt = new JwtSecurityToken(
                issuer: _config["JwtSettings:Issuer"],
                audience: ExecAuth.Audience(_config),
                claims: claims,
                expires: expires,
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
            return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
        }
    }
}
