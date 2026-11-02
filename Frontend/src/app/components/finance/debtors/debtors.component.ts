import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../ui/confirm.service';
import { ToastService } from '../../../ui/toast.service';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { KpiItem, KpiStripComponent } from '../../../ui/kpi-strip/kpi-strip.component';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { DataTableComponent, TableColumn, TableView, formatMoney } from '../../../ui/data-table/data-table.component';

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
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule, NavbarComponent, PageHeaderComponent, KpiStripComponent, SkeletonRowsComponent, DataTableComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="db-container">
      <app-page-header [crumbs]="['People and money', 'Finance']" title="Debtors"
                       subtitle="Accounts receivable: sales owed to the business, by company and customer">
        <button mat-stroked-button (click)="goBack()"><mat-icon>arrow_back</mat-icon>Finance overview</button>
      </app-page-header>

      @if (loading()) {
        <div class="db-card"><app-skeleton-rows [rows]="5" [avatar]="false"></app-skeleton-rows></div>
      } @else {
        @if (summary(); as s) {
        <app-kpi-strip [items]="kpis()"></app-kpi-strip>

        <!-- Company breakdown / tabs -->
        <div class="db-companies">
          <button type="button" class="db-company" [class.active]="activeCompany() === null" [attr.aria-pressed]="activeCompany() === null" (click)="selectCompany(null)">
            <span class="db-company-name">All companies</span>
            <span class="db-company-out">{{ s.totalOutstanding | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="db-company-meta">{{ s.customerCount }} customers</span>
          </button>
          @for (co of s.byCompany; track co.code) {
            <button type="button" class="db-company" [class.active]="activeCompany() === co.code" [attr.aria-pressed]="activeCompany() === co.code" (click)="selectCompany(co.code ?? null)">
              <span class="db-company-name">{{ co.company }}</span>
              <span class="db-company-out">{{ co.outstanding | currency:'ZAR':'symbol':'1.0-0' }}</span>
              <span class="db-company-meta">{{ co.customerCount }} customers · {{ co.collected | currency:'ZAR':'symbol':'1.0-0' }} collected</span>
            </button>
          }
        </div>

        <app-data-table tableId="finance-debtors" itemName="customers" caption="Debtors by customer"
                        [rows]="s.byCustomer" [columns]="columns" [views]="views" [rowKey]="rowKey"
                        (rowClick)="openCustomer($event)" emptyIcon="people"
                        emptyMessage="Customers with sales show up here."></app-data-table>
        }
      }
    </main>

    <!-- Customer drill-down -->
    @if (detail(); as d) {
      <div class="db-overlay" (click)="closeDetail()">
        <div class="db-dialog" role="dialog" aria-modal="true" aria-labelledby="db-detail-title" (click)="$event.stopPropagation()">
          <div class="db-dialog-head">
            <div>
              <h2 id="db-detail-title">{{ d.customerName || d.customerNumber }}</h2>
              <span class="db-dialog-sub">{{ d.customerNumber }} · {{ d.transactionCount }} transactions</span>
            </div>
            <button aria-label="Close" mat-icon-button (click)="closeDetail()"><mat-icon>close</mat-icon></button>
          </div>

          <div class="db-dialog-metrics">
            <div class="db-metric"><span class="db-metric-label">Net sales</span><span class="db-metric-value">{{ d.netSales | currency:'ZAR':'symbol':'1.2-2' }}</span></div>
            <div class="db-metric"><span class="db-metric-label">Collected</span><span class="db-metric-value green">{{ d.collected | currency:'ZAR':'symbol':'1.2-2' }}</span></div>
            <div class="db-metric"><span class="db-metric-label">Outstanding</span><span class="db-metric-value" [class.red]="d.outstanding > 0">{{ d.outstanding | currency:'ZAR':'symbol':'1.2-2' }}</span></div>
            <button mat-flat-button color="primary" class="db-collect-btn" (click)="openCollect(d)"><mat-icon>payments</mat-icon> Record collection</button>
          </div>

          <div class="db-dialog-body">
            @if (detailLoading()) {
              <app-skeleton-rows [rows]="4" [avatar]="false"></app-skeleton-rows>
            } @else {
              @if (d.payments.length > 0) {
                <div class="db-section-title">Collections</div>
                <table class="app-table">
                  <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>By</th><th class="num">Amount</th><th><span class="sr-only">Actions</span></th></tr></thead>
                  <tbody>
                    @for (p of d.payments; track p.id) {
                      <tr>
                        <td>{{ p.paymentDate | date:'dd MMM yyyy' }}</td>
                        <td>{{ p.paymentMethod || '—' }}</td>
                        <td>{{ p.paymentReference || '—' }}</td>
                        <td>{{ p.recordedByName || '—' }}</td>
                        <td class="num db-collected">{{ p.amount | currency:'ZAR':'symbol':'1.2-2' }}</td>
                        <td><button mat-icon-button class="db-del" aria-label="Delete collection" (click)="deleteCollection(p, d)"><mat-icon>delete</mat-icon></button></td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
              <div class="db-section-title">Sales transactions</div>
              <table class="app-table">
                <thead>
                  <tr><th>Trans #</th><th>Date</th><th>Type</th><th>Product</th><th class="num">Qty</th><th class="num">Net</th></tr>
                </thead>
                <tbody>
                  @for (i of d.items; track i.id) {
                    <tr>
                      <td class="ref">{{ i.transactionNumber }}</td>
                      <td>{{ i.transactionDate | date:'dd MMM yyyy' }}</td>
                      <td>{{ i.transactionType }}</td>
                      <td class="db-prod">{{ i.productDescription }}</td>
                      <td class="num">{{ i.quantity | number:'1.0-2' }}</td>
                      <td class="num">{{ i.netSales | currency:'ZAR':'symbol':'1.2-2' }}</td>
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
        <div class="db-collect-dialog" role="dialog" aria-modal="true" aria-labelledby="db-collect-title" (click)="$event.stopPropagation()">
          <div class="db-dialog-head">
            <h2 id="db-collect-title">Record collection</h2>
            <button aria-label="Close" mat-icon-button (click)="closeCollect()"><mat-icon>close</mat-icon></button>
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
              <button mat-button (click)="closeCollect()">Cancel</button>
              <button mat-flat-button color="primary" [disabled]="!collectAmount || collectAmount <= 0 || saving()" (click)="saveCollection()">
                {{ saving() ? 'Saving…' : 'Record collection' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display:block; }
    .db-container { max-width:1320px; margin:0 auto; padding:var(--space-5) var(--space-5) var(--space-8); display:grid; gap:var(--space-4); }
    @media (max-width:600px) { .db-container { padding:var(--space-4) var(--space-4) var(--space-6); } }

    .db-card { background:var(--color-surface); border:1px solid var(--color-line); border-radius:var(--radius-md); overflow:hidden; }

    .db-companies { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:var(--space-3); }
    .db-company { text-align:left; font-family:inherit; background:var(--color-surface); border:1px solid var(--color-line); border-radius:var(--radius-md); padding:12px 14px; display:flex; flex-direction:column; gap:3px; cursor:pointer; transition:background .15s, border-color .15s; }
    .db-company:hover { background:var(--color-surface-2); }
    .db-company.active { border-color:var(--color-primary); background:var(--color-primary-soft); box-shadow:0 0 0 1px var(--color-primary); }
    .db-company-name { font-weight:700; color:var(--color-text); font-size:var(--text-md); }
    .db-company-out { font-size:var(--text-2xl); font-weight:800; color:var(--color-text); font-variant-numeric:tabular-nums; }
    .db-company-meta { font-size:var(--text-xs); color:var(--color-text-3); }

    .db-collected { font-weight:600; color:var(--color-ok); }
    .db-prod { max-width:280px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .db-overlay { position:fixed; inset:0; background:var(--color-scrim); display:flex; align-items:center; justify-content:center; z-index:1000; padding:var(--space-5); }
    .db-dialog { background:var(--color-surface); color:var(--color-text); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); width:900px; max-width:95vw; max-height:88vh; display:flex; flex-direction:column; overflow:hidden; }
    .db-dialog-head { display:flex; justify-content:space-between; align-items:flex-start; padding:var(--space-4) var(--space-3) var(--space-4) var(--space-5); border-bottom:1px solid var(--color-line); }
    .db-dialog-head h2 { margin:0; font-size:var(--text-xl); }
    .db-dialog-sub { font-size:var(--text-sm); color:var(--color-text-3); }
    .db-dialog-metrics { display:flex; align-items:center; gap:var(--space-5); padding:var(--space-4) var(--space-5); background:var(--color-surface-2); border-bottom:1px solid var(--color-line); flex-wrap:wrap; }
    .db-metric { display:flex; flex-direction:column; gap:2px; }
    .db-metric-label { font-size:var(--text-xs); text-transform:uppercase; color:var(--color-text-3); font-weight:600; }
    .db-metric-value { font-size:var(--text-xl); font-weight:700; color:var(--color-text); font-variant-numeric:tabular-nums; }
    .db-metric-value.green { color:var(--color-ok); }
    .db-metric-value.red { color:var(--color-danger); }
    .db-collect-btn { margin-left:auto; }
    .db-dialog-body { padding:0 var(--space-5) var(--space-4); overflow-y:auto; }
    .db-section-title { font-size:var(--text-xs); text-transform:uppercase; color:var(--color-text-3); font-weight:700; margin:18px 0 8px; }
    .db-del { color:var(--color-danger); }

    .db-collect-dialog { background:var(--color-surface); color:var(--color-text); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); width:460px; max-width:95vw; max-height:90vh; display:flex; flex-direction:column; overflow:hidden; }
    .db-collect-body { padding:var(--space-4) var(--space-5) var(--space-5); display:flex; flex-direction:column; overflow-y:auto; }
    .db-collect-cust { margin:0 0 var(--space-3); font-size:var(--text-sm); color:var(--color-text-3); }
    .db-collect-body label { font-size:var(--text-xs); font-weight:600; color:var(--color-text-2); margin:10px 0 4px; text-transform:uppercase; }
    .db-collect-body input, .db-collect-body select, .db-collect-body textarea { border:1px solid var(--color-line-strong); border-radius:var(--radius-control); background:var(--color-surface); color:var(--color-text); padding:10px 12px; font-size:var(--text-md); font-family:inherit; outline:none; }
    .db-collect-body input:focus, .db-collect-body select:focus, .db-collect-body textarea:focus { border-color:var(--color-primary); box-shadow:0 0 0 3px var(--color-primary-soft); }
    .db-collect-actions { display:flex; justify-content:flex-end; gap:var(--space-2); margin-top:var(--space-5); }
  `]
})
export class DebtorsComponent implements OnInit {
  summary = signal<DebtorsSummary | null>(null);
  loading = signal(false);
  detail = signal<CustomerDetail | null>(null);
  detailLoading = signal(false);
  activeCompany = signal<string | null>(null);

  // Collection dialog state
  collectFor = signal<CustomerDetail | null>(null);
  saving = signal(false);
  collectAmount: number | null = null;
  collectDate = new Date().toISOString().slice(0, 10);
  collectMethod = 'EFT';
  collectReference = '';
  collectNotes = '';

  readonly rowKey = (c: CustomerRow) => c.customerNumber;

  readonly columns: TableColumn<CustomerRow>[] = [
    { key: 'name', label: 'Customer', value: c => c.customerName },
    { key: 'number', label: 'Number', type: 'ref', value: c => c.customerNumber },
    { key: 'txns', label: 'Txns', type: 'number', value: c => c.transactionCount },
    { key: 'netSales', label: 'Net sales', type: 'money', value: c => c.netSales },
    { key: 'collected', label: 'Collected', type: 'money', value: c => c.collected },
    { key: 'outstanding', label: 'Outstanding', type: 'money', value: c => c.outstanding }
  ];

  readonly views: TableView<CustomerRow>[] = [
    { id: 'all', label: 'All' },
    { id: 'outstanding', label: 'With outstanding', filter: c => c.outstanding > 0 }
  ];

  kpis = computed<KpiItem[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Outstanding (not collected)', value: formatMoney(s.totalOutstanding), note: `of ${formatMoney(s.totalReceivable)} net sales` },
      { label: 'Collected', value: formatMoney(s.totalCollected) },
      { label: 'Customers', value: s.customerCount.toLocaleString('en-ZA') }
    ];
  });

  constructor(private http: HttpClient, private router: Router, private readonly toast: ToastService, private readonly confirmDialog: ConfirmService) {}

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
        this.toast.done('Collection recorded');
        this.closeCollect();
        this.refreshCustomer(cf.customerNumber);
        this.load();
      },
      error: () => { this.saving.set(false); this.toast.error("Couldn't record the collection. Try again."); }
    });
  }

  refreshCustomer(customerNumber: string): void {
    this.http.get<CustomerDetail>(`${environment.apiUrl}/finance/debtors/customer/${encodeURIComponent(customerNumber)}`).subscribe({
      next: (d) => { if (this.detail()) this.detail.set(d); }
    });
  }

  async deleteCollection(p: PaymentRow, d: CustomerDetail): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: 'Remove this collection record?',
      message: `The collection is removed from ${d.customerName || d.customerNumber}.`,
      confirmText: 'Remove collection',
      danger: true
    }))) return;
    this.http.delete(`${environment.apiUrl}/finance/debtors/payments/${p.id}`).subscribe({
      next: () => { this.toast.done('Collection removed'); this.refreshCustomer(d.customerNumber); this.load(); },
      error: () => this.toast.error("Couldn't remove the collection. Try again.")
    });
  }
}
