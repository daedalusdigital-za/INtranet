using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Saved hand signatures. Admins upload one for any user (Settings › Users); a user may upload/replace their own.
    /// The image is stamped onto documents the person signs on the intranet (payment packs, approval sheets).
    /// </summary>
    [ApiController]
    [Route("api/users")]
    [Authorize]
    public class UserSignaturesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IAuditLogService _audit;
        private const long MaxBytes = 2L * 1024 * 1024;

        public UserSignaturesController(ApplicationDbContext db, IAuditLogService audit) { _db = db; _audit = audit; }

        private int Me => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
        private bool IsAdmin => User.IsInRole("Admin") || User.IsInRole("Super Admin");

        /// <summary>The signed-in user's own saved signature (image) — 404 if none.</summary>
        [HttpGet("me/signature")]
        public Task<IActionResult> Mine() => Image(Me);

        [HttpGet("me/signature/status")]
        public async Task<IActionResult> MyStatus()
        {
            var u = await _db.Users.AsNoTracking().Where(x => x.UserId == Me).Select(x => new { has = x.SignatureImageData != null, x.SignatureUpdatedAt }).FirstOrDefaultAsync();
            return Ok(new { hasSignature = u?.has ?? false, updatedAt = u?.SignatureUpdatedAt });
        }

        [HttpGet("{id:int}/signature")]
        public async Task<IActionResult> Image(int id)
        {
            var u = await _db.Users.AsNoTracking().Where(x => x.UserId == id).Select(x => new { x.SignatureImageData, x.SignatureImageMimeType, x.SignatureUpdatedAt }).FirstOrDefaultAsync();
            if (u?.SignatureImageData == null) return NotFound();
            Response.Headers.CacheControl = "private, max-age=60";
            return File(u.SignatureImageData, u.SignatureImageMimeType ?? "image/png");
        }

        /// <summary>Upload / replace a signature image (PNG or JPEG, ≤2 MB). Admins for anyone; users for themselves.</summary>
        [HttpPut("{id:int}/signature")]
        [RequestSizeLimit(4 * 1024 * 1024)]
        public async Task<IActionResult> Upload(int id, IFormFile? file, [FromForm] string? imageBase64)
        {
            if (id != Me && !IsAdmin) return Forbid();
            var u = await _db.Users.FirstOrDefaultAsync(x => x.UserId == id);
            if (u == null) return NotFound();

            byte[]? bytes = null; string mime = "image/png";
            if (file != null && file.Length > 0)
            {
                if (file.Length > MaxBytes) return BadRequest(new { message = "Signature image must be 2 MB or smaller." });
                mime = (file.ContentType ?? "").ToLowerInvariant();
                if (mime != "image/png" && mime != "image/jpeg" && mime != "image/jpg" && mime != "image/webp") return BadRequest(new { message = "Upload a PNG or JPEG of the signature (transparent PNG works best)." });
                using var ms = new MemoryStream(); await file.CopyToAsync(ms); bytes = ms.ToArray();
            }
            else if (!string.IsNullOrWhiteSpace(imageBase64))
            {
                try { bytes = Convert.FromBase64String(imageBase64.Split(',').Last()); } catch { return BadRequest(new { message = "Invalid image data." }); }
                if (bytes.Length > MaxBytes) return BadRequest(new { message = "Signature image must be 2 MB or smaller." });
            }
            if (bytes == null || bytes.Length == 0) return BadRequest(new { message = "No signature image supplied." });

            u.SignatureImageData = bytes; u.SignatureImageMimeType = mime; u.SignatureUpdatedAt = DateTime.UtcNow; u.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            try { await _audit.LogAsync("UserSignatureUpdated", "Users", "User", id, $"Signature image {(id == Me ? "uploaded by user" : "uploaded by admin")}"); } catch { }
            return Ok(new { hasSignature = true, updatedAt = u.SignatureUpdatedAt });
        }

        [HttpDelete("{id:int}/signature")]
        public async Task<IActionResult> Remove(int id)
        {
            if (id != Me && !IsAdmin) return Forbid();
            var u = await _db.Users.FirstOrDefaultAsync(x => x.UserId == id);
            if (u == null) return NotFound();
            u.SignatureImageData = null; u.SignatureImageMimeType = null; u.SignatureUpdatedAt = null; u.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            try { await _audit.LogAsync("UserSignatureRemoved", "Users", "User", id, "Signature image removed"); } catch { }
            return NoContent();
        }
    }
}
