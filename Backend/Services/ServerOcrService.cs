using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace ProjectTracker.API.Services;

/// <summary>
/// Server-side intensive OCR for POD documents, used as a stronger fallback to the
/// in-browser (tesseract.js) reader. It shells out to the native <c>tesseract</c> binary,
/// rendering PDF pages first via poppler's <c>pdftoppm</c>. Tesseract runs with automatic
/// page segmentation + orientation/script detection (PSM 1) so upside-down and sideways
/// scans are read correctly, plus a sparse-text pass (PSM 11) for stamped/handwritten forms.
///
/// Requires the container/host to have <c>tesseract-ocr</c> and <c>poppler-utils</c> installed.
/// </summary>
public class ServerOcrService
{
    private readonly ILogger<ServerOcrService> _logger;

    // Resolve once whether the native tooling is present.
    private static readonly bool _tesseractAvailable = BinaryExists("tesseract");
    private static readonly bool _pdftoppmAvailable = BinaryExists("pdftoppm");

    public ServerOcrService(ILogger<ServerOcrService> logger)
    {
        _logger = logger;
    }

    public static bool IsAvailable => _tesseractAvailable;

    /// <summary>
    /// Runs OCR over a raw uploaded stream (not yet persisted as a POD). Writes it to a temp
    /// file, extracts invoice-number candidates, then cleans up. Used by the multi-POD uploader
    /// so the user can auto-detect invoice numbers before committing the upload.
    /// </summary>
    public async Task<OcrExtractionResult> ExtractFromStreamAsync(Stream stream, string fileName, string? contentType)
    {
        if (!_tesseractAvailable)
            throw new InvalidOperationException("tesseract binary is not available on this host.");

        var ext = Path.GetExtension(fileName);
        if (string.IsNullOrWhiteSpace(ext))
        {
            var isPdfType = contentType?.Contains("pdf", StringComparison.OrdinalIgnoreCase) ?? false;
            ext = isPdfType ? ".pdf" : ".png";
        }
        var tempFile = Path.Combine(Path.GetTempPath(), "pod-upload-" + Guid.NewGuid().ToString("N") + ext);
        try
        {
            using (var fs = new FileStream(tempFile, FileMode.Create))
            {
                await stream.CopyToAsync(fs);
            }
            return await ExtractInvoiceCandidatesAsync(tempFile, contentType);
        }
        finally
        {
            try { System.IO.File.Delete(tempFile); } catch { /* best-effort */ }
        }
    }

    /// <summary>
    /// Runs OCR over the file and returns extracted invoice-number candidates + raw text.
    /// </summary>
    public async Task<OcrExtractionResult> ExtractInvoiceCandidatesAsync(string filePath, string? contentType)
    {
        var result = new OcrExtractionResult();
        if (!_tesseractAvailable)
            throw new InvalidOperationException("tesseract binary is not available on this host.");

        var isPdf = (contentType?.Contains("pdf", StringComparison.OrdinalIgnoreCase) ?? false)
                    || filePath.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);

        var workDir = Path.Combine(Path.GetTempPath(), "pod-ocr-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(workDir);
        var imagePages = new List<string>();

        try
        {
            if (isPdf)
            {
                if (!_pdftoppmAvailable)
                    throw new InvalidOperationException("pdftoppm (poppler-utils) is required to OCR PDF PODs but is not installed.");

                // Render PDF → PNG pages at 300 DPI (crisp enough for 6-digit invoice numbers).
                var outPrefix = Path.Combine(workDir, "page");
                await RunProcessAsync("pdftoppm", $"-png -r 300 \"{filePath}\" \"{outPrefix}\"", 120_000);
                imagePages = Directory.GetFiles(workDir, "page*.png").OrderBy(p => p).Take(12).ToList();
            }
            else
            {
                imagePages.Add(filePath);
            }

            result.PageCount = imagePages.Count;
            var allText = new StringBuilder();

            foreach (var img in imagePages)
            {
                // Pass 1: auto page segmentation with orientation & script detection (handles rotation).
                var t1 = await RunTesseractAsync(img, psm: 1);
                allText.Append('\n').Append(t1);

                var candidates1 = ExtractInvoiceTokens(t1);
                // Pass 2 (only if the first pass found nothing): sparse-text mode for stamped forms.
                if (candidates1.Count == 0)
                {
                    var t2 = await RunTesseractAsync(img, psm: 11);
                    allText.Append('\n').Append(t2);
                }
            }

            result.RawText = allText.ToString().Trim();
            result.Candidates = ExtractInvoiceTokens(result.RawText).ToList();
            return result;
        }
        finally
        {
            try { Directory.Delete(workDir, true); } catch { /* best-effort cleanup */ }
        }
    }

