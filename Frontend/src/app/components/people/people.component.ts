import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../services/auth.service';
import { AttendanceService } from '../../services/attendance.service';
import { Employee, AttendanceMetrics } from '../../models/attendance.model';
import { interval, Subscription, Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';
import { EmployeeDirectoryComponent } from './employee-directory.component';
import { DailyRegisterComponent } from './daily-register.component';

interface HrAttentionItem { type: string; severity: string; icon: string; title: string; detail: string; count: number; action: string; }
interface HrLeavePerson { name: string; department: string; leaveType: string; startDate?: string; endDate?: string; days?: number; }
interface HrOverview {
  generatedAt: string;
  workforce: {
    totalEmployees: number; terminatedCount?: number; newThisMonth: number; onLeaveToday: number; absentToday: number;
    departments: number; byDepartment: { department: string; count: number }[];
    bySite?: { site: string; count: number }[];
    completenessRate: number; incompleteCount: number;
    missingBreakdown: { mobile: number; department: number; jobTitle: number; idNumber?: number };
  };
  attendance: {
    clockedInToday: number; notClockedIn: number; lateToday: number; attendanceRate: number;
    earliestArrival: string | null; averageArrival: string | null;
    lateArrivals: { empId: string; name: string; department: string; timeIn: string; lateMinutes: number }[];
    byDepartment: { department: string; total: number; present: number; rate: number }[];
    trend: { date: string; label: string; present: number; late: number }[];
    holisticPresent?: number; manualPresent?: number; manualAbsent?: number; manualOnLeave?: number;
  };
  registers?: {
    submittedSites: number; totalPresent: number; totalAbsent: number;
    bySite: { site: string; total: number; present: number; absent: number }[];
    missingSites: string[];
  };
  discipline?: {
    activeCases: number; activeWarnings: number; activeSuspensions: number; openInvestigations: number; terminated?: number;
  };
  leave: {
    pending: number; stalePending: number; onLeaveToday: number; upcoming: number;
    byType: { type: string; count: number }[];
    onLeaveNow: HrLeavePerson[]; upcomingList: HrLeavePerson[];
  };
  attention: HrAttentionItem[];
}
interface IncompleteRecord { empId: string; name: string; department: string; jobTitle: string; missing: string[]; }

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMenuModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="attendance-container">
      @if (!trainingAccess && !mainOfficeAccess && !condomFactoryAccess && !sanitaryPadsAccess && !newRoadAccess && !captownAccess && !brionkhorspruitAccess && !portElizabethAccess && !logisticsAccess) {
        <!-- Modern Header Section -->
        <div class="header-section-modern">
          <div class="header-content">
            <div class="title-area">
              <div class="icon-wrapper">
                <mat-icon>groups</mat-icon>
              </div>
              <div class="title-text">
                <h1>Human Resources</h1>
                <p class="subtitle">Manage departments, branches & employee data</p>
              </div>
            </div>
            <div class="header-stats">
              <div class="stat-card">
                <mat-icon>business</mat-icon>
                <div class="stat-info">
                  <span class="stat-value">8</span>
                  <span class="stat-label">Locations</span>
                </div>
              </div>
              <div class="stat-card">
                <mat-icon>badge</mat-icon>
                <div class="stat-info">
                  <span class="stat-value">Active</span>
                  <span class="stat-label">Status</span>
                </div>
              </div>
              <button mat-flat-button class="requests-btn" (click)="toggleLeaveRequests()">
                <mat-icon>inbox</mat-icon>
                Requests
                @if (pendingLeaveCount > 0) {
                  <span class="requests-badge">{{pendingLeaveCount}}</span>
                }
              </button>
            </div>
          </div>

          <!-- Search Bar -->
          <div class="search-section">
            <div class="search-box">
              <mat-icon>search</mat-icon>
              <input type="text" 
                     placeholder="Search departments or branches..." 
                     [(ngModel)]="searchQuery"
                     (input)="filterLocations()">
              @if (searchQuery) {
                <button mat-icon-button (click)="clearLocationSearch()" class="clear-btn">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
          </div>
        </div>

        <!-- ============ HR COMMAND CENTRE ============ -->
        <div class="command-centre">
          @if (hrLoading && !hrOverview) {
            <div class="cc-loading"><mat-spinner diameter="36"></mat-spinner><span>Loading HR command centre…</span></div>
          } @else if (hrOverview) {
            <!-- Directory launcher -->
            <div class="dir-launch" (click)="openEmployeeDirectory()">
              <div class="dl-left">
                <div class="dl-icon"><mat-icon>badge</mat-icon></div>
                <div class="dl-text">
                  <span class="dl-title">Employee Directory</span>
                  <span class="dl-sub">Search, view &amp; edit staff across all sites — Main Office, Security, factories, branches &amp; logistics — and store contracts &amp; documents</span>
                </div>
              </div>
              <button mat-flat-button class="dl-btn"><mat-icon>arrow_forward</mat-icon> Open Directory</button>
            </div>

            <!-- Daily register launcher -->
            <div class="dir-launch reg-launch" (click)="openDailyRegister()">
              <div class="dl-left">
                <div class="dl-icon reg"><mat-icon>fact_check</mat-icon></div>
                <div class="dl-text">
                  <span class="dl-title">Daily Attendance Register</span>
                  <span class="dl-sub">Capture manual in/out registers for sites that don't clock in — Main Building, Security &amp; more — for a holistic attendance view</span>
                </div>
              </div>
              <button mat-flat-button class="dl-btn"><mat-icon>edit_note</mat-icon> Capture Register</button>
            </div>

            <!-- Top KPI row -->
            <div class="kpi-row">
              <div class="kpi-card kpi-blue" (click)="openEmployeeDirectory()" matTooltip="Open the employee directory">
                <div class="kpi-icon"><mat-icon>groups</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.workforce.totalEmployees }}</span>
                  <span class="kpi-label">Active Employees</span>
                </div>
              </div>
              <div class="kpi-card kpi-green" matTooltip="Clocked in today">
                <div class="kpi-icon"><mat-icon>how_to_reg</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.attendance.clockedInToday }}<small>/{{ hrOverview.workforce.totalEmployees }}</small></span>
                  <span class="kpi-label">Present Today ({{ hrOverview.attendance.attendanceRate }}%)</span>
                </div>
              </div>
              <div class="kpi-card kpi-amber" (click)="openMainOfficeDialog()" matTooltip="Not clocked in">
                <div class="kpi-icon"><mat-icon>person_off</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.attendance.notClockedIn }}</span>
                  <span class="kpi-label">Absent Today</span>
                </div>
              </div>
              <div class="kpi-card kpi-purple" (click)="openLeavePanel()" matTooltip="On approved leave today">
                <div class="kpi-icon"><mat-icon>beach_access</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.leave.onLeaveToday }}</span>
                  <span class="kpi-label">On Leave Today</span>
                </div>
              </div>
              <div class="kpi-card kpi-rose" (click)="openLeavePanel()" matTooltip="Pending HR actions">
                <div class="kpi-icon"><mat-icon>pending_actions</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.leave.pending }}</span>
                  <span class="kpi-label">Pending Approvals</span>
                </div>
              </div>
              <div class="kpi-card kpi-teal" matTooltip="New hires this month">
                <div class="kpi-icon"><mat-icon>person_add</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.workforce.newThisMonth }}</span>
                  <span class="kpi-label">New This Month</span>
                </div>
              </div>
            </div>

            <!-- Holistic attendance + discipline strip -->
            <div class="holistic-strip">
              <div class="hs-card hs-holistic" (click)="openDailyRegister()" matTooltip="Biometric clock-ins + manual registers">
                <div class="hs-icon"><mat-icon>groups_2</mat-icon></div>
                <div class="hs-body">
                  <span class="hs-value">{{ hrOverview.attendance.holisticPresent ?? hrOverview.attendance.clockedInToday }}<small>/{{ hrOverview.workforce.totalEmployees }}</small></span>
                  <span class="hs-label">Holistic Present</span>
                  <span class="hs-sub">{{ hrOverview.attendance.clockedInToday }} clocked in · {{ hrOverview.attendance.manualPresent ?? 0 }} on register</span>
                </div>
              </div>
              <div class="hs-card hs-registers" (click)="openDailyRegister()" matTooltip="Manual registers submitted today">
                <div class="hs-icon"><mat-icon>fact_check</mat-icon></div>
                <div class="hs-body">
                  <span class="hs-value">{{ hrOverview.registers?.submittedSites ?? 0 }}</span>
                  <span class="hs-label">Registers Submitted</span>
                  @if (hrOverview.registers?.missingSites?.length) {
                    <span class="hs-sub warn">Missing: {{ hrOverview.registers?.missingSites?.join(', ') }}</span>
                  } @else {
                    <span class="hs-sub">All sites reported</span>
                  }
                </div>
              </div>
              <div class="hs-card hs-warn" (click)="openEmployeeDirectory()" matTooltip="Active warnings on record">
                <div class="hs-icon"><mat-icon>warning</mat-icon></div>
                <div class="hs-body">
                  <span class="hs-value">{{ hrOverview.discipline?.activeWarnings ?? 0 }}</span>
                  <span class="hs-label">Active Warnings</span>
                  <span class="hs-sub">{{ hrOverview.discipline?.openInvestigations ?? 0 }} investigation(s) open</span>
                </div>
              </div>
              <div class="hs-card hs-suspend" (click)="openEmployeeDirectory()" matTooltip="Employees currently suspended">
                <div class="hs-icon"><mat-icon>gavel</mat-icon></div>
                <div class="hs-body">
                  <span class="hs-value">{{ hrOverview.discipline?.activeSuspensions ?? 0 }}</span>
                  <span class="hs-label">Suspended</span>
                  <span class="hs-sub">{{ hrOverview.discipline?.activeCases ?? 0 }} active case(s)</span>
                </div>
              </div>
              <div class="hs-card hs-terminated" (click)="openEmployeeDirectory()" matTooltip="Terminated employees">
                <div class="hs-icon"><mat-icon>person_off</mat-icon></div>
                <div class="hs-body">
                  <span class="hs-value">{{ hrOverview.discipline?.terminated ?? 0 }}</span>
                  <span class="hs-label">Terminated</span>
                  <span class="hs-sub">{{ hrOverview.workforce.terminatedCount ?? 0 }} total exits</span>
                </div>
              </div>
            </div>

            <!-- Middle: attention centre + attendance -->
            <div class="cc-grid">
              <!-- Attention centre -->
              <div class="cc-panel attention-panel">
                <div class="cc-panel-head">
                  <div class="cc-panel-title"><mat-icon>notifications_active</mat-icon><h3>HR Attention Centre</h3></div>
                  <button mat-icon-button (click)="loadHrOverview()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
                </div>
                @if (hrOverview.attention.length === 0) {
                  <div class="cc-empty"><mat-icon>task_alt</mat-icon><p>All clear — nothing needs attention right now.</p></div>
                } @else {
                  <div class="attention-list">
                    @for (item of hrOverview.attention; track item.type) {
                      <div class="attention-item sev-{{item.severity}}" (click)="onAttentionAction(item.action)">
                        <div class="att-icon"><mat-icon>{{ item.icon }}</mat-icon></div>
                        <div class="att-body">
                          <div class="att-title">{{ item.title }}</div>
                          <div class="att-detail">{{ item.detail }}</div>
                        </div>
                        <div class="att-side">
                          <span class="sev-badge sev-{{item.severity}}">{{ severityLabel(item.severity) }}</span>
                          <mat-icon class="att-go">chevron_right</mat-icon>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>

              <!-- Today's attendance -->
              <div class="cc-panel">
                <div class="cc-panel-head">
                  <div class="cc-panel-title"><mat-icon>schedule</mat-icon><h3>Today's Attendance</h3></div>
                </div>
                <div class="att-mini-stats">
                  <div class="mini-stat"><span class="ms-val ms-green">{{ hrOverview.attendance.clockedInToday }}</span><span class="ms-lbl">Clocked in</span></div>
                  <div class="mini-stat"><span class="ms-val ms-amber">{{ hrOverview.attendance.lateToday }}</span><span class="ms-lbl">Late</span></div>
                  <div class="mini-stat"><span class="ms-val ms-red">{{ hrOverview.attendance.notClockedIn }}</span><span class="ms-lbl">Absent</span></div>
                  <div class="mini-stat"><span class="ms-val">{{ hrOverview.attendance.earliestArrival || '–' }}</span><span class="ms-lbl">Earliest</span></div>
                  <div class="mini-stat"><span class="ms-val">{{ hrOverview.attendance.averageArrival || '–' }}</span><span class="ms-lbl">Average</span></div>
                </div>

                <!-- 7-day trend -->
                <div class="trend-block">
                  <div class="trend-title">Last 7 days</div>
                  <div class="trend-bars">
                    @for (d of hrOverview.attendance.trend; track d.date) {
                      <div class="trend-col" [matTooltip]="d.label + ': ' + d.present + ' present, ' + d.late + ' late'">
                        <div class="trend-bar" [style.height.%]="trendHeight(d.present)">
                          <div class="trend-late" [style.height.%]="d.present > 0 ? (d.late / d.present * 100) : 0"></div>
                        </div>
                        <span class="trend-lbl">{{ d.label }}</span>
                      </div>
                    }
                  </div>
                </div>

                @if (hrOverview.attendance.lateArrivals.length > 0) {
                  <div class="late-list">
                    <div class="late-list-title">Late arrivals today</div>
                    @for (l of hrOverview.attendance.lateArrivals.slice(0, 5); track l.empId) {
                      <div class="late-row">
                        <span class="late-name">{{ l.name || l.empId }}</span>
                        <span class="late-dept">{{ l.department }}</span>
                        <span class="late-time">{{ l.timeIn }} <small>(+{{ l.lateMinutes }}m)</small></span>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Bottom: workforce, records, leave -->
            <div class="cc-grid-3">
              <!-- Headcount by department -->
              <div class="cc-panel">
                <div class="cc-panel-head">
                  <div class="cc-panel-title"><mat-icon>domain</mat-icon><h3>Headcount by Department</h3></div>
                </div>
                <div class="dept-bars">
                  @for (dept of hrOverview.workforce.byDepartment.slice(0, 8); track dept.department) {
                    <div class="dept-bar-row">
                      <span class="dbr-name">{{ dept.department }}</span>
                      <div class="dbr-track"><div class="dbr-fill" [style.width.%]="deptWidth(dept.count)"></div></div>
                      <span class="dbr-count">{{ dept.count }}</span>
                    </div>
                  }
                </div>
              </div>

              <!-- Records completeness -->
              <div class="cc-panel">
                <div class="cc-panel-head">
                  <div class="cc-panel-title"><mat-icon>fact_check</mat-icon><h3>Records Completeness</h3></div>
                </div>
                <div class="completeness">
                  <div class="comp-ring" [style.background]="completenessRing()">
                    <div class="comp-inner"><span class="comp-pct">{{ hrOverview.workforce.completenessRate }}%</span><span class="comp-sub">complete</span></div>
                  </div>
                  <div class="comp-missing">
                    <div class="comp-row"><mat-icon>phone</mat-icon><span>Mobile</span><b>{{ hrOverview.workforce.missingBreakdown.mobile }}</b></div>
                    <div class="comp-row"><mat-icon>domain</mat-icon><span>Department</span><b>{{ hrOverview.workforce.missingBreakdown.department }}</b></div>
                    <div class="comp-row"><mat-icon>work</mat-icon><span>Job title</span><b>{{ hrOverview.workforce.missingBreakdown.jobTitle }}</b></div>
                    <div class="comp-row"><mat-icon>badge</mat-icon><span>ID Number</span><b>{{ hrOverview.workforce.missingBreakdown.idNumber }}</b></div>
                  </div>
                </div>
                @if (hrOverview.workforce.incompleteCount > 0) {
                  <button mat-stroked-button class="comp-btn" (click)="openRecordsPanel()">
                    <mat-icon>list</mat-icon> View {{ hrOverview.workforce.incompleteCount }} incomplete record{{ hrOverview.workforce.incompleteCount === 1 ? '' : 's' }}
                  </button>
                }
              </div>

              <!-- Leave summary -->
              <div class="cc-panel">
                <div class="cc-panel-head">
                  <div class="cc-panel-title"><mat-icon>event_note</mat-icon><h3>Leave</h3></div>
                  <button mat-button class="cc-link" (click)="openLeavePanel()">Manage</button>
                </div>
                <div class="leave-mini">
                  <div class="lm-stat"><span class="lm-val">{{ hrOverview.leave.pending }}</span><span class="lm-lbl">Pending</span></div>
                  <div class="lm-stat"><span class="lm-val">{{ hrOverview.leave.onLeaveToday }}</span><span class="lm-lbl">Out today</span></div>
                  <div class="lm-stat"><span class="lm-val">{{ hrOverview.leave.upcoming }}</span><span class="lm-lbl">Upcoming</span></div>
                </div>
                @if (hrOverview.leave.onLeaveNow.length > 0) {
                  <div class="leave-sub-title">Currently on leave</div>
                  @for (p of hrOverview.leave.onLeaveNow.slice(0, 4); track p.name) {
                    <div class="leave-person">
                      <div class="lp-avatar">{{ lrInitials(p.name) }}</div>
                      <div class="lp-info"><span class="lp-name">{{ p.name }}</span><span class="lp-meta">{{ p.leaveType }} · until {{ p.endDate | date:'d MMM' }}</span></div>
                    </div>
                  }
                }
                @if (hrOverview.leave.upcomingList.length > 0) {
                  <div class="leave-sub-title">Upcoming</div>
                  @for (p of hrOverview.leave.upcomingList.slice(0, 4); track p.name + p.startDate) {
                    <div class="leave-person">
                      <div class="lp-avatar upcoming">{{ lrInitials(p.name) }}</div>
                      <div class="lp-info"><span class="lp-name">{{ p.name }}</span><span class="lp-meta">{{ p.leaveType }} · {{ p.startDate | date:'d MMM' }} ({{ p.days }}d)</span></div>
                    </div>
                  }
                }
                @if (hrOverview.leave.onLeaveNow.length === 0 && hrOverview.leave.upcomingList.length === 0) {
                  <div class="cc-empty small"><mat-icon>event_available</mat-icon><p>No current or upcoming leave.</p></div>
                }
              </div>
            </div>
          }
        </div>

        @if (showRecordsPanel) {
          <div class="records-overlay" (click)="showRecordsPanel = false">
            <div class="records-panel" (click)="$event.stopPropagation()">
              <div class="rp-head">
                <div class="rp-title"><mat-icon>fact_check</mat-icon><h3>Incomplete Employee Records</h3></div>
                <button mat-icon-button (click)="showRecordsPanel = false"><mat-icon>close</mat-icon></button>
              </div>
              @if (recordsLoading) {
                <div class="cc-loading"><mat-spinner diameter="32"></mat-spinner></div>
              } @else if (incompleteRecords.length === 0) {
                <div class="cc-empty"><mat-icon>task_alt</mat-icon><p>All employee records are complete.</p></div>
              } @else {
                <div class="rp-list">
                  @for (r of incompleteRecords; track r.empId) {
                    <div class="rp-item">
                      <div class="rp-info">
                        <span class="rp-name">{{ r.name || r.empId }}</span>
                        <span class="rp-dept">{{ r.department }}<span *ngIf="r.jobTitle"> · {{ r.jobTitle }}</span></span>
                      </div>
                      <div class="rp-missing">
                        @for (m of r.missing; track m) {
                          <span class="rp-tag">{{ m }}</span>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        }

        @if (showLeaveRequests) {
          <div class="leave-requests-panel">
            <div class="lrp-header">
              <div class="lrp-title"><mat-icon>event_busy</mat-icon><h3>Leave Requests</h3></div>
              <div class="lrp-filters">
                <button class="lrp-filter" [class.active]="leaveFilter==='all'" (click)="setLeaveFilter('all')">All ({{leaveCounts.total}})</button>
                <button class="lrp-filter pending" [class.active]="leaveFilter==='Pending'" (click)="setLeaveFilter('Pending')">Pending ({{leaveCounts.pending}})</button>
                <button class="lrp-filter approved" [class.active]="leaveFilter==='Approved'" (click)="setLeaveFilter('Approved')">Approved ({{leaveCounts.approved}})</button>
                <button class="lrp-filter rejected" [class.active]="leaveFilter==='Rejected'" (click)="setLeaveFilter('Rejected')">Rejected ({{leaveCounts.rejected}})</button>
              </div>
              <button mat-icon-button (click)="showLeaveRequests=false" style="color:white"><mat-icon>close</mat-icon></button>
            </div>
            @if (leaveRequestsLoading) {
              <div class="lrp-loading"><mat-spinner diameter="32"></mat-spinner></div>
            } @else if (leaveRequests.length === 0) {
              <div class="lrp-empty"><mat-icon>inbox</mat-icon><p>No requests found</p></div>
            } @else {
              <div class="lrp-list">
                @for (req of leaveRequests; track req.leaveRequestId) {
                  <div class="lrp-item" [class]="'lrp-' + req.status.toLowerCase()">
                    <div class="lrp-avatar">{{lrInitials(req.employeeName)}}</div>
                    <div class="lrp-info">
                      <div class="lrp-name">{{req.employeeName}} <span class="lrp-dept">{{req.department || ''}}</span></div>
                      <div class="lrp-meta">
                        <span class="lrp-type">{{req.leaveType}}</span>
                        <span class="lrp-dates">{{req.startDate | date:'d MMM'}} – {{req.endDate | date:'d MMM yyyy'}}</span>
                        <span class="lrp-days">{{req.daysRequested}} day{{req.daysRequested!==1?'s':''}}</span>
                      </div>
                      @if (req.reason) { <div class="lrp-reason">&ldquo;{{req.reason}}&rdquo;</div> }
                      @if (req.reviewNotes) { <div class="lrp-review-note"><mat-icon>comment</mat-icon> {{req.reviewNotes}}</div> }
                    </div>
                    <div class="lrp-right">
                      <span class="lrp-status" [class]="'status-' + req.status.toLowerCase()">{{req.status}}</span>
                      <span class="lrp-submitted">{{req.submittedAt | date:'d MMM yyyy'}}</span>
                      @if (req.status === 'Pending') {
                        <div class="lrp-actions">
                          <button mat-icon-button class="approve-btn" matTooltip="Approve" (click)="reviewLeave(req, 'Approved')"><mat-icon>check_circle</mat-icon></button>
                          <button mat-icon-button class="reject-btn" matTooltip="Reject" (click)="reviewLeave(req, 'Rejected')"><mat-icon>cancel</mat-icon></button>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Departments Grid -->
        <div class="departments-section">
          <div class="departments-grid">
            @for (location of filteredLocations; track location.name) {
              <div class="department-card" 
                   (click)="location.action()"
                   [matTooltip]="'Access ' + location.name">
                
                <div class="card-glow"></div>
                
                <div class="card-content">
                  <div class="icon-container" [attr.data-location]="location.id">
                    <mat-icon>{{ location.icon }}</mat-icon>
                  </div>
                  
                  <h3>{{ location.name }}</h3>
                  
                  <p class="location-description">{{ location.description }}</p>

                  <div class="card-footer">
                    <button mat-flat-button class="access-btn">
                      <mat-icon>lock_open</mat-icon>
                      Access
                    </button>
                  </div>
                </div>

                <div class="card-indicator"></div>
              </div>
            }
          </div>

          @if (filteredLocations.length === 0 && searchQuery) {
            <div class="no-results">
              <mat-icon>search_off</mat-icon>
              <h3>No locations found</h3>
              <p>Try a different search term</p>
            </div>
          }
        </div>
      } @else if (trainingAccess) {
        <!-- Training Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>school</mat-icon>
              Employee Training Center
            </h1>
            <p class="subtitle">Training videos, manuals, and resources for new employees</p>
          </div>

          <div class="training-content">
            <div class="training-categories">
              <mat-card class="training-category-card">
                <mat-icon class="category-icon">people</mat-icon>
                <h3>Sales Representative Training</h3>
                <p>Complete training materials for sales team members</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">handshake</mat-icon>
                <h3>Customer Service Training</h3>
                <p>Essential skills and protocols for customer interactions</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">production_quantity_limits</mat-icon>
                <h3>Production Training</h3>
                <p>Manufacturing processes and quality control standards</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">health_and_safety</mat-icon>
                <h3>Safety & Compliance</h3>
                <p>Workplace safety procedures and regulatory compliance</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">admin_panel_settings</mat-icon>
                <h3>Company Policies</h3>
                <p>HR policies, code of conduct, and employee handbook</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>

              <mat-card class="training-category-card">
                <mat-icon class="category-icon">computer</mat-icon>
                <h3>IT Systems Training</h3>
                <p>Software applications and internal systems usage</p>
                <div class="training-actions">
                  <button mat-raised-button color="primary">
                    <mat-icon>play_circle</mat-icon>
                    Watch Videos
                  </button>
                  <button mat-raised-button>
                    <mat-icon>picture_as_pdf</mat-icon>
                    View Manuals
                  </button>
                </div>
              </mat-card>
            </div>
          </div>
        </div>
      } @else if (mainOfficeAccess) {
        <!-- Original Attendance Content -->
      <div class="header-section">
        <div class="title-row">
          <h1>
            <mat-icon>access_time</mat-icon>
            Employee Attendance Monitor
          </h1>
          <div class="header-actions">
            <button mat-raised-button color="primary" (click)="downloadWeeklyReport()" class="export-btn">
              <mat-icon>download</mat-icon>
              Weekly Report
            </button>
            <button mat-raised-button color="accent" (click)="downloadMonthlyReport()" class="export-btn">
              <mat-icon>download</mat-icon>
              Monthly Report
            </button>
            <div class="refresh-info">
              <mat-icon>autorenew</mat-icon>
              <span>Auto-refresh: 60s | Last updated: {{ lastUpdate | date:'short' }}</span>
            </div>
          </div>
        </div>

        <!-- Metrics Dashboard -->
        @if (metrics) {
          <div class="metrics-grid">
            <mat-card class="metric-card total">
              <mat-icon>people</mat-icon>
              <div class="metric-content">
                <h2>{{ metrics.totalEmployees }}</h2>
                <p>Total Employees</p>
              </div>
            </mat-card>

            <mat-card class="metric-card present">
              <mat-icon>check_circle</mat-icon>
              <div class="metric-content">
                <h2>{{ metrics.presentCount }}</h2>
                <p>Present ({{ metrics.attendanceRate | number:'1.1-1' }}%)</p>
              </div>
            </mat-card>

            <mat-card class="metric-card absent">
              <mat-icon>cancel</mat-icon>
              <div class="metric-content">
                <h2>{{ metrics.absentCount }}</h2>
                <p>Absent</p>
              </div>
            </mat-card>

            <mat-card class="metric-card late">
              <mat-icon>schedule</mat-icon>
              <div class="metric-content">
                <h2>{{ metrics.lateCount }}</h2>
                <p>Late Arrivals</p>
              </div>
            </mat-card>
          </div>
        }
      </div>

      <!-- Department Breakdown -->
      @if (metrics && metrics.departmentBreakdown.length > 0) {
        <div class="department-section">
          <h2>
            <mat-icon>business</mat-icon>
            Department Breakdown
          </h2>
          <div class="department-grid">
            @for (dept of metrics.departmentBreakdown; track dept.departmentName) {
              <mat-card class="department-card">
                <h3>{{ dept.departmentName }}</h3>
                <div class="dept-stats">
                  <span class="stat present">
                    <mat-icon>check</mat-icon>
                    {{ dept.presentCount }}/{{ dept.totalEmployees }}
                  </span>
                  @if (dept.lateCount > 0) {
                    <span class="stat late">
                      <mat-icon>schedule</mat-icon>
                      {{ dept.lateCount }} late
                    </span>
                  }
                </div>
              </mat-card>
            }
          </div>
        </div>
      }

      <!-- Employee Grid -->
      <div class="employee-section">
        <div class="section-header">
          <h2>
            <mat-icon>badge</mat-icon>
            Live Employee Status
          </h2>
          <mat-form-field class="search-field" appearance="outline">
            <mat-label>Search Employees</mat-label>
            <input matInput
                   [(ngModel)]="searchQuery"
                   (ngModelChange)="filterEmployees()"
                   placeholder="Search by name, code, or position...">
            <mat-icon matPrefix>search</mat-icon>
            @if (searchQuery) {
              <button matSuffix mat-icon-button (click)="clearSearch()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
        </div>

        @if (loading) {
          <div class="loading-spinner">
            <mat-spinner></mat-spinner>
          </div>
        } @else {
          <div class="employee-grid">
            @for (employee of filteredEmployees; track employee.employeeId) {
              <mat-card class="employee-card" [class.present]="employee.status === 'Present'"
                        [class.absent]="employee.status === 'Absent'"
                        [class.late]="employee.isLate">
                <div class="card-content">
                  <div class="employee-photo">
                    @if (employee.photoBase64) {
                      <img [src]="'data:image/jpeg;base64,' + employee.photoBase64" [alt]="employee.fullName">
                    } @else {
                      <div class="photo-placeholder">
                        <mat-icon>person</mat-icon>
                      </div>
                    }
                    <div class="status-indicator" [class]="employee.status.toLowerCase()">
                      <mat-icon>{{ getStatusIcon(employee.status) }}</mat-icon>
                    </div>
                  </div>

                  <div class="employee-info">
                    <div class="name-section">
                      <h3>{{ employee.fullName }}</h3>
                      @if (employee.isLate) {
                        <mat-icon class="late-badge" matTooltip="Late by {{ employee.lateMinutes }} min">schedule</mat-icon>
                      }
                    </div>
                    <p class="employee-role">{{ employee.position || 'N/A' }}</p>

                    <div class="time-info">
                      @if (employee.timeIn) {
                        <div class="time-row" [class.ontime]="!employee.isLate" [class.late]="employee.isLate">
                          <mat-icon>login</mat-icon>
                          <span>{{ formatTime(employee.timeIn) }}</span>
                        </div>
                      } @else {
                        <div class="time-row absent">
                          <mat-icon>cancel</mat-icon>
                          <span>Absent</span>
                        </div>
                      }
                      @if (employee.timeOut) {
                        <div class="time-row">
                          <mat-icon>logout</mat-icon>
                          <span>{{ formatTime(employee.timeOut) }}</span>
                        </div>
                      }
                    </div>

                    <div class="weekly-attendance">
                      <div class="weekly-title">Week Overview</div>
                      <div class="week-circles">
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'monday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Monday', 'monday')"
                             data-day="M">M</div>
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'tuesday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Tuesday', 'tuesday')"
                             data-day="T">T</div>
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'wednesday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Wednesday', 'wednesday')"
                             data-day="W">W</div>
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'thursday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Thursday', 'thursday')"
                             data-day="T">T</div>
                        <div class="day-circle {{ getWeekDay(employee.employeeId, 'friday').status }}"
                             [title]="getDayTooltip(employee.employeeId, 'Friday', 'friday')"
                             data-day="F">F</div>
                      </div>
                    </div>
                  </div>
                </div>
              </mat-card>
            } @empty {
              <div class="empty-state">
                <mat-icon>people_outline</mat-icon>
                <h3>No employees found</h3>
              </div>
            }
          </div>
        }
      </div>
      } @else if (condomFactoryAccess) {
        <!-- Condom Factory Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>factory</mat-icon>
              Condom Factory Operations
            </h1>
            <p class="subtitle">Production monitoring and quality control</p>
          </div>

          <div class="coming-soon">
            <mat-icon>cloud_queue</mat-icon>
            <h2>Coming Soon</h2>
            <p>This department will be connected to an Azure database for live data synchronization.</p>
            <p class="azure-note"><mat-icon>cloud</mat-icon> Azure integration pending</p>
            <button mat-raised-button color="warn" (click)="condomFactoryAccess = false">
              <mat-icon>arrow_back</mat-icon>
              Back to Departments
            </button>
          </div>
        </div>
      } @else if (sanitaryPadsAccess) {
        <!-- Sanitary Pads Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>local_hospital</mat-icon>
              Sanitary Pads Production
            </h1>
            <p class="subtitle">Manufacturing and inventory management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>cloud_queue</mat-icon>
            <h2>Coming Soon</h2>
            <p>This department will be connected to an Azure database for live data synchronization.</p>
            <p class="azure-note"><mat-icon>cloud</mat-icon> Azure integration pending</p>
            <button mat-raised-button color="warn" (click)="sanitaryPadsAccess = false">
              <mat-icon>arrow_back</mat-icon>
              Back to Departments
            </button>
          </div>
        </div>
      } @else if (newRoadAccess) {
        <!-- New Road Branch Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>location_on</mat-icon>
              New Road Branch
            </h1>
            <p class="subtitle">Branch operations and staff management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>cloud_queue</mat-icon>
            <h2>Coming Soon</h2>
            <p>This branch will be connected to an Azure database for live data synchronization.</p>
            <p class="azure-note"><mat-icon>cloud</mat-icon> Azure integration pending</p>
            <button mat-raised-button color="warn" (click)="newRoadAccess = false">
              <mat-icon>arrow_back</mat-icon>
              Back to Departments
            </button>
          </div>
        </div>
      } @else if (captownAccess) {
        <!-- Cape Town Branch Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>location_city</mat-icon>
              Cape Town Branch
            </h1>
            <p class="subtitle">Branch operations and staff management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>cloud_queue</mat-icon>
            <h2>Coming Soon</h2>
            <p>This branch will be connected to an Azure database for live data synchronization.</p>
            <p class="azure-note"><mat-icon>cloud</mat-icon> Azure integration pending</p>
            <button mat-raised-button color="warn" (click)="captownAccess = false">
              <mat-icon>arrow_back</mat-icon>
              Back to Departments
            </button>
          </div>
        </div>
      } @else if (brionkhorspruitAccess) {
        <!-- Brionkhorspruit Branch Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>place</mat-icon>
              Brionkhorspruit Branch
            </h1>
            <p class="subtitle">Branch operations and staff management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>cloud_queue</mat-icon>
            <h2>Coming Soon</h2>
            <p>This branch will be connected to an Azure database for live data synchronization.</p>
            <p class="azure-note"><mat-icon>cloud</mat-icon> Azure integration pending</p>
            <button mat-raised-button color="warn" (click)="brionkhorspruitAccess = false">
              <mat-icon>arrow_back</mat-icon>
              Back to Departments
            </button>
          </div>
        </div>
      } @else if (portElizabethAccess) {
        <!-- Port Elizabeth Branch Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>apartment</mat-icon>
              Port Elizabeth Branch
            </h1>
            <p class="subtitle">Branch operations and staff management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>cloud_queue</mat-icon>
            <h2>Coming Soon</h2>
            <p>This branch will be connected to an Azure database for live data synchronization.</p>
            <p class="azure-note"><mat-icon>cloud</mat-icon> Azure integration pending</p>
            <button mat-raised-button color="warn" (click)="portElizabethAccess = false">
              <mat-icon>arrow_back</mat-icon>
              Back to Departments
            </button>
          </div>
        </div>
      } @else if (logisticsAccess) {
        <!-- Logistics Content -->
        <div class="factory-section">
          <div class="header-section">
            <h1>
              <mat-icon>local_shipping</mat-icon>
              Logistics Operations
            </h1>
            <p class="subtitle">Supply chain and logistics management</p>
          </div>

          <div class="coming-soon">
            <mat-icon>cloud_queue</mat-icon>
            <h2>Coming Soon</h2>
            <p>This department will be connected to an Azure database for live data synchronization.</p>
            <p class="azure-note"><mat-icon>cloud</mat-icon> Azure integration pending</p>
            <button mat-raised-button color="warn" (click)="logisticsAccess = false">
              <mat-icon>arrow_back</mat-icon>
              Back to Departments
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .attendance-container {
      min-height: 100vh;
      padding: 80px 32px 48px;
      position: relative;
      background: #0f172a;
      background-image:
        radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.35) 0%, transparent 45%),
        radial-gradient(circle at 85% 15%, rgba(14, 165, 233, 0.32) 0%, transparent 45%),
        radial-gradient(circle at 75% 85%, rgba(236, 72, 153, 0.26) 0%, transparent 45%),
        radial-gradient(circle at 25% 90%, rgba(16, 185, 129, 0.24) 0%, transparent 45%),
        linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%);
      background-attachment: fixed;
      overflow-x: hidden;
    }

    /* Modern Header Section */
    .header-section-modern {
      max-width: 1400px;
      margin: 0 auto 40px;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 24px;
      margin-bottom: 24px;
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .icon-wrapper {
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    .icon-wrapper mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: white;
    }

    .title-text h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      color: white;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .title-text .subtitle {
      margin: 4px 0 0;
      font-size: 16px;
      color: rgba(255, 255, 255, 0.9);
    }

    .header-stats {
      display: flex;
      gap: 16px;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    .stat-card mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: white;
    }

    .stat-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Search Section */
    .search-section {
      display: flex;
      justify-content: center;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      max-width: 500px;
      padding: 14px 20px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    .search-box mat-icon {
      color: #1e90ff;
      font-size: 24px;
    }

    .search-box input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 16px;
      background: transparent;
      color: #333;
    }

    .search-box input::placeholder {
      color: #999;
    }

    .clear-btn {
      width: 32px;
      height: 32px;
    }

    /* Departments Grid */
    .departments-section {
      max-width: 1400px;
      margin: 0 auto;
    }

    .departments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }

    .department-card {
      position: relative;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    .department-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    }

    .card-glow {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 100%;
      background: linear-gradient(135deg, rgba(30, 144, 255, 0.1) 0%, rgba(65, 105, 225, 0.05) 100%);
      opacity: 0;
      transition: opacity 0.4s;
    }

    .department-card:hover .card-glow {
      opacity: 1;
    }

    .card-content {
      position: relative;
      padding: 32px 24px;
      text-align: center;
      z-index: 1;
    }

    .icon-container {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 20px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      box-shadow: 0 8px 24px rgba(30, 144, 255, 0.4);
      transition: all 0.4s;
    }

    .department-card:hover .icon-container {
      transform: scale(1.1);
      box-shadow: 0 12px 32px rgba(30, 144, 255, 0.5);
    }

    /* Location-specific icon colors */
    .icon-container[data-location="main-office"] { background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%); }
    .icon-container[data-location="condom-factory"] { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); box-shadow: 0 8px 24px rgba(255, 107, 107, 0.4); }
    .icon-container[data-location="sanitary-pads"] { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); box-shadow: 0 8px 24px rgba(240, 147, 251, 0.4); }
    .icon-container[data-location="new-road"] { background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%); box-shadow: 0 8px 24px rgba(255, 167, 38, 0.4); }
    .icon-container[data-location="cape-town"] { background: linear-gradient(135deg, #26a69a 0%, #00897b 100%); box-shadow: 0 8px 24px rgba(38, 166, 154, 0.4); }
    .icon-container[data-location="brionkhorspruit"] { background: linear-gradient(135deg, #7c4dff 0%, #651fff 100%); box-shadow: 0 8px 24px rgba(124, 77, 255, 0.4); }
    .icon-container[data-location="port-elizabeth"] { background: linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%); box-shadow: 0 8px 24px rgba(66, 165, 245, 0.4); }
    .icon-container[data-location="logistics"] { background: linear-gradient(135deg, #66bb6a 0%, #43a047 100%); box-shadow: 0 8px 24px rgba(102, 187, 106, 0.4); }

    .icon-container mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: white;
    }

    .department-card h3 {
      margin: 0 0 12px;
      font-size: 20px;
      font-weight: 600;
      color: #1e90ff;
    }

    .location-description {
      margin: 0 0 20px;
      color: #666;
      font-size: 14px;
      min-height: 40px;
    }

    .card-footer {
      margin-top: 8px;
    }

    .department-card .access-btn {
      width: 100%;
      padding: 10px 24px !important;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%) !important;
      color: white !important;
      font-weight: 500 !important;
      border-radius: 12px !important;
      transition: all 0.3s !important;
      box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3) !important;
    }

    .department-card:hover .access-btn {
      box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4) !important;
      transform: translateY(-2px);
    }

    .department-card .access-btn mat-icon {
      margin-right: 8px;
    }

    .card-indicator {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #1e90ff 0%, #4169e1 100%);
      transform: scaleX(0);
      transition: transform 0.4s;
    }

    .department-card:hover .card-indicator {
      transform: scaleX(1);
    }

    /* No Results */
    .no-results {
      text-align: center;
      padding: 60px;
      color: rgba(255, 255, 255, 0.9);
    }

    .no-results mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.7;
    }

    .no-results h3 {
      margin: 0 0 8px;
      color: white;
    }

    .no-results p {
      margin: 0;
    }

    /* Leave Requests Panel */
    .requests-btn { background: rgba(255,255,255,0.15); color: white; border-radius: 20px; padding: 0 16px; height: 40px; display: flex; align-items: center; gap: 6px; font-weight: 600; position: relative; transition: background 0.2s; }
    .requests-btn:hover { background: rgba(255,255,255,0.25); }
    .requests-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .requests-badge { background: #ef4444; color: white; border-radius: 10px; padding: 1px 7px; font-size: 11px; font-weight: 800; margin-left: 4px; }
    .leave-requests-panel { background: white; border-radius: 20px; margin: 0 0 24px; box-shadow: 0 8px 32px rgba(0,0,0,0.15); overflow: hidden; }
    .lrp-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: linear-gradient(135deg, #4caf50, #388e3c); color: white; }
    .lrp-title { display: flex; align-items: center; gap: 8px; flex: 1; }
    .lrp-title h3 { margin: 0; font-size: 18px; font-weight: 700; }
    .lrp-title mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .lrp-filters { display: flex; gap: 8px; flex-wrap: wrap; }
    .lrp-filter { background: rgba(255,255,255,0.2); color: white; border: none; border-radius: 16px; padding: 4px 14px; font-size: 12px; font-weight: 600; cursor: pointer; transition: background 0.2s; }
    .lrp-filter.active { background: white; color: #388e3c; }
    .lrp-filter.pending.active { color: #92400e; }
    .lrp-filter.approved.active { color: #065f46; }
    .lrp-filter.rejected.active { color: #991b1b; }
    .lrp-loading { display: flex; justify-content: center; padding: 40px; }
    .lrp-empty { text-align: center; padding: 40px; color: #9ca3af; }
    .lrp-empty mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .lrp-list { padding: 12px 16px; max-height: 480px; overflow-y: auto; }
    .lrp-item { display: flex; align-items: flex-start; gap: 14px; padding: 14px; border-radius: 12px; margin-bottom: 10px; border: 1px solid #f1f5f9; background: #fafafa; transition: background 0.15s; }
    .lrp-item:hover { background: #f0fdf4; }
    .lrp-pending { border-left: 4px solid #f59e0b; }
    .lrp-approved { border-left: 4px solid #10b981; }
    .lrp-rejected { border-left: 4px solid #ef4444; }
    .lrp-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #4caf50, #388e3c); color: white; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .lrp-info { flex: 1; min-width: 0; }
    .lrp-name { font-weight: 700; color: #111827; font-size: 14px; }
    .lrp-dept { font-size: 12px; color: #6b7280; font-weight: 400; margin-left: 6px; }
    .lrp-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; font-size: 12px; color: #374151; }
    .lrp-type { background: #eff6ff; color: #1d4ed8; border-radius: 8px; padding: 2px 8px; font-weight: 600; }
    .lrp-dates { color: #4b5563; }
    .lrp-days { color: #6b7280; }
    .lrp-reason { font-size: 12px; color: #6b7280; font-style: italic; margin-top: 4px; }
    .lrp-review-note { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #4b5563; margin-top: 4px; }
    .lrp-review-note mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .lrp-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
    .lrp-status { padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-approved { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    .lrp-submitted { font-size: 11px; color: #9ca3af; }
    .lrp-actions { display: flex; gap: 4px; }
    .approve-btn { color: #10b981 !important; }
    .reject-btn { color: #ef4444 !important; }

    /* Responsive */
    @media (max-width: 768px) {
      .attendance-container {
        padding: 80px 16px 32px;
      }

      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .title-area {
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
      }

      .title-text h1 {
        font-size: 24px;
      }

      .header-stats {
        width: 100%;
      }

      .stat-card {
        flex: 1;
        justify-content: center;
      }

      .departments-grid {
        grid-template-columns: 1fr;
      }
    }

    .notification-dropdown {
      position: absolute;
      top: 60px;
      right: 100px;
      width: 420px;
      max-height: 600px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .notification-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      background: #f5f5f5;
    }

    .notification-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .notification-header button {
      font-size: 13px;
    }

    .notification-list {
      flex: 1;
      overflow-y: auto;
      max-height: 450px;
    }

    .no-notifications {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #999;
    }

    .no-notifications mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    .no-notifications p {
      margin: 0;
      font-size: 16px;
    }

    .notification-item {
      display: flex;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.2s;
      cursor: pointer;
    }

    .notification-item:hover {
      background: #f9f9f9;
    }

    .notification-item.unread {
      background: #e3f2fd;
    }

    .notification-item.unread:hover {
      background: #d1e7f9;
    }

    .notification-icon {
      flex-shrink: 0;
    }

    .notification-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-size: 14px;
      font-weight: 600;
      color: #333;
      margin: 0 0 4px 0;
    }

    .notification-message {
      font-size: 13px;
      color: #666;
      margin: 0 0 6px 0;
      line-height: 1.4;
    }

    .notification-time {
      font-size: 12px;
      color: #999;
    }

    .notification-item button {
      flex-shrink: 0;
      color: #4CAF50;
    }

    .notification-footer {
      padding: 12px 20px;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      background: #f5f5f5;
    }

    .notification-footer button {
      width: 100%;
    }

    .training-section-header,
    .departments-section-header {
      text-align: center;
      margin: 40px 0 32px 0;
      padding: 0 24px;
    }

    .training-section-header h2,
    .departments-section-header h2 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      font-size: 32px;
      font-weight: 600;
      color: white;
      margin: 0 0 12px 0;
    }

    .training-section-header h2 mat-icon,
    .departments-section-header h2 mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: white;
    }

    .training-section-header p,
    .departments-section-header p {
      font-size: 16px;
      color: rgba(255, 255, 255, 0.9);
      margin: 0;
    }

    .training-access-section {
      display: flex;
      justify-content: center;
      padding: 0 24px 60px 24px;
      margin-bottom: 40px;
      border-bottom: 2px solid rgba(0, 0, 139, 0.1);
    }

    .training-access-card {
      max-width: 800px;
      width: 100%;
      background: linear-gradient(135deg, rgba(0, 0, 139, 0.95) 0%, rgba(30, 144, 255, 0.95) 100%) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 24px !important;
      box-shadow: 0 12px 48px rgba(0, 0, 139, 0.4) !important;
      padding: 0 !important;
      overflow: hidden;
    }

    .training-card-content {
      padding: 64px 48px;
      text-align: center;
      color: white;
    }

    .training-main-icon {
      font-size: 96px;
      width: 96px;
      height: 96px;
      color: white;
      margin-bottom: 24px;
      filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3));
    }

    .training-card-content h2 {
      font-size: 42px;
      font-weight: 700;
      color: white;
      margin: 0 0 20px 0;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    }

    .training-card-content p {
      font-size: 18px;
      color: rgba(255, 255, 255, 0.95);
      margin: 0 0 40px 0;
      line-height: 1.6;
    }

    .training-access-btn {
      padding: 16px 48px !important;
      font-size: 18px !important;
      background: white !important;
      color: #1e90ff !important;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3) !important;
      transition: all 0.3s ease !important;
      font-weight: 600 !important;
    }

    .training-access-btn:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.4) !important;
      background: rgba(255, 255, 255, 0.95) !important;
    }

    .training-access-btn mat-icon {
      margin-right: 8px;
    }

    .access-section {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      padding: 0 40px 40px 40px;
      max-width: 1600px;
      margin: 0 auto;
    }

    .access-card {
      text-align: center;
      padding: 32px !important;
      background: rgba(255, 255, 255, 0.95) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
    }

    @media (max-width: 1400px) {
      .access-section {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 1024px) {
      .access-section {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .access-section {
        grid-template-columns: 1fr;
        padding: 0 16px 40px 16px;
      }
    }

    .access-card .folder-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #1e90ff;
      margin: 0 auto 16px auto;
      display: block;
    }

    .access-card h2 {
      font-size: 22px;
      font-weight: 600;
      color: #1e90ff;
      margin: 0 0 12px 0;
    }

    .access-card p {
      font-size: 14px;
      color: #666;
      margin: 0 0 20px 0;
    }

    .access-btn {
      padding: 10px 24px !important;
      font-size: 14px !important;
      box-shadow: 0 4px 12px rgba(0, 0, 139, 0.3) !important;
      transition: all 0.3s ease !important;
    }

    .access-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0, 0, 139, 0.4) !important;
    }

    .access-btn mat-icon {
      margin-right: 8px;
    }

    .header-section {
      margin-bottom: 32px;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .export-btn {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      font-weight: 600;
    }

    .export-btn mat-icon {
      margin-right: 8px;
    }

    h1 {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      margin: 0;
      font-size: 32px;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    h1 mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .refresh-info {
      display: flex;
      align-items: center;
      gap: 8px;
      color: white;
      background: rgba(255, 255, 255, 0.1);
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
    }

    .refresh-info mat-icon {
      font-size: 20px;
      animation: rotate 2s linear infinite;
    }

    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }

    .metric-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px !important;
      border-radius: 12px !important;
      transition: transform 0.2s;
    }

    .metric-card:hover {
      transform: translateY(-4px);
    }

    .metric-card mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .metric-card.total {
      background: linear-gradient(135deg, #4169e1, #1e90ff);
      color: white;
    }

    .metric-card.present {
      background: linear-gradient(135deg, #28a745, #20c997);
      color: white;
    }

    .metric-card.absent {
      background: linear-gradient(135deg, #dc3545, #e74c3c);
      color: white;
    }

    .metric-card.late {
      background: linear-gradient(135deg, #ffc107, #ff9800);
      color: white;
    }

    .metric-content h2 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
    }

    .metric-content p {
      margin: 4px 0 0;
      font-size: 14px;
      opacity: 0.9;
    }

    .department-section, .employee-section {
      margin-bottom: 32px;
    }

    .department-section h2, .employee-section h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      margin-bottom: 16px;
      font-size: 24px;
      font-weight: 600;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      gap: 20px;
    }

    .section-header h2 {
      margin: 0;
    }

    .search-field {
      min-width: 300px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 8px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }

    .search-field ::ng-deep .mat-mdc-form-field-focus-overlay {
      background-color: transparent;
    }

    .search-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: transparent;
    }

    .search-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .department-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }

    .department-card {
      padding: 16px !important;
      border-radius: 8px !important;
    }

    .department-card h3 {
      margin: 0 0 12px;
      color: #1e90ff;
      font-size: 18px;
    }

    .dept-stats {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }

    .dept-stats .stat {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 14px;
    }

    .dept-stats .stat.present {
      color: #28a745;
    }

    .dept-stats .stat.late {
      color: #ff9800;
    }

    .dept-stats mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .employee-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 12px;
    }

    @media (max-width: 1800px) {
      .employee-grid {
        grid-template-columns: repeat(6, 1fr);
      }
    }

    @media (max-width: 1400px) {
      .employee-grid {
        grid-template-columns: repeat(5, 1fr);
      }
    }

    @media (max-width: 1200px) {
      .employee-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    @media (max-width: 900px) {
      .employee-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 600px) {
      .employee-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .employee-card {
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.1));
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 24px !important;
      overflow: hidden;
      transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37) !important;
      position: relative;
      min-height: 200px;
    }

    .employee-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #1e3c72 0%, #2a5298 100%);
      transform: scaleX(0);
      transform-origin: left;
      transition: transform 0.3s ease;
    }

    .employee-card.present::before {
      background: linear-gradient(90deg, rgba(52, 211, 153, 1), rgba(16, 185, 129, 1));
    }

    .employee-card.absent::before {
      background: linear-gradient(90deg, rgba(248, 113, 113, 1), rgba(239, 68, 68, 1));
    }

    .employee-card.late::before {
      background: linear-gradient(90deg, rgba(251, 191, 36, 1), rgba(245, 158, 11, 1));
    }

    .employee-card:hover::before {
      transform: scaleX(1);
    }

    .employee-card:hover {
      transform: translateY(-6px) scale(1.02);
      box-shadow: 0 16px 48px rgba(31, 38, 135, 0.5) !important;
      background: linear-gradient(145deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0.15));
    }

    .card-content {
      display: flex;
      flex-direction: column;
      padding: 0;
    }

    .employee-photo {
      position: relative;
      width: 100%;
      height: 140px;
      background: linear-gradient(135deg, rgba(248, 249, 250, 0.5), rgba(233, 236, 239, 0.5));
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .employee-photo img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 8px 24px rgba(31, 38, 135, 0.3);
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .employee-photo img:hover {
      transform: scale(1.05);
      box-shadow: 0 12px 32px rgba(31, 38, 135, 0.5);
      border-color: rgba(30, 60, 114, 0.8);
    }

    .photo-placeholder {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba(233, 236, 239, 0.8), rgba(248, 249, 250, 0.8));
      border: 3px solid rgba(255, 255, 255, 0.8);
      box-shadow: 0 8px 24px rgba(31, 38, 135, 0.3);
    }

    .photo-placeholder mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #adb5bd;
    }

    .status-indicator {
      position: absolute;
      bottom: 12px;
      right: 12px;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 4px 12px rgba(31, 38, 135, 0.3);
      transition: all 0.3s ease;
    }

    .employee-card:hover .status-indicator {
      transform: scale(1.15);
      box-shadow: 0 6px 16px rgba(31, 38, 135, 0.5);
    }

    .status-indicator.present {
      background: linear-gradient(135deg, rgba(52, 211, 153, 0.8), rgba(16, 185, 129, 0.8));
      color: white;
    }

    .status-indicator.absent {
      background: linear-gradient(135deg, rgba(248, 113, 113, 0.8), rgba(239, 68, 68, 0.8));
      color: white;
    }

    .status-indicator.late {
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.8), rgba(245, 158, 11, 0.8));
      color: white;
    }

    .status-indicator mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .employee-info {
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .name-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .name-section h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      background: linear-gradient(135deg, #1e3c72, #2a5298);
      background-clip: text;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
    }

    .late-badge {
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
      color: #ff9800;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    .employee-code {
      margin: 0;
      font-size: 0.75rem;
      color: rgba(30, 60, 114, 0.7);
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .employee-role {
      margin: 0;
      font-size: 0.85rem;
      color: rgba(30, 60, 114, 0.8);
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .time-info {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.3);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .time-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      color: white;
      padding: 4px 8px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }

    .time-row mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .time-row.ontime {
      background: linear-gradient(135deg, rgba(52, 211, 153, 0.8), rgba(16, 185, 129, 0.8));
      color: white;
    }

    .time-row.late {
      background: linear-gradient(135deg, rgba(251, 191, 36, 0.8), rgba(245, 158, 11, 0.8));
      color: white;
    }

    .time-row.absent {
      background: linear-gradient(135deg, rgba(248, 113, 113, 0.8), rgba(239, 68, 68, 0.8));
      color: white;
    }

    .weekly-attendance {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
    }

    .weekly-title {
      font-size: 0.7rem;
      color: rgba(30, 60, 114, 0.8);
      margin-bottom: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      text-align: center;
    }

    .week-circles {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .day-circle {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: bold;
      color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.3);
      transition: all 0.3s ease;
      position: relative;
      cursor: pointer;
    }

    .day-circle:hover {
      transform: scale(1.2);
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      z-index: 10;
    }

    .day-circle.ontime {
      background: linear-gradient(45deg, #28a745, #20c997);
    }

    .day-circle.late {
      background: linear-gradient(45deg, #ffc107, #fd7e14);
    }

    .day-circle.absent {
      background: linear-gradient(45deg, #dc3545, #e63946);
    }

    .day-circle:hover::after {
      content: attr(title);
      position: absolute;
      bottom: 120%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 0.75rem;
      white-space: nowrap;
      z-index: 1000;
      font-weight: normal;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      animation: tooltipFadeIn 0.2s ease;
      pointer-events: none;
      text-shadow: none;
    }

    @keyframes tooltipFadeIn {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .empty-state {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: white;
    }

    .empty-state mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      margin-bottom: 16px;
      opacity: 0.7;
    }

    .empty-state h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 400;
    }

    .factory-section {
      max-width: 1400px;
      margin: 0 auto;
    }

    .factory-section .header-section {
      text-align: center;
      margin-bottom: 48px;
    }

    .factory-section h1 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: white;
      margin: 0 0 12px 0;
      font-size: 36px;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .factory-section h1 mat-icon {
      font-size: 42px;
      width: 42px;
      height: 42px;
    }

    .factory-section .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      margin: 0;
    }

    .coming-soon {
      text-align: center;
      padding: 80px 40px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      max-width: 600px;
      margin: 0 auto;
    }

    .coming-soon mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #1e90ff;
      margin-bottom: 24px;
    }

    .coming-soon h2 {
      color: #1e90ff;
      font-size: 28px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }

    .coming-soon p {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
      margin: 0 0 16px 0;
    }

    .coming-soon .azure-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #0078d4;
      font-size: 14px;
      font-weight: 500;
      background: linear-gradient(135deg, #e6f3ff 0%, #cce5ff 100%);
      padding: 12px 24px;
      border-radius: 8px;
      margin: 24px 0;
      border: 1px solid #99ccff;
    }

    .coming-soon .azure-note mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      margin: 0;
      color: #0078d4;
    }

    .coming-soon button {
      margin-top: 16px;
    }

    .training-content {
      padding: 24px 0;
    }

    .training-categories {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
      margin-top: 24px;
    }

    .training-category-card {
      padding: 32px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .training-category-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .category-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #1e90ff;
      margin-bottom: 16px;
    }

    .training-category-card h3 {
      color: #1e90ff;
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 12px 0;
    }

    .training-category-card p {
      color: #666;
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 20px 0;
    }

    .training-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .training-actions button {
      flex: 1;
      min-width: 140px;
    }

    .training-actions button mat-icon {
      margin-right: 8px;
    }

    .spacer {
      flex: 1 1 auto;
    }

    /* ============ HR COMMAND CENTRE ============ */
    .command-centre { max-width: 1400px; margin: 0 auto 40px; }
    .cc-loading { display:flex; align-items:center; justify-content:center; gap:14px; padding:48px; color:#cbd5e1; }
    .cc-loading span { font-size:14px; }

    /* Directory launcher */
    .dir-launch { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:18px 22px; margin-bottom:20px;
      border-radius:16px; cursor:pointer; background:linear-gradient(135deg,rgba(99,102,241,0.22),rgba(14,165,233,0.18));
      border:1px solid rgba(129,140,248,0.35); transition:transform .18s ease, box-shadow .18s ease; }
    .dir-launch:hover { transform:translateY(-2px); box-shadow:0 12px 30px rgba(0,0,0,0.28); }
    .reg-launch { background:linear-gradient(135deg,#0e7490,#0891b2); }
    .dl-icon.reg { background:rgba(255,255,255,0.18); }
    .holistic-strip { display:grid; grid-template-columns:repeat(5,1fr); gap:14px; margin:0 0 20px; }
    .hs-card { display:flex; align-items:center; gap:14px; padding:16px 18px; border-radius:14px; cursor:pointer; transition:transform .15s ease, box-shadow .15s ease; color:#fff; }
    .hs-card:hover { transform:translateY(-2px); box-shadow:0 10px 26px rgba(0,0,0,0.25); }
    .hs-holistic { background:linear-gradient(135deg,#0891b2,#0e7490); }
    .hs-registers { background:linear-gradient(135deg,#4338ca,#4f46e5); }
    .hs-warn { background:linear-gradient(135deg,#b45309,#d97706); }
    .hs-suspend { background:linear-gradient(135deg,#b91c1c,#dc2626); }
    .hs-terminated { background:linear-gradient(135deg,#4b5563,#6b7280); }
    .hs-icon { width:46px; height:46px; border-radius:12px; background:rgba(255,255,255,0.18); display:flex; align-items:center; justify-content:center; }
    .hs-icon mat-icon { font-size:26px; width:26px; height:26px; }
    .hs-body { display:flex; flex-direction:column; }
    .hs-value { font-size:26px; font-weight:700; line-height:1; }
    .hs-value small { font-size:14px; opacity:.75; font-weight:500; }
    .hs-label { font-size:13px; font-weight:600; margin-top:3px; }
    .hs-sub { font-size:11px; opacity:.85; margin-top:2px; }
    .hs-sub.warn { color:#fde68a; font-weight:600; }
    @media (max-width:1100px) { .holistic-strip { grid-template-columns:repeat(2,1fr); } }
    .dl-left { display:flex; align-items:center; gap:16px; min-width:0; }
    .dl-icon { width:52px; height:52px; border-radius:14px; background:linear-gradient(135deg,#6366f1,#4f46e5); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .dl-icon mat-icon { color:#fff; font-size:28px; width:28px; height:28px; }
    .dl-text { display:flex; flex-direction:column; min-width:0; }
    .dl-title { font-size:17px; font-weight:800; color:#f8fafc; }
    .dl-sub { font-size:12.5px; color:#c7d2fe; }
    .dl-btn { background:#fff !important; color:#4f46e5 !important; font-weight:700 !important; flex-shrink:0; }

    /* KPI row */
    .kpi-row { display:grid; grid-template-columns:repeat(6,1fr); gap:16px; margin-bottom:20px; }
    @media (max-width:1200px){ .kpi-row{ grid-template-columns:repeat(3,1fr); } }
    @media (max-width:640px){ .kpi-row{ grid-template-columns:repeat(2,1fr); } }
    .kpi-card { display:flex; align-items:center; gap:14px; padding:18px; border-radius:16px;
      background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.09);
      backdrop-filter:blur(10px); cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, border-color .18s; }
    .kpi-card:hover { transform:translateY(-3px); box-shadow:0 12px 30px rgba(0,0,0,0.28); border-color:rgba(255,255,255,0.2); }
    .kpi-icon { width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .kpi-icon mat-icon { color:#fff; font-size:26px; width:26px; height:26px; }
    .kpi-body { display:flex; flex-direction:column; min-width:0; }
    .kpi-value { font-size:26px; font-weight:800; color:#f8fafc; line-height:1.1; }
    .kpi-value small { font-size:14px; font-weight:600; color:#94a3b8; }
    .kpi-label { font-size:12px; color:#94a3b8; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .kpi-blue .kpi-icon{ background:linear-gradient(135deg,#3b82f6,#2563eb); }
    .kpi-green .kpi-icon{ background:linear-gradient(135deg,#10b981,#059669); }
    .kpi-amber .kpi-icon{ background:linear-gradient(135deg,#f59e0b,#d97706); }
    .kpi-purple .kpi-icon{ background:linear-gradient(135deg,#8b5cf6,#7c3aed); }
    .kpi-rose .kpi-icon{ background:linear-gradient(135deg,#f43f5e,#e11d48); }
    .kpi-teal .kpi-icon{ background:linear-gradient(135deg,#14b8a6,#0d9488); }

    /* Grids */
    .cc-grid { display:grid; grid-template-columns:1.3fr 1fr; gap:16px; margin-bottom:16px; }
    .cc-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:8px; }
    @media (max-width:1100px){ .cc-grid, .cc-grid-3 { grid-template-columns:1fr; } }
    .cc-panel { background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08);
      border-radius:16px; padding:18px; backdrop-filter:blur(10px); }
    .cc-panel-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
    .cc-panel-title { display:flex; align-items:center; gap:10px; }
    .cc-panel-title mat-icon { color:#818cf8; }
    .cc-panel-title h3 { margin:0; font-size:15px; font-weight:700; color:#e2e8f0; }
    .cc-link { color:#818cf8; font-size:12px; min-width:0; }
    .cc-empty { display:flex; flex-direction:column; align-items:center; gap:8px; padding:32px 16px; color:#94a3b8; text-align:center; }
    .cc-empty mat-icon { font-size:36px; width:36px; height:36px; color:#34d399; }
    .cc-empty.small { padding:18px; }
    .cc-empty p { margin:0; font-size:13px; }

    /* Attention centre */
    .attention-list { display:flex; flex-direction:column; gap:10px; }
    .attention-item { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:12px;
      background:rgba(255,255,255,0.04); border-left:4px solid #64748b; cursor:pointer; transition:background .15s, transform .15s; }
    .attention-item:hover { background:rgba(255,255,255,0.09); transform:translateX(2px); }
    .att-icon { width:38px; height:38px; border-radius:10px; display:flex; align-items:center; justify-content:center;
      background:rgba(255,255,255,0.08); flex-shrink:0; }
    .att-icon mat-icon { color:#e2e8f0; }
    .att-body { flex:1; min-width:0; }
    .att-title { font-size:13.5px; font-weight:600; color:#f1f5f9; }
    .att-detail { font-size:12px; color:#94a3b8; margin-top:2px; }
    .att-side { display:flex; align-items:center; gap:8px; flex-shrink:0; }
    .att-go { color:#64748b; }
    .sev-badge { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:3px 8px; border-radius:20px; }
    .attention-item.sev-overdue { border-left-color:#ef4444; }
    .attention-item.sev-critical { border-left-color:#f97316; }
    .attention-item.sev-due_soon { border-left-color:#eab308; }
    .attention-item.sev-info { border-left-color:#38bdf8; }
    .sev-badge.sev-overdue { background:rgba(239,68,68,0.18); color:#fca5a5; }
    .sev-badge.sev-critical { background:rgba(249,115,22,0.18); color:#fdba74; }
    .sev-badge.sev-due_soon { background:rgba(234,179,8,0.18); color:#fde047; }
    .sev-badge.sev-info { background:rgba(56,189,248,0.18); color:#7dd3fc; }

    /* Today's attendance */
    .att-mini-stats { display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:16px; }
    .mini-stat { display:flex; flex-direction:column; align-items:center; padding:10px 4px; border-radius:10px; background:rgba(255,255,255,0.04); }
    .ms-val { font-size:18px; font-weight:800; color:#e2e8f0; }
    .ms-val.ms-green{ color:#34d399; } .ms-val.ms-amber{ color:#fbbf24; } .ms-val.ms-red{ color:#f87171; }
    .ms-lbl { font-size:10.5px; color:#94a3b8; margin-top:2px; text-align:center; }
    .trend-block { margin-bottom:14px; }
    .trend-title, .late-list-title, .leave-sub-title { font-size:11px; text-transform:uppercase; letter-spacing:.6px; color:#94a3b8; margin-bottom:8px; font-weight:600; }
    .trend-bars { display:flex; align-items:flex-end; gap:8px; height:90px; }
    .trend-col { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end; }
    .trend-bar { width:70%; min-height:4px; background:linear-gradient(180deg,#60a5fa,#3b82f6); border-radius:6px 6px 0 0; position:relative; display:flex; align-items:flex-start; overflow:hidden; }
    .trend-late { width:100%; background:rgba(251,191,36,0.85); }
    .trend-lbl { font-size:10px; color:#94a3b8; margin-top:5px; }
    .late-list { border-top:1px solid rgba(255,255,255,0.07); padding-top:12px; }
    .late-row { display:flex; align-items:center; gap:8px; padding:5px 0; font-size:12.5px; }
    .late-name { flex:1; color:#e2e8f0; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .late-dept { color:#94a3b8; font-size:11px; }
    .late-time { color:#fbbf24; font-weight:600; }
    .late-time small { color:#94a3b8; font-weight:400; }

    /* Department bars */
    .dept-bars { display:flex; flex-direction:column; gap:10px; }
    .dept-bar-row { display:flex; align-items:center; gap:10px; }
    .dbr-name { width:120px; font-size:12px; color:#cbd5e1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .dbr-track { flex:1; height:10px; background:rgba(255,255,255,0.07); border-radius:6px; overflow:hidden; }
    .dbr-fill { height:100%; background:linear-gradient(90deg,#6366f1,#818cf8); border-radius:6px; }
    .dbr-count { width:32px; text-align:right; font-size:12px; font-weight:700; color:#e2e8f0; }

    /* Completeness ring */
    .completeness { display:flex; align-items:center; gap:18px; }
    .comp-ring { width:96px; height:96px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .comp-inner { width:72px; height:72px; border-radius:50%; background:#0f172a; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .comp-pct { font-size:20px; font-weight:800; color:#f8fafc; }
    .comp-sub { font-size:10px; color:#94a3b8; }
    .comp-missing { flex:1; display:flex; flex-direction:column; gap:6px; }
    .comp-row { display:flex; align-items:center; gap:8px; font-size:12.5px; color:#cbd5e1; }
    .comp-row mat-icon { font-size:16px; width:16px; height:16px; color:#94a3b8; }
    .comp-row span { flex:1; }
    .comp-row b { color:#f1f5f9; }
    .comp-btn { width:100%; margin-top:14px; color:#c7d2fe !important; border-color:rgba(199,210,254,0.4) !important; font-size:12.5px; }

    /* Leave mini */
    .leave-mini { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; margin-bottom:14px; }
    .lm-stat { display:flex; flex-direction:column; align-items:center; padding:10px; border-radius:10px; background:rgba(255,255,255,0.04); }
    .lm-val { font-size:20px; font-weight:800; color:#e2e8f0; }
    .lm-lbl { font-size:10.5px; color:#94a3b8; margin-top:2px; }
    .leave-person { display:flex; align-items:center; gap:10px; padding:6px 0; }
    .lp-avatar { width:32px; height:32px; border-radius:50%; background:linear-gradient(135deg,#8b5cf6,#7c3aed); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .lp-avatar.upcoming { background:linear-gradient(135deg,#0ea5e9,#0284c7); }
    .lp-info { display:flex; flex-direction:column; min-width:0; }
    .lp-name { font-size:13px; color:#e2e8f0; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lp-meta { font-size:11px; color:#94a3b8; }

    /* Records overlay */
    .records-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(2px); }
    .records-panel { width:640px; max-width:100%; max-height:80vh; overflow:auto; background:#1e293b; border:1px solid rgba(255,255,255,0.1); border-radius:16px; padding:20px; }
    .rp-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    .rp-title { display:flex; align-items:center; gap:10px; }
    .rp-title mat-icon { color:#818cf8; }
    .rp-title h3 { margin:0; font-size:16px; color:#e2e8f0; }
    .rp-list { display:flex; flex-direction:column; gap:8px; }
    .rp-item { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border-radius:10px; background:rgba(255,255,255,0.04); }
    .rp-info { display:flex; flex-direction:column; min-width:0; }
    .rp-name { font-size:13.5px; font-weight:600; color:#f1f5f9; }
    .rp-dept { font-size:11.5px; color:#94a3b8; }
    .rp-missing { display:flex; flex-wrap:wrap; gap:6px; justify-content:flex-end; }
    .rp-tag { font-size:10.5px; font-weight:600; padding:3px 8px; border-radius:20px; background:rgba(244,63,94,0.16); color:#fda4af; }
  `]
})
export class PeopleComponent implements OnInit, OnDestroy {
  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  metrics: AttendanceMetrics | null = null;
  weeklyAttendance: Map<string, any> = new Map();
  loading = false;
  lastUpdate = new Date();
  currentUser: any;
  searchQuery: string = '';
  notificationCount: number = 3;
  showNotifications: boolean = false;
  notifications: any[] = [
    {
      id: 1,
      icon: 'person_add',
      iconColor: '#4CAF50',
      title: 'New Employee Added',
      message: 'John Doe has been added to the Main Office department',
      time: '5 minutes ago',
      read: false
    },
    {
      id: 2,
      icon: 'assignment_late',
      iconColor: '#FF9800',
      title: 'Attendance Alert',
      message: '3 employees marked as late today',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      icon: 'local_shipping',
      iconColor: '#2196F3',
      title: 'Logistics Update',
      message: 'New shipment scheduled for delivery',
      time: '2 hours ago',
      read: false
    },
    {
      id: 4,
      icon: 'factory',
      iconColor: '#9C27B0',
      title: 'Production Report',
      message: 'Condom Factory monthly report is ready',
      time: '3 hours ago',
      read: false
    },
    {
      id: 5,
      icon: 'school',
      iconColor: '#00BCD4',
      title: 'Training Reminder',
      message: 'New training video available for Sales Representatives',
      time: '5 hours ago',
      read: false
    }
  ];
  trainingAccess: boolean = false;
  mainOfficeAccess: boolean = false;
  condomFactoryAccess: boolean = false;
  sanitaryPadsAccess: boolean = false;
  newRoadAccess: boolean = false;
  captownAccess: boolean = false;
  brionkhorspruitAccess: boolean = false;
  portElizabethAccess: boolean = false;
  logisticsAccess: boolean = false;
  private autoRefreshSubscription?: Subscription;
  private signalRSubscription?: Subscription;

  // Leave Requests (HR panel)
  showLeaveRequests = false;
  leaveRequests: any[] = [];
  leaveRequestsLoading = false;
  leaveFilter = 'all';
  pendingLeaveCount = 0;
  leaveCounts = { pending: 0, approved: 0, rejected: 0, total: 0 };

  // HR Command Centre dashboard
  hrOverview: HrOverview | null = null;
  hrLoading = false;
  showRecordsPanel = false;
  recordsLoading = false;
  incompleteRecords: IncompleteRecord[] = [];
  private maxDeptCount = 1;
  private maxTrendPresent = 1;

  // Location cards data
  locations = [
    { id: 'main-office', name: 'Main Office', icon: 'folder_special', description: 'Access employee attendance records and HR data', action: () => this.openMainOfficeDialog() },
    { id: 'condom-factory', name: 'Condom Factory', icon: 'factory', description: 'Access factory operations and production data', action: () => this.openCondomFactoryDialog() },
    { id: 'sanitary-pads', name: 'Sanitary Pads', icon: 'local_hospital', description: 'Access sanitary pads production and inventory', action: () => this.openSanitaryPadsDialog() },
    { id: 'new-road', name: 'New Road', icon: 'location_on', description: 'Access New Road branch operations and data', action: () => this.openNewRoadDialog() },
    { id: 'cape-town', name: 'Cape Town', icon: 'location_city', description: 'Access Cape Town branch operations and data', action: () => this.openCaptownDialog() },
    { id: 'brionkhorspruit', name: 'Brionkhorspruit', icon: 'place', description: 'Access Brionkhorspruit branch operations and data', action: () => this.openBrionkhorspruitDialog() },
    { id: 'port-elizabeth', name: 'Port Elizabeth', icon: 'apartment', description: 'Access Port Elizabeth branch operations and data', action: () => this.openPortElizabethDialog() },
    { id: 'logistics', name: 'Logistics', icon: 'local_shipping', description: 'Access logistics operations and supply chain data', action: () => this.openLogisticsDialog() }
  ];
  filteredLocations = [...this.locations];

  constructor(
    private authService: AuthService,
    private attendanceService: AttendanceService,
    private router: Router,
    private dialog: MatDialog,
    private http: HttpClient
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.loadData();
    this.loadLeaveCounts();
    this.loadHrOverview();

    // Auto-refresh every 10 minutes
    this.autoRefreshSubscription = interval(600000)
      .pipe(switchMap(() => this.loadDataObservable()))
      .subscribe();

    // Listen to SignalR updates
    this.signalRSubscription = this.attendanceService.refresh$
      .subscribe(() => {
        this.loadData();
      });

    // Close notifications dropdown when clicking outside
    document.addEventListener('click', () => {
      this.showNotifications = false;
    });
  }

  ngOnDestroy(): void {
    this.autoRefreshSubscription?.unsubscribe();
    this.signalRSubscription?.unsubscribe();
  }

  loadData(): void {
    this.loading = true;

    // Load all data in parallel using forkJoin for better performance
    const employees$ = this.attendanceService.getEmployees();
    const metrics$ = this.attendanceService.getMetrics();
    const weekly$ = this.attendanceService.getWeeklyAttendance();

    // Combine all observables
    employees$.subscribe({
      next: (data) => {
        // Sort employees: Present first (sorted by earliest timeIn), then Absent
        this.employees = data.sort((a, b) => {
          // Present employees come before Absent
          if (a.status === 'Present' && b.status !== 'Present') return -1;
          if (a.status !== 'Present' && b.status === 'Present') return 1;

          // If both are Present, sort by timeIn (earliest first)
          if (a.status === 'Present' && b.status === 'Present') {
            if (a.timeIn && b.timeIn) {
              return a.timeIn.localeCompare(b.timeIn);
            }
            // If one has timeIn and other doesn't, prioritize the one with timeIn
            if (a.timeIn && !b.timeIn) return -1;
            if (!a.timeIn && b.timeIn) return 1;
          }

          // If both are Absent, maintain original order
          return 0;
        });

        // Initialize filtered employees
        this.filterEmployees();

        this.loading = false;
        this.lastUpdate = new Date();
      },
      error: (err) => {
        console.error('Error loading employees:', err);
        this.loading = false;
      }
    });

    metrics$.subscribe({
      next: (data) => {
        this.metrics = data;
      },
      error: (err) => {
        console.error('Error loading metrics:', err);
      }
    });

    weekly$.subscribe({
      next: (data) => {
        // Convert array to Map for quick lookup
        data.forEach((item: any) => {
          this.weeklyAttendance.set(item.employeeId, item.weeklyAttendance);
        });
      },
      error: (err) => {
        console.error('Error loading weekly attendance:', err);
      }
    });
  }

  private loadDataObservable() {
    this.loadData();
    return of(undefined);
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Present':
        return 'check_circle';
      case 'Absent':
        return 'cancel';
      case 'Late':
        return 'schedule';
      case 'OnLeave':
        return 'event_busy';
      default:
        return 'help_outline';
    }
  }

  formatTime(timeString: string | null): string {
    if (!timeString) return 'N/A';

    // Time is in format "HH:mm:ss" from SQL Server
    const parts = timeString.split(':');
    if (parts.length < 2) return timeString;

    const hours = parseInt(parts[0]);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${minutes} ${ampm}`;
  }

  getWeekDay(employeeId: string, day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'): any {
    const weekData = this.weeklyAttendance.get(employeeId);
    return weekData ? weekData[day] : { status: 'absent' };
  }

  getDayTooltip(employeeId: string, dayName: string, day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'): string {
    const dayData = this.getWeekDay(employeeId, day);

    if (dayData.status === 'absent') {
      return `${dayName}: Absent`;
    } else if (dayData.status === 'late') {
      const timeInFormatted = dayData.timeIn ? this.formatTime(dayData.timeIn + ':00') : 'N/A';
      return `${dayName}: ${timeInFormatted}`;
    } else {
      const timeInFormatted = dayData.timeIn ? this.formatTime(dayData.timeIn + ':00') : 'N/A';
      return `${dayName}: ${timeInFormatted}`;
    }
  }

  openTrainingDialog(): void {
    const dialogRef = this.dialog.open(TrainingPasswordDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.trainingAccess = true;
      }
    });
  }

  filterLocations(): void {
    if (!this.searchQuery.trim()) {
      this.filteredLocations = [...this.locations];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredLocations = this.locations.filter(loc => 
        loc.name.toLowerCase().includes(query) || 
        loc.description.toLowerCase().includes(query)
      );
    }
  }

  clearLocationSearch(): void {
    this.searchQuery = '';
    this.filterLocations();
  }

  private hrHeaders(): HttpHeaders {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  loadLeaveCounts(): void {
    this.http.get<any>(`${environment.apiUrl}/leave-requests/counts`, { headers: this.hrHeaders() }).subscribe({
      next: (c) => {
        this.leaveCounts = c;
        this.pendingLeaveCount = c.pending;
      },
      error: () => {}
    });
  }

  toggleLeaveRequests(): void {
    this.showLeaveRequests = !this.showLeaveRequests;
    if (this.showLeaveRequests) this.loadLeaveRequests();
  }

  setLeaveFilter(f: string): void {
    this.leaveFilter = f;
    this.loadLeaveRequests();
  }

  loadLeaveRequests(): void {
    this.leaveRequestsLoading = true;
    const statusParam = this.leaveFilter === 'all' ? '' : `?status=${this.leaveFilter}`;
    this.http.get<any[]>(`${environment.apiUrl}/leave-requests${statusParam}`, { headers: this.hrHeaders() }).subscribe({
      next: (r) => { this.leaveRequests = r; this.leaveRequestsLoading = false; },
      error: () => { this.leaveRequestsLoading = false; }
    });
  }

  reviewLeave(req: any, status: 'Approved' | 'Rejected'): void {
    this.http.put(`${environment.apiUrl}/leave-requests/${req.leaveRequestId}/review`,
      { status, notes: null }, { headers: this.hrHeaders() }).subscribe({
      next: () => {
        req.status = status;
        this.loadLeaveCounts();
      },
      error: () => {}
    });
  }

  lrInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();
  }

  // ============ HR Command Centre ============
  loadHrOverview(): void {
    this.hrLoading = true;
    this.http.get<HrOverview>(`${environment.apiUrl}/hr-dashboard/overview`, { headers: this.hrHeaders() }).subscribe({
      next: (data) => {
        this.hrOverview = data;
        this.maxDeptCount = Math.max(1, ...data.workforce.byDepartment.map(d => d.count));
        this.maxTrendPresent = Math.max(1, ...data.attendance.trend.map(t => t.present));
        this.hrLoading = false;
      },
      error: (err) => { console.error('Error loading HR overview:', err); this.hrLoading = false; }
    });
  }

  onAttentionAction(action: string): void {
    if (action === 'leave') this.openLeavePanel();
    else if (action === 'attendance') this.openMainOfficeDialog();
    else if (action === 'records') this.openRecordsPanel();
  }

  openEmployeeDirectory(): void {
    const ref = this.dialog.open(EmployeeDirectoryComponent, {
      width: '95vw',
      maxWidth: '1400px',
      panelClass: 'employee-directory-dialog',
      autoFocus: false
    });
    ref.afterClosed().subscribe(() => this.loadHrOverview());
  }

  openDailyRegister(): void {
    const ref = this.dialog.open(DailyRegisterComponent, {
      width: '95vw',
      maxWidth: '1200px',
      panelClass: 'employee-directory-dialog',
      autoFocus: false
    });
    ref.afterClosed().subscribe(() => this.loadHrOverview());
  }

  openLeavePanel(): void {
    this.showLeaveRequests = true;
    this.loadLeaveRequests();
  }

  openRecordsPanel(): void {
    this.showRecordsPanel = true;
    this.recordsLoading = true;
    this.http.get<IncompleteRecord[]>(`${environment.apiUrl}/hr-dashboard/incomplete-records`, { headers: this.hrHeaders() }).subscribe({
      next: (r) => { this.incompleteRecords = r; this.recordsLoading = false; },
      error: () => { this.recordsLoading = false; }
    });
  }

  severityLabel(sev: string): string {
    switch (sev) {
      case 'overdue': return 'Overdue';
      case 'critical': return 'Critical';
      case 'due_soon': return 'Due soon';
      default: return 'Info';
    }
  }

  trendHeight(present: number): number {
    return Math.max(6, Math.round((present / this.maxTrendPresent) * 100));
  }

  deptWidth(count: number): number {
    return Math.max(4, Math.round((count / this.maxDeptCount) * 100));
  }

  completenessRing(): string {
    const pct = this.hrOverview?.workforce.completenessRate ?? 0;
    const deg = Math.round(pct * 3.6);
    const colour = pct >= 90 ? '#34d399' : pct >= 70 ? '#fbbf24' : '#f87171';
    return `conic-gradient(${colour} ${deg}deg, rgba(255,255,255,0.1) ${deg}deg)`;
  }

  openMainOfficeDialog(): void {
    const dialogRef = this.dialog.open(MainOfficePasswordDialogComponent, {
      width: '420px',
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.mainOfficeAccess = true;
        this.loadData(); // Load data once access is granted
      }
    });
  }

  openCondomFactoryDialog(): void {
    const dialogRef = this.dialog.open(CondomFactoryPasswordDialogComponent, {
      width: '420px',
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.condomFactoryAccess = true;
      }
    });
  }

  openSanitaryPadsDialog(): void {
    const dialogRef = this.dialog.open(SanitaryPadsPasswordDialogComponent, {
      width: '420px',
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.sanitaryPadsAccess = true;
      }
    });
  }

  openNewRoadDialog(): void {
    const dialogRef = this.dialog.open(NewRoadPasswordDialogComponent, {
      width: '420px',
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.newRoadAccess = true;
      }
    });
  }

  openCaptownDialog(): void {
    const dialogRef = this.dialog.open(CaptownPasswordDialogComponent, {
      width: '420px',
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.captownAccess = true;
      }
    });
  }

  openBrionkhorspruitDialog(): void {
    const dialogRef = this.dialog.open(BrionkhorspruitPasswordDialogComponent, {
      width: '420px',
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.brionkhorspruitAccess = true;
      }
    });
  }

  openPortElizabethDialog(): void {
    const dialogRef = this.dialog.open(PortElizabethPasswordDialogComponent, {
      width: '420px',
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.portElizabethAccess = true;
      }
    });
  }

  openLogisticsDialog(): void {
    const dialogRef = this.dialog.open(LogisticsPasswordDialogComponent, {
      width: '420px',
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.logisticsAccess = true;
      }
    });
  }

  downloadWeeklyReport(): void {
    const dialogRef = this.dialog.open(WeeklyReportDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const url = `${environment.apiUrl}/reports/weekly?weekOffset=${result.weekOffset}`;
        this.http.get(url, { responseType: 'blob', observe: 'response' }).subscribe({
          next: (response) => {
            const blob = response.body;
            if (!blob) return;
            const contentDisposition = response.headers.get('content-disposition');
            let fileName = `Weekly_Attendance_Report.xlsx`;
            if (contentDisposition) {
              const match = contentDisposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]*)/i);
              if (match && match[2]) fileName = match[2];
            }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(a.href);
          },
          error: (err) => {
            console.error('Error downloading weekly report:', err);
          }
        });
      }
    });
  }

  downloadMonthlyReport(): void {
    const dialogRef = this.dialog.open(MonthlyReportDialogComponent, {
      width: '400px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        const url = `${environment.apiUrl}/reports/monthly?month=${result.month}&year=${result.year}`;
        this.http.get(url, { responseType: 'blob', observe: 'response' }).subscribe({
          next: (response) => {
            const blob = response.body;
            if (!blob) return;
            const contentDisposition = response.headers.get('content-disposition');
            let fileName = `Monthly_Attendance_Report.xlsx`;
            if (contentDisposition) {
              const match = contentDisposition.match(/filename[^;=\n]*=(['"]?)([^'"\n;]*)/i);
              if (match && match[2]) fileName = match[2];
            }
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(a.href);
          },
          error: (err) => {
            console.error('Error downloading monthly report:', err);
          }
        });
      }
    });
  }

  filterEmployees(): void {
    if (!this.searchQuery || this.searchQuery.trim() === '') {
      this.filteredEmployees = [...this.employees];
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredEmployees = this.employees.filter(employee => {
      const fullName = employee.fullName?.toLowerCase() || '';
      const employeeCode = employee.employeeCode?.toLowerCase() || '';
      const position = employee.position?.toLowerCase() || '';

      return fullName.includes(query) ||
             employeeCode.includes(query) ||
             position.includes(query);
    });
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterEmployees();
  }

  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.showNotifications = !this.showNotifications;
  }

  markAsRead(notificationId: number): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.updateNotificationCount();
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.updateNotificationCount();
  }

  updateNotificationCount(): void {
    this.notificationCount = this.notifications.filter(n => !n.read).length;
  }

  viewAllNotifications(): void {
    this.showNotifications = false;
    // Navigate to notifications page or show all notifications
  }

  logout(): void {
    this.attendanceService.stopConnection();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

// Weekly Report Dialog Component
@Component({
  selector: 'weekly-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>calendar_today</mat-icon>
      Select Week for Report
    </h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width: 100%;">
        <mat-label>Select Week</mat-label>
        <mat-select [(ngModel)]="selectedWeekOffset">
          @for (week of weekOptions; track week.value) {
            <mat-option [value]="week.value">{{ week.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onDownload()">
        <mat-icon>download</mat-icon>
        Download
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1e90ff;
    }

    mat-dialog-content {
      padding: 20px 24px;
      min-height: 120px;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }
  `]
})
export class WeeklyReportDialogComponent {
  selectedWeekOffset: number = 0;
  weekOptions: { value: number; label: string }[] = [];

  constructor(
    public dialogRef: MatDialogRef<WeeklyReportDialogComponent>
  ) {
    this.generateWeekOptions();
  }

  generateWeekOptions(): void {
    const options = [];
    const today = new Date();

    for (let i = 0; i < 12; i++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1) - (i * 7));

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 4);

      const label = i === 0
        ? `Current Week (${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)})`
        : `${i} week${i > 1 ? 's' : ''} ago (${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)})`;

      options.push({ value: i, label });
    }

    this.weekOptions = options;
  }

  formatDate(date: Date): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onDownload(): void {
    this.dialogRef.close({ weekOffset: this.selectedWeekOffset });
  }
}

// Monthly Report Dialog Component
@Component({
  selector: 'monthly-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>date_range</mat-icon>
      Select Month for Report
    </h2>
    <mat-dialog-content>
      <div style="display: flex; gap: 12px;">
        <mat-form-field appearance="outline" style="flex: 1;">
          <mat-label>Month</mat-label>
          <mat-select [(ngModel)]="selectedMonth">
            @for (month of months; track month.value) {
              <mat-option [value]="month.value">{{ month.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" style="flex: 1;">
          <mat-label>Year</mat-label>
          <mat-select [(ngModel)]="selectedYear">
            @for (year of years; track year) {
              <mat-option [value]="year">{{ year }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onDownload()">
        <mat-icon>download</mat-icon>
        Download
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1e90ff;
    }

    mat-dialog-content {
      padding: 20px 24px;
      min-height: 120px;
    }

    mat-dialog-actions {
      padding: 16px 24px;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }
  `]
})
export class MonthlyReportDialogComponent {
  selectedMonth: number;
  selectedYear: number;

  months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  years: number[] = [];

  constructor(
    public dialogRef: MatDialogRef<MonthlyReportDialogComponent>
  ) {
    const currentDate = new Date();
    this.selectedMonth = currentDate.getMonth() + 1;
    this.selectedYear = currentDate.getFullYear();

    // Generate last 3 years
    const currentYear = currentDate.getFullYear();
    for (let i = 0; i < 3; i++) {
      this.years.push(currentYear - i);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onDownload(): void {
    this.dialogRef.close({
      month: this.selectedMonth,
      year: this.selectedYear
    });
  }
}

// Main Office Password Dialog Component
@Component({
  selector: 'app-main-office-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormsModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="lock-icon">
          <mat-icon>folder_special</mat-icon>
        </div>
        <h2>Access Main Office</h2>
        <p class="info-text">This section is password protected</p>
      </div>

      <div class="dialog-body">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password"
                 [(ngModel)]="password"
                 (keyup.enter)="validatePassword()"
                 placeholder="Enter password"
                 class="password-input"
                 [class.error]="errorMessage">
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }

        <p class="contact-hint">
          <mat-icon>info_outline</mat-icon>
          Contact HR management for access credentials
        </p>
      </div>

      <div class="dialog-actions">
        <button class="btn-cancel" (click)="onCancel()">
          Cancel
        </button>
        <button class="btn-access" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .dialog-container {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      border-radius: 20px;
      padding: 32px;
      color: white;
      min-width: 360px;
    }

    .dialog-header {
      text-align: center;
      margin-bottom: 28px;
    }

    .lock-icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .lock-icon mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: white;
    }

    .dialog-header h2 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 600;
      color: white;
    }

    .info-text {
      margin: 0;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.8);
    }

    .dialog-body { margin-bottom: 24px; }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(255, 255, 255, 0.5);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 52px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: white;
      font-size: 16px;
      transition: all 0.3s;
      box-sizing: border-box;
    }

    .password-input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.15);
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
    }

    .password-input.error { border-color: #ff6b6b; }
    .password-input::placeholder { color: rgba(255, 255, 255, 0.4); }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(255, 107, 107, 0.15);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 10px;
      color: #ff6b6b;
      font-size: 14px;
      margin-bottom: 16px;
      animation: shake 0.4s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      75% { transform: translateX(8px); }
    }

    .error-message mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .contact-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 0;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.6);
    }

    .contact-hint mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .dialog-actions {
      display: flex;
      gap: 12px;
    }

    .btn-cancel, .btn-access {
      flex: 1;
      padding: 14px 24px;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.3s;
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.15);
      color: white;
    }

    .btn-access {
      background: rgba(255, 255, 255, 0.95);
      color: #1e90ff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .btn-access:hover {
      transform: translateY(-2px);
      background: white;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
    }

    .btn-access mat-icon { font-size: 20px; width: 20px; height: 20px; }
  `]
})
export class MainOfficePasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<MainOfficePasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact HR management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

// Condom Factory Password Dialog Component
@Component({
  selector: 'app-condom-factory-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <div class="dialog-container" style="background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);">
      <div class="dialog-header">
        <div class="lock-icon"><mat-icon>factory</mat-icon></div>
        <h2>Access Condom Factory</h2>
        <p class="info-text">This section is password protected</p>
      </div>
      <div class="dialog-body">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password" [(ngModel)]="password" (keyup.enter)="validatePassword()" placeholder="Enter password" class="password-input" [class.error]="errorMessage">
        </div>
        @if (errorMessage) {
          <div class="error-message"><mat-icon>error_outline</mat-icon><span>{{ errorMessage }}</span></div>
        }
        <p class="contact-hint"><mat-icon>info_outline</mat-icon>Contact factory management for access</p>
      </div>
      <div class="dialog-actions">
        <button class="btn-cancel" (click)="onCancel()">Cancel</button>
        <button class="btn-access" (click)="validatePassword()"><mat-icon>lock_open</mat-icon>Access</button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .dialog-container { border-radius: 20px; padding: 32px; color: white; min-width: 360px; }
    .dialog-header { text-align: center; margin-bottom: 28px; }
    .lock-icon { width: 72px; height: 72px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border: 2px solid rgba(255,255,255,0.3); border-radius: 50%; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
    .lock-icon mat-icon { font-size: 36px; width: 36px; height: 36px; color: white; }
    .dialog-header h2 { margin: 0 0 8px; font-size: 24px; font-weight: 600; color: white; }
    .info-text { margin: 0; font-size: 14px; color: rgba(255,255,255,0.8); }
    .dialog-body { margin-bottom: 24px; }
    .input-group { position: relative; margin-bottom: 16px; }
    .input-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.5); font-size: 20px; width: 20px; height: 20px; }
    .password-input { width: 100%; padding: 16px 16px 16px 52px; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; color: white; font-size: 16px; transition: all 0.3s; box-sizing: border-box; }
    .password-input:focus { outline: none; border-color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.15); box-shadow: 0 0 0 4px rgba(255,255,255,0.1); }
    .password-input.error { border-color: #ffcdd2; }
    .password-input::placeholder { color: rgba(255,255,255,0.4); }
    .error-message { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); border-radius: 10px; color: white; font-size: 14px; margin-bottom: 16px; animation: shake 0.4s ease-in-out; }
    @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 75% { transform: translateX(8px); } }
    .error-message mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .contact-hint { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0; font-size: 13px; color: rgba(255,255,255,0.6); }
    .contact-hint mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .dialog-actions { display: flex; gap: 12px; }
    .btn-cancel, .btn-access { flex: 1; padding: 14px 24px; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.3s; }
    .btn-cancel { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.2); }
    .btn-cancel:hover { background: rgba(255,255,255,0.15); color: white; }
    .btn-access { background: rgba(255,255,255,0.95); color: #ee5a5a; box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
    .btn-access:hover { transform: translateY(-2px); background: white; box-shadow: 0 6px 24px rgba(0,0,0,0.25); }
    .btn-access mat-icon { font-size: 20px; width: 20px; height: 20px; }
  `]
})
export class CondomFactoryPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<CondomFactoryPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact factory management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

// Sanitary Pads Password Dialog Component
@Component({
  selector: 'app-sanitary-pads-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormsModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="lock-icon">
          <mat-icon>local_hospital</mat-icon>
        </div>
        <h2>Access Sanitary Pads</h2>
        <p class="info-text">This section is password protected</p>
      </div>

      <div class="dialog-content">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password"
                 [(ngModel)]="password"
                 (keyup.enter)="validatePassword()"
                 placeholder="Enter password"
                 class="password-input">
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }

        <p class="contact-text">
          <mat-icon>info_outline</mat-icon>
          Contact production management for the password
        </p>
      </div>

      <div class="dialog-actions">
        <button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      border-radius: 16px;
      padding: 32px;
      min-width: 350px;
      box-shadow: 0 20px 60px rgba(240, 147, 251, 0.4);
    }

    .dialog-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .lock-icon {
      width: 70px;
      height: 70px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .lock-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    h2 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .info-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin: 0;
    }

    .dialog-content {
      margin-bottom: 24px;
    }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(240, 147, 251, 0.7);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 48px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      outline: none;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .password-input:focus {
      border-color: white;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
    }

    .password-input::placeholder {
      color: #999;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.95);
      color: #d32f2f;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      animation: shake 0.5s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .contact-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      margin: 0;
    }

    .contact-text mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .cancel-btn {
      padding: 12px 24px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      background: transparent;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: white;
    }

    .access-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      background: white;
      color: #f5576c;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .access-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .access-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class SanitaryPadsPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<SanitaryPadsPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact production management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-newroad-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="lock-icon">
          <mat-icon>location_on</mat-icon>
        </div>
        <h2>Access New Road Branch</h2>
        <p class="info-text">This section is password protected</p>
      </div>

      <div class="dialog-content">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password"
                 [(ngModel)]="password"
                 (keyup.enter)="validatePassword()"
                 placeholder="Enter password"
                 class="password-input">
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }

        <p class="contact-text">
          <mat-icon>info_outline</mat-icon>
          Contact branch management for the password
        </p>
      </div>

      <div class="dialog-actions">
        <button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%);
      border-radius: 16px;
      padding: 32px;
      min-width: 350px;
      box-shadow: 0 20px 60px rgba(255, 167, 38, 0.4);
    }

    .dialog-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .lock-icon {
      width: 70px;
      height: 70px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .lock-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    h2 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .info-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin: 0;
    }

    .dialog-content {
      margin-bottom: 24px;
    }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(251, 140, 0, 0.7);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 48px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      outline: none;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .password-input:focus {
      border-color: white;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
    }

    .password-input::placeholder {
      color: #999;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.95);
      color: #d32f2f;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      animation: shake 0.5s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .contact-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      margin: 0;
    }

    .contact-text mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .cancel-btn {
      padding: 12px 24px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      background: transparent;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: white;
    }

    .access-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      background: white;
      color: #fb8c00;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .access-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .access-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class NewRoadPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<NewRoadPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact branch management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-captown-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="lock-icon">
          <mat-icon>location_city</mat-icon>
        </div>
        <h2>Access Cape Town Branch</h2>
        <p class="info-text">This section is password protected</p>
      </div>

      <div class="dialog-content">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password"
                 [(ngModel)]="password"
                 (keyup.enter)="validatePassword()"
                 placeholder="Enter password"
                 class="password-input">
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }

        <p class="contact-text">
          <mat-icon>info_outline</mat-icon>
          Contact branch management for the password
        </p>
      </div>

      <div class="dialog-actions">
        <button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      background: linear-gradient(135deg, #26a69a 0%, #00897b 100%);
      border-radius: 16px;
      padding: 32px;
      min-width: 350px;
      box-shadow: 0 20px 60px rgba(38, 166, 154, 0.4);
    }

    .dialog-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .lock-icon {
      width: 70px;
      height: 70px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .lock-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    h2 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .info-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin: 0;
    }

    .dialog-content {
      margin-bottom: 24px;
    }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(0, 137, 123, 0.7);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 48px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      outline: none;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .password-input:focus {
      border-color: white;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
    }

    .password-input::placeholder {
      color: #999;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.95);
      color: #d32f2f;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      animation: shake 0.5s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .contact-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      margin: 0;
    }

    .contact-text mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .cancel-btn {
      padding: 12px 24px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      background: transparent;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: white;
    }

    .access-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      background: white;
      color: #00897b;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .access-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .access-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class CaptownPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<CaptownPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact branch management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-brionkhorspruit-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="lock-icon">
          <mat-icon>place</mat-icon>
        </div>
        <h2>Access Bronkhorstspruit</h2>
        <p class="info-text">This section is password protected</p>
      </div>

      <div class="dialog-content">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password"
                 [(ngModel)]="password"
                 (keyup.enter)="validatePassword()"
                 placeholder="Enter password"
                 class="password-input">
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }

        <p class="contact-text">
          <mat-icon>info_outline</mat-icon>
          Contact branch management for the password
        </p>
      </div>

      <div class="dialog-actions">
        <button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      background: linear-gradient(135deg, #7c4dff 0%, #651fff 100%);
      border-radius: 16px;
      padding: 32px;
      min-width: 350px;
      box-shadow: 0 20px 60px rgba(124, 77, 255, 0.4);
    }

    .dialog-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .lock-icon {
      width: 70px;
      height: 70px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .lock-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    h2 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .info-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin: 0;
    }

    .dialog-content {
      margin-bottom: 24px;
    }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(101, 31, 255, 0.7);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 48px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      outline: none;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .password-input:focus {
      border-color: white;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
    }

    .password-input::placeholder {
      color: #999;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.95);
      color: #d32f2f;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      animation: shake 0.5s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .contact-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      margin: 0;
    }

    .contact-text mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .cancel-btn {
      padding: 12px 24px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      background: transparent;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: white;
    }

    .access-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      background: white;
      color: #651fff;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .access-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .access-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class BrionkhorspruitPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<BrionkhorspruitPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact branch management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-portelizabeth-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="lock-icon">
          <mat-icon>apartment</mat-icon>
        </div>
        <h2>Access Port Elizabeth</h2>
        <p class="info-text">This section is password protected</p>
      </div>

      <div class="dialog-content">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password"
                 [(ngModel)]="password"
                 (keyup.enter)="validatePassword()"
                 placeholder="Enter password"
                 class="password-input">
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }

        <p class="contact-text">
          <mat-icon>info_outline</mat-icon>
          Contact branch management for the password
        </p>
      </div>

      <div class="dialog-actions">
        <button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      background: linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%);
      border-radius: 16px;
      padding: 32px;
      min-width: 350px;
      box-shadow: 0 20px 60px rgba(66, 165, 245, 0.4);
    }

    .dialog-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .lock-icon {
      width: 70px;
      height: 70px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .lock-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    h2 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .info-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin: 0;
    }

    .dialog-content {
      margin-bottom: 24px;
    }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(30, 136, 229, 0.7);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 48px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      outline: none;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .password-input:focus {
      border-color: white;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
    }

    .password-input::placeholder {
      color: #999;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.95);
      color: #d32f2f;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      animation: shake 0.5s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .contact-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      margin: 0;
    }

    .contact-text mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .cancel-btn {
      padding: 12px 24px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      background: transparent;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: white;
    }

    .access-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      background: white;
      color: #1e88e5;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .access-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .access-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class PortElizabethPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<PortElizabethPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact branch management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-logistics-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="lock-icon">
          <mat-icon>local_shipping</mat-icon>
        </div>
        <h2>Access Logistics</h2>
        <p class="info-text">This section is password protected</p>
      </div>

      <div class="dialog-content">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password"
                 [(ngModel)]="password"
                 (keyup.enter)="validatePassword()"
                 placeholder="Enter password"
                 class="password-input">
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }

        <p class="contact-text">
          <mat-icon>info_outline</mat-icon>
          Contact logistics management for the password
        </p>
      </div>

      <div class="dialog-actions">
        <button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      background: linear-gradient(135deg, #66bb6a 0%, #43a047 100%);
      border-radius: 16px;
      padding: 32px;
      min-width: 350px;
      box-shadow: 0 20px 60px rgba(102, 187, 106, 0.4);
    }

    .dialog-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .lock-icon {
      width: 70px;
      height: 70px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .lock-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    h2 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .info-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin: 0;
    }

    .dialog-content {
      margin-bottom: 24px;
    }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(67, 160, 71, 0.7);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 48px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      outline: none;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .password-input:focus {
      border-color: white;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
    }

    .password-input::placeholder {
      color: #999;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.95);
      color: #d32f2f;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      animation: shake 0.5s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .contact-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      margin: 0;
    }

    .contact-text mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .cancel-btn {
      padding: 12px 24px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      background: transparent;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: white;
    }

    .access-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      background: white;
      color: #43a047;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .access-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .access-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class LogisticsPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<LogisticsPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact logistics management.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'app-training-password-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="lock-icon">
          <mat-icon>school</mat-icon>
        </div>
        <h2>Access Training Center</h2>
        <p class="info-text">This section is password protected</p>
      </div>

      <div class="dialog-content">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password"
                 [(ngModel)]="password"
                 (keyup.enter)="validatePassword()"
                 placeholder="Enter password"
                 class="password-input">
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }

        <p class="contact-text">
          <mat-icon>info_outline</mat-icon>
          Contact HR or training coordinator for the password
        </p>
      </div>

      <div class="dialog-actions">
        <button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      background: linear-gradient(135deg, #5c6bc0 0%, #3949ab 100%);
      border-radius: 16px;
      padding: 32px;
      min-width: 350px;
      box-shadow: 0 20px 60px rgba(92, 107, 192, 0.4);
    }

    .dialog-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .lock-icon {
      width: 70px;
      height: 70px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .lock-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: white;
    }

    h2 {
      color: white;
      font-size: 24px;
      font-weight: 600;
      margin: 0 0 8px 0;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .info-text {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      margin: 0;
    }

    .dialog-content {
      margin-bottom: 24px;
    }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: rgba(57, 73, 171, 0.7);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 48px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.95);
      font-size: 16px;
      outline: none;
      transition: all 0.3s ease;
      box-sizing: border-box;
    }

    .password-input:focus {
      border-color: white;
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2);
    }

    .password-input::placeholder {
      color: #999;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.95);
      color: #d32f2f;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      animation: shake 0.5s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      75% { transform: translateX(5px); }
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .contact-text {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: rgba(255, 255, 255, 0.85);
      font-size: 13px;
      margin: 0;
    }

    .contact-text mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .cancel-btn {
      padding: 12px 24px;
      border: 2px solid rgba(255, 255, 255, 0.5);
      background: transparent;
      color: white;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .cancel-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: white;
    }

    .access-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 24px;
      border: none;
      background: white;
      color: #3949ab;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    .access-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }

    .access-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `]
})
export class TrainingPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<TrainingPasswordDialogComponent>
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact HR or training coordinator.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}


