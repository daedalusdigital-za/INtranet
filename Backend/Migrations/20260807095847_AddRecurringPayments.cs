using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddRecurringPayments : Migration
    {
        // NOTE: The auto-generated migration was trimmed to ONLY create the
        // RecurringPayments table. The EF model snapshot was significantly behind
        // the live database (many tables/columns were created via raw SQL scripts),
        // so the full auto-generated Up() tried to recreate existing objects and
        // failed with duplicate-column/object errors. This idempotent migration
        // creates just the one new table this feature needs.

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[RecurringPayments]', N'U') IS NULL
BEGIN
    CREATE TABLE [RecurringPayments] (
        [Id] int NOT NULL IDENTITY(1,1),
        [Name] nvarchar(300) NOT NULL,
        [Supplier] nvarchar(300) NULL,
        [Category] nvarchar(100) NOT NULL,
        [Amount] decimal(18,2) NOT NULL,
        [Currency] nvarchar(10) NOT NULL,
        [Frequency] nvarchar(50) NOT NULL,
        [DayOfMonth] int NULL,
        [DepartmentId] int NULL,
        [CompanyName] nvarchar(200) NULL,
        [PaymentMethod] nvarchar(100) NULL,
        [AccountReference] nvarchar(200) NULL,
        [IsActive] bit NOT NULL,
        [StartDate] datetime2 NOT NULL,
        [EndDate] datetime2 NULL,
        [Notes] nvarchar(2000) NULL,
        [CreatedByUserId] int NULL,
        [CreatedByName] nvarchar(200) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_RecurringPayments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RecurringPayments_Departments_DepartmentId]
            FOREIGN KEY ([DepartmentId]) REFERENCES [Departments] ([DepartmentId])
    );
    CREATE INDEX [IX_RecurringPayments_DepartmentId] ON [RecurringPayments] ([DepartmentId]);
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[RecurringPayments]', N'U') IS NOT NULL
    DROP TABLE [RecurringPayments];
");
        }
    }
}
