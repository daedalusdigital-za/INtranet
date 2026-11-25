using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Authorization
{
    /// <summary>
    /// Effective finance permissions = what is ticked on the user ∪ what their job role implies.
    /// Keeps the payment workflow honest even when a tick was forgotten:
    ///   Director        → cred.director (sign & release packs), exec.dashboard, cred.readonly
    ///   Treasurer       → cred.bank (bank loading, mark paid, cashflow), exec.dashboard, cred.readonly
    ///   Accountant      → cred.accountant (approve packs), cred.readonly
    ///   Manager (Finance dept) → cred.readonly only (approving needs the Accountant role or an explicit cred.accountant tick)
    ///   Creditor Clerk  → cred.clerk (prepare & submit packs), cred.readonly
    ///   Debtor Clerk    → debt.clerk (debtors aging uploads, credit notes, collections)
    /// Admin / Super Admin get everything.
    /// </summary>
    public static class FinanceAuthority
    {
        public const string DebtorClerk = "debt.clerk";
        public const string ExecDashboard = "exec.dashboard";

        public const string RoleCreditorClerk = "Creditor Clerk";
        public const string RoleDebtorClerk = "Debtor Clerk";

        public static HashSet<string> Parse(string? raw)
        {
            var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            raw ??= "";
            if (raw.TrimStart().StartsWith("["))
            {
                try { foreach (var s in JsonSerializer.Deserialize<string[]>(raw) ?? Array.Empty<string>()) set.Add(s); } catch { }
            }
            else foreach (var s in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)) set.Add(s);
            return set;
        }

        /// <summary>Permissions implied by role (+ department for managers).</summary>
        public static IEnumerable<string> ImpliedBy(string? role, string? departmentName)
        {
            var r = (role ?? "").Trim();
            var finance = (departmentName ?? "").Contains("finance", StringComparison.OrdinalIgnoreCase)
                       || (departmentName ?? "").Contains("account", StringComparison.OrdinalIgnoreCase);
            switch (r.ToLowerInvariant())
            {
                case "admin":
                case "super admin":
                    yield return "*"; break;
                case "director":
                    yield return "cred.director"; yield return "cred.readonly"; yield return ExecDashboard; break;
                case "treasurer":
                    yield return "cred.bank"; yield return "cred.readonly"; yield return ExecDashboard; break;
                case "accountant":
                    yield return "cred.accountant"; yield return "cred.readonly"; break;
                case "manager":
                    // View only. Approving packs is for accountants: a Finance manager (e.g. the Debtors manager)
                    // only approves if "cred.accountant" is ticked on them under Admin › Users.
                    if (finance) yield return "cred.readonly";
                    break;
                case "creditor clerk":
                    yield return "cred.clerk"; yield return "cred.readonly"; break;
                case "debtor clerk":
                    yield return DebtorClerk; break;
                case "clerk":
                    // legacy generic clerk: only creditors authority when sitting in Finance
                    if (finance) { yield return "cred.clerk"; yield return "cred.readonly"; }
                    break;
            }
        }

        /// <summary>Explicit ∪ implied permissions for the signed-in user.</summary>
        public static async Task<HashSet<string>> EffectiveAsync(ApplicationDbContext db, ClaimsPrincipal user)
        {
            var id = user.GetUserId();
            if (id == null) return new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var row = await db.Users.AsNoTracking().Where(u => u.UserId == id.Value)
                .Select(u => new { u.Permissions, u.Role, Dept = u.Department != null ? u.Department.Name : null })
                .FirstOrDefaultAsync();
            var set = Parse(row?.Permissions);
            foreach (var p in ImpliedBy(row?.Role, row?.Dept)) set.Add(p);
            return set;
        }

        public static async Task<bool> HasAsync(ApplicationDbContext db, ClaimsPrincipal user, params string[] anyOf)
        {
            if (user.IsAdmin()) return true;
            var set = await EffectiveAsync(db, user);
            if (set.Contains("*")) return true;
            return anyOf.Any(set.Contains);
        }
    }
}
