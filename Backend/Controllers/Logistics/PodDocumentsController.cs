using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers.Logistics
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PodDocumentsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PodDocumentsController> _logger;
        private readonly string _storagePath;

        public PodDocumentsController(
            ApplicationDbContext context,
            ILogger<PodDocumentsController> logger,
            IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            var basePath = configuration.GetValue<string>("DocumentsPath")
                ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            _storagePath = Path.Combine(basePath, "Logistics", "POD-Documents");
        }

        /// <summary>
        /// Get all POD documents with filtering
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] string? region,
            [FromQuery] string? driverName,
            [FromQuery] int? driverId,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int? month,
            [FromQuery] int? year,
            [FromQuery] string? linkStatus,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var query = _context.PodDocuments
                .Include(p => p.InvoiceLinks)
                    .ThenInclude(l => l.Invoice)
                .AsQueryable();

            if (!string.IsNullOrEmpty(region))
                query = query.Where(p => p.Region == region);

            if (!string.IsNullOrEmpty(driverName))
                query = query.Where(p => p.DriverName.Contains(driverName));

            if (driverId.HasValue)
                query = query.Where(p => p.DriverId == driverId.Value);

            if (fromDate.HasValue)
                query = query.Where(p => p.DeliveryDate >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(p => p.DeliveryDate <= toDate.Value);

            if (month.HasValue)
                query = query.Where(p => p.DeliveryDate.Month == month.Value);

            if (year.HasValue)
                query = query.Where(p => p.DeliveryDate.Year == year.Value);

            if (!string.IsNullOrEmpty(linkStatus))
            {
                if (linkStatus == "linked")
                    query = query.Where(p => p.LoadId != null || p.InvoiceId != null || p.InvoiceLinks.Any());
                else if (linkStatus == "not-linked")
                    query = query.Where(p => p.LoadId == null && p.InvoiceId == null && !p.InvoiceLinks.Any());
            }

            var total = await query.CountAsync();

            var pods = await query
                .OrderByDescending(p => p.DeliveryDate)
                .ThenBy(p => p.DriverName)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(p => new
                {
                    p.Id,
                    p.PodNumber,
                    p.DriverId,
                    p.DriverName,
                    p.DeliveryDate,
                    p.Region,
                    p.FileName,
                    p.OriginalFileName,
                    p.ContentType,
                    p.FileSize,
                    p.Notes,
                    p.UploadedAt,
                    p.CreatedAt,
                    p.LoadId,
                    LoadNumber = p.Load != null ? p.Load.LoadNumber : null,
                    p.InvoiceId,
                    InvoiceNumber = p.Invoice != null ? p.Invoice.TransactionNumber : null,
                    InvoiceLinks = p.InvoiceLinks
                        .OrderBy(l => l.Invoice != null ? l.Invoice.TransactionNumber : "")
                        .Select(l => new
                        {
                            l.Id,
                            l.InvoiceId,
                            InvoiceNumber = l.Invoice != null ? l.Invoice.TransactionNumber : null,
                            l.LinkedAt
                        })
                        .ToList()
                })
                .ToListAsync();

            return Ok(new { data = pods, total, page, pageSize });
        }

        /// <summary>
        /// Get POD summary/stats
        /// </summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary()
        {
            var total = await _context.PodDocuments.CountAsync();
            
            var linked = await _context.PodDocuments.CountAsync(p => p.LoadId != null || p.InvoiceId != null || p.InvoiceLinks.Any());
            var unlinked = total - linked;
            var linkedToTripsheet = await _context.PodDocuments.CountAsync(p => p.LoadId != null);
            var linkedToInvoice = await _context.PodDocuments.CountAsync(p => p.InvoiceId != null || p.InvoiceLinks.Any());

            var byRegion = await _context.PodDocuments
                .GroupBy(p => p.Region)
                .Select(g => new { Region = g.Key, Count = g.Count() })
                .ToListAsync();

            var byMonth = await _context.PodDocuments
                .GroupBy(p => new { p.DeliveryDate.Year, p.DeliveryDate.Month })
                .Select(g => new { g.Key.Year, g.Key.Month, Count = g.Count() })
                .OrderByDescending(x => x.Year).ThenByDescending(x => x.Month)
                .ToListAsync();

            var drivers = await _context.PodDocuments
                .GroupBy(p => p.DriverName)
                .Select(g => new { DriverName = g.Key, Count = g.Count() })
                .OrderBy(x => x.DriverName)
                .ToListAsync();

            var dateRange = total > 0
                ? new
                {
                    earliest = await _context.PodDocuments.MinAsync(p => p.DeliveryDate),
                    latest = await _context.PodDocuments.MaxAsync(p => p.DeliveryDate)
                }
                : null;

            return Ok(new { total, linked, unlinked, linkedToTripsheet, linkedToInvoice, byRegion, byMonth, drivers, dateRange });
        }

        /// <summary>
        /// Get unique drivers
        /// </summary>
        [HttpGet("drivers")]
        public async Task<IActionResult> GetDrivers()
        {
            var drivers = await _context.PodDocuments
                .Select(p => new { p.DriverId, p.DriverName })
                .Distinct()
                .OrderBy(d => d.DriverName)
                .ToListAsync();

            return Ok(drivers);
        }

        /// <summary>
        /// View a POD file (inline)
        /// </summary>
        [HttpGet("{id}/view")]
        public async Task<IActionResult> ViewPod(int id)
        {
            var pod = await _context.PodDocuments.FindAsync(id);
            if (pod == null)
                return NotFound("POD document not found");

            if (!System.IO.File.Exists(pod.FilePath))
                return NotFound("POD file not found on server");

            var fileBytes = await System.IO.File.ReadAllBytesAsync(pod.FilePath);
            var contentType = pod.ContentType ?? GetContentType(pod.FilePath);

            return File(fileBytes, contentType);
        }

        /// <summary>
        /// Download a POD file
        /// </summary>
        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadPod(int id)
        {
            var pod = await _context.PodDocuments.FindAsync(id);
            if (pod == null)
                return NotFound("POD document not found");

            if (!System.IO.File.Exists(pod.FilePath))
                return NotFound("POD file not found on server");

            var fileBytes = await System.IO.File.ReadAllBytesAsync(pod.FilePath);
            var contentType = pod.ContentType ?? GetContentType(pod.FilePath);
            var downloadName = pod.OriginalFileName ?? pod.FileName;

            return File(fileBytes, contentType, downloadName);
        }

        /// <summary>
        /// Upload a new POD document
        /// </summary>
        [HttpPost("upload")]
        public async Task<IActionResult> Upload(
            [FromForm] IFormFile file,
            [FromForm] string driverName,
            [FromForm] string region,
            [FromForm] DateTime deliveryDate,
            [FromForm] int? driverId,
            [FromForm] string? notes)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            var allowedExtensions = new[] { ".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".xls", ".zip" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest("Invalid file type");

            if (file.Length > 20 * 1024 * 1024) // 20MB max
                return BadRequest("File size exceeds 20MB limit");

            try
            {
                Directory.CreateDirectory(_storagePath);

                // Generate filename: {Region}_{DriverName}_{yyyyMMdd}{ext}
                var safeName = string.Join("_", driverName.Split(Path.GetInvalidFileNameChars()));
                var fileName = $"{region}_{safeName}_{deliveryDate:yyyyMMdd}_{DateTime.UtcNow:HHmmss}{extension}";
                var filePath = Path.Combine(_storagePath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Try to match driver
                int? matchedDriverId = driverId;
                if (!matchedDriverId.HasValue)
                {
                    var driver = await _context.Drivers
                        .FirstOrDefaultAsync(d => d.FirstName.ToLower() == driverName.ToLower().Trim());
                    matchedDriverId = driver?.Id;
                }

                var pod = new PodDocument
                {
                    DriverId = matchedDriverId,
                    DriverName = driverName.Trim(),
                    DeliveryDate = deliveryDate.Date,
                    Region = region.ToUpper().Trim(),
                    FilePath = filePath,
                    FileName = fileName,
                    OriginalFileName = file.FileName,
                    ContentType = GetContentType(filePath),
                    FileSize = file.Length,
                    Notes = notes,
                    UploadedAt = DateTime.UtcNow
                };

                _context.PodDocuments.Add(pod);
                await _context.SaveChangesAsync();
                await AssignPodNumberAsync(pod);

                return Ok(new
                {
                    message = "POD uploaded successfully",
                    pod.Id,
                    pod.PodNumber,
                    pod.FileName,
                    pod.DriverName,
                    pod.DeliveryDate,
                    pod.Region
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading POD document");
                return StatusCode(500, $"Error uploading POD: {ex.Message}");
            }
        }

        /// <summary>
        /// Upload a POD document and, in the same request, tag it with the invoice
        /// numbers it covers (typed in by the user — no driver required). Each invoice
        /// number is resolved against ImportedInvoices (with OCR-style tolerance) and
        /// linked via PodDocumentInvoiceLink. Designed for the Admin Center multi-POD
        /// uploader, which loops one call per file.
        /// </summary>
        [HttpPost("upload-with-invoices")]
        public async Task<IActionResult> UploadWithInvoices(
            [FromForm] IFormFile file,
            [FromForm] string invoiceNumbers,
            [FromForm] string? region,
            [FromForm] DateTime? deliveryDate,
            [FromForm] string? notes)
        {
            if (file == null || file.Length == 0)
                return BadRequest("No file uploaded");

            var allowedExtensions = new[] { ".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".xls", ".zip" };
            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!allowedExtensions.Contains(extension))
                return BadRequest("Invalid file type");

            if (file.Length > 20 * 1024 * 1024) // 20MB max
                return BadRequest("File size exceeds 20MB limit");

            // Split the typed invoice numbers on comma / newline / semicolon / whitespace.
            var rawTokens = (invoiceNumbers ?? string.Empty)
                .Split(new[] { ',', ';', '\n', '\r', '\t', ' ' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            try
            {
                // Resolve invoice-number tokens → invoices (OCR-tolerant normalisation).
                var candidateMap = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
                foreach (var raw in rawTokens)
                {
                    foreach (var normalized in NormalizeInvoiceCandidate(raw))
                    {
                        if (!candidateMap.TryGetValue(normalized, out var origs))
                        {
                            origs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                            candidateMap[normalized] = origs;
                        }
                        origs.Add(raw);
                    }
                }

                var keys = candidateMap.Keys.ToList();
                var matchedInvoices = keys.Count > 0
                    ? await _context.ImportedInvoices.Where(i => keys.Contains(i.TransactionNumber)).ToListAsync()
                    : new List<Models.Logistics.ImportedInvoice>();

                var matchedKeys = new HashSet<string>(matchedInvoices.Select(i => i.TransactionNumber), StringComparer.OrdinalIgnoreCase);
                var unmatched = candidateMap
                    .Where(kv => !matchedKeys.Contains(kv.Key))
                    .SelectMany(kv => kv.Value)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                // Detect a possible re-upload: an existing POD with the same original
                // file name. We DON'T block it (staff legitimately re-upload/replace),
                // but we flag it so the UI can alert the user.
                var duplicateOf = await _context.PodDocuments
                    .Where(p => p.OriginalFileName == file.FileName)
                    .OrderByDescending(p => p.UploadedAt)
                    .Select(p => new { p.Id, p.PodNumber, p.OriginalFileName, p.UploadedAt, p.DeliveryDate })
                    .FirstOrDefaultAsync();

                // Save the file.
                Directory.CreateDirectory(_storagePath);
                var effectiveRegion = string.IsNullOrWhiteSpace(region) ? "POD" : region.ToUpper().Trim();
                var effectiveDate = (deliveryDate ?? DateTime.UtcNow).Date;
                var fileName = $"{effectiveRegion}_INV_{effectiveDate:yyyyMMdd}_{DateTime.UtcNow:HHmmssfff}{extension}";
                var filePath = Path.Combine(_storagePath, fileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var pod = new PodDocument
                {
                    DriverId = null,
                    DriverName = string.Empty,
                    DeliveryDate = effectiveDate,
                    Region = effectiveRegion,
                    FilePath = filePath,
                    FileName = fileName,
                    OriginalFileName = file.FileName,
                    ContentType = GetContentType(filePath),
                    FileSize = file.Length,
                    Notes = notes,
                    UploadedAt = DateTime.UtcNow
                };
                _context.PodDocuments.Add(pod);
                await _context.SaveChangesAsync();
                await AssignPodNumberAsync(pod);

                // Link BOTH matched and unmatched invoice numbers. Unmatched numbers are
                // stored with a null InvoiceId so they can be reconciled once the invoice
                // importer catches up — the POD is never blocked on a missing invoice.
                string? loadNumber = null;

                var links = new List<PodDocumentInvoiceLink>();
                links.AddRange(matchedInvoices.Select(i => new PodDocumentInvoiceLink
                {
                    PodDocumentId = pod.Id,
                    InvoiceId = i.Id,
                    InvoiceNumber = i.TransactionNumber,
                    LinkedAt = DateTime.UtcNow
                }));
                links.AddRange(unmatched.Select(num => new PodDocumentInvoiceLink
                {
                    PodDocumentId = pod.Id,
                    InvoiceId = null,
                    InvoiceNumber = num,
                    LinkedAt = DateTime.UtcNow
                }));
                if (links.Count > 0)
                    _context.PodDocumentInvoiceLinks.AddRange(links);

                if (matchedInvoices.Count > 0)
                {
                    foreach (var invoice in matchedInvoices)
                    {
                        invoice.Status = "Delivered";
                        invoice.LastDeliveryDate = pod.DeliveryDate;
                    }

                    // Auto-link to a tripsheet if any invoice belongs to one.
                    var loadId = matchedInvoices.Select(i => i.LoadId).FirstOrDefault(x => x.HasValue);
                    if (loadId.HasValue)
                    {
                        pod.LoadId = loadId.Value;
                        var load = await _context.Loads.FindAsync(loadId.Value);
                        loadNumber = load?.LoadNumber;
                    }

                    pod.InvoiceId = matchedInvoices.First().Id; // legacy compatibility
                }

                if (links.Count > 0 || matchedInvoices.Count > 0)
                    await _context.SaveChangesAsync();

                return Ok(new
                {
                    message = $"POD uploaded and linked to {matchedInvoices.Count} invoice(s)"
                        + (unmatched.Count > 0 ? $", {unmatched.Count} pending (not yet imported)" : "")
                        + (loadNumber != null ? $" · tripsheet {loadNumber}" : "")
                        + (duplicateOf != null ? $" · ⚠ possible duplicate of {duplicateOf.PodNumber}" : ""),
                    pod.Id,
                    pod.PodNumber,
                    pod.FileName,
                    pod.OriginalFileName,
                    pod.DeliveryDate,
                    loadNumber,
                    matchedInvoiceNumbers = matchedInvoices.Select(i => i.TransactionNumber).OrderBy(n => n).ToList(),
                    unmatchedInvoiceNumbers = unmatched,
                    isDuplicate = duplicateOf != null,
                    duplicateOf
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading POD with invoices");
                return StatusCode(500, $"Error uploading POD: {ex.Message}");
            }
        }

        /// <summary>
        /// Check whether any of the supplied original file names have already been
        /// uploaded as a POD. Lets the uploader UI warn the user about a re-upload
        /// BEFORE they commit. Returns the matching existing POD(s) per file name.
        /// </summary>
        [HttpPost("check-duplicates")]
        public async Task<IActionResult> CheckDuplicates([FromBody] CheckDuplicatesRequest request)
        {
            if (request?.FileNames == null || request.FileNames.Count == 0)
                return Ok(new { duplicates = new List<object>() });

            var names = request.FileNames
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Select(n => n.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var existing = await _context.PodDocuments
                .Where(p => p.OriginalFileName != null && names.Contains(p.OriginalFileName))
                .OrderByDescending(p => p.UploadedAt)
                .Select(p => new { p.Id, p.PodNumber, p.OriginalFileName, p.UploadedAt, p.DeliveryDate })
                .ToListAsync();

            var duplicates = existing
                .GroupBy(p => p.OriginalFileName, StringComparer.OrdinalIgnoreCase)
                .Select(g => new
                {
                    fileName = g.Key,
                    count = g.Count(),
                    mostRecent = g.First()
                })
                .ToList();

            return Ok(new { duplicates });
        }

        /// <summary>

        [HttpPost("scan-storage")]
        public async Task<IActionResult> ScanStorage()
        {
            if (!Directory.Exists(_storagePath))
                return BadRequest($"POD storage folder not found: {_storagePath}");

            var drivers = await _context.Drivers.ToListAsync();

            // Existing registered file names (fast dedup)
            var existingFiles = new HashSet<string>(
                await _context.PodDocuments.Select(p => p.FileName).ToListAsync(),
                StringComparer.OrdinalIgnoreCase);

            var files = Directory.GetFiles(_storagePath, "*.*", SearchOption.AllDirectories)
                .Where(f => new[] { ".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".xls" }
                    .Contains(Path.GetExtension(f).ToLowerInvariant()))
                .ToList();

            var imported = 0;
            var skipped = 0;
            var errors = new List<string>();

            foreach (var file in files)
            {
                try
                {
                    var fileName = Path.GetFileName(file);

                    if (existingFiles.Contains(fileName))
                    {
                        skipped++;
                        continue;
                    }

                    var (region, driverName, deliveryDate) = ParseNormalizedPodName(fileName);

                    // Fallbacks for non-standard names
                    if (!deliveryDate.HasValue)
                        deliveryDate = ParseDate(fileName, fileName);
                    if (string.IsNullOrEmpty(driverName))
                        driverName = ParseDriverName(fileName);
                    if (string.IsNullOrEmpty(region))
                        region = ParseRegion(fileName);

                    if (!deliveryDate.HasValue)
                    {
                        errors.Add($"Could not parse date from: {fileName}");
                        skipped++;
                        continue;
                    }

                    if (string.IsNullOrEmpty(driverName))
                        driverName = "Unknown";

                    var fileInfo = new FileInfo(file);

                    var matchedDriver = drivers.FirstOrDefault(d =>
                        d.FirstName.Equals(driverName, StringComparison.OrdinalIgnoreCase) ||
                        d.LastName?.Equals(driverName, StringComparison.OrdinalIgnoreCase) == true ||
                        $"{d.FirstName} {d.LastName}".Trim().Equals(driverName, StringComparison.OrdinalIgnoreCase));

                    var pod = new PodDocument
                    {
                        DriverId = matchedDriver?.Id,
                        DriverName = driverName,
                        DeliveryDate = deliveryDate.Value.Date,
                        Region = region,
                        FilePath = file,
                        FileName = fileName,
                        OriginalFileName = fileName,
                        ContentType = GetContentType(file),
                        FileSize = fileInfo.Length,
                        UploadedAt = DateTime.UtcNow
                    };

                    _context.PodDocuments.Add(pod);
                    existingFiles.Add(fileName);
                    imported++;

                    if (imported % 100 == 0)
                        await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    errors.Add($"Error processing {Path.GetFileName(file)}: {ex.Message}");
                    skipped++;
                }
            }

            await _context.SaveChangesAsync();
            await BackfillPodNumbersAsync();

            return Ok(new
            {
                message = "POD storage scan complete",
                folder = _storagePath,
                totalFiles = files.Count,
                imported,
                skipped,
                errors = errors.Take(50).ToList()
            });
        }

        /// <summary>
        /// Parse the normalized "{REGION}_{DRIVER}_{yyyyMMdd}.ext" POD filename.
        /// Region = first token, date = last token (8 digits yyyyMMdd), driver = the rest.
        /// </summary>
        private (string Region, string DriverName, DateTime? Date) ParseNormalizedPodName(string fileName)
        {
            var stem = Path.GetFileNameWithoutExtension(fileName);
            var tokens = stem.Split('_', StringSplitOptions.RemoveEmptyEntries);

            if (tokens.Length < 3)
                return (string.Empty, string.Empty, null);

            var region = tokens[0].ToUpperInvariant();

            // Find the yyyyMMdd (8-digit) token - it may not be last because some
            // files have a trailing dedup counter, e.g. KZN_Unknown_20260203_1.pdf
            int dateIdx = -1;
            DateTime? date = null;
            for (int i = tokens.Length - 1; i >= 1; i--)
            {
                if (tokens[i].Length == 8 &&
                    DateTime.TryParseExact(tokens[i], "yyyyMMdd",
                        System.Globalization.CultureInfo.InvariantCulture,
                        System.Globalization.DateTimeStyles.None, out var parsed))
                {
                    date = parsed;
                    dateIdx = i;
                    break;
                }
            }

            if (date == null || dateIdx < 2)
                return (region, string.Empty, null);

            // Everything between the first token and the date token is the driver name
            var driver = string.Join(" ", tokens[1..dateIdx]).Replace("-", " ").Trim();

            return (region, driver, date);
        }

        /// <summary>
        /// Bulk import POD files from a folder path on the server
        /// </summary>
        [HttpPost("bulk-import")]
        public async Task<IActionResult> BulkImport([FromBody] BulkImportRequest request)
        {
            if (string.IsNullOrEmpty(request.SourceFolder))
                return BadRequest("Source folder path is required");

            if (!Directory.Exists(request.SourceFolder))
                return BadRequest($"Source folder not found: {request.SourceFolder}");

            Directory.CreateDirectory(_storagePath);

            var imported = 0;
            var skipped = 0;
            var errors = new List<string>();

            // Get all driver names for matching
            var drivers = await _context.Drivers.ToListAsync();

            var files = Directory.GetFiles(request.SourceFolder, "*.*", SearchOption.AllDirectories)
                .Where(f => new[] { ".pdf", ".jpg", ".jpeg", ".png", ".xlsx", ".xls" }
                    .Contains(Path.GetExtension(f).ToLowerInvariant()))
                .ToList();

            foreach (var sourceFile in files)
            {
                try
                {
                    var fileInfo = new FileInfo(sourceFile);
                    var relativePath = Path.GetRelativePath(request.SourceFolder, sourceFile);
                    var originalName = Path.GetFileName(sourceFile);

                    // Parse region from folder path
                    var region = ParseRegion(relativePath);

                    // Parse date from folder or file name
                    var deliveryDate = ParseDate(relativePath, originalName);
                    if (!deliveryDate.HasValue)
                    {
                        errors.Add($"Could not parse date from: {relativePath}");
                        skipped++;
                        continue;
                    }

                    // Parse driver name from filename
                    var driverName = ParseDriverName(originalName);
                    if (string.IsNullOrEmpty(driverName))
                    {
                        driverName = "Unknown";
                    }

                    // Check for duplicate
                    var exists = await _context.PodDocuments.AnyAsync(p =>
                        p.DriverName == driverName &&
                        p.DeliveryDate == deliveryDate.Value.Date &&
                        p.Region == region);

                    if (exists)
                    {
                        skipped++;
                        continue;
                    }

                    // Copy file to storage
                    var extension = Path.GetExtension(sourceFile).ToLowerInvariant();
                    var safeName = string.Join("_", driverName.Split(Path.GetInvalidFileNameChars()));
                    var fileName = $"{region}_{safeName}_{deliveryDate.Value:yyyyMMdd}{extension}";
                    var destPath = Path.Combine(_storagePath, fileName);

                    // Handle duplicate filenames
                    var counter = 1;
                    while (System.IO.File.Exists(destPath))
                    {
                        fileName = $"{region}_{safeName}_{deliveryDate.Value:yyyyMMdd}_{counter}{extension}";
                        destPath = Path.Combine(_storagePath, fileName);
                        counter++;
                    }

                    System.IO.File.Copy(sourceFile, destPath, false);

                    // Match driver
                    var matchedDriver = drivers.FirstOrDefault(d =>
                        d.FirstName.Equals(driverName, StringComparison.OrdinalIgnoreCase) ||
                        d.LastName?.Equals(driverName, StringComparison.OrdinalIgnoreCase) == true);

                    var pod = new PodDocument
                    {
                        DriverId = matchedDriver?.Id,
                        DriverName = driverName,
                        DeliveryDate = deliveryDate.Value.Date,
                        Region = region,
                        FilePath = destPath,
                        FileName = fileName,
                        OriginalFileName = originalName,
                        ContentType = GetContentType(destPath),
                        FileSize = fileInfo.Length,
                        UploadedAt = DateTime.UtcNow
                    };

                    _context.PodDocuments.Add(pod);
                    imported++;

                    // Batch save every 50 records
                    if (imported % 50 == 0)
                    {
                        await _context.SaveChangesAsync();
                    }
                }
                catch (Exception ex)
                {
                    errors.Add($"Error processing {sourceFile}: {ex.Message}");
                    skipped++;
                }
            }

            await _context.SaveChangesAsync();
            await BackfillPodNumbersAsync();

            return Ok(new
            {
                message = $"Bulk import complete",
                totalFiles = files.Count,
                imported,
                skipped,
                errors = errors.Take(50).ToList() // Return first 50 errors
            });
        }

        /// <summary>
        /// Link a POD to a tripsheet (Load)
        /// </summary>
        [HttpPut("{id}/link")]
        public async Task<IActionResult> LinkToTripsheet(int id, [FromBody] LinkPodRequest request)
        {
            var pod = await _context.PodDocuments.FindAsync(id);
            if (pod == null)
                return NotFound("POD document not found");

            var load = await _context.Loads.FindAsync(request.LoadId);
            if (load == null)
                return NotFound("Tripsheet/Load not found");

            pod.LoadId = request.LoadId;

            // Auto-link to all non-cancelled invoices on the tripsheet
            var invoicesOnLoad = await _context.ImportedInvoices
                .Where(i => i.LoadId == request.LoadId && i.Status != "Cancelled")
                .ToListAsync();

            var existingInvoiceIds = await _context.PodDocumentInvoiceLinks
                .Where(l => l.PodDocumentId == pod.Id)
                .Select(l => l.InvoiceId)
                .ToListAsync();

            var newLinks = invoicesOnLoad
                .Where(i => !existingInvoiceIds.Contains(i.Id))
                .Select(i => new PodDocumentInvoiceLink
                {
                    PodDocumentId = pod.Id,
                    InvoiceId = i.Id,
                    LinkedAt = DateTime.UtcNow
                })
                .ToList();

            if (newLinks.Count > 0)
            {
                _context.PodDocumentInvoiceLinks.AddRange(newLinks);
            }

            foreach (var invoice in invoicesOnLoad)
            {
                invoice.Status = "Delivered";
                invoice.LastDeliveryDate = pod.DeliveryDate;
            }

            // Keep legacy single-link field populated for compatibility
            var primaryInvoice = invoicesOnLoad.FirstOrDefault();
            if (primaryInvoice != null)
            {
                pod.InvoiceId = primaryInvoice.Id;
            }

            await _context.SaveChangesAsync();

            var invoiceNumbers = invoicesOnLoad.Select(i => i.TransactionNumber).Distinct().OrderBy(x => x).ToList();
            return Ok(new
            {
                message = "POD linked to tripsheet" + (invoiceNumbers.Count > 0 ? $" and linked to {invoiceNumbers.Count} invoice(s)" : ""),
                pod.Id,
                pod.LoadId,
                pod.InvoiceId,
                loadNumber = load.LoadNumber,
                invoiceNumbers,
                linkedInvoiceCount = invoiceNumbers.Count
            });
        }

        /// <summary>
        /// Delink a POD from its tripsheet
        /// </summary>
        [HttpPut("{id}/delink")]
        public async Task<IActionResult> DelinkFromTripsheet(int id)
        {
            var pod = await _context.PodDocuments.FindAsync(id);
            if (pod == null)
                return NotFound("POD document not found");

            pod.LoadId = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "POD delinked from tripsheet", pod.Id });
        }

        /// <summary>
        /// Edit POD details (driver, date, region, notes)
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> EditDetails(int id, [FromBody] EditPodRequest request)
        {
            var pod = await _context.PodDocuments.FindAsync(id);
            if (pod == null)
                return NotFound("POD document not found");

            if (!string.IsNullOrEmpty(request.DriverName))
            {
                pod.DriverName = request.DriverName.Trim();
                // Re-match driver
                var driver = await _context.Drivers
                    .FirstOrDefaultAsync(d => d.FirstName.ToLower() == request.DriverName.ToLower().Trim());
                pod.DriverId = driver?.Id;
            }

            if (request.DeliveryDate.HasValue)
                pod.DeliveryDate = request.DeliveryDate.Value.Date;

            if (!string.IsNullOrEmpty(request.Region))
                pod.Region = request.Region.ToUpper().Trim();

            if (request.Notes != null)
                pod.Notes = request.Notes;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "POD details updated",
                pod.Id,
                pod.DriverId,
                pod.DriverName,
                pod.DeliveryDate,
                pod.Region,
                pod.Notes,
                pod.LoadId
            });
        }

        /// <summary>
        /// Retroactively link existing PODs to tripsheets by the invoices they share.
        /// For every POD with no tripsheet link, if any of its tagged invoices now
        /// sits on a tripsheet (Invoice.LoadId), the POD is linked to that tripsheet.
        /// Safe to run repeatedly. Use this to back-fill the historical backlog.
        /// </summary>
        [HttpPost("reconcile-tripsheets")]
        public async Task<IActionResult> ReconcileTripsheets()
        {
            var result = await PodTripsheetLinker.ReconcileAllAsync(_context);
            _logger.LogInformation(
                "POD→tripsheet reconciliation: examined {Examined}, linked {Linked}",
                result.PodsExamined, result.PodsLinked);

            return Ok(new
            {
                message = $"Linked {result.PodsLinked} POD(s) to tripsheets (examined {result.PodsExamined}).",
                podsExamined = result.PodsExamined,
                podsLinked = result.PodsLinked,
                links = result.Links
            });
        }

        /// <summary>
        /// Search loads for linking
        /// </summary>
        [HttpGet("search-loads")]
        public async Task<IActionResult> SearchLoads([FromQuery] string? search, [FromQuery] int limit = 20)
        {
            var query = _context.Loads.AsQueryable();

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(l => l.LoadNumber.Contains(search) ||
                    (l.Customer != null && l.Customer.Name != null && l.Customer.Name.Contains(search)));
            }

            var loads = await query
                .OrderByDescending(l => l.CreatedAt)
                .Take(limit)
                .Select(l => new
                {
                    l.Id,
                    l.LoadNumber,
                    CustomerName = l.Customer != null ? l.Customer.Name : null,
                    DriverName = l.Driver != null ? l.Driver.FirstName : null,
                    l.Status,
                    l.ScheduledDeliveryDate
                })
                .ToListAsync();

            return Ok(loads);
        }

        /// <summary>
        /// Link a POD to a single invoice (legacy endpoint).
        /// Adds the invoice to the POD's invoice link set.
        /// </summary>
        [HttpPut("{id}/link-invoice")]
        public async Task<IActionResult> LinkToInvoice(int id, [FromBody] LinkPodInvoiceRequest request)
        {
            return await LinkToInvoices(id, new LinkPodInvoicesRequest { InvoiceIds = new List<int> { request.InvoiceId } });
        }

        /// <summary>
        /// Link a POD to multiple invoices.
        /// </summary>
        [HttpPut("{id}/link-invoices")]
        public async Task<IActionResult> LinkToInvoices(int id, [FromBody] LinkPodInvoicesRequest request)
        {
            var pod = await _context.PodDocuments.FindAsync(id);
            if (pod == null)
                return NotFound("POD document not found");

            if (request.InvoiceIds == null || request.InvoiceIds.Count == 0)
                return BadRequest("At least one invoice is required");

            var invoiceIds = request.InvoiceIds.Distinct().ToList();
            var invoices = await _context.ImportedInvoices
                .Where(i => invoiceIds.Contains(i.Id))
                .ToListAsync();

            if (invoices.Count == 0)
                return NotFound("No valid invoices found");

            var existingInvoiceIds = await _context.PodDocumentInvoiceLinks
                .Where(l => l.PodDocumentId == pod.Id)
                .Select(l => l.InvoiceId)
                .ToListAsync();

            var newLinks = invoices
                .Where(i => !existingInvoiceIds.Contains(i.Id))
                .Select(i => new PodDocumentInvoiceLink
                {
                    PodDocumentId = pod.Id,
                    InvoiceId = i.Id,
                    LinkedAt = DateTime.UtcNow
                })
                .ToList();

            if (newLinks.Count > 0)
            {
                _context.PodDocumentInvoiceLinks.AddRange(newLinks);
            }

            foreach (var invoice in invoices)
            {
                invoice.Status = "Delivered";
                invoice.LastDeliveryDate = pod.DeliveryDate;
            }

            // Auto-link to tripsheet if POD has none and at least one invoice is assigned
            string? loadNumber = null;
            if (pod.LoadId == null)
            {
                var loadId = invoices.Select(i => i.LoadId).FirstOrDefault(x => x.HasValue);
                if (loadId.HasValue)
                {
                    pod.LoadId = loadId.Value;
                    var load = await _context.Loads.FindAsync(loadId.Value);
                    loadNumber = load?.LoadNumber;
                }
            }

            // Keep legacy field set for compatibility (first linked invoice)
            var primaryInvoiceId = (pod.InvoiceId.HasValue ? pod.InvoiceId : invoices.FirstOrDefault()?.Id);
            pod.InvoiceId = primaryInvoiceId;

            await _context.SaveChangesAsync();

            var linkedInvoiceNumbers = await _context.PodDocumentInvoiceLinks
                .Where(l => l.PodDocumentId == pod.Id)
                .Select(l => l.Invoice != null ? l.Invoice.TransactionNumber : null)
                .Where(n => n != null)
                .Distinct()
                .OrderBy(n => n)
                .ToListAsync();

            return Ok(new
            {
                message = $"POD linked to {invoices.Count} invoice(s)" + (loadNumber != null ? $" and auto-linked to tripsheet {loadNumber}" : ""),
                pod.Id,
                pod.LoadId,
                pod.InvoiceId,
                loadNumber,
                linkedInvoiceCount = linkedInvoiceNumbers.Count,
                invoiceNumbers = linkedInvoiceNumbers
            });
        }

        /// <summary>
        /// Delink a POD from all linked invoices.
        /// </summary>
        [HttpPut("{id}/delink-invoice")]
        public async Task<IActionResult> DelinkFromInvoice(int id)
        {
            var pod = await _context.PodDocuments.FirstOrDefaultAsync(p => p.Id == id);
            if (pod == null)
                return NotFound("POD document not found");

            var links = await _context.PodDocumentInvoiceLinks
                .Where(l => l.PodDocumentId == id)
                .ToListAsync();

            var invoiceIds = links.Select(l => l.InvoiceId).Distinct().ToList();
            if (links.Count > 0)
            {
                _context.PodDocumentInvoiceLinks.RemoveRange(links);
            }

            // Legacy single-link cleanup
            if (pod.InvoiceId.HasValue)
            {
                invoiceIds.Add(pod.InvoiceId.Value);
            }
            pod.InvoiceId = null;

            invoiceIds = invoiceIds.Distinct().ToList();
            if (invoiceIds.Count > 0)
            {
                var stillLinkedInvoiceIds = await _context.PodDocumentInvoiceLinks
                    .Where(l => invoiceIds.Contains(l.InvoiceId))
                    .Select(l => l.InvoiceId)
                    .Distinct()
                    .ToListAsync();

                var invoiceIdsToReset = invoiceIds.Except(stillLinkedInvoiceIds).ToList();
                if (invoiceIdsToReset.Count > 0)
                {
                    var invoicesToReset = await _context.ImportedInvoices
                        .Where(i => invoiceIdsToReset.Contains(i.Id))
                        .ToListAsync();

                    foreach (var invoice in invoicesToReset)
                    {
                        invoice.Status = "Pending";
                        invoice.LastDeliveryDate = null;
                    }
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "POD delinked from all invoices", pod.Id });
        }

        /// <summary>
        /// Search invoices for linking
        /// </summary>
        [HttpGet("search-invoices")]
        public async Task<IActionResult> SearchInvoices([FromQuery] string? search, [FromQuery] int limit = 20)
        {
            var query = _context.ImportedInvoices.AsQueryable();

            if (!string.IsNullOrEmpty(search))
            {
                query = query.Where(i => i.TransactionNumber.Contains(search) ||
                    i.CustomerName.Contains(search) ||
                    i.ProductDescription.Contains(search));
            }

            var invoices = await query
                .OrderByDescending(i => i.TransactionDate)
                .Take(limit)
                .Select(i => new
                {
                    i.Id,
                    i.TransactionNumber,
                    i.CustomerName,
                    i.ProductDescription,
                    i.Quantity,
                    i.SalesAmount,
                    i.Status,
                    i.TransactionDate
                })
                .ToListAsync();

            return Ok(invoices);
        }

        /// <summary>
        /// Welly OCR support: take a list of raw invoice-number candidates extracted from a POD
        /// image via OCR and return the invoices that actually exist in the system.
        /// Handles common OCR digit mis-reads (O↔0, I/l↔1, S↔5, B↔8, Z↔2) and validates each
        /// corrected candidate against ImportedInvoices.TransactionNumber (format: IN######).
        /// </summary>
        [HttpPost("match-invoice-numbers")]
        public async Task<IActionResult> MatchInvoiceNumbers([FromBody] MatchInvoiceNumbersRequest request)
        {
            if (request?.Candidates == null || request.Candidates.Count == 0)
                return Ok(new { matches = new List<object>(), unmatched = new List<string>() });

            // Build the set of normalized candidate keys → keep the original OCR text for display.
            var candidateMap = new Dictionary<string, HashSet<string>>(StringComparer.OrdinalIgnoreCase);
            foreach (var raw in request.Candidates)
            {
                if (string.IsNullOrWhiteSpace(raw)) continue;
                foreach (var normalized in NormalizeInvoiceCandidate(raw))
                {
                    if (!candidateMap.TryGetValue(normalized, out var originals))
                    {
                        originals = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                        candidateMap[normalized] = originals;
                    }
                    originals.Add(raw.Trim());
                }
            }

            if (candidateMap.Count == 0)
                return Ok(new { matches = new List<object>(), unmatched = request.Candidates });

            var keys = candidateMap.Keys.ToList();

            var found = await _context.ImportedInvoices
                .Where(i => keys.Contains(i.TransactionNumber))
                .Select(i => new
                {
                    i.Id,
                    i.TransactionNumber,
                    i.CustomerName,
                    i.ProductDescription,
                    i.Quantity,
                    i.SalesAmount,
                    i.Status,
                    i.TransactionDate
                })
                .ToListAsync();

            var foundIds = found.Select(f => f.Id).ToList();
            var linkedInvoiceIds = new HashSet<int>(await _context.PodDocumentInvoiceLinks
                .Where(l => l.InvoiceId != null && foundIds.Contains(l.InvoiceId.Value))
                .Select(l => l.InvoiceId!.Value)
                .ToListAsync());

            var matchedKeys = new HashSet<string>(found.Select(f => f.TransactionNumber), StringComparer.OrdinalIgnoreCase);

            var matches = found.Select(f => new
            {
                f.Id,
                f.TransactionNumber,
                f.CustomerName,
                f.ProductDescription,
                f.Quantity,
                f.SalesAmount,
                f.Status,
                f.TransactionDate,
                AlreadyLinked = linkedInvoiceIds.Contains(f.Id),
                // Was the DB value read verbatim from the image, or did we auto-correct OCR errors?
                ReadExactly = candidateMap.TryGetValue(f.TransactionNumber, out var origs) &&
                              origs.Any(o => string.Equals(o.Replace(" ", "").Replace("-", ""),
                                                           f.TransactionNumber, StringComparison.OrdinalIgnoreCase)),
                OcrText = candidateMap.TryGetValue(f.TransactionNumber, out var o2) ? o2.First() : f.TransactionNumber
            }).ToList();

            var unmatched = candidateMap
                .Where(kv => !matchedKeys.Contains(kv.Key))
                .SelectMany(kv => kv.Value)
                .Distinct()
                .ToList();

            return Ok(new { matches, unmatched });
        }

        /// <summary>
        /// Produces one or more candidate invoice numbers (format IN######) from a raw OCR token,
        /// applying common OCR character-confusion corrections.
        /// </summary>
        private static IEnumerable<string> NormalizeInvoiceCandidate(string raw)
        {
            var results = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // Strip spaces/dashes and uppercase.
            var cleaned = raw.Trim().ToUpperInvariant().Replace(" ", "").Replace("-", "");
            if (cleaned.Length < 3) return results;

            // Ensure it starts with the IN prefix — OCR may read I/1/l and N/M loosely.
            if (!cleaned.StartsWith("IN"))
            {
                // Try to salvage a prefix like "1N", "Iated"→no; only accept if 2nd char is N-ish.
                if (cleaned.Length >= 2 && (cleaned[0] == 'I' || cleaned[0] == '1' || cleaned[0] == 'L') &&
                    (cleaned[1] == 'N' || cleaned[1] == 'M' || cleaned[1] == 'H'))
                {
                    cleaned = "IN" + cleaned.Substring(2);
                }
                else
                {
                    return results;
                }
            }

            var digitsPart = cleaned.Substring(2);

            // Map letters that OCR commonly confuses with digits.
            var mapped = new string(digitsPart.Select(c => c switch
            {
                'O' or 'Q' or 'D' => '0',
                'I' or 'L' => '1',
                'Z' => '2',
                'S' => '5',
                'B' => '8',
                'G' => '6',
                'T' => '7',
                _ => c
            }).ToArray());

            // Keep only if the mapped body is all digits and 6 long (your invoice format).
            var digitsOnly = new string(mapped.Where(char.IsDigit).ToArray());
            if (digitsOnly.Length == 6)
            {
                results.Add("IN" + digitsOnly);
            }
            else if (digitsOnly.Length > 6)
            {
                // OCR sometimes glues extra chars — try the first 6 digits.
                results.Add("IN" + digitsOnly.Substring(0, 6));
            }

            return results;
        }

        /// <summary>
        /// Delete a POD document
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var pod = await _context.PodDocuments.FindAsync(id);
            if (pod == null)
                return NotFound();

            // Delete file if exists
            if (System.IO.File.Exists(pod.FilePath))
            {
                try { System.IO.File.Delete(pod.FilePath); }
                catch (Exception ex) { _logger.LogWarning(ex, "Could not delete POD file: {Path}", pod.FilePath); }
            }

            _context.PodDocuments.Remove(pod);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ─── Helper Methods ────────────────────────────────────────────────

        private string ParseRegion(string relativePath)
        {
            var upper = relativePath.ToUpper();
            if (upper.Contains("KZN"))
                return "KZN";
            if (upper.Contains("GP"))
                return "GP";
            return "OTHER";
        }

        private DateTime? ParseDate(string relativePath, string fileName)
        {
            // Try parsing from subfolder name like "PODS-02.03.26" or "PODS -05.01.26"
            var parts = relativePath.Replace("\\", "/").Split('/');
            foreach (var part in parts)
            {
                var match = System.Text.RegularExpressions.Regex.Match(
                    part, @"PODS?\s*-?\s*(\d{1,2})[.\-](\d{1,2})[.\-](\d{2,4})");
                if (match.Success)
                {
                    return ParseDateParts(match.Groups[1].Value, match.Groups[2].Value, match.Groups[3].Value);
                }
            }

            // Try parsing from filename like "BONGINKOSI PODS 02.03.26.pdf" or "Buhle 12-01-26.pdf"
            var fileMatch = System.Text.RegularExpressions.Regex.Match(
                fileName, @"(\d{1,2})[.\-](\d{1,2})[.\-](\d{2,4})");
            if (fileMatch.Success)
            {
                return ParseDateParts(fileMatch.Groups[1].Value, fileMatch.Groups[2].Value, fileMatch.Groups[3].Value);
            }

            return null;
        }

        private DateTime? ParseDateParts(string p1, string p2, string p3)
        {
            if (!int.TryParse(p1, out var n1) || !int.TryParse(p2, out var n2) || !int.TryParse(p3, out var n3))
                return null;

            // Handle 2-digit year
            if (n3 < 100) n3 += 2000;

            // Format is DD.MM.YY
            int day = n1, month = n2, year = n3;

            // Validate and try swapping if needed
            if (month > 12 && day <= 12)
            {
                (day, month) = (month, day);
            }

            if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2020 || year > 2030)
                return null;

            try
            {
                return new DateTime(year, month, day);
            }
            catch
            {
                return null;
            }
        }

        private string ParseDriverName(string fileName)
        {
            // Remove extension
            var name = Path.GetFileNameWithoutExtension(fileName);

            // Remove common prefixes/suffixes
            name = System.Text.RegularExpressions.Regex.Replace(name, @"\s*PODS?\s*", " ", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            name = System.Text.RegularExpressions.Regex.Replace(name, @"KZN\s*", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);

            // Remove date patterns (DD.MM.YY, DD-MM-YY, DD.MM.YYYY)
            name = System.Text.RegularExpressions.Regex.Replace(name, @"\d{1,2}[.\-]\d{1,2}[.\-]\d{2,4}", "");

            // Remove parenthetical numbers like (2)
            name = System.Text.RegularExpressions.Regex.Replace(name, @"\(\d+\)", "");

            // Remove trailing -1, -2 etc
            name = System.Text.RegularExpressions.Regex.Replace(name, @"-\d+$", "");

            // Clean up whitespace
            name = System.Text.RegularExpressions.Regex.Replace(name, @"\s+", " ").Trim();

            // Remove trailing/leading special chars
            name = name.Trim('-', '_', ' ');

            return string.IsNullOrEmpty(name) ? "Unknown" : name;
        }

        /// <summary>
        /// Assign a human-readable, barcode-friendly POD number if one is not set.
        /// Uses the auto-increment Id (guaranteed unique) e.g. "POD000123".
        /// Call AFTER the entity has been saved so pod.Id is populated.
        /// </summary>
        private async Task AssignPodNumberAsync(PodDocument pod)
        {
            if (!string.IsNullOrWhiteSpace(pod.PodNumber)) return;
            pod.PodNumber = $"POD{pod.Id:D6}";
            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Assign POD numbers to any documents that don't yet have one (used after
        /// batch imports and to backfill legacy rows).
        /// </summary>
        private async Task BackfillPodNumbersAsync()
        {
            var missing = await _context.PodDocuments
                .Where(p => p.PodNumber == null || p.PodNumber == "")
                .ToListAsync();
            if (missing.Count == 0) return;
            foreach (var pod in missing)
                pod.PodNumber = $"POD{pod.Id:D6}";
            await _context.SaveChangesAsync();
        }

        private string GetContentType(string filePath)
        {
            var extension = Path.GetExtension(filePath).ToLowerInvariant();
            return extension switch
            {
                ".pdf" => "application/pdf",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".xls" => "application/vnd.ms-excel",
                ".zip" => "application/zip",
                _ => "application/octet-stream"
            };
        }
    }

    public class BulkImportRequest
    {
        public string SourceFolder { get; set; } = string.Empty;
    }

    public class LinkPodRequest
    {
        public int LoadId { get; set; }
    }

    public class EditPodRequest
    {
        public string? DriverName { get; set; }
        public DateTime? DeliveryDate { get; set; }
        public string? Region { get; set; }
        public string? Notes { get; set; }
    }

    public class LinkPodInvoiceRequest
    {
        public int InvoiceId { get; set; }
    }

    public class LinkPodInvoicesRequest
    {
        public List<int> InvoiceIds { get; set; } = new();
    }

    public class MatchInvoiceNumbersRequest
    {
        /// <summary>Raw invoice-number tokens extracted from a POD image via OCR.</summary>
        public List<string> Candidates { get; set; } = new();
    }

    public class CheckDuplicatesRequest
    {
        /// <summary>Original file names the user is about to upload.</summary>
        public List<string> FileNames { get; set; } = new();
    }
}
