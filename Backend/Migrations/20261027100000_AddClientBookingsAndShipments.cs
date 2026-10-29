using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>
    /// Client bookings and tracked shipment lifecycle (order-to-cash tender work).
    /// A booking becomes one or more shipments; shipments are planned onto existing Loads
    /// and every scan / Cartrack event appends to ShipmentEvents. Idempotent raw SQL so it
    /// is safe against schema drift.
    /// </summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261027100000_AddClientBookingsAndShipments")]
    public partial class AddClientBookingsAndShipments : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('NumberSequences','U') IS NULL
CREATE TABLE [NumberSequences] (
    [Key] nvarchar(30) NOT NULL CONSTRAINT PK_NumberSequences PRIMARY KEY,
    [NextValue] int NOT NULL CONSTRAINT DF_NumberSequences_NextValue DEFAULT 1
);

IF OBJECT_ID('ShipmentAddresses','U') IS NULL
CREATE TABLE [ShipmentAddresses] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShipmentAddresses PRIMARY KEY,
    [CustomerId] int NULL,
    [Label] nvarchar(100) NULL,
    [Line1] nvarchar(200) NOT NULL,
    [Line2] nvarchar(200) NULL,
    [Suburb] nvarchar(100) NULL,
    [City] nvarchar(100) NULL,
    [Province] nvarchar(100) NULL,
    [PostalCode] nvarchar(20) NULL,
    [Latitude] float NULL,
    [Longitude] float NULL,
    [GooglePlaceId] nvarchar(512) NULL,
    [ContactName] nvarchar(150) NULL,
    [ContactPhone] nvarchar(50) NULL,
    [ContactEmail] nvarchar(200) NULL,
    [GeofenceRadiusM] int NOT NULL CONSTRAINT DF_ShipmentAddresses_Geofence DEFAULT 500,
    [IsSaved] bit NOT NULL CONSTRAINT DF_ShipmentAddresses_IsSaved DEFAULT 0,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_ShipmentAddresses_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL,
    [CreatedByUserId] int NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentAddresses_CustomerId_IsSaved')
    CREATE INDEX IX_ShipmentAddresses_CustomerId_IsSaved ON [ShipmentAddresses]([CustomerId],[IsSaved]);

IF OBJECT_ID('ClientBookings','U') IS NULL
CREATE TABLE [ClientBookings] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ClientBookings PRIMARY KEY,
    [BookingNo] nvarchar(20) NOT NULL,
    [CustomerId] int NOT NULL,
    [Source] nvarchar(20) NOT NULL CONSTRAINT DF_ClientBookings_Source DEFAULT 'portal',
    [ClientReference] nvarchar(50) NULL,
    [Status] nvarchar(30) NOT NULL CONSTRAINT DF_ClientBookings_Status DEFAULT 'BOOKED',
    [RequestedByName] nvarchar(150) NULL,
    [RequestedByEmail] nvarchar(200) NULL,
    [RequestedByPhone] nvarchar(50) NULL,
    [RejectionReason] nvarchar(500) NULL,
    [Notes] nvarchar(1000) NULL,
    [CreatedByUserId] int NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_ClientBookings_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL,
    [ConfirmedAt] datetime2 NULL,
    [ConfirmedByUserId] int NULL,
    CONSTRAINT FK_ClientBookings_LogisticsCustomers FOREIGN KEY ([CustomerId]) REFERENCES [LogisticsCustomers]([Id])
);
-- Repair for databases where the first cut of this migration pointed the FK at [Customers]
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ClientBookings_Customers')
BEGIN
    ALTER TABLE [ClientBookings] DROP CONSTRAINT FK_ClientBookings_Customers;
    ALTER TABLE [ClientBookings] ADD CONSTRAINT FK_ClientBookings_LogisticsCustomers FOREIGN KEY ([CustomerId]) REFERENCES [LogisticsCustomers]([Id]);
