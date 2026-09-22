import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { forkJoin } from 'rxjs';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import {
  ManagementService, ManagementOverview, ApprovalsResponse, ApprovalItem
} from '../../services/management.service';

@Component({
  selector: 'app-management',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatTabsModule, MatChipsModule, MatTooltipModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="mgmt-container">
     <div class="mgmt-inner">
      <!-- Header -->
      <div class="mgmt-header">
        <div class="title-area">
          <div class="icon-wrapper"><mat-icon>insights</mat-icon></div>
          <div>
            <h1>Management Command Centre</h1>
            <p>Executive overview across Sales, Tenders, Logistics, Finance &amp; Paperless</p>
          </div>
        </div>
        <button mat-stroked-button (click)="reload()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      @if (loading()) {
        <div class="loading-panel">
          <mat-spinner diameter="48"></mat-spinner>
          <span>Gathering the numbers…</span>
        </div>
      } @else if (error()) {
        <div class="error-panel">
          <mat-icon>error_outline</mat-icon>
          <span>{{ error() }}</span>
          <button mat-flat-button color="primary" (click)="reload()">Try again</button>
        </div>
      } @else if (overview()) {

        <!-- Top KPI strip -->
        <div class="kpi-grid ui-stagger">
          <div class="kpi-card k-sales">
            <div class="kpi-top"><mat-icon>point_of_sale</mat-icon><span class="kpi-label">Sales YTD</span></div>
            <div class="kpi-value">{{ money(o.sales.ytdNetSales) }}</div>
            <div class="kpi-sub">{{ money(o.sales.monthNetSales) }} this month</div>
          </div>
          <div class="kpi-card k-tenders">
            <div class="kpi-top"><mat-icon>gavel</mat-icon><span class="kpi-label">Active Tenders</span></div>
            <div class="kpi-value">{{ o.tenders.active }}</div>
            <div class="kpi-sub">{{ o.tenders.closingThisWeek }} closing this week</div>
          </div>
          <div class="kpi-card k-logi">
            <div class="kpi-top"><mat-icon>local_shipping</mat-icon><span class="kpi-label">Loads In Transit</span></div>
            <div class="kpi-value">{{ o.logistics.inTransit }}</div>
            <div class="kpi-sub">{{ o.logistics.assigned }} assigned · {{ o.logistics.available }} available</div>
          </div>
          <div class="kpi-card k-fin">
            <div class="kpi-top"><mat-icon>payments</mat-icon><span class="kpi-label">Payments Pending</span></div>
            <div class="kpi-value">{{ money(o.finance.payments.pendingAmount) }}</div>
            <div class="kpi-sub">{{ o.finance.payments.pending }} awaiting release</div>
          </div>
          <div class="kpi-card k-appr" [class.attention]="o.paperless.myPendingApprovals > 0">
            <div class="kpi-top"><mat-icon>fact_check</mat-icon><span class="kpi-label">My Approvals</span></div>
            <div class="kpi-value">{{ o.paperless.myPendingApprovals }}</div>
            <div class="kpi-sub">{{ o.paperless.orgPendingApprovals }} across the business</div>
          </div>
        </div>

        <div class="section-grid">
          <!-- Sales -->
          <mat-card class="module-card">
            <div class="mc-head">
              <div class="mc-title"><mat-icon>point_of_sale</mat-icon> Sales</div>
              <a mat-button routerLink="/sales">Open <mat-icon>arrow_forward</mat-icon></a>
            </div>
            <div class="stat-rows">
              <div class="stat-row"><span>Net sales (YTD)</span><strong>{{ money(o.sales.ytdNetSales) }}</strong></div>
              <div class="stat-row"><span>Net sales (this month)</span><strong>{{ money(o.sales.monthNetSales) }}</strong></div>
              <div class="stat-row"><span>Transactions (YTD)</span><strong>{{ o.sales.transactionCount | number }}</strong></div>
            </div>
            @if (o.sales.byCompany.length) {
              <div class="mini-list">
                @for (c of o.sales.byCompany; track c.code) {
                  <div class="mini-row"><span class="chip">{{ c.code }}</span><strong>{{ money(c.netSales) }}</strong></div>
                }
              </div>
            }
          </mat-card>

          <!-- Tenders -->
          <mat-card class="module-card">
            <div class="mc-head">
              <div class="mc-title"><mat-icon>gavel</mat-icon> Tenders</div>
              <a mat-button routerLink="/tenders">Open <mat-icon>arrow_forward</mat-icon></a>
            </div>
            <div class="stat-rows">
              <div class="stat-row"><span>Active</span><strong>{{ o.tenders.active }}</strong></div>
              <div class="stat-row warn"><span>Closing this week</span><strong>{{ o.tenders.closingThisWeek }}</strong></div>
              <div class="stat-row"><span>Awarded (YTD)</span><strong>{{ o.tenders.awardedYtd }}</strong></div>
              <div class="stat-row"><span>Value submitted</span><strong>{{ money(o.tenders.valueSubmitted) }}</strong></div>
              <div class="stat-row good"><span>Value awarded</span><strong>{{ money(o.tenders.valueAwarded) }}</strong></div>
            </div>
          </mat-card>

          <!-- Logistics -->
          <mat-card class="module-card">
            <div class="mc-head">
              <div class="mc-title"><mat-icon>local_shipping</mat-icon> Logistics</div>
              <a mat-button routerLink="/logistics">Open <mat-icon>arrow_forward</mat-icon></a>
            </div>
            <div class="stat-rows">
              <div class="stat-row"><span>Total loads</span><strong>{{ o.logistics.total }}</strong></div>
              <div class="stat-row"><span>Available</span><strong>{{ o.logistics.available }}</strong></div>
              <div class="stat-row"><span>Assigned</span><strong>{{ o.logistics.assigned }}</strong></div>
              <div class="stat-row warn"><span>In transit</span><strong>{{ o.logistics.inTransit }}</strong></div>
              <div class="stat-row good"><span>Delivered</span><strong>{{ o.logistics.delivered }}</strong></div>
              <div class="stat-row"><span>Pending delivery requests</span><strong>{{ o.logistics.pendingDeliveryRequests }}</strong></div>
            </div>
          </mat-card>

          <!-- Finance -->
          <mat-card class="module-card">
            <div class="mc-head">
              <div class="mc-title"><mat-icon>account_balance</mat-icon> Finance</div>
              <a mat-button routerLink="/finance">Open <mat-icon>arrow_forward</mat-icon></a>
            </div>
            <div class="stat-rows">
              <div class="stat-row warn"><span>Requisitions requested</span><strong>{{ o.finance.requisitions.requested }} · {{ money(o.finance.requisitions.requestedAmount) }}</strong></div>
              <div class="stat-row good"><span>Requisitions paid</span><strong>{{ o.finance.requisitions.paid }} · {{ money(o.finance.requisitions.paidAmount) }}</strong></div>
              <div class="stat-row warn"><span>Payments pending</span><strong>{{ o.finance.payments.pending }} · {{ money(o.finance.payments.pendingAmount) }}</strong></div>
              <div class="stat-row good"><span>Payments completed</span><strong>{{ o.finance.payments.completed }} · {{ money(o.finance.payments.completedAmount) }}</strong></div>
              <div class="stat-row"><span>Book invoices</span><strong>{{ o.finance.bookInvoices }}</strong></div>
            </div>
          </mat-card>
        </div>

        <!-- Approvals -->
        <mat-card class="approvals-card">
          <div class="mc-head">
            <div class="mc-title"><mat-icon>fact_check</mat-icon> Paperless Approvals</div>
            <a mat-button routerLink="/documents/paperless">Open Paperless <mat-icon>arrow_forward</mat-icon></a>
          </div>

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

        <p class="generated">Snapshot generated {{ o.generatedAt | date:'medium' }}</p>
      }
     </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .mgmt-container {
      min-height: 100vh;
      padding: 88px 32px 48px;
      max-width: 100%;
      box-sizing: border-box;
      background: #0f172a;
      background-image:
        radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.35) 0%, transparent 45%),
        radial-gradient(circle at 85% 15%, rgba(14, 165, 233, 0.32) 0%, transparent 45%),
        radial-gradient(circle at 75% 85%, rgba(236, 72, 153, 0.26) 0%, transparent 45%),
        radial-gradient(circle at 25% 90%, rgba(16, 185, 129, 0.24) 0%, transparent 45%),
        linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%);
      background-attachment: fixed;
    }
    .mgmt-inner { max-width: 1500px; margin: 0 auto; }
    .mgmt-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 16px; margin-bottom: 24px; flex-wrap: wrap;
    }
    .title-area { display: flex; align-items: center; gap: 16px; }
    .icon-wrapper {
      width: 56px; height: 56px; border-radius: 16px;
      background: linear-gradient(135deg, #2563eb, #1e40af);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 14px rgba(37,99,235,0.4);
    }
    .icon-wrapper mat-icon { color: #fff; font-size: 30px; width: 30px; height: 30px; }
    .mgmt-header h1 { margin: 0; font-size: 24px; font-weight: 700; color: #f8fafc; }
    .mgmt-header p { margin: 2px 0 0; color: #cbd5e1; font-size: 14px; }
    .mgmt-header button[mat-stroked-button] {
      color: #f8fafc; border-color: rgba(255,255,255,.35);
    }

    .loading-panel, .error-panel {
      display: flex; flex-direction: column; align-items: center; gap: 16px;
      padding: 80px 20px; color: #64748b;
    }
    .error-panel mat-icon { font-size: 40px; width: 40px; height: 40px; color: #ef4444; }

    .kpi-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 16px; margin-bottom: 24px;
    }
    .kpi-card {
      background: #fff; border-radius: 16px; padding: 18px 20px;
      box-shadow: 0 2px 10px rgba(15,23,42,.06); border: 1px solid #eef2f7;
      border-left: 4px solid #94a3b8;
    }
    .kpi-card.k-sales  { border-left-color: #2196F3; }
    .kpi-card.k-tenders{ border-left-color: #f59e0b; }
    .kpi-card.k-logi   { border-left-color: #FF9800; }
    .kpi-card.k-fin    { border-left-color: #4CAF50; }
    .kpi-card.k-appr   { border-left-color: #2563eb; }
    .kpi-card.attention { background: #f5f3ff; box-shadow: 0 4px 16px rgba(37,99,235,.18); }
    .kpi-top { display: flex; align-items: center; gap: 8px; color: #64748b; }
    .kpi-top mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .kpi-label { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .3px; }
    .kpi-value { font-size: 28px; font-weight: 800; color: #0f172a; margin: 8px 0 2px; }
    .kpi-sub { font-size: 12.5px; color: #94a3b8; }

    .section-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 18px; margin-bottom: 24px;
    }
    .module-card { border-radius: 16px; padding: 8px 4px; }
    .mc-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid #f1f5f9; margin-bottom: 8px;
    }
    .mc-title { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #0f172a; }
    .mc-title mat-icon { color: #2563eb; }
    .stat-rows { padding: 4px 12px 12px; }
    .stat-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; border-bottom: 1px dashed #f1f5f9; font-size: 14px; color: #475569;
    }
    .stat-row:last-child { border-bottom: none; }
    .stat-row strong { color: #0f172a; }
    .stat-row.warn strong { color: #d97706; }
    .stat-row.good strong { color: #059669; }
    .mini-list { padding: 4px 12px 12px; }
    .mini-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; }
    .chip {
      background: #e0f2fe; color: #0369a1; font-size: 12px; font-weight: 700;
      padding: 2px 8px; border-radius: 20px;
    }

    .approvals-card { border-radius: 16px; padding: 8px 4px; }
    .appr-list { padding: 8px 4px; }
    .appr-row {
      display: flex; align-items: center; gap: 12px; padding: 12px;
      border-radius: 12px; transition: background .15s;
    }
    .appr-row:hover { background: #f8fafc; }
    .doc-icon { color: #2563eb; }
    .appr-main { flex: 1; min-width: 0; }
    .appr-name { font-weight: 600; color: #0f172a; }
    .appr-meta { font-size: 12.5px; color: #94a3b8; display: flex; align-items: center; gap: 6px; }
    .role-chip {
      background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700;
      padding: 1px 7px; border-radius: 20px; text-transform: capitalize;
    }
    .state-badge {
      font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 20px;
      background: #f1f5f9; color: #64748b;
    }
    .state-badge.pending { background: #fef3c7; color: #b45309; }
    .state-badge.approved { background: #dcfce7; color: #15803d; }
    .state-badge.declined { background: #fee2e2; color: #b91c1c; }
    .empty {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 40px; color: #94a3b8;
    }
    .generated { text-align: center; color: #cbd5e1; font-size: 12px; margin-top: 16px; }
  `]
})
export class ManagementComponent implements OnInit {
  private mgmt = inject(ManagementService);

  loading = signal(true);
  error = signal<string | null>(null);
  overview = signal<ManagementOverview | null>(null);
  approvals = signal<ApprovalsResponse | null>(null);

  ngOnInit(): void { this.reload(); }

  /** Non-null accessor for the template (only used inside the @if(overview()) branch). */
  get o(): ManagementOverview { return this.overview()!; }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      overview: this.mgmt.getOverview(),
      approvals: this.mgmt.getApprovals()
    }).subscribe({
      next: ({ overview, approvals }) => {
        this.overview.set(overview);
        this.approvals.set(approvals);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Management overview failed', err);
        this.error.set('Could not load the management overview. Please try again.');
        this.loading.set(false);
      }
    });
  }

  money(v: number | null | undefined): string {
    const n = v ?? 0;
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency', currency: 'ZAR', maximumFractionDigits: 0
    }).format(n);
  }
}
