using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using System.Text;
using System.Text.Json;

namespace ProjectTracker.API.Services
{
    public interface ILogisticsAIService
    {
        Task<string> GetLoadsContextAsync(string query);
        Task<string> QueryLoadsAsync(string naturalLanguageQuery);
        Task<LoadsQueryResult> SearchLoadsAsync(LoadsSearchParams searchParams);
    }

    public class LoadsSearchParams
    {
        public string? LoadNumber { get; set; }
        public string? DriverName { get; set; }
        public string? CustomerName { get; set; }
        public string? VehicleReg { get; set; }
        public string? Status { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public string? Destination { get; set; }
        public string? CommodityName { get; set; }
        public int Limit { get; set; } = 10;
    }

    public class LoadsQueryResult
    {
        public int TotalCount { get; set; }
        public List<LoadSummaryItem> Loads { get; set; } = new();
        public decimal TotalValue { get; set; }
        public decimal TotalDistance { get; set; }
    }

    public class LoadSummaryItem
    {
        public int Id { get; set; }
        public string LoadNumber { get; set; } = string.Empty;
        public string? DriverName { get; set; }
        public string? VehicleReg { get; set; }
        public string? CustomerName { get; set; }
        public string? Origin { get; set; }
        public string? Destination { get; set; }
        public int StopCount { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime? ScheduledDate { get; set; }
        public decimal? Distance { get; set; }
        public decimal TotalValue { get; set; }
        public List<string> Commodities { get; set; } = new();
    }

    public class LogisticsAIService : ILogisticsAIService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<LogisticsAIService> _logger;

