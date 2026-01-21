using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerERPFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "PhoneNumber",
                table: "LogisticsCustomers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MobileNumber",
                table: "LogisticsCustomers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AddressLinesJson",
                table: "LogisticsCustomers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactEmail",
                table: "LogisticsCustomers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactFax",
                table: "LogisticsCustomers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ContactPhone",
                table: "LogisticsCustomers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Fax",
                table: "LogisticsCustomers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ImportBatchId",
                table: "LogisticsCustomers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastMaintained",
                table: "LogisticsCustomers",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShortName",
                table: "LogisticsCustomers",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceSystem",
                table: "LogisticsCustomers",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AddressLinesJson",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "ContactEmail",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "ContactFax",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "ContactPhone",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "Fax",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "ImportBatchId",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "LastMaintained",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "ShortName",
                table: "LogisticsCustomers");

            migrationBuilder.DropColumn(
                name: "SourceSystem",
                table: "LogisticsCustomers");

            migrationBuilder.AlterColumn<string>(
                name: "PhoneNumber",
                table: "LogisticsCustomers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "MobileNumber",
                table: "LogisticsCustomers",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(50)",
                oldMaxLength: 50,
                oldNullable: true);
        }
    }
}
