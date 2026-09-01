using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// A persisted CarTrack trip/movement leg for a vehicle on a given day.
    /// CarTrack only exposes a limited live window, so we snapshot trips daily
    /// into this table to build a permanent movement history that can be
    /// back-dated. Rows are upserted idempotently on <see cref="CartrackTripId"/>.
    /// Mirrors the fields of CarTrackTripData for a clean mapping.
    /// </summary>
    public class VehicleMovementHistory
    {
        [Key]
        public int Id { get; set; }

        public int? VehicleId { get; set; }

        [Required]
        [MaxLength(50)]
        public string RegistrationNumber { get; set; } = string.Empty;

        /// <summary>Calendar day (date-only) this movement belongs to.</summary>
        [Column(TypeName = "date")]
        public DateTime MovementDate { get; set; }

        /// <summary>CarTrack trip identifier used for idempotent upserts.</summary>
        public long CartrackTripId { get; set; }

        // Timing (stored as strings to match CarTrack's raw timestamp format)
        [MaxLength(50)]
        public string? StartTimestamp { get; set; }

        [MaxLength(50)]
        public string? EndTimestamp { get; set; }

        [MaxLength(50)]
        public string? TripDuration { get; set; }

        public int TripDurationSeconds { get; set; }

        // Locations
        [MaxLength(300)]
        public string? StartLocation { get; set; }

        [MaxLength(300)]
        public string? EndLocation { get; set; }

        [MaxLength(300)]
        public string? StartGeofence { get; set; }

        [MaxLength(300)]
        public string? EndGeofence { get; set; }

        public double StartLatitude { get; set; }
        public double StartLongitude { get; set; }
        public double EndLatitude { get; set; }
        public double EndLongitude { get; set; }

        // Metrics
        public double TripDistance { get; set; } // meters
        public double MaxSpeed { get; set; }
        public int HarshBrakingEvents { get; set; }
        public int HarshCorneringEvents { get; set; }
        public int HarshAccelerationEvents { get; set; }
        public int IdleTimeSeconds { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        [ForeignKey("VehicleId")]
        public virtual Vehicle? Vehicle { get; set; }
    }
}
