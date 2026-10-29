using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics.Shipments;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Models.Logistics.Shipments;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Operations back office for shipments: search, unplanned panel, planning onto the
    /// existing Loads/tripsheets, waybill documents, exceptions and re-planning.
    /// </summary>
    [ApiController]
    [Route("api/logistics/shipments")]
    [Authorize]
    public class ShipmentsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IShipmentLifecycleService _lifecycle;
        private readonly IWaybillService _waybills;
        private readonly ILogger<ShipmentsController> _logger;

        public ShipmentsController(ApplicationDbContext db, IShipmentLifecycleService lifecycle, IWaybillService waybills, ILogger<ShipmentsController> logger)
        {
            _db = db; _lifecycle = lifecycle; _waybills = waybills; _logger = logger;
        }

        private int? UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
        private string? UserName => User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name;

        private IQueryable<Shipment> Full() => _db.Shipments
            .Include(s => s.Booking).ThenInclude(b => b.Customer)
            .Include(s => s.PickupAddress).Include(s => s.DeliveryAddress)
            .Include(s => s.Items).Include(s => s.Waybill).Include(s => s.Load);

        // ------------------------------------------------------------------ search / lists

        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] int? customerId, [FromQuery] int? loadId,
            [FromQuery] string? search, [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] bool? active,
            [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var q = Full().AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(status)) { var st = status.ToUpper().Split(',', StringSplitOptions.RemoveEmptyEntries); q = q.Where(s => st.Contains(s.Status)); }
            if (active == true) q = q.Where(s => ShipmentStatus.Active.Contains(s.Status));
            if (customerId.HasValue) q = q.Where(s => s.Booking.CustomerId == customerId);
            if (loadId.HasValue) q = q.Where(s => s.LoadId == loadId);
            if (from.HasValue) q = q.Where(s => s.CollectionDate >= from.Value.Date);
            if (to.HasValue) q = q.Where(s => s.CollectionDate < to.Value.Date.AddDays(1));
            if (!string.IsNullOrWhiteSpace(search))
            {
                var t = search.Trim();
                q = q.Where(s => s.Booking.BookingNo.Contains(t) || (s.Booking.ClientReference != null && s.Booking.ClientReference.Contains(t))
                    || (s.Waybill != null && s.Waybill.WaybillNo.Contains(t)) || (s.Booking.Customer != null && s.Booking.Customer.Name.Contains(t))
                    || s.DeliveryAddress.Line1.Contains(t) || (s.DeliveryAddress.Suburb != null && s.DeliveryAddress.Suburb.Contains(t)));
            }
            var total = await q.CountAsync();
            var rows = await q.OrderByDescending(s => s.CreatedAt).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { total, page, pageSize, items = rows.Select(ShipmentMapper.ShipmentSummary) });
        }

        /// <summary>CONFIRMED shipments not yet on a load – the "Unplanned" panel for the load builder.</summary>
        [HttpGet("unplanned")]
        public async Task<IActionResult> Unplanned([FromQuery] DateTime? collectionDate, [FromQuery] string? province, [FromQuery] bool? hazardous, [FromQuery] bool? fragile)
        {
            var q = Full().AsNoTracking().Where(s => s.Status == ShipmentStatus.Confirmed && s.LoadId == null);
            if (collectionDate.HasValue) q = q.Where(s => s.CollectionDate == collectionDate.Value.Date);
            if (!string.IsNullOrWhiteSpace(province)) q = q.Where(s => s.PickupAddress.Province == province || s.DeliveryAddress.Province == province);
            if (hazardous.HasValue) q = q.Where(s => s.Hazardous == hazardous);
            if (fragile.HasValue) q = q.Where(s => s.Fragile == fragile);
            var rows = await q.OrderBy(s => s.CollectionDate).ThenBy(s => s.Id).ToListAsync();
            return Ok(rows.Select(ShipmentMapper.ShipmentSummary));
        }

        /// <summary>Dashboard counters for the ops menu / home.</summary>
        [HttpGet("counts")]
        public async Task<IActionResult> Counts()
        {
            var today = DateTime.UtcNow.AddHours(2).Date;
            var byStatus = await _db.Shipments.AsNoTracking().GroupBy(s => s.Status).Select(g => new { status = g.Key, count = g.Count() }).ToListAsync();
            return Ok(new
            {
                bookingQueue = await _db.ClientBookings.CountAsync(b => b.Status == ShipmentStatus.Booked),
                unplanned = await _db.Shipments.CountAsync(s => s.Status == ShipmentStatus.Confirmed && s.LoadId == null),
                onTheRoad = await _db.Shipments.CountAsync(s => ShipmentStatus.OnTheRoad.Contains(s.Status)),
                exceptions = await _db.Shipments.CountAsync(s => s.Status == ShipmentStatus.CollectionFailed || s.Status == ShipmentStatus.DeliveryFailed),
                dueToday = await _db.Shipments.CountAsync(s => s.RequestedDeliveryDate == today && ShipmentStatus.Active.Contains(s.Status)),
                deliveredToday = await _db.Shipments.CountAsync(s => s.DeliveredAt >= today && s.DeliveredAt < today.AddDays(1)),
                byStatus
            });
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var s = await Full().AsNoTracking().Include(x => x.Pod).Include(x => x.Exceptions).FirstOrDefaultAsync(x => x.Id == id);
            if (s == null) return NotFound();
            var events = await _db.ShipmentEvents.AsNoTracking().Where(e => e.ShipmentId == id).OrderBy(e => e.OccurredAt).ThenBy(e => e.Id).ToListAsync();
            var notifications = await _db.ShipmentNotificationLogs.AsNoTracking().Where(n => n.ShipmentId == id).OrderByDescending(n => n.CreatedAt).Take(20).ToListAsync();
            return Ok(new
            {
                shipment = ShipmentMapper.ShipmentSummary(s),
                events = events.Select(ShipmentMapper.Event),
                pod = s.Pod == null ? null : new { s.Pod.Id, s.Pod.ReceiverName, s.Pod.SignaturePath, photos = Photos(s.Pod.PhotoPathsJson), s.Pod.Latitude, s.Pod.Longitude, s.Pod.DeliveredAt, s.Pod.DriverId, s.Pod.Note },
                exceptions = s.Exceptions.OrderByDescending(e => e.CreatedAt).Select(e => new { e.Id, e.Type, e.ReasonCode, e.Note, photos = Photos(e.PhotoPathsJson), e.Latitude, e.Longitude, e.LoggedByDriverId, e.Resolution, e.ResolvedAt, e.CreatedAt }),
                notifications = notifications.Select(n => new { n.Channel, n.Recipient, n.Template, n.Status, n.Error, n.SentAt, n.CreatedAt }),
                allowedTransitions = ShipmentStatus.Transitions.TryGetValue(s.Status, out var t) ? t : Array.Empty<string>()
            });
        }

        /// <summary>One resolver for every scan: waybill no, item code, tracking token or tracking URL → shipment.</summary>
        [HttpGet("resolve")]
        public async Task<IActionResult> Resolve([FromQuery] string code)
        {
            var s = await ShipmentCodeResolver.ResolveAsync(_db, code);
            if (s == null) return NotFound(new { message = "No shipment matches that code", code });
            return Ok(ShipmentMapper.ShipmentSummary(s));
        }

        // ------------------------------------------------------------------ planning onto loads

        /// <summary>Plan shipments onto an existing load: adds pickup+delivery stops to the tripsheet, sets PLANNED and issues waybills.</summary>
        [HttpPost("/api/logistics/loads/{loadId:int}/shipments")]
        public async Task<IActionResult> PlanOntoLoad(int loadId, [FromBody] PlanShipmentsDto dto)
        {
            var load = await _db.Loads.Include(l => l.Stops).Include(l => l.Vehicle).ThenInclude(v => v!.VehicleType).Include(l => l.VehicleType)
                .FirstOrDefaultAsync(l => l.Id == loadId);
            if (load == null) return NotFound(new { message = "Load not found" });
            if (load.Status is "Delivered" or "Completed" or "Cancelled") return BadRequest(new { message = $"Load {load.LoadNumber} is {load.Status} and cannot take new shipments." });

            var shipments = await Full().Where(s => dto.ShipmentIds.Contains(s.Id)).ToListAsync();
            var missing = dto.ShipmentIds.Except(shipments.Select(s => s.Id)).ToList();
            if (missing.Count > 0) return BadRequest(new { message = "Unknown shipment ids", missing });
            var notReady = shipments.Where(s => s.Status != ShipmentStatus.Confirmed).Select(s => new { s.Id, s.Status }).ToList();
            if (notReady.Count > 0) return BadRequest(new { message = "Only CONFIRMED shipments can be planned", notReady });

            // Capacity + compatibility warnings (never block – ops decide).
            var warnings = new List<string>();
            var existing = await _db.Shipments.AsNoTracking().Where(s => s.LoadId == loadId && ShipmentStatus.Active.Contains(s.Status)).ToListAsync();
            var totalKg = existing.Sum(s => s.TotalWeightKg) + shipments.Sum(s => s.TotalWeightKg);
            var maxKg = load.Vehicle?.VehicleType?.MaxLoadWeight ?? load.VehicleType?.MaxLoadWeight;
            if (maxKg.HasValue && maxKg > 0 && totalKg > maxKg) warnings.Add($"Total weight {totalKg:N0} kg exceeds vehicle capacity {maxKg:N0} kg.");
            var all = existing.Concat(shipments).ToList();
            if (all.Any(s => s.Hazardous) && all.Any(s => !string.IsNullOrWhiteSpace(s.TemperatureRange)))
                warnings.Add("Hazardous and temperature-controlled cargo share this load.");

            var ctx = new TransitionContext(ShipmentEventSource.Ops, UserId, UserName, $"Planned onto load {load.LoadNumber}");
            var seq = load.Stops.Count == 0 ? 0 : load.Stops.Max(s => s.StopSequence);

            await using var tx = await _db.Database.BeginTransactionAsync();
            foreach (var s in shipments)
            {
                s.LoadId = load.Id;
                if (dto.CreateStops)
                {
                    var pick = MakeStop(load.Id, ++seq, "Pickup", s.PickupAddress, s);
                    var drop = MakeStop(load.Id, ++seq, "Delivery", s.DeliveryAddress, s);
                    _db.LoadStops.AddRange(pick, drop);
                    await _db.SaveChangesAsync();
                    s.PickupStopId = pick.Id; s.DeliveryStopId = drop.Id;
                }
                await _lifecycle.TransitionAsync(s, ShipmentStatus.Planned, ctx, save: false);
                await _db.SaveChangesAsync();

                // Issue waybill automatically on PLANNED (spec §7) → WAYBILL_ISSUED.
                var wb = await _waybills.IssueAsync(s, UserId);
                await _lifecycle.TransitionAsync(s, ShipmentStatus.WaybillIssued, new TransitionContext(ShipmentEventSource.System, UserId, UserName, $"Waybill {wb.WaybillNo} issued"), save: false);
            }
            load.TotalWeight = (load.TotalWeight ?? 0) + shipments.Sum(s => s.TotalWeightKg);
            if (load.Status == "Available" || load.Status == "Draft") load.Status = "Pending";
            load.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            await tx.CommitAsync();

            var planned = await Full().AsNoTracking().Where(s => dto.ShipmentIds.Contains(s.Id)).ToListAsync();
            return Ok(new { loadId = load.Id, load.LoadNumber, warnings, shipments = planned.Select(ShipmentMapper.ShipmentSummary) });
        }

        [HttpGet("/api/logistics/loads/{loadId:int}/shipments")]
        public async Task<IActionResult> ForLoad(int loadId)
        {
            var rows = await Full().AsNoTracking().Where(s => s.LoadId == loadId).OrderBy(s => s.PickupStopId).ToListAsync();
            return Ok(rows.Select(ShipmentMapper.ShipmentSummary));
        }

        private static LoadStop MakeStop(int loadId, int seq, string type, ShipmentAddress a, Shipment s) => new()
        {
            LoadId = loadId,
            StopSequence = seq,
            StopType = type,
            LocationName = a.Label ?? a.Suburb ?? a.City,
            CompanyName = type == "Pickup" ? s.Booking?.Customer?.Name : a.ContactName,
            Address = a.OneLine,
            City = a.City, Province = a.Province, PostalCode = a.PostalCode,
            Latitude = a.Latitude.HasValue ? (decimal)a.Latitude.Value : null,
            Longitude = a.Longitude.HasValue ? (decimal)a.Longitude.Value : null,
            ContactPerson = a.ContactName, ContactPhone = a.ContactPhone, ContactEmail = a.ContactEmail,
            OrderNumber = s.Booking?.BookingNo,
            ScheduledArrival = type == "Pickup" ? s.CollectionDate : s.RequestedDeliveryDate,
            Notes = $"{(type == "Pickup" ? "Collect" : "Deliver")} shipment #{s.Id} ({s.TotalPallets} pallet / {s.TotalParcels} parcel, {s.TotalWeightKg:N0} kg){(string.IsNullOrWhiteSpace(s.SpecialInstructions) ? "" : " – " + s.SpecialInstructions)}",
            Status = "Pending"
        };

        // ------------------------------------------------------------------ ops actions

        [HttpPost("{id:int}/replan")]
        public async Task<IActionResult> Replan(int id, [FromBody] NoteDto? dto)
        {
            var s = await _db.Shipments.Include(x => x.Exceptions).FirstOrDefaultAsync(x => x.Id == id);
            if (s == null) return NotFound();
            try
            {
                await RemoveStopsAsync(s);
                await _lifecycle.TransitionAsync(s, ShipmentStatus.Confirmed, new TransitionContext(ShipmentEventSource.Ops, UserId, UserName, dto?.Note ?? "Re-planned for a new attempt"));
                foreach (var ex in s.Exceptions.Where(e => e.ResolvedAt == null)) { ex.Resolution = "replan"; ex.ResolvedAt = DateTime.UtcNow; ex.ResolvedByUserId = UserId; }
                await _db.SaveChangesAsync();
                return Ok(new { s.Id, s.Status });
            }
            catch (ShipmentTransitionException ex) { return BadRequest(new { code = ex.Code, message = ex.Message }); }
        }

        [HttpPost("{id:int}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] NoteDto? dto)
        {
            var s = await _db.Shipments.Include(x => x.Exceptions).FirstOrDefaultAsync(x => x.Id == id);
            if (s == null) return NotFound();
            try
            {
                await RemoveStopsAsync(s);
                await _lifecycle.TransitionAsync(s, ShipmentStatus.Cancelled, new TransitionContext(ShipmentEventSource.Ops, UserId, UserName, dto?.Note ?? "Cancelled by operations"));
                foreach (var ex in s.Exceptions.Where(e => e.ResolvedAt == null)) { ex.Resolution = "cancel"; ex.ResolvedAt = DateTime.UtcNow; ex.ResolvedByUserId = UserId; }
                await _db.SaveChangesAsync();
                return Ok(new { s.Id, s.Status });
            }
            catch (ShipmentTransitionException ex) { return BadRequest(new { code = ex.Code, message = ex.Message }); }
        }

        /// <summary>Generic ops transition (e.g. manual IN_TRANSIT when Cartrack is down). Still goes through the engine.</summary>
        [HttpPost("{id:int}/transition")]
        public async Task<IActionResult> Transition(int id, [FromQuery] string to, [FromBody] NoteDto? dto)
        {
            var s = await _db.Shipments.FindAsync(id);
            if (s == null) return NotFound();
            if (to.ToUpper() == ShipmentStatus.Delivered) return BadRequest(new { message = "DELIVERED can only be set by a driver scan with POD." });
            try
            {
                await _lifecycle.TransitionAsync(s, to.ToUpper(), new TransitionContext(ShipmentEventSource.Ops, UserId, UserName, dto?.Note));
                return Ok(new { s.Id, s.Status });
            }
            catch (ShipmentTransitionException ex) { return BadRequest(new { code = ex.Code, message = ex.Message }); }
        }

        [HttpGet("exceptions")]
        public async Task<IActionResult> OpenExceptions()
        {
            var rows = await Full().AsNoTracking().Include(s => s.Exceptions)
                .Where(s => s.Status == ShipmentStatus.CollectionFailed || s.Status == ShipmentStatus.DeliveryFailed)
                .OrderBy(s => s.UpdatedAt).ToListAsync();
            return Ok(rows.Select(s => new
            {
                shipment = ShipmentMapper.ShipmentSummary(s),
                exception = s.Exceptions.Where(e => e.ResolvedAt == null).OrderByDescending(e => e.CreatedAt)
                    .Select(e => new { e.Id, e.Type, e.ReasonCode, e.Note, photos = Photos(e.PhotoPathsJson), e.CreatedAt }).FirstOrDefault()
            }));
        }

        private async Task RemoveStopsAsync(Shipment s)
        {
            var ids = new[] { s.PickupStopId, s.DeliveryStopId }.Where(i => i.HasValue).Select(i => i!.Value).ToList();
            if (ids.Count == 0) return;
            var stops = await _db.LoadStops.Where(st => ids.Contains(st.Id) && st.Status == "Pending").ToListAsync();
            _db.LoadStops.RemoveRange(stops);
        }

        // ------------------------------------------------------------------ documents

        [HttpGet("/api/logistics/waybills/{waybillNo}/pdf")]
        public async Task<IActionResult> WaybillPdf(string waybillNo)
        {
            var wb = await _db.ShipmentWaybills.AsNoTracking().FirstOrDefaultAsync(w => w.WaybillNo == waybillNo.ToUpper());
            if (wb == null) return NotFound();
            return File(await _waybills.RenderWaybillPdfAsync(wb.ShipmentId), "application/pdf", $"{wb.WaybillNo}.pdf");
        }

        [HttpGet("/api/logistics/waybills/{waybillNo}/label")]
        public async Task<IActionResult> LabelPdf(string waybillNo)
        {
            var wb = await _db.ShipmentWaybills.AsNoTracking().FirstOrDefaultAsync(w => w.WaybillNo == waybillNo.ToUpper());
            if (wb == null) return NotFound();
            return File(await _waybills.RenderLabelPdfAsync(wb.ShipmentId), "application/pdf", $"{wb.WaybillNo}-labels.pdf");
        }

        [HttpGet("{id:int}/pod/pdf")]
        public async Task<IActionResult> PodPdf(int id)
        {
            try { return File(await _waybills.RenderPodPdfAsync(id), "application/pdf", $"POD-{id}.pdf"); }
            catch (InvalidOperationException ex) { return NotFound(new { message = ex.Message }); }
        }

        /// <summary>Batch: all waybills on a load in one PDF-per-shipment zip-less stream (concatenated via separate downloads is simpler for printers; return list).</summary>
        [HttpGet("/api/logistics/loads/{loadId:int}/waybills")]
        public async Task<IActionResult> WaybillsForLoad(int loadId)
        {
            var list = await _db.ShipmentWaybills.AsNoTracking().Where(w => w.Shipment.LoadId == loadId)
                .Select(w => new { w.WaybillNo, w.ShipmentId, pdf = $"/api/logistics/waybills/{w.WaybillNo}/pdf", label = $"/api/logistics/waybills/{w.WaybillNo}/label" }).ToListAsync();
            return Ok(list);
        }

        internal static List<string> Photos(string? json)
        {
            try { return System.Text.Json.JsonSerializer.Deserialize<List<string>>(json ?? "[]") ?? new(); } catch { return new(); }
        }
    }
}