        public LogisticsAIService(
            IServiceScopeFactory scopeFactory,
            ILogger<LogisticsAIService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        /// <summary>
        /// Get formatted context about loads for AI to use
        /// </summary>
        public async Task<string> GetLoadsContextAsync(string query)
        {
            var searchParams = ParseQueryToSearchParams(query);
            var result = await SearchLoadsAsync(searchParams);

            if (result.TotalCount == 0)
            {
                return "No loads found matching the query.";
            }

            var sb = new StringBuilder();
            sb.AppendLine($"## Logistics Data - {result.TotalCount} Load(s) Found\n");
            sb.AppendLine($"**Summary:** Total Value: R{result.TotalValue:N2} | Total Distance: {result.TotalDistance:N0} km\n");

            foreach (var load in result.Loads)
            {
                sb.AppendLine($"### {load.LoadNumber}");
                sb.AppendLine($"- **Status:** {load.Status}");
                sb.AppendLine($"- **Driver:** {load.DriverName ?? "Unassigned"}");
                sb.AppendLine($"- **Vehicle:** {load.VehicleReg ?? "Unassigned"}");
                sb.AppendLine($"- **Customer:** {load.CustomerName ?? "N/A"}");
                sb.AppendLine($"- **Route:** {load.Origin ?? "N/A"} → {load.Destination ?? "N/A"} ({load.StopCount} stops)");
                sb.AppendLine($"- **Date:** {load.ScheduledDate?.ToString("dd MMM yyyy") ?? "Not scheduled"}");
                sb.AppendLine($"- **Distance:** {load.Distance:N0} km");
                sb.AppendLine($"- **Value:** R{load.TotalValue:N2}");
                if (load.Commodities.Any())
                {
                    sb.AppendLine($"- **Commodities:** {string.Join(", ", load.Commodities)}");
                }
                sb.AppendLine();
            }

            return sb.ToString();
        }

        /// <summary>
        /// Parse natural language query into search parameters
        /// </summary>
        private LoadsSearchParams ParseQueryToSearchParams(string query)
        {
            var searchParams = new LoadsSearchParams();
            var lowerQuery = query.ToLower();

            // Check for load number pattern
            var loadMatch = System.Text.RegularExpressions.Regex.Match(query, @"LD-?(\d{6})", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (loadMatch.Success)
            {
                searchParams.LoadNumber = loadMatch.Value.ToUpper();
            }

            // Check for driver name
            if (lowerQuery.Contains("driver") || lowerQuery.Contains("driven by"))
            {
                var driverMatch = System.Text.RegularExpressions.Regex.Match(query, @"(?:driver|driven by)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (driverMatch.Success)
                {
                    searchParams.DriverName = driverMatch.Groups[1].Value.Trim();
                }
            }

            // Check for status
            if (lowerQuery.Contains("pending")) searchParams.Status = "Pending";
            else if (lowerQuery.Contains("in transit") || lowerQuery.Contains("en route")) searchParams.Status = "In Transit";
            else if (lowerQuery.Contains("delivered") || lowerQuery.Contains("completed")) searchParams.Status = "Delivered";
            else if (lowerQuery.Contains("scheduled")) searchParams.Status = "Scheduled";
            else if (lowerQuery.Contains("cancelled")) searchParams.Status = "Cancelled";

            // Check for date ranges
            if (lowerQuery.Contains("today"))
            {
                searchParams.FromDate = DateTime.Today;
                searchParams.ToDate = DateTime.Today.AddDays(1).AddSeconds(-1);
            }
            else if (lowerQuery.Contains("yesterday"))
            {
                searchParams.FromDate = DateTime.Today.AddDays(-1);
                searchParams.ToDate = DateTime.Today.AddSeconds(-1);
            }
            else if (lowerQuery.Contains("this week"))
            {
                var today = DateTime.Today;
                var startOfWeek = today.AddDays(-(int)today.DayOfWeek);
                searchParams.FromDate = startOfWeek;
                searchParams.ToDate = startOfWeek.AddDays(7).AddSeconds(-1);
            }
            else if (lowerQuery.Contains("last week"))
            {
                var today = DateTime.Today;
                var startOfLastWeek = today.AddDays(-(int)today.DayOfWeek - 7);
                searchParams.FromDate = startOfLastWeek;
                searchParams.ToDate = startOfLastWeek.AddDays(7).AddSeconds(-1);
            }
            else if (lowerQuery.Contains("this month"))
            {
                var today = DateTime.Today;
                searchParams.FromDate = new DateTime(today.Year, today.Month, 1);
                searchParams.ToDate = searchParams.FromDate.Value.AddMonths(1).AddSeconds(-1);
            }
            else if (lowerQuery.Contains("last month"))
            {
                var today = DateTime.Today;
                searchParams.FromDate = new DateTime(today.Year, today.Month, 1).AddMonths(-1);
                searchParams.ToDate = new DateTime(today.Year, today.Month, 1).AddSeconds(-1);
            }

            // Check for customer
            var customerMatch = System.Text.RegularExpressions.Regex.Match(query, @"(?:customer|client|for)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (customerMatch.Success && !new[] { "today", "yesterday", "week", "month" }.Any(w => customerMatch.Groups[1].Value.ToLower().Contains(w)))
            {
                searchParams.CustomerName = customerMatch.Groups[1].Value.Trim();
            }

            // Check for destination/location
            var destMatch = System.Text.RegularExpressions.Regex.Match(query, @"(?:to|going to|destination|delivered to)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            if (destMatch.Success)
            {
                searchParams.Destination = destMatch.Groups[1].Value.Trim();
            }

            // Check for commodities
            var commodityKeywords = new[] { "maize", "wheat", "soya", "sunflower", "grain", "fertilizer", "seed", "coal", "cement" };
            foreach (var keyword in commodityKeywords)
            {
                if (lowerQuery.Contains(keyword))
                {
                    searchParams.CommodityName = keyword;
                    break;
                }
            }

            // Set higher limit if asking for "all" or a list
            if (lowerQuery.Contains("all") || lowerQuery.Contains("list"))
            {
                searchParams.Limit = 50;
            }

            return searchParams;
        }

        /// <summary>
        /// Query loads and format response for AI
        /// </summary>
        public async Task<string> QueryLoadsAsync(string naturalLanguageQuery)
        {
            try
            {
                return await GetLoadsContextAsync(naturalLanguageQuery);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to query loads for AI");
                return "Sorry, I couldn't retrieve the logistics data at this time.";
            }
        }

        /// <summary>
        /// Search loads with specific parameters
        /// </summary>
        public async Task<LoadsQueryResult> SearchLoadsAsync(LoadsSearchParams searchParams)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var query = context.Loads
                .Include(l => l.Customer)
                .Include(l => l.Driver)
                .Include(l => l.Vehicle)
                .Include(l => l.Warehouse)
                .Include(l => l.Stops)
                    .ThenInclude(s => s.Commodities)
                        .ThenInclude(c => c.Commodity)
                .AsQueryable();

            // Apply filters
            if (!string.IsNullOrEmpty(searchParams.LoadNumber))
            {
                query = query.Where(l => l.LoadNumber.Contains(searchParams.LoadNumber));
            }
            if (!string.IsNullOrEmpty(searchParams.DriverName))
            {
                var driverName = searchParams.DriverName.ToLower();
                query = query.Where(l => l.Driver != null && 
                    (l.Driver.FirstName.ToLower().Contains(driverName) || 
                     l.Driver.LastName.ToLower().Contains(driverName) ||
                     (l.Driver.FirstName + " " + l.Driver.LastName).ToLower().Contains(driverName)));
            }
            if (!string.IsNullOrEmpty(searchParams.CustomerName))
            {
                var customerName = searchParams.CustomerName.ToLower();
                query = query.Where(l => l.Customer != null && l.Customer.Name.ToLower().Contains(customerName));
            }
            if (!string.IsNullOrEmpty(searchParams.VehicleReg))
            {
                query = query.Where(l => l.Vehicle != null && l.Vehicle.RegistrationNumber.Contains(searchParams.VehicleReg));
            }
            if (!string.IsNullOrEmpty(searchParams.Status))
            {
                query = query.Where(l => l.Status == searchParams.Status);
            }
            if (searchParams.FromDate.HasValue)
            {
                query = query.Where(l => l.ScheduledPickupDate >= searchParams.FromDate.Value);
            }
            if (searchParams.ToDate.HasValue)
            {
                query = query.Where(l => l.ScheduledPickupDate <= searchParams.ToDate.Value);
            }
            if (!string.IsNullOrEmpty(searchParams.Destination))
            {
                var dest = searchParams.Destination.ToLower();
                query = query.Where(l => l.DeliveryLocation != null && l.DeliveryLocation.ToLower().Contains(dest));
            }
            if (!string.IsNullOrEmpty(searchParams.CommodityName))
            {
                var commodity = searchParams.CommodityName.ToLower();
                query = query.Where(l => l.Stops.Any(s => s.Commodities.Any(c => 
                    c.Commodity != null && c.Commodity.Name.ToLower().Contains(commodity))));
            }

            var totalCount = await query.CountAsync();

            var loads = await query
                .OrderByDescending(l => l.ScheduledPickupDate ?? l.CreatedAt)
                .Take(searchParams.Limit)
                .ToListAsync();

            var result = new LoadsQueryResult
            {
                TotalCount = totalCount,
                Loads = loads.Select(l => new LoadSummaryItem
                {
                    Id = l.Id,
                    LoadNumber = l.LoadNumber,
                    DriverName = l.Driver != null ? $"{l.Driver.FirstName} {l.Driver.LastName}" : null,
                    VehicleReg = l.Vehicle?.RegistrationNumber,
                    CustomerName = l.Customer?.Name,
                    Origin = l.Warehouse?.City ?? l.PickupLocation,
                    Destination = l.DeliveryLocation,
                    StopCount = l.Stops.Count,
                    Status = l.Status,
                    ScheduledDate = l.ScheduledPickupDate,
                    Distance = l.EstimatedDistance ?? l.ActualDistance,
                    TotalValue = l.Stops.SelectMany(s => s.Commodities).Sum(c => c.TotalPrice ?? 0),
                    Commodities = l.Stops
                        .SelectMany(s => s.Commodities)
                        .Where(c => c.Commodity != null)
                        .Select(c => c.Commodity!.Name)
                        .Distinct()
                        .ToList()
                }).ToList(),
                TotalValue = loads.Sum(l => l.Stops.SelectMany(s => s.Commodities).Sum(c => c.TotalPrice ?? 0)),
                TotalDistance = loads.Sum(l => l.EstimatedDistance ?? l.ActualDistance ?? 0)
            };

            return result;
        }
    }
}
