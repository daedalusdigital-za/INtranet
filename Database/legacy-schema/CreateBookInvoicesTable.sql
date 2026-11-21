-- Create BookInvoices table for the Books module (paid invoice management)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'BookInvoices')
BEGIN
    CREATE TABLE BookInvoices (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        SupplierName NVARCHAR(500) NOT NULL,
        SupplierAccount NVARCHAR(200) NULL,
        InvoiceNumber NVARCHAR(200) NULL,
        InvoiceDate DATETIME2 NOT NULL,
        Total DECIMAL(18,2) NOT NULL DEFAULT 0,
        VatAmount DECIMAL(18,2) NULL,
        SubTotal DECIMAL(18,2) NULL,
        Currency NVARCHAR(10) NOT NULL DEFAULT 'ZAR',
        PaymentDate DATETIME2 NULL,
        PaymentMethod NVARCHAR(100) NULL,
        PaymentReference NVARCHAR(200) NULL,
        Category NVARCHAR(200) NULL,
        Description NVARCHAR(1000) NULL,
        Notes NVARCHAR(2000) NULL,
        FilePath NVARCHAR(500) NOT NULL,
        FileName NVARCHAR(255) NOT NULL,
        OriginalFileName NVARCHAR(255) NULL,
        ContentType NVARCHAR(100) NOT NULL DEFAULT 'application/pdf',
        FileSize BIGINT NOT NULL DEFAULT 0,
        ExtractedText NVARCHAR(MAX) NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'Draft',
        UploadedByUserId INT NOT NULL,
        UploadedByName NVARCHAR(200) NULL,
        ConfirmedByUserId INT NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        ConfirmedAt DATETIME2 NULL,
        UpdatedAt DATETIME2 NULL,
        CONSTRAINT FK_BookInvoices_UploadedByUser FOREIGN KEY (UploadedByUserId) REFERENCES Users(UserId),
        CONSTRAINT FK_BookInvoices_ConfirmedByUser FOREIGN KEY (ConfirmedByUserId) REFERENCES Users(UserId)
    );

    -- Indexes for common queries
    CREATE INDEX IX_BookInvoices_SupplierName ON BookInvoices(SupplierName);
    CREATE INDEX IX_BookInvoices_InvoiceDate ON BookInvoices(InvoiceDate);
    CREATE INDEX IX_BookInvoices_Status ON BookInvoices(Status);
    CREATE INDEX IX_BookInvoices_Category ON BookInvoices(Category);
    CREATE INDEX IX_BookInvoices_PaymentDate ON BookInvoices(PaymentDate);
    CREATE INDEX IX_BookInvoices_UploadedByUserId ON BookInvoices(UploadedByUserId);
    CREATE INDEX IX_BookInvoices_InvoiceNumber ON BookInvoices(InvoiceNumber);

    PRINT 'BookInvoices table created successfully';
END
ELSE
BEGIN
    PRINT 'BookInvoices table already exists';
END
GO
