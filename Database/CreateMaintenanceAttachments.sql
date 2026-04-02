-- Create MaintenanceAttachments table for logistics maintenance file uploads
-- Run with: Get-Content Database\CreateMaintenanceAttachments.sql | docker exec -i projecttracker-db /opt/mssql-tools18/bin/sqlcmd -S localhost -U SA -P "YourStrong@Passw0rd" -d ProjectTrackerDB -C

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'MaintenanceAttachments')
BEGIN
    CREATE TABLE MaintenanceAttachments (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        MaintenanceRecordId INT NOT NULL,
        FileName NVARCHAR(500) NOT NULL,
        StoredFileName NVARCHAR(500) NOT NULL,
        ContentType NVARCHAR(100) NULL,
        FileSize BIGINT NOT NULL DEFAULT 0,
        UploadedBy NVARCHAR(200) NULL,
        VehicleRegistration NVARCHAR(50) NULL,
        UploadedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_MaintenanceAttachments_VehicleMaintenance 
            FOREIGN KEY (MaintenanceRecordId) REFERENCES VehicleMaintenance(Id)
    );

    CREATE INDEX IX_MaintenanceAttachments_MaintenanceRecordId 
        ON MaintenanceAttachments(MaintenanceRecordId);

    PRINT 'Created MaintenanceAttachments table successfully';
END
ELSE
BEGIN
    PRINT 'MaintenanceAttachments table already exists';
END
GO
