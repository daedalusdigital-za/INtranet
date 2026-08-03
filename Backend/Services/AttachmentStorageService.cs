using Microsoft.AspNetCore.StaticFiles;

namespace ProjectTracker.API.Services
{
    /// <summary>
    /// Stores conversation attachments on disk (a mounted volume that acts like
    /// blob storage) instead of as base64 blobs inside SQL Server. Only file
    /// metadata + a relative path is kept in the database.
    ///
    /// Layout:  {AttachmentsRoot}/conversations/{conversationId}/{yyyy}/{MM}/{guid}{ext}
    /// The DB stores the relative path (everything after the root) so the volume
    /// can be relocated without breaking references.
    /// </summary>
    public interface IAttachmentStorageService
    {
        /// <summary>Save a stream to disk and return the relative path stored in the DB.</summary>
        Task<string> SaveAsync(int conversationId, string originalFileName, Stream content, CancellationToken ct = default);

        /// <summary>Open a stored file for reading. Returns null if the file is missing.</summary>
        Stream? OpenRead(string relativePath);

        /// <summary>Delete a stored file (best-effort). Safe to call for missing files.</summary>
        void Delete(string? relativePath);

        /// <summary>Absolute path on disk for a stored relative path.</summary>
        string GetFullPath(string relativePath);

        /// <summary>Best-effort MIME type from a file name.</summary>
        string GetContentType(string fileName);
    }

    public class AttachmentStorageService : IAttachmentStorageService
    {
        private readonly string _root;
        private readonly ILogger<AttachmentStorageService> _logger;
        private static readonly FileExtensionContentTypeProvider ContentTypeProvider = new();

        public AttachmentStorageService(IConfiguration config, ILogger<AttachmentStorageService> logger)
        {
            _logger = logger;
            // Configurable via AttachmentsPath env var; defaults to ./attachments next to the app.
            _root = config["AttachmentsPath"]
                    ?? Path.Combine(AppContext.BaseDirectory, "attachments");
            Directory.CreateDirectory(_root);
        }

        public async Task<string> SaveAsync(int conversationId, string originalFileName, Stream content, CancellationToken ct = default)
        {
            var now = DateTime.UtcNow;
            var ext = Path.GetExtension(originalFileName);
            // Never trust the incoming filename on disk: store as GUID + original extension.
            var safeName = $"{Guid.NewGuid():N}{ext}";

            // Relative path uses forward slashes for portability; stored in DB.
            var relativeDir = $"conversations/{conversationId}/{now:yyyy}/{now:MM}";
            var relativePath = $"{relativeDir}/{safeName}";

            var absDir = Path.Combine(_root, relativeDir.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(absDir);

            var absPath = Path.Combine(absDir, safeName);
            await using (var fs = new FileStream(absPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            {
                await content.CopyToAsync(fs, ct);
            }

            _logger.LogInformation("Saved attachment for conversation {ConversationId} to {Path}", conversationId, relativePath);
            return relativePath;
        }

        public Stream? OpenRead(string relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath)) return null;
            var abs = GetFullPath(relativePath);
            if (!File.Exists(abs)) return null;
            return new FileStream(abs, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, useAsync: true);
        }

        public void Delete(string? relativePath)
        {
            if (string.IsNullOrWhiteSpace(relativePath)) return;
            try
            {
                var abs = GetFullPath(relativePath);
                if (File.Exists(abs)) File.Delete(abs);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete attachment {Path}", relativePath);
            }
        }

        public string GetFullPath(string relativePath)
        {
            // Guard against path traversal: resolve and ensure it stays under the root.
            var normalized = relativePath.Replace('/', Path.DirectorySeparatorChar).TrimStart(Path.DirectorySeparatorChar);
            var full = Path.GetFullPath(Path.Combine(_root, normalized));
            var rootFull = Path.GetFullPath(_root);
            if (!full.StartsWith(rootFull, StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Invalid attachment path.");
            return full;
        }

        public string GetContentType(string fileName)
        {
            return ContentTypeProvider.TryGetContentType(fileName, out var ct)
                ? ct
                : "application/octet-stream";
        }
    }
}
