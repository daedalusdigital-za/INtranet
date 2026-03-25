-- ============================================================================
-- Performance indexes for ImportedInvoices table
-- Speeds up the hot pending-invoices queries used by tripsheet suggestions
-- ============================================================================

-- Composite index for the most common query: WHERE Status = 'Pending' AND LoadId IS NULL
-- Used by: welly-suggest-tripsheets, suggested-loads, LoadOptimizationService
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ImportedInvoices_Status_LoadId' AND object_id = OBJECT_ID('ImportedInvoices'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ImportedInvoices_Status_LoadId
    ON ImportedInvoices (Status, LoadId)
    INCLUDE (CustomerNumber, CustomerName, DeliveryProvince, DeliveryCity, SourceCompany, TransactionDate, SalesAmount, SalesReturns, ImportedAt);
    PRINT 'Created IX_ImportedInvoices_Status_LoadId';
END
ELSE PRINT 'IX_ImportedInvoices_Status_LoadId already exists';

-- Index for province-based grouping
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ImportedInvoices_DeliveryProvince' AND object_id = OBJECT_ID('ImportedInvoices'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ImportedInvoices_DeliveryProvince
    ON ImportedInvoices (DeliveryProvince, DeliveryCity)
    INCLUDE (Status, LoadId, CustomerNumber, CustomerName);
    PRINT 'Created IX_ImportedInvoices_DeliveryProvince';
END
ELSE PRINT 'IX_ImportedInvoices_DeliveryProvince already exists';

-- Index for batch queries
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ImportedInvoices_ImportBatchId' AND object_id = OBJECT_ID('ImportedInvoices'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ImportedInvoices_ImportBatchId
    ON ImportedInvoices (ImportBatchId)
    INCLUDE (Status, CustomerName, TransactionNumber);
    PRINT 'Created IX_ImportedInvoices_ImportBatchId';
END
ELSE PRINT 'IX_ImportedInvoices_ImportBatchId already exists';

-- Index for transaction number duplicate checks during import
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ImportedInvoices_TransactionNumber' AND object_id = OBJECT_ID('ImportedInvoices'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_ImportedInvoices_TransactionNumber
    ON ImportedInvoices (TransactionNumber);
    PRINT 'Created IX_ImportedInvoices_TransactionNumber';
END
ELSE PRINT 'IX_ImportedInvoices_TransactionNumber already exists';

PRINT 'All performance indexes created successfully.';
