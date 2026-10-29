import {
  Component, OnInit, OnDestroy, inject, signal, ElementRef, ViewChild, computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import Chart from 'chart.js/auto';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import {
  ManagementService, ManagementOverview, ApprovalsResponse, MonthPoint, NamedCount
} from '../../services/management.service';

@Component({
  selector: 'app-management',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTabsModule, MatTooltipModule,
    NavbarComponent, PageHeaderComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="mgmt-container">
     <div class="mgmt-inner">
      <app-page-header class="mgmt-page-header" [crumbs]="['Oversight', 'Management']" title="Management"
                       [subtitle]="'Whole-business view across every department' + (overview() ? ' · Updated ' + (overview()!.generatedAt | date:'HH:mm') : '')">
        <button mat-stroked-button (click)="reload()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>Refresh
        </button>
      </app-page-header>

      @if (loading()) {
        <div class="loading-panel">
          <mat-spinner diameter="48"></mat-spinner>
          <span>Gathering the numbers from every module…</span>
        </div>
      } @else if (error()) {
        <div class="error-panel">
          <mat-icon>error_outline</mat-icon>
          <span>{{ error() }}</span>
          <button mat-flat-button color="primary" (click)="reload()">Try again</button>
        </div>
      } @else if (overview()) {

        <mat-tab-group class="mgmt-tabs" animationDuration="200ms" [(selectedIndex)]="selectedTab" (selectedIndexChange)="onTabChange()">

        <!-- ============ OVERVIEW ============ -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>dashboard</mat-icon><span>Overview</span>
            @if (dangerCount()) { <span class="tab-badge danger">{{ dangerCount() }}</span> }
          </ng-template>
        <section id="sec-overview" class="tab-content">
          <div class="kpi-grid ui-stagger">
            <div class="kpi-card k-sales">
              <div class="kpi-top"><mat-icon>point_of_sale</mat-icon><span class="kpi-label">Net sales YTD</span></div>
              <div class="kpi-value">{{ money(o.sales.ytdNetSales) }}</div>
              <div class="kpi-sub">{{ money(o.sales.monthNetSales) }} this month
                <span class="delta" [class.up]="momDelta() > 0" [class.down]="momDelta() < 0">{{ momDelta() > 0 ? '▲' : momDelta() < 0 ? '▼' : '' }} {{ abs(momDelta()) | number:'1.0-0' }}% vs last month</span>
              </div>
            </div>
            <div class="kpi-card k-margin">
              <div class="kpi-top"><mat-icon>trending_up</mat-icon><span class="kpi-label">Gross margin YTD</span></div>
              <div class="kpi-value">{{ o.sales.ytdMarginPercent | number:'1.1-1' }}%</div>
              <div class="kpi-sub">{{ money(o.sales.ytdGrossProfit) }} gross profit · {{ money(o.sales.ytdReturns) }} returns</div>
            </div>
            <div class="kpi-card k-people">
              <div class="kpi-top"><mat-icon>groups</mat-icon><span class="kpi-label">Headcount</span></div>
              <div class="kpi-value">{{ o.hr.headcount | number }}</div>
              <div class="kpi-sub">{{ o.hr.presentToday }} clocked in today · {{ o.hr.onLeaveToday }} on leave</div>
            </div>
            <div class="kpi-card k-tenders" [class.attention]="o.tenders.closingThisWeek > 0">
              <div class="kpi-top"><mat-icon>gavel</mat-icon><span class="kpi-label">Active tenders</span></div>
              <div class="kpi-value">{{ o.tenders.active }}</div>
              <div class="kpi-sub">{{ o.tenders.closingThisWeek }} closing this week · {{ money(o.tenders.pipelineValue) }} pipeline</div>
            </div>
            <div class="kpi-card k-logi">
              <div class="kpi-top"><mat-icon>local_shipping</mat-icon><span class="kpi-label">Deliveries this month</span></div>
              <div class="kpi-value">{{ o.logistics.deliveredThisMonth + o.logistics.shipmentsDeliveredThisMonth }}</div>
              <div class="kpi-sub">{{ o.logistics.assigned }} loads assigned · {{ o.logistics.shipmentsActive }} shipments live</div>
            </div>
            <div class="kpi-card k-fleet" [class.attention]="o.fleet.maintenanceOverdue > 0">
              <div class="kpi-top"><mat-icon>directions_car</mat-icon><span class="kpi-label">Fleet operational</span></div>
              <div class="kpi-value">{{ o.fleet.operational }}<span class="kpi-of">/ {{ o.fleet.vehicles - o.fleet.retired }}</span></div>
              <div class="kpi-sub">{{ o.fleet.inMaintenance }} in workshop · {{ money(o.fleet.fuelSpendMonth) }} fuel this month</div>
            </div>
            <div class="kpi-card k-stock" [class.attention]="o.stock.outOfStock > 0">
              <div class="kpi-top"><mat-icon>inventory_2</mat-icon><span class="kpi-label">Stock on hand</span></div>
              <div class="kpi-value">{{ o.stock.totalQuantityOnHand | number }}</div>
              <div class="kpi-sub">{{ o.stock.totalSkus | number }} SKUs · {{ o.stock.outOfStock }} out of stock</div>
            </div>
            <div class="kpi-card k-fin">
              <div class="kpi-top"><mat-icon>payments</mat-icon><span class="kpi-label">Awaiting payment</span></div>
              <div class="kpi-value">{{ money(o.finance.payments.pendingAmount + o.finance.requisitions.requestedAmount) }}</div>
              <div class="kpi-sub">{{ o.finance.payments.pending }} payments · {{ o.finance.requisitions.requested }} requisitions</div>
            </div>
            <div class="kpi-card k-appr" [class.attention]="o.paperless.myPendingApprovals > 0">
              <div class="kpi-top"><mat-icon>fact_check</mat-icon><span class="kpi-label">My approvals</span></div>
              <div class="kpi-value">{{ o.paperless.myPendingApprovals }}</div>
              <div class="kpi-sub">{{ o.paperless.orgPendingApprovals }} across the business</div>
            </div>
            <div class="kpi-card k-support" [class.attention]="o.support.highPriorityOpen > 0">
              <div class="kpi-top"><mat-icon>support_agent</mat-icon><span class="kpi-label">Support tickets</span></div>
              <div class="kpi-value">{{ o.support.open + o.support.inProgress }}</div>
              <div class="kpi-sub">{{ o.support.highPriorityOpen }} high priority · {{ o.support.resolvedThisMonth }} resolved this month</div>
            </div>
          </div>

          <div class="two-col">
            <mat-card class="module-card">
              <div class="mc-head">
                <div class="mc-title"><mat-icon>notifications_active</mat-icon> Needs attention <span class="count-pill">{{ o.alerts.length }}</span></div>
              </div>
              @if (!o.alerts.length) {
                <div class="empty"><mat-icon>check_circle</mat-icon> Nothing needs your attention right now.</div>
              } @else {
                <div class="alert-list">
                  @for (a of o.alerts; track $index) {
                    <a class="alert-row" [class]="'alert-row ' + a.severity" [routerLink]="a.route">
                      <mat-icon>{{ a.severity === 'danger' ? 'error' : a.severity === 'warn' ? 'warning' : 'info' }}</mat-icon>
                      <span class="alert-module">{{ a.module }}</span>
                      <span class="alert-text">{{ a.text }}</span>
                      <mat-icon class="chev">chevron_right</mat-icon>
                    </a>
                  }
                </div>
              }
            </mat-card>

            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title"><mat-icon>show_chart</mat-icon> Net sales &amp; gross profit — last 12 months</div></div>
              <div class="chart-box tall"><canvas #salesMonthly></canvas></div>
            </mat-card>
          </div>
        </section>
        </mat-tab>

        <!-- ============ DEPARTMENTS ============ -->
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>account_tree</mat-icon><span>Departments</span></ng-template>
        <section id="sec-departments" class="tab-content">
          <h2 class="sec-title"><mat-icon>account_tree</mat-icon> Departments</h2>
          <p class="sec-sub">Every intranet department with its people, project work, leave and spend. HR headcount comes from the HR employee register; users are active intranet logins.</p>
          <div class="two-col">
            <mat-card class="module-card table-card">
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Department</th><th>Manager</th>
                      <th class="num">Users</th><th class="num">HR headcount</th>
                      <th class="num">Boards</th><th class="num">Open tasks</th><th class="num">Overdue</th>
                      <th class="num">Leave pending</th><th class="num">On leave</th><th class="num">Expenses YTD</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (d of o.departments; track d.departmentId) {
                      <tr>
                        <td class="strong">{{ d.name }}</td>
                        <td class="muted">{{ d.manager || '—' }}</td>
                        <td class="num">{{ d.users }}</td>
                        <td class="num">{{ d.hrHeadcount || '—' }}</td>
                        <td class="num">{{ d.boards || '—' }}</td>
                        <td class="num">{{ d.openCards || '—' }}</td>
                        <td class="num" [class.bad]="d.overdueCards > 0">{{ d.overdueCards || '—' }}</td>
                        <td class="num" [class.warnc]="d.leavePending > 0">{{ d.leavePending || '—' }}</td>
                        <td class="num">{{ d.onLeaveToday || '—' }}</td>
                        <td class="num">{{ d.expensesYtd ? money(d.expensesYtd) : '—' }}</td>
                      </tr>
                    }
                    @if (!o.departments.length) {
                      <tr><td colspan="10" class="empty-cell">No departments configured.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title"><mat-icon>groups</mat-icon> Workforce by site</div></div>
              <div class="chart-box tall"><canvas #hrBySite></canvas></div>
            </mat-card>
          </div>
        </section>
        </mat-tab>

        <!-- ============ SALES ============ -->
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>point_of_sale</mat-icon><span>Sales</span></ng-template>
        <section id="sec-sales" class="tab-content">
          <h2 class="sec-title"><mat-icon>point_of_sale</mat-icon> Sales <a mat-button routerLink="/sales">Open <mat-icon>arrow_forward</mat-icon></a></h2>
          <div class="three-col">
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Year to date</div></div>
              <div class="stat-rows">
                <div class="stat-row"><span>Net sales</span><strong>{{ money(o.sales.ytdNetSales) }}</strong></div>
                <div class="stat-row good"><span>Gross profit</span><strong>{{ money(o.sales.ytdGrossProfit) }}</strong></div>
                <div class="stat-row"><span>Margin</span><strong>{{ o.sales.ytdMarginPercent | number:'1.1-1' }}%</strong></div>
                <div class="stat-row warn"><span>Returns / credits</span><strong>{{ money(o.sales.ytdReturns) }}</strong></div>
                <div class="stat-row"><span>Invoice lines</span><strong>{{ o.sales.transactionCount | number }}</strong></div>
                <div class="stat-row"><span>Active customers</span><strong>{{ o.sales.customerCount | number }}</strong></div>
                <div class="stat-row"><span>This month</span><strong>{{ money(o.sales.monthNetSales) }}</strong></div>
                <div class="stat-row"><span>Last month</span><strong>{{ money(o.sales.prevMonthNetSales) }}</strong></div>
              </div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Net sales by company (YTD)</div></div>
              <div class="chart-box"><canvas #salesByCompany></canvas></div>
              <div class="mini-list">
                @for (c of o.sales.byCompany; track c.name) {
                  <div class="mini-row"><span class="chip">{{ c.name }}</span><span class="muted">{{ c.count | number }} lines</span><strong>{{ money(c.amount) }}</strong></div>
                }
              </div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Top customers (YTD)</div></div>
              <div class="rank-list">
                @for (c of o.sales.topCustomers; track c.name; let i = $index) {
                  <div class="rank-row">
                    <span class="rank">{{ i + 1 }}</span>
                    <div class="rank-main">
                      <div class="rank-name" [matTooltip]="c.name">{{ c.name }}</div>
                      <div class="bar"><div class="bar-fill" [style.width.%]="pct(c.amount, maxAmount(o.sales.topCustomers))"></div></div>
                    </div>
                    <strong>{{ money(c.amount) }}</strong>
                  </div>
                }
                @if (!o.sales.topCustomers.length) { <div class="empty">No sales imported this year.</div> }
              </div>
            </mat-card>
          </div>
        </section>
        </mat-tab>

        <!-- ============ OPERATIONS ============ -->
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>local_shipping</mat-icon><span>Operations</span></ng-template>
        <section id="sec-operations" class="tab-content">
          <h2 class="sec-title"><mat-icon>local_shipping</mat-icon> Operations — Logistics, Fleet &amp; Stock <a mat-button routerLink="/logistics">Open <mat-icon>arrow_forward</mat-icon></a></h2>
          <div class="three-col">
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Loads &amp; shipments</div></div>
              <div class="stat-rows">
                <div class="stat-row"><span>Loads assigned</span><strong>{{ o.logistics.assigned }}</strong></div>
                <div class="stat-row warn"><span>Loads in transit</span><strong>{{ o.logistics.inTransit }}</strong></div>
                <div class="stat-row good"><span>Loads delivered this month</span><strong>{{ o.logistics.deliveredThisMonth }}</strong></div>
                <div class="stat-row"><span>PODs captured this month</span><strong>{{ o.logistics.podsThisMonth }}</strong></div>
                <div class="stat-row" [class.warn]="o.logistics.bookingsAwaitingReview > 0"><span>Client bookings awaiting acceptance</span><strong>{{ o.logistics.bookingsAwaitingReview }}</strong></div>
                <div class="stat-row"><span>Tracked shipments live</span><strong>{{ o.logistics.shipmentsActive }}</strong></div>
                <div class="stat-row" [class.warn]="o.logistics.shipmentsFailed > 0"><span>Failed collections / deliveries</span><strong>{{ o.logistics.shipmentsFailed }}</strong></div>
                <div class="stat-row"><span>Pending project delivery requests</span><strong>{{ o.logistics.pendingDeliveryRequests }}</strong></div>
              </div>
              <div class="mc-head sub"><div class="mc-title">Backorders <span class="muted small" *ngIf="o.logistics.backorderAsOf">as of {{ o.logistics.backorderAsOf | date:'d MMM' }}</span></div></div>
              <div class="mini-list">
                @for (b of o.logistics.backordersByCompany; track b.name) {
                  <div class="mini-row"><span class="chip">{{ b.name }}</span><span class="muted">{{ b.count | number }} lines</span><strong>{{ money(b.amount) }}</strong></div>
                }
                <div class="mini-row total"><span>Total</span><span class="muted">{{ o.logistics.backorderLines | number }} lines</span><strong>{{ money(o.logistics.backorderValue) }}</strong></div>
              </div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Deliveries per month</div></div>
              <div class="chart-box"><canvas #deliveriesMonthly></canvas></div>
              <div class="mc-head sub"><div class="mc-title">Fleet status</div></div>
              <div class="chart-box"><canvas #fleetStatus></canvas></div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Fleet &amp; drivers</div></div>
              <div class="stat-rows">
                <div class="stat-row"><span>Vehicles (excl. retired)</span><strong>{{ o.fleet.vehicles - o.fleet.retired }}</strong></div>
                <div class="stat-row"><span>Operational</span><strong>{{ o.fleet.operational }}</strong></div>
                <div class="stat-row warn"><span>In workshop</span><strong>{{ o.fleet.inMaintenance }}</strong></div>
                <div class="stat-row"><span>Maintenance scheduled</span><strong>{{ o.fleet.maintenanceScheduled }}</strong></div>
                <div class="stat-row" [class.warn]="o.fleet.maintenanceOverdue > 0"><span>Maintenance overdue</span><strong>{{ o.fleet.maintenanceOverdue }}</strong></div>
                <div class="stat-row"><span>Maintenance cost YTD</span><strong>{{ money(o.fleet.maintenanceCostYtd) }}</strong></div>
                <div class="stat-row"><span>Fuel spend YTD</span><strong>{{ money(o.fleet.fuelSpendYtd) }}</strong></div>
                <div class="stat-row"><span>Fuel this month</span><strong>{{ money(o.fleet.fuelSpendMonth) }} · {{ o.fleet.fuelLitresMonth | number:'1.0-0' }} L</strong></div>
                <div class="stat-row"><span>Active drivers</span><strong>{{ o.fleet.driversActive }}</strong></div>
                <div class="stat-row" [class.warn]="o.fleet.licencesExpiring60d + o.fleet.licencesExpired > 0"><span>Licences expiring ≤60d / expired</span><strong>{{ o.fleet.licencesExpiring60d }} / {{ o.fleet.licencesExpired }}</strong></div>
                <div class="stat-row" [class.warn]="o.fleet.highIncidents30d > 0"><span>Driving incidents (30d) · high</span><strong>{{ o.fleet.incidents30d | number }} · {{ o.fleet.highIncidents30d | number }}</strong></div>
              </div>
              @if (o.fleet.overdueMaintenance.length) {
                <div class="mc-head sub"><div class="mc-title">Overdue maintenance</div></div>
                <div class="mini-list">
                  @for (m of o.fleet.overdueMaintenance; track m.id) {
                    <div class="mini-row"><span class="chip warnchip">{{ m.registration }}</span><span class="muted ellipsis">{{ m.maintenanceType }}</span><strong class="bad">{{ m.daysOverdue }}d</strong></div>
                  }
                </div>
              }
            </mat-card>
          </div>
          <div class="two-col">
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title"><mat-icon>local_gas_station</mat-icon> Fuel spend &amp; litres — last 12 months</div></div>
              <div class="chart-box tall"><canvas #fuelMonthly></canvas></div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title"><mat-icon>inventory_2</mat-icon> Stock by warehouse</div><a mat-button routerLink="/stock-management">Open <mat-icon>arrow_forward</mat-icon></a></div>
              <div class="chart-box"><canvas #stockByWarehouse></canvas></div>
              <div class="mini-list">
                @for (w of o.stock.byWarehouse; track w.warehouse) {
                  <div class="mini-row"><span class="chip">{{ w.warehouse }}</span><span class="muted">{{ w.skuCount }} SKUs · <span [class.bad]="w.outOfStock>0">{{ w.outOfStock }} out</span> · <span [class.warnc]="w.lowStock>0">{{ w.lowStock }} low</span></span><strong>{{ w.totalQuantity | number }}</strong></div>
                }
                @if (!o.stock.byWarehouse.length) { <div class="empty">No warehouse inventory loaded.</div> }
              </div>
            </mat-card>
          </div>
        </section>
        </mat-tab>

        <!-- ============ PEOPLE ============ -->
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>groups</mat-icon><span>People</span></ng-template>
        <section id="sec-people" class="tab-content">
          <h2 class="sec-title"><mat-icon>groups</mat-icon> People &amp; HR <a mat-button routerLink="/hr">Open <mat-icon>arrow_forward</mat-icon></a></h2>
          <div class="three-col">
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Workforce</div></div>
              <div class="stat-rows">
                <div class="stat-row"><span>Active employees</span><strong>{{ o.hr.headcount | number }}</strong></div>
                <div class="stat-row"><span>Inactive / exited</span><strong>{{ o.hr.inactive }}</strong></div>
                <div class="stat-row good"><span>New hires (90 days)</span><strong>{{ o.hr.newHires90d }}</strong></div>
                <div class="stat-row" [class.warn]="o.hr.contractsExpiring90d > 0"><span>Contracts ending ≤90 days</span><strong>{{ o.hr.contractsExpiring90d }}</strong></div>
                <div class="stat-row" [class.warn]="o.hr.leavePending > 0"><span>Leave requests pending</span><strong>{{ o.hr.leavePending }}</strong></div>
                <div class="stat-row"><span>Approved leave upcoming</span><strong>{{ o.hr.leaveApprovedUpcoming }}</strong></div>
                <div class="stat-row"><span>On leave today</span><strong>{{ o.hr.onLeaveToday }}</strong></div>
                <div class="stat-row" [class.warn]="o.hr.disciplinaryOpen > 0"><span>Open disciplinary cases</span><strong>{{ o.hr.disciplinaryOpen }}</strong></div>
              </div>
              <div class="mc-head sub"><div class="mc-title">Employment type</div></div>
              <div class="mini-list">
                @for (t of o.hr.byEmploymentType; track t.name) {
                  <div class="mini-row"><span class="chip">{{ t.name }}</span><strong>{{ t.count }}</strong></div>
                }
              </div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Biometric clock-ins — last 14 working days</div></div>
              <div class="chart-box"><canvas #attendanceTrend></canvas></div>
              <div class="stat-rows">
                <div class="stat-row"><span>Registered on clocking machine</span><strong>{{ o.hr.biometricRegistered }}</strong></div>
                <div class="stat-row" [class.warn]="o.hr.presentToday === 0"><span>Clocked in today</span><strong>{{ o.hr.presentToday }} ({{ o.hr.attendanceRatePercent | number:'1.0-0' }}%)</strong></div>
                <div class="stat-row"><span>Last clock-in date</span><strong>{{ o.hr.lastClockDate ? (o.hr.lastClockDate | date:'EEE d MMM') : '—' }}</strong></div>
              </div>
              <p class="footnote">Only head-office staff clock biometrically; site staff are captured in manual HR registers.</p>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Headcount by department</div></div>
              <div class="chart-box tall"><canvas #hrByDept></canvas></div>
              @if (o.hr.expiringContracts.length) {
                <div class="mc-head sub"><div class="mc-title">Contracts ending soon</div></div>
                <div class="mini-list">
                  @for (c of o.hr.expiringContracts; track c.id) {
                    <div class="mini-row"><span class="ellipsis strong">{{ c.name }}</span><span class="muted ellipsis">{{ c.site }}</span><strong [class.bad]="c.daysLeft <= 30">{{ c.daysLeft }}d</strong></div>
                  }
                </div>
              }
            </mat-card>
          </div>
        </section>
        </mat-tab>

        <!-- ============ TENDERS ============ -->
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>gavel</mat-icon><span>Tenders</span></ng-template>
        <section id="sec-tenders" class="tab-content">
          <h2 class="sec-title"><mat-icon>gavel</mat-icon> Tenders &amp; Compliance <a mat-button routerLink="/tenders">Open <mat-icon>arrow_forward</mat-icon></a></h2>
          <div class="three-col">
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Pipeline</div></div>
              <div class="stat-rows">
                <div class="stat-row"><span>Active</span><strong>{{ o.tenders.active }}</strong></div>
                <div class="stat-row warn"><span>Closing this week</span><strong>{{ o.tenders.closingThisWeek }}</strong></div>
                <div class="stat-row" [class.warn]="o.tenders.overdue > 0"><span>Past closing, not submitted</span><strong>{{ o.tenders.overdue }}</strong></div>
                <div class="stat-row"><span>Pipeline value (open)</span><strong>{{ money(o.tenders.pipelineValue) }}</strong></div>
                <div class="stat-row"><span>Value submitted</span><strong>{{ money(o.tenders.valueSubmitted) }}</strong></div>
                <div class="stat-row good"><span>Value awarded</span><strong>{{ money(o.tenders.valueAwarded) }}</strong></div>
                <div class="stat-row"><span>Awarded / lost (YTD)</span><strong>{{ o.tenders.awardedYtd }} / {{ o.tenders.lostYtd }}</strong></div>
                <div class="stat-row"><span>Win rate (YTD)</span><strong>{{ o.tenders.winRatePercent | number:'1.0-0' }}%</strong></div>
              </div>
              <div class="chart-box"><canvas #tenderPipeline></canvas></div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Closing soon</div></div>
              <div class="mini-list">
                @for (t of o.tenders.upcomingClosings; track t.id) {
                  <div class="tender-row">
                    <div class="tender-days" [class.bad]="t.daysLeft <= 2" [class.warnc]="t.daysLeft > 2 && t.daysLeft <= 7">
                      <strong>{{ t.daysLeft }}</strong><span>days</span>
                    </div>
                    <div class="tender-main">
                      <div class="strong ellipsis" [matTooltip]="t.title">{{ t.tenderNumber }} — {{ t.title }}</div>
                      <div class="muted small">{{ t.issuingDepartment }} · <span class="chip">{{ t.companyCode }}</span> · closes {{ t.closingDate | date:'EEE d MMM HH:mm' }}</div>
                    </div>
                  </div>
                }
                @if (!o.tenders.upcomingClosings.length) { <div class="empty">No open tenders with a future closing date.</div> }
              </div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Compliance documents</div></div>
              <div class="stat-rows">
                <div class="stat-row" [class.warn]="o.tenders.complianceExpired > 0"><span>Expired</span><strong>{{ o.tenders.complianceExpired }}</strong></div>
                <div class="stat-row" [class.warn]="o.tenders.complianceExpiring45d > 0"><span>Expiring within 45 days</span><strong>{{ o.tenders.complianceExpiring45d }}</strong></div>
              </div>
              <div class="mini-list">
                @for (c of o.tenders.complianceAtRisk; track c.id) {
                  <div class="mini-row"><span class="chip">{{ c.companyCode }}</span><span class="ellipsis">{{ c.documentType }}</span><strong [class.bad]="c.daysLeft < 0" [class.warnc]="c.daysLeft >= 0">{{ c.daysLeft < 0 ? 'expired ' + abs(c.daysLeft) + 'd ago' : c.daysLeft + 'd' }}</strong></div>
                }
                @if (!o.tenders.complianceAtRisk.length) { <div class="empty"><mat-icon>verified</mat-icon> All compliance documents current.</div> }
              </div>
              <div class="mc-head sub"><div class="mc-title">Open tenders by company</div></div>
              <div class="mini-list">
                @for (c of o.tenders.byCompany; track c.name) { <div class="mini-row"><span class="chip">{{ c.name }}</span><strong>{{ c.count }}</strong></div> }
              </div>
            </mat-card>
          </div>
        </section>
        </mat-tab>

        <!-- ============ FINANCE ============ -->
        <mat-tab>
          <ng-template mat-tab-label><mat-icon>account_balance</mat-icon><span>Finance</span></ng-template>
        <section id="sec-finance" class="tab-content">
          <h2 class="sec-title"><mat-icon>account_balance</mat-icon> Finance <a mat-button routerLink="/finance">Open <mat-icon>arrow_forward</mat-icon></a></h2>
          <div class="three-col">
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Cash out</div></div>
              <div class="stat-rows">
                <div class="stat-row warn"><span>Requisitions requested</span><strong>{{ o.finance.requisitions.requested }} · {{ money(o.finance.requisitions.requestedAmount) }}</strong></div>
                <div class="stat-row good"><span>Requisitions paid</span><strong>{{ o.finance.requisitions.paid }} · {{ money(o.finance.requisitions.paidAmount) }}</strong></div>
                <div class="stat-row"><span>Requisitions rejected</span><strong>{{ o.finance.requisitions.rejected }}</strong></div>
                <div class="stat-row warn"><span>Payments pending</span><strong>{{ o.finance.payments.pending }} · {{ money(o.finance.payments.pendingAmount) }}</strong></div>
                <div class="stat-row good"><span>Payments completed</span><strong>{{ o.finance.payments.completed }} · {{ money(o.finance.payments.completedAmount) }}</strong></div>
                <div class="stat-row"><span>Expenses YTD</span><strong>{{ o.finance.expenses.count }} · {{ money(o.finance.expenses.ytdTotal) }}</strong></div>
                <div class="stat-row"><span>Expenses this month</span><strong>{{ money(o.finance.expenses.monthTotal) }}</strong></div>
                <div class="stat-row" [class.warn]="o.finance.expenses.pendingApproval > 0"><span>Expenses awaiting approval</span><strong>{{ o.finance.expenses.pendingApproval }} · {{ money(o.finance.expenses.pendingApprovalAmount) }}</strong></div>
                <div class="stat-row"><span>Book invoices on file</span><strong>{{ o.finance.bookInvoices | number }}</strong></div>
              </div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Expenses per month</div></div>
              <div class="chart-box tall"><canvas #expensesMonthly></canvas></div>
            </mat-card>
            <mat-card class="module-card">
              <div class="mc-head"><div class="mc-title">Expenses by department (YTD)</div></div>
              <div class="rank-list">
                @for (e of o.finance.expensesByDepartment; track e.name) {
                  <div class="rank-row">
                    <div class="rank-main">
                      <div class="rank-name">{{ e.name }} <span class="muted small">· {{ e.count }}</span></div>
                      <div class="bar"><div class="bar-fill fin" [style.width.%]="pct(e.amount, maxAmount(o.finance.expensesByDepartment))"></div></div>
                    </div>
                    <strong>{{ money(e.amount) }}</strong>
                  </div>
                }
                @if (!o.finance.expensesByDepartment.length) { <div class="empty">No expenses captured this year.</div> }
              </div>
              <div class="mc-head sub"><div class="mc-title">Projects &amp; support</div></div>
              <div class="stat-rows">
                <div class="stat-row"><span>Active project boards</span><strong>{{ o.projects.activeBoards }} / {{ o.projects.boards }}</strong></div>
                <div class="stat-row"><span>Open tasks</span><strong>{{ o.projects.openCards }}</strong></div>
                <div class="stat-row" [class.warn]="o.projects.overdueCards > 0"><span>Overdue tasks</span><strong>{{ o.projects.overdueCards }}</strong></div>
                <div class="stat-row"><span>Support open / in progress</span><strong>{{ o.support.open }} / {{ o.support.inProgress }}</strong></div>
                <div class="stat-row"><span>Avg. resolution (90d)</span><strong>{{ o.support.avgResolutionHours != null ? (o.support.avgResolutionHours | number:'1.0-0') + ' h' : '—' }}</strong></div>
              </div>
            </mat-card>
          </div>
        </section>
        </mat-tab>

        <!-- ============ APPROVALS ============ -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>fact_check</mat-icon><span>Approvals</span>
            @if (o.paperless.myPendingApprovals) { <span class="tab-badge">{{ o.paperless.myPendingApprovals }}</span> }
          </ng-template>
        <section id="sec-approvals" class="tab-content">
          <h2 class="sec-title"><mat-icon>fact_check</mat-icon> Paperless approvals <a mat-button routerLink="/documents/paperless">Open Paperless <mat-icon>arrow_forward</mat-icon></a></h2>
          <mat-card class="approvals-card">
            <mat-tab-group>
              <mat-tab label="Awaiting me ({{ approvals()?.pending?.length || 0 }})">
                @if (!approvals()?.pending?.length) {
                  <div class="empty"><mat-icon>check_circle</mat-icon> You're all caught up.</div>
                } @else {
                  <div class="appr-list">
                    @for (a of approvals()!.pending; track a.id) {
                      <div class="appr-row">
                        <mat-icon class="doc-icon">description</mat-icon>
                        <div class="appr-main">
                          <div class="appr-name">{{ a.name }}</div>
                          <div class="appr-meta">
                            <span class="role-chip">{{ a.myRole || 'reviewer' }}</span>
                            from {{ a.createdBy || 'Unknown' }} · {{ a.updatedAt | date:'mediumDate' }}
                          </div>
                        </div>
                        <span class="state-badge pending">Pending</span>
                      </div>
                    }
                  </div>
                }
              </mat-tab>
              <mat-tab label="Actioned ({{ approvals()?.actioned?.length || 0 }})">
                @if (!approvals()?.actioned?.length) {
                  <div class="empty"><mat-icon>history</mat-icon> Nothing here yet.</div>
                } @else {
                  <div class="appr-list">
                    @for (a of approvals()!.actioned; track a.id) {
                      <div class="appr-row">
                        <mat-icon class="doc-icon">description</mat-icon>
                        <div class="appr-main">
                          <div class="appr-name">{{ a.name }}</div>
                          <div class="appr-meta">
                            <span class="role-chip">{{ a.myRole || 'reviewer' }}</span>
                            from {{ a.createdBy || 'Unknown' }} · {{ a.updatedAt | date:'mediumDate' }}
                          </div>
                        </div>
                        <span class="state-badge" [class.approved]="a.myState === 'approved' || a.myState === 'signed'"
                              [class.declined]="a.myState === 'declined'">{{ a.myState | titlecase }}</span>
                      </div>
                    }
                  </div>
                }
              </mat-tab>
            </mat-tab-group>
          </mat-card>
        </section>
        </mat-tab>

        </mat-tab-group>

        <p class="generated">Snapshot generated {{ o.generatedAt | date:'medium' }} · Sales from imported Sage invoices (net = sales − returns) · Attendance from the biometric clocking machine · Backorders from the latest Sage import</p>
      }
     </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .mgmt-container {
      min-height: 100vh;
      padding: var(--space-5) var(--space-6) var(--space-8);
      max-width: 100%;
      box-sizing: border-box;
      background: var(--color-canvas);
    }
    .mgmt-inner { max-width: 1600px; margin: 0 auto; }
    .mgmt-page-header { margin-bottom: var(--space-4); }
    @media (max-width: 600px) { .mgmt-container { padding: var(--space-4) var(--space-4) var(--space-6); } }

    .loading-panel, .error-panel {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      padding: 80px 20px; color: var(--color-text-3);
    }
    .error-panel mat-icon { font-size: 40px; width: 40px; height: 40px; color: var(--color-danger); }

    /* tabs (same pattern as Settings / Logistics) */
    .mgmt-tabs { margin-bottom: 20px; }
    .mgmt-tabs ::ng-deep .mat-mdc-tab-header {
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm); margin-bottom: 20px;
    }
    .mgmt-tabs ::ng-deep .mat-mdc-tab .mdc-tab__text-label { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; }
    .mgmt-tabs ::ng-deep .mat-mdc-tab .mdc-tab__text-label mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .tab-content { padding-top: 4px; }
    .tab-badge {
      background: var(--color-warn); color: #fff; font-size: 11px; font-weight: 800; border-radius: 12px; padding: 1px 7px; margin-left: 2px; line-height: 16px;
    }
    .tab-badge.danger { background: var(--color-danger); }

    section { scroll-margin-top: 130px; margin-bottom: 34px; }
    .sec-title {
      display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 800; color: var(--color-text);
      margin: 0 0 6px; padding-bottom: 8px; border-bottom: 1px solid var(--color-line);
    }
    .sec-title mat-icon { color: var(--color-primary); }
    .sec-title a { margin-left: auto; }
    .sec-sub { color: var(--color-text-3); font-size: 13px; margin: 0 0 14px; }

    /* KPIs */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px; }
    .kpi-card {
      background: var(--color-surface); border-radius: var(--radius-lg); padding: 16px 18px;
      box-shadow: var(--shadow-sm); border: 1px solid var(--color-line); border-left: 4px solid var(--color-text-3);
    }
    .kpi-card.k-sales, .kpi-card.k-appr  { border-left-color: var(--color-primary); }
    .kpi-card.k-margin, .kpi-card.k-fin   { border-left-color: var(--color-ok); }
    .kpi-card.k-tenders, .kpi-card.k-logi, .kpi-card.k-fleet { border-left-color: var(--color-warn); }
    .kpi-card.k-stock, .kpi-card.k-people, .kpi-card.k-support { border-left-color: var(--color-info); }
    .kpi-card.attention { background: var(--color-primary-soft); }
    .kpi-top { display: flex; align-items: center; gap: 8px; color: var(--color-text-3); }
    .kpi-top mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .kpi-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .3px; }
    .kpi-value { font-size: 26px; font-weight: 800; color: var(--color-text); margin: 6px 0 2px; }
    .kpi-of { font-size: 14px; font-weight: 600; color: var(--color-text-3); margin-left: 4px; }
    .kpi-sub { font-size: 12.5px; color: var(--color-text-3); }
    .delta { display: inline-block; margin-left: 6px; font-weight: 700; }
    .delta.up { color: var(--color-ok); } .delta.down { color: var(--color-danger); }

    /* grids */
    .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .three-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-bottom: 16px; }
    .module-card { border-radius: 16px; padding: 8px 4px; }
    .table-card { grid-column: span 2; }
    @media (max-width: 1100px) { .table-card { grid-column: span 1; } }
    .mc-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid var(--color-surface-2); margin-bottom: 8px;
    }
    .mc-head.sub { margin-top: 10px; border-top: 1px dashed var(--color-line); border-bottom: none; }
    .mc-title { display: flex; align-items: center; gap: 8px; font-weight: 700; color: var(--color-text); }
    .mc-title mat-icon { color: var(--color-primary); }
    .count-pill { background: var(--color-surface-2); color: var(--color-text-2); font-size: 12px; padding: 1px 8px; border-radius: 12px; }

    .chart-box { position: relative; height: 220px; padding: 4px 12px 8px; }
    .chart-box.tall { height: 300px; }

    .stat-rows { padding: 4px 12px 8px; }
    .stat-row {
      display: flex; justify-content: space-between; align-items: center; gap: 8px;
      padding: 7px 0; border-bottom: 1px dashed var(--color-surface-2); font-size: 13.5px; color: var(--color-text-2);
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-row strong { color: var(--color-text); text-align: right; }
    .stat-row.warn strong { color: var(--color-warn); }
    .stat-row.good strong { color: var(--color-ok); }
    .mini-list { padding: 4px 12px 10px; }
    .mini-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 5px 0; font-size: 13px; }
    .mini-row.total { border-top: 1px solid var(--color-line); margin-top: 4px; padding-top: 8px; font-weight: 700; }
    .mini-row .muted { flex: 1; text-align: right; }
    .chip {
      background: var(--color-info-soft); color: var(--color-info); font-size: var(--text-xs); font-weight: 700;
      padding: 2px 8px; border-radius: 20px; white-space: nowrap;
    }
    .chip.warnchip { background: var(--color-warn-soft); color: var(--color-warn); }
    .muted { color: var(--color-text-3); }
    .small { font-size: 12px; }
    .strong { font-weight: 600; color: var(--color-text); }
    .bad { color: var(--color-danger) !important; }
    .warnc { color: var(--color-warn) !important; }
    .ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
    .footnote { padding: 0 12px 8px; font-size: 12px; color: var(--color-text-3); margin: 0; }

    /* alerts */
    .alert-list { padding: 4px 8px 8px; display: flex; flex-direction: column; gap: 6px; max-height: 300px; overflow: auto; }
    .alert-row {
      display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 10px; text-decoration: none;
      background: var(--color-surface-2); color: var(--color-text); font-size: 13.5px; border-left: 3px solid var(--color-info);
    }
    .alert-row mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--color-info); }
    .alert-row.warn { border-left-color: var(--color-warn); } .alert-row.warn mat-icon { color: var(--color-warn); }
    .alert-row.danger { border-left-color: var(--color-danger); background: var(--color-danger-soft); } .alert-row.danger mat-icon { color: var(--color-danger); }
    .alert-module { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px; color: var(--color-text-3); min-width: 72px; }
    .alert-text { flex: 1; }
    .alert-row .chev { color: var(--color-text-3); }
    .alert-row:hover { filter: brightness(.97); }

    /* table */
    .table-wrap { overflow: auto; padding: 0 8px 8px; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .3px; color: var(--color-text-3); padding: 10px 8px; border-bottom: 1px solid var(--color-line); white-space: nowrap; }
    .data-table td { padding: 9px 8px; border-bottom: 1px dashed var(--color-surface-2); color: var(--color-text-2); }
    .data-table tr:hover td { background: var(--color-canvas); }
    .data-table .num { text-align: right; font-variant-numeric: tabular-nums; }
    .empty-cell { text-align: center; color: var(--color-text-3); padding: 24px !important; }

    /* ranks */
    .rank-list { padding: 4px 12px 10px; }
    .rank-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 13px; }
    .rank { width: 20px; text-align: center; font-weight: 800; color: var(--color-text-3); }
    .rank-main { flex: 1; min-width: 0; }
    .rank-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text); font-weight: 600; }
    .bar { height: 6px; background: var(--color-surface-2); border-radius: 4px; margin-top: 4px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--color-primary); border-radius: 4px; }
    .bar-fill.fin { background: var(--color-ok); }

    .tender-row { display: flex; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px dashed var(--color-surface-2); }
    .tender-row:last-child { border-bottom: none; }
    .tender-days { display: flex; flex-direction: column; align-items: center; min-width: 48px; padding: 6px 4px; border-radius: 10px; background: var(--color-surface-2); color: var(--color-text-2); }
    .tender-days strong { font-size: 18px; line-height: 1; }
    .tender-days span { font-size: 10px; text-transform: uppercase; }
    .tender-days.warnc { background: var(--color-warn-soft); } .tender-days.bad { background: var(--color-danger-soft); }
    .tender-main { min-width: 0; flex: 1; }

    /* approvals */
    .approvals-card { border-radius: 16px; padding: 8px 4px; }
    .appr-list { padding: 8px 4px; }
    .appr-row { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; transition: background .15s; }
    .appr-row:hover { background: var(--color-canvas); }
    .doc-icon { color: var(--color-primary); }
    .appr-main { flex: 1; min-width: 0; }
    .appr-name { font-weight: 600; color: var(--color-text); }
    .appr-meta { font-size: 12.5px; color: var(--color-text-3); display: flex; align-items: center; gap: 6px; }
    .role-chip { background: var(--color-surface-2); color: var(--color-text-2); font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 20px; text-transform: capitalize; }
    .state-badge { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px; background: var(--color-surface-2); color: var(--color-text-3); }
    .state-badge.pending { background: var(--color-warn-soft); color: var(--color-warn); }
    .state-badge.approved { background: var(--color-ok-soft); color: var(--color-ok); }
    .state-badge.declined { background: var(--color-danger-soft); color: var(--color-danger); }
    .empty { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 28px; color: var(--color-text-3); font-size: 13.5px; }
    .generated { text-align: center; color: var(--color-text-3); font-size: var(--text-xs); margin-top: 16px; }
  `]
})
export class ManagementComponent implements OnInit, OnDestroy {
  private mgmt = inject(ManagementService);

  loading = signal(true);
  error = signal<string | null>(null);
  overview = signal<ManagementOverview | null>(null);
  approvals = signal<ApprovalsResponse | null>(null);
  selectedTab = 0;

  dangerCount = computed(() => this.overview()?.alerts.filter(a => a.severity === 'danger').length ?? 0);
  momDelta = computed(() => {
    const s = this.overview()?.sales;
    if (!s || !s.prevMonthNetSales) return 0;
    return ((s.monthNetSales - s.prevMonthNetSales) / Math.abs(s.prevMonthNetSales)) * 100;
  });

  @ViewChild('salesMonthly') salesMonthlyRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('salesByCompany') salesByCompanyRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('hrBySite') hrBySiteRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('hrByDept') hrByDeptRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('attendanceTrend') attendanceTrendRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('deliveriesMonthly') deliveriesMonthlyRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('fleetStatus') fleetStatusRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('fuelMonthly') fuelMonthlyRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('stockByWarehouse') stockByWarehouseRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('tenderPipeline') tenderPipelineRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('expensesMonthly') expensesMonthlyRef?: ElementRef<HTMLCanvasElement>;

  private charts: Chart[] = [];

  ngOnInit(): void { this.reload(); }
  ngOnDestroy(): void { this.destroyCharts(); }

  /** Non-null accessor for the template (only used inside the @if(overview()) branch). */
  get o(): ManagementOverview { return this.overview()!; }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.destroyCharts();
    forkJoin({
      overview: this.mgmt.getOverview(),
      approvals: this.mgmt.getApprovals()
    }).subscribe({
      next: ({ overview, approvals }) => {
        this.overview.set(overview);
        this.approvals.set(approvals);
        this.loading.set(false);
        // Canvases exist only after the @else-if branch renders.
        setTimeout(() => { this.buildCharts(); });
      },
      error: (err) => {
        console.error('Management overview failed', err);
        this.error.set('Could not load the management overview. Please try again.');
        this.loading.set(false);
      }
    });
  }

  /** Chart.js draws nothing inside a hidden tab pane; resize once the new pane is laid out. */
  onTabChange(): void {
    setTimeout(() => this.charts.forEach(c => { try { c.resize(); c.update('none'); } catch { /* chart destroyed */ } }), 250);
  }

  money(v: number | null | undefined): string {
    const n = v ?? 0;
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(n);
  }
  abs(v: number): number { return Math.abs(v); }
  pct(v: number, max: number | undefined): number { return !max ? 0 : Math.max(2, Math.round((v / max) * 100)); }
  maxAmount(rows: { amount: number }[]): number | undefined { return rows.length ? rows[0].amount : undefined; }

  // ---------------------------------------------------------------- charts
  private cssVar(name: string, fallback: string): string {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  private palette(): string[] {
    return [
      this.cssVar('--color-primary', '#1976d2'), this.cssVar('--color-ok', '#2e7d32'),
      this.cssVar('--color-warn', '#ed6c02'), this.cssVar('--color-info', '#0288d1'),
      this.cssVar('--color-danger', '#d32f2f'), '#7b1fa2', '#00897b', '#5d4037', '#455a64', '#c2185b', '#9e9d24', '#6d4c41'
    ];
  }
  private alpha(hex: string, a: number): string {
    const m = hex.replace('#', '');
    if (m.length !== 6) return hex;
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  private destroyCharts(): void { this.charts.forEach(c => c.destroy()); this.charts = []; }

  private compactR = (v: number) => new Intl.NumberFormat('en-ZA', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

  private buildCharts(): void {
    const o = this.overview();
    if (!o) return;
    const [primary, ok, warn, info, danger] = this.palette();
    const text3 = this.cssVar('--color-text-3', '#6b7280');
    const grid = this.alpha(this.cssVar('--color-line', '#e5e7eb').startsWith('#') ? this.cssVar('--color-line', '#e5e7eb') : '#e5e7eb', 0.6);
    const base = { color: text3, font: { size: 11 } };
    const money = (v: any) => 'R' + this.compactR(Number(v));

    const add = (ref: ElementRef<HTMLCanvasElement> | undefined, cfg: any) => {
      if (!ref?.nativeElement) return;
      cfg.options = { responsive: true, maintainAspectRatio: false, ...cfg.options };
      this.charts.push(new Chart(ref.nativeElement, cfg));
    };
    const months = (pts: MonthPoint[]) => pts.map(p => p.label);

    // Sales: net sales bars + gross profit line
    add(this.salesMonthlyRef, {
      type: 'bar',
      data: {
        labels: months(o.sales.monthly),
        datasets: [
          { label: 'Net sales', data: o.sales.monthly.map(p => p.value), backgroundColor: this.alpha(primary, .75), borderRadius: 6, order: 2 },
          { label: 'Gross profit', data: o.sales.monthly.map(p => p.secondary ?? 0), type: 'line', borderColor: ok, backgroundColor: ok, tension: .3, pointRadius: 3, order: 1 }
        ]
      },
      options: {
        plugins: { legend: { labels: base }, tooltip: { callbacks: { label: (c: any) => `${c.dataset.label}: ${this.money(c.raw)}` } } },
        scales: { x: { ticks: base, grid: { display: false } }, y: { ticks: { ...base, callback: money }, grid: { color: grid } } }
      }
    });

    // Sales by company doughnut
    add(this.salesByCompanyRef, {
      type: 'doughnut',
      data: { labels: o.sales.byCompany.map(c => c.name), datasets: [{ data: o.sales.byCompany.map(c => c.amount), backgroundColor: this.palette(), borderWidth: 0 }] },
      options: { cutout: '62%', plugins: { legend: { position: 'right', labels: base }, tooltip: { callbacks: { label: (c: any) => `${c.label}: ${this.money(c.raw)}` } } } }
    });

    // HR by site (horizontal bars)
    const siteBar = (ref: ElementRef<HTMLCanvasElement> | undefined, rows: NamedCount[], color: string) => add(ref, {
      type: 'bar',
      data: { labels: rows.map(r => r.name), datasets: [{ label: 'Employees', data: rows.map(r => r.count), backgroundColor: this.alpha(color, .8), borderRadius: 6 }] },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: { x: { ticks: base, grid: { color: grid }, beginAtZero: true }, y: { ticks: base, grid: { display: false } } }
      }
    });
    siteBar(this.hrBySiteRef, o.hr.bySite, info);
    siteBar(this.hrByDeptRef, o.hr.byDepartment, primary);

    // Attendance trend
    add(this.attendanceTrendRef, {
      type: 'line',
      data: {
        labels: o.hr.attendanceTrend.map(p => p.label),
        datasets: [{ label: 'Clocked in', data: o.hr.attendanceTrend.map(p => p.present), borderColor: info, backgroundColor: this.alpha(info, .15), fill: true, tension: .3, pointRadius: 3 }]
      },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: base, grid: { display: false } }, y: { ticks: base, grid: { color: grid }, beginAtZero: true, suggestedMax: o.hr.biometricRegistered || undefined } } }
    });

    // Deliveries per month
    add(this.deliveriesMonthlyRef, {
      type: 'bar',
      data: { labels: months(o.logistics.monthlyDeliveries), datasets: [{ label: 'Loads delivered', data: o.logistics.monthlyDeliveries.map(p => p.value), backgroundColor: this.alpha(warn, .8), borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: base, grid: { display: false } }, y: { ticks: base, grid: { color: grid }, beginAtZero: true } } }
    });

    // Fleet status doughnut
    add(this.fleetStatusRef, {
      type: 'doughnut',
      data: { labels: o.fleet.byStatus.map(s => s.name), datasets: [{ data: o.fleet.byStatus.map(s => s.count), backgroundColor: [ok, warn, text3, danger, '#7b1fa2', '#455a64', info], borderWidth: 0 }] },
      options: { cutout: '62%', plugins: { legend: { position: 'right', labels: base } } }
    });

    // Fuel: spend bars + litres line (dual axis)
    add(this.fuelMonthlyRef, {
      type: 'bar',
      data: {
        labels: months(o.fleet.monthlyFuel),
        datasets: [
          { label: 'Spend (R)', data: o.fleet.monthlyFuel.map(p => p.value), backgroundColor: this.alpha(warn, .75), borderRadius: 6, yAxisID: 'y', order: 2 },
          { label: 'Litres', data: o.fleet.monthlyFuel.map(p => p.secondary ?? 0), type: 'line', borderColor: info, backgroundColor: info, tension: .3, pointRadius: 3, yAxisID: 'y1', order: 1 }
        ]
      },
      options: {
        plugins: { legend: { labels: base }, tooltip: { callbacks: { label: (c: any) => c.dataset.yAxisID === 'y' ? `Spend: ${this.money(c.raw)}` : `Litres: ${Number(c.raw).toLocaleString('en-ZA', { maximumFractionDigits: 0 })} L` } } },
        scales: {
          x: { ticks: base, grid: { display: false } },
          y: { position: 'left', ticks: { ...base, callback: money }, grid: { color: grid } },
          y1: { position: 'right', ticks: { ...base, callback: (v: any) => this.compactR(Number(v)) + ' L' }, grid: { drawOnChartArea: false } }
        }
      }
    });

    // Stock by warehouse (stacked in/low/out)
    add(this.stockByWarehouseRef, {
      type: 'bar',
      data: {
        labels: o.stock.byWarehouse.map(w => w.warehouse),
        datasets: [
          { label: 'In stock', data: o.stock.byWarehouse.map(w => w.skuCount - w.lowStock - w.outOfStock), backgroundColor: this.alpha(ok, .8), borderRadius: 4 },
          { label: 'Low', data: o.stock.byWarehouse.map(w => w.lowStock), backgroundColor: this.alpha(warn, .85), borderRadius: 4 },
          { label: 'Out', data: o.stock.byWarehouse.map(w => w.outOfStock), backgroundColor: this.alpha(danger, .85), borderRadius: 4 }
        ]
      },
      options: { plugins: { legend: { labels: base } }, scales: { x: { stacked: true, ticks: base, grid: { display: false } }, y: { stacked: true, ticks: base, grid: { color: grid }, beginAtZero: true, title: { display: true, text: 'SKUs', ...base } } } }
    });

    // Tender pipeline by status
    add(this.tenderPipelineRef, {
      type: 'bar',
      data: { labels: o.tenders.byStatus.map(s => s.name), datasets: [{ label: 'Tenders', data: o.tenders.byStatus.map(s => s.count), backgroundColor: this.palette().map(c => this.alpha(c, .8)), borderRadius: 6 }] },
      options: { plugins: { legend: { display: false } }, scales: { x: { ticks: base, grid: { display: false } }, y: { ticks: { ...base, precision: 0 }, grid: { color: grid }, beginAtZero: true } } }
    });

    // Expenses per month
    add(this.expensesMonthlyRef, {
      type: 'bar',
      data: { labels: months(o.finance.monthlyExpenses), datasets: [{ label: 'Expenses', data: o.finance.monthlyExpenses.map(p => p.value), backgroundColor: this.alpha(ok, .8), borderRadius: 6 }] },
      options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => this.money(c.raw) } } }, scales: { x: { ticks: base, grid: { display: false } }, y: { ticks: { ...base, callback: money }, grid: { color: grid }, beginAtZero: true } } }
    });
  }
}
