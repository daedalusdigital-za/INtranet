import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import { GoogleMapsLoaderService } from '../../services/google-maps-loader.service';

declare const google: any;

interface LiveVehicle {
  vehicleId: string;
  registration: string;
  driver?: string;
  latitude: number;
  longitude: number;
  address?: string;
  speed: number;
  heading: number;
  status: string;      // moving | parked | idling | offline
  isMoving: boolean;
  alert: boolean;      // recomputed client-side (speeding) for the open map
  lastUpdate?: string;
}

/**
 * Open Map — a live, curfew-free fleet map for logistics. Mirrors the controller
 * Live Map (triangle markers, speedometer rings, fuel stations, active-load
 * routes) but shows real-time data with no curfew logic. Can be maximised to
 * fill the whole screen.
 */
@Component({
  selector: 'app-open-map',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatSlideToggleModule, MatTooltipModule, MatSnackBarModule
  ],
  template: `
  <div class="openmap-wrap" [class.maximized]="maximized()" [class.light]="theme()==='light'">

    <!-- ===== Summary counters ===== -->
    <div class="counter-grid">
      <div class="counter total" [class.on]="statusFilter()==='all'" (click)="statusFilter.set('all')">
        <span class="c-val">{{ summary().total }}</span><span class="c-lbl">Total Fleet</span></div>
      <div class="counter moving" [class.on]="statusFilter()==='moving'" (click)="statusFilter.set('moving')">
        <span class="c-val">{{ summary().moving }}</span><span class="c-lbl">Moving</span></div>
      <div class="counter alert" [class.on]="statusFilter()==='alert'" [class.pulse]="summary().alerts > 0" (click)="statusFilter.set('alert')">
        <span class="c-val">{{ summary().alerts }}</span><span class="c-lbl">Alerts</span></div>
      <div class="counter parked" [class.on]="statusFilter()==='parked'" (click)="statusFilter.set('parked')">
        <span class="c-val">{{ summary().parked }}</span><span class="c-lbl">Parked</span></div>
      <div class="counter idling" [class.on]="statusFilter()==='idling'" (click)="statusFilter.set('idling')">
        <span class="c-val">{{ summary().idling }}</span><span class="c-lbl">Idling</span></div>
      <div class="counter offline" [class.on]="statusFilter()==='offline'" (click)="statusFilter.set('offline')">
        <span class="c-val">{{ summary().offline }}</span><span class="c-lbl">Offline</span></div>
    </div>

    <div class="live-layout">
      <!-- vehicle list -->
      <div class="veh-list">
        <div class="veh-search">
          <mat-icon>search</mat-icon>
          <input [(ngModel)]="filter" placeholder="Search reg / driver..." />
        </div>
        <div class="veh-filter-chips">
          <button [class.on]="statusFilter()==='all'" (click)="statusFilter.set('all')">All</button>
          <button class="blu" [class.on]="statusFilter()==='moving'" (click)="statusFilter.set('moving')">Moving</button>
          <button class="red" [class.on]="statusFilter()==='alert'" (click)="statusFilter.set('alert')">Alerts</button>
          <button class="grn" [class.on]="statusFilter()==='parked'" (click)="statusFilter.set('parked')">Parked</button>
          <button class="amb" [class.on]="statusFilter()==='idling'" (click)="statusFilter.set('idling')">Idling</button>
          <button class="off" [class.on]="statusFilter()==='offline'" (click)="statusFilter.set('offline')">Offline</button>
        </div>

        @if (loading()) {
          <div class="veh-loading"><mat-spinner diameter="30"></mat-spinner></div>
        } @else {
          @for (v of filteredVehicles(); track v.vehicleId) {
            <div class="veh-item" [class.sel]="selected()?.vehicleId===v.vehicleId"
                 [ngClass]="'st-'+v.status" [class.alerted]="v.alert" (click)="focusVehicle(v)">
              <div class="veh-dot" [ngClass]="'dot-'+(v.alert ? 'alert' : v.status)"></div>
              <div class="veh-info">
                <div class="veh-reg">{{ v.registration }}
                  @if (v.alert) { <mat-icon class="warn-ic">warning</mat-icon> }
                </div>
                <div class="veh-meta">
                  {{ v.driver || 'No driver' }} · {{ v.status | titlecase }}
                  @if (v.isMoving) { · {{ v.speed }} km/h }
                </div>
                @if (v.address) { <div class="veh-zone">{{ v.address }}</div> }
              </div>
            </div>
          }
          @if (filteredVehicles().length === 0) {
            <div class="veh-empty">No vehicles match</div>
          }
        }
      </div>

      <!-- map -->
      <div class="map-holder">
        <div #mapEl class="openmap-map"></div>
        <div class="map-toolbar">
          <mat-slide-toggle [(ngModel)]="autoRefresh" (change)="toggleAuto()">Auto-refresh</mat-slide-toggle>
          <button mat-stroked-button (click)="loadLive()" matTooltip="Refresh now">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
          <button mat-stroked-button (click)="toggleFuelingPoints()" matTooltip="Show/hide TFN petrol stations">
            <mat-icon>local_gas_station</mat-icon> Fuel Stations
          </button>
          <button mat-stroked-button (click)="toggleActiveLoads()" matTooltip="Show/hide routes for active loads">
            <mat-icon>alt_route</mat-icon> {{ activeLoadsVisible() ? 'Hide' : 'Load' }} Active Loads
            @if (activeLoadRoutes().length > 0 && activeLoadsVisible()) {
              <span style="margin-left:4px;color:#60a5fa;font-weight:700;">({{ activeLoadRoutes().length }})</span>
            }
          </button>
          <button mat-stroked-button (click)="toggleCustomers()" matTooltip="Show/hide customer sites (geocoded clients)">
            <mat-icon>business</mat-icon> {{ customersVisible() ? 'Hide' : 'Show' }} Customers
            @if (customerPoints().length > 0 && customersVisible()) {
              <span style="margin-left:4px;color:#38bdf8;font-weight:700;">({{ customerPoints().length }})</span>
            }
          </button>
          <button mat-stroked-button (click)="toggleTheme()"
                  [matTooltip]="theme()==='dark' ? 'Switch to light mode' : 'Switch to dark mode'">
            <mat-icon>{{ theme()==='dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
            {{ theme()==='dark' ? 'Light' : 'Dark' }}
          </button>
          <button mat-flat-button color="primary" class="max-btn" (click)="toggleMaximize()"
                  [matTooltip]="maximized() ? 'Exit full screen' : 'Maximize map'">
            <mat-icon>{{ maximized() ? 'fullscreen_exit' : 'fullscreen' }}</mat-icon>
            {{ maximized() ? 'Exit' : 'Maximize' }}
          </button>
        </div>
        <div class="map-legend">
          <span><i class="lg blu"></i> Moving</span>
          <span><i class="lg amb"></i> Idling</span>
          <span><i class="lg grn"></i> Parked</span>
          <span><i class="lg gry"></i> Offline</span>
          <span><i class="lg red"></i> Speeding</span>
          <span><mat-icon class="lg-ic">business</mat-icon> Customer site</span>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`
    .openmap-wrap { display:flex; flex-direction:column; gap:12px; }
    .openmap-wrap.maximized {
      position:fixed; inset:0; z-index:1200; background:#0b1220;
      padding:12px; margin:0; overflow:auto;
    }
    .openmap-wrap.light.maximized { background:var(--color-surface-2); }

    /* ---------- Light theme overrides ---------- */
    .light .counter { background:var(--color-surface); border-color:var(--color-line); }
    .light .counter:hover { border-color:var(--color-line-strong); }
    .light .counter.on { border-color:var(--color-primary); box-shadow:0 0 0 1px var(--color-primary) inset; }
    .light .counter.total .c-val { color:var(--color-text); }
    .light .counter .c-lbl { color:var(--color-text-3); }

    .light .veh-list { background:var(--color-surface); border-color:var(--color-line); }
    .light .veh-search { border-bottom-color:var(--color-line); }
    .light .veh-search mat-icon { color:var(--color-text-3); }
    .light .veh-search input { color:var(--color-text); }
    .light .veh-filter-chips { border-bottom-color:var(--color-line); }
    .light .veh-filter-chips button { background:var(--color-canvas); border-color:var(--color-line-strong); color:var(--color-text-2); }
    .light .veh-item { border-bottom-color:var(--color-line); }
    .light .veh-item:hover { background:var(--color-surface-2); }
    .light .veh-item.sel { background:#e0edff; box-shadow:inset 3px 0 0 var(--color-primary); }
    .light .veh-item.alerted { background:rgba(239,68,68,.07); }
    .light .veh-reg { color:var(--color-text); }
    .light .veh-meta { color:var(--color-text-2); }
    .light .veh-zone { color:var(--color-text-3); }
    .light .veh-empty { color:var(--color-text-3); }

    .light .map-holder { border-color:var(--color-line); }
    .light .map-toolbar { background:rgba(255,255,255,.9); }
    .light .map-legend { background:rgba(255,255,255,.9); color:var(--color-text-2); }

    .counter-grid { display:grid; grid-template-columns:repeat(6, 1fr); gap:10px; }
    .counter {
      background:#111a2e; border:1px solid var(--color-text); border-radius:10px;
      padding:10px 12px; display:flex; flex-direction:column; align-items:center;
      cursor:pointer; transition:.15s; user-select:none;
    }
    .counter:hover { border-color:var(--color-text-2); }
    .counter.on { border-color:#60a5fa; box-shadow:0 0 0 1px #60a5fa inset; }
    .counter .c-val { font-size:1.5rem; font-weight:800; line-height:1; }
    .counter .c-lbl { font-size:.72rem; color:var(--color-text-3); margin-top:4px; text-transform:uppercase; letter-spacing:.04em; }
    .counter.total .c-val { color:var(--color-line); }
    .counter.moving .c-val { color:#60a5fa; }
    .counter.alert .c-val { color:var(--color-danger); }
    .counter.parked .c-val { color:var(--color-ok); }
    .counter.idling .c-val { color:#fbbf24; }
    .counter.offline .c-val { color:var(--color-text-3); }
    .counter.pulse { animation:pulse 1.4s infinite; }
    @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5);} 50%{box-shadow:0 0 0 6px rgba(239,68,68,0);} }

    .live-layout { display:grid; grid-template-columns:320px 1fr; gap:12px; height:640px; }
    .maximized .live-layout { height:calc(100vh - 140px); }

    .veh-list {
      background:var(--color-text); border:1px solid var(--color-text); border-radius:10px;
      display:flex; flex-direction:column; overflow:hidden;
    }
    .veh-search { display:flex; align-items:center; gap:6px; padding:8px 10px; border-bottom:1px solid var(--color-text); }
    .veh-search mat-icon { color:var(--color-text-3); }
    .veh-search input { flex:1; background:transparent; border:none; outline:none; color:var(--color-line); font-size:.9rem; }
    .veh-filter-chips { display:flex; flex-wrap:wrap; gap:6px; padding:8px 10px; border-bottom:1px solid var(--color-text); }
    .veh-filter-chips button {
      border:1px solid var(--color-text-2); background:#111a2e; color:var(--color-line-strong); border-radius:14px;
      padding:3px 10px; font-size:.75rem; cursor:pointer; transition:.15s;
    }
    .veh-filter-chips button.on { background:var(--color-primary-hover); border-color:var(--color-primary-hover); color:#fff; }
    .veh-filter-chips button.blu.on { background:var(--color-primary); border-color:var(--color-primary); }
    .veh-filter-chips button.red.on { background:var(--color-danger); border-color:var(--color-danger); }
    .veh-filter-chips button.grn.on { background:var(--color-ok); border-color:var(--color-ok); }
    .veh-filter-chips button.amb.on { background:var(--color-warn); border-color:var(--color-warn); }
    .veh-filter-chips button.off.on { background:var(--color-text-2); border-color:var(--color-text-2); }

    .veh-list > :last-child { overflow:auto; }
    .veh-loading { display:flex; justify-content:center; padding:24px; }
    .veh-item {
      display:flex; gap:10px; align-items:flex-start; padding:9px 10px;
      border-bottom:1px solid #16233b; cursor:pointer; transition:.12s;
    }
    .veh-item:hover { background:#131f38; }
    .veh-item.sel { background:#17233f; box-shadow:inset 3px 0 0 #60a5fa; }
    .veh-item.alerted { background:rgba(239,68,68,.08); }
    .veh-dot { width:10px; height:10px; border-radius:50%; margin-top:4px; flex:0 0 auto; }
    .dot-moving { background:#60a5fa; } .dot-parked { background:var(--color-ok); }
    .dot-idling { background:#fbbf24; } .dot-offline { background:var(--color-text-3); }
    .dot-alert { background:var(--color-danger); box-shadow:0 0 0 3px rgba(239,68,68,.25); }
    .veh-reg { font-weight:700; color:var(--color-line); font-size:.9rem; display:flex; align-items:center; gap:4px; }
    .warn-ic { color:var(--color-danger); font-size:16px; width:16px; height:16px; }
    .veh-meta { font-size:.76rem; color:var(--color-text-3); margin-top:2px; }
    .veh-zone { font-size:.72rem; color:var(--color-text-3); margin-top:2px; }
    .veh-empty { padding:24px; text-align:center; color:var(--color-text-3); font-size:.85rem; }

    .map-holder { position:relative; border:1px solid var(--color-text); border-radius:10px; overflow:hidden; }
    .openmap-map { width:100%; height:100%; }
    .map-toolbar {
      position:absolute; top:10px; left:10px; display:flex; gap:8px; flex-wrap:wrap;
      background:rgba(15,23,42,.85); padding:8px; border-radius:8px; backdrop-filter:blur(4px);
      align-items:center;
    }
    .map-toolbar .max-btn { margin-left:auto; }
    .map-legend {
      position:absolute; bottom:10px; left:10px; display:flex; gap:12px; flex-wrap:wrap;
      background:rgba(15,23,42,.85); padding:6px 10px; border-radius:8px; font-size:.72rem; color:var(--color-line-strong);
    }
    .map-legend i.lg { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:4px; vertical-align:middle; }
    .map-legend .lg-ic { font-size:14px; width:14px; height:14px; vertical-align:middle; margin-right:3px; color:#0ea5e9; }
    .lg.blu{background:#60a5fa;} .lg.amb{background:#fbbf24;} .lg.grn{background:var(--color-ok);}
    .lg.gry{background:var(--color-text-3);} .lg.red{background:var(--color-danger);}

    @media (max-width:900px) {
      .counter-grid { grid-template-columns:repeat(3,1fr); }
      .live-layout { grid-template-columns:1fr; height:auto; }
      .openmap-map { height:420px; }
    }
  `]
})
export class OpenMapComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl!: ElementRef;

  private apiUrl = environment.apiUrl;
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  private readonly speedingThreshold = 90;   // km/h → flagged as an alert
  private readonly maxSpeedKmh = 120;         // full-scale of the speedometer ring

  loading = signal(false);
  vehicles = signal<LiveVehicle[]>([]);
  summary = signal<any>({ total: 0, moving: 0, parked: 0, idling: 0, offline: 0, alerts: 0 });
  selected = signal<LiveVehicle | null>(null);
  maximized = signal(false);
  theme = signal<'dark' | 'light'>((localStorage.getItem('openMapTheme') as 'dark' | 'light') || 'dark');

  filter = '';
  statusFilter = signal<'all' | 'moving' | 'alert' | 'parked' | 'idling' | 'offline'>('all');

  autoRefresh = true;
  private refreshTimer: any;
  private mapsReady = false;

  private map: any;
  private markers = new Map<string, any>();
  private speedRings = new Map<string, any>();

  fuelingPointsVisible = signal(false);
  fuelingPoints = signal<any[]>([]);
  private fuelingPointMarkers: any[] = [];

  activeLoadsVisible = signal(false);
  activeLoadRoutes = signal<any[]>([]);
  private activeLoadPolylines: any[] = [];
  private activeLoadMarkers: any[] = [];

  // customer sites (geocoded clients)
  customersVisible = signal(false);
  customerPoints = signal<any[]>([]);
  private customerMarkers: any[] = [];
  private customerCluster: any = null;
  private customerInfo: any = null;
  private clustererReady = false;

  filteredVehicles = computed(() => {
    const f = this.filter.trim().toLowerCase();
    const sf = this.statusFilter();
    return this.vehicles().filter(v => {
      if (sf === 'alert' && !v.alert) return false;
      if (sf === 'moving' && v.status !== 'moving') return false;
      if (sf === 'parked' && v.status !== 'parked') return false;
      if (sf === 'idling' && v.status !== 'idling') return false;
      if (sf === 'offline' && v.status !== 'offline') return false;
      if (!f) return true;
      return v.registration.toLowerCase().includes(f) || (v.driver || '').toLowerCase().includes(f);
    });
  });

  constructor(private http: HttpClient, private snack: MatSnackBar) {}

  ngOnInit(): void {
    this.loadGoogleMaps()
      .then(() => { this.mapsReady = true; this.initMap(); })
      .catch(err => console.error('Google Maps failed to load', err));
    this.loadLive();
    this.startAuto();
  }

  ngAfterViewInit(): void {
    if (this.mapsReady) this.initMap();
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  // ---------- data ----------
  loadLive(): void {
    this.loading.set(true);
    // Re-use the live position feed; pass a null curfew window so nothing is
    // treated as a curfew breach — this is a pure live map.
    this.http.get<any>(`${this.apiUrl}/logistics/controller/night-watch?curfewStart=0&curfewEnd=0`)
      .subscribe({
        next: (res) => {
          const raw: LiveVehicle[] = (res.vehicles || []).map((v: any) => ({
            ...v,
            // Curfew-free alert = speeding.
            alert: (v.speed || 0) >= this.speedingThreshold
          }));
          this.vehicles.set(raw);
          this.recomputeSummary(raw, res.summary);
          this.loading.set(false);
          this.renderMarkers();
        },
        error: () => { this.loading.set(false); this.snack.open('Failed to load live fleet', 'Close', { duration: 3000 }); }
      });
  }

  private recomputeSummary(list: LiveVehicle[], serverSummary: any): void {
    const alerts = list.filter(v => v.alert).length;
    this.summary.set({
      total: serverSummary?.total ?? list.length,
      moving: serverSummary?.moving ?? list.filter(v => v.status === 'moving').length,
      parked: serverSummary?.parked ?? list.filter(v => v.status === 'parked').length,
      idling: serverSummary?.idling ?? list.filter(v => v.status === 'idling').length,
      offline: serverSummary?.offline ?? list.filter(v => v.status === 'offline').length,
      alerts
    });
  }

  // ---------- auto refresh ----------
  startAuto(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.autoRefresh) this.refreshTimer = setInterval(() => this.loadLive(), 30000);
  }
  toggleAuto(): void { this.startAuto(); }

  toggleMaximize(): void {
    this.maximized.update(m => !m);
    // Google Maps needs a resize nudge after the container size changes.
    setTimeout(() => {
      if (this.map && typeof google !== 'undefined') {
        google.maps.event.trigger(this.map, 'resize');
      }
    }, 60);
  }

  toggleTheme(): void {
    const next = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(next);
    localStorage.setItem('openMapTheme', next);
    if (this.map && typeof google !== 'undefined') {
      this.map.setOptions({ styles: next === 'dark' ? this.darkStyle() : this.lightStyle() });
    }
  }

  // ---------- maps ----------
  private loadGoogleMaps(): Promise<void> {
    // Key is served by the API (no hardcoded key); the loader injects the script once app-wide.
    return this.mapsLoader.load().then(() => undefined);
  }

  private initMap(): void {
    if (!this.mapEl || this.map) return;
    const center = { lat: -26.2041, lng: 28.0473 }; // Johannesburg
    this.map = new google.maps.Map(this.mapEl.nativeElement, {
      center, zoom: 6, styles: this.theme() === 'dark' ? this.darkStyle() : this.lightStyle(),
      mapTypeControl: false, streetViewControl: false, fullscreenControl: false
    });
    this.renderMarkers();
  }

  private markerColor(v: LiveVehicle): string {
    if (v.alert) return '#ef4444';
    switch (v.status) {
      case 'moving': return '#60a5fa';
      case 'parked': return '#22c55e';
      case 'idling': return '#fbbf24';
      default: return '#6b7280';
    }
  }

  private renderMarkers(): void {
    if (!this.map || typeof google === 'undefined') return;
    const seen = new Set<string>();
    for (const v of this.vehicles()) {
      if (!v.latitude || !v.longitude) continue;
      seen.add(v.vehicleId);
      const color = this.markerColor(v);
      const pos = { lat: v.latitude, lng: v.longitude };

      // speedometer gauge ring beneath the marker
      const ringIcon = {
        url: this.buildSpeedRingSvg(v),
        scaledSize: new google.maps.Size(46, 46),
        anchor: new google.maps.Point(23, 23)
      };
      let ring = this.speedRings.get(v.vehicleId);
      if (ring) { ring.setPosition(pos); ring.setIcon(ringIcon); }
      else {
        ring = new google.maps.Marker({ position: pos, map: this.map, icon: ringIcon, clickable: false, zIndex: 1 });
        this.speedRings.set(v.vehicleId, ring);
      }

      // triangle (heading arrow) marker
      const icon = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: v.alert ? 8 : 6,
        fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2,
        rotation: v.isMoving ? (v.heading || 0) : 0
      };
      let m = this.markers.get(v.vehicleId);
      if (m) { m.setPosition(pos); m.setIcon(icon); }
      else {
        m = new google.maps.Marker({
          position: pos, map: this.map, icon,
          title: `${v.registration} — ${v.status}`, zIndex: 2
        });
        const info = new google.maps.InfoWindow();
        m.addListener('click', () => {
          info.setContent(`<div style="color:#111;min-width:160px">
            <strong>${v.registration}</strong><br>${v.driver || 'No driver'}<br>
            Status: ${v.status}${v.isMoving ? ' · ' + v.speed + ' km/h' : ''}<br>
            ${v.address || ''}</div>`);
          info.open(this.map, m);
        });
        this.markers.set(v.vehicleId, m);
      }
    }
    for (const [id, m] of this.markers) { if (!seen.has(id)) { m.setMap(null); this.markers.delete(id); } }
    for (const [id, r] of this.speedRings) { if (!seen.has(id)) { r.setMap(null); this.speedRings.delete(id); } }
  }

  /** Speedometer gauge ring (270° arc that fills with speed) as an SVG data-URL. */
  private buildSpeedRingSvg(v: LiveVehicle): string {
    const size = 46, cx = 23, cy = 23, r = 18;
    const startDeg = 135, sweep = 270;
    const speed = Math.max(0, v.speed || 0);
    const frac = Math.min(speed / this.maxSpeedKmh, 1);
    const endDeg = startDeg + sweep * frac;

    let arcColor = '#22c55e';
    if (speed > 80) arcColor = '#ef4444';
    else if (speed > 40) arcColor = '#f59e0b';
    if (v.alert) arcColor = '#ef4444';

    const polar = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };
    const arcPath = (a0: number, a1: number) => {
      const s = polar(a0), e = polar(a1);
      const large = (a1 - a0) > 180 ? 1 : 0;
      return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
    };

    const track = arcPath(startDeg, startDeg + sweep);
    const fill = speed > 0 ? arcPath(startDeg, endDeg) : '';
    const tip = polar(endDeg);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <path d="${track}" fill="none" stroke="#0f172a" stroke-opacity="0.25" stroke-width="4" stroke-linecap="round"/>
      ${fill ? `<path d="${fill}" fill="none" stroke="${arcColor}" stroke-width="4" stroke-linecap="round"/>` : ''}
      ${speed > 0 ? `<circle cx="${tip.x.toFixed(2)}" cy="${tip.y.toFixed(2)}" r="2.6" fill="${arcColor}" stroke="#ffffff" stroke-width="1"/>` : ''}
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  focusVehicle(v: LiveVehicle): void {
    this.selected.set(v);
    if (this.map && v.latitude && v.longitude) {
      this.map.panTo({ lat: v.latitude, lng: v.longitude });
      this.map.setZoom(14);
      const m = this.markers.get(v.vehicleId);
      if (m && google.maps.Animation) { m.setAnimation(google.maps.Animation.BOUNCE); setTimeout(() => m.setAnimation(null), 1500); }
    }
  }

  // ---------- fuel stations ----------
  toggleFuelingPoints(): void {
    if (this.fuelingPointsVisible()) { this.clearFuelingPoints(); this.fuelingPointsVisible.set(false); }
    else { this.loadFuelingPoints(); }
  }

  private loadFuelingPoints(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/tfn/fueling-points`).subscribe({
      next: (points) => {
        this.fuelingPoints.set(points);
        this.renderFuelingPoints();
        this.fuelingPointsVisible.set(true);
        this.snack.open(`${points.length} fuel stations loaded`, 'Close', { duration: 2000 });
      },
      error: () => this.snack.open('Failed to load fuel stations', 'Close', { duration: 3000 })
    });
  }

  private renderFuelingPoints(): void {
    if (!this.map || typeof google === 'undefined') return;
    this.clearFuelingPoints();
    for (const fp of this.fuelingPoints()) {
      const marker = new google.maps.Marker({
        position: { lat: fp.latitude, lng: fp.longitude },
        map: this.map,
        icon: { url: this.buildFuelPumpSvg(), scaledSize: new google.maps.Size(28, 34), anchor: new google.maps.Point(14, 32) },
        title: `${fp.name} (${fp.brand || 'TFN'})`
      });
      const info = new google.maps.InfoWindow();
      marker.addListener('click', () => {
        info.setContent(`<div style="color:#111;min-width:200px">
          <strong>${fp.name}</strong><br>Brand: ${fp.brand || 'N/A'}<br>
          Fuel: ${fp.fuelType || 'N/A'}<br>${fp.address}<br>${fp.city}, ${fp.province}</div>`);
        info.open(this.map, marker);
      });
      this.fuelingPointMarkers.push(marker);
    }
  }

  private clearFuelingPoints(): void {
    this.fuelingPointMarkers.forEach(m => m.setMap(null));
    this.fuelingPointMarkers = [];
  }

  private buildFuelPumpSvg(): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="34" viewBox="0 0 28 34">
      <path d="M14 33 C14 33 25 20 25 12.5 A11 11 0 1 0 3 12.5 C3 20 14 33 14 33 Z"
            fill="#f59e0b" stroke="#ffffff" stroke-width="1.5"/>
      <g fill="#ffffff">
        <rect x="8" y="6" width="7" height="12" rx="1.2"/>
        <rect x="9.4" y="7.6" width="4.2" height="3.4" rx="0.6" fill="#f59e0b"/>
        <path d="M15 8.5 l2.4 2.4 v5.1 a1.3 1.3 0 0 0 2.6 0 v-4.3 l-1.6 -1.6"
              fill="none" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round"/>
        <rect x="7.2" y="17.4" width="8.6" height="1.8" rx="0.9"/>
      </g>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  // ---------- active load routes ----------
  toggleActiveLoads(): void {
    if (this.activeLoadsVisible()) { this.clearActiveLoadRoutes(); this.activeLoadsVisible.set(false); }
    else { this.loadActiveLoadRoutes(); }
  }

  private loadActiveLoadRoutes(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/controller/active-load-routes`).subscribe({
      next: (routes) => {
        this.activeLoadRoutes.set(routes || []);
        this.renderActiveLoadRoutes();
        this.activeLoadsVisible.set(true);
        const totalWaypoints = (routes || []).reduce((s, r) => s + (r.waypoints?.length || 0), 0);
        this.snack.open(`${routes?.length || 0} active load routes (${totalWaypoints} waypoints)`, 'Close', { duration: 2500 });
      },
      error: () => this.snack.open('Failed to load active load routes', 'Close', { duration: 3000 })
    });
  }

  private renderActiveLoadRoutes(): void {
    if (!this.map || typeof google === 'undefined') return;
    this.clearActiveLoadRoutes();
    const palette = ['#60a5fa', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#f87171'];
    const directionsService = new google.maps.DirectionsService();
    let idx = 0;
    for (const route of this.activeLoadRoutes()) {
      const color = palette[idx % palette.length]; idx++;
      const path = (route.waypoints || []).map((w: any) => ({ lat: w.lat, lng: w.lng }));
      if (path.length < 2) continue;

      const origin = path[0];
      const destination = path[path.length - 1];
      const intermediates = path.slice(1, -1).map((p: any) => ({ location: p, stopover: true }));

      directionsService.route({
        origin, destination, waypoints: intermediates,
        travelMode: google.maps.TravelMode.DRIVING, optimizeWaypoints: false
      }, (result: any, status: any) => {
        if (status === 'OK' && result) {
          const renderer = new google.maps.DirectionsRenderer({
            map: this.map, directions: result, suppressMarkers: true, preserveViewport: true,
            polylineOptions: {
              strokeColor: color, strokeOpacity: 0.85, strokeWeight: 4,
              icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: color }, offset: '50%', repeat: '150px' }]
            }
          });
          this.activeLoadPolylines.push(renderer);
        } else {
          const polyline = new google.maps.Polyline({
            path, geodesic: true, strokeColor: color, strokeOpacity: 0.6, strokeWeight: 3, map: this.map,
            icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '15px' }]
          });
          this.activeLoadPolylines.push(polyline);
        }
      });

      (route.waypoints || []).forEach((w: any, i: number) => {
        const isStart = i === 0;
        const isEnd = i === (route.waypoints.length - 1);
        const fill = isStart ? '#22c55e' : isEnd ? '#ef4444' : color;
        const marker = new google.maps.Marker({
          position: { lat: w.lat, lng: w.lng }, map: this.map,
          icon: { path: google.maps.SymbolPath.CIRCLE, scale: isStart || isEnd ? 8 : 5, fillColor: fill, fillOpacity: 0.9, strokeColor: '#ffffff', strokeWeight: 2 },
          title: `${route.loadNumber} — ${w.label}`, zIndex: 500
        });
        const info = new google.maps.InfoWindow();
        marker.addListener('click', () => {
          info.setContent(`<div style="color:#111;min-width:220px;font-family:sans-serif">
            <div style="font-weight:700;font-size:.95rem;margin-bottom:4px;">${route.loadNumber}</div>
            <div style="font-size:.8rem;color:var(--color-text-2);margin-bottom:6px;">${route.customerName || ''}</div>
            <div><strong>${w.type?.toUpperCase() || 'STOP'}</strong>: ${w.label}</div>
            <div style="font-size:.75rem;margin-top:6px;color:var(--color-text-2);">
              Vehicle: ${route.vehicleReg || 'Unassigned'}<br>
              Driver: ${route.driverName || 'Unassigned'}<br>
              Status: ${route.status}</div></div>`);
          info.open(this.map, marker);
        });
        this.activeLoadMarkers.push(marker);
      });
    }
  }

  private clearActiveLoadRoutes(): void {
    this.activeLoadPolylines.forEach(p => p.setMap(null));
    this.activeLoadMarkers.forEach(m => m.setMap(null));
    this.activeLoadPolylines = [];
    this.activeLoadMarkers = [];
  }

  // ---------- customer sites ----------
  toggleCustomers(): void {
    if (this.customersVisible()) { this.clearCustomers(); this.customersVisible.set(false); }
    else { this.loadCustomers(); }
  }

  private loadCustomers(): void {
    // Already fetched once — just re-render.
    if (this.customerPoints().length > 0) {
      this.renderCustomers();
      this.customersVisible.set(true);
      return;
    }
    this.http.get<any[]>(`${this.apiUrl}/logistics/customers/map-points`).subscribe({
      next: (points) => {
        this.customerPoints.set(points || []);
        this.renderCustomers();
        this.customersVisible.set(true);
        this.snack.open(`${(points || []).length} customer sites loaded`, 'Close', { duration: 2500 });
      },
      error: () => this.snack.open('Failed to load customer sites', 'Close', { duration: 3000 })
    });
  }

  /** Loads the Google Maps MarkerClusterer UMD bundle from CDN once. */
  private loadClusterer(): Promise<void> {
    return new Promise((resolve) => {
      if ((window as any).markerClusterer || this.clustererReady) { resolve(); return; }
      const existing = document.getElementById('marker-clusterer-script');
      if (existing) { existing.addEventListener('load', () => resolve()); return; }
      const s = document.createElement('script');
      s.id = 'marker-clusterer-script';
      s.src = 'https://unpkg.com/@googlemaps/markerclusterer/dist/index.min.js';
      s.async = true;
      s.onload = () => { this.clustererReady = true; resolve(); };
      s.onerror = () => resolve(); // fall back to plain markers if CDN unavailable
      document.head.appendChild(s);
    });
  }

  private async renderCustomers(): Promise<void> {
    if (!this.map || typeof google === 'undefined') return;
    this.clearCustomers();
    if (!this.customerInfo) this.customerInfo = new google.maps.InfoWindow();

    const icon = {
      url: this.buildBuildingSvg(),
      scaledSize: new google.maps.Size(30, 36),
      anchor: new google.maps.Point(15, 34)
    };

    for (const c of this.customerPoints()) {
      if (!c.latitude || !c.longitude) continue;
      const marker = new google.maps.Marker({
        position: { lat: c.latitude, lng: c.longitude }, icon, title: c.name
      });
      marker.addListener('click', () => {
        const parts = [c.address, c.city, c.province].filter((p: string) => !!p).join(', ');
        this.customerInfo.setContent(`<div style="color:#111;min-width:200px;font-family:sans-serif">
          <div style="font-weight:700;font-size:.95rem;margin-bottom:3px;">${c.name}</div>
          ${c.customerCode ? `<div style="font-size:.72rem;color:var(--color-text-3);margin-bottom:4px;">${c.customerCode}</div>` : ''}
          <div style="font-size:.8rem;color:var(--color-text-2);">${parts || 'No address'}</div>
          ${c.contactPerson ? `<div style="font-size:.75rem;color:var(--color-text-2);margin-top:5px;">👤 ${c.contactPerson}</div>` : ''}
          ${c.phone ? `<div style="font-size:.75rem;color:var(--color-text-2);">📞 ${c.phone}</div>` : ''}
        </div>`);
        this.customerInfo.open(this.map, marker);
      });
      this.customerMarkers.push(marker);
    }

    // Cluster for performance when there are many sites; fall back to plain markers.
    await this.loadClusterer();
    const MC = (window as any).markerClusterer;
    if (MC && MC.MarkerClusterer) {
      this.customerCluster = new MC.MarkerClusterer({ map: this.map, markers: this.customerMarkers });
    } else {
      this.customerMarkers.forEach(m => m.setMap(this.map));
    }
  }

  private clearCustomers(): void {
    if (this.customerCluster) { this.customerCluster.clearMarkers(); this.customerCluster = null; }
    this.customerMarkers.forEach(m => m.setMap(null));
    this.customerMarkers = [];
  }

  /** Teal building pin (customer site) as an SVG data-URL. */
  private buildBuildingSvg(): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36" viewBox="0 0 30 36">
      <path d="M15 35 C15 35 27 21 27 13 A12 12 0 1 0 3 13 C3 21 15 35 15 35 Z"
            fill="#0ea5e9" stroke="#ffffff" stroke-width="1.5"/>
      <g fill="#ffffff">
        <rect x="8" y="6" width="14" height="12" rx="1"/>
        <rect x="10" y="8.5" width="2.4" height="2.4" fill="#0ea5e9"/>
        <rect x="13.8" y="8.5" width="2.4" height="2.4" fill="#0ea5e9"/>
        <rect x="17.6" y="8.5" width="2.4" height="2.4" fill="#0ea5e9"/>
        <rect x="10" y="12" width="2.4" height="2.4" fill="#0ea5e9"/>
        <rect x="17.6" y="12" width="2.4" height="2.4" fill="#0ea5e9"/>
        <rect x="13.4" y="12" width="3.2" height="6" rx="0.4" fill="#0ea5e9"/>
      </g>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  private darkStyle(): any[] {
    return [
      { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
      { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
      { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
      { featureType: 'poi', stylers: [{ visibility: 'off' }] }
    ];
  }

  private lightStyle(): any[] {
    return [
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] }
    ];
  }
}
