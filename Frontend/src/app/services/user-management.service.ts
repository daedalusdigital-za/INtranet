import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface User {
  userId: number;
  name: string;
  surname: string;
  email: string;
  role: string;
  title?: string;
  departmentId?: number;
  departmentName?: string;
  extensionNumber?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  permissions?: string[];
  hasProfilePicture: boolean;
  companyIds?: number[];
  linkedEmpId?: string;
  linkedEmployeeName?: string;
  birthday?: Date;
}

export interface CreateUserDto {
  name: string;
  surname: string;
  email: string;
  password: string;
  role?: string;
  title?: string;
  extensionNumber?: string;
  permissions?: string[];
  departmentId?: number;
  isActive?: boolean;
  companyIds?: number[];
  linkedEmpId?: string;
  birthday?: Date;
}

export interface UpdateUserDto {
  name?: string;
  surname?: string;
  email?: string;
  role?: string;
  title?: string;
  extensionNumber?: string;
  permissions?: string[];
  departmentId?: number;
  isActive?: boolean;
  companyIds?: number[];
  linkedEmpId?: string;
  birthday?: Date;
}

export interface Department {
  departmentId: number;
  name: string;
  managerName?: string;
}

export interface Permission {
  key: string;
  name: string;
  category: string;
}

export interface OperatingCompany {
  operatingCompanyId: number;
  name: string;
  code: string;
}

export interface ClockInEmployee {
  empId: string;
  name: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
  idNum?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserManagementService {
  private apiUrl = `${environment.apiUrl}/users`;
  private departmentsUrl = `${environment.apiUrl}/departments`;
  private usersSubject = new BehaviorSubject<User[]>([]);
  public users$ = this.usersSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // Get all users
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl, { headers: this.getHeaders() }).pipe(
      tap(users => this.usersSubject.next(users)),
      catchError(error => {
        console.error('Error fetching users:', error);
        return of([]);
      })
    );
  }

  // Get user by ID
  getUser(id: number): Observable<User | null> {
    return this.http.get<User>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      catchError(error => {
        console.error('Error fetching user:', error);
        return of(null);
      })
    );
  }

  // Create new user
  createUser(user: CreateUserDto): Observable<User | null> {
    return this.http.post<User>(this.apiUrl, user, { headers: this.getHeaders() }).pipe(
      tap(() => this.refreshUsers()),
      catchError(error => {
        console.error('Error creating user:', error);
        throw error;
      })
    );
  }

  // Update user
  updateUser(id: number, user: UpdateUserDto): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, user, { headers: this.getHeaders() }).pipe(
      tap(() => this.refreshUsers()),
      catchError(error => {
        console.error('Error updating user:', error);
        throw error;
      })
    );
  }

  // Delete user
  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
      tap(() => this.refreshUsers()),
      catchError(error => {
        console.error('Error deleting user:', error);
        throw error;
      })
    );
  }

  // Toggle user active status
  toggleUserStatus(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/toggle-active`, {}, { headers: this.getHeaders() }).pipe(
      tap(() => this.refreshUsers()),
      catchError(error => {
        console.error('Error toggling user status:', error);
        throw error;
      })
    );
  }

  // Reset password
  resetPassword(id: number, newPassword: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${id}/reset-password`, { newPassword }, { headers: this.getHeaders() }).pipe(
      catchError(error => {
        console.error('Error resetting password:', error);
        throw error;
      })
    );
  }

  // Get available roles
  getRoles(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/roles`, { headers: this.getHeaders() }).pipe(
      catchError(error => {
        console.error('Error fetching roles:', error);
        return of(['Admin', 'Manager', 'Employee', 'HR', 'IT Support']);
      })
    );
  }

  // Get available permissions
  getPermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.apiUrl}/permissions`, { headers: this.getHeaders() }).pipe(
      catchError(error => {
        console.error('Error fetching permissions:', error);
        return of([]);
      })
    );
  }

  // Get departments
  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(this.departmentsUrl, { headers: this.getHeaders() }).pipe(
      catchError(error => {
        console.error('Error fetching departments:', error);
        return of([]);
      })
    );
  }

  // Get operating companies
  getCompanies(): Observable<OperatingCompany[]> {
    return this.http.get<OperatingCompany[]>(`${environment.apiUrl}/crm/all-companies`, { headers: this.getHeaders() }).pipe(
      catchError(error => {
        console.error('Error fetching companies:', error);
        return of([]);
      })
    );
  }

  // Get clock-in employees for linking
  getClockInEmployees(): Observable<ClockInEmployee[]> {
    return this.http.get<ClockInEmployee[]>(`${this.apiUrl}/clockin-employees`, { headers: this.getHeaders() }).pipe(
      catchError(error => {
        console.error('Error fetching clock-in employees:', error);
        return of([]);
      })
    );
  }

  // Search users
  searchUsers(query: string, users: User[]): User[] {
    if (!query || !query.trim()) {
      return users;
    }
    const lowerQuery = query.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(lowerQuery) ||
      (user.surname && user.surname.toLowerCase().includes(lowerQuery)) ||
      user.email.toLowerCase().includes(lowerQuery) ||
      (user.departmentName && user.departmentName.toLowerCase().includes(lowerQuery)) ||
      user.role.toLowerCase().includes(lowerQuery)
    );
  }

  // Refresh users list
  refreshUsers(): void {
    this.getUsers().subscribe();
  }

  // Get role color for badges
  getRoleColor(role: string): string {
    const colors: { [key: string]: string } = {
      'Admin': '#f44336',
      'Super Admin': '#9c27b0',
      'Manager': '#2196f3',
      'HR': '#4caf50',
      'IT Support': '#ff9800',
      'Employee': '#607d8b'
    };
    return colors[role] || '#607d8b';
  }

  // Get role icon
  getRoleIcon(role: string): string {
    const icons: { [key: string]: string } = {
      'Admin': 'admin_panel_settings',
      'Super Admin': 'security',
      'Manager': 'supervisor_account',
      'HR': 'people',
      'IT Support': 'support_agent',
      'Employee': 'person'
    };
    return icons[role] || 'person';
  }
}
