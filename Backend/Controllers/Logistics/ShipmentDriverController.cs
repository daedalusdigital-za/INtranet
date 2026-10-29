using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics.Shipments;
using ProjectTracker.API.Models.Logistics.Shipments;
using ProjectTracker.API.Security;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Endpoints the driver app calls (spec §10/§11). Every scan carries a client UUID
    /// (scanId) so offline retries are idempotent; out-of-order scans are logged but do
    /// not move status; codes belonging to another driver's load are rejected.
    /// </summary>
    [ApiController]
    [Route("api/logistics/driver")]
    [Authorize]
    public class ShipmentDriverController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IShipmentLifecycleService _lifecycle;
        private readonly ILogger<ShipmentDriverController> _logger;

        public ShipmentDriverController(ApplicationDbContext db, IShipmentLifecycleService lifecycle, ILogger<ShipmentDriverController> logger)
        {
            _db = db; _lifecycle = lifecycle; _logger = logger;
        }

        private int? UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
        private string? UserName => User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;

        /// <summary>Today's tripsheet(s) for a driver with the shipments to collect/deliver at each stop.</summary>
        [HttpGet("tripsheet/today")]
        public async Task<IActionResult> Today([FromQuery] int driverId, [FromQuery] DateTime? date)
        {
            var day = (date ?? DateTime.UtcNow.AddHours(2)).Date;
            var loads = await _db.Loads.AsNoTracking()
                .Include(l => l.Vehicle).Include(l => l.Warehouse)
                .Include(l => l.Stops)
                .Where(l => l.DriverId == driverId && l.Status != "Cancelled" && l.Status != "Completed"
                    && ((l.ScheduledDeliveryDate ?? l.ScheduledPickupDate) >= day && (l.ScheduledDeliveryDate ?? l.ScheduledPickupDate) < day.AddDays(1)
                        || l.Status == "InTransit" || l.Status == "Assigned"))
                .OrderBy(l => l.ScheduledPickupDate).ToListAsync();

            var loadIds = loads.Select(l => l.Id).ToList();
            var shipments = await _db.Shipments.AsNoTracking()
                .Include(s => s.Booking).ThenInclude(b => b.Customer)
                .Include(s => s.PickupAddress).Include(s => s.DeliveryAddress).Include(s => s.Items).Include(s => s.Waybill)
                .Where(s => s.LoadId != null && loadIds.Contains(s.LoadId.Value) && ShipmentStatus.Active.Contains(s.Status)).ToListAsync();

            return Ok(loads.Select(l => new
            {
                loadId = l.Id, l.LoadNumber, l.Status, vehicleReg = l.Vehicle?.RegistrationNumber, warehouse = l.Warehouse?.Name,
                l.ScheduledPickupDate, l.ScheduledDeliveryDate,
                stops = l.Stops.OrderBy(s => s.StopSequence).Select(st => new
                {
                    st.Id, st.StopSequence, st.StopType, st.LocationName, st.CompanyName, st.Address, st.City, st.Latitude, st.Longitude,
                    st.ContactPerson, st.ContactPhone, st.ScheduledArrival, st.Status, st.Notes,
                    shipments = shipments.Where(s => s.PickupStopId == st.Id || s.DeliveryStopId == st.Id).Select(s => new
                    {
                        s.Id, action = s.PickupStopId == st.Id ? "collect" : "deliver", s.Status,
                        waybillNo = s.Waybill?.WaybillNo, trackingToken = s.Waybill?.TrackingToken,
                        client = s.Booking.Customer?.Name, s.Booking.BookingNo, s.Booking.ClientReference,
                        s.TotalPallets, s.TotalParcels, s.TotalWeightKg, s.Fragile, s.Hazardous, s.HazardClass, s.TemperatureRange, s.SpecialInstructions,
                        contactName = s.PickupStopId == st.Id ? s.PickupAddress.ContactName : s.DeliveryAddress.ContactName,
                        contactPhone = s.PickupStopId == st.Id ? s.PickupAddress.ContactPhone : s.DeliveryAddress.ContactPhone,
                        items = s.Items.Select(i => new { i.Id, i.Type, i.Qty, i.WeightKg, i.Description, i.ItemBarcode })
                    })
                }),
                unassignedShipments = shipments.Where(s => s.LoadId == l.Id && s.PickupStopId == null).Select(s => new { s.Id, waybillNo = s.Waybill?.WaybillNo, s.Status })
            }));
        }

        /// <summary>Collection or delivery scan (JSON). For delivery with files use <c>POST driver/pod</c>.</summary>
        [HttpPost("scans")]
        public async Task<IActionResult> Scan([FromBody] DriverScanDto dto)
            => await HandleScanAsync(dto, null, null);

        /// <summary>Delivery scan + POD files (multipart: json field "payload" + "signature" + "photos").</summary>
        [HttpPost("pod")]
        [RequestSizeLimit(60_000_000)]
        public async Task<IActionResult> Pod([FromForm] string payload, [FromForm] IFormFile? signature, [FromForm] List<IFormFile>? photos)
        {
            DriverScanDto? dto;
            try { dto = JsonSerializer.Deserialize<DriverScanDto>(payload, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }); }
            catch { return BadRequest(new { code = "BAD_PAYLOAD", message = "payload must be JSON" }); }
            if (dto == null) return BadRequest(new { code = "BAD_PAYLOAD", message = "payload is required" });
            dto.Type = "deliver";
            return await HandleScanAsync(dto, signature, photos);
        }

        private async Task<IActionResult> HandleScanAsync(DriverScanDto dto, IFormFile? signature, List<IFormFile>? photos)
        {
            var type = dto.Type.ToLowerInvariant();
            if (type != "collect" && type != "deliver") return BadRequest(new { code = "BAD_TYPE", message = "type must be collect or deliver" });

            // Idempotency: a repeated scanId returns the original result.
            var dup = await _db.ShipmentDriverScans.AsNoTracking().FirstOrDefaultAsync(x => x.ScanId == dto.ScanId);
            if (dup != null) return Ok(new { result = "duplicate", original = dup.Result, shipmentId = dup.ShipmentId, message = dup.Message });

            var occurred = dto.OccurredAt?.ToUniversalTime() ?? DateTime.UtcNow;
            var scan = new ShipmentDriverScan { ScanId = dto.ScanId, Code = dto.Code, ScanType = type, DriverId = dto.DriverId, Latitude = dto.Latitude, Longitude = dto.Longitude, OccurredAt = occurred };

            var s = await ShipmentCodeResolver.ResolveAsync(_db, dto.Code);
            if (s == null) return await Reject(scan, 404, "UNKNOWN_CODE", "No shipment matches that code.");
            scan.ShipmentId = s.Id;

            // Wrong-shipment guard: must be on this driver's load.
            if (dto.DriverId.HasValue && s.LoadId.HasValue)
            {
                var loadDriver = await _db.Loads.AsNoTracking().Where(l => l.Id == s.LoadId).Select(l => l.DriverId).FirstOrDefaultAsync();
                if (loadDriver.HasValue && loadDriver != dto.DriverId)
                    return await Reject(scan, 409, "WRONG_DRIVER", $"Shipment {s.Waybill?.WaybillNo} is on load {s.Load?.LoadNumber}, which is assigned to another driver.");
            }
            if (!s.LoadId.HasValue) return await Reject(scan, 409, "NOT_PLANNED", "Shipment is not planned onto a load yet.");

            var target = type == "collect" ? ShipmentStatus.Collected : ShipmentStatus.Delivered;

            // Out-of-order offline scan: a collection arriving after delivery is logged, not applied.
            if (type == "collect" && (s.Status is ShipmentStatus.Collected or ShipmentStatus.InTransit or ShipmentStatus.Arriving or ShipmentStatus.Delivered))
                return await Finish(scan, "stale", $"Shipment already {s.Status}; collection scan recorded only.", s, StatusCodes.Status200OK);
            if (type == "deliver" && s.Status == ShipmentStatus.Delivered)
                return await Finish(scan, "stale", "Shipment already DELIVERED.", s, StatusCodes.Status200OK);

            if (!ShipmentStatus.CanTransition(s.Status, target))
                return await Reject(scan, 409, "INVALID_STATE", $"Cannot {type} a shipment that is {s.Status}.");

            var driverName = dto.DriverId.HasValue
                ? await _db.Drivers.AsNoTracking().Where(d => d.Id == dto.DriverId).Select(d => d.FirstName + " " + d.LastName).FirstOrDefaultAsync()
                : UserName;

            if (type == "deliver")
            {
                if (string.IsNullOrWhiteSpace(dto.ReceiverName)) return await Reject(scan, 400, "RECEIVER_REQUIRED", "Receiver name is required for a delivery scan.");
                var pod = new ShipmentPod
                {
                    ShipmentId = s.Id, ReceiverName = dto.ReceiverName.Trim(), Latitude = dto.Latitude, Longitude = dto.Longitude,
                    DeliveredAt = occurred, DriverId = dto.DriverId, DeviceId = dto.DeviceId, Note = dto.Note
                };
                var dir = Path.Combine("pod", "shipments", s.Id.ToString());
                var root = Path.Combine(Directory.GetCurrentDirectory(), "uploads", dir);
                Directory.CreateDirectory(root);
                if (signature != null && signature.Length > 0 && !SafePaths.IsBlockedExtension(signature.FileName))
                {
                    var name = $"signature_{DateTime.UtcNow:yyyyMMddHHmmss}{Path.GetExtension(signature.FileName)}";
                    await using var fs = System.IO.File.Create(Path.Combine(root, name));
                    await signature.CopyToAsync(fs);
                    pod.SignaturePath = $"{dir}/{name}".Replace('\\', '/');
                }
                else if (!string.IsNullOrWhiteSpace(dto.SignatureBase64))
                {
                    var b64 = dto.SignatureBase64; var comma = b64.IndexOf(',');
                    if (comma >= 0) b64 = b64[(comma + 1)..];
                    try
                    {
                        var name = $"signature_{DateTime.UtcNow:yyyyMMddHHmmss}.png";
                        await System.IO.File.WriteAllBytesAsync(Path.Combine(root, name), Convert.FromBase64String(b64));
                        pod.SignaturePath = $"{dir}/{name}";
                    }
                    catch (FormatException) { /* ignore bad signature payload */ }
                }
                var saved = new List<string>();
                foreach (var p in photos ?? new())
                {
                    if (p.Length == 0 || SafePaths.IsBlockedExtension(p.FileName)) continue;
                    var name = $"photo_{DateTime.UtcNow:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}{Path.GetExtension(p.FileName)}";
                    await using var fs = System.IO.File.Create(Path.Combine(root, name));
                    await p.CopyToAsync(fs);
                    saved.Add($"{dir}/{name}".Replace('\\', '/'));
                }
                pod.PhotoPathsJson = JsonSerializer.Serialize(saved);
                _db.ShipmentPods.Add(pod);
                s.DamagedFlag = dto.Damaged; s.ShortFlag = dto.Short;
                if (s.DeliveryStopId.HasValue) await CompleteStopAsync(s.DeliveryStopId.Value, occurred);
            }
            else if (s.PickupStopId.HasValue) await CompleteStopAsync(s.PickupStopId.Value, occurred);

            var note = type == "collect" ? "Collected (waybill scanned)" : $"Delivered to {dto.ReceiverName}{(dto.Damaged ? " – DAMAGED" : "")}{(dto.Short ? " – SHORT" : "")}{(string.IsNullOrWhiteSpace(dto.Note) ? "" : " – " + dto.Note)}";
            await _lifecycle.TransitionAsync(s, target, new TransitionContext(ShipmentEventSource.Driver, UserId, driverName, note, dto.Latitude, dto.Longitude, dto.Code, occurred));
            return await Finish(scan, "applied", note, s, StatusCodes.Status200OK);
        }

        [HttpPost("exceptions")]
        public async Task<IActionResult> Exception([FromForm] string? payload, [FromForm] List<IFormFile>? photos, [FromBody] DriverExceptionDto? json = null)
        {
            DriverExceptionDto? dto = json;
            if (dto == null && !string.IsNullOrWhiteSpace(payload))
                dto = JsonSerializer.Deserialize<DriverExceptionDto>(payload, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            if (dto == null) return BadRequest(new { code = "BAD_PAYLOAD" });

            var dup = await _db.ShipmentDriverScans.AsNoTracking().FirstOrDefaultAsync(x => x.ScanId == dto.ScanId);
            if (dup != null) return Ok(new { result = "duplicate", original = dup.Result, shipmentId = dup.ShipmentId });

            var occurred = dto.OccurredAt?.ToUniversalTime() ?? DateTime.UtcNow;
            var scan = new ShipmentDriverScan { ScanId = dto.ScanId, Code = dto.Code, ScanType = "exception", DriverId = dto.DriverId, Latitude = dto.Latitude, Longitude = dto.Longitude, OccurredAt = occurred };
            var s = await ShipmentCodeResolver.ResolveAsync(_db, dto.Code);
            if (s == null) return await Reject(scan, 404, "UNKNOWN_CODE", "No shipment matches that code.");
            scan.ShipmentId = s.Id;

            var target = dto.Stage.Equals("collection", StringComparison.OrdinalIgnoreCase) ? ShipmentStatus.CollectionFailed : ShipmentStatus.DeliveryFailed;
            if (!ShipmentStatus.CanTransition(s.Status, target))
                return await Reject(scan, 409, "INVALID_STATE", $"Cannot log {target} for a shipment that is {s.Status}.");

            var dir = Path.Combine("pod", "shipments", s.Id.ToString(), "exceptions");
            var root = Path.Combine(Directory.GetCurrentDirectory(), "uploads", dir);
            var saved = new List<string>();
            if (photos is { Count: > 0 })
            {
                Directory.CreateDirectory(root);
                foreach (var p in photos)
                {
                    if (p.Length == 0 || SafePaths.IsBlockedExtension(p.FileName)) continue;
                    var name = $"exc_{DateTime.UtcNow:yyyyMMddHHmmssfff}_{Guid.NewGuid():N}{Path.GetExtension(p.FileName)}";
                    await using var fs = System.IO.File.Create(Path.Combine(root, name));
                    await p.CopyToAsync(fs);
                    saved.Add($"{dir}/{name}".Replace('\\', '/'));
                }
            }
            _db.ShipmentExceptions.Add(new ShipmentException
            {
                ShipmentId = s.Id, Type = target, ReasonCode = dto.ReasonCode, Note = dto.Note, PhotoPathsJson = JsonSerializer.Serialize(saved),
                Latitude = dto.Latitude, Longitude = dto.Longitude, LoggedByDriverId = dto.DriverId, LoggedByUserId = UserId
            });
            var note = $"{dto.ReasonCode}{(string.IsNullOrWhiteSpace(dto.Note) ? "" : ": " + dto.Note)}";
            await _lifecycle.TransitionAsync(s, target, new TransitionContext(ShipmentEventSource.Driver, UserId, UserName, note, dto.Latitude, dto.Longitude, dto.Code, occurred));
            return await Finish(scan, "applied", note, s, StatusCodes.Status200OK);
        }

        private async Task CompleteStopAsync(int stopId, DateTime when)
        {
            var stop = await _db.LoadStops.FindAsync(stopId);
            if (stop == null) return;
            stop.ActualArrival ??= when; stop.ActualDeparture = when; stop.Status = "Completed";
        }

        private async Task<IActionResult> Reject(ShipmentDriverScan scan, int http, string code, string message)
        {
            scan.Result = "rejected"; scan.Message = $"{code}: {message}";
            _db.ShipmentDriverScans.Add(scan);
            await _db.SaveChangesAsync();
            return StatusCode(http, new { result = "rejected", code, message, shipmentId = scan.ShipmentId });
        }

        private async Task<IActionResult> Finish(ShipmentDriverScan scan, string result, string message, Shipment s, int http)
        {
            scan.Result = result; scan.Message = message;
            _db.ShipmentDriverScans.Add(scan);
            await _db.SaveChangesAsync();
            return StatusCode(http, new { result, message, shipmentId = s.Id, status = s.Status, waybillNo = s.Waybill?.WaybillNo });
        }
    }

    /// <summary>
    /// Public tracking page behind the QR code: status, ETA and suburb only (POPIA – no names,
    /// phone numbers or POD). Token is random and unrelated to the waybill number.
    /// </summary>
    [ApiController]
    [Route("api/t")]
    [AllowAnonymous]
    public class PublicTrackingController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public PublicTrackingController(ApplicationDbContext db) => _db = db;

        [HttpGet("{token}")]
        public async Task<IActionResult> Track(string token)
        {
            if (string.IsNullOrWhiteSpace(token) || token.Length < 16) return NotFound();
            var s = await _db.Shipments.AsNoTracking()
                .Include(x => x.Waybill).Include(x => x.PickupAddress).Include(x => x.DeliveryAddress).Include(x => x.Load).ThenInclude(l => l!.Vehicle)
                .FirstOrDefaultAsync(x => x.Waybill != null && x.Waybill.TrackingToken == token.ToLowerInvariant());
            if (s == null) return NotFound();

            var events = await _db.ShipmentEvents.AsNoTracking().Where(e => e.ShipmentId == s.Id).OrderBy(e => e.OccurredAt)
                .Select(e => new { e.ToStatus, e.OccurredAt }).ToListAsync();

            object? vehicle = null;
            if (ShipmentStatus.OnTheRoad.Contains(s.Status) && s.Load?.Vehicle != null)
            {
                var v = s.Load.Vehicle;
                if (v.LastKnownLatitude.HasValue && v.LastKnownLongitude.HasValue)
                    vehicle = new
                    {
                        latitude = v.LastKnownLatitude, longitude = v.LastKnownLongitude, timestamp = v.LastLocationUpdate,
                        ageMinutes = v.LastLocationUpdate.HasValue ? (int?)(DateTime.UtcNow - v.LastLocationUpdate.Value).TotalMinutes : null
                    };
            }

            return Ok(new
            {
                waybillNo = s.Waybill!.WaybillNo,
                s.Status,
                s.Eta,
                from = new { s.PickupAddress.Suburb, s.PickupAddress.City },
                to = new { s.DeliveryAddress.Suburb, s.DeliveryAddress.City, s.DeliveryAddress.Latitude, s.DeliveryAddress.Longitude },
                s.RequestedDeliveryDate,
                s.DeliveredAt,
                timeline = events,
                vehicle
            });
        }
    }
}
