using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using iText.Html2pdf;
using iText.Kernel.Pdf;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Reverse-engineers Sage Crystal Reports (.rpt) into intranet-native HTML/CSS
    /// templates and renders them to PDF using the imported ERP invoice data.
    ///
    /// Storage layout (file-based, no DB migration required):
    ///   {DocumentsPath}/document-templates/{COMPANY}/{TYPE}/
    ///       source.rpt      – the original Crystal Report the user uploaded
    ///       sample.pdf      – a rendered Sage sample used to match the layout
    ///       template.html   – the reconstructed intranet template (with tokens)
    ///       meta.json       – metadata (names, dates, uploader)
    ///
    /// Tokens supported in template.html:
    ///   {{Field}}                     – simple field replacement
    ///   {{#Lines}} … {{/Lines}}       – repeated block per invoice line item
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/document-templates")]
    public class DocumentTemplatesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<DocumentTemplatesController> _logger;
        private readonly string _basePath;

        // The six operating companies. Codes match ImportedInvoice.SourceCompany.
        private static readonly Dictionary<string, string> Companies = new(StringComparer.OrdinalIgnoreCase)
        {
            ["PMT"] = "Promed Technologies",
            ["ACM"] = "Acess Medical",
            ["PHT"] = "Promed Pharmatech",
            ["SBT"] = "Sebenzani Trading",
            ["SAW"] = "SA Wellness",
            ["KOG"] = "Kog Trading"
        };

        private static readonly Dictionary<string, string> DocTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            ["invoice"] = "Tax Invoice",
            ["delivery-note"] = "Delivery Note",
            ["quote"] = "Quote"
        };

        public DocumentTemplatesController(
            ApplicationDbContext context,
            IConfiguration configuration,
            ILogger<DocumentTemplatesController> logger)
        {
            _context = context;
            _logger = logger;
            var root = configuration["DocumentsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            _basePath = Path.Combine(root, "document-templates");
            Directory.CreateDirectory(_basePath);
        }

        private static bool ValidCompany(string c) => Companies.ContainsKey(c);
        private static bool ValidType(string t) => DocTypes.ContainsKey(t);

        private string Dir(string company, string type)
        {
            var d = Path.Combine(_basePath, company.ToUpperInvariant(), type.ToLowerInvariant());
            Directory.CreateDirectory(d);
            return d;
        }

        // ====================================================================
        // Catalogue — every company × document-type combination and its status
        // ====================================================================
        [HttpGet]
        public IActionResult GetCatalogue()
        {
            var items = new List<object>();
            foreach (var (code, companyName) in Companies)
            {
                foreach (var (typeKey, typeName) in DocTypes)
                {
                    var dir = Dir(code, typeKey);
                    var meta = ReadMeta(dir);
                    items.Add(new
                    {
                        companyCode = code,
                        companyName,
                        documentType = typeKey,
                        documentTypeName = typeName,
                        hasRpt = System.IO.File.Exists(Path.Combine(dir, "source.rpt")),
                        hasSample = System.IO.File.Exists(Path.Combine(dir, "sample.pdf")),
                        hasTemplate = System.IO.File.Exists(Path.Combine(dir, "template.html")),
                        rptFileName = meta?.RptFileName,
                        sampleFileName = meta?.SampleFileName,
                        updatedAt = meta?.UpdatedAt
                    });
                }
            }
            return Ok(new { companies = Companies, documentTypes = DocTypes, items });
        }

        // ====================================================================
        // Upload the Crystal Report and/or a rendered sample PDF
        // ====================================================================
        [HttpPost("upload")]
        [RequestSizeLimit(60_000_000)]
        public async Task<IActionResult> Upload(
            [FromForm] string companyCode,
            [FromForm] string documentType,
            [FromForm] IFormFile? rptFile,
            [FromForm] IFormFile? sampleFile)
        {
            if (!ValidCompany(companyCode)) return BadRequest(new { error = $"Unknown company '{companyCode}'." });
            if (!ValidType(documentType)) return BadRequest(new { error = $"Unknown document type '{documentType}'." });

            _logger.LogInformation(
                "Document template upload: company={Company} type={Type} rpt={Rpt} ({RptLen} bytes) sample={Sample} ({SampleLen} bytes, ct={SampleCt})",
                companyCode, documentType,
                rptFile?.FileName, rptFile?.Length ?? 0,
                sampleFile?.FileName, sampleFile?.Length ?? 0, sampleFile?.ContentType);

            if ((rptFile == null || rptFile.Length == 0) && (sampleFile == null || sampleFile.Length == 0))
                return BadRequest(new { error = "Upload at least one file (.rpt and/or sample PDF)." });

            var dir = Dir(companyCode, documentType);
            var meta = ReadMeta(dir) ?? new TemplateMeta();

            if (rptFile != null && rptFile.Length > 0)
            {
                var ext = Path.GetExtension(rptFile.FileName).ToLowerInvariant();
                if (ext != ".rpt")
                    return BadRequest(new { error = "Crystal Report must be a .rpt file." });
                await using var fs = System.IO.File.Create(Path.Combine(dir, "source.rpt"));
                await rptFile.CopyToAsync(fs);
                meta.RptFileName = rptFile.FileName;
            }

            if (sampleFile != null && sampleFile.Length > 0)
            {
                var ext = Path.GetExtension(sampleFile.FileName).ToLowerInvariant();
                var ct = sampleFile.ContentType?.ToLowerInvariant() ?? "";
                var looksPdf = ext == ".pdf" || ct.Contains("pdf");
                if (!looksPdf)
                    return BadRequest(new { error = $"Sample must be a rendered PDF file (got '{sampleFile.FileName}', type '{sampleFile.ContentType}')." });
                await using var fs = System.IO.File.Create(Path.Combine(dir, "sample.pdf"));
                await sampleFile.CopyToAsync(fs);
                meta.SampleFileName = sampleFile.FileName;
                _logger.LogInformation("Saved sample.pdf for {Company}/{Type}", companyCode, documentType);
                fs.Close();
                // Auto-extract embedded images (logo, banner) from the sample so the
                // reconstructed template can reuse the real brand graphics.
                TryExtractAssets(dir);
            }

            meta.UpdatedAt = DateTime.UtcNow;
            meta.UpdatedBy = User.Identity?.Name;
            WriteMeta(dir, meta);

            // If no reconstructed template exists yet, seed one from the starter scaffold
            // so the user has an editable starting point immediately.
            var tplPath = Path.Combine(dir, "template.html");
            if (!System.IO.File.Exists(tplPath))
            {
                await System.IO.File.WriteAllTextAsync(tplPath, StarterTemplate(companyCode, documentType));
            }

            return Ok(new
            {
                message = "Uploaded successfully.",
                companyCode,
                documentType,
                rptFileName = meta.RptFileName,
                sampleFileName = meta.SampleFileName,
                templateSeeded = true
            });
        }

        // ====================================================================
        // Download the raw .rpt or sample PDF
        // ====================================================================
        [HttpGet("{company}/{type}/file/{kind}")]
        public IActionResult GetFile(string company, string type, string kind)
        {
            if (!ValidCompany(company) || !ValidType(type)) return NotFound();
            var dir = Dir(company, type);
            var (name, contentType) = kind.ToLowerInvariant() switch
            {
                "rpt" => ("source.rpt", "application/octet-stream"),
                "sample" => ("sample.pdf", "application/pdf"),
                _ => (string.Empty, string.Empty)
            };
            if (string.IsNullOrEmpty(name)) return BadRequest(new { error = "kind must be 'rpt' or 'sample'." });
            var path = Path.Combine(dir, name);
            if (!System.IO.File.Exists(path)) return NotFound();
            var meta = ReadMeta(dir);
            var download = kind == "rpt" ? (meta?.RptFileName ?? name) : (meta?.SampleFileName ?? name);
            var bytes = System.IO.File.ReadAllBytes(path);
            // inline so the PDF sample can preview in the browser
            return File(bytes, contentType, kind == "sample" ? null : download);
        }

        // ====================================================================
        // Get / Save the reconstructed HTML template
        // ====================================================================
        [HttpGet("{company}/{type}/html")]
        public async Task<IActionResult> GetHtml(string company, string type)
        {
            if (!ValidCompany(company) || !ValidType(type)) return NotFound();
            var html = await ResolveTemplateAsync(company, type);
            return Ok(new { company, type, html });
        }

        public class HtmlPayload { public string Html { get; set; } = string.Empty; }

        [HttpPut("{company}/{type}/html")]
        public async Task<IActionResult> SaveHtml(string company, string type, [FromBody] HtmlPayload payload)
        {
            if (!ValidCompany(company) || !ValidType(type)) return NotFound();
            if (payload?.Html == null) return BadRequest(new { error = "Html is required." });
            var dir = Dir(company, type);
            await System.IO.File.WriteAllTextAsync(Path.Combine(dir, "template.html"), payload.Html);
            var meta = ReadMeta(dir) ?? new TemplateMeta();
            meta.UpdatedAt = DateTime.UtcNow;
            meta.UpdatedBy = User.Identity?.Name;
            WriteMeta(dir, meta);
            return Ok(new { message = "Template saved." });
        }

        // ====================================================================
        // Artwork (logo / banner) — upload, list, download, delete
        // Explicitly uploaded artwork is stored with a stable name
        // (logo.png / banner.png) and always wins over the heuristic guess
        // from the sample PDF, so admins can drop in the real brand graphics.
        // ====================================================================
        private static readonly HashSet<string> AssetRoles = new(StringComparer.OrdinalIgnoreCase) { "logo", "banner" };

        [HttpPost("{company}/{type}/artwork")]
        [RequestSizeLimit(20_000_000)]
        public async Task<IActionResult> UploadArtwork(string company, string type,
            [FromForm] string role, [FromForm] IFormFile? file)
        {
            if (!ValidCompany(company) || !ValidType(type)) return NotFound();
            if (string.IsNullOrWhiteSpace(role) || !AssetRoles.Contains(role))
                return BadRequest(new { error = "role must be 'logo' or 'banner'." });
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "Pick an image file (PNG or JPG)." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            var ct = file.ContentType?.ToLowerInvariant() ?? "";
            var looksImage = ext is ".png" or ".jpg" or ".jpeg" or ".gif" or ".webp" || ct.StartsWith("image/");
            if (!looksImage)
                return BadRequest(new { error = $"Artwork must be an image (got '{file.FileName}', type '{file.ContentType}')." });

            var assets = Path.Combine(Dir(company, type), "assets");
            Directory.CreateDirectory(assets);
            // Always normalise to <role>.png as the stable, preferred name.
            var dest = Path.Combine(assets, role.ToLowerInvariant() + ".png");
            await using (var fs = System.IO.File.Create(dest))
            {
                await file.CopyToAsync(fs);
            }
            _logger.LogInformation("Artwork uploaded: {Company}/{Type} role={Role} ({Len} bytes)", company, type, role, file.Length);
            return Ok(new { message = $"{role} uploaded.", role, fileName = file.FileName });
        }

        // Return the current logo/banner as inline images (for admin thumbnails).
        [HttpGet("{company}/{type}/artwork/{role}")]
        public IActionResult GetArtwork(string company, string type, string role)
        {
            if (!ValidCompany(company) || !ValidType(type)) return NotFound();
            if (!AssetRoles.Contains(role)) return BadRequest(new { error = "role must be 'logo' or 'banner'." });
            var assets = Path.Combine(Dir(company, type), "assets");
            // Prefer the explicitly named file, else fall back to the heuristic pick.
            var named = Path.Combine(assets, role.ToLowerInvariant() + ".png");
            byte[]? bytes = null;
            if (System.IO.File.Exists(named)) bytes = System.IO.File.ReadAllBytes(named);
            else
            {
                var uri = ImageDataUri(assets, first: role.Equals("logo", StringComparison.OrdinalIgnoreCase));
                if (!string.IsNullOrEmpty(uri))
                {
                    var b64 = uri.Substring(uri.IndexOf(',') + 1);
                    bytes = Convert.FromBase64String(b64);
                }
            }
            if (bytes == null) return NotFound();
            return File(bytes, "image/png");
        }

        // Status: which artwork exists for a company/type (for the admin badges).
        [HttpGet("{company}/{type}/artwork")]
        public IActionResult ArtworkStatus(string company, string type)
        {
            if (!ValidCompany(company) || !ValidType(type)) return NotFound();
            var assets = Path.Combine(Dir(company, type), "assets");
            bool hasLogo = System.IO.File.Exists(Path.Combine(assets, "logo.png"));
            bool hasBanner = System.IO.File.Exists(Path.Combine(assets, "banner.png"));
            // Also report whether *any* extracted image exists (heuristic fallback).
            bool hasExtracted = Directory.Exists(assets) && Directory.GetFiles(assets, "*.png").Length > 0;
            return Ok(new { hasLogo, hasBanner, hasExtracted });
        }

        [HttpDelete("{company}/{type}/artwork/{role}")]
        public IActionResult DeleteArtwork(string company, string type, string role)
        {
            if (!ValidCompany(company) || !ValidType(type)) return NotFound();
            if (!AssetRoles.Contains(role)) return BadRequest(new { error = "role must be 'logo' or 'banner'." });
            var path = Path.Combine(Dir(company, type), "assets", role.ToLowerInvariant() + ".png");
            if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
            return Ok(new { message = $"{role} removed." });
        }

        // ====================================================================
        // List invoices available to generate (grouped by transaction number)
        // ====================================================================
        [HttpGet("{company}/invoices")]
        public async Task<IActionResult> GetInvoices(string company, [FromQuery] string? search, [FromQuery] int take = 100)
        {
            if (!ValidCompany(company)) return NotFound();

            var q = _context.ImportedInvoices.AsNoTracking()
                .Where(i => i.SourceCompany == company);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                q = q.Where(i => i.TransactionNumber.Contains(s) || i.CustomerName.Contains(s) || i.CustomerNumber.Contains(s));
            }

            var rows = await q
                .OrderByDescending(i => i.TransactionDate)
                .Take(take * 8) // over-fetch because we group afterwards
                .Select(i => new
                {
                    i.TransactionNumber,
                    i.CustomerNumber,
                    i.CustomerName,
                    i.TransactionDate,
                    i.SalesAmount,
                    i.SalesReturns
                })
                .ToListAsync();

            var grouped = rows
                .GroupBy(r => r.TransactionNumber)
                .Select(g => new
                {
                    transactionNumber = g.Key,
                    customerNumber = g.First().CustomerNumber,
                    customerName = g.First().CustomerName,
                    date = g.Max(x => x.TransactionDate),
                    lineCount = g.Count(),
                    total = g.Sum(x => x.SalesAmount - x.SalesReturns)
                })
                .OrderByDescending(x => x.date)
                .Take(take)
                .ToList();

            return Ok(grouped);
        }

        // ====================================================================
        // Generate documents for ALL invoices linked to a logistics load.
        // Renders one Tax Invoice / Delivery Note per invoice using the same
        // template + merge engine as the admin Document Templates screen,
        // concatenated with page breaks. Invoices are linked to the load via
        // ImportedInvoices.LoadId, with a fallback on the load's stop invoice
        // numbers. Returns merged HTML (print-ready) or PDF (?format=pdf).
        // ====================================================================
        [HttpGet("for-load/{loadId:int}/{type}")]
        public async Task<IActionResult> GenerateForLoad(int loadId, string type, [FromQuery] string? format = null, [FromQuery] string? txn = null)
        {
            if (!ValidType(type)) return NotFound(new { error = $"Unknown document type '{type}'." });

            // Invoices directly linked to this load
            var lines = await _context.ImportedInvoices.AsNoTracking()
                .Where(i => i.LoadId == loadId)
                .OrderBy(i => i.TransactionNumber).ThenBy(i => i.ProductCode)
                .ToListAsync();

            // Fallback: resolve via the load's stop invoice numbers
            if (lines.Count == 0)
            {
                var stopInvoiceNos = await _context.LoadStops.AsNoTracking()
                    .Where(s => s.LoadId == loadId && s.InvoiceNumber != null && s.InvoiceNumber != "")
                    .Select(s => s.InvoiceNumber!)
                    .Distinct()
                    .ToListAsync();

                if (stopInvoiceNos.Count > 0)
                {
                    lines = await _context.ImportedInvoices.AsNoTracking()
                        .Where(i => stopInvoiceNos.Contains(i.TransactionNumber))
                        .OrderBy(i => i.TransactionNumber).ThenBy(i => i.ProductCode)
                        .ToListAsync();
                }
            }

            if (lines.Count == 0)
                return NotFound(new { error = "No system invoices are linked to this load. Only matched invoices can be generated." });

            // Optional filter: generate a single specific invoice only
            if (!string.IsNullOrWhiteSpace(txn))
            {
                lines = lines.Where(l => string.Equals(l.TransactionNumber, txn, StringComparison.OrdinalIgnoreCase)).ToList();
                if (lines.Count == 0)
                    return NotFound(new { error = $"Invoice '{txn}' is not linked to this load." });
            }

            // One document per invoice (transaction number), using that invoice's
            // own company template so multi-company loads come out branded right.
            var docs = new List<string>();
            foreach (var grp in lines.GroupBy(l => new { l.SourceCompany, l.TransactionNumber }))
            {
                var company = ValidCompany(grp.Key.SourceCompany ?? "") ? grp.Key.SourceCompany! : "PMT";
                var template = await ResolveTemplateAsync(company, type);
                docs.Add(MergeTemplate(template, company, type, grp.OrderBy(l => l.ProductCode).ToList()));
            }

            // Stitch the individual documents into one printable stream.
            // On screen (preview) multiple documents are laid out in a 2-per-row
            // grid to use the whole white space; when printing (or rendering to
            // PDF) each document gets its own page via @media print rules.
            string html;
            if (docs.Count == 1)
            {
                html = docs[0];
            }
            else
            {
                // Each document may come from a different company template with its
                // own CSS (colours, layout). Keep EVERY document's stylesheet, but
                // scope it to that document's cell so templates can't bleed into
                // each other (e.g. a red Access theme recolouring Promed invoices).
                var styles = new StringBuilder();
                var bodies = new StringBuilder();
                for (int i = 0; i < docs.Count; i++)
                {
                    var cellClass = $"cell-{i}";
                    var css = ExtractTagContent(docs[i], "style");
                    var body = ExtractTagContent(docs[i], "body");

                    // The per-document banner uses position:fixed (pin to page
                    // bottom), which stacks all banners when docs are merged.
                    // Switch it to an in-flow block before scoping. Regex so it
                    // also matches saved templates with different formatting.
                    css = System.Text.RegularExpressions.Regex.Replace(css,
                        @"\.banner-strip\s*\{[^}]*position:\s*fixed[^}]*\}",
                        ".banner-strip { position: static; width: 576pt; margin: 14pt auto 0 auto; }");

                    styles.Append(ScopeCss(css, "." + cellClass, includeAtPage: i == 0)).Append('\n');
                    bodies.Append($"<div class=\"doc-cell {cellClass}\">").Append(body).Append("</div>");
                }

                const string gridCss = @"
  body { margin: 0; background: #e8e8e8; }
  /* Multi-document preview: 2 A4 pages per row, scaled to fit */
  .docs-grid { display: grid; grid-template-columns: repeat(2, max-content); gap: 24px; justify-content: center; align-items: start; padding: 16px; }
  .doc-cell { background: #fff; border: 1px solid #ccc; box-shadow: 0 1px 6px rgba(0,0,0,0.18); padding: 18px; overflow: hidden; zoom: 0.62; width: 576pt; min-height: 1050px; display: flex; flex-direction: column; }
  .doc-cell .doc { flex: 1 0 auto; }
  .doc-cell .banner-strip { margin-top: auto; padding-top: 14pt; }
  @media (max-width: 1100px) { .docs-grid { grid-template-columns: max-content; } .doc-cell { zoom: 0.9; } }
  /* Print / PDF: back to one full-size document per page */
  @media print {
    body { background: #fff; }
    .docs-grid { display: block; padding: 0; }
    .doc-cell { border: none; box-shadow: none; padding: 0; width: auto; min-height: 0; display: block; page-break-after: always; zoom: 1; }
    .doc-cell:last-child { page-break-after: auto; }
  }";

                html = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\" />\n<style>\n"
                     + styles + gridCss
                     + "\n</style>\n</head>\n<body>\n<div class=\"docs-grid\">" + bodies + "</div>\n</body>\n</html>";
            }

            if (string.Equals(format, "pdf", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    using var ms = new MemoryStream();
                    using var writer = new PdfWriter(ms);
                    using var pdf = new PdfDocument(writer);
                    pdf.SetDefaultPageSize(iText.Kernel.Geom.PageSize.A4);
                    var props = new ConverterProperties();
                    // Evaluate @media print rules so merged docs paginate one per page
                    props.SetMediaDeviceDescription(
                        new iText.StyledXmlParser.Css.Media.MediaDeviceDescription(
                            iText.StyledXmlParser.Css.Media.MediaType.PRINT));
                    HtmlConverter.ConvertToPdf(html, pdf, props);
                    var safeType = type.Replace("-", "");
                    return File(ms.ToArray(), "application/pdf", $"{safeType}_load{loadId}.pdf");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to render load document PDF for load {LoadId}/{Type}", loadId, type);
                    // fall through to HTML
                }
            }

            return Content(html, "text/html");
        }

        // ====================================================================
        // List the invoices linked to a load — drives the document selector in
        // the logistics View Details dialog.
        // ====================================================================
        [HttpGet("for-load/{loadId:int}/invoices")]
        public async Task<IActionResult> ListLoadInvoices(int loadId)
        {
            var lines = await _context.ImportedInvoices.AsNoTracking()
                .Where(i => i.LoadId == loadId)
                .ToListAsync();

            if (lines.Count == 0)
            {
                var stopInvoiceNos = await _context.LoadStops.AsNoTracking()
                    .Where(s => s.LoadId == loadId && s.InvoiceNumber != null && s.InvoiceNumber != "")
                    .Select(s => s.InvoiceNumber!)
                    .Distinct()
                    .ToListAsync();
                if (stopInvoiceNos.Count > 0)
                {
                    lines = await _context.ImportedInvoices.AsNoTracking()
                        .Where(i => stopInvoiceNos.Contains(i.TransactionNumber))
                        .ToListAsync();
                }
            }

            var invoices = lines
                .GroupBy(l => l.TransactionNumber)
                .Select(g => new
                {
                    transactionNumber = g.Key,
                    company = g.First().SourceCompany,
                    customerName = g.First().CustomerName,
                    lineCount = g.Count(),
                    total = g.Sum(x => x.SalesAmount - x.SalesReturns)
                })
                .OrderBy(x => x.transactionNumber)
                .ToList();

            return Ok(invoices);
        }

        // ====================================================================
        // Generate a document PDF for one invoice (transaction number)
        // ====================================================================
        [HttpGet("{company}/{type}/generate/{transactionNumber}")]
        public async Task<IActionResult> Generate(string company, string type, string transactionNumber)
        {
            if (!ValidCompany(company) || !ValidType(type)) return NotFound();

            var lines = await _context.ImportedInvoices.AsNoTracking()
                .Where(i => i.SourceCompany == company && i.TransactionNumber == transactionNumber)
                .OrderBy(i => i.ProductCode)
                .ToListAsync();

            if (lines.Count == 0)
                return NotFound(new { error = "No invoice lines found for that transaction." });

            var template = await ResolveTemplateAsync(company, type);

            var html = MergeTemplate(template, company, type, lines);

            try
            {
                using var ms = new MemoryStream();
                using var writer = new PdfWriter(ms);
                using var pdf = new PdfDocument(writer);
                pdf.SetDefaultPageSize(iText.Kernel.Geom.PageSize.A4);
                HtmlConverter.ConvertToPdf(html, pdf, new ConverterProperties());
                var bytes = ms.ToArray();
                var safeType = type.Replace("-", "");
                return File(bytes, "application/pdf", $"{safeType}_{transactionNumber}.pdf");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to render document PDF for {Company}/{Type}/{Txn}", company, type, transactionNumber);
                // Fall back to returning the HTML so the user can still inspect the merge
                return Content(html, "text/html");
            }
        }

        // Preview the merged HTML (no PDF) — used by the live preview pane
        [HttpGet("{company}/{type}/preview/{transactionNumber}")]
        public async Task<IActionResult> Preview(string company, string type, string transactionNumber)
        {
            if (!ValidCompany(company) || !ValidType(type)) return NotFound();
            var lines = await _context.ImportedInvoices.AsNoTracking()
                .Where(i => i.SourceCompany == company && i.TransactionNumber == transactionNumber)
                .OrderBy(i => i.ProductCode)
                .ToListAsync();

            var template = await ResolveTemplateAsync(company, type);

            // If no invoice chosen, merge with sample placeholder data
            var html = lines.Count > 0
                ? MergeTemplate(template, company, type, lines)
                : MergeTemplate(template, company, type, SampleLines(company));

            return Content(html, "text/html");
        }

        // ====================================================================
        // Template token merge engine
        // ====================================================================
        private string MergeTemplate(string template, string company, string type,
            List<Models.Logistics.ImportedInvoice> lines)
        {
            var first = lines.First();
            decimal net = lines.Sum(l => l.SalesAmount - l.SalesReturns);
            decimal vat = Math.Round(net * 0.15m, 2);
            decimal gross = net + vat;

            // Line-item block: {{#Lines}} … {{/Lines}}
            var sb = new StringBuilder();
            var startTag = "{{#Lines}}";
            var endTag = "{{/Lines}}";
            var si = template.IndexOf(startTag, StringComparison.Ordinal);
            var ei = template.IndexOf(endTag, StringComparison.Ordinal);
            if (si >= 0 && ei > si)
            {
                var rowTpl = template.Substring(si + startTag.Length, ei - (si + startTag.Length));
                foreach (var l in lines)
                {
                    var lineNet = l.SalesAmount - l.SalesReturns;
                    var row = rowTpl
                        .Replace("{{ProductCode}}", Esc(l.ProductCode))
                        .Replace("{{ProductDescription}}", Esc(l.ProductDescription))
                        .Replace("{{Quantity}}", l.Quantity.ToString("0.##"))
                        .Replace("{{QtyOrdered}}", l.Quantity.ToString("0.##"))
                        .Replace("{{QtyBackordered}}", "0")
                        .Replace("{{Location}}", Esc(l.Location?.ToString() ?? ""))
                        .Replace("{{Uom}}", "Each")
                        .Replace("{{LineAmount}}", lineNet.ToString("N2"))
                        .Replace("{{UnitPrice}}", (l.Quantity != 0 ? (lineNet / l.Quantity) : 0).ToString("N2"));
                    sb.Append(row);
                }
                template = template.Substring(0, si) + sb + template.Substring(ei + endTag.Length);
            }

            // Company static profile (per-company identity / banking literals).
            var profile = ProfileFor(company);
            var dueDate = first.TransactionDate.AddDays(30);

            // Artwork: if a company genuinely has no logo/banner on disk, remove
            // the <img> elements entirely instead of emitting src="" broken images.
            var logoUri = LogoDataUri(company, type);
            var bannerUri = BannerDataUri(company, type);
            if (string.IsNullOrEmpty(logoUri))
                template = System.Text.RegularExpressions.Regex.Replace(
                    template, "<img[^>]*\\{\\{Logo\\}\\}[^>]*/?>", "");
            if (string.IsNullOrEmpty(bannerUri))
                template = System.Text.RegularExpressions.Regex.Replace(
                    template, "<img[^>]*\\{\\{Banner\\}\\}[^>]*/?>", "");

            // Header / totals tokens
            return template
                .Replace("{{Logo}}", logoUri)
                .Replace("{{Banner}}", bannerUri)
                .Replace("{{CompanyCode}}", Esc(company))
                .Replace("{{CompanyName}}", Esc(profile.Name))
                .Replace("{{DocumentType}}", Esc(DocTypes.TryGetValue(type, out var dn) ? dn : type))
                .Replace("{{TransactionNumber}}", Esc(first.TransactionNumber))
                .Replace("{{InvoiceNumber}}", Esc(first.TransactionNumber))
                .Replace("{{OrderNumber}}", Esc(first.TransactionNumber))
                .Replace("{{InvoiceDate}}", first.TransactionDate.ToString("dd MMMM yyyy"))
                .Replace("{{OrderDate}}", first.TransactionDate.ToString("dd MMMM yyyy"))
                .Replace("{{DueDate}}", dueDate.ToString("dd MMMM yyyy"))
                .Replace("{{PageNumber}}", "1")
                .Replace("{{PageCount}}", "1")
                .Replace("{{CustomerNumber}}", Esc(first.CustomerNumber))
                .Replace("{{CustomerName}}", Esc(first.CustomerName))
                .Replace("{{CustomerVatNumber}}", "")
                .Replace("{{PoNumber}}", "")
                .Replace("{{ShipVia}}", "")
                .Replace("{{Terms}}", "30 Days")
                // Bill-to / ship-to (our data only carries the delivery address)
                .Replace("{{BillToAddress1}}", Esc(first.DeliveryAddress ?? ""))
                .Replace("{{BillToAddress2}}", Esc(first.DeliveryCity ?? ""))
                .Replace("{{BillToAddress3}}", Esc(first.DeliveryProvince ?? ""))
                .Replace("{{BillToAddress4}}", Esc(first.DeliveryPostalCode ?? ""))
                .Replace("{{ShipToName}}", Esc(first.CustomerName))
                .Replace("{{ShipToAddress1}}", Esc(first.DeliveryAddress ?? ""))
                .Replace("{{ShipToAddress2}}", Esc(first.DeliveryCity ?? ""))
                .Replace("{{ShipToAddress3}}", Esc(first.DeliveryProvince ?? ""))
                .Replace("{{ShipToAddress4}}", Esc(first.DeliveryPostalCode ?? ""))
                .Replace("{{DeliveryAddress}}", Esc(first.DeliveryAddress ?? ""))
                .Replace("{{DeliveryCity}}", Esc(first.DeliveryCity ?? ""))
                .Replace("{{ContactPerson}}", Esc(first.ContactPerson ?? ""))
                .Replace("{{ContactPhone}}", Esc(first.ContactPhone ?? ""))
                // Totals
                .Replace("{{SubTotal}}", net.ToString("N2"))
                .Replace("{{VatAmount}}", vat.ToString("N2"))
                .Replace("{{TotalWithTax}}", gross.ToString("N2"))
                .Replace("{{LessPayment}}", "0.00")
                .Replace("{{LessPaymentDiscount}}", "0.00")
                .Replace("{{LessRetainage}}", "0.00")
                .Replace("{{Total}}", gross.ToString("N2"));
        }

        private List<Models.Logistics.ImportedInvoice> SampleLines(string company) => new()
        {
            new Models.Logistics.ImportedInvoice
            {
                SourceCompany = company, TransactionNumber = "SAMPLE-0001",
                CustomerNumber = "CUST001", CustomerName = "Sample Customer (Pty) Ltd",
                TransactionDate = DateTime.Today, ProductCode = "PRD-001",
                ProductDescription = "Sample product line item", Quantity = 10, SalesAmount = 1500m
            },
            new Models.Logistics.ImportedInvoice
            {
                SourceCompany = company, TransactionNumber = "SAMPLE-0001",
                CustomerNumber = "CUST001", CustomerName = "Sample Customer (Pty) Ltd",
                TransactionDate = DateTime.Today, ProductCode = "PRD-002",
                ProductDescription = "Another sample product", Quantity = 4, SalesAmount = 860m
            }
        };

        private static string Esc(string? s) => System.Net.WebUtility.HtmlEncode(s ?? string.Empty);

        // ====================================================================
        // Asset extraction & branding helpers
        // ====================================================================

        /// <summary>
        /// Runs poppler's pdfimages to pull the embedded graphics (logo, banners)
        /// out of the uploaded Sage sample PDF into an assets/ sub-folder.
        /// Best-effort: silently no-ops if poppler is unavailable.
        /// </summary>
        private void TryExtractAssets(string dir)
        {
            try
            {
                var sample = Path.Combine(dir, "sample.pdf");
                if (!System.IO.File.Exists(sample)) return;
                var assets = Path.Combine(dir, "assets");
                Directory.CreateDirectory(assets);
                // clear old
                foreach (var f in Directory.GetFiles(assets)) { try { System.IO.File.Delete(f); } catch { } }

                var psi = new System.Diagnostics.ProcessStartInfo
                {
                    FileName = "pdfimages",
                    Arguments = $"-png \"{sample}\" \"{Path.Combine(assets, "img")}\"",
                    RedirectStandardError = true,
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var p = System.Diagnostics.Process.Start(psi);
                p?.WaitForExit(15000);
                _logger.LogInformation("Extracted {Count} asset image(s) for {Dir}",
                    Directory.GetFiles(assets).Length, dir);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Asset extraction skipped for {Dir}", dir);
            }
        }

        // ====================================================================
        // Merged-document helpers: pull a tag's inner content out of a full
        // HTML document, and scope a stylesheet to a container class so one
        // company's template CSS can't restyle another company's document.
        // ====================================================================
        private static string ExtractTagContent(string html, string tag)
        {
            var open = html.IndexOf("<" + tag, StringComparison.OrdinalIgnoreCase);
            if (open < 0) return tag == "body" ? html : string.Empty;
            var openEnd = html.IndexOf('>', open);
            var close = html.LastIndexOf("</" + tag + ">", StringComparison.OrdinalIgnoreCase);
            if (openEnd < 0 || close < 0 || close <= openEnd) return string.Empty;
            return html.Substring(openEnd + 1, close - openEnd - 1);
        }

        private static string ScopeCss(string css, string scope, bool includeAtPage)
        {
            // Strip comments first — they would otherwise end up glued to the
            // following selector and can break the scoping transform.
            css = System.Text.RegularExpressions.Regex.Replace(css, @"/\*.*?\*/", "", System.Text.RegularExpressions.RegexOptions.Singleline);
            var sb = new StringBuilder();
            int i = 0;
            while (i < css.Length)
            {
                // find next rule: selector(s) up to '{'
                var braceOpen = css.IndexOf('{', i);
                if (braceOpen < 0) break;
                var selector = css.Substring(i, braceOpen - i).Trim();

                // find matching close brace (handles nested @media blocks)
                int depth = 1, j = braceOpen + 1;
                while (j < css.Length && depth > 0)
                {
                    if (css[j] == '{') depth++;
                    else if (css[j] == '}') depth--;
                    j++;
                }
                var block = css.Substring(braceOpen + 1, j - braceOpen - 2);

                if (selector.StartsWith("@page", StringComparison.OrdinalIgnoreCase))
                {
                    if (includeAtPage) sb.Append(selector).Append(" {").Append(block).Append("}\n");
                }
                else if (selector.StartsWith("@media", StringComparison.OrdinalIgnoreCase))
                {
                    // scope the rules inside the media query
                    sb.Append(selector).Append(" {\n")
                      .Append(ScopeCss(block, scope, includeAtPage: false))
                      .Append("}\n");
                }
                else if (selector.StartsWith("@", StringComparison.OrdinalIgnoreCase))
                {
                    sb.Append(selector).Append(" {").Append(block).Append("}\n");
                }
                else if (selector.Length > 0)
                {
                    var scoped = string.Join(", ", selector.Split(',')
                        .Select(s => s.Trim())
                        .Where(s => s.Length > 0)
                        .Select(s =>
                            s == "*"
                                ? scope + ", " + scope + " *"
                                : s.Equals("body", StringComparison.OrdinalIgnoreCase) ||
                                  s.Equals("html", StringComparison.OrdinalIgnoreCase)
                                    ? scope
                                    : scope + " " + s));
                    sb.Append(scoped).Append(" {").Append(block).Append("}\n");
                }
                i = j;
            }
            return sb.ToString();
        }

        // Convention: an explicitly-uploaded logo.png / banner.png always wins;
        // otherwise fall back to the heuristic (smallest = logo, largest = banner)
        // over whatever pdfimages extracted from the sample PDF. If this doc type
        // has no artwork at all, borrow it from the company's other doc types
        // (e.g. delivery-note reuses the invoice artwork) so logos/banners never
        // come out broken just because one type hasn't been set up yet.
        private string LogoDataUri(string company, string type)
            => AssetWithTypeFallback(company, type, "logo.png", first: true);

        private string BannerDataUri(string company, string type)
            => AssetWithTypeFallback(company, type, "banner.png", first: false);

        private string AssetWithTypeFallback(string company, string type, string namedFile, bool first)
        {
            var uri = NamedOrHeuristicDataUri(Path.Combine(Dir(company, type), "assets"), namedFile, first);
            if (!string.IsNullOrEmpty(uri)) return uri;
            foreach (var otherType in DocTypes.Keys)
            {
                if (otherType.Equals(type, StringComparison.OrdinalIgnoreCase)) continue;
                uri = NamedOrHeuristicDataUri(Path.Combine(Dir(company, otherType), "assets"), namedFile, first);
                if (!string.IsNullOrEmpty(uri)) return uri;
            }
            return string.Empty;
        }

        private static string NamedOrHeuristicDataUri(string assetsDir, string namedFile, bool first)
        {
            try
            {
                var named = Path.Combine(assetsDir, namedFile);
                if (System.IO.File.Exists(named))
                    return "data:image/png;base64," + Convert.ToBase64String(System.IO.File.ReadAllBytes(named));
            }
            catch { /* fall through to heuristic */ }
            return ImageDataUri(assetsDir, first);
        }

        private static string ImageDataUri(string assetsDir, bool first)
        {
            try
            {
                if (!Directory.Exists(assetsDir)) return string.Empty;
                var pngs = Directory.GetFiles(assetsDir, "*.png")
                    .Where(f => {
                        var n = Path.GetFileName(f).ToLowerInvariant();
                        return n != "logo.png" && n != "banner.png"; // those are handled explicitly
                    })
                    .OrderBy(f => f).ToList();
                if (pngs.Count == 0) return string.Empty;
                // "first" = logo (smallest file is usually the logo); "banner" = the largest.
                string pick;
                if (first)
                    pick = pngs.OrderBy(f => new FileInfo(f).Length).First();
                else
                    pick = pngs.OrderByDescending(f => new FileInfo(f).Length).First();
                var bytes = System.IO.File.ReadAllBytes(pick);
                return "data:image/png;base64," + Convert.ToBase64String(bytes);
            }
            catch { return string.Empty; }
        }

        // ====================================================================
        // Metadata helpers
        // ====================================================================
        private class TemplateMeta
        {
            public string? RptFileName { get; set; }
            public string? SampleFileName { get; set; }
            public DateTime? UpdatedAt { get; set; }
            public string? UpdatedBy { get; set; }
        }

        private TemplateMeta? ReadMeta(string dir)
        {
            var p = Path.Combine(dir, "meta.json");
            if (!System.IO.File.Exists(p)) return null;
            try { return JsonSerializer.Deserialize<TemplateMeta>(System.IO.File.ReadAllText(p)); }
            catch { return null; }
        }

        private void WriteMeta(string dir, TemplateMeta meta)
        {
            System.IO.File.WriteAllText(Path.Combine(dir, "meta.json"),
                JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));
        }

        // ====================================================================
        // Per-company static profile — the identity / registration / banking
        // literals that are hard-coded text inside each company's Crystal report.
        // PMT is fully populated from the decoded 20230405 oeinv01.rpt; the other
        // companies inherit the structure with editable placeholders (admins fill
        // them via the template editor, or a future per-company settings screen).
        // ====================================================================
        private class CompanyProfile
        {
            public string Name = "";
            public string AddrLine1 = "";
            public string AddrLine2 = "";
            public string AddrLine3 = "";
            public string Addr2Line1 = "";
            public string Addr2Line2 = "";
            public string Addr2Line3 = "";
            public string Email = "";
            public string Tel = "";
            public string Fax = "";
            public string VatNo = "";
            public string CsdNo = "";
            public string VendorNo = "";
            public string Bank = "";
            public string AccNo = "";
            public string BranchCode = "";
            public string Iso = "";
        }

        private static readonly Dictionary<string, CompanyProfile> Profiles = new(StringComparer.OrdinalIgnoreCase)
        {
            ["PMT"] = new CompanyProfile
            {
                Name = "Promed Technologies",
                AddrLine1 = "18 Drift Road", AddrLine2 = "Canelands", AddrLine3 = "Verulam, 4339",
                Addr2Line1 = "10 Donnington Rd", Addr2Line2 = "Killarney Gardens", Addr2Line3 = "Cape Town, 7441",
                Email = "info@promedtechnologies.co.za", Tel = "031 537 8030", Fax = "086 608 6840",
                VatNo = "4750268080", CsdNo = "MAAA0352514", VendorNo = "1100149756",
                Bank = "STANDARD BANK", AccNo = "051105810", BranchCode = "051001",
                Iso = "ISO 13485 | ISO 9001"
            }
        };

        private CompanyProfile ProfileFor(string company)
        {
            if (Profiles.TryGetValue(company, out var p)) return p;
            return new CompanyProfile { Name = Companies.TryGetValue(company, out var cn) ? cn : company };
        }

        // ====================================================================
        // Starter A4/Letter template — reconstructed from the decoded Sage OE
        // Tax Invoice (oeinv01) via RptBridge: banded layout for iText7 pdfHTML
        // with a fixed header block, flowing line table, and totals + banking
        // footer. Geometry in pt (twips ÷ 20); column widths and the OEINPR3
        // field bindings come straight from the decoded template-definition.
        // Built as a plain verbatim string with [[PLACEHOLDER]] company inserts
        // so the {{MergeTokens}} pass through untouched to MergeTemplate().
        // ====================================================================
        private string StarterTemplate(string company, string type)
        {
            var p = ProfileFor(company);
            var typeName = DocTypes.TryGetValue(type, out var dn) ? dn : type;

            string addrBlock = string.Join("<br />", new[]
            {
                p.AddrLine1, p.AddrLine2, p.AddrLine3, p.Email
            }.Where(s => !string.IsNullOrEmpty(s)));

            string addr2Block = string.Join("<br />", new[]
            {
                p.Addr2Line1, p.Addr2Line2, p.Addr2Line3
            }.Where(s => !string.IsNullOrEmpty(s)));

            string contactBlock = string.Join("<br />", new[]
            {
                !string.IsNullOrEmpty(p.Tel) ? $"Tel: {p.Tel}" : "",
                !string.IsNullOrEmpty(p.Fax) ? $"Fax: {p.Fax}" : "",
                !string.IsNullOrEmpty(p.VatNo) ? $"VAT No.: {p.VatNo}" : "",
                !string.IsNullOrEmpty(p.CsdNo) ? $"CSD No.: {p.CsdNo}" : "",
                !string.IsNullOrEmpty(p.VendorNo) ? $"Vendor No.: {p.VendorNo}" : ""
            }.Where(s => s.Length > 0));

            string bankBlock = string.Join("\n", new[]
            {
                "<div class=\"bold\">BANKING DETAILS</div>",
                !string.IsNullOrEmpty(p.Bank) ? $"<div>BANK: {p.Bank}</div>" : "",
                !string.IsNullOrEmpty(p.AccNo) ? $"<div>ACC NO: {p.AccNo}</div>" : "",
                !string.IsNullOrEmpty(p.BranchCode) ? $"<div>CODE: {p.BranchCode}</div>" : ""
            }.Where(s => s.Length > 0));

            var html = TemplateShell
                .Replace("[[TITLE]]", typeName)
                .Replace("[[COMPANY_NAME]]", p.Name)
                .Replace("[[ADDR_BLOCK]]", addrBlock)
                .Replace("[[ADDR2_BLOCK]]", addr2Block)
                .Replace("[[CONTACT_BLOCK]]", contactBlock)
                .Replace("[[BANK_BLOCK]]", bankBlock);

            // Delivery Note: identical artwork to the Tax Invoice, but after the
            // UOM column there is a single "Qty Received" column instead of
            // Unit Price + Extended Price (the two documents go hand in hand).
            if (type.Equals("delivery-note", StringComparison.OrdinalIgnoreCase))
                html = ApplyDeliveryNoteTransform(html);

            return html;
        }

        // ====================================================================
        // Template resolution: prefer the saved template for the exact doc
        // type; for delivery notes fall back to the company's OWN saved
        // invoice template (transformed) before resorting to the generic
        // starter shell — otherwise e.g. an Access Medical delivery note
        // would come out with the default Promed-blue theme.
        // ====================================================================
        private async Task<string> ResolveTemplateAsync(string company, string type)
        {
            var tplPath = Path.Combine(Dir(company, type), "template.html");
            if (System.IO.File.Exists(tplPath))
                return await System.IO.File.ReadAllTextAsync(tplPath);

            if (type.Equals("delivery-note", StringComparison.OrdinalIgnoreCase))
            {
                var invPath = Path.Combine(Dir(company, "invoice"), "template.html");
                if (System.IO.File.Exists(invPath))
                    return ApplyDeliveryNoteTransform(await System.IO.File.ReadAllTextAsync(invPath));
            }

            return StarterTemplate(company, type);
        }

        // Converts a Tax Invoice template (starter shell or a saved per-company
        // copy that kept the shell's markup) into a Delivery Note: swaps the
        // price columns for a Qty Received write-in column and replaces the
        // money totals with a goods-received sign-off block.
        private static string ApplyDeliveryNoteTransform(string html)
        {
            // Normalise line endings so multi-line replacements match reliably
            html = html.Replace("\r\n", "\n");

            html = html
                // Document title (saved invoice templates have it baked in)
                .Replace("Tax Invoice", "Delivery Note")
                .Replace("TAX INVOICE", "DELIVERY NOTE")
                // Column headers: Unit Price + Extended Price -> Qty Received
                .Replace(
                    "<th class=\"c-up\">Unit Price</th>\n        <th class=\"c-ext\">Extended Price</th>",
                    "<th class=\"c-qr\">Qty<br/>Received</th>")
                // Line cells: price cells -> one empty write-in cell
                .Replace(
                    "<td class=\"num\">{{UnitPrice}}</td>\n        <td class=\"num\">{{LineAmount}}</td>",
                    "<td class=\"qr-cell\">&nbsp;</td>")
                // COMPLETE row + spacer row: 9 columns -> 8
                .Replace(
                    "<tr><td></td><td></td><td></td><td></td><td></td><td class=\"complete\">COMPLETE</td><td></td><td></td><td></td></tr>",
                    "<tr><td></td><td></td><td></td><td></td><td></td><td class=\"complete\">COMPLETE</td><td></td><td></td></tr>")
                .Replace(
                    "<tr class=\"spacer\"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>",
                    "<tr class=\"spacer\"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>")
                // No money totals on a delivery note: banking block + goods-received sign-off
                .Replace("<td class=\"bank\" colspan=\"6\" rowspan=\"5\">", "<td class=\"bank\" colspan=\"5\" rowspan=\"5\">")
                .Replace(
                    "<td class=\"tl\" colspan=\"2\">Subtotal</td>\n        <td class=\"tv\">{{SubTotal}}</td>",
                    "<td class=\"tl\" colspan=\"2\">Received By (print name)</td>\n        <td class=\"tv\">&nbsp;</td>")
                .Replace(
                    "<tr><td class=\"tl\" colspan=\"2\">Total sales tax</td><td class=\"tv\">{{VatAmount}}</td></tr>",
                    "<tr><td class=\"tl\" colspan=\"2\">Signature</td><td class=\"tv\">&nbsp;</td></tr>")
                .Replace(
                    "<tr class=\"rule\"><td class=\"tl\" colspan=\"2\">Total amount</td><td class=\"tv\">{{TotalWithTax}}</td></tr>",
                    "<tr class=\"rule\"><td class=\"tl\" colspan=\"2\">Date Received</td><td class=\"tv\">&nbsp;</td></tr>")
                .Replace(
                    "<tr><td class=\"tl\" colspan=\"2\">Less payment</td><td class=\"tv\">{{LessPayment}}</td></tr>",
                    "<tr><td class=\"tl\" colspan=\"2\">Time</td><td class=\"tv\">&nbsp;</td></tr>")
                .Replace(
                    "<tr class=\"due\"><td class=\"tl\" colspan=\"2\">Amount due</td><td class=\"tv\">{{Total}}</td></tr>",
                    "<tr class=\"due\"><td class=\"tl\" colspan=\"2\">Goods received in good order</td><td class=\"tv\">YES / NO</td></tr>")
                // Column width for the new Qty Received column + write-in cell style
                .Replace(
                    ".c-item{width:86pt;} .c-desc{width:auto;} .c-uom{width:40pt;} .c-up{width:58pt;} .c-ext{width:74pt;}",
                    ".c-item{width:86pt;} .c-desc{width:auto;} .c-uom{width:40pt;} .c-qr{width:74pt;}\n  .qr-cell { border-bottom: 0.5pt dotted #999; }");

            return html;
        }

        // The raw banded HTML shell (decoded from oeinv01). Plain verbatim string:
        // only " is escaped ("") — {{tokens}} and CSS braces are literal.
        private const string TemplateShell = @"<!DOCTYPE html>
<html lang=""en"">
<head>
<meta charset=""utf-8"" />
<style>
  @page { size: 8.5in 11in; margin: 18pt; }
  * { box-sizing: border-box; }
  body { font-family: Arial, ""Liberation Sans"", sans-serif; font-size: 8pt; color: #000; margin: 0; }
  .doc { width: 576pt; }
  /* Blue title bar */
  .bar { background: #33A7E0; color: #fff; position: relative; height: 42pt; }
  .bar .doctitle { position: absolute; left: 12pt; top: 9pt; font-size: 20pt; font-weight: bold; }
  .bar .dp { position: absolute; left: 250pt; top: 7pt; font-size: 7.5pt; line-height: 13pt; }
  .bar .dp b { display: inline-block; width: 26pt; }
  .bar .docno { position: absolute; left: 376pt; top: 9pt; width: 188pt; text-align: right; font-size: 19pt; font-weight: bold; }
  /* Company header */
  .head { position: relative; height: 86pt; padding-top: 6pt; }
  .head .logo { position: absolute; left: 4pt; top: 8pt; width: 190pt; height: 72pt; object-fit: contain; }
  .coname { position: absolute; left: 232pt; top: 6pt; font-weight: bold; font-size: 10.5pt; }
  .addr1 { position: absolute; left: 232pt; top: 22pt; width: 120pt; line-height: 12pt; }
  .addr2 { position: absolute; left: 352pt; top: 22pt; width: 110pt; line-height: 12pt; }
  .contact { position: absolute; left: 416pt; top: 22pt; width: 160pt; line-height: 12pt; text-align: right; }
  /* Sold To / Deliver To */
  .parties { position: relative; height: 86pt; margin-top: 2pt; }
  .box { position: absolute; top: 0; height: 82pt; border: 0.75pt solid #000; padding: 3pt 6pt; }
  .box .cap { position: absolute; left: 2pt; top: -13pt; font-weight: bold; font-size: 8pt; }
  .box .body { line-height: 12pt; }
  .sold { left: 0; width: 350pt; }
  .deliver { left: 366pt; width: 210pt; }
  /* Order strip */
  table.strip { width: 100%; border-collapse: collapse; margin-top: 14pt; font-size: 8pt; }
  table.strip th, table.strip td { border: 0.75pt solid #000; padding: 3pt 5pt; text-align: center; }
  table.strip th { font-weight: bold; }
  /* Line table (9 columns, vertical rules) */
  table.lines { width: 100%; border-collapse: collapse; margin-top: 6pt; font-size: 7.5pt; }
  table.lines th, table.lines td { border-left: 0.75pt solid #000; border-right: 0.75pt solid #000; padding: 2pt 3pt; }
  table.lines thead th { border: 0.75pt solid #000; font-weight: bold; text-align: center; vertical-align: bottom; }
  table.lines tbody td { vertical-align: top; }
  table.lines tbody tr:last-child td { border-bottom: 0.75pt solid #000; }
  .num { text-align: right; } .ctr { text-align: center; }
  .c-qo{width:34pt;} .c-qs{width:34pt;} .c-qb{width:32pt;} .c-loc{width:26pt;}
  .c-item{width:86pt;} .c-desc{width:auto;} .c-uom{width:40pt;} .c-up{width:58pt;} .c-ext{width:74pt;}
  .complete { text-align: center; padding-top: 30pt; font-size: 7.5pt; }
  .spacer td { height: 40pt; }
  /* Banking + totals live INSIDE the line table so it reads as one grid. */
  td.bank { vertical-align: top; text-align: left; font-size: 8pt; line-height: 12pt; border-bottom: 0.75pt solid #000; }
  td.bank .bold { font-weight: bold; }
  td.tl { text-align: left; }
  td.tv { text-align: right; }
  tr.topline > td { border-top: 0.75pt solid #000; }
  tr.rule td { border-top: 0.75pt solid #000; }
  tr.due td { border-top: 0.75pt solid #000; font-weight: bold; }
  /* Full-width accreditation banner, pinned to page bottom */
  .banner-strip { position: fixed; bottom: 0; left: 0; right: 0; width: 100%; }
  .banner-strip img { display: block; width: 100%; height: auto; object-fit: contain; }
</style>
</head>
<body>
  <div class=""doc"">
  <!-- ===== BLUE TITLE BAR ===== -->
  <div class=""bar"">
    <div class=""doctitle"">[[TITLE]]</div>
    <div class=""dp""><b>Date</b> {{InvoiceDate}}<br /><b>Page</b> {{PageNumber}}</div>
    <div class=""docno"">{{InvoiceNumber}}</div>
  </div>

  <!-- ===== COMPANY HEADER ===== -->
  <div class=""head"">
    <img class=""logo"" src=""{{Logo}}"" alt=""[[TITLE]]"" />
    <div class=""coname"">[[COMPANY_NAME]]</div>
    <div class=""addr1"">[[ADDR_BLOCK]]</div>
    <div class=""addr2"">[[ADDR2_BLOCK]]</div>
    <div class=""contact"">[[CONTACT_BLOCK]]</div>
  </div>

  <!-- ===== SOLD TO / DELIVER TO ===== -->
  <div class=""parties"">
    <div class=""box sold"">
      <div class=""cap"">Sold To:</div>
      <div class=""body"">
        {{CustomerName}}<br />
        {{BillToAddress1}}<br />
        {{BillToAddress2}}<br />
        {{BillToAddress3}}<br />
        {{BillToAddress4}}
      </div>
    </div>
    <div class=""box deliver"">
      <div class=""cap"">Deliver To:</div>
      <div class=""body"">
        {{ShipToName}}<br />
        {{ShipToAddress1}}<br />
        {{ShipToAddress2}}<br />
        {{ShipToAddress3}}<br />
        {{ShipToAddress4}}
      </div>
    </div>
  </div>

  <!-- ===== ORDER STRIP ===== -->
  <table class=""strip"">
    <tr>
      <th>Customer PO Number</th><th>Tax Reference</th><th>Customer No.</th><th>Order No.</th><th>Terms</th>
    </tr>
    <tr>
      <td>{{PoNumber}}</td><td>{{CustomerVatNumber}}</td><td>{{CustomerNumber}}</td><td>{{OrderNumber}}</td><td>{{Terms}}</td>
    </tr>
  </table>

  <!-- ===== LINE ITEMS + TOTALS (one grid) ===== -->
  <table class=""lines"">
    <thead>
      <tr>
        <th class=""c-qo"">Qty.<br/>Ord.</th>
        <th class=""c-qs"">Qty.<br/>Shp.</th>
        <th class=""c-qb"">Qty.<br/>B/O</th>
        <th class=""c-loc"">Loc</th>
        <th class=""c-item"">Item Number</th>
        <th class=""c-desc"">Description</th>
        <th class=""c-uom"">UOM</th>
        <th class=""c-up"">Unit Price</th>
        <th class=""c-ext"">Extended Price</th>
      </tr>
    </thead>
    <tbody>
      {{#Lines}}
      <tr>
        <td class=""num"">{{QtyOrdered}}</td>
        <td class=""num"">{{Quantity}}</td>
        <td class=""num"">{{QtyBackordered}}</td>
        <td class=""ctr"">{{Location}}</td>
        <td>{{ProductCode}}</td>
        <td>{{ProductDescription}}</td>
        <td class=""ctr"">{{Uom}}</td>
        <td class=""num"">{{UnitPrice}}</td>
        <td class=""num"">{{LineAmount}}</td>
      </tr>
      {{/Lines}}
      <tr><td></td><td></td><td></td><td></td><td></td><td class=""complete"">COMPLETE</td><td></td><td></td><td></td></tr>
      <tr class=""spacer""><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      <!-- Banking + totals as rows of the SAME table -->
      <tr class=""topline"">
        <td class=""bank"" colspan=""6"" rowspan=""5"">
          [[BANK_BLOCK]]
        </td>
        <td class=""tl"" colspan=""2"">Subtotal</td>
        <td class=""tv"">{{SubTotal}}</td>
      </tr>
      <tr><td class=""tl"" colspan=""2"">Total sales tax</td><td class=""tv"">{{VatAmount}}</td></tr>
      <tr class=""rule""><td class=""tl"" colspan=""2"">Total amount</td><td class=""tv"">{{TotalWithTax}}</td></tr>
      <tr><td class=""tl"" colspan=""2"">Less payment</td><td class=""tv"">{{LessPayment}}</td></tr>
      <tr class=""due""><td class=""tl"" colspan=""2"">Amount due</td><td class=""tv"">{{Total}}</td></tr>
    </tbody>
  </table>
  </div>

  <!-- ===== FULL-WIDTH ACCREDITATION BANNER (page bottom, line-to-line) ===== -->
  <div class=""banner-strip"">
    <img src=""{{Banner}}"" alt=""Accreditation"" />
  </div>
</body>
</html>";
    }
}

