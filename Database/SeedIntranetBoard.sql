-- ============================================================
-- SEED: Intranet Project Board for IT Department
-- Tracks ALL features built across the entire intranet
-- ============================================================
USE ProjectTrackerDB;
GO

-- Use IT Department (14) and Admin User (1) as creator
DECLARE @DeptId INT = 14;
DECLARE @UserId INT = 1;
DECLARE @Now DATETIME2 = GETDATE();

-- ============================================================
-- 1. CREATE THE BOARD
-- ============================================================
INSERT INTO Boards (DepartmentId, Title, Description, CreatedAt, UpdatedAt, CreatedByUserId, Status)
VALUES (
    @DeptId,
    N'Intranet Development Tracker',
    N'Complete project tracker for the company Intranet system. Tracks every feature, module, and integration built across all departments. Angular 19 + ASP.NET Core + SQL Server + Docker.',
    @Now, @Now, @UserId, N'In Progress'
);

DECLARE @BoardId INT = SCOPE_IDENTITY();

-- ============================================================
-- 2. CREATE LISTS (Workflow Columns)
-- ============================================================
INSERT INTO Lists (BoardId, Title, Position, CreatedAt, UpdatedAt) VALUES
(@BoardId, N'Completed',        1, @Now, @Now),
(@BoardId, N'In Progress',      2, @Now, @Now),
(@BoardId, N'Planned / Backlog', 3, @Now, @Now),
(@BoardId, N'Bugs / Issues',    4, @Now, @Now);

DECLARE @CompletedListId INT = (SELECT ListId FROM Lists WHERE BoardId = @BoardId AND Title = N'Completed');
DECLARE @InProgressListId INT = (SELECT ListId FROM Lists WHERE BoardId = @BoardId AND Title = N'In Progress');
DECLARE @PlannedListId INT = (SELECT ListId FROM Lists WHERE BoardId = @BoardId AND Title = N'Planned / Backlog');
DECLARE @BugsListId INT = (SELECT ListId FROM Lists WHERE BoardId = @BoardId AND Title = N'Bugs / Issues');

-- ============================================================
-- 3. CREATE CARDS  COMPLETED FEATURES
-- ============================================================

-- ---------- CORE PLATFORM ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Authentication & Authorization',
 N'JWT-based login system with BCrypt password hashing. Role-based access control (Super Admin, Manager, Employee). Module-level permissions for 14 modules. Auth guard + Module guard on all routes. Auth interceptor for automatic token injection. Session management with auto-logout.',
 @UserId, NULL, N'Completed', 1, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Home Dashboard',
 N'Main landing page with: Company Announcements (priority-tagged Urgent/High/Normal with read tracking), Attendance Today widget (Early Birds & Late Birds with employee photos and check-in times), Rotating Hero Card (Welcome New Members, Today''s Birthdays with confetti, Upcoming Birthdays), Weather & Time multi-location rotating display, Quote of the Day motivational widget.',
 @UserId, NULL, N'Completed', 2, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Navbar & Navigation System',
 N'Responsive top navbar with sidebar navigation. Quick-access tools: ToDo Dialog, Request Dialog, Quick Print, Announcement viewer, User Search Popup. Chat bubbles dropdown with unread badge counts. Notification bell with unified notification dropdown (meeting requests, system alerts). Profile menu with logout. Module permission-based menu visibility.',
 @UserId, NULL, N'Completed', 3, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'User Profile Page',
 N'Full profile management page. View/edit personal info (name, email, department, role). Profile photo upload with preview. Change password functionality. HBA1C-style loading progress bar.',
 @UserId, NULL, N'Completed', 4, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'User Management Module',
 N'Admin module for managing all system users. Full CRUD operations. Role assignment (Super Admin, Manager, Employee). Department assignment. Module-level permission toggles for 14 modules. Clock-in system link. Active/Inactive status management. Search and filter. Loading progress bar.',
 @UserId, NULL, N'Completed', 5, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Admin Settings Panel',
 N'Comprehensive admin settings with tabs: Announcements management (create/edit/deactivate, type & status filters, pagination), User Management tab, System Logs viewer (searchable activity log), Database & Backup management, Data Import (Excel/CSV for Sales, SOH, etc.).',
 @UserId, NULL, N'Completed', 6, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Docker Deployment',
 N'Full Docker Compose deployment with 4 containers: Frontend (Angular + Nginx on port 4200), Backend (ASP.NET Core on port 5143), Database (SQL Server 2022 on port 1435), SearXNG (web search on port 8888). Health checks on all containers. Volume persistence for database and NAS documents. Production-ready nginx.conf with Angular routing support.',
 @UserId, NULL, N'Completed', 7, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Loading Progress Bars (All Dashboards)',
 N'HBA1C-style animated loading progress bars implemented across ALL 10 dashboards. Each has unique icon, color theme, and contextual step labels (Authenticating  Fetching Data  Processing  Ready). Shimmer animation, deceleration formula, step indicators. Components: HBA1C, Tenders, Sales, Collaborative Docs, Department Hub, User Management, Support Tickets, Stock Management, Condoms Dashboard, Profile.',
 @UserId, NULL, N'Completed', 8, @Now, @Now, @UserId);

