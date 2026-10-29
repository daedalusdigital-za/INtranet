import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiItem, KpiStripComponent } from '../../../ui/kpi-strip/kpi-strip.component';
import { StatusChipComponent } from '../../../ui/status-chip/status-chip.component';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { ToastService } from '../../../ui/toast.service';
import { ConfirmService } from '../../../ui/confirm.service';
import { environment } from '../../../../environments/environment';
import {
  BookingRow, SHIPMENT_STATUS_LABEL, ShipmentCounts, ShipmentDetail, ShipmentService, ShipmentStatus, ShipmentSummary
} from '../../../services/shipment.service';
import { NewBookingDialogComponent } from './new-booking-dialog.component';
import { PlanShipmentsDialogComponent } from './plan-shipments-dialog.component';
import { ShipmentRouteMapComponent } from './shipment-route-map.component';

type Tab = 'queue' | 'unplanned' | 'shipments' | 'exceptions';

/**
 * Client bookings & shipment lifecycle (operations back office).
 * Queue → accept/reject · Unplanned → plan onto a load · Shipments → search, timeline,
 * documents · Exceptions → re-plan / cancel. Status always comes from the server's
 * status engine; this screen never sets it directly.
 */
@Component({
  selector: 'app-client-bookings',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatDialogModule, MatTooltipModule,
    NavbarComponent, EmptyStateComponent, KpiStripComponent, StatusChipComponent, SkeletonRowsComponent, ShipmentRouteMapComponent],
  template: `
    <app-navbar></app-navbar>
    <main class="page">
      <header class="head">
        <div>
          <nav class="crumbs"><a routerLink="/logistics">Logistics</a><span>/</span><span>Client bookings</span></nav>
          <h1>Client bookings &amp; shipments</h1>
          <p class="sub">A booking becomes shipments; shipments are planned onto loads; every scan moves the status.</p>
        </div>
        <div class="actions">
          <button mat-stroked-button (click)="scanLookup()"><mat-icon>qr_code_scanner</mat-icon> Find by code</button>
          <button mat-flat-button color="primary" (click)="newBooking()"><mat-icon>add</mat-icon> New booking</button>
        </div>
      </header>

      <app-kpi-strip [items]="kpis()"></app-kpi-strip>

      <div class="tabs" role="tablist">
        @for (t of tabs; track t.key) {
          <button role="tab" [attr.aria-selected]="tab() === t.key" [class.active]="tab() === t.key" (click)="setTab(t.key)">
            {{ t.label }} @if (t.count() !== null) { <span class="count">{{ t.count() }}</span> }
          </button>
        }
      </div>

      <!-- ============ QUEUE ============ -->
      @if (tab() === 'queue') {
        <section class="card">
          <div class="toolbar">
            <input class="search" type="search" placeholder="Search booking no, reference, client…" [(ngModel)]="bookingSearch" (keyup.enter)="loadBookings()" />
            <select [(ngModel)]="bookingStatus" (change)="loadBookings()">
              <option value="BOOKED">Awaiting acceptance</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="">All</option>
            </select>
          </div>
          @if (loadingBookings()) { <app-skeleton-rows [rows]="5"></app-skeleton-rows> }
          @else if (bookings().length === 0) {
            <app-empty-state icon="inbox" title="No bookings here" message="New client bookings land in this queue, oldest first."></app-empty-state>
          } @else {
            <table class="tbl">
              <thead><tr><th>Booking</th><th>Client</th><th>Reference</th><th>Shipments</th><th>First collection</th><th>Requested by</th><th>Status</th><th>Received</th><th></th></tr></thead>
              <tbody>
                @for (b of bookings(); track b.id) {
                  <tr>
                    <td><a class="link" (click)="openBooking(b.bookingNo)">{{ b.bookingNo }}</a><div class="muted">{{ b.source }}</div></td>
                    <td>{{ b.customerName }}</td>
                    <td>{{ b.clientReference || '—' }}</td>
                    <td>{{ b.shipmentCount }} · {{ b.totalWeightKg | number:'1.0-0' }} kg</td>
                    <td>{{ b.firstCollection | date:'dd MMM' }}</td>
                    <td>{{ b.requestedByName || '—' }}<div class="muted">{{ b.requestedByEmail }}</div></td>
                    <td><app-status-chip [status]="label(b.status)"></app-status-chip>@if (b.rejectionReason) { <div class="muted">{{ b.rejectionReason }}</div> }</td>
                    <td>{{ b.createdAt | date:'dd MMM HH:mm' }}</td>
                    <td class="row-actions">
                      @if (b.status === 'BOOKED') {
                        <button mat-flat-button color="primary" (click)="accept(b)">Accept</button>
                        <button mat-button (click)="reject(b)">Reject</button>
                      } @else {
                        <button mat-button (click)="openBooking(b.bookingNo)">View</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      }

      <!-- ============ UNPLANNED ============ -->
      @if (tab() === 'unplanned') {
        <section class="card">
          <div class="toolbar">
            <label>Collection date <input type="date" [(ngModel)]="unplannedDate" (change)="loadUnplanned()" /></label>
            <span class="spacer"></span>
            <span class="muted">{{ selected().size }} selected</span>
            <button mat-flat-button color="primary" [disabled]="selected().size === 0" (click)="planSelected()"><mat-icon>local_shipping</mat-icon> Plan onto load</button>
          </div>
          @if (loadingUnplanned()) { <app-skeleton-rows [rows]="5"></app-skeleton-rows> }
          @else if (unplanned().length === 0) {
            <app-empty-state icon="route" title="Nothing waiting to be planned" message="Confirmed shipments that are not on a load yet appear here."></app-empty-state>
          } @else {
            <table class="tbl">
              <thead><tr><th><input type="checkbox" [checked]="allSelected()" (change)="toggleAll($any($event.target).checked)" /></th><th>Shipment</th><th>Client</th><th>From</th><th>To</th><th>Collect</th><th>Deliver by</th><th>Cargo</th><th>Handling</th></tr></thead>
              <tbody>
                @for (s of unplanned(); track s.id) {
                  <tr [class.sel]="selected().has(s.id)">
                    <td><input type="checkbox" [checked]="selected().has(s.id)" (change)="toggle(s.id)" /></td>
                    <td><a class="link" (click)="openShipment(s.id)">#{{ s.id }}</a><div class="muted">{{ s.bookingNo }}</div></td>
                    <td>{{ s.customerName }}</td>
                    <td>{{ s.pickup.suburb || s.pickup.city }}<div class="muted">{{ s.pickup.province }}</div></td>
                    <td>{{ s.delivery.suburb || s.delivery.city }}<div class="muted">{{ s.delivery.province }}</div></td>
                    <td>{{ s.collectionDate | date:'dd MMM' }} <span class="muted">{{ s.collectionWindowFrom }}–{{ s.collectionWindowTo }}</span></td>
                    <td>{{ s.requestedDeliveryDate | date:'dd MMM' }}</td>
                    <td>{{ cargo(s) }}</td>
                    <td>{{ handling(s) }}</td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      }

      <!-- ============ SHIPMENTS ============ -->
      @if (tab() === 'shipments') {
        <section class="card">
          <div class="toolbar">
            <input class="search" type="search" placeholder="Waybill, booking, reference, client, suburb…" [(ngModel)]="shipSearch" (keyup.enter)="loadShipments()" />
            <select [(ngModel)]="shipStatus" (change)="loadShipments()">
              <option value="">Active</option>
              @for (st of statuses; track st) { <option [value]="st">{{ label(st) }}</option> }
              <option value="ALL">All</option>
            </select>
            <label>From <input type="date" [(ngModel)]="shipFrom" (change)="loadShipments()" /></label>
            <label>To <input type="date" [(ngModel)]="shipTo" (change)="loadShipments()" /></label>
          </div>
          @if (loadingShipments()) { <app-skeleton-rows [rows]="6"></app-skeleton-rows> }
          @else if (shipments().length === 0) {
            <app-empty-state icon="package_2" title="No shipments match" message="Try a wider date range or another status."></app-empty-state>
          } @else {
            <table class="tbl">
              <thead><tr><th>Waybill</th><th>Client</th><th>Route</th><th>Collect</th><th>Deliver by</th><th>Load</th><th>Cargo</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (s of shipments(); track s.id) {
                  <tr>
                    <td><a class="link" (click)="openShipment(s.id)">{{ s.waybillNo || ('#' + s.id) }}</a><div class="muted">{{ s.bookingNo }}{{ s.clientReference ? ' · ' + s.clientReference : '' }}</div></td>
                    <td>{{ s.customerName }}</td>
                    <td>{{ s.pickup.suburb || s.pickup.city }} → {{ s.delivery.suburb || s.delivery.city }}</td>
                    <td>{{ s.collectionDate | date:'dd MMM' }}</td>
                    <td [class.late]="isLate(s)">{{ s.requestedDeliveryDate | date:'dd MMM' }}</td>
                    <td>{{ s.loadNumber || '—' }}</td>
                    <td>{{ cargo(s) }}</td>
                    <td><app-status-chip [status]="label(s.status)"></app-status-chip>@if (s.damagedFlag || s.shortFlag) { <div class="muted danger">{{ s.damagedFlag ? 'Damaged ' : '' }}{{ s.shortFlag ? 'Short' : '' }}</div> }</td>
                    <td class="row-actions">
                      @if (s.waybillNo) {
                        <button mat-icon-button matTooltip="Waybill PDF" (click)="waybill(s)"><mat-icon>description</mat-icon></button>
                        <button mat-icon-button matTooltip="Labels" (click)="labels(s)"><mat-icon>label</mat-icon></button>
                      }
                      @if (s.status === 'DELIVERED') { <button mat-icon-button matTooltip="POD PDF" (click)="pod(s)"><mat-icon>task</mat-icon></button> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            <div class="pager"><span class="muted">{{ shipTotal() }} shipment(s)</span>
              <button mat-button [disabled]="shipPage() <= 1" (click)="shipPage.set(shipPage() - 1); loadShipments()">Previous</button>
              <button mat-button [disabled]="shipPage() * 50 >= shipTotal()" (click)="shipPage.set(shipPage() + 1); loadShipments()">Next</button></div>
          }
        </section>
      }

      <!-- ============ EXCEPTIONS ============ -->
      @if (tab() === 'exceptions') {
        <section class="card">
          @if (loadingExceptions()) { <app-skeleton-rows [rows]="4"></app-skeleton-rows> }
          @else if (exceptions().length === 0) {
            <app-empty-state icon="verified" title="No open exceptions" message="Failed collections and deliveries logged by drivers show up here."></app-empty-state>
          } @else {
            <table class="tbl">
              <thead><tr><th>Waybill</th><th>Client</th><th>Route</th><th>What happened</th><th>Logged</th><th></th></tr></thead>
              <tbody>
                @for (x of exceptions(); track x.shipment.id) {
                  <tr>
                    <td><a class="link" (click)="openShipment(x.shipment.id)">{{ x.shipment.waybillNo }}</a><div class="muted">{{ x.shipment.bookingNo }}</div></td>
                    <td>{{ x.shipment.customerName }}</td>
                    <td>{{ x.shipment.pickup.suburb || x.shipment.pickup.city }} → {{ x.shipment.delivery.suburb || x.shipment.delivery.city }}</td>
                    <td><app-status-chip [status]="label(x.shipment.status)"></app-status-chip><div>{{ x.exception?.reasonCode }} <span class="muted">{{ x.exception?.note }}</span></div></td>
                    <td>{{ x.exception?.createdAt | date:'dd MMM HH:mm' }}</td>
                    <td class="row-actions">
                      <button mat-flat-button color="primary" (click)="replan(x.shipment)">Re-plan</button>
                      <button mat-button (click)="cancelShipment(x.shipment)">Cancel</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      }
    </main>

    <!-- ============ DETAIL DRAWER ============ -->
    @if (detail(); as d) {
      <div class="scrim" (click)="detail.set(null)"></div>
      <aside class="drawer" role="dialog" aria-labelledby="dr-h">
        <header>
          <div>
            <h2 id="dr-h">{{ d.shipment.waybillNo || ('Shipment #' + d.shipment.id) }}</h2>
            <div class="muted">{{ d.shipment.bookingNo }} · {{ d.shipment.customerName }}{{ d.shipment.clientReference ? ' · ref ' + d.shipment.clientReference : '' }}</div>
          </div>
          <app-status-chip [status]="label(d.shipment.status)"></app-status-chip>
          <button mat-icon-button (click)="detail.set(null)" aria-label="Close"><mat-icon>close</mat-icon></button>
        </header>

        <div class="drawer-actions">
          @if (d.shipment.waybillNo) {
            <button mat-stroked-button (click)="waybill(d.shipment)"><mat-icon>description</mat-icon> Waybill</button>
            <button mat-stroked-button (click)="labels(d.shipment)"><mat-icon>label</mat-icon> Labels</button>
            <button mat-stroked-button (click)="copyTracking(d.shipment)"><mat-icon>link</mat-icon> Tracking link</button>
          }
          @if (d.pod) { <button mat-stroked-button (click)="pod(d.shipment)"><mat-icon>task</mat-icon> POD PDF</button> }
          @if (d.shipment.status === 'CONFIRMED') { <button mat-flat-button color="primary" (click)="planOne(d.shipment)">Plan onto load</button> }
          @if (d.allowedTransitions.includes('CONFIRMED') && d.shipment.status !== 'BOOKED') { <button mat-stroked-button (click)="replan(d.shipment)">Re-plan</button> }
          @if (d.allowedTransitions.includes('IN_TRANSIT') && d.shipment.status === 'COLLECTED') { <button mat-stroked-button (click)="manual(d.shipment, 'IN_TRANSIT')">Mark in transit</button> }
          @if (d.allowedTransitions.includes('CANCELLED')) { <button mat-button class="danger" (click)="cancelShipment(d.shipment)">Cancel</button> }
        </div>

        <section class="grid2">
          <div class="box"><div class="box-t">Collect from</div><div>{{ d.shipment.pickup.oneLine }}</div><div class="muted">{{ d.shipment.pickup.contactName }} · {{ d.shipment.pickup.contactPhone }}</div>
            <div class="muted">{{ d.shipment.collectionDate | date:'EEE dd MMM' }} {{ d.shipment.collectionWindowFrom }}–{{ d.shipment.collectionWindowTo }}</div></div>
          <div class="box"><div class="box-t">Deliver to</div><div>{{ d.shipment.delivery.oneLine }}</div><div class="muted">{{ d.shipment.delivery.contactName }} · {{ d.shipment.delivery.contactPhone }}</div>
            <div class="muted">by {{ d.shipment.requestedDeliveryDate | date:'EEE dd MMM' }}@if (d.shipment.eta) { · ETA {{ d.shipment.eta | date:'HH:mm' }} }</div></div>
        </section>

        <app-shipment-route-map [pickup]="d.shipment.pickup" [delivery]="d.shipment.delivery" [height]="240"></app-shipment-route-map>

        <section class="box">
          <div class="box-t">Cargo · {{ cargo(d.shipment) }} · {{ handling(d.shipment) }}</div>
          <table class="tbl small"><thead><tr><th>Type</th><th>Qty</th><th>Kg</th><th>Dims cm</th><th>Description</th><th>Label</th></tr></thead>
            <tbody>@for (i of d.shipment.items; track i.id) { <tr><td>{{ i.type }}</td><td>{{ i.qty }}</td><td>{{ i.weightKg | number:'1.0-1' }}</td><td>{{ i.lengthCm ? (i.lengthCm + '×' + i.widthCm + '×' + i.heightCm) : '—' }}</td><td>{{ i.description }}</td><td class="mono">{{ i.itemBarcode || '—' }}</td></tr> }</tbody></table>
          @if (d.shipment.specialInstructions) { <p class="muted">{{ d.shipment.specialInstructions }}</p> }
          @if (d.shipment.loadNumber) { <p>On load <b>{{ d.shipment.loadNumber }}</b></p> }
        </section>

        @if (d.pod) {
          <section class="box">
            <div class="box-t">Proof of delivery</div>
            <div>Received by <b>{{ d.pod.receiverName }}</b> at {{ d.pod.deliveredAt | date:'dd MMM HH:mm' }}@if (d.pod.latitude) { · {{ d.pod.latitude | number:'1.4-4' }}, {{ d.pod.longitude | number:'1.4-4' }} }</div>
            @if (d.pod.note) { <div class="muted">{{ d.pod.note }}</div> }
            @if (d.shipment.damagedFlag || d.shipment.shortFlag) { <div class="danger">{{ d.shipment.damagedFlag ? 'Damaged ' : '' }}{{ d.shipment.shortFlag ? 'Short delivered' : '' }}</div> }
          </section>
        }

        <section class="box">
          <div class="box-t">Timeline</div>
          <ol class="timeline">
            @for (e of d.events; track e.id) {
              <li><span class="dot"></span>
                <div><b>{{ label(e.toStatus) }}</b> <span class="muted">{{ e.occurredAt | date:'dd MMM HH:mm' }} · {{ e.source }}{{ e.userName ? ' · ' + e.userName : '' }}</span>
                  @if (e.note) { <div class="muted">{{ e.note }}</div> }</div></li>
            }
          </ol>
        </section>

        @if (d.notifications.length) {
          <section class="box"><div class="box-t">Notifications</div>
            @for (n of d.notifications; track n.createdAt) { <div class="muted">{{ n.channel }} · {{ n.template }} → {{ n.recipient || '(none)' }} · <b>{{ n.status }}</b>{{ n.error ? ' · ' + n.error : '' }}</div> }
          </section>
        }
      </aside>
    }
  `,
  styles: [`
    .page { max-width: 1400px; margin: 0 auto; padding: 20px 24px 60px; display: grid; gap: 16px; }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    .head h1 { margin: 2px 0 4px; font-size: 24px; }
    .sub { margin: 0; color: var(--color-text-2, var(--color-text-2)); }
    .crumbs { font-size: 12px; color: var(--color-text-2, var(--color-text-2)); display: flex; gap: 6px; } .crumbs a { color: inherit; }
    .actions { display: flex; gap: 8px; }
    .tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--color-border, var(--color-line)); }
    .tabs button { background: none; border: 0; border-bottom: 2px solid transparent; padding: 10px 14px; font: inherit; font-weight: 600; color: var(--color-text-2, var(--color-text-2)); cursor: pointer; }
    .tabs button.active { color: var(--color-primary, var(--color-brand)); border-bottom-color: var(--color-primary, #033142); }
    .count { display: inline-block; min-width: 18px; padding: 0 6px; margin-left: 6px; border-radius: 999px; background: var(--color-surface-2, #eef1f4); font-size: 11px; line-height: 18px; }
    .card { background: var(--color-surface, var(--color-surface)); border: 1px solid var(--color-border, var(--color-line)); border-radius: 12px; padding: 12px 16px; }
    .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
    .toolbar .spacer { flex: 1; }
    .toolbar input, .toolbar select { height: 36px; border: 1px solid var(--color-border, #cfd5db); border-radius: 8px; padding: 0 10px; font: inherit; }
    .toolbar .search { min-width: 320px; }
    .toolbar label { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; color: var(--color-text-2, var(--color-text-2)); }
    .tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .tbl th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em; color: var(--color-text-2, var(--color-text-2)); padding: 8px 8px; border-bottom: 1px solid var(--color-border, var(--color-line)); }
    .tbl td { padding: 9px 8px; border-bottom: 1px solid var(--color-border, #eef1f4); vertical-align: top; }
    .tbl tr.sel td { background: var(--color-primary-soft, #eaf3f8); }
    .tbl.small td, .tbl.small th { padding: 4px 6px; font-size: 12.5px; }
    .muted { color: var(--color-text-2, var(--color-text-2)); font-size: 12px; }
    .danger { color: var(--color-danger, #b3261e); }
    .late { color: var(--color-danger, #b3261e); font-weight: 600; }
    .link { color: var(--color-primary, var(--color-brand)); font-weight: 600; cursor: pointer; text-decoration: none; }
    .row-actions { white-space: nowrap; text-align: right; }
    .pager { display: flex; justify-content: flex-end; align-items: center; gap: 8px; padding-top: 8px; }
    .mono { font-family: ui-monospace, monospace; font-size: 12px; }
    .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 1000; }
    .drawer { position: fixed; top: 0; right: 0; bottom: 0; width: min(760px, 96vw); background: var(--color-surface, var(--color-surface)); z-index: 1001; overflow: auto; padding: 18px 22px 40px; box-shadow: -8px 0 30px rgba(0,0,0,.15); display: grid; gap: 12px; align-content: start; }
    .drawer header { display: flex; align-items: center; gap: 12px; } .drawer header > div:first-child { flex: 1; } .drawer h2 { margin: 0; font-size: 20px; }
    .drawer-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .box { border: 1px solid var(--color-border, var(--color-line)); border-radius: 10px; padding: 10px 12px; }
    .box-t { font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-2, var(--color-text-2)); margin-bottom: 6px; }
    .timeline { list-style: none; margin: 0; padding: 0 0 0 6px; border-left: 2px solid var(--color-border, var(--color-line)); display: grid; gap: 10px; }
    .timeline li { position: relative; padding-left: 14px; } .timeline .dot { position: absolute; left: -7px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: var(--color-primary, #033142); }
    @media (max-width: 720px) { .grid2 { grid-template-columns: 1fr; } .toolbar .search { min-width: 0; width: 100%; } }
  `]
})
export class ClientBookingsComponent implements OnInit {
  private svc = inject(ShipmentService);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly statuses: ShipmentStatus[] = ['BOOKED', 'CONFIRMED', 'PLANNED', 'WAYBILL_ISSUED', 'COLLECTED', 'IN_TRANSIT', 'ARRIVING', 'DELIVERED', 'COLLECTION_FAILED', 'DELIVERY_FAILED', 'REJECTED', 'CANCELLED'];

