using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance.Creditors;
using ProjectTracker.API.Security;
using ProjectTracker.API.Services;
using ProjectTracker.API.Services.Finance;

namespace ProjectTracker.API.Controllers.Finance;

/// <summary>
/// Sign-in for the executive approvals portal (off-site directors / accountants / treasurer).
///
/// Two steps: password → 6-digit code e-mailed to the user's intranet address → short-lived exec token
/// (see <see cref="ExecAuth"/>). Only people who actually hold a creditors approval role can sign in here;
/// everyone else gets the same generic error as a wrong password.
/// </summary>
[ApiController]
[Route("api/exec/auth")]
[AllowAnonymous]
[EnableRateLimiting(PortalRateLimiting.AuthPolicy)]
public class ExecAuthController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IExecTokenService _tokens;
    private readonly IEmailService _email;
    private readonly IConfiguration _cfg;
    private readonly IMemoryCache _cache;
    private readonly ILogger<ExecAuthController> _log;
    private const string DummyHash = "$2a$11$8Qk1hQp0Zb3xq3YQ0z3yHe3Yl0pq6Xk8C0sVx0bF5mN9nUeS0dC5G";

    public ExecAuthController(ApplicationDbContext db, IExecTokenService tokens, IEmailService email, IConfiguration cfg, IMemoryCache cache, ILogger<ExecAuthController> log)
    { _db = db; _tokens = tokens; _email = email; _cfg = cfg; _cache = cache; _log = log; }

    public record LoginDto(string Email, string Password);
    public record VerifyDto(string Challenge, string Code);

    private static readonly string[] ApprovalRoles = { CreditorWorkflow.RoleAccountant, CreditorWorkflow.RoleDirector, CreditorWorkflow.RoleBank, "*" };

    private sealed class CodeTries { public int Attempts; }

    // The challenge is signed, not stored: "{userId}.{expiresUnix}.{nonce}.{tag}" where tag = HMAC(secret, payload + code).
    // A backend restart or redeploy between the e-mail and the code therefore no longer loses the sign-in.
    // Only the attempt counter and the single-use marker live in memory.
    private byte[] Secret() => System.Text.Encoding.UTF8.GetBytes("exec-code|" + ExecAuth.SigningKey(_cfg));

    private string Tag(string payload, string code)
    {
        using var h = new HMACSHA256(Secret());
        return Convert.ToHexString(h.ComputeHash(System.Text.Encoding.UTF8.GetBytes(payload + "|" + code))).ToLowerInvariant();
    }

    private string NewChallenge(int userId, string code)
    {
        var exp = DateTimeOffset.UtcNow.AddMinutes(10).ToUnixTimeSeconds();
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant();
        var payload = $"{userId}.{exp}.{nonce}";
        return $"{payload}.{Tag(payload, code)}";
    }

    private static bool TryReadChallenge(string? challenge, out int userId, out string nonce)
    {
        userId = 0; nonce = "";
        var p = (challenge ?? "").Split('.');
        if (p.Length != 4 || !int.TryParse(p[0], out userId) || !long.TryParse(p[1], out var exp)) return false;
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp) return false;
        nonce = p[2];
        return nonce.Length > 0;
    }

    private bool CodeMatches(string challenge, string code)
    {
        var i = challenge.LastIndexOf('.');
        var expected = Tag(challenge[..i], code);
        return CryptographicOperations.FixedTimeEquals(System.Text.Encoding.ASCII.GetBytes(expected), System.Text.Encoding.ASCII.GetBytes(challenge[(i + 1)..]));
    }

    /// <summary>Step 1: e-mail + password. Returns a challenge id (code e-mailed) or, when codes are disabled, the token.</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginDto dto)
    {
        var email = (dto.Email ?? "").Trim().ToLowerInvariant();
        var u = await _db.Users.Include(x => x.Department).FirstOrDefaultAsync(x => x.Email.ToLower() == email && x.IsActive);
        var generic = Unauthorized(new { message = "E-mail or password is incorrect, or this account cannot approve payments." });
        if (u == null) { try { BCrypt.Net.BCrypt.Verify(dto.Password ?? "", DummyHash); } catch { } return generic; }

        var lockKey = $"exec-lock:{u.UserId}";
        if (_cache.TryGetValue<int>(lockKey, out var strikes) && strikes >= 5)
            return StatusCode(423, new { message = "Too many attempts. Try again in 15 minutes." });

        bool ok; try { ok = BCrypt.Net.BCrypt.Verify(dto.Password ?? "", u.PasswordHash); } catch { ok = false; }
        if (!ok) { _cache.Set(lockKey, strikes + 1, TimeSpan.FromMinutes(15)); return generic; }

        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, u.UserId.ToString()), new Claim(ClaimTypes.Role, u.Role) }, "check"));
        var perms = await FinanceAuthority.EffectiveAsync(_db, principal);
        var isAdmin = u.Role is "Admin" or "Super Admin";
        if (!isAdmin && !ApprovalRoles.Any(perms.Contains))
        {
            _log.LogWarning("Exec portal: {Email} signed in correctly but holds no approval role", u.Email);
            return generic;
        }
        _cache.Remove(lockKey);

        if (!ExecAuth.RequireCode(_cfg))
        {
            var (tok, exp) = _tokens.Issue(u);
            return Ok(Session(u, tok, exp));
        }

        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("000000");
        var id = NewChallenge(u.UserId, code);

        var html = $@"<div style='font-family:Segoe UI,Arial,sans-serif;max-width:480px'>
