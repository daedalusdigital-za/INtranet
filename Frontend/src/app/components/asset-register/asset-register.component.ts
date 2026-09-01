import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as XLSX from 'xlsx';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { AssetRegisterDialogComponent } from './asset-register-dialog.component';
import { AssetPasswordDialogComponent } from './asset-password-dialog.component';
import { AssetInvoicePreviewDialogComponent, AssetInvoicePreviewData } from './asset-invoice-preview-dialog.component';
import { AssetInvoiceMatchDialogComponent } from './asset-invoice-match-dialog.component';
import { AssetManualLinkDialogComponent, ManualLinkDialogData } from './asset-manual-link-dialog.component';
import { environment } from '../../../environments/environment';

interface AssetItem {
  itemId: number; locationId: number; locationName: string;
  region: string; subLocation: string; assetCode: string;
  assignedTo: string; workstation: string; category: string;
  manufacturer: string; model: string; serialNumber: string;
  invoiceNumber: string; bookInvoiceId: number | null;
  specification: string; condition: string; value: number | null; marketValue: number | null; ownershipType: string;
  notes: string; isActive: boolean;
}
interface AssetSummary {
  totalAssets: number;
  byRegion: { region: string; locationCount: number; assetCount: number }[];
  byCategory: { category: string; count: number }[];
}

