using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Per-payment urgent flag and payment mode (Normal | PayAndClear); unique (batch, sha256) so a racing double upload can never store the same file twice.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261120150000_AddPaymentItemUrgentModeAndDocUnique")]
    public partial class AddPaymentItemUrgentModeAndDocUnique : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','IsUrgent') IS NULL    ALTER TABLE PaymentBatchItems ADD IsUrgent bit NOT NULL CONSTRAINT DF_PaymentBatchItems_IsUrgent DEFAULT 0;
IF COL_LENGTH('PaymentBatchItems','PaymentMode') IS NULL ALTER TABLE PaymentBatchItems ADD PaymentMode nvarchar(20) NOT NULL CONSTRAINT DF_PaymentBatchItems_PaymentMode DEFAULT 'Normal';

-- Remove duplicates that slipped in while two uploads of the same file were racing (keep the first one), then lock it down.
;WITH d AS (
    SELECT Id, ROW_NUMBER() OVER (PARTITION BY BatchId, Sha256 ORDER BY Id) rn
    FROM PaymentBatchDocuments WHERE Sha256 IS NOT NULL
)
DELETE FROM PaymentBatchDocuments WHERE Id IN (SELECT Id FROM d WHERE rn > 1);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PaymentBatchDocuments_Batch_Sha' AND object_id = OBJECT_ID('PaymentBatchDocuments'))
    CREATE UNIQUE INDEX UX_PaymentBatchDocuments_Batch_Sha ON PaymentBatchDocuments(BatchId, Sha256) WHERE Sha256 IS NOT NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PaymentBatchDocuments_Batch_Sha' AND object_id = OBJECT_ID('PaymentBatchDocuments')) DROP INDEX UX_PaymentBatchDocuments_Batch_Sha ON PaymentBatchDocuments;
IF COL_LENGTH('PaymentBatchItems','IsUrgent') IS NOT NULL    BEGIN ALTER TABLE PaymentBatchItems DROP CONSTRAINT DF_PaymentBatchItems_IsUrgent; ALTER TABLE PaymentBatchItems DROP COLUMN IsUrgent; END
IF COL_LENGTH('PaymentBatchItems','PaymentMode') IS NOT NULL BEGIN ALTER TABLE PaymentBatchItems DROP CONSTRAINT DF_PaymentBatchItems_PaymentMode; ALTER TABLE PaymentBatchItems DROP COLUMN PaymentMode; END
");
        }
    }
}
