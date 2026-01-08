using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models;

namespace ProjectTracker.API.Services
{
    public class AzureSyncService : BackgroundService
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<AzureSyncService> _logger;
        private readonly IConfiguration _configuration;
        private readonly TimeSpan _syncInterval = TimeSpan.FromMinutes(5); // Sync every 5 minutes

        public AzureSyncService(
            IServiceProvider serviceProvider,
            ILogger<AzureSyncService> logger,
            IConfiguration configuration)
        {
            _serviceProvider = serviceProvider;
            _logger = logger;
            _configuration = configuration;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Azure Sync Service starting...");

            // Initial sync on startup
            await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken); // Wait for DB to be ready
            await SyncFromAzureAsync();

            // Periodic sync
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(_syncInterval, stoppingToken);
                    await SyncFromAzureAsync();
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error during scheduled Azure sync");
                }
            }

            _logger.LogInformation("Azure Sync Service stopped.");
        }

        public async Task SyncFromAzureAsync()
        {
            var azureConnectionString = _configuration.GetConnectionString("AzureConnection");
            
            if (string.IsNullOrEmpty(azureConnectionString))
            {
                _logger.LogWarning("Azure connection string not configured. Skipping sync.");
                return;
            }

            _logger.LogInformation("Starting sync from Azure database...");

            try
            {
                using var scope = _serviceProvider.CreateScope();
                var localContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

                // Sync employees
                await SyncEmployeesAsync(azureConnectionString, localContext);

                // Sync today's attendance records
                await SyncAttendanceAsync(azureConnectionString, localContext);

                _logger.LogInformation("Azure sync completed successfully.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error syncing from Azure database");
            }
        }

        private async Task SyncEmployeesAsync(string azureConnectionString, ApplicationDbContext localContext)
        {
            var employees = new List<EmpRegistration>();

            using (var connection = new SqlConnection(azureConnectionString))
            {
                await connection.OpenAsync();
                
                using var command = new SqlCommand(@"
                    SELECT EmpId, Name, LastName, Department, JobTitle, MobileNo, Date, Photo 
                    FROM empregistration", connection);
                
                using var reader = await command.ExecuteReaderAsync();
                
                while (await reader.ReadAsync())
                {
                    employees.Add(new EmpRegistration
                    {
                        EmpId = reader.IsDBNull(0) ? "" : reader.GetValue(0).ToString() ?? "",
                        Name = reader.IsDBNull(1) ? null : reader.GetString(1),
                        LastName = reader.IsDBNull(2) ? null : reader.GetString(2),
                        Department = reader.IsDBNull(3) ? null : reader.GetString(3),
                        JobTitle = reader.IsDBNull(4) ? null : reader.GetString(4),
                        MobileNo = reader.IsDBNull(5) ? null : reader.GetString(5),
                        Date = reader.IsDBNull(6) ? null : reader.GetDateTime(6),
                        Photo = reader.IsDBNull(7) ? null : (byte[])reader.GetValue(7)
                    });
                }
            }

            _logger.LogInformation("Fetched {Count} employees from Azure", employees.Count);

            // Upsert employees to local DB
            foreach (var emp in employees)
            {
                var existing = await localContext.EmpRegistrations.FindAsync(emp.EmpId);
                if (existing == null)
                {
                    localContext.EmpRegistrations.Add(emp);
                }
                else
                {
                    existing.Name = emp.Name;
                    existing.LastName = emp.LastName;
                    existing.Department = emp.Department;
                    existing.JobTitle = emp.JobTitle;
                    existing.MobileNo = emp.MobileNo;
                    existing.Date = emp.Date;
                    existing.Photo = emp.Photo;
                }
            }

            await localContext.SaveChangesAsync();
            _logger.LogInformation("Synced {Count} employees to local database", employees.Count);
        }

        private async Task SyncAttendanceAsync(string azureConnectionString, ApplicationDbContext localContext)
        {
            var today = DateTime.UtcNow.Date;

            using (var azureConnection = new SqlConnection(azureConnectionString))
            {
                await azureConnection.OpenAsync();
                
                // Sync last 7 days of attendance
                using var command = new SqlCommand(@"
                    SELECT Id, EmpID, Date, TimeIn, TimeOut, Status 
                    FROM attendance 
                    WHERE Date >= @StartDate", azureConnection);
                
                command.Parameters.AddWithValue("@StartDate", today.AddDays(-7));
                
                using var reader = await command.ExecuteReaderAsync();
                
                var insertCount = 0;
                var updateCount = 0;

                while (await reader.ReadAsync())
                {
                    var id = reader.GetInt32(0);
                    var empId = reader.IsDBNull(1) ? "" : reader.GetValue(1).ToString() ?? "";
                    var date = reader.IsDBNull(2) ? (DateTime?)null : reader.GetDateTime(2);
                    var timeIn = reader.IsDBNull(3) ? (TimeOnly?)null : TimeOnly.FromTimeSpan(reader.GetTimeSpan(3));
                    var timeOut = reader.IsDBNull(4) ? (TimeOnly?)null : TimeOnly.FromTimeSpan(reader.GetTimeSpan(4));
                    var status = reader.IsDBNull(5) ? null : reader.GetString(5);

                    // Use raw SQL to handle identity insert
                    var existing = await localContext.AttendanceRecords.FindAsync(id);
                    if (existing == null)
                    {
                        // Insert with identity insert on
                        await localContext.Database.ExecuteSqlRawAsync(@"
                            SET IDENTITY_INSERT attendance ON;
                            INSERT INTO attendance (Id, empID, Date, TimeIn, TimeOut, Status) 
                            VALUES ({0}, {1}, {2}, {3}, {4}, {5});
                            SET IDENTITY_INSERT attendance OFF;",
                            id, empId, date, timeIn, timeOut, status);
                        insertCount++;
                    }
                    else
                    {
                        existing.EmpID = empId;
                        existing.Date = date;
                        existing.TimeIn = timeIn;
                        existing.TimeOut = timeOut;
                        existing.Status = status;
                        updateCount++;
                    }
                }

                await localContext.SaveChangesAsync();
                _logger.LogInformation("Synced attendance: {InsertCount} inserted, {UpdateCount} updated", insertCount, updateCount);
            }
        }
    }
}
