-- Create TFN Tables for TruckFuelNet Integration

-- TfnDepots table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TfnDepots')
BEGIN
    CREATE TABLE TfnDepots (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TfnDepotId NVARCHAR(100) NOT NULL UNIQUE,
        Name NVARCHAR(200) NOT NULL,
        Location NVARCHAR(500),
        ContactPerson NVARCHAR(200),
        PhoneNumber NVARCHAR(50),
        Email NVARCHAR(200),
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        LastSyncedAt DATETIME2
    );
    PRINT 'TfnDepots table created successfully';
END
ELSE
BEGIN
    PRINT 'TfnDepots table already exists';
END
GO

-- TfnOrders table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TfnOrders')
BEGIN
    CREATE TABLE TfnOrders (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TfnOrderId NVARCHAR(100) NOT NULL UNIQUE,
        OrderNumber NVARCHAR(100) NOT NULL,
        OrderDate DATETIME2 NOT NULL,
        VehicleId INT,
        DriverId INT,
        TfnDepotId INT,
        FuelType NVARCHAR(50),
        OrderedLitres DECIMAL(18,2),
        Status NVARCHAR(50),
        Notes NVARCHAR(MAX),
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        LastSyncedAt DATETIME2,
        FOREIGN KEY (VehicleId) REFERENCES Vehicles(Id),
        FOREIGN KEY (DriverId) REFERENCES Drivers(Id),
        FOREIGN KEY (TfnDepotId) REFERENCES TfnDepots(Id)
    );
    PRINT 'TfnOrders table created successfully';
END
ELSE
BEGIN
    PRINT 'TfnOrders table already exists';
END
GO

-- TfnTransactions table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TfnTransactions')
BEGIN
    CREATE TABLE TfnTransactions (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        TfnTransactionId NVARCHAR(100) NOT NULL UNIQUE,
        TransactionNumber NVARCHAR(100) NOT NULL,
        TransactionDate DATETIME2 NOT NULL,
        VehicleId INT,
        DriverId INT,
        TfnDepotId INT,
        TfnOrderId INT,
        LoadId INT,
        FuelType NVARCHAR(50),
        Litres DECIMAL(18,2) NOT NULL,
        PricePerLitre DECIMAL(18,2),
        TotalAmount DECIMAL(18,2) NOT NULL,
        VatAmount DECIMAL(18,2),
        DiscountAmount DECIMAL(18,2),
        OdometerReading INT,
        VirtualCardNumber NVARCHAR(50),
        AttendantName NVARCHAR(200),
        FuelEfficiency DECIMAL(18,2),
        DistanceSinceLastFill INT,
        ExpectedLitres DECIMAL(18,2),
        VarianceLitres DECIMAL(18,2),
        VariancePercentage DECIMAL(18,2),
        IsAnomaly BIT NOT NULL DEFAULT 0,
        AnomalyReason NVARCHAR(500),
        Notes NVARCHAR(MAX),
        CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
        LastSyncedAt DATETIME2,
        FOREIGN KEY (VehicleId) REFERENCES Vehicles(Id),
        FOREIGN KEY (DriverId) REFERENCES Drivers(Id),
        FOREIGN KEY (TfnDepotId) REFERENCES TfnDepots(Id),
        FOREIGN KEY (TfnOrderId) REFERENCES TfnOrders(Id),
        FOREIGN KEY (LoadId) REFERENCES Loads(Id)
    );
    PRINT 'TfnTransactions table created successfully';
END
ELSE
BEGIN
    PRINT 'TfnTransactions table already exists';
END
GO

-- TfnAccountBalances table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TfnAccountBalances')
BEGIN
    CREATE TABLE TfnAccountBalances (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        VehicleId INT NOT NULL,
        TotalCredit DECIMAL(18,2) NOT NULL DEFAULT 0,
        AvailableCredit DECIMAL(18,2) NOT NULL DEFAULT 0,
        UsedCredit DECIMAL(18,2) NOT NULL DEFAULT 0,
        LastTransactionDate DATETIME2,
        LastSyncedAt DATETIME2,
        FOREIGN KEY (VehicleId) REFERENCES Vehicles(Id),
        CONSTRAINT UK_TfnAccountBalances_VehicleId UNIQUE (VehicleId)
    );
    PRINT 'TfnAccountBalances table created successfully';
END
ELSE
BEGIN
    PRINT 'TfnAccountBalances table already exists';
END
GO

-- Create indexes for better performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TfnTransactions_TransactionDate')
BEGIN
    CREATE INDEX IX_TfnTransactions_TransactionDate ON TfnTransactions(TransactionDate DESC);
    PRINT 'Index IX_TfnTransactions_TransactionDate created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TfnTransactions_VehicleId')
BEGIN
    CREATE INDEX IX_TfnTransactions_VehicleId ON TfnTransactions(VehicleId);
    PRINT 'Index IX_TfnTransactions_VehicleId created';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TfnTransactions_IsAnomaly')
BEGIN
    CREATE INDEX IX_TfnTransactions_IsAnomaly ON TfnTransactions(IsAnomaly) WHERE IsAnomaly = 1;
    PRINT 'Index IX_TfnTransactions_IsAnomaly created';
END
GO

PRINT 'TFN tables creation script completed successfully';
