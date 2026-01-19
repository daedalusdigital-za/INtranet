# Logistics Management System Documentation

## Overview
Comprehensive logistics management system integrated into the INtranet application with full fleet tracking, warehouse management, load planning, and invoicing capabilities.

## Features Implemented

### 1. Fleet Operations
- **Vehicle Management**
  - Vehicle registration and tracking
  - Vehicle type categorization (trucks, vans, etc.)
  - Driver assignment and management
  - CarTrack GPS integration for real-time tracking
  - Vehicle status monitoring (Available, In Use, Under Maintenance)

- **Driver Management**
  - Driver profiles with license information
  - License expiry tracking
  - Driver assignment to vehicles and loads
  - Contact information management

### 2. Load Management
- **Load Creation & Tracking**
  - Automated load number generation (LD{date}{sequence})
  - Customer assignment
  - Vehicle and driver assignment
  - Multiple delivery stops per load
  - Load items with commodity tracking
  - Status tracking (Pending, Assigned, In Transit, Delivered, Cancelled)

- **Route Management**
  - Multiple stops per load
  - Stop sequencing
  - Scheduled vs actual arrival times
  - Stop status tracking
  - Contact information per stop

- **Real-Time Tracking**
  - Live GPS tracking via CarTrack integration
  - Current vehicle location
  - Speed and heading information
  - ETA calculations to next stop
  - Distance calculations using Haversine formula

### 3. Warehouse Operations
- **Warehouse Management**
  - Multiple warehouse support
  - Location tracking with GPS coordinates
  - Capacity management
  - Manager and contact information

- **Inventory Management**
  - Stock levels per warehouse
  - Reorder level tracking
  - Bin location management
  - Last count and restock dates

- **Stock Transfers**
  - Transfer between warehouses
  - Automated transfer number generation (ST{date}{sequence})
  - Status tracking (Pending, In Transit, Received, Cancelled)
  - Approval workflow

- **Backorder Management**
  - Customer backorder tracking
  - Automated backorder number generation (BO{date}{sequence})
  - Quantity ordered vs fulfilled tracking
  - Expected fulfillment dates

### 4. Customer Management
- **Customer Database**
  - Company information and registration details
  - Contact person and multiple contact methods
  - Physical and postal addresses
  - Payment terms and credit limits
  - Status management (Active, Inactive, Suspended)

- **Contract Management**
  - Customer contracts with pricing terms
  - Automated contract number generation (CT{date}{sequence})
  - Rate structures (per km, per load)
  - Contract status tracking
  - Document storage URLs
  - Billing frequency configuration

### 5. Invoicing System
- **Invoice Generation**
  - Automated invoice number generation (INV{date}{sequence})
  - Link to loads for freight charges
  - Multiple line items per invoice
  - VAT calculation (default 15%)
  - Subtotal, VAT, and total calculations

- **Payment Tracking**
  - Payment recording with methods and references
  - Partial payment support
  - Status updates (Unpaid, Partially Paid, Paid, Overdue)
  - Balance calculations

### 6. Proof of Delivery (POD)
- **Digital Delivery Confirmation**
  - Recipient name capture
  - Digital signature storage
  - GPS coordinates at delivery
  - Photo uploads
  - Delivery condition tracking
  - Damage notes

### 7. Commodity Tracking
- **Commodity Management**
  - Commodity database with codes
  - Physical properties (weight, volume)
  - Unit of measure tracking
  - Special handling requirements:
    - Refrigeration requirements
    - Fragile items
    - Hazardous materials
  - Handling instructions

### 8. Vehicle Maintenance
- **Maintenance Scheduling**
  - Scheduled maintenance tracking
  - Maintenance types (Service, Repair, Inspection, Tire Change)
  - Cost tracking
  - Service provider information
  - Odometer readings
  - Next service reminders

- **Maintenance History**
  - Complete maintenance records per vehicle
  - Invoice references
  - Completion tracking
  - Status management

