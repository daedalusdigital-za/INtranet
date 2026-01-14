using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.DTOs;
using ProjectTracker.API.Models;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MeetingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<MeetingsController> _logger;

    public MeetingsController(ApplicationDbContext context, ILogger<MeetingsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    private int GetCurrentUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(userIdClaim, out var userId) ? userId : 0;
    }

    // GET: api/meetings
    [HttpGet]
    public async Task<ActionResult<IEnumerable<MeetingDto>>> GetMeetings()
    {
        var userId = GetCurrentUserId();
        
        var meetings = await _context.Meetings
            .Include(m => m.Organizer)
            .Include(m => m.Attendees)
                .ThenInclude(a => a.User)
            .Where(m => m.OrganizerId == userId || m.Attendees.Any(a => a.UserId == userId))
            .OrderByDescending(m => m.MeetingDate)
            .ThenBy(m => m.StartTime)
            .ToListAsync();

        return Ok(meetings.Select(MapToDto));
    }

    // GET: api/meetings/calendar
    [HttpGet("calendar")]
    public async Task<ActionResult<IEnumerable<CalendarEventDto>>> GetCalendarEvents(
        [FromQuery] DateTime? startDate, 
        [FromQuery] DateTime? endDate)
    {
        var userId = GetCurrentUserId();
        var start = startDate ?? DateTime.UtcNow.AddMonths(-1);
        var end = endDate ?? DateTime.UtcNow.AddMonths(3);

        var meetings = await _context.Meetings
            .Include(m => m.Organizer)
            .Include(m => m.Attendees)
            .Where(m => m.MeetingDate >= start && m.MeetingDate <= end)
            .Where(m => m.OrganizerId == userId || m.Attendees.Any(a => a.UserId == userId))
            .Where(m => m.Status != "Cancelled")
            .ToListAsync();

        var events = meetings.Select(m =>
        {
            var attendee = m.Attendees.FirstOrDefault(a => a.UserId == userId);
            var isOrganizer = m.OrganizerId == userId;
            var responseStatus = isOrganizer ? "Organizer" : (attendee?.ResponseStatus ?? "Pending");
            
            // Color based on response status
            var color = responseStatus switch
            {
                "Organizer" => "#1976d2", // Blue
                "Accepted" => "#4caf50", // Green
                "Declined" => "#f44336", // Red
                _ => "#ff9800" // Orange for pending
            };

            var startDateTime = m.MeetingDate.Date.Add(m.StartTime);
            var endDateTime = m.EndTime.HasValue 
                ? m.MeetingDate.Date.Add(m.EndTime.Value)
                : startDateTime.AddHours(1);

            return new CalendarEventDto
            {
                Id = m.Id,
                Title = m.Title,
                Start = startDateTime,
                End = endDateTime,
                Location = m.Location,
                Status = m.Status,
                ResponseStatus = responseStatus,
                IsOrganizer = isOrganizer,
                Color = color
            };
        });

        return Ok(events);
    }

    // GET: api/meetings/5
    [HttpGet("{id}")]
    public async Task<ActionResult<MeetingDto>> GetMeeting(int id)
    {
        var meeting = await _context.Meetings
            .Include(m => m.Organizer)
            .Include(m => m.Attendees)
                .ThenInclude(a => a.User)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (meeting == null)
            return NotFound();

        return Ok(MapToDto(meeting));
    }

    // POST: api/meetings
    [HttpPost]
    public async Task<ActionResult<MeetingDto>> CreateMeeting(CreateMeetingDto dto)
    {
        var userId = GetCurrentUserId();
        
        if (!TimeSpan.TryParse(dto.StartTime, out var startTime))
            return BadRequest(new { error = "Invalid start time format. Use HH:mm" });

        TimeSpan? endTime = null;
        if (!string.IsNullOrEmpty(dto.EndTime) && TimeSpan.TryParse(dto.EndTime, out var parsedEndTime))
            endTime = parsedEndTime;

        var meeting = new Meeting
        {
            Title = dto.Title,
            Description = dto.Description,
            MeetingDate = dto.MeetingDate.Date,
            StartTime = startTime,
            EndTime = endTime,
            Location = dto.Location,
            MeetingLink = dto.MeetingLink,
            OrganizerId = userId,
            Status = "Pending",
            CreatedAt = DateTime.UtcNow
        };

        _context.Meetings.Add(meeting);
        await _context.SaveChangesAsync();

        // Add attendees
        foreach (var attendeeId in dto.AttendeeIds.Distinct())
        {
            if (attendeeId == userId) continue; // Don't add organizer as attendee

            var user = await _context.Users.FindAsync(attendeeId);
            if (user == null) continue;

            var attendee = new MeetingAttendee
            {
                MeetingId = meeting.Id,
                UserId = attendeeId,
                ResponseStatus = "Pending",
                InvitedAt = DateTime.UtcNow
            };
            _context.MeetingAttendees.Add(attendee);

            // Create notification for the attendee
            var organizer = await _context.Users.FindAsync(userId);
            var notification = new MeetingNotification
            {
                MeetingId = meeting.Id,
                UserId = attendeeId,
                Message = $"{organizer?.Name} {organizer?.Surname} has invited you to a meeting: {meeting.Title}",
                NotificationType = "Invitation",
                CreatedAt = DateTime.UtcNow
            };
            _context.MeetingNotifications.Add(notification);
        }

        await _context.SaveChangesAsync();

        // Reload with relationships
        var createdMeeting = await _context.Meetings
            .Include(m => m.Organizer)
            .Include(m => m.Attendees)
                .ThenInclude(a => a.User)
            .FirstAsync(m => m.Id == meeting.Id);

        _logger.LogInformation("Meeting {MeetingId} created by user {UserId} with {AttendeeCount} attendees",
            meeting.Id, userId, dto.AttendeeIds.Count);

        return CreatedAtAction(nameof(GetMeeting), new { id = meeting.Id }, MapToDto(createdMeeting));
    }

    // PUT: api/meetings/5
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateMeeting(int id, UpdateMeetingDto dto)
    {
        var userId = GetCurrentUserId();
        var meeting = await _context.Meetings
            .Include(m => m.Attendees)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (meeting == null)
            return NotFound();

        if (meeting.OrganizerId != userId)
            return Forbid("Only the organizer can update the meeting");

        if (!string.IsNullOrEmpty(dto.Title))
            meeting.Title = dto.Title;
        if (dto.Description != null)
            meeting.Description = dto.Description;
        if (dto.MeetingDate.HasValue)
            meeting.MeetingDate = dto.MeetingDate.Value.Date;
        if (!string.IsNullOrEmpty(dto.StartTime) && TimeSpan.TryParse(dto.StartTime, out var startTime))
            meeting.StartTime = startTime;
        if (!string.IsNullOrEmpty(dto.EndTime) && TimeSpan.TryParse(dto.EndTime, out var endTime))
            meeting.EndTime = endTime;
        if (!string.IsNullOrEmpty(dto.Location))
            meeting.Location = dto.Location;
        if (dto.MeetingLink != null)
            meeting.MeetingLink = dto.MeetingLink;
        if (!string.IsNullOrEmpty(dto.Status))
            meeting.Status = dto.Status;

        meeting.UpdatedAt = DateTime.UtcNow;

        // Notify attendees of update
        foreach (var attendee in meeting.Attendees)
        {
            var notification = new MeetingNotification
            {
                MeetingId = meeting.Id,
                UserId = attendee.UserId,
                Message = $"Meeting '{meeting.Title}' has been updated",
                NotificationType = "Update",
                CreatedAt = DateTime.UtcNow
            };
            _context.MeetingNotifications.Add(notification);
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // POST: api/meetings/5/respond
    [HttpPost("{id}/respond")]
    public async Task<IActionResult> RespondToMeeting(int id, MeetingResponseDto dto)
    {
        var userId = GetCurrentUserId();
        
        var attendee = await _context.MeetingAttendees
            .Include(a => a.Meeting)
                .ThenInclude(m => m!.Organizer)
            .FirstOrDefaultAsync(a => a.MeetingId == id && a.UserId == userId);

        if (attendee == null)
            return NotFound("You are not invited to this meeting");

        if (dto.ResponseStatus != "Accepted" && dto.ResponseStatus != "Declined")
            return BadRequest("Response status must be 'Accepted' or 'Declined'");

        attendee.ResponseStatus = dto.ResponseStatus;
        attendee.RespondedAt = DateTime.UtcNow;

        // Notify organizer of response
        var user = await _context.Users.FindAsync(userId);
        var notification = new MeetingNotification
        {
            MeetingId = id,
            UserId = attendee.Meeting!.OrganizerId,
            Message = $"{user?.Name} {user?.Surname} has {dto.ResponseStatus.ToLower()} your meeting invitation: {attendee.Meeting.Title}",
            NotificationType = "Response",
            CreatedAt = DateTime.UtcNow
        };
        _context.MeetingNotifications.Add(notification);

        // Check if all attendees have responded
        var allResponded = await _context.MeetingAttendees
            .Where(a => a.MeetingId == id)
            .AllAsync(a => a.ResponseStatus != "Pending");

        if (allResponded)
        {
            var anyAccepted = await _context.MeetingAttendees
                .Where(a => a.MeetingId == id)
                .AnyAsync(a => a.ResponseStatus == "Accepted");

            attendee.Meeting.Status = anyAccepted ? "Confirmed" : "Cancelled";
        }

        await _context.SaveChangesAsync();

        _logger.LogInformation("User {UserId} responded {Response} to meeting {MeetingId}",
            userId, dto.ResponseStatus, id);

        return Ok(new { message = $"Response recorded: {dto.ResponseStatus}" });
    }

    // DELETE: api/meetings/5
    [HttpDelete("{id}")]
    public async Task<IActionResult> CancelMeeting(int id)
    {
        var userId = GetCurrentUserId();
        var meeting = await _context.Meetings
            .Include(m => m.Attendees)
            .FirstOrDefaultAsync(m => m.Id == id);

        if (meeting == null)
            return NotFound();

        if (meeting.OrganizerId != userId)
            return Forbid("Only the organizer can cancel the meeting");

        meeting.Status = "Cancelled";
        meeting.UpdatedAt = DateTime.UtcNow;

        // Notify attendees of cancellation
        foreach (var attendee in meeting.Attendees)
        {
            var notification = new MeetingNotification
            {
                MeetingId = meeting.Id,
                UserId = attendee.UserId,
                Message = $"Meeting '{meeting.Title}' has been cancelled",
                NotificationType = "Cancellation",
                CreatedAt = DateTime.UtcNow
            };
            _context.MeetingNotifications.Add(notification);
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    // GET: api/meetings/notifications
    [HttpGet("notifications")]
    public async Task<ActionResult<IEnumerable<MeetingNotificationDto>>> GetNotifications([FromQuery] bool unreadOnly = false)
    {
        var userId = GetCurrentUserId();
        
        var query = _context.MeetingNotifications
            .Include(n => n.Meeting)
                .ThenInclude(m => m!.Organizer)
            .Where(n => n.UserId == userId);

        if (unreadOnly)
            query = query.Where(n => !n.IsRead);

        var notifications = await query
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .ToListAsync();

        return Ok(notifications.Select(n => new MeetingNotificationDto
        {
            Id = n.Id,
            MeetingId = n.MeetingId,
            MeetingTitle = n.Meeting?.Title ?? "",
            MeetingDate = n.Meeting?.MeetingDate ?? DateTime.MinValue,
            StartTime = n.Meeting?.StartTime.ToString(@"hh\:mm") ?? "",
            Location = n.Meeting?.Location ?? "",
            OrganizerName = $"{n.Meeting?.Organizer?.Name} {n.Meeting?.Organizer?.Surname}",
            Message = n.Message,
            NotificationType = n.NotificationType,
            IsRead = n.IsRead,
            CreatedAt = n.CreatedAt
        }));
    }

    // POST: api/meetings/notifications/5/read
    [HttpPost("notifications/{id}/read")]
    public async Task<IActionResult> MarkNotificationRead(int id)
    {
        var userId = GetCurrentUserId();
        var notification = await _context.MeetingNotifications
            .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId);

        if (notification == null)
            return NotFound();

        notification.IsRead = true;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // POST: api/meetings/notifications/read-all
    [HttpPost("notifications/read-all")]
    public async Task<IActionResult> MarkAllNotificationsRead()
    {
        var userId = GetCurrentUserId();
        await _context.MeetingNotifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return NoContent();
    }

    // GET: api/meetings/notifications/count
    [HttpGet("notifications/count")]
    public async Task<ActionResult<int>> GetUnreadNotificationCount()
    {
        var userId = GetCurrentUserId();
        var count = await _context.MeetingNotifications
            .CountAsync(n => n.UserId == userId && !n.IsRead);

        return Ok(new { count });
    }

    private static MeetingDto MapToDto(Meeting meeting)
    {
        return new MeetingDto
        {
            Id = meeting.Id,
            Title = meeting.Title,
            Description = meeting.Description,
            MeetingDate = meeting.MeetingDate,
            StartTime = meeting.StartTime.ToString(@"hh\:mm"),
            EndTime = meeting.EndTime?.ToString(@"hh\:mm"),
            Location = meeting.Location,
            MeetingLink = meeting.MeetingLink,
            OrganizerId = meeting.OrganizerId,
            OrganizerName = $"{meeting.Organizer?.Name} {meeting.Organizer?.Surname}",
            Status = meeting.Status,
            CreatedAt = meeting.CreatedAt,
            Attendees = meeting.Attendees.Select(a => new MeetingAttendeeDto
            {
                Id = a.Id,
                UserId = a.UserId,
                Name = $"{a.User?.Name} {a.User?.Surname}",
                Email = a.User?.Email ?? "",
                ProfilePictureUrl = a.User?.ProfilePictureUrl,
                ResponseStatus = a.ResponseStatus,
                RespondedAt = a.RespondedAt
            }).ToList()
        };
    }
}
