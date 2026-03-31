-- KZN Tripsheet Import Script
-- Generated from 'docs/KZN TRIPSHEET' folder
-- KZN Warehouse ID = 1

BEGIN TRANSACTION;

-- ═══ Insert new drivers ═══
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE FirstName = 'Masiya')
  INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, EmployeeNumber, PhoneNumber, Status, CreatedAt, UpdatedAt)
  VALUES ('Masiya', '-', '-', '-', '-', '-', 'Active', GETDATE(), GETDATE());

IF NOT EXISTS (SELECT 1 FROM Drivers WHERE FirstName = 'Smanga')
  INSERT INTO Drivers (FirstName, LastName, LicenseNumber, LicenseType, EmployeeNumber, PhoneNumber, Status, CreatedAt, UpdatedAt)
  VALUES ('Smanga', '-', '-', '-', '-', '-', 'Active', GETDATE(), GETDATE());

-- Store new driver IDs for use below
DECLARE @MasiyaId INT = (SELECT Id FROM Drivers WHERE FirstName = 'Masiya');
DECLARE @SmangaId INT = (SELECT Id FROM Drivers WHERE FirstName = 'Smanga');

-- ═══ Create Loads and Link Invoices ═══

-- FEBUARY/02.02.26/DURBAN 02.02.26 - Copy.xlsx: Driver=LUCAS, Date=02.02.26, Route=DURBAN, Invoices=12
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000401', 1, 26, 'Delivered', '2026-02-02', 'Route: DURBAN', 'CJ2DBZN', GETDATE(), GETDATE());

-- Link 12 invoices to RF-000401
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000401')
WHERE TransactionNumber IN ('IN162810','IN162808','IN162736','IN162816','IN143181','IN162809','IN162811','IN162775','IN162817','IN162815','IN162734','IN162802')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/02.02.26/DURBAN 02.02.26.xlsx: Driver=NGUBANE, Date=02.02.26, Route=DURBAN, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000402', 1, 24, 'Delivered', '2026-02-02', 'Route: DURBAN', 'BK64KKZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000402
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000402')
WHERE TransactionNumber IN ('IN143185','IN023693','IN162774','IN162793','IN143188','IN162776')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/02.02.26/LADYSMITH ESTCOURT NEWCASTLE 02.02.26.xlsx: Driver=MZILA, Date=02.02.26, Route=LADYSMITH ESTCOURT NEWCASTLE, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000403', 1, 25, 'Delivered', '2026-02-02', 'Route: LADYSMITH ESTCOURT NEWCASTLE', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000403
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000403')
WHERE TransactionNumber IN ('IN162753','IN023694','IN023683','IN162686','IN162695','IN162564','IN162822','IN162680')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/02.02.26/PMB  02.02.26.xlsx: Driver=BUHLE, Date=02.02.26, Route=PMB, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000404', 1, 23, 'Delivered', '2026-02-02', 'Route: PMB', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000404
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000404')
WHERE TransactionNumber IN ('IN143178','IN143177','IN162728','IN162735','IN162733','IN162729','IN162727','IN162732','IN162730')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/02.02.26/PONGOLA MANGUZI  02.02.26.xlsx: Driver=AJ, Date=02.02.26, Route=PONGOLA MANGUZI, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000405', 1, 22, 'Delivered', '2026-02-02', 'Route: PONGOLA MANGUZI', 'BJ87RSZN', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000405
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000405')
WHERE TransactionNumber IN ('IN143183','IN023671','IN162783')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/03.02.26/BIZANA UMTATA LUSIKISIKI  03.02.26.xlsx: Driver=BUHLE, Date=03.02.26, Route=BIZANA UMTATA LUSIKISIKI, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000406', 1, 23, 'Delivered', '2026-02-03', 'Route: BIZANA UMTATA LUSIKISIKI', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000406
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000406')
WHERE TransactionNumber IN ('IN162652','IN162731','IN162638','IN162821','IN142839','IN143142')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/03.02.26/DUNDEE NEWCASTLE VRYHEID  03.02.26.xlsx: Driver=LUCAS, Date=03.02.26, Route=DUNDEE NEWCASTLE VRYHEID, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000407', 1, 26, 'Delivered', '2026-02-03', 'Route: DUNDEE NEWCASTLE VRYHEID', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000407
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000407')
WHERE TransactionNumber IN ('IN143234','IN143229','IN143218','IN142705','IN16277','IN142924','IN143221')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/03.02.26/DURBAN  03.02.26.xlsx: Driver=AJ, Date=03.02.26, Route=DURBAN, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000408', 1, 22, 'Delivered', '2026-02-03', 'Route: DURBAN', 'BJ87RSZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000408
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000408')
WHERE TransactionNumber IN ('IN143228','IN143238','IN142841','IN143259','IN162431','IN143257')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/03.02.26/MTUBATUBA HLABISA 03.02.26.xlsx: Driver=MZILA, Date=03.02.26, Route=MTUBATUBA HLABISA, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000409', 1, 25, 'Delivered', '2026-02-03', 'Route: MTUBATUBA HLABISA', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000409
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000409')
WHERE TransactionNumber IN ('IN162806','IN023677','IN162669','IN162688')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/03.02.26/PMB  03.02.26.xlsx: Driver=NGUBANE, Date=03.02.26, Route=PMB, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000410', 1, 24, 'Delivered', '2026-02-03', 'Route: PMB', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000410
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000410')
WHERE TransactionNumber IN ('IN162820','IN143239','IN162865','IN162854','IN162933','IN162819','IN143232','IN143222','IN162528')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/04.02.26/DURBAN 04.02.26.xlsx: Driver=LUCAS, Date=04.02.26, Route=DURBAN, Invoices=13
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000411', 1, 26, 'Delivered', '2026-02-04', 'Route: DURBAN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 13 invoices to RF-000411
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000411')
WHERE TransactionNumber IN ('IN162529','IN162244','IN143256','IN162752','IN143223','IN143236','IN162863','IN143235','IN162952','IN143226','IN143233','IN162862','IN162853')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/04.02.26/ESHOWE NKANDLA  04.02.26.xlsx: Driver=AJ, Date=04.02.26, Route=ESHOWE NKANDLA, Invoices=12
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000412', 1, 22, 'Delivered', '2026-02-04', 'Route: ESHOWE NKANDLA', 'BJ87RSZN', GETDATE(), GETDATE());

-- Link 12 invoices to RF-000412
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000412')
WHERE TransactionNumber IN ('IN023699','IN162339','IN162803','IN143219','IN162937','IN143241','IN162864','IN162936','IN023690','IN143065','IN143184','IN162938')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/04.02.26/PORTSHEPSTONE GAMALAKHE  04.02.26.xlsx: Driver=MZILA\, Date=04.02.26, Route=PORTSHEPSTONE GAMALAKHE, Invoices=12
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000413', 1, 25, 'Delivered', '2026-02-04', 'Route: PORTSHEPSTONE GAMALAKHE', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 12 invoices to RF-000413
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000413')
WHERE TransactionNumber IN ('IN162818','IN162784','IN143215','IN162855','IN162805','IN023700','IN162957','IN162773','IN162807','IN162859','IN162858','IN162860')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/05.02.26/DURBAN 05.02.26 -.xlsx: Driver=MZILA, Date=05.02.26, Route=DURBAN, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000414', 1, 25, 'Delivered', '2026-02-05', 'Route: DURBAN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000414
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000414')
WHERE TransactionNumber IN ('IN162999','IN143228','IN162968','IN162967','IN163032','IN143306','IN143303','IN162431','IN143299')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/05.02.26/KOKSTAD MATATIELE MT FRERE  05.02.26.xlsx: Driver=AJ, Date=05.02.26, Route=KOKSTAD MATATIELE MT FRERE, Invoices=13
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000415', 1, 22, 'Delivered', '2026-02-05', 'Route: KOKSTAD MATATIELE MT FRERE', 'BJ87RSZN', GETDATE(), GETDATE());

