using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSourceWarehouseToLoad : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SourceWarehouseId",
                table: "Loads",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Loads_SourceWarehouseId",
                table: "Loads",
                column: "SourceWarehouseId");

            migrationBuilder.AddForeignKey(
                name: "FK_Loads_Warehouses_SourceWarehouseId",
                table: "Loads",
                column: "SourceWarehouseId",
                principalTable: "Warehouses",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Loads_Warehouses_SourceWarehouseId",
                table: "Loads");

            migrationBuilder.DropIndex(
                name: "IX_Loads_SourceWarehouseId",
                table: "Loads");

            migrationBuilder.DropColumn(
                name: "SourceWarehouseId",
                table: "Loads");
        }
    }
}
