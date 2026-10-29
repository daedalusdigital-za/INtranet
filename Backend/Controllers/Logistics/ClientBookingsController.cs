using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics.Shipments;
using ProjectTracker.API.Models.Logistics.Shipments;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Client bookings: the single intake for portal / CSV / API / ops-captured bookings.
    /// Validation lives here so every channel behaves the same (spec section 5).
    /// </summary>
    [ApiController]
    [Route("api/logistics/bookings")]
    [Authorize]
    public class ClientBookingsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IBookingIntakeService _intake;
        private readonly IShipmentLifecycleService _lifecycle;
        private readonly ILogger<ClientBookingsController> _logger;

        public ClientBookingsController(ApplicationDbContext db, IBookingIntakeService intake, IShipmentLifecycleService lifecycle, ILogger<ClientBookingsController> logger)
        {
            _db = db; _intake = intake; _lifecycle = lifecycle; _logger = logger;
        }

        private int? UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
        private string? UserName => User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name;

        // ------------------------------------------------------------------ list / queue

        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] int? customerId, [FromQuery] string? search, [FromQuery] string? source,
            [FromQuery] DateTime? from, [FromQuery] DateTime? to, [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
        {
            var q = _db.ClientBookings.AsNoTracking().Include(b => b.Customer).Include(b => b.Shipments).AsQueryable();
            if (!string.IsNullOrWhiteSpace(status)) { var st = status.ToUpper().Split(',', StringSplitOptions.RemoveEmptyEntries); q = q.Where(b => st.Contains(b.Status)); }
            if (!string.IsNullOrWhiteSpace(source)) { var src = source.ToLower(); q = q.Where(b => b.Source == src); }
            if (customerId.HasValue) q = q.Where(b => b.CustomerId == customerId);
            if (from.HasValue) q = q.Where(b => b.CreatedAt >= from);
            if (to.HasValue) q = q.Where(b => b.CreatedAt < to.Value.AddDays(1));
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(b => b.BookingNo.Contains(s) || (b.ClientReference != null && b.ClientReference.Contains(s))
                    || (b.Customer != null && b.Customer.Name.Contains(s))
                    || b.Shipments.Any(x => x.Waybill != null && x.Waybill.WaybillNo.Contains(s)));
            }

            var total = await q.CountAsync();
            var rows = await q.OrderBy(b => b.Status == ShipmentStatus.Booked ? 0 : 1).ThenBy(b => b.CreatedAt)
                .Skip((page - 1) * pageSize).Take(pageSize)
                .Select(b => new
                {
                    b.Id, b.BookingNo, b.CustomerId, customerName = b.Customer != null ? b.Customer.Name : null,
                    b.Source, b.ClientReference, b.Status, b.RequestedByName, b.RequestedByEmail, b.CreatedAt, b.ConfirmedAt, b.RejectionReason,
                    shipmentCount = b.Shipments.Count,
                    totalWeightKg = b.Shipments.Sum(s => s.TotalWeightKg),
                    firstCollection = b.Shipments.Min(s => (DateTime?)s.CollectionDate),
                    statuses = b.Shipments.Select(s => s.Status).Distinct().ToList()
                })
                .ToListAsync();
            return Ok(new { total, page, pageSize, items = rows });
        }

        /// <summary>Badge count for the menu: bookings awaiting acceptance.</summary>
        [HttpGet("queue-count")]
        public async Task<IActionResult> QueueCount([FromQuery] string? source)
            => Ok(new { count = await _db.ClientBookings.CountAsync(b => b.Status == ShipmentStatus.Booked && (source == null || b.Source == source.ToLower())) });

        [HttpGet("{bookingNo}")]
        public async Task<IActionResult> Get(string bookingNo)
        {
            var b = await _db.ClientBookings.AsNoTracking()
                .Include(x => x.Customer)
                .Include(x => x.Shipments).ThenInclude(s => s.PickupAddress)
                .Include(x => x.Shipments).ThenInclude(s => s.DeliveryAddress)
                .Include(x => x.Shipments).ThenInclude(s => s.Items)
                .Include(x => x.Shipments).ThenInclude(s => s.Waybill)
                .Include(x => x.Shipments).ThenInclude(s => s.Load)
                .FirstOrDefaultAsync(x => x.BookingNo == bookingNo || x.Id.ToString() == bookingNo);
            if (b == null) return NotFound();
            return Ok(ShipmentMapper.Booking(b));
        }

        // ------------------------------------------------------------------ create

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateBookingDto dto)
        {
            try
            {
                var (booking, created) = await _intake.CreateAsync(dto, UserId, UserName);
                return CreatedAtAction(nameof(Get), new { bookingNo = booking.BookingNo },
                    new { booking.Id, booking.BookingNo, booking.Status, shipmentIds = created.Select(s => s.Id).ToList() });
            }
            catch (BookingValidationException ex)
            {
                return BadRequest(new { message = "Booking has validation errors", errors = ex.Errors });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to create booking");
                return StatusCode(500, new { message = "Failed to create booking", detail = ex.Message });
            }
        }

        /// <summary>Dry-run validation (used by the CSV upload and the form) â€“ returns per-shipment errors without saving.</summary>
        [HttpPost("validate")]
        public IActionResult ValidateOnly([FromBody] CreateBookingDto dto)
        {
            var errors = _intake.Validate(dto);
            return Ok(new { valid = errors.Count == 0, errors });
        }

        // ------------------------------------------------------------------ queue actions

        [HttpPost("{bookingNo}/accept")]
        public async Task<IActionResult> Accept(string bookingNo, [FromBody] NoteDto? dto)
        {
            var b = await _db.ClientBookings.Include(x => x.Shipments).FirstOrDefaultAsync(x => x.BookingNo == bookingNo);
            if (b == null) return NotFound();
            if (b.Status != ShipmentStatus.Booked) return BadRequest(new { message = $"Booking is {b.Status}, only BOOKED bookings can be accepted." });

            var ctx = new TransitionContext(ShipmentEventSource.Ops, UserId, UserName, dto?.Note ?? "Accepted in booking queue");
            foreach (var s in b.Shipments.Where(s => s.Status == ShipmentStatus.Booked))
                await _lifecycle.TransitionAsync(s, ShipmentStatus.Confirmed, ctx);

            b.Status = ShipmentStatus.Confirmed; b.ConfirmedAt = DateTime.UtcNow; b.ConfirmedByUserId = UserId; b.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { b.BookingNo, b.Status });
        }

        [HttpPost("{bookingNo}/reject")]
        public async Task<IActionResult> Reject(string bookingNo, [FromBody] RejectBookingDto dto)
        {
            var b = await _db.ClientBookings.Include(x => x.Shipments).FirstOrDefaultAsync(x => x.BookingNo == bookingNo);
            if (b == null) return NotFound();
            if (b.Status != ShipmentStatus.Booked) return BadRequest(new { message = $"Booking is {b.Status}, only BOOKED bookings can be rejected." });

            b.Status = ShipmentStatus.Rejected; b.RejectionReason = dto.Reason.Trim(); b.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            var ctx = new TransitionContext(ShipmentEventSource.Ops, UserId, UserName, dto.Reason);
            foreach (var s in b.Shipments.Where(s => s.Status == ShipmentStatus.Booked))
                await _lifecycle.TransitionAsync(s, ShipmentStatus.Rejected, ctx);
            return Ok(new { b.BookingNo, b.Status });
        }

        /// <summary>Client/ops cancel of a whole booking â€“ only shipments not yet collected are cancelled.</summary>
        [HttpPost("{bookingNo}/cancel")]
        public async Task<IActionResult> Cancel(string bookingNo, [FromBody] NoteDto? dto)
        {
            var b = await _db.ClientBookings.Include(x => x.Shipments).FirstOrDefaultAsync(x => x.BookingNo == bookingNo);
            if (b == null) return NotFound();
            var ctx = new TransitionContext(ShipmentEventSource.Ops, UserId, UserName, dto?.Note ?? "Booking cancelled");
            int n = 0;
            foreach (var s in b.Shipments.Where(s => ShipmentStatus.CanTransition(s.Status, ShipmentStatus.Cancelled) && !ShipmentStatus.OnTheRoad.Contains(s.Status)))
            { await _lifecycle.TransitionAsync(s, ShipmentStatus.Cancelled, ctx); n++; }
            if (b.Shipments.All(s => ShipmentStatus.Closed.Contains(s.Status))) { b.Status = ShipmentStatus.Cancelled; b.UpdatedAt = DateTime.UtcNow; await _db.SaveChangesAsync(); }
            return Ok(new { b.BookingNo, b.Status, cancelledShipments = n });
        }

        // ------------------------------------------------------------------ address book

        [HttpGet("addresses")]
        public async Task<IActionResult> Addresses([FromQuery] int customerId)
            => Ok(await _db.ShipmentAddresses.AsNoTracking().Where(a => a.CustomerId == customerId && a.IsSaved).OrderBy(a => a.Label).ToListAsync());

        [HttpPost("addresses")]
        public async Task<IActionResult> SaveAddress([FromBody] AddressInputDto dto, [FromQuery] int customerId)
        {
            if (string.IsNullOrWhiteSpace(dto.Line1)) return BadRequest(new { message = "Line1 is required" });
            dto.SaveToAddressBook = true;
            var a = await _intake.ResolveAddressAsync(dto, customerId, UserId);
            await _db.SaveChangesAsync();
            return Ok(a);
        }

        [HttpDelete("addresses/{id}")]
        public async Task<IActionResult> DeleteAddress(int id)
        {
            var a = await _db.ShipmentAddresses.FindAsync(id);
            if (a == null) return NotFound();
            a.IsSaved = false; a.UpdatedAt = DateTime.UtcNow; // soft: shipments still reference it
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Clients that can book (any active customer).</summary>
        [HttpGet("clients")]
        public async Task<IActionResult> Clients([FromQuery] string? search)
        {
            var q = _db.LogisticsCustomers.AsNoTracking().Where(c => c.Status == "Active");
            if (!string.IsNullOrWhiteSpace(search)) q = q.Where(c => c.Name.Contains(search) || (c.CustomerCode != null && c.CustomerCode.Contains(search)));
            return Ok(await q.OrderBy(c => c.Name).Take(50).Select(c => new { c.Id, c.Name, c.CustomerCode, c.ContactPerson, c.Email, c.ContactEmail, c.PhoneNumber }).ToListAsync());
        }

    }

    /// <summary>Shared projection helpers so bookings, shipments and tracking return the same shapes.</summary>
    internal static class ShipmentMapper
    {
        public static object Address(ShipmentAddress a) => new
        {
            a.Id, a.Label, a.Line1, a.Line2, a.Suburb, a.City, a.Province, a.PostalCode, a.Latitude, a.Longitude,
            a.ContactName, a.ContactPhone, a.ContactEmail, oneLine = a.OneLine
        };

        public static object ShipmentSummary(Shipment s) => new
        {
            s.Id, s.BookingId, bookingNo = s.Booking?.BookingNo, clientReference = s.Booking?.ClientReference,
            customerId = s.Booking?.CustomerId, customerName = s.Booking?.Customer?.Name, source = s.Booking?.Source,
            s.Status, s.CollectionDate, s.CollectionWindowFrom, s.CollectionWindowTo, s.RequestedDeliveryDate,
            s.LoadId, loadNumber = s.Load?.LoadNumber, s.PickupStopId, s.DeliveryStopId, s.Eta,
            waybillNo = s.Waybill?.WaybillNo, trackingToken = s.Waybill?.TrackingToken,
            s.Fragile, s.Hazardous, s.HazardClass, s.TemperatureRange, s.DamagedFlag, s.ShortFlag, s.SpecialInstructions,
            s.TotalWeightKg, s.TotalPallets, s.TotalParcels, s.CollectedAt, s.DeliveredAt, s.CreatedAt,
            pickup = s.PickupAddress != null ? Address(s.PickupAddress) : null,
            delivery = s.DeliveryAddress != null ? Address(s.DeliveryAddress) : null,
            items = s.Items?.Select(i => new { i.Id, i.Type, i.Qty, i.WeightKg, i.LengthCm, i.WidthCm, i.HeightCm, i.Description, i.ItemBarcode }).ToList()
        };

        public static object Booking(ClientBooking b) => new
        {
            b.Id, b.BookingNo, b.CustomerId, customerName = b.Customer?.Name, b.Source, b.ClientReference, b.Status,
            b.RequestedByName, b.RequestedByEmail, b.RequestedByPhone, b.RejectionReason, b.Notes, b.CreatedAt, b.ConfirmedAt,
            shipments = b.Shipments.Select(s => { s.Booking = b; return ShipmentSummary(s); }).ToList()
        };

        public static object Event(ShipmentEvent e) => new
        {
            e.Id, e.FromStatus, e.ToStatus, e.Source, e.UserId, e.UserName, e.Latitude, e.Longitude, e.ScannedCode, e.Note, e.OccurredAt
        };
    }
}
