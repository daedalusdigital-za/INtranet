-- Seed Warehouse Inventory Data for 3D Visualization
-- Run this in SQL Server Management Studio or via sqlcmd

-- First, add commodities if they don't exist
IF NOT EXISTS (SELECT 1 FROM Commodities)
BEGIN
    INSERT INTO Commodities (Name, Description, UnitOfMeasure, UnitPrice, Category, IsActive) VALUES
    ('Steel Pipes 50mm', 'Steel pipes for plumbing', 'Each', 150.00, 'Building Materials', 1),
    ('Steel Pipes 100mm', 'Large steel pipes', 'Each', 280.00, 'Building Materials', 1),
    ('Copper Wire 2.5mm', 'Electrical copper wire', 'Meter', 45.00, 'Electrical', 1),
    ('Copper Wire 4mm', 'Heavy duty copper wire', 'Meter', 75.00, 'Electrical', 1),
    ('Cement Bags 50kg', 'Portland cement', 'Bag', 95.00, 'Building Materials', 1),
    ('Paint Buckets 20L', 'Interior wall paint', 'Bucket', 450.00, 'Paint', 1),
    ('PVC Fittings', 'Assorted PVC pipe fittings', 'Each', 25.00, 'Plumbing', 1),
    ('Electrical Panels', 'Distribution boards', 'Each', 1200.00, 'Electrical', 1),
    ('Lumber Planks', 'Treated timber planks', 'Each', 180.00, 'Timber', 1),
    ('Roof Tiles', 'Concrete roof tiles', 'Each', 35.00, 'Roofing', 1),
    ('Glass Sheets 6mm', 'Clear float glass', 'Sheet', 650.00, 'Glass', 1),
    ('Insulation Rolls', 'Thermal insulation', 'Roll', 320.00, 'Insulation', 1),
    ('Concrete Blocks', 'Hollow concrete blocks', 'Each', 18.00, 'Building Materials', 1),
    ('Bricks Red', 'Clay facing bricks', 'Each', 4.50, 'Building Materials', 1),
    ('Gravel 40kg', 'Construction gravel', 'Bag', 55.00, 'Aggregates', 1),
    ('Sand Bags 25kg', 'Building sand', 'Bag', 40.00, 'Aggregates', 1),
    ('Metal Frames', 'Steel door frames', 'Each', 850.00, 'Steel', 1),
    ('Aluminum Sheets', 'Aluminum cladding', 'Sheet', 420.00, 'Metal', 1),
    ('Plastic Pipes 32mm', 'PVC drainage pipes', 'Each', 65.00, 'Plumbing', 1),
    ('Valves Industrial', 'Gate valves', 'Each', 380.00, 'Plumbing', 1);
    
    PRINT 'Inserted 20 commodities';
END

-- Now seed warehouse inventory with realistic bin locations for 3D grid
-- Bin location format: A1-L1 means Row A, Column 1, Level 1
DECLARE @warehouseId INT = 1; -- Gauteng Warehouse
DECLARE @row INT, @col INT, @level INT, @commodityId INT;
DECLARE @binLocation NVARCHAR(20);
DECLARE @quantity INT, @reorderLevel INT, @maxLevel INT;

-- Clear existing inventory for clean seed
DELETE FROM WarehouseInventory WHERE WarehouseId = @warehouseId;

-- Get commodity count
DECLARE @commodityCount INT = (SELECT COUNT(*) FROM Commodities);
DECLARE @rowLetter CHAR(1);

-- Generate inventory: 10 rows (A-J), 20 columns, up to 3 levels
SET @row = 0;
WHILE @row < 10
BEGIN
    SET @rowLetter = CHAR(65 + @row); -- A, B, C, etc.
    SET @col = 1;
    WHILE @col <= 20
    BEGIN
        -- Random levels 1-3 for stacking
        SET @level = 1;
        DECLARE @maxStackLevel INT = ABS(CHECKSUM(NEWID())) % 3 + 1;
        
        WHILE @level <= @maxStackLevel
        BEGIN
            -- Random commodity
            SET @commodityId = (SELECT TOP 1 Id FROM Commodities ORDER BY NEWID());
            
            -- Random quantity
            SET @quantity = ABS(CHECKSUM(NEWID())) % 200 + 10;
            SET @reorderLevel = 20;
            SET @maxLevel = 300;
            
            -- Bin location: e.g., A01-L1, B15-L2
            SET @binLocation = @rowLetter + RIGHT('0' + CAST(@col AS VARCHAR), 2) + '-L' + CAST(@level AS VARCHAR);
            
            INSERT INTO WarehouseInventory 
            (WarehouseId, CommodityId, QuantityOnHand, ReorderLevel, MaximumLevel, BinLocation, LastCountDate, LastRestockDate)
            VALUES 
            (@warehouseId, @commodityId, @quantity, @reorderLevel, @maxLevel, @binLocation, GETDATE(), GETDATE());
            
            SET @level = @level + 1;
        END
        
        SET @col = @col + 1;
    END
    SET @row = @row + 1;
END

-- Add inventory for other warehouses too
SET @warehouseId = 2; -- KZN Warehouse
DELETE FROM WarehouseInventory WHERE WarehouseId = @warehouseId;
SET @row = 0;
WHILE @row < 8
BEGIN
    SET @rowLetter = CHAR(65 + @row);
    SET @col = 1;
    WHILE @col <= 15
    BEGIN
        SET @level = 1;
        SET @maxStackLevel = ABS(CHECKSUM(NEWID())) % 3 + 1;
        
        WHILE @level <= @maxStackLevel
        BEGIN
            SET @commodityId = (SELECT TOP 1 Id FROM Commodities ORDER BY NEWID());
            SET @quantity = ABS(CHECKSUM(NEWID())) % 150 + 5;
            SET @binLocation = @rowLetter + RIGHT('0' + CAST(@col AS VARCHAR), 2) + '-L' + CAST(@level AS VARCHAR);
            
            INSERT INTO WarehouseInventory 
            (WarehouseId, CommodityId, QuantityOnHand, ReorderLevel, MaximumLevel, BinLocation, LastCountDate, LastRestockDate)
            VALUES 
            (@warehouseId, @commodityId, @quantity, 15, 200, @binLocation, GETDATE(), GETDATE());
            
            SET @level = @level + 1;
        END
        SET @col = @col + 1;
    END
    SET @row = @row + 1;
END

PRINT 'Warehouse inventory seeded successfully';

-- Summary
SELECT 
    w.Name as Warehouse,
    COUNT(*) as TotalItems,
    SUM(wi.QuantityOnHand) as TotalQuantity
FROM WarehouseInventory wi
JOIN Warehouses w ON wi.WarehouseId = w.Id
GROUP BY w.Name;
