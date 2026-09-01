using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Signatures;

namespace ProjectTracker.API.Services.Signatures
{
    /// <summary>
    /// Reusable electronic-signature service. Any module can capture a signature
    /// against any entity and later verify it hasn't been tampered with.
    /// </summary>
    public interface ISignatureService
    {
        /// <summary>Compute a stable SHA-256 (hex) hash of an arbitrary payload object.</summary>
        string ComputeHash(object payload);

        /// <summary>Capture a signature. If <paramref name="payload"/> is supplied its
        /// hash is stored for tamper-evidence.</summary>
        Task<ElectronicSignature> SignAsync(SignatureRequest request, CancellationToken ct = default);

        /// <summary>All signatures for an entity, newest first.</summary>
        Task<List<ElectronicSignature>> GetForEntityAsync(string entityType, int entityId, CancellationToken ct = default);

        /// <summary>Verify a stored signature's hash still matches the current record state.</summary>
        bool Verify(ElectronicSignature signature, object currentPayload);
    }

    public class SignatureRequest
    {
        public string EntityType { get; set; } = string.Empty;
        public int EntityId { get; set; }
        public string? Context { get; set; }
        public int SignerUserId { get; set; }
        public string SignerName { get; set; } = string.Empty;
        public string? SignerEmail { get; set; }
        public string? SignerRole { get; set; }
        public string Action { get; set; } = "Approve";
        public string? Comment { get; set; }
        public string Method { get; set; } = "Click";
        public bool ReAuthenticated { get; set; }
        public byte[]? SignatureImage { get; set; }
        public string? SignatureImageMimeType { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
        /// <summary>Optional snapshot of the record being signed (hashed for tamper-evidence).</summary>
        public object? Payload { get; set; }
    }

    public class SignatureService : ISignatureService
    {
        private readonly ApplicationDbContext _context;

        public SignatureService(ApplicationDbContext context)
        {
            _context = context;
        }

        public string ComputeHash(object payload)
        {
            // Canonical JSON (property order preserved as declared) → SHA-256 hex.
            var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                WriteIndented = false
            });
            var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(json));
            return Convert.ToHexString(bytes).ToLowerInvariant();
        }

        public async Task<ElectronicSignature> SignAsync(SignatureRequest request, CancellationToken ct = default)
        {
            var latest = await _context.ElectronicSignatures
                .Where(s => s.EntityType == request.EntityType && s.EntityId == request.EntityId)
                .OrderByDescending(s => s.Id)
                .Select(s => (int?)s.Id)
                .FirstOrDefaultAsync(ct);

            var sig = new ElectronicSignature
            {
                EntityType = request.EntityType,
                EntityId = request.EntityId,
                Context = request.Context,
                SignerUserId = request.SignerUserId,
                SignerName = request.SignerName,
                SignerEmail = request.SignerEmail,
                SignerRole = request.SignerRole,
                Action = request.Action,
                Comment = request.Comment,
                Method = request.Method,
                ReAuthenticated = request.ReAuthenticated,
                SignatureImage = request.SignatureImage,
                SignatureImageMimeType = request.SignatureImageMimeType,
                IpAddress = request.IpAddress,
                UserAgent = request.UserAgent,
                PreviousSignatureId = latest,
                PayloadHash = request.Payload != null ? ComputeHash(request.Payload) : null,
                SignedAtUtc = DateTime.UtcNow
            };

            _context.ElectronicSignatures.Add(sig);
            await _context.SaveChangesAsync(ct);
            return sig;
        }

        public async Task<List<ElectronicSignature>> GetForEntityAsync(string entityType, int entityId, CancellationToken ct = default)
        {
            return await _context.ElectronicSignatures
                .Where(s => s.EntityType == entityType && s.EntityId == entityId)
                .OrderByDescending(s => s.SignedAtUtc)
                .ToListAsync(ct);
        }

        public bool Verify(ElectronicSignature signature, object currentPayload)
        {
            if (string.IsNullOrEmpty(signature.PayloadHash)) return false;
            return string.Equals(signature.PayloadHash, ComputeHash(currentPayload), StringComparison.OrdinalIgnoreCase);
        }
    }
}
