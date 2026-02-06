import { Routes } from '@angular/router';
import { authGuard, moduleGuard } from './guards/auth.guard';

// Lazy-loaded routes for optimal bundle splitting
export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { 
    path: 'login', 
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) 
  },
  { 
    path: 'dashboard', 
    loadComponent: () => import('./components/projects/projects.component').then(m => m.ProjectsComponent),
    canActivate: [authGuard] 
  },
  
  // CRM Routes - requires 'crm' permission
  { 
    path: 'crm', 
    loadComponent: () => import('./components/crm/crm-dashboard.component').then(m => m.CrmDashboardComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'crm' } 
  },
  { 
    path: 'crm/leads', 
    loadComponent: () => import('./components/crm/crm-leads.component').then(m => m.CrmLeadsComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'crm' } 
  },
  { 
    path: 'crm/leads/new', 
    loadComponent: () => import('./components/crm/crm-lead-create.component').then(m => m.CrmLeadCreateComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'crm' } 
  },
  { 
    path: 'crm/leads/:id', 
    loadComponent: () => import('./components/crm/crm-lead-detail.component').then(m => m.CrmLeadDetailComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'crm' } 
  },
  { 
    path: 'crm/campaigns', 
    loadComponent: () => import('./components/crm/crm-campaigns.component').then(m => m.CrmCampaignsComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'crm' } 
  },
  { 
    path: 'crm/manager', 
    loadComponent: () => import('./components/crm/crm-manager-console.component').then(m => m.CrmManagerConsoleComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'crm' } 
  },
  
  // Sales Routes - requires 'sales' permission
  { 
    path: 'sales', 
    loadComponent: () => import('./components/sales/sales-dashboard.component').then(m => m.SalesDashboardComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'sales' } 
  },
  
  // Project Management - requires 'project_management' permission
  { 
    path: 'departments', 
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'project_management' } 
  },
  { 
    path: 'board/:id', 
    loadComponent: () => import('./components/board/board.component').then(m => m.BoardComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'project_management' } 
  },
  
  // Calendar - available to all authenticated users
  { 
    path: 'calendar', 
    loadComponent: () => import('./components/calendar/calendar.component').then(m => m.CalendarComponent),
    canActivate: [authGuard] 
  },
  { path: 'projects', redirectTo: '/dashboard', pathMatch: 'full' },
  
  // Human Resource - requires 'human_resource' permission
  { 
    path: 'people', 
    loadComponent: () => import('./components/people/people.component').then(m => m.PeopleComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'human_resource' } 
  },
  
  // Stock Management - requires 'stock_management' permission
  { 
    path: 'stock-management', 
    loadComponent: () => import('./components/stock-management/stock-management.component').then(m => m.StockManagementComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'stock_management' } 
  },
  
  // Support Tickets - requires 'support_tickets' permission
  { 
    path: 'support-ticket', 
    loadComponent: () => import('./components/support-ticket/support-ticket.component').then(m => m.SupportTicketComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'support_tickets' } 
  },
  
  // Documents - requires 'documents' permission
  { 
    path: 'documents', 
    loadComponent: () => import('./components/documents/documents.component').then(m => m.DocumentsComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'documents' } 
  },
  { 
    path: 'documents/:department', 
    loadComponent: () => import('./components/department-hub/department-hub.component').then(m => m.DepartmentHubComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'documents' } 
  },
  
  // Logistics - requires 'logistics' permission
  { 
    path: 'logistics', 
    loadComponent: () => import('./components/logistics/logistics-dashboard.component').then(m => m.LogisticsDashboardComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'logistics' } 
  },
  
  // Profile and Settings - available to all authenticated users
  { 
    path: 'profile', 
    loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'user-management', 
    loadComponent: () => import('./components/user-management/user-management.component').then(m => m.UserManagementComponent),
    canActivate: [authGuard] 
  },
  
  // Messages - requires 'messaging' permission
  { 
    path: 'messages', 
    loadComponent: () => import('./components/messages/messages.component').then(m => m.MessagesComponent),
    canActivate: [authGuard, moduleGuard], 
    data: { module: 'messaging' } 
  },
  
  { 
    path: 'settings', 
    loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'call-history', 
    loadComponent: () => import('./components/active-calls/active-calls.component').then(m => m.ActiveCallsComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'my-extension', 
    loadComponent: () => import('./components/active-calls/active-calls.component').then(m => m.ActiveCallsComponent),
    canActivate: [authGuard] 
  },
  { 
    path: 'call-center', 
    loadComponent: () => import('./components/active-calls/active-calls.component').then(m => m.ActiveCallsComponent),
    canActivate: [authGuard] 
  },
  { path: 'pbx/active-calls', redirectTo: '/call-history', pathMatch: 'full' },
  
  // 404 Page - must be last
  { 
    path: '404', 
    loadComponent: () => import('./components/not-found/not-found.component').then(m => m.NotFoundComponent) 
  },
  { 
    path: '**', 
    loadComponent: () => import('./components/not-found/not-found.component').then(m => m.NotFoundComponent) 
  }
];


