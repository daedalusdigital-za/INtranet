import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TenderService, Tender, TenderStats, ComplianceDocument, ComplianceSummary, CalendarEvent, TenderBOQItem, TenderTeamMember, TenderDocument, TenderReminder } from '../../services/tender.service';
import { AuthService } from '../../services/auth.service';
import { TenderDetailDialogComponent } from './tender-detail-dialog.component';
import { ComplianceDialogComponent } from './compliance-dialog.component';
import { NavbarComponent } from '../shared/navbar/navbar.component';

interface Company {
  code: string;
  name: string;
  color: string;
}

@Component({
  selector: 'app-tenders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatBadgeModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDividerModule,
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="tenders-container">
      <!-- Modern Header -->
      <div class="modern-header">
        <div class="header-main">
          <div class="header-icon-wrapper">
            <mat-icon>gavel</mat-icon>
          </div>
          <div class="header-text-area">
            <h1>Tenders Management</h1>
            <p class="header-subtitle">Track tenders, manage compliance, and monitor your bidding performance</p>
          </div>
        </div>
        <div class="header-stats-row">
          <div class="mini-stat">
            <mat-icon>trending_up</mat-icon>
            <div class="mini-stat-content">
              <span class="mini-value">{{ stats?.winRate || 0 }}%</span>
              <span class="mini-label">Win Rate</span>
            </div>
          </div>
          <div class="mini-stat">
            <mat-icon>attach_money</mat-icon>
            <div class="mini-stat-content">
              <span class="mini-value">{{ stats?.totalValueAwarded | currency:'ZAR':'symbol':'1.0-0' }}</span>
              <span class="mini-label">Total Awarded</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Stats Widgets -->
      <div class="stats-row">
        <mat-card class="stat-card active" (click)="filterByStatus(null)">
          <div class="stat-icon"><mat-icon>description</mat-icon></div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.activeTenders || 0 }}</div>
            <div class="stat-label">Active Tenders</div>
          </div>
        </mat-card>
        <mat-card class="stat-card closing" (click)="filterByClosingWeek()">
          <div class="stat-icon"><mat-icon>schedule</mat-icon></div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.closingThisWeek || 0 }}</div>
            <div class="stat-label">Closing This Week</div>
          </div>
        </mat-card>
        <mat-card class="stat-card compliance" (click)="selectedTab = 1">
          <div class="stat-icon"><mat-icon>warning</mat-icon></div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.complianceExpiring || 0 }}</div>
            <div class="stat-label">Compliance Expiring</div>
          </div>
        </mat-card>
        <mat-card class="stat-card awarded">
          <div class="stat-icon"><mat-icon>emoji_events</mat-icon></div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.awardedYTD || 0 }}</div>
            <div class="stat-label">Awarded YTD</div>
          </div>
        </mat-card>
        <mat-card class="stat-card lost">
          <div class="stat-icon"><mat-icon>thumb_down</mat-icon></div>
          <div class="stat-content">
            <div class="stat-value">{{ stats?.lostYTD || 0 }}</div>
            <div class="stat-label">Lost YTD</div>
          </div>
        </mat-card>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button mat-raised-button color="primary" (click)="openCreateTender()">
          <mat-icon>add</mat-icon> Create Tender
        </button>
        <button mat-stroked-button (click)="selectedTab = 1">
          <mat-icon>verified_user</mat-icon> Compliance Vault
        </button>
        <button mat-stroked-button (click)="selectedTab = 2">
          <mat-icon>calendar_month</mat-icon> Calendar
        </button>
        <button mat-stroked-button (click)="selectedTab = 3">
          <mat-icon>analytics</mat-icon> Analytics
        </button>
      </div>

      <!-- Main Tabs -->
      <mat-tab-group [(selectedIndex)]="selectedTab" animationDuration="200ms">
        <!-- Active Tenders Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">description</mat-icon>
            Active Tenders
          </ng-template>
          
          <div class="tab-content">
            <!-- Filters -->
            <mat-card class="filter-card">
              <div class="filter-row">
                <mat-form-field appearance="outline">
                  <mat-label>Search</mat-label>
                  <input matInput [(ngModel)]="searchTerm" placeholder="Tender # or Title" (keyup.enter)="applyFilters()">
                  <mat-icon matSuffix>search</mat-icon>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Company</mat-label>
                  <mat-select [(ngModel)]="selectedCompany" (selectionChange)="applyFilters()">
                    <mat-option value="">All Companies</mat-option>
                    @for (company of companies; track company.code) {
                      <mat-option [value]="company.code">
                        <span class="company-badge" [style.background-color]="company.color"></span>
                        {{ company.name }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Province</mat-label>
                  <mat-select [(ngModel)]="selectedProvince" (selectionChange)="applyFilters()">
                    <mat-option value="">All Provinces</mat-option>
                    @for (prov of provinces; track prov) {
                      <mat-option [value]="prov">{{ prov }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Status</mat-label>
                  <mat-select [(ngModel)]="selectedStatus" (selectionChange)="applyFilters()">
                    <mat-option value="">All Statuses</mat-option>
                    @for (status of statuses; track status.value) {
                      <mat-option [value]="status.value">
                        <span class="status-dot" [style.background-color]="status.color"></span>
                        {{ status.label }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Department</mat-label>
                  <mat-select [(ngModel)]="selectedDepartment" (selectionChange)="applyFilters()">
                    <mat-option value="">All Departments</mat-option>
                    @for (dept of departments; track dept) {
                      <mat-option [value]="dept">{{ dept }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-icon-button color="primary" (click)="applyFilters()" matTooltip="Apply Filters">
                  <mat-icon>filter_list</mat-icon>
                </button>
                <button mat-icon-button (click)="clearFilters()" matTooltip="Clear Filters">
                  <mat-icon>clear</mat-icon>
                </button>
              </div>
            </mat-card>

            <!-- Tenders Table -->
            @if (loading) {
              <div class="loading-container">
                <mat-spinner diameter="50"></mat-spinner>
              </div>
            } @else {
              <mat-card class="table-card">
                <table mat-table [dataSource]="tendersDataSource" matSort class="tenders-table">
                  <!-- Company Column -->
                  <ng-container matColumnDef="companyCode">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Company</th>
                    <td mat-cell *matCellDef="let tender">
                      <span class="company-chip" [style.background-color]="getCompanyColor(tender.companyCode)">
                        {{ tender.companyCode }}
                      </span>
                    </td>
                  </ng-container>

                  <!-- Tender Number Column -->
                  <ng-container matColumnDef="tenderNumber">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Tender #</th>
                    <td mat-cell *matCellDef="let tender">
                      <a class="tender-link" (click)="openTenderDetail(tender)">{{ tender.tenderNumber }}</a>
                    </td>
                  </ng-container>

                  <!-- Title Column -->
                  <ng-container matColumnDef="title">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Title</th>
                    <td mat-cell *matCellDef="let tender">
                      <div class="title-cell">
                        <span class="tender-title">{{ tender.title }}</span>
                        <span class="tender-dept">{{ tender.issuingDepartment }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Province Column -->
                  <ng-container matColumnDef="province">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Province</th>
                    <td mat-cell *matCellDef="let tender">{{ tender.province || '-' }}</td>
                  </ng-container>

                  <!-- Value Column -->
                  <ng-container matColumnDef="estimatedValue">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Est. Value</th>
                    <td mat-cell *matCellDef="let tender">
                      @if (tender.estimatedValue) {
                        {{ tender.estimatedValue | currency:'ZAR':'symbol':'1.0-0' }}
                      } @else {
                        -
                      }
                    </td>
                  </ng-container>

                  <!-- Closing Date Column -->
                  <ng-container matColumnDef="closingDate">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Closing</th>
                    <td mat-cell *matCellDef="let tender">
                      <div class="closing-cell" [class.urgent]="getDaysUntilClosing(tender.closingDate) <= 7">
                        <span class="closing-date">{{ tender.closingDate | date:'dd MMM yyyy' }}</span>
                        <span class="days-left">{{ getDaysUntilClosing(tender.closingDate) }} days</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Status Column -->
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                    <td mat-cell *matCellDef="let tender">
                      <span class="status-chip" [style.background-color]="getStatusColor(tender.status)">
                        {{ tender.status }}
                      </span>
                    </td>
                  </ng-container>

                  <!-- Workflow Column -->
                  <ng-container matColumnDef="workflowStatus">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Workflow</th>
                    <td mat-cell *matCellDef="let tender">
                      <span class="workflow-badge" [class]="'workflow-' + tender.workflowStatus.toLowerCase().replace(' ', '-')">
                        {{ tender.workflowStatus }}
                      </span>
                    </td>
                  </ng-container>

                  <!-- Priority Column -->
                  <ng-container matColumnDef="priority">
                    <th mat-header-cell *matHeaderCellDef mat-sort-header>Priority</th>
                    <td mat-cell *matCellDef="let tender">
                      <mat-icon [class]="'priority-' + tender.priority.toLowerCase()" [matTooltip]="tender.priority">
                        {{ tender.priority === 'Critical' ? 'priority_high' : tender.priority === 'High' ? 'arrow_upward' : tender.priority === 'Medium' ? 'remove' : 'arrow_downward' }}
                      </mat-icon>
                    </td>
                  </ng-container>

                  <!-- Actions Column -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let tender">
                      <button mat-icon-button [matMenuTriggerFor]="tenderMenu" matTooltip="Actions">
                        <mat-icon>more_vert</mat-icon>
                      </button>
                      <mat-menu #tenderMenu="matMenu">
                        <button mat-menu-item (click)="openTenderDetail(tender)">
                          <mat-icon>visibility</mat-icon> View Details
                        </button>
                        <button mat-menu-item (click)="editTender(tender)">
                          <mat-icon>edit</mat-icon> Edit
                        </button>
                        <mat-divider></mat-divider>
                        <button mat-menu-item [matMenuTriggerFor]="statusMenu">
                          <mat-icon>swap_horiz</mat-icon> Change Status
                        </button>
                        <button mat-menu-item [matMenuTriggerFor]="workflowMenu">
                          <mat-icon>account_tree</mat-icon> Update Workflow
                        </button>
                        <mat-divider></mat-divider>
                        <button mat-menu-item (click)="openReminderDialog(tender)">
                          <mat-icon>notifications_active</mat-icon> Set Reminder
                        </button>
                        <mat-divider></mat-divider>
                        <button mat-menu-item (click)="deleteTender(tender)" class="delete-action">
                          <mat-icon>delete</mat-icon> Delete
                        </button>
                      </mat-menu>
                      <mat-menu #statusMenu="matMenu">
                        @for (status of statuses; track status.value) {
                          <button mat-menu-item (click)="updateTenderStatus(tender, status.value)">
                            <span class="status-dot" [style.background-color]="status.color"></span>
                            {{ status.label }}
                          </button>
                        }
                      </mat-menu>
                      <mat-menu #workflowMenu="matMenu">
                        @for (workflow of workflowStatuses; track workflow) {
                          <button mat-menu-item (click)="updateTenderWorkflow(tender, workflow)">
                            {{ workflow }}
                          </button>
                        }
                      </mat-menu>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns;" (click)="openTenderDetail(row)"></tr>
                </table>
                <mat-paginator [pageSizeOptions]="[10, 25, 50]" showFirstLastButtons></mat-paginator>
              </mat-card>
            }
          </div>
        </mat-tab>

        <!-- Compliance Vault Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">verified_user</mat-icon>
            Compliance Vault
            @if (stats && stats.complianceExpiring) {
              <span class="badge warn">{{ stats.complianceExpiring }}</span>
            }
          </ng-template>
          
          <div class="tab-content">
            <!-- Compliance Summary Cards -->
            <div class="compliance-summary">
              <mat-card class="compliance-stat valid">
                <mat-icon>check_circle</mat-icon>
                <div class="value">{{ complianceSummary?.valid || 0 }}</div>
                <div class="label">Valid</div>
              </mat-card>
              <mat-card class="compliance-stat expiring">
                <mat-icon>schedule</mat-icon>
                <div class="value">{{ complianceSummary?.expiring || 0 }}</div>
                <div class="label">Expiring Soon</div>
              </mat-card>
              <mat-card class="compliance-stat warning">
                <mat-icon>warning</mat-icon>
                <div class="value">{{ complianceSummary?.warning || 0 }}</div>
                <div class="label">Warning</div>
              </mat-card>
              <mat-card class="compliance-stat expired">
                <mat-icon>error</mat-icon>
                <div class="value">{{ complianceSummary?.expired || 0 }}</div>
                <div class="label">Expired</div>
              </mat-card>
            </div>

            <div class="compliance-actions">
              <button mat-raised-button color="primary" (click)="openAddCompliance()">
                <mat-icon>add</mat-icon> Add Document
              </button>
              <button mat-stroked-button (click)="checkComplianceAlerts()">
                <mat-icon>notification_important</mat-icon> Check Alerts
              </button>
            </div>

            <!-- Compliance by Company -->
            <div class="compliance-grid">
              @for (company of companies; track company.code) {
                <mat-card class="company-compliance-card">
                  <mat-card-header>
                    <span class="company-indicator" [style.background-color]="company.color"></span>
                    <mat-card-title>{{ company.name }}</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="doc-types">
                      @for (docType of documentTypes; track docType.value) {
                        @if (getComplianceDoc(company.code, docType.value); as doc) {
                          <div class="doc-row" [class]="'status-' + doc.computedStatus.toLowerCase()">
                            <div class="doc-info">
                              <mat-icon>{{ docType.icon }}</mat-icon>
                              <span class="doc-name">{{ docType.label }}</span>
                            </div>
                            <div class="doc-status">
                              <span class="expiry">{{ doc.expiryDate | date:'dd MMM yyyy' }}</span>
                              <span class="days-badge" [class]="doc.computedStatus.toLowerCase()">
                                {{ doc.daysLeft >= 0 ? doc.daysLeft + ' days' : 'EXPIRED' }}
                              </span>
                            </div>
                            <button mat-icon-button [matMenuTriggerFor]="docMenu" (click)="$event.stopPropagation()">
                              <mat-icon>more_vert</mat-icon>
                            </button>
                            <mat-menu #docMenu="matMenu">
                              <button mat-menu-item (click)="previewComplianceDoc(doc)" [disabled]="!isPdfFile(doc)">
                                <mat-icon>picture_as_pdf</mat-icon> Preview PDF
                              </button>
                              <button mat-menu-item (click)="viewComplianceDoc(doc)">
                                <mat-icon>visibility</mat-icon> View Details
                              </button>
                              <button mat-menu-item (click)="downloadComplianceDoc(doc)">
                                <mat-icon>download</mat-icon> Download
                              </button>
                              <button mat-menu-item (click)="editComplianceDoc(doc)">
                                <mat-icon>edit</mat-icon> Update
                              </button>
                            </mat-menu>
                          </div>
                        } @else {
                          <div class="doc-row missing">
                            <div class="doc-info">
                              <mat-icon>{{ docType.icon }}</mat-icon>
                              <span class="doc-name">{{ docType.label }}</span>
                            </div>
                            <span class="missing-badge">Not Uploaded</span>
                            <button mat-icon-button (click)="openAddCompliance(company.code, docType.value)">
                              <mat-icon>add_circle</mat-icon>
                            </button>
                          </div>
                        }
                      }
                    </div>
                  </mat-card-content>
                </mat-card>
              }
            </div>
          </div>
        </mat-tab>

        <!-- Calendar Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">calendar_month</mat-icon>
            Calendar
          </ng-template>
          
          <div class="tab-content">
            <mat-card class="calendar-card">
              <mat-card-header>
                <mat-card-title>
                  <button mat-icon-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
                  {{ calendarMonth | date:'MMMM yyyy' }}
                  <button mat-icon-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
                </mat-card-title>
                <div class="calendar-legend">
                  <span class="legend-item closing"><span class="dot"></span> Closing</span>
                  <span class="legend-item briefing"><span class="dot"></span> Briefing</span>
                  <span class="legend-item site-visit"><span class="dot"></span> Site Visit</span>
                  <span class="legend-item clarification"><span class="dot"></span> Clarification</span>
                  <span class="legend-item evaluation"><span class="dot"></span> Evaluation</span>
                  <button mat-raised-button color="primary" class="create-reminder-btn" (click)="openReminderDialog()">
                    <mat-icon>notification_add</mat-icon> Create Reminder
                  </button>
                </div>
              </mat-card-header>
              <mat-card-content>
                <div class="calendar-grid">
                  <div class="day-header">Sun</div>
                  <div class="day-header">Mon</div>
                  <div class="day-header">Tue</div>
                  <div class="day-header">Wed</div>
                  <div class="day-header">Thu</div>
                  <div class="day-header">Fri</div>
                  <div class="day-header">Sat</div>
                  @for (day of calendarDays; track $index) {
                    <div class="calendar-day" [class.other-month]="!day.currentMonth" [class.today]="day.isToday">
                      <span class="day-number">{{ day.date.getDate() }}</span>
                      <div class="day-events">
                        @for (event of day.events; track event.id) {
                          <div class="event" [class]="'event-' + event.type" [matTooltip]="event.title" (click)="openTenderFromEvent(event)">
                            <span class="event-company" [style.background-color]="getCompanyColor(event.companyCode)"></span>
                            <span class="event-title">{{ event.title | slice:0:15 }}...</span>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Active Reminders Section -->
            <mat-card class="reminders-card" style="margin-top: 16px;">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon style="vertical-align: middle; margin-right: 8px;">notifications</mat-icon>
                  Active Reminders
                  @if (reminders.length > 0) {
                    <span class="reminder-count-badge">{{ reminders.length }}</span>
                  }
                </mat-card-title>
                <div style="margin-left: auto; display: flex; gap: 8px;">
                  <button mat-stroked-button color="accent" (click)="checkReminders()" matTooltip="Check & send due reminders now">
                    <mat-icon>send</mat-icon> Check & Send Due
                  </button>
                </div>
              </mat-card-header>
              <mat-card-content>
                @if (reminders.length === 0) {
                  <div class="no-reminders">
                    <mat-icon style="font-size: 48px; width: 48px; height: 48px; color: #ccc;">notifications_off</mat-icon>
                    <p style="color: #999; margin-top: 8px;">No active reminders. Create one from the button above or from a tender's action menu.</p>
                  </div>
                } @else {
                  <div class="reminders-list">
                    @for (reminder of reminders; track reminder.id) {
                      <div class="reminder-item" [class.reminder-sent]="reminder.isSent" [class.reminder-due]="reminder.isDue">
                        <div class="reminder-left">
                          <mat-icon [class]="'reminder-type-icon event-type-' + reminder.eventType.toLowerCase()">
                            {{ getEventTypeIcon(reminder.eventType) }}
                          </mat-icon>
                          <div class="reminder-info">
                            <strong>{{ reminder.tenderTitle || 'Tender #' + reminder.tenderId }}</strong>
                            <span class="reminder-meta">
                              {{ getEventTypeLabel(reminder.eventType) }} • {{ reminder.eventDate | date:'dd MMM yyyy' }} • {{ reminder.daysBefore }} day{{ reminder.daysBefore !== 1 ? 's' : '' }} before
                            </span>
                            @if (reminder.emailRecipients) {
                              <span class="reminder-emails"><mat-icon style="font-size: 14px; width: 14px; height: 14px;">email</mat-icon> {{ reminder.emailRecipients }}</span>
                            }
                            @if (reminder.notes) {
                              <span class="reminder-notes">{{ reminder.notes }}</span>
                            }
                          </div>
                        </div>
                        <div class="reminder-actions">
                          @if (reminder.isSent) {
                            <mat-chip class="sent-chip">
                              <mat-icon>check_circle</mat-icon> Sent {{ reminder.sentAt | date:'dd MMM' }}
                            </mat-chip>
                          } @else if (reminder.isDue) {
                            <mat-chip class="due-chip">
                              <mat-icon>warning</mat-icon> Due Now
                            </mat-chip>
                          }
                          <button mat-icon-button matTooltip="Send Now" (click)="sendReminderNow(reminder)" [disabled]="reminder.isSent">
                            <mat-icon>send</mat-icon>
                          </button>
                          <button mat-icon-button matTooltip="Delete Reminder" (click)="deleteReminder(reminder)" color="warn">
                            <mat-icon>delete</mat-icon>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- AI Document Analyzer Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">smart_toy</mat-icon>
            AI Analyzer
          </ng-template>
          
          <div class="tab-content">
            <div class="ai-analyzer-container">
              <!-- Document Upload Section -->
              <div class="upload-section">
                <div class="upload-header">
                  <mat-icon>description</mat-icon>
                  <h3>Tender Document Analyzer</h3>
                  <p>Upload a tender document (PDF) and ask AI questions about requirements, deadlines, and more</p>
                </div>
                
                <div class="drop-zone" 
                     [class.dragover]="isDragOver"
                     [class.has-file]="analyzerDocument"
                     (dragover)="onDragOver($event)"
                     (dragleave)="onDragLeave($event)"
                     (drop)="onFileDrop($event)"
                     (click)="analyzerFileInput.click()">
                  @if (!analyzerDocument) {
                    <mat-icon class="upload-icon">cloud_upload</mat-icon>
                    <p class="drop-text">Drag & drop a PDF here or click to browse</p>
                    <p class="drop-hint">Supports PDF files up to 50MB</p>
                  } @else {
                    <div class="file-info">
                      <mat-icon class="pdf-icon">picture_as_pdf</mat-icon>
                      <div class="file-details">
                        <span class="file-name">{{ analyzerDocument.name }}</span>
                        <span class="file-size">{{ formatFileSize(analyzerDocument.size) }}</span>
                      </div>
                      <button mat-icon-button (click)="removeAnalyzerDocument($event)" matTooltip="Remove file">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  }
                </div>
                <input #analyzerFileInput type="file" hidden accept=".pdf" (change)="onFileSelected($event)">

                @if (analyzerDocument && !documentAnalyzed) {
                  <button mat-raised-button color="primary" class="analyze-btn" (click)="analyzeDocument()" [disabled]="analyzingDocument">
                    @if (analyzingDocument) {
                      <mat-spinner diameter="20"></mat-spinner>
                      <span>Analyzing...</span>
                    } @else {
                      <ng-container><mat-icon>psychology</mat-icon> <span>Analyze Document</span></ng-container>
                    }
                  </button>
                }

                @if (analyzingDocument) {
                  <div class="analyzer-progress">
                    <div class="analyzer-progress-header">
                      <mat-icon class="analyzer-pulse-icon">auto_awesome</mat-icon>
                      <span class="analyzer-progress-title">Welly is analyzing your document...</span>
                      <span class="analyzer-progress-timer">{{ analyzerElapsedTime }}</span>
                    </div>
                    <div class="analyzer-progress-track">
                      <div class="analyzer-progress-fill" [style.width.%]="analyzerProgressPercent"></div>
                    </div>
                    <div class="analyzer-progress-steps">
                      @for (step of analyzerProgressSteps; track step.label; let i = $index) {
                        <div class="analyzer-step" [class.active]="i === analyzerCurrentStep" [class.done]="i < analyzerCurrentStep">
                          <div class="analyzer-step-icon">
                            @if (i < analyzerCurrentStep) {
                              <mat-icon>check_circle</mat-icon>
                            } @else if (i === analyzerCurrentStep) {
                              <mat-spinner diameter="16"></mat-spinner>
                            } @else {
                              <mat-icon>radio_button_unchecked</mat-icon>
                            }
                          </div>
                          <span>{{ step.label }}</span>
                        </div>
                      }
                    </div>
                    <p class="analyzer-progress-msg">{{ analyzerProgressMessage }}</p>
                  </div>
                }
              </div>

              <!-- Chat Section -->
              @if (documentAnalyzed) {
                <div class="chat-section">
                  <div class="chat-header">
                    <mat-icon>chat</mat-icon>
                    <h4>Ask About This Document</h4>
                  </div>
                  
                  <div class="chat-messages" #chatContainer>
                    @for (message of analyzerMessages; track message.id) {
                      <div class="message" [class.user]="message.role === 'user'" [class.assistant]="message.role === 'assistant'">
                        <div class="message-avatar">
                          <mat-icon>{{ message.role === 'user' ? 'person' : 'smart_toy' }}</mat-icon>
                        </div>
                        <div class="message-content">
                          <div class="message-text" [innerHTML]="formatMessage(message.content)"></div>
                          <span class="message-time">{{ message.timestamp | date:'HH:mm' }}</span>
                        </div>
                      </div>
                    }
                    @if (aiThinking) {
                      <div class="message assistant">
                        <div class="message-avatar">
                          <mat-icon>smart_toy</mat-icon>
                        </div>
                        <div class="message-content">
                          <div class="typing-indicator">
                            <span></span><span></span><span></span>
                          </div>
                        </div>
                      </div>
                    }
                  </div>

                  <div class="quick-questions">
                    <span class="quick-label">Quick questions:</span>
                    <button mat-stroked-button (click)="askQuickQuestion('What documents are required for this tender?')">
                      Required Documents
                    </button>
                    <button mat-stroked-button (click)="askQuickQuestion('What is the closing date and time?')">
                      Closing Date
                    </button>
                    <button mat-stroked-button (click)="askQuickQuestion('What are the mandatory requirements?')">
                      Mandatory Requirements
                    </button>
                    <button mat-stroked-button (click)="askQuickQuestion('Summarize the key evaluation criteria')">
                      Evaluation Criteria
                    </button>
                  </div>

                  <div class="chat-input">
                    <mat-form-field appearance="outline" class="message-input">
                      <mat-label>Ask a question about the tender...</mat-label>
                      <input matInput [(ngModel)]="analyzerQuestion" 
                             (keyup.enter)="sendAnalyzerQuestion()"
                             [disabled]="aiThinking"
                             placeholder="e.g., What BBBEE level is required?">
                    </mat-form-field>
                    <button mat-fab color="primary" (click)="sendAnalyzerQuestion()" [disabled]="!analyzerQuestion || aiThinking">
                      <mat-icon>send</mat-icon>
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>

    <!-- Reminder Dialog Overlay -->
    @if (showReminderDialog) {
      <div class="reminder-overlay" (click)="closeReminderDialog()">
        <div class="reminder-dialog" (click)="$event.stopPropagation()">
          <div class="reminder-dialog-header">
            <mat-icon>notification_add</mat-icon>
            <h2>Create Tender Reminder</h2>
            <button mat-icon-button (click)="closeReminderDialog()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="reminder-dialog-body">
            <!-- Tender Selection -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Select Tender</mat-label>
              <mat-select [(ngModel)]="reminderForm.tenderId" (selectionChange)="onReminderTenderChange()">
                @for (tender of tenders; track tender.id) {
                  <mat-option [value]="tender.id">{{ tender.tenderNumber }} - {{ tender.title | slice:0:50 }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Event Type -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Event Type</mat-label>
              <mat-select [(ngModel)]="reminderForm.eventType">
                @for (evt of reminderEventTypes; track evt.value) {
                  <mat-option [value]="evt.value" [disabled]="!isEventAvailable(evt.value)">
                    <mat-icon>{{ evt.icon }}</mat-icon> {{ evt.label }}
                    @if (!isEventAvailable(evt.value)) {
                      <span style="color: #999; font-size: 12px;"> (no date set)</span>
                    }
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- Days Before -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Days Before Event to Send Reminder</mat-label>
              <mat-select [(ngModel)]="reminderForm.daysBefore">
                <mat-option [value]="1">1 day before</mat-option>
                <mat-option [value]="2">2 days before</mat-option>
                <mat-option [value]="3">3 days before</mat-option>
                <mat-option [value]="5">5 days before</mat-option>
                <mat-option [value]="7">1 week before</mat-option>
                <mat-option [value]="14">2 weeks before</mat-option>
                <mat-option [value]="30">1 month before</mat-option>
              </mat-select>
            </mat-form-field>

            <!-- Email Recipients -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email Recipients (comma-separated)</mat-label>
              <input matInput [(ngModel)]="reminderForm.emailRecipients" placeholder="e.g., user1&#64;email.com, user2&#64;email.com">
              <mat-icon matSuffix>email</mat-icon>
              <mat-hint>Welly will send a professionally formatted email to these addresses</mat-hint>
            </mat-form-field>

            <!-- Notes -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notes (optional)</mat-label>
              <textarea matInput [(ngModel)]="reminderForm.notes" rows="3" placeholder="Any additional notes for the reminder..."></textarea>
            </mat-form-field>

            @if (reminderForm.tenderId && reminderForm.eventType) {
              <div class="reminder-preview">
                <mat-icon>info</mat-icon>
                <span>Reminder will be emailed <strong>{{ reminderForm.daysBefore }} day{{ reminderForm.daysBefore !== 1 ? 's' : '' }}</strong> before the <strong>{{ getEventTypeLabel(reminderForm.eventType) }}</strong> event</span>
              </div>
            }
          </div>
          <div class="reminder-dialog-actions">
            <button mat-stroked-button (click)="closeReminderDialog()">Cancel</button>
            <button mat-raised-button color="primary" (click)="submitReminder()" [disabled]="!reminderForm.tenderId || !reminderForm.eventType || !reminderForm.emailRecipients">
              <mat-icon>notification_add</mat-icon> Create Reminder
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 50%, #1a5fb4 100%);
      position: relative;
      z-index: 1;
    }

    .tenders-container {
      padding: 24px;
      padding-top: 88px;
      max-width: 1600px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
      position: relative;
    }

    /* Modern Header Styles */
    .modern-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
      flex-wrap: wrap;
      gap: 24px;
    }

    .header-main {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .header-icon-wrapper {
      width: 72px;
      height: 72px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .header-icon-wrapper mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: white;
    }

    .header-text-area h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .header-subtitle {
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.85);
      font-size: 15px;
      font-weight: 400;
    }

    .header-stats-row {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .mini-stat {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      padding: 12px 20px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .mini-stat mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: white;
    }

    .mini-stat-content {
      display: flex;
      flex-direction: column;
    }

    .mini-value {
      font-size: 18px;
      font-weight: 700;
      color: white;
    }

    .mini-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
    }

    /* Stats Row */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      display: flex;
      align-items: center;
      padding: 20px;
      cursor: pointer;
      transition: all 0.3s ease;
      border-left: 4px solid transparent;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .stat-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0,0,0,0.2);
    }

    .stat-card.active { border-left-color: #1e90ff; }
    .stat-card.active .stat-icon { color: #1e90ff; }
    .stat-card.closing { border-left-color: #FF9800; }
    .stat-card.closing .stat-icon { color: #FF9800; }
    .stat-card.compliance { border-left-color: #F44336; }
    .stat-card.compliance .stat-icon { color: #F44336; }
    .stat-card.awarded { border-left-color: #4CAF50; }
    .stat-card.awarded .stat-icon { color: #4CAF50; }
    .stat-card.lost { border-left-color: #9E9E9E; }
    .stat-card.lost .stat-icon { color: #9E9E9E; }

    .stat-icon {
      font-size: 36px;
      margin-right: 16px;
    }
    .stat-icon mat-icon { font-size: 36px; width: 36px; height: 36px; }

    .stat-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
      color: #1a1a2e;
    }

    .stat-label {
      font-size: 14px;
      color: #666;
      margin-top: 4px;
    }

    /* Quick Actions */
    .quick-actions {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }

    .quick-actions button {
      background: rgba(255, 255, 255, 0.2) !important;
      backdrop-filter: blur(10px);
      color: white !important;
      border: 1px solid rgba(255, 255, 255, 0.3) !important;
      border-radius: 12px !important;
      padding: 8px 20px !important;
      font-weight: 500;
      transition: all 0.3s ease;
    }

    .quick-actions button:hover {
      background: rgba(255, 255, 255, 0.3) !important;
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    .quick-actions button[color="primary"] {
      background: white !important;
      color: #1e90ff !important;
    }

    .quick-actions button[color="primary"]:hover {
      background: #f0f8ff !important;
    }

    /* Tabs */
    ::ng-deep .mat-mdc-tab-group {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    ::ng-deep .mat-mdc-tab-header {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      border-radius: 20px 20px 0 0;
    }

    ::ng-deep .mat-mdc-tab-labels {
      background: transparent;
    }

    ::ng-deep .mat-mdc-tab {
      color: rgba(255, 255, 255, 0.8) !important;
      font-weight: 500;
    }

    ::ng-deep .mat-mdc-tab.mdc-tab--active {
      color: white !important;
    }

    ::ng-deep .mat-mdc-tab-body-wrapper {
      padding: 24px;
    }

    ::ng-deep .mdc-tab-indicator__content--underline {
      border-color: white !important;
    }

    .tab-icon { margin-right: 8px; }
    .badge {
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
    .badge.warn { background: #F44336; color: white; }

    .tab-content { padding: 0; }

    /* Filter Card */
    .filter-card {
      margin-bottom: 16px;
      padding: 20px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: none;
    }

    .filter-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-row mat-form-field { flex: 1; min-width: 150px; }

    ::ng-deep .filter-card .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .company-badge {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .status-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 8px;
    }

    /* Table */
    .table-card { 
      overflow: hidden;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: none;
    }

    .tenders-table {
      width: 100%;
    }

    .tenders-table tr { cursor: pointer; }
    .tenders-table tr:hover { background: #f0f8ff; }

    ::ng-deep .tenders-table .mat-mdc-header-row {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    ::ng-deep .tenders-table .mat-mdc-header-cell {
      color: white !important;
      font-weight: 600;
    }

    .company-chip {
      padding: 4px 10px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      font-size: 12px;
    }

    .tender-link {
      color: #1e90ff;
      cursor: pointer;
      font-weight: 500;
    }
    .tender-link:hover { text-decoration: underline; }

    .title-cell {
      display: flex;
      flex-direction: column;
    }
    .tender-title {
      font-weight: 500;
      max-width: 250px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tender-dept {
      font-size: 12px;
      color: #666;
    }

    .closing-cell {
      display: flex;
      flex-direction: column;
    }
    .closing-cell.urgent .closing-date { color: #F44336; font-weight: 600; }
    .days-left { font-size: 12px; color: #666; }

    .status-chip {
      padding: 6px 14px;
      border-radius: 20px;
      color: white;
      font-size: 12px;
      font-weight: 500;
    }

    .workflow-badge {
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 500;
      background: #E0E0E0;
    }
    .workflow-draft { background: #E3F2FD; color: #1565C0; }
    .workflow-review { background: #FFF3E0; color: #E65100; }
    .workflow-director-signoff { background: #F3E5F5; color: #7B1FA2; }
    .workflow-submission-ready { background: #E8F5E9; color: #2E7D32; }

    .priority-critical { color: #D32F2F; }
    .priority-high { color: #F57C00; }
    .priority-medium { color: #FBC02D; }
    .priority-low { color: #9E9E9E; }

    .delete-action { color: #F44336 !important; }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 60px;
    }

    /* Compliance Tab */
    .compliance-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .compliance-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px;
      text-align: center;
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      transition: all 0.3s ease;
    }

    .compliance-stat:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
    }

    .compliance-stat mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .compliance-stat .value { font-size: 36px; font-weight: 700; margin: 8px 0; color: #1a1a2e; }
    .compliance-stat .label { color: #666; }

    .compliance-stat.valid mat-icon { color: #4CAF50; }
    .compliance-stat.expiring mat-icon { color: #FF9800; }
    .compliance-stat.warning mat-icon { color: #F44336; }
    .compliance-stat.expired mat-icon { color: #9E9E9E; }

    .compliance-actions {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }

    .compliance-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }

    .company-compliance-card {
      border-top: 4px solid #E0E0E0;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }

    .company-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .doc-types { margin-top: 16px; }

    .doc-row {
      display: flex;
      align-items: center;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 8px;
      background: #FAFAFA;
    }

    .doc-row.status-valid { background: #E8F5E9; border-left: 3px solid #4CAF50; }
    .doc-row.status-expiring { background: #FFF3E0; border-left: 3px solid #FF9800; }
    .doc-row.status-warning { background: #FFEBEE; border-left: 3px solid #F44336; }
    .doc-row.status-expired { background: #FAFAFA; border-left: 3px solid #9E9E9E; }
    .doc-row.missing { background: #FFF; border: 1px dashed #CCC; }

    .doc-info {
      display: flex;
      align-items: center;
      flex: 1;
    }
    .doc-info mat-icon { margin-right: 8px; color: #666; }
    .doc-name { font-weight: 500; }

    .doc-status {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      margin-right: 8px;
    }
    .expiry { font-size: 12px; color: #666; }

    .days-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 500;
    }
    .days-badge.valid { background: #C8E6C9; color: #2E7D32; }
    .days-badge.expiring { background: #FFE0B2; color: #E65100; }
    .days-badge.warning { background: #FFCDD2; color: #C62828; }
    .days-badge.expired { background: #EEEEEE; color: #616161; }

    .missing-badge {
      padding: 4px 12px;
      background: #FFF3E0;
      color: #E65100;
      border-radius: 12px;
      font-size: 12px;
      margin-right: 8px;
    }

    /* Calendar Tab */
    .calendar-card {
      overflow: hidden;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }

    .calendar-card mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 20px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
    }

    .calendar-card mat-card-header mat-card-title {
      color: white;
    }

    .calendar-legend {
      display: flex;
      gap: 16px;
      font-size: 12px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 4px;
      color: rgba(255, 255, 255, 0.9);
    }
    .legend-item .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .legend-item.closing .dot { background: #F44336; }
    .legend-item.briefing .dot { background: #64B5F6; }
    .legend-item.site-visit .dot { background: #4CAF50; }
    .legend-item.clarification .dot { background: #FF9800; }
    .legend-item.evaluation .dot { background: #9C27B0; }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background: #E0E0E0;
      border: 1px solid #E0E0E0;
      border-radius: 0 0 16px 16px;
      overflow: hidden;
    }

    .day-header {
      background: #F8F9FA;
      padding: 12px;
      text-align: center;
      font-weight: 600;
      color: #1e90ff;
    }

    .calendar-day {
      background: white;
      min-height: 100px;
      padding: 8px;
      position: relative;
      transition: all 0.2s ease;
    }
    .calendar-day:hover { background: #f0f8ff; }
    .calendar-day.other-month { background: #FAFAFA; }
    .calendar-day.other-month .day-number { color: #CCC; }
    .calendar-day.today { background: #E3F2FD; }
    .calendar-day.today .day-number { color: #1e90ff; font-weight: 700; }

    .day-number {
      font-size: 14px;
      font-weight: 500;
    }

    .day-events { margin-top: 4px; }

    .event {
      display: flex;
      align-items: center;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 10px;
      margin-bottom: 2px;
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
    }
    .event:hover { opacity: 0.8; }

    .event-company {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-right: 4px;
      flex-shrink: 0;
    }

    .event-closing { background: #FFCDD2; color: #C62828; }
    .event-briefing { background: #BBDEFB; color: #1565C0; }
    .event-siteVisit { background: #C8E6C9; color: #2E7D32; }
    .event-clarification { background: #FFE0B2; color: #E65100; }
    .event-evaluation { background: #E1BEE7; color: #6A1B9A; }

    /* Analytics Tab */
    .analytics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .analytics-card { 
      padding: 20px;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      background: white;
    }

    ::ng-deep .analytics-card mat-card-header {
      border-bottom: 1px solid #eee;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    ::ng-deep .analytics-card mat-card-title {
      color: #1a1a2e;
      font-size: 16px;
      font-weight: 600;
    }

    .big-stat {
      text-align: center;
      margin: 24px 0;
    }
    .big-stat .value {
      font-size: 56px;
      font-weight: 700;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .big-stat mat-progress-bar { margin-top: 16px; border-radius: 8px; }

    ::ng-deep .big-stat .mat-mdc-progress-bar {
      height: 8px;
      border-radius: 8px;
    }

    ::ng-deep .big-stat .mdc-linear-progress__bar-inner {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .stat-breakdown {
      display: flex;
      justify-content: space-around;
      margin-top: 16px;
    }
    .breakdown-item { text-align: center; }
    .breakdown-item .label { display: block; font-size: 12px; color: #666; }
    .breakdown-item .value { font-size: 24px; font-weight: 600; }
    .breakdown-item.won .value { color: #4CAF50; }
    .breakdown-item.lost .value { color: #F44336; }

    .value-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #EEE;
    }
    .value-row .value { font-weight: 600; }
    .value-row .value.highlight { color: #4CAF50; font-size: 18px; }

    .bar-row {
      display: flex;
      align-items: center;
      margin-bottom: 12px;
    }
    .bar-row .label { width: 60px; font-size: 12px; }
    .bar-container {
      flex: 1;
      height: 24px;
      background: #EEE;
      border-radius: 12px;
      margin: 0 8px;
      overflow: hidden;
    }
    .bar {
      height: 100%;
      background: linear-gradient(90deg, #1e90ff, #4169e1);
      border-radius: 12px;
      transition: width 0.5s ease;
    }
    .bar-row .value { width: 30px; text-align: right; font-weight: 600; }

    .status-row, .company-row, .dept-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 0;
      border-bottom: 1px solid #EEE;
    }
    .status-row .value, .company-row .value, .dept-row .value { font-weight: 600; }

    /* AI Document Analyzer Styles */
    .ai-analyzer-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .upload-section {
      background: white;
      border-radius: 16px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }

    .upload-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .upload-header mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1e90ff;
    }

    .upload-header h3 {
      margin: 12px 0 8px 0;
      font-size: 24px;
      color: #1a1a2e;
    }

    .upload-header p {
      color: #666;
      margin: 0;
    }

    .drop-zone {
      border: 2px dashed #ccc;
      border-radius: 16px;
      padding: 48px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      background: #fafafa;
    }

    .drop-zone:hover {
      border-color: #1e90ff;
      background: #f0f7ff;
    }

    .drop-zone.dragover {
      border-color: #1e90ff;
      background: #e3f2fd;
      transform: scale(1.02);
    }

    .drop-zone.has-file {
      border-style: solid;
      border-color: #4CAF50;
      background: #E8F5E9;
      padding: 24px;
    }

    .upload-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ccc;
    }

    .drop-zone:hover .upload-icon {
      color: #1e90ff;
    }

    .drop-text {
      font-size: 18px;
      color: #666;
      margin: 16px 0 8px 0;
    }

    .drop-hint {
      font-size: 13px;
      color: #999;
      margin: 0;
    }

    .file-info {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }

    .pdf-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #F44336;
    }

    .file-details {
      text-align: left;
    }

    .file-name {
      display: block;
      font-weight: 600;
      color: #333;
      font-size: 16px;
    }

    .file-size {
      display: block;
      font-size: 13px;
      color: #666;
    }

    .analyze-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 24px auto 0;
      padding: 12px 32px;
      font-size: 16px;
    }

    .analyze-btn mat-spinner {
      margin-right: 8px;
    }

    /* ── Analyzer Progress Bar ── */
    .analyzer-progress {
      background: white;
      border-radius: 16px;
      padding: 24px;
      margin-top: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      border: 1px solid #e2e8f0;
    }

    .analyzer-progress-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
    }

    .analyzer-pulse-icon {
      color: #ffd700;
      font-size: 22px;
      width: 22px;
      height: 22px;
      animation: analyzerPulse 1.5s ease-in-out infinite;
    }

    @keyframes analyzerPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(1.15); }
    }

    .analyzer-progress-title {
      font-size: 15px;
      font-weight: 700;
      color: #1e293b;
      flex: 1;
    }

    .analyzer-progress-timer {
      font-family: 'SF Mono', 'Cascadia Code', monospace;
      font-size: 13px;
      font-weight: 700;
      color: #64748b;
      background: #f1f5f9;
      padding: 3px 10px;
      border-radius: 8px;
    }

    .analyzer-progress-track {
      width: 100%;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 16px;
    }

    .analyzer-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7);
      border-radius: 4px;
      transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
    }

    .analyzer-progress-fill::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      animation: analyzerShimmer 1.5s infinite;
    }

    @keyframes analyzerShimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }

    .analyzer-progress-steps {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 12px;
    }

    .analyzer-step {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      color: #94a3b8;
      transition: all 0.3s;
    }

    .analyzer-step.active {
      color: #6366f1;
      font-weight: 600;
    }

    .analyzer-step.done {
      color: #22c55e;
    }

    .analyzer-step-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .analyzer-step-icon mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .analyzer-step.done .analyzer-step-icon mat-icon { color: #22c55e; }
    .analyzer-step:not(.done):not(.active) .analyzer-step-icon mat-icon { color: #cbd5e1; }

    .analyzer-progress-msg {
      text-align: center;
      color: #64748b;
      font-size: 13px;
      margin: 8px 0 0;
      font-style: italic;
    }

    /* Chat Section */
    .chat-section {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 600px;
    }

    .chat-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
    }

    .chat-header h4 {
      margin: 0;
      font-size: 18px;
    }

    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: #f8f9fa;
    }

    .message {
      display: flex;
      gap: 12px;
      max-width: 80%;
    }

    .message.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }

    .message-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .message.assistant .message-avatar {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
    }

    .message.user .message-avatar {
      background: #E0E0E0;
      color: #666;
    }

    .message-content {
      background: white;
      padding: 12px 16px;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .message.user .message-content {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
    }

    .message-text {
      font-size: 14px;
      line-height: 1.6;
    }

    .message-text ul, .message-text ol {
      margin: 8px 0;
      padding-left: 20px;
    }

    .message-text li {
      margin: 4px 0;
    }

    .message-time {
      display: block;
      font-size: 11px;
      color: #999;
      margin-top: 6px;
    }

    .message.user .message-time {
      color: rgba(255, 255, 255, 0.7);
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 8px 0;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #1e90ff;
      animation: typing 1.4s infinite ease-in-out;
    }

    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes typing {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-8px); opacity: 1; }
    }

    .quick-questions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 24px;
      background: #f0f0f0;
      border-top: 1px solid #e0e0e0;
    }

    .quick-label {
      font-size: 12px;
      color: #666;
      align-self: center;
      margin-right: 8px;
    }

    .quick-questions button {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 16px;
    }

    .chat-input {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: white;
      border-top: 1px solid #e0e0e0;
    }

    .message-input {
      flex: 1;
    }

    ::ng-deep .message-input .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    @media (max-width: 1200px) {
      .stats-row { grid-template-columns: repeat(3, 1fr); }
      .compliance-grid { grid-template-columns: repeat(2, 1fr); }
      .modern-header { flex-direction: column; align-items: flex-start; }
    }

    @media (max-width: 768px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .filter-row { flex-direction: column; }
      .compliance-summary { grid-template-columns: repeat(2, 1fr); }
      .compliance-grid { grid-template-columns: 1fr; }
      .analytics-grid { grid-template-columns: 1fr; }
      .header-text-area h1 { font-size: 24px; }
      .header-icon-wrapper { width: 56px; height: 56px; }
      .header-icon-wrapper mat-icon { font-size: 32px; width: 32px; height: 32px; }
      .header-stats-row { width: 100%; }
      .mini-stat { flex: 1; justify-content: center; }
    }

    @media (max-width: 480px) {
      .stats-row { grid-template-columns: 1fr; }
      .compliance-summary { grid-template-columns: 1fr; }
      .quick-actions { flex-wrap: wrap; }
      .quick-actions button { flex: 1; min-width: 120px; }
    }

    /* Create Reminder Button */
    .create-reminder-btn {
      margin-left: 16px;
      font-size: 12px;
      height: 32px;
      line-height: 32px;
    }
    .create-reminder-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 4px;
    }

    /* Reminders Card */
    .reminders-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
    }
    .reminder-count-badge {
      background: #667eea;
      color: white;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 12px;
      margin-left: 8px;
      vertical-align: middle;
    }
    .no-reminders {
      text-align: center;
      padding: 32px;
    }
    .reminders-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .reminder-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-radius: 8px;
      background: #f8f9ff;
      border: 1px solid #e8eaf6;
      transition: all 0.2s;
    }
    .reminder-item:hover {
      background: #f0f1ff;
      border-color: #c5cae9;
    }
    .reminder-sent {
      opacity: 0.6;
      background: #f5f5f5;
      border-color: #e0e0e0;
    }
    .reminder-due {
      background: #fff3e0;
      border-color: #ffcc02;
      animation: pulse-border 2s infinite;
    }
    @keyframes pulse-border {
      0%, 100% { border-color: #ffcc02; }
      50% { border-color: #ff9800; }
    }
    .reminder-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }
    .reminder-type-icon {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: white;
    }
    .event-type-closingdate { background: #f44336; color: white; }
    .event-type-briefing { background: #2196f3; color: white; }
    .event-type-sitevisit { background: #4caf50; color: white; }
    .event-type-clarification { background: #ff9800; color: white; }
    .event-type-evaluation { background: #9c27b0; color: white; }
    .reminder-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .reminder-info strong {
      font-size: 14px;
      color: #1f2937;
    }
    .reminder-meta {
      font-size: 12px;
      color: #6b7280;
    }
    .reminder-emails {
      font-size: 11px;
      color: #667eea;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .reminder-notes {
      font-size: 11px;
      color: #9e9e9e;
      font-style: italic;
    }
    .reminder-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .sent-chip {
      font-size: 11px !important;
      min-height: 24px !important;
      background: #e8f5e9 !important;
      color: #2e7d32 !important;
    }
    .due-chip {
      font-size: 11px !important;
      min-height: 24px !important;
      background: #fff3e0 !important;
      color: #ef6c00 !important;
    }
    .sent-chip mat-icon, .due-chip mat-icon {
      font-size: 14px !important;
      width: 14px !important;
      height: 14px !important;
      margin-right: 4px;
    }

    /* Reminder Dialog Overlay */
    .reminder-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(4px);
    }
    .reminder-dialog {
      background: white;
      border-radius: 16px;
      width: 520px;
      max-width: 95vw;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
      animation: dialog-in 0.25s ease-out;
    }
    @keyframes dialog-in {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    .reminder-dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 16px 16px 0 0;
    }
    .reminder-dialog-header h2 {
      margin: 0;
      font-size: 18px;
      flex: 1;
    }
    .reminder-dialog-header button {
      color: white;
    }
    .reminder-dialog-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .full-width {
      width: 100%;
    }
    .reminder-preview {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #e8f5e9;
      border-radius: 8px;
      font-size: 13px;
      color: #2e7d32;
    }
    .reminder-preview mat-icon {
      font-size: 20px;
      color: #4caf50;
    }
    .reminder-dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #eee;
    }
  `]
})
export class TendersComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  private destroy$ = new Subject<void>();
  
  // Data
  tenders: Tender[] = [];
  tendersDataSource = new MatTableDataSource<Tender>();
  stats: TenderStats | null = null;
  complianceDocs: ComplianceDocument[] = [];
  complianceSummary: ComplianceSummary | null = null;
  calendarEvents: CalendarEvent[] = [];
  calendarDays: { date: Date; currentMonth: boolean; isToday: boolean; events: CalendarEvent[] }[] = [];
  calendarMonth = new Date();

  // UI State
  loading = false;
  selectedTab = 0;
  searchTerm = '';
  selectedCompany = '';
  selectedProvince = '';
  selectedStatus = '';
  selectedDepartment = '';

  // Display columns
  displayedColumns = ['companyCode', 'tenderNumber', 'title', 'province', 'estimatedValue', 'closingDate', 'status', 'workflowStatus', 'priority', 'actions'];

  // Reference data
  companies: Company[] = [
    { code: 'PMT', name: 'Promed Tech', color: '#1976D2' },
    { code: 'SBT', name: 'Sebenzani', color: '#4CAF50' },
    { code: 'ACM', name: 'Access Medical', color: '#9C27B0' },
    { code: 'PHT', name: 'Pharatech', color: '#FF5722' },
    { code: 'SEY', name: 'SharpEye', color: '#E91E63' },
    { code: 'SAW', name: 'SA Wellness', color: '#00BCD4' },
    { code: 'PHC', name: 'Pharmacare', color: '#FF9800' },
    { code: 'JVT', name: 'Joint Venture', color: '#607D8B' }
  ];

  provinces = ['KZN', 'WC', 'EC', 'GP', 'FS', 'NC', 'NW', 'LP', 'MP'];

  statuses = [
    { value: 'Draft', label: 'Draft', color: '#4CAF50' },
    { value: 'Submitted', label: 'Submitted', color: '#2196F3' },
    { value: 'Clarification', label: 'Clarification', color: '#FF9800' },
    { value: 'Evaluation', label: 'Evaluation', color: '#9C27B0' },
    { value: 'Awarded', label: 'Awarded', color: '#FFC107' },
    { value: 'Lost', label: 'Lost', color: '#F44336' },
    { value: 'Cancelled', label: 'Cancelled', color: '#212121' }
  ];

  workflowStatuses = ['Draft', 'Review', 'Director Signoff', 'Submission Ready'];

  departments = ['Health', 'Education', 'Infrastructure', 'Transport', 'Social Development', 'Treasury', 'Other'];

  documentTypes = [
    { value: 'CSD', label: 'CSD Registration', icon: 'verified' },
    { value: 'TaxClearance', label: 'Tax Clearance', icon: 'receipt' },
    { value: 'BBBEE', label: 'B-BBEE Certificate', icon: 'workspace_premium' },
    { value: 'CIDB', label: 'CIDB Grading', icon: 'construction' },
    { value: 'CompanyRegistration', label: 'Company Registration', icon: 'business' },
    { value: 'BankConfirmation', label: 'Bank Confirmation', icon: 'account_balance' },
    { value: 'COIDA', label: 'COIDA Letter', icon: 'security' },
    { value: 'ISO', label: 'ISO Certification', icon: 'stars' }
  ];

  // AI Document Analyzer
  analyzerDocument: File | null = null;
  analyzerMessages: { id: number; role: 'user' | 'assistant'; content: string; timestamp: Date }[] = [];
  isDragOver = false;
  documentAnalyzed = false;
  analyzingDocument = false;
  aiThinking = false;
  analyzerQuestion = '';

  // Analyzer progress tracking
  analyzerProgressPercent = 0;
  analyzerCurrentStep = 0;
  analyzerElapsedTime = '0:00';
  analyzerProgressMessage = 'Uploading document...';
  analyzerProgressSteps = [
    { label: 'Uploading document to server' },
    { label: 'Extracting text from PDF' },
    { label: 'Analyzing content with AI' },
    { label: 'Generating summary' }
  ];
  private analyzerTimerInterval: any = null;
  private analyzerProgressTimeouts: any[] = [];
  private analyzerStartTime = 0;

  // Tender Reminders
  reminders: TenderReminder[] = [];
  showReminderDialog = false;
  reminderForm = {
    tenderId: 0,
    eventType: '',
    daysBefore: 3,
    emailRecipients: '',
    notes: ''
  };
  selectedReminderTender: Tender | null = null;
  reminderEventTypes = [
    { value: 'ClosingDate', label: 'Closing Date', icon: 'event_busy' },
    { value: 'Briefing', label: 'Compulsory Briefing', icon: 'groups' },
    { value: 'SiteVisit', label: 'Site Visit', icon: 'location_on' },
    { value: 'Clarification', label: 'Clarification Deadline', icon: 'help_outline' },
    { value: 'Evaluation', label: 'Evaluation Date', icon: 'rate_review' }
  ];

  constructor(
    private tenderService: TenderService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    this.tendersDataSource.paginator = this.paginator;
    this.tendersDataSource.sort = this.sort;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.loading = true;
    forkJoin({
      tenders: this.tenderService.getTenders(),
      stats: this.tenderService.getStats(),
      compliance: this.tenderService.getComplianceDocuments(),
      complianceSummary: this.tenderService.getComplianceSummary(),
      calendar: this.tenderService.getCalendarEvents()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => {
        this.tenders = data.tenders;
        this.tendersDataSource.data = data.tenders;
        this.stats = data.stats;
        this.complianceDocs = data.compliance;
        this.complianceSummary = data.complianceSummary;
        this.calendarEvents = data.calendar;
        this.buildCalendar();
        this.loading = false;
        this.loadReminders();
      },
      error: (err) => {
        console.error('Error loading data:', err);
        this.loading = false;
        this.snackBar.open('Error loading tender data', 'Close', { duration: 3000 });
      }
    });
  }

  applyFilters(): void {
    this.loading = true;
    this.tenderService.getTenders({
      status: this.selectedStatus || undefined,
      province: this.selectedProvince || undefined,
      department: this.selectedDepartment || undefined,
      companyCode: this.selectedCompany || undefined,
      search: this.searchTerm || undefined
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: (tenders) => {
        this.tendersDataSource.data = tenders;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Error filtering tenders', 'Close', { duration: 3000 });
      }
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCompany = '';
    this.selectedProvince = '';
    this.selectedStatus = '';
    this.selectedDepartment = '';
    this.tendersDataSource.data = this.tenders;
  }

  filterByStatus(status: string | null): void {
    this.selectedStatus = status || '';
    this.applyFilters();
  }

  filterByClosingWeek(): void {
    const now = new Date();
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    this.tenderService.getTenders({ fromDate: now, toDate: endOfWeek }).subscribe({
      next: (tenders) => {
        this.tendersDataSource.data = tenders;
      }
    });
  }

  getCompanyColor(code: string): string {
    return this.companies.find(c => c.code === code)?.color || '#666';
  }

  getStatusColor(status: string): string {
    return this.statuses.find(s => s.value === status)?.color || '#666';
  }

  getDaysUntilClosing(date: Date): number {
    const closing = new Date(date);
    const now = new Date();
    return Math.ceil((closing.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  getComplianceDoc(companyCode: string, docType: string): ComplianceDocument | undefined {
    return this.complianceDocs.find(d => d.companyCode === companyCode && d.documentType === docType);
  }

  // Calendar methods
  buildCalendar(): void {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    this.calendarDays = [];
    const current = new Date(startDate);
    
    for (let i = 0; i < 42; i++) {
      const date = new Date(current);
      const events = this.calendarEvents.filter(e => {
        const eventDate = new Date(e.start);
        return eventDate.getFullYear() === date.getFullYear() &&
               eventDate.getMonth() === date.getMonth() &&
               eventDate.getDate() === date.getDate();
      });
      
      this.calendarDays.push({
        date,
        currentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        events
      });
      
      current.setDate(current.getDate() + 1);
    }
  }

  prevMonth(): void {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1, 1);
    this.loadCalendarEvents();
  }

  nextMonth(): void {
    this.calendarMonth = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 1, 1);
    this.loadCalendarEvents();
  }

  loadCalendarEvents(): void {
    const start = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() - 1, 1);
    const end = new Date(this.calendarMonth.getFullYear(), this.calendarMonth.getMonth() + 2, 0);
    this.tenderService.getCalendarEvents(start, end).subscribe({
      next: (events) => {
        this.calendarEvents = events;
        this.buildCalendar();
      }
    });
  }

  openTenderFromEvent(event: CalendarEvent): void {
    this.tenderService.getTender(event.tenderId).subscribe({
      next: (tender) => this.openTenderDetail(tender)
    });
  }

  // Analytics helpers
  getObjectEntries(obj: { [key: string]: number }): [string, number][] {
    return Object.entries(obj);
  }

  getTopEntries(obj: { [key: string]: number }, count: number): [string, number][] {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, count);
  }

  getBarWidth(value: number, obj: { [key: string]: number }): number {
    const max = Math.max(...Object.values(obj));
    return max > 0 ? (value / max) * 100 : 0;
  }

  // Dialog methods
  openCreateTender(): void {
    const dialogRef = this.dialog.open(TenderDetailDialogComponent, {
      width: '95vw',
      maxWidth: '1600px',
      maxHeight: '95vh',
      panelClass: 'tender-dialog-panel',
      data: { mode: 'create', companies: this.companies, provinces: this.provinces, departments: this.departments }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  openTenderDetail(tender: Tender): void {
    const dialogRef = this.dialog.open(TenderDetailDialogComponent, {
      width: '95vw',
      maxWidth: '1600px',
      maxHeight: '95vh',
      panelClass: 'tender-dialog-panel',
      data: { mode: 'view', tender, companies: this.companies, provinces: this.provinces, departments: this.departments }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  editTender(tender: Tender): void {
    const dialogRef = this.dialog.open(TenderDetailDialogComponent, {
      width: '95vw',
      maxWidth: '1600px',
      maxHeight: '95vh',
      panelClass: 'tender-dialog-panel',
      data: { mode: 'edit', tender, companies: this.companies, provinces: this.provinces, departments: this.departments }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  updateTenderStatus(tender: Tender, status: string): void {
    this.tenderService.updateStatus(tender.id, status).subscribe({
      next: () => {
        this.snackBar.open('Status updated', 'Close', { duration: 2000 });
        this.loadData();
      },
      error: () => this.snackBar.open('Error updating status', 'Close', { duration: 3000 })
    });
  }

  updateTenderWorkflow(tender: Tender, workflow: string): void {
    this.tenderService.updateWorkflow(tender.id, workflow).subscribe({
      next: () => {
        this.snackBar.open('Workflow updated', 'Close', { duration: 2000 });
        this.loadData();
      },
      error: () => this.snackBar.open('Error updating workflow', 'Close', { duration: 3000 })
    });
  }

  deleteTender(tender: Tender): void {
    if (confirm(`Are you sure you want to delete tender ${tender.tenderNumber}?`)) {
      this.tenderService.deleteTender(tender.id).subscribe({
        next: () => {
          this.snackBar.open('Tender deleted', 'Close', { duration: 2000 });
          this.loadData();
        },
        error: () => this.snackBar.open('Error deleting tender', 'Close', { duration: 3000 })
      });
    }
  }

  // Compliance methods
  openAddCompliance(companyCode?: string, docType?: string): void {
    const dialogRef = this.dialog.open(ComplianceDialogComponent, {
      width: '600px',
      data: { mode: 'create', companies: this.companies, documentTypes: this.documentTypes, companyCode, docType }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  viewComplianceDoc(doc: ComplianceDocument): void {
    const dialogRef = this.dialog.open(ComplianceDialogComponent, {
      width: '600px',
      data: { mode: 'view', document: doc, companies: this.companies, documentTypes: this.documentTypes }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  previewComplianceDoc(doc: ComplianceDocument): void {
    if (!doc.fileName) {
      this.snackBar.open('No file uploaded for this document', 'Close', { duration: 3000 });
      return;
    }

    this.tenderService.downloadComplianceDocument(doc.id).subscribe({
      next: (blob) => {
        // Create a blob URL and open in new tab
        const fileURL = window.URL.createObjectURL(blob);
        window.open(fileURL, '_blank');
      },
      error: () => this.snackBar.open('Error loading document preview', 'Close', { duration: 3000 })
    });
  }

  isPdfFile(doc: ComplianceDocument): boolean {
    if (!doc.fileName) return false;
    const ext = doc.fileName.toLowerCase();
    return ext.endsWith('.pdf') || doc.mimeType === 'application/pdf';
  }

  editComplianceDoc(doc: ComplianceDocument): void {
    const dialogRef = this.dialog.open(ComplianceDialogComponent, {
      width: '600px',
      data: { mode: 'edit', document: doc, companies: this.companies, documentTypes: this.documentTypes }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  downloadComplianceDoc(doc: ComplianceDocument): void {
    this.tenderService.downloadComplianceDocument(doc.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.fileName || 'document';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('Error downloading document', 'Close', { duration: 3000 })
    });
  }

  checkComplianceAlerts(): void {
    this.tenderService.checkAndSendAlerts().subscribe({
      next: (result) => {
        this.snackBar.open(`${result.alertsCreated} alerts generated`, 'Close', { duration: 3000 });
        this.loadData();
      },
      error: () => this.snackBar.open('Error checking alerts', 'Close', { duration: 3000 })
    });
  }

  // AI Document Analyzer Methods
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf') {
        this.analyzerDocument = file;
        this.documentAnalyzed = false;
        this.analyzerMessages = [];
      } else {
        this.snackBar.open('Please upload a PDF file', 'Close', { duration: 3000 });
      }
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      if (file.type === 'application/pdf') {
        this.analyzerDocument = file;
        this.documentAnalyzed = false;
        this.analyzerMessages = [];
      } else {
        this.snackBar.open('Please upload a PDF file', 'Close', { duration: 3000 });
      }
    }
  }

  removeAnalyzerDocument(event: Event): void {
    event.stopPropagation();
    this.analyzerDocument = null;
    this.documentAnalyzed = false;
    this.analyzerMessages = [];
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  analyzeDocument(): void {
    if (!this.analyzerDocument) return;

    this.analyzingDocument = true;
    this.startAnalyzerProgress();
    console.log('Starting document analysis...', this.analyzerDocument.name, this.analyzerDocument.size);
    
    // Create FormData and send to AI service
    const formData = new FormData();
    formData.append('file', this.analyzerDocument);
    formData.append('prompt', 'Analyze this tender document and provide a summary including: 1) The tender title and reference number, 2) The issuing entity, 3) Key dates (closing date, validity period, briefing sessions), 4) Required documents and compliance requirements, 5) Estimated value or budget, 6) Key evaluation criteria. Format your response clearly with sections.');

    console.log('Sending request to /api/aichat/analyze-document');
    this.http.post<{ response: string }>('/api/aichat/analyze-document', formData).subscribe({
      next: (result) => {
        console.log('Analysis complete:', result);
        this.stopAnalyzerProgress();
        this.analyzerProgressPercent = 100;
        this.analyzerCurrentStep = this.analyzerProgressSteps.length;
        this.analyzingDocument = false;
        this.documentAnalyzed = true;
        this.analyzerMessages = [{
          id: 1,
          role: 'assistant',
          content: result.response,
          timestamp: new Date()
        }];
      },
      error: (err) => {
        console.error('Analysis error:', err);
        this.stopAnalyzerProgress();
        this.analyzingDocument = false;
        this.snackBar.open('Error analyzing document: ' + (err.error?.error || err.message || 'Unknown error'), 'Close', { duration: 5000 });
      }
    });
  }

  private startAnalyzerProgress(): void {
    this.analyzerStartTime = Date.now();
    this.analyzerProgressPercent = 0;
    this.analyzerCurrentStep = 0;
    this.analyzerElapsedTime = '0:00';
    this.analyzerProgressMessage = 'Uploading document...';

    this.analyzerTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.analyzerStartTime) / 1000);
      const min = Math.floor(elapsed / 60);
      const sec = elapsed % 60;
      this.analyzerElapsedTime = `${min}:${sec.toString().padStart(2, '0')}`;
    }, 1000);

    const stepTimings = [
      { delay: 0, step: 0, percent: 5, msg: 'Uploading document to server...' },
      { delay: 3000, step: 0, percent: 12, msg: 'Uploading document to server...' },
      { delay: 6000, step: 1, percent: 20, msg: 'Extracting text from your PDF...' },
      { delay: 12000, step: 1, percent: 28, msg: 'Text extraction in progress...' },
      { delay: 18000, step: 2, percent: 35, msg: 'Welly is reading the document...' },
      { delay: 30000, step: 2, percent: 42, msg: 'Analyzing requirements and dates...' },
      { delay: 50000, step: 2, percent: 50, msg: 'Reviewing compliance requirements...' },
      { delay: 75000, step: 2, percent: 58, msg: 'Evaluating pricing and criteria...' },
      { delay: 100000, step: 2, percent: 65, msg: 'Still thinking — complex document...' },
      { delay: 130000, step: 2, percent: 72, msg: 'Welly is thorough — almost done with analysis...' },
      { delay: 160000, step: 3, percent: 80, msg: 'Generating summary and insights...' },
      { delay: 200000, step: 3, percent: 85, msg: 'Polishing the final report...' },
      { delay: 240000, step: 3, percent: 88, msg: 'Wrapping up — just a moment...' },
      { delay: 280000, step: 3, percent: 91, msg: 'Finalizing analysis...' },
      { delay: 320000, step: 3, percent: 93, msg: 'Almost there...' },
    ];

    this.analyzerProgressTimeouts = stepTimings.map(t =>
      setTimeout(() => {
        if (this.analyzingDocument) {
          this.analyzerProgressPercent = t.percent;
          this.analyzerCurrentStep = t.step;
          this.analyzerProgressMessage = t.msg;
        }
      }, t.delay)
    );
  }

  private stopAnalyzerProgress(): void {
    if (this.analyzerTimerInterval) {
      clearInterval(this.analyzerTimerInterval);
      this.analyzerTimerInterval = null;
    }
    if (this.analyzerProgressTimeouts) {
      this.analyzerProgressTimeouts.forEach(t => clearTimeout(t));
      this.analyzerProgressTimeouts = [];
    }
  }

  sendAnalyzerQuestion(): void {
    if (!this.analyzerQuestion.trim() || !this.documentAnalyzed) return;

    const question = this.analyzerQuestion.trim();
    this.analyzerQuestion = '';

    // Add user message
    this.analyzerMessages.push({
      id: this.analyzerMessages.length + 1,
      role: 'user',
      content: question,
      timestamp: new Date()
    });

    this.aiThinking = true;

    // Send question to AI with document context
    const formData = new FormData();
    if (this.analyzerDocument) {
      formData.append('file', this.analyzerDocument);
    }
    formData.append('prompt', question);
    formData.append('context', JSON.stringify(this.analyzerMessages.slice(0, -1)));

    this.http.post<{ response: string }>('/api/aichat/analyze-document', formData).subscribe({
      next: (result) => {
        this.aiThinking = false;
        this.analyzerMessages.push({
          id: this.analyzerMessages.length + 1,
          role: 'assistant',
          content: result.response,
          timestamp: new Date()
        });
      },
      error: () => {
        this.aiThinking = false;
        this.snackBar.open('Error getting response. Please try again.', 'Close', { duration: 3000 });
      }
    });
  }

  askQuickQuestion(question: string): void {
    this.analyzerQuestion = question;
    this.sendAnalyzerQuestion();
  }

  formatMessage(content: string): string {
    // Convert markdown-like formatting to HTML
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n- /g, '<br>• ')
      .replace(/\n\d+\. /g, (match) => '<br>' + match.trim() + ' ')
      .replace(/\n/g, '<br>');
  }

  // ==================== TENDER REMINDERS ====================

  loadReminders(): void {
    this.tenderService.getReminders().pipe(takeUntil(this.destroy$)).subscribe({
      next: (reminders) => {
        this.reminders = reminders;
      },
      error: (err) => {
        console.error('Error loading reminders:', err);
      }
    });
  }

  openReminderDialog(tender?: Tender): void {
    this.showReminderDialog = true;
    this.reminderForm = {
      tenderId: tender?.id || 0,
      eventType: '',
      daysBefore: 3,
      emailRecipients: '',
      notes: ''
    };
    if (tender) {
      this.selectedReminderTender = tender;
    } else {
      this.selectedReminderTender = null;
    }
  }

  closeReminderDialog(): void {
    this.showReminderDialog = false;
    this.selectedReminderTender = null;
  }

  onReminderTenderChange(): void {
    this.selectedReminderTender = this.tenders.find(t => t.id === this.reminderForm.tenderId) || null;
    this.reminderForm.eventType = '';
  }

  isEventAvailable(eventType: string): boolean {
    if (!this.selectedReminderTender) return false;
    const t = this.selectedReminderTender;
    switch (eventType) {
      case 'ClosingDate': return !!t.closingDate;
      case 'Briefing': return !!t.compulsoryBriefingDate;
      case 'SiteVisit': return !!t.siteVisitDate;
      case 'Clarification': return !!t.clarificationDeadline;
      case 'Evaluation': return !!t.evaluationDate;
      default: return false;
    }
  }

  getEventTypeLabel(eventType: string): string {
    const found = this.reminderEventTypes.find(e => e.value === eventType);
    return found ? found.label : eventType;
  }

  getEventTypeIcon(eventType: string): string {
    const found = this.reminderEventTypes.find(e => e.value === eventType);
    return found ? found.icon : 'notifications';
  }

  submitReminder(): void {
    if (!this.reminderForm.tenderId || !this.reminderForm.eventType || !this.reminderForm.emailRecipients) return;

    const user = this.authService.currentUserValue;
    this.tenderService.createReminder({
      tenderId: this.reminderForm.tenderId,
      eventType: this.reminderForm.eventType,
      daysBefore: this.reminderForm.daysBefore,
      emailRecipients: this.reminderForm.emailRecipients,
      notes: this.reminderForm.notes || undefined,
      createdByUserId: user?.userId || 0,
      createdByUserName: user ? `${user.name} ${user.surname || ''}`.trim() : 'Unknown'
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.closeReminderDialog();
        this.loadReminders();
        this.snackBar.open('✅ Reminder created successfully! Welly will send the email.', 'Close', { duration: 4000 });
      },
      error: (err) => {
        const msg = err.error || 'Failed to create reminder';
        this.snackBar.open('Error: ' + msg, 'Close', { duration: 4000 });
      }
    });
  }

  deleteReminder(reminder: TenderReminder): void {
    if (!confirm(`Delete this ${this.getEventTypeLabel(reminder.eventType)} reminder?`)) return;

    this.tenderService.deleteReminder(reminder.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.loadReminders();
        this.snackBar.open('Reminder deleted', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Error deleting reminder', 'Close', { duration: 3000 });
      }
    });
  }

  sendReminderNow(reminder: TenderReminder): void {
    this.tenderService.sendReminderNow(reminder.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.loadReminders();
        this.snackBar.open(result.success ? '✅ ' + result.message : '❌ ' + result.message, 'Close', { duration: 4000 });
      },
      error: (err) => {
        this.snackBar.open('Failed to send reminder: ' + (err.error?.message || 'Unknown error'), 'Close', { duration: 4000 });
      }
    });
  }

  checkReminders(): void {
    this.tenderService.checkAndSendReminders().pipe(takeUntil(this.destroy$)).subscribe({
      next: (result) => {
        this.loadReminders();
        if (result.sent > 0) {
          this.snackBar.open(`✅ Sent ${result.sent} of ${result.total} due reminders`, 'Close', { duration: 4000 });
        } else {
          this.snackBar.open('No reminders due at this time', 'Close', { duration: 3000 });
        }
      },
      error: () => {
        this.snackBar.open('Error checking reminders', 'Close', { duration: 3000 });
      }
    });
  }
}
