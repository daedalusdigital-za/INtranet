using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Google Place IDs returned by the Places Autocomplete / Geocoding APIs can exceed
    /// 100 characters (observed ~110). Widen the GooglePlaceId columns to nvarchar(500)
    /// so admin address verification does not fail with "string would be truncated".
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261022120000_WidenGooglePlaceId")]
    public partial class WidenGooglePlaceId : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('LogisticsCustomers','GooglePlaceId') IS NOT NULL AND COL_LENGTH('LogisticsCustomers','GooglePlaceId') < 1000
    ALTER TABLE [LogisticsCustomers] ALTER COLUMN [GooglePlaceId] nvarchar(500) NULL;

IF COL_LENGTH('CustomerDeliveryAddresses','GooglePlaceId') IS NOT NULL AND COL_LENGTH('CustomerDeliveryAddresses','GooglePlaceId') < 1000
    ALTER TABLE [CustomerDeliveryAddresses] ALTER COLUMN [GooglePlaceId] nvarchar(500) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally left non-destructive: shrinking would risk truncating stored IDs.
        }
    }
}