  tab = signal<Tab>('queue');
  counts = signal<ShipmentCounts | null>(null);
  tabs: { key: Tab; label: string; count: () => number | null }[] = [
    { key: 'queue', label: 'Booking queue', count: () => this.counts()?.bookingQueue ?? null },
    { key: 'unplanned', label: 'Unplanned', count: () => this.counts()?.unplanned ?? null },
    { key: 'shipments', label: 'Shipments', count: () => null },
    { key: 'exceptions', label: 'Exceptions', count: () => this.counts()?.exceptions ?? null },
  ];

  bookings = signal<BookingRow[]>([]); loadingBookings = signal(false); bookingSearch = ''; bookingStatus = 'BOOKED';
  unplanned = signal<ShipmentSummary[]>([]); loadingUnplanned = signal(false); unplannedDate = ''; selected = signal(new Set<number>());
  shipments = signal<ShipmentSummary[]>([]); loadingShipments = signal(false); shipSearch = ''; shipStatus = ''; shipFrom = ''; shipTo = ''; shipPage = signal(1); shipTotal = signal(0);
  exceptions = signal<{ shipment: ShipmentSummary; exception: any }[]>([]); loadingExceptions = signal(false);
  detail = signal<ShipmentDetail | null>(null);

  kpis = computed<KpiItem[]>(() => {
    const c = this.counts();
    return [
      { label: 'Awaiting acceptance', value: c?.bookingQueue ?? null, tone: c && c.bookingQueue > 0 ? 'warn' : 'default' },
      { label: 'Unplanned', value: c?.unplanned ?? null, tone: c && c.unplanned > 0 ? 'warn' : 'default' },
      { label: 'On the road', value: c?.onTheRoad ?? null },
      { label: 'Due today', value: c?.dueToday ?? null },
      { label: 'Delivered today', value: c?.deliveredToday ?? null, tone: 'ok' },
      { label: 'Open exceptions', value: c?.exceptions ?? null, tone: c && c.exceptions > 0 ? 'danger' : 'default' },
    ];
  });
  allSelected = computed(() => this.unplanned().length > 0 && this.unplanned().every(s => this.selected().has(s.id)));

