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
import { authGuard } from './guards/auth.guard';

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
  
  // CRM Routes
  { path: 'crm', component: CrmDashboardComponent, canActivate: [authGuard] },
  { path: 'crm/leads', component: CrmLeadsComponent, canActivate: [authGuard] },
  { path: 'crm/leads/new', component: CrmLeadCreateComponent, canActivate: [authGuard] },
  { path: 'crm/leads/:id', component: CrmLeadDetailComponent, canActivate: [authGuard] },
  { path: 'crm/campaigns', component: CrmCampaignsComponent, canActivate: [authGuard] },
  { path: 'crm/manager', component: CrmManagerConsoleComponent, canActivate: [authGuard] },
  
  { path: 'departments', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'calendar', component: CalendarComponent, canActivate: [authGuard] },
  { path: 'projects', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'people', component: PeopleComponent, canActivate: [authGuard] },
  { path: 'stock-management', component: StockManagementComponent, canActivate: [authGuard] },
  { path: 'support-ticket', component: SupportTicketComponent, canActivate: [authGuard] },
  { path: 'documents', component: DocumentsComponent, canActivate: [authGuard] },
  { path: 'documents/:department', component: DepartmentHubComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'user-management', component: UserManagementComponent, canActivate: [authGuard] },
  { path: 'messages', component: MessagesComponent, canActivate: [authGuard] },
  { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
  { path: 'board/:id', component: BoardComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/login' }
];