-- Link 13 invoices to RF-000415
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000415')
WHERE TransactionNumber IN ('IN162694','IN142838','IN143067','IN162685','IN143291','IN023615','IN023688','IN161897','IN142952','IN162639','IN162651','IN162684','IN142969')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/05.02.26/PMB  05.02.26.xlsx: Driver=SIYABONGA, Date=05.02.26, Route=PMB, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000416', 1, 18, 'Delivered', '2026-02-05', 'Route: PMB', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000416
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000416')
WHERE TransactionNumber IN ('IN162557','IN162665','IN162561')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/05.02.26/PORT SHEPSTONE 05.02.26.xlsx: Driver=BUHLE, Date=05.02.26, Route=PORT SHEPSTONE, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000417', 1, 23, 'Delivered', '2026-02-05', 'Route: PORT SHEPSTONE', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000417
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000417')
WHERE TransactionNumber IN ('IN162977','IN143258')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/05.02.26/STANGER05.02.26.xlsx: Driver=LUCAS, Date=05.02.26, Route=STANGER, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000418', 1, 26, 'Delivered', '2026-02-05', 'Route: STANGER', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000418
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000418')
WHERE TransactionNumber IN ('IN143301','IN143302')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/06.02.26/DURBAN 06.02.26.xlsx: Driver=BUHLE, Date=06.02.26, Route=DURBAN, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000419', 1, 23, 'Delivered', '2026-02-06', 'Route: DURBAN', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000419
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000419')
WHERE TransactionNumber IN ('IN162529','IN162972','IN143320','IN143318','IN143223','IN143321','IN143226','IN143233','IN163045')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/06.02.26/EMP RBAY 06.02.26.xlsx: Driver=MZILA, Date=06.02.26, Route=EMP RBAY, Invoices=5
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000420', 1, 25, 'Delivered', '2026-02-06', 'Route: EMP RBAY', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 5 invoices to RF-000420
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000420')
WHERE TransactionNumber IN ('IN162978','IN162998','IN143179','IN143231','IN162971')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/06.02.26/VERULAM DALTON 06.02.26.xlsx: Driver=LUCAS, Date=06.02.26, Route=VERULAM DALTON, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000421', 1, 26, 'Delivered', '2026-02-06', 'Route: VERULAM DALTON', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000421
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000421')
WHERE TransactionNumber IN ('IN163048','IN143230','IN143312','IN162941','IN163038','IN143186','IN162861')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/09.02.26/DURBAN 09.02.26.xlsx: Driver=LUCAS, Date=09.02.26, Route=DURBAN, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000422', 1, 26, 'Delivered', '2026-02-09', 'Route: DURBAN', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000422
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000422')
WHERE TransactionNumber IN ('IN143343','IN143341','IN163052','IN143345','IN163106','IN143342')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/09.02.26/MANGUZI PONGOLA 09.02.26.xlsx: Driver=AJ, Date=09.02.26, Route=MANGUZI PONGOLA, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000423', 1, 22, 'Delivered', '2026-02-09', 'Route: MANGUZI PONGOLA', 'BJ87RSZN', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000423
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000423')
WHERE TransactionNumber IN ('IN143220','IN162997','IN162692','IN023680','IN143243','IN162691','IN143180','IN162979','IN143240')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/09.02.26/RICHMOND RIETVLEI UMZIMKULU 09.02.26.xlsx: Driver=MZILA, Date=09.02.26, Route=RICHMOND RIETVLEI UMZIMKULU, Invoices=18
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000424', 1, 25, 'Delivered', '2026-02-09', 'Route: RICHMOND RIETVLEI UMZIMKULU', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 18 invoices to RF-000424
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000424')
WHERE TransactionNumber IN ('IN143319','IN143212','IN162945','IN143214','IN163055','IN143304','IN143296','IN143300','IN163049','IN143242','IN162944','IN163098','IN143213','IN143344','IN143244','IN143313','IN143187','IN163096')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/10.02.26/DURBAN 10.02.26.xlsx: Driver=MZILA, Date=10.02.26, Route=DURBAN, Invoices=10
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000425', 1, 25, 'Delivered', '2026-02-10', 'Route: DURBAN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 10 invoices to RF-000425
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000425')
WHERE TransactionNumber IN ('IN143185','IN143388','IN162969','IN163151','IN143182','IN023712','IN163144','IN163056','IN143098','IN163034')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/10.02.26/ESHOWE NONGOMA 10.02.26.xlsx: Driver=LUCAS, Date=10.02.26, Route=ESHOWE NONGOMA, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000426', 1, 26, 'Delivered', '2026-02-10', 'Route: ESHOWE NONGOMA', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000426
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000426')
WHERE TransactionNumber IN ('IN163033','IN023689','IN163104','IN023679','IN162857','IN162527','IN143224','IN163140')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/10.02.26/PORT ELIZABETH 10.02.26.xlsx: Driver=NGUBANE, Date=10.02.26, Route=PORT ELIZABETH, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000427', 1, 24, 'Delivered', '2026-02-10', 'Route: PORT ELIZABETH', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000427
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000427')
WHERE TransactionNumber IN ('IN163159')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/10.02.26/UMTATA 10.02.26.xlsx: Driver=BUHLE, Date=10.02.26, Route=UMTATA, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000428', 1, 23, 'Delivered', '2026-02-10', 'Route: UMTATA', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000428
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000428')
WHERE TransactionNumber IN ('IN163160')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/11.02.26/PMB 11.02.26.xlsx: Driver=LUCAS, Date=11.02.26, Route=PMB, Invoices=13
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000429', 1, 26, 'Delivered', '2026-02-11', 'Route: PMB', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 13 invoices to RF-000429
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000429')
WHERE TransactionNumber IN ('IN162970','IN023711','IN163059','IN023709','IN163050','IN162955','IN163057','IN163054','IN163143','IN143389','IN143391','IN163097','IN023715')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/11.02.26/UMTATA MATATIELE MT FRERE  11.02.26.xlsx: Driver=AJ, Date=11.02.26, Route=UMTATA MATATIELE MT FRERE, Invoices=16
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000430', 1, 22, 'Delivered', '2026-02-11', 'Route: UMTATA MATATIELE MT FRERE', 'BJ87RSZN', GETDATE(), GETDATE());

