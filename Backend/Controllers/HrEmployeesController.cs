using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Hr;

namespace ProjectTracker.API.Controllers
{
    /// <summary>
    /// HR employee directory across ALL sites (Main Office, Security, Condom Factory,
    /// Sanitary Pads, New Road, Cape Town, Bronkhorspruit, Port Elizabeth, Logistics)
    /// with search, view, edit and per-employee document/contract storage.
    /// </summary>
    [ApiController]
    [Route("api/hr-employees")]
    [Authorize]
    public class HrEmployeesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<HrEmployeesController> _logger;
        private readonly string _storagePath;

        private static readonly string[] AllowedExtensions =
            { ".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png", ".xls", ".xlsx", ".txt" };

        public HrEmployeesController(ApplicationDbContext context, ILogger<HrEmployeesController> logger, IConfiguration configuration)
        {
            _context = context;
            _logger = logger;
            var basePath = configuration["DocumentsPath"] ?? Path.Combine(Directory.GetCurrentDirectory(), "uploads");
            _storagePath = Path.Combine(basePath, "HR", "Employees");
            Directory.CreateDirectory(_storagePath);
        }

        private string CurrentUserName() =>
            User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? "HR User";

        private int? CurrentUserId() =>
            int.TryParse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

        // ---- Site list ----------------------------------------------------------
        [HttpGet("sites")]
        public ActionResult<object> GetSites() => Ok(HrSites.All);

        // ---- Department list ----------------------------------------------------
        [HttpGet("departments")]
        public ActionResult<object> GetDepartments() => Ok(HrDepartments.All);

        // ---- List / search ------------------------------------------------------
        // GET: api/hr-employees?search=&site=&status=&employmentType=
        [HttpGet]
        public async Task<ActionResult<object>> GetAll(
            [FromQuery] string? search,
            [FromQuery] string? site,
            [FromQuery] string? status,
            [FromQuery] string? employmentType)
        {
            var q = _context.HrEmployees.AsNoTracking().AsQueryable();

            if (!string.IsNullOrWhiteSpace(site) && site != "All")
                q = q.Where(e => e.Site == site);
            if (!string.IsNullOrWhiteSpace(status) && status != "All")
                q = q.Where(e => e.Status == status);
            if (!string.IsNullOrWhiteSpace(employmentType) && employmentType != "All")
                q = q.Where(e => e.EmploymentType == employmentType);

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                q = q.Where(e =>
                    e.FirstName.ToLower().Contains(s) ||
                    e.LastName.ToLower().Contains(s) ||
                    (e.EmployeeNumber != null && e.EmployeeNumber.ToLower().Contains(s)) ||
                    (e.IdNumber != null && e.IdNumber.ToLower().Contains(s)) ||
                    (e.JobTitle != null && e.JobTitle.ToLower().Contains(s)) ||
                    (e.Department != null && e.Department.ToLower().Contains(s)) ||
                    (e.Email != null && e.Email.ToLower().Contains(s)) ||
                    (e.PhoneNumber != null && e.PhoneNumber.Contains(s)));
            }

            var docCounts = await _context.HrEmployeeDocuments.AsNoTracking()
                .GroupBy(d => d.EmployeeId)
                .Select(g => new { EmployeeId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.EmployeeId, x => x.Count);

            var list = await q
                .OrderBy(e => e.Status == "Active" ? 0 : 1)
                .ThenBy(e => e.LastName).ThenBy(e => e.FirstName)
                .Select(e => new
                {
                    e.Id, e.FirstName, e.LastName, e.EmployeeNumber, e.IdNumber, e.PassportNumber,
                    e.Nationality, e.Site, e.Department, e.JobTitle, e.EmploymentType, e.Status,
                    e.PhoneNumber, e.Email, e.HireDate, e.ContractEndDate, e.Source,
                    e.ProfilePhotoPath, e.BiometricEmpId
                })
                .ToListAsync();

            var result = list.Select(e => new
            {
                e.Id, e.FirstName, e.LastName,
                fullName = $"{e.FirstName} {e.LastName}".Trim(),
                e.EmployeeNumber, e.IdNumber, e.PassportNumber, e.Nationality, e.Site, e.Department,
                e.JobTitle, e.EmploymentType, e.Status, e.PhoneNumber, e.Email, e.HireDate,
                e.ContractEndDate, e.Source,
                hasPhoto = !string.IsNullOrEmpty(e.ProfilePhotoPath) || !string.IsNullOrEmpty(e.BiometricEmpId),
                documentCount = docCounts.TryGetValue(e.Id, out var c) ? c : 0
            });

            return Ok(result);
        }

