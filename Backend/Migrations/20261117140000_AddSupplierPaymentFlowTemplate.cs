using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Flows: the supplier-payment process now runs inside the intranet —
    /// Finance › Payment packs (prepare, checks) → Executive › Directors (sign) → Payment schedule (Mon/Wed pay-run)
    /// → Executive › Treasury (load, pay, POP, close). Adds a system template for it and points the existing
    /// creditor flows' "Leona processes payments" steps at Treasury / Directors.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261117140000_AddSupplierPaymentFlowTemplate")]
    public partial class AddSupplierPaymentFlowTemplate : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM [FlowDefinitions] WHERE [Name] = N'Supplier payment · pack → sign → pay-run → POP' AND [IsTemplate] = 1)
BEGIN
    INSERT INTO [FlowDefinitions] ([Name],[Description],[Category],[DepartmentName],[OwnerEmployeeId],[OwnerName],[OwnerTitle],[Level],[TriggerType],[TriggerJson],[GraphJson],[InputsJson],[IsEnabled],[IsTemplate],[Version],[StartPermissions],[BlueprintJson],[CreatedAt])
    VALUES (
        N'Supplier payment · pack → sign → pay-run → POP',
        N'How a supplier gets paid on the intranet. The creditors clerk builds a payment pack (Finance › Creditors › Payment packs) — each payment is added from the supplier directory or by uploading / linking the invoice, with its bank details and documents. Submitting runs the system checks. The company accountant approves. A director reviews and signs in Executive › Directors, which books the pack on the next Monday / Wednesday pay-run. Treasury (Executive › Treasury) downloads the bank file, loads and releases it, marks it paid, attaches a proof of payment to every line and closes the batch. Everything stays visible in Payment schedule and History.',
        N'Finance',
        N'Finance Department',
        NULL, N'Intranet', N'System process', 1,
        N'manual',
        N'{""titleTemplate"":""Supplier payment · {{inputs.company}} · {{inputs.batch}}""}',
        N'{""startStepId"":""prepare"",""steps"":[
{""id"":""prepare"",""type"":""task"",""name"":""Prepare payment pack"",""x"":60,""y"":60,""nextStepId"":""checks"",""config"":{""title"":""Prepare pack {{inputs.batch}} for {{inputs.company}}"",""description"":""Creditors clerk · Finance › Creditors › Payment packs. New batch (daily / monthly / prepayment / …). Add each payment: pick the supplier from the directory (bank details come along) or upload / link the tax invoice so who, amount and VAT fill in. Attach the required documents per payment, then Submit."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":8,""priority"":""Normal"",""form"":[{""key"":""payments"",""label"":""Payments on the pack"",""type"":""number"",""required"":true},{""key"":""total"",""label"":""Total (R)"",""type"":""number"",""required"":true}]}},
{""id"":""checks"",""type"":""condition"",""name"":""System checks pass?"",""x"":380,""y"":60,""config"":{""expression"":""steps.prepare.checksPassed != \""No\"""",""trueStepId"":""accountant"",""falseStepId"":""fix""}},
{""id"":""fix"",""type"":""task"",""name"":""Fix & resubmit"",""x"":380,""y"":260,""nextStepId"":""prepare"",""config"":{""title"":""Checks failed on {{inputs.batch}} — fix and resubmit"",""description"":""Creditors clerk: the red items on the pack (missing documents, bank letter older than 3 months, account differs from letter, duplicate invoice, VAT / amount mismatch). Reopen & fix, then submit again."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":24,""priority"":""High""}},
{""id"":""accountant"",""type"":""task"",""name"":""Accountant approves"",""x"":700,""y"":60,""nextStepId"":""accDecision"",""config"":{""title"":""Accountant check · {{inputs.batch}}"",""description"":""Company accountant · Finance › Payment packs. Check the schedule against the recon and supporting documents. Approve (goes to the director) or send back with a note."",""assignTo"":{""departmentName"":""Finance Department"",""role"":""Accountant""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""decision"",""label"":""Decision"",""type"":""select"",""required"":true,""options"":[""Approved"",""Sent back""]}]}},
{""id"":""accDecision"",""type"":""condition"",""name"":""Approved?"",""x"":1020,""y"":60,""config"":{""expression"":""steps.accountant.decision == \""Approved\"""",""trueStepId"":""director"",""falseStepId"":""prepare""}},
{""id"":""director"",""type"":""task"",""name"":""Director signs"",""x"":1340,""y"":60,""nextStepId"":""dirDecision"",""config"":{""title"":""Sign {{inputs.batch}} · {{inputs.company}}"",""description"":""Director · Executive › Directors › Sign payments. Review each line and its invoice; approve, query or reject per payment; sign with your digital signature. Signing locks the pack and books it on the next Monday / Wednesday pay-run."",""assignTo"":{""departmentName"":""Finance Department"",""role"":""Director""},""escalateTo"":{""departmentName"":""Finance Department"",""role"":""Manager""},""dueInHours"":48,""priority"":""High"",""form"":[{""key"":""decision"",""label"":""Outcome"",""type"":""select"",""required"":true,""options"":[""Signed"",""Queried"",""Rejected""]}]}},
{""id"":""dirDecision"",""type"":""condition"",""name"":""Signed?"",""x"":1660,""y"":60,""config"":{""expression"":""steps.director.decision == \""Signed\"""",""trueStepId"":""load"",""falseStepId"":""prepare""}},
{""id"":""load"",""type"":""task"",""name"":""Treasury loads on bank"",""x"":1980,""y"":60,""nextStepId"":""pay"",""config"":{""title"":""Load {{inputs.batch}} on the bank (pay-run {{inputs.payRun}})"",""description"":""Treasury · Executive › Treasury › Pay-runs. Download the bank file (approved lines only), load it on the bank, mark Loaded on bank. Pay-runs are Mondays and Wednesdays; reschedule if it must move."",""assignTo"":{""departmentName"":""Finance Department"",""role"":""Treasury""},""dueInHours"":24,""priority"":""High""}},
{""id"":""pay"",""type"":""task"",""name"":""Release & mark paid"",""x"":2300,""y"":60,""nextStepId"":""pop"",""config"":{""title"":""Release payments and mark {{inputs.batch}} paid"",""description"":""Treasury: once the bank has released the payments, Mark paid on the pay-run."",""assignTo"":{""departmentName"":""Finance Department"",""role"":""Treasury""},""dueInHours"":8,""priority"":""High"",""form"":[{""key"":""paid"",""label"":""Payments released"",""type"":""number"",""required"":true}]}},
{""id"":""pop"",""type"":""task"",""name"":""Attach POPs"",""x"":2620,""y"":60,""nextStepId"":""close"",""config"":{""title"":""Attach proof of payment to {{steps.pay.paid}} line(s)"",""description"":""Treasury · Executive › Treasury. Download each proof of payment from the bank and attach it to its line on the pay-run; also attach POPs to paid supplier invoices under Supplier invoices & POPs so departments see them in Books."",""assignTo"":{""departmentName"":""Finance Department"",""role"":""Treasury""},""dueInHours"":24,""priority"":""Normal""}},
{""id"":""close"",""type"":""task"",""name"":""Close batch"",""x"":2940,""y"":60,""nextStepId"":""end"",""config"":{""title"":""Close {{inputs.batch}}"",""description"":""Treasury / clerk: when every approved line has a POP (and prepayments have their tax invoice + GRV), Close the batch. It moves to History for the auditors."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":8,""priority"":""Normal""}},
{""id"":""end"",""type"":""end"",""name"":""Paid & filed"",""x"":3260,""y"":60,""config"":{""outcome"":""closed""}}
]}',
        N'[{""key"":""company"",""label"":""Paying company"",""type"":""select"",""required"":true,""options"":[""Promed Technologies"",""Access Medical"",""Promed Pharmatech"",""Sebenzani Trading"",""KOD""]},{""key"":""batch"",""label"":""Batch number"",""type"":""text"",""required"":true},{""key"":""payRun"",""label"":""Pay-run (Mon / Wed)"",""type"":""text"",""required"":false}]',
        1, 1, 1,
        N'module:finance',
        N'{
 ""purpose"": ""Every supplier payment is prepared with its documents, checked by the system and the accountant, signed by a director, paid on a Monday / Wednesday pay-run by Treasury and closed with a proof of payment on every line."",
 ""functionalArea"": ""Creditors & Accounts Payable"",
 ""systems"": [""Finance › Creditors › Payment packs"", ""Finance › Creditors › Payment schedule"", ""Executive › Directors"", ""Executive › Treasury"", ""Books (supplier invoices & POPs)"", ""Settings › Payment approvers (companies & people)""],
 ""roles"": [
  {""role"": ""Creditors clerk (cred.clerk)"", ""does"": ""Creates batches, adds payments from the supplier directory or by uploading / linking invoices, attaches documents, submits, closes.""},
  {""role"": ""Company accountant (cred.accountant)"", ""does"": ""Mandatory check per pack; approves or sends back.""},
  {""role"": ""Director (cred.director)"", ""does"": ""Decides each line and signs in Executive › Directors; signing books the pay-run.""},
  {""role"": ""Treasury (cred.bank)"", ""does"": ""Bank file, load, release, mark paid, attach POPs, close — in Executive › Treasury.""}
 ],
 ""kpis"": [
  {""name"": ""Packs signed before the pay-run cut-off (10:00 SAST)"", ""target"": ""100%"", ""source"": ""Payment schedule"" },
  {""name"": ""POP attached within 2 working days of payment"", ""target"": ""100%"", ""source"": ""Treasury › History"" },
  {""name"": ""Packs sent back by checks / accountant / director"", ""target"": ""< 10%"", ""source"": ""Payment packs"" }
 ],
 ""reviewedAt"": ""2026-11-17""
}',
        SYSUTCDATETIME());
END;

-- Existing personal creditor flows: the payment step now happens in Directors / Treasury on the intranet.
UPDATE [FlowDefinitions] SET [GraphJson] = REPLACE([GraphJson],
  N'Leona: review the schedule, process the payments and return the Proofs of Payment to Nduduzo.',
  N'Submit the pack on the intranet (Finance › Payment packs). The accountant approves, a director signs in Executive › Directors, and Treasury loads and pays it on the Monday / Wednesday pay-run (Executive › Treasury), attaching the POPs.')
 WHERE [OwnerName] = N'Nduduzo Ndlovu';
UPDATE [FlowDefinitions] SET [GraphJson] = REPLACE([GraphJson],
  N'Nduduzo: attach each Proof of Payment to its invoice, GRV, delivery note and capture printout; file chronologically by payment date.',
  N'Nduduzo: confirm every line on the pay-run has its POP (Treasury attaches them), close the batch, and attach POPs to the paid supplier invoices in Books so departments can see them.')
 WHERE [OwnerName] = N'Nduduzo Ndlovu';
UPDATE [FlowDefinitions] SET [GraphJson] = REPLACE([GraphJson],
  N'Leona: process the approved payments and return the Proofs of Payment.',
  N'Director signs the pack in Executive › Directors; Treasury loads, releases and marks it paid on the Monday / Wednesday pay-run in Executive › Treasury and attaches the POPs.')
 WHERE [OwnerName] = N'Joulene Mahabeer';
UPDATE [FlowDefinitions] SET [GraphJson] = REPLACE([GraphJson],
  N'Joulene: link each POP to its supplier account, invoice and GRV; file by payment date and update the payment records.',
  N'Joulene: check the pay-run in Treasury › History — every line has a POP; close the batch; POPs are on the supplier invoices in Books.')
 WHERE [OwnerName] = N'Joulene Mahabeer';
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM [FlowDefinitions] WHERE [Name] = N'Supplier payment · pack → sign → pay-run → POP' AND [IsTemplate] = 1;");
        }
    }
}
