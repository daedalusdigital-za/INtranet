-- ============================================================
-- Create ReportCaches table for caching generated sales reports
-- Run against INtranet database on localhost:1433
-- ============================================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ReportCaches')
BEGIN
    CREATE TABLE [dbo].[ReportCaches] (
        [Id]                INT             IDENTITY(1,1)   NOT NULL,
        [CacheKey]          NVARCHAR(64)                    NOT NULL,   -- SHA256 hash of reportType|fromDate|toDate|params
        [ReportType]        NVARCHAR(50)                    NOT NULL,   -- sales-summary, customer-analysis, province-breakdown, product-performance
        [FromDate]          DATETIME2                       NOT NULL,
        [ToDate]            DATETIME2                       NOT NULL,
        [Parameters]        NVARCHAR(500)                   NULL,       -- Extra parameters beyond date range
        [ResultJson]        NVARCHAR(MAX)                   NOT NULL,   -- Full serialized report result
        [GeneratedAt]       DATETIME2                       NOT NULL,
        [ExpiresAt]         DATETIME2                       NOT NULL,
        [GenerationTimeMs]  INT                             NOT NULL,   -- How long the original report took to generate (ms)
        [HitCount]          INT                             NOT NULL    DEFAULT 0,
        [LastAccessedAt]    DATETIME2                       NULL,
        [ResultSizeBytes]   BIGINT                          NOT NULL    DEFAULT 0,
        [GeneratedBy]       NVARCHAR(100)                   NULL,       -- Username who triggered original generation
        CONSTRAINT [PK_ReportCaches] PRIMARY KEY CLUSTERED ([Id])
    );

    -- Unique index on CacheKey for fast lookups
    CREATE UNIQUE NONCLUSTERED INDEX [IX_ReportCaches_CacheKey]
        ON [dbo].[ReportCaches] ([CacheKey]);

    -- Index on ExpiresAt for cleanup of expired entries
    CREATE NONCLUSTERED INDEX [IX_ReportCaches_ExpiresAt]
        ON [dbo].[ReportCaches] ([ExpiresAt]);

    -- Composite index for browsing by report type and date range
    CREATE NONCLUSTERED INDEX [IX_ReportCaches_ReportType_FromDate_ToDate]
        ON [dbo].[ReportCaches] ([ReportType], [FromDate], [ToDate]);

    PRINT 'ReportCaches table created successfully with 3 indexes.';
END
ELSE
BEGIN
    PRINT 'ReportCaches table already exists — skipping.';
END
GO
