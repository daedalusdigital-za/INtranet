import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface ClientLocation {
  id: number;
  customerCode?: string;
  name: string;
  shortName?: string;
  status: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  googlePlaceId?: string;
  addressVerified: boolean;
  addressVerifiedAt?: string;
  addressVerifiedBy?: string;
  contactPerson?: string;
  phoneNumber?: string;
  savedAddressCount: number;
  updatedAt?: string;
}

interface PageResult {
  items: ClientLocation[];
  total: number;
  page: number;
  pageSize: number;
  summary: { total: number; verified: number; unverified: number; missingCoordinates: number };
}

/**
 * Admin Settings → Client Locations
 * Every customer with the delivery address stored in the database. An admin can correct and
 * VERIFY the address; verified addresses are flagged in the DB and render purple on tripsheets.
 */
@Component({
  selector: 'app-client-locations',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTooltipModule, MatProgressSpinnerModule, MatSnackBarModule, MatDialogModule, MatPaginatorModule],
  template: `
    <div class="cl-wrap">

      <!-- ═══ Google API key ═══ -->
      <div class="cl-card cl-key">
        <div class="cl-key-head">
          <mat-icon>vpn_key</mat-icon>
          <div>
            <h3>Google Maps API key</h3>
            <p>Used for address verification (Geocoding), Places autocomplete and route planning across Logistics. Changes take effect immediately.</p>
          </div>
          <span class="cl-key-src" [class.admin]="keyInfo?.source === 'admin'">
            {{ keyInfo?.source === 'admin' ? 'Admin-configured' : 'Built-in default' }}
          </span>
        </div>
        <div class="cl-key-row">
          <div class="cl-key-current">
            <span class="lbl">Current key</span>
            <code>{{ keyInfo?.masked || '—' }}</code>
            @if (keyInfo?.updatedAt) { <small>updated {{ keyInfo.updatedAt | date:'dd MMM yyyy HH:mm' }} by {{ keyInfo.updatedBy }}</small> }
          </div>
          <mat-form-field appearance="outline" class="cl-key-input">
            <mat-label>New API key</mat-label>
            <input matInput [(ngModel)]="newKey" placeholder="AIza…" autocomplete="off" [type]="showKey ? 'text' : 'password'">
            <button mat-icon-button matSuffix (click)="showKey = !showKey" type="button"><mat-icon>{{ showKey ? 'visibility_off' : 'visibility' }}</mat-icon></button>
          </mat-form-field>
          <button mat-raised-button color="primary" [disabled]="!newKey.trim() || keySaving" (click)="saveKey()"><mat-icon>save</mat-icon> Save key</button>
          <button mat-stroked-button [disabled]="keyTesting" (click)="testKey()" matTooltip="Geocode a known address with the active key"><mat-icon>network_check</mat-icon> Test</button>
          @if (keyInfo?.source === 'admin') {
            <button mat-button color="warn" (click)="resetKey()" matTooltip="Remove the admin key and fall back to the built-in default">Reset</button>
          }
        </div>
        @if (keyTestResult) {
          <div class="cl-key-test" [class.ok]="keyTestResult.ok" [class.bad]="!keyTestResult.ok">
            <mat-icon>{{ keyTestResult.ok ? 'check_circle' : 'error' }}</mat-icon>
            @if (keyTestResult.ok) { Key works — resolved "{{ keyTestResult.sample }}" ({{ keyTestResult.lat | number:'1.5-5' }}, {{ keyTestResult.lng | number:'1.5-5' }}) }
            @else { Key failed: {{ keyTestResult.error || 'no result' }} }
          </div>
        }
      </div>

      <!-- ═══ Summary ═══ -->
      <div class="cl-kpis">
        <button class="cl-kpi" [class.on]="filter === 'all'" (click)="setFilter('all')">
          <b>{{ summary.total | number }}</b><span>Customers</span></button>
        <button class="cl-kpi k-purple" [class.on]="filter === 'verified'" (click)="setFilter('verified')">
          <b>{{ summary.verified | number }}</b><span>Verified</span></button>
        <button class="cl-kpi k-amber" [class.on]="filter === 'unverified'" (click)="setFilter('unverified')">
          <b>{{ summary.unverified | number }}</b><span>Unverified</span></button>
        <button class="cl-kpi k-red" [class.on]="filter === 'nocoords'" (click)="setFilter('nocoords')">
          <b>{{ summary.missingCoordinates | number }}</b><span>No coordinates</span></button>
        <div class="cl-legend">
          <span><i class="dot green"></i> Green on tripsheets = geocoded only</span>
          <span><i class="dot purple"></i> Purple on tripsheets = admin-verified</span>
        </div>
      </div>

      <!-- ═══ Toolbar ═══ -->
      <div class="cl-toolbar">
        <mat-form-field appearance="outline" class="cl-search">
          <mat-label>Search customer, code, address or town</mat-label>
          <input matInput [ngModel]="search" (ngModelChange)="search$.next($event)" placeholder="e.g. Tygerberg">
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" class="cl-prov">
          <mat-label>Province</mat-label>
          <mat-select [(ngModel)]="province" (selectionChange)="reload()">
            <mat-option [value]="''">All</mat-option>
            @for (p of provinces; track p) { <mat-option [value]="p">{{ p }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <span class="cl-spacer"></span>
        <button mat-stroked-button (click)="reload()"><mat-icon>refresh</mat-icon> Refresh</button>
      </div>

      <!-- ═══ Table ═══ -->
      <div class="cl-table-wrap">
        @if (loading) { <div class="cl-loading"><mat-spinner diameter="32"></mat-spinner> Loading client locations…</div> }
        <table class="cl-table">
          <thead><tr>
            <th style="width:36px;"></th>
            <th>Customer</th>
            <th>Delivery address in database</th>
            <th>Town / Province</th>
            <th class="num">Coordinates</th>
            <th>Verified</th>
            <th style="width:150px;"></th>
          </tr></thead>
          <tbody>
            @for (r of rows; track r.id) {
              <tr [class.v]="r.addressVerified" [class.nc]="!r.latitude || !r.longitude">
                <td><mat-icon class="cl-pin" [class.purple]="r.addressVerified" [class.green]="!r.addressVerified && r.latitude && r.longitude" [class.grey]="!r.latitude || !r.longitude"
                      [matTooltip]="r.addressVerified ? 'Verified by ' + r.addressVerifiedBy : (r.latitude ? 'Geocoded, not verified' : 'No coordinates')">
                    {{ r.addressVerified ? 'verified' : (r.latitude ? 'location_on' : 'location_off') }}</mat-icon></td>
                <td>
                  <div class="cl-name">{{ r.name }}</div>
                  <div class="cl-sub">{{ r.customerCode || '—' }}@if (r.shortName && r.shortName !== r.name) { · {{ r.shortName }} }@if (r.savedAddressCount > 1) { · {{ r.savedAddressCount }} saved addresses }</div>
                </td>
                <td class="cl-addr">{{ r.address || '—' }}</td>
                <td>{{ r.city || '—' }}<div class="cl-sub">{{ r.province || '' }}{{ r.postalCode ? ' · ' + r.postalCode : '' }}</div></td>
                <td class="num mono">
                  @if (r.latitude && r.longitude) { {{ r.latitude | number:'1.5-5' }}, {{ r.longitude | number:'1.5-5' }} }
                  @else { <span class="cl-missing">missing</span> }
                </td>
                <td>
                  @if (r.addressVerified) {
                    <span class="cl-badge purple">Verified</span>
                    <div class="cl-sub">{{ r.addressVerifiedAt | date:'dd MMM yyyy' }} · {{ r.addressVerifiedBy }}</div>
                  } @else { <span class="cl-badge amber">Unverified</span> }
                </td>
                <td class="cl-actions">
                  <button mat-stroked-button color="primary" (click)="edit(r)"><mat-icon>{{ r.addressVerified ? 'edit_location_alt' : 'fact_check' }}</mat-icon> {{ r.addressVerified ? 'Edit' : 'Verify' }}</button>
                  @if (r.addressVerified) {
                    <button mat-icon-button matTooltip="Remove verification" (click)="unverify(r)"><mat-icon>remove_done</mat-icon></button>
                  }
                </td>
              </tr>
            } @empty { @if (!loading) { <tr><td colspan="7" class="cl-empty">No customers match</td></tr> } }
          </tbody>
        </table>
      </div>
      <mat-paginator [length]="total" [pageIndex]="page - 1" [pageSize]="pageSize" [pageSizeOptions]="[25, 50, 100, 200]" (page)="onPage($event)" showFirstLastButtons></mat-paginator>
    </div>
  `,
  styles: [`
    .cl-wrap { display: flex; flex-direction: column; gap: 16px; }
    .cl-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; }
    .cl-key-head { display: flex; gap: 12px; align-items: flex-start; }
    .cl-key-head > mat-icon { color: #7c3aed; font-size: 28px; width: 28px; height: 28px; }
    .cl-key-head h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
    .cl-key-head p { margin: 2px 0 0; font-size: 12.5px; color: #64748b; }
    .cl-key-src { margin-left: auto; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; padding: 3px 10px; border-radius: 999px; background: #f1f5f9; color: #475569; white-space: nowrap; }
    .cl-key-src.admin { background: #ede9fe; color: #5b21b6; }
    .cl-key-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
    .cl-key-row mat-form-field { margin-bottom: -1.25em; }
    .cl-key-current { display: flex; flex-direction: column; min-width: 240px; }
    .cl-key-current .lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; }
    .cl-key-current code { font-size: 14px; font-weight: 700; color: #0f172a; }
    .cl-key-current small { font-size: 11px; color: #94a3b8; }
    .cl-key-input { flex: 1; min-width: 320px; }
    .cl-key-test { display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 13px; padding: 8px 12px; border-radius: 8px; }
    .cl-key-test.ok { background: #dcfce7; color: #166534; } .cl-key-test.bad { background: #fee2e2; color: #991b1b; }
    .cl-kpis { display: flex; gap: 10px; align-items: stretch; flex-wrap: wrap; }
    .cl-kpi { background: #fff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 10px 18px; display: flex; flex-direction: column; min-width: 130px; cursor: pointer; text-align: left; font-family: inherit; }
    .cl-kpi b { font-size: 22px; color: #0f172a; } .cl-kpi span { font-size: 12px; color: #64748b; font-weight: 600; }
    .cl-kpi.on { border-color: #2563eb; background: #eff6ff; }
    .cl-kpi.k-purple b { color: #7c3aed; } .cl-kpi.k-purple.on { border-color: #7c3aed; background: #f5f3ff; }
    .cl-kpi.k-amber b { color: #d97706; } .cl-kpi.k-amber.on { border-color: #d97706; background: #fffbeb; }
    .cl-kpi.k-red b { color: #dc2626; } .cl-kpi.k-red.on { border-color: #dc2626; background: #fef2f2; }
    .cl-legend { margin-left: auto; display: flex; flex-direction: column; justify-content: center; gap: 4px; font-size: 12px; color: #475569; }
    .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
    .dot.green { background: #4caf50; } .dot.purple { background: #7c3aed; }
    .cl-toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .cl-toolbar mat-form-field { margin-bottom: -1.25em; }
    .cl-search { flex: 1; min-width: 300px; } .cl-prov { width: 200px; } .cl-spacer { flex: 1; }
    .cl-table-wrap { position: relative; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: auto; max-height: 62vh; }
    .cl-loading { position: absolute; inset: 0; background: rgba(255,255,255,.75); display: flex; align-items: center; justify-content: center; gap: 12px; z-index: 2; color: #475569; font-weight: 600; }
    .cl-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 13.5px; }
    .cl-table th { position: sticky; top: 0; z-index: 1; background: #f8fafc; text-align: left; padding: 10px 12px; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; border-bottom: 2px solid #e2e8f0; }
    .cl-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; vertical-align: top; color: #0f172a; }
    .cl-table tr.v td { background: #faf5ff; }
    .cl-table .num { text-align: right; } .mono { font-family: ui-monospace, Consolas, monospace; font-size: 12px; white-space: nowrap; }
    .cl-name { font-weight: 700; } .cl-sub { font-size: 11.5px; color: #64748b; margin-top: 2px; }
    .cl-addr { max-width: 420px; }
    .cl-pin.purple { color: #7c3aed; } .cl-pin.green { color: #4caf50; } .cl-pin.grey { color: #cbd5e1; }
    .cl-missing { color: #dc2626; font-weight: 700; font-size: 12px; }
    .cl-badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
    .cl-badge.purple { background: #ede9fe; color: #5b21b6; } .cl-badge.amber { background: #fef3c7; color: #92400e; }
    .cl-actions { white-space: nowrap; text-align: right; }
    .cl-empty { text-align: center; color: #94a3b8; padding: 30px; }
  `]
})
export class ClientLocationsComponent implements OnInit {
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private api = `${environment.apiUrl}/admin/client-locations`;

