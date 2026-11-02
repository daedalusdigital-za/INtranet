using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Human flows can belong to a specific employee (not just a department), keyed to the employee register so
    /// staff who never sign in can still have their "how I work" flow. Seeds the first one: Peggy Gwala (emp 63),
    /// Debtors Clerk &amp; Team Supervisor in Finance.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261030150000_AddFlowOwnerEmployee")]
    public partial class AddFlowOwnerEmployee : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF COL_LENGTH('FlowDefinitions','OwnerEmployeeId') IS NULL ALTER TABLE [FlowDefinitions] ADD [OwnerEmployeeId] nvarchar(20) NULL;
IF COL_LENGTH('FlowDefinitions','OwnerName') IS NULL ALTER TABLE [FlowDefinitions] ADD [OwnerName] nvarchar(150) NULL;
IF COL_LENGTH('FlowDefinitions','OwnerTitle') IS NULL ALTER TABLE [FlowDefinitions] ADD [OwnerTitle] nvarchar(200) NULL;
IF COL_LENGTH('FlowDefinitions','OwnerUserId') IS NULL ALTER TABLE [FlowDefinitions] ADD [OwnerUserId] int NULL;
");

            // Peggy's daily debtors cycle. Written as a run-per-day flow: briefing → age analysis → collections →
            // documents → books → end-of-day check, with side branches for team issues, disputes and missed targets.
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM [FlowDefinitions] WHERE [OwnerEmployeeId] = N'63' AND [IsTemplate] = 0)
BEGIN
    INSERT INTO [FlowDefinitions] ([Name],[Description],[Category],[DepartmentName],[OwnerEmployeeId],[OwnerName],[OwnerTitle],[Level],[TriggerType],[TriggerJson],[GraphJson],[InputsJson],[IsEnabled],[IsTemplate],[Version],[StartPermissions],[CreatedAt])
    VALUES (
        N'Peggy · Debtors day',
        N'How Peggy runs the debtors desk each day: brief and steer the team, review the age analysis, chase payments by phone and email, process remittances, invoices and credit notes, keep the POD and credit-note books current, then check the day''s targets and deadlines before closing.',
        N'Operations',
        N'Finance Department',
        N'63',
        N'Peggy Gwala',
        N'Debtors Clerk & Team Supervisor',
        1,
        N'manual',
        N'{""titleTemplate"":""Debtors day · {{inputs.day}}""}',
        N'{""startStepId"":""brief"",""steps"":[
{""id"":""brief"",""type"":""task"",""name"":""Team briefing"",""x"":60,""y"":60,""nextStepId"":""teamok"",""config"":{""title"":""Debtors team briefing · {{inputs.day}}"",""description"":""Peggy: allocate the day''s accounts and follow-ups to the team, confirm deadlines and who is covering what."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":1,""priority"":""Normal"",""form"":[{""key"":""teamIssues"",""label"":""Any team or operational issues?"",""type"":""select"",""required"":true,""options"":[""No"",""Yes""]}]}},
{""id"":""teamok"",""type"":""condition"",""name"":""Issues?"",""x"":380,""y"":60,""config"":{""expression"":""steps.brief.teamIssues == \""Yes\"""",""trueStepId"":""resolve"",""falseStepId"":""age""}},
{""id"":""resolve"",""type"":""task"",""name"":""Resolve team issue"",""x"":380,""y"":260,""nextStepId"":""age"",""config"":{""title"":""Resolve team / operational issue"",""description"":""Peggy: guide and support the team member, re-allocate work if needed. Escalate to the Finance manager if it cannot be resolved today."",""assignTo"":{""departmentName"":""Finance Department""},""escalateTo"":{""departmentName"":""Finance Department"",""role"":""Manager""},""dueInHours"":4,""priority"":""High"",""form"":[{""key"":""resolution"",""label"":""What was done"",""type"":""text"",""required"":true}]}},
{""id"":""age"",""type"":""task"",""name"":""Review age analysis"",""x"":700,""y"":60,""nextStepId"":""collect"",""config"":{""title"":""Review debtors age analysis"",""description"":""Peggy: check 30/60/90-day balances, pick the accounts to chase today and monitor that payments are landing within terms."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""overdueAccounts"",""label"":""Overdue accounts to chase"",""type"":""number"",""required"":true}]}},
{""id"":""collect"",""type"":""task"",""name"":""Collections calls & emails"",""x"":1020,""y"":60,""nextStepId"":""dispute"",""config"":{""title"":""Collections: {{steps.age.overdueAccounts}} accounts"",""description"":""Team: daily follow-up calls, payment request emails and follow-ups on overdue accounts. Log promises to pay and any disputes."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":5,""priority"":""High"",""form"":[{""key"":""promises"",""label"":""Promises to pay"",""type"":""number"",""required"":true},{""key"":""disputes"",""label"":""Any payment queries / disputes?"",""type"":""select"",""required"":true,""options"":[""No"",""Yes""]}]}},
{""id"":""dispute"",""type"":""condition"",""name"":""Disputes?"",""x"":1340,""y"":60,""config"":{""expression"":""steps.collect.disputes == \""Yes\"""",""trueStepId"":""query"",""falseStepId"":""docs""}},
{""id"":""query"",""type"":""task"",""name"":""Resolve payment query"",""x"":1340,""y"":260,""nextStepId"":""docs"",""config"":{""title"":""Resolve customer payment query"",""description"":""Peggy: resolve the balance / payment-arrangement query with the customer and agree next steps. Keep the customer informed."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""outcome"",""label"":""Outcome"",""type"":""select"",""required"":true,""options"":[""Resolved"",""Payment arrangement"",""Credit note needed"",""Escalated""]}]}},
{""id"":""docs"",""type"":""task"",""name"":""Process documents"",""x"":1660,""y"":60,""nextStepId"":""cns"",""config"":{""title"":""Invoices, credit notes & remittances"",""description"":""Team: prepare and process customer invoices and credit notes, capture remittance advices received, and record everything accurately."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""Normal"",""form"":[{""key"":""creditNotes"",""label"":""Credit notes issued today"",""type"":""number"",""required"":true},{""key"":""remittances"",""label"":""Remittances processed"",""type"":""number"",""required"":false}]}},
{""id"":""cns"",""type"":""condition"",""name"":""Credit notes?"",""x"":1980,""y"":60,""config"":{""expression"":""steps.docs.creditNotes > 0"",""trueStepId"":""cnbook"",""falseStepId"":""podbook""}},
{""id"":""cnbook"",""type"":""task"",""name"":""Credit notes book"",""x"":1980,""y"":260,""nextStepId"":""podbook"",""config"":{""title"":""Record {{steps.docs.creditNotes}} credit note(s) in the book"",""description"":""Peggy: every credit note issued today goes into the credit notes book the same day."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[]}},
{""id"":""podbook"",""type"":""task"",""name"":""POD book & filing"",""x"":2300,""y"":60,""nextStepId"":""eod"",""config"":{""title"":""Complete POD book and file documents"",""description"":""Team: update the Proof of Delivery book, file all financial documents and make sure records are complete and audit-ready."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[]}},
{""id"":""eod"",""type"":""task"",""name"":""End-of-day check"",""x"":2620,""y"":60,""nextStepId"":""met"",""config"":{""title"":""End of day: targets and deadlines"",""description"":""Peggy: confirm the team met today''s targets and deadlines, and note anything carried over."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":1,""priority"":""Normal"",""form"":[{""key"":""targetsMet"",""label"":""Targets and deadlines met?"",""type"":""select"",""required"":true,""options"":[""Yes"",""No""]},{""key"":""carryOver"",""label"":""Carried over to tomorrow"",""type"":""text"",""required"":false}]}},
{""id"":""met"",""type"":""condition"",""name"":""Met?"",""x"":2940,""y"":60,""config"":{""expression"":""steps.eod.targetsMet == \""Yes\"""",""trueStepId"":""end_ok"",""falseStepId"":""tellmgr""}},
{""id"":""tellmgr"",""type"":""notify"",""name"":""Tell Finance manager"",""x"":2940,""y"":260,""nextStepId"":""end_miss"",""config"":{""to"":{""departmentName"":""Finance Department"",""role"":""Manager""},""title"":""Debtors targets missed · {{inputs.day}}"",""body"":""Carried over: {{steps.eod.carryOver}}""}},
{""id"":""end_ok"",""type"":""end"",""name"":""Day closed"",""x"":3260,""y"":60,""config"":{""outcome"":""closed""}},
{""id"":""end_miss"",""type"":""end"",""name"":""Closed with carry-over"",""x"":3260,""y"":260,""config"":{""outcome"":""carry-over""}}
]}',
        N'[{""key"":""day"",""label"":""Day"",""type"":""text"",""required"":true},{""key"":""focus"",""label"":""Focus accounts (optional)"",""type"":""text"",""required"":false}]',
        1, 0, 1,
        N'module:finance',
        SYSUTCDATETIME());
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM [FlowDefinitions] WHERE [OwnerEmployeeId] = N'63' AND [Name] = N'Peggy · Debtors day';
IF COL_LENGTH('FlowDefinitions','OwnerUserId') IS NOT NULL ALTER TABLE [FlowDefinitions] DROP COLUMN [OwnerUserId];
IF COL_LENGTH('FlowDefinitions','OwnerTitle') IS NOT NULL ALTER TABLE [FlowDefinitions] DROP COLUMN [OwnerTitle];
IF COL_LENGTH('FlowDefinitions','OwnerName') IS NOT NULL ALTER TABLE [FlowDefinitions] DROP COLUMN [OwnerName];
IF COL_LENGTH('FlowDefinitions','OwnerEmployeeId') IS NOT NULL ALTER TABLE [FlowDefinitions] DROP COLUMN [OwnerEmployeeId];");
        }
    }
}
