import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, NgZone, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';
import * as XLSX from 'xlsx';

declare const google: any;

interface WatchVehicle {
  vehicleId: string;
  localVehicleId?: number;
  registration: string;
  driver?: string;
  latitude: number;
  longitude: number;
  address?: string;
  speed: number;
  heading: number;
  status: string;      // moving | parked | idling | offline
  isMoving: boolean;
  alert: boolean;
  outsideParking: boolean;
  nearestZone?: string;
  nearestZoneMeters?: number;
  lastUpdate?: string;
}

interface Geofence {
  id: number;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  region?: string;
  color?: string;
  isActive: boolean;
  notes?: string;
}

@Component({
  selector: 'app-controller-monitoring',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatTabsModule, MatTableModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule, MatProgressSpinnerModule, MatTooltipModule,
    MatDatepickerModule, MatNativeDateModule, MatSnackBarModule
  ],
  template: `
  <div class="controller-wrap">

    <!-- ===== Curfew status banner ===== -->
    <div class="curfew-banner" [class.active]="inCurfew()" [class.day]="!inCurfew()">
      <div class="curfew-left">
        <mat-icon>{{ inCurfew() ? 'nightlight' : 'wb_sunny' }}</mat-icon>
        <div>
          <div class="curfew-title">
            {{ inCurfew() ? 'CURFEW ACTIVE — vehicles should be parked off' : 'Daytime — normal operations' }}
          </div>
          <div class="curfew-sub">
            Monitoring window {{ curfewStart }}:00 → {{ curfewEnd }}:00 ·
            Server time {{ serverTimeSast() | date:'EEE dd MMM, HH:mm:ss' }}
          </div>
        </div>
      </div>
      <div class="curfew-right">
        <mat-slide-toggle [(ngModel)]="autoRefresh" (change)="toggleAuto()">Auto-refresh</mat-slide-toggle>
        <button mat-stroked-button (click)="loadNightWatch()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>
    </div>

    <!-- ===== Summary counters ===== -->
    <div class="counter-grid">
      <div class="counter total"><span class="c-val">{{ summary().total }}</span><span class="c-lbl">Total Fleet</span></div>
      <div class="counter alert" [class.pulse]="summary().alerts > 0">
        <span class="c-val">{{ summary().alerts }}</span><span class="c-lbl">Moving Alerts</span>
      </div>
      <div class="counter breach" [class.pulse]="summary().geofenceBreaches > 0">
        <span class="c-val">{{ summary().geofenceBreaches }}</span><span class="c-lbl">Out of Zone</span>
      </div>
      <div class="counter moving"><span class="c-val">{{ summary().moving }}</span><span class="c-lbl">Moving</span></div>
      <div class="counter parked"><span class="c-val">{{ summary().parked }}</span><span class="c-lbl">Parked</span></div>
      <div class="counter idling"><span class="c-val">{{ summary().idling }}</span><span class="c-lbl">Idling</span></div>
      <div class="counter offline"><span class="c-val">{{ summary().offline }}</span><span class="c-lbl">Offline</span></div>
    </div>

    <mat-tab-group class="ctrl-tabs" animationDuration="200ms">

      <!-- ============ LIVE MAP ============ -->
      <mat-tab>
        <ng-template mat-tab-label><mat-icon>map</mat-icon>&nbsp;Live Map</ng-template>
        <div class="live-layout">
          <!-- vehicle list -->
          <div class="veh-list">
            <div class="veh-search">
              <mat-icon>search</mat-icon>
              <input [(ngModel)]="filter" placeholder="Search reg / driver..." />
            </div>
            <div class="veh-filter-chips">
              <button [class.on]="statusFilter()==='all'" (click)="statusFilter.set('all')">All</button>
              <button class="red" [class.on]="statusFilter()==='alert'" (click)="statusFilter.set('alert')">Alerts</button>
              <button class="grn" [class.on]="statusFilter()==='parked'" (click)="statusFilter.set('parked')">Parked</button>
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
                    @if (v.outsideParking && v.nearestZone) {
                      <div class="veh-zone">{{ v.nearestZoneMeters }}m from {{ v.nearestZone }}</div>
                    }
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
            <div #mapEl class="ctrl-map"></div>
            <div class="map-toolbar">
              <button mat-stroked-button (click)="toggleFuelingPoints()" matTooltip="Show/hide TFN petrol stations">
                <mat-icon>local_gas_station</mat-icon> Fuel Stations
              </button>
              <button mat-stroked-button (click)="toggleActiveLoads()" matTooltip="Show/hide routes for active loads">
                <mat-icon>alt_route</mat-icon> {{ activeLoadsVisible() ? 'Hide' : 'Load' }} Active Loads
                @if (activeLoadRoutes().length > 0 && activeLoadsVisible()) {
                  <span style="margin-left:4px;color:#60a5fa;font-weight:700;">({{ activeLoadRoutes().length }})</span>
                }
              </button>
            </div>
            <div class="map-legend">
              <span><i class="lg red"></i> Moving (curfew)</span>
              <span><i class="lg grn"></i> Parked</span>
              <span><i class="lg amb"></i> Idling</span>
              <span><i class="lg gry"></i> Offline</span>
              <span><i class="lg blu"></i> Moving (day)</span>
            </div>
          </div>
        </div>
      </mat-tab>

      <!-- ============ ARCHIVE ============ -->
      <mat-tab>
        <ng-template mat-tab-label><mat-icon>history</mat-icon>&nbsp;Movement History</ng-template>
        <div class="archive-pane">
          <div class="archive-toolbar">
            <mat-form-field appearance="outline" class="af">
              <mat-label>Date</mat-label>
              <input matInput [matDatepicker]="dp" [(ngModel)]="archiveDate">
              <mat-datepicker-toggle matSuffix [for]="dp"></mat-datepicker-toggle>
              <mat-datepicker #dp></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="outline" class="af">
              <mat-label>Registration</mat-label>
              <input matInput [(ngModel)]="archiveReg" placeholder="All vehicles">
            </mat-form-field>
            <mat-slide-toggle [(ngModel)]="archiveCurfewOnly">Curfew only (18:00–05:00)</mat-slide-toggle>
            <button mat-raised-button color="primary" (click)="loadArchive()">
              <mat-icon>search</mat-icon> Load
            </button>
            @if (archiveLoaded() && archiveTotalTrips() > 0) {
              <button mat-stroked-button color="accent" (click)="exportArchiveExcel()" matTooltip="Export all movements to Excel">
                <mat-icon>download</mat-icon> Export Excel
              </button>
            }
          </div>

          @if (archiveLoading()) {
            <div class="veh-loading"><mat-spinner diameter="34"></mat-spinner></div>
          } @else if (archiveLoaded()) {
            <div class="archive-summary">
              <div><strong>{{ archiveTotalTrips() }}</strong> movements ·
                   <strong>{{ archiveVehiclesMoved() }}</strong> vehicles moved
                   @if (archiveCurfewOnly) { during curfew }
              </div>
            </div>

            @if (archiveByVehicle().length > 0) {
              <div class="by-veh-grid">
                @for (b of archiveByVehicle(); track b.registration) {
                  <div class="by-veh-card clickable" (click)="openVehicleTrips(b.registration)" matTooltip="Click to view all trips & export">
                    <div class="bv-reg">{{ b.registration }}</div>
                    <div class="bv-stats">
                      <span>{{ b.trips }} trips</span>
                      <span>{{ b.totalKm }} km</span>
                    </div>
                    <div class="bv-times">{{ b.firstMove }} → {{ b.lastMove }}</div>
                    <div class="bv-cta"><mat-icon>open_in_new</mat-icon> View trips</div>
                  </div>
                }
              </div>

              <table class="hist-table">
                <thead>
                  <tr><th>Reg</th><th>Start</th><th>End</th><th>From</th><th>To</th><th>Dist</th><th>Max</th><th>Harsh</th></tr>
                </thead>
                <tbody>
                  @for (e of archiveEvents(); track e.tripId) {
                    <tr>
                      <td class="mono">{{ e.registration }}</td>
                      <td>{{ e.start }}</td>
                      <td>{{ e.end }}</td>
                      <td class="loc">{{ e.startLocation || '—' }}</td>
                      <td class="loc">{{ e.endLocation || '—' }}</td>
                      <td>{{ e.distanceKm }} km</td>
                      <td>{{ e.maxSpeed }}</td>
                      <td [class.harsh]="e.harshEvents > 0">{{ e.harshEvents }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div class="veh-empty">No movements recorded for this window 🎉</div>
            }
          } @else {
            <div class="veh-empty">Pick a date and press Load to review overnight vehicle movement.</div>
          }
        </div>
      </mat-tab>

      <!-- ============ GEOFENCES ============ -->
      <mat-tab>
        <ng-template mat-tab-label><mat-icon>fence</mat-icon>&nbsp;Geofences</ng-template>
        <div class="geo-pane">
          <div class="geo-toolbar">
            <p class="geo-hint">Define parking / depot zones. During curfew, vehicles outside all parking zones are flagged. Click the map to drop a new zone.</p>
            <button mat-raised-button color="primary" (click)="startAddZone()">
              <mat-icon>add_location_alt</mat-icon> Add Zone
            </button>
          </div>
          <div class="geo-layout">
            <div class="geo-list">
              @for (z of geofences(); track z.id) {
                <div class="geo-item" [class.editing]="draftZone()?.id === z.id" (click)="editZone(z)">
                  <div class="geo-swatch" [style.background]="z.color || '#22c55e'"></div>
                  <div class="geo-info">
                    <div class="geo-name">{{ z.name }}</div>
                    <div class="geo-meta">{{ z.type }} · {{ z.radiusMeters }}m @if (z.region) { · {{ z.region }} }</div>
                  </div>
                  <button mat-icon-button matTooltip="Edit / resize" (click)="editZone(z); $event.stopPropagation()"><mat-icon>edit</mat-icon></button>
                  <button mat-icon-button color="warn" (click)="deleteZone(z, $event)"><mat-icon>delete</mat-icon></button>
                </div>
              }
              @if (geofences().length === 0) {
                <div class="veh-empty">No geofences yet. Add your parking depots.</div>
              }
            </div>
            <div class="map-holder">
              <div #geoMapEl class="ctrl-map"></div>
              @if (addingZone()) {
                <div class="add-hint">Click on the map to place the zone — then drag it or pull the edge to resize…</div>
              }
            </div>
          </div>

          @if (draftZone()) {
            <div class="zone-form">
              <h4>{{ draftZone()!.id ? 'Edit Zone — ' + draftZone()!.name : 'New Zone' }}</h4>
              <div class="zf-row">
                <mat-form-field appearance="outline"><mat-label>Name</mat-label>
                  <input matInput [(ngModel)]="draftZone()!.name"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Type</mat-label>
                  <mat-select [(ngModel)]="draftZone()!.type" (selectionChange)="updateDraftStyle()">
                    <mat-option value="Parking">Parking</mat-option>
                    <mat-option value="Depot">Depot</mat-option>
                    <mat-option value="Restricted">Restricted</mat-option>
                    <mat-option value="Customer">Customer</mat-option>
                  </mat-select></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Radius (m)</mat-label>
                  <input matInput type="number" min="20" step="10" [(ngModel)]="draftZone()!.radiusMeters" (ngModelChange)="updateDraftRadius()"></mat-form-field>
                <mat-form-field appearance="outline"><mat-label>Region</mat-label>
                  <input matInput [(ngModel)]="draftZone()!.region"></mat-form-field>
              </div>
              <div class="zf-slider">
                <span class="zf-slbl">Size</span>
                <input type="range" min="50" max="5000" step="10" [(ngModel)]="draftZone()!.radiusMeters" (ngModelChange)="updateDraftRadius()">
                <span class="zf-sval">{{ draftZone()!.radiusMeters }} m</span>
              </div>
              <div class="zf-actions">
                <span class="zf-coords">{{ draftZone()!.latitude | number:'1.5-5' }}, {{ draftZone()!.longitude | number:'1.5-5' }}</span>
                <button mat-button (click)="cancelDraft()">Cancel</button>
                <button mat-raised-button color="primary" (click)="saveZone()">{{ draftZone()!.id ? 'Update Zone' : 'Save Zone' }}</button>
              </div>
            </div>
          }
        </div>
      </mat-tab>

      <!-- ============ CAMERAS ============ -->
      <mat-tab>
        <ng-template mat-tab-label><mat-icon>videocam</mat-icon>&nbsp;Cameras</ng-template>
        <div class="cam-pane">
          <div class="cam-toolbar">
            <p class="geo-hint">Live camera feeds from CarTrack Vision-equipped vehicles. Requires Vision API license on your CarTrack account.</p>
            <button mat-stroked-button (click)="testVisionApi()">
              <mat-icon>network_check</mat-icon> Test Vision API
            </button>
            <button mat-stroked-button (click)="loadCameraVehicles()">
              <mat-icon>refresh</mat-icon> Reload Vehicles
            </button>
          </div>

          @if (visionStatus()) {
            <div class="vision-status" [class.ok]="visionStatus()!.ok" [class.err]="!visionStatus()!.ok">
              <mat-icon>{{ visionStatus()!.ok ? 'check_circle' : 'error' }}</mat-icon>
              <span>{{ visionStatus()!.message }}</span>
            </div>
          }

          <div class="cam-layout">
            <div class="cam-list">
              @if (cameraVehiclesLoading()) {
                <div class="veh-loading"><mat-spinner diameter="30"></mat-spinner></div>
              } @else if (cameraVehicles().length === 0) {
                <div class="veh-empty">No vehicles available. Click "Reload Vehicles".</div>
              } @else {
                <div class="veh-search">
                  <mat-icon>search</mat-icon>
                  <input placeholder="Search vehicle..." [(ngModel)]="cameraSearch">
                </div>
                @for (v of filteredCameraVehicles(); track v.registration) {
                  <div class="veh-item" [class.sel]="selectedCameraVehicle()?.registration === v.registration"
                       (click)="selectCameraVehicle(v)">
                    <mat-icon style="color:#60a5fa">local_shipping</mat-icon>
                    <div>
                      <div class="veh-reg">{{ v.registration }}</div>
                      <div class="veh-meta">{{ v.vehicleName || 'CarTrack Vehicle' }}</div>
                    </div>
                  </div>
                }
              }
            </div>

            <div class="cam-viewer">
              @if (!selectedCameraVehicle()) {
                <div class="cam-empty">
                  <mat-icon>videocam_off</mat-icon>
                  <p>Select a vehicle to view its cameras</p>
                </div>
              } @else if (livestreamLoading()) {
                <div class="cam-empty">
                  <mat-spinner diameter="40"></mat-spinner>
                  <p>Requesting camera feeds from {{ selectedCameraVehicle()!.registration }}...</p>
                </div>
              } @else if (livestreamError()) {
                <div class="cam-empty error">
                  <mat-icon>error</mat-icon>
                  <p><strong>Unable to load cameras</strong></p>
                  <p style="font-size:.85rem; max-width:500px;">{{ livestreamError() }}</p>
                </div>
              } @else if (activeStreams().length === 0) {
                <div class="cam-empty">
                  <mat-icon>videocam_off</mat-icon>
                  <p>No active cameras for {{ selectedCameraVehicle()!.registration }}</p>
                </div>
              } @else {
                <div class="cam-grid" [attr.data-count]="activeStreams().length">
                  @for (s of activeStreams(); track s.cameraId) {
                    <div class="cam-tile">
                      <div class="cam-tile-header">
                        <mat-icon>videocam</mat-icon>
                        <span>{{ s.cameraName }}</span>
                      </div>
                      @if (s.streamUrl.endsWith('.m3u8') || s.streamUrl.includes('m3u8')) {
                        <video [src]="s.streamUrl" controls autoplay muted playsinline
                               style="width:100%; height:100%; background:#000; border-radius:8px;"></video>
                      } @else if (s.streamUrl.startsWith('rtmp') || s.streamUrl.startsWith('rtsp')) {
                        <div class="cam-stream-info">
                          <mat-icon>info</mat-icon>
                          <p>Stream: <code>{{ s.streamUrl }}</code></p>
                          <p style="font-size:.75rem">RTMP/RTSP streams need an external player (VLC, ffplay)</p>
                          <button mat-stroked-button (click)="copyStreamUrl(s.streamUrl)">
                            <mat-icon>content_copy</mat-icon> Copy URL
                          </button>
                        </div>
                      } @else {
                        <img [src]="s.thumbnailUrl || s.streamUrl" alt="Camera feed"
                             style="width:100%; height:100%; object-fit:cover; background:#000; border-radius:8px;">
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </mat-tab>

    </mat-tab-group>

    <!-- ============ VEHICLE TRIPS DIALOG ============ -->
    @if (tripsDialogReg()) {
      <div class="tv-overlay" (click)="closeVehicleTrips()">
        <div class="tv-dialog" (click)="$event.stopPropagation()">
          <div class="tv-header">
            <div>
              <div class="tv-title"><mat-icon>local_shipping</mat-icon> {{ tripsDialogReg() }}</div>
              <div class="tv-sub">{{ archiveDate | date:'EEE dd MMM yyyy' }} · {{ archiveCurfewOnly ? 'Curfew window (18:00–05:00)' : 'Full day' }}</div>
            </div>
            <button mat-icon-button (click)="closeVehicleTrips()"><mat-icon>close</mat-icon></button>
          </div>

          <div class="tv-summary">
            <div class="tvs-card"><span class="tvs-val">{{ tripsDialogTrips().length }}</span><span class="tvs-lbl">Trips</span></div>
            <div class="tvs-card"><span class="tvs-val">{{ tripsDialogTotalKm() | number:'1.1-1' }}</span><span class="tvs-lbl">Total km</span></div>
            <div class="tvs-card"><span class="tvs-val">{{ tripsDialogMaxSpeed() }}</span><span class="tvs-lbl">Max km/h</span></div>
            <div class="tvs-card"><span class="tvs-val">{{ tripsDialogDriveTime() }}</span><span class="tvs-lbl">Drive time</span></div>
            <div class="tvs-card" [class.warn]="tripsDialogHarsh() > 0"><span class="tvs-val">{{ tripsDialogHarsh() }}</span><span class="tvs-lbl">Harsh events</span></div>
          </div>

          <div class="tv-body">
            <table class="tv-table">
              <thead>
                <tr><th>#</th><th>Departed</th><th>Arrived</th><th>Duration</th><th>From (stop)</th><th>To (stop)</th><th>Distance</th><th>Max</th><th>Harsh</th></tr>
              </thead>
              <tbody>
                @for (t of tripsDialogTrips(); track t.tripId; let i = $index) {
                  <tr>
                    <td>{{ i + 1 }}</td>
                    <td class="mono">{{ t.start }}</td>
                    <td class="mono">{{ t.end }}</td>
                    <td>{{ t.duration || '—' }}</td>
                    <td class="loc">{{ t.startLocation || t.startGeofence || '—' }}</td>
                    <td class="loc">{{ t.endLocation || t.endGeofence || '—' }}</td>
                    <td>{{ t.distanceKm }} km</td>
                    <td>{{ t.maxSpeed }}</td>
                    <td [class.harsh]="t.harshEvents > 0">{{ t.harshEvents }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="tv-footer">
            <button mat-stroked-button (click)="closeVehicleTrips()">Close</button>
            <button mat-raised-button color="accent" (click)="exportVehicleTripsExcel()">
              <mat-icon>download</mat-icon> Export to Excel
            </button>
          </div>
        </div>
      </div>
    }
  </div>
  `,
  styles: [`
    .controller-wrap { padding: 16px; border-radius:16px; background:#0f172a; color:#e2e8f0; }

    /* Curfew banner */
    .curfew-banner { display:flex; justify-content:space-between; align-items:center; gap:16px;
      padding:16px 20px; border-radius:16px; margin-bottom:16px; color:#fff;
      box-shadow:0 8px 24px rgba(0,0,0,.25); }
    .curfew-banner.active { background:linear-gradient(135deg,#3b0764,#1e1b4b 60%,#0f172a); border:1px solid rgba(139,92,246,.4); }
    .curfew-banner.day { background:linear-gradient(135deg,#0e7490,#0369a1 60%,#0f172a); border:1px solid rgba(56,189,248,.3); }
    .curfew-left { display:flex; align-items:center; gap:14px; }
    .curfew-left mat-icon { font-size:34px; height:34px; width:34px; }
    .curfew-title { font-weight:700; font-size:1.05rem; }
    .curfew-sub { font-size:.8rem; opacity:.8; }
    .curfew-right { display:flex; align-items:center; gap:12px; }
    .curfew-right button { color:#fff; border-color:rgba(255,255,255,.4); }

    /* Counters */
    .counter-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:12px; margin-bottom:16px; }
    .counter { background:#1e293b; border:1px solid rgba(148,163,184,.25); border-radius:14px;
      padding:14px; display:flex; flex-direction:column; align-items:center; }
    .counter .c-val { font-size:1.8rem; font-weight:800; line-height:1; }
    .counter .c-lbl { font-size:.72rem; color:#cbd5e1; opacity:.9; margin-top:6px; text-transform:uppercase; letter-spacing:.5px; }
    .counter.total .c-val { color:#e2e8f0; }
    .counter.alert .c-val { color:#f87171; }
    .counter.breach .c-val { color:#fb923c; }
    .counter.moving .c-val { color:#60a5fa; }
    .counter.parked .c-val { color:#4ade80; }
    .counter.idling .c-val { color:#fbbf24; }
    .counter.offline .c-val { color:#94a3b8; }
    .counter.pulse { animation:pulseRed 1.4s infinite; }
    @keyframes pulseRed { 0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,.5);} 50%{box-shadow:0 0 0 8px rgba(248,113,113,0);} }

    @media (max-width:1100px){ .counter-grid{ grid-template-columns:repeat(4,1fr);} }

    /* Live layout */
    .live-layout { display:grid; grid-template-columns:340px 1fr; gap:14px; height:620px; margin-top:12px; }
    .veh-list { background:#0b1220; border:1px solid rgba(148,163,184,.25); border-radius:14px;
      padding:10px; overflow-y:auto; }
    .veh-search { display:flex; align-items:center; gap:8px; background:rgba(30,41,59,.7); border-radius:10px; padding:8px 10px; margin-bottom:8px; }
    .veh-search input { background:transparent; border:none; outline:none; color:#e2e8f0; width:100%; }
    .veh-search mat-icon { color:#94a3b8; }
    .veh-filter-chips { display:flex; gap:6px; margin-bottom:10px; }
    .veh-filter-chips button { flex:1; font-size:.72rem; padding:5px; border-radius:8px; border:1px solid rgba(148,163,184,.2);
      background:rgba(30,41,59,.6); color:#cbd5e1; cursor:pointer; }
    .veh-filter-chips button.on { background:#334155; color:#fff; border-color:#64748b; }
    .veh-filter-chips button.red.on { background:#7f1d1d; border-color:#ef4444; }
    .veh-filter-chips button.grn.on { background:#14532d; border-color:#22c55e; }

    .veh-item { display:flex; gap:10px; align-items:flex-start; padding:10px; border-radius:10px; cursor:pointer;
      border:1px solid transparent; margin-bottom:6px; transition:.15s; }
    .veh-item:hover { background:rgba(51,65,85,.5); }
    .veh-item.sel { background:rgba(51,65,85,.8); border-color:#64748b; }
    .veh-item.alerted { background:rgba(127,29,29,.35); border-color:rgba(248,113,113,.4); }
    .veh-dot { width:12px; height:12px; border-radius:50%; margin-top:4px; flex-shrink:0; }
    .dot-alert { background:#ef4444; box-shadow:0 0 8px #ef4444; }
    .dot-moving { background:#60a5fa; }
    .dot-parked { background:#22c55e; }
    .dot-idling { background:#fbbf24; }
    .dot-offline { background:#6b7280; }
    .veh-reg { font-weight:700; color:#f1f5f9; display:flex; align-items:center; gap:6px; }
    .warn-ic { color:#f87171; font-size:16px; height:16px; width:16px; }
    .veh-meta { font-size:.76rem; color:#cbd5e1; }
    .veh-zone { font-size:.72rem; color:#fb923c; margin-top:2px; }
    .veh-loading { display:flex; justify-content:center; padding:30px; }
    .veh-empty { text-align:center; color:#64748b; padding:30px 10px; font-size:.85rem; }

    .map-holder { position:relative; border-radius:14px; overflow:hidden; border:1px solid rgba(148,163,184,.15); }
    .ctrl-map { width:100%; height:100%; min-height:400px; }
    .live-layout .map-holder { height:620px; }
    .map-legend { position:absolute; bottom:12px; left:12px; background:rgba(15,23,42,.85); border-radius:10px;
      padding:8px 12px; display:flex; gap:14px; flex-wrap:wrap; font-size:.72rem; color:#cbd5e1; }
    .map-legend i.lg { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; }
    .lg.red{background:#ef4444;} .lg.grn{background:#22c55e;} .lg.amb{background:#fbbf24;}
    .lg.gry{background:#6b7280;} .lg.blu{background:#60a5fa;}

    /* Archive */
    .archive-pane { padding:16px 4px; }
    .archive-toolbar { display:flex; gap:14px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
    .archive-toolbar .af { width:180px; }
    .archive-summary { background:#1e293b; border:1px solid rgba(148,163,184,.2); border-radius:10px; padding:12px 16px; margin-bottom:14px; color:#f1f5f9; }
    .by-veh-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:10px; margin-bottom:16px; }
    .by-veh-card { background:#1e293b; border:1px solid rgba(148,163,184,.25); border-radius:12px; padding:12px; }
    .by-veh-card.clickable { cursor:pointer; transition:transform .12s, border-color .12s, box-shadow .12s; }
    .by-veh-card.clickable:hover { transform:translateY(-2px); border-color:rgba(96,165,250,.6); box-shadow:0 6px 18px rgba(0,0,0,.35); }
    .bv-reg { font-weight:700; color:#f1f5f9; }
    .bv-stats { display:flex; gap:12px; font-size:.8rem; color:#60a5fa; margin:4px 0; }
    .bv-times { font-size:.72rem; color:#cbd5e1; }
    .bv-cta { display:flex; align-items:center; gap:4px; font-size:.72rem; color:#818cf8; margin-top:6px; }
    .bv-cta mat-icon { font-size:15px; width:15px; height:15px; }
    .hist-table { width:100%; border-collapse:collapse; font-size:.8rem; background:#0b1220; border-radius:10px; overflow:hidden; }
    .hist-table th { text-align:left; padding:10px 8px; color:#e2e8f0; font-weight:700; background:#1e293b; border-bottom:1px solid rgba(148,163,184,.3); position:sticky; top:0; }
    .hist-table td { padding:9px 8px; border-bottom:1px solid rgba(148,163,184,.12); color:#e2e8f0; }
    .hist-table tbody tr:nth-child(even) td { background:rgba(148,163,184,.05); }
    .hist-table td.mono { font-weight:700; color:#ffffff; }
    .hist-table td.loc { max-width:180px; font-size:.72rem; }
    .hist-table td.harsh { color:#f87171; font-weight:700; }

    /* Geofences */
    .geo-pane { padding:16px 4px; }
    .geo-toolbar { display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:14px; }
    .geo-hint { color:#cbd5e1; font-size:.82rem; margin:0; flex:1; }
    .geo-layout { display:grid; grid-template-columns:320px 1fr; gap:14px; height:480px; }
    .geo-list { background:#0b1220; border:1px solid rgba(148,163,184,.25); border-radius:14px; padding:10px; overflow-y:auto; }
    .geo-item { display:flex; align-items:center; gap:10px; padding:10px; border-radius:10px; cursor:pointer; }
    .geo-item:hover { background:rgba(51,65,85,.5); }
    .geo-swatch { width:14px; height:14px; border-radius:4px; flex-shrink:0; }
    .geo-name { font-weight:600; color:#f1f5f9; }
    .geo-meta { font-size:.74rem; color:#cbd5e1; }
    .geo-layout .map-holder { height:480px; }
    .add-hint { position:absolute; top:12px; left:50%; transform:translateX(-50%); background:#4f46e5; color:#fff;
      padding:8px 16px; border-radius:20px; font-size:.82rem; box-shadow:0 4px 12px rgba(0,0,0,.3); }
    .zone-form { margin-top:14px; background:rgba(15,23,42,.6); border:1px solid rgba(148,163,184,.2); border-radius:14px; padding:16px; }
    .zone-form h4 { margin:0 0 12px; color:#f1f5f9; }
    .zf-row { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    .zf-slider { display:flex; align-items:center; gap:12px; margin:4px 2px 2px; }
    .zf-slider input[type=range] { flex:1; accent-color:#818cf8; height:4px; }
    .zf-slbl { font-size:.78rem; color:#cbd5e1; width:40px; }
    .zf-sval { font-size:.82rem; color:#f1f5f9; font-weight:700; width:70px; text-align:right; }
    .zf-actions { display:flex; align-items:center; gap:12px; margin-top:10px; }
    .zf-coords { font-family:monospace; color:#cbd5e1; flex:1; }
    .geo-item.editing { background:rgba(129,140,248,.18); border:1px solid rgba(129,140,248,.5); }

    /* Vehicle trips dialog */
    .tv-overlay { position:fixed; inset:0; background:rgba(2,6,23,.72); backdrop-filter:blur(3px); z-index:1200; display:flex; align-items:center; justify-content:center; padding:24px; }
    .tv-dialog { width:min(1000px,96vw); max-height:90vh; display:flex; flex-direction:column; background:linear-gradient(160deg,#0f172a,#1e1b4b); border:1px solid rgba(148,163,184,.2); border-radius:18px; box-shadow:0 24px 60px rgba(0,0,0,.5); overflow:hidden; }
    .tv-header { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid rgba(148,163,184,.15); }
    .tv-title { display:flex; align-items:center; gap:10px; font-size:1.3rem; font-weight:700; color:#f1f5f9; }
    .tv-title mat-icon { color:#818cf8; }
    .tv-sub { font-size:.8rem; color:#94a3b8; margin-top:2px; }
    .tv-summary { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; padding:16px 22px; }
    .tvs-card { background:rgba(15,23,42,.6); border:1px solid rgba(148,163,184,.15); border-radius:12px; padding:12px; text-align:center; }
    .tvs-card.warn { border-color:rgba(248,113,113,.5); }
    .tvs-val { display:block; font-size:1.4rem; font-weight:800; color:#f8fafc; }
    .tvs-card.warn .tvs-val { color:#f87171; }
    .tvs-lbl { font-size:.72rem; color:#94a3b8; text-transform:uppercase; letter-spacing:.04em; }
    .tv-body { flex:1; overflow-y:auto; padding:0 22px; }
    .tv-table { width:100%; border-collapse:collapse; font-size:.8rem; }
    .tv-table th { text-align:left; padding:9px 8px; color:#e2e8f0; font-weight:700; border-bottom:1px solid rgba(148,163,184,.3); position:sticky; top:0; background:#1e293b; z-index:1; }
    .tv-table td { padding:9px 8px; border-bottom:1px solid rgba(148,163,184,.12); color:#e2e8f0; }
    .tv-table tbody tr:nth-child(even) td { background:rgba(148,163,184,.05); }
    .tv-table td.mono { font-weight:700; color:#ffffff; font-size:.76rem; }
    .tv-table td.loc { max-width:200px; font-size:.74rem; }
    .tv-table td.harsh { color:#f87171; font-weight:700; }
    .tv-footer { display:flex; justify-content:flex-end; gap:12px; padding:16px 22px; border-top:1px solid rgba(148,163,184,.15); }

    /* Map toolbar */
    .map-toolbar { position:absolute; top:12px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,.9);
      border-radius:10px; padding:8px 12px; display:flex; gap:8px; z-index:100; border:1px solid rgba(148,163,184,.2);
      box-shadow:0 4px 12px rgba(0,0,0,.35); }
    .map-toolbar button { font-size:.8rem; }
    .map-toolbar mat-icon { font-size:18px; width:18px; height:18px; }

    /* Cameras */
    .cam-pane { padding:16px 4px; }
    .cam-toolbar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:14px; }
    .vision-status { display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:10px; margin-bottom:14px; font-size:.85rem; }
    .vision-status.ok { background:rgba(34,197,94,.12); border:1px solid rgba(34,197,94,.4); color:#4ade80; }
    .vision-status.err { background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.4); color:#f87171; }
    .cam-layout { display:grid; grid-template-columns:320px 1fr; gap:14px; height:600px; }
    .cam-list { background:#0b1220; border:1px solid rgba(148,163,184,.25); border-radius:14px; padding:10px; overflow-y:auto; }
    .cam-viewer { background:#0b1220; border:1px solid rgba(148,163,184,.25); border-radius:14px; padding:14px; display:flex; flex-direction:column; }
    .cam-empty { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#94a3b8; gap:10px; text-align:center; }
    .cam-empty mat-icon { font-size:48px; height:48px; width:48px; opacity:.5; }
    .cam-empty.error { color:#f87171; }
    .cam-empty.error mat-icon { color:#ef4444; opacity:.8; }
    .cam-grid { flex:1; display:grid; gap:10px; grid-template-columns:repeat(auto-fit, minmax(360px, 1fr)); }
    .cam-grid[data-count="1"] { grid-template-columns:1fr; }
    .cam-tile { background:#000; border:1px solid rgba(148,163,184,.2); border-radius:10px; overflow:hidden; display:flex; flex-direction:column; min-height:240px; }
    .cam-tile-header { display:flex; align-items:center; gap:6px; padding:8px 12px; background:rgba(15,23,42,.9); color:#e2e8f0; font-size:.82rem; font-weight:600; }
    .cam-tile-header mat-icon { font-size:16px; height:16px; width:16px; color:#60a5fa; }
    .cam-stream-info { padding:16px; color:#cbd5e1; font-size:.82rem; text-align:center; display:flex; flex-direction:column; align-items:center; gap:8px; flex:1; justify-content:center; }
    .cam-stream-info code { background:rgba(148,163,184,.15); padding:4px 8px; border-radius:4px; font-size:.7rem; word-break:break-all; }
  `]
})
export class ControllerMonitoringComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl!: ElementRef;
  @ViewChild('geoMapEl') geoMapEl!: ElementRef;

  private apiUrl = environment.apiUrl;
  private readonly googleKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';

  curfewStart = 18;
  curfewEnd = 5;

  loading = signal(false);
  vehicles = signal<WatchVehicle[]>([]);
  summary = signal<any>({ total: 0, moving: 0, parked: 0, idling: 0, offline: 0, alerts: 0, geofenceBreaches: 0 });
  inCurfew = signal(false);
  serverTimeSast = signal<string | null>(null);
  selected = signal<WatchVehicle | null>(null);

  filter = '';
  statusFilter = signal<'all' | 'alert' | 'parked' | 'offline'>('all');

  autoRefresh = true;
  private refreshTimer: any;
  private mapsReady = false;

  private map: any;
  private markers = new Map<string, any>();
  private speedRings = new Map<string, any>();  // speedometer gauge ring behind each vehicle dot
  private readonly maxSpeedKmh = 120;           // full-scale of the gauge

  // archive
  archiveDate: Date = new Date();
  archiveReg = '';
  archiveCurfewOnly = true;
  archiveLoading = signal(false);
  archiveLoaded = signal(false);
  archiveEvents = signal<any[]>([]);
  archiveByVehicle = signal<any[]>([]);
  archiveTotalTrips = signal(0);
  archiveVehiclesMoved = signal(0);

  // vehicle trips dialog
  tripsDialogReg = signal<string | null>(null);
  tripsDialogTrips = signal<any[]>([]);
  tripsDialogTotalKm = computed(() => this.tripsDialogTrips().reduce((s, t) => s + (t.distanceKm || 0), 0));
  tripsDialogMaxSpeed = computed(() => this.tripsDialogTrips().reduce((m, t) => Math.max(m, t.maxSpeed || 0), 0));
  tripsDialogHarsh = computed(() => this.tripsDialogTrips().reduce((s, t) => s + (t.harshEvents || 0), 0));
  tripsDialogDriveTime = computed(() => {
    const secs = this.tripsDialogTrips().reduce((s, t) => s + (this.durationToSeconds(t.duration)), 0);
    return this.formatSeconds(secs);
  });

  // geofences
  geofences = signal<Geofence[]>([]);
  fuelingPointsVisible = signal(false);
  fuelingPoints = signal<any[]>([]);
  private fuelingPointMarkers: any[] = [];

  // active load routes
  activeLoadsVisible = signal(false);
  activeLoadRoutes = signal<any[]>([]);
  private activeLoadPolylines: any[] = [];
  private activeLoadMarkers: any[] = [];
  private geoMap: any;
  private geoCircles: any[] = [];
  addingZone = signal(false);
  draftZone = signal<Geofence | null>(null);
  private draftCircle: any;

  // cameras
  cameraVehicles = signal<any[]>([]);
  cameraVehiclesLoading = signal(false);
  selectedCameraVehicle = signal<any | null>(null);
  cameraSearch = '';
  livestreamLoading = signal(false);
  livestreamError = signal<string | null>(null);
  activeStreams = signal<any[]>([]);
  visionStatus = signal<{ ok: boolean; message: string } | null>(null);
  filteredCameraVehicles = computed(() => {
    const q = (this.cameraSearch || '').toLowerCase().trim();
    const list = this.cameraVehicles();
    if (!q) return list;
    return list.filter((v: any) => (v.registration || '').toLowerCase().includes(q) || (v.vehicleName || '').toLowerCase().includes(q));
  });

  filteredVehicles = computed(() => {
    const f = this.filter.trim().toLowerCase();
    const sf = this.statusFilter();
    return this.vehicles().filter(v => {
      if (sf === 'alert' && !v.alert) return false;
      if (sf === 'parked' && v.status !== 'parked') return false;
      if (sf === 'offline' && v.status !== 'offline') return false;
      if (!f) return true;
      return v.registration.toLowerCase().includes(f) || (v.driver || '').toLowerCase().includes(f);
    });
  });

  constructor(private http: HttpClient, private zone: NgZone, private snack: MatSnackBar) {}

  ngOnInit(): void {
    this.loadGoogleMaps().then(() => { this.mapsReady = true; this.initMap(); });
    this.loadNightWatch();
    this.loadGeofences();
    this.startAuto();
  }

  ngAfterViewInit(): void {
    if (this.mapsReady) this.initMap();
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
  }

  // ---------- data ----------
  loadNightWatch(): void {
    this.loading.set(true);
    this.http.get<any>(`${this.apiUrl}/logistics/controller/night-watch?curfewStart=${this.curfewStart}&curfewEnd=${this.curfewEnd}`)
      .subscribe({
        next: (res) => {
          this.vehicles.set(res.vehicles || []);
          this.summary.set(res.summary || this.summary());
          this.inCurfew.set(!!res.inCurfew);
          this.serverTimeSast.set(res.serverTimeSast);
          this.loading.set(false);
          this.renderMarkers();
        },
        error: () => { this.loading.set(false); this.snack.open('Failed to load fleet status', 'Close', { duration: 3000 }); }
      });
  }

  loadArchive(): void {
    this.archiveLoading.set(true);
    const d = this.archiveDate ? new Date(this.archiveDate) : new Date();
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let url = `${this.apiUrl}/logistics/controller/movement-history?date=${ds}&curfewOnly=${this.archiveCurfewOnly}`;
    if (this.archiveReg.trim()) url += `&registration=${encodeURIComponent(this.archiveReg.trim())}`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.archiveEvents.set(res.events || []);
        this.archiveByVehicle.set(res.byVehicle || []);
        this.archiveTotalTrips.set(res.totalTrips || 0);
        this.archiveVehiclesMoved.set(res.vehiclesMoved || 0);
        this.archiveLoaded.set(true);
        this.archiveLoading.set(false);
      },
      error: () => { this.archiveLoading.set(false); this.snack.open('Failed to load history', 'Close', { duration: 3000 }); }
    });
  }

  // ---------- vehicle trips dialog & Excel export ----------
  openVehicleTrips(reg: string): void {
    const trips = this.archiveEvents()
      .filter(e => (e.registration || '').toLowerCase() === reg.toLowerCase())
      .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    this.tripsDialogTrips.set(trips);
    this.tripsDialogReg.set(reg);
  }

  closeVehicleTrips(): void {
    this.tripsDialogReg.set(null);
    this.tripsDialogTrips.set([]);
  }

  private durationToSeconds(dur: string | null | undefined): number {
    if (!dur) return 0;
    const parts = dur.split(':').map(p => parseInt(p, 10));
    if (parts.some(isNaN)) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  private formatSeconds(secs: number): string {
    if (!secs) return '0m';
    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  private dateStr(): string {
    const d = this.archiveDate ? new Date(this.archiveDate) : new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  exportVehicleTripsExcel(): void {
    const reg = this.tripsDialogReg();
    if (!reg) return;
    const rows = this.tripsDialogTrips().map((t, i) => ({
      '#': i + 1,
      Departed: t.start,
      Arrived: t.end,
      Duration: t.duration || '',
      'From (stop)': t.startLocation || t.startGeofence || '',
      'To (stop)': t.endLocation || t.endGeofence || '',
      'Distance (km)': t.distanceKm,
      'Max Speed (km/h)': t.maxSpeed,
      'Harsh Events': t.harshEvents
    }));
    // Totals row
    rows.push({
      '#': '' as any, Departed: '', Arrived: '', Duration: this.tripsDialogDriveTime(),
      'From (stop)': '', 'To (stop)': 'TOTAL',
      'Distance (km)': Math.round(this.tripsDialogTotalKm() * 10) / 10,
      'Max Speed (km/h)': this.tripsDialogMaxSpeed(),
      'Harsh Events': this.tripsDialogHarsh()
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reg.substring(0, 28));
    XLSX.writeFile(wb, `Trips_${reg}_${this.dateStr()}.xlsx`);
    this.snack.open('Exported to Excel', 'Close', { duration: 2500 });
  }

  exportArchiveExcel(): void {
    const events = this.archiveEvents();
    if (events.length === 0) { this.snack.open('Nothing to export', 'Close', { duration: 2500 }); return; }

    // Sheet 1: all movements
    const detail = events.map((e, i) => ({
      '#': i + 1,
      Registration: e.registration,
      Departed: e.start,
      Arrived: e.end,
      Duration: e.duration || '',
      'From (stop)': e.startLocation || e.startGeofence || '',
      'To (stop)': e.endLocation || e.endGeofence || '',
      'Distance (km)': e.distanceKm,
      'Max Speed (km/h)': e.maxSpeed,
      'Harsh Events': e.harshEvents
    }));
    const wsDetail = XLSX.utils.json_to_sheet(detail);
    wsDetail['!cols'] = [{ wch: 4 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 30 }, { wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 12 }];

    // Sheet 2: per-vehicle summary
    const summary = this.archiveByVehicle().map(b => ({
      Registration: b.registration,
      Trips: b.trips,
      'Total km': b.totalKm,
      'First Move': b.firstMove,
      'Last Move': b.lastMove
    }));
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    wsSummary['!cols'] = [{ wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 22 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
    XLSX.utils.book_append_sheet(wb, wsDetail, 'All Movements');
    const window = this.archiveCurfewOnly ? 'Curfew' : 'FullDay';
    XLSX.writeFile(wb, `MovementHistory_${this.dateStr()}_${window}.xlsx`);
    this.snack.open('Exported to Excel', 'Close', { duration: 2500 });
  }

  loadGeofences(): void {
    this.http.get<Geofence[]>(`${this.apiUrl}/logistics/controller/geofences`).subscribe({
      next: (z) => { this.geofences.set(z || []); this.renderGeoCircles(); },
      error: () => {}
    });
  }

  // ---------- auto refresh ----------
  startAuto(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.autoRefresh) this.refreshTimer = setInterval(() => this.loadNightWatch(), 30000);
  }
  toggleAuto(): void { this.startAuto(); }

  // ---------- maps ----------
  private loadGoogleMaps(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof google !== 'undefined' && google.maps) { resolve(); return; }
      const existing = document.getElementById('google-maps-script');
      if (existing) { existing.addEventListener('load', () => resolve()); return; }
      const s = document.createElement('script');
      s.id = 'google-maps-script';
      s.src = `https://maps.googleapis.com/maps/api/js?key=${this.googleKey}&libraries=geometry`;
      s.async = true; s.defer = true;
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  }

  private initMap(): void {
    if (!this.mapEl || this.map) return;
    const center = { lat: -26.2041, lng: 28.0473 }; // Johannesburg
    const dark = this.darkStyle();
    this.map = new google.maps.Map(this.mapEl.nativeElement, {
      center, zoom: 6, styles: dark, mapTypeControl: false, streetViewControl: false, fullscreenControl: true
    });
    this.renderMarkers();

    if (this.geoMapEl) {
      this.geoMap = new google.maps.Map(this.geoMapEl.nativeElement, {
        center, zoom: 6, styles: dark, mapTypeControl: false, streetViewControl: false
      });
      this.geoMap.addListener('click', (e: any) => this.onGeoMapClick(e));
      this.renderGeoCircles();
    }
  }

  private markerColor(v: WatchVehicle): string {
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

      // ----- speedometer gauge ring (drawn beneath the dot) -----
      const pos = { lat: v.latitude, lng: v.longitude };
      const ringIcon = {
        url: this.buildSpeedRingSvg(v),
        scaledSize: new google.maps.Size(46, 46),
        anchor: new google.maps.Point(23, 23)
      };
      let ring = this.speedRings.get(v.vehicleId);
      if (ring) {
        ring.setPosition(pos);
        ring.setIcon(ringIcon);
      } else {
        ring = new google.maps.Marker({
          position: pos, map: this.map, icon: ringIcon,
          clickable: false, zIndex: 1
        });
        this.speedRings.set(v.vehicleId, ring);
      }

      const icon = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: v.alert ? 8 : 6,
        fillColor: color, fillOpacity: 1, strokeColor: '#ffffff', strokeWeight: 2,
        rotation: v.isMoving ? (v.heading || 0) : 0
      };
      let m = this.markers.get(v.vehicleId);
      if (m) {
        m.setPosition({ lat: v.latitude, lng: v.longitude });
        m.setIcon(icon);
      } else {
        m = new google.maps.Marker({
          position: { lat: v.latitude, lng: v.longitude }, map: this.map, icon,
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
    // remove stale
    for (const [id, m] of this.markers) {
      if (!seen.has(id)) { m.setMap(null); this.markers.delete(id); }
    }
    for (const [id, r] of this.speedRings) {
      if (!seen.has(id)) { r.setMap(null); this.speedRings.delete(id); }
    }
  }

  /**
   * Builds a speedometer-style gauge ring as an SVG data-URL. A 270° track
   * (opening at the bottom) sits around the vehicle dot; the coloured arc fills
   * in proportion to speed (green → amber → red), giving an at-a-glance read of
   * how fast each vehicle is going, at any zoom level.
   */
  private buildSpeedRingSvg(v: WatchVehicle): string {
    const size = 46, cx = 23, cy = 23, r = 18;
    const startDeg = 135, sweep = 270;                 // gap at the bottom
    const speed = Math.max(0, v.speed || 0);
    const frac = Math.min(speed / this.maxSpeedKmh, 1);
    const endDeg = startDeg + sweep * frac;

    // Arc colour by speed band (parked/offline vehicles show only the faint track).
    let arcColor = '#22c55e';                          // green  ≤ 40
    if (speed > 80) arcColor = '#ef4444';              // red    > 80
    else if (speed > 40) arcColor = '#f59e0b';         // amber  40–80
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


  focusVehicle(v: WatchVehicle): void {
    this.selected.set(v);
    if (this.map && v.latitude && v.longitude) {
      this.map.panTo({ lat: v.latitude, lng: v.longitude });
      this.map.setZoom(14);
      const m = this.markers.get(v.vehicleId);
      if (m && google.maps.Animation) { m.setAnimation(google.maps.Animation.BOUNCE); setTimeout(() => m.setAnimation(null), 1500); }
    }
  }

  // ---------- geofences ----------
  private renderGeoCircles(): void {
    if (!this.geoMap || typeof google === 'undefined') return;
    this.geoCircles.forEach(c => c.setMap(null));
    this.geoCircles = [];
    for (const z of this.geofences()) {
      const c = new google.maps.Circle({
        map: this.geoMap, center: { lat: +z.latitude, lng: +z.longitude }, radius: z.radiusMeters,
        fillColor: z.color || '#22c55e', fillOpacity: 0.15, strokeColor: z.color || '#22c55e', strokeWeight: 2
      });
      this.geoCircles.push(c);
    }
  }

  startAddZone(): void { this.addingZone.set(true); this.snack.open('Click the map to place the zone', 'Close', { duration: 2500 }); }

  private zoneColor(type: string): string {
    switch (type) {
      case 'Depot': return '#38bdf8';
      case 'Restricted': return '#ef4444';
      case 'Customer': return '#a855f7';
      default: return '#22c55e'; // Parking
    }
  }

  private makeDraftCircle(lat: number, lng: number, radius: number, color: string): void {
    if (this.draftCircle) this.draftCircle.setMap(null);
    this.draftCircle = new google.maps.Circle({
      map: this.geoMap, center: { lat, lng }, radius,
      fillColor: color, fillOpacity: 0.2, strokeColor: color, strokeWeight: 2,
      editable: true, draggable: true
    });
    // Resize edge → update radius
    this.draftCircle.addListener('radius_changed', () => {
      const r = Math.round(this.draftCircle.getRadius());
      this.zone.run(() => { const z = this.draftZone(); if (z) this.draftZone.set({ ...z, radiusMeters: r }); });
    });
    // Drag → update center coordinates
    this.draftCircle.addListener('center_changed', () => {
      const c = this.draftCircle.getCenter();
      this.zone.run(() => { const z = this.draftZone(); if (z) this.draftZone.set({ ...z, latitude: c.lat(), longitude: c.lng() }); });
    });
  }

  private onGeoMapClick(e: any): void {
    if (!this.addingZone()) return;
    const lat = e.latLng.lat(); const lng = e.latLng.lng();
    const color = this.zoneColor('Parking');
    this.zone.run(() => {
      this.draftZone.set({ id: 0, name: '', type: 'Parking', latitude: lat, longitude: lng, radiusMeters: 200, region: '', color, isActive: true });
      this.addingZone.set(false);
    });
    this.makeDraftCircle(lat, lng, 200, color);
    this.geoMap.panTo({ lat, lng }); this.geoMap.setZoom(14);
  }

  /** Update the draft circle radius live from the number input / slider. */
  updateDraftRadius(): void {
    const z = this.draftZone(); if (!z || !this.draftCircle) return;
    const r = Math.max(20, +z.radiusMeters || 0);
    if (Math.round(this.draftCircle.getRadius()) !== r) this.draftCircle.setRadius(r);
  }

  /** Recolor the draft circle when zone type changes. */
  updateDraftStyle(): void {
    const z = this.draftZone(); if (!z) return;
    const color = this.zoneColor(z.type);
    this.zone.run(() => this.draftZone.set({ ...z, color }));
    if (this.draftCircle) { this.draftCircle.setOptions({ fillColor: color, strokeColor: color }); }
  }

  /** Load an existing zone into the editable draft so it can be moved / resized / renamed. */
  editZone(z: Geofence): void {
    this.addingZone.set(false);
    this.draftZone.set({ ...z });
    const lat = +z.latitude, lng = +z.longitude;
    this.makeDraftCircle(lat, lng, z.radiusMeters, z.color || this.zoneColor(z.type));
    if (this.geoMap) { this.geoMap.panTo({ lat, lng }); this.geoMap.setZoom(15); }
  }

  saveZone(): void {
    const z = this.draftZone(); if (!z) return;
    if (!z.name.trim()) { this.snack.open('Enter a zone name', 'Close', { duration: 2500 }); return; }
    const isEdit = !!z.id;
    const req = isEdit
      ? this.http.put<Geofence>(`${this.apiUrl}/logistics/controller/geofences/${z.id}`, z)
      : this.http.post<Geofence>(`${this.apiUrl}/logistics/controller/geofences`, z);
    req.subscribe({
      next: () => {
        this.snack.open(isEdit ? 'Zone updated' : 'Zone saved', 'Close', { duration: 2000 });
        this.cancelDraft(); this.loadGeofences();
      },
      error: () => this.snack.open(isEdit ? 'Failed to update zone' : 'Failed to save zone', 'Close', { duration: 3000 })
    });
  }

  cancelDraft(): void {
    this.draftZone.set(null); this.addingZone.set(false);
    if (this.draftCircle) { this.draftCircle.setMap(null); this.draftCircle = null; }
  }

  deleteZone(z: Geofence, ev: Event): void {
    ev.stopPropagation();
    if (!confirm(`Delete zone "${z.name}"?`)) return;
    this.http.delete(`${this.apiUrl}/logistics/controller/geofences/${z.id}`).subscribe({
      next: () => { this.snack.open('Zone deleted', 'Close', { duration: 2000 }); this.loadGeofences(); },
      error: () => this.snack.open('Failed to delete', 'Close', { duration: 3000 })
    });
  }

  focusZone(z: Geofence): void {
    if (this.geoMap) { this.geoMap.panTo({ lat: +z.latitude, lng: +z.longitude }); this.geoMap.setZoom(15); }
  }

  toggleFuelingPoints(): void {
    if (this.fuelingPointsVisible()) {
      this.clearFuelingPoints();
      this.fuelingPointsVisible.set(false);
    } else {
      this.loadFuelingPoints();
    }
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
        icon: {
          url: this.buildFuelPumpSvg(),
          scaledSize: new google.maps.Size(28, 34),
          anchor: new google.maps.Point(14, 32)
        },
        title: `${fp.name} (${fp.brand || 'TFN'})`
      });
      const info = new google.maps.InfoWindow();
      marker.addListener('click', () => {
        info.setContent(`<div style="color:#111;min-width:200px">
          <strong>${fp.name}</strong><br>
          Brand: ${fp.brand || 'N/A'}<br>
          Fuel: ${fp.fuelType || 'N/A'}<br>
          ${fp.address}<br>
          ${fp.city}, ${fp.province}</div>`);
        info.open(this.map, marker);
      });
      this.fuelingPointMarkers.push(marker);
    }
  }

  private clearFuelingPoints(): void {
    this.fuelingPointMarkers.forEach(m => m.setMap(null));
    this.fuelingPointMarkers = [];
  }

  /**
   * Builds a fuel-pump map pin as an SVG data-URL — a rounded amber teardrop
   * pin with a white fuel-pump glyph, so stations read clearly instead of the
   * old plain orange dots.
   */
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
    if (this.activeLoadsVisible()) {
      this.clearActiveLoadRoutes();
      this.activeLoadsVisible.set(false);
    } else {
      this.loadActiveLoadRoutes();
    }
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

      // Request road-based directions (origin + destination + intermediate waypoints)
      const origin = path[0];
      const destination = path[path.length - 1];
      const intermediates = path.slice(1, -1).map((p: any) => ({ location: p, stopover: true }));

      directionsService.route({
        origin,
        destination,
        waypoints: intermediates,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false
      }, (result: any, status: any) => {
        if (status === 'OK' && result) {
          const renderer = new google.maps.DirectionsRenderer({
            map: this.map,
            directions: result,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: color,
              strokeOpacity: 0.85,
              strokeWeight: 4,
              icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, strokeColor: color }, offset: '50%', repeat: '150px' }]
            }
          });
          this.activeLoadPolylines.push(renderer);
        } else {
          // Fallback to straight line if Directions API fails (e.g. over query limit)
          console.warn(`Directions request failed for ${route.loadNumber}: ${status}`);
          const polyline = new google.maps.Polyline({
            path, geodesic: true, strokeColor: color, strokeOpacity: 0.6,
            strokeWeight: 3, map: this.map,
            icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '15px' }]
          });
          this.activeLoadPolylines.push(polyline);
        }
      });

      // Waypoint markers
      (route.waypoints || []).forEach((w: any, i: number) => {
        const isStart = i === 0;
        const isEnd = i === (route.waypoints.length - 1);
        const fill = isStart ? '#22c55e' : isEnd ? '#ef4444' : color;
        const marker = new google.maps.Marker({
          position: { lat: w.lat, lng: w.lng },
          map: this.map,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: isStart || isEnd ? 8 : 5,
            fillColor: fill,
            fillOpacity: 0.9,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          title: `${route.loadNumber} — ${w.label}`,
          zIndex: 500
        });
        const info = new google.maps.InfoWindow();
        marker.addListener('click', () => {
          info.setContent(`<div style="color:#111;min-width:220px;font-family:sans-serif">
            <div style="font-weight:700;font-size:.95rem;margin-bottom:4px;">${route.loadNumber}</div>
            <div style="font-size:.8rem;color:#555;margin-bottom:6px;">${route.customerName || ''}</div>
            <div><strong>${w.type?.toUpperCase() || 'STOP'}</strong>: ${w.label}</div>
            <div style="font-size:.75rem;margin-top:6px;color:#666;">
              Vehicle: ${route.vehicleReg || 'Unassigned'}<br>
              Driver: ${route.driverName || 'Unassigned'}<br>
              Status: ${route.status}
            </div></div>`);
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

  // ---------- cameras ----------
  testVisionApi(): void {
    this.visionStatus.set({ ok: false, message: 'Testing CarTrack Vision API...' });
    this.http.get<any>(`${this.apiUrl}/logistics/controller/test-vision-api`).subscribe({
      next: (r) => {
        const ok = r?.visionApiEnabled === true;
        this.visionStatus.set({ ok, message: r?.message || (ok ? 'Vision API is available' : 'Vision API not available') });
      },
      error: (e) => this.visionStatus.set({ ok: false, message: e?.error?.message || 'Failed to test Vision API' })
    });
  }

  loadCameraVehicles(): void {
    this.cameraVehiclesLoading.set(true);
    this.http.get<any[]>(`${this.apiUrl}/logistics/controller/cameras/vehicles`).subscribe({
      next: (v) => { this.cameraVehicles.set(v || []); this.cameraVehiclesLoading.set(false); },
      error: () => {
        this.cameraVehiclesLoading.set(false);
        this.snack.open('Failed to load camera vehicles', 'Close', { duration: 3000 });
      }
    });
  }

  selectCameraVehicle(v: any): void {
    this.selectedCameraVehicle.set(v);
    this.activeStreams.set([]);
    this.livestreamError.set(null);
    this.livestreamLoading.set(true);
    this.http.post<any>(`${this.apiUrl}/logistics/controller/cameras/livestream/${v.registration}`, { cameras: [1,2,3,4,5,6,7,8] }).subscribe({
      next: (r) => {
        this.livestreamLoading.set(false);
        if (r?.error) {
          this.livestreamError.set(r.error);
        } else {
          this.activeStreams.set(r?.streams || []);
        }
      },
      error: (e) => {
        this.livestreamLoading.set(false);
        this.livestreamError.set(e?.error?.message || 'Failed to fetch camera streams. Vision API may not be enabled on this account.');
      }
    });
  }

  copyStreamUrl(url: string): void {
    navigator.clipboard.writeText(url).then(() => {
      this.snack.open('Stream URL copied', 'Close', { duration: 2000 });
    });
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
}
