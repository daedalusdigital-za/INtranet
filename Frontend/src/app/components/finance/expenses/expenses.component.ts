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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FinanceService } from '../../../services/finance.service';
import {
  Expense,
  FinanceCategory,
  CreateExpenseDto,
  UpdateExpenseDto
} from '../../../models/finance.model';
import { environment } from '../../../../environments/environment';
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
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="exp-container">
      <!-- Header -->
      <div class="exp-header">
        <div class="exp-header-left">
          <button mat-icon-button class="back-btn" (click)="goBack()" matTooltip="Back to Finance">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="exp-icon-ring"><mat-icon>receipt_long</mat-icon></div>
          <div>
            <h1>Expenses & Claims</h1>
            <p>Capture, approve and pay company expenses</p>
          </div>
        </div>
        <button mat-flat-button class="new-btn" (click)="openDialog()">
          <mat-icon>add</mat-icon> New Expense
        </button>
      </div>

      <!-- Summary cards -->
      <div class="summary-grid">
        <div class="sum-card pending" [class.active]="statusFilter === 'Pending'" (click)="setFilter('Pending')">
          <div class="sum-icon"><mat-icon>pending_actions</mat-icon></div>
          <div class="sum-body">
            <span class="sum-value">{{ totals.pending | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="sum-label">Pending · {{ counts.pending }}</span>
          </div>
        </div>
        <div class="sum-card approved" [class.active]="statusFilter === 'Approved'" (click)="setFilter('Approved')">
          <div class="sum-icon"><mat-icon>verified</mat-icon></div>
          <div class="sum-body">
            <span class="sum-value">{{ totals.approved | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="sum-label">Approved · {{ counts.approved }}</span>
          </div>
        </div>
        <div class="sum-card paid" [class.active]="statusFilter === 'Paid'" (click)="setFilter('Paid')">
          <div class="sum-icon"><mat-icon>task_alt</mat-icon></div>
          <div class="sum-body">
            <span class="sum-value">{{ totals.paid | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="sum-label">Paid · {{ counts.paid }}</span>
          </div>
        </div>
        <div class="sum-card all" [class.active]="statusFilter === ''" (click)="setFilter('')">
          <div class="sum-icon"><mat-icon>summarize</mat-icon></div>
          <div class="sum-body">
            <span class="sum-value">{{ totals.all | currency:'ZAR':'symbol':'1.0-0' }}</span>
            <span class="sum-label">All · {{ counts.all }}</span>
          </div>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-box">
          <mat-icon>search</mat-icon>
          <input type="text" placeholder="Search vendor, description, number…"
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
        <div *ngIf="loading" class="loading"><mat-spinner diameter="40"></mat-spinner></div>

        <table *ngIf="!loading" class="exp-table">
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
              <th class="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let e of filtered">
              <td class="mono">{{ e.expenseNumber }}</td>
              <td>
                <div class="vend">{{ e.vendor }}</div>
                <div class="desc">{{ e.description }}</div>
              </td>
              <td>{{ e.categoryName || '—' }}</td>
              <td>{{ e.department || '—' }}</td>
              <td>{{ e.expenseDate | date:'dd MMM yyyy' }}</td>
              <td class="num">{{ e.amount | currency:'ZAR':'symbol':'1.2-2' }}</td>
              <td class="num">{{ (e.vatAmount || 0) | currency:'ZAR':'symbol':'1.2-2' }}</td>
              <td class="num strong">{{ e.totalAmount | currency:'ZAR':'symbol':'1.2-2' }}</td>
              <td>
                <span class="status-badge" [ngClass]="e.status.toLowerCase()">{{ e.status }}</span>
              </td>
              <td class="actions-col">
                <button mat-icon-button [matMenuTriggerFor]="menu"><mat-icon>more_vert</mat-icon></button>
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
                    <mat-icon>payments</mat-icon><span>Mark Paid</span>
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
            <tr *ngIf="filtered.length === 0">
              <td colspan="10" class="empty">
                <mat-icon>inbox</mat-icon>
                <p>No expenses{{ statusFilter ? ' with status ' + statusFilter : '' }} yet.</p>
                <button mat-stroked-button (click)="openDialog()"><mat-icon>add</mat-icon> Capture your first expense</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .exp-container { max-width: 1400px; margin: 0 auto; padding: 24px; }
    .exp-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .exp-header-left { display: flex; align-items: center; gap: 16px; }
    .back-btn { color: #64748b; }
    .exp-icon-ring { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg,#6366f1,#4f46e5); display:flex; align-items:center; justify-content:center; }
    .exp-icon-ring mat-icon { color:#fff; font-size:28px; width:28px; height:28px; }
    .exp-header h1 { margin:0; font-size:26px; font-weight:700; color:#0f172a; }
    .exp-header p { margin:2px 0 0; color:#64748b; font-size:14px; }
    .new-btn { background: linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; height:44px; border-radius:12px; padding:0 20px; font-weight:600; }

    .summary-grid { display:grid; grid-template-columns: repeat(4,1fr); gap:16px; margin-bottom:24px; }
    .sum-card { display:flex; align-items:center; gap:14px; padding:18px; background:#fff; border:1px solid #e2e8f0; border-radius:16px; cursor:pointer; transition:all .18s; }
    .sum-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,.06); }
    .sum-card.active { border-color:#6366f1; box-shadow:0 0 0 2px rgba(99,102,241,.15); }
    .sum-icon { width:48px; height:48px; border-radius:12px; display:flex; align-items:center; justify-content:center; }
    .sum-card.pending .sum-icon { background:#fef3c7; color:#d97706; }
    .sum-card.approved .sum-icon { background:#dbeafe; color:#2563eb; }
    .sum-card.paid .sum-icon { background:#dcfce7; color:#16a34a; }
    .sum-card.all .sum-icon { background:#e0e7ff; color:#4f46e5; }
    .sum-body { display:flex; flex-direction:column; }
    .sum-value { font-size:20px; font-weight:700; color:#0f172a; }
    .sum-label { font-size:13px; color:#64748b; }

    .toolbar { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:16px; flex-wrap:wrap; }
    .search-box { display:flex; align-items:center; gap:8px; background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:8px 14px; min-width:320px; flex:1; max-width:420px; }
    .search-box mat-icon { color:#94a3b8; }
    .search-box input { border:none; outline:none; flex:1; font-size:14px; background:transparent; }
    .chip-filters { display:flex; gap:8px; flex-wrap:wrap; }
    .chip { border:1px solid #e2e8f0; background:#fff; border-radius:999px; padding:6px 14px; font-size:13px; cursor:pointer; color:#475569; transition:all .15s; }
    .chip.on { background:#4f46e5; border-color:#4f46e5; color:#fff; }

    .table-wrap { background:#fff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; }
    .loading { display:flex; justify-content:center; padding:60px; }
    .exp-table { width:100%; border-collapse:collapse; }
    .exp-table thead th { text-align:left; padding:14px 16px; font-size:12px; text-transform:uppercase; letter-spacing:.04em; color:#64748b; background:#f8fafc; border-bottom:1px solid #e2e8f0; }
    .exp-table th.num, .exp-table td.num { text-align:right; }
    .exp-table tbody td { padding:14px 16px; border-bottom:1px solid #f1f5f9; font-size:14px; color:#334155; vertical-align:top; }
    .exp-table tbody tr:hover { background:#f8fafc; }
    .mono { font-family:'SF Mono',Menlo,monospace; font-size:13px; color:#6366f1; font-weight:600; }
    .vend { font-weight:600; color:#0f172a; }
    .desc { font-size:12.5px; color:#94a3b8; margin-top:2px; }
    .num.strong { font-weight:700; color:#0f172a; }
    .actions-col { text-align:center; width:60px; }
    .status-badge { padding:4px 10px; border-radius:999px; font-size:12px; font-weight:600; text-transform:capitalize; }
    .status-badge.pending { background:#fef3c7; color:#b45309; }
    .status-badge.approved { background:#dbeafe; color:#1d4ed8; }
    .status-badge.paid { background:#dcfce7; color:#15803d; }
    .status-badge.rejected { background:#fee2e2; color:#b91c1c; }
    .empty { text-align:center; padding:60px 20px; color:#94a3b8; }
    .empty mat-icon { font-size:48px; width:48px; height:48px; color:#cbd5e1; }
    .empty p { margin:12px 0; }

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
    private snackBar: MatSnackBar,
    private router: Router
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
        this.snackBar.open('Failed to load expenses', 'Close', { duration: 3000 });
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
        this.snackBar.open(`Expense ${status.toLowerCase()}`, 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to update expense', 'Close', { duration: 3000 })
    });
  }

  markPaid(e: Expense): void {
    const dto: UpdateExpenseDto = { status: 'Paid', paymentMethod: 'EFT' };
    this.financeService.updateExpense(e.id, dto).subscribe({
      next: () => {
        e.status = 'Paid';
        this.computeTotals(); this.applyFilters();
        this.snackBar.open('Expense marked as paid', 'Close', { duration: 2000 });
      },
      error: () => this.snackBar.open('Failed to mark as paid', 'Close', { duration: 3000 })
    });
  }

  downloadReceipt(e: Expense): void {
    window.open(`${environment.apiUrl}/finance/expenses/${e.id}/receipt`, '_blank');
  }

  remove(e: Expense): void {
    if (!confirm(`Delete expense "${e.expenseNumber}"?`)) return;
    this.financeService.deleteExpense(e.id).subscribe({
      next: () => {
        this.snackBar.open('Expense deleted', 'Close', { duration: 2000 });
        this.loadExpenses();
      },
      error: () => this.snackBar.open('Failed to delete expense', 'Close', { duration: 3000 })
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
    h2[mat-dialog-title] { display:flex; align-items:center; gap:10px; font-size:20px; font-weight:700; color:#0f172a; }
    .dlg-content { padding-top:8px !important; }
    .row { display:flex; gap:12px; }
    .row > mat-form-field { flex:1; }
    .grow { flex:2 !important; }
    .full { width:100%; }
    .total-box { flex:1; display:flex; flex-direction:column; justify-content:center; background:#f1f5f9; border-radius:8px; padding:8px 14px; margin-bottom:22px; }
    .tl { font-size:12px; color:#64748b; }
    .tv { font-size:18px; font-weight:700; color:#4f46e5; }
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
