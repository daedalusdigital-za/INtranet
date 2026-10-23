using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;
using ProjectTracker.API.Security;
using System.Security.Claims;
using System.Collections.Concurrent;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DocumentsController : ControllerBase
    {
        private readonly ILogger<DocumentsController> _logger;
        private readonly string _documentsBasePath;
        private readonly FileExtensionContentTypeProvider _contentTypeProvider;
        private readonly IMemoryCache _cache;
        private readonly Dictionary<string, string> _departmentPasswords;
        private readonly ApplicationDbContext _db;
        private const string DepartmentsCacheKey = "DocumentDepartments";
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

        // Department permissions - which roles can access which departments
        private static readonly Dictionary<string, string[]> DepartmentPermissions = new()
        {
            { "IT", new[] { "Admin", "IT", "Manager" } },
            { "Marketing", new[] { "Admin", "Marketing", "Manager" } },
            { "Tender", new[] { "Admin", "Sales", "Manager" } },
            { "Projects", new[] { "Admin", "Manager", "ProjectManager" } },
            { "Sales", new[] { "Admin", "Sales", "Manager" } },
            { "Call Center", new[] { "Admin", "CallCenter", "Manager" } },
            { "Production", new[] { "Admin", "Production", "Manager" } },
            { "Human Resource", new[] { "Admin", "HR", "Manager" } },
            { "Stock", new[] { "Admin", "Stock", "Warehouse", "Manager" } },
            { "Logistics", new[] { "Admin", "Logistics", "Driver", "Manager" } },
            { "Finance", new[] { "Admin", "Finance", "Manager" } },
            { "Managers", new[] { "Admin", "Manager" } },
            { "Paperless", new[] { "Admin", "Manager", "IT", "Marketing", "Sales", "CallCenter", "Production", "HR", "Stock", "Warehouse", "Logistics", "Driver", "Finance", "ProjectManager" } }
        };

        public DocumentsController(ILogger<DocumentsController> logger, IConfiguration configuration, IMemoryCache cache, ApplicationDbContext db)
        {
            _logger = logger;
            _documentsBasePath = configuration.GetValue<string>("DocumentsPath") ?? "/app/documents";
            _contentTypeProvider = new FileExtensionContentTypeProvider();
            _cache = cache;
            _db = db;

            // Load department passwords from configuration (DocumentPasswords section)
            var depts = new[] { "IT", "Marketing", "Tender", "Projects", "Sales", "Call Center",
                                "Production", "Human Resource", "Stock", "Logistics", "Finance", "Managers", "Paperless" };
            _departmentPasswords = depts.ToDictionary(
                d => d,
                d => configuration[$"DocumentPasswords:{d}"] ?? configuration["DocumentPasswords:Default"] ?? "0000"
            );
        }

        // SECURITY: the department must be one of the known libraries and the resolved
        // path must stay inside it (no "..", absolute paths or sibling-prefix folders).
        private string? ResolveDeptPath(string department, params string?[] parts)
        {
            if (string.IsNullOrEmpty(department) || !_departmentPasswords.ContainsKey(department))
                return null;
            return SafePaths.ResolveUnder(Path.Combine(_documentsBasePath, department), parts);
        }

        private bool IsDeptRoot(string department, string fullPath) =>
            Path.TrimEndingDirectorySeparator(fullPath) ==
            Path.TrimEndingDirectorySeparator(Path.GetFullPath(Path.Combine(_documentsBasePath, department)));

        private BadRequestObjectResult InvalidPath() => BadRequest(new { message = "Invalid file path" });

        // GET: api/documents/departments
        [HttpGet("departments")]
        public ActionResult<IEnumerable<DepartmentInfo>> GetDepartments()
        {
            // Try to get from cache first
            if (_cache.TryGetValue(DepartmentsCacheKey, out List<DepartmentInfo>? cachedDepartments) && cachedDepartments != null)
            {
                _logger.LogDebug("Returning cached department info");
                return Ok(cachedDepartments);
            }

            var departments = new ConcurrentBag<DepartmentInfo>();
            
            // Process departments in parallel for faster loading
            Parallel.ForEach(_departmentPasswords.Keys, new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount }, dept =>
            {
                var deptPath = Path.Combine(_documentsBasePath, dept);
                var documentCount = 0;
                
                try
                {
                    if (Directory.Exists(deptPath))
                    {
                        // Count files with a limit to prevent long waits
                        // Use a fast counting method that stops after reaching a threshold
                        documentCount = CountFilesWithLimit(deptPath, 10000);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Error counting files in department {Department}", dept);
                    // Continue with 0 count if there's an error
                }

                departments.Add(new DepartmentInfo
                {
                    Name = dept,
                    DocumentCount = documentCount,
                    Icon = GetDepartmentIcon(dept)
                });
            });

            // Sort by name and convert to list for caching
            var sortedDepartments = departments.OrderBy(d => d.Name).ToList();

            // Cache the results for longer (10 minutes since counts don't change frequently)
            var cacheOptions = new MemoryCacheEntryOptions()
                .SetAbsoluteExpiration(TimeSpan.FromMinutes(10))
                .SetPriority(CacheItemPriority.High);
            _cache.Set(DepartmentsCacheKey, sortedDepartments, cacheOptions);

            return Ok(sortedDepartments);
        }
        
        // Fast file counting with limit
        private int CountFilesWithLimit(string path, int limit)
        {
            int count = 0;
            try
            {
                foreach (var _ in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
                {
                    count++;
                    if (count >= limit)
                    {
                        return count; // Return early if we hit the limit
                    }
                }
            }
            catch (UnauthorizedAccessException)
            {
                // Skip directories we can't access
            }
            catch (PathTooLongException)
            {
                // Skip paths that are too long
            }
            return count;
        }

        // POST: api/documents/validate-password
        [HttpPost("validate-password")]
        public ActionResult ValidatePassword([FromBody] PasswordValidationRequest request)
        {
            if (string.IsNullOrEmpty(request.Department) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Department and password are required" });
            }

            // Check configured password for this department
            if (_departmentPasswords.TryGetValue(request.Department, out var correctPassword))
            {
                if (request.Password == correctPassword)
                {
                    return Ok(new { success = true, token = GenerateAccessToken(request.Department) });
                }
            }

            return Unauthorized(new { success = false, message = "Invalid password" });
        }

        // GET: api/documents/files/{department}
        [HttpGet("files/{department}")]
        public ActionResult<IEnumerable<DocumentFile>> GetFiles(string department, [FromQuery] string? subfolder = null)
        {
            var deptPath = ResolveDeptPath(department, subfolder);
            if (deptPath == null) return InvalidPath();

            if (!Directory.Exists(deptPath))
            {
                return Ok(new List<DocumentFile>());
            }

            var files = new List<DocumentFile>();

            // Get subdirectories
            foreach (var dir in Directory.GetDirectories(deptPath))
            {
                var dirInfo = new DirectoryInfo(dir);
                files.Add(new DocumentFile
                {
                    Name = dirInfo.Name,
                    Path = GetRelativePath(department, dir),
                    IsFolder = true,
                    Size = 0,
                    LastModified = dirInfo.LastWriteTime,
                    FileType = "folder",
                    Icon = "folder"
                });
            }

            // Get files
            foreach (var file in Directory.GetFiles(deptPath))
            {
                var fileInfo = new FileInfo(file);
                files.Add(new DocumentFile
                {
                    Name = fileInfo.Name,
                    Path = GetRelativePath(department, file),
                    IsFolder = false,
                    Size = fileInfo.Length,
                    LastModified = fileInfo.LastWriteTime,
                    FileType = GetFileType(fileInfo.Extension),
                    Icon = GetFileIcon(fileInfo.Extension)
                });
            }

            return Ok(files.OrderByDescending(f => f.IsFolder).ThenBy(f => f.Name));
        }

        // GET: api/documents/download/{department}/{*filePath}
        [HttpGet("download/{department}/{**filePath}")]
        public IActionResult DownloadFile(string department, string filePath)
        {
            var fullPath = ResolveDeptPath(department, filePath);
            if (fullPath == null) return InvalidPath();

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound(new { message = "File not found" });
            }

            var fileName = Path.GetFileName(fullPath);
            if (!_contentTypeProvider.TryGetContentType(fileName, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            var fileBytes = System.IO.File.ReadAllBytes(fullPath);
            return File(fileBytes, contentType, fileName);
        }

        // POST: api/documents/upload/{department}
        [HttpPost("upload/{department}")]
        public async Task<ActionResult<DocumentFile>> UploadFile(string department, [FromQuery] string? subfolder = null)
        {
            var file = Request.Form.Files.FirstOrDefault();
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { message = "No file provided" });
            }

            var deptPath = ResolveDeptPath(department, subfolder);
            if (deptPath == null) return InvalidPath();

            var safeName = SafePaths.SanitizeFileName(file.FileName);
            if (SafePaths.IsBlockedExtension(safeName))
            {
                return BadRequest(new { message = $"Files of type '{Path.GetExtension(safeName)}' cannot be uploaded." });
            }

            // Ensure directory exists
            Directory.CreateDirectory(deptPath);

            var filePath = Path.Combine(deptPath, safeName);

            // Handle duplicate filenames
            var counter = 1;
            var originalName = Path.GetFileNameWithoutExtension(safeName);
            var extension = Path.GetExtension(safeName);
            while (System.IO.File.Exists(filePath))
            {
                filePath = Path.Combine(deptPath, $"{originalName} ({counter}){extension}");
                counter++;
            }

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            // Invalidate cache after upload
            _cache.Remove(DepartmentsCacheKey);

            var fileInfo = new FileInfo(filePath);
            return Ok(new DocumentFile
            {
                Name = fileInfo.Name,
                Path = GetRelativePath(department, filePath),
                IsFolder = false,
                Size = fileInfo.Length,
                LastModified = fileInfo.LastWriteTime,
                FileType = GetFileType(fileInfo.Extension),
                Icon = GetFileIcon(fileInfo.Extension)
            });
        }

        // POST: api/documents/create-folder/{department}
        [HttpPost("create-folder/{department}")]
        public ActionResult<DocumentFile> CreateFolder(string department, [FromBody] CreateFolderRequest request)
        {
            if (!SafePaths.IsPlainFileName(request.FolderName))
            {
                return BadRequest(new { message = "Invalid folder name" });
            }

            var newFolderPath = ResolveDeptPath(department, request.ParentPath, request.FolderName);
            if (newFolderPath == null) return InvalidPath();

            if (Directory.Exists(newFolderPath))
            {
                return BadRequest(new { message = "Folder already exists" });
            }

            Directory.CreateDirectory(newFolderPath);

            var dirInfo = new DirectoryInfo(newFolderPath);
            return Ok(new DocumentFile
            {
                Name = dirInfo.Name,
                Path = GetRelativePath(department, newFolderPath),
                IsFolder = true,
                Size = 0,
                LastModified = dirInfo.LastWriteTime,
                FileType = "folder",
                Icon = "folder"
            });
        }

        // DELETE: api/documents/delete/{department}/{*filePath}
        [HttpDelete("delete/{department}/{**filePath}")]
        public IActionResult DeleteFile(string department, string filePath)
        {
            var fullPath = ResolveDeptPath(department, filePath);
            if (fullPath == null || IsDeptRoot(department, fullPath)) return InvalidPath();

            if (Directory.Exists(fullPath))
            {
                Directory.Delete(fullPath, true);
                // Invalidate cache after delete
                _cache.Remove(DepartmentsCacheKey);
                return Ok(new { message = "Folder deleted successfully" });
            }
            else if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
                // Invalidate cache after delete
                _cache.Remove(DepartmentsCacheKey);
                return Ok(new { message = "File deleted successfully" });
            }

            return NotFound(new { message = "File or folder not found" });
        }

        // GET: api/documents/search/{department}
        [HttpGet("search/{department}")]
        public ActionResult<IEnumerable<DocumentFile>> SearchFiles(string department, [FromQuery] string query)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return Ok(new List<DocumentFile>());
            }

            var deptPath = ResolveDeptPath(department);
            if (deptPath == null) return InvalidPath();
            if (!Directory.Exists(deptPath))
            {
                return Ok(new List<DocumentFile>());
            }

            // The query becomes a file-system search pattern: keep it to a single name fragment.
            if (query.IndexOfAny(new[] { '/', '\\' }) >= 0 || query.Contains(".."))
            {
                return Ok(new List<DocumentFile>());
            }

            var files = new List<DocumentFile>();
            var searchPattern = $"*{query}*";

            foreach (var file in Directory.GetFiles(deptPath, searchPattern, SearchOption.AllDirectories))
            {
                var fileInfo = new FileInfo(file);
                files.Add(new DocumentFile
                {
                    Name = fileInfo.Name,
                    Path = GetRelativePath(department, file),
                    IsFolder = false,
                    Size = fileInfo.Length,
                    LastModified = fileInfo.LastWriteTime,
                    FileType = GetFileType(fileInfo.Extension),
                    Icon = GetFileIcon(fileInfo.Extension)
                });
            }

            return Ok(files.Take(50)); // Limit results
        }

        // POST: api/documents/move/{department}
        [HttpPost("move/{department}")]
        public IActionResult MoveFile(string department, [FromBody] MoveFileRequest request)
        {
            if (string.IsNullOrEmpty(request.SourcePath) || request.DestinationFolder == null)
            {
                return BadRequest(new { message = "Source path and destination folder are required" });
            }

            var sourcePath = ResolveDeptPath(department, request.SourcePath);
            var destFolder = ResolveDeptPath(department, request.DestinationFolder);
            if (sourcePath == null || destFolder == null || IsDeptRoot(department, sourcePath))
            {
                return InvalidPath();
            }

            // A folder cannot be moved into itself or one of its own subfolders.
            if (SafePaths.IsUnder(sourcePath, destFolder))
            {
                return BadRequest(new { message = "Cannot move a folder into itself" });
            }

            var fileName = Path.GetFileName(sourcePath);
            var destPath = Path.Combine(destFolder, fileName);

            if (!System.IO.File.Exists(sourcePath) && !Directory.Exists(sourcePath))
            {
                return NotFound(new { message = "Source file or folder not found" });
            }

            // Ensure destination folder exists
            Directory.CreateDirectory(destFolder);

            // Handle name conflicts
            var counter = 1;
            var originalName = Path.GetFileNameWithoutExtension(fileName);
            var extension = Path.GetExtension(fileName);
            while (System.IO.File.Exists(destPath) || Directory.Exists(destPath))
            {
                fileName = $"{originalName} ({counter}){extension}";
                destPath = Path.Combine(destFolder, fileName);
                counter++;
            }

            if (Directory.Exists(sourcePath))
            {
                Directory.Move(sourcePath, destPath);
            }
            else
            {
                System.IO.File.Move(sourcePath, destPath);
            }

            return Ok(new { message = "File moved successfully", newPath = GetRelativePath(department, destPath) });
        }

        // POST: api/documents/rename/{department}
        [HttpPost("rename/{department}")]
        public IActionResult RenameFile(string department, [FromBody] RenameFileRequest request)
        {
            if (string.IsNullOrEmpty(request.Path) || string.IsNullOrEmpty(request.NewName))
            {
                return BadRequest(new { message = "Path and new name are required" });
            }

            if (!SafePaths.IsPlainFileName(request.NewName))
            {
                return BadRequest(new { message = "Invalid name" });
            }
            if (SafePaths.IsBlockedExtension(request.NewName))
            {
                return BadRequest(new { message = $"Files of type '{Path.GetExtension(request.NewName)}' are not allowed." });
            }

            var sourcePath = ResolveDeptPath(department, request.Path);
            if (sourcePath == null || IsDeptRoot(department, sourcePath)) return InvalidPath();

            var parentDir = Path.GetDirectoryName(sourcePath)!;
            var destPath = Path.Combine(parentDir, request.NewName);

            if (System.IO.File.Exists(destPath) || Directory.Exists(destPath))
            {
                return BadRequest(new { message = "A file or folder with that name already exists" });
            }

            if (Directory.Exists(sourcePath))
            {
                Directory.Move(sourcePath, destPath);
            }
            else if (System.IO.File.Exists(sourcePath))
            {
                System.IO.File.Move(sourcePath, destPath);
            }
            else
            {
                return NotFound(new { message = "File or folder not found" });
            }

            return Ok(new { message = "Renamed successfully", newPath = GetRelativePath(department, destPath) });
        }

        // GET: api/documents/preview/{department}/{*filePath}
        [HttpGet("preview/{department}/{**filePath}")]
        public IActionResult PreviewFile(string department, string filePath)
        {
            var fullPath = ResolveDeptPath(department, filePath);
            if (fullPath == null) return InvalidPath();

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound(new { message = "File not found" });
            }

            var extension = Path.GetExtension(fullPath).ToLower();
            
            // Get content type
            if (!_contentTypeProvider.TryGetContentType(fullPath, out var contentType))
            {
                contentType = "application/octet-stream";
            }

            // For Office documents, return file for client-side preview
            // For PDF and images, return directly
            var fileBytes = System.IO.File.ReadAllBytes(fullPath);
            
            // SECURITY: only passive types render inline on the API origin; anything else
            // (e.g. an .html/.svg already on the share) is downloaded, never executed.
            if (SafePaths.IsBlockedExtension(fullPath)) contentType = "application/octet-stream";
            var disposition = SafePaths.IsInlineSafe(fullPath) ? "inline" : "attachment";
            Response.Headers["Content-Disposition"] = $"{disposition}; filename=\"{Path.GetFileName(fullPath)}\"";
            Response.Headers["X-Content-Type-Options"] = "nosniff";

            return File(fileBytes, contentType);
        }

        // GET: api/documents/folders/{department}
        [HttpGet("folders/{department}")]
        public ActionResult<IEnumerable<FolderInfo>> GetFolders(string department)
        {
            var deptPath = ResolveDeptPath(department);
            if (deptPath == null) return InvalidPath();
            
            if (!Directory.Exists(deptPath))
            {
                return Ok(new List<FolderInfo> { new FolderInfo { Name = "/", Path = "", FullPath = "" } });
            }

            var folders = new List<FolderInfo>
            {
                new FolderInfo { Name = "/ (Root)", Path = "", FullPath = "" }
            };

            GetFoldersRecursive(deptPath, department, folders, 0);

            return Ok(folders);
        }

        private void GetFoldersRecursive(string path, string department, List<FolderInfo> folders, int depth)
        {
            if (depth > 5) return; // Limit depth

            foreach (var dir in Directory.GetDirectories(path))
            {
                var dirInfo = new DirectoryInfo(dir);
                var relativePath = GetRelativePath(department, dir);
                var indent = new string(' ', (depth + 1) * 2);
                
                folders.Add(new FolderInfo
                {
                    Name = $"{indent}📁 {dirInfo.Name}",
                    Path = relativePath,
                    FullPath = relativePath
                });

                GetFoldersRecursive(dir, department, folders, depth + 1);
            }
        }

        // GET: api/documents/permissions/{department}
        [HttpGet("permissions/{department}")]
        public ActionResult<DocumentPermissions> GetPermissions(string department)
        {
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "User";
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

            var allowedRoles = DepartmentPermissions.GetValueOrDefault(department, new[] { "Admin" });
            var hasAccess = allowedRoles.Contains(userRole) || userRole == "Admin";

            return Ok(new DocumentPermissions
            {
                CanRead = true, // Everyone can read after password
                CanWrite = hasAccess,
                CanDelete = hasAccess || userRole == "Manager",
                CanCreateFolders = hasAccess,
                CanMove = hasAccess,
                UserRole = userRole
            });
        }

        private string GetRelativePath(string department, string fullPath)
        {
            var basePath = Path.Combine(_documentsBasePath, department);
            return Path.GetRelativePath(basePath, fullPath).Replace("\\", "/");
        }

        // ---------------------------------------------------------------------
        // SHARING
        // ---------------------------------------------------------------------

        // GET: api/documents/users  (lightweight list for the share "person" picker)
        [HttpGet("users")]
        public async Task<ActionResult<IEnumerable<ShareUserDto>>> GetShareableUsers([FromQuery] string? search)
        {
            var currentUserId = GetUserId();
            var query = _db.Users.AsQueryable();
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(u => u.Name.Contains(s) || u.Surname.Contains(s) || u.Email.Contains(s));
            }

            var users = await query
                .OrderBy(u => u.Name)
                .Take(50)
                .Select(u => new ShareUserDto
                {
                    UserId = u.UserId,
                    Name = (u.Name + " " + u.Surname).Trim(),
                    Email = u.Email,
                    Role = u.Role
                })
                .ToListAsync();

            // Exclude self from the picker
            users = users.Where(u => u.UserId != currentUserId).ToList();
            return Ok(users);
        }

        // POST: api/documents/share
        [HttpPost("share")]
        public async Task<ActionResult> ShareItem([FromBody] ShareRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.SourceDepartment) || string.IsNullOrWhiteSpace(request.SourcePath))
            {
                return BadRequest(new { message = "Source department and path are required" });
            }

            // Validate the source item actually exists
            var fullPath = ResolveDeptPath(request.SourceDepartment, request.SourcePath);
            if (fullPath == null)
            {
                return BadRequest(new { message = "Invalid source path" });
            }

            var isFolder = Directory.Exists(fullPath);
            if (!isFolder && !System.IO.File.Exists(fullPath))
            {
                return NotFound(new { message = "Source item not found" });
            }

            var itemName = Path.GetFileName(request.SourcePath.TrimEnd('/'));
            var userId = GetUserId();
            var userName = User.FindFirst("name")?.Value
                           ?? User.Identity?.Name
                           ?? User.FindFirst(ClaimTypes.Name)?.Value;

            var shareType = string.Equals(request.ShareWithType, "User", StringComparison.OrdinalIgnoreCase)
                ? "User" : "Department";

            if (shareType == "Department" && string.IsNullOrWhiteSpace(request.ShareWithDepartment))
            {
                return BadRequest(new { message = "Target department is required" });
            }
            if (shareType == "User" && (request.ShareWithUserId == null || request.ShareWithUserId <= 0))
            {
                return BadRequest(new { message = "Target user is required" });
            }

            // Prevent duplicate identical shares
            var exists = await _db.DocumentShares.AnyAsync(s =>
                s.SourceDepartment == request.SourceDepartment &&
                s.SourcePath == request.SourcePath &&
                s.ShareWithType == shareType &&
                s.ShareWithDepartment == request.ShareWithDepartment &&
                s.ShareWithUserId == request.ShareWithUserId);

            if (exists)
            {
                return Ok(new { message = "Item is already shared with that recipient" });
            }

            var share = new DocumentShare
            {
                SourceDepartment = request.SourceDepartment,
                SourcePath = request.SourcePath,
                ItemName = itemName,
                IsFolder = isFolder,
                SharedByUserId = userId,
                SharedByName = userName,
                ShareWithType = shareType,
                ShareWithDepartment = shareType == "Department" ? request.ShareWithDepartment : null,
                ShareWithUserId = shareType == "User" ? request.ShareWithUserId : null,
                Note = request.Note,
                CreatedAt = DateTime.UtcNow
            };

            _db.DocumentShares.Add(share);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Shared successfully", id = share.Id });
        }

        // GET: api/documents/shared-with-me
        [HttpGet("shared-with-me")]
        public async Task<ActionResult<IEnumerable<SharedItemDto>>> GetSharedWithMe()
        {
            var userId = GetUserId();
            var myDept = await GetUserDepartmentNameAsync(userId);

            var shares = await _db.DocumentShares
                .Where(s => (s.ShareWithType == "User" && s.ShareWithUserId == userId)
                         || (s.ShareWithType == "Department" && myDept != null && s.ShareWithDepartment == myDept))
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            var result = shares.Select(MapShare).ToList();
            return Ok(result);
        }

        // GET: api/documents/shared-by-me
        [HttpGet("shared-by-me")]
        public async Task<ActionResult<IEnumerable<SharedItemDto>>> GetSharedByMe()
        {
            var userId = GetUserId();
            var shares = await _db.DocumentShares
                .Where(s => s.SharedByUserId == userId)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();

            return Ok(shares.Select(MapShare).ToList());
        }

        // GET: api/documents/shared/{shareId}/files
        [HttpGet("shared/{shareId}/files")]
        public async Task<ActionResult<IEnumerable<DocumentFile>>> GetSharedFiles(int shareId, [FromQuery] string? subfolder = null)
        {
            var share = await GetAccessibleShare(shareId);
            if (share == null) return Forbid();

            // A shared file (not folder) with no subfolder request: return the single file
            var basePath = ResolveDeptPath(share.SourceDepartment, share.SourcePath);
            if (basePath == null) return BadRequest(new { message = "Invalid path" });
            if (!share.IsFolder)
            {
                if (!System.IO.File.Exists(basePath)) return Ok(new List<DocumentFile>());
                var fi = new FileInfo(basePath);
                return Ok(new List<DocumentFile>
                {
                    new DocumentFile
                    {
                        Name = fi.Name,
                        Path = "",
                        IsFolder = false,
                        Size = fi.Length,
                        LastModified = fi.LastWriteTime,
                        FileType = GetFileType(fi.Extension),
                        Icon = GetFileIcon(fi.Extension)
                    }
                });
            }

            // Security: keep browsing inside the shared folder only
            var targetPath = SafePaths.ResolveUnder(basePath, subfolder);
            if (targetPath == null)
            {
                return BadRequest(new { message = "Invalid path" });
            }

            if (!Directory.Exists(targetPath)) return Ok(new List<DocumentFile>());

            var files = new List<DocumentFile>();
            foreach (var dir in Directory.GetDirectories(targetPath))
            {
                var dirInfo = new DirectoryInfo(dir);
                files.Add(new DocumentFile
                {
                    Name = dirInfo.Name,
                    Path = Path.GetRelativePath(basePath, dir).Replace("\\", "/"),
                    IsFolder = true,
                    Size = 0,
                    LastModified = dirInfo.LastWriteTime,
                    FileType = "folder",
                    Icon = "folder"
                });
            }
            foreach (var file in Directory.GetFiles(targetPath))
            {
                var fileInfo = new FileInfo(file);
                files.Add(new DocumentFile
                {
                    Name = fileInfo.Name,
                    Path = Path.GetRelativePath(basePath, file).Replace("\\", "/"),
                    IsFolder = false,
                    Size = fileInfo.Length,
                    LastModified = fileInfo.LastWriteTime,
                    FileType = GetFileType(fileInfo.Extension),
                    Icon = GetFileIcon(fileInfo.Extension)
                });
            }

            return Ok(files.OrderByDescending(f => f.IsFolder).ThenBy(f => f.Name));
        }

        // GET: api/documents/shared/{shareId}/download?path=
        [HttpGet("shared/{shareId}/download")]
        public async Task<IActionResult> DownloadSharedFile(int shareId, [FromQuery] string? path = null)
        {
            var share = await GetAccessibleShare(shareId);
            if (share == null) return Forbid();

            var fullPath = ResolveSharedPath(share, path);
            if (fullPath == null)
            {
                return BadRequest(new { message = "Invalid path" });
            }

            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound(new { message = "File not found" });
            }

            var fileName = Path.GetFileName(fullPath);
            if (!_contentTypeProvider.TryGetContentType(fileName, out var contentType))
            {
                contentType = "application/octet-stream";
            }
            var fileBytes = System.IO.File.ReadAllBytes(fullPath);
            return File(fileBytes, contentType, fileName);
        }

        // GET: api/documents/shared/{shareId}/preview?path=
        [HttpGet("shared/{shareId}/preview")]
        public async Task<IActionResult> PreviewSharedFile(int shareId, [FromQuery] string? path = null)
        {
            var share = await GetAccessibleShare(shareId);
            if (share == null) return Forbid();

            var fullPath = ResolveSharedPath(share, path);
            if (fullPath == null)
            {
                return BadRequest(new { message = "Invalid path" });
            }
            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound(new { message = "File not found" });
            }

            if (!_contentTypeProvider.TryGetContentType(fullPath, out var contentType))
            {
                contentType = "application/octet-stream";
            }
            if (SafePaths.IsBlockedExtension(fullPath)) contentType = "application/octet-stream";
            var fileBytes = System.IO.File.ReadAllBytes(fullPath);
            var disposition = SafePaths.IsInlineSafe(fullPath) ? "inline" : "attachment";
            Response.Headers["Content-Disposition"] = $"{disposition}; filename=\"{Path.GetFileName(fullPath)}\"";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            return File(fileBytes, contentType);
        }

        // Resolves a file inside a share: the share itself for a shared file, or a path
        // contained within the shared folder.
        private string? ResolveSharedPath(DocumentShare share, string? path)
        {
            var basePath = ResolveDeptPath(share.SourceDepartment, share.SourcePath);
            if (basePath == null) return null;
            return share.IsFolder && !string.IsNullOrEmpty(path)
                ? SafePaths.ResolveUnder(basePath, path)
                : basePath;
        }

        // DELETE: api/documents/share/{id}  (unshare - only sharer or admin)
        [HttpDelete("share/{id}")]
        public async Task<IActionResult> Unshare(int id)
        {
            var share = await _db.DocumentShares.FindAsync(id);
            if (share == null) return NotFound(new { message = "Share not found" });

            var userId = GetUserId();
            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "User";
            if (share.SharedByUserId != userId && role != "Admin")
            {
                return Forbid();
            }

            _db.DocumentShares.Remove(share);
            await _db.SaveChangesAsync();
            return Ok(new { message = "Share removed" });
        }

        // Returns the share if the current user is allowed to access it, else null.
        private async Task<DocumentShare?> GetAccessibleShare(int shareId)
        {
            var share = await _db.DocumentShares.FindAsync(shareId);
            if (share == null) return null;

            var userId = GetUserId();
            var myDept = await GetUserDepartmentNameAsync(userId);
            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "User";

            var allowed = share.SharedByUserId == userId
                          || role == "Admin"
                          || (share.ShareWithType == "User" && share.ShareWithUserId == userId)
                          || (share.ShareWithType == "Department" && myDept != null && share.ShareWithDepartment == myDept);

            return allowed ? share : null;
        }

        // Resolves the document-department name the user belongs to (via Users.DepartmentId -> Departments.Name).
        private async Task<string?> GetUserDepartmentNameAsync(int userId)
        {
            if (userId <= 0) return null;
            return await _db.Users
                .Where(u => u.UserId == userId && u.DepartmentId != null)
                .Select(u => u.Department != null ? u.Department.Name : null)
                .FirstOrDefaultAsync();
        }

        private SharedItemDto MapShare(DocumentShare s) => new SharedItemDto
        {
            Id = s.Id,
            Name = s.ItemName,
            IsFolder = s.IsFolder,
            SourceDepartment = s.SourceDepartment,
            SharedByName = s.SharedByName,
            SharedByUserId = s.SharedByUserId,
            ShareWithType = s.ShareWithType,
            ShareWithDepartment = s.ShareWithDepartment,
            ShareWithUserId = s.ShareWithUserId,
            Note = s.Note,
            CreatedAt = s.CreatedAt,
            FileType = s.IsFolder ? "folder" : GetFileType(Path.GetExtension(s.ItemName)),
            Icon = s.IsFolder ? "folder" : GetFileIcon(Path.GetExtension(s.ItemName))
        };

        private int GetUserId()
        {
            var idStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                        ?? User.FindFirst("sub")?.Value
                        ?? User.FindFirst("userId")?.Value;
            return int.TryParse(idStr, out var id) ? id : 0;
        }


        private string GenerateAccessToken(string department)
        {
            // Simple token generation - in production, use proper JWT
            var timestamp = DateTime.UtcNow.Ticks;
            return Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{department}:{timestamp}"));
        }

        private string GetDepartmentIcon(string department) => department switch
        {
            "IT" => "computer",
            "Marketing" => "campaign",
            "Tender" => "gavel",
            "Projects" => "engineering",
            "Sales" => "point_of_sale",
            "Call Center" => "headset_mic",
            "Production" => "precision_manufacturing",
            "Human Resource" => "people",
            "Stock" => "inventory_2",
            "Logistics" => "local_shipping",
            "Finance" => "account_balance",
            "Managers" => "supervisor_account",
            "Paperless" => "description",
            _ => "folder"
        };

        private string GetFileType(string extension) => extension.ToLower() switch
        {
            ".pdf" => "pdf",
            ".doc" or ".docx" => "word",
            ".xls" or ".xlsx" => "excel",
            ".ppt" or ".pptx" => "powerpoint",
            ".jpg" or ".jpeg" or ".png" or ".gif" or ".bmp" or ".webp" => "image",
            ".mp4" or ".avi" or ".mov" or ".wmv" => "video",
            ".mp3" or ".wav" or ".ogg" => "audio",
            ".zip" or ".rar" or ".7z" => "archive",
            ".txt" => "text",
            ".csv" => "csv",
            _ => "file"
        };

        private string GetFileIcon(string extension) => extension.ToLower() switch
        {
            ".pdf" => "picture_as_pdf",
            ".doc" or ".docx" => "description",
            ".xls" or ".xlsx" => "table_chart",
            ".ppt" or ".pptx" => "slideshow",
            ".jpg" or ".jpeg" or ".png" or ".gif" or ".bmp" or ".webp" => "image",
            ".mp4" or ".avi" or ".mov" or ".wmv" => "video_file",
            ".mp3" or ".wav" or ".ogg" => "audio_file",
            ".zip" or ".rar" or ".7z" => "folder_zip",
            ".txt" => "article",
            ".csv" => "grid_on",
            _ => "insert_drive_file"
        };
    }

    public class DepartmentInfo
    {
        public string Name { get; set; } = string.Empty;
        public int DocumentCount { get; set; }
        public string Icon { get; set; } = "folder";
    }

    public class DocumentFile
    {
        public string Name { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public bool IsFolder { get; set; }
        public long Size { get; set; }
        public DateTime LastModified { get; set; }
        public string FileType { get; set; } = "file";
        public string Icon { get; set; } = "insert_drive_file";
    }

    public class PasswordValidationRequest
    {
        public string Department { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class CreateFolderRequest
    {
        public string FolderName { get; set; } = string.Empty;
        public string? ParentPath { get; set; }
    }

    public class MoveFileRequest
    {
        public string SourcePath { get; set; } = string.Empty;
        public string DestinationFolder { get; set; } = string.Empty;
    }

    public class RenameFileRequest
    {
        public string Path { get; set; } = string.Empty;
        public string NewName { get; set; } = string.Empty;
    }

    public class FolderInfo
    {
        public string Name { get; set; } = string.Empty;
        public string Path { get; set; } = string.Empty;
        public string FullPath { get; set; } = string.Empty;
    }

    public class DocumentPermissions
    {
        public bool CanRead { get; set; }
        public bool CanWrite { get; set; }
        public bool CanDelete { get; set; }
        public bool CanCreateFolders { get; set; }
        public bool CanMove { get; set; }
        public string UserRole { get; set; } = string.Empty;
    }

    public class ShareRequest
    {
        public string SourceDepartment { get; set; } = string.Empty;
        public string SourcePath { get; set; } = string.Empty;
        public string ShareWithType { get; set; } = "Department"; // Department | User
        public string? ShareWithDepartment { get; set; }
        public int? ShareWithUserId { get; set; }
        public string? Note { get; set; }
    }

    public class ShareUserDto
    {
        public int UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    public class SharedItemDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public bool IsFolder { get; set; }
        public string SourceDepartment { get; set; } = string.Empty;
        public string? SharedByName { get; set; }
        public int SharedByUserId { get; set; }
        public string ShareWithType { get; set; } = string.Empty;
        public string? ShareWithDepartment { get; set; }
        public int? ShareWithUserId { get; set; }
        public string? Note { get; set; }
        public DateTime CreatedAt { get; set; }
        public string FileType { get; set; } = "file";
        public string Icon { get; set; } = "insert_drive_file";
    }
}