# Promed Intranet (Project Tracker)

A full-stack company intranet built with Angular 18 and ASP.NET Core (.NET 10), running in Docker (frontend + backend + SQL Server + MCP connector + Cloudflare tunnel). Originally a Trello-like project tracker, it has grown into a multi-module business platform.

## 🚀 Modules & Features

- **Projects / Kanban Boards**: Multi-department boards, drag-and-drop cards, comments, attachments, real-time SignalR updates, HBA1C project suite (incl. sales-rep Car Track log)
- **Logistics**: Loads, trip sheets (manual, Excel import, DN tripsheets), picking slips, POD management, driver/vehicle fleet with live CarTrack GPS tracking and persisted movement history, warehouses & stock transfers, imported ERP invoices with load assignment, document generation (Tax Invoice / Delivery Note previews, print and PDF per invoice or per load)
- **Sales**: Dashboard with invoices, orders (IMAP), customers, back orders per company (imported via admin or static fallback), sales trip sheets
- **Stock Management**: Warehouse inventory, SOH Excel imports with preview/commit, fulfilment checks
- **Document Templates (Admin)**: Per-company (PMT/ACM/PHT/SBT/SAW/KOG) invoice/delivery-note/quote templates reconstructed from Sage Crystal reports, with logo/banner artwork management and merged multi-invoice output
- **Data Import (Admin)**: Excel/CSV importers for sales/invoices, customers, products, employees and **backorders** (per company, snapshot-replace)
- **HR / Finance / Expense Tracker / Knowledge Base / Messaging / Calendar / Support Tickets / Paperless documents**
- **AI**: Claude-powered assistant (Welly), local LLM support, MCP logistics connector so Claude can query loads, vehicles, movements, fuel and incidents
- **Auth**: JWT with role + per-module permissions, BCrypt passwords

## 📋 Technology Stack

### Backend
- **ASP.NET Core (.NET 10)** - Web API
- **Entity Framework Core** - ORM
- **SQL Server** (Docker) - Database
- **SignalR** - Real-time communication
- **iText7 + pdfHTML** - PDF generation (invoices, delivery notes, picking slips)
- **ClosedXML / EPPlus** - Excel import/export
- **JWT + BCrypt** - Authentication

### Frontend
- **Angular 18** - SPA Framework (standalone components, signals)
- **Angular Material** - UI Components
- **TypeScript / SCSS**
- **SignalR Client** - Real-time updates

### Infrastructure
- **Docker Compose**: frontend (nginx), backend, SQL Server, searxng, mcp-logistics, cloudflared tunnel
- **NAS (CIFS)** volumes for documents/archives
- **CarTrack Fleet API** integration (live GPS + trip history)

## 🏗️ Architecture

### Database Schema

```
Users
├─ UserId (PK)
├─ Name
├─ Email
├─ PasswordHash
├─ Role (Admin/Manager/Employee)
└─ DepartmentId (FK)

Departments
├─ DepartmentId (PK)
├─ Name
└─ ManagerName

Boards
├─ BoardId (PK)
├─ DepartmentId (FK)
├─ Title
└─ Description

Lists
├─ ListId (PK)
├─ BoardId (FK)
├─ Title
└─ Position

Cards
├─ CardId (PK)
├─ ListId (FK)
├─ Title
├─ Description
├─ AssignedToUserId (FK)
├─ DueDate
├─ Status
└─ Position
```

## 🔧 Setup Instructions

### Prerequisites
- .NET 10 SDK
- Node.js 18+ and npm
- Docker Desktop (recommended) or SQL Server locally
- Angular CLI 18
- Visual Studio Code or Visual Studio 2022

### Backend Setup

1. **Navigate to Backend folder:**
   ```powershell
   cd Backend
   ```

2. **Restore NuGet packages:**
   ```powershell
   dotnet restore
   ```

3. **Update connection string in `appsettings.json`:**
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=ProjectTrackerDb;Trusted_Connection=True;"
   }
   ```

4. **Apply database migrations:**
   ```powershell
   dotnet ef database update
   ```

5. **Run the API:**
   ```powershell
   dotnet run
   ```

   The API will start at `https://localhost:7000` (or check console output)

### Frontend Setup

1. **Navigate to Frontend folder:**
   ```powershell
   cd Frontend
   ```

2. **Install npm packages:**
   ```powershell
   npm install
   ```

3. **Update API URL in service files:**
   - `src/app/services/auth.service.ts`
   - `src/app/services/api.service.ts`
   - `src/app/services/signalr.service.ts`
   
   Replace `https://localhost:7000` with your actual API URL

4. **Run the Angular app:**
   ```powershell
   ng serve
   ```

   The app will start at `http://localhost:4200`