-- Link 16 invoices to RF-000430
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000430')
WHERE TransactionNumber IN ('IN304808','IN163035','IN143322','IN163031','IN163149','IN162975','IN143346','IN163009','IN163109','IN162973','IN162343','IN162974','IN143383','IN163108','IN163107','IN143317')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/11.02.26/VRYHEID EDUMBE 11.02.26.xlsx: Driver=MZILA, Date=11.02.26, Route=VRYHEID EDUMBE, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000431', 1, 25, 'Delivered', '2026-02-11', 'Route: VRYHEID EDUMBE', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000431
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000431')
WHERE TransactionNumber IN ('IN163105','IN163110','IN163058','IN162856','IN143387','IN143297')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/12.02.26/DURBAN 12.02.26.xlsx: Driver=LUCAS, Date=12.02.26, Route=DURBAN, Invoices=5
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000432', 1, 26, 'Delivered', '2026-02-12', 'Route: DURBAN', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 5 invoices to RF-000432
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000432')
WHERE TransactionNumber IN ('IN143405','IN163123','IN163150','IN143408','IN163127')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/12.02.26/TUGELA FERRY NQUTU 12.02.26.xlsx: Driver=SIYABONGA, Date=11.02.26, Route=TUGELA FERRY NQUTU, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000433', 1, 18, 'Delivered', '2026-02-11', 'Route: TUGELA FERRY NQUTU', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000433
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000433')
WHERE TransactionNumber IN ('IN163169','IN162939','IN162754','IN143237','IN143382','IN023698','IN162940','IN143225')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/13.02.26/DURBAN 13.02.26.xlsx: Driver=AJ, Date=13.02.26, Route=DURBAN, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000434', 1, 22, 'Delivered', '2026-02-13', 'Route: DURBAN', 'BJ87RSZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000434
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000434')
WHERE TransactionNumber IN ('IN143423','IN163246')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/13.02.26/LADYSMITH 13.02.26.xlsx: Driver=NGUBANE, Date=13.02.26, Route=LADYSMITH, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000435', 1, 24, 'Delivered', '2026-02-13', 'Route: LADYSMITH', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000435
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000435')
WHERE TransactionNumber IN ('IN143412')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/13.02.26/PMB 13.02.26.xlsx: Driver=MZILA, Date=12.02.26, Route=PMB, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000436', 1, 25, 'Delivered', '2026-02-12', 'Route: PMB', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000436
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000436')
WHERE TransactionNumber IN ('IN023719','IN162976','IN163170','IN162956')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/13.02.26/STANGER MAPHUMULO 13.02.26.xlsx: Driver=LUCAS, Date=13.02.26, Route=STANGER MAPHUMULO, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000437', 1, 26, 'Delivered', '2026-02-13', 'Route: STANGER MAPHUMULO', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000437
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000437')
WHERE TransactionNumber IN ('IN162120','IN023682','IN143409','IN143227')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/16.02.26/DURBAN 16.02.26 -COPY.xlsx: Driver=LUCAS, Date=16.02.26, Route=DURBAN, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000438', 1, 26, 'Delivered', '2026-02-16', 'Route: DURBAN', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000438
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000438')
WHERE TransactionNumber IN ('IN163267','IN163281')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/16.02.26/DURBAN 16.02.26.xlsx: Driver=NGUBANE, Date=16.02.26, Route=DURBAN, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000439', 1, 24, 'Delivered', '2026-02-16', 'Route: DURBAN', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000439
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000439')
WHERE TransactionNumber IN ('IN163231','IN143422','IN163244','IN304864','IN304865','IN143407')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/16.02.26/PORT SHEPSTONE FRANKLIN 16.02.26.xlsx: Driver=MZILA, Date=16.02.26, Route=PORT SHEPSTONE FRANKLIN, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000440', 1, 25, 'Delivered', '2026-02-16', 'Route: PORT SHEPSTONE FRANKLIN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000440
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000440')
WHERE TransactionNumber IN ('IN163146','IN163247','IN163203','IN163269','IN163206','IN163204')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/16.02.26/UMTATA KOKSTAD MATATIELE BIZANA 16.02.26.xlsx: Driver=BUHLE, Date=16.02.26, Route=UMTATA KOKSTAD MATATIELE BIZANA, Invoices=21
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000441', 1, 23, 'Delivered', '2026-02-16', 'Route: UMTATA KOKSTAD MATATIELE BIZANA', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 21 invoices to RF-000441
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000441')
WHERE TransactionNumber IN ('IN163180','IN163181','IN163177','IN163185','IN163192','IN163188','IN163186','IN163183','IN163174','IN163187','IN162975','IN163189','IN163147','IN163176','IN163178','IN163175','IN163182','IN163111','IN163184','IN163179','IN143317')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/17.02.26/DURBAN 16.02.26.xlsx: Driver=LUCAS, Date=17.02.26, Route=DURBAN, Invoices=5
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000442', 1, 26, 'Delivered', '2026-02-17', 'Route: DURBAN', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 5 invoices to RF-000442
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000442')
WHERE TransactionNumber IN ('IN163126','IN163268','IN163265','IN163252','IN143428')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/17.02.26/EMPANGENI 16.02.26.xlsx: Driver=NHLAKA, Date=17.02.26, Route=EMPANGENI, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000443', 1, 17, 'Delivered', '2026-02-17', 'Route: EMPANGENI', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000443
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000443')
WHERE TransactionNumber IN ('IN163306','IN163305','IN143446')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/17.02.26/EMPANGENI R BAY MTUBATUBA 16.02.26.xlsx: Driver=NGUBANE, Date=17.02.26, Route=EMPANGENI R BAY MTUBATUBA, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000444', 1, 24, 'Delivered', '2026-02-17', 'Route: EMPANGENI R BAY MTUBATUBA', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000444
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000444')
WHERE TransactionNumber IN ('IN163264','IN023718','IN163145','IN163190')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/17.02.26/ESTCOURT LADYSMITH DUNDEE NEWCASTLE 16.02.26.xlsx: Driver=MZILA, Date=17.02.26, Route=ESTCOURT LADYSMITH DUNDEE NEWCASTLE, Invoices=13
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000445', 1, 25, 'Delivered', '2026-02-17', 'Route: ESTCOURT LADYSMITH DUNDEE NEWCASTLE', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 13 invoices to RF-000445
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000445')
WHERE TransactionNumber IN ('IN143426','IN163210','IN163051','IN162953','IN163191','IN163053','IN163207','IN143390','IN143403','IN143392','IN023706','IN143425','IN161896')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/18.02.26/DURBAN 18.02.26.xlsx: Driver=BUHLE, Date=18.02.26, Route=DURBAN, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000446', 1, 23, 'Delivered', '2026-02-18', 'Route: DURBAN', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000446
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000446')
WHERE TransactionNumber IN ('IN143444','IN143443','IN163325','IN163326','IN163324','IN163328','IN163312')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/18.02.26/HLABISA NKONJENI 18.02.26.xlsx: Driver=NGUBANE, Date=18.02.26, Route=HLABISA NKONJENI, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000447', 1, 24, 'Delivered', '2026-02-18', 'Route: HLABISA NKONJENI', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000447
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000447')
WHERE TransactionNumber IN ('IN143411','IN143298','IN163171','IN163393')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/18.02.26/PMB 18.02.26.xlsx: Driver=CEBO, Date=18.02.26, Route=PMB, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000448', 1, 21, 'Delivered', '2026-02-18', 'Route: PMB', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000448
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000448')
WHERE TransactionNumber IN ('IN143448','IN163315','IN163307','IN163370')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/19.02.26/DURBAN  19.02.26.xlsx: Driver=BUHLE, Date=19.02.26, Route=DURBAN, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000449', 1, 23, 'Delivered', '2026-02-19', 'Route: DURBAN', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000449
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000449')
WHERE TransactionNumber IN ('IN163314','IN163357','IN143445','IN023734')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/19.02.26/DURBAN 19.02.26.xlsx: Driver=MZILA, Date=19.02.26, Route=DURBAN, Invoices=10
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000450', 1, 25, 'Delivered', '2026-02-19', 'Route: DURBAN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 10 invoices to RF-000450
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000450')
WHERE TransactionNumber IN ('IN163327','IN163310','IN163394','IN163309','IN163360','IN163367','IN163368','IN304979','IN163308','IN023731')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/20.02.26/DURBAN 20.02.26.xlsx: Driver=MZILA, Date=20.02.26, Route=DURBAN, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000451', 1, 25, 'Delivered', '2026-02-20', 'Route: DURBAN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000451
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000451')
WHERE TransactionNumber IN ('IN163419','IN304524','IN163395','IN023733','IN143483','IN163421')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/20.02.26/HLABISA 20.02.26.xlsx: Driver=MASIYA, Date=20.02.26, Route=HLABISA, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000452', 1, @MasiyaId, 'Delivered', '2026-02-20', 'Route: HLABISA', 'CT11SJZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000452
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000452')
WHERE TransactionNumber IN ('IN163488','IN163515')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/20.02.26/TONGAAT 20.02.26.xlsx: Driver=BUHLE, Date=20.02.26, Route=TONGAAT, Invoices=11
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000453', 1, 23, 'Delivered', '2026-02-20', 'Route: TONGAAT', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 11 invoices to RF-000453
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000453')
WHERE TransactionNumber IN ('IN143469','IN304980','IN023722','IN163253','IN143404','IN163422','IN163266','IN163399','IN143484','IN163173','IN143467')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/23.02.26/EMPANGENI 23.02.26.xlsx: Driver=NHLAKA, Date=23.02.26, Route=EMPANGENI, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000454', 1, 17, 'Delivered', '2026-02-23', 'Route: EMPANGENI', 'CT11SJZN', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000454
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000454')
WHERE TransactionNumber IN ('IN163447')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/23.02.26/ESTCOURT LADYSMITH 23.02.26.xlsx: Driver=BUHLE, Date=23.02.26, Route=ESTCOURT LADYSMITH, Invoices=10
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000455', 1, 23, 'Delivered', '2026-02-23', 'Route: ESTCOURT LADYSMITH', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 10 invoices to RF-000455
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000455')
WHERE TransactionNumber IN ('IN143449','IN143496','IN163365','IN163512','IN023738','IN143480','IN163466','IN163489','IN163304','IN163303')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/23.02.26/KOKSTAD UMTATA BIZANA MATATIELE LUSIKISIKI 23.02.26.xlsx: Driver=MZILA, Date=23.02.26, Route=KOKSTAD UMTATA BIZANA MATATIELE LUSIKISIKI, Invoices=20
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000456', 1, 25, 'Delivered', '2026-02-23', 'Route: KOKSTAD UMTATA BIZANA MATATIELE LUSIKISIKI', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 20 invoices to RF-000456
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000456')
WHERE TransactionNumber IN ('IN163317','IN163490','IN163300','IN163362','IN143450','IN163337','IN143447','IN163301','IN163322','IN143451','IN163416','IN163417','IN163351','IN163331','IN163333','IN163397','IN143452','IN163321','IN163361','IN163330')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/23.02.26/MANGUZI JOZINI MSELENI 23.02.26.xlsx: Driver=SIZWE, Date=23.02.26, Route=MANGUZI JOZINI MSELENI, Invoices=14
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000457', 1, 20, 'Delivered', '2026-02-23', 'Route: MANGUZI JOZINI MSELENI', 'DJ25NLZN', GETDATE(), GETDATE());

