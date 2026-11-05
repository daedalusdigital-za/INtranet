import { Component, ElementRef, Inject, ViewChild, AfterViewInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../environments/environment';
import { GoogleMapsLoaderService } from '../../services/google-maps-loader.service';

declare const google: any;

export interface FleetTrailDialogData { registration: string; from?: string; to?: string; tripId?: number; title?: string; }

interface TrailTrip {
  id: number; seq: number; date: string; start: string; end?: string;
  startLat: number; startLng: number; startLocation?: string; endLat: number; endLng: number; endLocation?: string;
  km: number; durationSeconds: number; idleSeconds: number; maxSpeed: number; harsh: number;
}
interface Trail { registration: string; vehicle?: string; driver?: string; from: string; to: string; totalKm: number; trips: TrailTrip[]; breadcrumbs: { t: string; lat: number; lng: number; speed?: number; address?: string }[]; }

/** Pop-up map of where a vehicle went: CarTrack trip legs (start → end) joined in time order, GPS breadcrumbs where we have them. */
@Component({
  selector: 'app-fleet-trail-map-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title class="hd">
      <mat-icon>route</mat-icon>
      <span class="reg">{{ data.registration }}</span>
      @if (trail(); as t) { <small>{{ t.vehicle }} @if (t.driver) { · {{ t.driver }} } · {{ t.from | date:'dd MMM' }}@if (t.to !== t.from) { – {{ t.to | date:'dd MMM' }} } · <b>{{ t.totalKm | number:'1.0-1' }} km</b> · {{ t.trips.length }} trip(s)</small> }
      <span class="sp"></span>
      <button mat-icon-button mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
    </h2>
    <mat-dialog-content class="body">
      <div class="map" #map></div>
      <aside class="side">
        @if (loading()) { <p class="muted">Loading movement…</p> }
        @else if (error()) { <p class="muted err">{{ error() }}</p> }
        @else {
        @if (trail(); as t) {
          @if (!t.trips.length) { <p class="muted">No recorded trips for this vehicle in the period.</p> }
          <div class="legend"><span class="dot s"></span> start <span class="dot e"></span> end <span class="line"></span> trip leg @if (t.breadcrumbs.length) { <span class="line gps"></span> GPS trail }</div>
          <ol class="trips">
            @for (tr of t.trips; track tr.id) {
              <li [class.on]="focused() === tr.id" (click)="focus(tr)">
                <span class="n">{{ tr.seq }}</span>
                <div class="txt">
                  <b>{{ tr.start | date:'dd MMM HH:mm' }} → {{ tr.end | date:'HH:mm' }}</b>
                  <span class="pl">{{ tr.startLocation || '—' }}</span>
                  <span class="pl">↳ {{ tr.endLocation || '—' }}</span>
                  <small>{{ tr.km | number:'1.0-1' }} km · {{ dur(tr.durationSeconds) }}@if (tr.idleSeconds) { · idle {{ dur(tr.idleSeconds) }} } · max {{ tr.maxSpeed }}@if (tr.harsh) { · <em class="hot">{{ tr.harsh }} harsh</em> }</small>
                </div>
              </li>
            }
          </ol>
        }
        }
      </aside>
    </mat-dialog-content>
  `,
  styles: [`
    :host { display: block; }
    .hd { display: flex; align-items: center; gap: 10px; margin: 0; padding: 12px 16px; font-size: 1rem; mat-icon { color: var(--color-primary); } .reg { font-family: var(--font-mono); font-weight: 700; } small { font-weight: 400; color: var(--color-text-3); font-size: var(--text-sm); } .sp { flex: 1; } }
    .body { display: grid; grid-template-columns: 1fr 340px; height: 72vh; max-height: 72vh; padding: 0 !important; overflow: hidden; }
    .map { width: 100%; height: 100%; min-height: 400px; background: var(--color-surface-2); }
    .side { border-left: 1px solid var(--color-line); overflow: auto; padding: 10px 12px; background: var(--color-surface); }
    .legend { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: var(--text-xs); color: var(--color-text-3); margin-bottom: 8px; .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; } .dot.s { background: #22c55e; } .dot.e { background: #ef4444; } .line { width: 22px; height: 3px; background: #2563eb; display: inline-block; margin-left: 6px; } .line.gps { background: #f59e0b; } }
    .trips { list-style: none; margin: 0; padding: 0; li { display: flex; gap: 8px; padding: 8px 6px; border-bottom: 1px solid var(--color-surface-2); cursor: pointer; border-radius: 6px; } li:hover { background: var(--color-surface-2); } li.on { background: var(--color-primary-soft); }
      .n { flex: 0 0 22px; height: 22px; border-radius: 50%; background: #2563eb; color: #fff; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; }
      .txt { display: flex; flex-direction: column; min-width: 0; font-size: var(--text-sm); b { font-size: var(--text-xs); color: var(--color-text-2); } .pl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } small { color: var(--color-text-3); font-size: var(--text-xs); } .hot { color: var(--color-danger); font-style: normal; font-weight: 600; } } }
    .muted { color: var(--color-text-3); font-size: var(--text-sm); &.err { color: var(--color-danger); } }
    @media (max-width: 800px) { .body { grid-template-columns: 1fr; grid-template-rows: 1fr 220px; } .side { border-left: 0; border-top: 1px solid var(--color-line); } }
  `]
})
export class FleetTrailMapDialog implements AfterViewInit, OnDestroy {
  @ViewChild('map') mapEl!: ElementRef<HTMLDivElement>;
  private http = inject(HttpClient);
  private mapsLoader = inject(GoogleMapsLoaderService);
  loading = signal(true);
  error = signal('');
  trail = signal<Trail | null>(null);
  focused = signal<number | null>(null);
  private map: any; private overlays: any[] = []; private bounds: any; private tripShapes = new Map<number, any[]>();

  constructor(public ref: MatDialogRef<FleetTrailMapDialog>, @Inject(MAT_DIALOG_DATA) public data: FleetTrailDialogData) {}

  ngAfterViewInit(): void {
    const p = new URLSearchParams({ registration: this.data.registration });
    if (this.data.tripId) p.set('tripId', String(this.data.tripId));
    if (this.data.from) p.set('from', this.data.from);
    if (this.data.to) p.set('to', this.data.to);
    Promise.all([
      this.mapsLoader.load(),
      this.http.get<Trail>(`${environment.apiUrl}/fleet/movements/trail?${p}`).toPromise()
    ]).then(([, t]) => {
      this.trail.set(t || null); this.loading.set(false);
      this.map = new google.maps.Map(this.mapEl.nativeElement, { center: { lat: -29, lng: 25 }, zoom: 6, mapTypeControl: false, streetViewControl: false, fullscreenControl: true });
      this.draw();
    }).catch(e => { this.loading.set(false); this.error.set(e?.error?.message || e?.message || 'Could not load the movement trail'); });
  }
  ngOnDestroy(): void { this.overlays.forEach(o => o.setMap?.(null)); }

  private draw(): void {
    const t = this.trail(); if (!t || !this.map) return;
    this.bounds = new google.maps.LatLngBounds();
    const ok = (la: number, ln: number) => la && ln && Math.abs(la) <= 90 && Math.abs(ln) <= 180;

    // GPS breadcrumbs (amber) — the real path where we have it
    const gps = t.breadcrumbs.filter(c => ok(c.lat, c.lng)).map(c => ({ lat: c.lat, lng: c.lng }));
    if (gps.length > 1) {
      const pl = new google.maps.Polyline({ path: gps, strokeColor: '#f59e0b', strokeOpacity: 0.9, strokeWeight: 4, map: this.map, zIndex: 2 });
      this.overlays.push(pl); gps.forEach(g => this.bounds.extend(g));
    }

    // Trip legs (blue): start → end, joined in order; numbered start markers
    const info = new google.maps.InfoWindow();
    t.trips.forEach(tr => {
      const shapes: any[] = [];
      const s = { lat: tr.startLat, lng: tr.startLng }, e = { lat: tr.endLat, lng: tr.endLng };
      if (!ok(s.lat, s.lng)) return;
      this.bounds.extend(s);
      if (ok(e.lat, e.lng)) {
        this.bounds.extend(e);
        shapes.push(new google.maps.Polyline({ path: [s, e], strokeColor: '#2563eb', strokeOpacity: 0.75, strokeWeight: 3, map: this.map, zIndex: 1,
          icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 2.5, strokeColor: '#2563eb' }, offset: '50%' }] }));
        shapes.push(new google.maps.Marker({ position: e, map: this.map, zIndex: 3, icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#ef4444', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 1.5 }, title: `End · ${tr.endLocation || ''}` }));
      }
      const m = new google.maps.Marker({ position: s, map: this.map, zIndex: 4, label: { text: String(tr.seq), color: '#fff', fontSize: '11px', fontWeight: '700' },
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#22c55e', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }, title: `Trip ${tr.seq} · ${tr.startLocation || ''}` });
      m.addListener('click', () => {
        info.setContent(`<div style="font:13px system-ui"><b>Trip ${tr.seq}</b> · ${tr.km} km · ${this.dur(tr.durationSeconds)}<br>${tr.startLocation || ''}<br>↳ ${tr.endLocation || ''}</div>`);
        info.open({ map: this.map, anchor: m }); this.focused.set(tr.id);
      });
      shapes.push(m);
      this.overlays.push(...shapes); this.tripShapes.set(tr.id, shapes);
    });

    if (!this.bounds.isEmpty()) {
      this.map.fitBounds(this.bounds, 40);
      if (t.trips.length === 1 && gps.length < 2) google.maps.event.addListenerOnce(this.map, 'idle', () => { if (this.map.getZoom() > 15) this.map.setZoom(15); });
    }
  }

  focus(tr: TrailTrip): void {
    this.focused.set(tr.id);
    if (!this.map) return;
    const b = new google.maps.LatLngBounds();
    b.extend({ lat: tr.startLat, lng: tr.startLng });
    if (tr.endLat && tr.endLng) b.extend({ lat: tr.endLat, lng: tr.endLng });
    this.map.fitBounds(b, 80);
    google.maps.event.addListenerOnce(this.map, 'idle', () => { if (this.map.getZoom() > 15) this.map.setZoom(15); });
  }

  dur(s: number): string { if (!s) return '—'; const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return h ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`; }
}