@Component({
  selector: 'app-asset-register',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule,
    MatDialogModule, MatProgressSpinnerModule, MatTooltipModule, NavbarComponent],
  template: `
    <app-navbar></app-navbar>
    <div class="asset-container">
      <div class="asset-header">
        <div class="header-left">
          <div class="header-icon-wrap"><mat-icon class="header-icon">inventory_2</mat-icon></div>
          <div>
            <h1>Asset Register</h1>
            <p class="subtitle">
              @if (regionName || locationName) {
                <span class="crumb" (click)="goHome()">All Regions</span>
                <span class="crumb-sep">›</span>
                @if (locationName && locationName !== regionName) {
                  <span class="crumb" (click)="filterRegionOnly()">{{ regionName }}</span>
                  <span class="crumb-sep">›</span>
                  <span class="crumb active">{{ locationName }}</span>
                } @else {
                  <span class="crumb active">{{ regionName }}</span>
                }
              } @else {
                All Locations — {{ summary()?.totalAssets || 0 }} assets
              }
            </p>
          </div>
        </div>
        <div class="header-actions">
          <button mat-stroked-button class="change-btn" (click)="exportToExcel()" [disabled]="filteredItems().length === 0" matTooltip="Export current view to Excel">
            <mat-icon>file_download</mat-icon> Export Excel
          </button>
          <button mat-stroked-button class="change-btn" (click)="exportMasterList()" [disabled]="exportingMaster()" matTooltip="Export a consolidated master list of ALL assets across every region and location">
            @if (exportingMaster()) { <mat-icon class="spin">progress_activity</mat-icon> Building… }
            @else { <mat-icon>library_books</mat-icon> Master Excel }
          </button>
          <button mat-stroked-button class="change-btn ai-match-btn" (click)="openInvoiceMatch()" matTooltip="Let Welly match assets to Books invoices (quantity-aware, no double-counting)">
            <mat-icon>auto_awesome</mat-icon> AI Match Invoices
          </button>
          <button mat-stroked-button class="change-btn" (click)="changeLocation()">
            <mat-icon>swap_horiz</mat-icon> Change Location
          </button>
        </div>
      </div>

      @if (!hasFilter() && summary()) {
        <div class="summary-cards">
          @for (r of summary()!.byRegion; track r.region) {
            <div class="summary-card" (click)="filterByRegion(r.region)">
              <div class="sc-icon region-{{regionKey(r.region)}}"><mat-icon>{{regionIcon(r.region)}}</mat-icon></div>
              <div class="sc-info">
                <div class="sc-name">{{r.region}}</div>
                <div class="sc-count">{{r.assetCount}} assets · {{r.locationCount}} locations</div>
              </div>
              <mat-icon class="sc-arrow">chevron_right</mat-icon>
            </div>
          }
        </div>
        <div class="cat-chips">
          @for (c of summary()!.byCategory; track c.category) {
            <div class="cat-chip" (click)="filterByCategory(c.category)">
              <mat-icon class="cat-icon">{{categoryIcon(c.category)}}</mat-icon>
              {{c.category}} <span class="cat-count">{{c.count}}</span>
            </div>
          }
        </div>
      }

      @if (hasFilter()) {
        <div class="filter-bar">
          <div class="search-wrap">
            <mat-icon class="search-icon">search</mat-icon>
            <input class="search-input" [(ngModel)]="searchText" placeholder="Search name, model, serial…">
            @if (searchText) { <button class="clear-search" (click)="searchText=''"><mat-icon>close</mat-icon></button> }
          </div>
          <select class="filter-select" [(ngModel)]="selectedCategory" (ngModelChange)="loadItems()">
            <option value="">All Categories</option>
            @for (c of categories; track c) { <option [value]="c">{{c}}</option> }
          </select>
          <select class="filter-select" [(ngModel)]="selectedAssignedTo" (ngModelChange)="loadItems()">
            <option value="">All Users</option>
            @for (u of assignedUsers(); track u) { <option [value]="u">{{u}}</option> }
          </select>
          <span class="result-count">{{filteredItems().length}} assets</span>
          <button class="clear-filters" (click)="clearFilters()"><mat-icon>filter_alt_off</mat-icon> Clear</button>
        </div>
      }

      @if (loading()) {
        <div class="loading-wrap"><mat-spinner diameter="48"></mat-spinner></div>
      }

      @if (!loading() && filteredItems().length > 0) {
        <div class="table-wrap">
          <table class="assets-table">
            <thead>
              <tr>
                <th>Location</th><th>Assigned To</th><th>Category</th>
                <th>Model / Description</th><th>Serial Number</th>
                <th>Invoice #</th><th>Book Value</th><th>Market Value</th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.itemId) {
                <tr>
                  <td><span class="loc-badge">{{item.locationName}}</span></td>
                  <td class="assigned-cell">
                    <div class="person-avatar">{{initials(item.assignedTo)}}</div>
                    <span>{{item.assignedTo || '—'}}</span>
                  </td>
                  <td>
                    <span class="cat-badge cat-{{catKey(item.category)}}">
                      <mat-icon>{{categoryIcon(item.category)}}</mat-icon> {{item.category}}
                    </span>
                  </td>
                  <td class="model-cell">{{item.model || '—'}}</td>
                  <td class="serial-cell">{{item.serialNumber || '—'}}</td>
                  <td class="invoice-cell">
                    @if (item.invoiceNumber) {
                      <button class="invoice-link" (click)="openInvoicePreview(item)" matTooltip="Preview invoice from Books">
                        <mat-icon>receipt_long</mat-icon>{{item.invoiceNumber}}
                        @if (item.bookInvoiceId) { <span class="inv-linked" title="Linked in Books"></span> }
                      </button>
                      <button class="inv-relink" (click)="openManualLink(item)" matTooltip="Change / re-link invoice">
                        <mat-icon>edit</mat-icon>
                      </button>
                    } @else {
                      <button class="inv-link-btn" (click)="openManualLink(item)" matTooltip="Link this asset to a Books invoice (incl. scanned invoices)">
                        <mat-icon>add_link</mat-icon> Link
                      </button>
                    }
                  </td>
                  <td class="value-cell">{{ formatValue(item.value) }}</td>
                  <td class="value-cell">{{ formatValue(item.marketValue) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (!loading() && hasFilter() && filteredItems().length === 0 && !loading()) {
        <div class="empty-state">
          <mat-icon>inventory</mat-icon>
          <h3>No assets found</h3>
          <p>Try adjusting your search or filters.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%); }
    .asset-container { max-width: 1400px; margin: 0 auto; padding: 24px 20px 60px; }
    .asset-header { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:28px; flex-wrap:wrap; }
    .header-left { display:flex; align-items:center; gap:16px; }
    .header-icon-wrap { width:56px; height:56px; border-radius:16px; background:rgba(255,255,255,0.2); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .header-icon { color:white; font-size:30px; width:30px; height:30px; }
    .asset-header h1 { margin:0; color:white; font-size:24px; font-weight:700; }
    .subtitle { margin:4px 0 0; color:rgba(255,255,255,0.8); font-size:14px; display:flex; align-items:center; gap:6px; }
    .crumb { cursor:pointer; } .crumb:hover { text-decoration:underline; } .crumb.active { font-weight:600; color:white; } .crumb-sep { opacity:0.6; }
    .change-btn { color:white !important; border-color:rgba(255,255,255,0.5) !important; } .change-btn mat-icon { margin-right:6px; }
    .change-btn .spin { animation:spin 1s linear infinite; }
    @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
    .summary-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; margin-bottom:20px; }
    .summary-card { background:white; border-radius:14px; padding:16px; display:flex; align-items:center; gap:14px; cursor:pointer; transition:all 0.2s; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
    .summary-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.15); }
    .sc-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .sc-icon mat-icon { color:white; font-size:22px; width:22px; height:22px; }
    .region-kzn { background:linear-gradient(135deg,#6366f1,#4f46e5); }
    .region-capetown { background:linear-gradient(135deg,#0ea5e9,#0284c7); }
    .region-gauteng { background:linear-gradient(135deg,#f59e0b,#d97706); }
    .region-easterncape { background:linear-gradient(135deg,#10b981,#059669); }
    .region-properties { background:linear-gradient(135deg,#ec4899,#db2777); }
    .region-contracts { background:linear-gradient(135deg,#64748b,#475569); }
    .sc-info { flex:1; } .sc-name { font-weight:700; color:#1f2937; font-size:15px; } .sc-count { font-size:12px; color:#6b7280; margin-top:2px; } .sc-arrow { color:#9ca3af; }
    .cat-chips { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:24px; }
    .cat-chip { background:rgba(255,255,255,0.15); color:white; border-radius:20px; padding:8px 16px; font-size:13px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:6px; border:1px solid rgba(255,255,255,0.25); transition:background 0.2s; }
    .cat-chip:hover { background:rgba(255,255,255,0.25); }
    .cat-icon { font-size:16px; width:16px; height:16px; }
    .cat-count { background:rgba(255,255,255,0.25); border-radius:10px; padding:1px 7px; font-size:11px; }
    .filter-bar { background:white; border-radius:14px; padding:14px 18px; display:flex; align-items:center; gap:12px; margin-bottom:18px; box-shadow:0 2px 8px rgba(0,0,0,0.08); flex-wrap:wrap; }
    .search-wrap { flex:1; min-width:200px; position:relative; display:flex; align-items:center; background:#f3f4f6; border-radius:8px; padding:0 12px; }
    .search-icon { color:#9ca3af; font-size:20px; width:20px; height:20px; margin-right:8px; }
    .search-input { border:none; background:transparent; outline:none; font-size:14px; color:#1f2937; width:100%; padding:10px 0; }
    .clear-search { background:none; border:none; cursor:pointer; color:#9ca3af; display:flex; align-items:center; }
    .filter-select { border:1px solid #e5e7eb; border-radius:8px; padding:8px 12px; font-size:13px; color:#374151; background:white; outline:none; cursor:pointer; }
    .result-count { font-size:13px; color:#6b7280; white-space:nowrap; }
    .clear-filters { background:none; border:1px solid #e5e7eb; border-radius:8px; padding:6px 12px; font-size:12px; color:#374151; cursor:pointer; display:flex; align-items:center; gap:4px; }
    .clear-filters mat-icon { font-size:16px; width:16px; height:16px; }
    .table-wrap { background:white; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); overflow-x:auto; }
    .assets-table { width:100%; border-collapse:collapse; font-size:13px; }
    .assets-table thead tr { background:#f8fafc; border-bottom:2px solid #e5e7eb; }
    .assets-table th { padding:12px 14px; text-align:left; font-weight:600; color:#374151; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; }
    .assets-table tbody tr { border-bottom:1px solid #f1f5f9; transition:background 0.15s; }
    .assets-table tbody tr:hover { background:#f8fafc; }
    .assets-table td { padding:10px 14px; color:#374151; vertical-align:middle; }
    .assigned-cell { display:flex; align-items:center; gap:8px; white-space:nowrap; }
    .person-avatar { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#4f46e5); color:white; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .loc-badge { background:#eff6ff; color:#1d4ed8; border-radius:6px; padding:3px 8px; font-size:12px; font-weight:500; white-space:nowrap; }
    .model-cell { max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .serial-cell { font-family:monospace; font-size:12px; color:#6b7280; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .invoice-cell { white-space:nowrap; }
    .invoice-link { display:inline-flex; align-items:center; gap:5px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; border-radius:8px; padding:4px 10px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s; font-family:inherit; }
    .invoice-link:hover { background:#dbeafe; border-color:#93c5fd; transform:translateY(-1px); box-shadow:0 2px 6px rgba(37,99,235,0.2); }
    .invoice-link mat-icon { font-size:15px; width:15px; height:15px; }
    .inv-linked { width:7px; height:7px; border-radius:50%; background:#10b981; display:inline-block; }
    .no-invoice { color:#cbd5e1; }
    .inv-relink { display:inline-flex; align-items:center; justify-content:center; margin-left:4px; background:transparent; border:none; color:#94a3b8; cursor:pointer; padding:2px; border-radius:6px; vertical-align:middle; transition:all 0.15s; }
    .inv-relink:hover { color:#2563eb; background:#eff6ff; }
    .inv-relink mat-icon { font-size:15px; width:15px; height:15px; }
    .inv-link-btn { display:inline-flex; align-items:center; gap:4px; background:#f8fafc; color:#64748b; border:1px dashed #cbd5e1; border-radius:8px; padding:4px 10px; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s; font-family:inherit; }
    .inv-link-btn:hover { background:#eff6ff; color:#1d4ed8; border-color:#93c5fd; }
    .inv-link-btn mat-icon { font-size:15px; width:15px; height:15px; }
    .notes-cell { max-width:150px; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cat-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:500; white-space:nowrap; }
    .cat-badge mat-icon { font-size:13px; width:13px; height:13px; }
    .cat-computer{background:#dbeafe;color:#1d4ed8;} .cat-monitor{background:#ede9fe;color:#7c3aed;} .cat-laptop{background:#d1fae5;color:#065f46;}
    .cat-telephone{background:#fef3c7;color:#92400e;} .cat-keyboard,.cat-mouse{background:#f3f4f6;color:#374151;} .cat-mobilephone{background:#fce7f3;color:#9d174d;} .cat-{background:#f3f4f6;color:#374151;}
    .cond-badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:500; }
    .value-cell { font-weight:600; color:#065f46; white-space:nowrap; }
    .cond-good{background:#d1fae5;color:#065f46;} .cond-fair{background:#fef3c7;color:#92400e;} .cond-poor{background:#fee2e2;color:#991b1b;} .cond-notassessed,.cond-default{background:#f3f4f6;color:#6b7280;}
    .loading-wrap { display:flex; justify-content:center; padding:60px; }
    .empty-state { background:white; border-radius:16px; padding:60px; text-align:center; }
    .empty-state mat-icon { font-size:56px; width:56px; height:56px; color:#d1d5db; }
    .empty-state h3 { color:#374151; margin:16px 0 8px; } .empty-state p { color:#6b7280; }
  `]
})
export class AssetRegisterComponent implements OnInit {
  locationKey = '';
  locationName = '';
  regionName = '';
  locationId: number | null = null;

