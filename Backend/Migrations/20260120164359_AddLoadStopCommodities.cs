using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddLoadStopCommodities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Loads_Warehouses_SourceWarehouseId",
                table: "Loads");

            migrationBuilder.RenameColumn(
                name: "SourceWarehouseId",
                table: "Loads",
                newName: "WarehouseId");

            migrationBuilder.RenameIndex(
                name: "IX_Loads_SourceWarehouseId",
                table: "Loads",
                newName: "IX_Loads_WarehouseId");

            migrationBuilder.AlterColumn<decimal>(
                name: "Longitude",
                table: "LoadStops",
                type: "decimal(10,7)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Latitude",
                table: "LoadStops",
                type: "decimal(10,7)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CompanyName",
                table: "LoadStops",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                table: "LoadStops",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CustomerId",
                table: "LoadStops",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "LoadStops",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "OrderNumber",
                table: "LoadStops",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Province",
                table: "LoadStops",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "WarehouseId",
                table: "LoadStops",
                type: "int",
                nullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "EstimatedDistance",
                table: "Loads",
                type: "decimal(10,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "CustomerId",
                table: "Loads",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<decimal>(
                name: "ActualDistance",
                table: "Loads",
                type: "decimal(10,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(18,2)",
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ActualTimeMinutes",
                table: "Loads",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "Loads",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DeliveryLatitude",
                table: "Loads",
                type: "decimal(10,7)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryLocation",
                table: "Loads",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DeliveryLongitude",
                table: "Loads",
                type: "decimal(10,7)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EstimatedTimeMinutes",
                table: "Loads",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PickupLatitude",
                table: "Loads",
                type: "decimal(10,7)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PickupLocation",
                table: "Loads",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PickupLongitude",
                table: "Loads",
                type: "decimal(10,7)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "Loads",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ScheduledDeliveryTime",
                table: "Loads",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ScheduledPickupTime",
                table: "Loads",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalVolume",
                table: "Loads",
                type: "decimal(18,3)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TotalWeight",
                table: "Loads",
                type: "decimal(18,3)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VehicleTypeId",
                table: "Loads",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "StopCommodities",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LoadStopId = table.Column<int>(type: "int", nullable: false),
                    CommodityId = table.Column<int>(type: "int", nullable: false),
                    ContractId = table.Column<int>(type: "int", nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    UnitOfMeasure = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    TotalPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Weight = table.Column<decimal>(type: "decimal(18,3)", nullable: true),
                    Volume = table.Column<decimal>(type: "decimal(18,3)", nullable: true),
                    OrderNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StopCommodities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StopCommodities_Commodities_CommodityId",
                        column: x => x.CommodityId,
                        principalTable: "Commodities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StopCommodities_CustomerContracts_ContractId",
                        column: x => x.ContractId,
                        principalTable: "CustomerContracts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StopCommodities_LoadStops_LoadStopId",
                        column: x => x.LoadStopId,
                        principalTable: "LoadStops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoadStops_CustomerId",
                table: "LoadStops",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_LoadStops_WarehouseId",
                table: "LoadStops",
                column: "WarehouseId");

            migrationBuilder.CreateIndex(
                name: "IX_Loads_VehicleTypeId",
                table: "Loads",
                column: "VehicleTypeId");

            migrationBuilder.CreateIndex(
                name: "IX_StopCommodities_CommodityId",
                table: "StopCommodities",
                column: "CommodityId");

            migrationBuilder.CreateIndex(
                name: "IX_StopCommodities_ContractId",
                table: "StopCommodities",
                column: "ContractId");

            migrationBuilder.CreateIndex(
                name: "IX_StopCommodities_LoadStopId",
                table: "StopCommodities",
                column: "LoadStopId");

            migrationBuilder.AddForeignKey(
                name: "FK_Loads_VehicleTypes_VehicleTypeId",
                table: "Loads",
                column: "VehicleTypeId",
                principalTable: "VehicleTypes",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Loads_Warehouses_WarehouseId",
                table: "Loads",
                column: "WarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_LoadStops_LogisticsCustomers_CustomerId",
                table: "LoadStops",
                column: "CustomerId",
                principalTable: "LogisticsCustomers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_LoadStops_Warehouses_WarehouseId",
                table: "LoadStops",
                column: "WarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Loads_VehicleTypes_VehicleTypeId",
                table: "Loads");

            migrationBuilder.DropForeignKey(
                name: "FK_Loads_Warehouses_WarehouseId",
                table: "Loads");

            migrationBuilder.DropForeignKey(
                name: "FK_LoadStops_LogisticsCustomers_CustomerId",
                table: "LoadStops");

            migrationBuilder.DropForeignKey(
                name: "FK_LoadStops_Warehouses_WarehouseId",
                table: "LoadStops");

            migrationBuilder.DropTable(
                name: "StopCommodities");

            migrationBuilder.DropIndex(
                name: "IX_LoadStops_CustomerId",
                table: "LoadStops");

            migrationBuilder.DropIndex(
                name: "IX_LoadStops_WarehouseId",
                table: "LoadStops");

            migrationBuilder.DropIndex(
                name: "IX_Loads_VehicleTypeId",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "CompanyName",
                table: "LoadStops");

            migrationBuilder.DropColumn(
                name: "ContactEmail",
                table: "LoadStops");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                table: "LoadStops");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "LoadStops");

            migrationBuilder.DropColumn(
                name: "OrderNumber",
                table: "LoadStops");

            migrationBuilder.DropColumn(
                name: "Province",
                table: "LoadStops");

            migrationBuilder.DropColumn(
                name: "WarehouseId",
                table: "LoadStops");

            migrationBuilder.DropColumn(
                name: "ActualTimeMinutes",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "DeliveryLatitude",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "DeliveryLocation",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "DeliveryLongitude",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "EstimatedTimeMinutes",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "PickupLatitude",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "PickupLocation",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "PickupLongitude",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "ScheduledDeliveryTime",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "ScheduledPickupTime",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "TotalVolume",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "TotalWeight",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "VehicleTypeId",
                table: "Loads");

            migrationBuilder.RenameColumn(
                name: "WarehouseId",
                table: "Loads",
                newName: "SourceWarehouseId");

            migrationBuilder.RenameIndex(
                name: "IX_Loads_WarehouseId",
                table: "Loads",
                newName: "IX_Loads_SourceWarehouseId");

            migrationBuilder.AlterColumn<decimal>(
                name: "Longitude",
                table: "LoadStops",
                type: "decimal(18,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(10,7)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "Latitude",
                table: "LoadStops",
                type: "decimal(18,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(10,7)",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "EstimatedDistance",
                table: "Loads",
                type: "decimal(18,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(10,2)",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "CustomerId",
                table: "Loads",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "ActualDistance",
                table: "Loads",
                type: "decimal(18,2)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "decimal(10,2)",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Loads_Warehouses_SourceWarehouseId",
                table: "Loads",
                column: "SourceWarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id");
        }
    }
}
