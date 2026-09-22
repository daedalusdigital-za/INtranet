using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Electronic asset & consignment tracking — barcode / QR registry, code
    /// resolution and an immutable scan trail.
    ///
    /// A single scannable <see cref="AssetTag.Code"/> can point at a stock item,
    /// a fixed asset (furniture / safe / equipment / vehicle), an invoice, a
    /// tripsheet (Load) or a commodity. Scanning OR manually typing a code
    /// resolves everything related to it and records a <see cref="ScanEvent"/>.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/logistics/[controller]")]
    public class AssetTagController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<AssetTagController> _logger;

        public AssetTagController(ApplicationDbContext context, ILogger<AssetTagController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ── Helpers ────────────────────────────────────────────
        private int? CurrentUserId =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub"), out var id) ? id : null;

        private string CurrentUserName =>
            User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Name) ?? User.FindFirstValue(ClaimTypes.Email) ?? "Unknown";

        // ── DTOs ───────────────────────────────────────────────
        public class CreateTagRequest
        {
            /// <summary>Optional. If omitted a code is generated from the type + sequence.</summary>
            public string? Code { get; set; }
            public string Symbology { get; set; } = "QR";
            public string TagType { get; set; } = "Custom"; // StockItem|Asset|Invoice|Load|Commodity|Custom
            public string? ItemCode { get; set; }
            public int? AssetItemId { get; set; }
            public int? LoadId { get; set; }
            public int? ImportedInvoiceId { get; set; }
            public int? CommodityId { get; set; }
            public string? Label { get; set; }
            public string? Description { get; set; }
            public string? SerialNumber { get; set; }
            public string? CurrentLocation { get; set; }
            public string? SourceCompany { get; set; }
        }

        public class ScanRequest
        {
            public string Code { get; set; } = string.Empty;
            public string Action { get; set; } = "Lookup"; // Lookup|CheckIn|CheckOut|LoadOnVehicle|Offload|Deliver|Verify
            public string ScanMethod { get; set; } = "Camera"; // Camera|Manual
            public int? LoadId { get; set; }
            public string? Location { get; set; }
            public decimal? Latitude { get; set; }
            public decimal? Longitude { get; set; }
            public string? Notes { get; set; }
        }

        public class ResolveResult
        {
            public string Code { get; set; } = string.Empty;
            public bool Found { get; set; }
            public AssetTag? Tag { get; set; }
            public object? StockItem { get; set; }
            public List<object> Inventory { get; set; } = new();
            public List<object> Invoices { get; set; } = new();
            public List<object> TripSheets { get; set; } = new();
            public List<object> Pods { get; set; } = new();
            public object? Asset { get; set; }
            public object? Commodity { get; set; }
            public List<object> RecentScans { get; set; } = new();
            public string? Message { get; set; }
        }

        // ── List / search tags ─────────────────────────────────
        [HttpGet]
        public async Task<ActionResult<object>> GetTags(
            [FromQuery] string? search,
            [FromQuery] string? tagType,
            [FromQuery] string? status,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 500) pageSize = 50;

            var query = _context.AssetTags.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(tagType))
                query = query.Where(t => t.TagType == tagType);
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(t => t.Status == status);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(t =>
                    t.Code.Contains(s) ||
                    (t.Label != null && t.Label.Contains(s)) ||
                    (t.ItemCode != null && t.ItemCode.Contains(s)) ||
                    (t.SerialNumber != null && t.SerialNumber.Contains(s)));
            }

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(t => t.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new { items, totalCount = total, page, pageSize });
        }

        // ── Get a single tag ───────────────────────────────────
        [HttpGet("{id:int}")]
        public async Task<ActionResult<AssetTag>> GetTag(int id)
        {
            var tag = await _context.AssetTags.FindAsync(id);
            if (tag == null) return NotFound();
            return Ok(tag);
        }

        // ── Register / create a tag ─────────────────────────────
        [HttpPost]
        public async Task<ActionResult<AssetTag>> CreateTag([FromBody] CreateTagRequest req)
        {
            var code = string.IsNullOrWhiteSpace(req.Code) ? await GenerateCodeAsync(req.TagType, req.SourceCompany) : req.Code.Trim();

            var existing = await _context.AssetTags.FirstOrDefaultAsync(t => t.Code == code);
            if (existing != null)
                return Conflict(new { error = $"A tag with code '{code}' already exists.", tag = existing });

            var tag = new AssetTag
            {
                Code = code,
                Symbology = string.IsNullOrWhiteSpace(req.Symbology) ? "QR" : req.Symbology.Trim(),
                TagType = string.IsNullOrWhiteSpace(req.TagType) ? "Custom" : req.TagType.Trim(),
                ItemCode = req.ItemCode?.Trim(),
                AssetItemId = req.AssetItemId,
                LoadId = req.LoadId,
                ImportedInvoiceId = req.ImportedInvoiceId,
                CommodityId = req.CommodityId,
                Label = req.Label?.Trim(),
                Description = req.Description?.Trim(),
                SerialNumber = req.SerialNumber?.Trim(),
                CurrentLocation = req.CurrentLocation?.Trim(),
                SourceCompany = req.SourceCompany?.Trim(),
                CreatedByUserId = CurrentUserId,
                CreatedAt = DateTime.UtcNow
            };

            _context.AssetTags.Add(tag);
            await _context.SaveChangesAsync();

            // Log the registration as its own scan event for the audit trail.
            _context.ScanEvents.Add(new ScanEvent
            {
                ScannedCode = tag.Code,
                AssetTagId = tag.Id,
                Action = "Register",
                ScanMethod = "Manual",
                LoadId = tag.LoadId,
                ScannedByUserId = CurrentUserId,
                ScannedByName = CurrentUserName,
                ScannedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetTag), new { id = tag.Id }, tag);
        }

        // ── Update a tag ───────────────────────────────────────
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateTag(int id, [FromBody] CreateTagRequest req)
        {
            var tag = await _context.AssetTags.FindAsync(id);
            if (tag == null) return NotFound();

            if (!string.IsNullOrWhiteSpace(req.Code) && req.Code.Trim() != tag.Code)
            {
                var dup = await _context.AssetTags.AnyAsync(t => t.Code == req.Code!.Trim() && t.Id != id);
                if (dup) return Conflict(new { error = $"Code '{req.Code}' is already in use." });
                tag.Code = req.Code.Trim();
            }

            tag.Symbology = req.Symbology ?? tag.Symbology;
            tag.TagType = req.TagType ?? tag.TagType;
            tag.ItemCode = req.ItemCode?.Trim();
            tag.AssetItemId = req.AssetItemId;
            tag.LoadId = req.LoadId;
            tag.ImportedInvoiceId = req.ImportedInvoiceId;
            tag.CommodityId = req.CommodityId;
            tag.Label = req.Label?.Trim();
            tag.Description = req.Description?.Trim();
            tag.SerialNumber = req.SerialNumber?.Trim();
            tag.CurrentLocation = req.CurrentLocation?.Trim();
            tag.SourceCompany = req.SourceCompany?.Trim();
            tag.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(tag);
        }

        // ── Delete a tag ───────────────────────────────────────
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteTag(int id)
        {
            var tag = await _context.AssetTags.FindAsync(id);
            if (tag == null) return NotFound();
            _context.AssetTags.Remove(tag);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ── Resolve a code — return everything related ──────────
        [HttpGet("resolve/{code}")]
        public async Task<ActionResult<ResolveResult>> Resolve(string code, [FromQuery] bool logScan = false)
        {
            code = (code ?? string.Empty).Trim();
            var result = new ResolveResult { Code = code };

            if (string.IsNullOrEmpty(code))
            {
                result.Message = "No code supplied.";
                return Ok(result);
            }

            var tag = await _context.AssetTags.FirstOrDefaultAsync(t => t.Code == code);

            // If not a registered tag, try to interpret the raw code as a known
            // identifier so an unregistered barcode still surfaces useful data.
            string? itemCode = tag?.ItemCode;
            int? loadId = tag?.LoadId;
            int? invoiceId = tag?.ImportedInvoiceId;
            int? assetItemId = tag?.AssetItemId;
            int? commodityId = tag?.CommodityId;

            if (tag != null)
            {
                result.Found = true;
                result.Tag = tag;
            }
            else
            {
                // Heuristic fallbacks against existing data.
                var invByNumber = await _context.ImportedInvoices
                    .FirstOrDefaultAsync(i => i.TransactionNumber == code);
                if (invByNumber != null) { invoiceId = invByNumber.Id; result.Found = true; }

                var loadByNumber = await _context.Loads.FirstOrDefaultAsync(l => l.LoadNumber == code);
                if (loadByNumber != null) { loadId = loadByNumber.Id; result.Found = true; }

                var invByProduct = await _context.ImportedInvoices.AnyAsync(i => i.ProductCode == code);
                var invInv = await _context.BuildingInventory.AnyAsync(b => b.ItemCode == code);
                if (invByProduct || invInv) { itemCode = code; result.Found = true; }

                if (!result.Found)
                    result.Message = "Unregistered code. You can register it as a new tag.";
            }

            // ── Stock item / inventory ──
            if (!string.IsNullOrWhiteSpace(itemCode))
            {
                result.StockItem = new { itemCode };

                result.Inventory = await _context.BuildingInventory.AsNoTracking()
                    .Where(b => b.ItemCode == itemCode)
                    .Select(b => (object)new
                    {
                        b.Id, b.BuildingId, b.ItemCode, b.ItemDescription,
                        b.Uom, b.QuantityOnHand, b.QuantityReserved
                    })
                    .ToListAsync();

                result.Invoices = await _context.ImportedInvoices.AsNoTracking()
                    .Where(i => i.ProductCode == itemCode)
                    .OrderByDescending(i => i.TransactionDate)
                    .Take(25)
                    .Select(i => (object)new
                    {
                        i.Id, i.TransactionNumber, i.CustomerName, i.ProductCode,
                        i.ProductDescription, i.Quantity, i.NetSales, i.Status,
                        i.TransactionDate, i.LoadId, i.DeliveryAddress, i.DeliveryCity
                    })
                    .ToListAsync();

                // Tripsheets carrying this product (via the invoices assigned to loads).
                var loadIdsForItem = await _context.ImportedInvoices.AsNoTracking()
                    .Where(i => i.ProductCode == itemCode && i.LoadId != null)
                    .Select(i => i.LoadId!.Value)
                    .Distinct()
                    .ToListAsync();
                if (loadIdsForItem.Any())
                    result.TripSheets = await LoadSummaries(loadIdsForItem);
            }

            // ── Direct invoice ──
            if (invoiceId != null && !result.Invoices.Any())
            {
                var inv = await _context.ImportedInvoices.AsNoTracking()
                    .Where(i => i.Id == invoiceId)
                    .Select(i => (object)new
                    {
                        i.Id, i.TransactionNumber, i.CustomerName, i.ProductCode,
                        i.ProductDescription, i.Quantity, i.NetSales, i.Status,
                        i.TransactionDate, i.LoadId, i.DeliveryAddress, i.DeliveryCity
                    })
                    .FirstOrDefaultAsync();
                if (inv != null) result.Invoices.Add(inv);

                var invLoad = await _context.ImportedInvoices.AsNoTracking()
                    .Where(i => i.Id == invoiceId && i.LoadId != null)
                    .Select(i => i.LoadId!.Value).FirstOrDefaultAsync();
                if (invLoad != 0) loadId = invLoad;
            }

            // ── Tripsheet / Load ──
            if (loadId != null && !result.TripSheets.Any())
            {
                result.TripSheets = await LoadSummaries(new List<int> { loadId.Value });

                // Invoices on that tripsheet.
                if (!result.Invoices.Any())
                {
                    result.Invoices = await _context.ImportedInvoices.AsNoTracking()
                        .Where(i => i.LoadId == loadId)
                        .Select(i => (object)new
                        {
                            i.Id, i.TransactionNumber, i.CustomerName, i.ProductCode,
                            i.ProductDescription, i.Quantity, i.NetSales, i.Status,
                            i.TransactionDate, i.LoadId, i.DeliveryAddress, i.DeliveryCity
                        })
                        .ToListAsync();
                }
            }

            // ── Fixed asset ──
            if (assetItemId != null)
            {
                result.Asset = await _context.Set<Models.AssetRegisterItem>().AsNoTracking()
                    .Where(a => a.ItemId == assetItemId)
                    .Select(a => (object)new
                    {
                        a.ItemId, a.AssetCode, a.Category, a.Manufacturer, a.Model,
                        a.SerialNumber, a.AssignedTo, a.Condition, a.LocationId
                    })
                    .FirstOrDefaultAsync();
            }

            // ── Commodity ──
            if (commodityId != null)
            {
                result.Commodity = await _context.Commodities.AsNoTracking()
                    .Where(c => c.Id == commodityId)
                    .Select(c => (object)new { c.Id, c.Name, c.Code, c.Category, c.UnitOfMeasure })
                    .FirstOrDefaultAsync();
            }

            // ── PODs (proof-of-delivery) related to this invoice / product / tripsheet ──
            // Gather every invoice this code touches, then find PODs linked to those
            // invoices (by id or by typed invoice number, incl. not-yet-imported ones)
            // or attached to the same tripsheet/load.
            var relevantInvoiceIds = new HashSet<int>();
            if (invoiceId != null) relevantInvoiceIds.Add(invoiceId.Value);
            if (!string.IsNullOrWhiteSpace(itemCode))
            {
                var itemInvoiceIds = await _context.ImportedInvoices.AsNoTracking()
                    .Where(i => i.ProductCode == itemCode)
                    .Select(i => i.Id).ToListAsync();
                foreach (var id in itemInvoiceIds) relevantInvoiceIds.Add(id);
            }
            if (loadId != null)
            {
                var loadInvoiceIds = await _context.ImportedInvoices.AsNoTracking()
                    .Where(i => i.LoadId == loadId)
                    .Select(i => i.Id).ToListAsync();
                foreach (var id in loadInvoiceIds) relevantInvoiceIds.Add(id);
            }

            if (relevantInvoiceIds.Any() || loadId != null || !string.IsNullOrEmpty(code))
            {
                var invoiceIdList = relevantInvoiceIds.ToList();
                result.Pods = await _context.PodDocuments.AsNoTracking()
                    .Where(p =>
                        (loadId != null && p.LoadId == loadId) ||
                        (p.InvoiceId != null && invoiceIdList.Contains(p.InvoiceId.Value)) ||
                        p.InvoiceLinks.Any(l =>
                            (l.InvoiceId != null && invoiceIdList.Contains(l.InvoiceId.Value)) ||
                            (l.InvoiceNumber != null && l.InvoiceNumber == code)))
                    .OrderByDescending(p => p.DeliveryDate)
                    .Take(25)
                    .Select(p => (object)new
                    {
                        p.Id, p.PodNumber, p.DriverName, p.DeliveryDate, p.Region,
                        p.FileName, p.OriginalFileName, p.ContentType, p.FileSize, p.Notes, p.LoadId
                    })
                    .ToListAsync();
            }

            // ── Recent scan history for this code ──
            result.RecentScans = await _context.ScanEvents.AsNoTracking()
                .Where(s => s.ScannedCode == code)
                .OrderByDescending(s => s.ScannedAt)
                .Take(15)
                .Select(s => (object)new
                {
                    s.Id, s.Action, s.ScanMethod, s.LoadId, s.Location,
                    s.Notes, s.ScannedByName, s.ScannedAt
                })
                .ToListAsync();

            if (logScan)
            {
                _context.ScanEvents.Add(new ScanEvent
                {
                    ScannedCode = code,
                    AssetTagId = tag?.Id,
                    Action = "Lookup",
                    ScanMethod = "Camera",
                    LoadId = loadId,
                    ScannedByUserId = CurrentUserId,
                    ScannedByName = CurrentUserName,
                    ScannedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
            }

            return Ok(result);
        }

        // ── Record a scan event ────────────────────────────────
        [HttpPost("scan")]
        public async Task<ActionResult<ScanEvent>> RecordScan([FromBody] ScanRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Code))
                return BadRequest(new { error = "Code is required." });

            var code = req.Code.Trim();
            var tag = await _context.AssetTags.FirstOrDefaultAsync(t => t.Code == code);

            var ev = new ScanEvent
            {
                ScannedCode = code,
                AssetTagId = tag?.Id,
                Action = string.IsNullOrWhiteSpace(req.Action) ? "Lookup" : req.Action.Trim(),
                ScanMethod = string.IsNullOrWhiteSpace(req.ScanMethod) ? "Camera" : req.ScanMethod.Trim(),
                LoadId = req.LoadId,
                Location = req.Location?.Trim(),
                Latitude = req.Latitude,
                Longitude = req.Longitude,
                Notes = req.Notes?.Trim(),
                ScannedByUserId = CurrentUserId,
                ScannedByName = CurrentUserName,
                ScannedAt = DateTime.UtcNow
            };
            _context.ScanEvents.Add(ev);

            // Keep the tag's last-known location fresh on movement scans.
            if (tag != null && !string.IsNullOrWhiteSpace(req.Location))
            {
                tag.CurrentLocation = req.Location.Trim();
                tag.UpdatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(ev);
        }

        // ── Scan history (optionally filtered) ──────────────────
        [HttpGet("scans")]
        public async Task<ActionResult<object>> GetScans(
            [FromQuery] string? code,
            [FromQuery] int? loadId,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 500) pageSize = 50;

            var query = _context.ScanEvents.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(code)) query = query.Where(s => s.ScannedCode == code.Trim());
            if (loadId != null) query = query.Where(s => s.LoadId == loadId);

            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(s => s.ScannedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(s => new
                {
                    s.Id, s.ScannedCode, s.AssetTagId, s.Action, s.ScanMethod,
                    s.LoadId, s.Location, s.Notes, s.ScannedByName, s.ScannedAt
                })
                .ToListAsync();

            return Ok(new { items, totalCount = total, page, pageSize });
        }

        // ── Tags attached to a tripsheet / load ─────────────────
        [HttpGet("load/{loadId:int}")]
        public async Task<ActionResult<object>> GetTagsForLoad(int loadId)
        {
            var tags = await _context.AssetTags.AsNoTracking()
                .Where(t => t.LoadId == loadId)
                .OrderBy(t => t.Code)
                .ToListAsync();
            return Ok(tags);
        }

        // ── Load manifest for pre-departure "scan to load" check ─
        public class ManifestLine
        {
            public string Code { get; set; } = string.Empty; // scannable value (invoice/order no)
            public string CustomerName { get; set; } = string.Empty;
            public string ProductCode { get; set; } = string.Empty;
            public string ProductDescription { get; set; } = string.Empty;
            public decimal Quantity { get; set; }
            public string? DeliveryCity { get; set; }
            public bool Loaded { get; set; }        // has a LoadOnVehicle scan been recorded?
            public DateTime? LoadedAt { get; set; }
            public string? LoadedBy { get; set; }
        }

        public class ManifestResult
        {
            public int LoadId { get; set; }
            public string LoadNumber { get; set; } = string.Empty;
            public string Status { get; set; } = string.Empty;
            public string? CustomerName { get; set; }
            public string? Driver { get; set; }
            public string? Vehicle { get; set; }
            public int TotalLines { get; set; }
            public int LoadedLines { get; set; }
            public List<ManifestLine> Lines { get; set; } = new();
        }

        /// <summary>
        /// Returns the expected items for a tripsheet (its assigned invoices)
        /// with each line's loaded/verified state derived from scan events.
        /// Used by the "Scan to Load" pre-departure checklist.
        /// </summary>
        [HttpGet("manifest/{loadId:int}")]
        public async Task<ActionResult<ManifestResult>> GetManifest(int loadId)
        {
            var load = await _context.Loads.AsNoTracking()
                .Where(l => l.Id == loadId)
                .Select(l => new
                {
                    l.Id, l.LoadNumber, l.Status,
                    CustomerName = l.Customer != null ? l.Customer.Name : null,
                    Driver = l.Driver != null ? (l.Driver.FirstName + " " + l.Driver.LastName) : null,
                    Vehicle = l.Vehicle != null ? l.Vehicle.RegistrationNumber : null
                })
                .FirstOrDefaultAsync();

            if (load == null) return NotFound(new { error = "Tripsheet not found." });

            var invoices = await _context.ImportedInvoices.AsNoTracking()
                .Where(i => i.LoadId == loadId)
                .OrderBy(i => i.CustomerName).ThenBy(i => i.TransactionNumber)
                .Select(i => new
                {
                    i.TransactionNumber, i.CustomerName, i.ProductCode,
                    i.ProductDescription, i.Quantity, i.DeliveryCity
                })
                .ToListAsync();

            // Which line codes already have a LoadOnVehicle scan against this load.
            var loadedScans = await _context.ScanEvents.AsNoTracking()
                .Where(s => s.LoadId == loadId && s.Action == "LoadOnVehicle")
                .OrderByDescending(s => s.ScannedAt)
                .Select(s => new { s.ScannedCode, s.ScannedAt, s.ScannedByName })
                .ToListAsync();

            var loadedMap = loadedScans
                .GroupBy(s => s.ScannedCode)
                .ToDictionary(g => g.Key, g => g.First());

            var lines = invoices.Select(i =>
            {
                loadedMap.TryGetValue(i.TransactionNumber, out var scan);
                return new ManifestLine
                {
                    Code = i.TransactionNumber,
                    CustomerName = i.CustomerName,
                    ProductCode = i.ProductCode,
                    ProductDescription = i.ProductDescription,
                    Quantity = i.Quantity,
                    DeliveryCity = i.DeliveryCity,
                    Loaded = scan != null,
                    LoadedAt = scan?.ScannedAt,
                    LoadedBy = scan?.ScannedByName
                };
            }).ToList();

            return Ok(new ManifestResult
            {
                LoadId = load.Id,
                LoadNumber = load.LoadNumber,
                Status = load.Status,
                CustomerName = load.CustomerName,
                Driver = load.Driver,
                Vehicle = load.Vehicle,
                TotalLines = lines.Count,
                LoadedLines = lines.Count(l => l.Loaded),
                Lines = lines
            });
        }

        /// <summary>
        /// Resolve a load id from a trip QR / load number so the manifest can be
        /// opened by scanning the header QR or typing the tripsheet number.
        /// </summary>
        [HttpGet("manifest/by-code/{code}")]
        public async Task<ActionResult<ManifestResult>> GetManifestByCode(string code)
        {
            code = (code ?? string.Empty).Trim();
            if (string.IsNullOrEmpty(code)) return BadRequest(new { error = "No code supplied." });

            // Direct load number match, then a registered Load tag.
            var loadId = await _context.Loads.AsNoTracking()
                .Where(l => l.LoadNumber == code)
                .Select(l => (int?)l.Id).FirstOrDefaultAsync();

            if (loadId == null)
            {
                loadId = await _context.AssetTags.AsNoTracking()
                    .Where(t => t.Code == code && t.LoadId != null)
                    .Select(t => t.LoadId).FirstOrDefaultAsync();
            }

            // Fall back: maybe they scanned a line invoice — open its parent load.
            if (loadId == null)
            {
                loadId = await _context.ImportedInvoices.AsNoTracking()
                    .Where(i => i.TransactionNumber == code && i.LoadId != null)
                    .Select(i => i.LoadId).FirstOrDefaultAsync();
            }

            if (loadId == null) return NotFound(new { error = $"No tripsheet found for '{code}'." });

            return await GetManifest(loadId.Value);
        }

        // ── Code generator ─────────────────────────────────────
        private async Task<string> GenerateCodeAsync(string tagType, string? company)
        {
            var typeAbbr = (tagType ?? "GEN").ToUpperInvariant() switch
            {
                "STOCKITEM" => "ITM",
                "ASSET" => "AST",
                "INVOICE" => "INV",
                "LOAD" => "LOD",
                "COMMODITY" => "CMD",
                _ => "TAG"
            };
            var prefix = string.IsNullOrWhiteSpace(company) ? "PMT" : company.Trim().ToUpperInvariant();

            // Find the next sequence for this prefix/type.
            var pattern = $"{prefix}-{typeAbbr}-";
            var last = await _context.AssetTags
                .Where(t => t.Code.StartsWith(pattern))
                .OrderByDescending(t => t.Code)
                .Select(t => t.Code)
                .FirstOrDefaultAsync();

            int next = 1;
            if (!string.IsNullOrEmpty(last))
            {
                var tail = last.Substring(pattern.Length);
                if (int.TryParse(tail, out var n)) next = n + 1;
            }
            return $"{pattern}{next:D6}";
        }

        // ── Shared: compact tripsheet/load summaries ────────────
        private async Task<List<object>> LoadSummaries(List<int> loadIds)
        {
            return await _context.Loads.AsNoTracking()
                .Where(l => loadIds.Contains(l.Id))
                .Select(l => (object)new
                {
                    l.Id,
                    l.LoadNumber,
                    l.Status,
                    l.Priority,
                    CustomerName = l.Customer != null ? l.Customer.Name : null,
                    Driver = l.Driver != null ? (l.Driver.FirstName + " " + l.Driver.LastName) : null,
                    Vehicle = l.Vehicle != null ? l.Vehicle.RegistrationNumber : null,
                    l.ScheduledDeliveryDate,
                    l.DeliveryLocation
                })
                .ToListAsync();
        }
    }
}
