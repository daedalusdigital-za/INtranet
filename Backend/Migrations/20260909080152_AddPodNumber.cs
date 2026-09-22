using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPodNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PodNumber",
                table: "PodDocuments",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            // Backfill existing rows with a barcode-friendly POD number based on Id.
            migrationBuilder.Sql(
                "UPDATE PodDocuments SET PodNumber = 'POD' + RIGHT('000000' + CAST(Id AS VARCHAR(10)), 6) WHERE PodNumber IS NULL OR PodNumber = '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PodNumber",
                table: "PodDocuments");
        }
    }
}