    /// <summary>Per-page OCR output for packs: text, detected rotation and any barcodes on the page.</summary>
    public class PackPage
    {
        public string Text { get; set; } = "";
        public int Rotation { get; set; }
        /// <summary>Skew correction applied after rotation, in degrees (positive = page was rotated clockwise to straighten).</summary>
        public double Skew { get; set; }
        /// <summary>True when the contrast-enhanced copy read better than the raw scan (faint / light-grey page).</summary>
        public bool Enhanced { get; set; }
        /// <summary>Mean word confidence (0–1) from tesseract for the main pass.</summary>
        public double Confidence { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public List<string> Barcodes { get; set; } = new();
        /// <summary>Words with position (fractions of page width/height) and confidence — for field highlighting.</summary>
        public List<OcrWord> Words { get; set; } = new();
        /// <summary>Path of the upright, deskewed page image when <c>keepImagesIn</c> was given.</summary>
        public string? ImagePath { get; set; }
    }

    public class OcrWord
    {
        public string T { get; set; } = "";
        public double C { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double W { get; set; }
        public double H { get; set; }
    }

    /// <summary>
    /// OCR every page separately (used by invoice packs, where each page is a different document type).
    /// PSM 1 does orientation/script detection so sideways e-mail / order pages still read.
    /// Falls back to PSM 11 (sparse text) for pages that come back nearly empty.
    /// </summary>
    public async Task<List<string>> ExtractPageTextsAsync(string filePath, string? contentType, int maxPages = 20)
        => (await ExtractPackPagesAsync(filePath, contentType, maxPages)).Select(p => p.Text).ToList();

