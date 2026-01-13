import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NavbarComponent } from '../shared/navbar/navbar.component';

interface User {
  userId: number;
  name: string;
  surname: string;
  email: string;
  role: string;
  title?: string;
  departmentId?: number;
  departmentName?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  permissions?: string;
  hasProfilePicture: boolean;
  companyIds?: number[];
}

interface Department {
  departmentId: number;
  name: string;
}

interface OperatingCompany {
  operatingCompanyId: number;
  name: string;
  code: string;
}

interface Permission {
  key: string;
  name: string;
  category: string;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatDialogModule,
    MatSnackBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatBadgeModule,
    MatSlideToggleModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    
    <div class="user-management-container">
      <div class="page-header">
        <div class="header-content">
          <h1><mat-icon>people</mat-icon> User Management</h1>
          <p>Manage user accounts, roles, and permissions</p>
        </div>
        <button mat-raised-button color="primary" (click)="openCreateDialog()">
          <mat-icon>person_add</mat-icon>
          Add New User
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="stats-row">
        <mat-card class="stat-card">
          <div class="stat-icon total">
            <mat-icon>people</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ users.length }}</span>
            <span class="stat-label">Total Users</span>
          </div>
        </mat-card>
        <mat-card class="stat-card">
          <div class="stat-icon active">
            <mat-icon>check_circle</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ getActiveCount() }}</span>
            <span class="stat-label">Active Users</span>
          </div>
        </mat-card>
        <mat-card class="stat-card">
          <div class="stat-icon inactive">
            <mat-icon>block</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ getInactiveCount() }}</span>
            <span class="stat-label">Inactive Users</span>
          </div>
        </mat-card>
        <mat-card class="stat-card">
          <div class="stat-icon admin">
            <mat-icon>admin_panel_settings</mat-icon>
          </div>
          <div class="stat-content">
            <span class="stat-value">{{ getAdminCount() }}</span>
            <span class="stat-label">Administrators</span>
          </div>
        </mat-card>
      </div>

      <!-- Search and Filters -->
      <mat-card class="filters-card">
        <div class="filters-row">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search users</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="filterUsers()" placeholder="Name, email, or title...">
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select [(ngModel)]="filterRole" (selectionChange)="filterUsers()">
              <mat-option value="">All Roles</mat-option>
              @for (role of roles; track role) {
                <mat-option [value]="role">{{ role }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Department</mat-label>
            <mat-select [(ngModel)]="filterDepartment" (selectionChange)="filterUsers()">
              <mat-option value="">All Departments</mat-option>
              @for (dept of departments; track dept.departmentId) {
                <mat-option [value]="dept.departmentId">{{ dept.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="filterStatus" (selectionChange)="filterUsers()">
              <mat-option value="">All Status</mat-option>
              <mat-option value="active">Active</mat-option>
              <mat-option value="inactive">Inactive</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </mat-card>

      <!-- Users Table -->
      <mat-card class="users-table-card">
        @if (isLoading) {
          <div class="loading-container">
            <mat-spinner diameter="48"></mat-spinner>
            <p>Loading users...</p>
          </div>
        } @else {
          <div class="table-container">
            <table class="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (user of filteredUsers; track user.userId) {
                  <tr [class.inactive-row]="!user.isActive">
                    <td>
                      <div class="user-cell">
                        <div class="avatar" [class.has-picture]="user.hasProfilePicture">
                          {{ getInitials(user) }}
                        </div>
                        <div class="user-info">
                          <span class="user-name">{{ user.name }} {{ user.surname }}</span>
                          <span class="user-title">{{ user.title || 'No title' }}</span>
                        </div>
                      </div>
                    </td>
                    <td>{{ user.email }}</td>
                    <td>
                      <span class="role-chip" [class]="'role-' + user.role.toLowerCase().replace(' ', '-')">
                        {{ user.role }}
                      </span>
                    </td>
                    <td>{{ user.departmentName || 'Unassigned' }}</td>
                    <td>
                      <span class="status-chip" [class.active]="user.isActive" [class.inactive]="!user.isActive">
                        {{ user.isActive ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td>{{ formatDate(user.lastLoginAt) }}</td>
                    <td>
                      <div class="action-buttons">
                        <button mat-icon-button matTooltip="Edit User" (click)="openEditDialog(user)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button matTooltip="Reset Password" (click)="openResetPasswordDialog(user)">
                          <mat-icon>lock_reset</mat-icon>
                        </button>
                        <button mat-icon-button [matTooltip]="user.isActive ? 'Deactivate' : 'Activate'" 
                                (click)="toggleUserStatus(user)">
                          <mat-icon>{{ user.isActive ? 'block' : 'check_circle' }}</mat-icon>
                        </button>
                        <button mat-icon-button matTooltip="Delete User" color="warn" (click)="confirmDelete(user)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="empty-state">
                      <mat-icon>search_off</mat-icon>
                      <p>No users found matching your criteria</p>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </mat-card>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .user-management-container {
      padding: 80px 40px 40px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .header-content h1 {
      color: white;
      font-size: 2.5rem;
      font-weight: 600;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-content h1 mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }

    .header-content p {
      color: rgba(255, 255, 255, 0.8);
      margin: 8px 0 0 52px;
    }

    .page-header button {
      height: 48px;
      font-size: 16px;
      border-radius: 12px;
      padding: 0 24px;
    }

    /* Stats Row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-bottom: 24px;
    }

    .stat-card {
      display: flex;
      align-items: center;
      padding: 20px;
      border-radius: 16px;
      background: white;
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
    }

    .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .stat-icon.total { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .stat-icon.active { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .stat-icon.inactive { background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%); }
    .stat-icon.admin { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }

    .stat-content {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #1f2937;
    }

    .stat-label {
      font-size: 14px;
      color: #6b7280;
    }

    /* Filters Card */
    .filters-card {
      padding: 16px 24px;
      border-radius: 16px;
      margin-bottom: 24px;
    }

    .filters-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .search-field {
      flex: 1;
      min-width: 250px;
    }

    /* Users Table Card */
    .users-table-card {
      border-radius: 16px;
      overflow: hidden;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: #6b7280;
    }

    .loading-container p {
      margin-top: 16px;
    }

    .table-container {
      overflow-x: auto;
    }

    .users-table {
      width: 100%;
      border-collapse: collapse;
    }

    .users-table th {
      background: #f8fafc;
      padding: 16px;
      text-align: left;
      font-weight: 600;
      color: #374151;
      border-bottom: 2px solid #e5e7eb;
    }

    .users-table td {
      padding: 16px;
      border-bottom: 1px solid #f3f4f6;
    }

    .users-table tr:hover {
      background: #f8fafc;
    }

    .users-table tr.inactive-row {
      opacity: 0.6;
    }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 14px;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-weight: 600;
      color: #1f2937;
    }

    .user-title {
      font-size: 13px;
      color: #6b7280;
    }

    .role-chip {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .role-chip.role-admin {
      background: #fef3c7;
      color: #92400e;
    }

    .role-chip.role-manager {
      background: #dbeafe;
      color: #1e40af;
    }

    .role-chip.role-employee {
      background: #d1fae5;
      color: #065f46;
    }

    .role-chip.role-hr {
      background: #fce7f3;
      color: #9d174d;
    }

    .role-chip.role-it-support {
      background: #e0e7ff;
      color: #3730a3;
    }

    .status-chip {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .status-chip.active {
      background: #d1fae5;
      color: #065f46;
    }

    .status-chip.inactive {
      background: #fee2e2;
      color: #991b1b;
    }

    .action-buttons {
      display: flex;
      gap: 4px;
    }

    .action-buttons button {
      width: 36px;
      height: 36px;
    }

    .action-buttons mat-icon {
      font-size: 20px;
    }

    .empty-state {
      text-align: center;
      padding: 60px !important;
      color: #9ca3af;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    @media (max-width: 1200px) {
      .stats-row {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .user-management-container {
        padding: 80px 16px 16px;
      }

      .stats-row {
        grid-template-columns: 1fr;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }
    }
  `]
})
export class UserManagementComponent implements OnInit {
  users: User[] = [];
  filteredUsers: User[] = [];
  departments: Department[] = [];
  companies: OperatingCompany[] = [];
  roles: string[] = [];
  permissions: Permission[] = [];

  searchTerm = '';
  filterRole = '';
  filterDepartment: number | string = '';
  filterStatus = '';
  isLoading = false;

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadDepartments();
    this.loadCompanies();
    this.loadRoles();
    this.loadPermissions();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  loadUsers(): void {
    this.isLoading = true;
    this.http.get<User[]>('/api/users', { headers: this.getHeaders() })
      .subscribe({
        next: (users) => {
          this.users = users;
          this.filterUsers();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading users:', err);
          this.snackBar.open('Failed to load users', 'Close', { duration: 3000 });
          this.isLoading = false;
        }
      });
  }

  loadDepartments(): void {
    this.http.get<Department[]>('/api/departments', { headers: this.getHeaders() })
      .subscribe({
        next: (departments) => this.departments = departments,
        error: (err) => console.error('Error loading departments:', err)
      });
  }

  loadCompanies(): void {
    this.http.get<OperatingCompany[]>('/api/crm/all-companies', { headers: this.getHeaders() })
      .subscribe({
        next: (companies) => this.companies = companies,
        error: (err) => console.error('Error loading companies:', err)
      });
  }

  loadRoles(): void {
    this.http.get<string[]>('/api/users/roles', { headers: this.getHeaders() })
      .subscribe({
        next: (roles) => this.roles = roles,
        error: (err) => console.error('Error loading roles:', err)
      });
  }

  loadPermissions(): void {
    this.http.get<Permission[]>('/api/users/permissions', { headers: this.getHeaders() })
      .subscribe({
        next: (permissions) => this.permissions = permissions,
        error: (err) => console.error('Error loading permissions:', err)
      });
  }

  filterUsers(): void {
    let filtered = [...this.users];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.name.toLowerCase().includes(term) ||
        u.surname.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        (u.title && u.title.toLowerCase().includes(term))
      );
    }

    if (this.filterRole) {
      filtered = filtered.filter(u => u.role === this.filterRole);
    }

    if (this.filterDepartment) {
      filtered = filtered.filter(u => u.departmentId === this.filterDepartment);
    }

    if (this.filterStatus) {
      filtered = filtered.filter(u => 
        this.filterStatus === 'active' ? u.isActive : !u.isActive
      );
    }

    this.filteredUsers = filtered;
  }

  getActiveCount(): number {
    return this.users.filter(u => u.isActive).length;
  }

  getInactiveCount(): number {
    return this.users.filter(u => !u.isActive).length;
  }

  getAdminCount(): number {
    return this.users.filter(u => u.role === 'Admin').length;
  }

  getInitials(user: User): string {
    return `${user.name.charAt(0)}${user.surname.charAt(0)}`.toUpperCase();
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(UserFormDialogComponent, {
      width: '600px',
      data: { 
        mode: 'create',
        departments: this.departments,
        companies: this.companies,
        roles: this.roles,
        permissions: this.permissions
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.http.post('/api/users', result, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.snackBar.open('User created successfully', 'Close', { duration: 3000 });
              this.loadUsers();
            },
            error: (err) => {
              this.snackBar.open(err.error?.message || 'Failed to create user', 'Close', { duration: 3000 });
            }
          });
      }
    });
  }

  openEditDialog(user: User): void {
    const dialogRef = this.dialog.open(UserFormDialogComponent, {
      width: '600px',
      data: { 
        mode: 'edit',
        user,
        departments: this.departments,
        companies: this.companies,
        roles: this.roles,
        permissions: this.permissions
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.http.put(`/api/users/${user.userId}`, result, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.snackBar.open('User updated successfully', 'Close', { duration: 3000 });
              this.loadUsers();
            },
            error: (err) => {
              this.snackBar.open(err.error?.message || 'Failed to update user', 'Close', { duration: 3000 });
            }
          });
      }
    });
  }

  openResetPasswordDialog(user: User): void {
    const dialogRef = this.dialog.open(ResetPasswordDialogComponent, {
      width: '400px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.http.post(`/api/users/${user.userId}/reset-password`, { newPassword: result }, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.snackBar.open('Password reset successfully', 'Close', { duration: 3000 });
            },
            error: (err) => {
              this.snackBar.open(err.error?.message || 'Failed to reset password', 'Close', { duration: 3000 });
            }
          });
      }
    });
  }

  toggleUserStatus(user: User): void {
    this.http.post(`/api/users/${user.userId}/toggle-active`, {}, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.snackBar.open(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`, 'Close', { duration: 3000 });
          this.loadUsers();
        },
        error: (err) => {
          this.snackBar.open(err.error?.message || 'Failed to toggle user status', 'Close', { duration: 3000 });
        }
      });
  }

  confirmDelete(user: User): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.http.delete(`/api/users/${user.userId}`, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.snackBar.open('User deleted successfully', 'Close', { duration: 3000 });
              this.loadUsers();
            },
            error: (err) => {
              this.snackBar.open(err.error?.message || 'Failed to delete user', 'Close', { duration: 3000 });
            }
          });
      }
    });
  }
}

