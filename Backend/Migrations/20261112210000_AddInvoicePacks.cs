using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261112210000_AddInvoicePacks")]
    public partial class AddInvoicePacks : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('InvoicePacks','U') IS NULL
CREATE TABLE [InvoicePacks] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_InvoicePacks PRIMARY KEY,
    [PackNumber] nvarchar(30) NULL,
    [InvoiceNumber] nvarchar(50) NOT NULL,
    [OrderNumber] nvarchar(100) NULL,
    [CustomerNumber] nvarchar(50) NULL,
    [CustomerName] nvarchar(255) NULL,
    [Company] nvarchar(10) NULL,
    [InvoiceDate] datetime2 NULL,
    [InvoiceTotal] decimal(18,2) NULL,
    [Source] nvarchar(20) NOT NULL CONSTRAINT DF_InvoicePacks_Source DEFAULT 'Scanned',
    [Status] nvarchar(20) NOT NULL CONSTRAINT DF_InvoicePacks_Status DEFAULT 'Complete',
    [HasDeliveryNote] bit NOT NULL CONSTRAINT DF_InvoicePacks_HasDeliveryNote DEFAULT 0,
    [HasTaxInvoice] bit NOT NULL CONSTRAINT DF_InvoicePacks_HasTaxInvoice DEFAULT 0,
    [HasOrderConfirmation] bit NOT NULL CONSTRAINT DF_InvoicePacks_HasOrderConfirmation DEFAULT 0,
    [HasOrderEmail] bit NOT NULL CONSTRAINT DF_InvoicePacks_HasOrderEmail DEFAULT 0,
    [HasOrderForm] bit NOT NULL CONSTRAINT DF_InvoicePacks_HasOrderForm DEFAULT 0,
    [InvoiceVerified] bit NOT NULL CONSTRAINT DF_InvoicePacks_InvoiceVerified DEFAULT 0,
    [InSage] bit NOT NULL CONSTRAINT DF_InvoicePacks_InSage DEFAULT 0,
    [Notes] nvarchar(1000) NULL,
    [FileName] nvarchar(255) NOT NULL,
    [OriginalFileName] nvarchar(255) NULL,
    [ContentType] nvarchar(100) NULL,
    [Size] bigint NOT NULL CONSTRAINT DF_InvoicePacks_Size DEFAULT 0,
    [StoragePath] nvarchar(500) NOT NULL,
    [PageCount] int NOT NULL CONSTRAINT DF_InvoicePacks_PageCount DEFAULT 0,
    [UploadedBy] int NOT NULL,
    [UploadedByName] nvarchar(150) NULL,
    [UploadedAt] datetime2 NOT NULL CONSTRAINT DF_InvoicePacks_UploadedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_InvoicePacks_InvoiceNumber') CREATE INDEX IX_InvoicePacks_InvoiceNumber ON [InvoicePacks]([InvoiceNumber]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_InvoicePacks_OrderNumber') CREATE INDEX IX_InvoicePacks_OrderNumber ON [InvoicePacks]([OrderNumber]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_InvoicePacks_CustomerNumber') CREATE INDEX IX_InvoicePacks_CustomerNumber ON [InvoicePacks]([CustomerNumber]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_InvoicePacks_Company_UploadedAt') CREATE INDEX IX_InvoicePacks_Company_UploadedAt ON [InvoicePacks]([Company],[UploadedAt] DESC);

IF OBJECT_ID('InvoicePackFiles','U') IS NULL
CREATE TABLE [InvoicePackFiles] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_InvoicePackFiles PRIMARY KEY,
    [PackId] int NOT NULL,
    [Kind] nvarchar(30) NOT NULL,
    [SortOrder] int NOT NULL CONSTRAINT DF_InvoicePackFiles_SortOrder DEFAULT 0,
    [FileName] nvarchar(255) NOT NULL,
    [OriginalFileName] nvarchar(255) NULL,
    [ContentType] nvarchar(100) NULL,
    [Size] bigint NOT NULL CONSTRAINT DF_InvoicePackFiles_Size DEFAULT 0,
    [StoragePath] nvarchar(500) NOT NULL,
    [AddedAt] datetime2 NOT NULL CONSTRAINT DF_InvoicePackFiles_AddedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_InvoicePackFiles_InvoicePacks FOREIGN KEY ([PackId]) REFERENCES [InvoicePacks]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_InvoicePackFiles_PackId') CREATE INDEX IX_InvoicePackFiles_PackId ON [InvoicePackFiles]([PackId]);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [InvoicePackFiles]; DROP TABLE IF EXISTS [InvoicePacks];");
        }
    }
}
