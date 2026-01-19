using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TrackingController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ICarTrackService _carTrackService;
        private readonly ILogger<TrackingController> _logger;

        public TrackingController(
            ApplicationDbContext context,
            ICarTrackService carTrackService,
            ILogger<TrackingController> logger)
        {
            _context = context;
            _carTrackService = carTrackService;
            _logger = logger;
        }

        [HttpGet("fleet-status")]
        public async Task<ActionResult<FleetStatusDto>> GetFleetStatus()
        {
            try
            {
                var status = await _carTrackService.GetFleetStatusAsync();

                // Match with local vehicles
                var vehicles = await _context.Vehicles
                    .Include(v => v.CurrentDriver)
                    .Where(v => v.CarTrackId != null)
                    .ToListAsync();

                foreach (var vehicleLocation in status.Vehicles)
                {
                    var localVehicle = vehicles.FirstOrDefault(v => v.CarTrackId == vehicleLocation.VehicleId);
                    if (localVehicle != null)
                    {
                        vehicleLocation.LocalVehicleId = localVehicle.Id;
                        vehicleLocation.RegistrationNumber = localVehicle.RegistrationNumber;
                    }
                }

                return Ok(status);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting fleet status");
                return StatusCode(500, "Error retrieving fleet status");
            }
        }

        [HttpGet("vehicle/{vehicleId}/location")]
        public async Task<ActionResult<VehicleLocationDto>> GetVehicleLocation(int vehicleId)
        {
            try
            {
                var vehicle = await _context.Vehicles.FindAsync(vehicleId);
                if (vehicle == null)
                    return NotFound("Vehicle not found");

                if (string.IsNullOrEmpty(vehicle.CarTrackId))
                    return BadRequest("Vehicle does not have CarTrack integration configured");

                var location = await _carTrackService.GetVehicleLocationAsync(vehicle.CarTrackId);
                if (location == null)
                    return NotFound("Vehicle location not available from CarTrack");

                location.LocalVehicleId = vehicle.Id;
                location.RegistrationNumber = vehicle.RegistrationNumber;

                return Ok(location);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting location for vehicle {vehicleId}");
                return StatusCode(500, "Error retrieving vehicle location");
            }
        }

        [HttpGet("load/{loadId}/track")]
        public async Task<ActionResult<TripTrackingDto>> TrackLoad(int loadId)
        {
            try
            {
                var load = await _context.Loads
                    .Include(l => l.Vehicle)
                    .Include(l => l.Driver)
                    .Include(l => l.Stops.OrderBy(s => s.StopSequence))
                    .FirstOrDefaultAsync(l => l.Id == loadId);

                if (load == null)
                    return NotFound("Load not found");

                if (load.VehicleId == null)
                    return BadRequest("Load does not have a vehicle assigned");

                if (string.IsNullOrEmpty(load.Vehicle?.CarTrackId))
                    return BadRequest("Assigned vehicle does not have CarTrack integration");

                // Get current location from CarTrack
                var location = await _carTrackService.GetVehicleLocationAsync(load.Vehicle.CarTrackId);
                if (location == null)
                    return NotFound("Vehicle location not available");

                // Find next stop
                var nextStop = load.Stops
                    .Where(s => s.Status == "Pending")
                    .OrderBy(s => s.StopSequence)
                    .FirstOrDefault();

                var tracking = new TripTrackingDto
                {
                    LoadId = load.Id,
                    LoadNumber = load.LoadNumber,
                    VehicleId = load.VehicleId.Value,
                    VehicleRegistration = load.Vehicle.RegistrationNumber,
                    DriverName = load.Driver != null ? $"{load.Driver.FirstName} {load.Driver.LastName}" : null,
                    CurrentLocation = location,
                    Stops = load.Stops.Select(s => new LoadStopDto
                    {
                        Id = s.Id,
                        StopSequence = s.StopSequence,
                        StopType = s.StopType,
                        LocationName = s.LocationName,
                        Address = s.Address,
                        City = s.City,
                        PostalCode = s.PostalCode,
                        Latitude = s.Latitude,
                        Longitude = s.Longitude,
                        ContactPerson = s.ContactPerson,
                        ContactPhone = s.ContactPhone,
                        ScheduledArrival = s.ScheduledArrival,
                        ActualArrival = s.ActualArrival,
                        ActualDeparture = s.ActualDeparture,
                        Status = s.Status,
                        Notes = s.Notes
                    }).ToList(),
                    NextStop = nextStop != null ? new LoadStopDto
                    {
                        Id = nextStop.Id,
                        StopSequence = nextStop.StopSequence,
                        StopType = nextStop.StopType,
                        LocationName = nextStop.LocationName,
                        Address = nextStop.Address,
                        City = nextStop.City,
                        Latitude = nextStop.Latitude,
                        Longitude = nextStop.Longitude,
                        Status = nextStop.Status
                    } : null,
                    TripStatus = load.Status
                };

                // Calculate distance to next stop if available
                if (nextStop?.Latitude != null && nextStop.Longitude != null &&
                    location?.Location != null)
                {
                    tracking.DistanceToNextStop = CalculateDistance(
                        location.Location.Latitude,
                        location.Location.Longitude,
                        nextStop.Latitude.Value,
                        nextStop.Longitude.Value
                    );

                    // Estimate ETA based on current speed (if moving)
                    if (location.Speed > 0)
                    {
                        var hours = tracking.DistanceToNextStop / location.Speed;
                        tracking.EtaToNextStop = TimeSpan.FromHours(hours ?? 0);
                    }
                }

                return Ok(tracking);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error tracking load {loadId}");
                return StatusCode(500, "Error tracking load");
            }
        }

        [HttpGet("active-loads")]
        public async Task<ActionResult<IEnumerable<LoadDto>>> GetActiveLoads()
        {
            var activeLoads = await _context.Loads
                .Include(l => l.Customer)
                .Include(l => l.Vehicle)
                .Include(l => l.Driver)
                .Where(l => l.Status == "In Transit" || l.Status == "Assigned")
                .Select(l => new LoadDto
                {
                    Id = l.Id,
                    LoadNumber = l.LoadNumber,
                    CustomerId = l.CustomerId,
                    CustomerName = l.Customer.Name,
                    VehicleId = l.VehicleId,
                    VehicleRegistration = l.Vehicle != null ? l.Vehicle.RegistrationNumber : null,
                    DriverId = l.DriverId,
                    DriverName = l.Driver != null ? $"{l.Driver.FirstName} {l.Driver.LastName}" : null,
                    Status = l.Status,
                    ScheduledPickupDate = l.ScheduledPickupDate,
                    ScheduledDeliveryDate = l.ScheduledDeliveryDate
                })
                .ToListAsync();

            return Ok(activeLoads);
        }

        // Haversine formula to calculate distance between two GPS coordinates
        private double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371; // Earth's radius in kilometers

            var dLat = ToRadians(lat2 - lat1);
            var dLon = ToRadians(lon2 - lon1);

            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            var distance = R * c;

            return distance;
        }

        private double ToRadians(double degrees)
        {
            return degrees * Math.PI / 180;
        }
    }
}
