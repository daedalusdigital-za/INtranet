using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCondomSamplesAndArtwork : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StaffOperatingCompanies_Users_StaffMemberId",
                table: "StaffOperatingCompanies");

            migrationBuilder.DropTable(
                name: "CampaignAgents");

            migrationBuilder.DropTable(
                name: "LeadAssignmentHistories");

            migrationBuilder.DropTable(
                name: "LeadInterests");

            migrationBuilder.DropTable(
                name: "LeadLogs");

            migrationBuilder.DropTable(
                name: "Leads");

            migrationBuilder.DropTable(
                name: "Promotions");

            migrationBuilder.DropTable(
                name: "Campaigns");

            migrationBuilder.DropTable(
                name: "Dispositions");

            migrationBuilder.DropTable(
                name: "LeadStatuses");

            migrationBuilder.DeleteData(
                table: "StaffOperatingCompanies",
                keyColumn: "StaffOperatingCompanyId",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "StaffOperatingCompanies",
                keyColumn: "StaffOperatingCompanyId",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "StaffOperatingCompanies",
                keyColumn: "StaffOperatingCompanyId",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "StaffOperatingCompanies",
                keyColumn: "StaffOperatingCompanyId",
                keyValue: 4);

            migrationBuilder.DeleteData(
                table: "OperatingCompanies",
                keyColumn: "OperatingCompanyId",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "OperatingCompanies",
                keyColumn: "OperatingCompanyId",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "OperatingCompanies",
                keyColumn: "OperatingCompanyId",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "OperatingCompanies",
                keyColumn: "OperatingCompanyId",
                keyValue: 4);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeliveryDeadline",
                table: "ImportedInvoices",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeliveryPriority",
                table: "ImportedInvoices",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "CondomArtworks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Scent = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Version = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Designer = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ApprovalDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CondomArtworks", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CondomProductionSchedules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Scent = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BatchCode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    UOM = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ScheduleDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    QuantityNote = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ScentGroup = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CondomProductionSchedules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CondomSamples",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Scent = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    BatchCode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    DateSent = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Recipient = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CondomSamples", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ReportCaches",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CacheKey = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ReportType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    FromDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ToDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Parameters = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ResultJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    GeneratedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    GenerationTimeMs = table.Column<int>(type: "int", nullable: false),
                    HitCount = table.Column<int>(type: "int", nullable: false),
                    LastAccessedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ResultSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    GeneratedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportCaches", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TenderReminders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TenderId = table.Column<int>(type: "int", nullable: false),
                    EventType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EventDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DaysBefore = table.Column<int>(type: "int", nullable: false),
                    EmailRecipients = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsSent = table.Column<bool>(type: "bit", nullable: false),
                    SentAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false),
                    CreatedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TenderReminders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_TenderReminders_Tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "Tenders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ReportCaches_CacheKey",
                table: "ReportCaches",
                column: "CacheKey",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReportCaches_ExpiresAt",
                table: "ReportCaches",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_ReportCaches_ReportType_FromDate_ToDate",
                table: "ReportCaches",
                columns: new[] { "ReportType", "FromDate", "ToDate" });

            migrationBuilder.CreateIndex(
                name: "IX_TenderReminders_TenderId",
                table: "TenderReminders",
                column: "TenderId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CondomArtworks");

            migrationBuilder.DropTable(
                name: "CondomProductionSchedules");

            migrationBuilder.DropTable(
                name: "CondomSamples");

            migrationBuilder.DropTable(
                name: "ReportCaches");

            migrationBuilder.DropTable(
                name: "TenderReminders");

            migrationBuilder.DropColumn(
                name: "DeliveryDeadline",
                table: "ImportedInvoices");

            migrationBuilder.DropColumn(
                name: "DeliveryPriority",
                table: "ImportedInvoices");

            migrationBuilder.CreateTable(
                name: "Campaigns",
                columns: table => new
                {
                    CampaignId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    Budget = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    CampaignType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Channel = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Instructions = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Script = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TargetConversions = table.Column<int>(type: "int", nullable: true),
                    TargetLeads = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedById = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Campaigns", x => x.CampaignId);
                    table.ForeignKey(
                        name: "FK_Campaigns_OperatingCompanies_OperatingCompanyId",
                        column: x => x.OperatingCompanyId,
                        principalTable: "OperatingCompanies",
                        principalColumn: "OperatingCompanyId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Dispositions",
                columns: table => new
                {
                    DispositionId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    Color = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Icon = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDoNotCall = table.Column<bool>(type: "bit", nullable: false),
                    IsFinal = table.Column<bool>(type: "bit", nullable: false),
                    IsPositive = table.Column<bool>(type: "bit", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    RequiresCallback = table.Column<bool>(type: "bit", nullable: false),
                    RequiresNotes = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Dispositions", x => x.DispositionId);
                    table.ForeignKey(
                        name: "FK_Dispositions_OperatingCompanies_OperatingCompanyId",
                        column: x => x.OperatingCompanyId,
                        principalTable: "OperatingCompanies",
                        principalColumn: "OperatingCompanyId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LeadStatuses",
                columns: table => new
                {
                    LeadStatusId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    Color = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Icon = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDefault = table.Column<bool>(type: "bit", nullable: false),
                    IsFinal = table.Column<bool>(type: "bit", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadStatuses", x => x.LeadStatusId);
                    table.ForeignKey(
                        name: "FK_LeadStatuses_OperatingCompanies_OperatingCompanyId",
                        column: x => x.OperatingCompanyId,
                        principalTable: "OperatingCompanies",
                        principalColumn: "OperatingCompanyId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Promotions",
                columns: table => new
                {
                    PromotionId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    AgentScript = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    DiscountType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DiscountValue = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    PromoCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    TargetAudience = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TargetProducts = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Terms = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedById = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Promotions", x => x.PromotionId);
                    table.ForeignKey(
                        name: "FK_Promotions_OperatingCompanies_OperatingCompanyId",
                        column: x => x.OperatingCompanyId,
                        principalTable: "OperatingCompanies",
                        principalColumn: "OperatingCompanyId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CampaignAgents",
                columns: table => new
                {
                    CampaignAgentId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgentId = table.Column<int>(type: "int", nullable: false),
                    CampaignId = table.Column<int>(type: "int", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AssignedById = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    RemovedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RemovedById = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CampaignAgents", x => x.CampaignAgentId);
                    table.ForeignKey(
                        name: "FK_CampaignAgents_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalTable: "Campaigns",
                        principalColumn: "CampaignId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CampaignAgents_Users_AgentId",
                        column: x => x.AgentId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Leads",
                columns: table => new
                {
                    LeadId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AssignedAgentId = table.Column<int>(type: "int", nullable: true),
                    CampaignId = table.Column<int>(type: "int", nullable: true),
                    LastDispositionId = table.Column<int>(type: "int", nullable: true),
                    LeadStatusId = table.Column<int>(type: "int", nullable: true),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    ActualValue = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Address = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AlternatePhone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Area = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CompanyName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Country = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedById = table.Column<int>(type: "int", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedById = table.Column<int>(type: "int", nullable: true),
                    DoNotCall = table.Column<bool>(type: "bit", nullable: false),
                    DoNotCallReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DoNotCallSetAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DoNotCallSetById = table.Column<int>(type: "int", nullable: true),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    EstimatedValue = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    FirstName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    IsHot = table.Column<bool>(type: "bit", nullable: false),
                    JobTitle = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    LastContactedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    LeadScore = table.Column<int>(type: "int", nullable: true),
                    MobilePhone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    NextCallbackAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Phone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    PostalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Province = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Source = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TotalCallAttempts = table.Column<int>(type: "int", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedById = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Leads", x => x.LeadId);
                    table.ForeignKey(
                        name: "FK_Leads_Campaigns_CampaignId",
                        column: x => x.CampaignId,
                        principalTable: "Campaigns",
                        principalColumn: "CampaignId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Leads_Dispositions_LastDispositionId",
                        column: x => x.LastDispositionId,
                        principalTable: "Dispositions",
                        principalColumn: "DispositionId");
                    table.ForeignKey(
                        name: "FK_Leads_LeadStatuses_LeadStatusId",
                        column: x => x.LeadStatusId,
                        principalTable: "LeadStatuses",
                        principalColumn: "LeadStatusId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Leads_OperatingCompanies_OperatingCompanyId",
                        column: x => x.OperatingCompanyId,
                        principalTable: "OperatingCompanies",
                        principalColumn: "OperatingCompanyId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Leads_Users_AssignedAgentId",
                        column: x => x.AssignedAgentId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "LeadAssignmentHistories",
                columns: table => new
                {
                    LeadAssignmentHistoryId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChangedById = table.Column<int>(type: "int", nullable: false),
                    LeadId = table.Column<int>(type: "int", nullable: false),
                    NewAgentId = table.Column<int>(type: "int", nullable: true),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    PreviousAgentId = table.Column<int>(type: "int", nullable: true),
                    ChangedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Reason = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadAssignmentHistories", x => x.LeadAssignmentHistoryId);
                    table.ForeignKey(
                        name: "FK_LeadAssignmentHistories_Leads_LeadId",
                        column: x => x.LeadId,
                        principalTable: "Leads",
                        principalColumn: "LeadId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeadAssignmentHistories_OperatingCompanies_OperatingCompanyId",
                        column: x => x.OperatingCompanyId,
                        principalTable: "OperatingCompanies",
                        principalColumn: "OperatingCompanyId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeadAssignmentHistories_Users_ChangedById",
                        column: x => x.ChangedById,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeadAssignmentHistories_Users_NewAgentId",
                        column: x => x.NewAgentId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                    table.ForeignKey(
                        name: "FK_LeadAssignmentHistories_Users_PreviousAgentId",
                        column: x => x.PreviousAgentId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "LeadInterests",
                columns: table => new
                {
                    LeadInterestId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    LeadId = table.Column<int>(type: "int", nullable: false),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    PromotionId = table.Column<int>(type: "int", nullable: true),
                    RecordedById = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    InterestLevel = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ProductOrService = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadInterests", x => x.LeadInterestId);
                    table.ForeignKey(
                        name: "FK_LeadInterests_Leads_LeadId",
                        column: x => x.LeadId,
                        principalTable: "Leads",
                        principalColumn: "LeadId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeadInterests_OperatingCompanies_OperatingCompanyId",
                        column: x => x.OperatingCompanyId,
                        principalTable: "OperatingCompanies",
                        principalColumn: "OperatingCompanyId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeadInterests_Promotions_PromotionId",
                        column: x => x.PromotionId,
                        principalTable: "Promotions",
                        principalColumn: "PromotionId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LeadInterests_Users_RecordedById",
                        column: x => x.RecordedById,
                        principalTable: "Users",
                        principalColumn: "UserId");
                });

            migrationBuilder.CreateTable(
                name: "LeadLogs",
                columns: table => new
                {
                    LeadLogId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgentId = table.Column<int>(type: "int", nullable: false),
                    DispositionId = table.Column<int>(type: "int", nullable: true),
                    LeadId = table.Column<int>(type: "int", nullable: false),
                    OperatingCompanyId = table.Column<int>(type: "int", nullable: false),
                    PromotionId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DurationSeconds = table.Column<int>(type: "int", nullable: true),
                    IsPositiveOutcome = table.Column<bool>(type: "bit", nullable: false),
                    LogDateTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LogType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NewLeadStatusId = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ScheduledCallbackAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    WasContacted = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LeadLogs", x => x.LeadLogId);
                    table.ForeignKey(
                        name: "FK_LeadLogs_Dispositions_DispositionId",
                        column: x => x.DispositionId,
                        principalTable: "Dispositions",
                        principalColumn: "DispositionId",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_LeadLogs_Leads_LeadId",
                        column: x => x.LeadId,
                        principalTable: "Leads",
                        principalColumn: "LeadId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeadLogs_OperatingCompanies_OperatingCompanyId",
                        column: x => x.OperatingCompanyId,
                        principalTable: "OperatingCompanies",
                        principalColumn: "OperatingCompanyId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LeadLogs_Promotions_PromotionId",
                        column: x => x.PromotionId,
                        principalTable: "Promotions",
                        principalColumn: "PromotionId");
                    table.ForeignKey(
                        name: "FK_LeadLogs_Users_AgentId",
                        column: x => x.AgentId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.InsertData(
                table: "OperatingCompanies",
                columns: new[] { "OperatingCompanyId", "Code", "CreatedAt", "CreatedById", "Description", "IsActive", "LogoUrl", "Name", "PrimaryColor", "UpdatedAt", "UpdatedById" },
                values: new object[,]
                {
                    { 1, "PROMED", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), null, "Medical technology solutions", true, null, "PromedTechnologies", "#1e90ff", null, null },
                    { 2, "ACCMED", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), null, "Medical access solutions", true, null, "AccessMedical", "#28a745", null, null },
                    { 3, "PHARMA", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), null, "Pharmaceutical technology", true, null, "Pharmatech", "#6f42c1", null, null },
                    { 4, "SEBENZ", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), null, "Trading solutions", true, null, "SebenzaniTrading", "#fd7e14", null, null }
                });

            migrationBuilder.InsertData(
                table: "Dispositions",
                columns: new[] { "DispositionId", "Color", "CreatedAt", "Description", "Icon", "IsActive", "IsDoNotCall", "IsFinal", "IsPositive", "Name", "OperatingCompanyId", "RequiresCallback", "RequiresNotes", "SortOrder", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, "#6c757d", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "No one answered", "phone_missed", true, false, false, false, "No Answer", 1, false, false, 1, null },
                    { 2, "#17a2b8", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Left voicemail", "voicemail", true, false, false, false, "Voicemail", 1, false, false, 2, null },
                    { 3, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Number is invalid", "phone_disabled", true, false, true, false, "Invalid Number", 1, false, false, 3, null },
                    { 4, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Not interested in offer", "thumb_down", true, false, true, false, "Not Interested", 1, false, false, 4, null },
                    { 5, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Interested, schedule callback", "event", true, false, false, true, "Interested - Call Back", 1, true, false, 5, null },
                    { 6, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Send more information", "mail", true, false, false, true, "Interested - Send Info", 1, false, false, 6, null },
                    { 7, "#ffc107", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Need to reach decision maker", "person_search", true, false, false, false, "Decision Maker Not Available", 1, true, false, 7, null },
                    { 8, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Do Not Call", "block", true, true, true, false, "DNC", 1, false, false, 8, null },
                    { 9, "#6c757d", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "No one answered", "phone_missed", true, false, false, false, "No Answer", 2, false, false, 1, null },
                    { 10, "#17a2b8", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Left voicemail", "voicemail", true, false, false, false, "Voicemail", 2, false, false, 2, null },
                    { 11, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Number is invalid", "phone_disabled", true, false, true, false, "Invalid Number", 2, false, false, 3, null },
                    { 12, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Not interested in offer", "thumb_down", true, false, true, false, "Not Interested", 2, false, false, 4, null },
                    { 13, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Interested, schedule callback", "event", true, false, false, true, "Interested - Call Back", 2, true, false, 5, null },
                    { 14, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Send more information", "mail", true, false, false, true, "Interested - Send Info", 2, false, false, 6, null },
                    { 15, "#ffc107", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Need to reach decision maker", "person_search", true, false, false, false, "Decision Maker Not Available", 2, true, false, 7, null },
                    { 16, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Do Not Call", "block", true, true, true, false, "DNC", 2, false, false, 8, null },
                    { 17, "#6c757d", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "No one answered", "phone_missed", true, false, false, false, "No Answer", 3, false, false, 1, null },
                    { 18, "#17a2b8", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Left voicemail", "voicemail", true, false, false, false, "Voicemail", 3, false, false, 2, null },
                    { 19, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Number is invalid", "phone_disabled", true, false, true, false, "Invalid Number", 3, false, false, 3, null },
                    { 20, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Not interested in offer", "thumb_down", true, false, true, false, "Not Interested", 3, false, false, 4, null },
                    { 21, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Interested, schedule callback", "event", true, false, false, true, "Interested - Call Back", 3, true, false, 5, null },
                    { 22, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Send more information", "mail", true, false, false, true, "Interested - Send Info", 3, false, false, 6, null },
                    { 23, "#ffc107", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Need to reach decision maker", "person_search", true, false, false, false, "Decision Maker Not Available", 3, true, false, 7, null },
                    { 24, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Do Not Call", "block", true, true, true, false, "DNC", 3, false, false, 8, null },
                    { 25, "#6c757d", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "No one answered", "phone_missed", true, false, false, false, "No Answer", 4, false, false, 1, null },
                    { 26, "#17a2b8", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Left voicemail", "voicemail", true, false, false, false, "Voicemail", 4, false, false, 2, null },
                    { 27, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Number is invalid", "phone_disabled", true, false, true, false, "Invalid Number", 4, false, false, 3, null },
                    { 28, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Not interested in offer", "thumb_down", true, false, true, false, "Not Interested", 4, false, false, 4, null },
                    { 29, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Interested, schedule callback", "event", true, false, false, true, "Interested - Call Back", 4, true, false, 5, null },
                    { 30, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Send more information", "mail", true, false, false, true, "Interested - Send Info", 4, false, false, 6, null },
                    { 31, "#ffc107", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Need to reach decision maker", "person_search", true, false, false, false, "Decision Maker Not Available", 4, true, false, 7, null },
                    { 32, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Do Not Call", "block", true, true, true, false, "DNC", 4, false, false, 8, null }
                });

            migrationBuilder.InsertData(
                table: "LeadStatuses",
                columns: new[] { "LeadStatusId", "Color", "CreatedAt", "Description", "Icon", "IsActive", "IsDefault", "IsFinal", "Name", "OperatingCompanyId", "SortOrder", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, "#17a2b8", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "New lead", "fiber_new", true, true, false, "New", 1, 1, null },
                    { 2, "#ffc107", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Trying to reach", "phone_callback", true, false, false, "Attempting Contact", 1, 2, null },
                    { 3, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Successfully contacted", "phone_in_talk", true, false, false, "Contacted", 1, 3, null },
                    { 4, "#007bff", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Qualified lead", "verified", true, false, false, "Qualified", 1, 4, null },
                    { 5, "#6f42c1", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Needs follow-up", "schedule", true, false, false, "Follow-up", 1, 5, null },
                    { 6, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Deal closed successfully", "emoji_events", true, false, true, "Won", 1, 6, null },
                    { 7, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Deal lost", "cancel", true, false, true, "Lost", 1, 7, null },
                    { 8, "#17a2b8", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "New lead", "fiber_new", true, true, false, "New", 2, 1, null },
                    { 9, "#ffc107", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Trying to reach", "phone_callback", true, false, false, "Attempting Contact", 2, 2, null },
                    { 10, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Successfully contacted", "phone_in_talk", true, false, false, "Contacted", 2, 3, null },
                    { 11, "#007bff", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Qualified lead", "verified", true, false, false, "Qualified", 2, 4, null },
                    { 12, "#6f42c1", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Needs follow-up", "schedule", true, false, false, "Follow-up", 2, 5, null },
                    { 13, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Deal closed successfully", "emoji_events", true, false, true, "Won", 2, 6, null },
                    { 14, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Deal lost", "cancel", true, false, true, "Lost", 2, 7, null },
                    { 15, "#17a2b8", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "New lead", "fiber_new", true, true, false, "New", 3, 1, null },
                    { 16, "#ffc107", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Trying to reach", "phone_callback", true, false, false, "Attempting Contact", 3, 2, null },
                    { 17, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Successfully contacted", "phone_in_talk", true, false, false, "Contacted", 3, 3, null },
                    { 18, "#007bff", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Qualified lead", "verified", true, false, false, "Qualified", 3, 4, null },
                    { 19, "#6f42c1", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Needs follow-up", "schedule", true, false, false, "Follow-up", 3, 5, null },
                    { 20, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Deal closed successfully", "emoji_events", true, false, true, "Won", 3, 6, null },
                    { 21, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Deal lost", "cancel", true, false, true, "Lost", 3, 7, null },
                    { 22, "#17a2b8", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "New lead", "fiber_new", true, true, false, "New", 4, 1, null },
                    { 23, "#ffc107", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Trying to reach", "phone_callback", true, false, false, "Attempting Contact", 4, 2, null },
                    { 24, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Successfully contacted", "phone_in_talk", true, false, false, "Contacted", 4, 3, null },
                    { 25, "#007bff", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Qualified lead", "verified", true, false, false, "Qualified", 4, 4, null },
                    { 26, "#6f42c1", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Needs follow-up", "schedule", true, false, false, "Follow-up", 4, 5, null },
                    { 27, "#28a745", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Deal closed successfully", "emoji_events", true, false, true, "Won", 4, 6, null },
                    { 28, "#dc3545", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), "Deal lost", "cancel", true, false, true, "Lost", 4, 7, null }
                });

            migrationBuilder.InsertData(
                table: "StaffOperatingCompanies",
                columns: new[] { "StaffOperatingCompanyId", "CompanyRole", "CreatedAt", "IsActive", "IsPrimaryCompany", "OperatingCompanyId", "StaffMemberId", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, "SalesManager", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, true, 1, 1, null },
                    { 2, "SalesManager", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, false, 2, 1, null },
                    { 3, "SalesManager", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, false, 3, 1, null },
                    { 4, "SalesManager", new DateTime(2025, 11, 3, 0, 0, 0, 0, DateTimeKind.Utc), true, false, 4, 1, null }
                });

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAgents_AgentId",
                table: "CampaignAgents",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_CampaignAgents_CampaignId",
                table: "CampaignAgents",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_Campaigns_OperatingCompanyId",
                table: "Campaigns",
                column: "OperatingCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Dispositions_OperatingCompanyId",
                table: "Dispositions",
                column: "OperatingCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadAssignmentHistories_ChangedById",
                table: "LeadAssignmentHistories",
                column: "ChangedById");

            migrationBuilder.CreateIndex(
                name: "IX_LeadAssignmentHistories_LeadId",
                table: "LeadAssignmentHistories",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadAssignmentHistories_NewAgentId",
                table: "LeadAssignmentHistories",
                column: "NewAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadAssignmentHistories_OperatingCompanyId",
                table: "LeadAssignmentHistories",
                column: "OperatingCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadAssignmentHistories_PreviousAgentId",
                table: "LeadAssignmentHistories",
                column: "PreviousAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadInterests_LeadId",
                table: "LeadInterests",
                column: "LeadId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadInterests_OperatingCompanyId",
                table: "LeadInterests",
                column: "OperatingCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadInterests_PromotionId",
                table: "LeadInterests",
                column: "PromotionId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadInterests_RecordedById",
                table: "LeadInterests",
                column: "RecordedById");

            migrationBuilder.CreateIndex(
                name: "IX_LeadLogs_AgentId",
                table: "LeadLogs",
                column: "AgentId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadLogs_DispositionId",
                table: "LeadLogs",
                column: "DispositionId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadLogs_LeadId_LogDateTime",
                table: "LeadLogs",
                columns: new[] { "LeadId", "LogDateTime" });

            migrationBuilder.CreateIndex(
                name: "IX_LeadLogs_OperatingCompanyId",
                table: "LeadLogs",
                column: "OperatingCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_LeadLogs_PromotionId",
                table: "LeadLogs",
                column: "PromotionId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_AssignedAgentId",
                table: "Leads",
                column: "AssignedAgentId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_CampaignId",
                table: "Leads",
                column: "CampaignId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_LastDispositionId",
                table: "Leads",
                column: "LastDispositionId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_LeadStatusId",
                table: "Leads",
                column: "LeadStatusId");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_NextCallbackAt",
                table: "Leads",
                column: "NextCallbackAt");

            migrationBuilder.CreateIndex(
                name: "IX_Leads_OperatingCompanyId_AssignedAgentId",
                table: "Leads",
                columns: new[] { "OperatingCompanyId", "AssignedAgentId" });

            migrationBuilder.CreateIndex(
                name: "IX_Leads_OperatingCompanyId_LeadStatusId",
                table: "Leads",
                columns: new[] { "OperatingCompanyId", "LeadStatusId" });

            migrationBuilder.CreateIndex(
                name: "IX_Leads_Phone",
                table: "Leads",
                column: "Phone");

            migrationBuilder.CreateIndex(
                name: "IX_LeadStatuses_OperatingCompanyId",
                table: "LeadStatuses",
                column: "OperatingCompanyId");

            migrationBuilder.CreateIndex(
                name: "IX_Promotions_OperatingCompanyId",
                table: "Promotions",
                column: "OperatingCompanyId");

            migrationBuilder.AddForeignKey(
                name: "FK_StaffOperatingCompanies_Users_StaffMemberId",
                table: "StaffOperatingCompanies",
                column: "StaffMemberId",
                principalTable: "Users",
                principalColumn: "UserId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
