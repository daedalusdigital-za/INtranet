-- Daily logistics security incidents (Speeding, CurfewMovement, GeofenceExit)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'LogisticsIncidents')
BEGIN
    CREATE TABLE LogisticsIncidents (
        Id              INT IDENTITY(1,1) PRIMARY KEY,
        Type            NVARCHAR(40)  NOT NULL,
        Severity        NVARCHAR(20)  NOT NULL DEFAULT 'Medium',
        Registration    NVARCHAR(50)  NOT NULL,
        Driver          NVARCHAR(150) NULL,
        Latitude        DECIMAL(10,7) NULL,
        Longitude       DECIMAL(10,7) NULL,
        Address         NVARCHAR(300) NULL,
        Speed           FLOAT         NULL,
        Zone            NVARCHAR(150) NULL,
        DistanceMeters  FLOAT         NULL,
        DuringCurfew    BIT           NOT NULL DEFAULT 0,
        Details         NVARCHAR(600) NULL,
        IncidentDate    DATETIME2     NOT NULL,
        OccurredAtSast  DATETIME2     NOT NULL,
        CreatedAtUtc    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_LogisticsIncidents_IncidentDate ON LogisticsIncidents (IncidentDate);
    CREATE INDEX IX_LogisticsIncidents_Type ON LogisticsIncidents (Type);
    CREATE INDEX IX_LogisticsIncidents_Reg ON LogisticsIncidents (Registration);

    PRINT 'Created LogisticsIncidents table';
END
ELSE
    PRINT 'LogisticsIncidents table already exists';
GO
