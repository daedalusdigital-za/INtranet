using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Welly
{
    /// <summary>
    /// A task a person recorded once in the intranet (page changes, clicks on named controls, typed values) so Welly
    /// can walk anyone through it again. Values from password / PIN / card / token fields are never stored.
    /// </summary>
    [Table("RecordedTasks")]
    public class RecordedTask
    {
        public int Id { get; set; }
        [Required, MaxLength(150)] public string Name { get; set; } = string.Empty;
        [MaxLength(1000)] public string? Description { get; set; }
        /// <summary>JSON array of steps: kind (navigate|click|fill|select|check), label, url, target, value, input, sensitive.</summary>
        [Required] public string StepsJson { get; set; } = "[]";
        /// <summary>Page the recording started on.</summary>
        [MaxLength(500)] public string? StartUrl { get; set; }
        /// <summary>private (only the person who recorded it) | shared (everyone; each person still needs access to the pages).</summary>
        [Required, MaxLength(10)] public string Visibility { get; set; } = "private";
        public int CreatedByUserId { get; set; }
        [MaxLength(150)] public string? CreatedByName { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public int RunCount { get; set; }
        public DateTime? LastRunAt { get; set; }
        public bool IsDeleted { get; set; }
    }

    /// <summary>One time someone ran a recorded task with Welly: how far it got and why it stopped.</summary>
    [Table("RecordedTaskRuns")]
    public class RecordedTaskRun
    {
        public long Id { get; set; }
        public int RecordedTaskId { get; set; }
        public int UserId { get; set; }
        [MaxLength(150)] public string? UserName { get; set; }
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? FinishedAt { get; set; }
        /// <summary>running | completed | stopped</summary>
        [Required, MaxLength(12)] public string Outcome { get; set; } = "running";
        public int StepsTotal { get; set; }
        /// <summary>Steps Welly did after the person clicked Do it.</summary>
        public int StepsByWelly { get; set; }
        /// <summary>Steps the person did themselves (Welly couldn't find the control, or they chose to).</summary>
        public int StepsByPerson { get; set; }
        public int? StoppedAtStep { get; set; }
        [MaxLength(500)] public string? StopReason { get; set; }
    }
}
