using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Finance › Creditors payment packs: paying companies with their approvers, payment batches,
    /// schedule lines, supporting documents (with extracted text for checks) and the audit trail.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261116090000_AddCreditorPaymentBatches")]
    public partial class AddCreditorPaymentBatches : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('CreditorCompanies','U') IS NULL
BEGIN
    CREATE TABLE CreditorCompanies (
        Id int IDENTITY(1,1) PRIMARY KEY,
        Code nvarchar(10) NOT NULL,
        Name nvarchar(120) NOT NULL,
        Activity nvarchar(200) NULL,
        AccountantUserId int NULL,
        BackupApproverUserId int NULL,
        DirectorUserId int NULL,
        DelegateDirectorUserId int NULL,
        IsActive bit NOT NULL DEFAULT 1,
        SortOrder int NOT NULL DEFAULT 0
    );
    CREATE UNIQUE INDEX IX_CreditorCompanies_Code ON CreditorCompanies(Code);
END;

IF NOT EXISTS (SELECT 1 FROM CreditorCompanies)
INSERT INTO CreditorCompanies (Code, Name, Activity, SortOrder) VALUES
 ('PMT','Promed Technologies','Medical equipment & consumables', 1),
 ('ACM','Access Medical','Medical supplies distribution', 2),
 ('PHC','Promed Pharmacare (Pharmatech)','Pharmaceutical wholesale', 3),
 ('SBT','Sebenzani Trading','Trading & distribution', 4),
 ('KOG','KOG','Group services', 5),
 ('RFT','Rocket Freight','Freight & logistics', 6),
 ('SAW','SA Wellness','Wellness products', 7),
 ('SEY','Sharp Eye','Security & surveillance', 8),
 ('SHK','Shaka Holdings','Holding company', 9),
 ('NAT','New Age Technologies','Technology', 10);

IF OBJECT_ID('PaymentBatches','U') IS NULL
BEGIN
    CREATE TABLE PaymentBatches (
        Id int IDENTITY(1,1) PRIMARY KEY,
        BatchNumber nvarchar(20) NOT NULL,
        CompanyCode nvarchar(10) NOT NULL,
        PaymentType nvarchar(20) NOT NULL DEFAULT 'DailyCreditor',
        BatchDate datetime2 NOT NULL,
        Status nvarchar(30) NOT NULL DEFAULT 'Draft',
        Notes nvarchar(1000) NULL,
        TotalAmount decimal(18,2) NOT NULL DEFAULT 0,
        PreparedByUserId int NOT NULL,
        PreparedByName nvarchar(150) NULL,
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        SubmittedAt datetime2 NULL,
        ChecksRunAt datetime2 NULL,
        ChecksStatus nvarchar(10) NULL,
        ChecksJson nvarchar(max) NULL,
        AccountantUserId int NULL,
        AccountantName nvarchar(150) NULL,
        AccountantApprovedAt datetime2 NULL,
        AccountantComment nvarchar(1000) NULL,
        DirectorUserId int NULL,
        DirectorName nvarchar(150) NULL,
        DirectorSignedAt datetime2 NULL,
        DirectorComment nvarchar(1000) NULL,
        LockedAt datetime2 NULL,
        LockHash nvarchar(64) NULL,
        BankExportedAt datetime2 NULL,
        BankExportedByUserId int NULL,
        PaidAt datetime2 NULL,
        ClosedAt datetime2 NULL,
        ReturnReason nvarchar(2000) NULL,
        UpdatedAt datetime2 NULL
    );
    CREATE UNIQUE INDEX IX_PaymentBatches_BatchNumber ON PaymentBatches(BatchNumber);
    CREATE INDEX IX_PaymentBatches_CompanyCode_Status ON PaymentBatches(CompanyCode, Status);
END;

