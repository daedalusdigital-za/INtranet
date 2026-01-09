-- Knowledge Base Tables Migration
-- Run this in SQL Server to create the Knowledge Base tables

-- Check if table exists before creating
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'KnowledgeBaseDocuments')
BEGIN
    CREATE TABLE [KnowledgeBaseDocuments] (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [FileName] NVARCHAR(500) NOT NULL,
        [FilePath] NVARCHAR(1000) NOT NULL,
        [FileType] NVARCHAR(50) NULL,
        [FileSize] BIGINT NOT NULL DEFAULT 0,
        [FileHash] NVARCHAR(64) NULL,
        [Title] NVARCHAR(500) NULL,
        [Description] NVARCHAR(2000) NULL,
        [Category] NVARCHAR(500) NULL,
        [Tags] NVARCHAR(1000) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [LastIndexedAt] DATETIME2 NULL,
        [IsActive] BIT NOT NULL DEFAULT 1,
        [ChunkCount] INT NOT NULL DEFAULT 0
    );
    PRINT 'Created table: KnowledgeBaseDocuments';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'KnowledgeBaseChunks')
BEGIN
    CREATE TABLE [KnowledgeBaseChunks] (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [DocumentId] INT NOT NULL,
        [ChunkIndex] INT NOT NULL DEFAULT 0,
        [Content] NVARCHAR(MAX) NOT NULL,
        [ContentLength] INT NOT NULL DEFAULT 0,
        [StartPosition] INT NOT NULL DEFAULT 0,
        [EndPosition] INT NOT NULL DEFAULT 0,
        [EmbeddingJson] NVARCHAR(MAX) NULL,
        [Keywords] NVARCHAR(MAX) NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [FK_KnowledgeBaseChunks_Documents] 
            FOREIGN KEY ([DocumentId]) 
            REFERENCES [KnowledgeBaseDocuments]([Id]) 
            ON DELETE CASCADE
    );
    PRINT 'Created table: KnowledgeBaseChunks';
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'KnowledgeBaseIngestionLogs')
BEGIN
    CREATE TABLE [KnowledgeBaseIngestionLogs] (
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [FileName] NVARCHAR(500) NULL,
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'Pending',
        [ChunksCreated] INT NOT NULL DEFAULT 0,
        [ErrorMessage] NVARCHAR(2000) NULL,
        [StartedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [CompletedAt] DATETIME2 NULL,
        [ProcessingTimeMs] FLOAT NOT NULL DEFAULT 0
    );
    PRINT 'Created table: KnowledgeBaseIngestionLogs';
END
GO

-- Create indexes for better search performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_KnowledgeBaseDocuments_Category')
BEGIN
    CREATE INDEX [IX_KnowledgeBaseDocuments_Category] ON [KnowledgeBaseDocuments]([Category]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_KnowledgeBaseDocuments_IsActive')
BEGIN
    CREATE INDEX [IX_KnowledgeBaseDocuments_IsActive] ON [KnowledgeBaseDocuments]([IsActive]);
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_KnowledgeBaseChunks_DocumentId')
BEGIN
    CREATE INDEX [IX_KnowledgeBaseChunks_DocumentId] ON [KnowledgeBaseChunks]([DocumentId]);
END
GO

PRINT 'Knowledge Base migration completed successfully!';
