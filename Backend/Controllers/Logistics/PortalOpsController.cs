using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics.Shipments;
using ProjectTracker.API.Services;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Intranet side of the Rocket Freight client portal ("Overberg tripsheets" page):
    ///  - waybills placed by portal clients that still need to be accepted / confirmed
    ///  - the tripsheets (loads) carrying portal shipments, with their waybills
    ///  - portal sign-ins per customer
    ///  - replies to portal support conversations
    /// Accepting is the same action as the booking queue (ClientBookingsController.Accept); this
    /// controller only adds the portal-specific views around it.
    /// </summary>
    [ApiController]
    [Route("api/logistics/portal")]
    [Authorize]
    public class PortalOpsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IShipmentLifecycleService _lifecycle;
        private readonly IEmailService _email;
        private readonly IConfiguration _config;
        private readonly ILogger<PortalOpsController> _logger;

        public PortalOpsController(ApplicationDbContext db, IShipmentLifecycleService lifecycle, IEmailService email, IConfiguration config, ILogger<PortalOpsController> logger)
        {
            _db = db; _lifecycle = lifecycle; _email = email; _config = config; _logger = logger;
        }

        private int? UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;
        private string? UserName => User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name;
        private const string PortalSource = "portal";

        // ------------------------------------------------------------------ overview

        /// <summary>Counters for the Overberg tripsheets page header.</summary>
        [HttpGet("summary")]
        public async Task<IActionResult> Summary()
        {
            var today = DateTime.UtcNow.AddHours(2).Date;
            var portal = _db.Shipments.AsNoTracking().Where(s => s.Booking.Source == PortalSource);
            return Ok(new
            {
                awaitingConfirmation = await _db.ClientBookings.CountAsync(b => b.Source == PortalSource && b.Status == ShipmentStatus.Booked),
                waybillsAwaiting = await portal.CountAsync(s => s.Status == ShipmentStatus.Booked),
                unplanned = await portal.CountAsync(s => s.Status == ShipmentStatus.Confirmed && s.LoadId == null),
                onTripsheets = await portal.CountAsync(s => s.LoadId != null && ShipmentStatus.Active.Contains(s.Status)),
                onTheRoad = await portal.CountAsync(s => ShipmentStatus.OnTheRoad.Contains(s.Status)),
                deliveredToday = await portal.CountAsync(s => s.DeliveredAt >= today && s.DeliveredAt < today.AddDays(1)),
                exceptions = await portal.CountAsync(s => s.Status == ShipmentStatus.CollectionFailed || s.Status == ShipmentStatus.DeliveryFailed),
                unreadSupport = await _db.PortalSupportMessages.CountAsync(m => m.From == "client" && !m.ReadByAgent),
                portalUsers = await _db.PortalUsers.CountAsync(u => u.IsActive)
            });
        }

        // ------------------------------------------------------------------ waybills awaiting confirmation

        /// <summary>
        /// Portal bookings (each with its waybills) still in BOOKED – the "accept / confirm" list.
        /// Confirm with POST api/logistics/bookings/{bookingNo}/accept or per waybill below.
        /// </summary>
        [HttpGet("pending")]
        public async Task<IActionResult> Pending([FromQuery] string? search)
        {
            var q = _db.ClientBookings.AsNoTracking()
                .Include(b => b.Customer)
                .Include(b => b.Shipments).ThenInclude(s => s.PickupAddress)
                .Include(b => b.Shipments).ThenInclude(s => s.DeliveryAddress)
                .Include(b => b.Shipments).ThenInclude(s => s.Items)
                .Where(b => b.Source == PortalSource && b.Shipments.Any(s => s.Status == ShipmentStatus.Booked));
            if (!string.IsNullOrWhiteSpace(search))
            {
                var t = search.Trim();
                q = q.Where(b => b.BookingNo.Contains(t) || (b.ClientReference != null && b.ClientReference.Contains(t)) || (b.Customer != null && b.Customer.Name.Contains(t)));
            }
            var rows = await q.OrderBy(b => b.CreatedAt).Take(200).ToListAsync();
            return Ok(rows.Select(b => new
            {
                b.Id, b.BookingNo, b.CustomerId, customerName = b.Customer?.Name, b.ClientReference, b.Status, b.RequestedByName, b.RequestedByEmail, b.RequestedByPhone, b.Notes, b.CreatedAt,
                waybills = b.Shipments.OrderBy(s => s.Id).Select(s => new
                {
                    s.Id, s.Status, s.CollectionDate, s.CollectionWindowFrom, s.CollectionWindowTo, s.RequestedDeliveryDate,
                    pickup = new { s.PickupAddress.Label, s.PickupAddress.Suburb, s.PickupAddress.City, s.PickupAddress.Province, oneLine = s.PickupAddress.OneLine, s.PickupAddress.ContactName, s.PickupAddress.ContactPhone },
                    delivery = new { s.DeliveryAddress.Label, s.DeliveryAddress.Suburb, s.DeliveryAddress.City, s.DeliveryAddress.Province, oneLine = s.DeliveryAddress.OneLine, s.DeliveryAddress.ContactName, s.DeliveryAddress.ContactPhone },
                    s.TotalWeightKg, s.TotalPallets, s.TotalParcels, s.Fragile, s.Hazardous, s.HazardClass, s.TemperatureRange, s.SpecialInstructions,
                    items = s.Items.Select(i => new { i.Type, i.Qty, i.WeightKg, i.Description })
                })
            }));
        }

        public record NoteBody(string? Note);
        public record ReasonBody(string Reason);

        /// <summary>Accept / confirm ONE waybill (shipment) placed from the portal. The booking is confirmed once all its waybills are.</summary>
        [HttpPost("waybills/{shipmentId:int}/confirm")]
        public async Task<IActionResult> ConfirmWaybill(int shipmentId, [FromBody] NoteBody? body)
        {
            var s = await _db.Shipments.Include(x => x.Booking).FirstOrDefaultAsync(x => x.Id == shipmentId);
            if (s == null) return NotFound();
            if (s.Status != ShipmentStatus.Booked) return BadRequest(new { message = $"Waybill is {s.Status}; only BOOKED waybills can be confirmed." });
            try
            {
                await _lifecycle.TransitionAsync(s, ShipmentStatus.Confirmed, new TransitionContext(ShipmentEventSource.Ops, UserId, UserName, body?.Note ?? "Confirmed on Overberg tripsheets"));
            }
            catch (ShipmentTransitionException ex) { return BadRequest(new { code = ex.Code, message = ex.Message }); }
            await RollUpBookingAsync(s.BookingId);
            return Ok(new { s.Id, s.Status, bookingStatus = s.Booking.Status });
        }

        /// <summary>Decline ONE waybill with a reason (sent to the client).</summary>
        [HttpPost("waybills/{shipmentId:int}/reject")]
        public async Task<IActionResult> RejectWaybill(int shipmentId, [FromBody] ReasonBody body)
        {
            if (string.IsNullOrWhiteSpace(body?.Reason)) return BadRequest(new { message = "A reason is required." });
            var s = await _db.Shipments.Include(x => x.Booking).FirstOrDefaultAsync(x => x.Id == shipmentId);
            if (s == null) return NotFound();
            if (s.Status != ShipmentStatus.Booked) return BadRequest(new { message = $"Waybill is {s.Status}; only BOOKED waybills can be declined." });
            try
            {
                await _lifecycle.TransitionAsync(s, ShipmentStatus.Rejected, new TransitionContext(ShipmentEventSource.Ops, UserId, UserName, body.Reason.Trim()));
            }
            catch (ShipmentTransitionException ex) { return BadRequest(new { code = ex.Code, message = ex.Message }); }
            await RollUpBookingAsync(s.BookingId, body.Reason.Trim());
            return Ok(new { s.Id, s.Status, bookingStatus = s.Booking.Status });
        }

        /// <summary>Booking status follows its waybills: CONFIRMED once none are BOOKED and at least one is confirmed; REJECTED when all are rejected.</summary>
        private async Task RollUpBookingAsync(int bookingId, string? rejectionReason = null)
        {
            var b = await _db.ClientBookings.Include(x => x.Shipments).FirstAsync(x => x.Id == bookingId);
            if (b.Shipments.Any(s => s.Status == ShipmentStatus.Booked)) return;
            if (b.Shipments.All(s => s.Status == ShipmentStatus.Rejected)) { b.Status = ShipmentStatus.Rejected; b.RejectionReason = rejectionReason ?? b.RejectionReason; }
            else if (b.Shipments.All(s => ShipmentStatus.Closed.Contains(s.Status))) b.Status = ShipmentStatus.Cancelled;
            else { b.Status = ShipmentStatus.Confirmed; b.ConfirmedAt ??= DateTime.UtcNow; b.ConfirmedByUserId ??= UserId; }
            b.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        // ------------------------------------------------------------------ Overberg tripsheets

        /// <summary>
        /// Loads (tripsheets) that carry at least one portal shipment, newest first, each with its waybills.
        /// status = active (default) | completed | all.
        /// </summary>
        [HttpGet("tripsheets")]
        public async Task<IActionResult> Tripsheets([FromQuery] string status = "active", [FromQuery] string? search = null, [FromQuery] DateTime? from = null, [FromQuery] DateTime? to = null)
        {
            var portal = _db.Shipments.AsNoTracking()
                .Include(s => s.Booking).ThenInclude(b => b.Customer)
                .Include(s => s.PickupAddress).Include(s => s.DeliveryAddress).Include(s => s.Waybill)
                .Where(s => s.Booking.Source == PortalSource && s.LoadId != null);
            if (status == "active") portal = portal.Where(s => ShipmentStatus.Active.Contains(s.Status));
            else if (status == "completed") portal = portal.Where(s => ShipmentStatus.Closed.Contains(s.Status));
            if (from.HasValue) portal = portal.Where(s => s.CollectionDate >= from.Value.Date);
            if (to.HasValue) portal = portal.Where(s => s.CollectionDate < to.Value.Date.AddDays(1));
            if (!string.IsNullOrWhiteSpace(search))
            {
                var t = search.Trim();
                portal = portal.Where(s => s.Booking.BookingNo.Contains(t) || (s.Booking.ClientReference != null && s.Booking.ClientReference.Contains(t))
                    || (s.Waybill != null && s.Waybill.WaybillNo.Contains(t)) || (s.Booking.Customer != null && s.Booking.Customer.Name.Contains(t))
                    || (s.Load != null && s.Load.LoadNumber.Contains(t)));
            }
            var shipments = await portal.ToListAsync();
            var loadIds = shipments.Select(s => s.LoadId!.Value).Distinct().ToList();
            var loads = await _db.Loads.AsNoTracking().Include(l => l.Driver).Include(l => l.Vehicle).Include(l => l.Warehouse).Include(l => l.Stops)
                .Where(l => loadIds.Contains(l.Id)).ToListAsync();

            var rows = loads.OrderByDescending(l => l.ScheduledPickupDate ?? l.CreatedAt).Select(l =>
            {
                var mine = shipments.Where(s => s.LoadId == l.Id).OrderBy(s => s.PickupStopId).ToList();
                return new
                {
                    loadId = l.Id, l.LoadNumber, tripsheetNo = l.LoadNumber, l.Status,
                    driverName = l.Driver != null ? $"{l.Driver.FirstName} {l.Driver.LastName}".Trim() : null,
                    vehicleReg = l.Vehicle?.RegistrationNumber,
                    warehouse = l.Warehouse?.Name,
                    date = l.ScheduledPickupDate ?? l.CreatedAt,
                    scheduledDelivery = l.ScheduledDeliveryDate,
                    totalStops = l.Stops.Count,
                    portalStops = mine.Count * 2,
                    distanceKm = l.EstimatedDistance,
                    customers = mine.Select(s => s.Booking.Customer?.Name).Where(n => n != null).Distinct().ToList(),
                    totalKg = mine.Sum(s => s.TotalWeightKg),
                    waybills = mine.Select(s => new
                    {
                        s.Id, waybillNo = s.Waybill?.WaybillNo, trackingToken = s.Waybill?.TrackingToken, bookingNo = s.Booking.BookingNo, clientReference = s.Booking.ClientReference,
                        customerName = s.Booking.Customer?.Name, s.Status, s.CollectionDate, s.RequestedDeliveryDate, s.Eta, s.CollectedAt, s.DeliveredAt,
                        from = s.PickupAddress.Suburb ?? s.PickupAddress.City, to = s.DeliveryAddress.Suburb ?? s.DeliveryAddress.City,
                        s.TotalWeightKg, s.TotalPallets, s.TotalParcels, s.Fragile, s.Hazardous
                    })
                };
            });
            return Ok(rows);
        }

        // ------------------------------------------------------------------ portal sign-ins

        [HttpGet("users")]
        public async Task<IActionResult> Users([FromQuery] int? customerId)
        {
            var q = _db.PortalUsers.AsNoTracking().Include(u => u.Customer).AsQueryable();
            if (customerId.HasValue) q = q.Where(u => u.CustomerId == customerId);
            var rows = await q.OrderBy(u => u.Customer!.Name).ThenBy(u => u.Name).ToListAsync();
            return Ok(rows.Select(UserRow));
        }

        public class PortalUserDto
        {
            public int CustomerId { get; set; }
            public string Name { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public string? Phone { get; set; }
            public string Role { get; set; } = "user";
            /// <summary>Optional. When empty a temporary password is generated and emailed to the user.</summary>
            public string? Password { get; set; }
            public bool SendWelcomeEmail { get; set; } = true;
        }

        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] PortalUserDto dto)
        {
            var email = dto.Email?.Trim().ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(email) || !email.Contains('@')) return BadRequest(new { message = "A valid email is required." });
            if (string.IsNullOrWhiteSpace(dto.Name)) return BadRequest(new { message = "Name is required." });
            var customer = await _db.LogisticsCustomers.FindAsync(dto.CustomerId);
            if (customer == null) return BadRequest(new { message = "Unknown customer." });
            if (await _db.PortalUsers.AnyAsync(u => u.Email == email)) return Conflict(new { message = "A portal login with that email already exists." });

            var password = string.IsNullOrWhiteSpace(dto.Password) ? TempPassword() : dto.Password;
            var u = new PortalUser
            {
                CustomerId = dto.CustomerId, Name = dto.Name.Trim(), Email = email, Phone = dto.Phone?.Trim(),
                Role = dto.Role == "admin" ? "admin" : "user", PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
                MustChangePassword = true, CreatedByUserId = UserId
            };
            _db.PortalUsers.Add(u);
            await _db.SaveChangesAsync();
            u.Customer = customer;
            if (dto.SendWelcomeEmail) _ = SendWelcomeAsync(u, password);
            _logger.LogInformation("Portal login {Email} created for customer {Cust} by {User}", email, customer.Name, UserName);
            return Ok(new { user = UserRow(u), temporaryPassword = dto.SendWelcomeEmail ? null : password });
        }

        public record UpdateUserBody(string? Name, string? Phone, string? Role, bool? IsActive);

        [HttpPut("users/{id:int}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserBody body)
        {
            var u = await _db.PortalUsers.Include(x => x.Customer).FirstOrDefaultAsync(x => x.Id == id);
            if (u == null) return NotFound();
            if (!string.IsNullOrWhiteSpace(body.Name)) u.Name = body.Name.Trim();
            if (body.Phone != null) u.Phone = body.Phone.Trim();
            if (!string.IsNullOrWhiteSpace(body.Role)) u.Role = body.Role == "admin" ? "admin" : "user";
            if (body.IsActive.HasValue) u.IsActive = body.IsActive.Value;
            u.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(UserRow(u));
        }

        /// <summary>Sets a new temporary password and emails it (or returns it when email is off).</summary>
        [HttpPost("users/{id:int}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id, [FromQuery] bool sendEmail = true)
        {
            var u = await _db.PortalUsers.Include(x => x.Customer).FirstOrDefaultAsync(x => x.Id == id);
            if (u == null) return NotFound();
            var password = TempPassword();
            u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(password); u.MustChangePassword = true; u.FailedLogins = 0; u.LockedUntil = null; u.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            if (sendEmail) _ = SendWelcomeAsync(u, password, reset: true);
            return Ok(new { temporaryPassword = sendEmail ? null : password });
        }

        private static object UserRow(PortalUser u) => new
        {
            u.Id, u.CustomerId, customerName = u.Customer?.Name, u.Name, u.Email, u.Phone, u.Role, u.IsActive, u.MustChangePassword, u.LastLoginAt, u.LockedUntil, u.CreatedAt
        };

        private static string TempPassword()
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
            return new string(RandomNumberGenerator.GetBytes(10).Select(b => chars[b % chars.Length]).ToArray()) + "!";
        }

        private async Task SendWelcomeAsync(PortalUser u, string password, bool reset = false)
        {
            try
            {
                var url = (_config["Portal:PublicUrl"] ?? "https://portal.rocketfreight.co.za").TrimEnd('/');
                var subject = reset ? "Your Rocket Freight portal password was reset" : "Your Rocket Freight client portal login";
                var body = $@"<p>Hi {System.Net.WebUtility.HtmlEncode(u.Name)},</p>
<p>{(reset ? "Your password for the Rocket Freight client portal has been reset." : $"A Rocket Freight client portal login has been created for <b>{System.Net.WebUtility.HtmlEncode(u.Customer?.Name ?? "")}</b>.")}</p>
<p>Sign in at <a href=""{url}"">{url}</a><br/>Email: <b>{u.Email}</b><br/>Temporary password: <b>{System.Net.WebUtility.HtmlEncode(password)}</b></p>
<p>You will be asked to choose your own password after signing in. If you did not expect this email, please contact us.</p>";
                await _email.SendEmailAsync(u.Email, subject, body);
            }
            catch (Exception ex) { _logger.LogWarning(ex, "Could not send portal welcome email to {Email}", u.Email); }
        }

        // ------------------------------------------------------------------ support conversations

        /// <summary>Portal support threads with unread client messages first.</summary>
        [HttpGet("support")]
        public async Task<IActionResult> SupportThreads()
        {
            var rows = await _db.PortalSupportMessages.AsNoTracking()
                .GroupBy(m => m.PortalUserId)
                .Select(g => new
                {
                    portalUserId = g.Key,
                    unread = g.Count(m => m.From == "client" && !m.ReadByAgent),
                    lastAt = g.Max(m => m.CreatedAt),
                    last = g.OrderByDescending(m => m.Id).Select(m => new { m.From, m.Text, m.ShipmentRef }).FirstOrDefault()
                })
                .OrderByDescending(x => x.unread > 0).ThenByDescending(x => x.lastAt).Take(100).ToListAsync();
            var users = await _db.PortalUsers.AsNoTracking().Include(u => u.Customer).Where(u => rows.Select(r => r.portalUserId).Contains(u.Id)).ToDictionaryAsync(u => u.Id);
            return Ok(rows.Select(r => new
            {
                r.portalUserId, r.unread, r.lastAt, r.last,
                userName = users.TryGetValue(r.portalUserId, out var u) ? u.Name : null,
                customerName = users.TryGetValue(r.portalUserId, out var c) ? c.Customer?.Name : null,
                email = users.TryGetValue(r.portalUserId, out var e) ? e.Email : null
            }));
        }

        [HttpGet("support/{portalUserId:int}")]
        public async Task<IActionResult> SupportThread(int portalUserId)
        {
            var msgs = await _db.PortalSupportMessages.Where(m => m.PortalUserId == portalUserId).OrderBy(m => m.Id).ToListAsync();
            foreach (var m in msgs.Where(m => m.From == "client" && !m.ReadByAgent)) m.ReadByAgent = true;
            await _db.SaveChangesAsync();
            return Ok(msgs.Select(m => new { m.Id, m.From, m.Text, m.AuthorName, m.ShipmentId, m.ShipmentRef, m.CreatedAt }));
        }

        public record ReplyBody(string Text);

        [HttpPost("support/{portalUserId:int}/reply")]
        public async Task<IActionResult> Reply(int portalUserId, [FromBody] ReplyBody body)
        {
            if (string.IsNullOrWhiteSpace(body?.Text)) return BadRequest(new { message = "Reply is empty." });
            if (!await _db.PortalUsers.AnyAsync(u => u.Id == portalUserId)) return NotFound();
            var m = new PortalSupportMessage { PortalUserId = portalUserId, From = "agent", Text = body.Text.Trim(), AuthorName = (UserName ?? "Rocket Freight").Split(' ')[0], AgentUserId = UserId, ReadByAgent = true };
            _db.PortalSupportMessages.Add(m);
            await _db.SaveChangesAsync();
            return Ok(new { m.Id, m.From, m.Text, m.AuthorName, m.CreatedAt });
        }
    }
}
