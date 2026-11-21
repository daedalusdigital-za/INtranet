-- =====================================================
-- Create CarTrackEntries table for HBA1C Sales Rep Car Tracking
-- =====================================================

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CarTrackEntries')
BEGIN
    CREATE TABLE [dbo].[CarTrackEntries] (
        [Id]                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [SalesRepName]        NVARCHAR(150) NOT NULL,
        [RegistrationNumber]  NVARCHAR(20) NULL,
        [Location]            NVARCHAR(250) NOT NULL,
        [Province]            NVARCHAR(100) NULL,
        [Purpose]             NVARCHAR(500) NULL,
        [ClientVisited]       NVARCHAR(200) NULL,
        [VisitDate]           DATETIME2 NOT NULL,
        [TimeArrived]         TIME NULL,
        [TimeDeparted]        TIME NULL,
        [KilometerStart]      FLOAT NULL,
        [KilometerEnd]        FLOAT NULL,
        [Notes]               NVARCHAR(1000) NULL,
        [Status]              NVARCHAR(50) NOT NULL DEFAULT 'Completed',
        [CreatedAt]           DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt]           DATETIME2 NULL,
        [CreatedByUserId]     INT NULL
    );

    -- Indexes for common queries
    CREATE NONCLUSTERED INDEX [IX_CarTrackEntries_SalesRepName] ON [dbo].[CarTrackEntries] ([SalesRepName]);
    CREATE NONCLUSTERED INDEX [IX_CarTrackEntries_VisitDate] ON [dbo].[CarTrackEntries] ([VisitDate] DESC);
    CREATE NONCLUSTERED INDEX [IX_CarTrackEntries_Province] ON [dbo].[CarTrackEntries] ([Province]);
    CREATE NONCLUSTERED INDEX [IX_CarTrackEntries_Status] ON [dbo].[CarTrackEntries] ([Status]);

    PRINT 'CarTrackEntries table created successfully.';
END
ELSE
BEGIN
    PRINT 'CarTrackEntries table already exists.';
END
GO
