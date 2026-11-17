using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Finance › Creditors › Aging: snapshots of the Sage 300 "A/P Aged Payables by Due Date" summary
    /// per paying company, one row per vendor with the ageing buckets.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261118100000_AddCreditorApAging")]
    public partial class AddCreditorApAging : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('ApAgingSnapshots','U') IS NULL
BEGIN
    CREATE TABLE ApAgingSnapshots (
        Id int IDENTITY(1,1) PRIMARY KEY,
        CompanyCode nvarchar(10) NOT NULL,
        ReportCompany nvarchar(120) NULL,
        AsOfDate datetime2 NOT NULL,
        SourceFileName nvarchar(255) NULL,
        UploadedByUserId int NOT NULL DEFAULT 0,
        UploadedByName nvarchar(150) NULL,
        UploadedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        VendorCount int NOT NULL DEFAULT 0,
        ActiveVendorCount int NOT NULL DEFAULT 0,
        TotalCurrent decimal(18,2) NOT NULL DEFAULT 0,
        TotalOverdue decimal(18,2) NOT NULL DEFAULT 0,
        TotalPayables decimal(18,2) NOT NULL DEFAULT 0,
        Notes nvarchar(500) NULL
    );
    CREATE INDEX IX_ApAgingSnapshots_CompanyCode_AsOfDate ON ApAgingSnapshots(CompanyCode, AsOfDate);
END;

IF OBJECT_ID('ApAgingVendors','U') IS NULL
BEGIN
    CREATE TABLE ApAgingVendors (
        Id int IDENTITY(1,1) PRIMARY KEY,
        SnapshotId int NOT NULL,
        VendorCode nvarchar(50) NOT NULL,
        VendorName nvarchar(255) NOT NULL,
        Currency nvarchar(5) NULL,
        [Current] decimal(18,2) NOT NULL DEFAULT 0,
        Days30 decimal(18,2) NOT NULL DEFAULT 0,
        Days60 decimal(18,2) NOT NULL DEFAULT 0,
        Days90 decimal(18,2) NOT NULL DEFAULT 0,
        Over90 decimal(18,2) NOT NULL DEFAULT 0,
        Overdue decimal(18,2) NOT NULL DEFAULT 0,
        Total decimal(18,2) NOT NULL DEFAULT 0,
        CONSTRAINT FK_ApAgingVendors_ApAgingSnapshots_SnapshotId FOREIGN KEY (SnapshotId) REFERENCES ApAgingSnapshots(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_ApAgingVendors_SnapshotId_VendorCode ON ApAgingVendors(SnapshotId, VendorCode);
END;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS ApAgingVendors;
DROP TABLE IF EXISTS ApAgingSnapshots;");
        }
    }
}
