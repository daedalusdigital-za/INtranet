-- Final Customer Import Verification Report
USE ProjectTrackerDb;
GO

PRINT '=== CUSTOMER IMPORT VERIFICATION ===';
PRINT '';

-- 1. Total counts by source
PRINT '1. Customer Counts by Source:';
SELECT 
    CASE 
        WHEN ImportBatchId LIKE 'JSON_IMPORT%' THEN 'JSON Master Data'
        WHEN ImportBatchId LIKE 'INVOICE_IMPORT%' THEN 'Invoice Extract'
        ELSE 'Manual/Other'
    END AS Source,
    COUNT(*) AS CustomerCount
FROM LogisticsCustomers
GROUP BY 
    CASE 
        WHEN ImportBatchId LIKE 'JSON_IMPORT%' THEN 'JSON Master Data'
        WHEN ImportBatchId LIKE 'INVOICE_IMPORT%' THEN 'Invoice Extract'
        ELSE 'Manual/Other'
    END
ORDER BY CustomerCount DESC;
GO

-- 2. Customers with complete contact info
PRINT '';
PRINT '2. Customers with Email & Phone:';
SELECT 
    COUNT(*) AS CustomersWithContacts
FROM LogisticsCustomers
WHERE Email IS NOT NULL OR PhoneNumber IS NOT NULL;
GO

-- 3. Sample of key customers
PRINT '';
PRINT '3. Sample Key Customers:';
SELECT TOP 10
    CustomerCode,
    Name,
    ISNULL(Email, ContactEmail) AS Email,
    PhoneNumber,
    City
FROM LogisticsCustomers
WHERE CustomerCode IN ('001SHA', 'ACC001', '888BSO', 'AAD001', 'ABE001')
    OR Email IS NOT NULL
ORDER BY Name;
GO

-- 4. Invoice linkage status
PRINT '';
PRINT '4. Invoice-Customer Linkage:';
SELECT 
    COUNT(DISTINCT i.TransactionNumber) AS TotalInvoices,
    COUNT(DISTINCT i.CustomerId) AS UniqueCustomersWithInvoices,
    (SELECT COUNT(*) FROM LogisticsCustomers) AS TotalCustomers
FROM ImportedInvoices i;
GO

-- 5. Top customers by invoice activity
PRINT '';
PRINT '5. Top 10 Customers by Invoice Activity:';
SELECT TOP 10
    c.CustomerCode,
    c.Name,
    COUNT(DISTINCT i.TransactionNumber) AS InvoiceCount,
    COUNT(*) AS LineItems,
    FORMAT(SUM(i.SalesAmount), 'C', 'en-ZA') AS TotalSales
FROM LogisticsCustomers c
INNER JOIN ImportedInvoices i ON c.Id = i.CustomerId
GROUP BY c.CustomerCode, c.Name
ORDER BY SUM(i.SalesAmount) DESC;
GO

PRINT '';
PRINT '=== IMPORT COMPLETE ===';
GO
