using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AnnouncementsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<AnnouncementsController> _logger;

        public AnnouncementsController(ApplicationDbContext context, ILogger<AnnouncementsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(userIdClaim, out var userId) ? userId : 0;
        }

        // GET: api/announcements
        [HttpGet]
        public async Task<ActionResult<IEnumerable<AnnouncementListDto>>> GetAnnouncements(
            [FromQuery] bool activeOnly = true,
            [FromQuery] int limit = 50)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var query = _context.Announcements
                    .Include(a => a.CreatedByUser)
                    .Include(a => a.ReadByUsers)
                    .AsQueryable();

                if (activeOnly)
                {
                    query = query.Where(a => a.IsActive && 
                        (a.ExpiresAt == null || a.ExpiresAt > DateTime.UtcNow));
                }

                var announcements = await query
                    .OrderByDescending(a => a.CreatedAt)
                    .Take(limit)
                    .Select(a => new AnnouncementListDto
                    {
                        AnnouncementId = a.AnnouncementId,
                        Title = a.Title,
                        Content = a.Content,
                        CreatedByName = a.CreatedByUser != null 
                            ? $"{a.CreatedByUser.Name} {a.CreatedByUser.Surname}" 
                            : "Unknown",
                        CreatedAt = a.CreatedAt,
                        Priority = a.Priority,
                        Category = a.Category,
                        IsRead = a.ReadByUsers.Any(r => r.UserId == currentUserId)
                    })
                    .ToListAsync();

                return Ok(announcements);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving announcements");
                return StatusCode(500, "An error occurred while retrieving announcements");
            }
        }

        // GET: api/announcements/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<AnnouncementDto>> GetAnnouncement(int id)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                var announcement = await _context.Announcements
                    .Include(a => a.CreatedByUser)
                    .Include(a => a.ReadByUsers)
                    .FirstOrDefaultAsync(a => a.AnnouncementId == id);

                if (announcement == null)
                {
                    return NotFound();
                }

                var dto = new AnnouncementDto
                {
                    AnnouncementId = announcement.AnnouncementId,
                    Title = announcement.Title,
                    Content = announcement.Content,
                    CreatedByUserId = announcement.CreatedByUserId,
                    CreatedByName = announcement.CreatedByUser != null 
                        ? $"{announcement.CreatedByUser.Name} {announcement.CreatedByUser.Surname}" 
                        : "Unknown",
                    CreatedByProfilePicture = announcement.CreatedByUser?.ProfilePictureUrl,
                    CreatedAt = announcement.CreatedAt,
                    ExpiresAt = announcement.ExpiresAt,
                    Priority = announcement.Priority,
                    IsActive = announcement.IsActive,
                    Category = announcement.Category,
                    ReadCount = announcement.ReadByUsers.Count,
                    IsRead = announcement.ReadByUsers.Any(r => r.UserId == currentUserId)
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving announcement {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the announcement");
            }
        }

        // POST: api/announcements
        [HttpPost]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<AnnouncementDto>> CreateAnnouncement(CreateAnnouncementDto dto)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                if (currentUserId == 0)
                {
                    return Unauthorized();
                }

                var announcement = new Announcement
                {
                    Title = dto.Title,
                    Content = dto.Content,
                    CreatedByUserId = currentUserId,
                    ExpiresAt = dto.ExpiresAt,
                    Priority = dto.Priority,
                    Category = dto.Category,
                    CreatedAt = DateTime.UtcNow,
                    IsActive = true
                };

                _context.Announcements.Add(announcement);
                await _context.SaveChangesAsync();

                // Reload with user data
                await _context.Entry(announcement)
                    .Reference(a => a.CreatedByUser)
                    .LoadAsync();

                var resultDto = new AnnouncementDto
                {
                    AnnouncementId = announcement.AnnouncementId,
                    Title = announcement.Title,
                    Content = announcement.Content,
                    CreatedByUserId = announcement.CreatedByUserId,
                    CreatedByName = announcement.CreatedByUser != null 
                        ? $"{announcement.CreatedByUser.Name} {announcement.CreatedByUser.Surname}" 
                        : "Unknown",
                    CreatedByProfilePicture = announcement.CreatedByUser?.ProfilePictureUrl,
                    CreatedAt = announcement.CreatedAt,
                    ExpiresAt = announcement.ExpiresAt,
                    Priority = announcement.Priority,
                    IsActive = announcement.IsActive,
                    Category = announcement.Category,
                    ReadCount = 0,
                    IsRead = false
                };

                return CreatedAtAction(nameof(GetAnnouncement), 
                    new { id = announcement.AnnouncementId }, resultDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating announcement");
                return StatusCode(500, "An error occurred while creating the announcement");
            }
        }

        // PUT: api/announcements/{id}
        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> UpdateAnnouncement(int id, UpdateAnnouncementDto dto)
        {
            try
            {
                var announcement = await _context.Announcements.FindAsync(id);
                if (announcement == null)
                {
                    return NotFound();
                }

                var currentUserId = GetCurrentUserId();
                // Only creator or admin can update
                if (announcement.CreatedByUserId != currentUserId && 
                    !User.IsInRole("Admin"))
                {
                    return Forbid();
                }

                if (!string.IsNullOrEmpty(dto.Title))
                    announcement.Title = dto.Title;
                
                if (!string.IsNullOrEmpty(dto.Content))
                    announcement.Content = dto.Content;
                
                if (dto.ExpiresAt.HasValue)
                    announcement.ExpiresAt = dto.ExpiresAt;
                
                if (!string.IsNullOrEmpty(dto.Priority))
                    announcement.Priority = dto.Priority;
                
                if (!string.IsNullOrEmpty(dto.Category))
                    announcement.Category = dto.Category;
                
                if (dto.IsActive.HasValue)
                    announcement.IsActive = dto.IsActive.Value;

                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating announcement {Id}", id);
                return StatusCode(500, "An error occurred while updating the announcement");
            }
        }

        // DELETE: api/announcements/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> DeleteAnnouncement(int id)
        {
            try
            {
                var announcement = await _context.Announcements.FindAsync(id);
                if (announcement == null)
                {
                    return NotFound();
                }

                var currentUserId = GetCurrentUserId();
                // Only creator or admin can delete
                if (announcement.CreatedByUserId != currentUserId && 
                    !User.IsInRole("Admin"))
                {
                    return Forbid();
                }

                _context.Announcements.Remove(announcement);
                await _context.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting announcement {Id}", id);
                return StatusCode(500, "An error occurred while deleting the announcement");
            }
        }

        // POST: api/announcements/{id}/mark-read
        [HttpPost("{id}/mark-read")]
        public async Task<IActionResult> MarkAsRead(int id)
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                if (currentUserId == 0)
                {
                    return Unauthorized();
                }

                var announcement = await _context.Announcements.FindAsync(id);
                if (announcement == null)
                {
                    return NotFound();
                }

                // Check if already read
                var existingRead = await _context.AnnouncementReads
                    .FirstOrDefaultAsync(ar => ar.AnnouncementId == id && ar.UserId == currentUserId);

                if (existingRead == null)
                {
                    var announcementRead = new AnnouncementRead
                    {
                        AnnouncementId = id,
                        UserId = currentUserId,
                        ReadAt = DateTime.UtcNow
                    };

                    _context.AnnouncementReads.Add(announcementRead);
                    await _context.SaveChangesAsync();
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking announcement {Id} as read", id);
                return StatusCode(500, "An error occurred while marking the announcement as read");
            }
        }

        // GET: api/announcements/unread-count
        [HttpGet("unread-count")]
        public async Task<ActionResult<int>> GetUnreadCount()
        {
            try
            {
                var currentUserId = GetCurrentUserId();
                if (currentUserId == 0)
                {
                    return Unauthorized();
                }

                var count = await _context.Announcements
                    .Where(a => a.IsActive && 
                        (a.ExpiresAt == null || a.ExpiresAt > DateTime.UtcNow) &&
                        !a.ReadByUsers.Any(r => r.UserId == currentUserId))
                    .CountAsync();

                return Ok(count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting unread announcement count");
                return StatusCode(500, "An error occurred while getting unread count");
            }
        }
    }
}
