using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261112220000_AddInvoicePackValidation")]
    public partial class AddInvoicePackValidation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('InvoicePacks','ConfirmationNumber') IS NULL ALTER TABLE [InvoicePacks] ADD [ConfirmationNumber] nvarchar(50) NULL;
IF COL_LENGTH('InvoicePacks','ValidationStatus') IS NULL ALTER TABLE [InvoicePacks] ADD [ValidationStatus] nvarchar(20) NULL;
IF COL_LENGTH('InvoicePacks','ValidationJson') IS NULL ALTER TABLE [InvoicePacks] ADD [ValidationJson] nvarchar(max) NULL;
IF COL_LENGTH('InvoicePacks','ProofOfDelivery') IS NULL ALTER TABLE [InvoicePacks] ADD [ProofOfDelivery] bit NOT NULL CONSTRAINT DF_InvoicePacks_ProofOfDelivery DEFAULT 0;
IF COL_LENGTH('InvoicePacks','PartDelivery') IS NULL ALTER TABLE [InvoicePacks] ADD [PartDelivery] bit NOT NULL CONSTRAINT DF_InvoicePacks_PartDelivery DEFAULT 0;
IF COL_LENGTH('InvoicePacks','AmendedOrder') IS NULL ALTER TABLE [InvoicePacks] ADD [AmendedOrder] bit NOT NULL CONSTRAINT DF_InvoicePacks_AmendedOrder DEFAULT 0;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
ALTER TABLE [InvoicePacks] DROP CONSTRAINT IF EXISTS DF_InvoicePacks_ProofOfDelivery, DF_InvoicePacks_PartDelivery, DF_InvoicePacks_AmendedOrder;
ALTER TABLE [InvoicePacks] DROP COLUMN IF EXISTS [ConfirmationNumber], [ValidationStatus], [ValidationJson], [ProofOfDelivery], [PartDelivery], [AmendedOrder];");
        }
    }
}
