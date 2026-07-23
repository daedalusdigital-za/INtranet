using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPodDocumentInvoiceLinkTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TripNumber",
                table: "SleepOuts",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TripSheetId",
                table: "SleepOuts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VehicleReg",
                table: "SleepOuts",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProductCode",
                table: "SalesTransactionStagings",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProductDescription",
                table: "SalesTransactionStagings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CallRecords",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AccountCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CallerNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CallerNat = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CalleeNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CalleeNat = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Context = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CallerId = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SourceChannel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DestChannel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    LastApp = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    LastData = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    StartTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AnswerTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    EndTime = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CallTime = table.Column<int>(type: "int", nullable: false),
                    TalkTime = table.Column<int>(type: "int", nullable: false),
                    CallStatus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    AmaFlags = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UniqueId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CallType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DestChannelExtension = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CallerName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AnsweredBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Session = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PremierCaller = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ActionType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    SourceTrunkName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DestinationTrunkName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CallRecords", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PodDocumentInvoiceLinks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PodDocumentId = table.Column<int>(type: "int", nullable: false),
                    InvoiceId = table.Column<int>(type: "int", nullable: false),
                    LinkedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PodDocumentInvoiceLinks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PodDocumentInvoiceLinks_ImportedInvoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "ImportedInvoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PodDocumentInvoiceLinks_PodDocuments_PodDocumentId",
                        column: x => x.PodDocumentId,
                        principalTable: "PodDocuments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PodDocumentInvoiceLinks_InvoiceId",
                table: "PodDocumentInvoiceLinks",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PodDocumentInvoiceLinks_PodDocumentId",
                table: "PodDocumentInvoiceLinks",
                column: "PodDocumentId");

            migrationBuilder.CreateIndex(
                name: "IX_PodDocumentInvoiceLinks_PodDocumentId_InvoiceId",
                table: "PodDocumentInvoiceLinks",
                columns: new[] { "PodDocumentId", "InvoiceId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CallRecords");

            migrationBuilder.DropTable(
                name: "PodDocumentInvoiceLinks");

            migrationBuilder.DropColumn(
                name: "TripNumber",
                table: "SleepOuts");

            migrationBuilder.DropColumn(
                name: "TripSheetId",
                table: "SleepOuts");

            migrationBuilder.DropColumn(
                name: "VehicleReg",
                table: "SleepOuts");

            migrationBuilder.DropColumn(
                name: "ProductCode",
                table: "SalesTransactionStagings");

            migrationBuilder.DropColumn(
                name: "ProductDescription",
                table: "SalesTransactionStagings");
        }
    }
}