-- Link 14 invoices to RF-000457
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000457')
WHERE TransactionNumber IN ('IN163316','IN163047','IN163148','IN162115','IN143498','IN143393','IN163284','IN143427','IN023728','IN163211','IN163456','IN163299','IN163205','IN163458')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/24.02.26/CEZA NKONJENI NONGOMA  24.02.26.xlsx: Driver=SIYABONGA, Date=24.02.26, Route=CEZA NKONJENI NONGOMA, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000458', 1, 18, 'Delivered', '2026-02-24', 'Route: CEZA NKONJENI NONGOMA', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000458
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000458')
WHERE TransactionNumber IN ('IN163528','IN163527','IN305039','IN023749')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/24.02.26/DURBAN 24.02.26 - Copy.xlsx: Driver=SMANGA, Date=24.02.26, Route=DURBAN, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000459', 1, @SmangaId, 'Delivered', '2026-02-24', 'Route: DURBAN', 'BD15GNZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000459
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000459')
WHERE TransactionNumber IN ('IN023755','IN163479','IN304687','IN305038')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/24.02.26/DURBAN 24.02.26.xlsx: Driver=BUHLE, Date=24.02.26, Route=DURBAN, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000460', 1, 23, 'Delivered', '2026-02-24', 'Route: DURBAN', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000460
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000460')
WHERE TransactionNumber IN ('IN163461','IN163511','IN163516','IN163460','IN163462','IN143497','IN163478','IN163454')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/24.02.26/SCOTTBURGH UZUMBE 24.02.26.xlsx: Driver=SIZWE, Date=24.02.26, Route=SCOTTBURGH UZUMBE, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000461', 1, 20, 'Delivered', '2026-02-24', 'Route: SCOTTBURGH UZUMBE', 'DJ25NLZN', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000461
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000461')
WHERE TransactionNumber IN ('IN163551','IN163302','IN023740')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/25.02.26/GLENCOE NEWCASTLE 25.02.26.xlsx: Driver=BUHLE, Date=25.02.26, Route=GLENCOE NEWCASTLE, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000462', 1, 23, 'Delivered', '2026-02-25', 'Route: GLENCOE NEWCASTLE', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000462
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000462')
WHERE TransactionNumber IN ('IN143505','IN143502','IN163438')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/25.02.26/PMB 25.02.26.xlsx: Driver=MZILA, Date=25.02.26, Route=PMB, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000463', 1, 25, 'Delivered', '2026-02-25', 'Route: PMB', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000463
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000463')
WHERE TransactionNumber IN ('IN163526','IN163676','IN023748','IN163370','IN163398','IN163525','IN163484','IN304981','IN163459')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/26.02.26/NEWCASTLE 26.02.26.xlsx: Driver=BUHLE, Date=26.02.26, Route=NEWCASTLE, Invoices=14
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000464', 1, 23, 'Delivered', '2026-02-26', 'Route: NEWCASTLE', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 14 invoices to RF-000464
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000464')
WHERE TransactionNumber IN ('IN163455','IN143482','IN143520','IN143466','IN163465','IN163334','IN163329','IN163366','IN163457','IN163338','IN023737','IN163513','IN163336','IN163464')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/26.02.26/STANGER GREYTOWN TUGELA FERRY.xlsx: Driver=SIZWE, Date=26.02.26, Route=STANGER GREYTOWN TUGELA FERRY, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000465', 1, 20, 'Delivered', '2026-02-26', 'Route: STANGER GREYTOWN TUGELA FERRY', 'DJ25NLZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000465
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000465')
WHERE TransactionNumber IN ('IN163524','IN143217','IN163400','IN163510','IN023739','IN163529')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/27.02.26/EMP RBAY 27.02.26.xlsx: Driver=MZILA, Date=27.02.26, Route=EMP RBAY, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000466', 1, 25, 'Delivered', '2026-02-27', 'Route: EMP RBAY', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000466
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000466')
WHERE TransactionNumber IN ('IN143542')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/27.02.26/HAMMERSDALE  27.02.26.xlsx: Driver=SIZWE, Date=27.02.26, Route=HAMMERSDALE, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000467', 1, 20, 'Delivered', '2026-02-27', 'Route: HAMMERSDALE', 'DJ25NLZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000467
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000467')
WHERE TransactionNumber IN ('IN143569','IN143568')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/27.02.26/PORT SHEPSTONE 27.02.26.xlsx: Driver=BUHLE, Date=27.02.26, Route=PORT SHEPSTONE, Invoices=10
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000468', 1, 23, 'Delivered', '2026-02-27', 'Route: PORT SHEPSTONE', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 10 invoices to RF-000468
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000468')
WHERE TransactionNumber IN ('IN163779','IN023735','IN163453','IN023756','IN163313','IN143518','IN163815','IN163674','IN163514','IN163682')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- FEBUARY/27.02.26/WENTWORTH  27.02.26.xlsx: Driver=LUCAS, Date=27.02.26, Route=WENTWORTH, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000469', 1, 26, 'Delivered', '2026-02-27', 'Route: WENTWORTH', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000469
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000469')
WHERE TransactionNumber IN ('IN163669','IN163685','IN023764','IN163684','IN143543','IN163492')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/02.03.26/AMATIKULU ESHOWE NKANDLA 02.03.26.xlsx: Driver=MZILA, Date=02.03.26, Route=AMATIKULU ESHOWE NKANDLA, Invoices=10
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000470', 1, 25, 'Delivered', '2026-03-02', 'Route: AMATIKULU ESHOWE NKANDLA', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 10 invoices to RF-000470
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000470')
WHERE TransactionNumber IN ('IN162339','IN163689','IN163285','IN163553','IN305040','IN163635','IN163415','IN143468','IN163420','IN163463')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/02.03.26/DURBAN KING EDWARD  27.02.26.xlsx: Driver=NGUBANE, Date=02.03.26, Route=DURBAN KING EDWARD, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000471', 1, 24, 'Delivered', '2026-03-02', 'Route: DURBAN KING EDWARD', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000471
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000471')
WHERE TransactionNumber IN ('IN143522','IN163487','IN163686','IN163691')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/02.03.26/KOKSTAD MATATIELE 02.03.26.xlsx: Driver=BUHLE, Date=02.03.26, Route=KOKSTAD MATATIELE, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000472', 1, 23, 'Delivered', '2026-03-02', 'Route: KOKSTAD MATATIELE', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000472
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000472')
WHERE TransactionNumber IN ('IN163822','IN163317','IN163867','IN163825','IN163301','IN163675','IN143519','IN023757')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/02.03.26/VERULAM TONGAAT APPLESBOSCH 02.03.26.xlsx: Driver=LUCAS, Date=02.03.26, Route=VERULAM TONGAAT APPLESBOSCH, Invoices=13
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000473', 1, 26, 'Delivered', '2026-03-02', 'Route: VERULAM TONGAAT APPLESBOSCH', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 13 invoices to RF-000473
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000473')
WHERE TransactionNumber IN ('IN163482','IN163810','IN163692','IN023752','IN143570','IN023751','IN143516','IN163483','IN163422','IN163666','IN163481','IN163813','IN143521')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/03.03.26/DURBAN 03.02.26.xlsx: Driver=MZILA, Date=03.03.26, Route=DURBAN, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000474', 1, 25, 'Delivered', '2026-03-03', 'Route: DURBAN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000474
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000474')
WHERE TransactionNumber IN ('IN163555','IN023765','IN163768','IN163817','IN163823','IN163767','IN305037')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/03.03.26/PMB MOOI RIVER 03.02.26.xlsx: Driver=NGUBANE, Date=03.03.26, Route=PMB MOOI RIVER, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000475', 1, 24, 'Delivered', '2026-03-03', 'Route: PMB MOOI RIVER', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000475
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000475')
WHERE TransactionNumber IN ('IN023772','IN023748','IN143567','IN163827','IN163816','IN163770','IN163820','IN163639','IN143587')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/03.03.26/PONGOLA MANGUZI MSELENI 03.02.26.xlsx: Driver=LUCAS, Date=03.03.26, Route=PONGOLA MANGUZI MSELENI, Invoices=17
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000476', 1, 26, 'Delivered', '2026-03-03', 'Route: PONGOLA MANGUZI MSELENI', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 17 invoices to RF-000476
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000476')
WHERE TransactionNumber IN ('IN163316','IN163928','IN023753','IN163773','IN143524','IN163828','IN143498','IN163863','IN163672','IN163811','IN163775','IN163776','IN163671','IN163211','IN143504','IN143590','IN162342')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/03.03.26/TONGAAT 03.02.26.xlsx: Driver=SIYA, Date=03.03.26, Route=TONGAAT, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000477', 1, 37, 'Delivered', '2026-03-03', 'Route: TONGAAT', 'CT11SJZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000477
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000477')
WHERE TransactionNumber IN ('IN143571','IN143589')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/04.03.26/DURBAN 04.03.26.xlsx: Driver=MZILA, Date=04.03.26, Route=DURBAN, Invoices=12
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000478', 1, 25, 'Delivered', '2026-03-04', 'Route: DURBAN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 12 invoices to RF-000478
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000478')
WHERE TransactionNumber IN ('IN163485','IN163860','IN163907','IN143523','IN163821','IN163829','IN143604','IN163977','IN163688','IN163906','IN163984','IN163864')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/04.03.26/WINTERTON LADYSMITH NEWCASTLE 04.03.26.xlsx: Driver=(none), Date=04.03.26, Route=WINTERTON LADYSMITH NEWCASTLE, Invoices=10
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000479', 1, NULL, 'Delivered', '2026-03-04', 'Route: WINTERTON LADYSMITH NEWCASTLE', '', GETDATE(), GETDATE());

