using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddFleetRepairAndRequisitionWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ActionOwner",
                table: "VehicleMaintenance",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DateStood",
                table: "VehicleMaintenance",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "EstimatedCost",
                table: "VehicleMaintenance",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Feedback",
                table: "VehicleMaintenance",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "VehicleMaintenance",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Province",
                table: "VehicleMaintenance",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "TargetDate",
                table: "VehicleMaintenance",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ActionOwner",
                table: "VehicleMaintenance");

            migrationBuilder.DropColumn(
                name: "DateStood",
                table: "VehicleMaintenance");

            migrationBuilder.DropColumn(
                name: "EstimatedCost",
                table: "VehicleMaintenance");

            migrationBuilder.DropColumn(
                name: "Feedback",
                table: "VehicleMaintenance");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "VehicleMaintenance");

            migrationBuilder.DropColumn(
                name: "Province",
                table: "VehicleMaintenance");

            migrationBuilder.DropColumn(
                name: "TargetDate",
                table: "VehicleMaintenance");
        }
    }
}
