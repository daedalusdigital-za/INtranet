import { Component, OnInit, DoCheck, OnDestroy, Inject, inject, signal, computed } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd, Params } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { WellyActivityService } from '../../services/welly-activity.service';
import { WellySuggestionsDialogComponent, WellySuggestionsAction, WellyLane, WellyLaneItem } from '../sales/welly-suggestions-dialog.component';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SubNavComponent } from '../../ui/sub-nav/sub-nav.component';
import { isFilterRecord, queryText, recordFilters, toQuery } from '../../ui/sub-pages';
import { STOCK_SECTIONS, StockSlug, stockSection } from './stock-sections';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { StatusChipComponent } from '../../ui/status-chip/status-chip.component';
import { ToastService } from '../../ui/toast.service';
import { ConfirmService } from '../../ui/confirm.service';
import { Warehouse3DComponent } from '../warehouse-3d/warehouse-3d.component';
import { environment } from '../../../environments/environment';
import Chart from 'chart.js/auto';

interface ClientStockSummary {
  client: string;
  items: number;
  itemsInStock: number;
  quantityOnHand: number;
  stockValue: number;
}

interface WarehouseSummary {
  id: number;
  name: string;
  location: string;
  managerName: string;
  totalItems: number;
  totalStockValue: number;
  capacityPercent: number;
  totalCapacity: number;
  availableCapacity: number;
  status: string;
  totalQuantityOnHand: number;
  itemsInStock: number;
  itemsOutOfStock: number;
  pricedItems: number;
  totalCostValue: number;
  lastCountDate?: string;
  byClient: ClientStockSummary[];
}

interface WarehouseInventory {
  id: number;
  warehouseId: number;
  warehouseName: string;
  commodityId: number;
  commodityName: string;
  commodityCode?: string;
  category?: string;
  unitOfMeasure?: string;
  quantityOnHand: number;
  reorderLevel: number;
  maximumLevel: number;
  binLocation: string;
  lastCountDate: string;
  lastRestockDate: string;
  unitPrice?: number;
  unitCost?: number;
  lineValue?: number;
}

interface ChartData {
  labels: string[];
  values: number[];
}

interface StockAnalysisSummary {
  totalSkus: number;
  itemsWithStock: number;
  totalStockValue: number;
  lowStockCount: number;
  totalInvoices: number;
  invoiceValue: number;
  outstandingAmount: number;
  totalLoads: number;
  deliveredLoads: number;
  deliveryRate: number;
}

interface ComprehensiveAnalysisResponse {
  analysis: string;
  charts: {
    stockByBuilding: ChartData;
    topItems: ChartData;
    invoiceStatus: ChartData;
    loadStatus: ChartData;
  };
  summary: StockAnalysisSummary;
}

