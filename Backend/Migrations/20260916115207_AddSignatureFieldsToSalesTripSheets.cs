using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSignatureFieldsToSalesTripSheets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "SignedAt",
                table: "SalesTripSheets",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignedByName",
                table: "SalesTripSheets",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SignedByUserId",
                table: "SalesTripSheets",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SignedAt",
                table: "SalesTripSheets");

            migrationBuilder.DropColumn(
                name: "SignedByName",
                table: "SalesTripSheets");

            migrationBuilder.DropColumn(
                name: "SignedByUserId",
                table: "SalesTripSheets");
        }
    }
}
