-- Link ImportedInvoices to Customers table
-- Updates the CustomerId field in ImportedInvoices to reference Customers.Id

USE ProjectTrackerDb;
GO

-- Update CustomerId in ImportedInvoices by matching CustomerNumber
UPDATE i
SET i.CustomerId = c.Id
FROM ImportedInvoices i
INNER JOIN Customers c ON i.CustomerNumber = c.CustomerNumber
WHERE i.CustomerId IS NULL OR i.CustomerId = 0;

-- Display results
SELECT 
    COUNT(*) AS TotalInvoices,
    SUM(CASE WHEN CustomerId IS NOT NULL THEN 1 ELSE 0 END) AS LinkedInvoices,
    SUM(CASE WHEN CustomerId IS NULL THEN 1 ELSE 0 END) AS UnlinkedInvoices
FROM ImportedInvoices;

GO

-- Show sample of linked invoices
SELECT TOP 10
    i.TransactionNumber,
    i.TransactionDate,
    c.CustomerNumber,
    c.CustomerName,
    c.CustomerType,
    i.ProductDescription,
    i.SalesAmount
FROM ImportedInvoices i
INNER JOIN Customers c ON i.CustomerId = c.Id
ORDER BY i.TransactionDate DESC;

GO
