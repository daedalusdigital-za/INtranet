import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTabsModule } from '@angular/material/tabs';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import {
  ExpenseTrackerService, ExpenseItem, ExpenseCategory, ExpenseSummary
} from '../../services/expense-tracker.service';
import { BooksService } from '../../services/books.service';
import { environment } from '../../../environments/environment';

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-expense-tracker',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatButtonModule, MatIconModule, MatMenuModule, MatDialogModule,
    MatSnackBarModule, MatProgressSpinnerModule, MatTooltipModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatChipsModule,
    MatTabsModule, NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="et-container">

      <!-- Header -->
      <div class="et-header">
        <div class="header-left">
          <button mat-icon-button class="back-btn" (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="header-icon-wrap"><mat-icon>receipt_long</mat-icon></div>
          <div>
            <h1>Expense Tracker</h1>
            <p class="subtitle">{{ departmentName }} &nbsp;•&nbsp; {{ selectedYear }}</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="action-btn" (click)="exportExcel()">
            <mat-icon>download</mat-icon> Export
          </button>
          <button mat-stroked-button class="action-btn" (click)="openUploadDialog()">
            <mat-icon>upload_file</mat-icon> Import Excel
          </button>
          <button mat-stroked-button class="action-btn" (click)="openCategoryDialog()">
            <mat-icon>label</mat-icon> Categories
          </button>
          <button mat-flat-button color="primary" class="add-btn" (click)="openAddDialog()">
            <mat-icon>add</mat-icon> Add Expense
          </button>
        </div>
      </div>

      <!-- Year picker + summary cards -->
      <div class="top-bar">
        <div class="year-nav">
          <button mat-icon-button (click)="changeYear(-1)"><mat-icon>chevron_left</mat-icon></button>
          <span class="year-label">{{ selectedYear }}</span>
          <button mat-icon-button (click)="changeYear(1)"><mat-icon>chevron_right</mat-icon></button>
        </div>
        <div class="summary-cards" *ngIf="summary">
          <div class="s-card total">
            <mat-icon>receipt_long</mat-icon>
            <div><span class="s-val">{{ summary.totalCount }}</span><span class="s-lbl">Total Items</span></div>
          </div>
          <div class="s-card amount">
            <mat-icon>payments</mat-icon>
            <div><span class="s-val">{{ summary.totalAmount | currency:'ZAR':'symbol-narrow':'1.0-0' }}</span><span class="s-lbl">Total Amount</span></div>
          </div>
          <div class="s-card paid">
            <mat-icon>check_circle</mat-icon>
            <div><span class="s-val">{{ summary.paidAmount | currency:'ZAR':'symbol-narrow':'1.0-0' }}</span><span class="s-lbl">Paid</span></div>
          </div>
          <div class="s-card pending">
            <mat-icon>pending</mat-icon>
            <div><span class="s-val">{{ summary.pendingAmount | currency:'ZAR':'symbol-narrow':'1.0-0' }}</span><span class="s-lbl">Pending</span></div>
          </div>
        </div>
      </div>

      <!-- Month tabs -->
      <div class="month-tabs">
        <button class="m-tab" [class.active]="selectedMonth === 0" (click)="selectMonth(0)">All</button>
        <button class="m-tab" *ngFor="let m of months; let i = index"
                [class.active]="selectedMonth === i+1"
                (click)="selectMonth(i+1)">
          {{ m.substr(0,3) }}
          <span class="m-count" *ngIf="getMonthCount(i+1) > 0">{{ getMonthCount(i+1) }}</span>
        </button>
      </div>

      <!-- Filters row -->
      <div class="filters-row">
        <div class="search-wrap">
          <mat-icon class="search-icon">search</mat-icon>
          <input class="search-input" placeholder="Search company, services, invoice…"
                 [(ngModel)]="searchQuery" (ngModelChange)="onSearchChange($event)">
        </div>
        <select class="filter-sel" [(ngModel)]="filterType" (ngModelChange)="loadItems()">
          <option value="">All Types</option>
          <option value="Service">Service</option>
          <option value="PurchaseOrder">Purchase Order</option>
        </select>
        <select class="filter-sel" [(ngModel)]="filterStatus" (ngModelChange)="loadItems()">
          <option value="">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Paid">Paid</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select class="filter-sel" [(ngModel)]="filterCategory" (ngModelChange)="loadItems()">
          <option value="">All Categories</option>
          <option *ngFor="let c of categories" [value]="c.id">{{ c.name }}</option>
        </select>
      </div>

      <!-- Table -->
      <div class="table-wrap" *ngIf="!loading">
        <table class="exp-table" *ngIf="items.length > 0">
          <thead>
            <tr>
              <th (click)="sort('company')">COMPANY <mat-icon class="sort-icon" *ngIf="sortBy==='company'">{{ sortDir==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon></th>
              <th>SERVICES RENDERED</th>
              <th>INVOICED TO</th>
              <th (click)="sort('amount')" class="num-col">AMOUNT <mat-icon class="sort-icon" *ngIf="sortBy==='amount'">{{ sortDir==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon></th>
              <th>PAID BY</th>
              <th>INVOICE NUMBER</th>
              <th (click)="sort('date')" class="date-col">DATE <mat-icon class="sort-icon" *ngIf="sortBy==='date'">{{ sortDir==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon></th>
              <th>TYPE</th>
              <th>CATEGORY</th>
              <th>STATUS</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of items" [class.row-paid]="item.status==='Paid'" [class.row-cancelled]="item.status==='Cancelled'">
              <td class="company-cell">
                <div class="company-name">{{ item.company }}</div>
                <div class="linked-inv" *ngIf="item.bookInvoiceSupplier">
                  <mat-icon>link</mat-icon>{{ item.bookInvoiceSupplier }}
                </div>
              </td>
              <td class="services-cell">{{ item.servicesRendered }}</td>
              <td>{{ item.invoicedTo }}</td>
              <td class="num-col amount-cell">{{ item.amount | currency:'ZAR':'symbol-narrow':'1.2-2' }}</td>
              <td>{{ item.paidBy || '—' }}</td>
              <td class="inv-cell">{{ item.invoiceNumber || '—' }}</td>
              <td class="date-col">{{ item.itemDate | date:'dd MMM yyyy' }}</td>
              <td><span class="type-chip" [class.po]="item.itemType==='PurchaseOrder'">{{ item.itemType === 'PurchaseOrder' ? 'PO' : 'SVC' }}</span></td>
              <td>
                <span class="cat-chip" *ngIf="getCategoryName(item.categoryId)" [style.background]="getCategoryColor(item.categoryId)">{{ getCategoryName(item.categoryId) }}</span>
                <span *ngIf="!getCategoryName(item.categoryId)" class="no-data">—</span>
              </td>
              <td><span class="status-chip" [class]="'status-'+item.status.toLowerCase()">{{ item.status }}</span></td>
              <td class="actions-col">
                <button mat-icon-button [matMenuTriggerFor]="rowMenu" class="row-menu-btn">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #rowMenu="matMenu">
                  <button mat-menu-item (click)="openEditDialog(item)"><mat-icon>edit</mat-icon> Edit</button>
                  <button mat-menu-item (click)="markPaid(item)" *ngIf="item.status !== 'Paid'"><mat-icon>check_circle</mat-icon> Mark Paid</button>
                  <button mat-menu-item (click)="linkInvoice(item)"><mat-icon>link</mat-icon> Link Invoice</button>
                  <mat-divider></mat-divider>
                  <button mat-menu-item (click)="deleteItem(item)" class="delete-menu-item"><mat-icon color="warn">delete</mat-icon> Delete</button>
                </mat-menu>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3"><strong>TOTAL ({{ items.length }} items)</strong></td>
              <td class="num-col"><strong>{{ getPageTotal() | currency:'ZAR':'symbol-narrow':'1.2-2' }}</strong></td>
              <td colspan="7"></td>
            </tr>
          </tfoot>
        </table>

        <div class="empty-state" *ngIf="items.length === 0">
          <mat-icon>receipt_long</mat-icon>
          <h3>No expenses found</h3>
          <p>Add your first expense or import an Excel file to get started.</p>
          <button mat-flat-button color="primary" (click)="openAddDialog()">
            <mat-icon>add</mat-icon> Add Expense
          </button>
        </div>
      </div>

      <div class="loading-wrap" *ngIf="loading">
        <mat-spinner diameter="40"></mat-spinner>
        <span>Loading expenses…</span>
      </div>

      <!-- Pagination -->
      <div class="pagination" *ngIf="totalCount > pageSize && !loading">
        <button mat-icon-button [disabled]="currentPage <= 1" (click)="goToPage(currentPage-1)"><mat-icon>chevron_left</mat-icon></button>
        <span class="page-info">Page {{ currentPage }} of {{ totalPages }} ({{ totalCount }} items)</span>
        <button mat-icon-button [disabled]="currentPage >= totalPages" (click)="goToPage(currentPage+1)"><mat-icon>chevron_right</mat-icon></button>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f1f5f9; }
    .et-container { max-width: 1500px; margin: 0 auto; padding: 20px 16px 48px; }

    /* Header */
    .et-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
    .header-left { display: flex; align-items: center; gap: 12px; }
    .back-btn { color: #6b7280; }
    .header-icon-wrap { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #4f46e5); display: flex; align-items: center; justify-content: center; }
    .header-icon-wrap mat-icon { color: white; font-size: 26px; width: 26px; height: 26px; }
    h1 { margin: 0; font-size: 22px; font-weight: 700; color: #111827; }
    .subtitle { margin: 0; font-size: 13px; color: #6b7280; }
    .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .action-btn { border-radius: 10px; font-size: 13px; color: #374151; background: white; }
    .add-btn { border-radius: 10px; }

    /* Top bar */
    .top-bar { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; margin-bottom: 16px; }
    .year-nav { display: flex; align-items: center; gap: 4px; background: white; border-radius: 12px; padding: 4px 8px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .year-label { font-size: 16px; font-weight: 700; color: #111827; min-width: 48px; text-align: center; }
    .summary-cards { display: flex; gap: 10px; flex-wrap: wrap; }
    .s-card { display: flex; align-items: center; gap: 10px; background: white; border-radius: 12px; padding: 10px 16px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .s-card mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .s-card.total mat-icon { color: #6366f1; }
    .s-card.amount mat-icon { color: #0ea5e9; }
    .s-card.paid mat-icon { color: #10b981; }
    .s-card.pending mat-icon { color: #f59e0b; }
    .s-val { display: block; font-size: 15px; font-weight: 700; color: #111827; }
    .s-lbl { display: block; font-size: 11px; color: #6b7280; }

    /* Month tabs */
    .month-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 14px; background: white; border-radius: 14px; padding: 6px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .m-tab { position: relative; padding: 6px 12px; border: none; background: transparent; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 500; color: #6b7280; transition: all 0.15s; white-space: nowrap; }
    .m-tab:hover { background: #f1f5f9; color: #374151; }
    .m-tab.active { background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; }
    .m-count { position: absolute; top: -2px; right: -2px; background: #ef4444; color: white; font-size: 9px; border-radius: 8px; padding: 0 4px; min-width: 16px; text-align: center; }

    /* Filters */
    .filters-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
    .search-wrap { display: flex; align-items: center; gap: 8px; background: white; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 8px 14px; flex: 1; min-width: 200px; }
    .search-wrap:focus-within { border-color: #6366f1; }
    .search-icon { color: #9ca3af; font-size: 20px; width: 20px; height: 20px; }
    .search-input { border: none; outline: none; font-size: 14px; background: transparent; flex: 1; }
    .filter-sel { padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 10px; background: white; font-size: 13px; color: #374151; cursor: pointer; }
    .filter-sel:focus { outline: none; border-color: #6366f1; }

    /* Table */
    .table-wrap { background: white; border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.08); overflow-x: auto; }
    .exp-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .exp-table th { padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; cursor: pointer; white-space: nowrap; }
    .exp-table th mat-icon.sort-icon { font-size: 14px; vertical-align: middle; width: 14px; height: 14px; }
    .exp-table td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    .exp-table tr:hover td { background: #f9fafb; }
    .row-paid td { background: #f0fdf4 !important; }
    .row-cancelled td { background: #fef2f2 !important; opacity: 0.7; }

    .company-name { font-weight: 600; color: #111827; }
    .linked-inv { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #6366f1; margin-top: 2px; }
    .linked-inv mat-icon { font-size: 12px; width: 12px; height: 12px; }
    .services-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .num-col { text-align: right; }
    .amount-cell { font-weight: 600; color: #111827; }
    .date-col { white-space: nowrap; }
    .inv-cell { font-family: monospace; font-size: 12px; }
    .no-data { color: #d1d5db; }
    .actions-col { width: 40px; text-align: center; }
    .row-menu-btn { width: 32px; height: 32px; line-height: 32px; }
    .delete-menu-item { color: #ef4444; }

    .type-chip { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; background: #e0e7ff; color: #4338ca; }
    .type-chip.po { background: #fef3c7; color: #d97706; }

    .cat-chip { padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; color: white; display: inline-block; }
    .status-chip { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-pending  { background: #fef3c7; color: #d97706; }
    .status-paid     { background: #dcfce7; color: #16a34a; }
    .status-cancelled{ background: #fee2e2; color: #dc2626; }

    tfoot .total-row td { padding: 12px 14px; border-top: 2px solid #e5e7eb; background: #f9fafb; }

    /* Empty state */
    .empty-state { padding: 60px 24px; text-align: center; color: #6b7280; }
    .empty-state mat-icon { font-size: 52px; width: 52px; height: 52px; color: #cbd5e1; margin-bottom: 12px; }
    .empty-state h3 { margin: 0 0 6px; color: #374151; }
    .empty-state p { margin: 0 0 16px; font-size: 13px; }

    .loading-wrap { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 48px; color: #6b7280; background: white; border-radius: 16px; }

    /* Pagination */
    .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; margin-top: 16px; }
    .page-info { font-size: 13px; color: #6b7280; }
  `]
})
export class ExpenseTrackerComponent implements OnInit {
  departmentId = 0;
  departmentName = '';
  isFinance = false;

  items: ExpenseItem[] = [];
  summary: ExpenseSummary | null = null;
  categories: ExpenseCategory[] = [];
  loading = false;

  selectedYear = new Date().getFullYear();
  selectedMonth = new Date().getMonth() + 1; // current month by default
  months = MONTHS;

  searchQuery = '';
  filterType = '';
  filterStatus = '';
  filterCategory = '';
  sortBy = 'date';
  sortDir = 'desc';
  currentPage = 1;
  pageSize = 50;
  totalCount = 0;

  private searchTimer: any;

  constructor(
    private service: ExpenseTrackerService,
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(p => {
      this.departmentId   = +p['departmentId'] || 0;
      this.departmentName = p['departmentName'] || '';
      this.isFinance      = p['isFinance'] === 'true';
      if (!this.departmentId && !this.isFinance) {
        this.router.navigate(['/dashboard']);
        return;
      }
      this.loadCategories();
      this.loadItems();
      this.loadSummary();
    });
  }

  loadCategories(): void {
    this.service.getCategories(this.departmentId).subscribe({
      next: c => this.categories = c
    });
  }

  loadItems(): void {
    this.loading = true;
    this.service.getItems({
      departmentId: this.departmentId,
      year:    this.selectedYear,
      month:   this.selectedMonth || undefined,
      search:  this.searchQuery || undefined,
      itemType: this.filterType || undefined,
      status:  this.filterStatus || undefined,
      categoryId: this.filterCategory ? +this.filterCategory : undefined,
      sortBy:  this.sortBy,
      sortDir: this.sortDir,
      page:    this.currentPage,
      pageSize: this.pageSize
    }).subscribe({
      next: r => {
        this.items      = r.items;
        this.totalCount = r.total;
        this.summary    = r.summary;
        this.loading    = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load expenses', 'Close', { duration: 3000 });
      }
    });
  }

  loadSummary(): void {
    this.service.getSummary(this.departmentId, this.selectedYear).subscribe({
      next: s => this.summary = s
    });
  }

  get totalPages(): number { return Math.ceil(this.totalCount / this.pageSize); }

  selectMonth(m: number): void {
    this.selectedMonth = m;
    this.currentPage = 1;
    this.loadItems();
  }

  changeYear(d: number): void {
    this.selectedYear += d;
    this.currentPage = 1;
    this.loadItems();
    this.loadSummary();
  }

  sort(col: string): void {
    if (this.sortBy === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortBy = col; this.sortDir = 'desc'; }
    this.loadItems();
  }

  goToPage(p: number): void {
    this.currentPage = p;
    this.loadItems();
  }

  onSearchChange(v: string): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => { this.currentPage = 1; this.loadItems(); }, 400);
  }

  getCategoryName(id?: number): string {
    if (!id) return '';
    return this.categories.find(c => c.id === id)?.name || '';
  }

  getCategoryColor(id?: number): string {
    if (!id) return '#6b7280';
    return this.categories.find(c => c.id === id)?.color || '#6b7280';
  }

  getPageTotal(): number { return this.items.reduce((s, i) => s + i.amount, 0); }

  getMonthCount(m: number): number {
    return this.summary?.byMonth.find(b => b.month === m && b.year === this.selectedYear)?.count || 0;
  }

  markPaid(item: ExpenseItem): void {
    this.service.update(item.id, { ...item, status: 'Paid' }).subscribe({
      next: () => { this.loadItems(); this.snackBar.open('Marked as Paid', 'Close', { duration: 2500 }); },
      error: () => this.snackBar.open('Failed to update', 'Close', { duration: 3000 })
    });
  }

  deleteItem(item: ExpenseItem): void {
    if (!confirm(`Delete expense from "${item.company}"?`)) return;
    this.service.delete(item.id).subscribe({
      next: () => { this.loadItems(); this.loadSummary(); this.snackBar.open('Deleted', 'Close', { duration: 2500 }); },
      error: () => this.snackBar.open('Failed to delete', 'Close', { duration: 3000 })
    });
  }

  openAddDialog(): void {
    const ref = this.dialog.open(ExpenseItemDialogComponent, {
      width: '640px', maxWidth: '95vw', maxHeight: '90vh',
      data: { departmentId: this.departmentId, categories: this.categories, item: null,
              month: this.selectedMonth || new Date().getMonth() + 1, year: this.selectedYear }
    });
    ref.afterClosed().subscribe(r => { if (r) { this.loadItems(); this.loadSummary(); } });
  }

  openEditDialog(item: ExpenseItem): void {
    const ref = this.dialog.open(ExpenseItemDialogComponent, {
      width: '640px', maxWidth: '95vw', maxHeight: '90vh',
      data: { departmentId: this.departmentId, categories: this.categories, item, month: item.month, year: item.year }
    });
    ref.afterClosed().subscribe(r => { if (r) { this.loadItems(); this.loadSummary(); } });
  }

  linkInvoice(item: ExpenseItem): void {
    const ref = this.dialog.open(LinkInvoiceDialogComponent, {
      width: '600px', maxWidth: '95vw', maxHeight: '85vh',
      data: { departmentId: this.departmentId, item }
    });
    ref.afterClosed().subscribe(r => { if (r) { this.loadItems(); } });
  }

  openUploadDialog(): void {
    const ref = this.dialog.open(ExcelUploadDialogComponent, {
      width: '500px', maxWidth: '95vw',
      data: { departmentId: this.departmentId, year: this.selectedYear, month: this.selectedMonth }
    });
    ref.afterClosed().subscribe(r => { if (r) { this.loadItems(); this.loadSummary(); this.loadCategories(); } });
  }

  openCategoryDialog(): void {
    const ref = this.dialog.open(CategoryManagerDialogComponent, {
      width: '560px', maxWidth: '95vw', maxHeight: '85vh',
      data: { departmentId: this.departmentId }
    });
    ref.afterClosed().subscribe(() => this.loadCategories());
  }

  exportExcel(): void {
    this.service.exportExcel(this.departmentId, this.selectedYear, this.selectedMonth || undefined)
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `expenses_${this.departmentName}_${this.selectedYear}.xlsx`;
          a.click(); URL.revokeObjectURL(url);
        },
        error: () => this.snackBar.open('Export failed', 'Close', { duration: 3000 })
      });
  }

  goBack(): void { this.router.navigate(['/books'], { queryParams: { departmentId: this.departmentId, departmentName: this.departmentName } }); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Add / Edit Item Dialog
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'expense-item-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule,
            MatDialogModule, MatSelectModule, MatFormFieldModule,
            MatInputModule, MatNativeDateModule, MatDatepickerModule],
  template: `
    <div class="ei-dialog">
      <div class="ei-header">
        <mat-icon>{{ data.item ? 'edit' : 'add_circle' }}</mat-icon>
        <h2>{{ data.item ? 'Edit Expense' : 'Add Expense' }}</h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>
      <div class="ei-body">
        <div class="row2">
          <div class="fg">
            <label>Company *</label>
            <input [(ngModel)]="form.company" class="finput" placeholder="Supplier / Vendor">
          </div>
          <div class="fg">
            <label>Type *</label>
            <select [(ngModel)]="form.itemType" class="fsel">
              <option value="Service">Service</option>
              <option value="PurchaseOrder">Purchase Order</option>
            </select>
          </div>
        </div>
        <div class="fg full">
          <label>Services Rendered *</label>
          <input [(ngModel)]="form.servicesRendered" class="finput" placeholder="Description of services or goods">
        </div>
        <div class="row2">
          <div class="fg">
            <label>Invoiced To *</label>
            <input [(ngModel)]="form.invoicedTo" class="finput" placeholder="Company being billed">
          </div>
          <div class="fg">
            <label>Paid By</label>
            <input [(ngModel)]="form.paidBy" class="finput" placeholder="Who paid">
          </div>
        </div>
        <div class="row3">
          <div class="fg">
            <label>Amount (ZAR) *</label>
            <input type="number" [(ngModel)]="form.amount" class="finput" step="0.01" min="0">
          </div>
          <div class="fg">
            <label>VAT Amount</label>
            <input type="number" [(ngModel)]="form.vatAmount" class="finput" step="0.01" min="0">
          </div>
          <div class="fg">
            <label>Invoice Number</label>
            <input [(ngModel)]="form.invoiceNumber" class="finput" placeholder="INV-001">
          </div>
        </div>
        <div class="row3">
          <div class="fg">
            <label>Date *</label>
            <input type="date" [(ngModel)]="form.itemDate" class="finput">
          </div>
          <div class="fg">
            <label>Status</label>
            <select [(ngModel)]="form.status" class="fsel">
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div class="fg">
            <label>Category</label>
            <select [(ngModel)]="form.categoryId" class="fsel">
              <option [ngValue]="null">— None —</option>
              <option *ngFor="let c of data.categories" [ngValue]="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>
        <div class="fg full">
          <label>Notes</label>
          <textarea [(ngModel)]="form.notes" class="finput" rows="2" placeholder="Optional notes"></textarea>
        </div>
      </div>
      <div class="ei-footer">
        <button mat-button (click)="dialogRef.close()">Cancel</button>
        <button mat-flat-button color="primary" [disabled]="!isValid() || saving" (click)="save()">
          <mat-icon>{{ saving ? 'hourglass_empty' : 'save' }}</mat-icon>
          {{ saving ? 'Saving…' : (data.item ? 'Save Changes' : 'Add Expense') }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ei-dialog { display: flex; flex-direction: column; }
    .ei-header { display: flex; align-items: center; gap: 10px; padding: 18px 20px 12px; border-bottom: 1px solid #f3f4f6; }
    .ei-header mat-icon { color: #6366f1; font-size: 26px; width: 26px; height: 26px; }
    .ei-header h2 { flex: 1; margin: 0; font-size: 18px; font-weight: 700; color: #111827; }
    .ei-body { padding: 16px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
    .ei-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px 16px; border-top: 1px solid #f3f4f6; }
    .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
    .fg { display: flex; flex-direction: column; gap: 4px; }
    .fg.full { grid-column: 1 / -1; }
    .fg label { font-size: 12px; font-weight: 600; color: #374151; }
    .finput { padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; font-family: inherit; width: 100%; box-sizing: border-box; transition: border-color .15s; }
    .finput:focus { outline: none; border-color: #6366f1; }
    .fsel { padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: white; width: 100%; cursor: pointer; }
    .fsel:focus { outline: none; border-color: #6366f1; }
    textarea.finput { resize: vertical; }
  `]
})
export class ExpenseItemDialogComponent {
  form: any = {};
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<ExpenseItemDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private service: ExpenseTrackerService,
    private snackBar: MatSnackBar
  ) {
    const it = data.item;
    if (it) {
      const d = new Date(it.itemDate);
      this.form = {
        ...it,
        itemDate: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      };
    } else {
      const today = new Date();
      const m = data.month || today.getMonth()+1;
      const y = data.year  || today.getFullYear();
      this.form = {
        departmentId: data.departmentId,
        itemType: 'Service', status: 'Pending', currency: 'ZAR',
        month: m, year: y,
        itemDate: `${y}-${String(m).padStart(2,'0')}-01`,
        amount: 0, company: '', servicesRendered: '', invoicedTo: '',
        categoryId: null
      };
    }
  }

  isValid(): boolean {
    return !!(this.form.company && this.form.servicesRendered &&
              this.form.invoicedTo && this.form.amount > 0 && this.form.itemDate);
  }

  save(): void {
    if (!this.isValid()) return;
    this.saving = true;
    const d = new Date(this.form.itemDate);
    const payload = {
      ...this.form,
      month: d.getMonth() + 1,
      year:  d.getFullYear(),
      itemDate: d.toISOString()
    };
    const obs = this.data.item
      ? this.service.update(this.data.item.id, payload)
      : this.service.create(payload);
    obs.subscribe({
      next: () => {
        this.saving = false;
        this.snackBar.open(this.data.item ? 'Updated' : 'Expense added', 'Close', { duration: 2500 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving = false;
        this.snackBar.open('Failed to save', 'Close', { duration: 3000 });
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Link Invoice Dialog (link expense to a BookInvoice)
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'link-invoice-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogModule, MatProgressSpinnerModule],
  template: `
    <div class="li-dialog">
      <div class="li-header">
        <mat-icon>link</mat-icon>
        <h2>Link to Uploaded Invoice</h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>
      <div class="li-body">
        <div class="search-wrap">
          <mat-icon>search</mat-icon>
          <input class="sinput" placeholder="Search by supplier or invoice number…"
                 [(ngModel)]="search" (ngModelChange)="onSearch()">
        </div>
        <div class="loading-row" *ngIf="loading"><mat-spinner diameter="28"></mat-spinner></div>
        <div class="inv-list" *ngIf="!loading">
          <div class="inv-row selected" *ngIf="data.item.bookInvoiceId">
            <mat-icon>check_circle</mat-icon>
            <span>Currently linked: {{ data.item.bookInvoiceSupplier }}</span>
            <button mat-button color="warn" (click)="unlink()">Unlink</button>
          </div>
          <div class="inv-row" *ngFor="let inv of invoices" (click)="link(inv)"
               [class.current]="inv.id === data.item.bookInvoiceId">
            <mat-icon class="pdf-icon">picture_as_pdf</mat-icon>
            <div class="inv-info">
              <div class="inv-sup">{{ inv.supplierName }}</div>
              <div class="inv-meta">{{ inv.invoiceNumber || 'No inv#' }} &nbsp;•&nbsp; {{ inv.invoiceDate | date:'dd MMM yyyy' }} &nbsp;•&nbsp; {{ inv.total | currency:'ZAR':'symbol-narrow':'1.2-2' }}</div>
            </div>
            <mat-icon *ngIf="inv.id === data.item.bookInvoiceId" class="linked-check">check_circle</mat-icon>
          </div>
          <div class="empty" *ngIf="invoices.length===0 && !loading">No invoices found.</div>
        </div>
      </div>
      <div class="li-footer"><button mat-button (click)="dialogRef.close()">Close</button></div>
    </div>
  `,
  styles: [`
    .li-dialog { display: flex; flex-direction: column; max-height: 75vh; }
    .li-header { display: flex; align-items: center; gap: 10px; padding: 18px 20px 12px; border-bottom: 1px solid #f3f4f6; flex-shrink: 0; }
    .li-header mat-icon { color: #6366f1; }
    .li-header h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 700; }
    .li-body { flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 10px; }
    .li-footer { flex-shrink: 0; padding: 10px 20px 14px; border-top: 1px solid #f3f4f6; display: flex; justify-content: flex-end; }
    .search-wrap { display: flex; align-items: center; gap: 8px; border: 1.5px solid #e5e7eb; border-radius: 10px; padding: 8px 14px; }
    .search-wrap mat-icon { color: #9ca3af; font-size: 18px; }
    .sinput { border: none; outline: none; font-size: 14px; flex: 1; }
    .loading-row { display: flex; justify-content: center; padding: 24px; }
    .inv-list { display: flex; flex-direction: column; gap: 6px; }
    .inv-row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1.5px solid #e5e7eb; border-radius: 10px; cursor: pointer; transition: all .15s; }
    .inv-row:hover { border-color: #6366f1; background: #f5f3ff; }
    .inv-row.selected { border-color: #10b981; background: #f0fdf4; cursor: default; }
    .inv-row.current { border-color: #6366f1; }
    .pdf-icon { color: #ef4444; }
    .inv-sup { font-weight: 600; font-size: 14px; }
    .inv-meta { font-size: 12px; color: #6b7280; }
    .linked-check { color: #6366f1; margin-left: auto; }
    .empty { text-align: center; color: #9ca3af; padding: 24px; }
  `]
})
export class LinkInvoiceDialogComponent implements OnInit {
  invoices: any[] = [];
  loading = true;
  search = '';
  private timer: any;

  constructor(
    public dialogRef: MatDialogRef<LinkInvoiceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private booksService: BooksService,
    private expService: ExpenseTrackerService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void { this.fetch(); }

  onSearch(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.fetch(), 350);
  }

  fetch(): void {
    this.loading = true;
    this.booksService.getAll(this.data.departmentId, { search: this.search || undefined }).subscribe({
      next: r => { this.invoices = (r as any).invoices || r; this.loading = false; },
      error: () => this.loading = false
    });
  }

  link(inv: any): void {
    this.expService.update(this.data.item.id, { ...this.data.item, bookInvoiceId: inv.id }).subscribe({
      next: () => {
        this.snackBar.open(`Linked to ${inv.supplierName}`, 'Close', { duration: 2500 });
        this.dialogRef.close(true);
      },
      error: () => this.snackBar.open('Failed to link', 'Close', { duration: 3000 })
    });
  }

  unlink(): void {
    this.expService.update(this.data.item.id, { ...this.data.item, bookInvoiceId: null }).subscribe({
      next: () => { this.snackBar.open('Unlinked', 'Close', { duration: 2500 }); this.dialogRef.close(true); },
      error: () => this.snackBar.open('Failed to unlink', 'Close', { duration: 3000 })
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel Upload Dialog
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'excel-upload-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogModule, MatProgressSpinnerModule],
  template: `
    <div class="up-dialog">
      <div class="up-header">
        <mat-icon>upload_file</mat-icon>
        <h2>Import from Excel</h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>
      <div class="up-body">
        <div class="info-box">
          <mat-icon>info</mat-icon>
          <div>
            <strong>Expected columns (any order):</strong><br>
            Company · Services Rendered · Invoiced To · Amount · Paid By · Invoice Number · Date · Type · Category · Status · Notes
          </div>
        </div>
        <div class="period-row">
          <div class="fg">
            <label>Year</label>
            <input type="number" [(ngModel)]="year" class="finput" min="2000" max="2100">
          </div>
          <div class="fg">
            <label>Month (default)</label>
            <select [(ngModel)]="month" class="fsel">
              <option *ngFor="let m of months; let i=index" [value]="i+1">{{ m }}</option>
            </select>
          </div>
        </div>
        <div class="drop-zone" [class.has-file]="file" (click)="filePicker.click()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
          <input #filePicker type="file" accept=".xlsx,.xls" style="display:none" (change)="onFile($event)">
          <mat-icon>{{ file ? 'check_circle' : 'cloud_upload' }}</mat-icon>
          <div *ngIf="!file">Click or drag &amp; drop an Excel file here</div>
          <div *ngIf="file"><strong>{{ file.name }}</strong><br><small>{{ (file.size/1024).toFixed(1) }} KB</small></div>
        </div>
        <div class="result-box success" *ngIf="result">
          <mat-icon>check_circle</mat-icon>
          <div><strong>{{ result.imported }} rows imported</strong>, {{ result.skipped }} skipped.</div>
        </div>
        <div class="result-box error" *ngIf="errorMsg">
          <mat-icon>error</mat-icon>{{ errorMsg }}
        </div>
      </div>
      <div class="up-footer">
        <button mat-button (click)="dialogRef.close(!!result)">{{ result ? 'Done' : 'Cancel' }}</button>
        <button mat-flat-button color="primary" [disabled]="!file || uploading" (click)="upload()">
          <mat-icon>{{ uploading ? 'hourglass_empty' : 'upload' }}</mat-icon>
          {{ uploading ? 'Uploading…' : 'Import' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .up-dialog { display: flex; flex-direction: column; }
    .up-header { display: flex; align-items: center; gap: 10px; padding: 18px 20px 12px; border-bottom: 1px solid #f3f4f6; }
    .up-header mat-icon { color: #6366f1; }
    .up-header h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 700; }
    .up-body { padding: 16px 20px; display: flex; flex-direction: column; gap: 14px; }
    .up-footer { display: flex; justify-content: flex-end; gap: 10px; padding: 12px 20px 16px; border-top: 1px solid #f3f4f6; }
    .info-box { display: flex; gap: 10px; padding: 12px 14px; background: #eff6ff; border-radius: 10px; font-size: 13px; color: #1e40af; }
    .info-box mat-icon { flex-shrink: 0; color: #3b82f6; }
    .period-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .fg { display: flex; flex-direction: column; gap: 4px; }
    .fg label { font-size: 12px; font-weight: 600; color: #374151; }
    .finput { padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; width: 100%; box-sizing: border-box; }
    .finput:focus { outline: none; border-color: #6366f1; }
    .fsel { padding: 9px 12px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 14px; background: white; width: 100%; }
    .drop-zone { border: 2px dashed #d1d5db; border-radius: 14px; padding: 32px; text-align: center; cursor: pointer; transition: all .2s; color: #6b7280; font-size: 14px; }
    .drop-zone mat-icon { font-size: 40px; width: 40px; height: 40px; color: #d1d5db; display: block; margin: 0 auto 10px; }
    .drop-zone:hover, .drop-zone.has-file { border-color: #6366f1; background: #f5f3ff; color: #4338ca; }
    .drop-zone.has-file mat-icon { color: #10b981; }
    .result-box { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 10px; font-size: 13px; }
    .result-box.success { background: #f0fdf4; color: #16a34a; }
    .result-box.error { background: #fef2f2; color: #dc2626; }
  `]
})
export class ExcelUploadDialogComponent {
  months = MONTHS;
  year: number;
  month: number;
  file: File | null = null;
  uploading = false;
  result: any = null;
  errorMsg = '';

  constructor(
    public dialogRef: MatDialogRef<ExcelUploadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private service: ExpenseTrackerService,
    private snackBar: MatSnackBar
  ) {
    this.year  = data.year  || new Date().getFullYear();
    this.month = data.month || new Date().getMonth() + 1;
  }

  onFile(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) { this.file = f; this.result = null; this.errorMsg = ''; }
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    const f = e.dataTransfer?.files[0];
    if (f) { this.file = f; this.result = null; this.errorMsg = ''; }
  }

  upload(): void {
    if (!this.file) return;
    this.uploading = true;
    this.errorMsg = '';
    this.service.uploadExcel(this.file, this.data.departmentId, this.year, this.month).subscribe({
      next: r => { this.result = r; this.uploading = false; },
      error: e => { this.errorMsg = e?.error?.error || 'Upload failed'; this.uploading = false; }
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Manager Dialog
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'category-manager-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule,
            MatDialogModule, MatProgressSpinnerModule],
  template: `
    <div class="cm-dialog">
      <div class="cm-header">
        <mat-icon>label</mat-icon>
        <h2>Manage Categories</h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>
      <div class="cm-body">
        <div class="add-row">
          <div class="color-dot" [style.background]="newColor"></div>
          <input [(ngModel)]="newName" class="cinput" placeholder="New category name" (keydown.enter)="addCategory()">
          <input type="color" [(ngModel)]="newColor" class="color-pick">
          <button mat-flat-button color="primary" [disabled]="!newName.trim() || saving" (click)="addCategory()">
            <mat-icon>add</mat-icon>
          </button>
        </div>
        <div class="loading-row" *ngIf="loading"><mat-spinner diameter="28"></mat-spinner></div>
        <div class="cat-list">
          <div class="cat-row" *ngFor="let c of categories">
            <div class="color-dot" [style.background]="c.color"></div>
            <div class="cat-name" *ngIf="editId !== c.id">{{ c.name }}</div>
            <input *ngIf="editId === c.id" [(ngModel)]="editName" class="cinput flex1" (keydown.enter)="saveEdit(c)">
            <input *ngIf="editId === c.id" type="color" [(ngModel)]="editColor" class="color-pick">
            <span class="cat-scope" *ngIf="c.departmentId === 0">Global</span>
            <span class="cat-scope dept" *ngIf="c.departmentId !== 0">Dept</span>
            <button mat-icon-button (click)="startEdit(c)" *ngIf="editId !== c.id"><mat-icon>edit</mat-icon></button>
            <button mat-icon-button color="primary" (click)="saveEdit(c)" *ngIf="editId === c.id"><mat-icon>check</mat-icon></button>
            <button mat-icon-button color="warn" (click)="deleteCategory(c)"><mat-icon>delete</mat-icon></button>
          </div>
        </div>
      </div>
      <div class="cm-footer"><button mat-button (click)="dialogRef.close()">Close</button></div>
    </div>
  `,
  styles: [`
    .cm-dialog { display: flex; flex-direction: column; max-height: 80vh; }
    .cm-header { display: flex; align-items: center; gap: 10px; padding: 18px 20px 12px; border-bottom: 1px solid #f3f4f6; flex-shrink: 0; }
    .cm-header mat-icon { color: #6366f1; }
    .cm-header h2 { flex: 1; margin: 0; font-size: 17px; font-weight: 700; }
    .cm-body { flex: 1; overflow-y: auto; padding: 14px 20px; display: flex; flex-direction: column; gap: 12px; }
    .cm-footer { flex-shrink: 0; padding: 10px 20px 14px; border-top: 1px solid #f3f4f6; display: flex; justify-content: flex-end; }
    .add-row { display: flex; align-items: center; gap: 8px; }
    .cat-row { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid #f3f4f6; border-radius: 10px; }
    .cat-row:hover { background: #f9fafb; }
    .color-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; }
    .cinput { flex: 1; padding: 8px 10px; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 13px; outline: none; }
    .cinput:focus { border-color: #6366f1; }
    .cinput.flex1 { flex: 1; }
    .color-pick { width: 34px; height: 34px; padding: 2px; border: 1.5px solid #e5e7eb; border-radius: 8px; cursor: pointer; }
    .cat-name { flex: 1; font-size: 14px; color: #374151; }
    .cat-scope { font-size: 11px; padding: 2px 8px; border-radius: 10px; background: #f1f5f9; color: #64748b; }
    .cat-scope.dept { background: #ede9fe; color: #7c3aed; }
    .loading-row { display: flex; justify-content: center; padding: 16px; }
  `]
})
export class CategoryManagerDialogComponent implements OnInit {
  categories: ExpenseCategory[] = [];
  loading = true;
  saving = false;
  newName = '';
  newColor = '#6366f1';
  editId: number | null = null;
  editName = '';
  editColor = '';

  constructor(
    public dialogRef: MatDialogRef<CategoryManagerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private service: ExpenseTrackerService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading = true;
    this.service.getCategories(this.data.departmentId).subscribe({
      next: c => { this.categories = c; this.loading = false; }
    });
  }

  addCategory(): void {
    if (!this.newName.trim()) return;
    this.saving = true;
    this.service.createCategory({ departmentId: this.data.departmentId, name: this.newName.trim(), color: this.newColor }).subscribe({
      next: () => { this.newName = ''; this.saving = false; this.load(); },
      error: () => { this.saving = false; this.snackBar.open('Failed', 'Close', { duration: 3000 }); }
    });
  }

  startEdit(c: ExpenseCategory): void {
    this.editId = c.id; this.editName = c.name; this.editColor = c.color;
  }

  saveEdit(c: ExpenseCategory): void {
    this.service.updateCategory(c.id, { departmentId: c.departmentId, name: this.editName, color: this.editColor }).subscribe({
      next: () => { this.editId = null; this.load(); }
    });
  }

  deleteCategory(c: ExpenseCategory): void {
    if (!confirm(`Remove category "${c.name}"? Existing items will lose this category.`)) return;
    this.service.deleteCategory(c.id).subscribe({ next: () => this.load() });
  }
}
