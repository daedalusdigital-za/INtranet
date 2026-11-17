-- Manual price-list match supplied 2026-11-17 (prices incl. 15% VAT -> stored ex-VAT on WarehouseInventory.UnitPrice)
SET NOCOUNT ON;
DECLARE @p TABLE (Code nvarchar(50), PriceIncl decimal(18,2), Status nvarchar(20));
INSERT INTO @p VALUES
('42142502000280',3.65,'Matched'),('42142502000310',6.99,'Matched'),('42142502000360',6.99,'Matched'),('42142521000010',0.52,'Matched'),
('4228180600005',212.65,'Matched'),('4228190200043',199.09,'Matched'),('4228191300990',858.78,'Matched'),('4228191600014',199.01,'Matched'),
('4228191600019',741.64,'Matched'),('RT130202100000',8.29,'Matched'),('RT130802500000',10.18,'Matched'),('RT2101004',1450.09,'Matched'),
('RT2101006',1752.20,'Matched'),('RT2101007',1661.57,'Matched'),('RT2101008',1661.57,'Matched'),('RT2101011',1963.66,'Matched'),
('RT2101023',6555.63,'Matched'),('RT2101024',6555.63,'Matched'),('RT2101025',6555.63,'Matched'),('RT2101026',7099.42,'Matched'),
('RT2101028',845.89,'Matched'),('RT2101031',845.89,'Matched'),('RT2101032',1148.00,'Matched'),('RT2101033',1148.00,'Matched'),
('RT2101039',435.03,'Matched'),('RT2103011',1493.18,'Matched'),('RT253200230000',34.86,'Matched'),('RT253200250000',34.86,'Matched'),
('RT253210470000',1.00,'Matched'),('RT253210490000',1.02,'Matched'),('RT253210540000',1.11,'Matched'),('RT253210710000',1.31,'Matched'),
('RT253210780000',1.31,'Matched'),('RT253300010000',3.62,'Matched'),('RT253300020000',3.62,'Matched'),('RT253300030000',3.62,'Matched'),
('RT420100600000',10.83,'Matched'),('RT420104500000',0.63,'Matched'),('RT420104700000',2.10,'Matched'),('RT420105100000',2.67,'Matched'),
('RT420108700000',3.03,'Matched'),('RT420109400000',5.10,'Matched'),('RT4201163',2.51,'Matched'),('RT4201166',13.76,'Matched'),
('RT420118200000',7.00,'Matched'),('RT420118500000',1.51,'Matched'),('RT420701000000',14.27,'Matched'),('RT420701200000',20.62,'Matched'),
('RT4207016',27.51,'Matched'),('RT420701600000',27.51,'Matched'),('RT420702100000',119.38,'Matched'),('RT420702600000',39.59,'Matched'),
('RT420703000000',67.18,'Matched'),('RT420703100000',52.21,'Matched'),('RT420703400000',97.46,'Matched'),('RT420703800000',60.87,'Matched'),
('RT420703900000',71.00,'Matched'),('RT420704000000',48.37,'Matched'),('RT420704100000',63.04,'Matched'),('RT420704700000',10.87,'Matched'),
('RT420705300000',93.47,'Matched'),('RT420801600000',6.39,'Matched'),('RT420801800000',4.58,'Matched'),('RT4212002',3.69,'Matched'),
('RT421700100000',2.54,'Matched'),('RT4218001',4.09,'Matched'),('RT4218002',9.53,'Matched'),('RT421800300000',18.95,'Matched'),
('RT421800400000',21.46,'Matched'),('RT4218007',5.50,'Matched'),('RT4219002',52.06,'Matched'),('RT4219003',65.25,'Matched'),
-- "Possible - check" rows
('4210247',297.00,'Possible'),('4713171000008',135.53,'Possible'),('RT2101044',543.79,'Possible'),('RT2101048',1885.12,'Possible'),
('RT2103001',671.64,'Possible'),('RT2103002',868.04,'Possible'),('RT210300700001',1960.99,'Possible'),('RT25316006',803.48,'Possible'),
('RT25316008',803.48,'Possible'),('RT420101000000',67.25,'Possible'),('RT4201045',5.51,'Possible'),('RT4201046',8.30,'Possible'),
('RT4201169',6.70,'Possible'),('RT4202043',21.44,'Possible'),('RT4202044',26.73,'Possible');

UPDATE wi
   SET wi.UnitPrice = ROUND(p.PriceIncl / 1.15, 2), wi.UpdatedAt = SYSUTCDATETIME()
  FROM WarehouseInventory wi
  JOIN Commodities c ON c.Id = wi.CommodityId
  JOIN @p p ON p.Code = c.Code;
PRINT CONCAT('Lines updated: ', @@ROWCOUNT);

SELECT p.Code, p.Status, p.PriceIncl, ROUND(p.PriceIncl/1.15,2) PriceExcl,
       COUNT(wi.Id) Lines, ISNULL(SUM(wi.QuantityOnHand),0) Qty
  FROM @p p
  LEFT JOIN Commodities c ON c.Code = p.Code
  LEFT JOIN WarehouseInventory wi ON wi.CommodityId = c.Id
 GROUP BY p.Code, p.Status, p.PriceIncl
HAVING COUNT(wi.Id) = 0
 ORDER BY p.Code;
