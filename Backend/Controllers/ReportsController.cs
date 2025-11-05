using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using OfficeOpenXml;
using OfficeOpenXml.Style;
using ProjectTracker.API.Data;
using System.Drawing;

namespace ProjectTracker.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReportsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public ReportsController(ApplicationDbContext context)
        {
            _context = context;
            ExcelPackage.LicenseContext = LicenseContext.NonCommercial;
        }

        // GET: api/reports/weekly
        [HttpGet("weekly")]
        public async Task<IActionResult> ExportWeekly([FromQuery] int weekOffset = 0)
        {
            try
            {
                var today = DateTime.UtcNow.Date;
                // Subtract weeks based on weekOffset
                var referenceDate = today.AddDays(-7 * weekOffset);
                var monday = GetMondayOfCurrentWeek(referenceDate);
                var friday = monday.AddDays(4);

                // Get all employees
                var employees = await _context.EmpRegistrations
                    .OrderBy(e => e.EmpId)
                    .ToListAsync();

                // Get attendance records for the week
                var attendanceRecords = await _context.AttendanceRecords
                    .Where(a => a.Date != null && a.Date.Value.Date >= monday && a.Date.Value.Date <= friday)
                    .ToListAsync();

                using var package = new ExcelPackage();
                var worksheet = package.Workbook.Worksheets.Add("Weekly Attendance");

                // Title
                worksheet.Cells["A1:K1"].Merge = true;
                worksheet.Cells["A1"].Value = $"Weekly Attendance Report ({monday:MMM dd} - {friday:MMM dd, yyyy})";
                worksheet.Cells["A1"].Style.Font.Size = 16;
                worksheet.Cells["A1"].Style.Font.Bold = true;
                worksheet.Cells["A1"].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;

                // Headers
                int row = 3;
                var headers = new[] { "Employee ID", "Employee Name", "Department", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Days Worked", "Total Hours" };
                for (int i = 0; i < headers.Length; i++)
                {
                    worksheet.Cells[row, i + 1].Value = headers[i];
                    worksheet.Cells[row, i + 1].Style.Font.Bold = true;
                    worksheet.Cells[row, i + 1].Style.Fill.PatternType = ExcelFillStyle.Solid;
                    worksheet.Cells[row, i + 1].Style.Fill.BackgroundColor.SetColor(Color.FromArgb(34, 139, 34));
                    worksheet.Cells[row, i + 1].Style.Font.Color.SetColor(Color.White);
                    worksheet.Cells[row, i + 1].Style.Border.BorderAround(ExcelBorderStyle.Thin);
                }

                row++;
                int totalEmployees = employees.Count;
                int employeesPresentThisWeek = 0;

                foreach (var employee in employees)
                {
                    int daysWorked = 0;
                    double totalHours = 0;

                    worksheet.Cells[row, 1].Value = employee.EmpId;
                    worksheet.Cells[row, 2].Value = $"{employee.Name} {employee.LastName}".Trim();
                    worksheet.Cells[row, 3].Value = employee.Department ?? "N/A";

                    bool hasAttendance = false;

                    // Process each day of the week
                    for (int dayOffset = 0; dayOffset < 5; dayOffset++)
                    {
                        var checkDate = monday.AddDays(dayOffset);
                        var dayAttendance = attendanceRecords.FirstOrDefault(a =>
                            a.EmpID == employee.EmpId &&
                            a.Date.HasValue &&
                            a.Date.Value.Date == checkDate.Date);

                        int col = 4 + dayOffset;

                        if (dayAttendance?.TimeIn != null)
                        {
                            hasAttendance = true;
                            daysWorked++;

                            var timeIn = dayAttendance.TimeIn.Value.ToString("HH:mm");
                            var timeOut = dayAttendance.TimeOut?.ToString("HH:mm") ?? "N/A";
                            var hours = dayAttendance.TimeOut != null
                                ? (dayAttendance.TimeOut.Value.ToTimeSpan() - dayAttendance.TimeIn.Value.ToTimeSpan()).TotalHours
                                : 0;

                            totalHours += hours;

                            worksheet.Cells[row, col].Value = $"In: {timeIn}\nOut: {timeOut}\n({hours:F1}h)";
                            worksheet.Cells[row, col].Style.WrapText = true;
                            worksheet.Cells[row, col].Style.Fill.PatternType = ExcelFillStyle.Solid;
                            worksheet.Cells[row, col].Style.Fill.BackgroundColor.SetColor(Color.LightGreen);
                        }
                        else
                        {
                            worksheet.Cells[row, col].Value = "Absent";
                            worksheet.Cells[row, col].Style.Fill.PatternType = ExcelFillStyle.Solid;
                            worksheet.Cells[row, col].Style.Fill.BackgroundColor.SetColor(Color.LightCoral);
                        }

                        worksheet.Cells[row, col].Style.Border.BorderAround(ExcelBorderStyle.Thin);
                    }

                    if (hasAttendance) employeesPresentThisWeek++;

                    worksheet.Cells[row, 9].Value = daysWorked;
                    worksheet.Cells[row, 10].Value = totalHours;
                    worksheet.Cells[row, 10].Style.Numberformat.Format = "0.0";

                    // Border around entire row
                    worksheet.Cells[row, 1, row, 10].Style.Border.BorderAround(ExcelBorderStyle.Thin);

                    row++;
                }

                // Summary
                row++;
                worksheet.Cells[row, 1].Value = "Weekly Summary";
                worksheet.Cells[row, 1].Style.Font.Bold = true;
                row++;
                worksheet.Cells[row, 1].Value = "Total Employees:";
                worksheet.Cells[row, 2].Value = totalEmployees;
                row++;
                worksheet.Cells[row, 1].Value = "Employees Present This Week:";
                worksheet.Cells[row, 2].Value = employeesPresentThisWeek;

                // Auto-fit columns
                worksheet.Cells[worksheet.Dimension.Address].AutoFitColumns();
                worksheet.Column(4).Width = 15;
                worksheet.Column(5).Width = 15;
                worksheet.Column(6).Width = 15;
                worksheet.Column(7).Width = 15;
                worksheet.Column(8).Width = 15;

                var fileName = $"Weekly_Attendance_Report_{monday:yyyyMMdd}.xlsx";
                var fileBytes = package.GetAsByteArray();

                return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error generating weekly report", error = ex.Message });
            }
        }

        // GET: api/reports/monthly?month=11&year=2025
        [HttpGet("monthly")]
        public async Task<IActionResult> ExportMonthly([FromQuery] int month, [FromQuery] int year)
        {
            try
            {
                if (month < 1 || month > 12 || year < 2020 || year > 2100)
                {
                    return BadRequest(new { message = "Invalid month or year" });
                }

                var startDate = new DateTime(year, month, 1);
                var endDate = startDate.AddMonths(1).AddDays(-1);

                // Get all employees
                var employees = await _context.EmpRegistrations
                    .OrderBy(e => e.EmpId)
                    .ToListAsync();

                // Get attendance records for the month
                var attendanceRecords = await _context.AttendanceRecords
                    .Where(a => a.Date != null && a.Date.Value.Date >= startDate && a.Date.Value.Date <= endDate)
                    .ToListAsync();

                using var package = new ExcelPackage();
                var worksheet = package.Workbook.Worksheets.Add("Monthly Attendance");

                // Title
                worksheet.Cells["A1"].Value = $"Monthly Attendance Report - {startDate:MMMM yyyy}";
                worksheet.Cells["A1"].Style.Font.Size = 16;
                worksheet.Cells["A1"].Style.Font.Bold = true;

                // Get all weekdays in the month
                var weekdays = new List<DateTime>();
                for (var date = startDate; date <= endDate; date = date.AddDays(1))
                {
                    if (date.DayOfWeek != DayOfWeek.Saturday && date.DayOfWeek != DayOfWeek.Sunday)
                    {
                        weekdays.Add(date);
                    }
                }

                int totalWorkingDays = weekdays.Count;

                // Headers
                int row = 3;
                int col = 1;
                worksheet.Cells[row, col++].Value = "Employee ID";
                worksheet.Cells[row, col++].Value = "Employee Name";
                worksheet.Cells[row, col++].Value = "Department";

                foreach (var day in weekdays)
                {
                    worksheet.Cells[row, col].Value = $"{day:dd-MMM}\n{day:ddd}";
                    worksheet.Cells[row, col].Style.WrapText = true;
                    worksheet.Cells[row, col].Style.Font.Size = 9;
                    col++;
                }

                worksheet.Cells[row, col++].Value = "Days Worked";
                worksheet.Cells[row, col++].Value = "Total Hours";
                worksheet.Cells[row, col++].Value = "Avg Hrs/Day";
                worksheet.Cells[row, col++].Value = "Attendance %";

                // Style headers
                for (int i = 1; i <= col - 1; i++)
                {
                    worksheet.Cells[row, i].Style.Font.Bold = true;
                    worksheet.Cells[row, i].Style.Fill.PatternType = ExcelFillStyle.Solid;
                    worksheet.Cells[row, i].Style.Fill.BackgroundColor.SetColor(Color.FromArgb(30, 144, 255));
                    worksheet.Cells[row, i].Style.Font.Color.SetColor(Color.White);
                    worksheet.Cells[row, i].Style.Border.BorderAround(ExcelBorderStyle.Thin);
                    worksheet.Cells[row, i].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                }

                row++;
                int perfectAttendanceCount = 0;
                double totalAttendanceRate = 0;

                foreach (var employee in employees)
                {
                    col = 1;
                    int daysWorked = 0;
                    double totalHours = 0;

                    worksheet.Cells[row, col++].Value = employee.EmpId;
                    worksheet.Cells[row, col++].Value = $"{employee.Name} {employee.LastName}".Trim();
                    worksheet.Cells[row, col++].Value = employee.Department ?? "N/A";

                    foreach (var day in weekdays)
                    {
                        var dayAttendance = attendanceRecords.FirstOrDefault(a =>
                            a.EmpID == employee.EmpId &&
                            a.Date.HasValue &&
                            a.Date.Value.Date == day.Date);

                        if (dayAttendance?.TimeIn != null)
                        {
                            daysWorked++;
                            var timeIn = dayAttendance.TimeIn.Value.ToString("HH:mm");
                            var timeOut = dayAttendance.TimeOut?.ToString("HH:mm") ?? "N/A";
                            var hours = dayAttendance.TimeOut != null
                                ? (dayAttendance.TimeOut.Value.ToTimeSpan() - dayAttendance.TimeIn.Value.ToTimeSpan()).TotalHours
                                : 0;

                            totalHours += hours;

                            worksheet.Cells[row, col].Value = $"{timeIn}-{timeOut}\n({hours:F1}h)";
                            worksheet.Cells[row, col].Style.WrapText = true;
                            worksheet.Cells[row, col].Style.Fill.PatternType = ExcelFillStyle.Solid;

                            if (dayAttendance.TimeOut != null)
                            {
                                worksheet.Cells[row, col].Style.Fill.BackgroundColor.SetColor(Color.LightGreen);
                            }
                            else
                            {
                                worksheet.Cells[row, col].Style.Fill.BackgroundColor.SetColor(Color.LightYellow);
                            }
                        }
                        else
                        {
                            worksheet.Cells[row, col].Value = "Absent";
                            worksheet.Cells[row, col].Style.Fill.PatternType = ExcelFillStyle.Solid;
                            worksheet.Cells[row, col].Style.Fill.BackgroundColor.SetColor(Color.LightCoral);
                        }

                        worksheet.Cells[row, col].Style.Border.BorderAround(ExcelBorderStyle.Thin);
                        worksheet.Cells[row, col].Style.Font.Size = 8;
                        worksheet.Cells[row, col].Style.HorizontalAlignment = ExcelHorizontalAlignment.Center;
                        col++;
                    }

                    double attendancePercentage = totalWorkingDays > 0 ? (double)daysWorked / totalWorkingDays * 100 : 0;
                    double avgHoursPerDay = daysWorked > 0 ? totalHours / daysWorked : 0;

                    if (daysWorked == totalWorkingDays) perfectAttendanceCount++;
                    totalAttendanceRate += attendancePercentage;

                    worksheet.Cells[row, col++].Value = daysWorked;
                    worksheet.Cells[row, col].Value = totalHours;
                    worksheet.Cells[row, col++].Style.Numberformat.Format = "0.0";
                    worksheet.Cells[row, col].Value = avgHoursPerDay;
                    worksheet.Cells[row, col++].Style.Numberformat.Format = "0.0";
                    worksheet.Cells[row, col].Value = attendancePercentage / 100;
                    worksheet.Cells[row, col++].Style.Numberformat.Format = "0.0%";

                    row++;
                }

                // Summary
                row++;
                worksheet.Cells[row, 1].Value = "Monthly Summary";
                worksheet.Cells[row, 1].Style.Font.Bold = true;
                row++;
                worksheet.Cells[row, 1].Value = "Total Employees:";
                worksheet.Cells[row, 2].Value = employees.Count;
                row++;
                worksheet.Cells[row, 1].Value = "Working Days in Month:";
                worksheet.Cells[row, 2].Value = totalWorkingDays;
                row++;
                worksheet.Cells[row, 1].Value = "Employees with Perfect Attendance:";
                worksheet.Cells[row, 2].Value = perfectAttendanceCount;
                row++;
                worksheet.Cells[row, 1].Value = "Average Attendance Rate:";
                worksheet.Cells[row, 2].Value = employees.Count > 0 ? (totalAttendanceRate / employees.Count) / 100 : 0;
                worksheet.Cells[row, 2].Style.Numberformat.Format = "0.0%";

                // Auto-fit columns
                worksheet.Column(1).Width = 12;
                worksheet.Column(2).Width = 20;
                worksheet.Column(3).Width = 15;

                for (int i = 4; i < 4 + weekdays.Count; i++)
                {
                    worksheet.Column(i).Width = 10;
                }

                var fileName = $"Monthly_Attendance_Report_{year}{month:D2}_{startDate:MMMM}_{year}.xlsx";
                var fileBytes = package.GetAsByteArray();

                return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error generating monthly report", error = ex.Message });
            }
        }

        private static DateTime GetMondayOfCurrentWeek(DateTime date)
        {
            int diff = (7 + (date.DayOfWeek - DayOfWeek.Monday)) % 7;
            return date.AddDays(-1 * diff).Date;
        }
    }
}