        // ---- Counts by site (for the directory filter chips) --------------------
        [HttpGet("site-counts")]
        public async Task<ActionResult<object>> GetSiteCounts()
        {
            var counts = await _context.HrEmployees.AsNoTracking()
                .GroupBy(e => e.Site)
                .Select(g => new { site = g.Key, count = g.Count() })
                .ToListAsync();
            var total = counts.Sum(c => c.count);
            return Ok(new { total, bySite = counts });
        }

        // ---- Get one ------------------------------------------------------------
        [HttpGet("{id:int}")]
        public async Task<ActionResult<object>> GetOne(int id)
        {
            var e = await _context.HrEmployees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (e == null) return NotFound();

            var docs = await _context.HrEmployeeDocuments.AsNoTracking()
                .Where(d => d.EmployeeId == id)
                .OrderByDescending(d => d.UploadedAt)
                .Select(d => new
                {
                    d.Id, d.Category, d.Title, d.Description, d.OriginalFileName,
                    d.ContentType, d.FileSize, d.ExpiryDate, d.UploadedAt, d.UploadedByName
                })
                .ToListAsync();

            return Ok(new { employee = e, documents = docs });
        }

        // ---- Create -------------------------------------------------------------
        [HttpPost]
        public async Task<ActionResult<object>> Create([FromBody] HrEmployee dto)
        {
            if (string.IsNullOrWhiteSpace(dto.FirstName) || string.IsNullOrWhiteSpace(dto.LastName))
                return BadRequest(new { error = "First and last name are required." });
            if (string.IsNullOrWhiteSpace(dto.Site))
                return BadRequest(new { error = "Site is required." });

            dto.Id = 0;
            dto.Source = string.IsNullOrWhiteSpace(dto.Source) ? "Manual" : dto.Source;
            dto.CreatedAt = DateTime.UtcNow;
            dto.CreatedByName = CurrentUserName();
            dto.UpdatedAt = null;

            _context.HrEmployees.Add(dto);
            await _context.SaveChangesAsync();
            _logger.LogInformation("HR employee {Id} created by {User}", dto.Id, dto.CreatedByName);
            return Ok(dto);
        }

        // ---- Update -------------------------------------------------------------
        [HttpPut("{id:int}")]
        public async Task<ActionResult<object>> Update(int id, [FromBody] HrEmployee dto)
        {
            var e = await _context.HrEmployees.FirstOrDefaultAsync(x => x.Id == id);
            if (e == null) return NotFound();

            e.FirstName = dto.FirstName;
            e.LastName = dto.LastName;
            e.EmployeeNumber = dto.EmployeeNumber;
            e.IdNumber = dto.IdNumber;
            e.PassportNumber = dto.PassportNumber;
            e.Nationality = dto.Nationality;
            e.Site = string.IsNullOrWhiteSpace(dto.Site) ? e.Site : dto.Site;
            e.Department = dto.Department;
            e.JobTitle = dto.JobTitle;
            e.EmploymentType = string.IsNullOrWhiteSpace(dto.EmploymentType) ? e.EmploymentType : dto.EmploymentType;
            e.Status = string.IsNullOrWhiteSpace(dto.Status) ? e.Status : dto.Status;
            e.PhoneNumber = dto.PhoneNumber;
            e.Email = dto.Email;
            e.Address = dto.Address;
            e.EmergencyContactName = dto.EmergencyContactName;
            e.EmergencyContactPhone = dto.EmergencyContactPhone;
            e.DateOfBirth = dto.DateOfBirth;
            e.HireDate = dto.HireDate;
            e.ContractEndDate = dto.ContractEndDate;
            e.Notes = dto.Notes;
            e.UpdatedAt = DateTime.UtcNow;
            e.UpdatedByName = CurrentUserName();

            await _context.SaveChangesAsync();
            return Ok(e);
        }

        // ---- Delete -------------------------------------------------------------
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var e = await _context.HrEmployees.FirstOrDefaultAsync(x => x.Id == id);
            if (e == null) return NotFound();

