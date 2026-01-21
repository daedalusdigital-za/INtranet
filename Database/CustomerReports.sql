-- Customer-Invoice Linkage Verification and Reporting
USE ProjectTrackerDb;
GO

-- 1. Linkage Summary
PRINT '=== LINKAGE SUMMARY ===';
SELECT 
    COUNT(*) AS TotalInvoiceLines,
    COUNT(DISTINCT TransactionNumber) AS UniqueInvoices,
    SUM(CASE WHEN CustomerId > 0 THEN 1 ELSE 0 END) AS LinkedLines,
    SUM(CASE WHEN CustomerId IS NULL OR CustomerId = 0 THEN 1 ELSE 0 END) AS UnlinkedLines
FROM ImportedInvoices;
GO

-- 2. Top 10 Customers by Sales
PRINT '';
PRINT '=== TOP 10 CUSTOMERS BY SALES ===';
SELECT TOP 10
    c.CustomerCode,
    c.Name,
    COUNT(DISTINCT i.TransactionNumber) AS Invoices,
    COUNT(*) AS LineItems,
    FORMAT(SUM(i.SalesAmount), 'C', 'en-ZA') AS TotalSales,
    FORMAT(SUM(i.CostOfSales), 'C', 'en-ZA') AS TotalCost,
    FORMAT(SUM(i.SalesAmount - i.CostOfSales), 'C', 'en-ZA') AS Margin,
    CONCAT(CAST(ROUND(AVG(i.MarginPercent), 2) AS DECIMAL(5,2)), '%') AS AvgMargin
FROM LogisticsCustomers c
INNER JOIN ImportedInvoices i ON c.Id = i.CustomerId
GROUP BY c.CustomerCode, c.Name
ORDER BY SUM(i.SalesAmount) DESC;
GO

-- 3. Customer Type Distribution
PRINT '';
PRINT '=== CUSTOMER DISTRIBUTION ===';
SELECT 
    CASE 
        WHEN Name LIKE '%HOSPITAL%' THEN 'Hospital'
        WHEN Name LIKE '%CLINIC%' THEN 'Clinic'
        WHEN Name LIKE '%HEALTH%' OR Name LIKE '%DISTRICT%' THEN 'Government/Health Dept'
        WHEN Name LIKE '%DEPOT%' OR Name LIKE '%WAREHOUSE%' THEN 'Depot/Warehouse'
        ELSE 'Other'
    END AS CustomerType,
    COUNT(*) AS CustomerCount
FROM LogisticsCustomers
WHERE Id > 3  -- Exclude the 3 manually created test customers
GROUP BY 
    CASE 
        WHEN Name LIKE '%HOSPITAL%' THEN 'Hospital'
        WHEN Name LIKE '%CLINIC%' THEN 'Clinic'
        WHEN Name LIKE '%HEALTH%' OR Name LIKE '%DISTRICT%' THEN 'Government/Health Dept'
        WHEN Name LIKE '%DEPOT%' OR Name LIKE '%WAREHOUSE%' THEN 'Depot/Warehouse'
        ELSE 'Other'
    END
ORDER BY CustomerCount DESC;
GO

-- 4. Overall Statistics
PRINT '';
PRINT '=== OVERALL STATISTICS ===';
SELECT 
    (SELECT COUNT(*) FROM LogisticsCustomers) AS TotalCustomers,
    (SELECT COUNT(*) FROM LogisticsCustomers WHERE Id > 3) AS ImportedFromInvoices,
    (SELECT COUNT(DISTINCT TransactionNumber) FROM ImportedInvoices) AS TotalInvoices,
    (SELECT COUNT(*) FROM ImportedInvoices) AS TotalInvoiceLines,
    (SELECT FORMAT(SUM(SalesAmount), 'C', 'en-ZA') FROM ImportedInvoices) AS TotalSales,
    (SELECT FORMAT(SUM(CostOfSales), 'C', 'en-ZA') FROM ImportedInvoices) AS TotalCost,
    (SELECT FORMAT(SUM(SalesAmount - CostOfSales), 'C', 'en-ZA') FROM ImportedInvoices) AS TotalMargin;
GO

-- 5. Recent Invoice Activity
PRINT '';
PRINT '=== RECENT INVOICE ACTIVITY ===';
SELECT TOP 5
    i.TransactionNumber,
    i.TransactionDate,
    c.Name AS Customer,
    i.ProductDescription,
    FORMAT(i.SalesAmount, 'C', 'en-ZA') AS Sales
FROM ImportedInvoices i
INNER JOIN LogisticsCustomers c ON i.CustomerId = c.Id
ORDER BY i.Id DESC;
GO
