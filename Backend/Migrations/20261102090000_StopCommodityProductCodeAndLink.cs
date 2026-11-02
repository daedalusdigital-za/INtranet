using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Tripsheet lines keep the Sage product code they came from, every invoiced product code becomes a stock item
    /// (Commodity), and unlinked lines are connected so dispatch approval can deduct stock.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261102090000_StopCommodityProductCodeAndLink")]
    public partial class StopCommodityProductCodeAndLink : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF COL_LENGTH('StopCommodities','ProductCode') IS NULL ALTER TABLE [StopCommodities] ADD [ProductCode] nvarchar(50) NULL;");
            migrationBuilder.Sql(@"IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StopCommodities_ProductCode') CREATE INDEX [IX_StopCommodities_ProductCode] ON [StopCommodities]([ProductCode]);");

            // 1) Lines already linked: copy the stock item's code.
            migrationBuilder.Sql(@"
UPDATE sc SET sc.ProductCode = c.Code
FROM [StopCommodities] sc JOIN [Commodities] c ON c.Id = sc.CommodityId
WHERE sc.ProductCode IS NULL AND c.Code IS NOT NULL AND c.Code <> '';");

            // 2) Unlinked lines: take the code from the invoice line with the same description, else the invoice's
            //    only code. (Multi-invoice lines like 'IN1, IN2' are handled by the runtime linker.)
            migrationBuilder.Sql(@"
;WITH x AS (
    SELECT sc.Id, MIN(i.ProductCode) Code, COUNT(DISTINCT i.ProductCode) n
    FROM [StopCommodities] sc
    JOIN [ImportedInvoices] i ON i.TransactionNumber = sc.InvoiceNumber
    WHERE sc.ProductCode IS NULL AND i.ProductCode IS NOT NULL AND i.ProductCode <> ''
      AND LTRIM(RTRIM(ISNULL(i.ProductDescription,''))) = LTRIM(RTRIM(ISNULL(sc.Comment,'')))
    GROUP BY sc.Id HAVING COUNT(DISTINCT i.ProductCode) = 1)
UPDATE sc SET sc.ProductCode = x.Code FROM [StopCommodities] sc JOIN x ON x.Id = sc.Id;

;WITH x AS (
    SELECT sc.Id, MIN(i.ProductCode) Code
    FROM [StopCommodities] sc
    JOIN [ImportedInvoices] i ON i.TransactionNumber = sc.InvoiceNumber
    WHERE sc.ProductCode IS NULL AND i.ProductCode IS NOT NULL AND i.ProductCode <> ''
    GROUP BY sc.Id HAVING COUNT(DISTINCT i.ProductCode) = 1)
UPDATE sc SET sc.ProductCode = x.Code FROM [StopCommodities] sc JOIN x ON x.Id = sc.Id;");

            // 3) Every invoiced product code becomes a stock item.
            migrationBuilder.Sql(@"
;WITH inv AS (
    SELECT ProductCode,
           MAX(ProductDescription) Description,
           MAX(Category) Category
    FROM [ImportedInvoices]
    WHERE ProductCode IS NOT NULL AND ProductCode <> ''
    GROUP BY ProductCode)
INSERT INTO [Commodities] ([Name],[Code],[Description],[Category],[UnitOfMeasure],[RequiresRefrigeration],[IsFragile],[IsHazardous],[CreatedAt])
SELECT LEFT(COALESCE(NULLIF(LTRIM(RTRIM(inv.Description)),''), inv.ProductCode), 200), LTRIM(RTRIM(inv.ProductCode)), N'Created from sales invoices',
       CAST(inv.Category AS nvarchar(100)), N'Each', 0, 0, 0, SYSUTCDATETIME()
FROM inv
WHERE NOT EXISTS (SELECT 1 FROM [Commodities] c WHERE UPPER(REPLACE(REPLACE(REPLACE(c.Code,' ',''),'-',''),'/','')) = UPPER(REPLACE(REPLACE(REPLACE(inv.ProductCode,' ',''),'-',''),'/','')));");

            // 4) Link unlinked lines by code (exact or normalised, only when unambiguous), skipping cancelled or
            //    already-deducted loads. Then by exact description.
            migrationBuilder.Sql(@"
;WITH deducted AS (
    SELECT DISTINCT LoadId FROM [WarehouseStockMovements]
    WHERE LoadId IS NOT NULL AND MovementType = 'Dispatch' AND Status = 'Approved' AND ReversedByMovementId IS NULL),
cm AS (
    SELECT UPPER(REPLACE(REPLACE(REPLACE(Code,' ',''),'-',''),'/','')) K, MIN(Id) Id, COUNT(*) n
    FROM [Commodities] WHERE Code IS NOT NULL AND Code <> '' GROUP BY UPPER(REPLACE(REPLACE(REPLACE(Code,' ',''),'-',''),'/','')))
UPDATE sc SET sc.CommodityId = cm.Id
FROM [StopCommodities] sc
JOIN [LoadStops] ls ON ls.Id = sc.LoadStopId
JOIN [Loads] l ON l.Id = ls.LoadId
JOIN cm ON cm.K = UPPER(REPLACE(REPLACE(REPLACE(sc.ProductCode,' ',''),'-',''),'/','')) AND cm.n = 1
WHERE sc.CommodityId IS NULL AND sc.ProductCode IS NOT NULL AND l.Status <> 'Cancelled'
  AND NOT EXISTS (SELECT 1 FROM deducted d WHERE d.LoadId = l.Id);

;WITH deducted AS (
    SELECT DISTINCT LoadId FROM [WarehouseStockMovements]
    WHERE LoadId IS NOT NULL AND MovementType = 'Dispatch' AND Status = 'Approved' AND ReversedByMovementId IS NULL),
cn AS (
    SELECT LOWER(LTRIM(RTRIM(Name))) K, MIN(Id) Id, MIN(Code) Code, COUNT(*) n FROM [Commodities] WHERE Name <> '' GROUP BY LOWER(LTRIM(RTRIM(Name))))
UPDATE sc SET sc.CommodityId = cn.Id, sc.ProductCode = COALESCE(sc.ProductCode, cn.Code)
FROM [StopCommodities] sc
JOIN [LoadStops] ls ON ls.Id = sc.LoadStopId
JOIN [Loads] l ON l.Id = ls.LoadId
JOIN cn ON cn.K = LOWER(LTRIM(RTRIM(ISNULL(sc.Comment,'')))) AND cn.n = 1
WHERE sc.CommodityId IS NULL AND l.Status <> 'Cancelled'
  AND NOT EXISTS (SELECT 1 FROM deducted d WHERE d.LoadId = l.Id);");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_StopCommodities_ProductCode') DROP INDEX [IX_StopCommodities_ProductCode] ON [StopCommodities];
IF COL_LENGTH('StopCommodities','ProductCode') IS NOT NULL ALTER TABLE [StopCommodities] DROP COLUMN [ProductCode];");
        }
    }
}
