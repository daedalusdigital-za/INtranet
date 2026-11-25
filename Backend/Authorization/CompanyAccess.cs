using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Authorization
{
    /// <summary>
    /// Which companies a signed-in person may see in Finance.
    /// Admin / Super Admin see everything; everyone else only the operating companies they are
    /// assigned to under Admin › Users › Companies (StaffOperatingCompanies). Paying companies
    /// (CreditorCompanies: PMT, ACM, …) are linked to operating companies through
    /// CreditorCompanies.OperatingCompanyId, and the many spellings used in imported data
    /// (PROMED / Promed Technologies / PMT …) are all recognised through <see cref="Allows"/>.
    /// </summary>
    public sealed class CompanyScope
    {
        public bool All { get; init; }
        public HashSet<int> OperatingCompanyIds { get; init; } = new();
        /// <summary>Every token (code, alias, name) that identifies an allowed company, normalised.</summary>
        public HashSet<string> Tokens { get; init; } = new(StringComparer.OrdinalIgnoreCase);
        /// <summary>Allowed paying-company codes (PMT, ACM, …).</summary>
        public HashSet<string> CreditorCodes { get; init; } = new(StringComparer.OrdinalIgnoreCase);

        public static readonly CompanyScope Everything = new() { All = true };

        /// <summary>True when the company (code, Sage code, name or Category label) is in scope. Blank is in scope.</summary>
        public bool Allows(string? company)
        {
            if (All) return true;
            if (string.IsNullOrWhiteSpace(company)) return true;
            var n = CompanyAccess.Normalize(company);
            if (Tokens.Contains(n)) return true;
            // "Promed Technologies (Pty) Ltd" → contains an allowed token
            foreach (var t in Tokens)
                if (t.Length >= 3 && n.Contains(t)) return true;
            return false;
        }

        public IEnumerable<T> Filter<T>(IEnumerable<T> items, Func<T, string?> company) => All ? items : items.Where(i => Allows(company(i)));
    }

    public static class CompanyAccess
    {
        private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(60);

        /// <summary>Aliases for the same company across Sage, the creditors module and imported data.</summary>
        private static readonly string[][] Aliases =
        {
            new[] { "PMT", "PROMED", "PROMEDTECHNOLOGIES", "PROMEDTECH" },
            new[] { "ACM", "ACCESS", "ACCMED", "ACCESSMEDICAL" },
            new[] { "PHC", "PHT", "PHARMA", "PHARMACARE", "PHARMATECH", "PROMEDPHARMACARE" },
            new[] { "SBT", "SEBENZ", "SEBENZANI", "SEBENZANITRADING" },
            new[] { "KOG", "KOGTRADING", "KOGTRADINGENTERPRISE" },
            new[] { "SAW", "SAWELLNESS" },
            new[] { "RFT", "ROCKETFREIGHT", "ROCKET" },
            new[] { "SEY", "SHARPEYE", "SHARPEYESECURITY" },
            new[] { "SHK", "SHAKAHOLDINGS", "SHAKA" },
            new[] { "NAT", "NEWAGETECHNOLOGIES", "NEWAGE" },
            new[] { "PUM", "PUMA" },
            new[] { "OKM", "OKMINIMART", "OKMINI" },
            new[] { "LIA", "LIAMED" },
        };

        public static string Normalize(string? s) => new string((s ?? "").Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();

        private static IEnumerable<string> ExpandAliases(string token)
        {
            yield return token;
            foreach (var group in Aliases)
                if (group.Contains(token, StringComparer.OrdinalIgnoreCase))
                    foreach (var a in group) yield return a;
        }

        /// <summary>Resolve the caller's company scope (cached for a minute per user).</summary>
        public static async Task<CompanyScope> ForUserAsync(ApplicationDbContext db, ClaimsPrincipal user, IMemoryCache? cache = null)
        {
            var role = user.FindFirstValue(ClaimTypes.Role) ?? "";
            if (role.Equals(AppRoles.Admin, StringComparison.OrdinalIgnoreCase) || role.Equals(AppRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase))
                return CompanyScope.Everything;

            var userId = user.GetUserId();
            if (userId == null) return new CompanyScope();

            if (cache != null && cache.TryGetValue<CompanyScope>(CacheKey(userId.Value), out var cached) && cached != null)
                return cached;

            var scope = await BuildAsync(db, userId.Value);
            cache?.Set(CacheKey(userId.Value), scope, CacheFor);
            return scope;
        }

        public static void Invalidate(IMemoryCache cache, int userId) => cache.Remove(CacheKey(userId));
        private static string CacheKey(int userId) => $"company-scope:{userId}";

        private static async Task<CompanyScope> BuildAsync(ApplicationDbContext db, int userId)
        {
            // Role stored on the user row wins over a stale JWT
            var dbRole = await db.Users.AsNoTracking().Where(u => u.UserId == userId).Select(u => u.Role).FirstOrDefaultAsync() ?? "";
            if (dbRole.Equals(AppRoles.Admin, StringComparison.OrdinalIgnoreCase) || dbRole.Equals(AppRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase))
                return CompanyScope.Everything;

            var ids = await db.StaffOperatingCompanies.AsNoTracking()
                .Where(s => s.StaffMemberId == userId && s.IsActive)
                .Select(s => s.OperatingCompanyId).Distinct().ToListAsync();
            var scope = new CompanyScope { OperatingCompanyIds = ids.ToHashSet() };
            if (ids.Count == 0) return scope;

            var ops = await db.OperatingCompanies.AsNoTracking().Where(o => ids.Contains(o.OperatingCompanyId)).Select(o => new { o.Code, o.Name }).ToListAsync();
            var creditors = await db.CreditorCompanies.AsNoTracking()
                .Where(c => c.OperatingCompanyId != null && ids.Contains(c.OperatingCompanyId.Value))
                .Select(c => new { c.Code, c.Name }).ToListAsync();

            foreach (var o in ops)
            {
                foreach (var t in ExpandAliases(Normalize(o.Code))) scope.Tokens.Add(t);
                scope.Tokens.Add(Normalize(o.Name));
            }
            foreach (var c in creditors)
            {
                scope.CreditorCodes.Add(c.Code);
                foreach (var t in ExpandAliases(Normalize(c.Code))) scope.Tokens.Add(t);
                scope.Tokens.Add(Normalize(c.Name));
            }
            // Codes reachable through aliases also count as allowed creditor codes (e.g. operating PROMED → PMT)
            foreach (var group in Aliases)
                if (group.Any(g => scope.Tokens.Contains(g))) scope.CreditorCodes.Add(group[0]);
            return scope;
        }
    }
}
