-- ============================================================================
-- Expense Tracker for Books Module
-- Tracks monthly expenses per department with categories, types, and
-- optional link to an uploaded BookInvoice.
-- Finance Department can view all departments.
-- ============================================================================

-- ── 1. Expense Categories (per-department, flexible add/remove) ──────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ExpenseCategories')
BEGIN
    CREATE TABLE ExpenseCategories (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        DepartmentId INT NOT NULL,             -- 0 = global/shared
        Name        NVARCHAR(200) NOT NULL,
        Color       NVARCHAR(20)  NOT NULL DEFAULT '#2563eb',
        IsActive    BIT           NOT NULL DEFAULT 1,
        CreatedAt   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2     NULL,
        CONSTRAINT FK_ExpCat_Dept FOREIGN KEY (DepartmentId) REFERENCES Departments(DepartmentId)
    );
    -- Seed global categories (DepartmentId = 0 — not FK'd, just convention)
    -- Drop the FK and re-add allowing 0 for global
    ALTER TABLE ExpenseCategories DROP CONSTRAINT FK_ExpCat_Dept;
    CREATE INDEX IX_ExpCat_Dept ON ExpenseCategories (DepartmentId);

    INSERT INTO ExpenseCategories (DepartmentId, Name, Color) VALUES
        (0, 'Software / Licensing',  '#6366f1'),
        (0, 'Hardware',              '#0ea5e9'),
        (0, 'Maintenance & Repairs', '#f59e0b'),
        (0, 'Telecommunications',    '#10b981'),
        (0, 'Office Supplies',       '#ec4899'),
        (0, 'Professional Services', '#8b5cf6'),
        (0, 'Utilities',             '#64748b'),
        (0, 'Fuel & Travel',         '#ef4444'),
        (0, 'Insurance',             '#0d9488'),
        (0, 'Rent / Lease',          '#7c3aed');

    PRINT 'ExpenseCategories table created and seeded.';
END
ELSE
    PRINT 'ExpenseCategories table already exists.';

-- ── 2. Expense Tracker Items ─────────────────────────────────────────────────
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ExpenseTrackerItems')
BEGIN
    CREATE TABLE ExpenseTrackerItems (
        Id              INT IDENTITY(1,1) PRIMARY KEY,

        -- Ownership
        DepartmentId    INT           NOT NULL,
        CategoryId      INT           NULL,     -- FK to ExpenseCategories

        -- Period
        Month           TINYINT       NOT NULL, -- 1-12
        Year            SMALLINT      NOT NULL,

        -- Type
        ItemType        NVARCHAR(50)  NOT NULL DEFAULT 'Service',  -- 'PurchaseOrder' | 'Service'

        -- Core columns (the 7 required fields)
        Company         NVARCHAR(500) NOT NULL,
        ServicesRendered NVARCHAR(1000) NOT NULL,
        InvoicedTo      NVARCHAR(500) NOT NULL,
        Amount          DECIMAL(18,2) NOT NULL DEFAULT 0,
        PaidBy          NVARCHAR(300) NULL,
        InvoiceNumber   NVARCHAR(200) NULL,
        ItemDate        DATETIME2     NOT NULL,

        -- Status
        Status          NVARCHAR(50)  NOT NULL DEFAULT 'Pending',  -- 'Pending' | 'Paid' | 'Cancelled'

        -- Optional link to uploaded BookInvoice
        BookInvoiceId   INT           NULL,     -- FK to BookInvoices

        -- Extras
        Notes           NVARCHAR(2000) NULL,
        VatAmount       DECIMAL(18,2) NULL,
        Currency        NVARCHAR(10)  NOT NULL DEFAULT 'ZAR',

        -- Audit
        CreatedAt       DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt       DATETIME2     NULL,
        CreatedBy       NVARCHAR(200) NULL,

        CONSTRAINT FK_ExpItem_Dept   FOREIGN KEY (DepartmentId) REFERENCES Departments(DepartmentId),
        CONSTRAINT FK_ExpItem_Cat    FOREIGN KEY (CategoryId)   REFERENCES ExpenseCategories(Id),
        CONSTRAINT FK_ExpItem_Invoice FOREIGN KEY (BookInvoiceId) REFERENCES BookInvoices(Id)
    );

    CREATE INDEX IX_ExpItem_Dept_Period   ON ExpenseTrackerItems (DepartmentId, Year, Month);
    CREATE INDEX IX_ExpItem_Category      ON ExpenseTrackerItems (CategoryId);
    CREATE INDEX IX_ExpItem_BookInvoice   ON ExpenseTrackerItems (BookInvoiceId);

    PRINT 'ExpenseTrackerItems table created.';
END
ELSE
    PRINT 'ExpenseTrackerItems table already exists.';
