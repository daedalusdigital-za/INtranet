using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Creditors aging: store the per-document rows off the Sage "A/P Aged Payables by Due Date — Detail by
    /// Document Date" report (invoice / credit note / prepayment per vendor with its bucket), under the
    /// existing vendor-level snapshot.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261119100000_AddApAgingDocuments")]
    public partial class AddApAgingDocuments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('ApAgingSnapshots','HasDetail') IS NULL
    ALTER TABLE ApAgingSnapshots ADD HasDetail bit NOT NULL CONSTRAINT DF_ApAgingSnapshots_HasDetail DEFAULT(0);
IF COL_LENGTH('ApAgingSnapshots','DocumentCount') IS NULL
    ALTER TABLE ApAgingSnapshots ADD DocumentCount int NOT NULL CONSTRAINT DF_ApAgingSnapshots_DocumentCount DEFAULT(0);

IF OBJECT_ID('ApAgingDocuments','U') IS NULL
BEGIN
    CREATE TABLE ApAgingDocuments (
        Id          int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ApAgingDocuments PRIMARY KEY,
        SnapshotId  int NOT NULL,
        VendorCode  nvarchar(50)  NOT NULL,
        VendorName  nvarchar(255) NOT NULL,
        DocDate     datetime2 NULL,
        DocType     nvarchar(5)  NOT NULL CONSTRAINT DF_ApAgingDocuments_DocType DEFAULT(''),
        DocNumber   nvarchar(60) NOT NULL,
        DueDate     datetime2 NULL,
        [Current]   decimal(18,2) NOT NULL CONSTRAINT DF_ApAgingDocuments_Current DEFAULT(0),
        Days30      decimal(18,2) NOT NULL CONSTRAINT DF_ApAgingDocuments_Days30 DEFAULT(0),
        Days60      decimal(18,2) NOT NULL CONSTRAINT DF_ApAgingDocuments_Days60 DEFAULT(0),
        Days90      decimal(18,2) NOT NULL CONSTRAINT DF_ApAgingDocuments_Days90 DEFAULT(0),
        Over90      decimal(18,2) NOT NULL CONSTRAINT DF_ApAgingDocuments_Over90 DEFAULT(0),
        Overdue     decimal(18,2) NOT NULL CONSTRAINT DF_ApAgingDocuments_Overdue DEFAULT(0),
        Total       decimal(18,2) NOT NULL CONSTRAINT DF_ApAgingDocuments_Total DEFAULT(0),
        Bucket      int NOT NULL CONSTRAINT DF_ApAgingDocuments_Bucket DEFAULT(0),
        CONSTRAINT FK_ApAgingDocuments_ApAgingSnapshots_SnapshotId FOREIGN KEY (SnapshotId) REFERENCES ApAgingSnapshots(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_ApAgingDocuments_SnapshotId_VendorCode ON ApAgingDocuments(SnapshotId, VendorCode);
    CREATE INDEX IX_ApAgingDocuments_DocNumber ON ApAgingDocuments(DocNumber);
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('ApAgingDocuments','U') IS NOT NULL DROP TABLE ApAgingDocuments;
IF COL_LENGTH('ApAgingSnapshots','DocumentCount') IS NOT NULL BEGIN ALTER TABLE ApAgingSnapshots DROP CONSTRAINT DF_ApAgingSnapshots_DocumentCount; ALTER TABLE ApAgingSnapshots DROP COLUMN DocumentCount; END
IF COL_LENGTH('ApAgingSnapshots','HasDetail') IS NOT NULL BEGIN ALTER TABLE ApAgingSnapshots DROP CONSTRAINT DF_ApAgingSnapshots_HasDetail; ALTER TABLE ApAgingSnapshots DROP COLUMN HasDetail; END");
        }
    }
}
