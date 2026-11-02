using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Human flow + role blueprint for Mbali Fundisi, POD Clerk (Promed Technologies &amp; Pharmatech, GP &amp; CPT deliveries).
    /// HR and the register already carry her as employee 47 (titled "Creditors Clerk" — corrected to POD Clerk); her login
    /// pods1@promedtechnologies.co.za exists. Nothing new is created except the flow; Program.cs links on boot.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261030200000_AddMbaliFundisiPodFlow")]
    public partial class AddMbaliFundisiPodFlow : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @emp nvarchar(20) = (SELECT TOP 1 EmployeeNumber FROM [HrEmployees] WHERE FirstName = N'Mbali' AND LastName = N'Fundisi' AND EmployeeNumber IS NOT NULL);
IF @emp IS NULL SET @emp = (SELECT TOP 1 empid FROM [empregistration] WHERE [Name] = N'Mbali' AND [LastName] = N'Fundisi');
IF @emp IS NULL SET @emp = N'47';
UPDATE [HrEmployees] SET JobTitle = N'POD Clerk', Email = COALESCE(Email, N'pods1@promedtechnologies.co.za'),
       Notes = COALESCE(Notes, N'Company: Promed Technologies & Pharmatech | POD Administration & Debtors Support (GP & CPT)')
 WHERE FirstName = N'Mbali' AND LastName = N'Fundisi' AND (JobTitle IS NULL OR JobTitle IN (N'Other', N'Creditors Clerk'));
