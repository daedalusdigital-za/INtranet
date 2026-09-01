using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRequisitionFinanceStatus : Migration
    {
        // Idempotent column additions (see AddRecurringPayments for rationale on
        // why migrations are written as guarded raw SQL against schema drift).
        // Adds the finance payment-workflow fields to the Requisitions table.

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Requisitions','FinanceStatus') IS NULL
    ALTER TABLE [Requisitions] ADD [FinanceStatus] nvarchar(20) NOT NULL CONSTRAINT [DF_Requisitions_FinanceStatus] DEFAULT N'Requested';
IF COL_LENGTH('Requisitions','PaidDate') IS NULL
    ALTER TABLE [Requisitions] ADD [PaidDate] datetime2 NULL;
IF COL_LENGTH('Requisitions','FinanceNotes') IS NULL
    ALTER TABLE [Requisitions] ADD [FinanceNotes] nvarchar(1000) NULL;
IF COL_LENGTH('Requisitions','Department') IS NULL
    ALTER TABLE [Requisitions] ADD [Department] nvarchar(100) NULL CONSTRAINT [DF_Requisitions_Department] DEFAULT N'Logistics';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Requisitions','FinanceStatus') IS NOT NULL BEGIN
    ALTER TABLE [Requisitions] DROP CONSTRAINT [DF_Requisitions_FinanceStatus];
    ALTER TABLE [Requisitions] DROP COLUMN [FinanceStatus];
END
IF COL_LENGTH('Requisitions','PaidDate') IS NOT NULL
    ALTER TABLE [Requisitions] DROP COLUMN [PaidDate];
IF COL_LENGTH('Requisitions','FinanceNotes') IS NOT NULL
    ALTER TABLE [Requisitions] DROP COLUMN [FinanceNotes];
IF COL_LENGTH('Requisitions','Department') IS NOT NULL BEGIN
    ALTER TABLE [Requisitions] DROP CONSTRAINT [DF_Requisitions_Department];
    ALTER TABLE [Requisitions] DROP COLUMN [Department];
END
");
        }
    }
}
