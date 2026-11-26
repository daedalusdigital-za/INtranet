using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Services.Welly
{
    // ─────────────────────────────────────────────────────────────────────────────
    // The action layer: every intranet action Welly may take is a named skill with a
    // module permission and a kind. A skill always runs as a real person (its runner)
    // and can never do more than that person could do on the screen.
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>What a skill does to the world. Send / Delete / Pay / Approve always need a person to click Approve.</summary>
    public enum WellySkillKind { Read, Prepare, Write, Send, Delete, Pay, Approve }

    public record WellySkillInput(string Key, string Label, bool Required = true);

    public class WellyEvidence
    {
        public string Label { get; set; } = string.Empty;
        public string? Value { get; set; }
        /// <summary>In-app link to look at the source (optional).</summary>
        public string? Url { get; set; }
    }

    public class WellySkillResult
    {
        public bool Ok { get; set; }
        /// <summary>One sentence a person reads: what Welly found or prepared.</summary>
        public string Summary { get; set; } = string.Empty;
        public List<WellyEvidence> Evidence { get; set; } = new();
        /// <summary>Values for the step's form fields (keys must match the task form).</summary>
        public JsonObject Prefill { get; set; } = new();
        /// <summary>0..1. Below 0.5 the UI says "not sure" and the person should check.</summary>
        public double Confidence { get; set; } = 1;
        /// <summary>Extra machine-readable output.</summary>
        public JsonObject Output { get; set; } = new();

        public static WellySkillResult Fail(string why) => new() { Ok = false, Summary = why, Confidence = 0 };
    }

    public class WellySkillContext
    {
        public int RunnerUserId { get; init; }
        public string RunnerName { get; init; } = string.Empty;
        public JsonObject Inputs { get; init; } = new();
        public CancellationToken Ct { get; init; }

        public string? Input(string key)
        {
            var n = Inputs[key];
            if (n == null) return null;
            var s = n is JsonValue v && v.TryGetValue<string>(out var str) ? str : n.ToJsonString();
            return string.IsNullOrWhiteSpace(s) ? null : s.Trim();
        }
    }

    public interface IWellySkill
    {
        string Key { get; }
        string Title { get; }
        string Description { get; }
        /// <summary>Module permission key the runner needs (same keys as the sidebar / RequireModule).</summary>
        string Module { get; }
        WellySkillKind Kind { get; }
        IReadOnlyList<WellySkillInput> Inputs { get; }
        /// <summary>Form field keys this skill fills in, so a designer can match the step's form.</summary>
        IReadOnlyList<string> PrefillKeys { get; }
        Task<WellySkillResult> RunAsync(WellySkillContext ctx);
    }

    public class WellySkillRun
    {
        public bool Ran { get; set; }
        public string? Refused { get; set; }
        public WellySkillResult? Result { get; set; }
        public IWellySkill? Skill { get; set; }
    }

    public interface IWellySkillRegistry
    {
        IReadOnlyList<IWellySkill> All { get; }
        IWellySkill? Find(string? key);
        /// <summary>
        /// Run a skill as <paramref name="runnerUserId"/>. Refuses when the skill is unknown, the runner lacks the module,
        /// or the skill's kind is not allowed here (this slice only runs Read and Prepare skills: nothing that changes data).
        /// </summary>
        Task<WellySkillRun> RunAsync(string key, int runnerUserId, JsonObject inputs, CancellationToken ct);
    }

    public class WellySkillRegistry : IWellySkillRegistry
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<WellySkillRegistry> _log;
        public IReadOnlyList<IWellySkill> All { get; }

        public WellySkillRegistry(IEnumerable<IWellySkill> skills, ApplicationDbContext db, ILogger<WellySkillRegistry> log)
        {
            All = skills.OrderBy(s => s.Key).ToList();
            _db = db; _log = log;
        }

        public IWellySkill? Find(string? key) => string.IsNullOrWhiteSpace(key) ? null : All.FirstOrDefault(s => s.Key.Equals(key.Trim(), StringComparison.OrdinalIgnoreCase));

        /// <summary>Skill kinds that may run without a person approving first. Everything else waits for Approve (not built yet).</summary>
        public static bool RunsWithoutApproval(WellySkillKind k) => k is WellySkillKind.Read or WellySkillKind.Prepare;

        public async Task<WellySkillRun> RunAsync(string key, int runnerUserId, JsonObject inputs, CancellationToken ct)
        {
            var skill = Find(key);
            if (skill == null) return new WellySkillRun { Refused = $"Welly has no skill called '{key}'." };
            if (!RunsWithoutApproval(skill.Kind))
                return new WellySkillRun { Skill = skill, Refused = $"{skill.Title} needs a person to approve it, which isn't built yet." };

            var user = await _db.Users.AsNoTracking().Where(u => u.UserId == runnerUserId && u.IsActive)
                .Select(u => new { u.UserId, u.Name, u.Surname, u.Role, u.Permissions }).FirstOrDefaultAsync(ct);
            if (user == null) return new WellySkillRun { Skill = skill, Refused = "No active person to run this as." };
            if (!ModuleAccess.Has(user.Role, user.Permissions, skill.Module))
                return new WellySkillRun { Skill = skill, Refused = $"{user.Name} {user.Surname} doesn't have {skill.Module} access, so Welly can't do this for them." };

            foreach (var i in skill.Inputs.Where(i => i.Required))
                if (inputs[i.Key] == null || string.IsNullOrWhiteSpace(inputs[i.Key]!.ToString()))
                    return new WellySkillRun { Skill = skill, Refused = $"Missing input: {i.Label}." };

            try
            {
                var result = await skill.RunAsync(new WellySkillContext { RunnerUserId = user.UserId, RunnerName = $"{user.Name} {user.Surname}".Trim(), Inputs = inputs, Ct = ct });
                return new WellySkillRun { Ran = true, Skill = skill, Result = result };
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Welly skill {Skill} failed", skill.Key);
                return new WellySkillRun { Skill = skill, Ran = true, Result = WellySkillResult.Fail($"{skill.Title} failed: {ex.Message}") };
            }
        }
    }

    /// <summary>The same module check the screens use (<see cref="RequireModuleAttribute"/>): admins pass, else the module key or "all".</summary>
    public static class ModuleAccess
    {
        public static bool Has(string? role, string? permissions, string module)
        {
            var r = role?.Trim() ?? "";
            if (r.Equals(AppRoles.Admin, StringComparison.OrdinalIgnoreCase) || r.Equals(AppRoles.SuperAdmin, StringComparison.OrdinalIgnoreCase)) return true;
            if (string.IsNullOrWhiteSpace(permissions)) return false;
            IEnumerable<string> items;
            try { items = permissions.TrimStart().StartsWith('[') ? JsonSerializer.Deserialize<string[]>(permissions) ?? Array.Empty<string>() : permissions.Split(','); }
            catch (JsonException) { items = permissions.Split(','); }
            var set = new HashSet<string>(items.Select(i => i.Trim()), StringComparer.OrdinalIgnoreCase);
            return set.Contains("all") || set.Contains(module);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Skills for "Accounts · Invoice to payment"
    // ─────────────────────────────────────────────────────────────────────────────

    /// <summary>Is a signed POD attached to this invoice? Looks at scanned POD documents linked to the invoice and at the load it went out on.</summary>
    public class CheckPodSkill : IWellySkill
    {
        private readonly ApplicationDbContext _db;
        public CheckPodSkill(ApplicationDbContext db) { _db = db; }

        public string Key => "invoice.check_pod";
        public string Title => "Check POD attached";
        public string Description => "Looks for a signed POD linked to the invoice (scanned POD documents, or a POD captured on the load it went out on).";
        public string Module => "logistics";
        public WellySkillKind Kind => WellySkillKind.Read;
        public IReadOnlyList<WellySkillInput> Inputs { get; } = new[] { new WellySkillInput("invoiceNo", "Invoice number") };
        public IReadOnlyList<string> PrefillKeys { get; } = new[] { "podAttached", "podReference" };

        public async Task<WellySkillResult> RunAsync(WellySkillContext ctx)
        {
            var no = ctx.Input("invoiceNo")!;
            var ct = ctx.Ct;

            var invoiceRows = await _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionNumber == no)
                .Select(i => new { i.Id, i.CustomerName, i.LoadId, i.Status }).ToListAsync(ct);
            var invoiceIds = invoiceRows.Select(i => i.Id).ToList();

            var links = await _db.PodDocumentInvoiceLinks.AsNoTracking()
                .Where(l => l.InvoiceNumber == no || (l.InvoiceId != null && invoiceIds.Contains(l.InvoiceId.Value)))
                .Select(l => new { l.PodDocumentId, l.LinkedAt, pod = l.PodDocument })
                .ToListAsync(ct);
            var directPods = await _db.PodDocuments.AsNoTracking().Where(p => p.InvoiceId != null && invoiceIds.Contains(p.InvoiceId.Value)).ToListAsync(ct);

            var pods = links.Where(l => l.pod != null).Select(l => l.pod!).Concat(directPods)
                .GroupBy(p => p.Id).Select(g => g.First()).OrderByDescending(p => p.UploadedAt).ToList();

            var loadIds = invoiceRows.Where(i => i.LoadId != null).Select(i => i.LoadId!.Value).Distinct().ToList();
            var loads = await _db.Loads.AsNoTracking().Where(l => loadIds.Contains(l.Id)).Select(l => new { l.Id, l.LoadNumber, l.Status }).ToListAsync(ct);
            var loadPods = await _db.ProofOfDeliveries.AsNoTracking().Where(p => loadIds.Contains(p.LoadId))
                .Select(p => new { p.LoadId, p.RecipientName, p.DeliveredAt }).ToListAsync(ct);
            var loadPodDocs = await _db.PodDocuments.AsNoTracking().Where(p => p.LoadId != null && loadIds.Contains(p.LoadId.Value)).ToListAsync(ct);

            var res = new WellySkillResult { Ok = true };
            if (invoiceRows.Count == 0)
                res.Evidence.Add(new WellyEvidence { Label = "Invoice", Value = $"{no} is not in the imported invoices" });
            else
                res.Evidence.Add(new WellyEvidence { Label = "Invoice", Value = $"{no} · {invoiceRows[0].CustomerName} · {invoiceRows[0].Status}" });
            foreach (var l in loads) res.Evidence.Add(new WellyEvidence { Label = "Load", Value = $"{l.LoadNumber} · {l.Status}" });

            if (pods.Count > 0)
            {
                var p = pods[0];
                var label = string.IsNullOrWhiteSpace(p.PodNumber) ? (p.OriginalFileName ?? p.FileName) : p.PodNumber!;
                res.Summary = $"POD is attached: {label}, delivered {p.DeliveryDate:dd MMM yyyy}{(string.IsNullOrWhiteSpace(p.DriverName) ? "" : $" by {p.DriverName}")}.";
                foreach (var d in pods.Take(3))
                    res.Evidence.Add(new WellyEvidence { Label = "Scanned POD", Value = $"{(string.IsNullOrWhiteSpace(d.PodNumber) ? d.OriginalFileName ?? d.FileName : d.PodNumber)} · uploaded {d.UploadedAt:dd MMM yyyy}", Url = $"/api/poddocuments/{d.Id}/view" });
                res.Prefill["podAttached"] = "Yes";
                res.Prefill["podReference"] = label;
                res.Confidence = 0.95;
            }
            else if (loadPodDocs.Count > 0 || loadPods.Count > 0)
            {
                // A POD exists for the load but isn't linked to this invoice specifically: likely fine, but a person should look.
                var lp = loadPodDocs.OrderByDescending(p => p.UploadedAt).FirstOrDefault();
                var loadNo = loads.FirstOrDefault()?.LoadNumber ?? "the load";
                res.Summary = $"There's a POD on {loadNo}, but it isn't linked to {no} itself. Check it covers this invoice.";
                if (lp != null) res.Evidence.Add(new WellyEvidence { Label = "POD on load", Value = $"{lp.PodNumber ?? lp.OriginalFileName ?? lp.FileName} · uploaded {lp.UploadedAt:dd MMM yyyy}", Url = $"/api/poddocuments/{lp.Id}/view" });
                foreach (var d in loadPods.Take(2)) res.Evidence.Add(new WellyEvidence { Label = "Delivery captured", Value = $"signed by {d.RecipientName ?? "unknown"} · {d.DeliveredAt:dd MMM yyyy}" });
                res.Prefill["podAttached"] = "Yes";
                res.Prefill["podReference"] = lp?.PodNumber ?? loadNo;
                res.Confidence = 0.6;
            }
            else
            {
                res.Summary = invoiceRows.Count == 0
                    ? $"I can't find invoice {no}, so I can't see a POD. Check the number."
                    : $"No POD found for {no}{(loads.Count > 0 ? $" or its load {loads[0].LoadNumber}" : "")}. Logistics will need to supply it.";
                res.Prefill["podAttached"] = "No";
                res.Confidence = invoiceRows.Count == 0 ? 0.3 : 0.85;
            }
            var customers = invoiceRows.Select(i => i.CustomerName).Where(n => !string.IsNullOrWhiteSpace(n)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (customers.Count > 1)
            {
                res.Evidence.Add(new WellyEvidence { Label = "Careful", Value = $"{no} exists for {customers.Count} customers ({string.Join(", ", customers.Take(3))}); check it's the right one" });
                res.Confidence = Math.Min(res.Confidence, 0.4);
            }
            res.Output["podCount"] = pods.Count;
            return res;
        }
    }

    /// <summary>Has the invoice been paid? Reads the latest customer ageing (Sage) per company: an invoice still on it is open.</summary>
    public class CheckPaymentSkill : IWellySkill
    {
        private readonly ApplicationDbContext _db;
        public CheckPaymentSkill(ApplicationDbContext db) { _db = db; }

        public string Key => "invoice.check_payment";
        public string Title => "Check payment";
        public string Description => "Looks the invoice up on the latest customer ageing report. Still on it means unpaid (shows the balance); gone means it was settled.";
        public string Module => "finance";
        public WellySkillKind Kind => WellySkillKind.Read;
        public IReadOnlyList<WellySkillInput> Inputs { get; } = new[] { new WellySkillInput("invoiceNo", "Invoice number") };
        public IReadOnlyList<string> PrefillKeys { get; } = new[] { "paid" };
        private const int StaleAfterDays = 7;

        public async Task<WellySkillResult> RunAsync(WellySkillContext ctx)
        {
            var no = ctx.Input("invoiceNo")!;
            var ct = ctx.Ct;
            var za = CultureInfo.GetCultureInfo("en-ZA");

            // Latest snapshot per company
            var snaps = await _db.ArAgingSnapshots.AsNoTracking().ToListAsync(ct);
            var latest = snaps.GroupBy(s => s.Company).Select(g => g.OrderByDescending(s => s.AsOfDate).ThenByDescending(s => s.UploadedAt).First()).ToList();
            if (latest.Count == 0) return WellySkillResult.Fail("There is no customer ageing uploaded yet, so I can't check payment.");
            var latestIds = latest.Select(s => s.Id).ToList();
            var asOf = latest.Max(s => s.AsOfDate);
            var ageDays = (DateTime.UtcNow.Date - asOf.Date).Days;
            var stale = ageDays > StaleAfterDays;

            var items = await _db.ArAgingItems.AsNoTracking().Where(i => latestIds.Contains(i.SnapshotId) && i.DocumentNumber == no).ToListAsync(ct);
            var everSeen = items.Count > 0 || await _db.ArAgingItems.AsNoTracking().AnyAsync(i => i.DocumentNumber == no, ct);
            var invDate = await _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionNumber == no).Select(i => (DateTime?)i.TransactionDate).MinAsync(ct);

            var res = new WellySkillResult { Ok = true };
            res.Evidence.Add(new WellyEvidence { Label = "Ageing used", Value = $"as at {asOf:dd MMM yyyy} ({ageDays} days old){(stale ? " · out of date" : "")}" });
            if (invDate != null) res.Evidence.Add(new WellyEvidence { Label = "Invoice date", Value = invDate.Value.ToString("dd MMM yyyy") });

            if (items.Count > 0)
            {
                var bal = items.Sum(i => i.Balance);
                var it = items[0];
                res.Evidence.Add(new WellyEvidence { Label = "On ageing", Value = $"{it.CustomerName} · balance {bal.ToString("C", za)} of {items.Sum(i => i.Amount).ToString("C", za)}{(it.DaysOver is > 0 ? $" · {it.DaysOver} days over" : "")}" });
                if (bal <= 0.005m)
                {
                    res.Summary = $"{no} shows a zero balance on the {asOf:dd MMM} ageing: paid.";
                    res.Prefill["paid"] = "Yes";
                }
                else
                {
                    res.Summary = $"{no} is still open on the {asOf:dd MMM} ageing with {bal.ToString("C", za)} outstanding.";
                    res.Prefill["paid"] = "No";
                }
                res.Output["balance"] = bal;
                res.Confidence = stale ? 0.45 : 0.9;
                var companies = items.Select(i => latest.First(l => l.Id == i.SnapshotId).Company).Distinct().ToList();
                if (companies.Count > 1)
                {
                    res.Evidence.Add(new WellyEvidence { Label = "Careful", Value = $"{no} is on the ageing of {string.Join(" and ", companies)}; the balance above adds them up" });
                    res.Confidence = Math.Min(res.Confidence, 0.4);
                }
            }
            else if (invDate != null && invDate.Value.Date <= asOf.Date)
            {
                res.Summary = everSeen
                    ? $"{no} was on an earlier ageing but isn't on the {asOf:dd MMM} one, so it looks paid."
                    : $"{no} isn't on the {asOf:dd MMM} ageing, so it looks paid (or was never on the debtors' book).";
                res.Prefill["paid"] = "Yes";
                res.Confidence = stale ? 0.4 : (everSeen ? 0.8 : 0.6);
            }
            else
            {
                res.Summary = $"{no} is newer than the last ageing ({asOf:dd MMM}), so I can't tell yet. Upload a fresh ageing or check the bank.";
                res.Confidence = 0.2;
            }
            res.Output["asOf"] = asOf.ToString("yyyy-MM-dd");
            res.Output["stale"] = stale;
            return res;
        }
    }

    /// <summary>Drafts the invoice email (to, subject, body). Prepares only: nothing is sent.</summary>
    public class DraftInvoiceEmailSkill : IWellySkill
    {
        private readonly ApplicationDbContext _db;
        public DraftInvoiceEmailSkill(ApplicationDbContext db) { _db = db; }

        public string Key => "invoice.draft_send";
        public string Title => "Draft invoice email";
        public string Description => "Prepares the email that sends the invoice (and POD) to the customer. Welly drafts it; a person sends it.";
        public string Module => "finance";
        public WellySkillKind Kind => WellySkillKind.Prepare;
        public IReadOnlyList<WellySkillInput> Inputs { get; } = new[]
        {
            new WellySkillInput("invoiceNo", "Invoice number"),
            new WellySkillInput("customer", "Customer", false),
            new WellySkillInput("amount", "Amount", false),
            new WellySkillInput("customerEmail", "Customer email", false),
            new WellySkillInput("podReference", "POD reference", false),
        };
        public IReadOnlyList<string> PrefillKeys { get; } = new[] { "emailTo", "emailSubject", "emailBody" };

        public async Task<WellySkillResult> RunAsync(WellySkillContext ctx)
        {
            var no = ctx.Input("invoiceNo")!;
            var ct = ctx.Ct;
            var za = CultureInfo.GetCultureInfo("en-ZA");

            var inv = await _db.ImportedInvoices.AsNoTracking().Where(i => i.TransactionNumber == no)
                .Select(i => new { i.CustomerName, i.CustomerNumber, i.CustomerId, i.TransactionDate, i.SalesAmount, i.SalesReturns }).ToListAsync(ct);
            var customer = ctx.Input("customer") ?? inv.FirstOrDefault()?.CustomerName ?? "Customer";

            string? email = ctx.Input("customerEmail");
            var emailSource = "from the flow";
            if (email == null && inv.FirstOrDefault()?.CustomerId is int cid)
            {
                var c = await _db.LogisticsCustomers.AsNoTracking().Where(x => x.Id == cid).Select(x => new { x.Email, x.ContactEmail }).FirstOrDefaultAsync(ct);
                email = string.IsNullOrWhiteSpace(c?.ContactEmail) ? c?.Email : c!.ContactEmail;
                emailSource = "from the customer record";
            }

            decimal? amount = decimal.TryParse(ctx.Input("amount"), NumberStyles.Any, CultureInfo.InvariantCulture, out var a) ? a : null;
            if (amount == null && inv.Count > 0) amount = inv.Sum(i => i.SalesAmount - i.SalesReturns);
            var amountText = amount?.ToString("C", za) ?? "the attached amount";
            var pod = ctx.Input("podReference");

            var res = new WellySkillResult { Ok = true, Confidence = email == null ? 0.5 : 0.85 };
            res.Prefill["emailTo"] = email ?? "";
            res.Prefill["emailSubject"] = $"Invoice {no}{(customer == "Customer" ? "" : $" · {customer}")}";
            res.Prefill["emailBody"] =
                $"Dear {customer},\n\nPlease find attached invoice {no} for {amountText}" +
                (pod != null ? $", together with the signed proof of delivery ({pod})" : "") +
                ".\n\nPayment is due within our agreed terms. Please let us know if anything on the invoice needs attention.\n\nKind regards,\n" + ctx.RunnerName;
            res.Summary = email == null
                ? $"Drafted the email for {no}, but I couldn't find the customer's email address. Add it before sending."
                : $"Drafted the email for {no} to {email}. Attach the invoice{(pod != null ? " and POD" : "")} and send it from your mailbox.";
            res.Evidence.Add(new WellyEvidence { Label = "To", Value = email == null ? "no email found" : $"{email} ({emailSource})" });
            res.Evidence.Add(new WellyEvidence { Label = "Amount", Value = amountText });
            if (inv.Count == 0) res.Evidence.Add(new WellyEvidence { Label = "Invoice", Value = $"{no} is not in the imported invoices" });
            return res;
        }
    }
}