@Component({
  selector: 'app-stock-management',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatDialogModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressBarModule,
    NavbarComponent,
    PageHeaderComponent,
    SubNavComponent,
    EmptyStateComponent,
    SkeletonRowsComponent,
    StatusChipComponent,
    MatListModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="container">
      <app-page-header [crumbs]="['Operations', 'Stock']" [title]="currentSection()?.label ?? 'Stock'"
                       [subtitle]="selectedWarehouse ? selectedWarehouse.name + ' · ' + selectedWarehouse.location : 'All warehouses'">
        @if (selectedWarehouse) {
          <button mat-stroked-button (click)="whFilterId = null" matTooltip="Show all warehouses">
            <mat-icon>filter_alt_off</mat-icon>Clear filter
          </button>
          <button mat-flat-button color="primary" (click)="wellyAnalyzeStock()" matTooltip="Ask Welly to analyse stock levels">
            <mat-icon>auto_awesome</mat-icon>Ask Welly to analyse
          </button>
        }
        <button mat-stroked-button class="welly-suggest-btn" (click)="openWellySuggestions()"
                matTooltip="Welly checks open invoices against stock on hand: what can be invoiced out now, which internal movements would complete more, and inter-company transfers">
          <mat-icon>lightbulb</mat-icon>Welly suggests
        </button>
        <app-sub-nav tabs [pages]="sections" base="/stock-management" [active]="section()" [queries]="linkQueries()"
                     [counts]="sectionCounts()" [panel]="stockPanel" label="Stock sections"></app-sub-nav>
      </app-page-header>

      <mat-tab-nav-panel #stockPanel>
      @if (loading) {
        <div class="loading-state">
          <div class="loading-card">
            <div class="lc-icon-wrap">
              <mat-icon class="lc-icon pulse-icon">warehouse</mat-icon>
            </div>
            <h3>Loading stock</h3>
            <p class="lc-subtitle">Fetching warehouse inventory and stock data</p>
            <div class="lc-progress-wrap">
              <div class="lc-progress-track">
                <div class="lc-progress-fill" [style.width.%]="loadingProgress"></div>
              </div>
              <div class="lc-progress-info">
                <span class="lc-progress-message">{{ loadingMessage }}</span>
                <span class="lc-progress-pct">{{ loadingProgress | number:'1.0-0' }}%</span>
              </div>
            </div>
            <div class="lc-steps">
              @for (step of loadingSteps; track step.label; let i = $index) {
                <div class="lc-step" [class.active]="loadingStage === i" [class.done]="loadingStage > i">
                  <div class="lc-step-dot">
                    @if (loadingStage > i) {
                      <mat-icon>check</mat-icon>
                    } @else {
                      <mat-icon>{{ step.icon }}</mat-icon>
                    }
                  </div>
                  <span class="lc-step-label">{{ step.label }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      } @else if (warehouses.length === 0) {
        <app-empty-state icon="warehouse" title="No Warehouses Found"
          message="No warehouses have been configured yet."></app-empty-state>
      } @else {

        @if (section() === 'on-hand') {
        <!-- ═══ KPI CARDS ═══ -->
        <div class="stk-kpi-grid">
          <div class="stk-kpi k-indigo">
            <mat-icon>stacked_bar_chart</mat-icon>
            <div class="stk-kpi-val">{{ formatQty(kpiUnits) }}</div>
            <div class="stk-kpi-lbl">Units On Hand</div>
          </div>
          <div class="stk-kpi k-green">
            <mat-icon>payments</mat-icon>
            <div class="stk-kpi-val">{{ formatValue(kpiValue) }}</div>
            <div class="stk-kpi-lbl">Stock Value</div>
          </div>
          <div class="stk-kpi k-teal">
            <mat-icon>account_balance_wallet</mat-icon>
            <div class="stk-kpi-val">{{ formatValue(kpiCost) }}</div>
            <div class="stk-kpi-lbl">Cost Value</div>
          </div>
          <div class="stk-kpi k-emerald">
            <mat-icon>check_circle</mat-icon>
            <div class="stk-kpi-val">{{ kpiIn | number }}</div>
            <div class="stk-kpi-lbl">Items In Stock</div>
          </div>
          <div class="stk-kpi k-red" [class.pulse]="kpiOut > 0">
            <mat-icon>remove_shopping_cart</mat-icon>
            <div class="stk-kpi-val">{{ kpiOut | number }}</div>
            <div class="stk-kpi-lbl">Out of Stock</div>
          </div>
        </div>
        }

        <!-- ═══ WAREHOUSE CARDS (click to filter, Operations to drill in) ═══ -->
        <div class="stk-wh-grid">
          @for (warehouse of warehouses; track warehouse.id) {
            <div class="stk-wh-card" [class.active]="whFilterId === warehouse.id"
                 (click)="toggleWhFilter(warehouse.id)"
                 role="button" tabindex="0" (keydown.enter)="toggleWhFilter(warehouse.id)"
                 [matTooltip]="whFilterId === warehouse.id ? 'Click to clear filter' : 'Click to filter tabs by ' + warehouse.name">
              <div class="stk-wh-head">
                <mat-icon class="stk-wh-ico">warehouse</mat-icon>
                <div class="stk-wh-title">
                  <h3>{{ warehouse.name }}</h3>
                  <span>{{ warehouse.location }}</span>
                </div>
                <button aria-label="View warehouse in 3D with all stock" mat-icon-button class="stk-wh-ops" matTooltip="View warehouse in 3D with all stock"
                        (click)="open3DView(warehouse); $event.stopPropagation()">
                  <mat-icon>visibility</mat-icon>
                </button>
              </div>
              <div class="stk-wh-stats">
                <div><b>{{ warehouse.totalItems | number }}</b><span>Items</span></div>
                <div><b>{{ formatQty(warehouse.totalQuantityOnHand) }}</b><span>Units</span></div>
                <div><b>{{ formatValue(warehouse.totalStockValue) }}</b><span>Value</span></div>
                <div><b>{{ warehouse.itemsInStock | number }}<i class="out-sub">/{{ warehouse.itemsOutOfStock }}</i></b><span>In / Out</span></div>
              </div>
              @if (warehouse.byClient && warehouse.byClient.length > 0) {
                <div class="client-chips">
                  @for (c of warehouse.byClient.slice(0, 4); track c.client) {
                    <span class="client-chip" [matTooltip]="c.items + ' items \u00b7 ' + formatQty(c.quantityOnHand) + ' units \u00b7 ' + formatValue(c.stockValue)">
                      {{ c.client }} <b>{{ formatQty(c.quantityOnHand) }}</b>
                    </span>
                  }
                </div>
              }
              @if (warehouse.lastCountDate) {
                <div class="stock-asat">
                  <mat-icon>event_available</mat-icon>
                  Stock as at {{ warehouse.lastCountDate | date:'dd MMM yyyy' }}
                </div>
              }
            </div>
          }
        </div>

        <!-- ═══ COMPANY FILTER ═══ -->
        <div class="sh-company-bar">
          <button class="sh-company-chip" [class.active]="companyFilter === ''" (click)="companyFilter = ''">
            <mat-icon>apps</mat-icon> All Companies
          </button>
          @for (c of stockCompanies; track c.key) {
            <button class="sh-company-chip" [class.sh-company-chip--logo]="!!c.logo" [class.active]="companyFilter === c.key"
                    [style.--chip-color]="c.color"
                    (click)="companyFilter = companyFilter === c.key ? '' : c.key">
              @if (c.logo) {
                <img class="sh-chip-logo" [src]="c.logo" [alt]="c.shortName" width="32" height="32" decoding="async" loading="lazy" />
              } @else {
                <mat-icon>business</mat-icon>
              }
              <span class="sh-chip-label">{{ c.shortName }}</span>
            </button>
          }
        </div>

        <!-- ═══ CURRENT SUB-PAGE ═══ -->
        <div class="stk-tabs">
        @switch (section()) {

          <!-- STOCK ON HAND -->
          @case ('on-hand') {
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <mat-form-field appearance="outline" class="stk-search">
                  <mat-label>Search code, description or company</mat-label>
                  <input matInput [(ngModel)]="sohSearch" placeholder="e.g. 3009602">
                  <mat-icon matPrefix>search</mat-icon>
                </mat-form-field>
                <span class="stk-count">{{ sohRows.length | number }} of {{ invScoped.length | number }} items{{ whFilterName }}</span>
                <span class="stk-spacer"></span>
                <button mat-stroked-button (click)="loadDashboardData()" matTooltip="Reload stock data"><mat-icon>refresh</mat-icon> Refresh</button>
                <button mat-stroked-button (click)="exportSoh()"><mat-icon>file_download</mat-icon> Export</button>
                <button mat-stroked-button (click)="openTransferStock()" matTooltip="Move stock from one warehouse to another"><mat-icon>sync_alt</mat-icon> Transfer</button>
                <button mat-stroked-button (click)="openManualMovement('Adjustment')" matTooltip="Correct a quantity (+/-) with a reason"><mat-icon>tune</mat-icon> Adjust</button>
                <button mat-raised-button color="primary" (click)="openManualMovement('Receive')" matTooltip="Book in a delivery (GRV)"><mat-icon>south_west</mat-icon> Receive Stock</button>
              </div>
              @if (invLoading) { <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows> }
              @else {
                <div class="stk-table-wrap">
                  <table class="app-table stk-table">
                    <thead><tr>
                      <th>Code</th><th>Description</th><th>Company</th><th>Warehouse</th><th>UOM</th>
                      <th class="num">Qty On Hand</th><th class="num">Unit Price</th><th class="num">Value</th><th>Status</th>
                    </tr></thead>
                    <tbody>
                      @for (r of sohRows.slice(0, 400); track r.id) {
                        <tr>
                          <td class="ref" [class.code-inv]="invMatched(r.commodityCode)" [matTooltip]="invMatched(r.commodityCode) ? 'Code found on sales invoices' : ''">{{ r.commodityCode }}</td>
                          <td class="desc">{{ r.commodityName }}</td>
                          <td><span class="stk-chip">{{ r.category || '—' }}</span></td>
                          <td>{{ r.warehouseName }}</td>
                          <td>{{ r.unitOfMeasure || 'Each' }}</td>
                          <td class="num"><b>{{ r.quantityOnHand | number }}</b></td>
                          <td class="num">{{ r.unitPrice ? ('R' + (r.unitPrice | number:'1.2-2')) : '—' }}</td>
                          <td class="num">{{ r.lineValue ? ('R' + (r.lineValue | number:'1.0-0')) : '—' }}</td>
                          <td><app-status-chip [status]="r.quantityOnHand > 0 ? 'In stock' : (r.quantityOnHand < 0 ? 'Negative' : 'Out of stock')"
                                [tone]="r.quantityOnHand > 0 ? 'ok' : 'danger'"></app-status-chip></td>
                        </tr>
                      } @empty { <tr><td colspan="9"><app-empty-state compact icon="inventory_2" title="No stock items found" [message]="sohSearch || companyFilter || whFilterId ? 'Nothing matches the current search or filters.' : 'No stock has been recorded yet.'">
                  @if (sohSearch || companyFilter || whFilterId) { <button mat-stroked-button (click)="sohSearch = ''; companyFilter = ''; whFilterId = null">Clear the filters</button> }
                </app-empty-state></td></tr> }
                    </tbody>
                  </table>
                  @if (sohRows.length > 400) { <div class="stk-more">Showing first 400 — refine your search to narrow down ({{ sohRows.length | number }} matches)</div> }
                </div>
              }
            </div>
          }

          <!-- STOCK COUNTS -->
          @case ('counts') {
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <span class="stk-count">Latest counts per warehouse{{ companyFilter ? ' · ' + companyFilter : '' }}{{ whFilterName }}</span>
                <span class="stk-spacer"></span>
                <button mat-stroked-button (click)="exportValuation()"><mat-icon>file_download</mat-icon> Export</button>
                <button mat-stroked-button (click)="requestApplyInvoicePrices()"
                        matTooltip="Fill in missing unit prices from sales invoices — average price per matched (green) code (PIN required)">
                  <mat-icon>receipt_long</mat-icon> Apply Invoice Prices</button>
                <button mat-stroked-button (click)="downloadCountTemplate()"
                        [matTooltip]="whFilterId ? 'Download a count sheet with every item at ' + whFilterName : 'Select a warehouse card above first'">
                  <mat-icon>description</mat-icon> Count Template</button>
                <button mat-stroked-button (click)="requestCountImport(countFile)"
                        [matTooltip]="whFilterId ? 'Import a completed count sheet for ' + whFilterName + ' (PIN required)' : 'Select a warehouse card above first'">
                  <mat-icon>lock</mat-icon> Import Count</button>
                <input #countFile type="file" accept=".xlsx,.xls,.csv" hidden (change)="onCountFileSelected($event)">
                <button mat-raised-button color="primary" (click)="openStockTakeForFilter()"
                        [matTooltip]="whFilterId ? 'New stock take at ' + whFilterName : 'Select a warehouse card above first'">
                  <mat-icon>fact_check</mat-icon> New Stock Take</button>
              </div>
              <div class="stk-table-wrap">
                <table class="app-table stk-table">
                  <thead><tr>
                    <th>Warehouse</th><th class="num">Items Counted</th><th class="num">Units</th><th class="num">Value</th>
                    <th class="num">In Stock</th><th class="num">Out of Stock</th><th>Last Count</th><th>Companies</th>
                  </tr></thead>
                  <tbody>
                    @for (w of countRows; track w.id) {
                      <tr>
                        <td><a class="stk-link" (click)="openWarehouseSheet(w, companyFilter)" matTooltip="View all stock on hand at this warehouse"><b>{{ w.name }}</b></a></td>
                        <td class="num">{{ w.totalItems | number }}</td>
                        <td class="num">{{ w.totalQuantityOnHand | number }}</td>
                        <td class="num">{{ formatValue(w.totalStockValue) }}</td>
                        <td class="num">{{ w.itemsInStock | number }}</td>
                        <td class="num" [style.color]="w.itemsOutOfStock > 0 ? 'var(--color-danger)' : ''">{{ w.itemsOutOfStock | number }}</td>
                        <td>{{ w.lastCountDate ? (w.lastCountDate | date:'dd MMM yyyy') : '—' }}</td>
                        <td>
                          @for (c of w.byClient; track c.client) {
                            <button type="button" class="stk-chip stk-chip-btn" style="margin-right:4px;" (click)="openWarehouseSheet(w, c.client)"
                                    [matTooltip]="'View ' + c.client + ' stock on hand at ' + w.name">{{ c.client }} {{ c.items }}</button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="stk-note"><mat-icon>info</mat-icon> Click a <b>warehouse name</b> or a <b>company chip</b> to open a datasheet of the stock on hand there. Baseline quantities come from the consolidated stock imports; every count variance you post is written to the Movements ledger as an Adjustment. Click a warehouse card, then <b>New Stock Take</b> to count on screen — or download the <b>Count Template</b> (one sheet per warehouse, all companies, fill in <i>Counted Qty</i> only) and <b>Import Count</b> to load it for review before posting.</p>
            </div>
          }

          <!-- ISSUES -->
          @case ('issues') {
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <button mat-stroked-button [class.stk-filter-on]="issueStatusFilter === 'Open'" (click)="issueStatusFilter = issueStatusFilter === 'Open' ? '' : 'Open'">
                  <mat-icon>error_outline</mat-icon> Open ({{ issueCountByStatus('Open') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="issueStatusFilter === 'InProgress'" (click)="issueStatusFilter = issueStatusFilter === 'InProgress' ? '' : 'InProgress'">
                  <mat-icon>pending</mat-icon> In Progress ({{ issueCountByStatus('InProgress') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="issueStatusFilter === 'Resolved'" (click)="issueStatusFilter = issueStatusFilter === 'Resolved' ? '' : 'Resolved'">
                  <mat-icon>task_alt</mat-icon> Resolved ({{ issueCountByStatus('Resolved') }})</button>
                <mat-form-field appearance="outline" class="stk-search">
                  <mat-label>Search code, description or issue</mat-label>
                  <input matInput [(ngModel)]="issueSearch">
                  <mat-icon matPrefix>search</mat-icon>
                </mat-form-field>
                <span class="stk-spacer"></span>
                <button mat-stroked-button (click)="loadIssues()" matTooltip="Reload issues"><mat-icon>refresh</mat-icon> Refresh</button>
                <button mat-stroked-button (click)="exportIssues()"><mat-icon>file_download</mat-icon> Export</button>
                <button mat-raised-button color="primary" (click)="openCreateIssue()"><mat-icon>add</mat-icon> New Issue</button>
              </div>
              @if (issuesLoading) { <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows> }
              @else {
                <div class="stk-table-wrap">
                  <table class="app-table stk-table">
                    <thead><tr>
                      <th>Date</th><th>Warehouse</th><th>Company</th><th>Code</th><th>Description</th><th>Issue</th><th>Detail</th><th>Status</th><th style="text-align:right;">Actions</th>
                    </tr></thead>
                    <tbody>
                      @for (i of issueRows.slice(0, 400); track i.id) {
                        <tr [class.stk-row-resolved]="i.status === 'Resolved' || i.status === 'Dismissed'">
                          <td>{{ i.issueDate ? (i.issueDate | date:'dd MMM') : '—' }}</td>
                          <td>{{ i.warehouseName || '—' }}</td>
                          <td><span class="stk-chip">{{ i.company || '—' }}</span></td>
                          <td class="ref">{{ i.itemCode || '—' }}</td>
                          <td class="desc">{{ i.itemDescription }}</td>
                          <td><b>{{ i.issueType }}</b></td>
                          <td class="desc" [matTooltip]="i.detail">{{ i.detail }}</td>
                          <td><app-status-chip [status]="i.status" [tone]="i.status === 'Open' ? 'danger' : (i.status === 'InProgress' ? 'warn' : (i.status === 'Resolved' ? 'ok' : 'neutral'))"></app-status-chip>
                            @if (i.resolution) { <div class="stk-resolution" [matTooltip]="'By ' + (i.resolvedBy || '?')">{{ i.resolution }}</div> }
                          </td>
                          <td style="text-align:right;white-space:nowrap;">
                            @if (i.status === 'Open') {
                              <button aria-label="Start working on this" mat-icon-button matTooltip="Start working on this" (click)="setIssueStatus(i, 'InProgress')"><mat-icon>play_circle</mat-icon></button>
                            }
                            @if (i.status === 'Open' || i.status === 'InProgress') {
                              <button aria-label="Resolve" mat-icon-button matTooltip="Resolve" style="color:var(--color-ok);" (click)="openResolveIssue(i, 'Resolved')"><mat-icon>task_alt</mat-icon></button>
                              <button aria-label="Dismiss (not an issue)" mat-icon-button matTooltip="Dismiss (not an issue)" (click)="openResolveIssue(i, 'Dismissed')"><mat-icon>block</mat-icon></button>
                            }
                            @if (i.status === 'Resolved' || i.status === 'Dismissed') {
                              <button aria-label="Reopen" mat-icon-button matTooltip="Reopen" (click)="setIssueStatus(i, 'Open')"><mat-icon>restart_alt</mat-icon></button>
                            }
                          </td>
                        </tr>
                      } @empty { <tr><td colspan="9"><app-empty-state compact icon="task_alt" title="No issues found{{ whFilterName }}" [message]="issueStatusFilter || issueSearch || companyFilter || whFilterId ? 'No issue matches the current filters.' : 'Nothing needs attention right now.'">
                  @if (issueStatusFilter || issueSearch || companyFilter || whFilterId) { <button mat-stroked-button (click)="issueStatusFilter = ''; issueSearch = ''; companyFilter = ''; whFilterId = null">Clear the filters</button> }
                </app-empty-state></td></tr> }
                    </tbody>
                  </table>
                  @if (issueRows.length > 400) { <div class="stk-more">Showing first 400 of {{ issueRows.length | number }} issues</div> }
                </div>
              }
            </div>
          }

          <!-- EXCEPTIONS -->
          @case ('exceptions') {
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <button mat-stroked-button [class.stk-filter-on]="excMode === 'out'" (click)="excMode = 'out'">
                  <mat-icon>remove_shopping_cart</mat-icon> Out of Stock ({{ excCount('out') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="excMode === 'neg'" (click)="excMode = 'neg'">
                  <mat-icon>error</mat-icon> Negative ({{ excCount('neg') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="excMode === 'unpriced'" (click)="excMode = 'unpriced'">
                  <mat-icon>money_off</mat-icon> Unpriced with Stock ({{ excCount('unpriced') }})</button>
                <span class="stk-spacer"></span>
                <button mat-stroked-button (click)="exportExceptions()"><mat-icon>file_download</mat-icon> Export</button>
              </div>
              <div class="stk-table-wrap">
                <table class="app-table stk-table">
                  <thead><tr><th>Code</th><th>Description</th><th>Company</th><th>Warehouse</th><th class="num">Qty</th><th>Issue</th></tr></thead>
                  <tbody>
                    @for (r of exceptionRows.slice(0, 400); track r.id) {
                      <tr>
                        <td class="ref" [class.code-inv]="invMatched(r.commodityCode)" [matTooltip]="invMatched(r.commodityCode) ? 'Code found on sales invoices' : ''">{{ r.commodityCode }}</td>
                        <td class="desc">{{ r.commodityName }}</td>
                        <td><span class="stk-chip">{{ r.category || '—' }}</span></td>
                        <td>{{ r.warehouseName }}</td>
                        <td class="num"><b>{{ r.quantityOnHand | number }}</b></td>
                        <td><app-status-chip [status]="excMode === 'out' ? 'Out of stock' : (excMode === 'neg' ? 'Negative stock' : 'No sales price')"
                               [tone]="excMode === 'unpriced' ? 'warn' : 'danger'"></app-status-chip></td>
                      </tr>
                    } @empty { <tr><td colspan="6"><app-empty-state compact icon="task_alt" title="No exceptions" message="Nothing to flag in this view."></app-empty-state></td></tr> }
                  </tbody>
                </table>
              </div>
            </div>
          }

          <!-- MOVEMENTS -->
          @case ('movements') {
            <div class="stk-tab-body">

              <!-- What needs doing first: approvals live in Dispatch, so point there -->
              @if (pendingDispatchCount > 0) {
                <div class="mv-alert" [class.mv-alert-red]="deliveredNotDeductedCount > 0">
                  <mat-icon>{{ deliveredNotDeductedCount > 0 ? 'report' : 'pending_actions' }}</mat-icon>
                  <div class="mv-alert-text">
                    @if (deliveredNotDeductedCount > 0) {
                      <b>{{ deliveredNotDeductedCount | number }} delivered {{ deliveredNotDeductedCount === 1 ? 'load has' : 'loads have' }} not had stock deducted yet.</b>
                      <span>Stock on hand is too high until {{ deliveredNotDeductedCount === 1 ? 'it is' : 'they are' }} approved.
                        @if (pendingDispatchCount > deliveredNotDeductedCount) { {{ pendingDispatchCount - deliveredNotDeductedCount | number }} more {{ pendingDispatchCount - deliveredNotDeductedCount === 1 ? 'load is' : 'loads are' }} on the way. }</span>
                    } @else {
                      <b>{{ pendingDispatchCount | number }} {{ pendingDispatchCount === 1 ? 'load is' : 'loads are' }} waiting for stock to be deducted.</b>
                      <span>Check each picking slip and approve it in Dispatch.</span>
                    }
                  </div>
                  <span class="stk-spacer"></span>
                  @if (canApprove) {
                    <button mat-stroked-button (click)="requestBackfillStockLines()"
                            matTooltip="Give older loads their missing stock lines and link unlinked lines by product code (PIN required)">
                      <mat-icon>link</mat-icon> Link stock lines</button>
                  }
                  <button mat-flat-button color="primary" (click)="goToApprovals()">Review in Dispatch <mat-icon iconPositionEnd>arrow_forward</mat-icon></button>
                </div>
              }

              <div class="mv-head">
                <p class="mv-intro">Every change to stock on hand, newest first. Rows are never edited: to undo one, reverse it.</p>
                <span class="stk-spacer"></span>
                <button mat-icon-button (click)="loadLedger()" matTooltip="Reload movements" aria-label="Reload movements"><mat-icon>refresh</mat-icon></button>
                <button mat-icon-button (click)="exportMovements()" matTooltip="Export this view to Excel" aria-label="Export this view to Excel"><mat-icon>file_download</mat-icon></button>
                <button mat-stroked-button class="welly-suggest-btn" (click)="openWellySuggestions()" matTooltip="Which transfers between warehouses would complete open invoices"><mat-icon>lightbulb</mat-icon> Welly suggests</button>
                <button mat-flat-button color="primary" [matMenuTriggerFor]="recordMenu"><mat-icon>add</mat-icon> Record a movement</button>
                <mat-menu #recordMenu="matMenu" class="mv-menu">
                  <button mat-menu-item (click)="openManualMovement('Receive')"><mat-icon>south_west</mat-icon>
                    <span class="mv-menu-item"><b>Receive stock</b><small>Goods arriving from a supplier</small></span></button>
                  <button mat-menu-item (click)="openManualMovement('Return')"><mat-icon>keyboard_return</mat-icon>
                    <span class="mv-menu-item"><b>Customer return</b><small>Goods coming back from a customer</small></span></button>
                  <button mat-menu-item (click)="openTransferStock()"><mat-icon>sync_alt</mat-icon>
                    <span class="mv-menu-item"><b>Transfer</b><small>Move stock from one warehouse to another</small></span></button>
                  <button mat-menu-item (click)="openManualMovement('Adjustment')"><mat-icon>tune</mat-icon>
                    <span class="mv-menu-item"><b>Adjust quantity</b><small>Correct a quantity up or down, with a reason</small></span></button>
                  <button mat-menu-item (click)="openManualMovement('Scrap')"><mat-icon>delete_sweep</mat-icon>
                    <span class="mv-menu-item"><b>Write off</b><small>Damaged or expired stock leaving the books</small></span></button>
                </mat-menu>
              </div>

              <div class="mv-filters">
                <div class="mv-seg" role="group" aria-label="Movement type">
                  @for (k of movKinds; track k.key) {
                    <button type="button" [class.on]="movTypeFilter === k.key" (click)="movTypeFilter = k.key" [matTooltip]="k.hint">
                      <mat-icon>{{ k.icon }}</mat-icon>{{ k.label }}<span class="mv-n">{{ movKindCount(k.key) | number }}</span>
                    </button>
                  }
                </div>
                <mat-form-field appearance="outline" class="stk-search">
                  <mat-icon matPrefix>search</mat-icon>
                  <input matInput [(ngModel)]="movSearch" placeholder="Code, item, load, reason, person...">
                </mat-form-field>
                <span class="stk-spacer"></span>
                @if (ledgerRows.length) {
                  <span class="mv-sum">In <b class="mv-pos">+{{ formatQty(movViewIn) }}</b> · Out <b class="mv-neg">−{{ formatQty(movViewOut) }}</b></span>
                }
              </div>

              @if (ledgerLoading) { <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows> }
              @else {
                <div class="stk-table-wrap">
                  <table class="app-table stk-table mv-table">
                    <thead><tr><th>When</th><th>What happened</th><th>Item</th><th>Warehouse</th>
                      <th class="num">Change</th><th class="num">Balance after</th><th>Why</th><th>By</th><th></th></tr></thead>
                    <tbody>
                      @for (m of ledgerRows; track m.id) {
                        <tr [class.mv-reversed]="m.reversedByMovementId">
                          <td class="mv-when">{{ m.createdAt | date:'dd MMM yyyy' }}<small>{{ m.createdAt | date:'HH:mm' }}</small></td>
                          <td>
                            <span class="mv-kind" [ngClass]="'mv-k-' + movKindOf(m)"><mat-icon>{{ movIcon(m) }}</mat-icon>{{ movLabel(m) }}</span>
                            @if (m.reversedByMovementId) { <span class="stk-chip" matTooltip="Undone by movement #{{ m.reversedByMovementId }}">Reversed</span> }
                            @if (m.reversesMovementId) { <span class="mv-sub">undoes #{{ m.reversesMovementId }}</span> }
                          </td>
                          <td><span class="ref">{{ m.commodityCode }}</span><span class="mv-sub">{{ m.commodityName }}</span></td>
                          <td>{{ m.warehouseName }}</td>
                          <td class="num"><b class="mv-change" [class.mv-pos]="m.quantity > 0" [class.mv-neg]="m.quantity < 0">{{ m.quantity > 0 ? '+' : (m.quantity < 0 ? '−' : '') }}{{ abs(m.quantity) | number }}</b></td>
                          <td class="num" [class.mv-neg]="m.balanceAfter < 0">{{ m.balanceAfter | number }}</td>
                          <td class="mv-why">
                            @if (m.loadId) {
                              <button class="mv-link" type="button" (click)="openLedgerLoadDoc(m)" matTooltip="Open this load's picking slip">{{ m.reference || ('Load #' + m.loadId) }}</button>
                            } @else if (m.reference) { <span class="mv-ref">{{ m.reference }}</span> }
                            @if (m.reason) { <span class="mv-reason" [matTooltip]="m.reason">{{ m.reason }}</span> }
                          </td>
                          <td>{{ m.createdBy }}</td>
                          <td class="mv-act">
                            @if (canApprove && !m.reversedByMovementId && m.movementType !== 'Reversal') {
                              <button aria-label="Undo this movement" mat-icon-button matTooltip="Undo this movement (posts the opposite change)" (click)="reverseMovement(m)"><mat-icon>undo</mat-icon></button>
                            }
                          </td>
                        </tr>
                      } @empty { <tr><td colspan="9"><app-empty-state compact icon="swap_horiz" title="No stock movements" [message]="movSearch || movTypeFilter ? 'Nothing matches the current search or filter.' : 'Receive stock or approve a dispatch and it will show here.'">
                  @if (movSearch || movTypeFilter) { <button mat-stroked-button (click)="movSearch = ''; movTypeFilter = ''">Clear the filters</button> }
                </app-empty-state></td></tr> }
                    </tbody>
                  </table>
                </div>
                @if (ledger.length >= 500) { <p class="stk-note"><mat-icon>info</mat-icon> Showing the latest 500 movements. Use search or a warehouse to narrow it down.</p> }
              }
            </div>
          }

          <!-- DISPATCH -->
          @case ('dispatch') {
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <button mat-stroked-button [class.stk-filter-on]="dispatchMode === 'tripsheets'" (click)="dispatchMode = 'tripsheets'">
                  <mat-icon>receipt_long</mat-icon> Tripsheets ({{ loadsScoped.length }})</button>
                <button mat-stroked-button [class.stk-filter-on]="dispatchMode === 'picking'" (click)="dispatchMode = 'picking'">
                  <mat-icon>checklist</mat-icon> Picking Slips ({{ loadsScoped.length }})</button>
                <button mat-stroked-button [class.stk-filter-on]="dispatchMode === 'invoices'" (click)="dispatchMode = 'invoices'">
                  <mat-icon>description</mat-icon> Invoices ({{ dispatchInvoiceRows.length }})</button>
                <span class="stk-sep"></span>
                <button mat-stroked-button [class.stk-filter-on]="dispatchDeductFilter === 'pending'" (click)="dispatchDeductFilter = dispatchDeductFilter === 'pending' ? '' : 'pending'" matTooltip="Loads whose stock still needs to come off: delivered ones first">
                  <mat-icon>pending_actions</mat-icon> Awaiting approval ({{ dispatchCount('pending') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="dispatchDeductFilter === 'done'" (click)="dispatchDeductFilter = dispatchDeductFilter === 'done' ? '' : 'done'">
                  <mat-icon>inventory</mat-icon> Deducted ({{ dispatchCount('done') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="dispatchDeductFilter === 'baseline'" (click)="dispatchDeductFilter = dispatchDeductFilter === 'baseline' ? '' : 'baseline'" matTooltip="Loads that left before their items were counted: the count already took them off, so they can't be approved again">
                  <mat-icon>history</mat-icon> Already counted ({{ dispatchCount('baseline') }})</button>
                <mat-form-field appearance="outline" class="stk-search">
                  <mat-icon matPrefix>search</mat-icon>
                  <input matInput [(ngModel)]="dispatchSearch" placeholder="Load #, customer, driver, invoice...">
                </mat-form-field>
                <span class="stk-spacer"></span>
                @if (canApprove) {
                  <button mat-stroked-button (click)="requestBackfillStockLines()"
                          matTooltip="Give older loads their missing stock lines and link unlinked lines by product code (PIN required)">
                    <mat-icon>link</mat-icon> Link stock lines</button>
                }
                <button mat-stroked-button (click)="loadDashboardData()" matTooltip="Reload"><mat-icon>refresh</mat-icon> Refresh</button>
                <button mat-stroked-button (click)="exportDispatch()"><mat-icon>file_download</mat-icon> Export</button>
              </div>

              <!-- TRIPSHEETS / PICKING SLIPS -->
              @if (dispatchMode === 'tripsheets' || dispatchMode === 'picking') {
                @if (loadsLoading) { <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows> }
                @else {
                  <div class="stk-table-wrap">
                    <table class="app-table stk-table">
                      <thead><tr>
                        <th>Load #</th><th>Warehouse</th><th>Customer</th><th>Driver</th><th>Vehicle</th>
                        <th class="num">Stops</th><th>Status</th><th>Delivery</th><th>POD</th><th>Stock</th><th style="text-align:right;">Actions</th>
                      </tr></thead>
                      <tbody>
                        @for (l of dispatchRows.slice(0, 500); track l.id) {
                          <tr>
                            <td class="ref">{{ l.loadNumber }}</td>
                            <td>{{ l.warehouseName || '—' }}</td>
                            <td class="desc">{{ l.customerName || '—' }}</td>
                            <td>{{ l.driverName || '—' }}</td>
                            <td>{{ l.vehicleRegistration || '—' }}</td>
                            <td class="num"><b>{{ l.stops?.length || 0 }}</b></td>
                            <td><app-status-chip [status]="l.status"
                                 [tone]="l.status === 'Delivered' || l.status === 'Completed' ? 'ok' : (l.status === 'InTransit' || l.status === 'Pending' || l.status === 'Assigned' ? 'warn' : 'neutral')"></app-status-chip></td>
                            <td>{{ (l.actualDeliveryDate || l.scheduledDeliveryDate) ? ((l.actualDeliveryDate || l.scheduledDeliveryDate) | date:'dd MMM yyyy') : '—' }}</td>
                            <td>@if (l.hasPOD) { <mat-icon style="color:var(--color-ok);font-size:var(--text-xl);width:18px;height:18px;" matTooltip="POD on file">verified</mat-icon> } @else { — }</td>
                            <td>
                              @switch (loadStockState(l)) {
                                @case ('deducted') { <app-status-chip status="Deducted" tone="ok"></app-status-chip> }
                                @case ('baseline') { <span class="stk-chip" matTooltip="Left before its items were counted, so the count already took it off">Already counted</span> }
                                @default { <app-status-chip status="Awaiting" tone="warn"></app-status-chip> }
                              }
                            </td>
                            <td style="text-align:right;white-space:nowrap;">
                              @if (loadStockState(l) === 'awaiting' && canApprove) {
                                <button aria-label="Review picking slip & approve dispatch (deducts stock)" mat-icon-button matTooltip="Review picking slip & approve dispatch (deducts stock)" style="color:var(--color-warn);"
                                        (click)="openApproveDispatch(l)"><mat-icon>fact_check</mat-icon></button>
                              }
                              @if (dispatchMode === 'tripsheets') {
                                <button aria-label="View trip sheet" mat-icon-button matTooltip="View trip sheet" (click)="openLoadDoc(l, 'tripsheet')"><mat-icon>receipt_long</mat-icon></button>
                              }
                              <button aria-label="View picking slip" mat-icon-button matTooltip="View picking slip" (click)="openLoadDoc(l, 'picking')"><mat-icon>checklist</mat-icon></button>
                            </td>
                          </tr>
                        } @empty { <tr><td colspan="11"><app-empty-state compact icon="local_shipping" title="No tripsheets found{{ whFilterName }}" [message]="dispatchSearch || dispatchDeductFilter ? 'Nothing matches the current search or filter.' : 'Tripsheets will be listed here once they are created.'">
                  @if (dispatchSearch || dispatchDeductFilter) { <button mat-stroked-button (click)="dispatchSearch = ''; dispatchDeductFilter = ''">Clear the filters</button> }
                </app-empty-state></td></tr> }
                      </tbody>
                    </table>
                    @if (dispatchRows.length > 500) { <div class="stk-more">Showing first 500 of {{ dispatchRows.length | number }} tripsheets — refine your search</div> }
                  </div>
                }
              }

              <!-- INVOICES -->
              @if (dispatchMode === 'invoices') {
                @if (loadsLoading) { <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows> }
                @else {
                  <div class="stk-table-wrap">
                    <table class="app-table stk-table">
                      <thead><tr>
                        <th>Invoice #</th><th>Order #</th><th>Customer / Stop</th><th>Load #</th><th>Warehouse</th><th>Status</th><th>Stock</th><th>Delivery</th><th style="text-align:right;">Actions</th>
                      </tr></thead>
                      <tbody>
                        @for (r of dispatchInvoiceRows.slice(0, 500); track $index) {
                          <tr>
                            <td class="ref">{{ r.invoiceNumber }}</td>
                            <td class="ref">{{ r.orderNumber || '—' }}</td>
                            <td class="desc">{{ r.customerName }}</td>
                            <td class="ref">{{ r.loadNumber }}</td>
                            <td>{{ r.warehouseName || '—' }}</td>
                            <td><app-status-chip [status]="r.status"
                                 [tone]="r.status === 'Delivered' || r.status === 'Completed' ? 'ok' : (r.status === 'InTransit' || r.status === 'Pending' || r.status === 'Assigned' ? 'warn' : 'neutral')"></app-status-chip></td>
                            <td><app-status-chip [status]="r.deducted ? 'Deducted' : 'Awaiting'" [tone]="r.deducted ? 'ok' : 'warn'"></app-status-chip></td>
                            <td>{{ r.deliveryDate ? (r.deliveryDate | date:'dd MMM yyyy') : '—' }}</td>
                            <td style="text-align:right;white-space:nowrap;">
                              @if (!r.deducted && canApprove) {
                                <button aria-label="Review & approve dispatch" mat-icon-button matTooltip="Review & approve dispatch" style="color:var(--color-warn);" (click)="openApproveDispatch(r.load)"><mat-icon>fact_check</mat-icon></button>
                              }
                              <button aria-label="View trip sheet" mat-icon-button matTooltip="View trip sheet" (click)="openLoadDoc(r.load, 'tripsheet')"><mat-icon>receipt_long</mat-icon></button>
                            </td>
                          </tr>
                        } @empty { <tr><td colspan="9"><app-empty-state compact icon="description" title="No invoices found on tripsheets{{ whFilterName }}" [message]="dispatchSearch || dispatchDeductFilter ? 'Nothing matches the current search or filter.' : 'Invoices will be listed here once they are on a tripsheet.'">
                  @if (dispatchSearch || dispatchDeductFilter) { <button mat-stroked-button (click)="dispatchSearch = ''; dispatchDeductFilter = ''">Clear the filters</button> }
                </app-empty-state></td></tr> }
                      </tbody>
                    </table>
                    @if (dispatchInvoiceRows.length > 500) { <div class="stk-more">Showing first 500 of {{ dispatchInvoiceRows.length | number }} invoices</div> }
                  </div>
                }
              }
            </div>
          }

          <!-- REPORTS -->
          @case ('reports') {
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <button mat-stroked-button [class.stk-filter-on]="reportMode === 'valuation'" (click)="reportMode = 'valuation'">
                  <mat-icon>payments</mat-icon> Valuation by Company</button>
                <button mat-stroked-button [class.stk-filter-on]="reportMode === 'activity'" (click)="reportMode = 'activity'">
                  <mat-icon>swap_horiz</mat-icon> Movement Activity</button>
                <button mat-stroked-button [class.stk-filter-on]="reportMode === 'dispatch'" (click)="reportMode = 'dispatch'">
                  <mat-icon>local_shipping</mat-icon> Dispatch Compliance</button>
                <button mat-stroked-button [class.stk-filter-on]="reportMode === 'exceptions'" (click)="reportMode = 'exceptions'">
                  <mat-icon>report_problem</mat-icon> Exceptions</button>
                <span class="stk-sep"></span>
                @if (reportMode === 'activity') {
                  <button mat-stroked-button [class.stk-filter-on]="reportDays === 7" (click)="reportDays = 7">7d</button>
                  <button mat-stroked-button [class.stk-filter-on]="reportDays === 30" (click)="reportDays = 30">30d</button>
                  <button mat-stroked-button [class.stk-filter-on]="reportDays === 90" (click)="reportDays = 90">90d</button>
                  <button mat-stroked-button [class.stk-filter-on]="reportDays === 0" (click)="reportDays = 0">All</button>
                }
                <span class="stk-spacer"></span>
                <button mat-stroked-button (click)="exportReport()"><mat-icon>file_download</mat-icon> Export Excel</button>
              </div>

              <!-- Valuation by company × warehouse -->
              @if (reportMode === 'valuation') {
                <div class="stk-table-wrap">
                  <table class="app-table stk-table">
                    <thead><tr><th>Company</th><th>Warehouse</th><th class="num">Items</th><th class="num">In Stock</th><th class="num">Out</th><th class="num">Units</th><th class="num">Sales Value</th><th class="num">Cost Value</th></tr></thead>
                    <tbody>
                      @for (r of valuationReport; track r.key) {
                        <tr [class.stk-row-total]="r.isTotal">
                          <td><b>{{ r.company }}</b></td>
                          <td>{{ r.warehouse }}</td>
                          <td class="num">{{ r.items | number }}</td>
                          <td class="num">{{ r.inStock | number }}</td>
                          <td class="num" [style.color]="r.out > 0 ? 'var(--color-danger)' : ''">{{ r.out | number }}</td>
                          <td class="num">{{ formatQty(r.units) }}</td>
                          <td class="num"><b>{{ formatValue(r.value) }}</b></td>
                          <td class="num">{{ formatValue(r.cost) }}</td>
                        </tr>
                      } @empty { <tr><td colspan="8"><app-empty-state compact icon="inventory_2" title="No stock data" message="No stock has been recorded yet."></app-empty-state></td></tr> }
                    </tbody>
                  </table>
                </div>
                <p class="stk-note"><mat-icon>info</mat-icon> Sales value uses the latest invoiced unit price per item; cost value uses the item cost where captured.</p>
              }

              <!-- Movement activity by type × warehouse -->
              @if (reportMode === 'activity') {
                <div class="stk-table-wrap">
                  <table class="app-table stk-table">
                    <thead><tr><th>Warehouse</th><th>Type</th><th class="num">Movements</th><th class="num">Units In</th><th class="num">Units Out</th><th class="num">Net</th><th>Last</th></tr></thead>
                    <tbody>
                      @for (r of activityReport; track r.key) {
                        <tr [class.stk-row-total]="r.isTotal">
                          <td><b>{{ r.warehouse }}</b></td>
                          <td>{{ r.type }}</td>
                          <td class="num">{{ r.count | number }}</td>
                          <td class="num" style="color:var(--color-ok);">+{{ formatQty(r.unitsIn) }}</td>
                          <td class="num" style="color:var(--color-danger);">-{{ formatQty(r.unitsOut) }}</td>
                          <td class="num"><b [style.color]="r.net < 0 ? 'var(--color-danger)' : 'var(--color-ok)'">{{ r.net > 0 ? '+' : '' }}{{ formatQty(r.net) }}</b></td>
                          <td>{{ r.last ? (r.last | date:'dd MMM HH:mm') : '—' }}</td>
                        </tr>
                      } @empty { <tr><td colspan="7"><app-empty-state compact icon="swap_horiz" title="No ledger movements in this period{{ whFilterName }}" [message]="reportDays !== 0 ? 'Try a longer period.' : 'The ledger has no movements yet.'">
                  @if (reportDays !== 0) { <button mat-stroked-button (click)="reportDays = 0">Show all time</button> }
                </app-empty-state></td></tr> }
                    </tbody>
                  </table>
                </div>
              }

              <!-- Dispatch compliance -->
              @if (reportMode === 'dispatch') {
                <div class="stk-table-wrap">
                  <table class="app-table stk-table">
                    <thead><tr><th>Warehouse</th><th class="num">Tripsheets</th><th class="num">Pre-baseline</th><th class="num">Since baseline</th><th class="num">Stock Deducted</th><th class="num">Awaiting Approval</th><th class="num">% Approved</th><th class="num">Delivered but not deducted</th><th class="num">With POD</th></tr></thead>
                    <tbody>
                      @for (r of dispatchReport; track r.key) {
                        <tr [class.stk-row-total]="r.isTotal">
                          <td><b>{{ r.warehouse }}</b></td>
                          <td class="num">{{ r.total | number }}</td>
                          <td class="num" style="color:var(--color-text-3);">{{ r.baseline | number }}</td>
                          <td class="num">{{ r.live | number }}</td>
                          <td class="num" style="color:var(--color-ok);">{{ r.deducted | number }}</td>
                          <td class="num" [style.color]="r.pending > 0 ? 'var(--color-warn)' : ''">{{ r.pending | number }}</td>
                          <td class="num"><b>{{ r.live ? (r.deducted / r.live * 100 | number:'1.0-0') : 0 }}%</b></td>
                          <td class="num" [style.color]="r.deliveredPending > 0 ? 'var(--color-danger)' : ''">{{ r.deliveredPending | number }}</td>
                          <td class="num">{{ r.withPod | number }}</td>
                        </tr>
                      } @empty { <tr><td colspan="9"><app-empty-state compact icon="local_shipping" title="No tripsheets" message="No tripsheets have been recorded yet."></app-empty-state></td></tr> }
                    </tbody>
                  </table>
                </div>
                <p class="stk-note"><mat-icon>info</mat-icon> Tripsheets dated before a warehouse's stock count are already in the imported baseline and are excluded from approval. "Delivered but not deducted" should be zero.</p>
              }

              <!-- Exceptions summary -->
              @if (reportMode === 'exceptions') {
                <div class="stk-table-wrap">
                  <table class="app-table stk-table">
                    <thead><tr><th>Warehouse</th><th class="num">Out of Stock</th><th class="num">Negative</th><th class="num">Unpriced with Stock</th><th class="num">Open Issues</th><th class="num">In Progress</th></tr></thead>
                    <tbody>
                      @for (r of exceptionReport; track r.key) {
                        <tr [class.stk-row-total]="r.isTotal">
                          <td><b>{{ r.warehouse }}</b></td>
                          <td class="num" [style.color]="r.out > 0 ? 'var(--color-danger)' : ''">{{ r.out | number }}</td>
                          <td class="num" [style.color]="r.neg > 0 ? 'var(--color-danger)' : ''">{{ r.neg | number }}</td>
                          <td class="num" [style.color]="r.unpriced > 0 ? 'var(--color-warn)' : ''">{{ r.unpriced | number }}</td>
                          <td class="num">{{ r.openIssues | number }}</td>
                          <td class="num">{{ r.inProgress | number }}</td>
                        </tr>
                      } @empty { <tr><td colspan="6"><app-empty-state compact icon="warehouse" title="No data" message="There is no warehouse data to report on yet."></app-empty-state></td></tr> }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          }
        }
        </div>
      }
      </mat-tab-nav-panel>

      <!-- Welly Stock Analysis Panel -->
      @if (showWellyPanel) {
        <div class="welly-panel-overlay" (click)="closeWellyPanel()">
          <div class="welly-panel" (click)="$event.stopPropagation()">
            <div class="welly-panel-header">
              <div class="welly-panel-title">
                <mat-icon class="welly-sparkle">auto_awesome</mat-icon>
                <h3>Welly Stock Analysis</h3>
              </div>
              <button aria-label="Close" mat-icon-button (click)="closeWellyPanel()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="welly-panel-body" id="welly-analysis-content">
              @if (wellyLoading) {
                <div class="welly-loading">
                  <app-skeleton-rows [rows]="5" [avatar]="false"></app-skeleton-rows>
                  <p>Welly is analyzing stock, invoices & logistics for {{ selectedWarehouse?.name }}...</p>
                </div>
              } @else if (wellyResult) {
                <!-- Summary Cards -->
                @if (wellySummary) {
                  <div class="welly-summary-grid">
                    <div class="welly-summary-card card-stock">
                      <div class="summary-icon"><mat-icon>inventory_2</mat-icon></div>
                      <div class="summary-info">
                        <span class="summary-value">{{ wellySummary.itemsWithStock | number }}</span>
                        <span class="summary-label">Items In Stock</span>
                      </div>
                    </div>
                    <div class="welly-summary-card card-value">
                      <div class="summary-icon"><mat-icon>payments</mat-icon></div>
                      <div class="summary-info">
                        <span class="summary-value">R{{ wellySummary.totalStockValue | number:'1.0-0' }}</span>
                        <span class="summary-label">Stock Value</span>
                      </div>
                    </div>
                    <div class="welly-summary-card card-alert">
                      <div class="summary-icon"><mat-icon>warning</mat-icon></div>
                      <div class="summary-info">
                        <span class="summary-value">{{ wellySummary.lowStockCount | number }}</span>
                        <span class="summary-label">Low Stock Items</span>
                      </div>
                    </div>
                    <div class="welly-summary-card card-invoice">
                      <div class="summary-icon"><mat-icon>receipt_long</mat-icon></div>
                      <div class="summary-info">
                        <span class="summary-value">{{ wellySummary.totalInvoices | number }}</span>
                        <span class="summary-label">Invoices</span>
                      </div>
                    </div>
                    <div class="welly-summary-card card-delivery">
                      <div class="summary-icon"><mat-icon>local_shipping</mat-icon></div>
                      <div class="summary-info">
                        <span class="summary-value">{{ wellySummary.deliveredLoads }}/{{ wellySummary.totalLoads }}</span>
                        <span class="summary-label">Deliveries</span>
                      </div>
                    </div>
                    <div class="welly-summary-card card-rate">
                      <div class="summary-icon"><mat-icon>speed</mat-icon></div>
                      <div class="summary-info">
                        <span class="summary-value">{{ wellySummary.deliveryRate }}%</span>
                        <span class="summary-label">Delivery Rate</span>
                      </div>
                    </div>
                  </div>
                }

                <!-- Charts -->
                @if (wellyCharts) {
                  <div class="welly-charts-grid">
                    <div class="welly-chart-card">
                      <h4>Stock Value by Building</h4>
                      <canvas id="chart-stock-building"></canvas>
                    </div>
                    <div class="welly-chart-card">
                      <h4>Top Items by Value</h4>
                      <canvas id="chart-top-items"></canvas>
                    </div>
                    <div class="welly-chart-card">
                      <h4>Invoice Status</h4>
                      <canvas id="chart-invoice-status"></canvas>
                    </div>
                    <div class="welly-chart-card">
                      <h4>TripSheet Status</h4>
                      <canvas id="chart-load-status"></canvas>
                    </div>
                  </div>
                }

                <!-- AI Analysis Text -->
                <div class="welly-result">
                  <h4 class="welly-section-title"><mat-icon>psychology</mat-icon> Welly's Analysis</h4>
                  <div class="welly-result-text">{{ wellyResult }}</div>
                </div>

                <!-- Action Buttons -->
                <div class="welly-result-actions">
                  <button mat-raised-button color="primary" (click)="downloadWellyPdf()">
                    <mat-icon>picture_as_pdf</mat-icon> Download PDF
                  </button>
                  <button mat-button (click)="copyWellyResult()">
                    <mat-icon>content_copy</mat-icon> Copy Analysis
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      position: relative;
      background: var(--color-canvas);
      overflow-x: hidden;
      --ink: var(--color-text);
      --muted: var(--color-text-3);
      --line: var(--color-line);
      --accent: var(--color-primary);
      --accent2: var(--color-primary-hover);
      --accent-soft: var(--color-primary-soft);
    }

    .spacer {
      flex: 1 1 auto;
    }

    .container {
      padding: 24px 24px 64px;
      max-width: 1600px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
    }

    app-page-header {
      margin-bottom: var(--space-5);
    }

    .loading-state {
      display: flex; justify-content: center; padding: 60px 20px;
    }
    .loading-card {
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg);
      padding: 48px 56px; text-align: center; box-shadow: var(--shadow-md);
      max-width: 520px; width: 100%;
    }
    .loading-card h3 { color: var(--color-text); margin: 16px 0 6px; font-size: var(--text-2xl); font-weight: 700; }
    .loading-card p { color: var(--color-text-3); margin: 0 0 20px; font-size: var(--text-md); line-height: 1.5; }
    .lc-icon-wrap {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      background: var(--color-primary-soft);
      display: flex; align-items: center; justify-content: center;
    }
    .lc-icon { font-size: var(--text-4xl); width: 32px; height: 32px; color: var(--color-primary); }
    .pulse-icon { animation: pulseGlow 2s ease-in-out infinite; }
    @keyframes pulseGlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
    .loading-card .lc-subtitle { color: var(--color-text-3); font-size: var(--text-sm); }
    .lc-progress-wrap { margin: 8px 0 24px; }
    .lc-progress-track { height: 8px; border-radius: 4px; background: var(--color-surface-2); overflow: hidden; position: relative; }
    .lc-progress-fill { height: 100%; border-radius: 4px; background: var(--color-primary); transition: width 0.15s ease-out; }
    .lc-progress-info { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: var(--text-xs); }
    .lc-progress-message { color: var(--color-text-3); font-weight: 500; }
    .lc-progress-pct { color: var(--color-primary); font-weight: 700; font-size: var(--text-sm); font-variant-numeric: tabular-nums; }
    .lc-steps { display: flex; justify-content: space-between; gap: 4px; padding-top: 4px; border-top: 1px solid var(--color-line); }
    .lc-step {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      flex: 1; padding-top: 16px; opacity: 0.35; transition: opacity 0.4s ease, transform 0.3s ease;
    }
    .lc-step.active { opacity: 1; transform: translateY(-2px); }
    .lc-step.done { opacity: 0.65; }
    .lc-step-dot {
      width: 32px; height: 32px; border-radius: 50%; background: var(--color-surface-2);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.3s ease;
    }
    .lc-step-dot mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; color: var(--color-text-3); transition: color 0.3s ease; }
    .lc-step.active .lc-step-dot { background: var(--color-primary); }
    .lc-step.active .lc-step-dot mat-icon { color: var(--color-on-primary); }
    .lc-step.done .lc-step-dot { background: var(--color-ok-soft); }
    .lc-step.done .lc-step-dot mat-icon { color: var(--color-ok); }
    .lc-step-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-3); white-space: nowrap; }
    .lc-step.active .lc-step-label { color: var(--color-primary); }
    .lc-step.done .lc-step-label { color: var(--color-ok); }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    /* Welly Stock Analysis Styles */
    .welly-suggest-btn mat-icon { color: var(--color-cat-purple, #8b5cf6); }
    .welly-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-scrim);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .welly-panel {
      background: var(--color-canvas);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      width: 900px;
      max-width: 94vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
      animation: slideUp 0.3s ease-out;
    }

    .welly-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-line);
      color: var(--color-text);
    }

    .welly-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .welly-panel-title h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 600;
    }

    .welly-sparkle {
      color: var(--color-primary);
    }

    .welly-panel-body {
      padding: 20px 24px;
      overflow-y: auto;
      max-height: calc(90vh - 60px);
      background: var(--color-canvas);
    }

    .welly-loading {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 24px 0;
    }

    .welly-loading p {
      color: var(--color-text-2);
      font-size: var(--text-md);
      text-align: center;
      margin: 0;
    }

    /* Summary Cards */
    .welly-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .welly-summary-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: var(--shadow-sm);
      border-left: 4px solid var(--color-primary);
    }

    .welly-summary-card.card-stock { border-left-color: var(--color-primary); }
    .welly-summary-card.card-stock .summary-icon { color: var(--color-primary); }
    .welly-summary-card.card-value { border-left-color: var(--color-ok); }
    .welly-summary-card.card-value .summary-icon { color: var(--color-ok); }
    .welly-summary-card.card-alert { border-left-color: var(--color-danger); }
    .welly-summary-card.card-alert .summary-icon { color: var(--color-danger); }
    .welly-summary-card.card-invoice { border-left-color: var(--color-warn); }
    .welly-summary-card.card-invoice .summary-icon { color: var(--color-warn); }
    .welly-summary-card.card-delivery { border-left-color: var(--color-cat-teal); }
    .welly-summary-card.card-delivery .summary-icon { color: var(--color-cat-teal); }
    .welly-summary-card.card-rate { border-left-color: var(--color-cat-purple); }
    .welly-summary-card.card-rate .summary-icon { color: var(--color-cat-purple); }

    .summary-icon mat-icon {
      font-size: var(--text-3xl);
      width: 24px;
      height: 24px;
    }

    .summary-info {
      display: flex;
      flex-direction: column;
    }

    .summary-value {
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--color-text);
      line-height: 1.2;
    }

    .summary-label {
      font-size: var(--text-xs);
      color: var(--color-text-3);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }

    /* Charts Grid */
    .welly-charts-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    }

    .welly-chart-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 16px;
      box-shadow: var(--shadow-sm);
    }

    .welly-chart-card h4 {
      margin: 0 0 12px 0;
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--color-text-2);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .welly-chart-card canvas {
      width: 100% !important;
      max-height: 220px;
    }

    /* Analysis text section */
    .welly-section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      font-size: var(--text-md);
      font-weight: 600;
      color: var(--color-text-2);
    }

    .welly-section-title mat-icon {
      font-size: var(--text-2xl);
      width: 20px;
      height: 20px;
      color: var(--color-primary);
    }

    .welly-result-text {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 18px;
      font-size: var(--text-sm);
      line-height: 1.7;
      white-space: pre-wrap;
      max-height: 40vh;
      overflow-y: auto;
      margin-bottom: 16px;
      color: var(--color-text);
    }

    .welly-result-actions {
      display: flex;
      gap: 12px;
      padding-top: 4px;
    }

    .welly-result-actions button mat-icon {
      margin-right: 4px;
    }
    .client-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 2px; position: relative; z-index: 1; }
    .client-chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 3px 10px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600;
      background: var(--color-surface-2); color: var(--color-text-2); border: 1px solid var(--color-line);
    }
    .client-chip b { color: var(--color-text); }
    .stock-asat {
      display: flex; align-items: center; gap: 6px; margin-top: 8px;
      font-size: var(--text-xs); color: var(--color-text-3); position: relative; z-index: 1;
    }
    .stock-asat mat-icon { font-size: var(--text-md); width: 14px; height: 14px; }

    /* ═══ Dashboard redesign ═══ */
    .stk-kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 18px; }
    @media (max-width: 1400px) { .stk-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 760px) { .stk-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    .stk-kpi {
      background: var(--color-surface); border: 1px solid var(--color-line); border-top: 4px solid transparent;
      border-radius: var(--radius-lg); padding: 18px; box-shadow: var(--shadow-sm);
      transition: box-shadow .2s ease; position: relative; overflow: hidden;
    }
    .stk-kpi:hover { box-shadow: var(--shadow-md); }
    .stk-kpi mat-icon { font-size: var(--text-3xl); width: 24px; height: 24px; opacity: 0.9; }
    .stk-kpi-val { font-size: var(--text-3xl); font-weight: 700; color: var(--color-text); margin-top: 6px; line-height: 1.1; }
    .stk-kpi-lbl { font-size: var(--text-xs); color: var(--color-text-2); font-weight: 600; text-transform: uppercase; letter-spacing: .4px; margin-top: 3px; }
    .k-indigo { border-top-color: var(--color-primary); } .k-indigo mat-icon { color: var(--color-primary); }
    .k-green { border-top-color: var(--color-ok); } .k-green mat-icon { color: var(--color-ok); }
    .k-teal { border-top-color: var(--color-cat-teal); } .k-teal mat-icon { color: var(--color-cat-teal); }
    .k-emerald { border-top-color: var(--color-ok); } .k-emerald mat-icon { color: var(--color-ok); }
    .k-red { border-top-color: var(--color-danger); } .k-red mat-icon { color: var(--color-danger); }

    .stk-wh-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
    @media (max-width: 1200px) { .stk-wh-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 700px) { .stk-wh-grid { grid-template-columns: 1fr; } }
    .stk-link { cursor: pointer; color: var(--color-primary); text-decoration: none; }
    .stk-link:hover { text-decoration: underline; }
    .stk-chip-btn { cursor: pointer; border: 1px solid transparent; font: inherit; }
    .stk-chip-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: var(--color-primary-soft); }
    .stk-wh-card {
      background: var(--color-surface); border-radius: var(--radius-lg); padding: 18px; cursor: pointer;
      box-shadow: var(--shadow-sm); border: 1px solid var(--color-line); transition: box-shadow .2s ease, border-color .2s ease;
    }
    .stk-wh-card:hover { box-shadow: var(--shadow-md); }
    .stk-wh-card.active { border-color: var(--color-primary); background: var(--color-primary-soft); }
    .stk-wh-head { display: flex; align-items: center; gap: 10px; }
    .stk-wh-ico { color: var(--color-primary); }
    .stk-wh-title { flex: 1; min-width: 0; }
    .stk-wh-title h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stk-wh-title span { font-size: var(--text-xs); color: var(--color-text-3); }
    .stk-wh-ops { color: var(--color-text-3); }
    .stk-wh-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px; }
    .stk-wh-stats > div { text-align: center; background: var(--color-canvas); border-radius: var(--radius-control); padding: 6px 2px; }
    .stk-wh-card.active .stk-wh-stats > div { background: var(--color-surface); }
    .stk-wh-stats b { display: block; font-size: var(--text-sm); color: var(--color-text); }
    .stk-wh-stats b .out-sub { font-style: normal; font-size: var(--text-xs); color: var(--color-danger); font-weight: 600; }
    .stk-wh-stats span { font-size: var(--text-xs); color: var(--color-text-3); text-transform: uppercase; letter-spacing: .3px; font-weight: 600; }

    .stk-tabs { background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); box-shadow: var(--shadow-sm); overflow: hidden; margin-bottom: 30px; }

    /* Company filter chips — same design as Sales History */
    .sh-company-bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 18px; }
    .sh-company-chip {
      display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px;
      border: 1.5px solid var(--color-line); background: var(--color-surface); border-radius: 999px;
      font-size: var(--text-sm); font-weight: 600; color: var(--color-text-2); cursor: pointer;
      transition: all .18s ease;
    }
    .sh-company-chip mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }
    .sh-company-chip:hover { background: var(--color-surface-2); }
    .sh-company-chip.active {
      border-color: var(--chip-color, var(--color-primary)); color: var(--chip-color, var(--color-brand));
      background: var(--color-surface);
    }
    .sh-company-chip--logo { padding: 6px 14px 6px 8px; gap: 8px; }
    .sh-chip-logo {
      width: 30px; height: 30px; object-fit: contain; object-position: center;
      display: block; filter: grayscale(30%); opacity: .82; transition: all .18s ease;
    }
    .sh-company-chip--logo:hover .sh-chip-logo { filter: grayscale(0%); opacity: 1; }
    .sh-company-chip--logo.active .sh-chip-logo { filter: none; opacity: 1; }
    .sh-chip-label { font-size: var(--text-xs); font-weight: 600; color: var(--color-text-2); }
    .sh-company-chip--logo.active .sh-chip-label { color: var(--chip-color, var(--color-brand)); }
    .stk-tab-body { padding: 16px; }
    .stk-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .stk-search { flex: 1; min-width: 240px; max-width: 420px; }
    .stk-search ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }

    /* Movements tab */
    .mv-alert { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; margin-bottom: 16px; border-radius: var(--radius-lg);
      background: var(--color-warn-soft); border: 1px solid var(--color-warn); }
    .mv-alert > mat-icon { color: var(--color-warn); }
    .mv-alert.mv-alert-red { background: var(--color-danger-soft); border-color: var(--color-danger); }
    .mv-alert.mv-alert-red > mat-icon { color: var(--color-danger); }
    .mv-alert-text { display: flex; flex-direction: column; gap: 2px; min-width: 240px; }
    .mv-alert-text b { color: var(--color-text); font-size: var(--text-md); }
    .mv-alert-text span { color: var(--color-text-2); font-size: var(--text-sm); }
    .mv-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
    .mv-intro { margin: 0; color: var(--color-text-2); font-size: var(--text-sm); }
    .mv-menu-item { display: flex; flex-direction: column; line-height: 1.25; padding: 4px 0; }
    .mv-menu-item small { color: var(--color-text-3); font-size: var(--text-xs); }
    .mv-filters { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .mv-seg { display: inline-flex; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control); overflow: hidden; background: var(--color-surface); }
    .mv-seg button { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border: none; border-right: 1px solid var(--color-line);
      background: transparent; color: var(--color-text-2); font: inherit; font-size: var(--text-sm); cursor: pointer; }
    .mv-seg button:last-child { border-right: none; }
    .mv-seg button:hover { background: var(--color-surface-2); }
    .mv-seg button.on { background: var(--color-primary-soft); color: var(--color-primary-hover); font-weight: 600; }
    .mv-seg button mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .mv-seg button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
    .mv-n { font-size: var(--text-xs); color: var(--color-text-3); font-variant-numeric: tabular-nums; }
    .mv-seg button.on .mv-n { color: inherit; }
    .mv-sum { font-size: var(--text-sm); color: var(--color-text-2); white-space: nowrap; }
    .mv-pos { color: var(--color-ok); }
    .mv-neg { color: var(--color-danger); }
    .mv-table td { vertical-align: top; }
    .mv-when { white-space: nowrap; }
    .mv-when small, .mv-sub { display: block; color: var(--color-text-3); font-size: var(--text-xs); }
    .mv-kind { display: inline-flex; align-items: center; gap: 6px; font-weight: 600; white-space: nowrap; }
    .mv-kind mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .mv-k-in mat-icon { color: var(--color-ok); }
    .mv-k-out mat-icon { color: var(--color-danger); }
    .mv-k-transfer mat-icon { color: var(--color-primary); }
    .mv-k-correction mat-icon { color: var(--color-warn); }
    .mv-change { font-size: var(--text-md); font-variant-numeric: tabular-nums; }
    .mv-why { max-width: 320px; }
    .mv-ref { display: block; font-weight: 600; color: var(--color-text-2); }
    .mv-link { display: block; padding: 0; border: none; background: none; font: inherit; font-weight: 600; color: var(--color-primary); cursor: pointer; text-align: left; }
    .mv-link:hover { text-decoration: underline; }
    .mv-reason { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--color-text-3); font-size: var(--text-xs); }
    .mv-act { text-align: right; white-space: nowrap; }
    .mv-reversed td { color: var(--color-text-3); }
    .mv-reversed .mv-change { text-decoration: line-through; color: var(--color-text-3); }
    @media (max-width: 720px) { .mv-seg { width: 100%; overflow-x: auto; } .mv-why { max-width: none; } }
    .stk-count { font-size: var(--text-xs); color: var(--color-text-3); font-weight: 600; }
    .stk-spacer { flex: 1; }
    .stk-sep { width: 1px; height: 26px; background: var(--color-line); margin: 0 4px; }
    .stk-row-total td { background: var(--color-canvas); font-weight: 700; border-top: 2px solid var(--color-line-strong); }
    .stk-filter-on { background: var(--color-primary-soft) !important; border-color: var(--color-primary) !important; color: var(--color-primary-hover) !important; }
    .stk-table-wrap { overflow-x: auto; border: 1px solid var(--color-line); border-radius: var(--radius-md); }
    .stk-table td.ref { font-weight: 600; white-space: nowrap; }
    .stk-table td.ref.code-inv { color: var(--color-ok); font-weight: 800; }
    .stk-table td.desc { max-width: 340px; }
    .stk-chip { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: var(--text-xs); font-weight: 600; background: var(--color-line); color: var(--color-text-2); }
    .stk-row-resolved td { opacity: 0.55; }
    .stk-resolution { font-size: var(--text-xs); color: var(--color-ok); max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .stk-more { text-align: center; padding: 10px; font-size: var(--text-xs); color: var(--color-text-3); background: var(--color-canvas); }
    .stk-note { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: var(--text-xs); color: var(--color-text-3); }
    .stk-note mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; color: var(--color-primary); }
  `]
})
export class StockManagementComponent implements OnInit, DoCheck, OnDestroy {
  warehouses: WarehouseSummary[] = [];
  loading = true;

  /** Compact currency: R12.4M / R980.5K / R123 */
  formatValue(v: number | null | undefined): string {
    const n = +(v || 0);
    if (n >= 1_000_000) return 'R' + (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return 'R' + (n / 1_000).toFixed(1) + 'K';
    return 'R' + n.toFixed(0);
  }

  /** Compact quantity: 20.5M / 1.2K / 847 */
  formatQty(v: number | null | undefined): string {
    const n = +(v || 0);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 10_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
  }

  // ═══ Dashboard state ═══
  whFilterId: number | null = null;
  allInventory: any[] = [];
  invLoading = true;
  sohSearch = '';
  excMode: 'out' | 'neg' | 'unpriced' = 'out';

  private get kpiSet(): WarehouseSummary[] { return this.companyFilter ? this.countRows : (this.whFilterId ? this.warehouses.filter(w => w.id === this.whFilterId) : this.warehouses); }
  get kpiUnits(): number { return this.kpiSet.reduce((s, w) => s + (w.totalQuantityOnHand || 0), 0); }
  get kpiValue(): number { return this.kpiSet.reduce((s, w) => s + (w.totalStockValue || 0), 0); }
  get kpiCost(): number { return this.kpiSet.reduce((s, w) => s + (w.totalCostValue || 0), 0); }
  get kpiIn(): number { return this.kpiSet.reduce((s, w) => s + (w.itemsInStock || 0), 0); }
  get kpiOut(): number { return this.kpiSet.reduce((s, w) => s + (w.itemsOutOfStock || 0), 0); }

  get whFilterName(): string {
    if (!this.whFilterId) return '';
    const w = this.warehouses.find(x => x.id === this.whFilterId);
    return w ? ' — ' + w.name : '';
  }

  toggleWhFilter(id: number): void {
    this.whFilterId = this.whFilterId === id ? null : id;
  }

  /** Company filter (matches Commodities.Category) — same companies as Sales */
  companyFilter = '';
  stockCompanies = [
    { key: 'PROMED', shortName: 'Promed', color: 'var(--color-brand)', logo: 'logos/promed-round.png?v=4' },
    { key: 'ACCESS', shortName: 'Access', color: 'var(--color-cat-teal)', logo: 'logos/access-round.png?v=4' },
    { key: 'PHARMACARE', shortName: 'Pharmatech', color: 'var(--color-cat-pink)', logo: 'logos/pharmatech-round.png?v=4' },
    { key: 'SEBENZANI', shortName: 'Sebenzani', color: 'var(--color-cat-purple)', logo: 'logos/sebenzani-round.png?v=4' },
    { key: 'KOG', shortName: 'KOG', color: 'var(--color-cat-amber)', logo: '' },
    /** Internal holding "company" for write-offs: damaged, expired, short-dated and repack stock */
    { key: 'DAMAGED-EXPIRED', shortName: 'Damaged / Expired', color: 'var(--color-danger, #c62828)', logo: '' }
  ];

  /** Inventory scoped to the selected warehouse + company filters */
  get invScoped(): any[] {
    let rows = this.whFilterId ? this.allInventory.filter(r => r.warehouseId === this.whFilterId) : this.allInventory;
    if (this.companyFilter) {
      const key = this.companyFilter.toUpperCase();
      rows = rows.filter(r => (r.category || '').toUpperCase() === key);
    }
    return rows;
  }

  get sohRows(): any[] {
    const term = this.sohSearch.trim().toLowerCase();
    if (!term) return this.invScoped;
    return this.invScoped.filter(r =>
      (r.commodityCode || '').toLowerCase().includes(term) ||
      (r.commodityName || '').toLowerCase().includes(term) ||
      (r.category || '').toLowerCase().includes(term));
  }

  /**
   * Stock Counts rows, built from the same scoped inventory as the Stock on Hand tab so the two
   * always agree. Without a company filter this equals the server summary; with one it narrows to
   * that company only (the server summary is company-agnostic).
   */
  get countRows(): WarehouseSummary[] {
    const scoped = this.invScoped;
    const whs = this.whFilterId ? this.warehouses.filter(w => w.id === this.whFilterId) : this.warehouses;
    return whs.map(w => {
      const rows = scoped.filter(r => r.warehouseId === w.id);
      const byClient = new Map<string, ClientStockSummary>();
      let units = 0, value = 0, inStock = 0, last: string | null = null;
      for (const r of rows) {
        const q = +(r.quantityOnHand || 0);
        units += q; if (q > 0) inStock++;
        value += +(r.lineValue || (r.unitPrice || 0) * q);
        if (r.lastCountDate && (!last || r.lastCountDate > last)) last = r.lastCountDate;
        const k = r.category || 'OTHER';
        let c = byClient.get(k);
        if (!c) { c = { client: k, items: 0, itemsInStock: 0, quantityOnHand: 0, stockValue: 0 } as ClientStockSummary; byClient.set(k, c); }
        c.items++; if (q > 0) c.itemsInStock++; c.quantityOnHand += q; c.stockValue += +(r.lineValue || (r.unitPrice || 0) * q);
      }
      return {
        ...w,
        totalItems: rows.length,
        totalQuantityOnHand: units,
        totalStockValue: value,
        itemsInStock: inStock,
        itemsOutOfStock: rows.length - inStock,
        lastCountDate: last ?? w.lastCountDate,
        byClient: [...byClient.values()].sort((a, b) => b.quantityOnHand - a.quantityOnHand)
      } as WarehouseSummary;
    });
  }

  excCount(mode: 'out' | 'neg' | 'unpriced'): number {
    return this.excRowsFor(mode).length;
  }

  get exceptionRows(): any[] { return this.excRowsFor(this.excMode); }

  private excRowsFor(mode: 'out' | 'neg' | 'unpriced'): any[] {
    switch (mode) {
      case 'out': return this.invScoped.filter(r => r.quantityOnHand === 0);
      case 'neg': return this.invScoped.filter(r => r.quantityOnHand < 0);
      case 'unpriced': return this.invScoped.filter(r => r.quantityOnHand > 0 && !r.unitPrice);
    }
  }

  // ═══ Reports (computed on-screen from scoped data) ═══
  reportMode: 'valuation' | 'activity' | 'dispatch' | 'exceptions' = 'valuation';
  reportDays = 30;

  private get reportWarehouses(): any[] {
    return this.whFilterId ? this.warehouses.filter(w => w.id === this.whFilterId) : this.warehouses;
  }

  get valuationReport(): any[] {
    const map = new Map<string, any>();
    for (const r of this.invScoped) {
      const company = r.category || 'Unassigned';
      const key = `${company}|${r.warehouseId}`;
      let a = map.get(key);
      if (!a) { a = { key, company, warehouse: r.warehouseName, items: 0, inStock: 0, out: 0, units: 0, value: 0, cost: 0 }; map.set(key, a); }
      a.items++;
      if (r.quantityOnHand > 0) a.inStock++; else if (r.quantityOnHand === 0) a.out++;
      a.units += +(r.quantityOnHand || 0);
      a.value += +(r.lineValue || (r.unitPrice || 0) * (r.quantityOnHand || 0));
      a.cost += +((r.unitCost || 0) * (r.quantityOnHand || 0));
    }
    const rows = [...map.values()].sort((x, y) => x.company.localeCompare(y.company) || x.warehouse.localeCompare(y.warehouse));
    if (rows.length > 1) {
      rows.push(rows.reduce((t, r) => ({ ...t, items: t.items + r.items, inStock: t.inStock + r.inStock, out: t.out + r.out,
        units: t.units + r.units, value: t.value + r.value, cost: t.cost + r.cost }),
        { key: 'TOTAL', company: 'Total', warehouse: '', items: 0, inStock: 0, out: 0, units: 0, value: 0, cost: 0, isTotal: true }));
    }
    return rows;
  }

  get activityReport(): any[] {
    const since = this.reportDays ? Date.now() - this.reportDays * 86400000 : 0;
    const map = new Map<string, any>();
    for (const m of this.ledgerScoped) {
      const ts = new Date(m.createdAt).getTime();
      if (since && ts < since) continue;
      const key = `${m.warehouseId}|${m.movementType}`;
      let a = map.get(key);
      if (!a) { a = { key, warehouse: m.warehouseName, type: m.movementType, count: 0, unitsIn: 0, unitsOut: 0, net: 0, last: null }; map.set(key, a); }
      a.count++;
      if (m.quantity > 0) a.unitsIn += m.quantity; else a.unitsOut += -m.quantity;
      a.net += m.quantity;
      if (!a.last || ts > new Date(a.last).getTime()) a.last = m.createdAt;
    }
    const rows = [...map.values()].sort((x, y) => x.warehouse.localeCompare(y.warehouse) || x.type.localeCompare(y.type));
    if (rows.length > 1) {
      rows.push(rows.reduce((t, r) => ({ ...t, count: t.count + r.count, unitsIn: t.unitsIn + r.unitsIn, unitsOut: t.unitsOut + r.unitsOut, net: t.net + r.net,
        last: (!t.last || new Date(r.last).getTime() > new Date(t.last).getTime()) ? r.last : t.last }),
        { key: 'TOTAL', warehouse: 'Total', type: '', count: 0, unitsIn: 0, unitsOut: 0, net: 0, last: null, isTotal: true }));
    }
    return rows;
  }

  get dispatchReport(): any[] {
    const rows = this.reportWarehouses.map(w => {
      const ls = this.loads.filter(l => l.warehouseId === w.id);
      const deducted = ls.filter(l => this.isLoadDeducted(l.id));
      const pending = ls.filter(l => this.isLoadAwaiting(l));
      const baseline = ls.filter(l => this.isLoadBaseline(l));
      const live = deducted.length + pending.length;
      return {
        key: String(w.id), warehouse: w.name, total: ls.length, baseline: baseline.length, live, deducted: deducted.length, pending: pending.length,
        deliveredPending: pending.filter(l => l.status === 'Delivered' || l.status === 'Completed').length,
        withPod: ls.filter(l => l.hasPOD).length
      };
    }).filter(r => r.total > 0);
    if (rows.length > 1) {
      rows.push(rows.reduce((t, r) => ({ ...t, total: t.total + r.total, baseline: t.baseline + r.baseline, live: t.live + r.live, deducted: t.deducted + r.deducted, pending: t.pending + r.pending,
        deliveredPending: t.deliveredPending + r.deliveredPending, withPod: t.withPod + r.withPod }),
        { key: 'TOTAL', warehouse: 'Total', total: 0, baseline: 0, live: 0, deducted: 0, pending: 0, deliveredPending: 0, withPod: 0, isTotal: true } as any));
    }
    return rows;
  }

  get exceptionReport(): any[] {
    const rows = this.reportWarehouses.map(w => {
      const inv = this.allInventory.filter(r => r.warehouseId === w.id && (!this.companyFilter || (r.category || '').toUpperCase() === this.companyFilter.toUpperCase()));
      const iss = this.issues.filter(i => i.warehouseId === w.id);
      return {
        key: String(w.id), warehouse: w.name,
        out: inv.filter(r => r.quantityOnHand === 0).length,
        neg: inv.filter(r => r.quantityOnHand < 0).length,
        unpriced: inv.filter(r => r.quantityOnHand > 0 && !r.unitPrice).length,
        openIssues: iss.filter(i => i.status === 'Open').length,
        inProgress: iss.filter(i => i.status === 'InProgress').length
      };
    });
    if (rows.length > 1) {
      rows.push(rows.reduce((t, r) => ({ ...t, out: t.out + r.out, neg: t.neg + r.neg, unpriced: t.unpriced + r.unpriced,
        openIssues: t.openIssues + r.openIssues, inProgress: t.inProgress + r.inProgress }),
        { key: 'TOTAL', warehouse: 'Total', out: 0, neg: 0, unpriced: 0, openIssues: 0, inProgress: 0, isTotal: true } as any));
    }
    return rows;
  }

  exportReport(): void {
    const stamp = new Date().toISOString().substring(0, 10);
    switch (this.reportMode) {
      case 'valuation':
        this.writeExcel(this.valuationReport.map(r => ({ 'Company': r.company, 'Warehouse': r.warehouse, 'Items': r.items, 'In Stock': r.inStock, 'Out of Stock': r.out,
          'Units': r.units, 'Sales Value': Math.round(r.value), 'Cost Value': Math.round(r.cost) })), 'Valuation', `Stock_Valuation_${stamp}.xlsx`);
        break;
      case 'activity':
        this.writeExcel(this.activityReport.map(r => ({ 'Warehouse': r.warehouse, 'Type': r.type, 'Movements': r.count, 'Units In': r.unitsIn, 'Units Out': r.unitsOut,
          'Net': r.net, 'Last': r.last ? String(r.last).substring(0, 16).replace('T', ' ') : '' })), 'Activity', `Movement_Activity_${this.reportDays || 'all'}d_${stamp}.xlsx`);
        break;
      case 'dispatch':
        this.writeExcel(this.dispatchReport.map(r => ({ 'Warehouse': r.warehouse, 'Tripsheets': r.total, 'Pre-baseline': r.baseline, 'Since baseline': r.live, 'Stock Deducted': r.deducted, 'Awaiting Approval': r.pending,
          '% Approved': r.live ? Math.round(r.deducted / r.live * 100) : 0, 'Delivered not deducted': r.deliveredPending, 'With POD': r.withPod })), 'Dispatch', `Dispatch_Compliance_${stamp}.xlsx`);
        break;
      case 'exceptions':
        this.writeExcel(this.exceptionReport.map(r => ({ 'Warehouse': r.warehouse, 'Out of Stock': r.out, 'Negative': r.neg, 'Unpriced with Stock': r.unpriced,
          'Open Issues': r.openIssues, 'In Progress': r.inProgress })), 'Exceptions', `Stock_Exceptions_${stamp}.xlsx`);
        break;
    }
  }


  // ═══ Stock issues ═══
  issues: any[] = [];
  issuesLoading = true;
  issueStatusFilter = 'Open';
  issueSearch = '';

  // ═══ Stock ledger (WarehouseStockMovements) ═══
  ledger: any[] = [];
  ledgerLoading = true;
  movTypeFilter = '';
  movSearch = '';
  canApprove = false;
  deductedLoadIds = new Set<number>();

  get ledgerScoped(): any[] {
    return this.whFilterId ? this.ledger.filter(m => m.warehouseId === this.whFilterId) : this.ledger;
  }
  /** Movement types grouped the way people think about them */
  readonly movKinds = [
    { key: '', label: 'All', icon: 'list', hint: 'Every movement' },
    { key: 'in', label: 'In', icon: 'south_west', hint: 'Received from suppliers and returned by customers' },
    { key: 'out', label: 'Out', icon: 'north_east', hint: 'Dispatched on loads and written off' },
    { key: 'transfer', label: 'Transfers', icon: 'sync_alt', hint: 'Moved between warehouses' },
    { key: 'correction', label: 'Corrections', icon: 'tune', hint: 'Stock counts, adjustments and reversals' }
  ];

  movKindOf(m: any): 'in' | 'out' | 'transfer' | 'correction' {
    switch (m.movementType) {
      case 'Receive': case 'Return': return 'in';
      case 'Dispatch': case 'Scrap': return 'out';
      case 'Transfer': return 'transfer';
      default: return 'correction';
    }
  }

  /** What happened, in words */
  movLabel(m: any): string {
    const ref = String(m.reference || '');
    switch (m.movementType) {
      case 'Receive': return 'Received';
      case 'Return': return ref.startsWith('SCRAP #') ? 'Write-off cancelled' : 'Customer return';
      case 'Dispatch': return 'Dispatched';
      case 'Scrap': return 'Written off';
      case 'Transfer': return m.quantity < 0 ? 'Transferred out' : 'Transferred in';
      case 'Reversal': return 'Reversal';
      case 'Adjustment':
        if (ref === 'OPENING') return 'Opening balance';
        if (ref.startsWith('SOH-')) return 'Stock report count';
        if (ref.startsWith('STK-') || String(m.reason || '').startsWith('Stock take')) return 'Stock count';
        return 'Adjusted';
      default: return m.movementType;
    }
  }

  movIcon(m: any): string {
    switch (m.movementType) {
      case 'Receive': return 'south_west';
      case 'Return': return 'keyboard_return';
      case 'Dispatch': return 'local_shipping';
      case 'Scrap': return 'delete_sweep';
      case 'Transfer': return 'sync_alt';
      case 'Reversal': return 'undo';
      default: return this.movLabel(m).includes('count') ? 'fact_check' : 'tune';
    }
  }

  /** Filters by kind; a raw type from an older link (?type=Receive) still works */
  private movMatches(m: any, key: string): boolean {
    return !key || this.movKindOf(m) === key || m.movementType === key;
  }

  get ledgerRows(): any[] {
    let rows = this.ledgerScoped.filter(m => this.movMatches(m, this.movTypeFilter));
    const t = this.movSearch.trim().toLowerCase();
    if (t) {
      rows = rows.filter(m =>
        (m.commodityCode || '').toLowerCase().includes(t) ||
        (m.commodityName || '').toLowerCase().includes(t) ||
        (m.reference || '').toLowerCase().includes(t) ||
        (m.reason || '').toLowerCase().includes(t) ||
        (m.createdBy || '').toLowerCase().includes(t) ||
        (m.warehouseName || '').toLowerCase().includes(t) ||
        this.movLabel(m).toLowerCase().includes(t));
    }
    return rows;
  }
  movKindCount(key: string): number { return this.ledgerScoped.filter(m => this.movMatches(m, key)).length; }

  /** Totals for what's on screen. Transfers and reversals are left out: they move stock, they don't add or remove it. */
  get movViewIn(): number {
    return this.ledgerRows.filter(m => m.quantity > 0 && m.movementType !== 'Transfer' && m.movementType !== 'Reversal').reduce((s, m) => s + m.quantity, 0);
  }
  get movViewOut(): number {
    return Math.abs(this.ledgerRows.filter(m => m.quantity < 0 && m.movementType !== 'Transfer' && m.movementType !== 'Reversal').reduce((s, m) => s + m.quantity, 0));
  }
  abs(n: number): number { return Math.abs(n || 0); }

  /** Approvals happen in Dispatch: open it on the loads still waiting */
  goToApprovals(): void {
    this.router.navigate(['/stock-management', 'dispatch'], { queryParams: { ...this.sharedQuery(), deducted: 'pending' } });
  }

  /** Loads whose stock has not yet been deducted — the approval work-queue (most recent first) */
  private get pendingDispatchAll(): any[] {
    return this.loadsScoped.filter(l => this.isLoadAwaiting(l));
  }
  get pendingDispatchCount(): number { return this.pendingDispatchAll.length; }

  loadLedger(): void {
    this.ledgerLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/logistics/stock-movements?limit=500`).subscribe({
      next: d => { this.ledger = d || []; this.ledgerLoading = false; },
      error: () => { this.ledger = []; this.ledgerLoading = false; }
    });
    this.http.get<number[]>(`${environment.apiUrl}/logistics/stock-movements/dispatched-loads`).subscribe({
      next: d => this.deductedLoadIds = new Set(d || []),
      error: () => {}
    });
    this.http.get<any[]>(`${environment.apiUrl}/logistics/stock-movements/load-stock-state`).subscribe({
      next: d => this.loadStockStates = new Map((d || []).map(s => [s.loadId, s])),
      error: () => {}
    });
  }

  /** Server-computed state per load (same rule dispatch approval uses: per-item count dates vs the dispatch date) */
  loadStockStates = new Map<number, { state: string; dispatchDate: string; delivered: boolean }>();

  isLoadDeducted(loadId: number): boolean { return this.deductedLoadIds.has(loadId); }

  /** When the load's stock left: pickup first, CreatedAt last (tripsheets are often captured after the trip) */
  loadDispatchDate(l: any): string {
    return this.loadStockStates.get(l.id)?.dispatchDate
      || l.actualPickupDate || l.scheduledPickupDate || l.actualDeliveryDate || l.scheduledDeliveryDate || l.createdAt;
  }

  /**
   * Loads that left before their items were counted are already reflected in the counted
   * quantities, so they must never be approved again (that would double-deduct).
   */
  isLoadBaseline(l: any): boolean {
    if (this.deductedLoadIds.has(l.id)) return false;
    const s = this.loadStockStates.get(l.id);
    if (s) return s.state === 'baseline';
    const w = this.warehouses.find(x => x.id === l.warehouseId);
    if (!w?.lastCountDate) return false;
    return new Date(this.loadDispatchDate(l) || 0).getTime() < new Date(w.lastCountDate).getTime();
  }

  /** Delivered to the customer but stock never came off — the drift to clear first */
  get deliveredNotDeductedCount(): number {
    return this.pendingDispatchAll.filter(l => l.status === 'Delivered' || l.status === 'Completed').length;
  }
  /** Awaiting = after baseline and not yet deducted */
  isLoadAwaiting(l: any): boolean { return !this.deductedLoadIds.has(l.id) && !this.isLoadBaseline(l); }
  loadStockState(l: any): 'deducted' | 'awaiting' | 'baseline' {
    return this.deductedLoadIds.has(l.id) ? 'deducted' : (this.isLoadBaseline(l) ? 'baseline' : 'awaiting');
  }

  openManualMovement(type: 'Receive' | 'Return' | 'Adjustment' | 'Scrap'): void {
    const w = this.whFilterId ? this.warehouses.find(x => x.id === this.whFilterId) : (this.warehouses.length === 1 ? this.warehouses[0] : null);
    const ref = this.dialog.open(ManualMovementDialog, {
      width: '860px', maxWidth: '96vw',
      data: { warehouse: w, warehouses: this.warehouses, type, inventory: this.allInventory,
              onPartial: () => { this.loadLedger(); this.loadDashboardData(); this.loadWarehouses(); } }
    });
    ref.afterClosed().subscribe(done => { if (done) { this.loadLedger(); this.loadDashboardData(); this.loadWarehouses(); } });
  }

  openTransferStock(prefill?: { fromWarehouseId?: number; toWarehouseId?: number; code?: string; quantity?: number; reference?: string }): void {
    const from = prefill?.fromWarehouseId ? this.warehouses.find(w => w.id === prefill.fromWarehouseId)
      : this.whFilterId ? this.warehouses.find(w => w.id === this.whFilterId) : this.warehouses[0];
    const ref = this.dialog.open(TransferStockDialog, {
      width: '860px', maxWidth: '96vw',
      data: { warehouses: this.warehouses, fromWarehouseId: from?.id, inventory: this.allInventory,
              toWarehouseId: prefill?.toWarehouseId, preselectCode: prefill?.code, quantity: prefill?.quantity, reference: prefill?.reference }
    });
    ref.afterClosed().subscribe(done => { if (done) { this.loadLedger(); this.loadDashboardData(); this.loadWarehouses(); } });
  }

  // ── Welly suggests: open invoices vs stock on hand → fulfilments, internal movements, inter-company ──
  openWellySuggestions(): void {
    const ref = this.dialog.open(WellySuggestionsDialogComponent, {
      width: '1180px', maxWidth: '96vw', maxHeight: '92vh', panelClass: 'welly-suggestions-panel', autoFocus: false,
      data: { mode: 'stock' }
    });
    ref.afterClosed().subscribe((a: WellySuggestionsAction | undefined) => {
      if (!a) return;
      if (a.action === 'transfer') {
        this.openTransferStock({ fromWarehouseId: a.lane.fromWarehouseId, toWarehouseId: a.lane.toWarehouseId, code: a.item.code, quantity: a.item.qty,
          reference: 'Welly · ' + a.item.invoices.slice(0, 3).join(', ') });
      } else if (a.action === 'transfer-lane') {
        this.recordWellyLane(a.lane);
      } else if (a.action === 'ic-transfer') {
        // Donor code moves from the warehouse where it sits to the one that needs it ("KZN→GP" chips).
        const cross = a.item.warehouses.find(w => w.includes('→'));
        const [fromCode, toCode] = (cross || '').split('→').map(s => s.trim());
        const byCode = (c: string) => this.warehouses.find((w: any) => (w.code || '').toUpperCase() === c.toUpperCase() || (w.name || '').toUpperCase().startsWith(c.toUpperCase()));
        const from = byCode(fromCode), to = byCode(toCode);
        if (!from || !to) { this.toast.warn(`Couldn't work out the warehouses for ${cross || 'this line'} — record it from the Transfer form.`); this.openTransferStock({ code: a.item.fromCode, quantity: a.item.qty }); return; }
        this.openTransferStock({ fromWarehouseId: from.id, toWarehouseId: to.id, code: a.item.fromCode, quantity: a.item.qty,
          reference: `Welly inter-company ${a.lane.from}→${a.lane.to} · ` + a.item.invoices.slice(0, 3).join(', ') });
      }
    });
  }

  /** Record every line of a suggested lane as a warehouse transfer, one ledger pair per line. */
  private async recordWellyLane(lane: WellyLane): Promise<void> {
    const rows: { item: WellyLaneItem; inv: any }[] = [];
    const missing: string[] = [];
    for (const it of lane.items) {
      const inv = (this.allInventory || []).find((r: any) => r.warehouseId === lane.fromWarehouseId && (r.commodityCode || '').toUpperCase() === it.code.toUpperCase());
      if (inv) rows.push({ item: it, inv }); else missing.push(it.code);
    }
    if (!rows.length) { this.toast.warn(`None of these codes have a stock record at ${lane.from}.`); return; }
    const ok = await this.confirm.ask({
      title: `Record ${rows.length} transfer(s) ${lane.from} → ${lane.to}?`,
      message: `${rows.reduce((n, r) => n + r.item.qty, 0).toLocaleString()} units across ${rows.length} line(s) will be written to the ledger as transfers (two entries each).`
        + (missing.length ? ` ${missing.length} code(s) have no stock record at ${lane.from} and will be skipped: ${missing.slice(0, 5).join(', ')}.` : ''),
      confirmText: 'Record transfers'
    });
    if (!ok) return;
    let done = 0; const failed: string[] = [];
    for (const r of rows) {
      try {
        await this.http.post(`${environment.apiUrl}/logistics/stock-movements/transfer`, {
          fromWarehouseId: lane.fromWarehouseId, toWarehouseId: lane.toWarehouseId, commodityId: r.inv.commodityId, quantity: r.item.qty,
          reference: 'Welly · ' + r.item.invoices.slice(0, 3).join(', '), reason: `Suggested by Welly to complete ${r.item.invoices.length} invoice(s)`
        }).toPromise();
        done++;
      } catch (e: any) { failed.push(`${r.item.code}: ${e?.error?.message || 'failed'}`); }
    }
    if (failed.length) this.toast.warn(`${done} transfer(s) recorded, ${failed.length} failed — ${failed.slice(0, 3).join('; ')}`);
    else this.toast.done(`${done} transfer(s) recorded ${lane.from} → ${lane.to}`);
    this.loadLedger(); this.loadDashboardData(); this.loadWarehouses();
  }

  /** Open the picking slip for the load linked to a ledger row */
  openLedgerLoadDoc(m: any): void {
    const load = this.loads.find(l => l.id === m.loadId);
    if (load) { this.openLoadDoc(load, 'picking'); }
    else { this.toast.warn(`Load #${m.loadId} not loaded in dispatch list`); }
  }

  openApproveDispatch(load: any): void {
    const whId = load.warehouseId;
    if (!whId) { this.toast.warn('This load has no originating warehouse set'); return; }
    // Auto re-link stop lines to stock items (by stored product code / invoice codes) before opening
    this.http.post<any>(`${environment.apiUrl}/logistics/stock-movements/loads/${load.id}/relink-lines`, {}).subscribe({
      next: r => {
        const linked = r?.linesLinked ?? 0, created = r?.commoditiesCreated ?? 0;
        if (linked > 0 || created > 0) {
          this.toast.done(`${linked} line(s) linked to stock${created ? `, ${created} stock item(s) created` : ''}`);
        }
        this.refreshAndOpenApprove(load.id, whId, linked > 0 || created > 0);
      },
      error: () => this.openApproveDialog(load, whId)
    });
  }

  private refreshAndOpenApprove(loadId: number, whId: number, refreshInventory: boolean): void {
    const openWithLoads = (loads: any[]) => {
      this.loads = loads || this.loads;
      const fresh = this.loads.find(l => l.id === loadId);
      if (!fresh) { this.toast.warn('Load no longer available'); return; }
      this.openApproveDialog(fresh, whId);
    };
    const fetchLoads = () => this.http.get<any[]>(`${environment.apiUrl}/logistics/loads`).subscribe({
      next: d => openWithLoads(d),
      error: () => openWithLoads(this.loads)
    });
    if (refreshInventory) {
      this.http.get<any[]>(`${environment.apiUrl}/warehouses/inventory`).subscribe({
        next: d => { this.allInventory = d || this.allInventory; fetchLoads(); },
        error: () => fetchLoads()
      });
    } else {
      fetchLoads();
    }
  }

  private openApproveDialog(load: any, whId: number): void {
    const ref = this.dialog.open(ApproveDispatchDialog, {
      width: '1100px', maxWidth: '96vw',
      data: { load, inventory: this.allInventory.filter(r => r.warehouseId === whId) }
    });
    ref.afterClosed().subscribe(done => {
      if (done) { this.deductedLoadIds.add(load.id); this.loadLedger(); this.loadDashboardData(); this.loadWarehouses(); }
    });
  }

  async reverseMovement(m: any): Promise<void> {
    const reason = await this.confirm.askText({
      title: `Reverse ${m.movementType} of ${m.quantity} × ${m.commodityCode}?`,
      label: 'Reason for reversal',
      required: true,
      confirmText: 'Reverse movement',
      danger: true
    });
    if (!reason || !reason.trim()) return;
    this.http.post(`${environment.apiUrl}/logistics/stock-movements/${m.id}/reverse`, { reason: reason.trim() }).subscribe({
      next: () => { this.toast.done('Movement reversed'); this.loadLedger(); this.loadDashboardData(); this.loadWarehouses(); },
      error: (e) => this.toast.error(e?.error?.message || 'Failed to reverse movement')
    });
  }

  get issuesScoped(): any[] {
    let rows = this.whFilterId ? this.issues.filter(i => i.warehouseId === this.whFilterId) : this.issues;
    if (this.companyFilter) {
      const key = this.companyFilter.toUpperCase();
      rows = rows.filter(i => (i.company || '').toUpperCase() === key);
    }
    return rows;
  }

  get issueRows(): any[] {
    let rows = this.issuesScoped;
    if (this.issueStatusFilter) rows = rows.filter(i => i.status === this.issueStatusFilter);
    const term = this.issueSearch.trim().toLowerCase();
    if (term) {
      rows = rows.filter(i =>
        (i.itemCode || '').toLowerCase().includes(term) ||
        (i.itemDescription || '').toLowerCase().includes(term) ||
        (i.issueType || '').toLowerCase().includes(term) ||
        (i.detail || '').toLowerCase().includes(term));
    }
    return rows;
  }

  get openIssueCount(): number { return this.issuesScoped.filter(i => i.status === 'Open' || i.status === 'InProgress').length; }
  issueCountByStatus(s: string): number { return this.issuesScoped.filter(i => i.status === s).length; }

  loadIssues(): void {
    this.issuesLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/logistics/stock-issues`).subscribe({
      next: d => { this.issues = d || []; this.issuesLoading = false; },
      error: () => { this.issues = []; this.issuesLoading = false; }
    });
  }

  openCreateIssue(): void {
    const ref = this.dialog.open(CreateIssueDialog, {
      width: '650px', maxWidth: '95vw',
      data: { warehouses: this.warehouses, companies: this.stockCompanies, defaultWarehouseId: this.whFilterId }
    });
    ref.afterClosed().subscribe(created => { if (created) this.loadIssues(); });
  }

  openResolveIssue(issue: any, status: 'Resolved' | 'Dismissed'): void {
    const ref = this.dialog.open(ResolveIssueDialog, { width: '560px', maxWidth: '95vw', data: { issue, status } });
    ref.afterClosed().subscribe(done => { if (done) this.loadIssues(); });
  }

  setIssueStatus(issue: any, status: string): void {
    this.http.put(`${environment.apiUrl}/logistics/stock-issues/${issue.id}/status`, { status }).subscribe({
      next: () => { issue.status = status; this.toast.done(`Issue marked ${status}`); },
      error: () => this.toast.error('Failed to update issue')
    });
  }

  exportIssues(): void {
    const rows = this.issueRows.map(i => ({
      'Date': i.issueDate ? String(i.issueDate).substring(0, 10) : '', 'Warehouse': i.warehouseName,
      'Company': i.company, 'Code': i.itemCode, 'Description': i.itemDescription,
      'Issue': i.issueType, 'Detail': i.detail, 'Status': i.status, 'Resolution': i.resolution || '', 'Resolved By': i.resolvedBy || ''
    }));
    this.writeExcel(rows, 'Issues', `Stock_Issues_${new Date().toISOString().substring(0, 10)}.xlsx`);
  }

  // ═══ Dispatch: tripsheets / picking slips / invoices from logistics ═══
  dispatchMode: 'tripsheets' | 'picking' | 'invoices' = 'tripsheets';
  dispatchDeductFilter: '' | 'pending' | 'done' | 'baseline' = '';
  dispatchSearch = '';
  loads: any[] = [];
  loadsLoading = true;

  get loadsScoped(): any[] {
    return this.whFilterId ? this.loads.filter(l => l.warehouseId === this.whFilterId) : this.loads;
  }

  private matchesDeductFilter(l: any): boolean {
    switch (this.dispatchDeductFilter) {
      case 'pending': return this.isLoadAwaiting(l);
      case 'done': return this.isLoadDeducted(l.id);
      case 'baseline': return this.isLoadBaseline(l);
      default: return true;
    }
  }

  /** Tripsheets after deduction-state filter and free-text search */
  get dispatchRows(): any[] {
    let rows = this.loadsScoped.filter(l => this.matchesDeductFilter(l));
    if (this.dispatchDeductFilter === 'pending') {
      // Delivered loads first: their stock is already gone, so they matter most
      const delivered = (l: any) => l.status === 'Delivered' || l.status === 'Completed' ? 1 : 0;
      rows = [...rows].sort((a, b) => delivered(b) - delivered(a)
        || new Date(this.loadDispatchDate(b) || 0).getTime() - new Date(this.loadDispatchDate(a) || 0).getTime());
    }
    const t = this.dispatchSearch.trim().toLowerCase();
    if (t) {
      rows = rows.filter(l =>
        (l.loadNumber || '').toLowerCase().includes(t) ||
        (l.customerName || '').toLowerCase().includes(t) ||
        (l.driverName || '').toLowerCase().includes(t) ||
        (l.vehicleRegistration || '').toLowerCase().includes(t) ||
        (l.stops || []).some((s: any) =>
          (s.invoiceNumber || '').toLowerCase().includes(t) ||
          (s.orderNumber || '').toLowerCase().includes(t) ||
          (s.customerName || s.companyName || s.locationName || '').toLowerCase().includes(t)));
    }
    return rows;
  }

  dispatchCount(kind: 'pending' | 'done' | 'baseline'): number {
    return this.loadsScoped.filter(l => kind === 'done' ? this.isLoadDeducted(l.id) : (kind === 'baseline' ? this.isLoadBaseline(l) : this.isLoadAwaiting(l))).length;
  }

  /** Flatten tripsheet stops into invoice rows (invoice numbers can be multi-valued per stop, or sit on the stop lines) */
  get dispatchInvoiceRows(): any[] {
    const rows: any[] = [];
    const t = this.dispatchSearch.trim().toLowerCase();
    for (const l of this.loadsScoped) {
      if (!this.matchesDeductFilter(l)) continue;
      for (const s of (l.stops || [])) {
        const set = new Set<string>();
        const push = (raw: string | null | undefined) =>
          (raw || '').split(/[\n,;\/]+/).map(x => x.trim()).filter(x => x).forEach(x => set.add(x));
        push(s.invoiceNumber);
        for (const c of (s.commodities || [])) push(c.invoiceNumber);
        for (const inv of set) {
          const row = {
            invoiceNumber: inv,
            orderNumber: (s.orderNumber || '').split(/[\n,;\/]+/)[0]?.trim() || '',
            customerName: s.customerName || s.companyName || s.locationName || l.customerName || '—',
            loadNumber: l.loadNumber,
            warehouseName: l.warehouseName,
            status: s.status || l.status,
            deducted: this.isLoadDeducted(l.id),
            deliveryDate: s.actualArrival || l.actualDeliveryDate || l.scheduledDeliveryDate,
            load: l
          };
          if (t && !(inv.toLowerCase().includes(t) || row.orderNumber.toLowerCase().includes(t) ||
                     row.customerName.toLowerCase().includes(t) || (l.loadNumber || '').toLowerCase().includes(t))) continue;
          rows.push(row);
        }
      }
    }
    return rows;
  }

  /** Open trip sheet or picking slip document for a load */
  openLoadDoc(load: any, kind: 'tripsheet' | 'picking'): void {
    const id = load.id;
    const url = kind === 'picking'
      ? `${environment.apiUrl}/logistics/tripsheet/${id}/picking-slip/pdf`
      : `${environment.apiUrl}/logistics/tripsheet/${id}/pdf`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const objUrl = URL.createObjectURL(blob);
        window.open(objUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(objUrl), 60000);
      },
      error: () => this.toast.error(`Could not load ${kind === 'picking' ? 'picking slip' : 'trip sheet'} for ${load.loadNumber}`)
    });
  }

  exportDispatch(): void {
    if (this.dispatchMode === 'invoices') {
      const rows = this.dispatchInvoiceRows.map(r => ({
        'Invoice #': r.invoiceNumber, 'Order #': r.orderNumber, 'Customer': r.customerName,
        'Load #': r.loadNumber, 'Warehouse': r.warehouseName, 'Status': r.status, 'Stock': r.deducted ? 'Deducted' : 'Awaiting',
        'Delivery': r.deliveryDate ? String(r.deliveryDate).substring(0, 10) : ''
      }));
      this.writeExcel(rows, 'Invoices', `Dispatch_Invoices_${new Date().toISOString().substring(0, 10)}.xlsx`);
      return;
    }
    const rows = this.dispatchRows.map(l => ({
      'Load #': l.loadNumber, 'Warehouse': l.warehouseName, 'Customer': l.customerName,
      'Driver': l.driverName, 'Vehicle': l.vehicleRegistration, 'Stops': l.stops?.length || 0,
      'Status': l.status, 'POD': l.hasPOD ? 'Yes' : 'No', 'Stock': this.loadStockState(l),
      'Delivery': (l.actualDeliveryDate || l.scheduledDeliveryDate) ? String(l.actualDeliveryDate || l.scheduledDeliveryDate).substring(0, 10) : ''
    }));
    this.writeExcel(rows, 'Tripsheets', `Tripsheets_${new Date().toISOString().substring(0, 10)}.xlsx`);
  }

  loadDashboardData(): void {
    this.invLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/inventory`).subscribe({
      next: d => { this.allInventory = d || []; this.invLoading = false; },
      error: () => { this.allInventory = []; this.invLoading = false; }
    });
    this.loadsLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/logistics/loads`).subscribe({
      next: d => { this.loads = d || []; this.loadsLoading = false; },
      error: () => { this.loads = []; this.loadsLoading = false; }
    });
    this.loadIssues();
    this.loadLedger();
    this.http.get<any>(`${environment.apiUrl}/logistics/stock-movements/can-approve`).subscribe({
      next: d => this.canApprove = !!d?.canApprove,
      error: () => this.canApprove = false
    });
  }

  /** Resolve target warehouse: the filtered card, or prompt the user to pick one */
  private resolveTargetWarehouse(): any | null {
    if (this.whFilterId) {
      return this.warehouses.find(x => x.id === this.whFilterId) || null;
    }
    if (this.warehouses.length === 1) return this.warehouses[0];
    this.toast.info('Click a warehouse card above to choose where this action happens');
    return null;
  }

  open3DView(warehouse: any): void {
    this.dialog.open(Warehouse3DDialog, {
      width: '96vw', maxWidth: '96vw', height: '90vh',
      panelClass: 'stk-3d-dialog-panel',
      data: warehouse
    });
  }

  openStockTakeForFilter(imported?: CountImportResult): void {
    const w = this.resolveTargetWarehouse();
    if (!w) return;
    const ref = this.dialog.open(StockTakeDialog, {
      width: '1200px', maxWidth: '95vw',
      data: { warehouse: w, inventory: this.allInventory.filter(r => r.warehouseId === w.id), imported }
    });
    ref.afterClosed().subscribe(done => { if (done) { this.loadLedger(); this.loadWarehouses(); this.loadDashboardData(); } });
  }

  // ═══ Stock count template + import ═══
  /** One count sheet per warehouse: every item, all companies, grouped by Company then Code. Only "Counted Qty" is filled in by the counter. */
  /** Stock Counts tab: open a datasheet of everything on hand at a warehouse (optionally one company only). */
  openWarehouseSheet(w: WarehouseSummary, company?: string): void {
    const rows = this.allInventory.filter(r => r.warehouseId === w.id);
    if (!rows.length) { this.toast.info(`No stock on hand recorded at ${w.name}`); return; }
    this.dialog.open(WarehouseStockSheetDialog, {
      width: '1200px', maxWidth: '96vw', maxHeight: '92vh',
      data: { warehouse: w, rows, company: company || '', invMatched: (c: string) => this.invMatched(c) }
    }).afterClosed().subscribe(res => { if (res === 'changed') { this.loadLedger(); this.loadWarehouses(); this.loadDashboardData(); } });
  }

  async downloadCountTemplate(): Promise<void> {
    const w = this.resolveTargetWarehouse();
    if (!w) return;
    const inv = this.allInventory.filter(r => r.warehouseId === w.id)
      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.commodityCode || '').localeCompare(b.commodityCode || ''));
    if (!inv.length) { this.toast.info('No stock items at this warehouse'); return; }
    const today = new Date().toISOString().substring(0, 10);
    const rows = inv.map(r => ({
      'Code': r.commodityCode || '', 'Description': r.commodityName || '', 'Company': r.category || '',
      'UOM': r.unitOfMeasure || 'Each', 'System Qty': +(r.quantityOnHand || 0), 'Counted Qty': '', 'Notes': ''
    }));
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 48 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 13 }, { wch: 30 }];
    const info = XLSX.utils.aoa_to_sheet([
      ['Stock Count Sheet'],
      ['Warehouse', w.name], ['Location', w.location || ''], ['Generated', today], ['Items', rows.length],
      [],
      ['How to use'],
      ['1.', 'Count the physical stock and type the quantity into the "Counted Qty" column on the "Count Sheet" tab.'],
      ['2.', 'Leave "Counted Qty" blank for any item you did not count — it will not be changed.'],
      ['3.', 'Type 0 if the item was counted and none was found.'],
      ['4.', 'Do not change the Code column — it is used to match the item on import.'],
      ['5.', 'Save the file, then in Stock Management → Stock Counts, select this warehouse and click "Import Count".'],
      ['6.', 'Review the variances on screen, enter a reason, and post. Each variance is written to the ledger as an Adjustment.']
    ]);
    info['!cols'] = [{ wch: 12 }, { wch: 110 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Count Sheet');
    XLSX.utils.book_append_sheet(wb, info, 'Instructions');
    const safe = (w.code || w.name || String(w.id)).replace(/[^A-Za-z0-9_-]+/g, '_');
    XLSX.writeFile(wb, `StockCount_${safe}_${today}.xlsx`);
    this.toast.done(`Count template for ${w.name} downloaded (${rows.length} items)`);
  }

  /** Importing a count overrides stock on hand — require the 4-digit unlock PIN before opening the file picker. */
  requestCountImport(fileInput: HTMLInputElement): void {
    const w = this.resolveTargetWarehouse();
    if (!w) return;
    const ref = this.dialog.open(CountImportPinDialog, { width: '360px', disableClose: true, data: { warehouse: w } });
    ref.afterClosed().subscribe(ok => { if (ok === true) fileInput.click(); });
  }

  /** Fill in missing unit prices from imported sales invoices (the green matched codes), PIN-gated. */
  requestApplyInvoicePrices(): void {
    const ref = this.dialog.open(CountImportPinDialog, {
      width: '360px', disableClose: true,
      data: { title: 'Apply Invoice Prices', message: 'This fills in the unit price on every stock line that has no price, using the average selling price from the imported sales invoices (matched by code — the green codes). Existing prices are never changed. Enter the PIN to continue.' }
    });
    ref.afterClosed().subscribe(ok => {
      if (ok !== true) return;
      this.toast.info('Matching invoice prices to unpriced stock…');
      this.http.post<any>(`${environment.apiUrl}/logistics/stock-movements/inventory/apply-invoice-prices`, {}).subscribe({
        next: res => {
          this.toast.done(`Invoice prices applied: ${res.matched} of ${res.totalUnpriced} unpriced lines now have a price (${res.stillUnpriced} still unpriced)`);
          this.loadWarehouses(); this.loadDashboardData();
          this.http.get<any[]>(`${environment.apiUrl}/warehouses/inventory`).subscribe({ next: d => this.allInventory = d || [], error: () => {} });
        },
        error: err => this.toast.error(err?.error?.message || 'Failed to apply invoice prices')
      });
    });
  }

  /** One-off repair: older loads get their missing stock lines and unlinked lines are linked by code. Previews first, PIN-gated. */
  requestBackfillStockLines(): void {
    const url = `${environment.apiUrl}/logistics/stock-movements/loads/backfill-stock-lines`;
    this.http.post<any>(`${url}?dryRun=true`, {}).subscribe({
      next: p => {
        if (!p.linesCreated && !p.existingLinked) {
          this.toast.info(`Nothing to link — ${p.stillUnlinked} line(s) still need linking by hand`);
          return;
        }
        const ref = this.dialog.open(CountImportPinDialog, {
          width: '380px', disableClose: true,
          data: {
            title: 'Link Stock Lines',
            message: `${p.loadsGivenLines} load(s) will get ${p.linesCreated} missing stock line(s) (${p.linesCreatedLinked} linked to a stock item), ` +
              `and ${p.existingLinked} of ${p.existingUnlinked} unlinked line(s) will be linked by product code. ` +
              `${p.stillUnlinked} line(s) will still need linking by hand. No stock is deducted. Enter the PIN to continue.`
          }
        });
        ref.afterClosed().subscribe(ok => {
          if (ok !== true) return;
          this.http.post<any>(`${url}?dryRun=false`, {}).subscribe({
            next: r => {
              this.toast.done(`Stock lines linked: ${r.linesCreated} created, ${r.existingLinked} linked (${r.stillUnlinked} still need linking)`);
              this.loadLedger(); this.loadDashboardData();
            },
            error: err => this.toast.error(err?.error?.message || 'Failed to link stock lines')
          });
        });
      },
      error: err => this.toast.error(err?.error?.message || 'Failed to check load stock lines')
    });
  }

  async onCountFileSelected(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const w = this.resolveTargetWarehouse();
    if (!w) return;
    try {
      const result = await parseCountSheet(file, this.allInventory.filter(r => r.warehouseId === w.id));
      if (!result.matched) {
        this.toast.warn(`No rows matched items at ${w.name}. Check the Code column and that the right warehouse is selected.`);
        return;
      }
      this.openStockTakeForFilter(result);
    } catch (e: any) {
      this.toast.error(e?.message || 'Could not read the count sheet');
    }
  }

  // ═══ Excel exports ═══
  private async writeExcel(rows: any[], sheet: string, file: string): Promise<void> {
    if (!rows.length) { this.toast.info('Nothing to export'); return; }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, file);
    this.toast.done(`Exported ${rows.length} rows`);
  }

  exportSoh(): void {
    const rows = this.sohRows.map(r => ({
      'Code': r.commodityCode, 'Description': r.commodityName, 'Company': r.category,
      'Warehouse': r.warehouseName, 'UOM': r.unitOfMeasure || 'Each',
      'Qty On Hand': r.quantityOnHand, 'Unit Price': r.unitPrice || '', 'Unit Cost': r.unitCost || '',
      'Stock Value': r.lineValue || '', 'Last Count': r.lastCountDate ? String(r.lastCountDate).substring(0, 10) : ''
    }));
    this.writeExcel(rows, 'Stock on Hand', `StockOnHand${this.whFilterId ? '-W' + this.whFilterId : ''}-${new Date().toISOString().substring(0, 10)}.xlsx`);
  }

  exportExceptions(): void {
    const all: any[] = [];
    (['out', 'neg', 'unpriced'] as const).forEach(mode => {
      this.excRowsFor(mode).forEach(r => all.push({
        'Issue': mode === 'out' ? 'Out of stock' : mode === 'neg' ? 'Negative stock' : 'No sales price',
        'Code': r.commodityCode, 'Description': r.commodityName, 'Company': r.category,
        'Warehouse': r.warehouseName, 'Qty On Hand': r.quantityOnHand
      }));
    });
    this.writeExcel(all, 'Exceptions', `StockExceptions-${new Date().toISOString().substring(0, 10)}.xlsx`);
  }

  exportMovements(): void {
    const rows = this.ledgerRows.map(m => ({
      'Date': m.createdAt ? String(m.createdAt).replace('T', ' ').substring(0, 16) : '',
      'What happened': this.movLabel(m), 'Type': m.movementType, 'Warehouse': m.warehouseName, 'Code': m.commodityCode,
      'Description': m.commodityName, 'Qty': m.quantity, 'Balance After': m.balanceAfter,
      'Reference': m.reference || '', 'Reason': m.reason || '', 'By': m.createdBy || '',
      'Reversed': m.reversedByMovementId ? 'Yes' : ''
    }));
    this.writeExcel(rows, 'Movements', `StockMovements-${new Date().toISOString().substring(0, 10)}.xlsx`);
  }

  exportValuation(): void {
    const rows: any[] = [];
    this.warehouses.forEach(w => {
      rows.push({
        'Warehouse': w.name, 'Company': 'ALL', 'Items': w.totalItems, 'In Stock': w.itemsInStock,
        'Out of Stock': w.itemsOutOfStock, 'Units On Hand': w.totalQuantityOnHand,
        'Stock Value (R)': w.totalStockValue, 'Cost Value (R)': w.totalCostValue,
        'Last Count': w.lastCountDate ? String(w.lastCountDate).substring(0, 10) : ''
      });
      (w.byClient || []).forEach(c => rows.push({
        'Warehouse': w.name, 'Company': c.client, 'Items': c.items, 'In Stock': c.itemsInStock,
        'Out of Stock': c.items - c.itemsInStock, 'Units On Hand': c.quantityOnHand,
        'Stock Value (R)': c.stockValue, 'Cost Value (R)': '', 'Last Count': ''
      }));
    });
    this.writeExcel(rows, 'Valuation', `StockValuation-${new Date().toISOString().substring(0, 10)}.xlsx`);
  }

  // Loading progress
  loadingProgress = 0;
  loadingStage = 0;
  loadingMessage = 'Initializing...';
  private progressInterval: any;
  readonly loadingSteps = [
    { icon: 'lock', label: 'Authenticating', detail: 'Securing connection...' },
    { icon: 'warehouse', label: 'Warehouses', detail: 'Loading warehouse data...' },
    { icon: 'inventory', label: 'Inventory', detail: 'Fetching stock levels...' },
    { icon: 'dashboard', label: 'Ready', detail: 'Building stock dashboard...' }
  ];

  constructor(
    private dialog: MatDialog,
    private http: HttpClient,
    private toast: ToastService
  ) {}

  // ---------- Sub-pages with their own addresses (design review D-12) ----------
  // /stock-management/<section>?<filters> picks the sub-page and its filters. The warehouse and
  // company filters apply to every sub-page, so the sub-page links carry them along. Moving
  // between sub-pages adds to the browser history; changing a filter replaces the current entry.

  readonly sections = STOCK_SECTIONS;
  readonly section = signal<StockSlug>('on-hand');
  readonly currentSection = computed(() => stockSection(this.section()));
  /** Each sub-page's filters as last used, so its link in the sub-navigation brings them back. */
  readonly sectionQuery = signal<Partial<Record<StockSlug, Params>>>({});

  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly subscriptions = new Subscription();
  private readonly filterWrites = new Subject<void>();
  private lastFilterKey = '';

  /** Sub-page links: each one's own filters, with the current warehouse and company. */
  linkQueries(): Partial<Record<StockSlug, Params>> {
    const shared = this.sharedQuery();
    const links: Partial<Record<StockSlug, Params>> = {};
    for (const s of STOCK_SECTIONS) {
      links[s.slug] = { ...this.sectionQuery()[s.slug], warehouse: shared['warehouse'] ?? null, company: shared['company'] ?? null };
    }
    return links;
  }

  /** Counts after the sub-page links, as the tabs had. */
  sectionCounts(): Partial<Record<StockSlug, number>> {
    return { issues: this.openIssueCount, dispatch: this.pendingDispatchCount };
  }

  /** Filters change from many fields and buttons, so look for a change once per check and follow it in the address. */
  ngDoCheck(): void {
    const key = JSON.stringify(this.currentQuery(this.section()));
    if (key !== this.lastFilterKey) {
      this.lastFilterKey = key;
      this.filterWrites.next();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  /** Reads the sub-page and its filters from the address. Runs after every navigation. */
  private applyUrl(): void {
    const section = stockSection(this.route.snapshot.firstChild?.paramMap.get('section'));
    if (!section) {
      // An old or mistyped address: open Stock where it normally opens rather than an empty page.
      this.router.navigate(['/stock-management', STOCK_SECTIONS[0].slug], { replaceUrl: true });
      return;
    }
    this.section.set(section.slug);
    const query = this.route.snapshot.queryParams;
    if (!isFilterRecord(this.router)) {
      this.applyFilters(section.slug, query);
    }
    this.sectionQuery.update(all => ({ ...all, [section.slug]: query }));
  }

  /** Sets the filters from the address. Filters missing from it go back to their defaults. */
  private applyFilters(slug: StockSlug, q: Params): void {
    const text = (key: string): string => queryText(q, key);
    const warehouse = Number(text('warehouse'));
    this.whFilterId = Number.isInteger(warehouse) && warehouse > 0 ? warehouse : null;
    this.companyFilter = text('company');
    switch (slug) {
      case 'on-hand':
        this.sohSearch = text('q');
        break;
      case 'issues': {
        // Open issues show by default; "all" in the address means no status filter.
        const status = text('status') || 'Open';
        this.issueStatusFilter = status === 'all' ? '' : status;
        this.issueSearch = text('q');
        break;
      }
      case 'exceptions': {
        const show = text('show');
        this.excMode = show === 'neg' || show === 'unpriced' ? show : 'out';
        break;
      }
      case 'movements':
        this.movTypeFilter = text('type');
        this.movSearch = text('q');
        break;
      case 'dispatch': {
        const deducted = text('deducted');
        this.dispatchDeductFilter = deducted === 'pending' || deducted === 'done' || deducted === 'baseline' ? deducted : '';
        this.dispatchSearch = text('q');
        break;
      }
      case 'reports': {
        const report = text('report');
        this.reportMode = report === 'activity' || report === 'dispatch' || report === 'exceptions' ? report : 'valuation';
        const days = Number(text('days') || 30);
        this.reportDays = [7, 30, 90, 0].includes(days) ? days : 30;
        break;
      }
    }
  }

  /** The warehouse and company filters, which every sub-page shares. */
  private sharedQuery(): Params {
    return toQuery({ warehouse: this.whFilterId ? String(this.whFilterId) : null, company: this.companyFilter });
  }

  /** A sub-page's filters as address parameters, leaving out the defaults. */
  private currentQuery(slug: StockSlug): Params {
    let own: Params = {};
    switch (slug) {
      case 'on-hand':
        own = toQuery({ q: this.sohSearch });
        break;
      case 'issues':
        own = toQuery({ status: this.issueStatusFilter || 'all', q: this.issueSearch }, { status: 'Open' });
        break;
      case 'exceptions':
        own = toQuery({ show: this.excMode }, { show: 'out' });
        break;
      case 'movements':
        own = toQuery({ type: this.movTypeFilter, q: this.movSearch });
        break;
      case 'dispatch':
        own = toQuery({ deducted: this.dispatchDeductFilter, q: this.dispatchSearch });
        break;
      case 'reports':
        own = toQuery({ report: this.reportMode, days: String(this.reportDays) }, { report: 'valuation', days: '30' });
        break;
    }
    return { ...this.sharedQuery(), ...own };
  }

  private writeFilters(): void {
    const slug = this.section();
    const query = this.currentQuery(slug);
    this.sectionQuery.update(all => ({ ...all, [slug]: query }));
    recordFilters(this.router, this.route, query);
  }

  ngOnInit(): void {
    this.applyUrl();
    this.subscriptions.add(this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => this.applyUrl()));
    this.subscriptions.add(this.filterWrites.pipe(debounceTime(250)).subscribe(() => this.writeFilters()));
    this.loadWarehouses();
    this.loadDashboardData();
    this.loadInvoiceCodes();
  }

  /** Codes that appear on imported sales invoices — used to colour stock codes green */
  invoiceCodes = new Set<string>();
  private static normCode(c: string): string { return (c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  invMatched(code: string | null | undefined): boolean {
    if (!code || !this.invoiceCodes.size) return false;
    const n = StockManagementComponent.normCode(code);
    if (!n) return false;
    if (this.invoiceCodes.has(n)) return true;
    // stock codes are often the invoice code padded with trailing zeros (e.g. RT320300100000 vs RT32-03-001)
    const trimmed = n.replace(/0+$/, '');
    return trimmed.length >= 4 && this.invoiceCodes.has(trimmed);
  }
  private loadInvoiceCodes(): void {
    this.http.get<string[]>(`${environment.apiUrl}/logistics/stock-movements/inventory/invoice-matched-codes`).subscribe({
      next: codes => {
        this.invoiceCodes = new Set<string>();
        for (const c of (codes || [])) {
          const n = StockManagementComponent.normCode(c);
          if (n) { this.invoiceCodes.add(n); const t = n.replace(/0+$/, ''); if (t.length >= 4) this.invoiceCodes.add(t); }
        }
      },
      error: () => {}
    });
  }

  // Invoice Fulfillment removed: stock now flows through the ledger (Movements / Dispatch).

  loadWarehouses(): void {
    this.loading = true;
    this.startLoadingProgress();
    this.http.get<WarehouseSummary[]>(`${environment.apiUrl}/warehouses/summary`).subscribe({
      next: (data) => {
        this.finishLoadingProgress(() => {
          this.warehouses = data;
          this.loading = false;
        });
      },
      error: (error) => {
        console.error('Error loading warehouses:', error);
        this.stopLoadingProgress();
        this.loading = false;
      }
    });
  }

  private startLoadingProgress(): void {
    this.loadingProgress = 0;
    this.loadingStage = 0;
    this.loadingMessage = this.loadingSteps[0].detail;
    this.progressInterval = setInterval(() => {
      const max = 88;
      if (this.loadingProgress < max) {
        const increment = Math.max(0.3, (max - this.loadingProgress) * 0.06);
        this.loadingProgress = Math.min(max, this.loadingProgress + increment);
      }
      const newStage = this.loadingProgress < 20 ? 0 : this.loadingProgress < 45 ? 1 : this.loadingProgress < 70 ? 2 : 3;
      if (newStage !== this.loadingStage) {
        this.loadingStage = newStage;
        this.loadingMessage = this.loadingSteps[newStage].detail;
      }
    }, 120);
  }

  private finishLoadingProgress(callback: () => void): void {
    clearInterval(this.progressInterval);
    this.loadingStage = 3;
    this.loadingMessage = 'Almost there...';
    const finish = setInterval(() => {
      this.loadingProgress = Math.min(100, this.loadingProgress + 4);
      if (this.loadingProgress >= 100) {
        clearInterval(finish);
        this.loadingMessage = 'Complete!';
        setTimeout(() => callback(), 300);
      }
    }, 30);
  }

  private stopLoadingProgress(): void {
    clearInterval(this.progressInterval);
    this.loadingProgress = 0;
    this.loadingStage = 0;
  }

  /** The warehouse currently focused via the card filter (drives header, Welly and action defaults) */
  get selectedWarehouse(): any | null {
    return this.whFilterId ? (this.warehouses.find(x => x.id === this.whFilterId) || null) : null;
  }

  // ═══════════════════════════════════════════
  // Welly AI Stock Analysis (Enhanced with Charts + PDF)
  // ═══════════════════════════════════════════

  showWellyPanel = false;
  wellyLoading = false;
  wellyResult = '';
  wellySummary: StockAnalysisSummary | null = null;
  wellyCharts: ComprehensiveAnalysisResponse['charts'] | null = null;
  private chartInstances: Chart[] = [];
  private wellyActivity = inject(WellyActivityService);
  private wellyActivityId: number | null = null;

  wellyAnalyzeStock(): void {
    if (!this.selectedWarehouse) return;
    this.showWellyPanel = true;
    this.wellyLoading = true;
    this.wellyResult = '';
    this.wellySummary = null;
    this.wellyCharts = null;
    this.destroyCharts();
    this.wellyActivityId = this.wellyActivity.start(`Analyzing stock: ${this.selectedWarehouse.name}`);

    this.http.post<ComprehensiveAnalysisResponse>(
      `${environment.apiUrl}/aichat/welly-stock-comprehensive`,
      { warehouseId: this.selectedWarehouse.id }
    ).subscribe({
      next: (res) => {
        this.wellyResult = res.analysis;
        this.wellySummary = res.summary;
        this.wellyCharts = res.charts;
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }

        // Render charts after DOM updates
        setTimeout(() => this.renderWellyCharts(), 150);
      },
      error: () => {
        this.toast.error('Welly could not analyze stock. Please try again.');
        this.wellyLoading = false;
        this.showWellyPanel = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      }
    });
  }

  private destroyCharts(): void {
    this.chartInstances.forEach(c => c.destroy());
    this.chartInstances = [];
  }

  closeWellyPanel(): void {
    this.showWellyPanel = false;
    this.destroyCharts();
  }

  private readonly chartColors = [
    '#2563eb', '#1e40af', '#43a047', '#ff9800', '#ef5350',
    '#26a69a', '#7e57c2', '#5c6bc0', '#ec407a', '#66bb6a',
    '#ffa726', '#42a5f5', '#ab47bc', '#26c6da', '#8d6e63'
  ];

  private renderWellyCharts(): void {
    if (!this.wellyCharts) return;
    this.destroyCharts();

    // Chart 1: Stock by Building (doughnut)
    const c1 = this.createChart('chart-stock-building', 'doughnut',
      this.wellyCharts.stockByBuilding.labels,
      this.wellyCharts.stockByBuilding.values,
      'Stock Value (R)');

    // Chart 2: Top Items (horizontal bar)
    const c2 = this.createChart('chart-top-items', 'bar',
      this.wellyCharts.topItems.labels,
      this.wellyCharts.topItems.values,
      'Value (R)', true);

    // Chart 3: Invoice Status (doughnut)
    const c3 = this.createChart('chart-invoice-status', 'doughnut',
      this.wellyCharts.invoiceStatus.labels,
      this.wellyCharts.invoiceStatus.values,
      'Invoices');

    // Chart 4: Load Status (doughnut)
    const c4 = this.createChart('chart-load-status', 'doughnut',
      this.wellyCharts.loadStatus.labels,
      this.wellyCharts.loadStatus.values,
      'TripSheets');

    if (c1) this.chartInstances.push(c1);
    if (c2) this.chartInstances.push(c2);
    if (c3) this.chartInstances.push(c3);
    if (c4) this.chartInstances.push(c4);
  }

  private createChart(canvasId: string, type: 'doughnut' | 'bar', labels: string[], values: number[], label: string, horizontal = false): Chart | null {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas || !labels?.length) return null;

    const colors = labels.map((_, i) => this.chartColors[i % this.chartColors.length]);

    if (type === 'doughnut') {
      return new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12, boxWidth: 12 } }
          }
        }
      });
    } else {
      return new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label,
            data: values,
            backgroundColor: colors,
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          indexAxis: horizontal ? 'y' : 'x',
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: !horizontal }, ticks: { font: { size: 10 } } },
            y: { grid: { display: horizontal }, ticks: { font: { size: 10 } } }
          }
        }
      });
    }
  }

  async downloadWellyPdf(): Promise<void> {
    const element = document.getElementById('welly-analysis-content');
    if (!element) return;

    this.toast.info('Generating PDF...');

    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#f5f5f7',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth() - 20;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight() - 20;

      let yOffset = 10;
      let remainingHeight = pdfHeight;

      // Add title
      pdf.setFontSize(10);
      pdf.setTextColor(100);
      pdf.text(`ProMed Technologies — Welly Stock Analysis`, 10, 8);
      pdf.text(`${this.selectedWarehouse?.name || 'Warehouse'} — ${new Date().toLocaleDateString()}`, 10, 13);
      yOffset = 16;

      // Multi-page support
      while (remainingHeight > 0) {
        const sourceY = (pdfHeight - remainingHeight) * (canvas.height / pdfHeight);
        const sourceHeight = Math.min(pageHeight, remainingHeight) * (canvas.height / pdfHeight);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          const pageImgData = pageCanvas.toDataURL('image/png');
          const drawHeight = Math.min(pageHeight, remainingHeight);
          pdf.addImage(pageImgData, 'PNG', 10, yOffset, pdfWidth, drawHeight);
        }

        remainingHeight -= pageHeight;
        if (remainingHeight > 0) {
          pdf.addPage();
          yOffset = 10;
        }
      }

      const filename = `Stock-Analysis-${(this.selectedWarehouse?.name || 'Report').replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
      this.toast.done('PDF downloaded');
    } catch (err) {
      console.error('PDF generation error:', err);
      this.toast.error('Failed to generate PDF. Please try again.');
    }
  }

  copyWellyResult(): void {
    navigator.clipboard.writeText(this.wellyResult).then(() => {
      this.toast.done('Copied to clipboard');
    });
  }
}

// ═══ Stock count sheet parser ═══
export interface CountImportResult {
  fileName: string;
  /** commodityId -> counted quantity */
  counts: Map<number, number>;
  matched: number;
  skipped: number;      // rows with blank Counted Qty
  unmatched: string[];  // codes not found at this warehouse
  invalid: string[];    // codes whose Counted Qty was not a number
}

/** Reads a completed count sheet (Code + Counted Qty columns) and matches rows to the warehouse inventory by item code. */
async function parseCountSheet(file: File, inventory: any[]): Promise<CountImportResult> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().replace(/\s+/g, '') === 'countsheet') || wb.SheetNames[0];
  const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!rows.length) throw new Error('The count sheet is empty');

  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const headers = Object.keys(rows[0]);
  const codeCol = headers.find(h => ['code', 'itemcode', 'commoditycode', 'stockcode', 'sku'].includes(norm(h)));
  const qtyCol = headers.find(h => ['countedqty', 'counted', 'countedquantity', 'count', 'physicalqty', 'physical', 'actualqty', 'actual'].includes(norm(h)));
  if (!codeCol) throw new Error('Could not find a "Code" column in the sheet');
  if (!qtyCol) throw new Error('Could not find a "Counted Qty" column in the sheet');

  const byCode = new Map<string, number>();
  for (const r of inventory) if (r.commodityCode) byCode.set(norm(r.commodityCode), r.commodityId);

  const result: CountImportResult = { fileName: file.name, counts: new Map(), matched: 0, skipped: 0, unmatched: [], invalid: [] };
  for (const r of rows) {
    const code = String(r[codeCol] ?? '').trim();
    if (!code) continue;
    const raw = r[qtyCol];
    if (raw === '' || raw === null || raw === undefined) { result.skipped++; continue; }
    const qty = typeof raw === 'number' ? raw : Number(String(raw).replace(/[,\s]/g, ''));
    if (!Number.isFinite(qty) || qty < 0) { result.invalid.push(code); continue; }
    const id = byCode.get(norm(code));
    if (id === undefined) { result.unmatched.push(code); continue; }
    result.counts.set(id, qty);
    result.matched++;
  }
  return result;
}

