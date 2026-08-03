using Microsoft.AspNetCore.SignalR;
using ProjectTracker.API.Hubs;

namespace ProjectTracker.API.Services
{
    public class NotificationPayload
    {
        public string Type { get; set; } = "info";      // message | todo | announcement | leave | call | info
        public string Title { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public string? Url { get; set; }                 // relative intranet route to open on click, e.g. /messages
        public int? Count { get; set; }                  // optional unread count badge
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }

    public interface INotificationBroadcaster
    {
        Task NotifyUserAsync(int userId, NotificationPayload payload);
        Task NotifyUsersAsync(IEnumerable<int> userIds, NotificationPayload payload);
        Task NotifyAllAsync(NotificationPayload payload);
    }

    public class NotificationBroadcaster : INotificationBroadcaster
    {
        private readonly IHubContext<NotificationHub> _hub;
        private readonly ILogger<NotificationBroadcaster> _logger;

        public NotificationBroadcaster(IHubContext<NotificationHub> hub, ILogger<NotificationBroadcaster> logger)
        {
            _hub = hub;
            _logger = logger;
        }

        public async Task NotifyUserAsync(int userId, NotificationPayload payload)
        {
            try
            {
                _logger.LogInformation("NotifyUserAsync -> group user_{UserId} type={Type} title='{Title}'", userId, payload.Type, payload.Title);
                await _hub.Clients.Group($"user_{userId}").SendAsync("ReceiveNotification", payload);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to push notification to user {UserId}", userId);
            }
        }

        public async Task NotifyUsersAsync(IEnumerable<int> userIds, NotificationPayload payload)
        {
            foreach (var id in userIds.Distinct())
            {
                await NotifyUserAsync(id, payload);
            }
        }

        public async Task NotifyAllAsync(NotificationPayload payload)
        {
            try
            {
                await _hub.Clients.All.SendAsync("ReceiveNotification", payload);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to push broadcast notification");
            }
        }
    }
}
