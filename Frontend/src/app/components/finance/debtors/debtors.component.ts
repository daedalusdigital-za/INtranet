import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { environment } from '../../../../environments/environment';

interface CustomerRow {
  customerNumber: string;
  customerName: string;
  company?: string;
  transactionCount: number;
  netSales: number;
  collected: number;
  outstanding: number;
}

interface CompanyRow {
  code?: string;
  company: string;
  customerCount: number;
  transactionCount: number;
  netSales: number;
  collected: number;
  outstanding: number;
}

interface DebtorsSummary {
  totalReceivable: number;
  totalCollected: number;
  totalOutstanding: number;
  customerCount: number;
  transactionCount: number;
  byCompany: CompanyRow[];
  topCustomers: CustomerRow[];
  byCustomer: CustomerRow[];
}

interface PaymentRow {
  id: number; amount: number; paymentDate: string; paymentMethod?: string;
  paymentReference?: string; company?: string; notes?: string; recordedByName?: string;
}

interface CustomerDetail {
  customerNumber: string;
  customerName?: string;
  transactionCount: number;
  netSales: number;
  collected: number;
  outstanding: number;
  items: {
    id: number; transactionNumber: string; transactionDate: string; transactionType: string;
    company?: string; productCode: string; productDescription: string; quantity: number; netSales: number; status: string;
  }[];
  payments: PaymentRow[];
}

