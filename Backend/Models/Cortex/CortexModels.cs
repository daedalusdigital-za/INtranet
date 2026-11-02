using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Cortex
{
    /// <summary>Where a node or edge came from. Decides how much it is trusted and how it is drawn.</summary>
    public static class CortexProvenance
    {
        /// <summary>Read automatically from module data, code or configuration. Refreshes itself.</summary>
        public const string Derived = "derived";
        /// <summary>Entered or confirmed by a person. Has an owner and a review date.</summary>
        public const string Curated = "curated";
        /// <summary>Proposed by Welly from patterns. Never becomes fact until a person confirms it.</summary>
        public const string Inferred = "inferred";
    }

    /// <summary>How a hand-off between two steps, departments or systems happens.</summary>
    public static class CortexHandoff
    {
        public const string Automatic = "automatic";
        public const string NeedsSomeone = "manual";
        public const string ReadOnly = "read";
        public const string NotBuilt = "gap";
    }

    /// <summary>
    /// Node types are configuration, not tables: adding a type is a row here. <see cref="Layer"/> groups types for the
    /// layer toggles on the map; <see cref="AttachedType"/> names the knowledge node each core entity carries (a
    /// department has a knowledge node, an employee a responsibilities node, a process a workflow node).
    /// </summary>
    public class CortexNodeType
    {
        [Key, MaxLength(40)] public string Key { get; set; } = string.Empty;
        [Required, MaxLength(80)] public string Label { get; set; } = string.Empty;
        [Required, MaxLength(30)] public string Layer { get; set; } = string.Empty;
        [MaxLength(40)] public string Icon { get; set; } = "circle";
        [MaxLength(20)] public string Color { get; set; } = "#94a3b8";
        [MaxLength(40)] public string? AttachedType { get; set; }
        /// <summary>Zoom level (1 group … 5 item) at which this type first appears.</summary>
        public int ZoomLevel { get; set; } = 3;
        public int SortOrder { get; set; }
        /// <summary>Default source system / module the type is derived from.</summary>
        [MaxLength(60)] public string? DefaultSource { get; set; }
    }

    public class CortexNode
    {
        public int Id { get; set; }
        /// <summary>Stable key such as dept:12, emp:63, flow:40, module:sales. Unique.</summary>
        [Required, MaxLength(120)] public string Key { get; set; } = string.Empty;
        [Required, MaxLength(40)] public string Type { get; set; } = string.Empty;
        [Required, MaxLength(200)] public string Label { get; set; } = string.Empty;
        [MaxLength(60)] public string? Short { get; set; }
        [MaxLength(1000)] public string? Summary { get; set; }
        /// <summary>Parent in the zoom hierarchy (employee → department → company; step → process).</summary>
        [MaxLength(120)] public string? ParentKey { get; set; }

        [Required, MaxLength(12)] public string Provenance { get; set; } = CortexProvenance.Derived;
        /// <summary>Which module/table/code produced it, e.g. "Departments", "FlowDefinitions", "code:cortex-model".</summary>
        [MaxLength(120)] public string? Source { get; set; }
        /// <summary>Entity id in the source, for deep links.</summary>
        [MaxLength(60)] public string? SourceId { get; set; }

        public int? OwnerUserId { get; set; }
        [MaxLength(150)] public string? OwnerLabel { get; set; }
        /// <summary>Permission key a user needs to see this node (null = anyone with Flows access).</summary>
        [MaxLength(60)] public string? Permission { get; set; }
        /// <summary>Curated nodes expire: overdue items fade on the map.</summary>
        public DateTime? ReviewDueAt { get; set; }

        /// <summary>Intranet route for "open".</summary>
        [MaxLength(200)] public string? Route { get; set; }
        /// <summary>Type-specific payload: KPIs, responsibilities, systems used, steps, rates…</summary>
        public string? DataJson { get; set; }
        /// <summary>Welly's reasoning for an inferred node, kept so the reviewer sees why.</summary>
        [MaxLength(1000)] public string? Rationale { get; set; }

        /// <summary>Pending (inferred), accepted, rejected. Derived/curated nodes are always accepted.</summary>
        [MaxLength(12)] public string Status { get; set; } = "accepted";
        public bool IsActive { get; set; } = true;
        /// <summary>Set by the last rebuild; derived nodes not seen in a rebuild are deactivated, never deleted.</summary>
        public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public int? UpdatedByUserId { get; set; }
    }

    public class CortexEdge
    {
        public int Id { get; set; }
        [Required, MaxLength(120)] public string FromKey { get; set; } = string.Empty;
        [Required, MaxLength(120)] public string ToKey { get; set; } = string.Empty;
        /// <summary>belongs_to, reports_to, responsible_for, approves, uses, produces, consumes, serves, supplies, priced_by, integrates_with, can_access, decided_by, documented_in, handoff.</summary>
        [Required, MaxLength(30)] public string Relation { get; set; } = string.Empty;
        [MaxLength(200)] public string? Label { get; set; }
        /// <summary>Only for Relation = handoff: automatic / manual / read / gap.</summary>
        [MaxLength(12)] public string? Handoff { get; set; }
        /// <summary>True when the hand-off class was set by a person rather than read from code.</summary>
        public bool HandoffCurated { get; set; }
        /// <summary>Code reference that performs the hand-off (file / method), so the map stays honest.</summary>
        [MaxLength(200)] public string? CodeRef { get; set; }

        [Required, MaxLength(12)] public string Provenance { get; set; } = CortexProvenance.Derived;
        [MaxLength(120)] public string? Source { get; set; }
        public int? Weight { get; set; }
        public string? DataJson { get; set; }
        [MaxLength(1000)] public string? Rationale { get; set; }
        [MaxLength(12)] public string Status { get; set; } = "accepted";
        public bool IsActive { get; set; } = true;
        public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Flow metrics, filled by the evidence layer from the event stream.
        public double? DwellAvgHours { get; set; }
        public double? DwellMedianHours { get; set; }
        public double? DwellP90Hours { get; set; }
        public int? QueueSize { get; set; }
        public DateTime? MetricsAt { get; set; }
    }

    /// <summary>Every change to a node or edge, so the map can be replayed for any past date.</summary>
    public class CortexChange
    {
        public long Id { get; set; }
        [Required, MaxLength(4)] public string Target { get; set; } = "node"; // node | edge
        [Required, MaxLength(250)] public string TargetKey { get; set; } = string.Empty;
        /// <summary>created, updated, deactivated, reactivated, accepted, rejected, curated.</summary>
        [Required, MaxLength(12)] public string Kind { get; set; } = string.Empty;
        [MaxLength(60)] public string? Field { get; set; }
        public string? OldValue { get; set; }
        public string? NewValue { get; set; }
        /// <summary>"rebuild", "user", "welly".</summary>
        [MaxLength(20)] public string ChangedBy { get; set; } = "rebuild";
        public int? UserId { get; set; }
        [MaxLength(150)] public string? UserName { get; set; }
        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    }
}
