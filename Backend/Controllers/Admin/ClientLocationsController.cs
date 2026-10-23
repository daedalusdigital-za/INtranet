using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services.Google;

namespace ProjectTracker.API.Controllers.Admin
{
    /// <summary>
    /// Admin Settings → Client Locations.
    ///
    /// Lists every customer with the delivery address held in the database and lets an
    /// admin correct + verify it. Verifying writes the address back to the customer record
    /// AND upserts it as the customer's default <see cref="CustomerDeliveryAddress"/> flagged
    /// <c>IsVerified</c>, which is what the tripsheet dialog reads — verified stops render purple.
    /// </summary>
    [Authorize(Roles = "Super Admin,Admin,Manager")]
    [ApiController]
    [Route("api/admin/client-locations")]
    public class ClientLocationsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly GeocodingService _geocoding;
        private readonly ILogger<ClientLocationsController> _logger;
        private readonly IHttpClientFactory _httpFactory;

        public ClientLocationsController(ApplicationDbContext context, GeocodingService geocoding, ILogger<ClientLocationsController> logger, IHttpClientFactory httpFactory)
        {
            _context = context;
            _geocoding = geocoding;
            _logger = logger;
            _httpFactory = httpFactory;
        }

        private string CurrentUserName =>
            User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? User.FindFirst(ClaimTypes.Email)?.Value
            ?? User.Identity?.Name
            ?? "admin";

        // ═══ GET list ═══
        [HttpGet]
        public async Task<ActionResult<ClientLocationPageDto>> List(
            [FromQuery] string? search = null,
            [FromQuery] string filter = "all",     // all | verified | unverified | nocoords
            [FromQuery] string? province = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 10, 500);

