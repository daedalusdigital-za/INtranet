using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Users: self-service password reset — hashed single-use token emailed by an admin, plus its expiry.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261123140000_AddUserPasswordResetToken")]
    public partial class AddUserPasswordResetToken : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('Users','PasswordResetTokenHash') IS NULL ALTER TABLE Users ADD PasswordResetTokenHash nvarchar(64) NULL;
IF COL_LENGTH('Users','PasswordResetExpiresAt') IS NULL ALTER TABLE Users ADD PasswordResetExpiresAt datetime2 NULL;
");
            // No index on the token: Users is small, and a filtered index would make every write to
            // Users fail for clients that connect with QUOTED_IDENTIFIER OFF (e.g. sqlcmd scripts).
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Users_PasswordResetTokenHash' AND object_id = OBJECT_ID('Users'))
    DROP INDEX IX_Users_PasswordResetTokenHash ON Users;
IF COL_LENGTH('Users','PasswordResetExpiresAt') IS NOT NULL ALTER TABLE Users DROP COLUMN PasswordResetExpiresAt;
IF COL_LENGTH('Users','PasswordResetTokenHash') IS NOT NULL ALTER TABLE Users DROP COLUMN PasswordResetTokenHash;
");
        }
    }
}
