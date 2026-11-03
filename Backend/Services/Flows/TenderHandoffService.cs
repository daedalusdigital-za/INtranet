using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Models.Flows;

namespace ProjectTracker.API.Services.Flows
{
    /// <summary>
    /// Tenders → Sales hand-off. When a tender is marked Awarded, the Sales "Enquiry to order" process
    /// is started for it, pre-filled from the tender (customer, contact, value, BOQ lines) and pinned to the tender,
    /// so Sales does not re-type what Tenders already captured. Idempotent: one run per tender.
    /// </summary>
    public interface ITenderHandoff
    {
        void Awarded(int tenderId, int? byUserId);
    }

    public class TenderHandoffService : ITenderHandoff
    {
        public const string SalesFlowKey = "Tenders.SalesFlowId";   // SystemSettings: which flow to start (default: name starts with "Sales")
        private readonly IServiceScopeFactory _scopes;
        private readonly ILogger<TenderHandoffService> _log;
        public TenderHandoffService(IServiceScopeFactory scopes, ILogger<TenderHandoffService> log) { _scopes = scopes; _log = log; }

        public void Awarded(int tenderId, int? byUserId)
        {
            _ = Task.Run(async () =>
            {
                try
                {
                    using var scope = _scopes.CreateScope();
                    var sp = scope.ServiceProvider;
                    var db = sp.GetRequiredService<ApplicationDbContext>();
                    var tender = await db.Tenders.AsNoTracking().Include(t => t.BOQItems).Include(t => t.TeamMembers).FirstOrDefaultAsync(t => t.Id == tenderId);
                    if (tender == null) return;

                    var def = await ResolveSalesFlowAsync(db);
                    if (def == null) { _log.LogWarning("Tender hand-off: no enabled Sales flow found (set SystemSettings {Key}); tender {No} not handed over", SalesFlowKey, tender.TenderNumber); return; }

                    // one run per tender
                    var existing = await db.FlowRuns.AsNoTracking().Where(r => r.EntityType == "tender" && r.EntityKey == tenderId.ToString() && r.FlowDefinitionId == def.Id && r.Status != FlowRunStatus.Cancelled).Select(r => new { r.Id, r.RunNumber }).FirstOrDefaultAsync();
                    if (existing != null) { _log.LogInformation("Tender hand-off: tender {No} already has run #{Run}", tender.TenderNumber, existing.RunNumber); return; }

                    var lines = tender.BOQItems.OrderBy(b => b.LineNumber).ToList();
                    var value = tender.AwardedValue ?? tender.EstimatedValue;
                    var enquiry = $"Awarded tender {tender.TenderNumber} · {tender.Title}\n" +
                                  $"Issued by {tender.IssuingDepartment}{(tender.Province != null ? " (" + tender.Province + ")" : "")}" +
                                  $"{(value != null ? $" · awarded value R{value:N0}" : "")}{(tender.AwardDate != null ? $" · awarded {tender.AwardDate:d MMM yyyy}" : "")}\n" +
                                  (lines.Count > 0 ? $"\nBOQ ({lines.Count} line{(lines.Count == 1 ? "" : "s")}):\n" + string.Join("\n", lines.Take(40).Select(l => $"  {l.LineNumber}. {(l.ItemCode != null ? l.ItemCode + " " : "")}{l.Description} × {l.Quantity:0.##}{(l.Unit != null ? " " + l.Unit : "")}{(l.UnitCost != null ? $" @ R{l.UnitCost:N2}" : "")}")) + (lines.Count > 40 ? $"\n  … and {lines.Count - 40} more" : "") : "") +
                                  (!string.IsNullOrWhiteSpace(tender.ResultNotes) ? "\n\nAward notes: " + tender.ResultNotes : "");

                    var ctx = new JsonObject
                    {
                        ["inputs"] = new JsonObject
                        {
                            ["customer"] = tender.IssuingDepartment,
                            ["customerEmail"] = tender.ContactEmail,
                            ["contactPerson"] = tender.ContactPerson,
                            ["contactPhone"] = tender.ContactPhone,
                            ["enquiry"] = enquiry,
                            ["tenderId"] = tender.Id,
                            ["tenderNumber"] = tender.TenderNumber,
                            ["tenderTitle"] = tender.Title,
                            ["companyCode"] = tender.CompanyCode,
                            ["awardedValue"] = value,
                            ["source"] = "tender"
                        },
                        ["tender"] = new JsonObject
                        {
                            ["id"] = tender.Id, ["number"] = tender.TenderNumber, ["title"] = tender.Title, ["company"] = tender.CompanyCode,
                            ["issuingDepartment"] = tender.IssuingDepartment, ["province"] = tender.Province, ["awardedValue"] = value, ["awardDate"] = tender.AwardDate,
                            ["lines"] = new JsonArray(lines.Select(l => (JsonNode)new JsonObject { ["line"] = l.LineNumber, ["code"] = l.ItemCode, ["description"] = l.Description, ["unit"] = l.Unit, ["qty"] = l.Quantity, ["unitCost"] = l.UnitCost }).ToArray())
                        }
                    };

                    // start as the person who awarded it if they are on the tender team or the creator; else the tender creator
                    var starter = byUserId ?? tender.CreatedByUserId;
                    var engine = sp.GetRequiredService<IFlowEngine>();
                    var run = await engine.StartRunAsync(def, ctx, "tender.awarded", starter, "tender", tender.Id.ToString(), $"{tender.IssuingDepartment} · tender {tender.TenderNumber}");

                    db.TenderActivities.Add(new Models.Tenders.TenderActivity
                    {
                        TenderId = tender.Id, ActivityType = "HandedToSales",
                        Description = $"Sales process started: {def.Name} run #{run.RunNumber}",
                        UserId = byUserId, UserName = null, Metadata = $"{{\"flowRunId\":{run.Id}}}"
                    });
                    await db.SaveChangesAsync();

                    // tell the Sales team the order exists
                    var notify = sp.GetService<INotificationBroadcaster>();
                    if (notify != null)
                    {
                        var salesIds = await db.Users.Where(u => u.IsActive && u.DepartmentId != null && u.Department!.Name.ToLower().StartsWith("sales")).Select(u => u.UserId).ToListAsync();
                        foreach (var uid in salesIds.Take(25))
                            await notify.NotifyUserAsync(uid, new NotificationPayload { Type = "flow", Title = $"Tender won: {tender.TenderNumber}", Body = $"{tender.IssuingDepartment}{(value != null ? $" · R{value:N0}" : "")}. The Sales process has started pre-filled from the tender.", Url = "/flows?run=" + run.Id });
                    }

                    sp.GetService<IFlowEventPublisher>()?.Publish("tender.awarded", new JsonObject { ["tenderId"] = tender.Id, ["tenderNumber"] = tender.TenderNumber, ["customer"] = tender.IssuingDepartment, ["awardedValue"] = value, ["flowRunId"] = run.Id, ["byUserId"] = byUserId }, "tender", tender.Id.ToString());
                    _log.LogInformation("Tender hand-off: {No} → {Flow} run #{Run}", tender.TenderNumber, def.Name, run.RunNumber);
                }
                catch (Exception ex) { _log.LogError(ex, "Tender hand-off failed for tender {Id}", tenderId); }
            });
        }

        private static async Task<FlowDefinition?> ResolveSalesFlowAsync(ApplicationDbContext db)
        {
            var raw = await db.SystemSettings.AsNoTracking().Where(s => s.Key == SalesFlowKey).Select(s => s.Value).FirstOrDefaultAsync();
            if (int.TryParse(raw, out var id))
            {
                var d = await db.FlowDefinitions.AsNoTracking().FirstOrDefaultAsync(f => f.Id == id && f.IsEnabled && !f.IsTemplate);
                if (d != null) return d;
            }
            return await db.FlowDefinitions.AsNoTracking().Where(f => f.IsEnabled && !f.IsTemplate && f.Name.StartsWith("Sales")).OrderBy(f => f.Id).FirstOrDefaultAsync();
        }
    }
}
