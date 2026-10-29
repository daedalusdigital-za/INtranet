using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Rocket Freight client portal: portal sign-ins (one customer each), per-user
    /// notification preferences and the support conversation. Idempotent raw SQL so it
    /// is safe against schema drift.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261028100000_AddClientPortalTables")]
    public partial class AddClientPortalTables : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('PortalUsers','U') IS NULL
CREATE TABLE [PortalUsers] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_PortalUsers PRIMARY KEY,
    [CustomerId] int NOT NULL,
    [Name] nvarchar(150) NOT NULL,
    [Email] nvarchar(200) NOT NULL,
    [Phone] nvarchar(50) NULL,
    [PasswordHash] nvarchar(200) NOT NULL,
    [Role] nvarchar(20) NOT NULL CONSTRAINT DF_PortalUsers_Role DEFAULT 'user',
    [IsActive] bit NOT NULL CONSTRAINT DF_PortalUsers_IsActive DEFAULT 1,
    [MustChangePassword] bit NOT NULL CONSTRAINT DF_PortalUsers_MustChange DEFAULT 0,
    [FailedLogins] int NOT NULL CONSTRAINT DF_PortalUsers_FailedLogins DEFAULT 0,
    [LockedUntil] datetime2 NULL,
    [LastLoginAt] datetime2 NULL,
    [ResetToken] nvarchar(100) NULL,
    [ResetTokenExpiresAt] datetime2 NULL,
    [CreatedByUserId] int NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_PortalUsers_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PortalUsers_Email') CREATE UNIQUE INDEX IX_PortalUsers_Email ON [PortalUsers]([Email]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PortalUsers_CustomerId') CREATE INDEX IX_PortalUsers_CustomerId ON [PortalUsers]([CustomerId]);

IF OBJECT_ID('PortalNotificationPrefs','U') IS NULL
CREATE TABLE [PortalNotificationPrefs] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_PortalNotificationPrefs PRIMARY KEY,
    [PortalUserId] int NOT NULL,
    [PrefsJson] nvarchar(max) NOT NULL CONSTRAINT DF_PortalNotificationPrefs_Json DEFAULT '{}',
    [UpdatedAt] datetime2 NOT NULL CONSTRAINT DF_PortalNotificationPrefs_UpdatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PortalNotificationPrefs_PortalUsers FOREIGN KEY ([PortalUserId]) REFERENCES [PortalUsers]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PortalNotificationPrefs_PortalUserId') CREATE UNIQUE INDEX IX_PortalNotificationPrefs_PortalUserId ON [PortalNotificationPrefs]([PortalUserId]);

IF OBJECT_ID('PortalSupportMessages','U') IS NULL
CREATE TABLE [PortalSupportMessages] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_PortalSupportMessages PRIMARY KEY,
    [PortalUserId] int NOT NULL,
    [From] nvarchar(10) NOT NULL CONSTRAINT DF_PortalSupportMessages_From DEFAULT 'client',
    [Text] nvarchar(4000) NOT NULL,
    [AuthorName] nvarchar(150) NULL,
    [ShipmentId] int NULL,
    [ShipmentRef] nvarchar(30) NULL,
    [AgentUserId] int NULL,
    [ReadByAgent] bit NOT NULL CONSTRAINT DF_PortalSupportMessages_ReadByAgent DEFAULT 0,
    [ReadByClient] bit NOT NULL CONSTRAINT DF_PortalSupportMessages_ReadByClient DEFAULT 0,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_PortalSupportMessages_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_PortalSupportMessages_PortalUsers FOREIGN KEY ([PortalUserId]) REFERENCES [PortalUsers]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PortalSupportMessages_User_Created') CREATE INDEX IX_PortalSupportMessages_User_Created ON [PortalSupportMessages]([PortalUserId],[CreatedAt]);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DROP TABLE IF EXISTS [PortalSupportMessages];
DROP TABLE IF EXISTS [PortalNotificationPrefs];
DROP TABLE IF EXISTS [PortalUsers];
");
        }
    }
}
