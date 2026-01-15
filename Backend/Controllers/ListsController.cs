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
    public class ListsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ListsController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<ActionResult<ListDto>> CreateList([FromBody] CreateListDto createListDto)
        {
            var list = new List
            {
                BoardId = createListDto.BoardId,
                Title = createListDto.Title,
                Position = createListDto.Position,
                CreatedAt = DateTime.UtcNow
            };

            _context.Lists.Add(list);
            await _context.SaveChangesAsync();

            var listDto = new ListDto
            {
                ListId = list.ListId,
                BoardId = list.BoardId,
                Title = list.Title,
                Position = list.Position,
                Cards = new List<CardDto>()
            };

            return CreatedAtAction(nameof(GetList), new { id = list.ListId }, listDto);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ListDto>> GetList(int id)
        {
            var list = await _context.Lists
                .Include(l => l.Cards.OrderBy(c => c.Position))
                    .ThenInclude(c => c.AssignedTo)
                .Where(l => l.ListId == id)
                .Select(l => new ListDto
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
                })
                .FirstOrDefaultAsync();

            if (list == null)
            {
                return NotFound();
            }

            return Ok(list);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> UpdateList(int id, [FromBody] CreateListDto updateListDto)
        {
            var list = await _context.Lists.FindAsync(id);
            if (list == null)
            {
                return NotFound();
            }

            list.Title = updateListDto.Title;
            list.Position = updateListDto.Position;
            list.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Admin,Manager")]
        public async Task<IActionResult> DeleteList(int id)
        {
            var list = await _context.Lists.FindAsync(id);
            if (list == null)
            {
                return NotFound();
            }

            _context.Lists.Remove(list);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
