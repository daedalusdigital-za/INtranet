using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace ProjectTracker.API.Models.Logistics.Shipments
{
    /// <summary>
    /// A sign-in for the Rocket Freight client portal. Belongs to exactly one logistics
    /// customer; every portal request is scoped to that customer from the token, never
    /// from a parameter. Kept apart from intranet <see cref="Models.User"/> on purpose.
    /// </summary>
    [Table("PortalUsers")]
    public class PortalUser
    {
        public int Id { get; set; }
        public int CustomerId { get; set; }
        [Required, MaxLength(150)] public string Name { get; set; } = string.Empty;
        [Required, MaxLength(200)] public string Email { get; set; } = string.Empty;
        [MaxLength(50)] public string? Phone { get; set; }
        [Required, MaxLength(200)] public string PasswordHash { get; set; } = string.Empty;
        /// <summary>user | admin (admin may manage the address book and notification settings for the account).</summary>
        [MaxLength(20)] public string Role { get; set; } = "user";
        public bool IsActive { get; set; } = true;
        /// <summary>True until the first sign-in after the password was set by ops.</summary>
        public bool MustChangePassword { get; set; }
        public int FailedLogins { get; set; }
        public DateTime? LockedUntil { get; set; }
        public DateTime? LastLoginAt { get; set; }
        [MaxLength(100)] public string? ResetToken { get; set; }
        public DateTime? ResetTokenExpiresAt { get; set; }
        public int? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public virtual Customer? Customer { get; set; }
    }

    /// <summary>Per portal user notification choices (the portal's NotificationPrefs shape, stored as JSON).</summary>
    [Table("PortalNotificationPrefs")]
    public class PortalNotificationPref
    {
        public int Id { get; set; }
        public int PortalUserId { get; set; }
        /// <summary>JSON: { rules: [{event, email, sms}], extraEmails: [], smsNumber, smsOptIn }</summary>
        public string PrefsJson { get; set; } = "{}";
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public virtual PortalUser PortalUser { get; set; } = null!;
    }

    /// <summary>One line in a portal user's support conversation (client ↔ ops).</summary>
    [Table("PortalSupportMessages")]
    public class PortalSupportMessage
    {
        public int Id { get; set; }
        public int PortalUserId { get; set; }
        /// <summary>client | agent | system</summary>
        [MaxLength(10)] public string From { get; set; } = "client";
        [Required, MaxLength(4000)] public string Text { get; set; } = string.Empty;
        [MaxLength(150)] public string? AuthorName { get; set; }
        public int? ShipmentId { get; set; }
        /// <summary>Waybill or booking number the message is about, denormalised for display.</summary>
        [MaxLength(30)] public string? ShipmentRef { get; set; }
        /// <summary>Intranet user who replied (agent messages).</summary>
        public int? AgentUserId { get; set; }
        public bool ReadByAgent { get; set; }
        public bool ReadByClient { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual PortalUser PortalUser { get; set; } = null!;
    }
}
