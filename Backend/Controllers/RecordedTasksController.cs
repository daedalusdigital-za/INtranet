using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Welly;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Task recorder: save a task someone recorded in the intranet, list them, and log each time Welly walks someone
    /// through one. Welly only drives the screens as the signed-in person, so every page and save keeps its own checks.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/welly/recordings")]
    public class RecordedTasksController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public RecordedTasksController(ApplicationDbContext db) { _db = db; }

        private int Uid => User.GetUserId() ?? 0;
        private const int MaxSteps = 300;
        private static readonly HashSet<string> Kinds = new() { "navigate", "click", "fill", "select", "check" };
        // Belt and braces: the recorder already skips these, but never store a value that looks like a secret.
        private static readonly Regex Sensitive = new(@"pass(word|code)?|\bpin\b|otp|one.?time|cvv|cvc|card.?(no|num)|secret|token|api.?key|iban|account.?(no|num)|id.?number",
            RegexOptions.IgnoreCase | RegexOptions.Compiled);

        public class SaveRecordingRequest
        {
            public string? Name { get; set; }
            public string? Description { get; set; }
            public string? Visibility { get; set; }
            public string? StartUrl { get; set; }
            public JsonElement Steps { get; set; }
        }

        public class FinishRunRequest
        {
            public string? Outcome { get; set; }
            public int StepsByWelly { get; set; }
            public int StepsByPerson { get; set; }
            public int? StoppedAtStep { get; set; }
            public string? StopReason { get; set; }
        }

        private IQueryable<RecordedTask> Visible()
        {
            var uid = Uid;
            var q = _db.RecordedTasks.Where(t => !t.IsDeleted);
            return User.IsAdmin() ? q : q.Where(t => t.CreatedByUserId == uid || t.Visibility == "shared");
        }

        private object Dto(RecordedTask t) => new
        {
            t.Id, t.Name, t.Description, t.StartUrl, t.Visibility, t.CreatedByUserId, t.CreatedByName, t.CreatedAt, t.UpdatedAt,
            t.RunCount, t.LastRunAt, canEdit = t.CreatedByUserId == Uid || User.IsAdmin(),
            steps = JsonNode.Parse(string.IsNullOrWhiteSpace(t.StepsJson) ? "[]" : t.StepsJson)
        };

        [HttpGet]
        public async Task<IActionResult> List()
        {
            var list = await Visible().AsNoTracking().OrderByDescending(t => t.UpdatedAt ?? t.CreatedAt).Take(200).ToListAsync();
            return Ok(list.Select(Dto));
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> Get(int id)
        {
            var t = await Visible().AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            return t == null ? NotFound() : Ok(Dto(t));
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] SaveRecordingRequest req)
        {
            var (steps, err) = CleanSteps(req.Steps);
            if (err != null) return BadRequest(new { message = err });
            if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Give the task a name" });
            var me = await _db.Users.AsNoTracking().Where(u => u.UserId == Uid).Select(u => new { u.Name, u.Surname }).FirstOrDefaultAsync();
            var t = new RecordedTask
            {
                Name = Clip(req.Name, 150)!, Description = Clip(req.Description, 1000), StartUrl = Clip(req.StartUrl, 500),
                Visibility = req.Visibility == "shared" ? "shared" : "private", StepsJson = steps!.ToJsonString(),
                CreatedByUserId = Uid, CreatedByName = me == null ? null : Clip($"{me.Name} {me.Surname}".Trim(), 150), CreatedAt = DateTime.UtcNow
            };
            _db.RecordedTasks.Add(t);
            await _db.SaveChangesAsync();
            return Ok(Dto(t));
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] SaveRecordingRequest req)
        {
            var t = await _db.RecordedTasks.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            if (t == null) return NotFound();
            if (t.CreatedByUserId != Uid && !User.IsAdmin()) return StatusCode(403, new { message = "Only the person who recorded it can change it" });
            var (steps, err) = CleanSteps(req.Steps);
            if (err != null) return BadRequest(new { message = err });
            if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Give the task a name" });
            t.Name = Clip(req.Name, 150)!; t.Description = Clip(req.Description, 1000);
            t.Visibility = req.Visibility == "shared" ? "shared" : "private";
            if (req.StartUrl != null) t.StartUrl = Clip(req.StartUrl, 500);
            t.StepsJson = steps!.ToJsonString(); t.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(Dto(t));
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var t = await _db.RecordedTasks.FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            if (t == null) return NotFound();
            if (t.CreatedByUserId != Uid && !User.IsAdmin()) return StatusCode(403, new { message = "Only the person who recorded it can delete it" });
            t.IsDeleted = true; t.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("{id:int}/runs")]
        public async Task<IActionResult> StartRun(int id)
        {
            var t = await Visible().FirstOrDefaultAsync(x => x.Id == id);
            if (t == null) return NotFound();
            var me = await _db.Users.AsNoTracking().Where(u => u.UserId == Uid).Select(u => new { u.Name, u.Surname }).FirstOrDefaultAsync();
            var total = (JsonNode.Parse(t.StepsJson) as JsonArray)?.Count ?? 0;
            var run = new RecordedTaskRun { RecordedTaskId = id, UserId = Uid, UserName = me == null ? null : Clip($"{me.Name} {me.Surname}".Trim(), 150), StepsTotal = total };
            _db.RecordedTaskRuns.Add(run);
            t.RunCount++; t.LastRunAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return Ok(new { run.Id });
        }

        [HttpPut("runs/{runId:long}")]
        public async Task<IActionResult> FinishRun(long runId, [FromBody] FinishRunRequest req)
        {
            var run = await _db.RecordedTaskRuns.FirstOrDefaultAsync(r => r.Id == runId);
            if (run == null) return NotFound();
            if (run.UserId != Uid) return Forbid();
            run.Outcome = req.Outcome == "completed" ? "completed" : "stopped";
            run.StepsByWelly = Math.Max(0, req.StepsByWelly); run.StepsByPerson = Math.Max(0, req.StepsByPerson);
            run.StoppedAtStep = req.StoppedAtStep; run.StopReason = Clip(req.StopReason, 500);
            run.FinishedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        [HttpGet("{id:int}/runs")]
        public async Task<IActionResult> Runs(int id)
        {
            if (!await Visible().AnyAsync(x => x.Id == id)) return NotFound();
            return Ok(await _db.RecordedTaskRuns.AsNoTracking().Where(r => r.RecordedTaskId == id).OrderByDescending(r => r.StartedAt).Take(50).ToListAsync());
        }

        private static string? Clip(string? s, int max) => string.IsNullOrWhiteSpace(s) ? null : (s.Trim().Length > max ? s.Trim()[..max] : s.Trim());

        /// <summary>Keep only known step kinds and fields, cap sizes, and drop any value that could be a secret.</summary>
        private static (JsonArray? steps, string? error) CleanSteps(JsonElement raw)
        {
            if (raw.ValueKind != JsonValueKind.Array) return (null, "No steps recorded");
            var src = JsonNode.Parse(raw.GetRawText()) as JsonArray ?? new JsonArray();
            if (src.Count == 0) return (null, "No steps recorded");
            if (src.Count > MaxSteps) return (null, $"Too many steps (most is {MaxSteps}). Record a shorter task.");
            var outArr = new JsonArray();
            foreach (var n in src)
            {
                if (n is not JsonObject s) continue;
                var kind = s["kind"]?.GetValue<string>() ?? "";
                if (!Kinds.Contains(kind)) continue;
                var o = new JsonObject
                {
                    ["kind"] = kind,
                    ["label"] = Clip(s["label"]?.ToString(), 200) ?? kind,
                };
                if (Clip(s["url"]?.ToString(), 500) is { } url && url.StartsWith('/')) o["url"] = url;
                if (s["target"] is JsonObject tgt)
                {
                    var t = new JsonObject();
                    foreach (var k in new[] { "welly", "id", "aria", "name", "label", "text", "role", "tag", "css", "placeholder", "type" })
                        if (Clip(tgt[k]?.ToString(), 300) is { } v) t[k] = v;
                    o["target"] = t;
                }
                if (Clip(s["note"]?.ToString(), 300) is { } note) o["note"] = note;
                var hint = $"{s["label"]} {s["target"]?["label"]} {s["target"]?["name"]} {s["target"]?["id"]} {s["target"]?["aria"]} {s["target"]?["placeholder"]} {s["target"]?["type"]}";
                var sensitive = s["sensitive"]?.GetValue<bool>() == true || Sensitive.IsMatch(hint);
                if (kind is "fill" or "select" or "check")
                {
                    if (sensitive) { o["sensitive"] = true; }
                    else if (s["value"] != null) o["value"] = Clip(s["value"]!.ToString(), 2000) ?? "";
                    if (s["input"] is JsonObject inp || sensitive)
                    {
                        var key = Clip((s["input"]?["key"])?.ToString(), 60) ?? $"v{outArr.Count + 1}";
                        o["input"] = new JsonObject { ["key"] = Regex.Replace(key, "[^A-Za-z0-9_]", "_"), ["label"] = Clip((s["input"]?["label"])?.ToString(), 100) ?? (o["label"]!.ToString()) };
                    }
                }
                outArr.Add(o);
            }
            if (outArr.Count == 0) return (null, "No usable steps recorded");
            return (outArr, null);
        }
    }
}
