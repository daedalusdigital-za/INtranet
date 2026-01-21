-- Create Customers Table for Logistics System
-- This table stores customer information and links to ImportedInvoices via CustomerNumber

USE ProjectTrackerDb;
GO

-- Drop table if exists (for development)
-- DROP TABLE IF EXISTS Customers;

CREATE TABLE Customers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CustomerNumber NVARCHAR(50) NOT NULL UNIQUE,
    CustomerName NVARCHAR(255) NOT NULL,
    
    -- Contact Information
    ContactPerson NVARCHAR(255) NULL,
    Phone NVARCHAR(50) NULL,
    Email NVARCHAR(255) NULL,
    
    -- Physical Address
    PhysicalAddress NVARCHAR(500) NULL,
    City NVARCHAR(100) NULL,
    Province NVARCHAR(100) NULL,
    PostalCode NVARCHAR(20) NULL,
    Country NVARCHAR(100) DEFAULT 'South Africa',
    
    -- Business Information
    VATNumber NVARCHAR(50) NULL,
    RegistrationNumber NVARCHAR(50) NULL,
    AccountStatus NVARCHAR(20) DEFAULT 'Active', -- Active, Inactive, Suspended, Closed
    CustomerType NVARCHAR(50) NULL, -- Retail, Wholesale, Government, Healthcare, etc.
    
    -- Financial Information
    CreditLimit DECIMAL(18,2) DEFAULT 0,
    CurrentBalance DECIMAL(18,2) DEFAULT 0,
    PaymentTerms NVARCHAR(50) DEFAULT 'Net 30', -- Net 30, Net 60, COD, etc.
    
    -- Sales Information
    SalesRepUserId INT NULL, -- Link to Users table
    Territory NVARCHAR(100) NULL,
    PriceList NVARCHAR(50) NULL,
    
    -- Metadata
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    CreatedByUserId INT NULL,
    UpdatedByUserId INT NULL,
    
    -- Soft Delete
    IsDeleted BIT DEFAULT 0,
    DeletedAt DATETIME2 NULL,
    
    CONSTRAINT FK_Customers_SalesRep FOREIGN KEY (SalesRepUserId) REFERENCES Users(UserId),
    CONSTRAINT FK_Customers_CreatedBy FOREIGN KEY (CreatedByUserId) REFERENCES Users(UserId),
    CONSTRAINT FK_Customers_UpdatedBy FOREIGN KEY (UpdatedByUserId) REFERENCES Users(UserId)
);

-- Create indexes for better query performance
CREATE INDEX IX_Customers_CustomerNumber ON Customers(CustomerNumber);
CREATE INDEX IX_Customers_CustomerName ON Customers(CustomerName);
CREATE INDEX IX_Customers_AccountStatus ON Customers(AccountStatus);
CREATE INDEX IX_Customers_City ON Customers(City);
CREATE INDEX IX_Customers_Province ON Customers(Province);
CREATE INDEX IX_Customers_SalesRepUserId ON Customers(SalesRepUserId);

GO

-- Verify table creation
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    CHARACTER_MAXIMUM_LENGTH, 
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Customers'
ORDER BY ORDINAL_POSITION;

GO
