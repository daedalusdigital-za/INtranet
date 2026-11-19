using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services;
using ProjectTracker.API.Services.Logistics;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/stock-movements")]
    public class StockMovementsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<StockMovementsController> _logger;
        private readonly IClaudeAIService? _claude;

        public StockMovementsController(ApplicationDbContext context, ILogger<StockMovementsController> logger,
            IClaudeAIService? claude = null)
        {
            _context = context;
            _logger = logger;
            _claude = claude;
        }

        private string CurrentUserName =>
            User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email) ?? "Unknown";

        // Approvers are the people with Stock Management access (see StockAccess)
        private Task<bool> IsDispatchApproverAsync() => StockAccess.CanManageAsync(_context, User);

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

        // ═══ GET: stock state of every live load — the approval work-queue ═══
        // Same rule as ApproveDispatch: a load is "baseline" (already in the counted stock) only when every
        // linked line was counted after it was dispatched. Loads with no linked lines fall back to the
        // warehouse's latest count. Everything else not yet deducted is "awaiting".
        [HttpGet("load-stock-state")]
        public async Task<ActionResult<IEnumerable<object>>> GetLoadStockState()
        {
            var deducted = (await _context.WarehouseStockMovements
                .Where(m => m.LoadId != null && m.MovementType == "Dispatch" && m.Status == "Approved" && m.ReversedByMovementId == null)
                .Select(m => m.LoadId!.Value).Distinct().ToListAsync()).ToHashSet();

            var loads = await _context.Loads.AsNoTracking()
                .Where(l => l.Status != "Cancelled" && l.LoadType != InternalMovementsController.LoadTypeInternal)
                .ToListAsync();
            var lines = (await _context.StopCommodities.AsNoTracking()
                    .Where(sc => sc.CommodityId != null && sc.Quantity > 0)
                    .Select(sc => new { sc.LoadStop.LoadId, CommodityId = sc.CommodityId!.Value })
                    .ToListAsync())
                .ToLookup(x => x.LoadId, x => x.CommodityId);
            var counts = await _context.WarehouseInventory.AsNoTracking()
                .Where(i => i.LastCountDate != null)
                .Select(i => new { i.WarehouseId, i.CommodityId, Counted = i.LastCountDate!.Value })
                .ToListAsync();
            var countOf = counts.ToDictionary(c => (c.WarehouseId, c.CommodityId), c => c.Counted);
            var warehouseCount = counts.GroupBy(c => c.WarehouseId).ToDictionary(g => g.Key, g => g.Max(c => c.Counted));

            var result = loads.Select(l =>
            {
                var dispatched = LoadStockGuard.DispatchDate(l);
                string state;
                if (deducted.Contains(l.Id)) state = "deducted";
                else if (l.WarehouseId == null) state = "awaiting";
                else
                {
                    var wh = l.WarehouseId.Value;
                    var items = lines[l.Id].Distinct().ToList();
                    var baseline = items.Count > 0
                        ? items.All(c => countOf.TryGetValue((wh, c), out var counted) && dispatched < counted)
                        : warehouseCount.TryGetValue(wh, out var whCounted) && dispatched < whCounted;
                    state = baseline ? "baseline" : "awaiting";
                }
                return new { loadId = l.Id, state, dispatchDate = dispatched, delivered = l.Status == "Delivered" || l.Status == "Completed" };
            }).ToList();
            return Ok(result);
        }

        // ═══ POST: manual movement (Receive / Return / Adjustment) ═══
        [HttpPost]
        public async Task<ActionResult<object>> CreateMovement([FromBody] ManualMovementDto dto)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = StockAccess.Denied });

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
            catch (Exception ex) when (StockLedger.IsStockConflict(ex))
            {
                await tx.RollbackAsync();
                return Conflict(new { message = StockLedger.ConflictMessage });
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
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = StockAccess.Denied });

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
            catch (Exception ex) when (StockLedger.IsStockConflict(ex))
            {
                await tx.RollbackAsync();
                return Conflict(new { message = StockLedger.ConflictMessage });
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
            if (string.Equals(load.Status, "Cancelled", StringComparison.OrdinalIgnoreCase))
                return Conflict(new { message = $"Load {load.LoadNumber} is cancelled, so it takes no stock." });
            if (load.LoadType == InternalMovementsController.LoadTypeInternal)
                return Conflict(new { message = $"{load.LoadNumber} is an internal warehouse movement — dispatch and receive it from Logistics › Movement instead." });
            var warehouseId = dto.WarehouseId ?? load.WarehouseId;
            if (warehouseId == null) return BadRequest(new { message = "Load has no warehouse — specify warehouseId" });

            if (await LoadStockGuard.HasLiveDeductionAsync(_context, dto.LoadId))
                return Conflict(new { message = $"Load {load.LoadNumber} has already had stock deducted. Use a reversal first if this was a mistake." });

            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest(new { message = "No lines to dispatch" });

            // A line with no stock item would never deduct, and once a load is approved nothing
            // more can be added to it, so every line must be linked first.
            var unlinked = await _context.StopCommodities
                .CountAsync(sc => sc.LoadStop.LoadId == dto.LoadId && sc.CommodityId == null && sc.Quantity > 0);
            if (unlinked > 0 && !dto.SkipUnlinked)
                return Conflict(new
                {
                    message = $"{unlinked} line(s) on {load.LoadNumber} aren't linked to a stock item yet. Link every line before approving.",
                    unlinkedLines = unlinked
                });
            if (unlinked > 0)
                _logger.LogWarning("Approving {Load} with {Unlinked} unlinked line(s) skipped by {User}", load.LoadNumber, unlinked, CurrentUserName);

            // What the load actually carries — the dispatch may ship less than this, never more or anything else.
            var planned = await _context.StopCommodities
                .Where(sc => sc.LoadStop.LoadId == dto.LoadId && sc.CommodityId != null && sc.Quantity > 0)
                .GroupBy(sc => sc.CommodityId!.Value)
                .Select(g => new { CommodityId = g.Key, Qty = g.Sum(x => x.Quantity) })
                .ToDictionaryAsync(x => x.CommodityId, x => x.Qty);
            if (planned.Count == 0)
                return Conflict(new { message = $"{load.LoadNumber} has no stock lines, so there is nothing to deduct." });

            var requested = dto.Lines
                .Where(l => l.DispatchedQuantity > 0)
                .GroupBy(l => l.CommodityId)
                .Select(g => new
                {
                    CommodityId = g.Key,
                    Qty = g.Sum(x => Math.Abs(x.DispatchedQuantity)),
                    Reason = g.Select(x => x.Reason).FirstOrDefault(r => !string.IsNullOrWhiteSpace(r))
                })
                .ToList();
            if (requested.Count == 0)
                return BadRequest(new { message = "All dispatched quantities were zero" });

            var notOnLoad = requested.Where(r => !planned.ContainsKey(r.CommodityId)).Select(r => r.CommodityId).ToList();
            if (notOnLoad.Count > 0)
                return BadRequest(new { message = $"{notOnLoad.Count} line(s) are not on {load.LoadNumber}. Only the load's own items can be dispatched." });
            var over = requested.Where(r => r.Qty > planned[r.CommodityId]).ToList();
            if (over.Count > 0)
                return BadRequest(new { message = $"{over.Count} line(s) dispatch more than {load.LoadNumber} carries. Correct the load first, then approve." });

            // Lines counted after the load went out are already reflected in that count, so they are skipped
            // (per item, so a recount of one product doesn't block every other load in the warehouse).
            var loadDate = LoadStockGuard.DispatchDate(load);
            var commodityIds = requested.Select(r => r.CommodityId).ToList();
            var countDates = await _context.WarehouseInventory
                .Where(i => i.WarehouseId == warehouseId.Value && commodityIds.Contains(i.CommodityId) && i.LastCountDate != null)
                .ToDictionaryAsync(i => i.CommodityId, i => i.LastCountDate!.Value);
            var toDeduct = requested.Where(r => !(countDates.TryGetValue(r.CommodityId, out var counted) && loadDate < counted)).ToList();
            var skipped = requested.Count - toDeduct.Count;
            if (toDeduct.Count == 0)
                return Conflict(new { message = $"Load {load.LoadNumber} left on {loadDate:dd MMM yyyy}, before the {load.Warehouse?.Name} stock count of every item on it, so it is already reflected in stock on hand." });

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var line in toDeduct)
                    await ApplyMovementAsync(warehouseId.Value, line.CommodityId, "Dispatch",
                        -line.Qty, dto.LoadId, null, load.LoadNumber, line.Reason);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                var message = skipped == 0
                    ? $"Stock deducted for {load.LoadNumber}"
                    : $"Stock deducted for {load.LoadNumber}; {skipped} line(s) skipped because they were counted after the load went out";
                if (unlinked > 0) message += $"; {unlinked} unlinked line(s) not deducted";
                return Ok(new { loadId = dto.LoadId, loadNumber = load.LoadNumber, lines = toDeduct.Count, skippedLines = skipped, unlinkedLines = unlinked, message });
            }
            catch (InvalidOperationException ex)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex) when (StockLedger.IsStockConflict(ex))
            {
                await tx.RollbackAsync();
                return Conflict(new { message = $"Load {load.LoadNumber} was approved by someone else, or its stock changed while saving. Refresh and check before trying again." });
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
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = StockAccess.Denied });

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

        // ═══ POST: auto-link a load's unlinked lines (stored code → invoice code → description), creating stock
        //     items for invoice codes that have none. Called when the Approve Dispatch dialog opens. ═══
        [HttpPost("loads/{loadId:int}/relink-lines")]
        public async Task<ActionResult<object>> RelinkLoadLines(int loadId)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = StockAccess.Denied });
            if (!await _context.Loads.AnyAsync(l => l.Id == loadId)) return NotFound(new { message = "Load not found" });

            var r = await StopLineLinker.LinkAsync(_context, loadId);
            if (r.LinesLinked > 0 || r.CommoditiesCreated > 0)
                _logger.LogInformation("Relinked load {LoadId}: {Linked}/{Considered} lines linked, {Created} stock items created by {User}",
                    loadId, r.LinesLinked, r.LinesConsidered, r.CommoditiesCreated, CurrentUserName);
            return Ok(new { loadId, r.CommoditiesCreated, r.LinesConsidered, r.LinesLinked, r.StillUnlinked });
        }

        // ═══ POST: make every invoiced product code a stock item, then link all unlinked lines everywhere ═══
        [HttpPost("loads/relink-all")]
        public async Task<ActionResult<object>> RelinkAllLines()
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = StockAccess.Denied });
            var created = await StopLineLinker.EnsureCommoditiesForInvoiceCodesAsync(_context);
            var r = await StopLineLinker.LinkAsync(_context, null, createMissingCommodities: false);
            _logger.LogInformation("Relink-all by {User}: {Created} stock items created, {Linked}/{Considered} lines linked",
                CurrentUserName, created, r.LinesLinked, r.LinesConsidered);
            return Ok(new { commoditiesCreated = created, r.LinesConsidered, r.LinesLinked, r.StillUnlinked });
        }

        // ═══ POST: pre-count sweep — deduct EVERY line on every live load, no questions asked ═══
        // Still-unlinked lines get a stock item created from their description (code "DESC-<n>" when the line
        // has no product code) so they can deduct. Loads already partly deducted are topped up with the
        // lines that have no Dispatch movement yet. Negative stock is allowed (reason recorded).
        // Excluded load numbers (e.g. tomorrow's loads) are left alone. dryRun only reports.
        [HttpPost("loads/force-deduct")]
        public async Task<ActionResult<object>> ForceDeductAll([FromBody] ForceDeductDto dto, [FromQuery] bool dryRun = true)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = StockAccess.Denied });

            var exclude = (dto.ExcludeLoadNumbers ?? new()).Select(n => n.Trim().ToUpperInvariant()).ToHashSet();
            var reason = string.IsNullOrWhiteSpace(dto.Reason) ? "Pre-count sweep: deducted regardless of stock on hand" : dto.Reason.Trim();

            var loads = await _context.Loads
                .Where(l => l.Status != "Cancelled" && l.LoadType != InternalMovementsController.LoadTypeInternal && l.WarehouseId != null)
                .ToListAsync();
            loads = loads.Where(l => !exclude.Contains((l.LoadNumber ?? "").ToUpperInvariant())
                                     && (dto.UpTo == null || LoadStockGuard.DispatchDate(l) < dto.UpTo.Value.Date.AddDays(1)))
                        .ToList();
            var loadIds = loads.Select(l => l.Id).ToHashSet();

            var lines = await _context.StopCommodities
                .Include(sc => sc.LoadStop)
                .Where(sc => sc.Quantity > 0 && loadIds.Contains(sc.LoadStop.LoadId))
                .ToListAsync();

            // 1) stock items for unlinked lines: exact name match first; otherwise a pending (negative) key that is
            //    only turned into a real Commodity if the line actually deducts below.
            var unlinked = lines.Where(sc => sc.CommodityId == null).ToList();
            var created = 0;
            var keyOf = new Dictionary<int, int>(); // StopCommodity.Id -> commodity id (negative = pending creation)
            var pending = new Dictionary<int, Models.Logistics.Commodity>(); // negative key -> commodity to create
            if (unlinked.Count > 0)
            {
                var byName = (await _context.Commodities.Where(c => c.Name != "").Select(c => new { c.Id, c.Name }).ToListAsync())
                    .GroupBy(c => c.Name.Trim().ToLowerInvariant()).ToDictionary(g => g.Key, g => g.First().Id);
                var keyByName = new Dictionary<string, int>();
                foreach (var sc in unlinked)
                {
                    var name = (sc.Comment ?? "").Trim();
                    if (name.Length == 0) name = string.IsNullOrWhiteSpace(sc.ProductCode) ? $"Unnamed line {sc.Id}" : sc.ProductCode!.Trim();
                    var key = name.ToLowerInvariant();
                    if (byName.TryGetValue(key, out var id)) { keyOf[sc.Id] = id; continue; }
                    if (!keyByName.TryGetValue(key, out var pk))
                    {
                        pk = -(pending.Count + 1);
                        keyByName[key] = pk;
                        pending[pk] = new Models.Logistics.Commodity
                        {
                            Code = string.IsNullOrWhiteSpace(sc.ProductCode) ? $"DESC-{sc.Id}" : sc.ProductCode!.Trim(),
                            Name = name.Length > 200 ? name[..200] : name,
                            Description = "Created from tripsheet line during pre-count sweep — review code/name",
                            UnitOfMeasure = "Each",
                            CreatedAt = DateTime.UtcNow
                        };
                    }
                    keyOf[sc.Id] = pk;
                }
            }

            // 2) what each load already deducted
            var existing = (await _context.WarehouseStockMovements
                    .Where(m => m.LoadId != null && loadIds.Contains(m.LoadId.Value) && m.MovementType == "Dispatch" && m.Status == "Approved" && m.ReversedByMovementId == null)
                    .Select(m => new { LoadId = m.LoadId!.Value, m.CommodityId }).ToListAsync())
                .Select(x => (x.LoadId, x.CommodityId)).ToHashSet();

            // Lines counted after the load went out are already in that count — skip them (same rule as ApproveDispatch)
            var countOf = dto.IgnoreCounts ? new Dictionary<(int, int), DateTime>() : await _context.WarehouseInventory.AsNoTracking()
                .Where(i => i.LastCountDate != null)
                .Select(i => new { i.WarehouseId, i.CommodityId, Counted = i.LastCountDate!.Value })
                .ToDictionaryAsync(i => (i.WarehouseId, i.CommodityId), i => i.Counted);
            // Items never counted (incl. the stock items created just now) fall back to the warehouse's latest count date
            var warehouseCount = countOf.GroupBy(k => k.Key.Item1).ToDictionary(g => g.Key, g => g.Max(k => k.Value));
            var baselineSkipped = 0;

            var results = new List<object>();
            var movements = 0; var loadsTouched = 0; var negatives = 0;
            foreach (var load in loads.OrderBy(l => LoadStockGuard.DispatchDate(l)))
            {
                var dispatched = LoadStockGuard.DispatchDate(load);
                var candidates = lines.Where(sc => sc.LoadStop.LoadId == load.Id && (sc.CommodityId != null || keyOf.ContainsKey(sc.Id)))
                    .GroupBy(sc => sc.CommodityId ?? keyOf[sc.Id])
                    .Select(g => new { CommodityId = g.Key, Qty = g.Sum(x => x.Quantity) })
                    .Where(p => p.Qty > 0 && !existing.Contains((load.Id, p.CommodityId)))
                    .ToList();
                var plan = candidates.Where(p =>
                {
                    var wh = load.WarehouseId!.Value;
                    if (countOf.TryGetValue((wh, p.CommodityId), out var counted)) return !(dispatched < counted);
                    return !(warehouseCount.TryGetValue(wh, out var whCounted) && dispatched < whCounted);
                }).ToList();
                baselineSkipped += candidates.Count - plan.Count;
                if (plan.Count == 0) continue;
                loadsTouched++;
                var wouldCreate = plan.Count(p => p.CommodityId < 0 && pending.ContainsKey(p.CommodityId));
                if (dryRun) { created += wouldCreate; results.Add(new { load.LoadNumber, lines = plan.Count, qty = plan.Sum(p => p.Qty), newItems = wouldCreate }); movements += plan.Count; continue; }

                using var tx = await _context.Database.BeginTransactionAsync();
                var createdInTx = new List<Models.Logistics.Commodity>();
                try
                {
                    // Materialise pending stock items for this load's lines and link the lines to them
                    var loadLines = lines.Where(sc => sc.LoadStop.LoadId == load.Id && sc.CommodityId == null && keyOf.ContainsKey(sc.Id)).ToList();
                    foreach (var p in plan.Where(p => p.CommodityId < 0).ToList())
                    {
                        var c = pending[p.CommodityId];
                        if (c.Id == 0) { _context.Commodities.Add(c); await _context.SaveChangesAsync(); created++; createdInTx.Add(c); }
                        foreach (var sc in loadLines.Where(sc => keyOf[sc.Id] == p.CommodityId)) { sc.CommodityId = c.Id; sc.ProductCode ??= c.Code; }
                    }
                    foreach (var sc in loadLines.Where(sc => sc.CommodityId == null && keyOf[sc.Id] > 0)) sc.CommodityId = keyOf[sc.Id];
                    foreach (var p in plan)
                    {
                        var commodityId = p.CommodityId < 0 ? pending[p.CommodityId].Id : p.CommodityId;
                        var r = await StockLedger.ApplyAsync(_context, load.WarehouseId!.Value, commodityId, "Dispatch", -p.Qty, load.Id, null, load.LoadNumber, reason, CurrentUserName);
                        if (r.BalanceAfter < 0) negatives++;
                        movements++;
                    }
                    await _context.SaveChangesAsync();
                    await tx.CommitAsync();
                    results.Add(new { load.LoadNumber, lines = plan.Count, ok = true });
                }
                catch (Exception ex)
                {
                    await tx.RollbackAsync();
                    foreach (var c in createdInTx) { _context.Entry(c).State = EntityState.Detached; c.Id = 0; created--; }
                    _logger.LogError(ex, "Force-deduct failed for {Load}", load.LoadNumber);
                    results.Add(new { load.LoadNumber, lines = plan.Count, ok = false, error = ex.Message });
                }
            }
            _logger.LogWarning("Force-deduct by {User}: dryRun={Dry} loads={Loads} movements={Moves} stockItemsCreated={Created} negatives={Neg} excluded={Excl}",
                CurrentUserName, dryRun, loadsTouched, movements, created, negatives, string.Join(",", exclude));
            return Ok(new { dryRun, loadsConsidered = loads.Count, loadsTouched, movements, stockItemsCreated = created, wentNegative = negatives, baselineSkipped, excluded = exclude.Count, results });
        }

        // ═══ POST: one-off repair of loads created before stock lines were linked automatically ═══
        // 1) Loads made from sales invoices that got no stock lines at all get one line per invoice.
        // 2) Unlinked lines are linked by product code, taken from the line's invoice (when that settles
        //    on a single code) or a "CODE: Name" comment. Ambiguous lines are left for manual linking.
        // Cancelled loads and loads whose stock is already deducted are left alone. dryRun only reports.
        [HttpPost("loads/backfill-stock-lines")]
        public async Task<ActionResult<object>> BackfillLoadStockLines([FromQuery] bool dryRun = true)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = "You need the Stock Dispatch Approver permission to repair load stock lines" });

            var deductedLoadIds = await _context.WarehouseStockMovements
                .Where(m => m.LoadId != null && m.MovementType == "Dispatch" && m.Status == "Approved" && m.ReversedByMovementId == null)
                .Select(m => m.LoadId!.Value).Distinct().ToListAsync();
            var eligible = _context.Loads.Where(l => l.Status != "Cancelled" && !deductedLoadIds.Contains(l.Id));

            // 1) Invoice loads with stops but no stock lines
            var bareLoads = await eligible
                .Where(l => l.Stops.Any() && !l.Stops.SelectMany(s => s.Commodities).Any()
                            && _context.ImportedInvoices.Any(i => i.LoadId == l.Id))
                .Include(l => l.Stops)
                .ToListAsync();
            var bareIds = bareLoads.Select(l => l.Id).ToList();
            var bareInvoices = await _context.ImportedInvoices.Where(i => i.LoadId != null && bareIds.Contains(i.LoadId.Value)).ToListAsync();
            var createCodes = await CommodityCodeMatcher.BuildAsync(_context, bareInvoices.Select(i => i.ProductCode));

            int linesCreated = 0, createdLinked = 0;
            foreach (var load in bareLoads)
            {
                var stops = load.Stops.OrderBy(s => s.StopSequence).ToList();
                foreach (var inv in bareInvoices.Where(i => i.LoadId == load.Id))
                {
                    var stop = stops.FirstOrDefault(s => string.Equals((s.CompanyName ?? "").Trim(), inv.CustomerName.Trim(), StringComparison.OrdinalIgnoreCase))
                               ?? stops[0];
                    var commodityId = CommodityCodeMatcher.Match(createCodes, inv.ProductCode);
                    _context.StopCommodities.Add(new StopCommodity
                    {
                        LoadStopId = stop.Id,
                        CommodityId = commodityId,
                        ProductCode = inv.ProductCode,
                        Quantity = inv.Quantity,
                        UnitPrice = inv.SalesAmount / (inv.Quantity != 0 ? inv.Quantity : 1),
                        TotalPrice = inv.NetSales,
                        InvoiceNumber = inv.TransactionNumber,
                        Comment = inv.ProductDescription,
                        CreatedAt = DateTime.UtcNow
                    });
                    linesCreated++;
                    if (commodityId != null) createdLinked++;
                }
            }

            // 2) Existing lines with no stock item
            var unlinked = await _context.StopCommodities
                .Where(sc => sc.CommodityId == null && sc.Quantity > 0 && eligible.Any(l => l.Id == sc.LoadStop.LoadId))
                .ToListAsync();

            static List<string> InvoiceNumbers(string? s) =>
                (s ?? "").Split(new[] { ',', ';', '/' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
            var invoiceNumbers = unlinked.SelectMany(sc => InvoiceNumbers(sc.InvoiceNumber)).Distinct().ToList();
            var invoiceLines = await _context.ImportedInvoices.AsNoTracking()
                .Where(i => invoiceNumbers.Contains(i.TransactionNumber) && i.ProductCode != null && i.ProductCode != "")
                .Select(i => new { i.TransactionNumber, i.ProductCode, i.ProductDescription })
                .ToListAsync();
            var byInvoice = invoiceLines.ToLookup(i => i.TransactionNumber, StringComparer.OrdinalIgnoreCase);

            string? CodeFor(StopCommodity sc)
            {
                var candidates = InvoiceNumbers(sc.InvoiceNumber).SelectMany(n => byInvoice[n]).ToList();
                var described = candidates.Where(c => string.Equals((c.ProductDescription ?? "").Trim(), (sc.Comment ?? "").Trim(), StringComparison.OrdinalIgnoreCase)).ToList();
                foreach (var set in new[] { described, candidates })
                {
                    var codes = set.Select(c => CommodityCodeMatcher.Normalize(c.ProductCode)).Distinct().ToList();
                    if (codes.Count == 1) return codes[0];
                }
                // "CODE: Name" comments from the load editor
                var colon = (sc.Comment ?? "").IndexOf(':');
                return colon > 0 ? sc.Comment![..colon].Trim() : null;
            }

            var lineCodes = unlinked.Select(sc => new { sc, Code = CodeFor(sc) }).ToList();
            var linkCodes = await CommodityCodeMatcher.BuildAsync(_context, lineCodes.Select(x => x.Code));
            int linked = 0;
            foreach (var x in lineCodes)
            {
                var commodityId = CommodityCodeMatcher.Match(linkCodes, x.Code);
                if (commodityId == null) continue;
                x.sc.CommodityId = commodityId;
                linked++;
            }

            if (!dryRun)
            {
                await _context.SaveChangesAsync();
                _logger.LogInformation("Load stock-line backfill by {User}: {Created} lines created on {Loads} loads ({CreatedLinked} linked), {Linked} of {Unlinked} existing lines linked",
                    CurrentUserName, linesCreated, bareLoads.Count, createdLinked, linked, unlinked.Count);
            }

            return Ok(new
            {
                dryRun,
                loadsGivenLines = bareLoads.Count,
                linesCreated,
                linesCreatedLinked = createdLinked,
                existingUnlinked = unlinked.Count,
                existingLinked = linked,
                stillUnlinked = (linesCreated - createdLinked) + (unlinked.Count - linked)
            });
        }

        // ═══ POST: stock take — post counted quantities; each variance becomes an Adjustment ═══
        [HttpPost("stock-take")]
        public async Task<ActionResult<object>> PostStockTake([FromBody] StockTakeDto dto)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = StockAccess.Denied });

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
                var countedAt = DateTime.UtcNow;
                foreach (var line in dto.Lines)
                {
                    var movement = await StockLedger.PostCountAsync(_context, dto.WarehouseId, line.CommodityId,
                        line.CountedQuantity, countedAt, reference, dto.Reason, CurrentUserName);
                    if (movement == null) confirmed++; else adjusted++;
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
            catch (Exception ex) when (StockLedger.IsStockConflict(ex))
            {
                await tx.RollbackAsync();
                return Conflict(new { message = StockLedger.ConflictMessage });
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
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = StockAccess.Denied });

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
                    // A correction is an adjustment, not a count: it must not move the count date that
                    // decides which loads are already reflected in stock (see ApproveDispatch).
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
            try { await _context.SaveChangesAsync(); }
            catch (Exception ex) when (StockLedger.IsStockConflict(ex)) { return Conflict(new { message = StockLedger.ConflictMessage }); }
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
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = StockAccess.Denied });

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
                var reversal = await ReverseAsync(original, dto.Reason);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                return Ok(new { reversedMovementId = original.Id, reversalMovementId = reversal.Id });
            }
            catch (Exception ex) when (StockLedger.IsStockConflict(ex))
            {
                await tx.RollbackAsync();
                return Conflict(new { message = StockLedger.ConflictMessage });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error reversing movement {Id}", id);
                return StatusCode(500, new { message = "An error occurred while reversing the movement" });
            }
        }

        // ═══ POST: reverse every stock deduction for one load ═══
        // Loads with stock deducted can't be edited, cancelled or deleted (LoadStockGuard);
        // this puts the whole load's stock back in one step so they can.
        [HttpPost("loads/{loadId}/reverse-dispatch")]
        public async Task<ActionResult<object>> ReverseLoadDispatch(int loadId, [FromBody] ReverseDto dto)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = "You need the Stock Dispatch Approver permission to reverse movements" });
            if (string.IsNullOrWhiteSpace(dto.Reason)) return BadRequest(new { message = "A reason is required for reversals" });

            var deductions = await _context.WarehouseStockMovements
                .Where(m => m.LoadId == loadId && m.MovementType == "Dispatch" && m.Status == "Approved" && m.ReversedByMovementId == null)
                .ToListAsync();
            if (deductions.Count == 0) return NotFound(new { message = "No stock has been deducted for this load" });

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                foreach (var original in deductions)
                    await ReverseAsync(original, dto.Reason);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                return Ok(new { loadId, reversedLines = deductions.Count });
            }
            catch (Exception ex) when (StockLedger.IsStockConflict(ex))
            {
                await tx.RollbackAsync();
                return Conflict(new { message = StockLedger.ConflictMessage });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error reversing the dispatch of load {LoadId}", loadId);
                return StatusCode(500, new { message = "An error occurred while reversing the load's dispatch" });
            }
        }

        // ═══ POST: reconcile tripsheet line quantities against the Sales invoice lines ═══
        // Older tripsheet imports parsed "20 x 50" as 2050. For every stop line whose invoice
        // number matches a Sales-imported invoice exactly, rebuild the lines from the Sales
        // quantities (one line per product, linked by stock code) and, where stock was already
        // deducted for that load, post the difference so the ledger matches the corrected lines.
        // Dry-run by default — pass apply=true to write.
        [HttpPost("reconcile-tripsheet-quantities")]
        public async Task<ActionResult<object>> ReconcileTripsheetQuantities([FromBody] ReconcileTripsheetDto dto)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = "You need the Stock Dispatch Approver permission to reconcile quantities" });

            static string Norm(string? s) => (s ?? "").Trim().ToUpperInvariant().Replace(" ", "").Replace("-", "");

            // Sales-imported invoice lines (authoritative quantities)
            var salesRows = await _context.ImportedInvoices.AsNoTracking()
                .Where(i => i.ProductCode != "IMP" && i.Quantity > 0
                         && (i.SourceSystem == null || !i.SourceSystem.StartsWith("TripSheet")))
                .Select(i => new { i.Id, i.TransactionNumber, i.ProductCode, i.ProductDescription, i.Quantity })
                .ToListAsync();
            var salesByInv = salesRows.GroupBy(r => Norm(r.TransactionNumber))
                .ToDictionary(g => g.Key, g => g.OrderBy(r => r.Id).ToList());

            // Tripsheet lines, grouped per load + invoice (single-invoice lines only)
            var tripQuery = _context.StopCommodities.Include(sc => sc.LoadStop)
                .Where(sc => sc.InvoiceNumber != null && sc.InvoiceNumber != "" && !sc.InvoiceNumber.Contains(","));
            if (dto.LoadId is int onlyLoad) tripQuery = tripQuery.Where(sc => sc.LoadStop.LoadId == onlyLoad);
            var tripLines = await tripQuery.ToListAsync();
            var tripGroups = tripLines.GroupBy(sc => (sc.LoadStop.LoadId, Inv: Norm(sc.InvoiceNumber))).ToList();

            var codes = salesRows.Select(r => r.ProductCode).Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList();
            var commodityByCode = (await _context.Commodities.AsNoTracking()
                    .Where(c => c.Code != null && codes.Contains(c.Code))
                    .Select(c => new { c.Code, c.Id }).ToListAsync())
                .GroupBy(c => c.Code!, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

            var fixes = new List<object>();
            var touchedLoads = new HashSet<int>();
            var removedIds = new HashSet<int>();
            var added = new List<(int LoadId, StopCommodity Line)>();
            int linesRemoved = 0, linesAdded = 0, unresolvedLines = 0;

            foreach (var g in tripGroups)
            {
                if (!salesByInv.TryGetValue(g.Key.Inv, out var sales)) continue;
                var old = g.OrderBy(x => x.Id).ToList();
                var oldSum = old.Sum(x => x.Quantity);
                var salesSum = sales.Sum(s => s.Quantity);
                if (oldSum == salesSum) continue;

                var first = old[0];
                var valueTotal = old.Sum(x => x.TotalPrice ?? 0);
                var unitTotal = old.Sum(x => x.UnitPrice ?? 0);
                var newLines = new List<StopCommodity>();
                for (int i = 0; i < sales.Count; i++)
                {
                    var s = sales[i];
                    int? commodityId = null;
                    if (!string.IsNullOrWhiteSpace(s.ProductCode) && commodityByCode.TryGetValue(s.ProductCode, out var cid)) commodityId = cid;
                    else if (old.Count == 1 && sales.Count == 1) commodityId = first.CommodityId;
                    else
                    {
                        var byName = old.FirstOrDefault(o => o.CommodityId != null &&
                            string.Equals(NormalizeName(o.Comment), NormalizeName(s.ProductDescription), StringComparison.OrdinalIgnoreCase));
                        commodityId = byName?.CommodityId;
                    }
                    if (commodityId == null) unresolvedLines++;

                    newLines.Add(new StopCommodity
                    {
                        LoadStopId = first.LoadStopId,
                        CommodityId = commodityId,
                        ProductCode = string.IsNullOrWhiteSpace(s.ProductCode) ? first.ProductCode : s.ProductCode,
                        Quantity = s.Quantity,
                        UnitOfMeasure = first.UnitOfMeasure,
                        UnitPrice = i == 0 ? unitTotal : 0,
                        TotalPrice = i == 0 ? valueTotal : 0,
                        InvoiceNumber = first.InvoiceNumber,
                        OrderNumber = first.OrderNumber,
                        Brand = first.Brand,
                        Comment = string.IsNullOrWhiteSpace(s.ProductDescription) ? first.Comment : s.ProductDescription,
                        CreatedAt = first.CreatedAt
                    });
                }

                fixes.Add(new
                {
                    loadId = g.Key.LoadId, invoice = first.InvoiceNumber,
                    tripQty = oldSum, salesQty = salesSum, oldLines = old.Count, newLines = newLines.Count,
                    unlinked = newLines.Count(n => n.CommodityId == null)
                });
                touchedLoads.Add(g.Key.LoadId);
                linesRemoved += old.Count; linesAdded += newLines.Count;
                foreach (var o in old) removedIds.Add(o.Id);
                foreach (var n in newLines) added.Add((g.Key.LoadId, n));

                if (dto.Apply)
                {
                    _context.StopCommodities.RemoveRange(old);
                    _context.StopCommodities.AddRange(newLines);
                }
            }

            // Stock ledger: where a touched load already had stock deducted, bring the deduction in line
            var stockFixes = new List<object>();
            decimal unitsReturned = 0, unitsDeducted = 0;
            if (touchedLoads.Count > 0)
            {
                var loadIds = touchedLoads.ToList();
                var live = await _context.WarehouseStockMovements
                    .Where(m => m.LoadId != null && loadIds.Contains(m.LoadId.Value) && m.MovementType == "Dispatch"
                             && m.Status == "Approved" && m.ReversedByMovementId == null)
                    .Select(m => new { LoadId = m.LoadId!.Value, m.WarehouseId, m.CommodityId, m.Quantity })
                    .ToListAsync();
                var loadNos = await _context.Loads.AsNoTracking().Where(l => loadIds.Contains(l.Id))
                    .ToDictionaryAsync(l => l.Id, l => l.LoadNumber);

                // planned per (load, commodity) AFTER the fix: surviving single-invoice lines + new lines + other lines
                var planned = new Dictionary<(int, int), decimal>();
                void AddPlanned(int loadId, int? commodityId, decimal qty)
                {
                    if (commodityId == null || qty <= 0 || !touchedLoads.Contains(loadId)) return;
                    var k = (loadId, commodityId.Value);
                    planned[k] = (planned.TryGetValue(k, out var p) ? p : 0) + qty;
                }
                foreach (var t in tripLines.Where(t => !removedIds.Contains(t.Id))) AddPlanned(t.LoadStop.LoadId, t.CommodityId, t.Quantity);
                foreach (var a in added) AddPlanned(a.LoadId, a.Line.CommodityId, a.Line.Quantity);
                var otherLines = await _context.StopCommodities.AsNoTracking()
                    .Where(sc => loadIds.Contains(sc.LoadStop.LoadId) && sc.CommodityId != null && sc.Quantity > 0
                              && (sc.InvoiceNumber == null || sc.InvoiceNumber == "" || sc.InvoiceNumber.Contains(",")))
                    .Select(sc => new { sc.LoadStop.LoadId, CommodityId = sc.CommodityId!.Value, sc.Quantity })
                    .ToListAsync();
                foreach (var o in otherLines) AddPlanned(o.LoadId, o.CommodityId, o.Quantity);

                foreach (var grp in live.GroupBy(m => (m.LoadId, m.WarehouseId, m.CommodityId)))
                {
                    var deducted = grp.Sum(m => Math.Abs(m.Quantity));
                    // Zero-quantity "Dispatch" rows are stock-count baseline markers ("already reflected in
                    // the count"), not real deductions — the corrected lines are already in that count too.
                    if (deducted == 0) continue;
                    var want = planned.TryGetValue((grp.Key.LoadId, grp.Key.CommodityId), out var p) ? p : 0;
                    var delta = deducted - want; // positive = we took too much, give it back
                    if (delta == 0) continue;
                    var loadNo = loadNos.TryGetValue(grp.Key.LoadId, out var ln) ? ln : grp.Key.LoadId.ToString();
                    stockFixes.Add(new { loadId = grp.Key.LoadId, loadNumber = loadNo, commodityId = grp.Key.CommodityId, deducted, corrected = want, adjustment = delta });
                    if (delta > 0) unitsReturned += delta; else unitsDeducted -= delta;
                    if (dto.Apply)
                    {
                        // Always an Adjustment (either sign): the live Dispatch row per load+item is unique,
                        // so a second Dispatch for the same pair would violate UX_WarehouseStockMovements_LiveDispatch.
                        await ApplyMovementAsync(grp.Key.WarehouseId, grp.Key.CommodityId,
                            "Adjustment", delta, grp.Key.LoadId, null,
                            $"QTY-FIX {loadNo}",
                            $"Tripsheet quantity corrected from Sales invoice lines ({deducted:0.##} → {want:0.##}); '20 x 50' had been read as 2050");
                    }
                }
            }

            if (dto.Apply)
            {
                await _context.SaveChangesAsync();
                _logger.LogWarning("Tripsheet quantity reconciliation applied by {User}: {Groups} invoice group(s), {Loads} load(s), {Stock} stock correction(s)",
                    CurrentUserName, fixes.Count, touchedLoads.Count, stockFixes.Count);
            }

            return Ok(new
            {
                applied = dto.Apply,
                invoiceGroupsFixed = fixes.Count,
                loadsTouched = touchedLoads.Count,
                linesRemoved, linesAdded, unresolvedLines,
                stockCorrections = stockFixes.Count,
                stockUnitsReturned = unitsReturned,
                stockUnitsDeducted = unitsDeducted,
                fixes, stockFixes
            });
        }

        // ───────────────────────── Ask Welly: inter-company (same warehouse) transfer suggestions ─────────────────────────

        /// <summary>
        /// Looks at the lines that would go negative and finds other stock codes in the SAME warehouse that are the
        /// same physical item (same code under another company, or the same name) with stock to spare.
        /// Welly (Claude) ranks/explains the candidates; a deterministic fallback is used when AI is unavailable.
        /// </summary>
        [HttpPost("ask-welly")]
        public async Task<ActionResult<object>> AskWelly([FromBody] AskWellyDto dto)
        {
            if (dto.WarehouseId <= 0 || dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest(new { message = "warehouseId and lines are required" });

            var warehouse = await _context.Warehouses.AsNoTracking().FirstOrDefaultAsync(w => w.Id == dto.WarehouseId);
            if (warehouse == null) return NotFound(new { message = "Warehouse not found" });

            var inventory = await _context.WarehouseInventory.AsNoTracking()
                .Where(i => i.WarehouseId == dto.WarehouseId)
                .Select(i => new { i.CommodityId, i.QuantityOnHand, i.Commodity!.Code, i.Commodity.Name, i.Commodity.Category, i.Commodity.UnitOfMeasure })
                .ToListAsync();
            var onHandById = inventory.ToDictionary(i => i.CommodityId, i => i.QuantityOnHand);

            var requestedIds = dto.Lines.Select(l => l.CommodityId).Distinct().ToList();
            var requested = await _context.Commodities.AsNoTracking()
                .Where(c => requestedIds.Contains(c.Id))
                .Select(c => new { c.Id, c.Code, c.Name, c.Category, c.UnitOfMeasure })
                .ToListAsync();

            var shortLines = new List<object>();
            var suggestions = new List<WellySuggestion>();

            foreach (var line in dto.Lines)
            {
                var c = requested.FirstOrDefault(r => r.Id == line.CommodityId);
                if (c == null) continue;
                var onHand = onHandById.TryGetValue(line.CommodityId, out var q) ? q : 0m;
                var shortfall = line.Quantity - onHand;
                if (shortfall <= 0) continue;

                var normCode = CommodityCodeMatcher.Normalize(c.Code);
                var normName = NormalizeName(c.Name);

                var candidates = inventory
                    .Where(i => i.CommodityId != c.Id && i.QuantityOnHand > 0)
                    .Select(i =>
                    {
                        var iCode = CommodityCodeMatcher.Normalize(i.Code);
                        var iName = NormalizeName(i.Name);
                        int score = 0;
                        string why;
                        if (normCode.Length > 0 && iCode == normCode) { score = 100; why = "Same stock code under another company"; }
                        else if (normCode.Length >= 6 && (iCode.StartsWith(normCode) || normCode.StartsWith(iCode)) && Math.Abs(iCode.Length - normCode.Length) <= 3)
                        { score = 80; why = "Stock code differs only by a suffix"; }
                        else if (normName.Length > 0 && iName == normName) { score = 75; why = "Same description"; }
                        else if (normName.Length >= 8 && (iName.Contains(normName) || normName.Contains(iName))) { score = 55; why = "Description matches closely"; }
                        else { why = ""; }
                        return new { i, score, why };
                    })
                    .Where(x => x.score > 0)
                    .OrderByDescending(x => x.score).ThenByDescending(x => x.i.QuantityOnHand)
                    .Take(6)
                    .ToList();

                shortLines.Add(new
                {
                    commodityId = c.Id, code = c.Code, name = c.Name, company = c.Category, uom = c.UnitOfMeasure,
                    requested = line.Quantity, onHand, shortfall
                });

                foreach (var cand in candidates)
                {
                    suggestions.Add(new WellySuggestion
                    {
                        ToCommodityId = c.Id, ToCode = c.Code ?? "", ToName = c.Name, ToCompany = c.Category, Shortfall = shortfall,
                        FromCommodityId = cand.i.CommodityId, FromCode = cand.i.Code ?? "", FromName = cand.i.Name,
                        FromCompany = cand.i.Category, FromOnHand = cand.i.QuantityOnHand,
                        Quantity = Math.Min(shortfall, cand.i.QuantityOnHand),
                        Confidence = cand.score, Reason = cand.why
                    });
                }
            }

            if (shortLines.Count == 0)
                return Ok(new { note = "Nothing is short on this load – no transfers needed.", shortLines, suggestions });

            string note;
            if (suggestions.Count == 0)
            {
                note = $"I checked {inventory.Count} stock codes in {warehouse.Name} and couldn't find the same item under another code with stock to spare. " +
                       "You'll need a receipt, a warehouse-to-warehouse transfer, or approve with a reason.";
            }
            else
            {
                note = await WellyNarrateAsync(warehouse.Name, shortLines, suggestions);
            }

            return Ok(new { note, shortLines, suggestions });
        }

        private async Task<string> WellyNarrateAsync(string warehouseName, List<object> shortLines, List<WellySuggestion> suggestions)
        {
            var fullyCoverable = suggestions.GroupBy(s => s.ToCommodityId)
                .Count(g => g.Sum(s => s.Quantity) >= g.First().Shortfall);
            var fallback = $"Found {suggestions.Count} possible inter-company transfer(s) in {warehouseName} for {shortLines.Count} short line(s); " +
                (fullyCoverable == shortLines.Count ? "all shortfalls can be covered." : $"{fullyCoverable} of {shortLines.Count} can be fully covered.");

            if (_claude == null) return fallback;
            try
            {
                if (!await _claude.IsAvailableAsync()) return fallback;
                var payload = JsonSerializer.Serialize(new
                {
                    warehouse = warehouseName,
                    shortLines,
                    suggestions = suggestions.Select(s => new
                    {
                        s.ToCode, s.ToName, s.ToCompany, s.Shortfall, s.FromCode, s.FromName, s.FromCompany, s.FromOnHand, s.Quantity, s.Confidence, s.Reason
                    })
                });
                var system = "You are Welly, the warehouse assistant for a medical-supplies group (Promed, Access, Pharmacare, Sebenzani). " +
                             "Different companies hold the same physical item under their own stock code in the same warehouse. " +
                             "A dispatch is about to go negative. Given the short lines and the candidate inter-company transfers, write a short, " +
                             "practical recommendation (max 4 sentences, plain text, no markdown, no lists): which transfers to do, quantities, and anything to double-check " +
                             "(e.g. a candidate whose description suggests a different size/pack). Be direct and friendly.";
                var text = await _claude.AnalyzeDocumentAsync(system, payload);
                return string.IsNullOrWhiteSpace(text) ? fallback : text.Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Welly narration failed; using fallback");
                return fallback;
            }
        }

        private static string NormalizeName(string? name) =>
            new string((name ?? "").Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

        /// <summary>
        /// Moves stock between two stock codes (companies) of the same item inside ONE warehouse:
        /// -qty off the source code, +qty onto the target code, both as "Transfer" ledger rows.
        /// </summary>
        [HttpPost("intercompany-transfer")]
        public async Task<ActionResult<object>> IntercompanyTransfer([FromBody] IntercompanyTransferDto dto)
        {
            if (!await IsDispatchApproverAsync())
                return StatusCode(403, new { message = "Only stock approvers can do inter-company transfers" });
            if (dto.Quantity <= 0) return BadRequest(new { message = "Quantity must be positive" });
            if (dto.FromCommodityId == dto.ToCommodityId) return BadRequest(new { message = "Source and target stock codes must differ" });

            var from = await _context.Commodities.FindAsync(dto.FromCommodityId);
            var to = await _context.Commodities.FindAsync(dto.ToCommodityId);
            if (from == null || to == null) return NotFound(new { message = "Stock code not found" });
            if (!await _context.Warehouses.AnyAsync(w => w.Id == dto.WarehouseId)) return NotFound(new { message = "Warehouse not found" });

            var srcOnHand = await _context.WarehouseInventory
                .Where(i => i.WarehouseId == dto.WarehouseId && i.CommodityId == dto.FromCommodityId)
                .Select(i => (decimal?)i.QuantityOnHand).FirstOrDefaultAsync() ?? 0m;
            if (srcOnHand < dto.Quantity && string.IsNullOrWhiteSpace(dto.Reason))
                return BadRequest(new { message = $"Only {srcOnHand:0.##} on hand for {from.Code}; a reason is required to take it negative" });

            string? loadNo = null;
            if (dto.LoadId is int lid)
                loadNo = await _context.Loads.Where(l => l.Id == lid).Select(l => l.LoadNumber).FirstOrDefaultAsync();

            static string Tag(Commodity c) => string.IsNullOrWhiteSpace(c.Category) ? (c.Code ?? "") : $"{c.Category}/{c.Code}";
            var reference = $"ICT {Tag(from)} → {Tag(to)}" + (loadNo != null ? $" ({loadNo})" : "");
            var reason = string.IsNullOrWhiteSpace(dto.Reason) ? $"Inter-company transfer to cover {Tag(to)}" : dto.Reason.Trim();

            await using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var outMv = await ApplyMovementAsync(dto.WarehouseId, dto.FromCommodityId, "Transfer", -dto.Quantity, dto.LoadId, null, reference, reason);
                var inMv = await ApplyMovementAsync(dto.WarehouseId, dto.ToCommodityId, "Transfer", dto.Quantity, dto.LoadId, null, reference, reason);
                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                var balances = await _context.WarehouseInventory.AsNoTracking()
                    .Where(i => i.WarehouseId == dto.WarehouseId && (i.CommodityId == dto.FromCommodityId || i.CommodityId == dto.ToCommodityId))
                    .Select(i => new { i.CommodityId, i.QuantityOnHand }).ToListAsync();

                _logger.LogInformation("Inter-company transfer {Qty} {From} -> {To} in warehouse {Wh} by {User}",
                    dto.Quantity, from.Code, to.Code, dto.WarehouseId, CurrentUserName);

                return Ok(new
                {
                    message = $"Moved {dto.Quantity:0.##} from {from.Code} to {to.Code}",
                    reference,
                    fromOnHand = balances.FirstOrDefault(b => b.CommodityId == dto.FromCommodityId)?.QuantityOnHand ?? 0m,
                    toOnHand = balances.FirstOrDefault(b => b.CommodityId == dto.ToCommodityId)?.QuantityOnHand ?? 0m,
                    movements = new[] { outMv, inMv }
                });
            }
            catch (InvalidOperationException ex)
            {
                await tx.RollbackAsync();
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Inter-company transfer failed");
                return StatusCode(500, new { message = "An error occurred while transferring stock" });
            }
        }

        /// <summary>Posts the opposite of an approved movement and links the two (caller saves and commits).</summary>
        private async Task<WarehouseStockMovement> ReverseAsync(WarehouseStockMovement original, string reason)
        {
            var reversal = (WarehouseStockMovement)(await ApplyMovementAsync(original.WarehouseId, original.CommodityId,
                "Reversal", -original.Quantity, original.LoadId, original.TransferId,
                $"REV of #{original.Id} ({original.Reference})", reason, returnEntity: true))!;
            original.ReversedByMovementId = reversal.Id;
            reversal.ReversesMovementId = original.Id;
            return reversal;
        }

        /// <summary>Posts through the shared StockLedger (caller saves and controls the transaction).</summary>
        private async Task<object?> ApplyMovementAsync(int warehouseId, int commodityId, string movementType,
            decimal signedQty, int? loadId, int? transferId, string? reference, string? reason, bool returnEntity = false)
        {
            var movement = await StockLedger.ApplyAsync(_context, warehouseId, commodityId, movementType, signedQty,
                loadId, transferId, reference, reason, CurrentUserName);

            if (returnEntity)
            {
                await _context.SaveChangesAsync(); // need Id for reversal linking
                return movement;
            }
            return new { commodityId, movementType, quantity = signedQty, balanceAfter = movement.BalanceAfter };
        }
    }

    public class ReconcileTripsheetDto
    {
        public bool Apply { get; set; }
        public int? LoadId { get; set; }
    }

    public class ForceDeductDto
    {
        public List<string>? ExcludeLoadNumbers { get; set; }
        public DateTime? UpTo { get; set; }
        public string? Reason { get; set; }
        /// <summary>Also deduct lines that were counted after the load left (double-counts against the stock take). Off by default.</summary>
        public bool IgnoreCounts { get; set; }
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

    public class AskWellyDto
    {
        public int WarehouseId { get; set; }
        public int? LoadId { get; set; }
        public List<AskWellyLineDto> Lines { get; set; } = new();
    }

    public class AskWellyLineDto
    {
        public int CommodityId { get; set; }
        public decimal Quantity { get; set; }
    }

    public class WellySuggestion
    {
        public int ToCommodityId { get; set; }
        public string ToCode { get; set; } = "";
        public string ToName { get; set; } = "";
        public string? ToCompany { get; set; }
        public decimal Shortfall { get; set; }
        public int FromCommodityId { get; set; }
        public string FromCode { get; set; } = "";
        public string FromName { get; set; } = "";
        public string? FromCompany { get; set; }
        public decimal FromOnHand { get; set; }
        public decimal Quantity { get; set; }
        public int Confidence { get; set; }
        public string Reason { get; set; } = "";
    }

    public class IntercompanyTransferDto
    {
        public int WarehouseId { get; set; }
        public int FromCommodityId { get; set; }
        public int ToCommodityId { get; set; }
        public decimal Quantity { get; set; }
        public int? LoadId { get; set; }
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
        /// <summary>Bulk/pre-count use only: deduct the linked lines and leave unlinked ones (which cannot deduct) behind, instead of refusing.</summary>
        public bool SkipUnlinked { get; set; }
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


