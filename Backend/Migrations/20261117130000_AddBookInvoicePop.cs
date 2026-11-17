using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Treasury attaches a proof of payment to a supplier invoice after paying it.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261117130000_AddBookInvoicePop")]
    public partial class AddBookInvoicePop : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('BookInvoices','PopFilePath') IS NULL ALTER TABLE BookInvoices ADD PopFilePath nvarchar(500) NULL;
IF COL_LENGTH('BookInvoices','PopFileName') IS NULL ALTER TABLE BookInvoices ADD PopFileName nvarchar(255) NULL;
IF COL_LENGTH('BookInvoices','PopContentType') IS NULL ALTER TABLE BookInvoices ADD PopContentType nvarchar(100) NULL;
IF COL_LENGTH('BookInvoices','PopUploadedAt') IS NULL ALTER TABLE BookInvoices ADD PopUploadedAt datetime2 NULL;
IF COL_LENGTH('BookInvoices','PopUploadedByName') IS NULL ALTER TABLE BookInvoices ADD PopUploadedByName nvarchar(200) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('BookInvoices','PopFilePath') IS NOT NULL ALTER TABLE BookInvoices DROP COLUMN PopFilePath, PopFileName, PopContentType, PopUploadedAt, PopUploadedByName;");
        }
    }
}
