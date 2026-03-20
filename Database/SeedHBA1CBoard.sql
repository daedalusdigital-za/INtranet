-- =============================================
-- Seed: HBA1C Medical Management API (NCD-API)
-- Project Management Board
-- Date: March 20, 2026
-- Board ID: 31
-- =============================================

USE ProjectTrackerDB;
GO

-- Clean up if re-running
DELETE FROM BoardChecklistItems WHERE BoardId = 31;
DELETE FROM Cards WHERE ListId IN (SELECT ListId FROM Lists WHERE BoardId = 31);
DELETE FROM Lists WHERE BoardId = 31;
DELETE FROM BoardMembers WHERE BoardId = 31;
DELETE FROM Boards WHERE BoardId = 31;
GO

SET IDENTITY_INSERT Boards ON;
INSERT INTO Boards (BoardId, Title, Description, DepartmentId, CreatedByUserId, Status, CreatedAt, UpdatedAt)
VALUES (31,
  'HBA1C Medical Management API (NCD-API)',
  'Comprehensive healthcare management system for Non-Communicable Disease (NCD) prevention and management in South Africa. .NET 8 Web API with Azure SQL, JWT Auth, Clean Architecture. Production: https://ngcanduapi.azurewebsites.net',
  14, 1, 'Active', GETDATE(), GETDATE());
SET IDENTITY_INSERT Boards OFF;
GO

-- Add board member (Admin)
INSERT INTO BoardMembers (BoardId, UserId, Role, InvitedAt, InvitedByUserId)
VALUES (31, 1, 'Admin', GETDATE(), 1);
GO

-- =============================================
-- LISTS (Kanban Columns)
-- =============================================
DECLARE @CompletedListId INT;
DECLARE @InProgressListId INT;
DECLARE @PendingListId INT;
DECLARE @BacklogListId INT;

INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES (31, 'Completed', 0, GETDATE());
SET @CompletedListId = SCOPE_IDENTITY();

INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES (31, 'In Progress', 1, GETDATE());
SET @InProgressListId = SCOPE_IDENTITY();

INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES (31, 'Pending', 2, GETDATE());
SET @PendingListId = SCOPE_IDENTITY();

INSERT INTO Lists (BoardId, Title, Position, CreatedAt) VALUES (31, 'Backlog', 3, GETDATE());
SET @BacklogListId = SCOPE_IDENTITY();

-- =============================================
-- COMPLETED CARDS
-- =============================================

-- 1. Authentication & Authorization
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Authentication & Authorization',
  'AuthController.cs - JWT token generation (24h validity), password hashing with ASP.NET Identity, role-based access control, token refresh. Endpoints: POST Login, POST Register, POST VerifyRegistration.',
  'Completed', 0, GETDATE(), GETDATE(), 1);

-- 2. Location Management
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Location Management',
  'LocationController.cs - All 9 SA provinces, districts, hospitals, clinics. 6 endpoints including filtered queries by province. Tables: Province, District, Clinic.',
  'Completed', 1, GETDATE(), GETDATE(), 1);

-- 3. Trainer Management
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Trainer Management',
  'TrainerController.cs - Full CRUD with filtering by province, status, and stats. 8 endpoints. Table: Trainer. Current data: 5 active trainers.',
  'Completed', 2, GETDATE(), GETDATE(), 1);

-- 4. Training Session Management
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Training Session Management',
  'TrainingController.cs - Full CRUD with filtering by trainer, province, date range, status. 10 endpoints. Table: TrainingSession. Types: NCD Awareness, Diabetes Management, Equipment Training. Current data: 267 sessions.',
  'Completed', 3, GETDATE(), GETDATE(), 1);

-- 5. Inventory Management
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Inventory Management',
  'InventoryController.cs - Full CRUD with category filtering, low stock alerts, stock level updates, stats. 10 endpoints. Table: InventoryItem. 22 items across 8 categories (HemoglobinTesting, GlucoseTesting, HBA1CTesting, etc).',
  'Completed', 4, GETDATE(), GETDATE(), 1);

-- 6. Sales Management
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Sales Management',
  'SalesController.cs - Full CRUD with date range, province filtering, stats, provincial data breakdown. 9 endpoints. Tables: Sale (headers), SaleItem (line items). Current data: 2,063+ sale items, 22 unique inventory items.',
  'Completed', 5, GETDATE(), GETDATE(), 1);

