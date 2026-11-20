using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Saved hand signature per user (uploaded in Admin › Users or by the user), stamped onto signed documents.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261120100000_AddUserSignatures")]
    public partial class AddUserSignatures : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Users','SignatureImageData') IS NULL     ALTER TABLE Users ADD SignatureImageData varbinary(max) NULL;
IF COL_LENGTH('Users','SignatureImageMimeType') IS NULL ALTER TABLE Users ADD SignatureImageMimeType nvarchar(50) NULL;
IF COL_LENGTH('Users','SignatureUpdatedAt') IS NULL     ALTER TABLE Users ADD SignatureUpdatedAt datetime2 NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Users','SignatureImageData') IS NOT NULL     ALTER TABLE Users DROP COLUMN SignatureImageData;
IF COL_LENGTH('Users','SignatureImageMimeType') IS NOT NULL ALTER TABLE Users DROP COLUMN SignatureImageMimeType;
IF COL_LENGTH('Users','SignatureUpdatedAt') IS NOT NULL     ALTER TABLE Users DROP COLUMN SignatureUpdatedAt;
");
        }
    }
}
