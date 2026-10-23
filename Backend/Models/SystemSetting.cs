using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models
{
    /// <summary>
    /// Generic key/value store for admin-editable runtime settings (e.g. Google Maps API key).
    /// </summary>
    public class SystemSetting
    {
        [Key]
        [MaxLength(100)]
        public string Key { get; set; } = string.Empty;

        public string? Value { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        [MaxLength(200)]
        public string? UpdatedBy { get; set; }
    }

    public static class SystemSettingKeys
    {
        public const string GoogleMapsApiKey = "GoogleMaps.ApiKey";
    }
}
