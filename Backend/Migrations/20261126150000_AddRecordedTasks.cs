using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Task recorder: tasks recorded in the intranet for Welly to walk through, and each run of one.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261126150000_AddRecordedTasks")]
    public partial class AddRecordedTasks : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('RecordedTasks','U') IS NULL
BEGIN
    CREATE TABLE RecordedTasks (
        Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_RecordedTasks PRIMARY KEY,
        Name nvarchar(150) NOT NULL,
        Description nvarchar(1000) NULL,
        StepsJson nvarchar(max) NOT NULL,
        StartUrl nvarchar(500) NULL,
        Visibility nvarchar(10) NOT NULL CONSTRAINT DF_RecordedTasks_Visibility DEFAULT 'private',
        CreatedByUserId int NOT NULL,
        CreatedByName nvarchar(150) NULL,
        CreatedAt datetime2 NOT NULL CONSTRAINT DF_RecordedTasks_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt datetime2 NULL,
        RunCount int NOT NULL CONSTRAINT DF_RecordedTasks_RunCount DEFAULT 0,
        LastRunAt datetime2 NULL,
        IsDeleted bit NOT NULL CONSTRAINT DF_RecordedTasks_IsDeleted DEFAULT 0
    );
    CREATE INDEX IX_RecordedTasks_CreatedBy ON RecordedTasks (CreatedByUserId, IsDeleted);
END
IF OBJECT_ID('RecordedTaskRuns','U') IS NULL
BEGIN
    CREATE TABLE RecordedTaskRuns (
        Id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_RecordedTaskRuns PRIMARY KEY,
        RecordedTaskId int NOT NULL,
        UserId int NOT NULL,
        UserName nvarchar(150) NULL,
        StartedAt datetime2 NOT NULL CONSTRAINT DF_RecordedTaskRuns_StartedAt DEFAULT SYSUTCDATETIME(),
        FinishedAt datetime2 NULL,
        Outcome nvarchar(12) NOT NULL CONSTRAINT DF_RecordedTaskRuns_Outcome DEFAULT 'running',
        StepsTotal int NOT NULL CONSTRAINT DF_RecordedTaskRuns_Total DEFAULT 0,
        StepsByWelly int NOT NULL CONSTRAINT DF_RecordedTaskRuns_Welly DEFAULT 0,
        StepsByPerson int NOT NULL CONSTRAINT DF_RecordedTaskRuns_Person DEFAULT 0,
        StoppedAtStep int NULL,
        StopReason nvarchar(500) NULL
    );
    CREATE INDEX IX_RecordedTaskRuns_Task ON RecordedTaskRuns (RecordedTaskId, StartedAt);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("IF OBJECT_ID('RecordedTaskRuns','U') IS NOT NULL DROP TABLE RecordedTaskRuns; IF OBJECT_ID('RecordedTasks','U') IS NOT NULL DROP TABLE RecordedTasks;");
        }
    }
}
