using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentsController : ControllerBase
    {
        private readonly ILogger<DocumentsController> _logger;
        private readonly string _documentsBasePath;
        private readonly FileExtensionContentTypeProvider _contentTypeProvider;

        // Department passwords - in production, these should be in database
        private static readonly Dictionary<string, string> DepartmentPasswords = new()
        {
            { "IT", "0000" },
            { "Marketing", "0000" },
            { "Tender", "0000" },
            { "Projects", "0000" },
            { "Sales", "0000" },
            { "Call Center", "0000" },
            { "Production", "0000" },
            { "Human Resource", "0000" },
            { "Stock", "0000" },
            { "Logistics", "0000" },
            { "Finance", "0000" },
            { "Managers", "0000" }
        };

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
            { "Managers", new[] { "Admin", "Manager" } }
        };

        public DocumentsController(ILogger<DocumentsController> logger, IConfiguration configuration)
        {
            _logger = logger;
            _documentsBasePath = configuration.GetValue<string>("DocumentsPath") ?? "/app/documents";
            _contentTypeProvider = new FileExtensionContentTypeProvider();
        }

        // GET: api/documents/departments
        [HttpGet("departments")]
        public ActionResult<IEnumerable<DepartmentInfo>> GetDepartments()
        {
            var departments = new List<DepartmentInfo>();
            
            foreach (var dept in DepartmentPasswords.Keys)
            {
                var deptPath = Path.Combine(_documentsBasePath, dept);
                var documentCount = 0;
                
                if (Directory.Exists(deptPath))
                {
                    documentCount = Directory.GetFiles(deptPath, "*", SearchOption.AllDirectories).Length;
                }

                departments.Add(new DepartmentInfo
                {
                    Name = dept,
                    DocumentCount = documentCount,
                    Icon = GetDepartmentIcon(dept)
                });
            }

            return Ok(departments);
        }

        // POST: api/documents/validate-password
        [HttpPost("validate-password")]
        public ActionResult ValidatePassword([FromBody] PasswordValidationRequest request)
        {
            if (string.IsNullOrEmpty(request.Department) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Department and password are required" });
            }

            // Allow default password "0000" for all departments (for easy access)
            if (request.Password == "0000")
            {
                return Ok(new { success = true, token = GenerateAccessToken(request.Department) });
            }

            if (DepartmentPasswords.TryGetValue(request.Department, out var correctPassword))
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
            var deptPath = Path.Combine(_documentsBasePath, department);
            
            if (!string.IsNullOrEmpty(subfolder))
            {
                deptPath = Path.Combine(deptPath, subfolder);
            }

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
            var fullPath = Path.Combine(_documentsBasePath, department, filePath);
            
            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound(new { message = "File not found" });
            }

            // Security check - ensure path is within documents folder
            var documentsFullPath = Path.GetFullPath(_documentsBasePath);
            var requestedFullPath = Path.GetFullPath(fullPath);
            if (!requestedFullPath.StartsWith(documentsFullPath))
            {
                return BadRequest(new { message = "Invalid file path" });
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

            var deptPath = Path.Combine(_documentsBasePath, department);
            if (!string.IsNullOrEmpty(subfolder))
            {
                deptPath = Path.Combine(deptPath, subfolder);
            }

            // Ensure directory exists
            Directory.CreateDirectory(deptPath);

            var filePath = Path.Combine(deptPath, file.FileName);
            
            // Handle duplicate filenames
            var counter = 1;
            var originalName = Path.GetFileNameWithoutExtension(file.FileName);
            var extension = Path.GetExtension(file.FileName);
            while (System.IO.File.Exists(filePath))
            {
                filePath = Path.Combine(deptPath, $"{originalName} ({counter}){extension}");
                counter++;
            }

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

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
            var basePath = Path.Combine(_documentsBasePath, department);
            if (!string.IsNullOrEmpty(request.ParentPath))
            {
                basePath = Path.Combine(basePath, request.ParentPath);
            }

            var newFolderPath = Path.Combine(basePath, request.FolderName);

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
            var fullPath = Path.Combine(_documentsBasePath, department, filePath);

            // Security check
            var documentsFullPath = Path.GetFullPath(_documentsBasePath);
            var requestedFullPath = Path.GetFullPath(fullPath);
            if (!requestedFullPath.StartsWith(documentsFullPath))
            {
                return BadRequest(new { message = "Invalid file path" });
            }

            if (Directory.Exists(fullPath))
            {
                Directory.Delete(fullPath, true);
                return Ok(new { message = "Folder deleted successfully" });
            }
            else if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
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

            var deptPath = Path.Combine(_documentsBasePath, department);
            if (!Directory.Exists(deptPath))
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

            var sourcePath = Path.Combine(_documentsBasePath, department, request.SourcePath);
            var destFolder = string.IsNullOrEmpty(request.DestinationFolder) 
                ? Path.Combine(_documentsBasePath, department)
                : Path.Combine(_documentsBasePath, department, request.DestinationFolder);
            
            var fileName = Path.GetFileName(sourcePath);
            var destPath = Path.Combine(destFolder, fileName);

            // Security check
            var documentsFullPath = Path.GetFullPath(_documentsBasePath);
            if (!Path.GetFullPath(sourcePath).StartsWith(documentsFullPath) ||
                !Path.GetFullPath(destPath).StartsWith(documentsFullPath))
            {
                return BadRequest(new { message = "Invalid file path" });
            }

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

            var sourcePath = Path.Combine(_documentsBasePath, department, request.Path);
            var parentDir = Path.GetDirectoryName(sourcePath) ?? _documentsBasePath;
            var destPath = Path.Combine(parentDir, request.NewName);

            // Security check
            var documentsFullPath = Path.GetFullPath(_documentsBasePath);
            if (!Path.GetFullPath(sourcePath).StartsWith(documentsFullPath) ||
                !Path.GetFullPath(destPath).StartsWith(documentsFullPath))
            {
                return BadRequest(new { message = "Invalid file path" });
            }

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
            var fullPath = Path.Combine(_documentsBasePath, department, filePath);
            
            if (!System.IO.File.Exists(fullPath))
            {
                return NotFound(new { message = "File not found" });
            }

            // Security check
            var documentsFullPath = Path.GetFullPath(_documentsBasePath);
            var requestedFullPath = Path.GetFullPath(fullPath);
            if (!requestedFullPath.StartsWith(documentsFullPath))
            {
                return BadRequest(new { message = "Invalid file path" });
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
            
            // Set headers for inline display
            Response.Headers["Content-Disposition"] = $"inline; filename=\"{Path.GetFileName(fullPath)}\"";
            
            return File(fileBytes, contentType);
        }

        // GET: api/documents/folders/{department}
        [HttpGet("folders/{department}")]
        public ActionResult<IEnumerable<FolderInfo>> GetFolders(string department)
        {
            var deptPath = Path.Combine(_documentsBasePath, department);
            
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
}