-- Link 10 invoices to RF-000479
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000479')
WHERE TransactionNumber IN ('IN163550','IN023771','IN163769','IN163824','IN163762','IN163905','IN163861','IN163778','IN023750','IN163832')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/05.03.26/BIZANA UMTATA MT FRERE 05.03.26.xlsx: Driver=BUHLE, Date=05.03.26, Route=BIZANA UMTATA MT FRERE, Invoices=12
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000480', 1, 23, 'Delivered', '2026-03-05', 'Route: BIZANA UMTATA MT FRERE', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 12 invoices to RF-000480
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000480')
WHERE TransactionNumber IN ('IN163323','IN305043','IN163746','IN163744','IN163317','IN023758','IN163831','IN163819','IN163972','IN163983','IN163962','IN305042')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/05.03.26/IXOPO BULWER 05.03.26.xlsx: Driver=MZILA, Date=05.03.26, Route=IXOPO BULWER, Invoices=15
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000481', 1, 25, 'Delivered', '2026-03-05', 'Route: IXOPO BULWER', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 15 invoices to RF-000481
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000481')
WHERE TransactionNumber IN ('IN023769','IN163781','IN143540','IN143506','IN163486','IN163812','IN143503','IN163363','IN163670','IN163826','IN163396','IN143603','IN143481','IN023770','IN143615')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/05.03.26/KWAPETT  EKOMBE 1 TON 05.03.26.xlsx: Driver=SMANGA, Date=05.03.26, Route=KWAPETT EKOMBE 1 TON, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000482', 1, @SmangaId, 'Delivered', '2026-03-05', 'Route: KWAPETT EKOMBE 1 TON', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000482
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000482')
WHERE TransactionNumber IN ('IN163480','IN163690','IN163855','IN023741','IN163628','IN163673')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/05.03.26/P SHEPSTONE UMZIMKHULU 1 TON 05.03.26.xlsx: Driver=NHLAKA, Date=05.03.26, Route=P SHEPSTONE UMZIMKHULU 1 TON, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000483', 1, 17, 'Delivered', '2026-03-05', 'Route: P SHEPSTONE UMZIMKHULU 1 TON', 'BD15GNZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000483
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000483')
WHERE TransactionNumber IN ('IN163980','IN163981','IN163985','IN023780')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/05.03.26/PMB  05.03.26.xlsx: Driver=SIZWE, Date=05.03.26, Route=PMB, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000484', 1, 20, 'Delivered', '2026-03-05', 'Route: PMB', 'DJ25NLZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000484
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000484')
WHERE TransactionNumber IN ('IN163978','IN163683','IN143606','IN143544')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/05.03.26/TONGAAT NEW HANOVER  05.03.26.xlsx: Driver=SIYABONGA, Date=05.03.26, Route=TONGAAT NEW HANOVER, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000485', 1, 18, 'Delivered', '2026-03-05', 'Route: TONGAAT NEW HANOVER', 'CT11SHZN', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000485
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000485')
WHERE TransactionNumber IN ('IN163958','IN164024','IN163364')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/05.03.26/ULUNDI NKONJENI CEZA 05.03.26.xlsx: Driver=LUCAS, Date=05.03.26, Route=ULUNDI NKONJENI CEZA, Invoices=5
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000486', 1, 26, 'Delivered', '2026-03-05', 'Route: ULUNDI NKONJENI CEZA', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 5 invoices to RF-000486
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000486')
WHERE TransactionNumber IN ('IN143517','IN163687','IN163780','IN163830','IN143541')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/06.03.26/DURBAN 06.03.26 - Copy.xlsx: Driver=LUCAS, Date=06.03.26, Route=DURBAN, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000487', 1, 26, 'Delivered', '2026-03-06', 'Route: DURBAN', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000487
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000487')
WHERE TransactionNumber IN ('IN143658','IN164010','IN163872','IN164006','IN164100','IN023754')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/06.03.26/DURBAN 06.03.26.xlsx: Driver=NGUBANE, Date=06.03.26, Route=DURBAN, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000488', 1, 24, 'Delivered', '2026-03-06', 'Route: DURBAN', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000488
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000488')
WHERE TransactionNumber IN ('IN164018','IN164019','IN163952','IN143617','IN164041','IN163953','IN163777','IN305037','IN163951')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/06.03.26/LOUWSBERG 06.03.26.xlsx: Driver=(none), Date=06.03.26, Route=LOUWSBERG, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000489', 1, NULL, 'Delivered', '2026-03-06', 'Route: LOUWSBERG', '', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000489
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000489')
WHERE TransactionNumber IN ('IN163172')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/09.03.26/DURBAN  06.03.26.xlsx: Driver=LUCAS, Date=09.03.26, Route=DURBAN, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000490', 1, 26, 'Delivered', '2026-03-09', 'Route: DURBAN', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000490
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000490')
WHERE TransactionNumber IN ('IN163555','IN305165','IN164112','IN305163','IN164096','IN305162')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/09.03.26/NONGOMA UNLUNDI 09.03.26.xlsx: Driver=BUHLE, Date=09.03.26, Route=NONGOMA UNLUNDI, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000491', 1, 23, 'Delivered', '2026-03-09', 'Route: NONGOMA UNLUNDI', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000491
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000491')
WHERE TransactionNumber IN ('IN164003','IN164004','IN164107','IN164044','IN164005','IN163950')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/09.03.26/PMB  09.03.26.xlsx: Driver=NGUBANE, Date=09.03.26, Route=PMB, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000492', 1, 24, 'Delivered', '2026-03-09', 'Route: PMB', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000492
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000492')
WHERE TransactionNumber IN ('IN164106','IN164101','IN164105','IN143503','IN164103','IN163668')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/09.03.26/STANGER UMPUMULO TUGELA FERRY GREYTOWN  09.03.26.xlsx: Driver=MZILA, Date=09.03.26, Route=STANGER UMPUMULO TUGELA FERRY GREYTOWN, Invoices=15
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000493', 1, 25, 'Delivered', '2026-03-09', 'Route: STANGER UMPUMULO TUGELA FERRY GREYTOWN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 15 invoices to RF-000493
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000493')
WHERE TransactionNumber IN ('IN164045','IN304978','IN164008','IN163414','IN143656','IN143653','IN163911','IN164023','IN143657','IN163909','IN143654','IN164009','IN163910','IN304982','IN163954')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/10.03.26/ESTCOURT LADYSMITH 10.03.26.xlsx: Driver=LUCAS, Date=10.03.26, Route=ESTCOURT LADYSMITH, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000494', 1, 26, 'Delivered', '2026-03-10', 'Route: ESTCOURT LADYSMITH', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000494
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000494')
WHERE TransactionNumber IN ('IN023786','IN164046','IN163957','IN164104','IN164102','IN143677','IN143674')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/10.03.26/HLABISA 10.03.26.xlsx: Driver=MZILA, Date=10.03.26, Route=HLABISA, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000495', 1, 25, 'Delivered', '2026-03-10', 'Route: HLABISA', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000495
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000495')
WHERE TransactionNumber IN ('IN023779','IN164020','IN163947','IN023774','IN143655','IN143545')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/10.03.26/NEWCASTLE NQUTU 10.03.26.xlsx: Driver=NGUBANE, Date=10.03.26, Route=NEWCASTLE NQUTU, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000496', 1, 24, 'Delivered', '2026-03-10', 'Route: NEWCASTLE NQUTU', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000496
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000496')
WHERE TransactionNumber IN ('IN164097','IN163949','IN305166','IN163359','IN163955','IN163973','IN163948','IN143616')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/10.03.26/UMTATA MT FRERE KOKSTAD 10.03.26.xlsx: Driver=BUHLE, Date=10.03.26, Route=UMTATA MT FRERE KOKSTAD, Invoices=12
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000497', 1, 23, 'Delivered', '2026-03-10', 'Route: UMTATA MT FRERE KOKSTAD', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 12 invoices to RF-000497
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000497')
WHERE TransactionNumber IN ('IN143608','IN164108','IN164124','IN143638','IN164123','IN164093','IN143607','IN164092','IN164017','IN143666','IN143665','IN143639')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/11.03.26/DURBAN 11.03.26.xlsx: Driver=(none), Date=11.03.26, Route=DURBAN, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000498', 1, NULL, 'Delivered', '2026-03-11', 'Route: DURBAN', '', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000498
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000498')
WHERE TransactionNumber IN ('IN164178')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/11.03.26/IXOPO PORT SHEPSTONE 11.03.26.xlsx: Driver=(none), Date=, Route=IXOPO PORT SHEPSTONE, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000499', 1, NULL, 'Delivered', '2026-03-11', 'Route: IXOPO PORT SHEPSTONE', '', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000499
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000499')
WHERE TransactionNumber IN ('IN305161','IN164025','IN163866','IN164011','IN164164','IN164150','IN164155','IN164022','IN164021')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/11.03.26/NKANDLA ESHOWE 11.03.26.xlsx: Driver=SIYA, Date=11.03.26, Route=NKANDLA ESHOWE, Invoices=5
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000500', 1, 37, 'Delivered', '2026-03-11', 'Route: NKANDLA ESHOWE', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 5 invoices to RF-000500
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000500')
WHERE TransactionNumber IN ('IN162339','IN143683','IN305040','IN164095','IN164220')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/11.03.26/PONGOLA UBOMBO 11.03.26.xlsx: Driver=(none), Date=11.03.26, Route=PONGOLA UBOMBO, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000501', 1, NULL, 'Delivered', '2026-03-11', 'Route: PONGOLA UBOMBO', '', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000501
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000501')
WHERE TransactionNumber IN ('IN023799','IN164221','IN164125','IN164226','IN143640','IN143634','IN164229')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/12.03.26/DURBAN 12.03.26.xlsx: Driver=(none), Date=, Route=DURBAN, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000502', 1, NULL, 'Delivered', '2026-03-12', 'Route: DURBAN', '', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000502
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000502')
WHERE TransactionNumber IN ('IN164198','IN164205','IN164219','IN164201','IN164200','IN164176','IN163667','IN023798')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/12.03.26/IXOPO  12.03.26.xlsx: Driver=NHLAKA, Date=12.03.26, Route=IXOPO, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000503', 1, 17, 'Delivered', '2026-03-12', 'Route: IXOPO', 'BD15GNZN', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000503
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000503')
WHERE TransactionNumber IN ('IN164285')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/12.03.26/NEWCASTLE 12.03.26.xlsx: Driver=MASIYA, Date=12.03.26, Route=NEWCASTLE, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000504', 1, @MasiyaId, 'Delivered', '2026-03-12', 'Route: NEWCASTLE', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000504
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000504')
WHERE TransactionNumber IN ('IN164266','IN164171','IN023797')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/12.03.26/PMB 12.03.26.xlsx: Driver=(none), Date=12.03.26, Route=PMB, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000505', 1, NULL, 'Delivered', '2026-03-12', 'Route: PMB', '', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000505
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000505')
WHERE TransactionNumber IN ('IN164202','IN164197','IN143663','IN143664')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/12.03.26/UMTATA 12.03.26.xlsx: Driver=(none), Date=12.03.26, Route=UMTATA, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000506', 1, NULL, 'Delivered', '2026-03-12', 'Route: UMTATA', '', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000506
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000506')
WHERE TransactionNumber IN ('IN164283')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/12.03.26/VRYHEID EDUMBE 12.03.26.xlsx: Driver=MZILA, Date=12.03.26, Route=VRYHEID EDUMBE, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000507', 1, 25, 'Delivered', '2026-03-12', 'Route: VRYHEID EDUMBE', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000507
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000507')
WHERE TransactionNumber IN ('IN163358','IN023704','IN164098','IN023721','IN163862','IN143700','IN143605','IN023732')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/13.03.26/DURBAN 13.03.26 - Copy.xlsx: Driver=SIYABONGA, Date=13.03.26, Route=DURBAN, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000508', 1, 18, 'Delivered', '2026-03-13', 'Route: DURBAN', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000508
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000508')
WHERE TransactionNumber IN ('IN164342','IN164326','IN164336')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/13.03.26/DURBAN 13.03.26.xlsx: Driver=(none), Date=13.03.26, Route=DURBAN, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000509', 1, NULL, 'Delivered', '2026-03-13', 'Route: DURBAN', '', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000509
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000509')
WHERE TransactionNumber IN ('IN143755','IN143762','IN143753','IN164165','IN143757','IN163864')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/13.03.26/EMPANGENI RICHARDS BAY 13.03.26.xlsx: Driver=MZILA, Date=13.03.26, Route=EMPANGENI RICHARDS BAY, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000510', 1, 25, 'Delivered', '2026-03-13', 'Route: EMPANGENI RICHARDS BAY', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000510
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000510')
WHERE TransactionNumber IN ('IN143588','IN143633','IN143565','IN305041','IN164111','IN164311','IN164110','IN305164','IN143566')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/13.03.26/GAMALAKHE PORT SHEPSTONE 13.03.26.xlsx: Driver=NGUBANE, Date=13.03.26, Route=GAMALAKHE PORT SHEPSTONE, Invoices=5
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000511', 1, 24, 'Delivered', '2026-03-13', 'Route: GAMALAKHE PORT SHEPSTONE', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 5 invoices to RF-000511
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000511')
WHERE TransactionNumber IN ('IN164287','IN164212','IN164164','IN164216','IN143745')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/13.03.26/TONGAAT VERULAM APPLESBOSCH 13.03.26.xlsx: Driver=SIZWE, Date=13.03.26, Route=TONGAAT VERULAM APPLESBOSCH, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000512', 1, 20, 'Delivered', '2026-03-13', 'Route: TONGAAT VERULAM APPLESBOSCH', 'DJ25NLZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000512
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000512')
WHERE TransactionNumber IN ('IN164215','IN164177','IN143761','IN164238','IN305036','IN163956')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/13.03.26/UMTATA 13.03.26.xlsx: Driver=ZOLANI, Date=13.03.26, Route=UMTATA, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000513', 1, 36, 'Delivered', '2026-03-13', 'Route: UMTATA', 'BM37WCZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000513
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000513')
WHERE TransactionNumber IN ('IN143742','IN143736','IN164230','IN143735','IN164240','IN164168')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/16.03.26/KRANSKOP GREYTOWN POMEROY 16.03.26.xlsx: Driver=(none), Date=16.03.26, Route=KRANSKOP GREYTOWN POMEROY, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000514', 1, NULL, 'Delivered', '2026-03-16', 'Route: KRANSKOP GREYTOWN POMEROY', '', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000514
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000514')
WHERE TransactionNumber IN ('IN164172','IN023819','IN164173','IN143678','IN143758','IN164309','IN164206')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/16.03.26/NKONJENI CEZA NONGOMA 16.03.26.xlsx: Driver=MZILA, Date=16.03.26, Route=NKONJENI CEZA NONGOMA, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000515', 1, 25, 'Delivered', '2026-03-16', 'Route: NKONJENI CEZA NONGOMA', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000515
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000515')
WHERE TransactionNumber IN ('IN143763','IN164151','IN164338','IN164288','IN164335','IN164209')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/16.03.26/PMB 16.03.26.xlsx: Driver=NGUBANE, Date=16.03.26, Route=PMB, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000516', 1, 24, 'Delivered', '2026-03-16', 'Route: PMB', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000516
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000516')
WHERE TransactionNumber IN ('IN164327','IN164207')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/16.03.26/PMB MOOI RIVER  16.03.26.xlsx: Driver=SIZWE, Date=16.03.26, Route=PMB MOOI RIVER, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000517', 1, 20, 'Delivered', '2026-03-16', 'Route: PMB MOOI RIVER', 'DJ25NLZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000517
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000517')
WHERE TransactionNumber IN ('IN143696','IN143754','IN164211','IN164282','IN164214','IN143756')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/16.03.26/UMZIMKULU IXOPO PORT SHEPSTONE 16.03.26.xlsx: Driver=BUHLE, Date=16.03.26, Route=UMZIMKULU IXOPO PORT SHEPSTONE, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000518', 1, 23, 'Delivered', '2026-03-16', 'Route: UMZIMKULU IXOPO PORT SHEPSTONE', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000518
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000518')
WHERE TransactionNumber IN ('IN164286','IN164329','IN164310','IN143765','IN164208','IN164265','IN164232','IN164210')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/17.03.26/DURBAN  17.03.26.xlsx: Driver=CEBO, Date=17.03.26, Route=DURBAN, Invoices=5
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000519', 1, 21, 'Delivered', '2026-03-17', 'Route: DURBAN', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 5 invoices to RF-000519
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000519')
WHERE TransactionNumber IN ('IN143797','IN023826','IN164347','IN143785','IN164382')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/17.03.26/ESTCOURT LADYSMITH NEWCASTLE  17.03.26.xlsx: Driver=NGUBANE, Date=, Route=ESTCOURT LADYSMITH NEWCASTLE, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000520', 1, 24, 'Delivered', '2026-03-17', 'Route: ESTCOURT LADYSMITH NEWCASTLE', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000520
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000520')
WHERE TransactionNumber IN ('IN143697','IN143792','IN023818','IN143760','IN143759','IN143816','IN143694')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/17.03.26/LUSIKISIKI PORT ST JOHN  MT FRERE MT AYLIFF  17.03.26.xlsx: Driver=BUHLE, Date=17.03.26, Route=LUSIKISIKI PORT ST JOHN MT FRERE MT AYLIFF, Invoices=20
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000521', 1, 23, 'Delivered', '2026-03-17', 'Route: LUSIKISIKI PORT ST JOHN MT FRERE MT AYLIFF', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 20 invoices to RF-000521
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000521')
WHERE TransactionNumber IN ('IN164313','IN143638','IN164203','IN143737','IN164237','IN143747','IN143746','IN023809','IN164239','IN164280','IN164279','IN143651','IN164236','IN164170','IN164380','IN164166','IN023827','IN164204','IN164167','IN164169')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/17.03.26/NQUTU PAUL PIETERSBURG 17.03.26.xlsx: Driver=SIZWE, Date=17.03.26, Route=NQUTU PAUL PIETERSBURG, Invoices=10
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000522', 1, 20, 'Delivered', '2026-03-17', 'Route: NQUTU PAUL PIETERSBURG', 'DJ25NLZN', GETDATE(), GETDATE());

