using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// The signed-in person's Home page layout. The layout is an opaque JSON document owned by the
    /// front end (widget list, sizes, shortcuts); the server only stores it per user.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/home")]
    public class HomeLayoutController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public HomeLayoutController(ApplicationDbContext db) { _db = db; }

        private int Uid => User.GetUserId() ?? 0;

        /// <summary>Returns the saved layout, or null when the person has never customised Home.</summary>
        [HttpGet("layout")]
        public async Task<IActionResult> GetLayout()
        {
            var row = await _db.UserHomeLayouts.AsNoTracking().FirstOrDefaultAsync(l => l.UserId == Uid);
            if (row == null) return Ok(new { layout = (JsonElement?)null, updatedAt = (DateTime?)null });
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(row.LayoutJson) ? "{}" : row.LayoutJson);
            return Ok(new { layout = doc.RootElement.Clone(), updatedAt = row.UpdatedAt });
        }

        [HttpPut("layout")]
        public async Task<IActionResult> SaveLayout([FromBody] JsonElement layout)
        {
            if (Uid == 0) return Unauthorized();
            var json = layout.ValueKind == JsonValueKind.Undefined || layout.ValueKind == JsonValueKind.Null ? "{}" : layout.GetRawText();
            if (json.Length > 200_000) return BadRequest(new { message = "Layout is too large." });

            var row = await _db.UserHomeLayouts.FirstOrDefaultAsync(l => l.UserId == Uid);
            if (row == null) { row = new UserHomeLayout { UserId = Uid }; _db.UserHomeLayouts.Add(row); }
            row.LayoutJson = json;
            row.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { updatedAt = row.UpdatedAt });
        }

        /// <summary>Forgets the saved layout so Home goes back to the default for the person's permissions.</summary>
        [HttpDelete("layout")]
        public async Task<IActionResult> ResetLayout()
        {
            var row = await _db.UserHomeLayouts.FirstOrDefaultAsync(l => l.UserId == Uid);
            if (row != null) { _db.UserHomeLayouts.Remove(row); await _db.SaveChangesAsync(); }
            return NoContent();
        }
    }
}