END
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ClientBookings_BookingNo')
    CREATE UNIQUE INDEX IX_ClientBookings_BookingNo ON [ClientBookings]([BookingNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ClientBookings_CustomerId_Status')
    CREATE INDEX IX_ClientBookings_CustomerId_Status ON [ClientBookings]([CustomerId],[Status]);

IF OBJECT_ID('Shipments','U') IS NULL
CREATE TABLE [Shipments] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Shipments PRIMARY KEY,
    [BookingId] int NOT NULL,
    [PickupAddressId] int NOT NULL,
    [DeliveryAddressId] int NOT NULL,
    [CollectionDate] datetime2 NOT NULL,
    [CollectionWindowFrom] nvarchar(5) NULL,
    [CollectionWindowTo] nvarchar(5) NULL,
    [RequestedDeliveryDate] datetime2 NOT NULL,
    [Status] nvarchar(30) NOT NULL CONSTRAINT DF_Shipments_Status DEFAULT 'BOOKED',
    [LoadId] int NULL,
    [PickupStopId] int NULL,
    [DeliveryStopId] int NULL,
    [Eta] datetime2 NULL,
    [Fragile] bit NOT NULL CONSTRAINT DF_Shipments_Fragile DEFAULT 0,
    [Hazardous] bit NOT NULL CONSTRAINT DF_Shipments_Hazardous DEFAULT 0,
    [HazardClass] nvarchar(20) NULL,
    [TemperatureRange] nvarchar(50) NULL,
    [DamagedFlag] bit NOT NULL CONSTRAINT DF_Shipments_Damaged DEFAULT 0,
    [ShortFlag] bit NOT NULL CONSTRAINT DF_Shipments_Short DEFAULT 0,
    [SpecialInstructions] nvarchar(1000) NULL,
    [TotalWeightKg] decimal(18,3) NOT NULL CONSTRAINT DF_Shipments_Weight DEFAULT 0,
    [TotalPallets] int NOT NULL CONSTRAINT DF_Shipments_Pallets DEFAULT 0,
    [TotalParcels] int NOT NULL CONSTRAINT DF_Shipments_Parcels DEFAULT 0,
    [CollectedAt] datetime2 NULL,
    [DeliveredAt] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_Shipments_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT FK_Shipments_ClientBookings FOREIGN KEY ([BookingId]) REFERENCES [ClientBookings]([Id]) ON DELETE CASCADE,
    CONSTRAINT FK_Shipments_PickupAddress FOREIGN KEY ([PickupAddressId]) REFERENCES [ShipmentAddresses]([Id]),
    CONSTRAINT FK_Shipments_DeliveryAddress FOREIGN KEY ([DeliveryAddressId]) REFERENCES [ShipmentAddresses]([Id]),
    CONSTRAINT FK_Shipments_Loads FOREIGN KEY ([LoadId]) REFERENCES [Loads]([Id]) ON DELETE SET NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Shipments_Status') CREATE INDEX IX_Shipments_Status ON [Shipments]([Status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Shipments_LoadId') CREATE INDEX IX_Shipments_LoadId ON [Shipments]([LoadId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Shipments_CollectionDate') CREATE INDEX IX_Shipments_CollectionDate ON [Shipments]([CollectionDate]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_Shipments_BookingId') CREATE INDEX IX_Shipments_BookingId ON [Shipments]([BookingId]);

IF OBJECT_ID('ShipmentItems','U') IS NULL
CREATE TABLE [ShipmentItems] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShipmentItems PRIMARY KEY,
    [ShipmentId] int NOT NULL,
    [Type] nvarchar(20) NOT NULL CONSTRAINT DF_ShipmentItems_Type DEFAULT 'parcel',
    [Qty] int NOT NULL CONSTRAINT DF_ShipmentItems_Qty DEFAULT 1,
    [WeightKg] decimal(18,3) NOT NULL CONSTRAINT DF_ShipmentItems_Weight DEFAULT 0,
    [LengthCm] decimal(18,2) NULL,
    [WidthCm] decimal(18,2) NULL,
    [HeightCm] decimal(18,2) NULL,
    [Description] nvarchar(300) NULL,
    [ItemBarcode] nvarchar(40) NULL,
    CONSTRAINT FK_ShipmentItems_Shipments FOREIGN KEY ([ShipmentId]) REFERENCES [Shipments]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentItems_ShipmentId') CREATE INDEX IX_ShipmentItems_ShipmentId ON [ShipmentItems]([ShipmentId]);

IF OBJECT_ID('ShipmentWaybills','U') IS NULL
CREATE TABLE [ShipmentWaybills] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShipmentWaybills PRIMARY KEY,
    [WaybillNo] nvarchar(20) NOT NULL,
    [ShipmentId] int NOT NULL,
    [BarcodeValue] nvarchar(40) NOT NULL,
    [QrValue] nvarchar(300) NOT NULL,
    [TrackingToken] nvarchar(40) NOT NULL,
    [IssuedAt] datetime2 NOT NULL CONSTRAINT DF_ShipmentWaybills_IssuedAt DEFAULT SYSUTCDATETIME(),
    [IssuedByUserId] int NULL,
    CONSTRAINT FK_ShipmentWaybills_Shipments FOREIGN KEY ([ShipmentId]) REFERENCES [Shipments]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentWaybills_WaybillNo') CREATE UNIQUE INDEX IX_ShipmentWaybills_WaybillNo ON [ShipmentWaybills]([WaybillNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentWaybills_TrackingToken') CREATE UNIQUE INDEX IX_ShipmentWaybills_TrackingToken ON [ShipmentWaybills]([TrackingToken]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentWaybills_ShipmentId') CREATE UNIQUE INDEX IX_ShipmentWaybills_ShipmentId ON [ShipmentWaybills]([ShipmentId]);

IF OBJECT_ID('ShipmentEvents','U') IS NULL
CREATE TABLE [ShipmentEvents] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShipmentEvents PRIMARY KEY,
    [ShipmentId] int NOT NULL,
    [FromStatus] nvarchar(30) NULL,
    [ToStatus] nvarchar(30) NOT NULL,
    [Source] nvarchar(20) NOT NULL CONSTRAINT DF_ShipmentEvents_Source DEFAULT 'system',
    [UserId] int NULL,
    [UserName] nvarchar(150) NULL,
    [Latitude] float NULL,
    [Longitude] float NULL,
    [ScannedCode] nvarchar(300) NULL,
    [Note] nvarchar(1000) NULL,
    [OccurredAt] datetime2 NOT NULL CONSTRAINT DF_ShipmentEvents_OccurredAt DEFAULT SYSUTCDATETIME(),
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_ShipmentEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ShipmentEvents_Shipments FOREIGN KEY ([ShipmentId]) REFERENCES [Shipments]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentEvents_ShipmentId_OccurredAt') CREATE INDEX IX_ShipmentEvents_ShipmentId_OccurredAt ON [ShipmentEvents]([ShipmentId],[OccurredAt]);

-- Append-only audit trail: block UPDATE/DELETE at the database level.
IF OBJECT_ID('TR_ShipmentEvents_AppendOnly','TR') IS NULL
    EXEC('CREATE TRIGGER TR_ShipmentEvents_AppendOnly ON [ShipmentEvents] AFTER UPDATE, DELETE AS BEGIN SET NOCOUNT ON; RAISERROR(''ShipmentEvents is append-only'',16,1); ROLLBACK TRANSACTION; END');

IF OBJECT_ID('ShipmentPods','U') IS NULL
CREATE TABLE [ShipmentPods] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShipmentPods PRIMARY KEY,
    [ShipmentId] int NOT NULL,
    [ReceiverName] nvarchar(150) NULL,
    [SignaturePath] nvarchar(300) NULL,
    [PhotoPathsJson] nvarchar(max) NULL,
    [Latitude] float NULL,
    [Longitude] float NULL,
    [DeliveredAt] datetime2 NOT NULL CONSTRAINT DF_ShipmentPods_DeliveredAt DEFAULT SYSUTCDATETIME(),
    [DriverId] int NULL,
    [DeviceId] nvarchar(100) NULL,
    [Note] nvarchar(1000) NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_ShipmentPods_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ShipmentPods_Shipments FOREIGN KEY ([ShipmentId]) REFERENCES [Shipments]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentPods_ShipmentId') CREATE UNIQUE INDEX IX_ShipmentPods_ShipmentId ON [ShipmentPods]([ShipmentId]);

IF OBJECT_ID('ShipmentExceptions','U') IS NULL
CREATE TABLE [ShipmentExceptions] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShipmentExceptions PRIMARY KEY,
    [ShipmentId] int NOT NULL,
    [Type] nvarchar(30) NOT NULL,
    [ReasonCode] nvarchar(50) NULL,
    [Note] nvarchar(1000) NULL,
    [PhotoPathsJson] nvarchar(max) NULL,
    [Latitude] float NULL,
    [Longitude] float NULL,
    [LoggedByDriverId] int NULL,
    [LoggedByUserId] int NULL,
    [ResolvedByUserId] int NULL,
    [Resolution] nvarchar(30) NULL,
    [ResolvedAt] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_ShipmentExceptions_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_ShipmentExceptions_Shipments FOREIGN KEY ([ShipmentId]) REFERENCES [Shipments]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentExceptions_ShipmentId') CREATE INDEX IX_ShipmentExceptions_ShipmentId ON [ShipmentExceptions]([ShipmentId]);

IF OBJECT_ID('ShipmentDriverScans','U') IS NULL
CREATE TABLE [ShipmentDriverScans] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShipmentDriverScans PRIMARY KEY,
    [ScanId] nvarchar(64) NOT NULL,
    [ShipmentId] int NULL,
    [Code] nvarchar(300) NOT NULL,
    [ScanType] nvarchar(20) NOT NULL,
    [DriverId] int NULL,
    [Latitude] float NULL,
    [Longitude] float NULL,
    [OccurredAt] datetime2 NOT NULL,
    [ReceivedAt] datetime2 NOT NULL CONSTRAINT DF_ShipmentDriverScans_ReceivedAt DEFAULT SYSUTCDATETIME(),
    [Result] nvarchar(30) NOT NULL,
    [Message] nvarchar(500) NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentDriverScans_ScanId') CREATE UNIQUE INDEX IX_ShipmentDriverScans_ScanId ON [ShipmentDriverScans]([ScanId]);

IF OBJECT_ID('ShipmentNotificationLogs','U') IS NULL
CREATE TABLE [ShipmentNotificationLogs] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ShipmentNotificationLogs PRIMARY KEY,
    [ShipmentId] int NOT NULL,
    [Channel] nvarchar(10) NOT NULL,
    [Recipient] nvarchar(200) NOT NULL,
    [Template] nvarchar(50) NOT NULL,
    [Status] nvarchar(20) NOT NULL,
    [ProviderMessageId] nvarchar(200) NULL,
    [Error] nvarchar(1000) NULL,
    [SentAt] datetime2 NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_ShipmentNotificationLogs_CreatedAt DEFAULT SYSUTCDATETIME()
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_ShipmentNotificationLogs_ShipmentId') CREATE INDEX IX_ShipmentNotificationLogs_ShipmentId ON [ShipmentNotificationLogs]([ShipmentId]);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('TR_ShipmentEvents_AppendOnly','TR') IS NOT NULL DROP TRIGGER TR_ShipmentEvents_AppendOnly;
DROP TABLE IF EXISTS [ShipmentNotificationLogs];
DROP TABLE IF EXISTS [ShipmentDriverScans];
DROP TABLE IF EXISTS [ShipmentExceptions];
DROP TABLE IF EXISTS [ShipmentPods];
DROP TABLE IF EXISTS [ShipmentEvents];
DROP TABLE IF EXISTS [ShipmentWaybills];
DROP TABLE IF EXISTS [ShipmentItems];
DROP TABLE IF EXISTS [Shipments];
DROP TABLE IF EXISTS [ClientBookings];
DROP TABLE IF EXISTS [ShipmentAddresses];
DROP TABLE IF EXISTS [NumberSequences];
");
        }
    }
}
