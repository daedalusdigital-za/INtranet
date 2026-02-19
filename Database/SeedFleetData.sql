-- =============================================
-- Seed Fleet Data: Vehicle Types, Drivers, and Vehicles
-- Based on company fleet list (42 vehicles)
-- =============================================

USE ProjectTrackerDB;
GO

-- =============================================
-- 1. Seed Vehicle Types
-- =============================================
SET IDENTITY_INSERT VehicleTypes ON;

IF NOT EXISTS (SELECT 1 FROM VehicleTypes WHERE Id = 1) INSERT INTO VehicleTypes (Id, Name, Description, CreatedAt) VALUES (1, 'VAN', 'Panel Van / Delivery Van', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM VehicleTypes WHERE Id = 2) INSERT INTO VehicleTypes (Id, Name, Description, CreatedAt) VALUES (2, 'TRANSIT', 'Ford Transit', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM VehicleTypes WHERE Id = 3) INSERT INTO VehicleTypes (Id, Name, Description, CreatedAt) VALUES (3, '4 TON', '4 Ton Truck', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM VehicleTypes WHERE Id = 4) INSERT INTO VehicleTypes (Id, Name, Description, CreatedAt) VALUES (4, '8 TON', '8 Ton Truck', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM VehicleTypes WHERE Id = 5) INSERT INTO VehicleTypes (Id, Name, Description, CreatedAt) VALUES (5, '10 TON', '10 Ton Truck', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM VehicleTypes WHERE Id = 6) INSERT INTO VehicleTypes (Id, Name, Description, CreatedAt) VALUES (6, '14 TON', '14 Ton Truck', GETUTCDATE());

SET IDENTITY_INSERT VehicleTypes OFF;
GO

PRINT 'Vehicle Types seeded successfully';
GO

-- =============================================
-- 2. Seed Drivers (only where driver name provided)
-- =============================================
SET IDENTITY_INSERT Drivers ON;

-- GP Drivers
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 1) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (1, 'Lungelo', '-', 'GP-DRV-001', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 2) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (2, 'Sthe', '-', 'GP-DRV-002', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 3) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (3, 'Sphephelo', '-', 'GP-DRV-004', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 4) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (4, 'Zola', '-', 'GP-DRV-006', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 5) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (5, 'Pastor', '-', 'GP-DRV-007', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 6) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (6, 'Lindo', '-', 'GP-DRV-008', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 7) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (7, 'Zwelethu', '-', 'GP-DRV-009', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 8) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (8, 'George', '-', 'GP-DRV-010', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 9) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (9, 'Phiwe', '-', 'GP-DRV-011', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 10) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (10, 'Sandile', '-', 'GP-DRV-012', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 11) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (11, 'Mabena', '-', 'GP-DRV-013', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 12) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (12, 'Bongakosi', '-', 'GP-DRV-014', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 13) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (13, 'Mfundo', '-', 'GP-DRV-016', 'EC1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 14) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (14, 'Ngobese', '-', 'GP-DRV-017', 'EC1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 15) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (15, 'Sanele', '-', 'GP-DRV-018', 'EC1', 'Active', GETUTCDATE());

-- KZN Drivers
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 16) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (16, 'Anesh', '-', 'KZN-DRV-019', 'B', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 17) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (17, 'Nhkala', '-', 'KZN-DRV-020', 'B', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 18) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (18, 'Siyabonga', '-', 'KZN-DRV-021', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 19) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (19, 'Deon', '-', 'KZN-DRV-022', 'B', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 20) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (20, 'Sizwe', '-', 'KZN-DRV-023', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 21) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (21, 'Cebo', '-', 'KZN-DRV-024', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 22) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (22, 'AJ', '-', 'KZN-DRV-025', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 23) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (23, 'Buhle', '-', 'KZN-DRV-026', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 24) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (24, 'Ngubane', '-', 'KZN-DRV-027', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 25) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (25, 'Mzila', '-', 'KZN-DRV-028', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 26) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (26, 'Lucas', '-', 'KZN-DRV-029', 'EC', 'Active', GETUTCDATE());

-- PE Drivers
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 27) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (27, 'Simo', '-', 'PE-DRV-031', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 28) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (28, 'Sihle', '-', 'PE-DRV-032', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 29) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (29, 'Phumlani', '-', 'PE-DRV-033', 'EC', 'Active', GETUTCDATE());

-- CPT Drivers
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 30) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (30, 'Jim', '-', 'CPT-DRV-034', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 31) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (31, 'Mthokosizi', '-', 'CPT-DRV-037', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 32) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (32, 'Sabelo', '-', 'CPT-DRV-038', 'C1', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 33) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (33, 'Khumalani', '-', 'CPT-DRV-039', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 34) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (34, 'Mafannfuthi', '-', 'CPT-DRV-040', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 35) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (35, 'Phila', '-', 'CPT-DRV-041', 'EC', 'Active', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Drivers WHERE Id = 36) INSERT INTO Drivers (Id, FirstName, LastName, LicenseNumber, LicenseType, Status, CreatedAt) VALUES (36, 'Zolani', '-', 'CPT-DRV-042', 'EC', 'Active', GETUTCDATE());

SET IDENTITY_INSERT Drivers OFF;
GO

PRINT 'Drivers seeded successfully';
GO

-- =============================================
-- 3. Seed Vehicles (42 vehicles)
-- =============================================
SET IDENTITY_INSERT Vehicles ON;

