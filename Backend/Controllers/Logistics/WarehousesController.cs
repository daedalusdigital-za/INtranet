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

            // Get live inventory from BuildingInventory grouped by warehouse
            var inventoryByWarehouse = await _context.BuildingInventory
                .Include(i => i.Building)
                .GroupBy(i => i.Building.WarehouseId)
                .Select(g => new
                {
                    WarehouseId = g.Key,
                    Count = g.Count(),
                    Value = g.Sum(i => i.QuantityOnHand * i.UnitCost) ?? 0m
                })
                .ToDictionaryAsync(x => x.WarehouseId, x => (x.Count, x.Value));

            // Build the result
            var warehouses = warehouseData.Select(w =>
            {
                var inv = inventoryByWarehouse.TryGetValue(w.Id, out var data) 
                    ? data 
                    : (Count: 0, Value: 0m);

                return new WarehouseSummaryDto
                {
                    Id = w.Id,
                    Name = w.Name,
                    Location = w.Location,
                    ManagerName = w.ManagerName,
                    TotalItems = inv.Count,
                    TotalStockValue = inv.Value,
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

        // Building Inventory Endpoints (Live stock per building)
        /// <summary>
        /// Get live building inventory for a warehouse (all buildings)
        /// </summary>
        [HttpGet("{warehouseId}/building-inventory")]
        public async Task<ActionResult> GetWarehouseBuildingInventory(int warehouseId)
        {
            var warehouse = await _context.Warehouses.FindAsync(warehouseId);
            if (warehouse == null)
                return NotFound("Warehouse not found");

            var buildings = await _context.WarehouseBuildings
                .Where(b => b.WarehouseId == warehouseId)
                .ToListAsync();

            var buildingIds = buildings.Select(b => b.Id).ToList();

            var inventory = await _context.BuildingInventory
                .Where(i => buildingIds.Contains(i.BuildingId))
                .Include(i => i.Building)
                .OrderBy(i => i.Building.Name)
                .ThenBy(i => i.ItemCode)
                .ToListAsync();

            var result = new
            {
                warehouseId,
                warehouseName = warehouse.Name,
                warehouseCode = warehouse.Code,
                totalItems = inventory.Count,
                totalQtyOnHand = inventory.Sum(i => i.QuantityOnHand),
                totalStockValue = inventory.Sum(i => i.QuantityOnHand * i.UnitCost),
                buildings = buildings.Select(b => new { b.Id, b.Code, b.Name }).ToList(),
                items = inventory.Select(i => new
                {
                    id = i.Id,
                    itemCode = i.ItemCode,
                    itemDescription = i.ItemDescription,
                    buildingId = i.BuildingId,
                    buildingName = i.Building.Name,
                    uom = i.Uom,
                    qtyOnHand = i.QuantityOnHand,
                    qtyReserved = i.QuantityReserved,
                    qtyOnOrder = i.QuantityOnOrder,
                    qtyAvailable = i.QuantityAvailable,
                    unitCost = i.UnitCost,
                    totalCost = i.QuantityOnHand * i.UnitCost,
                    binLocation = i.BinLocation,
                    reorderLevel = i.ReorderLevel
                }).ToList()
            };

            return Ok(result);
        }

        /// <summary>
        /// Get all live building inventory with optional building filter
        /// </summary>
        [HttpGet("building-inventory")]
        public async Task<ActionResult> GetAllBuildingInventory([FromQuery] int? buildingId = null)
        {
            var query = _context.BuildingInventory
                .Include(i => i.Building)
                .ThenInclude(b => b.Warehouse)
                .AsQueryable();

            if (buildingId.HasValue)
            {
                query = query.Where(i => i.BuildingId == buildingId.Value);
            }

            var inventory = await query
                .OrderBy(i => i.Building.Warehouse.Name)
                .ThenBy(i => i.Building.Name)
                .ThenBy(i => i.ItemCode)
                .ToListAsync();

            return Ok(new
            {
                totalItems = inventory.Count,
                totalQtyOnHand = inventory.Sum(i => i.QuantityOnHand),
                totalStockValue = inventory.Sum(i => i.QuantityOnHand * i.UnitCost),
                items = inventory.Select(i => new
                {
                    id = i.Id,
                    itemCode = i.ItemCode,
                    itemDescription = i.ItemDescription,
                    buildingId = i.BuildingId,
                    buildingCode = i.Building.Code,
                    buildingName = i.Building.Name,
                    warehouseName = i.Building.Warehouse.Name,
                    uom = i.Uom,
                    qtyOnHand = i.QuantityOnHand,
                    qtyReserved = i.QuantityReserved,
                    qtyOnOrder = i.QuantityOnOrder,
                    qtyAvailable = i.QuantityAvailable,
                    unitCost = i.UnitCost,
                    totalCost = i.QuantityOnHand * i.UnitCost,
                    binLocation = i.BinLocation
                }).ToList()
            });
        }

        // GET: api/warehouses/{warehouseId}/3dview
        // Returns warehouse inventory formatted for 3D visualization (all buildings combined)
        // Uses LIVE BuildingInventory table
        [HttpGet("{warehouseId}/3dview")]
        public async Task<ActionResult<Warehouse3DViewDto>> GetWarehouse3DView(int warehouseId)
        {
            var warehouse = await _context.Warehouses.FindAsync(warehouseId);
            if (warehouse == null)
                return NotFound($"Warehouse with ID {warehouseId} not found");

            // Get buildings for this warehouse
            var buildingIds = await _context.WarehouseBuildings
                .Where(b => b.WarehouseId == warehouseId)
                .Select(b => b.Id)
                .ToListAsync();

            // Query LIVE inventory from BuildingInventory
            var inventoryItems = await _context.BuildingInventory
                .Include(i => i.Building)
                .Where(i => buildingIds.Contains(i.BuildingId))
                .OrderBy(i => i.Building!.Code)
                .ThenBy(i => i.ItemCode)
                .ToListAsync();

            // Arrange items in a grid layout for 3D visualization
            // Skip aisle columns (8, 16, 24) where forklifts travel
            int gridColumns = 20;
            int[] aisleColumns = { 8, 16 }; // Columns reserved for forklift aisles
            int itemIndex = 0;
            int gridPosition = 0; // Actual grid position (including skipped aisles)

            var boxes = inventoryItems.Select(item => {
                // Calculate column, skipping aisle positions
                int col;
                do {
                    col = gridPosition % gridColumns;
                    if (aisleColumns.Contains(col)) {
                        gridPosition++; // Skip aisle column
                    }
                } while (aisleColumns.Contains(col));
                
                int row = (gridPosition / gridColumns) % 15;
                int level = (gridPosition / (gridColumns * 15)) + 1;
                level = Math.Min(level, 3);
                gridPosition++;
                itemIndex++;

                string status;
                var qty = item.QuantityOnHand;
                var available = item.QuantityAvailable;
                var reorder = item.ReorderLevel ?? 10;
                
                if (qty <= 0) status = "Empty";
                else if (available <= 0) status = "Blocked";
                else if (qty <= reorder) status = "LowStock";
                else status = "Active";

                return new Warehouse3DBoxDto
                {
                    Id = $"INV-{item.Id:D4}",
                    Label = item.ItemDescription ?? item.ItemCode,
                    PositionX = col,
                    PositionY = row,
                    StackLevel = level,
                    Status = status,
                    Quantity = (int)item.QuantityOnHand,
                    Sku = item.ItemCode,
                    CommodityName = item.ItemDescription ?? "",
                    BinLocation = item.Building?.Code ?? item.BinLocation ?? ""
                };
            }).ToList();

            return Ok(new Warehouse3DViewDto
            {
                WarehouseId = warehouseId,
                WarehouseName = warehouse.Name,
                Boxes = boxes,
                Config = new Warehouse3DConfigDto
                {
                    GridColumns = gridColumns,
                    GridRows = Math.Max(10, (boxes.Count / gridColumns) + 1),
                    BoxWidth = 1,
                    BoxDepth = 1,
                    BoxHeight = 1,
                    GridSpacing = 0.2m,
                    AisleColumns = aisleColumns // Tell frontend which columns are aisles
                }
            });
        }

        // GET: api/warehouses/{warehouseId}/buildings
        // Returns all buildings for a warehouse with LIVE inventory counts
        [HttpGet("{warehouseId}/buildings")]
        public async Task<ActionResult<IEnumerable<WarehouseBuildingDto>>> GetWarehouseBuildings(int warehouseId)
        {
            var warehouse = await _context.Warehouses.FindAsync(warehouseId);
            if (warehouse == null)
                return NotFound($"Warehouse with ID {warehouseId} not found");

            var buildings = await _context.WarehouseBuildings
                .Where(b => b.WarehouseId == warehouseId && b.IsActive)
                .Select(b => new WarehouseBuildingDto
                {
                    Id = b.Id,
                    WarehouseId = b.WarehouseId,
                    Code = b.Code,
                    Name = b.Name,
                    Address = b.Address,
                    ManagerName = b.ManagerName,
                    PhoneNumber = b.PhoneNumber,
                    TotalCapacity = b.TotalCapacity,
                    AvailableCapacity = b.AvailableCapacity,
                    ItemCount = _context.BuildingInventory.Count(i => i.BuildingId == b.Id)
                })
                .ToListAsync();

            return Ok(buildings);
        }

        // GET: api/warehouses/buildings/{buildingId}/3dview
        // Returns 3D view for a specific building using LIVE inventory
        [HttpGet("buildings/{buildingId}/3dview")]
        public async Task<ActionResult<Warehouse3DViewDto>> GetBuilding3DView(int buildingId)
        {
            var building = await _context.WarehouseBuildings
                .Include(b => b.Warehouse)
                .FirstOrDefaultAsync(b => b.Id == buildingId);

            if (building == null)
                return NotFound($"Building with ID {buildingId} not found");

            // Query LIVE inventory for this specific building
            var inventoryItems = await _context.BuildingInventory
                .Where(i => i.BuildingId == buildingId)
                .OrderBy(i => i.ItemCode)
                .ToListAsync();

            // Skip aisle columns (8, 16) where forklifts travel
            int gridColumns = 20;
            int[] aisleColumns = { 8, 16 };
            int itemIndex = 0;
            int gridPosition = 0;

            var boxes = inventoryItems.Select(item => {
                // Calculate column, skipping aisle positions
                int col;
                do {
                    col = gridPosition % gridColumns;
                    if (aisleColumns.Contains(col)) {
                        gridPosition++;
                    }
                } while (aisleColumns.Contains(col));
                
                int row = (gridPosition / gridColumns) % 15;
                int level = (gridPosition / (gridColumns * 15)) + 1;
                level = Math.Min(level, 3);
                gridPosition++;
                itemIndex++;

                string status;
                var qty = item.QuantityOnHand;
                var available = item.QuantityAvailable;
                var reorder = item.ReorderLevel ?? 10;
                
                if (qty <= 0) status = "Empty";
                else if (available <= 0) status = "Blocked";
                else if (qty <= reorder) status = "LowStock";
                else status = "Active";

                return new Warehouse3DBoxDto
                {
                    Id = $"INV-{item.Id:D4}",
                    Label = item.ItemDescription ?? item.ItemCode,
                    PositionX = col,
                    PositionY = row,
                    StackLevel = level,
                    Status = status,
                    Quantity = (int)item.QuantityOnHand,
                    Sku = item.ItemCode,
                    CommodityName = item.ItemDescription ?? "",
                    BinLocation = item.BinLocation ?? building.Code
                };
            }).ToList();

            return Ok(new Warehouse3DViewDto
            {
                WarehouseId = building.WarehouseId,
                WarehouseName = $"{building.Warehouse?.Name} - {building.Name}",
                Boxes = boxes,
                Config = new Warehouse3DConfigDto
                {
                    GridColumns = gridColumns,
                    GridRows = Math.Max(10, (boxes.Count / gridColumns) + 1),
                    BoxWidth = 1,
                    BoxDepth = 1,
                    BoxHeight = 1,
                    GridSpacing = 0.2m,
                    AisleColumns = aisleColumns
                }
            });
        }
    }
}