-- Link 10 invoices to RF-000522
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000522')
WHERE TransactionNumber IN ('IN164332','IN164343','IN164213','IN143786','IN164340','IN164328','IN164330','IN164331','IN164333','IN143794')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/17.03.26/UBOMBO MANGUZI JOZINI  17.03.26.xlsx: Driver=MZILA, Date=17.03.26, Route=UBOMBO MANGUZI JOZINI, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000523', 1, 25, 'Delivered', '2026-03-17', 'Route: UBOMBO MANGUZI JOZINI', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000523
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000523')
WHERE TransactionNumber IN ('IN143767','IN164337','IN143784','IN143768','IN164341','IN164284')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/18.03.26/DURBAN 18.03.26.xlsx: Driver=MZILA, Date=18.03.26, Route=DURBAN, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000524', 1, 25, 'Delivered', '2026-03-18', 'Route: DURBAN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000524
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000524')
WHERE TransactionNumber IN ('IN164450','IN163814','IN164416','IN164443')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/18.03.26/HLABISA EMPANGENI 18.03.26.xlsx: Driver=NGUBANE, Date=18.03.26, Route=HLABISA EMPANGENI, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000525', 1, 24, 'Delivered', '2026-03-18', 'Route: HLABISA EMPANGENI', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000525
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000525')
WHERE TransactionNumber IN ('IN143701','IN164457','IN164456','IN164451','IN164452','IN164381','IN023801','IN143805')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/18.03.26/PHOLELA IXOPO PORT SHEPSTONE 18.03.26.xlsx: Driver=CEBO, Date=18.03.26, Route=PHOLELA IXOPO PORT SHEPSTONE, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000526', 1, 21, 'Delivered', '2026-03-18', 'Route: PHOLELA IXOPO PORT SHEPSTONE', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000526
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000526')
WHERE TransactionNumber IN ('IN164455','IN143789','IN164444','IN143791','IN164454','IN164109','IN164409','IN164387')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/19.03.26/KOKSTAD MATATIELE MT FRERE 18.03.26.xlsx: Driver=BUHLE, Date=19.03.26, Route=KOKSTAD MATATIELE MT FRERE, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000527', 1, 23, 'Delivered', '2026-03-19', 'Route: KOKSTAD MATATIELE MT FRERE', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000527
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000527')
WHERE TransactionNumber IN ('IN164174','IN164231','IN143793','IN143782','IN164513','IN143843','IN164408','IN164407')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/19.03.26/NKONJENI CEZA HLABISA  18.03.26.xlsx: Driver=MZILA, Date=19.03.26, Route=NKONJENI CEZA HLABISA, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000528', 1, 25, 'Delivered', '2026-03-19', 'Route: NKONJENI CEZA HLABISA', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000528
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000528')
WHERE TransactionNumber IN ('IN143800','IN143803','IN164288','IN164487','IN164459','IN143819')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/19.03.26/PMB 18.03.26.xlsx: Driver=NGUBANE, Date=19.03.26, Route=PMB, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000529', 1, 24, 'Delivered', '2026-03-19', 'Route: PMB', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000529
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000529')
WHERE TransactionNumber IN ('IN164439','IN164511','IN143817','IN143796','IN164383','IN143804','IN143787')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/20.03.26/DURBAN 18.03.26.xlsx: Driver=MZILA, Date=20.03.26, Route=DURBAN, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000530', 1, 25, 'Delivered', '2026-03-20', 'Route: DURBAN', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000530
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000530')
WHERE TransactionNumber IN ('IN163865','IN305269')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/20.03.26/TONGAAT APPLESBOSCH 18.03.26.xlsx: Driver=NGUBANE, Date=20.03.26, Route=TONGAAT APPLESBOSCH, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000531', 1, 24, 'Delivered', '2026-03-20', 'Route: TONGAAT APPLESBOSCH', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000531
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000531')
WHERE TransactionNumber IN ('IN143695','IN143790','IN143766','IN164394','IN143795','IN164553')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/21.03.26/TOTI 21.03.26.xlsx: Driver=CEBO, Date=21.03.26, Route=TOTI, Invoices=1
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000532', 1, 21, 'Delivered', '2026-03-21', 'Route: TOTI', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 1 invoices to RF-000532
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000532')
WHERE TransactionNumber IN ('IN164619')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/23.03.26/DURBAN  18.03.26.xlsx: Driver=(none), Date=23.03.26, Route=DURBAN, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000533', 1, NULL, 'Delivered', '2026-03-23', 'Route: DURBAN', '', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000533
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000533')
WHERE TransactionNumber IN ('IN023836','IN164510','IN164595')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/23.03.26/HLABISA EMP 24.03.26.xlsx: Driver=SIYABONGA, Date=23.03.26, Route=HLABISA EMP, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000534', 1, 18, 'Delivered', '2026-03-23', 'Route: HLABISA EMP', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000534
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000534')
WHERE TransactionNumber IN ('IN305303','IN143858','IN305315','IN305306','IN305301','IN305298')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/23.03.26/LADYSMITH NEWCASTLE 18.03.26.xlsx: Driver=(none), Date=23.03.26, Route=LADYSMITH NEWCASTLE, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000535', 1, NULL, 'Delivered', '2026-03-23', 'Route: LADYSMITH NEWCASTLE', '', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000535
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000535')
WHERE TransactionNumber IN ('IN164587','IN164586','IN143818','IN164461','IN164502','IN164460','IN164458','IN164375','IN164548')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/23.03.26/NQUTU VRYHEID EDUMBE 18.03.26.xlsx: Driver=(none), Date=23.03.26, Route=NQUTU VRYHEID EDUMBE, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000536', 1, NULL, 'Delivered', '2026-03-23', 'Route: NQUTU VRYHEID EDUMBE', '', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000536
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000536')
WHERE TransactionNumber IN ('IN143884','IN023838','IN161940','IN161932','IN164390','IN164445','IN164392')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/23.03.26/PMB  18.03.26.xlsx: Driver=(none), Date=23.03.26, Route=PMB, Invoices=6
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000537', 1, NULL, 'Delivered', '2026-03-23', 'Route: PMB', '', GETDATE(), GETDATE());