-- 7. Credit Notes Management
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Credit Notes Management',
  'CreditNotesController.cs - Full CRUD with approval workflow (Pending > Approved/Rejected > Completed). Auto-generated CN numbers (CN-YYYYMMDD-XXXX). Stock/sale reversal on approval. PDF upload/download (5MB max). VAT 15%. 10 endpoints. Table: CreditNotes (23 columns, 4 indexes).',
  'Completed', 6, GETDATE(), GETDATE(), 1);

-- 8. Delivery Tracking
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Delivery Tracking',
  'DeliveryController.cs - Full CRUD with status tracking (Pending/InTransit/Delivered/Failed/Returned). Filtering by sale, province, status, date range, equipment type. Enhanced stats: province distribution, item breakdown, order vs delivery comparison, delivery rate %. 15 endpoints. Table: Deliveries (5 indexes).',
  'Completed', 7, GETDATE(), GETDATE(), 1);

-- 9. Dashboard & Analytics
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Dashboard & Analytics',
  'DashboardController.cs - Training stats, province breakdown, national totals, HGT meter/strip distribution, equipment stats, occupation stats. 7 endpoints.',
  'Completed', 8, GETDATE(), GETDATE(), 1);

-- 10. User Management
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'User Management',
  'UserController.cs + UserProfileController.cs - Registration, profile management, password change, role assignment, user listing, user deactivation. Tables: AspNetUsers, UserProfile, AspNetRoles, UserRole.',
  'Completed', 9, GETDATE(), GETDATE(), 1);

-- 11. Role & Permission Management
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Role & Permission Management',
  'RoleController.cs + PermissionController.cs - Predefined roles, custom permissions, role-based authorization.',
  'Completed', 10, GETDATE(), GETDATE(), 1);

-- 12. Contact Management
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Contact Management',
  'ContactDetailsController.cs - Contact CRUD operations, contact types.',
  'Completed', 11, GETDATE(), GETDATE(), 1);

-- 13. API Documentation
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'API Documentation',
  'Complete documentation suite: NDCANGU-API-README.md, API_ENDPOINTS_DOCUMENTATION.md, PROJECT_COMPLETION_STATUS.md, CREDIT_NOTES_IMPLEMENTATION_STATUS.md, FRONTEND_TEAM_IMPLEMENTATION_GUIDE.md, VAT_QUICK_REFERENCE.md, DEPLOYMENT_INSTRUCTIONS.md.',
  'Completed', 12, GETDATE(), GETDATE(), 1);

-- 14. Database Schema & Seeding
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Database Schema & Seeding',
  '24 entity classes, Clean Architecture (4-layer). SQL scripts: create_deliveries_table.sql, SQL_INITIALIZATION_SCRIPT.sql. Seeded data: 9 provinces, 267 training sessions, 22 inventory items, 5 trainers, 2063+ sale items.',
  'Completed', 13, GETDATE(), GETDATE(), 1);

-- 15. Azure Deployment
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Azure Deployment',
  'App Service: ngcanduapi. SQL Server: ngcandu.database.windows.net. DB: MedicalManagementDB. Swagger: /swagger/index.html. Deployment scripts: deploy-azure-zip.ps1, deploy-simple.ps1, deploy-ftp.ps1, deploy-credit-notes.ps1.',
  'Completed', 14, GETDATE(), GETDATE(), 1);

-- 16. Project Architecture Setup
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@CompletedListId,
  'Project Architecture Setup',
  'MedicalHistory.sln - Clean Architecture: MH.Api (Presentation, 17 Controllers), MH.Application (Business Logic, 17 Services), MH.Domain (24 Entities, Models, ViewModels), MH.Infrastructure (15 Repositories, EF Core DbContext, Migrations). AutoMapper profiles. Swagger/OpenAPI.',
  'Completed', 15, GETDATE(), GETDATE(), 1);

-- =============================================
-- IN PROGRESS CARDS
-- =============================================

-- Phase 4: Production Hardening
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@InProgressListId,
  'Phase 4: Production Hardening',
  'Final phase before go-live. Enable authentication on all controllers, security audit, performance optimization, final testing. HIGH PRIORITY.',
  'In Progress', 0, GETDATE(), GETDATE(), 1);

