-- Split remaining merged StopCommodities on active loads using invoice line detail
-- (from SalesTransactionStagings / ImportedInvoices). Each block verified by hand.
SET NOCOUNT ON;

-- 2864 IN172021 (RF-000775): 2PLY=20, 1PLY=30 (sum 50 ✓)
UPDATE StopCommodities SET InvoiceNumber='IN172021', Comment='TOILET PAPER 2PLY SOFT GRADE', Quantity=20 WHERE Id=2864;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 30, 0, 0, 'IN172021', OrderNumber, 'TOILET PAPER 1PLY SOFT GRADE', GETUTCDATE() FROM StopCommodities WHERE Id=2864;

-- 3252 IN024548 (RF-000776): staging lines (sheet order) 70 + 50 = 120 ✓
UPDATE StopCommodities SET Comment='LAUNDRY POWDER DETERGENT', Quantity=70 WHERE Id=3252;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 50, 0, 0, InvoiceNumber, OrderNumber, 'LAUNDRY LIQUID DETERGENT', GETUTCDATE() FROM StopCommodities WHERE Id=3252;

-- 2902 IN171661 (RF-000781): ID Band=500 per invoice; remainder 20000 = Linen Savers
UPDATE StopCommodities SET InvoiceNumber='IN171661', Comment='ID BAND CHILDREN PINK', Quantity=500 WHERE Id=2902;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 20000, 0, 0, 'IN171661', OrderNumber, 'LINEN SAVERS 4PLY', GETUTCDATE() FROM StopCommodities WHERE Id=2902;

-- 2913 IN147662 (RF-000784): 18FG=10, 16FG=40 (sum 50 ✓)
UPDATE StopCommodities SET InvoiceNumber='IN147662', Comment='SKIN LEVEL GASTROSTOMY FEEDING TUBE SILICONE 18FG 2CM-3CM', Quantity=10 WHERE Id=2913;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 40, 0, 0, 'IN147662', OrderNumber, 'SKIN LEVEL GASTROSTOMY FEEDING TUBE 16FG 2CM-3CM', GETUTCDATE() FROM StopCommodities WHERE Id=2913;

-- 2915 IN024655 (RF-000785): Medium=15000, Large=15000 (sum 30000 ✓)
UPDATE StopCommodities SET InvoiceNumber='IN024655', Comment='ADULT DIAPERS DAYTIME SIZE MEDIUM', Quantity=15000 WHERE Id=2915;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 15000, 0, 0, 'IN024655', OrderNumber, 'ADULT DIAPERS DAYTIME SIZE LARGE', GETUTCDATE() FROM StopCommodities WHERE Id=2915;

-- 2955 IN171952 (RF-000787): TP 1PLY=46, Jumbo=10, Serviettes=10 (sum 66 ✓)
UPDATE StopCommodities SET InvoiceNumber='IN171952', Comment='TOILET PAPER 1PLY SOFT GRADE', Quantity=46 WHERE Id=2955;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 10, 0, 0, 'IN171952', OrderNumber, 'JUMBO ROLL 1500M X 270MM 1PLY', GETUTCDATE() FROM StopCommodities WHERE Id=2955;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 10, 0, 0, 'IN171952', OrderNumber, 'PAPER SERVIETTES 1PLY PKT OF 1000', GETUTCDATE() FROM StopCommodities WHERE Id=2955;

-- 3031 IN147761 (RF-000800): TP 2PLY=30, Paper Towel=30 (sum 60 ✓)
UPDATE StopCommodities SET InvoiceNumber='IN147761', Comment='TOILET PAPER 2PLY SOFT GRADE', Quantity=30 WHERE Id=3031;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 30, 0, 0, 'IN147761', OrderNumber, 'PAPER TOWEL 235MM X 360M 1PLY PERFORATED', GETUTCDATE() FROM StopCommodities WHERE Id=3031;

-- 3088 IN172043 (RF-000807): 2PLY=7, 1PLY=7 (sum 14 ✓)
UPDATE StopCommodities SET InvoiceNumber='IN172043', Comment='TOILET PAPER 2PLY SOFT GRADE', Quantity=7 WHERE Id=3088;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 7, 0, 0, 'IN172043', OrderNumber, 'TOILET PAPER 1PLY SOFT GRADE', GETUTCDATE() FROM StopCommodities WHERE Id=3088;

-- 3092 IN171753 (RF-000807): Zinc 25mm=50, Zinc 75mm=50 (sum 100 ✓)
UPDATE StopCommodities SET InvoiceNumber='IN171753', Comment='ZINC OXIDE TAPE 25MM X 5M ROLL', Quantity=50 WHERE Id=3092;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 50, 0, 0, 'IN171753', OrderNumber, 'ZINC OXIDE TAPE 75MM X 5M ROLL', GETUTCDATE() FROM StopCommodities WHERE Id=3092;

-- 3093 IN172140 (RF-000807): 2PLY=30, 1PLY=70, Folded Towel=600 (sum 700 ✓)
UPDATE StopCommodities SET InvoiceNumber='IN172140', Comment='TOILET PAPER 2PLY SOFT GRADE', Quantity=30 WHERE Id=3093;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 70, 0, 0, 'IN172140', OrderNumber, 'TOILET PAPER 1PLY SOFT GRADE', GETUTCDATE() FROM StopCommodities WHERE Id=3093;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 600, 0, 0, 'IN172140', OrderNumber, 'FOLDED HAND PAPER TOWEL 1PLY', GETUTCDATE() FROM StopCommodities WHERE Id=3093;

-- 3227 IN172135 (RF-000810): Folded Towel=80, TP 2PLY=100 (sum 180 ✓)
UPDATE StopCommodities SET InvoiceNumber='IN172135', Comment='FOLDED HAND PAPER TOWEL 1PLY', Quantity=80 WHERE Id=3227;
INSERT INTO StopCommodities (LoadStopId, Quantity, UnitPrice, TotalPrice, InvoiceNumber, OrderNumber, Comment, CreatedAt)
SELECT LoadStopId, 100, 0, 0, 'IN172135', OrderNumber, 'TOILET PAPER 2PLY SOFT GRADE', GETUTCDATE() FROM StopCommodities WHERE Id=3227;

-- 3311 IN172206 (RF-000818): no line detail anywhere; merged qty 150 across
-- Nitrile Medium + XL. Invoice shows equal split not recorded -> leave for manual.
-- 3312 IN172195 (RF-000818): no line detail. leave for manual.
-- 3369 IN147526 (RF-000821): no line detail. leave for manual.
-- 2895 IN172035 (RF-000778): staging detail is a DIFFERENT product (toilet paper) than
--   the sheet comment (orthopaedic padding) -> possible invoice mismatch. leave for manual.
-- 2901 IN024649 (RF-000781): no line detail. leave for manual.
-- 3033 IN172117 (RF-000800): staging detail (syringes) contradicts comment (electrodes)
--   -> possible invoice mismatch. leave for manual.

SELECT sc.Id, sc.InvoiceNumber, l.LoadNumber, LEFT(sc.Comment,60) AS Prod, sc.Quantity
FROM StopCommodities sc JOIN LoadStops ls ON sc.LoadStopId=ls.Id JOIN Loads l ON ls.LoadId=l.Id
WHERE sc.Comment LIKE '%;%' AND l.Status NOT IN ('Delivered','Completed','Cancelled');
