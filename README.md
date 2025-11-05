# Project Tracker - Trello-like Internal Project Management

A modern, full-stack project tracking application built with Angular 18 and ASP.NET Core 9, designed for internal department project management.

## 🚀 Features

- **Multi-Department Support**: Organize projects by department
- **Kanban Boards**: Visual project tracking with drag-and-drop cards
- **Real-time Updates**: Live synchronization using SignalR
- **Role-Based Access**: Admin, Manager, and Employee roles
- **Card Management**: Create, edit, move, and delete project cards
- **Comments & Attachments**: Collaborate on cards with comments and file attachments
- **Audit Logging**: Track all changes and actions
- **JWT Authentication**: Secure API access

## 📋 Technology Stack

### Backend
- **ASP.NET Core 9** - Web API
- **Entity Framework Core** - ORM
- **SQL Server** - Database
- **SignalR** - Real-time communication
- **JWT** - Authentication

### Frontend
- **Angular 18** - SPA Framework
- **Angular Material** - UI Components
- **TypeScript** - Type-safe development
- **SCSS** - Styling
- **Angular CDK** - Drag-and-drop functionality
- **SignalR Client** - Real-time updates

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
- .NET 9 SDK
- Node.js 18+ and npm
- SQL Server (LocalDB or full version)
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

## 🚀 Deployment to Azure

### Backend (Azure App Service)

1. **Create Azure SQL Database**
2. **Create App Service for API**
3. **Configure connection string in App Service settings**
4. **Set JWT secret key in App Service configuration**
5. **Deploy using:**
   ```powershell
   dotnet publish -c Release
   ```

### Frontend (Azure Static Web Apps or App Service)

1. **Build for production:**
   ```powershell
   ng build --configuration production
   ```

2. **Deploy dist folder to Azure Static Web Apps or App Service**

## 📝 Environment Variables (Production)

### Backend
- `SQL_CONNECTION_STRING` - Azure SQL connection string
- `JWT_SECRET_KEY` - Secret key for JWT tokens

### Frontend
- Update API URLs in environment files before building

## 🤝 Contributing

This is an internal project. For feature requests or bug reports, contact the development team.

## 📄 License

Internal use only - Company proprietary software

## 🆘 Support

For technical support, contact:
- IT Department
- Email: support@company.com
