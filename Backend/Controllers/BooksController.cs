using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Services;
using System.Security.Claims;
using System.Text;
using System.Text.RegularExpressions;
using System.Globalization;
using System.Security.Cryptography;
using iText.Kernel.Pdf;
using iText.Kernel.Pdf.Canvas.Parser;
using iText.Kernel.Pdf.Canvas.Parser.Listener;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class BooksController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<BooksController> _logger;
        private readonly IEmailService _emailService;
        private readonly string _storagePath;

        public BooksController(ApplicationDbContext context, ILogger<BooksController> logger, IConfiguration configuration, IEmailService emailService)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
            var basePath = configuration["DocumentsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            _storagePath = Path.Combine(basePath, "Books");
            Directory.CreateDirectory(_storagePath);
        }

        // ============================================================================
        // GET: api/Books - List all book invoices with filters
        // ============================================================================
        [HttpGet]
        public async Task<IActionResult> GetAll(
            [FromQuery] int departmentId,
            [FromQuery] string? search,
            [FromQuery] string? supplier,
            [FromQuery] string? category,
            [FromQuery] string? company,
            [FromQuery] string? status,
            [FromQuery] string? fromDate,
            [FromQuery] string? toDate,
            [FromQuery] string? month,
            [FromQuery] string? year,
            [FromQuery] string? sortBy,
            [FromQuery] string? sortDir,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            try
            {
                var query = _context.BookInvoices.Where(b => b.DepartmentId == departmentId);

                // Search across supplier, invoice number, description, notes
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.ToLower();
                    query = query.Where(b =>
                        b.SupplierName.ToLower().Contains(s) ||
                        (b.InvoiceNumber != null && b.InvoiceNumber.ToLower().Contains(s)) ||
                        (b.Description != null && b.Description.ToLower().Contains(s)) ||
                        (b.Notes != null && b.Notes.ToLower().Contains(s)) ||
                        (b.PaymentReference != null && b.PaymentReference.ToLower().Contains(s)));
                }

                if (!string.IsNullOrWhiteSpace(supplier))
                    query = query.Where(b => b.SupplierName.ToLower().Contains(supplier.ToLower()));

                if (!string.IsNullOrWhiteSpace(category))
                    query = query.Where(b => b.Category == category);

                if (!string.IsNullOrWhiteSpace(company))
                    query = query.Where(b => b.CompanyName == company);

                if (!string.IsNullOrWhiteSpace(status))
                    query = query.Where(b => b.Status == status);

                if (!string.IsNullOrWhiteSpace(fromDate) && DateTime.TryParse(fromDate, out var fd))
                    query = query.Where(b => b.InvoiceDate >= fd);

                if (!string.IsNullOrWhiteSpace(toDate) && DateTime.TryParse(toDate, out var td))
                    query = query.Where(b => b.InvoiceDate <= td.AddDays(1));

                if (!string.IsNullOrWhiteSpace(month) && !string.IsNullOrWhiteSpace(year))
                {
                    if (int.TryParse(month, out var m) && int.TryParse(year, out var y))
                        query = query.Where(b => b.InvoiceDate.Month == m && b.InvoiceDate.Year == y);
                }
                else if (!string.IsNullOrWhiteSpace(year) && int.TryParse(year, out var yr))
                {
                    query = query.Where(b => b.InvoiceDate.Year == yr);
                }

                var totalCount = await query.CountAsync();

                // Sorting
                query = (sortBy?.ToLower()) switch
                {
                    "supplier" => sortDir == "asc" ? query.OrderBy(b => b.SupplierName) : query.OrderByDescending(b => b.SupplierName),
                    "total" => sortDir == "asc" ? query.OrderBy(b => b.Total) : query.OrderByDescending(b => b.Total),
                    "invoicedate" => sortDir == "asc" ? query.OrderBy(b => b.InvoiceDate) : query.OrderByDescending(b => b.InvoiceDate),
                    "paymentdate" => sortDir == "asc" ? query.OrderBy(b => b.PaymentDate) : query.OrderByDescending(b => b.PaymentDate),
                    "createdat" => sortDir == "asc" ? query.OrderBy(b => b.CreatedAt) : query.OrderByDescending(b => b.CreatedAt),
                    _ => query.OrderByDescending(b => b.CreatedAt)
                };

                var items = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(b => new
                    {
                        b.Id,
                        b.SupplierName,
                        b.SupplierAccount,
                        b.InvoiceNumber,
                        b.InvoiceDate,
                        b.Total,
                        b.VatAmount,
                        b.SubTotal,
                        b.Currency,
                        b.PaymentDate,
                        b.PaymentMethod,
                        b.PaymentReference,
                        b.Category,
                        b.Description,
                        b.Notes,
                        b.FileName,
                        b.OriginalFileName,
                        b.ContentType,
                        b.FileSize,
                        b.Status,
                        b.UploadedByName,
                        b.CreatedAt,
                        b.ConfirmedAt,
                        b.UpdatedAt
                    })
                    .ToListAsync();

                return Ok(new { items, totalCount, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching book invoices");
                return StatusCode(500, new { error = "Failed to fetch invoices" });
            }
        }

        // ============================================================================
        // GET: api/Books/summary - Dashboard summary stats
        // ============================================================================
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary([FromQuery] int departmentId, [FromQuery] string? year)
        {
            try
            {
                var query = _context.BookInvoices.Where(b => b.DepartmentId == departmentId);

                if (!string.IsNullOrWhiteSpace(year) && int.TryParse(year, out var y))
                    query = query.Where(b => b.InvoiceDate.Year == y);

                var all = await query.ToListAsync();

                var summary = new
                {
                    totalInvoices = all.Count,
                    totalAmount = all.Sum(b => b.Total),
                    totalVat = all.Where(b => b.VatAmount.HasValue).Sum(b => b.VatAmount ?? 0),
                    draftCount = all.Count(b => b.Status == "Draft"),
                    confirmedCount = all.Count(b => b.Status == "Confirmed"),
                    paymentRequestedCount = all.Count(b => b.Status == "Payment Requested"),
                    archivedCount = all.Count(b => b.Status == "Archived"),
                    byCategory = all
                        .Where(b => !string.IsNullOrEmpty(b.Category))
                        .GroupBy(b => b.Category)
                        .Select(g => new { category = g.Key, count = g.Count(), total = g.Sum(x => x.Total) })
                        .OrderByDescending(g => g.total)
                        .ToList(),
                    bySupplier = all
                        .GroupBy(b => b.SupplierName)
                        .Select(g => new { supplier = g.Key, count = g.Count(), total = g.Sum(x => x.Total) })
                        .OrderByDescending(g => g.total)
                        .Take(10)
                        .ToList(),
                    byMonth = all
                        .GroupBy(b => new { b.InvoiceDate.Year, b.InvoiceDate.Month })
                        .Select(g => new
                        {
                            year = g.Key.Year,
                            month = g.Key.Month,
                            monthName = CultureInfo.CurrentCulture.DateTimeFormat.GetAbbreviatedMonthName(g.Key.Month),
                            count = g.Count(),
                            total = g.Sum(x => x.Total)
                        })
                        .OrderBy(g => g.year).ThenBy(g => g.month)
                        .ToList(),
                    suppliers = all.Select(b => b.SupplierName).Distinct().OrderBy(s => s).ToList(),
                    categories = all.Where(b => !string.IsNullOrEmpty(b.Category)).Select(b => b.Category!).Distinct().OrderBy(c => c).ToList(),
                    years = all.Select(b => b.InvoiceDate.Year).Distinct().OrderByDescending(y2 => y2).ToList()
                };

                return Ok(summary);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching books summary");
                return StatusCode(500, new { error = "Failed to fetch summary" });
            }
        }

        // ============================================================================
        // GET: api/Books/{id} - Get single invoice details
        // ============================================================================
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var invoice = await _context.BookInvoices
                    .Where(b => b.Id == id)
                    .Select(b => new
                    {
                        b.Id,
                        b.SupplierName,
                        b.SupplierAccount,
                        b.InvoiceNumber,
                        b.InvoiceDate,
                        b.Total,
                        b.VatAmount,
                        b.SubTotal,
                        b.Currency,
                        b.PaymentDate,
                        b.PaymentMethod,
                        b.PaymentReference,
                        b.Category,
                        b.Description,
                        b.Notes,
                        b.FileName,
                        b.OriginalFileName,
                        b.ContentType,
                        b.FileSize,
                        b.ExtractedText,
                        b.Status,
                        b.UploadedByUserId,
                        b.UploadedByName,
                        b.ConfirmedByUserId,
                        b.CreatedAt,
                        b.ConfirmedAt,
                        b.UpdatedAt
                    })
                    .FirstOrDefaultAsync();

                if (invoice == null)
                    return NotFound(new { error = "Invoice not found" });

                return Ok(invoice);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching book invoice {Id}", id);
                return StatusCode(500, new { error = "Failed to fetch invoice" });
            }
        }

        // ============================================================================
        // POST: api/Books/upload - Upload PDF and extract text
        // ============================================================================
        [HttpPost("upload")]
        public async Task<IActionResult> Upload(IFormFile file, [FromQuery] int departmentId)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest(new { error = "No file provided" });

                if (file.ContentType != "application/pdf" && !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                    return BadRequest(new { error = "Only PDF files are accepted" });

                // Save the file
                var fileName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(_storagePath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Compute file hash for duplicate detection
                string fileHash;
                using (var sha256 = SHA256.Create())
                using (var hashStream = new FileStream(filePath, FileMode.Open, FileAccess.Read))
                {
                    var hashBytes = await sha256.ComputeHashAsync(hashStream);
                    fileHash = Convert.ToHexString(hashBytes);
                }

                // Check for duplicate by file hash (exact same file content)
                var duplicateByHash = await _context.BookInvoices
                    .Where(b => b.FileHash == fileHash && b.DepartmentId == departmentId)
                    .Select(b => new { b.Id, b.SupplierName, b.InvoiceNumber, b.OriginalFileName, b.CreatedAt })
                    .FirstOrDefaultAsync();

                if (duplicateByHash != null)
                {
                    // Delete the uploaded file since it's a duplicate
                    System.IO.File.Delete(filePath);
                    var dupDate = duplicateByHash.CreatedAt.ToString("dd MMM yyyy");
                    return Conflict(new { error = $"Duplicate invoice detected! This exact file was already uploaded on {dupDate} as '{duplicateByHash.OriginalFileName}' for supplier '{duplicateByHash.SupplierName}'.", duplicateId = duplicateByHash.Id });
                }

                // Check for duplicate by original filename + file size in same department
                var duplicateByName = await _context.BookInvoices
                    .Where(b => b.OriginalFileName == file.FileName && b.FileSize == file.Length && b.DepartmentId == departmentId)
                    .Select(b => new { b.Id, b.SupplierName, b.InvoiceNumber, b.CreatedAt })
                    .FirstOrDefaultAsync();

                if (duplicateByName != null)
                {
                    System.IO.File.Delete(filePath);
                    var dupDate = duplicateByName.CreatedAt.ToString("dd MMM yyyy");
                    return Conflict(new { error = $"This file '{file.FileName}' appears to be a duplicate — an invoice with the same filename and size was uploaded on {dupDate} for supplier '{duplicateByName.SupplierName}'.", duplicateId = duplicateByName.Id });
                }

                // Extract text from PDF
                var extractedText = ExtractTextFromPdf(filePath);

                // Parse supplier name, invoice number, date, total from extracted text
                var parsed = ParseInvoiceData(extractedText);

                // Get current user info
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("UserId")?.Value;
                var userId = int.TryParse(userIdClaim, out var uid) ? uid : 0;
                var userName = User.FindFirst(ClaimTypes.Name)?.Value
                    ?? User.FindFirst("Name")?.Value ?? "Unknown";

                // Create draft record
                var invoice = new BookInvoice
                {
                    DepartmentId = departmentId,
                    SupplierName = parsed.SupplierName,
                    InvoiceNumber = parsed.InvoiceNumber,
                    InvoiceDate = parsed.InvoiceDate ?? DateTime.UtcNow,
                    Total = parsed.Total,
                    VatAmount = parsed.VatAmount,
                    SubTotal = parsed.SubTotal,
                    FilePath = filePath,
                    FileName = fileName,
                    OriginalFileName = file.FileName,
                    ContentType = file.ContentType ?? "application/pdf",
                    FileSize = file.Length,
                    FileHash = fileHash,
                    ExtractedText = extractedText,
                    Status = "Draft",
                    UploadedByUserId = userId,
                    UploadedByName = userName,
                    CreatedAt = DateTime.UtcNow
                };

                _context.BookInvoices.Add(invoice);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Book invoice uploaded: {Id} by {User}", invoice.Id, userName);

                return Ok(new
                {
                    invoice.Id,
                    invoice.SupplierName,
                    invoice.InvoiceNumber,
                    invoice.InvoiceDate,
                    invoice.Total,
                    invoice.VatAmount,
                    invoice.SubTotal,
                    invoice.OriginalFileName,
                    invoice.FileSize,
                    extractedText = extractedText?.Length > 2000 ? extractedText[..2000] + "..." : extractedText,
                    invoice.Status,
                    message = "PDF uploaded and text extracted. Please review and confirm the details."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading book invoice");
                return StatusCode(500, new { error = "Failed to upload invoice" });
            }
        }

        // ============================================================================
        // PUT: api/Books/{id}/confirm - Confirm/save the extracted data
        // ============================================================================
        [HttpPut("{id}/confirm")]
        public async Task<IActionResult> Confirm(int id, [FromBody] ConfirmBookInvoiceRequest request)
        {
            try
            {
                var invoice = await _context.BookInvoices.FindAsync(id);
                if (invoice == null)
                    return NotFound(new { error = "Invoice not found" });

                // Update with user-confirmed data
                invoice.SupplierName = request.SupplierName ?? invoice.SupplierName;
                invoice.SupplierAccount = request.SupplierAccount;
                invoice.InvoiceNumber = request.InvoiceNumber;
                invoice.InvoiceDate = request.InvoiceDate ?? invoice.InvoiceDate;
                invoice.Total = request.Total ?? invoice.Total;
                invoice.VatAmount = request.VatAmount;
                invoice.SubTotal = request.SubTotal;
                invoice.Currency = request.Currency ?? invoice.Currency;
                invoice.PaymentDate = request.PaymentDate;
                invoice.PaymentMethod = request.PaymentMethod;
                invoice.PaymentReference = request.PaymentReference;
                invoice.Category = request.Category;
                invoice.CompanyName = request.CompanyName;
                invoice.Description = request.Description;
                invoice.Notes = request.Notes;
                invoice.Status = "Confirmed";
                invoice.ConfirmedAt = DateTime.UtcNow;
                invoice.UpdatedAt = DateTime.UtcNow;

                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("UserId")?.Value;
                if (int.TryParse(userIdClaim, out var uid))
                    invoice.ConfirmedByUserId = uid;

                await _context.SaveChangesAsync();

                // Copy the PDF to Finance/Books/{DepartmentName}/ for document browsing
                CopyInvoiceToFinanceDocs(invoice);

                _logger.LogInformation("Book invoice {Id} confirmed", id);
                return Ok(new { message = "Invoice confirmed successfully", invoice.Id, invoice.Status });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error confirming book invoice {Id}", id);
                return StatusCode(500, new { error = "Failed to confirm invoice" });
            }
        }

        // ============================================================================
        // PUT: api/Books/{id} - Update invoice details
        // ============================================================================
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ConfirmBookInvoiceRequest request)
        {
            try
            {
                var invoice = await _context.BookInvoices.FindAsync(id);
                if (invoice == null)
                    return NotFound(new { error = "Invoice not found" });

                if (!string.IsNullOrWhiteSpace(request.SupplierName))
                    invoice.SupplierName = request.SupplierName;
                invoice.SupplierAccount = request.SupplierAccount ?? invoice.SupplierAccount;
                invoice.InvoiceNumber = request.InvoiceNumber ?? invoice.InvoiceNumber;
                if (request.InvoiceDate.HasValue)
                    invoice.InvoiceDate = request.InvoiceDate.Value;
                if (request.Total.HasValue)
                    invoice.Total = request.Total.Value;
                invoice.VatAmount = request.VatAmount ?? invoice.VatAmount;
                invoice.SubTotal = request.SubTotal ?? invoice.SubTotal;
                invoice.Currency = request.Currency ?? invoice.Currency;
                invoice.PaymentDate = request.PaymentDate ?? invoice.PaymentDate;
                invoice.PaymentMethod = request.PaymentMethod ?? invoice.PaymentMethod;
                invoice.PaymentReference = request.PaymentReference ?? invoice.PaymentReference;
                invoice.Category = request.Category ?? invoice.Category;
                invoice.CompanyName = request.CompanyName ?? invoice.CompanyName;
                invoice.Description = request.Description ?? invoice.Description;
                invoice.Notes = request.Notes ?? invoice.Notes;
                invoice.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                return Ok(new { message = "Invoice updated successfully", invoice.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating book invoice {Id}", id);
                return StatusCode(500, new { error = "Failed to update invoice" });
            }
        }

        // ============================================================================
        // PUT: api/Books/{id}/request-payment - Request payment for an invoice
        // ============================================================================
        [HttpPut("{id}/request-payment")]
        public async Task<IActionResult> RequestPayment(int id, [FromBody] ConfirmBookInvoiceRequest request)
        {
            try
            {
                var invoice = await _context.BookInvoices.FindAsync(id);
                if (invoice == null)
                    return NotFound(new { error = "Invoice not found" });

                // Update with user-provided data
                invoice.SupplierName = request.SupplierName ?? invoice.SupplierName;
                invoice.SupplierAccount = request.SupplierAccount;
                invoice.InvoiceNumber = request.InvoiceNumber;
                invoice.InvoiceDate = request.InvoiceDate ?? invoice.InvoiceDate;
                invoice.Total = request.Total ?? invoice.Total;
                invoice.VatAmount = request.VatAmount;
                invoice.SubTotal = request.SubTotal;
                invoice.Currency = request.Currency ?? invoice.Currency;
                invoice.PaymentDate = request.PaymentDate;
                invoice.PaymentMethod = request.PaymentMethod;
                invoice.PaymentReference = request.PaymentReference;
                invoice.Category = request.Category;
                invoice.CompanyName = request.CompanyName;
                invoice.Description = request.Description;
                invoice.Notes = request.Notes;
                invoice.Status = "Payment Requested";
                invoice.UpdatedAt = DateTime.UtcNow;

                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("UserId")?.Value;
                if (int.TryParse(userIdClaim, out var uid))
                    invoice.ConfirmedByUserId = uid;

                await _context.SaveChangesAsync();

                // Also copy to Finance docs for visibility
                CopyInvoiceToFinanceDocs(invoice);

                _logger.LogInformation("Book invoice {Id} payment requested", id);
                return Ok(new { message = "Payment request submitted successfully", invoice.Id, invoice.Status });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error requesting payment for book invoice {Id}", id);
                return StatusCode(500, new { error = "Failed to request payment" });
            }
        }

        // ============================================================================
        // PUT: api/Books/{id}/archive - Archive an invoice
        // ============================================================================
        [HttpPut("{id}/archive")]
        public async Task<IActionResult> Archive(int id)
        {
            try
            {
                var invoice = await _context.BookInvoices.FindAsync(id);
                if (invoice == null)
                    return NotFound(new { error = "Invoice not found" });

                invoice.Status = "Archived";
                invoice.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { message = "Invoice archived", invoice.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error archiving book invoice {Id}", id);
                return StatusCode(500, new { error = "Failed to archive invoice" });
            }
        }

        // ============================================================================
        // PUT: api/Books/{id}/restore - Restore an archived invoice
        // ============================================================================
        [HttpPut("{id}/restore")]
        public async Task<IActionResult> Restore(int id)
        {
            try
            {
                var invoice = await _context.BookInvoices.FindAsync(id);
                if (invoice == null)
                    return NotFound(new { error = "Invoice not found" });

                invoice.Status = "Confirmed";
                invoice.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { message = "Invoice restored", invoice.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring book invoice {Id}", id);
                return StatusCode(500, new { error = "Failed to restore invoice" });
            }
        }

        // ============================================================================
        // GET: api/Books/{id}/view - View PDF inline
        // ============================================================================
        [HttpGet("{id}/view")]
        public async Task<IActionResult> ViewPdf(int id)
        {
            try
            {
                var invoice = await _context.BookInvoices.FindAsync(id);
                if (invoice == null)
                    return NotFound(new { error = "Invoice not found" });

                if (!System.IO.File.Exists(invoice.FilePath))
                    return NotFound(new { error = "File not found on disk" });

                var bytes = await System.IO.File.ReadAllBytesAsync(invoice.FilePath);
                return File(bytes, invoice.ContentType, enableRangeProcessing: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error viewing book invoice PDF {Id}", id);
                return StatusCode(500, new { error = "Failed to view PDF" });
            }
        }

        // ============================================================================
        // GET: api/Books/{id}/download - Download PDF
        // ============================================================================
        [HttpGet("{id}/download")]
        public async Task<IActionResult> DownloadPdf(int id)
        {
            try
            {
                var invoice = await _context.BookInvoices.FindAsync(id);
                if (invoice == null)
                    return NotFound(new { error = "Invoice not found" });

                if (!System.IO.File.Exists(invoice.FilePath))
                    return NotFound(new { error = "File not found on disk" });

                var bytes = await System.IO.File.ReadAllBytesAsync(invoice.FilePath);
                var downloadName = invoice.OriginalFileName ?? invoice.FileName;
                return File(bytes, invoice.ContentType, downloadName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error downloading book invoice PDF {Id}", id);
                return StatusCode(500, new { error = "Failed to download PDF" });
            }
        }

        // ============================================================================
        // DELETE: api/Books/{id} - Delete an invoice
        // ============================================================================
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var invoice = await _context.BookInvoices.FindAsync(id);
                if (invoice == null)
                    return NotFound(new { error = "Invoice not found" });

                // Delete file from disk
                if (System.IO.File.Exists(invoice.FilePath))
                {
                    System.IO.File.Delete(invoice.FilePath);
                }

                _context.BookInvoices.Remove(invoice);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Book invoice {Id} deleted", id);
                return Ok(new { message = "Invoice deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting book invoice {Id}", id);
                return StatusCode(500, new { error = "Failed to delete invoice" });
            }
        }

        // ============================================================================
        // GET: api/Books/categories - Get distinct categories
        // ============================================================================
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories()
        {
            var categories = await _context.BookInvoices
                .Where(b => b.Category != null && b.Category != "")
                .Select(b => b.Category!)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            return Ok(categories);
        }

        // ============================================================================
        // GET: api/Books/suppliers - Get distinct suppliers
        // ============================================================================
        [HttpGet("suppliers")]
        public async Task<IActionResult> GetSuppliers()
        {
            var suppliers = await _context.BookInvoices
                .Select(b => b.SupplierName)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            return Ok(suppliers);
        }

        // ============================================================================
        // GET: api/Books/departments - Get all departments with book access
        // ============================================================================
        [HttpGet("departments")]
        public async Task<IActionResult> GetDepartments()
        {
            try
            {
                var departments = await _context.BookDepartmentAccess
                    .OrderBy(d => d.DepartmentName)
                    .Select(d => new
                    {
                        d.DepartmentId,
                        d.DepartmentName
                    })
                    .ToListAsync();

                return Ok(departments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching book departments");
                return StatusCode(500, new { error = "Failed to fetch departments" });
            }
        }

        // ============================================================================
        // POST: api/Books/verify-password - Verify department password
        // ============================================================================
        [HttpPost("verify-password")]
        public async Task<IActionResult> VerifyPassword([FromBody] VerifyBookPasswordRequest request)
        {
            try
            {
                var access = await _context.BookDepartmentAccess
                    .FirstOrDefaultAsync(d => d.DepartmentId == request.DepartmentId);

                if (access == null)
                    return NotFound(new { error = "Department not found" });

                if (access.Password != request.Password)
                    return BadRequest(new { error = "Incorrect password" });

                return Ok(new { success = true, departmentId = access.DepartmentId, departmentName = access.DepartmentName });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error verifying book department password");
                return StatusCode(500, new { error = "Failed to verify password" });
            }
        }

        // ============================================================================
        // Copy invoice PDF to Finance/Books/{DepartmentName}/ for document browsing
        // ============================================================================
        private void CopyInvoiceToFinanceDocs(BookInvoice invoice)
        {
            try
            {
                if (string.IsNullOrEmpty(invoice.FilePath) || !System.IO.File.Exists(invoice.FilePath))
                {
                    _logger.LogWarning("Cannot copy invoice {Id} to Finance docs — source file not found: {Path}", invoice.Id, invoice.FilePath);
                    return;
                }

                // Resolve department name
                var deptAccess = _context.BookDepartmentAccess
                    .FirstOrDefault(d => d.DepartmentId == invoice.DepartmentId);
                var deptName = deptAccess?.DepartmentName ?? $"Dept_{invoice.DepartmentId}";

                // Sanitize the department name for use as a folder name
                var safeDeptName = string.Join("_", deptName.Split(Path.GetInvalidFileNameChars()));

                // Build target directory: {DocumentsPath}/Finance/Books/{DepartmentName}/
                var basePath = Path.GetDirectoryName(_storagePath)!; // _storagePath = {DocumentsPath}/Books
                var financeDir = Path.Combine(basePath, "Finance", "Books", safeDeptName);
                Directory.CreateDirectory(financeDir);

                // Build a descriptive filename:
                // {SupplierName}_{InvoiceNumber}_{Date}_{OriginalFilename}.pdf
                var supplier = SanitizeFileName(invoice.SupplierName ?? "Unknown");
                var invNum = SanitizeFileName(invoice.InvoiceNumber ?? "NoNum");
                var invDate = invoice.InvoiceDate.ToString("yyyy-MM-dd");
                var originalName = Path.GetFileNameWithoutExtension(invoice.OriginalFileName ?? "invoice");
                var safeOriginal = SanitizeFileName(originalName);

                var targetFileName = $"{supplier}_{invNum}_{invDate}_{safeOriginal}.pdf";
                // Truncate if too long
                if (targetFileName.Length > 200)
                    targetFileName = $"{supplier}_{invNum}_{invDate}.pdf";

                var targetPath = Path.Combine(financeDir, targetFileName);

                // Handle duplicates — don't overwrite, append counter
                var counter = 1;
                var baseNameNoExt = Path.GetFileNameWithoutExtension(targetFileName);
                while (System.IO.File.Exists(targetPath))
                {
                    targetPath = Path.Combine(financeDir, $"{baseNameNoExt} ({counter}).pdf");
                    counter++;
                }

                System.IO.File.Copy(invoice.FilePath, targetPath);
                _logger.LogInformation("Invoice {Id} copied to Finance docs: {Path}", invoice.Id, targetPath);
            }
            catch (Exception ex)
            {
                // Don't fail the main operation if the copy fails
                _logger.LogWarning(ex, "Failed to copy invoice {Id} to Finance docs", invoice.Id);
            }
        }

        private static string SanitizeFileName(string name)
        {
            var invalid = Path.GetInvalidFileNameChars();
            var sanitized = string.Join("", name.Select(c => invalid.Contains(c) ? '_' : c));
            // Collapse multiple underscores and trim
            sanitized = System.Text.RegularExpressions.Regex.Replace(sanitized, @"_+", "_").Trim('_', ' ');
            return sanitized.Length > 60 ? sanitized[..60] : sanitized;
        }

        // ============================================================================
        // PDF Text Extraction using iText7
        // ============================================================================
        private string ExtractTextFromPdf(string filePath)
        {
            try
            {
                var sb = new StringBuilder();
                using (var reader = new PdfReader(filePath))
                using (var document = new PdfDocument(reader))
                {
                    for (int i = 1; i <= document.GetNumberOfPages(); i++)
                    {
                        var page = document.GetPage(i);
                        var strategy = new LocationTextExtractionStrategy();
                        var text = PdfTextExtractor.GetTextFromPage(page, strategy);
                        sb.AppendLine(text);
                    }
                }
                return sb.ToString().Trim();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to extract text from PDF: {FilePath}", filePath);
                return "";
            }
        }

        // ============================================================================
        // Parse invoice data from extracted text
        // ============================================================================
        private ParsedInvoiceData ParseInvoiceData(string text)
        {
            var result = new ParsedInvoiceData();

            if (string.IsNullOrWhiteSpace(text))
                return result;

            var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries)
                .Select(l => l.Trim()).Where(l => l.Length > 0).ToArray();

            // Try to extract supplier name (usually first few lines, or after "From:", "Supplier:", "Vendor:")
            var supplierPatterns = new[] { @"(?:from|supplier|vendor|company|bill\s*from)\s*[:\-]?\s*(.+)", @"(?:sold\s*by|issued\s*by)\s*[:\-]?\s*(.+)" };
            foreach (var pattern in supplierPatterns)
            {
                var match = Regex.Match(text, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    result.SupplierName = match.Groups[1].Value.Trim();
                    break;
                }
            }
            // Fallback: use first non-empty line as supplier
            if (string.IsNullOrEmpty(result.SupplierName) && lines.Length > 0)
            {
                // Skip common headers
                foreach (var line in lines.Take(5))
                {
                    if (!Regex.IsMatch(line, @"(?:invoice|tax|statement|page|date)", RegexOptions.IgnoreCase) && line.Length > 2 && line.Length < 200)
                    {
                        result.SupplierName = line;
                        break;
                    }
                }
            }
            if (string.IsNullOrEmpty(result.SupplierName))
                result.SupplierName = "Unknown Supplier";

            // Extract invoice number
            var invPatterns = new[] {
                @"(?:invoice\s*(?:no|number|#|num))\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
                @"(?:inv\s*(?:no|#))\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
                @"(?:document\s*(?:no|number|#))\s*[:\-]?\s*([A-Za-z0-9\-/]+)"
            };
            foreach (var pattern in invPatterns)
            {
                var match = Regex.Match(text, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    result.InvoiceNumber = match.Groups[1].Value.Trim();
                    break;
                }
            }

            // Extract date
            var datePatterns = new[] {
                @"(?:invoice\s*date|date\s*of\s*invoice|date)\s*[:\-]?\s*(\d{1,2}[\s/\-\.]\w{3,9}[\s/\-\.]\d{2,4})",
                @"(?:invoice\s*date|date\s*of\s*invoice|date)\s*[:\-]?\s*(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})",
                @"(?:invoice\s*date|date)\s*[:\-]?\s*(\d{4}[/\-\.]\d{1,2}[/\-\.]\d{1,2})",
                @"(\d{1,2}[\s/\-\.]\w{3,9}[\s/\-\.]\d{2,4})",
                @"(\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4})"
            };
            foreach (var pattern in datePatterns)
            {
                var match = Regex.Match(text, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    var dateStr = match.Groups[1].Value.Trim();
                    if (DateTime.TryParse(dateStr, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt))
                    {
                        result.InvoiceDate = dt;
                        break;
                    }
                    // Try South African format
                    string[] formats = { "dd/MM/yyyy", "dd-MM-yyyy", "dd.MM.yyyy", "dd MMM yyyy", "dd MMMM yyyy", "yyyy/MM/dd", "yyyy-MM-dd" };
                    if (DateTime.TryParseExact(dateStr, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dt2))
                    {
                        result.InvoiceDate = dt2;
                        break;
                    }
                }
            }

            // Extract total amount
            var totalPatterns = new[] {
                @"(?:total\s*(?:due|amount|incl|including|inc)\s*(?:vat|gst)?)\s*[:\-]?\s*R?\s*([\d\s,]+\.?\d*)",
                @"(?:grand\s*total|amount\s*due|balance\s*due|total\s*payable)\s*[:\-]?\s*R?\s*([\d\s,]+\.?\d*)",
                @"(?:total)\s*[:\-]?\s*R?\s*([\d\s,]+\.\d{2})",
                @"R\s*([\d\s,]+\.\d{2})"
            };
            foreach (var pattern in totalPatterns)
            {
                var matches = Regex.Matches(text, pattern, RegexOptions.IgnoreCase);
                if (matches.Count > 0)
                {
                    // Take the last match (usually the grand total is at the bottom)
                    var lastMatch = matches[^1];
                    var amountStr = lastMatch.Groups[1].Value.Trim().Replace(" ", "").Replace(",", "");
                    if (decimal.TryParse(amountStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var amount) && amount > 0)
                    {
                        result.Total = amount;
                        break;
                    }
                }
            }

            // Extract VAT amount
            var vatPatterns = new[] {
                @"(?:vat|tax|gst)\s*(?:\(?15%?\)?)?\s*[:\-]?\s*R?\s*([\d\s,]+\.?\d*)",
                @"(?:vat\s*amount|tax\s*amount)\s*[:\-]?\s*R?\s*([\d\s,]+\.?\d*)"
            };
            foreach (var pattern in vatPatterns)
            {
                var match = Regex.Match(text, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    var amountStr = match.Groups[1].Value.Trim().Replace(" ", "").Replace(",", "");
                    if (decimal.TryParse(amountStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var vat) && vat > 0)
                    {
                        result.VatAmount = vat;
                        break;
                    }
                }
            }

            // Extract subtotal
            var subPatterns = new[] {
                @"(?:sub\s*total|subtotal|total\s*(?:excl|excluding|ex)\s*(?:vat|gst)?)\s*[:\-]?\s*R?\s*([\d\s,]+\.?\d*)",
                @"(?:nett|net\s*amount)\s*[:\-]?\s*R?\s*([\d\s,]+\.?\d*)"
            };
            foreach (var pattern in subPatterns)
            {
                var match = Regex.Match(text, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    var amountStr = match.Groups[1].Value.Trim().Replace(" ", "").Replace(",", "");
                    if (decimal.TryParse(amountStr, NumberStyles.Any, CultureInfo.InvariantCulture, out var sub) && sub > 0)
                    {
                        result.SubTotal = sub;
                        break;
                    }
                }
            }

            return result;
        }

        // ============================================================================
        // GET: api/Books/invoice-search - Autocomplete search for invoices
        // ============================================================================
        [HttpGet("invoice-search")]
        public async Task<IActionResult> InvoiceSearch([FromQuery] string query, [FromQuery] int? departmentId, [FromQuery] int limit = 10)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(query) || query.Length < 2)
                    return Ok(new List<object>());

                var q = query.ToLower();
                var invoiceQuery = _context.BookInvoices.AsQueryable();

                if (departmentId.HasValue)
                    invoiceQuery = invoiceQuery.Where(b => b.DepartmentId == departmentId.Value);

                var results = await invoiceQuery
                    .Where(b =>
                        (b.InvoiceNumber != null && b.InvoiceNumber.ToLower().Contains(q)) ||
                        b.SupplierName.ToLower().Contains(q) ||
                        (b.CompanyName != null && b.CompanyName.ToLower().Contains(q)))
                    .OrderByDescending(b => b.InvoiceDate)
                    .Take(limit)
                    .Select(b => new
                    {
                        b.Id,
                        b.InvoiceNumber,
                        b.SupplierName,
                        b.CompanyName,
                        b.InvoiceDate,
                        b.Total,
                        b.Currency,
                        b.Status,
                        b.PaymentDate,
                        b.PaymentMethod,
                        b.PaymentReference,
                        b.DepartmentId
                    })
                    .ToListAsync();

                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching invoices");
                return StatusCode(500, new { error = "Failed to search invoices" });
            }
        }

        // ============================================================================
        // POST: api/Books/payment-inquiry - Send payment inquiry email to finance
        // ============================================================================
        [HttpPost("payment-inquiry")]
        public async Task<IActionResult> SendPaymentInquiry([FromBody] PaymentInquiryRequest request)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var user = await _context.Users.FindAsync(userId);
                var userName = user != null ? $"{user.Name} {user.Surname}" : "Unknown User";
                var userEmail = user?.Email ?? "unknown";

                // Get invoice details if an ID is provided
                string invoiceDetails = "";
                if (request.InvoiceId.HasValue)
                {
                    var invoice = await _context.BookInvoices.FindAsync(request.InvoiceId.Value);
                    if (invoice != null)
                    {
                        invoiceDetails = $@"
                            <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: 600;'>Invoice Number</td><td style='padding: 8px; border: 1px solid #ddd;'>{invoice.InvoiceNumber ?? "N/A"}</td></tr>
                            <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: 600;'>Supplier</td><td style='padding: 8px; border: 1px solid #ddd;'>{invoice.SupplierName}</td></tr>
                            <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: 600;'>Company</td><td style='padding: 8px; border: 1px solid #ddd;'>{invoice.CompanyName ?? "N/A"}</td></tr>
                            <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: 600;'>Invoice Date</td><td style='padding: 8px; border: 1px solid #ddd;'>{invoice.InvoiceDate:dd MMM yyyy}</td></tr>
                            <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: 600;'>Amount</td><td style='padding: 8px; border: 1px solid #ddd;'>{invoice.Currency} {invoice.Total:N2}</td></tr>
                            <tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: 600;'>Current Status</td><td style='padding: 8px; border: 1px solid #ddd;'>{invoice.Status}</td></tr>
                            {(invoice.PaymentDate.HasValue ? $"<tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: 600;'>Payment Date</td><td style='padding: 8px; border: 1px solid #ddd;'>{invoice.PaymentDate:dd MMM yyyy}</td></tr>" : "")}
                            {(!string.IsNullOrEmpty(invoice.PaymentReference) ? $"<tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: 600;'>Payment Reference</td><td style='padding: 8px; border: 1px solid #ddd;'>{invoice.PaymentReference}</td></tr>" : "")}";
                    }
                }

                var emailBody = $@"
                    <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;'>
                        <div style='background: linear-gradient(135deg, #2196f3, #1976d2); color: white; padding: 20px; border-radius: 8px 8px 0 0;'>
                            <h2 style='margin: 0;'>Invoice Payment Inquiry</h2>
                        </div>
                        <div style='background: #fff; padding: 24px; border: 1px solid #e0e0e0; border-radius: 0 0 8px 8px;'>
                            <p>A payment inquiry has been submitted by <strong>{userName}</strong> ({userEmail}).</p>
                            
                            <h3 style='color: #1976d2; border-bottom: 2px solid #2196f3; padding-bottom: 8px;'>Invoice Details</h3>
                            <table style='width: 100%; border-collapse: collapse; margin-bottom: 16px;'>
                                {invoiceDetails}
                                {(!string.IsNullOrEmpty(request.InvoiceNumber) && !request.InvoiceId.HasValue ? $"<tr><td style='padding: 8px; border: 1px solid #ddd; font-weight: 600;'>Invoice Number</td><td style='padding: 8px; border: 1px solid #ddd;'>{request.InvoiceNumber}</td></tr>" : "")}
                            </table>

                            {(!string.IsNullOrEmpty(request.Notes) ? $"<h3 style='color: #1976d2; border-bottom: 2px solid #2196f3; padding-bottom: 8px;'>Additional Notes</h3><p style='background: #f5f5f5; padding: 12px; border-radius: 6px;'>{request.Notes}</p>" : "")}

                            <p style='color: #666; font-size: 0.9em; margin-top: 24px; padding-top: 16px; border-top: 1px solid #eee;'>
                                Please review and respond to this inquiry. You can reply directly to this email or contact {userName} at {userEmail}.
                            </p>
                        </div>
                    </div>";

                var recipients = !string.IsNullOrEmpty(request.FinanceEmail) 
                    ? request.FinanceEmail 
                    : "finance@promedtechnologies.co.za";

                var success = await _emailService.SendEmailAsync(
                    recipients,
                    $"Invoice Payment Inquiry - {request.InvoiceNumber ?? "General"}",
                    emailBody,
                    isHtml: true
                );

                if (success)
                {
                    _logger.LogInformation("Payment inquiry sent by user {UserId} for invoice {InvoiceNumber}", userId, request.InvoiceNumber);
                    return Ok(new { success = true, message = "Payment inquiry sent to finance successfully" });
                }
                else
                {
                    return StatusCode(500, new { success = false, message = "Failed to send email. Please try again." });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending payment inquiry");
                return StatusCode(500, new { error = "Failed to send payment inquiry" });
            }
        }

        // ============================================================================
        // DTOs
        // ============================================================================
        private class ParsedInvoiceData
        {
            public string SupplierName { get; set; } = "Unknown Supplier";
            public string? InvoiceNumber { get; set; }
            public DateTime? InvoiceDate { get; set; }
            public decimal Total { get; set; }
            public decimal? VatAmount { get; set; }
            public decimal? SubTotal { get; set; }
        }
    }

    public class ConfirmBookInvoiceRequest
    {
        public string? SupplierName { get; set; }
        public string? SupplierAccount { get; set; }
        public string? InvoiceNumber { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public decimal? Total { get; set; }
        public decimal? VatAmount { get; set; }
        public decimal? SubTotal { get; set; }
        public string? Currency { get; set; }
        public DateTime? PaymentDate { get; set; }
        public string? PaymentMethod { get; set; }
        public string? PaymentReference { get; set; }
        public string? Category { get; set; }
        public string? CompanyName { get; set; }
        public string? Description { get; set; }
        public string? Notes { get; set; }
    }

    public class VerifyBookPasswordRequest
    {
        public int DepartmentId { get; set; }
        public string Password { get; set; } = string.Empty;
    }

    public class PaymentInquiryRequest
    {
        public int? InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? Notes { get; set; }
        public string? FinanceEmail { get; set; }
    }
}
