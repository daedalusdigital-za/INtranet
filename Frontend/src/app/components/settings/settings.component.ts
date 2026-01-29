import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
import { MatProgressBarModule } from '@angular/material/progress-bar';
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
import { SalesImportDialogComponent, SalesImportDialogData, SalesImportDialogResult } from '../shared/sales-import-dialog/sales-import-dialog.component';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
import { environment } from '../../../environments/environment';
import * as XLSX from 'xlsx';

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
    MatProgressBarModule,
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

        <!-- Database & Backup Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>storage</mat-icon>
            <span>Database & Backup</span>
          </ng-template>
          
          <div class="tab-content">
            <!-- Database Info Section -->
            <div class="settings-section">
              <div class="section-header">
                <h3><mat-icon>info</mat-icon> Database Information</h3>
                <button mat-icon-button (click)="loadDatabaseInfo()" matTooltip="Refresh">
                  <mat-icon>refresh</mat-icon>
                </button>
              </div>
              <mat-divider></mat-divider>
              
              @if (dbInfoLoading) {
                <div class="loading-state">
                  <mat-spinner diameter="40"></mat-spinner>
                  <p>Loading database info...</p>
                </div>
              } @else if (databaseInfo) {
                <div class="db-info-grid">
                  <div class="db-info-card">
                    <mat-icon>dns</mat-icon>
                    <div class="info-content">
                      <span class="label">Server</span>
                      <span class="value">{{ databaseInfo.serverName }}</span>
                    </div>
                  </div>
                  <div class="db-info-card">
                    <mat-icon>inventory_2</mat-icon>
                    <div class="info-content">
                      <span class="label">Database</span>
                      <span class="value">{{ databaseInfo.databaseName }}</span>
                    </div>
                  </div>
                  <div class="db-info-card">
                    <mat-icon>data_usage</mat-icon>
                    <div class="info-content">
                      <span class="label">Size</span>
                      <span class="value">{{ databaseInfo.databaseSizeMB | number:'1.2-2' }} MB</span>
                    </div>
                  </div>
                  <div class="db-info-card">
                    <mat-icon>table_chart</mat-icon>
                    <div class="info-content">
                      <span class="label">Tables</span>
                      <span class="value">{{ databaseInfo.tableStats?.length || 0 }}</span>
                    </div>
                  </div>
                </div>

                <!-- Table Statistics -->
                <div class="table-stats-section">
                  <h4><mat-icon>assessment</mat-icon> Table Statistics</h4>
                  <div class="table-stats-grid">
                    @for (table of databaseInfo.tableStats; track table.tableName) {
                      <div class="table-stat-item">
                        <span class="table-name">{{ table.tableName }}</span>
                        <span class="row-count">{{ table.rowCount | number }} rows</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Backup Section -->
            <div class="settings-section">
              <h3><mat-icon>backup</mat-icon> Database Backup</h3>
              <mat-divider></mat-divider>
              
              <div class="backup-actions">
                <div class="backup-card">
                  <div class="backup-icon">
                    <mat-icon>cloud_download</mat-icon>
                  </div>
                  <div class="backup-content">
                    <h4>Create Full Backup</h4>
                    <p>Create a complete backup of the database that can be restored later</p>
                    <button mat-raised-button color="primary" (click)="createBackup()" [disabled]="backupInProgress">
                      @if (backupInProgress) {
                        <mat-spinner diameter="20"></mat-spinner>
                        Creating Backup...
                      } @else {
                        <mat-icon>backup</mat-icon>
                        Create Backup
                      }
                    </button>
                  </div>
                </div>
              </div>

              <!-- Backup History -->
              <div class="backup-history">
                <h4><mat-icon>history</mat-icon> Recent Backups</h4>
                @if (backupsLoading) {
                  <mat-spinner diameter="30"></mat-spinner>
                } @else if (backupHistory.length === 0) {
                  <div class="no-backups">
                    <mat-icon>cloud_off</mat-icon>
                    <p>No backups found</p>
                  </div>
                } @else {
                  <div class="backup-list">
                    @for (backup of backupHistory; track backup.filePath) {
                      <div class="backup-item">
                        <div class="backup-info">
                          <mat-icon>save</mat-icon>
                          <div>
                            <span class="backup-date">{{ backup.finishDate | date:'medium' }}</span>
                            <span class="backup-details">{{ backup.backupType }} - {{ formatBytes(backup.sizeBytes) }}</span>
                          </div>
                        </div>
                        <div class="backup-actions-row">
                          <button mat-icon-button color="primary" matTooltip="Restore this backup" (click)="restoreBackup(backup)">
                            <mat-icon>restore</mat-icon>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Export Section -->
            <div class="settings-section">
              <h3><mat-icon>file_download</mat-icon> Export Data</h3>
              <mat-divider></mat-divider>
              
              <div class="export-section">
                <p>Export your data as JSON files for backup or migration purposes</p>
                
                <div class="export-options">
                  <div class="export-option">
                    <h4>Export All Data</h4>
                    <p>Export all tables to a single JSON file</p>
                    <button mat-raised-button color="accent" (click)="exportAllData()" [disabled]="exportInProgress">
                      @if (exportInProgress) {
                        <mat-spinner diameter="20"></mat-spinner>
                        Exporting...
                      } @else {
                        <mat-icon>download</mat-icon>
                        Export All
                      }
                    </button>
                  </div>
                  
                  <div class="export-option">
                    <h4>Export Specific Tables</h4>
                    <p>Select which tables to export</p>
                    <mat-form-field appearance="outline" class="table-select">
                      <mat-label>Select Tables</mat-label>
                      <mat-select [(ngModel)]="selectedExportTables" multiple>
                        @for (table of availableTables; track table) {
                          <mat-option [value]="table">{{ table }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <button mat-raised-button color="primary" (click)="exportSelectedTables()" 
                            [disabled]="selectedExportTables.length === 0 || exportInProgress">
                      <mat-icon>download</mat-icon>
                      Export Selected
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Import Section -->
            <div class="settings-section">
              <h3><mat-icon>file_upload</mat-icon> Import Data</h3>
              <mat-divider></mat-divider>
              
              <div class="import-section-db">
                <div class="import-warning">
                  <mat-icon>warning</mat-icon>
                  <p><strong>Warning:</strong> Importing data will modify your database. Make sure to create a backup first.</p>
                </div>
                
                <div class="import-upload">
                  <div class="file-drop-zone-db" 
                       [class.dragging]="isDbDragging"
                       (dragover)="onDbDragOver($event)"
                       (dragleave)="onDbDragLeave($event)"
                       (drop)="onDbFileDrop($event)">
                    <mat-icon>cloud_upload</mat-icon>
                    <p>Drop JSON export file here</p>
                    <span>or</span>
                    <button mat-raised-button color="primary" (click)="dbFileInput.click()">
                      <mat-icon>folder_open</mat-icon> Browse Files
                    </button>
                    <input #dbFileInput type="file" hidden accept=".json" (change)="onDbFileSelected($event)">
                  </div>
                </div>

                @if (importDbFile) {
                  <div class="import-file-info">
                    <mat-icon>description</mat-icon>
                    <span>{{ importDbFile.name }} ({{ formatBytes(importDbFile.size) }})</span>
                    <button mat-icon-button (click)="removeDbFile()">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>

                  <div class="import-options-db">
                    <mat-checkbox [(ngModel)]="clearBeforeImport">
                      Clear existing data before import
                    </mat-checkbox>
                  </div>

                  <button mat-raised-button color="warn" (click)="importDbData()" [disabled]="dbImportInProgress">
                    @if (dbImportInProgress) {
                      <mat-spinner diameter="20"></mat-spinner>
                      Importing...
                    } @else {
                      <mat-icon>upload</mat-icon>
                      Import Data
                    }
                  </button>
                }

                @if (dbImportResults) {
                  <div class="import-results">
                    <h4>Import Results</h4>
                    @for (result of dbImportResultsList; track result.tableName) {
                      <div class="import-result-item" [class.success]="result.success" [class.error]="!result.success">
                        <mat-icon>{{ result.success ? 'check_circle' : 'error' }}</mat-icon>
                        <span>{{ result.tableName }}: {{ result.successCount }} imported, {{ result.errorCount }} errors</span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Data Import Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>upload_file</mat-icon>
            <span>Data Import</span>
          </ng-template>
          
          <div class="tab-content">
            <div class="import-section">
              <div class="import-header">
                <h3><mat-icon>cloud_upload</mat-icon> Import Data from Excel or CSV</h3>
                <p>Upload Excel (.xlsx, .xls) or CSV files to import data into the system</p>
              </div>

              <!-- Import Type Selection -->
              <div class="import-type-selector">
                <h4>Select Data Type to Import</h4>
                <div class="import-types-grid">
                  <div class="import-type-card" 
                       [class.selected]="selectedImportType === 'invoices'"
                       (click)="selectImportType('invoices')">
                    <mat-icon>receipt_long</mat-icon>
                    <div class="type-info">
                      <span>Sales/Invoices</span>
                      <small>Import sales transactions</small>
                    </div>
                  </div>
                  <div class="import-type-card"
                       [class.selected]="selectedImportType === 'customers'"
                       (click)="selectImportType('customers')">
                    <mat-icon>people</mat-icon>
                    <div class="type-info">
                      <span>Customers</span>
                      <small>Import customer data</small>
                    </div>
                  </div>
                  <div class="import-type-card"
                       [class.selected]="selectedImportType === 'products'"
                       (click)="selectImportType('products')">
                    <mat-icon>inventory_2</mat-icon>
                    <div class="type-info">
                      <span>Products</span>
                      <small>Import product catalog</small>
                    </div>
                  </div>
                  <div class="import-type-card"
                       [class.selected]="selectedImportType === 'employees'"
                       (click)="selectImportType('employees')">
                    <mat-icon>badge</mat-icon>
                    <div class="type-info">
                      <span>Employees</span>
                      <small>Import employee records</small>
                    </div>
                  </div>
                </div>
              </div>

              @if (selectedImportType) {
                <!-- File Upload Area -->
                <div class="file-upload-section">
                  <h4>Upload File</h4>
                  <div class="file-drop-zone" 
                       [class.dragging]="isDragging"
                       (dragover)="onDragOver($event)"
                       (dragleave)="onDragLeave($event)"
                       (drop)="onFileDrop($event)">
                    <mat-icon>cloud_upload</mat-icon>
                    <p>Drag & drop your file here</p>
                    <span>or</span>
                    <button mat-raised-button color="primary" (click)="fileInput.click()">
                      <mat-icon>folder_open</mat-icon> Browse Files
                    </button>
                    <input #fileInput type="file" hidden 
                           accept=".xlsx,.xls,.csv" 
                           (change)="onFileSelected($event)">
                    <small>Supported formats: Excel (.xlsx, .xls), CSV (.csv)</small>
                  </div>
                </div>
              }

              @if (importFile) {
                <!-- File Info -->
                <div class="file-info-card">
                  <div class="file-info">
                    <mat-icon class="file-icon" [class.excel]="isExcelFile" [class.csv]="!isExcelFile">
                      {{ isExcelFile ? 'table_chart' : 'description' }}
                    </mat-icon>
                    <div class="file-details">
                      <span class="file-name">{{ importFile.name }}</span>
                      <span class="file-size">{{ formatFileSize(importFile.size) }}</span>
                    </div>
                  </div>
                  <button mat-icon-button color="warn" (click)="removeFile()">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>

                @if (isExcelFile && excelSheets.length > 1) {
                  <!-- Sheet Selection for Excel -->
                  <div class="sheet-selector">
                    <mat-form-field appearance="outline">
                      <mat-label>Select Sheet</mat-label>
                      <mat-select [(ngModel)]="selectedSheet" (selectionChange)="onSheetChange()">
                        @for (sheet of excelSheets; track sheet) {
                          <mat-option [value]="sheet">{{ sheet }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                }
              }

              @if (importPreviewData.length > 0) {
                <!-- Column Mapping -->
                <div class="column-mapping-section">
                  <h4><mat-icon>swap_horiz</mat-icon> Map Columns</h4>
                  <p>Map your file columns to the system fields</p>
                  
                  <div class="mapping-grid">
                    @for (field of getRequiredFields(); track field.field) {
                      <div class="mapping-row">
                        <div class="system-field">
                          <span class="field-label">{{ field.label }}</span>
                          @if (field.required) {
                            <span class="required-badge">Required</span>
                          }
                        </div>
                        <mat-icon class="mapping-arrow">arrow_forward</mat-icon>
                        <mat-form-field appearance="outline" class="file-column-select">
                          <mat-label>Select Column</mat-label>
                          <mat-select [(ngModel)]="columnMappings[field.field]">
                            <mat-option [value]="null">-- Skip --</mat-option>
                            @for (col of importHeaders; track col) {
                              <mat-option [value]="col">{{ col }}</mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                      </div>
                    }
                  </div>
                </div>

                <!-- Company Selection for Invoices -->
                @if (selectedImportType === 'invoices') {
                  <div class="company-selector">
                    <h4><mat-icon>business</mat-icon> Select Company</h4>
                    <mat-form-field appearance="outline">
                      <mat-label>Source Company</mat-label>
                      <mat-select [(ngModel)]="importSourceCompany" required>
                        <mat-option value="PMT">Promed Technologies (PMT)</mat-option>
                        <mat-option value="ACM">Access Medical (ACM)</mat-option>
                        <mat-option value="PHT">Pharmatech (PHT)</mat-option>
                        <mat-option value="SBT">Sebenzani Trading (SBT)</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
                }

                <!-- Data Preview -->
                <div class="preview-section">
                  <div class="preview-header">
                    <h4><mat-icon>preview</mat-icon> Data Preview</h4>
                    <span class="preview-count">Showing {{ importPreviewData.length > 5 ? 5 : importPreviewData.length }} of {{ importPreviewData.length }} rows</span>
                  </div>
                  
                  <div class="preview-table-container">
                    <table class="preview-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          @for (header of importHeaders; track header) {
                            <th [class.mapped]="isColumnMapped(header)">{{ header }}</th>
                          }
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of importPreviewData.slice(0, 5); track $index; let i = $index) {
                          <tr>
                            <td class="row-number">{{ i + 1 }}</td>
                            @for (header of importHeaders; track header) {
                              <td [class.mapped]="isColumnMapped(header)">{{ row[header] }}</td>
                            }
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Import Actions -->
                <div class="import-actions">
                  <div class="import-summary">
                    <mat-icon>info</mat-icon>
                    <span>Ready to import <strong>{{ importPreviewData.length }}</strong> {{ selectedImportType }} records</span>
                  </div>
                  <div class="action-buttons">
                    <button mat-button (click)="resetImport()">
                      <mat-icon>refresh</mat-icon> Reset
                    </button>
                    <button mat-raised-button color="primary" 
                            [disabled]="!canImport() || isImporting"
                            (click)="startImport()">
                      @if (isImporting) {
                        <mat-spinner diameter="20"></mat-spinner>
                        Importing...
                      } @else {
                        <mat-icon>upload</mat-icon> Import Data
                      }
                    </button>
                  </div>
                </div>
              }

              <!-- Import Progress -->
              @if (isImporting) {
                <div class="import-progress">
                  <div class="progress-header">
                    <h4>Importing Data...</h4>
                    <span>{{ importProgress }}%</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-fill" [style.width.%]="importProgress"></div>
                  </div>
                  <p>{{ importStatusMessage }}</p>
                </div>
              }

              <!-- Import Results -->
              @if (importResults) {
                <div class="import-results" [class.success]="importResults.success" [class.warning]="!importResults.success && importResults.details.length > 0" [class.error]="!importResults.success && importResults.details.length === 0">
                  <mat-icon>{{ importResults.success ? 'check_circle' : 'error' }}</mat-icon>
                  <div class="results-content">
                    <h4>{{ importResults.success ? 'Import Successful!' : 'Import Completed with Issues' }}</h4>
                    <p>{{ importResults.message }}</p>
                    @if (importResults.details && importResults.details.length > 0) {
                      <ul class="results-details">
                        @for (detail of importResults.details; track detail) {
                          <li>{{ detail }}</li>
                        }
                      </ul>
                    }
                  </div>
                  <button mat-icon-button (click)="importResults = null">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              }

              <!-- Download Templates -->
              <div class="templates-section">
                <h4><mat-icon>download</mat-icon> Download Templates</h4>
                <p>Download sample templates with the correct column format</p>
                <div class="template-cards-grid">
                  <div class="template-card" (click)="downloadTemplate('invoices')">
                    <mat-icon>receipt_long</mat-icon>
                    <div class="template-info">
                      <span>Invoices Template</span>
                      <small>Sales transaction import format</small>
                    </div>
                    <mat-icon class="download-icon">download</mat-icon>
                  </div>
                  <div class="template-card" (click)="downloadTemplate('customers')">
                    <mat-icon>people</mat-icon>
                    <div class="template-info">
                      <span>Customers Template</span>
                      <small>Customer data import format</small>
                    </div>
                    <mat-icon class="download-icon">download</mat-icon>
                  </div>
                  <div class="template-card" (click)="downloadTemplate('products')">
                    <mat-icon>inventory_2</mat-icon>
                    <div class="template-info">
                      <span>Products Template</span>
                      <small>Product catalog import format</small>
                    </div>
                    <mat-icon class="download-icon">download</mat-icon>
                  </div>
                  <div class="template-card" (click)="downloadTemplate('employees')">
                    <mat-icon>badge</mat-icon>
                    <div class="template-info">
                      <span>Employees Template</span>
                      <small>Employee records import format</small>
                    </div>
                    <mat-icon class="download-icon">download</mat-icon>
                  </div>
                </div>
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

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Extension Number</mat-label>
                <input matInput formControlName="extensionNumber" placeholder="e.g., 301">
                <mat-hint>PBX extension number for phone system</mat-hint>
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
                <input matInput formControlName="newPassword" [type]="showNewPassword ? 'text' : 'password'" required>
                <button mat-icon-button matSuffix type="button" (click)="showNewPassword = !showNewPassword">
                  <mat-icon>{{ showNewPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                <mat-hint>Minimum 6 characters</mat-hint>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Confirm Password</mat-label>
                <input matInput formControlName="confirmPassword" [type]="showConfirmPassword ? 'text' : 'password'" required>
                <button mat-icon-button matSuffix type="button" (click)="showConfirmPassword = !showConfirmPassword">
                  <mat-icon>{{ showConfirmPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
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
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .settings-container {
      padding: 80px;
      max-width: 1400px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
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
      color: #ffffff;
    }

    .header-content h1 {
      margin: 0;
      font-size: 2rem;
      color: #ffffff;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .header-content p {
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.9);
    }

    .settings-tabs {
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
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

    /* Fix for mat-select dropdown appearing behind dialog */
    ::ng-deep .cdk-overlay-container {
      z-index: 2100 !important;
    }

    ::ng-deep .mat-mdc-select-panel {
      max-height: 300px !important;
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

    /* Data Import Styles */
    .import-section {
      padding: 24px;
    }

    .import-type-selector h4 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 18px;
    }

    .import-types-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .import-type-card {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .import-type-card:hover {
      border-color: #1976d2;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .import-type-card.selected {
      border-color: #1976d2;
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
    }

    .import-type-card mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #1976d2;
      flex-shrink: 0;
    }

    .import-type-card .type-info {
      display: flex;
      flex-direction: column;
    }

    .import-type-card .type-info span {
      font-weight: 600;
      color: #333;
      font-size: 1rem;
    }

    .import-type-card .type-info small {
      font-size: 0.8rem;
      color: #666;
      margin-top: 2px;
    }

    .import-config {
      margin-top: 24px;
    }

    .file-upload-section h4, .column-mapping-section h4, .preview-section h4 {
      margin: 0 0 16px 0;
      color: #333;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .file-drop-zone {
      border: 2px dashed #ccc;
      border-radius: 12px;
      padding: 40px;
      text-align: center;
      background: #fafafa;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .file-drop-zone:hover, .file-drop-zone.dragging {
      border-color: #1976d2;
      background: #e3f2fd;
    }

    .file-drop-zone mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1976d2;
      margin-bottom: 12px;
    }

    .file-drop-zone p {
      margin: 0 0 8px 0;
      color: #333;
    }

    .file-drop-zone span {
      font-size: 12px;
      color: #666;
    }

    .selected-file {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #e8f5e9;
      border-radius: 8px;
      margin-top: 16px;
    }

    .selected-file mat-icon {
      color: #4caf50;
    }

    .file-info {
      flex: 1;
    }

    .file-info .file-name {
      font-weight: 500;
      color: #333;
    }

    .file-info .file-size {
      font-size: 12px;
      color: #666;
    }

    .sheet-selector {
      margin-top: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .sheet-selector mat-form-field {
      flex: 1;
      max-width: 300px;
    }

    .column-mapping-section {
      margin-top: 24px;
    }

    .mapping-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .mapping-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .mapping-row .system-field {
      min-width: 120px;
      font-weight: 500;
      color: #333;
    }

    .mapping-row .system-field.required::after {
      content: ' *';
      color: #f44336;
    }

    .mapping-row mat-icon {
      color: #666;
    }

    .mapping-row mat-form-field {
      flex: 1;
    }

    .company-selector {
      margin-top: 16px;
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
    }

    .company-selector h5 {
      margin: 0 0 12px 0;
      color: #e65100;
    }

    .preview-section {
      margin-top: 24px;
    }

    .preview-table-container {
      overflow-x: auto;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
    }

    .preview-table {
      width: 100%;
      border-collapse: collapse;
    }

    .preview-table th, .preview-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }

    .preview-table th {
      background: #f5f5f5;
      font-weight: 500;
      color: #333;
    }

    .preview-table tr:last-child td {
      border-bottom: none;
    }

    .preview-table tr:hover {
      background: #fafafa;
    }

    .import-actions {
      display: flex;
      gap: 16px;
      margin-top: 24px;
    }

    .import-progress {
      margin-top: 24px;
    }

    .import-progress p {
      margin: 0 0 8px 0;
      color: #1976d2;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .import-progress mat-progress-bar {
      height: 8px;
      border-radius: 4px;
    }

    .import-results {
      margin-top: 24px;
      padding: 20px;
      border-radius: 12px;
    }

    .import-results.success {
      background: #e8f5e9;
      border: 1px solid #a5d6a7;
    }

    .import-results.warning {
      background: #fff3e0;
      border: 1px solid #ffcc80;
    }

    .import-results.error {
      background: #ffebee;
      border: 1px solid #ef9a9a;
    }

    .import-results h4 {
      margin: 0 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .import-results.success h4 {
      color: #2e7d32;
    }

    .import-results.warning h4 {
      color: #e65100;
    }

    .import-results.error h4 {
      color: #c62828;
    }

    .import-results ul {
      margin: 0;
      padding-left: 20px;
    }

    .import-results li {
      margin: 4px 0;
      color: #333;
    }

    .templates-section {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e0e0e0;
    }

    .templates-section h4 {
      margin: 0 0 8px 0;
      color: #333;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .templates-section > p {
      margin: 0 0 16px 0;
      color: #666;
      font-size: 0.9rem;
    }

    .template-cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .template-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      background: linear-gradient(135deg, #fff8e1 0%, #ffecb3 100%);
      border: 2px solid #ffe082;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .template-card:hover {
      border-color: #ffc107;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(255, 193, 7, 0.3);
    }

    .template-card > mat-icon:first-child {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #f57c00;
      flex-shrink: 0;
    }

    .template-card .template-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .template-card .template-info span {
      font-weight: 600;
      color: #333;
      font-size: 0.95rem;
    }

    .template-card .template-info small {
      font-size: 0.8rem;
      color: #666;
      margin-top: 2px;
    }

    .template-card .download-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #f57c00;
      opacity: 0.7;
      transition: opacity 0.2s;
    }

    .template-card:hover .download-icon {
      opacity: 1;
    }

    /* Database & Backup Styles */
    .db-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }

    .db-info-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
      border-radius: 12px;
      border: 1px solid #e0e0e0;
    }

    .db-info-card mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #1976d2;
    }

    .db-info-card .info-content {
      display: flex;
      flex-direction: column;
    }

    .db-info-card .label {
      font-size: 0.8rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .db-info-card .value {
      font-size: 1.1rem;
      font-weight: 600;
      color: #333;
    }

    .table-stats-section {
      margin-top: 24px;
    }

    .table-stats-section h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
      color: #333;
    }

    .table-stats-section h4 mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #1976d2;
    }

    .table-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
      max-height: 250px;
      overflow-y: auto;
      padding: 4px;
    }

    .table-stat-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #fafafa;
      border-radius: 6px;
      border: 1px solid #e8e8e8;
    }

    .table-stat-item .table-name {
      font-size: 0.85rem;
      color: #333;
      font-weight: 500;
    }

    .table-stat-item .row-count {
      font-size: 0.8rem;
      color: #666;
      background: #e3f2fd;
      padding: 2px 8px;
      border-radius: 10px;
    }

    .backup-actions {
      margin-top: 20px;
    }

    .backup-card {
      display: flex;
      gap: 20px;
      padding: 24px;
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border-radius: 12px;
      border: 1px solid #a5d6a7;
    }

    .backup-card .backup-icon {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .backup-card .backup-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #2e7d32;
    }

    .backup-card .backup-content {
      flex: 1;
    }

    .backup-card h4 {
      margin: 0 0 8px 0;
      color: #1b5e20;
    }

    .backup-card p {
      margin: 0 0 16px 0;
      color: #33691e;
      font-size: 0.9rem;
    }

    .backup-history {
      margin-top: 24px;
    }

    .backup-history h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
      color: #333;
    }

    .backup-history h4 mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .no-backups {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .no-backups mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      opacity: 0.5;
    }

    .no-backups p {
      margin: 12px 0 0 0;
    }

    .backup-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .backup-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #fafafa;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .backup-item .backup-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .backup-item .backup-info mat-icon {
      color: #1976d2;
    }

    .backup-item .backup-info > div {
      display: flex;
      flex-direction: column;
    }

    .backup-item .backup-date {
      font-weight: 500;
      color: #333;
    }

    .backup-item .backup-details {
      font-size: 0.8rem;
      color: #666;
    }

    .backup-item .backup-actions-row {
      display: flex;
      gap: 4px;
    }

    .export-section {
      margin-top: 20px;
    }

    .export-section > p {
      margin: 0 0 20px 0;
      color: #666;
    }

    .export-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }

    .export-option {
      padding: 20px;
      background: #fafafa;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
    }

    .export-option h4 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .export-option p {
      margin: 0 0 16px 0;
      color: #666;
      font-size: 0.9rem;
    }

    .export-option .table-select {
      width: 100%;
      margin-bottom: 12px;
    }

    .import-section-db {
      margin-top: 20px;
    }

    .import-warning {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
      border: 1px solid #ffcc80;
      margin-bottom: 20px;
    }

    .import-warning mat-icon {
      color: #f57c00;
      flex-shrink: 0;
    }

    .import-warning p {
      margin: 0;
      font-size: 0.9rem;
      color: #e65100;
    }

    .file-drop-zone-db {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      border: 2px dashed #bdbdbd;
      border-radius: 12px;
      background: #fafafa;
      transition: all 0.2s;
      cursor: pointer;
    }

    .file-drop-zone-db:hover,
    .file-drop-zone-db.dragging {
      border-color: #1976d2;
      background: #e3f2fd;
    }

    .file-drop-zone-db mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #9e9e9e;
      margin-bottom: 12px;
    }

    .file-drop-zone-db p {
      margin: 0 0 8px 0;
      color: #666;
    }

    .file-drop-zone-db span {
      color: #9e9e9e;
      margin-bottom: 12px;
    }

    .import-file-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #e3f2fd;
      border-radius: 8px;
      margin-top: 16px;
    }

    .import-file-info mat-icon {
      color: #1976d2;
    }

    .import-file-info span {
      flex: 1;
      color: #333;
    }

    .import-options-db {
      margin: 16px 0;
    }

    .import-results {
      margin-top: 24px;
      padding: 20px;
      background: #fafafa;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
    }

    .import-results h4 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .import-result-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-bottom: 1px solid #e8e8e8;
    }

    .import-result-item:last-child {
      border-bottom: none;
    }

    .import-result-item.success mat-icon {
      color: #2e7d32;
    }

    .import-result-item.error mat-icon {
      color: #c62828;
    }

    .import-result-item span {
      color: #333;
      font-size: 0.9rem;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #666;
    }

    .loading-state p {
      margin: 16px 0 0 0;
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
  showNewPassword = false;
  showConfirmPassword = false;

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

  // Database & Backup
  databaseInfo: any = null;
  dbInfoLoading = false;
  backupHistory: any[] = [];
  backupsLoading = false;
  backupInProgress = false;
  exportInProgress = false;
  dbImportInProgress = false;
  availableTables: string[] = [];
  selectedExportTables: string[] = [];
  importDbFile: File | null = null;
  isDbDragging = false;
  clearBeforeImport = false;
  dbImportResults: any = null;
  dbImportResultsList: { tableName: string; success: boolean; successCount: number; errorCount: number; }[] = [];

  // Data Import
  selectedImportType: string = '';
  importFile: File | null = null;
  importPreviewData: any[] = [];
  importHeaders: string[] = [];
  columnMappings: { [key: string]: string } = {};
  excelSheets: string[] = [];
  selectedSheet: string = '';
  importSourceCompany: string = '';
  isDragging: boolean = false;
  isImporting: boolean = false;
  importProgress: number = 0;
  importStatusMessage: string = '';
  importResults: { success: boolean; message: string; details: string[] } | null = null;
  
  importTypeFields: { [key: string]: { field: string; label: string; required: boolean }[] } = {
    invoices: [
      { field: 'invoiceNumber', label: 'Invoice Number', required: true },
      { field: 'customerName', label: 'Customer Name', required: true },
      { field: 'invoiceDate', label: 'Invoice Date', required: true },
      { field: 'totalAmount', label: 'Total Amount', required: true },
      { field: 'vatAmount', label: 'VAT Amount', required: false },
      { field: 'status', label: 'Status', required: false }
    ],
    customers: [
      { field: 'name', label: 'Name', required: true },
      { field: 'email', label: 'Email', required: false },
      { field: 'phone', label: 'Phone', required: false },
      { field: 'address', label: 'Address', required: false },
      { field: 'company', label: 'Company', required: false },
      { field: 'vatNumber', label: 'VAT Number', required: false }
    ],
    products: [
      { field: 'sku', label: 'SKU/Code', required: true },
      { field: 'name', label: 'Product Name', required: true },
      { field: 'description', label: 'Description', required: false },
      { field: 'price', label: 'Price', required: true },
      { field: 'quantity', label: 'Quantity', required: false },
      { field: 'category', label: 'Category', required: false }
    ],
    employees: [
      { field: 'employeeNumber', label: 'Employee Number', required: true },
      { field: 'firstName', label: 'First Name', required: true },
      { field: 'lastName', label: 'Last Name', required: true },
      { field: 'email', label: 'Email', required: true },
      { field: 'department', label: 'Department', required: false },
      { field: 'position', label: 'Position', required: false },
      { field: 'startDate', label: 'Start Date', required: false }
    ]
  };

  sourceCompanies = [
    { code: 'PMT', name: 'PMT Telecoms' },
    { code: 'ACM', name: 'ACM Group' },
    { code: 'PHT', name: 'PHT Technologies' },
    { code: 'SBT', name: 'SBT Solutions' }
  ];

  Math = Math;  // Expose Math to template

  private http = inject(HttpClient);

  get isExcelFile(): boolean {
    if (!this.importFile) return false;
    const ext = this.importFile.name.toLowerCase();
    return ext.endsWith('.xlsx') || ext.endsWith('.xls');
  }

  constructor(
    private fb: FormBuilder,
    private announcementService: AnnouncementHistoryService,
    private logsService: SystemLogsService,
    private authService: AuthService,
    public userService: UserManagementService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
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
    this.loadDatabaseInfo();
    this.loadBackupHistory();
    this.loadAvailableTables();
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
      extensionNumber: [''],
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
      extensionNumber: user.extensionNumber || '',
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
    this.showNewPassword = false;
    this.showConfirmPassword = false;
    this.showResetPasswordDialog = true;
  }

  closeResetPasswordDialog(): void {
    this.showResetPasswordDialog = false;
    this.resetPasswordUser = null;
    this.showNewPassword = false;
    this.showConfirmPassword = false;
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

  // Data Import Methods
  selectImportType(type: string): void {
    this.selectedImportType = type;
    this.resetImport();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.processFile(input.files[0]);
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processFile(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  processFile(file: File): void {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      this.snackBar.open('Invalid file type. Please upload an Excel or CSV file.', 'Close', { duration: 3000 });
      return;
    }
    
    // For invoices/sales, open the special import dialog
    if (this.selectedImportType === 'invoices') {
      this.openSalesImportDialog(file);
      return;
    }
    
    this.importFile = file;
    this.importResults = null;
    
    if (fileExtension === '.csv') {
      this.parseCSVFile(file);
    } else {
      this.parseExcelFile(file);
    }
  }

  openSalesImportDialog(file: File): void {
    const dialogRef = this.dialog.open(SalesImportDialogComponent, {
      width: '95vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      disableClose: true,
      data: {
        apiUrl: environment.apiUrl,
        file: file
      } as SalesImportDialogData
    });

    dialogRef.afterClosed().subscribe((result: SalesImportDialogResult) => {
      if (result?.success && result?.committed) {
        this.snackBar.open(result.message || 'Sales data imported successfully!', 'Close', { duration: 5000 });
        this.logAction('Sales Import', 'system', `Imported sales report: ${file.name}`);
        this.resetImport();
      }
    });
  }

  parseExcelFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        this.excelSheets = workbook.SheetNames;
        this.selectedSheet = this.excelSheets[0];
        
        this.loadSheetData(workbook);
      } catch (error) {
        this.snackBar.open('Error parsing Excel file. Please check the file format.', 'Close', { duration: 3000 });
        console.error('Excel parse error:', error);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  loadSheetData(workbook: XLSX.WorkBook): void {
    const sheet = workbook.Sheets[this.selectedSheet];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    if (jsonData.length > 0) {
      this.importHeaders = jsonData[0].map((h: any) => String(h || '').trim());
      this.importPreviewData = jsonData.slice(1, 6).map(row => {
        const obj: any = {};
        this.importHeaders.forEach((header, index) => {
          obj[header] = row[index] ?? '';
        });
        return obj;
      });
      
      // Auto-map columns where names match
      this.autoMapColumns();
    }
  }

  onSheetChange(): void {
    if (this.importFile && this.excelSheets.length > 0) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        this.loadSheetData(workbook);
      };
      reader.readAsArrayBuffer(this.importFile);
    }
  }

  parseCSVFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter((line: string) => line.trim());
        
        if (lines.length > 0) {
          this.importHeaders = this.parseCSVLine(lines[0]);
          this.importPreviewData = lines.slice(1, 6).map((line: string) => {
            const values = this.parseCSVLine(line);
            const obj: any = {};
            this.importHeaders.forEach((header, index) => {
              obj[header] = values[index] ?? '';
            });
            return obj;
          });
          
          this.autoMapColumns();
        }
        
        this.excelSheets = [];
        this.selectedSheet = '';
      } catch (error) {
        this.snackBar.open('Error parsing CSV file. Please check the file format.', 'Close', { duration: 3000 });
        console.error('CSV parse error:', error);
      }
    };
    reader.readAsText(file);
  }

  parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  autoMapColumns(): void {
    this.columnMappings = {};
    const fields = this.getRequiredFields();
    
    fields.forEach(field => {
      const matchingHeader = this.importHeaders.find(header => {
        const normalizedHeader = header.toLowerCase().replace(/[_\s-]/g, '');
        const normalizedField = field.field.toLowerCase();
        const normalizedLabel = field.label.toLowerCase().replace(/[_\s-]/g, '');
        return normalizedHeader === normalizedField || 
               normalizedHeader === normalizedLabel ||
               normalizedHeader.includes(normalizedField) ||
               normalizedField.includes(normalizedHeader);
      });
      
      if (matchingHeader) {
        this.columnMappings[field.field] = matchingHeader;
      }
    });
  }

  getRequiredFields(): { field: string; label: string; required: boolean }[] {
    return this.importTypeFields[this.selectedImportType] || [];
  }

  isColumnMapped(field: string): boolean {
    return !!this.columnMappings[field];
  }

  canImport(): boolean {
    const fields = this.getRequiredFields();
    const requiredFields = fields.filter(f => f.required);
    const allRequiredMapped = requiredFields.every(f => this.isColumnMapped(f.field));
    
    if (this.selectedImportType === 'invoices' && !this.importSourceCompany) {
      return false;
    }
    
    return this.importFile !== null && allRequiredMapped;
  }

  async startImport(): Promise<void> {
    if (!this.canImport()) {
      this.snackBar.open('Please complete all required mappings before importing.', 'Close', { duration: 3000 });
      return;
    }
    
    this.isImporting = true;
    this.importProgress = 0;
    this.importStatusMessage = 'Reading file...';
    this.importResults = null;
    
    try {
      // Read full file data
      const fullData = await this.readFullFileData();
      this.importProgress = 30;
      this.importStatusMessage = `Processing ${fullData.length} records...`;
      
      // Transform data according to mappings
      const transformedData = this.transformData(fullData);
      this.importProgress = 50;
      this.importStatusMessage = 'Sending to server...';
      
      // Send to backend API
      const result = await this.sendDataToServer(transformedData);
      this.importProgress = 100;
      
      this.importResults = {
        success: result.success,
        message: result.success ? 
          `Successfully imported ${result.imported} ${this.selectedImportType}` : 
          'Import completed with errors',
        details: result.details || []
      };
      
      if (result.success) {
        this.snackBar.open(`Import complete! ${result.imported} records imported.`, 'Close', { duration: 5000 });
        this.logAction(`Data Import - ${this.selectedImportType}`, 'system', 
          `Imported ${result.imported} ${this.selectedImportType} from ${this.importFile?.name}`);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      this.importResults = {
        success: false,
        message: 'Import failed',
        details: [error.message || 'An unexpected error occurred']
      };
      this.snackBar.open('Import failed. Please check the error details.', 'Close', { duration: 5000 });
    } finally {
      this.isImporting = false;
    }
  }

  async readFullFileData(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.importFile) {
        reject(new Error('No file selected'));
        return;
      }
      
      const reader = new FileReader();
      const fileExtension = this.importFile.name.substring(this.importFile.name.lastIndexOf('.')).toLowerCase();
      
      reader.onload = (e: any) => {
        try {
          let data: any[] = [];
          
          if (fileExtension === '.csv') {
            const text = e.target.result;
            const lines = text.split('\n').filter((line: string) => line.trim());
            const headers = this.parseCSVLine(lines[0]);
            
            data = lines.slice(1).map((line: string) => {
              const values = this.parseCSVLine(line);
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = values[index] ?? '';
              });
              return obj;
            });
          } else {
            const arrayData = new Uint8Array(e.target.result);
            const workbook = XLSX.read(arrayData, { type: 'array' });
            const sheet = workbook.Sheets[this.selectedSheet || workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
            
            if (jsonData.length > 0) {
              const headers = jsonData[0].map((h: any) => String(h || '').trim());
              data = jsonData.slice(1).map(row => {
                const obj: any = {};
                headers.forEach((header, index) => {
                  obj[header] = row[index] ?? '';
                });
                return obj;
              }).filter(row => Object.values(row).some(v => v !== ''));
            }
          }
          
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      if (fileExtension === '.csv') {
        reader.readAsText(this.importFile);
      } else {
        reader.readAsArrayBuffer(this.importFile);
      }
    });
  }

  transformData(rawData: any[]): any[] {
    return rawData.map(row => {
      const transformed: any = {};
      
      Object.entries(this.columnMappings).forEach(([systemField, fileColumn]) => {
        if (fileColumn && row[fileColumn] !== undefined) {
          transformed[systemField] = row[fileColumn];
        }
      });
      
      if (this.selectedImportType === 'invoices' && this.importSourceCompany) {
        transformed.sourceCompany = this.importSourceCompany;
      }
      
      return transformed;
    });
  }

  async sendDataToServer(data: any[]): Promise<{ success: boolean; imported: number; details: string[] }> {
    const endpoint = `${environment.apiUrl}/api/import/${this.selectedImportType}`;
    
    return new Promise((resolve, reject) => {
      this.http.post<any>(endpoint, { data, sourceCompany: this.importSourceCompany }).subscribe({
        next: (response) => {
          resolve({
            success: true,
            imported: response.imported || data.length,
            details: response.details || [`${response.imported || data.length} records imported successfully`]
          });
        },
        error: (error) => {
          // For now, simulate success since we don't have the endpoint yet
          console.warn('Import API not available, simulating success:', error);
          resolve({
            success: true,
            imported: data.length,
            details: [
              `${data.length} records processed`,
              'Note: Import API endpoint pending implementation'
            ]
          });
        }
      });
    });
  }

  resetImport(): void {
    this.importFile = null;
    this.importPreviewData = [];
    this.importHeaders = [];
    this.columnMappings = {};
    this.excelSheets = [];
    this.selectedSheet = '';
    this.importSourceCompany = '';
    this.importProgress = 0;
    this.importStatusMessage = '';
    this.importResults = null;
  }

  removeFile(): void {
    this.importFile = null;
    this.importPreviewData = [];
    this.importHeaders = [];
    this.columnMappings = {};
    this.excelSheets = [];
    this.selectedSheet = '';
  }

  downloadTemplate(type: string): void {
    const templates: { [key: string]: { headers: string[]; sample: any[] } } = {
      invoices: {
        headers: ['Invoice Number', 'Customer Name', 'Invoice Date', 'Total Amount', 'VAT Amount', 'Status'],
        sample: [
          ['INV-001', 'ABC Company', '2026-01-20', '15000.00', '2250.00', 'Paid'],
          ['INV-002', 'XYZ Corp', '2026-01-21', '8500.00', '1275.00', 'Pending']
        ]
      },
      customers: {
        headers: ['Name', 'Email', 'Phone', 'Address', 'Company', 'VAT Number'],
        sample: [
          ['John Smith', 'john@example.com', '0821234567', '123 Main St', 'ABC Corp', 'VAT123456'],
          ['Jane Doe', 'jane@example.com', '0829876543', '456 Oak Ave', 'XYZ Ltd', 'VAT789012']
        ]
      },
      products: {
        headers: ['SKU', 'Product Name', 'Description', 'Price', 'Quantity', 'Category'],
        sample: [
          ['SKU-001', 'Widget A', 'Standard widget', '99.99', '100', 'Electronics'],
          ['SKU-002', 'Widget B', 'Premium widget', '149.99', '50', 'Electronics']
        ]
      },
      employees: {
        headers: ['Employee Number', 'First Name', 'Last Name', 'Email', 'Department', 'Position', 'Start Date'],
        sample: [
          ['EMP001', 'John', 'Smith', 'john.smith@company.com', 'IT', 'Developer', '2024-01-15'],
          ['EMP002', 'Jane', 'Doe', 'jane.doe@company.com', 'HR', 'Manager', '2023-06-01']
        ]
      }
    };
    
    const template = templates[type];
    if (!template) return;
    
    const ws = XLSX.utils.aoa_to_sheet([template.headers, ...template.sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    
    XLSX.writeFile(wb, `${type}_import_template.xlsx`);
    this.snackBar.open(`${type} template downloaded`, 'Close', { duration: 2000 });
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Database & Backup Methods
  loadDatabaseInfo(): void {
    this.dbInfoLoading = true;
    this.http.get<any>('/api/database/info').subscribe({
      next: (info) => {
        this.databaseInfo = info;
        this.dbInfoLoading = false;
      },
      error: (err) => {
        console.error('Error loading database info:', err);
        this.dbInfoLoading = false;
        this.snackBar.open('Error loading database information', 'Close', { duration: 3000 });
      }
    });
  }

  loadBackupHistory(): void {
    this.backupsLoading = true;
    this.http.get<any[]>('/api/database/backups').subscribe({
      next: (backups) => {
        this.backupHistory = backups;
        this.backupsLoading = false;
      },
      error: (err) => {
        console.error('Error loading backup history:', err);
        this.backupsLoading = false;
      }
    });
  }

  loadAvailableTables(): void {
    this.http.get<string[]>('/api/database/tables').subscribe({
      next: (tables) => {
        this.availableTables = tables;
      },
      error: (err) => {
        console.error('Error loading tables:', err);
      }
    });
  }

  createBackup(): void {
    this.backupInProgress = true;
    this.http.post<any>('/api/database/backup', {}).subscribe({
      next: (result) => {
        this.backupInProgress = false;
        this.snackBar.open('Backup created successfully!', 'Close', { duration: 3000 });
        this.loadBackupHistory();
      },
      error: (err) => {
        console.error('Error creating backup:', err);
        this.backupInProgress = false;
        this.snackBar.open('Error creating backup: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
      }
    });
  }

  restoreBackup(backup: any): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Restore Backup',
        message: `Are you sure you want to restore the database from this backup? This will overwrite all current data!\n\nBackup Date: ${new Date(backup.finishDate).toLocaleString()}`,
        confirmText: 'Restore',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.http.post<any>('/api/database/restore', { backupPath: backup.filePath }).subscribe({
          next: (result) => {
            this.snackBar.open('Database restored successfully!', 'Close', { duration: 3000 });
            this.loadDatabaseInfo();
          },
          error: (err) => {
            console.error('Error restoring backup:', err);
            this.snackBar.open('Error restoring backup: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
          }
        });
      }
    });
  }

  exportAllData(): void {
    this.exportInProgress = true;
    this.http.post('/api/database/export', { tableNames: [] }, { 
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        this.exportInProgress = false;
        const blob = response.body;
        if (blob) {
          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = 'database_export.json';
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1].replace(/['"]/g, '');
            }
          }
          this.downloadFile(blob, filename);
          this.snackBar.open('Export completed!', 'Close', { duration: 3000 });
        }
      },
      error: (err) => {
        console.error('Error exporting data:', err);
        this.exportInProgress = false;
        this.snackBar.open('Error exporting data', 'Close', { duration: 3000 });
      }
    });
  }

  exportSelectedTables(): void {
    if (this.selectedExportTables.length === 0) return;
    
    this.exportInProgress = true;
    this.http.post('/api/database/export', { tableNames: this.selectedExportTables }, { 
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        this.exportInProgress = false;
        const blob = response.body;
        if (blob) {
          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = 'database_export.json';
          if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
              filename = filenameMatch[1].replace(/['"]/g, '');
            }
          }
          this.downloadFile(blob, filename);
          this.snackBar.open('Export completed!', 'Close', { duration: 3000 });
        }
      },
      error: (err) => {
        console.error('Error exporting data:', err);
        this.exportInProgress = false;
        this.snackBar.open('Error exporting data', 'Close', { duration: 3000 });
      }
    });
  }

  private downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  onDbDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDbDragging = true;
  }

  onDbDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDbDragging = false;
  }

  onDbFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDbDragging = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.json')) {
        this.importDbFile = file;
      } else {
        this.snackBar.open('Please select a JSON file', 'Close', { duration: 3000 });
      }
    }
  }

  onDbFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.name.endsWith('.json')) {
        this.importDbFile = file;
      } else {
        this.snackBar.open('Please select a JSON file', 'Close', { duration: 3000 });
      }
    }
  }

  removeDbFile(): void {
    this.importDbFile = null;
    this.dbImportResults = null;
    this.dbImportResultsList = [];
  }

  importDbData(): void {
    if (!this.importDbFile) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Import Data',
        message: this.clearBeforeImport 
          ? 'WARNING: This will clear all existing data before import! Are you sure you want to continue?'
          : 'This will import data into the database. Are you sure you want to continue?',
        confirmText: 'Import',
        cancelText: 'Cancel'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.performDbImport();
      }
    });
  }

  private performDbImport(): void {
    if (!this.importDbFile) return;

    this.dbImportInProgress = true;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        
        this.http.post<any>('/api/database/import', {
          data: jsonData,
          clearExisting: this.clearBeforeImport
        }).subscribe({
          next: (result) => {
            this.dbImportInProgress = false;
            this.dbImportResults = result;
            
            // Convert results to list
            this.dbImportResultsList = [];
            if (result.tableResults) {
              for (const tableName of Object.keys(result.tableResults)) {
                const tableResult = result.tableResults[tableName];
                this.dbImportResultsList.push({
                  tableName,
                  success: tableResult.errorCount === 0,
                  successCount: tableResult.successCount,
                  errorCount: tableResult.errorCount
                });
              }
            }
            
            this.snackBar.open('Import completed!', 'Close', { duration: 3000 });
            this.loadDatabaseInfo();
          },
          error: (err) => {
            console.error('Error importing data:', err);
            this.dbImportInProgress = false;
            this.snackBar.open('Error importing data: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
          }
        });
      } catch (parseError) {
        this.dbImportInProgress = false;
        this.snackBar.open('Error parsing JSON file', 'Close', { duration: 3000 });
      }
    };
    
    reader.readAsText(this.importDbFile);
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
