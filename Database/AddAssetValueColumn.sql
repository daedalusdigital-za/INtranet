-- ============================================================================
-- Add Value (monetary) column to AssetRegisterItems
-- Created: August 2026
-- Purpose: Adds a decimal Value column so assets can carry a monetary value.
--          Replaces the "Condition" wording in the UI with "Value".
--          The existing Condition column is retained for historical data.
-- ============================================================================

USE ProjectTrackerDB;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('AssetRegisterItems') AND name = 'Value')
BEGIN
    ALTER TABLE AssetRegisterItems ADD [Value] DECIMAL(12,2) NULL;
    PRINT 'Added Value column to AssetRegisterItems';
END
ELSE
BEGIN
    PRINT 'Value column already exists on AssetRegisterItems';
END
GO