<p>Hi {System.Net.WebUtility.HtmlEncode(u.Name)},</p>
<p>Your sign-in code for the <strong>payment approvals portal</strong> is</p>
<p style='font-size:32px;letter-spacing:8px;font-weight:700;margin:16px 0'>{code}</p>
<p style='color:#555'>It expires in 10 minutes. If you did not try to sign in, ignore this e-mail — nobody can get in without your password <em>and</em> this code.</p>
<p style='color:#999;font-size:12px'>Request from {HttpContext.Connection.RemoteIpAddress} at {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC</p></div>";
        if (!await _email.SendEmailAsync(u.Email, $"{code} is your approvals sign-in code", html))
        {
            _log.LogError("Exec portal: could not e-mail code to {Email}: {Err}", u.Email, _email.LastError);
            return StatusCode(503, new { message = "We couldn't e-mail your sign-in code right now. Please try again shortly." });
        }
        return Ok(new { challenge = id, emailHint = Mask(u.Email), expiresInSeconds = 600 });
    }

    /// <summary>Step 2: the e-mailed code → exec token.</summary>
    [HttpPost("verify")]
    public async Task<IActionResult> Verify([FromBody] VerifyDto dto)
    {
        var expired = Unauthorized(new { message = "That code has expired. Sign in again." });
        if (!TryReadChallenge(dto.Challenge, out var userId, out var nonce)) return expired;
        if (_cache.TryGetValue($"exec-chal-used:{nonce}", out _)) return expired;
        var tries = _cache.GetOrCreate($"exec-chal-tries:{nonce}", e => { e.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(11); return new CodeTries(); })!;
        if (tries.Attempts >= 5) return Unauthorized(new { message = "Too many wrong codes. Sign in again." });
        var code = new string((dto.Code ?? "").Where(char.IsDigit).ToArray());
        if (!CodeMatches(dto.Challenge, code))
        {
            if (Interlocked.Increment(ref tries.Attempts) >= 5) return Unauthorized(new { message = "Too many wrong codes. Sign in again." });
            return Unauthorized(new { message = "That code is not right. Check the e-mail and try again." });
        }
        _cache.Set($"exec-chal-used:{nonce}", true, TimeSpan.FromMinutes(11));
        var u = await _db.Users.FirstOrDefaultAsync(x => x.UserId == userId && x.IsActive);
        if (u == null) return Unauthorized(new { message = "Account unavailable." });
        u.LastLoginAt = DateTime.UtcNow; await _db.SaveChangesAsync();
        var (tok, exp) = _tokens.Issue(u);
        _log.LogInformation("Exec portal: {Email} signed in from {Ip}", u.Email, HttpContext.Connection.RemoteIpAddress);
        return Ok(Session(u, tok, exp));
    }

    private object Session(Models.User u, string token, DateTime expiresAt) => new
    {
        token, expiresAt, user = new { u.UserId, name = $"{u.Name} {u.Surname}".Trim(), u.Email, u.Role, hasSignature = u.SignatureImageData != null }
    };

    private static string Mask(string e)
    {
        var at = e.IndexOf('@'); if (at < 2) return "your e-mail";
        return e[..2] + new string('•', Math.Max(2, at - 2)) + e[at..];
    }
}
