using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class Conversation
    {
        [Key]
        public int ConversationId { get; set; }

        [MaxLength(200)]
        public string? Subject { get; set; }

        public bool IsGroupChat { get; set; } = false;

        [MaxLength(100)]
        public string? GroupName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastMessageAt { get; set; }

        // Navigation properties
        public ICollection<ConversationParticipant> Participants { get; set; } = new List<ConversationParticipant>();
        public ICollection<Message> Messages { get; set; } = new List<Message>();
    }

    public class ConversationParticipant
    {
        [Key]
        public int ParticipantId { get; set; }

        public int ConversationId { get; set; }

        [ForeignKey("ConversationId")]
        public Conversation Conversation { get; set; } = null!;

        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastReadAt { get; set; }

        public bool IsAdmin { get; set; } = false; // For group chats

        public bool IsMuted { get; set; } = false;

        public bool HasLeft { get; set; } = false;
    }

    public class Message
    {
        [Key]
        public int MessageId { get; set; }

        public int ConversationId { get; set; }

        [ForeignKey("ConversationId")]
        public Conversation Conversation { get; set; } = null!;

        public int SenderId { get; set; }

        [ForeignKey("SenderId")]
        public User Sender { get; set; } = null!;

        [Required]
        public string Content { get; set; } = string.Empty;

        [MaxLength(20)]
        public string MessageType { get; set; } = "text"; // text, image, file, system

        public bool IsEdited { get; set; } = false;

        public DateTime? EditedAt { get; set; }

        public bool IsDeleted { get; set; } = false;

        public int? ReplyToMessageId { get; set; }

        [ForeignKey("ReplyToMessageId")]
        public Message? ReplyToMessage { get; set; }

        public DateTime SentAt { get; set; } = DateTime.UtcNow;

        // Navigation properties
        public ICollection<MessageAttachment> Attachments { get; set; } = new List<MessageAttachment>();
        public ICollection<MessageReadReceipt> ReadReceipts { get; set; } = new List<MessageReadReceipt>();
    }

    public class MessageAttachment
    {
        [Key]
        public int AttachmentId { get; set; }

        public int MessageId { get; set; }

        [ForeignKey("MessageId")]
        public Message Message { get; set; } = null!;

        [Required]
        [MaxLength(255)]
        public string FileName { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string MimeType { get; set; } = string.Empty;

        public long FileSize { get; set; }

        [MaxLength(500)]
        public string? FileUrl { get; set; }

        public byte[]? FileData { get; set; }

        [MaxLength(500)]
        public string? ThumbnailUrl { get; set; }

        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    }

    public class MessageReadReceipt
    {
        [Key]
        public int ReceiptId { get; set; }

        public int MessageId { get; set; }

        [ForeignKey("MessageId")]
        public Message Message { get; set; } = null!;

        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public User User { get; set; } = null!;

        public DateTime ReadAt { get; set; } = DateTime.UtcNow;
    }
}