-- ---------- SALES MODULE ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Sales Dashboard  Core',
 N'Full sales dashboard (~6,180 lines) with multi-company support (PMT, ACM, PHT, SBT). KPI stat cards: Total Customers, Total Invoices, Revenue, Active Customers, Incoming/Processing Orders. Company selector dropdown. Orange-themed loading progress bar.',
 @UserId, NULL, N'Completed', 10, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Sales  Customer Management (CRM)',
 N'Full CRM functionality: Customer code, name, contact person, phone, email, physical address, city, province, postal code. Customer type, credit limit, current balance, payment terms, account status. Delivery addresses with lat/lng. Searchable customer list with filters.',
 @UserId, NULL, N'Completed', 11, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Sales  Invoice Management',
 N'Invoice listing with transaction numbers, product details, quantities, sales amounts, cost of sales, margin calculation. Source company tracking. Invoice status management. Linked to customers and loads.',
 @UserId, NULL, N'Completed', 12, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Sales  Excel Import System',
 N'Password-protected Excel import dialog for Sales data and Customer data. Batch import with staging table validation. Import issues tracking. SalesImportBatches with summary JSON, date ranges, totals. Committed/rollback support.',
 @UserId, NULL, N'Completed', 13, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Sales  Charts & Analytics',
 N'Chart.js visualizations: Sales by Company bar chart, Top Customers chart, Sales by Province, Top Products, Daily Sales trend line, Cancellations by Reason. Report generation with summary stats (total invoices, revenue, profit margin, unique customers, cancellation value).',
 @UserId, NULL, N'Completed', 14, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Sales  Order Cancellations',
 N'Full cancellation workflow: cancellation reasons, approval status tracking, refund tracking, value calculation. Cancellation analytics chart.',
 @UserId, NULL, N'Completed', 15, @Now, @Now, @UserId);