### 9. CarTrack Integration
- **Real-Time GPS Tracking**
  - Fleet status dashboard
  - Vehicle location tracking
  - Speed and heading monitoring
  - Last update timestamps
  - Vehicle status (moving, stopped, offline)

- **API Integration**
  - Base URL: https://fleetapi-za.cartrack.com/rest/
  - Endpoints:
    - `/vehicles` - Get all vehicles
    - `/vehicles/status` - Real-time status
  - Authentication: Basic Auth
  - Timeout: 30 seconds
  - Region: South African API

## Database Schema

### Core Tables
1. **VehicleTypes** - Vehicle categories
2. **Vehicles** - Fleet vehicles with CarTrack IDs
3. **Drivers** - Driver information and licenses
4. **Customers** - Customer database
5. **Warehouses** - Warehouse locations
6. **Commodities** - Shipped goods catalog
7. **Loads** - Freight loads
8. **LoadItems** - Items per load
9. **LoadStops** - Delivery/pickup stops
10. **WarehouseInventory** - Stock levels
11. **StockTransfers** - Inter-warehouse transfers
12. **Backorders** - Customer backorders
13. **ProofOfDeliveries** - Delivery confirmations
14. **Invoices** - Billing records
15. **InvoiceLineItems** - Invoice details
16. **VehicleMaintenance** - Maintenance records
17. **CustomerContracts** - Customer agreements

## API Endpoints

### Fleet Management
- `GET /api/fleet/vehicles` - List all vehicles
- `GET /api/fleet/vehicles/{id}` - Get vehicle details
- `POST /api/fleet/vehicles` - Create vehicle
- `PUT /api/fleet/vehicles/{id}` - Update vehicle
- `DELETE /api/fleet/vehicles/{id}` - Delete vehicle
- `GET /api/fleet/drivers` - List all drivers
- `GET /api/fleet/drivers/{id}` - Get driver details
- `POST /api/fleet/drivers` - Create driver
- `PUT /api/fleet/drivers/{id}` - Update driver
- `DELETE /api/fleet/drivers/{id}` - Delete driver
- `GET /api/fleet/vehicle-types` - List vehicle types
- `POST /api/fleet/vehicle-types` - Create vehicle type

### Load Management
- `GET /api/loads?status={status}` - List loads (with optional status filter)
- `GET /api/loads/{id}` - Get load details
- `POST /api/loads` - Create load
- `PUT /api/loads/{id}` - Update load
- `DELETE /api/loads/{id}` - Delete load
- `POST /api/loads/{loadId}/proof-of-delivery` - Create POD

### Warehouse Operations
- `GET /api/warehouses` - List warehouses
- `GET /api/warehouses/{id}` - Get warehouse details
- `POST /api/warehouses` - Create warehouse
- `GET /api/warehouses/{warehouseId}/inventory` - Get warehouse inventory
- `GET /api/warehouses/inventory` - Get all inventory
- `POST /api/warehouses/inventory` - Create inventory item
- `PUT /api/warehouses/inventory/{id}` - Update inventory
- `GET /api/warehouses/stock-transfers?status={status}` - List transfers
- `POST /api/warehouses/stock-transfers` - Create transfer
- `PUT /api/warehouses/stock-transfers/{id}` - Update transfer
- `GET /api/warehouses/backorders?status={status}` - List backorders
- `POST /api/warehouses/backorders` - Create backorder
- `GET /api/warehouses/commodities` - List commodities
- `POST /api/warehouses/commodities` - Create commodity

### Customer Management
- `GET /api/customers` - List customers
- `GET /api/customers/{id}` - Get customer details
- `POST /api/customers` - Create customer
- `GET /api/customers/{customerId}/contracts` - Get customer contracts
- `POST /api/customers/contracts` - Create contract

