using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Serves downloadable desktop client binaries (e.g. the Windows tray notifier).
    /// Files live in the container/app under /app/downloads.
    /// </summary>
    [ApiController]
    [Route("api/download")]
    public class DownloadController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly ILogger<DownloadController> _logger;

        public DownloadController(IConfiguration config, ILogger<DownloadController> logger)
        {
            _config = config;
            _logger = logger;
        }

        private string DownloadsDir => _config["DownloadsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "downloads");

        // GET api/download/notifier  -> downloads the tray app installer/exe
        [HttpGet("notifier")]
        [AllowAnonymous]
        public IActionResult DownloadNotifier()
        {
            var dir = DownloadsDir;
            // Prefer an installer, fall back to the raw exe
            var candidates = new[]
            {
                "IntranetNotifierSetup.exe",
                "IntranetNotifier.exe"
            };

            foreach (var name in candidates)
            {
                var path = Path.Combine(dir, name);
                if (System.IO.File.Exists(path))
                {
                    var bytes = System.IO.File.ReadAllBytes(path);
                    return File(bytes, "application/octet-stream", name);
                }
            }

            _logger.LogWarning("Notifier download requested but no binary found in {Dir}", dir);
            return NotFound(new { message = "The desktop notifier has not been published yet. Please contact IT." });
        }

        // GET api/download/notifier/info  -> whether the download is available + version
        [HttpGet("notifier/info")]
        [AllowAnonymous]
        public IActionResult NotifierInfo()
        {
            var dir = DownloadsDir;
            var candidates = new[] { "IntranetNotifierSetup.exe", "IntranetNotifier.exe" };
            foreach (var name in candidates)
            {
                var path = Path.Combine(dir, name);
                if (System.IO.File.Exists(path))
                {
                    var fi = new FileInfo(path);
                    return Ok(new
                    {
                        available = true,
                        fileName = name,
                        sizeBytes = fi.Length,
                        updatedAt = fi.LastWriteTimeUtc
                    });
                }
            }
            return Ok(new { available = false });
        }
    }
}
