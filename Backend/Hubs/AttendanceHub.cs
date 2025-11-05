using Microsoft.AspNetCore.SignalR;

namespace ProjectTracker.API.Hubs
{
    public class AttendanceHub : Hub
    {
        public async Task SendAttendanceUpdate(string message)
        {
            await Clients.All.SendAsync("ReceiveAttendanceUpdate", message);
        }

        public async Task NotifyEmployeeCheckedIn(int employeeId, string employeeName, DateTime timeIn)
        {
            await Clients.All.SendAsync("EmployeeCheckedIn", new
            {
                employeeId,
                employeeName,
                timeIn,
                timestamp = DateTime.UtcNow
            });
        }

        public async Task NotifyEmployeeCheckedOut(int employeeId, string employeeName, DateTime timeOut)
        {
            await Clients.All.SendAsync("EmployeeCheckedOut", new
            {
                employeeId,
                employeeName,
                timeOut,
                timestamp = DateTime.UtcNow
            });
        }

        public async Task RefreshDashboard()
        {
            await Clients.All.SendAsync("RefreshAttendanceDashboard");
        }

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
