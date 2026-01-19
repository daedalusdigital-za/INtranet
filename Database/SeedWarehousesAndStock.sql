-- Seed Warehouses and Stock Data
-- Run this script to populate warehouse and inventory data

-- First, seed Commodities (products)
IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code = 'MED-001')
BEGIN
    INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, UnitWeight, UnitVolume, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt)
    VALUES 
    ('Paracetamol 500mg', 'MED-001', 'Pain relief tablets', 'Pharmaceuticals', 'Box', 0.5, 0.001, 0, 0, 0, GETUTCDATE()),
    ('Ibuprofen 400mg', 'MED-002', 'Anti-inflammatory tablets', 'Pharmaceuticals', 'Box', 0.4, 0.001, 0, 0, 0, GETUTCDATE()),
    ('Amoxicillin 500mg', 'MED-003', 'Antibiotic capsules', 'Pharmaceuticals', 'Box', 0.3, 0.001, 1, 0, 0, GETUTCDATE()),
    ('Insulin Pens', 'MED-004', 'Diabetes medication', 'Pharmaceuticals', 'Box', 0.2, 0.0005, 1, 1, 0, GETUTCDATE()),
    ('Blood Pressure Monitor', 'EQP-001', 'Digital BP monitor', 'Medical Equipment', 'Unit', 0.8, 0.002, 0, 1, 0, GETUTCDATE()),
    ('Surgical Gloves (Large)', 'SUP-001', 'Latex surgical gloves', 'Medical Supplies', 'Box', 0.3, 0.002, 0, 0, 0, GETUTCDATE()),
    ('Surgical Gloves (Medium)', 'SUP-002', 'Latex surgical gloves', 'Medical Supplies', 'Box', 0.3, 0.002, 0, 0, 0, GETUTCDATE()),
    ('Face Masks N95', 'SUP-003', 'N95 respirator masks', 'Medical Supplies', 'Box', 0.2, 0.003, 0, 0, 0, GETUTCDATE()),
    ('Syringes 5ml', 'SUP-004', 'Disposable syringes', 'Medical Supplies', 'Box', 0.5, 0.002, 0, 0, 0, GETUTCDATE()),
    ('Bandages Elastic', 'SUP-005', 'Elastic bandages assorted', 'Medical Supplies', 'Pack', 0.4, 0.002, 0, 0, 0, GETUTCDATE()),
    ('Antiseptic Solution', 'SUP-006', 'Chlorhexidine solution 500ml', 'Medical Supplies', 'Bottle', 0.6, 0.0005, 0, 0, 0, GETUTCDATE()),
    ('Oxygen Concentrator', 'EQP-002', 'Portable oxygen concentrator', 'Medical Equipment', 'Unit', 8.0, 0.02, 0, 1, 0, GETUTCDATE()),
    ('Wheelchair Standard', 'EQP-003', 'Standard manual wheelchair', 'Medical Equipment', 'Unit', 15.0, 0.5, 0, 0, 0, GETUTCDATE()),
    ('Crutches Aluminum', 'EQP-004', 'Adjustable aluminum crutches', 'Medical Equipment', 'Pair', 2.0, 0.01, 0, 0, 0, GETUTCDATE()),
    ('First Aid Kit', 'SUP-007', 'Complete first aid kit', 'Medical Supplies', 'Kit', 1.5, 0.005, 0, 0, 0, GETUTCDATE()),
    ('Thermometer Digital', 'EQP-005', 'Digital thermometer', 'Medical Equipment', 'Unit', 0.05, 0.0001, 0, 1, 0, GETUTCDATE()),
    ('Stethoscope', 'EQP-006', 'Professional stethoscope', 'Medical Equipment', 'Unit', 0.2, 0.001, 0, 0, 0, GETUTCDATE()),
    ('Vitamin C 1000mg', 'MED-005', 'Vitamin C supplements', 'Pharmaceuticals', 'Bottle', 0.3, 0.001, 0, 0, 0, GETUTCDATE()),
    ('Multivitamins', 'MED-006', 'Daily multivitamin tablets', 'Pharmaceuticals', 'Bottle', 0.4, 0.001, 0, 0, 0, GETUTCDATE()),
    ('Hand Sanitizer 500ml', 'SUP-008', 'Alcohol-based sanitizer', 'Medical Supplies', 'Bottle', 0.55, 0.0005, 0, 0, 1, GETUTCDATE());
END

