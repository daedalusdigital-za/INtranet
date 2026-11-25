import { Routes } from '@angular/router';
import { signedInGuard } from './core/auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login').then(m => m.LoginPage) },
  // "Sign" (waiting for you) stays the landing page so e-mail links and sign-in land where the work is.
  { path: '', canActivate: [signedInGuard], loadComponent: () => import('./features/inbox').then(m => m.InboxPage) },
  { path: 'pack/:id', canActivate: [signedInGuard], loadComponent: () => import('./features/pack').then(m => m.PackPage) },
  { path: 'quote/:id', canActivate: [signedInGuard], loadComponent: () => import('./features/quote').then(m => m.QuotePage) },
  { path: 'overview', canActivate: [signedInGuard], loadComponent: () => import('./features/overview').then(m => m.OverviewPage) },
  { path: 'payruns', canActivate: [signedInGuard], loadComponent: () => import('./features/payruns').then(m => m.PayrunsPage) },
  { path: 'history', canActivate: [signedInGuard], loadComponent: () => import('./features/history').then(m => m.HistoryPage) },
  { path: '**', redirectTo: '' }
];
