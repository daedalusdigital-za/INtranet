-- Import Customers from ImportedInvoices into LogisticsCustomers
USE ProjectTrackerDb;
GO

-- Import unique customers
INSERT INTO LogisticsCustomers (
    Name,
    CustomerCode,
    ContactPerson,
    ContactEmail,
    ContactPhone,
    PhysicalAddress,
    DeliveryAddress,
    City,
    DeliveryCity,
    Province,
    DeliveryProvince,
    PostalCode,
    DeliveryPostalCode,
    Country,
    Status,
    ImportBatchId,
    SourceSystem,
    CreatedAt,
    UpdatedAt
)
SELECT 
    CustomerName,
    CustomerNumber,
    ContactPerson,
    ContactEmail,
    ContactPhone,
    DeliveryAddress,
    DeliveryAddress,
    DeliveryCity,
    DeliveryCity,
    DeliveryProvince,
    DeliveryProvince,
    DeliveryPostalCode,
    DeliveryPostalCode,
    'South Africa',
    'Active',
    'INVOICE_IMPORT_' + CONVERT(NVARCHAR(14), GETDATE(), 112),
    'ERP_System',
    GETDATE(),
    GETDATE()
FROM (
    SELECT 
        i.CustomerNumber,
        i.CustomerName,
        i.ContactPerson,
        i.ContactEmail,
        i.ContactPhone,
        i.DeliveryAddress,
        i.DeliveryCity,
        i.DeliveryProvince,
        i.DeliveryPostalCode,
        ROW_NUMBER() OVER (PARTITION BY i.CustomerNumber ORDER BY LEN(i.CustomerName) DESC, i.Id DESC) AS rn
    FROM ImportedInvoices i
    WHERE i.CustomerNumber IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM LogisticsCustomers lc 
            WHERE lc.CustomerCode = i.CustomerNumber
        )
) sub
WHERE rn = 1;

-- Display results
SELECT COUNT(*) AS CustomersImported FROM LogisticsCustomers 
WHERE ImportBatchId LIKE 'INVOICE_IMPORT%';

SELECT COUNT(*) AS TotalCustomers FROM LogisticsCustomers;

GO
