-- KZN DAMAGED-EXPIRED tab (Nov 2026 count) -> company DAMAGED-EXPIRED, warehouse 1
SET NOCOUNT ON; SET XACT_ABORT ON; BEGIN TRAN;
CREATE TABLE #d (Code NVARCHAR(100), Name NVARCHAR(200), Descr NVARCHAR(500), Uom NVARCHAR(20), Qty DECIMAL(18,2), Tag NVARCHAR(20));
INSERT INTO #d VALUES
('DE-3912655','[DAMAGED] DRAW SHEETS DISPOSABLE 1mtr X 1.56mtr (Tender spec)','DAMAGED stock, originally ACCESS code 3912655: DRAW SHEETS DISPOSABLE 1mtr X 1.56mtr (Tender spec)','100',59.0,'DAMAGED'),
('DE-RT321700800000','[EXPIRED] Hospital Gown Child 3yrs - 6 yrs','EXPIRED stock, originally PROMED code RT321700800000: Hospital Gown Child 3yrs - 6 yrs','Each',150.0,'EXPIRED'),
('DE-LUBRICATINGJELLY50GTUBE','[EXPIRED] LUBRICATING JELLY - 50G TUBE','EXPIRED stock, originally PHARMACARE code n/a: LUBRICATING JELLY - 50G TUBE','Pcs',528.0,'EXPIRED'),
('DE-RT321700200000','[EXPIRED] Disposable Isolation Gown Size Medium','EXPIRED stock, originally PROMED code RT321700200000: Disposable Isolation Gown Size Medium','Each',210.0,'EXPIRED'),
('DE-RT321700600000','[EXPIRED] Disposable Isolation Gown Size XXX-Large','EXPIRED stock, originally PROMED code RT321700600000: Disposable Isolation Gown Size XXX-Large','Each',100.0,'EXPIRED'),
('DE-RT420700100000','[EXPIRED] Surgical Drape U-Slot 1200mm x 1300mm','EXPIRED stock, originally PROMED code RT420700100000: Surgical Drape U-Slot 1200mm x 1300mm','Each',40.0,'EXPIRED'),
('DE-RT321702300000','[EXPIRED] Basic Surgical Gown Size X-Large','EXPIRED stock, originally PROMED code RT321702300000: Basic Surgical Gown Size X-Large','Each',100.0,'EXPIRED'),
('DE-RT321701700000','[EXPIRED] Surgical Gown Reinforced Size X-Large','EXPIRED stock, originally PROMED code RT321701700000: Surgical Gown Reinforced Size X-Large','Each',20.0,'EXPIRED'),
('DE-RT321701600000','[EXPIRED] Surgical Gown Reinforced Size Large','EXPIRED stock, originally PROMED code RT321701600000: Surgical Gown Reinforced Size Large','Each',20.0,'EXPIRED'),
('DE-RT321600500001','[EXPIRED] INFANT DIAPER MEDIUM LOCAL','EXPIRED stock, originally ACCESS code RT321600500001: INFANT DIAPER MEDIUM LOCAL','each',1900.0,'EXPIRED'),
('DE-RT420700100000','[EXPIRED] Surgical Drape U-Slot 1200mm x 1300mm','EXPIRED stock, originally PROMED code RT420700100000: Surgical Drape U-Slot 1200mm x 1300mm','Each',1173.0,'EXPIRED'),
('DE-RT760100500000','[DAMAGED] NITRILE EXAM GLOVES P/FREE N/S SMALL','DAMAGED stock, originally PROMED code RT760100500000: NITRILE EXAM GLOVES P/FREE N/S SMALL','BOX',5.0,'DAMAGED'),
('DE-RT298010160000','[DAMAGED] BROWN BAG RECTANGULAR X-LARGE','DAMAGED stock, originally PROMED code RT298010160000: BROWN BAG RECTANGULAR X-LARGE','500Pack',13.0,'DAMAGED'),
('DE-30392070000000','[DAMAGED] HYPODERMIC NEEDLE 23G 32MM 1 1/4 BLUE','DAMAGED stock, originally PROMED code 30392070000000: HYPODERMIC NEEDLE 23G 32MM 1 1/4 BLUE','100Pack',107.0,'DAMAGED'),
('DE-NUTRIMILLFIBRE1KGVANILLAPURPLESTICKER','[SHORT-DATED] NUTRI MILL FIBRE 1KG VANILLA (PURPLE STICKER)','SHORT-DATED stock, originally PHARMACARE code n/a: NUTRI MILL FIBRE 1KG VANILLA (PURPLE STICKER)','packs',55.0,'SHORT-DATED'),
('DE-RT321702200000','[EXPIRED] Basic Surgical Gown Size Large','EXPIRED stock, originally PROMED code RT321702200000: Basic Surgical Gown Size Large','Each',800.0,'EXPIRED'),
('DE-RT321702300000','[EXPIRED] Basic Surgical Gown Size X-Large','EXPIRED stock, originally PROMED code RT321702300000: Basic Surgical Gown Size X-Large','Each',680.0,'EXPIRED');

-- same code listed twice on the sheet (e.g. U-slot drape 40 + 1173) -> one item, summed
SELECT Code, MIN(Name) Name, MIN(Descr) Descr, MIN(Uom) Uom, SUM(Qty) Qty, MIN(Tag) Tag INTO #a FROM #d GROUP BY Code;

INSERT INTO Commodities (Name, Code, Description, Category, UnitOfMeasure, RequiresRefrigeration, IsFragile, IsHazardous, CreatedAt, UpdatedAt)
SELECT a.Name, a.Code, a.Descr, 'DAMAGED-EXPIRED', a.Uom, 0, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
FROM #a a WHERE NOT EXISTS (SELECT 1 FROM Commodities c WHERE c.Code = a.Code AND c.Category = 'DAMAGED-EXPIRED');

INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt)
SELECT 1, c.Id, 'Receive', a.Qty, a.Qty, 'Nov 2026 count: KZN DAMAGED-EXPIRED sheet (' + a.Tag + ')', 'COUNT-2026-11-02', 'Approved', 'Stock count import', SYSUTCDATETIME()
FROM #a a JOIN Commodities c ON c.Code = a.Code AND c.Category = 'DAMAGED-EXPIRED'
WHERE NOT EXISTS (SELECT 1 FROM WarehouseInventory i WHERE i.WarehouseId = 1 AND i.CommodityId = c.Id);

INSERT INTO WarehouseInventory (WarehouseId, CommodityId, QuantityOnHand, LastCountDate, CreatedAt, UpdatedAt)
SELECT 1, c.Id, a.Qty, '2026-11-02', SYSUTCDATETIME(), SYSUTCDATETIME()
FROM #a a JOIN Commodities c ON c.Code = a.Code AND c.Category = 'DAMAGED-EXPIRED'
WHERE NOT EXISTS (SELECT 1 FROM WarehouseInventory i WHERE i.WarehouseId = 1 AND i.CommodityId = c.Id);

DROP TABLE #a; DROP TABLE #d; COMMIT;
SELECT c.Code, c.Name, i.QuantityOnHand FROM WarehouseInventory i JOIN Commodities c ON c.Id = i.CommodityId WHERE c.Category = 'DAMAGED-EXPIRED' ORDER BY c.Name;
