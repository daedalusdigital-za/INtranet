using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ProjectTracker.API.Services.Signatures;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers.Signatures
{
    /// <summary>
    /// Generic, reusable electronic-signature endpoints. Any module can capture a
    /// signature against any entity and later list/verify them. Compliant with the
    /// SA ECT Act intent: identity + intent + timestamp + tamper-evidence.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/signatures")]
    public class SignaturesController : ControllerBase
    {
        private readonly ISignatureService _signatures;

        public SignaturesController(ISignatureService signatures)
        {
            _signatures = signatures;
        }

        private int CurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(claim, out var id) ? id : 0;
        }

        private string CurrentUserName() =>
            User.FindFirst("name")?.Value
            ?? User.Identity?.Name
            ?? User.FindFirst(ClaimTypes.Name)?.Value
            ?? "Unknown";

        private string? CurrentUserEmail() =>
            User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;

        /// <summary>Capture a signature against an entity.</summary>
        [HttpPost]
        public async Task<IActionResult> Sign([FromBody] SignDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.EntityType) || dto.EntityId <= 0)
                return BadRequest(new { error = "EntityType and EntityId are required." });

            var sig = await _signatures.SignAsync(new SignatureRequest
            {
                EntityType = dto.EntityType,
                EntityId = dto.EntityId,
                Context = dto.Context,
                SignerUserId = CurrentUserId(),
                SignerName = CurrentUserName(),
                SignerEmail = CurrentUserEmail(),
                SignerRole = dto.SignerRole,
                Action = string.IsNullOrWhiteSpace(dto.Action) ? "Sign" : dto.Action!,
                Comment = dto.Comment,
                Method = string.IsNullOrWhiteSpace(dto.Method) ? "Click" : dto.Method!,
                ReAuthenticated = dto.ReAuthenticated,
                SignatureImage = string.IsNullOrEmpty(dto.SignatureImageBase64)
                    ? null : Convert.FromBase64String(StripDataUrl(dto.SignatureImageBase64)),
                SignatureImageMimeType = dto.SignatureImageMimeType,
                IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
                UserAgent = Request.Headers.UserAgent.ToString(),
                Payload = dto.Payload
            });

            return Ok(new
            {
                sig.Id, sig.EntityType, sig.EntityId, sig.SignerName, sig.SignerRole,
                sig.Action, sig.Method, sig.PayloadHash, sig.ReAuthenticated, sig.SignedAtUtc
            });
        }

        /// <summary>List all signatures for an entity (newest first).</summary>
        [HttpGet("{entityType}/{entityId:int}")]
        public async Task<IActionResult> List(string entityType, int entityId)
        {
            var sigs = await _signatures.GetForEntityAsync(entityType, entityId);
            return Ok(sigs.Select(s => new
            {
                s.Id, s.EntityType, s.EntityId, s.Context, s.SignerName, s.SignerEmail,
                s.SignerRole, s.Action, s.Comment, s.Method, s.ReAuthenticated,
                s.PayloadHash, s.PreviousSignatureId, s.IpAddress, s.SignedAtUtc,
                hasImage = s.SignatureImage != null && s.SignatureImage.Length > 0
            }));
        }

        private static string StripDataUrl(string b64)
        {
            var comma = b64.IndexOf(',');
            return comma >= 0 ? b64[(comma + 1)..] : b64;
        }
    }

    public class SignDto
    {
        public string EntityType { get; set; } = string.Empty;
        public int EntityId { get; set; }
        public string? Context { get; set; }
        public string? SignerRole { get; set; }
        public string? Action { get; set; }
        public string? Comment { get; set; }
        public string? Method { get; set; }
        public bool ReAuthenticated { get; set; }
        public string? SignatureImageBase64 { get; set; }
        public string? SignatureImageMimeType { get; set; }
        public object? Payload { get; set; }
    }
}