  ngOnInit(): void {
    const t = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (t) this.tab.set(t);
    const id = this.route.snapshot.queryParamMap.get('shipment');
    if (id) this.openShipment(+id);
    this.refreshCounts();
    this.loadTab();
  }

  label(s: string) { return SHIPMENT_STATUS_LABEL[s as ShipmentStatus] ?? s; }
  cargo(s: ShipmentSummary) { return `${s.totalPallets ? s.totalPallets + ' plt ' : ''}${s.totalParcels ? s.totalParcels + ' pcs ' : ''}· ${Math.round(s.totalWeightKg)} kg`; }
  handling(s: ShipmentSummary) { return [s.fragile ? 'Fragile' : '', s.hazardous ? 'Haz ' + (s.hazardClass ?? '') : '', s.temperatureRange ? 'Temp ' + s.temperatureRange : ''].filter(Boolean).join(' · ') || '—'; }
  isLate(s: ShipmentSummary) { return !['DELIVERED', 'CANCELLED', 'REJECTED'].includes(s.status) && new Date(s.requestedDeliveryDate) < new Date(new Date().toDateString()); }

  setTab(t: Tab) { this.tab.set(t); this.router.navigate([], { queryParams: { tab: t }, queryParamsHandling: 'merge', replaceUrl: true }); this.loadTab(); }
  private loadTab() {
    switch (this.tab()) {
      case 'queue': return this.loadBookings();
      case 'unplanned': return this.loadUnplanned();
      case 'shipments': return this.loadShipments();
      case 'exceptions': return this.loadExceptions();
    }
  }
  refreshCounts() { this.svc.counts().subscribe({ next: c => this.counts.set(c), error: () => {} }); }

