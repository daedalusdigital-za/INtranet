using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models
{
    [Table("admin")]
    public class Admin
    {
        [Key]
        [Column("Id")]
        public int Id { get; set; }

        [Required]
        [Column("Username")]
        [MaxLength(100)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [Column("Password")]
        [MaxLength(100)]
        public string Password { get; set; } = string.Empty;

        [Column("FirstName")]
        [MaxLength(100)]
        public string? FirstName { get; set; }

        [Column("LastName")]
        [MaxLength(100)]
        public string? LastName { get; set; }
    }
}
