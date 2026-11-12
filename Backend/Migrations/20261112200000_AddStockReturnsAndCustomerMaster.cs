using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Finance ↔ Stock ↔ Sales: stock returns raised from credit notes, and the customer master that rolls Sage accounts up across companies.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261112200000_AddStockReturnsAndCustomerMaster")]
    public partial class AddStockReturnsAndCustomerMaster : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('StockReturns','U') IS NULL
CREATE TABLE [StockReturns] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_StockReturns PRIMARY KEY,
    [CreditNoteNumber] nvarchar(50) NOT NULL,
    [Company] nvarchar(10) NULL,
    [CustomerNumber] nvarchar(50) NULL,
    [CustomerName] nvarchar(255) NULL,
    [CreditNoteDocumentId] int NULL,
    [ReturnType] nvarchar(20) NOT NULL CONSTRAINT DF_StockReturns_Type DEFAULT 'Return',
    [Status] nvarchar(20) NOT NULL CONSTRAINT DF_StockReturns_Status DEFAULT 'Pending',
    [WarehouseId] int NULL,
    [Notes] nvarchar(1000) NULL,
    [CreatedBy] int NOT NULL,
    [CreatedByName] nvarchar(150) NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_StockReturns_CreatedAt DEFAULT SYSUTCDATETIME(),
    [ConfirmedBy] int NULL,
    [ConfirmedByName] nvarchar(150) NULL,
    [ConfirmedAt] datetime2 NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_StockReturns_CN') CREATE INDEX IX_StockReturns_CN ON [StockReturns]([Company],[CreditNoteNumber]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_StockReturns_Status') CREATE INDEX IX_StockReturns_Status ON [StockReturns]([Status]);

IF OBJECT_ID('StockReturnLines','U') IS NULL
CREATE TABLE [StockReturnLines] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_StockReturnLines PRIMARY KEY,
    [StockReturnId] int NOT NULL CONSTRAINT FK_StockReturnLines_Return REFERENCES [StockReturns]([Id]) ON DELETE CASCADE,
    [ProductCode] nvarchar(50) NOT NULL,
    [ProductDescription] nvarchar(500) NULL,
    [Quantity] decimal(18,4) NOT NULL,
    [ConfirmedQuantity] decimal(18,4) NULL,
    [CommodityId] int NULL,
    [MovementId] int NULL
);

IF OBJECT_ID('CustomerMasters','U') IS NULL
CREATE TABLE [CustomerMasters] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CustomerMasters PRIMARY KEY,
    [Name] nvarchar(255) NOT NULL,
    [NormalizedName] nvarchar(255) NOT NULL,
    [Group] nvarchar(150) NULL,
    [Type] nvarchar(50) NULL,
    [Province] nvarchar(100) NULL,
    [Notes] nvarchar(1000) NULL,
    [LogisticsCustomerId] int NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_CustomerMasters_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CustomerMasters_Norm') CREATE INDEX IX_CustomerMasters_Norm ON [CustomerMasters]([NormalizedName]);

IF OBJECT_ID('CustomerAliases','U') IS NULL
CREATE TABLE [CustomerAliases] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CustomerAliases PRIMARY KEY,
    [CustomerMasterId] int NOT NULL CONSTRAINT FK_CustomerAliases_Master REFERENCES [CustomerMasters]([Id]) ON DELETE CASCADE,
    [Company] nvarchar(10) NOT NULL,
    [CustomerCode] nvarchar(50) NOT NULL,
    [CustomerName] nvarchar(255) NULL,
    [Source] nvarchar(10) NOT NULL CONSTRAINT DF_CustomerAliases_Source DEFAULT 'Auto',
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_CustomerAliases_CreatedAt DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_CustomerAliases_CompanyCode') CREATE UNIQUE INDEX UX_CustomerAliases_CompanyCode ON [CustomerAliases]([Company],[CustomerCode]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_CustomerAliases_Master') CREATE INDEX IX_CustomerAliases_Master ON [CustomerAliases]([CustomerMasterId]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ImportedInvoices_CustomerCompany') CREATE INDEX IX_ImportedInvoices_CustomerCompany ON [ImportedInvoices]([CustomerNumber],[SourceCompany]) INCLUDE ([TransactionNumber],[TransactionDate],[SalesAmount],[ProductCode]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ArAgingItems_Customer') CREATE INDEX IX_ArAgingItems_Customer ON [ArAgingItems]([SnapshotId],[CustomerCode]) INCLUDE ([DocumentNumber],[DocumentType],[Balance],[AgeDays],[DocumentDate]);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [StockReturnLines]; DROP TABLE IF EXISTS [StockReturns]; DROP TABLE IF EXISTS [CustomerAliases]; DROP TABLE IF EXISTS [CustomerMasters];");
        }
    }
}
