import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../ui/confirm.service';

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
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatProgressSpinnerModule, MatTooltipModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="cm-container">
      <button class="cm-back" (click)="goBack()">
        <mat-icon>arrow_back</mat-icon> Back to Finance
      </button>
      <div class="cm-header">
        <div class="cm-title">
          <div class="cm-icon-wrap"><mat-icon>event_repeat</mat-icon></div>
          <div>
            <h1>Monthly Commitments</h1>
            <p>Recurring debit orders & subscriptions — fibre, VoIP airtime, insurance, rent</p>
          </div>
        </div>
        <button mat-raised-button color="primary" (click)="openNew()">
          <mat-icon>add</mat-icon> New Commitment
        </button>
      </div>

      <!-- Summary cards -->
      @if (summary(); as s) {
        <div class="cm-summary">
          <div class="cm-card total">
            <span class="cm-card-label">Monthly Total</span>
            <span class="cm-card-value">{{ s.monthlyTotal | currency:'ZAR':'symbol':'1.2-2' }}</span>
            <span class="cm-card-sub">{{ s.annualTotal | currency:'ZAR':'symbol':'1.0-0' }} / year</span>
          </div>
          <div class="cm-card">
            <span class="cm-card-label">Active</span>
            <span class="cm-card-value">{{ s.activeCount }}</span>
            <span class="cm-card-sub">{{ s.inactiveCount }} paused</span>
          </div>
          @for (c of s.byCategory.slice(0, 3); track c.category) {
            <div class="cm-card cat">
              <span class="cm-card-label">{{ c.category }}</span>
              <span class="cm-card-value">{{ c.monthlyTotal | currency:'ZAR':'symbol':'1.0-0' }}</span>
              <span class="cm-card-sub">{{ c.count }} item(s)</span>
            </div>
          }
        </div>
      }

      <!-- Filters -->
      <div class="cm-filters">
        <div class="cm-search">
          <mat-icon>search</mat-icon>
          <input type="text" [(ngModel)]="search" (ngModelChange)="load()" placeholder="Search name, supplier…" />
        </div>
        <select [(ngModel)]="categoryFilter" (ngModelChange)="load()">
          <option value="">All Categories</option>
          @for (cat of categories; track cat) { <option [value]="cat">{{ cat }}</option> }
        </select>
        <label class="cm-active-toggle">
          <input type="checkbox" [(ngModel)]="activeOnly" (ngModelChange)="load()" /> Active only
        </label>
      </div>

      <!-- Table -->
      @if (loading()) {
        <div class="cm-loading"><mat-spinner diameter="40"></mat-spinner></div>
      } @else if (items().length === 0) {
        <div class="cm-empty">
          <mat-icon>event_busy</mat-icon>
          <h3>No commitments yet</h3>
          <p>Add your first recurring monthly payment to start tracking cash-flow.</p>
        </div>
      } @else {
        <div class="cm-table-wrap">
          <table class="cm-table">
            <thead>
              <tr>
                <th>Name</th><th>Category</th><th>Supplier</th><th>Amount</th>
                <th>Frequency</th><th>Debit Day</th><th>Method</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of items(); track c.id) {
                <tr [class.paused]="!c.isActive">
                  <td class="cm-name">{{ c.name }}</td>
                  <td><span class="cm-chip cat-{{ c.category.toLowerCase() }}">{{ c.category }}</span></td>
                  <td>{{ c.supplier || '—' }}</td>
                  <td class="cm-amount">{{ c.amount | currency:c.currency:'symbol':'1.2-2' }}</td>
                  <td>{{ c.frequency }}</td>
                  <td>{{ c.dayOfMonth ? ('Day ' + c.dayOfMonth) : '—' }}</td>
                  <td>{{ c.paymentMethod || '—' }}</td>
                  <td>
                    <span class="cm-status" [class.on]="c.isActive" [class.off]="!c.isActive">
                      {{ c.isActive ? 'Active' : 'Paused' }}
                    </span>
                  </td>
                  <td>
                    <div class="cm-actions">
                      <button aria-label="Edit" class="cm-act edit" (click)="openEdit(c)" matTooltip="Edit"><mat-icon>edit</mat-icon></button>
                      <button [attr.aria-label]="c.isActive ? 'Pause' : 'Activate'" class="cm-act toggle" (click)="toggle(c)" [matTooltip]="c.isActive ? 'Pause' : 'Activate'">
                        <mat-icon>{{ c.isActive ? 'pause_circle' : 'play_circle' }}</mat-icon>
                      </button>
                      <button aria-label="Delete" class="cm-act del" (click)="remove(c)" matTooltip="Delete"><mat-icon>delete</mat-icon></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- Edit / New dialog -->
    @if (showDialog()) {
      <div class="cm-overlay" (click)="closeDialog()">
        <div class="cm-dialog" (click)="$event.stopPropagation()">
          <div class="cm-dialog-head">
            <h2>{{ editing().id ? 'Edit Commitment' : 'New Commitment' }}</h2>
            <button aria-label="Close" class="cm-close" (click)="closeDialog()"><mat-icon>close</mat-icon></button>
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
                <label>Debit Day</label>
                <input type="number" min="1" max="31" [(ngModel)]="editing().dayOfMonth" placeholder="1-31" />
              </div>
            </div>
            <div class="cm-row">
              <div class="cm-field">
                <label>Payment Method</label>
                <input type="text" [(ngModel)]="editing().paymentMethod" placeholder="Debit Order / EFT / Card" />
              </div>
              <div class="cm-field">
                <label>Account / Reference</label>
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
            <button mat-raised-button color="primary" (click)="save()" [disabled]="saving() || !editing().name">
              @if (saving()) { <mat-spinner diameter="18"></mat-spinner> } @else { Save }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:linear-gradient(135deg,var(--color-ok) 0%,#0d9488 100%); }
    .cm-container { max-width:1300px; margin:0 auto; padding:24px 20px 60px; }
    .cm-back { display:inline-flex; align-items:center; gap:6px; margin-bottom:16px; padding:8px 16px 8px 12px; border:none; border-radius:10px; background:var(--color-primary-soft); color:var(--color-primary-hover); font-size:14px; font-weight:600; cursor:pointer; transition:background .15s; }
    .cm-back:hover { background:var(--color-primary-soft); }
    .cm-back mat-icon { font-size:20px; width:20px; height:20px; }
    .cm-header { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
    .cm-title { display:flex; align-items:center; gap:16px; }
    .cm-icon-wrap { width:56px; height:56px; border-radius:16px; background:rgba(255,255,255,.2); display:flex; align-items:center; justify-content:center; }
    .cm-icon-wrap mat-icon { color:#fff; font-size:30px; width:30px; height:30px; }
    .cm-title h1 { margin:0; color:#fff; font-size:24px; font-weight:700; }
    .cm-title p { margin:4px 0 0; color:rgba(255,255,255,.85); font-size:14px; }

    .cm-summary { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:14px; margin-bottom:20px; }
    .cm-card { background:var(--color-surface); border-radius:14px; padding:16px 18px; display:flex; flex-direction:column; gap:2px; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .cm-card.total { background:linear-gradient(135deg,#065f46,#047857); }
    .cm-card.total .cm-card-label, .cm-card.total .cm-card-value, .cm-card.total .cm-card-sub { color:#fff; }
    .cm-card-label { font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-3); font-weight:600; }
    .cm-card-value { font-size:24px; font-weight:700; color:var(--color-text); }
    .cm-card-sub { font-size:12px; color:var(--color-text-3); }

    .cm-filters { display:flex; gap:12px; align-items:center; margin-bottom:16px; flex-wrap:wrap; background:var(--color-surface); padding:12px 16px; border-radius:12px; }
    .cm-search { display:flex; align-items:center; gap:8px; flex:1; min-width:220px; }
    .cm-search mat-icon { color:var(--color-text-3); }
    .cm-search input { border:none; outline:none; font-size:14px; width:100%; }
    .cm-filters select { padding:8px 10px; border:1px solid var(--color-line); border-radius:8px; font-size:14px; }
    .cm-active-toggle { display:flex; align-items:center; gap:6px; font-size:14px; color:var(--color-text-2); cursor:pointer; }

    .cm-loading, .cm-empty { background:var(--color-surface); border-radius:14px; padding:48px; text-align:center; color:var(--color-text-3); display:flex; flex-direction:column; align-items:center; gap:10px; }
    .cm-empty mat-icon { font-size:48px; width:48px; height:48px; color:var(--color-line-strong); }

    .cm-table-wrap { background:var(--color-surface); border-radius:14px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.08); }
    .cm-table { width:100%; border-collapse:collapse; }
    .cm-table th { text-align:left; padding:14px 16px; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:var(--color-text-3); background:var(--color-canvas); border-bottom:1px solid var(--color-line); }
    .cm-table td { padding:14px 16px; font-size:14px; color:var(--color-text-2); border-bottom:1px solid var(--color-surface-2); }
    .cm-table tr.paused { opacity:.55; }
    .cm-name { font-weight:600; color:var(--color-text); }
    .cm-amount { font-weight:700; color:var(--color-ok); }
    .cm-chip { padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600; background:var(--color-primary-soft); color:var(--color-primary); }
    .cm-chip.cat-fibre { background:var(--color-primary-soft); color:#0369a1; }
    .cm-chip.cat-airtime, .cm-chip.cat-voip { background:var(--color-cat-purple-soft); color:#6d28d9; }
    .cm-chip.cat-debitorder { background:#fce7f3; color:#be185d; }
    .cm-chip.cat-rent { background:var(--color-warn-soft); color:#b45309; }
    .cm-chip.cat-insurance { background:var(--color-ok-soft); color:#15803d; }
    .cm-status { padding:3px 10px; border-radius:12px; font-size:12px; font-weight:600; }
    .cm-status.on { background:var(--color-ok-soft); color:#15803d; }
    .cm-status.off { background:var(--color-danger-soft); color:var(--color-danger); }
    .cm-actions { display:flex; gap:6px; }
    .cm-act { width:32px; height:32px; border:none; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all .15s; }
    .cm-act mat-icon { font-size:18px; width:18px; height:18px; }
    .cm-act.edit { background:rgba(99,102,241,.12); color:var(--color-primary); }
    .cm-act.toggle { background:rgba(245,158,11,.12); color:var(--color-warn); }
    .cm-act.del { background:rgba(239,68,68,.12); color:var(--color-danger); }
    .cm-act:hover { transform:scale(1.1); }

    .cm-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px; }
    .cm-dialog { background:var(--color-surface); border-radius:16px; width:600px; max-width:95vw; max-height:90vh; overflow-y:auto; }
    .cm-dialog-head { display:flex; justify-content:space-between; align-items:center; padding:20px 24px; border-bottom:1px solid var(--color-line); }
    .cm-dialog-head h2 { margin:0; font-size:20px; }
    .cm-close { background:none; border:none; cursor:pointer; color:var(--color-text-3); }
    .cm-dialog-body { padding:20px 24px; display:flex; flex-direction:column; gap:14px; }
    .cm-row { display:flex; gap:12px; }
    .cm-field { display:flex; flex-direction:column; gap:6px; flex:1; }
    .cm-field label { font-size:13px; font-weight:600; color:var(--color-text-2); }
    .cm-field input, .cm-field select, .cm-field textarea { padding:9px 10px; border:1px solid var(--color-line-strong); border-radius:8px; font-size:14px; font-family:inherit; }
    .cm-dialog-foot { display:flex; justify-content:flex-end; gap:8px; padding:16px 24px; border-top:1px solid var(--color-line); }
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

  constructor(private http: HttpClient, private snack: MatSnackBar, private router: Router, private readonly confirmDialog: ConfirmService) {}

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
      error: () => { this.loading.set(false); this.snack.open('Failed to load commitments', 'Close', { duration: 3000 }); }
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
        this.snack.open('Commitment saved', 'Close', { duration: 2500 });
        this.load(); this.loadSummary();
      },
      error: (err) => { this.saving.set(false); this.snack.open(err?.error?.error || 'Failed to save', 'Close', { duration: 4000 }); }
    });
  }

  toggle(c: Commitment): void {
    this.http.put(`${environment.apiUrl}/finance/recurring-payments/${c.id}/toggle`, {}).subscribe({
      next: () => { this.load(); this.loadSummary(); },
      error: () => this.snack.open('Failed to toggle', 'Close', { duration: 3000 })
    });
  }

  async remove(c: Commitment): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Delete commitment "${c.name}"?`,
      confirmText: 'Delete commitment',
      danger: true
    }))) return;
    this.http.delete(`${environment.apiUrl}/finance/recurring-payments/${c.id}`).subscribe({
      next: () => { this.snack.open('Commitment deleted', 'Close', { duration: 2500 }); this.load(); this.loadSummary(); },
      error: () => this.snack.open('Failed to delete', 'Close', { duration: 3000 })
    });
  }
}
