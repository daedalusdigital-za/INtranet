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
    [Route("api/logistics/sales-tripsheets")]
    public class SalesTripSheetsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<SalesTripSheetsController> _logger;
        private readonly INotificationBroadcaster _notifier;

        public SalesTripSheetsController(ApplicationDbContext context, ILogger<SalesTripSheetsController> logger, INotificationBroadcaster notifier)
        {
            _context = context;
            _logger = logger;
            _notifier = notifier;
        }

        private int? GetCurrentUserId()
        {
            var claim = User.FindFirst("UserId")?.Value ?? User.FindFirst("sub")?.Value;
            return int.TryParse(claim, out var id) ? id : (int?)null;
        }

        private async Task<string?> GetUserNameAsync(int userId)
        {
            var u = await _context.Users
                .Where(x => x.UserId == userId)
                .Select(x => new { x.Name, x.Surname })
                .FirstOrDefaultAsync();
            return u == null ? null : $"{u.Name} {u.Surname}".Trim();
        }

        // GET: api/logistics/sales-tripsheets?status=PendingApproval
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SalesTripSheetDto>>> GetAll([FromQuery] string? status = null)
        {
            var query = _context.SalesTripSheets
                .Include(t => t.Lines)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(status) && status != "all")
                query = query.Where(t => t.Status == status);

            var sheets = await query
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return Ok(sheets.Select(MapToDto).ToList());
        }

        // GET: api/logistics/sales-tripsheets/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SalesTripSheetDto>> GetOne(int id)
        {
            var sheet = await _context.SalesTripSheets
                .Include(t => t.Lines)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (sheet == null) return NotFound(new { error = "Trip sheet not found" });
            return Ok(MapToDto(sheet));
        }

        // GET: api/logistics/sales-tripsheets/lookup-invoice/{invoiceNumber}
        // Auto-fills customer name, delivery address, product/commodity, qty and value from an imported invoice.
        [HttpGet("lookup-invoice/{invoiceNumber}")]
        public async Task<ActionResult<InvoiceLookupResultDto>> LookupInvoice(string invoiceNumber)
        {
            if (string.IsNullOrWhiteSpace(invoiceNumber))
                return BadRequest(new { error = "Invoice number is required" });

            var key = invoiceNumber.Trim();
            var lines = await _context.ImportedInvoices
                .Where(i => i.TransactionNumber == key)
                .OrderBy(i => i.ProductDescription)
                .ToListAsync();

            if (lines.Count == 0)
            {
                // Try a looser contains match to be forgiving of prefixes/whitespace
                lines = await _context.ImportedInvoices
                    .Where(i => i.TransactionNumber.Contains(key))
                    .OrderBy(i => i.TransactionNumber)
                    .ThenBy(i => i.ProductDescription)
                    .Take(50)
                    .ToListAsync();
            }

            if (lines.Count == 0)
                return Ok(new InvoiceLookupResultDto { Found = false, InvoiceNumber = key });

            var first = lines[0];
            return Ok(new InvoiceLookupResultDto
            {
                Found = true,
                InvoiceNumber = first.TransactionNumber,
                CustomerName = first.CustomerName,
                Address = first.DeliveryAddress,
                City = first.DeliveryCity,
                Province = first.DeliveryProvince,
                ContactPerson = first.ContactPerson,
                ContactPhone = first.ContactPhone,
                Lines = lines.Select(i => new SalesTripSheetLineDto
                {
                    CustomerName = i.CustomerName,
                    InvoiceNumber = i.TransactionNumber,
                    Address = i.DeliveryAddress,
                    City = i.DeliveryCity,
                    Province = i.DeliveryProvince,
                    ContactPerson = i.ContactPerson,
                    ContactPhone = i.ContactPhone,
                    ProductDescription = i.ProductDescription,
                    Quantity = i.Quantity,
                    Value = i.SalesAmount - i.SalesReturns
                }).ToList()
            });
        }

        // POST: api/logistics/sales-tripsheets  (Stage 1 - create)
        [HttpPost]
        public async Task<ActionResult<SalesTripSheetDto>> Create([FromBody] SaveSalesTripSheetDto dto)
        {
            if (dto.Lines == null || dto.Lines.Count == 0)
                return BadRequest(new { error = "A trip sheet must have at least one delivery line." });

            var userId = GetCurrentUserId();
            var userName = userId.HasValue ? await GetUserNameAsync(userId.Value) : null;

            // Generate STS-XXXXXX
            var last = await _context.SalesTripSheets.OrderByDescending(t => t.Id).FirstOrDefaultAsync();
            int next = 1;
            if (last != null && !string.IsNullOrEmpty(last.TripSheetNumber) && last.TripSheetNumber.StartsWith("STS-"))
            {
                if (int.TryParse(last.TripSheetNumber.Substring(4), out int num)) next = num + 1;
                else next = last.Id + 1;
            }
            else if (last != null)
            {
                next = last.Id + 1;
            }

            var sheet = new SalesTripSheet
            {
                TripSheetNumber = $"STS-{next:D6}",
                Status = dto.SendToSign ? "PendingSignature" : "PendingApproval",
                WarehouseCode = dto.WarehouseCode,
                WarehouseId = dto.WarehouseId,
                RouteArea = dto.RouteArea,
                ScheduledDate = dto.ScheduledDate,
                Notes = dto.Notes,
                CreatedByUserId = userId,
                CreatedByName = dto.CreatedByName ?? userName,
                SignerUserId = dto.SignerUserId ?? userId,
                SignerName = dto.SignerName ?? dto.CreatedByName ?? userName,
                ApproverUserId = dto.ApproverUserId,
                ApproverName = dto.ApproverName,
                CreatedAt = DateTime.UtcNow
            };

            int seq = 1;
            foreach (var l in dto.Lines)
            {
                sheet.Lines.Add(new SalesTripSheetLine
                {
                    Sequence = seq++,
                    CustomerName = l.CustomerName,
                    InvoiceNumber = l.InvoiceNumber,
                    Address = l.Address,
                    City = l.City,
                    Province = l.Province,
                    ContactPerson = l.ContactPerson,
                    ContactPhone = l.ContactPhone,
                    ProductDescription = l.ProductDescription,
                    Quantity = l.Quantity,
                    Value = l.Value
                });
            }

            _context.SalesTripSheets.Add(sheet);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Sales trip sheet {Number} created by user {UserId} with status {Status}", sheet.TripSheetNumber, userId, sheet.Status);

            // Route a notification to whoever needs to action it next.
            await NotifyNextActionAsync(sheet);

            return Ok(MapToDto(sheet));
        }

        // Notify the person who must action the sheet next: the signer (PendingSignature)
        // or the approver (PendingApproval).
        private async Task NotifyNextActionAsync(SalesTripSheet sheet)
        {
            try
            {
                int? recipient = null;
                string title, body, url = "/sales";
                if (sheet.Status == "PendingSignature" && sheet.SignerUserId.HasValue)
                {
                    recipient = sheet.SignerUserId.Value;
                    title = "Trip sheet to sign";
                    body = $"Trip sheet {sheet.TripSheetNumber} from {sheet.CreatedByName ?? "a colleague"} needs your signature before it goes for approval.";
                }
                else if (sheet.Status == "PendingApproval" && sheet.ApproverUserId.HasValue)
                {
                    recipient = sheet.ApproverUserId.Value;
                    title = "Trip sheet awaiting approval";
                    body = $"Trip sheet {sheet.TripSheetNumber} is awaiting your approval.";
                }
                else return;

                if (recipient.HasValue && recipient.Value > 0)
                {
                    await _notifier.NotifyUsersAsync(new List<int> { recipient.Value }, new NotificationPayload
                    {
                        Type = "info",
                        Title = title,
                        Body = body,
                        Url = url,
                        Timestamp = DateTime.UtcNow
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send next-action notification for sales trip sheet {Id}", sheet.Id);
            }
        }

        // POST: api/logistics/sales-tripsheets/5/sign  (Stage 1b - the designated signer signs it)
        [HttpPost("{id}/sign")]
        public async Task<ActionResult<SalesTripSheetDto>> Sign(int id, [FromBody] SignSalesTripSheetDto? dto)
        {
            var sheet = await _context.SalesTripSheets.Include(t => t.Lines).FirstOrDefaultAsync(t => t.Id == id);
            if (sheet == null) return NotFound(new { error = "Trip sheet not found" });
            if (sheet.Status != "PendingSignature")
                return BadRequest(new { error = $"Only trip sheets awaiting signature can be signed. This one is {sheet.Status}." });

            var userId = GetCurrentUserId();
            var userName = userId.HasValue ? await GetUserNameAsync(userId.Value) : null;

            // If a specific signer was designated, only they may sign
            if (sheet.SignerUserId.HasValue && userId.HasValue && sheet.SignerUserId.Value != userId.Value)
                return BadRequest(new { error = $"Only the designated signer ({sheet.SignerName}) may sign this trip sheet." });

            sheet.SignedByUserId = userId;
            sheet.SignedByName = dto?.SignedByName ?? userName ?? sheet.SignerName;
            sheet.SignedAt = DateTime.UtcNow;
            sheet.Status = "PendingApproval";
            sheet.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Sales trip sheet {Number} signed by user {UserId}; now awaiting approval", sheet.TripSheetNumber, userId);

            // Now notify the approver.
            await NotifyNextActionAsync(sheet);

            return Ok(MapToDto(sheet));
        }

        // PUT: api/logistics/sales-tripsheets/5  (edit while still pending)
        [HttpPut("{id}")]
        public async Task<ActionResult<SalesTripSheetDto>> Update(int id, [FromBody] SaveSalesTripSheetDto dto)
        {
            var sheet = await _context.SalesTripSheets.Include(t => t.Lines).FirstOrDefaultAsync(t => t.Id == id);
            if (sheet == null) return NotFound(new { error = "Trip sheet not found" });
            if (sheet.Status != "PendingApproval" && sheet.Status != "PendingSignature")
                return BadRequest(new { error = "Only trip sheets awaiting signature or approval can be edited." });

            sheet.WarehouseCode = dto.WarehouseCode;
            sheet.WarehouseId = dto.WarehouseId;
            sheet.RouteArea = dto.RouteArea;
            sheet.ScheduledDate = dto.ScheduledDate;
            sheet.Notes = dto.Notes;
            if (dto.SignerUserId.HasValue) sheet.SignerUserId = dto.SignerUserId;
            if (dto.SignerName != null) sheet.SignerName = dto.SignerName;
            if (dto.ApproverUserId.HasValue) sheet.ApproverUserId = dto.ApproverUserId;
            if (dto.ApproverName != null) sheet.ApproverName = dto.ApproverName;
            sheet.UpdatedAt = DateTime.UtcNow;

            // Replace lines
            _context.SalesTripSheetLines.RemoveRange(sheet.Lines);
            sheet.Lines.Clear();
            int seq = 1;
            foreach (var l in dto.Lines ?? new List<SalesTripSheetLineDto>())
            {
                sheet.Lines.Add(new SalesTripSheetLine
                {
                    Sequence = seq++,
                    CustomerName = l.CustomerName,
                    InvoiceNumber = l.InvoiceNumber,
                    Address = l.Address,
                    City = l.City,
                    Province = l.Province,
                    ContactPerson = l.ContactPerson,
                    ContactPhone = l.ContactPhone,
                    ProductDescription = l.ProductDescription,
                    Quantity = l.Quantity,
                    Value = l.Value
                });
            }

            await _context.SaveChangesAsync();
            return Ok(MapToDto(sheet));
        }

        // POST: api/logistics/sales-tripsheets/5/approve  (Stage 2 - check & sign by a DIFFERENT agent)
        [HttpPost("{id}/approve")]
        public async Task<ActionResult<SalesTripSheetDto>> Approve(int id, [FromBody] ApproveSalesTripSheetDto? dto)
        {
            var sheet = await _context.SalesTripSheets.Include(t => t.Lines).FirstOrDefaultAsync(t => t.Id == id);
            if (sheet == null) return NotFound(new { error = "Trip sheet not found" });
            if (sheet.Status != "PendingApproval")
                return BadRequest(new { error = $"Trip sheet is already {sheet.Status}." });

            var userId = GetCurrentUserId();
            var userName = userId.HasValue ? await GetUserNameAsync(userId.Value) : null;

            // Enforce two-person rule: the approver must be a different agent than the creator
            if (userId.HasValue && sheet.CreatedByUserId.HasValue && userId.Value == sheet.CreatedByUserId.Value)
                return BadRequest(new { error = "A trip sheet must be checked and approved by a different sales agent than the one who created it." });

            // If a specific approver was designated, only they may approve
            if (sheet.ApproverUserId.HasValue && userId.HasValue && sheet.ApproverUserId.Value != userId.Value)
                return BadRequest(new { error = $"Only the designated approver ({sheet.ApproverName}) may check and sign this trip sheet." });

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                sheet.Status = "Approved";
                sheet.CheckedByUserId = userId;
                sheet.CheckedByName = dto?.CheckedByName ?? userName;
                sheet.CheckedAt = DateTime.UtcNow;
                sheet.ApprovalNotes = dto?.ApprovalNotes;
                sheet.UpdatedAt = DateTime.UtcNow;

                // Push into logistics: create a Load + stops so it appears in the logistics Tripsheets tab
                var load = await CreateLoadFromSheetAsync(sheet);
                sheet.ConvertedLoadId = load.Id;
                sheet.ConvertedLoadNumber = load.LoadNumber;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("Sales trip sheet {Number} approved by user {UserId}; created Load {LoadNumber}",
                    sheet.TripSheetNumber, userId, load.LoadNumber);

                // Notify everyone involved that the trip sheet is approved & the load generated.
                await NotifyTripSheetApprovedAsync(sheet, load.LoadNumber);

                return Ok(MapToDto(sheet));
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Failed to approve sales trip sheet {Id}", id);
                return StatusCode(500, new { error = "Failed to approve trip sheet", details = ex.Message });
            }
        }

        // Notify the creator, signer and approver that the trip sheet is approved and the load is generated.
        private async Task NotifyTripSheetApprovedAsync(SalesTripSheet sheet, string loadNumber)
        {
            try
            {
                var recipientIds = new List<int>();
                if (sheet.CreatedByUserId.HasValue) recipientIds.Add(sheet.CreatedByUserId.Value);
                if (sheet.SignerUserId.HasValue) recipientIds.Add(sheet.SignerUserId.Value);
                if (sheet.ApproverUserId.HasValue) recipientIds.Add(sheet.ApproverUserId.Value);
                if (sheet.CheckedByUserId.HasValue) recipientIds.Add(sheet.CheckedByUserId.Value);

                var distinct = recipientIds.Where(x => x > 0).Distinct().ToList();
                if (distinct.Count == 0) return;

                var payload = new NotificationPayload
                {
                    Type = "info",
                    Title = "Trip sheet approved",
                    Body = $"Trip sheet {sheet.TripSheetNumber} was approved by {sheet.CheckedByName ?? "an approver"} and Logistics load {loadNumber} has been generated.",
                    Url = "/logistics",
                    Timestamp = DateTime.UtcNow
                };

                await _notifier.NotifyUsersAsync(distinct, payload);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send approval notifications for sales trip sheet {Id}", sheet.Id);
            }
        }

        // POST: api/logistics/sales-tripsheets/5/reject
        [HttpPost("{id}/reject")]
        public async Task<ActionResult<SalesTripSheetDto>> Reject(int id, [FromBody] RejectSalesTripSheetDto? dto)
        {
            var sheet = await _context.SalesTripSheets.Include(t => t.Lines).FirstOrDefaultAsync(t => t.Id == id);
            if (sheet == null) return NotFound(new { error = "Trip sheet not found" });
            if (sheet.Status != "PendingApproval" && sheet.Status != "PendingSignature")
                return BadRequest(new { error = $"Trip sheet is already {sheet.Status}." });

            var userId = GetCurrentUserId();
            var userName = userId.HasValue ? await GetUserNameAsync(userId.Value) : null;

            sheet.Status = "Rejected";
            sheet.CheckedByUserId = userId;
            sheet.CheckedByName = userName;
            sheet.CheckedAt = DateTime.UtcNow;
            sheet.RejectionReason = dto?.Reason;
            sheet.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Notify the creator/signer that their trip sheet was rejected.
            try
            {
                var recipientIds = new List<int>();
                if (sheet.CreatedByUserId.HasValue) recipientIds.Add(sheet.CreatedByUserId.Value);
                if (sheet.SignerUserId.HasValue) recipientIds.Add(sheet.SignerUserId.Value);
                var distinct = recipientIds.Where(x => x > 0).Distinct().ToList();
                if (distinct.Count > 0)
                {
                    await _notifier.NotifyUsersAsync(distinct, new NotificationPayload
                    {
                        Type = "info",
                        Title = "Trip sheet rejected",
                        Body = $"Trip sheet {sheet.TripSheetNumber} was rejected by {userName ?? "an approver"}." +
                               (string.IsNullOrWhiteSpace(sheet.RejectionReason) ? "" : $" Reason: {sheet.RejectionReason}"),
                        Url = "/sales",
                        Timestamp = DateTime.UtcNow
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send rejection notifications for sales trip sheet {Id}", sheet.Id);
            }

            return Ok(MapToDto(sheet));
        }

        // DELETE: api/logistics/sales-tripsheets/5
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            var sheet = await _context.SalesTripSheets.Include(t => t.Lines).FirstOrDefaultAsync(t => t.Id == id);
            if (sheet == null) return NotFound(new { error = "Trip sheet not found" });
            if (sheet.Status == "Approved")
                return BadRequest(new { error = "Approved trip sheets cannot be deleted." });

            _context.SalesTripSheetLines.RemoveRange(sheet.Lines);
            _context.SalesTripSheets.Remove(sheet);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        private async Task<Load> CreateLoadFromSheetAsync(SalesTripSheet sheet)
        {
            // Generate a logistics load number (RF-XXXXXX) consistent with the logistics module
            var lastLoad = await _context.Loads.OrderByDescending(l => l.Id).FirstOrDefaultAsync();
            int nextNumber = 1;
            if (lastLoad != null && !string.IsNullOrEmpty(lastLoad.LoadNumber))
            {
                var cur = lastLoad.LoadNumber;
                if ((cur.StartsWith("RF-") || cur.StartsWith("LD-")) && cur.Length == 9 && int.TryParse(cur.Substring(3), out int num))
                    nextNumber = num + 1;
                else
                    nextNumber = lastLoad.Id + 1;
            }
            var loadNumber = $"RF-{nextNumber:D6}";

            var load = new Load
            {
                LoadNumber = loadNumber,
                Status = "Pending",
                Priority = "Normal",
                WarehouseId = sheet.WarehouseId,
                ScheduledPickupDate = sheet.ScheduledDate ?? DateTime.Today,
                Notes = string.IsNullOrWhiteSpace(sheet.Notes)
                    ? $"From sales trip sheet {sheet.TripSheetNumber}"
                    : $"{sheet.Notes} (Sales trip sheet {sheet.TripSheetNumber})",
                CreatedByUserId = sheet.CreatedByUserId,
                CreatedAt = DateTime.UtcNow
            };
            _context.Loads.Add(load);
            await _context.SaveChangesAsync();

            int seq = 1;
            foreach (var line in sheet.Lines.OrderBy(l => l.Sequence))
            {
                _context.LoadStops.Add(new LoadStop
                {
                    LoadId = load.Id,
                    StopSequence = seq++,
                    StopType = "Delivery",
                    CompanyName = line.CustomerName,
                    Address = string.IsNullOrWhiteSpace(line.Address) ? (line.CustomerName ?? "") : line.Address,
                    City = line.City ?? "",
                    Province = line.Province ?? "",
                    ContactPerson = line.ContactPerson,
                    ContactPhone = line.ContactPhone,
                    InvoiceNumber = line.InvoiceNumber,
                    Status = "Pending"
                });
            }
            await _context.SaveChangesAsync();

            // Assign the matching ImportedInvoices to this load so the tripsheet shows
            // its invoices AND so PODs sharing those invoices can be linked.
            var lineInvoiceNumbers = sheet.Lines
                .Select(l => l.InvoiceNumber)
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Select(n => n!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (lineInvoiceNumbers.Count > 0)
            {
                var matchingInvoices = await _context.ImportedInvoices
                    .Where(i => i.LoadId == null && lineInvoiceNumbers.Contains(i.TransactionNumber))
                    .ToListAsync();
                foreach (var inv in matchingInvoices)
                {
                    inv.LoadId = load.Id;
                    inv.Status = "Assigned";
                    inv.UpdatedAt = DateTime.UtcNow;
                }
                if (matchingInvoices.Count > 0)
                    await _context.SaveChangesAsync();
            }

            // Retroactively link any existing PODs whose invoices are on this tripsheet.
            await PodTripsheetLinker.LinkForLoadsAsync(_context, new[] { load.Id });

            return load;
        }

        private static SalesTripSheetDto MapToDto(SalesTripSheet t) => new SalesTripSheetDto
        {
            Id = t.Id,
            TripSheetNumber = t.TripSheetNumber,
            Status = t.Status,
            WarehouseCode = t.WarehouseCode,
            WarehouseId = t.WarehouseId,
            RouteArea = t.RouteArea,
            ScheduledDate = t.ScheduledDate,
            Notes = t.Notes,
            CreatedByUserId = t.CreatedByUserId,
            CreatedByName = t.CreatedByName,
            SignerUserId = t.SignerUserId,
            SignerName = t.SignerName,
            ApproverUserId = t.ApproverUserId,
            ApproverName = t.ApproverName,
            CreatedAt = t.CreatedAt,
            SignedByUserId = t.SignedByUserId,
            SignedByName = t.SignedByName,
            SignedAt = t.SignedAt,
            CheckedByUserId = t.CheckedByUserId,
            CheckedByName = t.CheckedByName,
            CheckedAt = t.CheckedAt,
            ApprovalNotes = t.ApprovalNotes,
            RejectionReason = t.RejectionReason,
            ConvertedLoadId = t.ConvertedLoadId,
            ConvertedLoadNumber = t.ConvertedLoadNumber,
            TotalValue = t.Lines.Sum(l => l.Value),
            Lines = t.Lines.OrderBy(l => l.Sequence).Select(l => new SalesTripSheetLineDto
            {
                CustomerName = l.CustomerName,
                InvoiceNumber = l.InvoiceNumber,
                Address = l.Address,
                City = l.City,
                Province = l.Province,
                ContactPerson = l.ContactPerson,
                ContactPhone = l.ContactPhone,
                ProductDescription = l.ProductDescription,
                Quantity = l.Quantity,
                Value = l.Value
            }).ToList()
        };
    }

    // ---------- DTOs ----------

    public class SalesTripSheetDto
    {
        public int Id { get; set; }
        public string TripSheetNumber { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? WarehouseCode { get; set; }
        public int? WarehouseId { get; set; }
        public string? RouteArea { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public string? Notes { get; set; }
        public int? CreatedByUserId { get; set; }
        public string? CreatedByName { get; set; }
        public int? SignerUserId { get; set; }
        public string? SignerName { get; set; }
        public int? ApproverUserId { get; set; }
        public string? ApproverName { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? SignedByUserId { get; set; }
        public string? SignedByName { get; set; }
        public DateTime? SignedAt { get; set; }
        public int? CheckedByUserId { get; set; }
        public string? CheckedByName { get; set; }
        public DateTime? CheckedAt { get; set; }
        public string? ApprovalNotes { get; set; }
        public string? RejectionReason { get; set; }
        public int? ConvertedLoadId { get; set; }
        public string? ConvertedLoadNumber { get; set; }
        public decimal TotalValue { get; set; }
        public List<SalesTripSheetLineDto> Lines { get; set; } = new();
    }

    public class SaveSalesTripSheetDto
    {
        public string? WarehouseCode { get; set; }
        public int? WarehouseId { get; set; }
        public string? RouteArea { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public string? Notes { get; set; }
        public string? CreatedByName { get; set; }
        public int? SignerUserId { get; set; }
        public string? SignerName { get; set; }
        public int? ApproverUserId { get; set; }
        public string? ApproverName { get; set; }
        // When true the sheet is created as PendingSignature and routed to the signer first;
        // otherwise it goes straight to PendingApproval.
        public bool SendToSign { get; set; }
        public List<SalesTripSheetLineDto> Lines { get; set; } = new();
    }

    public class SalesTripSheetLineDto
    {
        public string? CustomerName { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public string? ProductDescription { get; set; }
        public decimal Quantity { get; set; }
        public decimal Value { get; set; }
    }

    public class ApproveSalesTripSheetDto
    {
        public string? CheckedByName { get; set; }
        public string? ApprovalNotes { get; set; }
    }

    public class RejectSalesTripSheetDto
    {
        public string? Reason { get; set; }
    }

    public class SignSalesTripSheetDto
    {
        public string? SignedByName { get; set; }
    }

    public class InvoiceLookupResultDto
    {
        public bool Found { get; set; }
        public string InvoiceNumber { get; set; } = string.Empty;
        public string? CustomerName { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? Province { get; set; }
        public string? ContactPerson { get; set; }
        public string? ContactPhone { get; set; }
        public List<SalesTripSheetLineDto> Lines { get; set; } = new();
    }
}