-- Enable [Authorize] on Controllers
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@InProgressListId,
  'Re-enable [Authorize] on All Controllers',
  'HIGH PRIORITY - Currently disabled for testing. All 17 controllers need [Authorize] attribute re-enabled before production go-live. Must coordinate with frontend team for JWT token integration.',
  'In Progress', 1, GETDATE(), GETDATE(), 1);

-- Update JWT Secret
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@InProgressListId,
  'Update JWT Secret for Production',
  'HIGH PRIORITY - Replace development JWT secret with a strong production secret in Azure App Service configuration. Ensure token validation still works after rotation.',
  'In Progress', 2, GETDATE(), GETDATE(), 1);

-- =============================================
-- PENDING CARDS
-- =============================================

-- Frontend: Credit Notes UI
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Frontend: Credit Notes UI',
  'HIGH PRIORITY - Implement Credit Notes interface. Create/edit/view credit notes, approval workflow UI, PDF upload/download, status filtering. Refer to CREDIT_NOTES_IMPLEMENTATION_STATUS.md and FRONTEND_TEAM_IMPLEMENTATION_GUIDE.md.',
  'Planning', 0, GETDATE(), GETDATE(), 1);

-- Frontend: Delivery Tracking UI
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Frontend: Delivery Tracking UI',
  'HIGH PRIORITY - Implement delivery tracking interface. Status updates (Pending/InTransit/Delivered/Failed/Returned), province filtering, equipment type views, statistics dashboard.',
  'Planning', 1, GETDATE(), GETDATE(), 1);

-- Frontend: Dashboard Visualizations
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Frontend: Dashboard Visualizations',
  'MEDIUM PRIORITY - Build dashboard with charts/graphs. Training stats, province breakdown, national totals, HGT meter/strip distribution, equipment stats, occupation stats. 7 API endpoints available.',
  'Planning', 2, GETDATE(), GETDATE(), 1);

-- Frontend: User Management UI
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Frontend: User Management UI',
  'MEDIUM PRIORITY - User management interface. Registration, profile management, password changes, role assignment, user listing, deactivation. Integrate with AuthController and UserController APIs.',
  'Planning', 3, GETDATE(), GETDATE(), 1);

-- Implement Refresh Token Rotation
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Implement Refresh Token Rotation',
  'MEDIUM PRIORITY - Security enhancement. Implement refresh token rotation to prevent token reuse attacks. Store refresh tokens server-side with expiry tracking.',
  'Planning', 4, GETDATE(), GETDATE(), 1);

-- Add API Key for External Access
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Add API Key for External Access',
  'MEDIUM PRIORITY - Implement API key authentication for external/third-party integrations. Separate from JWT user auth. Rate limit by API key.',
  'Planning', 5, GETDATE(), GETDATE(), 1);

-- Add Pagination to Large List Endpoints
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Add Pagination to Large List Endpoints',
  'MEDIUM PRIORITY - Performance optimization. Add pagination support (page, pageSize, totalCount) to GetAll endpoints. Training sessions (267+), sales items (2063+), deliveries are priority.',
  'Planning', 6, GETDATE(), GETDATE(), 1);

-- Add Rate Limiting
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Add Rate Limiting',
  'MEDIUM PRIORITY - Security enhancement. Implement rate limiting middleware. Configure per-endpoint and per-user limits. Return 429 Too Many Requests with Retry-After header.',
  'Planning', 7, GETDATE(), GETDATE(), 1);

-- Configure Monitoring & Alerts
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Configure Production Monitoring & Alerts',
  'DevOps - Set up Azure Application Insights or equivalent. Monitor API response times, error rates, database performance. Configure alerts for downtime and high error rates.',
  'Planning', 8, GETDATE(), GETDATE(), 1);

-- Set Up Backup Strategy
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Set Up Database Backup Strategy',
  'DevOps - Configure Azure SQL automated backups. Define retention policy. Test restore procedure. Document disaster recovery steps.',
  'Planning', 9, GETDATE(), GETDATE(), 1);

-- Frontend Integration Testing
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@PendingListId,
  'Frontend Integration Testing',
  'Phase 5 - Full integration testing between frontend and all 95+ API endpoints. Verify JWT token flow, error handling, data validation. User acceptance testing.',
  'Planning', 10, GETDATE(), GETDATE(), 1);