// ═══ Warehouse stock-on-hand datasheet (opened from Stock Counts) ═══
@Component({
  selector: 'warehouse-stock-sheet-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatTooltipModule, EmptyStateComponent],
  template: `
    <div class="ws-head">
      <div class="ws-title">
        <mat-icon>warehouse</mat-icon>
        <div>
          <h2>{{ data.warehouse.name }}</h2>
          <span>{{ data.warehouse.location || 'Stock on hand datasheet' }}</span>
        </div>
      </div>
      <button aria-label="Close" mat-icon-button (click)="dialogRef.close(changed ? 'changed' : undefined)" matTooltip="Close"><mat-icon>close</mat-icon></button>
    </div>

    <div class="ws-companies">
      <button type="button" class="ws-chip" [class.active]="company === ''" (click)="company = ''">All companies <b>{{ data.rows.length }}</b></button>
      @for (c of companies; track c.name) {
        <button type="button" class="ws-chip" [class.active]="company === c.name" (click)="company = company === c.name ? '' : c.name">{{ c.name }} <b>{{ c.items }}</b></button>
      }
    </div>

    <div class="ws-kpis">
      <div><b>{{ filtered.length | number }}</b><span>Items</span></div>
      <div><b>{{ sum('quantityOnHand') | number:'1.0-0' }}</b><span>Units on hand</span></div>
      <div><b>{{ inStock | number }}</b><span>In stock</span></div>
      <div [class.warn]="outOfStock > 0"><b>{{ outOfStock | number }}</b><span>Out of stock</span></div>
      <div><b>{{ money(sum('lineValue')) }}</b><span>Stock value</span></div>
    </div>

    <div class="ws-toolbar">
      <mat-form-field appearance="outline" class="ws-search">
        <mat-label>Search code or description</mat-label>
        <input matInput [(ngModel)]="search">
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>
      <label class="ws-toggle"><input type="checkbox" [(ngModel)]="hideZero"> Hide zero quantities</label>
      <span style="flex:1"></span>
      @if (unlocked) {
        <span class="ws-unlocked"><mat-icon>lock_open</mat-icon> Editing unlocked — double-click a cell to edit, Enter to save, Esc to cancel</span>
      } @else {
        <span class="ws-locked"><mat-icon>lock</mat-icon> Double-click any cell to unlock editing (PIN)</span>
      }
      <button mat-stroked-button (click)="exportSheet()"><mat-icon>file_download</mat-icon> Export</button>
    </div>

    <mat-dialog-content class="ws-body">
      <table class="app-table ws-table" [class.editable]="unlocked">
        <thead><tr>
          <th (click)="sortBy('commodityCode')">Code {{ arrow('commodityCode') }}</th>
          <th (click)="sortBy('commodityName')">Description {{ arrow('commodityName') }}</th>
          <th (click)="sortBy('category')">Company {{ arrow('category') }}</th>
          <th>UOM</th>
          <th class="num" (click)="sortBy('quantityOnHand')">Qty On Hand {{ arrow('quantityOnHand') }}</th>
          <th class="num" (click)="sortBy('unitPrice')">Unit Price {{ arrow('unitPrice') }}</th>
          <th class="num" (click)="sortBy('lineValue')">Value {{ arrow('lineValue') }}</th>
          <th>Bin</th>
          <th (click)="sortBy('lastCountDate')">Last Count {{ arrow('lastCountDate') }}</th>
        </tr></thead>
        <tbody>
          @for (r of filtered; track r.id) {
            <tr [class.zero]="!r.quantityOnHand" [class.saving]="savingId === r.id">
              <td class="ref edit" [class.code-inv]="isInvMatched(r.commodityCode)" (dblclick)="beginEdit(r, 'commodityCode')"
                  [matTooltip]="isInvMatched(r.commodityCode) ? 'Code found on sales invoices' : ''">
                @if (isEditing(r, 'commodityCode')) { <input class="ws-input" [(ngModel)]="editValue" (keydown)="editKey($event, r)" (blur)="commit(r)" autofocus> }
                @else { {{ r.commodityCode || '—' }} }
              </td>
              <td class="desc edit" (dblclick)="beginEdit(r, 'commodityName')">
                @if (isEditing(r, 'commodityName')) { <input class="ws-input" [(ngModel)]="editValue" (keydown)="editKey($event, r)" (blur)="commit(r)" autofocus> }
                @else { {{ r.commodityName }} }
              </td>
              <td class="edit" (dblclick)="beginEdit(r, 'category')">
                @if (isEditing(r, 'category')) { <input class="ws-input" [(ngModel)]="editValue" (keydown)="editKey($event, r)" (blur)="commit(r)" list="ws-companies" autofocus> }
                @else { <span class="ws-tag">{{ r.category || '—' }}</span> }
              </td>
              <td class="edit" (dblclick)="beginEdit(r, 'unitOfMeasure')">
                @if (isEditing(r, 'unitOfMeasure')) { <input class="ws-input" [(ngModel)]="editValue" (keydown)="editKey($event, r)" (blur)="commit(r)" autofocus> }
                @else { {{ r.unitOfMeasure || 'Each' }} }
              </td>
              <td class="num qty edit" (dblclick)="beginEdit(r, 'quantityOnHand')">
                @if (isEditing(r, 'quantityOnHand')) { <input class="ws-input num" type="number" min="0" step="any" [(ngModel)]="editValue" (keydown)="editKey($event, r)" (blur)="commit(r)" autofocus> }
                @else { {{ r.quantityOnHand | number:'1.0-2' }} }
              </td>
              <td class="num edit" [class.noprice]="!r.unitPrice" (dblclick)="beginEdit(r, 'unitPrice')" [matTooltip]="r.unitPrice ? 'Double-click to override the unit price' : 'No price on file — double-click to enter one so value can be calculated'">
                @if (isEditing(r, 'unitPrice')) { <input class="ws-input num" type="number" min="0" step="0.01" [(ngModel)]="editValue" (keydown)="editKey($event, r)" (blur)="commit(r)" autofocus> }
                @else { {{ r.unitPrice ? money(r.unitPrice) : 'No price' }} }
              </td>
              <td class="num ro" matTooltip="Qty × unit price — calculated">{{ r.lineValue ? money(r.lineValue) : '—' }}</td>
              <td class="edit" (dblclick)="beginEdit(r, 'binLocation')">
                @if (isEditing(r, 'binLocation')) { <input class="ws-input" [(ngModel)]="editValue" (keydown)="editKey($event, r)" (blur)="commit(r)" autofocus> }
                @else { {{ r.binLocation || '—' }} }
              </td>
              <td class="ro" matTooltip="Set automatically when the quantity is edited or counted">{{ r.lastCountDate ? (r.lastCountDate | date:'dd MMM yyyy') : '—' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="9"><app-empty-state compact icon="search_off" title="No items match" [message]="search || company || hideZero ? 'No item matches the current filters.' : 'This warehouse has no items.'">
                  @if (search || company || hideZero) { <button mat-stroked-button (click)="search = ''; company = ''; hideZero = false">Clear the filters</button> }
                </app-empty-state></td></tr>
          }
        </tbody>
        @if (filtered.length) {
          <tfoot><tr>
            <td colspan="4"><b>Total · {{ filtered.length | number }} items</b></td>
            <td class="num qty"><b>{{ sum('quantityOnHand') | number:'1.0-2' }}</b></td>
            <td></td>
            <td class="num"><b>{{ money(sum('lineValue')) }}</b></td>
            <td colspan="2"></td>
          </tr></tfoot>
        }
      </table>
      <datalist id="ws-companies">@for (c of companies; track c.name) { <option [value]="c.name"></option> }</datalist>
    </mat-dialog-content>
  `,
  styles: [`
    :host { display: block; }
    .ws-locked, .ws-unlocked { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 600; border-radius: 999px; padding: 4px 12px; }
    .ws-locked { color: var(--color-text-3); background: var(--color-surface-2); }
    .ws-unlocked { color: var(--color-ok); background: var(--color-ok-soft); }
    .ws-locked mat-icon, .ws-unlocked mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; }
    .ws-table.editable td.edit { cursor: cell; }
    .ws-table.editable td.edit:hover { outline: 2px solid var(--color-primary); outline-offset: -2px; background: var(--color-primary-soft); }
    .ws-table td.ro { color: var(--color-text-3); font-style: italic; }
    .ws-table td.noprice { color: var(--color-warn); font-weight: 600; font-size: var(--text-xs); }
    .ws-table tr.saving td { opacity: .5; }
    .ws-input { width: 100%; box-sizing: border-box; border: 2px solid var(--color-primary); border-radius: var(--radius-sm); padding: 5px 8px; font: inherit; font-size: var(--text-sm); background: var(--color-surface); color: var(--color-text); }
    .ws-input.num { text-align: right; font-weight: 700; }
    .ws-input:focus { outline: none; box-shadow: 0 0 0 2px var(--color-focus); }
    .ws-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 24px 10px; }
    .ws-title { display: flex; align-items: center; gap: 14px; }
    .ws-title > mat-icon { font-size: var(--text-4xl); width: 32px; height: 32px; color: var(--color-primary); }
    .ws-title h2 { margin: 0; font-size: var(--text-2xl); font-weight: 800; color: var(--color-text); }
    .ws-title span { font-size: var(--text-xs); color: var(--color-text-3); }
    .ws-companies { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 24px 12px; }
    .ws-chip { border: 1.5px solid var(--color-line-strong); background: var(--color-surface); border-radius: 999px; padding: 6px 14px; font-size: var(--text-sm); font-weight: 600; color: var(--color-text-2); cursor: pointer; display: inline-flex; gap: 6px; align-items: center; }
    .ws-chip b { background: var(--color-line); border-radius: 999px; padding: 0 8px; font-size: var(--text-xs); }
    .ws-chip:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .ws-chip.active { background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
    .ws-chip.active b { background: var(--color-on-primary); color: var(--color-primary); }
    .ws-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; padding: 0 24px 12px; }
    .ws-kpis > div { background: var(--color-surface-2); border-radius: var(--radius-md); padding: 10px 14px; display: flex; flex-direction: column; }
    .ws-kpis b { font-size: var(--text-2xl); font-weight: 800; color: var(--color-text); line-height: 1.1; }
    .ws-kpis span { font-size: var(--text-xs); color: var(--color-text-3); text-transform: uppercase; letter-spacing: .04em; margin-top: 2px; }
    .ws-kpis .warn b { color: var(--color-danger); }
    .ws-toolbar { display: flex; align-items: center; gap: 14px; padding: 0 24px 6px; }
    .ws-search { width: 340px; }
    .ws-search ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .ws-toggle { font-size: var(--text-sm); color: var(--color-text-2); display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .ws-body { padding: 0 24px 20px !important; max-height: 60vh; }
    .ws-table th { cursor: pointer; user-select: none; }
    .ws-table tr.zero td { color: var(--color-text-3); }
    .ws-table tr.zero td.qty { color: var(--color-danger); font-weight: 700; }
    .ws-table td.qty { font-weight: 700; font-size: var(--text-md); }
    .ws-table td.ref.code-inv { color: var(--color-ok); font-weight: 800; }
    .ws-table td.desc { max-width: 420px; }
    .ws-tag { background: var(--color-primary-soft); color: var(--color-primary); border-radius: var(--radius-sm); padding: 2px 8px; font-size: var(--text-xs); font-weight: 600; }
  `]
})
export class WarehouseStockSheetDialog {
  company = '';
  search = '';
  hideZero = false;
  sortKey: keyof WarehouseInventory = 'commodityCode';
  sortDir: 1 | -1 = 1;
  companies: { name: string; items: number }[] = [];

