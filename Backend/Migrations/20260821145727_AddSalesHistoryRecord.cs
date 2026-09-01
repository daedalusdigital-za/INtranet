using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSalesHistoryRecord : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SalesHistoryRecords",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CustomerNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ShipmentNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    OrderNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    InvoiceDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SalesAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SourceCompany = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ImportBatchId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SourceFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IsReconciled = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesHistoryRecords", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalesHistoryRecords_CustomerName",
                table: "SalesHistoryRecords",
                column: "CustomerName");

            migrationBuilder.CreateIndex(
                name: "IX_SalesHistoryRecords_InvoiceDate",
                table: "SalesHistoryRecords",
                column: "InvoiceDate");

            migrationBuilder.CreateIndex(
                name: "IX_SalesHistoryRecords_InvoiceNumber",
                table: "SalesHistoryRecords",
                column: "InvoiceNumber");

            migrationBuilder.CreateIndex(
                name: "IX_SalesHistoryRecords_SourceCompany",
                table: "SalesHistoryRecords",
                column: "SourceCompany");

            migrationBuilder.CreateIndex(
                name: "IX_SalesHistoryRecords_SourceCompany_InvoiceDate",
                table: "SalesHistoryRecords",
                columns: new[] { "SourceCompany", "InvoiceDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SalesHistoryRecords");
        }
    }
}
