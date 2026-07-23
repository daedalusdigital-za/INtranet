using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CarTrackController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ICarTrackService _carTrackService;
        private readonly ILogger<CarTrackController> _logger;

        public CarTrackController(
            ApplicationDbContext context,
            ICarTrackService carTrackService,
            ILogger<CarTrackController> logger)
        {
            _context = context;
            _carTrackService = carTrackService;
            _logger = logger;
        }

        /// <summary>
        /// Get all CarTrack vehicles that are NOT yet linked to a local fleet vehicle.
        /// Used by the "Link to CarTrack" dialog dropdown.
        /// </summary>
        [HttpGet("vehicles/unlinked")]
        public async Task<ActionResult> GetUnlinkedVehicles()
        {
            try
            {
                // Get all CarTrack vehicles from the API
                var carTrackVehicles = await _carTrackService.GetRawVehicleDataAsync();

                if (carTrackVehicles.Count == 0)
                {
                    return Ok(Array.Empty<object>());
                }

                // Get all CarTrack IDs already linked in our database
                var linkedCarTrackIds = await _context.Vehicles
                    .Where(v => v.CarTrackId != null && v.CarTrackId != "")
                    .Select(v => v.CarTrackId)
                    .ToListAsync();

                var linkedIdSet = new HashSet<string>(linkedCarTrackIds!, StringComparer.OrdinalIgnoreCase);

                // Filter to only unlinked vehicles and map to the shape the frontend expects
                var unlinkedVehicles = carTrackVehicles
                    .Where(ct => !string.IsNullOrEmpty(ct.VehicleId) && !linkedIdSet.Contains(ct.VehicleId))
                    .Select(ct => new
                    {
                        id = ct.VehicleId,
                        name = ct.Registration ?? $"CT-{ct.VehicleId}",
                        registrationNumber = ct.Registration,
                        description = !string.IsNullOrEmpty(ct.DriverFirstName)
                            ? $"Driver: {ct.DriverFirstName} {ct.DriverLastName}".Trim()
                            : ct.Status ?? "No driver assigned"
                    })
                    .OrderBy(v => v.name)
                    .ToList();

                return Ok(unlinkedVehicles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching unlinked CarTrack vehicles");
                return StatusCode(500, new { error = "Failed to fetch CarTrack vehicles", message = ex.Message });
            }
        }
    }
}
