using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// A logged security/monitoring incident detected by the controller / open map.
    /// Categories: Speeding, CurfewMovement, GeofenceExit. Records are grouped by
    /// IncidentDate (the SAST calendar date the incident belongs to) so a daily
    /// report can be produced and exported.
    /// </summary>
    public class LogisticsIncident
    {
        [Key]
        public int Id { get; set; }

        /// <summary>Speeding | CurfewMovement | GeofenceExit</summary>
        [Required]
        [MaxLength(40)]
        public string Type { get; set; } = string.Empty;

        /// <summary>Low | Medium | High — used for colour coding.</summary>
        [MaxLength(20)]
        public string Severity { get; set; } = "Medium";

        [Required]
        [MaxLength(50)]
        public string Registration { get; set; } = string.Empty;

        [MaxLength(150)]
        public string? Driver { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? Latitude { get; set; }

        [Column(TypeName = "decimal(10,7)")]
        public decimal? Longitude { get; set; }

        [MaxLength(300)]
        public string? Address { get; set; }

        /// <summary>Speed at the time of the incident (km/h) — for speeding.</summary>
        public double? Speed { get; set; }

        /// <summary>Nearest / home geofence zone name — for geofence exits.</summary>
        [MaxLength(150)]
        public string? Zone { get; set; }

        /// <summary>Distance outside the zone in metres — for geofence exits.</summary>
        public double? DistanceMeters { get; set; }

        /// <summary>Whether the incident occurred during curfew hours.</summary>
        public bool DuringCurfew { get; set; }

        [MaxLength(600)]
        public string? Details { get; set; }

        /// <summary>The SAST calendar date this incident is reported under (date-only).</summary>
        public DateTime IncidentDate { get; set; }

        /// <summary>Full SAST timestamp of the incident.</summary>
        public DateTime OccurredAtSast { get; set; }

        public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    }
}
