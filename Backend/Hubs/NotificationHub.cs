using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;

namespace ProjectTracker.API.Hubs
{
    /// <summary>
    /// Real-time push hub used by the Windows system-tray notifier client.
    /// Clients call RegisterUser(userId) after connecting; the server then pushes
    /// "ReceiveNotification" events to the user_{userId} group.
    /// </summary>
    public class NotificationHub : Hub
    {
        private readonly ILogger<NotificationHub> _logger;

        public NotificationHub(ILogger<NotificationHub> logger)
        {
            _logger = logger;
        }

        // Client -> server: join personal notification group
        public async Task RegisterUser(int userId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{userId}");
            _logger.LogInformation("NotificationHub: RegisterUser userId={UserId} conn={Conn}", userId, Context.ConnectionId);
            await Clients.Caller.SendAsync("Registered", userId);
        }

        public async Task UnregisterUser(int userId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{userId}");
        }
    }
}
