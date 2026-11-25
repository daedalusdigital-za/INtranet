using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Three new companies Finance makes payments for: Puma (PUM), OK Mini Mart (OKM) and Liamed (LIA).
    /// Each gets an operating company (staff assignment / ring-fencing) and a paying company
    /// (creditor packs), which also lists it in Admin settings › Company branding for logo uploads.
    /// Approvers (accountant, director) are set afterwards in Finance › Creditors admin.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261125150000_AddPumaOkMiniMartLiamedCompanies")]
    public partial class AddPumaOkMiniMartLiamedCompanies : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code='PUM')
    INSERT INTO OperatingCompanies (Name, Code, IsActive, CreatedAt) VALUES ('Puma','PUM',1,SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code='OKM')
    INSERT INTO OperatingCompanies (Name, Code, IsActive, CreatedAt) VALUES ('OK Mini Mart','OKM',1,SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code='LIA')
    INSERT INTO OperatingCompanies (Name, Code, IsActive, CreatedAt) VALUES ('Liamed','LIA',1,SYSUTCDATETIME());

DECLARE @sort int = ISNULL((SELECT MAX(SortOrder) FROM CreditorCompanies), 0);
IF NOT EXISTS (SELECT 1 FROM CreditorCompanies WHERE Code='PUM')
    INSERT INTO CreditorCompanies (Code, Name, IsActive, SortOrder, OperatingCompanyId)
    VALUES ('PUM','Puma',1,@sort+1,(SELECT OperatingCompanyId FROM OperatingCompanies WHERE Code='PUM'));
IF NOT EXISTS (SELECT 1 FROM CreditorCompanies WHERE Code='OKM')
    INSERT INTO CreditorCompanies (Code, Name, IsActive, SortOrder, OperatingCompanyId)
    VALUES ('OKM','OK Mini Mart',1,@sort+2,(SELECT OperatingCompanyId FROM OperatingCompanies WHERE Code='OKM'));
IF NOT EXISTS (SELECT 1 FROM CreditorCompanies WHERE Code='LIA')
    INSERT INTO CreditorCompanies (Code, Name, IsActive, SortOrder, OperatingCompanyId)
    VALUES ('LIA','Liamed',1,@sort+3,(SELECT OperatingCompanyId FROM OperatingCompanies WHERE Code='LIA'));
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Leave the rows if anything already references them (packs, staff assignments).
            migrationBuilder.Sql(@"
DELETE c FROM CreditorCompanies c WHERE c.Code IN ('PUM','OKM','LIA')
    AND NOT EXISTS (SELECT 1 FROM PaymentBatches b WHERE b.CompanyCode = c.Code);
");
        }
    }
}
