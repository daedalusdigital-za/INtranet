import { Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { environment } from '../../../environments/environment';

interface WellyLine { code: string; description: string; qty: number; value: number; available: number; shortfall: number; movedIn: number; transferredIn: number; known: boolean; }
interface WellyInvoice {
  invoiceNumber: string; company: string; companyName: string; date: string; ageDays: number; priority: string;
  customerNumber: string; customerName: string; province?: string; city?: string; warehouseId: number; warehouseBasis: string;
  value: number; status: 'Ready' | 'Partial' | 'Short'; unlockedByMovement: boolean; unlockedByTransfer: boolean; lineCount: number; readyLines: number; lines: WellyLine[];
}
interface WellyTruck { id: number; registrationNumber: string; make: string; model: string; type?: string; busy: boolean; lastKnownAddress?: string; }
interface WellyWarehouse {
  warehouseId: number; code: string; name: string; city?: string; province?: string; openInvoices: number;
  readyCount: number; readyValue: number; partialCount: number; partialValue: number; shortCount: number; shortValue: number;
  trucksTotal: number; trucksFree: number; trucks: WellyTruck[]; invoices: WellyInvoice[];
}
interface WellyLaneItem { code: string; description: string; qty: number; value: number; donorRemaining: number; invoices: string[]; }
interface WellyLane {
  fromWarehouseId: number; from: string; fromName: string; toWarehouseId: number; to: string; toName: string;
  items: WellyLaneItem[]; lineCount: number; totalQty: number; totalValue: number; unlocksInvoices: number; unlocksValue: number;
  helpsInvoices: number; unlockedInvoices: WellyInvoice[]; trucksFreeAtSource: number;
}
interface WellyTransferItem { fromCode: string; toCode: string; name: string; donorName: string; qty: number; value: number; sameWarehouse: boolean; warehouses: string[]; donorRemaining: number; invoices: string[]; }
interface WellyTransferLane {
  fromCategory: string; from: string; toCategory: string; to: string; items: WellyTransferItem[]; lineCount: number; totalQty: number; totalValue: number;
  sameWarehouseLines: number; crossWarehouseLines: number; unlocksInvoices: number; unlocksValue: number; helpsInvoices: number; unlockedInvoices: WellyInvoice[];
}
interface WellyFlow {
  openInvoices: number; routedByProvince: number; routedByLocation: number; routedByDefault: number; ready: number; partial: number; shortCount: number;
  unlockedByMovement: number; unlockedByTransfer: number; stillShort: number; unfillableLines: number; unknownCodes: number;
}
interface WellyResult {
  generatedAt: string; windowDays: number; assumptions: string[];
  summary: {
    openInvoices: number; openLines: number; openValue: number; readyInvoices: number; readyValue: number; partialInvoices: number; shortInvoices: number;
    unlockableInvoices: number; unlockableValue: number; transferableInvoices: number; transferableValue: number;
    movementLanes: number; movementUnits: number; transferLanes: number; transferUnits: number; unfillableLines: number; vehiclesAvailable: number; vehiclesBusy: number;
  };
  narrative: string[];
  steps: { label: string; detail: string; atMs: number }[];
  flow: WellyFlow;
  warehouses: WellyWarehouse[];
  movements: WellyLane[];
  interCompany: WellyTransferLane[];
  unfillable: { invoiceNumber: string; company: string; customerName: string; warehouse: string; code: string; description: string; qty: number; known: boolean }[];
}

interface ThinkStep { icon: string; text: string; state: 'pending' | 'active' | 'done'; detail?: string; }

/** Opened from Sales (read-only) or Stock (`mode: 'stock'` adds "Record" buttons that hand a lane/item back to the caller). */
export interface WellySuggestionsDialogData { mode?: 'sales' | 'stock'; }
export type WellySuggestionsAction =
  | { action: 'transfer'; lane: WellyLane; item: WellyLaneItem }
  | { action: 'transfer-lane'; lane: WellyLane }
  | { action: 'ic-transfer'; lane: WellyTransferLane; item: WellyTransferItem };
export type { WellyLane, WellyLaneItem, WellyTransferLane, WellyTransferItem };

@Component({
  selector: 'app-welly-suggestions-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatTabsModule, MatTooltipModule,
            MatExpansionModule, MatProgressBarModule, MatChipsModule, MatButtonToggleModule],
  template: `
    <div class="welly-dlg">
      <h2 mat-dialog-title>
        <span class="welly-avatar" [class.thinking]="phase() === 'thinking'"><img [src]="wellyFace()" alt="Welly"></span>
        <span class="title-text">
          Welly suggestions
          <small>{{ phase() === 'thinking' ? 'Analysing invoices, stock and fleet…' : (stockMode ? 'What can be invoiced out of stock, and which movements would complete more' : 'What can we fulfil, and what should move') }}</small>
        </span>
        <span class="spacer"></span>
        @if (phase() === 'ready') {
          <mat-button-toggle-group class="window-toggle" [value]="days()" (change)="setDays($event.value)" hideSingleSelectionIndicator>
            <mat-button-toggle [value]="30">30d</mat-button-toggle>
            <mat-button-toggle [value]="45">45d</mat-button-toggle>
            <mat-button-toggle [value]="90">90d</mat-button-toggle>
          </mat-button-toggle-group>
          <button mat-icon-button (click)="run()" matTooltip="Re-run analysis"><mat-icon>refresh</mat-icon></button>
        }
        <button mat-icon-button mat-dialog-close aria-label="Close"><mat-icon>close</mat-icon></button>
      </h2>

      <mat-dialog-content>
        <!-- ============ THINKING ============ -->
        @if (phase() === 'thinking') {
          <div class="thinking">
            <div class="orb-wrap">
              <div class="orb-ring"></div>
              <div class="orb-ring r2"></div>
              <img class="orb-face" src="/welly/thinking.png" alt="Welly thinking">
            </div>
            <div class="think-log">
              @for (s of thinkSteps(); track s.text) {
                <div class="think-row" [class.active]="s.state === 'active'" [class.done]="s.state === 'done'" [class.pending]="s.state === 'pending'">
                  <span class="think-ico">
                    @if (s.state === 'done') { <mat-icon>check_circle</mat-icon> }
                    @else if (s.state === 'active') { <span class="dots"><i></i><i></i><i></i></span> }
                    @else { <mat-icon>{{ s.icon }}</mat-icon> }
                  </span>
                  <span class="think-text">
                    {{ s.text }}
                    @if (s.detail) { <small>{{ s.detail }}</small> }
                  </span>
                </div>
              }
            </div>
            <mat-progress-bar mode="determinate" [value]="thinkProgress()"></mat-progress-bar>
            <p class="think-foot">{{ elapsed() }}s · Welly is reading live data — nothing is changed by this analysis.</p>
          </div>
        }

        <!-- ============ ERROR ============ -->
        @if (phase() === 'error') {
          <div class="error-state">
            <img src="/welly/error.png" alt="" class="err-face">
            <p>{{ error() }}</p>
            <button mat-stroked-button (click)="run()"><mat-icon>refresh</mat-icon>Try again</button>
          </div>
        }

        <!-- ============ RESULTS ============ -->
        @if (phase() === 'ready' && view(); as r) {
          <div class="company-bar">
            <span class="cb-label"><mat-icon>business</mat-icon>Company</span>
            <div class="company-filter" role="group" aria-label="Filter by company">
              @for (c of companies; track c.code) {
                <button type="button" class="co-chip" [class.on]="company() === c.code" (click)="company.set(c.code)">
                  {{ c.label }}
                  @if (c.code !== 'ALL') { <span class="co-count">{{ companyCount(c.code) }}</span> }
                </button>
              }
            </div>
            @if (company() !== 'ALL') { <button mat-button class="clear-co" (click)="company.set('ALL')"><mat-icon>close</mat-icon>Clear</button> }
          </div>

          <div class="narrative">
            <img class="n-face" src="/welly/happy.png" alt="">
            <div class="n-text">
              @for (p of r.narrative; track $index) { <p [class.reveal]="true" [style.animation-delay]="($index * 180) + 'ms'">{{ p }}</p> }
            </div>
          </div>

          <div class="kpis">
            <div class="kpi"><span class="k">Open invoices</span><b>{{ r.summary.openInvoices | number }}</b><small>R {{ r.summary.openValue | number:'1.0-0' }}</small></div>
            <div class="kpi ok"><span class="k">Ready now</span><b>{{ r.summary.readyInvoices | number }}</b><small>R {{ r.summary.readyValue | number:'1.0-0' }}</small></div>
            <div class="kpi warn"><span class="k">Partial</span><b>{{ r.summary.partialInvoices | number }}</b><small>some lines in stock</small></div>
            <div class="kpi move"><span class="k">Unlock by moving</span><b>{{ r.summary.unlockableInvoices | number }}</b><small>R {{ r.summary.unlockableValue | number:'1.0-0' }} · {{ r.summary.movementLanes }} lanes</small></div>
            <div class="kpi xfer"><span class="k">Inter-company</span><b>{{ r.summary.transferableInvoices | number }}</b><small>R {{ r.summary.transferableValue | number:'1.0-0' }} · {{ r.summary.transferLanes }} pairs</small></div>
            <div class="kpi fleet"><span class="k">Trucks</span><b>{{ r.summary.vehiclesAvailable - r.summary.vehiclesBusy }}</b><small>free of {{ r.summary.vehiclesAvailable }}</small></div>
          </div>

          <mat-tab-group animationDuration="150ms" class="welly-tabs">
            <!-- ---------- TAB 1: FULFILMENTS ---------- -->
            <mat-tab>
              <ng-template mat-tab-label><mat-icon>task_alt</mat-icon>&nbsp;Suggested fulfilments <span class="tab-badge">{{ r.summary.readyInvoices }}</span></ng-template>
              <div class="tab-body">
                <div class="wh-grid">
                  @for (w of r.warehouses; track w.warehouseId) {
                    <div class="wh-card" [class.selected]="selectedWh() === w.warehouseId" (click)="selectedWh.set(w.warehouseId)">
                      <div class="wh-head">
                        <span class="wh-code">{{ w.code }}</span>
                        <span class="wh-name">{{ w.name }}</span>
                      </div>
                      <div class="wh-stats">
                        <span class="st ok" matTooltip="Fully fulfillable from local stock"><b>{{ w.readyCount }}</b> ready</span>
                        <span class="st warn" matTooltip="Some lines available locally"><b>{{ w.partialCount }}</b> partial</span>
                        <span class="st bad" matTooltip="No lines available locally"><b>{{ w.shortCount }}</b> short</span>
                      </div>
                      <div class="wh-foot">
                        <span><mat-icon>payments</mat-icon>R {{ w.readyValue | number:'1.0-0' }} ready</span>
                        <span [class.none]="w.trucksFree === 0"><mat-icon>local_shipping</mat-icon>{{ w.trucksFree }}/{{ w.trucksTotal }} trucks free</span>
                      </div>
                    </div>
                  }
                </div>

                @if (currentWh(); as w) {
                  <div class="wh-detail">
                    <div class="wh-detail-head">
                      <h3><mat-icon>warehouse</mat-icon>{{ w.name }} <small>{{ w.city }} · {{ w.province }}</small></h3>
                      <mat-button-toggle-group [value]="statusFilter()" (change)="statusFilter.set($event.value)" hideSingleSelectionIndicator class="small-toggle">
                        <mat-button-toggle value="Ready">Ready ({{ w.readyCount }})</mat-button-toggle>
                        <mat-button-toggle value="Partial">Partial ({{ w.partialCount }})</mat-button-toggle>
                        <mat-button-toggle value="Short">Short ({{ w.shortCount }})</mat-button-toggle>
                      </mat-button-toggle-group>
                    </div>

                    @if (w.trucks.length) {
                      <div class="truck-strip">
                        @for (t of w.trucks; track t.id) {
                          <span class="truck" [class.busy]="t.busy" [matTooltip]="(t.make + ' ' + t.model) + (t.type ? ' · ' + t.type : '') + (t.lastKnownAddress ? ' · ' + t.lastKnownAddress : '') + (t.busy ? ' · on a live load' : ' · free')">
                            <mat-icon>local_shipping</mat-icon>{{ t.registrationNumber }}
                          </span>
                        }
                      </div>
                    } @else {
                      <p class="muted"><mat-icon>info</mat-icon>No vehicles are registered to this province — set the province on the vehicle register so Welly can count them.</p>
                    }

                    @if (filteredInvoices().length === 0) {
                      <p class="muted empty">No {{ statusFilter().toLowerCase() }} invoices for {{ w.code }}.</p>
                    }
                    <mat-accordion displayMode="flat" class="inv-list">
                      @for (inv of filteredInvoices(); track inv.company + inv.invoiceNumber) {
                        <mat-expansion-panel class="inv-panel" [class]="'st-' + inv.status.toLowerCase()">
                          <mat-expansion-panel-header>
                            <mat-panel-title>
                              <span class="pri" [class]="'pri-' + inv.priority.toLowerCase()" [matTooltip]="inv.ageDays + ' days old'">{{ inv.priority }}</span>
                              <span class="inv-no">{{ inv.invoiceNumber }}</span>
                              <span class="company">{{ inv.companyName }}</span>
                              <span class="cust">{{ inv.customerName }}</span>
                            </mat-panel-title>
                            <mat-panel-description>
                              <span class="lines" [matTooltip]="'Routed by ' + inv.warehouseBasis">{{ inv.readyLines }}/{{ inv.lineCount }} lines</span>
                              <span class="val">R {{ inv.value | number:'1.0-0' }}</span>
                              @if (inv.status !== 'Ready' && inv.unlockedByMovement) { <mat-icon class="unlock" matTooltip="Can be completed with a stock movement — see tab 2">swap_horiz</mat-icon> }
                              @else if (inv.status !== 'Ready' && inv.unlockedByTransfer) { <mat-icon class="unlock xfer" matTooltip="Can be completed with an inter-company transfer — see tab 3">sync_alt</mat-icon> }
                            </mat-panel-description>
                          </mat-expansion-panel-header>
                          <table class="line-table">
                            <thead><tr><th>Code</th><th>Item</th><th class="num">Ordered</th><th class="num">In stock here</th><th class="num">Short</th><th></th></tr></thead>
                            <tbody>
                              @for (l of inv.lines; track l.code) {
                                <tr [class.short]="l.shortfall > 0">
                                  <td class="mono">{{ l.code }}</td>
                                  <td>{{ l.description }}</td>
                                  <td class="num">{{ l.qty | number }}</td>
                                  <td class="num">{{ l.available | number }}</td>
                                  <td class="num">{{ l.shortfall > 0 ? (l.shortfall | number) : '—' }}</td>
                                  <td>
                                    @if (l.shortfall <= 0) { <mat-icon class="ok">check</mat-icon> }
                                    @else if (l.movedIn >= l.shortfall) { <span class="tag move" matTooltip="Another warehouse holds this">movable</span> }
                                    @else if (l.movedIn + l.transferredIn >= l.shortfall) { <span class="tag xfer" matTooltip="Same item held under another company's code">inter-company</span> }
                                    @else if (!l.known) { <span class="tag unknown" matTooltip="No stock record for this code in any warehouse">no stock record</span> }
                                    @else { <span class="tag none">not in network</span> }
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                          <div class="inv-meta">
                            <span><mat-icon>place</mat-icon>{{ inv.city || '—' }}{{ inv.province ? ', ' + inv.province : '' }}</span>
                            <span><mat-icon>event</mat-icon>{{ inv.date | date:'dd MMM yyyy' }} · {{ inv.ageDays }} days</span>
                            <span><mat-icon>route</mat-icon>Routed by {{ inv.warehouseBasis }}</span>
                          </div>
                        </mat-expansion-panel>
                      }
                    </mat-accordion>
                  </div>
                }
              </div>
            </mat-tab>

            <!-- ---------- TAB 2: MOVEMENTS ---------- -->
            <mat-tab>
              <ng-template mat-tab-label><mat-icon>swap_horiz</mat-icon>&nbsp;Suggested movements <span class="tab-badge">{{ r.movements.length }}</span></ng-template>
              <div class="tab-body">
                @if (r.movements.length === 0) {
                  <div class="empty-big">
                    <mat-icon>inventory_2</mat-icon>
                    <p>No stock movement between warehouses would complete another invoice right now.</p>
                  </div>
                }
                <div class="lane-list">
                  @for (lane of r.movements; track lane.from + lane.to; let i = $index) {
                    <mat-expansion-panel class="lane" [expanded]="i === 0">
                      <mat-expansion-panel-header>
                        <mat-panel-title>
                          <span class="lane-route">
                            <span class="wh-pill">{{ lane.from }}</span>
                            <mat-icon>arrow_forward</mat-icon>
                            <span class="wh-pill to">{{ lane.to }}</span>
                          </span>
                          <span class="lane-title">Move {{ lane.items.length }} items · {{ lane.totalQty | number }} units from {{ lane.fromName }} to {{ lane.toName }}</span>
                        </mat-panel-title>
                        <mat-panel-description>
                          <span class="unlock-pill" [class.zero]="lane.unlocksInvoices === 0" matTooltip="Invoices that become fully fulfillable">
                            <mat-icon>lock_open</mat-icon>{{ lane.unlocksInvoices }} unlocked · R {{ lane.unlocksValue | number:'1.0-0' }}
                          </span>
                          <span class="help-pill" matTooltip="Invoices that get at least one line">helps {{ lane.helpsInvoices }}</span>
                          <span class="truck-pill" [class.none]="lane.trucksFreeAtSource === 0"><mat-icon>local_shipping</mat-icon>{{ lane.trucksFreeAtSource }} free at {{ lane.from }}</span>
                        </mat-panel-description>
                      </mat-expansion-panel-header>

                      @if (stockMode) {
                        <div class="lane-actions">
                          <mat-icon>edit_note</mat-icon>
                          <span>Record these as transfers in the stock ledger ({{ lane.from }} → {{ lane.to }}). Each line becomes two ledger entries; nothing moves physically until Logistics does.</span>
                          <button mat-flat-button color="primary" (click)="pick({ action: 'transfer-lane', lane })"><mat-icon>playlist_add_check</mat-icon>Record all {{ lane.items.length }}</button>
                        </div>
                      }

                      <div class="lane-body">
                        <div class="lane-col">
                          <h4><mat-icon>inventory</mat-icon>Items to move</h4>
                          <table class="line-table">
                            <thead><tr><th>Code</th><th>Item</th><th class="num">Move</th><th class="num">Left at {{ lane.from }}</th><th>For invoices</th>@if (stockMode) { <th></th> }</tr></thead>
                            <tbody>
                              @for (it of lane.items; track it.code) {
                                <tr>
                                  <td class="mono">{{ it.code }}</td>
                                  <td>{{ it.description }}</td>
                                  <td class="num"><b>{{ it.qty | number }}</b></td>
                                  <td class="num" [class.low]="it.donorRemaining < it.qty">{{ it.donorRemaining | number }}</td>
                                  <td class="inv-chips">@for (n of it.invoices.slice(0, 4); track n) { <span class="chip">{{ n }}</span> } @if (it.invoices.length > 4) { <span class="chip more">+{{ it.invoices.length - 4 }}</span> }</td>
                                  @if (stockMode) { <td class="act"><button mat-stroked-button class="rec-btn" (click)="pick({ action: 'transfer', lane, item: it })" matTooltip="Open the transfer form pre-filled with this line"><mat-icon>sync_alt</mat-icon>Record</button></td> }
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                        <div class="lane-col">
                          <h4><mat-icon>lock_open</mat-icon>Invoices this completes</h4>
                          @if (lane.unlockedInvoices.length === 0) { <p class="muted">This lane only partially helps invoices — they still need items nobody holds.</p> }
                          <ul class="unlock-list">
                            @for (inv of lane.unlockedInvoices; track inv.invoiceNumber) {
                              <li>
                                <span class="pri" [class]="'pri-' + inv.priority.toLowerCase()">{{ inv.priority }}</span>
                                <span class="inv-no">{{ inv.invoiceNumber }}</span>
                                <span class="cust">{{ inv.customerName }}</span>
                                <span class="val">R {{ inv.value | number:'1.0-0' }}</span>
                              </li>
                            }
                          </ul>
                        </div>
                      </div>
                    </mat-expansion-panel>
                  }
                </div>

                @if (r.unfillable.length) {
                  <mat-expansion-panel class="unfill">
                    <mat-expansion-panel-header>
                      <mat-panel-title><mat-icon>report_problem</mat-icon>&nbsp;{{ r.summary.unfillableLines }} lines no warehouse can fill</mat-panel-title>
                      <mat-panel-description>Need purchasing or a Sage stock check</mat-panel-description>
                    </mat-expansion-panel-header>
                    <table class="line-table">
                      <thead><tr><th>Invoice</th><th>Customer</th><th>For</th><th>Code</th><th>Item</th><th class="num">Short</th><th></th></tr></thead>
                      <tbody>
                        @for (u of r.unfillable; track u.invoiceNumber + u.code) {
                          <tr>
                            <td class="mono">{{ u.invoiceNumber }}</td><td>{{ u.customerName }}</td><td>{{ u.warehouse }}</td>
                            <td class="mono">{{ u.code }}</td><td>{{ u.description }}</td><td class="num">{{ u.qty | number }}</td>
                            <td>@if (!u.known) { <span class="tag unknown">no stock record</span> }</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </mat-expansion-panel>
                }
              </div>
            </mat-tab>

            <!-- ---------- TAB 3: INTER-COMPANY TRANSFERS ---------- -->
            <mat-tab>
              <ng-template mat-tab-label><mat-icon>sync_alt</mat-icon>&nbsp;Inter-company transfers <span class="tab-badge">{{ r.interCompany.length }}</span></ng-template>
              <div class="tab-body">
                <p class="explain"><mat-icon>info</mat-icon>The same product is often stocked under a different code in each company. Welly matches on the item <b>name</b> (descriptions differ, so they are ignored) and suggests transferring stock from one company to another to complete orders. Same-warehouse transfers are paperwork only; others also need a truck.</p>
                @if (r.interCompany.length === 0) {
                  <div class="empty-big">
                    <img src="/welly/lookingtopleft.png" alt="" class="empty-face">
                    <p>No same-name item in another company would complete an outstanding invoice right now.</p>
                  </div>
                }
                <div class="lane-list">
                  @for (lane of r.interCompany; track lane.fromCategory + lane.toCategory; let i = $index) {
                    <mat-expansion-panel class="lane xfer-lane" [expanded]="i === 0">
                      <mat-expansion-panel-header>
                        <mat-panel-title>
                          <span class="lane-route">
                            <span class="co-pill">{{ lane.from }}</span>
                            <mat-icon>sync_alt</mat-icon>
                            <span class="co-pill to">{{ lane.to }}</span>
                          </span>
                          <span class="lane-title">Transfer {{ lane.items.length }} items · {{ lane.totalQty | number }} units from {{ lane.from }} stock to {{ lane.to }}</span>
                        </mat-panel-title>
                        <mat-panel-description>
                          <span class="unlock-pill" [class.zero]="lane.unlocksInvoices === 0"><mat-icon>lock_open</mat-icon>{{ lane.unlocksInvoices }} unlocked · R {{ lane.unlocksValue | number:'1.0-0' }}</span>
                          <span class="help-pill">helps {{ lane.helpsInvoices }}</span>
                          <span class="same-pill" matTooltip="Lines where donor stock is already in the right warehouse"><mat-icon>warehouse</mat-icon>{{ lane.sameWarehouseLines }} same WH</span>
                          @if (lane.crossWarehouseLines) { <span class="truck-pill"><mat-icon>local_shipping</mat-icon>{{ lane.crossWarehouseLines }} need truck</span> }
                        </mat-panel-description>
                      </mat-expansion-panel-header>
                      <div class="lane-body">
                        <div class="lane-col">
                          <h4><mat-icon>inventory</mat-icon>Items to transfer</h4>
                          <table class="line-table">
                            <thead><tr><th>Item</th><th>From code<br><small>{{ lane.from }}</small></th><th>To code<br><small>{{ lane.to }}</small></th><th class="num">Qty</th><th>Where</th><th>For invoices</th>@if (stockMode) { <th></th> }</tr></thead>
                            <tbody>
                              @for (it of lane.items; track it.fromCode + it.toCode) {
                                <tr>
                                  <td>{{ it.name }} @if (it.donorName !== it.name) { <small class="alias" [matTooltip]="'Donor item name: ' + it.donorName">(as "{{ it.donorName }}")</small> }</td>
                                  <td class="mono">{{ it.fromCode }}</td>
                                  <td class="mono">{{ it.toCode }}</td>
                                  <td class="num"><b>{{ it.qty | number }}</b><br><small class="muted-sm">{{ it.donorRemaining | number }} left</small></td>
                                  <td>@for (w of it.warehouses; track w) { <span class="chip" [class.cross]="w.includes('→')">{{ w }}</span> }</td>
                                  <td class="inv-chips">@for (n of it.invoices.slice(0, 4); track n) { <span class="chip">{{ n }}</span> } @if (it.invoices.length > 4) { <span class="chip more">+{{ it.invoices.length - 4 }}</span> }</td>
                                  @if (stockMode) {
                                    <td class="act">
                                      @if (it.sameWarehouse) {
                                        <span class="tag xfer" matTooltip="Donor stock is already in the right warehouse — this is an inter-company invoice between {{ lane.from }} and {{ lane.to }}, no stock moves">paperwork only</span>
                                      } @else {
                                        <button mat-stroked-button class="rec-btn" (click)="pick({ action: 'ic-transfer', lane, item: it })" matTooltip="Open the transfer form for the donor code, source → destination warehouse"><mat-icon>sync_alt</mat-icon>Record move</button>
                                      }
                                    </td>
                                  }
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                        <div class="lane-col">
                          <h4><mat-icon>lock_open</mat-icon>Invoices this completes</h4>
                          @if (lane.unlockedInvoices.length === 0) { <p class="muted">These transfers only partially help — the invoices still need items nobody holds.</p> }
                          <ul class="unlock-list">
                            @for (inv of lane.unlockedInvoices; track inv.invoiceNumber) {
                              <li>
                                <span class="pri" [class]="'pri-' + inv.priority.toLowerCase()">{{ inv.priority }}</span>
                                <span class="inv-no">{{ inv.invoiceNumber }}</span>
                                <span class="cust">{{ inv.customerName }}</span>
                                <span class="val">R {{ inv.value | number:'1.0-0' }}</span>
                              </li>
                            }
                          </ul>
                        </div>
                      </div>
                    </mat-expansion-panel>
                  }
                </div>
              </div>
            </mat-tab>

            <!-- ---------- TAB 4: HOW WELLY THOUGHT ---------- -->
            <mat-tab>
              <ng-template mat-tab-label><mat-icon>psychology</mat-icon>&nbsp;How I worked it out</ng-template>
              <div class="tab-body how">
                <h4>Decision flow</h4>
                <div class="flow">
                  <div class="f-node src">
                    <mat-icon>receipt_long</mat-icon><b>{{ r.flow.openInvoices | number }}</b><span>open invoices<br>last {{ r.windowDays }} days</span>
                  </div>
                  <div class="f-arrow"><mat-icon>arrow_forward</mat-icon></div>
                  <div class="f-node">
                    <mat-icon>route</mat-icon><b>Route to home warehouse</b>
                    <span>{{ r.flow.routedByProvince }} by province · {{ r.flow.routedByLocation }} by Sage location @if (r.flow.routedByDefault) { · {{ r.flow.routedByDefault }} defaulted }</span>
                  </div>
                  <div class="f-arrow"><mat-icon>arrow_forward</mat-icon></div>
                  <div class="f-node">
                    <mat-icon>rule</mat-icon><b>Match lines to local stock</b><span>oldest invoice first,<br>damaged / expired excluded</span>
                  </div>
                  <div class="f-arrow"><mat-icon>arrow_forward</mat-icon></div>
                  <div class="f-split">
                    <div class="f-node ok"><mat-icon>task_alt</mat-icon><b>{{ r.flow.ready | number }}</b><span>Ready — dispatch<br>from own stock</span></div>
                    <div class="f-node warn"><mat-icon>pending</mat-icon><b>{{ (r.flow.partial + r.flow.shortCount) | number }}</b><span>Partial / short<br>({{ r.flow.partial }} partial, {{ r.flow.shortCount }} short)</span></div>
                  </div>
                  <div class="f-arrow"><mat-icon>arrow_forward</mat-icon></div>
                  <div class="f-chain">
                    <div class="f-node move"><mat-icon>swap_horiz</mat-icon><b>{{ r.flow.unlockedByMovement | number }}</b><span>unlocked by moving<br>same code from another WH</span></div>
                    <div class="f-down"><mat-icon>arrow_downward</mat-icon><small>still short</small></div>
                    <div class="f-node xfer"><mat-icon>sync_alt</mat-icon><b>{{ r.flow.unlockedByTransfer | number }}</b><span>unlocked by inter-company<br>transfer (same name, other code)</span></div>
                    <div class="f-down"><mat-icon>arrow_downward</mat-icon><small>still short</small></div>
                    <div class="f-node bad"><mat-icon>report_problem</mat-icon><b>{{ r.flow.stillShort | number }}</b><span>cannot be completed<br>{{ r.flow.unfillableLines }} lines · {{ r.flow.unknownCodes }} unknown codes</span></div>
                  </div>
                </div>

                <h4>Steps</h4>
                <ol class="steps">
                  @for (s of r.steps; track s.label) {
                    <li><b>{{ s.label }}</b> <span class="ms">{{ s.atMs }} ms</span><br><span>{{ s.detail }}</span></li>
                  }
                </ol>
                <h4>Assumptions</h4>
                <ul class="assume">@for (a of r.assumptions; track a) { <li>{{ a }}</li> }</ul>
                <p class="muted">Generated {{ r.generatedAt | date:'dd MMM yyyy HH:mm' }} · window {{ r.windowDays }} days</p>
              </div>
            </mat-tab>
          </mat-tab-group>
        }
      </mat-dialog-content>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .welly-dlg { display: flex; flex-direction: column; max-height: 90vh; }
    h2[mat-dialog-title] { display: flex; align-items: center; gap: 12px; margin: 0; padding: 14px 16px 10px 20px; flex-wrap: wrap; }
    .title-text { display: flex; flex-direction: column; line-height: 1.15; font-size: 1.15rem; flex: 0 1 auto; }
    .title-text small { font-size: .78rem; font-weight: 400; color: #6b7280; }
    .spacer { flex: 1; }
    .welly-avatar { flex: 0 0 44px; width: 44px; height: 44px; aspect-ratio: 1 / 1; border-radius: 50%; background: #faf5ff; display: grid; place-items: center; overflow: hidden; box-shadow: 0 4px 14px rgba(99,102,241,.25); }
    .welly-avatar img { width: 40px; height: 40px; object-fit: contain; display: block; }
    .welly-avatar.thinking { animation: glow 1.6s ease-in-out infinite; }
    .company-bar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
    .cb-label { display: inline-flex; align-items: center; gap: 4px; font-size: .78rem; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
    .cb-label mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .company-filter { display: inline-flex; gap: 4px; background: #f3f4f6; border-radius: 999px; padding: 3px; }
    .co-chip { border: 0; background: transparent; border-radius: 999px; padding: 6px 14px; font-size: .84rem; font-weight: 600; color: #4b5563; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 6px; }
    .co-chip:hover { background: #e5e7eb; }
    .co-chip.on { background: #fff; color: #5b21b6; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
    .co-count { background: #e5e7eb; color: #374151; border-radius: 999px; padding: 0 6px; font-size: .7rem; line-height: 16px; }
    .co-chip.on .co-count { background: #ede9fe; color: #5b21b6; }
    .clear-co { font-size: .8rem; }
    .clear-co mat-icon { font-size: 16px; width: 16px; height: 16px; }
    @keyframes glow { 0%,100% { box-shadow: 0 0 0 0 rgba(168,85,247,.45); } 50% { box-shadow: 0 0 0 10px rgba(168,85,247,0); } }
    .window-toggle { height: 32px; font-size: .8rem; }
    .window-toggle ::ng-deep .mat-button-toggle-label-content { line-height: 30px; padding: 0 10px; }
    mat-dialog-content { padding: 0 20px 20px !important; max-height: calc(90vh - 70px); }

    /* ---- thinking ---- */
    .thinking { display: flex; flex-direction: column; align-items: center; padding: 28px 12px 10px; gap: 22px; min-height: 420px; }
    .orb-wrap { position: relative; width: 128px; height: 128px; min-width: 128px; min-height: 128px; aspect-ratio: 1 / 1; flex: 0 0 auto; display: grid; place-items: center; }
    .orb-face { position: relative; z-index: 1; width: 100px; height: 100px; object-fit: contain; border-radius: 50%; animation: breathe 2.2s ease-in-out infinite; filter: drop-shadow(0 6px 16px rgba(124,58,237,.35)); }
    .orb-ring { position: absolute; left: 0; top: 0; width: 128px; height: 128px; box-sizing: border-box; border-radius: 50%; border: 2px solid rgba(124,58,237,.35); border-top-color: #7c3aed; animation: spin 1.4s linear infinite; }
    .orb-ring.r2 { left: 8px; top: 8px; width: 112px; height: 112px; border-color: rgba(236,72,153,.25); border-bottom-color: #ec4899; animation-duration: 2.3s; animation-direction: reverse; }
    @keyframes breathe { 0%,100% { transform: scale(.92); } 50% { transform: scale(1.06); } }
    @keyframes spin { to { transform: rotate(360deg); } }
    .think-log { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 8px; }
    .think-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 12px; border-radius: 10px; transition: all .3s; color: #9ca3af; }
    .think-row.active { background: #f5f3ff; color: #4c1d95; }
    .think-row.done { color: #374151; }
    .think-row.pending { opacity: .55; }
    .think-ico { width: 24px; display: grid; place-items: center; margin-top: 1px; }
    .think-ico mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .think-row.done .think-ico mat-icon { color: #16a34a; }
    .think-text { display: flex; flex-direction: column; font-size: .92rem; }
    .think-text small { color: #6b7280; font-size: .78rem; margin-top: 2px; }
    .dots { display: inline-flex; gap: 3px; }
    .dots i { width: 6px; height: 6px; border-radius: 50%; background: #7c3aed; animation: bounce 1s infinite; }
    .dots i:nth-child(2) { animation-delay: .15s; } .dots i:nth-child(3) { animation-delay: .3s; }
    @keyframes bounce { 0%,80%,100% { transform: translateY(0); opacity: .5; } 40% { transform: translateY(-5px); opacity: 1; } }
    .thinking mat-progress-bar { width: 100%; max-width: 560px; border-radius: 4px; }
    .think-foot { color: #6b7280; font-size: .8rem; margin: 0; }

    .error-state { text-align: center; padding: 40px; color: #b91c1c; }
    .err-face { width: 96px; height: 96px; object-fit: contain; }

    /* ---- narrative ---- */
    .narrative { display: flex; gap: 12px; background: linear-gradient(135deg, #f5f3ff, #fdf2f8); border: 1px solid #e9d5ff; border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; align-items: flex-start; }
    .n-face { width: 52px; height: 52px; object-fit: contain; flex-shrink: 0; }
    .n-text p { margin: 0 0 6px; font-size: .92rem; color: #1f2937; opacity: 0; animation: fadeUp .45s ease forwards; }
    .n-text p:last-child { margin-bottom: 0; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

    .kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 12px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; background: #fff; }
    .kpi .k { font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; color: #6b7280; }
    .kpi b { font-size: 1.35rem; line-height: 1.2; }
    .kpi small { color: #6b7280; font-size: .75rem; }
    .kpi.ok { border-color: #bbf7d0; background: #f0fdf4; } .kpi.ok b { color: #15803d; }
    .kpi.warn { border-color: #fde68a; background: #fffbeb; } .kpi.warn b { color: #b45309; }
    .kpi.move { border-color: #ddd6fe; background: #f5f3ff; } .kpi.move b { color: #6d28d9; }
    .kpi.fleet { border-color: #bfdbfe; background: #eff6ff; } .kpi.fleet b { color: #1d4ed8; }
    .kpi.xfer { border-color: #99f6e4; background: #f0fdfa; } .kpi.xfer b { color: #0f766e; }

    .explain { display: flex; gap: 8px; align-items: flex-start; font-size: .86rem; color: #374151; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 10px 12px; margin: 0 0 12px; }
    .explain mat-icon { color: #0f766e; flex-shrink: 0; font-size: 20px; width: 20px; height: 20px; }
    .co-pill { font-weight: 700; padding: 2px 10px; border-radius: 6px; background: #f3f4f6; color: #374151; }
    .co-pill.to { background: #ccfbf1; color: #0f766e; }
    .xfer-lane .lane-route mat-icon { color: #0f766e; }
    .same-pill { display: inline-flex; align-items: center; gap: 4px; font-size: .76rem; padding: 2px 8px; border-radius: 999px; background: #ccfbf1; color: #0f766e; white-space: nowrap; }
    .same-pill mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .alias { color: #6b7280; font-size: .75rem; }
    .muted-sm { color: #9ca3af; font-size: .72rem; }
    .chip.cross { background: #fef3c7; color: #92400e; }
    .empty-face { width: 84px; height: 84px; object-fit: contain; }
    .line-table th small { font-weight: 400; text-transform: none; color: #9ca3af; }

    /* ---- flow diagram ---- */
    .flow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; background: #fafafa; border: 1px dashed #d1d5db; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .f-node { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; min-width: 150px; max-width: 190px; font-size: .78rem; color: #4b5563; }
    .f-node mat-icon { color: #6b7280; }
    .f-node b { font-size: 1rem; color: #111827; }
    .f-node.src { border-color: #c4b5fd; background: #faf5ff; } .f-node.src mat-icon { color: #7c3aed; }
    .f-node.ok { border-color: #bbf7d0; background: #f0fdf4; } .f-node.ok mat-icon, .f-node.ok b { color: #15803d; }
    .f-node.warn { border-color: #fde68a; background: #fffbeb; } .f-node.warn mat-icon, .f-node.warn b { color: #b45309; }
    .f-node.move { border-color: #ddd6fe; background: #f5f3ff; } .f-node.move mat-icon, .f-node.move b { color: #6d28d9; }
    .f-node.xfer { border-color: #99f6e4; background: #f0fdfa; } .f-node.xfer mat-icon, .f-node.xfer b { color: #0f766e; }
    .f-node.bad { border-color: #fecaca; background: #fef2f2; } .f-node.bad mat-icon, .f-node.bad b { color: #b91c1c; }
    .f-arrow { color: #9ca3af; display: grid; place-items: center; }
    .f-split { display: flex; flex-direction: column; gap: 8px; }
    .f-chain { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .f-down { display: flex; flex-direction: column; align-items: center; color: #9ca3af; font-size: .7rem; line-height: 1; }
    .f-down mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .welly-tabs ::ng-deep .mat-mdc-tab .mdc-tab__text-label { display: inline-flex; align-items: center; }
    .tab-badge { background: #ede9fe; color: #5b21b6; border-radius: 999px; padding: 0 7px; font-size: .72rem; font-weight: 600; margin-left: 6px; line-height: 18px; }
    .tab-body { padding: 14px 2px 4px; }

    /* ---- warehouses ---- */
    .wh-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
    .wh-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px; cursor: pointer; transition: all .15s; background: #fff; }
    .wh-card:hover { border-color: #c4b5fd; }
    .wh-card.selected { border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124,58,237,.15); background: #faf5ff; }
    .wh-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .wh-code { font-weight: 700; font-size: 1.05rem; color: #4c1d95; }
    .wh-name { font-size: .8rem; color: #6b7280; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wh-stats { display: flex; gap: 8px; font-size: .78rem; margin-bottom: 8px; }
    .st { padding: 2px 8px; border-radius: 999px; }
    .st.ok { background: #dcfce7; color: #166534; } .st.warn { background: #fef3c7; color: #92400e; } .st.bad { background: #fee2e2; color: #991b1b; }
    .wh-foot { display: flex; justify-content: space-between; font-size: .76rem; color: #4b5563; }
    .wh-foot span { display: inline-flex; align-items: center; gap: 4px; }
    .wh-foot mat-icon { font-size: 15px; width: 15px; height: 15px; }
    .wh-foot .none { color: #b91c1c; }

    .wh-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .wh-detail-head h3 { margin: 0; display: flex; align-items: center; gap: 6px; font-size: 1rem; }
    .wh-detail-head h3 small { color: #6b7280; font-weight: 400; font-size: .8rem; }
    .small-toggle { height: 30px; font-size: .78rem; }
    .small-toggle ::ng-deep .mat-button-toggle-label-content { line-height: 28px; padding: 0 10px; }
    .truck-strip { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0 12px; }
    .truck { display: inline-flex; align-items: center; gap: 4px; font-size: .75rem; padding: 2px 8px; border-radius: 6px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    .truck mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .truck.busy { background: #f3f4f6; color: #6b7280; border-color: #e5e7eb; text-decoration: line-through; }

    .inv-list .inv-panel { margin-bottom: 6px; border-left: 4px solid #e5e7eb; }
    .inv-panel.st-ready { border-left-color: #22c55e; } .inv-panel.st-partial { border-left-color: #f59e0b; } .inv-panel.st-short { border-left-color: #ef4444; }
    mat-panel-title { display: flex; align-items: center; gap: 10px; overflow: hidden; flex: 3 1 0; min-width: 0; }
    mat-panel-description { justify-content: flex-end; align-items: center; gap: 12px; flex: 1 0 auto; }
    .inv-no { font-family: ui-monospace, monospace; font-weight: 600; white-space: nowrap; }
    .company { font-size: .75rem; color: #6d28d9; background: #ede9fe; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
    .cust { color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; min-width: 0; }
    .lines { font-size: .8rem; color: #6b7280; }
    .val { font-weight: 600; color: #111827; }
    .unlock { color: #7c3aed; font-size: 20px; width: 20px; height: 20px; }
    .pri { font-size: .68rem; font-weight: 700; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; letter-spacing: .03em; }
    .pri-low { background: #f3f4f6; color: #4b5563; } .pri-normal { background: #dbeafe; color: #1e40af; } .pri-high { background: #fef3c7; color: #92400e; }
    .pri-urgent { background: #ffedd5; color: #9a3412; } .pri-critical { background: #fee2e2; color: #991b1b; }

    .line-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
    .line-table th { text-align: left; font-size: .72rem; text-transform: uppercase; color: #6b7280; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
    .line-table td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
    .line-table .num { text-align: right; white-space: nowrap; }
    .line-table tr.short td { background: #fff7ed; }
    .line-table .low { color: #b45309; }
    .mono { font-family: ui-monospace, monospace; }
    .ok { color: #16a34a; }
    .tag { font-size: .7rem; padding: 1px 6px; border-radius: 4px; white-space: nowrap; }
    .tag.move { background: #ede9fe; color: #5b21b6; } .tag.xfer { background: #ccfbf1; color: #0f766e; } .tag.unknown { background: #f3f4f6; color: #6b7280; } .tag.none { background: #fee2e2; color: #991b1b; }
    .unlock.xfer { color: #0f766e; }
    .inv-meta { display: flex; gap: 16px; flex-wrap: wrap; font-size: .78rem; color: #6b7280; margin-top: 10px; }
    .inv-meta span { display: inline-flex; align-items: center; gap: 4px; }
    .inv-meta mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* ---- lanes ---- */
    .lane { margin-bottom: 10px; }
    .lane-actions { display: flex; align-items: center; gap: 10px; background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 10px; padding: 8px 12px; margin-bottom: 12px; font-size: .84rem; color: #4c1d95; }
    .lane-actions mat-icon { color: #7c3aed; flex-shrink: 0; }
    .lane-actions span { flex: 1; }
    .line-table td.act { text-align: right; white-space: nowrap; }
    .rec-btn { height: 30px; line-height: 30px; font-size: .78rem; padding: 0 10px; }
    .rec-btn mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    .lane-route { display: inline-flex; align-items: center; gap: 4px; margin-right: 10px; }
    .lane-route mat-icon { font-size: 18px; width: 18px; height: 18px; color: #6b7280; }
    .wh-pill { font-weight: 700; padding: 2px 8px; border-radius: 6px; background: #f3f4f6; color: #374151; }
    .wh-pill.to { background: #ede9fe; color: #5b21b6; }
    .lane-title { font-size: .9rem; }
    .unlock-pill, .help-pill, .truck-pill { display: inline-flex; align-items: center; gap: 4px; font-size: .76rem; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
    .unlock-pill { background: #dcfce7; color: #166534; } .unlock-pill.zero { background: #f3f4f6; color: #6b7280; }
    .help-pill { background: #fef3c7; color: #92400e; }
    .truck-pill { background: #eff6ff; color: #1e40af; } .truck-pill.none { background: #fee2e2; color: #991b1b; }
    .unlock-pill mat-icon, .truck-pill mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .lane-body { display: grid; grid-template-columns: 3fr 2fr; gap: 18px; }
    .lane-col h4 { display: flex; align-items: center; gap: 6px; margin: 4px 0 8px; font-size: .88rem; color: #374151; }
    .lane-col h4 mat-icon { font-size: 18px; width: 18px; height: 18px; color: #7c3aed; }
    .inv-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .chip { font-size: .7rem; font-family: ui-monospace, monospace; background: #f3f4f6; padding: 1px 6px; border-radius: 4px; }
    .chip.more { background: #ede9fe; color: #5b21b6; }
    .unlock-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .unlock-list li { display: flex; align-items: center; gap: 8px; font-size: .85rem; padding: 6px 8px; border-radius: 8px; background: #f9fafb; }
    .unlock-list .cust { flex: 1; }
    .unfill { margin-top: 14px; }
    .unfill mat-panel-title { color: #b45309; }
    .empty-big { text-align: center; padding: 40px 20px; color: #6b7280; }
    .empty-big mat-icon { font-size: 44px; width: 44px; height: 44px; color: #c4b5fd; }

    .muted { color: #6b7280; font-size: .85rem; display: flex; align-items: center; gap: 6px; }
    .muted mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .muted.empty { padding: 20px; justify-content: center; }
    .how h4 { margin: 8px 0 6px; }
    .steps li { margin-bottom: 8px; font-size: .88rem; }
    .steps .ms { color: #9ca3af; font-size: .75rem; margin-left: 6px; }
    .assume li { font-size: .86rem; color: #374151; margin-bottom: 4px; }

    @media (max-width: 900px) {
      .kpis { grid-template-columns: repeat(3, 1fr); }
      .wh-grid { grid-template-columns: repeat(2, 1fr); }
      .lane-body { grid-template-columns: 1fr; }
    }
  `]
})
export class WellySuggestionsDialogComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private ref = inject(MatDialogRef<WellySuggestionsDialogComponent>);
  private apiUrl = environment.apiUrl;
  private dlgData = inject<WellySuggestionsDialogData | null>(MAT_DIALOG_DATA, { optional: true });
  readonly stockMode = this.dlgData?.mode === 'stock';

  /** Hand a suggestion back to the caller (Stock) so it can record it. */
  pick(a: WellySuggestionsAction): void { this.ref.close(a); }

  phase = signal<'thinking' | 'ready' | 'error'>('thinking');
  error = signal('');
  result = signal<WellyResult | null>(null);
  days = signal(45);
  selectedWh = signal<number>(1);
  statusFilter = signal<'Ready' | 'Partial' | 'Short'>('Ready');
  elapsed = signal(0);
  company = signal<string>('ALL');
  readonly companies = [
    { code: 'ALL', label: 'All' },
    { code: 'PMT', label: 'Promed' },
    { code: 'ACM', label: 'Access' },
    { code: 'SBT', label: 'Sebenzani' },
    { code: 'PHT', label: 'Pharmacare' },
    { code: 'KOG', label: 'KOG' },
  ];
  companyCount(code: string): number {
    const r = this.result();
    return r ? r.warehouses.reduce((n, w) => n + w.invoices.filter(i => i.company === code).length, 0) : 0;
  }

  /** Result narrowed to the selected company (counts, values, lanes all recomputed client-side). */
  view = computed<WellyResult | null>(() => {
    const r = this.result();
    const co = this.company();
    if (!r || co === 'ALL') return r;
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const warehouses = r.warehouses.map(w => {
      const invoices = w.invoices.filter(i => i.company === co);
      const ready = invoices.filter(i => i.status === 'Ready');
      const partial = invoices.filter(i => i.status === 'Partial');
      const short = invoices.filter(i => i.status === 'Short');
      return { ...w, invoices, openInvoices: invoices.length,
        readyCount: ready.length, readyValue: sum(ready.map(i => i.value)),
        partialCount: partial.length, partialValue: sum(partial.map(i => i.value)),
        shortCount: short.length, shortValue: sum(short.map(i => i.value)) };
    });
    const all = warehouses.flatMap(w => w.invoices);
    const mine = new Set(all.map(i => i.invoiceNumber));
    const movements = r.movements.map(l => {
      const items = l.items.map(it => ({ ...it, invoices: it.invoices.filter(n => mine.has(n)) })).filter(it => it.invoices.length > 0);
      const unlockedInvoices = l.unlockedInvoices.filter(i => i.company === co);
      return { ...l, items, unlockedInvoices, unlocksInvoices: unlockedInvoices.length, unlocksValue: sum(unlockedInvoices.map(i => i.value)),
        helpsInvoices: new Set(items.flatMap(it => it.invoices)).size, totalQty: sum(items.map(it => it.qty)), totalValue: sum(items.map(it => it.value)), lineCount: items.length };
    }).filter(l => l.items.length > 0).sort((a, b) => b.unlocksValue - a.unlocksValue || b.totalValue - a.totalValue);
    const unfillable = r.unfillable.filter(u => u.company === co);
    const interCompany = r.interCompany.map(l => {
      const items = l.items.map(it => ({ ...it, invoices: it.invoices.filter(n => mine.has(n)) })).filter(it => it.invoices.length > 0);
      const unlockedInvoices = l.unlockedInvoices.filter(i => i.company === co);
      return { ...l, items, unlockedInvoices, unlocksInvoices: unlockedInvoices.length, unlocksValue: sum(unlockedInvoices.map(i => i.value)),
        helpsInvoices: new Set(items.flatMap(it => it.invoices)).size, totalQty: sum(items.map(it => it.qty)), totalValue: sum(items.map(it => it.value)), lineCount: items.length };
    }).filter(l => l.items.length > 0).sort((a, b) => b.unlocksValue - a.unlocksValue || b.totalValue - a.totalValue);
    const ready = all.filter(i => i.status === 'Ready');
    const unlock = all.filter(i => i.unlockedByMovement);
    const xfer = all.filter(i => i.unlockedByTransfer);
    const flow = { ...r.flow,
      openInvoices: all.length,
      routedByProvince: all.filter(i => i.warehouseBasis === 'delivery province').length,
      routedByLocation: all.filter(i => i.warehouseBasis === 'sage location').length,
      routedByDefault: all.filter(i => i.warehouseBasis.startsWith('default')).length,
      ready: ready.length, partial: all.filter(i => i.status === 'Partial').length, shortCount: all.filter(i => i.status === 'Short').length,
      unlockedByMovement: unlock.length, unlockedByTransfer: xfer.length,
      stillShort: all.filter(i => i.status !== 'Ready' && !i.unlockedByMovement && !i.unlockedByTransfer).length,
      unfillableLines: unfillable.length, unknownCodes: unfillable.filter(u => !u.known).length };
    return { ...r, warehouses, movements, interCompany, unfillable, flow,
      summary: { ...r.summary, openInvoices: all.length, openLines: sum(all.map(i => i.lineCount)), openValue: sum(all.map(i => i.value)),
        readyInvoices: ready.length, readyValue: sum(ready.map(i => i.value)),
        partialInvoices: all.filter(i => i.status === 'Partial').length, shortInvoices: all.filter(i => i.status === 'Short').length,
        unlockableInvoices: unlock.length, unlockableValue: sum(unlock.map(i => i.value)),
        transferableInvoices: xfer.length, transferableValue: sum(xfer.map(i => i.value)),
        movementLanes: movements.length, movementUnits: sum(movements.map(l => l.totalQty)),
        transferLanes: interCompany.length, transferUnits: sum(interCompany.map(l => l.totalQty)), unfillableLines: unfillable.length },
      narrative: [
        `Showing ${this.companies.find(c => c.code === co)?.label} only: ${all.length} open invoices worth R ${Math.round(sum(all.map(i => i.value))).toLocaleString()}.`,
        ready.length ? `${ready.length} can be fulfilled today from local stock (R ${Math.round(sum(ready.map(i => i.value))).toLocaleString()}).` : 'Nothing can be fulfilled completely from local stock for this company.',
        unlock.length ? `${unlock.length} more would be unlocked by inter-warehouse movements (R ${Math.round(sum(unlock.map(i => i.value))).toLocaleString()}).` : 'No stock movement would complete an additional invoice for this company.',
        xfer.length ? `${xfer.length} more would be unlocked by inter-company transfers of same-name items (R ${Math.round(sum(xfer.map(i => i.value))).toLocaleString()}).` : 'No inter-company transfer would complete an additional invoice for this company.',
        unfillable.length ? `${unfillable.length} lines cannot be filled from any warehouse or company.` : 'Every open line for this company is covered somewhere in the network.'
      ] };
  });
  wellyFace = computed(() => this.phase() === 'thinking' ? '/welly/thinking.png' : this.phase() === 'error' ? '/welly/error.png' : '/welly/default.png');

  thinkSteps = signal<ThinkStep[]>([]);
  thinkProgress = computed(() => {
    const s = this.thinkSteps();
    if (!s.length) return 0;
    const done = s.filter(x => x.state === 'done').length + (s.some(x => x.state === 'active') ? 0.5 : 0);
    return Math.min(96, Math.round(done / s.length * 100));
  });

  currentWh = computed(() => this.view()?.warehouses.find(w => w.warehouseId === this.selectedWh()) ?? null);
  filteredInvoices = computed(() => {
    const w = this.currentWh();
    if (!w) return [];
    const f = this.statusFilter();
    return w.invoices.filter(i => i.status === f);
  });

  private timers: any[] = [];
  private tick: any;
  private startedAt = 0;

  ngOnInit(): void { this.run(); }
  ngOnDestroy(): void { this.clearTimers(); }

  setDays(d: number) { this.days.set(d); this.run(); }

  run(): void {
    this.clearTimers();
    this.phase.set('thinking');
    this.error.set('');
    this.startedAt = Date.now();
    this.elapsed.set(0);
    this.tick = setInterval(() => this.elapsed.set(Math.round((Date.now() - this.startedAt) / 1000)), 500);

    // Scripted "thinking" that advances while the real analysis runs; the final
    // step only completes when the server answers.
    const script: ThinkStep[] = [
      { icon: 'receipt_long', text: `Reading open invoices from the last ${this.days()} days`, state: 'active' },
      { icon: 'warehouse', text: 'Checking stock on hand in KZN, GP, CPT and PE', state: 'pending' },
      { icon: 'local_shipping', text: 'Counting trucks that are free in each province', state: 'pending' },
      { icon: 'rule', text: 'Matching every invoice line against its home warehouse', state: 'pending' },
      { icon: 'swap_horiz', text: 'Looking for stock in other warehouses that would complete short invoices', state: 'pending' },
      { icon: 'sync_alt', text: 'Checking for the same item under another company\'s code (inter-company transfers)', state: 'pending' },
      { icon: 'auto_awesome', text: 'Writing up suggestions', state: 'pending' },
    ];
    this.thinkSteps.set(script);
    const advance = (i: number) => {
      this.thinkSteps.update(s => s.map((x, idx) => idx < i ? { ...x, state: 'done' } : idx === i ? { ...x, state: 'active' } : x));
    };
    [900, 1900, 2800, 4000, 5000, 6200].forEach((ms, idx) => this.timers.push(setTimeout(() => {
      // never advance past the last step automatically — it waits for the response
      if (this.phase() === 'thinking') advance(idx + 1);
    }, ms)));

    this.http.get<WellyResult>(`${this.apiUrl}/welly/suggestions/fulfilment?days=${this.days()}`).subscribe({
      next: r => {
        // Attach the real server step details to the matching script rows, then finish.
        const details = r.steps.map(s => s.detail);
        this.thinkSteps.update(s => s.map((x, i) => ({ ...x, state: 'done', detail: details[Math.min(i + 1, details.length - 1)] })));
        // Hold the finished checklist for a beat so the user sees it complete.
        const minShow = 2600;
        const wait = Math.max(500, minShow - (Date.now() - this.startedAt));
        this.timers.push(setTimeout(() => {
          this.result.set(r);
          const best = [...r.warehouses].sort((a, b) => b.readyCount - a.readyCount)[0];
          if (best) this.selectedWh.set(best.warehouseId);
          this.statusFilter.set('Ready');
          this.phase.set('ready');
          this.clearTimers();
        }, wait));
      },
      error: e => {
        this.clearTimers();
        this.error.set(e?.error?.message || e?.message || 'Welly could not complete the analysis.');
        this.phase.set('error');
      }
    });
  }

  private clearTimers() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers = [];
    if (this.tick) { clearInterval(this.tick); this.tick = null; }
  }
}
