using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Payment Schedule: the pay-run (Mon/Wed) a signed batch is booked on.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261117100000_AddPaymentBatchSchedule")]
    public partial class AddPaymentBatchSchedule : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatches','ScheduledPayDate') IS NULL
    ALTER TABLE PaymentBatches ADD ScheduledPayDate datetime2 NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF COL_LENGTH('PaymentBatches','ScheduledPayDate') IS NOT NULL ALTER TABLE PaymentBatches DROP COLUMN ScheduledPayDate;");
        }
    }
}
