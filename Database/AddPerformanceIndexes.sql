-- Performance Optimization Indexes
-- Run this script to add indexes on frequently queried columns

-- Users table indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_Email' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_Email ON Users(Email);
    PRINT 'Created index IX_Users_Email';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_IsActive' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_IsActive ON Users(IsActive) INCLUDE (Name, Surname, Email, Role);
    PRINT 'Created index IX_Users_IsActive';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_DepartmentId' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Users_DepartmentId ON Users(DepartmentId);
    PRINT 'Created index IX_Users_DepartmentId';
END

-- Vehicles table indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Vehicles_Province' AND object_id = OBJECT_ID('Vehicles'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Vehicles_Province ON Vehicles(Province);
    PRINT 'Created index IX_Vehicles_Province';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Vehicles_Status' AND object_id = OBJECT_ID('Vehicles'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Vehicles_Status ON Vehicles(Status);
    PRINT 'Created index IX_Vehicles_Status';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Vehicles_VehicleTypeId' AND object_id = OBJECT_ID('Vehicles'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Vehicles_VehicleTypeId ON Vehicles(VehicleTypeId);
    PRINT 'Created index IX_Vehicles_VehicleTypeId';
END

-- Drivers table indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Drivers_Status' AND object_id = OBJECT_ID('Drivers'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Drivers_Status ON Drivers(Status);
    PRINT 'Created index IX_Drivers_Status';
END

-- AuditLogs table indexes (important for reporting)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_Timestamp' AND object_id = OBJECT_ID('AuditLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLogs_Timestamp ON AuditLogs(Timestamp DESC);
    PRINT 'Created index IX_AuditLogs_Timestamp';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_UserId' AND object_id = OBJECT_ID('AuditLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLogs_UserId ON AuditLogs(UserId);
    PRINT 'Created index IX_AuditLogs_UserId';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_Action' AND object_id = OBJECT_ID('AuditLogs'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_AuditLogs_Action ON AuditLogs(Action);
    PRINT 'Created index IX_AuditLogs_Action';
END

-- Boards and Cards indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Cards_ListId' AND object_id = OBJECT_ID('Cards'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Cards_ListId ON Cards(ListId);
    PRINT 'Created index IX_Cards_ListId';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Lists_BoardId' AND object_id = OBJECT_ID('Lists'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Lists_BoardId ON Lists(BoardId);
    PRINT 'Created index IX_Lists_BoardId';
END

-- Announcements indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Announcements_IsActive' AND object_id = OBJECT_ID('Announcements'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Announcements_IsActive ON Announcements(IsActive, CreatedAt DESC);
    PRINT 'Created index IX_Announcements_IsActive';
END

-- Employees indexes
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employees_DepartmentId' AND object_id = OBJECT_ID('Employees'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Employees_DepartmentId ON Employees(DepartmentId);
    PRINT 'Created index IX_Employees_DepartmentId';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employees_BranchId' AND object_id = OBJECT_ID('Employees'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Employees_BranchId ON Employees(BranchId);
    PRINT 'Created index IX_Employees_BranchId';
END

PRINT '';
PRINT '=== Performance indexes created successfully ===';