  // ── PIN-gated inline editing ──
  unlocked = false;
  editingId: number | null = null;
  editingField: string | null = null;
  editValue: any = '';
  savingId: number | null = null;
  changed = false;
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private dialog = inject(MatDialog);

  constructor(public dialogRef: MatDialogRef<WarehouseStockSheetDialog>,
              @Inject(MAT_DIALOG_DATA) public data: { warehouse: WarehouseSummary; rows: WarehouseInventory[]; company: string; invMatched?: (c: string) => boolean }) {
    this.company = data.company || '';
    this.rebuildCompanies();
    if (this.company && !this.companies.some(c => c.name === this.company)) this.company = '';
    dialogRef.disableClose = true;
    dialogRef.backdropClick().subscribe(() => dialogRef.close(this.changed ? 'changed' : undefined));
    dialogRef.keydownEvents().subscribe(e => { if (e.key === 'Escape' && this.editingId === null) dialogRef.close(this.changed ? 'changed' : undefined); });
  }

  isInvMatched(code: string | null | undefined): boolean { return !!code && !!this.data.invMatched && this.data.invMatched(code); }

  private rebuildCompanies(): void {
    const map = new Map<string, number>();
    for (const r of this.data.rows) { const k = r.category || 'Unassigned'; map.set(k, (map.get(k) || 0) + 1); }
    this.companies = [...map.entries()].map(([name, items]) => ({ name, items })).sort((a, b) => a.name.localeCompare(b.name));
  }

