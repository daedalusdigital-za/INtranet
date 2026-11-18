-- Fill unpriced stock lines from old contract price lists (prices supplied incl. 15% VAT;
-- stored excl. VAT to match the Sage-invoice-derived UnitPrice column).
-- Only touches lines where UnitPrice IS NULL. Re-runnable.
SET NOCOUNT ON;
DECLARE @vat decimal(9,4) = 1.15;

DECLARE @p TABLE (Code nvarchar(50), Company nvarchar(50), Contract nvarchar(50), PriceIncl decimal(18,2), Uom nvarchar(50));
INSERT INTO @p VALUES
('3018161000000','ACCESS','RT14-2022',400.24,'EACH'),
('3030045','ACCESS','ZNB6685/1/2021-H',222.79,'PER UNIT'),
('RT25306002','ACCESS','RT253-2021',5.29,'EACH'),
('RT25306006','ACCESS','RT253-2021',5.29,'EACH'),
('RT25306009','ACCESS','RT253-2021',5.29,'EACH'),
('RT25306011','ACCESS','RT253-2021',5.29,'EACH'),
('RT25306015','ACCESS','RT253-2021',5.65,'EACH'),
('RT25306030','ACCESS','RT253-2021',15.84,'EACH'),
('RT25306034','ACCESS','RT253-2021',6.66,'EACH'),
('RT25306036','ACCESS','RT253-2021',6.66,'EACH'),
('RT25306037','ACCESS','RT253-2021',6.66,'EACH'),
('RT25307013','ACCESS','RT253-2021',1.57,'EACH'),
('RT25308006','ACCESS','RT253-2021',7.96,'EACH'),
('RT25310040','ACCESS','RT253-2021',798.82,'EACH'),
('RT25311002','ACCESS','RT253-2021',116.08,'EACH'),
('RT25313013','ACCESS','RT253-2021',19.51,'EACH'),
('RT25313020','ACCESS','RT253-2021',28.96,'EACH'),
('RT25313024','ACCESS','RT253-2021',35.24,'EACH'),
('RT25313030','ACCESS','RT253-2021',35.24,'EACH'),
('RT25313031','ACCESS','RT253-2021',25.81,'EACH'),
('RT25313034','ACCESS','RT253-2021',35.24,'EACH'),
('RT25313035','ACCESS','RT253-2021',25.81,'EACH'),
('RT25315004','ACCESS','RT253-2021',1237.30,'EACH'),
('RT25316002','ACCESS','RT253-2021',866.11,'EACH'),
('RT25316010','ACCESS','RT253-2021',866.11,'EACH'),
('RT25316012','ACCESS','RT253-2021',866.11,'EACH'),
('RT4201047','ACCESS','RT42-2021',0.60,'EACH'),
('RT4201067','ACCESS','RT42-2021',2.36,'EACH'),
('RT420123500000','PROMED','RT42-2021',7.02,'EACH'),
('RT420123600000','PROMED','RT42-2021',7.28,'EACH'),
('RT420123700000','PROMED','RT42-2021',7.68,'EACH'),
('STG10000000000','PROMED','ZNB 2025 (gloves)',615.12,'BOX/50 PAIRS'),
('STG60000000000','PROMED','ZNB 2025 (gloves)',615.12,'BOX/50 PAIRS'),
('STG70000000000','PROMED','ZNB 2025 (gloves)',615.12,'BOX/50 PAIRS'),
('3901254','SEBENZANI','ZNB6745-2019-H',281.52,'PACK/50'),
('4008014','SEBENZANI','ZNB5131/2021-H',228.09,'BOX/25'),
('412701','SEBENZANI','ZNB5083-2020-H',450.17,'PACK/144'),
('412703','SEBENZANI','ZNB5083-2020-H',450.17,'PACK/144');

-- Preview
SELECT c.Code, c.Category AS Company, w.Name AS Warehouse, wi.QuantityOnHand, p.PriceIncl, CAST(ROUND(p.PriceIncl / @vat, 2) AS decimal(18,2)) AS PriceExcl, p.Uom, p.Contract
FROM WarehouseInventory wi
JOIN Commodities c ON c.Id = wi.CommodityId
JOIN Warehouses w ON w.Id = wi.WarehouseId
JOIN @p p ON p.Code = c.Code AND p.Company = c.Category
WHERE wi.UnitPrice IS NULL
ORDER BY c.Code, w.Name;

-- Apply
UPDATE wi
SET wi.UnitPrice = CAST(ROUND(p.PriceIncl / @vat, 2) AS decimal(18,2)),
    wi.UpdatedAt = SYSUTCDATETIME()
FROM WarehouseInventory wi
JOIN Commodities c ON c.Id = wi.CommodityId
JOIN @p p ON p.Code = c.Code AND p.Company = c.Category
WHERE wi.UnitPrice IS NULL;
PRINT CONCAT('Lines priced: ', @@ROWCOUNT);

-- Any list codes that did not match a stock line
SELECT p.Code, p.Company AS NotFoundInStock FROM @p p
WHERE NOT EXISTS (SELECT 1 FROM Commodities c WHERE c.Code = p.Code AND c.Category = p.Company);

SELECT COUNT(*) AS StillUnpriced FROM WarehouseInventory WHERE UnitPrice IS NULL;
