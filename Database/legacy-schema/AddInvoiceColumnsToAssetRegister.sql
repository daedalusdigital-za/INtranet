-- Add invoice linkage columns to AssetRegisterItems (links assets to Books BookInvoices)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'InvoiceNumber' AND Object_ID = Object_ID(N'AssetRegisterItems'))
BEGIN
    ALTER TABLE AssetRegisterItems ADD InvoiceNumber NVARCHAR(100) NULL;
    PRINT 'Added InvoiceNumber column';
END
ELSE
    PRINT 'InvoiceNumber column already exists';
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'BookInvoiceId' AND Object_ID = Object_ID(N'AssetRegisterItems'))
BEGIN
    ALTER TABLE AssetRegisterItems ADD BookInvoiceId INT NULL;
    PRINT 'Added BookInvoiceId column';
END
ELSE
    PRINT 'BookInvoiceId column already exists';
GO

-- Optional: seed InvoiceNumber from Manufacturer if it looks like an invoice reference (left blank by default)
-- Best-effort: attempt to auto-link assets whose InvoiceNumber matches an existing BookInvoice
UPDATE a
SET a.BookInvoiceId = b.Id
FROM AssetRegisterItems a
INNER JOIN BookInvoices b ON LOWER(LTRIM(RTRIM(a.InvoiceNumber))) = LOWER(LTRIM(RTRIM(b.InvoiceNumber)))
WHERE a.InvoiceNumber IS NOT NULL AND a.InvoiceNumber <> '' AND a.BookInvoiceId IS NULL;
GO

PRINT 'AssetRegisterItems invoice linkage migration complete';
GO
