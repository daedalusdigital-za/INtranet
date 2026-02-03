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
    [Route("api/logistics/maintenance")]
    public class MaintenanceController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<MaintenanceController> _logger;

        public MaintenanceController(ApplicationDbContext context, ILogger<MaintenanceController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<VehicleMaintenanceDto>>> GetMaintenanceRecords(
            [FromQuery] int? vehicleId,
            [FromQuery] string? status)
        {
            var query = _context.VehicleMaintenance
                .Include(m => m.Vehicle)
                    .ThenInclude(v => v.VehicleType)
                .AsQueryable();

            if (vehicleId.HasValue)
            {
                query = query.Where(m => m.VehicleId == vehicleId.Value);
            }

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(m => m.Status == status);
            }

            var records = await query
                .Select(m => new VehicleMaintenanceDto
                {
                    Id = m.Id,
                    VehicleId = m.VehicleId,
                    VehicleRegistration = m.Vehicle.RegistrationNumber,
                    VehicleType = m.Vehicle.VehicleType != null ? m.Vehicle.VehicleType.Name : "Unknown",
                    MaintenanceType = m.MaintenanceType,
                    Description = m.Description,
                    ScheduledDate = m.ScheduledDate,
                    CompletedDate = m.CompletedDate,
                    OdometerReading = m.OdometerReading,
                    Cost = m.Cost,
                    ServiceProvider = m.ServiceProvider,
                    InvoiceReference = m.InvoiceReference,
                    Status = m.Status,
                    Notes = m.Notes,
                    ProofOfWorkPath = m.ProofOfWorkPath,
                    ProofOfPaymentPath = m.ProofOfPaymentPath,
                    NextServiceDate = m.NextServiceDate,
                    NextServiceOdometer = m.NextServiceOdometer
                })
                .OrderByDescending(m => m.ScheduledDate)
                .ToListAsync();

            return Ok(records);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<VehicleMaintenanceDto>> GetMaintenanceRecord(int id)
        {
            var record = await _context.VehicleMaintenance
                .Include(m => m.Vehicle)
                    .ThenInclude(v => v.VehicleType)
                .Where(m => m.Id == id)
                .Select(m => new VehicleMaintenanceDto
                {
                    Id = m.Id,
                    VehicleId = m.VehicleId,
                    VehicleRegistration = m.Vehicle.RegistrationNumber,
                    VehicleType = m.Vehicle.VehicleType != null ? m.Vehicle.VehicleType.Name : "Unknown",
                    MaintenanceType = m.MaintenanceType,
                    Description = m.Description,
                    ScheduledDate = m.ScheduledDate,
                    CompletedDate = m.CompletedDate,
                    OdometerReading = m.OdometerReading,
                    Cost = m.Cost,
                    ServiceProvider = m.ServiceProvider,
                    InvoiceReference = m.InvoiceReference,
                    Status = m.Status,
                    Notes = m.Notes,
                    ProofOfWorkPath = m.ProofOfWorkPath,
                    ProofOfPaymentPath = m.ProofOfPaymentPath,
                    NextServiceDate = m.NextServiceDate,
                    NextServiceOdometer = m.NextServiceOdometer
                })
                .FirstOrDefaultAsync();

            if (record == null)
                return NotFound();

            return Ok(record);
        }

        [HttpPost]
        public async Task<ActionResult<VehicleMaintenanceDto>> CreateMaintenanceRecord(CreateVehicleMaintenanceDto dto)
        {
            var maintenance = new VehicleMaintenance
            {
                VehicleId = dto.VehicleId,
                MaintenanceType = dto.MaintenanceType,
                Description = dto.Description,
                ScheduledDate = dto.ScheduledDate,
                Cost = dto.Cost,
                ServiceProvider = dto.ServiceProvider,
                Notes = dto.Notes,
                NextServiceDate = dto.NextServiceDate,
                NextServiceOdometer = dto.NextServiceOdometer,
                Status = "Scheduled"
            };

            _context.VehicleMaintenance.Add(maintenance);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMaintenanceRecord), new { id = maintenance.Id }, maintenance);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateMaintenanceRecord(int id, UpdateVehicleMaintenanceDto dto)
        {
            var maintenance = await _context.VehicleMaintenance.FindAsync(id);
            if (maintenance == null)
                return NotFound();

            if (dto.Status != null) maintenance.Status = dto.Status;
            if (dto.CompletedDate.HasValue) maintenance.CompletedDate = dto.CompletedDate;
            if (dto.OdometerReading.HasValue) maintenance.OdometerReading = dto.OdometerReading;
            if (dto.Cost.HasValue) maintenance.Cost = dto.Cost;
            if (dto.InvoiceReference != null) maintenance.InvoiceReference = dto.InvoiceReference;
            if (dto.Notes != null) maintenance.Notes = dto.Notes;
            if (dto.ProofOfWorkPath != null) maintenance.ProofOfWorkPath = dto.ProofOfWorkPath;
            if (dto.ProofOfPaymentPath != null) maintenance.ProofOfPaymentPath = dto.ProofOfPaymentPath;

            maintenance.UpdatedAt = DateTime.UtcNow;

            // Update vehicle's last service date and next service if completed
            if (dto.Status == "Completed" && dto.CompletedDate.HasValue)
            {
                var vehicle = await _context.Vehicles.FindAsync(maintenance.VehicleId);
                if (vehicle != null)
                {
                    vehicle.LastServiceDate = dto.CompletedDate;
                    if (maintenance.NextServiceOdometer.HasValue)
                    {
                        vehicle.NextServiceOdometer = maintenance.NextServiceOdometer;
                    }
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("upcoming")]
        public async Task<ActionResult<IEnumerable<VehicleMaintenanceDto>>> GetUpcomingMaintenance([FromQuery] int days = 30)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(days);

            var upcoming = await _context.VehicleMaintenance
                .Include(m => m.Vehicle)
                .Where(m => m.Status == "Scheduled" && m.ScheduledDate <= cutoffDate)
                .Select(m => new VehicleMaintenanceDto
                {
                    Id = m.Id,
                    VehicleId = m.VehicleId,
                    VehicleRegistration = m.Vehicle.RegistrationNumber,
                    MaintenanceType = m.MaintenanceType,
                    Description = m.Description,
                    ScheduledDate = m.ScheduledDate,
                    Cost = m.Cost,
                    ServiceProvider = m.ServiceProvider,
                    Status = m.Status
                })
                .OrderBy(m => m.ScheduledDate)
                .ToListAsync();

            return Ok(upcoming);
        }

        [HttpPost("{id}/complete")]
        public async Task<IActionResult> MarkComplete(int id, [FromBody] CompleteMaintenanceDto dto)
        {
            var maintenance = await _context.VehicleMaintenance
                .Include(m => m.Vehicle)
                .FirstOrDefaultAsync(m => m.Id == id);

            if (maintenance == null)
                return NotFound();

            maintenance.Status = "Completed";
            maintenance.CompletedDate = DateTime.UtcNow;
            maintenance.UpdatedAt = DateTime.UtcNow;
            
            if (dto.OdometerReading.HasValue)
                maintenance.OdometerReading = dto.OdometerReading;
            
            if (dto.Cost.HasValue)
                maintenance.Cost = dto.Cost;
            
            if (!string.IsNullOrEmpty(dto.Notes))
                maintenance.Notes = dto.Notes;

            if (!string.IsNullOrEmpty(dto.ProofOfWorkPath))
                maintenance.ProofOfWorkPath = dto.ProofOfWorkPath;

            if (!string.IsNullOrEmpty(dto.ProofOfPaymentPath))
                maintenance.ProofOfPaymentPath = dto.ProofOfPaymentPath;

            // Update vehicle's last service date
            if (maintenance.Vehicle != null)
            {
                maintenance.Vehicle.LastServiceDate = maintenance.CompletedDate;
                if (maintenance.NextServiceOdometer.HasValue)
                {
                    maintenance.Vehicle.NextServiceOdometer = maintenance.NextServiceOdometer;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Maintenance marked as complete" });
        }

        [HttpPost("{id}/upload")]
        public async Task<IActionResult> UploadFiles(int id, [FromForm] IFormFile? proofOfWork, [FromForm] IFormFile? proofOfPayment)
        {
            var maintenance = await _context.VehicleMaintenance.FindAsync(id);
            if (maintenance == null)
                return NotFound();

            var uploadPath = Path.Combine(Directory.GetCurrentDirectory(), "uploads", "maintenance");
            Directory.CreateDirectory(uploadPath);

            if (proofOfWork != null)
            {
                var fileName = $"{id}_work_{DateTime.Now:yyyyMMddHHmmss}{Path.GetExtension(proofOfWork.FileName)}";
                var filePath = Path.Combine(uploadPath, fileName);
                
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await proofOfWork.CopyToAsync(stream);
                }
                
                maintenance.ProofOfWorkPath = $"/uploads/maintenance/{fileName}";
            }

            if (proofOfPayment != null)
            {
                var fileName = $"{id}_payment_{DateTime.Now:yyyyMMddHHmmss}{Path.GetExtension(proofOfPayment.FileName)}";
                var filePath = Path.Combine(uploadPath, fileName);
                
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await proofOfPayment.CopyToAsync(stream);
                }
                
                maintenance.ProofOfPaymentPath = $"/uploads/maintenance/{fileName}";
            }

            maintenance.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new 
            { 
                proofOfWorkPath = maintenance.ProofOfWorkPath,
                proofOfPaymentPath = maintenance.ProofOfPaymentPath
            });
        }
    }
}
