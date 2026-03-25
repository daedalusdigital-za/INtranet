-- ============================================================================
-- Sanitary Pads Project Tables + Seed Data from Excel
-- ============================================================================

-- Stock Received (GRV/GRN records)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PadsStockReceived')
CREATE TABLE PadsStockReceived (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    VendorName NVARCHAR(200) NOT NULL,
    GrnNumber NVARCHAR(50) NOT NULL,
    ItemCode NVARCHAR(50) NULL,
    ItemDescription NVARCHAR(200) DEFAULT 'SANITARY PADS',
    Reference NVARCHAR(100) NULL,
    InvoiceNumber NVARCHAR(100) NULL,
    Location NVARCHAR(50) NULL,
    InvoiceDate DATETIME NOT NULL,
    UOM NVARCHAR(20) DEFAULT 'BOX',
    QuantityReceived INT NOT NULL,
    UnitCost DECIMAL(18,2) NOT NULL,
    SubTotal DECIMAL(18,2) NOT NULL,
    Quarter INT NULL,
    Notes NVARCHAR(500) NULL,
    CreatedAt DATETIME DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME NULL
);

-- Stock Delivered
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PadsStockDelivered')
CREATE TABLE PadsStockDelivered (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    DeliveryReference NVARCHAR(100) NULL,
    InvoiceNumber NVARCHAR(100) NULL,
    QuantityDelivered INT NOT NULL,
    UOM NVARCHAR(20) DEFAULT 'BOX',
    Quarter INT NOT NULL,
    DeliveryDate DATETIME NOT NULL,
    Notes NVARCHAR(500) NULL,
    CreatedAt DATETIME DEFAULT GETUTCDATE()
);

-- Warehouse Stock
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PadsWarehouseStock')
CREATE TABLE PadsWarehouseStock (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    WarehouseName NVARCHAR(100) NOT NULL,
    StockType NVARCHAR(20) DEFAULT 'System',
    Quantity INT NOT NULL,
    UOM NVARCHAR(20) DEFAULT 'BOX',
    IsDamaged BIT DEFAULT 0,
    Notes NVARCHAR(500) NULL,
    SnapshotDate DATETIME DEFAULT GETUTCDATE(),
    CreatedAt DATETIME DEFAULT GETUTCDATE()
);

-- Credit Notes
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PadsCreditNotes')
CREATE TABLE PadsCreditNotes (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    CreditNoteNumber NVARCHAR(100) NOT NULL,
    CreditDate DATETIME NOT NULL,
    Description NVARCHAR(500) NULL,
    Amount DECIMAL(18,2) NULL,
    CreatedAt DATETIME DEFAULT GETUTCDATE()
);

-- Invoices Processed
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'PadsInvoicesProcessed')
CREATE TABLE PadsInvoicesProcessed (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    InvoiceReference NVARCHAR(100) NOT NULL,
    InvoiceDate DATETIME NOT NULL,
    Description NVARCHAR(500) NULL,
    Amount DECIMAL(18,2) NULL,
    CreatedAt DATETIME DEFAULT GETUTCDATE()
);
GO

-- ============================================================================
-- SEED DATA - From PADS STOCK REPORT.xlsx ANALYSIS sheet
-- ============================================================================

-- Quarter 1 Stock Received
INSERT INTO PadsStockReceived (VendorName, GrnNumber, ItemCode, ItemDescription, Reference, InvoiceNumber, Location, InvoiceDate, UOM, QuantityReceived, UnitCost, SubTotal, Quarter) VALUES
('PROMED PHARMACARE (PTY) LTD', 'GRV102411', 'PAD02WC', 'SANITARY PADS', 'IN302606', 'IN302606', '01', '2025-06-30', 'BOX', 4964, 450.00, 2233800.00, 1),
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102450', 'PAD02WC', 'SANITARY PADS', 'KOG010', 'IN0000488', '01', '2025-07-24', 'BOX', 1160, 414.00, 480240.00, 1),
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102451', 'PAD02WC', 'SANITARY PADS', 'KOG010', 'IN0000487', '01', '2025-07-24', 'BOX', 1121, 403.00, 451763.00, 1),
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102452', 'PAD02WC', 'SANITARY PADS', 'KOG010', 'IN0000486', '01', '2025-07-24', 'BOX', 1130, 403.00, 455390.00, 1),
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102455', 'PAD02WC', 'SANITARY PADS', 'KOG010', 'IN0000489', '01', '2025-07-25', 'BOX', 709, 414.00, 293526.00, 1),
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102459', 'PAD02WC', 'SANITARY PADS', 'KOG010', 'IN0000494', '04', '2025-07-26', 'BOX', 1163, 414.00, 481482.00, 1),
('PROMED PHARMACARE (PTY) LTD', 'GRV102482', 'PAD02WC', 'SANITARY PADS', 'in302903', 'IN302903', '01', '2025-07-31', 'BOX', 616, 450.00, 277200.00, 1),
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102487', 'PAD02WC', 'SANITARY PADS', 'KOG010', 'IN0000517', '01', '2025-08-02', 'BOX', 1149, 414.00, 475686.00, 1),
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102504', 'PAD02WC', 'SANITARY PADS', 'KOG010', 'IN0000535', '01', '2025-08-11', 'BOX', 1169, 414.00, 483966.00, 1);

