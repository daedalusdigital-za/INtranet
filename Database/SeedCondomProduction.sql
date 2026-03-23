-- =====================================================
-- Condom Production Schedule — Rolling 7 weekdays
-- Previous 5 weekdays (incl. today) + Next 2 weekdays
-- Dates auto-calculated from today's date, skips weekends
-- =====================================================

USE ProjectTrackerDB;
GO

-- Create table if not exists
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'CondomProductionSchedules')
BEGIN
    CREATE TABLE CondomProductionSchedules (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Scent NVARCHAR(50) NOT NULL,
        Type NVARCHAR(20) NOT NULL,
        BatchCode NVARCHAR(30) NOT NULL,
        UOM NVARCHAR(20) NOT NULL DEFAULT 'CASES',
        ScheduleDate DATETIME2 NOT NULL,
        Quantity INT NOT NULL DEFAULT 0,
        QuantityNote NVARCHAR(50) NULL,
        ScentGroup NVARCHAR(20) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );

    CREATE INDEX IX_CondomProd_Date ON CondomProductionSchedules (ScheduleDate);
    CREATE INDEX IX_CondomProd_Scent ON CondomProductionSchedules (Scent, Type);
    PRINT 'Created CondomProductionSchedules table';
END
GO

-- Clear existing data
DELETE FROM CondomProductionSchedules;
PRINT 'Cleared existing data';
GO

-- =====================================================
-- Helper: Insert batch across dates
-- Previous 5 weekdays (including today) + Next 2 weekdays
-- Dates auto-calculated from today's date, skips weekends
-- =====================================================

DECLARE @today DATE = CAST(GETDATE() AS DATE);

-- If today is a weekend, adjust to Friday
-- ISO day: (DATEPART(WEEKDAY, x) + @@DATEFIRST - 2) % 7 → 0=Mon,1=Tue,...,4=Fri,5=Sat,6=Sun
DECLARE @isoDow INT = (DATEPART(WEEKDAY, @today) + @@DATEFIRST - 2) % 7;
IF @isoDow = 5 SET @today = DATEADD(DAY, -1, @today);  -- Saturday → Friday
IF @isoDow = 6 SET @today = DATEADD(DAY, -2, @today);  -- Sunday → Friday

-- d5 = today (the pivot point)
DECLARE @d5 DATE = @today;

-- Previous 4 weekdays (skip weekends going backwards: Monday-3→Friday, else -1)
DECLARE @d4 DATE = DATEADD(DAY, CASE WHEN (DATEPART(WEEKDAY, @d5) + @@DATEFIRST - 2) % 7 = 0 THEN -3 ELSE -1 END, @d5);
DECLARE @d3 DATE = DATEADD(DAY, CASE WHEN (DATEPART(WEEKDAY, @d4) + @@DATEFIRST - 2) % 7 = 0 THEN -3 ELSE -1 END, @d4);
DECLARE @d2 DATE = DATEADD(DAY, CASE WHEN (DATEPART(WEEKDAY, @d3) + @@DATEFIRST - 2) % 7 = 0 THEN -3 ELSE -1 END, @d3);
DECLARE @d1 DATE = DATEADD(DAY, CASE WHEN (DATEPART(WEEKDAY, @d2) + @@DATEFIRST - 2) % 7 = 0 THEN -3 ELSE -1 END, @d2);

-- Next 2 weekdays (skip weekends going forwards: Friday+3→Monday, else +1)
DECLARE @d6 DATE = DATEADD(DAY, CASE WHEN (DATEPART(WEEKDAY, @d5) + @@DATEFIRST - 2) % 7 = 4 THEN 3 ELSE 1 END, @d5);
DECLARE @d7 DATE = DATEADD(DAY, CASE WHEN (DATEPART(WEEKDAY, @d6) + @@DATEFIRST - 2) % 7 = 4 THEN 3 ELSE 1 END, @d6);

PRINT 'Previous 5 + Next 2 weekday dates:';
PRINT '  d1=' + CAST(@d1 AS VARCHAR) + ' (' + DATENAME(WEEKDAY, @d1) + ')';
PRINT '  d2=' + CAST(@d2 AS VARCHAR) + ' (' + DATENAME(WEEKDAY, @d2) + ')';
PRINT '  d3=' + CAST(@d3 AS VARCHAR) + ' (' + DATENAME(WEEKDAY, @d3) + ')';
PRINT '  d4=' + CAST(@d4 AS VARCHAR) + ' (' + DATENAME(WEEKDAY, @d4) + ')';
PRINT '  d5=' + CAST(@d5 AS VARCHAR) + ' (' + DATENAME(WEEKDAY, @d5) + ') ← TODAY';
PRINT '  d6=' + CAST(@d6 AS VARCHAR) + ' (' + DATENAME(WEEKDAY, @d6) + ')';
PRINT '  d7=' + CAST(@d7 AS VARCHAR) + ' (' + DATENAME(WEEKDAY, @d7) + ')';