  items = signal<AssetItem[]>([]);
  summary = signal<AssetSummary | null>(null);
  loading = signal(false);
  searchText = '';
  selectedCategory = '';
  selectedAssignedTo = '';
  assignedUsers = signal<string[]>([]);
  exportingMaster = signal(false);

  categories = ['Computer','Monitor','Laptop','Telephone','Keyboard','Mouse','Mobile Phone'];

  filteredItems = computed(() => {
    const s = this.searchText.toLowerCase();
    if (!s) return this.items();
    return this.items().filter(i =>
      (i.assignedTo||'').toLowerCase().includes(s) ||
      (i.model||'').toLowerCase().includes(s) ||
      (i.serialNumber||'').toLowerCase().includes(s) ||
      (i.category||'').toLowerCase().includes(s) ||
      (i.locationName||'').toLowerCase().includes(s) ||
      (i.invoiceNumber||'').toLowerCase().includes(s) ||
      (i.manufacturer||'').toLowerCase().includes(s)
    );
  });

  hasFilter = computed(() => !!(this.locationId || this.regionName || this.locationName || this.selectedCategory || this.searchText || this.selectedAssignedTo));

  constructor(private route: ActivatedRoute, private router: Router, private http: HttpClient, private dialog: MatDialog, private snack: MatSnackBar) {}