-- Quarter 2 Stock Received
INSERT INTO PadsStockReceived (VendorName, GrnNumber, ItemCode, ItemDescription, Reference, InvoiceNumber, Location, InvoiceDate, UOM, QuantityReceived, UnitCost, SubTotal, Quarter) VALUES
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102527', 'PAD02WC', 'SANITARY PADS', 'KOG010', 'IN0000546', '04', '2025-08-15', 'BOX', 975, 414.00, 403650.00, 2),
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102582', 'PAD02WC', 'SANITARY PADS', 'KOG010', 'IN0000594', '04', '2025-09-09', 'BOX', 975, 431.00, 420225.00, 2),
('KOG TRADING ENTERPRISE PTY LTD', 'GRV102618', 'PAD02WC', 'SANITARY PADS', '', 'IN0000614', '04', '2025-09-23', 'BOX', 974, 466.00, 453884.00, 2);

-- Quarter 3 Stock Received
INSERT INTO PadsStockReceived (VendorName, GrnNumber, ItemCode, ItemDescription, Reference, InvoiceNumber, Location, InvoiceDate, UOM, QuantityReceived, UnitCost, SubTotal, Quarter) VALUES
('PROMED PHARMACARE (PTY) LTD', 'GRV102634', 'PAD02WC', 'SANITARY PADS', 'IN303470', 'IN303470', '01', '2025-09-30', 'BOX', 63, 450.00, 28350.00, 3),
('PROMED PHARMATECH (PTY) LTD', 'GRV102676', 'PAD02WC', 'SANITARY PADS', 'IN303692', 'IN303692', '01', '2025-10-16', 'BOX', 158, 450.00, 71100.00, 3),
('PROMED PHARMATECH (PTY) LTD', 'GRV102683', 'PAD02WC', 'SANITARY PADS', 'IN303722', 'IN303722', '01', '2025-10-21', 'BOX', 177, 450.00, 79650.00, 3),
('PROMED PHARMATECH (PTY) LTD', 'GRV102691', 'PAD02WC', 'SANITARY PADS', 'IN303709', 'IN303709', '01', '2025-10-17', 'BOX', 81, 450.00, 36450.00, 3),
('PROMED PHARMACARE (PTY) LTD', 'GRV102693', 'PAD02WC', 'SANITARY PADS', 'IN303742', 'IN303742', '01', '2025-10-24', 'BOX', 102, 450.00, 45900.00, 3),
('PROMED PHARMACARE (PTY) LTD', 'GRV102702', 'PAD02WC', 'SANITARY PADS', 'IN303753', 'IN303753', '01', '2025-10-28', 'BOX', 68, 450.00, 30600.00, 3),
('PROMED PHARMATECH (PTY) LTD', 'GRV102724', 'PAD02WC', 'SANITARY PADS', 'in303672', 'IN303672', '01', '2025-10-15', 'BOX', 2209, 450.00, 994050.00, 3),
('PROMED PHARMATECH (PTY) LTD', 'GRV102810', 'PAD02WC', 'SANITARY PADS', 'IN304160', 'IN304160', '01', '2025-11-28', 'BOX', 205, 450.00, 92250.00, 3);

-- Stock Delivered (from quarters)
INSERT INTO PadsStockDelivered (DeliveryReference, InvoiceNumber, QuantityDelivered, UOM, Quarter, DeliveryDate, Notes) VALUES
('IN140509', 'IN140509', 5925, 'BOX', 1, '2025-08-14', 'Q1 delivery - 14 August 2025'),
('IN141387', 'IN141387', 5925, 'BOX', 2, '2025-09-29', 'Q2 delivery - 29 September 2025'),
('IN142110', 'IN142110', 5717, 'BOX', 3, '2025-11-18', 'Q3 delivery - 18 November 2025');

-- Invoices Processed
INSERT INTO PadsInvoicesProcessed (InvoiceReference, InvoiceDate, Description) VALUES
('IN140509', '2025-08-14', 'Q1 invoice - 14 August 2025'),
('IN141387', '2025-09-29', 'Q2 invoice - 29 September 2025'),
('IN142087', '2025-11-16', 'Q3 invoice - 16 November 2025 (credited)'),
('IN142110', '2025-11-18', 'Q3 invoice - 18 November 2025');

-- Credit Notes
INSERT INTO PadsCreditNotes (CreditNoteNumber, CreditDate, Description) VALUES
('CR103002', '2025-11-18', 'Full invoice IN142087 was credited on 18 November 2025');

-- Warehouse Stock (latest snapshot from STOCK sheet)
INSERT INTO PadsWarehouseStock (WarehouseName, StockType, Quantity, UOM, IsDamaged, SnapshotDate) VALUES
('CPT WAREHOUSE', 'System', 1396, 'BOX', 0, '2025-11-28'),
('KZN WAREHOUSE', 'System', 205, 'BOX', 0, '2025-11-28'),
('CPT WAREHOUSE', 'Physical', 1219, 'BOX', 0, '2025-11-28'),
('CPT WAREHOUSE', 'Physical', 64, 'BOX', 1, '2025-11-28'),
('KZN WAREHOUSE', 'Physical', 3, 'BOX', 0, '2025-11-28');
GO

PRINT 'Sanitary Pads tables created and seeded successfully';
