import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { BoardComponent } from './components/board/board.component';
import { ProjectsComponent } from './components/projects/projects.component';
import { PeopleComponent } from './components/people/people.component';
import { SupportTicketComponent } from './components/support-ticket/support-ticket.component';
import { DocumentsComponent } from './components/documents/documents.component';
import { CrmComponent } from './components/crm/crm.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'dashboard', component: ProjectsComponent, canActivate: [authGuard] },
  { path: 'crm', component: CrmComponent, canActivate: [authGuard] },
  { path: 'departments', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'projects', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'people', component: PeopleComponent, canActivate: [authGuard] },
  { path: 'support-ticket', component: SupportTicketComponent, canActivate: [authGuard] },
  { path: 'documents', component: DocumentsComponent, canActivate: [authGuard] },
  { path: 'board/:id', component: BoardComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '/login' }
];
