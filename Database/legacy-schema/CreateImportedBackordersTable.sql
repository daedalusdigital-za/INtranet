-- Backorder importer (Admin > Data Import > Backorders)
-- Snapshot-style per company: each import replaces that company's rows.
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ImportedBackorders')
BEGIN
    CREATE TABLE ImportedBackorders (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SourceCompany NVARCHAR(10) NOT NULL,
        OrderNumber NVARCHAR(50) NOT NULL DEFAULT '',
        OrderDate DATETIME2 NULL,
        CustomerNo NVARCHAR(50) NOT NULL DEFAULT '',
        CustomerName NVARCHAR(255) NOT NULL DEFAULT '',
        PoNo NVARCHAR(100) NOT NULL DEFAULT '',
        ItemDesc NVARCHAR(255) NOT NULL DEFAULT '',
        Location NVARCHAR(50) NOT NULL DEFAULT '',
        Uom NVARCHAR(20) NOT NULL DEFAULT '',
        QtyBackOrder DECIMAL(18,2) NOT NULL DEFAULT 0,
        UnitPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
        ExtPrice DECIMAL(18,2) NOT NULL DEFAULT 0,
        Contract NVARCHAR(100) NOT NULL DEFAULT '',
        AccountSet NVARCHAR(50) NOT NULL DEFAULT '',
        ImportBatchId NVARCHAR(50) NULL,
        ImportedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ImportedBy NVARCHAR(100) NULL
    );
    CREATE NONCLUSTERED INDEX IX_ImportedBackorders_SourceCompany ON ImportedBackorders(SourceCompany);
    CREATE NONCLUSTERED INDEX IX_ImportedBackorders_OrderNumber ON ImportedBackorders(OrderNumber);
    PRINT 'Created table ImportedBackorders';
END
ELSE
    PRINT 'ImportedBackorders already exists';
