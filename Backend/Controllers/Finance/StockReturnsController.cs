using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Finance;
using ProjectTracker.API.Services.Logistics;

namespace ProjectTracker.API.Controllers.Finance
{
    /// <summary>
    /// Stock returns raised from credit notes. Finance sets the reason on a credit; if it's a physical reason
    /// (Return / Damaged / Expired) a pending return is created from the CN's product lines. The branch then
    /// confirms what actually came back and into which warehouse — that confirmation is what posts the ledger
    /// movement, so stock is never moved on paper alone.
    ///   Return  → +qty into the warehouse ("Return" movement)
    ///   Damaged / Expired → recorded as a "Scrap" movement of 0 net stock (goods never re-enter saleable stock),
    ///                        but the ledger keeps the audit trail against the CN.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/finance/stock-returns")]
    [RequireModule("finance", AlsoAllowRoles = "Finance,Sales,Manager,Admin")]
    public class StockReturnsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public StockReturnsController(ApplicationDbContext db) { _db = db; }

        private int UserId => int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : 0;
        private string UserName => User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name ?? "";

        /// <summary>Reasons that mean goods physically moved and therefore need a stock return.</summary>
        public static readonly string[] PhysicalReasons = { "Return", "Returns", "Damaged", "Expired" };
        public static readonly string[] AllReasons = { "Return", "Pricing", "Short delivery", "Damaged", "Expired", "Duplicate", "Goodwill", "Other" };
        public static bool IsPhysical(string? reason) => reason != null && PhysicalReasons.Contains(reason.Trim(), StringComparer.OrdinalIgnoreCase);
        public static string ReturnTypeFor(string? reason) => (reason ?? "").Trim().ToLowerInvariant() switch { "damaged" => "Damaged", "expired" => "Expired", _ => "Return" };

        /// <summary>
        /// Create (or return the existing) pending return for a credit note from its Sage product lines.
        /// Idempotent per company + CN. Called by the credit-note upload/update when the reason is physical.
        /// </summary>
        public static async Task<StockReturn?> EnsureForCreditNoteAsync(ApplicationDbContext db, string company, string cnNumber, string reason, int userId, string userName, int? documentId)
        {
            if (!IsPhysical(reason)) return null;
            var existing = await db.StockReturns.Include(r => r.Lines).FirstOrDefaultAsync(r => r.Company == company && r.CreditNoteNumber == cnNumber);
            if (existing != null)
            {
                if (existing.Status == "Pending") { existing.ReturnType = ReturnTypeFor(reason); if (documentId != null) existing.CreditNoteDocumentId = documentId; }
                return existing;
            }
            var lines = await db.ImportedInvoices.AsNoTracking()
                .Where(i => i.TransactionNumber == cnNumber && i.SourceCompany == company && i.ProductCode != "")
                .GroupBy(i => new { i.ProductCode, i.ProductDescription })
                .Select(g => new { g.Key.ProductCode, g.Key.ProductDescription, qty = -g.Sum(x => x.Quantity), g.First().CustomerNumber, g.First().CustomerName })
                .ToListAsync();
            if (lines.Count == 0) return null;

            var map = await CommodityCodeMatcher.BuildAsync(db, lines.Select(l => l.ProductCode));
            var ret = new StockReturn
            {
                CreditNoteNumber = cnNumber, Company = company, CustomerNumber = lines[0].CustomerNumber, CustomerName = lines[0].CustomerName,
                CreditNoteDocumentId = documentId, ReturnType = ReturnTypeFor(reason), Status = "Pending",
                CreatedBy = userId, CreatedByName = userName
            };
            foreach (var l in lines.Where(l => l.qty > 0))
                ret.Lines.Add(new StockReturnLine { ProductCode = l.ProductCode, ProductDescription = l.ProductDescription, Quantity = l.qty, CommodityId = CommodityCodeMatcher.Match(map, l.ProductCode, company) });
            if (ret.Lines.Count == 0) return null;
            db.StockReturns.Add(ret);
            return ret;
        }

