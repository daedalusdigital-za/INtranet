namespace ProjectTracker.API.DTOs.Logistics
{
    public class SleepOutDto
    {
        public int Id { get; set; }
        public int DriverId { get; set; }
        public string? DriverName { get; set; }
        public string? DriverEmployeeNumber { get; set; }
        public decimal Amount { get; set; }
        public DateTime Date { get; set; }
        public string Status { get; set; } = "Requested";
        public string? Reason { get; set; }
        public string? Notes { get; set; }
        public int? LoadId { get; set; }
        public string? LoadNumber { get; set; }
        public int? ApprovedByUserId { get; set; }
        public string? ApprovedByUserName { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateSleepOutDto
    {
        public int DriverId { get; set; }
        public decimal Amount { get; set; }
        public DateTime Date { get; set; }
        public string? Reason { get; set; }
        public string? Notes { get; set; }
        public int? LoadId { get; set; }
    }

    public class UpdateSleepOutDto
    {
        public decimal? Amount { get; set; }
        public DateTime? Date { get; set; }
        public string? Status { get; set; }
        public string? Reason { get; set; }
        public string? Notes { get; set; }
    }

    public class ApproveSleepOutDto
    {
        public bool Approved { get; set; }
        public string? Notes { get; set; }
    }
}
