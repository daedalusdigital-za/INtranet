-- Add MarketValue column to AssetRegisterItems for comparison against book Value
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = N'MarketValue'
      AND Object_ID = Object_ID(N'dbo.AssetRegisterItems')
)
BEGIN
    ALTER TABLE dbo.AssetRegisterItems
        ADD MarketValue DECIMAL(12,2) NULL;
    PRINT 'Added MarketValue column to AssetRegisterItems';
END
ELSE
BEGIN
    PRINT 'MarketValue column already exists on AssetRegisterItems';
END
