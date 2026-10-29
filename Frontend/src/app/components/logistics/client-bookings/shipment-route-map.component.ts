/// <reference types="google.maps" />
import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { GoogleMapsLoaderService } from '../../../services/google-maps-loader.service';
import { AddressLookupService } from '../../../services/address-lookup.service';

export interface RoutePoint { latitude?: number | null; longitude?: number | null; label?: string | null; }

/** Small Google map showing a pickup (C) and delivery (D) pin with the driving route and estimate. */
@Component({
  selector: 'app-shipment-route-map',
  standalone: true,
  imports: [DecimalPipe, MatIconModule],
  template: `
    <div class="wrap" [style.height.px]="height">
      <div #el class="map"></div>
      @if (!ready()) { <div class="ph"><mat-icon>map</mat-icon> {{ error() || 'Loading map…' }}</div> }
      @else if (!hasPins()) { <div class="ph"><mat-icon>location_off</mat-icon> No coordinates for this shipment yet</div> }
      @if (estimate(); as e) { <div class="pill"><mat-icon>route</mat-icon> {{ e.distanceKm | number:'1.0-1' }} km · {{ fmt(e.durationMin) }}</div> }
      @if (hasPins()) { <a class="open" [href]="mapsLink()" target="_blank" rel="noopener" title="Open in Google Maps"><mat-icon>open_in_new</mat-icon></a> }
    </div>
  `,
  styles: [`
    .wrap { position: relative; border-radius: 10px; overflow: hidden; background: var(--color-surface-3); }
    .map { position: absolute; inset: 0; }
    .ph { position: absolute; inset: 0; display: grid; place-items: center; color: var(--color-text-3); font-size: 13px; pointer-events: none; }
    .pill { position: absolute; left: 10px; bottom: 10px; display: inline-flex; align-items: center; gap: 4px; background: var(--color-surface); color: #1a56c4; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
    .pill mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .open { position: absolute; right: 10px; top: 10px; background: var(--color-surface); border-radius: 6px; width: 28px; height: 28px; display: grid; place-items: center; color: var(--color-text); box-shadow: 0 1px 4px rgba(0,0,0,.2); }
    .open mat-icon { font-size: 18px; width: 18px; height: 18px; }
  `]
})
export class ShipmentRouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() pickup: RoutePoint | null | undefined;
  @Input() delivery: RoutePoint | null | undefined;
  @Input() height = 220;
  @ViewChild('el', { static: true }) el!: ElementRef<HTMLDivElement>;

  private loader = inject(GoogleMapsLoaderService);
  private lookup = inject(AddressLookupService);
  ready = signal(false);
  error = signal('');
  hasPins = signal(false);
  estimate = signal<{ distanceKm: number; durationMin: number } | null>(null);
  private g: typeof google | null = null;
  private map?: google.maps.Map;
  private overlays: (google.maps.Marker | google.maps.Polyline)[] = [];
  private seq = 0;

  ngAfterViewInit() {
    this.loader.load().then(g => {
      this.g = g;
      this.map = new g.maps.Map(this.el.nativeElement, { center: { lat: -29, lng: 24.5 }, zoom: 5, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative' });
      this.ready.set(true);
      this.draw();
    }).catch(() => this.error.set('Google Maps unavailable'));
  }
  ngOnChanges() { this.draw(); }
  ngOnDestroy() { this.clear(); }

  mapsLink() {
    const p = this.pickup, d = this.delivery;
    if (p?.latitude && d?.latitude) return `https://www.google.com/maps/dir/?api=1&origin=${p.latitude},${p.longitude}&destination=${d.latitude},${d.longitude}&travelmode=driving`;
    const one = p?.latitude ? p : d;
    return `https://www.google.com/maps/search/?api=1&query=${one?.latitude},${one?.longitude}`;
  }
  fmt(min: number) { return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`; }

  private clear() { this.overlays.forEach(o => o.setMap(null)); this.overlays = []; }

  private async draw() {
    if (!this.g || !this.map) return;
    const g = this.g, map = this.map, run = ++this.seq;
    this.clear(); this.estimate.set(null);
    const pin = (pt: RoutePoint | null | undefined, label: string, color: string) => {
      if (!(pt?.latitude && pt?.longitude)) return null;
      const pos = { lat: pt.latitude, lng: pt.longitude };
      this.overlays.push(new g.maps.Marker({ map, position: pos, title: pt.label ?? '', label: { text: label, color: '#fff', fontWeight: '700' },
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 12, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } }));
      return pos;
    };
    const p = pin(this.pickup, 'C', '#1a73e8');
    const d = pin(this.delivery, 'D', '#d93025');
    this.hasPins.set(!!(p || d));
    if (p && d) {
      const b = new g.maps.LatLngBounds(); b.extend(p); b.extend(d); map.fitBounds(b, 40);
      const r = await this.lookup.route(p, d);
      if (run !== this.seq) return;
      if (r) {
        this.estimate.set({ distanceKm: r.distanceKm, durationMin: r.durationMin });
        if (r.polyline) this.overlays.push(new g.maps.Polyline({ map, path: r.polyline, strokeColor: '#1a73e8', strokeOpacity: .85, strokeWeight: 4 }));
      }
    } else if (p || d) { map.setCenter((p ?? d)!); map.setZoom(14); }
  }
}
