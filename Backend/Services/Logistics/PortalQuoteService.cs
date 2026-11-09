using System.Net;
using System.Text.Json;
using iText.Html2pdf;
using iText.Kernel.Pdf;
using ProjectTracker.API.Constants;
using ProjectTracker.API.Controllers.Portal;
using ProjectTracker.API.Models.Logistics.Shipments;

namespace ProjectTracker.API.Services.Logistics
{
    // ------------------------------------------------------------------ pricing result

    public class QuoteChargeLine
    {
        public string Label { get; set; } = string.Empty;
        public string? Detail { get; set; }
        public decimal Amount { get; set; }
    }

    public class QuoteShipmentPrice
    {
        public int Index { get; set; }
        public string From { get; set; } = string.Empty;
        public string To { get; set; } = string.Empty;
        public string CollectionDate { get; set; } = string.Empty;
        public string DeliverBy { get; set; } = string.Empty;
        public decimal WeightKg { get; set; }
        public decimal VolumetricKg { get; set; }
        public decimal ChargeableKg { get; set; }
        public decimal DistanceKm { get; set; }
        public bool DistanceEstimated { get; set; }
        public int Pallets { get; set; }
        public int Parcels { get; set; }
        public List<QuoteChargeLine> Lines { get; set; } = new();
        public decimal Subtotal { get; set; }
    }

    public class QuotePricing
    {
        public List<QuoteShipmentPrice> Shipments { get; set; } = new();
        public decimal Subtotal { get; set; }
        public decimal VatRate { get; set; }
        public decimal Vat { get; set; }
        public decimal Total { get; set; }
        public string Currency { get; set; } = "ZAR";
        public List<string> Notes { get; set; } = new();
    }

    /// <summary>Rate card. Overridable from appsettings: "Portal:Pricing": { ... }.</summary>
    public class PortalRateCard
    {
        public decimal BaseFee { get; set; } = 350m;               // per shipment (collection + admin)
        public decimal PerKgRate { get; set; } = 2.40m;            // per chargeable kg
        public decimal MinimumChargeableKg { get; set; } = 30m;
        public decimal VolumetricDivisor { get; set; } = 4000m;     // cm³ per kg
        public decimal PerKmRate { get; set; } = 9.50m;            // per km beyond the local radius
        public decimal LocalRadiusKm { get; set; } = 30m;          // km included in the base fee
        public decimal RoadFactor { get; set; } = 1.25m;           // straight-line → road distance
        public decimal PalletHandlingFee { get; set; } = 95m;      // per pallet
        public decimal FragileSurchargePct { get; set; } = 7.5m;
        public decimal HazardousSurcharge { get; set; } = 450m;
        public decimal TemperatureSurchargePct { get; set; } = 15m;
        public decimal FuelSurchargePct { get; set; } = 12m;
        public decimal VatRatePct { get; set; } = 15m;
        public int ValidityDays { get; set; } = 14;
        /// <summary>Fallback inter-province distance (km) when no coordinates are available. Same province = LocalFallbackKm.</summary>
        public decimal LocalFallbackKm { get; set; } = 60m;
        public decimal ProvinceFallbackKm { get; set; } = 600m;
    }

    public interface IPortalQuoteService
    {
        QuotePricing Price(PortalBookingRequest request, IReadOnlyDictionary<int, ShipmentAddress> bookAddresses);
        byte[] RenderPdf(PortalQuote quote, string customerName, string? requestedBy);
        PortalRateCard RateCard { get; }
    }

    /// <summary>
    /// Prices a portal booking request from a simple configurable rate card and renders the
    /// quote PDF. Distance uses the straight-line distance × road factor when both addresses are
    /// geocoded, otherwise a province-based fallback (flagged as estimated on the quote).
    /// </summary>
    public class PortalQuoteService : IPortalQuoteService
    {
        public PortalRateCard RateCard { get; }

        public PortalQuoteService(IConfiguration config)
        {
            RateCard = new PortalRateCard();
            config.GetSection("Portal:Pricing").Bind(RateCard);
        }

