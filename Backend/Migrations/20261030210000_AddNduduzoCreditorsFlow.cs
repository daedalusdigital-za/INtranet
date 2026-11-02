using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Human flow + role blueprint for Nduduzo Ndlovu, Creditors Clerk (Promed Technologies, KOD &amp; Sebenzani Trading).
    /// HR (id 53) and the register already carry him as employee 58 (spelt "Ndunduzo"); login accounts5@promedtechnologies.co.za
    /// exists. Only the flow is new; titles/department are back-filled from "Other". Program.cs links on boot.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261030210000_AddNduduzoCreditorsFlow")]
    public partial class AddNduduzoCreditorsFlow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @emp nvarchar(20) = (SELECT TOP 1 EmployeeNumber FROM [HrEmployees] WHERE FirstName IN (N'Ndunduzo', N'Nduduzo', N'Nduduzu') AND LastName IN (N'Ndlovu', N'Ndovu') AND EmployeeNumber IS NOT NULL);
IF @emp IS NULL SET @emp = (SELECT TOP 1 empid FROM [empregistration] WHERE [Name] IN (N'Ndunduzo', N'Nduduzo', N'Nduduzu') AND [LastName] IN (N'Ndlovu', N'Ndovu'));
IF @emp IS NULL SET @emp = N'58';
UPDATE [HrEmployees] SET JobTitle = N'Creditors Clerk', Email = COALESCE(Email, N'accounts5@promedtechnologies.co.za'),
       Notes = COALESCE(Notes, N'Company: Promed Technologies, KOD & Sebenzani Trading | Creditors & Accounts Payable')
 WHERE EmployeeNumber = @emp AND (JobTitle IS NULL OR JobTitle = N'Other');
