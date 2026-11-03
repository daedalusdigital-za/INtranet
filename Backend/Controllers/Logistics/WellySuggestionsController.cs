using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Controllers.Logistics
{
    /// <summary>
    /// Welly's fulfilment advisor. Reads open (pending) invoices, stock on hand in each
    /// warehouse and the available fleet, then works out:
    ///   1. which invoices each province can fulfil right now from its own stock, and
    ///   2. which inter-warehouse stock movements would unlock the invoices that are short.
    /// Pure data analysis — nothing is written.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/welly/suggestions")]
    public class WellySuggestionsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IConfiguration _config;
        private readonly ILogger<WellySuggestionsController> _logger;

        public WellySuggestionsController(ApplicationDbContext db, IConfiguration config, ILogger<WellySuggestionsController> logger)
        {
            _db = db;
            _config = config;
            _logger = logger;
        }

        // ---------- helpers: region normalisation ----------

        /// <summary>Normalise any province / region spelling to a warehouse id (1 KZN, 2 GP, 3 CPT, 4 PE).</summary>
        private static int? WarehouseForProvince(string? province)
        {
            if (string.IsNullOrWhiteSpace(province)) return null;
            var p = province.Trim().ToLowerInvariant();
            if (p.Contains("kwazulu") || p == "kzn" || p.Contains("natal") || p.Contains("durban")) return 1;
            if (p.Contains("gauteng") || p == "gp" || p.Contains("limpopo") || p.Contains("north west") || p.Contains("mpumalanga") || p.Contains("free state") || p.Contains("johannesburg") || p.Contains("pretoria")) return 2;
            if (p.Contains("western cape") || p == "cpt" || p == "wc" || p.Contains("cape town") || p.Contains("northern cape")) return 3;
            if (p.Contains("eastern cape") || p == "pe" || p == "ec" || p.Contains("gqeberha") || p.Contains("port elizabeth")) return 4;
            return null;
        }

        /// <summary>
        /// Sage "Location" code → warehouse. Overridable in appsettings:
        ///   "WellySuggestions": { "LocationWarehouseMap": { "0": 1, "1": 1, "2": 4, "3": 3, "4": 2, "5": 2 } }
        /// </summary>
        private Dictionary<int, int> LocationMap()
        {
            var map = new Dictionary<int, int> { [0] = 1, [1] = 1, [2] = 4, [3] = 3, [4] = 2, [5] = 2 };
            var section = _config.GetSection("WellySuggestions:LocationWarehouseMap");
            foreach (var child in section.GetChildren())
                if (int.TryParse(child.Key, out var k) && int.TryParse(child.Value, out var v)) map[k] = v;
            return map;
        }

        private static string Priority(int days) => days switch
        {
            >= 14 => "Critical",
            >= 11 => "Urgent",
            >= 7 => "High",
            >= 4 => "Normal",
            _ => "Low"
        };

        private static string CompanyName(string? code) => (code ?? "").ToUpperInvariant() switch
        {
            "PMT" => "Promed",
            "ACM" => "Access",
            "SBT" => "Sebenzani",
            "PHT" => "Pharmacare",
            "KOG" => "KOG",
            _ => code ?? "—"
        };

        /// <summary>Invoice company code → the Commodity.Category that holds that company's stock.</summary>
        private static string CompanyCategory(string? code) => (code ?? "").ToUpperInvariant() switch
        {
            "PMT" => "PROMED",
            "ACM" => "ACCESS",
            "SBT" => "SEBENZANI",
            "PHT" => "PHARMACARE",
            "KOG" => "KOG",
            _ => (code ?? "").ToUpperInvariant()
        };

        /// <summary>Category → friendly company label for the UI.</summary>
        private static string CategoryLabel(string? cat) => (cat ?? "").ToUpperInvariant() switch
        {
            "PROMED" => "Promed", "ACCESS" => "Access", "SEBENZANI" => "Sebenzani", "PHARMACARE" => "Pharmacare", "KOG" => "KOG",
            _ => string.IsNullOrWhiteSpace(cat) ? "Unassigned" : cat!
        };

        private static readonly Regex NonAlnum = new("[^A-Z0-9]+", RegexOptions.Compiled);
        /// <summary>Normalise an item name so "Toilet Paper 1-Ply" and "TOILET PAPER 1PLY" compare equal.</summary>
        private static string NormName(string? s) => NonAlnum.Replace((s ?? "").ToUpperInvariant(), "").Trim();

        // ---------- the analysis ----------

        /// <summary>
        /// GET api/welly/suggestions/fulfilment?days=45
        /// </summary>
        [HttpGet("fulfilment")]
        public async Task<IActionResult> Fulfilment([FromQuery] int days = 45, [FromQuery] int maxInvoices = 2000)
        {
            var sw = Stopwatch.StartNew();
            var steps = new List<object>();
            void Step(string label, string detail) => steps.Add(new { label, detail, atMs = sw.ElapsedMilliseconds });

            days = Math.Clamp(days, 7, 365);
            var since = DateTime.UtcNow.Date.AddDays(-days);
            var locMap = LocationMap();

            // 1. Warehouses
            var warehouses = await _db.Warehouses.AsNoTracking()
                .Where(w => w.Id >= 1 && w.Id <= 4)
                .Select(w => new { w.Id, w.Name, w.Code, w.City, w.Province })
                .ToListAsync();
            var whById = warehouses.ToDictionary(w => w.Id);
            string WhName(int id) => whById.TryGetValue(id, out var w) ? w.Name : $"Warehouse {id}";
            string WhShort(int id) => id switch { 1 => "KZN", 2 => "GP", 3 => "CPT", 4 => "PE", _ => $"WH{id}" };
            Step("Warehouses", $"{warehouses.Count} warehouses: {string.Join(", ", warehouses.Select(w => WhShort(w.Id)))}");

            // 2. Open invoices (sales only; credit notes are CN-prefixed. TransactionType is not reliable in the import.)
            var rawLines = await _db.ImportedInvoices.AsNoTracking()
                .Where(i => i.Status == "Pending" && i.TransactionDate >= since && i.Quantity > 0
                            && !i.TransactionNumber.StartsWith("CN") && !i.TransactionNumber.StartsWith("CR"))
                .Select(i => new
                {
                    i.Id, i.TransactionNumber, i.TransactionDate, i.CustomerNumber, i.CustomerName,
                    i.ProductCode, i.ProductDescription, i.Quantity, i.DeliveredQuantity, i.SalesAmount,
                    i.Location, i.DeliveryProvince, i.DeliveryCity, i.SourceCompany, i.ImportedAt, i.CustomerId
                })
                .ToListAsync();

            // customer provinces as fallback
            var custNumbers = rawLines.Select(l => l.CustomerNumber).Distinct().ToList();
            var custProv = await _db.LogisticsCustomers.AsNoTracking()
                .Where(c => c.CustomerCode != null && custNumbers.Contains(c.CustomerCode)
                            && ((c.DeliveryProvince != null && c.DeliveryProvince != "") || (c.Province != null && c.Province != "")))
                .Select(c => new { CustomerNumber = c.CustomerCode!, Province = (c.DeliveryProvince ?? c.Province)! })
                .ToListAsync();
            var custProvByNo = custProv.GroupBy(c => c.CustomerNumber).ToDictionary(g => g.Key, g => g.First().Province!);

            var invoices = rawLines
                .GroupBy(l => new { l.SourceCompany, l.TransactionNumber })
                .Select(g =>
                {
                    var first = g.OrderBy(x => x.Id).First();
                    var province = g.Select(x => x.DeliveryProvince).FirstOrDefault(p => !string.IsNullOrWhiteSpace(p))
                                   ?? (custProvByNo.TryGetValue(first.CustomerNumber, out var cp) ? cp : null);
                    int? wh = WarehouseForProvince(province);
                    var basis = wh.HasValue ? "delivery province" : "sage location";
                    if (!wh.HasValue && first.Location.HasValue && locMap.TryGetValue(first.Location.Value, out var mapped)) wh = mapped;
                    if (!wh.HasValue) { wh = 1; basis = "default (KZN)"; }
                    var age = (int)(DateTime.UtcNow - first.TransactionDate).TotalDays;
                    return new InvoiceWork
                    {
                        Company = first.SourceCompany ?? "",
                        InvoiceNumber = first.TransactionNumber,
                        Date = first.TransactionDate,
                        AgeDays = age,
                        Priority = Priority(age),
                        CustomerNumber = first.CustomerNumber,
                        CustomerName = first.CustomerName,
                        Province = province,
                        City = g.Select(x => x.DeliveryCity).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)),
                        WarehouseId = wh.Value,
                        WarehouseBasis = basis,
                        Value = g.Sum(x => x.SalesAmount),
                        Lines = g.GroupBy(x => x.ProductCode.Trim().ToUpperInvariant())
                                 .Select(lg => new LineWork
                                 {
                                     Code = lg.Key,
                                     Description = lg.First().ProductDescription,
                                     Qty = Math.Max(0, lg.Sum(x => x.Quantity - (x.DeliveredQuantity ?? 0))),
                                     Value = lg.Sum(x => x.SalesAmount)
                                 })
                                 .Where(l => l.Qty > 0)
                                 .ToList()
                    };
                })
                .Where(i => i.Lines.Count > 0)
                .OrderByDescending(i => i.AgeDays).ThenByDescending(i => i.Value)
                .Take(maxInvoices)
                .ToList();
            Step("Open invoices", $"{invoices.Count} open invoices ({rawLines.Count} lines) from the last {days} days, {invoices.Count(i => i.WarehouseBasis == "sage location")} routed by Sage location");

            // 3. Stock on hand per warehouse. A code is keyed as-is when one company owns it; when the same code is a
            //    different product under two companies (e.g. GP Promed vs Access) it is keyed CODE@COMPANY so an invoice
            //    only ever draws its own company's stock.
            var stockRows = await _db.WarehouseInventory.AsNoTracking()
                .Where(wi => wi.WarehouseId >= 1 && wi.WarehouseId <= 4 && wi.QuantityOnHand > 0 && wi.Commodity.Code != null)
                .Select(wi => new { wi.WarehouseId, Code = wi.Commodity.Code!, wi.QuantityOnHand, Category = wi.Commodity.Category, Name = wi.Commodity.Name })
                .ToListAsync();
            var sharedCodes = stockRows
                .Where(r => !(r.Category ?? "").Equals("DAMAGED-EXPIRED", StringComparison.OrdinalIgnoreCase))
                .GroupBy(r => r.Code.Trim().ToUpperInvariant())
                .Where(g => g.Select(r => (r.Category ?? "").ToUpperInvariant()).Distinct().Count() > 1)
                .Select(g => g.Key).ToHashSet();
            string StockKey(string code, string category) => sharedCodes.Contains(code) ? $"{code}@{category}" : code;
            static string DisplayCode(string key) { var at = key.IndexOf('@'); return at < 0 ? key : key[..at]; }
            var stock = new Dictionary<(int wh, string code), decimal>();
            var itemNames = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var itemCategory = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            // normalised name → all stocked (warehouse, stock key, category) entries carrying that name
            var byName = new Dictionary<string, List<(int wh, string code, string category, string name)>>();
            foreach (var r in stockRows)
            {
                if ((r.Category ?? "").Equals("DAMAGED-EXPIRED", StringComparison.OrdinalIgnoreCase)) continue;
                var category = (r.Category ?? "").ToUpperInvariant();
                var key = (r.WarehouseId, StockKey(r.Code.Trim().ToUpperInvariant(), category));
                stock[key] = stock.GetValueOrDefault(key) + r.QuantityOnHand;
                itemNames.TryAdd(key.Item2, r.Name);
                itemCategory.TryAdd(key.Item2, category);
                var nn = NormName(r.Name);
                if (nn.Length >= 4)
                {
                    if (!byName.TryGetValue(nn, out var list)) byName[nn] = list = new();
                    if (!list.Any(e => e.wh == key.Item1 && e.code == key.Item2))
                        list.Add((key.Item1, key.Item2, category, r.Name));
                }
            }
            // Each invoice line resolves to the stock key its company would draw from
            foreach (var inv in invoices)
            {
                var cat = CompanyCategory(inv.Company);
                foreach (var line in inv.Lines) line.Key = StockKey(line.Code, cat);
            }
            // Names for codes that exist in the catalogue but hold no stock (so a short line can still be name-matched)
            var lineCodes = invoices.SelectMany(i => i.Lines.Select(l => l.Code)).Distinct().ToList();
            var catalogue = await _db.Commodities.AsNoTracking()
                .Where(c => c.Code != null && lineCodes.Contains(c.Code))
                .Select(c => new { Code = c.Code!, c.Name, c.Category }).ToListAsync();
            foreach (var c in catalogue)
            {
                var category = (c.Category ?? "").ToUpperInvariant();
                var code = StockKey(c.Code.Trim().ToUpperInvariant(), category);
                itemNames.TryAdd(code, c.Name);
                itemCategory.TryAdd(code, category);
            }
            Step("Stock on hand", $"{stockRows.Count} stocked lines across {warehouses.Count} warehouses (" +
                                  string.Join(", ", warehouses.Select(w => $"{WhShort(w.Id)} {stockRows.Count(s => s.WarehouseId == w.Id):n0}")) + ")");

            // 4. Fleet: available vehicles by province, minus those on live loads
            var busyVehicleIds = await _db.Loads.AsNoTracking()
                .Where(l => l.VehicleId != null && (l.Status == "Assigned" || l.Status == "InTransit" || l.Status == "In Transit" || l.Status == "Loading"))
                .Select(l => l.VehicleId!.Value).Distinct().ToListAsync();
            var vehicles = await _db.Vehicles.AsNoTracking()
                .Where(v => v.Status == "Available")
                .Select(v => new { v.Id, v.RegistrationNumber, v.Make, v.Model, v.Province, Type = v.VehicleType.Name, v.LastKnownAddress })
                .ToListAsync();
            var fleet = warehouses.ToDictionary(w => w.Id, _ => new List<TruckDto>());
            int unassignedVehicles = 0;
            foreach (var v in vehicles)
            {
                var wh = WarehouseForProvince(v.Province);
                if (!wh.HasValue) { unassignedVehicles++; continue; }
                if (!fleet.ContainsKey(wh.Value)) continue;
                fleet[wh.Value].Add(new TruckDto(v.Id, v.RegistrationNumber, v.Make, v.Model, v.Type, busyVehicleIds.Contains(v.Id), v.LastKnownAddress));
            }
            Step("Fleet", $"{vehicles.Count} available vehicles, {busyVehicleIds.Count} on live loads, {unassignedVehicles} with no province set");

            // 5. Allocate local stock, oldest invoices first (so one unit is never promised twice)
            var remaining = new Dictionary<(int wh, string code), decimal>(stock);
            foreach (var inv in invoices)
            {
                foreach (var line in inv.Lines)
                {
                    var key = (inv.WarehouseId, line.Key);
                    var have = remaining.GetValueOrDefault(key);
                    var take = Math.Min(have, line.Qty);
                    line.LocalAllocated = take;
                    if (take > 0) remaining[key] = have - take;
                    line.Known = stock.Keys.Any(k => k.code == line.Key);
                }
                inv.Status = inv.Lines.All(l => l.Shortfall <= 0) ? "Ready"
                           : inv.Lines.Any(l => l.LocalAllocated > 0) ? "Partial" : "Short";
            }
            Step("Local matching", $"{invoices.Count(i => i.Status == "Ready")} ready, {invoices.Count(i => i.Status == "Partial")} partial, {invoices.Count(i => i.Status == "Short")} short");

            // 6. Movements: for each shortfall line find the best donor warehouse out of remaining stock
            var movementLines = new List<MovementLine>();
            foreach (var inv in invoices.Where(i => i.Status != "Ready"))
            {
                foreach (var line in inv.Lines.Where(l => l.Shortfall > 0))
                {
                    var need = line.Shortfall;
                    var donors = warehouses.Where(w => w.Id != inv.WarehouseId)
                        .Select(w => new { w.Id, Qty = remaining.GetValueOrDefault((w.Id, line.Key)) })
                        .Where(d => d.Qty > 0).OrderByDescending(d => d.Qty).ToList();
                    foreach (var d in donors)
                    {
                        if (need <= 0) break;
                        var take = Math.Min(need, d.Qty);
                        remaining[(d.Id, line.Key)] -= take;
                        need -= take;
                        line.MovedIn += take;
                        movementLines.Add(new MovementLine
                        {
                            FromWarehouseId = d.Id, ToWarehouseId = inv.WarehouseId, Code = line.Code, Key = line.Key,
                            Description = line.Description, Qty = take, InvoiceNumber = inv.InvoiceNumber,
                            Company = inv.Company, CustomerName = inv.CustomerName,
                            Value = line.Qty > 0 ? Math.Round(line.Value * take / line.Qty, 2) : 0
                        });
                    }
                }
                inv.UnlockedByMovement = inv.Lines.All(l => l.Shortfall - l.MovedIn <= 0);
            }
            Step("Cross-warehouse matching", $"{movementLines.Count} transfer lines would unlock {invoices.Count(i => i.UnlockedByMovement)} more invoices");

            // 7. Inter-company transfers: the same item (by name) held under another company's code.
            //    Same warehouse first (paperwork only), then other warehouses (paperwork + truck).
            var transferLines = new List<TransferLine>();
            foreach (var inv in invoices.Where(i => i.Status != "Ready" && !i.UnlockedByMovement))
            {
                var toCategory = CompanyCategory(inv.Company);
                foreach (var line in inv.Lines.Where(l => l.Shortfall - l.MovedIn > 0))
                {
                    var need = line.Shortfall - line.MovedIn;
                    var ownName = itemNames.TryGetValue(line.Key, out var nm) ? nm : line.Description;
                    var nn = NormName(ownName);
                    if (nn.Length < 4 || !byName.TryGetValue(nn, out var twins)) continue;
                    var donors = twins
                        .Where(t => t.code != line.Key && t.category != toCategory)
                        .Select(t => new { t.wh, t.code, t.category, t.name, Qty = remaining.GetValueOrDefault((t.wh, t.code)) })
                        .Where(t => t.Qty > 0)
                        .OrderBy(t => t.wh == inv.WarehouseId ? 0 : 1).ThenByDescending(t => t.Qty)
                        .ToList();
                    foreach (var d in donors)
                    {
                        if (need <= 0) break;
                        var take = Math.Min(need, d.Qty);
                        remaining[(d.wh, d.code)] -= take;
                        need -= take;
                        line.TransferredIn += take;
                        transferLines.Add(new TransferLine
                        {
                            FromCategory = d.category, ToCategory = toCategory, FromCode = DisplayCode(d.code), FromKey = d.code, ToCode = line.Code,
                            Name = ownName, DonorName = d.name, FromWarehouseId = d.wh, ToWarehouseId = inv.WarehouseId, Qty = take,
                            InvoiceNumber = inv.InvoiceNumber, Company = inv.Company, CustomerName = inv.CustomerName,
                            Value = line.Qty > 0 ? Math.Round(line.Value * take / line.Qty, 2) : 0
                        });
                    }
                }
                inv.UnlockedByTransfer = inv.Lines.All(l => l.Shortfall - l.MovedIn - l.TransferredIn <= 0);
            }
            Step("Inter-company matching", $"{transferLines.Count} transfer lines (same item under another company) would unlock {invoices.Count(i => i.UnlockedByTransfer)} more invoices");

            // ---------- shape the response ----------

            var byWarehouse = warehouses.Select(w =>
            {
                var mine = invoices.Where(i => i.WarehouseId == w.Id).ToList();
                var ready = mine.Where(i => i.Status == "Ready").ToList();
                var partial = mine.Where(i => i.Status == "Partial").ToList();
                var shortList = mine.Where(i => i.Status == "Short").ToList();
                var trucks = fleet[w.Id];
                var freeTrucks = trucks.Count(t => !t.Busy);
                return new
                {
                    warehouseId = w.Id, code = WhShort(w.Id), name = w.Name, city = w.City, province = w.Province,
                    openInvoices = mine.Count,
                    readyCount = ready.Count, readyValue = ready.Sum(i => i.Value),
                    partialCount = partial.Count, partialValue = partial.Sum(i => i.Value),
                    shortCount = shortList.Count, shortValue = shortList.Sum(i => i.Value),
                    trucksTotal = trucks.Count, trucksFree = freeTrucks,
                    trucks,
                    invoices = mine.Select(ToDto).ToList()
                };
            }).ToList();

            var lanes = movementLines
                .GroupBy(m => new { m.FromWarehouseId, m.ToWarehouseId })
                .Select(g =>
                {
                    var unlocks = invoices.Where(i => i.UnlockedByMovement && i.WarehouseId == g.Key.ToWarehouseId
                                                   && g.Any(m => m.InvoiceNumber == i.InvoiceNumber)).ToList();
                    return new
                    {
                        fromWarehouseId = g.Key.FromWarehouseId, from = WhShort(g.Key.FromWarehouseId), fromName = WhName(g.Key.FromWarehouseId),
                        toWarehouseId = g.Key.ToWarehouseId, to = WhShort(g.Key.ToWarehouseId), toName = WhName(g.Key.ToWarehouseId),
                        items = g.GroupBy(m => m.Key).Select(ig => new
                        {
                            code = ig.First().Code,
                            description = ig.First().Description,
                            qty = ig.Sum(m => m.Qty),
                            value = ig.Sum(m => m.Value),
                            donorRemaining = remaining.GetValueOrDefault((g.Key.FromWarehouseId, ig.Key)),
                            invoices = ig.Select(m => m.InvoiceNumber).Distinct().ToList()
                        }).OrderByDescending(i => i.value).ToList(),
                        lineCount = g.Count(),
                        totalQty = g.Sum(m => m.Qty),
                        totalValue = g.Sum(m => m.Value),
                        unlocksInvoices = unlocks.Count,
                        unlocksValue = unlocks.Sum(i => i.Value),
                        helpsInvoices = g.Select(m => m.InvoiceNumber).Distinct().Count(),
                        unlockedInvoices = unlocks.Select(ToDto).ToList(),
                        trucksFreeAtSource = fleet[g.Key.FromWarehouseId].Count(t => !t.Busy)
                    };
                })
                .OrderByDescending(l => l.unlocksValue).ThenByDescending(l => l.totalValue)
                .ToList();

            // Lines nobody can fill
            var unfillableAll = invoices.SelectMany(i => i.Lines.Where(l => l.Shortfall - l.MovedIn - l.TransferredIn > 0).Select(l => new
            {
                invoiceNumber = i.InvoiceNumber, company = i.Company, customerName = i.CustomerName, warehouse = WhShort(i.WarehouseId),
                code = l.Code, description = l.Description, qty = l.Shortfall - l.MovedIn - l.TransferredIn, known = l.Known
            })).OrderByDescending(x => x.qty).ToList();
            var unfillableTotal = unfillableAll.Count;
            var unfillableUnknown = unfillableAll.Count(u => !u.known);
            var unfillable = unfillableAll.Take(500).ToList();

            var readyTotal = invoices.Count(i => i.Status == "Ready");
            var readyValue = invoices.Where(i => i.Status == "Ready").Sum(i => i.Value);
            var unlockTotal = invoices.Count(i => i.UnlockedByMovement);
            var unlockValue = invoices.Where(i => i.UnlockedByMovement).Sum(i => i.Value);
            var transferTotal = invoices.Count(i => i.UnlockedByTransfer);
            var transferValue = invoices.Where(i => i.UnlockedByTransfer).Sum(i => i.Value);
            var bestLane = lanes.FirstOrDefault();

            var interCompany = transferLines
                .GroupBy(t => new { t.FromCategory, t.ToCategory })
                .Select(g =>
                {
                    var unlocks = invoices.Where(i => i.UnlockedByTransfer && g.Any(t => t.InvoiceNumber == i.InvoiceNumber)).ToList();
                    return new
                    {
                        fromCategory = g.Key.FromCategory, from = CategoryLabel(g.Key.FromCategory),
                        toCategory = g.Key.ToCategory, to = CategoryLabel(g.Key.ToCategory),
                        items = g.GroupBy(t => new { t.FromCode, t.ToCode }).Select(ig => new
                        {
                            fromCode = ig.Key.FromCode, toCode = ig.Key.ToCode,
                            name = ig.First().Name, donorName = ig.First().DonorName,
                            qty = ig.Sum(t => t.Qty), value = ig.Sum(t => t.Value),
                            sameWarehouse = ig.All(t => t.FromWarehouseId == t.ToWarehouseId),
                            warehouses = ig.Select(t => t.FromWarehouseId == t.ToWarehouseId ? WhShort(t.FromWarehouseId) : $"{WhShort(t.FromWarehouseId)}→{WhShort(t.ToWarehouseId)}").Distinct().ToList(),
                            donorRemaining = ig.Select(t => t.FromWarehouseId).Distinct().Sum(w => remaining.GetValueOrDefault((w, ig.First().FromKey))),
                            invoices = ig.Select(t => t.InvoiceNumber).Distinct().ToList()
                        }).OrderByDescending(i => i.value).ToList(),
                        lineCount = g.Count(),
                        totalQty = g.Sum(t => t.Qty),
                        totalValue = g.Sum(t => t.Value),
                        sameWarehouseLines = g.Count(t => t.FromWarehouseId == t.ToWarehouseId),
                        crossWarehouseLines = g.Count(t => t.FromWarehouseId != t.ToWarehouseId),
                        unlocksInvoices = unlocks.Count,
                        unlocksValue = unlocks.Sum(i => i.Value),
                        helpsInvoices = g.Select(t => t.InvoiceNumber).Distinct().Count(),
                        unlockedInvoices = unlocks.Select(ToDto).ToList()
                    };
                })
                .OrderByDescending(l => l.unlocksValue).ThenByDescending(l => l.totalValue)
                .ToList();
            var bestTransfer = interCompany.FirstOrDefault();

            var flow = new
            {
                openInvoices = invoices.Count,
                routedByProvince = invoices.Count(i => i.WarehouseBasis == "delivery province"),
                routedByLocation = invoices.Count(i => i.WarehouseBasis == "sage location"),
                routedByDefault = invoices.Count(i => i.WarehouseBasis.StartsWith("default")),
                ready = readyTotal,
                partial = invoices.Count(i => i.Status == "Partial"),
                shortCount = invoices.Count(i => i.Status == "Short"),
                unlockedByMovement = unlockTotal,
                unlockedByTransfer = transferTotal,
                stillShort = invoices.Count(i => i.Status != "Ready" && !i.UnlockedByMovement && !i.UnlockedByTransfer),
                unfillableLines = unfillableTotal,
                unknownCodes = unfillableUnknown
            };

            var narrative = new List<string>
            {
                $"I looked at {invoices.Count} open invoices from the last {days} days, stock in {warehouses.Count} warehouses and {vehicles.Count} available vehicles.",
                readyTotal > 0
                    ? $"{readyTotal} invoices worth R {readyValue:n0} can be fulfilled today from local stock — " +
                      string.Join(", ", byWarehouse.Where(w => w.readyCount > 0).Select(w => $"{w.code} {w.readyCount} (R {w.readyValue:n0}, {w.trucksFree} trucks free)")) + "."
                    : "Nothing can be fulfilled completely from local stock right now.",
                unlockTotal > 0 && bestLane != null
                    ? $"Moving stock between warehouses would unlock {unlockTotal} more invoices worth R {unlockValue:n0}. The best lane is {bestLane.from} → {bestLane.to}: {bestLane.items.Count} items, {bestLane.totalQty:n0} units, unlocking {bestLane.unlocksInvoices} invoices (R {bestLane.unlocksValue:n0})."
                    : "No inter-warehouse movement would complete any additional invoice.",
                transferTotal > 0 && bestTransfer != null
                    ? $"Inter-company transfers (same item, different company code) would unlock another {transferTotal} invoices worth R {transferValue:n0}. Biggest: {bestTransfer.from} → {bestTransfer.to}, {bestTransfer.items.Count} items, {bestTransfer.totalQty:n0} units, unlocking {bestTransfer.unlocksInvoices} invoices."
                    : "No inter-company transfer would complete an additional invoice.",
                unfillableTotal > 0
                    ? $"{unfillableTotal} lines cannot be filled from any warehouse ({unfillableUnknown} are codes I have no stock record for) — these need purchasing or a Sage check."
                    : "Every open line can be covered from stock somewhere in the network."
            };
            Step("Done", $"Analysis finished in {sw.ElapsedMilliseconds} ms");

            return Ok(new
            {
                generatedAt = DateTime.UtcNow,
                windowDays = days,
                assumptions = new[]
                {
                    "Invoices are routed to the warehouse of their delivery province; when that is blank the Sage location code is used (" +
                    string.Join(", ", locMap.OrderBy(k => k.Key).Select(k => $"{k.Key}→{WhShort(k.Value)}")) + ").",
                    "Stock is allocated oldest-invoice-first so a unit is never promised twice. Damaged / expired stock is excluded.",
                    "Trucks are counted per province from the vehicle register; those already on an assigned or in-transit load are shown as busy.",
                    "Only sales invoices still marked Pending with a positive quantity are considered; credit notes (CN) and delivered quantities are ignored.",
                    "Inter-company transfers match on the item NAME (letters and digits only, case-insensitive) across company codes — descriptions are ignored because they differ between companies. Same-warehouse matches are preferred because they need no truck."
                },
                summary = new
                {
                    openInvoices = invoices.Count, openLines = invoices.Sum(i => i.Lines.Count), openValue = invoices.Sum(i => i.Value),
                    readyInvoices = readyTotal, readyValue,
                    partialInvoices = invoices.Count(i => i.Status == "Partial"),
                    shortInvoices = invoices.Count(i => i.Status == "Short"),
                    unlockableInvoices = unlockTotal, unlockableValue = unlockValue,
                    transferableInvoices = transferTotal, transferableValue = transferValue,
                    movementLanes = lanes.Count, movementUnits = movementLines.Sum(m => m.Qty),
                    transferLanes = interCompany.Count, transferUnits = transferLines.Sum(t => t.Qty),
                    unfillableLines = unfillableTotal,
                    vehiclesAvailable = vehicles.Count, vehiclesBusy = busyVehicleIds.Count
                },
                narrative,
                steps,
                flow,
                warehouses = byWarehouse,
                movements = lanes,
                interCompany,
                unfillable
            });
        }

        private static object ToDto(InvoiceWork i) => new
        {
            invoiceNumber = i.InvoiceNumber,
            company = i.Company,
            companyName = CompanyName(i.Company),
            date = i.Date,
            ageDays = i.AgeDays,
            priority = i.Priority,
            customerNumber = i.CustomerNumber,
            customerName = i.CustomerName,
            province = i.Province,
            city = i.City,
            warehouseId = i.WarehouseId,
            warehouseBasis = i.WarehouseBasis,
            value = i.Value,
            status = i.Status,
            unlockedByMovement = i.UnlockedByMovement,
            unlockedByTransfer = i.UnlockedByTransfer,
            lineCount = i.Lines.Count,
            readyLines = i.Lines.Count(l => l.Shortfall <= 0),
            lines = i.Lines.Select(l => new
            {
                code = l.Code, description = l.Description, qty = l.Qty, value = l.Value,
                available = l.LocalAllocated, shortfall = l.Shortfall, movedIn = l.MovedIn, transferredIn = l.TransferredIn, known = l.Known
            }).ToList()
        };

        private sealed class InvoiceWork
        {
            public string Company = ""; public string InvoiceNumber = ""; public DateTime Date; public int AgeDays; public string Priority = "";
            public string CustomerNumber = ""; public string CustomerName = ""; public string? Province; public string? City;
            public int WarehouseId; public string WarehouseBasis = ""; public decimal Value; public List<LineWork> Lines = new();
            public string Status = "Short"; public bool UnlockedByMovement; public bool UnlockedByTransfer;
        }

        private sealed class LineWork
        {
            public string Code = ""; public string Key = ""; public string Description = ""; public decimal Qty; public decimal Value;
            public decimal LocalAllocated; public decimal MovedIn; public decimal TransferredIn; public bool Known;
            public decimal Shortfall => Math.Max(0, Qty - LocalAllocated);
        }

        private sealed class TransferLine
        {
            public string FromCategory = ""; public string ToCategory = ""; public string FromCode = ""; public string FromKey = ""; public string ToCode = "";
            public string Name = ""; public string DonorName = ""; public int FromWarehouseId; public int ToWarehouseId; public decimal Qty;
            public string InvoiceNumber = ""; public string Company = ""; public string CustomerName = ""; public decimal Value;
        }

        private sealed record TruckDto(int Id, string RegistrationNumber, string Make, string Model, string? Type, bool Busy, string? LastKnownAddress);

        private sealed class MovementLine
        {
            public int FromWarehouseId; public int ToWarehouseId; public string Code = ""; public string Key = ""; public string Description = ""; public decimal Qty;
            public string InvoiceNumber = ""; public string Company = ""; public string CustomerName = ""; public decimal Value;
        }
    }
}
