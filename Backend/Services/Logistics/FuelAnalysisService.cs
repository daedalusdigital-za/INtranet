using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Analyses stored movement + fuel data to surface possible fuel theft or
    /// developing mechanical problems per vehicle. Purely heuristic and
    /// explainable — every flag carries a human-readable reason.
    /// </summary>
    public interface IFuelAnalysisService
    {
        Task<FuelAnalysisResult> AnalyzeVehicleAsync(int vehicleId, int days, CancellationToken ct = default);
        Task<List<FuelAnalysisResult>> AnalyzeFleetAsync(int days, CancellationToken ct = default);
        Task<List<UnmatchedFuelRegistration>> UnmatchedFuelAsync(int days, CancellationToken ct = default);
    }

    public class FuelAnalysisService : IFuelAnalysisService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<FuelAnalysisService> _logger;

        public FuelAnalysisService(ApplicationDbContext context, ILogger<FuelAnalysisService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<FuelAnalysisResult>> AnalyzeFleetAsync(int days, CancellationToken ct = default)
        {
            if (days < 1) days = 30;
            var since = DateTime.UtcNow.Date.AddDays(-days + 1);
            // Tracked vehicles, plus any vehicle that has fuel booked to it in the window
            // (a new truck on a temporary plate is often in TFN before it is in CarTrack).
            var fuelled = _context.FuelTransactions
                .Where(f => f.VehicleId != null && f.TransactionDate >= since)
                .Select(f => f.VehicleId!.Value);
            var vehicleRows = await _context.Vehicles
                .Where(v => v.CarTrackId != null || v.CarTrackName != null || v.IsLinkedToTfn || fuelled.Contains(v.Id))
                .Select(v => new { v.Id, v.RegistrationNumber })
                .ToListAsync(ct);
            var vehicleIds = vehicleRows
                .Where(v => !VehicleRegistry.IsPlaceholder(v.RegistrationNumber))
                .Select(v => v.Id)
                .ToList();

            var results = new List<FuelAnalysisResult>();
            foreach (var id in vehicleIds)
            {
                ct.ThrowIfCancellationRequested();
                var r = await AnalyzeVehicleAsync(id, days, ct);
                if (r != null) results.Add(r);
            }

            // Highest risk first
            return results.OrderByDescending(r => r.RiskScore).ToList();
        }

        public async Task<FuelAnalysisResult> AnalyzeVehicleAsync(int vehicleId, int days, CancellationToken ct = default)
        {
            if (days < 1) days = 30;
            var since = DateTime.UtcNow.Date.AddDays(-days + 1);

            var vehicle = await _context.Vehicles.Include(v => v.VehicleType).FirstOrDefaultAsync(v => v.Id == vehicleId, ct);
            if (vehicle == null)
                return new FuelAnalysisResult { VehicleId = vehicleId, RiskLevel = "unknown" };

            var reg = vehicle.RegistrationNumber;
            // Plate key, not the raw text: "EMX047ZN - NEW - VUSI" must still match fuel booked to EMX047ZN.
            var normReg = VehicleRegistry.PlateKey(reg);
            var carTrackKey = VehicleRegistry.PlateKey(vehicle.CarTrackName);
            var typeName = vehicle.VehicleType?.Name;
            var isTrailer = VehicleRegistry.IsTrailerType(typeName);

            // Tank capacity: prefer explicit TankSize, fall back to FuelCapacity
            var tankSize = (double?)(vehicle.TankSize ?? vehicle.FuelCapacity) ?? 0;
            var expectedKmPerL = (double?)vehicle.AverageFuelConsumption ?? 0;

            // --- Movements per day (distance) ---
            // Match on normalized registration (strip dashes/spaces/case) so movement
            // rows saved in a slightly different format still line up with the vehicle.
            var movementRows = await _context.VehicleMovementHistory
                .Where(m => m.MovementDate >= since)
                .Select(m => new { m.RegistrationNumber, m.MovementDate, m.TripDistance })
                .ToListAsync(ct);

            var movements = movementRows
                .Where(m =>
                {
                    var k = VehicleRegistry.PlateKey(m.RegistrationNumber);
                    return k == normReg || (carTrackKey.Length >= 4 && k == carTrackKey);
                })
                .Select(m => new { m.MovementDate, m.TripDistance })
                .ToList();

            var distanceByDay = movements
                .GroupBy(m => m.MovementDate.Date)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.TripDistance) / 1000.0); // km

            var totalDistanceKm = distanceByDay.Values.Sum();

            // --- Fuel fills over the window (normalized reg match) ---
            var allFuel = await _context.FuelTransactions
                .Where(f => f.TransactionDate >= since)
                .Select(f => new { f.Id, f.VehicleId, f.RegistrationNumber, f.TransactionDate, f.LitresUsed, f.AmountSpent, f.DepotName, f.Source })
                .ToListAsync(ct);

            // A row belongs to this vehicle when it is linked to it, or (unlinked) its plate matches.
            var fuel = allFuel
                .Where(f => f.VehicleId == vehicleId
                         || (f.VehicleId == null && VehicleRegistry.PlateKey(f.RegistrationNumber) == normReg))
                .OrderBy(f => f.TransactionDate)
                .ToList();

            // Fleet price per litre over the same window: the yardstick for "implausible R/L".
            var fleetRpl = allFuel
                .Where(f => f.LitresUsed > 0 && f.AmountSpent > 0)
                .Select(f => (double)(f.AmountSpent / f.LitresUsed))
                .OrderBy(x => x)
                .ToList();
            double fleetMedianRpl = fleetRpl.Count >= 5 ? fleetRpl[fleetRpl.Count / 2] : 0;

            // Trip sheets (Loads) in the window. Only warehouse delivery routes are captured there.
            var tripSheetCount = await _context.Loads
                .CountAsync(l => l.VehicleId == vehicleId && l.CreatedAt >= since, ct);

            var totalLitres = fuel.Sum(f => (double)f.LitresUsed);
            var totalAmount = fuel.Sum(f => (double)f.AmountSpent);

            var result = new FuelAnalysisResult
            {
                VehicleId = vehicleId,
                Registration = reg,
                Make = vehicle.Make,
                Model = vehicle.Model,
                Days = days,
                TankSizeLitres = Math.Round(tankSize, 1),
                ExpectedKmPerLitre = Math.Round(expectedKmPerL, 2),
                TotalDistanceKm = Math.Round(totalDistanceKm, 1),
                TotalLitres = Math.Round(totalLitres, 1),
                TotalAmount = Math.Round(totalAmount, 2),
                FillCount = fuel.Count,
                VehicleType = typeName,
                IsTrailer = isTrailer,
                TripSheetCount = tripSheetCount,
                FleetMedianPricePerLitre = Math.Round(fleetMedianRpl, 2)
            };
            var priced = fuel.Where(f => f.LitresUsed > 0 && f.AmountSpent > 0).ToList();
            if (priced.Count > 0)
                result.PricePerLitre = Math.Round((double)(priced.Sum(f => f.AmountSpent) / priced.Sum(f => f.LitresUsed)), 2);

            if (totalLitres > 0 && totalDistanceKm > 0)
                result.ActualKmPerLitre = Math.Round(totalDistanceKm / totalLitres, 2);

            var findings = new List<FuelFinding>();

            // ============================================================
            //  LEG-BASED FUEL INTEGRITY MODEL
            //  Principle: each fill-up tops the tank back up, so the litres
            //  put in at a fill should ≈ the fuel BURNED since the previous
            //  fill = (km driven on that leg) / (km per litre). If a fill
            //  takes on far MORE litres than the distance justifies, fuel is
            //  going somewhere other than driving this vehicle → theft, a
            //  leak, or a serious mechanical fault. We build each leg first,
            //  derive a trustworthy efficiency baseline, then flag legs.
            // ============================================================

            // Helper: cumulative km strictly AFTER prev fill day, up to & incl. this fill day.
            double KmBetween(DateTime? fromDayExclusive, DateTime toDayInclusive)
            {
                double km = 0;
                foreach (var kv in distanceByDay)
                    if ((fromDayExclusive == null || kv.Key > fromDayExclusive.Value) && kv.Key <= toDayInclusive)
                        km += kv.Value;
                return km;
            }

            // Build raw legs (skip the very first fill — no prior reference point).
            var legs = new List<(int Index, double Km, double Litres, bool HasMovement)>();
            for (int i = 1; i < fuel.Count; i++)
            {
                var prevDay = fuel[i - 1].TransactionDate.Date;
                var thisDay = fuel[i].TransactionDate.Date;
                var km = KmBetween(prevDay, thisDay);
                var litres = (double)fuel[i].LitresUsed;
                // "HasMovement" = we actually have saved trip data covering this leg.
                var hasMovement = km > 0.5;
                legs.Add((i, km, litres, hasMovement));
            }

            // Derive an efficiency baseline (km/L):
            //  1) prefer the vehicle's configured AverageFuelConsumption;
            //  2) else fall back to the vehicle's OWN median across measurable legs,
            //     which self-calibrates and needs no manual data.
            double baselineKmPerL = expectedKmPerL;
            bool baselineFromSelf = false;
            var legKmPerL = legs
                .Where(l => l.HasMovement && l.Litres > 0)
                .Select(l => l.Km / l.Litres)
                .OrderBy(x => x)
                .ToList();
            if (baselineKmPerL <= 0 && legKmPerL.Count >= 2)
            {
                baselineKmPerL = legKmPerL[legKmPerL.Count / 2]; // median
                baselineFromSelf = true;
            }
            result.BaselineKmPerLitre = baselineKmPerL > 0 ? Math.Round(baselineKmPerL, 2) : 0;
            result.BaselineSource = expectedKmPerL > 0 ? "configured"
                : baselineFromSelf ? "self-learned"
                : "none";

            // ---- Per-fill breakdown + per-leg flags ----
            var fills = new List<FuelFillBreakdown>();
            var dataChecks = new List<FuelFinding>();
            double legOverWeight = 0;
            int measurableLegs = 0, overFuelLegs = 0;

            for (int i = 0; i < fuel.Count; i++)
            {
                var f = fuel[i];
                var litres = (double)f.LitresUsed;
                double? kmSince = null;
                double? expectedForLeg = null;
                string? flag = null;
                string flagSeverity = "medium";

                if (i > 0)
                {
                    var leg = legs[i - 1];
                    if (leg.HasMovement)
                    {
                        kmSince = Math.Round(leg.Km, 1);
                        if (baselineKmPerL > 0)
                        {
                            var exp = leg.Km / baselineKmPerL;
                            expectedForLeg = Math.Round(exp, 1);
                            measurableLegs++;

                            // Over-fuelling: took on materially more than the distance needs.
                            if (exp > 0 && litres > exp * 1.30)
                            {
                                var excessPct = (litres / exp - 1.0) * 100.0;
                                overFuelLegs++;
                                flag = $"+{litres - exp:0} L more than needed ({excessPct:0}% over)";
                                flagSeverity = excessPct >= 60 ? "high" : "medium";
                                // Weight scales with how big the over-draw is, capped per leg.
                                legOverWeight += Math.Min(35, 8 + excessPct / 3.0);
                            }
                        }
                    }
                }

                // Physical impossibility always flags, regardless of movement data. It is far more often
                // a capture error (ordered litres, wrong vehicle, two vehicles on one slip) than a loss,
                // so it asks for the slip rather than scoring as theft.
                bool needsSlip = false;
                if (tankSize > 0 && litres > tankSize * 1.05)
                {
                    flag = $"Fill of {litres:0} L exceeds the {tankSize:0} L tank: check the fuel slip";
                    flagSeverity = "high";
                    needsSlip = true;
                }

                // Price sanity: R0, or far from what the rest of the fleet paid in the same window.
                double? rpl = litres > 0 ? (double)f.AmountSpent / litres : null;
                string? priceFlag = null;
                if (litres > 0 && f.AmountSpent <= 0)
                    priceFlag = "no rand amount captured for this fill";
                else if (rpl.HasValue && fleetMedianRpl > 0 && (rpl < fleetMedianRpl * 0.7 || rpl > fleetMedianRpl * 1.3))
                    priceFlag = $"R{rpl:0.00}/L against the fleet's R{fleetMedianRpl:0.00}/L, so litres or rand were captured wrong, or the fill is on the wrong vehicle";
                if (priceFlag != null)
                {
                    needsSlip = true;
                    flag ??= char.ToUpper(priceFlag[0]) + priceFlag[1..];
                    var src = f.Source ?? "import";
                    dataChecks.Add(new FuelFinding
                    {
                        Code = "PRICE_IMPLAUSIBLE",
                        Severity = "medium",
                        Message = $"{f.TransactionDate:yyyy-MM-dd} {src} fill of {litres:0.#} L for R{f.AmountSpent:0.00}: {priceFlag}. Check the slip.",
                        Date = f.TransactionDate
                    });
                }

                fills.Add(new FuelFillBreakdown
                {
                    Date = f.TransactionDate,
                    Litres = Math.Round(litres, 1),
                    Amount = Math.Round((double)f.AmountSpent, 2),
                    DepotName = f.DepotName,
                    KmSinceLastFill = kmSince,
                    ExpectedLitresForLeg = expectedForLeg,
                    TankSizeLitres = Math.Round(tankSize, 1),
                    FillVsTankPercent = tankSize > 0 ? (int)Math.Round(litres / tankSize * 100.0) : (int?)null,
                    Flag = flag,
                    Severity = flag != null ? flagSeverity : null,
                    HasMovementData = i > 0 && legs[i - 1].HasMovement,
                    PricePerLitre = rpl.HasValue ? Math.Round(rpl.Value, 2) : null,
                    Source = f.Source,
                    NeedsSlip = needsSlip
                });
            }
            result.Fills = fills;

            // ---- Roll leg findings up into headline findings ----

            // A) Any single fill exceeding the tank. Needs the slip before it means anything: usually the
            //    litres ordered rather than filled, two vehicles on one slip, or the wrong vehicle.
            foreach (var bad in fills.Where(x => x.FillVsTankPercent.HasValue && x.FillVsTankPercent.Value > 105))
            {
                var src = bad.Source ?? "import";
                dataChecks.Add(new FuelFinding
                {
                    Code = "FILL_EXCEEDS_TANK",
                    Severity = "high",
                    Message = $"Fill of {bad.Litres:0} L on {bad.Date:yyyy-MM-dd} ({src}) is more than the {tankSize:0} L tank. Check the fuel slip: it may be the litres ordered, two vehicles on one slip, or the wrong vehicle.",
                    Date = bad.Date
                });
            }

            // Fuel on a trailer: trailers have no tank. Either the vehicle type is wrong (a horse saved as a
            // trailer) or the fuel card is on the trailer's registration while the horse fills up.
            if (isTrailer && fuel.Count > 0)
            {
                dataChecks.Insert(0, new FuelFinding
                {
                    Code = "FUEL_ON_TRAILER",
                    Severity = "high",
                    Message = $"{fuel.Count} fill(s), {totalLitres:0} L booked to a vehicle typed '{typeName}'. Trailers have no fuel tank: fix the vehicle type if this is a horse, or move the fuel card to the horse that pulls it. Not scored as fuel loss."
                });
            }

            // B) Over-fuelling legs (the core theft/leak/fault signal).
            if (measurableLegs > 0 && overFuelLegs > 0)
            {
                var sev = (overFuelLegs >= 2 || legOverWeight >= 30) ? "high" : "medium";
                findings.Add(new FuelFinding
                {
                    Code = "OVER_FUELLING",
                    Severity = sev,
                    Weight = Math.Min(55, legOverWeight),
                    Message = $"{overFuelLegs} of {measurableLegs} fill-ups took on more fuel than the distance driven justifies — the flagged rows below show where. This points to fuel loss (theft/leak) or a mechanical fault."
                });
            }

            // C) Overall efficiency vs baseline across the whole window.
            if (baselineKmPerL > 0 && result.ActualKmPerLitre.HasValue && result.ActualKmPerLitre.Value > 0)
            {
                var ratio = result.ActualKmPerLitre.Value / baselineKmPerL;
                if (ratio < 0.75)
                {
                    var dropPct = (1 - ratio) * 100.0;
                    findings.Add(new FuelFinding
                    {
                        Code = "LOW_EFFICIENCY",
                        Severity = ratio < 0.6 ? "high" : "medium",
                        Weight = Math.Min(30, 8 + dropPct / 3.0),
                        Message = $"Overall economy {result.ActualKmPerLitre:0.0} km/L is {dropPct:0}% below the {(baselineFromSelf ? "vehicle's own normal" : "expected")} {baselineKmPerL:0.0} km/L."
                    });
                }
            }

            // Data-quality notes (explain a low/uncertain score honestly).
            if (tankSize <= 0)
                result.Notes.Add("No tank size on file — set TankSize/FuelCapacity to enable over-tank checks.");
            if (result.BaselineSource == "none")
                result.Notes.Add("Not enough matched trip + fuel data yet to learn a fuel-economy baseline, so over-fuelling can't be scored. This improves as movement history fills in.");
            else if (baselineFromSelf)
                result.Notes.Add("Using a self-learned economy baseline (no AverageFuelConsumption on file). Set the vehicle's expected km/L for sharper results.");

            // Trip sheets only cover warehouse delivery routes (Loads). Long-haul / horse work is not
            // captured there, so "no trip sheets" is a scope gap, not unexplained fuel.
            if (fuel.Count > 0 && tripSheetCount == 0)
                result.Notes.Add("No trip sheets for this vehicle in the window. Trip sheets only cover warehouse delivery routes, so long-haul and horse/trailer work never appears there; distance here comes from CarTrack. No trip sheets is not evidence of missing fuel.");

            // Trailer fuel is a linking error: don't let it read as theft.
            if (isTrailer) findings.Clear();

            result.Findings = findings;
            result.DataChecks = dataChecks;
            result.RiskScore = (int)Math.Min(100, Math.Round(findings.Sum(f => f.Weight)));
            result.RiskLevel = result.RiskScore >= 60 ? "high"
                : result.RiskScore >= 30 ? "watch"
                : dataChecks.Count > 0 ? "check"
                : "ok";

            return result;
        }

        /// <summary>
        /// Fuel registrations in the window that match no fleet vehicle (new trucks on temporary plates,
        /// typos). Their fuel is invisible to the per-vehicle analysis, so list them for someone to link.
        /// </summary>
        public async Task<List<UnmatchedFuelRegistration>> UnmatchedFuelAsync(int days, CancellationToken ct = default)
        {
            if (days < 1) days = 30;
            var since = DateTime.UtcNow.Date.AddDays(-days + 1);
            var index = await VehicleRegistry.BuildIndexAsync(_context, ct);
            var rows = await _context.FuelTransactions
                .Where(f => f.VehicleId == null && f.TransactionDate >= since)
                .Select(f => new { f.RegistrationNumber, f.LitresUsed, f.AmountSpent, f.TransactionDate, f.Source })
                .ToListAsync(ct);
            return rows
                .Where(r => VehicleRegistry.Resolve(index, r.RegistrationNumber) == null)
                .GroupBy(r => VehicleRegistry.PlateKey(r.RegistrationNumber))
                .Select(g => new UnmatchedFuelRegistration
                {
                    Registration = g.First().RegistrationNumber,
                    Fills = g.Count(),
                    Litres = Math.Round((double)g.Sum(x => x.LitresUsed), 1),
                    Amount = Math.Round((double)g.Sum(x => x.AmountSpent), 2),
                    LastFill = g.Max(x => x.TransactionDate),
                    Sources = string.Join(", ", g.Select(x => x.Source ?? "import").Distinct())
                })
                .OrderByDescending(x => x.Amount)
                .ToList();
        }
    }

    public class UnmatchedFuelRegistration
    {
        public string Registration { get; set; } = string.Empty;
        public int Fills { get; set; }
        public double Litres { get; set; }
        public double Amount { get; set; }
        public DateTime LastFill { get; set; }
        public string Sources { get; set; } = string.Empty;
    }

    public class FuelAnalysisResult
    {
        public int VehicleId { get; set; }
        public string? Registration { get; set; }
        public string? Make { get; set; }
        public string? Model { get; set; }
        public int Days { get; set; }

        public double TankSizeLitres { get; set; }
        public double ExpectedKmPerLitre { get; set; }
        public double? ActualKmPerLitre { get; set; }
        public double BaselineKmPerLitre { get; set; }
        public string BaselineSource { get; set; } = "none"; // configured | self-learned | none

        public double TotalDistanceKm { get; set; }
        public double TotalLitres { get; set; }
        public double TotalAmount { get; set; }
        public int FillCount { get; set; }

        public int RiskScore { get; set; }
        public string RiskLevel { get; set; } = "ok"; // ok | check | watch | high | unknown
        public List<FuelFinding> Findings { get; set; } = new();
        /// <summary>Data problems (trailer fuel, implausible R/L, fills above tank) that need a person and a slip, not a theft score.</summary>
        public List<FuelFinding> DataChecks { get; set; } = new();
        public string? VehicleType { get; set; }
        public bool IsTrailer { get; set; }
        public int TripSheetCount { get; set; }
        public double? PricePerLitre { get; set; }
        public double FleetMedianPricePerLitre { get; set; }
        public List<FuelFillBreakdown> Fills { get; set; } = new();
        public List<string> Notes { get; set; } = new();
    }

    public class FuelFillBreakdown
    {
        public DateTime Date { get; set; }
        public double Litres { get; set; }
        public double Amount { get; set; }
        public string? DepotName { get; set; }
        public double? KmSinceLastFill { get; set; }
        public double? ExpectedLitresForLeg { get; set; }
        public double TankSizeLitres { get; set; }
        public int? FillVsTankPercent { get; set; }
        public string? Flag { get; set; }
        public string? Severity { get; set; }
        public bool HasMovementData { get; set; }
        public double? PricePerLitre { get; set; }
        public string? Source { get; set; }
        public bool NeedsSlip { get; set; }
    }

    public class FuelFinding
    {
        public string Code { get; set; } = string.Empty;
        public string Severity { get; set; } = "medium"; // low | medium | high
        public double Weight { get; set; }
        public string Message { get; set; } = string.Empty;
        public DateTime? Date { get; set; }
    }
}
