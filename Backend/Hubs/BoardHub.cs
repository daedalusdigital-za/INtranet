using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ProjectTracker.API.Hubs
{
    // SECURITY: clients only join/leave board groups. Card and comment events are
    // pushed by CardsController through IHubContext<BoardHub> after the change is
    // saved, so clients can no longer broadcast fabricated board events.
    [Authorize]
    public class BoardHub : Hub
    {
        public async Task JoinBoard(string boardId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"Board_{boardId}");
        }

        public async Task LeaveBoard(string boardId)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"Board_{boardId}");
        }
    }
}
