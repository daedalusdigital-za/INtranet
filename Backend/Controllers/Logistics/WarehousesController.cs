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
    public class WarehousesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<WarehousesController> _logger;

        public WarehousesController(ApplicationDbContext context, ILogger<WarehousesController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // Warehouse Endpoints
        [HttpGet]
        public async Task<ActionResult<IEnumerable<WarehouseDto>>> GetWarehouses()
        {
            var warehouses = await _context.Warehouses
                .Select(w => new WarehouseDto
                {
                    Id = w.Id,
                    Name = w.Name,
                    Code = w.Code,
                    Address = w.Address,
                    City = w.City,
                    PostalCode = w.PostalCode,
                    Province = w.Province,
                    Latitude = w.Latitude,
                    Longitude = w.Longitude,
                    ManagerName = w.ManagerName,
                    PhoneNumber = w.PhoneNumber,
                    Email = w.Email,
                    TotalCapacity = w.TotalCapacity,
                    AvailableCapacity = w.AvailableCapacity,
                    Status = w.Status
                })
                .ToListAsync();

            return Ok(warehouses);
        }

        [HttpGet("summary")]
        public async Task<ActionResult<IEnumerable<WarehouseSummaryDto>>> GetWarehouseSummaries()
        {
            // Get all warehouses with their codes
            var warehouseData = await _context.Warehouses
                .Select(w => new
                {
                    w.Id,
                    w.Name,
                    w.Code,
                    Location = w.City ?? w.Province ?? "Unknown",
                    w.ManagerName,
                    w.TotalCapacity,
                    w.AvailableCapacity,
                    w.Status
                })
                .ToListAsync();

            // Get the latest SOH snapshot date
            var latestDate = await _context.StockOnHandSnapshots
                .MaxAsync(s => (DateTime?)s.AsAtDate);

            // Get all SOH data for latest date and group in memory
            var sohLookup = new Dictionary<string, (int Count, decimal Value)>(StringComparer.OrdinalIgnoreCase);
            
            if (latestDate.HasValue)
            {
                var sohItems = await _context.StockOnHandSnapshots
                    .Where(s => s.AsAtDate == latestDate.Value)
                    .Select(s => new { s.Location, s.TotalCostForQOH })
                    .ToListAsync();

                // Group by location prefix (e.g., "KZN 1" -> "KZN")
                foreach (var item in sohItems)
                {
                    var prefix = item.Location.Contains(' ') 
                        ? item.Location.Substring(0, item.Location.IndexOf(' '))
                        : item.Location;
                    
                    if (sohLookup.TryGetValue(prefix, out var existing))
                    {
                        sohLookup[prefix] = (existing.Count + 1, existing.Value + (item.TotalCostForQOH ?? 0));
                    }
                    else
                    {
                        sohLookup[prefix] = (1, item.TotalCostForQOH ?? 0);
                    }
                }
            }

            // Build the result
            var warehouses = warehouseData.Select(w =>
            {
                var soh = !string.IsNullOrEmpty(w.Code) && sohLookup.TryGetValue(w.Code, out var data) 
                    ? data 
                    : (Count: 0, Value: 0m);

                return new WarehouseSummaryDto
                {
                    Id = w.Id,
                    Name = w.Name,
                    Location = w.Location,
                    ManagerName = w.ManagerName,
                    TotalItems = soh.Count,
                    TotalStockValue = soh.Value,
                    CapacityPercent = w.TotalCapacity.HasValue && w.TotalCapacity > 0
                        ? (int)(((w.TotalCapacity - (w.AvailableCapacity ?? 0)) / w.TotalCapacity) * 100)
                        : 0,
                    TotalCapacity = w.TotalCapacity,
                    AvailableCapacity = w.AvailableCapacity,
                    Status = w.Status
                };
            }).ToList();

            return Ok(warehouses);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<WarehouseDto>> GetWarehouse(int id)
        {
            var warehouse = await _context.Warehouses
                .Where(w => w.Id == id)
                .Select(w => new WarehouseDto
                {
                    Id = w.Id,
                    Name = w.Name,
                    Code = w.Code,
                    Address = w.Address,
                    City = w.City,
                    PostalCode = w.PostalCode,
                    Province = w.Province,
                    Latitude = w.Latitude,
                    Longitude = w.Longitude,
                    ManagerName = w.ManagerName,
                    PhoneNumber = w.PhoneNumber,
                    Email = w.Email,
                    TotalCapacity = w.TotalCapacity,
                    AvailableCapacity = w.AvailableCapacity,
                    Status = w.Status
                })
                .FirstOrDefaultAsync();

            if (warehouse == null)
                return NotFound();

            return Ok(warehouse);
        }

        [HttpPost]
        public async Task<ActionResult<WarehouseDto>> CreateWarehouse(CreateWarehouseDto dto)
        {
            var warehouse = new Warehouse
            {
                Name = dto.Name,
                Code = dto.Code,
                Address = dto.Address,
                City = dto.City,
                PostalCode = dto.PostalCode,
                Province = dto.Province,
                Latitude = dto.Latitude,
                Longitude = dto.Longitude,
                ManagerName = dto.ManagerName,
                PhoneNumber = dto.PhoneNumber,
                Email = dto.Email,
                TotalCapacity = dto.TotalCapacity,
                AvailableCapacity = dto.TotalCapacity,
                Status = "Active"
            };

            _context.Warehouses.Add(warehouse);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetWarehouse), new { id = warehouse.Id }, warehouse);
        }

        // Inventory Endpoints
        [HttpGet("{warehouseId}/inventory")]
        public async Task<ActionResult<IEnumerable<WarehouseInventoryDto>>> GetWarehouseInventory(int warehouseId)
        {
            var inventory = await _context.WarehouseInventory
                .Include(i => i.Warehouse)
                .Include(i => i.Commodity)
                .Where(i => i.WarehouseId == warehouseId)
                .Select(i => new WarehouseInventoryDto
                {
                    Id = i.Id,
                    WarehouseId = i.WarehouseId,
                    WarehouseName = i.Warehouse.Name,
                    CommodityId = i.CommodityId,
                    CommodityName = i.Commodity.Name,
                    QuantityOnHand = i.QuantityOnHand,
                    ReorderLevel = i.ReorderLevel,
                    MaximumLevel = i.MaximumLevel,
                    BinLocation = i.BinLocation,
                    LastCountDate = i.LastCountDate,
                    LastRestockDate = i.LastRestockDate
                })
                .ToListAsync();

            return Ok(inventory);
        }

        [HttpGet("inventory")]
        public async Task<ActionResult<IEnumerable<WarehouseInventoryDto>>> GetAllInventory()
        {
            var inventory = await _context.WarehouseInventory
                .Include(i => i.Warehouse)
                .Include(i => i.Commodity)
                .Select(i => new WarehouseInventoryDto
                {
                    Id = i.Id,
                    WarehouseId = i.WarehouseId,
                    WarehouseName = i.Warehouse.Name,
                    CommodityId = i.CommodityId,
                    CommodityName = i.Commodity.Name,
                    QuantityOnHand = i.QuantityOnHand,
                    ReorderLevel = i.ReorderLevel,
                    MaximumLevel = i.MaximumLevel,
                    BinLocation = i.BinLocation,
                    LastCountDate = i.LastCountDate,
                    LastRestockDate = i.LastRestockDate
                })
                .ToListAsync();

            return Ok(inventory);
        }

        [HttpPost("inventory")]
        public async Task<ActionResult<WarehouseInventoryDto>> CreateInventoryItem(CreateWarehouseInventoryDto dto)
        {
            var inventory = new WarehouseInventory
            {
                WarehouseId = dto.WarehouseId,
                CommodityId = dto.CommodityId,
                QuantityOnHand = dto.QuantityOnHand,
                ReorderLevel = dto.ReorderLevel,
                MaximumLevel = dto.MaximumLevel,
                BinLocation = dto.BinLocation,
                LastRestockDate = DateTime.UtcNow
            };

            _context.WarehouseInventory.Add(inventory);
            await _context.SaveChangesAsync();

            return Ok(inventory);
        }

        [HttpPut("inventory/{id}")]
        public async Task<IActionResult> UpdateInventory(int id, UpdateInventoryDto dto)
        {
            var inventory = await _context.WarehouseInventory.FindAsync(id);
            if (inventory == null)
                return NotFound();

            inventory.QuantityOnHand = dto.QuantityOnHand;
            if (dto.ReorderLevel.HasValue) inventory.ReorderLevel = dto.ReorderLevel;
            if (dto.MaximumLevel.HasValue) inventory.MaximumLevel = dto.MaximumLevel;
            if (dto.BinLocation != null) inventory.BinLocation = dto.BinLocation;

            inventory.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Stock Transfer Endpoints
        [HttpGet("stock-transfers")]
        public async Task<ActionResult<IEnumerable<StockTransferDto>>> GetStockTransfers([FromQuery] string? status)
        {
            var query = _context.StockTransfers
                .Include(st => st.FromWarehouse)
                .Include(st => st.ToWarehouse)
                .Include(st => st.Commodity)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(st => st.Status == status);
            }

            var transfers = await query
                .Select(st => new StockTransferDto
                {
                    Id = st.Id,
                    TransferNumber = st.TransferNumber,
                    FromWarehouseId = st.FromWarehouseId,
                    FromWarehouseName = st.FromWarehouse.Name,
                    ToWarehouseId = st.ToWarehouseId,
                    ToWarehouseName = st.ToWarehouse.Name,
                    CommodityId = st.CommodityId,
                    CommodityName = st.Commodity.Name,
                    Quantity = st.Quantity,
                    Status = st.Status,
                    RequestedDate = st.RequestedDate,
                    ShippedDate = st.ShippedDate,
                    ReceivedDate = st.ReceivedDate,
                    RequestedBy = st.RequestedBy,
                    ApprovedBy = st.ApprovedBy,
                    Notes = st.Notes
                })
                .OrderByDescending(st => st.RequestedDate)
                .ToListAsync();

            return Ok(transfers);
        }

        [HttpPost("stock-transfers")]
        public async Task<ActionResult<StockTransferDto>> CreateStockTransfer(CreateStockTransferDto dto)
        {
            // Generate transfer number
            var lastTransfer = await _context.StockTransfers.OrderByDescending(st => st.Id).FirstOrDefaultAsync();
            var transferNumber = $"ST{DateTime.Now:yyyyMMdd}{(lastTransfer?.Id ?? 0) + 1:D4}";

            var transfer = new StockTransfer
            {
                TransferNumber = transferNumber,
                FromWarehouseId = dto.FromWarehouseId,
                ToWarehouseId = dto.ToWarehouseId,
                CommodityId = dto.CommodityId,
                Quantity = dto.Quantity,
                RequestedBy = dto.RequestedBy,
                Notes = dto.Notes,
                Status = "Pending"
            };

            _context.StockTransfers.Add(transfer);
            await _context.SaveChangesAsync();

            return Ok(transfer);
        }

        [HttpPut("stock-transfers/{id}")]
        public async Task<IActionResult> UpdateStockTransfer(int id, UpdateStockTransferDto dto)
        {
            var transfer = await _context.StockTransfers.FindAsync(id);
            if (transfer == null)
                return NotFound();

            if (dto.Status != null) transfer.Status = dto.Status;
            if (dto.ShippedDate.HasValue) transfer.ShippedDate = dto.ShippedDate;
            if (dto.ReceivedDate.HasValue) transfer.ReceivedDate = dto.ReceivedDate;
            if (dto.ApprovedBy != null) transfer.ApprovedBy = dto.ApprovedBy;
            if (dto.Notes != null) transfer.Notes = dto.Notes;

            transfer.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Backorder Endpoints
        [HttpGet("backorders")]
        public async Task<ActionResult<IEnumerable<BackorderDto>>> GetBackorders([FromQuery] string? status)
        {
            var query = _context.Backorders
                .Include(b => b.Inventory)
                .Include(b => b.Customer)
                .AsQueryable();

            if (!string.IsNullOrEmpty(status))
            {
                query = query.Where(b => b.Status == status);
            }

            var backorders = await query
                .Select(b => new BackorderDto
                {
                    Id = b.Id,
                    BackorderNumber = b.BackorderNumber,
                    InventoryId = b.InventoryId,
                    CustomerId = b.CustomerId,
                    CustomerName = b.Customer.Name,
                    QuantityOrdered = b.QuantityOrdered,
                    QuantityFulfilled = b.QuantityFulfilled,
                    Status = b.Status,
                    OrderedDate = b.OrderedDate,
                    ExpectedFulfillmentDate = b.ExpectedFulfillmentDate,
                    FulfilledDate = b.FulfilledDate,
                    Notes = b.Notes
                })
                .OrderByDescending(b => b.OrderedDate)
                .ToListAsync();

            return Ok(backorders);
        }

        [HttpPost("backorders")]
        public async Task<ActionResult<BackorderDto>> CreateBackorder(CreateBackorderDto dto)
        {
            // Generate backorder number
            var lastBackorder = await _context.Backorders.OrderByDescending(b => b.Id).FirstOrDefaultAsync();
            var backorderNumber = $"BO{DateTime.Now:yyyyMMdd}{(lastBackorder?.Id ?? 0) + 1:D4}";

            var backorder = new Backorder
            {
                BackorderNumber = backorderNumber,
                InventoryId = dto.InventoryId,
                CustomerId = dto.CustomerId,
                QuantityOrdered = dto.QuantityOrdered,
                QuantityFulfilled = 0,
                ExpectedFulfillmentDate = dto.ExpectedFulfillmentDate,
                Notes = dto.Notes,
                Status = "Pending"
            };

            _context.Backorders.Add(backorder);
            await _context.SaveChangesAsync();

            return Ok(backorder);
        }

        // Commodity Endpoints
        [HttpGet("commodities")]
        public async Task<ActionResult<IEnumerable<CommodityDto>>> GetCommodities()
        {
            var commodities = await _context.Commodities
                .Select(c => new CommodityDto
                {
                    Id = c.Id,
                    Name = c.Name,
                    Code = c.Code,
                    Description = c.Description,
                    Category = c.Category,
                    UnitWeight = c.UnitWeight,
                    UnitVolume = c.UnitVolume,
                    UnitOfMeasure = c.UnitOfMeasure,
                    RequiresRefrigeration = c.RequiresRefrigeration,
                    IsFragile = c.IsFragile,
                    IsHazardous = c.IsHazardous,
                    HandlingInstructions = c.HandlingInstructions
                })
                .ToListAsync();

            return Ok(commodities);
        }

        [HttpPost("commodities")]
        public async Task<ActionResult<CommodityDto>> CreateCommodity(CreateCommodityDto dto)
        {
            var commodity = new Commodity
            {
                Name = dto.Name,
                Code = dto.Code,
                Description = dto.Description,
                Category = dto.Category,
                UnitWeight = dto.UnitWeight,
                UnitVolume = dto.UnitVolume,
                UnitOfMeasure = dto.UnitOfMeasure,
                RequiresRefrigeration = dto.RequiresRefrigeration,
                IsFragile = dto.IsFragile,
                IsHazardous = dto.IsHazardous,
                HandlingInstructions = dto.HandlingInstructions
            };

            _context.Commodities.Add(commodity);
            await _context.SaveChangesAsync();

            return Ok(commodity);
        }

        // Stock on Hand Snapshots
        /// <summary>
        /// Get SOH snapshots for a warehouse by matching warehouse code to SOH location prefix
        /// </summary>
        [HttpGet("{warehouseId}/soh")]
        public async Task<ActionResult> GetWarehouseSoh(int warehouseId, [FromQuery] DateTime? asAtDate = null)
        {
            var warehouse = await _context.Warehouses.FindAsync(warehouseId);
            if (warehouse == null)
                return NotFound("Warehouse not found");

            // Match SOH locations that start with warehouse code (e.g., KZN matches KZN 1, KZN 2)
            var warehouseCode = warehouse.Code;
            var targetDate = asAtDate?.Date ?? DateTime.Today;

            // Get the most recent snapshot date <= targetDate for this warehouse's locations
            var latestSnapshotDate = await _context.StockOnHandSnapshots
                .Where(s => s.Location.StartsWith(warehouseCode) && s.AsAtDate <= targetDate)
                .MaxAsync(s => (DateTime?)s.AsAtDate);

            if (!latestSnapshotDate.HasValue)
            {
                return Ok(new
                {
                    warehouseId,
                    warehouseName = warehouse.Name,
                    warehouseCode,
                    asAtDate = (DateTime?)null,
                    totalItems = 0,
                    totalQtyOnHand = 0m,
                    totalStockValue = 0m,
                    locations = new List<string>(),
                    items = new List<object>()
                });
            }

            // Get operating company lookup
            var operatingCompanies = await _context.OperatingCompanies
                .ToDictionaryAsync(c => c.OperatingCompanyId, c => c.Name);

            var snapshots = await _context.StockOnHandSnapshots
                .Where(s => s.Location.StartsWith(warehouseCode) && s.AsAtDate == latestSnapshotDate.Value)
                .OrderBy(s => s.Location)
                .ThenBy(s => s.ItemCode)
                .ToListAsync();

            var result = new
            {
                warehouseId,
                warehouseName = warehouse.Name,
                warehouseCode,
                asAtDate = latestSnapshotDate.Value.ToString("yyyy-MM-dd"),
                totalItems = snapshots.Count,
                totalQtyOnHand = snapshots.Sum(s => s.QtyOnHand ?? 0),
                totalStockValue = snapshots.Sum(s => s.TotalCostForQOH ?? 0),
                locations = snapshots.Select(s => s.Location).Distinct().OrderBy(l => l).ToList(),
                items = snapshots.Select(s => new
                {
                    id = s.StockSnapshotId,
                    itemCode = s.ItemCode,
                    itemDescription = s.ItemDescription,
                    location = s.Location,
                    companyName = operatingCompanies.GetValueOrDefault(s.OperatingCompanyId, "Unknown"),
                    uom = s.Uom,
                    qtyOnHand = s.QtyOnHand,
                    qtyOnPO = s.QtyOnPO,
                    qtyOnSO = s.QtyOnSO,
                    stockAvailable = s.StockAvailable,
                    totalCost = s.TotalCostForQOH,
                    unitCost = s.UnitCostForQOH
                }).ToList()
            };

            return Ok(result);
        }

        /// <summary>
        /// Get all SOH snapshots with filtering
        /// </summary>
        [HttpGet("soh")]
        public async Task<ActionResult> GetAllSoh([FromQuery] DateTime? asAtDate = null, [FromQuery] string? location = null)
        {
            var targetDate = asAtDate?.Date ?? DateTime.Today;

            // Get the most recent snapshot date
            var query = _context.StockOnHandSnapshots.AsQueryable();
            
            if (!string.IsNullOrEmpty(location))
            {
                query = query.Where(s => s.Location.StartsWith(location));
            }

            var latestSnapshotDate = await query
                .Where(s => s.AsAtDate <= targetDate)
                .MaxAsync(s => (DateTime?)s.AsAtDate);

            if (!latestSnapshotDate.HasValue)
            {
                return Ok(new
                {
                    asAtDate = (DateTime?)null,
                    totalItems = 0,
                    totalQtyOnHand = 0m,
                    totalStockValue = 0m,
                    items = new List<object>()
                });
            }

            var snapshots = await query
                .Where(s => s.AsAtDate == latestSnapshotDate.Value)
                .OrderBy(s => s.Location)
                .ThenBy(s => s.ItemCode)
                .ToListAsync();

            return Ok(new
            {
                asAtDate = latestSnapshotDate.Value.ToString("yyyy-MM-dd"),
                totalItems = snapshots.Count,
                totalQtyOnHand = snapshots.Sum(s => s.QtyOnHand ?? 0),
                totalStockValue = snapshots.Sum(s => s.TotalCostForQOH ?? 0),
                locations = snapshots.Select(s => s.Location).Distinct().OrderBy(l => l).ToList(),
                items = snapshots.Select(s => new
                {
                    id = s.StockSnapshotId,
                    itemCode = s.ItemCode,
                    itemDescription = s.ItemDescription,
                    location = s.Location,
                    uom = s.Uom,
                    qtyOnHand = s.QtyOnHand,
                    qtyOnPO = s.QtyOnPO,
                    qtyOnSO = s.QtyOnSO,
                    stockAvailable = s.StockAvailable,
                    totalCost = s.TotalCostForQOH,
                    unitCost = s.UnitCostForQOH
                }).ToList()
            });
        }
    }
}
