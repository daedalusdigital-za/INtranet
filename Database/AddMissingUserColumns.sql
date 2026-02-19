-- Add missing columns to Users table
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Surname')
    ALTER TABLE Users ADD Surname NVARCHAR(100) NOT NULL DEFAULT '';

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Title')
    ALTER TABLE Users ADD Title NVARCHAR(100) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Permissions')
    ALTER TABLE Users ADD Permissions NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ProfilePictureUrl')
    ALTER TABLE Users ADD ProfilePictureUrl NVARCHAR(500) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ProfilePictureData')
    ALTER TABLE Users ADD ProfilePictureData VARBINARY(MAX) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'ProfilePictureMimeType')
    ALTER TABLE Users ADD ProfilePictureMimeType NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'LinkedEmpId')
    ALTER TABLE Users ADD LinkedEmpId NVARCHAR(50) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'Birthday')
    ALTER TABLE Users ADD Birthday DATETIME2 NULL;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'IsActive')
    ALTER TABLE Users ADD IsActive BIT NOT NULL DEFAULT 1;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'LastLoginAt')
    ALTER TABLE Users ADD LastLoginAt DATETIME2 NULL;

PRINT 'All missing User columns added successfully';
