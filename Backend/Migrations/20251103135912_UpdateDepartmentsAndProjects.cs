using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class UpdateDepartmentsAndProjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 4);

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 1,
                columns: new[] { "Description", "Title" },
                values: new object[] { "IT infrastructure projects", "IT Infrastructure" });

            migrationBuilder.InsertData(
                table: "Boards",
                columns: new[] { "BoardId", "CreatedAt", "DepartmentId", "Description", "Title", "UpdatedAt" },
                values: new object[,]
                {
                    { 2, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "Software development projects", "Software Development", null },
                    { 3, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "Security projects", "Security", null },
                    { 4, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "Cloud migration projects", "Cloud Migration", null },
                    { 5, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "Network upgrade projects", "Network Upgrade", null },
                    { 6, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "Database projects", "Database Management", null },
                    { 7, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "Mobile application projects", "Mobile Apps", null },
                    { 8, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "DevOps projects", "DevOps", null },
                    { 9, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "AI integration projects", "AI Integration", null },
                    { 10, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "Help desk system projects", "Help Desk System", null },
                    { 11, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "Backup and recovery projects", "Backup Solutions", null },
                    { 12, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 1, "Hardware refresh projects", "Hardware Refresh", null },
                    { 13, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Supply chain projects", "Supply Chain", null },
                    { 14, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Warehouse projects", "Warehouse Management", null },
                    { 15, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Fleet management projects", "Fleet Management", null },
                    { 16, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Inventory control projects", "Inventory Control", null },
                    { 17, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Shipping optimization projects", "Shipping Optimization", null },
                    { 18, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Vendor relations projects", "Vendor Relations", null },
                    { 19, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Route planning projects", "Route Planning", null },
                    { 20, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Distribution center projects", "Distribution Center", null },
                    { 21, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 2, "Quality control projects", "Quality Control", null },
                    { 22, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "Digital marketing projects", "Digital Marketing", null },
                    { 23, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "Content creation projects", "Content Creation", null },
                    { 24, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "Brand strategy projects", "Brand Strategy", null },
                    { 25, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "Social media projects", "Social Media", null },
                    { 26, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "Email campaign projects", "Email Campaigns", null },
                    { 27, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "Events and promotions", "Events & Promotions", null },
                    { 28, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "Market research projects", "Market Research", null }
                });

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 1,
                columns: new[] { "CreatedAt", "Description", "ListId", "Status", "Title" },
                values: new object[] { new DateTime(2025, 10, 4, 0, 0, 0, 0, DateTimeKind.Utc), "Migrated legacy servers to new infrastructure", 3, "Completed", "Server migration completed" });

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 2,
                columns: new[] { "AssignedToUserId", "CreatedAt", "Description", "ListId", "Position", "Status", "Title" },
                values: new object[] { null, new DateTime(2025, 10, 9, 0, 0, 0, 0, DateTimeKind.Utc), "Upgraded firewall to latest version", 3, 1, "Completed", "Firewall upgrade finished" });

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 3,
                columns: new[] { "CreatedAt", "Description", "Position", "Title" },
                values: new object[] { new DateTime(2025, 10, 14, 0, 0, 0, 0, DateTimeKind.Utc), "New backup system fully operational", 2, "Backup system implemented" });

            migrationBuilder.InsertData(
                table: "Cards",
                columns: new[] { "CardId", "AssignedToUserId", "CreatedAt", "Description", "DueDate", "ListId", "Position", "Status", "Title", "UpdatedAt" },
                values: new object[,]
                {
                    { 4, null, new DateTime(2025, 10, 19, 0, 0, 0, 0, DateTimeKind.Utc), "VPN infrastructure deployed", null, 3, 3, "Completed", "VPN setup complete", null },
                    { 5, null, new DateTime(2025, 10, 24, 0, 0, 0, 0, DateTimeKind.Utc), "Infrastructure monitoring tools active", null, 3, 4, "Completed", "Monitoring tools deployed", null },
                    { 6, null, new DateTime(2025, 10, 29, 0, 0, 0, 0, DateTimeKind.Utc), "All infrastructure documentation current", null, 3, 5, "Completed", "Documentation updated", null },
                    { 7, 2, new DateTime(2025, 10, 31, 0, 0, 0, 0, DateTimeKind.Utc), "Configuring load balancers", null, 2, 0, "Active", "Load balancer configuration", null },
                    { 8, 2, new DateTime(2025, 10, 30, 0, 0, 0, 0, DateTimeKind.Utc), "Migrating DNS infrastructure", null, 2, 1, "Active", "DNS migration", null },
                    { 9, 2, new DateTime(2025, 11, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Renewing SSL certificates", null, 2, 2, "Active", "SSL certificate renewal", null },
                    { 10, 2, new DateTime(2025, 11, 2, 0, 0, 0, 0, DateTimeKind.Utc), "Expanding storage capacity", null, 2, 3, "Active", "Storage expansion", null }
                });

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 1,
                columns: new[] { "ManagerName", "Name" },
                values: new object[] { "Jane Doe", "IT" });

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 2,
                columns: new[] { "ManagerName", "Name" },
                values: new object[] { "Mike Johnson", "Logistics" });

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 3,
                columns: new[] { "ManagerName", "Name" },
                values: new object[] { "John Smith", "Marketing" });

            migrationBuilder.InsertData(
                table: "Lists",
                columns: new[] { "ListId", "BoardId", "CreatedAt", "Position", "Title", "UpdatedAt" },
                values: new object[] { 4, 1, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "Overdue", null });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 2,
                columns: new[] { "Email", "Name" },
                values: new object[] { "jane@company.com", "Jane Doe" });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 3,
                columns: new[] { "Email", "Name" },
                values: new object[] { "mike@company.com", "Mike Johnson" });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "UserId", "CreatedAt", "DepartmentId", "Email", "Name", "PasswordHash", "Role", "UpdatedAt" },
                values: new object[] { 4, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), 3, "john@company.com", "John Smith", "$2a$11$XQRdlQ8P9RfHOKVYOz5Wy.vHZe8RrH7pNWEJhGCRdPQ6kV0UqKPXm", "Manager", null });

            migrationBuilder.InsertData(
                table: "Cards",
                columns: new[] { "CardId", "AssignedToUserId", "CreatedAt", "Description", "DueDate", "ListId", "Position", "Status", "Title", "UpdatedAt" },
                values: new object[,]
                {
                    { 11, null, new DateTime(2025, 10, 14, 0, 0, 0, 0, DateTimeKind.Utc), "Decommission old servers", new DateTime(2025, 10, 29, 0, 0, 0, 0, DateTimeKind.Utc), 4, 0, "Active", "Legacy system decommission", null },
                    { 12, null, new DateTime(2025, 10, 19, 0, 0, 0, 0, DateTimeKind.Utc), "Complete security audit", new DateTime(2025, 10, 31, 0, 0, 0, 0, DateTimeKind.Utc), 4, 1, "Active", "Security audit", null }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 15);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 16);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 17);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 18);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 19);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 20);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 21);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 22);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 23);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 24);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 25);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 26);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 27);

            migrationBuilder.DeleteData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 28);

            migrationBuilder.DeleteData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 5);

            migrationBuilder.DeleteData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 6);

            migrationBuilder.DeleteData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 7);

            migrationBuilder.DeleteData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 8);

            migrationBuilder.DeleteData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "Lists",
                keyColumn: "ListId",
                keyValue: 4);

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 1,
                columns: new[] { "Description", "Title" },
                values: new object[] { "Marketing department project tracking", "Marketing Projects" });

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 1,
                columns: new[] { "CreatedAt", "Description", "ListId", "Status", "Title" },
                values: new object[] { new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Create promotional posters for company calendar", 1, "Active", "Design calendar posters" });

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 2,
                columns: new[] { "AssignedToUserId", "CreatedAt", "Description", "ListId", "Position", "Status", "Title" },
                values: new object[] { 2, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Launch November marketing campaign", 2, 0, "Active", "November campaign rollout" });

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 3,
                columns: new[] { "CreatedAt", "Description", "Position", "Title" },
                values: new object[] { new DateTime(2025, 10, 27, 0, 0, 0, 0, DateTimeKind.Utc), "Complete social media strategy update for Q4", 0, "Social media strategy update" });

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 1,
                columns: new[] { "ManagerName", "Name" },
                values: new object[] { "John Smith", "Marketing Department" });

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 2,
                columns: new[] { "ManagerName", "Name" },
                values: new object[] { "Jane Doe", "IT Department" });

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 3,
                columns: new[] { "ManagerName", "Name" },
                values: new object[] { "Mike Johnson", "Sales Department" });

            migrationBuilder.InsertData(
                table: "Departments",
                columns: new[] { "DepartmentId", "CreatedAt", "ManagerName", "Name", "UpdatedAt" },
                values: new object[] { 4, new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Sarah Williams", "HR Department", null });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 2,
                columns: new[] { "Email", "Name" },
                values: new object[] { "john@company.com", "John Smith" });

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 3,
                columns: new[] { "Email", "Name" },
                values: new object[] { "jane@company.com", "Jane Doe" });
        }
    }
}