  isEditing(r: WarehouseInventory, f: string): boolean { return this.editingId === r.id && this.editingField === f; }

  beginEdit(r: WarehouseInventory, field: string): void {
    if (this.savingId) return;
    if (!this.unlocked) {
      const ref = this.dialog.open(CountImportPinDialog, {
        width: '360px', disableClose: true,
        data: { warehouse: this.data.warehouse, title: 'Unlock Editing',
                message: `Editing this datasheet changes <b>live stock data</b> at <b>${this.data.warehouse.name}</b>. Quantity changes are posted to the ledger as adjustments.<br>Enter the 4-digit PIN to continue.` }
      });
      ref.afterClosed().subscribe(ok => { if (ok === true) { this.unlocked = true; this.startEdit(r, field); } });
      return;
    }
    this.startEdit(r, field);
  }

  private startEdit(r: WarehouseInventory, field: string): void {
    this.editingId = r.id; this.editingField = field;
    const v: any = (r as any)[field];
    this.editValue = field === 'quantityOnHand' ? (v ?? 0) : field === 'unitPrice' ? (v ?? '') : (v ?? '');
    setTimeout(() => { const el = document.querySelector('.ws-input') as HTMLInputElement | null; el?.focus(); el?.select(); }, 0);
  }

  editKey(ev: KeyboardEvent, r: WarehouseInventory): void {
    if (ev.key === 'Enter') { ev.preventDefault(); this.commit(r); }
    else if (ev.key === 'Escape') { ev.preventDefault(); this.cancelEdit(); }
  }

