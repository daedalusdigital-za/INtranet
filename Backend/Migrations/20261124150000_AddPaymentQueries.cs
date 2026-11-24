using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Director queries on single payments: the question, the preparer/accountant's answer, and the pack a split-off payment came from.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261124150000_AddPaymentQueries")]
    public partial class AddPaymentQueries : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','QueryQuestion') IS NULL ALTER TABLE PaymentBatchItems ADD QueryQuestion nvarchar(1000) NULL;
IF COL_LENGTH('PaymentBatchItems','QueryAskedByName') IS NULL ALTER TABLE PaymentBatchItems ADD QueryAskedByName nvarchar(150) NULL;
IF COL_LENGTH('PaymentBatchItems','QueryAskedAt') IS NULL ALTER TABLE PaymentBatchItems ADD QueryAskedAt datetime2 NULL;
IF COL_LENGTH('PaymentBatchItems','QueryResponse') IS NULL ALTER TABLE PaymentBatchItems ADD QueryResponse nvarchar(2000) NULL;
IF COL_LENGTH('PaymentBatchItems','QueryRespondedByName') IS NULL ALTER TABLE PaymentBatchItems ADD QueryRespondedByName nvarchar(150) NULL;
IF COL_LENGTH('PaymentBatchItems','QueryRespondedAt') IS NULL ALTER TABLE PaymentBatchItems ADD QueryRespondedAt datetime2 NULL;
IF COL_LENGTH('PaymentBatchItems','QueriedFromBatchNumber') IS NULL ALTER TABLE PaymentBatchItems ADD QueriedFromBatchNumber nvarchar(20) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','QueriedFromBatchNumber') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN QueriedFromBatchNumber;
IF COL_LENGTH('PaymentBatchItems','QueryRespondedAt') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN QueryRespondedAt;
IF COL_LENGTH('PaymentBatchItems','QueryRespondedByName') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN QueryRespondedByName;
IF COL_LENGTH('PaymentBatchItems','QueryResponse') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN QueryResponse;
IF COL_LENGTH('PaymentBatchItems','QueryAskedAt') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN QueryAskedAt;
IF COL_LENGTH('PaymentBatchItems','QueryAskedByName') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN QueryAskedByName;
IF COL_LENGTH('PaymentBatchItems','QueryQuestion') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN QueryQuestion;
");
        }
    }
}
