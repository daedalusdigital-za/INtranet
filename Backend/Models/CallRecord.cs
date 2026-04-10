using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    [Table("CallRecords")]
    public class CallRecord
    {
        [Key]
        public long Id { get; set; }

        [MaxLength(50)]
        public string? AccountCode { get; set; }

        [Required]
        [MaxLength(50)]
        public string CallerNumber { get; set; } = string.Empty;

        [MaxLength(10)]
        public string? CallerNat { get; set; }

        [Required]
        [MaxLength(50)]
        public string CalleeNumber { get; set; } = string.Empty;

        [MaxLength(10)]
        public string? CalleeNat { get; set; }

        [MaxLength(100)]
        public string? Context { get; set; }

        [MaxLength(500)]
        public string? CallerId { get; set; }

        [MaxLength(200)]
        public string? SourceChannel { get; set; }

        [MaxLength(200)]
        public string? DestChannel { get; set; }

        [MaxLength(100)]
        public string? LastApp { get; set; }

        [MaxLength(500)]
        public string? LastData { get; set; }

        [Required]
        public DateTime StartTime { get; set; }

        public DateTime? AnswerTime { get; set; }

        public DateTime? EndTime { get; set; }

        public int CallTime { get; set; } // Total call duration in seconds

        public int TalkTime { get; set; } // Talk time in seconds

        [Required]
        [MaxLength(20)]
        public string CallStatus { get; set; } = string.Empty; // ANSWERED, NO ANSWER, FAILED, BUSY

        [MaxLength(50)]
        public string? AmaFlags { get; set; }

        [MaxLength(100)]
        public string? UniqueId { get; set; }

        [Required]
        [MaxLength(20)]
        public string CallType { get; set; } = string.Empty; // Outbound, Inbound, Internal, External

        [MaxLength(100)]
        public string? DestChannelExtension { get; set; }

        [MaxLength(200)]
        public string? CallerName { get; set; }

        [MaxLength(200)]
        public string? AnsweredBy { get; set; }

        [MaxLength(200)]
        public string? Session { get; set; }

        [MaxLength(100)]
        public string? PremierCaller { get; set; }

        [MaxLength(50)]
        public string? ActionType { get; set; }

        [MaxLength(200)]
        public string? SourceTrunkName { get; set; }

        [MaxLength(200)]
        public string? DestinationTrunkName { get; set; }
    }
}
