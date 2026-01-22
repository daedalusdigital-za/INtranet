-- Seed Government Contracts for Promed Technologies and other companies
-- Run this after creating the GovernmentContracts table

-- Create table if not exists
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'GovernmentContracts')
BEGIN
    CREATE TABLE GovernmentContracts (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        CompanyCode NVARCHAR(10) NOT NULL,
        CompanyName NVARCHAR(100) NOT NULL,
        TenderNumber NVARCHAR(50) NOT NULL,
        Commodity NVARCHAR(255) NOT NULL,
        ContractDurationYears INT NOT NULL,
        StartDate DATETIME2 NULL,
        ExpiryDate DATETIME2 NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Active',
        IssuingAuthority NVARCHAR(255) NULL,
        Notes NVARCHAR(MAX) NULL,
        EstimatedAnnualValue DECIMAL(18,2) NULL,
        Category NVARCHAR(100) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL
    );
    PRINT 'Created GovernmentContracts table';
END
GO

-- Clear existing data
DELETE FROM GovernmentContracts WHERE CompanyCode = 'PMT';
GO

-- Insert Promed Technologies Contracts
INSERT INTO GovernmentContracts (CompanyCode, CompanyName, TenderNumber, Commodity, ContractDurationYears, StartDate, ExpiryDate, IsActive, Status, IssuingAuthority, Category)
VALUES 
-- Expired Contracts
('PMT', 'Promed Technologies', 'RT32-2019', 'Surgical Sundries', 3, '2019-07-01', '2022-06-30', 0, 'Expired', 'National Department of Health', 'Medical Supplies'),
('PMT', 'Promed Technologies', 'RT32-1-2019', 'Surgical Sundries', 2, '2019-07-01', '2021-06-30', 0, 'Expired', 'National Department of Health', 'Medical Supplies'),
('PMT', 'Promed Technologies', 'RT298-2018', 'Pharm Packing Material', 3, '2018-03-01', '2021-02-28', 0, 'Expired', 'National Department of Health', 'Packaging'),
('PMT', 'Promed Technologies', 'RT14-2019', 'Paper Products', 3, '2019-03-01', '2022-02-28', 0, 'Expired', 'National Department of Health', 'Paper Products'),
('PMT', 'Promed Technologies', 'RT284-2019', 'Syringes', 3, '2019-07-01', '2022-06-30', 0, 'Expired', 'National Department of Health', 'Medical Supplies'),
('PMT', 'Promed Technologies', 'RT76-2020', 'Gloves', 3, '2020-08-01', '2023-07-31', 0, 'Expired', 'National Department of Health', 'PPE'),
('PMT', 'Promed Technologies', 'RT75-2018', 'Condoms', 3, '2018-10-01', '2021-09-30', 0, 'Expired', 'National Department of Health', 'Family Planning'),
('PMT', 'Promed Technologies', 'RT296-2020', 'Dental Consumables', 3, '2020-07-01', '2023-06-30', 0, 'Expired', 'National Department of Health', 'Dental'),
('PMT', 'Promed Technologies', 'RT75-2-2021', 'Condoms', 3, '2021-10-01', '2024-09-30', 0, 'Expired', 'National Department of Health', 'Family Planning'),
('PMT', 'Promed Technologies', 'RT298-2021', 'Pharm Packing Material', 3, '2021-03-01', '2024-02-29', 0, 'Expired', 'National Department of Health', 'Packaging'),
('PMT', 'Promed Technologies', 'RT42-2021', 'Bandages and Dressings', 3, '2022-03-01', '2025-02-28', 0, 'Expired', 'National Department of Health', 'Medical Supplies'),

-- Active Contracts
('PMT', 'Promed Technologies', 'RT75-2025', 'Condoms', 5, '2025-10-31', '2030-10-30', 1, 'Active', 'National Department of Health', 'Family Planning'),
('PMT', 'Promed Technologies', 'RT298-2025', 'Pharm Packing Material', 3, '2025-03-01', '2028-02-29', 1, 'Active', 'National Department of Health', 'Packaging'),
('PMT', 'Promed Technologies', 'RT14-2022', 'Paper Products', 3, '2023-03-01', '2026-02-28', 1, 'Active', 'National Department of Health', 'Paper Products'),
('PMT', 'Promed Technologies', 'RT32-2022', 'Surgical Sundries', 3, '2023-07-01', '2026-06-30', 1, 'Active', 'National Department of Health', 'Medical Supplies'),
('PMT', 'Promed Technologies', 'RT284-2023', 'Hypodermic Syringes, Needles & Blood Lancet Devices', 3, '2023-07-01', '2026-06-30', 1, 'Active', 'National Department of Health', 'Medical Supplies'),
('PMT', 'Promed Technologies', 'RT76-2023', 'Examination & Surgical Gloves', 3, '2023-08-01', '2026-07-31', 1, 'Active', 'National Department of Health', 'PPE'),
('PMT', 'Promed Technologies', 'RT40-2024', 'Crutches and Walking Aids', 3, '2024-07-01', '2027-06-30', 1, 'Active', 'National Department of Health', 'Medical Equipment'),
('PMT', 'Promed Technologies', 'RT296-2023', 'Dental Materials and Consumables', 3, '2024-07-01', '2027-06-30', 1, 'Active', 'National Department of Health', 'Dental'),
('PMT', 'Promed Technologies', 'RT296-1-2023', 'Dental Materials and Consumables', 3, '2024-07-01', '2027-06-30', 1, 'Active', 'National Department of Health', 'Dental'),
('PMT', 'Promed Technologies', 'RT14-1-2022', 'Paper Products', 1, '2025-03-01', '2026-02-28', 1, 'Active', 'National Department of Health', 'Paper Products'),
('PMT', 'Promed Technologies', 'RT42-2025', 'Bandages and Dressings', 5, '2025-10-31', '2030-10-30', 1, 'Active', 'National Department of Health', 'Medical Supplies');

-- Update status for contracts expiring soon (within 6 months)
UPDATE GovernmentContracts 
SET Status = 'Expiring Soon'
WHERE IsActive = 1 
  AND ExpiryDate IS NOT NULL 
  AND ExpiryDate <= DATEADD(MONTH, 6, GETUTCDATE())
  AND ExpiryDate > GETUTCDATE();

PRINT 'Inserted ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' Promed Technologies contracts';
GO

-- Verify the data
SELECT 
    TenderNumber,
    Commodity,
    CAST(ContractDurationYears AS VARCHAR(2)) + ' Years' AS Duration,
    CASE 
        WHEN IsActive = 0 THEN 'Expired'
        WHEN ExpiryDate <= DATEADD(MONTH, 6, GETUTCDATE()) THEN 'Expiring: ' + FORMAT(ExpiryDate, 'MMM-yyyy')
        ELSE 'Active until ' + FORMAT(ExpiryDate, 'dd-MMM-yyyy')
    END AS Status
FROM GovernmentContracts
WHERE CompanyCode = 'PMT'
ORDER BY IsActive DESC, ExpiryDate DESC;
GO
