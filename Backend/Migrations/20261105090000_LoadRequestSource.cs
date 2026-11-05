using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Internal movements can be *requested* by Stock or Sales (typically from a Welly suggestion) and then
    /// accepted by Logistics. Record where the request came from and who raised it.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261105090000_LoadRequestSource")]
    public partial class LoadRequestSource : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Loads', 'RequestSource') IS NULL
    ALTER TABLE Loads ADD RequestSource nvarchar(50) NULL;
IF COL_LENGTH('Loads', 'RequestedBy') IS NULL
    ALTER TABLE Loads ADD RequestedBy nvarchar(200) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Loads', 'RequestedBy') IS NOT NULL ALTER TABLE Loads DROP COLUMN RequestedBy;
IF COL_LENGTH('Loads', 'RequestSource') IS NOT NULL ALTER TABLE Loads DROP COLUMN RequestSource;
");
        }
    }
}
