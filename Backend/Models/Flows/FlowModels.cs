using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Flows
{
    /// <summary>
    /// Flows = automated business processes. A FlowDefinition is the blueprint: a trigger plus a
    /// graph of steps stored as JSON (see <see cref="FlowGraph"/>). Runs are instances of a definition.
    /// </summary>
    [Table("FlowDefinitions")]
    public class FlowDefinition
    {
        public int Id { get; set; }

        [Required, MaxLength(150)] public string Name { get; set; } = string.Empty;
        [MaxLength(1000)] public string? Description { get; set; }

        /// <summary>Owning area: logistics | finance | sales | stock | it | hr | management | general</summary>
        [MaxLength(40)] public string Category { get; set; } = "general";

        /// <summary>For operational (department) flows: the department whose day-to-day process this diagram describes. Null for ordinary process flows.</summary>
        [MaxLength(100)] public string? DepartmentName { get; set; }

        /// <summary>1 = manual, 2 = AI-assisted, 3 = automated (informational badge, derived from steps/trigger).</summary>
        public int Level { get; set; } = 1;

        /// <summary>manual | event | schedule</summary>
        [Required, MaxLength(20)] public string TriggerType { get; set; } = FlowTriggerType.Manual;

        /// <summary>JSON: <see cref="FlowTriggerConfig"/>.</summary>
        public string TriggerJson { get; set; } = "{}";

        /// <summary>JSON: <see cref="FlowGraph"/> — ordered steps with branching.</summary>
        public string GraphJson { get; set; } = "{}";

        /// <summary>JSON array of input field definitions shown when starting manually.</summary>
        public string? InputsJson { get; set; }

        public bool IsEnabled { get; set; } = true;
        public bool IsTemplate { get; set; }
        public int Version { get; set; } = 1;

        /// <summary>Comma separated module keys / roles allowed to start manual runs. Empty = anyone with flows access.</summary>
        [MaxLength(300)] public string? StartPermissions { get; set; }

        /// <summary>Last time the scheduler evaluated this flow (schedule triggers).</summary>
        public DateTime? LastScheduledRunAt { get; set; }

        public int? CreatedByUserId { get; set; }
        public int? UpdatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public virtual User? CreatedByUser { get; set; }
        public virtual ICollection<FlowRun> Runs { get; set; } = new List<FlowRun>();
    }

    public static class FlowTriggerType
    {
        public const string Manual = "manual";
        public const string Event = "event";
        public const string Schedule = "schedule";
    }

    public static class FlowRunStatus
    {
        public const string Running = "running";
        public const string Waiting = "waiting";     // waiting on a human task/approval or timer
        public const string Completed = "completed";
        public const string Failed = "failed";
        public const string Cancelled = "cancelled";
    }

    [Table("FlowRuns")]
    public class FlowRun
    {
        public int Id { get; set; }
        public int FlowDefinitionId { get; set; }
        public int DefinitionVersion { get; set; }

        /// <summary>Human readable key e.g. FL-000123.</summary>
        [MaxLength(20)] public string RunNumber { get; set; } = string.Empty;

        /// <summary>Short title for the board, usually templated from the trigger (e.g. "Missing POD — WB-2026-000012").</summary>
        [MaxLength(300)] public string Title { get; set; } = string.Empty;

        [Required, MaxLength(20)] public string Status { get; set; } = FlowRunStatus.Running;

        /// <summary>Id of the step currently executing / waiting.</summary>
        [MaxLength(60)] public string? CurrentStepId { get; set; }

        /// <summary>JSON bag of variables: trigger payload, inputs, AI outputs, task decisions.</summary>
        public string ContextJson { get; set; } = "{}";

        /// <summary>manual | event:<name> | schedule</summary>
        [MaxLength(80)] public string TriggerSource { get; set; } = string.Empty;

        /// <summary>Optional link to the business entity (type + id) so one entity does not spawn duplicate runs.</summary>
        [MaxLength(40)] public string? EntityType { get; set; }
        [MaxLength(60)] public string? EntityKey { get; set; }

        [MaxLength(20)] public string Priority { get; set; } = "Normal";

        public int? StartedByUserId { get; set; }
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        public DateTime? CompletedAt { get; set; }
        /// <summary>When a wait/timer step should resume.</summary>
        public DateTime? ResumeAt { get; set; }
        [MaxLength(2000)] public string? Error { get; set; }
        [MaxLength(100)] public string? Outcome { get; set; }

        public virtual FlowDefinition Definition { get; set; } = null!;
        public virtual User? StartedByUser { get; set; }
        public virtual ICollection<FlowTask> Tasks { get; set; } = new List<FlowTask>();
        public virtual ICollection<FlowAuditEvent> Events { get; set; } = new List<FlowAuditEvent>();
    }

    public static class FlowTaskStatus
    {
        public const string Open = "open";
        public const string Completed = "completed";
        public const string Approved = "approved";
        public const string Rejected = "rejected";
        public const string Escalated = "escalated";
        public const string Cancelled = "cancelled";
    }

    /// <summary>A human step: a task to do or an approval to decide. Can be assigned to a user, a role or a department pool.</summary>
    [Table("FlowTasks")]
    public class FlowTask
    {
        public int Id { get; set; }
        public int FlowRunId { get; set; }
        [MaxLength(60)] public string StepId { get; set; } = string.Empty;

        /// <summary>task | approval</summary>
        [MaxLength(20)] public string Kind { get; set; } = "task";

        [Required, MaxLength(300)] public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }

        public int? AssignedToUserId { get; set; }
        [MaxLength(50)] public string? AssignedToRole { get; set; }
        public int? AssignedToDepartmentId { get; set; }
        [MaxLength(150)] public string? AssigneeLabel { get; set; }

        [MaxLength(20)] public string Priority { get; set; } = "Normal";
        [Required, MaxLength(20)] public string Status { get; set; } = FlowTaskStatus.Open;

        public DateTime? DueAt { get; set; }
        public bool IsOverdue { get; set; }
        public int EscalationCount { get; set; }
        public DateTime? EscalatedAt { get; set; }

        /// <summary>JSON array of form fields the assignee must fill ({key,label,type,required,options}).</summary>
        public string? FormJson { get; set; }
        /// <summary>JSON with what the assignee submitted (fields + decision + comment).</summary>
        public string? ResultJson { get; set; }
        [MaxLength(2000)] public string? Comment { get; set; }

        public int? CompletedByUserId { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>Mirrors the created TodoTask (so the task also shows on the person's dashboard).</summary>
        public int? TodoTaskId { get; set; }

        public virtual FlowRun Run { get; set; } = null!;
        public virtual User? CompletedByUser { get; set; }
    }

    /// <summary>Append-only audit trail for a run.</summary>
    [Table("FlowAuditEvents")]
    public class FlowAuditEvent
    {
        public long Id { get; set; }
        public int FlowRunId { get; set; }
        [MaxLength(60)] public string? StepId { get; set; }
        /// <summary>run.started | step.started | step.completed | step.failed | task.created | task.completed | task.escalated | ai.analyzed | action.executed | run.completed | run.failed | run.cancelled | note</summary>
        [Required, MaxLength(40)] public string Type { get; set; } = string.Empty;
        [MaxLength(1000)] public string Message { get; set; } = string.Empty;
        public string? DataJson { get; set; }
        public int? UserId { get; set; }
        [MaxLength(150)] public string? UserName { get; set; }
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

        public virtual FlowRun Run { get; set; } = null!;
    }

    // ── JSON shapes (not mapped) ──────────────────────────────────────────────────────────────

    public class FlowTriggerConfig
    {
        /// <summary>event: name e.g. shipment.status_changed, shipment.exception, booking.created</summary>
        public string? Event { get; set; }
        /// <summary>event: optional expression filter evaluated against the payload e.g. "{{event.toStatus}} == 'DELIVERY_FAILED'"</summary>
        public string? Filter { get; set; }
        /// <summary>schedule: interval minutes</summary>
        public int? IntervalMinutes { get; set; }
        /// <summary>schedule: built-in data source that yields entities to run against (one run per entity). e.g. shipments_missing_pod, overdue_deliveries, open_shipment_exceptions</summary>
        public string? DataSource { get; set; }
        /// <summary>schedule/data source parameters e.g. {"olderThanHours": 24}</summary>
        public Dictionary<string, object?>? Params { get; set; }
        /// <summary>Title template for runs, e.g. "Missing POD — {{entity.waybillNo}}"</summary>
        public string? TitleTemplate { get; set; }
        /// <summary>Don't start a new run if an open run exists for the same entity key.</summary>
        public bool DedupeByEntity { get; set; } = true;
    }

    public class FlowGraph
    {
        public string? StartStepId { get; set; }
        public List<FlowStep> Steps { get; set; } = new();
    }

    /// <summary>
    /// One node. <c>Type</c> decides which <c>Config</c> keys are used:
    ///  condition     { expression, trueStepId, falseStepId }
    ///  ai_analyze    { prompt, outputKey, fields:[{key,description}] }  → context[outputKey] = {...}
    ///  task          { title, description, assignTo:{userId|role|departmentId|expression}, priority, dueInHours, form:[...], mirrorTodo }
    ///  approval      { title, description, assignTo, dueInHours, approvedStepId, rejectedStepId, escalateTo, escalateAfterHours }
    ///  notify        { to:{...assignTo}, title, body, url }
    ///  email         { to, subject, body }
    ///  welly_action  { action, payload }  (reuses AIActionService, e.g. TRACK_VEHICLE / CREATE_TICKET)
    ///  set           { key, value }
    ///  wait          { hours | minutes | until }
    ///  end           { outcome }
    /// All string values support {{mustache}} templating against the run context.
    /// </summary>
    public class FlowStep
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string? Name { get; set; }
        /// <summary>Default next step (not used by condition/approval which branch).</summary>
        public string? NextStepId { get; set; }
        public Dictionary<string, System.Text.Json.JsonElement> Config { get; set; } = new();
        /// <summary>Editor hint only.</summary>
        public double? X { get; set; }
        public double? Y { get; set; }
    }
}
