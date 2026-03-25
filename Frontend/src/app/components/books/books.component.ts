import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { BooksService, BookInvoice, BooksSummary, UploadResponse, ConfirmRequest } from '../../services/books.service';

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule, MatMenuModule,
    MatChipsModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatProgressBarModule, MatProgressSpinnerModule,
    MatTooltipModule, MatBadgeModule, MatTabsModule, MatDividerModule,
    MatSnackBarModule, MatDialogModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="books-container">
      <!-- Header -->
      <div class="books-header">
        <div class="header-left">
          <div class="header-icon-wrap">
            <mat-icon class="header-icon">menu_book</mat-icon>
          </div>
          <div>
            <h1>Books</h1>
            <p class="subtitle">{{ departmentName }} — Paid Invoice Management</p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-flat-button color="primary" (click)="openUploadDialog()" class="upload-btn">
            <mat-icon>cloud_upload</mat-icon>
            Upload Invoice
          </button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-row" *ngIf="summary">
        <div class="summary-card total">
          <mat-icon>receipt_long</mat-icon>
          <div class="summary-info">
            <span class="summary-value">{{ summary.totalInvoices }}</span>
            <span class="summary-label">Total Invoices</span>
          </div>
        </div>
        <div class="summary-card amount">
          <mat-icon>payments</mat-icon>
          <div class="summary-info">
            <span class="summary-value">{{ summary.totalAmount | currency:'ZAR':'symbol-narrow':'1.2-2' }}</span>
            <span class="summary-label">Total Paid</span>
          </div>
        </div>
        <div class="summary-card confirmed">
          <mat-icon>paid</mat-icon>
          <div class="summary-info">
            <span class="summary-value">{{ summary.confirmedCount }}</span>
            <span class="summary-label">Paid</span>
          </div>
        </div>
        <div class="summary-card payment-requested">
          <mat-icon>pending_actions</mat-icon>
          <div class="summary-info">
            <span class="summary-value">{{ summary.paymentRequestedCount }}</span>
            <span class="summary-label">Payment Requested</span>
          </div>
        </div>
        <div class="summary-card draft">
          <mat-icon>upload_file</mat-icon>
          <div class="summary-info">
            <span class="summary-value">{{ summary.draftCount }}</span>
            <span class="summary-label">Submitted</span>
          </div>
        </div>
        <div class="summary-card archived">
          <mat-icon>cancel</mat-icon>
          <div class="summary-info">
            <span class="summary-value">{{ summary.archivedCount }}</span>
            <span class="summary-label">Rejected</span>
          </div>
        </div>
      </div>

      <!-- Top Suppliers -->
      <div class="suppliers-row" *ngIf="summary && summary.bySupplier.length > 0">
        <div class="section-title">
          <mat-icon>store</mat-icon>
          <span>Top Suppliers</span>
        </div>
        <div class="supplier-chips">
          <div class="supplier-chip" *ngFor="let s of summary.bySupplier.slice(0, 6)"
               [class.active]="filterSupplier === s.supplier"
               (click)="toggleSupplierFilter(s.supplier)">
            <span class="sc-name">{{ s.supplier }}</span>
            <span class="sc-count">{{ s.count }}</span>
            <span class="sc-total">{{ s.total | currency:'ZAR':'symbol-narrow':'1.0-0' }}</span>
            <button class="sc-upload-btn" matTooltip="Upload invoice for {{ s.supplier }}" (click)="uploadForSupplier(s.supplier, $event)">
              <mat-icon>add_circle</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Filters & Search -->
      <div class="filters-row">
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input type="text" placeholder="Search invoices..." [(ngModel)]="searchQuery"
                 (input)="onSearchChange()" class="search-input">
          <button *ngIf="searchQuery" mat-icon-button class="clear-btn" (click)="searchQuery=''; loadInvoices()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <div class="filter-chips">
          <button mat-stroked-button [class.active-filter]="filterStatus === ''" (click)="setStatusFilter('')">All</button>
          <button mat-stroked-button [class.active-filter]="filterStatus === 'Confirmed'" (click)="setStatusFilter('Confirmed')">
            <mat-icon class="chip-icon confirmed-icon">paid</mat-icon> Paid
          </button>
          <button mat-stroked-button [class.active-filter]="filterStatus === 'Payment Requested'" (click)="setStatusFilter('Payment Requested')">
            <mat-icon class="chip-icon payment-requested-icon">pending_actions</mat-icon> Payment Requested
          </button>
          <button mat-stroked-button [class.active-filter]="filterStatus === 'Draft'" (click)="setStatusFilter('Draft')">
            <mat-icon class="chip-icon draft-icon">upload_file</mat-icon> Submitted
          </button>
          <button mat-stroked-button [class.active-filter]="filterStatus === 'Archived'" (click)="setStatusFilter('Archived')">
            <mat-icon class="chip-icon archived-icon">cancel</mat-icon> Rejected
          </button>
        </div>
        <div class="filter-selects">
          <select [(ngModel)]="filterCompany" (change)="currentPage = 1; loadInvoices()" class="filter-select">
            <option value="">All Companies</option>
            <option value="ProMed Technologies">ProMed Technologies</option>
            <option value="Promed Pharmatech">Promed Pharmatech</option>
            <option value="Access Medical">Access Medical</option>
            <option value="Sebenzani Trading">Sebenzani Trading</option>
          </select>
          <select [(ngModel)]="filterCategory" (change)="loadInvoices()" class="filter-select">
            <option value="">All Categories</option>
            <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
          </select>
          <select [(ngModel)]="filterYear" (change)="loadInvoices(); loadSummary()" class="filter-select">
            <option value="">All Years</option>
            <option *ngFor="let y of years" [value]="y">{{ y }}</option>
          </select>
        </div>
        <div class="view-toggle">
          <button mat-icon-button [class.active-view]="viewMode === 'grid'" (click)="viewMode='grid'" matTooltip="Grid view">
            <mat-icon>grid_view</mat-icon>
          </button>
          <button mat-icon-button [class.active-view]="viewMode === 'list'" (click)="viewMode='list'" matTooltip="List view">
            <mat-icon>view_list</mat-icon>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading-container">
        <mat-spinner diameter="40"></mat-spinner>
        <span>Loading invoices...</span>
      </div>

      <!-- Empty State -->
      <div *ngIf="!loading && invoices.length === 0" class="empty-state">
        <mat-icon>menu_book</mat-icon>
        <h3>No invoices found</h3>
        <p>Upload your first paid invoice PDF to get started</p>
        <button mat-flat-button color="primary" (click)="openUploadDialog()">
          <mat-icon>cloud_upload</mat-icon> Upload Invoice
        </button>
      </div>

      <!-- Grid View -->
      <div *ngIf="!loading && invoices.length > 0 && viewMode === 'grid'" class="invoices-grid">
        <div class="invoice-card" *ngFor="let inv of invoices" [class.draft-card]="inv.status === 'Draft'" [class.archived-card]="inv.status === 'Archived'" [class.payment-requested-card]="inv.status === 'Payment Requested'">
          <div class="card-header">
            <div class="card-status">
              <span class="status-badge" [class]="'badge-' + inv.status.toLowerCase().replace(' ', '-')">
                {{ inv.status === 'Draft' ? 'Submitted' : (inv.status === 'Confirmed' ? 'Paid' : (inv.status === 'Payment Requested' ? 'Payment Requested' : (inv.status === 'Archived' ? 'Rejected' : inv.status))) }}
              </span>
            </div>
            <button mat-icon-button [matMenuTriggerFor]="cardMenu" class="card-menu-btn">
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #cardMenu="matMenu">
              <button mat-menu-item (click)="viewInvoicePdf(inv)">
                <mat-icon>visibility</mat-icon> View PDF
              </button>
              <button mat-menu-item (click)="downloadInvoicePdf(inv)">
                <mat-icon>download</mat-icon> Download
              </button>
              <mat-divider></mat-divider>
              <button mat-menu-item *ngIf="inv.status === 'Draft'" (click)="openConfirmDialog(inv)">
                <mat-icon color="primary">paid</mat-icon> Review & Pay
              </button>
              <button mat-menu-item *ngIf="inv.status !== 'Draft'" (click)="openEditDialog(inv)">
                <mat-icon>edit</mat-icon> Edit Details
              </button>
              <button mat-menu-item *ngIf="inv.status === 'Confirmed'" (click)="archiveInvoice(inv)">
                <mat-icon color="warn">cancel</mat-icon> Reject
              </button>
              <button mat-menu-item *ngIf="inv.status === 'Archived'" (click)="restoreInvoice(inv)">
                <mat-icon>undo</mat-icon> Undo Reject
              </button>
              <mat-divider></mat-divider>
              <button mat-menu-item (click)="deleteInvoice(inv)" class="delete-item">
                <mat-icon color="warn">delete</mat-icon> Delete
              </button>
            </mat-menu>
          </div>

          <div class="card-body" (click)="inv.status === 'Draft' ? openConfirmDialog(inv) : viewInvoicePdf(inv)">
            <div class="card-icon-row">
              <mat-icon class="pdf-icon">picture_as_pdf</mat-icon>
            </div>
            <h3 class="supplier-name">{{ inv.supplierName }}</h3>
            <div class="card-amount">{{ inv.total | currency:'ZAR':'symbol-narrow':'1.2-2' }}</div>
            <div class="card-details">
              <div class="detail-row">
                <mat-icon>calendar_today</mat-icon>
                <span>{{ inv.invoiceDate | date:'dd MMM yyyy' }}</span>
              </div>
              <div class="detail-row" *ngIf="inv.invoiceNumber">
                <mat-icon>tag</mat-icon>
                <span>{{ inv.invoiceNumber }}</span>
              </div>
              <div class="detail-row" *ngIf="inv.category">
                <mat-icon>label</mat-icon>
                <span>{{ inv.category }}</span>
              </div>
              <div class="detail-row" *ngIf="inv.companyName">
                <mat-icon>business</mat-icon>
                <span>{{ inv.companyName }}</span>
              </div>
              <div class="detail-row" *ngIf="inv.paymentMethod">
                <mat-icon>credit_card</mat-icon>
                <span>{{ inv.paymentMethod }}</span>
              </div>
            </div>
          </div>

          <div class="card-footer">
            <span class="file-info" matTooltip="{{ inv.originalFileName }}">
              <mat-icon>description</mat-icon> {{ formatFileSize(inv.fileSize) }}
            </span>
            <span class="upload-date">{{ inv.createdAt | date:'dd MMM' }}</span>
          </div>
        </div>
      </div>

      <!-- List View -->
      <div *ngIf="!loading && invoices.length > 0 && viewMode === 'list'" class="invoices-table-wrap">
        <table class="invoices-table">
          <thead>
            <tr>
              <th class="col-status">Status</th>
              <th class="col-supplier" (click)="toggleSort('supplier')">
                Supplier <mat-icon *ngIf="sortBy==='supplier'" class="sort-icon">{{ sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
              </th>
              <th class="col-invoice">Invoice #</th>
              <th class="col-date" (click)="toggleSort('invoicedate')">
                Date <mat-icon *ngIf="sortBy==='invoicedate'" class="sort-icon">{{ sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
              </th>
              <th class="col-amount" (click)="toggleSort('total')">
                Amount <mat-icon *ngIf="sortBy==='total'" class="sort-icon">{{ sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
              </th>
              <th class="col-category">Category</th>
              <th class="col-company">Company</th>
              <th class="col-payment">Payment</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let inv of invoices" [class.draft-row]="inv.status === 'Draft'" [class.archived-row]="inv.status === 'Archived'" [class.payment-requested-row]="inv.status === 'Payment Requested'">
              <td>
                <span class="status-badge" [class]="'badge-' + inv.status.toLowerCase().replace(' ', '-')">
                  {{ inv.status === 'Draft' ? 'Submitted' : (inv.status === 'Confirmed' ? 'Paid' : (inv.status === 'Payment Requested' ? 'Payment Requested' : (inv.status === 'Archived' ? 'Rejected' : inv.status))) }}
                </span>
              </td>
              <td class="supplier-cell">{{ inv.supplierName }}</td>
              <td>{{ inv.invoiceNumber || '—' }}</td>
              <td>{{ inv.invoiceDate | date:'dd MMM yyyy' }}</td>
              <td class="amount-cell">{{ inv.total | currency:'ZAR':'symbol-narrow':'1.2-2' }}</td>
              <td>
                <span class="category-tag" *ngIf="inv.category">{{ inv.category }}</span>
                <span *ngIf="!inv.category" class="no-data">—</span>
              </td>
              <td>
                <span class="company-tag" *ngIf="inv.companyName">{{ inv.companyName }}</span>
                <span *ngIf="!inv.companyName" class="no-data">—</span>
              </td>
              <td>{{ inv.paymentMethod || '—' }}</td>
              <td>
                <div class="action-btns">
                  <button mat-icon-button matTooltip="View PDF" (click)="viewInvoicePdf(inv)">
                    <mat-icon>visibility</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Download" (click)="downloadInvoicePdf(inv)">
                    <mat-icon>download</mat-icon>
                  </button>
                  <button mat-icon-button [matMenuTriggerFor]="rowMenu">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #rowMenu="matMenu">
                    <button mat-menu-item *ngIf="inv.status === 'Draft'" (click)="openConfirmDialog(inv)">
                      <mat-icon color="primary">paid</mat-icon> Review & Pay
                    </button>
                    <button mat-menu-item *ngIf="inv.status !== 'Draft'" (click)="openEditDialog(inv)">
                      <mat-icon>edit</mat-icon> Edit
                    </button>
                    <button mat-menu-item *ngIf="inv.status === 'Confirmed'" (click)="archiveInvoice(inv)">
                      <mat-icon color="warn">cancel</mat-icon> Reject
                    </button>
                    <button mat-menu-item *ngIf="inv.status === 'Archived'" (click)="restoreInvoice(inv)">
                      <mat-icon>undo</mat-icon> Undo Reject
                    </button>
                    <mat-divider></mat-divider>
                    <button mat-menu-item (click)="deleteInvoice(inv)">
                      <mat-icon color="warn">delete</mat-icon> Delete
                    </button>
                  </mat-menu>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div *ngIf="!loading && totalCount > pageSize" class="pagination">
        <button mat-icon-button [disabled]="currentPage <= 1" (click)="goToPage(currentPage - 1)">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="page-info">Page {{ currentPage }} of {{ totalPages }} ({{ totalCount }} invoices)</span>
        <button mat-icon-button [disabled]="currentPage >= totalPages" (click)="goToPage(currentPage + 1)">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%); }
    .books-container { max-width: 1400px; margin: 0 auto; padding: 24px 20px 48px; }

    /* Header */
    .books-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-wrap { width: 56px; height: 56px; border-radius: 16px; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(102,126,234,0.4); }
    .header-icon { color: white; font-size: 28px; width: 28px; height: 28px; }
    .books-header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; }
    .subtitle { margin: 2px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .upload-btn { height: 44px; padding: 0 24px; border-radius: 12px; font-weight: 600; font-size: 14px; letter-spacing: .3px; }
    .upload-btn mat-icon { margin-right: 6px; }

    /* Summary */
    .summary-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .summary-card { background: rgba(255,255,255,0.95); border-radius: 16px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); transition: transform 0.2s, box-shadow 0.2s; backdrop-filter: blur(10px); }
    .summary-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
    .summary-card mat-icon { font-size: 32px; width: 32px; height: 32px; padding: 12px; border-radius: 12px; }
    .summary-card.total mat-icon { background: #e8eaf6; color: #3f51b5; }
    .summary-card.amount mat-icon { background: #e8f5e9; color: #2e7d32; }
    .summary-card.confirmed mat-icon { background: #e0f2f1; color: #00897b; }
    .summary-card.draft mat-icon { background: #fff3e0; color: #ef6c00; }
    .summary-card.payment-requested mat-icon { background: #fff3e0; color: #e65100; }
    .summary-card.archived mat-icon { background: #ffebee; color: #e53935; }
    .summary-info { display: flex; flex-direction: column; }
    .summary-value { font-size: 22px; font-weight: 700; color: #1a1a2e; line-height: 1.2; }
    .summary-label { font-size: 12px; color: #6b7280; margin-top: 2px; text-transform: uppercase; letter-spacing: .5px; }

    /* Top Suppliers */
    .suppliers-row { margin-bottom: 20px; }
    .section-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #ffffff; margin-bottom: 10px; }
    .section-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: rgba(255,255,255,0.8); }
    .supplier-chips { display: flex; gap: 10px; flex-wrap: wrap; }
    .supplier-chip { background: rgba(255,255,255,0.95); border: 1.5px solid rgba(255,255,255,0.3); border-radius: 12px; padding: 10px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; backdrop-filter: blur(10px); }
    .supplier-chip:hover { border-color: #667eea; background: #f5f3ff; }
    .supplier-chip.active { border-color: #667eea; background: #667eea; }
    .supplier-chip.active .sc-name, .supplier-chip.active .sc-total { color: white; }
    .supplier-chip.active .sc-count { background: rgba(255,255,255,0.25); color: white; }
    .sc-upload-btn { background: none; border: none; cursor: pointer; padding: 0; margin-left: 4px; display: flex; align-items: center; opacity: 0; transition: opacity 0.2s; }
    .sc-upload-btn mat-icon { font-size: 18px; width: 18px; height: 18px; color: #667eea; }
    .supplier-chip:hover .sc-upload-btn { opacity: 1; }
    .supplier-chip.active .sc-upload-btn mat-icon { color: white; }
    .sc-name { font-weight: 600; font-size: 13px; color: #374151; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sc-count { background: #e8eaf6; color: #3f51b5; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .sc-total { font-size: 12px; color: #6b7280; }

    /* Filters */
    .filters-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; background: rgba(255,255,255,0.95); border-radius: 16px; padding: 14px 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); backdrop-filter: blur(10px); }
    .search-box { position: relative; flex: 1; min-width: 200px; }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 20px; }
    .search-input { width: 100%; padding: 10px 36px 10px 40px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 14px; outline: none; transition: border-color 0.2s; background: #f9fafb; }
    .search-input:focus { border-color: #667eea; background: white; }
    .clear-btn { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); }
    .filter-chips { display: flex; gap: 6px; }
    .filter-chips button { border-radius: 20px; font-size: 12px; height: 34px; border-color: #e5e7eb; }
    .filter-chips button.active-filter { background: #667eea; color: white; border-color: #667eea; }
    .chip-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 2px; vertical-align: middle; }
    .confirmed-icon { color: #00897b; }
    .payment-requested-icon { color: #e65100; }
    .draft-icon { color: #ef6c00; }
    .archived-icon { color: #e53935; }
    .active-filter .chip-icon { color: white !important; }
    .filter-selects { display: flex; gap: 8px; }
    .filter-select { padding: 8px 12px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 13px; background: #f9fafb; outline: none; cursor: pointer; }
    .filter-select:focus { border-color: #667eea; }
    .view-toggle { display: flex; gap: 2px; margin-left: auto; }
    .view-toggle button { color: #9ca3af; }
    .view-toggle .active-view { color: #667eea; background: #f0edff; }

    /* Loading / Empty */
    .loading-container { display: flex; align-items: center; justify-content: center; gap: 16px; padding: 60px; color: rgba(255,255,255,0.85); }
    .empty-state { text-align: center; padding: 80px 20px; }
    .empty-state mat-icon { font-size: 64px; width: 64px; height: 64px; color: rgba(255,255,255,0.5); margin-bottom: 16px; }
    .empty-state h3 { margin: 0 0 8px; color: #ffffff; font-size: 20px; }
    .empty-state p { color: rgba(255,255,255,0.8); margin: 0 0 24px; }

    /* Grid */
    .invoices-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .invoice-card { background: rgba(255,255,255,0.95); border-radius: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.15); transition: all 0.2s; border: 1.5px solid transparent; backdrop-filter: blur(10px); }
    .invoice-card:hover { box-shadow: 0 8px 25px rgba(0,0,0,0.12); transform: translateY(-2px); border-color: #e5e7eb; }
    .invoice-card.draft-card { border-left: 4px solid #ef6c00; }
    .invoice-card.archived-card { opacity: 0.7; }
    .invoice-card.payment-requested-card { border-left: 4px solid #e65100; }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 12px 0 16px; }
    .card-menu-btn { color: #9ca3af; }
    .status-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: .3px; }
    .badge-confirmed { background: #e0f2f1; color: #00897b; }
    .badge-payment-requested { background: #fff3e0; color: #e65100; }
    .badge-draft { background: #fff3e0; color: #ef6c00; }
    .badge-archived { background: #ffebee; color: #e53935; }
    .card-body { padding: 16px; cursor: pointer; }
    .card-icon-row { margin-bottom: 8px; }
    .pdf-icon { color: #ef4444; font-size: 28px; width: 28px; height: 28px; }
    .supplier-name { margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #1a1a2e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-amount { font-size: 22px; font-weight: 800; color: #2e7d32; margin-bottom: 12px; }
    .card-details { display: flex; flex-direction: column; gap: 6px; }
    .detail-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #6b7280; }
    .detail-row mat-icon { font-size: 16px; width: 16px; height: 16px; color: #9ca3af; }
    .card-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-top: 1px solid #f3f4f6; background: #fafafa; }
    .file-info { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #9ca3af; }
    .file-info mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .upload-date { font-size: 11px; color: #9ca3af; }

    /* List / Table */
    .invoices-table-wrap { overflow-x: auto; background: rgba(255,255,255,0.95); border-radius: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); backdrop-filter: blur(10px); }
    .invoices-table { width: 100%; border-collapse: collapse; }
    .invoices-table th { padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; cursor: pointer; white-space: nowrap; }
    .invoices-table td { padding: 14px 16px; font-size: 14px; color: #374151; border-bottom: 1px solid #f3f4f6; }
    .invoices-table tr:hover { background: #f9fafb; }
    .invoices-table tr.draft-row { border-left: 3px solid #ef6c00; }
    .invoices-table tr.archived-row { opacity: 0.65; }
    .sort-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; }
    .supplier-cell { font-weight: 600; color: #1a1a2e; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amount-cell { font-weight: 700; color: #2e7d32; white-space: nowrap; }
    .category-tag { background: #e8eaf6; color: #3f51b5; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .company-tag { background: #e0f2f1; color: #00695c; padding: 3px 10px; border-radius: 10px; font-size: 11px; font-weight: 600; }
    .no-data { color: #d1d5db; }
    .action-btns { display: flex; align-items: center; gap: 2px; }
    .action-btns button { color: #6b7280; }
    .action-btns button:hover { color: #667eea; }

    /* Pagination */
    .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px; }
    .page-info { font-size: 13px; color: rgba(255,255,255,0.85); }

    .delete-item { color: #ef4444; }

    @media (max-width: 768px) {
      .books-container { padding: 16px 12px; }
      .books-header h1 { font-size: 22px; }
      .summary-row { grid-template-columns: repeat(2, 1fr); }
      .filters-row { flex-direction: column; align-items: stretch; }
      .filter-chips { flex-wrap: wrap; }
      .invoices-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class BooksComponent implements OnInit {
  invoices: BookInvoice[] = [];
  summary: BooksSummary | null = null;
  loading = false;
  totalCount = 0;
  currentPage = 1;
  pageSize = 20;
  searchQuery = '';
  filterStatus = '';
  filterCategory = '';
  filterCompany = '';
  filterSupplier = '';
  filterYear = '';
  sortBy = '';
  sortDir = 'desc';
  viewMode: 'grid' | 'list' = 'grid';
  categories: string[] = [];
  suppliers: string[] = [];
  years: number[] = [];

  departmentId = 0;
  departmentName = '';

  private searchTimeout: any;

  constructor(
    private booksService: BooksService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.departmentId = +params['departmentId'] || 0;
      this.departmentName = params['departmentName'] || '';
      if (!this.departmentId) {
        this.router.navigate(['/dashboard']);
        return;
      }
      this.loadInvoices();
      this.loadSummary();
    });
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.pageSize);
  }

  loadInvoices(): void {
    this.loading = true;
    this.booksService.getAll(this.departmentId, {
      search: this.searchQuery || undefined,
      supplier: this.filterSupplier || undefined,
      category: this.filterCategory || undefined,
      company: this.filterCompany || undefined,
      status: this.filterStatus || undefined,
      year: this.filterYear || undefined,
      sortBy: this.sortBy || undefined,
      sortDir: this.sortDir,
      page: this.currentPage,
      pageSize: this.pageSize
    }).subscribe({
      next: (res) => {
        this.invoices = res.items;
        this.totalCount = res.totalCount;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.snackBar.open('Failed to load invoices', 'Close', { duration: 3000 });
      }
    });
  }

  loadSummary(): void {
    this.booksService.getSummary(this.departmentId, this.filterYear || undefined).subscribe({
      next: (s) => {
        this.summary = s;
        this.categories = s.categories;
        this.suppliers = s.suppliers;
        this.years = s.years;
      }
    });
  }

  onSearchChange(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage = 1;
      this.loadInvoices();
    }, 400);
  }

  setStatusFilter(status: string): void {
    this.filterStatus = status;
    this.currentPage = 1;
    this.loadInvoices();
  }

  toggleSupplierFilter(supplier: string): void {
    this.filterSupplier = this.filterSupplier === supplier ? '' : supplier;
    this.currentPage = 1;
    this.loadInvoices();
  }

  toggleSort(col: string): void {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = 'desc';
    }
    this.loadInvoices();
  }

  goToPage(page: number): void {
    this.currentPage = page;
    this.loadInvoices();
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  openUploadDialog(prefillSupplier?: string): void {
    const ref = this.dialog.open(UploadBookInvoiceDialog, {
      width: '600px',
      maxWidth: '95vw',
      disableClose: true,
      data: { departmentId: this.departmentId }
    });
    ref.afterClosed().subscribe((result: any) => {
      if (result?.uploaded) {
        // Open confirm dialog with the uploaded result
        this.openConfirmDialogFromUpload(result.data, prefillSupplier);
      }
    });
  }

  uploadForSupplier(supplier: string, event: Event): void {
    event.stopPropagation(); // prevent toggling the filter
    this.openUploadDialog(supplier);
  }

  openConfirmDialogFromUpload(uploadData: UploadResponse, prefillSupplier?: string): void {
    if (prefillSupplier) {
      uploadData.supplierName = prefillSupplier;
    }
    const ref = this.dialog.open(ConfirmBookInvoiceDialog, {
      width: '700px',
      maxWidth: '95vw',
      disableClose: true,
      data: { invoice: uploadData, isNew: true }
    });
    ref.afterClosed().subscribe((result) => {
      if (result === true) {
        this.loadInvoices();
        this.loadSummary();
        this.snackBar.open('Invoice marked as paid!', 'Close', { duration: 3000, panelClass: 'success-snack' });
      } else if (result === 'payment-requested') {
        this.loadInvoices();
        this.loadSummary();
        this.snackBar.open('Payment request submitted!', 'Close', { duration: 3000, panelClass: 'success-snack' });
      } else if (result === 'cancelled') {
        // Draft was deleted, refresh list
        this.loadInvoices();
        this.loadSummary();
      }
    });
  }

  openConfirmDialog(inv: BookInvoice): void {
    // Fetch full details first
    this.booksService.getById(inv.id).subscribe({
      next: (full) => {
        const ref = this.dialog.open(ConfirmBookInvoiceDialog, {
          width: '700px',
          maxWidth: '95vw',
          disableClose: true,
          data: { invoice: full, isNew: false }
        });
        ref.afterClosed().subscribe((confirmed) => {
          if (confirmed === true) {
            this.loadInvoices();
            this.loadSummary();
            this.snackBar.open('Invoice marked as paid!', 'Close', { duration: 3000 });
          } else if (confirmed === 'payment-requested') {
            this.loadInvoices();
            this.loadSummary();
            this.snackBar.open('Payment request submitted!', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  openEditDialog(inv: BookInvoice): void {
    this.booksService.getById(inv.id).subscribe({
      next: (full) => {
        const ref = this.dialog.open(ConfirmBookInvoiceDialog, {
          width: '700px',
          maxWidth: '95vw',
          data: { invoice: full, isNew: false, editMode: true }
        });
        ref.afterClosed().subscribe((updated) => {
          if (updated) {
            this.loadInvoices();
            this.loadSummary();
            this.snackBar.open('Invoice updated!', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  viewInvoicePdf(inv: BookInvoice): void {
    this.booksService.viewPdf(inv.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      },
      error: () => this.snackBar.open('Failed to load PDF', 'Close', { duration: 3000 })
    });
  }

  downloadInvoicePdf(inv: BookInvoice): void {
    this.booksService.downloadPdf(inv.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = inv.originalFileName || inv.fileName;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('Failed to download', 'Close', { duration: 3000 })
    });
  }

  archiveInvoice(inv: BookInvoice): void {
    this.booksService.archive(inv.id).subscribe({
      next: () => {
        this.loadInvoices();
        this.loadSummary();
        this.snackBar.open('Invoice rejected', 'Close', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to reject', 'Close', { duration: 3000 })
    });
  }

  restoreInvoice(inv: BookInvoice): void {
    this.booksService.restore(inv.id).subscribe({
      next: () => {
        this.loadInvoices();
        this.loadSummary();
        this.snackBar.open('Invoice restored', 'Close', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to restore', 'Close', { duration: 3000 })
    });
  }

  deleteInvoice(inv: BookInvoice): void {
    if (!confirm(`Delete invoice from ${inv.supplierName}? This cannot be undone.`)) return;
    this.booksService.delete(inv.id).subscribe({
      next: () => {
        this.loadInvoices();
        this.loadSummary();
        this.snackBar.open('Invoice deleted', 'Close', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to delete', 'Close', { duration: 3000 })
    });
  }
}


// ============================================================================
// Upload Dialog
// ============================================================================
@Component({
  selector: 'upload-book-invoice-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatProgressBarModule, MatDialogModule],
  template: `
    <div class="upload-dialog">
      <div class="dialog-header">
        <mat-icon class="dialog-header-icon">cloud_upload</mat-icon>
        <h2>Upload Paid Invoice</h2>
        <p>Upload a PDF invoice — we'll extract the details automatically</p>
      </div>

      <div class="drop-zone" [class.drag-over]="isDragOver" [class.has-file]="selectedFile"
           (dragover)="onDragOver($event)" (dragleave)="isDragOver=false" (drop)="onDrop($event)"
           (click)="fileInput.click()">
        <input type="file" #fileInput hidden accept=".pdf" (change)="onFileSelect($event)">
        <div *ngIf="!selectedFile" class="drop-content">
          <mat-icon class="drop-icon">picture_as_pdf</mat-icon>
          <span class="drop-text">Drop PDF here or click to browse</span>
          <span class="drop-hint">Only PDF files are accepted</span>
        </div>
        <div *ngIf="selectedFile" class="file-preview">
          <mat-icon class="file-icon">picture_as_pdf</mat-icon>
          <div class="file-details">
            <span class="file-name">{{ selectedFile.name }}</span>
            <span class="file-size">{{ formatSize(selectedFile.size) }}</span>
          </div>
          <button mat-icon-button (click)="removeFile($event)" class="remove-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <mat-progress-bar *ngIf="uploading" mode="indeterminate" class="upload-progress"></mat-progress-bar>

      <div *ngIf="error" class="error-msg">
        <mat-icon>error</mat-icon> {{ error }}
      </div>

      <div class="dialog-actions">
        <button mat-button (click)="dialogRef.close()" [disabled]="uploading">Cancel</button>
        <button mat-flat-button color="primary" [disabled]="!selectedFile || uploading" (click)="upload()">
          <mat-icon>upload</mat-icon>
          {{ uploading ? 'Extracting...' : 'Upload & Extract' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .upload-dialog { padding: 28px; }
    .dialog-header { text-align: center; margin-bottom: 24px; }
    .dialog-header-icon { font-size: 40px; width: 40px; height: 40px; color: #667eea; }
    .dialog-header h2 { margin: 8px 0 4px; font-size: 22px; font-weight: 700; color: #1a1a2e; }
    .dialog-header p { margin: 0; color: #6b7280; font-size: 14px; }

    .drop-zone { border: 2px dashed #d1d5db; border-radius: 16px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.2s; background: #f9fafb; }
    .drop-zone:hover, .drop-zone.drag-over { border-color: #667eea; background: #f5f3ff; }
    .drop-zone.has-file { border-color: #4ade80; background: #f0fdf4; border-style: solid; }
    .drop-content { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .drop-icon { font-size: 48px; width: 48px; height: 48px; color: #ef4444; }
    .drop-text { font-size: 15px; font-weight: 600; color: #374151; }
    .drop-hint { font-size: 12px; color: #9ca3af; }

    .file-preview { display: flex; align-items: center; gap: 12px; }
    .file-icon { font-size: 36px; width: 36px; height: 36px; color: #ef4444; }
    .file-details { display: flex; flex-direction: column; flex: 1; text-align: left; }
    .file-name { font-weight: 600; color: #1a1a2e; font-size: 14px; word-break: break-all; }
    .file-size { font-size: 12px; color: #6b7280; }
    .remove-btn { color: #9ca3af; }

    .upload-progress { margin-top: 16px; border-radius: 8px; }
    .error-msg { margin-top: 12px; padding: 10px 16px; background: #fef2f2; border-radius: 10px; color: #ef4444; font-size: 13px; display: flex; align-items: center; gap: 8px; }
    .error-msg mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
    .dialog-actions button { border-radius: 10px; }
  `]
})
export class UploadBookInvoiceDialog {
  selectedFile: File | null = null;
  uploading = false;
  isDragOver = false;
  error = '';
  departmentId = 0;

  constructor(
    public dialogRef: MatDialogRef<UploadBookInvoiceDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private booksService: BooksService
  ) {
    this.departmentId = data?.departmentId || 0;
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = true;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file && file.type === 'application/pdf') {
      this.selectedFile = file;
      this.error = '';
    } else {
      this.error = 'Only PDF files are accepted';
    }
  }

  onFileSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        this.selectedFile = file;
        this.error = '';
      } else {
        this.error = 'Only PDF files are accepted';
      }
    }
  }

  removeFile(e: Event): void {
    e.stopPropagation();
    this.selectedFile = null;
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  upload(): void {
    if (!this.selectedFile) return;
    this.uploading = true;
    this.error = '';
    this.booksService.upload(this.selectedFile, this.departmentId).subscribe({
      next: (res) => {
        this.uploading = false;
        this.dialogRef.close({ uploaded: true, data: res });
      },
      error: (err) => {
        this.uploading = false;
        if (err.status === 409) {
          this.error = err.error?.error || 'This invoice has already been uploaded.';
        } else {
          this.error = err.error?.error || 'Upload failed. Please try again.';
        }
      }
    });
  }
}


// ============================================================================
// Confirm / Edit Invoice Dialog
// ============================================================================
@Component({
  selector: 'confirm-book-invoice-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule, MatDialogModule, MatDividerModule, MatAutocompleteModule],
  template: `
    <div class="confirm-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon" [class.edit-icon]="editMode">{{ editMode ? 'edit' : 'paid' }}</mat-icon>
        <h2>{{ editMode ? 'Edit Invoice' : 'Review & Pay' }}</h2>
        <p *ngIf="!editMode">We extracted these details from the PDF — please verify and mark as paid</p>
        <p *ngIf="editMode">Update the invoice details below</p>
      </div>

      <div *ngIf="isNew && !editMode" class="extraction-banner">
        <mat-icon>auto_awesome</mat-icon>
        <span>Details auto-extracted from PDF. Fields highlighted in amber may need review.</span>
      </div>

      <div class="form-grid">
        <div class="form-group full-width supplier-autocomplete-wrap">
          <label>Supplier Name *</label>
          <input type="text" [(ngModel)]="form.supplierName" class="form-input" [class.highlight]="isNew && form.supplierName === 'Unknown Supplier'" placeholder="Start typing supplier name..." (input)="filterSuppliers()" [matAutocomplete]="supplierAuto" autocomplete="off">
          <mat-autocomplete #supplierAuto="matAutocomplete" (optionSelected)="onSupplierSelected($event)" class="supplier-autocomplete-panel">
            <mat-option *ngFor="let s of filteredSuppliers" [value]="s">
              <mat-icon style="font-size:18px;width:18px;height:18px;color:#667eea;margin-right:8px;">store</mat-icon>
              {{ s }}
            </mat-option>
          </mat-autocomplete>
          <mat-icon class="autocomplete-hint-icon" *ngIf="allSuppliers.length > 0" matTooltip="Previously used suppliers will appear as you type">history</mat-icon>
        </div>

        <div class="form-group">
          <label>Invoice Number</label>
          <input type="text" [(ngModel)]="form.invoiceNumber" class="form-input" placeholder="e.g. INV-001">
        </div>

        <div class="form-group">
          <label>Invoice Date *</label>
          <input type="date" [(ngModel)]="form.invoiceDate" class="form-input">
        </div>

        <div class="form-group">
          <label>Total Amount (Incl. VAT) *</label>
          <div class="amount-input-wrap">
            <span class="currency-prefix">R</span>
            <input type="number" [(ngModel)]="form.total" class="form-input amount-input" step="0.01" [class.highlight]="isNew && form.total === 0" placeholder="0.00">
          </div>
        </div>

        <div class="form-group">
          <label>VAT Amount</label>
          <div class="amount-input-wrap">
            <span class="currency-prefix">R</span>
            <input type="number" [(ngModel)]="form.vatAmount" class="form-input amount-input" step="0.01" placeholder="0.00">
          </div>
        </div>

        <div class="form-group">
          <label>Sub Total (Excl. VAT)</label>
          <div class="amount-input-wrap">
            <span class="currency-prefix">R</span>
            <input type="number" [(ngModel)]="form.subTotal" class="form-input amount-input" step="0.01" placeholder="0.00">
          </div>
        </div>

        <div class="form-group">
          <label>Supplier Account #</label>
          <input type="text" [(ngModel)]="form.supplierAccount" class="form-input" placeholder="Account number">
        </div>

        <mat-divider class="full-width"></mat-divider>

        <div class="form-group">
          <label>Payment Date</label>
          <input type="date" [(ngModel)]="form.paymentDate" class="form-input">
        </div>

        <div class="form-group">
          <label>Payment Method</label>
          <select [(ngModel)]="form.paymentMethod" class="form-input">
            <option value="">Select...</option>
            <option value="EFT">EFT</option>
            <option value="Credit Card">Credit Card</option>
            <option value="Debit Card">Debit Card</option>
            <option value="Cash">Cash</option>
            <option value="Cheque">Cheque</option>
            <option value="Direct Debit">Direct Debit</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label>Payment Reference</label>
          <input type="text" [(ngModel)]="form.paymentReference" class="form-input" placeholder="Reference number">
        </div>

        <div class="form-group">
          <label>Category</label>
          <select [(ngModel)]="form.category" class="form-input">
            <option value="">Select category...</option>
            <option value="Office Supplies">Office Supplies</option>
            <option value="Equipment">Equipment</option>
            <option value="Services">Services</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Fuel">Fuel</option>
            <option value="Utilities">Utilities</option>
            <option value="IT & Software">IT & Software</option>
            <option value="Marketing">Marketing</option>
            <option value="Insurance">Insurance</option>
            <option value="Rent">Rent</option>
            <option value="Travel">Travel</option>
            <option value="Training">Training</option>
            <option value="Medical Supplies">Medical Supplies</option>
            <option value="Raw Materials">Raw Materials</option>
            <option value="Packaging">Packaging</option>
            <option value="Courier & Delivery">Courier & Delivery</option>
            <option value="Professional Fees">Professional Fees</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div class="form-group">
          <label>Company</label>
          <select [(ngModel)]="form.companyName" class="form-input">
            <option value="">Select company...</option>
            <option value="ProMed Technologies">ProMed Technologies</option>
            <option value="Promed Pharmatech">Promed Pharmatech</option>
            <option value="Access Medical">Access Medical</option>
            <option value="Sebenzani Trading">Sebenzani Trading</option>
          </select>
        </div>

        <div class="form-group full-width">
          <label>Description</label>
          <input type="text" [(ngModel)]="form.description" class="form-input" placeholder="Brief description of the invoice">
        </div>

        <div class="form-group full-width">
          <label>Notes</label>
          <textarea [(ngModel)]="form.notes" class="form-input textarea" rows="2" placeholder="Any additional notes"></textarea>
        </div>
      </div>

      <div *ngIf="extractedPreview" class="extracted-preview">
        <div class="preview-toggle" (click)="showExtractedText = !showExtractedText">
          <mat-icon>{{ showExtractedText ? 'expand_less' : 'expand_more' }}</mat-icon>
          <span>Extracted Text Preview</span>
        </div>
        <div *ngIf="showExtractedText" class="preview-text">{{ extractedPreview }}</div>
      </div>

      <div class="dialog-actions">
        <button mat-button (click)="cancel()" [disabled]="saving || deleting">{{ deleting ? 'Removing...' : 'Cancel' }}</button>
        <button *ngIf="!editMode" mat-flat-button class="request-payment-btn" [disabled]="!form.supplierName || !form.total || saving" (click)="requestPayment()">
          <mat-icon>pending_actions</mat-icon>
          {{ saving ? 'Submitting...' : 'Request for Payment' }}
        </button>
        <button mat-flat-button color="primary" [disabled]="!form.supplierName || !form.total || saving" (click)="save()">
          <mat-icon>{{ editMode ? 'save' : 'paid' }}</mat-icon>
          {{ saving ? 'Saving...' : (editMode ? 'Save Changes' : 'Mark as Paid') }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog { padding: 28px; max-height: 85vh; overflow-y: auto; }
    .dialog-header { text-align: center; margin-bottom: 20px; }
    .header-icon { font-size: 40px; width: 40px; height: 40px; color: #667eea; }
    .header-icon.edit-icon { color: #ef6c00; }
    .dialog-header h2 { margin: 8px 0 4px; font-size: 22px; font-weight: 700; color: #1a1a2e; }
    .dialog-header p { margin: 0; color: #6b7280; font-size: 14px; }

    .extraction-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; margin-bottom: 20px; font-size: 13px; color: #92400e; }
    .extraction-banner mat-icon { color: #f59e0b; font-size: 20px; width: 20px; height: 20px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group.full-width { grid-column: 1 / -1; }
    .form-group label { font-size: 12px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: .3px; }
    .form-input { padding: 10px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 14px; outline: none; transition: border-color 0.2s; background: #f9fafb; font-family: inherit; }
    .form-input:focus { border-color: #667eea; background: white; }
    .form-input.highlight { border-color: #f59e0b; background: #fffbeb; }
    .form-input.textarea { resize: vertical; min-height: 60px; }
    .amount-input-wrap { position: relative; display: flex; align-items: center; }
    .currency-prefix { position: absolute; left: 14px; font-weight: 700; color: #6b7280; font-size: 14px; z-index: 1; }
    .amount-input { padding-left: 32px !important; }

    mat-divider.full-width { grid-column: 1 / -1; margin: 4px 0; }

    .extracted-preview { margin-bottom: 16px; }
    .preview-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: #6b7280; padding: 8px 0; }
    .preview-toggle:hover { color: #667eea; }
    .preview-text { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; font-size: 12px; color: #6b7280; max-height: 150px; overflow-y: auto; white-space: pre-wrap; font-family: monospace; }

    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; border-top: 1px solid #f3f4f6; }
    .dialog-actions button { border-radius: 10px; }
    .request-payment-btn { background: linear-gradient(135deg, #e65100, #ff8f00) !important; color: white !important; }
    .request-payment-btn:disabled { opacity: 0.5; }

    .supplier-autocomplete-wrap { position: relative; }
    .autocomplete-hint-icon { position: absolute; right: 10px; top: 32px; font-size: 18px; width: 18px; height: 18px; color: #9ca3af; cursor: help; }

    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class ConfirmBookInvoiceDialog {
  form: ConfirmRequest = {};
  isNew = false;
  editMode = false;
  saving = false;
  invoiceId = 0;
  extractedPreview = '';
  showExtractedText = false;
  allSuppliers: string[] = [];
  filteredSuppliers: string[] = [];
  deleting = false;

  constructor(
    public dialogRef: MatDialogRef<ConfirmBookInvoiceDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private booksService: BooksService
  ) {
    const inv = data.invoice;
    this.isNew = data.isNew || false;
    this.editMode = data.editMode || false;
    this.invoiceId = inv.id;
    this.extractedPreview = inv.extractedText || '';

    // Load existing suppliers for autocomplete
    this.booksService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.allSuppliers = suppliers.filter(s => s && s !== 'Unknown Supplier');
        this.filteredSuppliers = [];
      }
    });

    this.form = {
      supplierName: inv.supplierName || '',
      supplierAccount: inv.supplierAccount || '',
      invoiceNumber: inv.invoiceNumber || '',
      invoiceDate: this.formatDateForInput(inv.invoiceDate),
      total: inv.total || 0,
      vatAmount: inv.vatAmount || undefined,
      subTotal: inv.subTotal || undefined,
      currency: inv.currency || 'ZAR',
      paymentDate: inv.paymentDate ? this.formatDateForInput(inv.paymentDate) : '',
      paymentMethod: inv.paymentMethod || '',
      paymentReference: inv.paymentReference || '',
      category: inv.category || '',
      companyName: inv.companyName || '',
      description: inv.description || '',
      notes: inv.notes || ''
    };
  }

  cancel(): void {
    if (this.isNew && this.invoiceId) {
      // Delete the draft record that was created during upload
      this.deleting = true;
      this.booksService.delete(this.invoiceId).subscribe({
        next: () => this.dialogRef.close('cancelled'),
        error: () => this.dialogRef.close('cancelled')
      });
    } else {
      this.dialogRef.close(false);
    }
  }

  filterSuppliers(): void {
    const q = (this.form.supplierName || '').toLowerCase().trim();
    if (!q) {
      this.filteredSuppliers = [];
      return;
    }
    this.filteredSuppliers = this.allSuppliers.filter(s =>
      s.toLowerCase().includes(q)
    ).slice(0, 10);
  }

  onSupplierSelected(event: any): void {
    this.form.supplierName = event.option.value;
    this.filteredSuppliers = [];
  }

  private formatDateForInput(date: string): string {
    if (!date) return '';
    try {
      const d = new Date(date);
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  save(): void {
    this.saving = true;
    // Sanitize: convert empty date strings to undefined for C# DateTime? deserialization
    const payload: ConfirmRequest = {
      ...this.form,
      invoiceDate: this.form.invoiceDate || undefined,
      paymentDate: this.form.paymentDate || undefined,
      total: this.form.total || undefined,
      vatAmount: this.form.vatAmount || undefined,
      subTotal: this.form.subTotal || undefined
    };
    const action = this.editMode
      ? this.booksService.update(this.invoiceId, payload)
      : this.booksService.confirm(this.invoiceId, payload);

    action.subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving = false;
      }
    });
  }

  requestPayment(): void {
    this.saving = true;
    const payload: ConfirmRequest = {
      ...this.form,
      invoiceDate: this.form.invoiceDate || undefined,
      paymentDate: this.form.paymentDate || undefined,
      total: this.form.total || undefined,
      vatAmount: this.form.vatAmount || undefined,
      subTotal: this.form.subTotal || undefined
    };
    this.booksService.requestPayment(this.invoiceId, payload).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close('payment-requested');
      },
      error: () => {
        this.saving = false;
      }
    });
  }
}