  loadBookings() {
    this.loadingBookings.set(true);
    this.svc.listBookings({ status: this.bookingStatus || undefined, search: this.bookingSearch || undefined, pageSize: 100 })
      .subscribe({ next: r => { this.bookings.set(r.items); this.loadingBookings.set(false); }, error: e => { this.loadingBookings.set(false); this.toast.error(this.err(e, 'Could not load bookings')); } });
  }
  loadUnplanned() {
    this.loadingUnplanned.set(true); this.selected.set(new Set());
    this.svc.unplanned({ collectionDate: this.unplannedDate || undefined })
      .subscribe({ next: r => { this.unplanned.set(r); this.loadingUnplanned.set(false); }, error: e => { this.loadingUnplanned.set(false); this.toast.error(this.err(e, 'Could not load unplanned shipments')); } });
  }
  loadShipments() {
    this.loadingShipments.set(true);
    const q: any = { search: this.shipSearch || undefined, from: this.shipFrom || undefined, to: this.shipTo || undefined, page: this.shipPage(), pageSize: 50 };
    if (this.shipStatus === '') q.active = true; else if (this.shipStatus !== 'ALL') q.status = this.shipStatus;
    this.svc.list(q).subscribe({ next: r => { this.shipments.set(r.items); this.shipTotal.set(r.total); this.loadingShipments.set(false); }, error: e => { this.loadingShipments.set(false); this.toast.error(this.err(e, 'Could not load shipments')); } });
  }
  loadExceptions() {
    this.loadingExceptions.set(true);
    this.svc.exceptions().subscribe({ next: r => { this.exceptions.set(r); this.loadingExceptions.set(false); }, error: e => { this.loadingExceptions.set(false); this.toast.error(this.err(e, 'Could not load exceptions')); } });
  }

