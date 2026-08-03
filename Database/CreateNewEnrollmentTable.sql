-- new_enrollment table — fingerprint template storage for the VB.NET clocking application
-- (OnlineFinBioEmpAttenSystemVB)
-- Columns must match exactly what the app reads/writes: empid, fingerdata1-10, fingermask
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'new_enrollment')
BEGIN
    CREATE TABLE new_enrollment (
        id           INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        empid        NVARCHAR(50)      NOT NULL,
        fingerdata1  VARBINARY(MAX)    NULL,
        fingerdata2  VARBINARY(MAX)    NULL,
        fingerdata3  VARBINARY(MAX)    NULL,
        fingerdata4  VARBINARY(MAX)    NULL,
        fingerdata5  VARBINARY(MAX)    NULL,
        fingerdata6  VARBINARY(MAX)    NULL,
        fingerdata7  VARBINARY(MAX)    NULL,
        fingerdata8  VARBINARY(MAX)    NULL,
        fingerdata9  VARBINARY(MAX)    NULL,
        fingerdata10 VARBINARY(MAX)    NULL,
        fingermask   INT               NOT NULL DEFAULT 0,
        CONSTRAINT FK_new_enrollment_emp FOREIGN KEY (empid)
            REFERENCES empregistration(empid) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX UX_new_enrollment_empid ON new_enrollment(empid);
    PRINT 'new_enrollment table created';
END
ELSE
    PRINT 'new_enrollment table already exists';
