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
    [Route("api/logistics/drivers")]
    public class DriversController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<DriversController> _logger;

        public DriversController(ApplicationDbContext context, ILogger<DriversController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
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

        [HttpGet("{id}")]
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

        [HttpPost]
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

            return CreatedAtAction(nameof(GetDriver), new { id = driver.Id }, new DriverDto
            {
                Id = driver.Id,
                FirstName = driver.FirstName,
                LastName = driver.LastName,
                LicenseNumber = driver.LicenseNumber,
                LicenseType = driver.LicenseType,
                LicenseExpiryDate = driver.LicenseExpiryDate,
                EmployeeNumber = driver.EmployeeNumber,
                PhoneNumber = driver.PhoneNumber,
                Email = driver.Email,
                Status = driver.Status,
                DateOfBirth = driver.DateOfBirth,
                HireDate = driver.HireDate
            });
        }

        [HttpPut("{id}")]
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

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDriver(int id)
        {
            var driver = await _context.Drivers.FindAsync(id);
            if (driver == null)
                return NotFound();

            _context.Drivers.Remove(driver);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Get all drivers with their delivery statistics (total trips and KM from delivered loads)
        /// </summary>
        [HttpGet("with-stats")]
        public async Task<ActionResult<IEnumerable<DriverWithStatsDto>>> GetDriversWithStats()
        {
            try
            {
                // Get all drivers
                var drivers = await _context.Drivers.ToListAsync();

                // Get statistics for all drivers from delivered loads only
                var deliveredLoadStats = await _context.Loads
                    .Where(l => l.DriverId != null && l.Status == "Delivered")
                    .GroupBy(l => l.DriverId)
                    .Select(g => new
                    {
                        DriverId = g.Key,
                        TotalTrips = g.Count(),
                        TotalKm = g.Sum(l => (l.EstimatedDistance ?? 0) + (l.ActualDistance ?? 0) > 0 
                            ? (l.ActualDistance ?? l.EstimatedDistance ?? 0)
                            : 0)
                    })
                    .ToListAsync();

                // Map to DTO with stats and sort by TotalKmDriven descending (most KM first)
                var result = drivers.Select(d =>
                {
                    var stats = deliveredLoadStats.FirstOrDefault(s => s.DriverId == d.Id);
                    return new DriverWithStatsDto
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
                        HireDate = d.HireDate,
                        TotalTrips = stats?.TotalTrips ?? 0,
                        TotalKmDriven = stats?.TotalKm ?? 0
                    };
                })
                .OrderByDescending(d => d.TotalKmDriven)
                .ToList();

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching drivers with stats");
                return StatusCode(500, new { message = "Error fetching drivers with stats", error = ex.Message });
            }
        }
    }
}
