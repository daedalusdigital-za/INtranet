-- Create Messaging Tables for ProjectTracker
-- Run this script to create the messaging feature tables

-- Create Conversations table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Conversations')
BEGIN
    CREATE TABLE Conversations (
        ConversationId INT IDENTITY(1,1) PRIMARY KEY,
        Subject NVARCHAR(200) NULL,
        IsGroupChat BIT NOT NULL DEFAULT 0,
        GroupName NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        LastMessageAt DATETIME2 NULL
    );
    PRINT 'Created Conversations table';
END

-- Create ConversationParticipants table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ConversationParticipants')
BEGIN
    CREATE TABLE ConversationParticipants (
        ParticipantId INT IDENTITY(1,1) PRIMARY KEY,
        ConversationId INT NOT NULL,
        UserId INT NOT NULL,
        JoinedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        LastReadAt DATETIME2 NULL,
        IsAdmin BIT NOT NULL DEFAULT 0,
        IsMuted BIT NOT NULL DEFAULT 0,
        HasLeft BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_ConversationParticipants_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(ConversationId) ON DELETE CASCADE,
        CONSTRAINT FK_ConversationParticipants_User FOREIGN KEY (UserId) REFERENCES Users(UserId)
    );
    PRINT 'Created ConversationParticipants table';
END

-- Create Messages table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Messages')
BEGIN
    CREATE TABLE Messages (
        MessageId INT IDENTITY(1,1) PRIMARY KEY,
        ConversationId INT NOT NULL,
        SenderId INT NOT NULL,
        Content NVARCHAR(MAX) NOT NULL,
        MessageType NVARCHAR(20) NOT NULL DEFAULT 'text',
        IsEdited BIT NOT NULL DEFAULT 0,
        EditedAt DATETIME2 NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,
        ReplyToMessageId INT NULL,
        SentAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Messages_Conversation FOREIGN KEY (ConversationId) REFERENCES Conversations(ConversationId) ON DELETE CASCADE,
        CONSTRAINT FK_Messages_Sender FOREIGN KEY (SenderId) REFERENCES Users(UserId),
        CONSTRAINT FK_Messages_ReplyTo FOREIGN KEY (ReplyToMessageId) REFERENCES Messages(MessageId)
    );
    PRINT 'Created Messages table';
END

-- Create MessageAttachments table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MessageAttachments')
BEGIN
    CREATE TABLE MessageAttachments (
        AttachmentId INT IDENTITY(1,1) PRIMARY KEY,
        MessageId INT NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        MimeType NVARCHAR(100) NOT NULL,
        FileSize BIGINT NOT NULL,
        FileUrl NVARCHAR(500) NULL,
        FileData VARBINARY(MAX) NULL,
        ThumbnailUrl NVARCHAR(500) NULL,
        UploadedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_MessageAttachments_Message FOREIGN KEY (MessageId) REFERENCES Messages(MessageId) ON DELETE CASCADE
    );
    PRINT 'Created MessageAttachments table';
END

-- Create MessageReadReceipts table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MessageReadReceipts')
BEGIN
    CREATE TABLE MessageReadReceipts (
        ReceiptId INT IDENTITY(1,1) PRIMARY KEY,
        MessageId INT NOT NULL,
        UserId INT NOT NULL,
        ReadAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_MessageReadReceipts_Message FOREIGN KEY (MessageId) REFERENCES Messages(MessageId) ON DELETE CASCADE,
        CONSTRAINT FK_MessageReadReceipts_User FOREIGN KEY (UserId) REFERENCES Users(UserId)
    );
    PRINT 'Created MessageReadReceipts table';
END

-- Create indexes for better query performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConversationParticipants_ConversationId')
    CREATE INDEX IX_ConversationParticipants_ConversationId ON ConversationParticipants(ConversationId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ConversationParticipants_UserId')
    CREATE INDEX IX_ConversationParticipants_UserId ON ConversationParticipants(UserId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_ConversationId')
    CREATE INDEX IX_Messages_ConversationId ON Messages(ConversationId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_SenderId')
    CREATE INDEX IX_Messages_SenderId ON Messages(SenderId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Messages_SentAt')
    CREATE INDEX IX_Messages_SentAt ON Messages(SentAt);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MessageReadReceipts_MessageId')
    CREATE INDEX IX_MessageReadReceipts_MessageId ON MessageReadReceipts(MessageId);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MessageReadReceipts_UserId')
    CREATE INDEX IX_MessageReadReceipts_UserId ON MessageReadReceipts(UserId);

PRINT 'All messaging tables and indexes created successfully';
