using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Each run keeps a copy of the step graph it started with, so editing a flow (renaming or removing
    /// steps) no longer breaks runs that are already waiting on a task, approval or timer. Older runs keep
    /// a NULL snapshot and fall back to the live definition.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261102120000_AddFlowRunGraphSnapshot")]
    public partial class AddFlowRunGraphSnapshot : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF COL_LENGTH('FlowRuns','GraphJson') IS NULL ALTER TABLE [FlowRuns] ADD [GraphJson] nvarchar(max) NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF COL_LENGTH('FlowRuns','GraphJson') IS NOT NULL ALTER TABLE [FlowRuns] DROP COLUMN [GraphJson];");
        }
    }
}
