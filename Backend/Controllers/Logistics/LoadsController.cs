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
    public class LoadsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<LoadsController> _logger;

        public LoadsController(ApplicationDbContext context, ILogger<LoadsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoadDto>>> GetLoads([FromQuery] string? status)
        {
            var query = _context.Loads
                .Include(l => l.Customer)
                .Include(l => l.Vehicle)
                .Include(l => l.Driver)
                .Include(l => l.Stops)
                .Include(l => l.LoadItems)
                    .ThenInclude(li => li.Commodity)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(l => l.Status == status);
            }

            var loads = await query
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
                    ActualPickupDate = l.ActualPickupDate,
                    ScheduledDeliveryDate = l.ScheduledDeliveryDate,
                    ActualDeliveryDate = l.ActualDeliveryDate,
                    EstimatedCost = l.EstimatedCost,
                    ActualCost = l.ActualCost,
                    ChargeAmount = l.ChargeAmount,
                    EstimatedDistance = l.EstimatedDistance,
                    ActualDistance = l.ActualDistance,
                    SpecialInstructions = l.SpecialInstructions,
                    Notes = l.Notes,
                    CreatedAt = l.CreatedAt,
                    Stops = l.Stops.Select(s => new LoadStopDto
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
                    Items = l.LoadItems.Select(i => new LoadItemDto
                    {
                        Id = i.Id,
                        CommodityId = i.CommodityId,
                        CommodityName = i.Commodity.Name,
                        Quantity = i.Quantity,
                        UnitOfMeasure = i.UnitOfMeasure,
                        Weight = i.Weight,
                        Volume = i.Volume,
                        Description = i.Description
                    }).ToList()
                })
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync();

            return Ok(loads);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<LoadDto>> GetLoad(int id)
        {
            var load = await _context.Loads
                .Include(l => l.Customer)
                .Include(l => l.Vehicle)
                .Include(l => l.Driver)
                .Include(l => l.Stops)
                .Include(l => l.LoadItems)
                    .ThenInclude(li => li.Commodity)
                .Where(l => l.Id == id)
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
                    ActualPickupDate = l.ActualPickupDate,
                    ScheduledDeliveryDate = l.ScheduledDeliveryDate,
                    ActualDeliveryDate = l.ActualDeliveryDate,
                    EstimatedCost = l.EstimatedCost,
                    ActualCost = l.ActualCost,
                    ChargeAmount = l.ChargeAmount,
                    EstimatedDistance = l.EstimatedDistance,
                    ActualDistance = l.ActualDistance,
                    SpecialInstructions = l.SpecialInstructions,
                    Notes = l.Notes,
                    CreatedAt = l.CreatedAt,
                    Stops = l.Stops.Select(s => new LoadStopDto
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
                    }).OrderBy(s => s.StopSequence).ToList(),
                    Items = l.LoadItems.Select(i => new LoadItemDto
                    {
                        Id = i.Id,
                        CommodityId = i.CommodityId,
                        CommodityName = i.Commodity.Name,
                        Quantity = i.Quantity,
                        UnitOfMeasure = i.UnitOfMeasure,
                        Weight = i.Weight,
                        Volume = i.Volume,
                        Description = i.Description
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            if (load == null)
                return NotFound();

            return Ok(load);
        }

        [HttpPost]
        public async Task<ActionResult<LoadDto>> CreateLoad(CreateLoadDto dto)
        {
            // Generate load number
            var lastLoad = await _context.Loads.OrderByDescending(l => l.Id).FirstOrDefaultAsync();
            var loadNumber = $"LD{DateTime.Now:yyyyMMdd}{(lastLoad?.Id ?? 0) + 1:D4}";

            var load = new Load
            {
                LoadNumber = loadNumber,
                CustomerId = dto.CustomerId,
                VehicleId = dto.VehicleId,
                DriverId = dto.DriverId,
                ScheduledPickupDate = dto.ScheduledPickupDate,
                ScheduledDeliveryDate = dto.ScheduledDeliveryDate,
                EstimatedCost = dto.EstimatedCost,
                ChargeAmount = dto.ChargeAmount,
                EstimatedDistance = dto.EstimatedDistance,
                SpecialInstructions = dto.SpecialInstructions,
                Notes = dto.Notes,
                Status = "Pending"
            };

            _context.Loads.Add(load);
            await _context.SaveChangesAsync();

            // Add stops
            foreach (var stopDto in dto.Stops)
            {
                var stop = new LoadStop
                {
                    LoadId = load.Id,
                    StopSequence = stopDto.StopSequence,
                    StopType = stopDto.StopType,
                    LocationName = stopDto.LocationName,
                    Address = stopDto.Address,
                    City = stopDto.City,
                    PostalCode = stopDto.PostalCode,
                    Latitude = stopDto.Latitude,
                    Longitude = stopDto.Longitude,
                    ContactPerson = stopDto.ContactPerson,
                    ContactPhone = stopDto.ContactPhone,
                    ScheduledArrival = stopDto.ScheduledArrival,
                    Notes = stopDto.Notes,
                    Status = "Pending"
                };
                _context.LoadStops.Add(stop);
            }

            // Add items
            foreach (var itemDto in dto.Items)
            {
                var item = new LoadItem
                {
                    LoadId = load.Id,
                    CommodityId = itemDto.CommodityId,
                    Quantity = itemDto.Quantity,
                    UnitOfMeasure = itemDto.UnitOfMeasure,
                    Weight = itemDto.Weight,
                    Volume = itemDto.Volume,
                    Description = itemDto.Description
                };
                _context.LoadItems.Add(item);
            }

            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetLoad), new { id = load.Id }, load);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateLoad(int id, UpdateLoadDto dto)
        {
            var load = await _context.Loads.FindAsync(id);
            if (load == null)
                return NotFound();

            if (dto.VehicleId.HasValue) load.VehicleId = dto.VehicleId;
            if (dto.DriverId.HasValue) load.DriverId = dto.DriverId;
            if (dto.Status != null) load.Status = dto.Status;
            if (dto.ScheduledPickupDate.HasValue) load.ScheduledPickupDate = dto.ScheduledPickupDate;
            if (dto.ActualPickupDate.HasValue) load.ActualPickupDate = dto.ActualPickupDate;
            if (dto.ScheduledDeliveryDate.HasValue) load.ScheduledDeliveryDate = dto.ScheduledDeliveryDate;
            if (dto.ActualDeliveryDate.HasValue) load.ActualDeliveryDate = dto.ActualDeliveryDate;
            if (dto.EstimatedCost.HasValue) load.EstimatedCost = dto.EstimatedCost;
            if (dto.ActualCost.HasValue) load.ActualCost = dto.ActualCost;
            if (dto.ChargeAmount.HasValue) load.ChargeAmount = dto.ChargeAmount;
            if (dto.ActualDistance.HasValue) load.ActualDistance = dto.ActualDistance;
            if (dto.Notes != null) load.Notes = dto.Notes;

            load.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLoad(int id)
        {
            var load = await _context.Loads.FindAsync(id);
            if (load == null)
                return NotFound();

            _context.Loads.Remove(load);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Proof of Delivery Endpoints
        [HttpPost("{loadId}/proof-of-delivery")]
        public async Task<ActionResult<ProofOfDeliveryDto>> CreateProofOfDelivery(int loadId, CreateProofOfDeliveryDto dto)
        {
            var load = await _context.Loads.FindAsync(loadId);
            if (load == null)
                return NotFound("Load not found");

            var pod = new ProofOfDelivery
            {
                LoadId = loadId,
                RecipientName = dto.RecipientName,
                SignatureUrl = dto.SignatureUrl,
                DeliveryLatitude = dto.DeliveryLatitude,
                DeliveryLongitude = dto.DeliveryLongitude,
                Notes = dto.Notes,
                PhotoUrls = dto.PhotoUrls,
                ConditionOnDelivery = dto.ConditionOnDelivery,
                DamageNotes = dto.DamageNotes
            };

            _context.ProofOfDeliveries.Add(pod);

            // Update load status
            load.Status = "Delivered";
            load.ActualDeliveryDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(pod);
        }
    }
}
