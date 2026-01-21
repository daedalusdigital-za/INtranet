-- Link ImportedInvoices to LogisticsCustomers
USE ProjectTrackerDb;
GO

-- Update CustomerId in ImportedInvoices
UPDATE i
SET i.CustomerId = c.Id
FROM ImportedInvoices i
INNER JOIN LogisticsCustomers c ON i.CustomerNumber = c.CustomerCode
WHERE i.CustomerId IS NULL OR i.CustomerId = 0 OR i.CustomerId NOT IN (SELECT Id FROM LogisticsCustomers);

-- Display link results
SELECT 
    COUNT(*) AS TotalInvoices,
    SUM(CASE WHEN CustomerId IS NOT NULL AND CustomerId > 0 THEN 1 ELSE 0 END) AS LinkedInvoices,
    SUM(CASE WHEN CustomerId IS NULL OR CustomerId = 0 THEN 1 ELSE 0 END) AS UnlinkedInvoices
FROM ImportedInvoices;

GO

-- Sample linked invoices
SELECT TOP 10
    i.TransactionNumber,
    i.TransactionDate,
    c.CustomerCode,
    c.Name AS CustomerName,
    i.ProductDescription,
    i.SalesAmount,
    i.CostOfSales
FROM ImportedInvoices i
INNER JOIN LogisticsCustomers c ON i.CustomerId = c.Id
ORDER BY i.TransactionDate DESC;

GO

-- Customer sales summary
SELECT 
    c.CustomerCode,
    c.Name,
    COUNT(DISTINCT i.TransactionNumber) AS TotalInvoices,
    COUNT(*) AS TotalLineItems,
    SUM(i.SalesAmount) AS TotalSales,
    SUM(i.CostOfSales) AS TotalCost,
    SUM(i.SalesAmount - i.CostOfSales) AS TotalMargin
FROM LogisticsCustomers c
INNER JOIN ImportedInvoices i ON c.Id = i.CustomerId
GROUP BY c.CustomerCode, c.Name
ORDER BY TotalSales DESC;

GO
