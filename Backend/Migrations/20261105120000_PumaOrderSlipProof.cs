using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Puma Garage has no TFN-style feed, so an order stays Open until the driver's filled slip
    /// (jpg/png photo) is uploaded as proof; only then can it be Closed.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261105120000_PumaOrderSlipProof")]
    public partial class PumaOrderSlipProof : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PumaGarageOrders', 'Status') IS NULL
    ALTER TABLE PumaGarageOrders ADD Status nvarchar(20) NOT NULL CONSTRAINT DF_PumaGarageOrders_Status DEFAULT 'Open';
IF COL_LENGTH('PumaGarageOrders', 'SlipFileName') IS NULL
    ALTER TABLE PumaGarageOrders ADD SlipFileName nvarchar(260) NULL;
IF COL_LENGTH('PumaGarageOrders', 'SlipStoredFileName') IS NULL
    ALTER TABLE PumaGarageOrders ADD SlipStoredFileName nvarchar(260) NULL;
IF COL_LENGTH('PumaGarageOrders', 'SlipContentType') IS NULL
    ALTER TABLE PumaGarageOrders ADD SlipContentType nvarchar(100) NULL;
IF COL_LENGTH('PumaGarageOrders', 'SlipUploadedAt') IS NULL
    ALTER TABLE PumaGarageOrders ADD SlipUploadedAt datetime2 NULL;
IF COL_LENGTH('PumaGarageOrders', 'SlipUploadedByUserId') IS NULL
    ALTER TABLE PumaGarageOrders ADD SlipUploadedByUserId int NULL;
IF COL_LENGTH('PumaGarageOrders', 'ClosedAt') IS NULL
    ALTER TABLE PumaGarageOrders ADD ClosedAt datetime2 NULL;
IF COL_LENGTH('PumaGarageOrders', 'ClosedByUserId') IS NULL
    ALTER TABLE PumaGarageOrders ADD ClosedByUserId int NULL;
IF COL_LENGTH('PumaGarageOrders', 'ClosedByName') IS NULL
    ALTER TABLE PumaGarageOrders ADD ClosedByName nvarchar(150) NULL;
");

            // Separate batch: the new columns must exist before this statement is compiled.
            // Historic sheet imports already happened (litres + value captured): treat them as closed.
            migrationBuilder.Sql(@"
UPDATE PumaGarageOrders SET Status = 'Closed', ClosedAt = ISNULL(UpdatedAt, CreatedAt)
WHERE Status = 'Open' AND LitersFilled IS NOT NULL AND Value IS NOT NULL AND CreatedAt < '2026-11-05';
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PumaGarageOrders', 'ClosedByName') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN ClosedByName;
IF COL_LENGTH('PumaGarageOrders', 'ClosedByUserId') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN ClosedByUserId;
IF COL_LENGTH('PumaGarageOrders', 'ClosedAt') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN ClosedAt;
IF COL_LENGTH('PumaGarageOrders', 'SlipUploadedByUserId') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN SlipUploadedByUserId;
IF COL_LENGTH('PumaGarageOrders', 'SlipUploadedAt') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN SlipUploadedAt;
IF COL_LENGTH('PumaGarageOrders', 'SlipContentType') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN SlipContentType;
IF COL_LENGTH('PumaGarageOrders', 'SlipStoredFileName') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN SlipStoredFileName;
IF COL_LENGTH('PumaGarageOrders', 'SlipFileName') IS NOT NULL ALTER TABLE PumaGarageOrders DROP COLUMN SlipFileName;
IF COL_LENGTH('PumaGarageOrders', 'Status') IS NOT NULL
BEGIN
    ALTER TABLE PumaGarageOrders DROP CONSTRAINT DF_PumaGarageOrders_Status;
    ALTER TABLE PumaGarageOrders DROP COLUMN Status;
END
");
        }
    }
}
