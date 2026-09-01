using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models
{
    /// <summary>
    /// Welly's long-term memory / central task cache.
    /// Every time Welly performs a meaningful task (e.g. a supplier invoice
    /// breakdown, a document analysis, a report), a memory record is written here.
    /// These memories are shared across ALL users and can be recalled during chat,
    /// so Welly can "remember" what it has done before — like a daily central cache.
    /// </summary>
    public class WellyMemory
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// Category of the memory, e.g. "supplier-analysis", "document-analysis",
        /// "tender-review". Used for filtering and grouping.
        /// </summary>
        [Required]
        [MaxLength(100)]
        public string MemoryType { get; set; } = string.Empty;

        /// <summary>
        /// Short human-readable title, e.g. "Supplier analysis: SYNAP TIX (PTY) LTD".
        /// </summary>
        [Required]
        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        /// <summary>
        /// The primary entity this memory relates to, e.g. a supplier name,
        /// customer name, or document name. Enables quick lookups.
        /// </summary>
        [MaxLength(500)]
        public string? EntityName { get; set; }

        /// <summary>
        /// A concise 1-3 sentence summary of what Welly found/did. This is what
        /// gets injected into chat context for fast recall.
        /// </summary>
        [MaxLength(4000)]
        public string Summary { get; set; } = string.Empty;

        /// <summary>
        /// The full result / analysis text. Stored for deep recall on request.
        /// </summary>
        public string? FullContent { get; set; }

        /// <summary>
        /// Comma/space separated keywords used for lightweight text matching
        /// when recalling memories during chat.
        /// </summary>
        [MaxLength(1000)]
        public string? Keywords { get; set; }

        /// <summary>
        /// Optional structured metadata as JSON (invoice count, total spend, etc.).
        /// </summary>
        public string? MetadataJson { get; set; }

        /// <summary>
        /// The user who triggered the task that created this memory.
        /// </summary>
        public int? UserId { get; set; }

        [MaxLength(300)]
        public string? UserName { get; set; }

        /// <summary>
        /// The calendar day this memory belongs to (UTC date, time zeroed).
        /// Enables per-day central logging of everything Welly did.
        /// </summary>
        public DateTime MemoryDate { get; set; } = DateTime.UtcNow.Date;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Soft delete / archive flag.
        /// </summary>
        public bool IsActive { get; set; } = true;
    }
}
