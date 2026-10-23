using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ProjectTracker.API.Hubs
{
    // SECURITY: receive-only for clients. Check-in/out and refresh events are pushed by
    // AttendanceController and ClockingDeviceController through IHubContext<AttendanceHub>;
    // clients can no longer broadcast fabricated attendance events to everyone.
    [Authorize]
    public class AttendanceHub : Hub
    {
        public override async Task OnConnectedAsync()
        {
            await base.OnConnectedAsync();
            await Clients.Caller.SendAsync("Connected", Context.ConnectionId);
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            await base.OnDisconnectedAsync(exception);
        }
    }
}
