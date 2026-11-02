import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { environment } from '../../../../environments/environment';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { KpiItem, KpiStripComponent } from '../../../ui/kpi-strip/kpi-strip.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { DataTableComponent, TableColumn, formatMoney } from '../../../ui/data-table/data-table.component';

interface CreditorsSummary {
  totalPayable: number;
  unpaidInvoices: { count: number; amount: number };
  commitments: { count: number; monthlyAmount: number };
  requisitions: { count: number; amount: number };
  pendingExpenses: { count: number; amount: number };
}

interface Requisition {
  id: number; rfNumber?: string; date?: string; paidTo?: string;
  amountEwallet: number; dieselAmount: number; total: number;
  reason?: string; paymentMethod?: string; status: string;
}

interface BreakdownGroup { company?: string; department?: string; departmentId?: number; count: number; amount: number; }
interface BreakdownResp { total: number; groups: BreakdownGroup[]; }

@Component({
  selector: 'app-creditors',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, NavbarComponent, PageHeaderComponent, KpiStripComponent, EmptyStateComponent, SkeletonRowsComponent, DataTableComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="cr-container">
      <app-page-header [crumbs]="['People and money', 'Finance']" title="Creditors"
                       subtitle="Accounts payable: money the business owes">
        <button mat-stroked-button (click)="go('/finance')"><mat-icon>arrow_back</mat-icon>Finance overview</button>
      </app-page-header>

      @if (loading()) {
        <div class="cr-card"><app-skeleton-rows [rows]="5" [avatar]="false"></app-skeleton-rows></div>
      } @else {
        @if (summary()) {
          <app-kpi-strip [items]="kpis()"></app-kpi-strip>

          <!-- Unpaid invoices broken down by company & department -->
          <div class="cr-breakdowns">
            <section class="cr-card">
              <div class="cr-section-head">
                <h2><mat-icon>business</mat-icon> Unpaid by company</h2>
                <span class="cr-section-total">{{ byCompany()?.total | currency:'ZAR':'symbol':'1.0-0' }}</span>
              </div>
              @if ((byCompany()?.groups?.length ?? 0) === 0) {
                <app-empty-state compact icon="check_circle" title="No unpaid invoices"></app-empty-state>
              } @else {
                @for (g of byCompany()?.groups; track g.company) {
                  <div class="cr-break-row">
                    <span class="cr-break-name">{{ g.company }}</span>
                    <span class="cr-break-meta">{{ g.count }} invoice(s)</span>
                    <span class="cr-break-amt">{{ g.amount | currency:'ZAR':'symbol':'1.2-2' }}</span>
                  </div>
                }
              }
            </section>

            <section class="cr-card">
              <div class="cr-section-head">
                <h2><mat-icon>apartment</mat-icon> Unpaid by department</h2>
                <span class="cr-section-total">{{ byDepartment()?.total | currency:'ZAR':'symbol':'1.0-0' }}</span>
              </div>
              @if ((byDepartment()?.groups?.length ?? 0) === 0) {
                <app-empty-state compact icon="check_circle" title="No unpaid invoices"></app-empty-state>
              } @else {
                @for (g of byDepartment()?.groups; track g.departmentId) {
                  <div class="cr-break-row">
                    <span class="cr-break-name">{{ g.department }}</span>
                    <span class="cr-break-meta">{{ g.count }} invoice(s)</span>
                    <span class="cr-break-amt">{{ g.amount | currency:'ZAR':'symbol':'1.2-2' }}</span>
                  </div>
                }
              }
            </section>
          </div>

          <!-- Requisitions from Logistics -->
          <section class="cr-requisitions">
            <div class="cr-section-head">
              <h2><mat-icon>local_shipping</mat-icon> Logistics requisitions</h2>
              <span class="cr-section-total">{{ requisitionsTotal() | currency:'ZAR':'symbol':'1.2-2' }}</span>
            </div>
            <app-data-table tableId="finance-creditors-requisitions" itemName="requisitions" caption="Logistics requisitions"
                            [rows]="requisitions()" [columns]="columns" [rowKey]="rowKey"
                            emptyIcon="receipt" emptyTitle="No active requisitions"
                            emptyMessage="Active logistics requisitions show up here."></app-data-table>
          </section>
        }
      }
    </main>
  `,
  styles: [`
    :host { display:block; }
    .cr-container { max-width:1320px; margin:0 auto; padding:var(--space-5) var(--space-5) var(--space-8); display:grid; gap:var(--space-4); }
    @media (max-width:600px) { .cr-container { padding:var(--space-4) var(--space-4) var(--space-6); } }

    .cr-card { background:var(--color-surface); border:1px solid var(--color-line); border-radius:var(--radius-md); padding:var(--space-4); }
    .cr-breakdowns { display:grid; grid-template-columns:1fr 1fr; gap:var(--space-4); }
    .cr-break-row { display:flex; align-items:center; gap:var(--space-3); padding:11px 4px; border-bottom:1px solid var(--color-line); }
    .cr-break-row:last-child { border-bottom:none; }
    .cr-break-name { font-weight:600; color:var(--color-text); font-size:var(--text-md); flex:1; }
    .cr-break-meta { font-size:var(--text-xs); color:var(--color-text-3); }
    .cr-break-amt { font-weight:700; color:var(--color-text); font-size:var(--text-md); font-variant-numeric:tabular-nums; min-width:120px; text-align:right; }
    @media (max-width:820px) { .cr-breakdowns { grid-template-columns:1fr; } }
    .cr-requisitions { display:grid; gap:var(--space-3); }
    .cr-section-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3); }
    .cr-requisitions .cr-section-head { margin-bottom:0; }
    .cr-section-head h2 { display:flex; align-items:center; gap:var(--space-2); margin:0; font-size:var(--text-lg); color:var(--color-text); }
    .cr-section-head h2 mat-icon { color:var(--color-text-3); }
    .cr-section-total { font-size:var(--text-xl); font-weight:700; color:var(--color-text); font-variant-numeric:tabular-nums; }
  `]
})
export class CreditorsComponent implements OnInit {
  summary = signal<CreditorsSummary | null>(null);
  requisitions = signal<Requisition[]>([]);
  byCompany = signal<BreakdownResp | null>(null);
  byDepartment = signal<BreakdownResp | null>(null);
  loading = signal(false);

  readonly rowKey = (r: Requisition) => r.id;

  readonly columns: TableColumn<Requisition>[] = [
    { key: 'rf', label: 'RF #', type: 'ref', value: r => r.rfNumber },
    { key: 'date', label: 'Date', type: 'date', value: r => r.date },
    { key: 'paidTo', label: 'Paid to', value: r => r.paidTo },
    { key: 'ewallet', label: 'E-wallet', type: 'money', value: r => r.amountEwallet },
    { key: 'diesel', label: 'Diesel', type: 'money', value: r => r.dieselAmount },
    { key: 'total', label: 'Total', type: 'money', value: r => r.total },
    { key: 'reason', label: 'Reason', value: r => r.reason }
  ];

  kpis = computed<KpiItem[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Total payable', value: formatMoney(s.totalPayable) },
      { label: 'Unpaid invoices', value: formatMoney(s.unpaidInvoices.amount), link: { label: `${s.unpaidInvoices.count} invoice(s)`, route: '/finance' } },
      { label: 'Monthly commitments', value: formatMoney(s.commitments.monthlyAmount), link: { label: `${s.commitments.count} active`, route: '/finance/commitments' } },
      { label: 'Requisitions', value: formatMoney(s.requisitions.amount), note: `${s.requisitions.count} active` },
      { label: 'Pending expenses', value: formatMoney(s.pendingExpenses.amount), note: `${s.pendingExpenses.count} awaiting` }
    ];
  });

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loading.set(true);
    this.http.get<CreditorsSummary>(`${environment.apiUrl}/finance/creditors/summary`).subscribe({
      next: (s) => { this.summary.set(s); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.http.get<any>(`${environment.apiUrl}/finance/creditors/requisitions?status=Active`).subscribe({
      next: (r) => this.requisitions.set(r?.items || []),
      error: () => {}
    });
    this.http.get<BreakdownResp>(`${environment.apiUrl}/finance/creditors/by-company`).subscribe({
      next: (r) => this.byCompany.set(r),
      error: () => {}
    });
    this.http.get<BreakdownResp>(`${environment.apiUrl}/finance/creditors/by-department`).subscribe({
      next: (r) => this.byDepartment.set(r),
      error: () => {}
    });
  }

  requisitionsTotal(): number {
    return this.requisitions().reduce((sum, r) => sum + (r.total || 0), 0);
  }

  go(route: string): void { this.router.navigate([route]); }
}
