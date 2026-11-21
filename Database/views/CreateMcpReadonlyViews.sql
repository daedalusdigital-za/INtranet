-- =============================================================================
-- MCP Logistics connector — least-privilege hardening
-- Creates read-only views (vw_mcp_*) exposing only what each tool needs, plus a
-- dedicated login/user (mcp_readonly) granted SELECT on those views ONLY.
-- The connector then connects as mcp_readonly instead of sa.
--
-- Safe to re-run (idempotent): drops+recreates views, creates login/user if absent.
-- =============================================================================

USE ProjectTrackerDB;
GO

-- ----- Views ----------------------------------------------------------------

CREATE OR ALTER VIEW dbo.vw_mcp_pending_invoices AS
    SELECT Id, TransactionNumber, CustomerName, CustomerNumber, CustomerId,
           ProductCode, ProductDescription, Quantity, DeliveredQuantity,
           SalesAmount, SalesReturns, (SalesAmount - SalesReturns) AS NetSales,
           CostOfSales, MarginPercent,
           (SalesAmount - SalesReturns - CostOfSales) AS GrossProfit,
           SourceCompany, Location, DeliveryAddress, DeliveryCity, DeliveryProvince,
           DeliveryPostalCode, ContactPerson, ContactPhone, ContactEmail,
           ScheduledDeliveryDate, DeliveryDeadline, DeliveryPriority, DeliveryNotes,
           Status, TransactionType, TransactionDate, LoadId
    FROM dbo.ImportedInvoices;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_loads AS
    SELECT l.Id, l.LoadNumber, l.Status, l.Priority,
           l.ScheduledPickupDate, l.ActualPickupDate,
           l.ScheduledDeliveryDate, l.ActualDeliveryDate,
           l.PickupLocation, l.DeliveryLocation,
           l.EstimatedCost, l.ActualCost, l.ChargeAmount,
           l.EstimatedDistance, l.ActualDistance,
           l.TotalWeight, l.TotalVolume, l.SpecialInstructions, l.Notes,
           l.DriverId, l.VehicleId, l.WarehouseId,
           d.FirstName + ' ' + d.LastName AS DriverName,
           v.RegistrationNumber AS VehicleReg,
           w.Name AS WarehouseName
    FROM dbo.Loads l
    LEFT JOIN dbo.Drivers d ON d.Id = l.DriverId
    LEFT JOIN dbo.Vehicles v ON v.Id = l.VehicleId
    LEFT JOIN dbo.Warehouses w ON w.Id = l.WarehouseId;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_load_invoices AS
    SELECT Id, LoadId, TransactionNumber, CustomerName, CustomerNumber,
           ProductCode, ProductDescription, Quantity, DeliveredQuantity,
           SalesAmount, SalesReturns, (SalesAmount - SalesReturns) AS NetSales,
           CostOfSales, MarginPercent,
           (SalesAmount - SalesReturns - CostOfSales) AS GrossProfit,
           DeliveryCity, DeliveryProvince, Status
    FROM dbo.ImportedInvoices;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_warehouses AS
    SELECT Id, Name, Code, City, Province, Address,
           TotalCapacity, AvailableCapacity, ManagerName, PhoneNumber, Status
    FROM dbo.Warehouses;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_drivers AS
    SELECT Id, FirstName, LastName, LicenseNumber, LicenseType,
           LicenseExpiryDate, PhoneNumber, Status
    FROM dbo.Drivers;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_vehicles AS
    SELECT Id, RegistrationNumber, Make, Model, Year, Status,
           CurrentOdometer, Province, LastKnownAddress, LastLocationUpdate,
           FuelType, AverageFuelConsumption
    FROM dbo.Vehicles;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_sales_history AS
    SELECT Id, CustomerName, CustomerNumber, InvoiceNumber, ShipmentNumber, OrderNumber,
           SourceCompany, Location, InvoiceDate, SalesAmount, TotalCost, GrossProfit,
           MarginPercent, IsReconciled, HasLineDetail, SourceFileName
    FROM dbo.SalesHistoryRecords;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_pods AS
    SELECT Id, PodNumber, DriverName, DriverId, DeliveryDate, Region,
           LoadId, InvoiceId, OriginalFileName, FileName, FilePath,
           ContentType, FileSize, Notes, UploadedAt
    FROM dbo.PodDocuments;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_maintenance AS
    SELECT m.Id, m.VehicleId, v.RegistrationNumber AS VehicleReg,
           m.MaintenanceType, m.Description, m.Status, m.Priority,
           m.ScheduledDate, m.CompletedDate, m.NextServiceDate,
           m.Cost, m.EstimatedCost, m.ServiceProvider, m.Province, m.ActionOwner
    FROM dbo.VehicleMaintenance m
    LEFT JOIN dbo.Vehicles v ON v.Id = m.VehicleId;
