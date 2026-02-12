using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderCancellations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StockOnHandSnapshots");

            migrationBuilder.CreateTable(
                name: "OrderCancellations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ImportedInvoiceId = table.Column<int>(type: "int", nullable: true),
                    CustomerNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CustomerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CustomerId = table.Column<int>(type: "int", nullable: true),
                    OrderAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ItemCount = table.Column<int>(type: "int", nullable: false),
                    OriginalOrderDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CancellationReason = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CancellationNotes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CancelledAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CancelledByUserId = table.Column<int>(type: "int", nullable: false),
                    CancelledByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ApprovalStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ApprovedByUserId = table.Column<int>(type: "int", nullable: true),
                    ApprovedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ApprovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ApprovalNotes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    RefundAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    RefundProcessed = table.Column<bool>(type: "bit", nullable: false),
                    RefundProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CompanyCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderCancellations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderCancellations_ImportedInvoices_ImportedInvoiceId",
                        column: x => x.ImportedInvoiceId,
                        principalTable: "ImportedInvoices",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderCancellations_LogisticsCustomers_CustomerId",
                        column: x => x.CustomerId,
                        principalTable: "LogisticsCustomers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_OrderCancellations_Users_ApprovedByUserId",
                        column: x => x.ApprovedByUserId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                    table.ForeignKey(
                        name: "FK_OrderCancellations_Users_CancelledByUserId",
                        column: x => x.CancelledByUserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WarehouseBuildings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WarehouseId = table.Column<int>(type: "int", nullable: false),
                    Code = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ManagerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PhoneNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TotalCapacity = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    AvailableCapacity = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WarehouseBuildings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WarehouseBuildings_Warehouses_WarehouseId",
                        column: x => x.WarehouseId,
                        principalTable: "Warehouses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BuildingInventory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BuildingId = table.Column<int>(type: "int", nullable: false),
                    ItemCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ItemDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Uom = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    QuantityOnHand = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuantityReserved = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    QuantityOnOrder = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ReorderLevel = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    MaxLevel = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    UnitCost = table.Column<decimal>(type: "decimal(18,6)", nullable: true),
                    BinLocation = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    LastMovementDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastCountDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BuildingInventory", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BuildingInventory_WarehouseBuildings_BuildingId",
                        column: x => x.BuildingId,
                        principalTable: "WarehouseBuildings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StockMovements",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MovementType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FromBuildingId = table.Column<int>(type: "int", nullable: true),
                    ToBuildingId = table.Column<int>(type: "int", nullable: true),
                    ItemCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ItemDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Uom = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedById = table.Column<int>(type: "int", nullable: true),
                    CreatedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockMovements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StockMovements_WarehouseBuildings_FromBuildingId",
                        column: x => x.FromBuildingId,
                        principalTable: "WarehouseBuildings",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StockMovements_WarehouseBuildings_ToBuildingId",
                        column: x => x.ToBuildingId,
                        principalTable: "WarehouseBuildings",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_BuildingInventory_BuildingId",
                table: "BuildingInventory",
                column: "BuildingId");

            migrationBuilder.CreateIndex(
                name: "IX_BuildingInventory_ItemCode",
                table: "BuildingInventory",
                column: "ItemCode");

            migrationBuilder.CreateIndex(
                name: "UQ_BuildingInventory_Building_Item",
                table: "BuildingInventory",
                columns: new[] { "BuildingId", "ItemCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderCancellations_ApprovedByUserId",
                table: "OrderCancellations",
                column: "ApprovedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderCancellations_CancelledByUserId",
                table: "OrderCancellations",
                column: "CancelledByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderCancellations_CustomerId",
                table: "OrderCancellations",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_OrderCancellations_ImportedInvoiceId",
                table: "OrderCancellations",
                column: "ImportedInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_CreatedAt",
                table: "StockMovements",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_FromBuildingId",
                table: "StockMovements",
                column: "FromBuildingId");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_ItemCode",
                table: "StockMovements",
                column: "ItemCode");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_ToBuildingId",
                table: "StockMovements",
                column: "ToBuildingId");

            migrationBuilder.CreateIndex(
                name: "IX_WarehouseBuildings_WarehouseId",
                table: "WarehouseBuildings",
                column: "WarehouseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BuildingInventory");

            migrationBuilder.DropTable(
                name: "OrderCancellations");

            migrationBuilder.DropTable(
                name: "StockMovements");

            migrationBuilder.DropTable(
                name: "WarehouseBuildings");

            migrationBuilder.CreateTable(
                name: "StockOnHandSnapshots",
                columns: table => new
                {
                    StockSnapshotId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AsAtDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ImportBatchId = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ItemCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ItemDescription = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Location = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    QtyOnHand = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    QtyOnPO = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    QtyOnSO = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    RowIndex = table.Column<int>(type: "int", nullable: true),
                    StockAvailable = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    TotalCostForQOH = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    UnitCostForQOH = table.Column<decimal>(type: "decimal(18,6)", nullable: true),
                    Uom = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockOnHandSnapshots", x => x.StockSnapshotId);
                });

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
    }
}
