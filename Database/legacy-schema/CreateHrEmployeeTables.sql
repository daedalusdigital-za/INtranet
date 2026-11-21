-- =============================================================================
-- HR unified employee registry + document/contract store
-- Covers ALL sites reporting to HR: Main Office, Security, Condom Factory,
-- Sanitary Pads, New Road, Cape Town, Bronkhorspruit, Port Elizabeth, Logistics.
-- Idempotent: safe to run multiple times.
-- =============================================================================

IF OBJECT_ID('dbo.HrEmployees', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.HrEmployees (
        Id                    INT IDENTITY(1,1) PRIMARY KEY,
        FirstName             NVARCHAR(100)  NOT NULL,
        LastName              NVARCHAR(100)  NOT NULL,
        EmployeeNumber        NVARCHAR(50)   NULL,
        IdNumber              NVARCHAR(50)   NULL,
        PassportNumber        NVARCHAR(50)   NULL,
        Nationality           NVARCHAR(60)   NULL,
        Site                  NVARCHAR(60)   NOT NULL DEFAULT 'Main Office',
        Department            NVARCHAR(100)  NULL,
        JobTitle              NVARCHAR(100)  NULL,
        EmploymentType        NVARCHAR(30)   NOT NULL DEFAULT 'Permanent',
        Status                NVARCHAR(30)   NOT NULL DEFAULT 'Active',
        PhoneNumber           NVARCHAR(20)   NULL,
        Email                 NVARCHAR(150)  NULL,
        Address               NVARCHAR(250)  NULL,
        EmergencyContactName  NVARCHAR(120)  NULL,
        EmergencyContactPhone NVARCHAR(20)   NULL,
        DateOfBirth           DATETIME2      NULL,
        HireDate              DATETIME2      NULL,
        ContractEndDate       DATETIME2      NULL,
        Notes                 NVARCHAR(500)  NULL,
        Source                NVARCHAR(30)   NOT NULL DEFAULT 'Manual',
        BiometricEmpId        NVARCHAR(50)   NULL,
        DriverId              INT            NULL,
        CreatedAt             DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt             DATETIME2      NULL,
        CreatedByName         NVARCHAR(150)  NULL,
        UpdatedByName         NVARCHAR(150)  NULL
    );

    CREATE INDEX IX_HrEmployees_Site         ON dbo.HrEmployees (Site);
    CREATE INDEX IX_HrEmployees_Status       ON dbo.HrEmployees (Status);
    CREATE INDEX IX_HrEmployees_LastName     ON dbo.HrEmployees (LastName);
    CREATE INDEX IX_HrEmployees_Biometric    ON dbo.HrEmployees (BiometricEmpId);
    CREATE INDEX IX_HrEmployees_DriverId     ON dbo.HrEmployees (DriverId);

    PRINT 'Created table HrEmployees';
END
ELSE
    PRINT 'Table HrEmployees already exists';

IF OBJECT_ID('dbo.HrEmployeeDocuments', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.HrEmployeeDocuments (
        Id               INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeId       INT            NOT NULL,
        Category         NVARCHAR(50)   NOT NULL DEFAULT 'Other',
        Title            NVARCHAR(255)  NOT NULL,
        Description      NVARCHAR(500)  NULL,
        FileName         NVARCHAR(255)  NOT NULL,
        OriginalFileName NVARCHAR(255)  NULL,
        FilePath         NVARCHAR(1000) NOT NULL,
        ContentType      NVARCHAR(100)  NULL,
        FileSize         BIGINT         NOT NULL DEFAULT 0,
        ExpiryDate       DATETIME2      NULL,
        UploadedAt       DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        UploadedByUserId INT            NULL,
        UploadedByName   NVARCHAR(150)  NULL,
        CONSTRAINT FK_HrEmployeeDocuments_HrEmployees
            FOREIGN KEY (EmployeeId) REFERENCES dbo.HrEmployees(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_HrEmployeeDocuments_EmployeeId ON dbo.HrEmployeeDocuments (EmployeeId);
    CREATE INDEX IX_HrEmployeeDocuments_Category   ON dbo.HrEmployeeDocuments (Category);
    CREATE INDEX IX_HrEmployeeDocuments_Expiry     ON dbo.HrEmployeeDocuments (ExpiryDate);

    PRINT 'Created table HrEmployeeDocuments';
END
ELSE
    PRINT 'Table HrEmployeeDocuments already exists';
