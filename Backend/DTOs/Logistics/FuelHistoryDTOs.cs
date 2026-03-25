namespace ProjectTracker.API.DTOs.Logistics
{
    public class FuelTransactionDto
    {
        public int Id { get; set; }
        public int? VehicleId { get; set; }
        public string RegistrationNumber { get; set; } = string.Empty;
        public string? CardNumber { get; set; }
        public string? DepotName { get; set; }
        public decimal AllocationLitres { get; set; }
        public decimal LitresUsed { get; set; }
        public DateTime TransactionDate { get; set; }
        public decimal AmountSpent { get; set; }
        public string? DepotAssignment { get; set; }
        public int ReportMonth { get; set; }
        public int ReportYear { get; set; }
        public string? Notes { get; set; }
        public DateTime CreatedAt { get; set; }

        // Joined from Vehicle
        public string? VehicleMake { get; set; }
        public string? VehicleModel { get; set; }
        public string? VehicleTypeName { get; set; }
    }

    public class FuelHistorySummaryDto
    {
        public int VehicleId { get; set; }
        public string RegistrationNumber { get; set; } = string.Empty;
        public string? VehicleMake { get; set; }
        public string? VehicleModel { get; set; }
        public string? VehicleTypeName { get; set; }
        public string? DepotAssignment { get; set; }
        public int TransactionCount { get; set; }
        public decimal TotalLitresUsed { get; set; }
        public decimal TotalAmountSpent { get; set; }
        public decimal AverageLitresPerFill { get; set; }
        public decimal AllocationLitres { get; set; }
        public decimal AllocationUsagePercent { get; set; }
    }

    public class FuelMonthlyReportDto
    {
        public int ReportMonth { get; set; }
        public int ReportYear { get; set; }
        public string MonthName { get; set; } = string.Empty;
        public int TotalTransactions { get; set; }
        public int UniqueVehicles { get; set; }
        public decimal TotalLitresUsed { get; set; }
        public decimal TotalAmountSpent { get; set; }
        public decimal AverageCostPerLitre { get; set; }
        public List<FuelHistorySummaryDto> VehicleSummaries { get; set; } = new();
    }

    public class FuelTransactionImportDto
    {
        public string RegistrationNumber { get; set; } = string.Empty;
        public string? CardNumber { get; set; }
        public string? DepotName { get; set; }
        public decimal AllocationLitres { get; set; }
        public decimal LitresUsed { get; set; }
        public DateTime TransactionDate { get; set; }
        public decimal AmountSpent { get; set; }
        public string? DepotAssignment { get; set; }
        public int ReportMonth { get; set; }
        public int ReportYear { get; set; }
    }

    public class FuelImportResultDto
    {
        public int TotalRecords { get; set; }
        public int ImportedCount { get; set; }
        public int MatchedVehicles { get; set; }
        public int UnmatchedVehicles { get; set; }
        public List<string> UnmatchedRegistrations { get; set; } = new();
        public List<string> Errors { get; set; } = new();
    }
}
