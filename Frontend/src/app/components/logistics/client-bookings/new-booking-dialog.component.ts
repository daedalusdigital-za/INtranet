/// <reference types="google.maps" />
import { AfterViewInit, Component, ElementRef, OnDestroy, QueryList, ViewChildren, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ShipmentAddress, ShipmentService } from '../../../services/shipment.service';
import { AddressLookupService, AddressSuggestion, SA_PROVINCES } from '../../../services/address-lookup.service';
import { GoogleMapsLoaderService } from '../../../services/google-maps-loader.service';
import { checkBooking, isoDate } from './booking-rules';

interface AddrForm extends ShipmentAddress {
  addressId?: number | null; saveToAddressBook?: boolean; googlePlaceId?: string | null;
  /** UI state for the search box */ search: string; suggestions: AddressSuggestion[]; searching: boolean; resolved: boolean;
}
interface ItemForm { type: 'parcel' | 'pallet'; qty: number; weightKg: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null; description: string; }
interface ShipForm {
  pickup: AddrForm; delivery: AddrForm; collectionDate: string; collectionWindowFrom: string; collectionWindowTo: string;
  requestedDeliveryDate: string; items: ItemForm[]; fragile: boolean; hazardous: boolean; hazardClass: string; temperatureRange: string; specialInstructions: string;
  route: { distanceKm: number; durationMin: number } | null; routing: boolean;
}

/**
 * Ops-side booking capture, aligned with the Rocket Freight client portal booking form:
 * Google address search (Places New, ZA only), map preview with route distance/time, and the
 * same client-side rules the portal runs before POST /bookings.
 */
