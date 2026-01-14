import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { RouterModule } from '@angular/router';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SystemLogsService, SystemLog } from '../../services/system-logs.service';
import { AnnouncementHistoryService, Announcement } from '../../services/announcement-history.service';
import { AuthService } from '../../services/auth.service';
import { UserManagementService, User, Department, CreateUserDto, Permission, OperatingCompany, ClockInEmployee } from '../../services/user-management.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatCheckboxModule,
    MatDialogModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatBadgeModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMenuModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="settings-container">
      <div class="settings-header">
        <div class="header-content">
          <mat-icon class="header-icon">settings</mat-icon>
          <div>
            <h1>Admin Settings</h1>
            <p>Manage announcements, users, and view system logs</p>
          </div>
        </div>
      </div>

      <mat-tab-group class="settings-tabs" animationDuration="200ms">
        <!-- Announcements Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>campaign</mat-icon>
            <span>Announcements</span>
            <span class="tab-badge" *ngIf="activeAnnouncementsCount > 0">{{ activeAnnouncementsCount }}</span>
          </ng-template>
          
          <div class="tab-content">
            <div class="tab-toolbar">
              <div class="filters">
                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>Status</mat-label>
                  <mat-select [(ngModel)]="announcementStatusFilter" (selectionChange)="filterAnnouncements()">
                    <mat-option value="all">All</mat-option>
                    <mat-option value="active">Active</mat-option>
                    <mat-option value="inactive">Inactive</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>Type</mat-label>
                  <mat-select [(ngModel)]="announcementTypeFilter" (selectionChange)="filterAnnouncements()">
                    <mat-option value="all">All Types</mat-option>
                    <mat-option value="info">Info</mat-option>
                    <mat-option value="warning">Warning</mat-option>
                    <mat-option value="success">Success</mat-option>
                    <mat-option value="urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <button mat-raised-button color="primary" (click)="openCreateAnnouncementDialog()">
                <mat-icon>add</mat-icon>
                New Announcement
              </button>
            </div>

            <div class="announcements-list">
              @if (announcementsLoading) {
                <div class="loading-state">
                  <mat-spinner diameter="40"></mat-spinner>
                </div>
              } @else if (announcements.length === 0) {
                <div class="empty-state">
                  <mat-icon>campaign</mat-icon>
                  <h3>No announcements found</h3>
                  <p>Create your first announcement to get started</p>
                </div>
              } @else {
                @for (announcement of paginatedAnnouncements; track announcement.id) {
                  <mat-card class="announcement-card" [class.inactive]="!announcement.isActive">
                    <div class="announcement-header">
                      <div class="announcement-type" [style.background]="getTypeColor(announcement.type)">
                        <mat-icon>{{ getTypeIcon(announcement.type) }}</mat-icon>
                      </div>
                      <div class="announcement-info">
                        <h3>{{ announcement.title }}</h3>
                        <div class="announcement-meta">
                          <span><mat-icon>person</mat-icon> {{ announcement.createdByName }}</span>
                          <span><mat-icon>schedule</mat-icon> {{ formatDate(announcement.createdAt) }}</span>
                          <span><mat-icon>visibility</mat-icon> {{ announcement.viewCount }} views</span>
                          <span><mat-icon>group</mat-icon> {{ announcement.targetAudience }}</span>
                        </div>
                      </div>
                      <div class="announcement-status">
                        <mat-chip [class]="announcement.isActive ? 'active' : 'inactive'">
                          {{ announcement.isActive ? 'Active' : 'Inactive' }}
                        </mat-chip>
                      </div>
                      <div class="announcement-actions">
                        <button mat-icon-button [matMenuTriggerFor]="announcementMenu" matTooltip="Actions">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #announcementMenu="matMenu">
                          <button mat-menu-item (click)="toggleAnnouncementStatus(announcement)">
                            <mat-icon>{{ announcement.isActive ? 'visibility_off' : 'visibility' }}</mat-icon>
                            <span>{{ announcement.isActive ? 'Deactivate' : 'Activate' }}</span>
                          </button>
                          <button mat-menu-item (click)="editAnnouncement(announcement)">
                            <mat-icon>edit</mat-icon>
                            <span>Edit</span>
                          </button>
                          <button mat-menu-item (click)="deleteAnnouncement(announcement)" class="delete-action">
                            <mat-icon>delete</mat-icon>
                            <span>Delete</span>
                          </button>
                        </mat-menu>
                      </div>
                    </div>
                    <div class="announcement-body">
                      <p>{{ announcement.message }}</p>
                    </div>
                    @if (announcement.expiresAt) {
                      <div class="announcement-footer">
                        <mat-icon>event</mat-icon>
                        <span>Expires: {{ formatDate(announcement.expiresAt) }}</span>
                      </div>
                    }
                  </mat-card>
                }
                <mat-paginator
                  [length]="announcements.length"
                  [pageSize]="announcementsPageSize"
                  [pageSizeOptions]="[5, 10, 25]"
                  (page)="onAnnouncementsPageChange($event)">
                </mat-paginator>
              }
            </div>
          </div>
        </mat-tab>

        <!-- User Management Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>people</mat-icon>
            <span>User Management</span>
          </ng-template>
          
          <div class="tab-content">
            <div class="tab-toolbar">
              <mat-form-field appearance="outline" class="search-field">
                <mat-label>Search Users</mat-label>
                <mat-icon matPrefix>search</mat-icon>
                <input matInput [(ngModel)]="userSearchQuery" (input)="searchUsers()" placeholder="Search by name or email">
              </mat-form-field>
              <button mat-raised-button color="primary" (click)="openCreateUserDialog()">
                <mat-icon>person_add</mat-icon>
                Add User
              </button>
            </div>

            <div class="users-table-container">
              @if (usersLoading) {
                <div class="loading-state">
                  <mat-spinner diameter="40"></mat-spinner>
                </div>
              } @else {
                <table mat-table [dataSource]="filteredUsers" class="users-table">
                  <ng-container matColumnDef="avatar">
                    <th mat-header-cell *matHeaderCellDef></th>
                    <td mat-cell *matCellDef="let user">
                      <div class="user-avatar" [style.background]="userService.getRoleColor(user.role) + '22'" [style.color]="userService.getRoleColor(user.role)">
                        <mat-icon>{{ userService.getRoleIcon(user.role) }}</mat-icon>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Name</th>
                    <td mat-cell *matCellDef="let user">
                      <div class="user-name">
                        <strong>{{ user.name }} {{ user.surname }}</strong>
                        <small>{{ user.email }}</small>
                      </div>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="role">
                    <th mat-header-cell *matHeaderCellDef>Role</th>
                    <td mat-cell *matCellDef="let user">
                      <mat-chip [style.background]="userService.getRoleColor(user.role) + '22'" [style.color]="userService.getRoleColor(user.role)">
                        {{ user.role }}
                      </mat-chip>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="department">
                    <th mat-header-cell *matHeaderCellDef>Department</th>
                    <td mat-cell *matCellDef="let user">{{ user.departmentName || 'N/A' }}</td>
                  </ng-container>

                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let user">
                      <span class="status-indicator" [class.active]="user.isActive">
                        {{ user.isActive ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let user">
                      <button mat-icon-button matTooltip="Edit" (click)="editUser(user)">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Toggle Status" (click)="toggleUserStatus(user)">
                        <mat-icon>{{ user.isActive ? 'block' : 'check_circle' }}</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Reset Password" (click)="openResetPasswordDialog(user)">
                        <mat-icon>lock_reset</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="userColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: userColumns;"></tr>
                </table>
              }
              
              @if (!usersLoading && filteredUsers.length === 0) {
                <div class="empty-state">
                  <mat-icon>people_outline</mat-icon>
                  <h3>No users found</h3>
                  <p>Try adjusting your search criteria</p>
                </div>
              }
            </div>
          </div>
        </mat-tab>

        <!-- System Logs Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>history</mat-icon>
            <span>System Logs</span>
          </ng-template>
          
          <div class="tab-content">
            <!-- Stats Cards -->
            <div class="stats-row">
              <mat-card class="stat-card">
                <mat-card-content>
                  <div class="stat-icon" style="background: #2196f3;">
                    <mat-icon>list_alt</mat-icon>
                  </div>
                  <div class="stat-info">
                    <span class="stat-value">{{ logStats.totalLogs }}</span>
                    <span class="stat-label">Total Logs</span>
                  </div>
                </mat-card-content>
              </mat-card>
              <mat-card class="stat-card">
                <mat-card-content>
                  <div class="stat-icon" style="background: #4caf50;">
                    <mat-icon>today</mat-icon>
                  </div>
                  <div class="stat-info">
                    <span class="stat-value">{{ logStats.todayLogs }}</span>
                    <span class="stat-label">Today</span>
                  </div>
                </mat-card-content>
              </mat-card>
              <mat-card class="stat-card">
                <mat-card-content>
                  <div class="stat-icon" style="background: #f44336;">
                    <mat-icon>security</mat-icon>
                  </div>
                  <div class="stat-info">
                    <span class="stat-value">{{ logStats.securityEvents }}</span>
                    <span class="stat-label">Security Events</span>
                  </div>
                </mat-card-content>
              </mat-card>
              <mat-card class="stat-card">
                <mat-card-content>
                  <div class="stat-icon" style="background: #ff9800;">
                    <mat-icon>error_outline</mat-icon>
                  </div>
                  <div class="stat-info">
                    <span class="stat-value">{{ logStats.errorCount }}</span>
                    <span class="stat-label">Errors</span>
                  </div>
                </mat-card-content>
              </mat-card>
            </div>

            <div class="tab-toolbar">
              <div class="filters">
                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>Category</mat-label>
                  <mat-select [(ngModel)]="logCategoryFilter" (selectionChange)="filterLogs()">
                    <mat-option value="all">All Categories</mat-option>
                    <mat-option value="security">Security</mat-option>
                    <mat-option value="user">User</mat-option>
                    <mat-option value="announcement">Announcement</mat-option>
                    <mat-option value="settings">Settings</mat-option>
                    <mat-option value="system">System</mat-option>
                    <mat-option value="document">Document</mat-option>
                    <mat-option value="crm">CRM</mat-option>
                    <mat-option value="attendance">Attendance</mat-option>
                    <mat-option value="meeting">Meeting</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="filter-field">
                  <mat-label>Date Range</mat-label>
                  <mat-select [(ngModel)]="logDateFilter" (selectionChange)="filterLogs()">
                    <mat-option value="today">Today</mat-option>
                    <mat-option value="week">This Week</mat-option>
                    <mat-option value="month">This Month</mat-option>
                    <mat-option value="all">All Time</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline" class="search-field">
                  <mat-label>Search logs</mat-label>
                  <input matInput [(ngModel)]="logSearchQuery" (keyup.enter)="filterLogs()" placeholder="Search by action, user, description...">
                  <mat-icon matSuffix>search</mat-icon>
                </mat-form-field>
              </div>
              <div class="toolbar-actions">
                <button mat-stroked-button (click)="refreshLogs()">
                  <mat-icon>refresh</mat-icon>
                  Refresh
                </button>
                <button mat-stroked-button color="primary" (click)="exportLogs()">
                  <mat-icon>download</mat-icon>
                  Export Logs
                </button>
              </div>
            </div>

            <div class="logs-list">
              @if (logsLoading) {
                <div class="loading-state">
                  <mat-spinner diameter="40"></mat-spinner>
                </div>
              } @else if (logs.length === 0) {
                <div class="empty-state">
                  <mat-icon>history</mat-icon>
                  <h3>No logs found</h3>
                  <p>System activity logs will appear here</p>
                </div>
              } @else {
                <div class="logs-timeline">
                  @for (log of paginatedLogs; track log.id) {
                    <div class="log-item" [class.log-warning]="log.severity === 'warning'" [class.log-error]="log.severity === 'error' || log.severity === 'critical'" [class.log-failed]="!log.isSuccess">
                      <div class="log-icon" [style.background]="getCategoryColor(log.category)">
                        <mat-icon>{{ getCategoryIcon(log.category) }}</mat-icon>
                      </div>
                      <div class="log-content">
                        <div class="log-header">
                          <span class="log-action">{{ log.action }}</span>
                          <div class="log-badges">
                            <span class="log-category" [style.background]="getCategoryColor(log.category) + '20'" [style.color]="getCategoryColor(log.category)">{{ log.category | titlecase }}</span>
                            @if (log.severity && log.severity !== 'info') {
                              <span class="log-severity" [class]="'severity-' + log.severity">{{ log.severity | titlecase }}</span>
                            }
                            @if (!log.isSuccess) {
                              <span class="log-failed-badge">Failed</span>
                            }
                          </div>
                        </div>
                        <p class="log-description">{{ log.description }}</p>
                        @if (log.errorMessage) {
                          <p class="log-error-message"><mat-icon>error</mat-icon> {{ log.errorMessage }}</p>
                        }
                        <div class="log-meta">
                          @if (log.userName) {
                            <span><mat-icon>person</mat-icon> {{ log.userName }}</span>
                          }
                          @if (log.userRole) {
                            <span class="user-role-badge">{{ log.userRole }}</span>
                          }
                          <span><mat-icon>schedule</mat-icon> {{ formatDateTime(log.timestamp) }}</span>
                          @if (log.ipAddress) {
                            <span><mat-icon>computer</mat-icon> {{ log.ipAddress }}</span>
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
                <mat-paginator
                  [length]="logs.length"
                  [pageSize]="logsPageSize"
                  [pageSizeOptions]="[10, 25, 50]"
                  (page)="onLogsPageChange($event)">
                </mat-paginator>
              }
            </div>
          </div>
        </mat-tab>

        <!-- General Settings Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>tune</mat-icon>
            <span>General</span>
          </ng-template>
          
          <div class="tab-content">
            <div class="settings-section">
              <h3>System Preferences</h3>
              <mat-divider></mat-divider>
              
              <div class="setting-item">
                <div class="setting-info">
                  <h4>Email Notifications</h4>
                  <p>Send email notifications for important system events</p>
                </div>
                <mat-slide-toggle [(ngModel)]="settings.emailNotifications" (change)="saveSettings()">
                </mat-slide-toggle>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <h4>Auto-expire Announcements</h4>
                  <p>Automatically deactivate announcements after their expiry date</p>
                </div>
                <mat-slide-toggle [(ngModel)]="settings.autoExpireAnnouncements" (change)="saveSettings()">
                </mat-slide-toggle>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <h4>Audit Logging</h4>
                  <p>Log all user actions for security auditing</p>
                </div>
                <mat-slide-toggle [(ngModel)]="settings.auditLogging" (change)="saveSettings()">
                </mat-slide-toggle>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <h4>Session Timeout (minutes)</h4>
                  <p>Automatically log out users after inactivity</p>
                </div>
                <mat-form-field appearance="outline" class="setting-input">
                  <input matInput type="number" [(ngModel)]="settings.sessionTimeout" (change)="saveSettings()">
                </mat-form-field>
              </div>
            </div>

            <div class="settings-section">
              <h3>Security Settings</h3>
              <mat-divider></mat-divider>
              
              <div class="setting-item">
                <div class="setting-info">
                  <h4>Two-Factor Authentication</h4>
                  <p>Require 2FA for all admin accounts</p>
                </div>
                <mat-slide-toggle [(ngModel)]="settings.twoFactorAuth" (change)="saveSettings()">
                </mat-slide-toggle>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <h4>Password Expiry (days)</h4>
                  <p>Force password change after specified days</p>
                </div>
                <mat-form-field appearance="outline" class="setting-input">
                  <input matInput type="number" [(ngModel)]="settings.passwordExpiry" (change)="saveSettings()">
                </mat-form-field>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <h4>Failed Login Lockout</h4>
                  <p>Lock account after failed login attempts</p>
                </div>
                <mat-form-field appearance="outline" class="setting-input">
                  <input matInput type="number" [(ngModel)]="settings.failedLoginLockout" (change)="saveSettings()">
                  <span matSuffix>attempts</span>
                </mat-form-field>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>

    <!-- Create/Edit Announcement Dialog -->
    @if (showAnnouncementDialog) {
      <div class="dialog-overlay" (click)="closeAnnouncementDialog()">
        <div class="dialog-container" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h2>{{ editingAnnouncement ? 'Edit' : 'Create' }} Announcement</h2>
            <button mat-icon-button (click)="closeAnnouncementDialog()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <form [formGroup]="announcementForm" (ngSubmit)="saveAnnouncement()">
            <div class="dialog-content">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Title</mat-label>
                <input matInput formControlName="title" required>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Message</mat-label>
                <textarea matInput formControlName="message" rows="4" required></textarea>
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Type</mat-label>
                  <mat-select formControlName="type" required>
                    <mat-option value="info">Info</mat-option>
                    <mat-option value="warning">Warning</mat-option>
                    <mat-option value="success">Success</mat-option>
                    <mat-option value="urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select formControlName="priority" required>
                    <mat-option value="low">Low</mat-option>
                    <mat-option value="medium">Medium</mat-option>
                    <mat-option value="high">High</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Target Audience</mat-label>
                  <mat-select formControlName="targetAudience" required>
                    <mat-option value="All Users">All Users</mat-option>
                    <mat-option value="Managers">Managers Only</mat-option>
                    <mat-option value="Admins">Admins Only</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Expires On (Optional)</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="expiresAt">
                  <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>
              </div>
            </div>
            <div class="dialog-actions">
              <button mat-button type="button" (click)="closeAnnouncementDialog()">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="announcementForm.invalid">
                {{ editingAnnouncement ? 'Update' : 'Create' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Create/Edit User Dialog -->
    @if (showUserDialog) {
      <div class="dialog-overlay" (click)="closeUserDialog()">
        <div class="dialog-container dialog-large" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h2>{{ editingUser ? 'Edit User' : 'Create New User' }}</h2>
            <button mat-icon-button (click)="closeUserDialog()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <form [formGroup]="userForm" (ngSubmit)="saveUser()">
            <div class="dialog-content">
              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>First Name</mat-label>
                  <input matInput formControlName="name" required>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Surname</mat-label>
                  <input matInput formControlName="surname" required>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email</mat-label>
                <input matInput formControlName="email" type="email" required>
              </mat-form-field>

              @if (!editingUser) {
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Password</mat-label>
                  <input matInput formControlName="password" type="password" required>
                  <mat-hint>Minimum 8 characters</mat-hint>
                </mat-form-field>
              }

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Role</mat-label>
                  <mat-select formControlName="role" required>
                    @for (role of roles; track role) {
                      <mat-option [value]="role">{{ role }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Department</mat-label>
                  <mat-select formControlName="departmentId">
                    <mat-option [value]="null">None</mat-option>
                    @for (dept of departments; track dept.departmentId) {
                      <mat-option [value]="dept.departmentId">{{ dept.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Job Title</mat-label>
                <input matInput formControlName="title" placeholder="e.g., Senior Developer">
              </mat-form-field>

              <!-- Birthday Section -->
              <div class="form-section birthday-section">
                <h4><mat-icon>cake</mat-icon> Birthday</h4>
                <p class="section-hint">Add birthday to display on the company calendar</p>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Birthday</mat-label>
                  <input matInput formControlName="birthday" type="date">
                </mat-form-field>
              </div>

              <!-- Clock-In System Link -->
              <div class="form-section clockin-section">
                <h4><mat-icon>fingerprint</mat-icon> Clock-In System Link</h4>
                <p class="section-hint">Link this user to an employee in the clock-in system to pull attendance data</p>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Link to Clock-In Employee</mat-label>
                  <mat-select formControlName="linkedEmpId">
                    <mat-option [value]="null">Not Linked</mat-option>
                    @for (emp of clockInEmployees; track emp.empId) {
                      <mat-option [value]="emp.empId">
                        {{ emp.name }} {{ emp.lastName }} 
                        @if (emp.department) { - {{ emp.department }} }
                        @if (emp.idNum) { ({{ emp.idNum }}) }
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                @if (userForm.get('linkedEmpId')?.value) {
                  <div class="linked-status">
                    <mat-icon>check_circle</mat-icon>
                    <span>Linked to clock-in system</span>
                  </div>
                }
              </div>

              <!-- Company Assignments -->
              <div class="form-section companies-section">
                <h4>Company Assignments</h4>
                <p class="section-hint">Select which companies this user works for</p>
                <div class="checkbox-grid">
                  @for (company of companies; track company.operatingCompanyId) {
                    <mat-checkbox 
                      [checked]="hasCompany(company.operatingCompanyId)"
                      (change)="toggleCompany(company.operatingCompanyId, $event.checked)">
                      {{ company.name }}
                    </mat-checkbox>
                  }
                  @if (companies.length === 0) {
                    <p class="no-data-hint">No companies available</p>
                  }
                </div>
              </div>

              <!-- Permissions -->
              <div class="form-section permissions-section">
                <h4>Permissions</h4>
                <p class="section-hint">Configure user permissions</p>
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
                  @if (permissions.length === 0) {
                    <p class="no-data-hint">No permissions defined</p>
                  }
                </div>
              </div>

              <div class="setting-item" style="padding: 8px 0;">
                <div class="setting-info">
                  <h4 style="margin: 0;">Active</h4>
                  <p style="margin: 0; font-size: 0.85rem; color: #666;">User can log in to the system</p>
                </div>
                <mat-slide-toggle formControlName="isActive"></mat-slide-toggle>
              </div>
            </div>
            <div class="dialog-actions">
              <button mat-button type="button" (click)="closeUserDialog()">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="userForm.invalid || savingUser">
                @if (savingUser) {
                  <mat-spinner diameter="20"></mat-spinner>
                } @else {
                  {{ editingUser ? 'Update' : 'Create' }}
                }
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- Reset Password Dialog -->
    @if (showResetPasswordDialog) {
      <div class="dialog-overlay" (click)="closeResetPasswordDialog()">
        <div class="dialog-container dialog-small" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h2>Reset Password</h2>
            <button mat-icon-button (click)="closeResetPasswordDialog()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <form [formGroup]="resetPasswordForm" (ngSubmit)="resetPassword()">
            <div class="dialog-content">
              <p>Reset password for <strong>{{ resetPasswordUser?.name }} {{ resetPasswordUser?.surname }}</strong></p>
              
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>New Password</mat-label>
                <input matInput formControlName="newPassword" type="password" required>
                <mat-hint>Minimum 6 characters</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Confirm Password</mat-label>
                <input matInput formControlName="confirmPassword" type="password" required>
              </mat-form-field>
            </div>
            <div class="dialog-actions">
              <button mat-button type="button" (click)="closeResetPasswordDialog()">Cancel</button>
              <button mat-raised-button color="warn" type="submit" [disabled]="resetPasswordForm.invalid">
                Reset Password
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .settings-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .settings-header {
      margin-bottom: 24px;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .header-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1976d2;
    }

    .header-content h1 {
      margin: 0;
      font-size: 2rem;
      color: #333;
    }

    .header-content p {
      margin: 4px 0 0 0;
      color: #666;
    }

    .settings-tabs {
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    ::ng-deep .mat-mdc-tab-labels {
      background: #f5f5f5;
      border-radius: 12px 12px 0 0;
    }

    ::ng-deep .mat-mdc-tab {
      min-width: 160px;
    }

    ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tab-badge {
      background: #f44336;
      color: white;
      border-radius: 10px;
      padding: 2px 8px;
      font-size: 0.75rem;
      margin-left: 4px;
    }

    .tab-content {
      padding: 24px;
    }

    .tab-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .filters {
      display: flex;
      gap: 16px;
    }

    .filter-field {
      width: 150px;
    }

    .search-field {
      width: 300px;
    }

    /* Announcements Styles */
    .announcements-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .announcement-card {
      padding: 20px;
      border-radius: 12px;
      transition: box-shadow 0.2s;
    }

    .announcement-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .announcement-card.inactive {
      opacity: 0.7;
      background: #f9f9f9;
    }

    .announcement-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .announcement-type {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .announcement-info {
      flex: 1;
    }

    .announcement-info h3 {
      margin: 0 0 8px 0;
      font-size: 1.1rem;
    }

    .announcement-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      color: #666;
      font-size: 0.85rem;
    }

    .announcement-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .announcement-meta mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .announcement-status mat-chip.active {
      background: #e8f5e9 !important;
      color: #2e7d32 !important;
    }

    .announcement-status mat-chip.inactive {
      background: #fafafa !important;
      color: #9e9e9e !important;
    }

    .announcement-body {
      margin-top: 16px;
      padding-left: 64px;
      color: #555;
    }

    .announcement-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding-left: 64px;
      color: #888;
      font-size: 0.85rem;
    }

    .announcement-footer mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Users Table Styles */
    .users-table-container {
      overflow-x: auto;
    }

    .users-table {
      width: 100%;
    }

    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #e3f2fd;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #1976d2;
    }

    .user-name {
      display: flex;
      flex-direction: column;
    }

    .user-name small {
      color: #666;
    }

    .status-indicator {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      background: #ffebee;
      color: #c62828;
    }

    .status-indicator.active {
      background: #e8f5e9;
      color: #2e7d32;
    }

    /* Logs Styles */
    .logs-timeline {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .log-item {
      display: flex;
      gap: 16px;
      padding: 16px;
      background: #fafafa;
      border-radius: 8px;
      transition: background 0.2s;
    }

    .log-item:hover {
      background: #f0f0f0;
    }

    .log-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .log-content {
      flex: 1;
    }

    .log-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .log-action {
      font-weight: 600;
      color: #333;
    }

    .log-category {
      background: #e0e0e0;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      color: #666;
    }

    .log-description {
      margin: 0 0 8px 0;
      color: #555;
    }

    .log-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      color: #888;
      font-size: 0.85rem;
    }

    .log-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .log-meta mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Stats Row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px !important;
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .stat-icon mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #333;
    }

    .stat-label {
      font-size: 0.85rem;
      color: #666;
    }

    /* Log Badges and Severity */
    .log-badges {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .log-severity {
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .severity-warning {
      background: #fff3e0;
      color: #e65100;
    }

    .severity-error, .severity-critical {
      background: #ffebee;
      color: #c62828;
    }

    .log-failed-badge {
      background: #ffebee;
      color: #c62828;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 600;
    }

    .log-item.log-warning {
      border-left: 3px solid #ff9800;
    }

    .log-item.log-error, .log-item.log-failed {
      border-left: 3px solid #f44336;
      background: #fff5f5;
    }

    .log-error-message {
      margin: 0 0 8px 0;
      color: #c62828;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .log-error-message mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .user-role-badge {
      background: #e3f2fd;
      color: #1565c0;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .search-field {
      min-width: 250px;
    }

    .toolbar-actions {
      display: flex;
      gap: 8px;
    }

    @media (max-width: 1200px) {
      .stats-row {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .stats-row {
        grid-template-columns: 1fr;
      }
      
      .search-field {
        min-width: 100%;
      }
    }

    /* Settings Section Styles */
    .settings-section {
      margin-bottom: 32px;
    }

    .settings-section h3 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .setting-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid #eee;
    }

    .setting-info h4 {
      margin: 0 0 4px 0;
      font-size: 1rem;
    }

    .setting-info p {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }

    .setting-input {
      width: 120px;
    }

    /* Dialog Styles */
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }

    .dialog-container {
      background: white;
      border-radius: 12px;
      width: 100%;
      max-width: 600px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .dialog-container.dialog-small {
      max-width: 400px;
    }

    .dialog-container.dialog-large {
      max-width: 700px;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #eee;
    }

    .dialog-header h2 {
      margin: 0;
    }

    .dialog-content {
      padding: 24px;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #eee;
    }

    .full-width {
      width: 100%;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row mat-form-field {
      flex: 1;
    }

    /* Form Section Styles */
    .form-section {
      margin: 24px 0;
      padding: 16px;
      border-radius: 8px;
    }

    .form-section h4 {
      margin: 0 0 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1rem;
      color: #333;
    }

    .section-hint {
      margin: 0 0 16px 0;
      font-size: 0.85rem;
      color: #666;
    }

    .birthday-section {
      background: linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%);
    }

    .birthday-section h4 {
      color: #c2185b;
    }

    .clockin-section {
      background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
    }

    .clockin-section h4 {
      color: #e65100;
    }

    .linked-status {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #2e7d32;
      font-size: 0.85rem;
      margin-top: 8px;
    }

    .companies-section {
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
    }

    .companies-section h4 {
      color: #2e7d32;
    }

    .permissions-section {
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    }

    .permissions-section h4 {
      color: #1565c0;
    }

    .checkbox-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
    }

    .permissions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }

    .permission-category {
      background: rgba(255,255,255,0.7);
      border-radius: 8px;
      padding: 12px;
    }

    .permission-category h5 {
      margin: 0 0 8px 0;
      font-size: 0.9rem;
      color: #1565c0;
      border-bottom: 1px solid rgba(21, 101, 192, 0.2);
      padding-bottom: 6px;
    }

    .permission-category mat-checkbox {
      display: block;
      margin: 4px 0;
    }

    .no-data-hint {
      color: #666;
      font-style: italic;
      font-size: 0.85rem;
    }

    /* Common Styles */
    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #666;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .empty-state p {
      margin: 0;
    }

    .delete-action {
      color: #f44336 !important;
    }
  `]
})
export class SettingsComponent implements OnInit {
  // Announcements
  announcements: Announcement[] = [];
  paginatedAnnouncements: Announcement[] = [];
  announcementsLoading = false;
  announcementStatusFilter = 'all';
  announcementTypeFilter = 'all';
  announcementsPageSize = 5;
  announcementsPageIndex = 0;
  activeAnnouncementsCount = 0;
  showAnnouncementDialog = false;
  editingAnnouncement: Announcement | null = null;
  announcementForm!: FormGroup;

  // Users
  users: User[] = [];
  filteredUsers: User[] = [];
  userSearchQuery = '';
  userColumns = ['avatar', 'name', 'role', 'department', 'status', 'actions'];
  usersLoading = false;
  showUserDialog = false;
  editingUser: User | null = null;
  userForm!: FormGroup;
  savingUser = false;
  roles: string[] = [];
  departments: Department[] = [];
  companies: OperatingCompany[] = [];
  clockInEmployees: ClockInEmployee[] = [];
  permissions: Permission[] = [];
  selectedPermissions: string[] = [];
  selectedCompanies: number[] = [];
  
  // Reset Password
  showResetPasswordDialog = false;
  resetPasswordUser: User | null = null;
  resetPasswordForm!: FormGroup;

  // Logs
  logs: SystemLog[] = [];
  paginatedLogs: SystemLog[] = [];
  logsLoading = false;
  logCategoryFilter = 'all';
  logDateFilter = 'all';
  logSearchQuery = '';
  logsPageSize = 10;
  logsPageIndex = 0;
  logStats = {
    totalLogs: 0,
    todayLogs: 0,
    securityEvents: 0,
    errorCount: 0
  };

  // Settings
  settings = {
    emailNotifications: true,
    autoExpireAnnouncements: true,
    auditLogging: true,
    sessionTimeout: 30,
    twoFactorAuth: false,
    passwordExpiry: 90,
    failedLoginLockout: 5
  };

  constructor(
    private fb: FormBuilder,
    private announcementService: AnnouncementHistoryService,
    private logsService: SystemLogsService,
    private authService: AuthService,
    public userService: UserManagementService,
    private snackBar: MatSnackBar
  ) {
    this.initAnnouncementForm();
    this.initUserForm();
    this.initResetPasswordForm();
  }

  ngOnInit(): void {
    this.loadAnnouncements();
    this.loadLogs();
    this.loadUsers();
    this.loadRolesAndDepartments();
  }

  initAnnouncementForm(): void {
    this.announcementForm = this.fb.group({
      title: ['', Validators.required],
      message: ['', Validators.required],
      type: ['info', Validators.required],
      priority: ['medium', Validators.required],
      targetAudience: ['All Users', Validators.required],
      expiresAt: [null]
    });
  }

  // Announcements Methods
  loadAnnouncements(): void {
    this.announcementsLoading = true;
    this.announcementService.getAnnouncements({
      status: this.announcementStatusFilter,
      type: this.announcementTypeFilter
    }).subscribe(announcements => {
      this.announcements = announcements;
      this.activeAnnouncementsCount = announcements.filter(a => a.isActive).length;
      this.updatePaginatedAnnouncements();
      this.announcementsLoading = false;
    });
  }

  filterAnnouncements(): void {
    this.loadAnnouncements();
  }

  updatePaginatedAnnouncements(): void {
    const start = this.announcementsPageIndex * this.announcementsPageSize;
    const end = start + this.announcementsPageSize;
    this.paginatedAnnouncements = this.announcements.slice(start, end);
  }

  onAnnouncementsPageChange(event: PageEvent): void {
    this.announcementsPageIndex = event.pageIndex;
    this.announcementsPageSize = event.pageSize;
    this.updatePaginatedAnnouncements();
  }

  openCreateAnnouncementDialog(): void {
    this.editingAnnouncement = null;
    this.announcementForm.reset({
      type: 'info',
      priority: 'medium',
      targetAudience: 'All Users'
    });
    this.showAnnouncementDialog = true;
  }

  editAnnouncement(announcement: Announcement): void {
    this.editingAnnouncement = announcement;
    this.announcementForm.patchValue({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type,
      priority: announcement.priority,
      targetAudience: announcement.targetAudience,
      expiresAt: announcement.expiresAt
    });
    this.showAnnouncementDialog = true;
  }

  closeAnnouncementDialog(): void {
    this.showAnnouncementDialog = false;
    this.editingAnnouncement = null;
  }

  saveAnnouncement(): void {
    if (this.announcementForm.valid) {
      const formValue = this.announcementForm.value;
      const currentUser = this.authService.currentUserValue;

      if (this.editingAnnouncement) {
        this.announcementService.updateAnnouncement(this.editingAnnouncement.id, formValue).subscribe(() => {
          this.snackBar.open('Announcement updated successfully', 'Close', { duration: 3000 });
          this.closeAnnouncementDialog();
          this.loadAnnouncements();
          this.logAction('Announcement Updated', 'announcement', `Updated announcement: "${formValue.title}"`);
        });
      } else {
        const newAnnouncement = {
          ...formValue,
          createdBy: currentUser?.userId || 1,
          createdByName: currentUser?.name || 'Admin',
          isActive: true
        };
        this.announcementService.createAnnouncement(newAnnouncement).subscribe(() => {
          this.snackBar.open('Announcement created successfully', 'Close', { duration: 3000 });
          this.closeAnnouncementDialog();
          this.loadAnnouncements();
          this.logAction('Announcement Created', 'announcement', `Created announcement: "${formValue.title}"`);
        });
      }
    }
  }

  toggleAnnouncementStatus(announcement: Announcement): void {
    this.announcementService.toggleAnnouncementStatus(announcement.id).subscribe(() => {
      this.snackBar.open(`Announcement ${announcement.isActive ? 'deactivated' : 'activated'}`, 'Close', { duration: 3000 });
      this.loadAnnouncements();
      this.logAction('Announcement Status Changed', 'announcement', 
        `${announcement.isActive ? 'Deactivated' : 'Activated'} announcement: "${announcement.title}"`);
    });
  }

  deleteAnnouncement(announcement: Announcement): void {
    if (confirm(`Are you sure you want to delete "${announcement.title}"?`)) {
      this.announcementService.deleteAnnouncement(announcement.id).subscribe(() => {
        this.snackBar.open('Announcement deleted', 'Close', { duration: 3000 });
        this.loadAnnouncements();
        this.logAction('Announcement Deleted', 'announcement', `Deleted announcement: "${announcement.title}"`);
      });
    }
  }

  getTypeIcon(type: string): string {
    return this.announcementService.getTypeIcon(type);
  }

  getTypeColor(type: string): string {
    return this.announcementService.getTypeColor(type);
  }

  // Users Methods
  initUserForm(): void {
    this.userForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      role: ['Employee', Validators.required],
      departmentId: [null],
      title: [''],
      birthday: [null],
      linkedEmpId: [null],
      isActive: [true]
    });
  }

  initResetPasswordForm(): void {
    this.resetPasswordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    });
  }

  loadUsers(): void {
    this.usersLoading = true;
    this.userService.getUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.filteredUsers = [...users];
        this.usersLoading = false;
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.snackBar.open('Failed to load users', 'Close', { duration: 3000 });
        this.usersLoading = false;
      }
    });
  }

  loadRolesAndDepartments(): void {
    this.userService.getRoles().subscribe(roles => this.roles = roles);
    this.userService.getDepartments().subscribe(depts => this.departments = depts);
    this.userService.getCompanies().subscribe(companies => this.companies = companies);
    this.userService.getClockInEmployees().subscribe(employees => this.clockInEmployees = employees);
    this.userService.getPermissions().subscribe(perms => this.permissions = perms);
  }

  searchUsers(): void {
    this.filteredUsers = this.userService.searchUsers(this.userSearchQuery, this.users);
  }

  openCreateUserDialog(): void {
    this.editingUser = null;
    this.selectedPermissions = [];
    this.selectedCompanies = [];
    this.userForm.reset({
      role: 'Employee',
      isActive: true
    });
    // Re-enable password field for new user
    this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
    this.userForm.get('password')?.updateValueAndValidity();
    this.showUserDialog = true;
  }

  editUser(user: User): void {
    this.editingUser = user;
    this.selectedPermissions = user.permissions ? [...user.permissions] : [];
    this.selectedCompanies = user.companyIds ? [...user.companyIds] : [];
    this.userForm.patchValue({
      name: user.name,
      surname: user.surname,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId,
      title: user.title,
      birthday: user.birthday ? this.formatDateForInput(user.birthday) : null,
      linkedEmpId: user.linkedEmpId || null,
      isActive: user.isActive
    });
    // Password not required when editing
    this.userForm.get('password')?.clearValidators();
    this.userForm.get('password')?.updateValueAndValidity();
    this.showUserDialog = true;
  }

  formatDateForInput(date: string | Date): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  closeUserDialog(): void {
    this.showUserDialog = false;
    this.editingUser = null;
    this.savingUser = false;
  }

  // Permission methods
  hasPermission(key: string): boolean {
    return this.selectedPermissions.includes(key);
  }

  togglePermission(key: string, checked: boolean): void {
    if (checked) {
      if (!this.selectedPermissions.includes(key)) {
        this.selectedPermissions.push(key);
      }
    } else {
      const index = this.selectedPermissions.indexOf(key);
      if (index > -1) {
        this.selectedPermissions.splice(index, 1);
      }
    }
  }

  getPermissionCategories(): string[] {
    const categories = [...new Set(this.permissions.map(p => p.category))];
    return categories.sort();
  }

  getPermissionsByCategory(category: string): Permission[] {
    return this.permissions.filter(p => p.category === category);
  }

  // Company methods
  hasCompany(companyId: number): boolean {
    return this.selectedCompanies.includes(companyId);
  }

  toggleCompany(companyId: number, checked: boolean): void {
    if (checked) {
      if (!this.selectedCompanies.includes(companyId)) {
        this.selectedCompanies.push(companyId);
      }
    } else {
      const index = this.selectedCompanies.indexOf(companyId);
      if (index > -1) {
        this.selectedCompanies.splice(index, 1);
      }
    }
  }

  saveUser(): void {
    if (this.userForm.valid) {
      this.savingUser = true;
      const formValue = this.userForm.value;

      if (this.editingUser) {
        // Update existing user
        const updateData = {
          name: formValue.name,
          surname: formValue.surname,
          email: formValue.email,
          role: formValue.role,
          departmentId: formValue.departmentId,
          title: formValue.title,
          birthday: formValue.birthday || null,
          linkedEmpId: formValue.linkedEmpId || null,
          permissions: this.selectedPermissions,
          companyIds: this.selectedCompanies,
          isActive: formValue.isActive
        };
        
        this.userService.updateUser(this.editingUser.userId, updateData).subscribe({
          next: () => {
            this.snackBar.open('User updated successfully', 'Close', { duration: 3000 });
            this.closeUserDialog();
            this.loadUsers();
            this.logAction('User Updated', 'user', `Updated user: ${formValue.email}`);
          },
          error: (err) => {
            console.error('Error updating user:', err);
            this.snackBar.open(err.error?.message || 'Failed to update user', 'Close', { duration: 3000 });
            this.savingUser = false;
          }
        });
      } else {
        // Create new user
        const createData: CreateUserDto = {
          name: formValue.name,
          surname: formValue.surname,
          email: formValue.email,
          password: formValue.password,
          role: formValue.role,
          departmentId: formValue.departmentId,
          title: formValue.title,
          birthday: formValue.birthday || null,
          linkedEmpId: formValue.linkedEmpId || null,
          permissions: this.selectedPermissions,
          companyIds: this.selectedCompanies,
          isActive: formValue.isActive
        };

        this.userService.createUser(createData).subscribe({
          next: () => {
            this.snackBar.open('User created successfully', 'Close', { duration: 3000 });
            this.closeUserDialog();
            this.loadUsers();
            this.logAction('User Created', 'user', `Created user: ${formValue.email}`);
          },
          error: (err) => {
            console.error('Error creating user:', err);
            this.snackBar.open(err.error?.message || 'Failed to create user', 'Close', { duration: 3000 });
            this.savingUser = false;
          }
        });
      }
    }
  }

  toggleUserStatus(user: User): void {
    this.userService.toggleUserStatus(user.userId).subscribe({
      next: (response: any) => {
        this.snackBar.open(`User ${response.isActive ? 'activated' : 'deactivated'}`, 'Close', { duration: 3000 });
        this.loadUsers();
        this.logAction('User Status Changed', 'user', `${response.isActive ? 'Activated' : 'Deactivated'} user: ${user.email}`);
      },
      error: (err) => {
        console.error('Error toggling user status:', err);
        this.snackBar.open('Failed to update user status', 'Close', { duration: 3000 });
      }
    });
  }

  openResetPasswordDialog(user: User): void {
    this.resetPasswordUser = user;
    this.resetPasswordForm.reset();
    this.showResetPasswordDialog = true;
  }

  closeResetPasswordDialog(): void {
    this.showResetPasswordDialog = false;
    this.resetPasswordUser = null;
  }

  resetPassword(): void {
    if (this.resetPasswordForm.valid && this.resetPasswordUser) {
      const { newPassword, confirmPassword } = this.resetPasswordForm.value;
      
      if (newPassword !== confirmPassword) {
        this.snackBar.open('Passwords do not match', 'Close', { duration: 3000 });
        return;
      }

      this.userService.resetPassword(this.resetPasswordUser.userId, newPassword).subscribe({
        next: () => {
          this.snackBar.open('Password reset successfully', 'Close', { duration: 3000 });
          this.closeResetPasswordDialog();
          this.logAction('Password Reset', 'security', `Reset password for user: ${this.resetPasswordUser?.email}`);
        },
        error: (err) => {
          console.error('Error resetting password:', err);
          this.snackBar.open('Failed to reset password', 'Close', { duration: 3000 });
        }
      });
    }
  }

  // Logs Methods
  loadLogs(): void {
    this.logsLoading = true;
    let filter: any = {};
    
    if (this.logCategoryFilter !== 'all') {
      filter.category = this.logCategoryFilter;
    }

    if (this.logSearchQuery) {
      filter.searchTerm = this.logSearchQuery;
    }
    
    if (this.logDateFilter !== 'all') {
      const now = new Date();
      switch (this.logDateFilter) {
        case 'today':
          filter.startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          filter.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          filter.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Load logs
    this.logsService.getLogs(filter).subscribe({
      next: logs => {
        this.logs = logs;
        this.updatePaginatedLogs();
        this.logsLoading = false;
      },
      error: (err) => {
        console.error('Error loading logs:', err);
        this.logsLoading = false;
        this.snackBar.open('Failed to load logs', 'Close', { duration: 3000 });
      }
    });

    // Load stats
    this.logsService.getStats().subscribe({
      next: stats => {
        this.logStats = {
          totalLogs: stats.totalLogs || 0,
          todayLogs: stats.todayLogs || 0,
          securityEvents: stats.securityEvents || 0,
          errorCount: stats.errorCount || 0
        };
      },
      error: (err) => {
        console.error('Error loading log stats:', err);
      }
    });
  }

  refreshLogs(): void {
    this.loadLogs();
    this.snackBar.open('Logs refreshed', 'Close', { duration: 2000 });
  }

  filterLogs(): void {
    this.logsPageIndex = 0;
    this.loadLogs();
  }

  updatePaginatedLogs(): void {
    const start = this.logsPageIndex * this.logsPageSize;
    const end = start + this.logsPageSize;
    this.paginatedLogs = this.logs.slice(start, end);
  }

  onLogsPageChange(event: PageEvent): void {
    this.logsPageIndex = event.pageIndex;
    this.logsPageSize = event.pageSize;
    this.updatePaginatedLogs();
  }

  exportLogs(): void {
    this.snackBar.open('Exporting logs...', '', { duration: 2000 });
    
    // Build filter based on current settings
    let filter: any = {};
    if (this.logCategoryFilter !== 'all') {
      filter.category = this.logCategoryFilter;
    }
    if (this.logDateFilter !== 'all') {
      const now = new Date();
      switch (this.logDateFilter) {
        case 'today':
          filter.startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          filter.startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          filter.startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    this.logsService.exportLogs(filter).subscribe({
      next: (logs) => {
        // Convert logs to CSV format
        const headers = ['Timestamp', 'Action', 'Category', 'Description', 'User', 'Role', 'IP Address', 'Severity', 'Success'];
        const csvRows = [headers.join(',')];
        
        logs.forEach(log => {
          const row = [
            new Date(log.timestamp).toISOString(),
            `"${log.action.replace(/"/g, '""')}"`,
            log.category,
            `"${(log.description || '').replace(/"/g, '""')}"`,
            `"${(log.userName || '').replace(/"/g, '""')}"`,
            log.userRole || '',
            log.ipAddress || '',
            log.severity,
            log.isSuccess ? 'Yes' : 'No'
          ];
          csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.snackBar.open('Logs exported successfully', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Error exporting logs:', err);
        this.snackBar.open('Failed to export logs', 'Close', { duration: 3000 });
      }
    });
  }

  getCategoryIcon(category: string): string {
    return this.logsService.getCategoryIcon(category);
  }

  getCategoryColor(category: string): string {
    return this.logsService.getCategoryColor(category);
  }

  // Settings Methods
  saveSettings(): void {
    this.snackBar.open('Settings saved', 'Close', { duration: 2000 });
    this.logAction('Settings Updated', 'settings', 'System settings were updated');
  }

  // Helper Methods
  logAction(action: string, category: 'user' | 'announcement' | 'settings' | 'security' | 'system', description: string): void {
    this.logsService.addLog({
      action,
      category,
      description,
      entityType: 'System',
      severity: 'info',
      isSuccess: true
    }).subscribe();
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
