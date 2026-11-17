-- Second manual price-list pass 2026-11-17 (Promed / Sebenzani / cross-supplier matches). Prices incl 15% VAT -> stored ex-VAT.
SET NOCOUNT ON;
DECLARE @p TABLE (Company nvarchar(20), Code nvarchar(50), PriceIncl decimal(18,2), Status nvarchar(30));
INSERT INTO @p VALUES
-- Matched
('PROMED','RT296150170000',111.53,'Matched'),('PROMED','RT296290630000',34.56,'Matched'),('PROMED','RT296340250000',56.37,'Matched'),
('PROMED','RT321100400000',21.91,'Matched'),('PROMED','RT321700800000',5.76,'Matched'),('PROMED','RT321701000000',6.34,'Matched'),
('PROMED','RT321702400000',18.79,'Matched'),('PROMED','RT420402300000',1.96,'Matched'),('PROMED','RT420700300000',66.65,'Matched'),
('PROMED','RT420703100001',51.46,'Matched'),('PROMED','RT420703800001',60.00,'Matched'),('PROMED','RT420705500000',64.19,'Matched'),
('PROMED','RT420705600000',62.17,'Matched'),('PROMED','RT420705700000',56.96,'Matched'),('PROMED','RT421800100000',4.03,'Matched'),
('PROMED','RT421800200000',9.39,'Matched'),('PROMED','RT421800700000',5.43,'Matched'),('PROMED','RT421800800000',14.38,'Matched'),
('PROMED','RT421800900000',46.41,'Matched'),('PROMED','RT421801100000',28.01,'Matched'),('PROMED','RT421900200000',51.32,'Matched'),
('PROMED','RT421900300000',64.31,'Matched'),('PROMED','RT760201500000',598.02,'Matched'),
('SEBENZANI','RT420118300000',15.88,'Matched'),('SEBENZANI','RT421900200000',52.78,'Matched'),('SEBENZANI','RT421900300000',66.15,'Matched'),
-- Possible - check
('PROMED','14111704000040',56.46,'Possible'),('PROMED','42192614000080',98.50,'Possible'),('PROMED','42192614000110',394.92,'Possible'),
('PROMED','RT320102100000',0.50,'Possible'),('PROMED','RT410100100000',11.69,'Possible'),('PROMED','RT420703200000',96.06,'Possible'),
('PROMED','SS840000000000',56.50,'Possible'),
-- Other supplier's price
('ACCESS','3002807',0.50,'OtherSupplier'),('ACCESS','RT420203700001',2.08,'OtherSupplier'),('ACCESS','RT4218008',14.38,'OtherSupplier'),
('PHARMACARE','S-CER-002',2.84,'OtherSupplier'),('PHARMACARE','S-CER-008',2.84,'OtherSupplier'),('PROMED','4214252100001',0.52,'OtherSupplier'),
('PROMED','PRO00120070000',0.23,'OtherSupplier'),('PROMED','RT420116300000',2.51,'OtherSupplier'),('PROMED','RT420119100000',1.51,'OtherSupplier'),
('SEBENZANI','3901010',67.00,'OtherSupplier'),('SEBENZANI','TABLET01',62.83,'OtherSupplier');

UPDATE wi
   SET wi.UnitPrice = ROUND(p.PriceIncl / 1.15, 2), wi.UpdatedAt = SYSUTCDATETIME()
  FROM WarehouseInventory wi
  JOIN Commodities c ON c.Id = wi.CommodityId
  JOIN @p p ON p.Code = c.Code AND p.Company = c.Category;
PRINT CONCAT('Lines updated: ', @@ROWCOUNT);

-- rows that hit nothing
SELECT p.Company, p.Code, p.PriceIncl
  FROM @p p
 WHERE NOT EXISTS (SELECT 1 FROM Commodities c JOIN WarehouseInventory wi ON wi.CommodityId=c.Id WHERE c.Code=p.Code AND c.Category=p.Company);
