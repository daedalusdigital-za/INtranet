using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPartDeliveryHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PartDeliveryHistories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ImportedInvoiceId = table.Column<int>(type: "int", nullable: false),
                    QuantityDelivered = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    LoadId = table.Column<int>(type: "int", nullable: true),
                    DriverId = table.Column<int>(type: "int", nullable: true),
                    VehicleId = table.Column<int>(type: "int", nullable: true),
                    DeliveredAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RecordedByUserId = table.Column<int>(type: "int", nullable: true),
                    RecordedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PartDeliveryHistories", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PartDeliveryHistories_Drivers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "Drivers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PartDeliveryHistories_ImportedInvoices_ImportedInvoiceId",
                        column: x => x.ImportedInvoiceId,
                        principalTable: "ImportedInvoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PartDeliveryHistories_Loads_LoadId",
                        column: x => x.LoadId,
                        principalTable: "Loads",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PartDeliveryHistories_Vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "Vehicles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_PartDeliveryHistories_DriverId",
                table: "PartDeliveryHistories",
                column: "DriverId");

            migrationBuilder.CreateIndex(
                name: "IX_PartDeliveryHistories_ImportedInvoiceId",
                table: "PartDeliveryHistories",
                column: "ImportedInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PartDeliveryHistories_LoadId",
                table: "PartDeliveryHistories",
                column: "LoadId");

            migrationBuilder.CreateIndex(
                name: "IX_PartDeliveryHistories_VehicleId",
                table: "PartDeliveryHistories",
                column: "VehicleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PartDeliveryHistories");
        }
    }
}
