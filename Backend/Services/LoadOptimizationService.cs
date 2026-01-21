using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;
using ProjectTracker.API.Models.Logistics;

namespace ProjectTracker.API.Services
{
    public class LoadOptimizationService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<LoadOptimizationService> _logger;

        public LoadOptimizationService(ApplicationDbContext context, ILogger<LoadOptimizationService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<List<SuggestedLoadDto>> GenerateSuggestedLoads(int? maxLoads = 10)
        {
            // Get all pending invoices with customer info
            var pendingInvoices = await _context.ImportedInvoices
                .Include(i => i.Customer)
                .Where(i => i.LoadId == null && i.Status == "Pending")
                .OrderBy(i => i.TransactionDate)
                .ToListAsync();

            if (!pendingInvoices.Any())
                return new List<SuggestedLoadDto>();

            var suggestedLoads = new List<SuggestedLoadDto>();

            // Group by Province first (primary grouping)
            var provinceGroups = pendingInvoices
                .GroupBy(i => i.DeliveryProvince ?? i.Customer?.Province ?? "Unknown")
                .OrderByDescending(g => g.Sum(i => i.SalesAmount - i.SalesReturns))
                .ToList();

            int loadSequence = 1;

            foreach (var provinceGroup in provinceGroups)
            {
                // Within province, group by City
                var cityGroups = provinceGroup
                    .GroupBy(i => i.DeliveryCity ?? i.Customer?.City ?? "Unknown")
                    .OrderByDescending(g => g.Sum(i => i.SalesAmount - i.SalesReturns))
                    .ToList();

                foreach (var cityGroup in cityGroups)
                {
                    // Further group by customer within same city for route efficiency
                    var customerGroups = cityGroup
                        .GroupBy(i => new { i.CustomerNumber, i.CustomerName })
                        .ToList();

                    // Create suggested load for this city
                    var invoices = cityGroup.ToList();
                    var totalValue = invoices.Sum(i => i.SalesAmount - i.SalesReturns);
                    var totalItems = invoices.Count;

                    var suggestedLoad = new SuggestedLoadDto
                    {
                        LoadSequence = loadSequence++,
                        SuggestedLoadNumber = $"LD-{DateTime.UtcNow:yyyyMMdd}-{loadSequence:D3}",
                        Province = provinceGroup.Key,
                        PrimaryCity = cityGroup.Key,
                        TotalInvoices = totalItems,
                        TotalValue = totalValue,
                        UniqueCustomers = customerGroups.Count,
                        EstimatedStops = customerGroups.Count,
                        InvoiceIds = invoices.Select(i => i.Id).ToList(),
                        Invoices = invoices.Select(i => new SuggestedLoadInvoiceDto
                        {
                            InvoiceId = i.Id,
                            TransactionNumber = i.TransactionNumber,
                            CustomerName = i.CustomerName,
                            CustomerNumber = i.CustomerNumber,
                            City = i.DeliveryCity ?? i.Customer?.City,
                            Province = i.DeliveryProvince ?? i.Customer?.Province,
                            ProductDescription = i.ProductDescription,
                            Quantity = i.Quantity,
                            Amount = i.SalesAmount - i.SalesReturns,
                            TransactionDate = i.TransactionDate
                        }).ToList(),
                        Customers = customerGroups.Select(cg => new SuggestedLoadCustomerDto
                        {
                            CustomerNumber = cg.Key.CustomerNumber,
                            CustomerName = cg.Key.CustomerName,
                            InvoiceCount = cg.Count(),
                            TotalAmount = cg.Sum(inv => inv.SalesAmount - inv.SalesReturns),
                            City = cg.First().DeliveryCity ?? cg.First().Customer?.City,
                            Address = cg.First().DeliveryAddress ?? cg.First().Customer?.DeliveryAddress
                        }).ToList(),
                        OptimizationScore = CalculateOptimizationScore(customerGroups.Count, totalValue, totalItems),
                        RecommendedVehicleType = DetermineVehicleType(totalItems, totalValue),
                        Priority = DeterminePriority(invoices),
                        Notes = GenerateLoadNotes(provinceGroup.Key, cityGroup.Key, customerGroups.Count, totalItems)
                    };

                    suggestedLoads.Add(suggestedLoad);

                    if (suggestedLoads.Count >= maxLoads)
                        break;
                }

                if (suggestedLoads.Count >= maxLoads)
                    break;
            }

            return suggestedLoads.OrderByDescending(l => l.OptimizationScore).ToList();
        }

        private decimal CalculateOptimizationScore(int customerCount, decimal totalValue, int totalItems)
        {
            // Score based on:
            // - Value per stop (higher is better)
            // - Items per customer (consolidation bonus)
            // - Reasonable number of stops (3-8 is optimal)

            decimal valuePerStop = customerCount > 0 ? totalValue / customerCount : 0;
            decimal itemsPerCustomer = customerCount > 0 ? (decimal)totalItems / customerCount : 0;

            decimal stopOptimality = customerCount switch
            {
                <= 2 => 0.6m,  // Too few stops, inefficient
                3 => 1.0m,
                4 => 1.0m,
                5 => 0.95m,
                6 => 0.9m,
                7 => 0.85m,
                8 => 0.8m,
                _ => 0.6m      // Too many stops, complex route
            };

            // Normalize value (assume R100k is good value per stop)
            decimal normalizedValue = Math.Min(valuePerStop / 100000m, 1.5m);

            // Consolidation bonus (more items per customer = better)
            decimal consolidationScore = Math.Min(itemsPerCustomer / 3m, 1.2m);

            return (normalizedValue * 100) + (stopOptimality * 50) + (consolidationScore * 30);
        }

        private string DetermineVehicleType(int totalItems, decimal totalValue)
        {
            if (totalItems > 50 || totalValue > 500000m)
                return "Large Truck (10+ Ton)";
            else if (totalItems > 20 || totalValue > 200000m)
                return "Medium Truck (5 Ton)";
            else
                return "Light Delivery Vehicle (Bakkie/Van)";
        }

        private string DeterminePriority(List<ImportedInvoice> invoices)
        {
            var totalValue = invoices.Sum(i => i.SalesAmount - i.SalesReturns);
            var oldestInvoice = invoices.Min(i => i.TransactionDate);
            var daysOld = (DateTime.UtcNow - oldestInvoice).Days;

            if (totalValue > 1000000m || daysOld > 7)
                return "Urgent";
            else if (totalValue > 500000m || daysOld > 5)
                return "High";
            else
                return "Normal";
        }

        private string GenerateLoadNotes(string province, string city, int customers, int items)
        {
            return $"Optimized route for {province} - {city} region. " +
                   $"{customers} stop(s) delivering {items} invoice line(s). " +
                   $"Route sequenced for efficiency.";
        }
    }

