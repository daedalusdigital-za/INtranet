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

            // Loads dated before the warehouse's stock-count baseline are already in the imported quantities
            var baseline = await _context.WarehouseInventory
                .Where(i => i.WarehouseId == warehouseId.Value && i.LastCountDate != null)
                .MaxAsync(i => i.LastCountDate);
            var loadDate = load.ActualDeliveryDate ?? load.ScheduledDeliveryDate ?? load.CreatedAt;
            if (baseline != null && loadDate < baseline.Value)
                return Conflict(new { message = $"Load {load.LoadNumber} ({loadDate:dd MMM yyyy}) predates the {load.Warehouse?.Name} stock count of {baseline:dd MMM yyyy} and is already reflected in stock on hand." });

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

        // ═══ GET: distinct product codes that appear on imported sales invoices ═══
        // Used by Stock Management to highlight (green) stock codes that are matched by invoices.
        [HttpGet("inventory/invoice-matched-codes")]
        public async Task<ActionResult<IEnumerable<string>>> GetInvoiceMatchedCodes()
        {
            var codes = await _context.ImportedInvoices
                .Where(i => i.ProductCode != null && i.ProductCode != "")
                .Select(i => i.ProductCode)
                .Distinct()
                .ToListAsync();
            return Ok(codes);
        }

        // ═══ POST: link unmapped tripsheet lines to a stock item so they can deduct stock ═══
        [HttpPost("map-stop-commodity")]
        public async Task<ActionResult<object>> MapStopCommodity([FromBody] MapStopCommodityDto dto)
        {
            if (dto.StopCommodityIds == null || dto.StopCommodityIds.Count == 0)
                return BadRequest(new { message = "No tripsheet lines supplied" });

            var commodity = await _context.Commodities.FindAsync(dto.CommodityId);
            if (commodity == null) return NotFound(new { message = "Stock item not found" });

            var rows = await _context.StopCommodities
                .Where(sc => dto.StopCommodityIds.Contains(sc.Id))
                .ToListAsync();
            if (rows.Count == 0) return NotFound(new { message = "Tripsheet line(s) not found" });

            var updated = 0;
            foreach (var sc in rows)
            {
                if (sc.CommodityId != null) continue; // never silently re-map an already-linked line
                sc.CommodityId = dto.CommodityId;
                updated++;
            }
            await _context.SaveChangesAsync();
            _logger.LogInformation("Mapped {Count} stop-commodity line(s) to commodity {CommodityId} ({Code})",
                updated, dto.CommodityId, commodity.Code);
            return Ok(new { updated, commodityId = commodity.Id, code = commodity.Code, name = commodity.Name });
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

        // ═══ PATCH: inline datasheet edit of a single inventory cell (PIN-gated on the client) ═══
        // Quantity edits are posted as an Adjustment movement (never silently overwritten) and
        // stamp LastCountDate; product master fields update the Commodity shared by all warehouses.
        [HttpPatch("inventory/{inventoryId}/cell")]
        public async Task<ActionResult<object>> EditInventoryCell(int inventoryId, [FromBody] InventoryCellEditDto dto)
        {
            var inv = await _context.WarehouseInventory.Include(i => i.Commodity).FirstOrDefaultAsync(i => i.Id == inventoryId);
            if (inv == null) return NotFound(new { message = "Stock line not found" });
            var field = (dto.Field ?? string.Empty).Trim().ToLowerInvariant();
            var value = dto.Value?.Trim();
            var now = DateTime.UtcNow;

            switch (field)
            {
                case "quantityonhand":
                {
                    if (!decimal.TryParse(value, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var qty) || qty < 0)
                        return BadRequest(new { message = "Quantity must be a number of 0 or more" });
                    var variance = qty - inv.QuantityOnHand;
                    if (variance != 0)
                    {
                        try
                        {
                            await ApplyMovementAsync(inv.WarehouseId, inv.CommodityId, "Adjustment", variance, null, null,
                                $"EDIT-{inv.WarehouseId}-{now:yyyyMMdd}", $"Datasheet edit by {CurrentUserName}: {inv.QuantityOnHand} → {qty}. {dto.Reason}".Trim());
                        }
                        catch (InvalidOperationException ex) { return BadRequest(new { message = ex.Message }); }
                    }
                    inv.LastCountDate = now;
                    break;
                }
                case "binlocation":
                    inv.BinLocation = string.IsNullOrWhiteSpace(value) ? null : value;
                    break;
                case "unitprice":
                {
                    if (string.IsNullOrWhiteSpace(value)) { inv.UnitPrice = null; break; } // clear override → fall back to invoice-derived price
                    var cleaned = value.Replace("R", "", StringComparison.OrdinalIgnoreCase).Replace(",", "").Replace(" ", "");
                    if (!decimal.TryParse(cleaned, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var price) || price < 0)
                        return BadRequest(new { message = "Unit price must be a number of 0 or more" });
                    inv.UnitPrice = Math.Round(price, 2);
                    break;
                }
                case "commoditycode":
                    if (string.IsNullOrWhiteSpace(value)) return BadRequest(new { message = "Code cannot be blank" });
                    if (await _context.Commodities.AnyAsync(c => c.Id != inv.CommodityId && c.Code == value))
                        return BadRequest(new { message = $"Another product already uses code {value}" });
                    inv.Commodity.Code = value; inv.Commodity.UpdatedAt = now; break;
                case "commodityname":
                    if (string.IsNullOrWhiteSpace(value)) return BadRequest(new { message = "Description cannot be blank" });
                    inv.Commodity.Name = value; inv.Commodity.UpdatedAt = now; break;
                case "category":
                    inv.Commodity.Category = string.IsNullOrWhiteSpace(value) ? null : value; inv.Commodity.UpdatedAt = now; break;
                case "unitofmeasure":
                    inv.Commodity.UnitOfMeasure = string.IsNullOrWhiteSpace(value) ? null : value; inv.Commodity.UpdatedAt = now; break;
                default:
                    return BadRequest(new { message = $"Field '{dto.Field}' cannot be edited" });
            }

            inv.UpdatedAt = now;
            await _context.SaveChangesAsync();
            _logger.LogInformation("Inventory cell edited: line {Id} field {Field} by {User}", inventoryId, field, CurrentUserName);
            return Ok(new
            {
                id = inv.Id,
                commodityCode = inv.Commodity.Code,
                commodityName = inv.Commodity.Name,
                category = inv.Commodity.Category,
                unitOfMeasure = inv.Commodity.UnitOfMeasure,
                quantityOnHand = inv.QuantityOnHand,
                unitPrice = inv.UnitPrice,
                binLocation = inv.BinLocation,
                lastCountDate = inv.LastCountDate
            });
        }

        // ═══ POST: fill missing unit prices from imported sales invoices ═══
        // For every unpriced stock line whose code matches an invoice product code (the "green"
        // matches), derive the unit price as total sales ÷ total quantity across all invoices
        // for that code. Existing prices are never overwritten.
        [HttpPost("inventory/apply-invoice-prices")]
        public async Task<ActionResult<object>> ApplyInvoicePrices()
        {
            static string Norm(string? s) => new string((s ?? "").Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

            // Average selling price per invoice product code (sales ÷ qty, invoices only)
            var invoiceRows = await _context.ImportedInvoices
                .Where(ii => ii.ProductCode != null && ii.ProductCode != "" && ii.Quantity > 0 && ii.SalesAmount > 0)
                .GroupBy(ii => ii.ProductCode!)
                .Select(g => new { Code = g.Key, Qty = g.Sum(x => x.Quantity), Sales = g.Sum(x => x.SalesAmount) })
                .ToListAsync();

            var priceMap = new Dictionary<string, decimal>();
            foreach (var r in invoiceRows)
            {
                var key = Norm(r.Code);
                if (key.Length < 4 || r.Qty <= 0) continue;
                var price = Math.Round(r.Sales / r.Qty, 2);
                if (price <= 0) continue;
                // conservative on duplicate normalised codes: keep the lower price
                if (!priceMap.TryGetValue(key, out var existing) || price < existing)
                    priceMap[key] = price;
            }

            var lines = await _context.WarehouseInventory
                .Include(i => i.Commodity)
                .Where(i => i.UnitPrice == null)
                .ToListAsync();

            var now = DateTime.UtcNow;
            int matched = 0;
            var preview = new List<object>();

            foreach (var inv in lines)
            {
                var code = Norm(inv.Commodity?.Code);
                if (code.Length < 4) continue;

                decimal price = 0;
                var found = priceMap.TryGetValue(code, out price);
                if (!found)
                {
                    // stock codes are often the invoice code + trailing zeros (padding)
                    foreach (var kv in priceMap)
                    {
                        if (code.StartsWith(kv.Key, StringComparison.Ordinal) &&
                            code.Length > kv.Key.Length &&
                            code.Substring(kv.Key.Length).All(ch => ch == '0'))
                        { price = kv.Value; found = true; break; }
                    }
                    // …or the invoice code is the stock code + trailing zeros
                    if (!found)
                    {
                        foreach (var kv in priceMap)
                        {
                            if (kv.Key.StartsWith(code, StringComparison.Ordinal) &&
                                kv.Key.Length > code.Length &&
                                kv.Key.Substring(code.Length).All(ch => ch == '0'))
                            { price = kv.Value; found = true; break; }
                        }
                    }
                }
                if (!found) continue;

                inv.UnitPrice = price;
                inv.UpdatedAt = now;
                matched++;
                if (preview.Count < 100)
                    preview.Add(new { inv.Id, code = inv.Commodity!.Code, name = inv.Commodity.Name, price });
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Invoice-derived prices applied by {User}: {Matched} of {Total} unpriced lines priced", CurrentUserName, matched, lines.Count);
            return Ok(new { totalUnpriced = lines.Count, matched, stillUnpriced = lines.Count - matched, sample = preview });
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

    public class InventoryCellEditDto
    {
        public string Field { get; set; } = string.Empty; // quantityOnHand | binLocation | commodityCode | commodityName | category | unitOfMeasure
        public string? Value { get; set; }
        public string? Reason { get; set; }
    }

    public class MapStopCommodityDto
    {
        public List<int> StopCommodityIds { get; set; } = new();
        public int CommodityId { get; set; }
    }
}
