using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/asset-register")]
    [Authorize]
    public class AssetRegisterController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AssetRegisterController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET api/asset-register/locations
        [HttpGet("locations")]
        public async Task<ActionResult<IEnumerable<object>>> GetLocations()
        {
            var locations = await _context.AssetRegisterLocations
                .AsNoTracking()
                .Select(l => new
                {
                    l.LocationId,
                    l.Region,
                    l.SubLocation,
                    l.DisplayName,
                    l.SourceFile,
                    AssetCount = _context.AssetRegisterItems.Count(i => i.LocationId == l.LocationId && i.IsActive)
                })
                .OrderBy(l => l.Region)
                .ThenBy(l => l.SubLocation)
                .ThenBy(l => l.DisplayName)
                .ToListAsync();

            return Ok(locations);
        }

        // GET api/asset-register/items?region=KZN&subLocation=Main Building&locationId=1&category=Computer&search=dell&assignedTo=John
        [HttpGet("items")]
        public async Task<ActionResult<IEnumerable<object>>> GetItems(
            [FromQuery] string? region = null,
            [FromQuery] string? subLocation = null,
            [FromQuery] int? locationId = null,
            [FromQuery] string? category = null,
            [FromQuery] string? search = null,
            [FromQuery] string? assignedTo = null,
            [FromQuery] bool activeOnly = true)
        {
            var query = _context.AssetRegisterItems
                .AsNoTracking()
                .Include(i => i.Location)
                .AsQueryable();

            if (activeOnly) query = query.Where(i => i.IsActive);
            if (locationId.HasValue) query = query.Where(i => i.LocationId == locationId.Value);
            if (!string.IsNullOrWhiteSpace(region)) query = query.Where(i => i.Location != null && i.Location.Region == region);
            if (!string.IsNullOrWhiteSpace(subLocation)) query = query.Where(i => i.Location != null && i.Location.SubLocation == subLocation);
            if (!string.IsNullOrWhiteSpace(category)) query = query.Where(i => i.Category == category);
            if (!string.IsNullOrWhiteSpace(assignedTo)) query = query.Where(i => i.AssignedTo != null && i.AssignedTo == assignedTo);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                query = query.Where(i =>
                    (i.AssignedTo != null && i.AssignedTo.ToLower().Contains(s)) ||
                    (i.Model != null && i.Model.ToLower().Contains(s)) ||
                    (i.SerialNumber != null && i.SerialNumber.ToLower().Contains(s)) ||
                    (i.Category.ToLower().Contains(s)) ||
                    (i.AssetCode != null && i.AssetCode.ToLower().Contains(s)) ||
                    (i.Manufacturer != null && i.Manufacturer.ToLower().Contains(s)));
            }

            var items = await query
                .OrderBy(i => i.Location!.DisplayName)
                .ThenBy(i => i.AssignedTo)
                .ThenBy(i => i.Category)
                .Select(i => new
                {
                    i.ItemId,
                    i.LocationId,
                    LocationName = i.Location != null ? i.Location.DisplayName : "",
                    Region = i.Location != null ? i.Location.Region : "",
                    SubLocation = i.Location != null ? i.Location.SubLocation : "",
                    i.AssetCode,
                    i.AssignedTo,
                    i.Workstation,
                    i.Category,
                    i.Manufacturer,
                    i.Model,
                    i.SerialNumber,
                    i.Specification,
                    i.Condition,
                    i.OwnershipType,
                    i.Notes,
                    i.IsActive
                })
                .ToListAsync();

            return Ok(items);
        }

        // GET api/asset-register/assigned-users
        [HttpGet("assigned-users")]
        public async Task<ActionResult<IEnumerable<string>>> GetAssignedUsers()
        {
            var users = await _context.AssetRegisterItems
                .AsNoTracking()
                .Where(i => i.IsActive && i.AssignedTo != null && i.AssignedTo != "")
                .Select(i => i.AssignedTo!)
                .Distinct()
                .OrderBy(u => u)
                .ToListAsync();
            return Ok(users);
        }

        // GET api/asset-register/summary
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary()
        {
            var byRegion = await _context.AssetRegisterLocations
                .AsNoTracking()
                .GroupJoin(
                    _context.AssetRegisterItems.Where(i => i.IsActive),
                    l => l.LocationId,
                    i => i.LocationId,
                    (l, items) => new { l.Region, AssetCount = items.Count() })
                .GroupBy(x => x.Region)
                .Select(g => new
                {
                    Region = g.Key,
                    LocationCount = g.Count(),
                    AssetCount = g.Sum(x => x.AssetCount)
                })
                .ToListAsync();

            var byCategory = await _context.AssetRegisterItems
                .AsNoTracking()
                .Where(i => i.IsActive)
                .GroupBy(i => i.Category)
                .Select(g => new { Category = g.Key, Count = g.Count() })
                .OrderByDescending(g => g.Count)
                .ToListAsync();

            var totalAssets = await _context.AssetRegisterItems.CountAsync(i => i.IsActive);

            return Ok(new { totalAssets, byRegion, byCategory });
        }

        // GET api/asset-register/items/{id}
        [HttpGet("items/{id}")]
        public async Task<ActionResult<object>> GetItem(int id)
        {
            var item = await _context.AssetRegisterItems
                .AsNoTracking()
                .Include(i => i.Location)
                .Where(i => i.ItemId == id)
                .Select(i => new
                {
                    i.ItemId, i.LocationId,
                    LocationName = i.Location != null ? i.Location.DisplayName : "",
                    Region = i.Location != null ? i.Location.Region : "",
                    SubLocation = i.Location != null ? i.Location.SubLocation : "",
                    i.AssetCode, i.AssignedTo, i.Workstation, i.Category,
                    i.Manufacturer, i.Model, i.SerialNumber, i.Specification,
                    i.Condition, i.OwnershipType, i.Notes, i.IsActive, i.CreatedAt, i.UpdatedAt
                })
                .FirstOrDefaultAsync();

            if (item == null) return NotFound();
            return Ok(item);
        }

        // PUT api/asset-register/items/{id}
        [HttpPut("items/{id}")]
        public async Task<IActionResult> UpdateItem(int id, [FromBody] UpdateAssetDto dto)
        {
            var item = await _context.AssetRegisterItems.FindAsync(id);
            if (item == null) return NotFound();

            if (dto.AssignedTo != null) item.AssignedTo = dto.AssignedTo;
            if (dto.Model != null) item.Model = dto.Model;
            if (dto.SerialNumber != null) item.SerialNumber = dto.SerialNumber;
            if (dto.Condition != null) item.Condition = dto.Condition;
            if (dto.Notes != null) item.Notes = dto.Notes;
            if (dto.Category != null) item.Category = dto.Category;
            if (dto.Manufacturer != null) item.Manufacturer = dto.Manufacturer;
            if (dto.Workstation != null) item.Workstation = dto.Workstation;
            if (dto.IsActive.HasValue) item.IsActive = dto.IsActive.Value;
            item.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Asset updated" });
        }

        // POST api/asset-register/items
        [HttpPost("items")]
        public async Task<IActionResult> CreateItem([FromBody] CreateAssetDto dto)
        {
            var location = await _context.AssetRegisterLocations.FindAsync(dto.LocationId);
            if (location == null) return BadRequest(new { message = "Location not found" });

            var item = new AssetRegisterItem
            {
                LocationId = dto.LocationId,
                AssetCode = dto.AssetCode,
                AssignedTo = dto.AssignedTo,
                Workstation = dto.Workstation,
                Category = dto.Category,
                Manufacturer = dto.Manufacturer,
                Model = dto.Model,
                SerialNumber = dto.SerialNumber,
                Specification = dto.Specification,
                Condition = dto.Condition ?? "Not Assessed",
                OwnershipType = dto.OwnershipType ?? "Assigned",
                Notes = dto.Notes,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.AssetRegisterItems.Add(item);
            await _context.SaveChangesAsync();
            return Ok(new { item.ItemId, message = "Asset created" });
        }

        // DELETE api/asset-register/items/{id}
        [HttpDelete("items/{id}")]
        public async Task<IActionResult> DeleteItem(int id)
        {
            var item = await _context.AssetRegisterItems.FindAsync(id);
            if (item == null) return NotFound();
            item.IsActive = false;
            item.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Asset deactivated" });
        }
    }

    public class UpdateAssetDto
    {
        public string? AssignedTo { get; set; }
        public string? Category { get; set; }
        public string? Manufacturer { get; set; }
        public string? Model { get; set; }
        public string? SerialNumber { get; set; }
        public string? Workstation { get; set; }
        public string? Condition { get; set; }
        public string? Notes { get; set; }
        public bool? IsActive { get; set; }
    }

    public class CreateAssetDto
    {
        public int LocationId { get; set; }
        public string? AssetCode { get; set; }
        public string? AssignedTo { get; set; }
        public string? Workstation { get; set; }
        public string Category { get; set; } = string.Empty;
        public string? Manufacturer { get; set; }
        public string? Model { get; set; }
        public string? SerialNumber { get; set; }
        public string? Specification { get; set; }
        public string? Condition { get; set; }
        public string? OwnershipType { get; set; }
        public string? Notes { get; set; }
    }
}
