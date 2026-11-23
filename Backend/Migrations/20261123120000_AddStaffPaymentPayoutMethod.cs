using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Staff payments: how the money goes out — EFT (bank details) or eWallet (cellphone number).</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261123120000_AddStaffPaymentPayoutMethod")]
    public partial class AddStaffPaymentPayoutMethod : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','PayoutMethod') IS NULL ALTER TABLE PaymentBatchItems ADD PayoutMethod nvarchar(10) NULL;
");
            // Existing staff payments were all paid by EFT.
            migrationBuilder.Sql(@"
UPDATE i SET PayoutMethod = 'EFT'
FROM PaymentBatchItems i JOIN PaymentBatches b ON b.Id = i.BatchId
WHERE b.PaymentType = 'StaffPayment' AND i.PayoutMethod IS NULL;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('PaymentBatchItems','PayoutMethod') IS NOT NULL ALTER TABLE PaymentBatchItems DROP COLUMN PayoutMethod;
");
        }
    }
}
