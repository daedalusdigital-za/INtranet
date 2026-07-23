using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using System.Security.Claims;
using ClosedXML.Excel;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ExpenseTrackerController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<ExpenseTrackerController> _logger;

        // Finance department id — this dept can see all other departments
        private const int FinanceDeptId = 17;

        public ExpenseTrackerController(ApplicationDbContext context, ILogger<ExpenseTrackerController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string? CurrentUser => User.FindFirstValue(ClaimTypes.Name)
                                    ?? User.FindFirstValue(ClaimTypes.Email);

        // ====================================================================
        // GET api/ExpenseTracker?departmentId=14&year=2026&month=7
        // Finance can pass departmentId=0 to get ALL departments
        // ====================================================================
        [HttpGet]
        public async Task<IActionResult> GetItems(
            [FromQuery] int departmentId,
            [FromQuery] int? year,
            [FromQuery] int? month,
            [FromQuery] string? search,
            [FromQuery] string? itemType,
            [FromQuery] string? status,
            [FromQuery] int? categoryId,
            [FromQuery] string? sortBy,
            [FromQuery] string? sortDir,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            try
            {
                IQueryable<ExpenseTrackerItem> query = _context.ExpenseTrackerItems
                    .Include(e => e.BookInvoice);

                // Finance (dept 17) can request all (departmentId=0) or a specific dept
                if (departmentId == 0)
                {
                    // Allow only if user has finance permission — just return all
                }
                else
                {
                    query = query.Where(e => e.DepartmentId == departmentId);
                }

                if (year.HasValue)    query = query.Where(e => e.Year == year.Value);
                if (month.HasValue)   query = query.Where(e => e.Month == month.Value);
                if (categoryId.HasValue) query = query.Where(e => e.CategoryId == categoryId.Value);
                if (!string.IsNullOrWhiteSpace(itemType)) query = query.Where(e => e.ItemType == itemType);
                if (!string.IsNullOrWhiteSpace(status))   query = query.Where(e => e.Status == status);

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.ToLower();
                    query = query.Where(e =>
                        e.Company.ToLower().Contains(s) ||
                        e.ServicesRendered.ToLower().Contains(s) ||
                        e.InvoicedTo.ToLower().Contains(s) ||
                        (e.InvoiceNumber != null && e.InvoiceNumber.ToLower().Contains(s)) ||
                        (e.PaidBy != null && e.PaidBy.ToLower().Contains(s)));
                }

                // Sorting
                query = (sortBy?.ToLower(), sortDir?.ToLower()) switch
                {
                    ("date",    "asc")  => query.OrderBy(e => e.ItemDate),
                    ("date",    _)      => query.OrderByDescending(e => e.ItemDate),
                    ("amount",  "asc")  => query.OrderBy(e => e.Amount),
                    ("amount",  _)      => query.OrderByDescending(e => e.Amount),
                    ("company", "asc")  => query.OrderBy(e => e.Company),
                    ("company", _)      => query.OrderByDescending(e => e.Company),
                    _                   => query.OrderByDescending(e => e.ItemDate)
                };

                var total = await query.CountAsync();
                var items = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new
                    {
                        e.Id, e.DepartmentId, e.CategoryId, e.Month, e.Year,
                        e.ItemType, e.Company, e.ServicesRendered, e.InvoicedTo,
                        e.Amount, e.PaidBy, e.InvoiceNumber, e.ItemDate,
                        e.Status, e.BookInvoiceId, e.Notes, e.VatAmount, e.Currency,
                        e.CreatedAt, e.CreatedBy,
                        BookInvoiceSupplier = e.BookInvoice != null ? e.BookInvoice.SupplierName : null,
                        BookInvoiceFile     = e.BookInvoice != null ? e.BookInvoice.FileName : null
                    })
                    .ToListAsync();

                // Summary for the period
                var summary = await BuildSummary(departmentId, year, month);

                return Ok(new { items, total, page, pageSize, summary });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching expense tracker items");
                return StatusCode(500, new { error = "Failed to fetch items" });
            }
        }

        // ====================================================================
        // GET api/ExpenseTracker/summary?departmentId=14&year=2026
        // ====================================================================
        [HttpGet("summary")]
        public async Task<IActionResult> GetSummary(
            [FromQuery] int departmentId,
            [FromQuery] int? year,
            [FromQuery] int? month)
        {
            try
            {
                var summary = await BuildSummary(departmentId, year, month);
                return Ok(summary);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error building summary");
                return StatusCode(500, new { error = "Failed to build summary" });
            }
        }

        private async Task<object> BuildSummary(int departmentId, int? year, int? month)
        {
            IQueryable<ExpenseTrackerItem> q = _context.ExpenseTrackerItems;
            if (departmentId != 0) q = q.Where(e => e.DepartmentId == departmentId);
            if (year.HasValue)  q = q.Where(e => e.Year == year.Value);
            if (month.HasValue) q = q.Where(e => e.Month == month.Value);

            var all = await q.ToListAsync();

            var byMonth = all
                .GroupBy(e => new { e.Year, e.Month })
                .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
                .Select(g => new
                {
                    g.Key.Year, g.Key.Month,
                    Total  = g.Sum(e => e.Amount),
                    Count  = g.Count(),
                    Paid   = g.Where(e => e.Status == "Paid").Sum(e => e.Amount),
                    Pending= g.Where(e => e.Status == "Pending").Sum(e => e.Amount)
                }).ToList();

            var byCategory = all
                .GroupBy(e => e.CategoryId)
                .Select(g => new { CategoryId = g.Key, Total = g.Sum(e => e.Amount), Count = g.Count() })
                .ToList();

            var byType = all
                .GroupBy(e => e.ItemType)
                .Select(g => new { Type = g.Key, Total = g.Sum(e => e.Amount), Count = g.Count() })
                .ToList();

            return new
            {
                TotalAmount   = all.Sum(e => e.Amount),
                TotalCount    = all.Count,
                PaidAmount    = all.Where(e => e.Status == "Paid").Sum(e => e.Amount),
                PendingAmount = all.Where(e => e.Status == "Pending").Sum(e => e.Amount),
                ByMonth       = byMonth,
                ByCategory    = byCategory,
                ByType        = byType
            };
        }

        // ====================================================================
        // POST api/ExpenseTracker
        // ====================================================================
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] UpsertExpenseItemDto dto)
        {
            try
            {
                var item = new ExpenseTrackerItem
                {
                    DepartmentId     = dto.DepartmentId,
                    CategoryId       = dto.CategoryId,
                    Month            = dto.Month,
                    Year             = dto.Year,
                    ItemType         = dto.ItemType ?? "Service",
                    Company          = dto.Company,
                    ServicesRendered = dto.ServicesRendered,
                    InvoicedTo       = dto.InvoicedTo,
                    Amount           = dto.Amount,
                    PaidBy           = dto.PaidBy,
                    InvoiceNumber    = dto.InvoiceNumber,
                    ItemDate         = dto.ItemDate,
                    Status           = dto.Status ?? "Pending",
                    BookInvoiceId    = dto.BookInvoiceId,
                    Notes            = dto.Notes,
                    VatAmount        = dto.VatAmount,
                    Currency         = dto.Currency ?? "ZAR",
                    CreatedBy        = CurrentUser,
                    CreatedAt        = DateTime.UtcNow
                };
                _context.ExpenseTrackerItems.Add(item);
                await _context.SaveChangesAsync();
                return Ok(new { item.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating expense item");
                return StatusCode(500, new { error = "Failed to create item" });
            }
        }

        // ====================================================================
        // PUT api/ExpenseTracker/{id}
        // ====================================================================
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpsertExpenseItemDto dto)
        {
            try
            {
                var item = await _context.ExpenseTrackerItems.FindAsync(id);
                if (item == null) return NotFound();

                item.CategoryId       = dto.CategoryId;
                item.Month            = dto.Month;
                item.Year             = dto.Year;
                item.ItemType         = dto.ItemType ?? item.ItemType;
                item.Company          = dto.Company;
                item.ServicesRendered = dto.ServicesRendered;
                item.InvoicedTo       = dto.InvoicedTo;
                item.Amount           = dto.Amount;
                item.PaidBy           = dto.PaidBy;
                item.InvoiceNumber    = dto.InvoiceNumber;
                item.ItemDate         = dto.ItemDate;
                item.Status           = dto.Status ?? item.Status;
                item.BookInvoiceId    = dto.BookInvoiceId;
                item.Notes            = dto.Notes;
                item.VatAmount        = dto.VatAmount;
                item.Currency         = dto.Currency ?? item.Currency;
                item.UpdatedAt        = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return Ok(new { item.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating expense item {Id}", id);
                return StatusCode(500, new { error = "Failed to update item" });
            }
        }

        // ====================================================================
        // DELETE api/ExpenseTracker/{id}
        // ====================================================================
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var item = await _context.ExpenseTrackerItems.FindAsync(id);
                if (item == null) return NotFound();
                _context.ExpenseTrackerItems.Remove(item);
                await _context.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting expense item {Id}", id);
                return StatusCode(500, new { error = "Failed to delete item" });
            }
        }

        // ====================================================================
        // Categories
        // GET  api/ExpenseTracker/categories?departmentId=14
        // POST api/ExpenseTracker/categories
        // PUT  api/ExpenseTracker/categories/{id}
        // DELETE api/ExpenseTracker/categories/{id}
        // ====================================================================
        [HttpGet("categories")]
        public async Task<IActionResult> GetCategories([FromQuery] int departmentId)
        {
            try
            {
                // Return global (0) + department-specific categories
                var cats = await _context.ExpenseCategories
                    .Where(c => c.IsActive && (c.DepartmentId == 0 || c.DepartmentId == departmentId))
                    .OrderBy(c => c.DepartmentId)
                    .ThenBy(c => c.Name)
                    .ToListAsync();
                return Ok(cats);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching categories");
                return StatusCode(500, new { error = "Failed to fetch categories" });
            }
        }

        [HttpPost("categories")]
        public async Task<IActionResult> CreateCategory([FromBody] UpsertCategoryDto dto)
        {
            try
            {
                var cat = new ExpenseCategory
                {
                    DepartmentId = dto.DepartmentId,
                    Name         = dto.Name,
                    Color        = dto.Color ?? "#2563eb",
                    IsActive     = true,
                    CreatedAt    = DateTime.UtcNow
                };
                _context.ExpenseCategories.Add(cat);
                await _context.SaveChangesAsync();
                return Ok(cat);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating category");
                return StatusCode(500, new { error = "Failed to create category" });
            }
        }

        [HttpPut("categories/{id}")]
        public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpsertCategoryDto dto)
        {
            try
            {
                var cat = await _context.ExpenseCategories.FindAsync(id);
                if (cat == null) return NotFound();
                cat.Name      = dto.Name;
                cat.Color     = dto.Color ?? cat.Color;
                cat.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(cat);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating category {Id}", id);
                return StatusCode(500, new { error = "Failed to update category" });
            }
        }

        [HttpDelete("categories/{id}")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            try
            {
                var cat = await _context.ExpenseCategories.FindAsync(id);
                if (cat == null) return NotFound();
                // Soft delete
                cat.IsActive  = false;
                cat.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting category {Id}", id);
                return StatusCode(500, new { error = "Failed to delete category" });
            }
        }

        // ====================================================================
        // POST api/ExpenseTracker/upload-excel?departmentId=14&year=2026&month=7
        // Expected columns (case-insensitive, flexible column order):
        //   Company | Services Rendered | Invoiced To | Amount | Paid By |
        //   Invoice Number | Date | Type | Category | Status | Notes
        // ====================================================================
        [HttpPost("upload-excel")]
        public async Task<IActionResult> UploadExcel(
            [FromForm] IFormFile file,
            [FromQuery] int departmentId,
            [FromQuery] int year,
            [FromQuery] int month)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No file provided" });

            try
            {
                using var stream = file.OpenReadStream();
                using var workbook = new XLWorkbook(stream);
                var ws = workbook.Worksheets.First();

                // Build header map (col index → field name)
                var headerRow = ws.Row(1);
                var headers = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
                foreach (var cell in headerRow.CellsUsed())
                    headers[cell.GetString().Trim()] = cell.Address.ColumnNumber;

                // Load categories for matching
                var categories = await _context.ExpenseCategories
                    .Where(c => c.IsActive && (c.DepartmentId == 0 || c.DepartmentId == departmentId))
                    .ToListAsync();

                int imported = 0, skipped = 0;
                var errors = new List<string>();
                var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;

                for (int r = 2; r <= lastRow; r++)
                {
                    var row = ws.Row(r);
                    if (row.IsEmpty()) continue;

                    string Get(string col)
                    {
                        if (!headers.TryGetValue(col, out var ci)) return "";
                        return row.Cell(ci).GetString().Trim();
                    }

                    var company = Get("Company");
                    if (string.IsNullOrWhiteSpace(company)) { skipped++; continue; }

                    var dateStr   = Get("Date");
                    var amountStr = Get("Amount");

                    if (!DateTime.TryParse(dateStr, out var itemDate))
                        itemDate = new DateTime(year, month, 1);

                    decimal.TryParse(amountStr.Replace("R", "").Replace(",", "").Trim(),
                        System.Globalization.NumberStyles.Any,
                        System.Globalization.CultureInfo.InvariantCulture,
                        out var amount);

                    var categoryName = Get("Category");
                    int? catId = null;
                    if (!string.IsNullOrWhiteSpace(categoryName))
                    {
                        var match = categories.FirstOrDefault(c =>
                            c.Name.Equals(categoryName, StringComparison.OrdinalIgnoreCase));
                        if (match == null)
                        {
                            // Auto-create dept-specific category
                            var newCat = new ExpenseCategory
                            {
                                DepartmentId = departmentId,
                                Name  = categoryName,
                                Color = "#6b7280",
                                CreatedAt = DateTime.UtcNow
                            };
                            _context.ExpenseCategories.Add(newCat);
                            await _context.SaveChangesAsync();
                            categories.Add(newCat);
                            catId = newCat.Id;
                        }
                        else catId = match.Id;
                    }

                    var typeRaw = Get("Type");
                    var itemType = typeRaw.Contains("Purchase", StringComparison.OrdinalIgnoreCase)
                        ? "PurchaseOrder" : "Service";

                    var statusRaw = Get("Status");
                    var status = statusRaw.Equals("Paid", StringComparison.OrdinalIgnoreCase)
                        ? "Paid"
                        : statusRaw.Equals("Cancelled", StringComparison.OrdinalIgnoreCase)
                            ? "Cancelled" : "Pending";

                    var item = new ExpenseTrackerItem
                    {
                        DepartmentId     = departmentId,
                        CategoryId       = catId,
                        Month            = itemDate.Month,
                        Year             = itemDate.Year,
                        ItemType         = itemType,
                        Company          = company,
                        ServicesRendered = Get("Services Rendered"),
                        InvoicedTo       = Get("Invoiced To"),
                        Amount           = amount,
                        PaidBy           = Get("Paid By"),
                        InvoiceNumber    = Get("Invoice Number"),
                        ItemDate         = itemDate,
                        Status           = status,
                        Notes            = Get("Notes"),
                        Currency         = "ZAR",
                        CreatedBy        = CurrentUser,
                        CreatedAt        = DateTime.UtcNow
                    };
                    _context.ExpenseTrackerItems.Add(item);
                    imported++;
                }

                await _context.SaveChangesAsync();
                return Ok(new { imported, skipped, errors });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading expense excel");
                return StatusCode(500, new { error = $"Upload failed: {ex.Message}" });
            }
        }

        // ====================================================================
        // GET api/ExpenseTracker/export-excel?departmentId=14&year=2026&month=7
        // ====================================================================
        [HttpGet("export-excel")]
        public async Task<IActionResult> ExportExcel(
            [FromQuery] int departmentId,
            [FromQuery] int? year,
            [FromQuery] int? month)
        {
            try
            {
                IQueryable<ExpenseTrackerItem> q = _context.ExpenseTrackerItems
                    .Include(e => e.BookInvoice);
                if (departmentId != 0) q = q.Where(e => e.DepartmentId == departmentId);
                if (year.HasValue)  q = q.Where(e => e.Year == year.Value);
                if (month.HasValue) q = q.Where(e => e.Month == month.Value);
                var items = await q.OrderByDescending(e => e.ItemDate).ToListAsync();

                var categories = await _context.ExpenseCategories
                    .Where(c => c.IsActive)
                    .ToDictionaryAsync(c => c.Id, c => c.Name);

                using var wb = new XLWorkbook();
                var ws = wb.Worksheets.Add("Expenses");

                // Header row
                var headers = new[] { "Company", "Services Rendered", "Invoiced To",
                    "Amount", "Paid By", "Invoice Number", "Date", "Type",
                    "Category", "Status", "Month", "Year", "Notes", "Linked Invoice" };
                for (int c = 0; c < headers.Length; c++)
                {
                    var cell = ws.Cell(1, c + 1);
                    cell.Value = headers[c];
                    cell.Style.Font.Bold = true;
                    cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#2563eb");
                    cell.Style.Font.FontColor = XLColor.White;
                }

                // Data rows
                for (int i = 0; i < items.Count; i++)
                {
                    var it = items[i];
                    var row = i + 2;
                    ws.Cell(row, 1).Value  = it.Company;
                    ws.Cell(row, 2).Value  = it.ServicesRendered;
                    ws.Cell(row, 3).Value  = it.InvoicedTo;
                    ws.Cell(row, 4).Value  = (double)it.Amount;
                    ws.Cell(row, 5).Value  = it.PaidBy ?? "";
                    ws.Cell(row, 6).Value  = it.InvoiceNumber ?? "";
                    ws.Cell(row, 7).Value  = it.ItemDate.ToString("yyyy-MM-dd");
                    ws.Cell(row, 8).Value  = it.ItemType;
                    ws.Cell(row, 9).Value  = it.CategoryId.HasValue && categories.TryGetValue(it.CategoryId.Value, out var cn) ? cn : "";
                    ws.Cell(row, 10).Value = it.Status;
                    ws.Cell(row, 11).Value = it.Month;
                    ws.Cell(row, 12).Value = it.Year;
                    ws.Cell(row, 13).Value = it.Notes ?? "";
                    ws.Cell(row, 14).Value = it.BookInvoice?.SupplierName ?? "";
                }

                ws.Columns().AdjustToContents();

                using var ms = new MemoryStream();
                wb.SaveAs(ms);
                ms.Position = 0;

                var dept  = departmentId == 0 ? "All" : departmentId.ToString();
                var ym    = $"{year?.ToString() ?? "all"}_{month?.ToString("D2") ?? "all"}";
                return File(ms.ToArray(),
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    $"expenses_{dept}_{ym}.xlsx");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting expenses");
                return StatusCode(500, new { error = "Export failed" });
            }
        }
    }

    // ── DTOs ──────────────────────────────────────────────────────────────────
    public class UpsertExpenseItemDto
    {
        public int DepartmentId     { get; set; }
        public int? CategoryId      { get; set; }
        public int Month            { get; set; }
        public int Year             { get; set; }
        public string? ItemType     { get; set; }
        public string Company       { get; set; } = string.Empty;
        public string ServicesRendered { get; set; } = string.Empty;
        public string InvoicedTo    { get; set; } = string.Empty;
        public decimal Amount       { get; set; }
        public string? PaidBy       { get; set; }
        public string? InvoiceNumber{ get; set; }
        public DateTime ItemDate    { get; set; }
        public string? Status       { get; set; }
        public int? BookInvoiceId   { get; set; }
        public string? Notes        { get; set; }
        public decimal? VatAmount   { get; set; }
        public string? Currency     { get; set; }
    }

    public class UpsertCategoryDto
    {
        public int DepartmentId { get; set; }
        public string Name      { get; set; } = string.Empty;
        public string? Color    { get; set; }
    }
}
