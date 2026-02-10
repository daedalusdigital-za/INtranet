import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse, User } from '../models/models';
import { environment } from '../../environments/environment';
import { MODULE_KEYS, ModuleKey, MODULES, getPermissionModules } from '../core/modules.config';

// Re-export module types for backward compatibility
export const MODULE_PERMISSIONS = MODULE_KEYS;
export type ModulePermission = ModuleKey;

// All modules list for admin UI - derived from centralized config
export const ALL_MODULES: { key: ModulePermission; name: string; icon: string }[] = 
  getPermissionModules().map(m => ({ key: m.key, name: m.name, icon: m.icon }));

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Load user from local storage on init
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.currentUserSubject.next(user);
      // Auto-refresh user data from server to get latest permissions
      this.refreshUserData(user.userId);
    }
  }

  /**
   * Refresh user data from server to get latest permissions
   * This ensures permission changes take effect without requiring logout
   */
  refreshUserData(userId: number): void {
    if (!this.getToken()) return;
    
    this.http.get<any>(`${this.apiUrl}/profile/${userId}`).pipe(
      catchError(() => of(null))
    ).subscribe(profile => {
      if (profile) {
        const currentUser = this.currentUserValue;
        if (currentUser) {
          // Update user with fresh data from server
          const updatedUser: User = {
            ...currentUser,
            permissions: profile.permissions,
            role: profile.role,
            name: profile.name,
            surname: profile.surname,
            title: profile.title,
            departmentId: profile.departmentId,
            departmentName: profile.departmentName,
            profilePictureUrl: profile.profilePictureUrl
          };
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
        }
      }
    });
  }

  get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  get isAuthenticated(): boolean {
    return !!this.getToken();
  }

  get isAdmin(): boolean {
    const role = this.currentUserValue?.role?.toLowerCase();
    return role === 'admin' || role === 'super admin';
  }

  get isManager(): boolean {
    return this.currentUserValue?.role === 'Manager' || this.isAdmin;
  }

  /**
   * Check if the current user has permission to access a specific module
   * Admins and Super Admins have access to all modules
   */
  hasModulePermission(module: ModulePermission): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // Admins have access to everything
    const role = user.role?.toLowerCase();
    if (role === 'admin' || role === 'super admin') {
      return true;
    }

    // Check if permissions string contains the module
    if (!user.permissions) return false;
    
    // Parse permissions - handle both JSON array format and comma-separated
    let permissions: string[] = [];
    try {
      // Try parsing as JSON array first (e.g., '["logistics","logistics.view"]')
      const parsed = JSON.parse(user.permissions);
      if (Array.isArray(parsed)) {
        permissions = parsed.map((p: string) => p.toLowerCase().trim());
      } else {
        permissions = user.permissions.toLowerCase().split(',').map(p => p.trim());
      }
    } catch {
      // Fallback to comma-separated format
      permissions = user.permissions.toLowerCase().split(',').map(p => p.trim());
    }
    
    return permissions.includes(module) || permissions.includes('all');
  }

  /**
   * Get all modules the current user has access to
   */
  getAccessibleModules(): ModulePermission[] {
    const user = this.currentUserValue;
    if (!user) return [];

    // Admins get all modules
    const role = user.role?.toLowerCase();
    if (role === 'admin' || role === 'super admin') {
      return Object.values(MODULE_PERMISSIONS);
    }

    if (!user.permissions) return [];
    
    // Parse permissions - handle both JSON array format and comma-separated
    let permissions: string[] = [];
    try {
      const parsed = JSON.parse(user.permissions);
      if (Array.isArray(parsed)) {
        permissions = parsed.map((p: string) => p.toLowerCase().trim());
      } else {
        permissions = user.permissions.toLowerCase().split(',').map(p => p.trim());
      }
    } catch {
      permissions = user.permissions.toLowerCase().split(',').map(p => p.trim());
    }
    
    if (permissions.includes('all')) {
      return Object.values(MODULE_PERMISSIONS);
    }

    return permissions.filter(p => 
      Object.values(MODULE_PERMISSIONS).includes(p as ModulePermission)
    ) as ModulePermission[];
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials)
      .pipe(
        tap(response => {
          localStorage.setItem('token', response.token);
          localStorage.setItem('currentUser', JSON.stringify(response.user));
          this.currentUserSubject.next(response.user);
        })
      );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }
}


