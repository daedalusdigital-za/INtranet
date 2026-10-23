using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Manual unit-price override on a warehouse stock line (entered on the Stock Counts datasheet).
    /// Items with no invoice history have no derived price; this lets a user set one so stock value can be calculated.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261022140000_AddWarehouseInventoryUnitPrice")]
    public partial class AddWarehouseInventoryUnitPrice : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('WarehouseInventory','UnitPrice') IS NULL
    ALTER TABLE [WarehouseInventory] ADD [UnitPrice] decimal(18,2) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('WarehouseInventory','UnitPrice') IS NOT NULL
    ALTER TABLE [WarehouseInventory] DROP COLUMN [UnitPrice];
");
        }
    }
}
