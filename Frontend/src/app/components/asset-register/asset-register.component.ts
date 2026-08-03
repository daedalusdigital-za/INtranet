import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { AssetRegisterDialogComponent } from './asset-register-dialog.component';
import { environment } from '../../../environments/environment';

interface AssetItem {
  itemId: number; locationId: number; locationName: string;
  region: string; subLocation: string; assetCode: string;
  assignedTo: string; workstation: string; category: string;
  manufacturer: string; model: string; serialNumber: string;
  specification: string; condition: string; ownershipType: string;
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
    MatDialogModule, MatProgressSpinnerModule, NavbarComponent],
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
                <th>Manufacturer</th><th>Condition</th><th>Notes</th>
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
                  <td>{{item.manufacturer || '—'}}</td>
                  <td><span class="cond-badge cond-{{condKey(item.condition)}}">{{item.condition || 'Not Assessed'}}</span></td>
                  <td class="notes-cell">{{item.notes || ''}}</td>
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
    .notes-cell { max-width:150px; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .cat-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:500; white-space:nowrap; }
    .cat-badge mat-icon { font-size:13px; width:13px; height:13px; }
    .cat-computer{background:#dbeafe;color:#1d4ed8;} .cat-monitor{background:#ede9fe;color:#7c3aed;} .cat-laptop{background:#d1fae5;color:#065f46;}
    .cat-telephone{background:#fef3c7;color:#92400e;} .cat-keyboard,.cat-mouse{background:#f3f4f6;color:#374151;} .cat-mobilephone{background:#fce7f3;color:#9d174d;} .cat-{background:#f3f4f6;color:#374151;}
    .cond-badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:500; }
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
      (i.manufacturer||'').toLowerCase().includes(s)
    );
  });

  hasFilter = computed(() => !!(this.locationId || this.regionName || this.locationName || this.selectedCategory || this.searchText || this.selectedAssignedTo));

  constructor(private route: ActivatedRoute, private router: Router, private http: HttpClient, private dialog: MatDialog) {}

  ngOnInit() {
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

  private headers(): HttpHeaders {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  initials(name: string): string { if (!name) return '?'; return name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase(); }
  regionKey(r: string): string { return r.toLowerCase().replace(/\s+/g,''); }
  regionIcon(r: string): string { const m: Record<string,string> = {'KZN':'location_city','Cape Town':'beach_access','Gauteng':'business','Eastern Cape':'landscape','Properties':'home_work','Contracts':'description'}; return m[r]||'place'; }
  categoryIcon(cat: string): string { const m: Record<string,string> = {'Computer':'computer','Monitor':'monitor','Laptop':'laptop','Telephone':'phone','Keyboard':'keyboard','Mouse':'mouse','Mobile Phone':'smartphone'}; return m[cat]||'devices'; }
  catKey(cat: string): string { return cat.toLowerCase().replace(/\s+/g,''); }
  condKey(cond: string): string { if (!cond) return 'default'; const c = cond.toLowerCase(); if (c.includes('good')||c.includes('excellent')) return 'good'; if (c.includes('fair')) return 'fair'; if (c.includes('poor')) return 'poor'; if (c.includes('not')||c.includes('assessed')) return 'notassessed'; return 'default'; }
}