        // Rough centroids per province for the no-coordinates fallback.
        private static readonly Dictionary<string, (double lat, double lng)> ProvinceCentroids = new(StringComparer.OrdinalIgnoreCase)
        {
            ["Gauteng"] = (-26.10, 28.10), ["KwaZulu-Natal"] = (-29.60, 30.60), ["Western Cape"] = (-33.70, 19.50),
            ["Eastern Cape"] = (-32.50, 26.50), ["Free State"] = (-28.90, 26.60), ["Mpumalanga"] = (-25.80, 30.50),
            ["Limpopo"] = (-23.90, 29.40), ["North West"] = (-26.30, 25.90), ["Northern Cape"] = (-29.40, 22.00)
        };

        public QuotePricing Price(PortalBookingRequest request, IReadOnlyDictionary<int, ShipmentAddress> book)
        {
            var rc = RateCard;
            var result = new QuotePricing { VatRate = rc.VatRatePct };
            var idx = 0;
            foreach (var s in request.Shipments ?? new())
            {
                idx++;
                var pick = Resolve(s.Pickup, book);
                var drop = Resolve(s.Delivery, book);
                var cargo = s.Cargo ?? new();

                decimal weight = cargo.Sum(c => Math.Max(0, c.WeightKg) * Math.Max(1, c.Qty));
                decimal vol = cargo.Sum(c => (c.LengthCm.HasValue && c.WidthCm.HasValue && c.HeightCm.HasValue)
                    ? (c.LengthCm.Value * c.WidthCm.Value * c.HeightCm.Value / rc.VolumetricDivisor) * Math.Max(1, c.Qty) : 0m);
                var chargeable = Math.Max(rc.MinimumChargeableKg, Math.Max(weight, vol));
                var pallets = cargo.Where(c => string.Equals(c.Type, "pallet", StringComparison.OrdinalIgnoreCase)).Sum(c => Math.Max(1, c.Qty));
                var parcels = cargo.Where(c => !string.Equals(c.Type, "pallet", StringComparison.OrdinalIgnoreCase)).Sum(c => Math.Max(1, c.Qty));

                var (km, estimated) = Distance(pick, drop, rc);

                var sp = new QuoteShipmentPrice
                {
                    Index = idx, From = Place(pick), To = Place(drop), CollectionDate = s.CollectionDate ?? "", DeliverBy = s.DeliverBy ?? "",
                    WeightKg = Math.Round(weight, 1), VolumetricKg = Math.Round(vol, 1), ChargeableKg = Math.Round(chargeable, 1),
                    DistanceKm = Math.Round(km, 0), DistanceEstimated = estimated, Pallets = pallets, Parcels = parcels
                };

                sp.Lines.Add(new QuoteChargeLine { Label = "Collection & handling", Detail = "Base fee per shipment", Amount = rc.BaseFee });
                sp.Lines.Add(new QuoteChargeLine { Label = "Freight", Detail = $"{sp.ChargeableKg:N1} chargeable kg × R{rc.PerKgRate:N2}", Amount = Math.Round(chargeable * rc.PerKgRate, 2) });
                var billableKm = Math.Max(0, km - rc.LocalRadiusKm);
                if (billableKm > 0)
                    sp.Lines.Add(new QuoteChargeLine { Label = "Distance", Detail = $"{billableKm:N0} km beyond {rc.LocalRadiusKm:N0} km × R{rc.PerKmRate:N2}{(estimated ? " (estimated)" : "")}", Amount = Math.Round(billableKm * rc.PerKmRate, 2) });
                if (pallets > 0)
                    sp.Lines.Add(new QuoteChargeLine { Label = "Pallet handling", Detail = $"{pallets} pallet(s) × R{rc.PalletHandlingFee:N2}", Amount = pallets * rc.PalletHandlingFee });

                var core = sp.Lines.Sum(l => l.Amount);
                if (s.Fragile && rc.FragileSurchargePct > 0)
                    sp.Lines.Add(new QuoteChargeLine { Label = "Fragile handling", Detail = $"{rc.FragileSurchargePct:N1}% of freight", Amount = Math.Round(core * rc.FragileSurchargePct / 100m, 2) });
                if (s.Hazardous && rc.HazardousSurcharge > 0)
                    sp.Lines.Add(new QuoteChargeLine { Label = "Hazardous goods", Detail = string.IsNullOrWhiteSpace(s.HazardClass) ? "Dangerous goods surcharge" : $"UN class {s.HazardClass}", Amount = rc.HazardousSurcharge });
                if (!string.IsNullOrWhiteSpace(s.TempRange) && rc.TemperatureSurchargePct > 0)
                    sp.Lines.Add(new QuoteChargeLine { Label = "Temperature control", Detail = $"{s.TempRange} · {rc.TemperatureSurchargePct:N1}% of freight", Amount = Math.Round(core * rc.TemperatureSurchargePct / 100m, 2) });
                if (rc.FuelSurchargePct > 0)
                    sp.Lines.Add(new QuoteChargeLine { Label = "Fuel surcharge", Detail = $"{rc.FuelSurchargePct:N1}%", Amount = Math.Round(core * rc.FuelSurchargePct / 100m, 2) });

                sp.Subtotal = Math.Round(sp.Lines.Sum(l => l.Amount), 2);
                result.Shipments.Add(sp);
            }

            result.Subtotal = Math.Round(result.Shipments.Sum(s => s.Subtotal), 2);
            result.Vat = Math.Round(result.Subtotal * rc.VatRatePct / 100m, 2);
            result.Total = result.Subtotal + result.Vat;
            if (result.Shipments.Any(s => s.DistanceEstimated))
                result.Notes.Add("One or more distances are estimated because an address has not been pinned on the map. The final charge is based on the actual route.");
            result.Notes.Add($"Quote valid for {rc.ValidityDays} days. Prices in ZAR, VAT at {rc.VatRatePct:N0}% shown separately.");
            result.Notes.Add("Chargeable weight is the greater of actual and volumetric weight (L×W×H cm ÷ " + rc.VolumetricDivisor.ToString("N0") + ").");
            return result;
        }

