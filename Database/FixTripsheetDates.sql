-- Fix Tripsheet Dates
-- The original imports used dates from Excel cell J2, but some cells had
-- incorrect dates. The actual trip dates come from the filenames (CPT) or
-- folder names (KZN). This script corrects 3 mismatched records.
-- Run date: 2026-04-08

-- Fix 1: RF-000383 (CPT) - LUNGELO 27.01.26.xlsx
-- Excel cell J2 had '22,01,26' but filename date is 27.01.26
UPDATE Loads SET ScheduledDeliveryDate = '2026-01-27', UpdatedAt = GETDATE()
WHERE LoadNumber = 'RF-000383' AND ScheduledDeliveryDate = '2026-01-22';

-- Fix 2: RF-000433 (KZN) - FEBUARY/12.02.26/TUGELA FERRY NQUTU 12.02.26.xlsx
-- Excel cell J2 had '11.02.26' but folder date is 12.02.26
UPDATE Loads SET ScheduledDeliveryDate = '2026-02-12', UpdatedAt = GETDATE()
WHERE LoadNumber = 'RF-000433' AND ScheduledDeliveryDate = '2026-02-11';

-- Fix 3: RF-000436 (KZN) - FEBUARY/13.02.26/PMB 13.02.26.xlsx
-- Excel cell J2 had '12.02.26' but folder date is 13.02.26
UPDATE Loads SET ScheduledDeliveryDate = '2026-02-13', UpdatedAt = GETDATE()
WHERE LoadNumber = 'RF-000436' AND ScheduledDeliveryDate = '2026-02-12';
