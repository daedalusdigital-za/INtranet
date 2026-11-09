using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using ProjectTracker.API.Data;

#nullable disable

namespace ProjectTracker.API.Migrations
{
    /// <summary>Client portal "Get Quote": priced draft bookings saved for later placement.</summary>
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20261112100000_AddPortalQuotes")]
    public partial class AddPortalQuotes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID('PortalQuotes','U') IS NULL
CREATE TABLE [PortalQuotes] (
    [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT PK_PortalQuotes PRIMARY KEY,
    [QuoteNo] nvarchar(20) NOT NULL,
    [CustomerId] int NOT NULL,
    [PortalUserId] int NOT NULL,
    [ClientReference] nvarchar(50) NULL,
    [RequestJson] nvarchar(max) NOT NULL CONSTRAINT DF_PortalQuotes_RequestJson DEFAULT '{}',
    [PricingJson] nvarchar(max) NOT NULL CONSTRAINT DF_PortalQuotes_PricingJson DEFAULT '{}',
    [ShipmentCount] int NOT NULL CONSTRAINT DF_PortalQuotes_ShipmentCount DEFAULT 0,
    [TotalWeightKg] decimal(18,2) NOT NULL CONSTRAINT DF_PortalQuotes_TotalWeightKg DEFAULT 0,
    [DistanceKm] decimal(18,2) NOT NULL CONSTRAINT DF_PortalQuotes_DistanceKm DEFAULT 0,
    [Subtotal] decimal(18,2) NOT NULL CONSTRAINT DF_PortalQuotes_Subtotal DEFAULT 0,
    [Vat] decimal(18,2) NOT NULL CONSTRAINT DF_PortalQuotes_Vat DEFAULT 0,
    [Total] decimal(18,2) NOT NULL CONSTRAINT DF_PortalQuotes_Total DEFAULT 0,
    [Status] nvarchar(20) NOT NULL CONSTRAINT DF_PortalQuotes_Status DEFAULT 'DRAFT',
    [ValidUntil] datetime2 NOT NULL,
    [BookingId] int NULL,
    [BookingNo] nvarchar(20) NULL,
    [CreatedAt] datetime2 NOT NULL CONSTRAINT DF_PortalQuotes_CreatedAt DEFAULT SYSUTCDATETIME(),
    [UpdatedAt] datetime2 NULL,
    CONSTRAINT FK_PortalQuotes_PortalUsers FOREIGN KEY ([PortalUserId]) REFERENCES [PortalUsers]([Id]) ON DELETE CASCADE
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='UX_PortalQuotes_QuoteNo') CREATE UNIQUE INDEX UX_PortalQuotes_QuoteNo ON [PortalQuotes]([QuoteNo]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='IX_PortalQuotes_Customer_Status') CREATE INDEX IX_PortalQuotes_Customer_Status ON [PortalQuotes]([CustomerId],[Status],[CreatedAt]);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TABLE IF EXISTS [PortalQuotes];");
        }
    }
}
