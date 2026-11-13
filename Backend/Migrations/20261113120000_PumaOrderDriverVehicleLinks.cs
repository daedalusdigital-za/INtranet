using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Link Puma Garage orders to the fleet vehicle (by registration) and driver record (by name),
    /// so fuel history, driver and vehicle views can roll Puma fills up properly.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261113120000_PumaOrderDriverVehicleLinks")]
    public partial class PumaOrderDriverVehicleLinks : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PumaGarageOrders', 'VehicleId') IS NULL
    ALTER TABLE PumaGarageOrders ADD VehicleId int NULL;
IF COL_LENGTH('PumaGarageOrders', 'DriverId') IS NULL
    ALTER TABLE PumaGarageOrders ADD DriverId int NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PumaGarageOrders_VehicleId')
    CREATE INDEX IX_PumaGarageOrders_VehicleId ON PumaGarageOrders(VehicleId);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PumaGarageOrders_DriverId')
    CREATE INDEX IX_PumaGarageOrders_DriverId ON PumaGarageOrders(DriverId);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PumaGarageOrders_DriverId') DROP INDEX IX_PumaGarageOrders_DriverId ON PumaGarageOrders;
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PumaGarageOrders_VehicleId') DROP INDEX IX_PumaGarageOrders_VehicleId ON PumaGarageOrders;
IF COL_LENGTH('PumaGarageOrders', 'DriverId') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN DriverId;
IF COL_LENGTH('PumaGarageOrders', 'VehicleId') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN VehicleId;
");
        }
    }
}
