using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Human flow + role blueprint for Joulene Mahabeer, Accountant (Access Medical &amp; Promed Pharmacare creditors,
    /// prepayments and intercompany). HR (id 40) and the register carry her as employee 42; login
    /// accounts2@promedtechnologies.co.za exists. Only the flow is new; "Other" titles are back-filled. Program.cs links on boot.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261030220000_AddJouleneAccountantFlow")]
    public partial class AddJouleneAccountantFlow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @emp nvarchar(20) = (SELECT TOP 1 EmployeeNumber FROM [HrEmployees] WHERE FirstName = N'Joulene' AND LastName = N'Mahabeer' AND EmployeeNumber IS NOT NULL);
IF @emp IS NULL SET @emp = (SELECT TOP 1 empid FROM [empregistration] WHERE [Name] = N'Joulene' AND [LastName] = N'Mahabeer');
IF @emp IS NULL SET @emp = N'42';
UPDATE [HrEmployees] SET JobTitle = N'Accountant', Email = COALESCE(Email, N'accounts2@promedtechnologies.co.za'),
       Notes = COALESCE(Notes, N'Company: Access Medical & Promed Pharmacare | Creditors & Accounts Payable, prepayments, intercompany')
 WHERE EmployeeNumber = @emp AND (JobTitle IS NULL OR JobTitle = N'Other');
UPDATE [empregistration] SET JobTitle = N'Accountant', Department = CASE WHEN Department IN (N'Other', N'Finance') OR Department IS NULL THEN N'Finance Department' ELSE Department END
 WHERE empid = @emp AND (JobTitle IS NULL OR JobTitle = N'Other');");

            // Joulene's cycle: daily bank statement (Ahistar) → verify payments → invoices & utilities → link GRVs
            // (missing → chase) → capture Sage 300 → age analysis & statement recons (differences → investigate) →
            // Pharmacare prepayments → intercompany balancing → payment schedule → approvals/signatures → scan & file
            // → Leona processes → POPs linked → close.
            migrationBuilder.Sql(@"
DECLARE @emp nvarchar(20) = (SELECT TOP 1 empid FROM [empregistration] WHERE [Name] = N'Joulene' AND [LastName] = N'Mahabeer');
IF @emp IS NULL SET @emp = N'42';
IF NOT EXISTS (SELECT 1 FROM [FlowDefinitions] WHERE [OwnerEmployeeId] = @emp AND [IsTemplate] = 0)
BEGIN
    INSERT INTO [FlowDefinitions] ([Name],[Description],[Category],[DepartmentName],[OwnerEmployeeId],[OwnerName],[OwnerTitle],[Level],[TriggerType],[TriggerJson],[GraphJson],[InputsJson],[IsEnabled],[IsTemplate],[Version],[StartPermissions],[BlueprintJson],[CreatedAt])
    VALUES (
        N'Joulene · Creditors & payments cycle',
        N'How Joulene runs creditors for Access Medical and Promed Pharmacare: check the daily bank statement from Ahistar and confirm supplier payments, bring in supplier and utility invoices and link them to GRVs, capture in Sage 300, reconcile the age analysis and supplier statements, manage Pharmacare prepayments and intercompany transfers, build and get the payment schedule signed, scan and file the pack for Leona, then link the POPs back to each supplier account.',
        N'Operations',
        N'Finance Department',
        @emp,
        N'Joulene Mahabeer',
        N'Accountant',
        1,
        N'manual',
        N'{""titleTemplate"":""Creditors & payments · {{inputs.period}}""}',
        N'{""startStepId"":""bank"",""steps"":[
{""id"":""bank"",""type"":""task"",""name"":""Daily bank statement"",""x"":60,""y"":60,""nextStepId"":""verifyPay"",""config"":{""title"":""Bank statement & payment check · {{inputs.period}}"",""description"":""Joulene: get the daily bank statements from Ahistar, review transactions and confirm which supplier payments have cleared for Access Medical and Promed Pharmacare."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""paymentsSeen"",""label"":""Supplier payments confirmed"",""type"":""number"",""required"":true},{""key"":""discrepancies"",""label"":""Payment discrepancies?"",""type"":""select"",""required"":true,""options"":[""No"",""Yes""]}]}},
{""id"":""verifyPay"",""type"":""condition"",""name"":""Discrepancies?"",""x"":380,""y"":60,""config"":{""expression"":""steps.bank.discrepancies == \""Yes\"""",""trueStepId"":""payQuery"",""falseStepId"":""invoices""}},
{""id"":""payQuery"",""type"":""task"",""name"":""Follow up payment discrepancy"",""x"":380,""y"":260,""nextStepId"":""invoices"",""config"":{""title"":""Follow up payment discrepancy"",""description"":""Joulene: trace the difference (wrong amount, duplicate, unexpected debit), update the payment schedule and follow up with the bank / Leona / supplier."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""resolution"",""label"":""Resolution"",""type"":""text"",""required"":true}]}},
{""id"":""invoices"",""type"":""task"",""name"":""Supplier & utility invoices"",""x"":700,""y"":60,""nextStepId"":""grv"",""config"":{""title"":""Receive and request supplier invoices"",""description"":""Joulene: collect supplier invoices for company expenses, request utility bills and any outstanding invoices, and chase suppliers for missing documents."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""Normal"",""form"":[{""key"":""invoices"",""label"":""Invoices in hand"",""type"":""number"",""required"":true}]}},
{""id"":""grv"",""type"":""task"",""name"":""Link to GRVs"",""x"":1020,""y"":60,""nextStepId"":""grvMissing"",""config"":{""title"":""Link {{steps.invoices.invoices}} invoice(s) to GRVs"",""description"":""Joulene: link Access Medical and Promed Pharmacare supplier invoices to their GRVs and verify amounts against the supporting documents."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":3,""priority"":""Normal"",""form"":[{""key"":""missingGrv"",""label"":""Invoices without a GRV / with differences"",""type"":""number"",""required"":true}]}},
{""id"":""grvMissing"",""type"":""condition"",""name"":""Missing GRVs?"",""x"":1340,""y"":60,""config"":{""expression"":""steps.grv.missingGrv > 0"",""trueStepId"":""chaseGrv"",""falseStepId"":""capture""}},
{""id"":""chaseGrv"",""type"":""task"",""name"":""Chase GRVs"",""x"":1340,""y"":260,""nextStepId"":""capture"",""config"":{""title"":""Obtain {{steps.grv.missingGrv}} GRV(s) / correct differences"",""description"":""Stock: supply the missing GRVs or confirm quantities so Joulene can capture the invoices."",""assignTo"":{""departmentName"":""Stock""},""escalateTo"":{""departmentName"":""Finance Department""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""provided"",""label"":""GRVs provided"",""type"":""number"",""required"":true}]}},
{""id"":""capture"",""type"":""task"",""name"":""Capture in Sage 300"",""x"":1660,""y"":60,""nextStepId"":""recon"",""config"":{""title"":""Capture invoices in Sage 300"",""description"":""Joulene: capture matched invoices in Sage 300 against the right company and supplier."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":3,""priority"":""Normal"",""form"":[{""key"":""captured"",""label"":""Invoices captured"",""type"":""number"",""required"":true}]}},
{""id"":""recon"",""type"":""task"",""name"":""Age analysis & statements"",""x"":1980,""y"":60,""nextStepId"":""reconDiff"",""config"":{""title"":""Reconcile age analysis and supplier statements"",""description"":""Joulene: print the creditors age analysis, request supplier statements and reconcile balances to invoices before anything goes on a payment schedule."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":8,""priority"":""Normal"",""form"":[{""key"":""recons"",""label"":""Supplier accounts reconciled"",""type"":""number"",""required"":true},{""key"":""differences"",""label"":""Differences found?"",""type"":""select"",""required"":true,""options"":[""No"",""Yes""]}]}},
{""id"":""reconDiff"",""type"":""condition"",""name"":""Differences?"",""x"":2300,""y"":60,""config"":{""expression"":""steps.recon.differences == \""Yes\"""",""trueStepId"":""investigate"",""falseStepId"":""prepay""}},
{""id"":""investigate"",""type"":""task"",""name"":""Investigate differences"",""x"":2300,""y"":260,""nextStepId"":""prepay"",""config"":{""title"":""Investigate reconciliation differences"",""description"":""Joulene: trace missing invoices, unallocated payments or pricing differences, chase suppliers and correct Sage. Escalate to the Finance manager if unresolved."",""assignTo"":{""departmentName"":""Finance Department""},""escalateTo"":{""departmentName"":""Finance Department"",""role"":""Manager""},""dueInHours"":48,""priority"":""High"",""form"":[{""key"":""cause"",""label"":""Cause and fix"",""type"":""text"",""required"":true}]}},
{""id"":""prepay"",""type"":""task"",""name"":""Pharmacare prepayments"",""x"":2620,""y"":60,""nextStepId"":""interco"",""config"":{""title"":""Prepayments & intercompany"",""description"":""Joulene: process and track Promed Pharmacare supplier prepayments, reconcile them against invoices and payments; balance intercompany transfers between the companies and request the fixed monthly payments."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""Normal"",""form"":[{""key"":""prepayments"",""label"":""Prepayments reconciled"",""type"":""number"",""required"":true},{""key"":""intercoBalanced"",""label"":""Intercompany balanced?"",""type"":""select"",""required"":true,""options"":[""Yes"",""No - follow-up noted""]}]}},
{""id"":""interco"",""type"":""task"",""name"":""Payment schedule"",""x"":2940,""y"":60,""nextStepId"":""approve"",""config"":{""title"":""Prepare / update payment schedule"",""description"":""Joulene: add reconciled amounts to the Access Medical and Promed Pharmacare payment schedules with supporting documents."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":3,""priority"":""High"",""form"":[{""key"":""suppliers"",""label"":""Suppliers on schedule"",""type"":""number"",""required"":true},{""key"":""total"",""label"":""Total to pay (R)"",""type"":""number"",""required"":false}]}},
{""id"":""approve"",""type"":""task"",""name"":""Signatures & approval"",""x"":3260,""y"":60,""nextStepId"":""file"",""config"":{""title"":""Approve payment schedule ({{steps.interco.suppliers}} suppliers)"",""description"":""Finance manager: review and sign the schedule and supporting documentation."",""assignTo"":{""departmentName"":""Finance Department"",""role"":""Manager""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""approved"",""label"":""Approved"",""type"":""select"",""required"":true,""options"":[""Yes"",""With changes"",""No""]}]}},
{""id"":""file"",""type"":""task"",""name"":""Scan, upload & submit to Leona"",""x"":3580,""y"":60,""nextStepId"":""process"",""config"":{""title"":""Scan signed pack and submit to Leona"",""description"":""Joulene: scan and upload the signed schedule and documents, compile the payment file and hand it to Leona for processing."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[]}},
{""id"":""process"",""type"":""task"",""name"":""Leona processes payments"",""x"":3900,""y"":60,""nextStepId"":""pops"",""config"":{""title"":""Process payments and return POPs"",""description"":""Leona: process the approved payments and return the Proofs of Payment."",""assignTo"":{""departmentName"":""Finance Department"",""role"":""Manager""},""dueInHours"":48,""priority"":""High"",""form"":[{""key"":""paid"",""label"":""Payments processed"",""type"":""number"",""required"":true}]}},
{""id"":""pops"",""type"":""task"",""name"":""Link POPs & file"",""x"":4220,""y"":60,""nextStepId"":""end"",""config"":{""title"":""Link {{steps.process.paid}} POP(s) to supplier accounts"",""description"":""Joulene: link each POP to its supplier account, invoice and GRV; file by payment date and update the payment records."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""Normal"",""form"":[{""key"":""filed"",""label"":""Payment packs filed"",""type"":""number"",""required"":true}]}},
{""id"":""end"",""type"":""end"",""name"":""Cycle closed"",""x"":4540,""y"":60,""config"":{""outcome"":""closed""}}
]}',
        N'[{""key"":""period"",""label"":""Period / run (e.g. week 44, Oct month-end)"",""type"":""text"",""required"":true},{""key"":""company"",""label"":""Company focus (optional)"",""type"":""select"",""required"":false,""options"":[""Access Medical"",""Promed Pharmacare"",""Both""]}]',
        1, 0, 1,
        N'module:finance',
        N'{
 ""email"": ""accounts2@promedtechnologies.co.za"",
 ""company"": ""Access Medical & Promed Pharmacare"",
 ""purpose"": ""Keep the Access Medical and Promed Pharmacare creditors books accurate and paid on time: every supplier invoice is GRV-linked and captured in Sage 300, reconciled to the supplier''s statement and the bank, prepayments and intercompany balances are clean, and every payment is approved, documented and traceable to its POP."",
 ""reportsTo"": ""Finance Manager (payments processed by Leona; bank statements from Ahistar)"",
 ""team"": ""Creditors & Accounts Payable (Finance) \u2014 works with Stock for GRVs, Ahistar for bank statements, Leona for payments"",
 ""functionalArea"": ""Creditors & Accounts Payable"",
 ""positionLevel"": ""Accountant"",
 ""responsibilities"": [
  {""area"": ""Supplier invoice processing & capturing"", ""items"": [""Receive and capture supplier invoices for company expenses"", ""Capture supplier invoices into Sage 300"", ""Request and obtain utility bills and outstanding supplier invoices"", ""Follow up suppliers for missing invoices and documentation"", ""Link supplier invoices to GRVs for Access Medical"", ""Process and link Promed Pharmacare supplier invoices to their GRVs"", ""Verify invoice amounts against supporting documentation"", ""Print creditors age analysis and match balances to supplier invoices""]},
  {""area"": ""Bank statements & payment monitoring"", ""items"": [""Obtain daily bank statements from Ahistar to verify payments"", ""Review bank transactions against outstanding supplier accounts"", ""Update payment schedules from verified payment information"", ""Identify and follow up payment discrepancies"", ""Track payment dates and keep accurate payment records"", ""Obtain POPs from Leona and link them to supplier accounts""]},
  {""area"": ""Creditors management & payment processing"", ""items"": [""Manage creditors accounts for Access Medical and Promed Pharmacare"", ""Reconcile invoices and statements before adding to payment schedules"", ""Prepare and update supplier payment schedules"", ""Submit schedules and documentation for signatures and approvals"", ""Scan and upload signed payment documents"", ""Compile payment files and submit to Leona"", ""Follow up outstanding supplier invoices and payment matters"", ""Request supplier statements to keep accounts current""]},
  {""area"": ""Prepayments & Promed Pharmacare management"", ""items"": [""Process and manage supplier prepayments for Promed Pharmacare"", ""Track prepayments so they are correctly allocated and accounted for"", ""Follow up prepayment balances and supplier documentation"", ""Reconcile prepayments against invoices and payments"", ""Maintain accurate prepayment records""]},
  {""area"": ""Account reconciliation & intercompany transactions"", ""items"": [""Perform monthly supplier account reconciliations"", ""Reconcile creditors accounts and investigate discrepancies"", ""Balance and reconcile intercompany transfers"", ""Process and monitor intercompany payments"", ""Ensure inter-company transactions are accurately recorded and allocated"", ""Request and coordinate fixed monthly payments"", ""Maintain accurate records across both companies""]},
  {""area"": ""Financial administration & record management"", ""items"": [""Maintain organised supplier invoice and payment documentation"", ""File invoices by payment date"", ""Keep invoices, GRVs, POPs and supporting documents linked and stored"", ""Maintain accurate payment schedules and creditors records"", ""Ensure documentation is scanned, uploaded and available for audit""]}
 ],
 ""kpis"": [
  {""name"": ""Bank statement reviewed and payments confirmed"", ""target"": ""Every working day"", ""source"": ""Bank statements / payment schedule"" },
  {""name"": ""Supplier invoices captured within 3 working days"", ""target"": ""100%"", ""source"": ""Sage 300"" },
  {""name"": ""Captured invoices linked to a GRV"", ""target"": ""100%"", ""source"": ""Invoice packs"" },
  {""name"": ""Supplier accounts reconciled to statement monthly"", ""target"": ""All active suppliers by the 5th working day"", ""source"": ""Reconciliations"" },
  {""name"": ""Pharmacare prepayments reconciled"", ""target"": ""Monthly, zero unallocated"", ""source"": ""Prepayment schedule"" },
  {""name"": ""Intercompany balances agreed"", ""target"": ""Monthly, zero unexplained differences"", ""source"": ""Intercompany recon"" },
  {""name"": ""Payment pack signed and submitted to Leona"", ""target"": ""By the agreed cut-off each run"", ""source"": ""Payment files"" },
  {""name"": ""POPs linked and filed"", ""target"": ""Within 2 working days of payment"", ""source"": ""Payment files"" }
 ],
 ""systems"": [""Sage 300 (creditors, age analysis, prepayments, intercompany)"", ""Bank statements (via Ahistar)"", ""Payment schedules (Excel)"", ""Scanner / intranet document uploads"", ""Supplier statements & portals"", ""Email & phone""],
 ""inputs"": [""Supplier and utility invoices (Access Medical / Promed Pharmacare)"", ""GRVs from Stock"", ""Daily bank statements from Ahistar"", ""Supplier statements"", ""POPs from Leona"", ""Intercompany transfer requests""],
 ""outputs"": [""Captured, GRV-linked invoices in Sage 300"", ""Reconciled supplier accounts and age analysis"", ""Prepayment and intercompany reconciliations"", ""Signed, scanned payment packs for Leona"", ""POPs linked to supplier accounts and filed""],
 ""painPoints"": [
  {""issue"": ""Bank statements depend on Ahistar sending them"", ""idea"": ""Direct bank feed / daily statement drop into the intranet so the day starts without waiting.""},
  {""issue"": ""Utility and expense invoices have to be requested"", ""idea"": ""Supplier invoice inbox monitored by Welly: utilities auto-logged, missing-invoice reminders sent on a schedule.""},
  {""issue"": ""Prepayments easy to lose track of across months"", ""idea"": ""Prepayment register on the intranet with ageing and auto-matching to incoming invoices.""},
  {""issue"": ""Paper signatures slow the payment run"", ""idea"": ""The approval step here is a tracked task; next: e-signature on the uploaded schedule so the pack is signed where it is stored.""}
 ],
 ""handover"": ""If Joulene is away: get the bank statement from Ahistar daily and tick off supplier payments on the schedule; bring in supplier and utility invoices, link each to its GRV and capture in Sage 300 against the right company; reconcile statements and the age analysis before adding anything to the payment schedule; keep the Pharmacare prepayment register and intercompany balances up to date; get the schedule signed, scan it and hand the pack to Leona by the cut-off; when POPs return, link them to the supplier account and file by date. Escalate unexplained differences to the Finance Manager."",
 ""reviewedAt"": ""2026-10-30""
}',
        SYSUTCDATETIME());
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM [FlowDefinitions] WHERE [OwnerName] = N'Joulene Mahabeer' AND [Name] = N'Joulene · Creditors & payments cycle';");
        }
    }
}
