-- ============================================================================
-- Add Missing Performance Indexes
-- Created: August 2026
-- Purpose: Add indexes to tables identified in code audit as missing them
-- ============================================================================

USE ProjectTrackerDB;
GO

PRINT 'Adding missing performance indexes...';

-- ============================================================================
-- PadsStockReceived - No indexes at all
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockReceived_Quarter' AND object_id = OBJECT_ID('PadsStockReceived'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsStockReceived_Quarter 
    ON PadsStockReceived(Quarter);
    PRINT 'Created IX_PadsStockReceived_Quarter';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockReceived_InvoiceDate' AND object_id = OBJECT_ID('PadsStockReceived'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsStockReceived_InvoiceDate 
    ON PadsStockReceived(InvoiceDate);
    PRINT 'Created IX_PadsStockReceived_InvoiceDate';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockReceived_Supplier' AND object_id = OBJECT_ID('PadsStockReceived'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsStockReceived_Supplier 
    ON PadsStockReceived(Supplier);
    PRINT 'Created IX_PadsStockReceived_Supplier';
END

-- ============================================================================
-- PadsStockDelivered - No indexes
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockDelivered_Quarter' AND object_id = OBJECT_ID('PadsStockDelivered'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsStockDelivered_Quarter 
    ON PadsStockDelivered(Quarter);
    PRINT 'Created IX_PadsStockDelivered_Quarter';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockDelivered_DeliveryDate' AND object_id = OBJECT_ID('PadsStockDelivered'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsStockDelivered_DeliveryDate 
    ON PadsStockDelivered(DeliveryDate);
    PRINT 'Created IX_PadsStockDelivered_DeliveryDate';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockDelivered_District' AND object_id = OBJECT_ID('PadsStockDelivered'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsStockDelivered_District 
    ON PadsStockDelivered(District);
    PRINT 'Created IX_PadsStockDelivered_District';
END

-- ============================================================================
-- PadsCreditNotes - No indexes
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsCreditNotes_Quarter' AND object_id = OBJECT_ID('PadsCreditNotes'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsCreditNotes_Quarter 
    ON PadsCreditNotes(Quarter);
    PRINT 'Created IX_PadsCreditNotes_Quarter';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsCreditNotes_CreditNoteDate' AND object_id = OBJECT_ID('PadsCreditNotes'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsCreditNotes_CreditNoteDate 
    ON PadsCreditNotes(CreditNoteDate);
    PRINT 'Created IX_PadsCreditNotes_CreditNoteDate';
END

-- ============================================================================
-- PadsInvoicesProcessed - No indexes
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsInvoicesProcessed_Quarter' AND object_id = OBJECT_ID('PadsInvoicesProcessed'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsInvoicesProcessed_Quarter 
    ON PadsInvoicesProcessed(Quarter);
    PRINT 'Created IX_PadsInvoicesProcessed_Quarter';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsInvoicesProcessed_InvoiceDate' AND object_id = OBJECT_ID('PadsInvoicesProcessed'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_PadsInvoicesProcessed_InvoiceDate 
    ON PadsInvoicesProcessed(InvoiceDate);
    PRINT 'Created IX_PadsInvoicesProcessed_InvoiceDate';
END

-- ============================================================================
-- Messages - Missing index on SentAt for timeline queries
-- Note: Check actual column names in your Messages table before running
-- ============================================================================
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Messages')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Messages_SentAt' AND object_id = OBJECT_ID('Messages'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Messages') AND name = 'SentAt')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Messages_SentAt 
        ON Messages(SentAt DESC);
        PRINT 'Created IX_Messages_SentAt';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Messages_Conversation' AND object_id = OBJECT_ID('Messages'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Messages') AND name = 'SenderId')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Messages_Conversation 
        ON Messages(SenderId, ReceiverId, SentAt DESC);
        PRINT 'Created IX_Messages_Conversation';
    END
END

-- ============================================================================
-- CondomProductionSchedules - Missing composite for common queries
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CondomProductionSchedules_ScentType_Date' AND object_id = OBJECT_ID('CondomProductionSchedules'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_CondomProductionSchedules_ScentType_Date 
    ON CondomProductionSchedules(Scent, Type, ScheduleDate);
    PRINT 'Created IX_CondomProductionSchedules_ScentType_Date';
END

-- ============================================================================
-- Additional recommended indexes from query patterns
-- ============================================================================

-- TripSheets - Frequently filtered by date and status
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TripSheets_TripDate_Status' AND object_id = OBJECT_ID('TripSheets'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_TripSheets_TripDate_Status 
    ON TripSheets(TripDate, Status)
    INCLUDE (VehicleId, DriverId);
    PRINT 'Created IX_TripSheets_TripDate_Status';
END

-- Invoices - Common lookup by customer and date
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_CustomerId_InvoiceDate' AND object_id = OBJECT_ID('Invoices'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Invoices_CustomerId_InvoiceDate 
    ON Invoices(CustomerId, InvoiceDate DESC);
    PRINT 'Created IX_Invoices_CustomerId_InvoiceDate';
END

-- AttendanceRecords - Lookup by employee and date
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AttendanceRecords_EmployeeId_Date' AND object_id = OBJECT_ID('AttendanceRecords'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_AttendanceRecords_EmployeeId_Date 
    ON AttendanceRecords(EmployeeId, Date DESC);
    PRINT 'Created IX_AttendanceRecords_EmployeeId_Date';
END

-- AuditLogs - Common queries by entity and timestamp
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_EntityType_Timestamp' AND object_id = OBJECT_ID('AuditLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLogs_EntityType_Timestamp 
    ON AuditLogs(EntityType, Timestamp DESC);
    PRINT 'Created IX_AuditLogs_EntityType_Timestamp';
END

PRINT 'Index creation complete.';
GO
