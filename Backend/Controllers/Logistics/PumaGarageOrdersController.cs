using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using System.Globalization;
using System.Security.Claims;
using System.Text.RegularExpressions;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class PumaGarageOrdersController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PumaGarageOrdersController> _logger;

        public PumaGarageOrdersController(ApplicationDbContext context, ILogger<PumaGarageOrdersController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ── DTOs ──────────────────────────────────────────────────────────
        public class PumaOrderDto
        {
            public int Id { get; set; }
            public string OrderNumber { get; set; } = string.Empty;
            public string? DriverName { get; set; }
            public string? VehicleType { get; set; }
            public string? Registration { get; set; }
            public decimal? Capacity { get; set; }
            public decimal? LitersFilled { get; set; }
            public decimal? Value { get; set; }
            public DateTime? Date { get; set; }
            public string? Period { get; set; }
            public string? Notes { get; set; }
        }

        public class PumaImportRequest
        {
            /// <summary>Raw pasted text (tab- or multi-space separated columns, one order per line).</summary>
            public string Text { get; set; } = string.Empty;
            /// <summary>Optional period label to stamp on imported rows, e.g. "MARCH 2026".</summary>
            public string? Period { get; set; }
            /// <summary>When true, existing rows with the same OrderNumber are updated instead of skipped.</summary>
            public bool Overwrite { get; set; } = true;
        }

        public class PumaImportResult
        {
            public int Imported { get; set; }
            public int Updated { get; set; }
            public int Skipped { get; set; }
            public List<string> Warnings { get; set; } = new();
        }

        // ── List ──────────────────────────────────────────────────────────
        [HttpGet]
        public async Task<ActionResult<IEnumerable<PumaOrderDto>>> GetOrders(
            [FromQuery] string? search = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null,
            [FromQuery] string? period = null)
        {
            var query = _context.PumaGarageOrders.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(period))
                query = query.Where(o => o.Period == period);
            if (fromDate.HasValue)
                query = query.Where(o => o.Date >= fromDate.Value);
            if (toDate.HasValue)
                query = query.Where(o => o.Date <= toDate.Value);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(o =>
                    o.OrderNumber.ToLower().Contains(s) ||
                    (o.DriverName != null && o.DriverName.ToLower().Contains(s)) ||
                    (o.Registration != null && o.Registration.ToLower().Contains(s)) ||
                    (o.VehicleType != null && o.VehicleType.ToLower().Contains(s)));
            }

            var orders = await query
                .OrderByDescending(o => o.Date)
                .ThenByDescending(o => o.Id)
                .Select(o => new PumaOrderDto
                {
                    Id = o.Id,
                    OrderNumber = o.OrderNumber,
                    DriverName = o.DriverName,
                    VehicleType = o.VehicleType,
                    Registration = o.Registration,
                    Capacity = o.Capacity,
                    LitersFilled = o.LitersFilled,
                    Value = o.Value,
                    Date = o.Date,
                    Period = o.Period,
                    Notes = o.Notes
                })
                .ToListAsync();

            return Ok(orders);
        }

        // ── Summary (for stat card + KPIs) ─────────────────────────────────
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary()
        {
            var q = _context.PumaGarageOrders.AsNoTracking();
            var count = await q.CountAsync();
            var totalLitres = count == 0 ? 0m : await q.SumAsync(o => o.LitersFilled ?? 0);
            var totalValue = count == 0 ? 0m : await q.SumAsync(o => o.Value ?? 0);
            DateTime? dateMin = count == 0 ? null : await q.MinAsync(o => o.Date);
            DateTime? dateMax = count == 0 ? null : await q.MaxAsync(o => o.Date);

            return Ok(new
            {
                Count = count,
                TotalLitres = totalLitres,
                TotalValue = totalValue,
                DateMin = dateMin,
                DateMax = dateMax
            });
        }

        // ── Create one ─────────────────────────────────────────────────────
        [HttpPost]
        public async Task<ActionResult<PumaOrderDto>> Create([FromBody] PumaOrderDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.OrderNumber))
                return BadRequest(new { message = "Order number is required." });

            var order = new PumaGarageOrder
            {
                OrderNumber = dto.OrderNumber.Trim(),
                DriverName = dto.DriverName?.Trim(),
                VehicleType = dto.VehicleType?.Trim(),
                Registration = dto.Registration?.Trim(),
                Capacity = dto.Capacity,
                LitersFilled = dto.LitersFilled,
                Value = dto.Value,
                Date = dto.Date,
                Period = dto.Period?.Trim(),
                Notes = dto.Notes?.Trim(),
                CreatedByUserId = GetUserId(),
                CreatedAt = DateTime.UtcNow
            };

            _context.PumaGarageOrders.Add(order);
            await _context.SaveChangesAsync();

            await SyncFuelTransactionAsync(order);
            await _context.SaveChangesAsync();

            dto.Id = order.Id;
            return Ok(dto);
        }

        // ── Bulk paste import ──────────────────────────────────────────────
        [HttpPost("import")]
        public async Task<ActionResult<PumaImportResult>> Import([FromBody] PumaImportRequest req)
        {
            var result = new PumaImportResult();
            if (string.IsNullOrWhiteSpace(req.Text))
                return BadRequest(new { message = "No text provided to import." });

            var userId = GetUserId();
            var lines = req.Text.Replace("\r\n", "\n").Replace("\r", "\n").Split('\n');

            // Pre-load existing order numbers for upsert.
            var existing = await _context.PumaGarageOrders
                .ToDictionaryAsync(o => o.OrderNumber.ToUpperInvariant(), o => o);

            foreach (var raw in lines)
            {
                var line = raw?.Trim() ?? "";
                if (string.IsNullOrWhiteSpace(line)) continue;

                // Skip header rows / title rows.
                var upper = line.ToUpperInvariant();
                if (upper.Contains("ORDER NUMBER") || upper.Contains("PUMA GARAGE") || upper.Contains("ROCKET FREIGHT"))
                    continue;

                // Split on tabs first; fall back to runs of 2+ spaces.
                var cols = line.Contains('\t')
                    ? line.Split('\t')
                    : Regex.Split(line, "\\s{2,}");
                cols = cols.Select(c => c.Trim()).ToArray();

                if (cols.Length == 0 || string.IsNullOrWhiteSpace(cols[0])) continue;

                var orderNumber = cols[0].Trim();
                // Only treat rows whose first cell looks like an order ref (e.g. ROCF092).
                if (!Regex.IsMatch(orderNumber, "^[A-Za-z]{2,}\\d+$"))
                {
                    result.Warnings.Add($"Skipped line (unrecognised order number): '{line}'");
                    result.Skipped++;
                    continue;
                }

                // Rows with only an order number (blank entries in the sheet) are skipped.
                if (cols.Length < 2 || cols.Skip(1).All(string.IsNullOrWhiteSpace))
                {
                    result.Skipped++;
                    continue;
                }

                string? Get(int i) => i < cols.Length && !string.IsNullOrWhiteSpace(cols[i]) ? cols[i].Trim() : null;

                var driver = Get(1);
                var vehicleType = Get(2);
                var registration = Get(3);
                var capacity = ParseNumber(Get(4));
                var liters = ParseNumber(Get(5));
                var value = ParseCurrency(Get(6));
                var date = ParseDate(Get(7));

                if (existing.TryGetValue(orderNumber.ToUpperInvariant(), out var found))
                {
                    if (!req.Overwrite) { result.Skipped++; continue; }
                    found.DriverName = driver;
                    found.VehicleType = vehicleType;
                    found.Registration = registration;
                    found.Capacity = capacity;
                    found.LitersFilled = liters;
                    found.Value = value;
                    found.Date = date;
                    if (!string.IsNullOrWhiteSpace(req.Period)) found.Period = req.Period.Trim();
                    found.UpdatedAt = DateTime.UtcNow;
                    result.Updated++;
                }
                else
                {
                    var order = new PumaGarageOrder
                    {
                        OrderNumber = orderNumber,
                        DriverName = driver,
                        VehicleType = vehicleType,
                        Registration = registration,
                        Capacity = capacity,
                        LitersFilled = liters,
                        Value = value,
                        Date = date,
                        Period = req.Period?.Trim(),
                        CreatedByUserId = userId,
                        CreatedAt = DateTime.UtcNow
                    };
                    _context.PumaGarageOrders.Add(order);
                    existing[orderNumber.ToUpperInvariant()] = order;
                    result.Imported++;
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Puma Garage import: {Imported} new, {Updated} updated, {Skipped} skipped",
                result.Imported, result.Updated, result.Skipped);

            // Mirror every affected order into Fuel History (Source = PUMA) and link vehicles.
            var affected = existing.Values.Where(o => o.LitersFilled.HasValue || o.Value.HasValue).ToList();
            foreach (var o in affected)
                await SyncFuelTransactionAsync(o);
            await _context.SaveChangesAsync();

            return Ok(result);
        }

        // ── Update ─────────────────────────────────────────────────────────
        [HttpPut("{id:int}")]
        public async Task<ActionResult> Update(int id, [FromBody] PumaOrderDto dto)
        {
            var order = await _context.PumaGarageOrders.FirstOrDefaultAsync(o => o.Id == id);
            if (order == null) return NotFound();

            order.OrderNumber = string.IsNullOrWhiteSpace(dto.OrderNumber) ? order.OrderNumber : dto.OrderNumber.Trim();
            order.DriverName = dto.DriverName?.Trim();
            order.VehicleType = dto.VehicleType?.Trim();
            order.Registration = dto.Registration?.Trim();
            order.Capacity = dto.Capacity;
            order.LitersFilled = dto.LitersFilled;
            order.Value = dto.Value;
            order.Date = dto.Date;
            order.Period = dto.Period?.Trim();
            order.Notes = dto.Notes?.Trim();
            order.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            await SyncFuelTransactionAsync(order);
            await _context.SaveChangesAsync();
            return Ok(dto);
        }

        // ── Delete ─────────────────────────────────────────────────────────
        [HttpDelete("{id:int}")]
        public async Task<ActionResult> Delete(int id)
        {
            var order = await _context.PumaGarageOrders.FirstOrDefaultAsync(o => o.Id == id);
            if (order == null) return NotFound();

            // Remove the mirrored Fuel History row too.
            var key = "PUMA:" + order.OrderNumber;
            var mirrored = await _context.FuelTransactions.Where(f => f.TfnTransactionId == key).ToListAsync();
            if (mirrored.Count > 0) _context.FuelTransactions.RemoveRange(mirrored);

            _context.PumaGarageOrders.Remove(order);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ── Parsing helpers ────────────────────────────────────────────────
        private int? GetUserId()
        {
            var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return int.TryParse(idStr, out var id) ? id : (int?)null;
        }

        /// <summary>Normalise a registration for matching: uppercase, strip spaces/dashes.</summary>
        private static string NormalizeReg(string? reg) =>
            (reg ?? string.Empty).ToUpperInvariant().Replace(" ", "").Replace("-", "").Trim();

        /// <summary>
        /// Create or update a matching Fuel History row (Source = PUMA) for a Puma order,
        /// keyed by "PUMA:{OrderNumber}", and link the vehicle by registration when possible.
        /// Rows without a usable date, litres and value are skipped (blank sheet rows).
        /// </summary>
        private async Task SyncFuelTransactionAsync(PumaGarageOrder order)
        {
            var key = "PUMA:" + order.OrderNumber;
            var existing = await _context.FuelTransactions.FirstOrDefaultAsync(f => f.TfnTransactionId == key);

            // Not enough to be a real fill-up → make sure any stale mirror is removed.
            if (!order.Date.HasValue || (!order.LitersFilled.HasValue && !order.Value.HasValue))
            {
                if (existing != null) _context.FuelTransactions.Remove(existing);
                return;
            }

            // Try to link the vehicle by registration.
            int? vehicleId = null;
            var normReg = NormalizeReg(order.Registration);
            if (normReg.Length >= 4)
            {
                var vehicle = await _context.Vehicles
                    .FirstOrDefaultAsync(v => v.RegistrationNumber.ToUpper()
                        .Replace(" ", "").Replace("-", "") == normReg);
                vehicleId = vehicle?.Id;
            }

            var date = order.Date.Value;
            var assignment = string.IsNullOrWhiteSpace(order.VehicleType)
                ? "PUMA"
                : $"PUMA - {order.VehicleType.Trim().ToUpperInvariant()}";

            if (existing == null)
            {
                _context.FuelTransactions.Add(new FuelTransaction
                {
                    TfnTransactionId = key,
                    Source = "PUMA",
                    RegistrationNumber = string.IsNullOrWhiteSpace(order.Registration) ? "N/A" : order.Registration.Trim(),
                    VehicleId = vehicleId,
                    DepotName = "Puma Garage - Bronkhorstspruit",
                    AllocationLitres = order.Capacity ?? 0,
                    LitresUsed = order.LitersFilled ?? 0,
                    AmountSpent = order.Value ?? 0,
                    TransactionDate = date,
                    DepotAssignment = assignment,
                    ReportMonth = date.Month,
                    ReportYear = date.Year,
                    Notes = $"Puma order {order.OrderNumber}" + (order.DriverName != null ? $" · {order.DriverName}" : ""),
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                existing.Source = "PUMA";
                existing.RegistrationNumber = string.IsNullOrWhiteSpace(order.Registration) ? "N/A" : order.Registration.Trim();
                existing.VehicleId = vehicleId;
                existing.AllocationLitres = order.Capacity ?? 0;
                existing.LitresUsed = order.LitersFilled ?? 0;
                existing.AmountSpent = order.Value ?? 0;
                existing.TransactionDate = date;
                existing.DepotAssignment = assignment;
                existing.ReportMonth = date.Month;
                existing.ReportYear = date.Year;
                existing.Notes = $"Puma order {order.OrderNumber}" + (order.DriverName != null ? $" · {order.DriverName}" : "");
            }
        }

        /// <summary>Parse a plain number that may use a comma decimal and spaces (e.g. "182,25").</summary>
        private static decimal? ParseNumber(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            var cleaned = s.Replace(" ", "").Replace("\u00A0", "").Replace(",", ".");
            // Keep only digits, dot and minus.
            cleaned = Regex.Replace(cleaned, "[^0-9.\\-]", "");
            if (string.IsNullOrEmpty(cleaned) || cleaned == "-" || cleaned == ".") return null;
            return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : (decimal?)null;
        }

        /// <summary>Parse SA currency like "R3 790,85" or "R422,70" into a decimal.</summary>
        private static decimal? ParseCurrency(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            var cleaned = s.Replace("R", "", StringComparison.OrdinalIgnoreCase)
                           .Replace(" ", "").Replace("\u00A0", "").Trim();
            // SA format: space/dot thousands, comma decimal -> normalise comma to dot.
            cleaned = cleaned.Replace(",", ".");
            // If there are multiple dots, keep the last as decimal separator.
            var lastDot = cleaned.LastIndexOf('.');
            if (lastDot >= 0)
            {
                var intPart = cleaned.Substring(0, lastDot).Replace(".", "");
                var decPart = cleaned.Substring(lastDot + 1);
                cleaned = intPart + "." + decPart;
            }
            cleaned = Regex.Replace(cleaned, "[^0-9.\\-]", "");
            if (string.IsNullOrEmpty(cleaned)) return null;
            return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? v : (decimal?)null;
        }

        /// <summary>Parse a date in dd.MM.yyyy (and a few common fallbacks).</summary>
        private static DateTime? ParseDate(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return null;
            var formats = new[] { "dd.MM.yyyy", "d.M.yyyy", "dd/MM/yyyy", "d/M/yyyy", "yyyy-MM-dd", "dd-MM-yyyy" };
            if (DateTime.TryParseExact(s.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
                return dt;
            return DateTime.TryParse(s.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt2) ? dt2 : (DateTime?)null;
        }
    }
}
