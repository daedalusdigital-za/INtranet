using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Company ring-fencing for Finance: each paying company (CreditorCompanies, Sage codes PMT/ACM/…)
    /// is linked to the operating company users are assigned to (OperatingCompanies / StaffOperatingCompanies),
    /// so "assigned to Access Medical" also means "may see Access Medical's creditors, debtors and cashflow".
    /// Adds the operating companies that only existed on the finance side.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261118120000_LinkCreditorCompaniesToOperatingCompanies")]
    public partial class LinkCreditorCompaniesToOperatingCompanies : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('CreditorCompanies','OperatingCompanyId') IS NULL
    ALTER TABLE CreditorCompanies ADD OperatingCompanyId int NULL;
");
            migrationBuilder.Sql(@"
-- Operating companies that so far only existed as paying companies
IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code='RFT')
    INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt) VALUES ('Rocket Freight','RFT','Freight and logistics',1,SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code='SEY')
    INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt) VALUES ('Sharp Eye','SEY','Security services',1,SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code='SHK')
    INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt) VALUES ('Shaka Holdings','SHK','Holding company',1,SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM OperatingCompanies WHERE Code='NAT')
    INSERT INTO OperatingCompanies (Name, Code, Description, IsActive, CreatedAt) VALUES ('New Age Technologies','NAT','Technology',1,SYSUTCDATETIME());

-- Link paying companies to operating companies (only where not already set)
UPDATE c SET OperatingCompanyId = o.OperatingCompanyId
FROM CreditorCompanies c
JOIN OperatingCompanies o ON o.Code = CASE c.Code
        WHEN 'PMT' THEN 'PROMED'
        WHEN 'ACM' THEN 'ACCESS'
        WHEN 'PHC' THEN 'PHARMA'
        WHEN 'SBT' THEN 'SEBENZANI'
        WHEN 'KOG' THEN 'KOG'
        WHEN 'SAW' THEN 'SAWELLNESS'
        ELSE c.Code END
WHERE c.OperatingCompanyId IS NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF COL_LENGTH('CreditorCompanies','OperatingCompanyId') IS NOT NULL ALTER TABLE CreditorCompanies DROP COLUMN OperatingCompanyId;");
        }
    }
}
