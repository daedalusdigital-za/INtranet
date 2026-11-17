using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Finance › Creditors › Cashflow: bank balances per company (as-at history) and standing
    /// outflows (debit orders / monthly payments) that sit outside payment packs. Mirrors the
    /// group "CASHFLOW TEMPLATE.xlsx": Balance − Payments − Debit orders − Monthly = Closing.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261118090000_AddCreditorCashflow")]
    public partial class AddCreditorCashflow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('CreditorCashflowBalances','U') IS NULL
BEGIN
    CREATE TABLE CreditorCashflowBalances (
        Id int IDENTITY(1,1) PRIMARY KEY,
        CompanyCode nvarchar(10) NOT NULL,
        AsAt datetime2 NOT NULL,
        Balance decimal(18,2) NOT NULL DEFAULT 0,
        Note nvarchar(300) NULL,
        UpdatedByUserId int NOT NULL DEFAULT 0,
        UpdatedByName nvarchar(150) NULL,
        UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_CreditorCashflowBalances_CompanyCode_AsAt ON CreditorCashflowBalances(CompanyCode, AsAt);
END;

IF OBJECT_ID('CreditorCashflowLines','U') IS NULL
BEGIN
    CREATE TABLE CreditorCashflowLines (
        Id int IDENTITY(1,1) PRIMARY KEY,
        CompanyCode nvarchar(10) NOT NULL,
        Section nvarchar(20) NOT NULL DEFAULT 'DebitOrder',
        Payee nvarchar(200) NOT NULL,
        Reference nvarchar(100) NULL,
        Description nvarchar(300) NULL,
        Frequency nvarchar(60) NULL,
        DueDay int NULL,
        Amount decimal(18,2) NOT NULL DEFAULT 0,
        IsActive bit NOT NULL DEFAULT 1,
        SortOrder int NOT NULL DEFAULT 0,
        CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt datetime2 NULL,
        UpdatedByName nvarchar(150) NULL
    );
    CREATE INDEX IX_CreditorCashflowLines_CompanyCode_Section ON CreditorCashflowLines(CompanyCode, Section);
END;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS CreditorCashflowLines;
DROP TABLE IF EXISTS CreditorCashflowBalances;");
        }
    }
}
