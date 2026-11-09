import { Component, Inject, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';
import { ShipmentService, ShipmentSummary } from '../../../services/shipment.service';
import { ToastService } from '../../../ui/toast.service';

interface LoadRow {
  id: number; loadNumber: string; status: string; driverName?: string | null; vehicleRegistration?: string | null;
  scheduledPickupDate?: string | null; pickupLocation?: string | null; deliveryLocation?: string | null; totalWeight?: number | null; stops?: any[];
}

/**
 * Overberg Tripsheets – build a tripsheet from confirmed Rocket Freight client bookings.
 * Left: confirmed bookings not yet on a load. Right: either a NEW tripsheet (driver / vehicle / warehouse / date)
 * or an EXISTING open load. Saving plans the shipments → stops added, waybills issued.
 */
@Component({
  selector: 'app-overberg-tripsheet-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatTooltipModule],
  template: `
    <div class="ob-dialog">
      <div class="ob-header">
        <h2><mat-icon>local_shipping</mat-icon> Overberg Tripsheet</h2>
        <span class="sub">Confirmed client bookings → tripsheet. Pickup &amp; delivery stops are added and waybills issued on save.</span>
        <span class="spacer"></span>
        <button aria-label="Close" mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="ob-body">
        <!-- LEFT: bookings -->
        <section class="panel">
          <div class="panel-head">
            <h3>Confirmed bookings <span class="count">{{ visible().length }}</span></h3>
            <input type="search" class="search" placeholder="Search booking, client, town…" [(ngModel)]="search" (ngModelChange)="searchSig.set($event)" />
            <button mat-stroked-button (click)="loadShipments()" matTooltip="Refresh"><mat-icon>refresh</mat-icon></button>
          </div>
          <div class="toolbar">
            <mat-checkbox [checked]="allVisibleSelected()" [indeterminate]="someVisibleSelected()" (change)="toggleAll($event.checked)">Select all shown</mat-checkbox>
            <span class="muted">{{ selectedIds().size }} selected · {{ selectedKg() | number:'1.0-0' }} kg</span>
          </div>
          @if (loading()) { <p class="muted pad">Loading bookings…</p> }
          @else if (visible().length === 0) {
            <div class="empty"><mat-icon>inbox</mat-icon>
              <p>No confirmed bookings waiting.</p>
              <span class="muted">Confirm bookings in Overberg → Awaiting confirmation first, they then appear here.</span></div>
          } @else {
            <ul class="list">
              @for (s of visible(); track s.id) {
                <li [class.sel]="selectedIds().has(s.id)" (click)="toggle(s.id)">
                  <mat-checkbox [checked]="selectedIds().has(s.id)" (click)="$event.stopPropagation()" (change)="toggle(s.id)"></mat-checkbox>
                  <div class="info">
                    <div class="l1"><b>{{ s.bookingNo }}</b> <span class="cust">{{ s.customerName }}</span>
                      @if (s.clientReference) { <span class="muted">ref {{ s.clientReference }}</span> }
                      <span class="spacer"></span>
                      <span class="chip">Collect {{ s.collectionDate | date:'EEE dd MMM' }}</span>
                    </div>
                    <div class="l2 muted">{{ s.pickup?.suburb || s.pickup?.city }} → {{ s.delivery?.suburb || s.delivery?.city }}{{ s.delivery?.province ? ', ' + s.delivery.province : '' }}</div>
                    <div class="l3 muted">{{ s.totalWeightKg | number:'1.0-0' }} kg · {{ s.totalPallets }} pallet · {{ s.totalParcels }} parcel
                      @if (s.hazardous) { · <span class="warn">Hazardous</span> } @if (s.fragile) { · Fragile } @if (s.temperatureRange) { · {{ s.temperatureRange }} }</div>
                  </div>
                </li>
              }
            </ul>
          }
        </section>

        <!-- RIGHT: destination tripsheet -->
        <section class="panel">
          <div class="panel-head">
            <h3>Tripsheet</h3>
            <div class="seg">
              <button [class.on]="mode === 'new'" (click)="mode = 'new'">New tripsheet</button>
              <button [class.on]="mode === 'existing'" (click)="mode = 'existing'; loadLoads()">Add to active load</button>
            </div>
          </div>

          @if (mode === 'new') {
            <div class="form">
              <label>Warehouse / depot
                <select [(ngModel)]="warehouseId">
                  <option [ngValue]="null">— none —</option>
                  @for (w of data.warehouses; track w.id) { <option [ngValue]="w.id">{{ w.name }}{{ w.city ? ' – ' + w.city : '' }}</option> }
                </select>
              </label>
              <label>Driver
                <select [(ngModel)]="driverId">
                  <option [ngValue]="null">— unassigned (Available) —</option>
                  @for (d of data.drivers; track d.id) { <option [ngValue]="d.id">{{ d.firstName }} {{ d.lastName }}</option> }
                </select>
              </label>
              <label>Vehicle
                <select [(ngModel)]="vehicleId">
                  <option [ngValue]="null">— none —</option>
                  @for (v of data.vehicles; track v.id) { <option [ngValue]="v.id">{{ v.registrationNumber }}{{ v.make ? ' · ' + v.make + ' ' + (v.model || '') : '' }}</option> }
                </select>
              </label>
              <label>Scheduled collection
                <input type="date" [(ngModel)]="scheduledDate" />
                <span class="hint muted">Defaults to the earliest collection date of the selected bookings.</span>
              </label>
              <label>Special instructions
                <textarea rows="3" [(ngModel)]="instructions" placeholder="Anything the driver must know"></textarea>
              </label>
            </div>
          } @else {
            <div class="form">
              <div class="row">
                <input type="search" class="search" placeholder="Filter loads by no, driver, vehicle…" [(ngModel)]="loadFilter" />
                <button mat-stroked-button (click)="loadLoads()"><mat-icon>refresh</mat-icon></button>
              </div>
              @if (loadingLoads()) { <p class="muted">Loading loads…</p> }
              @else if (visibleLoads().length === 0) { <p class="muted">No open loads (Draft / Available / Pending / Assigned). Use "New tripsheet" instead.</p> }
              @else {
                <ul class="loads">
                  @for (l of visibleLoads(); track l.id) {
                    <li [class.sel]="selectedLoad()?.id === l.id" (click)="selectedLoad.set(l)">
                      <div class="l1"><b>{{ l.loadNumber }}</b> <span class="chip">{{ l.status }}</span> <span class="spacer"></span> <span class="muted">{{ l.scheduledPickupDate | date:'EEE dd MMM' }}</span></div>
                      <div class="muted">{{ l.driverName || 'No driver' }} · {{ l.vehicleRegistration || 'No vehicle' }} · {{ l.stops?.length || 0 }} stop(s) · {{ l.totalWeight || 0 | number:'1.0-0' }} kg</div>
                    </li>
                  }
                </ul>
              }
            </div>
          }

          @if (error()) { <div class="err">{{ error() }}</div> }
          @if (warnings().length) { <div class="warnbox">@for (w of warnings(); track w) { <div>⚠ {{ w }}</div> }</div> }
        </section>
      </div>

      <div class="ob-actions">
        <span class="muted">{{ selectedIds().size }} booking(s) · {{ selectedKg() | number:'1.0-0' }} kg</span>
        <span class="spacer"></span>
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" [disabled]="!canSave() || busy()" (click)="save()">
          <mat-icon>{{ busy() ? 'hourglass_top' : 'route' }}</mat-icon>
          {{ mode === 'new' ? 'Create tripsheet & issue waybills' : ('Add to ' + (selectedLoad()?.loadNumber || 'load')) }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ob-dialog { display: flex; flex-direction: column; height: 100%; max-height: 90vh; }
    .ob-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; background: var(--color-primary); color: var(--color-on-primary); margin: -24px -24px 0; }
    .ob-header h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--text-xl); }
    .ob-header .sub { font-size: var(--text-xs); opacity: .85; }
    .ob-header button { color: var(--color-on-primary); }
    .spacer { flex: 1; }
    .ob-body { display: grid; grid-template-columns: 1.3fr 1fr; gap: 16px; padding: 16px 0; flex: 1; min-height: 0; }
    .panel { display: flex; flex-direction: column; min-height: 0; border: 1px solid var(--color-line); border-radius: 12px; background: var(--color-surface-2); overflow: hidden; }
    .panel-head { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--color-surface); border-bottom: 1px solid var(--color-line); }
    .panel-head h3 { margin: 0; font-size: var(--text-md); display: flex; align-items: center; gap: 8px; white-space: nowrap; }
    .count { background: var(--color-primary); color: var(--color-on-primary); border-radius: 999px; padding: 0 8px; font-size: 11px; }
    .search { flex: 1; height: 34px; border: 1px solid var(--color-line); border-radius: 8px; padding: 0 10px; font: inherit; background: var(--color-surface); color: var(--color-text); }
    .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; border-bottom: 1px solid var(--color-line); font-size: var(--text-xs); }
    .list, .loads { list-style: none; margin: 0; padding: 8px; overflow-y: auto; display: grid; gap: 6px; align-content: start; flex: 1; min-height: 0; }
    .list li, .loads li { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border: 1px solid var(--color-line); border-radius: 10px; background: var(--color-surface); cursor: pointer; }
    .list li.sel, .loads li.sel { border-color: var(--color-primary); background: var(--color-primary-soft, #eaf3f8); }
    .loads li { display: grid; gap: 2px; }
    .info { flex: 1; min-width: 0; display: grid; gap: 2px; font-size: var(--text-sm); }
    .l1 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .cust { color: var(--color-text); }
    .muted { color: var(--color-text-2); font-size: var(--text-xs); }
    .pad { padding: 14px; }
    .warn { color: var(--color-danger, #b3261e); font-weight: 600; }
    .chip { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: var(--color-surface-2); border: 1px solid var(--color-line); }
    .empty { display: grid; place-items: center; gap: 6px; padding: 32px 16px; text-align: center; color: var(--color-text-2); }
    .empty mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: .5; }
    .seg { display: flex; border: 1px solid var(--color-line); border-radius: 8px; overflow: hidden; margin-left: auto; }
    .seg button { border: 0; background: var(--color-surface); color: var(--color-text); padding: 6px 12px; font: inherit; font-size: var(--text-xs); cursor: pointer; }
    .seg button.on { background: var(--color-primary); color: var(--color-on-primary); }
    .form { display: grid; gap: 12px; padding: 14px; overflow-y: auto; }
    .form label { display: grid; gap: 4px; font-size: var(--text-xs); color: var(--color-text-2); }
    .form select, .form input, .form textarea { height: 36px; border: 1px solid var(--color-line); border-radius: 8px; padding: 0 10px; font: inherit; background: var(--color-surface); color: var(--color-text); }
    .form textarea { height: auto; padding: 8px 10px; resize: vertical; }
    .row { display: flex; gap: 8px; }
    .err { margin: 0 14px 14px; background: var(--color-danger-soft, #fdecea); color: #7a1d16; border-radius: 8px; padding: 8px 12px; font-size: var(--text-sm); }
    .warnbox { margin: 0 14px 14px; background: var(--color-warn-soft, #fff6e5); color: #7a4b00; border-radius: 8px; padding: 8px 12px; font-size: var(--text-xs); display: grid; gap: 4px; }
    .ob-actions { display: flex; align-items: center; gap: 8px; padding: 12px 0 0; border-top: 1px solid var(--color-line); }
  `]
})
export class OverbergTripsheetDialogComponent {
  private svc = inject(ShipmentService);
  private http = inject(HttpClient);
  private toast = inject(ToastService);

