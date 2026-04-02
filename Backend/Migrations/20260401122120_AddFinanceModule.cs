using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace ProjectTracker.API.Migrations
{
    /// <inheritdoc />
    public partial class AddFinanceModule : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Skip dropping constraint if it doesn't exist
            // migrationBuilder.DropForeignKey(
            //     name: "FK_StaffOperatingCompanies_Users_StaffMemberId",
            //     table: "StaffOperatingCompanies");

            // Skip dropping tables that may not exist
            // migrationBuilder.DropTable(name: "CampaignAgents");
            // migrationBuilder.DropTable(name: "LeadAssignmentHistories");
            // migrationBuilder.DropTable(name: "LeadInterests");
            // migrationBuilder.DropTable(name: "LeadLogs");
            // migrationBuilder.DropTable(name: "Leads");
            // migrationBuilder.DropTable(name: "Promotions");
            // migrationBuilder.DropTable(name: "Campaigns");
            // migrationBuilder.DropTable(name: "Dispositions");
            // migrationBuilder.DropTable(name: "LeadStatuses");

            // Skip deleting seed data that may not exist
            // migrationBuilder.DeleteData(...)

            migrationBuilder.AddColumn<string>(
                name: "ArtworkStatus",
                table: "Tenders",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SamplesStatus",
                table: "Tenders",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

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
                name: "ArtworkFiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FileName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    FilePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    FileType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    MimeType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CompanyCode = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TenderId = table.Column<int>(type: "int", nullable: true),
                    TenderNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    UploadedByUserId = table.Column<int>(type: "int", nullable: true),
                    UploadedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SentToMarketing = table.Column<bool>(type: "bit", nullable: false),
                    SentToMarketingAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SentToMarketingRecipients = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SentToMarketingPriority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    SentToMarketingMessage = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    SentToMarketingRequestedBy = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SentToMarketingRequestedByUser = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArtworkFiles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArtworkFiles_Tenders_TenderId",
                        column: x => x.TenderId,
                        principalTable: "Tenders",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "BookDepartmentAccess",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DepartmentId = table.Column<int>(type: "int", nullable: false),
                    DepartmentName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Password = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookDepartmentAccess", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookDepartmentAccess_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "DepartmentId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BookInvoices",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SupplierName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    SupplierAccount = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    InvoiceDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Total = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VatAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    SubTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Currency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    PaymentDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PaymentMethod = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PaymentReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Category = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CompanyName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    FilePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    FileHash = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    ExtractedText = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DepartmentId = table.Column<int>(type: "int", nullable: false),
                    UploadedByUserId = table.Column<int>(type: "int", nullable: false),
                    UploadedByName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ConfirmedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ConfirmedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BookInvoices", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BookInvoices_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "DepartmentId",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BookInvoices_Users_ConfirmedByUserId",
                        column: x => x.ConfirmedByUserId,
                        principalTable: "Users",
                        principalColumn: "UserId");
                    table.ForeignKey(
                        name: "FK_BookInvoices_Users_UploadedByUserId",
                        column: x => x.UploadedByUserId,
                        principalTable: "Users",
                        principalColumn: "UserId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Budgets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    FiscalYear = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Period = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Department = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TotalBudget = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    AllocatedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SpentAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RemainingAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Budgets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CarTrackEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SalesRepName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    RegistrationNumber = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Location = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Province = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Purpose = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ClientVisited = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    VisitDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TimeArrived = table.Column<TimeSpan>(type: "time", nullable: true),
                    TimeDeparted = table.Column<TimeSpan>(type: "time", nullable: true),
                    KilometerStart = table.Column<double>(type: "float", nullable: true),
                    KilometerEnd = table.Column<double>(type: "float", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CarTrackEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CondomDeliveryRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReferenceNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Department = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Scent = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    BatchCode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    UOM = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    DeliveryAddress = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Priority = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    RequestedDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RequestedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ApprovedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeliveredDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    HandledBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CondomDeliveryRequests", x => x.Id);
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
                name: "CreditNoteAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CreditNoteId = table.Column<int>(type: "int", nullable: false),
                    CreditNoteNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    StoredFileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    UploadedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CreditNoteAttachments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "EmailAccounts",
                columns: table => new
                {
                    EmailAccountId = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Email = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    Password = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Department = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailAccounts", x => x.EmailAccountId);
                });

            migrationBuilder.CreateTable(
                name: "FinanceCategories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Type = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Code = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ParentCategoryId = table.Column<int>(type: "int", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinanceCategories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FuelTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VehicleId = table.Column<int>(type: "int", nullable: true),
                    RegistrationNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CardNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    DepotName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AllocationLitres = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LitresUsed = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TransactionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AmountSpent = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DepotAssignment = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ReportMonth = table.Column<int>(type: "int", nullable: false),
                    ReportYear = table.Column<int>(type: "int", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FuelTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FuelTransactions_Vehicles_VehicleId",
                        column: x => x.VehicleId,
                        principalTable: "Vehicles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "MaintenanceAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MaintenanceRecordId = table.Column<int>(type: "int", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    StoredFileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    UploadedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    VehicleRegistration = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MaintenanceAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MaintenanceAttachments_VehicleMaintenance_MaintenanceRecordId",
                        column: x => x.MaintenanceRecordId,
                        principalTable: "VehicleMaintenance",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PadsCreditNotes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CreditNoteNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CreditDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PadsCreditNotes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PadsInvoicesProcessed",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    InvoiceReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    InvoiceDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PadsInvoicesProcessed", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PadsStockDelivered",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DeliveryReference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    QuantityDelivered = table.Column<int>(type: "int", nullable: false),
                    UOM = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Quarter = table.Column<int>(type: "int", nullable: false),
                    DeliveryDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PadsStockDelivered", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PadsStockReceived",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VendorName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    GrnNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ItemCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ItemDescription = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Reference = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Location = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    InvoiceDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UOM = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    QuantityReceived = table.Column<int>(type: "int", nullable: false),
                    UnitCost = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SubTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Quarter = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PadsStockReceived", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PadsWarehouseStock",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WarehouseName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StockType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    UOM = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    IsDamaged = table.Column<bool>(type: "bit", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    SnapshotDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PadsWarehouseStock", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PodDocuments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    DriverId = table.Column<int>(type: "int", nullable: true),
                    DriverName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DeliveryDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Region = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    FilePath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    ContentType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LoadId = table.Column<int>(type: "int", nullable: true),
                    InvoiceId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PodDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PodDocuments_Drivers_DriverId",
                        column: x => x.DriverId,
                        principalTable: "Drivers",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PodDocuments_ImportedInvoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "ImportedInvoices",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_PodDocuments_Loads_LoadId",
                        column: x => x.LoadId,
                        principalTable: "Loads",
                        principalColumn: "Id");
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

            migrationBuilder.CreateTable(
                name: "TrainingAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TrainingSessionId = table.Column<int>(type: "int", nullable: false),
                    TrainingName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    FileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    StoredFileName = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    UploadedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TrainingAttachments", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ArtworkAnnotations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ArtworkFileId = table.Column<int>(type: "int", nullable: false),
                    Type = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    X = table.Column<double>(type: "float", nullable: false),
                    Y = table.Column<double>(type: "float", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    Color = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: true),
                    CreatedByUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ArtworkAnnotations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ArtworkAnnotations_ArtworkFiles_ArtworkFileId",
                        column: x => x.ArtworkFileId,
                        principalTable: "ArtworkFiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "BudgetLineItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BudgetId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CategoryId = table.Column<int>(type: "int", nullable: true),
                    AllocatedAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    SpentAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    RemainingAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BudgetLineItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BudgetLineItems_Budgets_BudgetId",
                        column: x => x.BudgetId,
                        principalTable: "Budgets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_BudgetLineItems_FinanceCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "FinanceCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PurchaseOrders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PoNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SupplierName = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SupplierContact = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SupplierEmail = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SubTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VatAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Total = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    OrderDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ExpectedDeliveryDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ReceivedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RequestedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    DeliveryAddress = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AttachmentPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AttachmentFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseOrders_FinanceCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "FinanceCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Expenses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ExpenseNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Vendor = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    VatAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    TotalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    CategoryId = table.Column<int>(type: "int", nullable: true),
                    Department = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ExpenseDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    DueDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SubmittedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PaymentMethod = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PaymentReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    InvoiceNumber = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ReceiptPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ReceiptFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IsRecurring = table.Column<bool>(type: "bit", nullable: false),
                    RecurrencePattern = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BudgetId = table.Column<int>(type: "int", nullable: true),
                    PurchaseOrderId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Expenses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Expenses_Budgets_BudgetId",
                        column: x => x.BudgetId,
                        principalTable: "Budgets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Expenses_FinanceCategories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "FinanceCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Expenses_PurchaseOrders_PurchaseOrderId",
                        column: x => x.PurchaseOrderId,
                        principalTable: "PurchaseOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "PurchaseOrderItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PurchaseOrderId = table.Column<int>(type: "int", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ProductCode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Quantity = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    LineTotal = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    ReceivedQuantity = table.Column<decimal>(type: "decimal(18,4)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseOrderItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderId",
                        column: x => x.PurchaseOrderId,
                        principalTable: "PurchaseOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Payments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PaymentNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PaymentType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ExpenseId = table.Column<int>(type: "int", nullable: true),
                    PurchaseOrderId = table.Column<int>(type: "int", nullable: true),
                    BookInvoiceId = table.Column<int>(type: "int", nullable: true),
                    Payee = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PaymentMethod = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PaymentReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    BankReference = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PaymentDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ProcessedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ProcessedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ApprovedDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    BankName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AccountNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    BranchCode = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    ProofPath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ProofFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Payments_Expenses_ExpenseId",
                        column: x => x.ExpenseId,
                        principalTable: "Expenses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Payments_PurchaseOrders_PurchaseOrderId",
                        column: x => x.PurchaseOrderId,
                        principalTable: "PurchaseOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ArtworkAnnotations_ArtworkFileId",
                table: "ArtworkAnnotations",
                column: "ArtworkFileId");

            migrationBuilder.CreateIndex(
                name: "IX_ArtworkFiles_TenderId",
                table: "ArtworkFiles",
                column: "TenderId");

            migrationBuilder.CreateIndex(
                name: "IX_BookDepartmentAccess_DepartmentId",
                table: "BookDepartmentAccess",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_BookInvoices_ConfirmedByUserId",
                table: "BookInvoices",
                column: "ConfirmedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_BookInvoices_DepartmentId",
                table: "BookInvoices",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_BookInvoices_UploadedByUserId",
                table: "BookInvoices",
                column: "UploadedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_BudgetLineItems_BudgetId",
                table: "BudgetLineItems",
                column: "BudgetId");

            migrationBuilder.CreateIndex(
                name: "IX_BudgetLineItems_CategoryId",
                table: "BudgetLineItems",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_BudgetId",
                table: "Expenses",
                column: "BudgetId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_CategoryId",
                table: "Expenses",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Expenses_PurchaseOrderId",
                table: "Expenses",
                column: "PurchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_FuelTransactions_VehicleId",
                table: "FuelTransactions",
                column: "VehicleId");

            migrationBuilder.CreateIndex(
                name: "IX_MaintenanceAttachments_MaintenanceRecordId",
                table: "MaintenanceAttachments",
                column: "MaintenanceRecordId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_ExpenseId",
                table: "Payments",
                column: "ExpenseId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_PurchaseOrderId",
                table: "Payments",
                column: "PurchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_PodDocuments_DeliveryDate",
                table: "PodDocuments",
                column: "DeliveryDate");

            migrationBuilder.CreateIndex(
                name: "IX_PodDocuments_DriverId",
                table: "PodDocuments",
                column: "DriverId");

            migrationBuilder.CreateIndex(
                name: "IX_PodDocuments_DriverName_DeliveryDate_Region",
                table: "PodDocuments",
                columns: new[] { "DriverName", "DeliveryDate", "Region" });

            migrationBuilder.CreateIndex(
                name: "IX_PodDocuments_InvoiceId",
                table: "PodDocuments",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_PodDocuments_LoadId",
                table: "PodDocuments",
                column: "LoadId");

            migrationBuilder.CreateIndex(
                name: "IX_PodDocuments_Region",
                table: "PodDocuments",
                column: "Region");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrderItems_PurchaseOrderId",
                table: "PurchaseOrderItems",
                column: "PurchaseOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_CategoryId",
                table: "PurchaseOrders",
                column: "CategoryId");

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
                name: "ArtworkAnnotations");

            migrationBuilder.DropTable(
                name: "BookDepartmentAccess");

            migrationBuilder.DropTable(
                name: "BookInvoices");

            migrationBuilder.DropTable(
                name: "BudgetLineItems");

            migrationBuilder.DropTable(
                name: "CarTrackEntries");

            migrationBuilder.DropTable(
                name: "CondomDeliveryRequests");

            migrationBuilder.DropTable(
                name: "CondomProductionSchedules");

            migrationBuilder.DropTable(
                name: "CreditNoteAttachments");

            migrationBuilder.DropTable(
                name: "EmailAccounts");

            migrationBuilder.DropTable(
                name: "FuelTransactions");

            migrationBuilder.DropTable(
                name: "MaintenanceAttachments");

            migrationBuilder.DropTable(
                name: "PadsCreditNotes");

            migrationBuilder.DropTable(
                name: "PadsInvoicesProcessed");

            migrationBuilder.DropTable(
                name: "PadsStockDelivered");

            migrationBuilder.DropTable(
                name: "PadsStockReceived");

            migrationBuilder.DropTable(
                name: "PadsWarehouseStock");

            migrationBuilder.DropTable(
                name: "Payments");

            migrationBuilder.DropTable(
                name: "PodDocuments");

            migrationBuilder.DropTable(
                name: "PurchaseOrderItems");

            migrationBuilder.DropTable(
                name: "ReportCaches");

            migrationBuilder.DropTable(
                name: "TenderReminders");

            migrationBuilder.DropTable(
                name: "TrainingAttachments");

            migrationBuilder.DropTable(
                name: "ArtworkFiles");

            migrationBuilder.DropTable(
                name: "Expenses");

            migrationBuilder.DropTable(
                name: "Budgets");

            migrationBuilder.DropTable(
                name: "PurchaseOrders");

            migrationBuilder.DropTable(
                name: "FinanceCategories");

            migrationBuilder.DropColumn(
                name: "ArtworkStatus",
                table: "Tenders");

            migrationBuilder.DropColumn(
                name: "SamplesStatus",
                table: "Tenders");

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
