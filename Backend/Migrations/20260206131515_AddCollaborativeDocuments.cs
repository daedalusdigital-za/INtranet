using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCollaborativeDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CollaborativeDocuments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastModifiedById = table.Column<int>(type: "int", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    IsPublic = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CollaborativeDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CollaborativeDocuments_Users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CollaborativeDocuments_Users_LastModifiedById",
                        column: x => x.LastModifiedById,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "DocumentCollaborators",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DocumentId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Role = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AddedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentCollaborators", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocumentCollaborators_CollaborativeDocuments_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "CollaborativeDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DocumentCollaborators_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "DocumentSnapshots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DocumentId = table.Column<int>(type: "int", nullable: false),
                    YjsState = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Version = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DocumentSnapshots_CollaborativeDocuments_DocumentId",
                        column: x => x.DocumentId,
                        principalTable: "CollaborativeDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_DocumentSnapshots_Users_CreatedById",
                        column: x => x.CreatedById,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_CollaborativeDocuments_CreatedById",
                table: "CollaborativeDocuments",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_CollaborativeDocuments_LastModifiedById",
                table: "CollaborativeDocuments",
                column: "LastModifiedById");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentCollaborators_DocumentId",
                table: "DocumentCollaborators",
                column: "DocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentCollaborators_UserId",
                table: "DocumentCollaborators",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentSnapshots_CreatedById",
                table: "DocumentSnapshots",
                column: "CreatedById");

            migrationBuilder.CreateIndex(
                name: "IX_DocumentSnapshots_DocumentId",
                table: "DocumentSnapshots",
                column: "DocumentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocumentCollaborators");

            migrationBuilder.DropTable(
                name: "DocumentSnapshots");

            migrationBuilder.DropTable(
                name: "CollaborativeDocuments");
        }
    }
}
