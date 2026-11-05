using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// A load can now be an internal warehouse-to-warehouse movement: LoadType = 'InternalTransfer',
    /// WarehouseId is the source and DestinationWarehouseId the receiving warehouse. Dispatching such a
    /// load posts Transfer (out) rows to the stock ledger; receiving posts the matching Transfer (in) rows.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261104090000_LoadInternalTransfer")]
    public partial class LoadInternalTransfer : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Loads', 'LoadType') IS NULL
    ALTER TABLE Loads ADD LoadType nvarchar(30) NULL;
IF COL_LENGTH('Loads', 'DestinationWarehouseId') IS NULL
    ALTER TABLE Loads ADD DestinationWarehouseId int NULL;
");
            // Separate batch: the index references a column the previous batch only just added.
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Loads_LoadType' AND object_id = OBJECT_ID('Loads'))
    EXEC('CREATE INDEX IX_Loads_LoadType ON Loads (LoadType) WHERE LoadType IS NOT NULL');
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Loads_LoadType' AND object_id = OBJECT_ID('Loads')) DROP INDEX IX_Loads_LoadType ON Loads;
IF COL_LENGTH('Loads', 'DestinationWarehouseId') IS NOT NULL ALTER TABLE Loads DROP COLUMN DestinationWarehouseId;
IF COL_LENGTH('Loads', 'LoadType') IS NOT NULL ALTER TABLE Loads DROP COLUMN LoadType;
");
        }
    }
}
