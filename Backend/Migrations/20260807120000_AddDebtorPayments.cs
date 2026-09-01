using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDebtorPayments : Migration
    {
        // Idempotent single-table migration (see AddRecurringPayments for rationale).
        // Creates the DebtorPayments table used to record customer collections/receipts
        // against sales receivables per company.

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[DebtorPayments]', N'U') IS NULL
BEGIN
    CREATE TABLE [DebtorPayments] (
        [Id] int NOT NULL IDENTITY(1,1),
        [CustomerNumber] nvarchar(50) NOT NULL,
        [CustomerName] nvarchar(200) NULL,
        [SourceCompany] nvarchar(10) NULL,
        [Amount] decimal(18,2) NOT NULL,
        [PaymentDate] datetime2 NOT NULL,
        [PaymentMethod] nvarchar(50) NULL,
        [PaymentReference] nvarchar(100) NULL,
        [Notes] nvarchar(1000) NULL,
        [RecordedByUserId] int NULL,
        [RecordedByName] nvarchar(150) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_DebtorPayments] PRIMARY KEY ([Id])
    );
    CREATE INDEX [IX_DebtorPayments_CustomerNumber] ON [DebtorPayments] ([CustomerNumber]);
    CREATE INDEX [IX_DebtorPayments_SourceCompany] ON [DebtorPayments] ([SourceCompany]);
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[DebtorPayments]', N'U') IS NOT NULL
    DROP TABLE [DebtorPayments];
");
        }
    }
}
