using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Flows
{
    /// <summary>
    /// A shared Home widget designed in the Flows module. The widget type and config match the
    /// front end's Home widget registry (flow-kpi, flow-runs, flow-start, links …). Designers
    /// publish widgets; anyone may add a published widget to their Home. Templates are starting
    /// points that get cloned into a real widget.
    /// </summary>
    [Table("FlowWidgets")]
    public class FlowWidget
    {
        public int Id { get; set; }
        [Required, MaxLength(120)] public string Name { get; set; } = string.Empty;
        [MaxLength(500)] public string? Description { get; set; }
        [MaxLength(60)] public string Icon { get; set; } = "widgets";
        /// <summary>Home widget type key, e.g. flow-kpi | flow-runs | flow-start | flow-tasks | links | note.</summary>
        [Required, MaxLength(40)] public string Type { get; set; } = "flow-kpi";
        /// <summary>sm | md | lg | xl</summary>
        [MaxLength(4)] public string Size { get; set; } = "sm";
        /// <summary>JSON config for the widget (flowId, metric, flowIds, links, title…).</summary>
        public string ConfigJson { get; set; } = "{}";
        [MaxLength(40)] public string Category { get; set; } = "General";
        /// <summary>Optional: only people in this department see it in the library. Null = everyone.</summary>
        [MaxLength(100)] public string? DepartmentName { get; set; }
        public bool IsTemplate { get; set; }
        public bool IsPublished { get; set; } = true;
        public int UseCount { get; set; }
        public int? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
    }
}
