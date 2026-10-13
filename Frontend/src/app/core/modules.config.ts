/**
 * Intranet Module Configuration
 * 
 * This file centralizes all module definitions for the intranet.
 * Each feature is treated as a module with its own routes, permissions, and navigation.
 * 
 * To add a new module:
 * 1. Add it to MODULE_KEYS
 * 2. Add configuration to MODULES array
 * 3. Add routes to getModuleRoutes()
 * 4. Create components in components/{module-name}/
 */

import { Routes } from '@angular/router';
import { authGuard, moduleGuard } from '../guards/auth.guard';

// ============================================================================
// MODULE KEYS - All available module permission keys
// ============================================================================
export const MODULE_KEYS = {
  SALES: 'sales',
  LOGISTICS: 'logistics',
  TENDERS: 'tenders',
  PROJECT_MANAGEMENT: 'project_management',
  HUMAN_RESOURCE: 'human_resource',
  STOCK_MANAGEMENT: 'stock_management',
  COMPANY_PROJECTS: 'company_projects',
  DOCUMENTS: 'documents',
  SUPPORT_TICKETS: 'support_tickets',
  MESSAGING: 'messaging',
  AI: 'ai',
  CALENDAR: 'calendar',
  FINANCE: 'finance',
  MANAGEMENT: 'management',
  SETTINGS: 'settings'
} as const;

export type ModuleKey = typeof MODULE_KEYS[keyof typeof MODULE_KEYS];

// ============================================================================
// MODULE CONFIGURATION - Defines each module's metadata
// ============================================================================
export interface ModuleConfig {
  key: ModuleKey;
  name: string;
  description: string;
  icon: string;
  route: string;
  color?: string;
  requiresPermission: boolean;
  showInNavbar: boolean;
  showInDashboard: boolean;
  subRoutes?: { path: string; name: string; icon?: string }[];
}

