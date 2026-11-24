using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>A payment the director rejected can be fixed and resubmitted on a new pack; this records which pack, so it's only done once.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261124170000_AddPaymentResubmittedAs")]
    public partial class AddPaymentResubmittedAs : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','ResubmittedAsBatchNumber') IS NULL ALTER TABLE PaymentBatchItems ADD ResubmittedAsBatchNumber nvarchar(20) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','ResubmittedAsBatchNumber') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN ResubmittedAsBatchNumber;
");
        }
    }
}
