-- ============================================================================
-- Add Missing Performance Indexes (Safe Version)
-- Created: August 2026
-- Purpose: Add indexes to tables identified in code audit as missing them
-- Note: This script checks if columns exist before creating indexes
-- ============================================================================

USE ProjectTrackerDB;
GO

PRINT 'Adding missing performance indexes (safe version)...';

-- Helper: Only create index if table and column exist
-- ============================================================================

-- PadsStockReceived
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PadsStockReceived')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockReceived_Quarter' AND object_id = OBJECT_ID('PadsStockReceived'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PadsStockReceived') AND name = 'Quarter')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_PadsStockReceived_Quarter ON PadsStockReceived(Quarter);
        PRINT 'Created IX_PadsStockReceived_Quarter';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockReceived_InvoiceDate' AND object_id = OBJECT_ID('PadsStockReceived'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PadsStockReceived') AND name = 'InvoiceDate')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_PadsStockReceived_InvoiceDate ON PadsStockReceived(InvoiceDate);
        PRINT 'Created IX_PadsStockReceived_InvoiceDate';
    END
END

-- PadsStockDelivered
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PadsStockDelivered')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockDelivered_Quarter' AND object_id = OBJECT_ID('PadsStockDelivered'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PadsStockDelivered') AND name = 'Quarter')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_PadsStockDelivered_Quarter ON PadsStockDelivered(Quarter);
        PRINT 'Created IX_PadsStockDelivered_Quarter';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockDelivered_DeliveryDate' AND object_id = OBJECT_ID('PadsStockDelivered'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PadsStockDelivered') AND name = 'DeliveryDate')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_PadsStockDelivered_DeliveryDate ON PadsStockDelivered(DeliveryDate);
        PRINT 'Created IX_PadsStockDelivered_DeliveryDate';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsStockDelivered_District' AND object_id = OBJECT_ID('PadsStockDelivered'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PadsStockDelivered') AND name = 'District')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_PadsStockDelivered_District ON PadsStockDelivered(District);
        PRINT 'Created IX_PadsStockDelivered_District';
    END
END

-- PadsCreditNotes
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PadsCreditNotes')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsCreditNotes_Quarter' AND object_id = OBJECT_ID('PadsCreditNotes'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PadsCreditNotes') AND name = 'Quarter')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_PadsCreditNotes_Quarter ON PadsCreditNotes(Quarter);
        PRINT 'Created IX_PadsCreditNotes_Quarter';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsCreditNotes_CreditNoteDate' AND object_id = OBJECT_ID('PadsCreditNotes'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PadsCreditNotes') AND name = 'CreditNoteDate')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_PadsCreditNotes_CreditNoteDate ON PadsCreditNotes(CreditNoteDate);
        PRINT 'Created IX_PadsCreditNotes_CreditNoteDate';
    END
END

-- PadsInvoicesProcessed
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PadsInvoicesProcessed')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsInvoicesProcessed_Quarter' AND object_id = OBJECT_ID('PadsInvoicesProcessed'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PadsInvoicesProcessed') AND name = 'Quarter')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_PadsInvoicesProcessed_Quarter ON PadsInvoicesProcessed(Quarter);
        PRINT 'Created IX_PadsInvoicesProcessed_Quarter';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PadsInvoicesProcessed_InvoiceDate' AND object_id = OBJECT_ID('PadsInvoicesProcessed'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('PadsInvoicesProcessed') AND name = 'InvoiceDate')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_PadsInvoicesProcessed_InvoiceDate ON PadsInvoicesProcessed(InvoiceDate);
        PRINT 'Created IX_PadsInvoicesProcessed_InvoiceDate';
    END
END

-- Messages
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Messages')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Messages_SentAt' AND object_id = OBJECT_ID('Messages'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Messages') AND name = 'SentAt')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Messages_SentAt ON Messages(SentAt DESC);
        PRINT 'Created IX_Messages_SentAt';
    END

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Messages_Conversation' AND object_id = OBJECT_ID('Messages'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Messages') AND name = 'SenderId')
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Messages') AND name = 'ReceiverId')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Messages_Conversation ON Messages(SenderId, ReceiverId, SentAt DESC);
        PRINT 'Created IX_Messages_Conversation';
    END
END

-- CondomProductionSchedules
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CondomProductionSchedules')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_CondomProductionSchedules_ScentType_Date' AND object_id = OBJECT_ID('CondomProductionSchedules'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CondomProductionSchedules') AND name = 'Scent')
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('CondomProductionSchedules') AND name = 'Type')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_CondomProductionSchedules_ScentType_Date ON CondomProductionSchedules(Scent, Type, ScheduleDate);
        PRINT 'Created IX_CondomProductionSchedules_ScentType_Date';
    END
END

-- TripSheets
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'TripSheets')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TripSheets_TripDate_Status' AND object_id = OBJECT_ID('TripSheets'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TripSheets') AND name = 'TripDate')
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('TripSheets') AND name = 'Status')
    BEGIN
        EXEC('CREATE NONCLUSTERED INDEX IX_TripSheets_TripDate_Status ON TripSheets(TripDate, Status) INCLUDE (VehicleId, DriverId)');
        PRINT 'Created IX_TripSheets_TripDate_Status';
    END
END

-- Invoices
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Invoices')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoices_CustomerId_InvoiceDate' AND object_id = OBJECT_ID('Invoices'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Invoices') AND name = 'CustomerId')
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Invoices') AND name = 'InvoiceDate')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Invoices_CustomerId_InvoiceDate ON Invoices(CustomerId, InvoiceDate DESC);
        PRINT 'Created IX_Invoices_CustomerId_InvoiceDate';
    END
END

-- AttendanceRecords
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AttendanceRecords')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AttendanceRecords_EmployeeId_Date' AND object_id = OBJECT_ID('AttendanceRecords'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AttendanceRecords') AND name = 'EmployeeId')
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AttendanceRecords') AND name = 'Date')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_AttendanceRecords_EmployeeId_Date ON AttendanceRecords(EmployeeId, Date DESC);
        PRINT 'Created IX_AttendanceRecords_EmployeeId_Date';
    END
END

-- AuditLogs
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditLogs')
BEGIN
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_EntityType_Timestamp' AND object_id = OBJECT_ID('AuditLogs'))
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'EntityType')
       AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AuditLogs') AND name = 'Timestamp')
    BEGIN
        CREATE NONCLUSTERED INDEX IX_AuditLogs_EntityType_Timestamp ON AuditLogs(EntityType, Timestamp DESC);
        PRINT 'Created IX_AuditLogs_EntityType_Timestamp';
    END
END

PRINT 'Index creation complete (safe version).';
GO
