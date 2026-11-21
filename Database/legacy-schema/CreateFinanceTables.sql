-- Finance Module Tables
-- Run this to create the remaining Finance tables that weren't created by the migration

USE ProjectTrackerDB;
GO

-- BudgetLineItems
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BudgetLineItems')
BEGIN
    CREATE TABLE [BudgetLineItems] (
        [Id] INT PRIMARY KEY IDENTITY(1,1),
        [BudgetId] INT NOT NULL,
        [Name] NVARCHAR(300) NOT NULL,
        [Description] NVARCHAR(500),
        [CategoryId] INT,
        [AllocatedAmount] DECIMAL(18,2) NOT NULL,
        [SpentAmount] DECIMAL(18,2) NOT NULL,
        [RemainingAmount] DECIMAL(18,2) NOT NULL,
        CONSTRAINT [FK_BudgetLineItems_Budgets_BudgetId] FOREIGN KEY ([BudgetId]) 
            REFERENCES [Budgets] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_BudgetLineItems_FinanceCategories_CategoryId] FOREIGN KEY ([CategoryId]) 
            REFERENCES [FinanceCategories] ([Id]) ON DELETE SET NULL
    );
    PRINT 'Created BudgetLineItems table';
END
GO

-- Expenses
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Expenses')
BEGIN
    CREATE TABLE [Expenses] (
        [Id] INT PRIMARY KEY IDENTITY(1,1),
        [ExpenseNumber] NVARCHAR(50) NOT NULL,
        [Description] NVARCHAR(500) NOT NULL,
        [Vendor] NVARCHAR(300) NOT NULL,
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'Pending',
        [Amount] DECIMAL(18,2) NOT NULL,
        [VatAmount] DECIMAL(18,2),
        [TotalAmount] DECIMAL(18,2) NOT NULL,
        [Currency] NVARCHAR(10) NOT NULL DEFAULT 'ZAR',
        [CategoryId] INT,
        [Department] NVARCHAR(200),
        [ExpenseDate] DATETIME2 NOT NULL,
        [DueDate] DATETIME2,
        [SubmittedBy] NVARCHAR(200),
        [ApprovedBy] NVARCHAR(200),
        [ApprovedDate] DATETIME2,
        [PaymentMethod] NVARCHAR(100),
        [PaymentReference] NVARCHAR(200),
        [InvoiceNumber] NVARCHAR(200),
        [Notes] NVARCHAR(2000),
        [ReceiptPath] NVARCHAR(500),
        [ReceiptFileName] NVARCHAR(255),
        [IsRecurring] BIT NOT NULL DEFAULT 0,
        [RecurrencePattern] NVARCHAR(50),
        [BudgetId] INT,
        [PurchaseOrderId] INT,
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2,
        CONSTRAINT [FK_Expenses_FinanceCategories_CategoryId] FOREIGN KEY ([CategoryId]) 
            REFERENCES [FinanceCategories] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_Expenses_Budgets_BudgetId] FOREIGN KEY ([BudgetId]) 
            REFERENCES [Budgets] ([Id]) ON DELETE SET NULL
    );
    PRINT 'Created Expenses table';
END
GO

-- PurchaseOrders
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PurchaseOrders')
BEGIN
    CREATE TABLE [PurchaseOrders] (
        [Id] INT PRIMARY KEY IDENTITY(1,1),
        [PoNumber] NVARCHAR(50) NOT NULL,
        [SupplierName] NVARCHAR(300) NOT NULL,
        [SupplierContact] NVARCHAR(200),
        [SupplierEmail] NVARCHAR(500),
        [Description] NVARCHAR(1000),
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'Draft',
        [SubTotal] DECIMAL(18,2) NOT NULL,
        [VatAmount] DECIMAL(18,2) NOT NULL,
        [Total] DECIMAL(18,2) NOT NULL,
        [Currency] NVARCHAR(10) NOT NULL DEFAULT 'ZAR',
        [CategoryId] INT,
        [Department] NVARCHAR(200),
        [OrderDate] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [ExpectedDeliveryDate] DATETIME2,
        [ReceivedDate] DATETIME2,
        [RequestedBy] NVARCHAR(200),
        [ApprovedBy] NVARCHAR(200),
        [ApprovedDate] DATETIME2,
        [Notes] NVARCHAR(2000),
        [DeliveryAddress] NVARCHAR(500),
        [AttachmentPath] NVARCHAR(500),
        [AttachmentFileName] NVARCHAR(255),
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2,
        CONSTRAINT [FK_PurchaseOrders_FinanceCategories_CategoryId] FOREIGN KEY ([CategoryId]) 
            REFERENCES [FinanceCategories] ([Id]) ON DELETE SET NULL
    );
    PRINT 'Created PurchaseOrders table';
