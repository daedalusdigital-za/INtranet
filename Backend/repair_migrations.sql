SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    ALTER TABLE [Tenders] ADD [ArtworkStatus] nvarchar(30) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    ALTER TABLE [Tenders] ADD [SamplesStatus] nvarchar(30) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    IF COL_LENGTH('ImportedInvoices', 'DeliveryDeadline') IS NULL
    ALTER TABLE [ImportedInvoices] ADD [DeliveryDeadline] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    IF COL_LENGTH('ImportedInvoices', 'DeliveryPriority') IS NULL
    ALTER TABLE [ImportedInvoices] ADD [DeliveryPriority] nvarchar(20) NOT NULL DEFAULT N'';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [ArtworkFiles] (
        [Id] int NOT NULL IDENTITY,
        [FileName] nvarchar(300) NOT NULL,
        [FilePath] nvarchar(500) NULL,
        [FileType] nvarchar(20) NOT NULL,
        [FileSize] bigint NOT NULL,
        [MimeType] nvarchar(100) NULL,
        [CompanyCode] nvarchar(10) NOT NULL,
        [Category] nvarchar(50) NOT NULL,
        [TenderId] int NULL,
        [TenderNumber] nvarchar(50) NULL,
        [Notes] nvarchar(1000) NULL,
        [UploadedByUserId] int NULL,
        [UploadedByUserName] nvarchar(100) NULL,
        [UploadedAt] datetime2 NOT NULL,
        [SentToMarketing] bit NOT NULL,
        [SentToMarketingAt] datetime2 NULL,
        [SentToMarketingRecipients] nvarchar(500) NULL,
        [SentToMarketingPriority] nvarchar(20) NULL,
        [SentToMarketingMessage] nvarchar(2000) NULL,
        [SentToMarketingRequestedBy] datetime2 NULL,
        [SentToMarketingRequestedByUser] nvarchar(100) NULL,
        CONSTRAINT [PK_ArtworkFiles] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ArtworkFiles_Tenders_TenderId] FOREIGN KEY ([TenderId]) REFERENCES [Tenders] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [BookDepartmentAccess] (
        [Id] int NOT NULL IDENTITY,
        [DepartmentId] int NOT NULL,
        [DepartmentName] nvarchar(200) NOT NULL,
        [Password] nvarchar(100) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_BookDepartmentAccess] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_BookDepartmentAccess_Departments_DepartmentId] FOREIGN KEY ([DepartmentId]) REFERENCES [Departments] ([DepartmentId]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [BookInvoices] (
        [Id] int NOT NULL IDENTITY,
        [SupplierName] nvarchar(500) NOT NULL,
        [SupplierAccount] nvarchar(200) NULL,
        [InvoiceNumber] nvarchar(200) NULL,
        [InvoiceDate] datetime2 NOT NULL,
        [Total] decimal(18,2) NOT NULL,
        [VatAmount] decimal(18,2) NULL,
        [SubTotal] decimal(18,2) NULL,
        [Currency] nvarchar(10) NOT NULL,
        [PaymentDate] datetime2 NULL,
        [PaymentMethod] nvarchar(100) NULL,
        [PaymentReference] nvarchar(200) NULL,
        [Category] nvarchar(200) NULL,
        [CompanyName] nvarchar(200) NULL,
        [Description] nvarchar(1000) NULL,
        [Notes] nvarchar(2000) NULL,
        [FilePath] nvarchar(500) NOT NULL,
        [FileName] nvarchar(255) NOT NULL,
        [OriginalFileName] nvarchar(255) NULL,
        [ContentType] nvarchar(100) NOT NULL,
        [FileSize] bigint NOT NULL,
        [FileHash] nvarchar(64) NULL,
        [ExtractedText] nvarchar(max) NULL,
        [Status] nvarchar(50) NOT NULL,
        [DepartmentId] int NOT NULL,
        [UploadedByUserId] int NOT NULL,
        [UploadedByName] nvarchar(200) NULL,
        [ConfirmedByUserId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        [ConfirmedAt] datetime2 NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_BookInvoices] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_BookInvoices_Departments_DepartmentId] FOREIGN KEY ([DepartmentId]) REFERENCES [Departments] ([DepartmentId]) ON DELETE CASCADE,
        CONSTRAINT [FK_BookInvoices_Users_ConfirmedByUserId] FOREIGN KEY ([ConfirmedByUserId]) REFERENCES [Users] ([UserId]),
        CONSTRAINT [FK_BookInvoices_Users_UploadedByUserId] FOREIGN KEY ([UploadedByUserId]) REFERENCES [Users] ([UserId]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [Budgets] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(200) NOT NULL,
        [Description] nvarchar(1000) NULL,
        [FiscalYear] nvarchar(20) NOT NULL,
        [Period] nvarchar(20) NULL,
        [Department] nvarchar(200) NULL,
        [Status] nvarchar(50) NOT NULL,
        [TotalBudget] decimal(18,2) NOT NULL,
        [AllocatedAmount] decimal(18,2) NOT NULL,
        [SpentAmount] decimal(18,2) NOT NULL,
        [RemainingAmount] decimal(18,2) NOT NULL,
        [Currency] nvarchar(10) NOT NULL,
        [StartDate] datetime2 NOT NULL,
        [EndDate] datetime2 NOT NULL,
        [CreatedBy] nvarchar(200) NULL,
        [ApprovedBy] nvarchar(200) NULL,
        [ApprovedDate] datetime2 NULL,
        [Notes] nvarchar(2000) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_Budgets] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [CarTrackEntries] (
        [Id] int NOT NULL IDENTITY,
        [SalesRepName] nvarchar(150) NOT NULL,
        [RegistrationNumber] nvarchar(20) NULL,
        [Location] nvarchar(250) NOT NULL,
        [Province] nvarchar(100) NULL,
        [Purpose] nvarchar(500) NULL,
        [ClientVisited] nvarchar(200) NULL,
        [VisitDate] datetime2 NOT NULL,
        [TimeArrived] time NULL,
        [TimeDeparted] time NULL,
        [KilometerStart] float NULL,
        [KilometerEnd] float NULL,
        [Notes] nvarchar(1000) NULL,
        [Status] nvarchar(50) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        [CreatedByUserId] int NULL,
        CONSTRAINT [PK_CarTrackEntries] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [CondomDeliveryRequests] (
        [Id] int NOT NULL IDENTITY,
        [ReferenceNumber] nvarchar(50) NOT NULL,
        [Department] nvarchar(50) NOT NULL,
        [Scent] nvarchar(50) NULL,
        [Type] nvarchar(20) NULL,
        [BatchCode] nvarchar(30) NULL,
        [InvoiceNumber] nvarchar(100) NULL,
        [Description] nvarchar(200) NOT NULL,
        [Quantity] int NOT NULL,
        [UOM] nvarchar(20) NOT NULL,
        [DeliveryAddress] nvarchar(200) NULL,
        [Notes] nvarchar(500) NULL,
        [Priority] nvarchar(20) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [RequestedDate] datetime2 NOT NULL,
        [RequestedBy] nvarchar(100) NULL,
        [ApprovedDate] datetime2 NULL,
        [DeliveredDate] datetime2 NULL,
        [HandledBy] nvarchar(100) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_CondomDeliveryRequests] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [CondomProductionSchedules] (
        [Id] int NOT NULL IDENTITY,
        [Scent] nvarchar(50) NOT NULL,
        [Type] nvarchar(20) NOT NULL,
        [BatchCode] nvarchar(30) NOT NULL,
        [UOM] nvarchar(20) NOT NULL,
        [ScheduleDate] datetime2 NOT NULL,
        [Quantity] int NOT NULL,
        [QuantityNote] nvarchar(50) NULL,
        [ScentGroup] nvarchar(20) NULL,
        [SortOrder] int NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_CondomProductionSchedules] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [CreditNoteAttachments] (
        [Id] int NOT NULL IDENTITY,
        [CreditNoteId] int NOT NULL,
        [CreditNoteNumber] nvarchar(100) NULL,
        [FileName] nvarchar(500) NOT NULL,
        [StoredFileName] nvarchar(500) NOT NULL,
        [ContentType] nvarchar(100) NULL,
        [FileSize] bigint NOT NULL,
        [UploadedBy] nvarchar(200) NULL,
        [UploadedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_CreditNoteAttachments] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [EmailAccounts] (
        [EmailAccountId] int NOT NULL IDENTITY,
        [Email] nvarchar(255) NOT NULL,
        [Password] nvarchar(500) NOT NULL,
        [DisplayName] nvarchar(100) NULL,
        [Department] nvarchar(255) NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_EmailAccounts] PRIMARY KEY ([EmailAccountId])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [FinanceCategories] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(200) NOT NULL,
        [Description] nvarchar(500) NULL,
        [Type] nvarchar(50) NOT NULL,
        [Code] nvarchar(50) NULL,
        [ParentCategoryId] int NULL,
        [IsActive] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_FinanceCategories] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    IF OBJECT_ID('FuelTransactions') IS NULL
    CREATE TABLE [FuelTransactions] (
        [Id] int NOT NULL IDENTITY,
        [VehicleId] int NULL,
        [RegistrationNumber] nvarchar(50) NOT NULL,
        [CardNumber] nvarchar(50) NULL,
        [DepotName] nvarchar(200) NULL,
        [AllocationLitres] decimal(18,2) NOT NULL,
        [LitresUsed] decimal(18,2) NOT NULL,
        [TransactionDate] datetime2 NOT NULL,
        [AmountSpent] decimal(18,2) NOT NULL,
        [DepotAssignment] nvarchar(100) NULL,
        [ReportMonth] int NOT NULL,
        [ReportYear] int NOT NULL,
        [Notes] nvarchar(500) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_FuelTransactions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FuelTransactions_Vehicles_VehicleId] FOREIGN KEY ([VehicleId]) REFERENCES [Vehicles] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [MaintenanceAttachments] (
        [Id] int NOT NULL IDENTITY,
        [MaintenanceRecordId] int NOT NULL,
        [FileName] nvarchar(500) NOT NULL,
        [StoredFileName] nvarchar(500) NOT NULL,
        [ContentType] nvarchar(100) NULL,
        [FileSize] bigint NOT NULL,
        [UploadedBy] nvarchar(200) NULL,
        [VehicleRegistration] nvarchar(50) NULL,
        [UploadedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_MaintenanceAttachments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_MaintenanceAttachments_VehicleMaintenance_MaintenanceRecordId] FOREIGN KEY ([MaintenanceRecordId]) REFERENCES [VehicleMaintenance] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [PadsCreditNotes] (
        [Id] int NOT NULL IDENTITY,
        [CreditNoteNumber] nvarchar(100) NOT NULL,
        [CreditDate] datetime2 NOT NULL,
        [Description] nvarchar(500) NULL,
        [Amount] decimal(18,2) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_PadsCreditNotes] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [PadsInvoicesProcessed] (
        [Id] int NOT NULL IDENTITY,
        [InvoiceReference] nvarchar(100) NOT NULL,
        [InvoiceDate] datetime2 NOT NULL,
        [Description] nvarchar(500) NULL,
        [Amount] decimal(18,2) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_PadsInvoicesProcessed] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [PadsStockDelivered] (
        [Id] int NOT NULL IDENTITY,
        [DeliveryReference] nvarchar(100) NULL,
        [InvoiceNumber] nvarchar(100) NULL,
        [QuantityDelivered] int NOT NULL,
        [UOM] nvarchar(20) NOT NULL,
        [Quarter] int NOT NULL,
        [DeliveryDate] datetime2 NOT NULL,
        [Notes] nvarchar(500) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_PadsStockDelivered] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [PadsStockReceived] (
        [Id] int NOT NULL IDENTITY,
        [VendorName] nvarchar(200) NOT NULL,
        [GrnNumber] nvarchar(50) NOT NULL,
        [ItemCode] nvarchar(50) NULL,
        [ItemDescription] nvarchar(200) NOT NULL,
        [Reference] nvarchar(100) NULL,
        [InvoiceNumber] nvarchar(100) NULL,
        [Location] nvarchar(50) NULL,
        [InvoiceDate] datetime2 NOT NULL,
        [UOM] nvarchar(20) NOT NULL,
        [QuantityReceived] int NOT NULL,
        [UnitCost] decimal(18,2) NOT NULL,
        [SubTotal] decimal(18,2) NOT NULL,
        [Quarter] int NULL,
        [Notes] nvarchar(500) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_PadsStockReceived] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [PadsWarehouseStock] (
        [Id] int NOT NULL IDENTITY,
        [WarehouseName] nvarchar(100) NOT NULL,
        [StockType] nvarchar(20) NOT NULL,
        [Quantity] int NOT NULL,
        [UOM] nvarchar(20) NOT NULL,
        [IsDamaged] bit NOT NULL,
        [Notes] nvarchar(500) NULL,
        [SnapshotDate] datetime2 NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_PadsWarehouseStock] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [PodDocuments] (
        [Id] int NOT NULL IDENTITY,
        [DriverId] int NULL,
        [DriverName] nvarchar(100) NOT NULL,
        [DeliveryDate] datetime2 NOT NULL,
        [Region] nvarchar(20) NOT NULL,
        [FilePath] nvarchar(500) NOT NULL,
        [FileName] nvarchar(255) NOT NULL,
        [OriginalFileName] nvarchar(255) NULL,
        [ContentType] nvarchar(20) NULL,
        [FileSize] bigint NOT NULL,
        [Notes] nvarchar(1000) NULL,
        [UploadedAt] datetime2 NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [LoadId] int NULL,
        [InvoiceId] int NULL,
        CONSTRAINT [PK_PodDocuments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PodDocuments_Drivers_DriverId] FOREIGN KEY ([DriverId]) REFERENCES [Drivers] ([Id]),
        CONSTRAINT [FK_PodDocuments_ImportedInvoices_InvoiceId] FOREIGN KEY ([InvoiceId]) REFERENCES [ImportedInvoices] ([Id]),
        CONSTRAINT [FK_PodDocuments_Loads_LoadId] FOREIGN KEY ([LoadId]) REFERENCES [Loads] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [ReportCaches] (
        [Id] int NOT NULL IDENTITY,
        [CacheKey] nvarchar(64) NOT NULL,
        [ReportType] nvarchar(50) NOT NULL,
        [FromDate] datetime2 NOT NULL,
        [ToDate] datetime2 NOT NULL,
        [Parameters] nvarchar(500) NULL,
        [ResultJson] nvarchar(max) NOT NULL,
        [GeneratedAt] datetime2 NOT NULL,
        [ExpiresAt] datetime2 NOT NULL,
        [GenerationTimeMs] int NOT NULL,
        [HitCount] int NOT NULL,
        [LastAccessedAt] datetime2 NULL,
        [ResultSizeBytes] bigint NOT NULL,
        [GeneratedBy] nvarchar(100) NULL,
        CONSTRAINT [PK_ReportCaches] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [TenderReminders] (
        [Id] int NOT NULL IDENTITY,
        [TenderId] int NOT NULL,
        [EventType] nvarchar(50) NOT NULL,
        [EventDate] datetime2 NOT NULL,
        [DaysBefore] int NOT NULL,
        [EmailRecipients] nvarchar(1000) NULL,
        [Notes] nvarchar(500) NULL,
        [IsSent] bit NOT NULL,
        [SentAt] datetime2 NULL,
        [IsActive] bit NOT NULL,
        [CreatedByUserId] int NOT NULL,
        [CreatedByUserName] nvarchar(100) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TenderReminders] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_TenderReminders_Tenders_TenderId] FOREIGN KEY ([TenderId]) REFERENCES [Tenders] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [TrainingAttachments] (
        [Id] int NOT NULL IDENTITY,
        [TrainingSessionId] int NOT NULL,
        [TrainingName] nvarchar(300) NULL,
        [FileName] nvarchar(500) NOT NULL,
        [StoredFileName] nvarchar(500) NOT NULL,
        [ContentType] nvarchar(100) NULL,
        [FileSize] bigint NOT NULL,
        [UploadedBy] nvarchar(200) NULL,
        [UploadedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_TrainingAttachments] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [ArtworkAnnotations] (
        [Id] int NOT NULL IDENTITY,
        [ArtworkFileId] int NOT NULL,
        [Type] nvarchar(20) NOT NULL,
        [X] float NOT NULL,
        [Y] float NOT NULL,
        [Text] nvarchar(2000) NULL,
        [Color] nvarchar(20) NOT NULL,
        [CreatedByUserId] int NULL,
        [CreatedByUserName] nvarchar(100) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ArtworkAnnotations] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ArtworkAnnotations_ArtworkFiles_ArtworkFileId] FOREIGN KEY ([ArtworkFileId]) REFERENCES [ArtworkFiles] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [BudgetLineItems] (
        [Id] int NOT NULL IDENTITY,
        [BudgetId] int NOT NULL,
        [Name] nvarchar(300) NOT NULL,
        [Description] nvarchar(500) NULL,
        [CategoryId] int NULL,
        [AllocatedAmount] decimal(18,2) NOT NULL,
        [SpentAmount] decimal(18,2) NOT NULL,
        [RemainingAmount] decimal(18,2) NOT NULL,
        CONSTRAINT [PK_BudgetLineItems] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_BudgetLineItems_Budgets_BudgetId] FOREIGN KEY ([BudgetId]) REFERENCES [Budgets] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_BudgetLineItems_FinanceCategories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [FinanceCategories] ([Id]) ON DELETE SET NULL
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [PurchaseOrders] (
        [Id] int NOT NULL IDENTITY,
        [PoNumber] nvarchar(50) NOT NULL,
        [SupplierName] nvarchar(300) NOT NULL,
        [SupplierContact] nvarchar(200) NULL,
        [SupplierEmail] nvarchar(500) NULL,
        [Description] nvarchar(1000) NULL,
        [Status] nvarchar(50) NOT NULL,
        [SubTotal] decimal(18,2) NOT NULL,
        [VatAmount] decimal(18,2) NOT NULL,
        [Total] decimal(18,2) NOT NULL,
        [Currency] nvarchar(10) NOT NULL,
        [CategoryId] int NULL,
        [Department] nvarchar(200) NULL,
        [OrderDate] datetime2 NOT NULL,
        [ExpectedDeliveryDate] datetime2 NULL,
        [ReceivedDate] datetime2 NULL,
        [RequestedBy] nvarchar(200) NULL,
        [ApprovedBy] nvarchar(200) NULL,
        [ApprovedDate] datetime2 NULL,
        [Notes] nvarchar(2000) NULL,
        [DeliveryAddress] nvarchar(500) NULL,
        [AttachmentPath] nvarchar(500) NULL,
        [AttachmentFileName] nvarchar(255) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_PurchaseOrders] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PurchaseOrders_FinanceCategories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [FinanceCategories] ([Id]) ON DELETE SET NULL
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [Expenses] (
        [Id] int NOT NULL IDENTITY,
        [ExpenseNumber] nvarchar(50) NOT NULL,
        [Description] nvarchar(500) NOT NULL,
        [Vendor] nvarchar(300) NOT NULL,
        [Status] nvarchar(50) NOT NULL,
        [Amount] decimal(18,2) NOT NULL,
        [VatAmount] decimal(18,2) NULL,
        [TotalAmount] decimal(18,2) NOT NULL,
        [Currency] nvarchar(10) NOT NULL,
        [CategoryId] int NULL,
        [Department] nvarchar(200) NULL,
        [ExpenseDate] datetime2 NOT NULL,
        [DueDate] datetime2 NULL,
        [SubmittedBy] nvarchar(200) NULL,
        [ApprovedBy] nvarchar(200) NULL,
        [ApprovedDate] datetime2 NULL,
        [PaymentMethod] nvarchar(100) NULL,
        [PaymentReference] nvarchar(200) NULL,
        [InvoiceNumber] nvarchar(200) NULL,
        [Notes] nvarchar(2000) NULL,
        [ReceiptPath] nvarchar(500) NULL,
        [ReceiptFileName] nvarchar(255) NULL,
        [IsRecurring] bit NOT NULL,
        [RecurrencePattern] nvarchar(50) NULL,
        [BudgetId] int NULL,
        [PurchaseOrderId] int NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_Expenses] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Expenses_Budgets_BudgetId] FOREIGN KEY ([BudgetId]) REFERENCES [Budgets] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_Expenses_FinanceCategories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [FinanceCategories] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_Expenses_PurchaseOrders_PurchaseOrderId] FOREIGN KEY ([PurchaseOrderId]) REFERENCES [PurchaseOrders] ([Id]) ON DELETE SET NULL
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [PurchaseOrderItems] (
        [Id] int NOT NULL IDENTITY,
        [PurchaseOrderId] int NOT NULL,
        [Description] nvarchar(500) NOT NULL,
        [ProductCode] nvarchar(100) NULL,
        [Quantity] decimal(18,4) NOT NULL,
        [Unit] nvarchar(50) NULL,
        [UnitPrice] decimal(18,2) NOT NULL,
        [LineTotal] decimal(18,2) NOT NULL,
        [ReceivedQuantity] decimal(18,4) NULL,
        CONSTRAINT [PK_PurchaseOrderItems] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderId] FOREIGN KEY ([PurchaseOrderId]) REFERENCES [PurchaseOrders] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE TABLE [Payments] (
        [Id] int NOT NULL IDENTITY,
        [PaymentNumber] nvarchar(50) NOT NULL,
        [PaymentType] nvarchar(50) NOT NULL,
        [ExpenseId] int NULL,
        [PurchaseOrderId] int NULL,
        [BookInvoiceId] int NULL,
        [Payee] nvarchar(300) NOT NULL,
        [Description] nvarchar(500) NULL,
        [Amount] decimal(18,2) NOT NULL,
        [Currency] nvarchar(10) NOT NULL,
        [Status] nvarchar(50) NOT NULL,
        [PaymentMethod] nvarchar(100) NOT NULL,
        [PaymentReference] nvarchar(200) NULL,
        [BankReference] nvarchar(200) NULL,
        [PaymentDate] datetime2 NOT NULL,
        [ProcessedDate] datetime2 NULL,
        [ProcessedBy] nvarchar(200) NULL,
        [ApprovedBy] nvarchar(200) NULL,
        [ApprovedDate] datetime2 NULL,
        [BankName] nvarchar(200) NULL,
        [AccountNumber] nvarchar(50) NULL,
        [BranchCode] nvarchar(50) NULL,
        [Notes] nvarchar(2000) NULL,
        [ProofPath] nvarchar(500) NULL,
        [ProofFileName] nvarchar(255) NULL,
        [CreatedAt] datetime2 NOT NULL,
        [UpdatedAt] datetime2 NULL,
        CONSTRAINT [PK_Payments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Payments_Expenses_ExpenseId] FOREIGN KEY ([ExpenseId]) REFERENCES [Expenses] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_Payments_PurchaseOrders_PurchaseOrderId] FOREIGN KEY ([PurchaseOrderId]) REFERENCES [PurchaseOrders] ([Id]) ON DELETE SET NULL
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_ArtworkAnnotations_ArtworkFileId] ON [ArtworkAnnotations] ([ArtworkFileId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_ArtworkFiles_TenderId] ON [ArtworkFiles] ([TenderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_BookDepartmentAccess_DepartmentId] ON [BookDepartmentAccess] ([DepartmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_BookInvoices_ConfirmedByUserId] ON [BookInvoices] ([ConfirmedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_BookInvoices_DepartmentId] ON [BookInvoices] ([DepartmentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_BookInvoices_UploadedByUserId] ON [BookInvoices] ([UploadedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_BudgetLineItems_BudgetId] ON [BudgetLineItems] ([BudgetId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_BudgetLineItems_CategoryId] ON [BudgetLineItems] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_Expenses_BudgetId] ON [Expenses] ([BudgetId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_Expenses_CategoryId] ON [Expenses] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_Expenses_PurchaseOrderId] ON [Expenses] ([PurchaseOrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    IF INDEXPROPERTY(OBJECT_ID('FuelTransactions'), 'IX_FuelTransactions_VehicleId', 'IndexID') IS NULL
    CREATE INDEX [IX_FuelTransactions_VehicleId] ON [FuelTransactions] ([VehicleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_MaintenanceAttachments_MaintenanceRecordId] ON [MaintenanceAttachments] ([MaintenanceRecordId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_Payments_ExpenseId] ON [Payments] ([ExpenseId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_Payments_PurchaseOrderId] ON [Payments] ([PurchaseOrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_PodDocuments_DeliveryDate] ON [PodDocuments] ([DeliveryDate]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_PodDocuments_DriverId] ON [PodDocuments] ([DriverId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_PodDocuments_DriverName_DeliveryDate_Region] ON [PodDocuments] ([DriverName], [DeliveryDate], [Region]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_PodDocuments_InvoiceId] ON [PodDocuments] ([InvoiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_PodDocuments_LoadId] ON [PodDocuments] ([LoadId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_PodDocuments_Region] ON [PodDocuments] ([Region]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_PurchaseOrderItems_PurchaseOrderId] ON [PurchaseOrderItems] ([PurchaseOrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_PurchaseOrders_CategoryId] ON [PurchaseOrders] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ReportCaches_CacheKey] ON [ReportCaches] ([CacheKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_ReportCaches_ExpiresAt] ON [ReportCaches] ([ExpiresAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_ReportCaches_ReportType_FromDate_ToDate] ON [ReportCaches] ([ReportType], [FromDate], [ToDate]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    CREATE INDEX [IX_TenderReminders_TenderId] ON [TenderReminders] ([TenderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260401122120_AddFinanceModule'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260401122120_AddFinanceModule', N'10.0.1');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    ALTER TABLE [SleepOuts] ADD [TripNumber] nvarchar(100) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    ALTER TABLE [SleepOuts] ADD [TripSheetId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    ALTER TABLE [SleepOuts] ADD [VehicleReg] nvarchar(50) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    ALTER TABLE [SalesTransactionStagings] ADD [ProductCode] nvarchar(100) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    ALTER TABLE [SalesTransactionStagings] ADD [ProductDescription] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    CREATE TABLE [CallRecords] (
        [Id] bigint NOT NULL IDENTITY,
        [AccountCode] nvarchar(50) NULL,
        [CallerNumber] nvarchar(50) NOT NULL,
        [CallerNat] nvarchar(10) NULL,
        [CalleeNumber] nvarchar(50) NOT NULL,
        [CalleeNat] nvarchar(10) NULL,
        [Context] nvarchar(100) NULL,
        [CallerId] nvarchar(500) NULL,
        [SourceChannel] nvarchar(200) NULL,
        [DestChannel] nvarchar(200) NULL,
        [LastApp] nvarchar(100) NULL,
        [LastData] nvarchar(500) NULL,
        [StartTime] datetime2 NOT NULL,
        [AnswerTime] datetime2 NULL,
        [EndTime] datetime2 NULL,
        [CallTime] int NOT NULL,
        [TalkTime] int NOT NULL,
        [CallStatus] nvarchar(20) NOT NULL,
        [AmaFlags] nvarchar(50) NULL,
        [UniqueId] nvarchar(100) NULL,
        [CallType] nvarchar(20) NOT NULL,
        [DestChannelExtension] nvarchar(100) NULL,
        [CallerName] nvarchar(200) NULL,
        [AnsweredBy] nvarchar(200) NULL,
        [Session] nvarchar(200) NULL,
        [PremierCaller] nvarchar(100) NULL,
        [ActionType] nvarchar(50) NULL,
        [SourceTrunkName] nvarchar(200) NULL,
        [DestinationTrunkName] nvarchar(200) NULL,
        CONSTRAINT [PK_CallRecords] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    CREATE TABLE [PodDocumentInvoiceLinks] (
        [Id] int NOT NULL IDENTITY,
        [PodDocumentId] int NOT NULL,
        [InvoiceId] int NOT NULL,
        [LinkedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_PodDocumentInvoiceLinks] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PodDocumentInvoiceLinks_ImportedInvoices_InvoiceId] FOREIGN KEY ([InvoiceId]) REFERENCES [ImportedInvoices] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_PodDocumentInvoiceLinks_PodDocuments_PodDocumentId] FOREIGN KEY ([PodDocumentId]) REFERENCES [PodDocuments] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    CREATE INDEX [IX_PodDocumentInvoiceLinks_InvoiceId] ON [PodDocumentInvoiceLinks] ([InvoiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    CREATE INDEX [IX_PodDocumentInvoiceLinks_PodDocumentId] ON [PodDocumentInvoiceLinks] ([PodDocumentId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PodDocumentInvoiceLinks_PodDocumentId_InvoiceId] ON [PodDocumentInvoiceLinks] ([PodDocumentId], [InvoiceId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260421124411_AddPodDocumentInvoiceLinkTable'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260421124411_AddPodDocumentInvoiceLinkTable', N'10.0.1');
END;

COMMIT;
GO

