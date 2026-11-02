using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261102140000_AddVehiclePositionLogs")]
    public partial class AddVehiclePositionLogs : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[VehiclePositionLogs]', N'U') IS NULL
BEGIN
    CREATE TABLE [VehiclePositionLogs] (
        [Id] bigint NOT NULL IDENTITY,
        [VehicleId] int NOT NULL,
        [LoadId] int NULL,
        [RecordedAt] datetime2 NOT NULL,
        [Latitude] float NOT NULL,
        [Longitude] float NOT NULL,
        [Speed] int NULL,
        [Bearing] int NULL,
        [Ignition] bit NULL,
        [Address] nvarchar(300) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_VehiclePositionLogs] PRIMARY KEY ([Id])
    );
    CREATE UNIQUE INDEX [IX_VehiclePositionLogs_VehicleId_RecordedAt] ON [VehiclePositionLogs] ([VehicleId], [RecordedAt]);
    CREATE INDEX [IX_VehiclePositionLogs_LoadId_RecordedAt] ON [VehiclePositionLogs] ([LoadId], [RecordedAt]);
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [VehiclePositionLogs];");
        }
    }
}
