-- Create CRM Tables
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OperatingCompanies')
BEGIN
    CREATE TABLE OperatingCompanies (
        OperatingCompanyId INT IDENTITY(1,1) PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        Code NVARCHAR(50) NOT NULL UNIQUE,
        Description NVARCHAR(1000) NULL,
        LogoUrl NVARCHAR(500) NULL,
        PrimaryColor NVARCHAR(20) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StaffOperatingCompanies')
BEGIN
    CREATE TABLE StaffOperatingCompanies (
        StaffOperatingCompanyId INT IDENTITY(1,1) PRIMARY KEY,
        StaffMemberId INT NOT NULL,
        OperatingCompanyId INT NOT NULL,
        CompanyRole NVARCHAR(100) NULL,
        IsPrimaryCompany BIT NOT NULL DEFAULT 0,
        JoinedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        FOREIGN KEY (StaffMemberId) REFERENCES Users(UserId),
        FOREIGN KEY (OperatingCompanyId) REFERENCES OperatingCompanies(OperatingCompanyId)
    );
    
    CREATE UNIQUE INDEX IX_StaffOperatingCompanies_StaffId_CompanyId 
    ON StaffOperatingCompanies(StaffMemberId, OperatingCompanyId);
END
GO

-- Create other CRM tables if they don't exist
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'LeadStatuses')
BEGIN
    CREATE TABLE LeadStatuses (
        LeadStatusId INT IDENTITY(1,1) PRIMARY KEY,
        OperatingCompanyId INT NOT NULL,
        StatusName NVARCHAR(100) NOT NULL,
        StatusColor NVARCHAR(20) NULL,
        StatusOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        FOREIGN KEY (OperatingCompanyId) REFERENCES OperatingCompanies(OperatingCompanyId)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Leads')
BEGIN
    CREATE TABLE Leads (
        LeadId INT IDENTITY(1,1) PRIMARY KEY,
        OperatingCompanyId INT NOT NULL,
        FirstName NVARCHAR(100) NOT NULL,
        LastName NVARCHAR(100) NULL,
        CompanyName NVARCHAR(200) NULL,
        JobTitle NVARCHAR(100) NULL,
        Email NVARCHAR(255) NULL,
        Phone NVARCHAR(50) NULL,
        MobilePhone NVARCHAR(50) NULL,
        Address NVARCHAR(500) NULL,
        City NVARCHAR(100) NULL,
        Region NVARCHAR(100) NULL,
        PostalCode NVARCHAR(20) NULL,
        Country NVARCHAR(100) NULL,
        LeadSource NVARCHAR(100) NULL,
        LeadStatusId INT NULL,
        AssignedAgentId INT NULL,
        EstimatedValue DECIMAL(18,2) NULL,
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        LastContactedAt DATETIME2 NULL,
        FOREIGN KEY (OperatingCompanyId) REFERENCES OperatingCompanies(OperatingCompanyId),
        FOREIGN KEY (LeadStatusId) REFERENCES LeadStatuses(LeadStatusId),
        FOREIGN KEY (AssignedAgentId) REFERENCES Users(UserId)
    );
    
    CREATE INDEX IX_Leads_OperatingCompanyId_AssignedAgentId 
    ON Leads(OperatingCompanyId, AssignedAgentId);
    
    CREATE INDEX IX_Leads_OperatingCompanyId_LeadStatusId 
    ON Leads(OperatingCompanyId, LeadStatusId);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Campaigns')
BEGIN
    CREATE TABLE Campaigns (
        CampaignId INT IDENTITY(1,1) PRIMARY KEY,
        OperatingCompanyId INT NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Description NVARCHAR(1000) NULL,
        StartDate DATETIME2 NULL,
        EndDate DATETIME2 NULL,
        Budget DECIMAL(18,2) NULL,
        ActualCost DECIMAL(18,2) NULL,
        Status NVARCHAR(50) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        FOREIGN KEY (OperatingCompanyId) REFERENCES OperatingCompanies(OperatingCompanyId)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Deals')
BEGIN
    CREATE TABLE Deals (
        DealId INT IDENTITY(1,1) PRIMARY KEY,
        OperatingCompanyId INT NOT NULL,
        LeadId INT NULL,
        DealName NVARCHAR(200) NOT NULL,
        Amount DECIMAL(18,2) NULL,
        CloseProbability INT NULL,
        ExpectedCloseDate DATETIME2 NULL,
        ActualCloseDate DATETIME2 NULL,
        Stage NVARCHAR(100) NULL,
        AssignedAgentId INT NULL,
        Notes NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        FOREIGN KEY (OperatingCompanyId) REFERENCES OperatingCompanies(OperatingCompanyId),
        FOREIGN KEY (LeadId) REFERENCES Leads(LeadId),
        FOREIGN KEY (AssignedAgentId) REFERENCES Users(UserId)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Products')
BEGIN
    CREATE TABLE Products (
        ProductId INT IDENTITY(1,1) PRIMARY KEY,
        OperatingCompanyId INT NOT NULL,
        ProductName NVARCHAR(200) NOT NULL,
        ProductCode NVARCHAR(50) NULL,
        Description NVARCHAR(1000) NULL,
        UnitPrice DECIMAL(18,2) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        UpdatedAt DATETIME2 NULL,
        FOREIGN KEY (OperatingCompanyId) REFERENCES OperatingCompanies(OperatingCompanyId)
    );
END
GO
