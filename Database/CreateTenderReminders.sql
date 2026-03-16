-- Create Tender Reminders table for email notifications
-- Run against ProjectTrackerDB

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TenderReminders')
BEGIN
    CREATE TABLE TenderReminders (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TenderId INT NOT NULL,
        EventType NVARCHAR(50) NOT NULL,          -- ClosingDate, Briefing, SiteVisit, Clarification, Evaluation
        EventDate DATETIME2 NOT NULL,
        DaysBefore INT NOT NULL DEFAULT 3,
        EmailRecipients NVARCHAR(1000) NULL,       -- Comma-separated email addresses
        Notes NVARCHAR(500) NULL,
        IsSent BIT NOT NULL DEFAULT 0,
        SentAt DATETIME2 NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedByUserId INT NOT NULL,
        CreatedByUserName NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_TenderReminders_Tenders FOREIGN KEY (TenderId) REFERENCES Tenders(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_TenderReminders_TenderId ON TenderReminders(TenderId);
    CREATE INDEX IX_TenderReminders_EventDate ON TenderReminders(EventDate);
    CREATE INDEX IX_TenderReminders_IsSent ON TenderReminders(IsSent) WHERE IsSent = 0;

    PRINT 'TenderReminders table created successfully';
END
ELSE
BEGIN
    PRINT 'TenderReminders table already exists';
END
