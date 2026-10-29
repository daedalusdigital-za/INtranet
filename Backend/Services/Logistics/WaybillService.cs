using System.Net;
using System.Security.Cryptography;
using iText.Html2pdf;
using iText.Kernel.Pdf;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Constants;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics.Shipments;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// Issues waybills (WB-YYYY-NNNNNN + random tracking token) and renders the A4 waybill
    /// and A6 label PDFs using the shared <see cref="CodeRenderer"/> (Code128 for the waybill
    /// number, QR for the public tracking URL).
    /// </summary>
    public interface IWaybillService
    {
        Task<ShipmentWaybill> IssueAsync(Shipment shipment, int? userId);
        Task<byte[]> RenderWaybillPdfAsync(int shipmentId);
        Task<byte[]> RenderLabelPdfAsync(int shipmentId);
        Task<byte[]> RenderPodPdfAsync(int shipmentId);
        string TrackingUrl(string token);
    }

    public class WaybillService : IWaybillService
    {
        private readonly ApplicationDbContext _db;
        private readonly INumberSequenceService _seq;
        private readonly IConfiguration _config;

        public WaybillService(ApplicationDbContext db, INumberSequenceService seq, IConfiguration config)
        {
            _db = db; _seq = seq; _config = config;
        }

        public string TrackingUrl(string token)
            => $"{(_config["Shipments:PortalBaseUrl"] ?? "https://192.168.10.151").TrimEnd('/')}/t/{token}";

        public async Task<ShipmentWaybill> IssueAsync(Shipment shipment, int? userId)
        {
            var existing = await _db.ShipmentWaybills.FirstOrDefaultAsync(w => w.ShipmentId == shipment.Id);
            if (existing != null) return existing;

            var no = await _seq.NextAsync("WB");
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(12)).ToLowerInvariant(); // 24 chars
            var wb = new ShipmentWaybill
            {
                ShipmentId = shipment.Id,
                WaybillNo = no,
                BarcodeValue = no,
                TrackingToken = token,
                QrValue = TrackingUrl(token),
                IssuedByUserId = userId
            };
            _db.ShipmentWaybills.Add(wb);

            // Item labels: WB-2026-000123-01 … per pallet/parcel line.
            var items = await _db.ShipmentItems.Where(i => i.ShipmentId == shipment.Id).OrderBy(i => i.Id).ToListAsync();
            for (int i = 0; i < items.Count; i++) items[i].ItemBarcode = $"{no}-{(i + 1):D2}";

            await _db.SaveChangesAsync();
            return wb;
        }

        private async Task<Shipment> LoadAsync(int shipmentId)
        {
            return await _db.Shipments.AsNoTracking()
                .Include(s => s.Booking).ThenInclude(b => b.Customer)
                .Include(s => s.PickupAddress)
                .Include(s => s.DeliveryAddress)
                .Include(s => s.Items)
                .Include(s => s.Waybill)
                .Include(s => s.Pod)
                .Include(s => s.Load)
                .FirstOrDefaultAsync(s => s.Id == shipmentId)
                ?? throw new KeyNotFoundException("Shipment not found");
        }

        public async Task<byte[]> RenderWaybillPdfAsync(int shipmentId)
        {
            var s = await LoadAsync(shipmentId);
            if (s.Waybill == null) throw new InvalidOperationException("Waybill not issued yet");
            return HtmlToPdf(WaybillHtml(s), iText.Kernel.Geom.PageSize.A4);
        }

        public async Task<byte[]> RenderLabelPdfAsync(int shipmentId)
        {
            var s = await LoadAsync(shipmentId);
            if (s.Waybill == null) throw new InvalidOperationException("Waybill not issued yet");
            return HtmlToPdf(LabelsHtml(s), iText.Kernel.Geom.PageSize.A6);
        }

        public async Task<byte[]> RenderPodPdfAsync(int shipmentId)
        {
            var s = await LoadAsync(shipmentId);
            if (s.Waybill == null || s.Pod == null) throw new InvalidOperationException("No proof of delivery captured yet");
            return HtmlToPdf(PodHtml(s), iText.Kernel.Geom.PageSize.A4);
        }

        private static byte[] HtmlToPdf(string html, iText.Kernel.Geom.PageSize size)
        {
            using var ms = new MemoryStream();
            using (var writer = new PdfWriter(ms))
            using (var pdf = new PdfDocument(writer))
            {
                pdf.SetDefaultPageSize(size);
                HtmlConverter.ConvertToPdf(html, pdf, new ConverterProperties());
            }
            return ms.ToArray();
        }

        private static string E(string? v) => WebUtility.HtmlEncode(v ?? string.Empty);
        private static string Flags(Shipment s)
        {
            var f = new List<string>();
            if (s.Fragile) f.Add("FRAGILE");
            if (s.Hazardous) f.Add($"HAZARDOUS{(string.IsNullOrWhiteSpace(s.HazardClass) ? "" : " class " + s.HazardClass)}");
            if (!string.IsNullOrWhiteSpace(s.TemperatureRange)) f.Add($"TEMP {s.TemperatureRange}");
            return f.Count == 0 ? "—" : string.Join(" · ", f.Select(E));
        }

        private static string AddressBlock(string title, ShipmentAddress a) => $@"