UPDATE [empregistration] SET JobTitle = N'POD Clerk', Department = CASE WHEN Department IN (N'Other', N'Finance') THEN N'Finance Department' ELSE Department END
 WHERE empid = @emp AND (JobTitle IS NULL OR JobTitle IN (N'Other', N'Creditors Clerk'));");

            // Mbali's daily cycle: receive GP/CPT PODs → verify signatures/completeness (issues → chase driver/Logistics)
            // → record with driver details & file → check invoices vs PODs (missing → tracked query to Sales → follow up)
            // → customer follow-ups: invoice receipt, payments, POD copies → inbox: SARS/customer remittances → forward
            // → log correspondence → close.
            migrationBuilder.Sql(@"
DECLARE @emp nvarchar(20) = (SELECT TOP 1 empid FROM [empregistration] WHERE [Name] = N'Mbali' AND [LastName] = N'Fundisi');
IF @emp IS NULL SET @emp = N'47';
IF NOT EXISTS (SELECT 1 FROM [FlowDefinitions] WHERE [OwnerName] = N'Mbali Fundisi' AND [IsTemplate] = 0)
BEGIN
    INSERT INTO [FlowDefinitions] ([Name],[Description],[Category],[DepartmentName],[OwnerEmployeeId],[OwnerName],[OwnerTitle],[Level],[TriggerType],[TriggerJson],[GraphJson],[InputsJson],[IsEnabled],[IsTemplate],[Version],[StartPermissions],[BlueprintJson],[CreatedAt])
    VALUES (
        N'Mbali · PODs day (GP & CPT)',
        N'How Mbali runs the Gauteng and Cape Town POD desk for Promed Technologies and Pharmatech each day: receive and verify the signed PODs, record them with driver details and file, check invoices against PODs and send anything missing to Sales as a tracked query, follow customers up on invoice receipt, payments and POD copies, process the remittance inbox (incl. SARS), and log every call and email so queries can be answered from the record.',
        N'Operations',
        N'Finance Department',
        @emp,
        N'Mbali Fundisi',
        N'POD Clerk',
        1,
        N'manual',
        N'{""titleTemplate"":""PODs GP/CPT · {{inputs.day}}""}',
        N'{""startStepId"":""receive"",""steps"":[
{""id"":""receive"",""type"":""task"",""name"":""Receive PODs (GP & CPT)"",""x"":60,""y"":60,""nextStepId"":""verify"",""config"":{""title"":""Receive the day''s PODs · {{inputs.day}}"",""description"":""Mbali: collect the signed PODs returned from Gauteng and Cape Town deliveries for Promed Technologies and Pharmatech and check the batch against the delivery list."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":1,""priority"":""Normal"",""form"":[{""key"":""pods"",""label"":""PODs received"",""type"":""number"",""required"":true}]}},
{""id"":""verify"",""type"":""task"",""name"":""Verify completeness & signatures"",""x"":380,""y"":60,""nextStepId"":""issues"",""config"":{""title"":""Verify {{steps.receive.pods}} POD(s)"",""description"":""Mbali: every POD must be fully completed and properly signed by the customer, with date, quantities and invoice reference legible."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""badPods"",""label"":""Missing / incomplete / unsigned PODs"",""type"":""number"",""required"":true}]}},
{""id"":""issues"",""type"":""condition"",""name"":""Problems?"",""x"":700,""y"":60,""config"":{""expression"":""steps.verify.badPods > 0"",""trueStepId"":""chase"",""falseStepId"":""record""}},
{""id"":""chase"",""type"":""task"",""name"":""Chase driver / Logistics"",""x"":700,""y"":260,""nextStepId"":""record"",""config"":{""title"":""Chase {{steps.verify.badPods}} problem POD(s)"",""description"":""Mbali: go back to the driver (details on file) or Logistics for a correct, signed copy and note the outcome."",""assignTo"":{""departmentName"":""Finance Department""},""escalateTo"":{""departmentName"":""Logistics""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""fixed"",""label"":""Corrected PODs received"",""type"":""number"",""required"":true}]}},
{""id"":""record"",""type"":""task"",""name"":""Record with driver details & file"",""x"":1020,""y"":60,""nextStepId"":""invoices"",""config"":{""title"":""Record and file signed PODs"",""description"":""Mbali: capture each signed POD per company (Promed / Pharmatech) with the driver''s details alongside, and file so it can be located and retrieved later."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""recorded"",""label"":""PODs recorded"",""type"":""number"",""required"":true}]}},
{""id"":""invoices"",""type"":""task"",""name"":""Check invoices vs PODs"",""x"":1340,""y"":60,""nextStepId"":""missing"",""config"":{""title"":""Check invoices against PODs"",""description"":""Mbali: confirm each invoice has its POD and list those still without one or with a delivery query."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[{""key"":""missingPods"",""label"":""Invoices without a POD / with delivery query"",""type"":""number"",""required"":true}]}},
{""id"":""missing"",""type"":""condition"",""name"":""Queries for Sales?"",""x"":1660,""y"":60,""config"":{""expression"":""steps.invoices.missingPods > 0"",""trueStepId"":""salesQuery"",""falseStepId"":""customers""}},
{""id"":""salesQuery"",""type"":""task"",""name"":""Query to Sales"",""x"":1660,""y"":260,""nextStepId"":""salesFollow"",""config"":{""title"":""Investigate {{steps.invoices.missingPods}} POD / delivery quer(ies)"",""description"":""Sales: confirm delivery status for each invoice and return the detail so Finance can obtain or correct the POD."",""assignTo"":{""departmentName"":""Sales""},""dueInHours"":24,""priority"":""High"",""form"":[{""key"":""finding"",""label"":""Finding"",""type"":""select"",""required"":true,""options"":[""Delivered - POD to follow"",""Collected by customer"",""Not yet delivered"",""Invoice to be credited""]}]}},
{""id"":""salesFollow"",""type"":""task"",""name"":""Follow up Sales"",""x"":1980,""y"":260,""nextStepId"":""customers"",""config"":{""title"":""Follow up: {{steps.salesQuery.finding}}"",""description"":""Mbali: act on Sales'' answer and keep monitoring until the query is closed."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":24,""priority"":""Normal"",""form"":[]}},
{""id"":""customers"",""type"":""task"",""name"":""Customer follow-ups"",""x"":2300,""y"":60,""nextStepId"":""inbox"",""config"":{""title"":""Invoice receipt, payments & POD copies"",""description"":""Mbali: confirm customers received and captured their invoices, follow up outstanding invoices and payments, and send POD copies requested to support their verification and payment."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":3,""priority"":""High"",""form"":[{""key"":""contacted"",""label"":""Customers contacted"",""type"":""number"",""required"":true},{""key"":""podCopies"",""label"":""POD copies sent"",""type"":""number"",""required"":false}]}},
{""id"":""inbox"",""type"":""task"",""name"":""Remittance inbox"",""x"":2620,""y"":60,""nextStepId"":""anyRemit"",""config"":{""title"":""Check inbox for SARS & customer remittances"",""description"":""Mbali: review remittance advices and payment documentation received (including SARS) and record them."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":1,""priority"":""Normal"",""form"":[{""key"":""remittances"",""label"":""Remittances received"",""type"":""number"",""required"":true}]}},
{""id"":""anyRemit"",""type"":""condition"",""name"":""Any remittances?"",""x"":2940,""y"":60,""config"":{""expression"":""steps.inbox.remittances > 0"",""trueStepId"":""forward"",""falseStepId"":""log""}},
{""id"":""forward"",""type"":""task"",""name"":""Forward to debtors"",""x"":2940,""y"":260,""nextStepId"":""log"",""config"":{""title"":""Forward {{steps.inbox.remittances}} remittance(s)"",""description"":""Mbali: file each remittance and forward it to the debtors controller / person who allocates the payment."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":2,""priority"":""Normal"",""form"":[]}},
{""id"":""log"",""type"":""task"",""name"":""Log calls & emails"",""x"":3260,""y"":60,""nextStepId"":""end"",""config"":{""title"":""Log the day''s correspondence"",""description"":""Mbali: record customer calls, emails and follow-ups so every interaction is documented and outstanding requests are visible for tomorrow."",""assignTo"":{""departmentName"":""Finance Department""},""dueInHours"":1,""priority"":""Normal"",""form"":[{""key"":""openRequests"",""label"":""Open customer requests carried over"",""type"":""number"",""required"":false}]}},
{""id"":""end"",""type"":""end"",""name"":""Day closed"",""x"":3580,""y"":60,""config"":{""outcome"":""closed""}}
]}',
        N'[{""key"":""day"",""label"":""Day"",""type"":""text"",""required"":true},{""key"":""region"",""label"":""Region focus (optional)"",""type"":""select"",""required"":false,""options"":[""Gauteng"",""Cape Town"",""Both""]}]',
        1, 0, 1,
        N'module:finance',
        N'{
 ""email"": ""pods1@promedtechnologies.co.za"",
 ""company"": ""Promed Technologies & Pharmatech"",
 ""purpose"": ""Make sure every Gauteng and Cape Town delivery for Promed Technologies and Pharmatech is backed by a complete, signed POD that is recorded, filed and retrievable; use those PODs to get invoices accepted and paid, and keep a clear record of every customer and driver interaction."",
 ""reportsTo"": ""Finance Manager"",
 ""team"": ""POD Administration & Debtors Support (Finance) \u2014 works with Logistics drivers, Sales and the debtors controllers"",
 ""functionalArea"": ""POD Administration & Debtors Support"",
 ""positionLevel"": ""POD Clerk"",
 ""responsibilities"": [
  {""area"": ""Proof of Delivery (POD) management"", ""items"": [""Check and verify POD documentation for Gauteng (GP) and Cape Town (CPT) deliveries"", ""Ensure all PODs are received, completed correctly and properly signed"", ""Ensure all signed PODs for Promed Technologies and Pharmatech are accurately recorded and filed"", ""Maintain up-to-date POD records with supporting documentation captured"", ""Organise POD records so documents are easy to locate, retrieve and reference"", ""Capture and maintain driver details alongside PODs for future reference and query resolution"", ""Send copies of missing PODs to customers on request""]},
  {""area"": ""POD queries & follow-ups"", ""items"": [""Investigate and follow up POD-related queries"", ""Identify missing, incomplete or incorrectly completed PODs"", ""Follow up outstanding PODs and delivery queries"", ""Submit POD and delivery queries to Sales for investigation and resolution"", ""Monitor outstanding queries until resolved"", ""Assist with historical POD queries and retrieve past delivery documentation""]},
  {""area"": ""Invoice verification & payment follow-ups"", ""items"": [""Check invoices against the relevant POD documentation"", ""Confirm invoices have been received and captured by customers"", ""Follow up with customers on outstanding invoices and payments"", ""Help resolve invoice queries and missing supporting documentation"", ""Send supporting PODs to customers for invoice verification and payment processing""]},
  {""area"": ""Customer communication & administration"", ""items"": [""Communicate with customers on missing PODs, delivery queries and invoice matters"", ""Respond to customer emails and requests for supporting documentation"", ""Keep records of customer calls and email correspondence"", ""Document all follow-ups and customer interactions"", ""Monitor outstanding customer requests for timely responses""]},
  {""area"": ""Remittance advice & financial documentation"", ""items"": [""Monitor the inbox for SARS remittance advices and other payment documentation"", ""Receive and review customer remittance advices"", ""Record payment documentation and forward it to the right department or person"", ""Maintain accurate supporting documentation for invoice and payment follow-ups""]}
 ],
 ""kpis"": [
  {""name"": ""GP & CPT PODs verified and recorded within 24h of return"", ""target"": ""100%"", ""source"": ""POD records / Finance uploader"" },
  {""name"": ""Invoices with signed POD on file"", ""target"": ""100% within 48h of delivery"", ""source"": ""POD summary"" },
  {""name"": ""Problem PODs corrected"", ""target"": ""Within 2 working days"", ""source"": ""Flow tasks"" },
  {""name"": ""POD copy requests answered"", ""target"": ""Same day"", ""source"": ""Correspondence log"" },
  {""name"": ""Sales delivery queries closed"", ""target"": ""Within 3 working days"", ""source"": ""Flow tasks (Sales step)"" },
  {""name"": ""Remittances forwarded"", ""target"": ""Same day received"", ""source"": ""Inbox / forward log"" },
  {""name"": ""Customer interactions logged"", ""target"": ""100%"", ""source"": ""Correspondence log"" }
 ],
 ""systems"": [""Intranet Finance (POD uploader, POD summary)"", ""POD filing per company (Promed / Pharmatech)"", ""Driver register"", ""Sage (invoices)"", ""Email inbox (remittances, SARS)"", ""Phone""],
 ""inputs"": [""Signed PODs from GP / CPT drivers"", ""Delivery lists from Logistics"", ""Invoices from Sales"", ""Customer POD / invoice requests"", ""Remittance advices (customers, SARS)""],
 ""outputs"": [""Verified, filed PODs with driver details"", ""POD copies to customers"", ""Delivery / POD queries to Sales"", ""Invoice & payment follow-up log"", ""Remittances forwarded to debtors"", ""Correspondence record""],
 ""painPoints"": [
  {""issue"": ""Unsigned or partly completed PODs come back from GP / CPT"", ""idea"": ""Driver photo capture at delivery with a signature check before the POD is accepted; auto-flag unsigned uploads.""},
  {""issue"": ""Historical POD requests take time to dig out"", ""idea"": ""Self-service POD search on the intranet by invoice / customer / date / driver.""},
  {""issue"": ""Delivery queries to Sales stall"", ""idea"": ""The Sales step here is a tracked task with a 24h due date and escalation.""},
  {""issue"": ""Remittances buried in a shared inbox"", ""idea"": ""Welly scans the inbox for remittance / SARS PDFs, extracts amounts and invoice numbers and creates a forward task automatically.""}
 ],
 ""handover"": ""If Mbali is away: receive the GP and CPT PODs daily and accept only fully completed, signed copies \u2014 chase the driver (details on file) or Logistics for the rest; record each POD per company with driver details and file it; check invoices against PODs and send delivery queries to Sales as tracked tasks; send POD copies to customers the same day they ask; check the inbox for SARS and customer remittances and forward them to the debtors controller; log every call and email. Escalate disputed deliveries to Logistics and unpaid invoices to the debtors controller."",
 ""reviewedAt"": ""2026-10-30""
}',
        SYSUTCDATETIME());
END");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"DELETE FROM [FlowDefinitions] WHERE [OwnerName] = N'Mbali Fundisi' AND [Name] = N'Mbali · PODs day (GP & CPT)';");
        }
    }
}
