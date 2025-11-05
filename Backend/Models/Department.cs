using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models
{
    public class Department
    {
        [Key]
        public int DepartmentId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? ManagerName { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        public ICollection<Board> Boards { get; set; } = new List<Board>();
        public ICollection<User> Users { get; set; } = new List<User>();
    }
}
