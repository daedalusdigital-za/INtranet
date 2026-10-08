using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// Manages the admin-uploaded images shown in the dashboard slideshow
    /// (the widget that alternates between the Quote of the Day and a rotating
    /// set of images). A maximum of 30 images may be stored.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DashboardImagesController : ControllerBase
    {
        private const int MaxImages = 50;

        // The dashboard widget is roughly a third of the screen; 2000px on the
        // longest side keeps it crisp on large / high-DPI displays while turning
        // 40 MB camera originals into a few hundred KB.
        private const int MaxDimension = 2000;
        private const int JpegQuality = 85;

        private static readonly string[] AllowedTypes =
            { "image/jpeg", "image/png", "image/gif", "image/webp" };

        private readonly ApplicationDbContext _context;
        private readonly ILogger<DashboardImagesController> _logger;

        public DashboardImagesController(ApplicationDbContext context, ILogger<DashboardImagesController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // GET: api/dashboardimages
        // Lightweight list of all images (metadata only, no bytes) for the admin manager.
        [HttpGet]
        public async Task<ActionResult<object>> List()
        {
            var images = await _context.DashboardImages
                .AsNoTracking()
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => new
                {
                    id = i.Id,
                    fileName = i.FileName,
                    contentType = i.ContentType,
                    createdAt = i.CreatedAt,
                    url = $"/api/dashboardimages/{i.Id}"
                })
                .ToListAsync();

            return Ok(new { count = images.Count, max = MaxImages, images });
        }

        // GET: api/dashboardimages/random?count=8
        // Returns the URLs of up to {count} randomly selected images for the slideshow.
        [HttpGet("random")]
        public async Task<ActionResult<object>> Random([FromQuery] int count = 8)
        {
            if (count < 1) count = 1;
            if (count > MaxImages) count = MaxImages;

            var ids = await _context.DashboardImages
                .AsNoTracking()
                .Select(i => i.Id)
                .ToListAsync();

            var selected = ids
                .OrderBy(_ => Guid.NewGuid())
                .Take(count)
                .Select(id => new { id, url = $"/api/dashboardimages/{id}" })
                .ToList();

            return Ok(new { count = selected.Count, images = selected });
        }

        // GET: api/dashboardimages/{id}
        // Serves the raw image bytes. AllowAnonymous so the <img> tag on the
        // dashboard can load it without juggling auth headers.
        [HttpGet("{id}")]
        [AllowAnonymous]
        public async Task<IActionResult> Get(int id)
        {
            var image = await _context.DashboardImages.AsNoTracking()
                .FirstOrDefaultAsync(i => i.Id == id);

            if (image == null || image.Data.Length == 0)
                return NotFound();

            return File(image.Data, image.ContentType);
        }

        // POST: api/dashboardimages  (multipart/form-data, field name: file)
        [HttpPost]
        [Authorize(Roles = "Super Admin,Admin")]
        [RequestSizeLimit(50 * 1024 * 1024)] // 50 MB
        [RequestFormLimits(MultipartBodyLengthLimit = 50 * 1024 * 1024)]
        public async Task<ActionResult<object>> Upload(IFormFile file)
        {
            if (file == null || file.Length == 0)
                return BadRequest(new { message = "No file uploaded" });

            if (!AllowedTypes.Contains(file.ContentType))
                return BadRequest(new { message = "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed." });

            var currentCount = await _context.DashboardImages.CountAsync();
            if (currentCount >= MaxImages)
                return BadRequest(new { message = $"Maximum of {MaxImages} images reached. Delete an image before uploading a new one." });

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            var originalBytes = memoryStream.ToArray();

            // Downscale + re-encode to a web-friendly JPEG so the dashboard loads
            // quickly. Large camera photos (30-45 MB) become a few hundred KB with
            // no visible quality loss at the widget's display size.
            byte[] processedBytes;
            string storedContentType;
            try
            {
                using var image = Image.Load(originalBytes);

                if (image.Width > MaxDimension || image.Height > MaxDimension)
                {
                    image.Mutate(x => x.Resize(new ResizeOptions
                    {
                        Mode = ResizeMode.Max,
                        Size = new Size(MaxDimension, MaxDimension)
                    }));
                }

                using var outStream = new MemoryStream();
                await image.SaveAsJpegAsync(outStream, new JpegEncoder { Quality = JpegQuality });
                processedBytes = outStream.ToArray();
                storedContentType = "image/jpeg";
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to process dashboard image {FileName}; storing original", file.FileName);
                processedBytes = originalBytes;
                storedContentType = file.ContentType;
            }

            int? userId = null;
            var idClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (int.TryParse(idClaim, out var parsed)) userId = parsed;

            var image2 = new DashboardImage
            {
                FileName = Path.GetFileName(file.FileName),
                ContentType = storedContentType,
                Data = processedBytes,
                UploadedByUserId = userId,
                CreatedAt = DateTime.UtcNow
            };

            _context.DashboardImages.Add(image2);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Dashboard image {Id} uploaded by user {UserId} ({OrigKb} KB -> {NewKb} KB)",
                image2.Id, userId, originalBytes.Length / 1024, processedBytes.Length / 1024);

            return Ok(new
            {
                id = image2.Id,
                fileName = image2.FileName,
                contentType = image2.ContentType,
                createdAt = image2.CreatedAt,
                url = $"/api/dashboardimages/{image2.Id}"
            });
        }

        // POST: api/dashboardimages/recompress
        // Re-processes every stored image through the downscale/compress pipeline.
        // Useful after introducing compression to shrink previously-uploaded originals.
        [HttpPost("recompress")]
        [Authorize(Roles = "Super Admin,Admin")]
        public async Task<ActionResult<object>> Recompress()
        {
            var images = await _context.DashboardImages.ToListAsync();
            int processed = 0;
            long savedBytes = 0;

            foreach (var img in images)
            {
                try
                {
                    var before = img.Data.Length;
                    using var image = Image.Load(img.Data);

                    if (image.Width > MaxDimension || image.Height > MaxDimension)
                    {
                        image.Mutate(x => x.Resize(new ResizeOptions
                        {
                            Mode = ResizeMode.Max,
                            Size = new Size(MaxDimension, MaxDimension)
                        }));
                    }

                    using var outStream = new MemoryStream();
                    await image.SaveAsJpegAsync(outStream, new JpegEncoder { Quality = JpegQuality });
                    var newData = outStream.ToArray();

                    if (newData.Length < before)
                    {
                        img.Data = newData;
                        img.ContentType = "image/jpeg";
                        savedBytes += before - newData.Length;
                        processed++;
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to recompress dashboard image {Id}", img.Id);
                }
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Recompressed {Count} dashboard images, saved {Kb} KB", processed, savedBytes / 1024);

            return Ok(new { processed, total = images.Count, savedKb = savedBytes / 1024 });
        }

        // DELETE: api/dashboardimages/{id}
        [HttpDelete("{id}")]
        [Authorize(Roles = "Super Admin,Admin")]
        public async Task<IActionResult> Delete(int id)
        {
            var image = await _context.DashboardImages.FindAsync(id);
            if (image == null)
                return NotFound(new { message = "Image not found" });

            _context.DashboardImages.Remove(image);
            await _context.SaveChangesAsync();

            _logger.LogInformation("Dashboard image {Id} deleted", id);
            return Ok(new { message = "Image deleted" });
        }
    }
}
