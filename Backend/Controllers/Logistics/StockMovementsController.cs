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
    [Route("api/logistics/stock-movements")]
    public class StockMovementsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<StockMovementsController> _logger;

        private const string DispatchApproverPermission = "stock_dispatch_approver";

        public StockMovementsController(ApplicationDbContext context, ILogger<StockMovementsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string CurrentUserName =>
            User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email) ?? "Unknown";

        private async Task<bool> IsDispatchApproverAsync()
        {
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            if (!int.TryParse(idClaim, out var userId)) return false;
            var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == userId);
            if (user == null) return false;
            var role = (user.Role ?? "").ToLower();
            if (role.Contains("admin") || role.Contains("manager")) return true;
            var perms = (user.Permissions ?? "").ToLower();
            // Stock controllers (stock_management permission) or explicit approvers
            return perms.Contains("stock_management") || perms.Contains(DispatchApproverPermission);
        }

        // ═══ GET: list movements (ledger) ═══
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetMovements(
            [FromQuery] int? warehouseId, [FromQuery] string? type, [FromQuery] int limit = 300)
        {
            var query = _context.WarehouseStockMovements
                .Include(m => m.Warehouse)
                .Include(m => m.Commodity)
                .AsQueryable();

            if (warehouseId.HasValue) query = query.Where(m => m.WarehouseId == warehouseId.Value);
            if (!string.IsNullOrEmpty(type)) query = query.Where(m => m.MovementType == type);

            var rows = await query
                .OrderByDescending(m => m.CreatedAt)
                .Take(Math.Clamp(limit, 1, 2000))
                .Select(m => new
                {
                    m.Id,
                    m.WarehouseId,
                    WarehouseName = m.Warehouse != null ? m.Warehouse.Name : null,
                    m.CommodityId,
                    CommodityCode = m.Commodity != null ? m.Commodity.Code : null,
                    CommodityName = m.Commodity != null ? m.Commodity.Name : null,
                    m.MovementType,
                    m.Quantity,
                    m.LoadId,
                    m.TransferId,
                    m.Reference,
                    m.Reason,
                    m.Status,
                    m.BalanceAfter,
                    m.ReversedByMovementId,
                    m.ReversesMovementId,
                    m.CreatedBy,
                    m.CreatedAt
                })
                .ToListAsync();

            return Ok(rows);
        }

        // ═══ GET: can current user approve dispatches? ═══
        [HttpGet("can-approve")]
        public async Task<ActionResult<object>> CanApprove() => Ok(new { canApprove = await IsDispatchApproverAsync() });

        // ═══ GET: loads with dispatch deduction state ═══
        [HttpGet("dispatched-loads")]
        public async Task<ActionResult<IEnumerable<object>>> GetDispatchedLoadIds()
        {
            var ids = await _context.WarehouseStockMovements
                .Where(m => m.LoadId != null && m.MovementType == "Dispatch" && m.Status == "Approved" && m.ReversedByMovementId == null)
                .Select(m => m.LoadId!.Value)
                .Distinct()
                .ToListAsync();
            return Ok(ids);
        }

        // ═══ POST: manual movement (Receive / Return / Adjustment) ═══
        [HttpPost]
        public async Task<ActionResult<object>> CreateMovement([FromBody] ManualMovementDto dto)
        {
            var allowed = new[] { "Receive", "Return", "Adjustment", "Scrap" };
            if (!allowed.Contains(dto.MovementType))
                return BadRequest(new { message = "MovementType must be Receive, Return, Adjustment or Scrap" });
            if (dto.Quantity == 0)
                return BadRequest(new { message = "Quantity may not be zero" });
            if ((dto.MovementType == "Adjustment" || dto.MovementType == "Scrap") && string.IsNullOrWhiteSpace(dto.Reason))
                return BadRequest(new { message = $"{dto.MovementType} requires a reason" });

            // Receive/Return are stock-in (positive); Scrap is stock-out (negative); Adjustment may be either sign
            var qty = dto.MovementType switch
            {
                "Adjustment" => dto.Quantity,
                "Scrap" => -Math.Abs(dto.Quantity),
                _ => Math.Abs(dto.Quantity)
            };

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var result = await ApplyMovementAsync(dto.WarehouseId, dto.CommodityId, dto.MovementType, qty,
                    null, null, dto.Reference, dto.Reason);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error creating stock movement");
                return StatusCode(500, new { message = "An error occurred while creating the movement" });
            }
        }

        // ═══ POST: transfer stock between warehouses (two linked ledger rows) ═══
        [HttpPost("transfer")]
        public async Task<ActionResult<object>> TransferStock([FromBody] TransferStockDto dto)
        {
            if (dto.FromWarehouseId == dto.ToWarehouseId)
                return BadRequest(new { message = "Source and destination warehouses must differ" });
            if (dto.Quantity <= 0)
                return BadRequest(new { message = "Quantity must be greater than zero" });

            var from = await _context.Warehouses.FindAsync(dto.FromWarehouseId);
            var to = await _context.Warehouses.FindAsync(dto.ToWarehouseId);
            if (from == null || to == null) return NotFound(new { message = "Warehouse not found" });

            var reference = string.IsNullOrWhiteSpace(dto.Reference)
                ? $"TRF {from.Name} → {to.Name}"
                : dto.Reference;

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                // out of source (negative) — reason required if it goes negative (ApplyMovementAsync enforces)
                var outRow = await ApplyMovementAsync(dto.FromWarehouseId, dto.CommodityId, "Transfer",
                    -Math.Abs(dto.Quantity), null, null, reference, dto.Reason);
                // into destination (positive)
                var inRow = await ApplyMovementAsync(dto.ToWarehouseId, dto.CommodityId, "Transfer",
                    Math.Abs(dto.Quantity), null, null, reference, dto.Reason);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                return Ok(new { outRow, inRow });
            }
            catch (InvalidOperationException ex)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error transferring stock");
                return StatusCode(500, new { message = "An error occurred while transferring stock" });
            }
        }

        // ═══ POST: approve a dispatch (deducts stock per picking-slip line) ═══
        [HttpPost("approve-dispatch")]
        public async Task<ActionResult<object>> ApproveDispatch([FromBody] ApproveDispatchDto dto)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = "You need the Stock Dispatch Approver permission to approve dispatches" });

            var load = await _context.Loads.Include(l => l.Warehouse).FirstOrDefaultAsync(l => l.Id == dto.LoadId);
            if (load == null) return NotFound(new { message = "Load not found" });
            var warehouseId = dto.WarehouseId ?? load.WarehouseId;
            if (warehouseId == null) return BadRequest(new { message = "Load has no warehouse — specify warehouseId" });

            var alreadyDeducted = await _context.WarehouseStockMovements.AnyAsync(m =>
                m.LoadId == dto.LoadId && m.MovementType == "Dispatch" && m.Status == "Approved" && m.ReversedByMovementId == null);
            if (alreadyDeducted)
                return Conflict(new { message = $"Load {load.LoadNumber} has already had stock deducted. Use a reversal first if this was a mistake." });

            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest(new { message = "No lines to dispatch" });

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var results = new List<object>();
                foreach (var line in dto.Lines.Where(l => l.DispatchedQuantity > 0))
                {
                    var r = await ApplyMovementAsync(warehouseId.Value, line.CommodityId, "Dispatch",
                        -Math.Abs(line.DispatchedQuantity), dto.LoadId, null, load.LoadNumber, line.Reason);
                    results.Add(r);
                }
                if (results.Count == 0)
                {
                    await tx.RollbackAsync();
                    return BadRequest(new { message = "All dispatched quantities were zero" });
                }
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                return Ok(new { loadId = dto.LoadId, loadNumber = load.LoadNumber, lines = results.Count });
            }
            catch (InvalidOperationException ex)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error approving dispatch for load {LoadId}", dto.LoadId);
                return StatusCode(500, new { message = "An error occurred while approving the dispatch" });
            }
        }

        // ═══ POST: stock take — post counted quantities; each variance becomes an Adjustment ═══
        [HttpPost("stock-take")]
        public async Task<ActionResult<object>> PostStockTake([FromBody] StockTakeDto dto)
        {
            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest(new { message = "No counted lines supplied" });
            if (string.IsNullOrWhiteSpace(dto.Reason))
                return BadRequest(new { message = "A reason is required for stock take adjustments" });
            var wh = await _context.Warehouses.FindAsync(dto.WarehouseId);
            if (wh == null) return NotFound(new { message = "Warehouse not found" });

            var reference = string.IsNullOrWhiteSpace(dto.Reference)
                ? $"STK-{wh.Id}-{DateTime.UtcNow:yyyy-MM-dd}"
                : dto.Reference.Trim();

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var adjusted = 0; var confirmed = 0;
                foreach (var line in dto.Lines)
                {
                    var inv = await _context.WarehouseInventory
                        .FirstOrDefaultAsync(i => i.WarehouseId == dto.WarehouseId && i.CommodityId == line.CommodityId);
                    var system = inv?.QuantityOnHand ?? 0m;
                    var variance = line.CountedQuantity - system;
                    if (variance == 0) { confirmed++; if (inv != null) { inv.LastCountDate = DateTime.UtcNow; } continue; }

                    await ApplyMovementAsync(dto.WarehouseId, line.CommodityId, "Adjustment", variance,
                        null, null, reference, $"Stock take: counted {line.CountedQuantity}, system {system}. {dto.Reason}");
                    if (inv != null) inv.LastCountDate = DateTime.UtcNow;
                    adjusted++;
                }
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                return Ok(new { reference, adjusted, confirmed });
            }
            catch (InvalidOperationException ex)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error posting stock take for warehouse {WarehouseId}", dto.WarehouseId);
                return StatusCode(500, new { message = "An error occurred while posting the stock take" });
            }
        }

        // ═══ POST: reverse a movement (never edit/delete) ═══
        [HttpPost("{id}/reverse")]
        public async Task<ActionResult<object>> ReverseMovement(int id, [FromBody] ReverseDto dto)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = "You need the Stock Dispatch Approver permission to reverse movements" });

            var original = await _context.WarehouseStockMovements.FindAsync(id);
            if (original == null) return NotFound(new { message = "Movement not found" });
            if (original.Status != "Approved") return BadRequest(new { message = "Only approved movements can be reversed" });
            if (original.ReversedByMovementId != null) return Conflict(new { message = "Movement already reversed" });
            if (string.IsNullOrWhiteSpace(dto.Reason)) return BadRequest(new { message = "A reason is required for reversals" });

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var reversal = (WarehouseStockMovement)(await ApplyMovementAsync(original.WarehouseId, original.CommodityId,
                    "Reversal", -original.Quantity, original.LoadId, original.TransferId,
                    $"REV of #{original.Id} ({original.Reference})", dto.Reason, returnEntity: true))!;
                original.ReversedByMovementId = reversal.Id;
                reversal.ReversesMovementId = original.Id;
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                return Ok(new { reversedMovementId = original.Id, reversalMovementId = reversal.Id });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error reversing movement {Id}", id);
                return StatusCode(500, new { message = "An error occurred while reversing the movement" });
            }
        }

        /// <summary>
        /// Core: insert a ledger row and update the cached WarehouseInventory.QuantityOnHand
        /// in the same EF change-set (caller controls the transaction).
        /// Auto-creates missing inventory rows (logged as an Issue) and
        /// auto-logs an Issue when a balance goes negative (reason required by callers).
        /// </summary>
        private async Task<object?> ApplyMovementAsync(int warehouseId, int commodityId, string movementType,
            decimal signedQty, int? loadId, int? transferId, string? reference, string? reason, bool returnEntity = false)
        {
            var inv = await _context.WarehouseInventory
                .FirstOrDefaultAsync(i => i.WarehouseId == warehouseId && i.CommodityId == commodityId);

            if (inv == null)
            {
                var commodity = await _context.Commodities.FindAsync(commodityId)
                    ?? throw new InvalidOperationException($"Commodity {commodityId} not found");
                inv = new WarehouseInventory
                {
                    WarehouseId = warehouseId,
                    CommodityId = commodityId,
                    QuantityOnHand = 0,
                    CreatedAt = DateTime.UtcNow
                };
                _context.WarehouseInventory.Add(inv);

                _context.StockIssues.Add(new StockIssue
                {
                    WarehouseId = warehouseId,
                    ItemCode = commodity.Code,
                    ItemDescription = commodity.Name,
                    IssueType = "Item not in warehouse stock",
                    Detail = $"A {movementType} movement was recorded for an item with no stock record at this warehouse. Row auto-created at 0.",
                    IssueDate = DateTime.UtcNow,
                    Status = "Open",
                    CreatedBy = CurrentUserName,
                    Source = "System"
                });
            }

            var newBalance = inv.QuantityOnHand + signedQty;
            if (newBalance < 0)
            {
                if (string.IsNullOrWhiteSpace(reason))
                    throw new InvalidOperationException(
                        $"This would take stock negative ({inv.QuantityOnHand} → {newBalance}). A reason is required.");

                var commodity = await _context.Commodities.FindAsync(commodityId);
                _context.StockIssues.Add(new StockIssue
                {
                    WarehouseId = warehouseId,
                    ItemCode = commodity?.Code,
                    ItemDescription = commodity?.Name,
                    IssueType = "Negative balance",
                    Detail = $"{movementType} of {signedQty} took balance from {inv.QuantityOnHand} to {newBalance}. Reason: {reason}",
                    IssueDate = DateTime.UtcNow,
                    Status = "Open",
                    CreatedBy = CurrentUserName,
                    Source = "System"
                });
            }

            inv.QuantityOnHand = newBalance;
            inv.UpdatedAt = DateTime.UtcNow;
            if (signedQty > 0) inv.LastRestockDate = DateTime.UtcNow;

            var movement = new WarehouseStockMovement
            {
                WarehouseId = warehouseId,
                CommodityId = commodityId,
                MovementType = movementType,
                Quantity = signedQty,
                LoadId = loadId,
                TransferId = transferId,
                Reference = reference,
                Reason = reason,
                Status = "Approved",
                BalanceAfter = newBalance,
                CreatedBy = CurrentUserName,
                CreatedAt = DateTime.UtcNow
            };
            _context.WarehouseStockMovements.Add(movement);

            if (returnEntity)
            {
                await _context.SaveChangesAsync(); // need Id for reversal linking
                return movement;
            }
            return new { commodityId, movementType, quantity = signedQty, balanceAfter = newBalance };
        }
    }

    public class ManualMovementDto
    {
        public int WarehouseId { get; set; }
        public int CommodityId { get; set; }
        public string MovementType { get; set; } = string.Empty; // Receive | Return | Adjustment
        public decimal Quantity { get; set; }
        public string? Reference { get; set; }
        public string? Reason { get; set; }
    }

    public class TransferStockDto
    {
        public int FromWarehouseId { get; set; }
        public int ToWarehouseId { get; set; }
        public int CommodityId { get; set; }
        public decimal Quantity { get; set; }
        public string? Reference { get; set; }
        public string? Reason { get; set; }
    }

    public class ApproveDispatchDto
    {
        public int LoadId { get; set; }
        public int? WarehouseId { get; set; }
        public List<DispatchLineDto> Lines { get; set; } = new();
    }

    public class DispatchLineDto
    {
        public int CommodityId { get; set; }
        public decimal DispatchedQuantity { get; set; }
        public string? Reason { get; set; }
    }

    public class StockTakeDto
    {
        public int WarehouseId { get; set; }
        public string? Reference { get; set; }
        public string? Reason { get; set; }
        public List<StockTakeLineDto> Lines { get; set; } = new();
    }

    public class StockTakeLineDto
    {
        public int CommodityId { get; set; }
        public decimal CountedQuantity { get; set; }
    }

    public class ReverseDto
    {
        public string Reason { get; set; } = string.Empty;
    }
}
