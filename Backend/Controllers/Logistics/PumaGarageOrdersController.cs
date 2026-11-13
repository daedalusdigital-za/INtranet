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
            public int? VehicleId { get; set; }
            public int? DriverId { get; set; }
            /// <summary>Full name of the linked driver record, when linked.</summary>
            public string? LinkedDriverName { get; set; }
            public decimal? Capacity { get; set; }
            public decimal? LitersFilled { get; set; }
            public decimal? Value { get; set; }
            public DateTime? Date { get; set; }
            public string? Period { get; set; }
            public string? Notes { get; set; }
            public string Status { get; set; } = "Open";
            public bool HasSlip { get; set; }
            public string? SlipFileName { get; set; }
            public DateTime? SlipUploadedAt { get; set; }
            public DateTime? ClosedAt { get; set; }
            public string? ClosedByName { get; set; }
            public DateTime CreatedAt { get; set; }
        }

        private static PumaOrderDto ToDto(PumaGarageOrder o, IReadOnlyDictionary<int, string>? driverNames = null) => new PumaOrderDto
        {
            Id = o.Id,
            OrderNumber = o.OrderNumber,
            DriverName = o.DriverName,
            VehicleType = o.VehicleType,
            Registration = o.Registration,
            VehicleId = o.VehicleId,
            DriverId = o.DriverId,
            LinkedDriverName = o.DriverId.HasValue && driverNames != null && driverNames.TryGetValue(o.DriverId.Value, out var dn) ? dn : null,
            Capacity = o.Capacity,
            LitersFilled = o.LitersFilled,
            Value = o.Value,
            Date = o.Date,
            Period = o.Period,
            Notes = o.Notes,
            Status = string.IsNullOrWhiteSpace(o.Status) ? "Open" : o.Status,
            HasSlip = !string.IsNullOrWhiteSpace(o.SlipStoredFileName),
            SlipFileName = o.SlipFileName,
            SlipUploadedAt = o.SlipUploadedAt,
            ClosedAt = o.ClosedAt,
            ClosedByName = o.ClosedByName,
            CreatedAt = o.CreatedAt
        };

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
            [FromQuery] string? period = null,
            [FromQuery] string? status = null)
        {
            var query = _context.PumaGarageOrders.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(o => o.Status == status);
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

            var driverNames = await DriverNamesAsync();
            var orders = (await query
                .OrderBy(o => o.Status == "Open" ? 0 : 1)
                .ThenByDescending(o => o.Date)
                .ThenByDescending(o => o.Id)
                .ToListAsync())
                .Select(o => ToDto(o, driverNames))
                .ToList();

            return Ok(orders);
        }

        // ── Summary (for stat card + KPIs) ─────────────────────────────────
        [HttpGet("summary")]
        public async Task<ActionResult<object>> GetSummary()
        {
            var q = _context.PumaGarageOrders.AsNoTracking();
            var count = await q.CountAsync();
            var openCount = await q.CountAsync(o => o.Status == "Open");
            var totalLitres = count == 0 ? 0m : await q.SumAsync(o => o.LitersFilled ?? 0);
            var totalValue = count == 0 ? 0m : await q.SumAsync(o => o.Value ?? 0);
            DateTime? dateMin = count == 0 ? null : await q.MinAsync(o => o.Date);
            DateTime? dateMax = count == 0 ? null : await q.MaxAsync(o => o.Date);

            return Ok(new
            {
                Count = count,
                OpenCount = openCount,
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

            var number = dto.OrderNumber.Trim();
            if (await _context.PumaGarageOrders.AnyAsync(o => o.OrderNumber == number))
                return Conflict(new { message = $"Order {number} already exists." });

            var order = new PumaGarageOrder
            {
                OrderNumber = number,
                DriverName = dto.DriverName?.Trim(),
                VehicleType = dto.VehicleType?.Trim(),
                Registration = dto.Registration?.Trim(),
                VehicleId = dto.VehicleId,
                DriverId = dto.DriverId,
                Capacity = dto.Capacity,
                LitersFilled = dto.LitersFilled,
                Value = dto.Value,
                Date = dto.Date ?? DateTime.Today,
                Period = dto.Period?.Trim(),
                Notes = dto.Notes?.Trim(),
                Status = "Open",
                CreatedByUserId = GetUserId(),
                CreatedAt = DateTime.UtcNow
            };

            await ResolveLinksAsync(order);
            _context.PumaGarageOrders.Add(order);
            await _context.SaveChangesAsync();

            await SyncFuelTransactionAsync(order);
            await _context.SaveChangesAsync();

            return Ok(ToDto(order, await DriverNamesAsync()));
        }

        // ── Quick capture from the WhatsApp-style text the garage sends ──
        public class PumaQuickRequest
        {
            /// <summary>
            /// e.g.
            /// Order number:642
            /// Driver : VUSi
            /// REG: DM 00 TV ZN
            /// LITRES: 500 LT
            /// Several orders may be pasted one after another.
            /// </summary>
            public string Text { get; set; } = string.Empty;
        }

        /// <summary>Parse the "Order number / Driver / REG / LITRES" message blocks into draft orders (no save).</summary>
        [HttpPost("parse")]
        public ActionResult<IEnumerable<PumaOrderDto>> Parse([FromBody] PumaQuickRequest req)
        {
            return Ok(ParseQuickText(req.Text));
        }

        /// <summary>Create Open orders from pasted "Order number / Driver / REG / LITRES" blocks.</summary>
        [HttpPost("quick")]
        public async Task<ActionResult<object>> Quick([FromBody] PumaQuickRequest req)
        {
            var drafts = ParseQuickText(req.Text);
            if (drafts.Count == 0)
                return BadRequest(new { message = "Could not find an 'Order number:' line in the text." });

            var userId = GetUserId();
            var created = new List<PumaOrderDto>();
            var skipped = new List<string>();
            foreach (var d in drafts)
            {
                if (await _context.PumaGarageOrders.AnyAsync(o => o.OrderNumber == d.OrderNumber))
                {
                    skipped.Add(d.OrderNumber);
                    continue;
                }
                var order = new PumaGarageOrder
                {
                    OrderNumber = d.OrderNumber,
                    DriverName = d.DriverName,
                    Registration = d.Registration,
                    VehicleType = d.VehicleType,
                    Capacity = d.Capacity,
                    LitersFilled = d.LitersFilled,
                    Date = DateTime.Today,
                    Status = "Open",
                    CreatedByUserId = userId,
                    CreatedAt = DateTime.UtcNow
                };
                await ResolveLinksAsync(order);
                _context.PumaGarageOrders.Add(order);
                await _context.SaveChangesAsync();
                await SyncFuelTransactionAsync(order);
                created.Add(ToDto(order, await DriverNamesAsync()));
            }
            await _context.SaveChangesAsync();
            return Ok(new { created, skipped });
        }

        private static List<PumaOrderDto> ParseQuickText(string? text)
        {
            var result = new List<PumaOrderDto>();
            if (string.IsNullOrWhiteSpace(text)) return result;

            PumaOrderDto? current = null;
            foreach (var raw in text.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n'))
            {
                var line = raw.Trim();
                if (line.Length == 0) continue;
                var m = Regex.Match(line, @"^\s*([A-Za-z][A-Za-z ]*?)\s*[:\-]\s*(.*)$");
                if (!m.Success) continue;
                var key = Regex.Replace(m.Groups[1].Value.ToUpperInvariant(), @"\s+", " ").Trim();
                var val = m.Groups[2].Value.Trim();

                if (key.StartsWith("ORDER"))
                {
                    if (current != null && !string.IsNullOrWhiteSpace(current.OrderNumber)) result.Add(current);
                    current = new PumaOrderDto { OrderNumber = val.Replace("#", "").Trim(), Status = "Open" };
                    continue;
                }
                if (current == null) continue;

                if (key.StartsWith("DRIVER")) current.DriverName = val;
                else if (key.StartsWith("REG")) current.Registration = Regex.Replace(val.ToUpperInvariant(), @"\s+", " ");
                else if (key.StartsWith("LIT") || key.StartsWith("LTR") || key.StartsWith("QTY")) current.LitersFilled = ParseNumber(val);
                else if (key.StartsWith("VEHICLE") || key.StartsWith("TRUCK")) current.VehicleType = val;
                else if (key.StartsWith("CAP")) current.Capacity = ParseNumber(val);
                else if (key.StartsWith("VALUE") || key.StartsWith("AMOUNT") || key.StartsWith("TOTAL")) current.Value = ParseCurrency(val);
            }
            if (current != null && !string.IsNullOrWhiteSpace(current.OrderNumber)) result.Add(current);
            return result;
        }

        // ── Slip proof (jpg/png photo of the filled slip) ────────────────
        private static readonly string[] SlipExtensions = { ".jpg", ".jpeg", ".png" };
        private string SlipFolder => Path.Combine(Directory.GetCurrentDirectory(), "uploads", "puma-slips");

        [HttpPost("{id:int}/slip")]
        [RequestSizeLimit(25_000_000)]
        public async Task<ActionResult<PumaOrderDto>> UploadSlip(int id, [FromForm] IFormFile file)
        {
            var order = await _context.PumaGarageOrders.FirstOrDefaultAsync(o => o.Id == id);
            if (order == null) return NotFound();
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "Choose a photo of the slip (JPG or PNG)." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var isImageType = file.ContentType.Equals("image/jpeg", StringComparison.OrdinalIgnoreCase)
                           || file.ContentType.Equals("image/png", StringComparison.OrdinalIgnoreCase);
            if (!SlipExtensions.Contains(ext) || !isImageType)
                return BadRequest(new { message = "Only JPG or PNG photos of the slip are accepted." });

            // Sniff the magic bytes so a renamed file can't slip through.
            using (var s = file.OpenReadStream())
            {
                var head = new byte[8];
                var n = await s.ReadAsync(head, 0, head.Length);
                var isJpeg = n >= 3 && head[0] == 0xFF && head[1] == 0xD8 && head[2] == 0xFF;
                var isPng = n >= 8 && head[0] == 0x89 && head[1] == 0x50 && head[2] == 0x4E && head[3] == 0x47;
                if (!isJpeg && !isPng)
                    return BadRequest(new { message = "That file is not a real JPG/PNG image." });
            }

            Directory.CreateDirectory(SlipFolder);
            // Replace any previous slip.
            if (!string.IsNullOrWhiteSpace(order.SlipStoredFileName))
            {
                var old = Path.Combine(SlipFolder, order.SlipStoredFileName);
                if (System.IO.File.Exists(old)) { try { System.IO.File.Delete(old); } catch { } }
            }

            var stored = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{ext}";
            await using (var fs = new FileStream(Path.Combine(SlipFolder, stored), FileMode.Create))
                await file.CopyToAsync(fs);

            order.SlipFileName = Path.GetFileName(file.FileName);
            order.SlipStoredFileName = stored;
            order.SlipContentType = file.ContentType;
            order.SlipUploadedAt = DateTime.UtcNow;
            order.SlipUploadedByUserId = GetUserId();
            order.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Puma order {Order}: slip uploaded ({File})", order.OrderNumber, order.SlipFileName);
            return Ok(ToDto(order, await DriverNamesAsync()));
        }

        [HttpGet("{id:int}/slip")]
        public async Task<IActionResult> GetSlip(int id)
        {
            var order = await _context.PumaGarageOrders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == id);
            if (order == null || string.IsNullOrWhiteSpace(order.SlipStoredFileName)) return NotFound();
            var path = Path.Combine(SlipFolder, order.SlipStoredFileName);
            if (!System.IO.File.Exists(path)) return NotFound(new { message = "Slip file is missing on the server." });
            return PhysicalFile(path, order.SlipContentType ?? "image/jpeg");
        }

        public class PumaCloseRequest
        {
            /// <summary>Litres actually filled per the slip (optional; overrides the ordered litres).</summary>
            public decimal? LitersFilled { get; set; }
            public decimal? Value { get; set; }
            public string? Notes { get; set; }
        }

        /// <summary>Close the order. Refused until the slip photo has been uploaded.</summary>
        [HttpPost("{id:int}/close")]
        public async Task<ActionResult<PumaOrderDto>> Close(int id, [FromBody] PumaCloseRequest? req)
        {
            var order = await _context.PumaGarageOrders.FirstOrDefaultAsync(o => o.Id == id);
            if (order == null) return NotFound();
            if (order.Status == "Closed") return Ok(ToDto(order, await DriverNamesAsync()));
            if (string.IsNullOrWhiteSpace(order.SlipStoredFileName))
                return BadRequest(new { message = "Upload a photo of the filled slip (JPG/PNG) before closing this order." });

            if (req?.LitersFilled.HasValue == true) order.LitersFilled = req.LitersFilled;
            if (req?.Value.HasValue == true) order.Value = req.Value;
            if (!string.IsNullOrWhiteSpace(req?.Notes)) order.Notes = req.Notes.Trim();

            order.Status = "Closed";
            order.ClosedAt = DateTime.UtcNow;
            order.ClosedByUserId = GetUserId();
            order.ClosedByName = User.FindFirstValue(ClaimTypes.Name) ?? User.Identity?.Name;
            order.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await SyncFuelTransactionAsync(order);
            await _context.SaveChangesAsync();
            return Ok(ToDto(order, await DriverNamesAsync()));
        }

        [HttpPost("{id:int}/reopen")]
        public async Task<ActionResult<PumaOrderDto>> Reopen(int id)
        {
            var order = await _context.PumaGarageOrders.FirstOrDefaultAsync(o => o.Id == id);
            if (order == null) return NotFound();
            order.Status = "Open";
            order.ClosedAt = null;
            order.ClosedByUserId = null;
            order.ClosedByName = null;
            order.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(ToDto(order, await DriverNamesAsync()));
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
                        // Monthly sheet rows are already-completed fills reconciled by the garage.
                        Status = (liters.HasValue && value.HasValue) ? "Closed" : "Open",
                        ClosedAt = (liters.HasValue && value.HasValue) ? DateTime.UtcNow : null,
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

            // Mirror every affected order into Fuel History (Source = PUMA) and link vehicles/drivers.
            var affected = existing.Values.Where(o => o.LitersFilled.HasValue || o.Value.HasValue).ToList();
            foreach (var o in affected)
            {
                await ResolveLinksAsync(o);
                await SyncFuelTransactionAsync(o);
            }
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
            // Explicit ids win; otherwise re-resolve from the (possibly changed) registration / name.
            order.VehicleId = dto.VehicleId;
            order.DriverId = dto.DriverId;
            order.Capacity = dto.Capacity;
            order.LitersFilled = dto.LitersFilled;
            order.Value = dto.Value;
            order.Date = dto.Date;
            order.Period = dto.Period?.Trim();
            order.Notes = dto.Notes?.Trim();
            order.UpdatedAt = DateTime.UtcNow;

            await ResolveLinksAsync(order);
            await _context.SaveChangesAsync();
            await SyncFuelTransactionAsync(order);
            await _context.SaveChangesAsync();
            return Ok(ToDto(order, await DriverNamesAsync()));
        }

        /// <summary>Re-run driver/vehicle matching across all orders (fills gaps only; never overwrites an existing link).</summary>
        [HttpPost("relink")]
        public async Task<ActionResult<object>> Relink()
        {
            var orders = await _context.PumaGarageOrders.ToListAsync();
            int vehicles = 0, drivers = 0;
            var unmatched = new List<string>();
            foreach (var o in orders)
            {
                var hadV = o.VehicleId.HasValue; var hadD = o.DriverId.HasValue;
                await ResolveLinksAsync(o);
                if (!hadV && o.VehicleId.HasValue) vehicles++;
                if (!hadD && o.DriverId.HasValue) drivers++;
                if (!o.DriverId.HasValue && !string.IsNullOrWhiteSpace(o.DriverName)) unmatched.Add($"{o.OrderNumber}: {o.DriverName}");
                await SyncFuelTransactionAsync(o);
            }
            await _context.SaveChangesAsync();
            return Ok(new { vehiclesLinked = vehicles, driversLinked = drivers, driversUnmatched = unmatched });
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

            if (!string.IsNullOrWhiteSpace(order.SlipStoredFileName))
            {
                var p = Path.Combine(SlipFolder, order.SlipStoredFileName);
                if (System.IO.File.Exists(p)) { try { System.IO.File.Delete(p); } catch { } }
            }

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

        private async Task<Dictionary<int, string>> DriverNamesAsync() =>
            await _context.Drivers.AsNoTracking()
                .ToDictionaryAsync(d => d.Id, d => $"{d.FirstName} {d.LastName}".Replace(" -", "").Trim());

        /// <summary>
        /// Link the order to a fleet vehicle (by registration) and a driver record (by name, using the
        /// vehicle's assigned driver to break ties). Fills in vehicle type / tank size from the fleet
        /// when the order has none. Existing links are kept; only gaps are filled.
        /// </summary>
        private async Task ResolveLinksAsync(PumaGarageOrder order)
        {
            Vehicle? vehicle = null;
            if (order.VehicleId.HasValue)
                vehicle = await _context.Vehicles.Include(v => v.VehicleType).AsNoTracking().FirstOrDefaultAsync(v => v.Id == order.VehicleId.Value);
            if (vehicle == null)
            {
                var normReg = NormalizeReg(order.Registration);
                if (normReg.Length >= 4)
                {
                    // Prefer the vehicle that has a driver assigned when the fleet list has duplicates of a reg.
                    var candidates = await _context.Vehicles.Include(v => v.VehicleType).AsNoTracking()
                        .Where(v => v.RegistrationNumber.ToUpper().Replace(" ", "").Replace("-", "") == normReg)
                        .ToListAsync();
                    vehicle = candidates.OrderByDescending(v => v.CurrentDriverId.HasValue).ThenBy(v => v.Id).FirstOrDefault();
                }
                order.VehicleId = vehicle?.Id;
            }
            if (vehicle != null)
            {
                if (string.IsNullOrWhiteSpace(order.VehicleType) && vehicle.VehicleType != null) order.VehicleType = vehicle.VehicleType.Name;
                if (!order.Capacity.HasValue && vehicle.TankSize.HasValue) order.Capacity = vehicle.TankSize;
            }

            if (order.DriverId.HasValue || string.IsNullOrWhiteSpace(order.DriverName)) return;

            // Tokenise the free-text name ("MFUNDO CELE", "MIKE/PATRICK") and match whole words against driver names.
            var tokens = Regex.Split(order.DriverName.ToUpperInvariant(), @"[^A-Z]+")
                .Where(t => t.Length >= 3).Distinct().ToList();
            if (tokens.Count == 0) return;

            var drivers = await _context.Drivers.AsNoTracking()
                .Select(d => new { d.Id, d.FirstName, d.LastName, d.Status }).ToListAsync();

            // First choice: the driver assigned to this vehicle, if the written name plausibly refers to them
            // ("SBO" on Sbongiseni's truck, "BHEKA" on Bhekizitha's, "PATRICK" for Patric).
            if (vehicle?.CurrentDriverId != null)
            {
                var cur = drivers.FirstOrDefault(d => d.Id == vehicle.CurrentDriverId);
                if (cur != null)
                {
                    var curWords = Regex.Split(($"{cur.FirstName} {cur.LastName}").ToUpperInvariant(), @"[^A-Z]+").Where(w => w.Length > 0).ToList();
                    if (tokens.Any(t => curWords.Any(w => w.StartsWith(t) || t.StartsWith(w) || FuzzyWord(t, w) || CommonPrefix(t, w) >= 4)))
                    {
                        order.DriverId = cur.Id;
                        return;
                    }
                }
            }
            // Exact whole-word hits score 2; near-misses (nickname prefix "VUSI"→VUSIMUZI, spelling
            // "MABHENA"→MABENA, "GAZA"→GASA, "DOVELA"→NDOVELA) score 1.
            var scored = drivers.Select(d =>
            {
                var words = Regex.Split(($"{d.FirstName} {d.LastName}").ToUpperInvariant(), @"[^A-Z]+").Where(w => w.Length > 0).ToList();
                int score = 0;
                foreach (var t in tokens)
                {
                    if (words.Contains(t)) score += 2;
                    else if (words.Any(w => FuzzyWord(t, w))) score += 1;
                }
                return new { d.Id, d.Status, Score = score };
            }).Where(x => x.Score > 0).ToList();
            if (scored.Count == 0) return;

            var best = scored.Max(x => x.Score);
            var top = scored.Where(x => x.Score == best).ToList();
            if (top.Count > 1 && vehicle?.CurrentDriverId != null && top.Any(x => x.Id == vehicle.CurrentDriverId))
                top = top.Where(x => x.Id == vehicle.CurrentDriverId).ToList();
            if (top.Count > 1 && top.Count(x => x.Status == "Active") == 1)
                top = top.Where(x => x.Status == "Active").ToList();
            // Several records for the same person (duplicate entries) → take the one assigned to the vehicle, else lowest id.
            if (top.Count > 1)
            {
                var names = top.Select(x => drivers.First(d => d.Id == x.Id)).Select(d => $"{d.FirstName} {d.LastName}".ToUpperInvariant()).Distinct().Count();
                if (names == 1) top = top.OrderBy(x => x.Id).Take(1).ToList();
            }
            if (top.Count == 1) order.DriverId = top[0].Id;
        }

        private static int CommonPrefix(string a, string b)
        {
            int n = 0;
            while (n < a.Length && n < b.Length && a[n] == b[n]) n++;
            return n;
        }

        /// <summary>
        /// Loose word match for driver nicknames and spellings: one word is a prefix of the other
        /// (min 4 chars, e.g. VUSI/VUSIMUZI, PATRIC/PATRICK), or the two words are within a Levenshtein
        /// distance of 1 (MABHENA/MABENA, GAZA/GASA), or one is the other with a leading letter dropped
        /// (DOVELA/NDOVELA). Short tokens (&lt;4) never fuzzy-match to avoid false positives.
        /// </summary>
        private static bool FuzzyWord(string a, string b)
        {
            if (a.Length < 4 || b.Length < 4) return false;
            if (a.StartsWith(b) || b.StartsWith(a)) return true;
            if (a.Length > 1 && a.Substring(1) == b) return true;
            if (b.Length > 1 && b.Substring(1) == a) return true;
            if (Math.Abs(a.Length - b.Length) > 1) return false;
            // Levenshtein ≤ 1
            int i = 0, j = 0, edits = 0;
            while (i < a.Length && j < b.Length)
            {
                if (a[i] == b[j]) { i++; j++; continue; }
                if (++edits > 1) return false;
                if (a.Length > b.Length) i++;
                else if (b.Length > a.Length) j++;
                else { i++; j++; }
            }
            edits += (a.Length - i) + (b.Length - j);
            return edits <= 1;
        }

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

            // Vehicle link: prefer the resolved link on the order, else match by registration.
            int? vehicleId = order.VehicleId;
            var normReg = NormalizeReg(order.Registration);
            if (!vehicleId.HasValue && normReg.Length >= 4)
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
