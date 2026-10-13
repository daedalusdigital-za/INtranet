-- Split legacy semicolon-merged StopCommodities into one row per product,
-- using the original invoice line detail from SalesTransactionStagings.
-- Only rows whose invoice has line detail in staging are touched.
SET NOCOUNT ON;

-- Distinct staging lines per invoice (re-imports can duplicate rows)
IF OBJECT_ID('tempdb..#lines') IS NOT NULL DROP TABLE #lines;
SELECT DISTINCT st.TransactionNumber, st.ProductDescription, st.Quantity
INTO #lines
FROM SalesTransactionStagings st
WHERE st.TransactionNumber IS NOT NULL AND st.ProductDescription IS NOT NULL;

-- Target commodities: merged (contain ';'), have an invoice number,
-- and that invoice has 2+ distinct lines in staging
IF OBJECT_ID('tempdb..#targets') IS NOT NULL DROP TABLE #targets;
SELECT sc.Id, sc.LoadStopId, sc.InvoiceNumber, sc.OrderNumber, sc.TotalPrice
INTO #targets
FROM StopCommodities sc
WHERE sc.Comment LIKE '%;%'
  AND sc.InvoiceNumber IS NOT NULL
  AND sc.InvoiceNumber NOT LIKE '%,%'  -- single invoice only
  AND (SELECT COUNT(*) FROM #lines l WHERE l.TransactionNumber = sc.InvoiceNumber) >= 2;

SELECT COUNT(*) AS TargetRows FROM #targets;

-- Insert one commodity per staging line; full value carried on the first line
;WITH numbered AS (
    SELECT t.Id AS TargetId, t.LoadStopId, t.InvoiceNumber, t.OrderNumber, t.TotalPrice,
           l.ProductDescription, l.Quantity,
           ROW_NUMBER() OVER (PARTITION BY t.Id ORDER BY l.ProductDescription) AS rn
    FROM #targets t
    JOIN #lines l ON l.TransactionNumber = t.InvoiceNumber
)
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT n.LoadStopId,
       n.Quantity,
       CASE WHEN n.rn = 1 THEN ISNULL(n.TotalPrice, 0) ELSE 0 END,
       CASE WHEN n.rn = 1 THEN ISNULL(n.TotalPrice, 0) ELSE 0 END,
       n.InvoiceNumber,
       n.OrderNumber,
       UPPER(n.ProductDescription),
       GETUTCDATE()
FROM numbered n;

SELECT @@ROWCOUNT AS InsertedRows;

-- Remove the old merged rows
DELETE sc FROM StopCommodities sc JOIN #targets t ON sc.Id = t.Id;
SELECT @@ROWCOUNT AS DeletedMergedRows;
