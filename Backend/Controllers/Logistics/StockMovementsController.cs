using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services.Logistics;
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

        public StockMovementsController(ApplicationDbContext context, ILogger<StockMovementsController> logger)
        {
            _context = context;
            _logger = logger;
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
                .Where(l => l.Status != "Cancelled")
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
            if (unlinked > 0)
                return Conflict(new
                {
                    message = $"{unlinked} line(s) on {load.LoadNumber} aren't linked to a stock item yet. Link every line before approving.",
                    unlinkedLines = unlinked
                });

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
                return Ok(new { loadId = dto.LoadId, loadNumber = load.LoadNumber, lines = toDeduct.Count, skippedLines = skipped, message });
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
