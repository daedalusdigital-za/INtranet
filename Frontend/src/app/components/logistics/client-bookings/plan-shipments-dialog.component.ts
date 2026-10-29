import { Component, inject, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../environments/environment';
import { ShipmentService, ShipmentSummary } from '../../../services/shipment.service';

interface LoadRow {
  id: number; loadNumber: string; status: string; driverName?: string | null; vehicleRegistration?: string | null;
  scheduledPickupDate?: string | null; pickupLocation?: string | null; deliveryLocation?: string | null; totalWeight?: number | null;
  stops?: any[];
}

/** Pick an open load (tripsheet) and put the selected shipments on it. Server issues waybills and adds stops. */
@Component({
  selector: 'app-plan-shipments-dialog',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Plan {{ data.shipments.length }} shipment(s) onto a load</h2>
    <mat-dialog-content>
      <p class="muted">{{ totalKg() | number:'1.0-0' }} kg · {{ hazardous() ? 'includes hazardous goods · ' : '' }}
        collection {{ earliest() | date:'dd MMM' }}. Pickup and delivery stops are added to the load's tripsheet and waybills are issued.</p>
      <div class="row">
        <input type="search" placeholder="Filter by load no, driver, vehicle…" [(ngModel)]="filter" />
        <select [(ngModel)]="status" (change)="load()">
          <option value="">Open loads</option>
          <option value="Draft">Draft</option><option value="Available">Available</option><option value="Pending">Pending</option><option value="Assigned">Assigned</option>
        </select>
        <button mat-stroked-button (click)="load()"><mat-icon>refresh</mat-icon></button>
      </div>
      @if (loading()) { <p class="muted">Loading loads…</p> }
      @else if (visible().length === 0) { <p class="muted">No open loads. Create a load in Loads first, then plan onto it.</p> }
      @else {
        <ul class="loads">
          @for (l of visible(); track l.id) {
            <li [class.sel]="selected()?.id === l.id" (click)="selected.set(l)">
              <div class="l1"><b>{{ l.loadNumber }}</b> <span class="chip">{{ l.status }}</span> <span class="spacer"></span> <span class="muted">{{ l.scheduledPickupDate | date:'EEE dd MMM' }}</span></div>
              <div class="muted">{{ l.driverName || 'No driver' }} · {{ l.vehicleRegistration || 'No vehicle' }} · {{ l.stops?.length || 0 }} stop(s) · {{ l.totalWeight || 0 | number:'1.0-0' }} kg on board</div>
              @if (l.pickupLocation || l.deliveryLocation) { <div class="muted">{{ l.pickupLocation }} → {{ l.deliveryLocation }}</div> }
            </li>
          }
        </ul>
      }
      @if (error()) { <div class="err">{{ error() }}</div> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="!selected() || busy()" (click)="plan()">Plan onto {{ selected()?.loadNumber || 'load' }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { display: grid; gap: 10px; }
    .muted { color: var(--color-text-2, var(--color-text-2)); font-size: 12.5px; margin: 0; }
    .row { display: flex; gap: 8px; } .row input { flex: 1; } .row input, .row select { height: 36px; border: 1px solid var(--color-border, #cfd5db); border-radius: 8px; padding: 0 10px; font: inherit; }
    .loads { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; max-height: 50vh; overflow: auto; }
    .loads li { border: 1px solid var(--color-border, var(--color-line)); border-radius: 10px; padding: 8px 12px; cursor: pointer; display: grid; gap: 2px; }
    .loads li.sel { border-color: var(--color-primary, #033142); background: var(--color-primary-soft, #eaf3f8); }
    .l1 { display: flex; align-items: center; gap: 8px; } .spacer { flex: 1; }
    .chip { font-size: 11px; padding: 1px 8px; border-radius: 999px; background: var(--color-surface-2, #eef1f4); }
    .err { background: var(--color-danger-soft); color: #7a1d16; border-radius: 8px; padding: 8px 12px; font-size: 13px; }
  `]
})
export class PlanShipmentsDialogComponent {
  readonly data = inject<{ shipments: ShipmentSummary[] }>(MAT_DIALOG_DATA);
  private ref = inject(MatDialogRef<PlanShipmentsDialogComponent>);
  private http = inject(HttpClient);
  private svc = inject(ShipmentService);

  loads = signal<LoadRow[]>([]); loading = signal(false); busy = signal(false); error = signal('');
  selected = signal<LoadRow | null>(null);
  filter = ''; status = '';

  totalKg = computed(() => this.data.shipments.reduce((t, s) => t + (s.totalWeightKg || 0), 0));
  hazardous = computed(() => this.data.shipments.some(s => s.hazardous));
  earliest = computed(() => this.data.shipments.map(s => s.collectionDate).sort()[0]);
  visible = computed(() => {
    const f = this.filter.trim().toLowerCase();
    return this.loads().filter(l => !f || [l.loadNumber, l.driverName, l.vehicleRegistration, l.pickupLocation, l.deliveryLocation].some(x => x?.toLowerCase().includes(f)));
  });

  constructor() { this.load(); }

  load() {
    this.loading.set(true); this.error.set('');
    const params: any = {}; if (this.status) params.status = this.status;
    this.http.get<LoadRow[]>(`${environment.apiUrl}/logistics/loads`, { params }).subscribe({
      next: rows => {
        const open = this.status ? rows : rows.filter(l => ['Draft', 'Available', 'Pending', 'Assigned'].includes(l.status));
        open.sort((a, b) => (a.scheduledPickupDate ?? '').localeCompare(b.scheduledPickupDate ?? ''));
        this.loads.set(open); this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('Could not load the loads list.'); }
    });
  }
  plan() {
    const l = this.selected(); if (!l) return;
    this.busy.set(true); this.error.set('');
    this.svc.planOntoLoad(l.id, this.data.shipments.map(s => s.id)).subscribe({
      next: r => { this.busy.set(false); this.ref.close(r); },
      error: e => { this.busy.set(false); this.error.set(e?.error?.message ?? e?.error?.error ?? 'Planning failed.'); }
    });
  }
}
