using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class FixSeedData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2025, 10, 27, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 4,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Lists",
                keyColumn: "ListId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Lists",
                keyColumn: "ListId",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Lists",
                keyColumn: "ListId",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(4326));

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(8471));

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(8902));

            migrationBuilder.UpdateData(
                table: "Cards",
                keyColumn: "CardId",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2025, 10, 27, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(8908));

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 619, DateTimeKind.Utc).AddTicks(5908));

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 619, DateTimeKind.Utc).AddTicks(6142));

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 619, DateTimeKind.Utc).AddTicks(6143));

            migrationBuilder.UpdateData(
                table: "Departments",
                keyColumn: "DepartmentId",
                keyValue: 4,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 619, DateTimeKind.Utc).AddTicks(6144));

            migrationBuilder.UpdateData(
                table: "Lists",
                keyColumn: "ListId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(5999));

            migrationBuilder.UpdateData(
                table: "Lists",
                keyColumn: "ListId",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(6199));

            migrationBuilder.UpdateData(
                table: "Lists",
                keyColumn: "ListId",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(6201));

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 1,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(2199));

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 2,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(2613));

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 3,
                column: "CreatedAt",
                value: new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(2617));
        }
    }
}
