-- Add TFN-related columns to existing tables

-- Add TFN columns to Vehicles table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vehicles') AND name = 'TfnSubAccountNumber')
BEGIN
    ALTER TABLE Vehicles ADD TfnSubAccountNumber NVARCHAR(100);
    PRINT 'Added TfnSubAccountNumber to Vehicles table';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vehicles') AND name = 'TfnVehicleId')
BEGIN
    ALTER TABLE Vehicles ADD TfnVehicleId NVARCHAR(100);
    PRINT 'Added TfnVehicleId to Vehicles table';
END

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Vehicles') AND name = 'TfnVirtualCardNumber')
BEGIN
    ALTER TABLE Vehicles ADD TfnVirtualCardNumber NVARCHAR(50);
    PRINT 'Added TfnVirtualCardNumber to Vehicles table';
END

-- Add TFN column to Drivers table
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Drivers') AND name = 'TfnDriverId')
BEGIN
    ALTER TABLE Drivers ADD TfnDriverId NVARCHAR(100);
    PRINT 'Added TfnDriverId to Drivers table';
END

PRINT 'TFN column additions completed successfully';
