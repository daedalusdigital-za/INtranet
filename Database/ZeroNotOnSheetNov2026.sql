-- Sheets are the source of truth: any item holding stock that was NOT on its warehouse's Nov 2026 count sheet is out of stock.
-- Driven by the open 'Item not on count sheet' issues produced by tools/count_accuracy.py (code + company matched).
SET NOCOUNT ON; SET XACT_ABORT ON;
BEGIN TRAN;

SELECT DISTINCT si.WarehouseId, c.Id CommodityId, wi.QuantityOnHand OldQty
INTO #z
FROM StockIssues si
JOIN Commodities c ON c.Code = si.ItemCode AND ISNULL(UPPER(c.Category),'') = UPPER(si.Company)
JOIN WarehouseInventory wi ON wi.WarehouseId = si.WarehouseId AND wi.CommodityId = c.Id
WHERE si.Status = 'Open' AND si.IssueType = 'Item not on count sheet' AND wi.QuantityOnHand <> 0;

SELECT COUNT(*) ItemsToZero, SUM(OldQty) UnitsToZero FROM #z;

INSERT INTO WarehouseStockMovements (WarehouseId, CommodityId, MovementType, Quantity, BalanceAfter, Reason, Reference, Status, CreatedBy, CreatedAt)
SELECT WarehouseId, CommodityId, 'Adjustment', -OldQty, 0,
       'Stock count 2026-11-02: item not on the count sheet - count sheets are authoritative, set to 0',
       'COUNT-2026-11-02-NOTONSHEET', 'Approved', 'Stock count import', SYSUTCDATETIME()
FROM #z;

UPDATE wi SET QuantityOnHand = 0, LastCountDate = '2026-11-02', UpdatedAt = SYSUTCDATETIME()
FROM WarehouseInventory wi JOIN #z z ON z.WarehouseId = wi.WarehouseId AND z.CommodityId = wi.CommodityId;

UPDATE StockIssues SET Status = 'Resolved', Resolution = 'Set to 0 - not on the Nov 2026 count sheet (sheets are authoritative).',
       ResolvedBy = 'Stock count import', ResolvedAt = SYSUTCDATETIME()
WHERE Status = 'Open' AND IssueType = 'Item not on count sheet';

DROP TABLE #z;
COMMIT;

SELECT w.Name, COUNT(*) Items, SUM(CASE WHEN wi.QuantityOnHand <> 0 THEN 1 ELSE 0 END) NonZero, SUM(wi.QuantityOnHand) Qty
FROM WarehouseInventory wi JOIN Warehouses w ON w.Id = wi.WarehouseId GROUP BY w.Name ORDER BY w.Name;
SELECT IssueType, COUNT(*) n FROM StockIssues WHERE Status = 'Open' GROUP BY IssueType ORDER BY n DESC;