    /// <summary>
    /// Full pack pass per page: rotation (tesseract OSD) → deskew (projection profile) → text with word
    /// boxes + confidence (TSV) → contrast-enhanced retry when the read is poor → sparse-text fallback →
    /// header-band read → barcodes. When <paramref name="keepImagesIn"/> is set the upright page images are
    /// kept there (for the splitter's page viewer) instead of being deleted with the work dir.
    /// </summary>
    public async Task<List<PackPage>> ExtractPackPagesAsync(string filePath, string? contentType, int maxPages = 20, string? keepImagesIn = null)
    {
        if (!_tesseractAvailable)
            throw new InvalidOperationException("tesseract binary is not available on this host.");

        var isPdf = (contentType?.Contains("pdf", StringComparison.OrdinalIgnoreCase) ?? false)
                    || filePath.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
        var workDir = Path.Combine(Path.GetTempPath(), "pack-ocr-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(workDir);
        if (keepImagesIn != null) Directory.CreateDirectory(keepImagesIn);
        try
        {
            List<string> images;
            if (isPdf)
            {
                if (!_pdftoppmAvailable) throw new InvalidOperationException("pdftoppm (poppler-utils) is required to OCR PDFs but is not installed.");
                var outPrefix = Path.Combine(workDir, "page");
                await RunProcessAsync("pdftoppm", $"-png -r 300 \"{filePath}\" \"{outPrefix}\"", 180_000);
                images = Directory.GetFiles(workDir, "page*.png").OrderBy(p => p).Take(maxPages).ToList();
            }
            else images = new List<string> { filePath };

            var pages = new List<PackPage>();
            var pageNo = 0;
            foreach (var img in images)
            {
                pageNo++;
                var page = new PackPage();
                // 1. Rotation: OSD gives the angle; rotate the bitmap upright so cropping (header band),
                //    barcode decoding and word positions all refer to a straight page.
                page.Rotation = await DetectRotationAsync(img);
                var upright = img;
                string? deskewed = null;
                try
                {
                    using var im = await Image.LoadAsync(img);
                    if (page.Rotation != 0)
                    {
                        im.Mutate(x => x.Rotate(page.Rotation switch { 90 => RotateMode.Rotate90, 180 => RotateMode.Rotate180, 270 => RotateMode.Rotate270, _ => RotateMode.None }));
                        upright = Path.Combine(workDir, Path.GetFileNameWithoutExtension(img) + "_up.png");
                        await im.SaveAsPngAsync(upright);
                    }
                    page.Width = im.Width; page.Height = im.Height;
                    // 2. Deskew: small residual tilt from the feeder (±4°) blurs table rows for OCR. Only when the
                    //    projection profile is clearly sharper at the new angle; the read is verified below.
                    page.Skew = EstimateSkew(im);
                    if (Math.Abs(page.Skew) >= 0.3)
                    {
                        im.Mutate(x => x.Rotate((float)-page.Skew).BackgroundColor(Color.White));
                        deskewed = Path.Combine(workDir, Path.GetFileNameWithoutExtension(img) + "_dsk.png");
                        await im.SaveAsPngAsync(deskewed);
                    }
                }
                catch { upright = img; deskewed = null; }

                // 3. Main read with word boxes + confidence.
                var (t, words, conf) = await RunTesseractTsvAsync(upright, psm: 1);
                if (deskewed != null)
                {
                    // Keep the deskewed read only when it is genuinely better; otherwise the tilt estimate was noise.
                    var (t1, w1, c1) = await RunTesseractTsvAsync(deskewed, psm: 1);
                    if (WordScore(t1) > WordScore(t) * 1.08 || (WordScore(t1) >= WordScore(t) && c1 > conf + 0.03)) { t = t1; words = w1; conf = c1; upright = deskewed; }
                    else page.Skew = 0;
                }
                if (upright != img && page.Rotation != 0)
                {
                    // Safety net: if the rotated read is worse than the original (OSD got it wrong), keep the original.
                    var (t0, w0, c0) = await RunTesseractTsvAsync(img, psm: 1);
                    if (WordScore(t0) > WordScore(t) * 1.2) { t = t0; words = w0; conf = c0; upright = img; page.Rotation = 0; page.Skew = 0; }
                }
                // 4. Faint / light-grey pages (a faded order confirmation, a pale stamp): boost contrast and retry.
                if (WordScore(t) < 40 || conf < 0.55)
                {
                    var enh = await EnhanceAsync(upright, workDir);
                    if (enh != null)
                    {
                        var (t1, w1, c1) = await RunTesseractTsvAsync(enh, psm: 1);
                        if (WordScore(t1) > WordScore(t) * 1.15 || (WordScore(t1) >= WordScore(t) && c1 > conf + 0.05))
                        { t = t1; words = w1; conf = c1; page.Enhanced = true; }
                    }
                }
                if (t.Trim().Length < 60) t += "\n" + await RunTesseractAsync(upright, psm: 11);
                // 5. Sage letterheads print the document title and its number (IN… / ORD…) in white on a dark
                //    header band, which tesseract drops. Re-read the top of the page on its own.
                var band = await ReadInvertedHeaderBandAsync(upright, workDir);
                if (!string.IsNullOrWhiteSpace(band)) t += "\n[HEADER] " + band;
                page.Text = t;
                page.Words = words;
                page.Confidence = conf;
                page.Barcodes = DecodeBarcodes(upright);
                if (page.Barcodes.Count > 0) page.Text += "\n[BARCODE] " + string.Join(" ", page.Barcodes);
                if (keepImagesIn != null)
                {
                    try
                    {
                        // Preview copy, downscaled so the viewer loads quickly; word boxes are fractions so they still fit.
                        using var im = await Image.LoadAsync(upright);
                        var scale = Math.Min(1.0, 1400.0 / Math.Max(im.Width, im.Height));
                        if (scale < 1) im.Mutate(x => x.Resize((int)(im.Width * scale), (int)(im.Height * scale)));
                        var dest = Path.Combine(keepImagesIn, $"p{pageNo:D3}.png");
                        await im.SaveAsPngAsync(dest);
                        page.ImagePath = dest;
                    }
                    catch (Exception ex) { _logger.LogDebug(ex, "Could not keep page image {Page}", pageNo); }
                }
                pages.Add(page);
            }
            return pages;
        }
        finally { try { Directory.Delete(workDir, true); } catch { } }
    }

    /// <summary>
    /// Skew angle (degrees) of the text lines, via projection profile: binarise a downscaled copy and pick the
    /// rotation (−4°…+4°, 0.25° steps) whose row-ink histogram has the highest variance (sharpest line peaks).
    /// </summary>
    private static double EstimateSkew(Image src)
    {
        try
        {
            using var small = src.CloneAs<SixLabors.ImageSharp.PixelFormats.L8>();
            var scale = 600.0 / Math.Max(small.Width, small.Height);
            if (scale < 1) small.Mutate(x => x.Resize((int)(small.Width * scale), (int)(small.Height * scale)));
            small.Mutate(x => x.BinaryThreshold(0.6f));
            double bestVar = -1, bestAngle = 0, var0 = 0;
            for (var a = -4.0; a <= 4.0001; a += 0.25)
            {
                using var rot = small.Clone(x => x.Rotate((float)a).BackgroundColor(Color.White));
                var rows = new double[rot.Height];
                rot.ProcessPixelRows(acc =>
                {
                    for (var y = 0; y < acc.Height; y++)
                    {
                        var row = acc.GetRowSpan(y); var ink = 0;
                        for (var x = 0; x < row.Length; x++) if (row[x].PackedValue < 128) ink++;
                        rows[y] = ink;
                    }
                });
                var mean = rows.Average();
                var v = rows.Sum(r => (r - mean) * (r - mean)) / rows.Length;
                if (Math.Abs(a) < 0.01) var0 = v;
                if (v > bestVar) { bestVar = v; bestAngle = a; }
            }
            // Table rules and letterheads can produce a sharper profile at a wrong angle; demand a clear win over 0°.
            return bestVar > var0 * 1.15 ? Math.Round(bestAngle, 2) : 0;
        }
        catch { return 0; }
    }

    /// <summary>Grayscale + strong contrast + adaptive threshold copy, for faint pages and light-grey stamps.</summary>
    private static async Task<string?> EnhanceAsync(string imagePath, string workDir)
    {
        try
        {
            using var im = await Image.LoadAsync<SixLabors.ImageSharp.PixelFormats.L8>(imagePath);
            im.Mutate(x => x.Contrast(1.8f).GaussianSharpen(0.8f).AdaptiveThreshold());
            var dest = Path.Combine(workDir, Path.GetFileNameWithoutExtension(imagePath) + "_enh.png");
            await im.SaveAsPngAsync(dest);
            return dest;
        }
        catch { return null; }
    }

    /// <summary>
    /// Tesseract pass producing both the plain text (same layout as a normal run — the label-distance logic in
    /// the analysers depends on it) and the TSV word boxes as fractions of the page, plus mean word confidence (0–1).
    /// One tesseract invocation writes both outputs (`txt tsv` configs).
    /// </summary>
    private async Task<(string text, List<OcrWord> words, double conf)> RunTesseractTsvAsync(string imagePath, int psm)
    {
        var outBase = Path.Combine(Path.GetDirectoryName(imagePath)!, Path.GetFileNameWithoutExtension(imagePath) + $"_psm{psm}_{Guid.NewGuid():N}");
        string tsv, text;
        try
        {
            await RunProcessAsync("tesseract", $"\"{imagePath}\" \"{outBase}\" -l eng --oem 1 --psm {psm} txt tsv", 120_000);
            text = File.Exists(outBase + ".txt") ? await File.ReadAllTextAsync(outBase + ".txt") : "";
            tsv = File.Exists(outBase + ".tsv") ? await File.ReadAllTextAsync(outBase + ".tsv") : "";
        }
        catch (Exception ex) { _logger.LogWarning(ex, "tesseract txt+tsv pass failed (psm {Psm}) for {Image}", psm, imagePath); return (await RunTesseractAsync(imagePath, psm), new List<OcrWord>(), 0); }
        finally { foreach (var f in new[] { outBase + ".txt", outBase + ".tsv" }) { try { if (File.Exists(f)) File.Delete(f); } catch { } } }

        int pw = 0, ph = 0;
        var words = new List<OcrWord>();
        double confSum = 0; var confN = 0;
        foreach (var line in tsv.Split('\n'))
        {
            var c = line.TrimEnd('\r').Split('\t');
            if (c.Length < 12 || c[0] == "level") continue;
            if (!int.TryParse(c[0], out var level)) continue;
            if (level == 1) { int.TryParse(c[8], out pw); int.TryParse(c[9], out ph); continue; }
            if (level != 5) continue;
            var t = c[11];
            if (string.IsNullOrWhiteSpace(t)) continue;
            double.TryParse(c[10], System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var conf);
            if (conf >= 0) { confSum += conf; confN++; }
            if (pw > 0 && ph > 0 && int.TryParse(c[6], out var x) && int.TryParse(c[7], out var y) && int.TryParse(c[8], out var w) && int.TryParse(c[9], out var h))
                words.Add(new OcrWord { T = t, C = Math.Round(Math.Max(0, conf) / 100.0, 2), X = Math.Round((double)x / pw, 4), Y = Math.Round((double)y / ph, 4), W = Math.Round((double)w / pw, 4), H = Math.Round((double)h / ph, 4) });
        }
        return (text, words, confN > 0 ? Math.Round(confSum / confN / 100.0, 3) : 0);
    }

    /// <summary>Rough "how much real text is in here" score: count of 3+ letter words.</summary>
    private static int WordScore(string? t) =>
        string.IsNullOrEmpty(t) ? 0 : System.Text.RegularExpressions.Regex.Matches(t, @"\b[A-Za-z]{3,}\b").Count;

    public static bool CanRenderPdf => _pdftoppmAvailable;

    /// <summary>
    /// Render every page of a PDF as a small PNG (longest side = <paramref name="scaleTo"/> px) into
    /// <paramref name="outDir"/> as page-001.png, page-002.png … Used for the multi-pack splitter preview.
    /// </summary>
    public async Task<List<string>> RenderThumbnailsAsync(string pdfPath, string outDir, int scaleTo = 360)
    {
        if (!_pdftoppmAvailable) throw new InvalidOperationException("pdftoppm (poppler-utils) is required to render PDF pages but is not installed.");
        Directory.CreateDirectory(outDir);
        var prefix = Path.Combine(outDir, "page");
        await RunProcessAsync("pdftoppm", $"-png -scale-to {scaleTo} \"{pdfPath}\" \"{prefix}\"", 180_000);
        // pdftoppm zero-pads to the digit count of the page total (page-1.png, page-01.png, page-001.png): normalise.
        var files = Directory.GetFiles(outDir, "page-*.png").OrderBy(p => int.Parse(System.Text.RegularExpressions.Regex.Match(Path.GetFileNameWithoutExtension(p), @"\d+$").Value)).ToList();
        var outFiles = new List<string>();
        for (var i = 0; i < files.Count; i++)
        {
            var dest = Path.Combine(outDir, $"p{i + 1:D3}.png");
            if (File.Exists(dest)) File.Delete(dest);
            File.Move(files[i], dest);
            outFiles.Add(dest);
        }
        return outFiles;
    }

    /// <summary>Orientation via tesseract OSD ("Rotate: 90"). 0 when undetermined.</summary>
    private async Task<int> DetectRotationAsync(string imagePath)
    {
        try
        {
            var osd = await RunProcessAsync("tesseract", $"\"{imagePath}\" stdout --psm 0 -l osd", 60_000);
            var m = Regex.Match(osd, @"Rotate:\s*(\d+)");
            var conf = Regex.Match(osd, @"Orientation confidence:\s*([\d.]+)");
            if (!m.Success) return 0;
            if (conf.Success && double.TryParse(conf.Groups[1].Value, System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out var c) && c < 1.0) return 0;
            return int.Parse(m.Groups[1].Value) % 360;
        }
        catch { return 0; }
    }

    /// <summary>Decode 1-D / 2-D barcodes on the page (ZXing). Tries the full page and the top third.</summary>
    private List<string> DecodeBarcodes(string imagePath)
    {
        var found = new List<string>();
        try
        {
            using var img = Image.Load<SixLabors.ImageSharp.PixelFormats.Rgba32>(imagePath);
            var reader = new ZXing.ImageSharp.BarcodeReader<SixLabors.ImageSharp.PixelFormats.Rgba32>
            {
                AutoRotate = true,
                Options = new ZXing.Common.DecodingOptions { TryHarder = true, TryInverted = true, PossibleFormats = new List<ZXing.BarcodeFormat> { ZXing.BarcodeFormat.CODE_128, ZXing.BarcodeFormat.CODE_39, ZXing.BarcodeFormat.CODE_93, ZXing.BarcodeFormat.ITF, ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.QR_CODE, ZXing.BarcodeFormat.DATA_MATRIX, ZXing.BarcodeFormat.PDF_417 } },
            };
            var results = reader.DecodeMultiple(img);
            if (results != null) foreach (var r in results) if (!string.IsNullOrWhiteSpace(r.Text) && !found.Contains(r.Text)) found.Add(r.Text.Trim());
            if (found.Count == 0)
            {
                img.Mutate(x => x.Crop(new Rectangle(0, 0, img.Width, Math.Max(1, img.Height / 3))));
                var r2 = reader.Decode(img);
                if (r2 != null && !string.IsNullOrWhiteSpace(r2.Text)) found.Add(r2.Text.Trim());
            }
        }
        catch (Exception ex) { _logger.LogDebug(ex, "Barcode decode failed for {Image}", imagePath); }
        return found;
    }

    /// <summary>
    /// Re-read the top ~25% of the page on its own. Sage letterheads print the title and its number
    /// (IN… / ORD…) in white on a dark band; tesseract skips that region when it segments the whole page,
    /// but reads it when the strip is presented alone as a single block (PSM 6). An inverted copy is
    /// tried as well; both results are returned.
    /// </summary>
    private async Task<string> ReadInvertedHeaderBandAsync(string imagePath, string workDir)
    {
        try
        {
            using var image = await Image.LoadAsync<SixLabors.ImageSharp.PixelFormats.L8>(imagePath);
            var landscape = image.Width > image.Height;
            var rect = landscape
                ? new Rectangle(0, 0, Math.Max(1, (int)(image.Width * 0.25)), image.Height)
                : new Rectangle(0, 0, image.Width, Math.Max(1, (int)(image.Height * 0.25)));
            image.Mutate(x => x.Crop(rect));
            var baseName = Path.GetFileNameWithoutExtension(imagePath);
            var plainPath = Path.Combine(workDir, baseName + "_hdr.png");
            await image.SaveAsPngAsync(plainPath);
            var plain = await RunTesseractAsync(plainPath, psm: 6);

            image.Mutate(x => x.Invert().Contrast(1.5f));
            var invPath = Path.Combine(workDir, baseName + "_hdr_inv.png");
            await image.SaveAsPngAsync(invPath);
            var inverted = await RunTesseractAsync(invPath, psm: 6);

            return (plain.Trim() + "\n" + inverted.Trim()).Trim();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Header-band OCR pass failed for {Image}", imagePath);
            return string.Empty;
        }
    }

    private async Task<string> RunTesseractAsync(string imagePath, int psm)
    {
        // Output to stdout. -l eng+osd enables orientation/script detection alongside English.
        // `stdout` as the output base tells tesseract to print recognised text to standard output.
        var args = $"\"{imagePath}\" stdout -l eng --oem 1 --psm {psm}";
        try
        {
            return await RunProcessAsync("tesseract", args, 90_000);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "tesseract pass failed (psm {Psm}) for {Image}", psm, imagePath);
            return string.Empty;
        }
    }

