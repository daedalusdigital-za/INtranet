using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>CortexChanges.Target was nvarchar(4) — "graph" and "flow" rows failed with "string would be truncated", which silently broke the nightly Cortex rebuild log.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261120160000_WidenCortexChangeTarget")]
    public partial class WidenCortexChangeTarget : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF COL_LENGTH('CortexChanges','Target') = 8 ALTER TABLE CortexChanges ALTER COLUMN Target nvarchar(20) NOT NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("ALTER TABLE CortexChanges ALTER COLUMN Target nvarchar(4) NOT NULL;");
        }
    }
}
