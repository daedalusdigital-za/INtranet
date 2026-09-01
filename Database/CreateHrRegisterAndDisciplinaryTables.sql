-- =============================================================================
-- HR manual attendance registers + disciplinary / employee-relations cases
-- Idempotent: safe to run multiple times.
-- =============================================================================

IF OBJECT_ID('dbo.HrRegisterEntries', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.HrRegisterEntries (
        Id               INT IDENTITY(1,1) PRIMARY KEY,
        RegisterDate     DATETIME2      NOT NULL,
        Site             NVARCHAR(60)   NOT NULL DEFAULT 'Main Office',
        Department       NVARCHAR(100)  NULL,
        EmployeeId       INT            NULL,
        EmployeeName     NVARCHAR(200)  NOT NULL,
        Status           NVARCHAR(30)   NOT NULL DEFAULT 'Present',
        TimeIn           NVARCHAR(20)   NULL,
        TimeOut          NVARCHAR(20)   NULL,
        Notes            NVARCHAR(300)  NULL,
        SubmittedByName  NVARCHAR(150)  NULL,
        SubmittedByUserId INT           NULL,
        SubmittedAt      DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt        DATETIME2      NULL,
        CONSTRAINT FK_HrRegisterEntries_HrEmployees
            FOREIGN KEY (EmployeeId) REFERENCES dbo.HrEmployees(Id) ON DELETE SET NULL
    );

    CREATE INDEX IX_HrRegisterEntries_Date       ON dbo.HrRegisterEntries (RegisterDate);
    CREATE INDEX IX_HrRegisterEntries_Site       ON dbo.HrRegisterEntries (Site);
    CREATE INDEX IX_HrRegisterEntries_DateSite   ON dbo.HrRegisterEntries (RegisterDate, Site);
    CREATE INDEX IX_HrRegisterEntries_Employee   ON dbo.HrRegisterEntries (EmployeeId);

    PRINT 'Created table HrRegisterEntries';
END
ELSE
    PRINT 'Table HrRegisterEntries already exists';

IF OBJECT_ID('dbo.HrDisciplinaryCases', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.HrDisciplinaryCases (
        Id                INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeId        INT            NOT NULL,
        Type              NVARCHAR(50)   NOT NULL DEFAULT 'Verbal Warning',
        Title             NVARCHAR(200)  NOT NULL,
        Description       NVARCHAR(2000) NULL,
        IssuedDate        DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        ExpiryDate        DATETIME2      NULL,
        Status            NVARCHAR(30)   NOT NULL DEFAULT 'Active',
        Outcome           NVARCHAR(500)  NULL,
        IsPaidSuspension  BIT            NOT NULL DEFAULT 0,
        IssuedByName      NVARCHAR(150)  NULL,
        Notes             NVARCHAR(300)  NULL,
        CreatedAt         DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt         DATETIME2      NULL,
        CreatedByName     NVARCHAR(150)  NULL,
        CONSTRAINT FK_HrDisciplinaryCases_HrEmployees
            FOREIGN KEY (EmployeeId) REFERENCES dbo.HrEmployees(Id) ON DELETE CASCADE
    );

    CREATE INDEX IX_HrDisciplinaryCases_Employee ON dbo.HrDisciplinaryCases (EmployeeId);
    CREATE INDEX IX_HrDisciplinaryCases_Status   ON dbo.HrDisciplinaryCases (Status);
    CREATE INDEX IX_HrDisciplinaryCases_Type     ON dbo.HrDisciplinaryCases (Type);

    PRINT 'Created table HrDisciplinaryCases';
END
ELSE
    PRINT 'Table HrDisciplinaryCases already exists';