    /// <summary>Extract IN###### candidate tokens from noisy OCR text (mirrors the frontend logic).</summary>
    private static HashSet<string> ExtractInvoiceTokens(string text)
    {
        var tokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(text)) return tokens;
        var upper = text.ToUpperInvariant();

        // IN-ish prefix + 5-8 digit/confusable chars.
        foreach (Match m in Regex.Matches(upper, @"\b[I1L][NMH][\s.\-:]?[0-9OQDILSBZGT]{5,8}\b"))
            tokens.Add(Regex.Replace(m.Value, @"[\s.\-:]", ""));
        // Literal INV / INVOICE label + number.
        foreach (Match m in Regex.Matches(upper, @"INV(?:OICE)?[\s.#:\-]*([0-9OQDILSBZGT]{5,8})"))
            tokens.Add("IN" + Regex.Replace(m.Groups[1].Value, @"[\s.\-:]", ""));
        // Bare 6-digit fallback (backend validates against real invoices).
        foreach (Match m in Regex.Matches(upper, @"\b([0-9]{6})\b"))
            tokens.Add("IN" + m.Groups[1].Value);

        return tokens;
    }

    private static async Task<string> RunProcessAsync(string fileName, string arguments, int timeoutMs)
    {
        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = new Process { StartInfo = psi };
        var stdout = new StringBuilder();
        var stderr = new StringBuilder();
        process.OutputDataReceived += (_, e) => { if (e.Data != null) stdout.AppendLine(e.Data); };
        process.ErrorDataReceived += (_, e) => { if (e.Data != null) stderr.AppendLine(e.Data); };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        using var cts = new CancellationTokenSource(timeoutMs);
        try
        {
            await process.WaitForExitAsync(cts.Token);
        }
        catch (OperationCanceledException)
        {
            try { process.Kill(true); } catch { }
            throw new TimeoutException($"{fileName} timed out after {timeoutMs}ms.");
        }

        if (process.ExitCode != 0)
            throw new InvalidOperationException($"{fileName} exited {process.ExitCode}: {stderr}");

        return stdout.ToString();
    }

    private static bool BinaryExists(string name)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = "/bin/sh",
                Arguments = $"-c \"command -v {name}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = Process.Start(psi);
            if (p == null) return false;
            var outp = p.StandardOutput.ReadToEnd();
            p.WaitForExit(5000);
            return !string.IsNullOrWhiteSpace(outp);
        }
        catch
        {
            return false;
        }
    }
}

public class OcrExtractionResult
{
    public List<string> Candidates { get; set; } = new();
    public string RawText { get; set; } = string.Empty;
    public int PageCount { get; set; }
}