GO

-- Delivered loads with no POD; HoursSinceDelivery lets the tool apply a threshold.
CREATE OR ALTER VIEW dbo.vw_mcp_outstanding_pods AS
    SELECT l.Id AS LoadId, l.LoadNumber, l.Status,
           l.ActualDeliveryDate, l.DeliveryLocation,
           d.FirstName + ' ' + d.LastName AS DriverName,
           v.RegistrationNumber AS VehicleReg,
           DATEDIFF(hour, l.ActualDeliveryDate, GETDATE()) AS HoursSinceDelivery
    FROM dbo.Loads l
    LEFT JOIN dbo.Drivers d ON d.Id = l.DriverId
    LEFT JOIN dbo.Vehicles v ON v.Id = l.VehicleId
    WHERE l.ActualDeliveryDate IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM dbo.PodDocuments p WHERE p.LoadId = l.Id);
GO

CREATE OR ALTER VIEW dbo.vw_mcp_tripsheets AS
    SELECT Id, TripSheetNumber, Status, RouteArea, WarehouseCode, ScheduledDate,
           CreatedByName, CreatedAt, CheckedByName, CheckedAt,
           ApproverName, SignedByName, SignedAt, ConvertedLoadNumber
    FROM dbo.SalesTripSheets;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_tripsheet_detail AS
    SELECT Id, TripSheetNumber, Status, RouteArea, WarehouseCode, WarehouseId,
           ScheduledDate, Notes, CreatedByName, CreatedAt, UpdatedAt,
           CheckedByName, CheckedAt, ApprovalNotes, RejectionReason,
           ApproverName, SignerName, SignedAt, SignedByName,
           ConvertedLoadId, ConvertedLoadNumber
    FROM dbo.SalesTripSheets;
GO

CREATE OR ALTER VIEW dbo.vw_mcp_tripsheet_lines AS
    SELECT Id, SalesTripSheetId, Sequence, CustomerName, InvoiceNumber,
           Address, City, Province, ContactPerson, ContactPhone,
           ProductDescription, Quantity, Value
    FROM dbo.SalesTripSheetLines;
GO

-- Fuel transactions (TFN/Puma sync + manual), joined to vehicle registration.
CREATE OR ALTER VIEW dbo.vw_mcp_fuel_transactions AS
    SELECT f.Id, f.VehicleId, COALESCE(f.RegistrationNumber, v.RegistrationNumber) AS RegistrationNumber,
           f.CardNumber, f.DepotName, f.DepotAssignment,
           f.AllocationLitres, f.LitresUsed, f.AmountSpent,
           f.TransactionDate, f.ReportMonth, f.ReportYear, f.Source, f.Notes
    FROM dbo.FuelTransactions f
    LEFT JOIN dbo.Vehicles v ON v.Id = f.VehicleId;
GO

-- TFN fuel card transactions with efficiency & anomaly analysis.
CREATE OR ALTER VIEW dbo.vw_mcp_tfn_transactions AS
    SELECT t.Id, t.TransactionNumber, t.TransactionDate,
           t.VehicleId, v.RegistrationNumber AS VehicleReg,
           t.DriverId, d.FirstName + ' ' + d.LastName AS DriverName,
           t.FuelType, t.Litres, t.PricePerLitre, t.TotalAmount, t.VatAmount,
           t.OdometerReading, t.FuelEfficiency, t.DistanceSinceLastFill,
           t.ExpectedLitres, t.VarianceLitres, t.VariancePercentage,
           t.IsAnomaly, t.AnomalyReason, t.LoadId
    FROM dbo.TfnTransactions t
    LEFT JOIN dbo.Vehicles v ON v.Id = t.VehicleId
    LEFT JOIN dbo.Drivers d ON d.Id = t.DriverId;
GO

-- TFN fuel orders (allocations vs usage).
CREATE OR ALTER VIEW dbo.vw_mcp_fuel_orders AS
    SELECT o.Id, o.OrderNumber, o.OrderDate, o.Status,
           o.VehicleId, COALESCE(o.VehicleRegistration, v.RegistrationNumber) AS VehicleReg,
           o.DriverId, d.FirstName + ' ' + d.LastName AS DriverName,
           o.FuelType, o.OrderedLitres, o.AllocatedLitres, o.AllocatedAmount,
           o.UsedLitres, o.UsedAmount, o.RemainingLitres, o.RemainingAmount,
           o.IsPlanned, o.ExpiryDate, o.LoadId
    FROM dbo.TfnOrders o
    LEFT JOIN dbo.Vehicles v ON v.Id = o.VehicleId
    LEFT JOIN dbo.Drivers d ON d.Id = o.DriverId;
