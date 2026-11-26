using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Welly on human flow steps: what Welly prepared for a task, who did each Timeline action (person / welly / system)
    /// and a table of labelled examples (accepted / edited / rejected suggestions).
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261126120000_AddWellySkills")]
    public partial class AddWellySkills : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('FlowTasks','WellyJson') IS NULL ALTER TABLE FlowTasks ADD WellyJson nvarchar(max) NULL;
IF COL_LENGTH('FlowAuditEvents','ActorKind') IS NULL ALTER TABLE FlowAuditEvents ADD ActorKind nvarchar(10) NULL;
IF COL_LENGTH('FlowAuditEvents','SkillKey') IS NULL ALTER TABLE FlowAuditEvents ADD SkillKey nvarchar(80) NULL;
IF OBJECT_ID('WellyFeedback','U') IS NULL
BEGIN
    CREATE TABLE WellyFeedback (
        Id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_WellyFeedback PRIMARY KEY,
        SkillKey nvarchar(80) NOT NULL,
        FlowRunId int NULL,
        FlowTaskId int NULL,
        StepId nvarchar(60) NULL,
        Outcome nvarchar(12) NOT NULL,
        ProposalJson nvarchar(max) NULL,
        FinalJson nvarchar(max) NULL,
        Reason nvarchar(1000) NULL,
        UserId int NULL,
        UserName nvarchar(150) NULL,
        Model nvarchar(80) NULL,
        CreatedAt datetime2 NOT NULL CONSTRAINT DF_WellyFeedback_CreatedAt DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_WellyFeedback_SkillKey ON WellyFeedback (SkillKey, CreatedAt);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('WellyFeedback','U') IS NOT NULL DROP TABLE WellyFeedback;
IF COL_LENGTH('FlowAuditEvents','SkillKey') IS NOT NULL ALTER TABLE FlowAuditEvents DROP COLUMN SkillKey;
IF COL_LENGTH('FlowAuditEvents','ActorKind') IS NOT NULL ALTER TABLE FlowAuditEvents DROP COLUMN ActorKind;
IF COL_LENGTH('FlowTasks','WellyJson') IS NOT NULL ALTER TABLE FlowTasks DROP COLUMN WellyJson;
");
        }
    }
}