UPDATE [empregistration] SET JobTitle = N'Creditors Clerk', Department = CASE WHEN Department IN (N'Other', N'Finance') OR Department IS NULL THEN N'Finance Department' ELSE Department END
 WHERE empid = @emp AND (JobTitle IS NULL OR JobTitle = N'Other');");

            // Nduduzo's cycle: receive supplier invoices → get GRVs/delivery notes (Maksooda & Aldrisha) → match
            // (mismatch → query supplier/stock) → capture in Sage 300 + printout → statements & age analysis
            // (differences → reconcile) → payment schedule → Leona reviews & pays → POPs matched & filed → POP requests → close.
            migrationBuilder.Sql(@"
DECLARE @emp nvarchar(20) = (SELECT TOP 1 empid FROM [empregistration] WHERE [Name] IN (N'Ndunduzo', N'Nduduzo', N'Nduduzu') AND [LastName] IN (N'Ndlovu', N'Ndovu'));
IF @emp IS NULL SET @emp = N'58';
IF NOT EXISTS (SELECT 1 FROM [FlowDefinitions] WHERE [OwnerEmployeeId] = @emp AND [IsTemplate] = 0)
BEGIN
    INSERT INTO [FlowDefinitions] ([Name],[Description],[Category],[DepartmentName],[OwnerEmployeeId],[OwnerName],[OwnerTitle],[Level],[TriggerType],[TriggerJson],[GraphJson],[InputsJson],[IsEnabled],[IsTemplate],[Version],[StartPermissions],[BlueprintJson],[CreatedAt])
    VALUES (
        N'Nduduzo · Creditors cycle',
        N'How Nduduzo runs creditors for Promed Technologies, KOD and Sebenzani Trading: receive supplier invoices, obtain the GRVs and delivery notes from Maksooda and Aldrisha, match and capture in Sage 300 with a printout as proof, reconcile supplier statements and the age analysis, prepare the payment schedule for Leona, then match every Proof of Payment to its invoice pack, file by date and hand out POPs to whoever asks.',
        N'Operations',
        N'Finance Department',
        @emp,
        N'Nduduzo Ndlovu',
        N'Creditors Clerk',
        1,
        N'manual',
        N'{""titleTemplate"":""Creditors · {{inputs.period}}""}',
        N'{""startStepId"":""receive"",""steps"":[
{""id"":""receive"",""type"":""task"",""name"":""Receive supplier invoices"",""x"":60,""y"":60,""nextStepId"":""grv"",""config"":{""title"":""Receive supplier invoices · {{inputs.period}}"",""description"":""Nduduzo: collect the supplier invoices received (email, post, hand-delivered) for Promed, KOD and Sebenzani and log them for processing."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""invoices"",""label"":""Invoices received"",""type"":""number"",""required"":true}]}},
{""id"":""grv"",""type"":""task"",""name"":""Obtain GRVs & delivery notes"",""x"":380,""y"":60,""nextStepId"":""match"",""config"":{""title"":""Get GRVs / delivery notes for {{steps.receive.invoices}} invoice(s)"",""description"":""Stock (Maksooda & Aldrisha): provide the Goods Received Vouchers and delivery notes for the listed supplier invoices."",""assignTo"":{""departmentName"":""Stock""},""escalateTo"":{""departmentName"":""Finance Department""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""provided"",""label"":""GRVs / delivery notes provided"",""type"":""number"",""required"":true}]}},
{""id"":""match"",""type"":""task"",""name"":""Match invoices to GRVs"",""x"":700,""y"":60,""nextStepId"":""mismatch"",""config"":{""title"":""Match invoices to GRVs"",""description"":""Nduduzo: check quantities, prices, VAT and totals on each invoice against its GRV and delivery note."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":3,""priority"":""Normal"",""form"":[{""key"":""mismatches"",""label"":""Invoices that do not match / lack GRV"",""type"":""number"",""required"":true}]}},
{""id"":""mismatch"",""type"":""condition"",""name"":""Mismatches?"",""x"":1020,""y"":60,""config"":{""expression"":""steps.match.mismatches > 0"",""trueStepId"":""query"",""falseStepId"":""capture""}},
{""id"":""query"",""type"":""task"",""name"":""Query supplier / Stock"",""x"":1020,""y"":260,""nextStepId"":""capture"",""config"":{""title"":""Resolve {{steps.match.mismatches}} mismatch(es)"",""description"":""Nduduzo: query the supplier for a corrected invoice / credit, or Stock for the missing GRV, and hold the invoice until it matches."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":48,""priority"":""High"",""form"":[{""key"":""outcome"",""label"":""Outcome"",""type"":""select"",""required"":true,""options"":[""Corrected invoice received"",""Supplier credit note"",""GRV obtained"",""Still outstanding""]}]}},
{""id"":""capture"",""type"":""task"",""name"":""Capture in Sage 300"",""x"":1340,""y"":60,""nextStepId"":""statements"",""config"":{""title"":""Capture matched invoices in Sage 300"",""description"":""Nduduzo: capture each matched invoice into Sage 300 against the right company and supplier, print the capture report and attach it to the invoice pack as proof of processing."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":3,""priority"":""Normal"",""form"":[{""key"":""captured"",""label"":""Invoices captured"",""type"":""number"",""required"":true}]}},
{""id"":""statements"",""type"":""task"",""name"":""Statements & age analysis"",""x"":1660,""y"":60,""nextStepId"":""differences"",""config"":{""title"":""Reconcile supplier statements"",""description"":""Nduduzo: obtain suppliers'' monthly statements, generate ours from Sage 300, run the creditors age analysis and compare balances."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":8,""priority"":""Normal"",""form"":[{""key"":""recons"",""label"":""Supplier accounts reconciled"",""type"":""number"",""required"":true},{""key"":""differences"",""label"":""Any differences / missing documents?"",""type"":""select"",""required"":true,""options"":[""No"",""Yes""]}]}},
{""id"":""differences"",""type"":""condition"",""name"":""Differences?"",""x"":1980,""y"":60,""config"":{""expression"":""steps.statements.differences == \""Yes\"""",""trueStepId"":""investigate"",""falseStepId"":""schedule""}},
{""id"":""investigate"",""type"":""task"",""name"":""Investigate differences"",""x"":1980,""y"":260,""nextStepId"":""schedule"",""config"":{""title"":""Investigate statement differences"",""description"":""Nduduzo: trace each difference (missing invoice, unallocated payment, pricing), chase the supplier or Stock for missing invoices / GRVs and correct Sage."",""assignTo"":{""departmentName"":""Finance Department""},""escalateTo"":{""departmentName"":""Finance Department"",""role"":""Manager""},""dueInHours"":48,""priority"":""High"",""form"":[{""key"":""cause"",""label"":""Cause and fix"",""type"":""text"",""required"":true}]}},
{""id"":""schedule"",""type"":""task"",""name"":""Prepare payment schedule"",""x"":2300,""y"":60,""nextStepId"":""review"",""config"":{""title"":""Prepare supplier payment schedule"",""description"":""Nduduzo: from the age analysis and agreed terms, prepare the payment schedule per company with the supporting invoice packs."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""High"",""form"":[{""key"":""suppliers"",""label"":""Suppliers on schedule"",""type"":""number"",""required"":true},{""key"":""total"",""label"":""Total to pay (R)"",""type"":""number"",""required"":false}]}},
{""id"":""review"",""type"":""task"",""name"":""Leona reviews & pays"",""x"":2620,""y"":60,""nextStepId"":""pops"",""config"":{""title"":""Review and process payment schedule ({{steps.schedule.suppliers}} suppliers)"",""description"":""Leona: review the schedule, process the payments and return the Proofs of Payment to Nduduzo."",""assignTo"":{""departmentName"":""Finance Department"",""role"":""Manager""},""dueInHours"":48,""priority"":""High"",""form"":[{""key"":""paid"",""label"":""Payments processed"",""type"":""number"",""required"":true}]}},
{""id"":""pops"",""type"":""task"",""name"":""Match POPs & file"",""x"":2940,""y"":60,""nextStepId"":""requests"",""config"":{""title"":""Match {{steps.review.paid}} POP(s) to invoice packs"",""description"":""Nduduzo: attach each Proof of Payment to its invoice, GRV, delivery note and capture printout; file chronologically by payment date."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""Normal"",""form"":[{""key"":""filed"",""label"":""Payment packs filed"",""type"":""number"",""required"":true}]}},
{""id"":""requests"",""type"":""task"",""name"":""POP & document requests"",""x"":3260,""y"":60,""nextStepId"":""end"",""config"":{""title"":""Distribute POPs and answer document requests"",""description"":""Nduduzo: send POPs and payment confirmations to employees / departments that ask, and retrieve supporting documents on request."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""Normal"",""form"":[{""key"":""requests"",""label"":""Requests handled"",""type"":""number"",""required"":false}]}},
{""id"":""end"",""type"":""end"",""name"":""Cycle closed"",""x"":3580,""y"":60,""config"":{""outcome"":""closed""}}
]}',
        N'[{""key"":""period"",""label"":""Period / run (e.g. week 44, Oct month-end)"",""type"":""text"",""required"":true},{""key"":""company"",""label"":""Company focus (optional)"",""type"":""select"",""required"":false,""options"":[""Promed Technologies"",""KOD"",""Sebenzani Trading"",""All""]}]',
        1, 0, 1,
        N'module:finance',
        N'{
 ""email"": ""accounts5@promedtechnologies.co.za"",
 ""company"": ""Promed Technologies, KOD & Sebenzani Trading"",
 ""purpose"": ""Make sure every supplier invoice for Promed, KOD and Sebenzani is GRV-backed, captured in Sage 300, reconciled to the supplier''s statement and paid on schedule \u2014 with a complete, filed payment pack behind every Proof of Payment."",
 ""reportsTo"": ""Finance Manager (payments reviewed and released by Leona)"",
 ""team"": ""Creditors & Accounts Payable (Finance) \u2014 works with Stock (Maksooda & Aldrisha) for GRVs and Leona for payments"",
 ""functionalArea"": ""Creditors & Accounts Payable"",
 ""positionLevel"": ""Creditors Clerk"",
 ""responsibilities"": [
  {""area"": ""Supplier invoice processing & capturing"", ""items"": [""Receive and process supplier invoices"", ""Capture supplier invoices into Sage 300"", ""Obtain and keep invoice capture printouts as proof of processing"", ""Verify invoices against the relevant GRVs and delivery notes"", ""Match and reconcile invoices with GRVs (quantities, details, amounts)"", ""Obtain GRVs and delivery notes from Maksooda and Aldrisha"", ""Ensure every supplier invoice is supported by the necessary documentation""]},
  {""area"": ""Creditors reconciliation & age analysis"", ""items"": [""Perform supplier account reconciliations"", ""Obtain monthly statements from suppliers"", ""Generate supplier statements from Sage 300"", ""Conduct creditors age analysis of outstanding balances and obligations"", ""Investigate discrepancies between supplier statements and internal records"", ""Follow up missing invoices, GRVs and supporting documentation""]},
  {""area"": ""Payment preparation & processing"", ""items"": [""Prepare supplier payment schedules from outstanding accounts and agreed terms"", ""Submit completed schedules to Leona for review and processing"", ""Monitor supplier accounts and outstanding payment obligations"", ""Obtain Proofs of Payment (POPs) from Leona once processed"", ""Match each POP to the supplier invoice and supporting documents""]},
  {""area"": ""Payment documentation & record management"", ""items"": [""Attach supporting paperwork to each POP"", ""Ensure payment records contain invoices, GRVs, delivery notes and related documents"", ""File completed payment documentation chronologically by date"", ""Maintain organised, accurate supplier payment records"", ""Keep documentation available for audit and future reference""]},
  {""area"": ""Internal departmental support"", ""items"": [""Distribute POPs to employees and departments on request"", ""Assist departments with supplier payment confirmations"", ""Retrieve and provide supporting financial documentation"", ""Coordinate with colleagues to obtain missing invoices, GRVs, delivery notes and payment documents"", ""Keep supplier-related financial records maintained and accessible""]}
 ],
 ""kpis"": [
  {""name"": ""Supplier invoices captured within 3 working days of receipt"", ""target"": ""100%"", ""source"": ""Sage 300 capture reports"" },
  {""name"": ""Captured invoices with GRV + delivery note attached"", ""target"": ""100%"", ""source"": ""Invoice packs"" },
  {""name"": ""Supplier accounts reconciled to statement monthly"", ""target"": ""All active suppliers by the 5th working day"", ""source"": ""Reconciliations"" },
  {""name"": ""Unexplained statement differences"", ""target"": ""Zero at month end"", ""source"": ""Reconciliations / age analysis"" },
  {""name"": ""Payment schedule submitted to Leona"", ""target"": ""By the agreed cut-off each run"", ""source"": ""Payment schedules"" },
  {""name"": ""POPs matched and filed"", ""target"": ""Within 2 working days of payment"", ""source"": ""Payment files"" },
  {""name"": ""POP / document requests answered"", ""target"": ""Same day"", ""source"": ""Request log"" }
 ],
 ""systems"": [""Sage 300 (creditors, capture reports, statements, age analysis)"", ""Supplier statements (email / portals)"", ""GRVs & delivery notes from Stock"", ""Payment schedule (Excel)"", ""Chronological payment files"", ""Email & phone""],
 ""inputs"": [""Supplier invoices (Promed / KOD / Sebenzani)"", ""GRVs and delivery notes from Maksooda & Aldrisha"", ""Supplier monthly statements"", ""POPs from Leona"", ""POP / document requests from departments""],
 ""outputs"": [""Invoices captured in Sage 300 with printouts"", ""Reconciled supplier accounts and age analysis"", ""Payment schedules for Leona"", ""Matched, filed payment packs"", ""POPs and payment confirmations distributed""],
 ""painPoints"": [
  {""issue"": ""Waiting on GRVs / delivery notes before invoices can be captured"", ""idea"": ""The GRV step is a tracked task to Stock with a 24h due date; longer term, GRV capture in the intranet so Finance can see it instantly.""},
  {""issue"": ""Supplier statements arrive in many formats"", ""idea"": ""Welly extracts invoice numbers and amounts from statement PDFs and pre-lists differences against Sage 300.""},
  {""issue"": ""Three companies, one clerk \u2014 easy to mix up entities"", ""idea"": ""Company is a required field on every capture / schedule; per-company age analysis tiles on the Finance dashboard.""},
  {""issue"": ""Departments ask for POPs by hand"", ""idea"": ""Self-service POP lookup on the intranet by supplier / invoice / date.""}
 ],
 ""handover"": ""If Nduduzo is away: log every supplier invoice as it arrives; ask Maksooda / Aldrisha for the GRV and delivery note and capture nothing that does not match; capture in Sage 300 against the correct company and keep the printout with the invoice; reconcile supplier statements monthly and chase missing invoices / GRVs; prepare the payment schedule and hand it to Leona by the cut-off; when POPs come back, attach them to the full pack and file by date; answer POP requests the same day. Escalate unresolved supplier differences to the Finance Manager."",
 ""reviewedAt"": ""2026-10-30""
}',
        SYSUTCDATETIME());
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM [FlowDefinitions] WHERE [OwnerName] = N'Nduduzo Ndlovu' AND [Name] = N'Nduduzo · Creditors cycle';");
        }
    }
}
