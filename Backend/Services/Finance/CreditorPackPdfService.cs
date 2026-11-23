using System.Net;
using iText.Html2pdf;
using iText.IO.Image;
using iText.Kernel.Colors;
using iText.Kernel.Font;
using iText.Kernel.Geom;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas;
using iText.Kernel.Utils;
using iText.IO.Font.Constants;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance.Creditors;
using ProjectTracker.API.Models.Signatures;

namespace ProjectTracker.API.Services.Finance;

/// <summary>
/// Builds the PDFs that carry the digital signatures of a payment pack:
///  • the approval sheet (schedule + signature block), and
///  • the signed pack (approval sheet + every uploaded PDF, each stamped with the signature block on its last page).
/// </summary>
public class CreditorPackPdfService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<CreditorPackPdfService> _log;
    public CreditorPackPdfService(ApplicationDbContext db, ILogger<CreditorPackPdfService> log) { _db = db; _log = log; }

    private record Slot(string Title, string Context, ElectronicSignature? Sig);

    private async Task<List<Slot>> SlotsAsync(PaymentBatch b)
    {
        var sigs = await _db.ElectronicSignatures.AsNoTracking()
            .Where(s => s.EntityType == "PaymentBatch" && s.EntityId == b.Id)
            .OrderByDescending(s => s.SignedAtUtc).ToListAsync();
        ElectronicSignature? Latest(string ctx) => sigs.FirstOrDefault(s => s.Context == ctx);
        return new List<Slot>
        {
            new("Prepared & checked by", "PreparerSubmission", Latest("PreparerSubmission")),
            new("Approved by (Accountant)", "AccountantApproval", Latest("AccountantApproval")),
            new("Signed by (Director)", "DirectorSignOff", Latest("DirectorSignOff")),
        };
    }

    /// <summary>Printable payment schedule (landscape): one line per payment with full bank details, decision and
    /// hand-signature lines. Usable at any stage — a draft prints as a working list, a signed pack as the record.</summary>
    public async Task<byte[]> ScheduleAsync(PaymentBatch b)
    {
        var slots = await SlotsAsync(b);
        var company = await _db.CreditorCompanies.AsNoTracking().Where(c => c.Code == b.CompanyCode).Select(c => c.Name).FirstOrDefaultAsync() ?? b.CompanyCode;
        var html = ScheduleHtml(b, company, slots);
        using var ms = new MemoryStream();
        using (var writer = new PdfWriter(ms))
        using (var pdf = new PdfDocument(writer))
        {
            pdf.SetDefaultPageSize(PageSize.A4.Rotate());
            HtmlConverter.ConvertToPdf(html, pdf, new ConverterProperties());
        }
        return ms.ToArray();
    }

    public sealed record RequisitionForm(string Company, string BatchNumber, string EmployeeName, string? EmployeeNumber, string? Department,
        string Reason, decimal Amount, string RequestedBy, string? AuthorisedBy, DateTime Date, string? Notes,
        string PayoutMethod, string? BankName, string? AccountNumber, string? BranchCode, string? AccountHolder, string CapturedBy, bool Staff = true);

    /// <summary>Staff payment requisition filled in on the intranet (A4 portrait). Returns the PDF and the plain text the checks read.</summary>
    public (byte[] Pdf, string Text) Requisition(RequisitionForm f)
    {
        static string E(string? s) => WebUtility.HtmlEncode(s ?? "");
        var ewallet = f.PayoutMethod == "eWallet";
        var payout = ewallet
            ? $"eWallet · {E(f.AccountNumber)}"
            : string.IsNullOrWhiteSpace(f.AccountNumber) ? "EFT · bank details to follow (from the bank statement)"
            : $"EFT · {E(f.BankName)} · Acc {E(f.AccountNumber)}{(string.IsNullOrWhiteSpace(f.BranchCode) ? "" : " · Branch " + E(f.BranchCode))}{(string.IsNullOrWhiteSpace(f.AccountHolder) ? "" : " · " + E(f.AccountHolder))}";
        string Row(string k, string v) => $"<tr><th>{k}</th><td>{v}</td></tr>";
        var html = $@"<html><head><meta charset='utf-8'><style>
body{{font-family:Helvetica,Arial,sans-serif;font-size:11pt;color:#111;margin:28px}}
h1{{font-size:18pt;margin:0 0 2px}} .sub{{color:#555;font-size:9.5pt;margin-bottom:18px}}
table{{width:100%;border-collapse:collapse;margin-bottom:18px}} th,td{{border:1px solid #bbb;padding:7px 9px;text-align:left;vertical-align:top}}
th{{width:32%;background:#f3f4f6;font-weight:bold}} .amt{{font-size:14pt;font-weight:bold}}
.sig{{width:100%;margin-top:36px}} .sig td{{border:none;padding:0 12px 0 0;width:33%}} .line{{border-top:1px solid #333;padding-top:4px;font-size:9pt;color:#444;margin-top:44px}}
.foot{{margin-top:28px;font-size:8.5pt;color:#777}}
</style></head><body>
<h1>{(f.Staff ? "Staff payment requisition" : "Payment requisition")}</h1>
<div class='sub'>{E(f.Company)} · Payment pack {E(f.BatchNumber)} · Date {f.Date:dd MMM yyyy}</div>
<table>
{Row(f.Staff ? "Paid to (staff member)" : "Paid to", E(f.EmployeeName))}
{Row(f.Staff ? "Employee no. / ID" : "ID / reference no.", E(f.EmployeeNumber))}
{Row("Department", E(f.Department))}
{Row("Reason for payment", E(f.Reason).Replace("\n", "<br>"))}
{Row("Amount", $"<span class='amt'>R {f.Amount:N2}</span>")}
{Row("Pay by", payout)}
{Row("Requested by", E(f.RequestedBy))}
{Row("Authorised by (manager)", E(f.AuthorisedBy))}
{(string.IsNullOrWhiteSpace(f.Notes) ? "" : Row("Notes", E(f.Notes).Replace("\n", "<br>")))}
</table>
<table class='sig'><tr>
<td><div class='line'>Requested by — signature &amp; date</div></td>
<td><div class='line'>Authorised by — signature &amp; date</div></td>
<td><div class='line'>Received by staff member</div></td>
</tr></table>
<div class='foot'>Requisition captured on the intranet by {E(f.CapturedBy)} on {DateTime.UtcNow.AddHours(2):dd MMM yyyy HH:mm:ss} (SAST). Approval of this payment is recorded electronically on the payment pack.</div>
</body></html>";
        using var ms = new MemoryStream();
        using (var writer = new PdfWriter(ms))
        using (var pdf = new PdfDocument(writer))
        {
            pdf.SetDefaultPageSize(PageSize.A4);
            HtmlConverter.ConvertToPdf(html, pdf, new ConverterProperties());
        }
        var text = $"{(f.Staff ? "STAFF PAYMENT REQUISITION" : "PAYMENT REQUISITION")}\n{f.Company}\nPaid to: {f.EmployeeName}\nEmployee no: {f.EmployeeNumber}\nDepartment: {f.Department}\nReason: {f.Reason}\nAmount: R {f.Amount:0.00}\nPay by: {f.PayoutMethod} {f.BankName} {f.AccountNumber} {f.BranchCode}\nRequested by: {f.RequestedBy}\nAuthorised by: {f.AuthorisedBy}\nDate: {f.Date:yyyy-MM-dd}\n{f.Notes}";
        return (ms.ToArray(), text);
    }

    public async Task<byte[]> ApprovalSheetAsync(PaymentBatch b)
    {
        var slots = await SlotsAsync(b);
        var company = await _db.CreditorCompanies.AsNoTracking().Where(c => c.Code == b.CompanyCode).Select(c => c.Name).FirstOrDefaultAsync() ?? b.CompanyCode;
        var html = ApprovalSheetHtml(b, company, slots);
        using var ms = new MemoryStream();
        using (var writer = new PdfWriter(ms))
        using (var pdf = new PdfDocument(writer))
        {
            pdf.SetDefaultPageSize(PageSize.A4);
            HtmlConverter.ConvertToPdf(html, pdf, new ConverterProperties());
        }
        return ms.ToArray();
    }

    /// <summary>Approval sheet + each uploaded PDF document (stamped). Non-PDF uploads are listed on the sheet but not merged.
    /// <paramref name="stamp"/>=false gives the unstamped reading copy approvers use before signing.</summary>
    /// <summary>Approval sheet followed by the pack's PDFs (stamped when <paramref name="stamp"/>). <paramref name="itemId"/> limits it to one payment's documents.</summary>
    public async Task<byte[]> SignedPackAsync(PaymentBatch b, Func<string, string> abs, bool stamp = true, int? itemId = null)
    {
        var slots = await SlotsAsync(b);
        var sheet = await ApprovalSheetAsync(b);
        using var outMs = new MemoryStream();
        using (var writer = new PdfWriter(outMs))
        using (var dest = new PdfDocument(writer))
        {
            var merger = new PdfMerger(dest);
            using (var src = new PdfDocument(new PdfReader(new MemoryStream(sheet)))) merger.Merge(src, 1, src.GetNumberOfPages());
            var docs = b.Documents.Where(d => d.StoragePath != null && !d.IsNotApplicable && (d.ContentType ?? "").Contains("pdf", StringComparison.OrdinalIgnoreCase)
                                              && (itemId == null || d.ItemId == itemId))
                .OrderBy(d => d.ItemId ?? 0).ThenBy(d => d.Id);
            foreach (var d in docs)
            {
                var path = abs(d.StoragePath!);
                if (!File.Exists(path)) continue;
                try
                {
                    var stamped = stamp ? Stamp(File.ReadAllBytes(path), b, slots, d) : File.ReadAllBytes(path);
                    using var src = new PdfDocument(new PdfReader(new MemoryStream(stamped)));
                    merger.Merge(src, 1, src.GetNumberOfPages());
                }
                catch (Exception e) { _log.LogWarning(e, "Could not merge {Doc} into signed pack {Batch}", d.OriginalFileName, b.BatchNumber); }
            }
        }
        return outMs.ToArray();
    }

    /// <summary>Draws the signature block (names, dates, images, hash) at the bottom of the last page of an existing PDF.</summary>
    private static byte[] Stamp(byte[] pdfBytes, PaymentBatch b, List<Slot> slots, PaymentBatchDocument d)
    {
        using var ms = new MemoryStream();
        using (var pdf = new PdfDocument(new PdfReader(new MemoryStream(pdfBytes)), new PdfWriter(ms)))
        {
            var page = pdf.GetLastPage();
            var size = page.GetPageSize();
            var canvas = new PdfCanvas(page.NewContentStreamAfter(), page.GetResources(), pdf);
            var font = PdfFontFactory.CreateFont(StandardFonts.HELVETICA);
            var bold = PdfFontFactory.CreateFont(StandardFonts.HELVETICA_BOLD);

            const float margin = 24f, blockH = 92f;
            var w = size.GetWidth() - margin * 2; var x0 = margin; var y0 = margin;
            // translucent white backing so the block stays legible over content
            canvas.SaveState().SetFillColor(new DeviceRgb(255, 255, 255)).SetExtGState(new iText.Kernel.Pdf.Extgstate.PdfExtGState().SetFillOpacity(0.92f))
                  .Rectangle(x0, y0, w, blockH).Fill().RestoreState();
            canvas.SetStrokeColor(new DeviceRgb(79, 70, 229)).SetLineWidth(1f).Rectangle(x0, y0, w, blockH).Stroke();

            canvas.BeginText().SetFontAndSize(bold, 8f).SetFillColor(new DeviceRgb(79, 70, 229)).MoveText(x0 + 8, y0 + blockH - 12)
                  .ShowText($"DIGITALLY SIGNED ON THE INTRANET  ·  Payment pack {b.BatchNumber}  ·  {b.CompanyCode}  ·  {(d.OriginalFileName ?? d.FileName ?? "")}").EndText();

            var colW = w / slots.Count;
            for (var i = 0; i < slots.Count; i++)
            {
                var s = slots[i]; var cx = x0 + i * colW + 8; var top = y0 + blockH - 24;
                canvas.BeginText().SetFontAndSize(bold, 7.5f).SetFillColor(new DeviceRgb(55, 65, 81)).MoveText(cx, top).ShowText(s.Title.ToUpperInvariant()).EndText();
                if (s.Sig == null)
                {
                    canvas.BeginText().SetFontAndSize(font, 8f).SetFillColor(new DeviceRgb(156, 163, 175)).MoveText(cx, top - 30).ShowText("— not yet signed —").EndText();
                    continue;
                }
                if (s.Sig.SignatureImage != null)
                {
                    try
                    {
                        var img = ImageDataFactory.Create(s.Sig.SignatureImage);
                        var maxW = colW - 16f; var maxH = 34f;
                        var scale = Math.Min(maxW / img.GetWidth(), maxH / img.GetHeight());
                        var iw = img.GetWidth() * scale; var ih = img.GetHeight() * scale;
                        canvas.AddImageFittedIntoRectangle(img, new Rectangle(cx, top - 10 - ih, iw, ih), false);
                    }
                    catch { }
                }
                canvas.BeginText().SetFontAndSize(bold, 8f).SetFillColor(new DeviceRgb(17, 24, 39)).MoveText(cx, y0 + 22).ShowText(Trunc(s.Sig.SignerName, 34)).EndText();
                canvas.BeginText().SetFontAndSize(font, 7f).SetFillColor(new DeviceRgb(75, 85, 99)).MoveText(cx, y0 + 12)
                      .ShowText($"{s.Sig.SignedAtUtc.ToLocalTime():dd MMM yyyy HH:mm}  ·  {s.Sig.Method}  ·  #{s.Sig.Id}").EndText();
                canvas.BeginText().SetFontAndSize(font, 6f).SetFillColor(new DeviceRgb(156, 163, 175)).MoveText(cx, y0 + 4)
                      .ShowText("hash " + (s.Sig.PayloadHash ?? "").Substring(0, Math.Min(24, (s.Sig.PayloadHash ?? "").Length))).EndText();
            }
        }
        return ms.ToArray();
    }

    private static string Trunc(string s, int n) => s.Length <= n ? s : s[..(n - 1)] + "…";
    private static string E(string? v) => WebUtility.HtmlEncode(v ?? "");

    private static string ScheduleHtml(PaymentBatch b, string company, List<Slot> slots)
    {
        var typeTitle = CreditorPaymentTypes.All.FirstOrDefault(p => p.Key == b.PaymentType).Title ?? b.PaymentType;
        var items = b.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).ToList();
        var toPay = items.Where(i => i.DecisionStatus != "Rejected").Sum(i => i.Amount);
        var prepay = b.PaymentType == CreditorPaymentTypes.Prepayment;
        var decided = items.Any(i => i.DecisionStatus != "Pending");
        string Row(PaymentBatchItem i, int n) => $@"<tr class='{(i.DecisionStatus == "Rejected" ? "rej" : "")}'>
<td class='c'>{n}</td><td><b>{E(i.SupplierName)}</b>{(i.IsUrgent ? " <span class='urg'>URGENT</span>" : "")}{(i.PaymentMode == CreditorPaymentModes.PayAndClear ? "<br/><em>pay &amp; clear</em>" : "")}{(string.IsNullOrWhiteSpace(i.Description) ? "" : "<br/><small>" + E(i.Description) + "</small>")}</td>
<td>{E(i.InvoiceNumbers)}</td><td>{E(i.BankName)}</td><td>{E(i.AccountHolder)}</td><td class='mono'>{(prepay && string.IsNullOrEmpty(i.AccountNumber) ? "<em>Treasury</em>" : E(i.AccountNumber))}</td><td class='mono'>{E(i.BranchCode)}</td><td>{E(i.PaymentReference)}</td>
<td class='r mono'>{i.Amount:N2}</td>{(decided ? $"<td>{E(i.DecisionStatus)}{(string.IsNullOrWhiteSpace(i.DecisionComment) ? "" : "<br/><small>" + E(i.DecisionComment) + "</small>")}</td>" : "<td class='tick'>&#9744;</td>")}</tr>";

        string SignLine(Slot s) => s.Sig != null
            ? $"<div class='sl'><div class='t'>{E(s.Title)}</div><div class='v'>{(s.Sig.SignatureImage != null ? $"<img src='data:{E(s.Sig.SignatureImageMimeType ?? "image/png")};base64,{Convert.ToBase64String(s.Sig.SignatureImage)}'/>" : "")}</div><div class='n'>{E(s.Sig.SignerName)} · {s.Sig.SignedAtUtc.ToLocalTime():dd MMM yyyy HH:mm}</div></div>"
            : $"<div class='sl'><div class='t'>{E(s.Title)}</div><div class='v line'></div><div class='n'>Name: ____________________ &nbsp; Date: ___________</div></div>";

        return $@"<!doctype html><html><head><meta charset='utf-8'/><style>
@page{{size:A4 landscape;margin:12mm}}
body{{font-family:Helvetica,Arial,sans-serif;font-size:9.5px;color:#111827;margin:0;padding:10px 14px}}
.hd{{display:table;width:100%;margin-bottom:8px}} .hd>div{{display:table-cell;vertical-align:top}} .hd .r{{text-align:right}}
h1{{font-size:16px;margin:0;color:#4f46e5}} .sub{{color:#6b7280;margin:2px 0 0}} .big{{font-size:15px;font-weight:bold}}
.meta{{color:#374151;margin:4px 0 0}} .meta b{{color:#111827}}
table{{width:100%;border-collapse:collapse;margin:6px 0 10px}} th{{text-align:left;background:#eef2ff;color:#3730a3;padding:5px 5px;font-size:8.5px;border-bottom:1px solid #c7d2fe;white-space:nowrap}} td{{padding:4px 5px;border-bottom:1px solid #e5e7eb;vertical-align:top}}
td.r,th.r{{text-align:right}} td.c{{text-align:center;color:#6b7280}} .mono{{font-family:'Courier New',monospace;font-size:9px;white-space:nowrap}} .tick{{font-size:13px;text-align:center}}
tr.rej td{{color:#9ca3af;text-decoration:line-through}} tr.tot td{{font-weight:bold;border-top:2px solid #4f46e5;border-bottom:0;font-size:10.5px}}
.urg{{color:#b91c1c;font-weight:bold;font-size:8px}} small{{color:#6b7280}} em{{color:#6b7280}}
.sigs{{display:table;width:100%;border-spacing:10px 0;margin:8px -10px 0}} .sl{{display:table-cell;width:33%;vertical-align:bottom}} .sl .t{{font-size:8px;text-transform:uppercase;letter-spacing:.04em;color:#4f46e5;font-weight:bold}}
.sl .v{{height:44px;margin:4px 0 2px;display:flex;align-items:flex-end}} .sl .v.line{{border-bottom:1px solid #111827}} .sl .v img{{max-height:42px;max-width:100%}} .sl .n{{font-size:8.5px;color:#374151}}
.foot{{margin-top:10px;color:#9ca3af;font-size:7.5px;border-top:1px solid #e5e7eb;padding-top:4px}}
</style></head><body>
<div class='hd'><div><h1>Payment schedule</h1><p class='sub'>{E(company)} ({E(b.CompanyCode)}) · {E(typeTitle)} · {E(b.BatchNumber)}</p>
<p class='meta'>Payment date <b>{b.BatchDate:dd MMM yyyy}</b> · Prepared by <b>{E(b.PreparedByName)}</b> · Status <b>{E(CreditorWorkflow.Title(b.Status))}</b>{(b.ScheduledPayDate != null ? " · Scheduled pay day <b>" + b.ScheduledPayDate.Value.ToString("dd MMM yyyy") + "</b>" : "")}{(string.IsNullOrWhiteSpace(b.Notes) ? "" : " · “" + E(b.Notes) + "”")}</p></div>
<div class='r'><div class='sub'>{items.Count} payment{(items.Count == 1 ? "" : "s")}</div><div class='big'>R {toPay:N2}</div>{(toPay != b.TotalAmount ? $"<div class='sub'>of R {b.TotalAmount:N2} requested</div>" : "")}</div></div>
<table><thead><tr><th>#</th><th>Supplier</th><th>Invoice(s)</th><th>Bank</th><th>Account holder</th><th>Account no.</th><th>Branch</th><th>Reference</th><th class='r'>Amount (R)</th><th>{(decided ? "Decision" : "Paid")}</th></tr></thead>
<tbody>{string.Concat(items.Select((i, n) => Row(i, n + 1)))}<tr class='tot'><td colspan='8'>Total to pay</td><td class='r mono'>{toPay:N2}</td><td></td></tr></tbody></table>
<div class='sigs'>{string.Concat(slots.Select(SignLine))}</div>
<div class='foot'>Printed from the intranet on {DateTime.Now:dd MMM yyyy HH:mm}{(b.LockedAt != null ? $" · pack signed and locked {b.LockedAt.Value.ToLocalTime():dd MMM yyyy HH:mm} · lock hash {E(b.LockHash)}" : " · working copy — the pack is not yet fully signed")}.</div>
</body></html>";
    }

    private static string ApprovalSheetHtml(PaymentBatch b, string company, List<Slot> slots)
    {
        var typeTitle = CreditorPaymentTypes.All.FirstOrDefault(p => p.Key == b.PaymentType).Title ?? b.PaymentType;
        var items = b.Items.OrderBy(i => i.SortOrder).ThenBy(i => i.Id).ToList();
        var approved = items.Where(i => i.DecisionStatus != "Rejected").Sum(i => i.Amount);
        var prepay = b.PaymentType == CreditorPaymentTypes.Prepayment;
        string Row(PaymentBatchItem i, int n) => $@"<tr class='{(i.DecisionStatus == "Rejected" ? "rej" : "")}'>
<td>{n}</td><td>{E(i.SupplierName)}{(i.IsUrgent ? " <b style='color:#b91c1c'>URGENT</b>" : "")}{(i.PaymentMode == CreditorPaymentModes.PayAndClear ? " <em>(pay &amp; clear)</em>" : "")}</td><td>{E(i.InvoiceNumbers)}</td><td>{E(i.Description)}</td><td>{(prepay && string.IsNullOrEmpty(i.AccountNumber) ? "<em>Treasury</em>" : E(i.AccountNumber))}</td><td class='r'>{i.Amount:N2}</td><td>{E(i.DecisionStatus)}</td></tr>";

        string Slot(Slot s)
        {
            if (s.Sig == null) return $@"<div class='sig empty'><div class='t'>{E(s.Title)}</div><div class='img'><span>Not yet signed</span></div><div class='n'>&nbsp;</div><div class='d'>&nbsp;</div></div>";
            var img = s.Sig.SignatureImage != null ? $"<img src='data:{E(s.Sig.SignatureImageMimeType ?? "image/png")};base64,{Convert.ToBase64String(s.Sig.SignatureImage)}'/>" : "<span class='typed'>" + E(s.Sig.SignerName) + "</span>";
            return $@"<div class='sig'><div class='t'>{E(s.Title)}</div><div class='img'>{img}</div><div class='n'>{E(s.Sig.SignerName)}</div>
<div class='d'>{s.Sig.SignedAtUtc.ToLocalTime():dd MMM yyyy HH:mm} · {E(s.Sig.Method)} · {E(s.Sig.Action)}{(string.IsNullOrWhiteSpace(s.Sig.Comment) ? "" : "<br/>“" + E(s.Sig.Comment) + "”")}</div>
<div class='h'>Signature #{s.Sig.Id} · hash {E((s.Sig.PayloadHash ?? "")[..Math.Min(16, (s.Sig.PayloadHash ?? "").Length)])}…</div></div>";
        }

        var docs = b.Documents.Where(d => !d.IsNotApplicable && d.StoragePath != null).OrderBy(d => d.ItemId ?? 0).ThenBy(d => d.Id)
            .Select(d => $"<li>{E(CreditorChecksService.Label(d.DocType))} — {E(d.OriginalFileName ?? d.FileName)}{(d.ItemId != null ? " <small>(" + E(items.FirstOrDefault(i => i.Id == d.ItemId)?.SupplierName) + ")</small>" : "")}</li>");

        return $@"<!doctype html><html><head><meta charset='utf-8'/><style>
body{{font-family:Helvetica,Arial,sans-serif;font-size:10.5px;color:#111827;margin:0;padding:18px 22px}}
h1{{font-size:18px;margin:0 0 2px;color:#4f46e5}} .sub{{color:#6b7280;margin:0 0 14px}}
.meta{{display:table;width:100%;border-collapse:collapse;margin-bottom:12px}} .meta div{{display:table-row}} .meta span{{display:table-cell;padding:3px 10px 3px 0;color:#6b7280;width:120px}} .meta b{{display:table-cell;padding:3px 0}}
table.items{{width:100%;border-collapse:collapse;margin:8px 0 14px}} table.items th{{text-align:left;background:#eef2ff;color:#3730a3;padding:5px 6px;font-size:9.5px;border-bottom:1px solid #c7d2fe}} table.items td{{padding:4px 6px;border-bottom:1px solid #e5e7eb;vertical-align:top}} td.r,th.r{{text-align:right}} tr.rej td{{color:#9ca3af;text-decoration:line-through}}
tr.tot td{{font-weight:bold;border-top:2px solid #4f46e5;border-bottom:0}}
.sigs{{display:table;width:100%;border-spacing:8px 0;margin:6px -8px 10px}} .sig{{display:table-cell;width:33%;border:1px solid #c7d2fe;border-radius:8px;padding:8px 10px;vertical-align:top}} .sig.empty{{border-style:dashed;color:#9ca3af}}
.sig .t{{font-size:8.5px;text-transform:uppercase;letter-spacing:.04em;color:#4f46e5;font-weight:bold}} .sig .img{{height:58px;margin:6px 0;display:flex;align-items:center}} .sig .img img{{max-height:56px;max-width:100%}} .sig .img span{{color:#9ca3af;font-style:italic}} .typed{{font-family:'Brush Script MT',cursive;font-size:20px;color:#1f2937}}
.sig .n{{font-weight:bold;font-size:11px}} .sig .d{{color:#4b5563;font-size:9px}} .sig .h{{color:#9ca3af;font-size:7.5px;margin-top:4px;font-family:monospace}}
.lock{{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:8px;padding:8px 10px;margin:8px 0}} .lock.open{{background:#fffbeb;border-color:#fde68a;color:#92400e}}
ul.docs{{margin:4px 0 0 16px;padding:0;color:#374151}} ul.docs li{{margin:2px 0}} small{{color:#6b7280}}
.foot{{margin-top:14px;color:#9ca3af;font-size:8px;border-top:1px solid #e5e7eb;padding-top:6px}}
</style></head><body>
<h1>Payment pack approval sheet</h1><p class='sub'>{E(company)} · {E(b.BatchNumber)} · {E(typeTitle)}</p>
<div class='meta'>
<div><span>Status</span><b>{E(CreditorWorkflow.Title(b.Status))}</b></div>
<div><span>Payment run date</span><b>{b.BatchDate:dd MMM yyyy}</b></div>
<div><span>Prepared by</span><b>{E(b.PreparedByName)}{(b.SubmittedAt != null ? " · submitted " + b.SubmittedAt.Value.ToLocalTime().ToString("dd MMM yyyy HH:mm") : "")}</b></div>
<div><span>Payments</span><b>{items.Count} · total R {b.TotalAmount:N2}{(approved != b.TotalAmount ? " · approved to pay R " + approved.ToString("N2") : "")}</b></div>
{(string.IsNullOrWhiteSpace(b.Notes) ? "" : $"<div><span>Note</span><b>{E(b.Notes)}</b></div>")}
</div>
<table class='items'><thead><tr><th>#</th><th>Supplier</th><th>Invoice(s)</th><th>Description</th><th>Account</th><th class='r'>Amount (R)</th><th>Decision</th></tr></thead>
<tbody>{string.Concat(items.Select((i, n) => Row(i, n + 1)))}<tr class='tot'><td colspan='5'>Total</td><td class='r'>{b.TotalAmount:N2}</td><td></td></tr></tbody></table>
<div class='sigs'>{string.Concat(slots.Select(Slot))}</div>
{(b.LockedAt != null ? $"<div class='lock'>Signed and locked on {b.LockedAt.Value.ToLocalTime():dd MMM yyyy HH:mm}. Lock hash <code>{E(b.LockHash)}</code>. The pack and its documents cannot be changed.</div>" : "<div class='lock open'>This pack is not yet fully signed. Signatures above marked “Not yet signed” are still outstanding.</div>")}
<b>Documents in this pack</b><ul class='docs'>{string.Concat(docs)}</ul>
<div class='foot'>Generated by the intranet on {DateTime.Now:dd MMM yyyy HH:mm}. Each signature is recorded with the signer's identity, time, IP address and a SHA-256 hash of the pack at the moment of signing; any later change to the pack would break the hash.</div>
</body></html>";
    }
}
