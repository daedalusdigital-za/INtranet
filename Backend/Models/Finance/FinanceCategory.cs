using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Finance
{
    public class FinanceCategory
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        // Type: income, expense, both
        [Required]
        [MaxLength(50)]
        public string Type { get; set; } = "expense";

        [MaxLength(50)]
        public string? Code { get; set; }

        public int? ParentCategoryId { get; set; }

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