-- Link 6 invoices to RF-000537
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000537')
WHERE TransactionNumber IN ('IN305304','IN143859','IN305316','IN164596','IN305318','IN143897')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/24.03.26/ESHOWE NONGOMA 24.03.26.xlsx: Driver=MZILA, Date=24.03.26, Route=ESHOWE NONGOMA, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000538', 1, 25, 'Delivered', '2026-03-24', 'Route: ESHOWE NONGOMA', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000538
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000538')
WHERE TransactionNumber IN ('IN305307','IN164600','IN023839','IN164446','IN164281','IN023840','IN164554','IN305309')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/24.03.26/IXOPO GAMALAKHE PORT SHEPSTONE 18.03.26.xlsx: Driver=NGUBANE, Date=, Route=IXOPO GAMALAKHE PORT SHEPSTONE, Invoices=13
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000539', 1, 24, 'Delivered', '2026-03-24', 'Route: IXOPO GAMALAKHE PORT SHEPSTONE', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 13 invoices to RF-000539
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000539')
WHERE TransactionNumber IN ('IN164286','IN023539','IN164602','IN164604','IN023842','IN143802','IN143914','IN143839','IN143685','IN305300','IN143840','IN164542','IN164512')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/24.03.26/JOZINI MSELENI 24.03.26.xlsx: Driver=CEBO, Date=24.03.26, Route=JOZINI MSELENI, Invoices=11
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000540', 1, 21, 'Delivered', '2026-03-24', 'Route: JOZINI MSELENI', 'CJ22DBZN', GETDATE(), GETDATE());

