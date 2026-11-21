-- =====================================================
-- Create CreditNoteAttachments table for HBA1C credit note file uploads
-- =====================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CreditNoteAttachments')
BEGIN
    CREATE TABLE [dbo].[CreditNoteAttachments] (
        [Id]                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [CreditNoteId]      INT NOT NULL,
        [CreditNoteNumber]  NVARCHAR(100) NULL,
        [FileName]          NVARCHAR(500) NOT NULL,
        [StoredFileName]    NVARCHAR(500) NOT NULL,
        [ContentType]       NVARCHAR(100) NULL,
        [FileSize]          BIGINT NOT NULL DEFAULT 0,
        [UploadedBy]        NVARCHAR(200) NULL,
        [UploadedAt]        DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE NONCLUSTERED INDEX [IX_CreditNoteAttachments_CreditNoteId]
        ON [dbo].[CreditNoteAttachments] ([CreditNoteId]);

    PRINT 'Created CreditNoteAttachments table';
END
ELSE
BEGIN
    PRINT 'CreditNoteAttachments table already exists';
END
GO
