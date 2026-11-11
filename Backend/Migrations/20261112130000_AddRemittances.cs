using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Finance: remittance advices swept nightly from the finance mailbox, with attachments.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261112130000_AddRemittances")]
    public partial class AddRemittances : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('RemittanceEmails','U') IS NULL
CREATE TABLE [RemittanceEmails] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_RemittanceEmails PRIMARY KEY,
    [Mailbox] nvarchar(200) NOT NULL,
    [MessageId] nvarchar(300) NOT NULL,
    [FromName] nvarchar(200) NULL,
    [FromEmail] nvarchar(200) NULL,
    [Subject] nvarchar(500) NULL,
    [ReceivedAt] datetime2 NOT NULL,
    [BodyText] nvarchar(max) NULL,
    [MatchedOn] nvarchar(200) NULL,
    [CustomerCode] nvarchar(50) NULL,
    [CustomerName] nvarchar(255) NULL,
    [ExtractedJson] nvarchar(max) NULL,
    [InvoiceCount] int NOT NULL CONSTRAINT DF_RemittanceEmails_InvoiceCount DEFAULT 0,
    [MatchedCount] int NOT NULL CONSTRAINT DF_RemittanceEmails_MatchedCount DEFAULT 0,
    [TotalAmount] decimal(18,2) NULL,
    [MatchedBalance] decimal(18,2) NOT NULL CONSTRAINT DF_RemittanceEmails_MatchedBalance DEFAULT 0,
    [Status] nvarchar(20) NOT NULL CONSTRAINT DF_RemittanceEmails_Status DEFAULT 'New',
    [Notes] nvarchar(2000) NULL,
    [ReviewedBy] int NULL,
    [ReviewedAt] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_RemittanceEmails_CreatedAt DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_RemittanceEmails_Mailbox_MessageId') CREATE UNIQUE INDEX UX_RemittanceEmails_Mailbox_MessageId ON [RemittanceEmails]([Mailbox],[MessageId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_RemittanceEmails_Status_Received') CREATE INDEX IX_RemittanceEmails_Status_Received ON [RemittanceEmails]([Status],[ReceivedAt]);

IF OBJECT_ID('RemittanceAttachments','U') IS NULL
CREATE TABLE [RemittanceAttachments] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_RemittanceAttachments PRIMARY KEY,
    [RemittanceEmailId] int NOT NULL,
    [FileName] nvarchar(255) NOT NULL,
    [ContentType] nvarchar(100) NULL,
    [Size] bigint NOT NULL CONSTRAINT DF_RemittanceAttachments_Size DEFAULT 0,
    [StoragePath] nvarchar(500) NOT NULL,
    [ExtractedText] nvarchar(max) NULL,
    CONSTRAINT FK_RemittanceAttachments_Emails FOREIGN KEY ([RemittanceEmailId]) REFERENCES [RemittanceEmails]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_RemittanceAttachments_Email') CREATE INDEX IX_RemittanceAttachments_Email ON [RemittanceAttachments]([RemittanceEmailId]);

IF OBJECT_ID('RemittanceScans','U') IS NULL
CREATE TABLE [RemittanceScans] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_RemittanceScans PRIMARY KEY,
    [StartedAt] datetime2 NOT NULL CONSTRAINT DF_RemittanceScans_StartedAt DEFAULT SYSUTCDATETIME(),
    [FinishedAt] datetime2 NULL,
    [Mailboxes] nvarchar(500) NULL,
    [MessagesChecked] int NOT NULL CONSTRAINT DF_RemittanceScans_MessagesChecked DEFAULT 0,
    [RemittancesFound] int NOT NULL CONSTRAINT DF_RemittanceScans_RemittancesFound DEFAULT 0,
    [Trigger] nvarchar(20) NOT NULL CONSTRAINT DF_RemittanceScans_Trigger DEFAULT 'schedule',
    [Error] nvarchar(1000) NULL
);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [RemittanceAttachments]; DROP TABLE IF EXISTS [RemittanceEmails]; DROP TABLE IF EXISTS [RemittanceScans];");
        }
    }
}
