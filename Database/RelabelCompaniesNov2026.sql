SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRAN;
UPDATE Commodities SET Category=N'PROMED', UpdatedAt=SYSUTCDATETIME() WHERE Id=1297;
UPDATE Commodities SET Category=N'PROMED', UpdatedAt=SYSUTCDATETIME() WHERE Id=993;
UPDATE Commodities SET Category=N'PROMED', UpdatedAt=SYSUTCDATETIME() WHERE Id=1316;
UPDATE Commodities SET Category=N'ACCESS', UpdatedAt=SYSUTCDATETIME() WHERE Id=1395;
UPDATE Commodities SET Category=N'ACCESS', UpdatedAt=SYSUTCDATETIME() WHERE Id=1399;
UPDATE Commodities SET Category=N'ACCESS', UpdatedAt=SYSUTCDATETIME() WHERE Id=1400;
UPDATE Commodities SET Category=N'ACCESS', UpdatedAt=SYSUTCDATETIME() WHERE Id=1401;
UPDATE Commodities SET Category=N'SEBENZANI', UpdatedAt=SYSUTCDATETIME() WHERE Id=492;
UPDATE Commodities SET Category=N'SEBENZANI', UpdatedAt=SYSUTCDATETIME() WHERE Id=493;
UPDATE Commodities SET Category=N'SEBENZANI', UpdatedAt=SYSUTCDATETIME() WHERE Id=122;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'MAI00100000000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=676;
DECLARE @n1_676 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'MAI00100000000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_676)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_676, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 676, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_676, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=676;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_676;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=938;
DECLARE @n1_938 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_938)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_938, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 938, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_938, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=938;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_938;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=939;
DECLARE @n1_939 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_939)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_939, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 939, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_939, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=939;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_939;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700300000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=940;
DECLARE @n1_940 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700300000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_940)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_940, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 940, 'Adjustment', -240.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_940, 'Adjustment', 240.0, 240.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=940;
UPDATE WarehouseInventory SET QuantityOnHand=240.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_940;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=941;
DECLARE @n1_941 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_941)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_941, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 941, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_941, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=941;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_941;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700500000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=942;
DECLARE @n1_942 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700500000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_942)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_942, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 942, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_942, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=942;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_942;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700600000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=943;
DECLARE @n1_943 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700600000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_943)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_943, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 943, 'Adjustment', -100.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_943, 'Adjustment', 100.0, 100.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=943;
UPDATE WarehouseInventory SET QuantityOnHand=100.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_943;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=947;
DECLARE @n1_947 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_947)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_947, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 947, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_947, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=947;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_947;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=948;
DECLARE @n1_948 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_948)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_948, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 948, 'Adjustment', -150.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_948, 'Adjustment', 150.0, 150.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=948;
UPDATE WarehouseInventory SET QuantityOnHand=150.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_948;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701300000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=1285;
DECLARE @n1_1285 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701300000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_1285)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_1285, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 1285, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_1285, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=1285;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_1285;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=266;
DECLARE @n1_266 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_266)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_266, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 266, 'Adjustment', -1800.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_266, 'Adjustment', 1800.0, 1800.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=266;
UPDATE WarehouseInventory SET QuantityOnHand=1800.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_266;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701500000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=267;
DECLARE @n1_267 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701500000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_267)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_267, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 267, 'Adjustment', -8240.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_267, 'Adjustment', 8240.0, 8240.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=267;
UPDATE WarehouseInventory SET QuantityOnHand=8240.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_267;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701600000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=268;
DECLARE @n1_268 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701600000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_268)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_268, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 268, 'Adjustment', -12847.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_268, 'Adjustment', 12847.0, 12847.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=268;
UPDATE WarehouseInventory SET QuantityOnHand=12847.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_268;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701700000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=949;
DECLARE @n1_949 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701700000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_949)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_949, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 949, 'Adjustment', -1868.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_949, 'Adjustment', 1868.0, 1868.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=949;
UPDATE WarehouseInventory SET QuantityOnHand=1868.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_949;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701800000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=950;
DECLARE @n1_950 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701800000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_950)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_950, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 950, 'Adjustment', -1427.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_950, 'Adjustment', 1427.0, 1427.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=950;
UPDATE WarehouseInventory SET QuantityOnHand=1427.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_950;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321703000000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=954;
DECLARE @n1_954 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321703000000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_954)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_954, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 954, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_954, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=954;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_954;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321703100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=955;
DECLARE @n1_955 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321703100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_955)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_955, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 955, 'Adjustment', -5393.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_955, 'Adjustment', 5393.0, 5393.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=955;
UPDATE WarehouseInventory SET QuantityOnHand=5393.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_955;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321703200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=276;
DECLARE @n1_276 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321703200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_276)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_276, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 276, 'Adjustment', -1500.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_276, 'Adjustment', 1500.0, 1500.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=276;
UPDATE WarehouseInventory SET QuantityOnHand=1500.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_276;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321703400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=956;
DECLARE @n1_956 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321703400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_956)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_956, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 956, 'Adjustment', -300.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_956, 'Adjustment', 300.0, 300.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=956;
UPDATE WarehouseInventory SET QuantityOnHand=300.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_956;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT322100100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=957;
DECLARE @n1_957 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT322100100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_957)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_957, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 957, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_957, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=957;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_957;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT322100700000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=960;
DECLARE @n1_960 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT322100700000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_960)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_960, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 960, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_960, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=960;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_960;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=315;
DECLARE @n1_315 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_315)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_315, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 315, 'Adjustment', -77.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_315, 'Adjustment', 77.0, 77.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=315;
UPDATE WarehouseInventory SET QuantityOnHand=77.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_315;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300500000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=316;
DECLARE @n1_316 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300500000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_316)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_316, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 316, 'Adjustment', -25.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_316, 'Adjustment', 25.0, 25.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=316;
UPDATE WarehouseInventory SET QuantityOnHand=25.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_316;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300600000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=317;
DECLARE @n1_317 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300600000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_317)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_317, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 317, 'Adjustment', -3596.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_317, 'Adjustment', 3596.0, 3596.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=317;
UPDATE WarehouseInventory SET QuantityOnHand=3596.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_317;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300700000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=1058;
DECLARE @n1_1058 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300700000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_1058)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_1058, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 1058, 'Adjustment', -33600.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_1058, 'Adjustment', 33600.0, 33600.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=1058;
UPDATE WarehouseInventory SET QuantityOnHand=33600.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_1058;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT760100100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=338;
DECLARE @n1_338 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT760100100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_338)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_338, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 338, 'Adjustment', -747.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_338, 'Adjustment', 747.0, 747.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=338;
UPDATE WarehouseInventory SET QuantityOnHand=747.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_338;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT760100200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=339;
DECLARE @n1_339 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT760100200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_339)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_339, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 339, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_339, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=339;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_339;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT760100300000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=340;
DECLARE @n1_340 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT760100300000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_340)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_340, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 340, 'Adjustment', -421.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_340, 'Adjustment', 421.0, 421.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=340;
UPDATE WarehouseInventory SET QuantityOnHand=421.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_340;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT760100400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=341;
DECLARE @n1_341 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT760100400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_341)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_341, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 341, 'Adjustment', -8.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_341, 'Adjustment', 8.0, 8.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=341;
UPDATE WarehouseInventory SET QuantityOnHand=8.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_341;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'4228191600022' AND UPPER(Category)=N'ACCESS')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'ACCESS', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=562;
DECLARE @n1_562 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'4228191600022' AND UPPER(Category)=N'ACCESS');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_562)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_562, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 562, 'Adjustment', -54.0, 0, 'Stock count 2026-11-02: counted on the ACCESS sheet - moved to ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_562, 'Adjustment', 54.0, 54.0, 'Stock count 2026-11-02: counted on the ACCESS sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=562;
UPDATE WarehouseInventory SET QuantityOnHand=54.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_562;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420106400000' AND UPPER(Category)=N'ACCESS')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'ACCESS', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=997;
DECLARE @n1_997 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420106400000' AND UPPER(Category)=N'ACCESS');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_997)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_997, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 997, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the ACCESS sheet - moved to ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_997, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the ACCESS sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=997;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_997;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140100600000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=796;
DECLARE @n1_796 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140100600000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_796)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_796, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 796, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_796, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=796;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_796;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140100700000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=175;
DECLARE @n1_175 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140100700000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_175)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_175, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 175, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_175, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=175;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_175;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140100800000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=176;
DECLARE @n1_176 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140100800000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_176)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_176, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 176, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_176, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=176;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_176;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140101500000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=177;
DECLARE @n1_177 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140101500000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_177)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_177, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 177, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_177, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=177;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_177;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT320900200000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=252;
DECLARE @n1_252 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT320900200000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_252)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_252, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 252, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_252, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=252;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_252;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321600400000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=262;
DECLARE @n1_262 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321600400000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_262)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_262, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 262, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_262, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=262;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_262;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321600500000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=934;
DECLARE @n1_934 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321600500000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_934)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_934, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 934, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_934, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=934;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_934;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321600600000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=935;
DECLARE @n1_935 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321600600000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_935)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_935, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 935, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_935, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=935;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_935;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321600700000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=937;
DECLARE @n1_937 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321600700000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_937)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_937, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 937, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_937, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=937;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_937;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT322200400000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=279;
DECLARE @n1_279 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT322200400000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=1 AND CommodityId=@n1_279)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (1, @n1_279, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (1, 279, 'Adjustment', -187.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (1, @n1_279, 'Adjustment', 187.0, 187.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=279;
UPDATE WarehouseInventory SET QuantityOnHand=187.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=1 AND CommodityId=@n1_279;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'4228191600022' AND UPPER(Category)=N'ACCESS')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'ACCESS', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=562;
DECLARE @n2_562 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'4228191600022' AND UPPER(Category)=N'ACCESS');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_562)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_562, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 562, 'Adjustment', -198.0, 0, 'Stock count 2026-11-02: counted on the ACCESS sheet - moved to ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_562, 'Adjustment', 198.0, 198.0, 'Stock count 2026-11-02: counted on the ACCESS sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=562;
UPDATE WarehouseInventory SET QuantityOnHand=198.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_562;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420106400000' AND UPPER(Category)=N'ACCESS')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'ACCESS', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=997;
DECLARE @n2_997 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420106400000' AND UPPER(Category)=N'ACCESS');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_997)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_997, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 997, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the ACCESS sheet - moved to ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_997, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the ACCESS sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=997;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_997;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'MAI00100000000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=676;
DECLARE @n2_676 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'MAI00100000000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_676)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_676, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 676, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_676, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=676;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_676;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=938;
DECLARE @n2_938 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_938)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_938, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 938, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_938, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=938;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_938;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=939;
DECLARE @n2_939 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_939)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_939, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 939, 'Adjustment', 62.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_939, 'Adjustment', -62.0, -62.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=939;
UPDATE WarehouseInventory SET QuantityOnHand=-62.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_939;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700300000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=940;
DECLARE @n2_940 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700300000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_940)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_940, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 940, 'Adjustment', -7058.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_940, 'Adjustment', 7058.0, 7058.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=940;
UPDATE WarehouseInventory SET QuantityOnHand=7058.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_940;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=941;
DECLARE @n2_941 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_941)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_941, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 941, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_941, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=941;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_941;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700500000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=942;
DECLARE @n2_942 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700500000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_942)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_942, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 942, 'Adjustment', -2680.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_942, 'Adjustment', 2680.0, 2680.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=942;
UPDATE WarehouseInventory SET QuantityOnHand=2680.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_942;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321700600000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=943;
DECLARE @n2_943 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321700600000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_943)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_943, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 943, 'Adjustment', -21800.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_943, 'Adjustment', 21800.0, 21800.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=943;
UPDATE WarehouseInventory SET QuantityOnHand=21800.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_943;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=947;
DECLARE @n2_947 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_947)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_947, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 947, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_947, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=947;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_947;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=948;
DECLARE @n2_948 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_948)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_948, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 948, 'Adjustment', -150.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_948, 'Adjustment', 150.0, 150.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=948;
UPDATE WarehouseInventory SET QuantityOnHand=150.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_948;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701300000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=1285;
DECLARE @n2_1285 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701300000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_1285)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_1285, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 1285, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_1285, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=1285;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_1285;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=266;
DECLARE @n2_266 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_266)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_266, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 266, 'Adjustment', -6244.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_266, 'Adjustment', 6244.0, 6244.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=266;
UPDATE WarehouseInventory SET QuantityOnHand=6244.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_266;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701500000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=267;
DECLARE @n2_267 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701500000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_267)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_267, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 267, 'Adjustment', -4368.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_267, 'Adjustment', 4368.0, 4368.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=267;
UPDATE WarehouseInventory SET QuantityOnHand=4368.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_267;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701700000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=949;
DECLARE @n2_949 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701700000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_949)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_949, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 949, 'Adjustment', -805.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_949, 'Adjustment', 805.0, 805.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=949;
UPDATE WarehouseInventory SET QuantityOnHand=805.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_949;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701800000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=950;
DECLARE @n2_950 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701800000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_950)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_950, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 950, 'Adjustment', -1390.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_950, 'Adjustment', 1390.0, 1390.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=950;
UPDATE WarehouseInventory SET QuantityOnHand=1390.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_950;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321703000000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=954;
DECLARE @n2_954 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321703000000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_954)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_954, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 954, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_954, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=954;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_954;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321703100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=955;
DECLARE @n2_955 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321703100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_955)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_955, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 955, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_955, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=955;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_955;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321703200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=276;
DECLARE @n2_276 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321703200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_276)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_276, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 276, 'Adjustment', -1248.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_276, 'Adjustment', 1248.0, 1248.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=276;
UPDATE WarehouseInventory SET QuantityOnHand=1248.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_276;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321703400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=956;
DECLARE @n2_956 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321703400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_956)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_956, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 956, 'Adjustment', -50.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_956, 'Adjustment', 50.0, 50.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=956;
UPDATE WarehouseInventory SET QuantityOnHand=50.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_956;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT322100100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=957;
DECLARE @n2_957 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT322100100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_957)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_957, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 957, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_957, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=957;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_957;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT322100700000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=960;
DECLARE @n2_960 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT322100700000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_960)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_960, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 960, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_960, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=960;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_960;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=315;
DECLARE @n2_315 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_315)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_315, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 315, 'Adjustment', -1678.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_315, 'Adjustment', 1678.0, 1678.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=315;
UPDATE WarehouseInventory SET QuantityOnHand=1678.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_315;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300500000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=316;
DECLARE @n2_316 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300500000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_316)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_316, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 316, 'Adjustment', -9040.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_316, 'Adjustment', 9040.0, 9040.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=316;
UPDATE WarehouseInventory SET QuantityOnHand=9040.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_316;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300600000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=317;
DECLARE @n2_317 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300600000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_317)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_317, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 317, 'Adjustment', -79200.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_317, 'Adjustment', 79200.0, 79200.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=317;
UPDATE WarehouseInventory SET QuantityOnHand=79200.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_317;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300700000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=1058;
DECLARE @n2_1058 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300700000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_1058)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_1058, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 1058, 'Adjustment', -300.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_1058, 'Adjustment', 300.0, 300.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=1058;
UPDATE WarehouseInventory SET QuantityOnHand=300.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_1058;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420706200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=1478;
DECLARE @n2_1478 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420706200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_1478)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_1478, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 1478, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_1478, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=1478;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_1478;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT760100200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=339;
DECLARE @n2_339 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT760100200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_339)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_339, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 339, 'Adjustment', -369.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_339, 'Adjustment', 369.0, 369.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=339;
UPDATE WarehouseInventory SET QuantityOnHand=369.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_339;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT760100300000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=340;
DECLARE @n2_340 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT760100300000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_340)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_340, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 340, 'Adjustment', -125.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_340, 'Adjustment', 125.0, 125.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=340;
UPDATE WarehouseInventory SET QuantityOnHand=125.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_340;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT760100400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=341;
DECLARE @n2_341 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT760100400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_341)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_341, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 341, 'Adjustment', -23822.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_341, 'Adjustment', 23822.0, 23822.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=341;
UPDATE WarehouseInventory SET QuantityOnHand=23822.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_341;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140100600000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=796;
DECLARE @n2_796 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140100600000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_796)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_796, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 796, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_796, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=796;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_796;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140100700000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=175;
DECLARE @n2_175 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140100700000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_175)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_175, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 175, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_175, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=175;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_175;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140100800000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=176;
DECLARE @n2_176 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140100800000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_176)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_176, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 176, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_176, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=176;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_176;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140101500000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=177;
DECLARE @n2_177 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140101500000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_177)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_177, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 177, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_177, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=177;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_177;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT320900200000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=252;
DECLARE @n2_252 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT320900200000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_252)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_252, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 252, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_252, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=252;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_252;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321600400000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=262;
DECLARE @n2_262 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321600400000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_262)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_262, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 262, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_262, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=262;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_262;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321600500000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=934;
DECLARE @n2_934 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321600500000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_934)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_934, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 934, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_934, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=934;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_934;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321600600000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=935;
DECLARE @n2_935 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321600600000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_935)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_935, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 935, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_935, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=935;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_935;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321600700000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=937;
DECLARE @n2_937 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321600700000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_937)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_937, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 937, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_937, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=937;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_937;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT322200400000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=279;
DECLARE @n2_279 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT322200400000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=2 AND CommodityId=@n2_279)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (2, @n2_279, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (2, 279, 'Adjustment', -44613.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (2, @n2_279, 'Adjustment', 44613.0, 44613.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=279;
UPDATE WarehouseInventory SET QuantityOnHand=44613.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=2 AND CommodityId=@n2_279;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'41104102000020' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=61;
DECLARE @n3_61 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'41104102000020' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_61)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_61, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 61, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_61, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=61;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_61;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140100700000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=175;
DECLARE @n3_175 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140100700000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_175)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_175, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 175, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_175, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=175;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_175;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT140100800000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=176;
DECLARE @n3_176 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT140100800000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_176)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_176, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 176, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_176, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=176;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_176;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321500300000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=255;
DECLARE @n3_255 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321500300000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_255)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_255, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 255, 'Adjustment', -1000.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_255, 'Adjustment', 1000.0, 1000.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=255;
UPDATE WarehouseInventory SET QuantityOnHand=1000.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_255;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=266;
DECLARE @n3_266 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_266)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_266, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 266, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_266, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=266;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_266;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701500000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=267;
DECLARE @n3_267 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701500000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_267)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_267, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 267, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_267, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=267;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_267;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321701600000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=268;
DECLARE @n3_268 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321701600000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_268)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_268, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 268, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_268, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=268;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_268;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321703200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=276;
DECLARE @n3_276 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321703200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_276)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_276, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 276, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_276, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=276;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_276;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT322100200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=277;
DECLARE @n3_277 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT322100200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_277)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_277, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 277, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_277, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=277;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_277;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=315;
DECLARE @n3_315 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_315)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_315, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 315, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_315, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=315;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_315;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300500000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=316;
DECLARE @n3_316 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300500000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_316)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_316, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 316, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_316, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=316;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_316;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420300600000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=317;
DECLARE @n3_317 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420300600000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_317)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_317, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 317, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_317, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=317;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_317;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420400100000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=318;
DECLARE @n3_318 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420400100000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_318)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_318, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 318, 'Adjustment', -700.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_318, 'Adjustment', 700.0, 700.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=318;
UPDATE WarehouseInventory SET QuantityOnHand=700.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_318;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420401200000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=319;
DECLARE @n3_319 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420401200000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_319)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_319, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 319, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_319, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=319;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_319;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420401400000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=321;
DECLARE @n3_321 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420401400000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_321)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_321, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 321, 'Adjustment', -3000.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_321, 'Adjustment', 3000.0, 3000.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=321;
UPDATE WarehouseInventory SET QuantityOnHand=3000.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_321;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT420401300000' AND UPPER(Category)=N'PROMED')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'PROMED', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=320;
DECLARE @n3_320 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT420401300000' AND UPPER(Category)=N'PROMED');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_320)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_320, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 320, 'Adjustment', -500.0, 0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved to PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_320, 'Adjustment', 500.0, 500.0, 'Stock count 2026-11-02: counted on the PROMED sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=320;
UPDATE WarehouseInventory SET QuantityOnHand=500.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_320;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321500900000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=258;
DECLARE @n3_258 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321500900000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_258)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_258, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 258, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_258, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from ACCESS record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=258;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_258;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT321600400000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=262;
DECLARE @n3_262 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT321600400000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_262)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_262, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 262, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_262, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=262;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_262;

IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code=N'RT322200400000' AND UPPER(Category)=N'SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, N'SEBENZANI', UnitOfMeasure, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=279;
DECLARE @n3_279 INT = (SELECT TOP 1 Id FROM Commodities WHERE Code=N'RT322200400000' AND UPPER(Category)=N'SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@n3_279)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt) VALUES (3, @n3_279, 0, '2026-11-02 23:59:59', SYSUTCDATETIME(), SYSUTCDATETIME());
INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt) VALUES
 (3, 279, 'Adjustment', -0.0, 0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved to SEBENZANI record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME()),
 (3, @n3_279, 'Adjustment', 0.0, 0.0, 'Stock count 2026-11-02: counted on the SEBENZANI sheet - moved from PROMED record', 'COUNT-2026-11-02-RELABEL', 'Approved', 'Stock count import', SYSUTCDATETIME());
UPDATE WarehouseInventory SET QuantityOnHand=0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=279;
UPDATE WarehouseInventory SET QuantityOnHand=0.0, LastCountDate='2026-11-02 23:59:59', UpdatedAt=SYSUTCDATETIME() WHERE WarehouseId=3 AND CommodityId=@n3_279;
COMMIT;