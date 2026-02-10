namespace ProjectTracker.API.DTOs
{
    // Request DTOs
    public class CreateDocumentDto
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsPublic { get; set; } = false;
    }

    public class UpdateDocumentDto
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public bool? IsPublic { get; set; }
    }

    public class SaveSnapshotDto
    {
        public int DocumentId { get; set; }
        public string YjsState { get; set; } = string.Empty;
    }

    public class AddCollaboratorDto
    {
        public int UserId { get; set; }
        public string Role { get; set; } = "editor";
    }

    // Response DTOs
    public class DocumentListItemDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public string? LastModifiedByName { get; set; }
        public bool IsPublic { get; set; }
        public string UserRole { get; set; } = string.Empty;
        public int CollaboratorCount { get; set; }
    }

    public class DocumentDetailDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public int CreatedById { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public bool IsPublic { get; set; }
        public string? YjsState { get; set; }
        public int Version { get; set; }
        public List<CollaboratorDto> Collaborators { get; set; } = new();
    }

    public class CollaboratorDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime AddedAt { get; set; }
    }

    public class DocumentSnapshotDto
    {
        public int Id { get; set; }
        public int DocumentId { get; set; }
        public string YjsState { get; set; } = string.Empty;
        public int Version { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // Presence DTOs for real-time
    public class UserPresenceDto
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Color { get; set; } = string.Empty;
        public CursorPosition? Cursor { get; set; }
    }

    public class CursorPosition
    {
        public int From { get; set; }
        public int To { get; set; }
    }

    public class DocumentUpdateDto
    {
        public int DocumentId { get; set; }
        public string Update { get; set; } = string.Empty; // Base64 encoded Yjs update
        public int UserId { get; set; }
    }
}
