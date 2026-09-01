using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesHistoryLineItemsAndMargin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "GrossProfit",
                table: "SalesHistoryRecords",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "HasLineDetail",
                table: "SalesHistoryRecords",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "MarginPercent",
                table: "SalesHistoryRecords",
                type: "decimal(9,4)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalCost",
                table: "SalesHistoryRecords",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SalesHistoryLineItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SalesHistoryRecordId = table.Column<int>(type: "int", nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CustomerNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ItemCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RegCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    InvoiceDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SalesAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,6)", nullable: false),
                    ExtCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ItemCategory = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SourceCompany = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ImportBatchId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesHistoryLineItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalesHistoryLineItems_SalesHistoryRecords_SalesHistoryRecordId",
                        column: x => x.SalesHistoryRecordId,
                        principalTable: "SalesHistoryRecords",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalesHistoryLineItems_InvoiceNumber",
                table: "SalesHistoryLineItems",
                column: "InvoiceNumber");

            migrationBuilder.CreateIndex(
                name: "IX_SalesHistoryLineItems_ItemCode",
                table: "SalesHistoryLineItems",
                column: "ItemCode");

            migrationBuilder.CreateIndex(
                name: "IX_SalesHistoryLineItems_SalesHistoryRecordId",
                table: "SalesHistoryLineItems",
                column: "SalesHistoryRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesHistoryLineItems_SourceCompany",
                table: "SalesHistoryLineItems",
                column: "SourceCompany");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SalesHistoryLineItems");

            migrationBuilder.DropColumn(
                name: "GrossProfit",
                table: "SalesHistoryRecords");

            migrationBuilder.DropColumn(
                name: "HasLineDetail",
                table: "SalesHistoryRecords");

            migrationBuilder.DropColumn(
                name: "MarginPercent",
                table: "SalesHistoryRecords");

            migrationBuilder.DropColumn(
                name: "TotalCost",
                table: "SalesHistoryRecords");
        }
    }
}