  shipments = signal<ShipmentSummary[]>([]);
  loading = signal(false);
  busy = signal(false);
  error = signal('');
  warnings = signal<string[]>([]);
  selectedIds = signal<Set<number>>(new Set());
  searchSig = signal('');
  search = '';

  mode: 'new' | 'existing' = 'new';
  warehouseId: number | null = null;
  driverId: number | null = null;
  vehicleId: number | null = null;
  scheduledDate = '';
  instructions = '';

  loads = signal<LoadRow[]>([]);
  loadingLoads = signal(false);
  selectedLoad = signal<LoadRow | null>(null);
  loadFilter = '';

  visible = computed(() => {
    const q = this.searchSig().trim().toLowerCase();
    return this.shipments().filter(s => !q || [s.bookingNo, s.customerName, s.clientReference, s.pickup?.city, s.pickup?.suburb, s.delivery?.city, s.delivery?.suburb, s.delivery?.province]
      .some(x => x?.toLowerCase().includes(q)));
  });
  selectedKg = computed(() => this.shipments().filter(s => this.selectedIds().has(s.id)).reduce((t, s) => t + (s.totalWeightKg || 0), 0));
  allVisibleSelected = computed(() => this.visible().length > 0 && this.visible().every(s => this.selectedIds().has(s.id)));
  someVisibleSelected = computed(() => !this.allVisibleSelected() && this.visible().some(s => this.selectedIds().has(s.id)));
  visibleLoads = computed(() => {
    const f = this.loadFilter.trim().toLowerCase();
    return this.loads().filter(l => !f || [l.loadNumber, l.driverName, l.vehicleRegistration, l.pickupLocation, l.deliveryLocation].some(x => x?.toLowerCase().includes(f)));
  });
  canSave = computed(() => this.selectedIds().size > 0 && (this.mode === 'new' || !!this.selectedLoad()));

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { warehouses?: any[]; drivers?: any[]; vehicles?: any[]; preselect?: number[] },
    private ref: MatDialogRef<OverbergTripsheetDialogComponent>
  ) {
    this.data = { warehouses: [], drivers: [], vehicles: [], ...(data || {}) };
    if (this.data.preselect?.length) this.selectedIds.set(new Set(this.data.preselect));
    if (!this.data.warehouses?.length) this.http.get<any[]>(`${environment.apiUrl}/warehouses`).subscribe({ next: w => { this.data.warehouses = w || []; if (w?.length === 1) this.warehouseId = w[0].id; }, error: () => {} });
    else if (this.data.warehouses.length === 1) this.warehouseId = this.data.warehouses[0].id;
    if (!this.data.drivers?.length) this.http.get<any[]>(`${environment.apiUrl}/logistics/drivers`).subscribe({
      next: d => { this.data.drivers = (d || []).filter(x => !['inactive', 'terminated'].includes((x.status ?? '').toLowerCase())); }, error: () => {} });
    if (!this.data.vehicles?.length) this.http.get<any[]>(`${environment.apiUrl}/fleet/vehicles/live`).subscribe({
      next: v => { this.data.vehicles = (v || []).filter(x => !['Under Maintenance', 'Decommissioned', 'Unavailable'].includes(x.status)); }, error: () => {} });
    this.loadShipments();
  }

  loadShipments() {
    this.loading.set(true); this.error.set('');
    this.svc.unplanned().subscribe({
      next: rows => {
        this.shipments.set(rows || []);
        // Drop selections that are no longer unplanned
        const ids = new Set((rows || []).map(r => r.id));
        this.selectedIds.set(new Set([...this.selectedIds()].filter(i => ids.has(i))));
        this.syncDefaultDate();
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Could not load confirmed bookings.'); }
    });
  }
  loadLoads() {
    this.loadingLoads.set(true);
    this.http.get<LoadRow[]>(`${environment.apiUrl}/logistics/loads`).subscribe({
      next: rows => {
        const open = rows.filter(l => ['Draft', 'Available', 'Pending', 'Assigned'].includes(l.status));
        open.sort((a, b) => (a.scheduledPickupDate ?? '').localeCompare(b.scheduledPickupDate ?? ''));
        this.loads.set(open); this.loadingLoads.set(false);
      },
      error: () => { this.loadingLoads.set(false); this.error.set('Could not load the loads list.'); }
    });
  }

  toggle(id: number) {
    const next = new Set(this.selectedIds());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedIds.set(next);
    this.syncDefaultDate();
  }
  toggleAll(on: boolean) {
    const next = new Set(this.selectedIds());
    this.visible().forEach(s => on ? next.add(s.id) : next.delete(s.id));
    this.selectedIds.set(next);
    this.syncDefaultDate();
  }
  private syncDefaultDate() {
    if (this.scheduledDate) return;
    const sel = this.shipments().filter(s => this.selectedIds().has(s.id)).map(s => s.collectionDate).sort();
    if (sel.length) this.scheduledDate = sel[0].substring(0, 10);
  }

  save() {
    const ids = [...this.selectedIds()];
    if (!ids.length) return;
    this.busy.set(true); this.error.set(''); this.warnings.set([]);
    const done = (r: { loadId: number; loadNumber: string; warnings: string[]; shipments: ShipmentSummary[] }, created: boolean) => {
      this.busy.set(false);
      this.warnings.set(r.warnings || []);
      const n = r.shipments?.length ?? ids.length;
      this.toast.done(`${created ? 'Tripsheet ' + r.loadNumber + ' created' : 'Added to ' + r.loadNumber} – ${n} waybill${n === 1 ? '' : 's'} issued`);
      this.ref.close({ created, updated: !created, loadId: r.loadId, loadNumber: r.loadNumber, shipments: r.shipments });
    };
    const fail = (e: any) => { this.busy.set(false); this.error.set(e?.error?.message ?? e?.error?.error ?? e?.message ?? 'Saving failed.'); };

    if (this.mode === 'new') {
      this.svc.createLoadFromShipments({
        shipmentIds: ids, warehouseId: this.warehouseId, driverId: this.driverId, vehicleId: this.vehicleId,
        scheduledPickupDate: this.scheduledDate ? new Date(this.scheduledDate + 'T08:00:00').toISOString() : null,
        specialInstructions: this.instructions?.trim() || null
      }).subscribe({ next: r => done(r, true), error: fail });
    } else {
      const l = this.selectedLoad(); if (!l) return;
      this.svc.planOntoLoad(l.id, ids).subscribe({ next: r => done(r, false), error: fail });
    }
  }
}
