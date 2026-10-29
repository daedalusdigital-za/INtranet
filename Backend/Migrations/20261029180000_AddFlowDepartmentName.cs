using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Operational (department) flows: FlowDefinitions.DepartmentName.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261029180000_AddFlowDepartmentName")]
    public partial class AddFlowDepartmentName : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('FlowDefinitions','DepartmentName') IS NULL
    ALTER TABLE [FlowDefinitions] ADD [DepartmentName] nvarchar(100) NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF COL_LENGTH('FlowDefinitions','DepartmentName') IS NOT NULL ALTER TABLE [FlowDefinitions] DROP COLUMN [DepartmentName];");
        }
    }
}
