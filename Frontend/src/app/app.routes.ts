import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { BoardComponent } from './components/board/board.component';
import { ProjectsComponent } from './components/projects/projects.component';
import { PeopleComponent } from './components/people/people.component';
import { SupportTicketComponent } from './components/support-ticket/support-ticket.component';
import { DocumentsComponent } from './components/documents/documents.component';
import { DepartmentHubComponent } from './components/department-hub/department-hub.component';
import { StockManagementComponent } from './components/stock-management/stock-management.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { ProfileComponent } from './components/profile/profile.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { MessagesComponent } from './components/messages/messages.component';
import { SettingsComponent } from './components/settings/settings.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { ActiveCallsComponent } from './components/active-calls/active-calls.component';
import { LogisticsDashboardComponent } from './components/logistics/logistics-dashboard.component';
import { SalesDashboardComponent } from './components/sales/sales-dashboard.component';
import { authGuard, moduleGuard } from './guards/auth.guard';

// CRM Components
import { CrmDashboardComponent } from './components/crm/crm-dashboard.component';
import { CrmLeadsComponent } from './components/crm/crm-leads.component';
import { CrmLeadDetailComponent } from './components/crm/crm-lead-detail.component';
import { CrmLeadCreateComponent } from './components/crm/crm-lead-create.component';
import { CrmCampaignsComponent } from './components/crm/crm-campaigns.component';
import { CrmManagerConsoleComponent } from './components/crm/crm-manager-console.component';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: ProjectsComponent, canActivate: [authGuard] },
  
  // CRM Routes - requires 'crm' permission
  { path: 'crm', component: CrmDashboardComponent, canActivate: [authGuard, moduleGuard], data: { module: 'crm' } },
  { path: 'crm/leads', component: CrmLeadsComponent, canActivate: [authGuard, moduleGuard], data: { module: 'crm' } },
  { path: 'crm/leads/new', component: CrmLeadCreateComponent, canActivate: [authGuard, moduleGuard], data: { module: 'crm' } },
  { path: 'crm/leads/:id', component: CrmLeadDetailComponent, canActivate: [authGuard, moduleGuard], data: { module: 'crm' } },
  { path: 'crm/campaigns', component: CrmCampaignsComponent, canActivate: [authGuard, moduleGuard], data: { module: 'crm' } },
  { path: 'crm/manager', component: CrmManagerConsoleComponent, canActivate: [authGuard, moduleGuard], data: { module: 'crm' } },
  
  // Sales Routes - requires 'sales' permission
  { path: 'sales', component: SalesDashboardComponent, canActivate: [authGuard, moduleGuard], data: { module: 'sales' } },
  
  // Project Management - requires 'project_management' permission
  { path: 'departments', component: DashboardComponent, canActivate: [authGuard, moduleGuard], data: { module: 'project_management' } },
  { path: 'board/:id', component: BoardComponent, canActivate: [authGuard, moduleGuard], data: { module: 'project_management' } },
  
  // Calendar - available to all authenticated users
  { path: 'calendar', component: CalendarComponent, canActivate: [authGuard] },
  { path: 'projects', redirectTo: '/dashboard', pathMatch: 'full' },
  
  // Human Resource - requires 'human_resource' permission
  { path: 'people', component: PeopleComponent, canActivate: [authGuard, moduleGuard], data: { module: 'human_resource' } },
  
  // Stock Management - requires 'stock_management' permission
  { path: 'stock-management', component: StockManagementComponent, canActivate: [authGuard, moduleGuard], data: { module: 'stock_management' } },
  
  // Support Tickets - requires 'support_tickets' permission
  { path: 'support-ticket', component: SupportTicketComponent, canActivate: [authGuard, moduleGuard], data: { module: 'support_tickets' } },
  
  // Documents - requires 'documents' permission
  { path: 'documents', component: DocumentsComponent, canActivate: [authGuard, moduleGuard], data: { module: 'documents' } },
  { path: 'documents/:department', component: DepartmentHubComponent, canActivate: [authGuard, moduleGuard], data: { module: 'documents' } },
  
  // Logistics - requires 'logistics' permission
  { path: 'logistics', component: LogisticsDashboardComponent, canActivate: [authGuard, moduleGuard], data: { module: 'logistics' } },
  
  // Profile and Settings - available to all authenticated users
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'user-management', component: UserManagementComponent, canActivate: [authGuard] },
  
  // Messages - requires 'messaging' permission
  { path: 'messages', component: MessagesComponent, canActivate: [authGuard, moduleGuard], data: { module: 'messaging' } },
  
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'call-history', component: ActiveCallsComponent, canActivate: [authGuard] },
  { path: 'my-extension', component: ActiveCallsComponent, canActivate: [authGuard] },
  { path: 'call-center', component: ActiveCallsComponent, canActivate: [authGuard] },
  { path: 'pbx/active-calls', redirectTo: '/call-history', pathMatch: 'full' },
  
  // 404 Page - must be last
  { path: '404', component: NotFoundComponent },
  { path: '**', component: NotFoundComponent }
];


