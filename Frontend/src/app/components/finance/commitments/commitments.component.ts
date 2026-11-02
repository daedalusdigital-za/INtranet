import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../ui/confirm.service';
import { ToastService } from '../../../ui/toast.service';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { KpiItem, KpiStripComponent } from '../../../ui/kpi-strip/kpi-strip.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { StatusChipComponent } from '../../../ui/status-chip/status-chip.component';
import { formatMoney } from '../../../ui/data-table/data-table.component';

interface Commitment {
  id: number;
  name: string;
  supplier?: string;
  category: string;
  amount: number;
  currency: string;
  frequency: string;
  dayOfMonth?: number | null;
  departmentId?: number | null;
  companyName?: string;
  paymentMethod?: string;
  accountReference?: string;
  isActive: boolean;
  startDate?: string;
  endDate?: string | null;
  notes?: string;
  createdByName?: string;
  createdAt?: string;
}

interface Summary {
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  monthlyTotal: number;
  annualTotal: number;
  byCategory: { category: string; count: number; monthlyTotal: number }[];
}

@Component({
  selector: 'app-commitments',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule, NavbarComponent, PageHeaderComponent, KpiStripComponent, EmptyStateComponent, SkeletonRowsComponent, StatusChipComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="cm-container">
      <app-page-header [crumbs]="['People and money', 'Finance']" title="Monthly commitments"
                       subtitle="Recurring debit orders and subscriptions: fibre, VoIP airtime, insurance, rent">
        <button mat-stroked-button (click)="goBack()"><mat-icon>arrow_back</mat-icon>Finance overview</button>
        <button mat-flat-button color="primary" (click)="openNew()"><mat-icon>add</mat-icon>New commitment</button>
      </app-page-header>

      @if (summary()) {
        <app-kpi-strip [items]="kpis()"></app-kpi-strip>
      }

      <div class="cm-filters">
        <div class="cm-search">
          <mat-icon>search</mat-icon>
          <input type="text" aria-label="Search commitments" [(ngModel)]="search" (ngModelChange)="load()" placeholder="Search name, supplier…" />
        </div>
        <select aria-label="Category" [(ngModel)]="categoryFilter" (ngModelChange)="load()">
          <option value="">All categories</option>
          @for (cat of categories; track cat) { <option [value]="cat">{{ cat }}</option> }
        </select>
        <label class="cm-active-toggle">
          <input type="checkbox" [(ngModel)]="activeOnly" (ngModelChange)="load()" /> Active only
        </label>
      </div>

      @if (loading()) {
        <div class="cm-card"><app-skeleton-rows [rows]="5" [avatar]="false"></app-skeleton-rows></div>
      } @else if (items().length === 0) {
        <div class="cm-card">
          @if (hasFilters) {
            <app-empty-state icon="filter_alt_off" title="No commitments match"
                             message="Nothing fits the search or filters you have set.">
              <button mat-stroked-button (click)="clearFilters()">Clear the filters</button>
            </app-empty-state>
          } @else {
            <app-empty-state icon="event_busy" title="No commitments yet"
                             message="Add your first recurring monthly payment to start tracking cash-flow.">
              <button mat-flat-button color="primary" (click)="openNew()"><mat-icon>add</mat-icon>New commitment</button>
            </app-empty-state>
          }
        </div>
      } @else {
        <div class="cm-card cm-table-wrap">
          <table class="app-table">
            <thead>
              <tr>
                <th>Name</th><th>Category</th><th>Supplier</th><th class="num">Amount</th>
                <th>Frequency</th><th>Debit day</th><th>Method</th><th>Status</th><th><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (c of items(); track c.id) {
                <tr [class.paused]="!c.isActive">
                  <td class="cm-name">{{ c.name }}</td>
                  <td><span class="cm-chip cat-{{ c.category.toLowerCase() }}">{{ c.category }}</span></td>
                  <td>{{ c.supplier || '—' }}</td>
                  <td class="num cm-amount">{{ c.amount | currency:c.currency:'symbol':'1.2-2' }}</td>
                  <td>{{ c.frequency }}</td>
                  <td>{{ c.dayOfMonth ? ('Day ' + c.dayOfMonth) : '—' }}</td>
                  <td>{{ c.paymentMethod || '—' }}</td>
                  <td><app-status-chip [status]="c.isActive ? 'Active' : 'Paused'" [tone]="c.isActive ? 'ok' : 'neutral'"></app-status-chip></td>
                  <td>
                    <div class="cm-actions">
                      <button mat-icon-button aria-label="Edit" (click)="openEdit(c)" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
                      <button mat-icon-button [attr.aria-label]="c.isActive ? 'Pause' : 'Activate'" (click)="toggle(c)" [matTooltip]="c.isActive ? 'Pause' : 'Activate'">
                        <mat-icon>{{ c.isActive ? 'pause_circle' : 'play_circle' }}</mat-icon>
                      </button>
                      <button mat-icon-button class="cm-del" aria-label="Delete" (click)="remove(c)" matTooltip="Delete"><mat-icon>delete</mat-icon></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </main>

    <!-- Edit / New dialog -->
    @if (showDialog()) {
      <div class="cm-overlay" (click)="closeDialog()">
        <div class="cm-dialog" role="dialog" aria-modal="true" aria-labelledby="cm-dialog-title" (click)="$event.stopPropagation()">
          <div class="cm-dialog-head">
            <h2 id="cm-dialog-title">{{ editing().id ? 'Edit commitment' : 'New commitment' }}</h2>
            <button aria-label="Close" mat-icon-button (click)="closeDialog()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="cm-dialog-body">
            <div class="cm-field">
              <label>Name *</label>
              <input type="text" [(ngModel)]="editing().name" placeholder="e.g. Fibre — Head Office" />
            </div>
            <div class="cm-row">
              <div class="cm-field">
                <label>Category</label>
                <select [(ngModel)]="editing().category">
                  @for (cat of categories; track cat) { <option [value]="cat">{{ cat }}</option> }
                </select>
              </div>
              <div class="cm-field">
                <label>Supplier</label>
                <input type="text" [(ngModel)]="editing().supplier" placeholder="e.g. Vox, Telkom" />
              </div>
            </div>
            <div class="cm-row">
              <div class="cm-field">
                <label>Amount *</label>
                <input type="number" step="0.01" [(ngModel)]="editing().amount" />
              </div>
              <div class="cm-field">
                <label>Frequency</label>
                <select [(ngModel)]="editing().frequency">
                  <option value="Monthly">Monthly</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annually">Annually</option>
                </select>
              </div>
              <div class="cm-field">
                <label>Debit day</label>
                <input type="number" min="1" max="31" [(ngModel)]="editing().dayOfMonth" placeholder="1-31" />
              </div>
            </div>
            <div class="cm-row">
              <div class="cm-field">
                <label>Payment method</label>
                <input type="text" [(ngModel)]="editing().paymentMethod" placeholder="Debit Order / EFT / Card" />
              </div>
              <div class="cm-field">
                <label>Account / reference</label>
                <input type="text" [(ngModel)]="editing().accountReference" />
              </div>
            </div>
            <div class="cm-field">
              <label>Notes</label>
              <textarea rows="2" [(ngModel)]="editing().notes"></textarea>
            </div>
            <label class="cm-active-toggle">
              <input type="checkbox" [(ngModel)]="editing().isActive" /> Active
            </label>
          </div>
          <div class="cm-dialog-foot">
            <button mat-button (click)="closeDialog()">Cancel</button>
            <button mat-flat-button color="primary" (click)="save()" [disabled]="saving() || !editing().name">
              @if (saving()) { <mat-spinner diameter="18"></mat-spinner> } @else { Save }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display:block; }
    .cm-container { max-width:1320px; margin:0 auto; padding:var(--space-5) var(--space-5) var(--space-8); display:grid; gap:var(--space-4); }
    @media (max-width:600px) { .cm-container { padding:var(--space-4) var(--space-4) var(--space-6); } }

    .cm-card { background:var(--color-surface); border:1px solid var(--color-line); border-radius:var(--radius-md); overflow:hidden; }

    .cm-filters { display:flex; gap:var(--space-3); align-items:center; flex-wrap:wrap; background:var(--color-surface); border:1px solid var(--color-line); border-radius:var(--radius-md); padding:var(--space-2) var(--space-3); }
    .cm-search { display:flex; align-items:center; gap:var(--space-2); flex:1; min-width:220px; }
    .cm-search mat-icon { color:var(--color-text-3); }
    .cm-search input { border:none; outline:none; background:transparent; color:var(--color-text); font-size:var(--text-md); width:100%; }
    .cm-filters select { padding:8px 10px; border:1px solid var(--color-line-strong); border-radius:var(--radius-control); background:var(--color-surface); color:var(--color-text); font-size:var(--text-md); }
    .cm-active-toggle { display:flex; align-items:center; gap:6px; font-size:var(--text-md); color:var(--color-text-2); cursor:pointer; }

    .cm-table-wrap { overflow-x:auto; }
    .app-table tr.paused td { opacity:.6; }
    .cm-name { font-weight:600; }
    .cm-amount { font-weight:700; }
    .cm-chip { display:inline-block; padding:3px 10px; border-radius:999px; font-size:var(--text-xs); font-weight:600; background:var(--color-primary-soft); color:var(--color-primary); }
    .cm-chip.cat-fibre { background:var(--color-primary-soft); color:var(--color-primary); }
    .cm-chip.cat-airtime, .cm-chip.cat-voip { background:var(--color-cat-purple-soft); color:var(--color-cat-purple); }
    .cm-chip.cat-debitorder { background:var(--color-cat-pink-soft); color:var(--color-cat-pink); }
    .cm-chip.cat-rent { background:var(--color-cat-amber-soft); color:var(--color-cat-amber); }
    .cm-chip.cat-insurance { background:var(--color-cat-teal-soft); color:var(--color-cat-teal); }
    .cm-actions { display:flex; gap:2px; justify-content:flex-end; }
    .cm-del { color:var(--color-danger); }

    .cm-overlay { position:fixed; inset:0; background:var(--color-scrim); display:flex; align-items:center; justify-content:center; z-index:1000; padding:var(--space-5); }
    .cm-dialog { background:var(--color-surface); color:var(--color-text); border-radius:var(--radius-lg); box-shadow:var(--shadow-lg); width:600px; max-width:95vw; max-height:90vh; overflow-y:auto; }
    .cm-dialog-head { display:flex; justify-content:space-between; align-items:center; padding:var(--space-3) var(--space-3) var(--space-3) var(--space-5); border-bottom:1px solid var(--color-line); }
    .cm-dialog-head h2 { margin:0; font-size:var(--text-2xl); }
    .cm-dialog-body { padding:var(--space-4) var(--space-5); display:flex; flex-direction:column; gap:14px; }
    .cm-row { display:flex; gap:var(--space-3); }
    .cm-field { display:flex; flex-direction:column; gap:6px; flex:1; }
    .cm-field label { font-size:var(--text-sm); font-weight:600; color:var(--color-text-2); }
    .cm-field input, .cm-field select, .cm-field textarea { padding:9px 10px; border:1px solid var(--color-line-strong); border-radius:var(--radius-control); background:var(--color-surface); color:var(--color-text); font-size:var(--text-md); font-family:inherit; }
    .cm-dialog-foot { display:flex; justify-content:flex-end; gap:var(--space-2); padding:var(--space-3) var(--space-5); border-top:1px solid var(--color-line); }
  `]
})
export class CommitmentsComponent implements OnInit {
  items = signal<Commitment[]>([]);
  summary = signal<Summary | null>(null);
  loading = signal(false);
  saving = signal(false);
  showDialog = signal(false);
  editing = signal<Partial<Commitment>>({});

  search = '';
  categoryFilter = '';
  activeOnly = false;

  categories = ['Fibre', 'Airtime', 'VoIP', 'DebitOrder', 'Rent', 'Insurance', 'Subscription', 'Utility', 'Other'];

  kpis = computed<KpiItem[]>(() => {
    const s = this.summary();
    if (!s) return [];
    return [
      { label: 'Monthly total', value: formatMoney(s.monthlyTotal), note: `${formatMoney(s.annualTotal)} / year` },
      { label: 'Active', value: s.activeCount, note: `${s.inactiveCount} paused` },
      ...s.byCategory.slice(0, 3).map(c => ({ label: c.category, value: formatMoney(c.monthlyTotal), note: `${c.count} item(s)` }))
    ];
  });

  constructor(private http: HttpClient, private readonly toast: ToastService, private router: Router, private readonly confirmDialog: ConfirmService) {}

  get hasFilters(): boolean { return !!(this.search || this.categoryFilter || this.activeOnly); }

  clearFilters(): void {
    this.search = '';
    this.categoryFilter = '';
    this.activeOnly = false;
    this.load();
  }

  goBack(): void { this.router.navigate(['/finance']); }

  ngOnInit(): void { this.load(); this.loadSummary(); }

  load(): void {
    this.loading.set(true);
    let url = `${environment.apiUrl}/finance/recurring-payments?`;
    if (this.categoryFilter) url += `category=${encodeURIComponent(this.categoryFilter)}&`;
    if (this.activeOnly) url += `activeOnly=true&`;
    if (this.search) url += `search=${encodeURIComponent(this.search)}&`;
    this.http.get<Commitment[]>(url).subscribe({
      next: (r) => { this.items.set(r || []); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error("Couldn't load commitments. Refresh the page to try again."); }
    });
  }

  loadSummary(): void {
    this.http.get<Summary>(`${environment.apiUrl}/finance/recurring-payments/summary`).subscribe({
      next: (s) => this.summary.set(s),
      error: () => {}
    });
  }

  openNew(): void {
    this.editing.set({ name: '', category: 'Fibre', amount: 0, currency: 'ZAR', frequency: 'Monthly', isActive: true });
    this.showDialog.set(true);
  }

  openEdit(c: Commitment): void {
    this.editing.set({ ...c });
    this.showDialog.set(true);
  }

  closeDialog(): void { this.showDialog.set(false); }

  save(): void {
    const e = this.editing();
    if (!e.name) return;
    this.saving.set(true);
    const body = {
      name: e.name, supplier: e.supplier, category: e.category, amount: e.amount,
      currency: e.currency || 'ZAR', frequency: e.frequency || 'Monthly', dayOfMonth: e.dayOfMonth,
      departmentId: e.departmentId, companyName: e.companyName, paymentMethod: e.paymentMethod,
      accountReference: e.accountReference, isActive: e.isActive, notes: e.notes
    };
    const req = e.id
      ? this.http.put(`${environment.apiUrl}/finance/recurring-payments/${e.id}`, body)
      : this.http.post(`${environment.apiUrl}/finance/recurring-payments`, body);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showDialog.set(false);
        this.toast.done('Commitment saved');
        this.load(); this.loadSummary();
      },
      error: (err) => { this.saving.set(false); this.toast.error(err?.error?.error || "Couldn't save the commitment. Try again."); }
    });
  }

  toggle(c: Commitment): void {
    this.http.put(`${environment.apiUrl}/finance/recurring-payments/${c.id}/toggle`, {}).subscribe({
      next: () => { this.load(); this.loadSummary(); },
      error: () => this.toast.error("Couldn't change the commitment. Try again.")
    });
  }

  async remove(c: Commitment): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Delete commitment "${c.name}"?`,
      confirmText: 'Delete commitment',
      danger: true
    }))) return;
    this.http.delete(`${environment.apiUrl}/finance/recurring-payments/${c.id}`).subscribe({
      next: () => { this.toast.done('Commitment deleted'); this.load(); this.loadSummary(); },
      error: () => this.toast.error("Couldn't delete the commitment. Try again.")
    });
  }
}
