using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Finance: signed credit-note PDFs uploaded by managers, keyed on the Sage CN number.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261112150000_AddCreditNoteDocuments")]
    public partial class AddCreditNoteDocuments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('CreditNoteDocuments','U') IS NULL
CREATE TABLE [CreditNoteDocuments] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CreditNoteDocuments PRIMARY KEY,
    [CreditNoteNumber] nvarchar(50) NOT NULL,
    [Company] nvarchar(10) NULL,
    [CustomerNumber] nvarchar(50) NULL,
    [CustomerName] nvarchar(255) NULL,
    [InvoiceNumbers] nvarchar(200) NULL,
    [Amount] decimal(18,2) NULL,
    [Reason] nvarchar(50) NULL,
    [Notes] nvarchar(1000) NULL,
    [SignedBy] nvarchar(150) NULL,
    [SignedOn] datetime2 NULL,
    [FileName] nvarchar(255) NOT NULL,
    [OriginalFileName] nvarchar(255) NULL,
    [ContentType] nvarchar(100) NULL,
    [Size] bigint NOT NULL CONSTRAINT DF_CreditNoteDocuments_Size DEFAULT 0,
    [StoragePath] nvarchar(500) NOT NULL,
    [UploadedBy] int NOT NULL,
    [UploadedByName] nvarchar(150) NULL,
    [UploadedAt] datetime2 NOT NULL CONSTRAINT DF_CreditNoteDocuments_UploadedAt DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CreditNoteDocuments_Number') CREATE INDEX IX_CreditNoteDocuments_Number ON [CreditNoteDocuments]([CreditNoteNumber]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ImportedInvoices_TransactionNumber') CREATE INDEX IX_ImportedInvoices_TransactionNumber ON [ImportedInvoices]([TransactionNumber]) INCLUDE ([CustomerNumber],[CustomerName],[TransactionDate],[SalesAmount],[SourceCompany],[ProductCode]);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [CreditNoteDocuments];");
        }
    }
}
