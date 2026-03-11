using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Services
{
    /// <summary>
    /// Provides data-fetching and creation logic for the AI-driven TripSheet workflow.
    /// Welly queries this service at each step to get real data to present to the user.
    /// </summary>
    public interface ITripSheetWorkflowService
    {
        Task<string> GetWarehousesAsync();
        Task<string> GetPendingInvoicesAsync(int? warehouseId, string? customerFilter, int limit = 50);
        Task<string> GetAvailableDriversAsync();
        Task<string> GetAvailableVehiclesAsync();
        Task<string> GetInvoiceSummaryAsync(List<int> invoiceIds);
        Task<TripSheetCreationResult> CreateTripSheetAsync(
            List<int> invoiceIds,
            int? warehouseId,
            int? driverId,
            int? vehicleId,
            DateTime? scheduledDate,
            string? notes,
            ChatUserContext user);
    }

    public class TripSheetCreationResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string? TripSheetNumber { get; set; }
        public int? TripSheetId { get; set; }
        public int StopCount { get; set; }
        public int InvoiceCount { get; set; }
        public decimal TotalValue { get; set; }
    }

    public class TripSheetWorkflowService : ITripSheetWorkflowService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<TripSheetWorkflowService> _logger;

        public TripSheetWorkflowService(
            IServiceScopeFactory scopeFactory,
            ILogger<TripSheetWorkflowService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        /// <summary>
        /// Get all active warehouses for Welly to present as starting point options
        /// </summary>
        public async Task<string> GetWarehousesAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var warehouses = await db.Warehouses
                .Where(w => w.Status == "Active")
                .OrderBy(w => w.Name)
                .Select(w => new
                {
                    w.Id,
                    w.Name,
                    w.Code,
                    w.City,
                    w.Province,
                    w.ManagerName,
                    PendingInvoices = db.ImportedInvoices.Count(i => i.Status == "Pending" && i.LoadId == null)
                })
                .ToListAsync();

            if (!warehouses.Any())
                return "No active warehouses found.";

            var sb = new StringBuilder();
            sb.AppendLine("**Available Warehouses:**");
            sb.AppendLine("| ID | Name | Code | City | Manager | Pending Invoices |");
            sb.AppendLine("|---|---|---|---|---|---|");
            foreach (var w in warehouses)
            {
                sb.AppendLine($"| {w.Id} | {w.Name} | {w.Code} | {w.City} | {w.ManagerName} | {w.PendingInvoices} |");
            }
            return sb.ToString();
        }

        /// <summary>
        /// Get pending invoices (not yet assigned to any TripSheet), optionally filtered
        /// </summary>
        public async Task<string> GetPendingInvoicesAsync(int? warehouseId, string? customerFilter, int limit = 50)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var query = db.ImportedInvoices
                .Where(i => i.Status == "Pending" && i.LoadId == null)
                .AsQueryable();

            if (!string.IsNullOrEmpty(customerFilter))
                query = query.Where(i => i.CustomerName.Contains(customerFilter));

            // Group by customer to show a summary rather than raw invoice list
            var customerGroups = await query
                .GroupBy(i => new { i.CustomerName, i.CustomerNumber })
                .Select(g => new
                {
                    CustomerName = g.Key.CustomerName,
                    CustomerNumber = g.Key.CustomerNumber,
                    InvoiceCount = g.Count(),
                    TotalValue = g.Sum(i => i.NetSales),
                    InvoiceIds = g.Select(i => i.Id).ToList(),
                    City = g.Select(i => i.DeliveryCity).FirstOrDefault() ?? "Unknown",
                    Province = g.Select(i => i.DeliveryProvince).FirstOrDefault() ?? "Unknown",
                    OldestDate = g.Min(i => i.TransactionDate),
                    InvoiceNumbers = g.Select(i => i.TransactionNumber).ToList()
                })
                .OrderByDescending(g => g.TotalValue)
                .Take(limit)
                .ToListAsync();

            if (!customerGroups.Any())
                return "No pending invoices found" + (string.IsNullOrEmpty(customerFilter) ? "." : $" matching \"{customerFilter}\".");

            var totalInvoices = customerGroups.Sum(g => g.InvoiceCount);
            var totalValue = customerGroups.Sum(g => g.TotalValue);

            var sb = new StringBuilder();
            sb.AppendLine($"**Pending Invoices: {totalInvoices} invoices across {customerGroups.Count} customers (Total: R{totalValue:N2})**");
            sb.AppendLine();
            sb.AppendLine("| # | Customer | City | Province | Invoices | Value | Invoice IDs |");
            sb.AppendLine("|---|---|---|---|---|---|---|");

            int row = 1;
            foreach (var g in customerGroups)
            {
                var idsStr = string.Join(",", g.InvoiceIds);
                sb.AppendLine($"| {row++} | {g.CustomerName} | {g.City} | {g.Province} | {g.InvoiceCount} | R{g.TotalValue:N2} | {idsStr} |");
            }
            return sb.ToString();
        }

        /// <summary>
        /// Get available drivers (Active status) for assignment
        /// </summary>
        public async Task<string> GetAvailableDriversAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var drivers = await db.Drivers
                .Where(d => d.Status == "Active")
                .OrderBy(d => d.FirstName)
                .Select(d => new
                {
                    d.Id,
                    Name = d.FirstName + " " + d.LastName,
                    d.EmployeeNumber,
                    d.LicenseType,
                    d.PhoneNumber,
                    // Count active loads to show availability
                    ActiveLoads = db.Loads.Count(l => l.DriverId == d.Id &&
                        (l.Status == "Active" || l.Status == "In Transit" || l.Status == "Assigned"))
                })
                .ToListAsync();

            if (!drivers.Any())
                return "No active drivers found.";

            var sb = new StringBuilder();
            sb.AppendLine("**Available Drivers:**");
            sb.AppendLine("| ID | Name | Emp# | License | Phone | Active Loads |");
            sb.AppendLine("|---|---|---|---|---|---|");
            foreach (var d in drivers)
            {
                var availability = d.ActiveLoads == 0 ? "✅ Free" : $"⚠️ {d.ActiveLoads} active";
                sb.AppendLine($"| {d.Id} | {d.Name} | {d.EmployeeNumber} | {d.LicenseType} | {d.PhoneNumber} | {availability} |");
            }
            return sb.ToString();
        }

        /// <summary>
        /// Get available vehicles for assignment
        /// </summary>
        public async Task<string> GetAvailableVehiclesAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var vehicles = await db.Vehicles
                .Include(v => v.VehicleType)
                .Where(v => v.Status == "Available" || v.Status == "In Use")
                .OrderBy(v => v.RegistrationNumber)
                .Select(v => new
                {
                    v.Id,
                    v.RegistrationNumber,
                    Type = v.VehicleType != null ? v.VehicleType.Name : "Unknown",
                    v.Make,
                    v.Model,
                    v.Status,
                    v.Province,
                    ActiveLoads = db.Loads.Count(l => l.VehicleId == v.Id &&
                        (l.Status == "Active" || l.Status == "In Transit" || l.Status == "Assigned"))
                })
                .ToListAsync();

            if (!vehicles.Any())
                return "No available vehicles found.";

            var sb = new StringBuilder();
            sb.AppendLine("**Available Vehicles:**");
            sb.AppendLine("| ID | Registration | Type | Make/Model | Province | Status |");
            sb.AppendLine("|---|---|---|---|---|---|");
            foreach (var v in vehicles)
            {
                var availability = v.ActiveLoads == 0 ? "✅ Free" : $"⚠️ {v.ActiveLoads} active";
                sb.AppendLine($"| {v.Id} | {v.RegistrationNumber} | {v.Type} | {v.Make} {v.Model} | {v.Province} | {availability} |");
            }
            return sb.ToString();
        }

        /// <summary>
        /// Summarize specific invoices by IDs — used to confirm selections before creating
        /// </summary>
        public async Task<string> GetInvoiceSummaryAsync(List<int> invoiceIds)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var invoices = await db.ImportedInvoices
                .Where(i => invoiceIds.Contains(i.Id) && i.Status == "Pending" && i.LoadId == null)
                .OrderBy(i => i.CustomerName)
                .ToListAsync();

            if (!invoices.Any())
                return "No valid pending invoices found for the given IDs.";

            var customerGroups = invoices.GroupBy(i => i.CustomerName).ToList();
            var totalValue = invoices.Sum(i => i.NetSales);

            var sb = new StringBuilder();
            sb.AppendLine($"**TripSheet Preview: {invoices.Count} invoices → {customerGroups.Count} delivery stops (Total: R{totalValue:N2})**");
            sb.AppendLine();

            int stopNum = 1;
            foreach (var group in customerGroups)
            {
                var first = group.First();
                var groupValue = group.Sum(i => i.NetSales);
                sb.AppendLine($"**Stop {stopNum++}: {group.Key}**");
                sb.AppendLine($"  📍 {first.DeliveryAddress ?? "No address"}, {first.DeliveryCity ?? ""} {first.DeliveryProvince ?? ""}");
                sb.AppendLine($"  📦 {group.Count()} invoice(s) — R{groupValue:N2}");
                foreach (var inv in group)
                {
                    sb.AppendLine($"  - {inv.TransactionNumber}: {inv.ProductDescription?.Truncate(50) ?? "N/A"} (Qty: {inv.Quantity}, R{inv.NetSales:N2})");
                }
                sb.AppendLine();
            }
            return sb.ToString();
        }

        /// <summary>
        /// Create the TripSheet from collected workflow data — mirrors the controller's CreateFromInvoices logic
        /// </summary>
        public async Task<TripSheetCreationResult> CreateTripSheetAsync(
            List<int> invoiceIds,
            int? warehouseId,
            int? driverId,
            int? vehicleId,
            DateTime? scheduledDate,
            string? notes,
            ChatUserContext user)
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            using var transaction = await db.Database.BeginTransactionAsync();

            try
            {
                // Validate invoices
                var invoices = await db.ImportedInvoices
                    .Where(i => invoiceIds.Contains(i.Id) && i.Status == "Pending" && i.LoadId == null)
                    .ToListAsync();

                if (invoices.Count == 0)
                    return new TripSheetCreationResult { Success = false, Message = "No valid pending invoices found." };

                if (invoices.Count != invoiceIds.Count)
                {
                    var found = invoices.Select(i => i.Id).ToHashSet();
                    var missing = invoiceIds.Where(id => !found.Contains(id)).ToList();
                    return new TripSheetCreationResult
                    {
                        Success = false,
                        Message = $"Some invoices are already assigned or not found. Missing IDs: {string.Join(", ", missing)}"
                    };
                }

                // Get warehouse
                var warehouse = warehouseId.HasValue
                    ? await db.Warehouses.FindAsync(warehouseId.Value)
                    : null;

                // Generate TripSheet number (RF-XXXXXX)
                var lastLoad = await db.Loads.OrderByDescending(l => l.Id).FirstOrDefaultAsync();
                int nextNumber = 1;
                if (lastLoad != null && !string.IsNullOrEmpty(lastLoad.LoadNumber))
                {
                    var num = lastLoad.LoadNumber;
                    if ((num.StartsWith("RF-") || num.StartsWith("LD-")) && num.Length == 9)
                    {
                        if (int.TryParse(num.Substring(3), out int parsed))
                            nextNumber = parsed + 1;
                    }
                    else
                    {
                        nextNumber = lastLoad.Id + 1;
                    }
                }
                var tripSheetNumber = $"RF-{nextNumber:D6}";

                // Create the Load (TripSheet)
                var load = new Load
                {
                    LoadNumber = tripSheetNumber,
                    Status = "Pending",
                    Priority = "Normal",
                    WarehouseId = warehouseId,
                    DriverId = driverId,
                    VehicleId = vehicleId,
                    CreatedByUserId = user.UserId,
                    PickupLocation = warehouse?.Address ?? "",
                    ScheduledPickupDate = scheduledDate ?? DateTime.Today,
                    Notes = $"{notes ?? ""}\n\n[Created via Welly AI on behalf of {user.FullName}]".Trim(),
                    CreatedAt = DateTime.UtcNow
                };

                db.Loads.Add(load);
                await db.SaveChangesAsync();

                // Group invoices by customer → create LoadStops + StopCommodities
                decimal totalValue = 0;
                var customerGroups = invoices.GroupBy(i => i.CustomerName).ToList();
                int stopSequence = 1;

                foreach (var customerGroup in customerGroups)
                {
                    var firstInvoice = customerGroup.First();

                    var stop = new LoadStop
                    {
                        LoadId = load.Id,
                        StopSequence = stopSequence++,
                        StopType = "Delivery",
                        CompanyName = customerGroup.Key,
                        Address = firstInvoice.DeliveryAddress ?? "",
                        City = firstInvoice.DeliveryCity ?? "",
                        Province = firstInvoice.DeliveryProvince ?? "",
                        PostalCode = firstInvoice.DeliveryPostalCode ?? "",
                        ContactPerson = firstInvoice.ContactPerson,
                        ContactPhone = firstInvoice.ContactPhone,
                        ContactEmail = firstInvoice.ContactEmail,
                        Status = "Pending"
                    };

                    db.LoadStops.Add(stop);
                    await db.SaveChangesAsync();

                    foreach (var invoice in customerGroup)
                    {
                        var commodity = new StopCommodity
                        {
                            LoadStopId = stop.Id,
                            Quantity = invoice.Quantity,
                            UnitPrice = invoice.SalesAmount / (invoice.Quantity != 0 ? invoice.Quantity : 1),
                            TotalPrice = invoice.NetSales,
                            InvoiceNumber = invoice.TransactionNumber,
                            Comment = invoice.ProductDescription
                        };
                        db.StopCommodities.Add(commodity);
                        totalValue += invoice.NetSales;

                        invoice.LoadId = load.Id;
                        invoice.Status = "Assigned";
                        invoice.UpdatedAt = DateTime.UtcNow;
                    }
                }

                await db.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "AI TripSheet: Created {TripSheetNumber} with {InvoiceCount} invoices, {StopCount} stops, value R{Value} for {User}",
                    tripSheetNumber, invoices.Count, customerGroups.Count, totalValue, user.FullName);

                return new TripSheetCreationResult
                {
                    Success = true,
                    Message = $"✅ TripSheet **{tripSheetNumber}** created successfully!\n" +
                              $"- **{invoices.Count}** invoices across **{customerGroups.Count}** delivery stops\n" +
                              $"- Total value: **R{totalValue:N2}**\n" +
                              (driverId.HasValue ? $"- Driver assigned\n" : "- ⚠️ No driver assigned yet\n") +
                              (vehicleId.HasValue ? $"- Vehicle assigned\n" : "- ⚠️ No vehicle assigned yet\n") +
                              $"- Scheduled: **{(scheduledDate ?? DateTime.Today):dddd, d MMMM yyyy}**",
                    TripSheetNumber = tripSheetNumber,
                    TripSheetId = load.Id,
                    StopCount = customerGroups.Count,
                    InvoiceCount = invoices.Count,
                    TotalValue = totalValue
                };
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "AI TripSheet creation failed for {User}", user.FullName);
                return new TripSheetCreationResult
                {
                    Success = false,
                    Message = $"Failed to create TripSheet: {ex.Message}"
                };
            }
        }
    }

    // Extension method for string truncation
    public static class StringTruncateExtension
    {
        public static string Truncate(this string value, int maxLength)
        {
            if (string.IsNullOrEmpty(value)) return value;
            return value.Length <= maxLength ? value : value.Substring(0, maxLength) + "…";
        }
    }
}
