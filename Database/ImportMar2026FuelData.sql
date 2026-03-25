-- =============================================
-- Import March 2026 Fuel Transactions
-- =============================================

-- Add new vehicle: MH05YYGP (Masi Rep vehicle)
IF NOT EXISTS (SELECT 1 FROM Vehicles WHERE RegistrationNumber = 'MH05YYGP')
    INSERT INTO Vehicles (RegistrationNumber, Make, Model, VehicleTypeId, Province, Status, FuelType, CreatedAt)
    VALUES ('MH05YYGP', 'Unknown', 'Masi Rep', 1, 'Gauteng', 'Available', 'Diesel', GETUTCDATE());

PRINT 'New vehicle MH05YYGP added.';
GO

-- Clear existing Mar 2026 data to allow re-import
DELETE FROM FuelTransactions WHERE ReportMonth = 3 AND ReportYear = 2026;

-- Insert all fuel transactions from March 2026 report
INSERT INTO FuelTransactions (VehicleId, RegistrationNumber, CardNumber, DepotName, AllocationLitres, LitresUsed, TransactionDate, AmountSpent, DepotAssignment, ReportMonth, ReportYear, CreatedAt)
SELECT v.Id, t.RegistrationNumber, t.CardNumber, t.DepotName, t.AllocationLitres, t.LitresUsed, t.TransactionDate, t.AmountSpent, t.DepotAssignment, 3, 2026, GETUTCDATE()
FROM (VALUES
-- BB56YCZN (670243) - KZN - LINK
('BB56YCZN', '670243', 'Hoofweg Motors - Prince Albert Road', 800, 545.55, '2026-03-03 22:34:00', 9511.12, 'KZN - LINK'),
('BB56YCZN', '670243', 'Mega Fuel - Hanover', 800, 482.87, '2026-03-02 14:05:00', 8540.52, 'KZN - LINK'),
('BB56YCZN', '670243', 'Tugela Truck Inn - Ladysmith', 800, 553.41, '2026-03-06 04:04:00', 10054.35, 'KZN - LINK'),
('BB56YCZN', '670243', 'Remoho Fuel Petroleum - Bloemfontein', 800, 486.00, '2026-03-04 23:57:00', 9034.25, 'KZN - LINK'),
('BB56YCZN', '670243', 'Engen Truck Stop Swartkops - Port Elizabeth', 800, 488.08, '2026-03-18 15:16:00', 9619.57, 'KZN - LINK'),
('BB56YCZN', '670243', 'Hoofweg Motors - Prince Albert Road', 800, 440.84, '2026-03-16 23:32:00', 7972.15, 'KZN - LINK'),
('BB56YCZN', '670243', 'Bethlehem Diesel - Bethlehem', 800, 495.00, '2026-03-15 23:35:00', 9710.42, 'KZN - LINK'),
('BB56YCZN', '670243', 'Truck Station - Umgeni', 800, 544.25, '2026-03-10 09:44:00', 9638.19, 'KZN - LINK'),
('BB56YCZN', '670243', 'Sasol N3 Truck Stop - Vrede', 800, 521.00, '2026-03-09 09:03:00', 9473.86, 'KZN - LINK'),
('BB56YCZN', '670243', 'Andy''s Truckport - Port Elizabeth', 800, 520.99, '2026-03-13 22:38:00', 10629.21, 'KZN - LINK'),
('BB56YCZN', '670243', 'Engen Truck Stop EDC - Kokstad', 800, 394.04, '2026-03-14 10:46:00', 7210.54, 'KZN - LINK'),
('BB56YCZN', '670243', 'Engen Marburg Truck Stop EDC - P Shepstone', 800, 527.09, '2026-03-12 21:07:00', 9964.64, 'KZN - LINK'),
-- BB59KXZN (377959) - GP - 14 TON
('BB59KXZN', '377959', 'Big 5 Fuel - Bronkhorstspruit', 380, 278.00, '2026-03-06 19:00:00', 5154.68, 'GP - 14 TON'),
('BB59KXZN', '377959', 'Big 5 Fuel - Bronkhorstspruit', 380, 210.00, '2026-03-04 20:17:00', 3893.82, 'GP - 14 TON'),
('BB59KXZN', '377959', 'Arcy Diesel Depot - Kimberley', 380, 205.00, '2026-03-10 09:24:00', 3827.15, 'GP - 14 TON'),
('BB59KXZN', '377959', 'Astron Energy Orchards - Nelspruit', 380, 210.15, '2026-03-13 08:05:00', 3818.22, 'GP - 14 TON'),
-- BB59MTZN (969201) - GP - 14 TON
('BB59MTZN', '969201', 'Tugela Truck Inn - Ladysmith', 380, 170.60, '2026-03-05 22:22:00', 3099.46, 'GP - 14 TON'),
('BB59MTZN', '969201', 'Tugela Truck Inn - Ladysmith', 0, 0.00, '2026-03-05 22:42:00', 182.00, 'GP - 14 TON'),
('BB59MTZN', '969201', 'Sasol N3 Truck Stop - Vrede', 380, 160.10, '2026-03-05 01:24:00', 2911.26, 'GP - 14 TON'),
('BB59MTZN', '969201', 'Sasol N3 Truck Stop - Vrede', 0, 0.00, '2026-03-05 01:42:00', 176.00, 'GP - 14 TON'),
('BB59MTZN', '969201', 'WBG - Ermelo', 380, 290.00, '2026-03-16 15:06:00', 5400.38, 'GP - 14 TON'),
('BB59MTZN', '969201', 'Remoho Fuel Petroleum - Bloemfontein', 315, 170.00, '2026-03-10 15:02:00', 3415.13, 'GP - 14 TON'),
('BB59MTZN', '969201', 'Big 5 Fuel - Bronkhorstspruit', 380, 293.00, '2026-03-11 22:48:00', 5432.81, 'GP - 14 TON'),
-- BF87WWZN (762492) - CPT - TRANSIT
('BF87WWZN', '762492', 'BP Kempston Truck Stop - Bloemfontein', 80, 73.91, '2026-03-01 20:26:00', 1325.87, 'CPT -TRANSIT'),
('BF87WWZN', '762492', 'BP Kempston Truck Stop - Bloemfontein', 80, 66.50, '2026-03-05 15:22:00', 1236.21, 'CPT -TRANSIT'),
('BF87WWZN', '762492', 'Fuel 1 - Paarden Eiland', 80, 80.00, '2026-03-17 16:09:00', 1616.80, 'CPT -TRANSIT'),
('BF87WWZN', '762492', 'Trawal Truck Inn', 80, 65.00, '2026-03-16 08:19:00', 1253.92, 'CPT -TRANSIT'),
('BF87WWZN', '762492', 'Fuel 1 - Paarden Eiland', 80, 80.00, '2026-03-21 23:33:00', 1821.60, 'CPT -TRANSIT'),
('BF87WWZN', '762492', 'Fuel 1 - Paarden Eiland', 80, 47.41, '2026-03-22 13:44:00', 1079.53, 'CPT -TRANSIT'),
('BF87WWZN', '762492', 'Engen Truck Stop EDC - Beaufort West', 80, 40.63, '2026-03-15 11:04:00', 754.30, 'CPT -TRANSIT'),
('BF87WWZN', '762492', 'BP Kempston Truck Stop - Bloemfontein', 80, 80.00, '2026-03-10 10:52:00', 1487.12, 'CPT -TRANSIT'),
('BF87WWZN', '762492', 'BP Kempston Truck Stop - Bloemfontein', 80, 67.22, '2026-03-14 09:57:00', 1424.32, 'CPT -TRANSIT'),
-- BH64KKZN (763687) - KZN - 8 TON
('BH64KKZN', '763687', 'Truck Station - Umgeni', 315, 256.85, '2026-03-02 15:58:00', 4381.60, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Tembuland Gas Fuels - Umtata', 315, 270.00, '2026-03-05 11:31:00', 5039.01, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Mooi River Truck Stop', 315, 204.00, '2026-03-17 05:18:00', 4132.22, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Tongaat Fuel', 315, 196.48, '2026-03-16 06:12:00', 3508.94, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Oilco - Empangeni', 315, 228.00, '2026-03-18 14:24:00', 5018.51, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Oilco - Umbilo', 315, 284.39, '2026-03-22 18:55:00', 7311.38, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Lion Park Truck Stop - Ashburton', 0, 0.00, '2026-03-19 14:17:00', 935.00, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Oilco - Vryheid', 315, 166.08, '2026-03-10 15:04:00', 3054.05, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Trimborn Agency - Pietermaritzburg', 315, 240.00, '2026-03-09 11:49:00', 4294.80, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Truck Station - Umgeni', 315, 236.98, '2026-03-12 06:22:00', 4374.45, 'KZN - 8 TON'),
('BH64KKZN', '763687', 'Lion Park Truck Stop - Ashburton', 0, 0.00, '2026-03-12 13:19:00', 935.00, 'KZN - 8 TON'),
-- BJ87SJZN (460413) - GP - 8 TON
('BJ87SJZN', '460413', 'Sydney Road Truck Stop - Durban', 315, 235.01, '2026-03-23 18:44:00', 5668.21, 'GP - 8 TON'),
('BJ87SJZN', '460413', 'Mass Petroleum - Ellisras', 315, 254.28, '2026-03-03 19:50:00', 4729.61, 'GP - 8 TON'),
('BJ87SJZN', '460413', 'Eden Oil - Louis Trichardt', 315, 178.17, '2026-03-05 17:11:00', 3429.73, 'GP - 8 TON'),
('BJ87SJZN', '460413', 'Bethlehem Diesel - Bethlehem', 315, 168.77, '2026-03-17 09:37:00', 3310.76, 'GP - 8 TON'),
('BJ87SJZN', '460413', 'Big 5 Fuel - Bronkhorstspruit', 315, 200.00, '2026-03-10 04:49:00', 3708.40, 'GP - 8 TON'),
('BJ87SJZN', '460413', 'MBT Zeerust Truck Stop', 315, 192.16, '2026-03-11 12:21:00', 3671.99, 'GP - 8 TON'),
-- BJ87TBZN (249029) - GP - 8 TON
('BJ87TBZN', '249029', 'Bethlehem Diesel - Bethlehem', 315, 146.53, '2026-03-06 13:01:00', 2701.57, 'GP - 8 TON'),
('BJ87TBZN', '249029', 'Iceberg Truck Stop - Heilbron', 315, 175.00, '2026-03-05 09:11:00', 3258.85, 'GP - 8 TON'),
('BJ87TBZN', '249029', 'Marble Truck Stop - Marble Hall', 315, 189.00, '2026-03-18 14:33:00', 3958.79, 'GP - 8 TON'),
('BJ87TBZN', '249029', 'PPS - Tzaneen', 315, 152.30, '2026-03-17 10:31:00', 2931.78, 'GP - 8 TON'),
('BJ87TBZN', '249029', 'Big 5 Fuel - Bronkhorstspruit', 315, 173.83, '2026-03-20 06:49:00', 4417.37, 'GP - 8 TON'),
('BJ87TBZN', '249029', 'Rousseau Vulstasie - Lichtenburg', 315, 220.07, '2026-03-10 11:45:00', 4169.45, 'GP - 8 TON'),
('BJ87TBZN', '249029', 'PPS - Tzaneen', 315, 130.00, '2026-03-09 18:34:00', 2502.50, 'GP - 8 TON'),
('BJ87TBZN', '249029', 'Big 5 Fuel - Bronkhorstspruit', 315, 139.00, '2026-03-13 05:16:00', 2577.34, 'GP - 8 TON'),
('BJ87TBZN', '249029', 'Shiptech Petroleum - City Deep', 315, 241.00, '2026-03-11 18:11:00', 4463.80, 'GP - 8 TON'),
-- BJ87TWZN (431679) - GP - 8 TON
('BJ87TWZN', '431679', 'Mams Mega Stop - Vryburg', 315, 240.00, '2026-03-05 09:18:00', 4495.20, 'GP - 8 TON'),
('BJ87TWZN', '431679', 'Big 5 Fuel - Bronkhorstspruit', 315, 150.00, '2026-03-18 05:29:00', 2781.30, 'GP - 8 TON'),
('BJ87TWZN', '431679', 'Royale Energy - Polokwane', 315, 266.00, '2026-03-16 19:11:00', 5120.50, 'GP - 8 TON'),
('BJ87TWZN', '431679', 'Quattro Fuels - Coligny', 315, 302.00, '2026-03-19 08:55:00', 7322.29, 'GP - 8 TON'),
('BJ87TWZN', '431679', 'Bethlehem Diesel - Bethlehem', 315, 270.05, '2026-03-09 21:45:00', 4978.91, 'GP - 8 TON'),
('BJ87TWZN', '431679', 'Astron Energy Riverside - Nelspruit', 315, 279.00, '2026-03-11 17:10:00', 5214.23, 'GP - 8 TON'),
-- BJ94MNZN (605999) - PE - 8 TON
('BJ94MNZN', '605999', 'Andy''s Truckport - Port Elizabeth', 350, 108.43, '2026-03-03 06:57:00', 1849.71, 'PE - 8 TON'),
('BJ94MNZN', '605999', 'Andy''s Truckport - Port Elizabeth', 315, 148.59, '2026-03-09 06:27:00', 2631.38, 'PE - 8 TON'),
('BJ94MNZN', '605999', 'Tembuland Gas Fuels - Umtata', 350, 246.79, '2026-03-06 13:24:00', 4605.84, 'PE - 8 TON'),
('BJ94MNZN', '605999', 'Andy''s Truckport - Port Elizabeth', 350, 198.07, '2026-03-18 07:14:00', 3586.85, 'PE - 8 TON'),
('BJ94MNZN', '605999', 'Andy''s Truckport - Port Elizabeth', 350, 111.91, '2026-03-11 05:29:00', 1981.81, 'PE - 8 TON'),
('BJ94MNZN', '605999', 'Tembuland Gas Fuels - Umtata', 350, 272.54, '2026-03-13 13:46:00', 5086.41, 'PE - 8 TON'),
('BJ94MNZN', '605999', 'Andy''s Truckport - Port Elizabeth', 350, 135.79, '2026-03-12 05:19:00', 2404.71, 'PE - 8 TON'),
('BJ94MNZN', '605999', 'Andy''s Truckport - Port Elizabeth', 350, 158.76, '2026-03-22 18:33:00', 2810.05, 'PE - 8 TON'),
-- BK31GJZN (528251) - KZN - 8 TON
('BK31GJZN', '528251', 'Quest - Beaufort West', 315, 185.00, '2026-03-04 08:01:00', 3375.33, 'KZN - 8 TON'),
('BK31GJZN', '528251', 'Engen Kempston Truck Stop - Epping', 315, 139.56, '2026-03-03 04:05:00', 2454.72, 'KZN - 8 TON'),
('BK31GJZN', '528251', 'Engen Kempston Truck Stop - Epping', 315, 150.75, '2026-03-02 04:51:00', 2651.54, 'KZN - 8 TON'),
('BK31GJZN', '528251', 'Andy''s Truckport - Port Elizabeth', 315, 140.00, '2026-03-09 05:48:00', 2479.26, 'KZN - 8 TON'),
('BK31GJZN', '528251', 'Andy''s Truckport - Port Elizabeth', 315, 200.00, '2026-03-22 18:38:00', 3941.80, 'KZN - 8 TON'),
('BK31GJZN', '528251', 'Andy''s Truckport - Port Elizabeth', 315, 140.02, '2026-03-13 00:45:00', 2479.61, 'KZN - 8 TON'),
('BK31GJZN', '528251', 'Engen Kempston Truck Stop - East London', 315, 200.00, '2026-03-13 16:57:00', 3643.80, 'KZN - 8 TON'),
('BK31GJZN', '528251', 'Andy''s Truckport - Port Elizabeth', 315, 199.06, '2026-03-11 20:37:00', 3525.15, 'KZN - 8 TON'),
-- BK31HNZN (704229) - GP - 8 TON
('BK31HNZN', '704229', 'Express Petroleum - George', 315, 239.77, '2026-03-04 08:49:00', 4294.52, 'GP - 8 TON'),
('BK31HNZN', '704229', 'Engen Kempston Truck Stop - Epping', 315, 249.00, '2026-03-01 23:46:00', 4379.66, 'GP - 8 TON'),
('BK31HNZN', '704229', 'Andy''s Truckport - Port Elizabeth', 315, 240.03, '2026-03-03 03:39:00', 4094.67, 'GP - 8 TON'),
('BK31HNZN', '704229', 'Andy''s Truckport - Port Elizabeth', 0, 0.00, '2026-03-03 15:15:00', 935.00, 'GP - 8 TON'),
('BK31HNZN', '704229', 'Fuel 1 - Paarden Eiland', 315, 200.72, '2026-03-17 21:03:00', 4056.55, 'GP - 8 TON'),
('BK31HNZN', '704229', 'Andy''s Truckport - Port Elizabeth', 315, 216.53, '2026-03-10 19:27:00', 3834.53, 'GP - 8 TON'),
('BK31HNZN', '704229', 'Andy''s Truckport - Port Elizabeth', 0, 0.00, '2026-03-10 19:25:00', 1403.00, 'GP - 8 TON'),
('BK31HNZN', '704229', 'Express Petroleum - George', 315, 250.53, '2026-03-09 08:36:00', 4487.24, 'GP - 8 TON'),
-- BK31JDZN (573282) - KZN - 8 TON
('BK31JDZN', '573282', 'Lion Park Truck Stop - Ashburton', 315, 256.61, '2026-03-03 07:13:00', 5245.48, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Mooi River Truck Stop', 315, 124.00, '2026-03-04 05:21:00', 2236.46, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Oilco - Umbilo', 0, 0.00, '2026-03-02 04:28:00', 1400.00, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Truck Station - Umgeni', 315, 207.18, '2026-03-05 13:16:00', 3668.97, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Oilco - Umbilo', 315, 269.80, '2026-03-02 04:32:00', 4602.52, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Tongaat Fuel', 315, 100.00, '2026-03-09 07:08:00', 1785.90, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Tembuland Gas Fuels - Umtata', 315, 276.73, '2026-03-17 15:28:00', 5164.61, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Oilco - Umbilo', 315, 228.59, '2026-03-19 03:24:00', 4962.46, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Truck Station - Umgeni', 315, 100.00, '2026-03-21 11:23:00', 2445.90, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Highway Petroleum - Vryheid', 315, 275.70, '2026-03-23 12:52:00', 6318.77, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Tembuland Gas Fuels - Umtata', 315, 270.00, '2026-03-20 08:16:00', 5039.01, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Tembuland Gas Fuels - Umtata', 315, 215.16, '2026-03-11 08:12:00', 4015.53, 'KZN - 8 TON'),
('BK31JDZN', '573282', 'Highway Petroleum - Vryheid', 315, 217.02, '2026-03-12 10:08:00', 3960.40, 'KZN - 8 TON'),
-- BM37WCZN (178462) - GP - 8 TON
('BM37WCZN', '178462', 'Engen Truck Stop EDC - Kokstad', 315, 268.04, '2026-03-16 21:15:00', 4904.86, 'GP - 8 TON'),
('BM37WCZN', '178462', 'Villiers - Vaal Truck Inn', 315, 178.43, '2026-03-19 01:10:00', 4753.65, 'GP - 8 TON'),
-- BM37WZZN (860049) - KZN - LINK
('BM37WZZN', '860049', 'Cato Ridge Truck Stop', 800, 622.01, '2026-03-03 00:42:00', 10619.58, 'KZN - LINK'),
('BM37WZZN', '860049', 'Villiers - Vaal Truck Inn', 800, 524.62, '2026-03-04 00:00:00', 9701.20, 'KZN - LINK'),
('BM37WZZN', '860049', 'East London Truck Stop (Ropax)', 800, 695.65, '2026-03-02 03:22:00', 11950.57, 'KZN - LINK'),
('BM37WZZN', '860049', 'Econo - Grootvlei', 800, 507.63, '2026-03-06 23:05:00', 9402.32, 'KZN - LINK'),
('BM37WZZN', '860049', 'Engen Truck Stop EDC - Kokstad', 800, 675.34, '2026-03-07 22:54:00', 12358.05, 'KZN - LINK'),
('BM37WZZN', '860049', 'Shiptech Petroleum - Harrismith', 800, 529.00, '2026-03-05 03:28:00', 9653.72, 'KZN - LINK'),
('BM37WZZN', '860049', 'Tembuland Gas Fuels - Umtata', 800, 540.92, '2026-03-17 10:25:00', 10095.19, 'KZN - LINK'),
('BM37WZZN', '860049', 'Engen Truck Stop EDC - Kokstad', 800, 614.18, '2026-03-15 21:45:00', 11238.88, 'KZN - LINK'),
('BM37WZZN', '860049', 'Shiptech Petroleum - Harrismith', 800, 450.00, '2026-03-20 22:25:00', 10313.55, 'KZN - LINK'),
('BM37WZZN', '860049', 'Shiptech Petroleum - Harrismith', 800, 662.00, '2026-03-19 00:45:00', 13550.48, 'KZN - LINK'),
('BM37WZZN', '860049', 'Mass Petroleum - Cato Ridge', 800, 652.68, '2026-03-10 16:16:00', 11567.45, 'KZN - LINK'),
('BM37WZZN', '860049', 'Tembuland Gas Fuels - Umtata', 800, 547.78, '2026-03-09 11:22:00', 10223.22, 'KZN - LINK'),
('BM37WZZN', '860049', 'Cato Ridge Truck Stop', 800, 563.17, '2026-03-12 23:01:00', 10572.39, 'KZN - LINK'),
('BM37WZZN', '860049', 'Econo - Grootvlei', 800, 537.58, '2026-03-13 20:19:00', 11150.48, 'KZN - LINK'),
-- BM38CTZN (127213) - GP - 8 TON
('BM38CTZN', '127213', 'WBG - Germiston', 315, 170.00, '2026-03-06 10:39:00', 3148.74, 'GP - 8 TON'),
('BM38CTZN', '127213', 'Big 5 Fuel - Bronkhorstspruit', 315, 237.00, '2026-03-16 06:47:00', 4394.45, 'GP - 8 TON'),
('BM38CTZN', '127213', 'Astron Energy Orchards - Nelspruit', 315, 240.00, '2026-03-09 19:58:00', 4360.49, 'GP - 8 TON'),
('BM38CTZN', '127213', 'PPS - Tzaneen', 315, 221.14, '2026-03-11 14:10:00', 4256.95, 'GP - 8 TON'),
-- BN68CGZN (157888) - PE - 8 TON
('BN68CGZN', '157888', 'Engen Kempston Truck Stop - East London', 315, 236.20, '2026-03-05 13:05:00', 4303.31, 'PE - 8 TON'),
('BN68CGZN', '157888', 'Andy''s Truckport - Port Elizabeth', 315, 292.33, '2026-03-02 07:27:00', 4986.86, 'PE - 8 TON'),
('BN68CGZN', '157888', 'Andy''s Truckport - Port Elizabeth', 315, 262.00, '2026-03-17 07:02:00', 4639.76, 'PE - 8 TON'),
('BN68CGZN', '157888', 'Astron Energy - Komani', 315, 153.24, '2026-03-18 16:47:00', 3252.98, 'PE - 8 TON'),
('BN68CGZN', '157888', 'Andy''s Truckport - Port Elizabeth', 315, 87.01, '2026-03-22 18:39:00', 1714.88, 'PE - 8 TON'),
('BN68CGZN', '157888', 'Astron Energy - Komani', 315, 248.09, '2026-03-09 16:57:00', 4575.03, 'PE - 8 TON'),
('BN68CGZN', '157888', 'Engen Kempston Truck Stop - East London', 315, 237.00, '2026-03-11 20:18:00', 4317.90, 'PE - 8 TON'),
-- BP61LLZN (917784) - GP - 4 TON
('BP61LLZN', '917784', 'Big 5 Fuel - Bronkhorstspruit', 180, 133.96, '2026-03-04 03:49:00', 2483.89, 'GP - 4 TON'),
('BP61LLZN', '917784', 'Big 5 Fuel - Bronkhorstspruit', 180, 134.40, '2026-03-02 04:51:00', 2404.68, 'GP - 4 TON'),
('BP61LLZN', '917784', 'Shiptech Petroleum - City Deep', 180, 139.00, '2026-03-04 15:56:00', 2574.56, 'GP - 4 TON'),
('BP61LLZN', '917784', 'Big 5 Fuel - Bronkhorstspruit', 180, 119.00, '2026-03-06 04:35:00', 2206.50, 'GP - 4 TON'),
('BP61LLZN', '917784', 'Zambesi Truck Stop - Pretoria', 180, 92.57, '2026-03-16 07:32:00', 1755.31, 'GP - 4 TON'),
('BP61LLZN', '917784', 'Big 5 Fuel - Bronkhorstspruit', 180, 101.00, '2026-03-18 18:52:00', 1872.74, 'GP - 4 TON'),
('BP61LLZN', '917784', 'Shiptech Petroleum - City Deep', 180, 132.00, '2026-03-11 03:50:00', 2444.90, 'GP - 4 TON'),
('BP61LLZN', '917784', 'Big 5 Fuel - Bronkhorstspruit', 180, 140.00, '2026-03-10 05:57:00', 2595.88, 'GP - 4 TON'),
('BP61LLZN', '917784', 'Bruco Petroleum - Vanderbijlpark', 180, 143.69, '2026-03-11 17:01:00', 2661.43, 'GP - 4 TON'),
('BP61LLZN', '917784', 'MBT Zeerust Truck Stop', 180, 115.31, '2026-03-12 12:22:00', 2271.49, 'GP - 4 TON'),
-- BS70TMZN (366280) - GP - 8 TON
('BS70TMZN', '366280', 'Astron Energy Orchards - Nelspruit', 190, 190.00, '2026-03-19 07:06:00', 3655.41, 'GP - 8 TON'),
('BS70TMZN', '366280', 'Shiptech Petroleum - City Deep', 190, 190.00, '2026-03-10 12:57:00', 3519.18, 'GP - 8 TON'),
('BS70TMZN', '366280', 'Astron Energy Milly''s - Machadodorp', 190, 190.00, '2026-03-11 10:32:00', 3430.64, 'GP - 8 TON'),
-- BT02TYZN (108295) - GP - 8 TON
('BT02TYZN', '108295', 'PPS - Tzaneen', 190, 190.00, '2026-03-17 16:35:00', 3657.50, 'GP - 8 TON'),
('BT02TYZN', '108295', 'Oilco - Umbilo', 190, 190.00, '2026-03-23 11:05:00', 4884.71, 'GP - 8 TON'),
('BT02TYZN', '108295', 'Truck Station - Bloemfontein', 190, 100.00, '2026-03-18 19:32:00', 2258.90, 'GP - 8 TON'),
('BT02TYZN', '108295', 'BP Kempston Truck Stop - Bloemfontein', 190, 190.00, '2026-03-19 16:38:00', 4025.91, 'GP - 8 TON'),
('BT02TYZN', '108295', 'Big 5 Fuel - Bronkhorstspruit', 190, 190.00, '2026-03-09 20:55:00', 3522.98, 'GP - 8 TON'),
('BT02TYZN', '108295', 'BP Kempston Truck Stop - Bloemfontein', 190, 190.00, '2026-03-11 14:21:00', 3531.91, 'GP - 8 TON'),
-- BT55ZFZN (199263) - GP - 8 TON
('BT55ZFZN', '199263', 'Shiptech Petroleum - City Deep', 300, 212.00, '2026-03-06 11:04:00', 3926.66, 'GP - 8 TON'),
('BT55ZFZN', '199263', 'Truck Station - Bloemfontein', 300, 202.09, '2026-03-17 10:35:00', 4565.01, 'GP - 8 TON'),
('BT55ZFZN', '199263', 'Bethlehem Diesel - Bethlehem', 300, 300.00, '2026-03-18 19:48:00', 5885.10, 'GP - 8 TON'),
('BT55ZFZN', '199263', 'Truck Station - Randfontein', 300, 212.00, '2026-03-09 10:54:00', 3930.90, 'GP - 8 TON'),
-- BZ05CJZN (580873) - KZN - LINK
('BZ05CJZN', '580873', 'Tugela Truck Inn - Ladysmith', 0, 0.00, '2026-03-03 12:40:00', 182.00, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Tugela Truck Inn - Ladysmith', 800, 588.30, '2026-03-02 23:46:00', 10305.84, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Tugela Truck Inn - Ladysmith', 800, 590.71, '2026-03-06 01:44:00', 10732.02, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Big 5 Fuel - Bronkhorstspruit', 800, 400.00, '2026-03-06 21:16:00', 7416.80, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Engen Marburg Truck Stop EDC - P Shepstone', 800, 554.11, '2026-03-08 11:19:00', 9921.34, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Truck Station - Umgeni', 800, 708.44, '2026-03-16 19:09:00', 13077.09, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Mooi River Truck Stop', 0, 0.00, '2026-03-21 02:03:00', 176.00, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Mooi River Truck Stop', 800, 660.14, '2026-03-21 02:16:00', 14989.14, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Mass Petroleum - Cato Ridge', 800, 569.61, '2026-03-23 15:39:00', 12772.37, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Mass Petroleum - Cato Ridge', 800, 679.83, '2026-03-18 19:46:00', 13578.24, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Highway Junction - Harrismith', 0, 0.00, '2026-03-19 04:02:00', 180.00, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Highway Junction - Harrismith', 0, 0.00, '2026-03-20 04:10:00', 180.00, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Ikamva Fuel - Mosselbay', 800, 480.00, '2026-03-11 08:55:00', 8605.92, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Engen Truck Stop Swartkops - Port Elizabeth', 800, 646.28, '2026-03-09 16:40:00', 11444.97, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Mooi River Truck Stop', 800, 630.00, '2026-03-14 01:56:00', 12761.28, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Mooi River Truck Stop', 0, 0.00, '2026-03-14 02:15:00', 176.00, 'KZN - LINK'),
('BZ05CJZN', '580873', 'Engen Truck Stop EDC - Kokstad', 800, 691.55, '2026-03-12 14:03:00', 12654.67, 'KZN - LINK'),
-- CJ22CJZN (068611) - KZN - 8 TON
('CJ22CJZN', '068611', 'Tongaat Fuel', 315, 254.01, '2026-03-02 05:31:00', 4371.26, 'KZN - 8 TON'),
('CJ22CJZN', '068611', 'Engen Marburg Truck Stop EDC - P Shepstone', 315, 251.26, '2026-03-05 05:18:00', 4498.81, 'KZN - 8 TON'),
('CJ22CJZN', '068611', 'Oilco - Empangeni', 315, 198.67, '2026-03-17 18:21:00', 3975.59, 'KZN - 8 TON'),
('CJ22CJZN', '068611', 'Tongaat Fuel', 315, 153.01, '2026-03-16 16:15:00', 2732.61, 'KZN - 8 TON'),
('CJ22CJZN', '068611', 'Sydney Road Truck Stop - Durban', 315, 278.01, '2026-03-23 12:48:00', 6705.32, 'KZN - 8 TON'),
('CJ22CJZN', '068611', 'Pongola - Eco Fuel', 315, 208.35, '2026-03-11 10:40:00', 4088.24, 'KZN - 8 TON'),
('CJ22CJZN', '068611', 'Tongaat Fuel', 315, 250.00, '2026-03-09 16:38:00', 4464.75, 'KZN - 8 TON'),
('CJ22CJZN', '068611', 'Oilco - Empangeni', 315, 225.56, '2026-03-13 15:36:00', 4062.56, 'KZN - 8 TON'),
-- CJ22DBZN (787205) - KZN - 8 TON
('CJ22DBZN', '787205', 'Pongola - Eco Fuel', 315, 257.85, '2026-03-03 18:27:00', 4634.08, 'KZN - 8 TON'),
('CJ22DBZN', '787205', 'Tongaat Fuel', 315, 209.01, '2026-03-02 06:48:00', 3596.85, 'KZN - 8 TON'),
('CJ22DBZN', '787205', 'Tongaat Fuel', 315, 271.74, '2026-03-05 18:08:00', 4853.00, 'KZN - 8 TON'),
('CJ22DBZN', '787205', 'Tongaat Fuel', 315, 205.59, '2026-03-16 16:14:00', 3671.63, 'KZN - 8 TON'),
('CJ22DBZN', '787205', 'Mooi River Truck Stop', 0, 0.00, '2026-03-19 00:20:00', 176.00, 'KZN - 8 TON'),
('CJ22DBZN', '787205', 'Trimborn Agency - Pietermaritzburg', 315, 215.00, '2026-03-23 13:24:00', 4851.48, 'KZN - 8 TON'),
('CJ22DBZN', '787205', 'Cato Ridge Truck Stop', 315, 224.67, '2026-03-18 22:35:00', 4667.07, 'KZN - 8 TON'),
('CJ22DBZN', '787205', 'Mooi River Truck Stop', 315, 254.78, '2026-03-10 15:05:00', 4595.21, 'KZN - 8 TON'),
('CJ22DBZN', '787205', 'Truck Station - Umgeni', 315, 237.25, '2026-03-12 21:33:00', 4379.40, 'KZN - 8 TON'),
('CJ22DBZN', '787205', 'Truck Station - Umgeni', 315, 185.99, '2026-03-12 02:58:00', 3433.17, 'KZN - 8 TON'),
-- CS70DXZN (821444) - KZN - 8 TON
('CS70DXZN', '821444', 'Express Petroleum - George', 315, 241.09, '2026-03-03 13:05:00', 4161.45, 'KZN - 8 TON'),
('CS70DXZN', '821444', 'Fuel 1 - Paarden Eiland', 180, 180.00, '2026-03-01 20:59:00', 3056.22, 'KZN - 8 TON'),
('CS70DXZN', '821444', 'Express Petroleum - George', 315, 208.39, '2026-03-02 16:01:00', 3597.02, 'KZN - 8 TON'),
('CS70DXZN', '821444', 'Fuel 1 - Paarden Eiland', 315, 251.00, '2026-03-04 18:51:00', 4424.88, 'KZN - 8 TON'),
('CS70DXZN', '821444', 'Buffalo Truck Stop - East London', 315, 234.87, '2026-03-14 19:46:00', 4225.08, 'KZN - 8 TON'),
-- CY46XCZN (611236) - GP - 4 TON
('CY46XCZN', '611236', 'Lebombo Lubs - Nelspruit', 180, 102.08, '2026-03-04 11:02:00', 1938.40, 'GP - 4 TON'),
('CY46XCZN', '611236', 'Shiptech Petroleum - City Deep', 180, 153.00, '2026-03-02 08:13:00', 2734.42, 'GP - 4 TON'),
('CY46XCZN', '611236', 'Q4 Fuels - Rustenburg', 180, 149.36, '2026-03-18 16:25:00', 4094.26, 'GP - 4 TON'),
('CY46XCZN', '611236', 'Truck Station - Bloemfontein', 180, 152.87, '2026-03-20 16:11:00', 3453.18, 'GP - 4 TON'),
('CY46XCZN', '611236', 'Big 5 Fuel - Bronkhorstspruit', 180, 96.12, '2026-03-10 21:15:00', 1782.26, 'GP - 4 TON'),
('CY46XCZN', '611236', 'Big 5 Fuel - Bronkhorstspruit', 180, 148.41, '2026-03-12 00:38:00', 2751.82, 'GP - 4 TON'),
-- CY46YGZN (954468) - PE - 4 TON
('CY46YGZN', '954468', 'Andy''s Truckport - Port Elizabeth', 180, 67.62, '2026-03-03 06:16:00', 1153.53, 'PE - 4 TON'),
('CY46YGZN', '954468', 'Engen Kempston Truck Stop - East London', 180, 113.46, '2026-03-05 16:48:00', 2067.13, 'PE - 4 TON'),
('CY46YGZN', '954468', 'Andy''s Truckport - Port Elizabeth', 180, 71.53, '2026-03-09 06:46:00', 1266.72, 'PE - 4 TON'),
('CY46YGZN', '954468', 'Andy''s Truckport - Port Elizabeth', 180, 73.01, '2026-03-17 11:31:00', 1292.93, 'PE - 4 TON'),
('CY46YGZN', '954468', 'Astron Energy - Graaff Reinet', 180, 100.81, '2026-03-20 10:21:00', 2240.10, 'PE - 4 TON'),
('CY46YGZN', '954468', 'Andy''s Truckport - Port Elizabeth', 180, 106.89, '2026-03-11 04:23:00', 1892.92, 'PE - 4 TON'),
('CY46YGZN', '954468', 'Andy''s Truckport - Port Elizabeth', 180, 99.76, '2026-03-09 18:59:00', 1766.65, 'PE - 4 TON'),
('CY46YGZN', '954468', 'Astron Energy - Graaff Reinet', 180, 115.88, '2026-03-13 10:50:00', 2118.40, 'PE - 4 TON'),
('CY46YGZN', '954468', 'Astron Energy - Graaff Reinet', 180, 115.92, '2026-03-11 17:14:00', 2119.13, 'PE - 4 TON'),
-- CY47CHZN (338894) - PE - 4 TON
('CY47CHZN', '338894', 'Ikamva Fuel - Worcester', 180, 97.00, '2026-03-06 08:58:00', 1750.95, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Engen Kempston Truck Stop - Epping', 180, 84.00, '2026-03-05 12:33:00', 1532.08, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Fuel 1 - Paarden Eiland', 180, 60.26, '2026-03-17 20:52:00', 1217.85, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Ikamva Fuel - Worcester', 180, 107.17, '2026-03-16 09:03:00', 1973.05, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Engen Kempston Truck Stop - Epping', 180, 57.25, '2026-03-16 19:15:00', 1044.18, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Ikamva Fuel - Mosselbay', 180, 107.91, '2026-03-18 18:37:00', 1934.72, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Ikamva Fuel - Mosselbay', 180, 145.95, '2026-03-19 14:22:00', 2616.74, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Fuel 1 - Paarden Eiland', 180, 114.42, '2026-03-20 06:03:00', 2605.34, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Engen Kempston Truck Stop - Epping', 180, 103.21, '2026-03-09 19:21:00', 1882.45, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Express Petroleum - George', 180, 120.00, '2026-03-11 11:52:00', 2149.32, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Express Petroleum - George', 180, 127.00, '2026-03-13 09:55:00', 2274.70, 'PE - 4 TON'),
('CY47CHZN', '338894', 'Engen Kempston Truck Stop - Epping', 180, 131.06, '2026-03-11 20:42:00', 2390.40, 'PE - 4 TON'),
-- CZ78BTZN (186641) - KZN - TRANSIT
('CZ78BTZN', '186641', 'Truck Station - Umgeni', 80, 64.45, '2026-03-03 14:14:00', 1099.45, 'KZN - TRANSIT'),
('CZ78BTZN', '186641', 'Lion Park Truck Stop - Ashburton', 80, 49.81, '2026-03-02 08:28:00', 841.94, 'KZN - TRANSIT'),
('CZ78BTZN', '186641', 'Shiptech Petroleum - Harrismith', 80, 80.00, '2026-03-06 01:43:00', 1459.92, 'KZN - TRANSIT'),
('CZ78BTZN', '186641', 'Truck Station - Umgeni', 80, 65.15, '2026-03-09 06:18:00', 1153.74, 'KZN - TRANSIT'),
('CZ78BTZN', '186641', 'Tongaat Fuel', 80, 60.00, '2026-03-05 07:37:00', 1071.54, 'KZN - TRANSIT'),
('CZ78BTZN', '186641', 'Sasol N3 Truck Stop - Vrede', 80, 65.88, '2026-03-14 14:50:00', 1197.96, 'KZN - TRANSIT'),
('CZ78BTZN', '186641', 'Oilco - Empangeni', 80, 70.16, '2026-03-10 12:54:00', 1263.65, 'KZN - TRANSIT'),
('CZ78BTZN', '186641', 'Tongaat Fuel', 80, 12.29, '2026-03-11 07:52:00', 219.49, 'KZN - TRANSIT'),
('CZ78BTZN', '186641', 'Lion Park Truck Stop - Ashburton', 80, 50.40, '2026-03-13 08:15:00', 1006.64, 'KZN - TRANSIT'),
('CZ78BTZN', '186641', 'Zama Retailers - Newcastle', 80, 80.00, '2026-03-12 12:07:00', 1461.52, 'KZN - TRANSIT'),
-- CZ78CYZN (866548) - GP - TRANSIT
('CZ78CYZN', '866548', 'Edge Fuels - Boksburg', 80, 61.00, '2026-03-05 07:27:00', 1131.06, 'GP - TRANSIT'),
('CZ78CYZN', '866548', 'Edge Fuels - Boksburg', 80, 62.58, '2026-03-09 13:32:00', 1160.36, 'GP - TRANSIT'),
('CZ78CYZN', '866548', 'Edge Fuels - Boksburg', 80, 68.00, '2026-03-18 01:19:00', 1315.26, 'GP - TRANSIT'),
-- DJ25NLZN (939205) - KZN - 4 TON
('DJ25NLZN', '939205', 'East London Truck Stop (Ropax)', 180, 111.38, '2026-03-03 15:28:00', 1913.40, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Engen Marburg Truck Stop EDC - P Shepstone', 180, 92.72, '2026-03-04 08:37:00', 1660.15, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Truck Station - Umgeni', 180, 110.64, '2026-03-01 23:16:00', 1887.41, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Engen Truck Stop EDC - Kokstad', 180, 61.43, '2026-03-02 05:56:00', 1084.18, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Buffalo Truck Stop - East London', 180, 75.52, '2026-03-02 15:21:00', 1309.44, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Truck Station - Umgeni', 180, 66.42, '2026-03-05 15:33:00', 1176.23, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Truck Station - Umgeni', 180, 112.46, '2026-03-09 06:01:00', 1991.59, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Oilco - Vryheid', 180, 113.58, '2026-03-17 17:49:00', 2315.78, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Tongaat Fuel', 180, 83.09, '2026-03-17 05:47:00', 1483.90, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Truck Station - Umgeni', 180, 92.63, '2026-03-22 20:21:00', 2265.74, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Engen Truck Stop EDC - Kokstad', 180, 61.22, '2026-03-23 06:12:00', 1120.26, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Oilco - Vryheid', 180, 105.16, '2026-03-19 07:02:00', 2354.43, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Oilco - Vryheid', 180, 56.31, '2026-03-19 18:00:00', 1260.72, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'East London Truck Stop (Ropax)', 180, 120.00, '2026-03-11 06:12:00', 2139.48, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'East London Truck Stop (Ropax)', 180, 74.93, '2026-03-10 06:16:00', 1335.93, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Engen Truck Stop EDC - Kokstad', 180, 53.31, '2026-03-09 14:16:00', 975.52, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Tongaat Fuel', 180, 77.12, '2026-03-13 14:03:00', 1377.29, 'KZN - 4 TON'),
('DJ25NLZN', '939205', 'Engen Truck Stop EDC - Kokstad', 180, 84.57, '2026-03-11 18:59:00', 1547.55, 'KZN - 4 TON'),
-- DJ25NRZN (162854) - GP - 4 TON
('DJ25NRZN', '162854', 'Engen Kempston Truck Stop - Epping', 180, 151.05, '2026-03-03 20:06:00', 2656.82, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Engen Kempston Truck Stop - Epping', 180, 156.53, '2026-03-02 23:28:00', 2753.21, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Ikamva Fuel - Mosselbay', 180, 150.80, '2026-03-04 13:35:00', 2703.69, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Andy''s Truckport - Port Elizabeth', 180, 86.89, '2026-03-06 18:48:00', 1538.74, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Express Petroleum - George', 180, 125.00, '2026-03-05 16:11:00', 2238.88, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Andy''s Truckport - Port Elizabeth', 180, 104.42, '2026-03-16 06:23:00', 1849.17, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Andy''s Truckport - Port Elizabeth', 180, 90.83, '2026-03-16 20:39:00', 1608.51, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Andy''s Truckport - Port Elizabeth', 180, 44.07, '2026-03-22 18:08:00', 868.58, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Andy''s Truckport - Port Elizabeth', 180, 86.66, '2026-03-11 19:52:00', 1534.66, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Quest - Beaufort West', 180, 138.00, '2026-03-13 13:58:00', 2517.81, 'GP - 4 TON'),
('DJ25NRZN', '162854', 'Andy''s Truckport - Port Elizabeth', 180, 55.62, '2026-03-12 20:37:00', 984.97, 'GP - 4 TON'),
-- DJ25NTZN (016404) - PE - 4 TON
('DJ25NTZN', '016404', 'Andy''s Truckport - Port Elizabeth', 180, 154.50, '2026-03-02 18:20:00', 2635.62, 'PE - 4 TON'),
('DJ25NTZN', '016404', 'Astron Energy Oukop - Cradock', 180, 83.61, '2026-03-17 07:17:00', 1759.57, 'PE - 4 TON'),
('DJ25NTZN', '016404', 'Astron Energy Oukop - Cradock', 180, 117.36, '2026-03-17 18:19:00', 2469.84, 'PE - 4 TON'),
('DJ25NTZN', '016404', 'Andy''s Truckport - Port Elizabeth', 180, 53.32, '2026-03-22 18:33:00', 1050.88, 'PE - 4 TON'),
('DJ25NTZN', '016404', 'Astron Energy - Graaff Reinet', 180, 120.56, '2026-03-20 13:13:00', 2678.96, 'PE - 4 TON'),
('DJ25NTZN', '016404', 'Andy''s Truckport - Port Elizabeth', 180, 110.33, '2026-03-09 18:03:00', 1953.83, 'PE - 4 TON'),
('DJ25NTZN', '016404', 'Andy''s Truckport - Port Elizabeth', 180, 146.00, '2026-03-11 15:25:00', 2585.51, 'PE - 4 TON'),
-- MH05YYGP (473199) - GP - MASI REP
('MH05YYGP', '473199', 'Zambesi Truck Stop - Pretoria', 0, 0.00, '2026-03-11 12:11:00', 825.00, 'GP - MASI REP')
) AS t(RegistrationNumber, CardNumber, DepotName, AllocationLitres, LitresUsed, TransactionDate, AmountSpent, DepotAssignment)
LEFT JOIN Vehicles v ON v.RegistrationNumber = t.RegistrationNumber;

PRINT 'March 2026 fuel transactions imported.';
GO

-- Show import summary
SELECT 
    'Total Transactions' as Metric, 
    COUNT(*) as Value 
FROM FuelTransactions WHERE ReportMonth = 3 AND ReportYear = 2026
UNION ALL
SELECT 
    'Matched to Vehicles', 
    COUNT(*) 
FROM FuelTransactions WHERE ReportMonth = 3 AND ReportYear = 2026 AND VehicleId IS NOT NULL
UNION ALL
SELECT 
    'Unmatched', 
    COUNT(*) 
FROM FuelTransactions WHERE ReportMonth = 3 AND ReportYear = 2026 AND VehicleId IS NULL
UNION ALL
SELECT 
    'Unique Vehicles', 
    COUNT(DISTINCT RegistrationNumber) 
FROM FuelTransactions WHERE ReportMonth = 3 AND ReportYear = 2026;
GO

-- Show per-vehicle summary (top 10 by spend)
SELECT TOP 10
    f.RegistrationNumber,
    f.DepotAssignment,
    COUNT(*) as Transactions,
    CAST(SUM(f.LitresUsed) AS DECIMAL(10,0)) as TotalLitres,
    CAST(SUM(f.AmountSpent) AS DECIMAL(10,2)) as TotalSpent
FROM FuelTransactions f
WHERE f.ReportMonth = 3 AND f.ReportYear = 2026
GROUP BY f.RegistrationNumber, f.DepotAssignment
ORDER BY TotalSpent DESC;
GO

-- Show all months summary
SELECT 
    ReportMonth, ReportYear, 
    COUNT(*) as Transactions, 
    COUNT(DISTINCT RegistrationNumber) as Vehicles, 
    CAST(SUM(LitresUsed) AS DECIMAL(10,0)) as TotalLitres, 
    CAST(SUM(AmountSpent) AS DECIMAL(12,2)) as TotalSpent 
FROM FuelTransactions 
GROUP BY ReportMonth, ReportYear 
ORDER BY ReportYear, ReportMonth;
GO
