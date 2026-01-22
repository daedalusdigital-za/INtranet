using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using System.IO.Compression;
using System.Text;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "Admin,Super Admin")]
    public class DatabaseController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DatabaseController> _logger;
        private readonly IWebHostEnvironment _env;

        public DatabaseController(
            ApplicationDbContext context, 
            IConfiguration configuration,
            ILogger<DatabaseController> logger,
            IWebHostEnvironment env)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
            _env = env;
        }

        // GET: api/database/info
        [HttpGet("info")]
        public async Task<ActionResult<DatabaseInfoDto>> GetDatabaseInfo()
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                var builder = new SqlConnectionStringBuilder(connectionString);
                
                var info = new DatabaseInfoDto
                {
                    ServerName = builder.DataSource,
                    DatabaseName = builder.InitialCatalog,
                    LastBackup = null // Will be populated if we track backups
                };

                // Get table counts
                info.TableStats = new List<TableStatDto>();
                
                var tables = new[] { 
                    "Users", "Departments", "Projects", "Boards", "Cards", "Lists",
                    "Announcements", "Messages", "Conversations", "Meetings",
                    "TodoTasks", "Attendance", "PhoneExtensions", "AuditLogs",
                    "Leads", "LeadStatuses", "Dispositions", "OperatingCompanies",
                    "Warehouses", "Loads", "Vehicles", "Customers", "StockOnHandSnapshots"
                };

                foreach (var table in tables)
                {
                    try
                    {
                        var count = await _context.Database
                            .SqlQueryRaw<int>($"SELECT COUNT(*) AS Value FROM [{table}]")
                            .FirstOrDefaultAsync();
                        
                        info.TableStats.Add(new TableStatDto { TableName = table, RowCount = count });
                    }
                    catch
                    {
                        // Table might not exist, skip it
                    }
                }

                // Get database size
                try
                {
                    var sizeQuery = @"
                        SELECT 
                            SUM(size * 8.0 / 1024) AS SizeMB
                        FROM sys.database_files";
                    
                    var size = await _context.Database
                        .SqlQueryRaw<decimal>(sizeQuery)
                        .FirstOrDefaultAsync();
                    
                    info.DatabaseSizeMB = Math.Round(size, 2);
                }
                catch
                {
                    info.DatabaseSizeMB = 0;
                }

                return Ok(info);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting database info");
                return StatusCode(500, new { error = "Failed to get database info" });
            }
        }

        // POST: api/database/export
        [HttpPost("export")]
        public async Task<IActionResult> ExportDatabase([FromBody] ExportRequestDto request)
        {
            try
            {
                _logger.LogInformation("Starting database export for tables: {Tables}", 
                    string.Join(", ", request.Tables ?? new List<string>()));

                var exportData = new Dictionary<string, List<Dictionary<string, object>>>();
                var tablesToExport = request.Tables ?? new List<string>();

                // If no specific tables, export all main tables
                if (!tablesToExport.Any())
                {
                    tablesToExport = new List<string> 
                    { 
                        "Users", "Departments", "Projects", "Boards", "Lists", "Cards",
                        "Announcements", "Messages", "Conversations", "Meetings",
                        "TodoTasks", "PhoneExtensions", "OperatingCompanies",
                        "Leads", "LeadStatuses", "Dispositions", "Warehouses", "Customers"
                    };
                }

                foreach (var table in tablesToExport)
                {
                    try
                    {
                        var data = new List<Dictionary<string, object>>();
                        
                        using var connection = new SqlConnection(_configuration.GetConnectionString("DefaultConnection"));
                        await connection.OpenAsync();
                        
                        using var command = new SqlCommand($"SELECT * FROM [{table}]", connection);
                        using var reader = await command.ExecuteReaderAsync();
                        
                        while (await reader.ReadAsync())
                        {
                            var row = new Dictionary<string, object>();
                            for (int i = 0; i < reader.FieldCount; i++)
                            {
                                var value = reader.GetValue(i);
                                row[reader.GetName(i)] = value == DBNull.Value ? null : value;
                            }
                            data.Add(row);
                        }
                        
                        exportData[table] = data;
                        _logger.LogInformation("Exported {Count} rows from {Table}", data.Count, table);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Could not export table {Table}", table);
                    }
                }

                // Generate filename with timestamp
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var filename = $"database_export_{timestamp}.json";

                // Return as JSON file
                var json = System.Text.Json.JsonSerializer.Serialize(exportData, new System.Text.Json.JsonSerializerOptions 
                { 
                    WriteIndented = true 
                });
                
                var bytes = Encoding.UTF8.GetBytes(json);
                
                return File(bytes, "application/json", filename);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting database");
                return StatusCode(500, new { error = "Failed to export database", details = ex.Message });
            }
        }

        // POST: api/database/backup
        [HttpPost("backup")]
        public async Task<IActionResult> CreateBackup()
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                var builder = new SqlConnectionStringBuilder(connectionString);
                var dbName = builder.InitialCatalog;
                
                // Create backup directory if it doesn't exist
                var backupDir = Path.Combine(_env.ContentRootPath, "Backups");
                Directory.CreateDirectory(backupDir);
                
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var backupFileName = $"{dbName}_backup_{timestamp}.bak";
                var backupPath = Path.Combine(backupDir, backupFileName);

                // For Docker/SQL Server, we need to use the SQL Server's backup location
                var sqlBackupPath = $"/var/opt/mssql/data/{backupFileName}";

                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                var backupQuery = $@"
                    BACKUP DATABASE [{dbName}] 
                    TO DISK = '{sqlBackupPath}'
                    WITH FORMAT, INIT, 
                    NAME = '{dbName} Full Backup',
                    COMPRESSION";

                using var command = new SqlCommand(backupQuery, connection);
                command.CommandTimeout = 300; // 5 minutes timeout
                await command.ExecuteNonQueryAsync();

                _logger.LogInformation("Database backup created: {BackupPath}", sqlBackupPath);

                return Ok(new 
                { 
                    success = true, 
                    message = "Backup created successfully",
                    fileName = backupFileName,
                    path = sqlBackupPath,
                    timestamp = DateTime.Now
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating database backup");
                return StatusCode(500, new { error = "Failed to create backup", details = ex.Message });
            }
        }

        // GET: api/database/backups
        [HttpGet("backups")]
        public async Task<ActionResult<List<BackupInfoDto>>> GetBackups()
        {
            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                var builder = new SqlConnectionStringBuilder(connectionString);
                var dbName = builder.InitialCatalog;

                var backups = new List<BackupInfoDto>();

                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                // Query backup history from SQL Server
                var query = @"
                    SELECT TOP 20
                        bs.backup_start_date,
                        bs.backup_finish_date,
                        bs.backup_size,
                        bs.compressed_backup_size,
                        bmf.physical_device_name,
                        bs.type,
                        bs.server_name,
                        bs.database_name
                    FROM msdb.dbo.backupset bs
                    INNER JOIN msdb.dbo.backupmediafamily bmf ON bs.media_set_id = bmf.media_set_id
                    WHERE bs.database_name = @dbName
                    ORDER BY bs.backup_finish_date DESC";

                using var command = new SqlCommand(query, connection);
                command.Parameters.AddWithValue("@dbName", dbName);
                
                using var reader = await command.ExecuteReaderAsync();
                while (await reader.ReadAsync())
                {
                    backups.Add(new BackupInfoDto
                    {
                        StartDate = reader.GetDateTime(0),
                        FinishDate = reader.GetDateTime(1),
                        SizeBytes = reader.GetInt64(2),
                        CompressedSizeBytes = reader.IsDBNull(3) ? null : reader.GetInt64(3),
                        FilePath = reader.GetString(4),
                        BackupType = reader.GetString(5) switch
                        {
                            "D" => "Full",
                            "I" => "Differential",
                            "L" => "Log",
                            _ => "Unknown"
                        },
                        ServerName = reader.GetString(6),
                        DatabaseName = reader.GetString(7)
                    });
                }

                return Ok(backups);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting backup list");
                return Ok(new List<BackupInfoDto>()); // Return empty list on error
            }
        }

        // POST: api/database/import
        [HttpPost("import")]
        public async Task<IActionResult> ImportData(IFormFile file, [FromQuery] bool clearExisting = false)
        {
            if (file == null || file.Length == 0)
            {
                return BadRequest(new { error = "No file provided" });
            }

            try
            {
                using var stream = new StreamReader(file.OpenReadStream());
                var json = await stream.ReadToEndAsync();
                
                var importData = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, List<Dictionary<string, object>>>>(json);

                if (importData == null || !importData.Any())
                {
                    return BadRequest(new { error = "Invalid import file format" });
                }

                var results = new Dictionary<string, DbImportResultDto>();
                var connectionString = _configuration.GetConnectionString("DefaultConnection");

                foreach (var (table, rows) in importData)
                {
                    var result = new DbImportResultDto { TableName = table };
                    
                    try
                    {
                        using var connection = new SqlConnection(connectionString);
                        await connection.OpenAsync();

                        // Optionally clear existing data
                        if (clearExisting)
                        {
                            using var deleteCmd = new SqlCommand($"DELETE FROM [{table}]", connection);
                            await deleteCmd.ExecuteNonQueryAsync();
                        }

                        // Insert rows
                        foreach (var row in rows)
                        {
                            if (!row.Any()) continue;

                            var columns = string.Join(", ", row.Keys.Select(k => $"[{k}]"));
                            var parameters = string.Join(", ", row.Keys.Select((k, i) => $"@p{i}"));
                            
                            var insertQuery = $"SET IDENTITY_INSERT [{table}] ON; INSERT INTO [{table}] ({columns}) VALUES ({parameters}); SET IDENTITY_INSERT [{table}] OFF;";

                            try
                            {
                                using var insertCmd = new SqlCommand(insertQuery, connection);
                                int i = 0;
                                foreach (var kvp in row)
                                {
                                    insertCmd.Parameters.AddWithValue($"@p{i}", kvp.Value ?? DBNull.Value);
                                    i++;
                                }
                                await insertCmd.ExecuteNonQueryAsync();
                                result.SuccessCount++;
                            }
                            catch (Exception ex)
                            {
                                result.ErrorCount++;
                                result.Errors.Add(ex.Message);
                            }
                        }

                        result.Success = result.ErrorCount == 0;
                    }
                    catch (Exception ex)
                    {
                        result.Success = false;
                        result.Errors.Add($"Table error: {ex.Message}");
                    }

                    results[table] = result;
                }

                return Ok(new 
                { 
                    success = true,
                    message = "Import completed",
                    results = results
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error importing data");
                return StatusCode(500, new { error = "Failed to import data", details = ex.Message });
            }
        }

        // POST: api/database/restore
        [HttpPost("restore")]
        public async Task<IActionResult> RestoreBackup([FromBody] RestoreRequestDto request)
        {
            if (string.IsNullOrEmpty(request.BackupPath))
            {
                return BadRequest(new { error = "Backup path is required" });
            }

            try
            {
                var connectionString = _configuration.GetConnectionString("DefaultConnection");
                var builder = new SqlConnectionStringBuilder(connectionString);
                var dbName = builder.InitialCatalog;

                // Connect to master database for restore
                builder.InitialCatalog = "master";
                
                using var connection = new SqlConnection(builder.ConnectionString);
                await connection.OpenAsync();

                // Set database to single user mode
                var singleUserQuery = $@"
                    ALTER DATABASE [{dbName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE";
                
                using (var cmd = new SqlCommand(singleUserQuery, connection))
                {
                    cmd.CommandTimeout = 60;
                    await cmd.ExecuteNonQueryAsync();
                }

                // Restore the database
                var restoreQuery = $@"
                    RESTORE DATABASE [{dbName}] 
                    FROM DISK = '{request.BackupPath}'
                    WITH REPLACE";

                using (var cmd = new SqlCommand(restoreQuery, connection))
                {
                    cmd.CommandTimeout = 600; // 10 minutes timeout
                    await cmd.ExecuteNonQueryAsync();
                }

                // Set back to multi user mode
                var multiUserQuery = $@"
                    ALTER DATABASE [{dbName}] SET MULTI_USER";
                
                using (var cmd = new SqlCommand(multiUserQuery, connection))
                {
                    await cmd.ExecuteNonQueryAsync();
                }

                _logger.LogInformation("Database restored from: {BackupPath}", request.BackupPath);

                return Ok(new 
                { 
                    success = true, 
                    message = "Database restored successfully",
                    timestamp = DateTime.Now
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring database");
                return StatusCode(500, new { error = "Failed to restore database", details = ex.Message });
            }
        }

        // GET: api/database/export-table/{tableName}
        [HttpGet("export-table/{tableName}")]
        public async Task<IActionResult> ExportTable(string tableName)
        {
            try
            {
                var data = new List<Dictionary<string, object>>();
                
                using var connection = new SqlConnection(_configuration.GetConnectionString("DefaultConnection"));
                await connection.OpenAsync();
                
                using var command = new SqlCommand($"SELECT * FROM [{tableName}]", connection);
                using var reader = await command.ExecuteReaderAsync();
                
                while (await reader.ReadAsync())
                {
                    var row = new Dictionary<string, object>();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        var value = reader.GetValue(i);
                        row[reader.GetName(i)] = value == DBNull.Value ? null : value;
                    }
                    data.Add(row);
                }

                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var filename = $"{tableName}_export_{timestamp}.json";
                
                var json = System.Text.Json.JsonSerializer.Serialize(data, new System.Text.Json.JsonSerializerOptions 
                { 
                    WriteIndented = true 
                });
                
                return File(Encoding.UTF8.GetBytes(json), "application/json", filename);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error exporting table {Table}", tableName);
                return StatusCode(500, new { error = $"Failed to export table {tableName}", details = ex.Message });
            }
        }

        // GET: api/database/tables
        [HttpGet("tables")]
        public async Task<ActionResult<List<string>>> GetTables()
        {
            try
            {
                var tables = new List<string>();
                
                using var connection = new SqlConnection(_configuration.GetConnectionString("DefaultConnection"));
                await connection.OpenAsync();
                
                var query = @"
                    SELECT TABLE_NAME 
                    FROM INFORMATION_SCHEMA.TABLES 
                    WHERE TABLE_TYPE = 'BASE TABLE' 
                    AND TABLE_NAME NOT LIKE '__EF%'
                    ORDER BY TABLE_NAME";
                
                using var command = new SqlCommand(query, connection);
                using var reader = await command.ExecuteReaderAsync();
                
                while (await reader.ReadAsync())
                {
                    tables.Add(reader.GetString(0));
                }

                return Ok(tables);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tables list");
                return StatusCode(500, new { error = "Failed to get tables list" });
            }
        }
    }

    // DTOs
    public class DatabaseInfoDto
    {
        public string ServerName { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
        public decimal DatabaseSizeMB { get; set; }
        public DateTime? LastBackup { get; set; }
        public List<TableStatDto> TableStats { get; set; } = new();
    }

    public class TableStatDto
    {
        public string TableName { get; set; } = string.Empty;
        public int RowCount { get; set; }
    }

    public class BackupInfoDto
    {
        public DateTime StartDate { get; set; }
        public DateTime FinishDate { get; set; }
        public long SizeBytes { get; set; }
        public long? CompressedSizeBytes { get; set; }
        public string FilePath { get; set; } = string.Empty;
        public string BackupType { get; set; } = string.Empty;
        public string ServerName { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
    }

    public class ExportRequestDto
    {
        public List<string>? Tables { get; set; }
    }

    public class RestoreRequestDto
    {
        public string BackupPath { get; set; } = string.Empty;
    }

    public class DbImportResultDto
    {
        public string TableName { get; set; } = string.Empty;
        public bool Success { get; set; }
        public int SuccessCount { get; set; }
        public int ErrorCount { get; set; }
        public List<string> Errors { get; set; } = new();
    }
}
