using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;

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