  ngOnInit() {
    if (!this.ensureAccess()) return;
    this.init();
  }

  /** Password gate — requires access code 0000. Cached per browser session. */
  private ensureAccess(): boolean {
    if (sessionStorage.getItem('assetRegisterAuthed') === 'true') return true;
    const ref = this.dialog.open(AssetPasswordDialogComponent, {
      width: '420px', maxWidth: '95vw', disableClose: true, panelClass: 'asset-pw-panel'
    });
    ref.afterClosed().subscribe(ok => {
      if (ok) {
        sessionStorage.setItem('assetRegisterAuthed', 'true');
        this.init();
      } else {
        this.router.navigate(['/dashboard']);
      }
    });
    return false;
  }

  private init() {
    this.loadAssignedUsers();
    this.route.queryParams.subscribe(params => {
      this.locationKey = params['location'] || '';
      this.locationName = params['name'] || '';
      this.regionName = params['regionName'] || '';
      this.locationId = params['locationId'] ? +params['locationId'] : null;
      this.loadSummary();
      if (this.regionName || this.locationName || this.locationId) this.loadItems();
    });
  }

  loadSummary() {
    this.http.get<AssetSummary>(`${environment.apiUrl}/asset-register/summary`, { headers: this.headers() }).subscribe({ next: s => this.summary.set(s), error: () => {} });
  }

