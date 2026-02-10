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
    public class FleetController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ICarTrackService _carTrackService;
        private readonly ILogger<FleetController> _logger;

        public FleetController(
            ApplicationDbContext context, 
            ICarTrackService carTrackService,
            ILogger<FleetController> logger)
        {
            _context = context;
            _carTrackService = carTrackService;
            _logger = logger;
        }

        // Vehicle Endpoints
        [HttpGet("vehicles")]
        public async Task<ActionResult<IEnumerable<VehicleDto>>> GetVehicles()
        {
            var vehicles = await _context.Vehicles
                .Include(v => v.VehicleType)
                .Include(v => v.CurrentDriver)
                .Select(v => new VehicleDto
                {
                    Id = v.Id,
                    RegistrationNumber = v.RegistrationNumber,
                    VinNumber = v.VinNumber,
                    Make = v.Make,
                    Model = v.Model,
                    Year = v.Year,
                    Color = v.Color,
                    VehicleTypeId = v.VehicleTypeId,
                    VehicleTypeName = v.VehicleType.Name,
                    CurrentDriverId = v.CurrentDriverId,
                    CurrentDriverName = v.CurrentDriver != null ? $"{v.CurrentDriver.FirstName} {v.CurrentDriver.LastName}" : null,
                    Province = v.Province,
                    CarTrackId = v.CarTrackId,
                    CarTrackName = v.CarTrackName,
                    // TFN Integration fields
                    TfnVehicleId = v.TfnVehicleId,
                    TfnSubAccountNumber = v.TfnSubAccountNumber,
                    TfnVirtualCardNumber = v.TfnVirtualCardNumber,
                    TfnCreditLimit = v.TfnCreditLimit,
                    TfnCurrentBalance = v.TfnCurrentBalance,
                    TfnLastSyncedAt = v.TfnLastSyncedAt,
                    TankSize = v.TankSize ?? v.FuelCapacity,
                    FuelType = v.FuelType,
                    AverageFuelConsumption = v.AverageFuelConsumption,
                    // Last known location from database
                    Latitude = (double?)v.LastKnownLatitude,
                    Longitude = (double?)v.LastKnownLongitude,
                    LastLocation = v.LastKnownAddress ?? (v.CarTrackId != null || v.TfnVehicleId != null ? "Location pending..." : "Not tracked"),
                    LastUpdate = v.LastLocationUpdate,
                    LiveStatus = v.LastKnownStatus ?? "offline",
                    Status = v.Status,
                    FuelCapacity = v.FuelCapacity,
                    CurrentOdometer = v.CurrentOdometer,
                    LastServiceDate = v.LastServiceDate,
                    NextServiceOdometer = v.NextServiceOdometer,
                    CreatedAt = v.CreatedAt
                })
                // Sort: linked to both first, then linked to either, then unlinked
                .OrderByDescending(v => v.TfnVehicleId != null && v.CarTrackId != null)
                .ThenByDescending(v => v.TfnVehicleId != null || v.CarTrackId != null)
                .ThenBy(v => v.RegistrationNumber)
                .ToListAsync();

            return Ok(vehicles);
        }

        // Get vehicles with live CarTrack tracking data merged with TFN data
        [HttpGet("vehicles/live")]
        public async Task<ActionResult<IEnumerable<VehicleDto>>> GetVehiclesLive()
        {
            try
            {
                // Get all vehicles from database
                var vehicles = await _context.Vehicles
                    .Include(v => v.VehicleType)
                    .Include(v => v.CurrentDriver)
                    .ToListAsync();

                // Get live locations from CarTrack
                var liveLocations = await _carTrackService.GetAllVehicleLocationsAsync();
                var locationLookup = liveLocations.ToDictionary(
                    l => l.RegistrationNumber?.ToUpperInvariant().Replace(" ", "").Replace("-", "") ?? "",
                    l => l,
                    StringComparer.OrdinalIgnoreCase
                );

                // Also create lookup by CarTrackId
                var locationByIdLookup = liveLocations.ToDictionary(
                    l => l.VehicleId ?? "",
                    l => l,
                    StringComparer.OrdinalIgnoreCase
                );

                var vehiclesToUpdate = new List<Vehicle>();
                
                var result = vehicles.Select(v => {
                    // Try to find live data by CarTrackId first, then by registration
                    VehicleLocationDto? liveData = null;
                    if (!string.IsNullOrEmpty(v.CarTrackId) && locationByIdLookup.TryGetValue(v.CarTrackId, out var byId))
                    {
                        liveData = byId;
                    }
                    else
                    {
                        var regNormalized = v.RegistrationNumber?.ToUpperInvariant().Replace(" ", "").Replace("-", "") ?? "";
                        if (locationLookup.TryGetValue(regNormalized, out var byReg))
                        {
                            liveData = byReg;
                        }
                    }

                    // Determine location - use live data if available, otherwise use saved last known location
                    double? latitude = liveData?.Location?.Latitude ?? (double?)v.LastKnownLatitude;
                    double? longitude = liveData?.Location?.Longitude ?? (double?)v.LastKnownLongitude;
                    string lastLocation = liveData?.Location?.Address 
                        ?? v.LastKnownAddress 
                        ?? (v.CarTrackId != null || v.TfnVehicleId != null ? "Location pending..." : "Not tracked");
                    string liveStatus = liveData?.Status ?? v.LastKnownStatus ?? "offline";
                    DateTime? lastUpdate = liveData?.LastUpdate ?? v.LastLocationUpdate;

                    // Update saved location if we have live data with valid coordinates
                    if (liveData?.Location?.Latitude != null && liveData?.Location?.Longitude != null)
                    {
                        bool needsUpdate = v.LastKnownLatitude != (decimal?)liveData.Location.Latitude ||
                                          v.LastKnownLongitude != (decimal?)liveData.Location.Longitude ||
                                          v.LastKnownAddress != liveData.Location.Address ||
                                          v.LastKnownStatus != liveData.Status;
                        
                        if (needsUpdate)
                        {
                            v.LastKnownLatitude = (decimal?)liveData.Location.Latitude;
                            v.LastKnownLongitude = (decimal?)liveData.Location.Longitude;
                            v.LastKnownAddress = liveData.Location.Address;
                            v.LastKnownStatus = liveData.Status;
                            v.LastLocationUpdate = liveData.LastUpdate ?? DateTime.UtcNow;
                            vehiclesToUpdate.Add(v);
                        }
                    }

                    return new VehicleDto
                    {
                        Id = v.Id,
                        RegistrationNumber = v.RegistrationNumber,
                        VinNumber = v.VinNumber,
                        Make = v.Make,
                        Model = v.Model,
                        Year = v.Year,
                        Color = v.Color,
                        VehicleTypeId = v.VehicleTypeId,
                        VehicleTypeName = v.VehicleType?.Name,
                        CurrentDriverId = v.CurrentDriverId,
                        CurrentDriverName = liveData?.CurrentDriverName ?? (v.CurrentDriver != null ? $"{v.CurrentDriver.FirstName} {v.CurrentDriver.LastName}" : null),
                        Province = v.Province,
                        CarTrackId = v.CarTrackId,
                        CarTrackName = v.CarTrackName,
                        // TFN Integration fields
                        TfnVehicleId = v.TfnVehicleId,
                        TfnSubAccountNumber = v.TfnSubAccountNumber,
                        TfnVirtualCardNumber = v.TfnVirtualCardNumber,
                        TfnCreditLimit = v.TfnCreditLimit,
                        TfnCurrentBalance = v.TfnCurrentBalance,
                        TfnLastSyncedAt = v.TfnLastSyncedAt,
                        TankSize = v.TankSize ?? v.FuelCapacity,
                        FuelType = v.FuelType,
                        AverageFuelConsumption = v.AverageFuelConsumption,
                        // Live tracking data - use live if available, fallback to saved
                        Latitude = latitude,
                        Longitude = longitude,
                        LastLocation = lastLocation,
                        Speed = liveData?.Speed ?? 0,
                        Heading = liveData?.Heading,
                        LastUpdate = lastUpdate,
                        LiveStatus = liveStatus,
                        Status = v.Status,
                        FuelCapacity = v.FuelCapacity,
                        CurrentOdometer = v.CurrentOdometer,
                        LastServiceDate = v.LastServiceDate,
                        NextServiceOdometer = v.NextServiceOdometer,
                        CreatedAt = v.CreatedAt
                    };
                })
                // Sort: linked to both first, then linked to either, then unlinked
                .OrderByDescending(v => v.TfnVehicleId != null && v.CarTrackId != null)
                .ThenByDescending(v => v.TfnVehicleId != null || v.CarTrackId != null)
                .ThenBy(v => v.RegistrationNumber)
                .ToList();

                // Save updated locations to database (async, don't wait)
                if (vehiclesToUpdate.Any())
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            await _context.SaveChangesAsync();
                            _logger.LogInformation($"Saved {vehiclesToUpdate.Count} vehicle locations to database");
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error saving vehicle locations");
                        }
                    });
                }

                _logger.LogInformation($"Returning {result.Count} vehicles with live data. {result.Count(v => v.Speed > 0)} moving.");
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching live vehicle data");
                // Fall back to database-only data
                return await GetVehicles();
            }
        }

        // Sync CarTrack vehicles - link by registration number
        [HttpPost("sync/cartrack")]
        public async Task<ActionResult> SyncCarTrackVehicles()
        {
            try
            {
                _logger.LogInformation("Starting CarTrack vehicle sync");
                
                // Get all vehicles from CarTrack
                var carTrackVehicles = await _carTrackService.GetRawVehicleDataAsync();
                
                if (carTrackVehicles.Count == 0)
                {
                    return Ok(new { message = "No vehicles found in CarTrack", linked = 0 });
                }
                
                // Get all local vehicles
                var localVehicles = await _context.Vehicles.ToListAsync();
                
                int linked = 0;
                int updated = 0;
                
                foreach (var ctVehicle in carTrackVehicles)
                {
                    if (string.IsNullOrEmpty(ctVehicle.Registration))
                        continue;
                    
                    // Normalize registration for matching
                    var regNormalized = ctVehicle.Registration.ToUpperInvariant().Replace(" ", "").Replace("-", "");
                    
                    // Find matching local vehicle by registration
                    var localVehicle = localVehicles.FirstOrDefault(v => 
                        v.RegistrationNumber?.ToUpperInvariant().Replace(" ", "").Replace("-", "") == regNormalized);
                    
                    if (localVehicle != null)
                    {
                        if (string.IsNullOrEmpty(localVehicle.CarTrackId))
                        {
                            localVehicle.CarTrackId = ctVehicle.VehicleId;
                            localVehicle.CarTrackName = ctVehicle.Registration;
                            linked++;
                            _logger.LogInformation($"Linked vehicle {localVehicle.RegistrationNumber} to CarTrack ID {ctVehicle.VehicleId}");
                        }
                        else if (localVehicle.CarTrackId != ctVehicle.VehicleId)
                        {
                            // Update if different
                            localVehicle.CarTrackId = ctVehicle.VehicleId;
                            localVehicle.CarTrackName = ctVehicle.Registration;
                            updated++;
                        }
                    }
                }
                
                if (linked > 0 || updated > 0)
                {
                    await _context.SaveChangesAsync();
                }
                
                _logger.LogInformation($"CarTrack sync completed: {linked} newly linked, {updated} updated out of {carTrackVehicles.Count} CarTrack vehicles");
                
                return Ok(new { 
                    message = $"CarTrack sync completed",
                    carTrackVehicles = carTrackVehicles.Count,
                    linked,
                    updated,
                    totalLocalVehicles = localVehicles.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing CarTrack vehicles");
                return StatusCode(500, new { error = "Failed to sync CarTrack vehicles", message = ex.Message });
            }
        }

        // Vision API - Get livestream URLs for a vehicle
        [HttpPost("vision/livestream/{registration}")]
        public async Task<ActionResult<LivestreamResponseDto>> GetVehicleLivestream(string registration, [FromBody] LivestreamRequestDto request)
        {
            try
            {
                _logger.LogInformation("Requesting livestream for vehicle {Registration}", registration);

                var cameras = request.Cameras ?? new int[] { 1, 2 }; // Default to front and rear cameras
                var result = await _carTrackService.GetVehicleLivestreamAsync(registration, cameras);

                if (result == null)
                {
                    return NotFound(new { error = "Unable to get livestream", message = "Vehicle may not have Vision enabled or service unavailable" });
                }

                // Check if there was an error from CarTrack
                if (!string.IsNullOrEmpty(result.ErrorCode))
                {
                    if (result.ErrorCode == "VISION_NOT_ENABLED")
                    {
                        return StatusCode(403, new { 
                            error = "Vision API not enabled", 
                            message = result.Error ?? "Your CarTrack account does not have Vision API enabled. Please contact your CarTrack sales representative to enable this feature.",
                            code = result.ErrorCode
                        });
                    }
                    return BadRequest(new { error = result.ErrorCode, message = result.Error });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting livestream for vehicle {Registration}", registration);
                return StatusCode(500, new { error = "Failed to get livestream", message = ex.Message });
            }
        }

        // Vision API - Get all Vision-enabled vehicles
        [HttpGet("vision/vehicles")]
        public async Task<ActionResult<List<VisionVehicleDto>>> GetVisionEnabledVehicles()
        {
            try
            {
                var vehicles = await _carTrackService.GetVisionEnabledVehiclesAsync();
                return Ok(vehicles);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Vision-enabled vehicles");
                return StatusCode(500, new { error = "Failed to get Vision vehicles", message = ex.Message });
            }
        }

        [HttpGet("vehicles/{id}")]
        public async Task<ActionResult<VehicleDto>> GetVehicle(int id)
        {
            var vehicle = await _context.Vehicles
                .Include(v => v.VehicleType)
                .Include(v => v.CurrentDriver)
                .Where(v => v.Id == id)
                .Select(v => new VehicleDto
                {
                    Id = v.Id,
                    RegistrationNumber = v.RegistrationNumber,
                    VinNumber = v.VinNumber,
                    Make = v.Make,
                    Model = v.Model,
                    Year = v.Year,
                    Color = v.Color,
                    VehicleTypeId = v.VehicleTypeId,
                    VehicleTypeName = v.VehicleType.Name,
                    CurrentDriverId = v.CurrentDriverId,
                    CurrentDriverName = v.CurrentDriver != null ? $"{v.CurrentDriver.FirstName} {v.CurrentDriver.LastName}" : null,
                    CarTrackId = v.CarTrackId,
                    CarTrackName = v.CarTrackName,
                    Status = v.Status,
                    FuelCapacity = v.FuelCapacity,
                    CurrentOdometer = v.CurrentOdometer,
                    LastServiceDate = v.LastServiceDate,
                    NextServiceOdometer = v.NextServiceOdometer,
                    CreatedAt = v.CreatedAt
                })
                .FirstOrDefaultAsync();

            if (vehicle == null)
                return NotFound();

            return Ok(vehicle);
        }

        [HttpPost("vehicles")]
        public async Task<ActionResult<VehicleDto>> CreateVehicle(CreateVehicleDto dto)
        {
            var vehicle = new Vehicle
            {
                RegistrationNumber = dto.RegistrationNumber,
                VinNumber = dto.VinNumber,
                Make = dto.Make,
                Model = dto.Model,
                Year = dto.Year,
                Color = dto.Color,
                VehicleTypeId = dto.VehicleTypeId,
                CurrentDriverId = dto.CurrentDriverId,
                CarTrackId = dto.CarTrackId,
                CarTrackName = dto.CarTrackName,
                FuelCapacity = dto.FuelCapacity,
                CurrentOdometer = dto.CurrentOdometer,
                Status = "Available"
            };

            _context.Vehicles.Add(vehicle);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetVehicle), new { id = vehicle.Id }, vehicle);
        }

        [HttpPut("vehicles/{id}")]
        public async Task<IActionResult> UpdateVehicle(int id, UpdateVehicleDto dto)
        {
            var vehicle = await _context.Vehicles.FindAsync(id);
            if (vehicle == null)
                return NotFound();

            if (dto.RegistrationNumber != null) vehicle.RegistrationNumber = dto.RegistrationNumber;
            if (dto.VinNumber != null) vehicle.VinNumber = dto.VinNumber;
            if (dto.Make != null) vehicle.Make = dto.Make;
            if (dto.Model != null) vehicle.Model = dto.Model;
            if (dto.Year.HasValue) vehicle.Year = dto.Year;
            if (dto.Color != null) vehicle.Color = dto.Color;
            if (dto.VehicleTypeId.HasValue) vehicle.VehicleTypeId = dto.VehicleTypeId.Value;
            if (dto.CurrentDriverId.HasValue) vehicle.CurrentDriverId = dto.CurrentDriverId;
            if (dto.CarTrackId != null) vehicle.CarTrackId = dto.CarTrackId;
            if (dto.CarTrackName != null) vehicle.CarTrackName = dto.CarTrackName;
            if (dto.Status != null) vehicle.Status = dto.Status;
            if (dto.FuelCapacity.HasValue) vehicle.FuelCapacity = dto.FuelCapacity;
            if (dto.CurrentOdometer.HasValue) vehicle.CurrentOdometer = dto.CurrentOdometer;
            if (dto.LastServiceDate.HasValue) vehicle.LastServiceDate = dto.LastServiceDate;
            if (dto.NextServiceOdometer.HasValue) vehicle.NextServiceOdometer = dto.NextServiceOdometer;

            vehicle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("vehicles/{id}/province")]
        public async Task<IActionResult> UpdateVehicleProvince(int id, [FromBody] UpdateProvinceDto dto)
        {
            var vehicle = await _context.Vehicles.FindAsync(id);
            if (vehicle == null)
                return NotFound();

            vehicle.Province = dto.Province;
            vehicle.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { success = true, province = vehicle.Province });
        }

        [HttpDelete("vehicles/{id}")]
        public async Task<IActionResult> DeleteVehicle(int id)
        {
            var vehicle = await _context.Vehicles.FindAsync(id);
            if (vehicle == null)
                return NotFound();

            _context.Vehicles.Remove(vehicle);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Driver Endpoints
        [HttpGet("drivers")]
        public async Task<ActionResult<IEnumerable<DriverDto>>> GetDrivers()
        {
            var drivers = await _context.Drivers
                .Select(d => new DriverDto
                {
                    Id = d.Id,
                    FirstName = d.FirstName,
                    LastName = d.LastName,
                    LicenseNumber = d.LicenseNumber,
                    LicenseType = d.LicenseType,
                    LicenseExpiryDate = d.LicenseExpiryDate,
                    EmployeeNumber = d.EmployeeNumber,
                    PhoneNumber = d.PhoneNumber,
                    Email = d.Email,
                    Status = d.Status,
                    DateOfBirth = d.DateOfBirth,
                    HireDate = d.HireDate
                })
                .ToListAsync();

            return Ok(drivers);
        }

        [HttpGet("drivers/{id}")]
        public async Task<ActionResult<DriverDto>> GetDriver(int id)
        {
            var driver = await _context.Drivers
                .Where(d => d.Id == id)
                .Select(d => new DriverDto
                {
                    Id = d.Id,
                    FirstName = d.FirstName,
                    LastName = d.LastName,
                    LicenseNumber = d.LicenseNumber,
                    LicenseType = d.LicenseType,
                    LicenseExpiryDate = d.LicenseExpiryDate,
                    EmployeeNumber = d.EmployeeNumber,
                    PhoneNumber = d.PhoneNumber,
                    Email = d.Email,
                    Status = d.Status,
                    DateOfBirth = d.DateOfBirth,
                    HireDate = d.HireDate
                })
                .FirstOrDefaultAsync();

            if (driver == null)
                return NotFound();

            return Ok(driver);
        }

        [HttpPost("drivers")]
        public async Task<ActionResult<DriverDto>> CreateDriver(CreateDriverDto dto)
        {
            var driver = new Driver
            {
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                LicenseNumber = dto.LicenseNumber,
                LicenseType = dto.LicenseType,
                LicenseExpiryDate = dto.LicenseExpiryDate,
                EmployeeNumber = dto.EmployeeNumber,
                PhoneNumber = dto.PhoneNumber,
                Email = dto.Email,
                DateOfBirth = dto.DateOfBirth,
                HireDate = dto.HireDate,
                Status = "Active"
            };

            _context.Drivers.Add(driver);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDriver), new { id = driver.Id }, driver);
        }

        [HttpPut("drivers/{id}")]
        public async Task<IActionResult> UpdateDriver(int id, UpdateDriverDto dto)
        {
            var driver = await _context.Drivers.FindAsync(id);
            if (driver == null)
                return NotFound();

            if (dto.FirstName != null) driver.FirstName = dto.FirstName;
            if (dto.LastName != null) driver.LastName = dto.LastName;
            if (dto.LicenseNumber != null) driver.LicenseNumber = dto.LicenseNumber;
            if (dto.LicenseType != null) driver.LicenseType = dto.LicenseType;
            if (dto.LicenseExpiryDate.HasValue) driver.LicenseExpiryDate = dto.LicenseExpiryDate;
            if (dto.EmployeeNumber != null) driver.EmployeeNumber = dto.EmployeeNumber;
            if (dto.PhoneNumber != null) driver.PhoneNumber = dto.PhoneNumber;
            if (dto.Email != null) driver.Email = dto.Email;
            if (dto.Status != null) driver.Status = dto.Status;
            if (dto.DateOfBirth.HasValue) driver.DateOfBirth = dto.DateOfBirth;
            if (dto.HireDate.HasValue) driver.HireDate = dto.HireDate;

            driver.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("drivers/{id}")]
        public async Task<IActionResult> DeleteDriver(int id)
        {
            var driver = await _context.Drivers.FindAsync(id);
            if (driver == null)
                return NotFound();

            _context.Drivers.Remove(driver);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Vehicle Type Endpoints
        [HttpGet("vehicle-types")]
        public async Task<ActionResult<IEnumerable<VehicleTypeDto>>> GetVehicleTypes()
        {
            var types = await _context.VehicleTypes
                .Select(vt => new VehicleTypeDto
                {
                    Id = vt.Id,
                    Name = vt.Name,
                    Description = vt.Description,
                    MaxLoadWeight = vt.MaxLoadWeight,
                    MaxLoadVolume = vt.MaxLoadVolume,
                    FuelType = vt.FuelType
                })
                .ToListAsync();

            return Ok(types);
        }

        [HttpPost("vehicle-types")]
        public async Task<ActionResult<VehicleTypeDto>> CreateVehicleType(CreateVehicleTypeDto dto)
        {
            var vehicleType = new VehicleType
            {
                Name = dto.Name,
                Description = dto.Description,
                MaxLoadWeight = dto.MaxLoadWeight,
                MaxLoadVolume = dto.MaxLoadVolume,
                FuelType = dto.FuelType
            };

            _context.VehicleTypes.Add(vehicleType);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetVehicleTypes), new { id = vehicleType.Id }, vehicleType);
        }

        // CarTrack Sync Endpoints
        /// <summary>
        /// Sync vehicles from CarTrack - creates new records or updates existing ones
        /// </summary>
        [HttpPost("sync-from-cartrack")]
        public async Task<ActionResult<SyncResultDto>> SyncFromCarTrack()
        {
            try
            {
                _logger.LogInformation("Starting CarTrack sync...");
                
                var carTrackVehicles = await _carTrackService.GetRawVehicleDataAsync();
                
                if (carTrackVehicles.Count == 0)
                {
                    return Ok(new SyncResultDto 
                    { 
                        Success = false, 
                        Message = "No vehicles returned from CarTrack. Check API connection.",
                        VehiclesCreated = 0,
                        VehiclesUpdated = 0,
                        DriversCreated = 0,
                        DriversUpdated = 0
                    });
                }

                _logger.LogInformation($"Retrieved {carTrackVehicles.Count} vehicles from CarTrack");

                // Get default vehicle type or create one
                var defaultVehicleType = await _context.VehicleTypes.FirstOrDefaultAsync(vt => vt.Name == "Truck");
                if (defaultVehicleType == null)
                {
                    defaultVehicleType = new VehicleType 
                    { 
                        Name = "Truck", 
                        Description = "Default truck type from CarTrack sync",
                        FuelType = "Diesel"
                    };
                    _context.VehicleTypes.Add(defaultVehicleType);
                    await _context.SaveChangesAsync();
                }

                int vehiclesCreated = 0;
                int vehiclesUpdated = 0;
                int driversCreated = 0;
                int driversUpdated = 0;
                var syncedVehicles = new List<string>();
                var syncedDrivers = new List<string>();

                foreach (var ctVehicle in carTrackVehicles)
                {
                    if (string.IsNullOrEmpty(ctVehicle.VehicleId))
                        continue;

                    // Check if vehicle exists by CarTrackId
                    var existingVehicle = await _context.Vehicles
                        .FirstOrDefaultAsync(v => v.CarTrackId == ctVehicle.VehicleId);

                    // Also check by registration if no CarTrackId match
                    if (existingVehicle == null && !string.IsNullOrEmpty(ctVehicle.Registration))
                    {
                        existingVehicle = await _context.Vehicles
                            .FirstOrDefaultAsync(v => v.RegistrationNumber == ctVehicle.Registration);
                    }

                    // Handle driver sync if driver info is available
                    Driver? driver = null;
                    if (!string.IsNullOrEmpty(ctVehicle.DriverFirstName) || !string.IsNullOrEmpty(ctVehicle.DriverLastName))
                    {
                        var firstName = ctVehicle.DriverFirstName ?? "Unknown";
                        var lastName = ctVehicle.DriverLastName ?? "Driver";

                        // Try to find existing driver by name
                        driver = await _context.Drivers
                            .FirstOrDefaultAsync(d => d.FirstName == firstName && d.LastName == lastName);

                        if (driver == null)
                        {
                            // Create new driver
                            driver = new Driver
                            {
                                FirstName = firstName,
                                LastName = lastName,
                                LicenseNumber = $"CT-{ctVehicle.VehicleId}", // Placeholder license
                                LicenseType = "Code 14", // Default for trucks
                                Status = "Active",
                                HireDate = DateTime.UtcNow
                            };
                            _context.Drivers.Add(driver);
                            await _context.SaveChangesAsync();
                            driversCreated++;
                            syncedDrivers.Add($"{firstName} {lastName} (NEW)");
                        }
                        else
                        {
                            driversUpdated++;
                            syncedDrivers.Add($"{firstName} {lastName} (EXISTS)");
                        }
                    }

                    if (existingVehicle != null)
                    {
                        // Update existing vehicle
                        existingVehicle.CarTrackId = ctVehicle.VehicleId;
                        existingVehicle.CarTrackName = ctVehicle.Registration ?? existingVehicle.CarTrackName;
                        if (!string.IsNullOrEmpty(ctVehicle.ChassisNumber))
                            existingVehicle.VinNumber = ctVehicle.ChassisNumber;
                        if (driver != null)
                            existingVehicle.CurrentDriverId = driver.Id;
                        existingVehicle.UpdatedAt = DateTime.UtcNow;
                        
                        vehiclesUpdated++;
                        syncedVehicles.Add($"{existingVehicle.RegistrationNumber} (UPDATED)");
                    }
                    else
                    {
                        // Create new vehicle
                        var registration = ctVehicle.Registration ?? $"CT-{ctVehicle.VehicleId}";
                        var newVehicle = new Vehicle
                        {
                            RegistrationNumber = registration,
                            VinNumber = ctVehicle.ChassisNumber,
                            Make = "Unknown", // CarTrack doesn't provide make
                            Model = "Unknown", // CarTrack doesn't provide model
                            VehicleTypeId = defaultVehicleType.Id,
                            CarTrackId = ctVehicle.VehicleId,
                            CarTrackName = registration,
                            Status = ctVehicle.Status == "offline" ? "Inactive" : "Available",
                            CurrentDriverId = driver?.Id
                        };
                        _context.Vehicles.Add(newVehicle);
                        
                        vehiclesCreated++;
                        syncedVehicles.Add($"{registration} (NEW)");
                    }
                }

                await _context.SaveChangesAsync();

                var result = new SyncResultDto
                {
                    Success = true,
                    Message = $"CarTrack sync completed successfully",
                    VehiclesCreated = vehiclesCreated,
                    VehiclesUpdated = vehiclesUpdated,
                    DriversCreated = driversCreated,
                    DriversUpdated = driversUpdated,
                    SyncedVehicles = syncedVehicles,
                    SyncedDrivers = syncedDrivers.Distinct().ToList(),
                    TotalCarTrackVehicles = carTrackVehicles.Count,
                    SyncTimestamp = DateTime.UtcNow
                };

                _logger.LogInformation($"CarTrack sync completed: {vehiclesCreated} created, {vehiclesUpdated} updated, {driversCreated} drivers created");

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during CarTrack sync");
                return StatusCode(500, new SyncResultDto 
                { 
                    Success = false, 
                    Message = $"Sync failed: {ex.Message}",
                    VehiclesCreated = 0,
                    VehiclesUpdated = 0,
                    DriversCreated = 0,
                    DriversUpdated = 0
                });
            }
        }

        /// <summary>
        /// Preview what would be synced from CarTrack without making changes
        /// </summary>
        [HttpGet("cartrack-preview")]
        public async Task<ActionResult<CarTrackPreviewDto>> PreviewCarTrackSync()
        {
            try
            {
                var carTrackVehicles = await _carTrackService.GetRawVehicleDataAsync();
                var existingVehicles = await _context.Vehicles.ToListAsync();
                var existingDrivers = await _context.Drivers.ToListAsync();

                var newVehicles = new List<CarTrackVehiclePreview>();
                var existingMatches = new List<CarTrackVehiclePreview>();
                var newDrivers = new List<string>();

                foreach (var ctVehicle in carTrackVehicles)
                {
                    if (string.IsNullOrEmpty(ctVehicle.VehicleId))
                        continue;

                    var preview = new CarTrackVehiclePreview
                    {
                        CarTrackId = ctVehicle.VehicleId,
                        Registration = ctVehicle.Registration ?? $"CT-{ctVehicle.VehicleId}",
                        ChassisNumber = ctVehicle.ChassisNumber,
                        DriverName = !string.IsNullOrEmpty(ctVehicle.DriverFirstName) 
                            ? $"{ctVehicle.DriverFirstName} {ctVehicle.DriverLastName}".Trim() 
                            : null,
                        Status = ctVehicle.Status
                    };

                    // Check if exists
                    var exists = existingVehicles.Any(v => 
                        v.CarTrackId == ctVehicle.VehicleId || 
                        v.RegistrationNumber == ctVehicle.Registration);

                    if (exists)
                    {
                        preview.Action = "Update";
                        existingMatches.Add(preview);
                    }
                    else
                    {
                        preview.Action = "Create";
                        newVehicles.Add(preview);
                    }

                    // Check driver
                    if (!string.IsNullOrEmpty(ctVehicle.DriverFirstName))
                    {
                        var driverExists = existingDrivers.Any(d => 
                            d.FirstName == ctVehicle.DriverFirstName && 
                            d.LastName == (ctVehicle.DriverLastName ?? "Driver"));
                        
                        if (!driverExists)
                        {
                            var driverName = $"{ctVehicle.DriverFirstName} {ctVehicle.DriverLastName}".Trim();
                            if (!newDrivers.Contains(driverName))
                                newDrivers.Add(driverName);
                        }
                    }
                }

                return Ok(new CarTrackPreviewDto
                {
                    TotalCarTrackVehicles = carTrackVehicles.Count,
                    NewVehicles = newVehicles,
                    ExistingVehicles = existingMatches,
                    NewDrivers = newDrivers,
                    ExistingVehiclesInDb = existingVehicles.Count,
                    ExistingDriversInDb = existingDrivers.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error previewing CarTrack sync");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }

    // DTOs for sync operations
    public class SyncResultDto
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public int VehiclesCreated { get; set; }
        public int VehiclesUpdated { get; set; }
        public int DriversCreated { get; set; }
        public int DriversUpdated { get; set; }
        public List<string> SyncedVehicles { get; set; } = new();
        public List<string> SyncedDrivers { get; set; } = new();
        public int TotalCarTrackVehicles { get; set; }
        public DateTime SyncTimestamp { get; set; }
    }

    public class CarTrackPreviewDto
    {
        public int TotalCarTrackVehicles { get; set; }
        public List<CarTrackVehiclePreview> NewVehicles { get; set; } = new();
        public List<CarTrackVehiclePreview> ExistingVehicles { get; set; } = new();
        public List<string> NewDrivers { get; set; } = new();
        public int ExistingVehiclesInDb { get; set; }
        public int ExistingDriversInDb { get; set; }
    }

    public class CarTrackVehiclePreview
    {
        public string CarTrackId { get; set; } = string.Empty;
        public string Registration { get; set; } = string.Empty;
        public string? ChassisNumber { get; set; }
        public string? DriverName { get; set; }
        public string? Status { get; set; }
        public string Action { get; set; } = string.Empty; // "Create" or "Update"
    }
}
