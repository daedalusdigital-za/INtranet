using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Per-user Home page layouts (widgets and shortcuts), stored as JSON.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261030090000_AddUserHomeLayouts")]
    public partial class AddUserHomeLayouts : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('UserHomeLayouts','U') IS NULL
BEGIN
    CREATE TABLE [UserHomeLayouts] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_UserHomeLayouts] PRIMARY KEY,
        [UserId] int NOT NULL,
        [LayoutJson] nvarchar(max) NOT NULL CONSTRAINT [DF_UserHomeLayouts_LayoutJson] DEFAULT N'{}',
        [UpdatedAt] datetime2 NOT NULL CONSTRAINT [DF_UserHomeLayouts_UpdatedAt] DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX [IX_UserHomeLayouts_UserId] ON [UserHomeLayouts]([UserId]);
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF OBJECT_ID('UserHomeLayouts','U') IS NOT NULL DROP TABLE [UserHomeLayouts];");
        }
    }
}
