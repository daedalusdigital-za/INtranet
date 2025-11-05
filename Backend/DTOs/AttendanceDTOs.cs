namespace ProjectTracker.API.DTOs
{
    public class EmployeeDto
    {
        public int EmployeeId { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string EmployeeCode { get; set; } = string.Empty;
        public string? Department { get; set; }
        public string? Position { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public DateTime? HireDate { get; set; }
        public string? Shift { get; set; }
        public TimeSpan? ShiftStartTime { get; set; }
        public TimeSpan? ShiftEndTime { get; set; }
        public string? PhotoBase64 { get; set; }
        public bool IsActive { get; set; }
        public string? Status { get; set; } // Present, Absent, Late
        public DateTime? TimeIn { get; set; }
        public DateTime? TimeOut { get; set; }
        public bool IsLate { get; set; }
        public int? LateMinutes { get; set; }
    }

    public class AttendanceDto
    {
        public int AttendanceId { get; set; }
        public int EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public string EmployeeCode { get; set; } = string.Empty;
        public string? Department { get; set; }
        public DateTime Date { get; set; }
        public DateTime? TimeIn { get; set; }
        public DateTime? TimeOut { get; set; }
        public string? Shift { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool IsLate { get; set; }
        public int? LateMinutes { get; set; }
        public string? Remarks { get; set; }
    }

    public class AttendanceMetricsDto
    {
        public int TotalEmployees { get; set; }
        public int PresentCount { get; set; }
        public int AbsentCount { get; set; }
        public int LateCount { get; set; }
        public double AttendanceRate { get; set; }
        public DateTime Date { get; set; }
        public List<DepartmentAttendanceDto> DepartmentBreakdown { get; set; } = new();
    }

    public class DepartmentAttendanceDto
    {
        public string DepartmentName { get; set; } = string.Empty;
        public int TotalEmployees { get; set; }
        public int PresentCount { get; set; }
        public int AbsentCount { get; set; }
        public int LateCount { get; set; }
    }

    public class CheckInRequest
    {
        public int EmployeeId { get; set; }
        public DateTime TimeIn { get; set; }
    }

    public class CheckOutRequest
    {
        public int EmployeeId { get; set; }
        public DateTime TimeOut { get; set; }
    }
}
