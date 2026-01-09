using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    /// <summary>
    /// Represents a document stored in the knowledge base
    /// </summary>
    public class KnowledgeBaseDocument
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(500)]
        public string FileName { get; set; } = string.Empty;

        [Required]
        [MaxLength(1000)]
        public string FilePath { get; set; } = string.Empty;

        [MaxLength(50)]
        public string FileType { get; set; } = string.Empty;

        public long FileSize { get; set; }

        [MaxLength(64)]
        public string FileHash { get; set; } = string.Empty; // SHA256 hash to detect changes

        [MaxLength(500)]
        public string Title { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string Description { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Category { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string Tags { get; set; } = string.Empty; // Comma-separated tags

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? LastIndexedAt { get; set; }

        public bool IsActive { get; set; } = true;

        public int ChunkCount { get; set; }

        // Navigation property
        public virtual ICollection<KnowledgeBaseChunk> Chunks { get; set; } = new List<KnowledgeBaseChunk>();
    }

    /// <summary>
    /// Represents a text chunk from a document with its embedding vector
    /// </summary>
    public class KnowledgeBaseChunk
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int DocumentId { get; set; }

        [ForeignKey("DocumentId")]
        public virtual KnowledgeBaseDocument? Document { get; set; }

        public int ChunkIndex { get; set; } // Position of chunk in document

        [Required]
        public string Content { get; set; } = string.Empty; // The actual text chunk

        public int ContentLength { get; set; }

        public int StartPosition { get; set; } // Character position in original document

        public int EndPosition { get; set; }

        // Simple keyword-based embedding stored as JSON array of word frequencies
        // Format: {"word1": 0.5, "word2": 0.3, ...}
        public string? EmbeddingJson { get; set; }

        // Comma-separated keywords for full-text search
        public string? Keywords { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    /// <summary>
    /// Tracks ingestion jobs for the knowledge base
    /// </summary>
    public class KnowledgeBaseIngestionLog
    {
        [Key]
        public int Id { get; set; }

        [MaxLength(500)]
        public string FileName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string Status { get; set; } = "Pending"; // Pending, Processing, Completed, Failed

        public int ChunksCreated { get; set; }

        [MaxLength(2000)]
        public string? ErrorMessage { get; set; }

        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        public DateTime? CompletedAt { get; set; }

        public double ProcessingTimeMs { get; set; }
    }

    /// <summary>
    /// DTO for knowledge base search results
    /// </summary>
    public class KnowledgeBaseSearchResult
    {
        public int ChunkId { get; set; }
        public int DocumentId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public double Score { get; set; }
        public string Category { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for document upload
    /// </summary>
    public class KnowledgeBaseUploadDto
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? Category { get; set; }
        public string? Tags { get; set; }
    }

    /// <summary>
    /// DTO for search request
    /// </summary>
    public class KnowledgeBaseSearchRequest
    {
        [Required]
        public string Query { get; set; } = string.Empty;
        public int TopK { get; set; } = 5;
        public string? Category { get; set; }
    }
}