### Invoicing
- `GET /api/invoices?status={status}` - List invoices
- `GET /api/invoices/{id}` - Get invoice details
- `POST /api/invoices` - Create invoice
- `POST /api/invoices/{id}/payment` - Record payment

### Tracking (CarTrack Integration)
- `GET /api/tracking/fleet-status` - Get fleet status dashboard
- `GET /api/tracking/vehicle/{vehicleId}/location` - Get vehicle location
- `GET /api/tracking/load/{loadId}/track` - Track active load
- `GET /api/tracking/active-loads` - List active loads

### Maintenance
- `GET /api/maintenance?vehicleId={id}&status={status}` - List maintenance records
- `GET /api/maintenance/{id}` - Get maintenance record
- `POST /api/maintenance` - Create maintenance record
- `PUT /api/maintenance/{id}` - Update maintenance record
- `GET /api/maintenance/upcoming?days={days}` - Get upcoming maintenance

## Configuration

### CarTrack Settings (appsettings.json)
```json
{
  "CarTrack": {
    "BaseUrl": "https://fleetapi-za.cartrack.com/rest/",
    "Username": "ACCE00008",
    "Password": "a5aef0a82cd3babec9fb2cb3281d7accc984f5267e67d4573c8dc443b03aef82",
    "TimeoutSeconds": 30,
    "Region": "South Africa"
  }
}
```

## Service Integration

### CarTrackService
**Interface:** `ICarTrackService`

**Methods:**
- `GetAllVehicleLocationsAsync()` - Fetch all vehicle locations
- `GetVehicleLocationAsync(carTrackId)` - Get specific vehicle location
- `GetFleetStatusAsync()` - Get overall fleet status
- `TrackActiveTripAsync(loadId)` - Track specific trip (requires database access)

**Features:**
- Basic authentication
- 30-second timeout
- JSON response parsing
- Error handling and logging
- Vehicle status determination (moving/stopped/offline)

## Data Models

### Key DTOs
- **VehicleDto** - Vehicle information with driver and type
- **LoadDto** - Load with stops, items, and tracking
- **WarehouseDto** - Warehouse with location and capacity
- **InvoiceDto** - Invoice with line items and balance
- **VehicleLocationDto** - Real-time GPS data
- **TripTrackingDto** - Load tracking with ETA calculations

## Business Logic

### Load Number Generation
Format: `LD{YYYYMMDD}{sequence}`
Example: `LD202601190001`

### Invoice Number Generation
Format: `INV{YYYYMMDD}{sequence}`
Example: `INV202601190001`

### Stock Transfer Number Generation
Format: `ST{YYYYMMDD}{sequence}`
Example: `ST202601190001`

### Backorder Number Generation
Format: `BO{YYYYMMDD}{sequence}`
Example: `BO202601190001`

### Contract Number Generation
Format: `CT{YYYYMMDD}{sequence}`
Example: `CT202601190001`

### Distance Calculation
Uses Haversine formula for GPS coordinate distance:
- Input: Two GPS coordinate pairs (lat/lon)
- Output: Distance in kilometers
- Formula accounts for Earth's curvature

### ETA Calculation
- Based on current vehicle speed
- Distance to next stop / current speed
- Returns TimeSpan for display

## Security
- All endpoints require JWT authentication
- Role-based access control ready
- Secure CarTrack API credentials in configuration
- HTTPS required for CarTrack API communication

## Future Enhancements
1. Mobile app for drivers
2. Automated route optimization
3. Fuel consumption tracking
4. Customer portal for tracking
5. Advanced analytics and reporting
6. Integration with accounting systems
7. SMS/Email notifications for deliveries
8. Barcode/QR code scanning for POD
9. Temperature monitoring for refrigerated goods
10. Integration with weighbridge systems

## Notes
- CarTrack credentials are stored in appsettings
- Database migrations will create all tables
- All foreign key relationships properly configured
- Cascade and restrict delete behaviors implemented
- Timestamps tracked on all entities
- Status fields use string enums for flexibility
