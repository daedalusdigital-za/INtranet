using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using XstReader;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Read-only browser for archived Outlook PST mailboxes stored on the NAS
    /// (\\192.168.10.76\WorkSpace\Archives, mounted read-only at Archives:Path).
    /// Structure: Archives / {Company} / [subfolders] / *.pst.
    /// Access is gated by a shared Archives password (Archives:Password, default 2630)
    /// supplied in the X-Archive-Password header on every request.
    /// </summary>
    [Authorize]
    [ApiController]
    [Route("api/archives")]
    public class ArchivesController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly ILogger<ArchivesController> _logger;

        // The six companies exposed, mapped to their on-disk folder names.
        private static readonly (string Key, string Label, string Folder)[] Companies = new[]
        {
            ("accessmedical",      "Access Medical",       "ACCESS MEDICAL"),
            ("pharmacare",         "Pharmacare",           "PHARMACARE"),
            ("promedtechnologies", "Promed Technologies",  "PROMED TECHNOLOGIES"),
            ("sawellness",         "SA Wellness",          "SAWELLNESS"),
            ("sebenzanitrading",   "Sebenzani Trading",    "SEBENZANITRADING"),
            ("sharpeyesecurity",   "Sharpeye Security",    "Sharpeye Security"),
        };

        public ArchivesController(IConfiguration config, ILogger<ArchivesController> logger)
        {
            _config = config;
            _logger = logger;
        }

        private string ArchivesRoot => _config["Archives:Path"] ?? "/app/archives";
        private string ArchivePassword => _config["Archives:Password"] ?? "2630";

        private bool PasswordOk()
        {
            var supplied = Request.Headers["X-Archive-Password"].ToString();
            return !string.IsNullOrEmpty(supplied) &&
                   string.Equals(supplied, ArchivePassword, StringComparison.Ordinal);
        }

        // POST: api/archives/unlock  { "password": "2630" }
        [HttpPost("unlock")]
        public IActionResult Unlock([FromBody] UnlockDto dto)
        {
            if (dto?.Password == null || !string.Equals(dto.Password, ArchivePassword, StringComparison.Ordinal))
                return Unauthorized(new { error = "Incorrect archives password." });
            return Ok(new { ok = true });
        }

        // GET: api/archives/companies
        [HttpGet("companies")]
        public IActionResult GetCompanies()
        {
            if (!PasswordOk()) return Unauthorized(new { error = "Archives locked." });

            var result = Companies.Select(c =>
            {
                var path = Path.Combine(ArchivesRoot, c.Folder);
                var exists = Directory.Exists(path);
                int count = 0;
                if (exists)
                {
                    try { count = EnumeratePstFiles(path).Count(); } catch { }
                }
                return new { key = c.Key, label = c.Label, exists, archiveCount = count };
            }).ToList();

            return Ok(result);
        }

        // GET: api/archives/files?company=accessmedical
        [HttpGet("files")]
        public IActionResult GetFiles([FromQuery] string company)
        {
            if (!PasswordOk()) return Unauthorized(new { error = "Archives locked." });

            var folder = ResolveCompanyFolder(company);
            if (folder == null) return NotFound(new { error = "Unknown company." });

            var root = Path.Combine(ArchivesRoot, folder);
            if (!Directory.Exists(root)) return Ok(Array.Empty<object>());

            var files = EnumeratePstFiles(root)
                .Select(f =>
                {
                    var fi = new FileInfo(f);
                    var rel = Path.GetRelativePath(root, f).Replace('\\', '/');
                    return new
                    {
                        name = Path.GetFileName(f),
                        relativePath = rel,
                        sizeBytes = SafeLength(fi),
                        modified = SafeModified(fi)
                    };
                })
                .OrderBy(f => f.relativePath, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return Ok(files);
        }

        // GET: api/archives/folders?company=..&file=rel/path.pst
        [HttpGet("folders")]
        public IActionResult GetFolders([FromQuery] string company, [FromQuery] string file)
        {
            if (!PasswordOk()) return Unauthorized(new { error = "Archives locked." });

            var pstPath = ResolvePstPath(company, file, out var err);
            if (pstPath == null) return BadRequest(new { error = err });

            try
            {
                using var xst = new XstFile(pstPath);
                var tree = xst.RootFolder.Folders.Select(BuildFolderNode).ToList();
                return Ok(tree);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to open PST {Path}", pstPath);
                return StatusCode(500, new { error = "Could not open this archive. It may be corrupt or too large." });
            }
        }

        // GET: api/archives/messages?company=..&file=..&folder=Path&page=1&pageSize=50&search=
        [HttpGet("messages")]
        public IActionResult GetMessages([FromQuery] string company, [FromQuery] string file,
            [FromQuery] string folder, [FromQuery] int page = 1, [FromQuery] int pageSize = 50,
            [FromQuery] string? search = null)
        {
            if (!PasswordOk()) return Unauthorized(new { error = "Archives locked." });

            var pstPath = ResolvePstPath(company, file, out var err);
            if (pstPath == null) return BadRequest(new { error = err });

            if (page < 1) page = 1;
            if (pageSize < 1 || pageSize > 200) pageSize = 50;

            try
            {
                using var xst = new XstFile(pstPath);
                var target = FindFolder(xst.RootFolder.Folders, folder);
                if (target == null) return NotFound(new { error = "Folder not found." });

                var ordered = OrderMessages(target.Messages).ToList();

                if (!string.IsNullOrWhiteSpace(search))
                {
                    var q = search.Trim();
                    ordered = ordered.Where(m =>
                        (m.Subject ?? "").Contains(q, StringComparison.OrdinalIgnoreCase) ||
                        (m.From ?? "").Contains(q, StringComparison.OrdinalIgnoreCase) ||
                        (m.To ?? "").Contains(q, StringComparison.OrdinalIgnoreCase))
                        .ToList();
                }

                var total = ordered.Count;
                var pageItems = ordered.Skip((page - 1) * pageSize).Take(pageSize)
                    .Select((m, i) => new
                    {
                        index = (page - 1) * pageSize + i,
                        subject = string.IsNullOrEmpty(m.Subject) ? "(no subject)" : m.Subject,
                        from = m.From ?? "",
                        to = m.To ?? "",
                        date = m.Date,
                        isRead = m.IsRead,
                        hasAttachments = m.HasAttachments
                    })
                    .ToList();

                return Ok(new
                {
                    total,
                    page,
                    pageSize,
                    totalPages = (int)Math.Ceiling(total / (double)pageSize),
                    items = pageItems
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed reading messages from {Path}", pstPath);
                return StatusCode(500, new { error = "Could not read messages from this archive." });
            }
        }

        // GET: api/archives/message?company=..&file=..&folder=Path&index=N
        [HttpGet("message")]
        public IActionResult GetMessage([FromQuery] string company, [FromQuery] string file,
            [FromQuery] string folder, [FromQuery] int index)
        {
            if (!PasswordOk()) return Unauthorized(new { error = "Archives locked." });

            var pstPath = ResolvePstPath(company, file, out var err);
            if (pstPath == null) return BadRequest(new { error = err });

            try
            {
                using var xst = new XstFile(pstPath);
                var target = FindFolder(xst.RootFolder.Folders, folder);
                if (target == null) return NotFound(new { error = "Folder not found." });

                var ordered = OrderMessages(target.Messages).ToList();
                if (index < 0 || index >= ordered.Count) return NotFound(new { error = "Message not found." });

                var m = ordered[index];
                string? html = null, text = null;
                try
                {
                    var body = m.Body;
                    if (body != null)
                    {
                        var fmt = body.Format.ToString();
                        if (fmt.Contains("Html", StringComparison.OrdinalIgnoreCase)) html = body.Text;
                        else text = body.Text;
                    }
                }
                catch (Exception bex) { _logger.LogWarning(bex, "Body read failed"); }

                var attachments = new List<object>();
                try
                {
                    int ai = 0;
                    foreach (var a in m.Attachments.Where(a => a.IsFile))
                    {
                        attachments.Add(new
                        {
                            attIndex = ai,
                            fileName = a.FileName ?? a.DisplayName ?? "attachment",
                            size = a.Size
                        });
                        ai++;
                    }
                }
                catch { }

                return Ok(new
                {
                    index,
                    subject = string.IsNullOrEmpty(m.Subject) ? "(no subject)" : m.Subject,
                    from = m.From ?? "",
                    to = m.To ?? "",
                    cc = m.Cc ?? "",
                    date = m.Date,
                    htmlBody = html,
                    textBody = text,
                    hasAttachments = m.HasAttachments,
                    attachments
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed reading message from {Path}", pstPath);
                return StatusCode(500, new { error = "Could not read this message." });
            }
        }

        // GET: api/archives/attachment?company=..&file=..&folder=Path&index=N&att=K&pw=2630
        [HttpGet("attachment")]
        public IActionResult GetAttachment([FromQuery] string company, [FromQuery] string file,
            [FromQuery] string folder, [FromQuery] int index, [FromQuery] int att,
            [FromQuery] string? pw = null)
        {
            // Allow password via header OR query param (browser downloads/new tabs can't set headers).
            if (!PasswordOk() && !string.Equals(pw, ArchivePassword, StringComparison.Ordinal))
                return Unauthorized(new { error = "Archives locked." });

            var pstPath = ResolvePstPath(company, file, out var err);
            if (pstPath == null) return BadRequest(new { error = err });

            try
            {
                using var xst = new XstFile(pstPath);
                var target = FindFolder(xst.RootFolder.Folders, folder);
                if (target == null) return NotFound(new { error = "Folder not found." });

                var ordered = OrderMessages(target.Messages).ToList();
                if (index < 0 || index >= ordered.Count) return NotFound(new { error = "Message not found." });

                var fileAtts = ordered[index].Attachments.Where(a => a.IsFile).ToList();
                if (att < 0 || att >= fileAtts.Count) return NotFound(new { error = "Attachment not found." });

                var a = fileAtts[att];
                var name = a.FileName ?? a.DisplayName ?? "attachment";
                var ms = new MemoryStream();
                a.SaveToStream(ms);
                ms.Position = 0;

                var contentType = GetContentType(name);
                return File(ms, contentType, name);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed reading attachment from {Path}", pstPath);
                return StatusCode(500, new { error = "Could not read this attachment." });
            }
        }

        // ── Helpers ──────────────────────────────────────────────────────────

        private static string GetContentType(string fileName)
        {
            var ext = Path.GetExtension(fileName).ToLowerInvariant();
            return ext switch
            {
                ".pdf" => "application/pdf",
                ".png" => "image/png",
                ".jpg" or ".jpeg" => "image/jpeg",
                ".gif" => "image/gif",
                ".bmp" => "image/bmp",
                ".tif" or ".tiff" => "image/tiff",
                ".txt" => "text/plain",
                ".csv" => "text/csv",
                ".html" or ".htm" => "text/html",
                ".xml" => "application/xml",
                ".zip" => "application/zip",
                ".doc" => "application/msword",
                ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xls" => "application/vnd.ms-excel",
                ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".ppt" => "application/vnd.ms-powerpoint",
                ".pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                _ => "application/octet-stream"
            };
        }

        private static IEnumerable<XstMessage> OrderMessages(IEnumerable<XstMessage> messages)
            => messages.OrderByDescending(m => m.Date ?? DateTime.MinValue);

        private object BuildFolderNode(XstFolder f)
        {
            return new
            {
                name = f.DisplayName,
                path = f.Path,
                count = SafeCount(f),
                unread = SafeUnread(f),
                children = f.HasSubFolders ? f.Folders.Select(BuildFolderNode).ToList() : new List<object>()
            };
        }

        private static int SafeCount(XstFolder f) { try { return f.ContentCount; } catch { return 0; } }
        private static int SafeUnread(XstFolder f) { try { return f.ContentUnreadCount; } catch { return 0; } }

        private XstFolder? FindFolder(IEnumerable<XstFolder> folders, string path)
        {
            foreach (var f in folders)
            {
                if (string.Equals(f.Path, path, StringComparison.OrdinalIgnoreCase)) return f;
                if (f.HasSubFolders)
                {
                    var found = FindFolder(f.Folders, path);
                    if (found != null) return found;
                }
            }
            return null;
        }

        /// <summary>Recursively list real .pst files, excluding temp/backup artefacts.</summary>
        private static IEnumerable<string> EnumeratePstFiles(string root)
        {
            return Directory.EnumerateFiles(root, "*.pst", SearchOption.AllDirectories)
                .Where(f =>
                {
                    var name = Path.GetFileName(f);
                    return !name.StartsWith("~") &&
                           !name.EndsWith(".bak", StringComparison.OrdinalIgnoreCase) &&
                           !name.EndsWith(".log", StringComparison.OrdinalIgnoreCase) &&
                           !name.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase);
                });
        }

        private string? ResolveCompanyFolder(string? company)
        {
            if (string.IsNullOrWhiteSpace(company)) return null;
            var match = Companies.FirstOrDefault(c =>
                string.Equals(c.Key, company, StringComparison.OrdinalIgnoreCase));
            return match.Folder;
        }

        /// <summary>Resolve and validate a PST path within the company's folder, blocking traversal.</summary>
        private string? ResolvePstPath(string company, string file, out string error)
        {
            error = "";
            var folder = ResolveCompanyFolder(company);
            if (folder == null) { error = "Unknown company."; return null; }
            if (string.IsNullOrWhiteSpace(file)) { error = "No archive specified."; return null; }

            var companyRoot = Path.GetFullPath(Path.Combine(ArchivesRoot, folder));
            var candidate = Path.GetFullPath(Path.Combine(companyRoot, file));

            // Prevent path traversal outside the company folder.
            if (!candidate.StartsWith(companyRoot, StringComparison.OrdinalIgnoreCase))
            { error = "Invalid archive path."; return null; }
            if (!candidate.EndsWith(".pst", StringComparison.OrdinalIgnoreCase))
            { error = "Not a PST archive."; return null; }
            if (!System.IO.File.Exists(candidate))
            { error = "Archive not found."; return null; }

            return candidate;
        }

        private static long SafeLength(FileInfo fi) { try { return fi.Length; } catch { return 0; } }
        private static DateTime? SafeModified(FileInfo fi) { try { return fi.LastWriteTimeUtc; } catch { return null; } }

        public class UnlockDto { public string? Password { get; set; } }
    }
}
