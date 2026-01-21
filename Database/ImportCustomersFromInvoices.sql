-- Import Customers from existing ImportedInvoices data
-- This creates customer records based on unique customers found in invoices

USE ProjectTrackerDb;
GO

-- Insert unique customers from ImportedInvoices into Customers table
INSERT INTO Customers (
    CustomerNumber,
    CustomerName,
    PhysicalAddress,
    City,
    Province,
    PostalCode,
    ContactPerson,
    Phone,
    Email,
    AccountStatus,
    CustomerType,
    CreatedAt,
    UpdatedAt
)
SELECT DISTINCT
    i.CustomerNumber,
    i.CustomerName,
    i.DeliveryAddress,
    i.DeliveryCity,
    i.DeliveryProvince,
    i.DeliveryPostalCode,
    i.ContactPerson,
    i.ContactPhone,
    i.ContactEmail,
    'Active' AS AccountStatus,
    CASE 
        WHEN i.CustomerName LIKE '%HOSPITAL%' THEN 'Healthcare - Hospital'
        WHEN i.CustomerName LIKE '%CLINIC%' THEN 'Healthcare - Clinic'
        WHEN i.CustomerName LIKE '%HEALTH%' THEN 'Healthcare - Department'
        WHEN i.CustomerName LIKE '%DEPOT%' THEN 'Healthcare - Depot'
        WHEN i.CustomerName LIKE '%WAREHOUSE%' THEN 'Warehouse'
        ELSE 'Healthcare - Other'
    END AS CustomerType,
    GETDATE() AS CreatedAt,
    GETDATE() AS UpdatedAt
FROM ImportedInvoices i
WHERE i.CustomerNumber IS NOT NULL
    AND i.CustomerNumber NOT IN (SELECT CustomerNumber FROM Customers)
ORDER BY i.CustomerName;

-- Display results
SELECT 
    COUNT(*) AS CustomersImported,
    (SELECT COUNT(*) FROM Customers) AS TotalCustomers
FROM Customers;

GO

-- Show sample of imported customers
SELECT TOP 10
    CustomerNumber,
    CustomerName,
    CustomerType,
    City,
    Province,
    Phone,
    Email
FROM Customers
ORDER BY CustomerName;

GO