  rows: ClientLocation[] = [];
  total = 0; page = 1; pageSize = 50;
  summary = { total: 0, verified: 0, unverified: 0, missingCoordinates: 0 };
  loading = false;
  search = ''; filter: 'all' | 'verified' | 'unverified' | 'nocoords' = 'all'; province = '';
  provinces: string[] = [];
  readonly search$ = new Subject<string>();

  keyInfo: any = null; newKey = ''; showKey = false; keySaving = false; keyTesting = false; keyTestResult: any = null;

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(v => { this.search = v; this.page = 1; this.reload(); });
    this.reload();
    this.http.get<string[]>(`${this.api}/provinces`).subscribe({ next: p => this.provinces = p, error: () => {} });
    this.loadKey();
  }

  setFilter(f: typeof this.filter): void { this.filter = f; this.page = 1; this.reload(); }
  onPage(e: PageEvent): void { this.page = e.pageIndex + 1; this.pageSize = e.pageSize; this.reload(); }

  reload(): void {
    this.loading = true;
    const params: any = { page: this.page, pageSize: this.pageSize, filter: this.filter };
    if (this.search.trim()) params.search = this.search.trim();
    if (this.province) params.province = this.province;
    this.http.get<PageResult>(this.api, { params }).subscribe({
      next: r => { this.rows = r.items; this.total = r.total; this.summary = r.summary; this.loading = false; },
      error: e => { this.loading = false; this.snack.open(e?.error?.message || 'Failed to load client locations', 'Close', { duration: 5000 }); }
    });
  }

  edit(r: ClientLocation): void {
    const ref = this.dialog.open(VerifyClientLocationDialog, { width: '760px', maxWidth: '95vw', data: { row: r, api: this.api } });
    ref.afterClosed().subscribe((updated: ClientLocation | undefined) => {
      if (!updated) return;
      const i = this.rows.findIndex(x => x.id === updated.id);
      if (i >= 0) this.rows[i] = updated;
      this.reload();
    });
  }

  unverify(r: ClientLocation): void {
    if (!confirm(`Remove verification from ${r.name}? The address stays, but tripsheets will show it green instead of purple.`)) return;
    this.http.post<ClientLocation>(`${this.api}/${r.id}/unverify`, {}).subscribe({
      next: () => { this.snack.open(`Verification removed for ${r.name}`, 'Close', { duration: 3000 }); this.reload(); },
      error: e => this.snack.open(e?.error?.message || 'Failed', 'Close', { duration: 4000 })
    });
  }

  // ── Google key ──
  loadKey(): void { this.http.get<any>(`${this.api}/google-api-key`).subscribe({ next: k => this.keyInfo = k, error: () => {} }); }
  saveKey(): void {
    this.keySaving = true; this.keyTestResult = null;
    this.http.put<any>(`${this.api}/google-api-key`, { apiKey: this.newKey.trim() }).subscribe({
      next: k => { this.keyInfo = k; this.newKey = ''; this.keySaving = false; this.snack.open('Google API key saved — active immediately', 'Close', { duration: 4000 }); },
      error: e => { this.keySaving = false; this.snack.open(e?.error?.message || 'Failed to save key', 'Close', { duration: 5000 }); }
    });
  }
  resetKey(): void {
    if (!confirm('Remove the admin-configured key and fall back to the built-in default?')) return;
    this.http.put<any>(`${this.api}/google-api-key`, { apiKey: '' }).subscribe({ next: k => { this.keyInfo = k; this.snack.open('Reverted to built-in key', 'Close', { duration: 3000 }); } });
  }
  testKey(): void {
    this.keyTesting = true; this.keyTestResult = null;
    this.http.post<any>(`${this.api}/google-api-key/test`, {}).subscribe({
      next: r => { this.keyTestResult = r; this.keyTesting = false; },
      error: e => { this.keyTesting = false; this.keyTestResult = { ok: false, error: e?.error?.message || 'Request failed' }; }
    });
  }
}

