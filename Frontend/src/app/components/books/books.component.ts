import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { BooksService, BookInvoice, BooksSummary, UploadResponse, ConfirmRequest } from '../../services/books.service';
import { environment } from '../../../environments/environment';
import { WellyActivityService } from '../../services/welly-activity.service';
import { ConfirmService } from '../../ui/confirm.service';
import { ToastService } from '../../ui/toast.service';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { ChipTone, StatusChipComponent } from '../../ui/status-chip/status-chip.component';

const STATUS_LABELS: Record<string, string> = {
  'Draft': 'Submitted',
  'Confirmed': 'Paid',
  'Payment Requested': 'Payment Requested',
  'Archived': 'Rejected'
};

const STATUS_TONES: Record<string, ChipTone> = {
  'Draft': 'warn',
  'Confirmed': 'ok',
  'Payment Requested': 'warn',
  'Archived': 'danger'
};

@Component({
  selector: 'app-books',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatToolbarModule, MatCardModule, MatButtonModule, MatIconModule, MatMenuModule,
    MatChipsModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule, MatProgressBarModule,
    MatTooltipModule, MatBadgeModule, MatTabsModule, MatDividerModule,
    MatDialogModule,
    NavbarComponent, SkeletonRowsComponent, EmptyStateComponent, StatusChipComponent
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
            <button [attr.aria-label]="'Upload invoice for ' + s.supplier" class="sc-upload-btn" matTooltip="Upload invoice for {{ s.supplier }}" (click)="uploadForSupplier(s.supplier, $event)">
              <mat-icon>add_circle</mat-icon>
            </button>
            <button aria-label="Analyze with Welly" class="sc-upload-btn" matTooltip="Analyze with Welly" (click)="analyzeSupplier(s.supplier); $event.stopPropagation()" title="Ask Welly about this supplier's spending">
              <mat-icon>psychology</mat-icon>
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
          <button aria-label="Close" *ngIf="searchQuery" mat-icon-button class="clear-btn" (click)="searchQuery=''; loadInvoices()">
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
          <button aria-label="Grid view" mat-icon-button [class.active-view]="viewMode === 'grid'" (click)="viewMode='grid'" matTooltip="Grid view">
            <mat-icon>grid_view</mat-icon>
          </button>
          <button aria-label="List view" mat-icon-button [class.active-view]="viewMode === 'list'" (click)="viewMode='list'" matTooltip="List view">
            <mat-icon>view_list</mat-icon>
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="loading-container">
        <app-skeleton-rows [rows]="6" [avatar]="true"></app-skeleton-rows>
      </div>

      <!-- Empty State -->
      <div *ngIf="!loading && invoices.length === 0" class="empty-state">
        <app-empty-state *ngIf="hasFilters" icon="filter_alt_off" title="No invoices match these filters"
                         message="Nothing in these books matches the search, status, supplier, company, category or year you picked.">
          <button mat-stroked-button (click)="clearFilters()">Clear the filters</button>
        </app-empty-state>
        <app-empty-state *ngIf="!hasFilters" icon="menu_book" title="No invoices yet"
                         message="Upload your first paid invoice PDF to get started.">
          <button mat-flat-button color="primary" (click)="openUploadDialog()">
            <mat-icon>cloud_upload</mat-icon> Upload Invoice
          </button>
        </app-empty-state>
      </div>

      <!-- Grid View -->
      <div *ngIf="!loading && invoices.length > 0 && viewMode === 'grid'" class="invoices-grid">
        <div class="invoice-card" *ngFor="let inv of invoices" [class.draft-card]="inv.status === 'Draft'" [class.archived-card]="inv.status === 'Archived'" [class.payment-requested-card]="inv.status === 'Payment Requested'">
          <div class="card-header">
            <div class="card-status">
              <app-status-chip [status]="statusLabel(inv.status)" [tone]="statusTone(inv.status)"></app-status-chip>
            </div>
            <button aria-label="More actions" mat-icon-button [matMenuTriggerFor]="cardMenu" class="card-menu-btn">
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
              <div class="detail-row" *ngIf="inv.vehicleRegistration">
                <mat-icon>local_shipping</mat-icon>
                <span>{{ inv.vehicleRegistration }}</span>
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
        <table class="app-table invoices-table">
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
              <th class="num col-amount" (click)="toggleSort('total')">
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
                <app-status-chip [status]="statusLabel(inv.status)" [tone]="statusTone(inv.status)"></app-status-chip>
              </td>
              <td class="supplier-cell">{{ inv.supplierName }}</td>
              <td class="ref">{{ inv.invoiceNumber || '—' }}</td>
              <td>{{ inv.invoiceDate | date:'dd MMM yyyy' }}</td>
              <td class="num amount-cell">{{ inv.total | currency:'ZAR':'symbol-narrow':'1.2-2' }}</td>
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
                  <button aria-label="View PDF" mat-icon-button matTooltip="View PDF" (click)="viewInvoicePdf(inv)">
                    <mat-icon>visibility</mat-icon>
                  </button>
                  <button aria-label="Download" mat-icon-button matTooltip="Download" (click)="downloadInvoicePdf(inv)">
                    <mat-icon>download</mat-icon>
                  </button>
                  <button aria-label="More actions" mat-icon-button [matMenuTriggerFor]="rowMenu">
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
        <button aria-label="Previous" mat-icon-button [disabled]="currentPage <= 1" (click)="goToPage(currentPage - 1)">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <span class="page-info">Page {{ currentPage }} of {{ totalPages }} ({{ totalCount }} invoices)</span>
        <button aria-label="Next" mat-icon-button [disabled]="currentPage >= totalPages" (click)="goToPage(currentPage + 1)">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      position: relative;
      background: var(--color-canvas);
      overflow-x: hidden;
    }
    .books-container { max-width: 1400px; margin: 0 auto; padding: 24px 20px 48px; }

    /* Header */
    .books-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .header-left { display: flex; align-items: center; gap: 16px; }
    .header-icon-wrap { width: 56px; height: 56px; border-radius: 16px; background: var(--color-primary-soft); display: flex; align-items: center; justify-content: center; }
    .header-icon { color: var(--color-primary); font-size: 28px; width: 28px; height: 28px; }
    .books-header h1 { margin: 0; font-size: var(--text-3xl); font-weight: 700; color: var(--color-text); }
    .subtitle { margin: 2px 0 0; color: var(--color-text-2); font-size: var(--text-md); }
    .upload-btn { height: 44px; padding: 0 24px; border-radius: 12px; font-weight: 600; font-size: var(--text-md); letter-spacing: .3px; }
    .upload-btn mat-icon { margin-right: 6px; }

    /* Summary */
    .summary-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .summary-card { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 16px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s; }
    .summary-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .summary-card mat-icon { font-size: 32px; width: 32px; height: 32px; padding: 12px; border-radius: 12px; }
    .summary-card.total mat-icon { background: var(--color-primary-soft); color: var(--color-primary); }
    .summary-card.amount mat-icon { background: var(--color-ok-soft); color: var(--color-ok); }
    .summary-card.confirmed mat-icon { background: var(--color-ok-soft); color: var(--color-ok); }
    .summary-card.draft mat-icon { background: var(--color-warn-soft); color: var(--color-warn); }
    .summary-card.payment-requested mat-icon { background: var(--color-warn-soft); color: var(--color-warn); }
    .summary-card.archived mat-icon { background: var(--color-danger-soft); color: var(--color-danger); }
    .summary-info { display: flex; flex-direction: column; }
    .summary-value { font-size: var(--text-2xl); font-weight: 700; color: var(--color-text); line-height: 1.2; }
    .summary-label { font-size: var(--text-xs); color: var(--color-text-3); margin-top: 2px; text-transform: uppercase; letter-spacing: .5px; }

    /* Top Suppliers */
    .suppliers-row { margin-bottom: 20px; }
    .section-title { display: flex; align-items: center; gap: 8px; font-size: var(--text-md); font-weight: 600; color: var(--color-text); margin-bottom: 10px; }
    .section-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-text-3); }
    .supplier-chips { display: flex; gap: 10px; flex-wrap: wrap; }
    .supplier-chip { background: var(--color-surface); border: 1.5px solid var(--color-line); border-radius: 12px; padding: 10px 16px; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s; }
    .supplier-chip:hover { border-color: var(--color-primary); background: var(--color-primary-soft); }
    .supplier-chip.active { border-color: var(--color-primary); background: var(--color-primary); }
    .supplier-chip.active .sc-name, .supplier-chip.active .sc-total { color: var(--color-on-primary); }
    .supplier-chip.active .sc-count { background: var(--color-on-primary); color: var(--color-primary); }
    .sc-upload-btn { background: none; border: none; cursor: pointer; padding: 0; margin-left: 4px; display: flex; align-items: center; opacity: 0; transition: opacity 0.2s; }
    .sc-upload-btn mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-primary); }
    .supplier-chip:hover .sc-upload-btn { opacity: 1; }
    .supplier-chip.active .sc-upload-btn mat-icon { color: var(--color-on-primary); }
    .sc-name { font-weight: 600; font-size: var(--text-sm); color: var(--color-text-2); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sc-count { background: var(--color-primary-soft); color: var(--color-primary); font-size: var(--text-xs); font-weight: 700; padding: 2px 8px; border-radius: 10px; }
    .sc-total { font-size: var(--text-xs); color: var(--color-text-3); }

    /* Filters */
    .filters-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 16px; padding: 14px 18px; box-shadow: var(--shadow-sm); }
    .search-box { position: relative; flex: 1; min-width: 200px; }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-3); font-size: 20px; }
    .search-input { width: 100%; padding: 10px 36px 10px 40px; border: 1.5px solid var(--color-line); border-radius: 10px; font-size: var(--text-md); outline: none; transition: border-color 0.2s; background: var(--color-canvas); color: var(--color-text); }
    .search-input:focus { border-color: var(--color-primary); background: var(--color-surface); }
    .clear-btn { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); }
    .filter-chips { display: flex; gap: 6px; }
    .filter-chips button { border-radius: 20px; font-size: var(--text-xs); height: 34px; border-color: var(--color-line); }
    .filter-chips button.active-filter { background: var(--color-primary); color: var(--color-on-primary); border-color: var(--color-primary); }
    .chip-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 2px; vertical-align: middle; }
    .confirmed-icon { color: var(--color-ok); }
    .payment-requested-icon { color: var(--color-warn); }
    .draft-icon { color: var(--color-warn); }
    .archived-icon { color: var(--color-danger); }
    .active-filter .chip-icon { color: var(--color-on-primary); }
    .filter-selects { display: flex; gap: 8px; }
    .filter-select { padding: 8px 12px; border: 1.5px solid var(--color-line); border-radius: 10px; font-size: var(--text-sm); background: var(--color-canvas); color: var(--color-text); outline: none; cursor: pointer; }
    .filter-select:focus { border-color: var(--color-primary); }
    .view-toggle { display: flex; gap: 2px; margin-left: auto; }
    .view-toggle button { color: var(--color-text-3); }
    .view-toggle .active-view { color: var(--color-primary); background: var(--color-primary-soft); }

    /* Loading / Empty */
    .loading-container, .empty-state { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 16px; overflow: hidden; }

    /* Grid */
    .invoices-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .invoice-card { background: var(--color-surface); border-radius: 16px; overflow: hidden; box-shadow: var(--shadow-sm); transition: all 0.2s; border: 1px solid var(--color-line); }
    .invoice-card:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--color-line-strong); }
    .invoice-card.draft-card { border-left: 4px solid var(--color-warn); }
    .invoice-card.archived-card { opacity: 0.7; }
    .invoice-card.payment-requested-card { border-left: 4px solid var(--color-warn); }
    .card-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 12px 0 16px; }
    .card-menu-btn { color: var(--color-text-3); }
    .card-body { padding: 16px; cursor: pointer; }
    .card-icon-row { margin-bottom: 8px; }
    .pdf-icon { color: var(--color-danger); font-size: 28px; width: 28px; height: 28px; }
    .supplier-name { margin: 0 0 4px; font-size: var(--text-lg); font-weight: 700; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-amount { font-size: var(--text-2xl); font-weight: 800; color: var(--color-ok); margin-bottom: 12px; }
    .card-details { display: flex; flex-direction: column; gap: 6px; }
    .detail-row { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--color-text-3); }
    .detail-row mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--color-text-3); }
    .card-footer { display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-top: 1px solid var(--color-surface-2); background: var(--color-canvas); }
    .file-info { display: flex; align-items: center; gap: 4px; font-size: var(--text-xs); color: var(--color-text-3); }
    .file-info mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .upload-date { font-size: var(--text-xs); color: var(--color-text-3); }

    /* List / Table */
    .invoices-table-wrap { overflow-x: auto; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: 16px; box-shadow: var(--shadow-sm); }
    .invoices-table th.col-supplier, .invoices-table th.col-date, .invoices-table th.col-amount { cursor: pointer; }
    .invoices-table tr.draft-row { border-left: 3px solid var(--color-warn); }
    .invoices-table tr.archived-row { opacity: 0.65; }
    .sort-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; }
    .supplier-cell { font-weight: 600; color: var(--color-text); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .amount-cell { font-weight: 700; color: var(--color-ok); }
    .category-tag { background: var(--color-cat-purple-soft); color: var(--color-cat-purple); padding: 3px 10px; border-radius: 10px; font-size: var(--text-xs); font-weight: 600; }
    .company-tag { background: var(--color-cat-teal-soft); color: var(--color-cat-teal); padding: 3px 10px; border-radius: 10px; font-size: var(--text-xs); font-weight: 600; }
    .no-data { color: var(--color-line-strong); }
    .action-btns { display: flex; align-items: center; gap: 2px; }
    .action-btns button { color: var(--color-text-3); }
    .action-btns button:hover { color: var(--color-primary); }

    /* Pagination */
    .pagination { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 20px; }
    .page-info { font-size: var(--text-sm); color: var(--color-text-2); }

    .delete-item { color: var(--color-danger); }

    @media (max-width: 768px) {
      .books-container { padding: 16px 12px; }
      .books-header h1 { font-size: var(--text-2xl); }
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
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router,
    private readonly confirmDialog: ConfirmService
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

  get hasFilters(): boolean {
    return !!(this.searchQuery || this.filterStatus || this.filterCategory || this.filterCompany || this.filterSupplier || this.filterYear);
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  statusTone(status: string): ChipTone | undefined {
    return STATUS_TONES[status];
  }

  clearFilters(): void {
    const yearWasSet = !!this.filterYear;
    this.searchQuery = '';
    this.filterStatus = '';
    this.filterCategory = '';
    this.filterCompany = '';
    this.filterSupplier = '';
    this.filterYear = '';
    this.currentPage = 1;
    this.loadInvoices();
    if (yearWasSet) this.loadSummary();
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
        this.toast.error('Failed to load invoices');
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
      data: { invoice: uploadData, isNew: true, departmentId: this.departmentId }
    });
    ref.afterClosed().subscribe((result) => {
      if (result === true) {
        this.loadInvoices();
        this.loadSummary();
        this.toast.done('Invoice marked as paid');
      } else if (result === 'payment-requested') {
        this.loadInvoices();
        this.loadSummary();
        this.toast.done('Payment request submitted');
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
          data: { invoice: full, isNew: false, departmentId: this.departmentId }
        });
        ref.afterClosed().subscribe((confirmed) => {
          if (confirmed === true) {
            this.loadInvoices();
            this.loadSummary();
            this.toast.done('Invoice marked as paid');
          } else if (confirmed === 'payment-requested') {
            this.loadInvoices();
            this.loadSummary();
            this.toast.done('Payment request submitted');
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
          data: { invoice: full, isNew: false, editMode: true, departmentId: this.departmentId }
        });
        ref.afterClosed().subscribe((updated) => {
          if (updated) {
            this.loadInvoices();
            this.loadSummary();
            this.toast.done('Invoice updated');
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
      error: () => this.toast.error('Failed to load PDF')
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
      error: () => this.toast.error('Failed to download')
    });
  }

  archiveInvoice(inv: BookInvoice): void {
    this.booksService.archive(inv.id).subscribe({
      next: () => {
        this.loadInvoices();
        this.loadSummary();
        this.toast.done('Invoice rejected');
      },
      error: () => this.toast.error('Failed to reject')
    });
  }

  restoreInvoice(inv: BookInvoice): void {
    this.booksService.restore(inv.id).subscribe({
      next: () => {
        this.loadInvoices();
        this.loadSummary();
        this.toast.done('Invoice restored');
      },
      error: () => this.toast.error('Failed to restore')
    });
  }

  async deleteInvoice(inv: BookInvoice): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: inv.invoiceNumber ? `Delete invoice ${inv.invoiceNumber} from ${inv.supplierName}?` : `Delete invoice from ${inv.supplierName}?`,
      message: 'This cannot be undone.',
      confirmText: 'Delete invoice',
      danger: true
    }))) return;
    this.booksService.delete(inv.id).subscribe({
      next: () => {
        this.loadInvoices();
        this.loadSummary();
        this.toast.done('Invoice deleted');
      },
      error: () => this.toast.error('Failed to delete')
    });
  }

  analyzeSupplier(supplierName: string): void {
    const ref = this.dialog.open(SupplierAnalysisDialog, {
      width: '900px',
      maxWidth: '98vw',
      maxHeight: '90vh',
      data: { supplier: supplierName, departmentId: this.departmentId }
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
          <button aria-label="Close" mat-icon-button (click)="removeFile($event)" class="remove-btn">
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
    .dialog-header-icon { font-size: 40px; width: 40px; height: 40px; color: var(--color-primary); }
    .dialog-header h2 { margin: 8px 0 4px; font-size: var(--text-2xl); font-weight: 700; color: var(--color-text); }
    .dialog-header p { margin: 0; color: var(--color-text-3); font-size: var(--text-md); }

    .drop-zone { border: 2px dashed var(--color-line-strong); border-radius: 16px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--color-canvas); }
    .drop-zone:hover, .drop-zone.drag-over { border-color: var(--color-primary); background: var(--color-primary-soft); }
    .drop-zone.has-file { border-color: var(--color-ok); background: var(--color-ok-soft); border-style: solid; }
    .drop-content { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .drop-icon { font-size: 48px; width: 48px; height: 48px; color: var(--color-danger); }
    .drop-text { font-size: var(--text-md); font-weight: 600; color: var(--color-text-2); }
    .drop-hint { font-size: var(--text-xs); color: var(--color-text-3); }

    .file-preview { display: flex; align-items: center; gap: 12px; }
    .file-icon { font-size: 36px; width: 36px; height: 36px; color: var(--color-danger); }
    .file-details { display: flex; flex-direction: column; flex: 1; text-align: left; }
    .file-name { font-weight: 600; color: var(--color-text); font-size: var(--text-md); word-break: break-all; }
    .file-size { font-size: var(--text-xs); color: var(--color-text-3); }
    .remove-btn { color: var(--color-text-3); }

    .upload-progress { margin-top: 16px; border-radius: 8px; }
    .error-msg { margin-top: 12px; padding: 10px 16px; background: var(--color-danger-soft); border-radius: 10px; color: var(--color-danger); font-size: var(--text-sm); display: flex; align-items: center; gap: 8px; }
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
        <mat-icon class="header-icon">{{ editMode ? 'edit' : 'paid' }}</mat-icon>
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
              <mat-icon style="font-size:18px;width:18px;height:18px;color:var(--color-primary);margin-right:8px;">store</mat-icon>
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
            <option value="Tyres">Tyres</option>
            <option value="Panel &amp; Body">Panel &amp; Body</option>
            <option value="Towing">Towing</option>
            <option value="Parts &amp; Spares">Parts &amp; Spares</option>
            <option value="Auto Electrical">Auto Electrical</option>
            <option value="Licensing &amp; Permits">Licensing &amp; Permits</option>
            <option value="Tolls">Tolls</option>
            <option value="Roadworthy">Roadworthy</option>
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

        <div class="form-group" *ngIf="isLogistics">
          <label>Vehicle</label>
          <select [(ngModel)]="form.vehicleRegistration" class="form-input">
            <option value="">No vehicle / general</option>
            <option *ngFor="let v of vehicles" [value]="v.registration">
              {{ v.registration }}<ng-container *ngIf="v.make || v.model"> — {{ v.make }} {{ v.model }}</ng-container>
            </option>
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
        <button *ngIf="!editMode" mat-stroked-button color="primary" [disabled]="!form.supplierName || !form.total || saving" (click)="requestPayment()">
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
    .header-icon { font-size: 40px; width: 40px; height: 40px; color: var(--color-primary); }
    .dialog-header h2 { margin: 8px 0 4px; font-size: var(--text-2xl); font-weight: 700; color: var(--color-text); }
    .dialog-header p { margin: 0; color: var(--color-text-3); font-size: var(--text-md); }

    .extraction-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--color-warn-soft); border-radius: 12px; margin-bottom: 20px; font-size: var(--text-sm); color: var(--color-warn); }
    .extraction-banner mat-icon { color: var(--color-warn); font-size: 20px; width: 20px; height: 20px; }

    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; }
    .form-group.full-width { grid-column: 1 / -1; }
    .form-group label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-2); text-transform: uppercase; letter-spacing: .3px; }
    .form-input { padding: 10px 14px; border: 1.5px solid var(--color-line); border-radius: 10px; font-size: var(--text-md); outline: none; transition: border-color 0.2s; background: var(--color-canvas); color: var(--color-text); font-family: inherit; }
    .form-input:focus { border-color: var(--color-primary); background: var(--color-surface); }
    .form-input.highlight { border-color: var(--color-warn); background: var(--color-warn-soft); }
    .form-input.textarea { resize: vertical; min-height: 60px; }
    .amount-input-wrap { position: relative; display: flex; align-items: center; }
    .currency-prefix { position: absolute; left: 14px; font-weight: 700; color: var(--color-text-3); font-size: var(--text-md); z-index: 1; }
    .amount-input { padding-left: 32px; }

    mat-divider.full-width { grid-column: 1 / -1; margin: 4px 0; }

    .extracted-preview { margin-bottom: 16px; }
    .preview-toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--text-sm); color: var(--color-text-3); padding: 8px 0; }
    .preview-toggle:hover { color: var(--color-primary); }
    .preview-text { background: var(--color-canvas); border: 1px solid var(--color-line); border-radius: 10px; padding: 12px; font-size: var(--text-xs); color: var(--color-text-3); max-height: 150px; overflow-y: auto; white-space: pre-wrap; font-family: var(--font-mono); }

    .dialog-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; border-top: 1px solid var(--color-surface-2); }
    .dialog-actions button { border-radius: 10px; }

    .supplier-autocomplete-wrap { position: relative; }
    .autocomplete-hint-icon { position: absolute; right: 10px; top: 32px; font-size: 18px; width: 18px; height: 18px; color: var(--color-text-3); cursor: help; }

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
  vehicles: { registration: string; make?: string; model?: string }[] = [];
  deleting = false;
  departmentId = 0;

  get isLogistics(): boolean {
    return this.departmentId === 32;
  }

  constructor(
    public dialogRef: MatDialogRef<ConfirmBookInvoiceDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private booksService: BooksService
  ) {
    const inv = data.invoice;
    this.isNew = data.isNew || false;
    this.editMode = data.editMode || false;
    this.invoiceId = inv.id;
    this.departmentId = data.departmentId || 0;
    this.extractedPreview = inv.extractedText || '';

    // Load existing suppliers for autocomplete
    this.booksService.getSuppliers().subscribe({
      next: (suppliers) => {
        this.allSuppliers = suppliers.filter(s => s && s !== 'Unknown Supplier');
        this.filteredSuppliers = [];
      }
    });

    // Load fleet vehicles (used for Logistics invoice-to-vehicle linkage)
    this.booksService.getVehicles().subscribe({
      next: (vehicles) => { this.vehicles = vehicles || []; },
      error: () => { this.vehicles = []; }
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
      vehicleRegistration: inv.vehicleRegistration || '',
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

// ============================================================================
// Supplier Analysis Dialog (uses Welly AI)
// ============================================================================
@Component({
  selector: 'supplier-analysis-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatFormFieldModule, MatSelectModule, MatInputModule, FormsModule, SkeletonRowsComponent],
  template: `
    <div class="analysis-dialog">
      <div class="dialog-header">
        <h2><mat-icon>assessment</mat-icon> Supplier Invoice Analysis</h2>
        <p>Welly is analyzing invoices from <strong>{{ data.supplier }}</strong></p>
      </div>

      @if (!analyzed) {
        <div class="analysis-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Analysis Type</mat-label>
            <mat-select [(ngModel)]="analysisType">
              <mat-option value="detailed">Detailed Analysis (What, How Much, Trends)</mat-option>
              <mat-option value="spending-summary">Spending Summary (Quick Overview)</mat-option>
              <mat-option value="price-comparison">Price Comparison (Cost per Item)</mat-option>
              <mat-option value="hardware-breakdown">Hardware Purchase Breakdown (Exportable Table)</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Limit (optional)</mat-label>
            <mat-select [(ngModel)]="limit">
              <mat-option [value]="10">Last 10 invoices</mat-option>
              <mat-option [value]="20">Last 20 invoices</mat-option>
              <mat-option [value]="50">Last 50 invoices</mat-option>
              <mat-option [value]="null">All invoices</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Ask Welly Something (optional)</mat-label>
            <textarea matInput [(ngModel)]="userQuestion" rows="2" placeholder="e.g., What's our biggest spending category?"></textarea>
          </mat-form-field>

          <div class="dialog-actions">
            <button mat-button (click)="dialogRef.close()">Cancel</button>
            <button mat-raised-button color="primary" (click)="analyzeSupplier()" [disabled]="analyzing">
              @if (analyzing) {
                <mat-spinner diameter="20"></mat-spinner>
                <span>Analyzing...</span>
              } @else {
                <mat-icon>psychology</mat-icon> <span>Analyze with Welly</span>
              }
            </button>
          </div>
        </div>
      }

      @if (analyzing) {
        <div class="analyzing-state">
          <app-skeleton-rows [rows]="4" [avatar]="false"></app-skeleton-rows>
          <p>Welly is analyzing supplier invoices...</p>
          <p class="detail">Extracting items, costs, and patterns · {{ elapsed }}s elapsed</p>
        </div>
      }

      @if (analyzed && analysis) {
        <div class="analysis-results">
          <div class="result-header">
            <h3>Analysis Results</h3>
            <p class="meta">
              {{ invoiceCount }} invoices analyzed | Total spend: <strong>R{{ totalSpend | number:'1.2-2' }}</strong>
            </p>
          </div>

          @if (lineItems && lineItems.length) {
            <div class="hardware-table-wrap">
              <div class="table-toolbar">
                <span class="item-count">{{ lineItems.length }} hardware line item(s) &middot; Total: <strong>R{{ lineItemsTotal | number:'1.2-2' }}</strong></span>
                <button mat-stroked-button color="primary" (click)="exportCsv()">
                  <mat-icon>download</mat-icon> Export to Excel (CSV)
                </button>
              </div>
              <div class="hardware-table-scroll">
                <table class="app-table hardware-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Category</th>
                      <th>Invoice #</th>
                      <th>Date</th>
                      <th class="num">Qty</th>
                      <th class="num">Unit Price</th>
                      <th class="num">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of lineItems; track $index) {
                      <tr>
                        <td>{{ item.item }}</td>
                        <td>{{ item.category }}</td>
                        <td class="ref">{{ item.invoiceNumber }}</td>
                        <td>{{ item.date }}</td>
                        <td class="num">{{ item.quantity }}</td>
                        <td class="num">R{{ item.unitPrice | number:'1.2-2' }}</td>
                        <td class="num">R{{ item.lineTotal | number:'1.2-2' }}</td>
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colspan="6" class="num"><strong>Total</strong></td>
                      <td class="num"><strong>R{{ lineItemsTotal | number:'1.2-2' }}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          }

          <div class="analysis-content">
            {{ analysis }}
          </div>
          <div class="dialog-actions">
            <button mat-button (click)="copyToClipboard()">
              <mat-icon>content_copy</mat-icon> Copy
            </button>
            <button mat-raised-button color="primary" (click)="dialogRef.close()">Close</button>
          </div>
        </div>
      }

      @if (error) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <p>{{ error }}</p>
          <button mat-raised-button color="primary" (click)="dialogRef.close()">Close</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .analysis-dialog { display: flex; flex-direction: column; gap: 20px; padding: 20px; max-height: 90vh; overflow-y: auto; }
    .dialog-header { text-align: center; border-bottom: 2px solid var(--color-line); padding-bottom: 16px; }
    .dialog-header h2 { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 0 0 4px; font-size: var(--text-2xl); }
    .dialog-header p { margin: 0; color: var(--color-text-3); font-size: var(--text-md); }

    .analysis-form { display: flex; flex-direction: column; gap: 16px; }
    .full-width { width: 100%; }

    .analyzing-state, .error-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 40px 20px; text-align: center; }
    .analyzing-state app-skeleton-rows { align-self: stretch; }
    .analyzing-state p { margin: 0; color: var(--color-text-2); }
    .analyzing-state .detail { color: var(--color-text-3); font-size: var(--text-xs); }

    .analysis-results { display: flex; flex-direction: column; gap: 16px; }
    .result-header { border-bottom: 2px solid var(--color-line); padding-bottom: 12px; }
    .result-header h3 { margin: 0 0 4px; font-size: var(--text-xl); }
    .result-header .meta { margin: 0; color: var(--color-text-3); font-size: var(--text-sm); }

    .analysis-content { 
      background: var(--color-canvas); 
      border: 1px solid var(--color-line); 
      border-radius: 8px; 
      padding: 16px; 
      line-height: 1.6; 
      color: var(--color-text-2); 
      font-size: var(--text-md); 
      white-space: pre-wrap; 
      word-break: break-word;
      max-height: 400px;
      overflow-y: auto;
    }

    .error-state { color: var(--color-danger); }
    .error-state mat-icon { font-size: 40px; width: 40px; height: 40px; }

    .hardware-table-wrap { border: 1px solid var(--color-line); border-radius: 8px; overflow: hidden; }
    .table-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; background: var(--color-surface-2); border-bottom: 1px solid var(--color-line); flex-wrap: wrap; }
    .table-toolbar .item-count { font-size: var(--text-sm); color: var(--color-text-2); }
    .hardware-table-scroll { max-height: 340px; overflow: auto; }
    .hardware-table td { white-space: nowrap; }

    .dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; }

    mat-form-field { display: block; }
  `]
})
export class SupplierAnalysisDialog {
  analyzing = false;
  analyzed = false;
  analysis: string | null = null;
  error: string | null = null;
  analysisType = 'detailed';
  limit: number | null = 20;
  userQuestion = '';
  invoiceCount = 0;
  totalSpend = 0;
  elapsed = 0;
  private timerId: any = null;
  lineItems: Array<{ item: string; invoiceNumber: string; date: string; quantity: number; unitPrice: number; lineTotal: number; category: string; }> | null = null;

  get lineItemsTotal(): number {
    return (this.lineItems || []).reduce((sum, i) => sum + (i.lineTotal || 0), 0);
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { supplier: string; departmentId: number },
    public dialogRef: MatDialogRef<SupplierAnalysisDialog>,
    private http: HttpClient,
    private toast: ToastService,
    private wellyActivity: WellyActivityService
  ) {}

  analyzeSupplier(): void {
    this.analyzing = true;
    this.error = null;
    this.analysis = null;
    this.elapsed = 0;
    const started = Date.now();
    this.timerId = setInterval(() => { this.elapsed = Math.floor((Date.now() - started) / 1000); }, 1000);
    const activityId = this.wellyActivity.start(`Analyzing invoices: ${this.data.supplier}`);

    const token = localStorage.getItem('token');
    if (!token) {
      this.error = 'No authentication token found. Please log in again.';
      this.analyzing = false;
      this.toast.error(this.error);
      return;
    }

    const payload = {
      supplierName: this.data.supplier,
      limit: this.limit,
      analysisType: this.analysisType,
      userQuestion: this.userQuestion || undefined
    };

    this.http.post<any>(`${environment.apiUrl}/aichat/analyze-supplier-invoices`, payload).subscribe({
      next: (response: any) => {
        this.analyzing = false;
        this.stopTimer();
        this.wellyActivity.stop(activityId);
        this.analyzed = true;
        this.analysis = response.analysis || '';
        this.invoiceCount = response.invoicesAnalyzed || 0;
        this.totalSpend = response.totalSpend || 0;
        this.lineItems = response.lineItems || null;
      },
      error: (err: any) => {
        this.analyzing = false;
        this.stopTimer();
        this.wellyActivity.stop(activityId);
        const errorMsg = err.error?.error || err.statusText || 'Failed to analyze invoices. Please try again.';
        this.error = errorMsg;
        console.error('Analysis error:', err);
        this.toast.error(this.error || 'Error');
      }
    });
  }

  private stopTimer(): void {
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
  }

  copyToClipboard(): void {
    if (this.analysis) {
      navigator.clipboard.writeText(this.analysis);
      this.toast.done('Analysis copied to clipboard');
    }
  }

  exportCsv(): void {
    if (!this.lineItems || !this.lineItems.length) {
      this.toast.info('No line items to export');
      return;
    }

    const esc = (v: any): string => {
      const s = (v ?? '').toString();
      // Quote fields containing commas, quotes or newlines; double up embedded quotes
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    const headers = ['Item', 'Category', 'Invoice Number', 'Date', 'Quantity', 'Unit Price (R)', 'Line Total (R)'];
    const rows = this.lineItems.map(i => [
      esc(i.item), esc(i.category), esc(i.invoiceNumber), esc(i.date),
      i.quantity, (i.unitPrice ?? 0).toFixed(2), (i.lineTotal ?? 0).toFixed(2)
    ].join(','));

    const totalRow = ['', '', '', '', '', 'TOTAL', this.lineItemsTotal.toFixed(2)].join(',');
    const csv = [headers.join(','), ...rows, totalRow].join('\r\n');

    // Prepend BOM so Excel opens UTF-8 correctly
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeSupplier = (this.data.supplier || 'supplier').replace(/[^a-z0-9]+/gi, '_');
    const stamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hardware_breakdown_${safeSupplier}_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.toast.done('Hardware breakdown exported');
  }
}
