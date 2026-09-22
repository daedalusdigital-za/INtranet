using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Paperless
{
    /// <summary>
    /// A persisted in-app notification for a Paperless workflow event. The web
    /// notification bell polls these (the browser has no SignalR client), so a
    /// row here is how a recipient actually learns they were added, that someone
    /// signed, or that a document changed. A matching SignalR push is still sent
    /// for the desktop tray notifier.
    /// </summary>
    public class PaperlessNotification
    {
        [Key]
        public int Id { get; set; }

        /// <summary>System user this notification is for.</summary>
        public int UserId { get; set; }

        /// <summary>Related Paperless document id.</summary>
        [MaxLength(64)]
        public string DocumentId { get; set; } = string.Empty;

        [MaxLength(400)]
        public string DocumentName { get; set; } = string.Empty;

        /// <summary>Event kind: added | signed | approved | declined | completed | updated | shared.</summary>
        [MaxLength(40)]
        public string Type { get; set; } = "updated";

        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(600)]
        public string Body { get; set; } = string.Empty;

        public bool IsRead { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