-- GP Vehicles (1-18)
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 1) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (1, 'DJ25NRZN', 'Isuzu', '4 Ton', 3, 1, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 2) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (2, 'CZ78CYZN', 'Ford', 'Transit', 2, 2, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 3) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (3, 'CY46XCZN', 'Isuzu', '4 Ton', 3, NULL, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 4) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (4, 'DJ25NTZN', 'Isuzu', '4 Ton', 3, 3, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 5) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (5, 'DJ25NNZN', 'Isuzu', '4 Ton', 3, NULL, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 6) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (6, 'BP61LLZN', 'Isuzu', '4 Ton', 3, 4, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 7) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (7, 'BJ87PFZN', 'Isuzu', '8 Ton', 4, 5, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 8) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (8, 'BJ87CDZN', 'Isuzu', '8 Ton', 4, 6, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 9) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (9, 'BM38CTZN', 'Isuzu', '8 Ton', 4, 7, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 10) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (10, 'BT02TYZN', 'Isuzu', '8 Ton', 4, 8, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 11) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (11, 'BS70TMZN', 'Isuzu', '8 Ton', 4, 9, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 12) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (12, 'BM37WCZN', 'Isuzu', '8 Ton', 4, 10, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 13) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (13, 'BJ87SJZN', 'Isuzu', '8 Ton', 4, 11, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 14) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (14, 'BJ87TBZN', 'Isuzu', '8 Ton', 4, 12, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 15) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (15, 'BK31KFZN', 'Isuzu', '10 Ton', 5, NULL, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 16) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (16, 'BB59LZZN', 'Isuzu', '14 Ton', 6, 13, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 17) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (17, 'BB59MTZN', 'Isuzu', '14 Ton', 6, 14, 'GP', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 18) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (18, 'BB59KXZN', 'Isuzu', '14 Ton', 6, 15, 'GP', 'Available', 'Diesel', GETUTCDATE());

-- KZN Vehicles (19-30)
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 19) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (19, 'CT11SJZN', 'Toyota', 'Van', 1, 16, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 20) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (20, 'BD15GNZN', 'Toyota', 'Van', 1, 17, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 21) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (21, 'CZ78BTZN', 'Ford', 'Transit', 2, 18, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 22) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (22, 'BH30ZZN', 'Toyota', 'Van', 1, 19, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 23) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (23, 'DJ25NLZN', 'Isuzu', '4 Ton', 3, 20, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 24) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (24, 'BH30XFZN', 'Isuzu', '4 Ton', 3, 21, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 25) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (25, 'BJ87RSZN', 'Isuzu', '8 Ton', 4, 22, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 26) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (26, 'BK31JDZN', 'Isuzu', '8 Ton', 4, 23, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 27) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (27, 'BK64KKZN', 'Isuzu', '8 Ton', 4, 24, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 28) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (28, 'CJ22CJZN', 'Isuzu', '8 Ton', 4, 25, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 29) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (29, 'CJ22DBZN', 'Isuzu', '8 Ton', 4, 26, 'KZN', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 30) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (30, 'BT55ZFZN', 'Isuzu', '8 Ton', 4, NULL, 'KZN', 'Available', 'Diesel', GETUTCDATE());

-- PE Vehicles (31-33)
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 31) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (31, 'BK31HNZN', 'Isuzu', '8 Ton', 4, 27, 'PE', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 32) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (32, 'BJ94MNZN', 'Isuzu', '8 Ton', 4, 28, 'PE', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 33) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (33, 'BN68CGZN', 'Isuzu', '8 Ton', 4, 29, 'PE', 'Available', 'Diesel', GETUTCDATE());

-- CPT Vehicles (34-42)
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 34) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (34, 'LP65PGGP', 'Ford', 'Transit', 2, 30, 'CPT', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 35) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (35, 'BH30XNZN', 'Isuzu', '4 Ton', 3, NULL, 'CPT', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 36) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (36, 'BP61KYZN', 'Isuzu', '4 Ton', 3, NULL, 'CPT', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 37) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (37, 'CY46YGZN', 'Isuzu', '4 Ton', 3, 31, 'CPT', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 38) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (38, 'CY47CHZN', 'Isuzu', '4 Ton', 3, 32, 'CPT', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 39) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (39, 'BH30YXZN', 'Isuzu', '8 Ton', 4, 33, 'CPT', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 40) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (40, 'BK31GJZN', 'Isuzu', '8 Ton', 4, 34, 'CPT', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 41) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (41, 'BH64JJZN', 'Isuzu', '8 Ton', 4, 35, 'CPT', 'Available', 'Diesel', GETUTCDATE());
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE Id = 42) INSERT INTO Vehicles (Id, RegistrationNumber, Make, Model, VehicleTypeId, CurrentDriverId, Province, Status, FuelType, CreatedAt) VALUES (42, 'CS70DXZN', 'Isuzu', '8 Ton', 4, 36, 'CPT', 'Available', 'Diesel', GETUTCDATE());

SET IDENTITY_INSERT Vehicles OFF;
GO

PRINT 'Vehicles seeded successfully';
GO

-- =============================================
-- 4. Verify
-- =============================================
SELECT 'VehicleTypes' as TableName, COUNT(*) as RecordCount FROM VehicleTypes
UNION ALL SELECT 'Drivers', COUNT(*) FROM Drivers
UNION ALL SELECT 'Vehicles', COUNT(*) FROM Vehicles;

SELECT Province, COUNT(*) as VehicleCount FROM Vehicles GROUP BY Province ORDER BY Province;
GO
