using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Flows text follows the new document rules on payment packs: every invoice needs its supplier recon
    /// (Excel or PDF); quotes / POs / GRVs / proof of work / bank letters are optional (warned, not blocking);
    /// requisitions live in their own module and are no longer attached to packs.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261117150000_UpdateSupplierPaymentFlowDocs")]
    public partial class UpdateSupplierPaymentFlowDocs : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE FlowDefinitions SET GraphJson = REPLACE(GraphJson,
  'Attach the required documents per payment, then Submit.',
  'Every invoice must come with its supplier recon (.xlsx or PDF) and, with the recon, the Sage aged payables PDF - the form will not add the payment without them. Quotes, purchase orders, GRVs, proof of work and bank letters are optional: attach them where you have them (missing ones are flagged to the approvers, not blocked). Requisitions / payment requests are handled in their own module, not in the pack. Then Submit.')
WHERE Name LIKE N'Supplier payment%' AND IsTemplate = 1;

UPDATE FlowDefinitions SET GraphJson = REPLACE(GraphJson,
  'the red items on the pack (missing documents, bank letter older than 3 months, account differs from letter, duplicate invoice, VAT / amount mismatch)',
  'the red items on the pack (invoice without its recon, missing required documents, bank letter older than 3 months, account differs from letter, duplicate invoice, VAT / amount mismatch). Yellow items (no quote / PO / GRV / bank letter) are warnings for the approvers, not blockers')
WHERE Name LIKE N'Supplier payment%' AND IsTemplate = 1;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder) { }
    }
}
