using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.DTOs.Boards;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    // [Authorize] // Disabled temporarily
    public class BoardsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public BoardsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<BoardDto>>> GetAllBoards()
        {
            var boards = await _context.Boards
                .Include(b => b.Department)
                .Include(b => b.CreatedBy)
                .Include(b => b.ChecklistItems)
                    .ThenInclude(ci => ci.CompletedBy)
                .Include(b => b.Members)
                    .ThenInclude(m => m.User)
                .Include(b => b.Members)
                    .ThenInclude(m => m.InvitedBy)
                .Include(b => b.Lists.OrderBy(l => l.Position))
                    .ThenInclude(l => l.Cards.OrderBy(c => c.Position))
                        .ThenInclude(c => c.AssignedTo)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                        .ThenInclude(c => c.CreatedBy)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                        .ThenInclude(c => c.Comments)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                        .ThenInclude(c => c.Attachments)
                .Select(b => new BoardDto
                {
                    BoardId = b.BoardId,
                    DepartmentId = b.DepartmentId,
                    DepartmentName = b.Department.Name,
                    Title = b.Title,
                    Description = b.Description,
                    CreatedByUserId = b.CreatedByUserId,
                    CreatedByName = b.CreatedBy != null ? b.CreatedBy.Name : null,
                    Status = b.Status,
                    CreatedAt = b.CreatedAt,
                    TotalChecklistItems = b.ChecklistItems.Count,
                    CompletedChecklistItems = b.ChecklistItems.Count(ci => ci.IsCompleted),
                    Progress = b.ChecklistItems.Count > 0 
                        ? (int)Math.Round((double)b.ChecklistItems.Count(ci => ci.IsCompleted) / b.ChecklistItems.Count * 100) 
                        : 0,
                    ChecklistItems = b.ChecklistItems.OrderBy(ci => ci.Position).Select(ci => new BoardChecklistItemDto
                    {
                        ChecklistItemId = ci.ChecklistItemId,
                        BoardId = ci.BoardId,
                        Title = ci.Title,
                        IsCompleted = ci.IsCompleted,
                        Position = ci.Position,
                        CreatedAt = ci.CreatedAt,
                        CompletedAt = ci.CompletedAt,
                        CompletedByUserId = ci.CompletedByUserId,
                        CompletedByName = ci.CompletedBy != null ? ci.CompletedBy.Name : null
                    }).ToList(),
                    Members = b.Members.Select(m => new BoardMemberDto
                    {
                        BoardMemberId = m.BoardMemberId,
                        BoardId = m.BoardId,
                        UserId = m.UserId,
                        UserName = m.User.Name,
                        UserEmail = m.User.Email,
                        ProfilePictureUrl = m.User.ProfilePictureUrl,
                        Role = m.Role,
                        InvitedAt = m.InvitedAt,
                        InvitedByUserId = m.InvitedByUserId,
                        InvitedByName = m.InvitedBy != null ? m.InvitedBy.Name : null
                    }).ToList(),
                    Lists = b.Lists.OrderBy(l => l.Position).Select(l => new ListDto
                    {
                        ListId = l.ListId,
                        BoardId = l.BoardId,
                        Title = l.Title,
                        Position = l.Position,
                        Cards = l.Cards.OrderBy(c => c.Position).Select(c => new CardDto
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
                            CreatedAt = c.CreatedAt
                        }).ToList()
                    }).ToList()
                })
                .ToListAsync();

            return Ok(boards);
        }

        [HttpGet("department/{departmentId}")]
        public async Task<ActionResult<IEnumerable<BoardDto>>> GetBoardsByDepartment(int departmentId)
        {
            var boards = await _context.Boards
                .Include(b => b.Department)
                .Include(b => b.CreatedBy)
                .Include(b => b.ChecklistItems)
                    .ThenInclude(ci => ci.CompletedBy)
                .Include(b => b.Members)
                    .ThenInclude(m => m.User)
                .Include(b => b.Members)
                    .ThenInclude(m => m.InvitedBy)
                .Include(b => b.Lists.OrderBy(l => l.Position))
                    .ThenInclude(l => l.Cards.OrderBy(c => c.Position))
                        .ThenInclude(c => c.AssignedTo)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                        .ThenInclude(c => c.CreatedBy)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                        .ThenInclude(c => c.Comments)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                        .ThenInclude(c => c.Attachments)
                .Where(b => b.DepartmentId == departmentId)
                .Select(b => new BoardDto
                {
                    BoardId = b.BoardId,
                    DepartmentId = b.DepartmentId,
                    DepartmentName = b.Department.Name,
                    Title = b.Title,
                    Description = b.Description,
                    CreatedByUserId = b.CreatedByUserId,
                    CreatedByName = b.CreatedBy != null ? b.CreatedBy.Name : null,
                    Status = b.Status,
                    CreatedAt = b.CreatedAt,
                    TotalChecklistItems = b.ChecklistItems.Count,
                    CompletedChecklistItems = b.ChecklistItems.Count(ci => ci.IsCompleted),
                    Progress = b.ChecklistItems.Count > 0 
                        ? (int)Math.Round((double)b.ChecklistItems.Count(ci => ci.IsCompleted) / b.ChecklistItems.Count * 100) 
                        : 0,
                    ChecklistItems = b.ChecklistItems.OrderBy(ci => ci.Position).Select(ci => new BoardChecklistItemDto
                    {
                        ChecklistItemId = ci.ChecklistItemId,
                        BoardId = ci.BoardId,
                        Title = ci.Title,
                        IsCompleted = ci.IsCompleted,
                        Position = ci.Position,
                        CreatedAt = ci.CreatedAt,
                        CompletedAt = ci.CompletedAt,
                        CompletedByUserId = ci.CompletedByUserId,
                        CompletedByName = ci.CompletedBy != null ? ci.CompletedBy.Name : null
                    }).ToList(),
                    Members = b.Members.Select(m => new BoardMemberDto
                    {
                        BoardMemberId = m.BoardMemberId,
                        BoardId = m.BoardId,
                        UserId = m.UserId,
                        UserName = m.User.Name,
                        UserEmail = m.User.Email,
                        ProfilePictureUrl = m.User.ProfilePictureUrl,
                        Role = m.Role,
                        InvitedAt = m.InvitedAt,
                        InvitedByUserId = m.InvitedByUserId,
                        InvitedByName = m.InvitedBy != null ? m.InvitedBy.Name : null
                    }).ToList(),
                    Lists = b.Lists.OrderBy(l => l.Position).Select(l => new ListDto
                    {
                        ListId = l.ListId,
                        BoardId = l.BoardId,
                        Title = l.Title,
                        Position = l.Position,
                        Cards = l.Cards.OrderBy(c => c.Position).Select(c => new CardDto
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
                            CreatedAt = c.CreatedAt
                        }).ToList()
                    }).ToList()
                })
                .ToListAsync();

            return Ok(boards);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<BoardDto>> GetBoard(int id)
        {
            var board = await _context.Boards
                .Include(b => b.Department)
                .Include(b => b.CreatedBy)
                .Include(b => b.ChecklistItems)
                    .ThenInclude(ci => ci.CompletedBy)
                .Include(b => b.Members)
                    .ThenInclude(m => m.User)
                .Include(b => b.Members)
                    .ThenInclude(m => m.InvitedBy)
                .Include(b => b.Lists.OrderBy(l => l.Position))
                    .ThenInclude(l => l.Cards.OrderBy(c => c.Position))
                        .ThenInclude(c => c.AssignedTo)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                        .ThenInclude(c => c.CreatedBy)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                        .ThenInclude(c => c.Comments)
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                        .ThenInclude(c => c.Attachments)
                .Where(b => b.BoardId == id)
                .Select(b => new BoardDto
                {
                    BoardId = b.BoardId,
                    DepartmentId = b.DepartmentId,
                    DepartmentName = b.Department.Name,
                    Title = b.Title,
                    Description = b.Description,
                    CreatedByUserId = b.CreatedByUserId,
                    CreatedByName = b.CreatedBy != null ? b.CreatedBy.Name : null,
                    Status = b.Status,
                    CreatedAt = b.CreatedAt,
                    TotalChecklistItems = b.ChecklistItems.Count,
                    CompletedChecklistItems = b.ChecklistItems.Count(ci => ci.IsCompleted),
                    Progress = b.ChecklistItems.Count > 0 
                        ? (int)Math.Round((double)b.ChecklistItems.Count(ci => ci.IsCompleted) / b.ChecklistItems.Count * 100) 
                        : 0,
                    ChecklistItems = b.ChecklistItems.OrderBy(ci => ci.Position).Select(ci => new BoardChecklistItemDto
                    {
                        ChecklistItemId = ci.ChecklistItemId,
                        BoardId = ci.BoardId,
                        Title = ci.Title,
                        IsCompleted = ci.IsCompleted,
                        Position = ci.Position,
                        CreatedAt = ci.CreatedAt,
                        CompletedAt = ci.CompletedAt,
                        CompletedByUserId = ci.CompletedByUserId,
                        CompletedByName = ci.CompletedBy != null ? ci.CompletedBy.Name : null
                    }).ToList(),
                    Members = b.Members.Select(m => new BoardMemberDto
                    {
                        BoardMemberId = m.BoardMemberId,
                        BoardId = m.BoardId,
                        UserId = m.UserId,
                        UserName = m.User.Name,
                        UserEmail = m.User.Email,
                        ProfilePictureUrl = m.User.ProfilePictureUrl,
                        Role = m.Role,
                        InvitedAt = m.InvitedAt,
                        InvitedByUserId = m.InvitedByUserId,
                        InvitedByName = m.InvitedBy != null ? m.InvitedBy.Name : null
                    }).ToList(),
                    Lists = b.Lists.OrderBy(l => l.Position).Select(l => new ListDto
                    {
                        ListId = l.ListId,
                        BoardId = l.BoardId,
                        Title = l.Title,
                        Position = l.Position,
                        Cards = l.Cards.OrderBy(c => c.Position).Select(c => new CardDto
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
                            CreatedAt = c.CreatedAt
                        }).ToList()
                    }).ToList()
                })
                .FirstOrDefaultAsync();

            if (board == null)
            {
                return NotFound();
            }

            return Ok(board);
        }

        [HttpPost]
        public async Task<ActionResult<BoardDto>> CreateBoard([FromBody] CreateBoardDto createBoardDto)
        {
            var department = await _context.Departments.FindAsync(createBoardDto.DepartmentId);
            if (department == null)
            {
                return BadRequest("Invalid department ID");
            }

            var board = new Board
            {
                DepartmentId = createBoardDto.DepartmentId,
                Title = createBoardDto.Title,
                Description = createBoardDto.Description,
                CreatedByUserId = createBoardDto.CreatedByUserId,
                Status = "Planning",
                CreatedAt = DateTime.UtcNow
            };

            _context.Boards.Add(board);
            await _context.SaveChangesAsync();

            // Create default lists for the board
            var defaultLists = new List<List>
            {
                new List { BoardId = board.BoardId, Title = "To Do", Position = 0, CreatedAt = DateTime.UtcNow },
                new List { BoardId = board.BoardId, Title = "In Progress", Position = 1, CreatedAt = DateTime.UtcNow },
                new List { BoardId = board.BoardId, Title = "Done", Position = 2, CreatedAt = DateTime.UtcNow }
            };

            _context.Lists.AddRange(defaultLists);
            await _context.SaveChangesAsync();

            // Add creator as Owner member
            if (createBoardDto.CreatedByUserId.HasValue)
            {
                var ownerMember = new BoardMember
                {
                    BoardId = board.BoardId,
                    UserId = createBoardDto.CreatedByUserId.Value,
                    Role = "Owner",
                    InvitedAt = DateTime.UtcNow,
                    InvitedByUserId = null
                };
                _context.BoardMembers.Add(ownerMember);
            }

            // Add invited members
            var memberDtos = new List<BoardMemberDto>();
            if (createBoardDto.InvitedUserIds != null && createBoardDto.InvitedUserIds.Count > 0)
            {
                foreach (var userId in createBoardDto.InvitedUserIds)
                {
                    // Skip if this is the creator (already added as Owner)
                    if (userId == createBoardDto.CreatedByUserId)
                        continue;

                    var user = await _context.Users.FindAsync(userId);
                    if (user != null)
                    {
                        var member = new BoardMember
                        {
                            BoardId = board.BoardId,
                            UserId = userId,
                            Role = "Member",
                            InvitedAt = DateTime.UtcNow,
                            InvitedByUserId = createBoardDto.CreatedByUserId
                        };
                        _context.BoardMembers.Add(member);
                    }
                }
                await _context.SaveChangesAsync();
            }

            // Load the creator name and all members
            string? creatorName = null;
            if (createBoardDto.CreatedByUserId.HasValue)
            {
                var creator = await _context.Users.FindAsync(createBoardDto.CreatedByUserId.Value);
                creatorName = creator?.Name;
            }

            var members = await _context.BoardMembers
                .Include(m => m.User)
                .Include(m => m.InvitedBy)
                .Where(m => m.BoardId == board.BoardId)
                .Select(m => new BoardMemberDto
                {
                    BoardMemberId = m.BoardMemberId,
                    BoardId = m.BoardId,
                    UserId = m.UserId,
                    UserName = m.User.Name,
                    UserEmail = m.User.Email,
                    ProfilePictureUrl = m.User.ProfilePictureUrl,
                    Role = m.Role,
                    InvitedAt = m.InvitedAt,
                    InvitedByUserId = m.InvitedByUserId,
                    InvitedByName = m.InvitedBy != null ? m.InvitedBy.Name : null
                })
                .ToListAsync();

            var boardDto = new BoardDto
            {
                BoardId = board.BoardId,
                DepartmentId = board.DepartmentId,
                DepartmentName = department.Name,
                Title = board.Title,
                Description = board.Description,
                CreatedByUserId = board.CreatedByUserId,
                CreatedByName = creatorName,
                Status = board.Status,
                CreatedAt = board.CreatedAt,
                Progress = 0,
                TotalChecklistItems = 0,
                CompletedChecklistItems = 0,
                Lists = defaultLists.Select(l => new ListDto
                {
                    ListId = l.ListId,
                    BoardId = l.BoardId,
                    Title = l.Title,
                    Position = l.Position,
                    Cards = new List<CardDto>()
                }).ToList(),
                ChecklistItems = new List<BoardChecklistItemDto>(),
                Members = members
            };

            return CreatedAtAction(nameof(GetBoard), new { id = board.BoardId }, boardDto);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateBoard(int id, [FromBody] CreateBoardDto updateBoardDto)
        {
            var board = await _context.Boards.FindAsync(id);
            if (board == null)
            {
                return NotFound();
            }

            board.Title = updateBoardDto.Title;
            board.Description = updateBoardDto.Description;
            board.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateBoardStatus(int id, [FromBody] UpdateBoardStatusDto statusDto)
        {
            var board = await _context.Boards.FindAsync(id);
            if (board == null)
            {
                return NotFound();
            }

            board.Status = statusDto.Status;
            board.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // Checklist Item endpoints
        [HttpPost("{boardId}/checklist")]
        public async Task<ActionResult<BoardChecklistItemDto>> AddChecklistItem(int boardId, [FromBody] CreateChecklistItemDto createDto)
        {
            var board = await _context.Boards.FindAsync(boardId);
            if (board == null)
            {
                return NotFound("Board not found");
            }

            var checklistItem = new BoardChecklistItem
            {
                BoardId = boardId,
                Title = createDto.Title,
                Position = createDto.Position,
                IsCompleted = false,
                CreatedAt = DateTime.UtcNow
            };

            _context.BoardChecklistItems.Add(checklistItem);
            await _context.SaveChangesAsync();

            return Ok(new BoardChecklistItemDto
            {
                ChecklistItemId = checklistItem.ChecklistItemId,
                BoardId = checklistItem.BoardId,
                Title = checklistItem.Title,
                IsCompleted = checklistItem.IsCompleted,
                Position = checklistItem.Position,
                CreatedAt = checklistItem.CreatedAt
            });
        }

        [HttpPut("{boardId}/checklist/{itemId}")]
        public async Task<IActionResult> UpdateChecklistItem(int boardId, int itemId, [FromBody] UpdateChecklistItemDto updateDto)
        {
            var checklistItem = await _context.BoardChecklistItems
                .FirstOrDefaultAsync(c => c.BoardId == boardId && c.ChecklistItemId == itemId);

            if (checklistItem == null)
            {
                return NotFound();
            }

            checklistItem.IsCompleted = updateDto.IsCompleted;
            if (updateDto.IsCompleted)
            {
                checklistItem.CompletedAt = DateTime.UtcNow;
                checklistItem.CompletedByUserId = updateDto.CompletedByUserId;
            }
            else
            {
                checklistItem.CompletedAt = null;
                checklistItem.CompletedByUserId = null;
            }

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{boardId}/checklist/{itemId}")]
        public async Task<IActionResult> DeleteChecklistItem(int boardId, int itemId)
        {
            var checklistItem = await _context.BoardChecklistItems
                .FirstOrDefaultAsync(c => c.BoardId == boardId && c.ChecklistItemId == itemId);

            if (checklistItem == null)
            {
                return NotFound();
            }

            _context.BoardChecklistItems.Remove(checklistItem);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // Board Members endpoints
        [HttpGet("{boardId}/members")]
        public async Task<ActionResult<IEnumerable<BoardMemberDto>>> GetBoardMembers(int boardId)
        {
            var members = await _context.BoardMembers
                .Include(m => m.User)
                .Include(m => m.InvitedBy)
                .Where(m => m.BoardId == boardId)
                .Select(m => new BoardMemberDto
                {
                    BoardMemberId = m.BoardMemberId,
                    BoardId = m.BoardId,
                    UserId = m.UserId,
                    UserName = m.User.Name,
                    UserEmail = m.User.Email,
                    ProfilePictureUrl = m.User.ProfilePictureUrl,
                    Role = m.Role,
                    InvitedAt = m.InvitedAt,
                    InvitedByUserId = m.InvitedByUserId,
                    InvitedByName = m.InvitedBy != null ? m.InvitedBy.Name : null
                })
                .ToListAsync();

            return Ok(members);
        }

        [HttpPost("{boardId}/members")]
        public async Task<ActionResult<BoardMemberDto>> InviteBoardMember(int boardId, [FromBody] InviteBoardMemberDto inviteDto)
        {
            var board = await _context.Boards.FindAsync(boardId);
            if (board == null)
            {
                return NotFound("Board not found");
            }

            var user = await _context.Users.FindAsync(inviteDto.UserId);
            if (user == null)
            {
                return NotFound("User not found");
            }

            // Check if user is already a member
            var existingMember = await _context.BoardMembers
                .FirstOrDefaultAsync(m => m.BoardId == boardId && m.UserId == inviteDto.UserId);
            if (existingMember != null)
            {
                return BadRequest("User is already a member of this board");
            }

            var boardMember = new BoardMember
            {
                BoardId = boardId,
                UserId = inviteDto.UserId,
                Role = inviteDto.Role,
                InvitedAt = DateTime.UtcNow,
                InvitedByUserId = inviteDto.InvitedByUserId
            };

            _context.BoardMembers.Add(boardMember);
            await _context.SaveChangesAsync();

            string? invitedByName = null;
            if (inviteDto.InvitedByUserId.HasValue)
            {
                var inviter = await _context.Users.FindAsync(inviteDto.InvitedByUserId.Value);
                invitedByName = inviter?.Name;
            }

            return Ok(new BoardMemberDto
            {
                BoardMemberId = boardMember.BoardMemberId,
                BoardId = boardMember.BoardId,
                UserId = boardMember.UserId,
                UserName = user.Name,
                UserEmail = user.Email,
                ProfilePictureUrl = user.ProfilePictureUrl,
                Role = boardMember.Role,
                InvitedAt = boardMember.InvitedAt,
                InvitedByUserId = boardMember.InvitedByUserId,
                InvitedByName = invitedByName
            });
        }

        [HttpDelete("{boardId}/members/{memberId}")]
        public async Task<IActionResult> RemoveBoardMember(int boardId, int memberId)
        {
            var member = await _context.BoardMembers
                .FirstOrDefaultAsync(m => m.BoardId == boardId && m.BoardMemberId == memberId);

            if (member == null)
            {
                return NotFound();
            }

            _context.BoardMembers.Remove(member);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBoard(int id)
        {
            var board = await _context.Boards
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
                .Include(b => b.ChecklistItems)
                .FirstOrDefaultAsync(b => b.BoardId == id);
                
            if (board == null)
            {
                return NotFound();
            }

            _context.Boards.Remove(board);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
