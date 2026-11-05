import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';

interface Trip {
  id: number; date: string; registration: string; vehicleId?: number; vehicle?: string; province?: string; driver?: string;
  start: string; end?: string; startLocation?: string; endLocation?: string; startGeofence?: string; endGeofence?: string;
  km: number; durationSeconds: number; idleSeconds: number; maxSpeed: number; harsh: number;
  harshBraking: number; harshCornering: number; harshAcceleration: number;
}
interface PerVehicle { registration: string; vehicle?: string; province?: string; driver?: string; trips: number; km: number; activeDays: number; maxSpeed: number; harsh: number; lastTrip: string; }
interface Movements {
  from: string; to: string; totalTrips: number; totalKm: number; vehiclesMoved: number; vehiclesIdle: number; harshEvents: number; truncated: boolean;
  perVehicle: PerVehicle[]; idle: { id: number; registrationNumber: string; vehicle: string; province?: string; tracked: boolean }[]; trips: Trip[];
}

/** Logistics → Movement: every trip the fleet made (CarTrack ignition-on → off legs), with a per-vehicle rollup. */
@Component({
  selector: 'app-fleet-movements',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <div class="fm">
      <div class="fm-bar">
        <div class="fm-range" role="group" aria-label="Date range">
          @for (p of presets; track p.key) {
            <button type="button" [class.on]="preset() === p.key" (click)="setPreset(p.key)">{{ p.label }}</button>
          }
        </div>
        <mat-form-field appearance="outline" class="fm-date"><mat-label>From</mat-label><input matInput type="date" [(ngModel)]="from" (change)="preset.set('custom'); load()"></mat-form-field>
        <mat-form-field appearance="outline" class="fm-date"><mat-label>To</mat-label><input matInput type="date" [(ngModel)]="to" (change)="preset.set('custom'); load()"></mat-form-field>
        <mat-form-field appearance="outline" class="fm-prov">
          <mat-label>Province</mat-label>
          <mat-select [(ngModel)]="province" (selectionChange)="load()">
            <mat-option value="">All</mat-option>
            @for (p of ['GP','KZN','CPT','PE']; track p) { <mat-option [value]="p">{{ p }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" class="fm-search">
          <mat-label>Vehicle, driver or place</mat-label>
          <input matInput [(ngModel)]="search" placeholder="e.g. ND 123 or Durban">
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>
        <span class="fm-spacer"></span>
        <button mat-icon-button (click)="load()" matTooltip="Reload" aria-label="Reload"><mat-icon>refresh</mat-icon></button>
        <button mat-stroked-button (click)="exportCsv()" [disabled]="!data()"><mat-icon>file_download</mat-icon> Export</button>
      </div>

      @if (loading()) { <p class="fm-muted">Loading movements…</p> }
      @else if (error()) { <p class="fm-muted err"><mat-icon>error_outline</mat-icon>{{ error() }}</p> }
      @else {
      @if (data(); as d) {
        <div class="fm-kpis">
          <div class="k"><span>Trips</span><b>{{ d.totalTrips | number }}</b></div>
          <div class="k"><span>Distance</span><b>{{ d.totalKm | number:'1.0-0' }} km</b></div>
          <div class="k ok"><span>Vehicles moved</span><b>{{ d.vehiclesMoved }}</b></div>
          <div class="k" [class.warn]="d.vehiclesIdle > 0" [matTooltip]="idleTip()"><span>Did not move</span><b>{{ d.vehiclesIdle }}</b></div>
          <div class="k" [class.bad]="d.harshEvents > 0"><span>Harsh events</span><b>{{ d.harshEvents | number }}</b></div>
        </div>
        @if (d.truncated) { <p class="fm-muted"><mat-icon>info</mat-icon>Showing the most recent trips only — narrow the dates or province to see everything.</p> }

        <div class="fm-view" role="group" aria-label="View">
          <button type="button" [class.on]="view() === 'vehicles'" (click)="view.set('vehicles')">By vehicle</button>
          <button type="button" [class.on]="view() === 'trips'" (click)="view.set('trips')">All trips</button>
        </div>

        @if (view() === 'vehicles') {
          <table class="app-table fm-table">
            <thead><tr><th>Vehicle</th><th>Driver</th><th>Prov</th><th class="num">Trips</th><th class="num">km</th><th class="num">Active days</th><th class="num">km / day</th><th class="num">Max speed</th><th class="num">Harsh</th><th>Last trip</th><th></th></tr></thead>
            <tbody>
              @for (v of filteredVehicles(); track v.registration) {
                <tr>
                  <td><span class="ref">{{ v.registration }}</span><small>{{ v.vehicle }}</small></td>
                  <td>{{ v.driver || '—' }}</td>
                  <td>{{ v.province || '—' }}</td>
                  <td class="num">{{ v.trips }}</td>
                  <td class="num"><b>{{ v.km | number:'1.0-1' }}</b></td>
                  <td class="num">{{ v.activeDays }}</td>
                  <td class="num">{{ (v.activeDays ? v.km / v.activeDays : 0) | number:'1.0-0' }}</td>
                  <td class="num" [class.hot]="v.maxSpeed > 120">{{ v.maxSpeed | number:'1.0-0' }}</td>
                  <td class="num" [class.hot]="v.harsh > 0">{{ v.harsh }}</td>
                  <td>{{ v.lastTrip | date:'dd MMM HH:mm' }}</td>
                  <td><button mat-button (click)="search = v.registration; view.set('trips')">Trips <mat-icon iconPositionEnd>chevron_right</mat-icon></button></td>
                </tr>
              } @empty { <tr><td colspan="11" class="fm-muted">No vehicle moved in this period.</td></tr> }
            </tbody>
          </table>
          @if (d.idle.length) {
            <details class="fm-idle">
              <summary>{{ d.idle.length }} vehicle(s) did not move in this period</summary>
              <div class="fm-chips">@for (v of d.idle; track v.id) { <span class="chip" [class.untracked]="!v.tracked" [matTooltip]="v.vehicle + (v.tracked ? '' : ' · not linked to CarTrack, so no trips can be recorded')">{{ v.registrationNumber }}@if (!v.tracked) { <mat-icon>link_off</mat-icon> }</span> }</div>
            </details>
          }
        } @else {
          <table class="app-table fm-table">
            <thead><tr><th>Date</th><th>Vehicle</th><th>Driver</th><th>From</th><th>To</th><th class="num">km</th><th class="num">Time</th><th class="num">Idle</th><th class="num">Max</th><th class="num">Harsh</th></tr></thead>
            <tbody>
              @for (t of filteredTrips(); track t.id) {
                <tr>
                  <td><b>{{ t.start | date:'dd MMM' }}</b><small>{{ t.start | date:'HH:mm' }} → {{ t.end | date:'HH:mm' }}</small></td>
                  <td><span class="ref">{{ t.registration }}</span><small>{{ t.vehicle }}</small></td>
                  <td>{{ t.driver || '—' }}</td>
                  <td class="place" [matTooltip]="t.startLocation || ''">{{ t.startGeofence || t.startLocation || '—' }}</td>
                  <td class="place" [matTooltip]="t.endLocation || ''">{{ t.endGeofence || t.endLocation || '—' }}</td>
                  <td class="num"><b>{{ t.km | number:'1.0-1' }}</b></td>
                  <td class="num">{{ dur(t.durationSeconds) }}</td>
                  <td class="num">{{ dur(t.idleSeconds) }}</td>
                  <td class="num" [class.hot]="t.maxSpeed > 120">{{ t.maxSpeed | number:'1.0-0' }}</td>
                  <td class="num" [class.hot]="t.harsh > 0" [matTooltip]="t.harsh ? ('Braking ' + t.harshBraking + ' · Cornering ' + t.harshCornering + ' · Acceleration ' + t.harshAcceleration) : ''">{{ t.harsh || '—' }}</td>
                </tr>
              } @empty { <tr><td colspan="10" class="fm-muted">No trips match.</td></tr> }
            </tbody>
          </table>
        }
      }
      }
    </div>
  `,
  styles: [`
    .fm { padding: var(--space-2) 0; }
    .fm-bar { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-3); }
    .fm-bar mat-form-field { margin-bottom: -1.25em; }
    .fm-date { width: 150px; } .fm-prov { width: 120px; } .fm-search { width: 260px; }
    .fm-spacer { flex: 1; }
    .fm-range, .fm-view { display: inline-flex; background: var(--color-surface-2); border-radius: 999px; padding: 3px; gap: 2px;
      button { border: 0; background: transparent; border-radius: 999px; padding: 5px 12px; font: inherit; font-size: var(--text-sm); color: var(--color-text-2); cursor: pointer; }
      button.on { background: var(--color-surface); color: var(--color-primary); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.1); } }
    .fm-view { margin-bottom: var(--space-2); }
    .fm-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-2); margin-bottom: var(--space-3);
      .k { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 10px 12px; display: flex; flex-direction: column; span { font-size: var(--text-xs); text-transform: uppercase; color: var(--color-text-3); } b { font-size: 1.3rem; } }
      .k.ok b { color: var(--color-ok); } .k.warn b { color: var(--color-warn); } .k.bad b { color: var(--color-danger); } }
    .fm-table { width: 100%; td small { display: block; color: var(--color-text-3); font-size: var(--text-xs); } .ref { font-family: var(--font-mono); font-weight: 600; } .num { text-align: right; white-space: nowrap; } .hot { color: var(--color-danger); font-weight: 600; } .place { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } }
    .fm-muted { color: var(--color-text-3); display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); &.err { color: var(--color-danger); } mat-icon { font-size: 18px; width: 18px; height: 18px; } }
    .fm-idle { margin-top: var(--space-3); summary { cursor: pointer; color: var(--color-text-2); font-size: var(--text-sm); } }
    .fm-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; .chip { display: inline-flex; align-items: center; gap: 3px; font-family: var(--font-mono); font-size: var(--text-xs); background: var(--color-surface-2); border-radius: 6px; padding: 2px 8px; mat-icon { font-size: 14px; width: 14px; height: 14px; } } .chip.untracked { color: var(--color-text-3); } }
    @media (max-width: 900px) { .fm-kpis { grid-template-columns: repeat(2, 1fr); } }
  `]
})
export class FleetMovementsComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private api = environment.apiUrl;

  readonly presets = [{ key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' }, { key: '7d', label: '7 days' }, { key: 'month', label: 'This month' }, { key: '30d', label: '30 days' }];
  preset = signal('7d');
  from = ''; to = ''; province = ''; search = '';
  view = signal<'vehicles' | 'trips'>('vehicles');
  loading = signal(false);
  error = signal('');
  data = signal<Movements | null>(null);
  private searchSig = signal('');

  ngOnInit(): void { this.setPreset('7d'); }

  setPreset(key: string): void {
    this.preset.set(key);
    const iso = (d: Date) => d.toISOString().substring(0, 10);
    const today = new Date();
    const d = (n: number) => { const x = new Date(today); x.setDate(x.getDate() + n); return x; };
    switch (key) {
      case 'today': this.from = iso(today); this.to = iso(today); break;
      case 'yesterday': this.from = iso(d(-1)); this.to = iso(d(-1)); break;
      case '7d': this.from = iso(d(-6)); this.to = iso(today); break;
      case 'month': this.from = iso(new Date(today.getFullYear(), today.getMonth(), 1)); this.to = iso(today); break;
      case '30d': this.from = iso(d(-29)); this.to = iso(today); break;
    }
    this.load();
  }

  load(): void {
    this.loading.set(true); this.error.set('');
    const p = new URLSearchParams({ from: this.from, to: this.to, limit: '2000' });
    if (this.province) p.set('province', this.province);
    this.http.get<Movements>(`${this.api}/fleet/movements?${p}`).subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message || 'Could not load movements'); }
    });
  }

  private matches(hay: (string | undefined)[]): boolean {
    const q = this.search.trim().toLowerCase();
    return !q || hay.some(h => (h || '').toLowerCase().includes(q));
  }
  filteredVehicles(): PerVehicle[] { return (this.data()?.perVehicle || []).filter(v => this.matches([v.registration, v.vehicle, v.driver, v.province])); }
  filteredTrips(): Trip[] { return (this.data()?.trips || []).filter(t => this.matches([t.registration, t.vehicle, t.driver, t.startLocation, t.endLocation, t.startGeofence, t.endGeofence])); }
  idleTip(): string { const d = this.data(); return d ? d.idle.slice(0, 12).map(v => v.registrationNumber).join(', ') + (d.idle.length > 12 ? '…' : '') : ''; }

  dur(s: number): string {
    if (!s) return '—';
    const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    return h ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
  }

  exportCsv(): void {
    const rows = this.view() === 'vehicles'
      ? [['Registration', 'Vehicle', 'Driver', 'Province', 'Trips', 'km', 'Active days', 'Max speed', 'Harsh', 'Last trip'],
         ...this.filteredVehicles().map(v => [v.registration, v.vehicle, v.driver, v.province, v.trips, v.km, v.activeDays, v.maxSpeed, v.harsh, v.lastTrip])]
      : [['Date', 'Start', 'End', 'Registration', 'Vehicle', 'Driver', 'From', 'To', 'km', 'Duration (s)', 'Idle (s)', 'Max speed', 'Harsh braking', 'Harsh cornering', 'Harsh acceleration'],
         ...this.filteredTrips().map(t => [t.date, t.start, t.end, t.registration, t.vehicle, t.driver, t.startGeofence || t.startLocation, t.endGeofence || t.endLocation, t.km, t.durationSeconds, t.idleSeconds, t.maxSpeed, t.harshBraking, t.harshCornering, t.harshAcceleration])];
    const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `FleetMovements-${this.from}-to-${this.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast.done('Exported');
  }
}
