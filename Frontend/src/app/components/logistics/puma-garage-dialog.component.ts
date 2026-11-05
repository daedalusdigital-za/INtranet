import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ToastService } from '../../ui/toast.service';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

interface PumaOrder {
  id?: number;
  orderNumber: string;
  driverName?: string | null;
  vehicleType?: string | null;
  registration?: string | null;
  capacity?: number | null;
  litersFilled?: number | null;
  value?: number | null;
  date?: string | null;
  period?: string | null;
  notes?: string | null;
  status?: 'Open' | 'Closed' | string;
  hasSlip?: boolean;
  slipFileName?: string | null;
  slipUploadedAt?: string | null;
  closedAt?: string | null;
  closedByName?: string | null;
  createdAt?: string;
}

/**
 * Puma Garage (Bronkhorstspruit, GP) fuel fill-ups — an alternative fuel source
 * to TFN. Lists captured orders, supports paste-import of the monthly sheet,
 * plus add/delete of individual rows.
 */
@Component({
  selector: 'app-puma-garage-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule,
    MatIconModule, MatTooltipModule, MatProgressSpinnerModule, EmptyStateComponent
  ],
  template: `
    <div class="puma-dialog">
      <div class="puma-header">
        <div class="puma-title">
          <div class="puma-logo"><mat-icon>local_gas_station</mat-icon></div>
          <div>
            <h2>Puma Garage</h2>
            <span class="puma-sub">Rocket Freight · Bronkhorstspruit, GP</span>
          </div>
        </div>
        <button aria-label="Close" mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <!-- KPI strip -->
      <div class="puma-kpis">
        <div class="puma-kpi" [class.warn]="openCount() > 0">
          <span class="k-label">Open · awaiting slip</span>
          <span class="k-value">{{ openCount() }}</span>
        </div>
        <div class="puma-kpi">
          <span class="k-label">Orders</span>
          <span class="k-value">{{ orders.length }}</span>
        </div>
        <div class="puma-kpi">
          <span class="k-label">Litres Filled</span>
          <span class="k-value">{{ totalLitres() | number:'1.2-2' }} L</span>
        </div>
        <div class="puma-kpi">
          <span class="k-label">Total Value</span>
          <span class="k-value">R {{ totalValue() | number:'1.2-2' }}</span>
        </div>
        <div class="puma-kpi">
          <span class="k-label">Date Range</span>
          <span class="k-value sm">{{ dateRange() }}</span>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="puma-toolbar">
        <div class="puma-search">
          <mat-icon>search</mat-icon>
          <input type="text" [(ngModel)]="search" (ngModelChange)="applyFilter()"
                 placeholder="Search order, driver, registration, vehicle type…" />
        </div>
        <span class="spacer"></span>
        <div class="status-filter">
          <button type="button" [class.on]="statusFilter === 'Open'" (click)="setStatus('Open')">Open</button>
          <button type="button" [class.on]="statusFilter === 'Closed'" (click)="setStatus('Closed')">Closed</button>
          <button type="button" [class.on]="statusFilter === 'All'" (click)="setStatus('All')">All</button>
        </div>
        <button mat-flat-button color="primary" (click)="toggleAdd()">
          <mat-icon>add</mat-icon> {{ showAdd ? 'Hide' : 'New Order' }}
        </button>
        <button mat-stroked-button (click)="toggleImport()">
          <mat-icon>content_paste</mat-icon> {{ showImport ? 'Hide Import' : 'Import sheet' }}
        </button>
        <button aria-label="Refresh" mat-icon-button (click)="reload()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
      </div>

      <!-- New order form -->
      @if (showAdd) {
        <div class="puma-add">
          <p class="hint">
            Capture the order from the garage. It stays <b>Open</b> until a <b>JPG/PNG photo of the filled slip</b> is uploaded and the order is closed.
          </p>
          <div class="form-grid">
            <label class="f">
              <span>Order number *</span>
              <input type="text" [(ngModel)]="newOrder.orderNumber" placeholder="e.g. 642" autofocus />
            </label>
            <label class="f">
              <span>Registration *</span>
              <select [(ngModel)]="selectedVehicleId" (ngModelChange)="onVehiclePicked($event)">
                <option [ngValue]="null">— choose vehicle —</option>
                @for (v of vehicles; track v.id) {
                  <option [ngValue]="v.id">{{ v.registrationNumber }}{{ v.vehicleTypeName ? ' · ' + v.vehicleTypeName : '' }}{{ v.currentDriverName ? ' · ' + v.currentDriverName : '' }}</option>
                }
                <option [ngValue]="-1">Other / not on the fleet list…</option>
              </select>
              @if (selectedVehicleId === -1) {
                <input type="text" [(ngModel)]="newOrder.registration" placeholder="Type the registration" class="mt" />
              }
            </label>
            <label class="f">
              <span>Driver *</span>
              <select [(ngModel)]="selectedDriverId" (ngModelChange)="onDriverPicked($event)">
                <option [ngValue]="null">— choose driver —</option>
                @for (d of drivers; track d.id) {
                  <option [ngValue]="d.id">{{ d.firstName }} {{ d.lastName }}</option>
                }
                <option [ngValue]="-1">Other / not on the driver list…</option>
              </select>
              @if (selectedDriverId === -1) {
                <input type="text" [(ngModel)]="newOrder.driverName" placeholder="Type the driver's name" class="mt" />
              }
            </label>
            <label class="f">
              <span>Litres ordered *</span>
              <input type="number" min="1" step="1" [(ngModel)]="newOrder.litersFilled" placeholder="e.g. 500" />
            </label>
            <label class="f">
              <span>Vehicle type</span>
              <input type="text" [(ngModel)]="newOrder.vehicleType" placeholder="auto from fleet" />
            </label>
            <label class="f">
              <span>Date</span>
              <input type="date" [(ngModel)]="newOrder.date" />
            </label>
            <label class="f wide">
              <span>Notes</span>
              <input type="text" [(ngModel)]="newOrder.notes" placeholder="optional" />
            </label>
          </div>
          <div class="import-actions">
            <button mat-flat-button color="primary" [disabled]="!canSave() || saving" (click)="doAdd()">
              @if (saving) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>add_task</mat-icon> }
              Create open order
            </button>
            <button mat-button (click)="toggleAdd()">Cancel</button>
            @if (!canSave()) { <span class="req-hint">Order number, registration, driver and litres are required.</span> }
          </div>
        </div>
      }

      <!-- Import panel -->
      @if (showImport) {
        <div class="puma-import">
          <p class="hint">
            Paste rows straight from the Puma / Rocket Freight sheet
            (columns: <b>Order · Driver · Vehicle Type · Registration · Capacity · Litres · Value · Date</b>).
            Header and blank rows are ignored automatically.
          </p>
          <div class="import-row">
            <input class="period-input" type="text" [(ngModel)]="importPeriod"
                   placeholder="Period label (e.g. MARCH 2026)" />
          </div>
          <textarea [(ngModel)]="importText" rows="8"
                    placeholder="ROCF092&#9;SANDILE&#9;8 TON&#9;BJ87TBZN&#9;315&#9;182,25&#9;R3 790,85&#9;01.03.2026"></textarea>
          <div class="import-actions">
            <button mat-flat-button color="primary" [disabled]="importing || !importText.trim()" (click)="doImport()">
              @if (importing) { <mat-spinner diameter="18"></mat-spinner> } @else { <mat-icon>upload</mat-icon> }
              Import Orders
            </button>
            <button mat-button (click)="importText=''">Clear</button>
          </div>
        </div>
      }

      <!-- Table -->
      <div class="puma-table-wrap">
        @if (filtered.length === 0) {
          @if (orders.length) {
            <app-empty-state icon="search_off" [title]="search.trim() ? 'No orders match “' + search.trim() + '”' : 'No ' + statusFilter.toLowerCase() + ' orders'"
                             message="Search looks at the order number, driver, registration and vehicle type.">
              <button mat-stroked-button (click)="search = ''; statusFilter = 'All'; applyFilter()">Show all</button>
            </app-empty-state>
          } @else {
            <app-empty-state icon="local_gas_station" title="No Puma Garage orders yet"
                             message="Press “New Order” to capture one from the garage, or import a monthly sheet.">
              @if (!showAdd) {
                <button mat-stroked-button (click)="toggleAdd()"><mat-icon>add</mat-icon> New Order</button>
              }
            </app-empty-state>
          }
        } @else {
          <table class="app-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Order #</th><th>Driver</th><th>Vehicle</th><th>Registration</th>
                <th class="num">Litres</th><th class="num">Value</th>
                <th>Date</th><th>Slip</th><th></th>
              </tr>
            </thead>
            <tbody>
              @for (o of filtered; track o.id) {
                <tr [class.open-row]="o.status !== 'Closed'">
                  <td>
                    @if (o.status === 'Closed') {
                      <span class="pill closed" [matTooltip]="'Closed ' + (o.closedAt | date:'dd MMM HH:mm') + (o.closedByName ? ' by ' + o.closedByName : '')"><mat-icon>check_circle</mat-icon> Closed</span>
                    } @else if (o.hasSlip) {
                      <span class="pill ready" matTooltip="Slip uploaded – ready to close"><mat-icon>task_alt</mat-icon> Slip in</span>
                    } @else {
                      <span class="pill open" matTooltip="Waiting for a photo of the filled slip"><mat-icon>hourglass_top</mat-icon> Open</span>
                    }
                  </td>
                  <td class="ref b">{{ o.orderNumber }}</td>
                  <td>{{ o.driverName || '—' }}</td>
                  <td>{{ o.vehicleType || '—' }}</td>
                  <td class="ref">{{ o.registration || '—' }}</td>
                  <td class="num">{{ o.litersFilled != null ? (o.litersFilled | number:'1.0-2') : '—' }}</td>
                  <td class="num b">{{ o.value != null ? ('R ' + (o.value | number:'1.2-2')) : '—' }}</td>
                  <td>{{ o.date ? (o.date | date:'dd MMM yyyy') : '—' }}</td>
                  <td class="slip-cell">
                    @if (o.hasSlip) {
                      <button type="button" class="slip-thumb" (click)="viewSlip(o)" matTooltip="View slip photo">
                        <mat-icon>image</mat-icon>
                      </button>
                    }
                    @if (o.status !== 'Closed') {
                      <button mat-stroked-button class="slip-btn" (click)="pickSlip(o)" [disabled]="uploadingId === o.id">
                        @if (uploadingId === o.id) { <mat-spinner diameter="16"></mat-spinner> } @else { <mat-icon>photo_camera</mat-icon> }
                        {{ o.hasSlip ? 'Replace' : 'Upload slip' }}
                      </button>
                    }
                  </td>
                  <td class="row-actions">
                    @if (o.status !== 'Closed') {
                      <button mat-flat-button color="primary" class="close-btn" [disabled]="!o.hasSlip || closingId === o.id"
                              [matTooltip]="o.hasSlip ? 'Close this order' : 'Upload the slip photo first'" (click)="doClose(o)">
                        <mat-icon>lock</mat-icon> Close
                      </button>
                    } @else {
                      <button aria-label="Reopen" mat-icon-button matTooltip="Reopen" (click)="doReopen(o)"><mat-icon>lock_open</mat-icon></button>
                    }
                    <button aria-label="Delete" mat-icon-button color="warn" matTooltip="Delete" (click)="doDelete(o)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>
      <input #slipInput type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" capture="environment" hidden (change)="onSlipChosen($event)" />
    </div>
  `,
  styles: [`
    .puma-dialog { display: flex; flex-direction: column; max-height: 88vh; }
    .puma-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; border-bottom: 1px solid var(--color-line);
    }
    .puma-title { display: flex; align-items: center; gap: 14px; }
    .puma-logo {
      width: 46px; height: 46px; border-radius: var(--radius-md); display: grid; place-items: center;
      background: var(--color-primary-soft); color: var(--color-primary);
    }
    .puma-logo mat-icon { color: var(--color-primary); }
    .puma-title h2 { margin: 0; font-size: var(--text-2xl); font-weight: 700; color: var(--color-text); }
    .puma-sub { font-size: var(--text-sm); color: var(--color-text-3); }

    .puma-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px 20px 4px; }
    .puma-kpi {
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md);
      padding: 12px 14px; display: flex; flex-direction: column; gap: 4px;
    }
    .puma-kpi .k-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); }
    .puma-kpi .k-value { font-size: var(--text-xl); font-weight: 700; color: var(--color-text); font-variant-numeric: tabular-nums; }
    .puma-kpi .k-value.sm { font-size: var(--text-sm); font-weight: 600; }

    .puma-toolbar { display: flex; align-items: center; gap: 10px; padding: 14px 20px; flex-wrap: wrap; }
    .puma-toolbar .spacer { flex: 1; }
    .puma-search {
      display: flex; align-items: center; gap: 8px; flex: 1 1 320px; min-width: 240px;
      background: var(--color-surface-2); border-radius: 10px; padding: 8px 12px;
    }
    .puma-search mat-icon { color: var(--color-text-3); font-size: var(--text-2xl); width: 20px; height: 20px; }
    .puma-search input { border: none; background: transparent; outline: none; width: 100%; font-size: var(--text-md); color: var(--color-text); }

    .puma-import, .puma-add { margin: 0 20px 8px; padding: 16px; background: var(--color-canvas); border: 1px dashed var(--color-line-strong); border-radius: var(--radius-md); }
    .puma-import .hint { margin: 0 0 10px; font-size: var(--text-sm); color: var(--color-text-3); }
    .puma-import textarea, .period-input {
      width: 100%; border: 1px solid var(--color-line-strong); border-radius: 8px; padding: 10px 12px;
      font-family: var(--font-mono); font-size: var(--text-sm); box-sizing: border-box;
      background: var(--color-surface); color: var(--color-text);
    }
    .import-row { margin-bottom: 8px; }
    .period-input { font-family: inherit; max-width: 280px; }
    .import-actions { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
    .import-actions mat-spinner { margin-right: 4px; }

    .add-grid { display: none; }

    .puma-table-wrap { overflow: auto; padding: 4px 20px 20px; flex: 1; }
    .app-table .b { font-weight: 700; }
    .app-table .row-actions { text-align: right; padding-top: 0; padding-bottom: 0; white-space: nowrap; }
    .app-table tr.open-row td { background: color-mix(in srgb, var(--color-warning) 7%, transparent); }

    .puma-kpi.warn { border-color: var(--color-warning); }
    .puma-kpi.warn .k-value { color: var(--color-warning); }

    .status-filter { display: inline-flex; border: 1px solid var(--color-line-strong); border-radius: 999px; overflow: hidden; }
    .status-filter button { border: none; background: transparent; padding: 6px 14px; font-size: var(--text-sm); cursor: pointer; color: var(--color-text-2); }
    .status-filter button.on { background: var(--color-primary); color: var(--color-on-primary); font-weight: 600; }

    .puma-add { border-style: solid; border-color: var(--color-primary); }
    .puma-add .hint { margin: 0 0 12px; font-size: var(--text-sm); color: var(--color-text-3); }
    .form-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .form-grid .f { display: flex; flex-direction: column; gap: 4px; }
    .form-grid .f.wide { grid-column: span 2; }
    .form-grid .f > span { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); }
    .form-grid input, .form-grid select {
      border: 1px solid var(--color-line-strong); border-radius: 8px; padding: 9px 11px; font-size: var(--text-sm);
      box-sizing: border-box; background: var(--color-surface); color: var(--color-text); width: 100%; font-family: inherit;
    }
    .form-grid .mt { margin-top: 6px; }
    .req-hint { font-size: var(--text-xs); color: var(--color-text-3); }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; white-space: nowrap; }
    .pill mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .pill.open { background: color-mix(in srgb, var(--color-warning) 18%, transparent); color: var(--color-warning); }
    .pill.ready { background: color-mix(in srgb, var(--color-info, #1e88e5) 16%, transparent); color: var(--color-info, #1e88e5); }
    .pill.closed { background: color-mix(in srgb, var(--color-ok) 16%, transparent); color: var(--color-ok); }

    .slip-cell { white-space: nowrap; }
    .slip-thumb { border: 1px solid var(--color-line-strong); background: var(--color-surface); border-radius: 8px; width: 34px; height: 34px; display: inline-grid; place-items: center; cursor: pointer; margin-right: 6px; vertical-align: middle; }
    .slip-thumb mat-icon { color: var(--color-primary); }
    .slip-btn { height: 32px; line-height: 32px; font-size: var(--text-xs); }
    .slip-btn mat-spinner { display: inline-block; margin-right: 4px; }
    .close-btn { height: 32px; line-height: 32px; font-size: var(--text-xs); margin-right: 4px; }

    @media (max-width: 720px) {
      .puma-kpis, .form-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class PumaGarageDialog {
  @ViewChild('slipInput') slipInput!: ElementRef<HTMLInputElement>;

  orders: PumaOrder[] = [];
  filtered: PumaOrder[] = [];
  search = '';
  apiUrl = '';
  statusFilter: 'Open' | 'Closed' | 'All' = 'Open';

  showImport = false;
  showAdd = false;
  importText = '';
  importPeriod = '';
  importing = false;

  drivers: Array<{ id: number; firstName: string; lastName: string; status?: string }> = [];
  vehicles: Array<{ id: number; registrationNumber: string; vehicleTypeName?: string; currentDriverId?: number | null; currentDriverName?: string | null; tankSize?: number | null }> = [];
  selectedVehicleId: number | null = null;
  selectedDriverId: number | null = null;
  saving = false;

  uploadingId: number | null = null;
  closingId: number | null = null;
  private slipTarget: PumaOrder | null = null;

  newOrder: PumaOrder = { orderNumber: '' };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { orders: PumaOrder[]; apiUrl: string },
    private dialogRef: MatDialogRef<PumaGarageDialog>,
    private http: HttpClient,
    private toast: ToastService
  ) {
    this.apiUrl = data.apiUrl;
    this.orders = [...(data.orders || [])];
    this.applyFilter();
    // Always refresh from the server so KPIs are current.
    this.reload();
    this.loadLookups();
  }

  private loadLookups(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/drivers`).subscribe({
      next: (d) => {
        this.drivers = (d || [])
          .filter(x => !['inactive', 'terminated'].includes((x.status || '').toLowerCase()))
          .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
      },
      error: () => this.drivers = []
    });
    this.http.get<any[]>(`${this.apiUrl}/fleet/vehicles`).subscribe({
      next: (v) => {
        this.vehicles = (v || [])
          .filter(x => !!x.registrationNumber)
          .sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber));
      },
      error: () => this.vehicles = []
    });
  }

  onVehiclePicked(id: number | null): void {
    if (id == null || id === -1) {
      if (id === -1) { this.newOrder.registration = ''; this.newOrder.vehicleType = ''; }
      return;
    }
    const v = this.vehicles.find(x => x.id === id);
    if (!v) return;
    this.newOrder.registration = v.registrationNumber;
    this.newOrder.vehicleType = v.vehicleTypeName || this.newOrder.vehicleType || '';
    this.newOrder.capacity = v.tankSize ?? this.newOrder.capacity ?? null;
    // Pre-select the vehicle's assigned driver if we know it
    if (v.currentDriverId && this.drivers.some(d => d.id === v.currentDriverId)) {
      this.selectedDriverId = v.currentDriverId;
      this.onDriverPicked(v.currentDriverId);
    }
  }

  onDriverPicked(id: number | null): void {
    if (id == null) { this.newOrder.driverName = ''; return; }
    if (id === -1) { this.newOrder.driverName = ''; return; }
    const d = this.drivers.find(x => x.id === id);
    if (d) this.newOrder.driverName = `${d.firstName} ${d.lastName}`.trim();
  }

  canSave(): boolean {
    return !!(this.newOrder.orderNumber?.trim()
      && this.newOrder.registration?.trim()
      && this.newOrder.driverName?.trim()
      && this.newOrder.litersFilled && this.newOrder.litersFilled > 0);
  }

  private resetForm(): void {
    this.newOrder = { orderNumber: '', date: new Date().toISOString().slice(0, 10) };
    this.selectedVehicleId = null;
    this.selectedDriverId = null;
  }

  private base() { return `${this.apiUrl}/logistics/pumagarageorders`; }

  reload(): void {
    this.http.get<PumaOrder[]>(this.base()).subscribe({
      next: (o) => { this.orders = o || []; this.applyFilter(); },
      error: () => { /* keep existing */ }
    });
  }

  applyFilter(): void {
    const t = this.search.trim().toLowerCase();
    this.filtered = this.orders.filter(o => {
      const isClosed = o.status === 'Closed';
      if (this.statusFilter === 'Open' && isClosed) return false;
      if (this.statusFilter === 'Closed' && !isClosed) return false;
      if (!t) return true;
      return !!(o.orderNumber?.toLowerCase().includes(t) ||
        o.driverName?.toLowerCase().includes(t) ||
        o.registration?.toLowerCase().includes(t) ||
        o.vehicleType?.toLowerCase().includes(t));
    });
  }

  setStatus(s: 'Open' | 'Closed' | 'All'): void { this.statusFilter = s; this.applyFilter(); }
  openCount(): number { return this.orders.filter(o => o.status !== 'Closed').length; }

  pickSlip(o: PumaOrder): void {
    this.slipTarget = o;
    this.slipInput.nativeElement.value = '';
    this.slipInput.nativeElement.click();
  }

  onSlipChosen(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    const target = this.slipTarget;
    if (!file || !target?.id) return;
    const okType = /^image\/(jpeg|png)$/i.test(file.type) || /\.(jpe?g|png)$/i.test(file.name);
    if (!okType) { this.toast.error('Only JPG or PNG photos of the slip are accepted.'); return; }
    const form = new FormData();
    form.append('file', file, file.name);
    this.uploadingId = target.id;
    this.http.post<PumaOrder>(`${this.base()}/${target.id}/slip`, form).subscribe({
      next: (updated) => {
        this.uploadingId = null;
        Object.assign(target, updated);
        this.applyFilter();
        this.toast.done(`Slip uploaded for order ${target.orderNumber}. You can close it now.`);
      },
      error: (err) => { this.uploadingId = null; this.toast.error(err.error?.message || 'Upload failed.'); }
    });
  }

  viewSlip(o: PumaOrder): void {
    if (!o.id) return;
    this.http.get(`${this.base()}/${o.id}/slip`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.toast.error('Could not open the slip.')
    });
  }

  doClose(o: PumaOrder): void {
    if (!o.id || !o.hasSlip) { this.toast.error('Upload the slip photo first.'); return; }
    this.closingId = o.id;
    this.http.post<PumaOrder>(`${this.base()}/${o.id}/close`, {}).subscribe({
      next: (updated) => {
        this.closingId = null;
        Object.assign(o, updated);
        this.applyFilter();
        this.toast.done(`Order ${o.orderNumber} closed.`);
      },
      error: (err) => { this.closingId = null; this.toast.error(err.error?.message || 'Could not close the order.'); }
    });
  }

  doReopen(o: PumaOrder): void {
    if (!o.id) return;
    this.http.post<PumaOrder>(`${this.base()}/${o.id}/reopen`, {}).subscribe({
      next: (updated) => { Object.assign(o, updated); this.applyFilter(); this.toast.done(`Order ${o.orderNumber} reopened.`); },
      error: () => this.toast.error('Could not reopen the order.')
    });
  }

  totalLitres(): number { return this.orders.reduce((s, o) => s + (o.litersFilled || 0), 0); }
  totalValue(): number { return this.orders.reduce((s, o) => s + (o.value || 0), 0); }
  dateRange(): string {
    const dates = this.orders.map(o => o.date).filter(Boolean).map(d => new Date(d as string)).sort((a, b) => +a - +b);
    if (dates.length === 0) return '—';
    const fmt = (d: Date) => d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
    return dates.length === 1 ? fmt(dates[0]) : `${fmt(dates[0])} → ${fmt(dates[dates.length - 1])}`;
  }

  toggleImport(): void { this.showImport = !this.showImport; if (this.showImport) this.showAdd = false; }
  toggleAdd(): void {
    this.showAdd = !this.showAdd;
    if (this.showAdd) { this.showImport = false; this.resetForm(); }
  }

  doImport(): void {
    if (!this.importText.trim()) return;
    this.importing = true;
    this.http.post<any>(`${this.base()}/import`, {
      text: this.importText, period: this.importPeriod?.trim() || null, overwrite: true
    }).subscribe({
      next: (res) => {
        this.importing = false;
        this.toast.done(
          `Imported ${res.imported} new, updated ${res.updated}, skipped ${res.skipped}.`);
        this.importText = '';
        this.showImport = false;
        this.reload();
      },
      error: (err) => {
        this.importing = false;
        this.toast.error(err.error?.message || 'Import failed.');
      }
    });
  }

  doAdd(): void {
    if (!this.canSave() || this.saving) return;
    this.saving = true;
    const payload: PumaOrder = {
      ...this.newOrder,
      orderNumber: this.newOrder.orderNumber.trim(),
      registration: (this.newOrder.registration || '').trim().toUpperCase(),
      driverName: (this.newOrder.driverName || '').trim(),
      date: this.newOrder.date || new Date().toISOString().slice(0, 10)
    };
    this.http.post<PumaOrder>(this.base(), payload).subscribe({
      next: (created) => {
        this.saving = false;
        this.toast.done(`Order ${created.orderNumber} created – upload the slip photo when it's filled.`);
        this.resetForm();
        this.showAdd = false;
        this.statusFilter = 'Open';
        this.reload();
      },
      error: (err) => { this.saving = false; this.toast.error(err.error?.message || 'Failed to create the order.'); }
    });
  }

  doDelete(o: PumaOrder): void {
    if (!o.id) return;
    this.http.delete(`${this.base()}/${o.id}`).subscribe({
      next: () => { this.toast.done('Order deleted.'); this.reload(); },
      error: () => this.toast.error('Failed to delete order.')
    });
  }
}
