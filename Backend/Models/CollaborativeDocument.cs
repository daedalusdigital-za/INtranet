using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    public class CollaborativeDocument
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        [Required]
        public int CreatedById { get; set; }

        [ForeignKey("CreatedById")]
        public virtual User? CreatedBy { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public int? LastModifiedById { get; set; }

        [ForeignKey("LastModifiedById")]
        public virtual User? LastModifiedBy { get; set; }

        public bool IsDeleted { get; set; } = false;

        // Access control
        public bool IsPublic { get; set; } = false;

        // Navigation property for snapshots
        public virtual ICollection<DocumentSnapshot> Snapshots { get; set; } = new List<DocumentSnapshot>();

        // Navigation property for collaborators
        public virtual ICollection<DocumentCollaborator> Collaborators { get; set; } = new List<DocumentCollaborator>();
    }

    public class DocumentSnapshot
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int DocumentId { get; set; }

        [ForeignKey("DocumentId")]
        public virtual CollaborativeDocument? Document { get; set; }

        // Yjs state stored as base64 encoded binary
        [Required]
        public string YjsState { get; set; } = string.Empty;

        // Version number for ordering
        public int Version { get; set; } = 1;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? CreatedById { get; set; }

        [ForeignKey("CreatedById")]
        public virtual User? CreatedBy { get; set; }
    }

    public class DocumentCollaborator
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int DocumentId { get; set; }

        [ForeignKey("DocumentId")]
        public virtual CollaborativeDocument? Document { get; set; }

        [Required]
        public int UserId { get; set; }

        [ForeignKey("UserId")]
        public virtual User? User { get; set; }

        // "owner", "editor", "viewer"
        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = "viewer";

        public DateTime AddedAt { get; set; } = DateTime.UtcNow;
    }
}
