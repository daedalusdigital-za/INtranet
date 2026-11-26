using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Authorization;
using ProjectTracker.API.Services.Welly;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Welly's skills (the action layer). Lists them for the flow designer and lets a person try one as themselves:
    /// it runs with their permissions, and only Read / Prepare skills run (nothing that changes data or sends anything).
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/welly/skills")]
    public class WellySkillsController : ControllerBase
    {
        private readonly IWellySkillRegistry _skills;
        public WellySkillsController(IWellySkillRegistry skills) { _skills = skills; }

        [HttpGet]
        public IActionResult List() => Ok(_skills.All.Select(k => new
        {
            key = k.Key, title = k.Title, description = k.Description, module = k.Module, kind = k.Kind.ToString().ToLowerInvariant(),
            needsApproval = !WellySkillRegistry.RunsWithoutApproval(k.Kind),
            inputs = k.Inputs.Select(i => new { key = i.Key, label = i.Label, required = i.Required }), prefillKeys = k.PrefillKeys
        }));

        [HttpPost("{key}/try")]
        public async Task<IActionResult> Try(string key, [FromBody] JsonElement inputs, CancellationToken ct)
        {
            var uid = User.GetUserId();
            if (uid == null) return Unauthorized();
            var obj = inputs.ValueKind == JsonValueKind.Object ? JsonNode.Parse(inputs.GetRawText()) as JsonObject ?? new JsonObject() : new JsonObject();
            var run = await _skills.RunAsync(key, uid.Value, obj, ct);
            if (run.Refused != null) return BadRequest(new { message = run.Refused });
            return Ok(run.Result);
        }
    }
}
