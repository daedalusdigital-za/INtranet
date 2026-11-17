using System.Text;
using ExcelDataReader;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Imports a warehouse stock-count workbook (CODE | DESCRIPTION | UOM | OPENING | STOCK IN | STOCK OUT | CLOSING)
    /// as a stock take: every listed item's counted figure becomes the system figure (variance posted as an
    /// Adjustment), stock items are created for unknown codes and names/UOM refreshed from the sheet.
    /// Optionally zeroes every other line in the warehouse that the count did not touch (a full count).
    /// </summary>
    [ApiController]
    [Route("api/logistics/stock-take")]
    [Authorize]
    public class StockTakeImportController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<StockTakeImportController> _logger;
        public StockTakeImportController(ApplicationDbContext db, ILogger<StockTakeImportController> logger) { _db = db; _logger = logger; }

        private string CurrentUserName => User.FindFirst("name")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? User.Identity?.Name ?? "system";

        public record CountRow(string Code, string Description, string? Uom, decimal Counted);

        // ═══ POST api/logistics/stock-take/import  (multipart: file, warehouseId, company, dryRun?, reference?) ═══
        [HttpPost("import")]
        [RequestSizeLimit(50_000_000)]
        public async Task<ActionResult<object>> Import([FromForm] IFormFile file, [FromForm] int warehouseId, [FromForm] string company,
            [FromForm] bool dryRun = true, [FromForm] string? reference = null, [FromForm] DateTime? countedAt = null)
        {
            if (!await StockAccess.CanManageAsync(_db, User)) return StatusCode(403, new { message = StockAccess.Denied });
            if (file == null || file.Length == 0) return BadRequest(new { message = "No file" });
            var wh = await _db.Warehouses.FindAsync(warehouseId);
            if (wh == null) return NotFound(new { message = "Warehouse not found" });
            var co = CommodityCodeMatcher.NormalizeCompany(company);
            if (co.Length == 0) return BadRequest(new { message = "company is required (PROMED / ACCESS / SEBENZANI / PHARMACARE)" });

            List<CountRow> rows;
            try { using var s = file.OpenReadStream(); rows = Parse(s); }
            catch (Exception ex) { return BadRequest(new { message = $"Couldn't read {file.FileName}: {ex.Message}" }); }
            if (rows.Count == 0) return BadRequest(new { message = $"No count rows found in {file.FileName}" });

            // Same code listed more than once (e.g. two pack sizes) → one stock item, quantities summed; first description wins.
            var byCode = rows.GroupBy(r => CommodityCodeMatcher.Normalize(r.Code))
                .Select(g => new CountRow(g.First().Code, g.First().Description, g.Select(x => x.Uom).FirstOrDefault(u => !string.IsNullOrWhiteSpace(u)), g.Sum(x => x.Counted)))
                .ToList();

            var map = await CommodityCodeMatcher.BuildAsync(_db, byCode.Select(r => r.Code));
            var when = (countedAt ?? DateTime.UtcNow);
            var reference_ = string.IsNullOrWhiteSpace(reference) ? $"COUNT-{wh.Code}-{co}-{when:yyyyMMdd}" : reference.Trim();
            var reason = $"Full stock count {when:dd MMM yyyy} ({co}, {wh.Name}) from {file.FileName}";

            var created = 0; var matched = 0; var renamed = 0; var adjusted = 0; var confirmed = 0; decimal totalCounted = 0;
            var unmatchedShared = new List<string>();
            var changes = new List<object>();

            using var tx = dryRun ? null : await _db.Database.BeginTransactionAsync();
            try
            {
                foreach (var r in byCode)
                {
                    totalCounted += r.Counted;
                    var id = CommodityCodeMatcher.Match(map, r.Code, co);
                    Commodity? c = null;
                    if (id == null)
                    {
                        // Code exists only under other companies → it's a different product; create ours.
                        if (map.TryGetValue(CommodityCodeMatcher.Normalize(r.Code), out var cands) && cands.Count > 1 && cands.All(x => x.Category != co))
                            unmatchedShared.Add(r.Code);
                        c = new Commodity
                        {
                            Code = r.Code.Trim(),
                            Name = r.Description.Trim(),
                            Description = $"Created from {co} stock count {when:dd MMM yyyy}",
                            Category = co,
                            UnitOfMeasure = string.IsNullOrWhiteSpace(r.Uom) ? "Each" : r.Uom.Trim(),
                            CreatedAt = DateTime.UtcNow
                        };
                        created++;
                        if (!dryRun) { _db.Commodities.Add(c); await _db.SaveChangesAsync(); }
                    }
                    else
                    {
                        matched++;
                        c = await _db.Commodities.FirstAsync(x => x.Id == id.Value);
                        var newName = r.Description.Trim();
                        static string Key(string? s) => System.Text.RegularExpressions.Regex.Replace(s ?? "", @"\s+", " ").Trim().ToUpperInvariant();
                        if (newName.Length > 0 && Key(c.Name) != Key(newName))
                        {
                            renamed++;
                            changes.Add(new { r.Code, from = c.Name, to = newName });
                            if (!dryRun) { c.Name = newName; c.UpdatedAt = DateTime.UtcNow; }
                        }
                        if (!dryRun)
                        {
                            if (!string.IsNullOrWhiteSpace(r.Uom)) c.UnitOfMeasure = r.Uom.Trim();
                            if (string.IsNullOrWhiteSpace(c.Category)) c.Category = co;
                        }
                    }

                    if (dryRun)
                    {
                        var inv = await _db.WarehouseInventory.AsNoTracking().FirstOrDefaultAsync(i => i.WarehouseId == warehouseId && c.Id != 0 && i.CommodityId == c.Id);
                        if ((inv?.QuantityOnHand ?? 0) != r.Counted) adjusted++; else confirmed++;
                        continue;
                    }
                    var mv = await StockLedger.PostCountAsync(_db, warehouseId, c.Id, r.Counted, when, reference_, reason, CurrentUserName);
                    if (mv == null) confirmed++; else adjusted++;
                }
                if (!dryRun) { await _db.SaveChangesAsync(); await tx!.CommitAsync(); }
            }
            catch (Exception ex)
            {
                if (tx != null) await tx.RollbackAsync();
                _logger.LogError(ex, "Stock count import failed for {File}", file.FileName);
                return StatusCode(500, new { message = $"Import failed: {ex.Message}" });
            }

            _logger.LogWarning("Stock count import {File} → {Warehouse}/{Company} by {User}: dryRun={Dry} rows={Rows} created={Created} renamed={Renamed} adjusted={Adj} confirmed={Conf}",
                file.FileName, wh.Code, co, CurrentUserName, dryRun, byCode.Count, created, renamed, adjusted, confirmed);
            return Ok(new
            {
                dryRun, file = file.FileName, warehouse = wh.Name, company = co, reference = reference_,
                rows = rows.Count, items = byCode.Count, totalCounted, matched, created, renamed, adjusted, confirmed,
                codesSharedWithOtherCompanies = unmatchedShared, renames = changes.Take(50)
            });
        }

        // ═══ POST api/logistics/stock-take/zero-uncounted?warehouseId=&countedSince=&dryRun= ═══
        // After a FULL count: every line in the warehouse not counted since <countedSince> that still shows stock is set to 0.
        [HttpPost("zero-uncounted")]
        public async Task<ActionResult<object>> ZeroUncounted([FromQuery] int warehouseId, [FromQuery] DateTime countedSince, [FromQuery] bool dryRun = true, [FromQuery] string? reference = null)
        {
            if (!await StockAccess.CanManageAsync(_db, User)) return StatusCode(403, new { message = StockAccess.Denied });
            var wh = await _db.Warehouses.FindAsync(warehouseId);
            if (wh == null) return NotFound(new { message = "Warehouse not found" });

            var stale = await _db.WarehouseInventory.Include(i => i.Commodity)
                .Where(i => i.WarehouseId == warehouseId && i.QuantityOnHand != 0 && (i.LastCountDate == null || i.LastCountDate < countedSince))
                .ToListAsync();
            var preview = stale.Select(i => new { i.CommodityId, code = i.Commodity?.Code, name = i.Commodity?.Name, qty = i.QuantityOnHand }).ToList();
            if (dryRun) return Ok(new { dryRun, warehouse = wh.Name, lines = stale.Count, totalQty = stale.Sum(i => i.QuantityOnHand), preview = preview.Take(200) });

            var reference_ = string.IsNullOrWhiteSpace(reference) ? $"COUNT-{wh.Code}-ZERO-{DateTime.UtcNow:yyyyMMdd}" : reference.Trim();
            var reason = $"Full stock count {countedSince:dd MMM yyyy}: item not on any count sheet for {wh.Name}";
            using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                foreach (var i in stale)
                    await StockLedger.PostCountAsync(_db, warehouseId, i.CommodityId, 0, DateTime.UtcNow, reference_, reason, CurrentUserName);
                await _db.SaveChangesAsync();
                await tx.CommitAsync();
            }
            catch (Exception ex)
            {
                await tx.RollbackAsync();
                _logger.LogError(ex, "zero-uncounted failed for warehouse {Wh}", warehouseId);
                return StatusCode(500, new { message = ex.Message });
            }
            _logger.LogWarning("Zeroed {N} uncounted lines in {Wh} by {User}", stale.Count, wh.Code, CurrentUserName);
            return Ok(new { dryRun = false, warehouse = wh.Name, zeroed = stale.Count, reference = reference_ });
        }

        /// <summary>First sheet; header row is the one containing "OPENING"; columns fixed A..G.</summary>
        internal static List<CountRow> Parse(Stream file)
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            var rows = new List<object?[]>();
            using (var reader = ExcelReaderFactory.CreateReader(file))
            {
                while (reader.Read())
                {
                    var r = new object?[Math.Max(reader.FieldCount, 7)];
                    for (var i = 0; i < reader.FieldCount; i++) r[i] = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    rows.Add(r);
                }
            }
            var hdr = rows.FindIndex(r => r.Any(c => (c?.ToString() ?? "").ToUpperInvariant().Contains("OPENING")));
            if (hdr < 0) throw new InvalidOperationException("header row with OPENING / STOCK IN / STOCK OUT / CLOSING not found");

            var result = new List<CountRow>();
            foreach (var r in rows.Skip(hdr + 1))
            {
                var code = CodeText(r[0]);
                var desc = (r[1]?.ToString() ?? "").Trim();
                if (code.Length == 0 || desc.Length == 0) continue;
                if (code.Equals("CODE", StringComparison.OrdinalIgnoreCase) || code.Equals("ITEM CODE", StringComparison.OrdinalIgnoreCase)) continue;
                var opening = Num(r[3]); var inQ = Num(r[4]); var outQ = Num(r[5]); var closing = Num(r[6]);
                var counted = closing ?? ((opening ?? 0) + (inQ ?? 0) - (outQ ?? 0));
                result.Add(new CountRow(code, desc, r[2]?.ToString()?.Trim(), counted));
            }
            return result;
        }

        private static string CodeText(object? v) => v switch
        {
            null => "",
            double d => d == Math.Floor(d) ? ((long)d).ToString() : d.ToString(System.Globalization.CultureInfo.InvariantCulture),
            _ => v.ToString()!.Trim()
        };

        private static decimal? Num(object? v)
        {
            if (v == null) return null;
            if (v is double d) return (decimal)d;
            if (v is int i) return i;
            if (v is decimal m) return m;
            var s = v.ToString()!.Trim().Replace(",", "").Replace(" ", "");
            return decimal.TryParse(s, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var x) ? x : null;
        }
    }
}
