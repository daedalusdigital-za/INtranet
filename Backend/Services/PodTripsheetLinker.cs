using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Services;

/// <summary>
/// Links standalone PODs (PodDocuments) to tripsheets (Loads) by way of the
/// invoices they share. A POD is tagged with one or more invoice numbers; if any
/// of those invoices has been placed on a tripsheet (Invoice.LoadId), the POD
/// should carry that same LoadId so it surfaces on the tripsheet.
///
/// The link is applied in BOTH directions and retroactively:
///  - when a POD is uploaded (handled inline in the upload endpoint), and
///  - when invoices are assigned to a tripsheet (call <see cref="LinkForLoadsAsync"/>), and
///  - on demand for the whole backlog (call <see cref="ReconcileAllAsync"/>).
///
/// If a POD's invoices span multiple tripsheets, it is linked to the tripsheet
/// that holds the MOST of its invoices (ties broken by the most recent load).
/// PODs that already have a LoadId are never overwritten.
/// </summary>
public static class PodTripsheetLinker
{
    public class LinkResult
    {
        public int PodsExamined { get; set; }
        public int PodsLinked { get; set; }
        public List<object> Links { get; set; } = new();
    }

    /// <summary>
    /// Reconcile every POD that has no tripsheet link yet against the current
    /// invoice→load assignments. Safe to run repeatedly.
    /// </summary>
    public static Task<LinkResult> ReconcileAllAsync(ApplicationDbContext db, CancellationToken ct = default)
        => LinkCoreAsync(db, restrictLoadIds: null, ct);

    /// <summary>
    /// Link any unlinked PODs whose invoices belong to the given tripsheet(s).
    /// Call this right after invoices get a LoadId during tripsheet creation.
    /// </summary>
    public static Task<LinkResult> LinkForLoadsAsync(ApplicationDbContext db, IEnumerable<int> loadIds, CancellationToken ct = default)
    {
        var ids = loadIds?.Where(x => x > 0).Distinct().ToList() ?? new List<int>();
        if (ids.Count == 0) return Task.FromResult(new LinkResult());
        return LinkCoreAsync(db, ids, ct);
    }

    private static async Task<LinkResult> LinkCoreAsync(ApplicationDbContext db, List<int>? restrictLoadIds, CancellationToken ct)
    {
        var result = new LinkResult();

        // 1) Build a map of invoiceId -> loadId for invoices that ARE on a tripsheet.
        //    When restricted, only consider the loads we were asked about.
        var invoiceLoadQuery = db.ImportedInvoices.AsNoTracking()
            .Where(i => i.LoadId != null);
        if (restrictLoadIds != null)
            invoiceLoadQuery = invoiceLoadQuery.Where(i => restrictLoadIds.Contains(i.LoadId!.Value));

        var invoiceLoadPairs = await invoiceLoadQuery
            .Select(i => new { i.Id, i.TransactionNumber, LoadId = i.LoadId!.Value })
            .ToListAsync(ct);

        if (invoiceLoadPairs.Count == 0) return result;

        var loadByInvoiceId = new Dictionary<int, int>();
        var loadByInvoiceNumber = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var p in invoiceLoadPairs)
        {
            loadByInvoiceId[p.Id] = p.LoadId;
            if (!string.IsNullOrWhiteSpace(p.TransactionNumber))
                loadByInvoiceNumber[p.TransactionNumber.Trim()] = p.LoadId;
        }

        // 2) Candidate PODs: those with no LoadId yet. When restricted, only PODs
        //    that touch one of the target invoices (by id or number).
        var podsQuery = db.PodDocuments.Where(p => p.LoadId == null);

        if (restrictLoadIds != null)
        {
            var invIds = loadByInvoiceId.Keys.ToList();
            var invNums = loadByInvoiceNumber.Keys.ToList();
            podsQuery = podsQuery.Where(p =>
                (p.InvoiceId != null && invIds.Contains(p.InvoiceId.Value)) ||
                p.InvoiceLinks.Any(l =>
                    (l.InvoiceId != null && invIds.Contains(l.InvoiceId.Value)) ||
                    (l.InvoiceNumber != null && invNums.Contains(l.InvoiceNumber))));
        }

        var pods = await podsQuery
            .Select(p => new
            {
                p.Id,
                p.PodNumber,
                p.InvoiceId,
                Links = p.InvoiceLinks.Select(l => new { l.InvoiceId, l.InvoiceNumber }).ToList()
            })
            .ToListAsync(ct);

        result.PodsExamined = pods.Count;
        if (pods.Count == 0) return result;

        // 3) For each POD, tally which loads its invoices belong to, pick the winner.
        var podIdsToLoad = new Dictionary<int, int>();
        foreach (var pod in pods)
        {
            var votes = new Dictionary<int, int>();

            void Vote(int loadId)
            {
                votes.TryGetValue(loadId, out var c);
                votes[loadId] = c + 1;
            }

            if (pod.InvoiceId != null && loadByInvoiceId.TryGetValue(pod.InvoiceId.Value, out var legacyLoad))
                Vote(legacyLoad);

            foreach (var link in pod.Links)
            {
                if (link.InvoiceId != null && loadByInvoiceId.TryGetValue(link.InvoiceId.Value, out var lById))
                    Vote(lById);
                else if (!string.IsNullOrWhiteSpace(link.InvoiceNumber) &&
                         loadByInvoiceNumber.TryGetValue(link.InvoiceNumber.Trim(), out var lByNum))
                    Vote(lByNum);
            }

            if (votes.Count == 0) continue;

            // Winner: most invoices on that load, tie-break by highest LoadId (most recent).
            var winner = votes.OrderByDescending(v => v.Value).ThenByDescending(v => v.Key).First().Key;
            podIdsToLoad[pod.Id] = winner;
            result.Links.Add(new { podId = pod.Id, podNumber = pod.PodNumber, loadId = winner, invoiceMatches = votes[winner] });
        }

        if (podIdsToLoad.Count == 0) return result;

        // 4) Apply. Load the tracked entities and set LoadId.
        var idList = podIdsToLoad.Keys.ToList();
        var tracked = await db.PodDocuments.Where(p => idList.Contains(p.Id)).ToListAsync(ct);
        foreach (var pod in tracked)
        {
            if (pod.LoadId == null && podIdsToLoad.TryGetValue(pod.Id, out var loadId))
            {
                pod.LoadId = loadId;
                result.PodsLinked++;
            }
        }

        await db.SaveChangesAsync(ct);
        return result;
    }
}
