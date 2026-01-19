using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FleetController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<FleetController> _logger;

        public FleetController(ApplicationDbContext context, ILogger<FleetController> logger)
        {
            _context = context;
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
                    CarTrackId = v.CarTrackId,
                    CarTrackName = v.CarTrackName,
                    Status = v.Status,
                    FuelCapacity = v.FuelCapacity,
                    CurrentOdometer = v.CurrentOdometer,
                    LastServiceDate = v.LastServiceDate,
                    NextServiceOdometer = v.NextServiceOdometer,
                    CreatedAt = v.CreatedAt
                })
                .ToListAsync();

            return Ok(vehicles);
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
    }
}