GO

-- Vehicle movement history (CarTrack trips): distance, speed, idle and the
-- harsh-driving events that make up a driver/fuel behaviour score.
CREATE OR ALTER VIEW dbo.vw_mcp_vehicle_movements AS
    SELECT Id, VehicleId, RegistrationNumber, MovementDate,
           StartTimestamp, EndTimestamp, TripDuration, TripDurationSeconds,
           StartLocation, EndLocation, StartGeofence, EndGeofence,
           TripDistance, MaxSpeed, IdleTimeSeconds,
           HarshBrakingEvents, HarshCorneringEvents, HarshAccelerationEvents
    FROM dbo.VehicleMovementHistory;
GO

-- Logistics customers (operational fields only; financial credit/balance omitted).
CREATE OR ALTER VIEW dbo.vw_mcp_customers AS
    SELECT Id, CustomerCode, Name, ShortName, ContactPerson,
           ContactEmail, ContactPhone, MobileNumber,
           CompanyRegistration, VatNumber, PaymentTerms, CreditLimit,
           PhysicalAddress, City, Province, PostalCode, Country,
           DeliveryAddress, DeliveryCity, DeliveryProvince, DeliveryPostalCode,
           Latitude, Longitude, AddressVerified, GooglePlaceId,
           Status, SourceSystem
    FROM dbo.LogisticsCustomers;
GO

-- Saved, geocoded delivery addresses per customer.
CREATE OR ALTER VIEW dbo.vw_mcp_customer_addresses AS
    SELECT Id, CustomerId, AddressLabel, Address, City, Province, PostalCode, Country,
           ContactPerson, ContactPhone, Latitude, Longitude, FormattedAddress,
           IsDefault, IsActive, DeliveryInstructions, UsageCount, LastUsedAt
    FROM dbo.CustomerDeliveryAddresses;
GO

-- Stock on hand by warehouse & commodity, with reorder/max levels so the tool
-- can flag below-reorder lines. QtyAvailable = on-hand minus a simple reorder buffer.
CREATE OR ALTER VIEW dbo.vw_mcp_stock_on_hand AS
    SELECT i.Id, i.WarehouseId, w.Name AS WarehouseName, w.Code AS WarehouseCode,
           w.City AS WarehouseCity, w.Province AS WarehouseProvince,
           i.CommodityId, c.Name AS CommodityName, c.Code AS CommodityCode,
           c.Category, c.UnitOfMeasure,
           i.QuantityOnHand, i.ReorderLevel, i.MaximumLevel, i.BinLocation,
           i.LastCountDate, i.LastRestockDate,
           CASE WHEN i.ReorderLevel IS NOT NULL AND i.QuantityOnHand <= i.ReorderLevel
                THEN 1 ELSE 0 END AS BelowReorder
    FROM dbo.WarehouseInventory i
    LEFT JOIN dbo.Warehouses w ON w.Id = i.WarehouseId
    LEFT JOIN dbo.Commodities c ON c.Id = i.CommodityId;
GO

-- ----- Least-privilege login/user -------------------------------------------
-- NOTE: change the password here AND in .env (MCP_DB_PASSWORD) to match.

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = 'mcp_readonly')
BEGIN
    CREATE LOGIN mcp_readonly WITH PASSWORD = 'McpR3ad0nly@2026!', CHECK_POLICY = OFF;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'mcp_readonly')
BEGIN
    CREATE USER mcp_readonly FOR LOGIN mcp_readonly;
END
GO

-- Grant SELECT on the views ONLY (no base-table access, no writes, no DDL).
GRANT SELECT ON dbo.vw_mcp_pending_invoices   TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_loads              TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_load_invoices      TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_warehouses         TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_drivers            TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_vehicles           TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_sales_history      TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_pods               TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_maintenance        TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_outstanding_pods   TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_tripsheets         TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_tripsheet_detail   TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_tripsheet_lines    TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_fuel_transactions  TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_tfn_transactions   TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_fuel_orders        TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_vehicle_movements  TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_customers          TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_customer_addresses TO mcp_readonly;
GRANT SELECT ON dbo.vw_mcp_stock_on_hand      TO mcp_readonly;
GO

PRINT 'MCP hardening applied: 20 views + mcp_readonly login with SELECT on views only.';
GO
