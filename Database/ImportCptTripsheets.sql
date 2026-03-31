-- CPT Tripsheet Import Script
-- Generated from 'CPT TRIPSHEET 2026' folder
-- Skipping 4 files (already in DB or duplicates)
-- Cape Town Warehouse ID = 3

BEGIN TRANSACTION;

-- JIM 03.02.26.xlsx: Driver=JIM, Date=03,02,26, Invoices=4 (new=2)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000373', 3, 30, 'Delivered', '2026-02-03', GETDATE(), GETDATE());

-- Link 2 new invoices to RF-000373
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000373')
WHERE TransactionNumber IN ('IN162778','IN160026')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- JIM 05.01.26.xlsx: Driver=JIM, Date=05,01,26, Invoices=1 (new=1)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000374', 3, 30, 'Delivered', '2026-01-05', GETDATE(), GETDATE());

-- Link 1 new invoices to RF-000374
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000374')
WHERE TransactionNumber IN ('IN161054')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- JIM 09.01.26.xlsx: Driver=JIM, Date=09,01,26, Invoices=3 (new=3)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000375', 3, 30, 'Delivered', '2026-01-09', GETDATE(), GETDATE());

-- Link 3 new invoices to RF-000375
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000375')
WHERE TransactionNumber IN ('IN161946','IN161954','IN142853')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- JIM 28.01.26.xlsx: Driver=JIM, Date=28,01,26, Invoices=6 (new=1)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000376', 3, 30, 'Delivered', '2026-01-28', GETDATE(), GETDATE());

-- Link 1 new invoices to RF-000376
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000376')
WHERE TransactionNumber IN ('IN161158')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- JIM 29.01.26.xlsx: Driver=JIM, Date=29,01,2026, Invoices=5 (new=5)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000377', 3, 30, 'Delivered', '2026-01-29', GETDATE(), GETDATE());

-- Link 5 new invoices to RF-000377
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000377')
WHERE TransactionNumber IN ('IN162386','IN142047','IN162173','IN162385','IN161838')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- LUNGELO & SIHLE 28.01.26.xlsx: Driver=LUNGELO & SIHLE, Date=28,01,26, Invoices=1 (new=1)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000378', 3, 1, 'Delivered', '2026-01-28', GETDATE(), GETDATE());

-- Link 1 new invoices to RF-000378
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000378')
WHERE TransactionNumber IN ('IN162311')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- LUNGELO 06.02.2026.xlsx: Driver=LUNGELO, Date=06,02,26, Invoices=7 (new=3)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000379', 3, 1, 'Delivered', '2026-02-06', GETDATE(), GETDATE());

-- Link 3 new invoices to RF-000379
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000379')
WHERE TransactionNumber IN ('IN162586','IN143260','IN162498')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- LUNGELO 19.01.26.xlsx: Driver=LUNGELO, Date=19,01,26, Invoices=12 (new=9)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000380', 3, 1, 'Delivered', '2026-01-19', GETDATE(), GETDATE());

-- Link 9 new invoices to RF-000380
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000380')
WHERE TransactionNumber IN ('IN162351','IN162027','IN162046','IN162040','IN304528','IN142918','IN162174','IN162176','IN162034')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- LUNGELO 20.01.26.xlsx: Driver=LUNGELO, Date=20,01,26, Invoices=9 (new=4)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000381', 3, 1, 'Delivered', '2026-01-20', GETDATE(), GETDATE());

-- Link 4 new invoices to RF-000381
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000381')
WHERE TransactionNumber IN ('IN142787','IN161820','IN162039','IN162042')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- LUNGELO 22.01.2026.xlsx: Driver=LUNGELO, Date=22,01,26, Invoices=10 (new=4)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000382', 3, 1, 'Delivered', '2026-01-22', GETDATE(), GETDATE());

-- Link 4 new invoices to RF-000382
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000382')
WHERE TransactionNumber IN ('IN154425','IN161823','IN162020','IN162352')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- LUNGELO 27.01.26.xlsx: Driver=LUNGELO, Date=22,01,26, Invoices=4 (new=1)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000383', 3, 1, 'Delivered', '2026-01-22', GETDATE(), GETDATE());

-- Link 1 new invoices to RF-000383
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000383')
WHERE TransactionNumber IN ('IN162310')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- LUNGELO 29.01.26.xlsx: Driver=LUNGELO, Date=29,01,2026, Invoices=3 (new=2)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000384', 3, 1, 'Delivered', '2026-01-29', GETDATE(), GETDATE());

-- Link 2 new invoices to RF-000384
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000384')
WHERE TransactionNumber IN ('IN161917','IN162303')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- LUNGELO 30.01.26.xlsx: Driver=LUNGELO, Date=30,01,2026, Invoices=4 (new=4)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000385', 3, 1, 'Delivered', '2026-01-30', GETDATE(), GETDATE());

-- Link 4 new invoices to RF-000385
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000385')
WHERE TransactionNumber IN ('IN162298','IN162307','IN162297','IN162305')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- NATHI 06.01.26.xlsx: Driver=NATHI, Date=06,01,26, Invoices=1 (new=1)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000386', 3, 38, 'Delivered', '2026-01-06', GETDATE(), GETDATE());

-- Link 1 new invoices to RF-000386
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000386')
WHERE TransactionNumber IN ('IN155255')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- NATHI 08.01.26.xlsx: Driver=NATHI, Date=08,01,26, Invoices=3 (new=3)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000387', 3, 38, 'Delivered', '2026-01-08', GETDATE(), GETDATE());

