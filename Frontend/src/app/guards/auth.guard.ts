import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService, ModulePermission } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
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
  const requiredModule = route.data['module'] as ModulePermission;
  
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