-- ---------- LOGISTICS MODULE ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Logistics Dashboard  Core',
 N'Massive logistics module (~14,000+ lines). Stat cards: Total Fleet, Total Drivers, Available Drivers, Address Issues, Sleep Outs, TFN Orders. Multiple dialogs: Vehicles, Drivers, Reports, Depots Map, Address Issues, Trip Sheet Preview.',
 @UserId, NULL, N'Completed', 20, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Logistics  Active Loads Management',
 N'Mat-table of active loads with customer, driver, status, items. Menu actions: view route on Google Maps, manage load details, assign driver. Load lifecycle management (Planning  In Transit  Delivered). Load items and load stops tracking.',
 @UserId, NULL, N'Completed', 21, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Logistics  Fleet Management (Live)',
 N'Vehicle grid cards with real-time status. CarTrack integration for live GPS tracking. Vehicle details: type, registration, status, assigned driver, fuel level. Vehicle assignment/unassignment. Fleet status overview.',
 @UserId, NULL, N'Completed', 22, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Logistics  Maintenance Tracking',
 N'Vehicle maintenance records: scheduled, repair, license, inspection types. Maintenance history per vehicle. Cost tracking. Due date reminders.',
 @UserId, NULL, N'Completed', 23, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Logistics  Trip Sheets',
 N'Create, preview, and print trip sheets. Line items table with product details. Load trip sheets from database. Trip sheet print formatting. TripSheetImportService for bulk imports.',
 @UserId, NULL, N'Completed', 24, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Logistics  TFN Fuel Integration',
 N'TFN fuel card system integration: vehicle fuel cards, balances, depot locations, fuel orders, transactions. TfnSyncService for data synchronization. TfnTokenService for authentication. TFN Orders dialog with warning thresholds.',
 @UserId, NULL, N'Completed', 25, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Logistics  Google Maps Integration',
 N'5 Google services: GeocodingService, AddressValidationService, RouteOptimizationService, RoutesService, WebSearchService. Route visualization on map, depot mapping, address validation, geocoding, route optimization. Depots Map dialog.',
 @UserId, NULL, N'Completed', 26, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Logistics  Sleep Outs & Scrap',
 N'Sleep out tracking for drivers (overnight stays). Scrap records management for damaged/scrapped stock. Both with full CRUD and reporting.',
 @UserId, NULL, N'Completed', 27, @Now, @Now, @UserId);

-- ---------- TENDERS MODULE ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Tenders Dashboard  Core',
 N'Tenders module with KPI cards: Active Tenders, Submitted, Won, Lost, Compliance Expiring. Tabs: Active Tenders, Compliance Vault, Calendar, Analytics. Blue-themed loading progress bar. Sortable tables with search and filter.',
 @UserId, NULL, N'Completed', 30, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Tenders  Active Tenders Table',
 N'Sortable table with columns: Reference, Tender Name, Issuing Entity, Clerk, Deadline, Status, Samples & Artwork status. Create/edit tender dialog. Tender detail dialog with full info, team members, BOQ items, documents, activities, reminders.',
 @UserId, NULL, N'Completed', 31, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Tenders  Compliance Vault',
 N'Compliance document management: Summary cards (Valid/Expiring/Expired counts). Document grid with upload/renew capabilities. Expiry date tracking with visual warnings. Document categories and status management.',
 @UserId, NULL, N'Completed', 32, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Tenders  Calendar & Analytics',
 N'Tender calendar with deadline visualization, submission dates, site meeting dates. Analytics tab with win/loss rates, bidding performance metrics, tender value analysis.',
 @UserId, NULL, N'Completed', 33, @Now, @Now, @UserId);

-- ---------- HR MODULE ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Human Resource Dashboard',
 N'HR module with: Department Browser (grid with search, employee counts per department), Employee Training Center (training videos, manuals, HR policies, code of conduct, employee handbook), Attendance Monitor (live status with biometric photo data). Department breakdown with present/total counts.',
 @UserId, NULL, N'Completed', 40, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'HR  Attendance System',
 N'Live employee attendance tracking with biometric integration (photos). Total employees, present count, attendance rate percentage. Employee grid cards with photo, name, position, status (Present/Absent/Late), time-in/time-out, late minutes badge. Search and filter by name. SignalR real-time updates via AttendanceHub.',
 @UserId, NULL, N'Completed', 41, @Now, @Now, @UserId);

