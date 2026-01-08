using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SupportTicketsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<SupportTicketsController> _logger;

        public SupportTicketsController(ApplicationDbContext context, ILogger<SupportTicketsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/supporttickets
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SupportTicketDto>>> GetTickets([FromQuery] TicketFilterRequest? filter)
        {
            var query = _context.SupportTickets
                .Include(t => t.Comments)
                .AsQueryable();

            // Apply filters
            if (filter != null)
            {
                if (!string.IsNullOrEmpty(filter.Status))
                    query = query.Where(t => t.Status == filter.Status);

                if (!string.IsNullOrEmpty(filter.Priority))
                    query = query.Where(t => t.Priority == filter.Priority);

                if (!string.IsNullOrEmpty(filter.Category))
                    query = query.Where(t => t.Category == filter.Category);

                if (filter.FromDate.HasValue)
                    query = query.Where(t => t.SubmittedDate >= filter.FromDate.Value);

                if (filter.ToDate.HasValue)
                    query = query.Where(t => t.SubmittedDate <= filter.ToDate.Value);

                if (!string.IsNullOrEmpty(filter.SubmittedBy))
                    query = query.Where(t => t.SubmittedBy.Contains(filter.SubmittedBy));

                if (!string.IsNullOrEmpty(filter.AssignedTo))
                    query = query.Where(t => t.AssignedTo != null && t.AssignedTo.Contains(filter.AssignedTo));
            }

            var tickets = await query
                .OrderByDescending(t => t.SubmittedDate)
                .ToListAsync();

            return Ok(tickets.Select(MapToDto));
        }

        // GET: api/supporttickets/open
        [HttpGet("open")]
        public async Task<ActionResult<IEnumerable<SupportTicketDto>>> GetOpenTickets()
        {
            var tickets = await _context.SupportTickets
                .Include(t => t.Comments)
                .Where(t => t.Status == "Open" || t.Status == "InProgress")
                .OrderByDescending(t => t.SubmittedDate)
                .ToListAsync();

            return Ok(tickets.Select(MapToDto));
        }

        // GET: api/supporttickets/closed
        [HttpGet("closed")]
        public async Task<ActionResult<IEnumerable<SupportTicketDto>>> GetClosedTickets()
        {
            var tickets = await _context.SupportTickets
                .Include(t => t.Comments)
                .Where(t => t.Status == "Closed" || t.Status == "Resolved")
                .OrderByDescending(t => t.ClosedDate ?? t.ResolvedDate ?? t.SubmittedDate)
                .ToListAsync();

            return Ok(tickets.Select(MapToDto));
        }

        // GET: api/supporttickets/5
        [HttpGet("{id}")]
        public async Task<ActionResult<SupportTicketDto>> GetTicket(int id)
        {
            var ticket = await _context.SupportTickets
                .Include(t => t.Comments.OrderByDescending(c => c.CreatedAt))
                .FirstOrDefaultAsync(t => t.TicketId == id);

            if (ticket == null)
            {
                return NotFound();
            }

            return Ok(MapToDto(ticket));
        }

        // GET: api/supporttickets/statistics
        [HttpGet("statistics")]
        public async Task<ActionResult<TicketStatisticsDto>> GetStatistics([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate)
        {
            var query = _context.SupportTickets.AsQueryable();

            if (fromDate.HasValue)
                query = query.Where(t => t.SubmittedDate >= fromDate.Value);

            if (toDate.HasValue)
                query = query.Where(t => t.SubmittedDate <= toDate.Value);

            var tickets = await query.ToListAsync();

            var stats = new TicketStatisticsDto
            {
                TotalTickets = tickets.Count,
                OpenTickets = tickets.Count(t => t.Status == "Open"),
                InProgressTickets = tickets.Count(t => t.Status == "InProgress"),
                ResolvedTickets = tickets.Count(t => t.Status == "Resolved"),
                ClosedTickets = tickets.Count(t => t.Status == "Closed"),
                TicketsByCategory = tickets.GroupBy(t => t.Category)
                    .ToDictionary(g => g.Key, g => g.Count()),
                TicketsByPriority = tickets.GroupBy(t => t.Priority)
                    .ToDictionary(g => g.Key, g => g.Count())
            };

            // Calculate average response time
            var ticketsWithResponse = tickets.Where(t => t.FirstResponseDate.HasValue).ToList();
            if (ticketsWithResponse.Any())
            {
                stats.AverageResponseTimeHours = ticketsWithResponse
                    .Average(t => (t.FirstResponseDate!.Value - t.SubmittedDate).TotalHours);
            }

            // Calculate average resolution time
            var resolvedTickets = tickets.Where(t => t.ResolvedDate.HasValue || t.ClosedDate.HasValue).ToList();
            if (resolvedTickets.Any())
            {
                stats.AverageResolutionTimeHours = resolvedTickets
                    .Average(t => ((t.ResolvedDate ?? t.ClosedDate)!.Value - t.SubmittedDate).TotalHours);
            }

            // Resolution rate
            if (tickets.Count > 0)
            {
                stats.ResolutionRate = (double)(stats.ResolvedTickets + stats.ClosedTickets) / tickets.Count * 100;
            }

            return Ok(stats);
        }

        // POST: api/supporttickets
        [HttpPost]
        public async Task<ActionResult<SupportTicketDto>> CreateTicket(CreateTicketRequest request)
        {
            var ticket = new SupportTicket
            {
                Title = request.Title,
                Description = request.Description,
                Priority = request.Priority,
                Category = request.Category,
                SubmittedBy = request.SubmittedBy,
                SubmittedByEmail = request.SubmittedByEmail,
                Status = "Open",
                SubmittedDate = DateTime.UtcNow,
                LastUpdated = DateTime.UtcNow
            };

            _context.SupportTickets.Add(ticket);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Support ticket {TicketId} created by {SubmittedBy}", ticket.TicketId, ticket.SubmittedBy);

            return CreatedAtAction(nameof(GetTicket), new { id = ticket.TicketId }, MapToDto(ticket));
        }

        // PUT: api/supporttickets/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTicket(int id, UpdateTicketRequest request)
        {
            var ticket = await _context.SupportTickets.FindAsync(id);

            if (ticket == null)
            {
                return NotFound();
            }

            // Update fields if provided
            if (!string.IsNullOrEmpty(request.Title))
                ticket.Title = request.Title;

            if (!string.IsNullOrEmpty(request.Description))
                ticket.Description = request.Description;

            if (!string.IsNullOrEmpty(request.Priority))
                ticket.Priority = request.Priority;

            if (!string.IsNullOrEmpty(request.Category))
                ticket.Category = request.Category;

            if (!string.IsNullOrEmpty(request.AssignedTo))
                ticket.AssignedTo = request.AssignedTo;

            if (!string.IsNullOrEmpty(request.Resolution))
                ticket.Resolution = request.Resolution;

            // Handle status changes
            if (!string.IsNullOrEmpty(request.Status))
            {
                var oldStatus = ticket.Status;
                ticket.Status = request.Status;

                // Set first response date if moving from Open
                if (oldStatus == "Open" && request.Status != "Open" && !ticket.FirstResponseDate.HasValue)
                {
                    ticket.FirstResponseDate = DateTime.UtcNow;
                }

                // Set resolved date
                if (request.Status == "Resolved" && !ticket.ResolvedDate.HasValue)
                {
                    ticket.ResolvedDate = DateTime.UtcNow;
                }

                // Set closed date
                if (request.Status == "Closed" && !ticket.ClosedDate.HasValue)
                {
                    ticket.ClosedDate = DateTime.UtcNow;
                }
            }

            ticket.LastUpdated = DateTime.UtcNow;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!await TicketExists(id))
                    return NotFound();
                throw;
            }

            _logger.LogInformation("Support ticket {TicketId} updated", id);
            return NoContent();
        }

        // POST: api/supporttickets/5/close
        [HttpPost("{id}/close")]
        public async Task<IActionResult> CloseTicket(int id, [FromBody] string? resolution = null)
        {
            var ticket = await _context.SupportTickets.FindAsync(id);

            if (ticket == null)
            {
                return NotFound();
            }

            ticket.Status = "Closed";
            ticket.ClosedDate = DateTime.UtcNow;
            ticket.LastUpdated = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(resolution))
            {
                ticket.Resolution = resolution;
            }

            await _context.SaveChangesAsync();

            _logger.LogInformation("Support ticket {TicketId} closed", id);
            return NoContent();
        }

        // POST: api/supporttickets/5/reopen
        [HttpPost("{id}/reopen")]
        public async Task<IActionResult> ReopenTicket(int id)
        {
            var ticket = await _context.SupportTickets.FindAsync(id);

            if (ticket == null)
            {
                return NotFound();
            }

            ticket.Status = "Open";
            ticket.ClosedDate = null;
            ticket.ResolvedDate = null;
            ticket.LastUpdated = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            _logger.LogInformation("Support ticket {TicketId} reopened", id);
            return NoContent();
        }

        // POST: api/supporttickets/5/comments
        [HttpPost("{id}/comments")]
        public async Task<ActionResult<TicketCommentDto>> AddComment(int id, AddTicketCommentRequest request)
        {
            var ticket = await _context.SupportTickets.FindAsync(id);

            if (ticket == null)
            {
                return NotFound();
            }

            var comment = new TicketComment
            {
                TicketId = id,
                Content = request.Content,
                Author = request.Author,
                IsInternal = request.IsInternal,
                CreatedAt = DateTime.UtcNow
            };

            // Set first response date if this is first IT response
            if (!ticket.FirstResponseDate.HasValue && ticket.SubmittedBy != request.Author)
            {
                ticket.FirstResponseDate = DateTime.UtcNow;
            }

            ticket.LastUpdated = DateTime.UtcNow;

            _context.TicketComments.Add(comment);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Comment added to ticket {TicketId} by {Author}", id, request.Author);

            return Ok(new TicketCommentDto
            {
                CommentId = comment.CommentId,
                TicketId = comment.TicketId,
                Content = comment.Content,
                Author = comment.Author,
                CreatedAt = comment.CreatedAt,
                IsInternal = comment.IsInternal
            });
        }

        // DELETE: api/supporttickets/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTicket(int id)
        {
            var ticket = await _context.SupportTickets
                .Include(t => t.Comments)
                .FirstOrDefaultAsync(t => t.TicketId == id);

            if (ticket == null)
            {
                return NotFound();
            }

            _context.SupportTickets.Remove(ticket);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Support ticket {TicketId} deleted", id);
            return NoContent();
        }

        private async Task<bool> TicketExists(int id)
        {
            return await _context.SupportTickets.AnyAsync(t => t.TicketId == id);
        }

        private static SupportTicketDto MapToDto(SupportTicket ticket)
        {
            return new SupportTicketDto
            {
                TicketId = ticket.TicketId,
                Title = ticket.Title,
                Description = ticket.Description,
                Priority = ticket.Priority,
                Status = ticket.Status,
                Category = ticket.Category,
                SubmittedBy = ticket.SubmittedBy,
                SubmittedByEmail = ticket.SubmittedByEmail,
                AssignedTo = ticket.AssignedTo,
                SubmittedDate = ticket.SubmittedDate,
                FirstResponseDate = ticket.FirstResponseDate,
                ResolvedDate = ticket.ResolvedDate,
                ClosedDate = ticket.ClosedDate,
                LastUpdated = ticket.LastUpdated,
                Resolution = ticket.Resolution,
                Comments = ticket.Comments?.Select(c => new TicketCommentDto
                {
                    CommentId = c.CommentId,
                    TicketId = c.TicketId,
                    Content = c.Content,
                    Author = c.Author,
                    CreatedAt = c.CreatedAt,
                    IsInternal = c.IsInternal
                }).ToList() ?? new List<TicketCommentDto>()
            };
        }
    }
}