  // ---- queue actions
  async accept(b: BookingRow) {
    if (!await this.confirm.ask({ title: `Accept ${b.bookingNo}?`, message: `${b.shipmentCount} shipment(s) move to Confirmed and the client is emailed.`, confirmText: 'Accept booking' })) return;
    this.svc.acceptBooking(b.bookingNo).subscribe({ next: () => { this.toast.done(`${b.bookingNo} accepted`); this.loadBookings(); this.refreshCounts(); }, error: e => this.toast.error(this.err(e, 'Could not accept')) });
  }
  reject(b: BookingRow) {
    const reason = window.prompt(`Reason for rejecting ${b.bookingNo} (sent to the client):`);
    if (!reason?.trim()) return;
    this.svc.rejectBooking(b.bookingNo, reason.trim()).subscribe({ next: () => { this.toast.done(`${b.bookingNo} rejected`); this.loadBookings(); this.refreshCounts(); }, error: e => this.toast.error(this.err(e, 'Could not reject')) });
  }
  openBooking(no: string) {
    this.svc.getBooking(no).subscribe({ next: b => { if (b.shipments?.length) this.openShipment(b.shipments[0].id); }, error: e => this.toast.error(this.err(e, 'Could not open booking')) });
  }
  newBooking() {
    this.dialog.open(NewBookingDialogComponent, { width: '980px', maxWidth: '98vw', maxHeight: '94vh', autoFocus: false })
      .afterClosed().subscribe(res => { if (res?.bookingNo) { this.toast.done(`Booking ${res.bookingNo} created`); this.setTab('queue'); this.refreshCounts(); } });
  }