## 👤 Default Login Credentials

```
Admin User:
Email: admin@company.com
Password: Admin123!

Marketing Manager:
Email: john@company.com
Password: Admin123!

IT Manager:
Email: jane@company.com
Password: Admin123!
```

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - Register new user (Admin only)

### Departments
- `GET /api/departments` - Get all departments
- `GET /api/departments/{id}` - Get department by ID
- `POST /api/departments` - Create department (Admin only)
- `PUT /api/departments/{id}` - Update department
- `DELETE /api/departments/{id}` - Delete department (Admin only)

### Boards
- `GET /api/boards/department/{departmentId}` - Get boards by department
- `GET /api/boards/{id}` - Get board by ID
- `POST /api/boards` - Create board (Manager+)
- `PUT /api/boards/{id}` - Update board
- `DELETE /api/boards/{id}` - Delete board (Manager+)

### Lists
- `GET /api/lists/{id}` - Get list by ID
- `POST /api/lists` - Create list (Manager+)
- `PUT /api/lists/{id}` - Update list
- `DELETE /api/lists/{id}` - Delete list (Manager+)

### Cards
- `GET /api/cards/{id}` - Get card details
- `POST /api/cards` - Create card
- `PUT /api/cards/{id}` - Update card
- `PUT /api/cards/{id}/move` - Move card to different list
- `DELETE /api/cards/{id}` - Delete card
- `POST /api/cards/{id}/comments` - Add comment to card

## 🎯 User Roles

- **Admin**: Full system access, manage departments and users
- **Manager**: Manage boards and lists within their department
- **Employee**: Create and manage cards, add comments

## 🔄 Real-time Features

The application uses SignalR for real-time updates:
- Card movements are synchronized across all connected clients
- New cards appear instantly for all users viewing the board
- Card updates and deletions are reflected in real-time
- Comments are pushed to all board viewers

## 📦 Project Structure

```
ProjectTracker/
├── Backend/
│   ├── Controllers/
│   ├── Data/
│   ├── DTOs/
│   ├── Hubs/
│   ├── Models/
│   ├── Services/
│   ├── Migrations/
│   └── Program.cs
├── Frontend/
│   └── src/
│       └── app/
│           ├── components/
│           │   ├── login/
│           │   ├── dashboard/
│           │   └── board/
│           ├── services/
│           ├── guards/
│           ├── interceptors/
│           └── models/
└── README.md
```

## 🚀 Deployment (Docker Compose)

Production runs entirely via Docker Compose (see [DOCKER.md](DOCKER.md) and [DEPLOYMENT.md](DEPLOYMENT.md)):

```powershell
# Build frontend
cd Frontend; npx ng build --configuration production; cd ..

# Build and start containers
docker compose build backend frontend
docker compose up -d
```

Services: `projecttracker-frontend` (nginx), `projecttracker-backend` (.NET 10, port 5143), `projecttracker-db` (SQL Server), `mcp-logistics` (Claude MCP connector), `cloudflared` (tunnel), `searxng`.

## 📝 Environment Variables (Production)

### Backend
- `ConnectionStrings__DefaultConnection` - SQL Server connection string
- `Jwt__Key` - Secret key for JWT tokens
- `DocumentsPath` - mounted documents/template assets path (NAS CIFS in prod)

### Frontend
- API is served same-origin under `/api` via nginx proxy

## 🆕 Recent Updates (Oct 2026)

- **Logistics document previews**: Trip sheet "View Details" now renders the real generated documents (trip sheet, picking slip, tax invoices, delivery notes) with a per-invoice selector; multi-invoice preview shows two A4 pages per row with per-document scoped styling (mixed-company loads keep each company's branding); print/PDF outputs one full-size document per page
- **Delivery Note template**: identical artwork to the Tax Invoice with a Qty Received column and goods-received sign-off block
- **DN Tripsheets** (renamed from Pad Tripsheets): links what it can to system invoices and accepts the rest as unmatched
- **Trip sheet email**: manual recipients popup, CC-self, trip sheet + picking slip PDF attachments
- **Backorder importer**: Admin → Data Import → Backorders (per-company snapshot import, api/backorders); sales dashboard back-order tabs read imported data
- **Sales-rep fleet tracking**: Lindani / Stanley / Deon vehicles (DJ76…ZN) added to fleet with CarTrack live positions + movement history; HBA1C Car Track registrations fixed (GP → ZN plates)
- **MCP logistics connector**: Claude can list vehicles, movements, loads, fuel data and incidents

## 🤝 Contributing

This is an internal project. For feature requests or bug reports, contact the development team.

## 📄 License

Internal use only - Company proprietary software

## 🆘 Support

For technical support, contact the internal IT/development team.
