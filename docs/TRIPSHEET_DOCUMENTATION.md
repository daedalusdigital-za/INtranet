# TripSheet System Documentation

## Overview

The TripSheet system is the core logistics module for managing delivery routes, driver assignments, and delivery tracking. A **TripSheet** (internally stored as a `Load`) represents a complete delivery route with multiple stops, assigned to a driver and vehicle.

---

## Table of Contents

1. [Entity Relationship Diagram](#entity-relationship-diagram)
2. [Core Entities](#core-entities)
3. [Workflow Diagrams](#workflow-diagrams)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Data Flow](#data-flow)
7. [Status Workflows](#status-workflows)

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    TRIPSHEET ENTITY RELATIONSHIPS                            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌──────────────────┐
                                    │    Warehouse     │
                                    │──────────────────│
                                    │ Id               │
                                    │ Code             │
                                    │ Name             │
                                    │ Address          │
                                    │ Latitude         │
                                    │ Longitude        │
                                    └────────┬─────────┘
                                             │ 1
                                             │
                                             │ *
┌──────────────────┐                ┌────────┴─────────┐                ┌──────────────────┐
│     Driver       │                │      LOAD        │                │     Vehicle      │
│──────────────────│                │  (TripSheet)     │                │──────────────────│
│ Id               │                │──────────────────│                │ Id               │
│ FirstName        │       1        │ Id               │       1        │ RegistrationNo   │
│ LastName         │◄───────────────│ LoadNumber       │───────────────►│ Make             │
│ PhoneNumber      │                │ Status           │                │ Model            │
│ LicenseNumber    │                │ Priority         │                │ VehicleType      │
│ IsActive         │                │ ScheduledPickup  │                │ IsActive         │
│ EmployeeNumber   │                │ SpecialInstructions               │ CarTrackId       │
└──────────────────┘                │ EstimatedDistance│                │ TfnVehicleId     │
                                    │ Notes            │                └──────────────────┘
                                    │ CreatedAt        │
                                    └────────┬─────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                              │ 1            │ 1            │ *
                              ▼              ▼              ▼
              ┌──────────────────┐  ┌──────────────┐  ┌────────────────────┐
              │ ImportedInvoice  │  │   Customer   │  │     LoadStop       │
              │──────────────────│  │──────────────│  │────────────────────│
              │ Id               │  │ Id           │  │ Id                 │
              │ LoadId (FK)      │  │ Name         │  │ LoadId (FK)        │
              │ CustomerNumber   │  │ Email        │  │ StopSequence       │
              │ CustomerName     │  │ Phone        │  │ StopType           │
              │ TransactionNo    │  │ Address      │  │ CompanyName        │
              │ ProductCode      │  └──────────────┘  │ Address            │
              │ ProductDescription│                    │ City               │
              │ Quantity         │                    │ ContactPerson      │
              │ SalesAmount      │                    │ OrderNumber        │
              │ NetSales         │                    │ InvoiceNumber      │
              │ Status           │                    │ Status             │
              │ DeliveryAddress  │                    └─────────┬──────────┘
              └──────────────────┘                              │
                                                               │ *
                                                               ▼
                                                    ┌────────────────────┐
                                                    │   StopCommodity    │
                                                    │────────────────────│
                                                    │ Id                 │
                                                    │ LoadStopId (FK)    │
                                                    │ CommodityId (FK)   │
                                                    │ Quantity           │
                                                    │ UnitPrice          │
                                                    │ TotalPrice         │
                                                    │ InvoiceNumber      │
                                                    │ Comment            │
                                                    └────────────────────┘
```

---

## Core Entities

### 1. Load (TripSheet)

The central entity representing a delivery trip. Stored in `Backend/Models/Logistics/Load.cs`.

| Field | Type | Description |
|-------|------|-------------|
| `Id` | int | Primary key |
| `LoadNumber` | string | Unique identifier (e.g., "RF-000123") |
| `Status` | string | Current status (Available, Assigned, InTransit, Delivered, Cancelled) |
| `Priority` | string | Priority level (Low, Normal, High, Urgent) |
| `CustomerId` | int? | Foreign key to Customer |
| `VehicleId` | int? | Foreign key to Vehicle |
| `DriverId` | int? | Foreign key to Driver |
| `WarehouseId` | int? | Foreign key to origin Warehouse |
| `VehicleTypeId` | int? | Foreign key to VehicleType |
| `PickupLocation` | string | Pickup address |
| `DeliveryLocation` | string | Final delivery address |
| `ScheduledPickupDate` | DateTime? | Planned pickup date |
| `EstimatedDistance` | decimal? | Route distance in km |
| `EstimatedTimeMinutes` | int? | Estimated delivery time |
| `SpecialInstructions` | string | Driver instructions |
| `Notes` | string | Additional notes |

**Navigation Properties:**
- `Customer` → Customer entity
- `Vehicle` → Vehicle entity
- `Driver` → Driver entity
- `Warehouse` → Warehouse entity
- `VehicleType` → VehicleType entity
- `Stops` → Collection of LoadStop
- `LoadItems` → Collection of LoadItem (legacy)
- `ProofOfDelivery` → ProofOfDelivery entity
- `Invoice` → Invoice entity

---

### 2. LoadStop

Represents each delivery stop within a Load. Stored in `Backend/Models/Logistics/LoadStop.cs`.

| Field | Type | Description |
|-------|------|-------------|
| `Id` | int | Primary key |
| `LoadId` | int | Foreign key to Load |
| `StopSequence` | int | Order of stop in route (1, 2, 3...) |
| `StopType` | string | Pickup, Delivery, Stop, or Destination |
| `CompanyName` | string | Customer/company name |
| `Address` | string | Full address |
| `City` | string | City name |
| `Province` | string | Province/state |
| `ContactPerson` | string | Contact at location |
| `ContactPhone` | string | Phone number |
| `OrderNumber` | string | Related order reference |
| `InvoiceNumber` | string | Related invoice reference |
| `Status` | string | Stop status (Pending, Arrived, Completed) |

**Navigation Properties:**
- `Load` → Parent Load entity
- `Customer` → Customer entity
- `Warehouse` → Warehouse entity
- `Commodities` → Collection of StopCommodity

---

### 3. ImportedInvoice

External invoices imported from ERP systems. Stored in `Backend/Models/Logistics/ImportedInvoice.cs`.

| Field | Type | Description |
|-------|------|-------------|
| `Id` | int | Primary key |
| `LoadId` | int? | Foreign key to Load (when assigned) |
| `BatchId` | string | Import batch identifier |
| `CustomerNumber` | string | Customer account number |
| `CustomerName` | string | Customer name |
| `TransactionNumber` | string | Invoice/transaction number |
| `ProductCode` | string | Product SKU/code |
| `ProductDescription` | string | Product name |
| `Quantity` | decimal | Quantity ordered |
| `SalesAmount` | decimal | Sale amount |
| `NetSales` | decimal | Net sales value |
| `CostOfSales` | decimal | Cost |
| `GrossProfit` | decimal | Profit margin |
| `Status` | string | Pending, Assigned, InProgress, Delivered |
| `DeliveryAddress` | string | Delivery location |
| `DeliveryCity` | string | City |

---

### 4. StopCommodity

Products/items being delivered at each stop. Stored in `Backend/Models/Logistics/StopCommodity.cs`.

| Field | Type | Description |
|-------|------|-------------|
| `Id` | int | Primary key |
| `LoadStopId` | int | Foreign key to LoadStop |
| `CommodityId` | int? | Foreign key to Commodity |
| `ContractId` | int? | Foreign key to Contract |
| `Quantity` | decimal | Quantity |
| `UnitPrice` | decimal? | Price per unit |
| `TotalPrice` | decimal? | Total value |
| `Weight` | decimal? | Weight in kg |
| `Volume` | decimal? | Volume in m³ |
| `InvoiceNumber` | string | Reference invoice |
| `Comment` | string | Product description |

---

### 5. Driver

Driver entity assigned to trips. Stored in `Backend/Models/Logistics/Driver.cs`.

| Field | Type | Description |
|-------|------|-------------|
| `Id` | int | Primary key |
| `FirstName` | string | Driver first name |
| `LastName` | string | Driver surname |
| `PhoneNumber` | string | Contact number |
| `LicenseNumber` | string | Driver's license |
| `LicenseExpiry` | DateTime? | License expiry date |
| `EmployeeNumber` | string | Employee ID |
| `UserId` | int? | Link to User account |
| `IsActive` | bool | Active status |

---

### 6. Vehicle

Vehicle entity used for deliveries. Stored in `Backend/Models/Logistics/Vehicle.cs`.

| Field | Type | Description |
|-------|------|-------------|
| `Id` | int | Primary key |
| `RegistrationNumber` | string | Vehicle registration |
| `Make` | string | Manufacturer |
| `Model` | string | Model name |
| `Year` | int? | Model year |
| `VehicleTypeId` | int? | Type of vehicle |
| `CarTrackUnitId` | string | CarTrack integration ID |
| `TfnVehicleId` | string | TFN integration ID |
| `IsActive` | bool | Active status |
| `Status` | string | Available, InUse, Maintenance |

---

### 7. Warehouse

Origin warehouse for pickups. Stored in `Backend/Models/Logistics/Warehouse.cs`.

| Field | Type | Description |
|-------|------|-------------|
| `Id` | int | Primary key |
| `Code` | string | Warehouse code |
| `Name` | string | Warehouse name |
| `Address` | string | Physical address |
| `City` | string | City |
| `Latitude` | double? | GPS latitude |
| `Longitude` | double? | GPS longitude |
| `IsActive` | bool | Active status |

---

## Workflow Diagrams

### TripSheet Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              TRIPSHEET CREATION WORKFLOW                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────────┐
                                    │  User Action    │
                                    │ "Create Trip"   │
                                    └────────┬────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │   TripsheetTypeDialog        │
                              │   "Select Creation Method"   │
                              └──────────────┬───────────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                         ▼                   ▼                   ▼
              ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
              │  From Invoices   │ │  Manual Entry    │ │   Quick Trip     │
              │  (Imported)      │ │  (Build Route)   │ │   (Single Stop)  │
              └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
                       │                    │                    │
                       ▼                    │                    │
              ┌──────────────────┐          │                    │
              │ Select Pending   │          │                    │
              │ Invoices         │          │                    │
              └────────┬─────────┘          │                    │
                       │                    │                    │
                       ▼                    ▼                    ▼
                       └────────────────────┴────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │   CreateTripsheetDialog      │
                              │   - Select Warehouse         │
                              │   - Select Driver            │
                              │   - Select Vehicle           │
                              │   - Set Date/Time            │
                              │   - Review Route on Map      │
                              └──────────────┬───────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │   POST /api/logistics/loads  │
                              │   Create Load + Stops        │
                              └──────────────┬───────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────┐
                              │   GET /tripsheet/{id}/pdf    │
                              │   Generate & Print PDF       │
                              └──────────────────────────────┘
```

---

### Invoice Import to TripSheet Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                           INVOICE IMPORT TO TRIPSHEET FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

     ┌─────────────────┐
     │  External ERP   │
     │  (Excel/CSV)    │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │  Upload File    │
     │  POST /import   │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐          ┌─────────────────┐
     │ ImportedInvoice │◄─────────│ TripSheetImport │
     │ Status: Pending │          │ Service         │
     └────────┬────────┘          └─────────────────┘
              │
              ▼
     ┌─────────────────┐
     │ User Selects    │
     │ Invoices for    │
     │ Tripsheet       │
     └────────┬────────┘
              │
              ▼
     ┌────────────────────────────────────────────────────┐
     │ POST /api/logistics/importedinvoices/create-tripsheet
     │                                                    │
     │ 1. Group invoices by CustomerName                  │
     │ 2. Create Load with RF-XXXXXX number              │
     │ 3. Create LoadStop per customer                   │
     │ 4. Create StopCommodity per invoice line          │
     │ 5. Update ImportedInvoice.Status = "Assigned"     │
     │ 6. Update ImportedInvoice.LoadId = load.Id        │
     └────────────────────────────────────────────────────┘
              │
              ▼
     ┌─────────────────┐
     │ ImportedInvoice │
     │ Status: Assigned│
     │ LoadId: set     │
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │ Driver Delivers │
     │ Status: InTransit
     └────────┬────────┘
              │
              ▼
     ┌─────────────────┐
     │ POD Captured    │
     │ Status: Delivered
     └─────────────────┘
```

---

### TripSheet Status State Machine

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              LOAD/TRIPSHEET STATUS FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────┐
                    │     AVAILABLE     │◄──── No driver assigned
                    │                   │
                    └─────────┬─────────┘
                              │
                              │ Assign Driver + Vehicle
                              ▼
                    ┌───────────────────┐
                    │     ASSIGNED      │◄──── Driver/Vehicle assigned, not yet started
                    │                   │
                    └─────────┬─────────┘
                              │
                              │ Schedule pickup date/time
                              ▼
                    ┌───────────────────┐
                    │    SCHEDULED      │◄──── Has pickup date scheduled
                    │                   │
                    └─────────┬─────────┘
                              │
                              │ Driver starts trip
                              ▼
                    ┌───────────────────┐
                    │    IN TRANSIT     │◄──── Driver on the road
                    │                   │
                    └─────────┬─────────┘
                              │
                              │ All stops completed + POD
                              ▼
                    ┌───────────────────┐
                    │    DELIVERED      │◄──── Trip complete
                    │                   │
                    └───────────────────┘

                              │ (Any state)
                              │ Cancel trip
                              ▼
                    ┌───────────────────┐
                    │    CANCELLED      │
                    └───────────────────┘
```

---

### ImportedInvoice Status Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            IMPORTED INVOICE STATUS FLOW                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

     ┌─────────────┐
     │   PENDING   │◄──── Newly imported, not yet assigned to trip
     └──────┬──────┘
            │
            │ Add to TripSheet
            ▼
     ┌─────────────┐
     │  ASSIGNED   │◄──── Linked to Load via LoadId
     └──────┬──────┘
            │
            │ Driver starts delivery
            ▼
     ┌─────────────┐
     │ IN PROGRESS │◄──── Load is InTransit
     └──────┬──────┘
            │
            │ POD captured
            ▼
     ┌─────────────┐
     │  DELIVERED  │◄──── Complete
     └─────────────┘
```

---

## API Endpoints

### TripSheet Controller (`/api/logistics/tripsheet`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/{loadId}` | Get TripSheet data for preview |
| `GET` | `/{loadId}/pdf` | Generate printable TripSheet PDF |
| `POST` | `/create-from-invoices` | Create TripSheet from imported invoices |
| `PUT` | `/{tripSheetId}/assign` | Assign driver/vehicle to TripSheet |
| `DELETE` | `/{tripSheetId}` | Delete TripSheet (unlinks invoices) |

### Loads Controller (`/api/logistics/loads`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all loads/tripsheets |
| `GET` | `/{id}` | Get single load by ID |
| `POST` | `/` | Create new load with stops |
| `PUT` | `/{id}` | Update existing load |
| `DELETE` | `/{id}` | Delete load |
| `PUT` | `/{id}/status` | Update load status |
| `POST` | `/{loadId}/proof-of-delivery` | Capture proof of delivery |

### Imported Invoices Controller (`/api/logistics/importedinvoices`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all imported invoices |
| `POST` | `/import` | Import invoices from file |
| `POST` | `/create-tripsheet` | Create TripSheet from selected invoices |
| `PUT` | `/{id}/status` | Update invoice status |

---

## Frontend Components

### Location: `Frontend/src/app/components/logistics/logistics-dashboard.component.ts`

### Key Dialogs

| Component | Line | Purpose |
|-----------|------|---------|
| `TripsheetTypeDialog` | ~11000 | Select creation method (Invoice/Manual/Quick) |
| `CreateTripsheetDialog` | ~11515 | Main dialog for building trip with map || `ViewRouteMapDialog` | ~19933 | Interactive Google Maps route visualization |
| `ViewLoadDetailsDialog` | ~19527 | Full load details viewer with 3 tabs || `InvoiceDetailsDialog` | ~varies | View individual invoice details |

### Key Methods

| Method | Description |
|--------|-------------|
| `openCreateTripsheetDialog()` | Opens the TripsheetTypeDialog |
| `createTripsheetFromInvoices()` | Auto-creates trip from pending invoices |
| `createTripsheet()` | Saves tripsheet and generates PDF |
| `loadTripsheets()` | Fetches all tripsheets from API |
| `loadImportedInvoices()` | Fetches pending invoices |
| `viewRouteOnMap()` | Opens route map dialog with geocoded stops |
| `viewLoadDetails()` | Opens load details dialog with 3 tabs |

### CreateTripsheetDialog Flow

```typescript
// 1. User selects invoices → selectedStops array populated
// 2. Route displayed on map with markers
// 3. User selects: Warehouse, Driver, Vehicle, Date
// 4. Payload built:
const payload = {
  warehouseId: this.selectedWarehouse?.id,
  driverId: this.selectedDriver?.id,
  vehicleId: this.selectedVehicle?.id,
  scheduledPickupDate: this.scheduledDate,
  specialInstructions: this.specialInstructions,
  estimatedDistance: this.totalDistance,
  estimatedTimeMinutes: Math.round(this.totalDistance * 1.2),
  stops: this.selectedStops.map((stop, index) => ({
    stopSequence: index + 1,
    stopType: index === this.selectedStops.length - 1 ? 'Destination' : 'Delivery',
    customerId: stop.customerId,
    companyName: stop.customerName,
    address: stop.deliveryAddress,
    commodities: [{
      commodityName: stop.productDescription,
      quantity: stop.quantity,
      unitPrice: stop.salesAmount
    }]
  })),
  invoiceIds: this.selectedStops.map(s => s.id)
};

// 5. POST to /api/logistics/loads
// 6. GET PDF and open print dialog
```

---

## Data Flow

### Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   DATA FLOW OVERVIEW                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

    EXTERNAL                    FRONTEND                      BACKEND                   DATABASE
    ────────                    ────────                      ───────                   ────────

    ┌────────┐
    │ ERP    │
    │ Export │
    └───┬────┘
        │ Upload Excel/CSV
        │
        ▼
                         ┌────────────────────┐
                         │ Import Invoices    │
                         │ Dialog             │
                         └─────────┬──────────┘
                                   │ POST /import
                                   ▼
                                              ┌───────────────────────┐
                                              │ TripSheetImportService│
                                              │ - Parse file          │
                                              │ - Validate data       │
                                              │ - Create records      │
                                              └───────────┬───────────┘
                                                          │ INSERT
                                                          ▼
                                                                        ┌─────────────────┐
                                                                        │ ImportedInvoice │
                                                                        │ Table           │
                                                                        └─────────────────┘
                         ┌────────────────────┐
                         │ Logistics Dashboard│
                         │ - View Invoices    │
                         └─────────┬──────────┘
                                   │ GET /importedinvoices
                                   ▼
                                              ┌───────────────────────┐
                                              │ ImportedInvoices      │
                                              │ Controller            │
                                              └───────────────────────┘

                         ┌────────────────────┐
                         │ Create Tripsheet   │
                         │ Dialog             │
                         │ - Select invoices  │
                         │ - Select driver    │
                         │ - View map route   │
                         └─────────┬──────────┘
                                   │ POST /loads
                                   ▼
                                              ┌───────────────────────┐
                                              │ LoadsController       │
                                              │ - Create Load         │
                                              │ - Create LoadStops    │
                                              │ - Create StopCommodities
                                              │ - Link Invoices       │
                                              └───────────┬───────────┘
                                                          │ INSERT
                                                          ▼
                                                                        ┌─────────────────┐
                                                                        │ Loads, LoadStops│
                                                                        │ StopCommodities │
                                                                        └─────────────────┘

                         ┌────────────────────┐
                         │ Print TripSheet    │
                         └─────────┬──────────┘
                                   │ GET /tripsheet/{id}/pdf
                                   ▼
                                              ┌───────────────────────┐
                                              │ TripSheetController   │
                                              │ - Load with includes  │
                                              │ - Build TripSheetDto  │
                                              │ - Render HTML/PDF     │
                                              └───────────────────────┘
```

---

## Key Business Rules

### 1. Load Number Generation
- Format: `RF-XXXXXX` (e.g., RF-000123)
- Sequential numbering from last load
- RF prefix = "Route Form"

### 2. Invoice to TripSheet Assignment
- Only **Pending** invoices can be assigned
- Invoices are grouped by `CustomerName` → one stop per customer
- Each invoice line becomes a `StopCommodity`
- Invoice status changes: `Pending` → `Assigned` → `InProgress` → `Delivered`

### 3. TripSheet Data Source Priority
The `GetTripSheet` endpoint prioritizes data sources:
1. **ImportedInvoices** (if LoadId matches) - used as primary line items
2. **LoadStops.Commodities** - fallback if no imported invoices

### 4. TripSheet Deletion
When deleting a TripSheet:
- All `LoadStops` are removed
- All `StopCommodities` are removed
- Linked `ImportedInvoices` reset to `Status = "Pending"` and `LoadId = null`

---

## Route Map Visualization

### Google Maps Integration

The system includes interactive route visualization using Google Maps API.

**Features:**
- **Warehouse Origin Marker**: Green marker (40x40px) showing pickup location
- **Stop Markers**: Blue numbered markers (32x32px) sequenced by delivery order
- **Route Polyline**: Purple line connecting all stops in sequence
- **Geocoding**: Automatic address-to-coordinates conversion via Google Geocoding API
- **Route Info Panel**: Driver, vehicle, origin, and stops count
- **Stops Legend**: List of all stops with commodity details

**API Configuration:**
- Google Maps API Key: `AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k`
- Script Loading: Async via `index.html`
- Package: `@angular/google-maps`

### ViewRouteMapDialog Component

**Location**: Lines 19933-20310 in `logistics-dashboard.component.ts`

**Functionality:**
1. Fetches load details via `GET /api/loads/{id}`
2. Geocodes stop addresses to lat/lng coordinates
3. Displays warehouse origin marker (green)
4. Displays numbered stop markers (blue, sequenced)
5. Draws route polyline (purple, 4px stroke)
6. Shows route info and stops legend
7. Handles geocoding errors with fallback

**Usage:**
- Available in both **Active Loads** and **Completed Loads** tabs
- Accessed via three-dot menu → "View Route" (eye icon)
- Opens in 95vw × 85vh modal dialog

**Implementation:**
```typescript
viewRouteOnMap(trip: any) {
  const loadId = trip.loadId || trip.id;
  this.http.get(`${environment.apiUrl}/logistics/loads/${loadId}`)
    .subscribe({
      next: (load: any) => {
        this.dialog.open(ViewRouteMapDialog, {
          width: '95vw',
          height: '85vh',
          maxWidth: '95vw',
          data: { load }
        });
      },
      error: (err) => {
        this.snackBar.open('Failed to load route details', 'Close', { duration: 3000 });
      }
    });
}
```

### ViewLoadDetailsDialog Component

**Location**: Lines 19527-19931 in `logistics-dashboard.component.ts`

**Features:**
- **Overview Tab**: Load details, driver, vehicle, warehouse, status
- **Stops Tab**: All delivery stops with commodities
- **Timeline Tab**: Status history and timestamps

**API**: `GET /api/loads/{id}` with full entity includes

---

## Database Tables Summary

| Table | Description |
|-------|-------------|
| `Loads` | Main tripsheet/load records |
| `LoadStops` | Delivery stops per load |
| `StopCommodities` | Items at each stop |
| `LoadItems` | Legacy items (direct on load) |
| `ImportedInvoices` | External invoice imports |
| `Drivers` | Driver records |
| `Vehicles` | Vehicle records |
| `Warehouses` | Warehouse/depot locations |
| `Customers` | Customer records |
| `Commodities` | Product catalog |
| `Contracts` | Customer contracts |
| `ProofOfDelivery` | POD records with signatures |

---

## File Locations

### Backend (C# .NET)
- Controllers: `Backend/Controllers/Logistics/`
  - `TripSheetController.cs` - TripSheet generation
  - `LoadsController.cs` - Load CRUD operations
  - `ImportedInvoicesController.cs` - Invoice import
- Models: `Backend/Models/Logistics/`
  - `Load.cs`, `LoadStop.cs`, `LoadItem.cs`
  - `StopCommodity.cs`, `ImportedInvoice.cs`
  - `Driver.cs`, `Vehicle.cs`, `Warehouse.cs`
- DTOs: `Backend/DTOs/Logistics/`
  - `TripSheetDTOs.cs`, `LoadDTOs.cs`, `InvoiceDTOs.cs`
- Services: `Backend/Services/`
  - `TripSheetImportService.cs`

### Frontend (Angular)
- Main Component: `Frontend/src/app/components/logistics/logistics-dashboard.component.ts`
  - Contains all dialogs and logic (~16,280 lines)
- Styles: `logistics-dashboard.component.scss`

---

## Glossary

| Term | Definition |
|------|------------|
| **TripSheet** | A delivery route document assigned to a driver |
| **Load** | Internal entity name for TripSheet |
| **LoadStop** | A delivery point within a trip |
| **StopCommodity** | Products being delivered at a stop |
| **ImportedInvoice** | External invoice imported from ERP |
| **POD** | Proof of Delivery (signature, photos, notes) |
| **RF Number** | Route Form number (RF-XXXXXX) |

---

*Documentation generated: June 2025*
*System: ProjectTracker Logistics Module*
