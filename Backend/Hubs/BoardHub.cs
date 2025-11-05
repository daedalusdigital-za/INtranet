using Microsoft.AspNetCore.SignalR;

namespace ProjectTracker.API.Hubs
{
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

        public async Task CardMoved(string boardId, object cardData)
        {
            await Clients.Group($"Board_{boardId}").SendAsync("CardMoved", cardData);
        }

        public async Task CardCreated(string boardId, object cardData)
        {
            await Clients.Group($"Board_{boardId}").SendAsync("CardCreated", cardData);
        }

        public async Task CardUpdated(string boardId, object cardData)
        {
            await Clients.Group($"Board_{boardId}").SendAsync("CardUpdated", cardData);
        }

        public async Task CardDeleted(string boardId, int cardId)
        {
            await Clients.Group($"Board_{boardId}").SendAsync("CardDeleted", cardId);
        }

        public async Task CommentAdded(string boardId, object commentData)
        {
            await Clients.Group($"Board_{boardId}").SendAsync("CommentAdded", commentData);
        }
    }
}