-- Seed Warehouses
IF NOT EXISTS (SELECT 1 FROM Warehouses WHERE Code = 'WH-KZN')
BEGIN
    INSERT INTO Warehouses (Name, Code, Address, City, PostalCode, Province, Latitude, Longitude, ManagerName, PhoneNumber, Email, TotalCapacity, AvailableCapacity, Status, CreatedAt)
    VALUES 
    ('KZN Distribution Centre', 'WH-KZN', '123 Industrial Road, Pinetown', 'Durban', '3610', 'KwaZulu-Natal', -29.8167, 30.8500, 'John Dlamini', '031-555-0001', 'kzn.warehouse@company.co.za', 10000, 2200, 'Active', GETUTCDATE()),
    ('Gauteng Main Warehouse', 'WH-GP', '456 Logistics Park, Midrand', 'Johannesburg', '1685', 'Gauteng', -25.9792, 28.1350, 'Sarah Mokwena', '011-555-0002', 'gauteng.warehouse@company.co.za', 15000, 5500, 'Active', GETUTCDATE()),
    ('Cape Town Hub', 'WH-WC', '789 Harbour Drive, Paarden Eiland', 'Cape Town', '7405', 'Western Cape', -33.9167, 18.4500, 'Michael van der Berg', '021-555-0003', 'capetown.warehouse@company.co.za', 8000, 3200, 'Active', GETUTCDATE()),
    ('Eastern Cape Depot', 'WH-EC', '321 Port Road, Gqeberha', 'Gqeberha', '6001', 'Eastern Cape', -33.9608, 25.6022, 'Nomsa Hendricks', '041-555-0004', 'ec.warehouse@company.co.za', 5000, 2800, 'Active', GETUTCDATE());
END

-- Seed Warehouse Inventory
DECLARE @WHKZN INT = (SELECT Id FROM Warehouses WHERE Code = 'WH-KZN');
DECLARE @WHGP INT = (SELECT Id FROM Warehouses WHERE Code = 'WH-GP');
DECLARE @WHWC INT = (SELECT Id FROM Warehouses WHERE Code = 'WH-WC');
DECLARE @WHEC INT = (SELECT Id FROM Warehouses WHERE Code = 'WH-EC');

-- Get commodity IDs
DECLARE @MED001 INT = (SELECT Id FROM Commodities WHERE Code = 'MED-001');
DECLARE @MED002 INT = (SELECT Id FROM Commodities WHERE Code = 'MED-002');
DECLARE @MED003 INT = (SELECT Id FROM Commodities WHERE Code = 'MED-003');
DECLARE @MED004 INT = (SELECT Id FROM Commodities WHERE Code = 'MED-004');
DECLARE @EQP001 INT = (SELECT Id FROM Commodities WHERE Code = 'EQP-001');
DECLARE @SUP001 INT = (SELECT Id FROM Commodities WHERE Code = 'SUP-001');
DECLARE @SUP002 INT = (SELECT Id FROM Commodities WHERE Code = 'SUP-002');
DECLARE @SUP003 INT = (SELECT Id FROM Commodities WHERE Code = 'SUP-003');
DECLARE @SUP004 INT = (SELECT Id FROM Commodities WHERE Code = 'SUP-004');
DECLARE @SUP005 INT = (SELECT Id FROM Commodities WHERE Code = 'SUP-005');
DECLARE @SUP006 INT = (SELECT Id FROM Commodities WHERE Code = 'SUP-006');
DECLARE @EQP002 INT = (SELECT Id FROM Commodities WHERE Code = 'EQP-002');
DECLARE @EQP003 INT = (SELECT Id FROM Commodities WHERE Code = 'EQP-003');
DECLARE @EQP004 INT = (SELECT Id FROM Commodities WHERE Code = 'EQP-004');
DECLARE @SUP007 INT = (SELECT Id FROM Commodities WHERE Code = 'SUP-007');
DECLARE @EQP005 INT = (SELECT Id FROM Commodities WHERE Code = 'EQP-005');
DECLARE @EQP006 INT = (SELECT Id FROM Commodities WHERE Code = 'EQP-006');
DECLARE @MED005 INT = (SELECT Id FROM Commodities WHERE Code = 'MED-005');
DECLARE @MED006 INT = (SELECT Id FROM Commodities WHERE Code = 'MED-006');
DECLARE @SUP008 INT = (SELECT Id FROM Commodities WHERE Code = 'SUP-008');

