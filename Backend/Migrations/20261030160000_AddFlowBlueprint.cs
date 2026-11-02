using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Human flows carry an operational blueprint: what the department / person is responsible for, the KPIs that
    /// show it is working, the systems they touch, their pain points and handover notes. Seeds Peggy Gwala's blueprint
    /// (emp 63, accounts6@accessmedical.co.za); Program.cs links the user account on boot.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261030160000_AddFlowBlueprint")]
    public partial class AddFlowBlueprint : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Separate batches: the UPDATE must compile after the column exists.
            migrationBuilder.Sql(@"IF COL_LENGTH('FlowDefinitions','BlueprintJson') IS NULL ALTER TABLE [FlowDefinitions] ADD [BlueprintJson] nvarchar(max) NULL;");

            migrationBuilder.Sql(@"
UPDATE [FlowDefinitions] SET [BlueprintJson] = N'{
 ""email"": ""accounts6@accessmedical.co.za"",
 ""purpose"": ""Keep Access Medical''s debtors book healthy: money comes in on time, every invoice and credit note is correct and recorded, and the debtors team knows what to do each day."",
 ""reportsTo"": ""Finance Manager"",
 ""team"": ""Debtors team (supervises)"",
 ""responsibilities"": [
  {""area"": ""Debtors team supervision"", ""items"": [""Supervise and coordinate the debtors team so daily tasks are completed"", ""Guide, support and assist team members"", ""Monitor performance against targets, objectives and deadlines"", ""Keep the debtors department running smoothly every day""]},
  {""area"": ""Customer accounts & collections"", ""items"": [""Daily follow-up calls on outstanding payments"", ""Send payment request emails and chase overdue accounts"", ""Monitor accounts so payments land within terms"", ""Resolve payment-related queries and keep customers informed on balances and arrangements""]},
  {""area"": ""Financial documents"", ""items"": [""Prepare and process customer invoices and credit notes"", ""Receive and process remittance advices"", ""Maintain remittance records and related documentation"", ""Make sure every document is accurate, processed and recorded""]},
  {""area"": ""Records & administration"", ""items"": [""Keep debtors records accurate and current"", ""File and organise all financial documents"", ""Complete and maintain the POD (proof of delivery) book"", ""Record every credit note in the credit notes book daily"", ""Keep documentation audit-ready""]},
  {""area"": ""Departmental support"", ""items"": [""Support and guide team members in their daily duties"", ""Help resolve operational and account challenges"", ""Ensure workflows are followed and daily responsibilities finish on time"", ""Promote accuracy, accountability and efficiency""]}
 ],
 ""kpis"": [
  {""name"": ""Debtors days (DSO)"", ""target"": ""\u2264 45 days"", ""source"": ""Age analysis""},
  {""name"": ""Overdue > 60 days"", ""target"": ""< 10% of book"", ""source"": ""Age analysis""},
  {""name"": ""Collections calls / emails per day"", ""target"": ""All overdue accounts touched"", ""source"": ""Debtors day flow \u00b7 Collections step""},
  {""name"": ""Credit notes recorded same day"", ""target"": ""100%"", ""source"": ""Debtors day flow \u00b7 Credit notes book step""},
  {""name"": ""Invoices without POD"", ""target"": ""0 older than 48h"", ""source"": ""Finance \u00b7 PODs""},
  {""name"": ""Team deadlines met"", ""target"": ""\u2265 95% of days"", ""source"": ""Debtors day flow \u00b7 End-of-day check""}
 ],
 ""systems"": [""Sage 300 (debtors, invoices, credit notes)"", ""Intranet \u00b7 Finance \u00b7 PODs"", ""Intranet \u00b7 Books"", ""Email & phone"", ""POD book"", ""Credit notes book""],
 ""inputs"": [""Customer invoices from Sales"", ""Signed PODs from Logistics"", ""Remittance advices from customers"", ""Bank statement / allocations""],
 ""outputs"": [""Payments allocated"", ""Credit notes issued and recorded"", ""Statements and payment requests sent"", ""Up-to-date age analysis""],
 ""painPoints"": [
  {""issue"": ""PODs arrive late or not at all, so invoices cannot be sent or disputes cannot be answered"", ""idea"": ""Flow: auto-task Logistics when a delivered load has no POD after 24h; Home widget: invoices without POD""},
  {""issue"": ""Manual POD book and credit notes book are double capture"", ""idea"": ""Generate both registers from Finance \u00b7 PODs and Books; print on demand""},
  {""issue"": ""Chasing payments depends on memory of who promised what"", ""idea"": ""Promise-to-pay tracker: collections step records the date; flow reminds on the day and escalates if missed""},
  {""issue"": ""Remittances come in by email in many formats"", ""idea"": ""Welly reads remittance PDFs and proposes allocations for approval""}
 ],
 ""handover"": ""If Peggy is away: a team member runs the Debtors day flow; the Finance Manager approves credit notes and handles disputes. Keys to the role: the age analysis review, the customer relationships on the top 20 accounts, and the daily discipline of the two books."",
 ""reviewedAt"": ""2026-10-30""
}'
WHERE [OwnerEmployeeId] = N'63' AND [Name] = N'Peggy · Debtors day' AND [BlueprintJson] IS NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"IF COL_LENGTH('FlowDefinitions','BlueprintJson') IS NOT NULL ALTER TABLE [FlowDefinitions] DROP COLUMN [BlueprintJson];");
        }
    }
}
