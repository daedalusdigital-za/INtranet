using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Controllers;

/// <summary>
/// Company logos and letterheads, uploaded by an admin in Admin settings › Company branding.
/// One file per company per kind, kept under <c>uploads/branding/{CODE}/{kind}.{ext}</c> (the
/// uploads folder is a mounted volume, so files survive redeploys). Any signed-in user can read
/// them; only admins can upload or remove.
/// </summary>
[Authorize]
[ApiController]
[Route("api/company-branding")]
public class CompanyBrandingController : ControllerBase
{
    private const long MaxBytes = 15 * 1024 * 1024;
    private static readonly Dictionary<string, string[]> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        ["logo"] = new[] { ".png", ".jpg", ".jpeg", ".webp" },
        ["letterhead"] = new[] { ".png", ".jpg", ".jpeg", ".webp", ".pdf", ".docx" },
    };
    private static readonly FileExtensionContentTypeProvider ContentTypes = new();

    private readonly ApplicationDbContext _db;
    private readonly ILogger<CompanyBrandingController> _log;
    public CompanyBrandingController(ApplicationDbContext db, ILogger<CompanyBrandingController> log) { _db = db; _log = log; }

    private static string Root => Path.Combine(Directory.GetCurrentDirectory(), "uploads", "branding");
    private static string? Find(string code, string kind)
    {
        var dir = Path.Combine(Root, code);
        return Directory.Exists(dir) ? Directory.EnumerateFiles(dir, kind + ".*").FirstOrDefault() : null;
    }
    private static object? Describe(string code, string kind)
    {
        var path = Find(code, kind);
        if (path == null) return null;
        var fi = new FileInfo(path);
        return new { fileName = $"{code}-{kind}{fi.Extension}", extension = fi.Extension.ToLowerInvariant(), size = fi.Length, updatedAt = fi.LastWriteTimeUtc, isImage = fi.Extension.ToLowerInvariant() is ".png" or ".jpg" or ".jpeg" or ".webp" };
    }
    /// <summary>The company's code exactly as stored, or null — also keeps anything odd out of the file path.</summary>
    private async Task<(string Code, string Name)?> CompanyAsync(string code)
    {
        var c = await _db.CreditorCompanies.AsNoTracking().Where(x => x.Code == code).Select(x => new { x.Code, x.Name }).FirstOrDefaultAsync();
        return c == null ? null : (c.Code, c.Name);
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var companies = await _db.CreditorCompanies.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ThenBy(c => c.Name).Select(c => new { c.Code, c.Name }).ToListAsync();
        return Ok(companies.Select(c => new { code = c.Code, name = c.Name, logo = Describe(c.Code, "logo"), letterhead = Describe(c.Code, "letterhead") }));
    }

    [HttpGet("{code}/{kind}")]
    public async Task<IActionResult> Download(string code, string kind)
    {
        if (!Allowed.ContainsKey(kind)) return NotFound();
        var co = await CompanyAsync(code); if (co == null) return NotFound();
        var path = Find(co.Value.Code, kind.ToLowerInvariant()); if (path == null) return NotFound();
        if (!ContentTypes.TryGetContentType(path, out var type)) type = "application/octet-stream";
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return PhysicalFile(path, type, $"{co.Value.Code}-{kind.ToLowerInvariant()}{Path.GetExtension(path)}");
    }

    [HttpPost("{code}/{kind}")]
    [Authorize(Roles = AppRoles.Admins)]
    [RequestSizeLimit(MaxBytes)]
    public async Task<IActionResult> Upload(string code, string kind, IFormFile? file)
    {
        if (!Allowed.TryGetValue(kind, out var exts)) return BadRequest(new { message = "Kind must be logo or letterhead." });
        var co = await CompanyAsync(code); if (co == null) return BadRequest(new { message = "Unknown company." });
        if (file == null || file.Length == 0) return BadRequest(new { message = "Choose a file to upload." });
        if (file.Length > MaxBytes) return BadRequest(new { message = "The file is larger than 15 MB." });
        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!exts.Contains(ext)) return BadRequest(new { message = $"A {kind} must be one of: {string.Join(", ", exts)}." });

        kind = kind.ToLowerInvariant();
        var dir = Path.Combine(Root, co.Value.Code);
        Directory.CreateDirectory(dir);
        var target = Path.Combine(dir, kind + ext);
        var temp = target + ".uploading";
        await using (var fs = System.IO.File.Create(temp)) await file.CopyToAsync(fs);
        // Replace only once the new file is fully written, so a failed upload never loses the current one.
        foreach (var old in Directory.EnumerateFiles(dir, kind + ".*").Where(p => !p.EndsWith(".uploading")).ToList()) System.IO.File.Delete(old);
        System.IO.File.Move(temp, target);
        _log.LogInformation("Company branding: {Kind} for {Company} uploaded by {User} ({Bytes} bytes)", kind, co.Value.Code, User.Identity?.Name, file.Length);
        return Ok(Describe(co.Value.Code, kind));
    }

    [HttpDelete("{code}/{kind}")]
    [Authorize(Roles = AppRoles.Admins)]
    public async Task<IActionResult> Remove(string code, string kind)
    {
        if (!Allowed.ContainsKey(kind)) return NotFound();
        var co = await CompanyAsync(code); if (co == null) return NotFound();
        var path = Find(co.Value.Code, kind.ToLowerInvariant()); if (path == null) return NotFound();
        System.IO.File.Delete(path);
        _log.LogInformation("Company branding: {Kind} for {Company} removed by {User}", kind, co.Value.Code, User.Identity?.Name);
        return NoContent();
    }
}
