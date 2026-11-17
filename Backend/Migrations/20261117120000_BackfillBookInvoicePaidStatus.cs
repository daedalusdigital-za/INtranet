using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Books: invoices that were captured with a payment date were left as "Confirmed", so Finance saw
    /// "paid 12 Nov" next to a Confirmed pill and a Mark-as-Paid button. A payment date means Paid.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261117120000_BackfillBookInvoicePaidStatus")]
    public partial class BackfillBookInvoicePaidStatus : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE BookInvoices
   SET Status = 'Paid', UpdatedAt = SYSUTCDATETIME()
 WHERE PaymentDate IS NOT NULL
   AND Status IN ('Confirmed','Payment Requested','Submitted','Pending');
");
        }

        protected override void Down(MigrationBuilder migrationBuilder) { }
    }
}
