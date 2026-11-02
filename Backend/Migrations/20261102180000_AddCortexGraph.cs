using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Cortex: the company knowledge graph. Node types are configuration rows; nodes and edges carry provenance
    /// (derived / curated / inferred), an owner, a permission and a review date; every change is versioned so the
    /// map can be replayed for any past date. Derived content is rebuilt by CortexGraphBuilder, never typed in.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261102180000_AddCortexGraph")]
    public partial class AddCortexGraph : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('CortexNodeTypes') IS NULL
CREATE TABLE [CortexNodeTypes] (
    [Key] nvarchar(40) NOT NULL CONSTRAINT PK_CortexNodeTypes PRIMARY KEY,
    [Label] nvarchar(80) NOT NULL,
    [Layer] nvarchar(30) NOT NULL,
    [Icon] nvarchar(40) NOT NULL DEFAULT 'circle',
    [Color] nvarchar(20) NOT NULL DEFAULT '#94a3b8',
    [AttachedType] nvarchar(40) NULL,
    [ZoomLevel] int NOT NULL DEFAULT 3,
    [SortOrder] int NOT NULL DEFAULT 0,
    [DefaultSource] nvarchar(60) NULL
);");

            migrationBuilder.Sql(@"
IF OBJECT_ID('CortexNodes') IS NULL
BEGIN
CREATE TABLE [CortexNodes] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CortexNodes PRIMARY KEY,
    [Key] nvarchar(120) NOT NULL,
    [Type] nvarchar(40) NOT NULL,
    [Label] nvarchar(200) NOT NULL,
    [Short] nvarchar(60) NULL,
    [Summary] nvarchar(1000) NULL,
    [ParentKey] nvarchar(120) NULL,
    [Provenance] nvarchar(12) NOT NULL DEFAULT 'derived',
    [Source] nvarchar(120) NULL,
    [SourceId] nvarchar(60) NULL,
    [OwnerUserId] int NULL,
    [OwnerLabel] nvarchar(150) NULL,
    [Permission] nvarchar(60) NULL,
    [ReviewDueAt] datetime2 NULL,
    [Route] nvarchar(200) NULL,
    [DataJson] nvarchar(max) NULL,
    [Rationale] nvarchar(1000) NULL,
    [Status] nvarchar(12) NOT NULL DEFAULT 'accepted',
    [IsActive] bit NOT NULL DEFAULT 1,
    [LastSeenAt] datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [CreatedAt] datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL,
    [UpdatedByUserId] int NULL
);
CREATE UNIQUE INDEX IX_CortexNodes_Key ON [CortexNodes]([Key]);
CREATE INDEX IX_CortexNodes_Type_IsActive ON [CortexNodes]([Type],[IsActive]);
CREATE INDEX IX_CortexNodes_ParentKey ON [CortexNodes]([ParentKey]);
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID('CortexEdges') IS NULL
BEGIN
CREATE TABLE [CortexEdges] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CortexEdges PRIMARY KEY,
    [FromKey] nvarchar(120) NOT NULL,
    [ToKey] nvarchar(120) NOT NULL,
    [Relation] nvarchar(30) NOT NULL,
    [Label] nvarchar(200) NULL,
    [Handoff] nvarchar(12) NULL,
    [HandoffCurated] bit NOT NULL DEFAULT 0,
    [CodeRef] nvarchar(200) NULL,
    [Provenance] nvarchar(12) NOT NULL DEFAULT 'derived',
    [Source] nvarchar(120) NULL,
    [Weight] int NULL,
    [DataJson] nvarchar(max) NULL,
    [Rationale] nvarchar(1000) NULL,
    [Status] nvarchar(12) NOT NULL DEFAULT 'accepted',
    [IsActive] bit NOT NULL DEFAULT 1,
    [LastSeenAt] datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [CreatedAt] datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL,
    [DwellAvgHours] float NULL,
    [DwellMedianHours] float NULL,
    [DwellP90Hours] float NULL,
    [QueueSize] int NULL,
    [MetricsAt] datetime2 NULL
);
CREATE UNIQUE INDEX IX_CortexEdges_From_To_Relation ON [CortexEdges]([FromKey],[ToKey],[Relation]);
CREATE INDEX IX_CortexEdges_ToKey ON [CortexEdges]([ToKey]);
END");

            migrationBuilder.Sql(@"
IF OBJECT_ID('CortexChanges') IS NULL
BEGIN
CREATE TABLE [CortexChanges] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_CortexChanges PRIMARY KEY,
    [Target] nvarchar(4) NOT NULL,
    [TargetKey] nvarchar(250) NOT NULL,
    [Kind] nvarchar(12) NOT NULL,
    [Field] nvarchar(60) NULL,
    [OldValue] nvarchar(max) NULL,
    [NewValue] nvarchar(max) NULL,
    [ChangedBy] nvarchar(20) NOT NULL DEFAULT 'rebuild',
    [UserId] int NULL,
    [UserName] nvarchar(150) NULL,
    [OccurredAt] datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_CortexChanges_TargetKey_OccurredAt ON [CortexChanges]([TargetKey],[OccurredAt]);
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [CortexChanges]; DROP TABLE IF EXISTS [CortexEdges]; DROP TABLE IF EXISTS [CortexNodes]; DROP TABLE IF EXISTS [CortexNodeTypes];");
        }
    }
}
