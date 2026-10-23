using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Admin Settings → Client Locations: address verification flags on customers and
    /// their saved delivery addresses, plus a SystemSettings key/value table for the
    /// admin-editable Google Maps API key. Written as guarded raw SQL (idempotent)
    /// in line with the other hand-written migrations in this project.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261022090000_AddClientLocationVerification")]
    public partial class AddClientLocationVerification : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('LogisticsCustomers','AddressVerifiedBy') IS NULL
    ALTER TABLE [LogisticsCustomers] ADD [AddressVerifiedBy] nvarchar(200) NULL;

IF COL_LENGTH('CustomerDeliveryAddresses','IsVerified') IS NULL
    ALTER TABLE [CustomerDeliveryAddresses] ADD [IsVerified] bit NOT NULL CONSTRAINT [DF_CustomerDeliveryAddresses_IsVerified] DEFAULT 0;
IF COL_LENGTH('CustomerDeliveryAddresses','VerifiedAt') IS NULL
    ALTER TABLE [CustomerDeliveryAddresses] ADD [VerifiedAt] datetime2 NULL;
IF COL_LENGTH('CustomerDeliveryAddresses','VerifiedBy') IS NULL
    ALTER TABLE [CustomerDeliveryAddresses] ADD [VerifiedBy] nvarchar(200) NULL;

IF OBJECT_ID('SystemSettings','U') IS NULL
BEGIN
    CREATE TABLE [SystemSettings] (
        [Key] nvarchar(100) NOT NULL CONSTRAINT [PK_SystemSettings] PRIMARY KEY,
        [Value] nvarchar(max) NULL,
        [Description] nvarchar(500) NULL,
        [UpdatedAt] datetime2 NOT NULL CONSTRAINT [DF_SystemSettings_UpdatedAt] DEFAULT (SYSUTCDATETIME()),
        [UpdatedBy] nvarchar(200) NULL
    );
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('LogisticsCustomers','AddressVerifiedBy') IS NOT NULL
    ALTER TABLE [LogisticsCustomers] DROP COLUMN [AddressVerifiedBy];
IF COL_LENGTH('CustomerDeliveryAddresses','IsVerified') IS NOT NULL BEGIN
    ALTER TABLE [CustomerDeliveryAddresses] DROP CONSTRAINT [DF_CustomerDeliveryAddresses_IsVerified];
    ALTER TABLE [CustomerDeliveryAddresses] DROP COLUMN [IsVerified];
END
IF COL_LENGTH('CustomerDeliveryAddresses','VerifiedAt') IS NOT NULL
    ALTER TABLE [CustomerDeliveryAddresses] DROP COLUMN [VerifiedAt];
IF COL_LENGTH('CustomerDeliveryAddresses','VerifiedBy') IS NOT NULL
    ALTER TABLE [CustomerDeliveryAddresses] DROP COLUMN [VerifiedBy];
IF OBJECT_ID('SystemSettings','U') IS NOT NULL
    DROP TABLE [SystemSettings];
");
        }
    }
}
