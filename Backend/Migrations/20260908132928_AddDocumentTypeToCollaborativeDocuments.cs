using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentTypeToCollaborativeDocuments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Only add the new discriminator column. The Paperless* tables that the
            // scaffolder also detected already exist in the database (created via raw
            // SQL earlier), so they are intentionally NOT recreated here to avoid
            // "object already exists" schema-drift failures. The model snapshot still
            // records them so future migrations stay consistent.
            // Guarded so a re-run is safe.
            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = N'DocumentType'
      AND Object_ID = Object_ID(N'dbo.CollaborativeDocuments')
)
BEGIN
    ALTER TABLE [CollaborativeDocuments]
        ADD [DocumentType] nvarchar(20) NOT NULL CONSTRAINT [DF_CollaborativeDocuments_DocumentType] DEFAULT N'doc';
END
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = N'DocumentType'
      AND Object_ID = Object_ID(N'dbo.CollaborativeDocuments')
)
BEGIN
    ALTER TABLE [CollaborativeDocuments] DROP CONSTRAINT [DF_CollaborativeDocuments_DocumentType];
    ALTER TABLE [CollaborativeDocuments] DROP COLUMN [DocumentType];
END
");
        }
    }
}
