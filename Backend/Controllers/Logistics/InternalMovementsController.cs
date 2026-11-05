using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services.Logistics;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Internal movements: stock travelling between our own warehouses on a trip.
    /// An internal movement is a Load (LoadType = InternalTransfer) so it gets a load number, a vehicle,
    /// a driver and shows on the dispatch board like any other trip — but instead of a customer dispatch
    /// it posts Transfer rows to the stock ledger: out of the source when it leaves, into the destination
    /// when it is received.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/logistics/internal-movements")]
    public class InternalMovementsController : ControllerBase
    {
        public const string LoadTypeInternal = "InternalTransfer";

        private readonly ApplicationDbContext _context;
        private readonly ILogger<InternalMovementsController> _logger;

        public InternalMovementsController(ApplicationDbContext context, ILogger<InternalMovementsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string CurrentUserName =>
            User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email) ?? "Unknown";
        private int? CurrentUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

        // ═══ GET: list internal movement trips ═══
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> List([FromQuery] string? status, [FromQuery] int days = 90, [FromQuery] int limit = 300)
        {
            var since = DateTime.UtcNow.AddDays(-Math.Clamp(days, 1, 3650));
            var q = _context.Loads.AsNoTracking()
                .Where(l => l.LoadType == LoadTypeInternal)
                .Where(l => l.CreatedAt >= since || (l.Status != "Delivered" && l.Status != "Completed" && l.Status != "Cancelled"));
            if (!string.IsNullOrWhiteSpace(status)) q = q.Where(l => l.Status == status);

            var loads = await q.OrderByDescending(l => l.CreatedAt).Take(Math.Clamp(limit, 1, 2000)).ToListAsync();
            var ids = loads.Select(l => l.Id).ToList();
            return Ok(await ProjectAsync(loads, ids));
        }

        [HttpGet("{id:int}")]
        public async Task<ActionResult<object>> Get(int id)
        {
            var load = await _context.Loads.AsNoTracking().FirstOrDefaultAsync(l => l.Id == id && l.LoadType == LoadTypeInternal);
            if (load == null) return NotFound(new { message = "Internal movement not found" });
            var rows = await ProjectAsync(new List<Load> { load }, new List<int> { id });
            return Ok(rows.First());
        }

        private async Task<List<object>> ProjectAsync(List<Load> loads, List<int> ids)
        {
            var whIds = loads.SelectMany(l => new[] { l.WarehouseId, l.DestinationWarehouseId }).Where(x => x != null).Select(x => x!.Value).Distinct().ToList();
            var warehouses = await _context.Warehouses.AsNoTracking().Where(w => whIds.Contains(w.Id)).ToDictionaryAsync(w => w.Id, w => w.Name);
            var vehIds = loads.Where(l => l.VehicleId != null).Select(l => l.VehicleId!.Value).Distinct().ToList();
            var vehicles = await _context.Vehicles.AsNoTracking().Where(v => vehIds.Contains(v.Id))
                .ToDictionaryAsync(v => v.Id, v => new { v.RegistrationNumber, Name = (v.Make + " " + v.Model).Trim() });
            var drvIds = loads.Where(l => l.DriverId != null).Select(l => l.DriverId!.Value).Distinct().ToList();
            var drivers = await _context.Drivers.AsNoTracking().Where(d => drvIds.Contains(d.Id))
                .ToDictionaryAsync(d => d.Id, d => (d.FirstName + " " + d.LastName).Trim());

            var lines = await _context.StopCommodities.AsNoTracking()
                .Where(sc => ids.Contains(sc.LoadStop.LoadId))
                .Select(sc => new
                {
                    sc.LoadStop.LoadId, sc.Id, sc.CommodityId, sc.Quantity, sc.UnitOfMeasure,
                    Code = sc.Commodity != null ? sc.Commodity.Code : sc.ProductCode,
                    Name = sc.Commodity != null ? sc.Commodity.Name : sc.Comment
                })
                .ToListAsync();
            var byLoad = lines.ToLookup(x => x.LoadId);

            var ledger = await _context.WarehouseStockMovements.AsNoTracking()
                .Where(m => m.LoadId != null && ids.Contains(m.LoadId.Value) && m.MovementType == "Transfer" && m.Status == "Approved" && m.ReversedByMovementId == null)
                .Select(m => new { LoadId = m.LoadId!.Value, m.WarehouseId, m.Quantity })
                .ToListAsync();
            var ledgerByLoad = ledger.ToLookup(x => x.LoadId);

            var users = loads.Where(l => l.CreatedByUserId != null).Select(l => l.CreatedByUserId!.Value).Distinct().ToList();
            var userNames = await _context.Users.AsNoTracking().Where(u => users.Contains(u.UserId))
                .ToDictionaryAsync(u => u.UserId, u => (u.Name + " " + u.Surname).Trim());

            return loads.Select(l =>
            {
                var ll = byLoad[l.Id].ToList();
                var led = ledgerByLoad[l.Id].ToList();
                var outPosted = l.WarehouseId != null && led.Any(x => x.WarehouseId == l.WarehouseId && x.Quantity < 0);
                var inPosted = l.DestinationWarehouseId != null && led.Any(x => x.WarehouseId == l.DestinationWarehouseId && x.Quantity > 0);
                return (object)new
                {
                    id = l.Id,
                    loadNumber = l.LoadNumber,
                    status = l.Status,
                    priority = l.Priority,
                    fromWarehouseId = l.WarehouseId,
                    fromWarehouseName = l.WarehouseId != null && warehouses.TryGetValue(l.WarehouseId.Value, out var fn) ? fn : null,
                    toWarehouseId = l.DestinationWarehouseId,
                    toWarehouseName = l.DestinationWarehouseId != null && warehouses.TryGetValue(l.DestinationWarehouseId.Value, out var tn) ? tn : null,
                    vehicleId = l.VehicleId,
                    vehicleRegistration = l.VehicleId != null && vehicles.TryGetValue(l.VehicleId.Value, out var v) ? v.RegistrationNumber : null,
                    vehicleName = l.VehicleId != null && vehicles.TryGetValue(l.VehicleId.Value, out var v2) ? v2.Name : null,
                    driverId = l.DriverId,
                    driverName = l.DriverId != null && drivers.TryGetValue(l.DriverId.Value, out var dn) ? dn : null,
                    scheduledDate = l.ScheduledPickupDate,
                    dispatchedAt = l.ActualPickupDate,
                    receivedAt = l.ActualDeliveryDate,
                    notes = l.Notes,
                    createdAt = l.CreatedAt,
                    createdBy = l.CreatedByUserId != null && userNames.TryGetValue(l.CreatedByUserId.Value, out var cb) ? cb : null,
                    lineCount = ll.Count,
                    totalUnits = ll.Sum(x => x.Quantity),
                    unlinkedLines = ll.Count(x => x.CommodityId == null),
                    stockOutPosted = outPosted,
                    stockInPosted = inPosted,
                    lines = ll.Select(x => new { x.Id, x.CommodityId, code = x.Code, name = x.Name, x.Quantity, x.UnitOfMeasure }).ToList()
                };
            }).ToList();
        }

        // ═══ POST: create an internal movement trip ═══
        [HttpPost]
        public async Task<ActionResult<object>> Create([FromBody] CreateInternalMovementDto dto)
        {
            if (dto.FromWarehouseId == dto.ToWarehouseId) return BadRequest(new { message = "Source and destination warehouses must differ" });
            var from = await _context.Warehouses.FindAsync(dto.FromWarehouseId);
            var to = await _context.Warehouses.FindAsync(dto.ToWarehouseId);
            if (from == null || to == null) return NotFound(new { message = "Warehouse not found" });
            var lines = (dto.Lines ?? new()).Where(l => l.Quantity > 0).GroupBy(l => l.CommodityId)
                .Select(g => new { CommodityId = g.Key, Qty = g.Sum(x => x.Quantity) }).ToList();
            if (lines.Count == 0) return BadRequest(new { message = "Add at least one stock line with a quantity" });
            var commodityIds = lines.Select(l => l.CommodityId).ToList();
            var commodities = await _context.Commodities.Where(c => commodityIds.Contains(c.Id)).ToDictionaryAsync(c => c.Id);
            var missing = commodityIds.Where(c => !commodities.ContainsKey(c)).ToList();
            if (missing.Count > 0) return BadRequest(new { message = $"{missing.Count} line(s) refer to a stock item that doesn't exist" });

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var load = new Load
                {
                    LoadNumber = await GenerateLoadNumberAsync(),
                    LoadType = LoadTypeInternal,
                    WarehouseId = from.Id,
                    DestinationWarehouseId = to.Id,
                    VehicleId = dto.VehicleId,
                    DriverId = dto.DriverId,
                    CreatedByUserId = CurrentUserId(),
                    PickupLocation = FormatAddress(from),
                    PickupLatitude = from.Latitude,
                    PickupLongitude = from.Longitude,
                    DeliveryLocation = FormatAddress(to),
                    DeliveryLatitude = to.Latitude,
                    DeliveryLongitude = to.Longitude,
                    Status = dto.DriverId.HasValue ? "Assigned" : "Available",
                    Priority = string.IsNullOrWhiteSpace(dto.Priority) ? "Normal" : dto.Priority!,
                    ScheduledPickupDate = dto.ScheduledDate,
                    ScheduledDeliveryDate = dto.ScheduledDate,
                    Notes = dto.Notes,
                    SpecialInstructions = $"Internal stock movement {from.Name} → {to.Name}"
                };
                _context.Loads.Add(load);
                await _context.SaveChangesAsync();

                var pickup = new LoadStop
                {
                    LoadId = load.Id, StopSequence = 1, StopType = "Pickup", WarehouseId = from.Id,
                    CompanyName = from.Name, LocationName = from.Name, Address = FormatAddress(from),
                    City = from.City, Province = from.Province, PostalCode = from.PostalCode,
                    Latitude = from.Latitude, Longitude = from.Longitude, ContactPerson = from.ManagerName, ContactPhone = from.PhoneNumber,
                    ScheduledArrival = dto.ScheduledDate, Status = "Pending"
                };
                var dest = new LoadStop
                {
                    LoadId = load.Id, StopSequence = 2, StopType = "Destination", WarehouseId = to.Id,
                    CompanyName = to.Name, LocationName = to.Name, Address = FormatAddress(to),
                    City = to.City, Province = to.Province, PostalCode = to.PostalCode,
                    Latitude = to.Latitude, Longitude = to.Longitude, ContactPerson = to.ManagerName, ContactPhone = to.PhoneNumber,
                    ScheduledArrival = dto.ScheduledDate, Status = "Pending", Notes = dto.Notes
                };
                _context.LoadStops.AddRange(pickup, dest);
                await _context.SaveChangesAsync();

                foreach (var l in lines)
                {
                    var c = commodities[l.CommodityId];
                    _context.StopCommodities.Add(new StopCommodity
                    {
                        LoadStopId = dest.Id, CommodityId = c.Id, Quantity = l.Qty,
                        ProductCode = c.Code, Comment = c.Name, UnitOfMeasure = c.UnitOfMeasure
                    });
                }
                await _context.SaveChangesAsync();
                await tx.CommitAsync();

                _logger.LogInformation("Internal movement {LoadNumber} created {From} → {To} with {Lines} lines by {User}",
                    load.LoadNumber, from.Name, to.Name, lines.Count, CurrentUserName);
                return await Get(load.Id);
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error creating internal movement");
                return StatusCode(500, new { message = "An error occurred while creating the internal movement" });
            }
        }

        // ═══ PUT: assign vehicle / driver / date ═══
        [HttpPut("{id:int}/assign")]
        public async Task<ActionResult<object>> Assign(int id, [FromBody] AssignInternalMovementDto dto)
        {
            var load = await _context.Loads.FirstOrDefaultAsync(l => l.Id == id && l.LoadType == LoadTypeInternal);
            if (load == null) return NotFound(new { message = "Internal movement not found" });
            if (load.Status is "Delivered" or "Completed" or "Cancelled")
                return Conflict(new { message = $"{load.LoadNumber} is {load.Status.ToLower()} and can't be changed" });

            if (dto.VehicleId.HasValue) load.VehicleId = dto.VehicleId == 0 ? null : dto.VehicleId;
            if (dto.DriverId.HasValue) load.DriverId = dto.DriverId == 0 ? null : dto.DriverId;
            if (dto.ScheduledDate.HasValue) { load.ScheduledPickupDate = dto.ScheduledDate; load.ScheduledDeliveryDate = dto.ScheduledDate; }
            if (dto.Notes != null) load.Notes = dto.Notes;
            if (load.Status is "Available" or "Assigned") load.Status = load.DriverId.HasValue ? "Assigned" : "Available";
            load.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return await Get(id);
        }

        // ═══ POST: dispatch — stock leaves the source warehouse ═══
        [HttpPost("{id:int}/dispatch")]
        public async Task<ActionResult<object>> Dispatch(int id, [FromBody] InternalMovementNoteDto? dto)
        {
            if (!await StockAccess.CanManageAsync(_context, User)) return StatusCode(403, new { message = StockAccess.Denied });
            var load = await _context.Loads.FirstOrDefaultAsync(l => l.Id == id && l.LoadType == LoadTypeInternal);
            if (load == null) return NotFound(new { message = "Internal movement not found" });
            if (load.Status is "InTransit" or "Delivered" or "Completed") return Conflict(new { message = $"{load.LoadNumber} has already left" });
            if (load.Status == "Cancelled") return Conflict(new { message = $"{load.LoadNumber} is cancelled" });
            if (load.WarehouseId == null || load.DestinationWarehouseId == null) return BadRequest(new { message = "Movement has no source/destination warehouse" });
            if (await HasTransferRowsAsync(id, load.WarehouseId.Value, outbound: true))
                return Conflict(new { message = $"Stock has already been taken out of the source for {load.LoadNumber}" });

            var lines = await LinesAsync(id);
            if (lines.Count == 0) return Conflict(new { message = $"{load.LoadNumber} has no stock lines" });
            if (lines.Any(l => l.CommodityId == null)) return Conflict(new { message = "Every line must be linked to a stock item before dispatch" });

            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var reference = $"{load.LoadNumber} internal transfer";
                foreach (var l in lines.GroupBy(x => x.CommodityId!.Value))
                    await StockLedger.ApplyAsync(_context, load.WarehouseId.Value, l.Key, "Transfer", -Math.Abs(l.Sum(x => x.Quantity)),
                        load.Id, null, reference, dto?.Reason ?? "Internal movement dispatched", CurrentUserName);

                load.Status = "InTransit";
                load.ActualPickupDate = DateTime.UtcNow;
                load.UpdatedAt = DateTime.UtcNow;
                var pickup = await _context.LoadStops.FirstOrDefaultAsync(s => s.LoadId == id && s.StopType == "Pickup");
                if (pickup != null) { pickup.Status = "Completed"; pickup.ActualDeparture = DateTime.UtcNow; }
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                return await Get(id);
            }
            catch (InvalidOperationException ex) { await tx.RollbackAsync(); return BadRequest(new { message = ex.Message }); }
            catch (Exception ex) when (StockLedger.IsStockConflict(ex)) { await tx.RollbackAsync(); return Conflict(new { message = StockLedger.ConflictMessage }); }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error dispatching internal movement {Id}", id);
                return StatusCode(500, new { message = "An error occurred while dispatching" });
            }
        }

        // ═══ POST: receive — stock arrives at the destination warehouse ═══
        [HttpPost("{id:int}/receive")]
        public async Task<ActionResult<object>> Receive(int id, [FromBody] ReceiveInternalMovementDto? dto)
        {
            if (!await StockAccess.CanManageAsync(_context, User)) return StatusCode(403, new { message = StockAccess.Denied });
            var load = await _context.Loads.FirstOrDefaultAsync(l => l.Id == id && l.LoadType == LoadTypeInternal);
            if (load == null) return NotFound(new { message = "Internal movement not found" });
            if (load.Status is "Delivered" or "Completed") return Conflict(new { message = $"{load.LoadNumber} has already been received" });
            if (load.Status == "Cancelled") return Conflict(new { message = $"{load.LoadNumber} is cancelled" });
            if (load.WarehouseId == null || load.DestinationWarehouseId == null) return BadRequest(new { message = "Movement has no source/destination warehouse" });

            var lines = await LinesAsync(id);
            if (lines.Count == 0) return Conflict(new { message = $"{load.LoadNumber} has no stock lines" });
            if (lines.Any(l => l.CommodityId == null)) return Conflict(new { message = "Every line must be linked to a stock item before receiving" });
            var planned = lines.GroupBy(x => x.CommodityId!.Value).ToDictionary(g => g.Key, g => g.Sum(x => x.Quantity));

            // Received quantities default to what was sent; a short delivery is recorded as-is with a reason.
            var received = planned.ToDictionary(p => p.Key, p => p.Value);
            if (dto?.Lines != null && dto.Lines.Count > 0)
            {
                foreach (var r in dto.Lines)
                {
                    if (!planned.ContainsKey(r.CommodityId)) return BadRequest(new { message = "A received line is not on this movement" });
                    if (r.ReceivedQuantity < 0 || r.ReceivedQuantity > planned[r.CommodityId]) return BadRequest(new { message = "Received quantity must be between 0 and the quantity sent" });
                    received[r.CommodityId] = r.ReceivedQuantity;
                }
                if (received.Any(kv => kv.Value != planned[kv.Key]) && string.IsNullOrWhiteSpace(dto.Reason))
                    return BadRequest(new { message = "Give a reason when the received quantity differs from what was sent" });
            }

            var outPosted = await HasTransferRowsAsync(id, load.WarehouseId.Value, outbound: true);
            using var tx = await _context.Database.BeginTransactionAsync();
            try
            {
                var reference = $"{load.LoadNumber} internal transfer";
                var reason = dto?.Reason ?? "Internal movement received";
                // If it was never dispatched through the system (e.g. received straight away), take it out of the source now.
                if (!outPosted)
                    foreach (var p in planned)
                        await StockLedger.ApplyAsync(_context, load.WarehouseId.Value, p.Key, "Transfer", -Math.Abs(p.Value), load.Id, null, reference, reason, CurrentUserName);
                foreach (var r in received.Where(r => r.Value > 0))
                    await StockLedger.ApplyAsync(_context, load.DestinationWarehouseId.Value, r.Key, "Transfer", Math.Abs(r.Value), load.Id, null, reference, reason, CurrentUserName);

                var shortfall = planned.Where(p => received[p.Key] < p.Value).ToList();
                load.Status = "Delivered";
                load.ActualPickupDate ??= DateTime.UtcNow;
                load.ActualDeliveryDate = DateTime.UtcNow;
                load.UpdatedAt = DateTime.UtcNow;
                if (shortfall.Count > 0)
                    load.Notes = string.Join("\n", new[] { load.Notes, $"Short on receipt: {string.Join(", ", shortfall.Select(s => $"{s.Key}×{s.Value - received[s.Key]:0.##}"))} — {reason}" }.Where(s => !string.IsNullOrWhiteSpace(s)));
                var dest = await _context.LoadStops.FirstOrDefaultAsync(s => s.LoadId == id && s.StopType == "Destination");
                if (dest != null) { dest.Status = "Completed"; dest.ActualArrival = DateTime.UtcNow; }
                await _context.SaveChangesAsync();
                await tx.CommitAsync();
                return await Get(id);
            }
            catch (InvalidOperationException ex) { await tx.RollbackAsync(); return BadRequest(new { message = ex.Message }); }
            catch (Exception ex) when (StockLedger.IsStockConflict(ex)) { await tx.RollbackAsync(); return Conflict(new { message = StockLedger.ConflictMessage }); }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "Error receiving internal movement {Id}", id);
                return StatusCode(500, new { message = "An error occurred while receiving" });
            }
        }

        // ═══ POST: cancel (only before stock has moved) ═══
        [HttpPost("{id:int}/cancel")]
        public async Task<ActionResult<object>> Cancel(int id, [FromBody] InternalMovementNoteDto? dto)
        {
            var load = await _context.Loads.FirstOrDefaultAsync(l => l.Id == id && l.LoadType == LoadTypeInternal);
            if (load == null) return NotFound(new { message = "Internal movement not found" });
            if (load.Status == "Cancelled") return Ok(await Get(id));
            if (load.WarehouseId != null && await HasTransferRowsAsync(id, load.WarehouseId.Value, outbound: true))
                return Conflict(new { message = $"Stock has already left the source for {load.LoadNumber}. Receive it, or reverse its Transfer rows in Stock › Movements first." });
            load.Status = "Cancelled";
            load.UpdatedAt = DateTime.UtcNow;
            if (!string.IsNullOrWhiteSpace(dto?.Reason))
                load.Notes = string.Join("\n", new[] { load.Notes, $"Cancelled: {dto.Reason}" }.Where(s => !string.IsNullOrWhiteSpace(s)));
            await _context.SaveChangesAsync();
            return await Get(id);
        }

        // ═══ helpers ═══
        private Task<bool> HasTransferRowsAsync(int loadId, int warehouseId, bool outbound) =>
            _context.WarehouseStockMovements.AnyAsync(m => m.LoadId == loadId && m.WarehouseId == warehouseId && m.MovementType == "Transfer"
                && m.Status == "Approved" && m.ReversedByMovementId == null && (outbound ? m.Quantity < 0 : m.Quantity > 0));

        private Task<List<StopCommodity>> LinesAsync(int loadId) =>
            _context.StopCommodities.Where(sc => sc.LoadStop.LoadId == loadId && sc.Quantity > 0).ToListAsync();

        private static string FormatAddress(Warehouse w) =>
            string.Join(", ", new[] { w.Address, w.City, w.Province, w.PostalCode }.Where(s => !string.IsNullOrWhiteSpace(s))) is { Length: > 0 } a ? a : w.Name;

        private async Task<string> GenerateLoadNumberAsync()
        {
            var last = await _context.Loads.OrderByDescending(l => l.Id).FirstOrDefaultAsync();
            var next = 1;
            if (last != null && !string.IsNullOrEmpty(last.LoadNumber))
            {
                var n = last.LoadNumber;
                if ((n.StartsWith("RF-") || n.StartsWith("LD-")) && n.Length == 9 && int.TryParse(n[3..], out var num)) next = num + 1;
                else next = last.Id + 1;
            }
            return $"RF-{next:D6}";
        }
    }

    public class CreateInternalMovementDto
    {
        public int FromWarehouseId { get; set; }
        public int ToWarehouseId { get; set; }
        public int? VehicleId { get; set; }
        public int? DriverId { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public string? Priority { get; set; }
        public string? Notes { get; set; }
        public List<InternalMovementLineDto> Lines { get; set; } = new();
    }
    public class InternalMovementLineDto { public int CommodityId { get; set; } public decimal Quantity { get; set; } }
    public class AssignInternalMovementDto { public int? VehicleId { get; set; } public int? DriverId { get; set; } public DateTime? ScheduledDate { get; set; } public string? Notes { get; set; } }
    public class InternalMovementNoteDto { public string? Reason { get; set; } }
    public class ReceiveInternalMovementDto { public string? Reason { get; set; } public List<ReceiveLineDto>? Lines { get; set; } }
    public class ReceiveLineDto { public int CommodityId { get; set; } public decimal ReceivedQuantity { get; set; } }
}
