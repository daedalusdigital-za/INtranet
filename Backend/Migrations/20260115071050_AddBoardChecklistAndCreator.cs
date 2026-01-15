using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddBoardChecklistAndCreator : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "Boards",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Boards",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "BoardChecklistItems",
                columns: table => new
                {
                    ChecklistItemId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BoardId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    IsCompleted = table.Column<bool>(type: "bit", nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompletedByUserId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BoardChecklistItems", x => x.ChecklistItemId);
                    table.ForeignKey(
                        name: "FK_BoardChecklistItems_Boards_BoardId",
                        column: x => x.BoardId,
                        principalTable: "Boards",
                        principalColumn: "BoardId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BoardChecklistItems_Users_CompletedByUserId",
                        column: x => x.CompletedByUserId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 1,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 2,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 3,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 4,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 5,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 6,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 7,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 8,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 9,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 10,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 11,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 12,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 13,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 14,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 15,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 16,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 17,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 18,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 19,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 20,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 21,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 22,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 23,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 24,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 25,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 26,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 27,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.UpdateData(
                table: "Boards",
                keyColumn: "BoardId",
                keyValue: 28,
                columns: new[] { "CreatedByUserId", "Status" },
                values: new object[] { null, "Planning" });

            migrationBuilder.CreateIndex(
                name: "IX_Boards_CreatedByUserId",
                table: "Boards",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_BoardChecklistItems_BoardId",
                table: "BoardChecklistItems",
                column: "BoardId");

            migrationBuilder.CreateIndex(
                name: "IX_BoardChecklistItems_CompletedByUserId",
                table: "BoardChecklistItems",
                column: "CompletedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_Boards_Users_CreatedByUserId",
                table: "Boards",
                column: "CreatedByUserId",
                principalTable: "Users",
                principalColumn: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Boards_Users_CreatedByUserId",
                table: "Boards");

            migrationBuilder.DropTable(
                name: "BoardChecklistItems");

            migrationBuilder.DropIndex(
                name: "IX_Boards_CreatedByUserId",
                table: "Boards");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Boards");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Boards");
        }
    }
}
