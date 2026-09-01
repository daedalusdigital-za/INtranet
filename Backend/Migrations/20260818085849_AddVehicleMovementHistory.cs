using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddVehicleMovementHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "VehicleMovementHistory",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VehicleId = table.Column<int>(type: "int", nullable: true),
                    RegistrationNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MovementDate = table.Column<DateTime>(type: "date", nullable: false),
                    CartrackTripId = table.Column<long>(type: "bigint", nullable: false),
                    StartTimestamp = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    EndTimestamp = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TripDuration = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    TripDurationSeconds = table.Column<int>(type: "int", nullable: false),
                    StartLocation = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    EndLocation = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    StartGeofence = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    EndGeofence = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    StartLatitude = table.Column<double>(type: "float", nullable: false),
                    StartLongitude = table.Column<double>(type: "float", nullable: false),
                    EndLatitude = table.Column<double>(type: "float", nullable: false),
                    EndLongitude = table.Column<double>(type: "float", nullable: false),
                    TripDistance = table.Column<double>(type: "float", nullable: false),
                    MaxSpeed = table.Column<double>(type: "float", nullable: false),
                    HarshBrakingEvents = table.Column<int>(type: "int", nullable: false),
                    HarshCorneringEvents = table.Column<int>(type: "int", nullable: false),
                    HarshAccelerationEvents = table.Column<int>(type: "int", nullable: false),
                    IdleTimeSeconds = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehicleMovementHistory", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VehicleMovementHistory_Vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "Vehicles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_VehicleMovementHistory_CartrackTripId",
                table: "VehicleMovementHistory",
                column: "CartrackTripId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VehicleMovementHistory_RegistrationNumber_MovementDate",
                table: "VehicleMovementHistory",
                columns: new[] { "RegistrationNumber", "MovementDate" });

            migrationBuilder.CreateIndex(
                name: "IX_VehicleMovementHistory_VehicleId_MovementDate",
                table: "VehicleMovementHistory",
                columns: new[] { "VehicleId", "MovementDate" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VehicleMovementHistory");
        }
    }
}
