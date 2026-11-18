using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Department tidy-up requested by management:
    ///  • Accounts is merged into Finance (one finance department), Training into HR, TestDept removed.
    ///  • New departments: Executive (directors &amp; treasurer) and Tender.
    ///  • Operating company "Pharma Direct" renamed to Promed Pharmacare (Pharmatech) to match Sage.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261118150000_TidyDepartmentsAddExecutiveTender")]
    public partial class TidyDepartmentsAddExecutiveTender : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @finance int = (SELECT TOP 1 DepartmentId FROM Departments WHERE IsActive=1 AND Name='Finance');
DECLARE @hr int = (SELECT TOP 1 DepartmentId FROM Departments WHERE IsActive=1 AND Name='HR Department');
DECLARE @accounts int = (SELECT TOP 1 DepartmentId FROM Departments WHERE IsActive=1 AND Name='Accounts');
DECLARE @training int = (SELECT TOP 1 DepartmentId FROM Departments WHERE IsActive=1 AND Name='Training');
DECLARE @test int = (SELECT TOP 1 DepartmentId FROM Departments WHERE IsActive=1 AND Name='TestDept');

-- Accounts → Finance
IF @accounts IS NOT NULL AND @finance IS NOT NULL
BEGIN
    UPDATE Users SET DepartmentId=@finance WHERE DepartmentId=@accounts;
    UPDATE Departments SET IsActive=0, MergedIntoDepartmentId=@finance, UpdatedAt=SYSUTCDATETIME() WHERE DepartmentId=@accounts;
END
-- Training → HR
IF @training IS NOT NULL AND @hr IS NOT NULL
BEGIN
    UPDATE Users SET DepartmentId=@hr WHERE DepartmentId=@training;
    UPDATE Departments SET IsActive=0, MergedIntoDepartmentId=@hr, UpdatedAt=SYSUTCDATETIME() WHERE DepartmentId=@training;
END
-- TestDept → gone (anyone left in it becomes unassigned)
IF @test IS NOT NULL
BEGIN
    UPDATE Users SET DepartmentId=NULL WHERE DepartmentId=@test;
    UPDATE Departments SET IsActive=0, UpdatedAt=SYSUTCDATETIME() WHERE DepartmentId=@test;
END

-- New departments
IF NOT EXISTS (SELECT 1 FROM Departments WHERE IsActive=1 AND Name='Executive')
    INSERT INTO Departments (Name, CreatedAt, IsActive) VALUES ('Executive', SYSUTCDATETIME(), 1);
IF NOT EXISTS (SELECT 1 FROM Departments WHERE IsActive=1 AND Name='Tender')
    INSERT INTO Departments (Name, CreatedAt, IsActive) VALUES ('Tender', SYSUTCDATETIME(), 1);

-- Operating company naming
UPDATE OperatingCompanies SET Name='Promed Pharmacare (Pharmatech)' WHERE Code='PHARMA' AND Name='Pharma Direct';
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Data tidy-up; not reversed automatically.
        }
    }
}
