using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/scrap")]
    public class ScrapController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ScrapController> _logger;

        public ScrapController(ApplicationDbContext context, ILogger<ScrapController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/logistics/scrap?warehouseId=1
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetScrapRecords([FromQuery] int? warehouseId)
        {
            try
            {
                var query = _context.ScrapRecords
                    .Include(s => s.Warehouse)
                    .Include(s => s.Commodity)
                    .Include(s => s.User)
                    .AsQueryable();

                if (warehouseId.HasValue)
                {
                    query = query.Where(s => s.WarehouseId == warehouseId.Value);
                }

                var scrapRecords = await query
                    .OrderByDescending(s => s.ScrapDate)
                    .Select(s => new
                    {
                        s.Id,
                        s.WarehouseId,
                        WarehouseName = s.Warehouse.Name,
                        s.CommodityId,
                        CommodityName = s.Commodity.Name,
                        s.Quantity,
                        s.Reason,
                        s.Notes,
                        s.ScrapDate,
                        s.CreatedAt,
                        RecordedBy = s.User != null ? s.User.Name : "Unknown"
                    })
                    .ToListAsync();

                return Ok(scrapRecords);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving scrap records");
                return StatusCode(500, new { message = "An error occurred while retrieving scrap records" });
            }
        }

        // GET: api/logistics/scrap/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetScrapRecord(int id)
        {
            try
            {
                var scrapRecord = await _context.ScrapRecords
                    .Include(s => s.Warehouse)
                    .Include(s => s.Commodity)
                    .Include(s => s.User)
                    .Where(s => s.Id == id)
                    .Select(s => new
                    {
                        s.Id,
                        s.WarehouseId,
                        WarehouseName = s.Warehouse.Name,
                        s.CommodityId,
                        CommodityName = s.Commodity.Name,
                        s.Quantity,
                        s.Reason,
                        s.Notes,
                        s.ScrapDate,
                        s.CreatedAt,
                        RecordedBy = s.User != null ? s.User.Name : "Unknown"
                    })
                    .FirstOrDefaultAsync();

                if (scrapRecord == null)
                {
                    return NotFound(new { message = "Scrap record not found" });
                }

                return Ok(scrapRecord);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving scrap record {Id}", id);
                return StatusCode(500, new { message = "An error occurred while retrieving the scrap record" });
            }
        }

        // POST: api/logistics/scrap
        [HttpPost]
        public async Task<ActionResult<object>> CreateScrapRecord([FromBody] ScrapRecordDto dto)
        {
            try
            {
                // Validate warehouse exists
                var warehouse = await _context.Warehouses.FindAsync(dto.WarehouseId);
                if (warehouse == null)
                {
                    return BadRequest(new { message = "Warehouse not found" });
                }

                // Validate commodity exists
                var commodity = await _context.Commodities.FindAsync(dto.CommodityId);
                if (commodity == null)
                {
                    return BadRequest(new { message = "Commodity not found" });
                }

                // Check if there's enough inventory
                var inventory = await _context.WarehouseInventory
                    .FirstOrDefaultAsync(wi => wi.WarehouseId == dto.WarehouseId && wi.CommodityId == dto.CommodityId);

                if (inventory == null)
                {
                    return BadRequest(new { message = "No inventory found for this item in the specified warehouse" });
                }

                if (inventory.QuantityOnHand < dto.Quantity)
                {
                    return BadRequest(new { message = $"Insufficient inventory. Available: {inventory.QuantityOnHand}, Requested: {dto.Quantity}" });
                }

                // Get current user ID
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? userId = null;
                if (int.TryParse(userIdClaim, out int parsedUserId))
                {
                    userId = parsedUserId;
                }

                // Create scrap record
                var scrapRecord = new ScrapRecord
                {
                    WarehouseId = dto.WarehouseId,
                    CommodityId = dto.CommodityId,
                    Quantity = dto.Quantity,
                    Reason = dto.Reason,
                    Notes = dto.Notes,
                    UserId = userId,
                    ScrapDate = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow
                };

                _context.ScrapRecords.Add(scrapRecord);

                // Update inventory - reduce quantity
                inventory.QuantityOnHand -= dto.Quantity;
                inventory.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Scrap record created: {Quantity} units of {CommodityName} from {WarehouseName}",
                    dto.Quantity, commodity.Name, warehouse.Name);

                // Return the created record with full details
                var createdRecord = await _context.ScrapRecords
                    .Include(s => s.Warehouse)
                    .Include(s => s.Commodity)
                    .Include(s => s.User)
                    .Where(s => s.Id == scrapRecord.Id)
                    .Select(s => new
                    {
                        s.Id,
                        s.WarehouseId,
                        WarehouseName = s.Warehouse.Name,
                        s.CommodityId,
                        CommodityName = s.Commodity.Name,
                        s.Quantity,
                        s.Reason,
                        s.Notes,
                        s.ScrapDate,
                        s.CreatedAt,
                        RecordedBy = s.User != null ? s.User.Name : "Unknown",
                        NewInventoryBalance = inventory.QuantityOnHand
                    })
                    .FirstOrDefaultAsync();

                return CreatedAtAction(nameof(GetScrapRecord), new { id = scrapRecord.Id }, createdRecord);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating scrap record");
                return StatusCode(500, new { message = "An error occurred while creating the scrap record" });
            }
        }

        // DELETE: api/logistics/scrap/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteScrapRecord(int id)
        {
            try
            {
                var scrapRecord = await _context.ScrapRecords.FindAsync(id);
                if (scrapRecord == null)
                {
                    return NotFound(new { message = "Scrap record not found" });
                }

                // Optionally, restore the inventory (uncomment if needed)
                /*
                var inventory = await _context.WarehouseInventory
                    .FirstOrDefaultAsync(wi => wi.WarehouseId == scrapRecord.WarehouseId && wi.CommodityId == scrapRecord.CommodityId);
                
                if (inventory != null)
                {
                    inventory.QuantityOnHand += scrapRecord.Quantity;
                    inventory.UpdatedAt = DateTime.UtcNow;
                }
                */

                _context.ScrapRecords.Remove(scrapRecord);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Scrap record {Id} deleted", id);

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting scrap record {Id}", id);
                return StatusCode(500, new { message = "An error occurred while deleting the scrap record" });
            }
        }
    }

    public class ScrapRecordDto
    {
        public int WarehouseId { get; set; }
        public int CommodityId { get; set; }
        public decimal Quantity { get; set; }
        public string Reason { get; set; } = string.Empty;
        public string? Notes { get; set; }
    }
}
