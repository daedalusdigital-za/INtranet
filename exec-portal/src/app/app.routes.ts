import { Routes } from '@angular/router';
import { signedInGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login').then(m => m.LoginPage) },
  { path: '', canActivate: [signedInGuard], loadComponent: () => import('./features/inbox').then(m => m.InboxPage) },
  { path: 'pack/:id', canActivate: [signedInGuard], loadComponent: () => import('./features/pack').then(m => m.PackPage) },
  { path: '**', redirectTo: '' }
];
