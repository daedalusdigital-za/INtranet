using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class PodLinkNullableInvoiceWithNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PodDocumentInvoiceLinks_ImportedInvoices_InvoiceId",
                table: "PodDocumentInvoiceLinks");

            migrationBuilder.DropIndex(
                name: "IX_PodDocumentInvoiceLinks_PodDocumentId_InvoiceId",
                table: "PodDocumentInvoiceLinks");

            migrationBuilder.AlterColumn<int>(
                name: "InvoiceId",
                table: "PodDocumentInvoiceLinks",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "InvoiceNumber",
                table: "PodDocumentInvoiceLinks",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PodDocumentInvoiceLinks_InvoiceNumber",
                table: "PodDocumentInvoiceLinks",
                column: "InvoiceNumber");

            migrationBuilder.CreateIndex(
                name: "IX_PodDocumentInvoiceLinks_PodDocumentId_InvoiceId",
                table: "PodDocumentInvoiceLinks",
                columns: new[] { "PodDocumentId", "InvoiceId" },
                unique: true,
                filter: "[InvoiceId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_PodDocumentInvoiceLinks_ImportedInvoices_InvoiceId",
                table: "PodDocumentInvoiceLinks",
                column: "InvoiceId",
                principalTable: "ImportedInvoices",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PodDocumentInvoiceLinks_ImportedInvoices_InvoiceId",
                table: "PodDocumentInvoiceLinks");

            migrationBuilder.DropIndex(
                name: "IX_PodDocumentInvoiceLinks_InvoiceNumber",
                table: "PodDocumentInvoiceLinks");

            migrationBuilder.DropIndex(
                name: "IX_PodDocumentInvoiceLinks_PodDocumentId_InvoiceId",
                table: "PodDocumentInvoiceLinks");

            migrationBuilder.DropColumn(
                name: "InvoiceNumber",
                table: "PodDocumentInvoiceLinks");

            migrationBuilder.AlterColumn<int>(
                name: "InvoiceId",
                table: "PodDocumentInvoiceLinks",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_PodDocumentInvoiceLinks_PodDocumentId_InvoiceId",
                table: "PodDocumentInvoiceLinks",
                columns: new[] { "PodDocumentId", "InvoiceId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_PodDocumentInvoiceLinks_ImportedInvoices_InvoiceId",
                table: "PodDocumentInvoiceLinks",
                column: "InvoiceId",
                principalTable: "ImportedInvoices",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
