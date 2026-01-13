using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;
using Microsoft.AspNetCore.SignalR;
using ProjectTracker.API.Hubs;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TodoController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<TodoController> _logger;
        private readonly IHubContext<ChatHub> _hubContext;

        public TodoController(ApplicationDbContext context, ILogger<TodoController> logger, IHubContext<ChatHub> hubContext)
        {
            _context = context;
            _logger = logger;
            _hubContext = hubContext;
        }

        // GET: api/todo
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TodoTaskResponseDto>>> GetTasks([FromQuery] int? userId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            var query = _context.TodoTasks
                .Include(t => t.CreatedByUser)
                .Include(t => t.AssignedToUser)
                .AsQueryable();

            if (userId.HasValue)
            {
                query = query.Where(t => t.AssignedToUserId == userId.Value || t.CreatedByUserId == userId.Value);
            }

            if (startDate.HasValue)
            {
                query = query.Where(t => t.DueDate >= startDate.Value.Date);
            }

            if (endDate.HasValue)
            {
                query = query.Where(t => t.DueDate <= endDate.Value.Date);
            }

            var tasks = await query
                .OrderBy(t => t.DueDate)
                .ThenBy(t => t.DueTime)
                .Select(t => MapToDto(t))
                .ToListAsync();

            return Ok(tasks);
        }

        // GET: api/todo/my-tasks/{userId}
        [HttpGet("my-tasks/{userId}")]
        public async Task<ActionResult<IEnumerable<TodoTaskResponseDto>>> GetMyTasks(int userId)
        {
            var tasks = await _context.TodoTasks
                .Include(t => t.CreatedByUser)
                .Include(t => t.AssignedToUser)
                .Where(t => t.AssignedToUserId == userId)
                .OrderBy(t => t.DueDate)
                .ThenBy(t => t.DueTime)
                .Select(t => MapToDto(t))
                .ToListAsync();

            return Ok(tasks);
        }

        // GET: api/todo/assigned-by/{userId}
        [HttpGet("assigned-by/{userId}")]
        public async Task<ActionResult<IEnumerable<TodoTaskResponseDto>>> GetTasksAssignedBy(int userId)
        {
            var tasks = await _context.TodoTasks
                .Include(t => t.CreatedByUser)
                .Include(t => t.AssignedToUser)
                .Where(t => t.CreatedByUserId == userId && t.AssignedToUserId != userId)
                .OrderBy(t => t.DueDate)
                .ThenBy(t => t.DueTime)
                .Select(t => MapToDto(t))
                .ToListAsync();

            return Ok(tasks);
        }

        // GET: api/todo/calendar/{userId}
        [HttpGet("calendar/{userId}")]
        public async Task<ActionResult<IEnumerable<TodoTaskResponseDto>>> GetCalendarTasks(int userId, [FromQuery] int month, [FromQuery] int year)
        {
            var startDate = new DateTime(year, month, 1);
            var endDate = startDate.AddMonths(1).AddDays(-1);

            var tasks = await _context.TodoTasks
                .Include(t => t.CreatedByUser)
                .Include(t => t.AssignedToUser)
                .Where(t => (t.AssignedToUserId == userId || t.CreatedByUserId == userId)
                    && t.DueDate >= startDate && t.DueDate <= endDate)
                .OrderBy(t => t.DueDate)
                .ThenBy(t => t.DueTime)
                .Select(t => MapToDto(t))
                .ToListAsync();

            return Ok(tasks);
        }

        // GET: api/todo/{id}
        [HttpGet("{id}")]
        public async Task<ActionResult<TodoTaskResponseDto>> GetTask(int id)
        {
            var task = await _context.TodoTasks
                .Include(t => t.CreatedByUser)
                .Include(t => t.AssignedToUser)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null)
            {
                return NotFound();
            }

            return Ok(MapToDto(task));
        }

        // POST: api/todo
        [HttpPost]
        public async Task<ActionResult<TodoTaskResponseDto>> CreateTask([FromBody] CreateTodoTaskDto dto)
        {
            var createdByUserId = GetCurrentUserId();
            if (createdByUserId == 0)
            {
                return Unauthorized();
            }

            var task = new TodoTask
            {
                Title = dto.Title,
                Description = dto.Description,
                DueDate = dto.DueDate.Date,
                DueTime = dto.DueTime,
                CreatedByUserId = createdByUserId,
                AssignedToUserId = dto.AssignedToUserId,
                Priority = dto.Priority,
                Category = dto.Category,
                IsRecurring = dto.IsRecurring,
                RecurrencePattern = dto.RecurrencePattern,
                Status = dto.AssignedToUserId == createdByUserId ? "Accepted" : "Pending",
                CreatedAt = DateTime.UtcNow
            };

            _context.TodoTasks.Add(task);
            await _context.SaveChangesAsync();

            // Reload with includes
            await _context.Entry(task).Reference(t => t.CreatedByUser).LoadAsync();
            await _context.Entry(task).Reference(t => t.AssignedToUser).LoadAsync();

            // Send notification if assigned to someone else
            if (task.AssignedToUserId != createdByUserId)
            {
                var notification = new TodoNotification
                {
                    TodoTaskId = task.Id,
                    UserId = task.AssignedToUserId,
                    NotificationType = "TaskAssigned",
                    Message = $"{task.CreatedByUser.Name} {task.CreatedByUser.Surname} assigned you a task: {task.Title}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.TodoNotifications.Add(notification);
                await _context.SaveChangesAsync();

                // Send real-time notification via SignalR
                await _hubContext.Clients.Group($"user_{task.AssignedToUserId}")
                    .SendAsync("TodoNotification", new
                    {
                        notification.Id,
                        notification.TodoTaskId,
                        TaskTitle = task.Title,
                        notification.NotificationType,
                        notification.Message,
                        AssignedByUserName = $"{task.CreatedByUser.Name} {task.CreatedByUser.Surname}",
                        notification.CreatedAt
                    });
            }

            return CreatedAtAction(nameof(GetTask), new { id = task.Id }, MapToDto(task));
        }

        // PUT: api/todo/{id}
        [HttpPut("{id}")]
        public async Task<ActionResult<TodoTaskResponseDto>> UpdateTask(int id, [FromBody] UpdateTodoTaskDto dto)
        {
            var task = await _context.TodoTasks
                .Include(t => t.CreatedByUser)
                .Include(t => t.AssignedToUser)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null)
            {
                return NotFound();
            }

            if (dto.Title != null) task.Title = dto.Title;
            if (dto.Description != null) task.Description = dto.Description;
            if (dto.DueDate.HasValue) task.DueDate = dto.DueDate.Value.Date;
            if (dto.DueTime.HasValue) task.DueTime = dto.DueTime;
            if (dto.Priority != null) task.Priority = dto.Priority;
            if (dto.Category != null) task.Category = dto.Category;
            if (dto.IsRecurring.HasValue) task.IsRecurring = dto.IsRecurring.Value;
            if (dto.RecurrencePattern != null) task.RecurrencePattern = dto.RecurrencePattern;

            // Handle reassignment
            if (dto.AssignedToUserId.HasValue && dto.AssignedToUserId.Value != task.AssignedToUserId)
            {
                var oldAssigneeId = task.AssignedToUserId;
                task.AssignedToUserId = dto.AssignedToUserId.Value;
                task.Status = dto.AssignedToUserId.Value == task.CreatedByUserId ? "Accepted" : "Pending";

                // Notify new assignee
                if (task.AssignedToUserId != task.CreatedByUserId)
                {
                    var notification = new TodoNotification
                    {
                        TodoTaskId = task.Id,
                        UserId = task.AssignedToUserId,
                        NotificationType = "TaskAssigned",
                        Message = $"{task.CreatedByUser.Name} {task.CreatedByUser.Surname} assigned you a task: {task.Title}",
                        CreatedAt = DateTime.UtcNow
                    };

                    _context.TodoNotifications.Add(notification);

                    await _hubContext.Clients.Group($"user_{task.AssignedToUserId}")
                        .SendAsync("TodoNotification", new
                        {
                            notification.Id,
                            notification.TodoTaskId,
                            TaskTitle = task.Title,
                            notification.NotificationType,
                            notification.Message,
                            AssignedByUserName = $"{task.CreatedByUser.Name} {task.CreatedByUser.Surname}",
                            notification.CreatedAt
                        });
                }
            }

            task.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            // Reload with includes
            await _context.Entry(task).Reference(t => t.AssignedToUser).LoadAsync();

            return Ok(MapToDto(task));
        }

        // POST: api/todo/{id}/respond
        [HttpPost("{id}/respond")]
        public async Task<ActionResult> RespondToTask(int id, [FromBody] RespondToTaskDto dto)
        {
            var task = await _context.TodoTasks
                .Include(t => t.CreatedByUser)
                .Include(t => t.AssignedToUser)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null)
            {
                return NotFound();
            }

            var respondingUserId = GetCurrentUserId();
            if (task.AssignedToUserId != respondingUserId)
            {
                return Forbid("You can only respond to tasks assigned to you");
            }

            task.Status = dto.Accept ? "Accepted" : "Declined";
            task.UpdatedAt = DateTime.UtcNow;

            // Notify the task creator
            var notification = new TodoNotification
            {
                TodoTaskId = task.Id,
                UserId = task.CreatedByUserId,
                NotificationType = dto.Accept ? "TaskAccepted" : "TaskDeclined",
                Message = dto.Accept
                    ? $"{task.AssignedToUser.Name} {task.AssignedToUser.Surname} accepted the task: {task.Title}"
                    : $"{task.AssignedToUser.Name} {task.AssignedToUser.Surname} declined the task: {task.Title}",
                CreatedAt = DateTime.UtcNow
            };

            _context.TodoNotifications.Add(notification);
            await _context.SaveChangesAsync();

            // Send real-time notification
            await _hubContext.Clients.Group($"user_{task.CreatedByUserId}")
                .SendAsync("TodoNotification", new
                {
                    notification.Id,
                    notification.TodoTaskId,
                    TaskTitle = task.Title,
                    notification.NotificationType,
                    notification.Message,
                    RespondedByUserName = $"{task.AssignedToUser.Name} {task.AssignedToUser.Surname}",
                    notification.CreatedAt
                });

            return Ok(new { message = dto.Accept ? "Task accepted" : "Task declined", status = task.Status });
        }

        // POST: api/todo/{id}/complete
        [HttpPost("{id}/complete")]
        public async Task<ActionResult> CompleteTask(int id)
        {
            var task = await _context.TodoTasks
                .Include(t => t.CreatedByUser)
                .Include(t => t.AssignedToUser)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null)
            {
                return NotFound();
            }

            task.IsCompleted = true;
            task.Status = "Completed";
            task.CompletedAt = DateTime.UtcNow;
            task.UpdatedAt = DateTime.UtcNow;

            // Notify the task creator if task was assigned by someone else
            if (task.CreatedByUserId != task.AssignedToUserId)
            {
                var notification = new TodoNotification
                {
                    TodoTaskId = task.Id,
                    UserId = task.CreatedByUserId,
                    NotificationType = "TaskCompleted",
                    Message = $"{task.AssignedToUser.Name} {task.AssignedToUser.Surname} completed the task: {task.Title}",
                    CreatedAt = DateTime.UtcNow
                };

                _context.TodoNotifications.Add(notification);

                // Send real-time notification
                await _hubContext.Clients.Group($"user_{task.CreatedByUserId}")
                    .SendAsync("TodoNotification", new
                    {
                        notification.Id,
                        notification.TodoTaskId,
                        TaskTitle = task.Title,
                        notification.NotificationType,
                        notification.Message,
                        CompletedByUserName = $"{task.AssignedToUser.Name} {task.AssignedToUser.Surname}",
                        notification.CreatedAt
                    });
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "Task marked as completed", completedAt = task.CompletedAt });
        }

        // DELETE: api/todo/{id}
        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteTask(int id)
        {
            var task = await _context.TodoTasks.FindAsync(id);

            if (task == null)
            {
                return NotFound();
            }

            // Delete related notifications
            var notifications = await _context.TodoNotifications.Where(n => n.TodoTaskId == id).ToListAsync();
            _context.TodoNotifications.RemoveRange(notifications);

            _context.TodoTasks.Remove(task);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // GET: api/todo/notifications/{userId}
        [HttpGet("notifications/{userId}")]
        public async Task<ActionResult<IEnumerable<TodoNotificationDto>>> GetNotifications(int userId, [FromQuery] bool unreadOnly = false)
        {
            var query = _context.TodoNotifications
                .Include(n => n.TodoTask)
                    .ThenInclude(t => t.CreatedByUser)
                .Where(n => n.UserId == userId);

            if (unreadOnly)
            {
                query = query.Where(n => !n.IsRead);
            }

            var notifications = await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(50)
                .Select(n => new TodoNotificationDto
                {
                    Id = n.Id,
                    TodoTaskId = n.TodoTaskId,
                    TaskTitle = n.TodoTask.Title,
                    NotificationType = n.NotificationType,
                    Message = n.Message,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt,
                    ReadAt = n.ReadAt,
                    AssignedByUserName = $"{n.TodoTask.CreatedByUser.Name} {n.TodoTask.CreatedByUser.Surname}"
                })
                .ToListAsync();

            return Ok(notifications);
        }

        // POST: api/todo/notifications/{id}/read
        [HttpPost("notifications/{id}/read")]
        public async Task<ActionResult> MarkNotificationAsRead(int id)
        {
            var notification = await _context.TodoNotifications.FindAsync(id);

            if (notification == null)
            {
                return NotFound();
            }

            notification.IsRead = true;
            notification.ReadAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok();
        }

        // POST: api/todo/notifications/read-all/{userId}
        [HttpPost("notifications/read-all/{userId}")]
        public async Task<ActionResult> MarkAllNotificationsAsRead(int userId)
        {
            var notifications = await _context.TodoNotifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync();

            foreach (var notification in notifications)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return Ok(new { markedAsRead = notifications.Count });
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            if (int.TryParse(userIdClaim, out int userId))
            {
                return userId;
            }

            // Fallback to header for development
            if (Request.Headers.TryGetValue("X-User-Id", out var headerUserId) && int.TryParse(headerUserId, out int headerUserIdInt))
            {
                return headerUserIdInt;
            }

            return 0;
        }

        private static TodoTaskResponseDto MapToDto(TodoTask task)
        {
            return new TodoTaskResponseDto
            {
                Id = task.Id,
                Title = task.Title,
                Description = task.Description,
                DueDate = task.DueDate,
                DueTime = task.DueTime,
                CreatedByUserId = task.CreatedByUserId,
                CreatedByUserName = $"{task.CreatedByUser.Name} {task.CreatedByUser.Surname}",
                AssignedToUserId = task.AssignedToUserId,
                AssignedToUserName = $"{task.AssignedToUser.Name} {task.AssignedToUser.Surname}",
                Status = task.Status,
                IsCompleted = task.IsCompleted,
                CompletedAt = task.CompletedAt,
                CreatedAt = task.CreatedAt,
                UpdatedAt = task.UpdatedAt,
                Priority = task.Priority,
                Category = task.Category,
                IsRecurring = task.IsRecurring,
                RecurrencePattern = task.RecurrencePattern,
                IsSelfAssigned = task.CreatedByUserId == task.AssignedToUserId
            };
        }
    }
}

