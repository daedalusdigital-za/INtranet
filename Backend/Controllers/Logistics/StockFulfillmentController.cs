using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Controllers.Logistics;

/// <summary>
/// Links sales invoices (ImportedInvoices) to live stock (BuildingInventory)
/// so users can see which invoice demand can be fulfilled from current stock,
/// and reserve / dispatch stock against orders.
///
/// Matching key: ImportedInvoice.ProductCode == BuildingInventory.ItemCode
/// </summary>
[Authorize]
[ApiController]
[Route("api/stock-fulfillment")]
public class StockFulfillmentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<StockFulfillmentController> _logger;

    public StockFulfillmentController(ApplicationDbContext context, ILogger<StockFulfillmentController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // ---------------------------------------------------------------------
    // 1) Stock availability for a single product code (across all buildings)
    // ---------------------------------------------------------------------
    // GET: api/stock-fulfillment/availability/{itemCode}
    [HttpGet("availability/{itemCode}")]
    public async Task<ActionResult<StockAvailabilityDto>> GetAvailability(string itemCode)
    {
        itemCode = (itemCode ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(itemCode))
            return BadRequest("Item code is required.");

        var rows = await _context.BuildingInventory
            .Where(i => i.ItemCode == itemCode)
            .Include(i => i.Building!)
                .ThenInclude(b => b.Warehouse)
            .ToListAsync();

        if (rows.Count == 0)
            return NotFound(new { itemCode, message = "No stock found for this item code." });

        var locations = rows.Select(i => new StockLocationDto
        {
            BuildingId = i.BuildingId,
            BuildingName = i.Building?.Name ?? "",
            WarehouseName = i.Building?.Warehouse?.Name ?? "",
            QuantityOnHand = i.QuantityOnHand,
            QuantityReserved = i.QuantityReserved,
            QuantityAvailable = i.QuantityOnHand - i.QuantityReserved
        }).ToList();

        return Ok(new StockAvailabilityDto
        {
            ItemCode = itemCode,
            ItemDescription = rows.First().ItemDescription,
            Uom = rows.First().Uom,
            TotalOnHand = rows.Sum(r => r.QuantityOnHand),
            TotalReserved = rows.Sum(r => r.QuantityReserved),
            TotalAvailable = rows.Sum(r => r.QuantityOnHand - r.QuantityReserved),
            Locations = locations
        });
    }

    // ---------------------------------------------------------------------
    // 2) Invoice fulfillment analysis
    //    Aggregates outstanding invoice demand per product code and compares
    //    it to total available stock. Shows what can be fully / partially
    //    fulfilled and what is short.
    // ---------------------------------------------------------------------
    // GET: api/stock-fulfillment/analysis?status=Pending&onlyMatched=true
    [HttpGet("analysis")]
    public async Task<ActionResult<FulfillmentAnalysisDto>> GetFulfillmentAnalysis(
        [FromQuery] string status = "Pending",
        [FromQuery] bool onlyMatched = true)
    {
        // Outstanding invoice demand grouped by product code
        var demandQuery = _context.ImportedInvoices
            .Where(inv => inv.ProductCode != null && inv.ProductCode != "");

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
            demandQuery = demandQuery.Where(inv => inv.Status == status);

        var demand = await demandQuery
            .GroupBy(inv => inv.ProductCode)
            .Select(g => new
            {
                ProductCode = g.Key,
                ProductDescription = g.Max(x => x.ProductDescription),
                DemandQty = g.Sum(x => x.Quantity),
                OrderLines = g.Count(),
                Customers = g.Select(x => x.CustomerName).Distinct().Count()
            })
            .ToListAsync();

        // Available stock grouped by item code
        var stock = await _context.BuildingInventory
            .GroupBy(i => i.ItemCode)
            .Select(g => new
            {
                ItemCode = g.Key,
                OnHand = g.Sum(x => x.QuantityOnHand),
                Reserved = g.Sum(x => x.QuantityReserved)
            })
            .ToListAsync();

        var stockMap = stock.ToDictionary(s => s.ItemCode, s => s);

        var lines = new List<FulfillmentLineDto>();
        foreach (var d in demand)
        {
            stockMap.TryGetValue(d.ProductCode!, out var s);
            var available = s == null ? 0m : s.OnHand - s.Reserved;
            var hasStockRecord = s != null;

            if (onlyMatched && !hasStockRecord)
                continue;

            var canFulfill = Math.Min(available, d.DemandQty);
            var shortfall = Math.Max(0, d.DemandQty - available);

            string fulfilStatus;
            if (!hasStockRecord) fulfilStatus = "NoStockRecord";
            else if (available <= 0) fulfilStatus = "OutOfStock";
            else if (shortfall <= 0) fulfilStatus = "CanFulfill";
            else fulfilStatus = "Partial";

            lines.Add(new FulfillmentLineDto
            {
                ProductCode = d.ProductCode!,
                ProductDescription = d.ProductDescription,
                DemandQty = d.DemandQty,
                OrderLines = d.OrderLines,
                Customers = d.Customers,
                AvailableQty = available,
                OnHandQty = s?.OnHand ?? 0,
                CanFulfillQty = canFulfill,
                ShortfallQty = shortfall,
                Status = fulfilStatus
            });
        }

        lines = lines
            .OrderByDescending(l => l.Status == "CanFulfill")
            .ThenByDescending(l => l.DemandQty)
            .ToList();

        var summary = new FulfillmentSummaryDto
        {
            TotalProductCodes = lines.Count,
            FullyFulfillable = lines.Count(l => l.Status == "CanFulfill"),
            PartiallyFulfillable = lines.Count(l => l.Status == "Partial"),
            OutOfStock = lines.Count(l => l.Status == "OutOfStock"),
            NoStockRecord = lines.Count(l => l.Status == "NoStockRecord"),
            TotalDemandQty = lines.Sum(l => l.DemandQty),
            TotalFulfillableQty = lines.Sum(l => l.CanFulfillQty),
            TotalShortfallQty = lines.Sum(l => l.ShortfallQty)
        };

        return Ok(new FulfillmentAnalysisDto
        {
            Status = status,
            Summary = summary,
            Lines = lines
        });
    }

    // ---------------------------------------------------------------------
    // 2b) Invoices behind a single product code (drill-down)
    //     Lists the individual invoices, allocating available stock across
    //     them (oldest first) so each shows Fulfillable / Partial / None.
    // ---------------------------------------------------------------------
    // GET: api/stock-fulfillment/invoices/{itemCode}?status=Pending
    [HttpGet("invoices/{itemCode}")]
    public async Task<ActionResult<ProductInvoicesDto>> GetInvoicesForProduct(
        string itemCode,
        [FromQuery] string status = "Pending")
    {
        itemCode = (itemCode ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(itemCode))
            return BadRequest("Item code is required.");

        var query = _context.ImportedInvoices
            .Where(inv => inv.ProductCode == itemCode);

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
            query = query.Where(inv => inv.Status == status);

        var invoices = await query
            .OrderBy(inv => inv.TransactionDate)
            .Select(inv => new
            {
                inv.Id,
                inv.TransactionNumber,
                inv.TransactionDate,
                inv.CustomerNumber,
                inv.CustomerName,
                inv.Quantity,
                inv.SalesAmount,
                inv.Status
            })
            .ToListAsync();

        // total available stock for this code
        var available = await _context.BuildingInventory
            .Where(i => i.ItemCode == itemCode)
            .SumAsync(i => (decimal?)(i.QuantityOnHand - i.QuantityReserved)) ?? 0m;

        // allocate available across invoices oldest-first
        var remaining = available;
        var lines = new List<ProductInvoiceLineDto>();
        foreach (var inv in invoices)
        {
            var canFulfill = Math.Max(0, Math.Min(inv.Quantity, remaining));
            remaining -= canFulfill;
            string s = canFulfill >= inv.Quantity && inv.Quantity > 0 ? "CanFulfill"
                     : canFulfill > 0 ? "Partial"
                     : "None";
            lines.Add(new ProductInvoiceLineDto
            {
                Id = inv.Id,
                InvoiceNumber = inv.TransactionNumber,
                InvoiceDate = inv.TransactionDate,
                CustomerNumber = inv.CustomerNumber,
                CustomerName = inv.CustomerName,
                DemandQty = inv.Quantity,
                CanFulfillQty = canFulfill,
                ShortfallQty = Math.Max(0, inv.Quantity - canFulfill),
                SalesAmount = inv.SalesAmount,
                Status = s
            });
        }

        return Ok(new ProductInvoicesDto
        {
            ItemCode = itemCode,
            TotalAvailable = available,
            TotalInvoices = lines.Count,
            Invoices = lines
        });
    }

    // ---------------------------------------------------------------------
    // 3) Reserve stock for an order line (increments QuantityReserved)
    [HttpPost("reserve")]
    public async Task<IActionResult> Reserve([FromBody] StockActionDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.ItemCode) || dto.Quantity <= 0)
            return BadRequest("ItemCode and a positive Quantity are required.");

        var rows = await _context.BuildingInventory
            .Where(i => i.ItemCode == dto.ItemCode)
            .OrderByDescending(i => i.QuantityOnHand - i.QuantityReserved)
            .ToListAsync();

        if (rows.Count == 0)
            return NotFound($"No stock found for item code {dto.ItemCode}.");

        var totalAvailable = rows.Sum(r => r.QuantityOnHand - r.QuantityReserved);
        if (totalAvailable < dto.Quantity)
            return BadRequest($"Insufficient available stock. Available: {totalAvailable}, Requested: {dto.Quantity}.");

        // Reserve greedily from the building with the most available stock first
        var remaining = dto.Quantity;
        foreach (var row in rows)
        {
            if (remaining <= 0) break;
            var avail = row.QuantityOnHand - row.QuantityReserved;
            if (avail <= 0) continue;
            var take = Math.Min(avail, remaining);
            row.QuantityReserved += take;
            row.UpdatedAt = DateTime.UtcNow;
            remaining -= take;
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("Reserved {Qty} of {Code} across {N} buildings", dto.Quantity, dto.ItemCode, rows.Count);
        return Ok(new { dto.ItemCode, reserved = dto.Quantity, remainingAvailable = totalAvailable - dto.Quantity });
    }

    // ---------------------------------------------------------------------
    // 4) Dispatch stock for an order line (decrements OnHand and Reserved)
    // ---------------------------------------------------------------------
    // POST: api/stock-fulfillment/dispatch
    [HttpPost("dispatch")]
    public async Task<IActionResult> Dispatch([FromBody] StockActionDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.ItemCode) || dto.Quantity <= 0)
            return BadRequest("ItemCode and a positive Quantity are required.");

        var rows = await _context.BuildingInventory
            .Where(i => i.ItemCode == dto.ItemCode)
            .OrderByDescending(i => i.QuantityOnHand)
            .ToListAsync();

        if (rows.Count == 0)
            return NotFound($"No stock found for item code {dto.ItemCode}.");

        var totalOnHand = rows.Sum(r => r.QuantityOnHand);
        if (totalOnHand < dto.Quantity)
            return BadRequest($"Insufficient stock on hand. On hand: {totalOnHand}, Requested: {dto.Quantity}.");

        var remaining = dto.Quantity;
        foreach (var row in rows)
        {
            if (remaining <= 0) break;
            if (row.QuantityOnHand <= 0) continue;
            var take = Math.Min(row.QuantityOnHand, remaining);
            row.QuantityOnHand -= take;
            // release any reservation we were holding, down to zero
            if (row.QuantityReserved > 0)
                row.QuantityReserved = Math.Max(0, row.QuantityReserved - take);
            row.LastMovementDate = DateTime.UtcNow;
            row.UpdatedAt = DateTime.UtcNow;
            remaining -= take;
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("Dispatched {Qty} of {Code}", dto.Quantity, dto.ItemCode);
        return Ok(new { dto.ItemCode, dispatched = dto.Quantity, remainingOnHand = totalOnHand - dto.Quantity });
    }
}

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------
public class StockAvailabilityDto
{
    public string ItemCode { get; set; } = string.Empty;
    public string? ItemDescription { get; set; }
    public string Uom { get; set; } = "Each";
    public decimal TotalOnHand { get; set; }
    public decimal TotalReserved { get; set; }
    public decimal TotalAvailable { get; set; }
    public List<StockLocationDto> Locations { get; set; } = new();
}

