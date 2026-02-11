using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Logistics;

/// <summary>
/// Manages live building inventory and stock movements
/// </summary>
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<InventoryController> _logger;

    public InventoryController(ApplicationDbContext context, ILogger<InventoryController> logger)
    {
        _context = context;
        _logger = logger;
    }

    #region Inventory Endpoints

    // GET: api/inventory/building/{buildingId}
    [HttpGet("building/{buildingId}")]
    public async Task<ActionResult<IEnumerable<BuildingInventoryDto>>> GetBuildingInventory(int buildingId)
    {
        var building = await _context.WarehouseBuildings.FindAsync(buildingId);
        if (building == null)
            return NotFound($"Building with ID {buildingId} not found");

        var inventory = await _context.BuildingInventory
            .Where(i => i.BuildingId == buildingId)
            .OrderBy(i => i.ItemCode)
            .Select(i => new BuildingInventoryDto
            {
                Id = i.Id,
                BuildingId = i.BuildingId,
                BuildingCode = building.Code,
                ItemCode = i.ItemCode,
                ItemDescription = i.ItemDescription,
                Uom = i.Uom,
                QuantityOnHand = i.QuantityOnHand,
                QuantityReserved = i.QuantityReserved,
                QuantityOnOrder = i.QuantityOnOrder,
                QuantityAvailable = i.QuantityOnHand - i.QuantityReserved,
                ReorderLevel = i.ReorderLevel,
                MaxLevel = i.MaxLevel,
                UnitCost = i.UnitCost,
                BinLocation = i.BinLocation,
                LastMovementDate = i.LastMovementDate
            })
            .ToListAsync();

        return Ok(inventory);
    }

    // GET: api/inventory/{id}
    [HttpGet("{id}")]
    public async Task<ActionResult<BuildingInventoryDto>> GetInventoryItem(int id)
    {
        var item = await _context.BuildingInventory
            .Include(i => i.Building)
            .FirstOrDefaultAsync(i => i.Id == id);

        if (item == null)
            return NotFound();

        return Ok(new BuildingInventoryDto
        {
            Id = item.Id,
            BuildingId = item.BuildingId,
            BuildingCode = item.Building?.Code ?? "",
            ItemCode = item.ItemCode,
            ItemDescription = item.ItemDescription,
            Uom = item.Uom,
            QuantityOnHand = item.QuantityOnHand,
            QuantityReserved = item.QuantityReserved,
            QuantityOnOrder = item.QuantityOnOrder,
            QuantityAvailable = item.QuantityAvailable,
            ReorderLevel = item.ReorderLevel,
            MaxLevel = item.MaxLevel,
            UnitCost = item.UnitCost,
            BinLocation = item.BinLocation,
            LastMovementDate = item.LastMovementDate
        });
    }

    // PUT: api/inventory/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateInventory(int id, UpdateBuildingInventoryDto dto)
    {
        var item = await _context.BuildingInventory.FindAsync(id);
        if (item == null)
            return NotFound();

        if (dto.QuantityOnHand.HasValue) item.QuantityOnHand = dto.QuantityOnHand.Value;
        if (dto.QuantityReserved.HasValue) item.QuantityReserved = dto.QuantityReserved.Value;
        if (dto.ReorderLevel.HasValue) item.ReorderLevel = dto.ReorderLevel.Value;
        if (dto.MaxLevel.HasValue) item.MaxLevel = dto.MaxLevel.Value;
        if (dto.UnitCost.HasValue) item.UnitCost = dto.UnitCost.Value;
        if (dto.BinLocation != null) item.BinLocation = dto.BinLocation;
        
        item.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return NoContent();
    }

    #endregion

    #region Stock Movement Endpoints

    // GET: api/inventory/movements
    [HttpGet("movements")]
    public async Task<ActionResult<IEnumerable<StockMovementDto>>> GetMovements(
        [FromQuery] int? buildingId = null,
        [FromQuery] string? itemCode = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int limit = 100)
    {
        var query = _context.StockMovements
            .Include(m => m.FromBuilding)
            .Include(m => m.ToBuilding)
            .AsQueryable();

        if (buildingId.HasValue)
            query = query.Where(m => m.FromBuildingId == buildingId || m.ToBuildingId == buildingId);

        if (!string.IsNullOrEmpty(itemCode))
            query = query.Where(m => m.ItemCode == itemCode);

        if (from.HasValue)
            query = query.Where(m => m.CreatedAt >= from.Value);

        if (to.HasValue)
            query = query.Where(m => m.CreatedAt <= to.Value);

        var movements = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(limit)
            .Select(m => new StockMovementDto
            {
                Id = m.Id,
                MovementType = m.MovementType,
                FromBuildingId = m.FromBuildingId,
                FromBuildingCode = m.FromBuilding != null ? m.FromBuilding.Code : null,
                ToBuildingId = m.ToBuildingId,
                ToBuildingCode = m.ToBuilding != null ? m.ToBuilding.Code : null,
                ItemCode = m.ItemCode,
                ItemDescription = m.ItemDescription,
                Quantity = m.Quantity,
                Uom = m.Uom,
                Reference = m.Reference,
                Notes = m.Notes,
                CreatedByName = m.CreatedByName,
                CreatedAt = m.CreatedAt
            })
            .ToListAsync();

        return Ok(movements);
    }

    // POST: api/inventory/transfer
    // Transfer stock between buildings
    [HttpPost("transfer")]
    public async Task<ActionResult<StockMovementDto>> TransferStock(BuildingStockTransferDto dto)
    {
        if (dto.FromBuildingId == dto.ToBuildingId)
            return BadRequest("Cannot transfer to same building");

        if (dto.Quantity <= 0)
            return BadRequest("Quantity must be positive");

        // Get source inventory
        var sourceItem = await _context.BuildingInventory
            .FirstOrDefaultAsync(i => i.BuildingId == dto.FromBuildingId && i.ItemCode == dto.ItemCode);

        if (sourceItem == null)
            return NotFound($"Item {dto.ItemCode} not found in source building");

        if (sourceItem.QuantityAvailable < dto.Quantity)
            return BadRequest($"Insufficient available stock. Available: {sourceItem.QuantityAvailable}, Requested: {dto.Quantity}");

        // Get or create destination inventory
        var destItem = await _context.BuildingInventory
            .FirstOrDefaultAsync(i => i.BuildingId == dto.ToBuildingId && i.ItemCode == dto.ItemCode);

        if (destItem == null)
        {
            destItem = new BuildingInventory
            {
                BuildingId = dto.ToBuildingId,
                ItemCode = dto.ItemCode,
                ItemDescription = sourceItem.ItemDescription,
                Uom = sourceItem.Uom,
                QuantityOnHand = 0,
                UnitCost = sourceItem.UnitCost
            };
            _context.BuildingInventory.Add(destItem);
        }

        // Get user info
        var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? 
                       User.FindFirst("name")?.Value ?? 
                       "System";
        var userId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : (int?)null;

        // Update quantities
        sourceItem.QuantityOnHand -= dto.Quantity;
        sourceItem.LastMovementDate = DateTime.UtcNow;
        sourceItem.UpdatedAt = DateTime.UtcNow;

        destItem.QuantityOnHand += dto.Quantity;
        destItem.LastMovementDate = DateTime.UtcNow;
        destItem.UpdatedAt = DateTime.UtcNow;

        // Create movement record
        var movement = new StockMovement
        {
            MovementType = MovementTypes.Transfer,
            FromBuildingId = dto.FromBuildingId,
            ToBuildingId = dto.ToBuildingId,
            ItemCode = dto.ItemCode,
            ItemDescription = sourceItem.ItemDescription,
            Quantity = dto.Quantity,
            Uom = sourceItem.Uom,
            Reference = dto.Reference,
            Notes = dto.Notes,
            CreatedById = userId,
            CreatedByName = userName
        };

        _context.StockMovements.Add(movement);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Stock transfer: {Qty} x {Item} from Building {From} to {To} by {User}",
            dto.Quantity, dto.ItemCode, dto.FromBuildingId, dto.ToBuildingId, userName);

        // Get building codes for response
        var fromBuilding = await _context.WarehouseBuildings.FindAsync(dto.FromBuildingId);
        var toBuilding = await _context.WarehouseBuildings.FindAsync(dto.ToBuildingId);

        return Ok(new StockMovementDto
        {
            Id = movement.Id,
            MovementType = movement.MovementType,
            FromBuildingId = movement.FromBuildingId,
            FromBuildingCode = fromBuilding?.Code,
            ToBuildingId = movement.ToBuildingId,
            ToBuildingCode = toBuilding?.Code,
            ItemCode = movement.ItemCode,
            ItemDescription = movement.ItemDescription,
            Quantity = movement.Quantity,
            Uom = movement.Uom,
            Reference = movement.Reference,
            Notes = movement.Notes,
            CreatedByName = movement.CreatedByName,
            CreatedAt = movement.CreatedAt
        });
    }

    // POST: api/inventory/adjustment
    // Adjust stock (increase or decrease with reason)
    [HttpPost("adjustment")]
    public async Task<ActionResult<StockMovementDto>> AdjustStock(CreateStockMovementDto dto)
    {
        if (dto.MovementType != MovementTypes.Adjustment && 
            dto.MovementType != MovementTypes.Receipt && 
            dto.MovementType != MovementTypes.Issue)
            return BadRequest("Invalid movement type. Use: Adjustment, Receipt, or Issue");

        var buildingId = dto.ToBuildingId ?? dto.FromBuildingId;
        if (!buildingId.HasValue)
            return BadRequest("Building ID required");

        var item = await _context.BuildingInventory
            .FirstOrDefaultAsync(i => i.BuildingId == buildingId && i.ItemCode == dto.ItemCode);

        if (item == null)
            return NotFound($"Item {dto.ItemCode} not found in building {buildingId}");

        var userName = User.FindFirst(ClaimTypes.Name)?.Value ?? 
                       User.FindFirst("name")?.Value ?? 
                       "System";
        var userId = int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : (int?)null;

        // Apply adjustment
        decimal adjustmentQty = dto.Quantity;
        if (dto.MovementType == MovementTypes.Issue)
        {
            adjustmentQty = -Math.Abs(dto.Quantity); // Issues reduce stock
            if (item.QuantityOnHand + adjustmentQty < 0)
                return BadRequest("Cannot issue more than available");
        }
        else if (dto.MovementType == MovementTypes.Receipt)
        {
            adjustmentQty = Math.Abs(dto.Quantity); // Receipts increase stock
        }
        // Adjustments can be positive or negative

        item.QuantityOnHand += adjustmentQty;
        item.LastMovementDate = DateTime.UtcNow;
        item.UpdatedAt = DateTime.UtcNow;

        var movement = new StockMovement
        {
            MovementType = dto.MovementType,
            FromBuildingId = dto.MovementType == MovementTypes.Issue ? buildingId : null,
            ToBuildingId = dto.MovementType == MovementTypes.Receipt ? buildingId : null,
            ItemCode = dto.ItemCode,
            ItemDescription = dto.ItemDescription ?? item.ItemDescription,
            Quantity = Math.Abs(dto.Quantity),
            Uom = dto.Uom,
            Reference = dto.Reference,
            Notes = dto.Notes,
            CreatedById = userId,
            CreatedByName = userName
        };

        _context.StockMovements.Add(movement);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Stock {Type}: {Qty} x {Item} in Building {Building} by {User}",
            dto.MovementType, dto.Quantity, dto.ItemCode, buildingId, userName);

        var building = await _context.WarehouseBuildings.FindAsync(buildingId);

        return Ok(new StockMovementDto
        {
            Id = movement.Id,
            MovementType = movement.MovementType,
            FromBuildingId = movement.FromBuildingId,
            FromBuildingCode = movement.FromBuildingId.HasValue ? building?.Code : null,
            ToBuildingId = movement.ToBuildingId,
            ToBuildingCode = movement.ToBuildingId.HasValue ? building?.Code : null,
            ItemCode = movement.ItemCode,
            ItemDescription = movement.ItemDescription,
            Quantity = movement.Quantity,
            Uom = movement.Uom,
            Reference = movement.Reference,
            Notes = movement.Notes,
            CreatedByName = movement.CreatedByName,
            CreatedAt = movement.CreatedAt
        });
    }

    #endregion

    #region Summary Endpoints

    // GET: api/inventory/summary
    [HttpGet("summary")]
    public async Task<ActionResult> GetInventorySummary()
    {
        var summary = await _context.WarehouseBuildings
            .Where(b => b.IsActive)
            .Select(b => new
            {
                BuildingId = b.Id,
                BuildingCode = b.Code,
                BuildingName = b.Name,
                WarehouseId = b.WarehouseId,
                WarehouseName = b.Warehouse != null ? b.Warehouse.Name : "",
                ItemCount = _context.BuildingInventory.Count(i => i.BuildingId == b.Id),
                TotalQuantity = _context.BuildingInventory
                    .Where(i => i.BuildingId == b.Id)
                    .Sum(i => (decimal?)i.QuantityOnHand) ?? 0,
                TotalValue = _context.BuildingInventory
                    .Where(i => i.BuildingId == b.Id)
                    .Sum(i => i.QuantityOnHand * (i.UnitCost ?? 0)),
                LowStockCount = _context.BuildingInventory
                    .Count(i => i.BuildingId == b.Id && i.QuantityOnHand <= (i.ReorderLevel ?? 10))
            })
            .ToListAsync();

        return Ok(summary);
    }

    // GET: api/inventory/low-stock
    [HttpGet("low-stock")]
    public async Task<ActionResult<IEnumerable<BuildingInventoryDto>>> GetLowStockItems()
    {
        var items = await _context.BuildingInventory
            .Include(i => i.Building)
            .Where(i => i.QuantityOnHand <= (i.ReorderLevel ?? 10))
            .OrderBy(i => i.QuantityOnHand)
            .Select(i => new BuildingInventoryDto
            {
                Id = i.Id,
                BuildingId = i.BuildingId,
                BuildingCode = i.Building != null ? i.Building.Code : "",
                ItemCode = i.ItemCode,
                ItemDescription = i.ItemDescription,
                Uom = i.Uom,
                QuantityOnHand = i.QuantityOnHand,
                QuantityReserved = i.QuantityReserved,
                QuantityOnOrder = i.QuantityOnOrder,
                QuantityAvailable = i.QuantityOnHand - i.QuantityReserved,
                ReorderLevel = i.ReorderLevel
            })
            .ToListAsync();

        return Ok(items);
    }

    #endregion
}
