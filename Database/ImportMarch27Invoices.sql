-- Import Sales Invoices from March 27, 2026
-- Run this script against ProjectTrackerDB

USE ProjectTrackerDB;
GO

-- Insert new invoices (skip if transaction number already exists)
INSERT INTO ImportedInvoices (
    TransactionNumber, CustomerNumber, CustomerName, ProductDescription,
    Quantity, SalesAmount, CostOfSales, TransactionDate, TransactionType,
    Province, Status, CreatedAt
)
SELECT * FROM (VALUES
    -- 01-DEP-019: DEPT OF TRANSPORT KZN
    ('IN164732', '01-DEP-019', 'DEPT OF TRANSPORT KZN', 'Toilet Paper 1 Ply Virgin', 450.00, 80354.35, 55003.26, '2026-03-27', 'IN', 'KZN', 'Pending', GETDATE()),
    
    -- 01-RKK-001: RK KHAN HOSPITAL
    ('IN164740', '01-RKK-001', 'RK KHAN HOSPITAL', 'Paper Towels 235mm X 360mm - Unperf', 250.00, 76660.87, 38643.33, '2026-03-27', 'IN', 'KZN', 'Pending', GETDATE()),
    
    -- 01-SAP-212: SAPS FORENSIC SERVICES KWAZULU NATAL
    ('IN164742-S', '01-SAP-212', 'SAPS FORENSIC SERVICES KWAZULU NATAL', 'NITRILE EXAM GLOVES P/FREE N/S SMALL', 25.00, 1039.78, 962.72, '2026-03-27', 'IN', 'KZN', 'Pending', GETDATE()),
    ('IN164742-L', '01-SAP-212', 'SAPS FORENSIC SERVICES KWAZULU NATAL', 'NITRILE EXAM GLOVES P/FREE N/S LARGE', 99.00, 4117.54, 3812.49, '2026-03-27', 'IN', 'KZN', 'Pending', GETDATE()),
    
    -- 01-SEB-001: SEBENZANI TRADING 622 CC
    ('IN164736', '01-SEB-001', 'SEBENZANI TRADING 622 CC', 'Toilet Paper 2 Ply Virgin', 192.00, 30528.00, 27548.70, '2026-03-27', 'IN', 'KZN', 'Pending', GETDATE()),
    ('IN164741', '01-SEB-001', 'SEBENZANI TRADING 622 CC', 'Toilet Paper 2 Ply Virgin', 25.00, 3975.00, 3597.20, '2026-03-27', 'IN', 'KZN', 'Pending', GETDATE()),
    
    -- 02-SAP-010: SAPS KHUTSONG
    ('IN164735', '02-SAP-010', 'SAPS KHUTSONG', 'TOILET PAPER 1PLY', 60.00, 9913.04, 7350.50, '2026-03-27', 'IN', 'LP', 'Pending', GETDATE()),
    
    -- 03-JOB-001: JOB SHIMANKANA TABANE HOSPITAL
    ('IN164733', '03-JOB-001', 'JOB SHIMANKANA TABANE HOSPITAL', 'Folded Hand Paper Towel 1 Ply', 4000.00, 46991.30, 40809.62, '2026-03-27', 'IN', 'NW', 'Pending', GETDATE()),
    
    -- 04-FSH-014: FS HEALTH FEZILE DABI DISTRICT
    ('IN164738', '04-FSH-014', 'FS HEALTH FEZILE DABI DISTRICT', 'GLUCOSE METER- BIO HERMES', 42.00, 5734.28, 6058.53, '2026-03-27', 'IN', 'FS', 'Pending', GETDATE()),
    
    -- 04-SAP-002: SAPS BETHLEHEM
    ('IN164734', '04-SAP-002', 'SAPS BETHLEHEM', 'Toilet Paper 1 Ply Virgin', 59.00, 10535.35, 7227.98, '2026-03-27', 'IN', 'FS', 'Pending', GETDATE()),
    
    -- 06-ECH-095: EC HEALTH SETTLERS HOSPITAL (5 line items on same invoice - combine or separate?)
    ('IN164737-1', '06-ECH-095', 'EC HEALTH SETTLERS HOSPITAL', 'Folded Hand Paper Towel 1 Ply', 240.00, 2819.48, 2373.94, '2026-03-27', 'IN', 'EC', 'Pending', GETDATE()),
    ('IN164737-2', '06-ECH-095', 'EC HEALTH SETTLERS HOSPITAL', 'Folded Hand Paper Towel 1 Ply', 6820.00, 80120.17, 67459.57, '2026-03-27', 'IN', 'EC', 'Pending', GETDATE()),
    ('IN164737-3', '06-ECH-095', 'EC HEALTH SETTLERS HOSPITAL', 'Folded Hand Paper Towel 1 Ply', 1620.00, 19031.48, 16024.12, '2026-03-27', 'IN', 'EC', 'Pending', GETDATE()),
    ('IN164737-4', '06-ECH-095', 'EC HEALTH SETTLERS HOSPITAL', 'Folded Hand Paper Towel 1 Ply', 900.00, 10573.04, 8902.29, '2026-03-27', 'IN', 'EC', 'Pending', GETDATE()),
    ('IN164737-5', '06-ECH-095', 'EC HEALTH SETTLERS HOSPITAL', 'Folded Hand Paper Towel 1 Ply', 10000.00, 117478.26, 98914.32, '2026-03-27', 'IN', 'EC', 'Pending', GETDATE()),
    
    -- 08-GP1-002: CHRIS HANI BARAGWANATH HOSPITAL
    ('IN164739', '08-GP1-002', 'CHRIS HANI BARAGWANATH HOSPITAL', 'Folded Hand Paper Towel 1 Ply', 37940.00, 445712.52, 387079.23, '2026-03-27', 'IN', 'GP', 'Pending', GETDATE())
    
) AS NewInvoices (TransactionNumber, CustomerNumber, CustomerName, ProductDescription, Quantity, SalesAmount, CostOfSales, TransactionDate, TransactionType, Province, Status, CreatedAt)
WHERE NOT EXISTS (
    SELECT 1 FROM ImportedInvoices ii 
    WHERE ii.TransactionNumber = NewInvoices.TransactionNumber
);

-- Show what was inserted
SELECT 
    TransactionNumber,
    CustomerName,
    ProductDescription,
    Quantity,
    SalesAmount,
    Province,
    Status
FROM ImportedInvoices
WHERE TransactionDate = '2026-03-27'
ORDER BY TransactionNumber;

PRINT 'Import complete. Total sales value: R945,584.46';
