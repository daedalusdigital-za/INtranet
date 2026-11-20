using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Who the preparer / accountant chose to send the pack to (subset of the company's approvers).</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261120090000_AddPaymentBatchRequestedApprovers")]
    public partial class AddPaymentBatchRequestedApprovers : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatches','RequestedApproverIds') IS NULL   ALTER TABLE PaymentBatches ADD RequestedApproverIds nvarchar(200) NULL;
IF COL_LENGTH('PaymentBatches','RequestedApproverNames') IS NULL ALTER TABLE PaymentBatches ADD RequestedApproverNames nvarchar(600) NULL;
IF COL_LENGTH('PaymentBatches','RequestedDirectorIds') IS NULL   ALTER TABLE PaymentBatches ADD RequestedDirectorIds nvarchar(200) NULL;
IF COL_LENGTH('PaymentBatches','RequestedDirectorNames') IS NULL ALTER TABLE PaymentBatches ADD RequestedDirectorNames nvarchar(600) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatches','RequestedApproverIds') IS NOT NULL   ALTER TABLE PaymentBatches DROP COLUMN RequestedApproverIds;
IF COL_LENGTH('PaymentBatches','RequestedApproverNames') IS NOT NULL ALTER TABLE PaymentBatches DROP COLUMN RequestedApproverNames;
IF COL_LENGTH('PaymentBatches','RequestedDirectorIds') IS NOT NULL   ALTER TABLE PaymentBatches DROP COLUMN RequestedDirectorIds;
IF COL_LENGTH('PaymentBatches','RequestedDirectorNames') IS NOT NULL ALTER TABLE PaymentBatches DROP COLUMN RequestedDirectorNames;
");
        }
    }
}
