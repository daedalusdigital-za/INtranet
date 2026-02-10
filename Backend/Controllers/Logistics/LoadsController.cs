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
                        var totalPrice = (commodityDto.UnitPrice ?? 0) * commodityDto.Quantity;

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
                            UnitPrice = commodityDto.UnitPrice,
                            TotalPrice = totalPrice,
                            Weight = commodityDto.Weight,
                            Volume = commodityDto.Volume,
                            OrderNumber = commodityDto.OrderNumber,
                            InvoiceNumber = commodityDto.InvoiceNumber,
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
                                CommodityId = commDto.CommodityId ?? 0,  // Default to 0 if no commodity ID provided
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
            var load = await _context.Loads
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                .FirstOrDefaultAsync(l => l.Id == id);
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
        [AllowAnonymous]
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
}