-- =============================================
-- BACKLOG CARDS
-- =============================================

-- URL Double-Slash Fix
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'Fix URL Double-Slash in Sales Endpoint',
  'LOW PRIORITY - Cosmetic issue. Sales endpoint has double-slash in URL. Non-blocking, endpoint works despite the issue.',
  'Planning', 0, GETDATE(), GETDATE(), 1);

-- Add Request Logging
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'Add Request Logging / Audit Trail',
  'LOW PRIORITY - Implement request/response logging middleware for auditing purposes. Log user actions, IP addresses, timestamps. Consider Azure Log Analytics integration.',
  'Planning', 1, GETDATE(), GETDATE(), 1);

-- Fix VerifyRegistration Typo
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'Fix VeifyRegistration Endpoint Typo',
  'LOW PRIORITY - The VerifyRegistration endpoint has a typo in the name (VeifyRegistration). Endpoint works but name is incorrect. Consider versioning impact before renaming.',
  'Planning', 2, GETDATE(), GETDATE(), 1);

-- Deploy Frontend to Production
INSERT INTO Cards (ListId, Title, Description, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId)
VALUES (@BacklogListId,
  'Deploy Frontend to Production',
  'Phase 5 final step - Deploy frontend application to production environment. Configure CORS, environment variables, SSL. Verify all integrations work end-to-end.',
  'Planning', 3, GETDATE(), GETDATE(), 1);

-- =============================================
-- BOARD CHECKLIST ITEMS
-- =============================================

-- Backend Team completed tasks
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId)
VALUES
(31, 'Implement all 95+ API endpoints across 17 controllers', 1, 0, GETDATE(), GETDATE(), 1),
(31, 'Create database schema (24 entity classes)', 1, 1, GETDATE(), GETDATE(), 1),
(31, 'Deploy API to Azure App Service', 1, 2, GETDATE(), GETDATE(), 1),
(31, 'Create complete API documentation suite', 1, 3, GETDATE(), GETDATE(), 1),
(31, 'Implement Credit Notes feature with approval workflow', 1, 4, GETDATE(), GETDATE(), 1),
(31, 'Implement Delivery tracking with enhanced statistics', 1, 5, GETDATE(), GETDATE(), 1),
(31, 'Set up JWT authentication system (24h token validity)', 1, 6, GETDATE(), GETDATE(), 1),
(31, 'Implement AutoMapper profiles for all entities', 1, 7, GETDATE(), GETDATE(), 1),
(31, 'Create Swagger/OpenAPI documentation', 1, 8, GETDATE(), GETDATE(), 1),
(31, 'Set up EF Core with Azure SQL Server', 1, 9, GETDATE(), GETDATE(), 1),
(31, 'Seed 9 South African provinces with codes', 1, 10, GETDATE(), GETDATE(), 1),
(31, 'Import 267 historical training sessions', 1, 11, GETDATE(), GETDATE(), 1),
(31, 'Verify all 22 inventory items in Azure DB', 1, 12, GETDATE(), GETDATE(), 1),
(31, 'Configure Azure App Service hosting', 1, 13, GETDATE(), GETDATE(), 1),
(31, 'Create deployment scripts (zip, simple, ftp, credit-notes)', 1, 14, GETDATE(), GETDATE(), 1),
(31, 'Implement Clean Architecture (4-layer: Api, Application, Domain, Infrastructure)', 1, 15, GETDATE(), GETDATE(), 1),
(31, 'Build 15 repository implementations', 1, 16, GETDATE(), GETDATE(), 1),
(31, 'Build 17 service implementations with interfaces', 1, 17, GETDATE(), GETDATE(), 1),
(31, 'Implement role-based access control', 1, 18, GETDATE(), GETDATE(), 1),
(31, 'Create 5 performance indexes on Deliveries table', 1, 19, GETDATE(), GETDATE(), 1),
(31, 'Create 4 indexes on CreditNotes table', 1, 20, GETDATE(), GETDATE(), 1),
(31, 'Implement VAT calculation (15%) in Credit Notes', 1, 21, GETDATE(), GETDATE(), 1),
(31, 'Implement PDF document upload/download (5MB max)', 1, 22, GETDATE(), GETDATE(), 1),
(31, 'Auto-generated Credit Note numbers (CN-YYYYMMDD-XXXX)', 1, 23, GETDATE(), GETDATE(), 1),
(31, 'Stock and sale reversal on credit note approval', 1, 24, GETDATE(), GETDATE(), 1),
(31, 'Frontend implementation guide created', 1, 25, GETDATE(), GETDATE(), 1),
(31, 'VAT quick reference guide created', 1, 26, GETDATE(), GETDATE(), 1);

