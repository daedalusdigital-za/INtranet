import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import { TenderService, Tender, TenderStats, ComplianceDocument, ComplianceSummary, CalendarEvent, TenderBOQItem, TenderTeamMember, TenderDocument } from '../../services/tender.service';
import { AuthService } from '../../services/auth.service';
import { TenderDetailDialogComponent } from './tender-detail-dialog.component';
import { ComplianceDialogComponent } from './compliance-dialog.component';

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
    DecimalPipe
  ],
  template: `
    <div class="tenders-container">
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
            @if (stats?.complianceExpiring) {
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
                              <button mat-menu-item (click)="viewComplianceDoc(doc)">
                                <mat-icon>visibility</mat-icon> View
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
          </div>
        </mat-tab>

        <!-- Analytics Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="tab-icon">analytics</mat-icon>
            Analytics
          </ng-template>
          
          <div class="tab-content">
            <div class="analytics-grid">
              <!-- Win Rate Card -->
              <mat-card class="analytics-card win-rate">
                <mat-card-header>
                  <mat-card-title>Win Rate YTD</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="big-stat">
                    <span class="value">{{ stats?.winRate | number:'1.1-1' }}%</span>
                    <mat-progress-bar mode="determinate" [value]="stats?.winRate || 0"></mat-progress-bar>
                  </div>
                  <div class="stat-breakdown">
                    <div class="breakdown-item won">
                      <span class="label">Won</span>
                      <span class="value">{{ stats?.awardedYTD || 0 }}</span>
                    </div>
                    <div class="breakdown-item lost">
                      <span class="label">Lost</span>
                      <span class="value">{{ stats?.lostYTD || 0 }}</span>
                    </div>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- Value Summary -->
              <mat-card class="analytics-card value-summary">
                <mat-card-header>
                  <mat-card-title>Value Summary</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="value-row">
                    <span class="label">Total Submitted</span>
                    <span class="value">{{ stats?.totalValueSubmitted | currency:'ZAR':'symbol':'1.0-0' }}</span>
                  </div>
                  <div class="value-row">
                    <span class="label">Total Awarded</span>
                    <span class="value highlight">{{ stats?.totalValueAwarded | currency:'ZAR':'symbol':'1.0-0' }}</span>
                  </div>
                </mat-card-content>
              </mat-card>

              <!-- By Province -->
              <mat-card class="analytics-card by-province">
                <mat-card-header>
                  <mat-card-title>By Province</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  @if (stats?.byProvince) {
                    @for (item of getObjectEntries(stats.byProvince); track item[0]) {
                      <div class="bar-row">
                        <span class="label">{{ item[0] }}</span>
                        <div class="bar-container">
                          <div class="bar" [style.width.%]="getBarWidth(item[1], stats.byProvince)"></div>
                        </div>
                        <span class="value">{{ item[1] }}</span>
                      </div>
                    }
                  }
                </mat-card-content>
              </mat-card>

              <!-- By Status -->
              <mat-card class="analytics-card by-status">
                <mat-card-header>
                  <mat-card-title>By Status</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  @if (stats?.byStatus) {
                    @for (item of getObjectEntries(stats.byStatus); track item[0]) {
                      <div class="status-row">
                        <span class="status-chip" [style.background-color]="getStatusColor(item[0])">{{ item[0] }}</span>
                        <span class="value">{{ item[1] }}</span>
                      </div>
                    }
                  }
                </mat-card-content>
              </mat-card>

              <!-- By Company -->
              <mat-card class="analytics-card by-company">
                <mat-card-header>
                  <mat-card-title>By Company</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  @if (stats?.byCompany) {
                    @for (item of getObjectEntries(stats.byCompany); track item[0]) {
                      <div class="company-row">
                        <span class="company-chip" [style.background-color]="getCompanyColor(item[0])">{{ item[0] }}</span>
                        <span class="value">{{ item[1] }} tenders</span>
                      </div>
                    }
                  }
                </mat-card-content>
              </mat-card>

              <!-- By Department -->
              <mat-card class="analytics-card by-department">
                <mat-card-header>
                  <mat-card-title>Top Departments</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  @if (stats?.byDepartment) {
                    @for (item of getTopEntries(stats.byDepartment, 5); track item[0]) {
                      <div class="dept-row">
                        <span class="label">{{ item[0] }}</span>
                        <span class="value">{{ item[1] }}</span>
                      </div>
                    }
                  }
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .tenders-container {
      padding: 24px;
      max-width: 1600px;
      margin: 0 auto;
      background: #f5f5f5;
      min-height: calc(100vh - 64px);
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
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .stat-card.active { border-left-color: #2196F3; }
    .stat-card.active .stat-icon { color: #2196F3; }
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

    /* Tabs */
    .tab-icon { margin-right: 8px; }
    .badge {
      margin-left: 8px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
    .badge.warn { background: #F44336; color: white; }

    .tab-content { padding: 24px 0; }

    /* Filter Card */
    .filter-card {
      margin-bottom: 16px;
      padding: 16px;
    }

    .filter-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filter-row mat-form-field { flex: 1; min-width: 150px; }

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
    .table-card { overflow: hidden; }

    .tenders-table {
      width: 100%;
    }

    .tenders-table tr { cursor: pointer; }
    .tenders-table tr:hover { background: #f5f5f5; }

    .company-chip {
      padding: 4px 10px;
      border-radius: 4px;
      color: white;
      font-weight: 500;
      font-size: 12px;
    }

    .tender-link {
      color: #1976D2;
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
      padding: 4px 12px;
      border-radius: 16px;
      color: white;
      font-size: 12px;
      font-weight: 500;
    }

    .workflow-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
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
    }
    .compliance-stat mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .compliance-stat .value { font-size: 36px; font-weight: 700; margin: 8px 0; }
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
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .company-compliance-card {
      border-top: 4px solid #E0E0E0;
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
    }

    .calendar-card mat-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
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
    }
    .legend-item .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .legend-item.closing .dot { background: #F44336; }
    .legend-item.briefing .dot { background: #2196F3; }
    .legend-item.site-visit .dot { background: #4CAF50; }
    .legend-item.clarification .dot { background: #FF9800; }
    .legend-item.evaluation .dot { background: #9C27B0; }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background: #E0E0E0;
      border: 1px solid #E0E0E0;
    }

    .day-header {
      background: #F5F5F5;
      padding: 12px;
      text-align: center;
      font-weight: 500;
      color: #666;
    }

    .calendar-day {
      background: white;
      min-height: 100px;
      padding: 8px;
      position: relative;
    }
    .calendar-day.other-month { background: #FAFAFA; }
    .calendar-day.other-month .day-number { color: #CCC; }
    .calendar-day.today { background: #E3F2FD; }
    .calendar-day.today .day-number { color: #1976D2; font-weight: 700; }

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

    .analytics-card { padding: 16px; }

    .big-stat {
      text-align: center;
      margin: 24px 0;
    }
    .big-stat .value {
      font-size: 48px;
      font-weight: 700;
      color: #1976D2;
    }
    .big-stat mat-progress-bar { margin-top: 16px; }

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
      height: 20px;
      background: #EEE;
      border-radius: 10px;
      margin: 0 8px;
      overflow: hidden;
    }
    .bar {
      height: 100%;
      background: linear-gradient(90deg, #2196F3, #1976D2);
      border-radius: 10px;
      transition: width 0.3s ease;
    }
    .bar-row .value { width: 30px; text-align: right; font-weight: 600; }

    .status-row, .company-row, .dept-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #EEE;
    }
    .status-row .value, .company-row .value, .dept-row .value { font-weight: 600; }

    @media (max-width: 1200px) {
      .stats-row { grid-template-columns: repeat(3, 1fr); }
      .compliance-grid { grid-template-columns: repeat(2, 1fr); }
      .analytics-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 768px) {
      .stats-row { grid-template-columns: repeat(2, 1fr); }
      .filter-row { flex-direction: column; }
      .compliance-summary { grid-template-columns: repeat(2, 1fr); }
      .compliance-grid { grid-template-columns: 1fr; }
      .analytics-grid { grid-template-columns: 1fr; }
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
    { code: 'ACM', name: 'Access Medical', color: '#9C27B0' }
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

  constructor(
    private tenderService: TenderService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
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
      width: '900px',
      maxHeight: '90vh',
      data: { mode: 'create', companies: this.companies, provinces: this.provinces, departments: this.departments }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  openTenderDetail(tender: Tender): void {
    const dialogRef = this.dialog.open(TenderDetailDialogComponent, {
      width: '1000px',
      maxHeight: '90vh',
      data: { mode: 'view', tender, companies: this.companies, provinces: this.provinces, departments: this.departments }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadData();
    });
  }

  editTender(tender: Tender): void {
    const dialogRef = this.dialog.open(TenderDetailDialogComponent, {
      width: '900px',
      maxHeight: '90vh',
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
}