        private static PortalAddress? Resolve(PortalAddressInput? a, IReadOnlyDictionary<int, ShipmentAddress> book)
        {
            if (a == null) return null;
            if (a.AddressId.HasValue && book.TryGetValue(a.AddressId.Value, out var b))
                return new PortalAddress { Label = b.Label, Street = b.Line1, Unit = b.Line2, Suburb = b.Suburb, City = b.City, Province = b.Province, PostalCode = b.PostalCode, Lat = b.Latitude, Lng = b.Longitude };
            return a.Address;
        }

        private static string Place(PortalAddress? a) => a == null ? "—" : string.Join(", ", new[] { a.Label, a.Suburb, a.City, a.Province }.Where(x => !string.IsNullOrWhiteSpace(x)).Distinct());

        private static (decimal km, bool estimated) Distance(PortalAddress? a, PortalAddress? b, PortalRateCard rc)
        {
            if (a?.Lat != null && a.Lng != null && b?.Lat != null && b.Lng != null)
                return ((decimal)Haversine(a.Lat.Value, a.Lng.Value, b.Lat.Value, b.Lng.Value) * rc.RoadFactor, false);
            var pa = a?.Province ?? ""; var pb = b?.Province ?? "";
            if (!string.IsNullOrWhiteSpace(pa) && pa.Equals(pb, StringComparison.OrdinalIgnoreCase))
            {
                var sameCity = !string.IsNullOrWhiteSpace(a?.City) && string.Equals(a!.City, b?.City, StringComparison.OrdinalIgnoreCase);
                return (sameCity ? rc.LocalRadiusKm : rc.LocalFallbackKm, true);
            }
            if (ProvinceCentroids.TryGetValue(pa, out var ca) && ProvinceCentroids.TryGetValue(pb, out var cb))
                return ((decimal)Haversine(ca.lat, ca.lng, cb.lat, cb.lng) * rc.RoadFactor, true);
            return (rc.ProvinceFallbackKm, true);
        }

