using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddImportedInvoicesTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Address",
                table: "LogisticsCustomers",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerCode",
                table: "LogisticsCustomers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryAddress",
                table: "LogisticsCustomers",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryCity",
                table: "LogisticsCustomers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryPostalCode",
                table: "LogisticsCustomers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryProvince",
                table: "LogisticsCustomers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ImportBatches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BatchId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SourceSystem = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TotalRecords = table.Column<int>(type: "int", nullable: false),
                    SuccessfulRecords = table.Column<int>(type: "int", nullable: false),
                    FailedRecords = table.Column<int>(type: "int", nullable: false),
                    ImportedByUserId = table.Column<int>(type: "int", nullable: true),
                    ImportedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportBatches", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImportBatches_Users_ImportedByUserId",
                        column: x => x.ImportedByUserId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "ImportedInvoices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CustomerNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ProductCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ProductDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Year = table.Column<int>(type: "int", nullable: false),
                    Period = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    TransactionType = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TransactionNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Category = table.Column<int>(type: "int", nullable: true),
                    Location = table.Column<int>(type: "int", nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    SalesAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SalesReturns = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CostOfSales = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    MarginPercent = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    LoadId = table.Column<int>(type: "int", nullable: true),
                    CustomerId = table.Column<int>(type: "int", nullable: true),
                    DeliveryAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DeliveryCity = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DeliveryProvince = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DeliveryPostalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ContactPerson = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ContactPhone = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ContactEmail = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ScheduledDeliveryDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeliveryNotes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ImportedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ImportedByUserId = table.Column<int>(type: "int", nullable: true),
                    ImportBatchId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    SourceSystem = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ImportedInvoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ImportedInvoices_Loads_LoadId",
                        column: x => x.LoadId,
                        principalTable: "Loads",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ImportedInvoices_LogisticsCustomers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "LogisticsCustomers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ImportedInvoices_Users_ImportedByUserId",
                        column: x => x.ImportedByUserId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_ImportBatches_ImportedByUserId",
                table: "ImportBatches",
                column: "ImportedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportedInvoices_CustomerId",
                table: "ImportedInvoices",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportedInvoices_ImportedByUserId",
                table: "ImportedInvoices",
                column: "ImportedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ImportedInvoices_LoadId",
                table: "ImportedInvoices",
                column: "LoadId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ImportBatches");

            migrationBuilder.DropTable(
                name: "ImportedInvoices");

            migrationBuilder.DropColumn(
                name: "Address",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "CustomerCode",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "DeliveryAddress",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "DeliveryCity",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "DeliveryPostalCode",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "DeliveryProvince",
                table: "LogisticsCustomers");
        }
    }
}
