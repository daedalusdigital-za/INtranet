import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { BoardComponent } from './components/board/board.component';
import { ProjectsComponent } from './components/projects/projects.component';
import { PeopleComponent } from './components/people/people.component';
import { SupportTicketComponent } from './components/support-ticket/support-ticket.component';
import { DocumentsComponent } from './components/documents/documents.component';
import { CrmComponent } from './components/crm/crm.component';
import { StockManagementComponent } from './components/stock-management/stock-management.component';
import { CalendarComponent } from './components/calendar/calendar.component';
import { ProfileComponent } from './components/profile/profile.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: ProjectsComponent, canActivate: [authGuard] },
  { path: 'crm', component: CrmComponent, canActivate: [authGuard] },
  { path: 'departments', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'calendar', component: CalendarComponent, canActivate: [authGuard] },
  { path: 'projects', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'people', component: PeopleComponent, canActivate: [authGuard] },
  { path: 'stock-management', component: StockManagementComponent, canActivate: [authGuard] },
  { path: 'support-ticket', component: SupportTicketComponent, canActivate: [authGuard] },
  { path: 'documents', component: DocumentsComponent, canActivate: [authGuard] },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'user-management', component: UserManagementComponent, canActivate: [authGuard] },
  { path: 'board/:id', component: BoardComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/login' }
];


