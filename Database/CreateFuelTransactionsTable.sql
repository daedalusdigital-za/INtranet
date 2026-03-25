-- =============================================
-- Create FuelTransactions table for monthly fuel report imports
-- =============================================

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'FuelTransactions')
BEGIN
    CREATE TABLE FuelTransactions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        VehicleId INT NULL,
        RegistrationNumber NVARCHAR(50) NOT NULL,
        CardNumber NVARCHAR(50) NULL,
        DepotName NVARCHAR(200) NULL,
        AllocationLitres DECIMAL(18,2) NOT NULL DEFAULT 0,
        LitresUsed DECIMAL(18,2) NOT NULL DEFAULT 0,
        TransactionDate DATETIME2 NOT NULL,
        AmountSpent DECIMAL(18,2) NOT NULL DEFAULT 0,
        DepotAssignment NVARCHAR(100) NULL,
        ReportMonth INT NOT NULL,
        ReportYear INT NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_FuelTransactions_Vehicles FOREIGN KEY (VehicleId) 
            REFERENCES Vehicles(Id) ON DELETE SET NULL
    );

    -- Performance indexes
    CREATE INDEX IX_FuelTransactions_VehicleId ON FuelTransactions(VehicleId);
    CREATE INDEX IX_FuelTransactions_RegistrationNumber ON FuelTransactions(RegistrationNumber);
    CREATE INDEX IX_FuelTransactions_TransactionDate ON FuelTransactions(TransactionDate);
    CREATE INDEX IX_FuelTransactions_ReportPeriod ON FuelTransactions(ReportYear, ReportMonth);

    PRINT 'FuelTransactions table created successfully.';
END
ELSE
BEGIN
    PRINT 'FuelTransactions table already exists.';
END
GO
