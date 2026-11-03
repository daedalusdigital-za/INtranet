using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Maintenance records carry who created them and who last edited them, so a wrong cost / status / date
    /// can be traced back to the person who entered it.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261103120000_VehicleMaintenanceAudit")]
    public partial class VehicleMaintenanceAudit : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('VehicleMaintenance', 'CreatedBy') IS NULL
    ALTER TABLE VehicleMaintenance ADD CreatedBy nvarchar(150) NULL;
IF COL_LENGTH('VehicleMaintenance', 'UpdatedBy') IS NULL
    ALTER TABLE VehicleMaintenance ADD UpdatedBy nvarchar(150) NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('VehicleMaintenance', 'UpdatedBy') IS NOT NULL ALTER TABLE VehicleMaintenance DROP COLUMN UpdatedBy;
IF COL_LENGTH('VehicleMaintenance', 'CreatedBy') IS NOT NULL ALTER TABLE VehicleMaintenance DROP COLUMN CreatedBy;
");
        }
    }
}