-- ---------- STOCK MODULE ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Stock Management Dashboard',
 N'Warehouse selection cards showing name, total items, stock value. Per-warehouse operations: Inventory Management, Scrap Management, Stock Take, Repackaging, Dispatches, Transfers & Returns, GRV (Goods Received Voucher). Charts: Stock by Building, Top Items, Invoice Status, Load Status. Summary stats. Sky-themed loading progress bar.',
 @UserId, NULL, N'Completed', 50, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Stock  SOH Import',
 N'Stock-on-hand Excel import system. SohImportDialogComponent for file upload. StockOnHandImportService for processing. Batch validation and import tracking. Stock snapshots for historical data.',
 @UserId, NULL, N'Completed', 51, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Warehouse 3D Visualization',
 N'Full Three.js 3D visualization of warehouse buildings. Orbit controls & drag controls for navigation. Interactive warehouse boxes with stock data overlay. Visual stock level representation with color coding.',
 @UserId, NULL, N'Completed', 52, @Now, @Now, @UserId);

-- ---------- COMPANY PROJECTS ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Condoms Production Dashboard',
 N'Production tracking dashboard for condom manufacturing. Production schedule management. Sample tracking and artwork status. Pink-themed loading progress bar with health_and_safety icon.',
 @UserId, NULL, N'Completed', 55, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'HBA1C Live Dashboard',
 N'Live medical device monitoring dashboard. Proxies to external HBA1C API via HBA1CProxyController. Real-time data display with auto-refresh. Custom loading progress bar pattern (the original that was replicated across all dashboards).',
 @UserId, NULL, N'Completed', 56, @Now, @Now, @UserId);

-- ---------- DOCUMENTS ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Department Documents Hub',
 N'Department-based document hub grid. Search departments. Per-department document browsing via DepartmentHubComponent. File upload/download. Secure document access with department-level permissions. Amber-themed loading progress bar.',
 @UserId, NULL, N'Completed', 60, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Collaborative Documents',
 N'Google Docs-like real-time collaborative editing. Create, edit, delete documents. Rich text editor (doc-editor component). Real-time sync via SignalR CollaborativeDocsHub. Document list with author, creation date. Purple-themed loading progress bar.',
 @UserId, NULL, N'Completed', 61, @Now, @Now, @UserId);

-- ---------- COMMUNICATION ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Messaging System',
 N'Full messaging system: Conversation sidebar with search, online status indicators. 1:1 and Group chats with avatar support. Message thread with full history, timestamps, attachments. User search popup to find colleagues. Floating chat bubbles from navbar with unread badge count. Real-time via SignalR ChatHub.',
 @UserId, NULL, N'Completed', 65, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Notifications System',
 N'Unified notifications dropdown in navbar. Type badges with color-coded icons and timestamps. Action buttons (accept/decline for meeting requests). Mark all read functionality. Badge count on navbar bell icon. Multiple notification types: meetings, support tickets, announcements, system alerts.',
 @UserId, NULL, N'Completed', 66, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Support Tickets',
 N'Full ticketing system: Create ticket dialog with priority selection. Open/Closed ticket tabs with counts. Ticket cards with priority-colored borders (Low/Medium/High/Critical). Search tickets. Ticket statistics dashboard. Response/comment thread per ticket. Green-themed loading progress bar.',
 @UserId, NULL, N'Completed', 67, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Calendar & Meetings',
 N'Full month-view calendar grid with day-click events. Events sidebar with sections: Birthdays, ToDo Tasks, Events. Color-coded event indicators. Meeting scheduling with time/location/description. Meeting request accept/decline via notifications. MeetingsController backend.',
 @UserId, NULL, N'Completed', 68, @Now, @Now, @UserId);

-- ---------- PBX ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'PBX Phone System',
 N'Full phone system integration with UCM6302A PBX. Tabs: Active Calls (live inbound/outbound/internal call cards with direction, extension, caller ID, duration), Call History CDR (searchable records with date range and extension filter, paginated), Extensions (status grid, registered/unregistered). Status cards: PBX Connected, Active Calls breakdown, Extensions count, Uptime. Call Center mode vs My Extension mode.',
 @UserId, NULL, N'Completed', 70, @Now, @Now, @UserId);

