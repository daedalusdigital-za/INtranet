import { Component, OnInit, Inject, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { ConfirmService } from '../../ui/confirm.service';
import { FleetMovementsComponent } from './fleet-movements.component';

export interface InternalMovementLine { id: number; commodityId: number | null; code?: string; name?: string; quantity: number; unitOfMeasure?: string; }
export interface InternalMovement {
  id: number; loadNumber: string; status: string; priority: string;
  fromWarehouseId: number | null; fromWarehouseName?: string; toWarehouseId: number | null; toWarehouseName?: string;
  vehicleId: number | null; vehicleRegistration?: string; vehicleName?: string; driverId: number | null; driverName?: string;
  scheduledDate?: string; dispatchedAt?: string; receivedAt?: string; notes?: string; createdAt: string; createdBy?: string;
  lineCount: number; totalUnits: number; unlinkedLines: number; stockOutPosted: boolean; stockInPosted: boolean; lines: InternalMovementLine[];
}
interface Ref { id: number; name: string; }

/** Logistics → Movement: stock moving between our own warehouses, as trips. */
@Component({
  selector: 'app-internal-movements',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule, FleetMovementsComponent],
  template: `
    <div class="im">
      <div class="im-bar">
        <div class="im-view" role="group" aria-label="Movement view">
          <button type="button" [class.on]="view() === 'internal'" (click)="view.set('internal')"><mat-icon>warehouse</mat-icon> Warehouse movements</button>
          <button type="button" [class.on]="view() === 'fleet'" (click)="view.set('fleet')"><mat-icon>route</mat-icon> Fleet trips</button>
        </div>
        <span class="im-spacer"></span>
        @if (view() === 'internal') {
          <mat-form-field appearance="outline" class="im-filter">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="statusFilter">
              <mat-option value="">Open &amp; recent</mat-option>
              <mat-option value="Available">Planned</mat-option>
              <mat-option value="Assigned">Assigned</mat-option>
              <mat-option value="InTransit">In transit</mat-option>
              <mat-option value="Delivered">Received</mat-option>
              <mat-option value="Cancelled">Cancelled</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="im-search">
            <mat-label>Search</mat-label>
            <input matInput [(ngModel)]="search" placeholder="Load no, warehouse, driver, item code">
            <mat-icon matPrefix>search</mat-icon>
          </mat-form-field>
          <button mat-icon-button (click)="load()" matTooltip="Reload" aria-label="Reload"><mat-icon>refresh</mat-icon></button>
          <button mat-raised-button color="primary" (click)="openNew()"><mat-icon>add</mat-icon> New internal movement</button>
        }
      </div>

      @if (view() === 'fleet') {
        <app-fleet-movements />
      } @else {
        <div class="im-kpis">
          <div class="k"><span>Planned</span><b>{{ count('Available') + count('Assigned') }}</b></div>
          <div class="k warn"><span>In transit</span><b>{{ count('InTransit') }}</b></div>
          <div class="k ok"><span>Received (30 d)</span><b>{{ receivedRecent() }}</b></div>
          <div class="k"><span>Units in transit</span><b>{{ unitsInTransit() | number }}</b></div>
        </div>

        @if (loading()) { <p class="im-muted">Loading internal movements…</p> }
        @else if (error()) { <p class="im-muted err"><mat-icon>error_outline</mat-icon>{{ error() }}</p> }
        @else {
          <table class="app-table im-table">
            <thead><tr><th>Trip</th><th>From → To</th><th>Stock</th><th>Vehicle / driver</th><th>When</th><th>Status</th><th class="act"></th></tr></thead>
            <tbody>
              @for (m of filtered(); track m.id) {
                <tr [class.open]="expanded() === m.id">
                  <td><button class="im-ref" (click)="toggle(m.id)">{{ m.loadNumber }}<mat-icon>{{ expanded() === m.id ? 'expand_less' : 'expand_more' }}</mat-icon></button><small>{{ m.createdBy || '—' }} · {{ m.createdAt | date:'dd MMM' }}</small></td>
                  <td><b>{{ m.fromWarehouseName || '?' }}</b> <mat-icon class="arrow">arrow_forward</mat-icon> <b>{{ m.toWarehouseName || '?' }}</b></td>
                  <td>{{ m.lineCount }} line{{ m.lineCount === 1 ? '' : 's' }} · <b>{{ m.totalUnits | number }}</b> units
                    @if (m.unlinkedLines) { <span class="tag bad" matTooltip="These lines are not linked to a stock item and block dispatch">{{ m.unlinkedLines }} unlinked</span> }</td>
                  <td>
                    @if (m.vehicleRegistration) { <span class="mono">{{ m.vehicleRegistration }}</span> } @else { <span class="im-dim">no vehicle</span> }
                    <small>{{ m.driverName || 'no driver' }}</small>
                  </td>
                  <td>
                    @if (m.receivedAt) { Received <b>{{ m.receivedAt | date:'dd MMM HH:mm' }}</b> }
                    @else if (m.dispatchedAt) { Left <b>{{ m.dispatchedAt | date:'dd MMM HH:mm' }}</b> }
                    @else if (m.scheduledDate) { Planned <b>{{ m.scheduledDate | date:'dd MMM' }}</b> }
                    @else { <span class="im-dim">—</span> }
                  </td>
                  <td><span class="st" [attr.data-s]="m.status">{{ label(m.status) }}</span>
                    <small>@if (m.stockOutPosted) { out ✓ } @if (m.stockInPosted) { · in ✓ }</small></td>
                  <td class="act">
                    @if (m.status === 'Available' || m.status === 'Assigned') {
                      <button mat-icon-button matTooltip="Assign vehicle / driver" (click)="assign(m)"><mat-icon>badge</mat-icon></button>
                      <button mat-stroked-button color="primary" (click)="dispatch(m)" matTooltip="Stock leaves the source warehouse"><mat-icon>local_shipping</mat-icon> Dispatch</button>
                      <button mat-icon-button matTooltip="Cancel" (click)="cancel(m)"><mat-icon>close</mat-icon></button>
                    }
                    @if (m.status === 'InTransit') {
                      <button mat-raised-button color="primary" (click)="receive(m)" matTooltip="Stock arrives at the destination warehouse"><mat-icon>inventory</mat-icon> Receive</button>
                    }
                  </td>
                </tr>
                @if (expanded() === m.id) {
                  <tr class="im-detail"><td colspan="7">
                    <div class="im-lines">
                      <table>
                        <thead><tr><th>Code</th><th>Item</th><th class="num">Qty</th></tr></thead>
                        <tbody>@for (l of m.lines; track l.id) { <tr [class.bad]="!l.commodityId"><td class="mono">{{ l.code || '—' }}</td><td>{{ l.name || '—' }}</td><td class="num">{{ l.quantity | number }} {{ l.unitOfMeasure || '' }}</td></tr> }</tbody>
                      </table>
                      @if (m.notes) { <p class="im-notes"><mat-icon>notes</mat-icon>{{ m.notes }}</p> }
                    </div>
                  </td></tr>
                }
              } @empty {
                <tr><td colspan="7" class="im-empty"><mat-icon>warehouse</mat-icon>No internal movements{{ statusFilter || search ? ' match' : ' yet' }}. Create one to move stock between warehouses on a trip.</td></tr>
              }
            </tbody>
          </table>
        }
      }
    </div>
  `,
  styles: [`
    .im { padding: var(--space-2) 0; }
    .im-bar { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-3); }
    .im-bar mat-form-field { margin-bottom: -1.25em; }
    .im-filter { width: 160px; } .im-search { width: 260px; } .im-spacer { flex: 1; }
    .im-view { display: inline-flex; background: var(--color-surface-2); border-radius: 999px; padding: 3px; gap: 2px;
      button { border: 0; background: transparent; border-radius: 999px; padding: 5px 14px; font: inherit; font-size: var(--text-sm); color: var(--color-text-2); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
      button.on { background: var(--color-surface); color: var(--color-primary); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.1); } }
    .im-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-2); margin-bottom: var(--space-3);
      .k { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 10px 12px; display: flex; flex-direction: column; span { font-size: var(--text-xs); text-transform: uppercase; color: var(--color-text-3); } b { font-size: 1.3rem; } }
      .k.ok b { color: var(--color-ok); } .k.warn b { color: var(--color-warn); } }
    .im-table { width: 100%; td small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } .num { text-align: right; } .act { text-align: right; white-space: nowrap; }
      tr.open td { background: var(--color-primary-soft); } }
    .im-ref { font-family: var(--font-mono); font-weight: 700; border: 0; background: none; padding: 0; cursor: pointer; color: var(--color-primary); display: inline-flex; align-items: center; font: inherit; font-weight: 700; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    .arrow { font-size: 16px; width: 16px; height: 16px; vertical-align: middle; color: var(--color-text-3); }
    .mono { font-family: var(--font-mono); }
    .im-dim { color: var(--color-text-3); }
    .tag { display: inline-block; font-size: var(--text-xs); border-radius: 6px; padding: 1px 6px; margin-left: 6px; &.bad { background: var(--color-danger-soft, #fef2f2); color: var(--color-danger); } }
    .st { display: inline-block; font-size: var(--text-xs); font-weight: 600; border-radius: 999px; padding: 2px 10px; background: var(--color-surface-2);
      &[data-s="InTransit"] { background: #fff7ed; color: #c2410c; } &[data-s="Delivered"], &[data-s="Completed"] { background: #ecfdf5; color: #047857; }
      &[data-s="Assigned"] { background: #eff6ff; color: #1d4ed8; } &[data-s="Cancelled"] { color: var(--color-text-3); text-decoration: line-through; } }
    .im-detail td { padding: 0 12px 12px 32px !important; }
    .im-lines table { border-collapse: collapse; font-size: var(--text-sm); min-width: 420px; th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; color: var(--color-text-3); padding: 4px 8px; } td { padding: 3px 8px; border-top: 1px solid var(--color-surface-2); } tr.bad td { color: var(--color-danger); } }
    .im-notes { display: flex; gap: 6px; align-items: flex-start; font-size: var(--text-sm); color: var(--color-text-2); margin: 8px 0 0; white-space: pre-line; mat-icon { font-size: 16px; width: 16px; height: 16px; } }
    .im-muted { color: var(--color-text-3); display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); &.err { color: var(--color-danger); } }
    .im-empty { text-align: center; color: var(--color-text-3); padding: 36px !important; mat-icon { display: block; margin: 0 auto 6px; font-size: 32px; width: 32px; height: 32px; opacity: .5; } }
    @media (max-width: 900px) { .im-kpis { grid-template-columns: repeat(2, 1fr); } }
  `]
})
export class InternalMovementsComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private dialog = inject(MatDialog);
  private api = environment.apiUrl;

  view = signal<'internal' | 'fleet'>('internal');
  loading = signal(false);
  error = signal('');
  rows = signal<InternalMovement[]>([]);
  expanded = signal<number | null>(null);
  statusFilter = '';
  search = '';

  warehouses: Ref[] = [];
  vehicles: { id: number; registrationNumber: string; make?: string; model?: string }[] = [];
  drivers: { id: number; firstName: string; lastName: string; status?: string }[] = [];

  ngOnInit(): void {
    this.load();
    this.http.get<any[]>(`${this.api}/warehouses`).subscribe({ next: w => this.warehouses = (w || []).map(x => ({ id: x.id, name: x.name })), error: () => {} });
    this.http.get<any[]>(`${this.api}/fleet/vehicles`).subscribe({ next: v => this.vehicles = v || [], error: () => {} });
    this.http.get<any[]>(`${this.api}/logistics/drivers`).subscribe({ next: d => this.drivers = (d || []).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)), error: () => {} });
  }

  load(): void {
    this.loading.set(true); this.error.set('');
    this.http.get<InternalMovement[]>(`${this.api}/logistics/internal-movements?days=120`).subscribe({
      next: r => { this.rows.set(r || []); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message || 'Could not load internal movements'); }
    });
  }

  filtered(): InternalMovement[] {
    const q = this.search.trim().toLowerCase();
    return this.rows().filter(m => {
      if (this.statusFilter && m.status !== this.statusFilter) return false;
      if (!this.statusFilter && m.status === 'Cancelled') return false;
      if (!q) return true;
      const hay = [m.loadNumber, m.fromWarehouseName, m.toWarehouseName, m.driverName, m.vehicleRegistration, m.notes, ...m.lines.map(l => `${l.code} ${l.name}`)].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }
  count(status: string): number { return this.rows().filter(m => m.status === status).length; }
  receivedRecent(): number { const cutoff = Date.now() - 30 * 864e5; return this.rows().filter(m => m.status === 'Delivered' && m.receivedAt && new Date(m.receivedAt).getTime() >= cutoff).length; }
  unitsInTransit(): number { return this.rows().filter(m => m.status === 'InTransit').reduce((n, m) => n + (m.totalUnits || 0), 0); }
  label(s: string): string { return ({ Available: 'Planned', Assigned: 'Assigned', InTransit: 'In transit', Delivered: 'Received', Completed: 'Received', Cancelled: 'Cancelled' } as any)[s] || s; }
  toggle(id: number): void { this.expanded.set(this.expanded() === id ? null : id); }

  openNew(): void {
    this.dialog.open(InternalMovementDialog, { width: '860px', maxWidth: '96vw', data: { warehouses: this.warehouses, vehicles: this.vehicles, drivers: this.drivers } })
      .afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  assign(m: InternalMovement): void {
    this.dialog.open(AssignInternalMovementDialog, { width: '460px', data: { movement: m, vehicles: this.vehicles, drivers: this.drivers } })
      .afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  async dispatch(m: InternalMovement): Promise<void> {
    if (m.unlinkedLines) { this.toast.warn(`${m.unlinkedLines} line(s) aren't linked to a stock item — fix them first`); return; }
    const ok = await this.confirm.ask({ title: `Dispatch ${m.loadNumber}?`, message: `${m.totalUnits} unit(s) on ${m.lineCount} line(s) will come off ${m.fromWarehouseName} stock now and show as in transit until ${m.toWarehouseName} receives it.`, confirmText: 'Dispatch' });
    if (!ok) return;
    this.http.post(`${this.api}/logistics/internal-movements/${m.id}/dispatch`, {}).subscribe({
      next: () => { this.toast.done(`${m.loadNumber} dispatched — stock out of ${m.fromWarehouseName}`); this.load(); },
      error: e => this.toast.error(e?.error?.message || 'Could not dispatch')
    });
  }

  receive(m: InternalMovement): void {
    this.dialog.open(ReceiveInternalMovementDialog, { width: '640px', data: { movement: m } })
      .afterClosed().subscribe(ok => { if (ok) this.load(); });
  }

  async cancel(m: InternalMovement): Promise<void> {
    const ok = await this.confirm.ask({ title: `Cancel ${m.loadNumber}?`, message: 'No stock has moved yet, so nothing is reversed. The trip is marked cancelled.', confirmText: 'Cancel movement', danger: true });
    if (!ok) return;
    this.http.post(`${this.api}/logistics/internal-movements/${m.id}/cancel`, {}).subscribe({
      next: () => { this.toast.info(`${m.loadNumber} cancelled`); this.load(); },
      error: e => this.toast.error(e?.error?.message || 'Could not cancel')
    });
  }
}

// ═══ New internal movement dialog ═══
interface NewLine { inv: any; quantity: number | null; }

@Component({
  selector: 'app-internal-movement-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:var(--color-primary);">warehouse</mat-icon>
      New internal movement
      <small class="sub">A trip that carries stock from one of our warehouses to another. Stock comes off the source when it's dispatched and lands at the destination when it's received.</small>
    </h2>
    <mat-dialog-content>
      <div class="row3">
        <mat-form-field appearance="outline">
          <mat-label>From warehouse</mat-label>
          <mat-select [(ngModel)]="fromId" (ngModelChange)="lines = []; search = ''; loadInventory()" [disabled]="lines.length > 0">
            @for (w of data.warehouses; track w.id) { <mat-option [value]="w.id">{{ w.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-icon class="arrow">arrow_forward</mat-icon>
        <mat-form-field appearance="outline">
          <mat-label>To warehouse</mat-label>
          <mat-select [(ngModel)]="toId">
            @for (w of data.warehouses; track w.id) { @if (w.id !== fromId) { <mat-option [value]="w.id">{{ w.name }}</mat-option> } }
          </mat-select>
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline" style="width:100%;">
        <mat-label>Add stock — code, name or description</mat-label>
        <input matInput [(ngModel)]="search" [disabled]="!fromId || invLoading" [placeholder]="invLoading ? 'Loading stock…' : 'e.g. GLV-M or nitrile glove'" (keydown.enter)="addFirst($event)" autocomplete="off">
        <mat-icon matPrefix>search</mat-icon>
        @if (search) { <button matSuffix mat-icon-button aria-label="Clear" (click)="search = ''"><mat-icon>close</mat-icon></button> }
      </mat-form-field>
      @if (search.trim().length) {
        <div class="list">
          @for (r of matches(); track r.id) {
            <button class="item" [class.added]="isAdded(r)" (click)="add(r)">
              <span class="code">{{ r.commodityCode }}</span><span class="name">{{ r.commodityName }}</span><span class="qty">{{ r.quantityOnHand | number }} on hand</span><mat-icon>{{ isAdded(r) ? 'done' : 'add' }}</mat-icon>
            </button>
          } @empty { <div class="empty">{{ fromId ? 'Nothing at the source warehouse matches "' + search + '"' : 'Choose a source warehouse first' }}</div> }
        </div>
      }

      @if (lines.length) {
        <table class="tbl">
          <thead><tr><th>Code</th><th>Item</th><th class="num">On hand</th><th class="num qty">Move</th><th class="num">Left</th><th></th></tr></thead>
          <tbody>
            @for (l of lines; track l.inv.id; let i = $index) {
              <tr [class.bad]="!l.quantity || l.quantity <= 0">
                <td class="mono">{{ l.inv.commodityCode }}</td><td class="nm">{{ l.inv.commodityName }}</td>
                <td class="num">{{ l.inv.quantityOnHand | number }}</td>
                <td class="num qty"><input class="qin" type="number" min="1" [attr.id]="'imq-' + i" [(ngModel)]="l.quantity"></td>
                <td class="num" [class.neg]="remaining(l) < 0">{{ remaining(l) | number }}</td>
                <td><button mat-icon-button aria-label="Remove" (click)="lines.splice(i, 1)"><mat-icon>close</mat-icon></button></td>
              </tr>
            }
          </tbody>
          <tfoot><tr><td colspan="3">{{ lines.length }} line(s)</td><td class="num qty"><b>{{ total() | number }}</b></td><td colspan="2"></td></tr></tfoot>
        </table>
      } @else if (!search.trim().length) {
        <div class="empty tall"><mat-icon>playlist_add</mat-icon>No stock lines yet — search above and click an item to add it.</div>
      }

      <div class="grid">
        <mat-form-field appearance="outline">
          <mat-label>Vehicle (optional)</mat-label>
          <mat-select [(ngModel)]="vehicleId">
            <mat-option [value]="null">— none yet —</mat-option>
            @for (v of data.vehicles; track v.id) { <mat-option [value]="v.id">{{ v.registrationNumber }} <small>{{ v.make }} {{ v.model }}</small></mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Driver (optional)</mat-label>
          <mat-select [(ngModel)]="driverId">
            <mat-option [value]="null">— none yet —</mat-option>
            @for (d of data.drivers; track d.id) { <mat-option [value]="d.id">{{ d.firstName }} {{ d.lastName }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Planned date</mat-label>
          <input matInput type="date" [(ngModel)]="date">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Priority</mat-label>
          <mat-select [(ngModel)]="priority">@for (p of ['Low','Normal','High','Urgent']; track p) { <mat-option [value]="p">{{ p }}</mat-option> }</mat-select>
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline" style="width:100%;">
        <mat-label>Notes (optional)</mat-label>
        <input matInput [(ngModel)]="notes" placeholder="e.g. Restock for KZN promo">
      </mat-form-field>
      @if (anyNegative()) { <p class="warnline"><mat-icon>warning</mat-icon>One or more lines would take the source below zero — dispatch will ask for a reason.</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!valid() || saving" (click)="save()"><mat-icon>add_road</mat-icon> Create movement trip</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
    .sub { font-size: var(--text-xs); font-weight: 400; color: var(--color-text-3); }
    .row3 { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }
    .arrow { color: var(--color-primary); margin-top: -18px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
    .list { max-height: 220px; overflow: auto; border: 1px solid var(--color-line); border-radius: var(--radius-md); margin-bottom: 12px; }
    .item { display: flex; gap: 10px; align-items: center; width: 100%; text-align: left; padding: 8px 12px; border: 0; border-bottom: 1px solid var(--color-surface-2); background: var(--color-surface); cursor: pointer; font: inherit; mat-icon { color: var(--color-primary); font-size: 18px; width: 18px; height: 18px; } }
    .item:hover, .item:focus { background: var(--color-primary-soft); outline: none; } .item.added { opacity: .6; }
    .code { font-family: var(--font-mono); font-weight: 700; min-width: 110px; } .name { flex: 1; font-size: var(--text-sm); color: var(--color-text-2); } .qty { font-size: var(--text-xs); color: var(--color-text-3); white-space: nowrap; }
    .empty { padding: 20px; text-align: center; color: var(--color-text-3); }
    .empty.tall { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 28px 20px; border: 1px dashed var(--color-line); border-radius: var(--radius-md); margin-bottom: 12px; mat-icon { font-size: 32px; width: 32px; height: 32px; opacity: .5; } }
    .tbl { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: var(--text-sm);
      th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; color: var(--color-text-3); padding: 6px 8px; border-bottom: 1px solid var(--color-line); }
      td { padding: 4px 8px; border-bottom: 1px solid var(--color-surface-2); vertical-align: middle; }
      tfoot td { border-bottom: 0; color: var(--color-text-3); font-size: var(--text-xs); padding-top: 8px; }
      .num { text-align: right; white-space: nowrap; } .qty { width: 110px; } .nm { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .neg { color: var(--color-danger); font-weight: 600; } tr.bad td { background: var(--color-danger-soft, #fef2f2); } }
    .mono { font-family: var(--font-mono); }
    .qin { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--color-line); border-radius: 6px; font: inherit; text-align: right; background: var(--color-surface); color: inherit; }
    .qin:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
    .warnline { display: flex; gap: 6px; align-items: center; font-size: var(--text-sm); color: var(--color-warn); margin: 0; mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    mat-form-field { width: 100%; }
  `]
})
export class InternalMovementDialog {
  fromId: number | null = null;
  toId: number | null = null;
  vehicleId: number | null = null;
  driverId: number | null = null;
  date = new Date().toISOString().substring(0, 10);
  priority = 'Normal';
  notes = '';
  search = '';
  lines: NewLine[] = [];
  inventory: any[] = [];
  invLoading = false;
  saving = false;

  private http = inject(HttpClient);
  private toast = inject(ToastService);

  constructor(public dialogRef: MatDialogRef<InternalMovementDialog>, @Inject(MAT_DIALOG_DATA) public data: any) {}

  loadInventory(): void {
    if (!this.fromId) return;
    this.invLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/inventory?warehouseId=${this.fromId}`).subscribe({
      next: d => { this.inventory = (d || []).filter(r => r.warehouseId === this.fromId); this.invLoading = false; },
      error: () => { this.invLoading = false; this.toast.error('Could not load stock for that warehouse'); }
    });
  }

  matches(): any[] {
    const words = this.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return this.inventory.filter(r => {
      const hay = `${r.commodityCode || ''} ${r.commodityName || ''} ${r.commodityDescription || r.description || ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    }).slice(0, 50);
  }
  isAdded(r: any): boolean { return this.lines.some(l => l.inv.commodityId === r.commodityId); }
  add(r: any): void {
    const existing = this.lines.findIndex(l => l.inv.commodityId === r.commodityId);
    const idx = existing >= 0 ? existing : this.lines.push({ inv: r, quantity: null }) - 1;
    this.search = '';
    setTimeout(() => (document.getElementById('imq-' + idx) as HTMLInputElement | null)?.focus(), 0);
  }
  addFirst(ev: Event): void { ev.preventDefault(); const m = this.matches(); if (m.length) this.add(m[0]); }
  remaining(l: NewLine): number { return (l.inv.quantityOnHand || 0) - (l.quantity || 0); }
  anyNegative(): boolean { return this.lines.some(l => this.remaining(l) < 0); }
  total(): number { return this.lines.reduce((n, l) => n + (l.quantity || 0), 0); }
  valid(): boolean { return !!this.fromId && !!this.toId && this.fromId !== this.toId && this.lines.length > 0 && this.lines.every(l => (l.quantity || 0) > 0); }

  save(): void {
    this.saving = true;
    this.http.post<any>(`${environment.apiUrl}/logistics/internal-movements`, {
      fromWarehouseId: this.fromId, toWarehouseId: this.toId, vehicleId: this.vehicleId, driverId: this.driverId,
      scheduledDate: this.date || null, priority: this.priority, notes: this.notes || null,
      lines: this.lines.map(l => ({ commodityId: l.inv.commodityId, quantity: l.quantity }))
    }).subscribe({
      next: r => { this.toast.done(`${r?.loadNumber || 'Movement'} created — ${this.lines.length} line(s), ${this.total()} units`); this.dialogRef.close(true); },
      error: e => { this.saving = false; this.toast.error(e?.error?.message || 'Could not create the movement'); }
    });
  }
}

// ═══ Assign vehicle / driver dialog ═══
@Component({
  selector: 'app-assign-internal-movement-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Assign {{ data.movement.loadNumber }}</h2>
    <mat-dialog-content>
      <p class="sub">{{ data.movement.fromWarehouseName }} → {{ data.movement.toWarehouseName }} · {{ data.movement.totalUnits | number }} units</p>
      <mat-form-field appearance="outline" style="width:100%">
        <mat-label>Vehicle</mat-label>
        <mat-select [(ngModel)]="vehicleId">
          <mat-option [value]="0">— none —</mat-option>
          @for (v of data.vehicles; track v.id) { <mat-option [value]="v.id">{{ v.registrationNumber }} <small>{{ v.make }} {{ v.model }}</small></mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" style="width:100%">
        <mat-label>Driver</mat-label>
        <mat-select [(ngModel)]="driverId">
          <mat-option [value]="0">— none —</mat-option>
          @for (d of data.drivers; track d.id) { <mat-option [value]="d.id">{{ d.firstName }} {{ d.lastName }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" style="width:100%">
        <mat-label>Planned date</mat-label>
        <input matInput type="date" [(ngModel)]="date">
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="saving" (click)="save()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`.sub { color: var(--color-text-3); font-size: var(--text-sm); margin: 0 0 12px; }`]
})
export class AssignInternalMovementDialog {
  vehicleId: number; driverId: number; date: string; saving = false;
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  constructor(public dialogRef: MatDialogRef<AssignInternalMovementDialog>, @Inject(MAT_DIALOG_DATA) public data: { movement: InternalMovement; vehicles: any[]; drivers: any[] }) {
    this.vehicleId = data.movement.vehicleId || 0;
    this.driverId = data.movement.driverId || 0;
    this.date = data.movement.scheduledDate ? data.movement.scheduledDate.substring(0, 10) : '';
  }
  save(): void {
    this.saving = true;
    this.http.put(`${environment.apiUrl}/logistics/internal-movements/${this.data.movement.id}/assign`, { vehicleId: this.vehicleId, driverId: this.driverId, scheduledDate: this.date || null }).subscribe({
      next: () => { this.toast.done('Assignment saved'); this.dialogRef.close(true); },
      error: e => { this.saving = false; this.toast.error(e?.error?.message || 'Could not save'); }
    });
  }
}

// ═══ Receive dialog (confirm quantities that arrived) ═══
@Component({
  selector: 'app-receive-internal-movement-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title><mat-icon style="vertical-align:middle;margin-right:8px;color:var(--color-ok);">inventory</mat-icon>Receive {{ data.movement.loadNumber }} at {{ data.movement.toWarehouseName }}</h2>
    <mat-dialog-content>
      <p class="sub">Confirm what arrived. Each line is added to {{ data.movement.toWarehouseName }} stock. Short lines need a reason.</p>
      <table class="tbl">
        <thead><tr><th>Code</th><th>Item</th><th class="num">Sent</th><th class="num qty">Received</th></tr></thead>
        <tbody>
          @for (l of lines; track l.commodityId; let i = $index) {
            <tr [class.short]="l.received < l.sent">
              <td class="mono">{{ l.code }}</td><td>{{ l.name }}</td><td class="num">{{ l.sent | number }}</td>
              <td class="num qty"><input class="qin" type="number" min="0" [max]="l.sent" [(ngModel)]="l.received"></td>
            </tr>
          }
        </tbody>
      </table>
      <mat-form-field appearance="outline" style="width:100%">
        <mat-label>Reason {{ isShort() ? '(required — a line is short)' : '(optional)' }}</mat-label>
        <input matInput [(ngModel)]="reason" placeholder="e.g. 2 boxes damaged in transit">
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!valid() || saving" (click)="save()"><mat-icon>done_all</mat-icon> Receive into stock</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .sub { color: var(--color-text-3); font-size: var(--text-sm); margin: 0 0 12px; }
    .tbl { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: var(--text-sm);
      th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; color: var(--color-text-3); padding: 6px 8px; border-bottom: 1px solid var(--color-line); }
      td { padding: 4px 8px; border-bottom: 1px solid var(--color-surface-2); } .num { text-align: right; } .qty { width: 110px; } tr.short td { background: #fff7ed; } }
    .mono { font-family: var(--font-mono); }
    .qin { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--color-line); border-radius: 6px; font: inherit; text-align: right; background: var(--color-surface); color: inherit; }
  `]
})
export class ReceiveInternalMovementDialog {
  lines: { commodityId: number; code?: string; name?: string; sent: number; received: number }[];
  reason = ''; saving = false;
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  constructor(public dialogRef: MatDialogRef<ReceiveInternalMovementDialog>, @Inject(MAT_DIALOG_DATA) public data: { movement: InternalMovement }) {
    const byC = new Map<number, { commodityId: number; code?: string; name?: string; sent: number; received: number }>();
    for (const l of data.movement.lines) {
      if (!l.commodityId) continue;
      const e = byC.get(l.commodityId);
      if (e) { e.sent += l.quantity; e.received += l.quantity; } else byC.set(l.commodityId, { commodityId: l.commodityId, code: l.code, name: l.name, sent: l.quantity, received: l.quantity });
    }
    this.lines = [...byC.values()];
  }
  isShort(): boolean { return this.lines.some(l => (l.received ?? 0) < l.sent); }
  valid(): boolean { return this.lines.length > 0 && this.lines.every(l => l.received >= 0 && l.received <= l.sent) && (!this.isShort() || !!this.reason.trim()); }
  save(): void {
    this.saving = true;
    this.http.post(`${environment.apiUrl}/logistics/internal-movements/${this.data.movement.id}/receive`, {
      reason: this.reason || null, lines: this.lines.map(l => ({ commodityId: l.commodityId, receivedQuantity: l.received }))
    }).subscribe({
      next: () => { this.toast.done(`${this.data.movement.loadNumber} received into ${this.data.movement.toWarehouseName}`); this.dialogRef.close(true); },
      error: e => { this.saving = false; this.toast.error(e?.error?.message || 'Could not receive'); }
    });
  }
}
