using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Finance: debtors' age analysis snapshots imported from the Sage aging workbook per company.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261112120000_AddArAging")]
    public partial class AddArAging : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('ArAgingSnapshots','U') IS NULL
CREATE TABLE [ArAgingSnapshots] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ArAgingSnapshots PRIMARY KEY,
    [Company] nvarchar(100) NOT NULL,
    [AsOfDate] datetime2 NOT NULL,
    [SourceFileName] nvarchar(255) NULL,
    [UploadedBy] int NOT NULL,
    [UploadedAt] datetime2 NOT NULL CONSTRAINT DF_ArAgingSnapshots_UploadedAt DEFAULT SYSUTCDATETIME(),
    [CustomerCount] int NOT NULL CONSTRAINT DF_ArAgingSnapshots_CustomerCount DEFAULT 0,
    [DocumentCount] int NOT NULL CONSTRAINT DF_ArAgingSnapshots_DocumentCount DEFAULT 0,
    [TotalBalance] decimal(18,2) NOT NULL CONSTRAINT DF_ArAgingSnapshots_TotalBalance DEFAULT 0,
    [Notes] nvarchar(1000) NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ArAgingSnapshots_Company_AsOf') CREATE INDEX IX_ArAgingSnapshots_Company_AsOf ON [ArAgingSnapshots]([Company],[AsOfDate]);

IF OBJECT_ID('ArAgingItems','U') IS NULL
CREATE TABLE [ArAgingItems] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ArAgingItems PRIMARY KEY,
    [SnapshotId] int NOT NULL,
    [CustomerCode] nvarchar(50) NOT NULL,
    [CustomerName] nvarchar(255) NOT NULL,
    [DocumentNumber] nvarchar(50) NOT NULL,
    [DocumentType] nvarchar(5) NOT NULL,
    [OrderNumber] nvarchar(50) NULL,
    [PoNumber] nvarchar(100) NULL,
    [DocumentDate] datetime2 NULL,
    [DueDate] datetime2 NULL,
    [Reference] nvarchar(100) NULL,
    [BatchEntry] nvarchar(50) NULL,
    [DaysOver] int NULL,
    [Amount] decimal(18,2) NOT NULL CONSTRAINT DF_ArAgingItems_Amount DEFAULT 0,
    [Balance] decimal(18,2) NOT NULL CONSTRAINT DF_ArAgingItems_Balance DEFAULT 0,
    [AgeDays] int NOT NULL CONSTRAINT DF_ArAgingItems_AgeDays DEFAULT 0,
    [Bucket] tinyint NOT NULL CONSTRAINT DF_ArAgingItems_Bucket DEFAULT 0,
    CONSTRAINT FK_ArAgingItems_Snapshots FOREIGN KEY ([SnapshotId]) REFERENCES [ArAgingSnapshots]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ArAgingItems_Snapshot_Customer') CREATE INDEX IX_ArAgingItems_Snapshot_Customer ON [ArAgingItems]([SnapshotId],[CustomerCode]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ArAgingItems_DocumentNumber') CREATE INDEX IX_ArAgingItems_DocumentNumber ON [ArAgingItems]([DocumentNumber]);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [ArAgingItems]; DROP TABLE IF EXISTS [ArAgingSnapshots];");
        }
    }
}