  // ---- planning
  toggle(id: number) { const s = new Set(this.selected()); s.has(id) ? s.delete(id) : s.add(id); this.selected.set(s); }
  toggleAll(on: boolean) { this.selected.set(on ? new Set(this.unplanned().map(s => s.id)) : new Set()); }
  planSelected() { this.plan(this.unplanned().filter(s => this.selected().has(s.id))); }
  planOne(s: ShipmentSummary) { this.plan([s]); }
  private plan(list: ShipmentSummary[]) {
    this.dialog.open(PlanShipmentsDialogComponent, { width: '720px', maxWidth: '96vw', data: { shipments: list } })
      .afterClosed().subscribe(res => {
        if (!res) return;
        this.toast.done(`${list.length} shipment(s) planned onto ${res.loadNumber}; waybills issued`);
        if (res.warnings?.length) this.toast.warn(res.warnings.join(' '));
        this.detail.set(null); this.loadTab(); this.refreshCounts();
      });
  }

  // ---- shipment actions
  openShipment(id: number) {
    this.svc.get(id).subscribe({ next: d => this.detail.set(d), error: e => this.toast.error(this.err(e, 'Could not load shipment')) });
  }
  async replan(s: ShipmentSummary) {
    if (!await this.confirm.ask({ title: `Re-plan ${s.waybillNo || '#' + s.id}?`, message: 'It leaves its current load and goes back to Confirmed so it can be planned for a new attempt.', confirmText: 'Re-plan' })) return;
    this.svc.replan(s.id).subscribe({ next: () => { this.toast.done('Shipment re-planned'); this.after(s.id); }, error: e => this.toast.error(this.err(e, 'Could not re-plan')) });
  }
  async cancelShipment(s: ShipmentSummary) {
    if (!await this.confirm.ask({ title: `Cancel ${s.waybillNo || '#' + s.id}?`, message: 'The client is notified. This cannot be undone.', confirmText: 'Cancel shipment', danger: true })) return;
    this.svc.cancel(s.id).subscribe({ next: () => { this.toast.done('Shipment cancelled'); this.after(s.id); }, error: e => this.toast.error(this.err(e, 'Could not cancel')) });
  }
  manual(s: ShipmentSummary, to: string) {
    this.svc.transition(s.id, to, 'Set manually by operations').subscribe({ next: () => { this.toast.done(`Marked ${this.label(to)}`); this.after(s.id); }, error: e => this.toast.error(this.err(e, 'Not allowed')) });
  }
  private after(id: number) { this.openShipment(id); this.loadTab(); this.refreshCounts(); }

