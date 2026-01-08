namespace ProjectTracker.API.DTOs
{
    // Response DTOs
    public class SupportTicketDto
    {
        public int TicketId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string SubmittedBy { get; set; } = string.Empty;
        public string? SubmittedByEmail { get; set; }
        public string? AssignedTo { get; set; }
        public DateTime SubmittedDate { get; set; }
        public DateTime? FirstResponseDate { get; set; }
        public DateTime? ResolvedDate { get; set; }
        public DateTime? ClosedDate { get; set; }
        public DateTime LastUpdated { get; set; }
        public string? Resolution { get; set; }
        public List<TicketCommentDto> Comments { get; set; } = new List<TicketCommentDto>();
    }

    public class TicketCommentDto
    {
        public int CommentId { get; set; }
        public int TicketId { get; set; }
        public string Content { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public bool IsInternal { get; set; }
    }

    // Request DTOs
    public class CreateTicketRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = "Medium";
        public string Category { get; set; } = "General";
        public string SubmittedBy { get; set; } = string.Empty;
        public string? SubmittedByEmail { get; set; }
    }

    public class UpdateTicketRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Priority { get; set; }
        public string? Status { get; set; }
        public string? Category { get; set; }
        public string? AssignedTo { get; set; }
        public string? Resolution { get; set; }
    }

    public class AddTicketCommentRequest
    {
        public string Content { get; set; } = string.Empty;
        public string Author { get; set; } = string.Empty;
        public bool IsInternal { get; set; } = false;
    }

    public class TicketFilterRequest
    {
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public string? Category { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public string? SubmittedBy { get; set; }
        public string? AssignedTo { get; set; }
    }

    // Statistics DTO
    public class TicketStatisticsDto
    {
        public int TotalTickets { get; set; }
        public int OpenTickets { get; set; }
        public int InProgressTickets { get; set; }
        public int ResolvedTickets { get; set; }
        public int ClosedTickets { get; set; }
        public double AverageResponseTimeHours { get; set; }
        public double AverageResolutionTimeHours { get; set; }
        public double ResolutionRate { get; set; }
        public Dictionary<string, int> TicketsByCategory { get; set; } = new Dictionary<string, int>();
        public Dictionary<string, int> TicketsByPriority { get; set; } = new Dictionary<string, int>();
    }
}
