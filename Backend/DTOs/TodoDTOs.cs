namespace ProjectTracker.API.DTOs
{
    public class CreateTodoTaskDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime DueDate { get; set; }
        public DateTime? DueTime { get; set; }
        public int AssignedToUserId { get; set; }
        public string Priority { get; set; } = "Normal";
        public string? Category { get; set; }
        public bool IsRecurring { get; set; } = false;
        public string? RecurrencePattern { get; set; }
    }

    public class UpdateTodoTaskDto
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? DueTime { get; set; }
        public int? AssignedToUserId { get; set; }
        public string? Priority { get; set; }
        public string? Category { get; set; }
        public bool? IsRecurring { get; set; }
        public string? RecurrencePattern { get; set; }
    }

    public class TodoTaskResponseDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime DueDate { get; set; }
        public DateTime? DueTime { get; set; }
        public int CreatedByUserId { get; set; }
        public string CreatedByUserName { get; set; } = string.Empty;
        public int AssignedToUserId { get; set; }
        public string AssignedToUserName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string Priority { get; set; } = string.Empty;
        public string? Category { get; set; }
        public bool IsRecurring { get; set; }
        public string? RecurrencePattern { get; set; }
        public bool IsSelfAssigned { get; set; }
    }

    public class RespondToTaskDto
    {
        public bool Accept { get; set; }
    }

    public class TodoNotificationDto
    {
        public int Id { get; set; }
        public int TodoTaskId { get; set; }
        public string TaskTitle { get; set; } = string.Empty;
        public string NotificationType { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ReadAt { get; set; }
        public string AssignedByUserName { get; set; } = string.Empty;
    }
}
