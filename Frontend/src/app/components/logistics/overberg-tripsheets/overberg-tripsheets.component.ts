import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiItem, KpiStripComponent } from '../../../ui/kpi-strip/kpi-strip.component';
import { StatusChipComponent } from '../../../ui/status-chip/status-chip.component';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { ToastService } from '../../../ui/toast.service';
import { ConfirmService } from '../../../ui/confirm.service';
import {
  PortalPendingBooking, PortalPendingWaybill, PortalSummary, PortalSupportMessage, PortalSupportThreadRow, PortalTripsheet,
  PortalTripsheetWaybill, PortalUserRow, SHIPMENT_STATUS_LABEL, ShipmentService, ShipmentStatus
} from '../../../services/shipment.service';

type View = 'pending' | 'tripsheets' | 'support' | 'logins';

/**
 * Overberg Tripsheets – the intranet side of the Rocket Freight client portal.
 *  Awaiting confirmation → accept / confirm or decline each waybill a client placed on the portal
 *  Tripsheets           → the loads carrying portal waybills, with their waybills and documents
 *  Support              → reply to client chat messages
 *  Portal logins        → who can sign in to the portal, per customer
 * Status always comes from the server's status engine; this screen never sets it directly.
 */
@Component({
  selector: 'app-overberg-tripsheets',
  standalone: true,
  imports: [DatePipe, DecimalPipe, SlicePipe, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, MatMenuModule,
    EmptyStateComponent, KpiStripComponent, StatusChipComponent, SkeletonRowsComponent],
  template: `
    <div class="ob">
      <app-kpi-strip [items]="kpis()"></app-kpi-strip>

      <div class="tabs" role="tablist">
        @for (t of views; track t.key) {
          <button role="tab" [attr.aria-selected]="view() === t.key" [class.active]="view() === t.key" (click)="setView(t.key)">
            <mat-icon>{{ t.icon }}</mat-icon> {{ t.label }} @if (t.count() !== null && t.count()! > 0) { <span class="count" [class.hot]="t.hot">{{ t.count() }}</span> }
          </button>
        }
        <span class="spacer"></span>
        <button mat-stroked-button (click)="refresh()" matTooltip="Reload"><mat-icon>refresh</mat-icon> Refresh</button>
      </div>

      <!-- ============ AWAITING CONFIRMATION ============ -->
      @if (view() === 'pending') {
        <section class="card">
          <div class="toolbar">
            <input class="search" type="search" placeholder="Booking no, reference or client…" [(ngModel)]="pendingSearch" (keyup.enter)="loadPending()" />
            <button mat-stroked-button (click)="loadPending()"><mat-icon>search</mat-icon> Search</button>
            <span class="spacer"></span>
            <span class="muted">Waybills a client placed on the portal. Confirming moves them to <b>Confirmed</b> and emails the client; they can then be planned onto a tripsheet from Client bookings → Unplanned.</span>
          </div>
          @if (loadingPending()) { <app-skeleton-rows [rows]="4"></app-skeleton-rows> }
          @else if (pending().length === 0) {
            <app-empty-state icon="task_alt" title="Nothing waiting" message="Every waybill placed on the portal has been accepted or declined."></app-empty-state>
          } @else {
            @for (b of pending(); track b.id) {
              <article class="booking">
                <header>
                  <div class="who">
                    <div class="bk">{{ b.bookingNo }} <span class="muted">· {{ b.customerName }}</span></div>
                    <div class="muted">
                      {{ b.clientReference ? 'Ref ' + b.clientReference + ' · ' : '' }}
                      Placed {{ b.createdAt | date:'dd MMM HH:mm' }} by {{ b.requestedByName || '—' }}
                      @if (b.requestedByEmail) { · <a href="mailto:{{ b.requestedByEmail }}">{{ b.requestedByEmail }}</a> }
                      @if (b.requestedByPhone) { · {{ b.requestedByPhone }} }
                    </div>
                    @if (b.notes) { <div class="note"><mat-icon>sticky_note_2</mat-icon> {{ b.notes }}</div> }
                  </div>
                  <div class="actions">
                    <button mat-flat-button color="primary" (click)="confirmAll(b)" [disabled]="busy()"><mat-icon>check_circle</mat-icon> Accept all ({{ openCount(b) }})</button>
                    <button mat-button (click)="rejectAll(b)" [disabled]="busy()">Decline all</button>
                  </div>
                </header>
                <table class="tbl">
                  <thead><tr><th>Waybill</th><th>From</th><th>To</th><th>Collect</th><th>Deliver by</th><th>Cargo</th><th>Handling</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    @for (w of b.waybills; track w.id) {
                      <tr [class.done]="w.status !== 'BOOKED'">
                        <td><span class="mono">#{{ w.id }}</span>
                          @if (w.specialInstructions) { <div class="muted" [matTooltip]="w.specialInstructions">“{{ w.specialInstructions | slice:0:60 }}{{ w.specialInstructions.length > 60 ? '…' : '' }}”</div> }
                        </td>
                        <td>{{ place(w.pickup) }}<div class="muted">{{ w.pickup.contactName }} {{ w.pickup.contactPhone }}</div></td>
                        <td>{{ place(w.delivery) }}<div class="muted">{{ w.delivery.contactName }} {{ w.delivery.contactPhone }}</div></td>
                        <td>{{ w.collectionDate | date:'EEE dd MMM' }}<div class="muted">{{ w.collectionWindowFrom }}@if (w.collectionWindowTo) {–{{ w.collectionWindowTo }}}</div></td>
                        <td [class.late]="isSoon(w.requestedDeliveryDate)">{{ w.requestedDeliveryDate | date:'EEE dd MMM' }}</td>
                        <td>{{ cargo(w) }}<div class="muted">{{ itemsText(w) }}</div></td>
                        <td>{{ handling(w) }}</td>
                        <td><app-status-chip [status]="label(w.status)"></app-status-chip></td>
                        <td class="row-actions">
                          @if (w.status === 'BOOKED') {
                            <button mat-flat-button color="primary" (click)="confirmOne(b, w)" [disabled]="busy()">Accept</button>
                            <button mat-button (click)="rejectOne(b, w)" [disabled]="busy()">Decline</button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </article>
            }
          }
        </section>
      }

      <!-- ============ TRIPSHEETS ============ -->
      @if (view() === 'tripsheets') {
        <section class="card">
          <div class="toolbar">
            <input class="search" type="search" placeholder="Tripsheet, waybill, booking, reference or client…" [(ngModel)]="tsSearch" (keyup.enter)="loadTripsheets()" />
            <select [(ngModel)]="tsStatus" (change)="loadTripsheets()">
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="all">All</option>
            </select>
            <label>From <input type="date" [(ngModel)]="tsFrom" (change)="loadTripsheets()" /></label>
            <label>To <input type="date" [(ngModel)]="tsTo" (change)="loadTripsheets()" /></label>
            <button mat-stroked-button (click)="loadTripsheets()"><mat-icon>search</mat-icon> Search</button>
            <span class="spacer"></span>
            <span class="muted">{{ tripsheets().length }} tripsheet(s) · {{ waybillCount() }} portal waybill(s)</span>
          </div>
          @if (loadingTripsheets()) { <app-skeleton-rows [rows]="5"></app-skeleton-rows> }
          @else if (tripsheets().length === 0) {
            <app-empty-state icon="route" title="No Overberg tripsheets" message="A tripsheet shows here as soon as a confirmed portal waybill is planned onto a load (Client bookings → Unplanned → Plan onto load)."></app-empty-state>
          } @else {
            <table class="tbl">
              <thead><tr><th></th><th>Tripsheet</th><th>Date</th><th>Driver / vehicle</th><th>Warehouse</th><th>Clients</th><th>Portal waybills</th><th>Stops</th><th>Status</th><th></th></tr></thead>
              <tbody>
                @for (t of tripsheets(); track t.loadId) {
                  <tr class="ts" (click)="toggle(t.loadId)">
                    <td><mat-icon class="chev" [class.open]="expanded().has(t.loadId)">chevron_right</mat-icon></td>
                    <td><a class="link" (click)="openTripsheet(t); $event.stopPropagation()">{{ t.tripsheetNo }}</a></td>
                    <td>{{ t.date | date:'EEE dd MMM' }}@if (t.scheduledDelivery) { <div class="muted">deliver {{ t.scheduledDelivery | date:'dd MMM' }}</div> }</td>
                    <td>{{ t.driverName || '—' }}<div class="muted">{{ t.vehicleReg || 'no vehicle' }}</div></td>
                    <td>{{ t.warehouse || '—' }}</td>
                    <td>{{ t.customers.join(', ') || '—' }}</td>
                    <td>{{ t.waybills.length }} <span class="muted">· {{ t.totalKg | number:'1.0-0' }} kg</span></td>
                    <td>{{ t.portalStops }}<span class="muted"> of {{ t.totalStops }}</span>@if (t.distanceKm) { <div class="muted">{{ t.distanceKm | number:'1.0-0' }} km</div> }</td>
                    <td><app-status-chip [status]="t.status"></app-status-chip></td>
                    <td class="row-actions" (click)="$event.stopPropagation()">
                      <button mat-icon-button matTooltip="Open tripsheet" (click)="openTripsheet(t)"><mat-icon>description</mat-icon></button>
                      <button mat-icon-button matTooltip="Open load" (click)="openLoad(t)"><mat-icon>assignment</mat-icon></button>
                    </td>
                  </tr>
                  @if (expanded().has(t.loadId)) {
                    <tr class="sub"><td></td><td colspan="9">
                      <table class="tbl small">
                        <thead><tr><th>Waybill</th><th>Client</th><th>Route</th><th>Collect</th><th>Deliver by</th><th>Cargo</th><th>Status</th><th>ETA / done</th><th></th></tr></thead>
                        <tbody>
                          @for (w of t.waybills; track w.id) {
                            <tr>
                              <td><span class="mono">{{ w.waybillNo || '#' + w.id }}</span><div class="muted">{{ w.bookingNo }}{{ w.clientReference ? ' · ' + w.clientReference : '' }}</div></td>
                              <td>{{ w.customerName }}</td>
                              <td>{{ w.from }} → {{ w.to }}</td>
                              <td>{{ w.collectionDate | date:'dd MMM' }}</td>
                              <td>{{ w.requestedDeliveryDate | date:'dd MMM' }}</td>
                              <td>{{ cargo(w) }}{{ w.fragile ? ' · fragile' : '' }}{{ w.hazardous ? ' · haz' : '' }}</td>
                              <td><app-status-chip [status]="label(w.status)"></app-status-chip></td>
                              <td>@if (w.deliveredAt) { {{ w.deliveredAt | date:'dd MMM HH:mm' }} } @else if (w.eta) { ETA {{ w.eta | date:'HH:mm' }} } @else { — }</td>
                              <td class="row-actions">
                                @if (w.waybillNo) {
                                  <button mat-icon-button matTooltip="Waybill PDF" (click)="waybillPdf(w)"><mat-icon>picture_as_pdf</mat-icon></button>
                                  <button mat-icon-button matTooltip="Labels" (click)="labelsPdf(w)"><mat-icon>label</mat-icon></button>
                                  <button mat-icon-button matTooltip="Copy tracking link" (click)="copyTracking(w)"><mat-icon>share</mat-icon></button>
                                }
                                @if (w.status === 'DELIVERED') { <button mat-icon-button matTooltip="POD" (click)="podPdf(w)"><mat-icon>verified</mat-icon></button> }
                                <button mat-icon-button matTooltip="Open in Client bookings" (click)="openShipment(w.id)"><mat-icon>open_in_new</mat-icon></button>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </td></tr>
                  }
                }
              </tbody>
            </table>
          }
        </section>
      }

      <!-- ============ SUPPORT ============ -->
      @if (view() === 'support') {
        <section class="card support">
          <div class="threads">
            @if (loadingThreads()) { <app-skeleton-rows [rows]="4"></app-skeleton-rows> }
            @else if (threads().length === 0) {
              <app-empty-state icon="forum" title="No conversations" message="Messages clients send from the portal chat show up here."></app-empty-state>
            } @else {
              @for (t of threads(); track t.portalUserId) {
                <button class="thread" [class.active]="activeThread()?.portalUserId === t.portalUserId" (click)="openThread(t)">
                  <div class="t-head"><b>{{ t.userName }}</b> @if (t.unread > 0) { <span class="count hot">{{ t.unread }}</span> }</div>
                  <div class="muted">{{ t.customerName }}</div>
                  <div class="muted preview">{{ t.last?.from === 'agent' ? 'You: ' : '' }}{{ t.last?.text }}</div>
                  <div class="muted">{{ t.lastAt | date:'dd MMM HH:mm' }}</div>
                </button>
              }
            }
          </div>
          <div class="conv">
            @if (!activeThread()) {
              <app-empty-state icon="chat" title="Pick a conversation" message="Select a client on the left to read and reply."></app-empty-state>
            } @else {
              <header><b>{{ activeThread()!.userName }}</b> <span class="muted">· {{ activeThread()!.customerName }} · <a href="mailto:{{ activeThread()!.email }}">{{ activeThread()!.email }}</a></span></header>
              <div class="msgs">
                @for (m of messages(); track m.id) {
                  <div class="msg" [class.agent]="m.from === 'agent'" [class.system]="m.from === 'system'">
                    <div class="bubble">{{ m.text }}</div>
                    <div class="muted">{{ m.authorName }} · {{ m.createdAt | date:'dd MMM HH:mm' }}{{ m.shipmentRef ? ' · ' + m.shipmentRef : '' }}</div>
                  </div>
                }
              </div>
              <div class="reply">
                <textarea rows="2" [(ngModel)]="replyText" placeholder="Reply to the client… (Enter to send, Shift+Enter for a new line)" (keydown.enter)="onReplyKey($event)"></textarea>
                <button mat-flat-button color="primary" (click)="sendReply()" [disabled]="!replyText.trim() || busy()"><mat-icon>send</mat-icon> Send</button>
              </div>
            }
          </div>
        </section>
      }

      <!-- ============ PORTAL LOGINS ============ -->
      @if (view() === 'logins') {
        <section class="card">
          <div class="toolbar">
            <span class="muted">Each login belongs to one customer and only ever sees that customer's waybills. New users get a temporary password by email and must change it on first sign-in.</span>
            <span class="spacer"></span>
            <button mat-flat-button color="primary" (click)="showNewUser.set(!showNewUser())"><mat-icon>person_add</mat-icon> New portal login</button>
          </div>
          @if (showNewUser()) {
            <form class="new-user" (ngSubmit)="createUser()">
              <label>Customer
                <input type="search" list="ob-customers" [(ngModel)]="nu.customerText" name="customerText" (input)="searchCustomers()" placeholder="Start typing a customer…" required />
                <datalist id="ob-customers">@for (c of customerHits(); track c.id) { <option [value]="c.name"></option> }</datalist>
              </label>
              <label>Name <input [(ngModel)]="nu.name" name="name" required /></label>
              <label>Email <input type="email" [(ngModel)]="nu.email" name="email" required /></label>
              <label>Phone <input [(ngModel)]="nu.phone" name="phone" /></label>
              <label>Role
                <select [(ngModel)]="nu.role" name="role"><option value="user">User</option><option value="admin">Admin (address book &amp; settings)</option></select>
              </label>
              <label class="chk"><input type="checkbox" [(ngModel)]="nu.sendWelcomeEmail" name="send" /> Email the temporary password</label>
              <div class="form-actions">
                <button mat-button type="button" (click)="showNewUser.set(false)">Cancel</button>
                <button mat-flat-button color="primary" type="submit" [disabled]="busy()">Create login</button>
              </div>
            </form>
          }
          @if (loadingUsers()) { <app-skeleton-rows [rows]="4"></app-skeleton-rows> }
          @else if (users().length === 0) {
            <app-empty-state icon="badge" title="No portal logins yet" message="Create the first login for a client so they can book and track on the portal."></app-empty-state>
          } @else {
            <table class="tbl">
              <thead><tr><th>Customer</th><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Last sign-in</th><th>State</th><th></th></tr></thead>
              <tbody>
                @for (u of users(); track u.id) {
                  <tr [class.done]="!u.isActive">
                    <td>{{ u.customerName }}</td>
                    <td>{{ u.name }}</td>
                    <td><a href="mailto:{{ u.email }}">{{ u.email }}</a></td>
                    <td>{{ u.phone || '—' }}</td>
                    <td>{{ u.role }}</td>
                    <td>{{ u.lastLoginAt ? (u.lastLoginAt | date:'dd MMM HH:mm') : 'never' }}</td>
                    <td>
                      @if (!u.isActive) { <app-status-chip status="Disabled"></app-status-chip> }
                      @else if (u.lockedUntil && isFuture(u.lockedUntil)) { <app-status-chip status="Locked"></app-status-chip> }
                      @else if (u.mustChangePassword) { <app-status-chip status="Temp password"></app-status-chip> }
                      @else { <app-status-chip status="Active"></app-status-chip> }
                    </td>
                    <td class="row-actions">
                      <button mat-icon-button [matMenuTriggerFor]="um"><mat-icon>more_vert</mat-icon></button>
                      <mat-menu #um="matMenu">
                        <button mat-menu-item (click)="editUser(u)"><mat-icon>edit</mat-icon> Edit name / phone</button>
                        <button mat-menu-item (click)="resetPassword(u, true)"><mat-icon>mail</mat-icon> Email new temporary password</button>
                        <button mat-menu-item (click)="resetPassword(u, false)"><mat-icon>key</mat-icon> Show new temporary password</button>
                        <button mat-menu-item (click)="toggleRole(u)"><mat-icon>admin_panel_settings</mat-icon> Make {{ u.role === 'admin' ? 'user' : 'admin' }}</button>
                        <button mat-menu-item (click)="toggleActive(u)"><mat-icon>{{ u.isActive ? 'block' : 'check_circle' }}</mat-icon> {{ u.isActive ? 'Disable login' : 'Enable login' }}</button>
                      </mat-menu>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .ob { display: grid; gap: 14px; }
    .tabs { display: flex; gap: 4px; align-items: center; border-bottom: 1px solid var(--color-border, var(--color-line)); }
    .tabs button[role=tab] { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; border-bottom: 2px solid transparent; padding: 10px 14px; font: inherit; font-weight: 600; color: var(--color-text-2, var(--color-text-2)); cursor: pointer; }
    .tabs button[role=tab] mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .tabs button[role=tab].active { color: var(--color-primary, var(--color-brand)); border-bottom-color: var(--color-primary, #033142); }
    .spacer { flex: 1; }
    .count { display: inline-block; min-width: 18px; padding: 0 6px; border-radius: 999px; background: var(--color-surface-2, #eef1f4); font-size: 11px; line-height: 18px; text-align: center; }
    .count.hot { background: var(--color-warn, #e8a317); color: #fff; }
    .card { background: var(--color-surface, var(--color-surface)); border: 1px solid var(--color-border, var(--color-line)); border-radius: 12px; padding: 12px 16px; }
    .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
    .toolbar input, .toolbar select { height: 36px; border: 1px solid var(--color-border, #cfd5db); border-radius: 8px; padding: 0 10px; font: inherit; }
    .toolbar .search { min-width: 320px; }
    .toolbar label { display: inline-flex; gap: 6px; align-items: center; font-size: 13px; color: var(--color-text-2, var(--color-text-2)); }
    .tbl { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .tbl th { text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .03em; color: var(--color-text-2, var(--color-text-2)); padding: 8px; border-bottom: 1px solid var(--color-border, var(--color-line)); }
    .tbl td { padding: 9px 8px; border-bottom: 1px solid var(--color-border, #eef1f4); vertical-align: top; }
    .tbl.small td, .tbl.small th { padding: 5px 6px; font-size: 12.5px; }
    .tbl tr.done td { opacity: .55; }
    .tbl tr.ts { cursor: pointer; } .tbl tr.ts:hover td { background: var(--color-surface-2, var(--color-surface-2)); }
    .tbl tr.sub td { background: var(--color-surface-2, var(--color-surface-2)); padding: 6px 10px 12px; }
    .chev { transition: transform .15s; } .chev.open { transform: rotate(90deg); }
    .muted { color: var(--color-text-2, var(--color-text-2)); font-size: 12px; }
    .late { color: var(--color-danger, #b3261e); font-weight: 600; }
    .link { color: var(--color-primary, var(--color-brand)); font-weight: 600; cursor: pointer; text-decoration: none; }
    .mono { font-family: ui-monospace, monospace; font-size: 12px; }
    .row-actions { white-space: nowrap; text-align: right; }
    .booking { border: 1px solid var(--color-border, var(--color-line)); border-radius: 10px; padding: 10px 12px; margin-bottom: 12px; }
    .booking header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; }
    .booking .bk { font-weight: 700; font-size: 15px; }
    .booking .actions { display: flex; gap: 8px; }
    .note { display: inline-flex; gap: 6px; align-items: center; margin-top: 4px; font-size: 13px; background: var(--color-warn-soft); border-radius: 6px; padding: 2px 8px; } .note mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .support { display: grid; grid-template-columns: 300px 1fr; gap: 12px; min-height: 420px; }
    .threads { border-right: 1px solid var(--color-border, var(--color-line)); padding-right: 10px; display: grid; gap: 6px; align-content: start; }
    .thread { text-align: left; background: none; border: 1px solid transparent; border-radius: 8px; padding: 8px 10px; font: inherit; cursor: pointer; display: grid; gap: 2px; }
    .thread:hover, .thread.active { background: var(--color-surface-2, var(--color-surface-2)); border-color: var(--color-border, var(--color-line)); }
    .thread .t-head { display: flex; justify-content: space-between; align-items: center; }
    .thread .preview { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .conv { display: grid; grid-template-rows: auto 1fr auto; gap: 10px; }
    .conv header { padding-bottom: 8px; border-bottom: 1px solid var(--color-border, var(--color-line)); }
    .msgs { display: grid; gap: 10px; align-content: start; max-height: 50vh; overflow: auto; padding: 4px; }
    .msg { display: grid; gap: 2px; justify-items: start; max-width: 75%; }
    .msg.agent { justify-self: end; justify-items: end; }
    .msg .bubble { padding: 8px 12px; border-radius: 12px; background: var(--color-surface-2, #eef1f4); white-space: pre-wrap; }
    .msg.agent .bubble { background: var(--color-primary, #033142); color: #fff; }
    .msg.system .bubble { background: var(--color-warn-soft); font-style: italic; }
    .reply { display: flex; gap: 8px; align-items: flex-end; }
    .reply textarea { flex: 1; border: 1px solid var(--color-border, #cfd5db); border-radius: 8px; padding: 8px 10px; font: inherit; resize: vertical; }
    .new-user { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 14px; padding: 12px; margin-bottom: 12px; border: 1px dashed var(--color-border, #cfd5db); border-radius: 10px; }
    .new-user label { display: grid; gap: 4px; font-size: 12.5px; color: var(--color-text-2, var(--color-text-2)); }
    .new-user input, .new-user select { height: 36px; border: 1px solid var(--color-border, #cfd5db); border-radius: 8px; padding: 0 10px; font: inherit; }
    .new-user .chk { display: flex; align-items: center; gap: 8px; align-self: end; } .new-user .chk input { height: auto; }
    .new-user .form-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; gap: 8px; }
    @media (max-width: 900px) { .support { grid-template-columns: 1fr; } .threads { border-right: 0; } .new-user { grid-template-columns: 1fr; } .toolbar .search { min-width: 0; width: 100%; } }
  `]
})
export class OverbergTripsheetsComponent implements OnInit {
  private svc = inject(ShipmentService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

  view = signal<View>('pending');
  busy = signal(false);
  summary = signal<PortalSummary | null>(null);

  readonly views: { key: View; label: string; icon: string; hot: boolean; count: () => number | null }[] = [
    { key: 'pending', label: 'Awaiting confirmation', icon: 'pending_actions', hot: true, count: () => this.summary()?.waybillsAwaiting ?? null },
    { key: 'tripsheets', label: 'Tripsheets', icon: 'route', hot: false, count: () => this.summary()?.onTripsheets ?? null },
    { key: 'support', label: 'Support', icon: 'forum', hot: true, count: () => this.summary()?.unreadSupport ?? null },
    { key: 'logins', label: 'Portal logins', icon: 'badge', hot: false, count: () => this.summary()?.portalUsers ?? null },
  ];

  kpis = computed<KpiItem[]>(() => {
    const s = this.summary();
    return [
      { label: 'Waybills awaiting confirmation', value: s?.waybillsAwaiting ?? null, tone: s && s.waybillsAwaiting > 0 ? 'warn' : 'default' },
      { label: 'Confirmed, not on a tripsheet', value: s?.unplanned ?? null, tone: s && s.unplanned > 0 ? 'warn' : 'default' },
      { label: 'On tripsheets', value: s?.onTripsheets ?? null },
      { label: 'On the road', value: s?.onTheRoad ?? null },
      { label: 'Delivered today', value: s?.deliveredToday ?? null, tone: 'ok' },
      { label: 'Exceptions', value: s?.exceptions ?? null, tone: s && s.exceptions > 0 ? 'danger' : 'default' },
    ];
  });

  // pending
  pending = signal<PortalPendingBooking[]>([]); loadingPending = signal(false); pendingSearch = '';
  // tripsheets
  tripsheets = signal<PortalTripsheet[]>([]); loadingTripsheets = signal(false); tsSearch = ''; tsStatus = 'active'; tsFrom = ''; tsTo = '';
  expanded = signal(new Set<number>());
  waybillCount = computed(() => this.tripsheets().reduce((n, t) => n + t.waybills.length, 0));
  // support
  threads = signal<PortalSupportThreadRow[]>([]); loadingThreads = signal(false); activeThread = signal<PortalSupportThreadRow | null>(null);
  messages = signal<PortalSupportMessage[]>([]); replyText = '';
  // logins
  users = signal<PortalUserRow[]>([]); loadingUsers = signal(false); showNewUser = signal(false);
  customerHits = signal<{ id: number; name: string }[]>([]);
  nu = { customerText: '', name: '', email: '', phone: '', role: 'user', sendWelcomeEmail: true };

  ngOnInit(): void { this.refresh(); }

  refresh(): void {
    this.svc.portalSummary().subscribe({ next: s => this.summary.set(s), error: () => {} });
    this.loadView();
  }
  setView(v: View): void { this.view.set(v); this.loadView(); }
  private loadView(): void {
    switch (this.view()) {
      case 'pending': return this.loadPending();
      case 'tripsheets': return this.loadTripsheets();
      case 'support': return this.loadThreads();
      case 'logins': return this.loadUsers();
    }
  }

  // ---------- helpers
  label(s: string): string { return SHIPMENT_STATUS_LABEL[s as ShipmentStatus] ?? s; }
  place(p: { label?: string | null; suburb?: string | null; city?: string | null; province?: string | null }): string {
    return [p.label, p.suburb || p.city, p.province].filter(Boolean).join(' · ');
  }
  cargo(w: { totalPallets: number; totalParcels: number; totalWeightKg: number }): string {
    return `${w.totalPallets ? w.totalPallets + ' plt ' : ''}${w.totalParcels ? w.totalParcels + ' pcs ' : ''}· ${Math.round(w.totalWeightKg)} kg`;
  }
  itemsText(w: PortalPendingWaybill): string { return w.items.map(i => `${i.qty}× ${i.description || i.type}`).join(', '); }
  handling(w: PortalPendingWaybill): string {
    return [w.fragile ? 'Fragile' : '', w.hazardous ? 'Haz ' + (w.hazardClass ?? '') : '', w.temperatureRange ? 'Temp ' + w.temperatureRange : ''].filter(Boolean).join(' · ') || '—';
  }
  isSoon(d: string): boolean { const t = new Date(d).getTime() - Date.now(); return t < 36 * 3600 * 1000; }
  isFuture(d: string): boolean { return new Date(d).getTime() > Date.now(); }
  openCount(b: PortalPendingBooking): number { return b.waybills.filter(w => w.status === 'BOOKED').length; }

  // ---------- pending
  loadPending(): void {
    this.loadingPending.set(true);
    this.svc.portalPending(this.pendingSearch || undefined).subscribe({
      next: r => { this.pending.set(r); this.loadingPending.set(false); },
      error: e => { this.loadingPending.set(false); this.toast.error(this.err(e, 'Could not load portal waybills')); }
    });
  }
  async confirmOne(b: PortalPendingBooking, w: PortalPendingWaybill): Promise<void> {
    if (!await this.confirm.ask({ title: `Accept waybill #${w.id}?`, message: `${b.customerName} · ${this.place(w.pickup)} → ${this.place(w.delivery)}. It moves to Confirmed and the client is emailed.`, confirmText: 'Accept' })) return;
    this.busy.set(true);
    this.svc.portalConfirmWaybill(w.id).subscribe({
      next: () => { this.busy.set(false); this.toast.done(`Waybill #${w.id} confirmed`); this.afterChange(); },
      error: e => { this.busy.set(false); this.toast.error(this.err(e, 'Could not confirm')); }
    });
  }
  rejectOne(b: PortalPendingBooking, w: PortalPendingWaybill): void {
    const reason = window.prompt(`Reason for declining waybill #${w.id} (sent to ${b.customerName}):`);
    if (!reason?.trim()) return;
    this.busy.set(true);
    this.svc.portalRejectWaybill(w.id, reason.trim()).subscribe({
      next: () => { this.busy.set(false); this.toast.done(`Waybill #${w.id} declined`); this.afterChange(); },
      error: e => { this.busy.set(false); this.toast.error(this.err(e, 'Could not decline')); }
    });
  }
  async confirmAll(b: PortalPendingBooking): Promise<void> {
    const open = b.waybills.filter(w => w.status === 'BOOKED');
    if (!await this.confirm.ask({ title: `Accept ${b.bookingNo}?`, message: `${open.length} waybill(s) for ${b.customerName} move to Confirmed and the client is emailed.`, confirmText: 'Accept all' })) return;
    this.busy.set(true);
    this.svc.acceptBooking(b.bookingNo).subscribe({
      next: () => { this.busy.set(false); this.toast.done(`${b.bookingNo} accepted`); this.afterChange(); },
      error: e => { this.busy.set(false); this.toast.error(this.err(e, 'Could not accept')); }
    });
  }
  rejectAll(b: PortalPendingBooking): void {
    const reason = window.prompt(`Reason for declining ${b.bookingNo} (sent to ${b.customerName}):`);
    if (!reason?.trim()) return;
    this.busy.set(true);
    this.svc.rejectBooking(b.bookingNo, reason.trim()).subscribe({
      next: () => { this.busy.set(false); this.toast.done(`${b.bookingNo} declined`); this.afterChange(); },
      error: e => { this.busy.set(false); this.toast.error(this.err(e, 'Could not decline')); }
    });
  }
  private afterChange(): void { this.loadPending(); this.svc.portalSummary().subscribe({ next: s => this.summary.set(s), error: () => {} }); }

  // ---------- tripsheets
  loadTripsheets(): void {
    this.loadingTripsheets.set(true);
    this.svc.portalTripsheets({ status: this.tsStatus, search: this.tsSearch || undefined, from: this.tsFrom || undefined, to: this.tsTo || undefined }).subscribe({
      next: r => { this.tripsheets.set(r); this.loadingTripsheets.set(false); if (r.length === 1) this.expanded.set(new Set([r[0].loadId])); },
      error: e => { this.loadingTripsheets.set(false); this.toast.error(this.err(e, 'Could not load Overberg tripsheets')); }
    });
  }
  toggle(loadId: number): void { const s = new Set(this.expanded()); s.has(loadId) ? s.delete(loadId) : s.add(loadId); this.expanded.set(s); }
  openTripsheet(t: PortalTripsheet): void { this.router.navigate(['/logistics/trip-sheets', t.tripsheetNo || t.loadNumber || t.loadId]); }
  openLoad(t: PortalTripsheet): void { this.router.navigate(['/logistics/loads', t.loadNumber || t.loadId]); }
  openShipment(id: number): void { this.router.navigate(['/logistics/bookings'], { queryParams: { tab: 'shipments', shipment: id } }); }
  waybillPdf(w: PortalTripsheetWaybill): void { this.svc.waybillPdf(w.waybillNo!).subscribe({ next: b => this.svc.openBlob(b, `${w.waybillNo}.pdf`), error: () => this.toast.error('Could not render waybill') }); }
  labelsPdf(w: PortalTripsheetWaybill): void { this.svc.labelPdf(w.waybillNo!).subscribe({ next: b => this.svc.openBlob(b, `${w.waybillNo}-labels.pdf`), error: () => this.toast.error('Could not render labels') }); }
  podPdf(w: PortalTripsheetWaybill): void { this.svc.podPdf(w.id).subscribe({ next: b => this.svc.openBlob(b, `POD-${w.waybillNo || w.id}.pdf`), error: () => this.toast.error('No POD captured yet') }); }
  copyTracking(w: PortalTripsheetWaybill): void {
    const url = `${location.origin}/t/${w.trackingToken}`;
    navigator.clipboard?.writeText(url).then(() => this.toast.done('Tracking link copied'), () => window.prompt('Tracking link', url));
  }

  // ---------- support
  loadThreads(): void {
    this.loadingThreads.set(true);
    this.svc.portalSupportThreads().subscribe({
      next: r => { this.threads.set(r); this.loadingThreads.set(false); const a = this.activeThread(); if (a) { const same = r.find(x => x.portalUserId === a.portalUserId); if (same) this.activeThread.set(same); } },
      error: e => { this.loadingThreads.set(false); this.toast.error(this.err(e, 'Could not load conversations')); }
    });
  }
  openThread(t: PortalSupportThreadRow): void {
    this.activeThread.set(t);
    this.svc.portalSupportThread(t.portalUserId).subscribe({
      next: m => { this.messages.set(m); this.threads.update(list => list.map(x => x.portalUserId === t.portalUserId ? { ...x, unread: 0 } : x)); this.svc.portalSummary().subscribe({ next: s => this.summary.set(s), error: () => {} }); },
      error: e => this.toast.error(this.err(e, 'Could not load conversation'))
    });
  }
  onReplyKey(ev: Event): void { const k = ev as KeyboardEvent; if (!k.shiftKey) { ev.preventDefault(); this.sendReply(); } }
  sendReply(): void {
    const t = this.activeThread(); const text = this.replyText.trim();
    if (!t || !text) return;
    this.busy.set(true);
    this.svc.portalSupportReply(t.portalUserId, text).subscribe({
      next: m => { this.busy.set(false); this.replyText = ''; this.messages.update(list => [...list, m]); this.loadThreads(); },
      error: e => { this.busy.set(false); this.toast.error(this.err(e, 'Could not send reply')); }
    });
  }

  // ---------- logins
  loadUsers(): void {
    this.loadingUsers.set(true);
    this.svc.portalUsers().subscribe({
      next: r => { this.users.set(r); this.loadingUsers.set(false); },
      error: e => { this.loadingUsers.set(false); this.toast.error(this.err(e, 'Could not load portal logins')); }
    });
  }
  searchCustomers(): void {
    const q = this.nu.customerText.trim();
    if (q.length < 2) { this.customerHits.set([]); return; }
    this.svc.clients(q).subscribe({ next: r => this.customerHits.set(r.map((c: any) => ({ id: c.id, name: c.name }))), error: () => {} });
  }
  createUser(): void {
    const hit = this.customerHits().find(c => c.name.toLowerCase() === this.nu.customerText.trim().toLowerCase());
    if (!hit) { this.toast.error('Pick a customer from the list'); return; }
    if (!this.nu.name.trim() || !this.nu.email.includes('@')) { this.toast.error('Name and a valid email are required'); return; }
    this.busy.set(true);
    this.svc.portalCreateUser({ customerId: hit.id, name: this.nu.name.trim(), email: this.nu.email.trim(), phone: this.nu.phone || undefined, role: this.nu.role, sendWelcomeEmail: this.nu.sendWelcomeEmail }).subscribe({
      next: r => {
        this.busy.set(false); this.showNewUser.set(false);
        this.nu = { customerText: '', name: '', email: '', phone: '', role: 'user', sendWelcomeEmail: true };
        if (r.temporaryPassword) window.prompt(`Temporary password for ${r.user.email} (copy it now – it is not shown again):`, r.temporaryPassword);
        else this.toast.done(`Login created; temporary password emailed to ${r.user.email}`);
        this.loadUsers(); this.svc.portalSummary().subscribe({ next: s => this.summary.set(s), error: () => {} });
      },
      error: e => { this.busy.set(false); this.toast.error(this.err(e, 'Could not create login')); }
    });
  }
  async resetPassword(u: PortalUserRow, sendEmail: boolean): Promise<void> {
    if (!await this.confirm.ask({ title: `Reset password for ${u.name}?`, message: sendEmail ? 'A new temporary password is emailed to the user.' : 'A new temporary password is shown to you once.', confirmText: 'Reset' })) return;
    this.svc.portalResetPassword(u.id, sendEmail).subscribe({
      next: r => { if (r.temporaryPassword) window.prompt(`Temporary password for ${u.email}:`, r.temporaryPassword); else this.toast.done('Temporary password emailed'); this.loadUsers(); },
      error: e => this.toast.error(this.err(e, 'Could not reset password'))
    });
  }
  editUser(u: PortalUserRow): void {
    const name = window.prompt(`Full name for ${u.email}:`, u.name)?.trim();
    if (!name) return;
    const phone = window.prompt('Phone (optional):', u.phone || '')?.trim() ?? '';
    this.svc.portalUpdateUser(u.id, { name, phone }).subscribe({
      next: () => { this.toast.done('Login updated'); this.loadUsers(); },
      error: e => this.toast.error(this.err(e, 'Could not update'))
    });
  }
  toggleRole(u: PortalUserRow): void {
    this.svc.portalUpdateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }).subscribe({ next: () => this.loadUsers(), error: e => this.toast.error(this.err(e, 'Could not update')) });
  }
  async toggleActive(u: PortalUserRow): Promise<void> {
    if (u.isActive && !await this.confirm.ask({ title: `Disable ${u.name}?`, message: 'They can no longer sign in to the portal. Nothing else changes.', confirmText: 'Disable', danger: true })) return;
    this.svc.portalUpdateUser(u.id, { isActive: !u.isActive }).subscribe({ next: () => this.loadUsers(), error: e => this.toast.error(this.err(e, 'Could not update')) });
  }

  private err(e: any, fallback: string): string {
    const m = e?.error?.message ?? e?.error?.error ?? (typeof e?.error === 'string' ? e.error : null);
    return m || fallback;
  }
}
