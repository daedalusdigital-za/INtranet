import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MatDialog,
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA
} from '@angular/material/dialog';
import { FinanceService } from '../../../services/finance.service';
import {
  Expense,
  FinanceCategory,
  CreateExpenseDto,
  UpdateExpenseDto
} from '../../../models/finance.model';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../ui/confirm.service';
import { ToastService } from '../../../ui/toast.service';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { ChipTone, StatusChipComponent } from '../../../ui/status-chip/status-chip.component';
import { NavbarComponent } from '../../shared/navbar/navbar.component';

const VAT_RATE = 0.15; // South African VAT

interface Department {
  departmentId: number;
  name: string;
}

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatDialogModule,
    NavbarComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    SkeletonRowsComponent,
    StatusChipComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <main class="exp-container">
      <app-page-header [crumbs]="['People and money', 'Finance']" title="Expenses and claims"
                       subtitle="Capture, approve and pay company expenses">
        <button mat-stroked-button (click)="goBack()"><mat-icon>arrow_back</mat-icon>Finance overview</button>
        <button mat-flat-button color="primary" (click)="openDialog()"><mat-icon>add</mat-icon>New expense</button>
      </app-page-header>

      <!-- Summary cards -->
      <div class="summary-grid">
        <button type="button" class="sum-card pending" [class.active]="statusFilter === 'Pending'" [attr.aria-pressed]="statusFilter === 'Pending'" (click)="setFilter('Pending')">
          <div class="sum-icon"><mat-icon>pending_actions</mat-icon></div>
          <div class="sum-body">
            <span class="sum-value">{{ totals.pending | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="sum-label">Pending · {{ counts.pending }}</span>
          </div>
        </button>
        <button type="button" class="sum-card approved" [class.active]="statusFilter === 'Approved'" [attr.aria-pressed]="statusFilter === 'Approved'" (click)="setFilter('Approved')">
          <div class="sum-icon"><mat-icon>verified</mat-icon></div>
          <div class="sum-body">
            <span class="sum-value">{{ totals.approved | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="sum-label">Approved · {{ counts.approved }}</span>
          </div>
        </button>
        <button type="button" class="sum-card paid" [class.active]="statusFilter === 'Paid'" [attr.aria-pressed]="statusFilter === 'Paid'" (click)="setFilter('Paid')">
          <div class="sum-icon"><mat-icon>task_alt</mat-icon></div>
          <div class="sum-body">
            <span class="sum-value">{{ totals.paid | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="sum-label">Paid · {{ counts.paid }}</span>
          </div>
        </button>
        <button type="button" class="sum-card all" [class.active]="statusFilter === ''" [attr.aria-pressed]="statusFilter === ''" (click)="setFilter('')">
          <div class="sum-icon"><mat-icon>summarize</mat-icon></div>
          <div class="sum-body">
            <span class="sum-value">{{ totals.all | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="sum-label">All · {{ counts.all }}</span>
          </div>
        </button>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input type="text" aria-label="Search expenses" placeholder="Search vendor, description, number…"
                 [(ngModel)]="search" (ngModelChange)="applyFilters()" />
        </div>
        <div class="chip-filters">
          <button class="chip" [class.on]="statusFilter === ''" (click)="setFilter('')">All</button>
          <button class="chip" [class.on]="statusFilter === 'Pending'" (click)="setFilter('Pending')">Pending</button>
          <button class="chip" [class.on]="statusFilter === 'Approved'" (click)="setFilter('Approved')">Approved</button>
          <button class="chip" [class.on]="statusFilter === 'Paid'" (click)="setFilter('Paid')">Paid</button>
          <button class="chip" [class.on]="statusFilter === 'Rejected'" (click)="setFilter('Rejected')">Rejected</button>
        </div>
      </div>

      <!-- Table -->
      <div class="table-wrap">
        @if (loading) {
          <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows>
        } @else if (filtered.length === 0) {
          @if (expenses.length === 0) {
            <app-empty-state icon="receipt_long" title="No expenses yet"
                             message="Capture an expense to start tracking claims and company spend.">
              <button mat-flat-button color="primary" (click)="openDialog()"><mat-icon>add</mat-icon>Capture your first expense</button>
            </app-empty-state>
          } @else {
            <app-empty-state icon="filter_alt_off" title="No expenses match"
                             message="Nothing fits the status or search you have chosen.">
              <button mat-stroked-button (click)="clearFilters()">Show all expenses</button>
            </app-empty-state>
          }
        } @else {
          <div class="table-scroll">
            <table class="app-table">
              <thead>
                <tr>
                  <th>Expense #</th>
                  <th>Vendor / Description</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th class="num">Amount</th>
                  <th class="num">VAT</th>
                  <th class="num">Total</th>
                  <th>Status</th>
                  <th class="actions-col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let e of filtered">
                  <td class="ref">{{ e.expenseNumber }}</td>
                  <td>
                    <div class="vend">{{ e.vendor }}</div>
                    <small>{{ e.description }}</small>
                  </td>
                  <td>{{ e.categoryName || '—' }}</td>
                  <td>{{ e.department || '—' }}</td>
                  <td>{{ e.expenseDate | date:'dd MMM yyyy' }}</td>
                  <td class="num">{{ e.amount | currency:'ZAR':'symbol':'1.2-2' }}</td>
                  <td class="num">{{ (e.vatAmount || 0) | currency:'ZAR':'symbol':'1.2-2' }}</td>
                  <td class="num strong">{{ e.totalAmount | currency:'ZAR':'symbol':'1.2-2' }}</td>
                  <td><app-status-chip [status]="e.status" [tone]="statusTone(e.status)"></app-status-chip></td>
                  <td class="actions-col">
                    <button [attr.aria-label]="'Actions for ' + e.expenseNumber" mat-icon-button [matMenuTriggerFor]="menu"><mat-icon>more_vert</mat-icon></button>
                    <mat-menu #menu="matMenu">
                      <button mat-menu-item (click)="openDialog(e)">
                        <mat-icon>edit</mat-icon><span>Edit</span>
                      </button>
                      <button mat-menu-item *ngIf="e.status === 'Pending'" (click)="setStatus(e, 'Approved')">
                        <mat-icon color="primary">check_circle</mat-icon><span>Approve</span>
                      </button>
                      <button mat-menu-item *ngIf="e.status === 'Pending' || e.status === 'Approved'" (click)="setStatus(e, 'Rejected')">
                        <mat-icon color="warn">cancel</mat-icon><span>Reject</span>
                      </button>
                      <button mat-menu-item *ngIf="e.status === 'Approved'" (click)="markPaid(e)">
                        <mat-icon>payments</mat-icon><span>Mark paid</span>
                      </button>
                      <button mat-menu-item *ngIf="e.receiptFileName" (click)="downloadReceipt(e)">
                        <mat-icon>download</mat-icon><span>Receipt</span>
                      </button>
                      <button mat-menu-item (click)="remove(e)">
                        <mat-icon color="warn">delete</mat-icon><span>Delete</span>
                      </button>
                    </mat-menu>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        }
      </div>
    </main>
  `,
  styles: [`
    :host { display:block; }
    .exp-container { max-width:1320px; margin:0 auto; padding:var(--space-5) var(--space-5) var(--space-8); display:grid; gap:var(--space-4); }
    @media (max-width:600px) { .exp-container { padding:var(--space-4) var(--space-4) var(--space-6); } }

    .summary-grid { display:grid; grid-template-columns: repeat(4,1fr); gap:var(--space-4); }
    .sum-card { display:flex; align-items:center; gap:14px; padding:var(--space-3) var(--space-4); background:var(--color-surface); border:1px solid var(--color-line); border-radius:var(--radius-md); cursor:pointer; text-align:left; font-family:inherit; color:inherit; transition:border-color .15s, box-shadow .15s; }
    .sum-card:hover { border-color:var(--color-line-strong); box-shadow:var(--shadow-sm); }
    .sum-card.active { border-color:var(--color-primary); box-shadow:0 0 0 1px var(--color-primary); }
    .sum-icon { width:44px; height:44px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; }
    .sum-card.pending .sum-icon { background:var(--color-warn-soft); color:var(--color-warn); }
    .sum-card.approved .sum-icon { background:var(--color-primary-soft); color:var(--color-primary); }
    .sum-card.paid .sum-icon { background:var(--color-ok-soft); color:var(--color-ok); }
    .sum-card.all .sum-icon { background:var(--color-primary-soft); color:var(--color-primary); }
    .sum-body { display:flex; flex-direction:column; }
    .sum-value { font-size:var(--text-2xl); font-weight:700; color:var(--color-text); font-variant-numeric:tabular-nums; }
    .sum-label { font-size:var(--text-sm); color:var(--color-text-3); }

    .toolbar { display:flex; justify-content:space-between; align-items:center; gap:var(--space-4); flex-wrap:wrap; }
    .search-box { display:flex; align-items:center; gap:var(--space-2); background:var(--color-surface); border:1px solid var(--color-line-strong); border-radius:var(--radius-control); padding:6px 12px; min-width:320px; flex:1; max-width:420px; }
    .search-box:focus-within { border-color:var(--color-primary); box-shadow:0 0 0 3px var(--color-primary-soft); }
    .search-box mat-icon { color:var(--color-text-3); }
    .search-box input { border:none; outline:none; flex:1; font-size:var(--text-md); background:transparent; color:var(--color-text); }
    .chip-filters { display:flex; gap:var(--space-2); flex-wrap:wrap; }
    .chip { border:1px solid var(--color-line); background:var(--color-surface); border-radius:999px; padding:6px 14px; font-size:var(--text-sm); cursor:pointer; color:var(--color-text-2); font-family:inherit; transition:background .15s, color .15s; }
    .chip.on { background:var(--color-primary); border-color:var(--color-primary); color:var(--color-on-primary); }

    .table-wrap { background:var(--color-surface); border:1px solid var(--color-line); border-radius:var(--radius-md); overflow:hidden; }
    .table-scroll { overflow-x:auto; }
    .app-table td { vertical-align:top; }
    .vend { font-weight:600; color:var(--color-text); }
    .num.strong { font-weight:700; color:var(--color-text); }
    .actions-col { text-align:center; width:60px; }

    @media (max-width: 900px) {
      .summary-grid { grid-template-columns: repeat(2,1fr); }
    }
  `]
})
export class ExpensesComponent implements OnInit {
  expenses: Expense[] = [];
  filtered: Expense[] = [];
  loading = false;
  statusFilter = '';
  search = '';

  totals = { pending: 0, approved: 0, paid: 0, all: 0 };
  counts = { pending: 0, approved: 0, paid: 0, all: 0 };

  constructor(
    private financeService: FinanceService,
    private dialog: MatDialog,
    private readonly toast: ToastService,
    private router: Router,
    private readonly confirmDialog: ConfirmService
  ) {}

  ngOnInit(): void {
    this.loadExpenses();
  }

  goBack(): void { this.router.navigate(['/finance']); }

  loadExpenses(): void {
    this.loading = true;
    this.financeService.getExpenses().subscribe({
      next: (expenses) => {
        this.expenses = expenses || [];
        this.computeTotals();
        this.applyFilters();
        this.loading = false;
      },
      error: () => {
        this.toast.error("Couldn't load expenses. Refresh the page to try again.");
        this.loading = false;
      }
    });
  }

  computeTotals(): void {
    const t = { pending: 0, approved: 0, paid: 0, all: 0 };
    const c = { pending: 0, approved: 0, paid: 0, all: 0 };
    for (const e of this.expenses) {
      t.all += e.totalAmount; c.all++;
      if (e.status === 'Pending') { t.pending += e.totalAmount; c.pending++; }
      else if (e.status === 'Approved') { t.approved += e.totalAmount; c.approved++; }
      else if (e.status === 'Paid') { t.paid += e.totalAmount; c.paid++; }
    }
    this.totals = t; this.counts = c;
  }

  setFilter(status: string): void { this.statusFilter = status; this.applyFilters(); }

  clearFilters(): void { this.statusFilter = ''; this.search = ''; this.applyFilters(); }

  statusTone(status: string): ChipTone {
    switch (status) {
      case 'Pending': return 'warn';
      case 'Approved': return 'info';
      case 'Paid': return 'ok';
      case 'Rejected': return 'danger';
      default: return 'neutral';
    }
  }

  applyFilters(): void {
    const q = this.search.trim().toLowerCase();
    this.filtered = this.expenses.filter(e => {
      const matchStatus = !this.statusFilter || e.status === this.statusFilter;
      const matchSearch = !q ||
        e.vendor?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.expenseNumber?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }

  openDialog(expense?: Expense): void {
    const ref = this.dialog.open(ExpenseDialogComponent, {
      width: '620px',
      maxWidth: '95vw',
      data: { expense }
    });
    ref.afterClosed().subscribe(saved => { if (saved) this.loadExpenses(); });
  }

  setStatus(e: Expense, status: 'Approved' | 'Rejected'): void {
    this.financeService.updateExpense(e.id, { status }).subscribe({
      next: () => {
        e.status = status;
        this.computeTotals(); this.applyFilters();
        this.toast.done(`Expense ${status.toLowerCase()}`);
      },
      error: () => this.toast.error("Couldn't update the expense. Try again.")
    });
  }

  markPaid(e: Expense): void {
    const dto: UpdateExpenseDto = { status: 'Paid', paymentMethod: 'EFT' };
    this.financeService.updateExpense(e.id, dto).subscribe({
      next: () => {
        e.status = 'Paid';
        this.computeTotals(); this.applyFilters();
        this.toast.done('Expense marked as paid');
      },
      error: () => this.toast.error("Couldn't mark the expense as paid. Try again.")
    });
  }

  downloadReceipt(e: Expense): void {
    window.open(`${environment.apiUrl}/finance/expenses/${e.id}/receipt`, '_blank');
  }

  async remove(e: Expense): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Delete expense ${e.expenseNumber}?`,
      confirmText: 'Delete expense',
      danger: true
    }))) return;
    this.financeService.deleteExpense(e.id).subscribe({
      next: () => {
        this.toast.done('Expense deleted');
        this.loadExpenses();
      },
      error: () => this.toast.error("Couldn't delete the expense. Try again.")
    });
  }
}

// ============================================================================
// Expense create/edit dialog
// ============================================================================

@Component({
  selector: 'app-expense-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEdit ? 'edit' : 'add_circle' }}</mat-icon>
      {{ isEdit ? 'Edit Expense' : 'New Expense' }}
    </h2>

    <mat-dialog-content class="dlg-content">
      <div class="row">
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Vendor / Supplier</mat-label>
          <input matInput [(ngModel)]="model.vendor" placeholder="e.g. Makro" required />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Expense Date</mat-label>
          <input matInput [matDatepicker]="dp" [(ngModel)]="model.expenseDate" required />
          <mat-datepicker-toggle matIconSuffix [for]="dp"></mat-datepicker-toggle>
          <mat-datepicker #dp></mat-datepicker>
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Description</mat-label>
        <input matInput [(ngModel)]="model.description" placeholder="What was this expense for?" required />
      </mat-form-field>

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="model.categoryId">
            <mat-option [value]="undefined">— None —</mat-option>
            <mat-option *ngFor="let c of categories" [value]="c.id">{{ c.name }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Department</mat-label>
          <mat-select [(ngModel)]="model.department">
            <mat-option [value]="undefined">— None —</mat-option>
            <mat-option *ngFor="let d of departments" [value]="d.name">{{ d.name }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>Amount (excl. VAT)</mat-label>
          <span matTextPrefix>R&nbsp;</span>
          <input matInput type="number" [(ngModel)]="model.amount" (ngModelChange)="recalcVat()" required />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>VAT (15%)</mat-label>
          <span matTextPrefix>R&nbsp;</span>
          <input matInput type="number" [(ngModel)]="model.vatAmount" [disabled]="autoVat" />
        </mat-form-field>
        <div class="total-box">
          <span class="tl">Total (incl. VAT)</span>
          <span class="tv">{{ total | currency:'ZAR':'symbol':'1.2-2' }}</span>
        </div>
      </div>

      <div class="vat-toggle">
        <mat-checkbox [(ngModel)]="autoVat" (ngModelChange)="recalcVat()">Auto-calculate VAT at 15%</mat-checkbox>
      </div>

      <div class="row">
        <mat-form-field appearance="outline" class="grow">
          <mat-label>Invoice / Reference Number</mat-label>
          <input matInput [(ngModel)]="model.invoiceNumber" placeholder="Optional" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Due Date</mat-label>
          <input matInput [matDatepicker]="dp2" [(ngModel)]="model.dueDate" />
          <mat-datepicker-toggle matIconSuffix [for]="dp2"></mat-datepicker-toggle>
          <mat-datepicker #dp2></mat-datepicker>
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline" class="full">
        <mat-label>Notes</mat-label>
        <textarea matInput rows="2" [(ngModel)]="model.notes" placeholder="Optional notes"></textarea>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="saving || !isValid()">
        <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
        {{ isEdit ? 'Save Changes' : 'Create Expense' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] { display:flex; align-items:center; gap:10px; font-size:var(--text-2xl); font-weight:700; color:var(--color-text); }
    .dlg-content.mat-mdc-dialog-content { padding-top:8px; }
    .row { display:flex; gap:12px; }
    .row > mat-form-field { flex:1; }
    .row > .grow { flex:2; }
    .full { width:100%; }
    .total-box { flex:1; display:flex; flex-direction:column; justify-content:center; background:var(--color-surface-2); border-radius:8px; padding:8px 14px; margin-bottom:22px; }
    .tl { font-size:var(--text-xs); color:var(--color-text-3); }
    .tv { font-size:var(--text-xl); font-weight:700; color:var(--color-primary); }
    .vat-toggle { margin:-6px 0 12px; }
  `]
})
export class ExpenseDialogComponent implements OnInit {
  isEdit = false;
  saving = false;
  autoVat = true;
  categories: FinanceCategory[] = [];
  departments: Department[] = [];

  model: any = {
    vendor: '',
    description: '',
    categoryId: undefined,
    department: undefined,
    amount: 0,
    vatAmount: 0,
    expenseDate: new Date(),
    dueDate: undefined,
    invoiceNumber: '',
    notes: ''
  };

  constructor(
    private financeService: FinanceService,
    private http: HttpClient,
    private dialogRef: MatDialogRef<ExpenseDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { expense?: Expense }
  ) {}

  ngOnInit(): void {
    this.financeService.getCategories('expense').subscribe({
      next: c => this.categories = c,
      error: () => this.financeService.getCategories().subscribe(c => this.categories = c)
    });
    this.http.get<Department[]>(`${environment.apiUrl}/departments`).subscribe({
      next: d => this.departments = d,
      error: () => {}
    });

    if (this.data?.expense) {
      this.isEdit = true;
      const e = this.data.expense;
      this.model = {
        vendor: e.vendor,
        description: e.description,
        categoryId: e.categoryId,
        department: e.department,
        amount: e.amount,
        vatAmount: e.vatAmount || 0,
        expenseDate: e.expenseDate ? new Date(e.expenseDate) : new Date(),
        dueDate: e.dueDate ? new Date(e.dueDate) : undefined,
        invoiceNumber: e.invoiceNumber,
        notes: e.notes
      };
      const expected = +(this.model.amount * VAT_RATE).toFixed(2);
      this.autoVat = Math.abs((this.model.vatAmount || 0) - expected) < 0.01;
    }
  }

  get total(): number {
    return (+this.model.amount || 0) + (+this.model.vatAmount || 0);
  }

  recalcVat(): void {
    if (this.autoVat) {
      this.model.vatAmount = +((+this.model.amount || 0) * VAT_RATE).toFixed(2);
    }
  }

  isValid(): boolean {
    return !!this.model.vendor && !!this.model.description &&
           (+this.model.amount > 0) && !!this.model.expenseDate;
  }

  private genNumber(): string {
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `EXP-${stamp}-${rand}`;
  }

  save(): void {
    if (!this.isValid()) return;
    this.saving = true;

    if (this.isEdit && this.data.expense) {
      const dto: UpdateExpenseDto = {
        vendor: this.model.vendor,
        description: this.model.description,
        categoryId: this.model.categoryId,
        department: this.model.department,
        amount: +this.model.amount,
        vatAmount: +this.model.vatAmount,
        expenseDate: this.model.expenseDate,
        dueDate: this.model.dueDate,
        invoiceNumber: this.model.invoiceNumber,
        notes: this.model.notes
      };
      this.financeService.updateExpense(this.data.expense.id, dto).subscribe({
        next: () => this.dialogRef.close(true),
        error: () => { this.saving = false; }
      });
    } else {
      const dto: CreateExpenseDto = {
        expenseNumber: this.genNumber(),
        vendor: this.model.vendor,
        description: this.model.description,
        categoryId: this.model.categoryId,
        department: this.model.department,
        amount: +this.model.amount,
        vatAmount: +this.model.vatAmount,
        currency: 'ZAR',
        expenseDate: this.model.expenseDate,
        dueDate: this.model.dueDate,
        invoiceNumber: this.model.invoiceNumber,
        notes: this.model.notes
      };
      this.financeService.createExpense(dto).subscribe({
        next: () => this.dialogRef.close(true),
        error: () => { this.saving = false; }
      });
    }
  }

  close(): void { this.dialogRef.close(false); }
}