        // GET api/finance/stock-returns?status=Pending&company=PMT
        [HttpGet]
        public async Task<IActionResult> List([FromQuery] string? status = "Pending", [FromQuery] string? company = null)
        {
            var q = _db.StockReturns.AsNoTracking().Include(r => r.Lines).AsQueryable();
            if (!string.IsNullOrWhiteSpace(status) && status != "All") q = q.Where(r => r.Status == status);
            if (!string.IsNullOrWhiteSpace(company) && company != "ALL") q = q.Where(r => r.Company == company);
            var rows = await q.OrderByDescending(r => r.Status == "Pending").ThenByDescending(r => r.CreatedAt).Take(500).ToListAsync();
            var whIds = rows.Where(r => r.WarehouseId != null).Select(r => r.WarehouseId!.Value).Distinct().ToList();
            var whs = await _db.Warehouses.AsNoTracking().Where(w => whIds.Contains(w.Id)).ToDictionaryAsync(w => w.Id, w => w.Name);
            return Ok(rows.Select(r => Dto(r, r.WarehouseId != null && whs.TryGetValue(r.WarehouseId.Value, out var n) ? n : null)));
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var r = await _db.StockReturns.AsNoTracking().Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id);
            if (r == null) return NotFound();
            var wh = r.WarehouseId == null ? null : await _db.Warehouses.AsNoTracking().Where(w => w.Id == r.WarehouseId).Select(w => w.Name).FirstOrDefaultAsync();
            // Current stock per line at every warehouse so the branch can see where it belongs
            var commIds = r.Lines.Where(l => l.CommodityId != null).Select(l => l.CommodityId!.Value).ToList();
            var soh = await _db.WarehouseInventory.AsNoTracking().Where(i => commIds.Contains(i.CommodityId))
                .Select(i => new { i.CommodityId, i.WarehouseId, i.QuantityOnHand, warehouse = i.Warehouse!.Name }).ToListAsync();
            return Ok(new
            {
                ret = Dto(r, wh),
                stock = soh.GroupBy(s => s.CommodityId).ToDictionary(g => g.Key, g => g.Select(s => new { s.WarehouseId, s.warehouse, s.QuantityOnHand })),
                warehouses = await _db.Warehouses.AsNoTracking().Where(w => w.Status == "Active").OrderBy(w => w.Name).Select(w => new { w.Id, w.Name, w.Code, w.Province }).ToListAsync()
            });
        }

        /// <summary>Raise a return manually (e.g. goods came back before Sage posted the CN).</summary>
        public class CreateReq { public string CreditNoteNumber { get; set; } = ""; public string Company { get; set; } = ""; public string Reason { get; set; } = "Return"; public string? Notes { get; set; } }
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateReq req)
        {
            var number = req.CreditNoteNumber.Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(number) || string.IsNullOrWhiteSpace(req.Company)) return BadRequest(new { error = "Credit note number and company are required." });
            var ret = await EnsureForCreditNoteAsync(_db, req.Company.Trim().ToUpperInvariant(), number, IsPhysical(req.Reason) ? req.Reason : "Return", UserId, UserName, null);
            if (ret == null) return BadRequest(new { error = $"{number} has no product lines in the {req.Company} sales history yet." });
            if (req.Notes != null) ret.Notes = req.Notes.Trim();
            await _db.SaveChangesAsync();
            return Ok(Dto(ret, null));
        }

        public class ConfirmReq
        {
            public int WarehouseId { get; set; }
            public string? Notes { get; set; }
            /// <summary>Optional per-line overrides: lineId → confirmed qty (and commodity when auto-match failed).</summary>
            public List<ConfirmLine>? Lines { get; set; }
        }
        public class ConfirmLine { public int Id { get; set; } public decimal? ConfirmedQuantity { get; set; } public int? CommodityId { get; set; } }

        /// <summary>Branch confirms the return: posts the ledger movements and closes the return.</summary>
        [HttpPost("{id:int}/confirm")]
        public async Task<IActionResult> Confirm(int id, [FromBody] ConfirmReq req)
        {
            if (!await StockAccess.CanManageAsync(_db, User)) return StatusCode(403, new { error = StockAccess.Denied });
            var r = await _db.StockReturns.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id);
            if (r == null) return NotFound();
            if (r.Status != "Pending") return BadRequest(new { error = $"Return is already {r.Status}." });
            if (!await _db.Warehouses.AnyAsync(w => w.Id == req.WarehouseId)) return BadRequest(new { error = "Choose the warehouse the goods came back to." });

            var overrides = (req.Lines ?? new()).ToDictionary(l => l.Id, l => l);
            var unresolved = new List<string>();
            foreach (var line in r.Lines)
            {
                if (overrides.TryGetValue(line.Id, out var o))
                {
                    if (o.ConfirmedQuantity.HasValue) line.ConfirmedQuantity = o.ConfirmedQuantity;
                    if (o.CommodityId.HasValue) line.CommodityId = o.CommodityId;
                }
                line.ConfirmedQuantity ??= line.Quantity;
                if (line.ConfirmedQuantity <= 0) continue;
                if (line.CommodityId == null) { unresolved.Add(line.ProductCode); continue; }
            }
            if (unresolved.Count > 0) return BadRequest(new { error = $"These product codes aren't stock items yet — pick the matching item for: {string.Join(", ", unresolved)}", unresolved });

            await using var tx = await _db.Database.BeginTransactionAsync();
            try
            {
                var reference = $"{r.CreditNoteNumber} ({r.Company})";
                foreach (var line in r.Lines.Where(l => l.ConfirmedQuantity > 0))
                {
                    // Return puts stock back; Damaged/Expired is a zero-net scrap record (in and straight out) so the
                    // ledger shows the goods came back and were written off against the CN.
                    if (r.ReturnType == "Return")
                    {
                        var m = await StockLedger.ApplyAsync(_db, req.WarehouseId, line.CommodityId!.Value, "Return", line.ConfirmedQuantity!.Value, null, null, reference,
                            $"Customer return on credit note {r.CreditNoteNumber} — {r.CustomerName}", UserName);
                        await _db.SaveChangesAsync();
                        line.MovementId = m.Id;
                    }
                    else
                    {
                        await StockLedger.ApplyAsync(_db, req.WarehouseId, line.CommodityId!.Value, "Return", line.ConfirmedQuantity!.Value, null, null, reference,
                            $"{r.ReturnType} goods returned on credit note {r.CreditNoteNumber} — {r.CustomerName}", UserName);
                        var m = await StockLedger.ApplyAsync(_db, req.WarehouseId, line.CommodityId!.Value, "Scrap", -line.ConfirmedQuantity!.Value, null, null, reference,
                            $"{r.ReturnType} write-off on credit note {r.CreditNoteNumber}", UserName);
                        await _db.SaveChangesAsync();
                        line.MovementId = m.Id;
                    }
                }
                r.Status = "Confirmed"; r.WarehouseId = req.WarehouseId; r.ConfirmedBy = UserId; r.ConfirmedByName = UserName; r.ConfirmedAt = DateTime.UtcNow;
                if (!string.IsNullOrWhiteSpace(req.Notes)) r.Notes = string.IsNullOrWhiteSpace(r.Notes) ? req.Notes.Trim() : r.Notes + "\n" + req.Notes.Trim();
                await _db.SaveChangesAsync();
                await tx.CommitAsync();
            }
            catch (Exception ex) when (StockLedger.IsStockConflict(ex))
            {
                await tx.RollbackAsync();
                return Conflict(new { error = StockLedger.ConflictMessage });
            }
            var wh = await _db.Warehouses.AsNoTracking().Where(w => w.Id == r.WarehouseId).Select(w => w.Name).FirstOrDefaultAsync();
            return Ok(Dto(r, wh));
        }

        public class RejectReq { public string Reason { get; set; } = ""; }
        /// <summary>Nothing came back (e.g. the credit was really a pricing fix) — close without touching stock.</summary>
        [HttpPost("{id:int}/reject")]
        public async Task<IActionResult> Reject(int id, [FromBody] RejectReq req)
        {
            var r = await _db.StockReturns.Include(x => x.Lines).FirstOrDefaultAsync(x => x.Id == id);
            if (r == null) return NotFound();
            if (r.Status != "Pending") return BadRequest(new { error = $"Return is already {r.Status}." });
            r.Status = "Rejected"; r.ConfirmedBy = UserId; r.ConfirmedByName = UserName; r.ConfirmedAt = DateTime.UtcNow;
            r.Notes = string.IsNullOrWhiteSpace(r.Notes) ? req.Reason?.Trim() : r.Notes + "\n" + req.Reason?.Trim();
            await _db.SaveChangesAsync();
            return Ok(Dto(r, null));
        }

        private static object Dto(StockReturn r, string? warehouse) => new
        {
            r.Id, r.CreditNoteNumber, r.Company, r.CustomerNumber, r.CustomerName, r.CreditNoteDocumentId, r.ReturnType, r.Status, r.WarehouseId, warehouse,
            r.Notes, r.CreatedBy, r.CreatedByName, r.CreatedAt, r.ConfirmedBy, r.ConfirmedByName, r.ConfirmedAt,
            lines = r.Lines.Select(l => new { l.Id, l.ProductCode, l.ProductDescription, l.Quantity, l.ConfirmedQuantity, l.CommodityId, l.MovementId, matched = l.CommodityId != null }),
            totalQty = r.Lines.Sum(l => l.Quantity)
        };
    }
}
