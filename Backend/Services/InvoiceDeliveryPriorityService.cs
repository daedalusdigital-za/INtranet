using Microsoft.EntityFrameworkCore;
using ProjectTracker.API.Data;

namespace ProjectTracker.API.Services
{
    /// <summary>
    /// Service that manages delivery priority escalation for imported invoices.
    /// 
    /// Business Rule: Deliveries must happen within 7-14 days of invoice capture.
    /// The longer an invoice sits in the system, the higher its priority escalates.
    /// 
    /// Priority Tiers (based on days since ImportedAt):
    ///   0-3 days  → Low      (just imported, normal queue)
    ///   4-6 days  → Normal   (approaching delivery window)
    ///   7-10 days → High     (within delivery window, needs attention)
    ///   11-13 days→ Urgent   (nearing deadline, must be dispatched)
    ///   14+ days  → Critical (overdue, immediate action required)
    /// </summary>
    public class InvoiceDeliveryPriorityService
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<InvoiceDeliveryPriorityService> _logger;

        // Priority weight map for comparisons (higher = more urgent)
        public static readonly Dictionary<string, int> PriorityWeights = new()
        {
            { "Low", 1 },
            { "Normal", 2 },
            { "High", 3 },
            { "Urgent", 4 },
            { "Critical", 5 },
            { "Completed", 0 }
        };

        // Delivery deadline in days from import
        public const int DeliveryDeadlineDays = 14;
        // Minimum delivery window start
        public const int DeliveryWindowStartDays = 7;

        public InvoiceDeliveryPriorityService(ApplicationDbContext context, ILogger<InvoiceDeliveryPriorityService> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Calculate the delivery priority for a single invoice based on its age
        /// </summary>
        public static string CalculatePriority(DateTime importedAt, string currentStatus)
        {
            // Delivered or cancelled invoices don't escalate
            if (currentStatus is "Delivered" or "Cancelled")
                return "Completed";

            var daysInSystem = (int)(DateTime.UtcNow - importedAt).TotalDays;

            return daysInSystem switch
            {
                >= 14 => "Critical",   // Overdue - must ship immediately
                >= 11 => "Urgent",     // Nearing deadline
                >= 7 => "High",        // Within delivery window
                >= 4 => "Normal",      // Approaching window
                _ => "Low"             // Just imported
            };
        }

        /// <summary>
        /// Calculate the delivery deadline (14 days from import)
        /// </summary>
        public static DateTime CalculateDeadline(DateTime importedAt)
        {
            return importedAt.AddDays(DeliveryDeadlineDays);
        }

        /// <summary>
        /// Get the priority weight for sorting (higher = more urgent)
        /// </summary>
        public static int GetPriorityWeight(string priority)
        {
            return PriorityWeights.GetValueOrDefault(priority, 0);
        }

        /// <summary>
        /// Determine the highest priority from a list of invoice priorities.
        /// Used when creating loads to auto-set load priority.
        /// </summary>
        public static string GetHighestPriority(IEnumerable<string> priorities)
        {
            var highest = priorities
                .Select(p => new { Priority = p, Weight = GetPriorityWeight(p) })
                .OrderByDescending(x => x.Weight)
                .FirstOrDefault();

            return highest?.Priority ?? "Normal";
        }

        /// <summary>
        /// Map invoice delivery priority to load priority values (Low/Normal/High/Urgent)
        /// </summary>
        public static string MapToLoadPriority(string deliveryPriority)
        {
            return deliveryPriority switch
            {
                "Critical" => "Urgent",   // Critical maps to Load's highest: Urgent
                "Urgent" => "Urgent",
                "High" => "High",
                "Normal" => "Normal",
                "Low" => "Low",
                _ => "Normal"
            };
        }

        /// <summary>
        /// Recalculate and update priorities for all active (non-delivered/cancelled) invoices.
        /// Should be called periodically (e.g., daily) or on-demand.
        /// </summary>
        public async Task<PriorityRecalculationResult> RecalculateAllPriorities()
        {
            var result = new PriorityRecalculationResult();

            var activeInvoices = await _context.ImportedInvoices
                .Where(i => i.Status != "Delivered" && i.Status != "Cancelled")
                .ToListAsync();

            foreach (var invoice in activeInvoices)
            {
                var newPriority = CalculatePriority(invoice.ImportedAt, invoice.Status);
                var oldPriority = invoice.DeliveryPriority;

                if (oldPriority != newPriority)
                {
                    invoice.DeliveryPriority = newPriority;
                    invoice.UpdatedAt = DateTime.UtcNow;
                    result.Escalated++;

                    if (GetPriorityWeight(newPriority) > GetPriorityWeight(oldPriority))
                    {
                        _logger.LogWarning(
                            "Invoice {TransactionNumber} escalated from {OldPriority} to {NewPriority} ({DaysInSystem} days in system)",
                            invoice.TransactionNumber, oldPriority, newPriority, invoice.DaysInSystem);
                    }
                }

                // Ensure deadline is set
                if (!invoice.DeliveryDeadline.HasValue)
                {
                    invoice.DeliveryDeadline = CalculateDeadline(invoice.ImportedAt);
                }

                result.TotalProcessed++;
            }

            await _context.SaveChangesAsync();

            result.PrioritySummary = activeInvoices
                .GroupBy(i => i.DeliveryPriority)
                .ToDictionary(g => g.Key, g => g.Count());

            _logger.LogInformation(
                "Priority recalculation complete. Processed: {Total}, Escalated: {Escalated}",
                result.TotalProcessed, result.Escalated);

            return result;
        }

        /// <summary>
        /// Set priority for a newly imported invoice
        /// </summary>
        public void SetInitialPriority(Models.Logistics.ImportedInvoice invoice)
        {
            invoice.DeliveryPriority = CalculatePriority(invoice.ImportedAt, invoice.Status);
            invoice.DeliveryDeadline = CalculateDeadline(invoice.ImportedAt);
        }

        /// <summary>
        /// Get priority dashboard data - breakdown of invoices by priority with aging info
        /// </summary>
        public async Task<PriorityDashboardDto> GetPriorityDashboard()
        {
            var activeInvoices = await _context.ImportedInvoices
                .Where(i => i.Status != "Delivered" && i.Status != "Cancelled")
                .Select(i => new
                {
                    i.Id,
                    i.TransactionNumber,
                    i.CustomerName,
                    i.ImportedAt,
                    i.DeliveryPriority,
                    i.DeliveryDeadline,
                    i.Status,
                    i.DeliveryProvince,
                    NetValue = i.SalesAmount - i.SalesReturns
                })
                .ToListAsync();

            var now = DateTime.UtcNow;

            var dashboard = new PriorityDashboardDto
            {
                TotalActiveInvoices = activeInvoices.Count,
                CriticalCount = activeInvoices.Count(i => i.DeliveryPriority == "Critical"),
                UrgentCount = activeInvoices.Count(i => i.DeliveryPriority == "Urgent"),
                HighCount = activeInvoices.Count(i => i.DeliveryPriority == "High"),
                NormalCount = activeInvoices.Count(i => i.DeliveryPriority == "Normal"),
                LowCount = activeInvoices.Count(i => i.DeliveryPriority == "Low"),
                OverdueCount = activeInvoices.Count(i => (now - i.ImportedAt).TotalDays >= 14),
                AverageDaysInSystem = activeInvoices.Any() 
                    ? Math.Round(activeInvoices.Average(i => (now - i.ImportedAt).TotalDays), 1) 
                    : 0,
                TotalValueAtRisk = activeInvoices
                    .Where(i => i.DeliveryPriority is "Critical" or "Urgent")
                    .Sum(i => i.NetValue),
                OldestInvoiceDays = activeInvoices.Any()
                    ? (int)activeInvoices.Max(i => (now - i.ImportedAt).TotalDays)
                    : 0,
                CriticalInvoices = activeInvoices
                    .Where(i => i.DeliveryPriority == "Critical")
                    .OrderByDescending(i => (now - i.ImportedAt).TotalDays)
                    .Take(20)
                    .Select(i => new PriorityInvoiceSummaryDto
                    {
                        InvoiceId = i.Id,
                        TransactionNumber = i.TransactionNumber,
                        CustomerName = i.CustomerName,
                        DaysInSystem = (int)(now - i.ImportedAt).TotalDays,
                        DaysOverdue = (int)(now - i.ImportedAt).TotalDays - 14,
                        DeliveryPriority = i.DeliveryPriority,
                        Province = i.DeliveryProvince,
                        NetValue = i.NetValue,
                        Status = i.Status
                    }).ToList(),
                ByProvince = activeInvoices
                    .GroupBy(i => i.DeliveryProvince ?? "Unknown")
                    .Select(g => new ProvincePrioritySummaryDto
                    {
                        Province = g.Key,
                        TotalInvoices = g.Count(),
                        CriticalCount = g.Count(i => i.DeliveryPriority == "Critical"),
                        UrgentCount = g.Count(i => i.DeliveryPriority == "Urgent"),
                        HighCount = g.Count(i => i.DeliveryPriority == "High"),
                        TotalValue = g.Sum(i => i.NetValue)
                    })
                    .OrderByDescending(p => p.CriticalCount)
                    .ThenByDescending(p => p.UrgentCount)
                    .ToList()
            };

            return dashboard;
        }
    }

