using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs.Finance;
using ProjectTracker.API.Models.Finance;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FinanceController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<FinanceController> _logger;

        public FinanceController(ApplicationDbContext context, ILogger<FinanceController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string GetCurrentUserEmail()
        {
            return User.FindFirst(ClaimTypes.Email)?.Value ?? "Unknown";
        }

        // ============================================================================
        // FINANCE CATEGORIES
        // ============================================================================

        [HttpGet("categories")]
        public async Task<ActionResult<IEnumerable<FinanceCategoryDto>>> GetCategories(
            [FromQuery] string? type = null,
            [FromQuery] bool activeOnly = true)
        {
            try
            {
                var query = _context.FinanceCategories.AsNoTracking().AsQueryable();

                if (activeOnly)
                    query = query.Where(c => c.IsActive);

                if (!string.IsNullOrEmpty(type))
                    query = query.Where(c => c.Type == type);

                var categories = await query
                    .OrderBy(c => c.Name)
                    .Select(c => new FinanceCategoryDto
                    {
                        Id = c.Id,
                        Name = c.Name,
                        Description = c.Description,
                        Type = c.Type,
                        Code = c.Code,
                        ParentCategoryId = c.ParentCategoryId,
                        IsActive = c.IsActive,
                        CreatedAt = c.CreatedAt
                    })
                    .ToListAsync();

                return Ok(categories);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving finance categories");
                return StatusCode(500, "An error occurred while retrieving categories");
            }
        }

        [HttpGet("categories/{id}")]
        public async Task<ActionResult<FinanceCategoryDto>> GetCategory(int id)
        {
            try
            {
                var category = await _context.FinanceCategories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == id);

                if (category == null)
                    return NotFound();

                return Ok(new FinanceCategoryDto
                {
                    Id = category.Id,
                    Name = category.Name,
                    Description = category.Description,
                    Type = category.Type,
                    Code = category.Code,
                    ParentCategoryId = category.ParentCategoryId,
                    IsActive = category.IsActive,
                    CreatedAt = category.CreatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving category {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the category");
            }
        }

        [HttpPost("categories")]
        public async Task<ActionResult<FinanceCategoryDto>> CreateCategory(CreateFinanceCategoryDto dto)
        {
            try
            {
                var category = new FinanceCategory
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    Type = dto.Type,
                    Code = dto.Code,
                    ParentCategoryId = dto.ParentCategoryId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _context.FinanceCategories.Add(category);
                await _context.SaveChangesAsync();

                var result = new FinanceCategoryDto
                {
                    Id = category.Id,
                    Name = category.Name,
                    Description = category.Description,
                    Type = category.Type,
                    Code = category.Code,
                    ParentCategoryId = category.ParentCategoryId,
                    IsActive = category.IsActive,
                    CreatedAt = category.CreatedAt
                };

                return CreatedAtAction(nameof(GetCategory), new { id = category.Id }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating category");
                return StatusCode(500, "An error occurred while creating the category");
            }
        }

        [HttpPut("categories/{id}")]
        public async Task<IActionResult> UpdateCategory(int id, UpdateFinanceCategoryDto dto)
        {
            try
            {
                var category = await _context.FinanceCategories.FindAsync(id);
                if (category == null)
                    return NotFound();

                if (!string.IsNullOrEmpty(dto.Name))
                    category.Name = dto.Name;
                if (dto.Description != null)
                    category.Description = dto.Description;
                if (!string.IsNullOrEmpty(dto.Type))
                    category.Type = dto.Type;
                if (dto.Code != null)
                    category.Code = dto.Code;
                if (dto.ParentCategoryId.HasValue)
                    category.ParentCategoryId = dto.ParentCategoryId;
                if (dto.IsActive.HasValue)
                    category.IsActive = dto.IsActive.Value;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating category {Id}", id);
                return StatusCode(500, "An error occurred while updating the category");
            }
        }

        [HttpDelete("categories/{id}")]
        public async Task<IActionResult> DeleteCategory(int id)
        {
            try
            {
                var category = await _context.FinanceCategories.FindAsync(id);
                if (category == null)
                    return NotFound();

                _context.FinanceCategories.Remove(category);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting category {Id}", id);
                return StatusCode(500, "An error occurred while deleting the category");
            }
        }

        // ============================================================================
        // BUDGETS
        // ============================================================================

        [HttpGet("budgets")]
        public async Task<ActionResult<IEnumerable<BudgetDto>>> GetBudgets(
            [FromQuery] string? fiscalYear = null,
            [FromQuery] string? department = null,
            [FromQuery] string? status = null)
        {
            try
            {
                var query = _context.Budgets
                    .AsNoTracking()
                    .Include(b => b.LineItems)
                    .ThenInclude(li => li.Category)
                    .AsQueryable();

                if (!string.IsNullOrEmpty(fiscalYear))
                    query = query.Where(b => b.FiscalYear == fiscalYear);
                if (!string.IsNullOrEmpty(department))
                    query = query.Where(b => b.Department == department);
                if (!string.IsNullOrEmpty(status))
                    query = query.Where(b => b.Status == status);

                var budgets = await query
                    .OrderByDescending(b => b.CreatedAt)
                    .Select(b => new BudgetDto
                    {
                        Id = b.Id,
                        Name = b.Name,
                        Description = b.Description,
                        FiscalYear = b.FiscalYear,
                        Period = b.Period,
                        Department = b.Department,
                        Status = b.Status,
                        TotalBudget = b.TotalBudget,
                        AllocatedAmount = b.AllocatedAmount,
                        SpentAmount = b.SpentAmount,
                        RemainingAmount = b.RemainingAmount,
                        Currency = b.Currency,
                        StartDate = b.StartDate,
                        EndDate = b.EndDate,
                        CreatedBy = b.CreatedBy,
                        ApprovedBy = b.ApprovedBy,
                        ApprovedDate = b.ApprovedDate,
                        Notes = b.Notes,
                        CreatedAt = b.CreatedAt,
                        UpdatedAt = b.UpdatedAt,
                        LineItems = b.LineItems.Select(li => new BudgetLineItemDto
                        {
                            Id = li.Id,
                            Name = li.Name,
                            Description = li.Description,
                            CategoryId = li.CategoryId,
                            CategoryName = li.Category != null ? li.Category.Name : null,
                            AllocatedAmount = li.AllocatedAmount,
                            SpentAmount = li.SpentAmount,
                            RemainingAmount = li.RemainingAmount
                        }).ToList()
                    })
                    .ToListAsync();

                return Ok(budgets);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving budgets");
                return StatusCode(500, "An error occurred while retrieving budgets");
            }
        }

        [HttpGet("budgets/{id}")]
        public async Task<ActionResult<BudgetDto>> GetBudget(int id)
        {
            try
            {
                var budget = await _context.Budgets
                    .AsNoTracking()
                    .Include(b => b.LineItems)
                    .ThenInclude(li => li.Category)
                    .FirstOrDefaultAsync(b => b.Id == id);

                if (budget == null)
                    return NotFound();

                return Ok(new BudgetDto
                {
                    Id = budget.Id,
                    Name = budget.Name,
                    Description = budget.Description,
                    FiscalYear = budget.FiscalYear,
                    Period = budget.Period,
                    Department = budget.Department,
                    Status = budget.Status,
                    TotalBudget = budget.TotalBudget,
                    AllocatedAmount = budget.AllocatedAmount,
                    SpentAmount = budget.SpentAmount,
                    RemainingAmount = budget.RemainingAmount,
                    Currency = budget.Currency,
                    StartDate = budget.StartDate,
                    EndDate = budget.EndDate,
                    CreatedBy = budget.CreatedBy,
                    ApprovedBy = budget.ApprovedBy,
                    ApprovedDate = budget.ApprovedDate,
                    Notes = budget.Notes,
                    CreatedAt = budget.CreatedAt,
                    UpdatedAt = budget.UpdatedAt,
                    LineItems = budget.LineItems.Select(li => new BudgetLineItemDto
                    {
                        Id = li.Id,
                        Name = li.Name,
                        Description = li.Description,
                        CategoryId = li.CategoryId,
                        CategoryName = li.Category != null ? li.Category.Name : null,
                        AllocatedAmount = li.AllocatedAmount,
                        SpentAmount = li.SpentAmount,
                        RemainingAmount = li.RemainingAmount
                    }).ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving budget {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the budget");
            }
        }

        [HttpPost("budgets")]
        public async Task<ActionResult<BudgetDto>> CreateBudget(CreateBudgetDto dto)
        {
            try
            {
                var currentUser = GetCurrentUserEmail();

                var budget = new Budget
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    FiscalYear = dto.FiscalYear,
                    Period = dto.Period,
                    Department = dto.Department,
                    Status = "Draft",
                    TotalBudget = dto.TotalBudget,
                    AllocatedAmount = 0,
                    SpentAmount = 0,
                    RemainingAmount = dto.TotalBudget,
                    Currency = dto.Currency,
                    StartDate = dto.StartDate,
                    EndDate = dto.EndDate,
                    CreatedBy = currentUser,
                    Notes = dto.Notes,
                    CreatedAt = DateTime.UtcNow
                };

                // Add line items
                foreach (var itemDto in dto.LineItems)
                {
                    budget.LineItems.Add(new BudgetLineItem
                    {
                        Name = itemDto.Name,
                        Description = itemDto.Description,
                        CategoryId = itemDto.CategoryId,
                        AllocatedAmount = itemDto.AllocatedAmount,
                        SpentAmount = 0,
                        RemainingAmount = itemDto.AllocatedAmount
                    });
                    budget.AllocatedAmount += itemDto.AllocatedAmount;
                }

                budget.RemainingAmount = budget.TotalBudget - budget.AllocatedAmount;

                _context.Budgets.Add(budget);
                await _context.SaveChangesAsync();

                // Reload with includes
                var created = await _context.Budgets
                    .Include(b => b.LineItems)
                    .ThenInclude(li => li.Category)
                    .FirstAsync(b => b.Id == budget.Id);

                var result = new BudgetDto
                {
                    Id = created.Id,
                    Name = created.Name,
                    Description = created.Description,
                    FiscalYear = created.FiscalYear,
                    Period = created.Period,
                    Department = created.Department,
                    Status = created.Status,
                    TotalBudget = created.TotalBudget,
                    AllocatedAmount = created.AllocatedAmount,
                    SpentAmount = created.SpentAmount,
                    RemainingAmount = created.RemainingAmount,
                    Currency = created.Currency,
                    StartDate = created.StartDate,
                    EndDate = created.EndDate,
                    CreatedBy = created.CreatedBy,
                    Notes = created.Notes,
                    CreatedAt = created.CreatedAt,
                    LineItems = created.LineItems.Select(li => new BudgetLineItemDto
                    {
                        Id = li.Id,
                        Name = li.Name,
                        Description = li.Description,
                        CategoryId = li.CategoryId,
                        CategoryName = li.Category != null ? li.Category.Name : null,
                        AllocatedAmount = li.AllocatedAmount,
                        SpentAmount = li.SpentAmount,
                        RemainingAmount = li.RemainingAmount
                    }).ToList()
                };

                return CreatedAtAction(nameof(GetBudget), new { id = created.Id }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating budget");
                return StatusCode(500, "An error occurred while creating the budget");
            }
        }

        [HttpPut("budgets/{id}")]
        public async Task<IActionResult> UpdateBudget(int id, UpdateBudgetDto dto)
        {
            try
            {
                var budget = await _context.Budgets.FindAsync(id);
                if (budget == null)
                    return NotFound();

                if (!string.IsNullOrEmpty(dto.Name))
                    budget.Name = dto.Name;
                if (dto.Description != null)
                    budget.Description = dto.Description;
                if (!string.IsNullOrEmpty(dto.FiscalYear))
                    budget.FiscalYear = dto.FiscalYear;
                if (dto.Period != null)
                    budget.Period = dto.Period;
                if (dto.Department != null)
                    budget.Department = dto.Department;
                if (!string.IsNullOrEmpty(dto.Status))
                    budget.Status = dto.Status;
                if (dto.TotalBudget.HasValue)
                {
                    budget.TotalBudget = dto.TotalBudget.Value;
                    budget.RemainingAmount = budget.TotalBudget - budget.AllocatedAmount;
                }
                if (!string.IsNullOrEmpty(dto.Currency))
                    budget.Currency = dto.Currency;
                if (dto.StartDate.HasValue)
                    budget.StartDate = dto.StartDate.Value;
                if (dto.EndDate.HasValue)
                    budget.EndDate = dto.EndDate.Value;
                if (dto.Notes != null)
                    budget.Notes = dto.Notes;

                budget.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating budget {Id}", id);
                return StatusCode(500, "An error occurred while updating the budget");
            }
        }

        [HttpDelete("budgets/{id}")]
        public async Task<IActionResult> DeleteBudget(int id)
        {
            try
            {
                var budget = await _context.Budgets.FindAsync(id);
                if (budget == null)
                    return NotFound();

                _context.Budgets.Remove(budget);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting budget {Id}", id);
                return StatusCode(500, "An error occurred while deleting the budget");
            }
        }

        // ============================================================================
        // EXPENSES
        // ============================================================================

        [HttpGet("expenses")]
        public async Task<ActionResult<IEnumerable<ExpenseDto>>> GetExpenses(
            [FromQuery] string? status = null,
            [FromQuery] string? department = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var query = _context.Expenses
                    .AsNoTracking()
                    .Include(e => e.Category)
                    .Include(e => e.Budget)
                    .Include(e => e.PurchaseOrder)
                    .AsQueryable();

                if (!string.IsNullOrEmpty(status))
                    query = query.Where(e => e.Status == status);
                if (!string.IsNullOrEmpty(department))
                    query = query.Where(e => e.Department == department);
                if (fromDate.HasValue)
                    query = query.Where(e => e.ExpenseDate >= fromDate.Value);
                if (toDate.HasValue)
                    query = query.Where(e => e.ExpenseDate <= toDate.Value);

                var expenses = await query
                    .OrderByDescending(e => e.ExpenseDate)
                    .Select(e => new ExpenseDto
                    {
                        Id = e.Id,
                        ExpenseNumber = e.ExpenseNumber,
                        Description = e.Description,
                        Vendor = e.Vendor,
                        Status = e.Status,
                        Amount = e.Amount,
                        VatAmount = e.VatAmount,
                        TotalAmount = e.TotalAmount,
                        Currency = e.Currency,
                        CategoryId = e.CategoryId,
                        CategoryName = e.Category != null ? e.Category.Name : null,
                        Department = e.Department,
                        ExpenseDate = e.ExpenseDate,
                        DueDate = e.DueDate,
                        SubmittedBy = e.SubmittedBy,
                        ApprovedBy = e.ApprovedBy,
                        ApprovedDate = e.ApprovedDate,
                        PaymentMethod = e.PaymentMethod,
                        PaymentReference = e.PaymentReference,
                        InvoiceNumber = e.InvoiceNumber,
                        Notes = e.Notes,
                        ReceiptPath = e.ReceiptPath,
                        ReceiptFileName = e.ReceiptFileName,
                        IsRecurring = e.IsRecurring,
                        RecurrencePattern = e.RecurrencePattern,
                        BudgetId = e.BudgetId,
                        BudgetName = e.Budget != null ? e.Budget.Name : null,
                        PurchaseOrderId = e.PurchaseOrderId,
                        PurchaseOrderNumber = e.PurchaseOrder != null ? e.PurchaseOrder.PoNumber : null,
                        CreatedAt = e.CreatedAt,
                        UpdatedAt = e.UpdatedAt
                    })
                    .ToListAsync();

                return Ok(expenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expenses");
                return StatusCode(500, "An error occurred while retrieving expenses");
            }
        }

        [HttpGet("expenses/{id}")]
        public async Task<ActionResult<ExpenseDto>> GetExpense(int id)
        {
            try
            {
                var expense = await _context.Expenses
                    .AsNoTracking()
                    .Include(e => e.Category)
                    .Include(e => e.Budget)
                    .Include(e => e.PurchaseOrder)
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (expense == null)
                    return NotFound();

                return Ok(new ExpenseDto
                {
                    Id = expense.Id,
                    ExpenseNumber = expense.ExpenseNumber,
                    Description = expense.Description,
                    Vendor = expense.Vendor,
                    Status = expense.Status,
                    Amount = expense.Amount,
                    VatAmount = expense.VatAmount,
                    TotalAmount = expense.TotalAmount,
                    Currency = expense.Currency,
                    CategoryId = expense.CategoryId,
                    CategoryName = expense.Category?.Name,
                    Department = expense.Department,
                    ExpenseDate = expense.ExpenseDate,
                    DueDate = expense.DueDate,
                    SubmittedBy = expense.SubmittedBy,
                    ApprovedBy = expense.ApprovedBy,
                    ApprovedDate = expense.ApprovedDate,
                    PaymentMethod = expense.PaymentMethod,
                    PaymentReference = expense.PaymentReference,
                    InvoiceNumber = expense.InvoiceNumber,
                    Notes = expense.Notes,
                    ReceiptPath = expense.ReceiptPath,
                    ReceiptFileName = expense.ReceiptFileName,
                    IsRecurring = expense.IsRecurring,
                    RecurrencePattern = expense.RecurrencePattern,
                    BudgetId = expense.BudgetId,
                    BudgetName = expense.Budget?.Name,
                    PurchaseOrderId = expense.PurchaseOrderId,
                    PurchaseOrderNumber = expense.PurchaseOrder?.PoNumber,
                    CreatedAt = expense.CreatedAt,
                    UpdatedAt = expense.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving expense {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the expense");
            }
        }

        [HttpPost("expenses")]
        public async Task<ActionResult<ExpenseDto>> CreateExpense(CreateExpenseDto dto)
        {
            try
            {
                var currentUser = GetCurrentUserEmail();

                var expense = new Expense
                {
                    ExpenseNumber = dto.ExpenseNumber,
                    Description = dto.Description,
                    Vendor = dto.Vendor,
                    Status = "Pending",
                    Amount = dto.Amount,
                    VatAmount = dto.VatAmount,
                    TotalAmount = dto.Amount + (dto.VatAmount ?? 0),
                    Currency = dto.Currency,
                    CategoryId = dto.CategoryId,
                    Department = dto.Department,
                    ExpenseDate = dto.ExpenseDate,
                    DueDate = dto.DueDate,
                    SubmittedBy = currentUser,
                    InvoiceNumber = dto.InvoiceNumber,
                    Notes = dto.Notes,
                    IsRecurring = dto.IsRecurring,
                    RecurrencePattern = dto.RecurrencePattern,
                    BudgetId = dto.BudgetId,
                    PurchaseOrderId = dto.PurchaseOrderId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Expenses.Add(expense);
                await _context.SaveChangesAsync();

                // Reload with includes
                var created = await _context.Expenses
                    .Include(e => e.Category)
                    .Include(e => e.Budget)
                    .Include(e => e.PurchaseOrder)
                    .FirstAsync(e => e.Id == expense.Id);

                var result = new ExpenseDto
                {
                    Id = created.Id,
                    ExpenseNumber = created.ExpenseNumber,
                    Description = created.Description,
                    Vendor = created.Vendor,
                    Status = created.Status,
                    Amount = created.Amount,
                    VatAmount = created.VatAmount,
                    TotalAmount = created.TotalAmount,
                    Currency = created.Currency,
                    CategoryId = created.CategoryId,
                    CategoryName = created.Category?.Name,
                    Department = created.Department,
                    ExpenseDate = created.ExpenseDate,
                    DueDate = created.DueDate,
                    SubmittedBy = created.SubmittedBy,
                    InvoiceNumber = created.InvoiceNumber,
                    Notes = created.Notes,
                    IsRecurring = created.IsRecurring,
                    RecurrencePattern = created.RecurrencePattern,
                    BudgetId = created.BudgetId,
                    BudgetName = created.Budget?.Name,
                    PurchaseOrderId = created.PurchaseOrderId,
                    PurchaseOrderNumber = created.PurchaseOrder?.PoNumber,
                    CreatedAt = created.CreatedAt
                };

                return CreatedAtAction(nameof(GetExpense), new { id = created.Id }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating expense");
                return StatusCode(500, "An error occurred while creating the expense");
            }
        }

        [HttpPut("expenses/{id}")]
        public async Task<IActionResult> UpdateExpense(int id, UpdateExpenseDto dto)
        {
            try
            {
                var expense = await _context.Expenses.FindAsync(id);
                if (expense == null)
                    return NotFound();

                if (!string.IsNullOrEmpty(dto.Description))
                    expense.Description = dto.Description;
                if (!string.IsNullOrEmpty(dto.Vendor))
                    expense.Vendor = dto.Vendor;
                if (!string.IsNullOrEmpty(dto.Status))
                    expense.Status = dto.Status;
                if (dto.Amount.HasValue)
                    expense.Amount = dto.Amount.Value;
                if (dto.VatAmount.HasValue)
                    expense.VatAmount = dto.VatAmount;
                if (dto.CategoryId.HasValue)
                    expense.CategoryId = dto.CategoryId;
                if (dto.Department != null)
                    expense.Department = dto.Department;
                if (dto.ExpenseDate.HasValue)
                    expense.ExpenseDate = dto.ExpenseDate.Value;
                if (dto.DueDate.HasValue)
                    expense.DueDate = dto.DueDate;
                if (!string.IsNullOrEmpty(dto.PaymentMethod))
                    expense.PaymentMethod = dto.PaymentMethod;
                if (dto.PaymentReference != null)
                    expense.PaymentReference = dto.PaymentReference;
                if (dto.InvoiceNumber != null)
                    expense.InvoiceNumber = dto.InvoiceNumber;
                if (dto.Notes != null)
                    expense.Notes = dto.Notes;
                if (dto.IsRecurring.HasValue)
                    expense.IsRecurring = dto.IsRecurring.Value;
                if (dto.RecurrencePattern != null)
                    expense.RecurrencePattern = dto.RecurrencePattern;

                expense.TotalAmount = expense.Amount + (expense.VatAmount ?? 0);
                expense.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating expense {Id}", id);
                return StatusCode(500, "An error occurred while updating the expense");
            }
        }

        [HttpDelete("expenses/{id}")]
        public async Task<IActionResult> DeleteExpense(int id)
        {
            try
            {
                var expense = await _context.Expenses.FindAsync(id);
                if (expense == null)
                    return NotFound();

                _context.Expenses.Remove(expense);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting expense {Id}", id);
                return StatusCode(500, "An error occurred while deleting the expense");
            }
        }

        // ============================================================================
        // PURCHASE ORDERS
        // ============================================================================

        [HttpGet("purchase-orders")]
        public async Task<ActionResult<IEnumerable<PurchaseOrderDto>>> GetPurchaseOrders(
            [FromQuery] string? status = null,
            [FromQuery] string? department = null)
        {
            try
            {
                var query = _context.PurchaseOrders
                    .AsNoTracking()
                    .Include(po => po.Category)
                    .Include(po => po.Items)
                    .AsQueryable();

                if (!string.IsNullOrEmpty(status))
                    query = query.Where(po => po.Status == status);
                if (!string.IsNullOrEmpty(department))
                    query = query.Where(po => po.Department == department);

                var purchaseOrders = await query
                    .OrderByDescending(po => po.OrderDate)
                    .Select(po => new PurchaseOrderDto
                    {
                        Id = po.Id,
                        PoNumber = po.PoNumber,
                        SupplierName = po.SupplierName,
                        SupplierContact = po.SupplierContact,
                        SupplierEmail = po.SupplierEmail,
                        Description = po.Description,
                        Status = po.Status,
                        SubTotal = po.SubTotal,
                        VatAmount = po.VatAmount,
                        Total = po.Total,
                        Currency = po.Currency,
                        CategoryId = po.CategoryId,
                        CategoryName = po.Category != null ? po.Category.Name : null,
                        Department = po.Department,
                        OrderDate = po.OrderDate,
                        ExpectedDeliveryDate = po.ExpectedDeliveryDate,
                        ReceivedDate = po.ReceivedDate,
                        RequestedBy = po.RequestedBy,
                        ApprovedBy = po.ApprovedBy,
                        ApprovedDate = po.ApprovedDate,
                        Notes = po.Notes,
                        DeliveryAddress = po.DeliveryAddress,
                        AttachmentPath = po.AttachmentPath,
                        AttachmentFileName = po.AttachmentFileName,
                        CreatedAt = po.CreatedAt,
                        UpdatedAt = po.UpdatedAt,
                        Items = po.Items.Select(i => new PurchaseOrderItemDto
                        {
                            Id = i.Id,
                            Description = i.Description,
                            ProductCode = i.ProductCode,
                            Quantity = i.Quantity,
                            Unit = i.Unit,
                            UnitPrice = i.UnitPrice,
                            LineTotal = i.LineTotal,
                            ReceivedQuantity = i.ReceivedQuantity
                        }).ToList()
                    })
                    .ToListAsync();

                return Ok(purchaseOrders);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving purchase orders");
                return StatusCode(500, "An error occurred while retrieving purchase orders");
            }
        }

        [HttpGet("purchase-orders/{id}")]
        public async Task<ActionResult<PurchaseOrderDto>> GetPurchaseOrder(int id)
        {
            try
            {
                var po = await _context.PurchaseOrders
                    .AsNoTracking()
                    .Include(po => po.Category)
                    .Include(po => po.Items)
                    .FirstOrDefaultAsync(po => po.Id == id);

                if (po == null)
                    return NotFound();

                return Ok(new PurchaseOrderDto
                {
                    Id = po.Id,
                    PoNumber = po.PoNumber,
                    SupplierName = po.SupplierName,
                    SupplierContact = po.SupplierContact,
                    SupplierEmail = po.SupplierEmail,
                    Description = po.Description,
                    Status = po.Status,
                    SubTotal = po.SubTotal,
                    VatAmount = po.VatAmount,
                    Total = po.Total,
                    Currency = po.Currency,
                    CategoryId = po.CategoryId,
                    CategoryName = po.Category?.Name,
                    Department = po.Department,
                    OrderDate = po.OrderDate,
                    ExpectedDeliveryDate = po.ExpectedDeliveryDate,
                    ReceivedDate = po.ReceivedDate,
                    RequestedBy = po.RequestedBy,
                    ApprovedBy = po.ApprovedBy,
                    ApprovedDate = po.ApprovedDate,
                    Notes = po.Notes,
                    DeliveryAddress = po.DeliveryAddress,
                    AttachmentPath = po.AttachmentPath,
                    AttachmentFileName = po.AttachmentFileName,
                    CreatedAt = po.CreatedAt,
                    UpdatedAt = po.UpdatedAt,
                    Items = po.Items.Select(i => new PurchaseOrderItemDto
                    {
                        Id = i.Id,
                        Description = i.Description,
                        ProductCode = i.ProductCode,
                        Quantity = i.Quantity,
                        Unit = i.Unit,
                        UnitPrice = i.UnitPrice,
                        LineTotal = i.LineTotal,
                        ReceivedQuantity = i.ReceivedQuantity
                    }).ToList()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving purchase order {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the purchase order");
            }
        }

        [HttpPost("purchase-orders")]
        public async Task<ActionResult<PurchaseOrderDto>> CreatePurchaseOrder(CreatePurchaseOrderDto dto)
        {
            try
            {
                var currentUser = GetCurrentUserEmail();

                var po = new PurchaseOrder
                {
                    PoNumber = dto.PoNumber,
                    SupplierName = dto.SupplierName,
                    SupplierContact = dto.SupplierContact,
                    SupplierEmail = dto.SupplierEmail,
                    Description = dto.Description,
                    Status = "Draft",
                    SubTotal = 0,
                    VatAmount = 0,
                    Total = 0,
                    Currency = dto.Currency,
                    CategoryId = dto.CategoryId,
                    Department = dto.Department,
                    OrderDate = DateTime.UtcNow,
                    ExpectedDeliveryDate = dto.ExpectedDeliveryDate,
                    RequestedBy = currentUser,
                    Notes = dto.Notes,
                    DeliveryAddress = dto.DeliveryAddress,
                    CreatedAt = DateTime.UtcNow
                };

                // Add items and calculate totals
                foreach (var itemDto in dto.Items)
                {
                    var lineTotal = itemDto.Quantity * itemDto.UnitPrice;
                    po.Items.Add(new PurchaseOrderItem
                    {
                        Description = itemDto.Description,
                        ProductCode = itemDto.ProductCode,
                        Quantity = itemDto.Quantity,
                        Unit = itemDto.Unit,
                        UnitPrice = itemDto.UnitPrice,
                        LineTotal = lineTotal,
                        ReceivedQuantity = 0
                    });
                    po.SubTotal += lineTotal;
                }

                po.VatAmount = po.SubTotal * 0.15m; // 15% VAT
                po.Total = po.SubTotal + po.VatAmount;

                _context.PurchaseOrders.Add(po);
                await _context.SaveChangesAsync();

                // Reload with includes
                var created = await _context.PurchaseOrders
                    .Include(p => p.Category)
                    .Include(p => p.Items)
                    .FirstAsync(p => p.Id == po.Id);

                var result = new PurchaseOrderDto
                {
                    Id = created.Id,
                    PoNumber = created.PoNumber,
                    SupplierName = created.SupplierName,
                    SupplierContact = created.SupplierContact,
                    SupplierEmail = created.SupplierEmail,
                    Description = created.Description,
                    Status = created.Status,
                    SubTotal = created.SubTotal,
                    VatAmount = created.VatAmount,
                    Total = created.Total,
                    Currency = created.Currency,
                    CategoryId = created.CategoryId,
                    CategoryName = created.Category?.Name,
                    Department = created.Department,
                    OrderDate = created.OrderDate,
                    ExpectedDeliveryDate = created.ExpectedDeliveryDate,
                    RequestedBy = created.RequestedBy,
                    Notes = created.Notes,
                    DeliveryAddress = created.DeliveryAddress,
                    CreatedAt = created.CreatedAt,
                    Items = created.Items.Select(i => new PurchaseOrderItemDto
                    {
                        Id = i.Id,
                        Description = i.Description,
                        ProductCode = i.ProductCode,
                        Quantity = i.Quantity,
                        Unit = i.Unit,
                        UnitPrice = i.UnitPrice,
                        LineTotal = i.LineTotal,
                        ReceivedQuantity = i.ReceivedQuantity
                    }).ToList()
                };

                return CreatedAtAction(nameof(GetPurchaseOrder), new { id = created.Id }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating purchase order");
                return StatusCode(500, "An error occurred while creating the purchase order");
            }
        }

        [HttpPut("purchase-orders/{id}")]
        public async Task<IActionResult> UpdatePurchaseOrder(int id, UpdatePurchaseOrderDto dto)
        {
            try
            {
                var po = await _context.PurchaseOrders.FindAsync(id);
                if (po == null)
                    return NotFound();

                if (!string.IsNullOrEmpty(dto.SupplierName))
                    po.SupplierName = dto.SupplierName;
                if (dto.SupplierContact != null)
                    po.SupplierContact = dto.SupplierContact;
                if (dto.SupplierEmail != null)
                    po.SupplierEmail = dto.SupplierEmail;
                if (dto.Description != null)
                    po.Description = dto.Description;
                if (!string.IsNullOrEmpty(dto.Status))
                    po.Status = dto.Status;
                if (dto.CategoryId.HasValue)
                    po.CategoryId = dto.CategoryId;
                if (dto.Department != null)
                    po.Department = dto.Department;
                if (dto.ExpectedDeliveryDate.HasValue)
                    po.ExpectedDeliveryDate = dto.ExpectedDeliveryDate;
                if (dto.ReceivedDate.HasValue)
                    po.ReceivedDate = dto.ReceivedDate;
                if (dto.Notes != null)
                    po.Notes = dto.Notes;
                if (dto.DeliveryAddress != null)
                    po.DeliveryAddress = dto.DeliveryAddress;

                po.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating purchase order {Id}", id);
                return StatusCode(500, "An error occurred while updating the purchase order");
            }
        }

        [HttpDelete("purchase-orders/{id}")]
        public async Task<IActionResult> DeletePurchaseOrder(int id)
        {
            try
            {
                var po = await _context.PurchaseOrders.FindAsync(id);
                if (po == null)
                    return NotFound();

                _context.PurchaseOrders.Remove(po);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting purchase order {Id}", id);
                return StatusCode(500, "An error occurred while deleting the purchase order");
            }
        }

        // ============================================================================
        // PAYMENTS
        // ============================================================================

        [HttpGet("payments")]
        public async Task<ActionResult<IEnumerable<PaymentDto>>> GetPayments(
            [FromQuery] string? status = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            try
            {
                var query = _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Expense)
                    .Include(p => p.PurchaseOrder)
                    .AsQueryable();

                if (!string.IsNullOrEmpty(status))
                    query = query.Where(p => p.Status == status);
                if (fromDate.HasValue)
                    query = query.Where(p => p.PaymentDate >= fromDate.Value);
                if (toDate.HasValue)
                    query = query.Where(p => p.PaymentDate <= toDate.Value);

                var payments = await query
                    .OrderByDescending(p => p.PaymentDate)
                    .Select(p => new PaymentDto
                    {
                        Id = p.Id,
                        PaymentNumber = p.PaymentNumber,
                        PaymentType = p.PaymentType,
                        ExpenseId = p.ExpenseId,
                        ExpenseNumber = p.Expense != null ? p.Expense.ExpenseNumber : null,
                        PurchaseOrderId = p.PurchaseOrderId,
                        PurchaseOrderNumber = p.PurchaseOrder != null ? p.PurchaseOrder.PoNumber : null,
                        BookInvoiceId = p.BookInvoiceId,
                        Payee = p.Payee,
                        Description = p.Description,
                        Amount = p.Amount,
                        Currency = p.Currency,
                        Status = p.Status,
                        PaymentMethod = p.PaymentMethod,
                        PaymentReference = p.PaymentReference,
                        BankReference = p.BankReference,
                        PaymentDate = p.PaymentDate,
                        ProcessedDate = p.ProcessedDate,
                        ProcessedBy = p.ProcessedBy,
                        ApprovedBy = p.ApprovedBy,
                        ApprovedDate = p.ApprovedDate,
                        BankName = p.BankName,
                        AccountNumber = p.AccountNumber,
                        BranchCode = p.BranchCode,
                        Notes = p.Notes,
                        ProofPath = p.ProofPath,
                        ProofFileName = p.ProofFileName,
                        CreatedAt = p.CreatedAt,
                        UpdatedAt = p.UpdatedAt
                    })
                    .ToListAsync();

                return Ok(payments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payments");
                return StatusCode(500, "An error occurred while retrieving payments");
            }
        }

        [HttpGet("payments/{id}")]
        public async Task<ActionResult<PaymentDto>> GetPayment(int id)
        {
            try
            {
                var payment = await _context.Payments
                    .AsNoTracking()
                    .Include(p => p.Expense)
                    .Include(p => p.PurchaseOrder)
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (payment == null)
                    return NotFound();

                return Ok(new PaymentDto
                {
                    Id = payment.Id,
                    PaymentNumber = payment.PaymentNumber,
                    PaymentType = payment.PaymentType,
                    ExpenseId = payment.ExpenseId,
                    ExpenseNumber = payment.Expense?.ExpenseNumber,
                    PurchaseOrderId = payment.PurchaseOrderId,
                    PurchaseOrderNumber = payment.PurchaseOrder?.PoNumber,
                    BookInvoiceId = payment.BookInvoiceId,
                    Payee = payment.Payee,
                    Description = payment.Description,
                    Amount = payment.Amount,
                    Currency = payment.Currency,
                    Status = payment.Status,
                    PaymentMethod = payment.PaymentMethod,
                    PaymentReference = payment.PaymentReference,
                    BankReference = payment.BankReference,
                    PaymentDate = payment.PaymentDate,
                    ProcessedDate = payment.ProcessedDate,
                    ProcessedBy = payment.ProcessedBy,
                    ApprovedBy = payment.ApprovedBy,
                    ApprovedDate = payment.ApprovedDate,
                    BankName = payment.BankName,
                    AccountNumber = payment.AccountNumber,
                    BranchCode = payment.BranchCode,
                    Notes = payment.Notes,
                    ProofPath = payment.ProofPath,
                    ProofFileName = payment.ProofFileName,
                    CreatedAt = payment.CreatedAt,
                    UpdatedAt = payment.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving payment {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the payment");
            }
        }

        [HttpPost("payments")]
        public async Task<ActionResult<PaymentDto>> CreatePayment(CreatePaymentDto dto)
        {
            try
            {
                var payment = new Payment
                {
                    PaymentNumber = dto.PaymentNumber,
                    PaymentType = dto.PaymentType,
                    ExpenseId = dto.ExpenseId,
                    PurchaseOrderId = dto.PurchaseOrderId,
                    BookInvoiceId = dto.BookInvoiceId,
                    Payee = dto.Payee,
                    Description = dto.Description,
                    Amount = dto.Amount,
                    Currency = dto.Currency,
                    Status = "Pending",
                    PaymentMethod = dto.PaymentMethod,
                    PaymentReference = dto.PaymentReference,
                    PaymentDate = dto.PaymentDate,
                    BankName = dto.BankName,
                    AccountNumber = dto.AccountNumber,
                    BranchCode = dto.BranchCode,
                    Notes = dto.Notes,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Payments.Add(payment);
                await _context.SaveChangesAsync();

                // Reload with includes
                var created = await _context.Payments
                    .Include(p => p.Expense)
                    .Include(p => p.PurchaseOrder)
                    .FirstAsync(p => p.Id == payment.Id);

                var result = new PaymentDto
                {
                    Id = created.Id,
                    PaymentNumber = created.PaymentNumber,
                    PaymentType = created.PaymentType,
                    ExpenseId = created.ExpenseId,
                    ExpenseNumber = created.Expense?.ExpenseNumber,
                    PurchaseOrderId = created.PurchaseOrderId,
                    PurchaseOrderNumber = created.PurchaseOrder?.PoNumber,
                    BookInvoiceId = created.BookInvoiceId,
                    Payee = created.Payee,
                    Description = created.Description,
                    Amount = created.Amount,
                    Currency = created.Currency,
                    Status = created.Status,
                    PaymentMethod = created.PaymentMethod,
                    PaymentReference = created.PaymentReference,
                    PaymentDate = created.PaymentDate,
                    BankName = created.BankName,
                    AccountNumber = created.AccountNumber,
                    BranchCode = created.BranchCode,
                    Notes = created.Notes,
                    CreatedAt = created.CreatedAt
                };

                return CreatedAtAction(nameof(GetPayment), new { id = created.Id }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating payment");
                return StatusCode(500, "An error occurred while creating the payment");
            }
        }

        [HttpPut("payments/{id}")]
        public async Task<IActionResult> UpdatePayment(int id, UpdatePaymentDto dto)
        {
            try
            {
                var payment = await _context.Payments.FindAsync(id);
                if (payment == null)
                    return NotFound();

                if (!string.IsNullOrEmpty(dto.Payee))
                    payment.Payee = dto.Payee;
                if (dto.Description != null)
                    payment.Description = dto.Description;
                if (dto.Amount.HasValue)
                    payment.Amount = dto.Amount.Value;
                if (!string.IsNullOrEmpty(dto.Status))
                    payment.Status = dto.Status;
                if (!string.IsNullOrEmpty(dto.PaymentMethod))
                    payment.PaymentMethod = dto.PaymentMethod;
                if (dto.PaymentReference != null)
                    payment.PaymentReference = dto.PaymentReference;
                if (dto.BankReference != null)
                    payment.BankReference = dto.BankReference;
                if (dto.PaymentDate.HasValue)
                    payment.PaymentDate = dto.PaymentDate.Value;
                if (dto.ProcessedDate.HasValue)
                    payment.ProcessedDate = dto.ProcessedDate;
                if (dto.BankName != null)
                    payment.BankName = dto.BankName;
                if (dto.AccountNumber != null)
                    payment.AccountNumber = dto.AccountNumber;
                if (dto.BranchCode != null)
                    payment.BranchCode = dto.BranchCode;
                if (dto.Notes != null)
                    payment.Notes = dto.Notes;

                payment.UpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating payment {Id}", id);
                return StatusCode(500, "An error occurred while updating the payment");
            }
        }

        [HttpDelete("payments/{id}")]
        public async Task<IActionResult> DeletePayment(int id)
        {
            try
            {
                var payment = await _context.Payments.FindAsync(id);
                if (payment == null)
                    return NotFound();

                _context.Payments.Remove(payment);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting payment {Id}", id);
                return StatusCode(500, "An error occurred while deleting the payment");
            }
        }
    }
}
