using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesTripSheets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SalesTripSheets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TripSheetNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    WarehouseCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    WarehouseId = table.Column<int>(type: "int", nullable: true),
                    RouteArea = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ScheduledDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CheckedByUserId = table.Column<int>(type: "int", nullable: true),
                    CheckedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CheckedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApprovalNotes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    RejectionReason = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ConvertedLoadId = table.Column<int>(type: "int", nullable: true),
                    ConvertedLoadNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesTripSheets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SalesTripSheetLines",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SalesTripSheetId = table.Column<int>(type: "int", nullable: false),
                    Sequence = table.Column<int>(type: "int", nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Province = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ContactPerson = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ContactPhone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ProductDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Value = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesTripSheetLines", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalesTripSheetLines_SalesTripSheets_SalesTripSheetId",
                        column: x => x.SalesTripSheetId,
                        principalTable: "SalesTripSheets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalesTripSheetLines_SalesTripSheetId",
                table: "SalesTripSheetLines",
                column: "SalesTripSheetId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SalesTripSheetLines");

            migrationBuilder.DropTable(
                name: "SalesTripSheets");
        }
    }
}