-- Sort order counter
DECLARE @sort INT = 0;

-- =====================================================
-- 1. VANILLA FEMALE (1K Boxes) — 8 batches
-- =====================================================
SET @sort = 100;

INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Vanilla', 'Female', batch, 'BOXES', d, 2350, 'VANILLA-F-1K', @sort + seq
FROM (VALUES 
    ('F1K 2501', 1), ('F1K 2502', 2), ('F1K 2503', 3), ('F1K 2504', 4),
    ('F1K 2507', 5), ('F1K 2508', 6), ('F1K 2505', 7), ('F1K 2506', 8)
) AS batches(batch, seq)
CROSS JOIN (VALUES 
    (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)
) AS dates(d);

PRINT 'Inserted Vanilla Female 1K batches (8 × 7 days)';

-- =====================================================
-- 2. VANILLA FEMALE (IG Boxes) — 4 batches
-- =====================================================
SET @sort = 200;

-- FIG 2301 — 195/day
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Vanilla', 'Female', 'FIG 2301', 'BOXES', d, 195, 'VANILLA-F-IG', @sort + 1
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- FIG 2306 — 639/day
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Vanilla', 'Female', 'FIG 2306', 'BOXES', d, 639, 'VANILLA-F-IG', @sort + 2
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- F1G 2302 — 10/day
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Vanilla', 'Female', 'F1G 2302', 'BOXES', d, 10, 'VANILLA-F-IG', @sort + 3
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- F1G 2309 — 10/day
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Vanilla', 'Female', 'F1G 2309', 'BOXES', d, 10, 'VANILLA-F-IG', @sort + 4
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

PRINT 'Inserted Vanilla Female IG batches';

-- =====================================================
-- 3. STRAWBERRY FEMALE — 5 batches
-- =====================================================
SET @sort = 300;

-- FIG 2309 — 567
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Female', 'FIG 2309', 'BOXES', d, 567, 'STRAW-F', @sort + 1
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- FIG 2308 — 695
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Female', 'FIG 2308', 'BOXES', d, 695, 'STRAW-F', @sort + 2
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- FIH 2302 — 8
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Female', 'FIH 2302', 'BOXES', d, 8, 'STRAW-F', @sort + 3
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- FIH 2301 — 351
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Female', 'FIH 2301', 'BOXES', d, 351, 'STRAW-F', @sort + 4
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- FIH 2302 (second entry) — 207
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Female', 'FIH 2302B', 'BOXES', d, 207, 'STRAW-F', @sort + 5
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

PRINT 'Inserted Strawberry Female batches';

-- =====================================================
-- 4. STRAWBERRY MALE — 8 batches (quantities change between weeks)
-- =====================================================
SET @sort = 400;

-- PG 2555: Week1=11, Week2=5
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Male', 'PG 2555', 'CASES', d, CASE WHEN d <= @d5 THEN 11 ELSE 5 END, 'STRAW-M', @sort + 1
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2557: Week1=23, Week2=0
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Male', 'PG 2557', 'CASES', d, CASE WHEN d <= @d5 THEN 23 ELSE 0 END, 'STRAW-M', @sort + 2
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2558: Week1=48, Week2=17
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Male', 'PG 2558', 'CASES', d, CASE WHEN d <= @d5 THEN 48 ELSE 17 END, 'STRAW-M', @sort + 3
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2559: 33 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Male', 'PG 2559', 'CASES', d, 33, 'STRAW-M', @sort + 4
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2561: 13 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Male', 'PG 2561', 'CASES', d, 13, 'STRAW-M', @sort + 5
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2562: 46 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Male', 'PG 2562', 'CASES', d, 46, 'STRAW-M', @sort + 6
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2563: Week1=45, Week2=35
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Male', 'PG 2563', 'CASES', d, CASE WHEN d <= @d5 THEN 45 ELSE 35 END, 'STRAW-M', @sort + 7
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2576: Week1=7, Week2=2
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Strawberry', 'Male', 'PG 2576', 'CASES', d, CASE WHEN d <= @d5 THEN 7 ELSE 2 END, 'STRAW-M', @sort + 8
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

