using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Departments",
                columns: table => new
                {
                    DepartmentId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    ManagerName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Departments", x => x.DepartmentId);
                });

            migrationBuilder.CreateTable(
                name: "Boards",
                columns: table => new
                {
                    BoardId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DepartmentId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Boards", x => x.BoardId);
                    table.ForeignKey(
                        name: "FK_Boards_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "DepartmentId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DepartmentId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.UserId);
                    table.ForeignKey(
                        name: "FK_Users_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "DepartmentId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Lists",
                columns: table => new
                {
                    ListId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BoardId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Lists", x => x.ListId);
                    table.ForeignKey(
                        name: "FK_Lists_Boards_BoardId",
                        column: x => x.BoardId,
                        principalTable: "Boards",
                        principalColumn: "BoardId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    LogId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EntityId = table.Column<int>(type: "int", nullable: false),
                    Details = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.LogId);
                    table.ForeignKey(
                        name: "FK_AuditLogs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Cards",
                columns: table => new
                {
                    CardId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ListId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    AssignedToUserId = table.Column<int>(type: "int", nullable: true),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Position = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cards", x => x.CardId);
                    table.ForeignKey(
                        name: "FK_Cards_Lists_ListId",
                        column: x => x.ListId,
                        principalTable: "Lists",
                        principalColumn: "ListId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Cards_Users_AssignedToUserId",
                        column: x => x.AssignedToUserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "CardAttachments",
                columns: table => new
                {
                    AttachmentId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CardId = table.Column<int>(type: "int", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    FileUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    FileType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    UploadedByUserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CardAttachments", x => x.AttachmentId);
                    table.ForeignKey(
                        name: "FK_CardAttachments_Cards_CardId",
                        column: x => x.CardId,
                        principalTable: "Cards",
                        principalColumn: "CardId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CardAttachments_Users_UploadedByUserId",
                        column: x => x.UploadedByUserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CardComments",
                columns: table => new
                {
                    CommentId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CardId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Content = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CardComments", x => x.CommentId);
                    table.ForeignKey(
                        name: "FK_CardComments_Cards_CardId",
                        column: x => x.CardId,
                        principalTable: "Cards",
                        principalColumn: "CardId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CardComments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Departments",
                columns: new[] { "DepartmentId", "CreatedAt", "ManagerName", "Name", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2025, 11, 3, 10, 5, 7, 619, DateTimeKind.Utc).AddTicks(5908), "John Smith", "Marketing Department", null },
                    { 2, new DateTime(2025, 11, 3, 10, 5, 7, 619, DateTimeKind.Utc).AddTicks(6142), "Jane Doe", "IT Department", null },
                    { 3, new DateTime(2025, 11, 3, 10, 5, 7, 619, DateTimeKind.Utc).AddTicks(6143), "Mike Johnson", "Sales Department", null },
                    { 4, new DateTime(2025, 11, 3, 10, 5, 7, 619, DateTimeKind.Utc).AddTicks(6144), "Sarah Williams", "HR Department", null }
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "UserId", "CreatedAt", "DepartmentId", "Email", "Name", "PasswordHash", "Role", "UpdatedAt" },
                values: new object[] { 1, new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(2199), null, "admin@company.com", "Admin User", "$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2", "Admin", null });

            migrationBuilder.InsertData(
                table: "Boards",
                columns: new[] { "BoardId", "CreatedAt", "DepartmentId", "Description", "Title", "UpdatedAt" },
                values: new object[] { 1, new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(4326), 1, "Marketing department project tracking", "Marketing Projects", null });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "UserId", "CreatedAt", "DepartmentId", "Email", "Name", "PasswordHash", "Role", "UpdatedAt" },
                values: new object[,]
                {
                    { 2, new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(2613), 1, "john@company.com", "John Smith", "$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2", "Manager", null },
                    { 3, new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(2617), 2, "jane@company.com", "Jane Doe", "$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2", "Manager", null }
                });

            migrationBuilder.InsertData(
                table: "Lists",
                columns: new[] { "ListId", "BoardId", "CreatedAt", "Position", "Title", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, 1, new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(5999), 0, "To Do", null },
                    { 2, 1, new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(6199), 1, "In Progress", null },
                    { 3, 1, new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(6201), 2, "Completed", null }
                });

            migrationBuilder.InsertData(
                table: "Cards",
                columns: new[] { "CardId", "AssignedToUserId", "CreatedAt", "Description", "DueDate", "ListId", "Position", "Status", "Title", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, null, new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(8471), "Create promotional posters for company calendar", null, 1, 0, "Active", "Design calendar posters", null },
                    { 2, 2, new DateTime(2025, 11, 3, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(8902), "Launch November marketing campaign", null, 2, 0, "Active", "November campaign rollout", null },
                    { 3, null, new DateTime(2025, 10, 27, 10, 5, 7, 620, DateTimeKind.Utc).AddTicks(8908), "Complete social media strategy update for Q4", null, 3, 0, "Completed", "Social media strategy update", null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_UserId",
                table: "AuditLogs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Boards_DepartmentId",
                table: "Boards",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_CardAttachments_CardId",
                table: "CardAttachments",
                column: "CardId");

            migrationBuilder.CreateIndex(
                name: "IX_CardAttachments_UploadedByUserId",
                table: "CardAttachments",
                column: "UploadedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_CardComments_CardId",
                table: "CardComments",
                column: "CardId");

            migrationBuilder.CreateIndex(
                name: "IX_CardComments_UserId",
                table: "CardComments",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Cards_AssignedToUserId",
                table: "Cards",
                column: "AssignedToUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Cards_ListId",
                table: "Cards",
                column: "ListId");

            migrationBuilder.CreateIndex(
                name: "IX_Lists_BoardId",
                table: "Lists",
                column: "BoardId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_DepartmentId",
                table: "Users",
                column: "DepartmentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "CardAttachments");

            migrationBuilder.DropTable(
                name: "CardComments");

            migrationBuilder.DropTable(
                name: "Cards");

            migrationBuilder.DropTable(
                name: "Lists");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Boards");

            migrationBuilder.DropTable(
                name: "Departments");
        }
    }
}