// ═══ Verify / edit dialog ═══
@Component({
  selector: 'app-verify-client-location-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatTooltipModule, MatProgressSpinnerModule, MatAutocompleteModule],
  template: `
    <h2 mat-dialog-title><mat-icon style="vertical-align:middle;margin-right:8px;color:#7c3aed;">verified</mat-icon> Verify delivery address</h2>
    <mat-dialog-content class="vd">
      <div class="vd-cust">
        <b>{{ data.row.name }}</b>
        <span>{{ data.row.customerCode || '' }}{{ data.row.shortName && data.row.shortName !== data.row.name ? ' · ' + data.row.shortName : '' }}</span>
        @if (data.row.addressVerified) { <span class="vd-badge">Currently verified by {{ data.row.addressVerifiedBy }} on {{ data.row.addressVerifiedAt | date:'dd MMM yyyy' }}</span> }
      </div>

      @if (saved.length > 1) {
        <div class="vd-saved">
          <span class="vd-lbl">Other saved addresses for this customer (click to use)</span>
          @for (a of saved; track a.id) {
            <button class="vd-saved-item" [class.cur]="a.isVerified" (click)="useSaved(a)">
              <mat-icon>{{ a.isVerified ? 'verified' : 'place' }}</mat-icon>
              <span class="t">{{ a.formattedAddress || a.address }}</span>
              <span class="m">{{ a.addressLabel || '' }}{{ a.usageCount ? ' · used ' + a.usageCount + 'x' : '' }}</span>
            </button>
          }
        </div>
      }

      <mat-form-field appearance="outline" class="full">
        <mat-label>Delivery address</mat-label>
        <input matInput [(ngModel)]="address" (ngModelChange)="onAddressTyped($event)" [matAutocomplete]="auto" placeholder="Start typing — Google suggestions appear below" autocomplete="off">
        @if (suggesting) { <mat-spinner matSuffix diameter="18" style="margin-right:8px;"></mat-spinner> } @else { <mat-icon matSuffix style="color:#94a3b8;">travel_explore</mat-icon> }
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onSuggestionPicked($event)" class="vd-auto">
          @for (s of suggestions; track s.placeId) {
            <mat-option [value]="s.description">
              <div class="vd-sug"><mat-icon>place</mat-icon><div><b>{{ s.mainText || s.description }}</b><small>{{ s.secondaryText }}</small></div></div>
            </mat-option>
          }
        </mat-autocomplete>
        <mat-hint>@if (suggestError) { <span style="color:#dc2626;">{{ suggestError }}</span> } @else { Pick a Google suggestion to auto-fill coordinates, or type freely and click Geocode. }</mat-hint>
      </mat-form-field>

      <div class="vd-row">
        <mat-form-field appearance="outline"><mat-label>Town / City</mat-label><input matInput [(ngModel)]="city"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Province</mat-label><input matInput [(ngModel)]="province"></mat-form-field>
        <mat-form-field appearance="outline" class="short"><mat-label>Postal code</mat-label><input matInput [(ngModel)]="postalCode"></mat-form-field>
      </div>
      <div class="vd-row">
        <mat-form-field appearance="outline"><mat-label>Latitude</mat-label><input matInput type="number" step="any" [(ngModel)]="latitude"></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Longitude</mat-label><input matInput type="number" step="any" [(ngModel)]="longitude"></mat-form-field>
        <button mat-stroked-button color="primary" (click)="geocode()" [disabled]="geocoding || !address.trim()" class="vd-geo">
          @if (geocoding) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>my_location</mat-icon> } Geocode with Google
        </button>
        @if (latitude && longitude) {
          <a mat-icon-button [href]="'https://www.google.com/maps?q=' + latitude + ',' + longitude" target="_blank" matTooltip="Open in Google Maps"><mat-icon>map</mat-icon></a>
        }
      </div>
      @if (geoResult) {
        <div class="vd-geo-res" [class.ok]="geoResult.success && !geoResult.isApproximate" [class.warn]="geoResult.success && geoResult.isApproximate" [class.bad]="!geoResult.success">
          <mat-icon>{{ geoResult.success ? (geoResult.isApproximate ? 'wrong_location' : 'check_circle') : 'error' }}</mat-icon>
          <div>
            @if (geoResult.success) {
              <b>{{ geoResult.formattedAddress }}</b>
              <div class="s">{{ geoResult.locationType || '' }}{{ geoResult.isApproximate ? ' — approximate only (area match). Refine the address before verifying.' : ' — precise match' }}</div>
              @if (geoResult.formattedAddress && geoResult.formattedAddress !== address) {
                <button mat-button color="primary" (click)="address = geoResult.formattedAddress">Use Google's formatted address</button>
              }
            } @else { Could not geocode: {{ geoResult.error || 'no match' }} }
          </div>
        </div>
      }
      <mat-form-field appearance="outline" class="full">
        <mat-label>Delivery instructions (optional)</mat-label>
        <input matInput [(ngModel)]="instructions" placeholder="e.g. Deliver to pharmacy stores, gate 3, ask for Sr Dlamini">
      </mat-form-field>
      <p class="vd-note"><mat-icon>info</mat-icon> Verifying saves this as the customer's default delivery address, records your name and the date, and shows the stop in <b style="color:#7c3aed;">purple</b> on tripsheets so planners know it has been checked.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!canSave() || saving" (click)="save()" style="background:#7c3aed;">
        <mat-icon>verified</mat-icon> {{ data.row.addressVerified ? 'Save & keep verified' : 'Verify address' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .vd { display: flex; flex-direction: column; gap: 4px; padding-top: 6px !important; }
    .vd-cust { display: flex; flex-direction: column; gap: 2px; margin-bottom: 12px; }
    .vd-cust b { font-size: 16px; } .vd-cust span { font-size: 12.5px; color: #64748b; }
    .vd-badge { display: inline-block; margin-top: 4px; background: #ede9fe; color: #5b21b6 !important; font-weight: 600; padding: 2px 10px; border-radius: 999px; width: fit-content; }
    .vd-saved { border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px 10px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow: auto; }
    .vd-lbl { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }
    .vd-saved-item { display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 10px; cursor: pointer; text-align: left; font-family: inherit; font-size: 13px; }
    .vd-saved-item:hover { background: #eff6ff; } .vd-saved-item.cur { border-color: #7c3aed; background: #f5f3ff; }
    .vd-saved-item mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; } .vd-saved-item.cur mat-icon { color: #7c3aed; }
    .vd-saved-item .m { font-size: 11px; color: #94a3b8; white-space: nowrap; }
    .full { width: 100%; }
    .vd-sug { display: flex; gap: 8px; align-items: center; line-height: 1.2; padding: 2px 0; }
    .vd-sug mat-icon { color: #7c3aed; font-size: 18px; width: 18px; height: 18px; }
    .vd-sug b { display: block; font-size: 13px; } .vd-sug small { font-size: 11.5px; color: #64748b; }
    .vd-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .vd-row mat-form-field { flex: 1; min-width: 150px; } .vd-row .short { flex: 0 0 130px; min-width: 130px; }
    .vd-geo { height: 48px; margin-bottom: 1.25em; white-space: nowrap; }
    .vd-geo-res { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; }
    .vd-geo-res.ok { background: #dcfce7; color: #166534; } .vd-geo-res.warn { background: #fef3c7; color: #92400e; } .vd-geo-res.bad { background: #fee2e2; color: #991b1b; }
    .vd-geo-res .s { font-size: 12px; opacity: .85; margin-top: 2px; }
    .vd-note { display: flex; gap: 8px; align-items: center; font-size: 12.5px; color: #64748b; margin: 0; }
    .vd-note mat-icon { color: #2563eb; font-size: 18px; width: 18px; height: 18px; }
  `]
})
export class VerifyClientLocationDialog implements OnInit {
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  address = ''; city = ''; province = ''; postalCode = '';
  latitude: number | null = null; longitude: number | null = null; placeId: string | null = null;
  instructions = '';
  saved: any[] = [];
  geocoding = false; saving = false; geoResult: any = null;
  suggestions: any[] = []; suggesting = false; suggestError = '';
  private readonly typed$ = new Subject<string>();
  private coordsFromAddress = '';

