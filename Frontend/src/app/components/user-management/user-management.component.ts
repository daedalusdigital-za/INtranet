import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environment';
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
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { StatusChipComponent } from '../../ui/status-chip/status-chip.component';
import { ToastService } from '../../ui/toast.service';
import { ConfirmService } from '../../ui/confirm.service';

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
  linkedEmpId?: string;
  linkedEmployeeName?: string;
  birthday?: Date;
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

interface ClockInEmployee {
  empId: string;
  name: string;
  lastName: string;
  department?: string;
  jobTitle?: string;
  idNum?: string;
  hasPhoto?: boolean;
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
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatMenuModule,
    MatBadgeModule,
    MatSlideToggleModule,
    NavbarComponent,
    SkeletonRowsComponent,
    EmptyStateComponent,
    StatusChipComponent
  ],
  template: `
    <app-navbar></app-navbar>
    
    <div class="user-management-container">
      <div class="page-header">
        <div class="header-content">
          <h1><mat-icon>people</mat-icon> User Management</h1>
          <p>Manage user accounts, roles, and permissions</p>
        </div>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
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
          <app-skeleton-rows [rows]="6"></app-skeleton-rows>
        } @else {
          <div class="table-container">
            <table class="app-table users-table">
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
                          <span class="user-name">
                            {{ user.name }} {{ user.surname }}
                            @if (user.linkedEmpId) {
                              <mat-icon class="clockin-linked-icon" matTooltip="Linked to clock-in: {{ user.linkedEmployeeName }}">fingerprint</mat-icon>
                            }
                          </span>
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
                      <app-status-chip [status]="user.isActive ? 'Active' : 'Inactive'" [tone]="user.isActive ? 'ok' : 'danger'"></app-status-chip>
                    </td>
                    <td>{{ formatDate(user.lastLoginAt) }}</td>
                    <td>
                      <div class="action-buttons">
                        <button aria-label="Edit User" mat-icon-button matTooltip="Edit User" (click)="openEditDialog(user)">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button aria-label="Reset Password" mat-icon-button matTooltip="Reset Password" (click)="openResetPasswordDialog(user)">
                          <mat-icon>lock_reset</mat-icon>
                        </button>
                        <button [attr.aria-label]="user.isActive ? 'Deactivate' : 'Activate'" mat-icon-button [matTooltip]="user.isActive ? 'Deactivate' : 'Activate'" 
                                (click)="toggleUserStatus(user)">
                          <mat-icon>{{ user.isActive ? 'block' : 'check_circle' }}</mat-icon>
                        </button>
                        <button aria-label="Delete User" mat-icon-button matTooltip="Delete User" color="warn" (click)="confirmDelete(user)">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7">
                      @if (users.length) {
                        <app-empty-state icon="filter_alt_off" title="No users match these filters"
                          message="Try another search, or clear the filters to see every user.">
                          <button mat-stroked-button (click)="clearFilters()">Clear the filters</button>
                        </app-empty-state>
                      } @else {
                        <app-empty-state icon="people" title="No user accounts yet"
                          message="Add a user to give them access to the intranet.">
                          <button mat-flat-button color="primary" (click)="openCreateDialog()">Add New User</button>
                        </app-empty-state>
                      }
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
      position: relative;
      background: var(--color-canvas);
      overflow-x: hidden;
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
      color: var(--color-text);
      font-size: var(--text-3xl);
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-content h1 mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--color-primary);
    }

    .header-content p {
      color: var(--color-text-3);
      font-size: var(--text-sm);
      margin: 4px 0 0 40px;
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
      border-radius: var(--radius-lg);
      background: var(--color-surface);
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
    }

    .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .stat-icon.total { background: var(--color-primary-soft); color: var(--color-primary); }
    .stat-icon.active { background: var(--color-ok-soft); color: var(--color-ok); }
    .stat-icon.inactive { background: var(--color-danger-soft); color: var(--color-danger); }
    .stat-icon.admin { background: var(--color-cat-purple-soft); color: var(--color-cat-purple); }

    .stat-content {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: var(--text-3xl);
      font-weight: 700;
      color: var(--color-text);
    }

    .stat-label {
      font-size: var(--text-md);
      color: var(--color-text-3);
    }

    /* Filters Card */
    .filters-card {
      padding: 16px 24px;
      border-radius: var(--radius-lg);
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
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    .table-container {
      overflow-x: auto;
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
      background: var(--color-primary-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-primary);
      font-weight: 600;
      font-size: var(--text-md);
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-weight: 600;
      color: var(--color-text);
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .clockin-linked-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-warn);
    }

    .user-title {
      font-size: var(--text-sm);
      color: var(--color-text-3);
    }

    .role-chip {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: var(--text-xs);
      font-weight: 600;
      background: var(--color-surface-2);
      color: var(--color-text-2);
    }

    .role-chip.role-admin {
      background: var(--color-cat-amber-soft);
      color: var(--color-cat-amber);
    }

    .role-chip.role-manager {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .role-chip.role-employee {
      background: var(--color-cat-teal-soft);
      color: var(--color-cat-teal);
    }

    .role-chip.role-hr {
      background: var(--color-cat-pink-soft);
      color: var(--color-cat-pink);
    }

    .role-chip.role-it-support {
      background: var(--color-cat-purple-soft);
      color: var(--color-cat-purple);
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
  clockInEmployees: ClockInEmployee[] = [];
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
    private toast: ToastService,
    private confirm: ConfirmService
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.loadDepartments();
    this.loadCompanies();
    this.loadClockInEmployees();
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
    this.http.get<User[]>(`${environment.apiUrl}/users`, { headers: this.getHeaders() })
      .subscribe({
        next: (users) => {
          this.users = users;
          this.filterUsers();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading users:', err);
          this.toast.error('Failed to load users');
          this.isLoading = false;
        }
      });
  }

  loadDepartments(): void {
    this.http.get<Department[]>(`${environment.apiUrl}/departments`, { headers: this.getHeaders() })
      .subscribe({
        next: (departments) => this.departments = departments,
        error: (err) => console.error('Error loading departments:', err)
      });
  }

  loadCompanies(): void {
    this.http.get<OperatingCompany[]>(`${environment.apiUrl}/companies/all`, { headers: this.getHeaders() })
      .subscribe({
        next: (companies) => this.companies = companies,
        error: (err) => console.error('Error loading companies:', err)
      });
  }

  loadClockInEmployees(): void {
    this.http.get<ClockInEmployee[]>(`${environment.apiUrl}/users/clockin-employees`, { headers: this.getHeaders() })
      .subscribe({
        next: (employees) => this.clockInEmployees = employees,
        error: (err) => console.error('Error loading clock-in employees:', err)
      });
  }

  loadRoles(): void {
    this.http.get<string[]>(`${environment.apiUrl}/users/roles`, { headers: this.getHeaders() })
      .subscribe({
        next: (roles) => this.roles = roles,
        error: (err) => console.error('Error loading roles:', err)
      });
  }

  loadPermissions(): void {
    this.http.get<Permission[]>(`${environment.apiUrl}/users/permissions`, { headers: this.getHeaders() })
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

  clearFilters(): void {
    this.searchTerm = '';
    this.filterRole = '';
    this.filterDepartment = '';
    this.filterStatus = '';
    this.filterUsers();
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
        clockInEmployees: this.clockInEmployees,
        roles: this.roles,
        permissions: this.permissions
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.http.post(`${environment.apiUrl}/users`, result, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.toast.done('User created successfully');
              this.loadUsers();
            },
            error: (err) => {
              this.toast.error(err.error?.message || 'Failed to create user');
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
        clockInEmployees: this.clockInEmployees,
        roles: this.roles,
        permissions: this.permissions
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.http.put(`${environment.apiUrl}/users/${user.userId}`, result, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.toast.done('User updated successfully');
              this.loadUsers();
            },
            error: (err) => {
              this.toast.error(err.error?.message || 'Failed to update user');
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
        this.http.post(`${environment.apiUrl}/users/${user.userId}/reset-password`, { newPassword: result }, { headers: this.getHeaders() })
          .subscribe({
            next: () => {
              this.toast.done('Password reset successfully');
            },
            error: (err) => {
              this.toast.error(err.error?.message || 'Failed to reset password');
            }
          });
      }
    });
  }

  toggleUserStatus(user: User): void {
    this.http.post(`${environment.apiUrl}/users/${user.userId}/toggle-active`, {}, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.toast.done(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`);
          this.loadUsers();
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Failed to toggle user status');
        }
      });
  }

  async confirmDelete(user: User): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Delete ${user.name} ${user.surname}?`,
      message: 'This action cannot be undone. All user data will be permanently removed.',
      confirmText: 'Delete user',
      danger: true
    });
    if (!ok) return;
    this.http.delete(`${environment.apiUrl}/users/${user.userId}`, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.toast.done('User deleted successfully');
          this.loadUsers();
        },
        error: (err) => {
          this.toast.error(err.error?.message || 'Failed to delete user');
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
        @if (data.mode === 'edit') {
          <div class="avatar-section">
            <div class="avatar-preview">
              @if (avatarPreview || data.user?.hasProfilePicture) {
                <img [src]="avatarPreview || userPhotoUrl()" alt="Profile picture" />
              } @else {
                <mat-icon>account_circle</mat-icon>
              }
            </div>
            <div class="avatar-actions">
              <span class="avatar-title">Profile Picture</span>
              <span class="section-hint">Upload a photo (JPEG, PNG, GIF or WebP, max 5MB)</span>
              <div class="avatar-buttons">
                <button mat-stroked-button type="button" color="primary"
                        [disabled]="uploadingAvatar" (click)="avatarInput.click()">
                  <mat-icon>upload</mat-icon>
                  {{ uploadingAvatar ? 'Uploading…' : 'Upload / Change' }}
                </button>
                @if (data.user?.hasProfilePicture || avatarPreview) {
                  <button mat-stroked-button type="button" color="warn"
                          [disabled]="uploadingAvatar" (click)="removeAvatar()">
                    <mat-icon>delete</mat-icon>
                    Remove
                  </button>
                }
              </div>
              <input #avatarInput type="file" accept="image/*" hidden (change)="onAvatarSelected($event)" />
            </div>
          </div>
        }

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
            <mat-hint>Minimum 8 characters</mat-hint>
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

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Extension Number</mat-label>
          <input matInput formControlName="extensionNumber" placeholder="e.g., 301">
          <mat-hint>PBX extension number for phone system</mat-hint>
        </mat-form-field>

        <div class="birthday-section">
          <h4><mat-icon>cake</mat-icon> Birthday</h4>
          <p class="section-hint">Add birthday to display on the company calendar</p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Birthday</mat-label>
            <input matInput formControlName="birthday" type="date">
            <mat-hint>Birthday will appear on the calendar for active users</mat-hint>
          </mat-form-field>
        </div>

        <div class="clockin-section">
          <h4><mat-icon>fingerprint</mat-icon> Clock-In System Link</h4>
          <p class="section-hint">Link this user to an employee in the clock-in system to pull attendance data</p>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Link to Clock-In Employee</mat-label>
            <mat-select formControlName="linkedEmpId">
              <mat-option [value]="null">Not Linked</mat-option>
              @for (emp of data.clockInEmployees; track emp.empId) {
                <mat-option [value]="emp.empId">
                  {{ emp.name }} {{ emp.lastName }} 
                  @if (emp.department) { - {{ emp.department }} }
                  @if (emp.idNum) { ({{ emp.idNum }}) }
                </mat-option>
              }
            </mat-select>
            <mat-hint>Select an employee to view their attendance records</mat-hint>
          </mat-form-field>
          @if (form.get('linkedEmpId')?.value) {
            <div class="linked-status">
              <mat-icon>check_circle</mat-icon>
              <span>Linked to clock-in system</span>
            </div>
            @if (selectedClockInHasPhoto()) {
              <div class="clockin-photo-row">
                <img class="clockin-photo" [src]="clockInPhotoUrl(form.get('linkedEmpId')?.value)" alt="Clock-in photo" />
                <div class="clockin-photo-meta">
                  <span class="clockin-photo-title">Clock-in machine photo</span>
                  @if (data.mode === 'edit') {
                    <button mat-stroked-button type="button" color="primary"
                            [disabled]="applyingPhoto" (click)="useClockInPhoto()">
                      <mat-icon>account_circle</mat-icon>
                      {{ applyingPhoto ? 'Applying…' : 'Use as profile picture' }}
                    </button>
                  } @else {
                    <span class="section-hint">This photo will be used as the profile picture after saving.</span>
                  }
                </div>
              </div>
            }
          }
        </div>

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
    @if (formSubmitted && form.invalid) {
      <div class="form-error-summary">
        <mat-icon>error_outline</mat-icon>
        <span>Please fill in all required fields correctly before submitting.</span>
      </div>
    }
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="submit()">
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
      color: var(--color-text);
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

    .form-error-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      margin: 0 24px 8px;
      background: var(--color-danger-soft);
      border-radius: var(--radius-control);
      color: var(--color-danger);
      font-size: var(--text-sm);
      font-weight: 500;
    }

    .form-error-summary mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--color-danger);
    }

    .birthday-section {
      margin: 16px 0;
      padding: 16px;
      background: var(--color-cat-pink-soft);
      border-radius: var(--radius-control);
    }

    .birthday-section h4 {
      margin: 0 0 4px 0;
      color: var(--color-cat-pink);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .birthday-section h4 mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .clockin-section {
      margin: 16px 0;
      padding: 16px;
      background: var(--color-cat-amber-soft);
      border-radius: var(--radius-control);
    }

    .clockin-section h4 {
      margin: 0 0 4px 0;
      color: var(--color-cat-amber);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .clockin-section h4 mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .linked-status {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      padding: 8px 12px;
      background: var(--color-ok-soft);
      border-radius: 4px;
      color: var(--color-ok);
      font-size: var(--text-sm);
    }

    .linked-status mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .clockin-photo-row {
      display: flex;
      align-items: center;
      gap: 14px;
      margin-top: 10px;
      padding: 10px 12px;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-control);
    }

    .clockin-photo {
      width: 64px;
      height: 64px;
      object-fit: cover;
      border-radius: var(--radius-control);
      border: 2px solid var(--color-line-strong);
      background: var(--color-canvas);
    }

    .clockin-photo-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .clockin-photo-title {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-cat-amber);
    }

    .avatar-section {
      display: flex;
      align-items: center;
      gap: 18px;
      margin: 4px 0 20px;
      padding: 16px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
    }

    .avatar-preview {
      width: 88px;
      height: 88px;
      border-radius: 50%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-3);
      border: 3px solid var(--color-line-strong);
      flex-shrink: 0;
    }

    .avatar-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-preview mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: var(--color-text-3);
    }

    .avatar-actions {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .avatar-title {
      font-size: var(--text-md);
      font-weight: 700;
      color: var(--color-text);
    }

    .avatar-buttons {
      display: flex;
      gap: 8px;
      margin-top: 4px;
    }

    .companies-section {
      margin: 16px 0;
      padding: 16px;
      background: var(--color-cat-teal-soft);
      border-radius: var(--radius-control);
    }

    .companies-section h4 {
      margin: 0 0 4px 0;
      color: var(--color-cat-teal);
    }

    .section-hint {
      margin: 0 0 12px 0;
      font-size: var(--text-xs);
      color: var(--color-text-2);
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
      background: var(--color-surface-2);
      border-radius: var(--radius-control);
    }

    .permissions-section h4 {
      margin: 0 0 12px 0;
      color: var(--color-text-2);
    }

    .permissions-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .permission-category h5 {
      margin: 0 0 8px 0;
      font-size: var(--text-sm);
      color: var(--color-text-3);
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
  formSubmitted = false;
  applyingPhoto = false;
  uploadingAvatar = false;
  avatarPreview: string | null = null;
  readonly apiUrl = environment.apiUrl;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<UserFormDialogComponent>,
    private http: HttpClient,
    private toast: ToastService,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    const user = data.user;
    // Parse permissions — handle plain comma-separated string or JSON array format
    if (user?.permissions) {
      try {
        const parsed = JSON.parse(user.permissions);
        if (Array.isArray(parsed)) {
          // Filter out single-char entries (corrupted char-array data) and take valid keys
          this.selectedPermissions = parsed.filter((p: string) => typeof p === 'string' && p.length > 1);
        } else {
          this.selectedPermissions = String(parsed).split(',').map((p: string) => p.trim()).filter(Boolean);
        }
      } catch {
        this.selectedPermissions = user.permissions.split(',').map((p: string) => p.trim()).filter(Boolean);
      }
    } else {
      this.selectedPermissions = [];
    }
    this.selectedCompanies = user?.companyIds || [];

    this.form = this.fb.group({
      name: [user?.name || '', Validators.required],
      surname: [user?.surname || '', Validators.required],
      email: [user?.email || '', [Validators.required, Validators.email]],
      password: [data.mode === 'create' ? '' : null, data.mode === 'create' ? [Validators.required, Validators.minLength(8)] : []],
      role: [user?.role || 'Employee', Validators.required],
      departmentId: [user?.departmentId || null],
      title: [user?.title || ''],
      extensionNumber: [user?.extensionNumber || ''],
      linkedEmpId: [user?.linkedEmpId || null],
      birthday: [user?.birthday ? this.formatDateForInput(user.birthday) : null],
      isActive: [user?.isActive ?? true]
    });
  }

  formatDateForInput(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  // ── Clock-in photo helpers ────────────────────────────────
  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ 'Authorization': `Bearer ${token}` });
  }

  clockInPhotoUrl(empId: string): string {
    return `${this.apiUrl}/users/clockin-employees/${encodeURIComponent(empId)}/photo`;
  }

  selectedClockInHasPhoto(): boolean {
    const empId = this.form.get('linkedEmpId')?.value;
    if (!empId) return false;
    const emp = (this.data.clockInEmployees || []).find((e: ClockInEmployee) => e.empId === empId);
    return !!emp?.hasPhoto;
  }

  useClockInPhoto(): void {
    const user = this.data.user;
    if (!user?.userId) return;
    this.applyingPhoto = true;
    this.http.post(`${this.apiUrl}/users/${user.userId}/use-clockin-photo`, {}, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.applyingPhoto = false;
          user.hasProfilePicture = true;
          this.avatarPreview = null;
          this.toast.done('Profile picture set from clock-in photo.');
        },
        error: (err) => {
          this.applyingPhoto = false;
          this.toast.error(err?.error?.message || 'Could not apply clock-in photo.');
        }
      });
  }

  // ── Profile picture upload (admin) ────────────────────────
  userPhotoUrl(): string {
    const id = this.data.user?.userId;
    // Cache-bust so a freshly-uploaded picture is shown immediately.
    return `${this.apiUrl}/profile/${id}/photo?t=${Date.now()}`;
  }

  onAvatarSelected(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.toast.warn('Please choose a JPEG, PNG, GIF or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.warn('Image is too large (max 5MB).');
      return;
    }

    const userId = this.data.user?.userId;
    if (!userId) return;

    // Local preview while uploading.
    const reader = new FileReader();
    reader.onload = () => (this.avatarPreview = reader.result as string);
    reader.readAsDataURL(file);

    const form = new FormData();
    form.append('file', file, file.name);
    this.uploadingAvatar = true;
    this.http.post(`${this.apiUrl}/profile/${userId}/upload-photo`, form, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.uploadingAvatar = false;
          this.data.user.hasProfilePicture = true;
          this.toast.done('Profile picture updated.');
        },
        error: (err) => {
          this.uploadingAvatar = false;
          this.avatarPreview = null;
          this.toast.error(err?.error?.message || 'Could not upload the picture.');
        }
      });
  }

  removeAvatar(): void {
    const userId = this.data.user?.userId;
    if (!userId) return;
    this.uploadingAvatar = true;
    this.http.delete(`${this.apiUrl}/profile/${userId}/photo`, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.uploadingAvatar = false;
          this.data.user.hasProfilePicture = false;
          this.avatarPreview = null;
          this.toast.done('Profile picture removed.');
        },
        error: (err) => {
          this.uploadingAvatar = false;
          this.toast.error(err?.error?.message || 'Could not remove the picture.');
        }
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
    this.formSubmitted = true;
    this.form.markAllAsTouched();
    
    if (this.form.valid) {
      const formData = { ...this.form.value };
      formData.permissions = this.selectedPermissions.join(',');
      formData.companyIds = this.selectedCompanies;
      // Ensure unlinking sends '' so backend clears the field (null is ignored)
      if (formData.linkedEmpId === null || formData.linkedEmpId === undefined) {
        formData.linkedEmpId = '';
      }
      
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
        <input matInput [(ngModel)]="newPassword" [type]="showNewPassword ? 'text' : 'password'" required>
        <button [attr.aria-label]="showNewPassword ? 'Hide password' : 'Show password'" mat-icon-button matSuffix type="button" (click)="showNewPassword = !showNewPassword">
          <mat-icon>{{ showNewPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
      </mat-form-field>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Confirm Password</mat-label>
        <input matInput [(ngModel)]="confirmPassword" [type]="showConfirmPassword ? 'text' : 'password'" required>
        <button [attr.aria-label]="showConfirmPassword ? 'Hide password' : 'Show password'" mat-icon-button matSuffix type="button" (click)="showConfirmPassword = !showConfirmPassword">
          <mat-icon>{{ showConfirmPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
        </button>
        @if (confirmPassword && newPassword !== confirmPassword) {
          <mat-error>Passwords do not match</mat-error>
        }
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" 
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
      color: var(--color-text);
    }

    .full-width {
      width: 100%;
    }

    p {
      margin-bottom: 16px;
      color: var(--color-text-3);
    }
  `]
})
export class ResetPasswordDialogComponent {
  newPassword = '';
  confirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;

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
