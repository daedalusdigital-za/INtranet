using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class UpdatePasswordHashes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 1,
                column: "PasswordHash",
                value: "$2a$11$XQRdlQ8P9RfHOKVYOz5Wy.vHZe8RrH7pNWEJhGCRdPQ6kV0UqKPXm");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 2,
                column: "PasswordHash",
                value: "$2a$11$XQRdlQ8P9RfHOKVYOz5Wy.vHZe8RrH7pNWEJhGCRdPQ6kV0UqKPXm");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 3,
                column: "PasswordHash",
                value: "$2a$11$XQRdlQ8P9RfHOKVYOz5Wy.vHZe8RrH7pNWEJhGCRdPQ6kV0UqKPXm");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 1,
                column: "PasswordHash",
                value: "$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 2,
                column: "PasswordHash",
                value: "$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2");

            migrationBuilder.UpdateData(
                table: "Users",
                keyColumn: "UserId",
                keyValue: 3,
                column: "PasswordHash",
                value: "$2a$11$wq3z4LhM9QGhGVZ9YDxzje7HYG5QC5qCvW3BdU5qP5M5zk7LvXvO2");
        }
    }
}
