using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models;

public class Meeting
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;
    
    [MaxLength(1000)]
    public string? Description { get; set; }
    
    [Required]
    public DateTime MeetingDate { get; set; }
    
    [Required]
    public TimeSpan StartTime { get; set; }
    
    public TimeSpan? EndTime { get; set; }
    
    [Required]
    [MaxLength(50)]
    public string Location { get; set; } = "Online"; // Online, Boardroom
    
    [MaxLength(500)]
    public string? MeetingLink { get; set; } // For online meetings (Teams/Zoom link)
    
    [Required]
    public int OrganizerId { get; set; }
    
    [ForeignKey("OrganizerId")]
    public User? Organizer { get; set; }
    
    [Required]
    [MaxLength(20)]
    public string Status { get; set; } = "Pending"; // Pending, Confirmed, Cancelled
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
    
    public ICollection<MeetingAttendee> Attendees { get; set; } = new List<MeetingAttendee>();
}

public class MeetingAttendee
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public int MeetingId { get; set; }
    
    [ForeignKey("MeetingId")]
    public Meeting? Meeting { get; set; }
    
    [Required]
    public int UserId { get; set; }
    
    [ForeignKey("UserId")]
    public User? User { get; set; }
    
    [Required]
    [MaxLength(20)]
    public string ResponseStatus { get; set; } = "Pending"; // Pending, Accepted, Declined
    
    public DateTime? RespondedAt { get; set; }
    
    public DateTime InvitedAt { get; set; } = DateTime.UtcNow;
}

public class MeetingNotification
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public int MeetingId { get; set; }
    
    [ForeignKey("MeetingId")]
    public Meeting? Meeting { get; set; }
    
    [Required]
    public int UserId { get; set; }
    
    [ForeignKey("UserId")]
    public User? User { get; set; }
    
    [Required]
    [MaxLength(500)]
    public string Message { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(50)]
    public string NotificationType { get; set; } = "Invitation"; // Invitation, Reminder, Update, Cancellation, Response
    
    public bool IsRead { get; set; } = false;
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
