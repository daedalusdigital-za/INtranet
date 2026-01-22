-- Stock on Hand Snapshot Table Migration
-- This table stores point-in-time inventory snapshots from Excel imports

-- Create the table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[StockOnHandSnapshots]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[StockOnHandSnapshots] (
        [StockSnapshotId] INT IDENTITY(1,1) NOT NULL,
        [AsAtDate] DATE NOT NULL,
        [ItemCode] NVARCHAR(50) NOT NULL,
        [ItemDescription] NVARCHAR(500) NULL,
        [Location] NVARCHAR(50) NOT NULL,
        [Uom] NVARCHAR(20) NOT NULL,
        [QtyOnHand] DECIMAL(18,2) NULL,
        [QtyOnPO] DECIMAL(18,2) NULL,
        [QtyOnSO] DECIMAL(18,2) NULL,
        [StockAvailable] DECIMAL(18,2) NULL,
        [TotalCostForQOH] DECIMAL(18,2) NULL,
        [UnitCostForQOH] DECIMAL(18,6) NULL,
        [ImportBatchId] NVARCHAR(50) NULL,
        [RowIndex] INT NULL,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        
        CONSTRAINT [PK_StockOnHandSnapshots] PRIMARY KEY CLUSTERED ([StockSnapshotId] ASC)
    );
    
    PRINT 'Created StockOnHandSnapshots table';
END
ELSE
BEGIN
    PRINT 'StockOnHandSnapshots table already exists';
END
GO

-- Create unique index for duplicate prevention
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StockOnHandSnapshot_Unique' AND object_id = OBJECT_ID('StockOnHandSnapshots'))
BEGIN
    CREATE UNIQUE INDEX [IX_StockOnHandSnapshot_Unique] 
    ON [dbo].[StockOnHandSnapshots] ([AsAtDate], [Location], [ItemCode], [Uom]);
    
    PRINT 'Created IX_StockOnHandSnapshot_Unique index';
END
GO

-- Create query performance index
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StockOnHandSnapshot_AsAtDate_Location_ItemCode' AND object_id = OBJECT_ID('StockOnHandSnapshots'))
BEGIN
    CREATE INDEX [IX_StockOnHandSnapshot_AsAtDate_Location_ItemCode] 
    ON [dbo].[StockOnHandSnapshots] ([AsAtDate], [Location], [ItemCode])
    INCLUDE ([ItemDescription], [Uom], [QtyOnHand], [StockAvailable], [TotalCostForQOH]);
    
    PRINT 'Created IX_StockOnHandSnapshot_AsAtDate_Location_ItemCode index';
END
GO

-- Verify table structure
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'StockOnHandSnapshots'
ORDER BY ORDINAL_POSITION;
GO
