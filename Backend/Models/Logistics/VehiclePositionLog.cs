using System.ComponentModel.DataAnnotations;

namespace ProjectTracker.API.Models.Logistics
{
    /// <summary>
    /// GPS breadcrumb captured from CarTrack's live status for a vehicle while it is on an active load.
    /// CarTrack's API plan does not expose historical positions, so we record them ourselves to be able
    /// to draw the route a vehicle actually drove and compare it with the planned trip sheet.
    /// </summary>
    public class VehiclePositionLog
    {
        [Key]
        public long Id { get; set; }

        public int VehicleId { get; set; }

        /// <summary>Load the vehicle was assigned to when the point was captured (null = not on a load).</summary>
        public int? LoadId { get; set; }

        /// <summary>CarTrack event timestamp (UTC). Unique per vehicle; repeated polls of the same fix are skipped.</summary>
        public DateTime RecordedAt { get; set; }

        public double Latitude { get; set; }
        public double Longitude { get; set; }

        public int? Speed { get; set; }
        public int? Bearing { get; set; }
        public bool? Ignition { get; set; }

        [MaxLength(300)]
        public string? Address { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
