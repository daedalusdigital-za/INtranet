using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Shared Home widgets designed in Flows (FlowWidgets), with a few starter templates.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261030120000_AddFlowWidgets")]
    public partial class AddFlowWidgets : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('FlowWidgets','U') IS NULL
BEGIN
    CREATE TABLE [FlowWidgets] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_FlowWidgets] PRIMARY KEY,
        [Name] nvarchar(120) NOT NULL,
        [Description] nvarchar(500) NULL,
        [Icon] nvarchar(60) NOT NULL CONSTRAINT [DF_FlowWidgets_Icon] DEFAULT N'widgets',
        [Type] nvarchar(40) NOT NULL,
        [Size] nvarchar(4) NOT NULL CONSTRAINT [DF_FlowWidgets_Size] DEFAULT N'sm',
        [ConfigJson] nvarchar(max) NOT NULL CONSTRAINT [DF_FlowWidgets_ConfigJson] DEFAULT N'{}',
        [Category] nvarchar(40) NOT NULL CONSTRAINT [DF_FlowWidgets_Category] DEFAULT N'General',
        [DepartmentName] nvarchar(100) NULL,
        [IsTemplate] bit NOT NULL CONSTRAINT [DF_FlowWidgets_IsTemplate] DEFAULT 0,
        [IsPublished] bit NOT NULL CONSTRAINT [DF_FlowWidgets_IsPublished] DEFAULT 1,
        [UseCount] int NOT NULL CONSTRAINT [DF_FlowWidgets_UseCount] DEFAULT 0,
        [CreatedByUserId] int NULL,
        [CreatedAt] datetime2 NOT NULL CONSTRAINT [DF_FlowWidgets_CreatedAt] DEFAULT SYSUTCDATETIME(),
        [UpdatedAt] datetime2 NULL
    );
    CREATE INDEX [IX_FlowWidgets_IsTemplate_IsPublished] ON [FlowWidgets]([IsTemplate],[IsPublished]);

    INSERT INTO [FlowWidgets] ([Name],[Description],[Icon],[Type],[Size],[ConfigJson],[Category],[IsTemplate],[IsPublished]) VALUES
    (N'Active runs counter', N'One number: how many runs of a flow are live right now. Pick the flow when you use it.', N'pin', N'flow-kpi', N'sm', N'{""flowId"":null,""metric"":""active""}', N'Flows', 1, 1),
    (N'Waiting on people', N'How many runs are paused on a human decision. Good for a team lead''s Home.', N'hourglass_top', N'flow-kpi', N'sm', N'{""flowId"":null,""metric"":""waiting""}', N'Flows', 1, 1),
    (N'Failed this month', N'Runs that failed in the last 30 days, so problems get noticed.', N'error_outline', N'flow-kpi', N'sm', N'{""flowId"":null,""metric"":""failed""}', N'Flows', 1, 1),
    (N'Flow activity board', N'Live runs of a flow with where each one is and who has it.', N'account_tree', N'flow-runs', N'lg', N'{""flowId"":null}', N'Flows', 1, 1),
    (N'Quick-start buttons', N'One-click buttons to start your team''s most used flows.', N'play_circle', N'flow-start', N'md', N'{""flowIds"":[]}', N'Flows', 1, 1),
    (N'Approvals for me', N'Approvals and tasks that flows have handed to the signed-in person.', N'approval', N'flow-tasks', N'lg', N'{}', N'Flows', 1, 1),
    (N'Team links', N'A curated list of pages and systems a department uses every day.', N'link', N'links', N'sm', N'{""links"":[{""label"":""Company news"",""url"":""/welcome""},{""label"":""Calendar"",""url"":""/calendar""}]}', N'Personal', 1, 1);
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF OBJECT_ID('FlowWidgets','U') IS NOT NULL DROP TABLE [FlowWidgets];");
        }
    }
}