    // DTOs for suggested loads
    public class SuggestedLoadDto
    {
        public int LoadSequence { get; set; }
        public string SuggestedLoadNumber { get; set; } = string.Empty;
        public string Province { get; set; } = string.Empty;
        public string PrimaryCity { get; set; } = string.Empty;
        public int TotalInvoices { get; set; }
        public decimal TotalValue { get; set; }
        public int UniqueCustomers { get; set; }
        public int EstimatedStops { get; set; }
        public List<int> InvoiceIds { get; set; } = new();
        public List<SuggestedLoadInvoiceDto> Invoices { get; set; } = new();
        public List<SuggestedLoadCustomerDto> Customers { get; set; } = new();
        public decimal OptimizationScore { get; set; }
        public string RecommendedVehicleType { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string Notes { get; set; } = string.Empty;
    }

    public class SuggestedLoadInvoiceDto
    {
        public int InvoiceId { get; set; }
        public string TransactionNumber { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string CustomerNumber { get; set; } = string.Empty;
        public string? City { get; set; }
        public string? Province { get; set; }
        public string ProductDescription { get; set; } = string.Empty;
        public decimal Quantity { get; set; }
        public decimal Amount { get; set; }
        public DateTime TransactionDate { get; set; }
    }

    public class SuggestedLoadCustomerDto
    {
        public string CustomerNumber { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public int InvoiceCount { get; set; }
        public decimal TotalAmount { get; set; }
        public string? City { get; set; }
        public string? Address { get; set; }
    }
}
