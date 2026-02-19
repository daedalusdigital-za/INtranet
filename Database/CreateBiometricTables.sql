-- Create empregistration table (biometric system - synced from Azure)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'empregistration')
BEGIN
    CREATE TABLE empregistration (
        empid NVARCHAR(50) NOT NULL PRIMARY KEY,
        Name NVARCHAR(100) NULL,
        LastName NVARCHAR(100) NULL,
        IdNum NVARCHAR(50) NULL,
        Department NVARCHAR(100) NULL,
        JobTitle NVARCHAR(100) NULL,
        Address NVARCHAR(200) NULL,
        MobileNo NVARCHAR(20) NULL,
        Date DATETIME2 NULL,
        Photo VARBINARY(MAX) NULL
    );
    PRINT 'empregistration table created';
END

-- Create attendance table (biometric system - synced from Azure)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'attendance')
BEGIN
    CREATE TABLE attendance (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        empID NVARCHAR(50) NOT NULL,
        Name NVARCHAR(100) NULL,
        LastName NVARCHAR(100) NULL,
        IdNum NVARCHAR(50) NULL,
        Department NVARCHAR(100) NULL,
        JobTitle NVARCHAR(100) NULL,
        Shift NVARCHAR(50) NULL,
        DaysWorked INT NULL,
        Date DATETIME2 NULL,
        Day NVARCHAR(20) NULL,
        timein TIME NULL,
        timeout TIME NULL,
        Status NVARCHAR(20) NULL,
        CONSTRAINT FK_attendance_empregistration FOREIGN KEY (empID) REFERENCES empregistration(empid) ON DELETE CASCADE
    );
    CREATE NONCLUSTERED INDEX IX_attendance_empID ON attendance(empID);
    CREATE NONCLUSTERED INDEX IX_attendance_Date ON attendance(Date);
    PRINT 'attendance table created';
END

PRINT 'Done - external tables created';
