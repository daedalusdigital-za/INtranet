using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics.Shipments;
using ProjectTracker.API.Models.Logistics.Shipments;
using ProjectTracker.API.Services;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Controllers.Portal
{
    /// <summary>
    /// Rocket Freight client portal API (/api/portal). Implements exactly the contract in the
    /// portal's core/models.ts and README:
    ///   - the customer is ALWAYS the one on the token; customerId is never accepted as input
    ///   - client-safe data only: no internal notes, driver names/phones, load numbers or other
    ///     customers' stops
    ///   - bookings go through the same <see cref="IBookingIntakeService"/> as the ops dialog,
    ///     with source = portal; ops then accept/confirm them on the Overberg tripsheets page.
    /// Portal tokens use their own bearer scheme (audience) so they cannot call intranet APIs.
    /// </summary>
    [ApiController]
    [Route("api/portal")]
    [Authorize(AuthenticationSchemes = PortalAuth.Scheme)]
    public class PortalController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IPortalTokenService _tokens;
        private readonly IBookingIntakeService _intake;
        private readonly IShipmentLifecycleService _lifecycle;
        private readonly IWaybillService _waybills;
        private readonly IEmailService _email;
        private readonly IConfiguration _config;
        private readonly ILogger<PortalController> _logger;

        public PortalController(ApplicationDbContext db, IPortalTokenService tokens, IBookingIntakeService intake, IShipmentLifecycleService lifecycle,
            IWaybillService waybills, IEmailService email, IConfiguration config, ILogger<PortalController> logger)
        {
            _db = db; _tokens = tokens; _intake = intake; _lifecycle = lifecycle; _waybills = waybills; _email = email; _config = config; _logger = logger;
        }

        // ------------------------------------------------------------------ identity from the token

        private int PortalUserId => int.TryParse(User.FindFirst(PortalAuth.ClaimPortalUserId)?.Value, out var id) ? id : 0;
        private int CustomerId => int.TryParse(User.FindFirst(PortalAuth.ClaimCustomerId)?.Value, out var id) ? id : 0;
        private string? PortalUserName => User.FindFirst("name")?.Value;
        private bool IsPortalAdmin => User.FindFirst("portal_role")?.Value == "admin";

        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private static readonly string DummyHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N"));

        // ------------------------------------------------------------------ auth

        public record LoginDto(string Email, string Password);
        public record ForgotDto(string Email);

        /// <summary>POST /auth/login → LoginResponse; 401 wrong details; 429 when locked after repeated failures.</summary>
        [HttpPost("auth/login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto?.Email) || string.IsNullOrWhiteSpace(dto.Password)) return Unauthorized(new { message = "Email or password is incorrect." });
            var email = dto.Email.Trim().ToLowerInvariant();
            var u = await _db.PortalUsers.Include(x => x.Customer).FirstOrDefaultAsync(x => x.Email == email);
            if (u == null || !u.IsActive)
            {
                // Burn roughly the same time as a real hash check so unknown emails are not detectable by timing.
                try { BCrypt.Net.BCrypt.Verify(dto.Password, DummyHash); } catch { /* ignore */ }
                return Unauthorized(new { message = "Email or password is incorrect." });
            }
            if (u.LockedUntil.HasValue && u.LockedUntil > DateTime.UtcNow)
                return StatusCode(429, new { message = $"Too many attempts. Try again after {u.LockedUntil:HH:mm} UTC." });

            bool ok;
            try { ok = BCrypt.Net.BCrypt.Verify(dto.Password, u.PasswordHash); } catch { ok = false; }
            if (!ok)
            {
                u.FailedLogins++;
                if (u.FailedLogins >= 5) { u.LockedUntil = DateTime.UtcNow.AddMinutes(15); u.FailedLogins = 0; }
                await _db.SaveChangesAsync();
                return Unauthorized(new { message = "Email or password is incorrect." });
            }

            u.FailedLogins = 0; u.LockedUntil = null; u.LastLoginAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            var (token, exp) = _tokens.Issue(u);
            return Ok(new { token, expiresAt = exp, user = ClientUser(u) });
        }

        /// <summary>POST /auth/forgot-password → 204 always (never reveals whether the email exists).</summary>
        [HttpPost("auth/forgot-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotDto dto)
        {
            var email = dto?.Email?.Trim().ToLowerInvariant();
            if (!string.IsNullOrWhiteSpace(email))
            {
                var u = await _db.PortalUsers.FirstOrDefaultAsync(x => x.Email == email && x.IsActive);
                if (u != null)
                {
                    u.ResetToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(24)).ToLowerInvariant();
                    u.ResetTokenExpiresAt = DateTime.UtcNow.AddHours(2);
                    await _db.SaveChangesAsync();
                    var link = $"{PortalBase()}/login?reset={u.ResetToken}";
                    _ = _email.SendEmailAsync(u.Email, "Reset your Rocket Freight portal password",
                        $"<p>Hi {System.Net.WebUtility.HtmlEncode(u.Name)},</p><p>Use the link below within 2 hours to choose a new password:</p><p><a href=\"{link}\">{link}</a></p><p>If you did not ask for this, ignore this email.</p>");
                }
            }
            return NoContent();
        }

        public record ResetDto(string Token, string Password);

        /// <summary>POST /auth/reset-password {token, password} – completes the forgot-password flow.</summary>
        [HttpPost("auth/reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword([FromBody] ResetDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto?.Token) || (dto.Password?.Length ?? 0) < 8) return BadRequest(new { message = "Password must be at least 8 characters." });
            var u = await _db.PortalUsers.FirstOrDefaultAsync(x => x.ResetToken == dto.Token && x.ResetTokenExpiresAt > DateTime.UtcNow && x.IsActive);
            if (u == null) return BadRequest(new { message = "This reset link is no longer valid." });
            u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password); u.ResetToken = null; u.ResetTokenExpiresAt = null; u.MustChangePassword = false; u.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        public record ChangePasswordDto(string CurrentPassword, string NewPassword);

        [HttpPost("auth/change-password")]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            var u = await _db.PortalUsers.FindAsync(PortalUserId);
            if (u == null) return Unauthorized();
            if (!BCrypt.Net.BCrypt.Verify(dto.CurrentPassword ?? "", u.PasswordHash)) return BadRequest(new { message = "Current password is incorrect." });
            if ((dto.NewPassword?.Length ?? 0) < 8) return BadRequest(new { message = "New password must be at least 8 characters." });
            u.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword); u.MustChangePassword = false; u.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>GET /me → ClientUser</summary>
        [HttpGet("me")]
        public async Task<IActionResult> Me()
        {
            var u = await _db.PortalUsers.AsNoTracking().Include(x => x.Customer).FirstOrDefaultAsync(x => x.Id == PortalUserId && x.IsActive);
            return u == null ? Unauthorized() : Ok(ClientUser(u));
        }

        private static object ClientUser(PortalUser u) => new
        {
            u.Id, u.Name, u.Email, phone = u.Phone ?? "", role = u.Role == "admin" ? "admin" : "user",
            customerName = u.Customer?.Name ?? "", u.MustChangePassword
        };

        // ------------------------------------------------------------------ shipments

        private static readonly Dictionary<string, string[]> FilterStatuses = new()
        {
            ["active"] = ShipmentStatus.Active,
            ["awaiting"] = new[] { ShipmentStatus.Booked },
            ["scheduled"] = new[] { ShipmentStatus.Confirmed, ShipmentStatus.Planned, ShipmentStatus.WaybillIssued },
            ["onTheRoad"] = ShipmentStatus.OnTheRoad,
            ["attention"] = new[] { ShipmentStatus.CollectionFailed, ShipmentStatus.DeliveryFailed },
            ["delivered"] = new[] { ShipmentStatus.Delivered },
            ["closed"] = new[] { ShipmentStatus.Rejected, ShipmentStatus.Cancelled },
        };

        private IQueryable<Shipment> Mine() => _db.Shipments.AsNoTracking()
            .Include(s => s.Booking).Include(s => s.PickupAddress).Include(s => s.DeliveryAddress).Include(s => s.Waybill).Include(s => s.Items)
            .Where(s => s.Booking.CustomerId == CustomerId);

        /// <summary>GET /shipments/counts → ShipmentCounts (active, awaiting, scheduled, onTheRoad, attention, delivered)</summary>
        [HttpGet("shipments/counts")]
        public async Task<IActionResult> Counts()
        {
            var rows = await _db.Shipments.AsNoTracking().Where(s => s.Booking.CustomerId == CustomerId)
                .GroupBy(s => s.Status).Select(g => new { g.Key, n = g.Count() }).ToListAsync();
            int Sum(string[] st) => rows.Where(r => st.Contains(r.Key)).Sum(r => r.n);
            return Ok(new
            {
                active = Sum(FilterStatuses["active"]), awaiting = Sum(FilterStatuses["awaiting"]), scheduled = Sum(FilterStatuses["scheduled"]),
                onTheRoad = Sum(FilterStatuses["onTheRoad"]), attention = Sum(FilterStatuses["attention"]), delivered = Sum(FilterStatuses["delivered"])
            });
        }

        /// <summary>GET /shipments?filter=&search=&from=&to=&page=&pageSize= → Page&lt;ShipmentSummary&gt;</summary>
        [HttpGet("shipments")]
        public async Task<IActionResult> Shipments([FromQuery] string filter = "active", [FromQuery] string? search = null, [FromQuery] DateTime? from = null,
            [FromQuery] DateTime? to = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            page = Math.Max(1, page); pageSize = Math.Clamp(pageSize, 1, 100);
            var q = Mine();
            if (FilterStatuses.TryGetValue(filter ?? "active", out var st)) q = q.Where(s => st.Contains(s.Status));
            if (from.HasValue) q = q.Where(s => s.CollectionDate >= from.Value.Date);
            if (to.HasValue) q = q.Where(s => s.CollectionDate < to.Value.Date.AddDays(1));
            if (!string.IsNullOrWhiteSpace(search))
            {
                var t = search.Trim();
                q = q.Where(s => s.Booking.BookingNo.Contains(t) || (s.Booking.ClientReference != null && s.Booking.ClientReference.Contains(t))
                    || (s.Waybill != null && s.Waybill.WaybillNo.Contains(t))
                    || (s.DeliveryAddress.Suburb != null && s.DeliveryAddress.Suburb.Contains(t)) || (s.DeliveryAddress.City != null && s.DeliveryAddress.City.Contains(t))
                    || (s.PickupAddress.Suburb != null && s.PickupAddress.Suburb.Contains(t)) || (s.PickupAddress.City != null && s.PickupAddress.City.Contains(t)));
            }
            var total = await q.CountAsync();
            var items = await q.OrderByDescending(s => ShipmentStatus.Active.Contains(s.Status)).ThenByDescending(s => s.CollectionDate).ThenByDescending(s => s.Id)
                .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();
            return Ok(new { items = items.Select(Summary), total, page, pageSize });
        }

        /// <summary>GET /shipments/{id} → ShipmentDetail; 404 if it is not this customer's.</summary>
        [HttpGet("shipments/{id:int}")]
        public async Task<IActionResult> ShipmentDetail(int id)
        {
            var s = await Mine().Include(x => x.Pod).Include(x => x.Exceptions).Include(x => x.Load).ThenInclude(l => l!.Vehicle).FirstOrDefaultAsync(x => x.Id == id);
            if (s == null) return NotFound();
            var events = await _db.ShipmentEvents.AsNoTracking().Where(e => e.ShipmentId == id).OrderBy(e => e.OccurredAt).ThenBy(e => e.Id).ToListAsync();
            return Ok(Detail(s, events));
        }

        public record CancelDto(string? Reason);

        /// <summary>POST /shipments/{id}/cancel {reason} → ShipmentDetail; 409 unless BOOKED or CONFIRMED.</summary>
        [HttpPost("shipments/{id:int}/cancel")]
        public async Task<IActionResult> CancelShipment(int id, [FromBody] CancelDto? dto)
        {
            var s = await _db.Shipments.Include(x => x.Booking).FirstOrDefaultAsync(x => x.Id == id && x.Booking.CustomerId == CustomerId);
            if (s == null) return NotFound();
            if (s.Status is not (ShipmentStatus.Booked or ShipmentStatus.Confirmed))
                return Conflict(new { message = "This shipment is already being planned or is on the road. Please contact support to cancel it." });
            var note = string.IsNullOrWhiteSpace(dto?.Reason) ? "Cancelled by client in the portal" : $"Cancelled by client: {dto!.Reason!.Trim()}";
            await _lifecycle.TransitionAsync(s, ShipmentStatus.Cancelled, new TransitionContext(ShipmentEventSource.Client, null, PortalUserName, note));
            var open = await _db.Shipments.CountAsync(x => x.BookingId == s.BookingId && !ShipmentStatus.Closed.Contains(x.Status));
            if (open == 0) { s.Booking.Status = ShipmentStatus.Cancelled; s.Booking.UpdatedAt = DateTime.UtcNow; await _db.SaveChangesAsync(); }
            return await ShipmentDetail(id);
        }

        // ------------------------------------------------------------------ bookings

        /// <summary>POST /bookings/validate → ValidationResult (nothing saved). Same rules as the ops New booking dialog.</summary>
        [HttpPost("bookings/validate")]
        public IActionResult ValidateBooking([FromBody] PortalBookingRequest req)
        {
            var errors = _intake.Validate(ToDto(req));
            return Ok(new { ok = errors.Count == 0, problems = errors.Select(Problem).ToList() });
        }

        /// <summary>POST /bookings → 201 BookingResult; 422 {problems}.</summary>
        [HttpPost("bookings")]
        public async Task<IActionResult> CreateBooking([FromBody] PortalBookingRequest req)
        {
            try
            {
                var (booking, shipments) = await _intake.CreateAsync(ToDto(req), null, PortalUserName);
                return StatusCode(201, new { booking.BookingNo, shipmentIds = shipments.Select(s => s.Id).ToList() });
            }
            catch (BookingValidationException ex)
            {
                return UnprocessableEntity(new { problems = ex.Errors.Select(Problem).ToList() });
            }
        }

        private CreateBookingDto ToDto(PortalBookingRequest r) => new()
        {
            CustomerId = CustomerId,
            Source = "portal",
            ClientReference = r.ClientReference,
            RequestedByName = r.RequestedBy?.Name ?? PortalUserName,
            RequestedByEmail = r.RequestedBy?.Email ?? User.FindFirst(ClaimTypes.Email)?.Value,
            RequestedByPhone = r.RequestedBy?.Phone,
            Shipments = (r.Shipments ?? new()).Select(s => new ShipmentInputDto
            {
                Pickup = ToAddr(s.Pickup), Delivery = ToAddr(s.Delivery),
                CollectionDate = ParseDay(s.CollectionDate), CollectionWindowFrom = s.WindowFrom, CollectionWindowTo = s.WindowTo,
                RequestedDeliveryDate = ParseDay(s.DeliverBy),
                Fragile = s.Fragile, Hazardous = s.Hazardous, HazardClass = s.HazardClass, TemperatureRange = s.TempRange, SpecialInstructions = s.Instructions,
                Items = (s.Cargo ?? new()).Select(c => new ShipmentItemInputDto
                {
                    Type = c.Type ?? "parcel", Qty = c.Qty, WeightKg = c.WeightKg, LengthCm = c.LengthCm, WidthCm = c.WidthCm, HeightCm = c.HeightCm, Description = c.Description
                }).ToList()
            }).ToList()
        };

        private static AddressInputDto ToAddr(PortalAddressInput? a)
        {
            if (a == null) return new AddressInputDto();
            if (a.AddressId.HasValue) return new AddressInputDto { AddressId = a.AddressId };
            var x = a.Address ?? new PortalAddress();
            return new AddressInputDto
            {
                Label = x.Label, Line1 = x.Street, Line2 = x.Unit, Suburb = x.Suburb, City = x.City, Province = x.Province, PostalCode = x.PostalCode,
                Latitude = x.Lat, Longitude = x.Lng, GooglePlaceId = x.PlaceId, ContactName = x.ContactName, ContactPhone = x.ContactPhone, ContactEmail = x.ContactEmail,
                SaveToAddressBook = a.SaveToBook
            };
        }

        private static DateTime ParseDay(string? s) => DateTime.TryParse(s, out var d) ? d.Date : default;

        /// <summary>"Shipment 2: cargo line 1: weight must be…" → { path: "shipments[1].cargo[0].weightKg", message }.</summary>
        private static object Problem(string error)
        {
            var path = "";
            var msg = error;
            var m = System.Text.RegularExpressions.Regex.Match(error, @"^Shipment (\d+): (?:cargo line (\d+): )?(.*)$");
            if (m.Success)
            {
                path = $"shipments[{int.Parse(m.Groups[1].Value) - 1}]";
                if (m.Groups[2].Success) path += $".cargo[{int.Parse(m.Groups[2].Value) - 1}]";
                msg = m.Groups[3].Value;
                var low = msg.ToLowerInvariant();
                if (low.StartsWith("pickup")) path += ".pickup";
                else if (low.StartsWith("delivery address")) path += ".delivery";
                else if (low.StartsWith("collection date")) path += ".collectionDate";
                else if (low.StartsWith("requested delivery")) path += ".deliverBy";
                else if (low.StartsWith("collection window")) path += ".windowFrom";
                else if (low.StartsWith("hazard class")) path += ".hazardClass";
                else if (low.StartsWith("weight")) path += ".weightKg";
                else if (low.StartsWith("quantity")) path += ".qty";
                else if (low.StartsWith("description")) path += ".description";
                else if (low.StartsWith("type")) path += ".type";
                else if (low.StartsWith("at least one cargo")) path += ".cargo";
                if (msg.Length > 0) msg = char.ToUpper(msg[0]) + msg[1..];
            }
            else if (error.StartsWith("Client reference")) path = "clientReference";
            return new { path, message = msg };
        }

        // ------------------------------------------------------------------ address book

        [HttpGet("addresses")]
        public async Task<IActionResult> Addresses()
            => Ok((await _db.ShipmentAddresses.AsNoTracking().Where(a => a.CustomerId == CustomerId && a.IsSaved).OrderBy(a => a.Label).ThenBy(a => a.Suburb).ToListAsync()).Select(PortalAddr));

        [HttpPost("addresses")]
        public async Task<IActionResult> AddAddress([FromBody] PortalAddress a)
        {
            if (string.IsNullOrWhiteSpace(a.Street)) return BadRequest(new { message = "Street is required." });
            var dto = ToAddr(new PortalAddressInput { Address = a, SaveToBook = true });
            var saved = await _intake.ResolveAddressAsync(dto, CustomerId, null);
            return Ok(PortalAddr(saved));
        }

        [HttpPut("addresses/{id:int}")]
        public async Task<IActionResult> UpdateAddress(int id, [FromBody] PortalAddress a)
        {
            var x = await _db.ShipmentAddresses.FirstOrDefaultAsync(z => z.Id == id && z.CustomerId == CustomerId && z.IsSaved);
            if (x == null) return NotFound();
            if (string.IsNullOrWhiteSpace(a.Street)) return BadRequest(new { message = "Street is required." });
            x.Label = a.Label?.Trim(); x.Line1 = a.Street.Trim(); x.Line2 = a.Unit?.Trim(); x.Suburb = a.Suburb?.Trim(); x.City = a.City?.Trim(); x.Province = a.Province?.Trim();
            x.PostalCode = a.PostalCode?.Trim(); x.ContactName = a.ContactName?.Trim(); x.ContactPhone = a.ContactPhone?.Trim(); x.ContactEmail = a.ContactEmail?.Trim();
            if (a.Lat.HasValue && a.Lng.HasValue) { x.Latitude = a.Lat; x.Longitude = a.Lng; x.GooglePlaceId = a.PlaceId; }
            x.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(PortalAddr(x));
        }

        [HttpDelete("addresses/{id:int}")]
        public async Task<IActionResult> DeleteAddress(int id)
        {
            var x = await _db.ShipmentAddresses.FirstOrDefaultAsync(z => z.Id == id && z.CustomerId == CustomerId);
            if (x == null) return NotFound();
            x.IsSaved = false; x.UpdatedAt = DateTime.UtcNow; // soft: existing shipments still reference it
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private static object PortalAddr(ShipmentAddress a) => new
        {
            a.Id, label = a.Label, street = a.Line1, unit = a.Line2, suburb = a.Suburb ?? "", city = a.City ?? "", province = a.Province ?? "", postalCode = a.PostalCode ?? "",
            contactName = a.ContactName ?? "", contactPhone = a.ContactPhone ?? "", contactEmail = a.ContactEmail, lat = a.Latitude, lng = a.Longitude, placeId = a.GooglePlaceId
        };

        // ------------------------------------------------------------------ notification settings

        private static readonly string[] NotificationEvents = { "BOOKED", "CONFIRMED", "REJECTED", "COLLECTED", "ARRIVING", "DELIVERED", "PROBLEM", "CANCELLED" };

        [HttpGet("settings/notifications")]
        public async Task<IActionResult> NotificationPrefs()
        {
            var row = await _db.PortalNotificationPrefs.AsNoTracking().FirstOrDefaultAsync(p => p.PortalUserId == PortalUserId);
            return Ok(row == null ? DefaultPrefs() : Normalise(JsonSerializer.Deserialize<PortalNotificationPrefs>(row.PrefsJson, Json)));
        }

        [HttpPut("settings/notifications")]
        public async Task<IActionResult> SaveNotificationPrefs([FromBody] PortalNotificationPrefs prefs)
        {
            var clean = Normalise(prefs);
            var row = await _db.PortalNotificationPrefs.FirstOrDefaultAsync(p => p.PortalUserId == PortalUserId);
            if (row == null) { row = new PortalNotificationPref { PortalUserId = PortalUserId }; _db.PortalNotificationPrefs.Add(row); }
            row.PrefsJson = JsonSerializer.Serialize(clean, Json); row.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(clean);
        }

        private bool SmsEnabled => !string.IsNullOrWhiteSpace(_config["Sms:Provider"]) || !string.IsNullOrWhiteSpace(_config["Sms:ApiKey"]) || !string.IsNullOrWhiteSpace(_config["Sms:Username"]);

        private PortalNotificationPrefs DefaultPrefs() => new()
        {
            Rules = NotificationEvents.Select(e => new PortalNotificationRule { Event = e, Email = true, Sms = false, SmsAvailable = SmsEnabled && e is "ARRIVING" or "DELIVERED" or "PROBLEM" }).ToList(),
            ExtraEmails = new(), SmsOptIn = false
        };

        private PortalNotificationPrefs Normalise(PortalNotificationPrefs? p)
        {
            var d = DefaultPrefs();
            if (p == null) return d;
            foreach (var r in d.Rules)
            {
                var given = p.Rules?.FirstOrDefault(x => string.Equals(x.Event, r.Event, StringComparison.OrdinalIgnoreCase));
                if (given != null) { r.Email = given.Email; r.Sms = r.SmsAvailable && given.Sms; }
            }
            d.ExtraEmails = (p.ExtraEmails ?? new()).Select(e => e.Trim()).Where(e => e.Contains('@')).Distinct(StringComparer.OrdinalIgnoreCase).Take(10).ToList();
            d.SmsNumber = string.IsNullOrWhiteSpace(p.SmsNumber) ? null : p.SmsNumber.Trim();
            d.SmsOptIn = p.SmsOptIn && d.SmsNumber != null;
            return d;
        }

        // ------------------------------------------------------------------ documents (short-lived signed links)

        /// <summary>GET /shipments/{id}/documents/{waybill|labels|pod} → {url} valid for 10 minutes, no bearer needed to fetch it.</summary>
        [HttpGet("shipments/{id:int}/documents/{kind}")]
        public async Task<IActionResult> DocumentUrl(int id, string kind)
        {
            kind = kind.ToLowerInvariant();
            if (kind is not ("waybill" or "labels" or "pod")) return NotFound();
            var s = await _db.Shipments.AsNoTracking().Include(x => x.Waybill).Include(x => x.Pod).FirstOrDefaultAsync(x => x.Id == id && x.Booking.CustomerId == CustomerId);
            if (s == null) return NotFound();
            if (kind != "pod" && s.Waybill == null) return NotFound(new { message = "The waybill is issued once your shipment is planned." });
            if (kind == "pod" && s.Pod == null) return NotFound(new { message = "No proof of delivery yet." });
            return Ok(new { url = $"{ApiBase()}/api/portal/documents/{Sign($"doc|{id}|{kind}", TimeSpan.FromMinutes(10))}" });
        }

        /// <summary>Streams a PDF for a signed document token (see DocumentUrl). Anonymous because the browser opens it in a new tab.</summary>
        [HttpGet("documents/{token}")]
        [AllowAnonymous]
        public async Task<IActionResult> Document(string token)
        {
            var payload = Verify(token);
            if (payload == null) return NotFound();
            var parts = payload.Split('|');
            if (parts.Length != 3 || parts[0] != "doc" || !int.TryParse(parts[1], out var id)) return NotFound();
            try
            {
                var wb = await _db.ShipmentWaybills.AsNoTracking().FirstOrDefaultAsync(w => w.ShipmentId == id);
                return parts[2] switch
                {
                    "waybill" when wb != null => File(await _waybills.RenderWaybillPdfAsync(id), "application/pdf", $"{wb.WaybillNo}.pdf"),
                    "labels" when wb != null => File(await _waybills.RenderLabelPdfAsync(id), "application/pdf", $"{wb.WaybillNo}-labels.pdf"),
                    "pod" => File(await _waybills.RenderPodPdfAsync(id), "application/pdf", $"POD-{wb?.WaybillNo ?? id.ToString()}.pdf"),
                    _ => NotFound()
                };
            }
            catch (InvalidOperationException ex) { return NotFound(new { message = ex.Message }); }
        }

        /// <summary>Signed access to an uploaded POD signature / photo (the /uploads folder itself needs an intranet login).</summary>
        [HttpGet("files/{token}")]
        [AllowAnonymous]
        public IActionResult FileByToken(string token)
        {
            var payload = Verify(token);
            if (payload == null || !payload.StartsWith("file|")) return NotFound();
            var rel = payload[5..].Replace('\\', '/').TrimStart('/');
            if (rel.Contains("..")) return NotFound();
            var full = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "uploads", rel));
            var root = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "uploads"));
            if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !System.IO.File.Exists(full)) return NotFound();
            var ext = Path.GetExtension(full).ToLowerInvariant();
            var mime = ext switch { ".png" => "image/png", ".jpg" or ".jpeg" => "image/jpeg", ".webp" => "image/webp", ".gif" => "image/gif", ".pdf" => "application/pdf", _ => "application/octet-stream" };
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return PhysicalFile(full, mime);
        }

        private string Sign(string payload, TimeSpan ttl)
        {
            var exp = DateTimeOffset.UtcNow.Add(ttl).ToUnixTimeSeconds();
            var body = $"{payload}|{exp}";
            var sig = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(PortalAuth.SigningKey(_config)), Encoding.UTF8.GetBytes(body))).ToLowerInvariant();
            return Base64Url($"{body}|{sig}");
        }

        private string? Verify(string token)
        {
            string raw;
            try { raw = Encoding.UTF8.GetString(Convert.FromBase64String(token.Replace('-', '+').Replace('_', '/').PadRight(token.Length + (4 - token.Length % 4) % 4, '='))); }
            catch { return null; }
            var i = raw.LastIndexOf('|'); if (i <= 0) return null;
            var sig = raw[(i + 1)..]; var body = raw[..i];
            var expected = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(PortalAuth.SigningKey(_config)), Encoding.UTF8.GetBytes(body))).ToLowerInvariant();
            if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(sig), Encoding.UTF8.GetBytes(expected))) return null;
            var j = body.LastIndexOf('|'); if (j <= 0) return null;
            if (!long.TryParse(body[(j + 1)..], out var exp) || DateTimeOffset.FromUnixTimeSeconds(exp) < DateTimeOffset.UtcNow) return null;
            return body[..j];
        }

        private static string Base64Url(string s) => Convert.ToBase64String(Encoding.UTF8.GetBytes(s)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        private string FileUrl(string? rel) => string.IsNullOrWhiteSpace(rel) ? "" : $"{ApiBase()}/api/portal/files/{Sign($"file|{rel}", TimeSpan.FromHours(1))}";

        private string ApiBase() => (_config["Portal:PublicApiBase"] ?? $"{Request.Scheme}://{Request.Host}").TrimEnd('/');
        private string PortalBase() => (_config["Portal:PublicUrl"] ?? "https://portal.rocketfreight.co.za").TrimEnd('/');

        // ------------------------------------------------------------------ support chat

        [HttpGet("support/thread")]
        public async Task<IActionResult> SupportThread()
        {
            var msgs = await _db.PortalSupportMessages.AsNoTracking().Where(m => m.PortalUserId == PortalUserId).OrderBy(m => m.CreatedAt).ThenBy(m => m.Id).ToListAsync();
            await MarkClientRead();
            return Ok(new { id = $"pu-{PortalUserId}", messages = msgs.Select(SupportMsg), hours = SupportHours(), online = SupportOnline() });
        }

        public record SendMessageDto(string Text, int? ShipmentId);

        [HttpPost("support/thread/messages")]
        public async Task<IActionResult> SendSupportMessage([FromBody] SendMessageDto dto)
        {
            var text = dto?.Text?.Trim();
            if (string.IsNullOrWhiteSpace(text)) return BadRequest(new { message = "Message is empty." });
            string? reference = null;
            if (dto!.ShipmentId.HasValue)
            {
                var s = await _db.Shipments.AsNoTracking().Include(x => x.Booking).Include(x => x.Waybill).FirstOrDefaultAsync(x => x.Id == dto.ShipmentId && x.Booking.CustomerId == CustomerId);
                if (s == null) return BadRequest(new { message = "Unknown shipment." });
                reference = s.Waybill?.WaybillNo ?? s.Booking.BookingNo;
            }
            var m = new PortalSupportMessage { PortalUserId = PortalUserId, From = "client", Text = text[..Math.Min(text.Length, 4000)], AuthorName = PortalUserName, ShipmentId = dto.ShipmentId, ShipmentRef = reference, ReadByClient = true };
            _db.PortalSupportMessages.Add(m);
            await _db.SaveChangesAsync();
            return Ok(SupportMsg(m));
        }

        [HttpGet("support/thread/messages")]
        public async Task<IActionResult> SupportMessagesAfter([FromQuery] string? after)
        {
            var q = _db.PortalSupportMessages.AsNoTracking().Where(m => m.PortalUserId == PortalUserId);
            if (int.TryParse(after, out var afterId)) q = q.Where(m => m.Id > afterId);
            var msgs = await q.OrderBy(m => m.Id).Take(200).ToListAsync();
            if (msgs.Count > 0) await MarkClientRead();
            return Ok(msgs.Select(SupportMsg));
        }

        private async Task MarkClientRead()
        {
            var unread = await _db.PortalSupportMessages.Where(m => m.PortalUserId == PortalUserId && !m.ReadByClient && m.From != "client").ToListAsync();
            if (unread.Count == 0) return;
            foreach (var m in unread) m.ReadByClient = true;
            await _db.SaveChangesAsync();
        }

        private static object SupportMsg(PortalSupportMessage m) => new
        {
            id = m.Id.ToString(), from = m.From, text = m.Text, at = m.CreatedAt, authorName = m.AuthorName, shipmentRef = m.ShipmentRef
        };

        private string SupportHours() => _config["Portal:SupportHours"] ?? "Mon–Fri 07:00–17:00";
        private bool SupportOnline()
        {
            var now = DateTime.UtcNow.AddHours(2); // SAST
            var open = int.TryParse(_config["Portal:SupportOpenHour"], out var o) ? o : 7;
            var close = int.TryParse(_config["Portal:SupportCloseHour"], out var c) ? c : 17;
            return now.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday) && now.Hour >= open && now.Hour < close;
        }

        // ------------------------------------------------------------------ projections (client wording only)

        private static string Day(DateTime d) => d.ToString("yyyy-MM-dd");

        private object Summary(Shipment s) => new
        {
            s.Id, bookingNo = s.Booking.BookingNo, waybillNo = s.Waybill?.WaybillNo, clientReference = s.Booking.ClientReference, s.Status,
            from = new { suburb = s.PickupAddress.Suburb ?? "", city = s.PickupAddress.City ?? "" },
            to = new { suburb = s.DeliveryAddress.Suburb ?? "", city = s.DeliveryAddress.City ?? "" },
            collectionDate = Day(s.CollectionDate), deliverBy = Day(s.RequestedDeliveryDate),
            pieces = s.TotalPallets + s.TotalParcels, totalKg = s.TotalWeightKg, eta = s.Eta, s.DeliveredAt
        };

        private object Detail(Shipment s, List<ShipmentEvent> events)
        {
            var pickup = PortalAddr(s.PickupAddress);
            var delivery = PortalAddr(s.DeliveryAddress);
            var lastProblem = s.Exceptions.Where(e => e.ResolvedAt == null).OrderByDescending(e => e.CreatedAt).FirstOrDefault();
            object? tracking = null;
            if (ShipmentStatus.OnTheRoad.Contains(s.Status) && s.Load?.Vehicle is { LastKnownLatitude: not null, LastKnownLongitude: not null } v)
            {
                var lat = (double)v.LastKnownLatitude!.Value; var lng = (double)v.LastKnownLongitude!.Value;
                double? kmRemaining = null; double progress = s.Status == ShipmentStatus.Arriving ? 0.95 : 0.5;
                if (s.DeliveryAddress.Latitude.HasValue && s.DeliveryAddress.Longitude.HasValue)
                {
                    kmRemaining = Math.Round(Haversine(lat, lng, s.DeliveryAddress.Latitude.Value, s.DeliveryAddress.Longitude.Value), 1);
                    if (s.PickupAddress.Latitude.HasValue && s.PickupAddress.Longitude.HasValue)
                    {
                        var total = Haversine(s.PickupAddress.Latitude.Value, s.PickupAddress.Longitude.Value, s.DeliveryAddress.Latitude.Value, s.DeliveryAddress.Longitude.Value);
                        if (total > 0.5) progress = Math.Clamp(1 - kmRemaining.Value / total, 0.02, 0.98);
                    }
                }
                tracking = new { lat, lng, updatedAt = v.LastLocationUpdate ?? DateTime.UtcNow, eta = s.Eta, kmRemaining, progress };
            }
            object? pod = null;
            if (s.Status == ShipmentStatus.Delivered && s.Pod != null)
            {
                var photos = Controllers.Logistics.ShipmentsController.Photos(s.Pod.PhotoPathsJson);
                pod = new
                {
                    receiverName = s.Pod.ReceiverName ?? "", deliveredAt = s.Pod.DeliveredAt, signatureUrl = FileUrl(s.Pod.SignaturePath),
                    photoUrls = photos.Select(FileUrl).Where(u => u != "").ToList(), damaged = s.DamagedFlag, @short = s.ShortFlag, note = s.Pod.Note
                };
            }
            return new
            {
                s.Id, bookingNo = s.Booking.BookingNo, waybillNo = s.Waybill?.WaybillNo, clientReference = s.Booking.ClientReference, s.Status,
                from = new { suburb = s.PickupAddress.Suburb ?? "", city = s.PickupAddress.City ?? "" },
                to = new { suburb = s.DeliveryAddress.Suburb ?? "", city = s.DeliveryAddress.City ?? "" },
                collectionDate = Day(s.CollectionDate), deliverBy = Day(s.RequestedDeliveryDate),
                pieces = s.TotalPallets + s.TotalParcels, totalKg = s.TotalWeightKg, eta = s.Eta, s.DeliveredAt,
                pickup, delivery, windowFrom = s.CollectionWindowFrom ?? "", windowTo = s.CollectionWindowTo ?? "",
                cargo = s.Items.Select(i => new { type = i.Type, qty = i.Qty, weightKg = i.WeightKg, lengthCm = i.LengthCm, widthCm = i.WidthCm, heightCm = i.HeightCm, description = i.Description ?? "", itemBarcode = i.ItemBarcode }),
                s.Fragile, s.Hazardous, s.HazardClass, tempRange = s.TemperatureRange, instructions = s.SpecialInstructions,
                events = events.Where(e => ClientVisible(e.ToStatus)).Select(e => new { status = e.ToStatus, at = e.OccurredAt, text = EventText(e) }),
                tracking, pod,
                problem = s.Status switch
                {
                    ShipmentStatus.CollectionFailed or ShipmentStatus.DeliveryFailed => ProblemText(s.Status, lastProblem?.ReasonCode),
                    ShipmentStatus.Rejected => events.Where(e => e.ToStatus == ShipmentStatus.Rejected).OrderByDescending(e => e.OccurredAt).Select(e => e.Note).FirstOrDefault(n => !string.IsNullOrWhiteSpace(n)) ?? "Rocket Freight could not accept this booking. Please contact support.",
                    _ => null
                },
                trackingUrl = s.Waybill != null ? _waybills.TrackingUrl(s.Waybill.TrackingToken) : null,
                canCancel = s.Status is ShipmentStatus.Booked or ShipmentStatus.Confirmed
            };
        }

        private static bool ClientVisible(string status) => status != ShipmentStatus.Planned; // PLANNED is internal; the client sees "Scheduled" via WAYBILL_ISSUED

        private static string EventText(ShipmentEvent e) => e.ToStatus switch
        {
            ShipmentStatus.Booked => "Booking received",
            ShipmentStatus.Confirmed when e.FromStatus is ShipmentStatus.CollectionFailed or ShipmentStatus.DeliveryFailed => "A new attempt has been scheduled",
            ShipmentStatus.Confirmed => "Booking confirmed by Rocket Freight",
            ShipmentStatus.WaybillIssued => "Scheduled for collection – waybill issued",
            ShipmentStatus.Collected => "Collected by our driver",
            ShipmentStatus.InTransit => "On the road to the delivery address",
            ShipmentStatus.Arriving => "Our vehicle is close to the delivery address",
            ShipmentStatus.Delivered => "Delivered – proof of delivery available",
            ShipmentStatus.CollectionFailed => "Collection could not be completed",
            ShipmentStatus.DeliveryFailed => "Delivery attempt was not successful",
            ShipmentStatus.Rejected => "We were unable to accept this booking",
            ShipmentStatus.Cancelled => e.Source == ShipmentEventSource.Client ? "Cancelled by you" : "Cancelled",
            _ => e.ToStatus
        };

        private static string ProblemText(string status, string? reason)
        {
            var stage = status == ShipmentStatus.CollectionFailed ? "collection" : "delivery";
            var code = (reason ?? "").Trim().ToUpperInvariant().Replace(' ', '_');
            var why = code switch
            {
                "CLOSED" or "SITE_CLOSED" or "PREMISES_CLOSED" => $"The {stage} site was closed when the driver arrived.",
                "NO_ANSWER" or "NOBODY_HOME" or "NO_CONTACT" => "Nobody was available to receive the goods and the contact could not be reached.",
                "REFUSED" or "REFUSED_DELIVERY" => "The goods were refused at the delivery address.",
                "WRONG_ADDRESS" or "ADDRESS_NOT_FOUND" or "ADDRESS" => "The driver could not find the address as given.",
                "NOT_READY" or "GOODS_NOT_READY" => "The goods were not ready for collection.",
                "ACCESS" or "NO_ACCESS" or "ACCESS_DENIED" => "The driver could not get access to the site.",
                "VEHICLE_BREAKDOWN" or "BREAKDOWN" => "Our vehicle had a breakdown on the way.",
                "WEATHER" => "Weather conditions made it unsafe to continue.",
                "DAMAGED" => "The goods were found damaged and could not be delivered.",
                _ => $"The {stage} could not be completed."
            };
            return $"{why} We will schedule a new attempt and let you know the new date.";
        }

        private static double Haversine(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371.0;
            double dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
            double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        }
    }

    // ---------------------------------------------------------------------- request shapes (mirror core/models.ts)

    public class PortalAddress
    {
        public int? Id { get; set; }
        public string? Label { get; set; }
        public string Street { get; set; } = string.Empty;
        public string? Unit { get; set; }
        public string? Suburb { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public string? ContactName { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactEmail { get; set; }
        public double? Lat { get; set; }
        public double? Lng { get; set; }
        public string? PlaceId { get; set; }
    }

    public class PortalAddressInput
    {
        public int? AddressId { get; set; }
        public PortalAddress? Address { get; set; }
        public bool SaveToBook { get; set; }
    }

    public class PortalCargoLine
    {
        public string? Type { get; set; } = "parcel";
        public int Qty { get; set; } = 1;
        public decimal WeightKg { get; set; }
        public decimal? LengthCm { get; set; }
        public decimal? WidthCm { get; set; }
        public decimal? HeightCm { get; set; }
        public string? Description { get; set; }
    }

    public class PortalShipmentDraft
    {
        public PortalAddressInput? Pickup { get; set; }
        public PortalAddressInput? Delivery { get; set; }
        public string? CollectionDate { get; set; }
        public string? WindowFrom { get; set; }
        public string? WindowTo { get; set; }
        public string? DeliverBy { get; set; }
        public List<PortalCargoLine>? Cargo { get; set; }
        public bool Fragile { get; set; }
        public bool Hazardous { get; set; }
        public string? HazardClass { get; set; }
        public string? TempRange { get; set; }
        public string? Instructions { get; set; }
    }

    public class PortalRequestedBy { public string? Name { get; set; } public string? Email { get; set; } public string? Phone { get; set; } }

    public class PortalBookingRequest
    {
        public string? ClientReference { get; set; }
        public PortalRequestedBy? RequestedBy { get; set; }
        public List<PortalShipmentDraft>? Shipments { get; set; }
    }

    public class PortalNotificationRule { public string Event { get; set; } = ""; public bool Email { get; set; } public bool Sms { get; set; } public bool SmsAvailable { get; set; } }

    public class PortalNotificationPrefs
    {
        public List<PortalNotificationRule> Rules { get; set; } = new();
        public List<string> ExtraEmails { get; set; } = new();
        public string? SmsNumber { get; set; }
        public bool SmsOptIn { get; set; }
    }
}
