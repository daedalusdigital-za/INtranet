using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.StaticFiles;

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
            { "Warehouses", "warehouse2024" },
            { "Private Sales", "sales2024" },
            { "Projects", "projects2024" },
            { "Stock", "stock2024" },
            { "Production", "production2024" },
            { "Marketing", "marketing2024" },
            { "Finance", "finance2024" },
            { "Tender", "tender2024" }
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
            "Warehouses" => "warehouse",
            "Private Sales" => "point_of_sale",
            "Projects" => "engineering",
            "Stock" => "inventory_2",
            "Production" => "precision_manufacturing",
            "Marketing" => "campaign",
            "Finance" => "account_balance",
            "Tender" => "gavel",
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
}
