using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Compliance payments: the sub-kind (Invoice / Licence / CrossBorder / Other) and the "Other" description per payment.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261124120000_AddCompliancePayments")]
    public partial class AddCompliancePayments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','ComplianceKind') IS NULL ALTER TABLE PaymentBatchItems ADD ComplianceKind nvarchar(20) NULL;
IF COL_LENGTH('PaymentBatchItems','ComplianceDetail') IS NULL ALTER TABLE PaymentBatchItems ADD ComplianceDetail nvarchar(200) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','ComplianceDetail') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN ComplianceDetail;
IF COL_LENGTH('PaymentBatchItems','ComplianceKind') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN ComplianceKind;
");
        }
    }
}
