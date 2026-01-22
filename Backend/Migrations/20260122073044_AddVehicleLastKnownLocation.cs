using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddVehicleLastKnownLocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "LastKnownAddress",
                table: "Vehicles",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LastKnownLatitude",
                table: "Vehicles",
                type: "decimal(18,10)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "LastKnownLongitude",
                table: "Vehicles",
                type: "decimal(18,10)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LastKnownStatus",
                table: "Vehicles",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastLocationUpdate",
                table: "Vehicles",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LastKnownAddress",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "LastKnownLatitude",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "LastKnownLongitude",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "LastKnownStatus",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "LastLocationUpdate",
                table: "Vehicles");
        }
    }
}
