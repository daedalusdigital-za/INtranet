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

        // ------------------------------------------------------------------
        // Stock availability (Sales ↔ Stock hand-off)
        // ------------------------------------------------------------------

        /// <summary>
        /// Item code is the ERP product code prefix of ItemDesc, e.g.
        /// "3002809-I.D BAND PLASTIC" → "3002809". Pharmacare style
        /// "M-HP0-001-LUBRICATING JELLY" → "M-HP0-001" (first three segments).
        /// </summary>
        private static string ExtractItemCode(string? itemDesc)
        {
            if (string.IsNullOrWhiteSpace(itemDesc)) return "";
            var s = itemDesc.Trim();
            // Pharmacare pattern: X-XXX-NNN-description
            var m = System.Text.RegularExpressions.Regex.Match(s, @"^([A-Z]-[A-Z0-9]{2,4}-\d{2,4})-", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (m.Success) return m.Groups[1].Value.ToUpperInvariant();
            var dash = s.IndexOf('-');
            return (dash > 0 ? s[..dash] : s).Trim().ToUpperInvariant();
        }

        private static string ExtractItemName(string? itemDesc)
        {
            if (string.IsNullOrWhiteSpace(itemDesc)) return "";
            var code = ExtractItemCode(itemDesc);
            var s = itemDesc.Trim();
            if (code.Length > 0 && s.StartsWith(code, StringComparison.OrdinalIgnoreCase) && s.Length > code.Length + 1)
                return s[(code.Length + 1)..].Trim();
            return s;
        }

        /// <summary>
        /// Per item code: mapped commodity + stock on hand per warehouse.
        /// Frontend joins this to backorder lines to show Full / Partial / None / Unmapped.
        /// </summary>
        [HttpGet("stock-check")]
        public async Task<IActionResult> StockCheck([FromQuery] string? company = null)
        {
            var q = _context.ImportedBackorders.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(company))
                q = q.Where(b => b.SourceCompany == company.ToUpperInvariant());

            var descs = await q.Select(b => b.ItemDesc).Distinct().ToListAsync();
            var codes = descs.Select(ExtractItemCode).Where(c => c.Length > 0).Distinct().ToList();

            var commodities = await _context.Commodities.AsNoTracking()
                .Where(c => c.Code != null && codes.Contains(c.Code.ToUpper()))
                .Select(c => new { c.Id, Code = c.Code!.ToUpper(), c.Name })
                .ToListAsync();
            var commodityIds = commodities.Select(c => c.Id).ToList();

            var inventory = await _context.WarehouseInventory.AsNoTracking()
                .Where(i => commodityIds.Contains(i.CommodityId))
                .Select(i => new { i.CommodityId, i.WarehouseId, WarehouseName = i.Warehouse!.Name, i.QuantityOnHand })
                .ToListAsync();

            var result = commodities.Select(c =>
            {
                var inv = inventory.Where(i => i.CommodityId == c.Id).ToList();
                return new
                {
                    code = c.Code,
                    commodityId = c.Id,
                    commodityName = c.Name,
                    onHand = inv.Sum(i => i.QuantityOnHand),
                    warehouses = inv.Where(i => i.QuantityOnHand != 0)
                        .Select(i => new { i.WarehouseId, name = i.WarehouseName, qty = i.QuantityOnHand })
                        .OrderByDescending(i => i.qty).ToList()
                };
            }).ToList();

            return Ok(new { items = result, unmappedCodes = codes.Except(commodities.Select(c => c.Code)).ToList() });
        }

        /// <summary>
        /// Distinct backorder item codes with no matching Commodity.Code — the
        /// mapping queue. Each entry is one product that can be created or linked.
        /// </summary>
        [HttpGet("unmapped")]
        public async Task<IActionResult> Unmapped()
        {
            var lines = await _context.ImportedBackorders.AsNoTracking()
                .Select(b => new { b.SourceCompany, b.ItemDesc, b.QtyBackOrder, b.ExtPrice, b.Uom })
                .ToListAsync();

            var knownCodes = (await _context.Commodities.AsNoTracking()
                .Where(c => c.Code != null).Select(c => c.Code!.ToUpper()).ToListAsync()).ToHashSet();

            var queue = lines
                .Select(l => new { l, code = ExtractItemCode(l.ItemDesc) })
                .Where(x => x.code.Length > 0 && !knownCodes.Contains(x.code))
                .GroupBy(x => x.code)
                .Select(g => new
                {
                    code = g.Key,
                    description = g.Select(x => ExtractItemName(x.l.ItemDesc)).Where(n => n.Length > 0).GroupBy(n => n).OrderByDescending(n => n.Count()).First().Key,
                    uom = g.Select(x => x.l.Uom).FirstOrDefault(u => !string.IsNullOrWhiteSpace(u)),
                    companies = g.Select(x => x.l.SourceCompany).Distinct().OrderBy(c => c).ToList(),
                    lines = g.Count(),
                    totalQty = g.Sum(x => x.l.QtyBackOrder),
                    totalValue = g.Sum(x => x.l.ExtPrice)
                })
                .OrderByDescending(x => x.totalValue)
                .ToList();

            return Ok(queue);
        }

        /// <summary>Search commodities to link an unmapped code to.</summary>
        [HttpGet("commodity-search")]
        public async Task<IActionResult> CommoditySearch([FromQuery] string q, [FromQuery] int take = 20)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2) return Ok(Array.Empty<object>());
            var term = q.Trim().ToLower();
            var items = await _context.Commodities.AsNoTracking()
                .Where(c => c.Name.ToLower().Contains(term) || (c.Code != null && c.Code.ToLower().Contains(term)))
                .OrderBy(c => c.Name)
                .Take(Math.Clamp(take, 1, 50))
                .Select(c => new { c.Id, c.Name, c.Code, c.UnitOfMeasure, onHand = c.InventoryRecords.Sum(i => i.QuantityOnHand) })
                .ToListAsync();
            return Ok(items);
        }

        public class MapProductRequest
        {
            public string Code { get; set; } = string.Empty;
            public string? Description { get; set; }
            public string? Uom { get; set; }
            /// <summary>If supplied, link the code to this existing commodity; otherwise create a new one.</summary>
            public int? CommodityId { get; set; }
        }

        /// <summary>
        /// Resolve an unmapped item code: create a new Commodity with that code,
        /// or stamp the code onto an existing commodity that has no code yet.
        /// </summary>
        [HttpPost("map")]
        public async Task<IActionResult> MapProduct([FromBody] MapProductRequest req)
        {
            var code = (req.Code ?? "").Trim().ToUpperInvariant();
            if (code.Length == 0) return BadRequest(new { error = "Code is required." });

            var existing = await _context.Commodities.FirstOrDefaultAsync(c => c.Code != null && c.Code.ToUpper() == code);
            if (existing != null)
                return Conflict(new { error = $"Code {code} is already mapped to '{existing.Name}' (#{existing.Id})." });

            Commodity target;
            if (req.CommodityId.HasValue)
            {
                target = await _context.Commodities.FindAsync(req.CommodityId.Value)
                         ?? throw new InvalidOperationException("Commodity not found");
                if (!string.IsNullOrWhiteSpace(target.Code))
                    return Conflict(new { error = $"'{target.Name}' already has code {target.Code}. Create a new product instead, or clear its code first." });
                target.Code = code;
                target.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                var name = (req.Description ?? "").Trim();
                if (name.Length == 0) return BadRequest(new { error = "Description is required to create a new product." });
                target = new Commodity
                {
                    Code = code,
                    Name = name.Length > 200 ? name[..200] : name,
                    Description = name.Length > 200 ? name : null,
                    Category = "Imported",
                    UnitOfMeasure = string.IsNullOrWhiteSpace(req.Uom) ? null : req.Uom.Trim(),
                    CreatedAt = DateTime.UtcNow
                };
                _context.Commodities.Add(target);
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Backorder product mapping: {Code} -> commodity #{Id} '{Name}' by {User}",
                code, target.Id, target.Name, User.FindFirstValue(ClaimTypes.Email) ?? User.FindFirstValue(ClaimTypes.Name));

            return Ok(new { commodityId = target.Id, code = target.Code, name = target.Name, created = !req.CommodityId.HasValue });
        }
    }
}
