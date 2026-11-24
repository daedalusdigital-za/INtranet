using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>The accountant's decision per payment (Approved / SentBack) with a reason, so one pack can be partly sent forward and partly sent back.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261124190000_AddAccountantItemDecisions")]
    public partial class AddAccountantItemDecisions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','AccountantDecision') IS NULL ALTER TABLE PaymentBatchItems ADD AccountantDecision nvarchar(20) NULL;
IF COL_LENGTH('PaymentBatchItems','AccountantDecisionComment') IS NULL ALTER TABLE PaymentBatchItems ADD AccountantDecisionComment nvarchar(1000) NULL;
IF COL_LENGTH('PaymentBatchItems','AccountantDecidedAt') IS NULL ALTER TABLE PaymentBatchItems ADD AccountantDecidedAt datetime2 NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','AccountantDecidedAt') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN AccountantDecidedAt;
IF COL_LENGTH('PaymentBatchItems','AccountantDecisionComment') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN AccountantDecisionComment;
IF COL_LENGTH('PaymentBatchItems','AccountantDecision') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN AccountantDecision;
");
        }
    }
}
