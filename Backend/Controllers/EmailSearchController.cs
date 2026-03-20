using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Services;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EmailSearchController : ControllerBase
    {
        private readonly EmailSearchService _emailSearchService;
        private readonly ILogger<EmailSearchController> _logger;

        public EmailSearchController(
            EmailSearchService emailSearchService,
            ILogger<EmailSearchController> logger)
        {
            _emailSearchService = emailSearchService;
            _logger = logger;
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