-- Link 3 new invoices to RF-000387
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000387')
WHERE TransactionNumber IN ('IN161953','IN161947','IN023611')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- NATHI 12.01.26.xlsx: Driver=NATHI, Date=12,01,26, Invoices=5 (new=5)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000388', 3, 38, 'Delivered', '2026-01-12', GETDATE(), GETDATE());

-- Link 5 new invoices to RF-000388
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000388')
WHERE TransactionNumber IN ('IN142782','IN161775','IN161492','IN162122','IN161776')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- NATHI 13.01.26.xlsx: Driver=NATHI, Date=13,01,26, Invoices=2 (new=2)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000389', 3, 38, 'Delivered', '2026-01-13', GETDATE(), GETDATE());

-- Link 2 new invoices to RF-000389
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000389')
WHERE TransactionNumber IN ('IN161273','IN160905')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- NATHI 17.12.25 CPT .xlsx: Driver=NATHI, Date=17,12,25, Invoices=7 (new=7)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000390', 3, 38, 'Delivered', '2025-12-17', GETDATE(), GETDATE());

-- Link 7 new invoices to RF-000390
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000390')
WHERE TransactionNumber IN ('IN160146','IN161483','IN160673','IN161019','IN160591','IN161481','IN161407')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- NATHI 20.01.26.xlsx: Driver=NATHI, Date=20,01,26, Invoices=5 (new=5)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000391', 3, 38, 'Delivered', '2026-01-20', GETDATE(), GETDATE());

-- Link 5 new invoices to RF-000391
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000391')
WHERE TransactionNumber IN ('IN161054','IN161945','IN161944','IN161941','IN161670')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- NATHI 21.01.26.xlsx: Driver=NATHI, Date=21,01,2026, Invoices=3 (new=3)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000392', 3, 38, 'Delivered', '2026-01-21', GETDATE(), GETDATE());

-- Link 3 new invoices to RF-000392
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000392')
WHERE TransactionNumber IN ('IN161915','IN162478','IN304552')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- NATHI 22.01.2026.xlsx: Driver=NATHI, Date=22,01,26, Invoices=4 (new=4)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000393', 3, 38, 'Delivered', '2026-01-22', GETDATE(), GETDATE());

-- Link 4 new invoices to RF-000393
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000393')
WHERE TransactionNumber IN ('IN162234','IN143123','IN162545','IN162222')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- NATHI 22.01.26.xlsx: Driver=NATHI, Date=22,01,26, Invoices=5 (new=5)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000394', 3, 38, 'Delivered', '2026-01-22', GETDATE(), GETDATE());

-- Link 5 new invoices to RF-000394
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000394')
WHERE TransactionNumber IN ('IN162479','IN162445','IN162109','IN161669','IN304533')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- SABELO 05.01.26.xlsx: Driver=SABELO, Date=05,01,26, Invoices=6 (new=6)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000395', 3, 32, 'Delivered', '2026-01-05', GETDATE(), GETDATE());

-- Link 6 new invoices to RF-000395
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000395')
WHERE TransactionNumber IN ('IN161405','IN153261','IN158386','IN161157','IN142578','IN153411')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- SABELO 07.01.26.xlsx: Driver=SABELO, Date=07,01,26, Invoices=2 (new=2)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000396', 3, 32, 'Delivered', '2026-01-07', GETDATE(), GETDATE());

-- Link 2 new invoices to RF-000396
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000396')
WHERE TransactionNumber IN ('IN161665','IN161664')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- SABELO 12.01.26.xlsx: Driver=SABELO, Date=12,01,26, Invoices=7 (new=7)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000397', 3, 32, 'Delivered', '2026-01-12', GETDATE(), GETDATE());

-- Link 7 new invoices to RF-000397
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000397')
WHERE TransactionNumber IN ('IN161664','IN161950','IN161948','IN161949','IN161951','IN161952','IN162123')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- SABELO 13.01.26.xlsx: Driver=SABELO, Date=13,01,26, Invoices=3 (new=3)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000398', 3, 32, 'Delivered', '2026-01-13', GETDATE(), GETDATE());

-- Link 3 new invoices to RF-000398
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000398')
WHERE TransactionNumber IN ('IN162144','IN162212','IN162213')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- SABELO 14.01.26.xlsx: Driver=SABELO, Date=14,01,26, Invoices=3 (new=3)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000399', 3, 32, 'Delivered', '2026-01-14', GETDATE(), GETDATE());

-- Link 3 new invoices to RF-000399
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000399')
WHERE TransactionNumber IN ('IN161774','IN162235','IN161777')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

-- ZOLANI 02.02.26.xlsx: Driver=ZOLANI, Date=02,02,26, Invoices=4 (new=4)
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, CreatedAt, UpdatedAt)
VALUES ('RF-000400', 3, 36, 'Delivered', '2026-02-02', GETDATE(), GETDATE());

-- Link 4 new invoices to RF-000400
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000400')
WHERE TransactionNumber IN ('IN162786','IN161916','IN148889','IN162785')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 3));

COMMIT;

-- Summary: 28 tripsheets created, 100 invoice groups linked
-- Load numbers: RF-000373 to RF-000400

-- Verify:
SELECT l.LoadNumber, l.Status, d.FirstName AS Driver, CONVERT(varchar, l.ScheduledDeliveryDate, 23) AS DeliveryDate,
  (SELECT COUNT(*) FROM ImportedInvoices ii WHERE ii.LoadId = l.Id) AS InvoiceCount
FROM Loads l
JOIN Drivers d ON l.DriverId = d.Id
WHERE l.LoadNumber >= 'RF-000373'
ORDER BY l.LoadNumber;