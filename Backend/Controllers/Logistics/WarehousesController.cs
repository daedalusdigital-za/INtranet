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
    }
}