-- KZN Warehouse Inventory
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId = @WHKZN AND CommodityId = @MED001)
BEGIN
    INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, ReorderLevel, MaximumLevel, BinLocation, LastCountDate, LastRestockDate, CreatedAt)
    VALUES 
    (@WHKZN, @MED001, 2500, 500, 5000, 'A-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @MED002, 1800, 400, 4000, 'A-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @MED003, 1200, 300, 3000, 'A-02-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @MED004, 450, 100, 1000, 'B-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @SUP001, 3500, 800, 6000, 'C-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @SUP002, 3200, 800, 6000, 'C-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @SUP003, 5000, 1000, 8000, 'C-02-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @SUP004, 4500, 1000, 7000, 'C-02-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @EQP001, 85, 20, 150, 'D-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @EQP005, 200, 50, 300, 'D-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @SUP006, 800, 200, 1500, 'C-03-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHKZN, @SUP007, 350, 100, 600, 'C-03-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE());
END

-- Gauteng Warehouse Inventory
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId = @WHGP AND CommodityId = @MED001)
BEGIN
    INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, ReorderLevel, MaximumLevel, BinLocation, LastCountDate, LastRestockDate, CreatedAt)
    VALUES 
    (@WHGP, @MED001, 4500, 1000, 8000, 'A-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @MED002, 3200, 800, 6000, 'A-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @MED003, 2100, 500, 4000, 'A-02-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @MED004, 680, 150, 1500, 'B-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @MED005, 1500, 300, 3000, 'A-03-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @MED006, 1200, 250, 2500, 'A-03-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @SUP001, 6000, 1200, 10000, 'C-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @SUP002, 5500, 1200, 10000, 'C-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @SUP003, 8000, 1500, 12000, 'C-02-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @SUP004, 7500, 1500, 11000, 'C-02-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @SUP005, 2200, 500, 4000, 'C-03-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @SUP008, 3000, 600, 5000, 'C-03-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @EQP001, 150, 30, 250, 'D-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @EQP002, 25, 5, 50, 'D-02-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @EQP003, 45, 10, 80, 'D-02-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @EQP004, 120, 30, 200, 'D-03-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @EQP005, 350, 80, 500, 'D-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHGP, @EQP006, 180, 40, 300, 'D-01-03', GETUTCDATE(), GETUTCDATE(), GETUTCDATE());
END

-- Cape Town Warehouse Inventory
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId = @WHWC AND CommodityId = @MED001)
BEGIN
    INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, ReorderLevel, MaximumLevel, BinLocation, LastCountDate, LastRestockDate, CreatedAt)
    VALUES 
    (@WHWC, @MED001, 1800, 400, 3500, 'A-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @MED002, 1400, 300, 2800, 'A-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @MED003, 900, 200, 2000, 'A-02-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @MED005, 800, 200, 1600, 'A-03-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @SUP001, 2800, 600, 5000, 'C-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @SUP002, 2600, 600, 5000, 'C-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @SUP003, 4200, 800, 7000, 'C-02-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @SUP004, 3800, 800, 6000, 'C-02-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @SUP006, 600, 150, 1200, 'C-03-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @EQP001, 60, 15, 100, 'D-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @EQP005, 150, 40, 250, 'D-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHWC, @SUP007, 280, 70, 500, 'C-03-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE());
END

-- Eastern Cape Warehouse Inventory
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId = @WHEC AND CommodityId = @MED001)
BEGIN
    INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, ReorderLevel, MaximumLevel, BinLocation, LastCountDate, LastRestockDate, CreatedAt)
    VALUES 
    (@WHEC, @MED001, 950, 250, 2000, 'A-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHEC, @MED002, 720, 180, 1500, 'A-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHEC, @MED003, 480, 120, 1000, 'A-02-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHEC, @SUP001, 1500, 350, 3000, 'C-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHEC, @SUP002, 1400, 350, 3000, 'C-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHEC, @SUP003, 2200, 500, 4000, 'C-02-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHEC, @SUP004, 2000, 500, 3500, 'C-02-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHEC, @SUP005, 800, 200, 1500, 'C-03-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHEC, @EQP001, 35, 10, 60, 'D-01-01', GETUTCDATE(), GETUTCDATE(), GETUTCDATE()),
    (@WHEC, @EQP005, 80, 20, 150, 'D-01-02', GETUTCDATE(), GETUTCDATE(), GETUTCDATE());
END

PRINT 'Warehouses and inventory data seeded successfully!';

-- Display summary
SELECT 
    w.Name AS Warehouse,
    w.City,
    COUNT(wi.Id) AS ItemTypes,
    SUM(wi.QuantityOnHand) AS TotalStock,
    w.TotalCapacity,
    w.AvailableCapacity
FROM Warehouses w
LEFT JOIN WarehouseInventory wi ON w.Id = wi.WarehouseId
GROUP BY w.Id, w.Name, w.City, w.TotalCapacity, w.AvailableCapacity
ORDER BY w.Name;
