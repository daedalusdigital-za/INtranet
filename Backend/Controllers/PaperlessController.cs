using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Paperless;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Server-side store for the Paperless document workflow. Replaces the
    /// original browser-localStorage implementation so documents (and their
    /// stacked supporting files, signatures and annotations) are shared across
    /// users and are not limited by the ~5&#160;MB localStorage budget.
    ///
    /// Binary files live on disk under {DocumentsPath}/Paperless; workflow
    /// state is persisted as JSON columns. The table self-provisions on first
    /// use so no EF migration is required.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PaperlessController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<PaperlessController> _logger;
        private readonly IEmailService _emailService;
        private readonly INotificationBroadcaster _notifier;
        private readonly string _storagePath;
        private static bool _tableEnsured;
        private static readonly SemaphoreSlim _ensureLock = new(1, 1);

        public PaperlessController(
            ApplicationDbContext context,
            ILogger<PaperlessController> logger,
            IEmailService emailService,
            INotificationBroadcaster notifier,
            IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
            _notifier = notifier;
            var basePath = configuration.GetValue<string>("DocumentsPath")
                ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            _storagePath = Path.Combine(basePath, "Paperless");
        }

        // ── DTOs ───────────────────────────────────────────────
        public class PaperlessDto
        {
            public string Id { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public string Mime { get; set; } = string.Empty;
            public long SizeBytes { get; set; }
            public string Status { get; set; } = "draft";
            public int Progress { get; set; }
            public string Routing { get; set; } = "sequential";
            public DateTime? DueDate { get; set; }
            public int Rotation { get; set; }
            public string? ParentId { get; set; }
            public string? StackKind { get; set; }
            public string? Category { get; set; }
            public object Recipients { get; set; } = Array.Empty<object>();
            public object Activity { get; set; } = Array.Empty<object>();
            public object Annotations { get; set; } = Array.Empty<object>();
            public object Signatures { get; set; } = Array.Empty<object>();
            public string CreatedAt { get; set; } = string.Empty;
            public string UpdatedAt { get; set; } = string.Empty;
        }

        /// <summary>Metadata patch sent by the client when workflow state changes.</summary>
        public class PaperlessPatch
        {
            public string? Status { get; set; }
            public int? Progress { get; set; }
            public string? Routing { get; set; }
            public DateTime? DueDate { get; set; }
            public int? Rotation { get; set; }
            public string? StackKind { get; set; }
            public string? Category { get; set; }
            // Raw JSON strings (already serialised by the client).
            public string? RecipientsJson { get; set; }
            public string? ActivityJson { get; set; }
            public string? AnnotationsJson { get; set; }
            public string? SignaturesJson { get; set; }
        }

        // ── Endpoints ──────────────────────────────────────────

        /// <summary>
        /// List the documents the current user is allowed to see: ones they
        /// created, ones where they are a recipient (signer / approver / viewer),
        /// or ones explicitly shared with them. Stack children are included when
        /// their parent is visible. Users must NOT see other people's private
        /// workflows they were never added to.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            await EnsureTableAsync();
            var (uid, email) = GetCurrentUser();
            var emailLc = (email ?? string.Empty).Trim().ToLowerInvariant();

            // The creator is stored as a display name or email string, so resolve
            // the current user's name too for a reliable ownership match.
            string nameLc = string.Empty;
            if (uid > 0)
            {
                var me = await _context.Users.AsNoTracking()
                    .Where(u => u.UserId == uid)
                    .Select(u => (u.Name + " " + u.Surname).Trim())
                    .FirstOrDefaultAsync();
                nameLc = (me ?? string.Empty).Trim().ToLowerInvariant();
            }

            var all = await _context.PaperlessDocuments
                .OrderByDescending(d => d.CreatedAt)
                .ToListAsync();

            bool CanSee(PaperlessDocument d)
            {
                var createdByLc = (d.CreatedBy ?? string.Empty).Trim().ToLowerInvariant();
                if (createdByLc.Length > 0 &&
                    (createdByLc == nameLc && nameLc.Length > 0 ||
                     createdByLc == emailLc && emailLc.Length > 0))
                    return true;

                if (uid > 0 && ParseAccess(d.AccessUserIdsJson).Contains(uid))
                    return true;

                if (emailLc.Length > 0)
                {
                    var recips = ParseRecipients(d.RecipientsJson);
                    if (recips.Any(r => !string.IsNullOrWhiteSpace(r.email) &&
                                        r.email!.Trim().ToLowerInvariant() == emailLc))
                        return true;
                }
                return false;
            }

            // Parent-level docs the user may see.
            var visibleParentIds = new HashSet<string>(
                all.Where(d => d.ParentId == null && CanSee(d)).Select(d => d.Id));

            var visible = all.Where(d =>
                d.ParentId == null
                    ? visibleParentIds.Contains(d.Id)
                    // A stack child is visible if its parent is visible, or the
                    // child itself was shared/assigned directly.
                    : (d.ParentId != null && visibleParentIds.Contains(d.ParentId)) || CanSee(d));

            return Ok(visible.Select(ToDto));
        }

        /// <summary>
        /// Search active system users (for the recipient / share pickers).
        /// Any authenticated user may look people up by name or email.
        /// </summary>
        [HttpGet("users")]
        public async Task<IActionResult> SearchUsers([FromQuery] string? q, [FromQuery] int limit = 12)
        {
            var query = _context.Users.AsNoTracking().Where(u => u.IsActive);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var term = q.Trim();
                query = query.Where(u =>
                    u.Name.Contains(term) ||
                    u.Surname.Contains(term) ||
                    u.Email.Contains(term));
            }
            var users = await query
                .OrderBy(u => u.Name).ThenBy(u => u.Surname)
                .Take(Math.Clamp(limit, 1, 50))
                .Select(u => new
                {
                    id = u.UserId,
                    name = (u.Name + " " + u.Surname).Trim(),
                    email = u.Email,
                    title = u.Title
                })
                .ToListAsync();
            return Ok(users);
        }

        /// <summary>
        /// The current user's Paperless inbox: every document where they are a
        /// recipient (signer / approver / viewer) or that was shared with them.
        /// Drives the in-app "Shared with me" list and the unread count badge —
        /// the web app has no SignalR client, so this is how a recipient learns
        /// they've been added without relying on email or the desktop tray.
        /// </summary>
        [HttpGet("inbox")]
        public async Task<IActionResult> Inbox()
        {
            await EnsureTableAsync();
            var (uid, email) = GetCurrentUser();
            var emailLc = (email ?? string.Empty).Trim().ToLowerInvariant();

            var docs = await _context.PaperlessDocuments
                .Where(d => d.ParentId == null)
                .OrderByDescending(d => d.UpdatedAt)
                .ToListAsync();

            var inbox = new List<object>();
            foreach (var d in docs)
            {
                var recips = ParseRecipients(d.RecipientsJson);
                var mine = recips.FirstOrDefault(r =>
                    !string.IsNullOrWhiteSpace(r.email) &&
                    r.email!.Trim().ToLowerInvariant() == emailLc);
                var hasAccess = uid > 0 && ParseAccess(d.AccessUserIdsJson).Contains(uid);
                if (mine == null && !hasAccess) continue;

                inbox.Add(new
                {
                    id = d.Id,
                    name = d.Name,
                    mime = d.Mime,
                    status = d.Status,
                    progress = d.Progress,
                    routing = d.Routing,
                    myRole = mine?.role,
                    myState = mine?.state,
                    createdBy = d.CreatedBy,
                    updatedAt = d.UpdatedAt.ToString("o")
                });
            }
            return Ok(inbox);
        }

        /// <summary>The current user's Paperless notifications (newest first).</summary>
        [HttpGet("notifications")]
        public async Task<IActionResult> GetNotifications([FromQuery] bool unreadOnly = false, [FromQuery] int limit = 50)
        {
            await EnsureTableAsync();
            var (uid, _) = GetCurrentUser();
            if (uid <= 0) return Ok(Array.Empty<object>());

            var query = _context.PaperlessNotifications.AsNoTracking().Where(n => n.UserId == uid);
            if (unreadOnly) query = query.Where(n => !n.IsRead);
            var rows = await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(Math.Clamp(limit, 1, 200))
                .Select(n => new
                {
                    id = n.Id,
                    documentId = n.DocumentId,
                    documentName = n.DocumentName,
                    type = n.Type,
                    title = n.Title,
                    body = n.Body,
                    isRead = n.IsRead,
                    createdAt = n.CreatedAt.ToString("o")
                })
                .ToListAsync();
            return Ok(rows);
        }

        /// <summary>Mark a single Paperless notification as read.</summary>
        [HttpPost("notifications/{notificationId:int}/read")]
        public async Task<IActionResult> MarkNotificationRead(int notificationId)
        {
            await EnsureTableAsync();
            var (uid, _) = GetCurrentUser();
            var n = await _context.PaperlessNotifications
                .FirstOrDefaultAsync(x => x.Id == notificationId && x.UserId == uid);
            if (n == null) return NotFound();
            n.IsRead = true;
            await _context.SaveChangesAsync();
            return Ok(new { success = true });
        }

        /// <summary>Mark all of the current user's Paperless notifications as read.</summary>
        [HttpPost("notifications/read-all")]
        public async Task<IActionResult> MarkAllNotificationsRead()
        {
            await EnsureTableAsync();
            var (uid, _) = GetCurrentUser();
            if (uid <= 0) return Ok(new { success = true, updated = 0 });
            var rows = await _context.PaperlessNotifications
                .Where(n => n.UserId == uid && !n.IsRead)
                .ToListAsync();
            foreach (var n in rows) n.IsRead = true;
            await _context.SaveChangesAsync();
            return Ok(new { success = true, updated = rows.Count });
        }

        public class ShareRequest
        {
            /// <summary>Email addresses to share the document with.</summary>
            public List<string> Emails { get; set; } = new();
            public string? Message { get; set; }
        }

        /// <summary>
        /// Share a document with other system users by email. Sends each
        /// recipient a notification from the intranet mailbox and records the
        /// share in the document's activity trail.
        /// </summary>
        [HttpPost("{id}/share")]
        public async Task<IActionResult> Share(string id, [FromBody] ShareRequest req)
        {
            await EnsureTableAsync();
            var doc = await _context.PaperlessDocuments.FirstOrDefaultAsync(d => d.Id == id);
            if (doc == null) return NotFound();

            var emails = (req.Emails ?? new List<string>())
                .Where(e => !string.IsNullOrWhiteSpace(e))
                .Select(e => e.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (emails.Count == 0) return BadRequest("No recipients supplied.");

            var actor = User.FindFirstValue(ClaimTypes.Name)
                ?? User.FindFirstValue("name")
                ?? User.FindFirstValue(ClaimTypes.Email)
                ?? "A colleague";

            var subject = $"{actor} shared a document with you: {doc.Name}";
            var note = string.IsNullOrWhiteSpace(req.Message) ? "" :
                $"<p style='margin:0 0 12px;padding:12px;background:#f1f5f9;border-radius:8px;color:#334155'>{System.Net.WebUtility.HtmlEncode(req.Message)}</p>";

            // Gather the whole workflow bundle: the primary (e-signed) document
            // plus every stacked supporting file, and attach each one that still
            // exists on disk so recipients get the complete package by email.
            var attachments = await BuildBundleAttachmentsAsync(doc);

            var attachLine = attachments.Count > 0
                ? $"<p style='margin:0 0 12px;color:#475569'>{attachments.Count} file{(attachments.Count == 1 ? "" : "s")} attached (the signed document and all stacked supporting files).</p>"
                : "";

            var body = $@"
<div style='font-family:Segoe UI,Arial,sans-serif;color:#0f172a'>
  <h2 style='margin:0 0 8px'>A document was shared with you</h2>
  <p style='margin:0 0 12px;color:#475569'><strong>{System.Net.WebUtility.HtmlEncode(actor)}</strong> shared <strong>{System.Net.WebUtility.HtmlEncode(doc.Name)}</strong> with you on the ProMed Intranet.</p>
  {note}
  {attachLine}
  <p style='margin:0 0 4px;color:#475569'>Open the Intranet and check your Paperless documents to view, sign or annotate it.</p>
</div>";

            var ok = false;
            try
            {
                ok = await _emailService.SendEmailAsync(emails, subject, body, true, attachments.Count > 0 ? attachments : null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send Paperless share email for {DocId}", id);
            }

            // Record the share in the activity trail.
            try
            {
                var activity = System.Text.Json.JsonSerializer.Deserialize<List<System.Text.Json.JsonElement>>(doc.ActivityJson)
                    ?? new List<System.Text.Json.JsonElement>();
                var entry = System.Text.Json.JsonSerializer.SerializeToElement(new
                {
                    id = "a_" + Guid.NewGuid().ToString("N").Substring(0, 10),
                    at = DateTime.UtcNow.ToString("o"),
                    actor,
                    type = "shared",
                    detail = $"Shared with {string.Join(", ", emails)}"
                });
                activity.Add(entry);
                doc.ActivityJson = System.Text.Json.JsonSerializer.Serialize(activity);
                doc.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to record share activity for {DocId}", id);
            }

            // Grant access to the doc + stack and push an in-app notification to
            // any recipients that are system users.
            try
            {
                var matched = await _context.Users.AsNoTracking()
                    .Where(u => emails.Contains(u.Email))
                    .Select(u => new { u.UserId })
                    .ToListAsync();
                if (matched.Count > 0)
                {
                    await GrantAccessAsync(doc, matched.Select(u => u.UserId).ToList());
                    await PersistNotificationsAsync(
                        doc.Id, doc.Name, "shared",
                        "A document was shared with you",
                        $"{actor} shared \u201c{doc.Name}\u201d with you.",
                        matched.Select(u => u.UserId));
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to notify shared users for {DocId}", id);
            }

            return Ok(new { shared = emails.Count, emailSent = ok });
        }

        public class RenameRequest { public string Name { get; set; } = string.Empty; }

        /// <summary>Rename a document (friendly display name only; file on disk unchanged).</summary>
        [HttpPost("{id}/rename")]
        public async Task<IActionResult> Rename(string id, [FromBody] RenameRequest req)
        {
            await EnsureTableAsync();
            var doc = await _context.PaperlessDocuments.FirstOrDefaultAsync(d => d.Id == id);
            if (doc == null) return NotFound();

            var newName = (req.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(newName)) return BadRequest("Name is required.");
            if (newName.Length > 400) newName = newName.Substring(0, 400);

            var oldName = doc.Name;
            doc.Name = newName;
            doc.UpdatedAt = DateTime.UtcNow;

            var actor = User.FindFirstValue(ClaimTypes.Name)
                ?? User.FindFirstValue("name")
                ?? User.FindFirstValue(ClaimTypes.Email)
                ?? "Someone";
            try
            {
                var activity = System.Text.Json.JsonSerializer.Deserialize<List<System.Text.Json.JsonElement>>(doc.ActivityJson)
                    ?? new List<System.Text.Json.JsonElement>();
                var entry = System.Text.Json.JsonSerializer.SerializeToElement(new
                {
                    id = "a_" + Guid.NewGuid().ToString("N").Substring(0, 10),
                    at = DateTime.UtcNow.ToString("o"),
                    actor,
                    type = "annotated",
                    detail = $"Renamed \u201c{oldName}\u201d to \u201c{newName}\u201d"
                });
                activity.Add(entry);
                doc.ActivityJson = System.Text.Json.JsonSerializer.Serialize(activity);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to record rename activity for {DocId}", id);
            }

            await _context.SaveChangesAsync();
            return Ok(ToDto(doc));
        }


        public async Task<IActionResult> GetFile(string id)
        {
            await EnsureTableAsync();
            var doc = await _context.PaperlessDocuments.FirstOrDefaultAsync(d => d.Id == id);
            if (doc == null) return NotFound();
            if (string.IsNullOrEmpty(doc.FilePath) || !System.IO.File.Exists(doc.FilePath))
                return NotFound("File missing on server.");

            // Read into memory so the response has an exact Content-Length and is
            // not held open against the (NAS-backed) volume while streaming.
            var bytes = await System.IO.File.ReadAllBytesAsync(doc.FilePath);
            var mime = string.IsNullOrEmpty(doc.Mime) ? "application/octet-stream" : doc.Mime;
            return File(bytes, mime, enableRangeProcessing: true);
        }

        /// <summary>
        /// Return a document's binary as a base64 data URL wrapped in JSON.
        /// This avoids cross-origin binary/blob pitfalls (range + compression)
        /// that can surface in the browser as "net::ERR_FAILED 200 (OK)".
        /// </summary>
        [HttpGet("{id}/filedata")]
        public async Task<IActionResult> GetFileData(string id)
        {
            await EnsureTableAsync();
            var doc = await _context.PaperlessDocuments.FirstOrDefaultAsync(d => d.Id == id);
            if (doc == null) return NotFound();
            if (string.IsNullOrEmpty(doc.FilePath) || !System.IO.File.Exists(doc.FilePath))
                return NotFound("File missing on server.");

            var bytes = await System.IO.File.ReadAllBytesAsync(doc.FilePath);
            var mime = string.IsNullOrEmpty(doc.Mime) ? "application/octet-stream" : doc.Mime;
            var dataUrl = $"data:{mime};base64,{Convert.ToBase64String(bytes)}";
            return Ok(new { dataUrl });
        }

        /// <summary>
        /// Upload a new document (or a stacked child when parentId is set).
        /// </summary>
        [HttpPost("upload")]
        [RequestSizeLimit(200_000_000)] // 200 MB
        public async Task<IActionResult> Upload(
            [FromForm] IFormFile file,
            [FromForm] string? id,
            [FromForm] string? parentId,
            [FromForm] string? stackKind,
            [FromForm] string? category)
        {
            await EnsureTableAsync();
            if (file == null || file.Length == 0) return BadRequest("No file supplied.");

            var docId = string.IsNullOrWhiteSpace(id) ? "p_" + Guid.NewGuid().ToString("N") : id.Trim();
            var safeExt = Path.GetExtension(file.FileName);
            var isChild = !string.IsNullOrWhiteSpace(parentId);

            // Each primary document gets its OWN folder under {DocumentsPath}/Paperless
            // so it appears as a browsable folder in the Documents module; its
            // stacked children are stored inside that same folder.
            string docFolder;
            if (isChild)
            {
                // Reuse the parent's folder (fall back to a folder named after the parent id).
                var parent = await _context.PaperlessDocuments
                    .FirstOrDefaultAsync(d => d.Id == parentId!.Trim());
                docFolder = !string.IsNullOrEmpty(parent?.FilePath)
                    ? Path.GetDirectoryName(parent!.FilePath)!
                    : Path.Combine(_storagePath, SafeFolderName(parentId!.Trim(), parentId!.Trim()));
            }
            else
            {
                docFolder = Path.Combine(_storagePath, SafeFolderName(file.FileName, docId));
            }
            Directory.CreateDirectory(docFolder);

            // Keep the original file name where possible (deduplicate if needed).
            var baseName = Path.GetFileNameWithoutExtension(file.FileName);
            var safeBase = SanitiseFileName(string.IsNullOrWhiteSpace(baseName) ? docId : baseName);
            var storedName = safeBase + safeExt;
            var fullPath = Path.Combine(docFolder, storedName);
            var dupe = 1;
            while (System.IO.File.Exists(fullPath))
            {
                storedName = $"{safeBase} ({dupe++}){safeExt}";
                fullPath = Path.Combine(docFolder, storedName);
            }

            using (var fs = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(fs);
            }

            var now = DateTime.UtcNow;
            var mime = string.IsNullOrEmpty(file.ContentType) || file.ContentType == "application/octet-stream"
                ? GuessMime(file.FileName)
                : file.ContentType;

            var actor = User.FindFirstValue(ClaimTypes.Name)
                ?? User.FindFirstValue("name")
                ?? User.FindFirstValue(ClaimTypes.Email)
                ?? "Me";

            var label = isChild ? StackKindLabel(stackKind) : null;
            var detail = isChild
                ? $"Stacked {label} \u201c{file.FileName}\u201d"
                : $"Uploaded \u201c{file.FileName}\u201d";
            var activityJson = System.Text.Json.JsonSerializer.Serialize(new[]
            {
                new
                {
                    id = "a_" + Guid.NewGuid().ToString("N").Substring(0, 10),
                    at = now.ToString("o"),
                    actor,
                    type = "created",
                    detail
                }
            });

            var (creatorUid, _) = GetCurrentUser();
            var doc = new PaperlessDocument
            {
                Id = docId,
                Name = file.FileName,
                Mime = mime,
                SizeBytes = file.Length,
                Status = "draft",
                Progress = 8,
                Routing = "sequential",
                DueDate = null,
                ParentId = isChild ? parentId!.Trim() : null,
                StackKind = isChild ? (stackKind ?? "ProofOfDelivery") : null,
                Category = string.IsNullOrWhiteSpace(category) ? null : category.Trim(),
                FilePath = fullPath,
                RecipientsJson = "[]",
                ActivityJson = activityJson,
                AnnotationsJson = "[]",
                SignaturesJson = "[]",
                // Record the creator in the access list so ownership survives
                // display-name changes and drives visibility filtering.
                AccessUserIdsJson = creatorUid > 0
                    ? System.Text.Json.JsonSerializer.Serialize(new[] { creatorUid })
                    : "[]",
                CreatedBy = actor,
                CreatedAt = now,
                UpdatedAt = now
            };

            _context.PaperlessDocuments.Add(doc);
            await _context.SaveChangesAsync();
            return Ok(ToDto(doc));
        }

        /// <summary>Update workflow metadata (recipients / activity / etc.).</summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(string id, [FromBody] PaperlessPatch patch)
        {
            await EnsureTableAsync();
            var doc = await _context.PaperlessDocuments.FirstOrDefaultAsync(d => d.Id == id);
            if (doc == null) return NotFound();

            // Capture the previous recipient list so we can detect who was newly
            // added and notify them (email + in-app + access grant).
            var previousRecipientsJson = doc.RecipientsJson;
            var previousStatus = doc.Status;

            if (patch.Status != null) doc.Status = patch.Status;
            if (patch.Progress.HasValue) doc.Progress = patch.Progress.Value;
            if (patch.Routing != null) doc.Routing = patch.Routing;
            if (patch.DueDate.HasValue) doc.DueDate = patch.DueDate;
            if (patch.Rotation.HasValue) doc.Rotation = ((patch.Rotation.Value % 360) + 360) % 360;
            if (patch.StackKind != null) doc.StackKind = patch.StackKind;
            if (patch.Category != null) doc.Category = patch.Category;
            if (patch.RecipientsJson != null) doc.RecipientsJson = patch.RecipientsJson;
            if (patch.ActivityJson != null) doc.ActivityJson = patch.ActivityJson;
            if (patch.AnnotationsJson != null) doc.AnnotationsJson = patch.AnnotationsJson;
            if (patch.SignaturesJson != null) doc.SignaturesJson = patch.SignaturesJson;
            doc.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Fire notifications for any newly-added recipients. Failures here
            // must never break the save, so they are swallowed inside the helper.
            if (patch.RecipientsJson != null)
            {
                await NotifyNewRecipientsAsync(doc, previousRecipientsJson, patch.RecipientsJson);
                // Someone signed/approved/declined → tell everyone on the workflow.
                await NotifyRecipientStateChangesAsync(doc, previousRecipientsJson, patch.RecipientsJson);
            }
            // Document completed → tell everyone on the workflow.
            if (patch.Status != null &&
                !string.Equals(previousStatus, "completed", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(doc.Status, "completed", StringComparison.OrdinalIgnoreCase))
            {
                await NotifyWorkflowAsync(doc, "completed", "Paperless workflow completed",
                    $"\u201c{doc.Name}\u201d is now complete — all recipients have responded.");
            }

            return Ok(ToDto(doc));
        }

        /// <summary>Delete a document and all of its stacked descendants.</summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(string id)
        {
            await EnsureTableAsync();
            var all = await _context.PaperlessDocuments.ToListAsync();
            var toDelete = new List<PaperlessDocument>();
            CollectDescendants(id, all, toDelete);
            var root = all.FirstOrDefault(d => d.Id == id);
            if (root != null) toDelete.Add(root);
            if (toDelete.Count == 0) return NotFound();

            foreach (var d in toDelete)
            {
                try
                {
                    if (!string.IsNullOrEmpty(d.FilePath) && System.IO.File.Exists(d.FilePath))
                        System.IO.File.Delete(d.FilePath);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete Paperless file {Path}", d.FilePath);
                }
            }

            // Remove the now-empty per-document folder(s).
            foreach (var folder in toDelete
                .Where(d => !string.IsNullOrEmpty(d.FilePath))
                .Select(d => Path.GetDirectoryName(d.FilePath!))
                .Where(f => !string.IsNullOrEmpty(f) && f != _storagePath)
                .Distinct())
            {
                try
                {
                    if (Directory.Exists(folder) && !Directory.EnumerateFileSystemEntries(folder!).Any())
                        Directory.Delete(folder!);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to remove Paperless folder {Folder}", folder);
                }
            }

            _context.PaperlessDocuments.RemoveRange(toDelete);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ── Helpers ────────────────────────────────────────────
        private static void CollectDescendants(string parentId, List<PaperlessDocument> all, List<PaperlessDocument> acc)
        {
            foreach (var child in all.Where(d => d.ParentId == parentId))
            {
                acc.Add(child);
                CollectDescendants(child.Id, all, acc);
            }
        }

        /// <summary>
        /// Read the full workflow bundle for a document — the primary
        /// (e-signed) file plus every stacked supporting file — off disk and
        /// return them as email attachments. Missing/empty files are skipped.
        /// Shared by the Share endpoint and the "you've been added" recipient
        /// notification so both emails carry the complete package of PDFs.
        /// </summary>
        private async Task<List<EmailAttachment>> BuildBundleAttachmentsAsync(PaperlessDocument doc)
        {
            var attachments = new List<EmailAttachment>();
            try
            {
                var all = await _context.PaperlessDocuments.AsNoTracking().ToListAsync();
                var bundle = new List<PaperlessDocument> { doc };
                CollectDescendants(doc.Id, all, bundle);

                var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var d in bundle)
                {
                    try
                    {
                        if (string.IsNullOrEmpty(d.FilePath) || !System.IO.File.Exists(d.FilePath)) continue;
                        var bytes = await System.IO.File.ReadAllBytesAsync(d.FilePath);
                        if (bytes.Length == 0) continue;

                        // Prefer the friendly document name, keeping the on-disk extension.
                        var ext = Path.GetExtension(d.FilePath);
                        var baseName = string.IsNullOrWhiteSpace(d.Name)
                            ? Path.GetFileNameWithoutExtension(d.FilePath)
                            : Path.GetFileNameWithoutExtension(d.Name);
                        var fileName = SanitiseFileName(baseName) + ext;
                        // Prefix stacked children with their kind so the bundle is self-describing.
                        if (d.Id != doc.Id && !string.IsNullOrEmpty(d.StackKind))
                            fileName = $"{StackKindLabel(d.StackKind)} - {fileName}";
                        var dupe = 1;
                        var candidate = fileName;
                        while (!usedNames.Add(candidate))
                            candidate = $"{Path.GetFileNameWithoutExtension(fileName)} ({dupe++}){Path.GetExtension(fileName)}";
                        fileName = candidate;

                        attachments.Add(new EmailAttachment
                        {
                            FileName = fileName,
                            Content = bytes,
                            ContentType = string.IsNullOrWhiteSpace(d.Mime) ? "application/octet-stream" : d.Mime
                        });
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to attach Paperless file {Path} for {DocId}", d.FilePath, doc.Id);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to build attachment bundle for {DocId}", doc.Id);
            }
            return attachments;
        }

        private PaperlessDto ToDto(PaperlessDocument d) => new()
        {
            Id = d.Id,
            Name = d.Name,
            Mime = d.Mime,
            SizeBytes = d.SizeBytes,
            Status = d.Status,
            Progress = d.Progress,
            Routing = d.Routing,
            DueDate = d.DueDate,
            Rotation = d.Rotation,
            ParentId = d.ParentId,
            StackKind = d.StackKind,
            Category = d.Category,
            Recipients = ParseJson(d.RecipientsJson),
            Activity = ParseJson(d.ActivityJson),
            Annotations = ParseJson(d.AnnotationsJson),
            Signatures = ParseJson(d.SignaturesJson),
            CreatedAt = d.CreatedAt.ToString("o"),
            UpdatedAt = d.UpdatedAt.ToString("o")
        };

        private static object ParseJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return Array.Empty<object>();
            try { return System.Text.Json.JsonSerializer.Deserialize<object>(json) ?? Array.Empty<object>(); }
            catch { return Array.Empty<object>(); }
        }

        private static string GuessMime(string name)
        {
            var provider = new FileExtensionContentTypeProvider();
            return provider.TryGetContentType(name, out var ct) ? ct : "application/octet-stream";
        }

        /// <summary>Strip characters that are invalid in a file name.</summary>
        private static string SanitiseFileName(string name)
        {
            var cleaned = new string(name.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c).ToArray()).Trim();
            if (cleaned.Length > 120) cleaned = cleaned.Substring(0, 120);
            return string.IsNullOrWhiteSpace(cleaned) ? "document" : cleaned;
        }

        /// <summary>
        /// Build a stable, human-readable folder name for a document: the file's
        /// base name plus a short id suffix so two files with the same name never
        /// collide, e.g. "Invoice 123 · p_1a2b3c4d".
        /// </summary>
        private static string SafeFolderName(string sourceName, string docId)
        {
            var baseName = Path.GetFileNameWithoutExtension(sourceName);
            var safe = new string((baseName ?? string.Empty)
                .Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c).ToArray()).Trim();
            if (safe.Length > 80) safe = safe.Substring(0, 80);
            var shortId = docId.Length > 10 ? docId.Substring(docId.Length - 8) : docId;
            return string.IsNullOrWhiteSpace(safe) ? shortId : $"{safe} · {shortId}";
        }

        private static string StackKindLabel(string? kind) => kind switch
        {
            "GRV" => "GRV",
            "PurchaseOrder" => "Purchase Order",
            "DeliveryNote" => "Delivery Note",
            "ProofOfDelivery" => "Proof of Delivery",
            "Invoice" => "Invoice",
            "Statement" => "Statement",
            "PaymentSchedule" => "Payment Schedule",
            "Recon" => "Recon",
            _ => "Document"
        };

        // ── Recipient notifications & access ───────────────────

        /// <summary>Shape of a client recipient row for diffing/notification.</summary>
        private class RecipInfo
        {
            public string? id { get; set; }
            public string? name { get; set; }
            public string? email { get; set; }
            public string? role { get; set; }
            public string? state { get; set; }
        }

        private static readonly System.Text.Json.JsonSerializerOptions _jsonOpts =
            new() { PropertyNameCaseInsensitive = true };

        private static List<RecipInfo> ParseRecipients(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new();
            try { return System.Text.Json.JsonSerializer.Deserialize<List<RecipInfo>>(json, _jsonOpts) ?? new(); }
            catch { return new(); }
        }

        private static HashSet<int> ParseAccess(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new();
            try { return System.Text.Json.JsonSerializer.Deserialize<HashSet<int>>(json) ?? new(); }
            catch { return new(); }
        }

        private static string RoleLabel(string? role) => role switch
        {
            "signer" => "Signer",
            "approver" => "Approver",
            "viewer" => "Viewer",
            _ => "Recipient"
        };

        /// <summary>Resolve the current user's id and email from the JWT claims.</summary>
        private (int userId, string? email) GetCurrentUser()
        {
            var idStr = User.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? User.FindFirstValue("userId")
                ?? User.FindFirstValue("sub");
            int.TryParse(idStr, out var uid);
            var email = User.FindFirstValue(ClaimTypes.Email)
                ?? User.FindFirstValue("email");
            return (uid, email);
        }

        /// <summary>
        /// Detect recipients that appear in <paramref name="newJson"/> but not in
        /// <paramref name="oldJson"/> and, for each, send an email + in-app
        /// notification and grant them (and the whole stack) access. Any failure
        /// is logged and swallowed so the workflow save is never blocked.
        /// </summary>
        private async Task NotifyNewRecipientsAsync(PaperlessDocument doc, string? oldJson, string? newJson)
        {
            try
            {
                var oldSet = ParseRecipients(oldJson)
                    .Where(r => !string.IsNullOrWhiteSpace(r.email))
                    .Select(r => r.email!.Trim().ToLowerInvariant())
                    .ToHashSet();

                var added = ParseRecipients(newJson)
                    .Where(r => !string.IsNullOrWhiteSpace(r.email) &&
                                !oldSet.Contains(r.email!.Trim().ToLowerInvariant()))
                    .GroupBy(r => r.email!.Trim().ToLowerInvariant())
                    .Select(g => g.First())
                    .ToList();
                if (added.Count == 0) return;

                _logger.LogInformation(
                    "Paperless {DocId}: {Count} new recipient(s) added: {Emails}",
                    doc.Id, added.Count, string.Join(", ", added.Select(a => a.email)));

                var actor = User.FindFirstValue(ClaimTypes.Name)
                    ?? User.FindFirstValue("name")
                    ?? User.FindFirstValue(ClaimTypes.Email)
                    ?? "A colleague";

                var routing = string.Equals(doc.Routing, "parallel", StringComparison.OrdinalIgnoreCase)
                    ? "parallel" : "sequential";

                // Match added recipients to system users (for in-app + access).
                var emails = added.Select(r => r.email!.Trim()).ToList();
                var users = await _context.Users.AsNoTracking()
                    .Where(u => emails.Contains(u.Email))
                    .Select(u => new { u.UserId, u.Email })
                    .ToListAsync();
                var userByEmail = users
                    .GroupBy(u => u.Email.Trim().ToLowerInvariant())
                    .ToDictionary(g => g.Key, g => g.First().UserId);

                _logger.LogInformation(
                    "Paperless {DocId}: matched {Matched}/{Total} recipient(s) to system users.",
                    doc.Id, users.Count, added.Count);

                if (users.Count > 0)
                    await GrantAccessAsync(doc, users.Select(u => u.UserId).ToList());

                // Read the full bundle (signed document + stacked supporting
                // files) once, so every recipient email carries the PDFs.
                var bundleAttachments = await BuildBundleAttachmentsAsync(doc);
                var attachLine = bundleAttachments.Count > 0
                    ? $"<p style='margin:0 0 12px;color:#475569'>{bundleAttachments.Count} file{(bundleAttachments.Count == 1 ? "" : "s")} attached (the document and all stacked supporting files).</p>"
                    : "";

                // Build a "who's on this workflow" summary (all current recipients,
                // with their roles) plus the document creator, so every alert makes
                // it clear who was added and who set the workflow up.
                var allRecipients = ParseRecipients(newJson)
                    .Where(r => !string.IsNullOrWhiteSpace(r.name) || !string.IsNullOrWhiteSpace(r.email))
                    .ToList();
                var participantRows = string.Join("", allRecipients.Select(r =>
                {
                    var pname = string.IsNullOrWhiteSpace(r.name)
                        ? (r.email ?? "").Trim()
                        : r.name!.Trim();
                    var prole = RoleLabel(r.role);
                    return $"<li style='margin:2px 0;color:#334155'><strong>{System.Net.WebUtility.HtmlEncode(pname)}</strong> — {prole}</li>";
                }));
                var participantsHtml = string.IsNullOrWhiteSpace(participantRows) ? "" : $@"
  <p style='margin:14px 0 4px;color:#0f172a;font-weight:600'>People on this workflow</p>
  <ul style='margin:0 0 12px;padding-left:18px'>{participantRows}</ul>";
                var creator = string.IsNullOrWhiteSpace(doc.CreatedBy) ? actor : doc.CreatedBy!;

                foreach (var r in added)
                {
                    var role = RoleLabel(r.role);
                    var email = r.email!.Trim();
                    var name = string.IsNullOrWhiteSpace(r.name) ? "there" : r.name!.Trim();
                    var subject = $"You've been added to a Paperless workflow: {doc.Name}";
                    var body = $@"
<div style='font-family:Segoe UI,Arial,sans-serif;color:#0f172a'>
  <h2 style='margin:0 0 8px'>You've been added to a Paperless workflow</h2>
  <p style='margin:0 0 12px;color:#475569'>Hi {System.Net.WebUtility.HtmlEncode(name)},</p>
  <p style='margin:0 0 12px;color:#475569'><strong>{System.Net.WebUtility.HtmlEncode(actor)}</strong> added you as a <strong>{role}</strong> on <strong>{System.Net.WebUtility.HtmlEncode(doc.Name)}</strong> ({routing} routing) on the ProMed Intranet.</p>
  <p style='margin:0 0 4px;color:#475569'>Created by <strong>{System.Net.WebUtility.HtmlEncode(creator)}</strong>.</p>{participantsHtml}
  {attachLine}
  <p style='margin:0 0 4px;color:#475569'>Open the Intranet and check your Paperless documents to view, sign or approve it — the document and its supporting stack are now available in your profile.</p>
</div>";
                    try
                    {
                        await _emailService.SendEmailAsync(new List<string> { email }, subject, body, true, bundleAttachments.Count > 0 ? bundleAttachments : null);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Paperless recipient email failed for {Email}", email);
                    }

                    if (userByEmail.TryGetValue(email.ToLowerInvariant(), out var uid))
                    {
                        await PersistNotificationsAsync(
                            doc.Id, doc.Name, "added",
                            "Added to a Paperless workflow",
                            $"{actor} added you as {role} on \u201c{doc.Name}\u201d ({routing}).",
                            new[] { uid });
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "NotifyNewRecipients failed for {DocId}", doc.Id);
            }
        }

        /// <summary>
        /// Grant the given users access to a document and its whole stack (all
        /// descendants plus the parent chain), persisted on the AccessUserIdsJson
        /// column so the document surfaces in each recipient's profile.
        /// </summary>
        private async Task GrantAccessAsync(PaperlessDocument doc, List<int> userIds)
        {
            if (userIds.Count == 0) return;
            try
            {
                var all = await _context.PaperlessDocuments.ToListAsync();
                var stack = new List<PaperlessDocument>();

                // Walk up to the stack root, then collect the root + all descendants.
                var root = all.FirstOrDefault(d => d.Id == doc.Id) ?? doc;
                while (!string.IsNullOrEmpty(root.ParentId))
                {
                    var parent = all.FirstOrDefault(d => d.Id == root.ParentId);
                    if (parent == null) break;
                    root = parent;
                }
                stack.Add(root);
                CollectDescendants(root.Id, all, stack);

                var changed = false;
                foreach (var d in stack)
                {
                    var set = ParseAccess(d.AccessUserIdsJson);
                    var before = set.Count;
                    foreach (var uid in userIds) set.Add(uid);
                    if (set.Count != before)
                    {
                        d.AccessUserIdsJson = System.Text.Json.JsonSerializer.Serialize(set);
                        d.UpdatedAt = DateTime.UtcNow;
                        changed = true;
                    }
                }
                if (changed) await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "GrantAccess failed for {DocId}", doc.Id);
            }
        }

        /// <summary>
        /// Persist an in-app notification row for each user and push a live
        /// SignalR event (for the desktop tray). The web bell reads the rows.
        /// </summary>
        private async Task PersistNotificationsAsync(            string docId, string docName, string type, string title, string body, IEnumerable<int> userIds)
        {
            var ids = userIds.Where(u => u > 0).Distinct().ToList();
            if (ids.Count == 0) return;
            try
            {
                foreach (var uid in ids)
                {
                    _context.PaperlessNotifications.Add(new PaperlessNotification
                    {
                        UserId = uid,
                        DocumentId = docId,
                        DocumentName = docName,
                        Type = type,
                        Title = title,
                        Body = body,
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                await _context.SaveChangesAsync();

                foreach (var uid in ids)
                {
                    await _notifier.NotifyUserAsync(uid, new NotificationPayload
                    {
                        Type = "info",
                        Title = title,
                        Body = body,
                        Url = "/dashboard?open=paperless"
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "PersistNotifications failed for {DocId}", docId);
            }
        }

        /// <summary>
        /// Resolve everyone "included" in a document: recipients that match a
        /// system user (by email) plus anyone already granted access. Used to
        /// broadcast sign / complete events to the whole workflow.
        /// </summary>
        private async Task<List<int>> ResolveWorkflowUserIdsAsync(PaperlessDocument doc, int? excludeUserId = null)
        {
            var ids = new HashSet<int>(ParseAccess(doc.AccessUserIdsJson));
            var emails = ParseRecipients(doc.RecipientsJson)
                .Where(r => !string.IsNullOrWhiteSpace(r.email))
                .Select(r => r.email!.Trim())
                .ToList();
            if (emails.Count > 0)
            {
                var matched = await _context.Users.AsNoTracking()
                    .Where(u => emails.Contains(u.Email))
                    .Select(u => u.UserId)
                    .ToListAsync();
                foreach (var m in matched) ids.Add(m);
            }
            if (excludeUserId.HasValue) ids.Remove(excludeUserId.Value);
            return ids.ToList();
        }

        /// <summary>Notify everyone on the workflow with a single message.</summary>
        private async Task NotifyWorkflowAsync(PaperlessDocument doc, string type, string title, string body, int? excludeUserId = null)
        {
            try
            {
                var ids = await ResolveWorkflowUserIdsAsync(doc, excludeUserId);
                if (ids.Count > 0)
                    await PersistNotificationsAsync(doc.Id, doc.Name, type, title, body, ids);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "NotifyWorkflow failed for {DocId}", doc.Id);
            }
        }

        /// <summary>
        /// Detect recipients whose state advanced to signed / approved / declined
        /// between the old and new recipient lists and notify the whole workflow.
        /// </summary>
        private async Task NotifyRecipientStateChangesAsync(PaperlessDocument doc, string? oldJson, string? newJson)
        {
            try
            {
                var oldStates = ParseRecipients(oldJson)
                    .Where(r => !string.IsNullOrWhiteSpace(r.id))
                    .ToDictionary(r => r.id!, r => (r.state ?? "").ToLowerInvariant());

                foreach (var r in ParseRecipients(newJson))
                {
                    if (string.IsNullOrWhiteSpace(r.id)) continue;
                    var newState = (r.state ?? "").ToLowerInvariant();
                    oldStates.TryGetValue(r.id!, out var prev);
                    if (newState == prev) continue;

                    var who = string.IsNullOrWhiteSpace(r.name) ? "A recipient" : r.name!.Trim();
                    if (newState == "signed")
                        await NotifyWorkflowAsync(doc, "signed", "Document signed",
                            $"{who} signed \u201c{doc.Name}\u201d.");
                    else if (newState == "approved")
                        await NotifyWorkflowAsync(doc, "approved", "Document approved",
                            $"{who} approved \u201c{doc.Name}\u201d.");
                    else if (newState == "declined")
                        await NotifyWorkflowAsync(doc, "declined", "Document declined",
                            $"{who} declined \u201c{doc.Name}\u201d.");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "NotifyRecipientStateChanges failed for {DocId}", doc.Id);
            }
        }

        /// <summary>Create the backing table on first use (no EF migration needed).</summary>
        private async Task EnsureTableAsync()
        {
            if (_tableEnsured) return;
            await _ensureLock.WaitAsync();
            try
            {
                if (_tableEnsured) return;
                const string sql = @"
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaperlessDocuments')
BEGIN
    CREATE TABLE PaperlessDocuments (
        Id              NVARCHAR(64)  NOT NULL PRIMARY KEY,
        Name            NVARCHAR(400) NOT NULL DEFAULT(''),
        Mime            NVARCHAR(160) NOT NULL DEFAULT('application/octet-stream'),
        SizeBytes       BIGINT        NOT NULL DEFAULT(0),
        Status          NVARCHAR(40)  NOT NULL DEFAULT('draft'),
        Progress        INT           NOT NULL DEFAULT(8),
        Routing         NVARCHAR(20)  NOT NULL DEFAULT('sequential'),
        DueDate         DATETIME2     NULL,
        Rotation        INT           NOT NULL DEFAULT(0),
        ParentId        NVARCHAR(64)  NULL,
        StackKind       NVARCHAR(40)  NULL,
        FilePath        NVARCHAR(700) NOT NULL DEFAULT(''),
        RecipientsJson  NVARCHAR(MAX) NOT NULL DEFAULT('[]'),
        ActivityJson    NVARCHAR(MAX) NOT NULL DEFAULT('[]'),
        AnnotationsJson NVARCHAR(MAX) NOT NULL DEFAULT('[]'),
        SignaturesJson  NVARCHAR(MAX) NOT NULL DEFAULT('[]'),
        AccessUserIdsJson NVARCHAR(MAX) NOT NULL DEFAULT('[]'),
        CreatedBy       NVARCHAR(200) NULL,
        CreatedAt       DATETIME2     NOT NULL DEFAULT(SYSUTCDATETIME()),
        UpdatedAt       DATETIME2     NOT NULL DEFAULT(SYSUTCDATETIME())
    );
    CREATE INDEX IX_PaperlessDocuments_ParentId ON PaperlessDocuments(ParentId);
END
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PaperlessDocuments') AND name = 'Rotation')
BEGIN
    ALTER TABLE PaperlessDocuments ADD Rotation INT NOT NULL DEFAULT(0);
END
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PaperlessDocuments') AND name = 'AccessUserIdsJson')
BEGIN
    ALTER TABLE PaperlessDocuments ADD AccessUserIdsJson NVARCHAR(MAX) NOT NULL DEFAULT('[]');
END
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('PaperlessDocuments') AND name = 'Category')
BEGIN
    ALTER TABLE PaperlessDocuments ADD Category NVARCHAR(40) NULL;
END
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaperlessNotifications')
BEGIN
    CREATE TABLE PaperlessNotifications (
        Id           INT IDENTITY(1,1) PRIMARY KEY,
        UserId       INT           NOT NULL,
        DocumentId   NVARCHAR(64)  NOT NULL DEFAULT(''),
        DocumentName NVARCHAR(400) NOT NULL DEFAULT(''),
        Type         NVARCHAR(40)  NOT NULL DEFAULT('updated'),
        Title        NVARCHAR(200) NOT NULL DEFAULT(''),
        Body         NVARCHAR(600) NOT NULL DEFAULT(''),
        IsRead       BIT           NOT NULL DEFAULT(0),
        CreatedAt    DATETIME2     NOT NULL DEFAULT(SYSUTCDATETIME())
    );
    CREATE INDEX IX_PaperlessNotifications_UserId ON PaperlessNotifications(UserId, IsRead);
END";
                await _context.Database.ExecuteSqlRawAsync(sql);
                _tableEnsured = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to ensure PaperlessDocuments table exists.");
                throw;
            }
            finally
            {
                _ensureLock.Release();
            }
        }
    }
}