public class StockLocationDto
{
    public int BuildingId { get; set; }
    public string BuildingName { get; set; } = string.Empty;
    public string WarehouseName { get; set; } = string.Empty;
    public decimal QuantityOnHand { get; set; }
    public decimal QuantityReserved { get; set; }
    public decimal QuantityAvailable { get; set; }
}

public class FulfillmentAnalysisDto
{
    public string Status { get; set; } = string.Empty;
    public FulfillmentSummaryDto Summary { get; set; } = new();
    public List<FulfillmentLineDto> Lines { get; set; } = new();
}

public class FulfillmentSummaryDto
{
    public int TotalProductCodes { get; set; }
    public int FullyFulfillable { get; set; }
    public int PartiallyFulfillable { get; set; }
    public int OutOfStock { get; set; }
    public int NoStockRecord { get; set; }
    public decimal TotalDemandQty { get; set; }
    public decimal TotalFulfillableQty { get; set; }
    public decimal TotalShortfallQty { get; set; }
}

public class FulfillmentLineDto
{
    public string ProductCode { get; set; } = string.Empty;
    public string? ProductDescription { get; set; }
    public decimal DemandQty { get; set; }
    public int OrderLines { get; set; }
    public int Customers { get; set; }
    public decimal AvailableQty { get; set; }
    public decimal OnHandQty { get; set; }
    public decimal CanFulfillQty { get; set; }
    public decimal ShortfallQty { get; set; }
    public string Status { get; set; } = string.Empty;
}

public class StockActionDto
{
    public string ItemCode { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string? Reference { get; set; }
}

public class ProductInvoicesDto
{
    public string ItemCode { get; set; } = string.Empty;
    public decimal TotalAvailable { get; set; }
    public int TotalInvoices { get; set; }
    public List<ProductInvoiceLineDto> Invoices { get; set; } = new();
}

public class ProductInvoiceLineDto
{
    public int Id { get; set; }
    public string InvoiceNumber { get; set; } = string.Empty;
    public DateTime InvoiceDate { get; set; }
    public string CustomerNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public decimal DemandQty { get; set; }
    public decimal CanFulfillQty { get; set; }
    public decimal ShortfallQty { get; set; }
    public decimal SalesAmount { get; set; }
    public string Status { get; set; } = string.Empty;
}
