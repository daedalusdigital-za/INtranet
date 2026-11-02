using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Departments get a soft-delete flag (merged duplicates are deactivated, never deleted, so history survives) and a
    /// unique index on the trimmed, case-insensitive name so "Finance" and "Finance Department" cannot be created twice.
    /// The index is filtered to active rows: a retired record may keep its old name.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261102200000_DepartmentsSoftDeleteAndUniqueName")]
    public partial class DepartmentsSoftDeleteAndUniqueName : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Departments', 'IsActive') IS NULL
    ALTER TABLE Departments ADD IsActive bit NOT NULL CONSTRAINT DF_Departments_IsActive DEFAULT 1;
IF COL_LENGTH('Departments', 'MergedIntoDepartmentId') IS NULL
    ALTER TABLE Departments ADD MergedIntoDepartmentId int NULL;
IF COL_LENGTH('Departments', 'NameKey') IS NULL
    EXEC('ALTER TABLE Departments ADD NameKey AS LOWER(LTRIM(RTRIM(Name))) PERSISTED');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Departments_NameKey_Active' AND object_id = OBJECT_ID('Departments'))
    EXEC('CREATE UNIQUE INDEX UX_Departments_NameKey_Active ON Departments(NameKey) WHERE IsActive = 1');
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Departments_NameKey_Active' AND object_id = OBJECT_ID('Departments')) DROP INDEX UX_Departments_NameKey_Active ON Departments;
IF COL_LENGTH('Departments', 'NameKey') IS NOT NULL ALTER TABLE Departments DROP COLUMN NameKey;
IF COL_LENGTH('Departments', 'MergedIntoDepartmentId') IS NOT NULL ALTER TABLE Departments DROP COLUMN MergedIntoDepartmentId;
IF COL_LENGTH('Departments', 'IsActive') IS NOT NULL BEGIN ALTER TABLE Departments DROP CONSTRAINT DF_Departments_IsActive; ALTER TABLE Departments DROP COLUMN IsActive; END
");
        }
    }
}
