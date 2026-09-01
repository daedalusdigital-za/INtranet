using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Requisitions;
using ProjectTracker.API.Services.Signatures;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Requisitions
{
    /// <summary>
    /// Creditor/supplier requisition-invoice approval workflow with electronic
    /// signatures. Role-driven (not person-driven): each stage is actioned by
    /// whoever holds the stage's role. Every action is recorded as an append-only
    /// approval step and, where required, an electronic signature.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/requisition-invoices")]
    public class RequisitionInvoicesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ISignatureService _signatures;
        private readonly ILogger<RequisitionInvoicesController> _logger;

        public RequisitionInvoicesController(
            ApplicationDbContext context,
            ISignatureService signatures,
            ILogger<RequisitionInvoicesController> logger)
        {
            _context = context;
            _signatures = signatures;
            _logger = logger;
        }

        // ---------- Identity helpers ----------
        private int? CurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out var id) ? id : (int?)null;
        }

        private string CurrentUserName() =>
            User.FindFirst("name")?.Value
            ?? User.Identity?.Name
            ?? User.FindFirst(ClaimTypes.Name)?.Value
            ?? "Unknown";

        /// <summary>Does the current user hold the given workflow role? Admins always do.</summary>
        private async Task<bool> HasWorkflowRole(string workflowRole)
        {
            var uid = CurrentUserId();
            if (uid == null) return false;
            var user = await _context.Users
                .Where(u => u.UserId == uid.Value)
                .Select(u => new { u.Role, u.Permissions })
                .FirstOrDefaultAsync();
            if (user == null) return false;
            if (string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase)) return true;
            var perms = (user.Permissions ?? "")
                .Split(new[] { ',', ';', '|' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return perms.Any(p => string.Equals(p, workflowRole, StringComparison.OrdinalIgnoreCase));
        }

        private string? Ip() => HttpContext.Connection.RemoteIpAddress?.ToString();
        private string? Ua() => Request.Headers.UserAgent.ToString();

        // ============================================================
        //  Reads
        // ============================================================

        [HttpGet]
        public async Task<IActionResult> List(
            [FromQuery] string? stage = null,
            [FromQuery] string? state = null,
            [FromQuery] string? search = null,
            [FromQuery] bool mine = false)
        {
            var q = _context.RequisitionInvoices.AsQueryable();
            if (!string.IsNullOrWhiteSpace(stage) && stage != "all") q = q.Where(r => r.Stage == stage);
            if (!string.IsNullOrWhiteSpace(state) && state != "all") q = q.Where(r => r.State == state);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.ToLower();
                q = q.Where(r =>
                    (r.ReferenceNumber != null && r.ReferenceNumber.ToLower().Contains(s)) ||
                    (r.SupplierName != null && r.SupplierName.ToLower().Contains(s)) ||
                    (r.InvoiceNumber != null && r.InvoiceNumber.ToLower().Contains(s)) ||
                    (r.Sage300Reference != null && r.Sage300Reference.ToLower().Contains(s)));
            }

            var rows = await q.OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt).ToListAsync();

            // "mine" = items currently sitting at a stage the caller can action.
            if (mine)
            {
                var actionable = new List<RequisitionInvoice>();
                foreach (var r in rows)
                {
                    var def = RequisitionWorkflow.Get(r.Stage);
                    if (r.State == "Active" && def?.ActingRole != null && await HasWorkflowRole(def.ActingRole))
                        actionable.Add(r);
                }
                rows = actionable;
            }

            return Ok(rows.Select(ToListDto));
        }

        [HttpGet("workflow")]
        [AllowAnonymous]
        public IActionResult GetWorkflow() => Ok(new
        {
            stages = RequisitionWorkflow.OrderedStages.Select(s =>
            {
                var d = RequisitionWorkflow.Get(s)!;
                return new
                {
                    stage = d.Stage,
                    title = d.Title,
                    actingRole = d.ActingRole,
                    forwardAction = d.ForwardAction,
                    nextStage = d.NextStage,
                    requiresSignature = d.RequiresSignature,
                    canReturn = d.CanReturn
                };
            }),
            states = new[] { "Active", "OnHold", "Returned", "Rejected", "Cancelled", "Paid", "Closed" }
        });

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var r = await _context.RequisitionInvoices
                .Include(x => x.ApprovalSteps)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (r == null) return NotFound();

            var signatures = await _signatures.GetForEntityAsync("RequisitionInvoice", id);
            var def = RequisitionWorkflow.Get(r.Stage);

            return Ok(new
            {
                invoice = ToDetailDto(r),
                stageIndex = RequisitionWorkflow.StageIndex(r.Stage),
                canActNow = r.State == "Active" && def?.ActingRole != null && await HasWorkflowRole(def.ActingRole),
                forwardAction = def?.ForwardAction,
                requiresSignature = def?.RequiresSignature ?? false,
                canReturn = def?.CanReturn ?? false,
                history = r.ApprovalSteps.OrderBy(s => s.CreatedAt).Select(s => new
                {
                    s.Id, s.FromStage, s.ToStage, s.Action, s.Comment,
                    s.ActorName, s.ActorRole, s.SignatureId, s.CreatedAt
                }),
                signatures = signatures.Select(s => new
                {
                    s.Id, s.SignerName, s.SignerRole, s.Action, s.Comment,
                    s.Method, s.ReAuthenticated, s.PayloadHash, s.Context, s.SignedAtUtc
                })
            });
        }

        // ============================================================
        //  Create / edit draft
        // ============================================================

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] RequisitionInvoiceUpsertDto dto)
        {
            var r = new RequisitionInvoice
            {
                Stage = RequisitionWorkflow.Draft,
                State = "Active",
                CreatedByUserId = CurrentUserId(),
                CreatedByName = CurrentUserName(),
                CreatedAt = DateTime.UtcNow,
                StageEnteredAt = DateTime.UtcNow
            };
            ApplyUpsert(r, dto);

            _context.RequisitionInvoices.Add(r);
            await _context.SaveChangesAsync();

            // Assign a friendly reference now that we have an Id.
            r.ReferenceNumber = $"REQ-{DateTime.UtcNow:yyyy}-{r.Id:D4}";
            await _context.SaveChangesAsync();

            AddStep(r, RequisitionWorkflow.Draft, RequisitionWorkflow.Draft, "Create", "Invoice captured");
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(Get), new { id = r.Id }, ToDetailDto(r));
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] RequisitionInvoiceUpsertDto dto)
        {
            var r = await _context.RequisitionInvoices.FindAsync(id);
            if (r == null) return NotFound();
            if (r.Stage != RequisitionWorkflow.Draft && r.State != "Returned")
                return BadRequest(new { error = "Only draft or returned invoices can be edited." });

            ApplyUpsert(r, dto);
            r.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return Ok(ToDetailDto(r));
        }

        // ============================================================
        //  Workflow actions
        // ============================================================

        /// <summary>Advance to the next stage (forward action). Captures a signature when required.</summary>
        [HttpPost("{id}/advance")]
        public async Task<IActionResult> Advance(int id, [FromBody] WorkflowActionDto dto)
        {
            var r = await _context.RequisitionInvoices.FindAsync(id);
            if (r == null) return NotFound();
            if (r.State is "Rejected" or "Cancelled" or "Closed")
                return BadRequest(new { error = $"Invoice is {r.State} and cannot be advanced." });

            var def = RequisitionWorkflow.Get(r.Stage);
            if (def?.NextStage == null)
                return BadRequest(new { error = "No forward transition from the current stage." });

            if (def.ActingRole != null && !await HasWorkflowRole(def.ActingRole))
                return Forbid();

            // Payment step needs payment details.
            if (r.Stage == RequisitionWorkflow.AwaitingNashPayment)
            {
                if (string.IsNullOrWhiteSpace(dto.PaymentReference))
                    return BadRequest(new { error = "Payment reference is required to record payment." });
                r.PaymentReference = dto.PaymentReference?.Trim();
                r.PaymentMethod = dto.PaymentMethod?.Trim();
                r.PaidDate = DateTime.UtcNow;
            }

            int? signatureId = null;
            if (def.RequiresSignature)
            {
                var sig = await _signatures.SignAsync(new SignatureRequest
                {
                    EntityType = "RequisitionInvoice",
                    EntityId = r.Id,
                    Context = r.Stage,
                    SignerUserId = CurrentUserId() ?? 0,
                    SignerName = CurrentUserName(),
                    SignerRole = def.ActingRole,
                    Action = "Approve",
                    Comment = dto.Comment,
                    Method = dto.SignatureMethod ?? "Click",
                    ReAuthenticated = dto.ReAuthenticated,
                    SignatureImage = string.IsNullOrEmpty(dto.SignatureImageBase64) ? null : Convert.FromBase64String(StripDataUrl(dto.SignatureImageBase64)),
                    SignatureImageMimeType = dto.SignatureImageMimeType,
                    IpAddress = Ip(),
                    UserAgent = Ua(),
                    Payload = SignaturePayload(r)
                });
                signatureId = sig.Id;
            }

            var from = r.Stage;
            r.Stage = def.NextStage;
            r.State = def.NextStage == RequisitionWorkflow.Paid ? "Paid" : "Active";
            r.StageEnteredAt = DateTime.UtcNow;
            r.UpdatedAt = DateTime.UtcNow;
            r.ResumeStage = null;

            AddStep(r, from, r.Stage, def.ForwardAction, dto.Comment, def.ActingRole, signatureId);
            await _context.SaveChangesAsync();

            return Ok(ToDetailDto(r));
        }

        /// <summary>Send back for correction to an earlier stage (default: previous stage).</summary>
        [HttpPost("{id}/return")]
        public async Task<IActionResult> ReturnForCorrection(int id, [FromBody] WorkflowActionDto dto)
        {
            var r = await _context.RequisitionInvoices.FindAsync(id);
            if (r == null) return NotFound();

            var def = RequisitionWorkflow.Get(r.Stage);
            if (def == null || !def.CanReturn)
                return BadRequest(new { error = "This stage cannot be returned." });
            if (def.ActingRole != null && !await HasWorkflowRole(def.ActingRole))
                return Forbid();
            if (string.IsNullOrWhiteSpace(dto.Comment))
                return BadRequest(new { error = "A reason is required when returning for correction." });

            var from = r.Stage;
            // Return target: an explicit stage if valid & earlier, else the previous stage.
            var idx = RequisitionWorkflow.StageIndex(from);
            var target = RequisitionWorkflow.Draft;
            if (!string.IsNullOrWhiteSpace(dto.TargetStage) &&
                RequisitionWorkflow.StageIndex(dto.TargetStage) is var ti && ti >= 0 && ti < idx)
                target = dto.TargetStage!;
            else if (idx > 0)
                target = RequisitionWorkflow.OrderedStages[idx - 1];

            r.Stage = target;
            r.State = "Returned";
            r.ResumeStage = target;
            r.StageEnteredAt = DateTime.UtcNow;
            r.UpdatedAt = DateTime.UtcNow;

            AddStep(r, from, target, "Return", dto.Comment, def.ActingRole);
            await _context.SaveChangesAsync();
            return Ok(ToDetailDto(r));
        }

        /// <summary>Reject outright — terminal unless an admin reopens.</summary>
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> Reject(int id, [FromBody] WorkflowActionDto dto)
        {
            var r = await _context.RequisitionInvoices.FindAsync(id);
            if (r == null) return NotFound();
            var def = RequisitionWorkflow.Get(r.Stage);
            if (def?.ActingRole != null && !await HasWorkflowRole(def.ActingRole))
                return Forbid();
            if (string.IsNullOrWhiteSpace(dto.Comment))
                return BadRequest(new { error = "A reason is required to reject." });

            var from = r.Stage;
            r.State = "Rejected";
            r.UpdatedAt = DateTime.UtcNow;
            AddStep(r, from, from, "Reject", dto.Comment, def?.ActingRole);
            await _context.SaveChangesAsync();
            return Ok(ToDetailDto(r));
        }

        /// <summary>Put on hold, remembering the stage to resume at.</summary>
        [HttpPost("{id}/hold")]
        public async Task<IActionResult> Hold(int id, [FromBody] WorkflowActionDto dto)
        {
            var r = await _context.RequisitionInvoices.FindAsync(id);
            if (r == null) return NotFound();
            if (r.State != "Active") return BadRequest(new { error = "Only active invoices can be held." });

            r.ResumeStage = r.Stage;
            r.State = "OnHold";
            r.UpdatedAt = DateTime.UtcNow;
            AddStep(r, r.Stage, r.Stage, "Hold", dto.Comment);
            await _context.SaveChangesAsync();
            return Ok(ToDetailDto(r));
        }

        [HttpPost("{id}/resume")]
        public async Task<IActionResult> Resume(int id, [FromBody] WorkflowActionDto dto)
        {
            var r = await _context.RequisitionInvoices.FindAsync(id);
            if (r == null) return NotFound();
            if (r.State != "OnHold") return BadRequest(new { error = "Invoice is not on hold." });

            r.State = "Active";
            var resume = r.ResumeStage ?? r.Stage;
            r.Stage = resume;
            r.ResumeStage = null;
            r.UpdatedAt = DateTime.UtcNow;
            AddStep(r, resume, resume, "Resume", dto.Comment);
            await _context.SaveChangesAsync();
            return Ok(ToDetailDto(r));
        }

        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> Cancel(int id, [FromBody] WorkflowActionDto dto)
        {
            var r = await _context.RequisitionInvoices.FindAsync(id);
            if (r == null) return NotFound();
            if (r.State is "Paid" or "Closed") return BadRequest(new { error = $"A {r.State} invoice cannot be cancelled." });

            var from = r.Stage;
            r.State = "Cancelled";
            r.UpdatedAt = DateTime.UtcNow;
            AddStep(r, from, from, "Cancel", dto.Comment);
            await _context.SaveChangesAsync();
            return Ok(ToDetailDto(r));
        }

        // ============================================================
        //  Helpers
        // ============================================================

        private void AddStep(RequisitionInvoice r, string from, string to, string action,
            string? comment, string? role = null, int? signatureId = null)
        {
            _context.RequisitionApprovalSteps.Add(new RequisitionApprovalStep
            {
                RequisitionInvoiceId = r.Id,
                FromStage = from,
                ToStage = to,
                Action = action,
                Comment = comment,
                ActorUserId = CurrentUserId(),
                ActorName = CurrentUserName(),
                ActorRole = role,
                SignatureId = signatureId,
                CreatedAt = DateTime.UtcNow
            });
        }

        /// <summary>The canonical financial fields we hash into each signature so any
        /// later tampering (amount/beneficiary/ref) invalidates the signature.</summary>
        private static object SignaturePayload(RequisitionInvoice r) => new
        {
            r.Id, r.ReferenceNumber, r.SupplierName, r.InvoiceNumber,
            r.Sage300Reference, Amount = r.Amount, r.VatAmount, r.Currency, r.Stage
        };

        private static string StripDataUrl(string b64)
        {
            var comma = b64.IndexOf(',');
            return comma >= 0 ? b64[(comma + 1)..] : b64;
        }

        private static void ApplyUpsert(RequisitionInvoice r, RequisitionInvoiceUpsertDto dto)
        {
            r.SupplierName = dto.SupplierName?.Trim();
            r.InvoiceNumber = dto.InvoiceNumber?.Trim();
            r.Sage300Reference = dto.Sage300Reference?.Trim();
            r.InvoiceDate = dto.InvoiceDate;
            r.DueDate = dto.DueDate;
            r.Amount = dto.Amount;
            r.VatAmount = dto.VatAmount;
            r.Currency = string.IsNullOrWhiteSpace(dto.Currency) ? "ZAR" : dto.Currency!.Trim();
            r.Description = dto.Description?.Trim();
            r.Department = dto.Department?.Trim();
        }

        private static object ToListDto(RequisitionInvoice r) => new
        {
            r.Id, r.ReferenceNumber, r.SupplierName, r.InvoiceNumber, r.Sage300Reference,
            r.Amount, r.VatAmount, r.Currency, r.Stage, r.State, r.Department,
            stageIndex = RequisitionWorkflow.StageIndex(r.Stage),
            stageTitle = RequisitionWorkflow.Get(r.Stage)?.Title,
            r.StageEnteredAt, r.CreatedAt, r.UpdatedAt
        };

        private static object ToDetailDto(RequisitionInvoice r) => new
        {
            r.Id, r.ReferenceNumber, r.SupplierName, r.InvoiceNumber, r.Sage300Reference,
            r.InvoiceDate, r.DueDate, r.Amount, r.VatAmount, r.Currency, r.Description,
            r.Department, r.Stage, r.State, r.ResumeStage,
            stageTitle = RequisitionWorkflow.Get(r.Stage)?.Title,
            r.PaymentReference, r.PaymentMethod, r.PaidDate,
            r.CreatedByName, r.CreatedAt, r.UpdatedAt, r.StageEnteredAt
        };
    }

    // ---------- DTOs ----------
    public class RequisitionInvoiceUpsertDto
    {
        public string? SupplierName { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? Sage300Reference { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public DateTime? DueDate { get; set; }
        public decimal Amount { get; set; }
        public decimal VatAmount { get; set; }
        public string? Currency { get; set; }
        public string? Description { get; set; }
        public string? Department { get; set; }
    }

    public class WorkflowActionDto
    {
        public string? Comment { get; set; }
        public string? TargetStage { get; set; }        // for return-for-correction
        public string? PaymentReference { get; set; }   // for Nash payment step
        public string? PaymentMethod { get; set; }
        // Signature capture
        public string? SignatureMethod { get; set; }    // Typed | Drawn | ReAuth | Click
        public bool ReAuthenticated { get; set; }
        public string? SignatureImageBase64 { get; set; }
        public string? SignatureImageMimeType { get; set; }
    }
}
