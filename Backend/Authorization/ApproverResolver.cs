using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance.Creditors;

namespace ProjectTracker.API.Authorization
{
    /// <summary>
    /// Who approves / signs a paying company's payment packs. Derived from what is already kept under
    /// Admin › Users: the person's job role (Accountant, Director, Treasurer — or the matching permission ticked on the person) and the
    /// companies they are assigned to (StaffOperatingCompanies → CreditorCompanies.OperatingCompanyId).
    /// The explicit pins on CreditorCompanies (AccountantUserId …) are an optional override: when set,
    /// only those people count for that step.
    /// </summary>
    public sealed class CompanyApprovers
    {
        public string CompanyCode { get; init; } = "";
        public List<Approver> Accountants { get; init; } = new();
        public List<Approver> Directors { get; init; } = new();
        public List<Approver> Treasurers { get; init; } = new();
        public List<Approver> Clerks { get; init; } = new();
        /// <summary>True when the accountant step is pinned to specific people on the company row.</summary>
        public bool AccountantsPinned { get; init; }
        public bool DirectorsPinned { get; init; }

        public bool IsAccountant(int userId) => Accountants.Any(a => a.UserId == userId);
        public bool IsDirector(int userId) => Directors.Any(a => a.UserId == userId);
    }

    public sealed record Approver(int UserId, string Name, string Role, string? Email, bool Pinned);

    public static class ApproverResolver
    {
        private sealed record Row(int UserId, string Name, string? Email, string Role, string? Dept, string? Permissions, List<int> OperatingCompanyIds);

        private static async Task<List<Row>> PeopleAsync(ApplicationDbContext db)
        {
            var users = await db.Users.AsNoTracking().Where(u => u.IsActive)
                .Select(u => new { u.UserId, Name = (u.Name + " " + u.Surname).Trim(), u.Email, u.Role, Dept = u.Department != null ? u.Department.Name : null, u.Permissions })
                .ToListAsync();
            var assign = await db.StaffOperatingCompanies.AsNoTracking().Where(s => s.IsActive)
                .GroupBy(s => s.StaffMemberId).Select(g => new { UserId = g.Key, Ids = g.Select(x => x.OperatingCompanyId).Distinct().ToList() })
                .ToDictionaryAsync(x => x.UserId, x => x.Ids);
            return users.Select(u => new Row(u.UserId, u.Name, u.Email, u.Role ?? "", u.Dept, u.Permissions, assign.TryGetValue(u.UserId, out var ids) ? ids : new List<int>())).ToList();
        }

        /// <summary>Approvers for every active paying company in one go.</summary>
        public static async Task<Dictionary<string, CompanyApprovers>> AllAsync(ApplicationDbContext db)
        {
            var companies = await db.CreditorCompanies.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ToListAsync();
            var people = await PeopleAsync(db);
            return companies.ToDictionary(c => c.Code, c => Build(c, people), StringComparer.OrdinalIgnoreCase);
        }

        public static async Task<CompanyApprovers> ForAsync(ApplicationDbContext db, string companyCode)
        {
            var c = await db.CreditorCompanies.AsNoTracking().FirstOrDefaultAsync(x => x.Code == companyCode);
            var people = await PeopleAsync(db);
            return c == null ? new CompanyApprovers { CompanyCode = companyCode } : Build(c, people);
        }

        private static CompanyApprovers Build(CreditorCompany c, List<Row> people)
        {
            static bool Has(Row r, string perm)
            {
                var set = FinanceAuthority.Parse(r.Permissions);
                foreach (var p in FinanceAuthority.ImpliedBy(r.Role, r.Dept)) set.Add(p);
                return set.Contains(perm);
            }
            bool Assigned(Row r) => c.OperatingCompanyId != null && r.OperatingCompanyIds.Contains(c.OperatingCompanyId.Value);
            bool SysAdmin(Row r) => r.Role is "Admin" or "Super Admin";

            // By role + company assignment (system admins are excluded — they can do everything anyway and shouldn't appear as "the accountant")
            List<Approver> ByRole(string perm) => people
                .Where(r => !SysAdmin(r) && Has(r, perm) && Assigned(r))
                .OrderBy(r => r.Name)
                .Select(r => new Approver(r.UserId, r.Name, r.Role, r.Email, false)).ToList();

            List<Approver> Pinned(params int?[] ids) => ids.Where(i => i != null).Select(i => people.FirstOrDefault(p => p.UserId == i!.Value))
                .Where(p => p != null).Select(p => new Approver(p!.UserId, p.Name, p.Role, p.Email, true)).ToList();

            var pinnedAcc = Pinned(c.AccountantUserId, c.BackupApproverUserId);
            var pinnedDir = Pinned(c.DirectorUserId, c.DelegateDirectorUserId);

            return new CompanyApprovers
            {
                CompanyCode = c.Code,
                Accountants = pinnedAcc.Count > 0 ? pinnedAcc : ByRole("cred.accountant"),
                Directors = pinnedDir.Count > 0 ? pinnedDir : ByRole("cred.director"),
                Treasurers = ByRole("cred.bank"),
                Clerks = ByRole("cred.clerk"),
                AccountantsPinned = pinnedAcc.Count > 0,
                DirectorsPinned = pinnedDir.Count > 0,
            };
        }
    }
}
