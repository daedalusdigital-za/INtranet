DROP TABLE IF EXISTS Customers;
GO

CREATE TABLE Customers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CustomerNumber NVARCHAR(50) NOT NULL UNIQUE,
    CustomerName NVARCHAR(255) NOT NULL,
    ContactPerson NVARCHAR(255) NULL,
    Phone NVARCHAR(50) NULL,
    Email NVARCHAR(255) NULL,
    PhysicalAddress NVARCHAR(500) NULL,
    City NVARCHAR(100) NULL,
    Province NVARCHAR(100) NULL,
    PostalCode NVARCHAR(20) NULL,
    Country NVARCHAR(100) DEFAULT 'South Africa',
    AccountStatus NVARCHAR(20) DEFAULT 'Active',
    CustomerType NVARCHAR(50) NULL,
    CreditLimit DECIMAL(18,2) DEFAULT 0,
    CurrentBalance DECIMAL(18,2) DEFAULT 0,
    PaymentTerms NVARCHAR(50) DEFAULT 'Net 30',
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE()
);
GO

INSERT INTO Customers (CustomerNumber, CustomerName, PhysicalAddress, City, Province, PostalCode, ContactPerson, Phone, Email, CustomerType)
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
    CASE 
        WHEN i.CustomerName LIKE '%HOSPITAL%' THEN 'Healthcare - Hospital'
        WHEN i.CustomerName LIKE '%CLINIC%' THEN 'Healthcare - Clinic'
        WHEN i.CustomerName LIKE '%HEALTH%' OR i.CustomerName LIKE '%DISTRICT%' OR i.CustomerName LIKE '%DEPOT%' THEN 'Healthcare - Government'
        ELSE 'Healthcare - Other'
    END
FROM ImportedInvoices i
WHERE i.CustomerNumber IS NOT NULL;
GO

SELECT COUNT(*) AS TotalCustomers FROM Customers;
GO
