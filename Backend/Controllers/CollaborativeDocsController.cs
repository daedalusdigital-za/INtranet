using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class CollaborativeDocsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<CollaborativeDocsController> _logger;

        public CollaborativeDocsController(ApplicationDbContext context, ILogger<CollaborativeDocsController> logger)
        {
            _context = context;
            _logger = logger;
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
    }
}