  cancelEdit(): void { this.editingId = null; this.editingField = null; this.editValue = ''; }

  commit(r: WarehouseInventory): void {
    if (this.editingId !== r.id || !this.editingField) return;
    const field = this.editingField;
    const raw = this.editValue;
    const current: any = (r as any)[field];
    const isNum = field === 'quantityOnHand' || field === 'unitPrice';
    const newStr = isNum ? (raw === '' || raw === null || raw === undefined ? '' : String(+raw)) : String(raw ?? '').trim();
    const curStr = isNum ? (current === null || current === undefined ? '' : String(+current)) : String(current ?? '').trim();
    this.cancelEdit();
    if (newStr === curStr) return;
    if (field === 'quantityOnHand' && (isNaN(+raw) || +raw < 0)) { this.toast.warn('Quantity must be 0 or more'); return; }
    if (field === 'unitPrice' && newStr !== '' && (isNaN(+raw) || +raw < 0)) { this.toast.warn('Unit price must be 0 or more'); return; }

    this.savingId = r.id;
    this.http.patch<any>(`${environment.apiUrl}/logistics/stock-movements/inventory/${r.id}/cell`, { field, value: newStr }).subscribe({
      next: res => {
        this.savingId = null; this.changed = true;
        r.commodityCode = res.commodityCode; r.commodityName = res.commodityName; r.category = res.category;
        r.unitOfMeasure = res.unitOfMeasure; r.quantityOnHand = +res.quantityOnHand; r.binLocation = res.binLocation; r.lastCountDate = res.lastCountDate;
        if (field === 'unitPrice') r.unitPrice = res.unitPrice != null ? +res.unitPrice : undefined;
        r.lineValue = r.unitPrice ? Math.round(r.quantityOnHand * r.unitPrice * 100) / 100 : undefined;
        if (field === 'category') this.rebuildCompanies();
        this.toast.done(
          field === 'quantityOnHand' ? 'Quantity updated — adjustment posted to ledger, last count set to today'
          : field === 'unitPrice' ? (newStr === '' ? 'Price override cleared' : `Unit price set — value now ${this.money(r.lineValue || 0)}`)
          : 'Saved');
      },
      error: e => { this.savingId = null; this.toast.error(e?.error?.message || 'Failed to save'); }
    });
  }

  get filtered(): WarehouseInventory[] {
    const q = this.search.trim().toLowerCase();
    let rows = this.data.rows.filter(r =>
      (!this.company || (r.category || 'Unassigned') === this.company) &&
      (!this.hideZero || (r.quantityOnHand || 0) !== 0) &&
      (!q || (r.commodityCode || '').toLowerCase().includes(q) || (r.commodityName || '').toLowerCase().includes(q)));
    const k = this.sortKey, d = this.sortDir;
    rows = [...rows].sort((a, b) => {
      const av: any = a[k] ?? '', bv: any = b[k] ?? '';
      if (typeof av === 'number' || typeof bv === 'number') return ((+av || 0) - (+bv || 0)) * d;
      return String(av).localeCompare(String(bv)) * d;
    });
    return rows;
  }
  get inStock(): number { return this.filtered.filter(r => (r.quantityOnHand || 0) > 0).length; }
  get outOfStock(): number { return this.filtered.filter(r => !(r.quantityOnHand || 0)).length; }
  sum(k: 'quantityOnHand' | 'lineValue'): number { return this.filtered.reduce((s, r) => s + (+(r[k] || 0)), 0); }
  money(v: number): string { return 'R ' + (v || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  sortBy(k: keyof WarehouseInventory): void { if (this.sortKey === k) this.sortDir = this.sortDir === 1 ? -1 : 1; else { this.sortKey = k; this.sortDir = 1; } }
  arrow(k: keyof WarehouseInventory): string { return this.sortKey === k ? (this.sortDir === 1 ? '▲' : '▼') : ''; }

  async exportSheet(): Promise<void> {
    const rows = this.filtered.map(r => ({
      'Code': r.commodityCode || '', 'Description': r.commodityName || '', 'Company': r.category || '',
      'UOM': r.unitOfMeasure || 'Each', 'Qty On Hand': +(r.quantityOnHand || 0),
      'Unit Price': r.unitPrice || '', 'Stock Value': r.lineValue || '', 'Bin': r.binLocation || '',
      'Last Count': r.lastCountDate ? String(r.lastCountDate).substring(0, 10) : ''
    }));
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 48 }, { wch: 16 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock on Hand');
    const safe = (s: string) => s.replace(/[^A-Za-z0-9_-]+/g, '_');
    XLSX.writeFile(wb, `SOH_${safe(this.data.warehouse.name)}${this.company ? '_' + safe(this.company) : ''}_${new Date().toISOString().substring(0, 10)}.xlsx`);
  }
}

// ═══ Stock count import PIN dialog ═══
const COUNT_IMPORT_PIN = '2630';

@Component({
  selector: 'count-import-pin-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title><mat-icon style="vertical-align:middle;margin-right:8px;color:var(--color-warn);">lock</mat-icon> {{ data.title || 'Unlock Import' }}</h2>
    <mat-dialog-content class="pin-body">
      @if (data.message) { <p [innerHTML]="data.message"></p> }
      @else { <p>Importing a stock count will <b>override stock on hand</b> at <b>{{ data.warehouse.name }}</b>.<br>Enter the 4-digit PIN to continue.</p> }
      <div class="pin-boxes" [class.shake]="error">
        @for (i of [0,1,2,3]; track i) {
          <input #box class="pin-box" type="password" inputmode="numeric" maxlength="1" autocomplete="off"
                 [value]="digits[i]" (input)="onDigit(i, $event, box)" (keydown)="onKey(i, $event, box)" (focus)="box.select()">
        }
      </div>
      @if (error) { <div class="pin-error"><mat-icon>error</mat-icon> Incorrect PIN</div> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close(false)">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="digits.join('').length < 4" (click)="submit()"><mat-icon>lock_open</mat-icon> Unlock</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .pin-body p { font-size: var(--text-sm); color: var(--color-text-2); margin: 0 0 16px; line-height: 1.5; }
    .pin-boxes { display: flex; gap: 12px; justify-content: center; margin-bottom: 8px; }
    .pin-box { width: 52px; height: 60px; text-align: center; font-size: var(--text-3xl); font-weight: 700; border: 2px solid var(--color-line-strong); border-radius: var(--radius-md); letter-spacing: 0; background: var(--color-surface); color: var(--color-text); }
    .pin-box:focus { outline: none; border-color: var(--color-warn); box-shadow: 0 0 0 3px var(--color-warn-soft); }
    .pin-error { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--color-danger); font-size: var(--text-sm); font-weight: 600; margin-top: 6px; }
    .pin-error mat-icon { font-size: var(--text-xl); width: 18px; height: 18px; }
    .shake { animation: shake .35s; }
    @keyframes shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-6px); } 40%,80% { transform: translateX(6px); } }
  `]
})
export class CountImportPinDialog {
  digits: string[] = ['', '', '', ''];
  error = false;
  constructor(public dialogRef: MatDialogRef<CountImportPinDialog>, @Inject(MAT_DIALOG_DATA) public data: any) {}

  onDigit(i: number, ev: Event, box: HTMLInputElement): void {
    const v = (ev.target as HTMLInputElement).value.replace(/\D/g, '').slice(-1);
    this.digits[i] = v;
    box.value = v;
    this.error = false;
    if (v) {
      const next = box.nextElementSibling as HTMLInputElement | null;
      if (next) next.focus(); else if (this.digits.join('').length === 4) this.submit();
    }
  }

  onKey(i: number, ev: KeyboardEvent, box: HTMLInputElement): void {
    if (ev.key === 'Backspace' && !this.digits[i]) {
      const prev = box.previousElementSibling as HTMLInputElement | null;
      if (prev) { prev.focus(); }
    } else if (ev.key === 'Enter') { this.submit(); }
  }

  submit(): void {
    if (this.digits.join('') === COUNT_IMPORT_PIN) { this.dialogRef.close(true); return; }
    this.error = true;
    this.digits = ['', '', '', ''];
    setTimeout(() => (document.querySelector('.pin-box') as HTMLInputElement | null)?.focus(), 0);
  }
}

// Stock Take Dialog Component — counts against WarehouseInventory, posts variances to the ledger
@Component({
  selector: 'stock-take-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
    EmptyStateComponent
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:var(--color-warn);">fact_check</mat-icon>
      Stock Take — {{ data.warehouse.name }}
    </h2>
    <mat-dialog-content>
      @if (data.imported) {
        <div class="st-import">
          <mat-icon>upload_file</mat-icon>
          <div>
            <b>Imported {{ data.imported.fileName }}</b> — {{ data.imported.matched }} item(s) counted,
            {{ data.imported.skipped }} left blank (unchanged)
            @if (data.imported.unmatched.length) { · <span class="st-warn">{{ data.imported.unmatched.length }} code(s) not found at this warehouse</span> }
            @if (data.imported.invalid.length) { · <span class="st-warn">{{ data.imported.invalid.length }} row(s) with an invalid quantity</span> }
            @if (data.imported.unmatched.length || data.imported.invalid.length) {
              <div class="st-import-detail">
                @if (data.imported.unmatched.length) { <span>Not found: {{ data.imported.unmatched.slice(0, 15).join(', ') }}{{ data.imported.unmatched.length > 15 ? ' …' : '' }}</span> }
                @if (data.imported.invalid.length) { <span>Invalid qty: {{ data.imported.invalid.slice(0, 15).join(', ') }}{{ data.imported.invalid.length > 15 ? ' …' : '' }}</span> }
              </div>
            }
          </div>
        </div>
      }
      <div class="st-bar">
        <mat-form-field appearance="outline" class="st-search">
          <mat-label>Filter items</mat-label>
          <input matInput [(ngModel)]="searchQuery" placeholder="Code, description or company">
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>
        <mat-form-field appearance="outline" class="st-ref">
          <mat-label>Count reference</mat-label>
          <input matInput [(ngModel)]="reference">
        </mat-form-field>
        <button mat-stroked-button [class.st-on]="onlyCounted" (click)="onlyCounted = !onlyCounted" matTooltip="Show only lines you have counted">
          <mat-icon>edit_note</mat-icon> Counted ({{ countedCount() }})</button>
        <button mat-stroked-button [class.st-on]="onlyVariance" (click)="onlyVariance = !onlyVariance" matTooltip="Show only lines with a difference">
          <mat-icon>difference</mat-icon> Variances ({{ varianceLines().length }})</button>
      </div>

      <div class="st-table-wrap">
        <table class="app-table st-table">
          <thead><tr>
            <th>Code</th><th>Description</th><th>Company</th><th>UOM</th>
            <th class="num">System Qty</th><th class="num" style="width:130px;">Counted</th><th class="num">Variance</th>
          </tr></thead>
          <tbody>
            @for (r of rows().slice(0, 500); track r.commodityId) {
              <tr [class.st-diff]="r.counted !== null && r.counted !== r.systemQty">
                <td class="ref">{{ r.code }}</td>
                <td class="desc">{{ r.name }}</td>
                <td><span class="st-chip">{{ r.company || '—' }}</span></td>
                <td>{{ r.uom }}</td>
                <td class="num">{{ r.systemQty | number }}</td>
                <td class="num"><input class="st-qty" type="number" min="0" [(ngModel)]="r.counted" placeholder="—"></td>
                <td class="num">
                  @if (r.counted !== null && r.counted !== undefined) {
                    <b [style.color]="varianceOf(r) > 0 ? 'var(--color-ok)' : (varianceOf(r) < 0 ? 'var(--color-danger)' : 'var(--color-text-3)')">
                      {{ varianceOf(r) > 0 ? '+' : '' }}{{ varianceOf(r) | number }}</b>
                  } @else { <span style="color:var(--color-line-strong);">—</span> }
                </td>
              </tr>
            } @empty { <tr><td colspan="7"><app-empty-state compact icon="search_off" title="No items match" message="No item matches the current filter.">
                  @if (searchQuery || onlyCounted || onlyVariance) { <button mat-stroked-button (click)="searchQuery = ''; onlyCounted = false; onlyVariance = false">Clear the filters</button> }
                </app-empty-state></td></tr> }
          </tbody>
        </table>
        @if (rows().length > 500) { <div class="st-more">Showing first 500 of {{ rows().length | number }} — narrow the filter</div> }
      </div>

      @if (varianceLines().length) {
        <div class="st-summary">
          <div><b>{{ varianceLines().length }}</b><span>lines with variance</span></div>
          <div class="pos"><b>+{{ totalOver() | number }}</b><span>units over</span></div>
          <div class="neg"><b>{{ totalShort() | number }}</b><span>units short</span></div>
        </div>
        <mat-form-field appearance="outline" style="width:100%;margin-top:10px;">
          <mat-label>Reason for variances (required)</mat-label>
          <input matInput [(ngModel)]="reason" placeholder="e.g. Quarterly count — Oct 2026">
        </mat-form-field>
      }
      <p class="st-note"><mat-icon>info</mat-icon> Only lines you type a count for are affected. Each variance posts an Adjustment to the stock ledger and updates stock on hand. Lines that match the system quantity are recorded as confirmed with no movement.</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!canSubmit() || saving" (click)="submitStockTake()">
        <mat-icon>save</mat-icon> Post {{ varianceLines().length }} adjustment{{ varianceLines().length === 1 ? '' : 's' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .st-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
    .st-search { flex: 1; min-width: 240px; }
    .st-ref { width: 220px; }
    .st-bar mat-form-field { margin-bottom: -1.25em; }
    .st-on { background: var(--color-warn-soft) !important; border-color: var(--color-warn) !important; }
    .st-table-wrap { max-height: 50vh; overflow: auto; border: 1px solid var(--color-line); border-radius: var(--radius-md); }
    .st-table .desc { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st-diff { background: var(--color-warn-soft); }
    .st-chip { font-size: var(--text-xs); background: var(--color-primary-soft); color: var(--color-primary); padding: 2px 8px; border-radius: var(--radius-md); }
    .st-qty { width: 110px; text-align: right; padding: 5px 8px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-sm); font-weight: 600; background: var(--color-surface); color: var(--color-text); }
    .st-qty:focus { outline: 2px solid var(--color-warn); border-color: transparent; }
    .st-more { text-align: center; color: var(--color-text-3); padding: 16px; font-size: var(--text-xs); }
    .st-summary { display: flex; gap: 14px; margin-top: 12px; }
    .st-summary > div { flex: 1; background: var(--color-canvas); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 10px 14px; display: flex; flex-direction: column; }
    .st-summary b { font-size: var(--text-2xl); }
    .st-summary span { font-size: var(--text-xs); color: var(--color-text-3); }
    .st-summary .pos b { color: var(--color-ok); } .st-summary .neg b { color: var(--color-danger); }
    .st-note { display: flex; align-items: center; gap: 8px; font-size: var(--text-xs); color: var(--color-text-3); margin-top: 12px; }
    .st-note mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; color: var(--color-primary); }
    .st-import { display: flex; gap: 10px; align-items: flex-start; background: var(--color-primary-soft); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 10px 14px; margin-bottom: 12px; font-size: var(--text-sm); color: var(--color-primary-hover); }
    .st-import mat-icon { color: var(--color-primary); flex-shrink: 0; }
    .st-warn { color: var(--color-warn); font-weight: 600; }
    .st-import-detail { margin-top: 4px; font-size: var(--text-xs); color: var(--color-text-2); display: flex; flex-direction: column; gap: 2px; word-break: break-word; }
  `]
})
export class StockTakeDialog implements OnInit {
  lines: { commodityId: number; code: string; name: string; company: string; uom: string; systemQty: number; counted: number | null }[] = [];
  searchQuery = '';
  reference = '';
  reason = '';
  onlyCounted = false;
  onlyVariance = false;
  saving = false;
  private http = inject(HttpClient);