IF OBJECT_ID('PaymentBatchItems','U') IS NULL
BEGIN
    CREATE TABLE PaymentBatchItems (
        Id int IDENTITY(1,1) PRIMARY KEY,
        BatchId int NOT NULL,
        SupplierName nvarchar(200) NOT NULL,
        SupplierVatNumber nvarchar(20) NULL,
        InvoiceNumbers nvarchar(1000) NULL,
        Description nvarchar(500) NULL,
        Amount decimal(18,2) NOT NULL DEFAULT 0,
        BankName nvarchar(100) NULL,
        AccountNumber nvarchar(40) NULL,
        BranchCode nvarchar(20) NULL,
        AccountHolder nvarchar(200) NULL,
        PaymentReference nvarchar(50) NULL,
        StockReturned bit NOT NULL DEFAULT 0,
        DecisionStatus nvarchar(20) NOT NULL DEFAULT 'Pending',
        DecisionComment nvarchar(1000) NULL,
        DecidedAt datetime2 NULL,
        PrepaymentOpen bit NOT NULL DEFAULT 0,
        PaidAt datetime2 NULL,
        SortOrder int NOT NULL DEFAULT 0,
        CONSTRAINT FK_PaymentBatchItems_PaymentBatches_BatchId FOREIGN KEY (BatchId) REFERENCES PaymentBatches(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_PaymentBatchItems_BatchId ON PaymentBatchItems(BatchId);
    CREATE INDEX IX_PaymentBatchItems_AccountNumber ON PaymentBatchItems(AccountNumber);
END;

IF OBJECT_ID('PaymentBatchDocuments','U') IS NULL
BEGIN
    CREATE TABLE PaymentBatchDocuments (
        Id int IDENTITY(1,1) PRIMARY KEY,
        BatchId int NOT NULL,
        ItemId int NULL,
        DocType nvarchar(30) NOT NULL DEFAULT 'Other',
        SuggestedDocType nvarchar(30) NULL,
        IsNotApplicable bit NOT NULL DEFAULT 0,
        NaReason nvarchar(500) NULL,
        FileName nvarchar(255) NULL,
        OriginalFileName nvarchar(255) NULL,
        ContentType nvarchar(100) NULL,
        Size bigint NOT NULL DEFAULT 0,
        StoragePath nvarchar(500) NULL,
        Sha256 nvarchar(64) NULL,
        PageCount int NOT NULL DEFAULT 0,
        ExtractedText nvarchar(max) NULL,
        TextMethod nvarchar(10) NULL,
        DocumentDate datetime2 NULL,
        ExtractedAccountNumber nvarchar(40) NULL,
        ExtractedVatNumber nvarchar(20) NULL,
        ExtractedInvoiceNumber nvarchar(100) NULL,
        ExtractedAmount decimal(18,2) NULL,
        UploadedByUserId int NOT NULL DEFAULT 0,
        UploadedByName nvarchar(150) NULL,
        UploadedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        Version int NOT NULL DEFAULT 1,
        SupersedesDocumentId int NULL,
        VersionReason nvarchar(500) NULL,
        CONSTRAINT FK_PaymentBatchDocuments_PaymentBatches_BatchId FOREIGN KEY (BatchId) REFERENCES PaymentBatches(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_PaymentBatchDocuments_BatchId_DocType ON PaymentBatchDocuments(BatchId, DocType);
    CREATE INDEX IX_PaymentBatchDocuments_Sha256 ON PaymentBatchDocuments(Sha256);
END;

IF OBJECT_ID('PaymentBatchEvents','U') IS NULL
BEGIN
    CREATE TABLE PaymentBatchEvents (
        Id int IDENTITY(1,1) PRIMARY KEY,
        BatchId int NOT NULL,
        At datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UserId int NOT NULL DEFAULT 0,
        UserName nvarchar(150) NULL,
        Action nvarchar(40) NOT NULL,
        FromStatus nvarchar(30) NULL,
        ToStatus nvarchar(30) NULL,
        Comment nvarchar(2000) NULL,
        CONSTRAINT FK_PaymentBatchEvents_PaymentBatches_BatchId FOREIGN KEY (BatchId) REFERENCES PaymentBatches(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_PaymentBatchEvents_BatchId ON PaymentBatchEvents(BatchId);
END;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS PaymentBatchEvents;
DROP TABLE IF EXISTS PaymentBatchDocuments;
DROP TABLE IF EXISTS PaymentBatchItems;
DROP TABLE IF EXISTS PaymentBatches;
DROP TABLE IF EXISTS CreditorCompanies;");
        }
    }
}
