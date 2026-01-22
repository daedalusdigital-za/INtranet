using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddTfnVehicleFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsLinkedToTfn",
                table: "Vehicles",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "TfnExternalNumber",
                table: "Vehicles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TfnFleetNumber",
                table: "Vehicles",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TfnStatus",
                table: "Vehicles",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CardNumber",
                table: "TfnOrders",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CustomerReference",
                table: "TfnOrders",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsPlanned",
                table: "TfnOrders",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PlannedReasons",
                table: "TfnOrders",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProductCode",
                table: "TfnOrders",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VehicleRegistration",
                table: "TfnOrders",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "AddressVerified",
                table: "LogisticsCustomers",
                type: "bit",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "AddressVerifiedAt",
                table: "LogisticsCustomers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GooglePlaceId",
                table: "LogisticsCustomers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "LogisticsCustomers",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "LogisticsCustomers",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsLinkedToTfn",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "TfnExternalNumber",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "TfnFleetNumber",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "TfnStatus",
                table: "Vehicles");

            migrationBuilder.DropColumn(
                name: "CardNumber",
                table: "TfnOrders");

            migrationBuilder.DropColumn(
                name: "CustomerReference",
                table: "TfnOrders");

            migrationBuilder.DropColumn(
                name: "IsPlanned",
                table: "TfnOrders");

            migrationBuilder.DropColumn(
                name: "PlannedReasons",
                table: "TfnOrders");

            migrationBuilder.DropColumn(
                name: "ProductCode",
                table: "TfnOrders");

            migrationBuilder.DropColumn(
                name: "VehicleRegistration",
                table: "TfnOrders");

            migrationBuilder.DropColumn(
                name: "AddressVerified",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "AddressVerifiedAt",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "GooglePlaceId",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "LogisticsCustomers");
        }
    }
}