-- ---------- AI ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'AI Assistant "Welly"',
 N'Local LLM-powered AI assistant. Floating chatbot (minimizable/maximizable). llama-server running Qwen 2.5 14B / DeepSeek-R1 14B GGUF models on 48 CPU threads. 8 backend AI services: LlamaAIService, LocalLlmService, ClaudeAIService, OllamaAIService, AIActionService, AIContextService, ConversationMemoryService, LogisticsAIService. AI Actions: create support tickets, schedule meetings from chat. Knowledge base search (kb-docs). Stock analysis integration. SearXNG self-hosted web search.',
 @UserId, NULL, N'Completed', 75, @Now, @Now, @UserId);

-- ---------- PROJECT MANAGEMENT ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'Project Management (Kanban)',
 N'Trello-style project board: Kanban drag-and-drop (Angular CDK). Department overview with board counts. Views: List, Kanban, Timeline. Lists (columns) with position ordering. Cards with due dates, assignment, priority, comments, attachments, checklists. Real-time via SignalR BoardHub. Department/Workflow/Status filters.',
 @UserId, NULL, N'Completed', 80, @Now, @Now, @UserId);

-- ---------- SIGNALR ----------
INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@CompletedListId, N'SignalR Real-Time Hubs',
 N'4 SignalR hubs for real-time features: BoardHub (live Kanban card movements, instant updates), ChatHub (real-time messaging, typing indicators, online status), AttendanceHub (live attendance status updates), CollaborativeDocsHub (real-time document co-editing sync). All hubs support multi-client broadcasting.',
 @UserId, NULL, N'Completed', 85, @Now, @Now, @UserId);


-- ============================================================
-- 4. CREATE CARDS  IN PROGRESS
-- ============================================================

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@InProgressListId, N'Sales  Missing Days Tracking',
 N'Identify and track missing sales import days per company (PMT, ACM, PHT, SBT). Currently Promed missing 5 business days in March 2026 (5th, 11th, 12th, 17th, 20th). Need automated alerts when days are missing.',
 @UserId, NULL, N'In Progress', 1, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@InProgressListId, N'Condoms  Samples & Artwork Tracking',
 N'Samples and artwork status columns added to Tenders active table. Production schedule tracking in Condoms Dashboard. Needs further refinement for full sample lifecycle tracking.',
 @UserId, NULL, N'In Progress', 2, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@InProgressListId, N'AI  Model Optimization',
 N'Currently running DeepSeek-R1-14B and Qwen 2.5-14B models. Optimizing inference speed on 48 CPU threads. Testing reasoning_format options. Response time ~5-10s for simple queries. Need to evaluate GPU offloading options.',
 @UserId, NULL, N'In Progress', 3, @Now, @Now, @UserId);


