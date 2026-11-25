using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Quotation requests get a full approval flow: Creditors accept (preparer) → accountant → director picks one quote
    /// (or rejects all). Adds the stage columns to QuotationRequests and supplier / amount / number per quote file.
    /// Only adds nullable columns (plus QuoteNumber default 0), so existing rows are untouched.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261125120000_AddQuoteApprovalFlow")]
    public partial class AddQuoteApprovalFlow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('QuotationRequests','CompanyCode') IS NULL ALTER TABLE QuotationRequests ADD CompanyCode nvarchar(10) NULL;
IF COL_LENGTH('QuotationRequests','FewerQuotesReason') IS NULL ALTER TABLE QuotationRequests ADD FewerQuotesReason nvarchar(500) NULL;
IF COL_LENGTH('QuotationRequests','PreparedByUserId') IS NULL ALTER TABLE QuotationRequests ADD PreparedByUserId int NULL;
IF COL_LENGTH('QuotationRequests','PreparedByName') IS NULL ALTER TABLE QuotationRequests ADD PreparedByName nvarchar(200) NULL;
IF COL_LENGTH('QuotationRequests','PreparedAt') IS NULL ALTER TABLE QuotationRequests ADD PreparedAt datetime2 NULL;
IF COL_LENGTH('QuotationRequests','RequestedAccountantIds') IS NULL ALTER TABLE QuotationRequests ADD RequestedAccountantIds nvarchar(200) NULL;
IF COL_LENGTH('QuotationRequests','RequestedAccountantNames') IS NULL ALTER TABLE QuotationRequests ADD RequestedAccountantNames nvarchar(400) NULL;
IF COL_LENGTH('QuotationRequests','RequestedDirectorIds') IS NULL ALTER TABLE QuotationRequests ADD RequestedDirectorIds nvarchar(200) NULL;
IF COL_LENGTH('QuotationRequests','RequestedDirectorNames') IS NULL ALTER TABLE QuotationRequests ADD RequestedDirectorNames nvarchar(400) NULL;
IF COL_LENGTH('QuotationRequests','AccountantUserId') IS NULL ALTER TABLE QuotationRequests ADD AccountantUserId int NULL;
IF COL_LENGTH('QuotationRequests','AccountantName') IS NULL ALTER TABLE QuotationRequests ADD AccountantName nvarchar(200) NULL;
IF COL_LENGTH('QuotationRequests','AccountantApprovedAt') IS NULL ALTER TABLE QuotationRequests ADD AccountantApprovedAt datetime2 NULL;
IF COL_LENGTH('QuotationRequests','AccountantComment') IS NULL ALTER TABLE QuotationRequests ADD AccountantComment nvarchar(1000) NULL;
IF COL_LENGTH('QuotationRequests','DirectorUserId') IS NULL ALTER TABLE QuotationRequests ADD DirectorUserId int NULL;
IF COL_LENGTH('QuotationRequests','DirectorName') IS NULL ALTER TABLE QuotationRequests ADD DirectorName nvarchar(200) NULL;
IF COL_LENGTH('QuotationRequests','DirectorDecidedAt') IS NULL ALTER TABLE QuotationRequests ADD DirectorDecidedAt datetime2 NULL;
IF COL_LENGTH('QuotationRequests','DirectorComment') IS NULL ALTER TABLE QuotationRequests ADD DirectorComment nvarchar(1000) NULL;
IF COL_LENGTH('QuotationRequests','SelectedFileId') IS NULL ALTER TABLE QuotationRequests ADD SelectedFileId int NULL;
IF COL_LENGTH('QuotationRequests','ReturnReason') IS NULL ALTER TABLE QuotationRequests ADD ReturnReason nvarchar(1000) NULL;
IF COL_LENGTH('QuotationRequests','HistoryJson') IS NULL ALTER TABLE QuotationRequests ADD HistoryJson nvarchar(max) NULL;
IF COL_LENGTH('QuotationRequestFiles','QuoteNumber') IS NULL ALTER TABLE QuotationRequestFiles ADD QuoteNumber int NOT NULL CONSTRAINT DF_QuotationRequestFiles_QuoteNumber DEFAULT 0;
IF COL_LENGTH('QuotationRequestFiles','Supplier') IS NULL ALTER TABLE QuotationRequestFiles ADD Supplier nvarchar(200) NULL;
IF COL_LENGTH('QuotationRequestFiles','Amount') IS NULL ALTER TABLE QuotationRequestFiles ADD Amount decimal(18,2) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('QuotationRequestFiles','Amount') IS NOT NULL ALTER TABLE QuotationRequestFiles DROP COLUMN Amount;
IF COL_LENGTH('QuotationRequestFiles','Supplier') IS NOT NULL ALTER TABLE QuotationRequestFiles DROP COLUMN Supplier;
IF COL_LENGTH('QuotationRequestFiles','QuoteNumber') IS NOT NULL BEGIN ALTER TABLE QuotationRequestFiles DROP CONSTRAINT DF_QuotationRequestFiles_QuoteNumber; ALTER TABLE QuotationRequestFiles DROP COLUMN QuoteNumber; END
IF COL_LENGTH('QuotationRequests','HistoryJson') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN HistoryJson;
IF COL_LENGTH('QuotationRequests','ReturnReason') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN ReturnReason;
IF COL_LENGTH('QuotationRequests','SelectedFileId') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN SelectedFileId;
IF COL_LENGTH('QuotationRequests','DirectorComment') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN DirectorComment;
IF COL_LENGTH('QuotationRequests','DirectorDecidedAt') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN DirectorDecidedAt;
IF COL_LENGTH('QuotationRequests','DirectorName') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN DirectorName;
IF COL_LENGTH('QuotationRequests','DirectorUserId') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN DirectorUserId;
IF COL_LENGTH('QuotationRequests','AccountantComment') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN AccountantComment;
IF COL_LENGTH('QuotationRequests','AccountantApprovedAt') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN AccountantApprovedAt;
IF COL_LENGTH('QuotationRequests','AccountantName') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN AccountantName;
IF COL_LENGTH('QuotationRequests','AccountantUserId') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN AccountantUserId;
IF COL_LENGTH('QuotationRequests','RequestedDirectorNames') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN RequestedDirectorNames;
IF COL_LENGTH('QuotationRequests','RequestedDirectorIds') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN RequestedDirectorIds;
IF COL_LENGTH('QuotationRequests','RequestedAccountantNames') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN RequestedAccountantNames;
IF COL_LENGTH('QuotationRequests','RequestedAccountantIds') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN RequestedAccountantIds;
IF COL_LENGTH('QuotationRequests','PreparedAt') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN PreparedAt;
IF COL_LENGTH('QuotationRequests','PreparedByName') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN PreparedByName;
IF COL_LENGTH('QuotationRequests','PreparedByUserId') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN PreparedByUserId;
IF COL_LENGTH('QuotationRequests','FewerQuotesReason') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN FewerQuotesReason;
IF COL_LENGTH('QuotationRequests','CompanyCode') IS NOT NULL ALTER TABLE QuotationRequests DROP COLUMN CompanyCode;
");
        }
    }
}
