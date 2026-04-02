-- =====================================================
-- Create TrainingAttachments table for HBA1C training session file uploads
-- =====================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TrainingAttachments')
BEGIN
    CREATE TABLE [dbo].[TrainingAttachments] (
        [Id]                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [TrainingSessionId]   INT NOT NULL,
        [TrainingName]        NVARCHAR(300) NULL,
        [FileName]            NVARCHAR(500) NOT NULL,
        [StoredFileName]      NVARCHAR(500) NOT NULL,
        [ContentType]         NVARCHAR(100) NULL,
        [FileSize]            BIGINT NOT NULL DEFAULT 0,
        [UploadedBy]          NVARCHAR(200) NULL,
        [UploadedAt]          DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE NONCLUSTERED INDEX [IX_TrainingAttachments_TrainingSessionId]
        ON [dbo].[TrainingAttachments] ([TrainingSessionId]);

    PRINT 'Created TrainingAttachments table';
END
ELSE
BEGIN
    PRINT 'TrainingAttachments table already exists';
END
GO
