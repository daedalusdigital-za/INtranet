-- Bulk update Dell asset book values
-- Dell 22 inch monitors: R2200.00 (SE2222H, P2214HB, p22123t, etc.)
UPDATE dbo.AssetRegisterItems
SET Value = 2200.00
WHERE IsActive = 1
  AND (Model LIKE '%SE2222H%' OR Model LIKE '%P2214HB%' OR Model LIKE '%p22123t%' OR Model LIKE '%Dell 22%' OR (Model LIKE 'Dell%' AND Category = 'Monitor' AND (Model LIKE '%22%' OR Model LIKE '%2212%')));
PRINT 'Updated Dell 22 inch monitors: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows';

-- Dell i5 11th Gen: R6900.00
UPDATE dbo.AssetRegisterItems
SET Value = 6900.00
WHERE IsActive = 1
  AND Model LIKE '%11%' 
  AND (Model LIKE '%i5%' OR Model LIKE '%OptiPlex%' OR Model LIKE '%Optiplex%')
  AND Model LIKE '%Dell%';
PRINT 'Updated Dell i5 11th Gen: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows';

-- Dell i5 7th Gen: R4100.00
UPDATE dbo.AssetRegisterItems
SET Value = 4100.00
WHERE IsActive = 1
  AND Model LIKE '%7%'
  AND Model LIKE '%i5%'
  AND Model LIKE '%Dell%'
  AND (Model LIKE '%7th%' OR Model LIKE '%7-th%' OR Model LIKE 'Dell i5-7%');
PRINT 'Updated Dell i5 7th Gen: ' + CAST(@@ROWCOUNT AS VARCHAR(10)) + ' rows';

-- Show the updated assets
SELECT ItemId, Category, Model, Manufacturer, Value, MarketValue, AssignedTo, LocationId
FROM dbo.AssetRegisterItems
WHERE IsActive = 1
  AND Manufacturer LIKE '%Dell%'
  AND (
    (Model LIKE '%22%' AND (Model LIKE '%monitor%' OR Model LIKE '%Monitor%'))
    OR Model LIKE '%i5%11%'
    OR Model LIKE '%11th%i5%'
    OR Model LIKE '%i5-11%'
    OR Model LIKE '%i5%7%'
    OR Model LIKE '%7th%i5%'
    OR Model LIKE '%i5-7%'
  )
ORDER BY Category, Model;
