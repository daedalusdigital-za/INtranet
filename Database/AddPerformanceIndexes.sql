-- ============================================================
-- Performance Optimization Indexes for ProjectTrackerDB
-- Run this script to add indexes on frequently queried columns
-- Safe to re-run: all indexes wrapped in IF NOT EXISTS checks
-- ============================================================

-- ============================================================
-- Users
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_Email' AND object_id = OBJECT_ID('Users'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Users_Email ON Users(Email);
        PRINT 'Created index IX_Users_Email';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_DepartmentId' AND object_id = OBJECT_ID('Users'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Users_DepartmentId ON Users(DepartmentId);
        PRINT 'Created index IX_Users_DepartmentId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Users_Role' AND object_id = OBJECT_ID('Users'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Users_Role ON Users(Role);
        PRINT 'Created index IX_Users_Role';
    END
END

-- ============================================================
-- Vehicles
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Vehicles')
BEGIN
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

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Vehicles_CurrentDriverId' AND object_id = OBJECT_ID('Vehicles'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Vehicles_CurrentDriverId ON Vehicles(CurrentDriverId);
        PRINT 'Created index IX_Vehicles_CurrentDriverId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Vehicles_RegistrationNumber' AND object_id = OBJECT_ID('Vehicles'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Vehicles_RegistrationNumber ON Vehicles(RegistrationNumber);
        PRINT 'Created index IX_Vehicles_RegistrationNumber';
    END
END

-- ============================================================
-- Drivers
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Drivers')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Drivers_Status' AND object_id = OBJECT_ID('Drivers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Drivers_Status ON Drivers(Status);
        PRINT 'Created index IX_Drivers_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Drivers_LicenseExpiryDate' AND object_id = OBJECT_ID('Drivers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Drivers_LicenseExpiryDate ON Drivers(LicenseExpiryDate);
        PRINT 'Created index IX_Drivers_LicenseExpiryDate';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Drivers_EmployeeNumber' AND object_id = OBJECT_ID('Drivers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Drivers_EmployeeNumber ON Drivers(EmployeeNumber);
        PRINT 'Created index IX_Drivers_EmployeeNumber';
    END
END

-- ============================================================
-- AuditLogs (important for reporting, high-volume table)
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AuditLogs')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_CreatedAt' AND object_id = OBJECT_ID('AuditLogs'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_AuditLogs_CreatedAt ON AuditLogs(CreatedAt DESC);
        PRINT 'Created index IX_AuditLogs_CreatedAt';
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

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_EntityType' AND object_id = OBJECT_ID('AuditLogs'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_AuditLogs_EntityType ON AuditLogs(EntityType);
        PRINT 'Created index IX_AuditLogs_EntityType';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_UserId_CreatedAt' AND object_id = OBJECT_ID('AuditLogs'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_AuditLogs_UserId_CreatedAt ON AuditLogs(UserId, CreatedAt DESC) INCLUDE (Action, EntityType, Details);
        PRINT 'Created index IX_AuditLogs_UserId_CreatedAt';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_Severity' AND object_id = OBJECT_ID('AuditLogs'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_AuditLogs_Severity ON AuditLogs(Severity);
        PRINT 'Created index IX_AuditLogs_Severity';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AuditLogs_Category' AND object_id = OBJECT_ID('AuditLogs'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_AuditLogs_Category ON AuditLogs(Category);
        PRINT 'Created index IX_AuditLogs_Category';
    END
END

-- ============================================================
-- Loads (core logistics table, heavily queried)
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Loads')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Loads_Status' AND object_id = OBJECT_ID('Loads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Loads_Status ON Loads(Status);
        PRINT 'Created index IX_Loads_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Loads_ScheduledPickupDate' AND object_id = OBJECT_ID('Loads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Loads_ScheduledPickupDate ON Loads(ScheduledPickupDate DESC);
        PRINT 'Created index IX_Loads_ScheduledPickupDate';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Loads_CustomerId' AND object_id = OBJECT_ID('Loads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Loads_CustomerId ON Loads(CustomerId);
        PRINT 'Created index IX_Loads_CustomerId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Loads_VehicleId' AND object_id = OBJECT_ID('Loads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Loads_VehicleId ON Loads(VehicleId);
        PRINT 'Created index IX_Loads_VehicleId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Loads_DriverId' AND object_id = OBJECT_ID('Loads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Loads_DriverId ON Loads(DriverId);
        PRINT 'Created index IX_Loads_DriverId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Loads_LoadNumber' AND object_id = OBJECT_ID('Loads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Loads_LoadNumber ON Loads(LoadNumber);
        PRINT 'Created index IX_Loads_LoadNumber';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Loads_SourceWarehouseId' AND object_id = OBJECT_ID('Loads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Loads_SourceWarehouseId ON Loads(SourceWarehouseId);
        PRINT 'Created index IX_Loads_SourceWarehouseId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Loads_CreatedAt' AND object_id = OBJECT_ID('Loads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Loads_CreatedAt ON Loads(CreatedAt DESC);
        PRINT 'Created index IX_Loads_CreatedAt';
    END
END

-- ============================================================
-- LoadItems
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LoadItems')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoadItems_LoadId' AND object_id = OBJECT_ID('LoadItems'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_LoadItems_LoadId ON LoadItems(LoadId);
        PRINT 'Created index IX_LoadItems_LoadId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoadItems_CommodityId' AND object_id = OBJECT_ID('LoadItems'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_LoadItems_CommodityId ON LoadItems(CommodityId);
        PRINT 'Created index IX_LoadItems_CommodityId';
    END
END

-- ============================================================
-- LoadStops
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LoadStops')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoadStops_LoadId' AND object_id = OBJECT_ID('LoadStops'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_LoadStops_LoadId ON LoadStops(LoadId);
        PRINT 'Created index IX_LoadStops_LoadId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LoadStops_Status' AND object_id = OBJECT_ID('LoadStops'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_LoadStops_Status ON LoadStops(Status);
        PRINT 'Created index IX_LoadStops_Status';
    END
END

-- ============================================================
-- LogisticsCustomers
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LogisticsCustomers')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LogisticsCustomers_Name' AND object_id = OBJECT_ID('LogisticsCustomers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_LogisticsCustomers_Name ON LogisticsCustomers(Name);
        PRINT 'Created index IX_LogisticsCustomers_Name';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LogisticsCustomers_Status' AND object_id = OBJECT_ID('LogisticsCustomers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_LogisticsCustomers_Status ON LogisticsCustomers(Status);
        PRINT 'Created index IX_LogisticsCustomers_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LogisticsCustomers_City' AND object_id = OBJECT_ID('LogisticsCustomers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_LogisticsCustomers_City ON LogisticsCustomers(City);
        PRINT 'Created index IX_LogisticsCustomers_City';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_LogisticsCustomers_Province' AND object_id = OBJECT_ID('LogisticsCustomers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_LogisticsCustomers_Province ON LogisticsCustomers(Province);
        PRINT 'Created index IX_LogisticsCustomers_Province';
    END
END

-- ============================================================
-- Invoices
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Invoices')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Invoices_Status' AND object_id = OBJECT_ID('Invoices'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Invoices_Status ON Invoices(Status) INCLUDE (InvoiceNumber, CustomerId, Total);
        PRINT 'Created index IX_Invoices_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Invoices_CustomerId' AND object_id = OBJECT_ID('Invoices'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Invoices_CustomerId ON Invoices(CustomerId);
        PRINT 'Created index IX_Invoices_CustomerId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Invoices_LoadId' AND object_id = OBJECT_ID('Invoices'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Invoices_LoadId ON Invoices(LoadId);
        PRINT 'Created index IX_Invoices_LoadId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Invoices_InvoiceDate' AND object_id = OBJECT_ID('Invoices'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Invoices_InvoiceDate ON Invoices(InvoiceDate DESC) INCLUDE (CustomerId, Total, Status);
        PRINT 'Created index IX_Invoices_InvoiceDate';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Invoices_DueDate' AND object_id = OBJECT_ID('Invoices'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Invoices_DueDate ON Invoices(DueDate) INCLUDE (Status, Total);
        PRINT 'Created index IX_Invoices_DueDate';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Invoices_InvoiceNumber' AND object_id = OBJECT_ID('Invoices'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Invoices_InvoiceNumber ON Invoices(InvoiceNumber);
        PRINT 'Created index IX_Invoices_InvoiceNumber';
    END
END

-- ============================================================
-- InvoiceLineItems
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'InvoiceLineItems')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InvoiceLineItems_InvoiceId' AND object_id = OBJECT_ID('InvoiceLineItems'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_InvoiceLineItems_InvoiceId ON InvoiceLineItems(InvoiceId);
        PRINT 'Created index IX_InvoiceLineItems_InvoiceId';
    END
END

-- ============================================================
-- Boards, Lists, Cards (Kanban system)
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Boards')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Boards_CreatedByUserId' AND object_id = OBJECT_ID('Boards'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Boards_CreatedByUserId ON Boards(CreatedByUserId);
        PRINT 'Created index IX_Boards_CreatedByUserId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Boards_DepartmentId' AND object_id = OBJECT_ID('Boards'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Boards_DepartmentId ON Boards(DepartmentId);
        PRINT 'Created index IX_Boards_DepartmentId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Boards_Status' AND object_id = OBJECT_ID('Boards'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Boards_Status ON Boards(Status);
        PRINT 'Created index IX_Boards_Status';
    END
END

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Lists')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Lists_BoardId' AND object_id = OBJECT_ID('Lists'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Lists_BoardId ON Lists(BoardId);
        PRINT 'Created index IX_Lists_BoardId';
    END
END

IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Cards')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Cards_ListId' AND object_id = OBJECT_ID('Cards'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Cards_ListId ON Cards(ListId);
        PRINT 'Created index IX_Cards_ListId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Cards_AssignedToUserId' AND object_id = OBJECT_ID('Cards'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Cards_AssignedToUserId ON Cards(AssignedToUserId);
        PRINT 'Created index IX_Cards_AssignedToUserId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Cards_Status' AND object_id = OBJECT_ID('Cards'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Cards_Status ON Cards(Status);
        PRINT 'Created index IX_Cards_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Cards_DueDate' AND object_id = OBJECT_ID('Cards'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Cards_DueDate ON Cards(DueDate) INCLUDE (Title, Status, AssignedToUserId);
        PRINT 'Created index IX_Cards_DueDate';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Cards_CreatedByUserId' AND object_id = OBJECT_ID('Cards'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Cards_CreatedByUserId ON Cards(CreatedByUserId);
        PRINT 'Created index IX_Cards_CreatedByUserId';
    END
END

-- ============================================================
-- BoardMembers
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BoardMembers')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BoardMembers_UserId' AND object_id = OBJECT_ID('BoardMembers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_BoardMembers_UserId ON BoardMembers(UserId);
        PRINT 'Created index IX_BoardMembers_UserId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BoardMembers_BoardId' AND object_id = OBJECT_ID('BoardMembers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_BoardMembers_BoardId ON BoardMembers(BoardId);
        PRINT 'Created index IX_BoardMembers_BoardId';
    END
END

-- ============================================================
-- BoardChecklistItems
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'BoardChecklistItems')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_BoardChecklistItems_BoardId' AND object_id = OBJECT_ID('BoardChecklistItems'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_BoardChecklistItems_BoardId ON BoardChecklistItems(BoardId);
        PRINT 'Created index IX_BoardChecklistItems_BoardId';
    END
END

-- ============================================================
-- CardAttachments
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'CardAttachments')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CardAttachments_CardId' AND object_id = OBJECT_ID('CardAttachments'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_CardAttachments_CardId ON CardAttachments(CardId);
        PRINT 'Created index IX_CardAttachments_CardId';
    END
END

-- ============================================================
-- CardComments
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'CardComments')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CardComments_CardId' AND object_id = OBJECT_ID('CardComments'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_CardComments_CardId ON CardComments(CardId);
        PRINT 'Created index IX_CardComments_CardId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CardComments_UserId' AND object_id = OBJECT_ID('CardComments'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_CardComments_UserId ON CardComments(UserId);
        PRINT 'Created index IX_CardComments_UserId';
    END
END

-- ============================================================
-- Announcements
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Announcements')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Announcements_IsActive' AND object_id = OBJECT_ID('Announcements'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Announcements_IsActive ON Announcements(IsActive, CreatedAt DESC);
        PRINT 'Created index IX_Announcements_IsActive';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Announcements_Category' AND object_id = OBJECT_ID('Announcements'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Announcements_Category ON Announcements(Category);
        PRINT 'Created index IX_Announcements_Category';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Announcements_CreatedByUserId' AND object_id = OBJECT_ID('Announcements'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Announcements_CreatedByUserId ON Announcements(CreatedByUserId);
        PRINT 'Created index IX_Announcements_CreatedByUserId';
    END
END

-- ============================================================
-- AnnouncementReads
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'AnnouncementReads')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AnnouncementReads_UserId' AND object_id = OBJECT_ID('AnnouncementReads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_AnnouncementReads_UserId ON AnnouncementReads(UserId);
        PRINT 'Created index IX_AnnouncementReads_UserId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_AnnouncementReads_AnnouncementId' AND object_id = OBJECT_ID('AnnouncementReads'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_AnnouncementReads_AnnouncementId ON AnnouncementReads(AnnouncementId);
        PRINT 'Created index IX_AnnouncementReads_AnnouncementId';
    END
END

-- ============================================================
-- Employees
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Employees')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employees_Department' AND object_id = OBJECT_ID('Employees'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Employees_Department ON Employees(Department);
        PRINT 'Created index IX_Employees_Department';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employees_IsActive' AND object_id = OBJECT_ID('Employees'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Employees_IsActive ON Employees(IsActive);
        PRINT 'Created index IX_Employees_IsActive';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employees_EmployeeCode' AND object_id = OBJECT_ID('Employees'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Employees_EmployeeCode ON Employees(EmployeeCode);
        PRINT 'Created index IX_Employees_EmployeeCode';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employees_Email' AND object_id = OBJECT_ID('Employees'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Employees_Email ON Employees(Email);
        PRINT 'Created index IX_Employees_Email';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Employees_Shift' AND object_id = OBJECT_ID('Employees'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Employees_Shift ON Employees(Shift);
        PRINT 'Created index IX_Employees_Shift';
    END
END

-- ============================================================
-- Attendances (queried daily for check-in/out)
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Attendances')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Attendances_Date' AND object_id = OBJECT_ID('Attendances'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Attendances_Date ON Attendances(Date DESC) INCLUDE (EmployeeId, TimeIn, TimeOut, Status);
        PRINT 'Created index IX_Attendances_Date';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Attendances_EmployeeId' AND object_id = OBJECT_ID('Attendances'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Attendances_EmployeeId ON Attendances(EmployeeId);
        PRINT 'Created index IX_Attendances_EmployeeId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Attendances_Status' AND object_id = OBJECT_ID('Attendances'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Attendances_Status ON Attendances(Status);
        PRINT 'Created index IX_Attendances_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Attendances_EmployeeId_Date' AND object_id = OBJECT_ID('Attendances'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Attendances_EmployeeId_Date ON Attendances(EmployeeId, Date DESC);
        PRINT 'Created index IX_Attendances_EmployeeId_Date';
    END
END

-- ============================================================
-- Meetings
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Meetings')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Meetings_MeetingDate' AND object_id = OBJECT_ID('Meetings'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Meetings_MeetingDate ON Meetings(MeetingDate DESC);
        PRINT 'Created index IX_Meetings_MeetingDate';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Meetings_OrganizerId' AND object_id = OBJECT_ID('Meetings'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Meetings_OrganizerId ON Meetings(OrganizerId);
        PRINT 'Created index IX_Meetings_OrganizerId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Meetings_Status' AND object_id = OBJECT_ID('Meetings'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Meetings_Status ON Meetings(Status);
        PRINT 'Created index IX_Meetings_Status';
    END
END

-- ============================================================
-- MeetingAttendees
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MeetingAttendees')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MeetingAttendees_MeetingId' AND object_id = OBJECT_ID('MeetingAttendees'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_MeetingAttendees_MeetingId ON MeetingAttendees(MeetingId);
        PRINT 'Created index IX_MeetingAttendees_MeetingId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MeetingAttendees_UserId' AND object_id = OBJECT_ID('MeetingAttendees'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_MeetingAttendees_UserId ON MeetingAttendees(UserId);
        PRINT 'Created index IX_MeetingAttendees_UserId';
    END
END

-- ============================================================
-- MeetingNotifications
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MeetingNotifications')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MeetingNotifications_UserId_IsRead' AND object_id = OBJECT_ID('MeetingNotifications'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_MeetingNotifications_UserId_IsRead ON MeetingNotifications(UserId, IsRead);
        PRINT 'Created index IX_MeetingNotifications_UserId_IsRead';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_MeetingNotifications_MeetingId' AND object_id = OBJECT_ID('MeetingNotifications'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_MeetingNotifications_MeetingId ON MeetingNotifications(MeetingId);
        PRINT 'Created index IX_MeetingNotifications_MeetingId';
    END
END

-- ============================================================
-- TodoTasks
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TodoTasks')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TodoTasks_AssignedToUserId' AND object_id = OBJECT_ID('TodoTasks'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_TodoTasks_AssignedToUserId ON TodoTasks(AssignedToUserId);
        PRINT 'Created index IX_TodoTasks_AssignedToUserId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TodoTasks_CreatedByUserId' AND object_id = OBJECT_ID('TodoTasks'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_TodoTasks_CreatedByUserId ON TodoTasks(CreatedByUserId);
        PRINT 'Created index IX_TodoTasks_CreatedByUserId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TodoTasks_Status' AND object_id = OBJECT_ID('TodoTasks'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_TodoTasks_Status ON TodoTasks(Status);
        PRINT 'Created index IX_TodoTasks_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TodoTasks_DueDate' AND object_id = OBJECT_ID('TodoTasks'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_TodoTasks_DueDate ON TodoTasks(DueDate) INCLUDE (Title, Status, AssignedToUserId, Priority);
        PRINT 'Created index IX_TodoTasks_DueDate';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TodoTasks_Priority' AND object_id = OBJECT_ID('TodoTasks'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_TodoTasks_Priority ON TodoTasks(Priority);
        PRINT 'Created index IX_TodoTasks_Priority';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TodoTasks_Category' AND object_id = OBJECT_ID('TodoTasks'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_TodoTasks_Category ON TodoTasks(Category);
        PRINT 'Created index IX_TodoTasks_Category';
    END
END

-- ============================================================
-- TodoNotifications
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'TodoNotifications')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TodoNotifications_UserId_IsRead' AND object_id = OBJECT_ID('TodoNotifications'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_TodoNotifications_UserId_IsRead ON TodoNotifications(UserId, IsRead);
        PRINT 'Created index IX_TodoNotifications_UserId_IsRead';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TodoNotifications_TodoTaskId' AND object_id = OBJECT_ID('TodoNotifications'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_TodoNotifications_TodoTaskId ON TodoNotifications(TodoTaskId);
        PRINT 'Created index IX_TodoNotifications_TodoTaskId';
    END
END

-- ============================================================
-- Commodities
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Commodities')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Commodities_Code' AND object_id = OBJECT_ID('Commodities'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Commodities_Code ON Commodities(Code);
        PRINT 'Created index IX_Commodities_Code';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Commodities_Category' AND object_id = OBJECT_ID('Commodities'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Commodities_Category ON Commodities(Category);
        PRINT 'Created index IX_Commodities_Category';
    END
END

-- ============================================================
-- CustomerContracts
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'CustomerContracts')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CustomerContracts_CustomerId' AND object_id = OBJECT_ID('CustomerContracts'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_CustomerContracts_CustomerId ON CustomerContracts(CustomerId);
        PRINT 'Created index IX_CustomerContracts_CustomerId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CustomerContracts_Status' AND object_id = OBJECT_ID('CustomerContracts'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_CustomerContracts_Status ON CustomerContracts(Status);
        PRINT 'Created index IX_CustomerContracts_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_CustomerContracts_EndDate' AND object_id = OBJECT_ID('CustomerContracts'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_CustomerContracts_EndDate ON CustomerContracts(EndDate);
        PRINT 'Created index IX_CustomerContracts_EndDate';
    END
END

-- ============================================================
-- Backorders
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Backorders')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Backorders_Status' AND object_id = OBJECT_ID('Backorders'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Backorders_Status ON Backorders(Status);
        PRINT 'Created index IX_Backorders_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Backorders_CustomerId' AND object_id = OBJECT_ID('Backorders'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Backorders_CustomerId ON Backorders(CustomerId);
        PRINT 'Created index IX_Backorders_CustomerId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Backorders_InventoryId' AND object_id = OBJECT_ID('Backorders'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Backorders_InventoryId ON Backorders(InventoryId);
        PRINT 'Created index IX_Backorders_InventoryId';
    END
END

-- ============================================================
-- VehicleMaintenance
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'VehicleMaintenance')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleMaintenance_VehicleId' AND object_id = OBJECT_ID('VehicleMaintenance'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_VehicleMaintenance_VehicleId ON VehicleMaintenance(VehicleId);
        PRINT 'Created index IX_VehicleMaintenance_VehicleId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleMaintenance_Status' AND object_id = OBJECT_ID('VehicleMaintenance'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_VehicleMaintenance_Status ON VehicleMaintenance(Status);
        PRINT 'Created index IX_VehicleMaintenance_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleMaintenance_ScheduledDate' AND object_id = OBJECT_ID('VehicleMaintenance'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_VehicleMaintenance_ScheduledDate ON VehicleMaintenance(ScheduledDate DESC);
        PRINT 'Created index IX_VehicleMaintenance_ScheduledDate';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_VehicleMaintenance_MaintenanceType' AND object_id = OBJECT_ID('VehicleMaintenance'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_VehicleMaintenance_MaintenanceType ON VehicleMaintenance(MaintenanceType);
        PRINT 'Created index IX_VehicleMaintenance_MaintenanceType';
    END
END

-- ============================================================
-- ProofOfDeliveries
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ProofOfDeliveries')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ProofOfDeliveries_LoadId' AND object_id = OBJECT_ID('ProofOfDeliveries'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_ProofOfDeliveries_LoadId ON ProofOfDeliveries(LoadId);
        PRINT 'Created index IX_ProofOfDeliveries_LoadId';
    END
END

-- ============================================================
-- StockTransfers
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'StockTransfers')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StockTransfers_Status' AND object_id = OBJECT_ID('StockTransfers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_StockTransfers_Status ON StockTransfers(Status);
        PRINT 'Created index IX_StockTransfers_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StockTransfers_FromWarehouseId' AND object_id = OBJECT_ID('StockTransfers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_StockTransfers_FromWarehouseId ON StockTransfers(FromWarehouseId);
        PRINT 'Created index IX_StockTransfers_FromWarehouseId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StockTransfers_ToWarehouseId' AND object_id = OBJECT_ID('StockTransfers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_StockTransfers_ToWarehouseId ON StockTransfers(ToWarehouseId);
        PRINT 'Created index IX_StockTransfers_ToWarehouseId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StockTransfers_CommodityId' AND object_id = OBJECT_ID('StockTransfers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_StockTransfers_CommodityId ON StockTransfers(CommodityId);
        PRINT 'Created index IX_StockTransfers_CommodityId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_StockTransfers_TransferNumber' AND object_id = OBJECT_ID('StockTransfers'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_StockTransfers_TransferNumber ON StockTransfers(TransferNumber);
        PRINT 'Created index IX_StockTransfers_TransferNumber';
    END
END

-- ============================================================
-- WarehouseInventory
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'WarehouseInventory')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WarehouseInventory_WarehouseId' AND object_id = OBJECT_ID('WarehouseInventory'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_WarehouseInventory_WarehouseId ON WarehouseInventory(WarehouseId);
        PRINT 'Created index IX_WarehouseInventory_WarehouseId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WarehouseInventory_CommodityId' AND object_id = OBJECT_ID('WarehouseInventory'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_WarehouseInventory_CommodityId ON WarehouseInventory(CommodityId);
        PRINT 'Created index IX_WarehouseInventory_CommodityId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_WarehouseInventory_WarehouseId_CommodityId' AND object_id = OBJECT_ID('WarehouseInventory'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_WarehouseInventory_WarehouseId_CommodityId ON WarehouseInventory(WarehouseId, CommodityId) INCLUDE (QuantityOnHand);
        PRINT 'Created index IX_WarehouseInventory_WarehouseId_CommodityId';
    END
END

-- ============================================================
-- Warehouses
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Warehouses')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Warehouses_Status' AND object_id = OBJECT_ID('Warehouses'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Warehouses_Status ON Warehouses(Status);
        PRINT 'Created index IX_Warehouses_Status';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Warehouses_Code' AND object_id = OBJECT_ID('Warehouses'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Warehouses_Code ON Warehouses(Code);
        PRINT 'Created index IX_Warehouses_Code';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Warehouses_Province' AND object_id = OBJECT_ID('Warehouses'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Warehouses_Province ON Warehouses(Province);
        PRINT 'Created index IX_Warehouses_Province';
    END
END

-- ============================================================
-- Extensions (phone directory)
-- ============================================================
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Extensions')
BEGIN
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Extensions_UserId' AND object_id = OBJECT_ID('Extensions'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Extensions_UserId ON Extensions(UserId);
        PRINT 'Created index IX_Extensions_UserId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Extensions_DepartmentId' AND object_id = OBJECT_ID('Extensions'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Extensions_DepartmentId ON Extensions(DepartmentId);
        PRINT 'Created index IX_Extensions_DepartmentId';
    END

    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Extensions_IsActive' AND object_id = OBJECT_ID('Extensions'))
    BEGIN
        CREATE NONCLUSTERED INDEX IX_Extensions_IsActive ON Extensions(IsActive);
        PRINT 'Created index IX_Extensions_IsActive';
    END
END

PRINT '';
PRINT '=== Performance indexes created successfully ===';
