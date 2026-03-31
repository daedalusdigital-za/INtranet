using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EmailSearchController : ControllerBase
    {
        private readonly EmailSearchService _emailSearchService;
        private readonly ApplicationDbContext _context;
        private readonly ILogger<EmailSearchController> _logger;

        public EmailSearchController(
            EmailSearchService emailSearchService,
            ApplicationDbContext context,
            ILogger<EmailSearchController> logger)
        {
            _emailSearchService = emailSearchService;
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Get the logged-in user's inbox emails via IMAP using their signup email
        /// </summary>
        [HttpGet("my-inbox")]
        public async Task<ActionResult<object>> GetMyInbox(
            [FromQuery] string? folder = "INBOX",
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 30)
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                    return Unauthorized(new { message = "Invalid token" });

                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                    return NotFound(new { message = "User not found" });

                // Find matching EmailAccount for the user's email
                var emailAccount = await _context.EmailAccounts
                    .FirstOrDefaultAsync(e => e.Email.ToLower() == user.Email.ToLower() && e.IsActive);

                if (emailAccount == null)
                    return Ok(new { emails = new List<object>(), total = 0, page, pageSize, 
                        message = "No email account configured for your address. Contact IT to set up email access." });

                var emails = await _emailSearchService.FetchUserInboxAsync(
                    emailAccount.Email, emailAccount.Password, folder, search, page, pageSize);

                return Ok(emails);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch user inbox");
                return StatusCode(500, new { message = "Failed to load emails. Please try again." });
            }
        }

        /// <summary>
        /// Get available folders for the logged-in user's email
        /// </summary>
        [HttpGet("my-folders")]
        public async Task<ActionResult<List<object>>> GetMyFolders()
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                    return Unauthorized(new { message = "Invalid token" });

                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                    return NotFound(new { message = "User not found" });

                var emailAccount = await _context.EmailAccounts
                    .FirstOrDefaultAsync(e => e.Email.ToLower() == user.Email.ToLower() && e.IsActive);

                if (emailAccount == null)
                    return Ok(new List<object>());

                var folders = await _emailSearchService.GetFoldersAsync(emailAccount.Email, emailAccount.Password);
                return Ok(folders);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch email folders");
                return StatusCode(500, new { message = "Failed to load folders." });
            }
        }

        /// <summary>
        /// Get full email body for a specific email
        /// </summary>
        [HttpGet("my-inbox/{uid}")]
        public async Task<ActionResult<object>> GetEmailBody(
            uint uid,
            [FromQuery] string? folder = "INBOX")
        {
            try
            {
                var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out var userId))
                    return Unauthorized(new { message = "Invalid token" });

                var user = await _context.Users.FindAsync(userId);
                if (user == null)
                    return NotFound(new { message = "User not found" });

                var emailAccount = await _context.EmailAccounts
                    .FirstOrDefaultAsync(e => e.Email.ToLower() == user.Email.ToLower() && e.IsActive);

                if (emailAccount == null)
                    return NotFound(new { message = "No email account configured" });

                var email = await _emailSearchService.GetEmailBodyAsync(
                    emailAccount.Email, emailAccount.Password, folder, uid);

                if (email == null)
                    return NotFound(new { message = "Email not found" });

                return Ok(email);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch email body for UID {Uid}", uid);
                return StatusCode(500, new { message = "Failed to load email." });
            }
        }

        /// <summary>
        /// Search for incoming order emails from IMAP mailboxes (today's emails with "order" in subject)
        /// </summary>
        [HttpGet("incoming-orders")]
        public async Task<ActionResult<List<EmailSearchResult>>> GetIncomingOrders(
            [FromQuery] string? accounts = null,
            [FromQuery] string? keyword = null,
            [FromQuery] int maxResults = 50)
        {
            try
            {
                var request = new EmailSearchRequest
                {
                    SubjectKeyword = keyword ?? "order",
                    DateFrom = DateTime.Today,
                    DateTo = DateTime.Today.AddDays(1),
                    MaxResults = maxResults
                };

                if (!string.IsNullOrWhiteSpace(accounts))
                {
                    request.AccountEmails = accounts
                        .Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(a => a.Trim())
                        .ToList();
                }

                var results = await _emailSearchService.SearchIncomingOrdersAsync(request);
                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to search incoming order emails");
                return StatusCode(500, new { message = "Failed to search emails. Please try again." });
            }
        }

        /// <summary>
        /// Search emails with custom parameters
        /// </summary>
        [HttpPost("search")]
        public async Task<ActionResult<List<EmailSearchResult>>> SearchEmails(
            [FromBody] EmailSearchRequest request)
        {
            try
            {
                var results = await _emailSearchService.SearchIncomingOrdersAsync(request);
                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to search emails");
                return StatusCode(500, new { message = "Failed to search emails. Please try again." });
            }
        }

        /// <summary>
        /// Get available email accounts for searching (orders/sales accounts)
        /// </summary>
        [HttpGet("accounts")]
        public async Task<ActionResult<List<string>>> GetAvailableAccounts()
        {
            try
            {
                var accounts = await _emailSearchService.GetAvailableAccountsAsync();
                return Ok(accounts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to get available email accounts");
                return StatusCode(500, new { message = "Failed to load accounts." });
            }
        }
    }
}