PRINT 'Inserted Strawberry Male batches';

-- =====================================================
-- 5. VANILLA MALE (PG 2577-2589) — 13 batches
-- =====================================================
SET @sort = 500;

INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Vanilla', 'Male', batch, 'CASES', d, qty, 'VANILLA-M-A', @sort + seq
FROM (VALUES 
    ('PG 2577', 40, 1), ('PG 2578', 40, 2), ('PG 2579', 40, 3), ('PG 2580', 39, 4),
    ('PG 2581', 40, 5), ('PG 2582', 20, 6), ('PG 2583', 20, 7), ('PG 2584', 20, 8),
    ('PG 2585', 20, 9), ('PG 2586', 20, 10), ('PG 2587', 9, 11), ('PG 2588', 28, 12),
    ('PG 2589', 41, 13)
) AS batches(batch, qty, seq)
CROSS JOIN (VALUES 
    (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)
) AS dates(d);

PRINT 'Inserted Vanilla Male A batches (13 × 7 days)';

-- =====================================================
-- 6. BANANA MALE — 13 batches (some have varying quantities)
-- =====================================================
SET @sort = 600;

-- PH 25115-25117: 0 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Banana', 'Male', batch, 'CASES', d, 0, 'BANANA-M', @sort + seq
FROM (VALUES ('PH 25115', 1), ('PH 25116', 2), ('PH 25117', 3)) AS batches(batch, seq)
CROSS JOIN (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PH 25118: 4 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Banana', 'Male', 'PH 25118', 'CASES', d, 4, 'BANANA-M', @sort + 4
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PH 25119: 3 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Banana', 'Male', 'PH 25119', 'CASES', d, 3, 'BANANA-M', @sort + 5
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PH 25120: Day1=28, rest=11
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Banana', 'Male', 'PH 25120', 'CASES', d, CASE WHEN d = @d1 THEN 28 ELSE 11 END, 'BANANA-M', @sort + 6
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PH 25121: 18 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Banana', 'Male', 'PH 25121', 'CASES', d, 18, 'BANANA-M', @sort + 7
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PH 25122, PH 25123: 0 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Banana', 'Male', batch, 'CASES', d, 0, 'BANANA-M', @sort + seq
FROM (VALUES ('PH 25122', 8), ('PH 25123', 9)) AS batches(batch, seq)
CROSS JOIN (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PH 25124: 20 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Banana', 'Male', 'PH 25124', 'CASES', d, 20, 'BANANA-M', @sort + 10
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PH 25125: Varying quantities with notes (10 boxes → 14 boxes)
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, QuantityNote, ScentGroup, SortOrder) VALUES
('Banana', 'Male', 'PH 25125', 'CASES', @d1, 10, '10 boxes', 'BANANA-M', @sort + 11),
('Banana', 'Male', 'PH 25125', 'CASES', @d2, 11, '11 boxes', 'BANANA-M', @sort + 11),
('Banana', 'Male', 'PH 25125', 'CASES', @d3, 12, '12 boxes', 'BANANA-M', @sort + 11),
('Banana', 'Male', 'PH 25125', 'CASES', @d4, 13, '13 boxes', 'BANANA-M', @sort + 11),
('Banana', 'Male', 'PH 25125', 'CASES', @d5, 14, '14 boxes', 'BANANA-M', @sort + 11),
('Banana', 'Male', 'PH 25125', 'CASES', @d6, 14, '14 boxes', 'BANANA-M', @sort + 11),
('Banana', 'Male', 'PH 25125', 'CASES', @d7, 14, '14 boxes', 'BANANA-M', @sort + 11);

-- PH 25126: Day1=23, rest=0
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Banana', 'Male', 'PH 25126', 'CASES', d, CASE WHEN d = @d1 THEN 23 ELSE 0 END, 'BANANA-M', @sort + 12
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PH 25129: 19 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Banana', 'Male', 'PH 25129', 'CASES', d, 19, 'BANANA-M', @sort + 13
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

PRINT 'Inserted Banana Male batches';

-- =====================================================
-- 7. GRAPE MALE — 26 batches (some with varying quantities)
-- =====================================================
SET @sort = 700;

-- PG 2515: 0 all days
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Grape', 'Male', 'PG 2515', 'CASES', d, 0, 'GRAPE-M', @sort + 1
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2530: Week1=40, Week2=0
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Grape', 'Male', 'PG 2530', 'CASES', d, CASE WHEN d <= @d5 THEN 40 ELSE 0 END, 'GRAPE-M', @sort + 2
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2529: Week1=25, Week2=20
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Grape', 'Male', 'PG 2529', 'CASES', d, CASE WHEN d <= @d5 THEN 25 ELSE 20 END, 'GRAPE-M', @sort + 3
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2528: Week1=40, Week2=23
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Grape', 'Male', 'PG 2528', 'CASES', d, CASE WHEN d <= @d5 THEN 40 ELSE 23 END, 'GRAPE-M', @sort + 4
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2527: Week1=48, Week2=17
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Grape', 'Male', 'PG 2527', 'CASES', d, CASE WHEN d <= @d5 THEN 48 ELSE 17 END, 'GRAPE-M', @sort + 5
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- Constant-quantity grape batches
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Grape', 'Male', batch, 'CASES', d, qty, 'GRAPE-M', @sort + seq
FROM (VALUES 
    ('PG 2520', 32, 6), ('PG 2521', 30, 7), ('PG 2523', 48, 9), ('PG 2524', 48, 10),
    ('PG 2525', 44, 11), ('PG 2526', 47, 12), ('PG 2531', 7, 13), ('PG 2538', 1, 14),
    ('PG 2541', 10, 16), ('PG 2543', 48, 17), ('PG 2544', 48, 18), ('PG 2545', 18, 19)
) AS batches(batch, qty, seq)
CROSS JOIN (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2522: "24+20 BOX" all days — quantity 44
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, QuantityNote, ScentGroup, SortOrder)
SELECT 'Grape', 'Male', 'PG 2522', 'CASES', d, 44, '24+20 BOX', 'GRAPE-M', @sort + 8
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- PG 2534: Day1=48, rest=8
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Grape', 'Male', 'PG 2534', 'CASES', d, CASE WHEN d = @d1 THEN 48 ELSE 8 END, 'GRAPE-M', @sort + 15
FROM (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

-- Grape additional batches (PG 2535-2540, PG 2533, PG 2538B) — all 48 except PG 2538B=47
INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Grape', 'Male', batch, 'CASES', d, qty, 'GRAPE-M', @sort + seq
FROM (VALUES 
    ('PG 2535', 48, 20), ('PG 2536', 48, 21), ('PG 2537', 48, 22),
    ('PG 2539', 48, 23), ('PG 2540', 48, 24), ('PG 2533', 48, 25), ('PG 2538B', 47, 26)
) AS batches(batch, qty, seq)
CROSS JOIN (VALUES (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)) AS dates(d);

PRINT 'Inserted Grape Male batches';

-- =====================================================
-- 8. VANILLA MALE B (PG25102-25114) — 13 batches
-- =====================================================
SET @sort = 800;

INSERT INTO CondomProductionSchedules (Scent, Type, BatchCode, UOM, ScheduleDate, Quantity, ScentGroup, SortOrder)
SELECT 'Vanilla', 'Male', batch, 'CASES', d, qty, 'VANILLA-M-B', @sort + seq
FROM (VALUES 
    ('PG 25114', 42, 1), ('PG 25108', 48, 2), ('PG 25113', 48, 3), ('PG 25112', 48, 4),
    ('PG 25111', 48, 5), ('PG 25110', 48, 6), ('PG 25109', 48, 7), ('PG 25107', 48, 8),
    ('PG 25105', 48, 9), ('PG 25104', 48, 10), ('PG 25103', 48, 11), ('PG 25102', 48, 12),
    ('PG 25106', 48, 13)
) AS batches(batch, qty, seq)
CROSS JOIN (VALUES 
    (@d1), (@d2), (@d3), (@d4), (@d5), (@d6), (@d7)
) AS dates(d);

PRINT 'Inserted Vanilla Male B batches (13 × 7 days)';

-- =====================================================
-- Verify
-- =====================================================
SELECT 
    Scent,
    Type,
    COUNT(DISTINCT BatchCode) AS Batches,
    COUNT(*) AS TotalRows,
    SUM(Quantity) AS TotalQuantity
FROM CondomProductionSchedules
GROUP BY Scent, Type
ORDER BY Scent, Type;

SELECT 'Total records: ' + CAST(COUNT(*) AS VARCHAR) FROM CondomProductionSchedules;
GO