// User Form Dialog Component
@Component({
  selector: 'user-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data.mode === 'create' ? 'person_add' : 'edit' }}</mat-icon>
      {{ data.mode === 'create' ? 'Create New User' : 'Edit User' }}
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>First Name</mat-label>
            <input matInput formControlName="name" required>
            @if (form.get('name')?.hasError('required')) {
              <mat-error>First name is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Last Name</mat-label>
            <input matInput formControlName="surname" required>
            @if (form.get('surname')?.hasError('required')) {
              <mat-error>Last name is required</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Email</mat-label>
          <input matInput formControlName="email" type="email" required>
          @if (form.get('email')?.hasError('required')) {
            <mat-error>Email is required</mat-error>
          }
          @if (form.get('email')?.hasError('email')) {
            <mat-error>Invalid email format</mat-error>
          }
        </mat-form-field>

        @if (data.mode === 'create') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Password</mat-label>
            <input matInput formControlName="password" type="password" required>
            @if (form.get('password')?.hasError('required')) {
              <mat-error>Password is required</mat-error>
            }
            @if (form.get('password')?.hasError('minlength')) {
              <mat-error>Password must be at least 8 characters</mat-error>
            }
          </mat-form-field>
        }

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select formControlName="role" required>
              @for (role of data.roles; track role) {
                <mat-option [value]="role">{{ role }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Department</mat-label>
            <mat-select formControlName="departmentId">
              <mat-option [value]="null">No Department</mat-option>
              @for (dept of data.departments; track dept.departmentId) {
                <mat-option [value]="dept.departmentId">{{ dept.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Job Title</mat-label>
          <input matInput formControlName="title" placeholder="e.g., Software Engineer">
        </mat-form-field>

        <div class="companies-section">
          <h4>Company Assignments</h4>
          <p class="section-hint">Select which companies this user works for</p>
          <div class="companies-grid">
            @for (company of data.companies; track company.operatingCompanyId) {
              <mat-checkbox 
                [checked]="hasCompany(company.operatingCompanyId)"
                (change)="toggleCompany(company.operatingCompanyId, $event.checked)">
                {{ company.name }}
              </mat-checkbox>
            }
          </div>
        </div>

        <div class="permissions-section">
          <h4>Permissions</h4>
          <div class="permissions-grid">
            @for (category of getPermissionCategories(); track category) {
              <div class="permission-category">
                <h5>{{ category }}</h5>
                @for (perm of getPermissionsByCategory(category); track perm.key) {
                  <mat-checkbox 
                    [checked]="hasPermission(perm.key)"
                    (change)="togglePermission(perm.key, $event.checked)">
                    {{ perm.name }}
                  </mat-checkbox>
                }
              </div>
            }
          </div>
        </div>

        <div class="status-toggle">
          <mat-slide-toggle formControlName="isActive">
            User is Active
          </mat-slide-toggle>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="submit()">
        {{ data.mode === 'create' ? 'Create User' : 'Save Changes' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 500px;
      max-height: 70vh;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #1e3a5f;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row mat-form-field {
      flex: 1;
    }

    .full-width {
      width: 100%;
    }

    mat-form-field {
      margin-bottom: 8px;
    }

    .companies-section {
      margin: 16px 0;
      padding: 16px;
      background: #e8f5e9;
      border-radius: 8px;
      border: 1px solid #c8e6c9;
    }

    .companies-section h4 {
      margin: 0 0 4px 0;
      color: #2e7d32;
    }

    .section-hint {
      margin: 0 0 12px 0;
      font-size: 12px;
      color: #666;
    }

    .companies-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }

    .companies-grid mat-checkbox {
      display: block;
    }

    .permissions-section {
      margin: 16px 0;
      padding: 16px;
      background: #f8fafc;
      border-radius: 8px;
    }

    .permissions-section h4 {
      margin: 0 0 12px 0;
      color: #374151;
    }

    .permissions-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .permission-category h5 {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #6b7280;
      text-transform: uppercase;
    }

    .permission-category mat-checkbox {
      display: block;
      margin-bottom: 4px;
    }

    .status-toggle {
      margin-top: 16px;
    }
  `]
})
export class UserFormDialogComponent {
  form: FormGroup;
  selectedPermissions: string[] = [];
  selectedCompanies: number[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<UserFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    const user = data.user;
    this.selectedPermissions = user?.permissions ? user.permissions.split(',') : [];
    this.selectedCompanies = user?.companyIds || [];

    this.form = this.fb.group({
      name: [user?.name || '', Validators.required],
      surname: [user?.surname || '', Validators.required],
      email: [user?.email || '', [Validators.required, Validators.email]],
      password: [data.mode === 'create' ? '' : null, data.mode === 'create' ? [Validators.required, Validators.minLength(8)] : []],
      role: [user?.role || 'Employee', Validators.required],
      departmentId: [user?.departmentId || null],
      title: [user?.title || ''],
      isActive: [user?.isActive ?? true]
    });
  }

  getPermissionCategories(): string[] {
    const categories = this.data.permissions.map((p: Permission) => p.category);
    return [...new Set<string>(categories)];
  }

  getPermissionsByCategory(category: string): Permission[] {
    return this.data.permissions.filter((p: Permission) => p.category === category);
  }

  hasPermission(key: string): boolean {
    return this.selectedPermissions.includes(key);
  }

  togglePermission(key: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedPermissions.includes(key)) {
        this.selectedPermissions.push(key);
      }
    } else {
      this.selectedPermissions = this.selectedPermissions.filter(p => p !== key);
    }
  }

  hasCompany(companyId: number): boolean {
    return this.selectedCompanies.includes(companyId);
  }

  toggleCompany(companyId: number, checked: boolean): void {
    if (checked) {
      if (!this.selectedCompanies.includes(companyId)) {
        this.selectedCompanies.push(companyId);
      }
    } else {
      this.selectedCompanies = this.selectedCompanies.filter(id => id !== companyId);
    }
  }

  submit(): void {
    if (this.form.valid) {
      const formData = { ...this.form.value };
      formData.permissions = this.selectedPermissions.join(',');
      formData.companyIds = this.selectedCompanies;
      
      // Remove password field if editing
      if (this.data.mode === 'edit') {
        delete formData.password;
      }

      this.dialogRef.close(formData);
    }
  }
}

// Reset Password Dialog Component
@Component({
  selector: 'reset-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>lock_reset</mat-icon>
      Reset Password
    </h2>
    <mat-dialog-content>
      <p>Reset password for <strong>{{ data.user.name }} {{ data.user.surname }}</strong></p>
      
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>New Password</mat-label>
        <input matInput [(ngModel)]="newPassword" type="password" required>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Confirm Password</mat-label>
        <input matInput [(ngModel)]="confirmPassword" type="password" required>
        @if (confirmPassword && newPassword !== confirmPassword) {
          <mat-error>Passwords do not match</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" 
              [disabled]="!newPassword || newPassword.length < 8 || newPassword !== confirmPassword"
              (click)="submit()">
        Reset Password
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 350px;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #1e3a5f;
    }

    .full-width {
      width: 100%;
    }

    p {
      margin-bottom: 16px;
      color: #6b7280;
    }
  `]
})
export class ResetPasswordDialogComponent {
  newPassword = '';
  confirmPassword = '';

  constructor(
    private dialogRef: MatDialogRef<ResetPasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  submit(): void {
    if (this.newPassword && this.newPassword === this.confirmPassword) {
      this.dialogRef.close(this.newPassword);
    }
  }
}

// Confirm Delete Dialog Component
@Component({
  selector: 'confirm-delete-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="warn">warning</mat-icon>
      Confirm Delete
    </h2>
    <mat-dialog-content>
      <p>Are you sure you want to delete <strong>{{ data.user.name }} {{ data.user.surname }}</strong>?</p>
      <p class="warning-text">This action cannot be undone. All user data will be permanently removed.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">
        Delete User
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 350px;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .warning-text {
      color: #dc2626;
      font-size: 13px;
    }
  `]
})
export class ConfirmDeleteDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}