@Component({
  selector: 'app-debtors',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, MatSnackBarModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="db-container">
      <button class="db-back" (click)="goBack()">
        <mat-icon>arrow_back</mat-icon> Back to Finance
      </button>
      <div class="db-header">
        <div class="db-title">
          <div class="db-icon"><mat-icon>call_received</mat-icon></div>
          <div>
            <h1>Debtors</h1>
            <p>Accounts Receivable — sales owed to the business, by company & customer</p>
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="db-loading"><mat-spinner diameter="44"></mat-spinner></div>
      } @else {
        @if (summary(); as s) {
        <div class="db-stats">
          <div class="db-hero">
            <span class="db-hero-label">Outstanding (Not Collected)</span>
            <span class="db-hero-value">{{ s.totalOutstanding | currency:'ZAR':'symbol':'1.2-2' }}</span>
            <span class="db-hero-sub">of {{ s.totalReceivable | currency:'ZAR':'symbol':'1.0-0' }} net sales</span>
          </div>
          <div class="db-stat collected">
            <span class="db-stat-value">{{ s.totalCollected | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="db-stat-label">Collected</span>
          </div>
          <div class="db-stat">
            <span class="db-stat-value">{{ s.customerCount | number }}</span>
            <span class="db-stat-label">Customers</span>
          </div>
        </div>

        <!-- Company breakdown / tabs -->
        <div class="db-companies">
          <button class="db-company" [class.active]="activeCompany() === null" (click)="selectCompany(null)">
            <span class="db-company-name">All Companies</span>
            <span class="db-company-out">{{ s.totalOutstanding | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="db-company-meta">{{ s.customerCount }} customers</span>
          </button>
          @for (co of s.byCompany; track co.code) {
            <button class="db-company" [class.active]="activeCompany() === co.code" (click)="selectCompany(co.code ?? null)">
              <span class="db-company-name">{{ co.company }}</span>
              <span class="db-company-out">{{ co.outstanding | currency:'ZAR':'symbol':'1.0-0' }}</span>
              <span class="db-company-meta">{{ co.customerCount }} customers · {{ co.collected | currency:'ZAR':'symbol':'1.0-0' }} collected</span>
            </button>
          }
        </div>

        <div class="db-filters">
          <div class="db-search">
            <mat-icon>search</mat-icon>
            <input type="text" [(ngModel)]="search" placeholder="Search customer name or number…" />
          </div>
          <label class="db-toggle">
            <input type="checkbox" [(ngModel)]="onlyOutstanding" /> Only with outstanding
          </label>
        </div>

        <div class="db-table-wrap">
          <table class="db-table">
            <thead>
              <tr><th>Customer</th><th>Number</th><th>Txns</th><th>Net Sales</th><th>Collected</th><th>Outstanding</th><th></th></tr>
            </thead>
            <tbody>
              @for (c of filtered(); track c.customerNumber) {
                <tr (click)="openCustomer(c)" class="db-row">
                  <td class="db-name">{{ c.customerName }}</td>
                  <td class="db-num">{{ c.customerNumber }}</td>
                  <td>{{ c.transactionCount }}</td>
                  <td class="db-amount">{{ c.netSales | currency:'ZAR':'symbol':'1.0-0' }}</td>
                  <td class="db-collected">{{ c.collected | currency:'ZAR':'symbol':'1.0-0' }}</td>
                  <td class="db-outstanding" [class.zero]="c.outstanding <= 0">{{ c.outstanding | currency:'ZAR':'symbol':'1.0-0' }}</td>
                  <td><mat-icon class="db-chevron">chevron_right</mat-icon></td>
                </tr>
              }
            </tbody>
          </table>
          @if (filtered().length === 0) { <div class="db-empty">No customers match your search.</div> }
        </div>
        }
      }
    </div>

    <!-- Customer drill-down -->
    @if (detail(); as d) {
      <div class="db-overlay" (click)="closeDetail()">
        <div class="db-dialog" (click)="$event.stopPropagation()">
          <div class="db-dialog-head">
            <div>
              <h2>{{ d.customerName || d.customerNumber }}</h2>
              <span class="db-dialog-sub">{{ d.customerNumber }} · {{ d.transactionCount }} transactions</span>
            </div>
            <button class="db-close" (click)="closeDetail()"><mat-icon>close</mat-icon></button>
          </div>

          <div class="db-dialog-metrics">
            <div class="db-metric"><span class="db-metric-label">Net Sales</span><span class="db-metric-value">{{ d.netSales | currency:'ZAR':'symbol':'1.2-2' }}</span></div>
            <div class="db-metric"><span class="db-metric-label">Collected</span><span class="db-metric-value green">{{ d.collected | currency:'ZAR':'symbol':'1.2-2' }}</span></div>
            <div class="db-metric"><span class="db-metric-label">Outstanding</span><span class="db-metric-value" [class.red]="d.outstanding > 0">{{ d.outstanding | currency:'ZAR':'symbol':'1.2-2' }}</span></div>
            <button class="db-collect-btn" (click)="openCollect(d)"><mat-icon>payments</mat-icon> Record Collection</button>
          </div>

          <div class="db-dialog-body">
            @if (detailLoading()) {
              <div class="db-loading"><mat-spinner diameter="32"></mat-spinner></div>
            } @else {
              @if (d.payments.length > 0) {
                <div class="db-section-title">Collections</div>
                <table class="db-table">
                  <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>By</th><th>Amount</th><th></th></tr></thead>
                  <tbody>
                    @for (p of d.payments; track p.id) {
                      <tr>
                        <td>{{ p.paymentDate | date:'dd MMM yyyy' }}</td>
                        <td>{{ p.paymentMethod || '—' }}</td>
                        <td>{{ p.paymentReference || '—' }}</td>
                        <td>{{ p.recordedByName || '—' }}</td>
                        <td class="db-collected">{{ p.amount | currency:'ZAR':'symbol':'1.2-2' }}</td>
                        <td><button class="db-del" (click)="deleteCollection(p, d)"><mat-icon>delete</mat-icon></button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
              <div class="db-section-title">Sales Transactions</div>
              <table class="db-table">
                <thead>
                  <tr><th>Trans #</th><th>Date</th><th>Type</th><th>Product</th><th>Qty</th><th>Net</th></tr>
                </thead>
                <tbody>
                  @for (i of d.items; track i.id) {
                    <tr>
                      <td>{{ i.transactionNumber }}</td>
                      <td>{{ i.transactionDate | date:'dd MMM yyyy' }}</td>
                      <td>{{ i.transactionType }}</td>
                      <td class="db-prod">{{ i.productDescription }}</td>
                      <td>{{ i.quantity | number:'1.0-2' }}</td>
                      <td class="db-amount">{{ i.netSales | currency:'ZAR':'symbol':'1.2-2' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>
    }

    <!-- Record collection dialog -->
    @if (collectFor(); as cf) {
      <div class="db-overlay" (click)="closeCollect()">
        <div class="db-collect-dialog" (click)="$event.stopPropagation()">
          <div class="db-dialog-head">
            <h2>Record Collection</h2>
            <button class="db-close" (click)="closeCollect()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="db-collect-body">
            <p class="db-collect-cust">{{ cf.customerName || cf.customerNumber }} · Outstanding {{ cf.outstanding | currency:'ZAR':'symbol':'1.2-2' }}</p>
            <label>Amount *</label>
            <input type="number" [(ngModel)]="collectAmount" placeholder="0.00" />
            <label>Date</label>
            <input type="date" [(ngModel)]="collectDate" />
            <label>Method</label>
            <select [(ngModel)]="collectMethod">
              <option value="EFT">EFT</option>
              <option value="Cash">Cash</option>
              <option value="Cheque">Cheque</option>
              <option value="Card">Card</option>
              <option value="DebitOrder">Debit Order</option>
              <option value="Other">Other</option>
            </select>
            <label>Reference</label>
            <input type="text" [(ngModel)]="collectReference" placeholder="e.g. bank ref / receipt no." />
            <label>Notes</label>
            <textarea [(ngModel)]="collectNotes" rows="2" placeholder="Optional"></textarea>
            <div class="db-collect-actions">
              <button class="db-btn-cancel" (click)="closeCollect()">Cancel</button>
              <button class="db-btn-save" [disabled]="!collectAmount || collectAmount <= 0 || saving()" (click)="saveCollection()">
                {{ saving() ? 'Saving…' : 'Record Collection' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:linear-gradient(135deg,#059669 0%,#047857 100%); }
    .db-container { max-width:1300px; margin:0 auto; padding:24px 20px 60px; }
    .db-back { display:inline-flex; align-items:center; gap:6px; margin-bottom:16px; padding:8px 16px 8px 12px; border:none; border-radius:10px; background:rgba(255,255,255,.2); color:#fff; font-size:14px; font-weight:600; cursor:pointer; transition:background .15s; }
    .db-back:hover { background:rgba(255,255,255,.32); }
    .db-back mat-icon { font-size:20px; width:20px; height:20px; }
    .db-header { margin-bottom:20px; }
    .db-title { display:flex; align-items:center; gap:16px; }
    .db-icon { width:56px; height:56px; border-radius:16px; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; }
    .db-icon mat-icon { color:#fff; font-size:30px; width:30px; height:30px; }
    .db-title h1 { margin:0; color:#fff; font-size:24px; font-weight:700; }
    .db-title p { margin:4px 0 0; color:rgba(255,255,255,.85); font-size:14px; }

    .db-loading { background:#fff; border-radius:14px; padding:60px; display:flex; justify-content:center; }
    .db-stats { display:grid; grid-template-columns:2fr 1fr 1fr; gap:14px; margin-bottom:16px; }
    .db-hero { background:linear-gradient(135deg,#065f46,#047857); border-radius:16px; padding:24px 28px; display:flex; flex-direction:column; gap:4px; }
    .db-hero-label { color:rgba(255,255,255,.85); font-size:13px; text-transform:uppercase; letter-spacing:.05em; }
    .db-hero-value { color:#fff; font-size:32px; font-weight:800; }
    .db-hero-sub { color:rgba(255,255,255,.7); font-size:13px; }
    .db-stat { background:#fff; border-radius:14px; padding:20px; display:flex; flex-direction:column; gap:2px; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,.1); }
    .db-stat.collected .db-stat-value { color:#059669; }
    .db-stat-value { font-size:24px; font-weight:700; color:#111827; }
    .db-stat-label { font-size:12px; text-transform:uppercase; color:#9ca3af; font-weight:600; }

    .db-companies { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; margin-bottom:20px; }
    .db-company { text-align:left; background:rgba(255,255,255,.9); border:2px solid transparent; border-radius:14px; padding:14px 16px; display:flex; flex-direction:column; gap:3px; cursor:pointer; transition:all .15s; }
    .db-company:hover { background:#fff; }
    .db-company.active { border-color:#fff; background:#fff; box-shadow:0 4px 14px rgba(0,0,0,.18); }
    .db-company-name { font-weight:700; color:#065f46; font-size:14px; }
    .db-company-out { font-size:20px; font-weight:800; color:#111827; }
    .db-company-meta { font-size:11px; color:#6b7280; }

    .db-filters { margin-bottom:16px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
    .db-search { display:flex; align-items:center; gap:8px; background:#fff; padding:12px 16px; border-radius:12px; max-width:420px; flex:1; min-width:260px; }
    .db-search mat-icon { color:#9ca3af; }
    .db-search input { border:none; outline:none; font-size:14px; width:100%; }
    .db-toggle { display:flex; align-items:center; gap:6px; color:#fff; font-size:14px; font-weight:600; cursor:pointer; }

    .db-table-wrap { background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.1); }
    .db-table { width:100%; border-collapse:collapse; }
    .db-table th { text-align:left; padding:12px 16px; font-size:12px; text-transform:uppercase; color:#9ca3af; background:#f9fafb; border-bottom:1px solid #eef2f7; }
    .db-table td { padding:13px 16px; font-size:14px; color:#374151; border-bottom:1px solid #f3f4f6; }
    .db-row { cursor:pointer; transition:background .15s; }
    .db-row:hover { background:#f0fdf4; }
    .db-name { font-weight:600; color:#111827; }
    .db-num { font-family:monospace; color:#6b7280; }
    .db-amount { font-weight:600; color:#374151; }
    .db-collected { font-weight:600; color:#059669; }
    .db-outstanding { font-weight:700; color:#dc2626; }
    .db-outstanding.zero { color:#9ca3af; }
    .db-chevron { color:#d1d5db; }
    .db-prod { max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .db-empty { padding:30px; text-align:center; color:#9ca3af; }

    .db-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px; }
    .db-dialog { background:#fff; border-radius:16px; width:900px; max-width:95vw; max-height:88vh; display:flex; flex-direction:column; overflow:hidden; }
    .db-dialog-head { display:flex; justify-content:space-between; align-items:flex-start; padding:20px 24px; border-bottom:1px solid #eef2f7; }
    .db-dialog-head h2 { margin:0; font-size:19px; }
    .db-dialog-sub { font-size:13px; color:#6b7280; }
    .db-close { background:none; border:none; cursor:pointer; color:#9ca3af; }
    .db-dialog-metrics { display:flex; align-items:center; gap:24px; padding:16px 24px; background:#f9fafb; border-bottom:1px solid #eef2f7; flex-wrap:wrap; }
    .db-metric { display:flex; flex-direction:column; gap:2px; }
    .db-metric-label { font-size:11px; text-transform:uppercase; color:#9ca3af; font-weight:600; }
    .db-metric-value { font-size:18px; font-weight:700; color:#111827; }
    .db-metric-value.green { color:#059669; }
    .db-metric-value.red { color:#dc2626; }
    .db-collect-btn { margin-left:auto; display:inline-flex; align-items:center; gap:6px; background:#059669; color:#fff; border:none; border-radius:10px; padding:10px 18px; font-size:14px; font-weight:600; cursor:pointer; }
    .db-collect-btn:hover { background:#047857; }
    .db-dialog-body { padding:0 24px 20px; overflow-y:auto; }
    .db-section-title { font-size:12px; text-transform:uppercase; color:#6b7280; font-weight:700; margin:18px 0 8px; }
    .db-del { background:none; border:none; cursor:pointer; color:#dc2626; }
    .db-del mat-icon { font-size:18px; width:18px; height:18px; }

    .db-collect-dialog { background:#fff; border-radius:16px; width:460px; max-width:95vw; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; }
    .db-collect-body { padding:20px 24px 24px; display:flex; flex-direction:column; overflow-y:auto; }
    .db-collect-cust { margin:0 0 12px; font-size:13px; color:#6b7280; }
    .db-collect-body label { font-size:12px; font-weight:600; color:#374151; margin:10px 0 4px; text-transform:uppercase; }
    .db-collect-body input, .db-collect-body select, .db-collect-body textarea { border:1px solid #d1d5db; border-radius:8px; padding:10px 12px; font-size:14px; outline:none; }
    .db-collect-body input:focus, .db-collect-body select:focus, .db-collect-body textarea:focus { border-color:#059669; }
    .db-collect-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:20px; }
    .db-btn-cancel { background:#f3f4f6; color:#374151; border:none; border-radius:8px; padding:10px 18px; font-weight:600; cursor:pointer; }
    .db-btn-save { background:#059669; color:#fff; border:none; border-radius:8px; padding:10px 18px; font-weight:600; cursor:pointer; }
    .db-btn-save:disabled { opacity:.5; cursor:not-allowed; }
  `]
})
export class DebtorsComponent implements OnInit {
  summary = signal<DebtorsSummary | null>(null);
  loading = signal(false);
  detail = signal<CustomerDetail | null>(null);
  detailLoading = signal(false);
  activeCompany = signal<string | null>(null);
  search = '';
  onlyOutstanding = false;

  // Collection dialog state
  collectFor = signal<CustomerDetail | null>(null);
  saving = signal(false);
  collectAmount: number | null = null;
  collectDate = new Date().toISOString().slice(0, 10);
  collectMethod = 'EFT';
  collectReference = '';
  collectNotes = '';

  filtered = computed(() => {
    const s = this.summary();
    if (!s) return [];
    const q = this.search.trim().toLowerCase();
    let list = s.byCustomer;
    if (this.onlyOutstanding) list = list.filter(c => c.outstanding > 0);
    if (q) list = list.filter(c =>
      (c.customerName || '').toLowerCase().includes(q) ||
      (c.customerNumber || '').toLowerCase().includes(q));
    return list;
  });

  constructor(private http: HttpClient, private router: Router, private snack: MatSnackBar) {}

  goBack(): void { this.router.navigate(['/finance']); }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const co = this.activeCompany();
    const url = `${environment.apiUrl}/finance/debtors/summary${co ? '?company=' + encodeURIComponent(co) : ''}`;
    this.http.get<DebtorsSummary>(url).subscribe({
      next: (s) => { this.summary.set(s); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  selectCompany(code: string | null): void {
    this.activeCompany.set(code);
    this.load();
  }

  openCustomer(c: CustomerRow): void {
    this.detail.set({ customerNumber: c.customerNumber, customerName: c.customerName, transactionCount: c.transactionCount, netSales: c.netSales, collected: c.collected, outstanding: c.outstanding, items: [], payments: [] });
    this.detailLoading.set(true);
    this.http.get<CustomerDetail>(`${environment.apiUrl}/finance/debtors/customer/${encodeURIComponent(c.customerNumber)}`).subscribe({
      next: (d) => { this.detail.set(d); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false)
    });
  }

  closeDetail(): void { this.detail.set(null); }

  openCollect(d: CustomerDetail): void {
    this.collectAmount = d.outstanding > 0 ? Math.round(d.outstanding * 100) / 100 : null;
    this.collectDate = new Date().toISOString().slice(0, 10);
    this.collectMethod = 'EFT';
    this.collectReference = '';
    this.collectNotes = '';
    this.collectFor.set(d);
  }

  closeCollect(): void { this.collectFor.set(null); }

  saveCollection(): void {
    const cf = this.collectFor();
    if (!cf || !this.collectAmount || this.collectAmount <= 0) return;
    this.saving.set(true);
    const body = {
      customerNumber: cf.customerNumber,
      customerName: cf.customerName,
      company: this.activeCompany(),
      amount: this.collectAmount,
      paymentDate: this.collectDate,
      paymentMethod: this.collectMethod,
      paymentReference: this.collectReference,
      notes: this.collectNotes
    };
    this.http.post(`${environment.apiUrl}/finance/debtors/collect`, body).subscribe({
      next: () => {
        this.saving.set(false);
        this.snack.open('Collection recorded', 'OK', { duration: 2500 });
        this.closeCollect();
        this.refreshCustomer(cf.customerNumber);
        this.load();
      },
      error: () => { this.saving.set(false); this.snack.open('Failed to record collection', 'Dismiss', { duration: 3000 }); }
    });
  }

  refreshCustomer(customerNumber: string): void {
    this.http.get<CustomerDetail>(`${environment.apiUrl}/finance/debtors/customer/${encodeURIComponent(customerNumber)}`).subscribe({
      next: (d) => { if (this.detail()) this.detail.set(d); }
    });
  }

  deleteCollection(p: PaymentRow, d: CustomerDetail): void {
    if (!confirm('Remove this collection record?')) return;
    this.http.delete(`${environment.apiUrl}/finance/debtors/payments/${p.id}`).subscribe({
      next: () => { this.snack.open('Collection removed', 'OK', { duration: 2000 }); this.refreshCustomer(d.customerNumber); this.load(); },
      error: () => this.snack.open('Failed to remove', 'Dismiss', { duration: 3000 })
    });
  }
}