  waybill(s: ShipmentSummary) { this.svc.waybillPdf(s.waybillNo!).subscribe({ next: b => this.svc.openBlob(b, `${s.waybillNo}.pdf`), error: () => this.toast.error('Could not render waybill') }); }
  labels(s: ShipmentSummary) { this.svc.labelPdf(s.waybillNo!).subscribe({ next: b => this.svc.openBlob(b, `${s.waybillNo}-labels.pdf`), error: () => this.toast.error('Could not render labels') }); }
  pod(s: ShipmentSummary) { this.svc.podPdf(s.id).subscribe({ next: b => this.svc.openBlob(b, `POD-${s.waybillNo}.pdf`), error: () => this.toast.error('No POD captured yet') }); }
  copyTracking(s: ShipmentSummary) {
    const url = `${location.origin}/t/${s.trackingToken}`;
    navigator.clipboard?.writeText(url).then(() => this.toast.done('Tracking link copied'), () => window.prompt('Tracking link', url));
  }
  scanLookup() {
    const code = window.prompt('Scan or type a waybill number, item label, booking number or tracking link:');
    if (!code?.trim()) return;
    this.svc.resolve(code.trim()).subscribe({ next: s => this.openShipment(s.id), error: () => this.toast.error('No shipment matches that code') });
  }

  private err(e: any, fallback: string): string {
    const m = e?.error?.message ?? e?.error?.error ?? (typeof e?.error === 'string' ? e.error : null);
    const list = Array.isArray(e?.error?.errors) ? ' ' + e.error.errors.join(' ') : '';
    return (m ? `${m}${list}` : fallback);
  }
}