  constructor(public ref: MatDialogRef<VerifyClientLocationDialog>, @Inject(MAT_DIALOG_DATA) public data: { row: ClientLocation; api: string }) {}

  ngOnInit(): void {
    const r = this.data.row;
    this.address = r.address || ''; this.city = r.city || ''; this.province = r.province || ''; this.postalCode = r.postalCode || '';
    this.latitude = r.latitude ?? null; this.longitude = r.longitude ?? null; this.placeId = r.googlePlaceId || null;
    this.coordsFromAddress = this.address;
    this.http.get<any[]>(`${this.data.api}/${r.id}/addresses`).subscribe({
      next: a => { this.saved = a; const v = a.find(x => x.isVerified) || a.find(x => x.isDefault); if (v?.deliveryInstructions) this.instructions = v.deliveryInstructions; },
      error: () => {}
    });
    // Google Places suggestions, proxied through the API (uses the admin-configured key)
    this.typed$.pipe(
      debounceTime(250), distinctUntilChanged(),
      switchMap(q => {
        if (!q || q.trim().length < 3) { this.suggesting = false; return of([] as any[]); }
        this.suggesting = true; this.suggestError = '';
        return this.http.get<any[]>(`${this.data.api}/suggest`, { params: { q: q.trim() } }).pipe(
          catchError(e => { this.suggestError = e?.error?.message || 'Suggestions unavailable'; return of([] as any[]); })
        );
      })
    ).subscribe(list => { this.suggestions = list; this.suggesting = false; });
  }

