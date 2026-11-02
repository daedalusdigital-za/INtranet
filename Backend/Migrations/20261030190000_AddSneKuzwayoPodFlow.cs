using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Human flow + role blueprint for Sinenhlanhla "Sne" Kuzwayo, POD Clerk &amp; Debtors Clerk across Promed Technologies,
    /// Access Medical and Sebenzani Trading. Her login already exists (pods2@promedtechnologies.co.za — the brief said
    /// "prods2", a typo); HR and the register had no record, so both get employee 102 unless HR already knows her.
    /// Program.cs links flow ↔ employee ↔ existing user on boot.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261030190000_AddSneKuzwayoPodFlow")]
    public partial class AddSneKuzwayoPodFlow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @emp nvarchar(20) = (SELECT TOP 1 EmployeeNumber FROM [HrEmployees] WHERE FirstName = N'Sinenhlanhla' AND LastName = N'Kuzwayo' AND EmployeeNumber IS NOT NULL);
IF @emp IS NULL SET @emp = (SELECT TOP 1 empid FROM [empregistration] WHERE [Name] = N'Sinenhlanhla' AND [LastName] = N'Kuzwayo');
IF @emp IS NULL SET @emp = N'102';
IF NOT EXISTS (SELECT 1 FROM [empregistration] WHERE [empid] = @emp)
    INSERT INTO [empregistration] ([empid],[Name],[LastName],[Department],[JobTitle],[Date])
    VALUES (@emp, N'Sinenhlanhla', N'Kuzwayo', N'Finance Department', N'POD Clerk & Debtors Clerk', SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM [HrEmployees] WHERE FirstName = N'Sinenhlanhla' AND LastName = N'Kuzwayo')
    INSERT INTO [HrEmployees] (FirstName,LastName,EmployeeNumber,Site,Department,JobTitle,EmploymentType,Status,Email,Notes,Source,CreatedAt,CreatedByName)
    VALUES (N'Sinenhlanhla', N'Kuzwayo', @emp, N'Main Office', N'Finance', N'POD Clerk & Debtors Clerk', N'Permanent', N'Active', N'pods2@promedtechnologies.co.za', N'Company: Promed Technologies, Access Medical & Sebenzani Trading | Debtors & POD Administration (KZN & Eastern Cape PODs)', N'Manual', SYSUTCDATETIME(), N'System');");

            // Sne's daily cycle: collect KZN/EC PODs → scan & upload → verify/sign off (incomplete → chase) → match to
            // invoices (missing → query to Sales → follow up) → collections across DCS/Promed/Access → queries & POD
            // retrieval requests → credit notes (if any → record) → file → close.
            migrationBuilder.Sql(@"
DECLARE @emp nvarchar(20) = (SELECT TOP 1 empid FROM [empregistration] WHERE [Name] = N'Sinenhlanhla' AND [LastName] = N'Kuzwayo');
IF @emp IS NULL SET @emp = N'102';
IF NOT EXISTS (SELECT 1 FROM [FlowDefinitions] WHERE [OwnerName] = N'Sinenhlanhla Kuzwayo' AND [IsTemplate] = 0)
BEGIN
    INSERT INTO [FlowDefinitions] ([Name],[Description],[Category],[DepartmentName],[OwnerEmployeeId],[OwnerName],[OwnerTitle],[Level],[TriggerType],[TriggerJson],[GraphJson],[InputsJson],[IsEnabled],[IsTemplate],[Version],[StartPermissions],[BlueprintJson],[CreatedAt])
    VALUES (
        N'Sne · PODs & debtors day',
        N'How Sne runs the POD desk and her debtors book each day across Promed, Access Medical and Sebenzani: capture, scan and upload the KZN and Eastern Cape PODs, verify and sign them off, match them to invoices and raise anything missing with Sales, chase overdue customers for DCS / Promed / Access, answer POD and account queries from customers and colleagues, process credit notes, and file so every document is findable.',
        N'Operations',
        N'Finance Department',
        @emp,
        N'Sinenhlanhla Kuzwayo',
        N'POD Clerk & Debtors Clerk',
        1,
        N'manual',
        N'{""titleTemplate"":""PODs & debtors · {{inputs.day}}""}',
        N'{""startStepId"":""collect"",""steps"":[
{""id"":""collect"",""type"":""task"",""name"":""Collect PODs (KZN & EC)"",""x"":60,""y"":60,""nextStepId"":""upload"",""config"":{""title"":""Collect the day''s PODs · {{inputs.day}}"",""description"":""Sne: gather the signed PODs returned by KwaZulu-Natal and Eastern Cape drivers and check the batch is complete against the delivery list."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":1,""priority"":""Normal"",""form"":[{""key"":""pods"",""label"":""PODs received"",""type"":""number"",""required"":true}]}},
{""id"":""upload"",""type"":""task"",""name"":""Scan & upload"",""x"":380,""y"":60,""nextStepId"":""verify"",""config"":{""title"":""Scan and upload {{steps.collect.pods}} POD(s) to the intranet"",""description"":""Sne: scan each POD and upload it through the Finance POD uploader so it is attached to the right invoice and company."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""uploaded"",""label"":""Uploaded"",""type"":""number"",""required"":true}]}},
{""id"":""verify"",""type"":""task"",""name"":""Verify & sign off"",""x"":700,""y"":60,""nextStepId"":""incomplete"",""config"":{""title"":""Verify and sign off captured PODs"",""description"":""Sne: review every captured POD for customer signature, date, quantities and invoice reference; sign off the complete ones."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""incompletePods"",""label"":""Incomplete / unreadable PODs"",""type"":""number"",""required"":true}]}},
{""id"":""incomplete"",""type"":""condition"",""name"":""Incomplete?"",""x"":1020,""y"":60,""config"":{""expression"":""steps.verify.incompletePods > 0"",""trueStepId"":""chase"",""falseStepId"":""match""}},
{""id"":""chase"",""type"":""task"",""name"":""Chase incomplete PODs"",""x"":1020,""y"":260,""nextStepId"":""match"",""config"":{""title"":""Chase {{steps.verify.incompletePods}} incomplete POD(s)"",""description"":""Sne: go back to the driver / Logistics for a signed, legible copy and re-upload once received."",""assignTo"":{""departmentName"":""Finance Department""},""escalateTo"":{""departmentName"":""Logistics""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""fixed"",""label"":""Corrected PODs received"",""type"":""number"",""required"":true}]}},
{""id"":""match"",""type"":""task"",""name"":""Match invoices to PODs"",""x"":1340,""y"":60,""nextStepId"":""missing"",""config"":{""title"":""Match invoices to PODs"",""description"":""Sne: check that every invoice delivered in KZN / EC now has a POD on the intranet and list the invoices still without one."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""missingPods"",""label"":""Invoices without a POD"",""type"":""number"",""required"":true}]}},
{""id"":""missing"",""type"":""condition"",""name"":""Missing PODs?"",""x"":1660,""y"":60,""config"":{""expression"":""steps.match.missingPods > 0"",""trueStepId"":""salesQuery"",""falseStepId"":""collections""}},
{""id"":""salesQuery"",""type"":""task"",""name"":""Query to Sales"",""x"":1660,""y"":260,""nextStepId"":""salesFollow"",""config"":{""title"":""Investigate {{steps.match.missingPods}} invoice(s) without POD"",""description"":""Sales: confirm whether the goods were delivered, collected or still open, and return the delivery detail so Finance can obtain the POD."",""assignTo"":{""departmentName"":""Sales""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""finding"",""label"":""Finding"",""type"":""select"",""required"":true,""options"":[""Delivered - POD to follow"",""Collected by customer"",""Not yet delivered"",""Invoice to be credited""]}]}},
{""id"":""salesFollow"",""type"":""task"",""name"":""Follow up Sales"",""x"":1980,""y"":260,""nextStepId"":""collections"",""config"":{""title"":""Follow up: {{steps.salesQuery.finding}}"",""description"":""Sne: act on Sales'' answer — obtain the POD, note the collection, or hand over for a credit note — and close the query."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":24,""priority"":""Normal"",""form"":[]}},
{""id"":""collections"",""type"":""task"",""name"":""Collections (DCS / Promed / Access)"",""x"":2300,""y"":60,""nextStepId"":""queries"",""config"":{""title"":""Chase overdue accounts"",""description"":""Sne: phone and email customers on outstanding balances for DCS, Promed Technologies and Access Medical; log promises to pay and any payment issues."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":3,""priority"":""High"",""form"":[{""key"":""contacted"",""label"":""Customers contacted"",""type"":""number"",""required"":true},{""key"":""promises"",""label"":""Promises to pay"",""type"":""number"",""required"":false}]}},
{""id"":""queries"",""type"":""task"",""name"":""Queries & POD requests"",""x"":2620,""y"":60,""nextStepId"":""credits"",""config"":{""title"":""Resolve customer & internal queries"",""description"":""Sne: investigate account / invoice queries from customers and POD retrieval requests from colleagues; send the documents or route the query to Sales, and follow up until closed."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""Normal"",""form"":[{""key"":""queries"",""label"":""Queries handled"",""type"":""number"",""required"":true},{""key"":""creditNotes"",""label"":""Credit notes needed"",""type"":""number"",""required"":true}]}},
{""id"":""credits"",""type"":""condition"",""name"":""Credit notes?"",""x"":2940,""y"":60,""config"":{""expression"":""steps.queries.creditNotes > 0"",""trueStepId"":""cn"",""falseStepId"":""file""}},
{""id"":""cn"",""type"":""task"",""name"":""Process credit notes"",""x"":2940,""y"":260,""nextStepId"":""file"",""config"":{""title"":""Prepare & record {{steps.queries.creditNotes}} credit note(s)"",""description"":""Sne: prepare the credit notes, attach supporting documents and record them in the credit-note book."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":4,""priority"":""Normal"",""form"":[]}},
{""id"":""file"",""type"":""task"",""name"":""File & close"",""x"":3260,""y"":60,""nextStepId"":""end"",""config"":{""title"":""File PODs, credit notes and records"",""description"":""Sne: file the day''s PODs and credit notes by company and date so they are easy to retrieve for verification and audit."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":1,""priority"":""Normal"",""form"":[{""key"":""carryOver"",""label"":""Carried over to tomorrow"",""type"":""text"",""required"":false}]}},
{""id"":""end"",""type"":""end"",""name"":""Day closed"",""x"":3580,""y"":60,""config"":{""outcome"":""closed""}}
]}',
        N'[{""key"":""day"",""label"":""Day"",""type"":""text"",""required"":true},{""key"":""region"",""label"":""Region focus (optional)"",""type"":""select"",""required"":false,""options"":[""KZN"",""Eastern Cape"",""Both""]}]',
        1, 0, 1,
        N'module:finance',
        N'{
 ""email"": ""pods2@promedtechnologies.co.za"",
 ""company"": ""Promed Technologies, Access Medical & Sebenzani Trading"",
 ""purpose"": ""Make sure every KZN and Eastern Cape delivery is backed by a verified POD on the intranet, help the business find any POD on request, and keep the DCS / Promed / Access debtors books moving through collections, queries and credit notes."",
 ""reportsTo"": ""Finance Manager"",
 ""team"": ""Debtors & POD Administration (Finance) \u2014 works with Logistics drivers and Sales"",
 ""functionalArea"": ""Debtors & POD Administration"",
 ""positionLevel"": ""POD Clerk & Debtors Clerk"",
 ""responsibilities"": [
  {""area"": ""Proof of Delivery (POD) management"", ""items"": [""Capture and process POD documents"", ""Check, verify and manage PODs for KwaZulu-Natal and Eastern Cape deliveries"", ""Scan and upload PODs onto the company intranet"", ""Review and sign off all captured PODs for accuracy and completeness"", ""Keep POD documentation recorded, stored and accessible"", ""Help employees and departments locate and retrieve PODs"", ""Identify missing or incomplete PODs and follow up until obtained""]},
  {""area"": ""Debtors & payment collections"", ""items"": [""Follow up on outstanding balances and overdue accounts"", ""Assist with debt collection for DCS, Promed Technologies and Access Medical"", ""Contact customers on outstanding payments"", ""Send and respond to customer emails on balances and payments"", ""Monitor accounts and help resolve payment issues""]},
  {""area"": ""Customer queries & internal coordination"", ""items"": [""Receive, investigate and resolve customer and internal queries"", ""Submit invoice and POD queries to Sales for investigation"", ""Communicate with customers and departments to obtain outstanding information"", ""Assist departments with POD enquiries and documentation requests"", ""Follow up unresolved queries until addressed""]},
  {""area"": ""Credit notes & financial administration"", ""items"": [""Prepare and process credit notes where required"", ""Assist with debtor-related administrative and financial documentation"", ""Record credit notes and supporting documents properly"", ""Maintain accurate records of processed documentation""]},
  {""area"": ""Document management & filing"", ""items"": [""Scan, upload and file POD documents"", ""Maintain an organised filing system for PODs, credit notes and related documents"", ""Keep documents accessible for verification, auditing and departmental reference"", ""Support employees and departments in retrieving POD documentation""]}
 ],
 ""kpis"": [
  {""name"": ""PODs uploaded within 24h of return (KZN & EC)"", ""target"": ""100%"", ""source"": ""Finance POD uploader"" },
  {""name"": ""Invoices with verified POD"", ""target"": ""100% within 48h of delivery"", ""source"": ""POD summary / Finance"" },
  {""name"": ""Incomplete PODs corrected"", ""target"": ""Within 2 working days"", ""source"": ""Flow tasks"" },
  {""name"": ""POD retrieval requests answered"", ""target"": ""Same day"", ""source"": ""Query log / messages"" },
  {""name"": ""Sales POD queries closed"", ""target"": ""Within 3 working days"", ""source"": ""Flow tasks (Sales step)"" },
  {""name"": ""Overdue balance chased (DCS / Promed / Access)"", ""target"": ""Every overdue account contacted weekly"", ""source"": ""Age analysis / call log"" },
  {""name"": ""Credit notes recorded same day"", ""target"": ""100%"", ""source"": ""Credit-note book"" }
 ],
 ""systems"": [""Intranet Finance (POD uploader, POD summary, credit-note book)"", ""Scanner"", ""Sage (debtors, credit notes)"", ""Age analysis"", ""Email & phone""],
 ""inputs"": [""Signed PODs from KZN / Eastern Cape drivers"", ""Delivery lists from Logistics"", ""Invoices from Sales"", ""Customer and internal queries / POD requests"", ""Remittances and payment promises""],
 ""outputs"": [""Verified, signed-off PODs on the intranet"", ""POD / invoice match list and missing-POD queries to Sales"", ""Collections contact log"", ""Resolved queries and retrieved documents"", ""Recorded credit notes"", ""Organised POD / credit-note filing""],
 ""painPoints"": [
  {""issue"": ""PODs arrive late or unsigned from the regions"", ""idea"": ""Driver app / WhatsApp photo capture at delivery feeding straight into the POD uploader; auto-flag unsigned uploads.""},
  {""issue"": ""Colleagues ask Sne to find PODs by hand"", ""idea"": ""Self-service POD search in the intranet (by invoice / customer / date) so retrieval requests fall away.""},
  {""issue"": ""Missing-POD queries to Sales go quiet"", ""idea"": ""The Sales step in this flow is a tracked task with a 24h due date and escalation.""},
  {""issue"": ""Collections split across three companies"", ""idea"": ""One combined overdue list (DCS / Promed / Access) ranked by amount and days overdue, refreshed daily by Welly.""}
 ],
 ""handover"": ""If Sne is away: collect, scan and upload the KZN and Eastern Cape PODs every day and sign off only complete, signed copies; match PODs to invoices and send anything missing to Sales as a tracked query; chase overdue customers for DCS, Promed and Access and log every promise; answer POD retrieval requests the same day; record any credit note in the book with its supporting documents; file by company and date. Escalate unsigned or disputed deliveries to Logistics and unresolved account issues to the Finance Manager."",
 ""reviewedAt"": ""2026-10-30""
}',
        SYSUTCDATETIME());
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE FROM [FlowDefinitions] WHERE [OwnerName] = N'Sinenhlanhla Kuzwayo' AND [Name] = N'Sne · PODs & debtors day';
DELETE FROM [HrEmployees] WHERE FirstName = N'Sinenhlanhla' AND LastName = N'Kuzwayo' AND Source = N'Manual' AND CreatedByName = N'System';
DELETE FROM [empregistration] WHERE [empid] = N'102' AND [Name] = N'Sinenhlanhla' AND [LastName] = N'Kuzwayo';");
        }
    }
}
