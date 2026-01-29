using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSleepOuts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GovernmentContracts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CompanyCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CompanyName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TenderNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Commodity = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    ContractDurationYears = table.Column<int>(type: "int", nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ExpiryDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    IssuingAuthority = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    EstimatedAnnualValue = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Category = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GovernmentContracts", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SalesImportBatches",
                columns: table => new
                {
                    ImportBatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UploadedBy = table.Column<int>(type: "int", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SourceFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    SourceCompany = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ParsingStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SummaryJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    TotalCustomers = table.Column<int>(type: "int", nullable: false),
                    TotalTransactions = table.Column<int>(type: "int", nullable: false),
                    DateMin = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DateMax = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SalesTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CostTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    CommittedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesImportBatches", x => x.ImportBatchId);
                });

            migrationBuilder.CreateTable(
                name: "SleepOuts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DriverId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    LoadId = table.Column<int>(type: "int", nullable: true),
                    ApprovedByUserId = table.Column<int>(type: "int", nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SleepOuts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SleepOuts_Drivers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "Drivers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SleepOuts_Loads_LoadId",
                        column: x => x.LoadId,
                        principalTable: "Loads",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "StockOnHandSnapshots",
                columns: table => new
                {
                    StockSnapshotId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    AsAtDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ItemCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ItemDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Location = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Uom = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    QtyOnHand = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    QtyOnPO = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    QtyOnSO = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    StockAvailable = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    TotalCostForQOH = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    UnitCostForQOH = table.Column<decimal>(type: "decimal(18,6)", nullable: true),
                    ImportBatchId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    RowIndex = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockOnHandSnapshots", x => x.StockSnapshotId);
                });

            migrationBuilder.CreateTable(
                name: "SalesImportIssues",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ImportBatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RowIndex = table.Column<int>(type: "int", nullable: false),
                    Severity = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Message = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    RawRowJson = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesImportIssues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalesImportIssues_SalesImportBatches_ImportBatchId",
                        column: x => x.ImportBatchId,
                        principalTable: "SalesImportBatches",
                        principalColumn: "ImportBatchId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SalesTransactionStagings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ImportBatchId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RowIndex = table.Column<int>(type: "int", nullable: false),
                    CustomerNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Year = table.Column<int>(type: "int", nullable: true),
                    Period = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TransactionNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Salesperson = table.Column<int>(type: "int", nullable: true),
                    Category = table.Column<int>(type: "int", nullable: true),
                    Location = table.Column<int>(type: "int", nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", nullable: true),
                    SalesAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    SalesReturns = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    CostOfSales = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Percent = table.Column<decimal>(type: "decimal(18,6)", nullable: true),
                    HasIssues = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SalesTransactionStagings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SalesTransactionStagings_SalesImportBatches_ImportBatchId",
                        column: x => x.ImportBatchId,
                        principalTable: "SalesImportBatches",
                        principalColumn: "ImportBatchId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SalesImportIssues_ImportBatchId",
                table: "SalesImportIssues",
                column: "ImportBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_SalesTransactionStagings_ImportBatchId",
                table: "SalesTransactionStagings",
                column: "ImportBatchId");

            migrationBuilder.CreateIndex(
                name: "IX_SleepOuts_DriverId",
                table: "SleepOuts",
                column: "DriverId");

            migrationBuilder.CreateIndex(
                name: "IX_SleepOuts_LoadId",
                table: "SleepOuts",
                column: "LoadId");

            migrationBuilder.CreateIndex(
                name: "IX_StockOnHandSnapshot_AsAtDate_Location_ItemCode",
                table: "StockOnHandSnapshots",
                columns: new[] { "OperatingCompanyId", "AsAtDate", "Location", "ItemCode" });

            migrationBuilder.CreateIndex(
                name: "IX_StockOnHandSnapshot_Unique",
                table: "StockOnHandSnapshots",
                columns: new[] { "OperatingCompanyId", "AsAtDate", "Location", "ItemCode", "Uom" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GovernmentContracts");

            migrationBuilder.DropTable(
                name: "SalesImportIssues");

            migrationBuilder.DropTable(
                name: "SalesTransactionStagings");

            migrationBuilder.DropTable(
                name: "SleepOuts");

            migrationBuilder.DropTable(
                name: "StockOnHandSnapshots");

            migrationBuilder.DropTable(
                name: "SalesImportBatches");
        }
    }
}
