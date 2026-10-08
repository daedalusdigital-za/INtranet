-- =============================================================================
-- Purge inactive driver stubs — 2026-10-05
-- 1) Re-point Loads/PODs/Vehicles from obvious duplicate stubs to the real
--    Active driver rows.
-- 2) Delete stubs that are now (or already were) unreferenced.
-- Ambiguous inactive drivers WITH history are left untouched (still Inactive).
-- =============================================================================
USE ProjectTrackerDB;
GO
SET NOCOUNT ON;

-- Confident stub -> active mappings (same person, name match)
DECLARE @map TABLE (OldId int, NewId int);
INSERT @map VALUES
 (1, 68),  -- Lungelo        -> LUNGELO TRINITY BIYELA
 (3, 44),  -- Sphephelo      -> SPHEPHELO MATHONSI
 (6, 72),  -- Lindo          -> LINDOKUHLE SHUDE
 (8, 73),  -- George         -> GEORGE CHEMBENE
 (13,66),  -- Mfundo         -> MFUNDO NEVILE CELE
 (20,55),  -- Sizwe (KZN)    -> SIZWE P KUBHEKA
 (26,56),  -- Lucas (KZN)    -> LUCAS A KHUMALO
 (31,46),  -- Mthokosizi CPT -> MTHOKOZISI MAKHANYA (CT)
 (34,45),  -- Mafannfuthi    -> MFANAFUTHI SEDRICK NGCOBO
 (36,59),  -- Zolani (CPT)   -> ZOLANI M MTSHALI
 (37,71),  -- Siyanda        -> SIYANDA MNCWABE
 (40,57);  -- Smanga         -> SMANGA P ZUNGU

-- Re-point history
UPDATE l SET l.DriverId = m.NewId FROM Loads l JOIN @map m ON m.OldId = l.DriverId;
UPDATE p SET p.DriverId = m.NewId FROM PodDocuments p JOIN @map m ON m.OldId = p.DriverId;
UPDATE v SET v.CurrentDriverId = m.NewId FROM Vehicles v JOIN @map m ON m.OldId = v.CurrentDriverId;
UPDATE s SET s.DriverId = m.NewId FROM SleepOuts s JOIN @map m ON m.OldId = s.DriverId;
UPDATE h SET h.DriverId = m.NewId FROM PartDeliveryHistories h JOIN @map m ON m.OldId = h.DriverId;

-- Clear vehicle links for stubs being deleted outright (no history to keep)
UPDATE Vehicles SET CurrentDriverId = NULL
WHERE CurrentDriverId IN (SELECT OldId FROM @map)
   OR CurrentDriverId IN (12, 16, 19, 29, 33);

-- Delete: remapped stubs + zero-history stubs
DELETE FROM Drivers
WHERE Id IN (SELECT OldId FROM @map)
   OR Id IN (12, 16, 19, 29, 33);  -- Bongakosi, Anesh, Deon, Phumlani, Khumalani (0 loads, 0 PODs)

PRINT 'Deleted driver stubs: ' + CAST(@@ROWCOUNT AS varchar(10));

-- Remaining inactive drivers (kept for history integrity)
SELECT Id, FirstName, Status,
       (SELECT COUNT(*) FROM Loads WHERE DriverId = d.Id) AS Loads,
       (SELECT COUNT(*) FROM PodDocuments WHERE DriverId = d.Id) AS Pods
FROM Drivers d WHERE Status <> 'Active' ORDER BY Id;
GO