@Component({
  selector: 'app-new-booking-dialog',
  standalone: true,
  imports: [FormsModule, DecimalPipe, NgTemplateOutlet, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title>New client booking</h2>
    <mat-dialog-content>
      <section class="block">
        <div class="row">
          <label class="grow">Client
            <input list="clients" [(ngModel)]="clientText" (ngModelChange)="onClientText($event)" placeholder="Start typing a client name…" />
            <datalist id="clients">@for (c of clients(); track c.id) { <option [value]="c.name"></option> }</datalist>
          </label>
          <label>Client reference <input [(ngModel)]="clientReference" maxlength="50" placeholder="PO / order no" /></label>
        </div>
        <div class="row">
          <label>Requested by <input [(ngModel)]="requestedByName" /></label>
          <label>Email <input type="email" [(ngModel)]="requestedByEmail" placeholder="for confirmations" /></label>
          <label>Phone <input [(ngModel)]="requestedByPhone" placeholder="for SMS updates" /></label>
        </div>
      </section>

      @for (s of shipments; track $index; let i = $index) {
        <section class="block ship">
          <div class="ship-h"><b>Shipment {{ i + 1 }}</b>
            @if (s.route) { <span class="route-pill" matTooltip="Driving estimate from Google"><mat-icon>route</mat-icon> {{ s.route.distanceKm | number:'1.0-1' }} km · {{ fmtDur(s.route.durationMin) }}</span> }
            @else if (s.routing) { <span class="route-pill muted">Calculating route…</span> }
            <span class="spacer"></span>
            @if (shipments.length > 1) { <button mat-button (click)="removeShipment(i)"><mat-icon>delete</mat-icon> Remove</button> }
          </div>
          <div class="grid2">
            <div class="addr">
              <div class="addr-h">Collect from
                @if (addresses().length) { <select (change)="useSaved(s, s.pickup, $any($event.target).value)"><option value="">Address book…</option>@for (a of addresses(); track a.id) { <option [value]="a.id">{{ a.label || a.line1 }} — {{ a.suburb || a.city }}</option> }</select> }
              </div>
              <ng-container *ngTemplateOutlet="addrTpl; context: { $implicit: s.pickup, ship: s }"></ng-container>
            </div>
            <div class="addr">
              <div class="addr-h">Deliver to
                @if (addresses().length) { <select (change)="useSaved(s, s.delivery, $any($event.target).value)"><option value="">Address book…</option>@for (a of addresses(); track a.id) { <option [value]="a.id">{{ a.label || a.line1 }} — {{ a.suburb || a.city }}</option> }</select> }
              </div>
              <ng-container *ngTemplateOutlet="addrTpl; context: { $implicit: s.delivery, ship: s }"></ng-container>
            </div>
          </div>

          <div class="map" [attr.data-ship]="i" #mapEl>
            @if (!mapsReady()) { <div class="map-ph"><mat-icon>map</mat-icon> {{ mapsError() || 'Loading map…' }}</div> }
          </div>

          <div class="row">
            <label>Collection date <input type="date" [(ngModel)]="s.collectionDate" [min]="today" /></label>
            <label>Window from <input type="time" [(ngModel)]="s.collectionWindowFrom" /></label>
            <label>to <input type="time" [(ngModel)]="s.collectionWindowTo" /></label>
            <label>Deliver by <input type="date" [(ngModel)]="s.requestedDeliveryDate" [min]="s.collectionDate || today" /></label>
          </div>
          <table class="items">
            <thead><tr><th>Type</th><th>Qty</th><th>Weight kg (each)</th><th>L cm</th><th>W cm</th><th>H cm</th><th>Description</th><th></th></tr></thead>
            <tbody>
              @for (it of s.items; track $index; let j = $index) {
                <tr>
                  <td><select [(ngModel)]="it.type"><option value="parcel">Parcel</option><option value="pallet">Pallet</option></select></td>
                  <td><input type="number" min="1" [(ngModel)]="it.qty" class="n" /></td>
                  <td><input type="number" min="0.1" step="0.1" [(ngModel)]="it.weightKg" class="n" /></td>
                  <td><input type="number" min="1" [(ngModel)]="it.lengthCm" class="n" /></td>
                  <td><input type="number" min="1" [(ngModel)]="it.widthCm" class="n" /></td>
                  <td><input type="number" min="1" [(ngModel)]="it.heightCm" class="n" /></td>
                  <td><input [(ngModel)]="it.description" placeholder="What is it?" /></td>
                  <td><button mat-icon-button (click)="s.items.splice(j, 1)" [disabled]="s.items.length === 1"><mat-icon>close</mat-icon></button></td>
                </tr>
              }
            </tbody>
          </table>
          <div class="row">
            <button mat-button (click)="s.items.push(newItem())"><mat-icon>add</mat-icon> Add line</button>
            <span class="muted">Total {{ weight(s) | number:'1.0-1' }} kg · {{ volume(s) | number:'1.0-2' }} m³</span>
            <span class="spacer"></span>
            <label class="chk"><input type="checkbox" [(ngModel)]="s.fragile" /> Fragile</label>
            <label class="chk"><input type="checkbox" [(ngModel)]="s.hazardous" /> Hazardous</label>
            @if (s.hazardous) { <label>Class <input [(ngModel)]="s.hazardClass" placeholder="e.g. 3" class="n" /></label> }
            <label>Temp <input [(ngModel)]="s.temperatureRange" placeholder="e.g. 2–8°C" class="n" /></label>
          </div>
          <label>Special instructions <input [(ngModel)]="s.specialInstructions" placeholder="Gate code, forklift on site, call ahead…" /></label>
        </section>
      }
      <button mat-stroked-button (click)="addShipment()"><mat-icon>add</mat-icon> Add another shipment</button>

      <label class="notes">Internal notes <input [(ngModel)]="notes" /></label>

      @if (errors().length) {
        <div class="errors"><b>Please fix:</b><ul>@for (e of errors(); track e) { <li>{{ e }}</li> }</ul></div>
      }
      @if (checked() && !errors().length) {
        <div class="ok"><mat-icon>check_circle</mat-icon> Looks good — ready to create.</div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-stroked-button (click)="validate()" [disabled]="busy()">Check</button>
      <button mat-flat-button color="primary" (click)="submit()" [disabled]="busy() || !customerId">Create booking</button>
    </mat-dialog-actions>

    <ng-template #addrTpl let-a let-ship="ship">
      <div class="search">
        <mat-icon class="search-ic">search</mat-icon>
        <input [(ngModel)]="a.search" (ngModelChange)="onSearch(a, $event)" (blur)="onSearchBlur(ship, a)" (keydown.enter)="pickFirst(ship, a); $event.preventDefault()"
               placeholder="Search a South African address (Google)…" autocomplete="off" />
        @if (a.searching) { <span class="spin"></span> }
        @if (a.suggestions.length) {
          <ul class="sugg">
            @for (sg of a.suggestions; track sg.id) {
              <li (mousedown)="pick(ship, a, sg); $event.preventDefault()"><mat-icon>place</mat-icon><div><div>{{ sg.text }}</div>@if (sg.secondary) { <small>{{ sg.secondary }}</small> }</div></li>
            }
          </ul>
        }
      </div>
      <input [(ngModel)]="a.line1" (ngModelChange)="a.resolved = false; a.latitude = null; a.longitude = null; a.googlePlaceId = null" placeholder="Street address" />
      <input [(ngModel)]="a.line2" placeholder="Unit / building (optional)" />
      <div class="row">
        <input [(ngModel)]="a.suburb" placeholder="Suburb" />
        <input [(ngModel)]="a.city" placeholder="City" />
      </div>
      <div class="row">
        <select [(ngModel)]="a.province"><option value="">Province</option>@for (p of provinces; track p) { <option [value]="p">{{ p }}</option> }</select>
        <input [(ngModel)]="a.postalCode" placeholder="Postal code" class="n" />
      </div>
      <div class="row">
        <input [(ngModel)]="a.contactName" placeholder="Contact name" />
        <input [(ngModel)]="a.contactPhone" placeholder="Contact phone" />
      </div>
      <div class="row">
        <label class="chk"><input type="checkbox" [(ngModel)]="a.saveToAddressBook" /> Save to client's address book</label>
        <span class="spacer"></span>
        @if (a.latitude && a.longitude) {
          <span class="pin ok" matTooltip="{{ a.latitude | number:'1.5-5' }}, {{ a.longitude | number:'1.5-5' }}"><mat-icon>location_on</mat-icon> Pinned</span>
        } @else if (a.line1) {
          <button type="button" class="pin-btn" (click)="geocodeTyped(ship, a)" matTooltip="Find this address on the map"><mat-icon>my_location</mat-icon> Locate</button>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    mat-dialog-content { display: grid; gap: 12px; padding-top: 8px !important; }
    .block { border: 1px solid var(--color-border, var(--color-line)); border-radius: 10px; padding: 10px 12px; display: grid; gap: 8px; }
    .ship-h { display: flex; align-items: center; gap: 10px; }
    .spacer { flex: 1; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .row > label, .row > input, .row > select { flex: 1; min-width: 120px; }
    .grow { flex: 2 !important; }
    label { display: grid; gap: 3px; font-size: 12px; color: var(--color-text-2, var(--color-text-2)); }
    label.chk { display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto !important; }
    input, select { height: 34px; border: 1px solid var(--color-border, #cfd5db); border-radius: 7px; padding: 0 8px; font: inherit; font-size: 13.5px; width: 100%; box-sizing: border-box; }
    input.n { width: 90px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .addr { display: grid; gap: 6px; align-content: start; }
    .addr-h { font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-2, var(--color-text-2)); display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .addr-h select { width: auto; height: 28px; font-size: 12px; }
    .search { position: relative; }
    .search input { padding-left: 32px; background: var(--color-surface-2, var(--color-surface-2)); }
    .search-ic { position: absolute; left: 8px; top: 7px; font-size: 20px; width: 20px; height: 20px; color: var(--color-text-2, var(--color-text-3)); }
    .spin { position: absolute; right: 10px; top: 10px; width: 14px; height: 14px; border: 2px solid var(--color-line-strong); border-top-color: var(--color-primary, #1a73e8); border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .sugg { position: absolute; z-index: 20; left: 0; right: 0; top: 36px; margin: 0; padding: 4px 0; list-style: none; background: var(--color-surface, var(--color-surface)); border: 1px solid var(--color-border, var(--color-line)); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.12); max-height: 240px; overflow: auto; }
    .sugg li { display: flex; gap: 8px; align-items: center; padding: 6px 10px; cursor: pointer; font-size: 13px; }
    .sugg li:hover { background: var(--color-surface-2, var(--color-surface-2)); }
    .sugg li mat-icon { font-size: 18px; width: 18px; height: 18px; color: #d93025; }
    .sugg small { color: var(--color-text-2, var(--color-text-2)); }
    .map { height: 220px; border-radius: 10px; overflow: hidden; background: var(--color-surface-3); position: relative; }
    .map-ph { position: absolute; inset: 0; display: grid; place-items: center; color: var(--color-text-3); font-size: 13px; gap: 4px; }
    .route-pill { display: inline-flex; align-items: center; gap: 4px; background: #e8f0fe; color: #1a56c4; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 500; }
    .route-pill mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .pin { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; } .pin.ok { color: #188038; } .pin mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .pin-btn { display: inline-flex; align-items: center; gap: 2px; font-size: 12px; background: none; border: 1px solid var(--color-border, #cfd5db); border-radius: 999px; padding: 2px 10px; cursor: pointer; color: var(--color-primary, #1a73e8); }
    .pin-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .items { width: 100%; border-collapse: collapse; } .items th { font-size: 11px; text-align: left; color: var(--color-text-2, var(--color-text-2)); padding: 2px 4px; } .items td { padding: 2px 4px; }
    .muted { color: var(--color-text-2, var(--color-text-2)); font-size: 12px; }
    .errors { background: var(--color-danger-soft); color: #7a1d16; border-radius: 8px; padding: 8px 12px; font-size: 13px; } .errors ul { margin: 4px 0 0; padding-left: 18px; }
    .ok { display: flex; align-items: center; gap: 6px; background: var(--color-ok-soft); color: #137333; border-radius: 8px; padding: 8px 12px; font-size: 13px; }
    @media (max-width: 720px) { .grid2 { grid-template-columns: 1fr; } }
  `]
})
export class NewBookingDialogComponent implements AfterViewInit, OnDestroy {
  private svc = inject(ShipmentService);
  private lookup = inject(AddressLookupService);
  private mapsLoader = inject(GoogleMapsLoaderService);
  private ref = inject(MatDialogRef<NewBookingDialogComponent>);

  @ViewChildren('mapEl') mapEls!: QueryList<ElementRef<HTMLDivElement>>;

  readonly provinces = SA_PROVINCES;
  readonly today = isoDate(new Date());

  clients = signal<{ id: number; name: string; contactPerson?: string; email?: string; contactEmail?: string; phoneNumber?: string }[]>([]);
  addresses = signal<ShipmentAddress[]>([]);
  errors = signal<string[]>([]);
  checked = signal(false);
  busy = signal(false);
  mapsReady = signal(false);
  mapsError = signal('');

  clientText = ''; customerId: number | null = null;
  clientReference = ''; requestedByName = ''; requestedByEmail = ''; requestedByPhone = ''; notes = '';
  shipments: ShipForm[] = [this.newShipment()];

  private g: typeof google | null = null;
  private maps = new Map<ShipForm, { map: google.maps.Map; pickup?: google.maps.Marker; delivery?: google.maps.Marker; line?: google.maps.Polyline }>();
  private debounce = new Map<AddrForm, any>();

  constructor() { this.svc.clients().subscribe(c => this.clients.set(c)); }

  ngAfterViewInit() {
    this.mapsLoader.load().then(g => { this.g = g; this.mapsReady.set(true); this.syncMaps(); })
      .catch(() => this.mapsError.set('Google Maps is not available — addresses can still be typed.'));
    this.mapEls.changes.subscribe(() => this.syncMaps());
  }
  ngOnDestroy() { this.debounce.forEach(t => clearTimeout(t)); }

  // ─── client ───
  onClientText(text: string) {
    const c = this.clients().find(x => x.name.toLowerCase() === text.trim().toLowerCase());
    this.customerId = c?.id ?? null;
    if (c) {
      this.requestedByName ||= c.contactPerson ?? ''; this.requestedByEmail ||= c.contactEmail ?? c.email ?? ''; this.requestedByPhone ||= c.phoneNumber ?? '';
      this.svc.addresses(c.id).subscribe(a => this.addresses.set(a));
    } else this.addresses.set([]);
  }
  useSaved(ship: ShipForm, target: AddrForm, idStr: string) {
    const a = this.addresses().find(x => String(x.id) === idStr);
    if (!a) return;
    Object.assign(target, a, { addressId: a.id, saveToAddressBook: false, search: '', suggestions: [], resolved: !!(a.latitude && a.longitude) });
    this.afterAddressChange(ship);
  }

  // ─── Google address search (same behaviour as the portal booking form) ───
  onSearch(a: AddrForm, text: string) {
    clearTimeout(this.debounce.get(a));
    if (text.trim().length < 3) { a.suggestions = []; a.searching = false; return; }
    a.searching = true;
    this.debounce.set(a, setTimeout(async () => {
      const res = await this.lookup.suggest(text);
      if (a.search === text) { a.suggestions = res; }
      a.searching = false;
    }, 250));
  }
  onSearchBlur(_ship: ShipForm, a: AddrForm) { setTimeout(() => { a.suggestions = []; }, 150); }
  pickFirst(ship: ShipForm, a: AddrForm) { if (a.suggestions[0]) this.pick(ship, a, a.suggestions[0]); }
  async pick(ship: ShipForm, a: AddrForm, sg: AddressSuggestion) {
    a.suggestions = []; a.searching = true;
    const d = await this.lookup.details(sg.id);
    a.searching = false;
    if (!d) return;
    Object.assign(a, { line1: d.line1 || sg.text, suburb: d.suburb, city: d.city, province: d.province, postalCode: d.postalCode,
      latitude: d.latitude, longitude: d.longitude, googlePlaceId: d.googlePlaceId, addressId: null, resolved: true, search: d.formatted || sg.text });
    this.afterAddressChange(ship);
  }
  /** Typed address without picking a suggestion → geocode through the API so it still gets a pin. */
  async geocodeTyped(ship: ShipForm, a: AddrForm) {
    const text = [a.line1, a.suburb, a.city, a.province, a.postalCode].filter(Boolean).join(', ');
    a.searching = true;
    const d = await this.lookup.geocode(text);
    a.searching = false;
    if (!d) { this.errors.set([`Could not locate "${text}" — check the address or pick it from the search.`]); return; }
    a.latitude = d.latitude; a.longitude = d.longitude; a.googlePlaceId = d.googlePlaceId; a.resolved = true;
    a.suburb ||= d.suburb; a.city ||= d.city; a.province ||= d.province; a.postalCode ||= d.postalCode;
    this.afterAddressChange(ship);
  }

  // ─── map + route ───
  private syncMaps() {
    if (!this.g || !this.mapEls) return;
    this.mapEls.forEach(el => {
      const idx = Number(el.nativeElement.dataset['ship']);
      const ship = this.shipments[idx];
      if (!ship || this.maps.has(ship)) return;
      const map = new this.g!.maps.Map(el.nativeElement, {
        center: { lat: -29.0, lng: 24.5 }, zoom: 5, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative',
      });
      this.maps.set(ship, { map });
      this.drawShipment(ship);
    });
  }
  private afterAddressChange(ship: ShipForm) {
    this.checked.set(false);
    this.drawShipment(ship);
    this.estimateRoute(ship);
  }
  private drawShipment(ship: ShipForm) {
    const m = this.maps.get(ship); if (!m || !this.g) return;
    const g = this.g;
    const put = (key: 'pickup' | 'delivery', a: AddrForm, label: string, color: string) => {
      m[key]?.setMap(null); m[key] = undefined;
      if (!(a.latitude && a.longitude)) return null;
      const pos = { lat: a.latitude, lng: a.longitude };
      m[key] = new g.maps.Marker({ map: m.map, position: pos, title: a.line1 ?? '', label: { text: label, color: '#fff', fontWeight: '700' },
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: 12, fillColor: color, fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 } });
      return pos;
    };
    const p = put('pickup', ship.pickup, 'C', '#1a73e8');
    const d = put('delivery', ship.delivery, 'D', '#d93025');
    m.line?.setMap(null); m.line = undefined;
    const b = new g.maps.LatLngBounds();
    if (p) b.extend(p); if (d) b.extend(d);
    if (p && d) { m.map.fitBounds(b, 40); }
    else if (p || d) { m.map.setCenter((p ?? d)!); m.map.setZoom(14); }
  }
  private async estimateRoute(ship: ShipForm) {
    const p = ship.pickup, d = ship.delivery;
    ship.route = null;
    if (!(p.latitude && p.longitude && d.latitude && d.longitude)) return;
    ship.routing = true;
    const r = await this.lookup.route({ lat: p.latitude, lng: p.longitude }, { lat: d.latitude, lng: d.longitude });
    ship.routing = false;
    if (!r) return;
    ship.route = { distanceKm: r.distanceKm, durationMin: r.durationMin };
    const m = this.maps.get(ship);
    if (m && this.g && r.polyline) {
      m.line?.setMap(null);
      m.line = new this.g.maps.Polyline({ map: m.map, path: r.polyline, strokeColor: '#1a73e8', strokeOpacity: .85, strokeWeight: 4 });
    }
  }
  fmtDur(min: number) { return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`; }

  // ─── form helpers ───
  newItem(): ItemForm { return { type: 'parcel', qty: 1, weightKg: null, lengthCm: null, widthCm: null, heightCm: null, description: '' }; }
  newShipment(): ShipForm {
    const blank = (): AddrForm => ({ line1: '', line2: '', suburb: '', city: '', province: '', postalCode: '', contactName: '', contactPhone: '', latitude: null, longitude: null,
      googlePlaceId: null, addressId: null, saveToAddressBook: false, search: '', suggestions: [], searching: false, resolved: false });
    return { pickup: blank(), delivery: blank(), collectionDate: '', collectionWindowFrom: '08:00', collectionWindowTo: '16:00', requestedDeliveryDate: '',
      items: [this.newItem()], fragile: false, hazardous: false, hazardClass: '', temperatureRange: '', specialInstructions: '', route: null, routing: false };
  }
  addShipment() { this.shipments.push(this.newShipment()); setTimeout(() => this.syncMaps()); }
  removeShipment(i: number) { const s = this.shipments.splice(i, 1)[0]; this.maps.delete(s); setTimeout(() => this.syncMaps()); }
  weight(s: ShipForm) { return s.items.reduce((t, i) => t + (i.qty || 0) * (i.weightKg || 0), 0); }
  volume(s: ShipForm) { return s.items.reduce((t, i) => t + (i.qty || 0) * ((i.lengthCm || 0) * (i.widthCm || 0) * (i.heightCm || 0)) / 1_000_000, 0); }

  private body() {
    const addr = (a: AddrForm) => {
      const { search, suggestions, searching, resolved, ...rest } = a;
      return { ...rest, latitude: a.latitude ?? null, longitude: a.longitude ?? null, googlePlaceId: a.googlePlaceId ?? null };
    };
    return {
      customerId: this.customerId, source: 'ops', clientReference: this.clientReference || null,
      requestedByName: this.requestedByName || null, requestedByEmail: this.requestedByEmail || null, requestedByPhone: this.requestedByPhone || null, notes: this.notes || null,
      shipments: this.shipments.map(s => {
        const { route, routing, ...rest } = s;
        return {
          ...rest, pickup: addr(s.pickup), delivery: addr(s.delivery),
          hazardClass: s.hazardClass || null, temperatureRange: s.temperatureRange || null, specialInstructions: s.specialInstructions || null,
          collectionDate: s.collectionDate || null, requestedDeliveryDate: s.requestedDeliveryDate || null,
          items: s.items.map(i => ({ ...i, weightKg: i.weightKg ?? 0 }))
        };
      })
    };
  }
  /** Same rules the client portal applies before it submits. */
  private localProblems(): string[] {
    return checkBooking({
      customerId: this.customerId, clientReference: this.clientReference, requestedByName: this.requestedByName, requestedByEmail: this.requestedByEmail,
      shipments: this.shipments.map(s => ({ pickup: s.pickup, delivery: s.delivery, collectionDate: s.collectionDate, requestedDeliveryDate: s.requestedDeliveryDate,
        collectionWindowFrom: s.collectionWindowFrom, collectionWindowTo: s.collectionWindowTo, items: s.items, hazardous: s.hazardous, hazardClass: s.hazardClass })),
    }, this.today).map(p => p.message);
  }
  validate() {
    const local = this.localProblems();
    if (local.length) { this.errors.set(local); this.checked.set(true); return; }
    this.busy.set(true);
    this.svc.validateBooking(this.body()).subscribe({
      next: r => { this.busy.set(false); this.checked.set(true); this.errors.set(r.valid ? [] : r.errors); },
      error: e => { this.busy.set(false); this.checked.set(true); this.errors.set(this.extract(e)); }
    });
  }
  submit() {
    const local = this.localProblems();
    if (local.length) { this.errors.set(local); this.checked.set(true); return; }
    this.busy.set(true); this.errors.set([]);
    this.svc.createBooking(this.body()).subscribe({
      next: r => { this.busy.set(false); this.ref.close(r); },
      error: e => { this.busy.set(false); this.errors.set(this.extract(e)); }
    });
  }
  private extract(e: any): string[] {
    if (Array.isArray(e?.error?.errors)) return e.error.errors;
    if (e?.error?.errors && typeof e.error.errors === 'object') return Object.values(e.error.errors).flat() as string[];
    return [e?.error?.message ?? e?.error?.error ?? 'Could not save the booking.'];
  }
}
