-- Create CollaborativeDocuments table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CollaborativeDocuments')
BEGIN
    CREATE TABLE CollaborativeDocuments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Title NVARCHAR(255) NOT NULL,
        Description NVARCHAR(500) NULL,
        CreatedById INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        LastModifiedById INT NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,
        IsPublic BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_CollaborativeDocuments_Users_CreatedById FOREIGN KEY (CreatedById) REFERENCES Users(UserId)
    );
    CREATE INDEX IX_CollaborativeDocuments_CreatedById ON CollaborativeDocuments(CreatedById);
END
GO

-- Create DocumentSnapshots table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DocumentSnapshots')
BEGIN
    CREATE TABLE DocumentSnapshots (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DocumentId INT NOT NULL,
        YjsState NVARCHAR(MAX) NOT NULL,
        Version INT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CreatedById INT NULL,
        CONSTRAINT FK_DocumentSnapshots_CollaborativeDocuments_DocumentId FOREIGN KEY (DocumentId) REFERENCES CollaborativeDocuments(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_DocumentSnapshots_DocumentId ON DocumentSnapshots(DocumentId);
END
GO

-- Create DocumentCollaborators table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DocumentCollaborators')
BEGIN
    CREATE TABLE DocumentCollaborators (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        DocumentId INT NOT NULL,
        UserId INT NOT NULL,
        Role NVARCHAR(20) NOT NULL DEFAULT 'editor',
        AddedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_DocumentCollaborators_CollaborativeDocuments_DocumentId FOREIGN KEY (DocumentId) REFERENCES CollaborativeDocuments(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_DocumentCollaborators_DocumentId ON DocumentCollaborators(DocumentId);
    CREATE INDEX IX_DocumentCollaborators_UserId ON DocumentCollaborators(UserId);
END
GO

PRINT 'CollaborativeDocuments tables created successfully';
