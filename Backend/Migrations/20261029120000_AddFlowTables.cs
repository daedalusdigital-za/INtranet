using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Flows: automated business processes (definitions, runs, human tasks/approvals, audit trail).
    /// Idempotent raw SQL so it is safe against schema drift.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261029120000_AddFlowTables")]
    public partial class AddFlowTables : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('FlowDefinitions','U') IS NULL
CREATE TABLE [FlowDefinitions] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_FlowDefinitions PRIMARY KEY,
    [Name] nvarchar(150) NOT NULL,
    [Description] nvarchar(1000) NULL,
    [Category] nvarchar(40) NOT NULL CONSTRAINT DF_FlowDefinitions_Category DEFAULT 'general',
    [Level] int NOT NULL CONSTRAINT DF_FlowDefinitions_Level DEFAULT 1,
    [TriggerType] nvarchar(20) NOT NULL CONSTRAINT DF_FlowDefinitions_TriggerType DEFAULT 'manual',
    [TriggerJson] nvarchar(max) NOT NULL CONSTRAINT DF_FlowDefinitions_TriggerJson DEFAULT '{}',
    [GraphJson] nvarchar(max) NOT NULL CONSTRAINT DF_FlowDefinitions_GraphJson DEFAULT '{}',
    [InputsJson] nvarchar(max) NULL,
    [IsEnabled] bit NOT NULL CONSTRAINT DF_FlowDefinitions_IsEnabled DEFAULT 1,
    [IsTemplate] bit NOT NULL CONSTRAINT DF_FlowDefinitions_IsTemplate DEFAULT 0,
    [Version] int NOT NULL CONSTRAINT DF_FlowDefinitions_Version DEFAULT 1,
    [StartPermissions] nvarchar(300) NULL,
    [LastScheduledRunAt] datetime2 NULL,
    [CreatedByUserId] int NULL,
    [UpdatedByUserId] int NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_FlowDefinitions_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL
);

IF OBJECT_ID('FlowRuns','U') IS NULL
CREATE TABLE [FlowRuns] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_FlowRuns PRIMARY KEY,
    [FlowDefinitionId] int NOT NULL,
    [DefinitionVersion] int NOT NULL CONSTRAINT DF_FlowRuns_Version DEFAULT 1,
    [RunNumber] nvarchar(20) NOT NULL,
    [Title] nvarchar(300) NOT NULL CONSTRAINT DF_FlowRuns_Title DEFAULT '',
    [Status] nvarchar(20) NOT NULL CONSTRAINT DF_FlowRuns_Status DEFAULT 'running',
    [CurrentStepId] nvarchar(60) NULL,
    [ContextJson] nvarchar(max) NOT NULL CONSTRAINT DF_FlowRuns_ContextJson DEFAULT '{}',
    [TriggerSource] nvarchar(80) NOT NULL CONSTRAINT DF_FlowRuns_TriggerSource DEFAULT '',
    [EntityType] nvarchar(40) NULL,
    [EntityKey] nvarchar(60) NULL,
    [Priority] nvarchar(20) NOT NULL CONSTRAINT DF_FlowRuns_Priority DEFAULT 'Normal',
    [StartedByUserId] int NULL,
    [StartedAt] datetime2 NOT NULL CONSTRAINT DF_FlowRuns_StartedAt DEFAULT SYSUTCDATETIME(),
    [CompletedAt] datetime2 NULL,
    [ResumeAt] datetime2 NULL,
    [Error] nvarchar(2000) NULL,
    [Outcome] nvarchar(100) NULL,
    CONSTRAINT FK_FlowRuns_FlowDefinitions FOREIGN KEY ([FlowDefinitionId]) REFERENCES [FlowDefinitions]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FlowRuns_Status') CREATE INDEX IX_FlowRuns_Status ON [FlowRuns]([Status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FlowRuns_EntityType_EntityKey') CREATE INDEX IX_FlowRuns_EntityType_EntityKey ON [FlowRuns]([EntityType],[EntityKey]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FlowRuns_RunNumber') CREATE UNIQUE INDEX IX_FlowRuns_RunNumber ON [FlowRuns]([RunNumber]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FlowRuns_FlowDefinitionId') CREATE INDEX IX_FlowRuns_FlowDefinitionId ON [FlowRuns]([FlowDefinitionId]);

