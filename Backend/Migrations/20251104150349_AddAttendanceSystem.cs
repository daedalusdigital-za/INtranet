using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendanceSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AttendanceAdmins",
                columns: table => new
                {
                    AdminId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastLoginAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AttendanceAdmins", x => x.AdminId);
                });

            migrationBuilder.CreateTable(
                name: "Employees",
                columns: table => new
                {
                    EmployeeId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FullName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EmployeeCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Department = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Position = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    HireDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Shift = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ShiftStartTime = table.Column<TimeSpan>(type: "time", nullable: true),
                    ShiftEndTime = table.Column<TimeSpan>(type: "time", nullable: true),
                    Photo = table.Column<byte[]>(type: "varbinary(max)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Employees", x => x.EmployeeId);
                });

            migrationBuilder.CreateTable(
                name: "Attendances",
                columns: table => new
                {
                    AttendanceId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EmployeeId = table.Column<int>(type: "int", nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TimeIn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TimeOut = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Shift = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsLate = table.Column<bool>(type: "bit", nullable: false),
                    LateMinutes = table.Column<int>(type: "int", nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Attendances", x => x.AttendanceId);
                    table.ForeignKey(
                        name: "FK_Attendances_Employees_EmployeeId",
                        column: x => x.EmployeeId,
                        principalTable: "Employees",
                        principalColumn: "EmployeeId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "AttendanceAdmins",
                columns: new[] { "AdminId", "CreatedAt", "Email", "FullName", "IsActive", "LastLoginAt", "PasswordHash", "Username" },
                values: new object[] { 1, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "admin@company.com", "System Administrator", true, null, "$2a$11$XQRdlQ8P9RfHOKVYOz5Wy.vHZe8RrH7pNWEJhGCRdPQ6kV0UqKPXm", "admin" });

            migrationBuilder.InsertData(
                table: "Employees",
                columns: new[] { "EmployeeId", "CreatedAt", "Department", "Email", "EmployeeCode", "FullName", "HireDate", "IsActive", "PhoneNumber", "Photo", "Position", "Shift", "ShiftEndTime", "ShiftStartTime", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "IT", "john.doe@company.com", "EMP001", "John Doe", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0101", null, "Software Developer", "Morning", new TimeSpan(0, 17, 0, 0, 0), new TimeSpan(0, 8, 0, 0, 0), null },
                    { 2, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "IT", "jane.smith@company.com", "EMP002", "Jane Smith", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0102", null, "Project Manager", "Morning", new TimeSpan(0, 17, 0, 0, 0), new TimeSpan(0, 8, 0, 0, 0), null },
                    { 3, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Logistics", "mike.johnson@company.com", "EMP003", "Mike Johnson", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0103", null, "Warehouse Manager", "Morning", new TimeSpan(0, 17, 0, 0, 0), new TimeSpan(0, 8, 0, 0, 0), null },
                    { 4, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Marketing", "sarah.williams@company.com", "EMP004", "Sarah Williams", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0104", null, "Marketing Specialist", "Morning", new TimeSpan(0, 17, 0, 0, 0), new TimeSpan(0, 8, 0, 0, 0), null },
                    { 5, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "IT", "robert.brown@company.com", "EMP005", "Robert Brown", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0105", null, "DevOps Engineer", "Morning", new TimeSpan(0, 17, 0, 0, 0), new TimeSpan(0, 8, 0, 0, 0), null },
                    { 6, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Logistics", "emily.davis@company.com", "EMP006", "Emily Davis", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0106", null, "Logistics Coordinator", "Afternoon", new TimeSpan(0, 22, 0, 0, 0), new TimeSpan(0, 14, 0, 0, 0), null },
                    { 7, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Marketing", "david.miller@company.com", "EMP007", "David Miller", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0107", null, "Content Writer", "Morning", new TimeSpan(0, 17, 0, 0, 0), new TimeSpan(0, 8, 0, 0, 0), null },
                    { 8, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "IT", "lisa.anderson@company.com", "EMP008", "Lisa Anderson", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0108", null, "QA Tester", "Morning", new TimeSpan(0, 17, 0, 0, 0), new TimeSpan(0, 8, 0, 0, 0), null },
                    { 9, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Logistics", "james.wilson@company.com", "EMP009", "James Wilson", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0109", null, "Delivery Driver", "Morning", new TimeSpan(0, 14, 0, 0, 0), new TimeSpan(0, 6, 0, 0, 0), null },
                    { 10, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Marketing", "maria.garcia@company.com", "EMP010", "Maria Garcia", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, "555-0110", null, "Social Media Manager", "Morning", new TimeSpan(0, 17, 0, 0, 0), new TimeSpan(0, 8, 0, 0, 0), null }
                });

            migrationBuilder.InsertData(
                table: "Attendances",
                columns: new[] { "AttendanceId", "CreatedAt", "Date", "EmployeeId", "IsLate", "LateMinutes", "Remarks", "Shift", "Status", "TimeIn", "TimeOut", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 1, false, null, null, "Morning", "Present", new DateTime(2025, 11, 4, 8, 0, 0, 0, DateTimeKind.Utc), null, null },
                    { 2, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 2, false, null, null, "Morning", "Present", new DateTime(2025, 11, 4, 7, 55, 0, 0, DateTimeKind.Utc), null, null },
                    { 3, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 3, true, 15, null, "Morning", "Present", new DateTime(2025, 11, 4, 8, 15, 0, 0, DateTimeKind.Utc), null, null },
                    { 4, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 5, true, 5, null, "Morning", "Present", new DateTime(2025, 11, 4, 8, 5, 0, 0, DateTimeKind.Utc), null, null },
                    { 5, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 6, false, null, null, "Afternoon", "Present", new DateTime(2025, 11, 4, 14, 0, 0, 0, DateTimeKind.Utc), null, null },
                    { 6, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 7, true, 10, null, "Morning", "Present", new DateTime(2025, 11, 4, 8, 10, 0, 0, DateTimeKind.Utc), null, null },
                    { 7, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 9, false, null, null, "Morning", "Present", new DateTime(2025, 11, 4, 6, 0, 0, 0, DateTimeKind.Utc), null, null },
                    { 8, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 4, false, null, null, "Morning", "Absent", null, null, null },
                    { 9, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 8, false, null, null, "Morning", "Absent", null, null, null },
                    { 10, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 11, 4, 0, 0, 0, 0, DateTimeKind.Utc), 10, false, null, null, "Morning", "Absent", null, null, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Attendances_EmployeeId",
                table: "Attendances",
                column: "EmployeeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AttendanceAdmins");

            migrationBuilder.DropTable(
                name: "Attendances");

            migrationBuilder.DropTable(
                name: "Employees");
        }
    }
}