<div class='box'><div class='box-title'>{title}</div>
<div class='addr'>{E(a.Label)}{(string.IsNullOrWhiteSpace(a.Label) ? "" : "<br/>")}{E(a.Line1)}<br/>{(string.IsNullOrWhiteSpace(a.Line2) ? "" : E(a.Line2) + "<br/>")}{E(a.Suburb)} {E(a.City)}<br/>{E(a.Province)} {E(a.PostalCode)}</div>
<div class='contact'><b>{E(a.ContactName)}</b> {E(a.ContactPhone)}<br/>{E(a.ContactEmail)}</div></div>";

        private const string Css = @"
body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#222;margin:0}
.hdr{display:table;width:100%;border-bottom:2px solid #033142;padding-bottom:6px;margin-bottom:10px}
.hdr>div{display:table-cell;vertical-align:middle}
.wb{font-size:20pt;font-weight:bold;color:#033142;letter-spacing:1px}
.grid{display:table;width:100%;border-spacing:8px 0}
.grid>div{display:table-cell;width:50%;vertical-align:top}
.box{border:1px solid #999;padding:8px;min-height:90px;margin-bottom:8px}
.box-title{font-size:8pt;text-transform:uppercase;color:#666;margin-bottom:4px}
.addr{font-size:11pt;line-height:1.3}
.contact{margin-top:6px;font-size:9pt;color:#444}
table.items{width:100%;border-collapse:collapse;margin-top:6px}
table.items th,table.items td{border:1px solid #bbb;padding:4px 6px;text-align:left;font-size:9pt}
table.items th{background:#eef3f5}
.meta td{padding:2px 10px 2px 0;font-size:9pt}
.codes{text-align:center;margin-top:10px}
.sig{display:table;width:100%;margin-top:18px}
.sig>div{display:table-cell;width:33%;padding:0 6px}
.sig .line{border-top:1px solid #333;margin-top:34px;font-size:8pt;color:#555;padding-top:2px}
.badge{display:inline-block;border:1px solid #c00;color:#c00;padding:1px 6px;font-size:8pt;font-weight:bold;margin-right:4px}
";

        private string WaybillHtml(Shipment s)
        {
            var wb = s.Waybill!;
            var items = string.Join("", s.Items.Select((i, idx) => $@"<tr><td>{idx + 1}</td><td>{E(i.Type)}</td><td>{i.Qty}</td><td>{i.WeightKg:N1}</td>
<td>{(i.LengthCm.HasValue ? $"{i.LengthCm:N0}×{i.WidthCm:N0}×{i.HeightCm:N0}" : "")}</td><td>{E(i.Description)}</td><td>{E(i.ItemBarcode)}</td></tr>"));
            return $@"<html><head><style>{Css}</style></head><body>
<div class='hdr'>
  <div style='width:30%'><img src='data:image/png;base64,{CompanyAssets.LOGO_BASE64}' style='height:48px'/></div>
  <div style='text-align:center'><div class='wb'>{wb.WaybillNo}</div><div style='font-size:8pt;color:#666'>WAYBILL · issued {wb.IssuedAt.AddHours(2):dd MMM yyyy HH:mm}</div></div>
  <div style='width:30%;text-align:right'><img src='data:image/png;base64,{CodeRenderer.QrPngBase64(wb.QrValue, 4)}' style='height:84px'/></div>
</div>
<table class='meta'><tr>
<td><b>Client</b> {E(s.Booking.Customer?.Name)}</td><td><b>Booking</b> {s.Booking.BookingNo}</td>
<td><b>Client ref</b> {E(s.Booking.ClientReference)}</td><td><b>Load</b> {E(s.Load?.LoadNumber)}</td></tr>
<tr><td><b>Collection</b> {s.CollectionDate:dd MMM yyyy} {E(s.CollectionWindowFrom)}–{E(s.CollectionWindowTo)}</td>
<td><b>Requested delivery</b> {s.RequestedDeliveryDate:dd MMM yyyy}</td><td colspan='2'><b>Handling</b> {Flags(s)}</td></tr></table>
<div class='grid'><div>{AddressBlock("Collect from (shipper)", s.PickupAddress)}</div><div>{AddressBlock("Deliver to (consignee)", s.DeliveryAddress)}</div></div>
<table class='items'><thead><tr><th>#</th><th>Type</th><th>Qty</th><th>Kg</th><th>L×W×H cm</th><th>Description</th><th>Item code</th></tr></thead>
<tbody>{items}</tbody>
<tfoot><tr><th colspan='2'>Totals</th><th>{s.TotalPallets + s.TotalParcels}</th><th>{s.TotalWeightKg:N1}</th><th colspan='3'>{s.TotalPallets} pallet(s) · {s.TotalParcels} parcel(s)</th></tr></tfoot></table>
{(string.IsNullOrWhiteSpace(s.SpecialInstructions) ? "" : $"<p><b>Special instructions:</b> {E(s.SpecialInstructions)}</p>")}
<div class='codes'><img src='data:image/png;base64,{CodeRenderer.Code128PngBase64(wb.BarcodeValue, 3, 70)}' style='height:60px'/><div style='font-family:monospace;font-size:11pt'>{wb.BarcodeValue}</div></div>
<div class='sig'>
 <div><div class='line'>Shipper signature · date/time</div></div>
 <div><div class='line'>Driver signature · vehicle reg</div></div>
 <div><div class='line'>Receiver name · signature · date/time</div></div>
</div>
<p style='font-size:7.5pt;color:#777;margin-top:14px'>Goods received in apparent good order unless noted. Scan the QR code to track this shipment. Rocket Freight standard conditions of carriage apply.</p>
</body></html>";
        }

        private string LabelsHtml(Shipment s)
        {
            var wb = s.Waybill!;
            var n = Math.Max(1, s.Items.Sum(i => Math.Max(1, i.Qty)));
            var pages = new List<string>();
            int k = 0;
            foreach (var item in s.Items.DefaultIfEmpty())
            {
                var qty = item == null ? 1 : Math.Max(1, item.Qty);
                for (int q = 0; q < qty; q++)
                {
                    k++;
                    pages.Add($@"<div class='label'>
<div class='top'><img src='data:image/png;base64,{CompanyAssets.LOGO_BASE64}' style='height:26px'/><span class='n'>{k} of {n}</span></div>
<div class='wbno'>{wb.WaybillNo}</div>
<img src='data:image/png;base64,{CodeRenderer.Code128PngBase64(wb.BarcodeValue, 3, 70)}' style='width:92%;height:54px'/>
<div class='to'>TO: <b>{E(s.DeliveryAddress.ContactName)}</b><br/>{E(s.DeliveryAddress.Line1)}<br/><span class='sub'>{E(s.DeliveryAddress.Suburb ?? s.DeliveryAddress.City)}</span> {E(s.DeliveryAddress.PostalCode)}</div>
<div class='bottom'><div class='from'>FROM: {E(s.PickupAddress.Suburb ?? s.PickupAddress.City)}<br/>{E(s.Booking.Customer?.Name)}<br/>{E(item?.Description)}<br/>{(s.Fragile ? "<span class='badge'>FRAGILE</span>" : "")}{(s.Hazardous ? "<span class='badge'>HAZ</span>" : "")}{(string.IsNullOrWhiteSpace(s.TemperatureRange) ? "" : $"<span class='badge'>{E(s.TemperatureRange)}</span>")}</div>
<img src='data:image/png;base64,{CodeRenderer.QrPngBase64(wb.QrValue, 3)}' style='height:64px'/></div>
<div class='item'>{E(item?.ItemBarcode)}</div>
</div>");
                }
            }
            return $@"<html><head><style>{Css}
@page{{margin:4mm}}
.label{{page-break-after:always;padding:2mm;height:138mm;box-sizing:border-box}}
.top{{display:table;width:100%}} .top img{{display:table-cell}} .n{{float:right;font-size:11pt;font-weight:bold}}
.wbno{{font-size:17pt;font-weight:bold;text-align:center;margin:3mm 0 1mm;color:#033142}}
.to{{font-size:12pt;margin-top:3mm;line-height:1.25}} .sub{{font-size:16pt;font-weight:bold;text-transform:uppercase}}
.bottom{{display:table;width:100%;margin-top:3mm}} .bottom>*{{display:table-cell;vertical-align:bottom}}
.from{{font-size:8.5pt;color:#444}}
.item{{font-family:monospace;font-size:9pt;text-align:right;color:#555;margin-top:2mm}}
</style></head><body>{string.Join("", pages)}</body></html>";
        }

        private string PodHtml(Shipment s)
        {
            var wb = s.Waybill!; var pod = s.Pod!;
            var photos = System.Text.Json.JsonSerializer.Deserialize<List<string>>(pod.PhotoPathsJson ?? "[]") ?? new();
            var root = Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            string Img(string? rel, string style)
            {
                if (string.IsNullOrWhiteSpace(rel)) return "";
                var p = Path.Combine(root, rel.Replace('/', Path.DirectorySeparatorChar));
                if (!File.Exists(p)) return "";
                var ext = Path.GetExtension(p).TrimStart('.').ToLowerInvariant();
                return $"<img src='data:image/{(ext == "jpg" ? "jpeg" : ext)};base64,{Convert.ToBase64String(File.ReadAllBytes(p))}' style='{style}'/>";
            }
            var items = string.Join("", s.Items.Select(i => $"<tr><td>{E(i.Type)}</td><td>{i.Qty}</td><td>{i.WeightKg:N1}</td><td>{E(i.Description)}</td></tr>"));
            return $@"<html><head><style>{Css}</style></head><body>
<div class='hdr'><div style='width:30%'><img src='data:image/png;base64,{CompanyAssets.LOGO_BASE64}' style='height:48px'/></div>
<div style='text-align:center'><div class='wb'>{wb.WaybillNo}</div><div style='font-size:9pt;color:#666'>PROOF OF DELIVERY</div></div>
<div style='width:30%;text-align:right'><img src='data:image/png;base64,{CodeRenderer.Code128PngBase64(wb.BarcodeValue, 2, 50)}' style='height:40px'/></div></div>
<div class='grid'><div>{AddressBlock("Collected from", s.PickupAddress)}</div><div>{AddressBlock("Delivered to", s.DeliveryAddress)}</div></div>
<table class='items'><thead><tr><th>Type</th><th>Qty</th><th>Kg</th><th>Description</th></tr></thead><tbody>{items}</tbody></table>
<div class='box' style='margin-top:10px'><div class='box-title'>Delivery</div>
<table class='meta'>
<tr><td><b>Delivered at</b></td><td>{pod.DeliveredAt.AddHours(2):dd MMM yyyy HH:mm} SAST</td></tr>
<tr><td><b>Received by</b></td><td>{E(pod.ReceiverName)}</td></tr>
<tr><td><b>GPS</b></td><td>{(pod.Latitude.HasValue ? $"{pod.Latitude:F5}, {pod.Longitude:F5}" : "—")}</td></tr>
<tr><td><b>Flags</b></td><td>{(s.DamagedFlag ? "<span class='badge'>DAMAGED</span>" : "")}{(s.ShortFlag ? "<span class='badge'>SHORT DELIVERED</span>" : "")}{(!s.DamagedFlag && !s.ShortFlag ? "None" : "")}</td></tr>
<tr><td><b>Driver note</b></td><td>{E(pod.Note)}</td></tr></table>
<div style='margin-top:8px'><div class='box-title'>Receiver signature</div>{Img(pod.SignaturePath, "max-height:90px;border:1px solid #ccc")}</div>
<div style='margin-top:8px'>{string.Join(" ", photos.Select(p => Img(p, "max-height:140px;margin:3px;border:1px solid #ccc")))}</div>
</div>
<p style='font-size:7.5pt;color:#777'>Generated {DateTime.UtcNow.AddHours(2):dd MMM yyyy HH:mm} SAST · Track: {TrackingUrl(wb.TrackingToken)}</p>
</body></html>";
        }
    }
}
