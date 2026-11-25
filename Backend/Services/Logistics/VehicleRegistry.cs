using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Services.Logistics
{
    /// <summary>
    /// One place that turns a free-text registration into a match key and finds the fleet vehicle for it.
    /// Fuel cards (TFN), Puma slips and CarTrack all spell plates differently ("DM 00 TV ZN", "BH30XN-ZN"),
    /// and people type notes into the fleet record's registration ("EMX047ZN - NEW - VUSI"). An exact
    /// string compare missed those, so their fuel landed on no vehicle at all.
    /// </summary>
    public static class VehicleRegistry
    {
        /// <summary>Registrations that are clearly not a vehicle (a stand-in for "all vehicles", a blank).</summary>
        private static readonly HashSet<string> Placeholders = new(StringComparer.OrdinalIgnoreCase)
        {
            "ALL", "NA", "N/A", "NONE", "TBA", "TBC", "TEST", "GENERAL", "FLEET", "VARIOUS", "UNKNOWN", "-"
        };

        /// <summary>Upper-case, spaces and dashes removed.</summary>
        public static string Normalize(string? reg) =>
            (reg ?? string.Empty).ToUpperInvariant().Replace(" ", "").Replace("-", "").Replace(" ", "").Trim();

        /// <summary>
        /// The plate part of a registration: text after " - " or "(" is a note, not part of the plate
        /// ("EMX047ZN - NEW - VUSI" → EMX047ZN, "CY46YGZN 4TON" → CY46YGZN).
        /// </summary>
        public static string PlateKey(string? reg)
        {
            var s = (reg ?? string.Empty).Trim();
            if (s.Length == 0) return string.Empty;
            var cut = Regex.Split(s, @"\s+-\s+|\(|/")[0];
            var key = Normalize(cut);
            if (key.Length > 10)
            {
                // "CY46YGZN 4TON": the first word on its own looks like a plate.
                var first = Normalize(cut.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault());
                if (first.Length is >= 5 and <= 10) key = first;
            }
            return key;
        }

        public static bool IsPlaceholder(string? reg)
        {
            var t = (reg ?? string.Empty).Trim();
            return t.Length == 0 || Placeholders.Contains(t) || Placeholders.Contains(Normalize(t));
        }

        /// <summary>Trailer types carry no fuel tank, so fuel booked to one is a linking error.</summary>
        public static bool IsTrailerType(string? typeName)
        {
            var n = (typeName ?? string.Empty).ToUpperInvariant();
            return n.Contains("TRAILER");
        }

        /// <summary>
        /// Plate key → vehicle id. Keys come from the registration, the TFN registration and the CarTrack
        /// name. Where two fleet records share a plate the lowest id wins (same rule as before).
        /// </summary>
        public static async Task<Dictionary<string, int>> BuildIndexAsync(ApplicationDbContext db, CancellationToken ct = default)
        {
            var rows = await db.Vehicles.AsNoTracking()
                .OrderBy(v => v.Id)
                .Select(v => new { v.Id, v.RegistrationNumber, v.TfnVehicleId, v.CarTrackName })
                .ToListAsync(ct);

            var index = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            // Registration first so it beats a CarTrack name that happens to collide.
            foreach (var r in rows)
            {
                if (IsPlaceholder(r.RegistrationNumber)) continue;
                var k = PlateKey(r.RegistrationNumber);
                if (k.Length >= 4) index.TryAdd(k, r.Id);
            }
            foreach (var r in rows)
            {
                if (IsPlaceholder(r.RegistrationNumber)) continue;
                foreach (var alt in new[] { r.TfnVehicleId, r.CarTrackName })
                {
                    var k = PlateKey(alt);
                    if (k.Length >= 4 && !k.StartsWith("TEMP")) index.TryAdd(k, r.Id);
                }
            }
            return index;
        }

        public static int? Resolve(Dictionary<string, int> index, string? reg)
        {
            var k = PlateKey(reg);
            return k.Length >= 4 && index.TryGetValue(k, out var id) ? id : null;
        }
    }
}
