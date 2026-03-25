using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

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
            var query = _context.PodDocuments.AsQueryable();

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
                    query = query.Where(p => p.LoadId != null || p.InvoiceId != null);
                else if (linkStatus == "not-linked")
                    query = query.Where(p => p.LoadId == null && p.InvoiceId == null);
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
                    InvoiceNumber = p.Invoice != null ? p.Invoice.TransactionNumber : null
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
            
            var linked = await _context.PodDocuments.CountAsync(p => p.LoadId != null || p.InvoiceId != null);
            var unlinked = total - linked;
            var linkedToTripsheet = await _context.PodDocuments.CountAsync(p => p.LoadId != null);
            var linkedToInvoice = await _context.PodDocuments.CountAsync(p => p.InvoiceId != null);

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

                return Ok(new
                {
                    message = "POD uploaded successfully",
                    pod.Id,
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
            await _context.SaveChangesAsync();

            return Ok(new { message = "POD linked to tripsheet", pod.Id, pod.LoadId, loadNumber = load.LoadNumber });
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
        /// Link a POD to an invoice
        /// </summary>
        [HttpPut("{id}/link-invoice")]
        public async Task<IActionResult> LinkToInvoice(int id, [FromBody] LinkPodInvoiceRequest request)
        {
            var pod = await _context.PodDocuments.FindAsync(id);
            if (pod == null)
                return NotFound("POD document not found");

            var invoice = await _context.ImportedInvoices.FindAsync(request.InvoiceId);
            if (invoice == null)
                return NotFound("Invoice not found");

            pod.InvoiceId = request.InvoiceId;

            // Update invoice status to Delivered
            invoice.Status = "Delivered";
            invoice.LastDeliveryDate = pod.DeliveryDate;

            await _context.SaveChangesAsync();

            return Ok(new { message = "POD linked to invoice", pod.Id, pod.InvoiceId, invoiceNumber = invoice.TransactionNumber });
        }

        /// <summary>
        /// Delink a POD from its invoice
        /// </summary>
        [HttpPut("{id}/delink-invoice")]
        public async Task<IActionResult> DelinkFromInvoice(int id)
        {
            var pod = await _context.PodDocuments.Include(p => p.Invoice).FirstOrDefaultAsync(p => p.Id == id);
            if (pod == null)
                return NotFound("POD document not found");

            // Revert invoice status to Pending
            if (pod.Invoice != null)
            {
                pod.Invoice.Status = "Pending";
                pod.Invoice.LastDeliveryDate = null;
            }

            pod.InvoiceId = null;
            await _context.SaveChangesAsync();

            return Ok(new { message = "POD delinked from invoice", pod.Id });
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
}
