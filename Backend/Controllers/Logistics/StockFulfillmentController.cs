using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Controllers.Logistics;

/// <summary>
/// Links sales invoices (ImportedInvoices) to stock on hand so users can see which invoice demand
/// can be fulfilled from current stock.
///
/// Stock comes from the warehouse stock ledger (WarehouseInventory), the same figures Stock Management,
/// dispatch approval and the Sales back-order badge use. Matching key: ImportedInvoice.ProductCode ==
/// Commodity.Code, ignoring case, spaces and punctuation.
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

    /// <summary>Stock on hand per normalised product code, summed across warehouses.</summary>
    private async Task<Dictionary<string, decimal>> OnHandByCodeAsync()
    {
        var rows = await _context.WarehouseInventory.AsNoTracking()
            .Where(i => i.Commodity.Code != null && i.Commodity.Code != "")
            .Select(i => new { i.Commodity.Code, i.QuantityOnHand })
            .ToListAsync();
        return rows
            .GroupBy(r => CommodityCodeMatcher.Normalize(r.Code))
            .ToDictionary(g => g.Key, g => g.Sum(r => r.QuantityOnHand));
    }

    // ---------------------------------------------------------------------
    // 1) Stock availability for a single product code (across all warehouses)
    // ---------------------------------------------------------------------
    // GET: api/stock-fulfillment/availability/{itemCode}
    [HttpGet("availability/{itemCode}")]
    public async Task<ActionResult<StockAvailabilityDto>> GetAvailability(string itemCode)
    {
        itemCode = (itemCode ?? string.Empty).Trim();
        if (string.IsNullOrEmpty(itemCode))
            return BadRequest("Item code is required.");

        var key = CommodityCodeMatcher.Normalize(itemCode);
        var rows = (await _context.WarehouseInventory.AsNoTracking()
                .Where(i => i.Commodity.Code != null && i.Commodity.Code != "")
                .Select(i => new
                {
                    i.WarehouseId,
                    WarehouseName = i.Warehouse.Name,
                    i.Commodity.Code,
                    i.Commodity.Name,
                    i.Commodity.UnitOfMeasure,
                    i.QuantityOnHand
                })
                .ToListAsync())
            .Where(r => CommodityCodeMatcher.Normalize(r.Code) == key)
            .ToList();

        if (rows.Count == 0)
            return NotFound(new { itemCode, message = "No stock found for this item code." });

        var total = rows.Sum(r => r.QuantityOnHand);
        return Ok(new StockAvailabilityDto
        {
            ItemCode = itemCode,
            ItemDescription = rows.First().Name,
            Uom = rows.First().UnitOfMeasure ?? "Each",
            TotalOnHand = total,
            TotalReserved = 0,
            TotalAvailable = total,
            Locations = rows.Select(r => new StockLocationDto
            {
                WarehouseId = r.WarehouseId,
                WarehouseName = r.WarehouseName ?? "",
                QuantityOnHand = r.QuantityOnHand,
                QuantityReserved = 0,
                QuantityAvailable = r.QuantityOnHand
            }).ToList()
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

        // Stock on hand per product code (warehouse stock ledger)
        var stockMap = await OnHandByCodeAsync();

        var lines = new List<FulfillmentLineDto>();
        foreach (var d in demand)
        {
            var hasStockRecord = stockMap.TryGetValue(CommodityCodeMatcher.Normalize(d.ProductCode), out var onHand);
            var available = hasStockRecord ? onHand : 0m;

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
                OnHandQty = available,
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
        var available = (await OnHandByCodeAsync()).GetValueOrDefault(CommodityCodeMatcher.Normalize(itemCode));

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
    // 3) Reserve / dispatch: retired
    //    These moved a separate building-level stock table that nothing else read, so stock could
    //    leave here without ever leaving the warehouse ledger. Stock now leaves only through
    //    dispatch approval on a load (Stock Management > Approve dispatch).
    // ---------------------------------------------------------------------
    [HttpPost("reserve")]
    public IActionResult Reserve([FromBody] StockActionDto dto) => Gone();

    [HttpPost("dispatch")]
    public IActionResult Dispatch([FromBody] StockActionDto dto) => Gone();

    private ObjectResult Gone() => StatusCode(StatusCodes.Status410Gone, new
    {
        message = "Stock is no longer reserved or dispatched here. Put the order on a load and approve its dispatch in Stock Management."
    });
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
    public int WarehouseId { get; set; }
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
