using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using System.Security.Claims;

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

        /// <summary>
        /// Generates a unique load number in the format RF-XXXXXX
        /// </summary>
        private async Task<string> GenerateLoadNumberAsync()
        {
            var lastLoad = await _context.Loads
                .OrderByDescending(l => l.Id)
                .FirstOrDefaultAsync();

            int nextNumber = 1;
            if (lastLoad != null && !string.IsNullOrEmpty(lastLoad.LoadNumber))
            {
                // Extract number from existing format (RF-000001 or LD-000001 legacy)
                var currentNumber = lastLoad.LoadNumber;
                if ((currentNumber.StartsWith("RF-") || currentNumber.StartsWith("LD-")) && currentNumber.Length == 9)
                {
                    if (int.TryParse(currentNumber.Substring(3), out int num))
                    {
                        nextNumber = num + 1;
                    }
                }
                else
                {
                    nextNumber = lastLoad.Id + 1;
                }
            }

            return $"RF-{nextNumber:D6}";
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<LoadDto>>> GetLoads(
            [FromQuery] string? status,
            [FromQuery] int? warehouseId,
            [FromQuery] int? driverId,
            [FromQuery] int? customerId)
        {
            var query = _context.Loads
                .Include(l => l.Customer)
                .Include(l => l.Vehicle)
                .Include(l => l.Driver)
                .Include(l => l.Warehouse)
                .Include(l => l.VehicleType)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                        .ThenInclude(sc => sc.Commodity)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Customer)
                .Include(l => l.LoadItems)
                    .ThenInclude(li => li.Commodity)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(l => l.Status == status);
            }
            if (warehouseId.HasValue)
            {
                query = query.Where(l => l.WarehouseId == warehouseId);
            }
            if (driverId.HasValue)
            {
                query = query.Where(l => l.DriverId == driverId);
            }
            if (customerId.HasValue)
            {
                query = query.Where(l => l.CustomerId == customerId);
            }

            // First order by CreatedAt in the database, then fetch and map
            var loadEntities = await query
                .OrderByDescending(l => l.CreatedAt)
                .ToListAsync();

            var loads = loadEntities.Select(l => MapToLoadDto(l)).ToList();

            return Ok(loads);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<LoadDto>> GetLoad(int id)
        {
            var load = await _context.Loads
                .Include(l => l.Customer)
                .Include(l => l.Vehicle)
                .Include(l => l.Driver)
                .Include(l => l.Warehouse)
                .Include(l => l.VehicleType)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                        .ThenInclude(sc => sc.Commodity)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                        .ThenInclude(sc => sc.Contract)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Customer)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Warehouse)
                .Include(l => l.LoadItems)
                    .ThenInclude(li => li.Commodity)
                .Where(l => l.Id == id)
                .FirstOrDefaultAsync();

            if (load == null)
                return NotFound();

            return Ok(MapToLoadDto(load));
        }

        [HttpPost]
        public async Task<ActionResult<LoadDto>> CreateLoad(CreateLoadDto dto)
        {
            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Generate unique load number
                var loadNumber = await GenerateLoadNumberAsync();

                // Get user ID from claims
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? createdByUserId = int.TryParse(userIdClaim, out var uid) ? uid : null;

                // Determine status based on driver assignment
                var status = dto.DriverId.HasValue ? "Assigned" : "Available";

                // Get pickup and delivery locations from stops
                var pickupStop = dto.Stops.FirstOrDefault(s => s.StopType == "Pickup");
                var destinationStop = dto.Stops.LastOrDefault(s => s.StopType == "Destination");

                var load = new Load
                {
                    LoadNumber = loadNumber,
                    CustomerId = dto.CustomerId,
                    VehicleId = dto.VehicleId,
                    DriverId = dto.DriverId,
                    WarehouseId = dto.WarehouseId,
                    VehicleTypeId = dto.VehicleTypeId,
                    CreatedByUserId = createdByUserId,
                    PickupLocation = pickupStop?.Address,
                    PickupLatitude = pickupStop?.Latitude,
                    PickupLongitude = pickupStop?.Longitude,
                    DeliveryLocation = destinationStop?.Address,
                    DeliveryLatitude = destinationStop?.Latitude,
                    DeliveryLongitude = destinationStop?.Longitude,
                    Status = status,
                    Priority = dto.Priority ?? "Normal",
                    ScheduledPickupDate = dto.ScheduledPickupDate,
                    ScheduledPickupTime = dto.ScheduledPickupTime,
                    ScheduledDeliveryDate = dto.ScheduledDeliveryDate,
                    ScheduledDeliveryTime = dto.ScheduledDeliveryTime,
                    EstimatedCost = dto.EstimatedCost,
                    ChargeAmount = dto.ChargeAmount,
                    EstimatedDistance = dto.EstimatedDistance,
                    EstimatedTimeMinutes = dto.EstimatedTimeMinutes,
                    SpecialInstructions = dto.SpecialInstructions,
                    Notes = dto.Notes
                };

                _context.Loads.Add(load);
                await _context.SaveChangesAsync();

                // Add stops with commodities
                decimal totalWeight = 0;
                decimal totalVolume = 0;

                foreach (var stopDto in dto.Stops.OrderBy(s => s.StopSequence))
                {
                    var stop = new LoadStop
                    {
                        LoadId = load.Id,
                        StopSequence = stopDto.StopSequence,
                        StopType = stopDto.StopType,
                        CustomerId = stopDto.CustomerId,
                        WarehouseId = stopDto.WarehouseId,
                        CompanyName = stopDto.CompanyName,
                        LocationName = stopDto.LocationName,
                        Address = stopDto.Address,
                        City = stopDto.City,
                        Province = stopDto.Province,
                        PostalCode = stopDto.PostalCode,
                        Latitude = stopDto.Latitude,
                        Longitude = stopDto.Longitude,
                        ContactPerson = stopDto.ContactPerson,
                        ContactPhone = stopDto.ContactPhone,
                        ContactEmail = stopDto.ContactEmail,
                        OrderNumber = stopDto.OrderNumber,
                        InvoiceNumber = stopDto.InvoiceNumber,
                        ScheduledArrival = stopDto.ScheduledArrival,
                        Notes = stopDto.Notes,
                        Status = "Pending"
                    };

                    _context.LoadStops.Add(stop);
                    await _context.SaveChangesAsync();

                    // Add commodities for this stop
                    foreach (var commodityDto in stopDto.Commodities)
                    {
                        var totalPrice = (commodityDto.UnitPrice ?? 0) * commodityDto.Quantity;

                        var stopCommodity = new StopCommodity
                        {
                            LoadStopId = stop.Id,
                            CommodityId = commodityDto.CommodityId,
                            ContractId = commodityDto.ContractId,
                            Quantity = commodityDto.Quantity,
                            UnitOfMeasure = commodityDto.UnitOfMeasure,
                            UnitPrice = commodityDto.UnitPrice,
                            TotalPrice = totalPrice,
                            Weight = commodityDto.Weight,
                            Volume = commodityDto.Volume,
                            OrderNumber = commodityDto.OrderNumber,
                            InvoiceNumber = commodityDto.InvoiceNumber,
                            Comment = commodityDto.Comment
                        };

                        _context.StopCommodities.Add(stopCommodity);

                        totalWeight += commodityDto.Weight ?? 0;
                        totalVolume += commodityDto.Volume ?? 0;
                    }
                }

                // Add legacy items if provided
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

                    totalWeight += itemDto.Weight ?? 0;
                    totalVolume += itemDto.Volume ?? 0;
                }

                // Update load totals
                load.TotalWeight = totalWeight;
                load.TotalVolume = totalVolume;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("Created new load {LoadNumber} with {StopCount} stops", loadNumber, dto.Stops.Count);

                // Fetch and return the created load
                var createdLoad = await _context.Loads
                    .Include(l => l.Customer)
                    .Include(l => l.Vehicle)
                    .Include(l => l.Driver)
                    .Include(l => l.Warehouse)
                    .Include(l => l.VehicleType)
                    .Include(l => l.Stops)
                        .ThenInclude(s => s.Commodities)
                            .ThenInclude(sc => sc.Commodity)
                    .Include(l => l.Stops)
                        .ThenInclude(s => s.Customer)
                    .Include(l => l.LoadItems)
                        .ThenInclude(li => li.Commodity)
                    .FirstOrDefaultAsync(l => l.Id == load.Id);

                return CreatedAtAction(nameof(GetLoad), new { id = load.Id }, MapToLoadDto(createdLoad!));
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error creating load");
                return StatusCode(500, "An error occurred while creating the load");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateLoad(int id, UpdateLoadDto dto)
        {
            var load = await _context.Loads
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                .FirstOrDefaultAsync(l => l.Id == id);
                
            if (load == null)
                return NotFound();

            if (dto.VehicleId.HasValue) load.VehicleId = dto.VehicleId;
            if (dto.DriverId.HasValue) load.DriverId = dto.DriverId;
            if (dto.VehicleTypeId.HasValue) load.VehicleTypeId = dto.VehicleTypeId;
            if (dto.WarehouseId.HasValue) load.WarehouseId = dto.WarehouseId;
            if (dto.Status != null) load.Status = dto.Status;
            if (dto.Priority != null) load.Priority = dto.Priority;
            if (dto.ScheduledPickupDate.HasValue) load.ScheduledPickupDate = dto.ScheduledPickupDate;
            if (dto.ScheduledPickupTime.HasValue) load.ScheduledPickupTime = dto.ScheduledPickupTime;
            if (dto.ActualPickupDate.HasValue) load.ActualPickupDate = dto.ActualPickupDate;
            if (dto.ScheduledDeliveryDate.HasValue) load.ScheduledDeliveryDate = dto.ScheduledDeliveryDate;
            if (dto.ScheduledDeliveryTime.HasValue) load.ScheduledDeliveryTime = dto.ScheduledDeliveryTime;
            if (dto.ActualDeliveryDate.HasValue) load.ActualDeliveryDate = dto.ActualDeliveryDate;
            if (dto.EstimatedCost.HasValue) load.EstimatedCost = dto.EstimatedCost;
            if (dto.ActualCost.HasValue) load.ActualCost = dto.ActualCost;
            if (dto.ChargeAmount.HasValue) load.ChargeAmount = dto.ChargeAmount;
            if (dto.ActualDistance.HasValue) load.ActualDistance = dto.ActualDistance;
            if (dto.EstimatedDistance.HasValue) load.EstimatedDistance = (int)dto.EstimatedDistance;
            if (dto.ActualTimeMinutes.HasValue) load.ActualTimeMinutes = dto.ActualTimeMinutes;
            if (dto.EstimatedTimeMinutes.HasValue) load.EstimatedTimeMinutes = dto.EstimatedTimeMinutes;
            if (dto.Notes != null) load.Notes = dto.Notes;
            if (dto.SpecialInstructions != null) load.SpecialInstructions = dto.SpecialInstructions;

            // Update stops if provided
            if (dto.Stops != null && dto.Stops.Any())
            {
                // Remove existing stops and their commodities
                foreach (var stop in load.Stops.ToList())
                {
                    _context.StopCommodities.RemoveRange(stop.Commodities);
                    _context.LoadStops.Remove(stop);
                }
                
                // Add new stops
                foreach (var stopDto in dto.Stops)
                {
                    var stop = new LoadStop
                    {
                        LoadId = load.Id,
                        StopSequence = stopDto.StopSequence,
                        StopType = stopDto.StopType ?? "Delivery",
                        CustomerId = stopDto.CustomerId,
                        CompanyName = stopDto.CompanyName,
                        Address = stopDto.Address ?? "Unknown",
                        City = stopDto.City,
                        Province = stopDto.Province,
                        Latitude = stopDto.Latitude,
                        Longitude = stopDto.Longitude,
                        ContactPerson = stopDto.ContactPerson,
                        ContactPhone = stopDto.ContactPhone,
                        OrderNumber = stopDto.OrderNumber,
                        InvoiceNumber = stopDto.InvoiceNumber,
                        ScheduledArrival = stopDto.ScheduledArrival
                    };
                    
                    _context.LoadStops.Add(stop);
                    await _context.SaveChangesAsync(); // Save to get the stop ID
                    
                    // Add commodities for this stop
                    if (stopDto.Commodities != null)
                    {
                        foreach (var commDto in stopDto.Commodities)
                        {
                            var commodity = new StopCommodity
                            {
                                LoadStopId = stop.Id,
                                CommodityId = commDto.CommodityId,
                                Quantity = commDto.Quantity,
                                UnitPrice = commDto.UnitPrice,
                                TotalPrice = commDto.TotalPrice ?? (commDto.Quantity * (commDto.UnitPrice ?? 0)),
                                Weight = commDto.Weight,
                                Volume = commDto.Volume,
                                Comment = commDto.CommodityName ?? commDto.Comment
                            };
                            _context.StopCommodities.Add(commodity);
                        }
                    }
                }
            }

            // Update status to Assigned if driver is now set
            if (dto.DriverId.HasValue && load.Status == "Available")
            {
                load.Status = "Assigned";
            }

            load.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateLoadStatus(int id, [FromBody] UpdateLoadStatusDto dto)
        {
            var load = await _context.Loads.FindAsync(id);
            if (load == null)
                return NotFound();

            var validStatuses = new[] { "Available", "Assigned", "InTransit", "Delivered", "Cancelled" };
            if (!validStatuses.Contains(dto.Status))
            {
                return BadRequest($"Invalid status. Valid values are: {string.Join(", ", validStatuses)}");
            }

            load.Status = dto.Status;
            load.UpdatedAt = DateTime.UtcNow;

            // Handle status-specific updates
            if (dto.Status == "InTransit" && !load.ActualPickupDate.HasValue)
            {
                load.ActualPickupDate = DateTime.UtcNow;
            }
            else if (dto.Status == "Delivered" && !load.ActualDeliveryDate.HasValue)
            {
                load.ActualDeliveryDate = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPut("{id}/assign")]
        public async Task<IActionResult> AssignLoad(int id, [FromBody] AssignLoadDto dto)
        {
            var load = await _context.Loads.FindAsync(id);
            if (load == null)
                return NotFound();

            if (dto.DriverId.HasValue)
            {
                var driver = await _context.Drivers.FindAsync(dto.DriverId.Value);
                if (driver == null)
                    return BadRequest("Driver not found");
                load.DriverId = dto.DriverId.Value;
            }

            if (dto.VehicleId.HasValue)
            {
                var vehicle = await _context.Vehicles.FindAsync(dto.VehicleId.Value);
                if (vehicle == null)
                    return BadRequest("Vehicle not found");
                load.VehicleId = dto.VehicleId.Value;
            }

            if (load.DriverId.HasValue && load.Status == "Available")
            {
                load.Status = "Assigned";
            }

            load.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            
            _logger.LogInformation("Assigned load {LoadNumber} to driver {DriverId} and vehicle {VehicleId}", 
                load.LoadNumber, load.DriverId, load.VehicleId);

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

        // Helper method to map Load to LoadDto
        private static LoadDto MapToLoadDto(Load l)
        {
            return new LoadDto
            {
                Id = l.Id,
                LoadNumber = l.LoadNumber,
                CustomerId = l.CustomerId,
                CustomerName = l.Customer?.Name,
                VehicleId = l.VehicleId,
                VehicleRegistration = l.Vehicle?.RegistrationNumber,
                DriverId = l.DriverId,
                DriverName = l.Driver != null ? $"{l.Driver.FirstName} {l.Driver.LastName}" : null,
                WarehouseId = l.WarehouseId,
                WarehouseName = l.Warehouse?.Name,
                VehicleTypeId = l.VehicleTypeId,
                VehicleTypeName = l.VehicleType?.Name,
                Status = l.Status,
                Priority = l.Priority,
                PickupLocation = l.PickupLocation,
                PickupLatitude = l.PickupLatitude,
                PickupLongitude = l.PickupLongitude,
                DeliveryLocation = l.DeliveryLocation,
                DeliveryLatitude = l.DeliveryLatitude,
                DeliveryLongitude = l.DeliveryLongitude,
                ScheduledPickupDate = l.ScheduledPickupDate,
                ScheduledPickupTime = l.ScheduledPickupTime,
                ActualPickupDate = l.ActualPickupDate,
                ScheduledDeliveryDate = l.ScheduledDeliveryDate,
                ScheduledDeliveryTime = l.ScheduledDeliveryTime,
                ActualDeliveryDate = l.ActualDeliveryDate,
                EstimatedDistance = l.EstimatedDistance,
                ActualDistance = l.ActualDistance,
                EstimatedTimeMinutes = l.EstimatedTimeMinutes,
                ActualTimeMinutes = l.ActualTimeMinutes,
                EstimatedCost = l.EstimatedCost,
                ActualCost = l.ActualCost,
                ChargeAmount = l.ChargeAmount,
                TotalWeight = l.TotalWeight,
                TotalVolume = l.TotalVolume,
                SpecialInstructions = l.SpecialInstructions,
                Notes = l.Notes,
                CreatedAt = l.CreatedAt,
                Stops = l.Stops.OrderBy(s => s.StopSequence).Select(s => new LoadStopDto
                {
                    Id = s.Id,
                    StopSequence = s.StopSequence,
                    StopType = s.StopType,
                    CustomerId = s.CustomerId,
                    CustomerName = s.Customer?.Name,
                    WarehouseId = s.WarehouseId,
                    WarehouseName = s.Warehouse?.Name,
                    CompanyName = s.CompanyName,
                    LocationName = s.LocationName,
                    Address = s.Address,
                    City = s.City,
                    Province = s.Province,
                    PostalCode = s.PostalCode,
                    Latitude = s.Latitude,
                    Longitude = s.Longitude,
                    ContactPerson = s.ContactPerson,
                    ContactPhone = s.ContactPhone,
                    ContactEmail = s.ContactEmail,
                    OrderNumber = s.OrderNumber,
                    InvoiceNumber = s.InvoiceNumber,
                    ScheduledArrival = s.ScheduledArrival,
                    ActualArrival = s.ActualArrival,
                    ActualDeparture = s.ActualDeparture,
                    Status = s.Status,
                    Notes = s.Notes,
                    Commodities = s.Commodities.Select(sc => new StopCommodityDto
                    {
                        Id = sc.Id,
                        CommodityId = sc.CommodityId,
                        CommodityName = sc.Commodity?.Name ?? "",
                        CommodityCode = sc.Commodity?.Code,
                        ContractId = sc.ContractId,
                        ContractName = sc.Contract?.ContractName,
                        Quantity = sc.Quantity,
                        UnitOfMeasure = sc.UnitOfMeasure,
                        UnitPrice = sc.UnitPrice,
                        TotalPrice = sc.TotalPrice,
                        Weight = sc.Weight,
                        Volume = sc.Volume,
                        OrderNumber = sc.OrderNumber,
                        InvoiceNumber = sc.InvoiceNumber,
                        Comment = sc.Comment
                    }).ToList()
                }).ToList(),
                Items = l.LoadItems.Select(i => new LoadItemDto
                {
                    Id = i.Id,
                    CommodityId = i.CommodityId,
                    CommodityName = i.Commodity?.Name ?? "",
                    Quantity = i.Quantity,
                    UnitOfMeasure = i.UnitOfMeasure,
                    Weight = i.Weight,
                    Volume = i.Volume,
                    Description = i.Description
                }).ToList()
            };
        }
    }

    // Additional DTOs for specific operations
    public class UpdateLoadStatusDto
    {
        public string Status { get; set; } = string.Empty;
    }

    public class AssignLoadDto
    {
        public int? DriverId { get; set; }
        public int? VehicleId { get; set; }
    }
}