-- ============================================================
-- 5. CREATE CARDS  PLANNED / BACKLOG
-- ============================================================

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Email Integration',
 N'EmailService exists in backend but not fully connected. Need: Automated email notifications for ticket updates, meeting reminders, announcement alerts, password reset flow. SMTP configuration for production.',
 @UserId, NULL, N'Planning', 1, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Mobile Responsive Design',
 N'Current design optimized for desktop. Need responsive layouts for mobile/tablet: collapsible sidebar, touch-friendly controls, mobile-optimized tables and dialogs, PWA support.',
 @UserId, NULL, N'Planning', 2, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Advanced Reporting Module',
 N'Dedicated reporting section with: Scheduled report generation, PDF/Excel export for all modules, custom date range reports, email report distribution, report caching (ReportCache table exists).',
 @UserId, NULL, N'Planning', 3, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Database Backup Automation',
 N'Backup-Database.ps1 and Setup-BackupSchedule.ps1 scripts exist. Need: Automated scheduled backups, backup verification, restore testing, backup notifications, off-site backup support.',
 @UserId, NULL, N'Planning', 4, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Leave Management System',
 N'LeaveRequestDialogComponent exists. Need full leave system: Leave balances per employee, leave types (Annual, Sick, Family), approval workflow (Manager  HR  Approved), leave calendar visualization, public holiday integration.',
 @UserId, NULL, N'Planning', 5, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Payslip Management',
 N'PayslipRequestDialogComponent exists. Need: Payslip upload system for HR/Finance, employee self-service payslip viewing, payslip archive, IRP5 document management.',
 @UserId, NULL, N'Planning', 6, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Employee Performance Reviews',
 N'Need: Performance review cycles, KPI tracking per employee, manager evaluation forms, self-assessment, goal setting, performance history, review reminders.',
 @UserId, NULL, N'Planning', 7, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Audit Trail Enhancement',
 N'AuditLogs table exists. Need: Comprehensive audit logging for all CRUD operations, user action tracking, login/logout logging, data change history with before/after values, audit report generation.',
 @UserId, NULL, N'Planning', 8, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Employee Self-Service Portal',
 N'Consolidated employee portal: View own attendance, submit leave requests, view payslips, update personal details, view company directory, submit IT support tickets, access training materials.',
 @UserId, NULL, N'Planning', 9, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Backorder Management',
 N'Backorders table exists in database. Need full UI: Backorder listing, automatic creation when stock insufficient, backorder fulfillment workflow, customer notifications, backorder aging reports.',
 @UserId, NULL, N'Planning', 10, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Government Contracts Module',
 N'GovernmentContracts table exists. Need UI: Contract listing, value tracking, expiry management, renewal workflow, linked tenders, compliance document linking.',
 @UserId, NULL, N'Planning', 11, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@PlannedListId, N'Two-Factor Authentication (2FA)',
 N'Enhance security with: TOTP-based 2FA, QR code setup, backup codes, enforced for Admin/Manager roles, optional for employees.',
 @UserId, NULL, N'Planning', 12, @Now, @Now, @UserId);


-- ============================================================
-- 6. CREATE CARDS  BUGS / ISSUES
-- ============================================================

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@BugsListId, N'Backend Docker Build Issue',
 N'docker compose build backend currently failing. Need to investigate .NET 10 SDK Docker image availability and fix Dockerfile. Frontend and DB containers working fine.',
 @UserId, NULL, N'In Progress', 1, @Now, @Now, @UserId);

INSERT INTO Cards (ListId, Title, Description, AssignedToUserId, DueDate, Status, Position, CreatedAt, UpdatedAt, CreatedByUserId) VALUES
(@BugsListId, N'CommonJS Dependency Warnings',
 N'Angular build shows CommonJS warnings for: canvg, html2canvas, dompurify, tesseract.js, is-electron. These are optimization bailout warnings. Need to evaluate tree-shaking alternatives or add to allowedCommonJsDependencies.',
 @UserId, NULL, N'Planning', 2, @Now, @Now, @UserId);


-- ============================================================
-- 7. CREATE CHECKLIST ITEMS  Per-Department Feature Tracker
-- ============================================================

-- These provide a quick tick-off overview of ALL department features

-- === CORE PLATFORM ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Login / Authentication (JWT + BCrypt)', 1, 1, @Now, @Now, @UserId),
(@BoardId, N'Role-Based Access Control (Admin/Manager/Employee)', 1, 2, @Now, @Now, @UserId),
(@BoardId, N'Module-Level Permissions (14 modules)', 1, 3, @Now, @Now, @UserId),
(@BoardId, N'Responsive Navbar with Sidebar', 1, 4, @Now, @Now, @UserId),
(@BoardId, N'Home Dashboard with Widgets', 1, 5, @Now, @Now, @UserId),
(@BoardId, N'Docker Compose (4 containers)', 1, 6, @Now, @Now, @UserId),
(@BoardId, N'Loading Progress Bars (all dashboards)', 1, 7, @Now, @Now, @UserId),
(@BoardId, N'User Profile Page', 1, 8, @Now, @Now, @UserId),
(@BoardId, N'User Management (CRUD + Permissions)', 1, 9, @Now, @Now, @UserId),
(@BoardId, N'Admin Settings Panel', 1, 10, @Now, @Now, @UserId);

