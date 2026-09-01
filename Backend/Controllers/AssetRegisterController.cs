using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/asset-register")]
    [Authorize]
    public class AssetRegisterController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IAssetInvoiceMatchingService _matchingService;

        // camelCase so streamed JSON matches the frontend interfaces (and Ok(result))
        private static readonly System.Text.Json.JsonSerializerOptions _sseJson =
            new() { PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase };

        public AssetRegisterController(ApplicationDbContext context, IAssetInvoiceMatchingService matchingService)
        {
            _context = context;
            _matchingService = matchingService;
        }

        // GET api/asset-register/locations
        [HttpGet("locations")]
        public async Task<ActionResult<IEnumerable<object>>> GetLocations()
        {
            var locations = await _context.AssetRegisterLocations
                .AsNoTracking()
                .Select(l => new
                {
                    l.LocationId,
                    l.Region,
                    l.SubLocation,
                    l.DisplayName,
                    l.SourceFile,
                    AssetCount = _context.AssetRegisterItems.Count(i => i.LocationId == l.LocationId && i.IsActive)
                })
                .OrderBy(l => l.Region)
                .ThenBy(l => l.SubLocation)
                .ThenBy(l => l.DisplayName)
                .ToListAsync();

            return Ok(locations);
        }

        // GET api/asset-register/items?region=KZN&subLocation=Main Building&locationId=1&category=Computer&search=dell&assignedTo=John
        [HttpGet("items")]
        public async Task<ActionResult<IEnumerable<object>>> GetItems(
            [FromQuery] string? region = null,
            [FromQuery] string? subLocation = null,
            [FromQuery] int? locationId = null,
            [FromQuery] string? category = null,
            [FromQuery] string? search = null,
            [FromQuery] string? assignedTo = null,
            [FromQuery] bool activeOnly = true)
        {
            var query = _context.AssetRegisterItems
                .AsNoTracking()
                .Include(i => i.Location)
                .AsQueryable();

            if (activeOnly) query = query.Where(i => i.IsActive);
            if (locationId.HasValue) query = query.Where(i => i.LocationId == locationId.Value);
            if (!string.IsNullOrWhiteSpace(region)) query = query.Where(i => i.Location != null && i.Location.Region == region);
            if (!string.IsNullOrWhiteSpace(subLocation)) query = query.Where(i => i.Location != null && i.Location.SubLocation == subLocation);
            if (!string.IsNullOrWhiteSpace(category)) query = query.Where(i => i.Category == category);
            if (!string.IsNullOrWhiteSpace(assignedTo)) query = query.Where(i => i.AssignedTo != null && i.AssignedTo == assignedTo);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                query = query.Where(i =>
                    (i.AssignedTo != null && i.AssignedTo.ToLower().Contains(s)) ||
                    (i.Model != null && i.Model.ToLower().Contains(s)) ||
                    (i.SerialNumber != null && i.SerialNumber.ToLower().Contains(s)) ||
                    (i.Category.ToLower().Contains(s)) ||
                    (i.AssetCode != null && i.AssetCode.ToLower().Contains(s)) ||
                    (i.Manufacturer != null && i.Manufacturer.ToLower().Contains(s)));
            }

            var items = await query
                .OrderBy(i => i.Location!.DisplayName)
                .ThenBy(i => i.AssignedTo)
                .ThenBy(i => i.Category)
                .Select(i => new
                {
                    i.ItemId,
                    i.LocationId,
                    LocationName = i.Location != null ? i.Location.DisplayName : "",
                    Region = i.Location != null ? i.Location.Region : "",
                    SubLocation = i.Location != null ? i.Location.SubLocation : "",
                    i.AssetCode,
                    i.AssignedTo,
                    i.Workstation,
                    i.Category,
                    i.Manufacturer,
                    i.Model,
                    i.SerialNumber,
                    i.Specification,
                    i.InvoiceNumber,
                    i.BookInvoiceId,
                    i.Condition,
                    i.Value,
                    i.MarketValue,
                    i.OwnershipType,
                    i.Notes,
                    i.IsActive
                })
                .ToListAsync();

            return Ok(items);
        }

        // GET api/asset-register/assigned-users
        [HttpGet("assigned-users")]
        public async Task<ActionResult<IEnumerable<string>>> GetAssignedUsers()
        {
            var users = await _context.AssetRegisterItems
                .AsNoTracking()
                .Where(i => i.IsActive && i.AssignedTo != null && i.AssignedTo != "")
                .Select(i => i.AssignedTo!)
                .Distinct()
                .OrderBy(u => u)
                .ToListAsync();
            return Ok(users);
        }

        // GET api/asset-register/summary
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary()
        {
            var byRegion = await _context.AssetRegisterLocations
                .AsNoTracking()
                .GroupJoin(
                    _context.AssetRegisterItems.Where(i => i.IsActive),
                    l => l.LocationId,
                    i => i.LocationId,
                    (l, items) => new { l.Region, AssetCount = items.Count() })
                .GroupBy(x => x.Region)
                .Select(g => new
                {
                    Region = g.Key,
                    LocationCount = g.Count(),
                    AssetCount = g.Sum(x => x.AssetCount)
                })
                .ToListAsync();

            var byCategory = await _context.AssetRegisterItems
                .AsNoTracking()
                .Where(i => i.IsActive)
                .GroupBy(i => i.Category)
                .Select(g => new { Category = g.Key, Count = g.Count() })
                .OrderByDescending(g => g.Count)
                .ToListAsync();

            var totalAssets = await _context.AssetRegisterItems.CountAsync(i => i.IsActive);

            return Ok(new { totalAssets, byRegion, byCategory });
        }

        // GET api/asset-register/items/{id}
        [HttpGet("items/{id}")]
        public async Task<ActionResult<object>> GetItem(int id)
        {
            var item = await _context.AssetRegisterItems
                .AsNoTracking()
                .Include(i => i.Location)
                .Where(i => i.ItemId == id)
                .Select(i => new
                {
                    i.ItemId, i.LocationId,
                    LocationName = i.Location != null ? i.Location.DisplayName : "",
                    Region = i.Location != null ? i.Location.Region : "",
                    SubLocation = i.Location != null ? i.Location.SubLocation : "",
                    i.AssetCode, i.AssignedTo, i.Workstation, i.Category,
                    i.Manufacturer, i.Model, i.SerialNumber, i.Specification,
                    i.InvoiceNumber, i.BookInvoiceId,
                    i.Condition, i.Value, i.MarketValue, i.OwnershipType, i.Notes, i.IsActive, i.CreatedAt, i.UpdatedAt
                })
                .FirstOrDefaultAsync();

            if (item == null) return NotFound();
            return Ok(item);
        }

        // PUT api/asset-register/items/{id}
        [HttpPut("items/{id}")]
        public async Task<IActionResult> UpdateItem(int id, [FromBody] UpdateAssetDto dto)
        {
            var item = await _context.AssetRegisterItems.FindAsync(id);
            if (item == null) return NotFound();

            if (dto.AssignedTo != null) item.AssignedTo = dto.AssignedTo;
            if (dto.Model != null) item.Model = dto.Model;
            if (dto.SerialNumber != null) item.SerialNumber = dto.SerialNumber;
            if (dto.Condition != null) item.Condition = dto.Condition;
            if (dto.Value.HasValue) item.Value = dto.Value.Value < 0 ? null : dto.Value.Value;
            if (dto.MarketValue.HasValue) item.MarketValue = dto.MarketValue.Value < 0 ? null : dto.MarketValue.Value;
            if (dto.Notes != null) item.Notes = dto.Notes;
            if (dto.Category != null) item.Category = dto.Category;
            if (dto.Manufacturer != null) item.Manufacturer = dto.Manufacturer;
            if (dto.InvoiceNumber != null) item.InvoiceNumber = dto.InvoiceNumber;
            if (dto.BookInvoiceId.HasValue) item.BookInvoiceId = dto.BookInvoiceId.Value == 0 ? null : dto.BookInvoiceId.Value;
            if (dto.Workstation != null) item.Workstation = dto.Workstation;
            if (dto.IsActive.HasValue) item.IsActive = dto.IsActive.Value;
            item.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Asset updated" });
        }

        // POST api/asset-register/items
        [HttpPost("items")]
        public async Task<IActionResult> CreateItem([FromBody] CreateAssetDto dto)
        {
            var location = await _context.AssetRegisterLocations.FindAsync(dto.LocationId);
            if (location == null) return BadRequest(new { message = "Location not found" });

            var item = new AssetRegisterItem
            {
                LocationId = dto.LocationId,
                AssetCode = dto.AssetCode,
                AssignedTo = dto.AssignedTo,
                Workstation = dto.Workstation,
                Category = dto.Category,
                Manufacturer = dto.Manufacturer,
                InvoiceNumber = dto.InvoiceNumber,
                BookInvoiceId = dto.BookInvoiceId,
                Model = dto.Model,
                SerialNumber = dto.SerialNumber,
                Specification = dto.Specification,
                Condition = dto.Condition ?? "Not Assessed",
                Value = dto.Value,
                MarketValue = dto.MarketValue,
                OwnershipType = dto.OwnershipType ?? "Assigned",
                Notes = dto.Notes,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.AssetRegisterItems.Add(item);
            await _context.SaveChangesAsync();
            return Ok(new { item.ItemId, message = "Asset created" });
        }

        // DELETE api/asset-register/items/{id}
        [HttpDelete("items/{id}")]
        public async Task<IActionResult> DeleteItem(int id)
        {
            var item = await _context.AssetRegisterItems.FindAsync(id);
            if (item == null) return NotFound();
            item.IsActive = false;
            item.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Asset deactivated" });
        }

        // GET api/asset-register/resolve-invoice?itemId=1&invoiceNumber=INV-123
        // Resolves an asset's invoice to a Books BookInvoice so it can be previewed.
        [HttpGet("resolve-invoice")]
        public async Task<ActionResult<object>> ResolveInvoice(
            [FromQuery] int? itemId = null,
            [FromQuery] string? invoiceNumber = null)
        {
            BookInvoice? invoice = null;

            if (itemId.HasValue)
            {
                var item = await _context.AssetRegisterItems.AsNoTracking()
                    .FirstOrDefaultAsync(i => i.ItemId == itemId.Value);
                if (item != null)
                {
                    if (item.BookInvoiceId.HasValue)
                        invoice = await _context.BookInvoices.FindAsync(item.BookInvoiceId.Value);
                    if (invoice == null && !string.IsNullOrWhiteSpace(item.InvoiceNumber))
                        invoiceNumber = item.InvoiceNumber;
                }
            }

            if (invoice == null && !string.IsNullOrWhiteSpace(invoiceNumber))
            {
                var norm = invoiceNumber.Trim().ToLower();
                invoice = await _context.BookInvoices
                    .Where(b => b.InvoiceNumber != null && b.InvoiceNumber.ToLower() == norm)
                    .OrderByDescending(b => b.CreatedAt)
                    .FirstOrDefaultAsync();
            }

            if (invoice == null)
                return Ok(new { found = false, invoiceNumber });

            return Ok(new
            {
                found = true,
                bookInvoiceId = invoice.Id,
                invoiceNumber = invoice.InvoiceNumber,
                supplierName = invoice.SupplierName,
                total = invoice.Total,
                currency = invoice.Currency,
                invoiceDate = invoice.InvoiceDate,
                status = invoice.Status,
                contentType = invoice.ContentType,
                fileName = invoice.OriginalFileName ?? invoice.FileName
            });
        }

        // GET api/asset-register/match-suppliers
        // Suppliers that have scannable confirmed invoices (for the AI-match filter).
        [HttpGet("match-suppliers")]
        public async Task<ActionResult<IEnumerable<SupplierOption>>> GetMatchSuppliers()
        {
            var suppliers = await _matchingService.GetMatchableSuppliersAsync(HttpContext.RequestAborted);
            return Ok(suppliers);
        }

        // GET api/asset-register/all-suppliers
        // ALL suppliers with confirmed invoices (including scanned images) for manual linking.
        [HttpGet("all-suppliers")]
        public async Task<ActionResult<IEnumerable<SupplierOption>>> GetAllSuppliers()
        {
            var suppliers = await _matchingService.GetAllSuppliersAsync(HttpContext.RequestAborted);
            return Ok(suppliers);
        }

        // GET api/asset-register/invoices-by-supplier?supplier=Makro
        // Returns all confirmed invoices for a supplier (for manual linking dropdowns)
        [HttpGet("invoices-by-supplier")]
        public async Task<ActionResult<IEnumerable<object>>> GetInvoicesBySupplier([FromQuery] string supplier)
        {
            if (string.IsNullOrWhiteSpace(supplier))
                return BadRequest(new { error = "Supplier name required" });

            var invoices = await _context.BookInvoices
                .AsNoTracking()
                .Where(b => b.Status == "Confirmed" && b.SupplierName == supplier)
                .OrderByDescending(b => b.InvoiceDate)
                .Select(b => new
                {
                    bookInvoiceId = b.Id,
                    invoiceNumber = b.InvoiceNumber,
                    supplierName = b.SupplierName,
                    total = b.Total,
                    currency = b.Currency,
                    invoiceDate = b.InvoiceDate,
                    description = b.Description,
                    hasExtractedText = b.ExtractedText != null && b.ExtractedText != "",
                    fileName = b.OriginalFileName ?? b.FileName
                })
                .ToListAsync();

            return Ok(invoices);
        }

        // POST api/asset-register/ai-match-invoices
        // Uses Welly to extract hardware line items from confirmed invoices and
        // suggests quantity-aware, exclusive matches for unmatched assets.
        [HttpPost("ai-match-invoices")]
        public async Task<ActionResult<AssetMatchResult>> AiMatchInvoices([FromBody] AssetMatchRequest request)
        {
            try
            {
                var result = await _matchingService.SuggestMatchesAsync(request, null, HttpContext.RequestAborted);
                return Ok(result);
            }
            catch (OperationCanceledException)
            {
                return StatusCode(499, new { error = "Request cancelled" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to match invoices.", detail = ex.Message });
            }
        }

        // POST api/asset-register/ai-match-invoices-stream
        // Same as above but streams live progress (Server-Sent Events) so the UI
        // can show a determinate progress bar as Welly reads each invoice.
        [HttpPost("ai-match-invoices-stream")]
        public async Task AiMatchInvoicesStream([FromBody] AssetMatchRequest request)
        {
            Response.ContentType = "text/event-stream";
            Response.Headers["Cache-Control"] = "no-cache";
            Response.Headers["Connection"] = "keep-alive";
            Response.Headers["X-Accel-Buffering"] = "no"; // disable proxy buffering (nginx)

            async Task Send(object payload)
            {
                var json = System.Text.Json.JsonSerializer.Serialize(payload, _sseJson);
                await Response.WriteAsync($"data: {json}\n\n");
                await Response.Body.FlushAsync();
            }

            try
            {
                var result = await _matchingService.SuggestMatchesAsync(
                    request,
                    async p => await Send(new { progress = p }),
                    HttpContext.RequestAborted);

                await Send(new { result });
            }
            catch (OperationCanceledException)
            {
                // Client disconnected — nothing more to do.
                return;
            }
            catch (Exception ex)
            {
                await Send(new { error = ex.Message });
            }

            await Response.WriteAsync("data: [DONE]\n\n");
            await Response.Body.FlushAsync();
        }

        // POST api/asset-register/apply-invoice-matches
        // Applies admin-confirmed asset↔invoice links, re-enforcing exclusivity.
        [HttpPost("apply-invoice-matches")]
        public async Task<IActionResult> ApplyInvoiceMatches([FromBody] ApplyMatchRequest request)
        {
            if (request?.Matches == null || request.Matches.Count == 0)
                return BadRequest(new { error = "No matches provided." });

            try
            {
                var result = await _matchingService.ApplyMatchesAsync(request, HttpContext.RequestAborted);
                var valueMsg = result.ValuesApplied > 0
                    ? $" · {result.ValuesApplied} value(s) applied (R{result.TotalBookValueApplied:N2})"
                    : "";
                return Ok(new
                {
                    applied = result.Applied,
                    skipped = result.Skipped,
                    valuesApplied = result.ValuesApplied,
                    totalBookValueApplied = result.TotalBookValueApplied,
                    notes = result.Notes,
                    message = $"{result.Applied} asset(s) linked, {result.Skipped} skipped{valueMsg}."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to apply matches.", detail = ex.Message });
            }
        }

        // POST api/asset-register/backfill-book-values
        // Fills book values on assets already linked to an invoice but missing a value,
        // by re-reading each invoice's line items and matching them to the linked assets.
        [HttpPost("backfill-book-values")]
        public async Task<IActionResult> BackfillBookValues([FromQuery] bool overwrite = false)
        {
            try
            {
                var result = await _matchingService.BackfillBookValuesAsync(overwrite, HttpContext.RequestAborted);
                return Ok(new
                {
                    linkedAssets = result.Applied,
                    valuesApplied = result.ValuesApplied,
                    stillMissing = result.Skipped,
                    totalBookValueApplied = result.TotalBookValueApplied,
                    notes = result.Notes,
                    message = $"{result.ValuesApplied} book value(s) filled (R{result.TotalBookValueApplied:N2}); {result.Skipped} still without a value."
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to backfill book values.", detail = ex.Message });
            }
        }
    }

    public class UpdateAssetDto
    {
        public string? AssignedTo { get; set; }
        public string? Category { get; set; }
        public string? Manufacturer { get; set; }
        public string? InvoiceNumber { get; set; }
        public int? BookInvoiceId { get; set; }
        public string? Model { get; set; }
        public string? SerialNumber { get; set; }
        public string? Workstation { get; set; }
        public string? Condition { get; set; }
        public decimal? Value { get; set; }
        public decimal? MarketValue { get; set; }
        public string? Notes { get; set; }
        public bool? IsActive { get; set; }
    }

    public class CreateAssetDto
    {
        public int LocationId { get; set; }
        public string? AssetCode { get; set; }
        public string? AssignedTo { get; set; }
        public string? Workstation { get; set; }
        public string Category { get; set; } = string.Empty;
        public string? Manufacturer { get; set; }
        public string? InvoiceNumber { get; set; }
        public int? BookInvoiceId { get; set; }
        public string? Model { get; set; }
        public string? SerialNumber { get; set; }
        public string? Specification { get; set; }
        public string? Condition { get; set; }
        public decimal? Value { get; set; }
        public decimal? MarketValue { get; set; }
        public string? OwnershipType { get; set; }
        public string? Notes { get; set; }
    }
}
