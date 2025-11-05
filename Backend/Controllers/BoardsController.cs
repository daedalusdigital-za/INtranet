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

        [HttpGet("department/{departmentId}")]
        public async Task<ActionResult<IEnumerable<BoardDto>>> GetBoardsByDepartment(int departmentId)
        {
            // Hardcoded boards - TODO: Replace with database query later
            var allBoards = new List<BoardDto>
            {
                // Production Department Boards
                new BoardDto
                {
                    BoardId = 1,
                    DepartmentId = 1,
                    DepartmentName = "Production",
                    Title = "Production Line A",
                    Description = "Manufacturing production tracking",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 1, BoardId = 1, Title = "To Do", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 2, BoardId = 1, Title = "In Progress", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 3, BoardId = 1, Title = "Done", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                new BoardDto
                {
                    BoardId = 2,
                    DepartmentId = 1,
                    DepartmentName = "Production",
                    Title = "Production Line B",
                    Description = "Secondary production line",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 4, BoardId = 2, Title = "Backlog", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 5, BoardId = 2, Title = "Active", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 6, BoardId = 2, Title = "Complete", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                new BoardDto
                {
                    BoardId = 3,
                    DepartmentId = 1,
                    DepartmentName = "Production",
                    Title = "Equipment Maintenance",
                    Description = "Maintenance schedule and tasks",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 7, BoardId = 3, Title = "Scheduled", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 8, BoardId = 3, Title = "In Progress", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 9, BoardId = 3, Title = "Completed", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                // Quality Assurance Department Boards
                new BoardDto
                {
                    BoardId = 4,
                    DepartmentId = 2,
                    DepartmentName = "Quality Assurance",
                    Title = "Quality Control",
                    Description = "Product quality testing and validation",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 10, BoardId = 4, Title = "Pending Review", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 11, BoardId = 4, Title = "Testing", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 12, BoardId = 4, Title = "Approved", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                new BoardDto
                {
                    BoardId = 5,
                    DepartmentId = 2,
                    DepartmentName = "Quality Assurance",
                    Title = "Compliance Audits",
                    Description = "Regulatory compliance tracking",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 13, BoardId = 5, Title = "Planning", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 14, BoardId = 5, Title = "In Audit", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 15, BoardId = 5, Title = "Certified", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                // Warehouse Department Boards
                new BoardDto
                {
                    BoardId = 6,
                    DepartmentId = 3,
                    DepartmentName = "Warehouse",
                    Title = "Inventory Management",
                    Description = "Stock tracking and management",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 16, BoardId = 6, Title = "Reorder Needed", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 17, BoardId = 6, Title = "On Order", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 18, BoardId = 6, Title = "Stocked", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                new BoardDto
                {
                    BoardId = 7,
                    DepartmentId = 3,
                    DepartmentName = "Warehouse",
                    Title = "Shipments",
                    Description = "Incoming and outgoing shipments",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 19, BoardId = 7, Title = "Scheduled", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 20, BoardId = 7, Title = "In Transit", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 21, BoardId = 7, Title = "Delivered", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                // Administration Department Boards
                new BoardDto
                {
                    BoardId = 8,
                    DepartmentId = 4,
                    DepartmentName = "Administration",
                    Title = "HR Tasks",
                    Description = "Human resources management",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 22, BoardId = 8, Title = "To Do", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 23, BoardId = 8, Title = "In Progress", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 24, BoardId = 8, Title = "Done", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                new BoardDto
                {
                    BoardId = 9,
                    DepartmentId = 4,
                    DepartmentName = "Administration",
                    Title = "Finance",
                    Description = "Financial planning and reporting",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 25, BoardId = 9, Title = "Pending", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 26, BoardId = 9, Title = "Processing", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 27, BoardId = 9, Title = "Completed", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                new BoardDto
                {
                    BoardId = 10,
                    DepartmentId = 4,
                    DepartmentName = "Administration",
                    Title = "IT Support",
                    Description = "Technology support tickets",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 28, BoardId = 10, Title = "Open", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 29, BoardId = 10, Title = "Working On", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 30, BoardId = 10, Title = "Resolved", Position = 2, Cards = new List<CardDto>() }
                    }
                },
                new BoardDto
                {
                    BoardId = 11,
                    DepartmentId = 4,
                    DepartmentName = "Administration",
                    Title = "Facilities",
                    Description = "Building and facility management",
                    Lists = new List<ListDto>
                    {
                        new ListDto { ListId = 31, BoardId = 11, Title = "Reported", Position = 0, Cards = new List<CardDto>() },
                        new ListDto { ListId = 32, BoardId = 11, Title = "In Work", Position = 1, Cards = new List<CardDto>() },
                        new ListDto { ListId = 33, BoardId = 11, Title = "Closed", Position = 2, Cards = new List<CardDto>() }
                    }
                }
            };

            var boards = allBoards.Where(b => b.DepartmentId == departmentId).ToList();
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
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<BoardDto>> CreateBoard([FromBody] CreateBoardDto createBoardDto)
        {
            var board = new Board
            {
                DepartmentId = createBoardDto.DepartmentId,
                Title = createBoardDto.Title,
                Description = createBoardDto.Description,
                CreatedAt = DateTime.UtcNow
            };

            _context.Boards.Add(board);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetBoard), new { id = board.BoardId }, board);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager")]
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
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> DeleteBoard(int id)
        {
            var board = await _context.Boards.FindAsync(id);
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
