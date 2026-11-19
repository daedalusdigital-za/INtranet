using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Quotation requests (replace stationery requests on Finance › Approvals) with their attached quote files.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261119120000_AddQuotationRequests")]
    public partial class AddQuotationRequests : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('QuotationRequests','U') IS NULL
BEGIN
    CREATE TABLE QuotationRequests (
        Id                  int IDENTITY(1,1) NOT NULL CONSTRAINT PK_QuotationRequests PRIMARY KEY,
        UserId              int NULL,
        RequestedBy         nvarchar(200) NOT NULL CONSTRAINT DF_QuotationRequests_RequestedBy DEFAULT(''),
        RequestedByEmail    nvarchar(200) NULL,
        Department          nvarchar(120) NULL,
        Company             nvarchar(120) NULL,
        Subject             nvarchar(300) NOT NULL CONSTRAINT DF_QuotationRequests_Subject DEFAULT(''),
        Details             nvarchar(max) NULL,
        Priority            nvarchar(20) NOT NULL CONSTRAINT DF_QuotationRequests_Priority DEFAULT('Normal'),
        EstimatedAmount     decimal(18,2) NULL,
        Status              nvarchar(20) NOT NULL CONSTRAINT DF_QuotationRequests_Status DEFAULT('Pending'),
        SubmittedAt         datetime2 NOT NULL CONSTRAINT DF_QuotationRequests_SubmittedAt DEFAULT(SYSUTCDATETIME()),
        ReviewedByUserId    int NULL,
        ReviewedBy          nvarchar(200) NULL,
        ReviewedAt          datetime2 NULL,
        ReviewNotes         nvarchar(max) NULL,
        PaperlessDocumentId int NULL,
        UpdatedAt           datetime2 NULL
    );
    CREATE INDEX IX_QuotationRequests_Status ON QuotationRequests(Status);
    CREATE INDEX IX_QuotationRequests_UserId ON QuotationRequests(UserId);
END
IF OBJECT_ID('QuotationRequestFiles','U') IS NULL
BEGIN
    CREATE TABLE QuotationRequestFiles (
        Id                 int IDENTITY(1,1) NOT NULL CONSTRAINT PK_QuotationRequestFiles PRIMARY KEY,
        QuotationRequestId int NOT NULL,
        FileName           nvarchar(260) NOT NULL CONSTRAINT DF_QuotationRequestFiles_FileName DEFAULT(''),
        ContentType        nvarchar(120) NOT NULL CONSTRAINT DF_QuotationRequestFiles_ContentType DEFAULT('application/octet-stream'),
        Size               bigint NOT NULL CONSTRAINT DF_QuotationRequestFiles_Size DEFAULT(0),
        StoragePath        nvarchar(500) NOT NULL CONSTRAINT DF_QuotationRequestFiles_StoragePath DEFAULT(''),
        UploadedAt         datetime2 NOT NULL CONSTRAINT DF_QuotationRequestFiles_UploadedAt DEFAULT(SYSUTCDATETIME()),
        CONSTRAINT FK_QuotationRequestFiles_QuotationRequests_QuotationRequestId FOREIGN KEY (QuotationRequestId) REFERENCES QuotationRequests(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_QuotationRequestFiles_QuotationRequestId ON QuotationRequestFiles(QuotationRequestId);
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('QuotationRequestFiles','U') IS NOT NULL DROP TABLE QuotationRequestFiles;
IF OBJECT_ID('QuotationRequests','U') IS NOT NULL DROP TABLE QuotationRequests;");
        }
    }
}
