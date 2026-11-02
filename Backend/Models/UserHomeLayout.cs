using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models
{
    /// <summary>
    /// A person's Home page arrangement: which widgets, in what order and size, and their shortcuts.
    /// Stored as JSON so the front end can add widget types without a schema change.
    /// </summary>
    public class UserHomeLayout
    {
        [Key]
        public int Id { get; set; }
        public int UserId { get; set; }
        public string LayoutJson { get; set; } = "{}";
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