  constructor(
    public dialogRef: MatDialogRef<StockTakeDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const imp: CountImportResult | undefined = this.data.imported;
    this.reference = `STK-${this.data.warehouse.code || this.data.warehouse.id}-${new Date().toISOString().substring(0, 10)}`;
    this.lines = (this.data.inventory || []).map((r: any) => ({
      commodityId: r.commodityId,
      code: r.commodityCode || '',
      name: r.commodityName || '',
      company: r.category || '',
      uom: r.unitOfMeasure || 'Each',
      systemQty: +(r.quantityOnHand || 0),
      counted: imp?.counts.has(r.commodityId) ? imp.counts.get(r.commodityId)! : null
    })).sort((a: any, b: any) => a.code.localeCompare(b.code));
    if (imp) {
      this.reason = `Stock count imported from ${imp.fileName}`;
      if (this.varianceLines().length) this.onlyVariance = true;
    }
  }

  rows() {
    const t = this.searchQuery.trim().toLowerCase();
    return this.lines.filter(r => {
      if (this.onlyCounted && (r.counted === null || r.counted === undefined)) return false;
      if (this.onlyVariance && !(r.counted !== null && r.counted !== undefined && r.counted !== r.systemQty)) return false;
      if (!t) return true;
      return r.code.toLowerCase().includes(t) || r.name.toLowerCase().includes(t) || r.company.toLowerCase().includes(t);
    });
  }

  varianceOf(r: any): number { return (r.counted ?? r.systemQty) - r.systemQty; }
  countedCount(): number { return this.lines.filter(r => r.counted !== null && r.counted !== undefined).length; }
  varianceLines() { return this.lines.filter(r => r.counted !== null && r.counted !== undefined && r.counted !== r.systemQty); }
  totalOver(): number { return this.varianceLines().filter(r => this.varianceOf(r) > 0).reduce((s, r) => s + this.varianceOf(r), 0); }
  totalShort(): number { return this.varianceLines().filter(r => this.varianceOf(r) < 0).reduce((s, r) => s + this.varianceOf(r), 0); }

  canSubmit(): boolean {
    return this.varianceLines().length > 0 && !!this.reason.trim() && !!this.reference.trim();
  }

  submitStockTake(): void {
    this.saving = true;
    const payload = {
      warehouseId: this.data.warehouse.id,
      reference: this.reference.trim(),
      reason: this.reason.trim(),
      lines: this.varianceLines().map(r => ({ commodityId: r.commodityId, countedQuantity: r.counted }))
    };
    this.http.post<any>(`${environment.apiUrl}/logistics/stock-movements/stock-take`, payload).subscribe({
      next: (r) => {
        this.toast.done(`Stock take posted — ${r?.adjusted ?? payload.lines.length} adjustment(s) written to the ledger`);
        this.dialogRef.close(true);
      },
      error: (e) => { this.saving = false; this.toast.error(e?.error?.message || 'Failed to post stock take'); }
    });
  }
}

// ═══ Warehouse 3D View Dialog ═══
@Component({
  selector: 'app-warehouse-3d-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, Warehouse3DComponent],
  template: `
    <div class="w3d-head">
      <div class="w3d-title">
        <mat-icon>view_in_ar</mat-icon>
        <h2>{{ data.name }} — 3D Stock View</h2>
      </div>
      <button aria-label="Close" mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
    </div>
    <div class="w3d-body">
      <app-warehouse-3d [embeddedWarehouseId]="data.id"></app-warehouse-3d>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .w3d-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid var(--color-line); }
    .w3d-title { display: flex; align-items: center; gap: 10px; }
    .w3d-title mat-icon { color: var(--color-ok); }
    .w3d-title h2 { margin: 0; font-size: var(--text-xl); font-weight: 700; color: var(--color-text); }
    .w3d-body { flex: 1; min-height: 0; overflow: hidden; }
    .w3d-body app-warehouse-3d { display: block; height: 100%; }
  `]
})
export class Warehouse3DDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}