END
GO

-- Add FK from Expenses to PurchaseOrders (deferred until PurchaseOrders exists)
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Expenses') AND 
   EXISTS (SELECT * FROM sys.tables WHERE name = 'PurchaseOrders') AND
   NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_Expenses_PurchaseOrders_PurchaseOrderId')
BEGIN
    ALTER TABLE [Expenses]
    ADD CONSTRAINT [FK_Expenses_PurchaseOrders_PurchaseOrderId] FOREIGN KEY ([PurchaseOrderId]) 
        REFERENCES [PurchaseOrders] ([Id]) ON DELETE SET NULL;
    PRINT 'Added FK_Expenses_PurchaseOrders_PurchaseOrderId';
END
GO

-- PurchaseOrderItems
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PurchaseOrderItems')
BEGIN
    CREATE TABLE [PurchaseOrderItems] (
        [Id] INT PRIMARY KEY IDENTITY(1,1),
        [PurchaseOrderId] INT NOT NULL,
        [Description] NVARCHAR(500) NOT NULL,
        [ProductCode] NVARCHAR(100),
        [Quantity] DECIMAL(18,4) NOT NULL,
        [Unit] NVARCHAR(50),
        [UnitPrice] DECIMAL(18,2) NOT NULL,
        [LineTotal] DECIMAL(18,2) NOT NULL,
        [ReceivedQuantity] DECIMAL(18,4),
        CONSTRAINT [FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderId] FOREIGN KEY ([PurchaseOrderId]) 
            REFERENCES [PurchaseOrders] ([Id]) ON DELETE CASCADE
    );
    PRINT 'Created PurchaseOrderItems table';
END
GO

-- Payments
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Payments')
BEGIN
    CREATE TABLE [Payments] (
        [Id] INT PRIMARY KEY IDENTITY(1,1),
        [PaymentNumber] NVARCHAR(50) NOT NULL,
        [PaymentType] NVARCHAR(50) NOT NULL DEFAULT 'Expense',
        [ExpenseId] INT,
        [PurchaseOrderId] INT,
        [BookInvoiceId] INT,
        [Payee] NVARCHAR(300) NOT NULL,
        [Description] NVARCHAR(500),
        [Amount] DECIMAL(18,2) NOT NULL,
        [Currency] NVARCHAR(10) NOT NULL DEFAULT 'ZAR',
        [Status] NVARCHAR(50) NOT NULL DEFAULT 'Pending',
        [PaymentMethod] NVARCHAR(100) NOT NULL DEFAULT 'EFT',
        [PaymentReference] NVARCHAR(200),
        [BankReference] NVARCHAR(200),
        [PaymentDate] DATETIME2 NOT NULL,
        [ProcessedDate] DATETIME2,
        [ProcessedBy] NVARCHAR(200),
        [ApprovedBy] NVARCHAR(200),
        [ApprovedDate] DATETIME2,
        [BankName] NVARCHAR(200),
        [AccountNumber] NVARCHAR(50),
        [BranchCode] NVARCHAR(50),
        [Notes] NVARCHAR(2000),
        [ProofPath] NVARCHAR(500),
        [ProofFileName] NVARCHAR(255),
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [UpdatedAt] DATETIME2,
        CONSTRAINT [FK_Payments_Expenses_ExpenseId] FOREIGN KEY ([ExpenseId]) 
            REFERENCES [Expenses] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_Payments_PurchaseOrders_PurchaseOrderId] FOREIGN KEY ([PurchaseOrderId]) 
            REFERENCES [PurchaseOrders] ([Id]) ON DELETE SET NULL
    );
    PRINT 'Created Payments table';
END
GO

PRINT 'Finance module tables created successfully!';
