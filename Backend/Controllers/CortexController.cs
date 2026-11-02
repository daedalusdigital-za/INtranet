using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Cortex;
using ProjectTracker.API.Services.Cortex;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Cortex: the company knowledge graph. Reads are scoped by the caller's module permissions (a node with a
    /// Permission the caller lacks is left out); writes are limited to curated content, confirming or rejecting
    /// inferred items, and setting a hand-off class by hand (flagged as curated).
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/cortex")]
    public class CortexController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly CortexGraphBuilder _builder;
        private readonly ILogger<CortexController> _log;
        private int Uid => User.GetUserId() ?? 0;

        public CortexController(ApplicationDbContext db, CortexGraphBuilder builder, ILogger<CortexController> log) { _db = db; _builder = builder; _log = log; }

        // ── Read ──────────────────────────────────────────────────────────────────

        /// <summary>
        /// The graph. <paramref name="layers"/> = comma list of layer keys to include (default: all);
        /// <paramref name="root"/> = only the subtree under this key (zooming in); <paramref name="asOf"/> = replay the graph as it was then.
        /// </summary>
        [HttpGet("graph")]
        public async Task<IActionResult> Graph([FromQuery] string? layers, [FromQuery] string? root, [FromQuery] DateTime? asOf, [FromQuery] bool includeInactive = false)
        {
            if (!await _db.CortexNodes.AnyAsync()) await _builder.RebuildAsync();
            var allowed = await AllowedModulesAsync();
            var types = await _db.CortexNodeTypes.AsNoTracking().OrderBy(t => t.SortOrder).ToListAsync();
            var typeByKey = types.ToDictionary(t => t.Key);
            var layerSet = string.IsNullOrWhiteSpace(layers) ? null : layers.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.OrdinalIgnoreCase);

            var nq = _db.CortexNodes.AsNoTracking().AsQueryable();
            var eq = _db.CortexEdges.AsNoTracking().AsQueryable();
            if (asOf is DateTime at)
            {
                nq = nq.Where(n => n.CreatedAt <= at); eq = eq.Where(e => e.CreatedAt <= at);
            }
            else if (!includeInactive) { nq = nq.Where(n => n.IsActive); eq = eq.Where(e => e.IsActive); }

            var nodes = await nq.ToListAsync();
            // permission scope: node-level permission, or the module permission for anything under a module
            nodes = nodes.Where(n => n.Permission == null || allowed.Contains("all") || allowed.Contains(n.Permission)).ToList();
            if (layerSet != null) nodes = nodes.Where(n => typeByKey.TryGetValue(n.Type, out var t) && layerSet.Contains(t.Layer)).ToList();
            if (!string.IsNullOrWhiteSpace(root))
            {
                var keep = new HashSet<string> { root };
                var byParent = nodes.Where(n => n.ParentKey != null).ToLookup(n => n.ParentKey!);
                var stack = new Stack<string>(new[] { root });
                while (stack.Count > 0) foreach (var c in byParent[stack.Pop()]) if (keep.Add(c.Key)) stack.Push(c.Key);
                nodes = nodes.Where(n => keep.Contains(n.Key)).ToList();
            }
            var keys = nodes.Select(n => n.Key).ToHashSet();
            var edges = (await eq.ToListAsync()).Where(e => keys.Contains(e.FromKey) && keys.Contains(e.ToKey)).ToList();

            // replay: apply the change log backwards is costly; for asOf we hide items deactivated before that date
            if (asOf is DateTime at2)
            {
                var deact = await _db.CortexChanges.AsNoTracking().Where(c => c.Kind == "deactivated" && c.OccurredAt <= at2).Select(c => c.TargetKey).ToListAsync();
                var react = await _db.CortexChanges.AsNoTracking().Where(c => c.Kind == "reactivated" && c.OccurredAt <= at2).Select(c => c.TargetKey).ToListAsync();
                var gone = deact.Except(react).ToHashSet();
                nodes = nodes.Where(n => !gone.Contains(n.Key)).ToList();
                edges = edges.Where(e => !gone.Contains($"{e.FromKey}>{e.ToKey}:{e.Relation}")).ToList();
            }

            var now = DateTime.UtcNow;
            return Ok(new
            {
                generatedAt = now,
                asOf,
                types = types.Select(t => new { key = t.Key, t.Label, t.Layer, t.Icon, t.Color, t.AttachedType, t.ZoomLevel }),
                nodes = nodes.Select(n => Dto(n, typeByKey, now)),
                edges = edges.Select(e => new
                {
                    e.Id, from = e.FromKey, to = e.ToKey, e.Relation, e.Label, e.Handoff, e.HandoffCurated, e.CodeRef, e.Provenance, e.Source, e.Weight, e.Status,
                    e.DwellAvgHours, e.DwellMedianHours, e.DwellP90Hours, e.QueueSize, e.MetricsAt, data = e.DataJson
                }),
                counts = new
                {
                    nodes = nodes.Count, edges = edges.Count,
                    derived = nodes.Count(n => n.Provenance == CortexProvenance.Derived),
                    curated = nodes.Count(n => n.Provenance == CortexProvenance.Curated && !string.IsNullOrWhiteSpace(n.DataJson)),
                    curatedEmpty = nodes.Count(n => n.Provenance == CortexProvenance.Curated && string.IsNullOrWhiteSpace(n.DataJson)),
                    inferred = nodes.Count(n => n.Provenance == CortexProvenance.Inferred && n.Status == "pending"),
                    overdue = nodes.Count(n => n.ReviewDueAt != null && n.ReviewDueAt < now),
                    gaps = nodes.Count(n => n.Type == "gap" && n.Status != "closed"),
                    handoffs = edges.Where(e => e.Relation == "handoff").GroupBy(e => e.Handoff ?? "?").ToDictionary(g => g.Key, g => g.Count())
                }
            });
        }

        [HttpGet("nodes/{key}")]
        public async Task<IActionResult> Node(string key)
        {
            var n = await _db.CortexNodes.AsNoTracking().FirstOrDefaultAsync(x => x.Key == key);
            if (n == null) return NotFound();
            var allowed = await AllowedModulesAsync();
            if (n.Permission != null && !allowed.Contains("all") && !allowed.Contains(n.Permission)) return Forbid();
            var types = await _db.CortexNodeTypes.AsNoTracking().ToDictionaryAsync(t => t.Key);
            var children = await _db.CortexNodes.AsNoTracking().Where(c => c.ParentKey == key && c.IsActive).ToListAsync();
            var edges = await _db.CortexEdges.AsNoTracking().Where(e => e.IsActive && (e.FromKey == key || e.ToKey == key)).ToListAsync();
            var neighbourKeys = edges.Select(e => e.FromKey == key ? e.ToKey : e.FromKey).Distinct().ToList();
            var neighbours = await _db.CortexNodes.AsNoTracking().Where(x => neighbourKeys.Contains(x.Key)).ToListAsync();
            var history = await _db.CortexChanges.AsNoTracking().Where(c => c.TargetKey == key).OrderByDescending(c => c.OccurredAt).Take(50).ToListAsync();
            var now = DateTime.UtcNow;
            return Ok(new
            {
                node = Dto(n, types, now),
                children = children.Select(c => Dto(c, types, now)),
                edges = edges.Select(e => new { e.Id, from = e.FromKey, to = e.ToKey, e.Relation, e.Label, e.Handoff, e.HandoffCurated, e.CodeRef, e.Provenance, e.Weight, e.DwellAvgHours, e.QueueSize }),
                neighbours = neighbours.Select(c => Dto(c, types, now)),
                history = history.Select(h => new { h.Kind, h.Field, h.OldValue, h.NewValue, h.ChangedBy, h.UserName, h.OccurredAt })
            });
        }

        /// <summary>Gaps with owner, cost, priority and status — the to-do list. Never a named person as the problem.</summary>
        [HttpGet("gaps")]
        public async Task<IActionResult> Gaps([FromQuery] string? status = "open")
        {
            if (!await _db.CortexNodes.AnyAsync()) await _builder.RebuildAsync();
            var q = _db.CortexNodes.AsNoTracking().Where(n => n.Type == "gap" && n.IsActive);
            if (!string.IsNullOrWhiteSpace(status) && status != "all") q = q.Where(n => n.Status == status || (status == "open" && n.Status == "accepted"));
            var gaps = await q.ToListAsync();
            var parents = gaps.Select(g => g.ParentKey).Where(p => p != null).Distinct().ToList();
            var parentNodes = await _db.CortexNodes.AsNoTracking().Where(n => parents.Contains(n.Key)).ToDictionaryAsync(n => n.Key);
            var now = DateTime.UtcNow;
            var overdue = await _db.CortexNodes.AsNoTracking().Where(n => n.IsActive && n.ReviewDueAt != null && n.ReviewDueAt < now).ToListAsync();
            var list = gaps.Select(g =>
            {
                parentNodes.TryGetValue(g.ParentKey ?? "", out var p);
                System.Text.Json.JsonElement? data = string.IsNullOrWhiteSpace(g.DataJson) ? null : System.Text.Json.JsonDocument.Parse(g.DataJson).RootElement;
                int priority = data.HasValue && data.Value.TryGetProperty("priority", out var pr) && pr.ValueKind == System.Text.Json.JsonValueKind.Number ? pr.GetInt32() : 1;
                string kind = data.HasValue && data.Value.TryGetProperty("kind", out var k) ? k.GetString() ?? "" : "";
                return new
                {
                    key = g.Key, g.Label, detail = g.Summary, kind, priority, status = g.Status == "accepted" ? "open" : g.Status,
                    owner = g.OwnerLabel ?? p?.OwnerLabel, ownerUserId = g.OwnerUserId ?? p?.OwnerUserId, unowned = (g.OwnerLabel ?? p?.OwnerLabel) == null,
                    on = g.ParentKey, onLabel = p?.Label, onType = p?.Type, g.Provenance, g.Rationale, data = g.DataJson, g.UpdatedAt
                };
            })
            .Concat(overdue.Select(o => new
            {
                key = "overdue:" + o.Key, Label = $"Review overdue: {o.Label}", detail = $"Curated knowledge last confirmed before {o.ReviewDueAt:dd MMM yyyy}. Stale knowledge is shown, not hidden.", kind = "overdue", priority = 2, status = "open",
                owner = o.OwnerLabel, ownerUserId = o.OwnerUserId, unowned = o.OwnerLabel == null, on = o.Key, onLabel = o.Label, onType = o.Type, o.Provenance, o.Rationale, data = (string?)null, o.UpdatedAt
            }))
            .OrderByDescending(g => g.priority).ThenBy(g => g.Label).ToList();
            return Ok(list);
        }

        [HttpGet("changes")]
        public async Task<IActionResult> Changes([FromQuery] DateTime? since, [FromQuery] DateTime? until, [FromQuery] string? key, [FromQuery] int take = 200)
        {
            var q = _db.CortexChanges.AsNoTracking().AsQueryable();
            if (since != null) q = q.Where(c => c.OccurredAt >= since);
            if (until != null) q = q.Where(c => c.OccurredAt <= until);
            if (!string.IsNullOrWhiteSpace(key)) q = q.Where(c => c.TargetKey == key);
            var rows = await q.OrderByDescending(c => c.OccurredAt).Take(Math.Clamp(take, 1, 2000)).ToListAsync();
            return Ok(rows.Select(c => new { c.Id, c.Target, c.TargetKey, c.Kind, c.Field, c.OldValue, c.NewValue, c.ChangedBy, c.UserName, c.OccurredAt }));
        }

        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string q, [FromQuery] int take = 20)
        {
            if (string.IsNullOrWhiteSpace(q) || q.Trim().Length < 2) return Ok(Array.Empty<object>());
            var term = q.Trim();
            var allowed = await AllowedModulesAsync();
            var rows = await _db.CortexNodes.AsNoTracking().Where(n => n.IsActive && n.Type != "type" && (n.Label.Contains(term) || (n.Summary != null && n.Summary.Contains(term)) || n.Key.Contains(term)))
                .OrderBy(n => n.Label.StartsWith(term) ? 0 : 1).ThenBy(n => n.Label).Take(take * 2).ToListAsync();
            rows = rows.Where(n => n.Permission == null || allowed.Contains("all") || allowed.Contains(n.Permission)).Take(take).ToList();
            return Ok(rows.Select(n => new { n.Key, n.Type, n.Label, n.ParentKey, n.Provenance }));
        }

        // ── Write ─────────────────────────────────────────────────────────────────

        /// <summary>Rebuild the derived graph from live data. Designers/admins only; cheap enough to run on demand.</summary>
        [HttpPost("rebuild")]
        public async Task<IActionResult> Rebuild()
        {
            if (!await IsDesignerAsync()) return Forbid();
            var r = await _builder.RebuildAsync();
            return Ok(new { r.Nodes, r.Edges, r.Created, r.Updated, r.Deactivated, r.Reactivated, tookMs = (int)r.Took.TotalMilliseconds });
        }

        public class CurateRequest
        {
            public string? Summary { get; set; }
            public string? DataJson { get; set; }
            public int? OwnerUserId { get; set; }
            public string? OwnerLabel { get; set; }
            public DateTime? ReviewDueAt { get; set; }
        }

        /// <summary>
        /// Write curated knowledge onto a node (knowledge / responsibilities / workflow nodes, or a decision). The owner of
        /// the node, the head of its department, or a designer may do so. Sets a review date (default +6 months).
        /// </summary>
        [HttpPut("nodes/{key}/curate")]
        public async Task<IActionResult> Curate(string key, [FromBody] CurateRequest req)
        {
            var n = await _db.CortexNodes.FirstOrDefaultAsync(x => x.Key == key);
            if (n == null) return NotFound();
            if (!await CanCurateAsync(n)) return Forbid();
            var me = await _db.Users.AsNoTracking().Where(u => u.UserId == Uid).Select(u => u.Name + " " + u.Surname).FirstOrDefaultAsync();
            var now = DateTime.UtcNow;
            void Log(string field, string? o, string? v) => _db.CortexChanges.Add(new CortexChange { Target = "node", TargetKey = key, Kind = "curated", Field = field, OldValue = o, NewValue = v, ChangedBy = "user", UserId = Uid, UserName = me, OccurredAt = now });
            if (req.Summary != null && req.Summary != n.Summary) { Log("Summary", n.Summary, req.Summary); n.Summary = req.Summary; }
            if (req.DataJson != null && req.DataJson != n.DataJson) { Log("DataJson", n.DataJson, req.DataJson); n.DataJson = req.DataJson; }
            if (req.OwnerUserId != null && req.OwnerUserId != n.OwnerUserId) { Log("OwnerUserId", n.OwnerUserId?.ToString(), req.OwnerUserId.ToString()); n.OwnerUserId = req.OwnerUserId; n.OwnerLabel = req.OwnerLabel ?? n.OwnerLabel; }
            if (n.Provenance == CortexProvenance.Derived && (req.Summary != null || req.DataJson != null))
            {
                // a person has confirmed/overwritten derived content: it is now curated and expires like any curated item
                Log("Provenance", n.Provenance, CortexProvenance.Curated); n.Provenance = CortexProvenance.Curated;
            }
            n.ReviewDueAt = req.ReviewDueAt ?? now.AddMonths(6);
            n.UpdatedAt = now; n.UpdatedByUserId = Uid;
            if (n.OwnerUserId == null) { n.OwnerUserId = Uid; n.OwnerLabel = me; }
            await _db.SaveChangesAsync();
            return Ok(new { n.Key, n.Provenance, n.ReviewDueAt, n.OwnerLabel });
        }

        public class ReviewRequest { public string? Reason { get; set; } }

        /// <summary>Confirm an inferred node or edge: it becomes curated fact. Logged with who confirmed.</summary>
        [HttpPost("nodes/{key}/accept")]
        public Task<IActionResult> Accept(string key, [FromBody] ReviewRequest? req) => Review(key, true, req?.Reason);
        /// <summary>Reject an inferred item. Kept with the reason so Welly does not propose it again.</summary>
        [HttpPost("nodes/{key}/reject")]
        public Task<IActionResult> Reject(string key, [FromBody] ReviewRequest? req) => Review(key, false, req?.Reason);

        private async Task<IActionResult> Review(string key, bool accept, string? reason)
        {
            var n = await _db.CortexNodes.FirstOrDefaultAsync(x => x.Key == key);
            if (n == null) return NotFound();
            if (n.Provenance != CortexProvenance.Inferred && n.Type != "gap") return BadRequest(new { message = "Only inferred items and gaps can be accepted or rejected." });
            if (!await CanCurateAsync(n)) return Forbid();
            var me = await _db.Users.AsNoTracking().Where(u => u.UserId == Uid).Select(u => u.Name + " " + u.Surname).FirstOrDefaultAsync();
            var now = DateTime.UtcNow;
            var old = n.Status;
            if (n.Type == "gap") n.Status = accept ? "closed" : "accepted_asis";   // a gap is "accepted" = closed, "rejected" = live with it, with a reason
            else { n.Status = accept ? "accepted" : "rejected"; if (accept) n.Provenance = CortexProvenance.Curated; }
            if (!accept && string.IsNullOrWhiteSpace(reason)) return BadRequest(new { message = "A reason is required so Welly learns from it." });
            n.Rationale = string.IsNullOrWhiteSpace(reason) ? n.Rationale : $"{(accept ? "Accepted" : "Rejected")} by {me}: {reason}";
            n.UpdatedAt = now; n.UpdatedByUserId = Uid; n.ReviewDueAt = accept && n.Type != "gap" ? now.AddMonths(6) : n.ReviewDueAt;
            _db.CortexChanges.Add(new CortexChange { Target = "node", TargetKey = key, Kind = accept ? "accepted" : "rejected", Field = "Status", OldValue = old, NewValue = n.Status, ChangedBy = "user", UserId = Uid, UserName = me, OccurredAt = now });
            await _db.SaveChangesAsync();
            return Ok(new { n.Key, n.Status, n.Provenance, n.Rationale });
        }

        public class HandoffRequest { public string Handoff { get; set; } = ""; public string? Reason { get; set; } }

        /// <summary>Set a hand-off class by hand. Allowed, but flagged as curated and logged; a rebuild will not overwrite it.</summary>
        [HttpPut("edges/{id:int}/handoff")]
        public async Task<IActionResult> SetHandoff(int id, [FromBody] HandoffRequest req)
        {
            if (!await IsDesignerAsync()) return Forbid();
            var e = await _db.CortexEdges.FirstOrDefaultAsync(x => x.Id == id);
            if (e == null) return NotFound();
            var valid = new[] { CortexHandoff.Automatic, CortexHandoff.NeedsSomeone, CortexHandoff.ReadOnly, CortexHandoff.NotBuilt };
            if (!valid.Contains(req.Handoff)) return BadRequest(new { message = "Handoff must be automatic, manual, read or gap." });
            var me = await _db.Users.AsNoTracking().Where(u => u.UserId == Uid).Select(u => u.Name + " " + u.Surname).FirstOrDefaultAsync();
            _db.CortexChanges.Add(new CortexChange { Target = "edge", TargetKey = $"{e.FromKey}>{e.ToKey}:{e.Relation}", Kind = "curated", Field = "Handoff", OldValue = e.Handoff, NewValue = req.Handoff, ChangedBy = "user", UserId = Uid, UserName = me });
            e.Handoff = req.Handoff; e.HandoffCurated = true; e.Relation = "handoff"; e.Rationale = req.Reason; e.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { e.Id, e.Handoff, e.HandoffCurated });
        }

        // ── Helpers ───────────────────────────────────────────────────────────────

        private static object Dto(CortexNode n, Dictionary<string, CortexNodeType> types, DateTime now)
        {
            types.TryGetValue(n.Type, out var t);
            return new
            {
                n.Key, n.Type, layer = t?.Layer ?? "other", icon = t?.Icon, color = t?.Color, zoom = t?.ZoomLevel ?? 3,
                n.Label, n.Short, n.Summary, parent = n.ParentKey, n.Provenance, n.Source, n.SourceId,
                n.OwnerUserId, n.OwnerLabel, n.Permission, n.ReviewDueAt, overdue = n.ReviewDueAt != null && n.ReviewDueAt < now,
                n.Route, data = n.DataJson, n.Rationale, n.Status, n.IsActive, n.UpdatedAt,
                empty = n.Provenance == CortexProvenance.Curated && string.IsNullOrWhiteSpace(n.DataJson) && string.IsNullOrWhiteSpace(n.Summary)
            };
        }

        private async Task<HashSet<string>> AllowedModulesAsync()
        {
            if (User.IsAdmin()) return new HashSet<string> { "all" };
            var u = await _db.Users.AsNoTracking().Where(x => x.UserId == Uid).Select(x => new { x.Permissions, x.Role }).FirstOrDefaultAsync();
            return CortexGraphBuilder.ModulesOf(u?.Permissions, u?.Role).ToHashSet();
        }

        private async Task<bool> IsDesignerAsync()
        {
            if (User.IsAdmin()) return true;
            var a = await AllowedModulesAsync();
            return a.Contains("all") || a.Contains("flows");
        }

        /// <summary>Owner of the node, owner/head of its parent chain, or a designer.</summary>
        private async Task<bool> CanCurateAsync(CortexNode n)
        {
            if (await IsDesignerAsync()) return true;
            if (n.OwnerUserId == Uid) return true;
            var pk = n.ParentKey; var hops = 0;
            while (pk != null && hops++ < 5)
            {
                var p = await _db.CortexNodes.AsNoTracking().Where(x => x.Key == pk).Select(x => new { x.OwnerUserId, x.ParentKey }).FirstOrDefaultAsync();
                if (p == null) break;
                if (p.OwnerUserId == Uid) return true;
                pk = p.ParentKey;
            }
            return false;
        }
    }
}
