import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { LoginRequest, LoginResponse, User } from '../models/models';
import { environment } from '../../environments/environment';

// Module permission constants
export const MODULE_PERMISSIONS = {
  SALES: 'sales',
  CRM: 'crm',
  PROJECT_MANAGEMENT: 'project_management',
  HUMAN_RESOURCE: 'human_resource',
  STOCK_MANAGEMENT: 'stock_management',
  LOGISTICS: 'logistics',
  DOCUMENTS: 'documents',
  SUPPORT_TICKETS: 'support_tickets',
  MESSAGING: 'messaging',
  AI: 'ai'
} as const;

export type ModulePermission = typeof MODULE_PERMISSIONS[keyof typeof MODULE_PERMISSIONS];

// All modules list for admin UI
export const ALL_MODULES: { key: ModulePermission; name: string; icon: string }[] = [
  { key: 'sales', name: 'Sales', icon: 'point_of_sale' },
  { key: 'crm', name: 'CRM', icon: 'people_outline' },
  { key: 'project_management', name: 'Project Management', icon: 'business' },
  { key: 'human_resource', name: 'Human Resource', icon: 'people' },
  { key: 'stock_management', name: 'Stock Management', icon: 'inventory' },
  { key: 'logistics', name: 'Logistics', icon: 'local_shipping' },
  { key: 'documents', name: 'Documents', icon: 'folder' },
  { key: 'support_tickets', name: 'Support Tickets', icon: 'support_agent' },
  { key: 'messaging', name: 'Messaging', icon: 'mail' },
  { key: 'ai', name: 'AI Assistant', icon: 'smart_toy' }
];

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
      this.currentUserSubject.next(JSON.parse(storedUser));
    }
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
    
    const permissions = user.permissions.toLowerCase().split(',').map(p => p.trim());
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
    
    const permissions = user.permissions.toLowerCase().split(',').map(p => p.trim());
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