export const MODULES: ModuleConfig[] = [
  {
    key: 'sales',
    name: 'Sales',
    description: 'Sales reports, analytics, and customer management',
    icon: 'point_of_sale',
    route: '/sales',
    color: '#2196F3',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true
  },
  {
    key: 'logistics',
    name: 'Logistics',
    description: 'Fleet management, drivers, warehouses, and deliveries',
    icon: 'local_shipping',
    route: '/logistics',
    color: '#FF9800',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true
  },
  {
    key: 'tenders',
    name: 'Tenders',
    description: 'Tender management, compliance vault, BOQ builder, and analytics',
    icon: 'gavel',
    route: '/tenders',
    color: '#8E24AA',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true,
    subRoutes: [
      { path: '/tenders', name: 'Dashboard', icon: 'dashboard' },
      { path: '/tenders/compliance', name: 'Compliance Vault', icon: 'verified_user' },
      { path: '/tenders/calendar', name: 'Calendar', icon: 'calendar_month' },
      { path: '/tenders/analytics', name: 'Analytics', icon: 'analytics' }
    ]
  },
  {
    key: 'project_management',
    name: 'Project Management',
    description: 'Departments, boards, and task management',
    icon: 'business',
    route: '/departments',
    color: '#9C27B0',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true
  },
  {
    key: 'human_resource',
    name: 'Human Resource',
    description: 'Employee management, attendance, and HR functions',
    icon: 'people',
    route: '/people',
    color: '#E91E63',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true
  },
  {
    key: 'stock_management',
    name: 'Stock Management',
    description: 'Inventory tracking and stock control',
    icon: 'inventory',
    route: '/stock-management',
    color: '#795548',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true
  },
  {
    key: 'company_projects',
    name: 'Projects',
    description: 'Company projects and distribution initiatives',
    icon: 'assignment',
    route: '/company-projects',
    color: '#5C6BC0',
    requiresPermission: false,
    showInNavbar: true,
    showInDashboard: true
  },
  {
    key: 'documents',
    name: 'Portal',
    description: 'Portal management and file sharing',
    icon: 'folder',
    route: '/documents',
    color: '#607D8B',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true
  },
  {
    key: 'support_tickets',
    name: 'Support Tickets',
    description: 'IT support and issue tracking',
    icon: 'support_agent',
    route: '/support-ticket',
    color: '#00BCD4',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true
  },
  {
    key: 'messaging',
    name: 'Messaging',
    description: 'Internal messaging and communication',
    icon: 'mail',
    route: '/messages',
    color: '#3F51B5',
    requiresPermission: true,
    showInNavbar: false, // Shown in toolbar instead
    showInDashboard: true
  },
  {
    key: 'calendar',
    name: 'Calendar',
    description: 'Meetings, events, and scheduling',
    icon: 'calendar_month',
    route: '/calendar',
    color: '#673AB7',
    requiresPermission: false, // Available to all authenticated users
    showInNavbar: true,
    showInDashboard: false
  },
  {
    key: 'finance',
    name: 'Finance',
    description: 'Budgets, expenses, purchase orders, and payments',
    icon: 'account_balance',
    route: '/finance',
    color: '#4CAF50',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true,
    subRoutes: [
      { path: '/finance', name: 'Dashboard', icon: 'dashboard' },
      { path: '/finance/creditors', name: 'Creditors', icon: 'call_made' },
      { path: '/finance/debtors', name: 'Debtors', icon: 'call_received' },
      { path: '/finance/budgets', name: 'Budgets', icon: 'account_balance_wallet' },
      { path: '/finance/expenses', name: 'Expenses', icon: 'receipt' },
      { path: '/finance/purchase-orders', name: 'Purchase Orders', icon: 'shopping_cart' },
      { path: '/finance/payments', name: 'Payments', icon: 'payment' },
      { path: '/finance/commitments', name: 'Monthly Commitments', icon: 'event_repeat' },
      { path: '/finance/categories', name: 'Categories', icon: 'category' }
    ]
  },
  {
    key: 'ai',
    name: 'AI Assistant',
    description: 'AI-powered help and knowledge base',
    icon: 'smart_toy',
    route: '/ai',
    color: '#FF5722',
    requiresPermission: true,
    showInNavbar: false,
    showInDashboard: false
  },
  {
    key: 'management',
    name: 'Management',
    description: 'Executive oversight: sales, tenders, logistics, finance, paperless approvals and payments',
    icon: 'insights',
    route: '/management',
    color: '#2563eb',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true
  },
  {
    key: 'settings',
    name: 'Settings',
    description: 'User preferences and system settings',
    icon: 'settings',
    route: '/settings',
    color: '#9E9E9E',
    requiresPermission: false,
    showInNavbar: false,
    showInDashboard: false
  }
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get module configuration by key
 */
export function getModule(key: ModuleKey): ModuleConfig | undefined {
  return MODULES.find(m => m.key === key);
}

/**
 * Get all modules that should appear in the navbar
 */
export function getNavbarModules(): ModuleConfig[] {
  return MODULES.filter(m => m.showInNavbar);
}

/**
 * Get all modules that should appear in the dashboard
 */
export function getDashboardModules(): ModuleConfig[] {
  return MODULES.filter(m => m.showInDashboard);
}

/**
 * Get modules that require permission
 */
export function getPermissionModules(): ModuleConfig[] {
  return MODULES.filter(m => m.requiresPermission);
}

// ============================================================================
// MODULE ROUTES - Lazy-loaded route definitions
// ============================================================================

/**
 * Get all module routes for the application
 * This consolidates route definitions with module metadata
 */
export function getModuleRoutes(): Routes {
  return [
    // Public routes
    { path: '', redirectTo: '/login', pathMatch: 'full' },
    { 
      path: 'login', 
      loadComponent: () => import('../components/login/login.component').then(m => m.LoginComponent) 
    },
    
    // Dashboard - Home
    { 
      path: 'dashboard', 
      loadComponent: () => import('../components/projects/projects.component').then(m => m.ProjectsComponent),
      canActivate: [authGuard] 
    },
    
    // Sales Module
    { 
      path: 'sales', 
      loadComponent: () => import('../components/sales/sales-dashboard.component').then(m => m.SalesDashboardComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'sales' } 
    },
    
    // Project Management Module
    { 
      path: 'departments', 
      loadComponent: () => import('../components/dashboard/dashboard.component').then(m => m.DashboardComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'project_management' } 
    },
    { 
      path: 'board/:id', 
      loadComponent: () => import('../components/board/board.component').then(m => m.BoardComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'project_management' } 
    },
    
    // Calendar (available to all)
    { 
      path: 'calendar', 
      loadComponent: () => import('../components/calendar/calendar.component').then(m => m.CalendarComponent),
      canActivate: [authGuard] 
    },
    { path: 'projects', redirectTo: '/dashboard', pathMatch: 'full' },

    // Asset Register (IT) — available to authenticated users
    { 
      path: 'asset-register', 
      loadComponent: () => import('../components/asset-register/asset-register.component').then(m => m.AssetRegisterComponent),
      canActivate: [authGuard] 
    },
    
    // Human Resource Module
    { 
      path: 'people', 
      loadComponent: () => import('../components/people/people.component').then(m => m.PeopleComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'human_resource' } 
    },
    
    // Stock Management Module
    { 
      path: 'stock-management', 
      loadComponent: () => import('../components/stock-management/stock-management.component').then(m => m.StockManagementComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'stock_management' } 
    },
    
    // Warehouse 3D View
    { 
      path: 'warehouse-3d', 
      loadComponent: () => import('../components/warehouse-3d/warehouse-3d.component').then(m => m.Warehouse3DComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'stock_management' } 
    },
    
    // Company Projects Module
    { 
      path: 'company-projects', 
      loadComponent: () => import('../components/company-projects/company-projects.component').then(m => m.CompanyProjectsComponent),
      canActivate: [authGuard] 
    },
    
    // Support Tickets Module
    { 
      path: 'support-ticket', 
      loadComponent: () => import('../components/support-ticket/support-ticket.component').then(m => m.SupportTicketComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'support_tickets' } 
    },
    
    // Documents Module
    { 
      path: 'documents', 
      loadComponent: () => import('../components/documents/documents.component').then(m => m.DocumentsComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'documents' } 
    },
    { 
      path: 'documents/shared', 
      loadComponent: () => import('../components/shared-with-me/shared-with-me.component').then(m => m.SharedWithMeComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'documents' } 
    },
    { 
      path: 'documents/:department', 
      loadComponent: () => import('../components/department-hub/department-hub.component').then(m => m.DepartmentHubComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'documents' } 
    },
    
    // Logistics — standalone Open Map page (opened in its own tab from the map dialog)
    {
      path: 'logistics/open-map',
      loadComponent: () => import('../components/logistics/open-map-page.component').then(m => m.OpenMapPageComponent),
      canActivate: [authGuard, moduleGuard],
      data: { module: 'logistics' }
    },

    // Logistics Module
    { 
      path: 'logistics/scan', 
      loadComponent: () => import('../components/logistics/asset-tracking.component').then(m => m.AssetTrackingComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'logistics' } 
    },
    { 
      path: 'logistics', 
      loadComponent: () => import('../components/logistics/logistics-dashboard.component').then(m => m.LogisticsDashboardComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'logistics' } 
    },

    // Tenders Module
    { 
      path: 'tenders', 
      loadComponent: () => import('../components/tenders/tenders.component').then(m => m.TendersComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'tenders' } 
    },
    
    // Finance Module
    { 
      path: 'finance', 
      loadComponent: () => import('../components/finance/finance.component').then(m => m.FinanceComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'finance' }
    },
    { 
      path: 'finance/creditors', 
      loadComponent: () => import('../components/finance/creditors/creditors.component').then(m => m.CreditorsComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'finance' }
    },
    { 
      path: 'finance/debtors', 
      loadComponent: () => import('../components/finance/debtors/debtors.component').then(m => m.DebtorsComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'finance' }
    },
    { 
      path: 'finance/budgets', 
      loadComponent: () => import('../components/finance/budgets/budgets.component').then(m => m.BudgetsComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'finance' }
    },
    { 
      path: 'finance/expenses', 
      loadComponent: () => import('../components/finance/expenses/expenses.component').then(m => m.ExpensesComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'finance' }
    },
    { 
      path: 'finance/purchase-orders', 
      loadComponent: () => import('../components/finance/purchase-orders/purchase-orders.component').then(m => m.PurchaseOrdersComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'finance' }
    },
    { 
      path: 'finance/payments', 
      loadComponent: () => import('../components/finance/payments/payments.component').then(m => m.PaymentsComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'finance' }
    },
    { 
      path: 'finance/categories', 
      loadComponent: () => import('../components/finance/categories/categories.component').then(m => m.CategoriesComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'finance' }
    },
    { 
      path: 'finance/commitments', 
      loadComponent: () => import('../components/finance/commitments/commitments.component').then(m => m.CommitmentsComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'finance' }
    },
    
    // Books - Paid Invoice Management (managers)
    { 
      path: 'books', 
      loadComponent: () => import('../components/books/books.component').then(m => m.BooksComponent),
      canActivate: [authGuard] 
    },
    
    // User Profile & Settings (available to all)
    { 
      path: 'profile', 
      loadComponent: () => import('../components/profile/profile.component').then(m => m.ProfileComponent),
      canActivate: [authGuard] 
    },
    { 
      path: 'user-management', 
      loadComponent: () => import('../components/user-management/user-management.component').then(m => m.UserManagementComponent),
      canActivate: [authGuard] 
    },
    
    // Messaging Module
    { 
      path: 'messages', 
      loadComponent: () => import('../components/messages/messages.component').then(m => m.MessagesComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'messaging' } 
    },

    // Email Viewer
    {
      path: 'emails',
      loadComponent: () => import('../components/email-viewer/email-viewer.component').then(m => m.EmailViewerComponent),
      canActivate: [authGuard]
    },

    // Archives (NAS PST email archives)
    {
      path: 'archives',
      loadComponent: () => import('../components/archives/archives.component').then(m => m.ArchivesComponent),
      canActivate: [authGuard]
    },
    
    // Settings
    { 
      path: 'settings', 
      loadComponent: () => import('../components/settings/settings.component').then(m => m.SettingsComponent),
      canActivate: [authGuard] 
    },
    
    // Management / Executive Oversight Module
    {
      path: 'management',
      loadComponent: () => import('../components/management/management.component').then(m => m.ManagementComponent),
      canActivate: [authGuard, moduleGuard],
      data: { module: 'management' }
    },

    // Collaborative Documents Module
    { 
      path: 'docs', 
      loadComponent: () => import('../components/collaborative-docs/collaborative-docs.component').then(m => m.CollaborativeDocsComponent),
      canActivate: [authGuard] 
    },
    { 
      path: 'docs/tools', 
      loadComponent: () => import('../components/collaborative-docs/pdf-tools/pdf-tools.component').then(m => m.PdfToolsComponent),
      canActivate: [authGuard] 
    },
    { 
      path: 'docs/:id', 
      loadComponent: () => import('../components/collaborative-docs/doc-editor/doc-editor.component').then(m => m.DocEditorComponent),
      canActivate: [authGuard] 
    },
    { 
      path: 'sheets/:id', 
      loadComponent: () => import('../components/collaborative-docs/sheet-editor/sheet-editor.component').then(m => m.SheetEditorComponent),
      canActivate: [authGuard] 
    },
    
    // 404 Page - must be last
    { 
      path: '404', 
      loadComponent: () => import('../components/not-found/not-found.component').then(m => m.NotFoundComponent) 
    },
    { 
      path: '**', 
      loadComponent: () => import('../components/not-found/not-found.component').then(m => m.NotFoundComponent) 
    }
  ];
}


