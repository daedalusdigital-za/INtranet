using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Human flow + role blueprint for Colene Moonsamy (emp 71), Debtors Clerk at Promed Technologies
    /// (accounts1@promedtechnologies.co.za). Program.cs links the flow to her existing user on boot and back-fills
    /// her register record (department / job title were "Other").
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261030170000_AddColeneDebtorsFlow")]
    public partial class AddColeneDebtorsFlow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Colene's daily cycle: age analysis → collections (with query branch) → invoicing & platform uploads →
            // POD verification (with missing-POD branch) → reconciliation (with discrepancy branch) → filing → close.
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM [FlowDefinitions] WHERE [OwnerEmployeeId] = N'71' AND [IsTemplate] = 0)
BEGIN
    INSERT INTO [FlowDefinitions] ([Name],[Description],[Category],[DepartmentName],[OwnerEmployeeId],[OwnerName],[OwnerTitle],[Level],[TriggerType],[TriggerJson],[GraphJson],[InputsJson],[IsEnabled],[IsTemplate],[Version],[StartPermissions],[BlueprintJson],[CreatedAt])
    VALUES (
        N'Colene · Debtors day (Promed)',
        N'How Colene runs the Promed Technologies debtors desk each day: review overdue accounts, chase payments by phone and email, prepare and upload invoices to customer platforms, verify every invoice has its POD, reconcile accounts and resolve discrepancies, then file everything so the paper trail is audit-ready.',
        N'Operations',
        N'Finance Department',
        N'71',
        N'Colene Moonsamy',
        N'Debtors Clerk',
        1,
        N'manual',
        N'{""titleTemplate"":""Promed debtors day · {{inputs.day}}""}',
        N'{""startStepId"":""age"",""steps"":[
{""id"":""age"",""type"":""task"",""name"":""Review overdue accounts"",""x"":60,""y"":60,""nextStepId"":""collect"",""config"":{""title"":""Review Promed age analysis · {{inputs.day}}"",""description"":""Colene: check 30/60/90-day balances, flag accounts outside their payment terms and pick today''s follow-ups."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":1,""priority"":""Normal"",""form"":[{""key"":""overdueAccounts"",""label"":""Overdue accounts to follow up"",""type"":""number"",""required"":true}]}},
{""id"":""collect"",""type"":""task"",""name"":""Collections calls & emails"",""x"":380,""y"":60,""nextStepId"":""hasQuery"",""config"":{""title"":""Collections: {{steps.age.overdueAccounts}} accounts"",""description"":""Colene: follow-up calls on outstanding balances, send payment requests and statements, log promises to pay and any queries raised."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""High"",""form"":[{""key"":""promises"",""label"":""Promises to pay"",""type"":""number"",""required"":true},{""key"":""queries"",""label"":""Any account / payment queries?"",""type"":""select"",""required"":true,""options"":[""No"",""Yes""]}]}},
{""id"":""hasQuery"",""type"":""condition"",""name"":""Queries?"",""x"":700,""y"":60,""config"":{""expression"":""steps.collect.queries == \""Yes\"""",""trueStepId"":""query"",""falseStepId"":""invoice""}},
{""id"":""query"",""type"":""task"",""name"":""Resolve account query"",""x"":700,""y"":260,""nextStepId"":""invoice"",""config"":{""title"":""Resolve customer account query"",""description"":""Colene: investigate the balance / payment query, confirm with the customer and agree next steps. Raise a credit note or reinvoice request if the invoice was wrong."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""outcome"",""label"":""Outcome"",""type"":""select"",""required"":true,""options"":[""Resolved"",""Payment arrangement"",""Credit note / reinvoice needed"",""Escalated""]}]}},
{""id"":""invoice"",""type"":""task"",""name"":""Invoices & uploads"",""x"":1020,""y"":60,""nextStepId"":""pod"",""config"":{""title"":""Prepare, send and upload invoices"",""description"":""Colene: prepare and send today''s invoices, upload them to the customer platforms that require it, and process any credit notes / reinvoicing agreed with customers."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":3,""priority"":""Normal"",""form"":[{""key"":""invoices"",""label"":""Invoices sent"",""type"":""number"",""required"":true},{""key"":""uploads"",""label"":""Uploaded to customer platforms"",""type"":""number"",""required"":false},{""key"":""creditNotes"",""label"":""Credit notes / reinvoices"",""type"":""number"",""required"":false}]}},
{""id"":""pod"",""type"":""task"",""name"":""Verify PODs"",""x"":1340,""y"":60,""nextStepId"":""podMissing"",""config"":{""title"":""Match PODs to invoices"",""description"":""Colene: confirm every invoice sent has a signed Proof of Delivery on file. List the ones still missing."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""missingPods"",""label"":""Invoices missing a POD"",""type"":""number"",""required"":true}]}},
{""id"":""podMissing"",""type"":""condition"",""name"":""Missing PODs?"",""x"":1660,""y"":60,""config"":{""expression"":""steps.pod.missingPods > 0"",""trueStepId"":""chasePod"",""falseStepId"":""recon""}},
{""id"":""chasePod"",""type"":""task"",""name"":""Chase missing PODs"",""x"":1660,""y"":260,""nextStepId"":""recon"",""config"":{""title"":""Chase {{steps.pod.missingPods}} missing POD(s)"",""description"":""Colene: request the signed PODs from the drivers / logistics team and follow up until they are received and filed."",""assignTo"":{""departmentName"":""Finance Department""},""escalateTo"":{""departmentName"":""Logistics""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""received"",""label"":""PODs received"",""type"":""number"",""required"":true}]}},
{""id"":""recon"",""type"":""task"",""name"":""Reconcile accounts"",""x"":1980,""y"":60,""nextStepId"":""discrep"",""config"":{""title"":""Reconcile customer accounts"",""description"":""Colene: match receipts and remittances to invoices, reconcile the accounts worked today and note any discrepancies."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""discrepancies"",""label"":""Discrepancies found?"",""type"":""select"",""required"":true,""options"":[""No"",""Yes""]}]}},
{""id"":""discrep"",""type"":""condition"",""name"":""Discrepancies?"",""x"":2300,""y"":60,""config"":{""expression"":""steps.recon.discrepancies == \""Yes\"""",""trueStepId"":""investigate"",""falseStepId"":""file""}},
{""id"":""investigate"",""type"":""task"",""name"":""Investigate discrepancy"",""x"":2300,""y"":260,""nextStepId"":""file"",""config"":{""title"":""Investigate account discrepancy"",""description"":""Colene: trace the difference (short payment, unallocated receipt, duplicate or missing invoice), correct the account and tell the customer. Escalate to the Finance manager if it cannot be cleared."",""assignTo"":{""departmentName"":""Finance Department""},""escalateTo"":{""departmentName"":""Finance Department"",""role"":""Manager""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""cause"",""label"":""Cause and fix"",""type"":""text"",""required"":true}]}},
{""id"":""file"",""type"":""task"",""name"":""File & update records"",""x"":2620,""y"":60,""nextStepId"":""end"",""config"":{""title"":""File invoices, credit notes and PODs"",""description"":""Colene: file the day''s invoices, credit notes and PODs, update customer account records so everything is audit-ready and easy to find."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":1,""priority"":""Normal"",""form"":[{""key"":""carryOver"",""label"":""Carried over to tomorrow"",""type"":""text"",""required"":false}]}},
{""id"":""end"",""type"":""end"",""name"":""Day closed"",""x"":2940,""y"":60,""config"":{""outcome"":""closed""}}
]}',
        N'[{""key"":""day"",""label"":""Day"",""type"":""text"",""required"":true},{""key"":""focus"",""label"":""Focus accounts (optional)"",""type"":""text"",""required"":false}]',
        1, 0, 1,
        N'module:finance',
        N'{
 ""email"": ""accounts1@promedtechnologies.co.za"",
 ""company"": ""Promed Technologies"",
 ""purpose"": ""Keep Promed Technologies'' customer accounts accurate and paid on time: every invoice goes out correctly with its POD, overdue balances are chased, and accounts reconcile with no unexplained differences."",
 ""reportsTo"": ""Finance Manager"",
 ""team"": ""Debtors & Collections (Finance)"",
 ""functionalArea"": ""Debtors & Collections"",
 ""positionLevel"": ""Debtors Clerk"",
 ""responsibilities"": [
  {""area"": ""Debtors & customer account management"", ""items"": [""Follow up on outstanding balances and overdue customer accounts"", ""Monitor accounts so payments are received within agreed terms"", ""Make follow-up calls to customers regarding outstanding payments"", ""Send invoices and payment requests to customers"", ""Resolve customer account and payment-related queries"", ""Reconcile customer accounts and investigate discrepancies""]},
  {""area"": ""Invoice & payment processing"", ""items"": [""Prepare and send invoices to customers"", ""Upload invoices onto customer platforms / systems for payment processing"", ""Assist with credit notes and customer reinvoicing"", ""Ensure invoices are accurately processed and submitted""]},
  {""area"": ""Proof of Delivery (POD) management"", ""items"": [""Verify every customer invoice has its POD documentation"", ""Follow up on missing PODs"", ""File and maintain POD documentation for record-keeping"", ""Keep supporting delivery documents available for invoice verification and payment""]},
  {""area"": ""Account reconciliation & administration"", ""items"": [""Reconcile customer accounts and identify outstanding balances or discrepancies"", ""Help resolve account-related issues and payment queries"", ""Maintain accurate customer account records"", ""Keep invoices, credit notes and supporting documents organised and filed""]}
 ],
 ""kpis"": [
  {""name"": ""Debtors days (DSO) \u2014 Promed"", ""target"": ""Within agreed customer terms"", ""source"": ""Age analysis / Finance"" },
  {""name"": ""Overdue balance > 60 days"", ""target"": ""Trending down month on month"", ""source"": ""Age analysis"" },
  {""name"": ""Invoices with POD on file"", ""target"": ""100% within 48h of delivery"", ""source"": ""POD documents / Finance uploader"" },
  {""name"": ""Invoices uploaded to customer platforms"", ""target"": ""Same day as invoice date"", ""source"": ""Customer portals"" },
  {""name"": ""Account queries resolved"", ""target"": ""Within 2 working days"", ""source"": ""Query log / flow tasks"" },
  {""name"": ""Unreconciled items at month end"", ""target"": ""Zero unexplained differences"", ""source"": ""Reconciliations"" }
 ],
 ""systems"": [""Sage (debtors, invoices, credit notes)"", ""Intranet Finance (POD uploader, credit-note book)"", ""Customer invoice platforms / portals"", ""Email & phone"", ""Age analysis""],
 ""inputs"": [""Delivered orders & PODs from Logistics"", ""Remittance advices and payments from customers"", ""Price / order confirmations from Sales"", ""Customer queries""],
 ""outputs"": [""Customer invoices and statements"", ""Platform uploads"", ""Credit notes / reinvoices"", ""Reconciled customer accounts"", ""Filed POD and invoice records""],
 ""painPoints"": [
  {""issue"": ""Chasing PODs after the fact"", ""idea"": ""Auto-flag invoices without a POD after 48h and ping the delivering driver from the Finance POD widget.""},
  {""issue"": ""Manual uploads to several customer platforms"", ""idea"": ""Keep a per-customer checklist of which platform each invoice must go to; later automate via portal integrations.""},
  {""issue"": ""Collections priorities set by hand each morning"", ""idea"": ""Welly ranks the overdue list by amount, days overdue and payment history so the day starts with the top accounts.""},
  {""issue"": ""Discrepancies found late at month end"", ""idea"": ""Daily mini-reconciliation step in the flow so differences surface the same day.""}
 ],
 ""handover"": ""If Colene is away: the Promed age analysis is reviewed every morning; overdue accounts are chased by phone then email with promises logged; invoices must be uploaded to customer platforms the same day; no invoice is considered complete without its POD on file; reconcile accounts worked that day and escalate unexplained differences to the Finance Manager. Credit notes / reinvoices are raised only against a logged customer query."",
 ""reviewedAt"": ""2026-10-30""
}',
        SYSUTCDATETIME());
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM [FlowDefinitions] WHERE [OwnerEmployeeId] = N'71' AND [Name] = N'Colene · Debtors day (Promed)';");
        }
    }
}