-- === SALES ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Sales Dashboard (multi-company KPIs)', 1, 11, @Now, @Now, @UserId),
(@BoardId, N'Customer Management (CRM)', 1, 12, @Now, @Now, @UserId),
(@BoardId, N'Invoice Management', 1, 13, @Now, @Now, @UserId),
(@BoardId, N'Excel Import (Sales + Customers)', 1, 14, @Now, @Now, @UserId),
(@BoardId, N'Sales Charts & Analytics (Chart.js)', 1, 15, @Now, @Now, @UserId),
(@BoardId, N'Order Cancellations Workflow', 1, 16, @Now, @Now, @UserId),
(@BoardId, N'Report Generation', 1, 17, @Now, @Now, @UserId);

-- === LOGISTICS ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Logistics Dashboard (stat cards + tabs)', 1, 18, @Now, @Now, @UserId),
(@BoardId, N'Active Loads Management', 1, 19, @Now, @Now, @UserId),
(@BoardId, N'Fleet Management (Live)', 1, 20, @Now, @Now, @UserId),
(@BoardId, N'Vehicle Maintenance Tracking', 1, 21, @Now, @Now, @UserId),
(@BoardId, N'Trip Sheets (create/preview/print)', 1, 22, @Now, @Now, @UserId),
(@BoardId, N'TFN Fuel Card Integration', 1, 23, @Now, @Now, @UserId),
(@BoardId, N'Google Maps (routes/geocoding/optimization)', 1, 24, @Now, @Now, @UserId),
(@BoardId, N'CarTrack GPS Integration', 1, 25, @Now, @Now, @UserId),
(@BoardId, N'Sleep Outs Tracking', 1, 26, @Now, @Now, @UserId),
(@BoardId, N'Scrap Records Management', 1, 27, @Now, @Now, @UserId),
(@BoardId, N'Driver Management', 1, 28, @Now, @Now, @UserId);

-- === TENDERS ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Tenders Dashboard (Active/Compliance/Calendar/Analytics)', 1, 29, @Now, @Now, @UserId),
(@BoardId, N'Active Tenders Table (sort/filter/search)', 1, 30, @Now, @Now, @UserId),
(@BoardId, N'Compliance Vault (Valid/Expiring/Expired)', 1, 31, @Now, @Now, @UserId),
(@BoardId, N'Tender Detail Dialog (team/BOQ/docs/activities)', 1, 32, @Now, @Now, @UserId),
(@BoardId, N'Samples & Artwork Status Columns', 1, 33, @Now, @Now, @UserId);

-- === HUMAN RESOURCES ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'HR Dashboard (departments/training/attendance)', 1, 34, @Now, @Now, @UserId),
(@BoardId, N'Biometric Attendance System', 1, 35, @Now, @Now, @UserId),
(@BoardId, N'Employee Training Center', 1, 36, @Now, @Now, @UserId),
(@BoardId, N'Department Browser', 1, 37, @Now, @Now, @UserId);

-- === STOCK ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Stock Management Dashboard', 1, 38, @Now, @Now, @UserId),
(@BoardId, N'Warehouse Selection + Operations', 1, 39, @Now, @Now, @UserId),
(@BoardId, N'SOH Import System', 1, 40, @Now, @Now, @UserId),
(@BoardId, N'3D Warehouse Visualization (Three.js)', 1, 41, @Now, @Now, @UserId),
(@BoardId, N'AI Stock Analysis (Welly)', 1, 42, @Now, @Now, @UserId);

-- === COMPANY PROJECTS ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Condoms Production Dashboard', 1, 43, @Now, @Now, @UserId),
(@BoardId, N'HBA1C Live Dashboard', 1, 44, @Now, @Now, @UserId);

-- === DOCUMENTS & COLLABORATION ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Department Documents Hub', 1, 45, @Now, @Now, @UserId),
(@BoardId, N'Collaborative Documents (real-time editing)', 1, 46, @Now, @Now, @UserId);