  onAddressTyped(v: string): void { this.dirtyAddress(); this.typed$.next(v); }

  onSuggestionPicked(e: MatAutocompleteSelectedEvent): void {
    const s = this.suggestions.find(x => x.description === e.option.value);
    if (!s) return;
    this.address = s.description; this.suggestions = [];
    // Resolve the chosen place to exact coordinates + components
    this.geocoding = true; this.geoResult = null;
    this.http.get<any>(`${this.data.api}/geocode`, { params: { address: s.description, placeId: s.placeId } }).subscribe({
      next: g => { this.geocoding = false; this.applyGeo(g); },
      error: err => { this.geocoding = false; this.geoResult = { success: false, error: err?.error?.message || 'Request failed' }; }
    });
  }

  private applyGeo(g: any): void {
    this.geoResult = g;
    if (g?.success && g.latitude && g.longitude) {
      this.latitude = g.latitude; this.longitude = g.longitude; this.placeId = g.placeId || this.placeId;
      this.city = g.city || this.city; this.province = g.province || this.province; this.postalCode = g.postalCode || this.postalCode;
      this.coordsFromAddress = this.address;
    }
  }

  dirtyAddress(): void {
    // Coordinates belonged to the previous address text — clear so the admin re-geocodes.
    if (this.address.trim() !== this.coordsFromAddress.trim()) { this.latitude = null; this.longitude = null; this.placeId = null; this.geoResult = null; }
  }

