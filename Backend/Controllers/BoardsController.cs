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
                .Include(b => b.Lists.OrderBy(l => l.Position))
                    .ThenInclude(l => l.Cards.OrderBy(c => c.Position))
                        .ThenInclude(c => c.AssignedTo)
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
                            AssignedToUserId = c.AssignedToUserId,
                            AssignedToName = c.AssignedTo != null ? c.AssignedTo.Name : null,
                            DueDate = c.DueDate,
                            Status = c.Status,
                            Position = c.Position,
                            CommentCount = c.Comments.Count,
                            AttachmentCount = c.Attachments.Count
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
                .Include(b => b.Lists.OrderBy(l => l.Position))
                    .ThenInclude(l => l.Cards.OrderBy(c => c.Position))
                        .ThenInclude(c => c.AssignedTo)
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
                            AssignedToUserId = c.AssignedToUserId,
                            AssignedToName = c.AssignedTo != null ? c.AssignedTo.Name : null,
                            DueDate = c.DueDate,
                            Status = c.Status,
                            Position = c.Position,
                            CommentCount = c.Comments.Count,
                            AttachmentCount = c.Attachments.Count
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
                .Include(b => b.Lists.OrderBy(l => l.Position))
                    .ThenInclude(l => l.Cards.OrderBy(c => c.Position))
                        .ThenInclude(c => c.AssignedTo)
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
                            AssignedToUserId = c.AssignedToUserId,
                            AssignedToName = c.AssignedTo != null ? c.AssignedTo.Name : null,
                            DueDate = c.DueDate,
                            Status = c.Status,
                            Position = c.Position,
                            CommentCount = c.Comments.Count,
                            AttachmentCount = c.Attachments.Count
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

            var boardDto = new BoardDto
            {
                BoardId = board.BoardId,
                DepartmentId = board.DepartmentId,
                DepartmentName = department.Name,
                Title = board.Title,
                Description = board.Description,
                Lists = defaultLists.Select(l => new ListDto
                {
                    ListId = l.ListId,
                    BoardId = l.BoardId,
                    Title = l.Title,
                    Position = l.Position,
                    Cards = new List<CardDto>()
                }).ToList()
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

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteBoard(int id)
        {
            var board = await _context.Boards
                .Include(b => b.Lists)
                    .ThenInclude(l => l.Cards)
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