IF OBJECT_ID('FlowTasks','U') IS NULL
CREATE TABLE [FlowTasks] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_FlowTasks PRIMARY KEY,
    [FlowRunId] int NOT NULL,
    [StepId] nvarchar(60) NOT NULL CONSTRAINT DF_FlowTasks_StepId DEFAULT '',
    [Kind] nvarchar(20) NOT NULL CONSTRAINT DF_FlowTasks_Kind DEFAULT 'task',
    [Title] nvarchar(300) NOT NULL,
    [Description] nvarchar(max) NULL,
    [AssignedToUserId] int NULL,
    [AssignedToRole] nvarchar(50) NULL,
    [AssignedToDepartmentId] int NULL,
    [AssigneeLabel] nvarchar(150) NULL,
    [Priority] nvarchar(20) NOT NULL CONSTRAINT DF_FlowTasks_Priority DEFAULT 'Normal',
    [Status] nvarchar(20) NOT NULL CONSTRAINT DF_FlowTasks_Status DEFAULT 'open',
    [DueAt] datetime2 NULL,
    [IsOverdue] bit NOT NULL CONSTRAINT DF_FlowTasks_IsOverdue DEFAULT 0,
    [EscalationCount] int NOT NULL CONSTRAINT DF_FlowTasks_EscalationCount DEFAULT 0,
    [EscalatedAt] datetime2 NULL,
    [FormJson] nvarchar(max) NULL,
    [ResultJson] nvarchar(max) NULL,
    [Comment] nvarchar(2000) NULL,
    [CompletedByUserId] int NULL,
    [CompletedAt] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_FlowTasks_CreatedAt DEFAULT SYSUTCDATETIME(),
    [TodoTaskId] int NULL,
    CONSTRAINT FK_FlowTasks_FlowRuns FOREIGN KEY ([FlowRunId]) REFERENCES [FlowRuns]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FlowTasks_Status_AssignedToUserId') CREATE INDEX IX_FlowTasks_Status_AssignedToUserId ON [FlowTasks]([Status],[AssignedToUserId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FlowTasks_DueAt') CREATE INDEX IX_FlowTasks_DueAt ON [FlowTasks]([DueAt]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FlowTasks_FlowRunId') CREATE INDEX IX_FlowTasks_FlowRunId ON [FlowTasks]([FlowRunId]);

IF OBJECT_ID('FlowAuditEvents','U') IS NULL
CREATE TABLE [FlowAuditEvents] (
    [Id] bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_FlowAuditEvents PRIMARY KEY,
    [FlowRunId] int NOT NULL,
    [StepId] nvarchar(60) NULL,
    [Type] nvarchar(40) NOT NULL,
    [Message] nvarchar(1000) NOT NULL CONSTRAINT DF_FlowAuditEvents_Message DEFAULT '',
    [DataJson] nvarchar(max) NULL,
    [UserId] int NULL,
    [UserName] nvarchar(150) NULL,
    [OccurredAt] datetime2 NOT NULL CONSTRAINT DF_FlowAuditEvents_OccurredAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_FlowAuditEvents_FlowRuns FOREIGN KEY ([FlowRunId]) REFERENCES [FlowRuns]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_FlowAuditEvents_FlowRunId') CREATE INDEX IX_FlowAuditEvents_FlowRunId ON [FlowAuditEvents]([FlowRunId]);

IF NOT EXISTS (SELECT 1 FROM [NumberSequences] WHERE [Key]='FL')
    INSERT INTO [NumberSequences]([Key],[NextValue]) VALUES ('FL', 1);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('FlowAuditEvents','U') IS NOT NULL DROP TABLE [FlowAuditEvents];
IF OBJECT_ID('FlowTasks','U') IS NOT NULL DROP TABLE [FlowTasks];
IF OBJECT_ID('FlowRuns','U') IS NOT NULL DROP TABLE [FlowRuns];
IF OBJECT_ID('FlowDefinitions','U') IS NOT NULL DROP TABLE [FlowDefinitions];
");
        }
    }
}