-- Backend pending tasks
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt)
VALUES
(31, 'Re-enable [Authorize] attribute on all 17 controllers', 0, 27, GETDATE()),
(31, 'Update JWT secret for production security', 0, 28, GETDATE()),
(31, 'Add pagination to Training sessions endpoint (267+ records)', 0, 29, GETDATE()),
(31, 'Add pagination to Sales items endpoint (2063+ records)', 0, 30, GETDATE()),
(31, 'Add pagination to Deliveries endpoint', 0, 31, GETDATE()),
(31, 'Implement rate limiting middleware', 0, 32, GETDATE()),
(31, 'Add request/response logging middleware', 0, 33, GETDATE()),
(31, 'Fix URL double-slash in Sales endpoint', 0, 34, GETDATE()),
(31, 'Fix VeifyRegistration endpoint typo', 0, 35, GETDATE()),
(31, 'Implement refresh token rotation', 0, 36, GETDATE()),
(31, 'Add API key authentication for external access', 0, 37, GETDATE());

-- Frontend team tasks
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt)
VALUES
(31, 'Frontend: Review FRONTEND_TEAM_IMPLEMENTATION_GUIDE.md', 0, 38, GETDATE()),
(31, 'Frontend: Implement Credit Notes UI (create/edit/view/approve)', 0, 39, GETDATE()),
(31, 'Frontend: Implement Delivery Tracking UI (status updates, filters)', 0, 40, GETDATE()),
(31, 'Frontend: Build Dashboard visualizations (7 stat endpoints)', 0, 41, GETDATE()),
(31, 'Frontend: Implement User Management UI', 0, 42, GETDATE()),
(31, 'Frontend: Integrate JWT authentication flow', 0, 43, GETDATE()),
(31, 'Frontend: Test all 95+ API endpoint integrations', 0, 44, GETDATE()),
(31, 'Frontend: Deploy to production', 0, 45, GETDATE());

-- DevOps tasks
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId)
VALUES
(31, 'DevOps: Configure Azure App Service', 1, 46, GETDATE(), GETDATE(), 1),
(31, 'DevOps: Set up CI/CD pipeline (manual for now)', 1, 47, GETDATE(), GETDATE(), 1);

INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt)
VALUES
(31, 'DevOps: Configure Azure monitoring and alerts', 0, 48, GETDATE()),
(31, 'DevOps: Set up database backup strategy and test restore', 0, 49, GETDATE()),
(31, 'DevOps: Configure production CORS settings', 0, 50, GETDATE()),
(31, 'DevOps: Set up SSL certificate for custom domain', 0, 51, GETDATE());

-- Final go-live tasks
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt)
VALUES
(31, 'Security audit: Penetration testing', 0, 52, GETDATE()),
(31, 'Performance testing: Load test all endpoints', 0, 53, GETDATE()),
(31, 'User acceptance testing (UAT) sign-off', 0, 54, GETDATE()),
(31, 'Production go-live approval', 0, 55, GETDATE());

GO

-- =============================================
-- Verify the seeded data
-- =============================================
SELECT 'Board' AS Entity, COUNT(*) AS Count FROM Boards WHERE BoardId = 31
UNION ALL
SELECT 'Lists', COUNT(*) FROM Lists WHERE BoardId = 31
UNION ALL
SELECT 'Cards', COUNT(*) FROM Cards WHERE ListId IN (SELECT ListId FROM Lists WHERE BoardId = 31)
UNION ALL
SELECT 'Checklist Items', COUNT(*) FROM BoardChecklistItems WHERE BoardId = 31
UNION ALL
SELECT 'Completed Items', COUNT(*) FROM BoardChecklistItems WHERE BoardId = 31 AND IsCompleted = 1
UNION ALL
SELECT 'Outstanding Items', COUNT(*) FROM BoardChecklistItems WHERE BoardId = 31 AND IsCompleted = 0;
GO