-- === COMMUNICATION ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Messaging System (1:1 + Group Chat)', 1, 47, @Now, @Now, @UserId),
(@BoardId, N'Chat Bubbles + Unread Badges', 1, 48, @Now, @Now, @UserId),
(@BoardId, N'Notifications System (unified dropdown)', 1, 49, @Now, @Now, @UserId),
(@BoardId, N'Support Tickets System', 1, 50, @Now, @Now, @UserId),
(@BoardId, N'Calendar & Meetings', 1, 51, @Now, @Now, @UserId);

-- === INTEGRATIONS ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'PBX Phone System (UCM6302A)', 1, 52, @Now, @Now, @UserId),
(@BoardId, N'AI Assistant "Welly" (Local LLM)', 1, 53, @Now, @Now, @UserId),
(@BoardId, N'Knowledge Base (kb-docs)', 1, 54, @Now, @Now, @UserId),
(@BoardId, N'SearXNG Web Search', 1, 55, @Now, @Now, @UserId),
(@BoardId, N'SignalR Hubs (4 real-time channels)', 1, 56, @Now, @Now, @UserId);

-- === PROJECT MANAGEMENT ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Kanban Board (drag-and-drop)', 1, 57, @Now, @Now, @UserId),
(@BoardId, N'Board Checklists', 1, 58, @Now, @Now, @UserId),
(@BoardId, N'Card Comments & Attachments', 1, 59, @Now, @Now, @UserId);

-- === OUTSTANDING / NOT YET DONE ===
INSERT INTO BoardChecklistItems (BoardId, Title, IsCompleted, Position, CreatedAt, CompletedAt, CompletedByUserId) VALUES
(@BoardId, N'Email Notifications (automated)', 0, 60, @Now, NULL, NULL),
(@BoardId, N'Mobile Responsive Design', 0, 61, @Now, NULL, NULL),
(@BoardId, N'Advanced Reporting Module (PDF/Excel export)', 0, 62, @Now, NULL, NULL),
(@BoardId, N'Automated Database Backups', 0, 63, @Now, NULL, NULL),
(@BoardId, N'Leave Management System (full workflow)', 0, 64, @Now, NULL, NULL),
(@BoardId, N'Payslip Management', 0, 65, @Now, NULL, NULL),
(@BoardId, N'Employee Performance Reviews', 0, 66, @Now, NULL, NULL),
(@BoardId, N'Comprehensive Audit Trail', 0, 67, @Now, NULL, NULL),
(@BoardId, N'Employee Self-Service Portal', 0, 68, @Now, NULL, NULL),
(@BoardId, N'Backorder Management UI', 0, 69, @Now, NULL, NULL),
(@BoardId, N'Government Contracts UI', 0, 70, @Now, NULL, NULL),
(@BoardId, N'Two-Factor Authentication (2FA)', 0, 71, @Now, NULL, NULL),
(@BoardId, N'Fix Backend Docker Build', 0, 72, @Now, NULL, NULL);

-- ============================================================
-- SUMMARY OUTPUT
-- ============================================================
SELECT 'Board Created' AS Result, @BoardId AS BoardId;
SELECT 'Lists' AS [Type], COUNT(*) AS [Count] FROM Lists WHERE BoardId = @BoardId;
SELECT 'Cards' AS [Type], COUNT(*) AS [Count] FROM Cards WHERE ListId IN (SELECT ListId FROM Lists WHERE BoardId = @BoardId);
SELECT 'Checklist Items' AS [Type], COUNT(*) AS [Count] FROM BoardChecklistItems WHERE BoardId = @BoardId;
SELECT 'Completed Items' AS [Type], COUNT(*) AS [Count] FROM BoardChecklistItems WHERE BoardId = @BoardId AND IsCompleted = 1;
SELECT 'Outstanding Items' AS [Type], COUNT(*) AS [Count] FROM BoardChecklistItems WHERE BoardId = @BoardId AND IsCompleted = 0;

PRINT 'Intranet Development Tracker board created successfully!';
GO


