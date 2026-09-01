-- Welly Memory Table Migration
-- Central, daily-logged cache of every meaningful task Welly performs.
-- Shared across all users so Welly can recall past analyses during chat.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WellyMemories')
BEGIN
    CREATE TABLE [WellyMemories] (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [MemoryType] NVARCHAR(100) NOT NULL,
        [Title] NVARCHAR(500) NOT NULL,
        [EntityName] NVARCHAR(500) NULL,
        [Summary] NVARCHAR(4000) NOT NULL DEFAULT '',
        [FullContent] NVARCHAR(MAX) NULL,
        [Keywords] NVARCHAR(1000) NULL,
        [MetadataJson] NVARCHAR(MAX) NULL,
        [UserId] INT NULL,
        [UserName] NVARCHAR(300) NULL,
        [MemoryDate] DATETIME2 NOT NULL DEFAULT CAST(GETUTCDATE() AS DATE),
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [IsActive] BIT NOT NULL DEFAULT 1
    );
    PRINT 'Created table: WellyMemories';
END
GO

-- Indexes for fast recall
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WellyMemories_MemoryType')
    CREATE INDEX [IX_WellyMemories_MemoryType] ON [WellyMemories]([MemoryType]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WellyMemories_EntityName')
    CREATE INDEX [IX_WellyMemories_EntityName] ON [WellyMemories]([EntityName]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WellyMemories_MemoryDate')
    CREATE INDEX [IX_WellyMemories_MemoryDate] ON [WellyMemories]([MemoryDate]);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WellyMemories_IsActive')
    CREATE INDEX [IX_WellyMemories_IsActive] ON [WellyMemories]([IsActive]);
GO

PRINT 'Welly Memory migration completed successfully!';