            // Remove document files from disk
            var docs = await _context.HrEmployeeDocuments.Where(d => d.EmployeeId == id).ToListAsync();
            foreach (var d in docs)
            {
                try { if (System.IO.File.Exists(d.FilePath)) System.IO.File.Delete(d.FilePath); }
                catch (Exception ex) { _logger.LogWarning(ex, "Could not delete file {Path}", d.FilePath); }
            }

            _context.HrEmployees.Remove(e); // cascade removes documents rows
            await _context.SaveChangesAsync();
            return Ok(new { message = "Employee deleted." });
        }

        // ---- Documents ----------------------------------------------------------
        // POST: api/hr-employees/{id}/documents  (multipart form)
        [HttpPost("{id:int}/documents")]
        [RequestSizeLimit(50_000_000)]
        public async Task<ActionResult<object>> UploadDocument(
            int id, IFormFile file,
            [FromForm] string category, [FromForm] string? title,
            [FromForm] string? description, [FromForm] DateTime? expiryDate)
        {
            var e = await _context.HrEmployees.FirstOrDefaultAsync(x => x.Id == id);
            if (e == null) return NotFound(new { error = "Employee not found." });
            if (file == null || file.Length == 0) return BadRequest(new { error = "No file provided." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (!AllowedExtensions.Contains(ext))
                return BadRequest(new { error = $"File type {ext} not allowed." });

            var empDir = Path.Combine(_storagePath, id.ToString());
            Directory.CreateDirectory(empDir);

            var storedName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid():N}{ext}";
            var fullPath = Path.Combine(empDir, storedName);
            using (var stream = new FileStream(fullPath, FileMode.Create))
                await file.CopyToAsync(stream);

            var doc = new HrEmployeeDocument
            {
                EmployeeId = id,
                Category = string.IsNullOrWhiteSpace(category) ? "Other" : category,
                Title = string.IsNullOrWhiteSpace(title) ? Path.GetFileNameWithoutExtension(file.FileName) : title,
                Description = description,
                FileName = storedName,
                OriginalFileName = file.FileName,
                FilePath = fullPath,
                ContentType = file.ContentType,
                FileSize = file.Length,
                ExpiryDate = expiryDate,
                UploadedAt = DateTime.UtcNow,
                UploadedByUserId = CurrentUserId(),
                UploadedByName = CurrentUserName()
            };
            _context.HrEmployeeDocuments.Add(doc);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                doc.Id, doc.Category, doc.Title, doc.Description, doc.OriginalFileName,
                doc.ContentType, doc.FileSize, doc.ExpiryDate, doc.UploadedAt, doc.UploadedByName
            });
        }

        // GET: api/hr-employees/documents/{docId}/download
        [HttpGet("documents/{docId:int}/download")]
        public async Task<IActionResult> DownloadDocument(int docId)
        {
            var doc = await _context.HrEmployeeDocuments.AsNoTracking().FirstOrDefaultAsync(d => d.Id == docId);
            if (doc == null) return NotFound();
            if (!System.IO.File.Exists(doc.FilePath))
                return NotFound(new { error = "File is missing from storage." });

            var bytes = await System.IO.File.ReadAllBytesAsync(doc.FilePath);
            return File(bytes, doc.ContentType ?? "application/octet-stream", doc.OriginalFileName ?? doc.FileName);
        }

        // DELETE: api/hr-employees/documents/{docId}
        [HttpDelete("documents/{docId:int}")]
        public async Task<IActionResult> DeleteDocument(int docId)
        {
            var doc = await _context.HrEmployeeDocuments.FirstOrDefaultAsync(d => d.Id == docId);
            if (doc == null) return NotFound();

            try { if (System.IO.File.Exists(doc.FilePath)) System.IO.File.Delete(doc.FilePath); }
            catch (Exception ex) { _logger.LogWarning(ex, "Could not delete file {Path}", doc.FilePath); }

            _context.HrEmployeeDocuments.Remove(doc);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Document deleted." });
        }

        // ---- Import / seed from existing sources --------------------------------
        // POST: api/hr-employees/import
        // Populates the registry from the biometric empregistration (Main Office)
        // and logistics Drivers (Logistics). Idempotent — skips already-linked rows.
        [HttpPost("import")]
        public async Task<ActionResult<object>> ImportFromSources()
        {
            var now = DateTime.UtcNow;
            var user = CurrentUserName();
            int importedBiometric = 0, importedDrivers = 0, skipped = 0;

            // Existing links so the import is idempotent
            var existingEmpIds = await _context.HrEmployees.AsNoTracking()
                .Where(e => e.BiometricEmpId != null)
                .Select(e => e.BiometricEmpId!)
                .ToListAsync();
            var existingEmpIdSet = new HashSet<string>(existingEmpIds, StringComparer.OrdinalIgnoreCase);

            var existingDriverIds = await _context.HrEmployees.AsNoTracking()
                .Where(e => e.DriverId != null)
                .Select(e => e.DriverId!.Value)
                .ToListAsync();
            var existingDriverSet = new HashSet<int>(existingDriverIds);

            // 1) Biometric main-office employees
            var bio = await _context.EmpRegistrations.AsNoTracking().ToListAsync();
            foreach (var b in bio)
            {
                if (string.IsNullOrWhiteSpace(b.EmpId) || existingEmpIdSet.Contains(b.EmpId)) { skipped++; continue; }
                _context.HrEmployees.Add(new HrEmployee
                {
                    FirstName = (b.Name ?? "").Trim(),
                    LastName = (b.LastName ?? "").Trim(),
                    EmployeeNumber = b.EmpId,
                    IdNumber = b.IdNum,
                    Site = HrSites.MainOffice,
                    Department = b.Department,
                    JobTitle = b.JobTitle,
                    PhoneNumber = b.MobileNo,
                    Address = b.Address,
                    HireDate = b.Date,
                    EmploymentType = "Permanent",
                    Status = "Active",
                    Source = "Biometric",
                    BiometricEmpId = b.EmpId,
                    CreatedAt = now,
                    CreatedByName = user
                });
                existingEmpIdSet.Add(b.EmpId);
                importedBiometric++;
            }

            // 2) Logistics drivers
            var drivers = await _context.Set<Models.Logistics.Driver>().AsNoTracking().ToListAsync();
            foreach (var d in drivers)
            {
                if (existingDriverSet.Contains(d.Id)) { skipped++; continue; }
                _context.HrEmployees.Add(new HrEmployee
                {
                    FirstName = d.FirstName,
                    LastName = d.LastName,
                    EmployeeNumber = d.EmployeeNumber,
                    IdNumber = d.IdNumber,
                    PassportNumber = d.PassportNumber,
                    Nationality = d.Nationality,
                    Site = HrSites.Logistics,
                    JobTitle = "Driver",
                    Department = "Logistics",
                    PhoneNumber = d.PhoneNumber,
                    Email = d.Email,
                    DateOfBirth = d.DateOfBirth,
                    HireDate = d.HireDate,
                    EmploymentType = "Permanent",
                    Status = d.Status == "Active" ? "Active" : (d.Status ?? "Active"),
                    Source = "Logistics",
                    DriverId = d.Id,
                    CreatedAt = now,
                    CreatedByName = user
                });
                existingDriverSet.Add(d.Id);
                importedDrivers++;
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("HR import: {Bio} biometric, {Drv} drivers, {Skip} skipped",
                importedBiometric, importedDrivers, skipped);

            return Ok(new
            {
                importedBiometric,
                importedDrivers,
                skipped,
                total = await _context.HrEmployees.CountAsync()
            });
        }

        // ---- Profile photo endpoints -------------------------------------------

        /// <summary>GET api/hr-employees/{id}/photo — returns the profile photo image.</summary>
        [HttpGet("{id:int}/photo")]
        [AllowAnonymous] // allow <img src> without auth header
        public async Task<IActionResult> GetPhoto(int id)
        {
            var emp = await _context.HrEmployees.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (emp == null) return NotFound();

            // 1) Stored file on disk
            if (!string.IsNullOrEmpty(emp.ProfilePhotoPath))
            {
                var fullPath = Path.Combine(_storagePath, emp.ProfilePhotoPath);
                if (System.IO.File.Exists(fullPath))
                {
                    var ct = emp.ProfilePhotoPath.EndsWith(".png", StringComparison.OrdinalIgnoreCase)
                        ? "image/png" : "image/jpeg";
                    return PhysicalFile(fullPath, ct);
                }
            }

            // 2) Fall back to biometric photo blob
            if (!string.IsNullOrEmpty(emp.BiometricEmpId))
            {
                var bio = await _context.EmpRegistrations.AsNoTracking()
                    .FirstOrDefaultAsync(b => b.EmpId == emp.BiometricEmpId);
                if (bio?.Photo != null && bio.Photo.Length > 0)
                    return File(bio.Photo, "image/jpeg");
            }

            return NotFound();
        }

        /// <summary>POST api/hr-employees/{id}/photo — upload a new profile photo.</summary>
        [HttpPost("{id:int}/photo")]
        public async Task<ActionResult<object>> UploadPhoto(int id, IFormFile file)
        {
            var emp = await _context.HrEmployees.FirstOrDefaultAsync(x => x.Id == id);
            if (emp == null) return NotFound();

            if (file == null || file.Length == 0)
                return BadRequest(new { error = "No file provided." });

            if (file.Length > 5 * 1024 * 1024)
                return BadRequest(new { error = "Photo must be under 5 MB." });

            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp")
                return BadRequest(new { error = "Only JPG, PNG, or WebP images are allowed." });

            var dir = Path.Combine(_storagePath, id.ToString(), "photos");
            Directory.CreateDirectory(dir);

            // Delete old photo if exists
            if (!string.IsNullOrEmpty(emp.ProfilePhotoPath))
            {
                var oldPath = Path.Combine(_storagePath, emp.ProfilePhotoPath);
                if (System.IO.File.Exists(oldPath)) System.IO.File.Delete(oldPath);
            }

            var fileName = $"profile{ext}";
            var filePath = Path.Combine(dir, fileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
                await file.CopyToAsync(stream);

            emp.ProfilePhotoPath = Path.Combine(id.ToString(), "photos", fileName);
            emp.UpdatedAt = DateTime.UtcNow;
            emp.UpdatedByName = CurrentUserName();
            await _context.SaveChangesAsync();

            return Ok(new { message = "Photo uploaded.", path = emp.ProfilePhotoPath });
        }

        /// <summary>DELETE api/hr-employees/{id}/photo — remove profile photo.</summary>
        [HttpDelete("{id:int}/photo")]
        public async Task<ActionResult<object>> DeletePhoto(int id)
        {
            var emp = await _context.HrEmployees.FirstOrDefaultAsync(x => x.Id == id);
            if (emp == null) return NotFound();

            if (!string.IsNullOrEmpty(emp.ProfilePhotoPath))
            {
                var fullPath = Path.Combine(_storagePath, emp.ProfilePhotoPath);
                if (System.IO.File.Exists(fullPath)) System.IO.File.Delete(fullPath);
            }

            emp.ProfilePhotoPath = null;
            emp.UpdatedAt = DateTime.UtcNow;
            emp.UpdatedByName = CurrentUserName();
            await _context.SaveChangesAsync();

            return Ok(new { message = "Photo removed." });
        }

        /// <summary>POST api/hr-employees/seed-photos — copies biometric photos to disk for linked employees.</summary>
        [HttpPost("seed-photos")]
        public async Task<ActionResult<object>> SeedPhotosFromBiometric()
        {
            var linked = await _context.HrEmployees
                .Where(e => e.BiometricEmpId != null && (e.ProfilePhotoPath == null || e.ProfilePhotoPath == ""))
                .ToListAsync();

            int seeded = 0;
            foreach (var emp in linked)
            {
                var bio = await _context.EmpRegistrations.AsNoTracking()
                    .FirstOrDefaultAsync(b => b.EmpId == emp.BiometricEmpId);
                if (bio?.Photo == null || bio.Photo.Length == 0) continue;

                var dir = Path.Combine(_storagePath, emp.Id.ToString(), "photos");
                Directory.CreateDirectory(dir);
                var filePath = Path.Combine(dir, "profile.jpg");
                await System.IO.File.WriteAllBytesAsync(filePath, bio.Photo);

                emp.ProfilePhotoPath = Path.Combine(emp.Id.ToString(), "photos", "profile.jpg");
                emp.UpdatedAt = DateTime.UtcNow;
                seeded++;
            }

            await _context.SaveChangesAsync();
            _logger.LogInformation("Seeded {Count} profile photos from biometric data", seeded);
            return Ok(new { seeded, total = linked.Count });
        }
    }
}
