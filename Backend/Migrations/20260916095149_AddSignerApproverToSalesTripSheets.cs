using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSignerApproverToSalesTripSheets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApproverName",
                table: "SalesTripSheets",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApproverUserId",
                table: "SalesTripSheets",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SignerName",
                table: "SalesTripSheets",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SignerUserId",
                table: "SalesTripSheets",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApproverName",
                table: "SalesTripSheets");

            migrationBuilder.DropColumn(
                name: "ApproverUserId",
                table: "SalesTripSheets");

            migrationBuilder.DropColumn(
                name: "SignerName",
                table: "SalesTripSheets");

            migrationBuilder.DropColumn(
                name: "SignerUserId",
                table: "SalesTripSheets");
        }
    }
}
