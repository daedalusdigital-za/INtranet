-- Create DocumentShares table for the Documents "Share" feature.
-- A share is a virtual grant: the file/folder is NOT copied. This table records
-- who shared what (SourceDepartment + SourcePath) with whom (a Department or a User).
-- Idempotent: safe to run multiple times.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DocumentShares')
BEGIN
    CREATE TABLE DocumentShares (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SourceDepartment NVARCHAR(100) NOT NULL,
        SourcePath NVARCHAR(1000) NOT NULL,      -- relative path within the source department
        ItemName NVARCHAR(500) NOT NULL,
        IsFolder BIT NOT NULL DEFAULT 0,
        SharedByUserId INT NOT NULL,
        SharedByName NVARCHAR(200) NULL,
        ShareWithType NVARCHAR(20) NOT NULL,     -- 'Department' or 'User'
        ShareWithDepartment NVARCHAR(100) NULL,  -- set when ShareWithType = 'Department'
        ShareWithUserId INT NULL,                -- set when ShareWithType = 'User'
        Note NVARCHAR(1000) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_DocumentShares_SharedByUser FOREIGN KEY (SharedByUserId) REFERENCES Users(UserId),
        CONSTRAINT FK_DocumentShares_ShareWithUser FOREIGN KEY (ShareWithUserId) REFERENCES Users(UserId)
    );

    CREATE INDEX IX_DocumentShares_ShareWithUserId ON DocumentShares(ShareWithUserId);
    CREATE INDEX IX_DocumentShares_ShareWithDepartment ON DocumentShares(ShareWithDepartment);
    CREATE INDEX IX_DocumentShares_SharedByUserId ON DocumentShares(SharedByUserId);
    CREATE INDEX IX_DocumentShares_SourceDept ON DocumentShares(SourceDepartment);

    PRINT 'DocumentShares table created successfully';
END
ELSE
BEGIN
    PRINT 'DocumentShares table already exists';
END