        private static double Haversine(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371.0;
            double dLat = (lat2 - lat1) * Math.PI / 180, dLon = (lon2 - lon1) * Math.PI / 180;
            double x = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return R * 2 * Math.Atan2(Math.Sqrt(x), Math.Sqrt(1 - x));
        }

        // ------------------------------------------------------------------ PDF

        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
        private static string E(string? v) => WebUtility.HtmlEncode(v ?? string.Empty);
        private static string R(decimal v) => "R " + v.ToString("N2");

        public byte[] RenderPdf(PortalQuote q, string customerName, string? requestedBy)
        {
            var pricing = JsonSerializer.Deserialize<QuotePricing>(q.PricingJson, Json) ?? new QuotePricing();
            var request = JsonSerializer.Deserialize<PortalBookingRequest>(q.RequestJson, Json) ?? new PortalBookingRequest();

            var blocks = string.Join("", pricing.Shipments.Select(s =>
            {
                var req = request.Shipments != null && s.Index - 1 < request.Shipments.Count ? request.Shipments[s.Index - 1] : null;
                var cargo = string.Join("", (req?.Cargo ?? new()).Select(c => $"<tr><td>{E(c.Type)}</td><td>{c.Qty}</td><td>{c.WeightKg:N1}</td><td>{(c.LengthCm.HasValue ? $"{c.LengthCm:N0}×{c.WidthCm:N0}×{c.HeightCm:N0}" : "")}</td><td>{E(c.Description)}</td></tr>"));
                var lines = string.Join("", s.Lines.Select(l => $"<tr><td>{E(l.Label)}</td><td class='muted'>{E(l.Detail)}</td><td class='amt'>{R(l.Amount)}</td></tr>"));
                var flags = new List<string>();
                if (req?.Fragile == true) flags.Add("Fragile");
                if (req?.Hazardous == true) flags.Add("Hazardous" + (string.IsNullOrWhiteSpace(req.HazardClass) ? "" : " class " + req.HazardClass));
                if (!string.IsNullOrWhiteSpace(req?.TempRange)) flags.Add("Temp " + req!.TempRange);
                return $@"
<div class='ship'>
  <div class='ship-head'>Shipment {s.Index} <span class='muted'>· {E(s.From)} → {E(s.To)}</span></div>
  <table class='meta'><tr>
    <td><b>Collect</b> {E(s.CollectionDate)}{(string.IsNullOrWhiteSpace(req?.WindowFrom) ? "" : $" {E(req!.WindowFrom)}–{E(req.WindowTo)}")}</td>
    <td><b>Deliver by</b> {E(s.DeliverBy)}</td>
    <td><b>Distance</b> {s.DistanceKm:N0} km{(s.DistanceEstimated ? " (est.)" : "")}</td>
    <td><b>Handling</b> {(flags.Count == 0 ? "—" : E(string.Join(" · ", flags)))}</td></tr></table>
  <table class='items'><thead><tr><th>Type</th><th>Qty</th><th>Kg each</th><th>L×W×H cm</th><th>Description</th></tr></thead><tbody>{cargo}</tbody>
    <tfoot><tr><th colspan='5'>{s.Pallets} pallet(s) · {s.Parcels} parcel(s) · actual {s.WeightKg:N1} kg · volumetric {s.VolumetricKg:N1} kg · <b>chargeable {s.ChargeableKg:N1} kg</b></th></tr></tfoot></table>
  <table class='charges'>{lines}<tr class='sub'><td colspan='2'>Shipment {s.Index} subtotal (excl. VAT)</td><td class='amt'>{R(s.Subtotal)}</td></tr></table>
</div>";
            }));

            var html = $@"<html><head><style>
body{{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#222;margin:0}}
.hdr{{display:table;width:100%;border-bottom:2px solid #033142;padding-bottom:6px;margin-bottom:10px}}
.hdr>div{{display:table-cell;vertical-align:middle}}
.no{{font-size:20pt;font-weight:bold;color:#033142;letter-spacing:1px}}
.muted{{color:#666;font-size:9pt}}
table.meta td{{padding:2px 10px 2px 0;font-size:9pt}}
.ship{{border:1px solid #bbb;border-radius:4px;padding:8px;margin:10px 0}}
.ship-head{{font-size:12pt;font-weight:bold;color:#033142;margin-bottom:4px}}
table.items,table.charges{{width:100%;border-collapse:collapse;margin-top:6px}}
table.items th,table.items td{{border:1px solid #ccc;padding:3px 6px;font-size:8.5pt;text-align:left}}
table.items th{{background:#eef3f5}}
table.charges td{{padding:3px 6px;font-size:9pt;border-bottom:1px solid #eee}}
table.charges .amt{{text-align:right;width:110px;white-space:nowrap}}
table.charges tr.sub td{{font-weight:bold;border-top:1px solid #999;border-bottom:0}}
.totals{{width:320px;margin-left:auto;margin-top:12px;border-collapse:collapse}}
.totals td{{padding:4px 8px;font-size:10pt}}
.totals .amt{{text-align:right}}
.totals tr.grand td{{font-size:13pt;font-weight:bold;color:#033142;border-top:2px solid #033142}}
.notes{{font-size:8pt;color:#555;margin-top:16px}}
.badge{{display:inline-block;background:#fff3cd;color:#7a4b00;border:1px solid #e6c15a;padding:1px 8px;border-radius:999px;font-size:8pt;font-weight:bold}}
</style></head><body>
<div class='hdr'>
  <div style='width:30%'><img src='data:image/png;base64,{CompanyAssets.LOGO_BASE64}' style='height:48px'/></div>
  <div style='text-align:center'><div class='no'>{E(q.QuoteNo)}</div><div class='muted'>QUOTATION · {q.CreatedAt.AddHours(2):dd MMM yyyy HH:mm} · <span class='badge'>{E(q.Status)}</span></div></div>
  <div style='width:30%;text-align:right;font-size:9pt'>Valid until<br/><b>{q.ValidUntil.AddHours(2):dd MMM yyyy}</b></div>
</div>
<table class='meta'><tr>
<td><b>Client</b> {E(customerName)}</td><td><b>Client ref</b> {E(q.ClientReference)}</td>
<td><b>Requested by</b> {E(requestedBy)}</td><td><b>Shipments</b> {q.ShipmentCount} · {q.TotalWeightKg:N0} kg</td></tr></table>
{blocks}
<table class='totals'>
<tr><td>Subtotal (excl. VAT)</td><td class='amt'>{R(pricing.Subtotal)}</td></tr>
<tr><td>VAT {pricing.VatRate:N0}%</td><td class='amt'>{R(pricing.Vat)}</td></tr>
<tr class='grand'><td>Total</td><td class='amt'>{R(pricing.Total)}</td></tr>
</table>
<div class='notes'>{string.Join("", pricing.Notes.Select(n => $"<div>• {E(n)}</div>"))}
<div>• This quotation is saved as a draft booking on your portal. Open <i>Book a shipment</i> and choose <b>Book this quote</b> to place it; Rocket Freight then confirms collection.</div>
<div>• Rocket Freight standard conditions of carriage apply. Waiting time, failed collection/delivery attempts and re-deliveries are charged at standard rates.</div></div>
</body></html>";

            using var ms = new MemoryStream();
            using (var writer = new PdfWriter(ms))
            using (var pdf = new PdfDocument(writer))
            {
                pdf.SetDefaultPageSize(iText.Kernel.Geom.PageSize.A4);
                HtmlConverter.ConvertToPdf(html, pdf, new ConverterProperties());
            }
            return ms.ToArray();
        }
    }
}
