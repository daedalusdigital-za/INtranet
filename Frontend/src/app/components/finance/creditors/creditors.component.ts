import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { environment } from '../../../../environments/environment';

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
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="cr-container">
      <button class="cr-back" (click)="go('/finance')">
        <mat-icon>arrow_back</mat-icon> Back to Finance
      </button>
      <div class="cr-header">
        <div class="cr-title">
          <div class="cr-icon"><mat-icon>call_made</mat-icon></div>
          <div>
            <h1>Creditors</h1>
            <p>Accounts Payable — money the business owes</p>
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="cr-loading"><mat-spinner diameter="44"></mat-spinner></div>
      } @else {
        @if (summary(); as s) {
        <div class="cr-hero">
          <span class="cr-hero-label">Total Payable</span>
          <span class="cr-hero-value">{{ s.totalPayable | currency:'ZAR':'symbol':'1.2-2' }}</span>
        </div>

        <div class="cr-cards">
          <div class="cr-card invoices" (click)="go('/finance')">
            <mat-icon>receipt_long</mat-icon>
            <div class="cr-card-body">
              <span class="cr-card-value">{{ s.unpaidInvoices.amount | currency:'ZAR':'symbol':'1.0-0' }}</span>
              <span class="cr-card-label">Unpaid Invoices</span>
              <span class="cr-card-sub">{{ s.unpaidInvoices.count }} invoice(s)</span>
            </div>
          </div>
          <div class="cr-card commitments" (click)="go('/finance/commitments')">
            <mat-icon>event_repeat</mat-icon>
            <div class="cr-card-body">
              <span class="cr-card-value">{{ s.commitments.monthlyAmount | currency:'ZAR':'symbol':'1.0-0' }}</span>
              <span class="cr-card-label">Monthly Commitments</span>
              <span class="cr-card-sub">{{ s.commitments.count }} active</span>
            </div>
          </div>
          <div class="cr-card requisitions">
            <mat-icon>receipt</mat-icon>
            <div class="cr-card-body">
              <span class="cr-card-value">{{ s.requisitions.amount | currency:'ZAR':'symbol':'1.0-0' }}</span>
              <span class="cr-card-label">Requisitions</span>
              <span class="cr-card-sub">{{ s.requisitions.count }} active</span>
            </div>
          </div>
          <div class="cr-card expenses">
            <mat-icon>payments</mat-icon>
            <div class="cr-card-body">
              <span class="cr-card-value">{{ s.pendingExpenses.amount | currency:'ZAR':'symbol':'1.0-0' }}</span>
              <span class="cr-card-label">Pending Expenses</span>
              <span class="cr-card-sub">{{ s.pendingExpenses.count }} awaiting</span>
            </div>
          </div>
        </div>

        <!-- Unpaid invoices broken down by company & department -->
        <div class="cr-breakdowns">
          <div class="cr-section">
            <div class="cr-section-head">
              <h2><mat-icon>business</mat-icon> Unpaid by Company</h2>
              <span class="cr-section-total">{{ byCompany()?.total | currency:'ZAR':'symbol':'1.0-0' }}</span>
            </div>
            @if ((byCompany()?.groups?.length ?? 0) === 0) {
              <div class="cr-empty">No unpaid invoices.</div>
            } @else {
              @for (g of byCompany()?.groups; track g.company) {
                <div class="cr-break-row">
                  <span class="cr-break-name">{{ g.company }}</span>
                  <span class="cr-break-meta">{{ g.count }} invoice(s)</span>
                  <span class="cr-break-amt">{{ g.amount | currency:'ZAR':'symbol':'1.2-2' }}</span>
                </div>
              }
            }
          </div>

          <div class="cr-section">
            <div class="cr-section-head">
              <h2><mat-icon>apartment</mat-icon> Unpaid by Department</h2>
              <span class="cr-section-total">{{ byDepartment()?.total | currency:'ZAR':'symbol':'1.0-0' }}</span>
            </div>
            @if ((byDepartment()?.groups?.length ?? 0) === 0) {
              <div class="cr-empty">No unpaid invoices.</div>
            } @else {
              @for (g of byDepartment()?.groups; track g.departmentId) {
                <div class="cr-break-row">
                  <span class="cr-break-name">{{ g.department }}</span>
                  <span class="cr-break-meta">{{ g.count }} invoice(s)</span>
                  <span class="cr-break-amt">{{ g.amount | currency:'ZAR':'symbol':'1.2-2' }}</span>
                </div>
              }
            }
          </div>
        </div>

        <!-- Requisitions from Logistics -->
        <div class="cr-section">
          <div class="cr-section-head">
            <h2><mat-icon>local_shipping</mat-icon> Logistics Requisitions</h2>
            <span class="cr-section-total">{{ requisitionsTotal() | currency:'ZAR':'symbol':'1.2-2' }}</span>
          </div>
          @if (requisitions().length === 0) {
            <div class="cr-empty">No active requisitions.</div>
          } @else {
            <div class="cr-table-wrap">
              <table class="cr-table">
                <thead>
                  <tr><th>RF #</th><th>Date</th><th>Paid To</th><th>E-Wallet</th><th>Diesel</th><th>Total</th><th>Reason</th></tr>
                </thead>
                <tbody>
                  @for (r of requisitions(); track r.id) {
                    <tr>
                      <td class="cr-rf">{{ r.rfNumber || '—' }}</td>
                      <td>{{ r.date ? (r.date | date:'dd MMM yyyy') : '—' }}</td>
                      <td>{{ r.paidTo || '—' }}</td>
                      <td>{{ r.amountEwallet | currency:'ZAR':'symbol':'1.2-2' }}</td>
                      <td>{{ r.dieselAmount | currency:'ZAR':'symbol':'1.2-2' }}</td>
                      <td class="cr-total">{{ r.total | currency:'ZAR':'symbol':'1.2-2' }}</td>
                      <td class="cr-reason">{{ r.reason || '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%); }
    .cr-container { max-width:1300px; margin:0 auto; padding:24px 20px 60px; }
    .cr-back { display:inline-flex; align-items:center; gap:6px; margin-bottom:16px; padding:8px 16px 8px 12px; border:none; border-radius:10px; background:rgba(255,255,255,.2); color:#fff; font-size:14px; font-weight:600; cursor:pointer; transition:background .15s; }
    .cr-back:hover { background:rgba(255,255,255,.32); }
    .cr-back mat-icon { font-size:20px; width:20px; height:20px; }
    .cr-header { margin-bottom:20px; }
    .cr-title { display:flex; align-items:center; gap:16px; }
    .cr-icon { width:56px; height:56px; border-radius:16px; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; }
    .cr-icon mat-icon { color:#fff; font-size:30px; width:30px; height:30px; }
    .cr-title h1 { margin:0; color:#fff; font-size:24px; font-weight:700; }
    .cr-title p { margin:4px 0 0; color:rgba(255,255,255,.85); font-size:14px; }

    .cr-loading { background:#fff; border-radius:14px; padding:60px; display:flex; justify-content:center; }
    .cr-hero { background:linear-gradient(135deg,#7f1d1d,#991b1b); border-radius:16px; padding:24px 28px; margin-bottom:20px; display:flex; flex-direction:column; gap:4px; }
    .cr-hero-label { color:rgba(255,255,255,.8); font-size:13px; text-transform:uppercase; letter-spacing:.05em; }
    .cr-hero-value { color:#fff; font-size:34px; font-weight:800; }

    .cr-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:14px; margin-bottom:24px; }
    .cr-card { background:#fff; border-radius:14px; padding:18px; display:flex; align-items:center; gap:14px; cursor:pointer; transition:all .2s; box-shadow:0 2px 8px rgba(0,0,0,.1); }
    .cr-card:hover { transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,.15); }
    .cr-card > mat-icon { width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px; color:#fff; }
    .cr-card.invoices > mat-icon { background:linear-gradient(135deg,#6366f1,#60a5fa); }
    .cr-card.commitments > mat-icon { background:linear-gradient(135deg,#059669,#0d9488); }
    .cr-card.requisitions > mat-icon { background:linear-gradient(135deg,#f59e0b,#d97706); }
    .cr-card.expenses > mat-icon { background:linear-gradient(135deg,#0ea5e9,#38bdf8); }
    .cr-card-body { display:flex; flex-direction:column; }
    .cr-card-value { font-size:20px; font-weight:700; color:#111827; }
    .cr-card-label { font-size:13px; color:#374151; font-weight:600; }
    .cr-card-sub { font-size:12px; color:#9ca3af; }

    .cr-section { background:#fff; border-radius:14px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,.1); }
    .cr-breakdowns { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px; }
    .cr-break-row { display:flex; align-items:center; gap:12px; padding:11px 4px; border-bottom:1px solid #f3f4f6; }
    .cr-break-row:last-child { border-bottom:none; }
    .cr-break-name { font-weight:600; color:#111827; font-size:14px; flex:1; }
    .cr-break-meta { font-size:12px; color:#9ca3af; }
    .cr-break-amt { font-weight:700; color:#dc2626; font-size:14px; min-width:120px; text-align:right; }
    @media (max-width:820px) { .cr-breakdowns { grid-template-columns:1fr; } }
    .cr-section-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
    .cr-section-head h2 { display:flex; align-items:center; gap:8px; margin:0; font-size:17px; color:#111827; }
    .cr-section-head h2 mat-icon { color:#dc2626; }
    .cr-section-total { font-size:18px; font-weight:700; color:#dc2626; }
    .cr-empty { padding:30px; text-align:center; color:#9ca3af; }
    .cr-table-wrap { overflow-x:auto; }
    .cr-table { width:100%; border-collapse:collapse; }
    .cr-table th { text-align:left; padding:12px 14px; font-size:12px; text-transform:uppercase; color:#9ca3af; background:#f9fafb; border-bottom:1px solid #eef2f7; }
    .cr-table td { padding:12px 14px; font-size:14px; color:#374151; border-bottom:1px solid #f3f4f6; }
    .cr-rf { font-weight:600; color:#111827; }
    .cr-total { font-weight:700; color:#dc2626; }
    .cr-reason { max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#6b7280; }
  `]
})
export class CreditorsComponent implements OnInit {
  summary = signal<CreditorsSummary | null>(null);
  requisitions = signal<Requisition[]>([]);
  byCompany = signal<BreakdownResp | null>(null);
  byDepartment = signal<BreakdownResp | null>(null);
  loading = signal(false);

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
