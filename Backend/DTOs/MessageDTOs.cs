using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.DTOs
{
    // Conversation DTOs
    public class ConversationDto
    {
        public int ConversationId { get; set; }
        public string? Subject { get; set; }
        public bool IsGroupChat { get; set; }
        public string? GroupName { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public List<ParticipantDto> Participants { get; set; } = new();
        public MessageDto? LastMessage { get; set; }
        public int UnreadCount { get; set; }
    }

    public class ParticipantDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Surname { get; set; } = string.Empty;
        public string FullName => $"{Name} {Surname}";
        public string? ProfilePictureUrl { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsOnline { get; set; }
        public DateTime? LastReadAt { get; set; }
    }

    public class CreateConversationRequest
    {
        [Required]
        public List<int> ParticipantUserIds { get; set; } = new();
        public string? Subject { get; set; }
        public bool IsGroupChat { get; set; } = false;
        public string? GroupName { get; set; }
        public string? InitialMessage { get; set; }
    }

    public class UpdateConversationRequest
    {
        public string? Subject { get; set; }
        public string? GroupName { get; set; }
    }

    // Message DTOs
    public class MessageDto
    {
        public int MessageId { get; set; }
        public int ConversationId { get; set; }
        public int SenderId { get; set; }
        public string SenderName { get; set; } = string.Empty;
        public string SenderFullName { get; set; } = string.Empty;
        public string? SenderProfilePicture { get; set; }
        public string Content { get; set; } = string.Empty;
        public string MessageType { get; set; } = "text";
        public bool IsEdited { get; set; }
        public DateTime? EditedAt { get; set; }
        public bool IsDeleted { get; set; }
        public int? ReplyToMessageId { get; set; }
        public MessageDto? ReplyToMessage { get; set; }
        public DateTime SentAt { get; set; }
        public List<MessageAttachmentDto> Attachments { get; set; } = new();
        public List<ReadReceiptDto> ReadReceipts { get; set; } = new();
        public bool IsRead { get; set; }
    }

    public class SendMessageRequest
    {
        [Required]
        public int ConversationId { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public string MessageType { get; set; } = "text";

        public int? ReplyToMessageId { get; set; }
    }

    public class SendDirectMessageRequest
    {
        [Required]
        public int RecipientUserId { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public string? Subject { get; set; }
    }

    public class EditMessageRequest
    {
        [Required]
        public string Content { get; set; } = string.Empty;
    }

    // Message Attachment DTOs
    public class MessageAttachmentDto
    {
        public int AttachmentId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string MimeType { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public string? FileUrl { get; set; }
        public string? ThumbnailUrl { get; set; }
        public DateTime UploadedAt { get; set; }
    }

    public class UploadAttachmentRequest
    {
        [Required]
        public int MessageId { get; set; }

        [Required]
        public string FileName { get; set; } = string.Empty;

        [Required]
        public string MimeType { get; set; } = string.Empty;

        [Required]
        public string Base64Data { get; set; } = string.Empty;
    }

    // Read Receipt DTOs
    public class ReadReceiptDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public DateTime ReadAt { get; set; }
    }

    public class MarkAsReadRequest
    {
        [Required]
        public int ConversationId { get; set; }

        public int? UpToMessageId { get; set; }
    }

    // Search and Filter
    public class MessageSearchRequest
    {
        public string? SearchTerm { get; set; }
        public int? ConversationId { get; set; }
        public int? SenderId { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public bool? HasAttachments { get; set; }
        public int Page { get; set; } = 1;
        public int PageSize { get; set; } = 50;
    }

    // Statistics
    public class MessagingStatsDto
    {
        public int TotalConversations { get; set; }
        public int UnreadConversations { get; set; }
        public int TotalMessages { get; set; }
        public int UnreadMessages { get; set; }
        public int TotalAttachments { get; set; }
        public Dictionary<string, int> MessagesByDay { get; set; } = new();
    }

    // Real-time events
    public class TypingIndicator
    {
        public int ConversationId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public bool IsTyping { get; set; }
    }

    public class OnlineStatus
    {
        public int UserId { get; set; }
        public bool IsOnline { get; set; }
        public DateTime? LastSeen { get; set; }
    }

    // User Search
    public class UserSearchDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Surname { get; set; } = string.Empty;
        public string FullName => $"{Name} {Surname}";
        public string Email { get; set; } = string.Empty;
        public string? Title { get; set; }
        public string? Department { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string? ProfilePictureData { get; set; }
        public string? ProfilePictureMimeType { get; set; }
    }
}
