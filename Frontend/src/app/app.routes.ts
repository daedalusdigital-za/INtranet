import { Routes } from '@angular/router';
import { getModuleRoutes } from './core/modules.config';

/**
 * Application Routes
 * 
 * All routes are defined in core/modules.config.ts for centralized management.
 * Each feature is treated as a module with:
 * - Lazy loading for optimal bundle splitting
 * - Permission-based access control via moduleGuard
 * - Consistent route structure
 * 
 * To add a new module:
 * 1. Add module configuration to core/modules.config.ts
 * 2. Create components in components/{module-name}/
 * 3. Add routes to getModuleRoutes() function
 */
export const routes: Routes = getModuleRoutes();


