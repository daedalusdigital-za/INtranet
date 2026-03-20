using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize(Roles = "Admin")]
    public class EmailAccountsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<EmailAccountsController> _logger;

        public EmailAccountsController(ApplicationDbContext context, ILogger<EmailAccountsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/emailaccounts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<EmailAccountDto>>> GetAll([FromQuery] string? search)
        {
            var query = _context.EmailAccounts.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var lowerSearch = search.ToLower();
                query = query.Where(e =>
                    e.Email.ToLower().Contains(lowerSearch) ||
                    (e.DisplayName != null && e.DisplayName.ToLower().Contains(lowerSearch)) ||
                    (e.Department != null && e.Department.ToLower().Contains(lowerSearch)));
            }

            var accounts = await query
                .OrderBy(e => e.Email)
                .Select(e => new EmailAccountDto
                {
                    EmailAccountId = e.EmailAccountId,
                    Email = e.Email,
                    Password = e.Password,
                    DisplayName = e.DisplayName,
                    Department = e.Department,
                    IsActive = e.IsActive,
                    CreatedAt = e.CreatedAt,
                    UpdatedAt = e.UpdatedAt
                })
                .ToListAsync();

            return Ok(accounts);
        }

        // GET: api/emailaccounts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<EmailAccountDto>> GetById(int id)
        {
            var account = await _context.EmailAccounts.FindAsync(id);
            if (account == null) return NotFound();

            return Ok(new EmailAccountDto
            {
                EmailAccountId = account.EmailAccountId,
                Email = account.Email,
                Password = account.Password,
                DisplayName = account.DisplayName,
                Department = account.Department,
                IsActive = account.IsActive,
                CreatedAt = account.CreatedAt,
                UpdatedAt = account.UpdatedAt
            });
        }

        // GET: api/emailaccounts/search?q=mpume
        [HttpGet("search")]
        [Authorize]
        public async Task<ActionResult<IEnumerable<object>>> Search([FromQuery] string q)
        {
            if (string.IsNullOrWhiteSpace(q))
                return Ok(Array.Empty<object>());

            var lowerQ = q.ToLower();
            var results = await _context.EmailAccounts
                .Where(e => e.IsActive &&
                    (e.Email.ToLower().Contains(lowerQ) ||
                     (e.DisplayName != null && e.DisplayName.ToLower().Contains(lowerQ)) ||
                     (e.Department != null && e.Department.ToLower().Contains(lowerQ))))
                .OrderBy(e => e.Email)
                .Take(20)
                .Select(e => new
                {
                    e.Email,
                    e.DisplayName,
                    e.Department
                })
                .ToListAsync();

            return Ok(results);
        }

        // POST: api/emailaccounts
        [HttpPost]
        public async Task<ActionResult<EmailAccountDto>> Create([FromBody] CreateEmailAccountDto dto)
        {
            // Check for duplicate email
            var exists = await _context.EmailAccounts.AnyAsync(e => e.Email.ToLower() == dto.Email.ToLower());
            if (exists) return BadRequest("An account with this email already exists.");

            var account = new EmailAccount
            {
                Email = dto.Email.Trim(),
                Password = dto.Password,
                DisplayName = dto.DisplayName?.Trim(),
                Department = dto.Department?.Trim(),
                CreatedAt = DateTime.UtcNow
            };

            _context.EmailAccounts.Add(account);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Email account created: {Email}", account.Email);

            return CreatedAtAction(nameof(GetById), new { id = account.EmailAccountId }, new EmailAccountDto
            {
                EmailAccountId = account.EmailAccountId,
                Email = account.Email,
                Password = account.Password,
                DisplayName = account.DisplayName,
                Department = account.Department,
                IsActive = account.IsActive,
                CreatedAt = account.CreatedAt
            });
        }

        // PUT: api/emailaccounts/5
        [HttpPut("{id}")]
        public async Task<ActionResult<EmailAccountDto>> Update(int id, [FromBody] UpdateEmailAccountDto dto)
        {
            var account = await _context.EmailAccounts.FindAsync(id);
            if (account == null) return NotFound();

            if (dto.Email != null)
            {
                var duplicate = await _context.EmailAccounts.AnyAsync(e => e.Email.ToLower() == dto.Email.ToLower() && e.EmailAccountId != id);
                if (duplicate) return BadRequest("An account with this email already exists.");
                account.Email = dto.Email.Trim();
            }
            if (dto.Password != null) account.Password = dto.Password;
            if (dto.DisplayName != null) account.DisplayName = dto.DisplayName.Trim();
            if (dto.Department != null) account.Department = dto.Department.Trim();
            if (dto.IsActive.HasValue) account.IsActive = dto.IsActive.Value;

            account.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            _logger.LogInformation("Email account updated: {Email}", account.Email);

            return Ok(new EmailAccountDto
            {
                EmailAccountId = account.EmailAccountId,
                Email = account.Email,
                Password = account.Password,
                DisplayName = account.DisplayName,
                Department = account.Department,
                IsActive = account.IsActive,
                CreatedAt = account.CreatedAt,
                UpdatedAt = account.UpdatedAt
            });
        }

        // DELETE: api/emailaccounts/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var account = await _context.EmailAccounts.FindAsync(id);
            if (account == null) return NotFound();

            _context.EmailAccounts.Remove(account);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Email account deleted: {Email}", account.Email);
            return NoContent();
        }
    }
}
