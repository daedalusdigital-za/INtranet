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
  CRM: 'crm',
  SALES: 'sales',
  LOGISTICS: 'logistics',
  PROJECT_MANAGEMENT: 'project_management',
  HUMAN_RESOURCE: 'human_resource',
  STOCK_MANAGEMENT: 'stock_management',
  DOCUMENTS: 'documents',
  SUPPORT_TICKETS: 'support_tickets',
  MESSAGING: 'messaging',
  AI: 'ai',
  PBX: 'pbx',
  CALENDAR: 'calendar',
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
    key: 'crm',
    name: 'CRM',
    description: 'Customer Relationship Management - Leads, Contacts, Campaigns',
    icon: 'people_outline',
    route: '/crm',
    color: '#4CAF50',
    requiresPermission: true,
    showInNavbar: true,
    showInDashboard: true,
    subRoutes: [
      { path: '/crm', name: 'Dashboard', icon: 'dashboard' },
      { path: '/crm/leads', name: 'Leads', icon: 'person_add' },
      { path: '/crm/campaigns', name: 'Campaigns', icon: 'campaign' },
      { path: '/crm/manager', name: 'Manager Console', icon: 'admin_panel_settings' }
    ]
  },
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
    key: 'documents',
    name: 'Documents',
    description: 'Document management and file sharing',
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
    key: 'pbx',
    name: 'Phone System',
    description: 'PBX integration, call history, and extensions',
    icon: 'phone',
    route: '/call-history',
    color: '#009688',
    requiresPermission: false, // Available to all authenticated users
    showInNavbar: false,
    showInDashboard: false
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
    
    // CRM Module
    ...getCrmRoutes(),
    
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
      path: 'documents/:department', 
      loadComponent: () => import('../components/department-hub/department-hub.component').then(m => m.DepartmentHubComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'documents' } 
    },
    
    // Logistics Module
    { 
      path: 'logistics', 
      loadComponent: () => import('../components/logistics/logistics-dashboard.component').then(m => m.LogisticsDashboardComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'logistics' } 
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
    
    // Settings
    { 
      path: 'settings', 
      loadComponent: () => import('../components/settings/settings.component').then(m => m.SettingsComponent),
      canActivate: [authGuard] 
    },
    
    // PBX / Phone System
    { 
      path: 'call-history', 
      loadComponent: () => import('../components/active-calls/active-calls.component').then(m => m.ActiveCallsComponent),
      canActivate: [authGuard] 
    },
    { 
      path: 'my-extension', 
      loadComponent: () => import('../components/active-calls/active-calls.component').then(m => m.ActiveCallsComponent),
      canActivate: [authGuard] 
    },
    { 
      path: 'call-center', 
      loadComponent: () => import('../components/active-calls/active-calls.component').then(m => m.ActiveCallsComponent),
      canActivate: [authGuard] 
    },
    { path: 'pbx/active-calls', redirectTo: '/call-history', pathMatch: 'full' },
    
    // Collaborative Documents Module
    { 
      path: 'docs', 
      loadComponent: () => import('../components/collaborative-docs/collaborative-docs.component').then(m => m.CollaborativeDocsComponent),
      canActivate: [authGuard] 
    },
    { 
      path: 'docs/:id', 
      loadComponent: () => import('../components/collaborative-docs/doc-editor/doc-editor.component').then(m => m.DocEditorComponent),
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

/**
 * CRM Module Routes
 */
function getCrmRoutes(): Routes {
  return [
    { 
      path: 'crm', 
      loadComponent: () => import('../components/crm/crm-dashboard.component').then(m => m.CrmDashboardComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'crm' } 
    },
    { 
      path: 'crm/leads', 
      loadComponent: () => import('../components/crm/crm-leads.component').then(m => m.CrmLeadsComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'crm' } 
    },
    { 
      path: 'crm/leads/new', 
      loadComponent: () => import('../components/crm/crm-lead-create.component').then(m => m.CrmLeadCreateComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'crm' } 
    },
    { 
      path: 'crm/leads/:id', 
      loadComponent: () => import('../components/crm/crm-lead-detail.component').then(m => m.CrmLeadDetailComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'crm' } 
    },
    { 
      path: 'crm/campaigns', 
      loadComponent: () => import('../components/crm/crm-campaigns.component').then(m => m.CrmCampaignsComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'crm' } 
    },
    { 
      path: 'crm/manager', 
      loadComponent: () => import('../components/crm/crm-manager-console.component').then(m => m.CrmManagerConsoleComponent),
      canActivate: [authGuard, moduleGuard], 
      data: { module: 'crm' } 
    }
  ];
}
