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
        public List<string> Barcodes { get; set; } = new();
    }

    /// <summary>
    /// OCR every page separately (used by invoice packs, where each page is a different document type).
    /// PSM 1 does orientation/script detection so sideways e-mail / order pages still read.
    /// Falls back to PSM 11 (sparse text) for pages that come back nearly empty.
    /// </summary>
    public async Task<List<string>> ExtractPageTextsAsync(string filePath, string? contentType, int maxPages = 20)
        => (await ExtractPackPagesAsync(filePath, contentType, maxPages)).Select(p => p.Text).ToList();

    /// <summary>
    /// Full pack pass: rotation detection (0/90/180/270 via tesseract OSD), text (PSM 1 + sparse fallback),
    /// a dedicated header-band read, and barcode decoding (official orders with a barcode, layout G).
    /// </summary>
    public async Task<List<PackPage>> ExtractPackPagesAsync(string filePath, string? contentType, int maxPages = 20)
    {
        if (!_tesseractAvailable)
            throw new InvalidOperationException("tesseract binary is not available on this host.");

        var isPdf = (contentType?.Contains("pdf", StringComparison.OrdinalIgnoreCase) ?? false)
                    || filePath.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase);
        var workDir = Path.Combine(Path.GetTempPath(), "pack-ocr-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(workDir);
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
            foreach (var img in images)
            {
                var page = new PackPage();
                // Rotation: OSD gives the angle; rotate the bitmap upright so cropping (header band) and
                // barcode decoding work on a straight page. Tesseract PSM 1 handles rotation for text itself.
                page.Rotation = await DetectRotationAsync(img);
                var upright = img;
                if (page.Rotation != 0)
                {
                    try
                    {
                        // OSD "Rotate: N" = rotate the image clockwise by N degrees to make it upright.
                        using var im = await Image.LoadAsync(img);
                        im.Mutate(x => x.Rotate(page.Rotation switch { 90 => RotateMode.Rotate90, 180 => RotateMode.Rotate180, 270 => RotateMode.Rotate270, _ => RotateMode.None }));
                        upright = Path.Combine(workDir, Path.GetFileNameWithoutExtension(img) + "_up.png");
                        await im.SaveAsPngAsync(upright);
                    }
                    catch { upright = img; }
                }

                var t = await RunTesseractAsync(upright, psm: 1);
                if (upright != img)
                {
                    // Safety net: if the rotated read is worse than the original (OSD got it wrong), keep the original.
                    var t0 = await RunTesseractAsync(img, psm: 1);
                    if (WordScore(t0) > WordScore(t) * 1.2) { t = t0; upright = img; page.Rotation = 0; }
                }
                if (t.Trim().Length < 60) t += "\n" + await RunTesseractAsync(upright, psm: 11);
                // Sage letterheads print the document title and its number (IN… / ORD…) in white on a dark
                // header band, which tesseract drops. Re-read the top of the page on its own.
                var band = await ReadInvertedHeaderBandAsync(upright, workDir);
                if (!string.IsNullOrWhiteSpace(band)) t += "\n[HEADER] " + band;
                page.Text = t;
                page.Barcodes = DecodeBarcodes(upright);
                if (page.Barcodes.Count > 0) page.Text += "\n[BARCODE] " + string.Join(" ", page.Barcodes);
                pages.Add(page);
            }
            return pages;
        }
        finally { try { Directory.Delete(workDir, true); } catch { } }
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
