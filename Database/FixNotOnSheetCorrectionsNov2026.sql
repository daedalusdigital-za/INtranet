-- Corrections after the NOTONSHEET zeroing pass (sheets are authoritative).
-- 1) Rows zeroed by normalised code that ARE on a sheet -> restore to sheet qty.
-- 2) Three genuinely uncounted rows -> 0.
-- 3) FIN03000000000 in CPT: sheet says Promed 0 / Sebenzani 72 -> split.
SET NOCOUNT ON; SET XACT_ABORT ON;
BEGIN TRAN;

-- Sebenzani sibling for FIN03000000000
IF NOT EXISTS (SELECT 1 FROM Commodities WHERE Code='FIN03000000000' AND Category='SEBENZANI')
INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT Name, Code, Description, 'SEBENZANI', '6 rolls', 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME() FROM Commodities WHERE Id=113;
DECLARE @seb INT = (SELECT Id FROM Commodities WHERE Code='FIN03000000000' AND Category='SEBENZANI');
IF NOT EXISTS (SELECT 1 FROM WarehouseInventory WHERE WarehouseId=3 AND CommodityId=@seb)
INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, CreatedAt, UpdatedAt) VALUES (3, @seb, 0, SYSUTCDATETIME(), SYSUTCDATETIME());

-- Targets: (WarehouseId, Code, Category, TargetQty)
CREATE TABLE #t (WarehouseId INT, Code NVARCHAR(100), Category NVARCHAR(100), Target DECIMAL(18,2));
INSERT INTO #t VALUES
 (2,'RT420204000000','PROMED',1148),
 (3,'M-HP0-001','PHARMACARE',4075),
 (3,'M-HP0-002','PHARMACARE',1500),
 (3,'R-HP0-001','PHARMACARE',1444),
 (4,'4228190200037','ACCESS',229),
 (4,'M-HP0-001','PHARMACARE',744),
 (1,'JELLY-LUB-2.5G','PHARMACARE',0),
 (1,'BSM7224_2','SEBENZANI',0),
 (4,'BANDAGE ELASTIC ADHESIVE 100 X 4.5 PROCARE','PROMED',0),
 (3,'FIN03000000000','PROMED',0),
 (3,'FIN03000000000','SEBENZANI',72);

SELECT t.WarehouseId, c.Id CommodityId, wi.QuantityOnHand OldQty, t.Target
INTO #z
FROM #t t
JOIN Commodities c ON c.Code=t.Code AND UPPER(c.Category)=t.Category
JOIN WarehouseInventory wi ON wi.WarehouseId=t.WarehouseId AND wi.CommodityId=c.Id
WHERE wi.QuantityOnHand <> t.Target;

SELECT * FROM #z;

INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt)
SELECT WarehouseId, CommodityId, 'Adjustment', Target-OldQty, Target,
       'Stock count 2026-11-02: correction to count sheet quantity',
       'COUNT-2026-11-02-FIX', 'Approved', 'Stock count import', SYSUTCDATETIME()
FROM #z;

UPDATE wi SET QuantityOnHand=z.Target, LastCountDate='2026-11-02', UpdatedAt=SYSUTCDATETIME()
FROM WarehouseInventory wi JOIN #z z ON z.WarehouseId=wi.WarehouseId AND z.CommodityId=wi.CommodityId;

DROP TABLE #t; DROP TABLE #z;
COMMIT;

SELECT w.Name, SUM(CASE WHEN wi.QuantityOnHand<>0 THEN 1 ELSE 0 END) NonZero, SUM(wi.QuantityOnHand) Qty
FROM WarehouseInventory wi JOIN Warehouses w ON w.Id=wi.WarehouseId GROUP BY w.Name ORDER BY w.Name;
