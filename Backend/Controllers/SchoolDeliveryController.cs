using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Services.SchoolDelivery;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Proxies and aggregates data from the external School Delivery
    /// Management (SDM) APIs (Western Cape, KZN, Eastern Cape) for the
    /// Sanitary Pads project. All read-only.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SchoolDeliveryController : ControllerBase
    {
        private readonly ISchoolDeliveryService _sdm;
        private readonly ILogger<SchoolDeliveryController> _logger;

        public SchoolDeliveryController(ISchoolDeliveryService sdm, ILogger<SchoolDeliveryController> logger)
        {
            _sdm = sdm;
            _logger = logger;
        }

        private IActionResult DisabledIfNeeded()
            => _sdm.IsEnabled ? null! : StatusCode(503, new { error = "School Delivery integration is disabled" });

        // GET: api/schooldelivery/regions
        [HttpGet("regions")]
        public IActionResult GetRegions()
        {
            if (DisabledIfNeeded() is IActionResult disabled) return disabled;
            return Ok(_sdm.RegionCodes);
        }

        // GET: api/schooldelivery/status  (all regions)
        // GET: api/schooldelivery/status/WC  (single region)
        [HttpGet("status")]
        [HttpGet("status/{region}")]
        public async Task<IActionResult> GetStatus(string? region, CancellationToken ct)
        {
            if (DisabledIfNeeded() is IActionResult disabled) return disabled;

            if (string.IsNullOrWhiteSpace(region))
                return Ok(await _sdm.GetAllStatusAsync(ct));

            return Ok(await _sdm.GetStatusAsync(region, ct));
        }

        // POST: api/schooldelivery/{region}/login
        [HttpPost("{region}/login")]
        public async Task<IActionResult> Login(string region, [FromBody] SdmLoginRequest body, CancellationToken ct)
        {
            if (DisabledIfNeeded() is IActionResult disabled) return disabled;
            if (body == null || string.IsNullOrWhiteSpace(body.Email) || string.IsNullOrWhiteSpace(body.Password))
                return BadRequest(new { error = "Email and password are required" });

            var (success, error) = await _sdm.LoginAsync(region, body.Email, body.Password, ct);
            if (!success)
                // Return 200 (not 401) so the intranet's global auth interceptor
                // doesn't mistake this for an expired intranet session.
                return Ok(new { success = false, error = error ?? "Authentication failed" });

            return Ok(new { success = true, region });
        }

        // POST: api/schooldelivery/{region}/logout
        [HttpPost("{region}/logout")]
        public IActionResult Logout(string region)
        {
            if (DisabledIfNeeded() is IActionResult disabled) return disabled;
            _sdm.Logout(region);
            return Ok(new { success = true });
        }

        // GET: api/schooldelivery/{region}/statistics
        [HttpGet("{region}/statistics")]
        public Task<IActionResult> GetStatistics(string region, CancellationToken ct)
            => Proxy(region, "/api/delivery/statistics", ct);

        // GET: api/schooldelivery/statistics  (aggregated across all regions)
        [HttpGet("statistics")]
        public Task<IActionResult> GetAllStatistics(CancellationToken ct)
            => ProxyAll("/api/delivery/statistics", ct);

        // GET: api/schooldelivery/{region}/schools
        [HttpGet("{region}/schools")]
        public Task<IActionResult> GetSchools(string region, [FromQuery] string? province,
            [FromQuery] string? district, [FromQuery] string? status, CancellationToken ct = default)
        {
            var query = BuildQuery(("province", province), ("district", district), ("status", status));
            return Proxy(region, $"/api/schools{query}", ct);
        }

        // GET: api/schooldelivery/{region}/schools/statistics
        [HttpGet("{region}/schools/statistics")]
        public Task<IActionResult> GetSchoolStatistics(string region, CancellationToken ct)
            => Proxy(region, "/api/schools/statistics", ct);

        // GET: api/schooldelivery/{region}/deliveries
        [HttpGet("{region}/deliveries")]
        public Task<IActionResult> GetDeliveries(string region, [FromQuery] string? status,
            [FromQuery] int? schoolId, [FromQuery] int? driverId, [FromQuery] string? district,
            [FromQuery] string? priority, CancellationToken ct = default)
        {
            var query = BuildQuery(("status", status), ("schoolId", schoolId?.ToString()),
                ("driverId", driverId?.ToString()), ("district", district), ("priority", priority));
            return Proxy(region, $"/api/delivery{query}", ct);
        }

        // GET: api/schooldelivery/{region}/deliveries/track/{trackingNumber}
        [HttpGet("{region}/deliveries/track/{trackingNumber}")]
        public Task<IActionResult> TrackDelivery(string region, string trackingNumber, CancellationToken ct)
            => Proxy(region, $"/api/delivery/track/{Uri.EscapeDataString(trackingNumber)}", ct);

        // GET: api/schooldelivery/{region}/tripsheets
        [HttpGet("{region}/tripsheets")]
        public Task<IActionResult> GetTripSheets(string region, [FromQuery] string? status,
            [FromQuery] int? driverId, CancellationToken ct = default)
        {
            var query = BuildQuery(("status", status), ("driverId", driverId?.ToString()));
            return Proxy(region, $"/api/tripsheets{query}", ct);
        }

        // GET: api/schooldelivery/{region}/tripsheets/today
        [HttpGet("{region}/tripsheets/today")]
        public Task<IActionResult> GetTripSheetsToday(string region, CancellationToken ct)
            => Proxy(region, "/api/tripsheets/today", ct);

        // GET: api/schooldelivery/{region}/bulkorders
        [HttpGet("{region}/bulkorders")]
        public Task<IActionResult> GetBulkOrders(string region, [FromQuery] string? status,
            [FromQuery] string? quarter, [FromQuery] string? district, CancellationToken ct = default)
        {
            var query = BuildQuery(("status", status), ("quarter", quarter), ("district", district));
            return Proxy(region, $"/api/bulkorders{query}", ct);
        }

        // GET: api/schooldelivery/{region}/inventory
        [HttpGet("{region}/inventory")]
        public Task<IActionResult> GetInventory(string region, [FromQuery] string? category,
            [FromQuery] bool? lowStock, CancellationToken ct = default)
        {
            var query = BuildQuery(("category", category), ("lowStock", lowStock?.ToString().ToLower()));
            return Proxy(region, $"/api/inventory{query}", ct);
        }

        // ------------------------------------------------------------------
        // Internal proxy helpers
        // ------------------------------------------------------------------
        private async Task<IActionResult> Proxy(string region, string relativeUrl, CancellationToken ct)
        {
            if (DisabledIfNeeded() is IActionResult disabled) return disabled;

            var result = await _sdm.GetAsync(region, relativeUrl, ct);

            // Always return 200 so the frontend never sees an HTTP error in the
            // console. Callers inspect the `success` flag and `data` payload.
            return Ok(new
            {
                region = result.RegionCode,
                regionName = result.RegionName,
                success = result.Success,
                error = result.Success ? null : result.Error,
                data = result.Success ? (JsonElement?)result.Data : null
            });
        }

        private async Task<IActionResult> ProxyAll(string relativeUrl, CancellationToken ct)
        {
            if (DisabledIfNeeded() is IActionResult disabled) return disabled;

            var results = await _sdm.GetAllRegionsAsync(relativeUrl, ct);
            return Ok(results.Select(r => new
            {
                region = r.RegionCode,
                regionName = r.RegionName,
                success = r.Success,
                error = r.Error,
                data = r.Success ? (JsonElement?)r.Data : null
            }));
        }

        private static string BuildQuery(params (string Key, string? Value)[] pairs)
        {
            var parts = pairs
                .Where(p => !string.IsNullOrWhiteSpace(p.Value))
                .Select(p => $"{Uri.EscapeDataString(p.Key)}={Uri.EscapeDataString(p.Value!)}");
            var q = string.Join("&", parts);
            return string.IsNullOrEmpty(q) ? "" : $"?{q}";
        }
    }

    public class SdmLoginRequest
    {
        public string Email { get; set; } = "";
        public string Password { get; set; } = "";
    }
}