  useSaved(a: any): void {
    this.address = a.formattedAddress || a.address; this.city = a.city || this.city; this.province = a.province || this.province; this.postalCode = a.postalCode || this.postalCode;
    this.latitude = a.latitude ?? null; this.longitude = a.longitude ?? null; this.placeId = a.googlePlaceId || null;
    this.coordsFromAddress = this.address; this.geoResult = null;
  }

  geocode(): void {
    this.geocoding = true; this.geoResult = null;
    this.http.get<any>(`${this.data.api}/geocode`, { params: { address: this.address.trim() } }).subscribe({
      next: g => { this.geocoding = false; this.applyGeo(g); },
      error: e => { this.geocoding = false; this.geoResult = { success: false, error: e?.error?.message || 'Request failed' }; }
    });
  }

  canSave(): boolean { return !!this.address.trim() && this.latitude != null && this.longitude != null; }

  save(): void {
    this.saving = true;
    const body = {
      address: this.address.trim(), city: this.city || null, province: this.province || null, postalCode: this.postalCode || null,
      latitude: this.latitude, longitude: this.longitude, googlePlaceId: this.placeId,
      deliveryInstructions: this.instructions || null, requireCoordinates: true
    };
    this.http.put<ClientLocation>(`${this.data.api}/${this.data.row.id}/verify`, body).subscribe({
      next: r => { this.snack.open(`✓ ${r.name} verified — will show purple on tripsheets`, 'Close', { duration: 4000 }); this.ref.close(r); },
      error: e => { this.saving = false; this.snack.open(e?.error?.message || 'Failed to verify address', 'Close', { duration: 5000 }); }
    });
  }
}
