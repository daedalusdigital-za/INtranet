using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using System.Globalization;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Backorder importer — Admin > Data Import > Backorders.
    /// Accepts the mapped rows from the admin import UI (JSON) and stores them
    /// per company. Each import REPLACES the previous snapshot for that company.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/backorders")]
    public class BackordersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<BackordersController> _logger;

        private static readonly string[] ValidCompanies = { "PMT", "ACM", "PHT", "SBT", "SAW", "KOG" };

        public BackordersController(ApplicationDbContext context, ILogger<BackordersController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>List backorders, optionally for one company.</summary>
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? company = null)
        {
            var q = _context.ImportedBackorders.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(company))
                q = q.Where(b => b.SourceCompany == company.ToUpperInvariant());

            var items = await q
                .OrderBy(b => b.SourceCompany).ThenBy(b => b.OrderDate).ThenBy(b => b.OrderNumber)
                .ToListAsync();
            return Ok(items);
        }

        /// <summary>Per-company counts + totals (drives tab badges).</summary>
        [HttpGet("summary")]
        public async Task<IActionResult> Summary()
        {
            var summary = await _context.ImportedBackorders.AsNoTracking()
                .GroupBy(b => b.SourceCompany)
                .Select(g => new
                {
                    company = g.Key,
                    lines = g.Count(),
                    totalQty = g.Sum(b => b.QtyBackOrder),
                    totalValue = g.Sum(b => b.ExtPrice),
                    lastImportedAt = g.Max(b => b.ImportedAt)
                })
                .ToListAsync();
            return Ok(summary);
        }

        public class BackorderImportRequest
        {
            public string SourceCompany { get; set; } = string.Empty;
            public List<Dictionary<string, object?>> Data { get; set; } = new();
        }

        /// <summary>
        /// Import mapped backorder rows for a company (replaces that company's
        /// existing snapshot). Row keys follow the admin import field names:
        /// orderNumber, orderDate, customerNo, customerName, poNo, itemDesc,
        /// location, uom, qtyBackOrder, unitPrice, extPrice, contract, accountSet.
        /// </summary>
        [HttpPost("import")]
        [RequestSizeLimit(50_000_000)]
        public async Task<IActionResult> Import([FromBody] BackorderImportRequest request)
        {
            var company = (request.SourceCompany ?? "").Trim().ToUpperInvariant();
            if (!ValidCompanies.Contains(company))
                return BadRequest(new { error = $"Unknown company '{request.SourceCompany}'. Valid: {string.Join(", ", ValidCompanies)}" });
            if (request.Data == null || request.Data.Count == 0)
                return BadRequest(new { error = "No rows to import." });

            var batchId = $"BO-{DateTime.UtcNow:yyyyMMddHHmmss}";
            var importedBy = User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name) ?? "unknown";

            string S(Dictionary<string, object?> row, string key)
            {
                var kv = row.FirstOrDefault(k => string.Equals(k.Key, key, StringComparison.OrdinalIgnoreCase));
                return kv.Value?.ToString()?.Trim() ?? "";
            }

            decimal D(Dictionary<string, object?> row, string key)
            {
                var s = S(row, key).Replace("R", "", StringComparison.OrdinalIgnoreCase)
                                   .Replace(",", "").Replace(" ", "");
                return decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var d) ? d : 0m;
            }

            DateTime? Dt(Dictionary<string, object?> row, string key)
            {
                var s = S(row, key);
                if (string.IsNullOrEmpty(s)) return null;
                // Excel serial date number
                if (double.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var serial) && serial > 20000 && serial < 80000)
                    return DateTime.FromOADate(serial);
                var formats = new[] { "yyyy/MM/dd", "yyyy-MM-dd", "dd/MM/yyyy", "MM/dd/yyyy", "d MMMM yyyy" };
                if (DateTime.TryParseExact(s, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
                    return dt;
                return DateTime.TryParse(s, CultureInfo.InvariantCulture, DateTimeStyles.None, out dt) ? dt : null;
            }

            var rows = new List<ImportedBackorder>();
            var skipped = 0;
            foreach (var raw in request.Data)
            {
                var orderNumber = S(raw, "orderNumber");
                var itemDesc = S(raw, "itemDesc");
                if (string.IsNullOrEmpty(orderNumber) && string.IsNullOrEmpty(itemDesc)) { skipped++; continue; }

                var qty = D(raw, "qtyBackOrder");
                var unitPrice = D(raw, "unitPrice");
                var extPrice = D(raw, "extPrice");
                if (extPrice == 0 && unitPrice != 0 && qty != 0) extPrice = Math.Round(unitPrice * qty, 2);

                rows.Add(new ImportedBackorder
                {
                    SourceCompany = company,
                    OrderNumber = orderNumber,
                    OrderDate = Dt(raw, "orderDate"),
                    CustomerNo = S(raw, "customerNo"),
                    CustomerName = S(raw, "customerName"),
                    PoNo = S(raw, "poNo"),
                    ItemDesc = itemDesc,
                    Location = S(raw, "location"),
                    Uom = S(raw, "uom"),
                    QtyBackOrder = qty,
                    UnitPrice = unitPrice,
                    ExtPrice = extPrice,
                    Contract = S(raw, "contract"),
                    AccountSet = S(raw, "accountSet"),
                    ImportBatchId = batchId,
                    ImportedAt = DateTime.UtcNow,
                    ImportedBy = importedBy
                });
            }

            if (rows.Count == 0)
                return BadRequest(new { error = "No valid rows found (every row was missing both Order Number and Item Description)." });

            // Replace the company's previous snapshot
            var removed = await _context.ImportedBackorders
                .Where(b => b.SourceCompany == company)
                .ExecuteDeleteAsync();

            _context.ImportedBackorders.AddRange(rows);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Backorder import {Batch}: {Count} rows for {Company} (replaced {Removed}, skipped {Skipped}) by {User}",
                batchId, rows.Count, company, removed, skipped, importedBy);

            return Ok(new
            {
                success = true,
                imported = rows.Count,
                replaced = removed,
                skipped,
                batchId,
                details = new[]
                {
                    $"{rows.Count} backorder lines imported for {company}",
                    $"{removed} previous lines replaced",
                    skipped > 0 ? $"{skipped} empty rows skipped" : "No rows skipped"
                }
            });
        }

        /// <summary>Delete a company's backorder snapshot.</summary>
        [HttpDelete("company/{company}")]
        public async Task<IActionResult> DeleteCompany(string company)
        {
            var removed = await _context.ImportedBackorders
                .Where(b => b.SourceCompany == company.ToUpperInvariant())
                .ExecuteDeleteAsync();
            return Ok(new { deleted = removed });
        }
    }
}