-- Link 11 invoices to RF-000540
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000540')
WHERE TransactionNumber IN ('IN164438','IN164533','IN164396','IN023835','IN143913','IN023841','IN163811','IN164453','IN143833','IN143838','IN164410')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/24.03.26/STANGER GREYTOWN TUGELA FERRY 24.03.26.xlsx: Driver=SIYABONGA, Date=24.03.26, Route=STANGER GREYTOWN TUGELA FERRY, Invoices=5
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000541', 1, 18, 'Delivered', '2026-03-24', 'Route: STANGER GREYTOWN TUGELA FERRY', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 5 invoices to RF-000541
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000541')
WHERE TransactionNumber IN ('IN143801','IN143788','IN164589','IN164588','IN305317')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/24.03.26/UMTATA  24.03.26.xlsx: Driver=BUHLE, Date=24.03.26, Route=UMTATA, Invoices=2
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000542', 1, 23, 'Delivered', '2026-03-24', 'Route: UMTATA', 'BK31JDZN', GETDATE(), GETDATE());

-- Link 2 invoices to RF-000542
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000542')
WHERE TransactionNumber IN ('IN164622','IN143888')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/25.03.26/DURBAN - 25.03.2026.xlsx: Driver=CEBO, Date=25.03.2026, Route=DURBAN, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000543', 1, 21, 'Delivered', '2026-03-25', 'Route: DURBAN', 'C22DBZN', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000543
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000543')
WHERE TransactionNumber IN ('IN305299','IN143883','IN305310','IN305313','IN305311','IN143962','IN305271')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/25.03.26/HLABISA RBAY -25.03.26.xlsx: Driver=NGUBANE, Date=25.03.2026, Route=HLABISA RBAY, Invoices=3
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000544', 1, 24, 'Delivered', '2026-03-25', 'Route: HLABISA RBAY', 'BH64KKZN', GETDATE(), GETDATE());

-- Link 3 invoices to RF-000544
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000544')
WHERE TransactionNumber IN ('IN143915','IN164540','IN164541')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/25.03.26/LADYSMITH NEWCASTLE - 25.03.2026.xlsx: Driver=MZILA, Date=25.03.2026, Route=LADYSMITH NEWCASTLE, Invoices=8
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000545', 1, 25, 'Delivered', '2026-03-25', 'Route: LADYSMITH NEWCASTLE', 'CJ22CJZN', GETDATE(), GETDATE());

-- Link 8 invoices to RF-000545
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000545')
WHERE TransactionNumber IN ('IN143952','IN164539','IN164659','IN164651','IN164658','IN305308','IN164655','IN143953')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/25.03.26/RICHARDS BAY HLABISA 25.03.26.xlsx: Driver=(none), Date=25.03.26, Route=RICHARDS BAY HLABISA, Invoices=4
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000546', 1, NULL, 'Delivered', '2026-03-25', 'Route: RICHARDS BAY HLABISA', '', GETDATE(), GETDATE());

-- Link 4 invoices to RF-000546
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000546')
WHERE TransactionNumber IN ('IN164638','IN143922','IN164639','IN164605')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/26.03.26/DURBAN 26.03.26.xlsx: Driver=(none), Date=26.03.26, Route=DURBAN, Invoices=9
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000547', 1, NULL, 'Delivered', '2026-03-26', 'Route: DURBAN', '', GETDATE(), GETDATE());

-- Link 9 invoices to RF-000547
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000547')
WHERE TransactionNumber IN ('IN023854','IN305319','IN164656','IN164695','IN305314','IN164653','IN164696','IN164652','IN305162')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

-- MARCH/26.03.26/NKANDLA EKOMBE  26.03.26.xlsx: Driver=SIYABONGA, Date=26.03.26, Route=NKANDLA EKOMBE, Invoices=7
INSERT INTO Loads (LoadNumber, WarehouseId, DriverId, Status, ScheduledDeliveryDate, Notes, SpecialInstructions, CreatedAt, UpdatedAt)
VALUES ('RF-000548', 1, 18, 'Delivered', '2026-03-26', 'Route: NKANDLA EKOMBE', 'CZ78BTZN', GETDATE(), GETDATE());

-- Link 7 invoices to RF-000548
UPDATE ImportedInvoices SET LoadId = (SELECT Id FROM Loads WHERE LoadNumber = 'RF-000548')
WHERE TransactionNumber IN ('IN143698','IN164334','IN164601','IN164550','IN164606','IN164339','IN164551')
AND (LoadId IS NULL OR LoadId NOT IN (SELECT Id FROM Loads WHERE WarehouseId = 1));

COMMIT;

-- ═══ Summary ═══
-- Tripsheets created: 148
-- Invoice groups linked: 1032
-- Loads with no driver: 16
-- Load numbers: RF-000401 to RF-000548

-- ═══ Verification Queries ═══
SELECT 'New KZN Loads' AS [Check], COUNT(*) AS [Count] FROM Loads WHERE WarehouseId = 1 AND LoadNumber >= 'RF-000401';
SELECT 'Linked Invoices' AS [Check], COUNT(*) AS [Count] FROM ImportedInvoices ii JOIN Loads l ON ii.LoadId = l.Id WHERE l.WarehouseId = 1 AND l.LoadNumber >= 'RF-000401';

-- Sample data:
SELECT TOP 20 l.LoadNumber, l.Status, d.FirstName AS Driver, w.Name AS Warehouse,
  CONVERT(varchar, l.ScheduledDeliveryDate, 23) AS DeliveryDate, l.Notes AS Route,
  (SELECT COUNT(*) FROM ImportedInvoices ii WHERE ii.LoadId = l.Id) AS InvoiceCount
FROM Loads l
LEFT JOIN Drivers d ON l.DriverId = d.Id
LEFT JOIN Warehouses w ON l.WarehouseId = w.Id
WHERE l.LoadNumber >= 'RF-000401'
ORDER BY l.LoadNumber;