    // Result DTOs
    public class PriorityRecalculationResult
    {
        public int TotalProcessed { get; set; }
        public int Escalated { get; set; }
        public Dictionary<string, int> PrioritySummary { get; set; } = new();
    }

    public class PriorityDashboardDto
    {
        public int TotalActiveInvoices { get; set; }
        public int CriticalCount { get; set; }
        public int UrgentCount { get; set; }
        public int HighCount { get; set; }
        public int NormalCount { get; set; }
        public int LowCount { get; set; }
        public int OverdueCount { get; set; }
        public double AverageDaysInSystem { get; set; }
        public decimal TotalValueAtRisk { get; set; }
        public int OldestInvoiceDays { get; set; }
        public List<PriorityInvoiceSummaryDto> CriticalInvoices { get; set; } = new();
        public List<ProvincePrioritySummaryDto> ByProvince { get; set; } = new();
    }

    public class PriorityInvoiceSummaryDto
    {
        public int InvoiceId { get; set; }
        public string TransactionNumber { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public int DaysInSystem { get; set; }
        public int DaysOverdue { get; set; }
        public string DeliveryPriority { get; set; } = string.Empty;
        public string? Province { get; set; }
        public decimal NetValue { get; set; }
        public string Status { get; set; } = string.Empty;
    }

    public class ProvincePrioritySummaryDto
    {
        public string Province { get; set; } = string.Empty;
        public int TotalInvoices { get; set; }
        public int CriticalCount { get; set; }
        public int UrgentCount { get; set; }
        public int HighCount { get; set; }
        public decimal TotalValue { get; set; }
    }
}
