import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
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
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
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
    MatChipsModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMenuModule,
    NavbarComponent,
    PageHeaderComponent,
    SkeletonRowsComponent,
    EmptyStateComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="attendance-container">
      @if (!trainingAccess && !mainOfficeAccess && !condomFactoryAccess && !sanitaryPadsAccess && !newRoadAccess && !captownAccess && !brionkhorspruitAccess && !portElizabethAccess && !logisticsAccess) {
        <app-page-header class="people-header" [crumbs]="['People and money', 'People']" title="People"
                         [subtitle]="locations.length + ' locations · Biometric clock-ins and daily registers'">
          <div class="location-search">
            <mat-icon aria-hidden="true">search</mat-icon>
            <input type="text"
                   placeholder="Search departments or branches"
                   aria-label="Search departments or branches"
                   [(ngModel)]="searchQuery"
                   (input)="filterLocations()">
            @if (searchQuery) {
              <button aria-label="Close" mat-icon-button (click)="clearLocationSearch()" class="clear-btn">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>
          <button mat-flat-button color="primary" (click)="toggleLeaveRequests()">
            <mat-icon>inbox</mat-icon>Leave requests
            @if (pendingLeaveCount > 0) {
              <span class="requests-badge">{{pendingLeaveCount}}</span>
            }
          </button>
        </app-page-header>

        <!-- ============ HR COMMAND CENTRE ============ -->
        <div class="command-centre">
          @if (hrLoading && !hrOverview) {
            <app-skeleton-rows [rows]="5" [avatar]="false"></app-skeleton-rows>
          } @else if (hrOverview) {
            <div class="launchers">
              <!-- Directory launcher -->
              <div class="dir-launch" (click)="openEmployeeDirectory()">
                <div class="dl-left">
                  <div class="dl-icon"><mat-icon>badge</mat-icon></div>
                  <div class="dl-text">
                    <span class="dl-title">Employee Directory</span>
                    <span class="dl-sub">Search, view &amp; edit staff across all sites — Main Office, Security, factories, branches &amp; logistics — and store contracts &amp; documents</span>
                  </div>
                </div>
                <button mat-stroked-button class="dl-btn"><mat-icon>arrow_forward</mat-icon> Open Directory</button>
              </div>

              <!-- Daily register launcher -->
              <div class="dir-launch" (click)="openDailyRegister()">
                <div class="dl-left">
                  <div class="dl-icon"><mat-icon>fact_check</mat-icon></div>
                  <div class="dl-text">
                    <span class="dl-title">Daily Attendance Register</span>
                    <span class="dl-sub">Capture manual in/out registers for sites that don't clock in — Main Building, Security &amp; more — for a holistic attendance view</span>
                  </div>
                </div>
                <button mat-stroked-button class="dl-btn"><mat-icon>edit_note</mat-icon> Capture Register</button>
              </div>
            </div>

            <!-- Top KPI row -->
            <div class="kpi-row">
              <div class="kpi-card kpi-primary clickable" (click)="openEmployeeDirectory()" matTooltip="Open the employee directory">
                <div class="kpi-icon"><mat-icon>groups</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.workforce.totalEmployees }}</span>
                  <span class="kpi-label">Active Employees</span>
                </div>
              </div>
              <div class="kpi-card kpi-ok" matTooltip="Clocked in today">
                <div class="kpi-icon"><mat-icon>how_to_reg</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.attendance.clockedInToday }}<small>/{{ hrOverview.workforce.totalEmployees }}</small></span>
                  <span class="kpi-label">Present Today ({{ hrOverview.attendance.attendanceRate }}%)</span>
                </div>
              </div>
              <div class="kpi-card kpi-danger clickable" (click)="openMainOfficeDialog()" matTooltip="Not clocked in">
                <div class="kpi-icon"><mat-icon>person_off</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.attendance.notClockedIn }}</span>
                  <span class="kpi-label">Absent Today</span>
                </div>
              </div>
              <div class="kpi-card kpi-info clickable" (click)="openLeavePanel()" matTooltip="On approved leave today">
                <div class="kpi-icon"><mat-icon>beach_access</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.leave.onLeaveToday }}</span>
                  <span class="kpi-label">On Leave Today</span>
                </div>
              </div>
              <div class="kpi-card kpi-warn clickable" (click)="openLeavePanel()" matTooltip="Pending HR actions">
                <div class="kpi-icon"><mat-icon>pending_actions</mat-icon></div>
                <div class="kpi-body">
                  <span class="kpi-value">{{ hrOverview.leave.pending }}</span>
                  <span class="kpi-label">Pending Approvals</span>
                </div>
              </div>
              <div class="kpi-card" matTooltip="New hires this month">
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
                  <button aria-label="Refresh" mat-icon-button (click)="loadHrOverview()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
                </div>
                @if (hrOverview.attention.length === 0) {
                  <app-empty-state [compact]="true" icon="task_alt" title="All clear" message="Nothing needs attention right now."></app-empty-state>
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
                  <app-empty-state [compact]="true" icon="event_available" title="No current or upcoming leave" message="Approved leave shows here once it is booked."></app-empty-state>
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
                <button aria-label="Close" mat-icon-button (click)="showRecordsPanel = false"><mat-icon>close</mat-icon></button>
              </div>
              @if (recordsLoading) {
                <app-skeleton-rows [rows]="5" [avatar]="false"></app-skeleton-rows>
              } @else if (incompleteRecords.length === 0) {
                <app-empty-state icon="task_alt" title="All employee records are complete" message="Nobody is missing details right now."></app-empty-state>
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
              <button aria-label="Close" mat-icon-button (click)="showLeaveRequests=false"><mat-icon>close</mat-icon></button>
            </div>
            @if (leaveRequestsLoading) {
              <app-skeleton-rows [rows]="5"></app-skeleton-rows>
            } @else if (leaveRequests.length === 0) {
              <app-empty-state icon="inbox"
                               [title]="leaveFilter === 'all' ? 'No leave requests' : 'No ' + leaveFilter.toLowerCase() + ' leave requests'"
                               [message]="leaveFilter === 'all' ? 'Leave requests appear here when employees apply.' : 'None of the leave requests are ' + leaveFilter.toLowerCase() + '.'">
                @if (leaveFilter !== 'all') {
                  <button mat-stroked-button (click)="setLeaveFilter('all')">Show all requests</button>
                }
              </app-empty-state>
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
                          <button aria-label="Approve" mat-icon-button class="approve-btn" matTooltip="Approve" (click)="reviewLeave(req, 'Approved')"><mat-icon>check_circle</mat-icon></button>
                          <button aria-label="Reject" mat-icon-button class="reject-btn" matTooltip="Reject" (click)="reviewLeave(req, 'Rejected')"><mat-icon>cancel</mat-icon></button>
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
              <div class="location-card"
                   (click)="location.action()"
                   [matTooltip]="'Access ' + location.name">
                <div class="card-content">
                  <div class="icon-container">
                    <mat-icon>{{ location.icon }}</mat-icon>
                  </div>

                  <h3>{{ location.name }}</h3>

                  <p class="location-description">{{ location.description }}</p>

                  <div class="card-footer">
                    <button mat-stroked-button class="access-btn">
                      <mat-icon>lock_open</mat-icon>
                      Access
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>

          @if (filteredLocations.length === 0 && searchQuery) {
            <app-empty-state icon="search_off" title="No locations found"
                             [message]="'No department or branch matches “' + searchQuery + '”.'">
              <button mat-stroked-button (click)="clearLocationSearch()">Clear the search</button>
            </app-empty-state>
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
              <button aria-label="Close" matSuffix mat-icon-button (click)="clearSearch()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
        </div>

        @if (loading) {
          <app-skeleton-rows [rows]="6"></app-skeleton-rows>
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
              <app-empty-state class="empty-state" icon="people_outline"
                               [title]="searchQuery ? 'No employees match your search' : 'No employees found'"
                               [message]="searchQuery ? 'Nobody matches “' + searchQuery + '”.' : 'No employees are on the live register yet.'">
                @if (searchQuery) {
                  <button mat-stroked-button (click)="clearSearch()">Clear the search</button>
                }
              </app-empty-state>
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
    :host { display: block; }

    .attendance-container {
      min-height: calc(100vh - var(--shell-topbar-height));
      box-sizing: border-box;
      padding: var(--space-5) var(--space-6) var(--space-8);
      background: var(--color-canvas);
      color: var(--color-text);
    }

    @media (max-width: 600px) {
      .attendance-container {
        padding: var(--space-4) var(--space-4) var(--space-6);
      }
    }

    /* Page header */
    .people-header {
      max-width: 1400px;
      margin: 0 auto var(--space-5);
    }

    .location-search {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      box-sizing: border-box;
      width: 280px;
      max-width: 100%;
      height: 36px;
      padding: 0 var(--space-1) 0 var(--space-3);
      border: 1px solid var(--color-line-strong);
      border-radius: var(--radius-control);
      background: var(--color-surface);
    }

    .location-search:focus-within {
      border-color: var(--color-primary);
    }

    .location-search > mat-icon {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      font-size: var(--text-xl);
      color: var(--color-text-2);
    }

    .location-search input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      background: transparent;
      font: inherit;
      font-size: var(--text-sm);
      color: var(--color-text-2);
    }

    .clear-btn {
      --mdc-icon-button-state-layer-size: 28px;
      --mdc-icon-button-icon-size: 18px;
    }

    .clear-btn mat-icon {
      width: 18px;
      height: 18px;
      font-size: var(--text-xl);
    }

    .requests-badge {
      margin-left: var(--space-2);
      padding: 0 var(--space-2);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-primary);
      font-size: var(--text-xs);
      font-weight: 800;
      line-height: 1.6;
    }

    /* ============ HR COMMAND CENTRE ============ */
    .command-centre {
      max-width: 1400px;
      margin: 0 auto var(--space-6);
    }

    /* Directory and daily register launchers */
    .launchers {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }

    @media (max-width: 1100px) {
      .launchers { grid-template-columns: minmax(0, 1fr); }
    }

    .dir-launch {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3) var(--space-4);
      padding: var(--space-4) var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .dir-launch:hover {
      border-color: var(--color-line-strong);
      box-shadow: var(--shadow-md);
    }

    .dl-left {
      flex: 1 1 260px;
      display: flex;
      align-items: center;
      gap: var(--space-4);
      min-width: 0;
    }

    .dl-icon {
      width: 48px;
      height: 48px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .dl-icon mat-icon {
      width: 24px;
      height: 24px;
      font-size: var(--text-3xl);
    }

    .dl-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .dl-title {
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--color-text);
    }

    .dl-sub {
      font-size: var(--text-sm);
      line-height: 1.45;
      color: var(--color-text-3);
    }

    .dl-btn { flex-shrink: 0; }

    /* KPI row and holistic strip: white cards with a tinted icon tile */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }

    @media (max-width: 1500px) {
      .kpi-row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }

    @media (max-width: 640px) {
      .kpi-row { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    .holistic-strip {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }

    @media (max-width: 1300px) {
      .holistic-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }

    @media (max-width: 900px) {
      .holistic-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 480px) {
      .holistic-strip { grid-template-columns: minmax(0, 1fr); }
    }

    .kpi-card,
    .hs-card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .kpi-card.clickable,
    .hs-card {
      cursor: pointer;
    }

    .kpi-card.clickable:hover,
    .hs-card:hover {
      border-color: var(--color-line-strong);
      box-shadow: var(--shadow-md);
    }

    /* Cards without a colour variant keep the neutral tile. */
    .kpi-icon,
    .hs-icon {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-2);
    }

    .kpi-icon mat-icon,
    .hs-icon mat-icon {
      width: 24px;
      height: 24px;
      font-size: var(--text-3xl);
    }

    .kpi-primary .kpi-icon,
    .hs-registers .hs-icon {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .kpi-info .kpi-icon {
      background: var(--color-info-soft);
      color: var(--color-info);
    }

    .kpi-ok .kpi-icon,
    .hs-holistic .hs-icon {
      background: var(--color-ok-soft);
      color: var(--color-ok);
    }

    .kpi-warn .kpi-icon,
    .hs-warn .hs-icon {
      background: var(--color-warn-soft);
      color: var(--color-warn);
    }

    .kpi-danger .kpi-icon,
    .hs-suspend .hs-icon {
      background: var(--color-danger-soft);
      color: var(--color-danger);
    }

    .kpi-body,
    .hs-body {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .kpi-value,
    .hs-value {
      font-size: var(--text-3xl);
      font-weight: 800;
      line-height: 1.15;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
    }

    .kpi-value small,
    .hs-value small {
      font-size: var(--text-md);
      font-weight: 600;
      color: var(--color-text-3);
    }

    .hs-holistic .hs-value { color: var(--color-ok); }
    .hs-registers .hs-value { color: var(--color-primary); }
    .hs-warn .hs-value { color: var(--color-warn); }
    .hs-suspend .hs-value { color: var(--color-danger); }
    .hs-terminated .hs-value { color: var(--color-text-2); }

    .kpi-label {
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-xs);
      font-weight: 600;
      color: var(--color-text-3);
    }

    .hs-label {
      margin-top: 2px;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text);
    }

    .hs-sub {
      margin-top: 2px;
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .hs-sub.warn {
      font-weight: 600;
      color: var(--color-warn);
    }

    /* Panels */
    .cc-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }

    .cc-grid-3 {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-4);
    }

    @media (max-width: 1100px) {
      .cc-grid,
      .cc-grid-3 { grid-template-columns: minmax(0, 1fr); }
    }

    .cc-panel {
      min-width: 0;
      padding: var(--space-4) var(--space-5) var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .cc-panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      min-height: 40px;
      margin-bottom: var(--space-3);
    }

    .cc-panel-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-width: 0;
    }

    .cc-panel-title mat-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      font-size: var(--text-2xl);
      color: var(--color-primary);
    }

    .cc-panel-title h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--color-text);
    }

    /* HR attention centre */
    .attention-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .attention-item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-left: 4px solid var(--color-line-strong);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background 0.15s ease;
    }

    .attention-item:hover { background: var(--color-canvas); }

    .att-icon {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-2);
    }

    .att-icon mat-icon {
      width: 20px;
      height: 20px;
      font-size: var(--text-2xl);
    }

    .att-body {
      flex: 1;
      min-width: 0;
    }

    .att-title {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text);
    }

    .att-detail {
      margin-top: 2px;
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .att-side {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      flex-shrink: 0;
    }

    .att-go { color: var(--color-text-3); }

    .sev-badge {
      padding: 2px var(--space-2);
      border-radius: 999px;
      background: var(--color-surface-2);
      color: var(--color-text-2);
      font-size: var(--text-xs);
      font-weight: 700;
    }

    .attention-item.sev-overdue,
    .attention-item.sev-critical { border-left-color: var(--color-danger); }
    .attention-item.sev-due_soon { border-left-color: var(--color-warn); }
    .attention-item.sev-info { border-left-color: var(--color-info); }

    .sev-overdue .att-icon,
    .sev-critical .att-icon,
    .sev-badge.sev-overdue,
    .sev-badge.sev-critical {
      background: var(--color-danger-soft);
      color: var(--color-danger);
    }

    .sev-due_soon .att-icon,
    .sev-badge.sev-due_soon {
      background: var(--color-warn-soft);
      color: var(--color-warn);
    }

    .sev-info .att-icon,
    .sev-badge.sev-info {
      background: var(--color-info-soft);
      color: var(--color-info);
    }

    /* Today's attendance */
    .att-mini-stats {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }

    @media (max-width: 480px) {
      .att-mini-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }

    .mini-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-2) var(--space-1);
      border-radius: var(--radius-md);
      background: var(--color-canvas);
    }

    .ms-val {
      font-size: var(--text-xl);
      font-weight: 800;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
    }

    .ms-val.ms-green { color: var(--color-ok); }
    .ms-val.ms-amber { color: var(--color-warn); }
    .ms-val.ms-red { color: var(--color-danger); }

    .ms-lbl {
      margin-top: 2px;
      text-align: center;
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .trend-block { margin-bottom: var(--space-4); }

    .trend-title,
    .late-list-title,
    .leave-sub-title {
      margin-bottom: var(--space-2);
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-3);
    }

    .trend-bars {
      display: flex;
      align-items: flex-end;
      gap: var(--space-2);
      height: 90px;
    }

    .trend-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      height: 100%;
    }

    .trend-bar {
      position: relative;
      display: flex;
      align-items: flex-start;
      width: 70%;
      min-height: 4px;
      overflow: hidden;
      border-radius: var(--radius-sm) var(--radius-sm) 0 0;
      background: var(--color-primary);
    }

    .trend-late {
      width: 100%;
      background: var(--color-warn);
    }

    .trend-lbl {
      margin-top: var(--space-1);
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .late-list {
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-line);
    }

    .late-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) 0;
      font-size: var(--text-sm);
    }

    .late-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
      color: var(--color-text);
    }

    .late-dept {
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .late-time {
      font-weight: 700;
      color: var(--color-warn);
      font-variant-numeric: tabular-nums;
    }

    .late-time small {
      font-weight: 400;
      color: var(--color-text-3);
    }

    /* Headcount by department */
    .dept-bars {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .dept-bar-row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .dbr-name {
      width: 120px;
      flex-shrink: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-sm);
      color: var(--color-text-2);
    }

    .dbr-track {
      flex: 1;
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: var(--color-surface-3);
    }

    .dbr-fill {
      height: 100%;
      border-radius: 999px;
      background: var(--color-primary);
    }

    .dbr-count {
      width: 32px;
      text-align: right;
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--color-text);
      font-variant-numeric: tabular-nums;
    }

    /* Records completeness */
    .completeness {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .comp-ring {
      width: 96px;
      height: 96px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    }

    .comp-inner {
      width: 72px;
      height: 72px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--color-surface);
    }

    .comp-pct {
      font-size: var(--text-2xl);
      font-weight: 800;
      color: var(--color-text);
    }

    .comp-sub {
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .comp-missing {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .comp-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      font-size: var(--text-sm);
      color: var(--color-text-2);
    }

    .comp-row mat-icon {
      width: 16px;
      height: 16px;
      font-size: var(--text-lg);
      color: var(--color-text-3);
    }

    .comp-row span { flex: 1; }
    .comp-row b { color: var(--color-text); }

    .comp-btn {
      width: 100%;
      margin-top: var(--space-4);
    }

    /* Leave summary */
    .leave-mini {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }

    .lm-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-2);
      border-radius: var(--radius-md);
      background: var(--color-canvas);
    }

    .lm-val {
      font-size: var(--text-2xl);
      font-weight: 800;
      color: var(--color-text);
    }

    .lm-lbl {
      margin-top: 2px;
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .leave-person {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-1) 0;
    }

    .lp-avatar {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      font-size: var(--text-xs);
      font-weight: 700;
    }

    .lp-avatar.upcoming {
      background: var(--color-surface-2);
      color: var(--color-text-2);
    }

    .lp-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .lp-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text);
    }

    .lp-meta {
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    /* Incomplete records overlay */
    .records-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-5);
      background: color-mix(in srgb, var(--color-text) 40%, transparent);
    }

    .records-panel {
      box-sizing: border-box;
      width: 640px;
      max-width: 100%;
      max-height: 80vh;
      overflow: auto;
      padding: var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
    }

    .rp-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-4);
    }

    .rp-title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .rp-title mat-icon { color: var(--color-primary); }

    .rp-title h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--color-text);
    }

    .rp-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .rp-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }

    .rp-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .rp-name {
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text);
    }

    .rp-dept {
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .rp-missing {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-1);
    }

    .rp-tag {
      padding: 2px var(--space-2);
      border-radius: 999px;
      background: var(--color-danger-soft);
      color: var(--color-danger);
      font-size: var(--text-xs);
      font-weight: 600;
    }

    /* Leave requests panel */
    .leave-requests-panel {
      max-width: 1400px;
      margin: 0 auto var(--space-5);
      overflow: hidden;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .lrp-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-5);
      border-bottom: 1px solid var(--color-line);
    }

    .lrp-title {
      flex: 1;
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .lrp-title h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--color-text);
    }

    .lrp-title mat-icon {
      width: 20px;
      height: 20px;
      font-size: var(--text-2xl);
      color: var(--color-primary);
    }

    .lrp-filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .lrp-filter {
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-line);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text-2);
      font: inherit;
      font-size: var(--text-xs);
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease;
    }

    .lrp-filter:hover { border-color: var(--color-line-strong); }

    .lrp-filter.active {
      border-color: var(--color-primary-soft);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .lrp-filter.pending.active {
      border-color: var(--color-warn-soft);
      background: var(--color-warn-soft);
      color: var(--color-warn);
    }

    .lrp-filter.approved.active {
      border-color: var(--color-ok-soft);
      background: var(--color-ok-soft);
      color: var(--color-ok);
    }

    .lrp-filter.rejected.active {
      border-color: var(--color-danger-soft);
      background: var(--color-danger-soft);
      color: var(--color-danger);
    }

    .lrp-list {
      max-height: 480px;
      overflow-y: auto;
      padding: var(--space-3) var(--space-4);
    }

    .lrp-item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      margin-bottom: var(--space-2);
      padding: var(--space-3);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      transition: background 0.15s ease;
    }

    .lrp-item:hover { background: var(--color-canvas); }
    .lrp-pending { border-left: 4px solid var(--color-warn); }
    .lrp-approved { border-left: 4px solid var(--color-ok); }
    .lrp-rejected { border-left: 4px solid var(--color-danger); }

    .lrp-avatar {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      font-size: var(--text-md);
      font-weight: 700;
    }

    .lrp-info {
      flex: 1;
      min-width: 0;
    }

    .lrp-name {
      font-size: var(--text-md);
      font-weight: 700;
      color: var(--color-text);
    }

    .lrp-dept {
      margin-left: 6px;
      font-size: var(--text-xs);
      font-weight: 400;
      color: var(--color-text-3);
    }

    .lrp-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin-top: var(--space-1);
      font-size: var(--text-xs);
      color: var(--color-text-2);
    }

    .lrp-type {
      padding: 2px var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--color-primary-soft);
      color: var(--color-primary);
      font-weight: 600;
    }

    .lrp-dates { color: var(--color-text-2); }
    .lrp-days { color: var(--color-text-3); }

    .lrp-reason {
      margin-top: var(--space-1);
      font-size: var(--text-xs);
      font-style: italic;
      color: var(--color-text-3);
    }

    .lrp-review-note {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin-top: var(--space-1);
      font-size: var(--text-xs);
      color: var(--color-text-2);
    }

    .lrp-review-note mat-icon {
      width: 14px;
      height: 14px;
      font-size: var(--text-md);
    }

    .lrp-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
      flex-shrink: 0;
    }

    .lrp-status {
      padding: 2px var(--space-2);
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 700;
    }

    .status-pending { background: var(--color-warn-soft); color: var(--color-warn); }
    .status-approved { background: var(--color-ok-soft); color: var(--color-ok); }
    .status-rejected { background: var(--color-danger-soft); color: var(--color-danger); }

    .lrp-submitted {
      font-size: var(--text-xs);
      color: var(--color-text-3);
    }

    .lrp-actions {
      display: flex;
      gap: var(--space-1);
    }

    .approve-btn { --mdc-icon-button-icon-color: var(--color-ok); }
    .reject-btn { --mdc-icon-button-icon-color: var(--color-danger); }

    /* Location cards */
    .departments-section {
      max-width: 1400px;
      margin: 0 auto;
    }

    .departments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
      gap: var(--space-4);
    }

    .location-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      cursor: pointer;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .location-card:hover {
      border-color: var(--color-line-strong);
      box-shadow: var(--shadow-md);
    }

    .location-card .card-content {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
      padding: var(--space-5);
      text-align: center;
    }

    .icon-container {
      width: 56px;
      height: 56px;
      margin-bottom: var(--space-3);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .icon-container mat-icon {
      width: 32px;
      height: 32px;
      font-size: var(--text-4xl);
    }

    .location-card h3 {
      margin: 0 0 var(--space-1);
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--color-text);
    }

    .location-description {
      flex: 1;
      margin: 0 0 var(--space-4);
      font-size: var(--text-sm);
      line-height: 1.5;
      color: var(--color-text-3);
    }

    .card-footer { align-self: stretch; }
    .access-btn { width: 100%; }

    /* ============ Sub-views: training, main office, sites ============ */
    .factory-section {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header-section { margin-bottom: var(--space-5); }

    .header-section h1 {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin: 0;
      font-size: var(--text-3xl);
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.02em;
      color: var(--color-text);
    }

    .header-section h1 mat-icon {
      width: 24px;
      height: 24px;
      font-size: var(--text-3xl);
      color: var(--color-primary);
    }

    .header-section .subtitle {
      margin: var(--space-1) 0 0;
      font-size: var(--text-sm);
      color: var(--color-text-3);
    }

    /* Main office attendance monitor */
    .title-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }

    .header-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    .refresh-info {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-3);
      border: 1px solid var(--color-line);
      border-radius: 999px;
      background: var(--color-surface);
      color: var(--color-text-2);
      font-size: var(--text-sm);
    }

    .refresh-info mat-icon {
      width: 18px;
      height: 18px;
      font-size: var(--text-xl);
      color: var(--color-text-3);
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--space-4);
    }

    .metric-card {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .metric-card > mat-icon {
      box-sizing: content-box;
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      padding: var(--space-3);
      border-radius: var(--radius-md);
      background: var(--color-surface-2);
      color: var(--color-text-2);
      font-size: var(--text-3xl);
    }

    .metric-card.total > mat-icon { background: var(--color-primary-soft); color: var(--color-primary); }
    .metric-card.present > mat-icon { background: var(--color-ok-soft); color: var(--color-ok); }
    .metric-card.absent > mat-icon { background: var(--color-danger-soft); color: var(--color-danger); }
    .metric-card.late > mat-icon { background: var(--color-warn-soft); color: var(--color-warn); }

    .metric-content h2 {
      margin: 0;
      font-size: var(--text-3xl);
      font-weight: 800;
      line-height: 1.15;
      color: var(--color-text);
    }

    .metric-content p {
      margin: 2px 0 0;
      font-size: var(--text-sm);
      color: var(--color-text-3);
    }

    .department-section,
    .employee-section {
      margin-bottom: var(--space-6);
    }

    .department-section h2,
    .employee-section h2 {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0 0 var(--space-3);
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--color-text);
    }

    .department-section h2 mat-icon,
    .employee-section h2 mat-icon {
      color: var(--color-primary);
    }

    .section-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }

    .section-header h2 { margin: 0; }

    .search-field {
      --mdc-outlined-text-field-container-shape: var(--radius-control);
      min-width: 300px;
      border-radius: var(--radius-control);
      background: var(--color-surface);
    }

    .search-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .department-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: var(--space-4);
    }

    .department-card {
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .department-card h3 {
      margin: 0 0 var(--space-2);
      font-size: var(--text-md);
      font-weight: 700;
      color: var(--color-text);
    }

    .dept-stats {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-4);
    }

    .dept-stats .stat {
      display: flex;
      align-items: center;
      gap: var(--space-1);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .dept-stats .stat.present { color: var(--color-ok); }
    .dept-stats .stat.late { color: var(--color-warn); }

    .dept-stats mat-icon {
      width: 18px;
      height: 18px;
      font-size: var(--text-xl);
    }

    .employee-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: var(--space-3);
    }

    @media (max-width: 1800px) {
      .employee-grid { grid-template-columns: repeat(6, 1fr); }
    }

    @media (max-width: 1400px) {
      .employee-grid { grid-template-columns: repeat(5, 1fr); }
    }

    @media (max-width: 1200px) {
      .employee-grid { grid-template-columns: repeat(4, 1fr); }
    }

    @media (max-width: 900px) {
      .employee-grid { grid-template-columns: repeat(3, 1fr); }
    }

    @media (max-width: 600px) {
      .employee-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .employee-card {
      position: relative;
      min-height: 200px;
      overflow: hidden;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .employee-card:hover {
      border-color: var(--color-line-strong);
      box-shadow: var(--shadow-md);
    }

    .employee-card .card-content {
      display: flex;
      flex-direction: column;
    }

    .employee-photo {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 140px;
      overflow: hidden;
      background: var(--color-surface-2);
    }

    .employee-photo img {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border: 3px solid var(--color-surface);
      border-radius: 50%;
      box-shadow: var(--shadow-sm);
    }

    .photo-placeholder {
      width: 80px;
      height: 80px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid var(--color-surface);
      border-radius: 50%;
      background: var(--color-surface-3);
    }

    .photo-placeholder mat-icon {
      width: 32px;
      height: 32px;
      font-size: var(--text-4xl);
      color: var(--color-text-3);
    }

    .status-indicator {
      position: absolute;
      right: var(--space-3);
      bottom: var(--space-3);
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--color-surface);
      border-radius: 50%;
      background: var(--color-text-3);
      color: var(--color-on-primary);
    }

    .status-indicator.present { background: var(--color-ok); }
    .status-indicator.absent { background: var(--color-danger); }
    .status-indicator.late { background: var(--color-warn); }

    .status-indicator mat-icon {
      width: 18px;
      height: 18px;
      font-size: var(--text-xl);
    }

    .employee-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: var(--space-3);
    }

    .name-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }

    .name-section h3 {
      flex: 1;
      min-width: 0;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-md);
      font-weight: 700;
      color: var(--color-text);
    }

    .name-section .late-badge {
      width: 18px;
      height: 18px;
      font-size: var(--text-xl);
      color: var(--color-warn);
    }

    .employee-role {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--text-sm);
      color: var(--color-text-3);
    }

    .time-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: var(--space-2);
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-line);
    }

    .time-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--color-surface-2);
      color: var(--color-text-2);
      font-size: var(--text-xs);
      font-weight: 600;
    }

    .time-row mat-icon {
      width: 16px;
      height: 16px;
      font-size: var(--text-lg);
    }

    .time-row.ontime { background: var(--color-ok-soft); color: var(--color-ok); }
    .time-row.late { background: var(--color-warn-soft); color: var(--color-warn); }
    .time-row.absent { background: var(--color-danger-soft); color: var(--color-danger); }

    .weekly-attendance {
      margin-top: var(--space-2);
      padding-top: var(--space-3);
      border-top: 1px solid var(--color-line);
    }

    .weekly-title {
      margin-bottom: var(--space-2);
      text-align: center;
      font-size: var(--text-xs);
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--color-text-3);
    }

    .week-circles {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
    }

    .day-circle {
      position: relative;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      background: var(--color-surface-3);
      color: var(--color-text-3);
      font-size: var(--text-xs);
      font-weight: 700;
      cursor: pointer;
    }

    .day-circle.ontime { background: var(--color-ok); color: var(--color-on-primary); }
    .day-circle.late { background: var(--color-warn); color: var(--color-on-primary); }
    .day-circle.absent { background: var(--color-danger); color: var(--color-on-primary); }

    .day-circle:hover::after {
      content: attr(title);
      position: absolute;
      bottom: 120%;
      left: 50%;
      z-index: 10;
      transform: translateX(-50%);
      padding: var(--space-1) var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--color-text);
      color: var(--color-surface);
      box-shadow: var(--shadow-md);
      font-size: var(--text-xs);
      font-weight: 500;
      white-space: nowrap;
      pointer-events: none;
    }

    .empty-state {
      grid-column: 1 / -1;
    }

    /* Site placeholders (factories, branches, logistics) */
    .coming-soon {
      max-width: 600px;
      margin: 0 auto;
      padding: var(--space-8) var(--space-6);
      text-align: center;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .coming-soon > mat-icon {
      box-sizing: content-box;
      width: 32px;
      height: 32px;
      margin-bottom: var(--space-4);
      padding: var(--space-4);
      border-radius: var(--radius-lg);
      background: var(--color-primary-soft);
      color: var(--color-primary);
      font-size: var(--text-4xl);
    }

    .coming-soon h2 {
      margin: 0 0 var(--space-3);
      font-size: var(--text-2xl);
      font-weight: 700;
      color: var(--color-text);
    }

    .coming-soon p {
      margin: 0 0 var(--space-3);
      font-size: var(--text-md);
      line-height: 1.6;
      color: var(--color-text-2);
    }

    .coming-soon .azure-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      margin: var(--space-5) 0;
      padding: var(--space-3) var(--space-5);
      border-radius: var(--radius-control);
      background: var(--color-info-soft);
      color: var(--color-info);
      font-size: var(--text-sm);
      font-weight: 600;
    }

    .coming-soon .azure-note mat-icon {
      width: 20px;
      height: 20px;
      font-size: var(--text-2xl);
    }

    .coming-soon button { margin-top: var(--space-3); }

    /* Training centre */
    .training-categories {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
      gap: var(--space-4);
    }

    .training-category-card {
      padding: var(--space-5);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .category-icon {
      box-sizing: content-box;
      width: 24px;
      height: 24px;
      margin-bottom: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
      font-size: var(--text-3xl);
    }

    .training-category-card h3 {
      margin: 0 0 var(--space-2);
      font-size: var(--text-lg);
      font-weight: 700;
      color: var(--color-text);
    }

    .training-category-card p {
      margin: 0 0 var(--space-4);
      font-size: var(--text-sm);
      line-height: 1.6;
      color: var(--color-text-3);
    }

    .training-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
    }

    .training-actions button {
      flex: 1;
      min-width: 140px;
    }
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
      iconColor: 'var(--color-ok)',
      title: 'New Employee Added',
      message: 'John Doe has been added to the Main Office department',
      time: '5 minutes ago',
      read: false
    },
    {
      id: 2,
      icon: 'assignment_late',
      iconColor: 'var(--color-warn)',
      title: 'Attendance Alert',
      message: '3 employees marked as late today',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      icon: 'local_shipping',
      iconColor: 'var(--color-primary)',
      title: 'Logistics Update',
      message: 'New shipment scheduled for delivery',
      time: '2 hours ago',
      read: false
    },
    {
      id: 4,
      icon: 'factory',
      iconColor: 'var(--color-cat-purple)',
      title: 'Production Report',
      message: 'Condom Factory monthly report is ready',
      time: '3 hours ago',
      read: false
    },
    {
      id: 5,
      icon: 'school',
      iconColor: 'var(--color-cat-teal)',
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
    const colour = pct >= 90 ? 'var(--color-ok)' : pct >= 70 ? 'var(--color-warn)' : 'var(--color-danger)';
    return `conic-gradient(${colour} ${deg}deg, var(--color-surface-3) ${deg}deg)`;
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
      color: var(--color-primary);
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
      color: var(--color-primary);
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

// Shared look for the site password dialogs below
const SITE_PASSWORD_DIALOG_STYLES = `
  :host { display: block; }

  .dialog-container {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-6);
    color: var(--color-text);
    min-width: 360px;
  }

  .dialog-header {
    text-align: center;
    margin-bottom: var(--space-5);
  }

  .lock-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto var(--space-4);
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-primary-soft);
    color: var(--color-primary);
    border-radius: 50%;
  }

  .lock-icon mat-icon {
    font-size: var(--text-4xl);
    width: 32px;
    height: 32px;
  }

  .dialog-header h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-3xl);
    font-weight: 600;
    color: var(--color-text);
  }

  .info-text {
    margin: 0;
    font-size: var(--text-md);
    color: var(--color-text-2);
  }

  .dialog-body,
  .dialog-content { margin-bottom: var(--space-5); }

  .input-group {
    position: relative;
    margin-bottom: var(--space-4);
  }

  .input-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-3);
    font-size: var(--text-2xl);
    width: 20px;
    height: 20px;
  }

  .password-input {
    width: 100%;
    padding: 14px 14px 14px 46px;
    background: var(--color-surface);
    border: 1px solid var(--color-line-strong);
    border-radius: var(--radius-control);
    color: var(--color-text);
    font-size: var(--text-lg);
    transition: border-color 0.2s, box-shadow 0.2s;
    box-sizing: border-box;
  }

  .password-input:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px var(--color-primary-soft);
  }

  .password-input.error { border-color: var(--color-danger); }
  .password-input::placeholder { color: var(--color-text-3); }

  .error-message {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    background: var(--color-danger-soft);
    border-radius: var(--radius-md);
    color: var(--color-danger);
    font-size: var(--text-md);
    margin-bottom: var(--space-4);
    animation: shake 0.4s ease-in-out;
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    75% { transform: translateX(8px); }
  }

  .error-message mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }

  .contact-hint,
  .contact-text {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    margin: 0;
    font-size: var(--text-sm);
    color: var(--color-text-3);
  }

  .contact-hint mat-icon,
  .contact-text mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-3);
  }
`;

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
        <button mat-stroked-button class="btn-cancel" (click)="onCancel()">
          Cancel
        </button>
        <button mat-flat-button color="primary" class="btn-access" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [SITE_PASSWORD_DIALOG_STYLES]
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
    <div class="dialog-container">
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
        <button mat-stroked-button class="btn-cancel" (click)="onCancel()">Cancel</button>
        <button mat-flat-button color="primary" class="btn-access" (click)="validatePassword()"><mat-icon>lock_open</mat-icon>Access</button>
      </div>
    </div>
  `,
  styles: [SITE_PASSWORD_DIALOG_STYLES]
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
        <button mat-stroked-button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button mat-flat-button color="primary" class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [SITE_PASSWORD_DIALOG_STYLES]
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
        <button mat-stroked-button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button mat-flat-button color="primary" class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [SITE_PASSWORD_DIALOG_STYLES]
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
        <button mat-stroked-button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button mat-flat-button color="primary" class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [SITE_PASSWORD_DIALOG_STYLES]
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
        <button mat-stroked-button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button mat-flat-button color="primary" class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [SITE_PASSWORD_DIALOG_STYLES]
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
        <button mat-stroked-button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button mat-flat-button color="primary" class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [SITE_PASSWORD_DIALOG_STYLES]
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
        <button mat-stroked-button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button mat-flat-button color="primary" class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [SITE_PASSWORD_DIALOG_STYLES]
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
        <button mat-stroked-button class="cancel-btn" (click)="onCancel()">
          Cancel
        </button>
        <button mat-flat-button color="primary" class="access-btn" (click)="validatePassword()">
          <mat-icon>lock_open</mat-icon>
          Access
        </button>
      </div>
    </div>
  `,
  styles: [SITE_PASSWORD_DIALOG_STYLES]
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


