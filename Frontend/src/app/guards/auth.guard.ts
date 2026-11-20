import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ModuleKey } from '../core/modules.config';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

/**
 * Admin / Super Admin only. UI-level gate; the API must still enforce the role server-side.
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated) {
    return router.createUrlTree(['/login']);
  }

  if (authService.isAdmin) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

/**
 * Guard that checks if user has permission to access a specific module
 * Usage: { path: 'sales', component: SalesComponent, canActivate: [authGuard, moduleGuard], data: { module: 'sales' } }
 */
export const moduleGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // First check authentication
  if (!authService.isAuthenticated) {
    router.navigate(['/login']);
    return false;
  }

  // Get the required module from route data
  const requiredModule = route.data['module'] as ModuleKey;
  
  if (!requiredModule) {
    // No module specified, allow access
    return true;
  }

  // Check if user has permission
  if (authService.hasModulePermission(requiredModule)) {
    return true;
  }

  // Redirect to dashboard with message
  console.warn(`Access denied: User does not have permission for module '${requiredModule}'`);
  router.navigate(['/dashboard']);
  return false;
};

/** Executive section (Directors, Treasury). Accountants and clerks are sent back to Finance. */
export const executiveGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isAuthenticated) return router.createUrlTree(['/login']);
  if (authService.isExecutive) return true;
  return router.createUrlTree([authService.hasModulePermission('finance' as any) ? '/finance' : '/dashboard']);
};

/** Flows: everyone except accountants/clerks (unless the module was granted to them explicitly). */
export const flowsGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (!authService.isAuthenticated) return router.createUrlTree(['/login']);
  if (authService.canOpenFlows) return true;
  return router.createUrlTree(['/dashboard']);
};


