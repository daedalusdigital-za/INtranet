using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Logistics;
using ProjectTracker.API.Models.Logistics;
using System.Security.Claims;
using System.Text.Json;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/loads")]
    public class LoadsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<LoadsController> _logger;
        private readonly string _nasBasePath;

        public LoadsController(ApplicationDbContext context, ILogger<LoadsController> logger, IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            // Get NAS path from configuration, fallback to local path
            _nasBasePath = configuration.GetValue<string>("DocumentsPath") ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
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
                .Include(l => l.ProofOfDelivery)
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
        public async Task<ActionResult<LoadDto>> CreateLoad([FromBody] CreateLoadDto dto)
        {
            // Log ModelState errors if any (these would normally trigger automatic 400)
            if (!ModelState.IsValid)
            {
                var errors = ModelState
                    .Where(x => x.Value?.Errors.Count > 0)
                    .Select(x => new { Field = x.Key, Errors = x.Value?.Errors.Select(e => e.ErrorMessage) })
                    .ToList();
                _logger.LogWarning("CreateLoad ModelState validation failed: {Errors}", JsonSerializer.Serialize(errors));
                
                // Log the raw errors for debugging
                foreach (var error in errors)
                {
                    _logger.LogWarning("Validation error - Field: {Field}, Errors: {Errors}", 
                        error.Field, string.Join(", ", error.Errors ?? Array.Empty<string>()));
                }
                
                return ValidationProblem(ModelState);
            }

            // Log the incoming request for debugging
            _logger.LogInformation("CreateLoad called with {StopsCount} stops", dto.Stops?.Count ?? 0);
            
            // Log each stop for debugging
            if (dto.Stops != null)
            {
                for (int i = 0; i < dto.Stops.Count; i++)
                {
                    var s = dto.Stops[i];
                    _logger.LogInformation("Stop {Index}: CompanyName={CompanyName}, Address={Address}, CommoditiesCount={CommoditiesCount}", 
                        i, s.CompanyName ?? "null", s.Address ?? "null", s.Commodities?.Count ?? 0);
                }
            }
            
            // Validate stops have required data
            if (dto.Stops == null || dto.Stops.Count == 0)
            {
                _logger.LogWarning("CreateLoad failed: No stops provided");
                return BadRequest(new { error = "At least one stop is required" });
            }

            // Validate each stop has commodities
            for (int i = 0; i < dto.Stops.Count; i++)
            {
                var stop = dto.Stops[i];
                
                // Validate commodities
                if (stop.Commodities == null || stop.Commodities.Count == 0)
                {
                    _logger.LogWarning("CreateLoad failed: Stop {Index} has no commodities", i);
                    return BadRequest(new { error = $"Stop {i + 1} ({stop.CompanyName ?? "Unknown"}) has no commodities" });
                }
            }

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // Generate unique load number
                var loadNumber = await GenerateLoadNumberAsync();

                // Get user ID from claims
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                int? createdByUserId = int.TryParse(userIdClaim, out var uid) ? uid : null;

                // Determine status: use provided status (Draft), or default based on driver assignment
                var status = !string.IsNullOrEmpty(dto.Status) 
                    ? dto.Status 
                    : (dto.DriverId.HasValue ? "Assigned" : "Available");

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
                    // Use a fallback address if none provided
                    var address = string.IsNullOrWhiteSpace(stopDto.Address) 
                        ? (stopDto.CompanyName ?? "Address not specified")
                        : stopDto.Address;

                    var stop = new LoadStop
                    {
                        LoadId = load.Id,
                        StopSequence = stopDto.StopSequence,
                        StopType = stopDto.StopType,
                        CustomerId = stopDto.CustomerId,
                        WarehouseId = stopDto.WarehouseId,
                        CompanyName = stopDto.CompanyName,
                        LocationName = stopDto.LocationName,
                        Address = address,
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
                        // Use TotalPrice from DTO if provided (frontend sends salesAmount as totalPrice),
                        // otherwise calculate from unitPrice * quantity. Values are stored exactly as
                        // captured on the trip sheet (VAT-inclusive), matching the sales invoice.
                        var unitPrice = commodityDto.UnitPrice;
                        var totalPrice = commodityDto.TotalPrice.HasValue
                            ? commodityDto.TotalPrice.Value
                            : (unitPrice * commodityDto.Quantity);

                        // Use commodityName/code as comment if no explicit comment provided
                        var comment = commodityDto.Comment;
                        if (string.IsNullOrEmpty(comment) && !string.IsNullOrEmpty(commodityDto.CommodityName))
                        {
                            comment = commodityDto.CommodityCode != null 
                                ? $"{commodityDto.CommodityCode}: {commodityDto.CommodityName}"
                                : commodityDto.CommodityName;
                        }

                        var stopCommodity = new StopCommodity
                        {
                            LoadStopId = stop.Id,
                            CommodityId = commodityDto.CommodityId,  // Nullable - imported invoices don't have Commodity FK
                            ContractId = commodityDto.ContractId,
                            Quantity = commodityDto.Quantity,
                            UnitOfMeasure = commodityDto.UnitOfMeasure,
                            UnitPrice = unitPrice,
                            TotalPrice = totalPrice,
                            Weight = commodityDto.Weight,
                            Volume = commodityDto.Volume,
                            OrderNumber = commodityDto.OrderNumber,
                            InvoiceNumber = commodityDto.InvoiceNumber,
                            Brand = commodityDto.Brand,
                            Comment = comment
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
                
                // Link imported invoices to this load if invoiceIds are provided
                if (dto.InvoiceIds != null && dto.InvoiceIds.Any())
                {
                    var invoicesToLink = await _context.ImportedInvoices
                        .Where(i => dto.InvoiceIds.Contains(i.Id))
                        .ToListAsync();
                    
                    foreach (var invoice in invoicesToLink)
                    {
                        invoice.LoadId = load.Id;
                        invoice.Status = "Assigned";
                        invoice.UpdatedAt = DateTime.UtcNow;
                    }
                    
                    // Auto-escalate load priority based on highest-priority linked invoice
                    // The longer an invoice has been in the system, the higher the load priority
                    var invoicePriorities = invoicesToLink.Select(i => i.DeliveryPriority).ToList();
                    var highestInvoicePriority = Services.InvoiceDeliveryPriorityService.GetHighestPriority(invoicePriorities);
                    var mappedLoadPriority = Services.InvoiceDeliveryPriorityService.MapToLoadPriority(highestInvoicePriority);
                    
                    // Only escalate, never downgrade the load priority
                    var currentWeight = Services.InvoiceDeliveryPriorityService.GetPriorityWeight(load.Priority ?? "Normal");
                    var invoiceWeight = Services.InvoiceDeliveryPriorityService.GetPriorityWeight(mappedLoadPriority);
                    if (invoiceWeight > currentWeight)
                    {
                        load.Priority = mappedLoadPriority;
                        _logger.LogInformation("Load {LoadNumber} priority auto-escalated to {Priority} based on invoice aging",
                            loadNumber, mappedLoadPriority);
                    }
                    
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Linked {InvoiceCount} invoices to load {LoadNumber}", invoicesToLink.Count, loadNumber);
                }
                
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
            if (dto.EstimatedDistance.HasValue) load.EstimatedDistance = dto.EstimatedDistance;
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
                    
                    // Write back address fixes to the linked LogisticsCustomer
                    if (stopDto.CustomerId.HasValue && stopDto.CustomerId.Value > 0)
                    {
                        var customer = await _context.LogisticsCustomers.FindAsync(stopDto.CustomerId.Value);
                        if (customer != null)
                        {
                            bool customerChanged = false;
                            if (!string.IsNullOrEmpty(stopDto.City) && (string.IsNullOrEmpty(customer.City) || customer.City != stopDto.City))
                            {
                                customer.City = stopDto.City;
                                customer.DeliveryCity = stopDto.City;
                                customerChanged = true;
                            }
                            if (!string.IsNullOrEmpty(stopDto.Province) && (string.IsNullOrEmpty(customer.Province) || customer.Province != stopDto.Province))
                            {
                                customer.Province = stopDto.Province;
                                customer.DeliveryProvince = stopDto.Province;
                                customerChanged = true;
                            }
                            if (stopDto.Latitude.HasValue && stopDto.Latitude != 0 && customer.Latitude == null)
                            {
                                customer.Latitude = (double)stopDto.Latitude.Value;
                                customer.Longitude = stopDto.Longitude.HasValue ? (double)stopDto.Longitude.Value : null;
                                customerChanged = true;
                            }
                            if (!string.IsNullOrEmpty(stopDto.Address) && stopDto.Address != "Unknown" && 
                                (string.IsNullOrEmpty(customer.DeliveryAddress) || customer.DeliveryAddress == "Unknown"))
                            {
                                customer.DeliveryAddress = stopDto.Address;
                                customerChanged = true;
                            }
                            if (customerChanged)
                            {
                                customer.UpdatedAt = DateTime.UtcNow;
                                _logger.LogInformation("Updated LogisticsCustomer {Id} ({Name}) with address fixes from load edit", customer.Id, customer.Name);
                            }
                        }
                    }

                    // Add commodities for this stop
                    if (stopDto.Commodities != null)
                    {
                        foreach (var commDto in stopDto.Commodities)
                        {
                            // Use commodityName/code as comment if no explicit comment provided
                            var comment = commDto.Comment;
                            if (string.IsNullOrEmpty(comment) && !string.IsNullOrEmpty(commDto.CommodityName))
                            {
                                comment = commDto.CommodityCode != null 
                                    ? $"{commDto.CommodityCode}: {commDto.CommodityName}"
                                    : commDto.CommodityName;
                            }

                            var commodity = new StopCommodity
                            {
                                LoadStopId = stop.Id,
                                CommodityId = commDto.CommodityId,  // Nullable - imported invoices don't have Commodity FK
                                Quantity = commDto.Quantity,
                                UnitPrice = commDto.UnitPrice,
                                TotalPrice = commDto.TotalPrice.HasValue
                                    ? commDto.TotalPrice.Value
                                    : (commDto.Quantity * commDto.UnitPrice),
                                Weight = commDto.Weight,
                                Volume = commDto.Volume,
                                OrderNumber = commDto.OrderNumber,
                                InvoiceNumber = commDto.InvoiceNumber,
                                Brand = commDto.Brand,
                                Comment = comment
                            };
                            _context.StopCommodities.Add(commodity);
                        }
                    }
                }
            }

            // Link imported invoices to this load if invoiceIds are provided
            if (dto.InvoiceIds != null && dto.InvoiceIds.Any())
            {
                // First, unlink any previously linked invoices for this load
                var previouslyLinked = await _context.ImportedInvoices
                    .Where(i => i.LoadId == load.Id)
                    .ToListAsync();
                foreach (var inv in previouslyLinked)
                {
                    inv.LoadId = null;
                    inv.Status = "Pending";
                    inv.UpdatedAt = DateTime.UtcNow;
                }

                // Link the new set of invoices
                var invoicesToLink = await _context.ImportedInvoices
                    .Where(i => dto.InvoiceIds.Contains(i.Id))
                    .ToListAsync();
                foreach (var invoice in invoicesToLink)
                {
                    invoice.LoadId = load.Id;
                    invoice.Status = "Assigned";
                    invoice.UpdatedAt = DateTime.UtcNow;
                }
                _logger.LogInformation("Re-linked {InvoiceCount} invoices to load {LoadNumber}", invoicesToLink.Count, load.LoadNumber);
            }

            // Update status to Assigned if driver is now set
            if (dto.DriverId.HasValue && (load.Status == "Available" || load.Status == "Draft"))
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
            var load = await _context.Loads
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                .FirstOrDefaultAsync(l => l.Id == id);
            if (load == null)
                return NotFound();

            var validStatuses = new[] { "Available", "Assigned", "InTransit", "Delivered", "Completed", "Cancelled" };
            if (!validStatuses.Contains(dto.Status))
            {
                return BadRequest($"Invalid status. Valid values are: {string.Join(", ", validStatuses)}");
            }

            // Closing a load requires proof of delivery: either a POD document attached
            // to the load, or a POD linked to every invoice on the load.
            if (dto.Status == "Completed")
            {
                var coverage = await GetPodCoverageAsync(load);
                if (!coverage.Covered)
                {
                    return Conflict(new
                    {
                        error = coverage.InvoiceNumbers.Count == 0
                            ? "Cannot close this load: no POD document has been uploaded for it."
                            : $"Cannot close this load: {coverage.MissingInvoices.Count} of {coverage.InvoiceNumbers.Count} invoice(s) have no POD linked.",
                        missingInvoices = coverage.MissingInvoices,
                        invoiceCount = coverage.InvoiceNumbers.Count
                    });
                }
                if (!load.ActualDeliveryDate.HasValue) load.ActualDeliveryDate = DateTime.UtcNow;
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

            // Sync invoices from load stops when status changes
            if (dto.Status == "Assigned" || dto.Status == "InTransit" || dto.Status == "Delivered")
            {
                // Collect all invoice numbers from this load
                var invoiceNumbers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                
                foreach (var stop in load.Stops)
                {
                    // Get invoice number from stop
                    if (!string.IsNullOrWhiteSpace(stop.InvoiceNumber))
                    {
                        foreach (var invNum in stop.InvoiceNumber.Split(',', StringSplitOptions.RemoveEmptyEntries))
                        {
                            var trimmed = invNum.Trim();
                            if (!string.IsNullOrEmpty(trimmed))
                                invoiceNumbers.Add(NormalizeInvoiceNumber(trimmed));
                        }
                    }
                    
                    // Get invoice numbers from commodities
                    foreach (var commodity in stop.Commodities)
                    {
                        if (!string.IsNullOrWhiteSpace(commodity.InvoiceNumber))
                        {
                            foreach (var invNum in commodity.InvoiceNumber.Split(',', StringSplitOptions.RemoveEmptyEntries))
                            {
                                var trimmed = invNum.Trim();
                                if (!string.IsNullOrEmpty(trimmed))
                                    invoiceNumbers.Add(NormalizeInvoiceNumber(trimmed));
                            }
                        }
                    }
                }

                // Find and update matching invoices
                if (invoiceNumbers.Any())
                {
                    var allInvoices = await _context.ImportedInvoices.ToListAsync();
                    var newStatus = dto.Status == "Delivered" ? "Delivered" 
                                  : dto.Status == "InTransit" ? "InTransit" 
                                  : "Assigned";

                    foreach (var invoice in allInvoices)
                    {
                        var normalizedTransNum = NormalizeInvoiceNumber(invoice.TransactionNumber);
                        if (invoiceNumbers.Contains(normalizedTransNum))
                        {
                            // Link to load if not already linked
                            if (!invoice.LoadId.HasValue)
                            {
                                invoice.LoadId = id;
                            }

                            // Update status (only upgrade, never downgrade except from Pending)
                            var shouldUpdate = invoice.Status == "Pending" 
                                            || (invoice.Status == "Assigned" && (newStatus == "InTransit" || newStatus == "Delivered"))
                                            || (invoice.Status == "InTransit" && newStatus == "Delivered");

                            if (shouldUpdate)
                            {
                                invoice.Status = newStatus;
                                
                                if (newStatus == "Delivered")
                                {
                                    invoice.LastDeliveryDate = DateTime.UtcNow;
                                    if (!invoice.DeliveredQuantity.HasValue || invoice.DeliveredQuantity < invoice.Quantity)
                                    {
                                        invoice.DeliveredQuantity = invoice.Quantity;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Also update any already-linked invoices (legacy behavior)
            if (dto.Status == "Delivered")
            {
                var linkedInvoices = await _context.ImportedInvoices
                    .Where(i => i.LoadId == id && i.Status != "Delivered")
                    .ToListAsync();

                foreach (var invoice in linkedInvoices)
                {
                    invoice.Status = "Delivered";
                    invoice.LastDeliveryDate = DateTime.UtcNow;
                    
                    if (!invoice.DeliveredQuantity.HasValue || invoice.DeliveredQuantity < invoice.Quantity)
                    {
                        invoice.DeliveredQuantity = invoice.Quantity;
                    }
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>
        /// Sync invoice statuses from all tripsheets/loads.
        /// Matches invoices from load stops to ImportedInvoices and updates their status.
        /// </summary>
        [Authorize]
        [HttpPost("sync-invoice-statuses")]
        public async Task<IActionResult> SyncInvoiceStatuses()
        {
            var syncResults = new SyncInvoiceStatusesResult();

            try
            {
                // Get all loads with their stops
                var loads = await _context.Loads
                    .Include(l => l.Stops)
                        .ThenInclude(s => s.Commodities)
                    .Where(l => l.Status != "Cancelled")
                    .ToListAsync();

                // Get all pending/unassigned invoices
                var invoices = await _context.ImportedInvoices
                    .Where(i => i.Status != "Cancelled")
                    .ToListAsync();

                // Build a lookup dictionary for invoices by transaction number
                var invoiceLookup = invoices
                    .GroupBy(i => NormalizeInvoiceNumber(i.TransactionNumber))
                    .ToDictionary(g => g.Key, g => g.ToList());

                foreach (var load in loads)
                {
                    // Collect all invoice numbers from this load
                    var loadInvoiceNumbers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                    // From stops
                    foreach (var stop in load.Stops)
                    {
                        if (!string.IsNullOrWhiteSpace(stop.InvoiceNumber))
                        {
                            // Could be multiple invoices comma-separated
                            var invoiceNos = stop.InvoiceNumber.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                            foreach (var inv in invoiceNos)
                            {
                                loadInvoiceNumbers.Add(NormalizeInvoiceNumber(inv.Trim()));
                            }
                        }

                        // From commodities on the stop
                        foreach (var commodity in stop.Commodities)
                        {
                            if (!string.IsNullOrWhiteSpace(commodity.InvoiceNumber))
                            {
                                var invoiceNos = commodity.InvoiceNumber.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries);
                                foreach (var inv in invoiceNos)
                                {
                                    loadInvoiceNumbers.Add(NormalizeInvoiceNumber(inv.Trim()));
                                }
                            }
                        }
                    }

                    // Determine the target status based on load status
                    string targetInvoiceStatus = load.Status switch
                    {
                        "Delivered" => "Delivered",
                        "InTransit" => "InTransit",
                        "Assigned" => "Assigned",
                        _ => "Pending"
                    };

                    // Match and update invoices
                    foreach (var invoiceNo in loadInvoiceNumbers)
                    {
                        if (invoiceLookup.TryGetValue(invoiceNo, out var matchedInvoices))
                        {
                            foreach (var invoice in matchedInvoices)
                            {
                                // Only update if not already linked or status needs upgrade
                                bool shouldUpdate = false;
                                string previousStatus = invoice.Status;

                                // Link to load if not already linked
                                if (!invoice.LoadId.HasValue || invoice.LoadId != load.Id)
                                {
                                    invoice.LoadId = load.Id;
                                    shouldUpdate = true;
                                }

                                // Update status based on priority (Delivered > InTransit > Assigned > Pending)
                                var statusPriority = new Dictionary<string, int>
                                {
                                    { "Pending", 0 },
                                    { "Assigned", 1 },
                                    { "InTransit", 2 },
                                    { "PartDelivered", 3 },
                                    { "Delivered", 4 }
                                };

                                int currentPriority = statusPriority.GetValueOrDefault(invoice.Status, 0);
                                int targetPriority = statusPriority.GetValueOrDefault(targetInvoiceStatus, 0);

                                // Only upgrade status, never downgrade (unless it's pending)
                                if (targetPriority > currentPriority || invoice.Status == "Pending")
                                {
                                    invoice.Status = targetInvoiceStatus;
                                    shouldUpdate = true;

                                    // Set delivery date if delivered
                                    if (targetInvoiceStatus == "Delivered")
                                    {
                                        invoice.LastDeliveryDate = load.ActualDeliveryDate ?? DateTime.UtcNow;
                                        invoice.DeliveredQuantity = invoice.Quantity;
                                    }
                                }

                                if (shouldUpdate)
                                {
                                    syncResults.UpdatedInvoices.Add(new SyncedInvoice
                                    {
                                        InvoiceNumber = invoice.TransactionNumber,
                                        LoadNumber = load.LoadNumber,
                                        PreviousStatus = previousStatus,
                                        NewStatus = invoice.Status
                                    });
                                }
                            }
                        }
                    }
                }

                await _context.SaveChangesAsync();

                syncResults.Success = true;
                syncResults.TotalLoadsProcessed = loads.Count;
                syncResults.TotalInvoicesUpdated = syncResults.UpdatedInvoices.Count;

                _logger.LogInformation(
                    "Invoice status sync completed: {LoadsProcessed} loads, {InvoicesUpdated} invoices updated",
                    syncResults.TotalLoadsProcessed, syncResults.TotalInvoicesUpdated);

                return Ok(syncResults);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing invoice statuses");
                syncResults.Success = false;
                syncResults.ErrorMessage = ex.Message;
                return StatusCode(500, syncResults);
            }
        }

        /// <summary>
        /// Normalize invoice number for matching (remove spaces, common prefixes, etc.)
        /// </summary>
        // ------------------------------------------------------------------
        // POD coverage (Logistics ↔ Finance hand-off)
        // ------------------------------------------------------------------

        private sealed class PodCoverage
        {
            public bool DirectPod { get; set; }
            public List<string> InvoiceNumbers { get; set; } = new();
            public List<string> MissingInvoices { get; set; } = new();
            public bool Covered => DirectPod || (InvoiceNumbers.Count > 0 && MissingInvoices.Count == 0);
        }

        private static readonly char[] InvoiceSeparators = { ',', ';', '/', '\n', '\r', '|' };

        private static List<string> CollectInvoiceNumbers(Load load)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var stop in load.Stops)
            {
                foreach (var raw in (stop.InvoiceNumber ?? "").Split(InvoiceSeparators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                    if (raw.Length > 0) set.Add(NormalizeInvoiceNumber(raw));
                foreach (var c in stop.Commodities)
                    foreach (var raw in (c.InvoiceNumber ?? "").Split(InvoiceSeparators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                        if (raw.Length > 0) set.Add(NormalizeInvoiceNumber(raw));
            }
            return set.OrderBy(s => s).ToList();
        }

        private async Task<PodCoverage> GetPodCoverageAsync(Load load)
        {
            var cov = new PodCoverage { InvoiceNumbers = CollectInvoiceNumbers(load) };
            cov.DirectPod = await _context.PodDocuments.AnyAsync(p => p.LoadId == load.Id);
            if (cov.InvoiceNumbers.Count > 0)
            {
                var linked = await GetPodLinkedInvoiceNumbersAsync();
                cov.MissingInvoices = cov.InvoiceNumbers.Where(n => !linked.Contains(n)).ToList();
            }
            return cov;
        }

        /// <summary>
        /// Every invoice number that has a POD, normalised. Uses the link's own InvoiceNumber
        /// AND the linked invoice's TransactionNumber (older links only stored InvoiceId).
        /// </summary>
        private async Task<HashSet<string>> GetPodLinkedInvoiceNumbersAsync()
        {
            var raw = await _context.PodDocumentInvoiceLinks.AsNoTracking()
                .Select(l => new { l.InvoiceNumber, Tx = l.Invoice != null ? l.Invoice.TransactionNumber : null })
                .ToListAsync();
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var r in raw)
            {
                if (!string.IsNullOrWhiteSpace(r.InvoiceNumber)) set.Add(NormalizeInvoiceNumber(r.InvoiceNumber));
                if (!string.IsNullOrWhiteSpace(r.Tx)) set.Add(NormalizeInvoiceNumber(r.Tx));
            }
            return set;
        }

        /// <summary>
        /// POD ↔ Tripsheet reconciliation. Tripsheets are imported from spreadsheets, so their
        /// invoices live as comma-separated text on stops/lines and ImportedInvoices.LoadId is
        /// usually empty — which meant PODs linked to those invoices never reached the tripsheet.
        /// Matches on invoice number text and:
        ///  • back-fills PodDocumentInvoiceLinks.InvoiceNumber, ImportedInvoices.LoadId, PodDocuments.LoadId
        ///  • marks open tripsheets Delivered when EVERY invoice on them has a POD.
        /// apply=false previews only.
        /// </summary>
        [HttpPost("pod-reconcile")]
        public async Task<IActionResult> PodReconcile([FromQuery] bool apply = false)
        {
            var blankLinks = await _context.PodDocumentInvoiceLinks
                .Include(l => l.Invoice)
                .Where(l => (l.InvoiceNumber == null || l.InvoiceNumber == "") && l.Invoice != null)
                .ToListAsync();
            if (apply) foreach (var l in blankLinks) l.InvoiceNumber = l.Invoice!.TransactionNumber;

            var links = await _context.PodDocumentInvoiceLinks.AsNoTracking()
                .Select(l => new
                {
                    l.PodDocumentId,
                    Num = l.InvoiceNumber ?? (l.Invoice != null ? l.Invoice.TransactionNumber : null),
                    Date = (DateTime?)l.PodDocument.DeliveryDate
                })
                .ToListAsync();
            var podByInvoice = new Dictionary<string, List<(int PodId, DateTime? Date)>>(StringComparer.OrdinalIgnoreCase);
            foreach (var l in links)
            {
                if (string.IsNullOrWhiteSpace(l.Num)) continue;
                var key = NormalizeInvoiceNumber(l.Num);
                if (!podByInvoice.TryGetValue(key, out var list)) podByInvoice[key] = list = new();
                list.Add((l.PodDocumentId, l.Date));
            }

            var loads = await _context.Loads
                .Include(l => l.Stops).ThenInclude(s => s.Commodities)
                .Where(l => l.Status != "Cancelled")
                .ToListAsync();
            var directPodLoadIds = (await _context.PodDocuments.AsNoTracking()
                .Where(p => p.LoadId != null).Select(p => p.LoadId!.Value).Distinct().ToListAsync()).ToHashSet();

            var loadByInvoice = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            var closable = new List<object>();
            var partial = new List<object>();
            var closeIds = new Dictionary<int, DateTime?>();
            var podToLoad = new Dictionary<int, int>();

            foreach (var load in loads)
            {
                var invoices = CollectInvoiceNumbers(load);
                foreach (var n in invoices) loadByInvoice.TryAdd(n, load.Id);
                if (invoices.Count == 0) continue;

                var covered = invoices.Where(n => podByInvoice.ContainsKey(n)).ToList();
                foreach (var n in covered)
                    foreach (var p in podByInvoice[n]) podToLoad.TryAdd(p.PodId, load.Id);

                var isOpen = load.Status != "Delivered" && load.Status != "Completed";
                if (!isOpen || covered.Count == 0) continue;

                var missing = invoices.Except(covered, StringComparer.OrdinalIgnoreCase).ToList();
                if (missing.Count == 0 || directPodLoadIds.Contains(load.Id))
                {
                    var podDate = covered.SelectMany(n => podByInvoice[n]).Max(p => p.Date);
                    closeIds[load.Id] = podDate;
                    closable.Add(new { load.Id, load.LoadNumber, load.Status, invoices = invoices.Count, podDate });
                }
                else
                {
                    partial.Add(new { load.Id, load.LoadNumber, load.Status, invoices = invoices.Count, withPod = covered.Count, missing });
                }
            }

            var unlinkedInvoices = await _context.ImportedInvoices
                .Where(i => i.LoadId == null)
                .ToListAsync();
            int invoicesLinked = 0;
            foreach (var inv in unlinkedInvoices)
            {
                if (!string.IsNullOrWhiteSpace(inv.TransactionNumber) &&
                    loadByInvoice.TryGetValue(NormalizeInvoiceNumber(inv.TransactionNumber), out var lid))
                { if (apply) inv.LoadId = lid; invoicesLinked++; }
            }

            var podsNoLoad = await _context.PodDocuments.Where(p => p.LoadId == null).ToListAsync();
            int podsLinked = 0;
            foreach (var p in podsNoLoad)
                if (podToLoad.TryGetValue(p.Id, out var lid)) { if (apply) p.LoadId = lid; podsLinked++; }

            if (apply)
            {
                var now = DateTime.UtcNow;
                foreach (var load in loads.Where(l => closeIds.ContainsKey(l.Id)))
                {
                    load.Status = "Delivered";
                    load.ActualDeliveryDate ??= closeIds[load.Id] ?? now;
                    load.UpdatedAt = now;
                }
                await _context.SaveChangesAsync();
                _logger.LogInformation("POD reconcile applied: {Closed} tripsheets delivered, {Inv} invoices linked, {Pods} PODs linked, {Links} link numbers filled",
                    closeIds.Count, invoicesLinked, podsLinked, blankLinks.Count);
            }

            return Ok(new
            {
                applied = apply,
                tripsheetsClosable = closable.Count,
                tripsheetsPartial = partial.Count,
                invoicesLinkedToTripsheets = invoicesLinked,
                podsLinkedToTripsheets = podsLinked,
                podLinksNumberFilled = blankLinks.Count,
                closable,
                partial
            });
        }

        /// <summary>
        /// Counts for the Home page: loads scheduled for delivery today (South African
        /// date) by status and warehouse, plus loads from earlier days still not delivered.
        /// </summary>
        [HttpGet("today-summary")]
        public async Task<IActionResult> TodaySummary()
        {
            // SAST is a fixed UTC+2 offset with no daylight saving.
            var today = DateTime.UtcNow.AddHours(2).Date;
            var tomorrow = today.AddDays(1);
            var closed = new[] { "Delivered", "Completed", "Cancelled" };

            // Most loads are planned by pickup date only (ScheduledDeliveryDate is
            // left blank), so the "due" date falls back to the pickup date. Loads
            // actually delivered today are counted as well.
            var rows = await _context.Loads.AsNoTracking()
                .Where(l => l.Status != "Cancelled" && (
                    ((l.ScheduledDeliveryDate ?? l.ScheduledPickupDate) >= today && (l.ScheduledDeliveryDate ?? l.ScheduledPickupDate) < tomorrow) ||
                    (l.ActualDeliveryDate >= today && l.ActualDeliveryDate < tomorrow)))
                .Select(l => new { l.Status, Warehouse = l.Warehouse != null ? (l.Warehouse.Code ?? l.Warehouse.Name) : null })
                .ToListAsync();

            var overdue = await _context.Loads.AsNoTracking()
                .CountAsync(l => (l.ScheduledDeliveryDate ?? l.ScheduledPickupDate) < today && !closed.Contains(l.Status));

            static string Bucket(string s) => s switch
            {
                "Delivered" or "Completed" => "delivered",
                "InTransit" => "inTransit",
                _ => "notStarted"
            };

            return Ok(new
            {
                total = rows.Count,
                delivered = rows.Count(r => Bucket(r.Status) == "delivered"),
                inTransit = rows.Count(r => Bucket(r.Status) == "inTransit"),
                notStarted = rows.Count(r => Bucket(r.Status) == "notStarted"),
                overdue,
                byWarehouse = rows
                    .GroupBy(r => r.Warehouse ?? "No warehouse")
                    .Select(g => new
                    {
                        name = g.Key,
                        total = g.Count(),
                        delivered = g.Count(r => Bucket(r.Status) == "delivered"),
                        inTransit = g.Count(r => Bucket(r.Status) == "inTransit"),
                        notStarted = g.Count(r => Bucket(r.Status) == "notStarted")
                    })
                    .OrderByDescending(g => g.total)
                    .ToList()
            });
        }

        /// <summary>
        /// Loads marked Delivered that still have no proof of delivery — the
        /// unbillable backlog. A load is covered when a POD document is attached
        /// to it directly, or every invoice on it has a linked POD.
        /// </summary>
        [HttpGet("delivered-without-pod")]
        public async Task<IActionResult> DeliveredWithoutPod()
        {
            var loads = await _context.Loads.AsNoTracking()
                .Include(l => l.Customer)
                .Include(l => l.Driver)
                .Include(l => l.Warehouse)
                .Include(l => l.Stops).ThenInclude(s => s.Commodities)
                .Where(l => l.Status == "Delivered")
                .ToListAsync();

            var directPodLoadIds = (await _context.PodDocuments.AsNoTracking()
                .Where(p => p.LoadId != null).Select(p => p.LoadId!.Value).Distinct().ToListAsync()).ToHashSet();
            var linkedInvoices = await GetPodLinkedInvoiceNumbersAsync();

            var now = DateTime.UtcNow;
            var rows = new List<DeliveredWithoutPodRow>();
            foreach (var l in loads)
            {
                if (directPodLoadIds.Contains(l.Id)) continue;
                var invoices = CollectInvoiceNumbers(l);
                var missing = invoices.Where(n => !linkedInvoices.Contains(n)).ToList();
                if (invoices.Count > 0 && missing.Count == 0) continue;

                var deliveredAt = l.ActualDeliveryDate ?? l.ScheduledDeliveryDate ?? l.UpdatedAt ?? l.CreatedAt;
                rows.Add(new DeliveredWithoutPodRow
                {
                    LoadId = l.Id,
                    LoadNumber = l.LoadNumber,
                    CustomerName = l.Customer?.Name ?? l.Stops.Select(s => s.CompanyName ?? s.LocationName).FirstOrDefault(n => !string.IsNullOrWhiteSpace(n)),
                    DriverName = l.Driver == null ? null : $"{l.Driver.FirstName} {l.Driver.LastName}".Trim(),
                    Warehouse = l.Warehouse?.Name,
                    DeliveredAt = deliveredAt,
                    DaysOutstanding = (int)Math.Floor((now - deliveredAt).TotalDays),
                    StopCount = l.Stops.Count,
                    InvoiceCount = invoices.Count,
                    MissingInvoices = missing,
                    Value = l.Stops.SelectMany(s => s.Commodities).Sum(c => c.TotalPrice ?? 0m)
                });
            }

            var ordered = rows.OrderByDescending(r => r.DaysOutstanding).ToList();
            return Ok(new
            {
                count = ordered.Count,
                deliveredTotal = loads.Count,
                totalValue = ordered.Sum(r => r.Value),
                items = ordered
            });
        }

        public class DeliveredWithoutPodRow
        {
            public int LoadId { get; set; }
            public string LoadNumber { get; set; } = "";
            public string? CustomerName { get; set; }
            public string? DriverName { get; set; }
            public string? Warehouse { get; set; }
            public DateTime DeliveredAt { get; set; }
            public int DaysOutstanding { get; set; }
            public int StopCount { get; set; }
            public int InvoiceCount { get; set; }
            public List<string> MissingInvoices { get; set; } = new();
            public decimal Value { get; set; }
        }

        private static string NormalizeInvoiceNumber(string invoiceNo)
        {
            if (string.IsNullOrWhiteSpace(invoiceNo))
                return string.Empty;

            // Remove common prefixes and normalize
            var normalized = invoiceNo.Trim().ToUpperInvariant();
            
            // Remove common prefixes for comparison
            var prefixes = new[] { "INV", "IN", "SI", "TAX", "#", "NO.", "NO" };
            foreach (var prefix in prefixes)
            {
                if (normalized.StartsWith(prefix) && normalized.Length > prefix.Length)
                {
                    var rest = normalized.Substring(prefix.Length).TrimStart('-', ' ', ':');
                    if (rest.All(char.IsDigit))
                    {
                        normalized = rest;
                        break;
                    }
                }
            }

            return normalized;
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

        [HttpPut("{id}/reassign")]
        public async Task<IActionResult> ReassignLoad(int id, [FromBody] AssignLoadDto dto)
        {
            var load = await _context.Loads
                .Include(l => l.Vehicle)
                .Include(l => l.Driver)
                .FirstOrDefaultAsync(l => l.Id == id);
                
            if (load == null)
                return NotFound();

            if (dto.DriverId.HasValue)
            {
                var driver = await _context.Drivers.FindAsync(dto.DriverId.Value);
                if (driver == null)
                    return BadRequest("Driver not found");
                load.DriverId = dto.DriverId.Value;
            }
            else if (dto.DriverId == null)
            {
                // Explicitly allow unassignment
                load.DriverId = null;
            }

            if (dto.VehicleId.HasValue)
            {
                var vehicle = await _context.Vehicles.FindAsync(dto.VehicleId.Value);
                if (vehicle == null)
                    return BadRequest("Vehicle not found");
                load.VehicleId = dto.VehicleId.Value;
            }
            else if (dto.VehicleId == null)
            {
                // Explicitly allow unassignment
                load.VehicleId = null;
            }

            load.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            
            // Reload to get fresh navigation properties
            await _context.Entry(load).Reference(l => l.Vehicle).LoadAsync();
            await _context.Entry(load).Reference(l => l.Driver).LoadAsync();
            
            _logger.LogInformation("Reassigned load {LoadNumber} to driver {DriverId} and vehicle {VehicleId}", 
                load.LoadNumber, load.DriverId, load.VehicleId);

            return Ok(new { 
                vehicle = load.Vehicle != null ? new { 
                    registrationNumber = load.Vehicle.RegistrationNumber 
                } : null,
                driver = load.Driver != null ? new { 
                    firstName = load.Driver.FirstName, 
                    lastName = load.Driver.LastName 
                } : null
            });
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

            // Update all linked ImportedInvoices to Delivered status
            var linkedInvoices = await _context.ImportedInvoices
                .Where(i => i.LoadId == load.Id)
                .ToListAsync();

            foreach (var invoice in linkedInvoices)
            {
                invoice.Status = "Delivered";
                invoice.LastDeliveryDate = DateTime.UtcNow;
                
                // Mark as fully delivered if not already tracked
                if (!invoice.DeliveredQuantity.HasValue || invoice.DeliveredQuantity < invoice.Quantity)
                {
                    invoice.DeliveredQuantity = invoice.Quantity;
                }
            }

            await _context.SaveChangesAsync();

            return Ok(pod);
        }

        // Upload POD file
        [HttpPost("{loadId}/pod")]
        public async Task<IActionResult> UploadPOD(int loadId, [FromForm] IFormFile file, [FromForm] string? notes)
        {
            var load = await _context.Loads.FindAsync(loadId);
            if (load == null)
                return NotFound("Load not found");

            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            // Validate file type
            var allowedExtensions = new[] { ".pdf", ".jpg", ".jpeg", ".png", ".zip" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest("Invalid file type. Allowed types: PDF, JPG, PNG, ZIP");

            // Validate file size (10MB max)
            if (file.Length > 10 * 1024 * 1024)
                return BadRequest("File size exceeds 10MB limit");

            try
            {
                // Create POD uploads directory on NAS
                var uploadsPath = Path.Combine(_nasBasePath, "Logistics", "POD");
                Directory.CreateDirectory(uploadsPath);

                // Generate unique filename with load number
                var fileName = $"{load.LoadNumber}_{DateTime.UtcNow:yyyyMMdd_HHmmss}{extension}";
                var filePath = Path.Combine(uploadsPath, fileName);

                // Save file
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Update or create POD record
                var pod = await _context.ProofOfDeliveries.FirstOrDefaultAsync(p => p.LoadId == loadId);
                if (pod == null)
                {
                    pod = new ProofOfDelivery
                    {
                        LoadId = loadId,
                        DeliveredAt = DateTime.UtcNow
                    };
                    _context.ProofOfDeliveries.Add(pod);
                }

                pod.FilePath = filePath;
                pod.FileName = fileName;
                pod.Notes = notes;
                pod.UploadedAt = DateTime.UtcNow;

                // Update load status to Delivered if not already
                if (load.Status != "Delivered")
                {
                    load.Status = "Delivered";
                    load.ActualDeliveryDate = DateTime.UtcNow;

                    // Update all linked ImportedInvoices to Delivered status
                    var linkedInvoices = await _context.ImportedInvoices
                        .Where(i => i.LoadId == loadId)
                        .ToListAsync();

                    foreach (var invoice in linkedInvoices)
                    {
                        invoice.Status = "Delivered";
                        invoice.LastDeliveryDate = DateTime.UtcNow;
                        
                        // Mark as fully delivered if not already tracked
                        if (!invoice.DeliveredQuantity.HasValue || invoice.DeliveredQuantity < invoice.Quantity)
                        {
                            invoice.DeliveredQuantity = invoice.Quantity;
                        }
                    }
                }

                await _context.SaveChangesAsync();

                return Ok(new { message = "POD uploaded successfully", fileName });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Error uploading POD: {ex.Message}");
            }
        }

        // Get POD file
        [HttpGet("{loadId}/pod")]
        public async Task<IActionResult> GetPOD(int loadId)
        {
            var pod = await _context.ProofOfDeliveries.FirstOrDefaultAsync(p => p.LoadId == loadId);
            if (pod == null || string.IsNullOrEmpty(pod.FilePath))
                return NotFound("POD not found");

            if (!System.IO.File.Exists(pod.FilePath))
                return NotFound("POD file not found on server");

            var fileBytes = await System.IO.File.ReadAllBytesAsync(pod.FilePath);
            var contentType = GetContentType(pod.FilePath);

            return File(fileBytes, contentType);
        }

        // Download POD file
        [HttpGet("{loadId}/pod/download")]
        public async Task<IActionResult> DownloadPOD(int loadId)
        {
            var pod = await _context.ProofOfDeliveries.FirstOrDefaultAsync(p => p.LoadId == loadId);
            if (pod == null || string.IsNullOrEmpty(pod.FilePath))
                return NotFound("POD not found");

            if (!System.IO.File.Exists(pod.FilePath))
                return NotFound("POD file not found on server");

            var fileBytes = await System.IO.File.ReadAllBytesAsync(pod.FilePath);
            var contentType = GetContentType(pod.FilePath);

            return File(fileBytes, contentType, pod.FileName ?? "POD.pdf");
        }

        private static string GetContentType(string path)
        {
            var extension = Path.GetExtension(path).ToLowerInvariant();
            return extension switch
            {
                ".pdf" => "application/pdf",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".zip" => "application/zip",
                _ => "application/octet-stream"
            };
        }

        // Summarise distinct customer names from a load's delivery stops
        // (used when a multi-customer load has no single CustomerId set).
        private static string? SummariseStopCustomers(Load l)
        {
            if (l.Stops == null) return null;
            var names = l.Stops
                .Where(s => !string.Equals(s.StopType, "Pickup", StringComparison.OrdinalIgnoreCase))
                .Select(s => s.Customer?.Name ?? s.CompanyName)
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Select(n => n!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (names.Count == 0) return null;
            if (names.Count == 1) return names[0];
            return $"{names[0]} +{names.Count - 1} more";
        }

        // Helper method to map Load to LoadDto
        private static LoadDto MapToLoadDto(Load l)
        {
            return new LoadDto
            {
                Id = l.Id,
                LoadNumber = l.LoadNumber,
                CustomerId = l.CustomerId,
                CustomerName = l.Customer?.Name ?? SummariseStopCustomers(l),
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
                PodFilePath = l.ProofOfDelivery?.FilePath,
                HasPOD = !string.IsNullOrEmpty(l.ProofOfDelivery?.FilePath),
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
                        Brand = sc.Brand,
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

        #region Stop Address Issues

        /// <summary>
        /// Get stops with missing address or coordinate data
        /// </summary>
        [HttpGet("stop-address-issues")]
        public async Task<ActionResult> GetStopAddressIssues([FromQuery] int? loadId = null)
        {
            var query = _context.LoadStops
                .Include(s => s.Load)
                .Include(s => s.Customer)
                .Where(s => 
                    // Missing coordinates
                    (s.Latitude == null || s.Longitude == null) ||
                    // Missing address
                    string.IsNullOrEmpty(s.Address) ||
                    // Missing city
                    string.IsNullOrEmpty(s.City) ||
                    // Missing province  
                    string.IsNullOrEmpty(s.Province));

            if (loadId.HasValue)
            {
                query = query.Where(s => s.LoadId == loadId.Value);
            }

            var stops = await query
                .OrderByDescending(s => s.CreatedAt)
                .Take(200)
                .Select(s => new StopAddressIssueDto
                {
                    Id = s.Id,
                    LoadId = s.LoadId,
                    LoadNumber = s.Load.LoadNumber,
                    CustomerId = s.CustomerId,
                    CompanyName = s.CompanyName ?? s.LocationName,
                    Address = s.Address,
                    City = s.City,
                    Province = s.Province,
                    Latitude = s.Latitude,
                    Longitude = s.Longitude,
                    StopSequence = s.StopSequence,
                    StopType = s.StopType,
                    HasMissingAddress = string.IsNullOrEmpty(s.Address),
                    HasMissingCity = string.IsNullOrEmpty(s.City),
                    HasMissingProvince = string.IsNullOrEmpty(s.Province),
                    HasMissingCoordinates = s.Latitude == null || s.Longitude == null,
                    // Include customer data if linked
                    CustomerAddress = s.Customer != null ? (s.Customer.DeliveryAddress ?? s.Customer.Address) : null,
                    CustomerCity = s.Customer != null ? (s.Customer.DeliveryCity ?? s.Customer.City) : null,
                    CustomerProvince = s.Customer != null ? (s.Customer.DeliveryProvince ?? s.Customer.Province) : null,
                    CustomerLatitude = s.Customer != null ? s.Customer.Latitude : null,
                    CustomerLongitude = s.Customer != null ? s.Customer.Longitude : null
                })
                .ToListAsync();

            var summary = new
            {
                TotalIssues = stops.Count,
                MissingCoordinates = stops.Count(s => s.HasMissingCoordinates),
                MissingAddress = stops.Count(s => s.HasMissingAddress),
                MissingCity = stops.Count(s => s.HasMissingCity),
                MissingProvince = stops.Count(s => s.HasMissingProvince),
                WithLinkedCustomer = stops.Count(s => s.CustomerId.HasValue)
            };

            return Ok(new { summary, stops });
        }

        /// <summary>
        /// Get AI suggestions for fixing stop address issues
        /// </summary>
        [HttpPost("stop-address-suggestions")]
        public async Task<ActionResult> GetStopAddressSuggestions(
            [FromQuery] int limit = 30,
            [FromServices] ProjectTracker.API.Services.GeminiProvinceService geminiService = null!)
        {
            _logger.LogInformation("Getting AI suggestions for stop address issues. Limit: {Limit}", limit);

            // First, try to match from existing customer database
            var stopsWithIssues = await _context.LoadStops
                .Include(s => s.Customer)
                .Where(s => 
                    s.Latitude == null || s.Longitude == null ||
                    string.IsNullOrEmpty(s.Province))
                .OrderByDescending(s => s.CreatedAt)
                .Take(limit)
                .ToListAsync();

            var suggestions = new List<StopAddressSuggestion>();
            var matchedFromDb = 0;
            var needsAi = new List<LoadStop>();

            foreach (var stop in stopsWithIssues)
            {
                // First try to match from linked customer
                if (stop.CustomerId.HasValue && stop.Customer != null)
                {
                    var customer = stop.Customer;
                    var suggestion = new StopAddressSuggestion
                    {
                        StopId = stop.Id,
                        LoadNumber = "", // Will be filled
                        CompanyName = stop.CompanyName,
                        CurrentAddress = stop.Address,
                        CurrentCity = stop.City,
                        CurrentProvince = stop.Province,
                        Source = "LinkedCustomer"
                    };

                    if ((stop.Latitude == null || stop.Longitude == null) && 
                        customer.Latitude.HasValue && customer.Longitude.HasValue)
                    {
                        suggestion.SuggestedLatitude = (double)customer.Latitude.Value;
                        suggestion.SuggestedLongitude = (double)customer.Longitude.Value;
                    }
                    if (string.IsNullOrEmpty(stop.Province) && 
                        !string.IsNullOrEmpty(customer.DeliveryProvince ?? customer.Province))
                    {
                        suggestion.SuggestedProvince = customer.DeliveryProvince ?? customer.Province;
                    }
                    if (string.IsNullOrEmpty(stop.City) && 
                        !string.IsNullOrEmpty(customer.DeliveryCity ?? customer.City))
                    {
                        suggestion.SuggestedCity = customer.DeliveryCity ?? customer.City;
                    }
                    if (string.IsNullOrEmpty(stop.Address) && 
                        !string.IsNullOrEmpty(customer.DeliveryAddress ?? customer.Address))
                    {
                        suggestion.SuggestedAddress = customer.DeliveryAddress ?? customer.Address;
                    }

                    if (suggestion.HasAnySuggestion)
                    {
                        suggestion.Confidence = 0.95;
                        suggestion.Reasoning = "Matched from linked customer record";
                        suggestions.Add(suggestion);
                        matchedFromDb++;
                        continue;
                    }
                }

                // Try to match by company name to existing customers
                if (!string.IsNullOrEmpty(stop.CompanyName))
                {
                    var matchedCustomer = await _context.LogisticsCustomers
                        .Where(c => c.Status == "Active")
                        .Where(c => c.Name != null && c.Name.ToLower().Contains(stop.CompanyName.ToLower()) ||
                                   (c.ShortName != null && c.ShortName.ToLower().Contains(stop.CompanyName.ToLower())))
                        .FirstOrDefaultAsync();

                    if (matchedCustomer != null)
                    {
                        var suggestion = new StopAddressSuggestion
                        {
                            StopId = stop.Id,
                            LoadNumber = "",
                            CompanyName = stop.CompanyName,
                            CurrentAddress = stop.Address,
                            CurrentCity = stop.City,
                            CurrentProvince = stop.Province,
                            Source = "CustomerNameMatch",
                            MatchedCustomerId = matchedCustomer.Id,
                            MatchedCustomerName = matchedCustomer.Name
                        };

                        if ((stop.Latitude == null || stop.Longitude == null) && 
                            matchedCustomer.Latitude.HasValue && matchedCustomer.Longitude.HasValue)
                        {
                            suggestion.SuggestedLatitude = (double)matchedCustomer.Latitude.Value;
                            suggestion.SuggestedLongitude = (double)matchedCustomer.Longitude.Value;
                        }
                        if (string.IsNullOrEmpty(stop.Province) && 
                            !string.IsNullOrEmpty(matchedCustomer.DeliveryProvince ?? matchedCustomer.Province))
                        {
                            suggestion.SuggestedProvince = matchedCustomer.DeliveryProvince ?? matchedCustomer.Province;
                        }
                        if (string.IsNullOrEmpty(stop.City) && 
                            !string.IsNullOrEmpty(matchedCustomer.DeliveryCity ?? matchedCustomer.City))
                        {
                            suggestion.SuggestedCity = matchedCustomer.DeliveryCity ?? matchedCustomer.City;
                        }
                        if (string.IsNullOrEmpty(stop.Address) && 
                            !string.IsNullOrEmpty(matchedCustomer.DeliveryAddress ?? matchedCustomer.Address))
                        {
                            suggestion.SuggestedAddress = matchedCustomer.DeliveryAddress ?? matchedCustomer.Address;
                        }

                        if (suggestion.HasAnySuggestion)
                        {
                            suggestion.Confidence = 0.8;
                            suggestion.Reasoning = $"Matched by name to customer: {matchedCustomer.Name}";
                            suggestions.Add(suggestion);
                            matchedFromDb++;
                            continue;
                        }
                    }
                }

                // If has coordinates but missing province, queue for AI
                if (stop.Latitude.HasValue && stop.Longitude.HasValue && string.IsNullOrEmpty(stop.Province))
                {
                    needsAi.Add(stop);
                }
            }

            // Get AI suggestions for remaining stops
            if (needsAi.Any() && geminiService != null)
            {
                var aiCustomers = needsAi.Select(s => new ProjectTracker.API.Services.GeminiProvinceService.CustomerAddressInfo
                {
                    CustomerId = s.Id, // Use stop ID
                    CustomerName = s.CompanyName ?? s.LocationName ?? "Unknown",
                    Address = s.Address,
                    City = s.City,
                    Province = s.Province,
                    Latitude = s.Latitude.HasValue ? (double)s.Latitude.Value : null,
                    Longitude = s.Longitude.HasValue ? (double)s.Longitude.Value : null,
                    HasMissingProvince = string.IsNullOrEmpty(s.Province),
                    HasMissingCity = string.IsNullOrEmpty(s.City),
                    HasMissingCoordinates = s.Latitude == null || s.Longitude == null
                }).ToList();

                try
                {
                    var aiResult = await geminiService.GetAddressSuggestions(aiCustomers);
                    foreach (var aiSuggestion in aiResult.Suggestions)
                    {
                        var stop = needsAi.FirstOrDefault(s => s.Id == aiSuggestion.CustomerId);
                        if (stop != null)
                        {
                            suggestions.Add(new StopAddressSuggestion
                            {
                                StopId = stop.Id,
                                LoadNumber = "",
                                CompanyName = stop.CompanyName,
                                CurrentAddress = stop.Address,
                                CurrentCity = stop.City,
                                CurrentProvince = stop.Province,
                                SuggestedProvince = aiSuggestion.SuggestedProvince,
                                SuggestedCity = aiSuggestion.SuggestedCity,
                                SuggestedLatitude = aiSuggestion.SuggestedLatitude,
                                SuggestedLongitude = aiSuggestion.SuggestedLongitude,
                                Confidence = aiSuggestion.Confidence,
                                Reasoning = aiSuggestion.Reasoning ?? "AI suggestion based on coordinates",
                                Source = "GeminiAI"
                            });
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error getting AI suggestions for stops");
                }
            }

            // Fill in load numbers
            var loadIds = suggestions.Select(s => s.StopId).Distinct().ToList();
            var loadLookup = await _context.LoadStops
                .Where(s => loadIds.Contains(s.Id))
                .Include(s => s.Load)
                .ToDictionaryAsync(s => s.Id, s => s.Load.LoadNumber);

            foreach (var suggestion in suggestions)
            {
                if (loadLookup.TryGetValue(suggestion.StopId, out var loadNumber))
                {
                    suggestion.LoadNumber = loadNumber;
                }
            }

            return Ok(new
            {
                success = true,
                totalProcessed = stopsWithIssues.Count,
                matchedFromDatabase = matchedFromDb,
                aiSuggestions = suggestions.Count - matchedFromDb,
                suggestions
            });
        }

        /// <summary>
        /// Apply a suggestion to a stop
        /// </summary>
        [HttpPost("apply-stop-suggestion")]
        public async Task<ActionResult> ApplyStopSuggestion([FromBody] ApplyStopSuggestionRequest request)
        {
            var stop = await _context.LoadStops.FindAsync(request.StopId);
            if (stop == null)
            {
                return NotFound(new { error = "Stop not found" });
            }

            if (!string.IsNullOrEmpty(request.Address))
                stop.Address = request.Address;
            if (!string.IsNullOrEmpty(request.City))
                stop.City = request.City;
            if (!string.IsNullOrEmpty(request.Province))
                stop.Province = request.Province;
            if (request.Latitude.HasValue)
                stop.Latitude = (decimal)request.Latitude.Value;
            if (request.Longitude.HasValue)
                stop.Longitude = (decimal)request.Longitude.Value;

            // Also link to customer if provided
            if (request.CustomerId.HasValue && !stop.CustomerId.HasValue)
            {
                stop.CustomerId = request.CustomerId;
            }

            // Write back address fixes to linked LogisticsCustomer so they persist
            var customerId = stop.CustomerId ?? request.CustomerId;
            if (customerId.HasValue)
            {
                var customer = await _context.LogisticsCustomers.FindAsync(customerId.Value);
                if (customer != null)
                {
                    bool customerChanged = false;
                    if (!string.IsNullOrEmpty(request.City) && (string.IsNullOrEmpty(customer.City) || string.IsNullOrEmpty(customer.DeliveryCity)))
                    {
                        if (string.IsNullOrEmpty(customer.City)) customer.City = request.City;
                        if (string.IsNullOrEmpty(customer.DeliveryCity)) customer.DeliveryCity = request.City;
                        customerChanged = true;
                    }
                    if (!string.IsNullOrEmpty(request.Province) && (string.IsNullOrEmpty(customer.Province) || string.IsNullOrEmpty(customer.DeliveryProvince)))
                    {
                        if (string.IsNullOrEmpty(customer.Province)) customer.Province = request.Province;
                        if (string.IsNullOrEmpty(customer.DeliveryProvince)) customer.DeliveryProvince = request.Province;
                        customerChanged = true;
                    }
                    if (request.Latitude.HasValue && customer.Latitude == null)
                    {
                        customer.Latitude = request.Latitude.Value;
                        customer.Longitude = request.Longitude;
                        customerChanged = true;
                    }
                    if (!string.IsNullOrEmpty(request.Address) && 
                        (string.IsNullOrEmpty(customer.DeliveryAddress) || customer.DeliveryAddress == "Unknown"))
                    {
                        customer.DeliveryAddress = request.Address;
                        customerChanged = true;
                    }
                    if (customerChanged)
                    {
                        customer.UpdatedAt = DateTime.UtcNow;
                        _logger.LogInformation("Updated LogisticsCustomer {Id} ({Name}) from stop suggestion", customer.Id, customer.Name);
                    }
                }
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Applied suggestion to stop {StopId}", stop.Id);

            return Ok(new { success = true, message = $"Updated stop for {stop.CompanyName}" });
        }

        /// <summary>
        /// Bulk fix stops from linked customers
        /// </summary>
        [HttpPost("bulk-fix-stops-from-customers")]
        public async Task<ActionResult> BulkFixStopsFromCustomers()
        {
            var stopsToFix = await _context.LoadStops
                .Include(s => s.Customer)
                .Where(s => s.CustomerId != null && s.Customer != null)
                .Where(s => 
                    (s.Latitude == null && s.Customer!.Latitude != null) ||
                    (s.Longitude == null && s.Customer!.Longitude != null) ||
                    (string.IsNullOrEmpty(s.Province) && !string.IsNullOrEmpty(s.Customer!.Province)) ||
                    (string.IsNullOrEmpty(s.City) && !string.IsNullOrEmpty(s.Customer!.City)))
                .ToListAsync();

            int updated = 0;
            foreach (var stop in stopsToFix)
            {
                var customer = stop.Customer!;
                bool changed = false;

                if (stop.Latitude == null && customer.Latitude.HasValue)
                {
                    stop.Latitude = (decimal)customer.Latitude.Value;
                    changed = true;
                }
                if (stop.Longitude == null && customer.Longitude.HasValue)
                {
                    stop.Longitude = (decimal)customer.Longitude.Value;
                    changed = true;
                }
                if (string.IsNullOrEmpty(stop.Province) && !string.IsNullOrEmpty(customer.DeliveryProvince ?? customer.Province))
                {
                    stop.Province = customer.DeliveryProvince ?? customer.Province;
                    changed = true;
                }
                if (string.IsNullOrEmpty(stop.City) && !string.IsNullOrEmpty(customer.DeliveryCity ?? customer.City))
                {
                    stop.City = (customer.DeliveryCity ?? customer.City)!;
                    changed = true;
                }
                if (string.IsNullOrEmpty(stop.Address) && !string.IsNullOrEmpty(customer.DeliveryAddress ?? customer.Address))
                {
                    stop.Address = (customer.DeliveryAddress ?? customer.Address)!;
                    changed = true;
                }

                if (changed) updated++;
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                totalFixed = updated,
                message = $"Updated {updated} stops from linked customer data"
            });
        }

        /// <summary>
        /// Bulk fix missing provinces on LogisticsCustomers by mapping city names to provinces.
        /// Uses a hard-coded dictionary first, then Gemini AI for unknown cities.
        /// </summary>
        [Authorize]
        [HttpPost("bulk-fix-provinces")]
        public async Task<ActionResult> BulkFixProvinces(
            [FromServices] ProjectTracker.API.Services.GeminiProvinceService geminiService)
        {
            _logger.LogInformation("Starting bulk province fix...");
            var result = await geminiService.BulkFixMissingProvinces();
            return Ok(result);
        }

        #endregion
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

    public class SyncInvoiceStatusesResult
    {
        public bool Success { get; set; }
        public int TotalLoadsProcessed { get; set; }
        public int TotalInvoicesUpdated { get; set; }
        public string? ErrorMessage { get; set; }
        public List<SyncedInvoice> UpdatedInvoices { get; set; } = new();
    }

    public class SyncedInvoice
    {
        public string InvoiceNumber { get; set; } = string.Empty;
        public string LoadNumber { get; set; } = string.Empty;
        public string PreviousStatus { get; set; } = string.Empty;
        public string NewStatus { get; set; } = string.Empty;
    }

    public class StopAddressIssueDto
    {
        public int Id { get; set; }
        public int LoadId { get; set; }
        public string? LoadNumber { get; set; }
        public int? CustomerId { get; set; }
        public string? CompanyName { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public decimal? Latitude { get; set; }
        public decimal? Longitude { get; set; }
        public int StopSequence { get; set; }
        public string? StopType { get; set; }
        public bool HasMissingAddress { get; set; }
        public bool HasMissingCity { get; set; }
        public bool HasMissingProvince { get; set; }
        public bool HasMissingCoordinates { get; set; }
        public string? CustomerAddress { get; set; }
        public string? CustomerCity { get; set; }
        public string? CustomerProvince { get; set; }
        public double? CustomerLatitude { get; set; }
        public double? CustomerLongitude { get; set; }
    }

    public class StopAddressSuggestion
    {
        public int StopId { get; set; }
        public string? LoadNumber { get; set; }
        public string? CompanyName { get; set; }
        public string? CurrentAddress { get; set; }
        public string? CurrentCity { get; set; }
        public string? CurrentProvince { get; set; }
        public string? SuggestedAddress { get; set; }
        public string? SuggestedCity { get; set; }
        public string? SuggestedProvince { get; set; }
        public double? SuggestedLatitude { get; set; }
        public double? SuggestedLongitude { get; set; }
        public double Confidence { get; set; }
        public string? Reasoning { get; set; }
        public string Source { get; set; } = "Unknown"; // LinkedCustomer, CustomerNameMatch, GeminiAI
        public int? MatchedCustomerId { get; set; }
        public string? MatchedCustomerName { get; set; }

        public bool HasAnySuggestion => 
            !string.IsNullOrEmpty(SuggestedAddress) ||
            !string.IsNullOrEmpty(SuggestedCity) ||
            !string.IsNullOrEmpty(SuggestedProvince) ||
            SuggestedLatitude.HasValue ||
            SuggestedLongitude.HasValue;
    }

    public class ApplyStopSuggestionRequest
    {
        public int StopId { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public int? CustomerId { get; set; }
    }
}
