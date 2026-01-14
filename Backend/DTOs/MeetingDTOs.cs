namespace ProjectTracker.API.DTOs;

public class CreateMeetingDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime MeetingDate { get; set; }
    public string StartTime { get; set; } = string.Empty; // "HH:mm" format
    public string? EndTime { get; set; } // "HH:mm" format
    public string Location { get; set; } = "Online";
    public string? MeetingLink { get; set; }
    public List<int> AttendeeIds { get; set; } = new();
}

public class UpdateMeetingDto
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public DateTime? MeetingDate { get; set; }
    public string? StartTime { get; set; }
    public string? EndTime { get; set; }
    public string? Location { get; set; }
    public string? MeetingLink { get; set; }
    public string? Status { get; set; }
}

public class MeetingResponseDto
{
    public string ResponseStatus { get; set; } = string.Empty; // Accepted, Declined
}

public class MeetingDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime MeetingDate { get; set; }
    public string StartTime { get; set; } = string.Empty;
    public string? EndTime { get; set; }
    public string Location { get; set; } = string.Empty;
    public string? MeetingLink { get; set; }
    public int OrganizerId { get; set; }
    public string OrganizerName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public List<MeetingAttendeeDto> Attendees { get; set; } = new();
}

public class MeetingAttendeeDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? ProfilePictureUrl { get; set; }
    public string ResponseStatus { get; set; } = string.Empty;
    public DateTime? RespondedAt { get; set; }
}

public class MeetingNotificationDto
{
    public int Id { get; set; }
    public int MeetingId { get; set; }
    public string MeetingTitle { get; set; } = string.Empty;
    public DateTime MeetingDate { get; set; }
    public string StartTime { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public string OrganizerName { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string NotificationType { get; set; } = string.Empty;
    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CalendarEventDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateTime Start { get; set; }
    public DateTime End { get; set; }
    public string Location { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string ResponseStatus { get; set; } = string.Empty;
    public bool IsOrganizer { get; set; }
    public string Color { get; set; } = string.Empty;
}
