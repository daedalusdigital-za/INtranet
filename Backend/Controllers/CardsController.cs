using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.DTOs.Boards;
using ProjectTracker.API.Hubs;
using ProjectTracker.API.Models;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize] // Disabled temporarily
    public class CardsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IHubContext<BoardHub> _hubContext;

        public CardsController(ApplicationDbContext context, IHubContext<BoardHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<CardDetailDto>> GetCard(int id)
        {
            var card = await _context.Cards
                .Include(c => c.CreatedBy)
                .Include(c => c.AssignedTo)
                .Include(c => c.Comments).ThenInclude(cc => cc.User)
                .Include(c => c.Attachments).ThenInclude(ca => ca.UploadedBy)
                .Where(c => c.CardId == id)
                .Select(c => new CardDetailDto
                {
                    CardId = c.CardId,
                    ListId = c.ListId,
                    Title = c.Title,
                    Description = c.Description,
                    CreatedByUserId = c.CreatedByUserId,
                    CreatedByName = c.CreatedBy != null ? c.CreatedBy.Name : null,
                    AssignedToUserId = c.AssignedToUserId,
                    AssignedToName = c.AssignedTo != null ? c.AssignedTo.Name : null,
                    DueDate = c.DueDate,
                    Status = c.Status,
                    Position = c.Position,
                    CommentCount = c.Comments.Count,
                    AttachmentCount = c.Attachments.Count,
                    CreatedAt = c.CreatedAt,
                    Comments = c.Comments.Select(cc => new CommentDto
                    {
                        CommentId = cc.CommentId,
                        CardId = cc.CardId,
                        UserId = cc.UserId,
                        UserName = cc.User.Name,
                        Content = cc.Content,
                        CreatedAt = cc.CreatedAt
                    }).ToList(),
                    Attachments = c.Attachments.Select(ca => new AttachmentDto
                    {
                        AttachmentId = ca.AttachmentId,
                        CardId = ca.CardId,
                        FileName = ca.FileName,
                        FileUrl = ca.FileUrl,
                        FileType = ca.FileType,
                        FileSize = ca.FileSize,
                        UploadedByUserName = ca.UploadedBy.Name,
                        CreatedAt = ca.CreatedAt
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            if (card == null)
            {
                return NotFound();
            }

            return Ok(card);
        }

        [HttpPost]
        public async Task<ActionResult<CardDto>> CreateCard([FromBody] CreateCardDto createCardDto)
        {
            // Get the board ID for the list
            var list = await _context.Lists
                .Include(l => l.Board)
                .FirstOrDefaultAsync(l => l.ListId == createCardDto.ListId);
            
            if (list == null)
            {
                return NotFound("List not found");
            }

            var boardId = list.BoardId;

            // Invite users to the board if specified
            if (createCardDto.InviteUserIds != null && createCardDto.InviteUserIds.Count > 0)
            {
                foreach (var inviteUserId in createCardDto.InviteUserIds)
                {
                    // Check if user exists
                    var inviteUser = await _context.Users.FindAsync(inviteUserId);
                    if (inviteUser == null) continue;

                    // Check if already a member
                    var existingMember = await _context.BoardMembers
                        .FirstOrDefaultAsync(m => m.BoardId == boardId && m.UserId == inviteUserId);
                    
                    if (existingMember == null)
                    {
                        var member = new BoardMember
                        {
                            BoardId = boardId,
                            UserId = inviteUserId,
                            Role = "Member",
                            InvitedAt = DateTime.UtcNow,
                            InvitedByUserId = createCardDto.CreatedByUserId
                        };
                        _context.BoardMembers.Add(member);
                    }
                }
            }

            var card = new Card
            {
                ListId = createCardDto.ListId,
                Title = createCardDto.Title,
                Description = createCardDto.Description,
                CreatedByUserId = createCardDto.CreatedByUserId,
                AssignedToUserId = createCardDto.AssignedToUserId,
                DueDate = createCardDto.DueDate,
                Position = createCardDto.Position,
                Status = "Active",
                CreatedAt = DateTime.UtcNow
            };

            _context.Cards.Add(card);
            await _context.SaveChangesAsync();

            // Get creator and assignee names
            string? creatorName = null;
            string? assigneeName = null;

            if (createCardDto.CreatedByUserId.HasValue)
            {
                var creator = await _context.Users.FindAsync(createCardDto.CreatedByUserId.Value);
                creatorName = creator?.Name;
            }

            if (createCardDto.AssignedToUserId.HasValue)
            {
                var assignee = await _context.Users.FindAsync(createCardDto.AssignedToUserId.Value);
                assigneeName = assignee?.Name;
            }

            // Create audit log
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            await CreateAuditLog(userId, "Created", "Card", card.CardId, $"Created card: {card.Title}");

            // Notify via SignalR
            var cardDto = new CardDto
            {
                CardId = card.CardId,
                ListId = card.ListId,
                Title = card.Title,
                Description = card.Description,
                CreatedByUserId = card.CreatedByUserId,
                CreatedByName = creatorName,
                AssignedToUserId = card.AssignedToUserId,
                AssignedToName = assigneeName,
                DueDate = card.DueDate,
                Status = card.Status,
                Position = card.Position,
                CommentCount = 0,
                AttachmentCount = 0,
                CreatedAt = card.CreatedAt
            };

            await _hubContext.Clients.Group($"Board_{boardId}").SendAsync("CardCreated", cardDto);

            return CreatedAtAction(nameof(GetCard), new { id = card.CardId }, cardDto);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateCard(int id, [FromBody] CreateCardDto updateCardDto)
        {
            var card = await _context.Cards.FindAsync(id);
            if (card == null)
            {
                return NotFound();
            }

            card.Title = updateCardDto.Title;
            card.Description = updateCardDto.Description;
            card.AssignedToUserId = updateCardDto.AssignedToUserId;
            card.DueDate = updateCardDto.DueDate;
            card.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Create audit log
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            await CreateAuditLog(userId, "Updated", "Card", card.CardId, $"Updated card: {card.Title}");

            // Get board ID for SignalR
            var boardId = await _context.Lists
                .Where(l => l.ListId == card.ListId)
                .Select(l => l.BoardId)
                .FirstOrDefaultAsync();

            // Notify via SignalR
            await _hubContext.Clients.Group($"Board_{boardId}").SendAsync("CardUpdated", card);

            return NoContent();
        }

        [HttpPut("{id}/move")]
        public async Task<IActionResult> MoveCard(int id, [FromBody] MoveCardDto moveCardDto)
        {
            var card = await _context.Cards.FindAsync(id);
            if (card == null)
            {
                return NotFound();
            }

            var oldListId = card.ListId;
            card.ListId = moveCardDto.TargetListId;
            card.Position = moveCardDto.Position;
            card.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Create audit log
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            await CreateAuditLog(userId, "Moved", "Card", card.CardId, 
                $"Moved card: {card.Title} from list {oldListId} to list {moveCardDto.TargetListId}");

            // Get board ID for SignalR
            var boardId = await _context.Lists
                .Where(l => l.ListId == card.ListId)
                .Select(l => l.BoardId)
                .FirstOrDefaultAsync();

            // Notify via SignalR
            await _hubContext.Clients.Group($"Board_{boardId}").SendAsync("CardMoved", card);

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCard(int id)
        {
            var card = await _context.Cards.FindAsync(id);
            if (card == null)
            {
                return NotFound();
            }

            var boardId = await _context.Lists
                .Where(l => l.ListId == card.ListId)
                .Select(l => l.BoardId)
                .FirstOrDefaultAsync();

            _context.Cards.Remove(card);
            await _context.SaveChangesAsync();

            // Create audit log
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
            await CreateAuditLog(userId, "Deleted", "Card", id, $"Deleted card: {card.Title}");

            // Notify via SignalR
            await _hubContext.Clients.Group($"Board_{boardId}").SendAsync("CardDeleted", id);

            return NoContent();
        }

        [HttpPost("{id}/comments")]
        public async Task<ActionResult<CommentDto>> AddComment(int id, [FromBody] CreateCommentDto createCommentDto)
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

            var comment = new CardComment
            {
                CardId = id,
                UserId = userId,
                Content = createCommentDto.Content,
                CreatedAt = DateTime.UtcNow
            };

            _context.CardComments.Add(comment);
            await _context.SaveChangesAsync();

            var commentDto = await _context.CardComments
                .Where(c => c.CommentId == comment.CommentId)
                .Select(c => new CommentDto
                {
                    CommentId = c.CommentId,
                    CardId = c.CardId,
                    UserId = c.UserId,
                    UserName = c.User.Name,
                    Content = c.Content,
                    CreatedAt = c.CreatedAt
                })
                .FirstOrDefaultAsync();

            // Get board ID for SignalR
            var boardId = await _context.Cards
                .Where(c => c.CardId == id)
                .Select(c => c.List.BoardId)
                .FirstOrDefaultAsync();

            // Notify via SignalR
            await _hubContext.Clients.Group($"Board_{boardId}").SendAsync("CommentAdded", commentDto);

            return Ok(commentDto);
        }

        private async Task CreateAuditLog(int userId, string action, string entityType, int entityId, string details)
        {
            var auditLog = new AuditLog
            {
                UserId = userId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                Details = details,
                CreatedAt = DateTime.UtcNow
            };

            _context.AuditLogs.Add(auditLog);
            await _context.SaveChangesAsync();
        }
    }
}
