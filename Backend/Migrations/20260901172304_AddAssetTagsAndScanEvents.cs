using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAssetTagsAndScanEvents : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AssetTags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Symbology = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TagType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ItemCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    AssetItemId = table.Column<int>(type: "int", nullable: true),
                    LoadId = table.Column<int>(type: "int", nullable: true),
                    ImportedInvoiceId = table.Column<int>(type: "int", nullable: true),
                    CommodityId = table.Column<int>(type: "int", nullable: true),
                    Label = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SerialNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CurrentLocation = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SourceCompany = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AssetTags", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AssetTags_Commodities_CommodityId",
                        column: x => x.CommodityId,
                        principalTable: "Commodities",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AssetTags_ImportedInvoices_ImportedInvoiceId",
                        column: x => x.ImportedInvoiceId,
                        principalTable: "ImportedInvoices",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_AssetTags_Loads_LoadId",
                        column: x => x.LoadId,
                        principalTable: "Loads",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "ScanEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ScannedCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    AssetTagId = table.Column<int>(type: "int", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ScanMethod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    LoadId = table.Column<int>(type: "int", nullable: true),
                    Location = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Latitude = table.Column<decimal>(type: "decimal(10,7)", nullable: true),
                    Longitude = table.Column<decimal>(type: "decimal(10,7)", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ScannedByUserId = table.Column<int>(type: "int", nullable: true),
                    ScannedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ScannedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScanEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScanEvents_AssetTags_AssetTagId",
                        column: x => x.AssetTagId,
                        principalTable: "AssetTags",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_ScanEvents_Loads_LoadId",
                        column: x => x.LoadId,
                        principalTable: "Loads",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AssetTags_AssetItemId",
                table: "AssetTags",
                column: "AssetItemId");

            migrationBuilder.CreateIndex(
                name: "IX_AssetTags_CommodityId",
                table: "AssetTags",
                column: "CommodityId");

            migrationBuilder.CreateIndex(
                name: "IX_AssetTags_ImportedInvoiceId",
                table: "AssetTags",
                column: "ImportedInvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_AssetTags_ItemCode",
                table: "AssetTags",
                column: "ItemCode");

            migrationBuilder.CreateIndex(
                name: "IX_AssetTags_LoadId",
                table: "AssetTags",
                column: "LoadId");

            migrationBuilder.CreateIndex(
                name: "UQ_AssetTags_Code",
                table: "AssetTags",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScanEvents_AssetTagId",
                table: "ScanEvents",
                column: "AssetTagId");

            migrationBuilder.CreateIndex(
                name: "IX_ScanEvents_LoadId",
                table: "ScanEvents",
                column: "LoadId");

            migrationBuilder.CreateIndex(
                name: "IX_ScanEvents_ScannedAt",
                table: "ScanEvents",
                column: "ScannedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ScanEvents_ScannedCode",
                table: "ScanEvents",
                column: "ScannedCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScanEvents");

            migrationBuilder.DropTable(
                name: "AssetTags");
        }
    }
}