            var q = _context.LogisticsCustomers.AsNoTracking().Where(c => c.Status != "Deleted");

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                q = q.Where(c =>
                    c.Name.ToLower().Contains(s) ||
                    (c.ShortName != null && c.ShortName.ToLower().Contains(s)) ||
                    (c.CustomerCode != null && c.CustomerCode.ToLower().Contains(s)) ||
                    (c.DeliveryAddress != null && c.DeliveryAddress.ToLower().Contains(s)) ||
                    (c.PhysicalAddress != null && c.PhysicalAddress.ToLower().Contains(s)) ||
                    (c.Address != null && c.Address.ToLower().Contains(s)) ||
                    (c.City != null && c.City.ToLower().Contains(s)) ||
                    (c.DeliveryCity != null && c.DeliveryCity.ToLower().Contains(s)));
            }

            if (!string.IsNullOrWhiteSpace(province))
            {
                var p = province.Trim().ToLower();
                q = q.Where(c => (c.DeliveryProvince ?? c.Province ?? "").ToLower() == p);
            }

            q = filter switch
            {
                "verified"   => q.Where(c => c.AddressVerified == true),
                "unverified" => q.Where(c => c.AddressVerified != true),
                "nocoords"   => q.Where(c => c.Latitude == null || c.Longitude == null),
                _            => q
            };

            var total = await q.CountAsync();
            var verifiedTotal = await _context.LogisticsCustomers.CountAsync(c => c.Status != "Deleted" && c.AddressVerified == true);
            var allTotal = await _context.LogisticsCustomers.CountAsync(c => c.Status != "Deleted");
            var noCoordsTotal = await _context.LogisticsCustomers.CountAsync(c => c.Status != "Deleted" && (c.Latitude == null || c.Longitude == null));

            var rows = await q
                .OrderBy(c => c.AddressVerified == true ? 1 : 0)   // unverified first
                .ThenBy(c => c.Name)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(c => new ClientLocationDto
                {
                    Id = c.Id,
                    CustomerCode = c.CustomerCode,
                    Name = c.Name,
                    ShortName = c.ShortName,
                    Status = c.Status,
                    Address = c.DeliveryAddress ?? c.PhysicalAddress ?? c.Address,
                    City = c.DeliveryCity ?? c.City,
                    Province = c.DeliveryProvince ?? c.Province,
                    PostalCode = c.DeliveryPostalCode ?? c.PostalCode,
                    Latitude = c.Latitude,
                    Longitude = c.Longitude,
                    GooglePlaceId = c.GooglePlaceId,
                    AddressVerified = c.AddressVerified == true,
                    AddressVerifiedAt = c.AddressVerifiedAt,
                    AddressVerifiedBy = c.AddressVerifiedBy,
                    ContactPerson = c.ContactPerson,
                    PhoneNumber = c.PhoneNumber,
                    SavedAddressCount = c.DeliveryAddresses.Count(a => a.IsActive),
                    UpdatedAt = c.UpdatedAt
                })
                .ToListAsync();

            return Ok(new ClientLocationPageDto
            {
                Items = rows, Total = total, Page = page, PageSize = pageSize,
                Summary = new ClientLocationSummaryDto { Total = allTotal, Verified = verifiedTotal, Unverified = allTotal - verifiedTotal, MissingCoordinates = noCoordsTotal }
            });
        }

        // ═══ GET provinces for filter ═══
        [HttpGet("provinces")]
        public async Task<ActionResult<IEnumerable<string>>> Provinces()
        {
            var list = await _context.LogisticsCustomers.AsNoTracking()
                .Select(c => c.DeliveryProvince ?? c.Province)
                .Where(p => p != null && p != "")
                .Distinct()
                .OrderBy(p => p)
                .ToListAsync();
            return Ok(list);
        }

        // ═══ GET one customer's saved delivery addresses ═══
        [HttpGet("{id}/addresses")]
        public async Task<ActionResult<IEnumerable<object>>> SavedAddresses(int id)
        {
            var list = await _context.CustomerDeliveryAddresses.AsNoTracking()
                .Where(a => a.CustomerId == id && a.IsActive)
                .OrderByDescending(a => a.IsVerified).ThenByDescending(a => a.IsDefault).ThenByDescending(a => a.UsageCount)
                .Select(a => new
                {
                    a.Id, a.AddressLabel, a.Address, a.FormattedAddress, a.City, a.Province, a.PostalCode,
                    a.Latitude, a.Longitude, a.IsDefault, a.IsVerified, a.VerifiedAt, a.VerifiedBy, a.UsageCount, a.LastUsedAt
                })
                .ToListAsync();
            return Ok(list);
        }

        // ═══ GET geocode (server-side, uses the admin-configured key) ═══
        [HttpGet("geocode")]
        public async Task<IActionResult> Geocode([FromQuery] string? address, [FromQuery] string? placeId = null)
        {
            if (string.IsNullOrWhiteSpace(address) && string.IsNullOrWhiteSpace(placeId)) return BadRequest(new { message = "Address is required" });
            var r = await _geocoding.GeocodeAddressAsync(address ?? "", "ZA", placeId);
            return Ok(r);
        }

        // ═══ GET address suggestions (Google Places Autocomplete, proxied so the key stays server-side) ═══
        [HttpGet("suggest")]
        public async Task<IActionResult> Suggest([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 3) return Ok(Array.Empty<object>());
            try
            {
                var http = _httpFactory.CreateClient();
                var url = "https://maps.googleapis.com/maps/api/place/autocomplete/json" +
                          $"?input={Uri.EscapeDataString(q.Trim())}&components=country:za&language=en&key={GoogleMapsConfig.ApiKey}";
                using var doc = System.Text.Json.JsonDocument.Parse(await http.GetStringAsync(url));
                var root = doc.RootElement;
                var status = root.GetProperty("status").GetString();
                if (status != "OK" && status != "ZERO_RESULTS")
                {
                    var err = root.TryGetProperty("error_message", out var em) ? em.GetString() : status;
                    _logger.LogWarning("Places autocomplete failed: {Status} {Error}", status, err);
                    return StatusCode(502, new { message = $"Google Places: {status} — {err}" });
                }
                var list = new List<object>();
                if (root.TryGetProperty("predictions", out var preds))
                    foreach (var p in preds.EnumerateArray())
                    {
                        var sf = p.TryGetProperty("structured_formatting", out var s) ? s : default;
                        list.Add(new
                        {
                            placeId = p.GetProperty("place_id").GetString(),
                            description = p.GetProperty("description").GetString(),
                            mainText = sf.ValueKind == System.Text.Json.JsonValueKind.Object && sf.TryGetProperty("main_text", out var mt) ? mt.GetString() : null,
                            secondaryText = sf.ValueKind == System.Text.Json.JsonValueKind.Object && sf.TryGetProperty("secondary_text", out var st) ? st.GetString() : null
                        });
                    }
                return Ok(list);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Places autocomplete error");
                return StatusCode(502, new { message = "Address suggestions unavailable" });
            }
        }

        // ═══ PUT verify ═══
        /// <summary>Save the (possibly corrected) address and mark it as admin-verified.</summary>
        [HttpPut("{id}/verify")]
        public async Task<ActionResult<ClientLocationDto>> Verify(int id, [FromBody] VerifyClientLocationDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Address))
                return BadRequest(new { message = "Address is required" });

            var c = await _context.LogisticsCustomers.Include(x => x.DeliveryAddresses).FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return NotFound(new { message = "Customer not found" });

            // Geocode on the server if the admin did not supply coordinates
            double? lat = dto.Latitude, lng = dto.Longitude;
            string? placeId = dto.GooglePlaceId;
            string? city = dto.City, province = dto.Province, postal = dto.PostalCode;
            if (lat == null || lng == null)
            {
                var g = await _geocoding.GeocodeAddressAsync(dto.Address, "ZA", placeId);
                if (g.Success && g.Latitude.HasValue && g.Longitude.HasValue)
                {
                    lat = g.Latitude; lng = g.Longitude; placeId ??= g.PlaceId;
                    city ??= g.City; province ??= g.Province; postal ??= g.PostalCode;
                }
                else if (dto.RequireCoordinates)
                {
                    return BadRequest(new { message = "Address could not be geocoded: " + (g.Error ?? "no match") });
                }
            }

            var now = DateTime.UtcNow;
            var who = CurrentUserName;
            var address = dto.Address.Trim();

            // 1) Customer record
            c.DeliveryAddress = address;
            c.DeliveryCity = city;
            c.DeliveryProvince = province;
            c.DeliveryPostalCode = postal;
            if (string.IsNullOrWhiteSpace(c.PhysicalAddress)) c.PhysicalAddress = address;
            if (string.IsNullOrWhiteSpace(c.City)) c.City = city;
            if (string.IsNullOrWhiteSpace(c.Province)) c.Province = province;
            c.Latitude = lat; c.Longitude = lng; c.GooglePlaceId = placeId;
            c.AddressVerified = true; c.AddressVerifiedAt = now; c.AddressVerifiedBy = who;
            c.UpdatedAt = now;

            // 2) Saved delivery address (what tripsheets consume)
            var norm = Normalize(address);
            var existing = c.DeliveryAddresses.FirstOrDefault(a => a.IsActive && (Normalize(a.Address) == norm || (a.FormattedAddress != null && Normalize(a.FormattedAddress) == norm)));
            foreach (var a in c.DeliveryAddresses) { a.IsDefault = false; }
            if (existing == null)
            {
                existing = new CustomerDeliveryAddress
                {
                    CustomerId = c.Id,
                    AddressLabel = dto.Label ?? "Verified delivery address",
                    Address = address,
                    CreatedAt = now
                };
                _context.CustomerDeliveryAddresses.Add(existing);
            }
            existing.Address = address;
            existing.FormattedAddress = address;
            existing.City = city; existing.Province = province; existing.PostalCode = postal;
            existing.Latitude = lat; existing.Longitude = lng; existing.GooglePlaceId = placeId;
            existing.IsDefault = true; existing.IsActive = true;
            existing.IsVerified = true; existing.VerifiedAt = now; existing.VerifiedBy = who;
            if (!string.IsNullOrWhiteSpace(dto.Label)) existing.AddressLabel = dto.Label;
            if (dto.DeliveryInstructions != null) existing.DeliveryInstructions = dto.DeliveryInstructions;
            existing.UpdatedAt = now;

            // Any other saved address for this customer is no longer the verified one
            foreach (var a in c.DeliveryAddresses.Where(a => a.Id != existing.Id && a.IsVerified))
            { a.IsVerified = false; a.UpdatedAt = now; }

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException ex)
            {
                var detail = ex.InnerException?.Message ?? ex.Message;
                _logger.LogError(ex, "Failed to verify client location {Id}", id);
                return StatusCode(500, new { message = "Failed to save verified address: " + detail });
            }
            _logger.LogInformation("Client location verified: customer {Id} '{Name}' by {User}", c.Id, c.Name, who);

            return Ok(ToDto(c));
        }

        // ═══ POST unverify ═══
        [HttpPost("{id}/unverify")]
        public async Task<ActionResult<ClientLocationDto>> Unverify(int id)
        {
            var c = await _context.LogisticsCustomers.Include(x => x.DeliveryAddresses).FirstOrDefaultAsync(x => x.Id == id);
            if (c == null) return NotFound(new { message = "Customer not found" });
            c.AddressVerified = false; c.AddressVerifiedAt = null; c.AddressVerifiedBy = null; c.UpdatedAt = DateTime.UtcNow;
            foreach (var a in c.DeliveryAddresses.Where(a => a.IsVerified)) { a.IsVerified = false; a.VerifiedAt = null; a.VerifiedBy = null; a.UpdatedAt = DateTime.UtcNow; }
            await _context.SaveChangesAsync();
            return Ok(ToDto(c));
        }

        // ═══ Google Maps API key (admin) ═══
        [HttpGet("google-api-key")]
        public async Task<ActionResult<object>> GetGoogleKey()
        {
            var s = await _context.SystemSettings.AsNoTracking().FirstOrDefaultAsync(x => x.Key == SystemSettingKeys.GoogleMapsApiKey);
            var effective = GoogleMapsConfig.ApiKey;
            return Ok(new
            {
                configured = s != null && !string.IsNullOrWhiteSpace(s.Value),
                masked = Mask(effective),
                source = GoogleMapsConfig.IsOverridden ? "admin" : "default",
                updatedAt = s?.UpdatedAt,
                updatedBy = s?.UpdatedBy
            });
        }

        [HttpPut("google-api-key")]
        public async Task<ActionResult<object>> SetGoogleKey([FromBody] SetApiKeyDto dto)
        {
            var key = (dto.ApiKey ?? "").Trim();
            var s = await _context.SystemSettings.FirstOrDefaultAsync(x => x.Key == SystemSettingKeys.GoogleMapsApiKey);
            if (string.IsNullOrEmpty(key))
            {
                if (s != null) _context.SystemSettings.Remove(s);
            }
            else
            {
                if (!key.StartsWith("AIza", StringComparison.Ordinal) || key.Length < 30)
                    return BadRequest(new { message = "That does not look like a Google API key (should start with 'AIza')." });
                if (s == null) { s = new SystemSetting { Key = SystemSettingKeys.GoogleMapsApiKey, Description = "Google Maps Platform API key (Geocoding, Places, Routes)" }; _context.SystemSettings.Add(s); }
                s.Value = key; s.UpdatedAt = DateTime.UtcNow; s.UpdatedBy = CurrentUserName;
            }
            await _context.SaveChangesAsync();
            GoogleMapsConfig.SetApiKey(string.IsNullOrEmpty(key) ? null : key);
            _logger.LogInformation("Google Maps API key {Action} by {User}", string.IsNullOrEmpty(key) ? "reset to default" : "updated", CurrentUserName);
            return await GetGoogleKey();
        }

        /// <summary>Quick connectivity test for the configured key.</summary>
        [HttpPost("google-api-key/test")]
        public async Task<ActionResult<object>> TestGoogleKey()
        {
            var r = await _geocoding.GeocodeAddressAsync("1 Sandton Drive, Sandton, Johannesburg", "ZA", null);
            return Ok(new { ok = r.Success, error = r.Error, sample = r.FormattedAddress, lat = r.Latitude, lng = r.Longitude });
        }

        // ═══ helpers ═══
        private static string Normalize(string? s) =>
            new string((s ?? "").ToLowerInvariant().Where(ch => char.IsLetterOrDigit(ch)).ToArray());

        private static string Mask(string key) =>
            string.IsNullOrEmpty(key) ? "" : key.Length <= 10 ? "••••" : $"{key[..6]}••••••••{key[^4..]}";

        private static ClientLocationDto ToDto(Customer c) => new()
        {
            Id = c.Id, CustomerCode = c.CustomerCode, Name = c.Name, ShortName = c.ShortName, Status = c.Status,
            Address = c.DeliveryAddress ?? c.PhysicalAddress ?? c.Address,
            City = c.DeliveryCity ?? c.City, Province = c.DeliveryProvince ?? c.Province, PostalCode = c.DeliveryPostalCode ?? c.PostalCode,
            Latitude = c.Latitude, Longitude = c.Longitude, GooglePlaceId = c.GooglePlaceId,
            AddressVerified = c.AddressVerified == true, AddressVerifiedAt = c.AddressVerifiedAt, AddressVerifiedBy = c.AddressVerifiedBy,
            ContactPerson = c.ContactPerson, PhoneNumber = c.PhoneNumber,
            SavedAddressCount = c.DeliveryAddresses?.Count(a => a.IsActive) ?? 0, UpdatedAt = c.UpdatedAt
        };
    }

    // ═══ DTOs ═══
    public class ClientLocationDto
    {
        public int Id { get; set; }
        public string? CustomerCode { get; set; }
        public string Name { get; set; } = "";
        public string? ShortName { get; set; }
        public string Status { get; set; } = "";
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string? GooglePlaceId { get; set; }
        public bool AddressVerified { get; set; }
        public DateTime? AddressVerifiedAt { get; set; }
        public string? AddressVerifiedBy { get; set; }
        public string? ContactPerson { get; set; }
        public string? PhoneNumber { get; set; }
        public int SavedAddressCount { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }

    public class ClientLocationSummaryDto
    {
        public int Total { get; set; }
        public int Verified { get; set; }
        public int Unverified { get; set; }
        public int MissingCoordinates { get; set; }
    }

    public class ClientLocationPageDto
    {
        public List<ClientLocationDto> Items { get; set; } = new();
        public int Total { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public ClientLocationSummaryDto Summary { get; set; } = new();
    }

    public class VerifyClientLocationDto
    {
        public string Address { get; set; } = "";
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? PostalCode { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string? GooglePlaceId { get; set; }
        public string? Label { get; set; }
        public string? DeliveryInstructions { get; set; }
        /// <summary>Fail instead of saving without coordinates when geocoding finds nothing.</summary>
        public bool RequireCoordinates { get; set; } = true;
    }

    public class SetApiKeyDto { public string? ApiKey { get; set; } }
}
