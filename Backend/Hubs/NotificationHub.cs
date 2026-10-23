using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using System.Security.Claims;

namespace ProjectTracker.API.Hubs
{
    /// <summary>
    /// Real-time push hub used by the Windows system-tray notifier client.
    /// The server pushes "ReceiveNotification" events to the user_{userId} group.
    /// SECURITY: the group is always derived from the caller's JWT — a client can
    /// never subscribe to another user's notifications.
    /// </summary>
    [Authorize]
    public class NotificationHub : Hub
    {
        private readonly ILogger<NotificationHub> _logger;

        public NotificationHub(ILogger<NotificationHub> logger)
        {
            _logger = logger;
        }

        private int? AuthenticatedUserId()
        {
            var raw = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(raw, out var id) ? id : null;
        }

        public override async Task OnConnectedAsync()
        {
            var uid = AuthenticatedUserId();
            if (uid.HasValue)
                await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{uid.Value}");
            await base.OnConnectedAsync();
        }

        // Client -> server: join personal notification group. The argument is kept for
        // compatibility with existing tray clients but the id from the token is used.
        public async Task RegisterUser(int userId)
        {
            var uid = AuthenticatedUserId();
            if (uid == null)
                throw new HubException("Not authenticated.");

            if (userId != uid.Value)
                _logger.LogWarning("NotificationHub: RegisterUser for {Requested} ignored; token user is {UserId}", userId, uid.Value);

            await Groups.AddToGroupAsync(Context.ConnectionId, $"user_{uid.Value}");
            _logger.LogInformation("NotificationHub: RegisterUser userId={UserId} conn={Conn}", uid.Value, Context.ConnectionId);
            await Clients.Caller.SendAsync("Registered", uid.Value);
        }

        public async Task UnregisterUser(int userId)
        {
            var uid = AuthenticatedUserId();
            if (uid.HasValue)
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user_{uid.Value}");
        }
    }
}
