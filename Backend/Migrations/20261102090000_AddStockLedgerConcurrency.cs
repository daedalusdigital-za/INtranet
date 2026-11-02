using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Stops two simultaneous stock postings from overwriting each other's balance (row version on
    /// WarehouseInventory) and a load from being deducted twice (one live Dispatch row per load and item).
    /// The index is skipped while duplicate live dispatches already exist, so boot never fails on old data;
    /// reverse the duplicates and it is created on the next start.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261102090000_AddStockLedgerConcurrency")]
    public partial class AddStockLedgerConcurrency : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[WarehouseInventory]') IS NOT NULL AND COL_LENGTH('WarehouseInventory','RowVersion') IS NULL
    ALTER TABLE [WarehouseInventory] ADD [RowVersion] rowversion NOT NULL;
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[WarehouseStockMovements]') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_WarehouseStockMovements_LiveDispatch')
   AND NOT EXISTS (
        SELECT 1 FROM [WarehouseStockMovements]
         WHERE [MovementType] = N'Dispatch' AND [Status] = N'Approved' AND [ReversedByMovementId] IS NULL AND [LoadId] IS NOT NULL
         GROUP BY [LoadId], [CommodityId] HAVING COUNT(*) > 1)
    EXEC(N'SET QUOTED_IDENTIFIER ON; SET ANSI_NULLS ON;
           CREATE UNIQUE INDEX [UX_WarehouseStockMovements_LiveDispatch] ON [WarehouseStockMovements] ([LoadId], [CommodityId])
           WHERE [MovementType] = N''Dispatch'' AND [Status] = N''Approved'' AND [ReversedByMovementId] IS NULL AND [LoadId] IS NOT NULL');
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_WarehouseStockMovements_LiveDispatch')
    DROP INDEX [UX_WarehouseStockMovements_LiveDispatch] ON [WarehouseStockMovements];
IF COL_LENGTH('WarehouseInventory','RowVersion') IS NOT NULL
    ALTER TABLE [WarehouseInventory] DROP COLUMN [RowVersion];
");
        }
    }
}
