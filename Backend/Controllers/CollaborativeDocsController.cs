using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;
using System.Net;
using System.Net.Mail;
using System.Security.Claims;
using System.Text;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CollaborativeDocsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CollaborativeDocsController> _logger;
        private readonly IConfiguration _configuration;

        public CollaborativeDocsController(ApplicationDbContext context, ILogger<CollaborativeDocsController> logger, IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            _configuration = configuration;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out int userId) ? userId : 0;
        }

        // GET: api/collaborativedocs
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DocumentListItemDto>>> GetDocuments()
        {
            var userId = GetCurrentUserId();

            var documents = await _context.CollaborativeDocuments
                .AsNoTracking()
                .Include(d => d.CreatedBy)
                .Include(d => d.LastModifiedBy)
                .Include(d => d.Collaborators)
                .Where(d => !d.IsDeleted && (
                    d.IsPublic ||
                    d.CreatedById == userId ||
                    d.Collaborators.Any(c => c.UserId == userId)
                ))
                .OrderByDescending(d => d.UpdatedAt)
                .Select(d => new DocumentListItemDto
                {
                    Id = d.Id,
                    Title = d.Title,
                    Description = d.Description,
                    CreatedAt = d.CreatedAt,
                    UpdatedAt = d.UpdatedAt,
                    CreatedByName = d.CreatedBy != null ? d.CreatedBy.FullName : "Unknown",
                    LastModifiedByName = d.LastModifiedBy != null ? d.LastModifiedBy.FullName : null,
                    IsPublic = d.IsPublic,
                    UserRole = d.CreatedById == userId ? "owner" :
                        d.Collaborators.FirstOrDefault(c => c.UserId == userId) != null ?
                        d.Collaborators.First(c => c.UserId == userId).Role : "viewer",
                    CollaboratorCount = d.Collaborators.Count
                })
                .ToListAsync();

            return Ok(documents);
        }

        // GET: api/collaborativedocs/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<DocumentDetailDto>> GetDocument(int id)
        {
            var userId = GetCurrentUserId();

            var document = await _context.CollaborativeDocuments
                .AsNoTracking()
                .Include(d => d.CreatedBy)
                .Include(d => d.Collaborators)
                    .ThenInclude(c => c.User)
                .Include(d => d.Snapshots.OrderByDescending(s => s.Version).Take(1))
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (document == null)
                return NotFound(new { message = "Document not found" });

            // Check access
            if (!document.IsPublic &&
                document.CreatedById != userId &&
                !document.Collaborators.Any(c => c.UserId == userId))
            {
                return Forbid();
            }

            var latestSnapshot = document.Snapshots.FirstOrDefault();

            var dto = new DocumentDetailDto
            {
                Id = document.Id,
                Title = document.Title,
                Description = document.Description,
                CreatedAt = document.CreatedAt,
                UpdatedAt = document.UpdatedAt,
                CreatedById = document.CreatedById,
                CreatedByName = document.CreatedBy?.FullName ?? "Unknown",
                IsPublic = document.IsPublic,
                YjsState = latestSnapshot?.YjsState,
                Version = latestSnapshot?.Version ?? 0,
                Collaborators = document.Collaborators.Select(c => new CollaboratorDto
                {
                    Id = c.Id,
                    UserId = c.UserId,
                    UserName = c.User?.FullName ?? "Unknown",
                    Email = c.User?.Email ?? "",
                    Role = c.Role,
                    AddedAt = c.AddedAt
                }).ToList()
            };

            return Ok(dto);
        }

        // POST: api/collaborativedocs
        [HttpPost]
        public async Task<ActionResult<DocumentDetailDto>> CreateDocument([FromBody] CreateDocumentDto dto)
        {
            var userId = GetCurrentUserId();

            var document = new CollaborativeDocument
            {
                Title = dto.Title,
                Description = dto.Description,
                IsPublic = dto.IsPublic,
                CreatedById = userId,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.CollaborativeDocuments.Add(document);
            await _context.SaveChangesAsync();

            // Add creator as owner collaborator
            var collaborator = new DocumentCollaborator
            {
                DocumentId = document.Id,
                UserId = userId,
                Role = "owner",
                AddedAt = DateTime.UtcNow
            };
            _context.DocumentCollaborators.Add(collaborator);
            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} created document {DocumentId}", userId, document.Id);

            return CreatedAtAction(nameof(GetDocument), new { id = document.Id }, new DocumentDetailDto
            {
                Id = document.Id,
                Title = document.Title,
                Description = document.Description,
                CreatedAt = document.CreatedAt,
                UpdatedAt = document.UpdatedAt,
                CreatedById = document.CreatedById,
                IsPublic = document.IsPublic,
                Version = 0,
                Collaborators = new List<CollaboratorDto>()
            });
        }

        // PUT: api/collaborativedocs/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDocument(int id, [FromBody] UpdateDocumentDto dto)
        {
            var userId = GetCurrentUserId();

            var document = await _context.CollaborativeDocuments
                .Include(d => d.Collaborators)
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (document == null)
                return NotFound(new { message = "Document not found" });

            // Check if user can edit
            var canEdit = document.CreatedById == userId ||
                document.Collaborators.Any(c => c.UserId == userId && (c.Role == "owner" || c.Role == "editor"));

            if (!canEdit)
                return Forbid();

            if (dto.Title != null)
                document.Title = dto.Title;
            if (dto.Description != null)
                document.Description = dto.Description;
            if (dto.IsPublic.HasValue)
                document.IsPublic = dto.IsPublic.Value;

            document.UpdatedAt = DateTime.UtcNow;
            document.LastModifiedById = userId;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Document updated" });
        }

        // DELETE: api/collaborativedocs/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDocument(int id)
        {
            var userId = GetCurrentUserId();

            var document = await _context.CollaborativeDocuments
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (document == null)
                return NotFound(new { message = "Document not found" });

            // Only owner can delete
            if (document.CreatedById != userId)
                return Forbid();

            document.IsDeleted = true;
            document.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("User {UserId} deleted document {DocumentId}", userId, document.Id);

            return Ok(new { message = "Document deleted" });
        }

        // POST: api/collaborativedocs/{id}/snapshot
        [HttpPost("{id}/snapshot")]
        public async Task<ActionResult<DocumentSnapshotDto>> SaveSnapshot(int id, [FromBody] SaveSnapshotDto dto)
        {
            var userId = GetCurrentUserId();

            var document = await _context.CollaborativeDocuments
                .Include(d => d.Collaborators)
                .Include(d => d.Snapshots.OrderByDescending(s => s.Version).Take(1))
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (document == null)
                return NotFound(new { message = "Document not found" });

            // Check if user can edit
            var canEdit = document.CreatedById == userId ||
                document.Collaborators.Any(c => c.UserId == userId && (c.Role == "owner" || c.Role == "editor")) ||
                document.IsPublic;

            if (!canEdit)
                return Forbid();

            var currentVersion = document.Snapshots.FirstOrDefault()?.Version ?? 0;

            var snapshot = new DocumentSnapshot
            {
                DocumentId = id,
                YjsState = dto.YjsState,
                Version = currentVersion + 1,
                CreatedAt = DateTime.UtcNow,
                CreatedById = userId
            };

            _context.DocumentSnapshots.Add(snapshot);

            document.UpdatedAt = DateTime.UtcNow;
            document.LastModifiedById = userId;

            await _context.SaveChangesAsync();

            // Clean up old snapshots (keep last 10)
            var oldSnapshots = await _context.DocumentSnapshots
                .Where(s => s.DocumentId == id)
                .OrderByDescending(s => s.Version)
                .Skip(10)
                .ToListAsync();

            if (oldSnapshots.Any())
            {
                _context.DocumentSnapshots.RemoveRange(oldSnapshots);
                await _context.SaveChangesAsync();
            }

            return Ok(new DocumentSnapshotDto
            {
                Id = snapshot.Id,
                DocumentId = snapshot.DocumentId,
                YjsState = snapshot.YjsState,
                Version = snapshot.Version,
                CreatedAt = snapshot.CreatedAt
            });
        }

        // GET: api/collaborativedocs/{id}/snapshot
        [HttpGet("{id}/snapshot")]
        public async Task<ActionResult<DocumentSnapshotDto>> GetLatestSnapshot(int id)
        {
            var userId = GetCurrentUserId();

            var document = await _context.CollaborativeDocuments
                .AsNoTracking()
                .Include(d => d.Collaborators)
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (document == null)
                return NotFound(new { message = "Document not found" });

            // Check access
            if (!document.IsPublic &&
                document.CreatedById != userId &&
                !document.Collaborators.Any(c => c.UserId == userId))
            {
                return Forbid();
            }

            var snapshot = await _context.DocumentSnapshots
                .AsNoTracking()
                .Where(s => s.DocumentId == id)
                .OrderByDescending(s => s.Version)
                .FirstOrDefaultAsync();

            if (snapshot == null)
                return Ok(new DocumentSnapshotDto
                {
                    DocumentId = id,
                    YjsState = "",
                    Version = 0
                });

            return Ok(new DocumentSnapshotDto
            {
                Id = snapshot.Id,
                DocumentId = snapshot.DocumentId,
                YjsState = snapshot.YjsState,
                Version = snapshot.Version,
                CreatedAt = snapshot.CreatedAt
            });
        }

        // POST: api/collaborativedocs/{id}/collaborators
        [HttpPost("{id}/collaborators")]
        public async Task<IActionResult> AddCollaborator(int id, [FromBody] AddCollaboratorDto dto)
        {
            var userId = GetCurrentUserId();

            var document = await _context.CollaborativeDocuments
                .Include(d => d.Collaborators)
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (document == null)
                return NotFound(new { message = "Document not found" });

            // Only owner can add collaborators
            if (document.CreatedById != userId &&
                !document.Collaborators.Any(c => c.UserId == userId && c.Role == "owner"))
            {
                return Forbid();
            }

            // Check if user exists
            var user = await _context.Users.FindAsync(dto.UserId);
            if (user == null)
                return NotFound(new { message = "User not found" });

            // Check if already a collaborator
            if (document.Collaborators.Any(c => c.UserId == dto.UserId))
                return BadRequest(new { message = "User is already a collaborator" });

            var collaborator = new DocumentCollaborator
            {
                DocumentId = id,
                UserId = dto.UserId,
                Role = dto.Role,
                AddedAt = DateTime.UtcNow
            };

            _context.DocumentCollaborators.Add(collaborator);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Collaborator added" });
        }

        // DELETE: api/collaborativedocs/{id}/collaborators/{collaboratorId}
        [HttpDelete("{id}/collaborators/{collaboratorId}")]
        public async Task<IActionResult> RemoveCollaborator(int id, int collaboratorId)
        {
            var userId = GetCurrentUserId();

            var document = await _context.CollaborativeDocuments
                .Include(d => d.Collaborators)
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (document == null)
                return NotFound(new { message = "Document not found" });

            // Only owner can remove collaborators
            if (document.CreatedById != userId &&
                !document.Collaborators.Any(c => c.UserId == userId && c.Role == "owner"))
            {
                return Forbid();
            }

            var collaborator = document.Collaborators.FirstOrDefault(c => c.Id == collaboratorId);
            if (collaborator == null)
                return NotFound(new { message = "Collaborator not found" });

            _context.DocumentCollaborators.Remove(collaborator);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Collaborator removed" });
        }

        // GET: api/collaborativedocs/users (for adding collaborators)
        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<object>>> GetUsers([FromQuery] string? search)
        {
            var query = _context.Users.Where(u => u.IsActive);

            if (!string.IsNullOrWhiteSpace(search))
            {
                search = search.ToLower();
                query = query.Where(u =>
                    u.FullName.ToLower().Contains(search) ||
                    u.Email.ToLower().Contains(search));
            }

            var users = await query
                .Take(20)
                .Select(u => new
                {
                    Id = u.UserId,
                    FullName = u.Name + " " + u.Surname,
                    u.Email,
                    Department = u.Department != null ? u.Department.Name : null
                })
                .ToListAsync();

            return Ok(users);
        }

        // POST: api/collaborativedocs/{id}/email
        [HttpPost("{id}/email")]
        public async Task<IActionResult> SendDocumentEmail(int id, [FromBody] SendDocumentEmailDto dto)
        {
            var userId = GetCurrentUserId();

            var document = await _context.CollaborativeDocuments
                .Include(d => d.Collaborators)
                .FirstOrDefaultAsync(d => d.Id == id && !d.IsDeleted);

            if (document == null)
                return NotFound(new { message = "Document not found" });

            // Check access
            if (!document.IsPublic &&
                document.CreatedById != userId &&
                !document.Collaborators.Any(c => c.UserId == userId))
            {
                return Forbid();
            }

            if (dto.To == null || !dto.To.Any(t => !string.IsNullOrWhiteSpace(t)))
                return BadRequest(new { message = "At least one recipient is required" });

            try
            {
                // Global email kill switch
                if (!_configuration.GetValue<bool>("EmailEnabled", true))
                    return Ok(new { message = "Email module is currently disabled. Document was not sent." });

                // Get sender info
                var sender = await _context.Users.FindAsync(userId);
                var senderName = sender?.FullName ?? "ProMed User";

                // Read AIEmail config for sending
                var smtpHost = _configuration["AIEmail:SmtpHost"] ?? "mail.promedtechnologies.co.za";
                var smtpPort = int.Parse(_configuration["AIEmail:SmtpPort"] ?? "587");
                var senderEmail = _configuration["AIEmail:SenderEmail"] ?? "ai@promedtechnologies.co.za";
                var senderDisplayName = _configuration["AIEmail:SenderName"] ?? "Welly - ProMed AI Assistant";
                var senderPassword = _configuration["AIEmail:SenderPassword"] ?? "";
                var enableSsl = bool.Parse(_configuration["AIEmail:EnableSsl"] ?? "true");

                using var message = new MailMessage();
                message.From = new MailAddress(senderEmail, $"{senderName} via Welly");

                foreach (var to in dto.To.Where(t => !string.IsNullOrWhiteSpace(t)))
                    message.To.Add(to.Trim());

                if (dto.Cc != null)
                {
                    foreach (var cc in dto.Cc.Where(c => !string.IsNullOrWhiteSpace(c)))
                        message.CC.Add(cc.Trim());
                }

                message.Subject = dto.Subject;
                message.IsBodyHtml = true;

                // Build email body
                var emailBody = new StringBuilder();
                emailBody.Append(@"<!DOCTYPE html><html><head><meta charset='utf-8'><style>
                    body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; }
                    .email-wrapper { max-width: 680px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px 24px; border-radius: 8px 8px 0 0; }
                    .header h2 { margin: 0 0 4px 0; font-size: 18px; }
                    .header p { margin: 0; font-size: 12px; opacity: 0.85; }
                    .content { background: #ffffff; border: 1px solid #e0e0e0; border-top: none; padding: 24px; border-radius: 0 0 8px 8px; }
                    .message { margin-bottom: 20px; white-space: pre-wrap; }
                    .document-section { margin-top: 20px; padding-top: 20px; border-top: 2px solid #667eea; }
                    .document-section h3 { color: #667eea; margin: 0 0 12px 0; font-size: 14px; }
                    .document-content { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 6px; padding: 20px; }
                    .footer { text-align: center; padding: 16px; color: #999; font-size: 11px; }
                </style></head><body><div class='email-wrapper'>");

                emailBody.Append($"<div class='header'><h2>{System.Web.HttpUtility.HtmlEncode(dto.Subject)}</h2>");
                emailBody.Append($"<p>Sent by {System.Web.HttpUtility.HtmlEncode(senderName)} via ProMed Documents</p></div>");
                emailBody.Append("<div class='content'>");

                if (!string.IsNullOrWhiteSpace(dto.Body))
                {
                    emailBody.Append($"<div class='message'>{System.Web.HttpUtility.HtmlEncode(dto.Body)}</div>");
                }

                if (dto.IncludeInBody && !string.IsNullOrEmpty(dto.HtmlContent))
                {
                    emailBody.Append("<div class='document-section'>");
                    emailBody.Append($"<h3>📄 {System.Web.HttpUtility.HtmlEncode(document.Title)}</h3>");
                    emailBody.Append($"<div class='document-content'>{dto.HtmlContent}</div>");
                    emailBody.Append("</div>");
                }

                emailBody.Append("</div>");
                emailBody.Append("<div class='footer'>Sent from ProMed Technologies Intranet — Powered by Welly AI</div>");
                emailBody.Append("</div></body></html>");

                message.Body = emailBody.ToString();

                // Attach document as HTML file if requested
                if (dto.AttachDocument && !string.IsNullOrEmpty(dto.HtmlContent))
                {
                    var docHtml = $@"<!DOCTYPE html><html><head><meta charset='utf-8'>
                        <title>{System.Web.HttpUtility.HtmlEncode(document.Title)}</title>
                        <style>body {{ font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; line-height: 1.6; }} h1,h2,h3 {{ color: #1a1a2e; }} table {{ border-collapse: collapse; width: 100%; }} td,th {{ border: 1px solid #ddd; padding: 8px; }}</style>
                        </head><body>{dto.HtmlContent}</body></html>";

                    var fileName = (document.Title ?? "Document").Replace(" ", "_") + ".html";
                    var bytes = Encoding.UTF8.GetBytes(docHtml);
                    var stream = new MemoryStream(bytes);
                    message.Attachments.Add(new Attachment(stream, fileName, "text/html"));
                }

                using var client = new SmtpClient(smtpHost, smtpPort);
                client.EnableSsl = enableSsl;
                client.UseDefaultCredentials = false;
                if (!string.IsNullOrEmpty(senderPassword))
                    client.Credentials = new NetworkCredential(senderEmail, senderPassword);

                await client.SendMailAsync(message);

                _logger.LogInformation("User {UserId} emailed document {DocumentId} to {Recipients}",
                    userId, id, string.Join(", ", dto.To));

                return Ok(new { message = "Email sent successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send document email for document {DocumentId}", id);
                return StatusCode(500, new { message = "Failed to send email. Please try again.", error = ex.Message });
            }
        }
    }
}