  loadAssignedUsers() {
    this.http.get<string[]>(`${environment.apiUrl}/asset-register/assigned-users`, { headers: this.headers() }).subscribe({ next: u => this.assignedUsers.set(u), error: () => {} });
  }

  loadItems() {
    this.loading.set(true);
    let url = `${environment.apiUrl}/asset-register/items?`;
    if (this.locationId) url += `locationId=${this.locationId}&`;
    else if (this.regionName && this.locationName && this.locationName !== this.regionName) url += `region=${encodeURIComponent(this.regionName)}&subLocation=${encodeURIComponent(this.locationName)}&`;
    else if (this.regionName) url += `region=${encodeURIComponent(this.regionName)}&`;
    if (this.selectedCategory) url += `category=${encodeURIComponent(this.selectedCategory)}&`;
    if (this.selectedAssignedTo) url += `assignedTo=${encodeURIComponent(this.selectedAssignedTo)}&`;
    this.http.get<AssetItem[]>(url, { headers: this.headers() }).subscribe({ next: d => { this.items.set(d); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  filterByRegion(region: string) { this.router.navigate(['/asset-register'], { queryParams: { regionName: region } }); }
  filterByCategory(cat: string) { this.selectedCategory = cat; if (!this.regionName) this.regionName = ''; this.loadItems(); }
  filterRegionOnly() { this.router.navigate(['/asset-register'], { queryParams: { regionName: this.regionName } }); }
  goHome() { this.router.navigate(['/asset-register']); }
  clearFilters() { this.searchText = ''; this.selectedCategory = ''; this.selectedAssignedTo = ''; this.loadItems(); }

  changeLocation() {
    const ref = this.dialog.open(AssetRegisterDialogComponent, { width: '580px', maxWidth: '95vw', maxHeight: '80vh' });
    ref.afterClosed().subscribe(result => { if (result) this.router.navigate(['/asset-register'], { queryParams: result }); });
  }

  /** Open Welly's AI invoice-matching panel, scoped to the current filter. */
  openInvoiceMatch() {
    const ref = this.dialog.open(AssetInvoiceMatchDialogComponent, {
      width: '760px', maxWidth: '95vw', maxHeight: '90vh',
      data: {
        locationId: this.locationId,
        region: this.regionName,
        subLocation: (this.locationName && this.locationName !== this.regionName) ? this.locationName : '',
        category: this.selectedCategory
      }
    });
    ref.afterClosed().subscribe(res => {
      if (res?.applied > 0) {
        this.snack.open(`${res.applied} asset(s) linked to invoices.`, 'Close', { duration: 3500 });
        this.loadItems();
      }
    });
  }

  private headers(): HttpHeaders {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  /** Resolve the asset's invoice against the Books module and open a preview. */
  openInvoicePreview(item: AssetItem) {
    const url = `${environment.apiUrl}/asset-register/resolve-invoice?itemId=${item.itemId}&invoiceNumber=${encodeURIComponent(item.invoiceNumber || '')}`;
    this.http.get<any>(url, { headers: this.headers() }).subscribe({
      next: (res) => {
        if (!res?.found) {
          this.dialog.open(AssetInvoicePreviewDialogComponent, {
            panelClass: 'asset-invoice-panel', maxWidth: '95vw',
            data: { found: false, invoiceNumber: item.invoiceNumber } as AssetInvoicePreviewData
          });
          return;
        }
        // Fetch the PDF/file as an authenticated blob, then preview it.
        this.http.get(`${environment.apiUrl}/Books/${res.bookInvoiceId}/view`, {
          headers: this.headers(), responseType: 'blob'
        }).subscribe({
          next: (blob) => {
            const blobUrl = URL.createObjectURL(blob);
            const data: AssetInvoicePreviewData = {
              found: true,
              invoiceNumber: res.invoiceNumber,
              supplierName: res.supplierName,
              total: res.total,
              currency: res.currency,
              invoiceDate: res.invoiceDate,
              status: res.status,
              fileName: res.fileName,
              contentType: res.contentType || blob.type,
              blobUrl,
              downloadName: res.fileName
            };
            const ref = this.dialog.open(AssetInvoicePreviewDialogComponent, {
              panelClass: 'asset-invoice-panel', maxWidth: '95vw', data
            });
            ref.afterClosed().subscribe(() => URL.revokeObjectURL(blobUrl));
          },
          error: () => this.snack.open('Invoice found but the file could not be loaded.', 'Close', { duration: 4000 })
        });
      },
      error: () => this.snack.open('Failed to look up invoice.', 'Close', { duration: 4000 })
    });
  }

  /** Open the manual link dialog so an admin can attach any Books invoice (incl. scanned ones). */
  openManualLink(item: AssetItem) {
    const who = item.assignedTo ? ` — ${item.assignedTo}` : '';
    const desc = `${item.category}${item.model ? ' · ' + item.model : ''}${who}`;
    const ref = this.dialog.open(AssetManualLinkDialogComponent, {
      panelClass: 'asset-invoice-panel', maxWidth: '95vw',
      data: {
        itemId: item.itemId,
        assetDescription: desc,
        currentInvoiceNumber: item.invoiceNumber,
        currentBookInvoiceId: item.bookInvoiceId
      } as ManualLinkDialogData
    });
    ref.afterClosed().subscribe(res => {
      if (res?.linked) {
        this.snack.open('Invoice linked to asset.', 'Close', { duration: 3000 });
        this.loadItems();
      }
    });
  }

  /** Export the currently filtered assets to an Excel workbook. */
  exportToExcel() {
    const rows = this.filteredItems();
    if (!rows.length) { this.snack.open('Nothing to export.', 'Close', { duration: 2500 }); return; }
    const data = rows.map(i => ({
      'Location': i.locationName || '',
      'Region': i.region || '',
      'Assigned To': i.assignedTo || '',
      'Category': i.category || '',
      'Model / Description': i.model || '',
      'Serial Number': i.serialNumber || '',
      'Invoice #': i.invoiceNumber || '',
      'Linked in Books': i.bookInvoiceId ? 'Yes' : 'No',
      'Book Value (R)': i.value ?? '',
      'Market Value (R)': i.marketValue ?? '',
      'Notes': i.notes || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = this.assetColWidths();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Assets');
    const scope = this.locationName || this.regionName || 'All';
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `AssetRegister_${scope.replace(/[^a-z0-9]+/gi, '-')}_${stamp}.xlsx`);
    this.snack.open(`Exported ${rows.length} assets to Excel`, 'Close', { duration: 3000 });
  }

  /**
   * Export a consolidated MASTER list of every asset across all regions and
   * locations — regardless of the current view/filters. Produces a multi-sheet
   * workbook: a full "Master List", a "Summary" sheet, and one sheet per region.
   */
  exportMasterList() {
    this.exportingMaster.set(true);
    // Unfiltered call returns all active assets across the whole organisation.
    this.http.get<AssetItem[]>(`${environment.apiUrl}/asset-register/items`, { headers: this.headers() }).subscribe({
      next: (all) => {
        try {
          if (!all.length) { this.snack.open('No assets to export.', 'Close', { duration: 2500 }); return; }

          const wb = XLSX.utils.book_new();

          // 1) Master List — every asset
          const master = XLSX.utils.json_to_sheet(this.mapAssetRows(all));
          master['!cols'] = this.assetColWidths();
          XLSX.utils.book_append_sheet(wb, master, 'Master List');

          // 2) Summary — counts by region and by category
          const byRegion = this.countBy(all, i => i.region || 'Unassigned');
          const byCategory = this.countBy(all, i => i.category || 'Uncategorised');
          const totalValue = all.reduce((sum, i) => sum + (Number(i.value) || 0), 0);
          const totalMarketValue = all.reduce((sum, i) => sum + (Number(i.marketValue) || 0), 0);
          const summaryRows = [
            { Section: 'TOTAL ASSETS', Name: '', Count: all.length },
            { Section: 'TOTAL BOOK VALUE (R)', Name: '', Count: totalValue },
            { Section: 'TOTAL MARKET VALUE (R)', Name: '', Count: totalMarketValue },
            { Section: '', Name: '', Count: '' },
            { Section: 'BY REGION', Name: '', Count: '' },
            ...byRegion.map(r => ({ Section: '', Name: r.key, Count: r.count })),
            { Section: '', Name: '', Count: '' },
            { Section: 'BY CATEGORY', Name: '', Count: '' },
            ...byCategory.map(c => ({ Section: '', Name: c.key, Count: c.count })),
          ];
          const summary = XLSX.utils.json_to_sheet(summaryRows);
          summary['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 10 }];
          XLSX.utils.book_append_sheet(wb, summary, 'Summary');

          // 3) One sheet per region for easy distribution
          for (const r of byRegion) {
            const regionItems = all.filter(i => (i.region || 'Unassigned') === r.key);
            const ws = XLSX.utils.json_to_sheet(this.mapAssetRows(regionItems));
            ws['!cols'] = this.assetColWidths();
            // Excel sheet names: max 31 chars, no special chars
            const safe = r.key.replace(/[\\/?*\[\]:]/g, ' ').slice(0, 28) || 'Region';
            XLSX.utils.book_append_sheet(wb, ws, safe);
          }

          const stamp = new Date().toISOString().slice(0, 10);
          XLSX.writeFile(wb, `AssetRegister_MASTER_${stamp}.xlsx`);
          this.snack.open(`Master list exported — ${all.length} assets across ${byRegion.length} regions`, 'Close', { duration: 4000 });
        } finally {
          this.exportingMaster.set(false);
        }
      },
      error: () => {
        this.exportingMaster.set(false);
        this.snack.open('Failed to build master list. Please try again.', 'Close', { duration: 4000 });
      }
    });
  }

  /** Shared row shape used by both the view export and the master export. */
  private mapAssetRows(rows: AssetItem[]) {
    return rows.map(i => ({
      'Location': i.locationName || '',
      'Region': i.region || '',
      'Assigned To': i.assignedTo || '',
      'Category': i.category || '',
      'Model / Description': i.model || '',
      'Serial Number': i.serialNumber || '',
      'Invoice #': i.invoiceNumber || '',
      'Linked in Books': i.bookInvoiceId ? 'Yes' : 'No',
      'Book Value (R)': i.value ?? '',
      'Market Value (R)': i.marketValue ?? '',
      'Notes': i.notes || ''
    }));
  }

  /** Column widths shared across all asset sheets. */
  private assetColWidths() {
    return [
      { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 30 },
      { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 30 }
    ];
  }

  /** Group + count helper, sorted by count descending. */
  private countBy(rows: AssetItem[], keyFn: (i: AssetItem) => string) {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = keyFn(r);
      map.set(k, (map.get(k) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }


  initials(name: string): string { if (!name) return '?'; return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase(); }
  regionKey(r: string): string { return r.toLowerCase().replace(/\s+/g,''); }
  regionIcon(r: string): string { const m: Record<string,string> = {'KZN':'location_city','Cape Town':'beach_access','Gauteng':'business','Eastern Cape':'landscape','Properties':'home_work','Contracts':'description'}; return m[r]||'place'; }
  categoryIcon(cat: string): string { const m: Record<string,string> = {'Computer':'computer','Monitor':'monitor','Laptop':'laptop','Telephone':'phone','Keyboard':'keyboard','Mouse':'mouse','Mobile Phone':'smartphone'}; return m[cat]||'devices'; }
  catKey(cat: string): string { return cat.toLowerCase().replace(/\s+/g,''); }
  condKey(cond: string): string { if (!cond) return 'default'; const c = cond.toLowerCase(); if (c.includes('good')||c.includes('excellent')) return 'good'; if (c.includes('fair')) return 'fair'; if (c.includes('poor')) return 'poor'; if (c.includes('not')||c.includes('assessed')) return 'notassessed'; return 'default'; }

  /** Format a monetary value as South African Rand, or an em dash when unset. */
  formatValue(v: number | null | undefined): string {
    if (v === null || v === undefined || isNaN(Number(v))) return '—';
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(Number(v));
  }
}