// ═══ Create Stock Issue Dialog ═══
@Component({
  selector: 'app-create-issue-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title><mat-icon style="vertical-align:middle;margin-right:8px;color:var(--color-warn);">assignment_late</mat-icon> New Stock Issue</h2>
    <mat-dialog-content class="ci-body">
      <div class="ci-row">
        <mat-form-field appearance="outline">
          <mat-label>Warehouse</mat-label>
          <mat-select [(ngModel)]="warehouseId">
            @for (w of data.warehouses; track w.id) { <mat-option [value]="w.id">{{ w.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Company</mat-label>
          <mat-select [(ngModel)]="company">
            <mat-option [value]="''">—</mat-option>
            @for (c of data.companies; track c.key) { <mat-option [value]="c.key">{{ c.shortName }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline" class="ci-full">
        <mat-label>Issue type</mat-label>
        <mat-select [(ngModel)]="issueType">
          @for (t of issueTypes; track t) { <mat-option [value]="t">{{ t }}</mat-option> }
        </mat-select>
      </mat-form-field>
      @if (issueType === 'Other') {
        <mat-form-field appearance="outline" class="ci-full">
          <mat-label>Custom issue type</mat-label>
          <input matInput [(ngModel)]="customType" placeholder="Describe the type of issue">
        </mat-form-field>
      }
      <div class="ci-row">
        <mat-form-field appearance="outline">
          <mat-label>Item code (optional)</mat-label>
          <input matInput [(ngModel)]="itemCode" placeholder="e.g. 3030027">
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Item description (optional)</mat-label>
          <input matInput [(ngModel)]="itemDescription">
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline" class="ci-full">
        <mat-label>Detail</mat-label>
        <textarea matInput rows="3" [(ngModel)]="detail" placeholder="What is wrong, how was it found, quantities involved..."></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!valid() || saving" (click)="save()">
        <mat-icon>add</mat-icon> Create Issue
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .ci-body { padding-top: 8px; }
    .ci-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .ci-full { width: 100%; }
    mat-form-field { width: 100%; }
  `]
})
export class CreateIssueDialog {
  issueTypes = [
    'Opening ≠ previous closing',
    'Negative balance',
    'Closing does not add up',
    'Closing balance not filled in',
    'Missing item code',
    'Missing UOM',
    'Duplicate code',
    'Duplicate description',
    'Damaged stock',
    'Stock count variance',
    'Wrong item received',
    'Expired stock',
    'Missing / lost stock',
    'Other'
  ];
  warehouseId: number | null = null;
  company = '';
  issueType = '';
  customType = '';
  itemCode = '';
  itemDescription = '';
  detail = '';
  saving = false;

  private http = inject(HttpClient);
  private toast = inject(ToastService);

  constructor(
    public dialogRef: MatDialogRef<CreateIssueDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.warehouseId = data.defaultWarehouseId || null;
  }

  valid(): boolean {
    const type = this.issueType === 'Other' ? this.customType.trim() : this.issueType;
    return !!type && !!this.warehouseId;
  }

  save(): void {
    this.saving = true;
    const payload = {
      warehouseId: this.warehouseId,
      company: this.company || null,
      itemCode: this.itemCode || null,
      itemDescription: this.itemDescription || null,
      issueType: this.issueType === 'Other' ? this.customType.trim() : this.issueType,
      detail: this.detail || null
    };
    this.http.post(`${environment.apiUrl}/logistics/stock-issues`, payload).subscribe({
      next: () => { this.toast.done('Issue created'); this.dialogRef.close(true); },
      error: () => { this.saving = false; this.toast.error('Failed to create issue'); }
    });
  }
}

// ═══ Resolve Stock Issue Dialog ═══
@Component({
  selector: 'app-resolve-issue-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;" [style.color]="data.status === 'Resolved' ? 'var(--color-ok)' : 'var(--color-text-3)'">
        {{ data.status === 'Resolved' ? 'task_alt' : 'block' }}</mat-icon>
      {{ data.status === 'Resolved' ? 'Resolve' : 'Dismiss' }} Issue
    </h2>
    <mat-dialog-content>
      <div class="ri-summary">
        <b>{{ data.issue.issueType }}</b>
        @if (data.issue.itemCode) { <span class="ri-code">{{ data.issue.itemCode }}</span> }
        <div class="ri-detail">{{ data.issue.detail }}</div>
      </div>
      <mat-form-field appearance="outline" style="width:100%;">
        <mat-label>{{ data.status === 'Resolved' ? 'How was it resolved?' : 'Why is this not an issue?' }}</mat-label>
        <textarea matInput rows="3" [(ngModel)]="resolution"
                  [placeholder]="data.status === 'Resolved' ? 'e.g. Recount done, opening corrected to 240; GRV captured...' : 'e.g. Known timing difference, already corrected in source sheet...'"></textarea>
      </mat-form-field>
      @if (quickNotes.length) {
        <div class="ri-quick">
          @for (q of quickNotes; track q) {
            <button mat-stroked-button class="ri-chip" (click)="resolution = q">{{ q }}</button>
          }
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button [color]="data.status === 'Resolved' ? 'primary' : 'warn'" [disabled]="!resolution.trim() || saving" (click)="save()">
        <mat-icon>{{ data.status === 'Resolved' ? 'task_alt' : 'block' }}</mat-icon>
        {{ data.status === 'Resolved' ? 'Mark Resolved' : 'Dismiss' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .ri-summary { background: var(--color-canvas); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 12px; margin-bottom: 14px; }
    .ri-code { font-family: var(--font-mono); background: var(--color-line); border-radius: 6px; padding: 1px 7px; margin-left: 8px; font-size: var(--text-xs); }
    .ri-detail { font-size: var(--text-xs); color: var(--color-text-3); margin-top: 6px; }
    .ri-quick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .ri-chip { font-size: var(--text-xs) !important; line-height: 28px !important; padding: 0 10px !important; border-radius: 999px !important; }
  `]
})
export class ResolveIssueDialog {
  resolution = '';
  saving = false;

  quickNotes: string[] = [];

  private http = inject(HttpClient);
  private toast = inject(ToastService);

  constructor(
    public dialogRef: MatDialogRef<ResolveIssueDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.quickNotes = data.status === 'Resolved'
      ? ['Recount performed and balance corrected', 'GRV / receipt captured retrospectively', 'Data captured incorrectly — sheet corrected', 'Stock adjusted via stock take']
      : ['Known timing difference between sheets', 'Duplicate of another issue', 'Expected behaviour — not an error'];
  }

  save(): void {
    this.saving = true;
    this.http.put(`${environment.apiUrl}/logistics/stock-issues/${this.data.issue.id}/status`,
      { status: this.data.status, resolution: this.resolution.trim() }).subscribe({
      next: () => { this.toast.done(`Issue ${this.data.status.toLowerCase()}`); this.dialogRef.close(true); },
      error: () => { this.saving = false; this.toast.error('Failed to update issue'); }
    });
  }
}

// ═══ Shared: pick-list line used by the multi-line movement and transfer dialogs ═══
interface MovementLine { inv: any; quantity: number | null; reference: string; reason: string; }

// ═══ Manual Movement Dialog (Receive / Return / Adjustment / Scrap) — multi-line ═══
@Component({
  selector: 'app-manual-movement-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;" [style.color]="data.type === 'Scrap' ? 'var(--color-danger)' : 'var(--color-ok)'">{{ typeIcon() }}</mat-icon>
      {{ typeTitle() }}
      <small class="mm-sub">Search an item, click it to add a line, set the quantity. Add as many lines as you need, then save them all.</small>
    </h2>
    <mat-dialog-content>
      <div class="mm-top">
        <mat-form-field appearance="outline">
          <mat-label>Warehouse</mat-label>
          <mat-select [(ngModel)]="warehouseId" (ngModelChange)="onWarehouseChange()" [disabled]="lines.length > 0">
            @for (w of data.warehouses; track w.id) { <mat-option [value]="w.id">{{ w.name }}</mat-option> }
          </mat-select>
          @if (lines.length) { <mat-hint>Locked while lines are added</mat-hint> }
        </mat-form-field>
        <mat-form-field appearance="outline" class="mm-search">
          <mat-label>Search item — code, name or description</mat-label>
          <input #searchBox matInput [(ngModel)]="search" placeholder="e.g. GLV-M or nitrile glove" [disabled]="!warehouseId"
                 (keydown.enter)="addFirstMatch($event)" (keydown.arrowDown)="focusList($event)" autocomplete="off">
          <mat-icon matPrefix>search</mat-icon>
          @if (search) { <button matSuffix mat-icon-button aria-label="Clear" (click)="search = ''"><mat-icon>close</mat-icon></button> }
        </mat-form-field>
      </div>

      @if (search.trim().length) {
        <div class="mm-list" #listBox>
          @for (r of matches(); track r.id) {
            <button class="mm-item" [class.added]="isAdded(r)" (click)="add(r)" (keydown.enter)="add(r)">
              <span class="mm-code">{{ r.commodityCode }}</span>
              <span class="mm-name">{{ r.commodityName }}</span>
              <span class="mm-qty">{{ r.quantityOnHand | number }} on hand</span>
              <mat-icon class="mm-add">{{ isAdded(r) ? 'done' : 'add' }}</mat-icon>
            </button>
          } @empty { <div class="mm-empty">{{ warehouseId ? 'No item at this warehouse matches "' + search + '"' : 'Choose a warehouse first' }}</div> }
        </div>
      }

      @if (lines.length) {
        <table class="mm-table">
          <thead>
            <tr>
              <th>Code</th><th>Item</th><th class="num">On hand</th>
              <th class="num qty">{{ data.type === 'Adjustment' ? 'Adjust +/−' : 'Qty' }}</th>
              <th class="num">New balance</th>
              @if (perLineRef) { <th>Reference</th> }
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (l of lines; track l.inv.id; let i = $index) {
              <tr [class.bad]="lineError(l)">
                <td class="mono">{{ l.inv.commodityCode }}</td>
                <td class="name">{{ l.inv.commodityName }}</td>
                <td class="num">{{ l.inv.quantityOnHand | number }}</td>
                <td class="num qty">
                  <input class="mm-qty-input" type="number" [attr.id]="'qty-' + i" [(ngModel)]="l.quantity"
                         [min]="data.type === 'Adjustment' ? null : 1" (keydown.enter)="focusSearch()" [matTooltip]="lineError(l) || ''">
                </td>
                <td class="num" [class.neg]="newBalance(l) < 0">{{ newBalance(l) | number }}</td>
                @if (perLineRef) { <td><input class="mm-ref-input" [(ngModel)]="l.reference" [placeholder]="refLabel()"></td> }
                <td class="act"><button mat-icon-button aria-label="Remove line" (click)="remove(i)" matTooltip="Remove"><mat-icon>close</mat-icon></button></td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr><td colspan="3">{{ lines.length }} line(s)</td><td class="num qty"><b>{{ totalQty() | number }}</b></td><td [attr.colspan]="perLineRef ? 3 : 2"></td></tr>
          </tfoot>
        </table>

        <div class="mm-shared">
          <mat-form-field appearance="outline">
            <mat-label>{{ refLabel() }} {{ perLineRef ? '(default for blank lines)' : '' }}</mat-label>
            <input matInput [(ngModel)]="reference">
          </mat-form-field>
          <button mat-button type="button" class="mm-perline" (click)="perLineRef = !perLineRef">{{ perLineRef ? 'One reference for all' : 'Different reference per line' }}</button>
          <mat-form-field appearance="outline" style="grid-column: 1 / -1;">
            <mat-label>{{ needsReason() ? 'Reason (required)' : 'Notes (optional)' }}</mat-label>
            <input matInput [(ngModel)]="reason">
          </mat-form-field>
        </div>
      } @else if (!search.trim().length) {
        <div class="mm-empty tall"><mat-icon>playlist_add</mat-icon>No lines yet — search above and click an item to add it.</div>
      }

      @if (progress) { <div class="mm-progress">{{ progress }}</div> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving">Cancel</button>
      <button mat-raised-button [color]="data.type === 'Scrap' ? 'warn' : 'primary'" [disabled]="!valid() || saving" (click)="save()">
        <mat-icon>check</mat-icon> {{ data.type === 'Adjustment' ? 'Adjust' : data.type }} {{ lines.length || '' }} {{ lines.length === 1 ? 'line' : 'lines' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
    .mm-sub { font-size: var(--text-xs); font-weight: 400; color: var(--color-text-3); }
    .mm-top { display: grid; grid-template-columns: 240px 1fr; gap: 12px; }
    .mm-list { max-height: 220px; overflow: auto; border: 1px solid var(--color-line); border-radius: var(--radius-md); margin-bottom: 12px; }
    .mm-item { display: flex; gap: 10px; align-items: center; width: 100%; text-align: left; padding: 8px 12px; border: 0; border-bottom: 1px solid var(--color-surface-2); background: var(--color-surface); cursor: pointer; font: inherit; }
    .mm-item:hover, .mm-item:focus { background: var(--color-ok-soft); outline: none; }
    .mm-item.added { opacity: .6; }
    .mm-code { font-family: var(--font-mono); font-weight: 700; min-width: 110px; }
    .mm-name { flex: 1; font-size: var(--text-sm); color: var(--color-text-2); }
    .mm-qty { font-size: var(--text-xs); color: var(--color-text-3); white-space: nowrap; }
    .mm-add { color: var(--color-ok); font-size: 18px; width: 18px; height: 18px; }
    .mm-empty { padding: 20px; text-align: center; color: var(--color-text-3); }
    .mm-empty.tall { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 36px 20px; border: 1px dashed var(--color-line); border-radius: var(--radius-md); mat-icon { font-size: 32px; width: 32px; height: 32px; opacity: .5; } }
    .mm-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: var(--text-sm); }
    .mm-table th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; color: var(--color-text-3); padding: 6px 8px; border-bottom: 1px solid var(--color-line); }
    .mm-table td { padding: 4px 8px; border-bottom: 1px solid var(--color-surface-2); vertical-align: middle; }
    .mm-table tfoot td { border-bottom: 0; color: var(--color-text-3); font-size: var(--text-xs); padding-top: 8px; }
    .mm-table .num { text-align: right; white-space: nowrap; }
    .mm-table .qty { width: 120px; }
    .mm-table .name { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mm-table .neg { color: var(--color-danger); font-weight: 600; }
    .mm-table tr.bad td { background: var(--color-danger-soft, #fef2f2); }
    .mm-table .act { width: 40px; }
    .mono { font-family: var(--font-mono); }
    .mm-qty-input, .mm-ref-input { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--color-line); border-radius: 6px; font: inherit; background: var(--color-surface); color: inherit; }
    .mm-qty-input { text-align: right; }
    .mm-qty-input:focus, .mm-ref-input:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
    .mm-shared { display: grid; grid-template-columns: 1fr auto; gap: 0 12px; align-items: center; }
    .mm-perline { font-size: var(--text-xs); margin-top: -18px; }
    .mm-progress { font-size: var(--text-sm); color: var(--color-text-2); padding: 6px 0; }
    mat-form-field { width: 100%; }
  `]
})
export class ManualMovementDialog {
  warehouseId: number | null = null;
  search = '';
  lines: MovementLine[] = [];
  reference = '';
  reason = '';
  perLineRef = false;
  saving = false;
  progress = '';

  private http = inject(HttpClient);
  private toast = inject(ToastService);

  constructor(
    public dialogRef: MatDialogRef<ManualMovementDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.warehouseId = data.warehouse?.id ?? null;
    if (!this.warehouseId && data.warehouses?.length === 1) this.warehouseId = data.warehouses[0].id;
  }

  onWarehouseChange(): void { this.search = ''; this.lines = []; }

  /** Code, name or description — several words all have to appear somewhere (so "glove m" finds "GLV-M Nitrile glove medium"). */
  matches(): any[] {
    const words = this.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || !this.warehouseId) return [];
    return (this.data.inventory || []).filter((r: any) => {
      if (r.warehouseId !== this.warehouseId) return false;
      const hay = `${r.commodityCode || ''} ${r.commodityName || ''} ${r.commodityDescription || r.description || ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    }).slice(0, 50);
  }

  isAdded(r: any): boolean { return this.lines.some(l => l.inv.id === r.id); }

  add(r: any): void {
    const existing = this.lines.findIndex(l => l.inv.id === r.id);
    const idx = existing >= 0 ? existing : this.lines.push({ inv: r, quantity: null, reference: '', reason: '' }) - 1;
    this.search = '';
    setTimeout(() => (document.getElementById('qty-' + idx) as HTMLInputElement | null)?.focus(), 0);
  }
  addFirstMatch(ev: Event): void { ev.preventDefault(); const m = this.matches(); if (m.length) this.add(m[0]); }
  focusList(ev: Event): void { ev.preventDefault(); (document.querySelector('.mm-list .mm-item') as HTMLElement | null)?.focus(); }
  focusSearch(): void { (document.querySelector('input[placeholder^="e.g."]') as HTMLInputElement | null)?.focus(); }
  remove(i: number): void { this.lines.splice(i, 1); }

  typeIcon(): string {
    switch (this.data.type) { case 'Receive': return 'south_west'; case 'Adjustment': return 'tune'; case 'Scrap': return 'delete_sweep'; default: return 'undo'; }
  }
  typeTitle(): string {
    switch (this.data.type) { case 'Receive': return 'Receive Stock (GRV)'; case 'Adjustment': return 'Stock Adjustment'; case 'Scrap': return 'Scrap / Write-off'; default: return 'Return Stock'; }
  }
  refLabel(): string {
    switch (this.data.type) { case 'Receive': return 'Supplier / GRV reference'; case 'Adjustment': return 'Reference (count sheet, etc.)'; case 'Scrap': return 'Reference (damage report, batch)'; default: return 'Return reference (invoice, customer)'; }
  }
  needsReason(): boolean { return this.data.type === 'Adjustment' || this.data.type === 'Scrap'; }

  signedQty(l: MovementLine): number {
    const q = l.quantity || 0;
    return this.data.type === 'Scrap' ? -Math.abs(q) : q;
  }
  newBalance(l: MovementLine): number { return (l.inv.quantityOnHand || 0) + this.signedQty(l); }
  totalQty(): number { return this.lines.reduce((n, l) => n + this.signedQty(l), 0); }

  lineError(l: MovementLine): string | null {
    if (l.quantity == null || l.quantity === 0) return 'Enter a quantity';
    if (this.data.type !== 'Adjustment' && l.quantity < 0) return 'Quantity must be positive';
    return null;
  }

  valid(): boolean {
    if (!this.warehouseId || !this.lines.length) return false;
    if (this.lines.some(l => this.lineError(l))) return false;
    if (this.needsReason() && !this.reason.trim()) return false;
    return true;
  }

  async save(): Promise<void> {
    this.saving = true;
    let done = 0; const failed: string[] = [];
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      this.progress = `Saving line ${i + 1} of ${this.lines.length} — ${l.inv.commodityCode}…`;
      try {
        await this.http.post(`${environment.apiUrl}/logistics/stock-movements`, {
          warehouseId: this.warehouseId,
          commodityId: l.inv.commodityId,
          movementType: this.data.type,
          quantity: l.quantity,
          reference: (this.perLineRef && l.reference.trim()) ? l.reference.trim() : (this.reference || null),
          reason: this.reason || null
        }).toPromise();
        done++;
      } catch (e: any) {
        failed.push(`${l.inv.commodityCode}: ${e?.error?.message || 'failed'}`);
      }
    }
    this.progress = '';
    if (!failed.length) {
      this.toast.done(`${done} ${this.data.type.toLowerCase()} line(s) recorded`);
      this.dialogRef.close(true);
    } else {
      // Keep only the lines that failed so they can be fixed and resubmitted.
      const failedCodes = new Set(failed.map(f => f.split(':')[0]));
      this.lines = this.lines.filter(l => failedCodes.has(l.inv.commodityCode));
      this.saving = false;
      this.toast.warn(`${done} saved, ${failed.length} failed — ${failed.slice(0, 3).join('; ')}`);
      if (done) this.data.onPartial?.();
    }
  }
}

// ═══ Transfer Stock Dialog (warehouse → warehouse) — multi-line ═══
@Component({
  selector: 'app-transfer-stock-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatSelectModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:var(--color-primary);">sync_alt</mat-icon>
      Transfer Stock Between Warehouses
      <small class="mm-sub">Search an item at the source warehouse, click it to add a line, set the quantity. Save writes two ledger entries per line.</small>
    </h2>
    <mat-dialog-content>
      <div class="ts-row">
        <mat-form-field appearance="outline">
          <mat-label>From warehouse</mat-label>
          <mat-select [(ngModel)]="fromId" (ngModelChange)="lines = []; search = ''" [disabled]="lines.length > 0">
            @for (w of data.warehouses; track w.id) { <mat-option [value]="w.id">{{ w.name }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-icon class="ts-arrow">arrow_forward</mat-icon>
        <mat-form-field appearance="outline">
          <mat-label>To warehouse</mat-label>
          <mat-select [(ngModel)]="toId">
            @for (w of data.warehouses; track w.id) {
              @if (w.id !== fromId) { <mat-option [value]="w.id">{{ w.name }}</mat-option> }
            }
          </mat-select>
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline" style="width:100%;">
        <mat-label>Search item at source — code, name or description</mat-label>
        <input matInput [(ngModel)]="search" placeholder="e.g. GLV-M or nitrile glove" [disabled]="!fromId"
               (keydown.enter)="addFirstMatch($event)" autocomplete="off">
        <mat-icon matPrefix>search</mat-icon>
        @if (search) { <button matSuffix mat-icon-button aria-label="Clear" (click)="search = ''"><mat-icon>close</mat-icon></button> }
      </mat-form-field>

      @if (search.trim().length) {
        <div class="mm-list">
          @for (r of matches(); track r.id) {
            <button class="mm-item" [class.added]="isAdded(r)" (click)="add(r)">
              <span class="mm-code">{{ r.commodityCode }}</span>
              <span class="mm-name">{{ r.commodityName }}</span>
              <span class="mm-qty">{{ r.quantityOnHand | number }} on hand</span>
              <mat-icon class="mm-add">{{ isAdded(r) ? 'done' : 'add' }}</mat-icon>
            </button>
          } @empty { <div class="mm-empty">{{ fromId ? 'No item at the source warehouse matches "' + search + '"' : 'Choose a source warehouse first' }}</div> }
        </div>
      }

      @if (lines.length) {
        <table class="mm-table">
          <thead><tr><th>Code</th><th>Item</th><th class="num">On hand</th><th class="num qty">Transfer</th><th class="num">Left at source</th><th></th></tr></thead>
          <tbody>
            @for (l of lines; track l.inv.id; let i = $index) {
              <tr [class.bad]="!!lineError(l)">
                <td class="mono">{{ l.inv.commodityCode }}</td>
                <td class="name">{{ l.inv.commodityName }}</td>
                <td class="num">{{ l.inv.quantityOnHand | number }}</td>
                <td class="num qty"><input class="mm-qty-input" type="number" min="1" [attr.id]="'tqty-' + i" [(ngModel)]="l.quantity" [matTooltip]="lineError(l) || ''"></td>
                <td class="num" [class.neg]="remaining(l) < 0">{{ remaining(l) | number }}</td>
                <td class="act"><button mat-icon-button aria-label="Remove line" (click)="lines.splice(i, 1)"><mat-icon>close</mat-icon></button></td>
              </tr>
            }
          </tbody>
          <tfoot><tr><td colspan="3">{{ lines.length }} line(s)</td><td class="num qty"><b>{{ totalQty() | number }}</b></td><td colspan="2"></td></tr></tfoot>
        </table>
        <div class="ts-grid">
          <mat-form-field appearance="outline">
            <mat-label>Reference (optional)</mat-label>
            <input matInput [(ngModel)]="reference" placeholder="e.g. IBT number">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Reason / notes {{ needsReason() ? '(required — a line goes negative)' : '(optional)' }}</mat-label>
            <input matInput [(ngModel)]="reason">
          </mat-form-field>
        </div>
      } @else if (!search.trim().length) {
        <div class="mm-empty tall"><mat-icon>playlist_add</mat-icon>No lines yet — search above and click an item to add it.</div>
      }
      @if (progress) { <div class="mm-progress">{{ progress }}</div> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="saving">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!valid() || saving" (click)="save()">
        <mat-icon>sync_alt</mat-icon> Transfer {{ lines.length || '' }} {{ lines.length === 1 ? 'line' : 'lines' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
    .mm-sub { font-size: var(--text-xs); font-weight: 400; color: var(--color-text-3); }
    .ts-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }
    .ts-arrow { color: var(--color-primary); margin-top: -18px; }
    .ts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .mm-list { max-height: 220px; overflow: auto; border: 1px solid var(--color-line); border-radius: var(--radius-md); margin-bottom: 12px; }
    .mm-item { display: flex; gap: 10px; align-items: center; width: 100%; text-align: left; padding: 8px 12px; border: 0; border-bottom: 1px solid var(--color-surface-2); background: var(--color-surface); cursor: pointer; font: inherit; }
    .mm-item:hover, .mm-item:focus { background: var(--color-primary-soft); outline: none; }
    .mm-item.added { opacity: .6; }
    .mm-code { font-family: var(--font-mono); font-weight: 700; min-width: 110px; }
    .mm-name { flex: 1; font-size: var(--text-sm); color: var(--color-text-2); }
    .mm-qty { font-size: var(--text-xs); color: var(--color-text-3); white-space: nowrap; }
    .mm-add { color: var(--color-primary); font-size: 18px; width: 18px; height: 18px; }
    .mm-empty { padding: 20px; text-align: center; color: var(--color-text-3); }
    .mm-empty.tall { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 36px 20px; border: 1px dashed var(--color-line); border-radius: var(--radius-md); mat-icon { font-size: 32px; width: 32px; height: 32px; opacity: .5; } }
    .mm-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: var(--text-sm); }
    .mm-table th { text-align: left; font-size: var(--text-xs); text-transform: uppercase; color: var(--color-text-3); padding: 6px 8px; border-bottom: 1px solid var(--color-line); }
    .mm-table td { padding: 4px 8px; border-bottom: 1px solid var(--color-surface-2); vertical-align: middle; }
    .mm-table tfoot td { border-bottom: 0; color: var(--color-text-3); font-size: var(--text-xs); padding-top: 8px; }
    .mm-table .num { text-align: right; white-space: nowrap; }
    .mm-table .qty { width: 120px; }
    .mm-table .name { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mm-table .neg { color: var(--color-danger); font-weight: 600; }
    .mm-table tr.bad td { background: var(--color-danger-soft, #fef2f2); }
    .mm-table .act { width: 40px; }
    .mono { font-family: var(--font-mono); }
    .mm-qty-input { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--color-line); border-radius: 6px; font: inherit; text-align: right; background: var(--color-surface); color: inherit; }
    .mm-qty-input:focus { outline: 2px solid var(--color-primary); outline-offset: -1px; }
    .mm-progress { font-size: var(--text-sm); color: var(--color-text-2); padding: 6px 0; }
    mat-form-field { width: 100%; }
  `]
})
export class TransferStockDialog {
  fromId: number | null = null;
  toId: number | null = null;
  search = '';
  lines: MovementLine[] = [];
  reference = '';
  reason = '';
  saving = false;
  progress = '';

  private http = inject(HttpClient);
  private toast = inject(ToastService);

  constructor(
    public dialogRef: MatDialogRef<TransferStockDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.fromId = data.fromWarehouseId ?? data.warehouses?.[0]?.id ?? null;
    this.toId = data.toWarehouseId ?? null;
    if (data.reference) this.reference = data.reference;
    // Welly / callers can hand in one pre-selected line (code + quantity).
    if (data.preselectCode) {
      const code = String(data.preselectCode).toUpperCase();
      const inv = (data.inventory || []).find((r: any) => r.warehouseId === this.fromId && (r.commodityCode || '').toUpperCase() === code);
      if (inv) this.lines.push({ inv, quantity: data.quantity ?? null, reference: '', reason: '' });
      else this.search = data.preselectCode;
    }
  }

  matches(): any[] {
    const words = this.search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || !this.fromId) return [];
    return (this.data.inventory || []).filter((r: any) => {
      if (r.warehouseId !== this.fromId) return false;
      const hay = `${r.commodityCode || ''} ${r.commodityName || ''} ${r.commodityDescription || r.description || ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    }).slice(0, 50);
  }

  isAdded(r: any): boolean { return this.lines.some(l => l.inv.id === r.id); }
  add(r: any): void {
    const existing = this.lines.findIndex(l => l.inv.id === r.id);
    const idx = existing >= 0 ? existing : this.lines.push({ inv: r, quantity: null, reference: '', reason: '' }) - 1;
    this.search = '';
    setTimeout(() => (document.getElementById('tqty-' + idx) as HTMLInputElement | null)?.focus(), 0);
  }
  addFirstMatch(ev: Event): void { ev.preventDefault(); const m = this.matches(); if (m.length) this.add(m[0]); }

  remaining(l: MovementLine): number { return (l.inv.quantityOnHand || 0) - (l.quantity || 0); }
  totalQty(): number { return this.lines.reduce((n, l) => n + (l.quantity || 0), 0); }
  lineError(l: MovementLine): string | null { return (!l.quantity || l.quantity <= 0) ? 'Enter a quantity' : null; }
  needsReason(): boolean { return this.lines.some(l => this.remaining(l) < 0); }

  valid(): boolean {
    if (!this.fromId || !this.toId || this.fromId === this.toId) return false;
    if (!this.lines.length || this.lines.some(l => this.lineError(l))) return false;
    if (this.needsReason() && !this.reason.trim()) return false;
    return true;
  }

  async save(): Promise<void> {
    this.saving = true;
    let done = 0; const failed: string[] = [];
    for (let i = 0; i < this.lines.length; i++) {
      const l = this.lines[i];
      this.progress = `Transferring line ${i + 1} of ${this.lines.length} — ${l.inv.commodityCode}…`;
      try {
        await this.http.post(`${environment.apiUrl}/logistics/stock-movements/transfer`, {
          fromWarehouseId: this.fromId,
          toWarehouseId: this.toId,
          commodityId: l.inv.commodityId,
          quantity: l.quantity,
          reference: this.reference || null,
          reason: this.reason || null
        }).toPromise();
        done++;
      } catch (e: any) {
        failed.push(`${l.inv.commodityCode}: ${e?.error?.message || 'failed'}`);
      }
    }
    this.progress = '';
    if (!failed.length) {
      this.toast.done(`${done} transfer line(s) recorded — two ledger entries each`);
      this.dialogRef.close(true);
    } else {
      const failedCodes = new Set(failed.map(f => f.split(':')[0]));
      this.lines = this.lines.filter(l => failedCodes.has(l.inv.commodityCode));
      this.saving = false;
      this.toast.warn(`${done} saved, ${failed.length} failed — ${failed.slice(0, 3).join('; ')}`);
    }
  }
}

// ═══ Approve Dispatch Dialog (picking slip review → stock deduction) ═══
@Component({
  selector: 'app-approve-dispatch-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatTooltipModule, EmptyStateComponent],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:var(--color-warn);">fact_check</mat-icon>
      Approve Dispatch — {{ data.load.loadNumber }}
    </h2>
    <mat-dialog-content>
      <div class="ad-meta">
        <div><span class="ad-meta-lbl">Warehouse</span><span class="ad-meta-val">{{ data.load.warehouseName }}</span></div>
        <div><span class="ad-meta-lbl">Customer</span><span class="ad-meta-val">{{ data.load.customerName || '—' }}</span></div>
        <div><span class="ad-meta-lbl">Status</span><span class="ad-meta-val">{{ data.load.status }}</span></div>
        <div><span class="ad-meta-lbl">Lines</span><span class="ad-meta-val">{{ lines.length }}@if (unmapped.length) {<small> + {{ unmapped.length }} unmapped</small>}</span></div>
        <div><span class="ad-meta-lbl">Units to dispatch</span><span class="ad-meta-val ad-strong">{{ totalQty() | number }}</span></div>
      </div>

      @if (unmapped.length) {
        <div class="ad-unmapped">
          <div class="ad-unmapped-head"><mat-icon>link_off</mat-icon> {{ unmapped.length }} line(s) are not linked to a stock item and will <b>not</b> deduct stock — search and link them below</div>
          <table class="app-table ad-table ad-table-sm">
            <thead><tr><th>Code</th><th>Description</th><th class="num">Qty</th><th>Invoice</th><th style="min-width:280px;">Link to stock item</th></tr></thead>
            <tbody>
              @for (u of unmapped; track u.id) {
                <tr>
                  <td class="ref">{{ u.code || '—' }}</td><td>{{ u.name }}</td><td class="num">{{ u.planned | number }}</td><td class="ref">{{ u.invoice || '—' }}</td>
                  <td class="ad-link-cell">
                    <input class="ad-link-search" type="text" placeholder="Search code or name…" [(ngModel)]="u.search" [disabled]="u.linking">
                    @if (u.search && u.search.length >= 2) {
                      <div class="ad-link-opts">
                        @for (o of matchOptions(u.search); track o.commodityId) {
                          <button type="button" class="ad-link-opt" [disabled]="u.linking" (click)="linkLine(u, o)">
                            <span class="mono">{{ o.code || '—' }}</span> {{ o.name }} <small>on hand {{ o.onHand | number }}</small>
                          </button>
                        } @empty {
                          <div class="ad-link-none">No stock items match</div>
                        }
                      </div>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (!lines.length) {
        <app-empty-state compact icon="link_off" title="No mappable lines" message="This tripsheet has no commodity lines that can deduct stock."></app-empty-state>
      } @else {
        <div class="ad-table-wrap">
          <table class="app-table ad-table">
            <thead><tr>
              <th style="width:120px;">Code</th>
              <th>Description</th>
              <th class="num" style="width:100px;">Planned</th>
              <th class="num" style="width:100px;">On Hand</th>
              <th class="num" style="width:140px;">Dispatch Qty</th>
              <th class="num" style="width:100px;">After</th>
              <th style="width:120px;">Note</th>
            </tr></thead>
            <tbody>
              @for (l of lines; track l.commodityId) {
                <tr [class.ad-row-neg]="l.qty > l.onHand" [class.ad-row-short]="l.qty < l.planned">
                  <td class="ref">{{ l.code || '—' }}</td>
                  <td class="desc" [matTooltip]="l.name">{{ l.name }}</td>
                  <td class="num ad-big">{{ l.planned | number }}</td>
                  <td class="num ad-big" [class.ad-red]="l.onHand < l.qty">{{ l.onHand | number }}</td>
                  <td class="num"><input class="ad-qty" type="number" min="0" [(ngModel)]="l.qty" (focus)="$any($event.target).select()"></td>
                  <td class="num ad-big" [class.ad-red]="l.onHand - l.qty < 0">{{ (l.onHand - l.qty) | number }}</td>
                  <td>
                    @if (l.qty > l.onHand) { <span class="ad-tag ad-tag-neg"><mat-icon>warning</mat-icon> Negative</span> }
                    @else if (l.qty < l.planned) { <span class="ad-tag ad-tag-short">Short {{ l.planned - l.qty | number }}</span> }
                    @else if (l.qty > l.planned) { <span class="ad-tag ad-tag-over">Over {{ l.qty - l.planned | number }}</span> }
                    @else { <span class="ad-tag ad-tag-ok"><mat-icon>check</mat-icon> Full</span> }
                  </td>
                </tr>
              }
            </tbody>
            <tfoot><tr>
              <td colspan="2">Total</td>
              <td class="num ad-big">{{ totalPlanned() | number }}</td>
              <td></td>
              <td class="num ad-big">{{ totalQty() | number }}</td>
              <td></td><td></td>
            </tr></tfoot>
          </table>
        </div>
        @if (needsReason()) {
          <mat-form-field appearance="outline" style="width:100%;margin-top:14px;">
            <mat-label>Reason for dispatching more than on hand (required)</mat-label>
            <input matInput [(ngModel)]="negativeReason" placeholder="e.g. stock received but GRV not yet captured">
          </mat-form-field>
        }
        <p class="ad-note"><mat-icon>info</mat-icon> Approving deducts the <b>Dispatch Qty</b> from stock on hand and writes ledger entries. Edit a quantity to record a short-pick; lines set to 0 are skipped.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!canSave() || saving" (click)="save()">
        <mat-icon>inventory</mat-icon> Approve & Deduct {{ totalQty() | number }} units
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .ad-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px 20px; background: var(--color-canvas); border: 1px solid var(--color-line); border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 14px; }
    .ad-meta > div { display: flex; flex-direction: column; gap: 2px; }
    .ad-meta-lbl { font-size: var(--text-xs); text-transform: uppercase; letter-spacing: .05em; color: var(--color-text-3); font-weight: 600; }
    .ad-meta-val { font-size: var(--text-md); color: var(--color-text); font-weight: 600; }
    .ad-meta-val small { color: var(--color-warn); font-weight: 600; font-size: var(--text-xs); }
    .ad-strong { font-size: var(--text-2xl); color: var(--color-primary-hover); font-weight: 800; }
    .ad-table-wrap { max-height: 52vh; overflow: auto; border: 1px solid var(--color-line); border-radius: var(--radius-md); }
    .ad-table td.desc { max-width: 380px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ad-table td.ref { font-weight: 700; color: var(--color-text-2); }
    .ad-big { font-size: var(--text-lg); font-weight: 700; }
    .ad-red { color: var(--color-danger); }
    .ad-row-neg td { background: var(--color-danger-soft); }
    .ad-row-short td { background: var(--color-warn-soft); }
    .ad-qty { width: 120px; padding: 8px 10px; border: 2px solid var(--color-text-3); border-radius: var(--radius-control); text-align: right; font-weight: 800; font-size: var(--text-lg); color: var(--color-text); background: var(--color-surface); font-variant-numeric: tabular-nums; }
    .ad-qty:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-focus); }
    .ad-tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px; font-size: var(--text-xs); font-weight: 700; white-space: nowrap; }
    .ad-tag mat-icon { font-size: var(--text-md); width: 14px; height: 14px; }
    .ad-tag-ok { background: var(--color-ok-soft); color: var(--color-ok); }
    .ad-tag-short { background: var(--color-warn-soft); color: var(--color-warn); }
    .ad-tag-over { background: var(--color-primary-soft); color: var(--color-primary-hover); }
    .ad-tag-neg { background: var(--color-danger-soft); color: var(--color-danger); }
    .ad-unmapped { border: 1px solid var(--color-warn); background: var(--color-warn-soft); border-radius: var(--radius-md); padding: 10px 12px; margin-bottom: 14px; }
    .ad-unmapped-head { display: flex; align-items: center; gap: 8px; color: var(--color-warn); font-size: var(--text-sm); margin-bottom: 8px; }
    .ad-unmapped-head mat-icon { font-size: var(--text-2xl); width: 20px; height: 20px; }
    .ad-table-sm { background: var(--color-surface); }
    .ad-table-sm th { position: static; background: var(--color-warn-soft); color: var(--color-warn); }
    .ad-link-cell { position: relative; }
    .ad-link-search { width: 100%; min-width: 240px; padding: 6px 9px; border: 1.5px solid var(--color-line-strong); border-radius: var(--radius-sm); font-size: var(--text-sm); background: var(--color-surface); color: var(--color-text); }
    .ad-link-search:focus { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-focus); }
    .ad-link-opts { position: absolute; z-index: 5; left: 10px; right: 10px; background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-control); box-shadow: var(--shadow-md); max-height: 180px; overflow: auto; }
    .ad-link-opt { display: block; width: 100%; text-align: left; background: none; border: none; border-bottom: 1px solid var(--color-surface-2); padding: 7px 10px; font-size: var(--text-xs); cursor: pointer; color: var(--color-text); }
    .ad-link-opt:hover { background: var(--color-primary-soft); }
    .ad-link-opt .mono { font-family: var(--font-mono); font-weight: 700; margin-right: 6px; }
    .ad-link-opt small { color: var(--color-text-3); margin-left: 6px; }
    .ad-link-none { padding: 8px 10px; font-size: var(--text-xs); color: var(--color-text-3); }
    .ad-note { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); color: var(--color-text-3); margin-top: 12px; }
    .ad-note mat-icon { font-size: var(--text-lg); width: 16px; height: 16px; color: var(--color-primary); }
  `]
})
export class ApproveDispatchDialog {
  lines: { commodityId: number; code: string; name: string; planned: number; qty: number; onHand: number }[] = [];
  /** Stop lines that have no commodity mapping and therefore cannot deduct stock */
  unmapped: { id: number; code: string; name: string; planned: number; invoice: string; search: string; linking: boolean }[] = [];
  private invOptions: { commodityId: number; code: string; name: string; onHand: number }[] = [];
  negativeReason = '';
  saving = false;

  private http = inject(HttpClient);
  private toast = inject(ToastService);

  constructor(
    public dialogRef: MatDialogRef<ApproveDispatchDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // Aggregate commodity quantities across all stops of the load
    const byId = new Map<number, any>();
    for (const s of (data.load.stops || [])) {
      for (const c of (s.commodities || [])) {
        if (!c.commodityId) {
          this.unmapped.push({
            id: c.id,
            code: c.commodityCode || '',
            name: c.commodityName || c.comment || 'Unnamed line',
            planned: c.quantity || 0,
            invoice: c.invoiceNumber || s.invoiceNumber || '',
            search: '',
            linking: false
          });
          continue;
        }
        const existing = byId.get(c.commodityId);
        if (existing) existing.planned += (c.quantity || 0);
        else byId.set(c.commodityId, {
          commodityId: c.commodityId,
          code: c.commodityCode || '',
          name: c.commodityName || '',
          planned: c.quantity || 0
        });
      }
    }
    const invById = new Map<number, any>((data.inventory || []).map((r: any) => [r.commodityId, r]));
    this.lines = [...byId.values()].map(l => ({
      ...l,
      qty: l.planned,
      onHand: invById.get(l.commodityId)?.quantityOnHand ?? 0
    })).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    this.invOptions = (data.inventory || []).map((r: any) => ({
      commodityId: r.commodityId,
      code: r.commodityCode || '',
      name: r.commodityName || '',
      onHand: r.quantityOnHand ?? 0
    }));
  }

  matchOptions(search: string): { commodityId: number; code: string; name: string; onHand: number }[] {
    const tokens = (search || '').toLowerCase().split(/\s+/).filter(t => t);
    if (!tokens.length) return [];
    return this.invOptions
      .filter(o => tokens.every(t => o.code.toLowerCase().includes(t) || o.name.toLowerCase().includes(t)))
      .slice(0, 6);
  }

  linkLine(u: { id: number; planned: number; search: string; linking: boolean }, o: { commodityId: number; code: string; name: string; onHand: number }): void {
    u.linking = true;
    this.http.post<any>(`${environment.apiUrl}/logistics/stock-movements/map-stop-commodity`,
      { stopCommodityIds: [u.id], commodityId: o.commodityId }).subscribe({
      next: () => {
        this.unmapped = this.unmapped.filter(x => x.id !== u.id);
        const existing = this.lines.find(l => l.commodityId === o.commodityId);
        if (existing) { existing.planned += u.planned; existing.qty += u.planned; }
        else {
          this.lines.push({ commodityId: o.commodityId, code: o.code, name: o.name, planned: u.planned, qty: u.planned, onHand: o.onHand });
          this.lines.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
        }
        this.toast.done(`Linked to ${o.code || o.name} — line will now deduct stock`);
      },
      error: (e) => { u.linking = false; this.toast.error(e?.error?.message || 'Failed to link line'); }
    });
  }

  totalPlanned(): number { return this.lines.reduce((s, l) => s + (+l.planned || 0), 0); }
  totalQty(): number { return this.lines.reduce((s, l) => s + (+l.qty || 0), 0); }

  needsReason(): boolean { return this.lines.some(l => l.qty > l.onHand && l.qty > 0); }

  canSave(): boolean {
    if (!this.lines.length) return false;
    if (!this.lines.some(l => l.qty > 0)) return false;
    if (this.needsReason() && !this.negativeReason.trim()) return false;
    return true;
  }

  save(): void {
    this.saving = true;
    const payload = {
      loadId: this.data.load.id,
      lines: this.lines.filter(l => l.qty > 0).map(l => ({
        commodityId: l.commodityId,
        dispatchedQuantity: l.qty,
        reason: l.qty > l.onHand ? this.negativeReason.trim() : null
      }))
    };
    this.http.post<any>(`${environment.apiUrl}/logistics/stock-movements/approve-dispatch`, payload).subscribe({
      next: (r) => { this.toast.done(r?.message || `Dispatch approved — stock deducted for ${this.data.load.loadNumber}`); this.dialogRef.close(true); },
      error: (e) => { this.saving = false; this.toast.error(e?.error?.message || 'Failed to approve dispatch'); }
    });
  }
}



