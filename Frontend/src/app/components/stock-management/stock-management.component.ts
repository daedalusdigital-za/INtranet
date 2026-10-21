import { Component, OnInit, Inject, inject } from '@angular/core';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { WellyActivityService } from '../../services/welly-activity.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
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
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressBarModule,
    NavbarComponent,
    EmptyStateComponent,
    MatListModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatTabsModule
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="container">
      <div class="page-header">
        <div class="header-lead">
          <mat-icon class="header-icon">inventory_2</mat-icon>
          <div class="header-text">
            <h1>Stock Management</h1>
            <p class="subtitle">{{ selectedWarehouse ? selectedWarehouse.name + ' Â· ' + selectedWarehouse.location : 'All warehouses â€” click a warehouse card to focus' }}</p>
          </div>
        </div>
        <div class="header-actions">
          @if (selectedWarehouse) {
            <button mat-raised-button class="welly-stock-btn" (click)="wellyAnalyzeStock()" matTooltip="Ask Welly to analyze stock levels">
              <mat-icon class="welly-sparkle">auto_awesome</mat-icon>
              Ask Welly to Analyze
            </button>
            <button mat-stroked-button (click)="whFilterId = null" matTooltip="Show all warehouses">
              <mat-icon>filter_alt_off</mat-icon>
              Clear Filter
            </button>
          }
        </div>
      </div>

      @if (loading) {
        <div class="loading-state">
          <div class="loading-card">
            <div class="lc-icon-wrap">
              <mat-icon class="lc-icon pulse-icon">warehouse</mat-icon>
            </div>
            <h3>Loading Stock Management</h3>
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

        <!-- â•â•â• KPI CARDS â•â•â• -->
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

        <!-- â•â•â• WAREHOUSE CARDS (click to filter, Operations to drill in) â•â•â• -->
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
                <button mat-icon-button class="stk-wh-ops" matTooltip="View warehouse in 3D with all stock"
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

        <!-- â•â•â• COMPANY FILTER â•â•â• -->
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

        <!-- â•â•â• TABS â•â•â• -->
        <mat-tab-group class="stk-tabs" animationDuration="150ms">

          <!-- STOCK ON HAND -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">inventory_2</mat-icon> Stock on Hand</ng-template>
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
              @if (invLoading) { <div class="stk-loading"><mat-spinner diameter="32"></mat-spinner> Loading stock...</div> }
              @else {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr>
                      <th>Code</th><th>Description</th><th>Company</th><th>Warehouse</th><th>UOM</th>
                      <th class="num">Qty On Hand</th><th class="num">Unit Price</th><th class="num">Value</th><th>Status</th>
                    </tr></thead>
                    <tbody>
                      @for (r of sohRows.slice(0, 400); track r.id) {
                        <tr>
                          <td class="mono">{{ r.commodityCode }}</td>
                          <td class="desc">{{ r.commodityName }}</td>
                          <td><span class="stk-chip">{{ r.category || 'â€”' }}</span></td>
                          <td>{{ r.warehouseName }}</td>
                          <td>{{ r.unitOfMeasure || 'Each' }}</td>
                          <td class="num"><b>{{ r.quantityOnHand | number }}</b></td>
                          <td class="num">{{ r.unitPrice ? ('R' + (r.unitPrice | number:'1.2-2')) : 'â€”' }}</td>
                          <td class="num">{{ r.lineValue ? ('R' + (r.lineValue | number:'1.0-0')) : 'â€”' }}</td>
                          <td><span class="stk-badge" [class.b-in]="r.quantityOnHand > 0" [class.b-out]="r.quantityOnHand === 0" [class.b-neg]="r.quantityOnHand < 0">
                            {{ r.quantityOnHand > 0 ? 'In stock' : (r.quantityOnHand < 0 ? 'Negative' : 'Out of stock') }}</span></td>
                        </tr>
                      } @empty { <tr><td colspan="9" class="stk-empty">No stock items found</td></tr> }
                    </tbody>
                  </table>
                  @if (sohRows.length > 400) { <div class="stk-more">Showing first 400 â€” refine your search to narrow down ({{ sohRows.length | number }} matches)</div> }
                </div>
              }
            </div>
          </mat-tab>

          <!-- STOCK COUNTS -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">fact_check</mat-icon> Stock Counts</ng-template>
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <span class="stk-count">Latest counts per warehouse</span>
                <span class="stk-spacer"></span>
                <button mat-stroked-button (click)="exportValuation()"><mat-icon>file_download</mat-icon> Export</button>
                <button mat-raised-button color="primary" (click)="openStockTakeForFilter()"
                        [matTooltip]="whFilterId ? 'New stock take at ' + whFilterName : 'Select a warehouse card above first'">
                  <mat-icon>fact_check</mat-icon> New Stock Take</button>
              </div>
              <div class="stk-table-wrap">
                <table class="stk-table">
                  <thead><tr>
                    <th>Warehouse</th><th class="num">Items Counted</th><th class="num">Units</th><th class="num">Value</th>
                    <th class="num">In Stock</th><th class="num">Out of Stock</th><th>Last Count</th><th>Companies</th>
                  </tr></thead>
                  <tbody>
                    @for (w of warehouses; track w.id) {
                      <tr>
                        <td><b>{{ w.name }}</b></td>
                        <td class="num">{{ w.totalItems | number }}</td>
                        <td class="num">{{ w.totalQuantityOnHand | number }}</td>
                        <td class="num">{{ formatValue(w.totalStockValue) }}</td>
                        <td class="num">{{ w.itemsInStock | number }}</td>
                        <td class="num" [style.color]="w.itemsOutOfStock > 0 ? '#dc2626' : ''">{{ w.itemsOutOfStock | number }}</td>
                        <td>{{ w.lastCountDate ? (w.lastCountDate | date:'dd MMM yyyy') : 'â€”' }}</td>
                        <td>
                          @for (c of w.byClient; track c.client) {
                            <span class="stk-chip" style="margin-right:4px;">{{ c.client }} {{ c.items }}</span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <p class="stk-note"><mat-icon>info</mat-icon> Baseline quantities come from the consolidated stock imports; every count variance you post is written to the Movements ledger as an Adjustment. Click a warehouse card, then <b>New Stock Take</b>.</p>
            </div>
          </mat-tab>

          <!-- ISSUES -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">assignment_late</mat-icon> Issues ({{ openIssueCount }})</ng-template>
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
              @if (issuesLoading) { <div class="stk-loading"><mat-spinner diameter="32"></mat-spinner> Loading issues...</div> }
              @else {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr>
                      <th>Date</th><th>Warehouse</th><th>Company</th><th>Code</th><th>Description</th><th>Issue</th><th>Detail</th><th>Status</th><th style="text-align:right;">Actions</th>
                    </tr></thead>
                    <tbody>
                      @for (i of issueRows.slice(0, 400); track i.id) {
                        <tr [class.stk-row-resolved]="i.status === 'Resolved' || i.status === 'Dismissed'">
                          <td>{{ i.issueDate ? (i.issueDate | date:'dd MMM') : 'â€”' }}</td>
                          <td>{{ i.warehouseName || 'â€”' }}</td>
                          <td><span class="stk-chip">{{ i.company || 'â€”' }}</span></td>
                          <td class="mono">{{ i.itemCode || 'â€”' }}</td>
                          <td class="desc">{{ i.itemDescription }}</td>
                          <td><b>{{ i.issueType }}</b></td>
                          <td class="desc" [matTooltip]="i.detail">{{ i.detail }}</td>
                          <td><span class="stk-badge" [class.b-out]="i.status === 'Open'" [class.b-warn]="i.status === 'InProgress'" [class.b-in]="i.status === 'Resolved'">{{ i.status }}</span>
                            @if (i.resolution) { <div class="stk-resolution" [matTooltip]="'By ' + (i.resolvedBy || '?')">{{ i.resolution }}</div> }
                          </td>
                          <td style="text-align:right;white-space:nowrap;">
                            @if (i.status === 'Open') {
                              <button mat-icon-button matTooltip="Start working on this" (click)="setIssueStatus(i, 'InProgress')"><mat-icon>play_circle</mat-icon></button>
                            }
                            @if (i.status === 'Open' || i.status === 'InProgress') {
                              <button mat-icon-button matTooltip="Resolve" style="color:#16a34a;" (click)="openResolveIssue(i, 'Resolved')"><mat-icon>task_alt</mat-icon></button>
                              <button mat-icon-button matTooltip="Dismiss (not an issue)" (click)="openResolveIssue(i, 'Dismissed')"><mat-icon>block</mat-icon></button>
                            }
                            @if (i.status === 'Resolved' || i.status === 'Dismissed') {
                              <button mat-icon-button matTooltip="Reopen" (click)="setIssueStatus(i, 'Open')"><mat-icon>restart_alt</mat-icon></button>
                            }
                          </td>
                        </tr>
                      } @empty { <tr><td colspan="9" class="stk-empty">No issues found{{ whFilterName }} ðŸŽ‰</td></tr> }
                    </tbody>
                  </table>
                  @if (issueRows.length > 400) { <div class="stk-more">Showing first 400 of {{ issueRows.length | number }} issues</div> }
                </div>
              }
            </div>
          </mat-tab>

          <!-- EXCEPTIONS -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">report_problem</mat-icon> Exceptions</ng-template>
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
                <table class="stk-table">
                  <thead><tr><th>Code</th><th>Description</th><th>Company</th><th>Warehouse</th><th class="num">Qty</th><th>Issue</th></tr></thead>
                  <tbody>
                    @for (r of exceptionRows.slice(0, 400); track r.id) {
                      <tr>
                        <td class="mono">{{ r.commodityCode }}</td>
                        <td class="desc">{{ r.commodityName }}</td>
                        <td><span class="stk-chip">{{ r.category || 'â€”' }}</span></td>
                        <td>{{ r.warehouseName }}</td>
                        <td class="num"><b>{{ r.quantityOnHand | number }}</b></td>
                        <td><span class="stk-badge" [class.b-out]="excMode === 'out'" [class.b-neg]="excMode === 'neg'" [class.b-warn]="excMode === 'unpriced'">
                          {{ excMode === 'out' ? 'Out of stock' : (excMode === 'neg' ? 'Negative stock' : 'No sales price') }}</span></td>
                      </tr>
                    } @empty { <tr><td colspan="6" class="stk-empty">No exceptions â€” all good ðŸŽ‰</td></tr> }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>

          <!-- MOVEMENTS -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">swap_horiz</mat-icon> Movements
              @if (pendingDispatchCount > 0) { <span class="tab-count">{{ pendingDispatchCount }}</span> }
            </ng-template>
            <div class="stk-tab-body">

              <!-- Ledger summary strip -->
              <div class="mov-stats">
                <div class="mov-stat ms-amber" [class.ms-zero]="pendingDispatchCount === 0">
                  <mat-icon>pending_actions</mat-icon>
                  <div><b>{{ pendingDispatchCount | number }}</b><span>Pending Dispatch Approvals</span></div>
                </div>
                <div class="mov-stat ms-green">
                  <mat-icon>south_west</mat-icon>
                  <div><b>+{{ formatQty(movStockIn) }}</b><span>Units In (ledger)</span></div>
                </div>
                <div class="mov-stat ms-red">
                  <mat-icon>north_east</mat-icon>
                  <div><b>-{{ formatQty(movStockOut) }}</b><span>Units Out (ledger)</span></div>
                </div>
                <div class="mov-stat ms-blue">
                  <mat-icon>today</mat-icon>
                  <div><b>{{ movToday | number }}</b><span>Movements Today</span></div>
                </div>
              </div>

              <!-- Pending dispatch approval queue -->
              @if (pendingDispatchCount > 0) {
                <div class="mov-queue">
                  <div class="mov-queue-head">
                    <mat-icon>fact_check</mat-icon>
                    <b>Awaiting Stock Deduction</b>
                    <span class="mov-queue-sub">Tripsheets since the stock-count baseline that have not been approved against stock â€” review the picking slip and approve to deduct.</span>
                  </div>
                  @for (l of pendingDispatchLoads; track l.id) {
                    <div class="mov-queue-row">
                      <span class="mono mq-load">{{ l.loadNumber }}</span>
                      <span class="mq-wh">{{ l.warehouseName || 'â€”' }}</span>
                      <span class="mq-cust">{{ l.customerName || 'â€”' }}</span>
                      <span class="mq-date">{{ (l.actualDeliveryDate || l.scheduledDeliveryDate || l.createdAt) | date:'dd MMM yyyy' }}</span>
                      <span class="stk-badge" [class.b-in]="l.status === 'Delivered' || l.status === 'Completed'"
                            [class.b-warn]="l.status !== 'Delivered' && l.status !== 'Completed'">{{ l.status }}</span>
                      <span class="stk-spacer"></span>
                      <button mat-stroked-button (click)="openLoadDoc(l, 'picking')" matTooltip="View picking slip"><mat-icon>checklist</mat-icon> Slip</button>
                      @if (canApprove) {
                        <button mat-raised-button color="primary" (click)="openApproveDispatch(l)"><mat-icon>inventory</mat-icon> Review & Approve</button>
                      } @else {
                        <span class="mq-noperm" matTooltip="Requires the Stock Dispatch Approver permission">Approver required</span>
                      }
                    </div>
                  }
                  @if (pendingDispatchCount > pendingDispatchLoads.length) {
                    <div class="mov-queue-more">Showing {{ pendingDispatchLoads.length }} most recent of {{ pendingDispatchCount | number }} pending</div>
                  }
                </div>
              }

              <div class="stk-toolbar">
                <button mat-stroked-button [class.stk-filter-on]="movTypeFilter === ''" (click)="movTypeFilter = ''">All ({{ ledgerScoped.length }})</button>
                <button mat-stroked-button [class.stk-filter-on]="movTypeFilter === 'Receive'" (click)="movTypeFilter = 'Receive'">
                  <mat-icon>south_west</mat-icon> Receive ({{ movCount('Receive') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="movTypeFilter === 'Dispatch'" (click)="movTypeFilter = 'Dispatch'">
                  <mat-icon>north_east</mat-icon> Dispatch ({{ movCount('Dispatch') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="movTypeFilter === 'Transfer'" (click)="movTypeFilter = 'Transfer'">
                  <mat-icon>sync_alt</mat-icon> Transfer ({{ movCount('Transfer') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="movTypeFilter === 'Return'" (click)="movTypeFilter = 'Return'">
                  <mat-icon>undo</mat-icon> Return ({{ movCount('Return') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="movTypeFilter === 'Adjustment'" (click)="movTypeFilter = 'Adjustment'">
                  <mat-icon>tune</mat-icon> Adjust ({{ movCount('Adjustment') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="movTypeFilter === 'Scrap'" (click)="movTypeFilter = 'Scrap'">
                  <mat-icon>delete_sweep</mat-icon> Scrap ({{ movCount('Scrap') }})</button>
                <mat-form-field appearance="outline" class="stk-search">
                  <mat-icon matPrefix>search</mat-icon>
                  <input matInput [(ngModel)]="movSearch" placeholder="Code, description, reference, user...">
                </mat-form-field>
                <span class="stk-spacer"></span>
                <button mat-stroked-button (click)="loadLedger()" matTooltip="Reload movements"><mat-icon>refresh</mat-icon> Refresh</button>
                <button mat-stroked-button (click)="exportMovements()"><mat-icon>file_download</mat-icon> Export</button>
                <button mat-stroked-button (click)="openTransferStock()" matTooltip="Move stock between warehouses"><mat-icon>sync_alt</mat-icon> Transfer</button>
                <button mat-stroked-button (click)="openManualMovement('Adjustment')" matTooltip="Correct a stock count (+/-) with a reason"><mat-icon>tune</mat-icon> Adjust</button>
                <button mat-stroked-button (click)="openManualMovement('Return')" matTooltip="Customer return back into stock"><mat-icon>undo</mat-icon> Return</button>
                <button mat-stroked-button (click)="openManualMovement('Scrap')" matTooltip="Write off damaged or expired stock" style="color:#dc2626;"><mat-icon>delete_sweep</mat-icon> Scrap</button>
                <button mat-raised-button color="primary" (click)="openManualMovement('Receive')"><mat-icon>south_west</mat-icon> Receive Stock</button>
              </div>
              @if (ledgerLoading) { <div class="stk-loading"><mat-spinner diameter="32"></mat-spinner> Loading movements...</div> }
              @else {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr><th>Date</th><th>Type</th><th>Warehouse</th><th>Code</th><th>Description</th>
                      <th class="num">Qty</th><th class="num">Balance After</th><th>Reference</th><th>By</th><th style="text-align:right;">Actions</th></tr></thead>
                    <tbody>
                      @for (m of ledgerRows; track m.id) {
                        <tr [class.stk-row-resolved]="m.reversedByMovementId">
                          <td>{{ m.createdAt | date:'dd MMM HH:mm' }}</td>
                          <td><span class="stk-badge" [class.b-in]="m.quantity > 0" [class.b-out]="m.quantity < 0">{{ m.movementType }}</span></td>
                          <td>{{ m.warehouseName }}</td>
                          <td class="mono">{{ m.commodityCode }}</td>
                          <td class="desc">{{ m.commodityName }}</td>
                          <td class="num"><b [style.color]="m.quantity < 0 ? '#dc2626' : '#16a34a'">{{ m.quantity > 0 ? '+' : '' }}{{ m.quantity | number }}</b></td>
                          <td class="num" [style.color]="m.balanceAfter < 0 ? '#dc2626' : ''">{{ m.balanceAfter | number }}</td>
                          <td class="mono" [matTooltip]="m.reason">{{ m.reference }}</td>
                          <td>{{ m.createdBy }}</td>
                          <td style="text-align:right;white-space:nowrap;">
                            @if (m.loadId) {
                              <button mat-icon-button matTooltip="View the linked tripsheet's picking slip" (click)="openLedgerLoadDoc(m)"><mat-icon>checklist</mat-icon></button>
                            }
                            @if (canApprove && !m.reversedByMovementId && m.movementType !== 'Reversal') {
                              <button mat-icon-button matTooltip="Reverse this movement (creates a counter-entry)" (click)="reverseMovement(m)"><mat-icon>undo</mat-icon></button>
                            }
                            @if (m.reversedByMovementId) { <span class="stk-chip" matTooltip="Reversed by movement #{{ m.reversedByMovementId }}">Reversed</span> }
                            @if (m.reversesMovementId) { <span class="stk-chip" matTooltip="Reversal of movement #{{ m.reversesMovementId }}">â†© #{{ m.reversesMovementId }}</span> }
                          </td>
                        </tr>
                      } @empty { <tr><td colspan="10" class="stk-empty">No stock movements{{ movSearch ? ' matching "' + movSearch + '"' : '' }} â€” approve a dispatch or receive stock to start the ledger</td></tr> }
                    </tbody>
                  </table>
                </div>
                <p class="stk-note"><mat-icon>info</mat-icon> Stock on hand = imported baseline + these approved movements. Rows are never edited â€” mistakes are fixed with reversals.</p>
              }
            </div>
          </mat-tab>

          <!-- DISPATCH -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">local_shipping</mat-icon> Dispatch</ng-template>
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <button mat-stroked-button [class.stk-filter-on]="dispatchMode === 'tripsheets'" (click)="dispatchMode = 'tripsheets'">
                  <mat-icon>receipt_long</mat-icon> Tripsheets ({{ loadsScoped.length }})</button>
                <button mat-stroked-button [class.stk-filter-on]="dispatchMode === 'picking'" (click)="dispatchMode = 'picking'">
                  <mat-icon>checklist</mat-icon> Picking Slips ({{ loadsScoped.length }})</button>
                <button mat-stroked-button [class.stk-filter-on]="dispatchMode === 'invoices'" (click)="dispatchMode = 'invoices'">
                  <mat-icon>description</mat-icon> Invoices ({{ dispatchInvoiceRows.length }})</button>
                <span class="stk-sep"></span>
                <button mat-stroked-button [class.stk-filter-on]="dispatchDeductFilter === 'pending'" (click)="dispatchDeductFilter = dispatchDeductFilter === 'pending' ? '' : 'pending'" matTooltip="Tripsheets since the stock baseline whose stock has not been deducted yet">
                  <mat-icon>pending_actions</mat-icon> Awaiting approval ({{ dispatchCount('pending') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="dispatchDeductFilter === 'done'" (click)="dispatchDeductFilter = dispatchDeductFilter === 'done' ? '' : 'done'">
                  <mat-icon>inventory</mat-icon> Deducted ({{ dispatchCount('done') }})</button>
                <button mat-stroked-button [class.stk-filter-on]="dispatchDeductFilter === 'baseline'" (click)="dispatchDeductFilter = dispatchDeductFilter === 'baseline' ? '' : 'baseline'" matTooltip="Historical tripsheets already reflected in the imported stock count â€” cannot be approved again">
                  <mat-icon>history</mat-icon> Pre-baseline ({{ dispatchCount('baseline') }})</button>
                <mat-form-field appearance="outline" class="stk-search">
                  <mat-icon matPrefix>search</mat-icon>
                  <input matInput [(ngModel)]="dispatchSearch" placeholder="Load #, customer, driver, invoice...">
                </mat-form-field>
                <span class="stk-spacer"></span>
                <button mat-stroked-button (click)="loadDashboardData()" matTooltip="Reload"><mat-icon>refresh</mat-icon> Refresh</button>
                <button mat-stroked-button (click)="exportDispatch()"><mat-icon>file_download</mat-icon> Export</button>
              </div>

              <!-- TRIPSHEETS / PICKING SLIPS -->
              @if (dispatchMode === 'tripsheets' || dispatchMode === 'picking') {
                @if (loadsLoading) { <div class="stk-loading"><mat-spinner diameter="32"></mat-spinner> Loading tripsheets...</div> }
                @else {
                  <div class="stk-table-wrap">
                    <table class="stk-table">
                      <thead><tr>
                        <th>Load #</th><th>Warehouse</th><th>Customer</th><th>Driver</th><th>Vehicle</th>
                        <th class="num">Stops</th><th>Status</th><th>Delivery</th><th>POD</th><th>Stock</th><th style="text-align:right;">Actions</th>
                      </tr></thead>
                      <tbody>
                        @for (l of dispatchRows.slice(0, 500); track l.id) {
                          <tr>
                            <td class="mono">{{ l.loadNumber }}</td>
                            <td>{{ l.warehouseName || 'â€”' }}</td>
                            <td class="desc">{{ l.customerName || 'â€”' }}</td>
                            <td>{{ l.driverName || 'â€”' }}</td>
                            <td>{{ l.vehicleRegistration || 'â€”' }}</td>
                            <td class="num"><b>{{ l.stops?.length || 0 }}</b></td>
                            <td><span class="stk-badge" [class.b-in]="l.status === 'Delivered' || l.status === 'Completed'"
                                  [class.b-warn]="l.status === 'InTransit' || l.status === 'Pending' || l.status === 'Assigned'">{{ l.status }}</span></td>
                            <td>{{ (l.actualDeliveryDate || l.scheduledDeliveryDate) ? ((l.actualDeliveryDate || l.scheduledDeliveryDate) | date:'dd MMM yyyy') : 'â€”' }}</td>
                            <td>@if (l.hasPOD) { <mat-icon style="color:#16a34a;font-size:18px;width:18px;height:18px;" matTooltip="POD on file">verified</mat-icon> } @else { â€” }</td>
                            <td>
                              @switch (loadStockState(l)) {
                                @case ('deducted') { <span class="stk-badge b-in">Deducted</span> }
                                @case ('baseline') { <span class="stk-chip" matTooltip="Dated before the warehouse stock count â€” already in the baseline">Baseline</span> }
                                @default { <span class="stk-badge b-warn">Awaiting</span> }
                              }
                            </td>
                            <td style="text-align:right;white-space:nowrap;">
                              @if (loadStockState(l) === 'awaiting' && canApprove) {
                                <button mat-icon-button matTooltip="Review picking slip & approve dispatch (deducts stock)" style="color:#d97706;"
                                        (click)="openApproveDispatch(l)"><mat-icon>fact_check</mat-icon></button>
                              }
                              @if (dispatchMode === 'tripsheets') {
                                <button mat-icon-button matTooltip="View trip sheet" (click)="openLoadDoc(l, 'tripsheet')"><mat-icon>receipt_long</mat-icon></button>
                              }
                              <button mat-icon-button matTooltip="View picking slip" (click)="openLoadDoc(l, 'picking')"><mat-icon>checklist</mat-icon></button>
                            </td>
                          </tr>
                        } @empty { <tr><td colspan="11" class="stk-empty">No tripsheets found{{ whFilterName }}</td></tr> }
                      </tbody>
                    </table>
                    @if (dispatchRows.length > 500) { <div class="stk-more">Showing first 500 of {{ dispatchRows.length | number }} tripsheets â€” refine your search</div> }
                  </div>
                }
              }

              <!-- INVOICES -->
              @if (dispatchMode === 'invoices') {
                @if (loadsLoading) { <div class="stk-loading"><mat-spinner diameter="32"></mat-spinner> Loading invoices...</div> }
                @else {
                  <div class="stk-table-wrap">
                    <table class="stk-table">
                      <thead><tr>
                        <th>Invoice #</th><th>Order #</th><th>Customer / Stop</th><th>Load #</th><th>Warehouse</th><th>Status</th><th>Stock</th><th>Delivery</th><th style="text-align:right;">Actions</th>
                      </tr></thead>
                      <tbody>
                        @for (r of dispatchInvoiceRows.slice(0, 500); track $index) {
                          <tr>
                            <td class="mono">{{ r.invoiceNumber }}</td>
                            <td class="mono">{{ r.orderNumber || 'â€”' }}</td>
                            <td class="desc">{{ r.customerName }}</td>
                            <td class="mono">{{ r.loadNumber }}</td>
                            <td>{{ r.warehouseName || 'â€”' }}</td>
                            <td><span class="stk-badge" [class.b-in]="r.status === 'Delivered' || r.status === 'Completed'"
                                  [class.b-warn]="r.status === 'InTransit' || r.status === 'Pending' || r.status === 'Assigned'">{{ r.status }}</span></td>
                            <td><span class="stk-badge" [class.b-in]="r.deducted" [class.b-warn]="!r.deducted">{{ r.deducted ? 'Deducted' : 'Awaiting' }}</span></td>
                            <td>{{ r.deliveryDate ? (r.deliveryDate | date:'dd MMM yyyy') : 'â€”' }}</td>
                            <td style="text-align:right;white-space:nowrap;">
                              @if (!r.deducted && canApprove) {
                                <button mat-icon-button matTooltip="Review & approve dispatch" style="color:#d97706;" (click)="openApproveDispatch(r.load)"><mat-icon>fact_check</mat-icon></button>
                              }
                              <button mat-icon-button matTooltip="View trip sheet" (click)="openLoadDoc(r.load, 'tripsheet')"><mat-icon>receipt_long</mat-icon></button>
                            </td>
                          </tr>
                        } @empty { <tr><td colspan="9" class="stk-empty">No invoices found on tripsheets{{ whFilterName }}</td></tr> }
                      </tbody>
                    </table>
                    @if (dispatchInvoiceRows.length > 500) { <div class="stk-more">Showing first 500 of {{ dispatchInvoiceRows.length | number }} invoices</div> }
                  </div>
                }
              }
            </div>
          </mat-tab>

          <!-- REPORTS -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">summarize</mat-icon> Reports</ng-template>
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

              <!-- Valuation by company Ã— warehouse -->
              @if (reportMode === 'valuation') {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr><th>Company</th><th>Warehouse</th><th class="num">Items</th><th class="num">In Stock</th><th class="num">Out</th><th class="num">Units</th><th class="num">Sales Value</th><th class="num">Cost Value</th></tr></thead>
                    <tbody>
                      @for (r of valuationReport; track r.key) {
                        <tr [class.stk-row-total]="r.isTotal">
                          <td><b>{{ r.company }}</b></td>
                          <td>{{ r.warehouse }}</td>
                          <td class="num">{{ r.items | number }}</td>
                          <td class="num">{{ r.inStock | number }}</td>
                          <td class="num" [style.color]="r.out > 0 ? '#dc2626' : ''">{{ r.out | number }}</td>
                          <td class="num">{{ formatQty(r.units) }}</td>
                          <td class="num"><b>{{ formatValue(r.value) }}</b></td>
                          <td class="num">{{ formatValue(r.cost) }}</td>
                        </tr>
                      } @empty { <tr><td colspan="8" class="stk-empty">No stock data</td></tr> }
                    </tbody>
                  </table>
                </div>
                <p class="stk-note"><mat-icon>info</mat-icon> Sales value uses the latest invoiced unit price per item; cost value uses the item cost where captured.</p>
              }

              <!-- Movement activity by type Ã— warehouse -->
              @if (reportMode === 'activity') {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr><th>Warehouse</th><th>Type</th><th class="num">Movements</th><th class="num">Units In</th><th class="num">Units Out</th><th class="num">Net</th><th>Last</th></tr></thead>
                    <tbody>
                      @for (r of activityReport; track r.key) {
                        <tr [class.stk-row-total]="r.isTotal">
                          <td><b>{{ r.warehouse }}</b></td>
                          <td>{{ r.type }}</td>
                          <td class="num">{{ r.count | number }}</td>
                          <td class="num" style="color:#16a34a;">+{{ formatQty(r.unitsIn) }}</td>
                          <td class="num" style="color:#dc2626;">-{{ formatQty(r.unitsOut) }}</td>
                          <td class="num"><b [style.color]="r.net < 0 ? '#dc2626' : '#16a34a'">{{ r.net > 0 ? '+' : '' }}{{ formatQty(r.net) }}</b></td>
                          <td>{{ r.last ? (r.last | date:'dd MMM HH:mm') : 'â€”' }}</td>
                        </tr>
                      } @empty { <tr><td colspan="7" class="stk-empty">No ledger movements in this period{{ whFilterName }}</td></tr> }
                    </tbody>
                  </table>
                </div>
              }

              <!-- Dispatch compliance -->
              @if (reportMode === 'dispatch') {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr><th>Warehouse</th><th class="num">Tripsheets</th><th class="num">Pre-baseline</th><th class="num">Since baseline</th><th class="num">Stock Deducted</th><th class="num">Awaiting Approval</th><th class="num">% Approved</th><th class="num">Delivered but not deducted</th><th class="num">With POD</th></tr></thead>
                    <tbody>
                      @for (r of dispatchReport; track r.key) {
                        <tr [class.stk-row-total]="r.isTotal">
                          <td><b>{{ r.warehouse }}</b></td>
                          <td class="num">{{ r.total | number }}</td>
                          <td class="num" style="color:#94a3b8;">{{ r.baseline | number }}</td>
                          <td class="num">{{ r.live | number }}</td>
                          <td class="num" style="color:#16a34a;">{{ r.deducted | number }}</td>
                          <td class="num" [style.color]="r.pending > 0 ? '#d97706' : ''">{{ r.pending | number }}</td>
                          <td class="num"><b>{{ r.live ? (r.deducted / r.live * 100 | number:'1.0-0') : 0 }}%</b></td>
                          <td class="num" [style.color]="r.deliveredPending > 0 ? '#dc2626' : ''">{{ r.deliveredPending | number }}</td>
                          <td class="num">{{ r.withPod | number }}</td>
                        </tr>
                      } @empty { <tr><td colspan="9" class="stk-empty">No tripsheets</td></tr> }
                    </tbody>
                  </table>
                </div>
                <p class="stk-note"><mat-icon>info</mat-icon> Tripsheets dated before a warehouse's stock count are already in the imported baseline and are excluded from approval. "Delivered but not deducted" should be zero.</p>
              }

              <!-- Exceptions summary -->
              @if (reportMode === 'exceptions') {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr><th>Warehouse</th><th class="num">Out of Stock</th><th class="num">Negative</th><th class="num">Unpriced with Stock</th><th class="num">Open Issues</th><th class="num">In Progress</th></tr></thead>
                    <tbody>
                      @for (r of exceptionReport; track r.key) {
                        <tr [class.stk-row-total]="r.isTotal">
                          <td><b>{{ r.warehouse }}</b></td>
                          <td class="num" [style.color]="r.out > 0 ? '#dc2626' : ''">{{ r.out | number }}</td>
                          <td class="num" [style.color]="r.neg > 0 ? '#dc2626' : ''">{{ r.neg | number }}</td>
                          <td class="num" [style.color]="r.unpriced > 0 ? '#d97706' : ''">{{ r.unpriced | number }}</td>
                          <td class="num">{{ r.openIssues | number }}</td>
                          <td class="num">{{ r.inProgress | number }}</td>
                        </tr>
                      } @empty { <tr><td colspan="6" class="stk-empty">No data</td></tr> }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      }

      <!-- Welly Stock Analysis Panel -->
      @if (showWellyPanel) {
        <div class="welly-panel-overlay" (click)="closeWellyPanel()">
          <div class="welly-panel" (click)="$event.stopPropagation()">
            <div class="welly-panel-header">
              <div class="welly-panel-title">
                <mat-icon class="welly-sparkle">auto_awesome</mat-icon>
                <h3>Welly Stock Analysis</h3>
              </div>
              <button mat-icon-button (click)="closeWellyPanel()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="welly-panel-body" id="welly-analysis-content">
              @if (wellyLoading) {
                <div class="welly-loading">
                  <mat-spinner diameter="36"></mat-spinner>
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
      background:
        radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.35) 0, transparent 45%),
        radial-gradient(circle at 100% 0%, rgba(14, 165, 233, 0.30) 0, transparent 45%),
        radial-gradient(circle at 0% 100%, rgba(236, 72, 153, 0.24) 0, transparent 45%),
        radial-gradient(circle at 100% 100%, rgba(16, 185, 129, 0.26) 0, transparent 45%),
        linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%);
      background-attachment: fixed;
      overflow-x: hidden;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #e2e8f0;
      --accent: #2563eb;
      --accent2: #1e40af;
      --accent-soft: #eff6ff;
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

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 32px;
    }

    .header-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #1e90ff;
      background: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 20px;
      padding: 16px;
      box-sizing: content-box;
      flex-shrink: 0;
      box-shadow: 0 10px 30px rgba(2, 6, 23, 0.35);
      backdrop-filter: blur(10px);
    }

    .header-lead { display: flex; align-items: center; gap: 14px; }

    .header-text {
      text-align: left;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .header-actions button {
      font-weight: 500;
    }

    h1 {
      color: #ffffff;
      font-size: 32px;
      font-weight: 700;
      margin: 0 0 4px;
      text-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
      letter-spacing: -0.5px;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.85);
      font-size: 15px;
      margin: 0;
    }

    @media (max-width: 820px) {
      .warehouses-grid { grid-template-columns: 1fr; }
    }

    .warehouse-progress-bar ::ng-deep .mdc-linear-progress__bar-inner {
      border-top-width: 8px;
    }

    .warehouse-progress-bar ::ng-deep .mdc-linear-progress__buffer-bar {
      background-color: #e5e7eb !important;
    }

    .warehouse-progress-bar ::ng-deep .mdc-linear-progress__bar {
      animation: none;
    }

    .loading-state {
      display: flex; justify-content: center; padding: 60px 20px;
    }
    .loading-card {
      background: rgba(255,255,255,0.97); border-radius: 20px;
      padding: 48px 56px; text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      max-width: 520px; width: 100%;
    }
    .loading-card h3 { color: #1a1a2e; margin: 16px 0 6px; font-size: 20px; font-weight: 700; }
    .loading-card p { color: #64748b; margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
    .lc-icon-wrap {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      background: linear-gradient(135deg, rgba(14,165,233,0.12), rgba(6,182,212,0.12));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(14,165,233,0.15);
    }
    .lc-icon { font-size: 36px; width: 36px; height: 36px; color: #0ea5e9; }
    .pulse-icon { animation: pulseGlow 2s ease-in-out infinite; }
    @keyframes pulseGlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
    .lc-subtitle { color: #94a3b8 !important; font-size: 13px !important; }
    .lc-progress-wrap { margin: 8px 0 24px; }
    .lc-progress-track { height: 8px; border-radius: 4px; background: #f1f5f9; overflow: hidden; position: relative; }
    .lc-progress-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, #0ea5e9, #38bdf8, #06b6d4);
      background-size: 200% 100%; animation: shimmer 2s ease-in-out infinite;
      transition: width 0.15s ease-out; position: relative;
    }
    .lc-progress-fill::after {
      content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 24px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4)); border-radius: 0 4px 4px 0;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .lc-progress-info { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; }
    .lc-progress-message { color: #64748b; font-weight: 500; }
    .lc-progress-pct { color: #0ea5e9; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
    .lc-steps { display: flex; justify-content: space-between; gap: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; }
    .lc-step {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      flex: 1; padding-top: 16px; opacity: 0.35; transition: opacity 0.4s ease, transform 0.3s ease;
    }
    .lc-step.active { opacity: 1; transform: translateY(-2px); }
    .lc-step.done { opacity: 0.65; }
    .lc-step-dot {
      width: 32px; height: 32px; border-radius: 50%; background: #f1f5f9;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .lc-step-dot mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; transition: color 0.3s ease; }
    .lc-step.active .lc-step-dot { background: linear-gradient(135deg, #0ea5e9, #06b6d4); box-shadow: 0 2px 10px rgba(14,165,233,0.3); }
    .lc-step.active .lc-step-dot mat-icon { color: #fff; }
    .lc-step.done .lc-step-dot { background: #dcfce7; }
    .lc-step.done .lc-step-dot mat-icon { color: #16a34a; }
    .lc-step-label { font-size: 11px; font-weight: 600; color: #94a3b8; white-space: nowrap; }
    .lc-step.active .lc-step-label { color: #0ea5e9; }
    .lc-step.done .lc-step-label { color: #16a34a; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 72px;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 16px;
      color: var(--ink);
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      color: #cbd5e1;
    }

    .empty-state h3 {
      font-size: 1.3rem;
      margin: 0 0 8px 0;
    }

    .empty-state p {
      color: var(--muted);
      margin: 0;
    }

    @media (max-width: 820px) {
      .operations-grid { grid-template-columns: 1fr; }
    }

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
    .welly-stock-btn {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%) !important;
      color: white !important;
      border: none !important;
      transition: all 0.3s ease;
    }

    .welly-stock-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }

    .welly-stock-btn .welly-sparkle {
      color: #ffd700;
      margin-right: 4px;
    }

    .welly-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
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
      background: #f5f5f7;
      border-radius: 16px;
      width: 900px;
      max-width: 94vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      animation: slideUp 0.3s ease-out;
    }

    .welly-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
    }

    .welly-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .welly-panel-title h3 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;
    }

    .welly-sparkle {
      color: #ffd700;
    }

    .welly-panel-header button {
      color: white;
    }

    .welly-panel-body {
      padding: 20px 24px;
      overflow-y: auto;
      max-height: calc(90vh - 60px);
    }

    .welly-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 48px 32px;
    }

    .welly-loading p {
      color: #666;
      font-size: 14px;
    }

    /* Summary Cards */
    .welly-summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }

    .welly-summary-card {
      background: white;
      border-radius: 12px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      border-left: 4px solid #2563eb;
    }

    .welly-summary-card.card-stock { border-left-color: #2563eb; }
    .welly-summary-card.card-stock .summary-icon { color: #2563eb; }
    .welly-summary-card.card-value { border-left-color: #43a047; }
    .welly-summary-card.card-value .summary-icon { color: #43a047; }
    .welly-summary-card.card-alert { border-left-color: #ef5350; }
    .welly-summary-card.card-alert .summary-icon { color: #ef5350; }
    .welly-summary-card.card-invoice { border-left-color: #ff9800; }
    .welly-summary-card.card-invoice .summary-icon { color: #ff9800; }
    .welly-summary-card.card-delivery { border-left-color: #26a69a; }
    .welly-summary-card.card-delivery .summary-icon { color: #26a69a; }
    .welly-summary-card.card-rate { border-left-color: #7e57c2; }
    .welly-summary-card.card-rate .summary-icon { color: #7e57c2; }

    .summary-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .summary-info {
      display: flex;
      flex-direction: column;
    }

    .summary-value {
      font-size: 18px;
      font-weight: 700;
      color: #333;
      line-height: 1.2;
    }

    .summary-label {
      font-size: 11px;
      color: #888;
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
      background: white;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }

    .welly-chart-card h4 {
      margin: 0 0 12px 0;
      font-size: 13px;
      font-weight: 600;
      color: #555;
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
      font-size: 14px;
      font-weight: 600;
      color: #555;
    }

    .welly-section-title mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #2563eb;
    }

    .welly-result-text {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 18px;
      font-size: 13px;
      line-height: 1.7;
      white-space: pre-wrap;
      max-height: 40vh;
      overflow-y: auto;
      margin-bottom: 16px;
      color: #333;
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
      padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600;
      background: rgba(255,255,255,0.75); color: #334155; border: 1px solid rgba(148,163,184,0.35);
    }
    .client-chip b { color: #0f172a; }
    .stock-asat {
      display: flex; align-items: center; gap: 6px; margin-top: 8px;
      font-size: 11.5px; color: #64748b; position: relative; z-index: 1;
    }
    .stock-asat mat-icon { font-size: 15px; width: 15px; height: 15px; }

    /* â•â•â• Dashboard redesign â•â•â• */
    .stk-kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 18px; }
    @media (max-width: 1400px) { .stk-kpi-grid { grid-template-columns: repeat(3, 1fr); } }
    @media (max-width: 760px) { .stk-kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    .stk-kpi {
      background: #fff; border-radius: 22px; padding: 18px 18px; box-shadow: 0 10px 34px rgba(2,6,23,0.28);
      border-top: 4px solid transparent; transition: transform .25s ease, box-shadow .25s ease;
      position: relative; overflow: hidden;
    }
    .stk-kpi:hover { transform: translateY(-6px); box-shadow: 0 22px 52px rgba(2,6,23,0.38); }
    .stk-kpi mat-icon { font-size: 24px; width: 24px; height: 24px; opacity: 0.9; }
    .stk-kpi-val { font-size: 26px; font-weight: 700; color: #1a1a2e; margin-top: 6px; line-height: 1.1; }
    .stk-kpi-lbl { font-size: 12px; color: #666; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; margin-top: 3px; }
    .k-indigo { border-color: #6366f1; } .k-indigo mat-icon { color: #6366f1; }
    .k-green { border-color: #16a34a; } .k-green mat-icon { color: #16a34a; }
    .k-teal { border-color: #0d9488; } .k-teal mat-icon { color: #0d9488; }
    .k-emerald { border-color: #10b981; } .k-emerald mat-icon { color: #10b981; }
    .k-red { border-color: #dc2626; } .k-red mat-icon { color: #dc2626; }

    .stk-wh-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
    @media (max-width: 1200px) { .stk-wh-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 700px) { .stk-wh-grid { grid-template-columns: 1fr; } }
    .stk-wh-card {
      background: #fff; border-radius: 16px; padding: 18px; cursor: pointer;
      box-shadow: 0 10px 34px rgba(2,6,23,0.28); border: 2px solid transparent; transition: all .25s ease;
    }
    .stk-wh-card:hover { box-shadow: 0 22px 52px rgba(2,6,23,0.38); transform: translateY(-4px); }
    .stk-wh-card.active {
      border-color: #16a34a; background: #f0fdf4;
      box-shadow: 0 10px 34px rgba(22,163,74,0.35);
      animation: whPulse 2.6s ease-in-out infinite;
      position: relative;
    }
    .stk-wh-card.active .stk-wh-ico { color: #16a34a; }
    @keyframes whPulse {
      0%, 100% { box-shadow: 0 10px 34px rgba(22,163,74,0.30), 0 0 0 0 rgba(22,163,74,0.45); }
      50% { box-shadow: 0 10px 34px rgba(22,163,74,0.40), 0 0 0 7px rgba(22,163,74,0); }
    }
    /* Green shimmer running around the edges every now and again */
    .stk-wh-card.active::after {
      content: '';
      position: absolute; inset: -2px;
      border-radius: 16px;
      padding: 2px;
      background: conic-gradient(from var(--wh-angle, 0deg), transparent 0 78%, #16a34a 88%, #4ade80 93%, transparent 100%);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
      animation: whBorderSweep 4s linear infinite;
    }
    @property --wh-angle {
      syntax: '<angle>';
      initial-value: 0deg;
      inherits: false;
    }
    @keyframes whBorderSweep {
      0% { --wh-angle: 0deg; opacity: 0; }
      10% { opacity: 1; }
      55% { --wh-angle: 360deg; opacity: 1; }
      62% { --wh-angle: 360deg; opacity: 0; }
      100% { --wh-angle: 360deg; opacity: 0; }
    }
    .stk-wh-head { display: flex; align-items: center; gap: 10px; }
    .stk-wh-ico { color: #2563eb; }
    .stk-wh-title { flex: 1; min-width: 0; }
    .stk-wh-title h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .stk-wh-title span { font-size: 11.5px; color: #64748b; }
    .stk-wh-ops { color: #64748b; }
    .stk-wh-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 10px; }
    .stk-wh-stats > div { text-align: center; background: #f8fafc; border-radius: 8px; padding: 6px 2px; }
    .stk-wh-card.active .stk-wh-stats > div { background: rgba(255,255,255,0.7); }
    .stk-wh-stats b { display: block; font-size: 13px; color: #0f172a; }
    .stk-wh-stats b .out-sub { font-style: normal; font-size: 10px; color: #dc2626; font-weight: 600; }
    .stk-wh-stats span { font-size: 9.5px; color: #64748b; text-transform: uppercase; letter-spacing: .3px; font-weight: 600; }

    .stk-tabs { background: #fff; border-radius: 22px; box-shadow: 0 10px 34px rgba(2,6,23,0.28); overflow: hidden; margin-bottom: 30px; }
    .stk-tabs ::ng-deep .mat-mdc-tab-header {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      border-bottom: 1px solid rgba(0, 0, 0, 0.05);
    }
    .stk-tabs ::ng-deep .mat-mdc-tab { min-width: 140px; padding: 0 24px; }
    .stk-tabs ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
      display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px;
    }
    .stk-tabs ::ng-deep .mat-mdc-tab-body-wrapper { background: #fff; }

    /* Company filter chips â€” same design as Sales History */
    .sh-company-bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 18px; }
    .sh-company-chip {
      display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px;
      border: 1.5px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.92); border-radius: 999px;
      font-size: 13px; font-weight: 600; color: #475569; cursor: pointer;
      transition: all .18s ease; box-shadow: 0 4px 14px rgba(2,6,23,0.25);
    }
    .sh-company-chip mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .sh-company-chip:hover { background: #fff; transform: translateY(-1px); }
    .sh-company-chip.active {
      border-color: var(--chip-color, #1a237e); color: var(--chip-color, #1a237e);
      background: #fff; box-shadow: 0 6px 18px rgba(2,6,23,0.35);
    }
    .sh-company-chip--logo { padding: 6px 14px 6px 8px; gap: 8px; }
    .sh-chip-logo {
      width: 30px; height: 30px; object-fit: contain; object-position: center;
      display: block; filter: grayscale(30%); opacity: .82; transition: all .18s ease;
    }
    .sh-company-chip--logo:hover .sh-chip-logo { filter: grayscale(0%); opacity: 1; }
    .sh-company-chip--logo.active .sh-chip-logo { filter: none; opacity: 1; }
    .sh-chip-label { font-size: 12.5px; font-weight: 600; color: #475569; }
    .sh-company-chip--logo.active .sh-chip-label { color: var(--chip-color, #1a237e); }
    .tab-ico { margin-right: 6px; font-size: 18px; width: 18px; height: 18px; vertical-align: middle; }
    .stk-tab-body { padding: 16px; }
    .stk-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .stk-search { flex: 1; min-width: 240px; max-width: 420px; }
    .stk-search ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }

    /* Movements tab */
    .tab-count { background: #d97706; color: #fff; border-radius: 10px; font-size: 11px; font-weight: 800; padding: 1px 7px; margin-left: 6px; }
    .mov-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
    @media (max-width: 1100px) { .mov-stats { grid-template-columns: repeat(2, 1fr); } }
    .mov-stat { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 16px; }
    .mov-stat mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .mov-stat b { display: block; font-size: 20px; line-height: 1.1; color: #0f172a; }
    .mov-stat span { font-size: 11.5px; color: #64748b; text-transform: uppercase; letter-spacing: 0.4px; }
    .mov-stat.ms-amber mat-icon { color: #d97706; } .mov-stat.ms-amber { border-color: #fcd34d; background: #fffbeb; }
    .mov-stat.ms-amber.ms-zero { border-color: #e2e8f0; background: #fff; }
    .mov-stat.ms-green mat-icon { color: #16a34a; } .mov-stat.ms-green b { color: #16a34a; }
    .mov-stat.ms-red mat-icon { color: #dc2626; } .mov-stat.ms-red b { color: #dc2626; }
    .mov-stat.ms-blue mat-icon { color: #2563eb; }
    .mov-queue { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 14px; padding: 12px 16px; margin-bottom: 16px; }
    .mov-queue-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; color: #92400e; }
    .mov-queue-head mat-icon { color: #d97706; }
    .mov-queue-sub { font-size: 12px; color: #a16207; font-weight: 400; }
    .mov-queue-row { display: flex; align-items: center; gap: 14px; padding: 8px 10px; background: #fff; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 6px; font-size: 13px; }
    .mq-load { font-weight: 700; min-width: 110px; }
    .mq-wh { min-width: 170px; color: #475569; }
    .mq-cust { flex: 1; color: #334155; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .mq-date { color: #64748b; white-space: nowrap; }
    .mq-noperm { font-size: 12px; color: #94a3b8; font-style: italic; }
    .mov-queue-more { font-size: 12px; color: #a16207; text-align: center; padding: 4px 0 0; }
    .stk-count { font-size: 12.5px; color: #64748b; font-weight: 600; }
    .stk-spacer { flex: 1; }
    .stk-sep { width: 1px; height: 26px; background: #e2e8f0; margin: 0 4px; }
    .stk-row-total td { background: #f8fafc; font-weight: 700; border-top: 2px solid #cbd5e1; }
    .stk-filter-on { background: #eff6ff !important; border-color: #2563eb !important; color: #1d4ed8 !important; }
    .stk-loading { display: flex; align-items: center; gap: 12px; padding: 30px; color: #64748b; }
    .stk-table-wrap { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .stk-table { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; }
    .stk-table thead th { text-align: left; padding: 9px 12px; background: #f1f5f9; color: #475569; font-weight: 700; font-size: 11.5px; text-transform: uppercase; letter-spacing: .3px; white-space: nowrap; position: sticky; top: 0; }
    .stk-table th.num, .stk-table td.num { text-align: right; }
    .stk-table tbody td { padding: 8px 12px; border-top: 1px solid #f1f5f9; color: #334155; }
    .stk-table tbody tr:hover { background: #f8fafc; }
    .stk-table td.mono { font-family: monospace; font-weight: 600; color: #0f172a; white-space: nowrap; }
    .stk-table td.desc { max-width: 340px; }
    .stk-chip { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #e2e8f0; color: #475569; }
    .stk-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: #e2e8f0; color: #475569; white-space: nowrap; }
    .stk-badge.b-in { background: #dcfce7; color: #166534; }
    .stk-badge.b-out { background: #fee2e2; color: #991b1b; }
    .stk-badge.b-neg { background: #7f1d1d; color: #fff; }
    .stk-badge.b-warn { background: #fef3c7; color: #92400e; }
    .stk-empty { text-align: center; padding: 28px; color: #94a3b8; }
    .stk-row-resolved td { opacity: 0.55; }
    .stk-resolution { font-size: 11px; color: #16a34a; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
    .stk-more { text-align: center; padding: 10px; font-size: 12px; color: #64748b; background: #f8fafc; }
    .stk-note { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12.5px; color: #64748b; }
    .stk-note mat-icon { font-size: 17px; width: 17px; height: 17px; color: #2563eb; }
    @media (max-width: 1100px) { .stk-reports-grid { grid-template-columns: repeat(2, 1fr); } }
  `]
})
export class StockManagementComponent implements OnInit {
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

  // â•â•â• Dashboard state â•â•â•
  whFilterId: number | null = null;
  allInventory: any[] = [];
  invLoading = true;
  sohSearch = '';
  excMode: 'out' | 'neg' | 'unpriced' = 'out';

  private get kpiSet(): WarehouseSummary[] { return this.whFilterId ? this.warehouses.filter(w => w.id === this.whFilterId) : this.warehouses; }
  get kpiUnits(): number { return this.kpiSet.reduce((s, w) => s + (w.totalQuantityOnHand || 0), 0); }
  get kpiValue(): number { return this.kpiSet.reduce((s, w) => s + (w.totalStockValue || 0), 0); }
  get kpiCost(): number { return this.kpiSet.reduce((s, w) => s + (w.totalCostValue || 0), 0); }
  get kpiIn(): number { return this.kpiSet.reduce((s, w) => s + (w.itemsInStock || 0), 0); }
  get kpiOut(): number { return this.kpiSet.reduce((s, w) => s + (w.itemsOutOfStock || 0), 0); }

  get whFilterName(): string {
    if (!this.whFilterId) return '';
    const w = this.warehouses.find(x => x.id === this.whFilterId);
    return w ? ' â€” ' + w.name : '';
  }

  toggleWhFilter(id: number): void {
    this.whFilterId = this.whFilterId === id ? null : id;
  }

  /** Company filter (matches Commodities.Category) â€” same companies as Sales */
  companyFilter = '';
  stockCompanies = [
    { key: 'PROMED', shortName: 'Promed', color: '#1a237e', logo: 'logos/promed-round.png?v=4' },
    { key: 'ACCESS', shortName: 'Access', color: '#00695c', logo: 'logos/access-round.png?v=4' },
    { key: 'PHARMACARE', shortName: 'Pharmatech', color: '#c62828', logo: 'logos/pharmatech-round.png?v=4' },
    { key: 'SEBENZANI', shortName: 'Sebenzani', color: '#6a1b9a', logo: 'logos/sebenzani-round.png?v=4' },
    { key: 'KOG', shortName: 'KOG', color: '#b45309', logo: '' }
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

  // â•â•â• Reports (computed on-screen from scoped data) â•â•â•
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


  // â•â•â• Stock issues â•â•â•
  issues: any[] = [];
  issuesLoading = true;
  issueStatusFilter = 'Open';
  issueSearch = '';

  // â•â•â• Stock ledger (WarehouseStockMovements) â•â•â•
  ledger: any[] = [];
  ledgerLoading = true;
  movTypeFilter = '';
  movSearch = '';
  canApprove = false;
  deductedLoadIds = new Set<number>();

  get ledgerScoped(): any[] {
    return this.whFilterId ? this.ledger.filter(m => m.warehouseId === this.whFilterId) : this.ledger;
  }
  get ledgerRows(): any[] {
    let rows = this.movTypeFilter ? this.ledgerScoped.filter(m => m.movementType === this.movTypeFilter) : this.ledgerScoped;
    const t = this.movSearch.trim().toLowerCase();
    if (t) {
      rows = rows.filter(m =>
        (m.commodityCode || '').toLowerCase().includes(t) ||
        (m.commodityName || '').toLowerCase().includes(t) ||
        (m.reference || '').toLowerCase().includes(t) ||
        (m.createdBy || '').toLowerCase().includes(t) ||
        (m.warehouseName || '').toLowerCase().includes(t));
    }
    return rows;
  }
  movCount(t: string): number { return this.ledgerScoped.filter(m => m.movementType === t).length; }

  get movStockIn(): number { return this.ledgerScoped.filter(m => m.quantity > 0).reduce((s, m) => s + m.quantity, 0); }
  get movStockOut(): number { return Math.abs(this.ledgerScoped.filter(m => m.quantity < 0).reduce((s, m) => s + m.quantity, 0)); }
  get movToday(): number {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return this.ledgerScoped.filter(m => new Date(m.createdAt) >= today).length;
  }

  /** Loads whose stock has not yet been deducted â€” the approval work-queue (most recent first) */
  private get pendingDispatchAll(): any[] {
    return this.loadsScoped.filter(l => this.isLoadAwaiting(l));
  }
  get pendingDispatchCount(): number { return this.pendingDispatchAll.length; }
  get pendingDispatchLoads(): any[] {
    return [...this.pendingDispatchAll]
      .sort((a, b) => new Date(b.actualDeliveryDate || b.scheduledDeliveryDate || b.createdAt || 0).getTime()
                    - new Date(a.actualDeliveryDate || a.scheduledDeliveryDate || a.createdAt || 0).getTime())
      .slice(0, 15);
  }

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
  }

  isLoadDeducted(loadId: number): boolean { return this.deductedLoadIds.has(loadId); }

  /**
   * Loads dated before the warehouse's stock-count baseline are already reflected in the imported
   * quantities, so they must never be approved again (that would double-deduct).
   */
  isLoadBaseline(l: any): boolean {
    if (this.deductedLoadIds.has(l.id)) return false;
    const w = this.warehouses.find(x => x.id === l.warehouseId);
    if (!w?.lastCountDate) return false;
    const loadDate = new Date(l.actualDeliveryDate || l.scheduledDeliveryDate || l.createdAt || 0).getTime();
    return loadDate < new Date(w.lastCountDate).getTime();
  }
  /** Awaiting = after baseline and not yet deducted */
  isLoadAwaiting(l: any): boolean { return !this.deductedLoadIds.has(l.id) && !this.isLoadBaseline(l); }
  loadStockState(l: any): 'deducted' | 'awaiting' | 'baseline' {
    return this.deductedLoadIds.has(l.id) ? 'deducted' : (this.isLoadBaseline(l) ? 'baseline' : 'awaiting');
  }

  openManualMovement(type: 'Receive' | 'Return' | 'Adjustment' | 'Scrap'): void {
    const w = this.whFilterId ? this.warehouses.find(x => x.id === this.whFilterId) : (this.warehouses.length === 1 ? this.warehouses[0] : null);
    const ref = this.dialog.open(ManualMovementDialog, {
      width: '620px', maxWidth: '95vw',
      data: { warehouse: w, warehouses: this.warehouses, type, inventory: this.allInventory }
    });
    ref.afterClosed().subscribe(done => { if (done) { this.loadLedger(); this.loadDashboardData(); this.loadWarehouses(); } });
  }

  openTransferStock(): void {
    const from = this.whFilterId ? this.warehouses.find(w => w.id === this.whFilterId) : this.warehouses[0];
    const ref = this.dialog.open(TransferStockDialog, {
      width: '680px', maxWidth: '95vw',
      data: { warehouses: this.warehouses, fromWarehouseId: from?.id, inventory: this.allInventory }
    });
    ref.afterClosed().subscribe(done => { if (done) { this.loadLedger(); this.loadDashboardData(); this.loadWarehouses(); } });
  }

  /** Open the picking slip for the load linked to a ledger row */
  openLedgerLoadDoc(m: any): void {
    const load = this.loads.find(l => l.id === m.loadId);
    if (load) { this.openLoadDoc(load, 'picking'); }
    else { this.snackBar.open(`Load #${m.loadId} not loaded in dispatch list`, 'Close', { duration: 3000 }); }
  }

  openApproveDispatch(load: any): void {
    const whId = load.warehouseId;
    if (!whId) { this.snackBar.open('This load has no originating warehouse set', 'Close', { duration: 4000 }); return; }
    const ref = this.dialog.open(ApproveDispatchDialog, {
      width: '900px', maxWidth: '95vw',
      data: { load, inventory: this.allInventory.filter(r => r.warehouseId === whId) }
    });
    ref.afterClosed().subscribe(done => {
      if (done) { this.deductedLoadIds.add(load.id); this.loadLedger(); this.loadDashboardData(); this.loadWarehouses(); }
    });
  }

  reverseMovement(m: any): void {
    const reason = prompt(`Reverse ${m.movementType} of ${m.quantity} Ã— ${m.commodityCode}?\n\nReason for reversal (required):`);
    if (!reason || !reason.trim()) return;
    this.http.post(`${environment.apiUrl}/logistics/stock-movements/${m.id}/reverse`, { reason: reason.trim() }).subscribe({
      next: () => { this.snackBar.open('Movement reversed', 'Close', { duration: 3000 }); this.loadLedger(); this.loadDashboardData(); this.loadWarehouses(); },
      error: (e) => this.snackBar.open(e?.error?.message || 'Failed to reverse movement', 'Close', { duration: 4000 })
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
      next: () => { issue.status = status; this.snackBar.open(`Issue marked ${status}`, 'Close', { duration: 2500 }); },
      error: () => this.snackBar.open('Failed to update issue', 'Close', { duration: 3000 })
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

  // â•â•â• Dispatch: tripsheets / picking slips / invoices from logistics â•â•â•
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
            customerName: s.customerName || s.companyName || s.locationName || l.customerName || 'â€”',
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
      error: () => this.snackBar.open(`Could not load ${kind === 'picking' ? 'picking slip' : 'trip sheet'} for ${load.loadNumber}`, 'Close', { duration: 4000 })
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
    this.snackBar.open('Click a warehouse card above to choose where this action happens', 'OK', { duration: 4000 });
    return null;
  }

  open3DView(warehouse: any): void {
    this.dialog.open(Warehouse3DDialog, {
      width: '96vw', maxWidth: '96vw', height: '90vh',
      panelClass: 'stk-3d-dialog-panel',
      data: warehouse
    });
  }

  openStockTakeForFilter(): void {
    const w = this.resolveTargetWarehouse();
    if (!w) return;
    const ref = this.dialog.open(StockTakeDialog, {
      width: '1200px', maxWidth: '95vw',
      data: { warehouse: w, inventory: this.allInventory.filter(r => r.warehouseId === w.id) }
    });
    ref.afterClosed().subscribe(done => { if (done) { this.loadLedger(); this.loadWarehouses(); this.loadDashboardData(); } });
  }

  // â•â•â• Excel exports â•â•â•
  private async writeExcel(rows: any[], sheet: string, file: string): Promise<void> {
    if (!rows.length) { this.snackBar.open('Nothing to export', 'Close', { duration: 3000 }); return; }
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheet);
    XLSX.writeFile(wb, file);
    this.snackBar.open(`Exported ${rows.length} rows`, 'Close', { duration: 3000 });
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
      'Type': m.movementType, 'Warehouse': m.warehouseName, 'Code': m.commodityCode,
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
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadDashboardData();
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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // Welly AI Stock Analysis (Enhanced with Charts + PDF)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
        this.snackBar.open('Welly could not analyze stock. Please try again.', 'Close', { duration: 3000 });
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

    this.snackBar.open('Generating PDF...', '', { duration: 2000 });

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
      pdf.text(`ProMed Technologies â€” Welly Stock Analysis`, 10, 8);
      pdf.text(`${this.selectedWarehouse?.name || 'Warehouse'} â€” ${new Date().toLocaleDateString()}`, 10, 13);
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
      this.snackBar.open('PDF downloaded âœ“', 'Close', { duration: 2000 });
    } catch (err) {
      console.error('PDF generation error:', err);
      this.snackBar.open('Failed to generate PDF. Please try again.', 'Close', { duration: 3000 });
    }
  }

  copyWellyResult(): void {
    navigator.clipboard.writeText(this.wellyResult).then(() => {
      this.snackBar.open('Copied to clipboard âœ“', 'Close', { duration: 2000 });
    });
  }
}

// Stock Take Dialog Component â€” counts against WarehouseInventory, posts variances to the ledger
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
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:#d97706;">fact_check</mat-icon>
      Stock Take â€” {{ data.warehouse.name }}
    </h2>
    <mat-dialog-content>
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
        <table class="st-table">
          <thead><tr>
            <th>Code</th><th>Description</th><th>Company</th><th>UOM</th>
            <th class="num">System Qty</th><th class="num" style="width:130px;">Counted</th><th class="num">Variance</th>
          </tr></thead>
          <tbody>
            @for (r of rows().slice(0, 500); track r.commodityId) {
              <tr [class.st-diff]="r.counted !== null && r.counted !== r.systemQty">
                <td class="mono">{{ r.code }}</td>
                <td class="desc">{{ r.name }}</td>
                <td><span class="st-chip">{{ r.company || 'â€”' }}</span></td>
                <td>{{ r.uom }}</td>
                <td class="num">{{ r.systemQty | number }}</td>
                <td class="num"><input class="st-qty" type="number" min="0" [(ngModel)]="r.counted" placeholder="â€”"></td>
                <td class="num">
                  @if (r.counted !== null && r.counted !== undefined) {
                    <b [style.color]="varianceOf(r) > 0 ? '#16a34a' : (varianceOf(r) < 0 ? '#dc2626' : '#94a3b8')">
                      {{ varianceOf(r) > 0 ? '+' : '' }}{{ varianceOf(r) | number }}</b>
                  } @else { <span style="color:#cbd5e1;">â€”</span> }
                </td>
              </tr>
            } @empty { <tr><td colspan="7" class="st-empty">No items match</td></tr> }
          </tbody>
        </table>
        @if (rows().length > 500) { <div class="st-more">Showing first 500 of {{ rows().length | number }} â€” narrow the filter</div> }
      </div>

      @if (varianceLines().length) {
        <div class="st-summary">
          <div><b>{{ varianceLines().length }}</b><span>lines with variance</span></div>
          <div class="pos"><b>+{{ totalOver() | number }}</b><span>units over</span></div>
          <div class="neg"><b>{{ totalShort() | number }}</b><span>units short</span></div>
        </div>
        <mat-form-field appearance="outline" style="width:100%;margin-top:10px;">
          <mat-label>Reason for variances (required)</mat-label>
          <input matInput [(ngModel)]="reason" placeholder="e.g. Quarterly count â€” Oct 2026">
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
    .st-on { background: #fef3c7 !important; border-color: #f59e0b !important; }
    .st-table-wrap { max-height: 50vh; overflow: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .st-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .st-table th { position: sticky; top: 0; background: #f8fafc; text-align: left; padding: 8px 10px; font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
    .st-table td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; }
    .st-table .num { text-align: right; }
    .st-table .mono { font-family: monospace; font-weight: 600; }
    .st-table .desc { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .st-diff { background: #fffbeb; }
    .st-chip { font-size: 11px; background: #eef2ff; color: #3730a3; padding: 2px 8px; border-radius: 10px; }
    .st-qty { width: 110px; text-align: right; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; }
    .st-qty:focus { outline: 2px solid #f59e0b; border-color: transparent; }
    .st-empty, .st-more { text-align: center; color: #94a3b8; padding: 16px; font-size: 12.5px; }
    .st-summary { display: flex; gap: 14px; margin-top: 12px; }
    .st-summary > div { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; display: flex; flex-direction: column; }
    .st-summary b { font-size: 20px; }
    .st-summary span { font-size: 12px; color: #64748b; }
    .st-summary .pos b { color: #16a34a; } .st-summary .neg b { color: #dc2626; }
    .st-note { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #64748b; margin-top: 12px; }
    .st-note mat-icon { font-size: 17px; width: 17px; height: 17px; color: #2563eb; }
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
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.reference = `STK-${this.data.warehouse.code || this.data.warehouse.id}-${new Date().toISOString().substring(0, 10)}`;
    this.lines = (this.data.inventory || []).map((r: any) => ({
      commodityId: r.commodityId,
      code: r.commodityCode || '',
      name: r.commodityName || '',
      company: r.category || '',
      uom: r.unitOfMeasure || 'Each',
      systemQty: +(r.quantityOnHand || 0),
      counted: null
    })).sort((a: any, b: any) => a.code.localeCompare(b.code));
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
        this.snackBar.open(`Stock take posted â€” ${r?.adjusted ?? payload.lines.length} adjustment(s) written to the ledger`, 'Close', { duration: 5000 });
        this.dialogRef.close(true);
      },
      error: (e) => { this.saving = false; this.snackBar.open(e?.error?.message || 'Failed to post stock take', 'Close', { duration: 5000 }); }
    });
  }
}

// â•â•â• Warehouse 3D View Dialog â•â•â•
@Component({
  selector: 'app-warehouse-3d-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, Warehouse3DComponent],
  template: `
    <div class="w3d-head">
      <div class="w3d-title">
        <mat-icon>view_in_ar</mat-icon>
        <h2>{{ data.name }} â€” 3D Stock View</h2>
      </div>
      <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
    </div>
    <div class="w3d-body">
      <app-warehouse-3d [embeddedWarehouseId]="data.id"></app-warehouse-3d>
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; }
    .w3d-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #e2e8f0; }
    .w3d-title { display: flex; align-items: center; gap: 10px; }
    .w3d-title mat-icon { color: #16a34a; }
    .w3d-title h2 { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; }
    .w3d-body { flex: 1; min-height: 0; overflow: hidden; }
    .w3d-body app-warehouse-3d { display: block; height: 100%; }
  `]
})
export class Warehouse3DDialog {
  constructor(@Inject(MAT_DIALOG_DATA) public data: any) {}
}

// â•â•â• Create Stock Issue Dialog â•â•â•
@Component({
  selector: 'app-create-issue-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title><mat-icon style="vertical-align:middle;margin-right:8px;color:#d97706;">assignment_late</mat-icon> New Stock Issue</h2>
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
            <mat-option [value]="''">â€”</mat-option>
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
    'Opening â‰  previous closing',
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
  private snackBar = inject(MatSnackBar);

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
      next: () => { this.snackBar.open('Issue created', 'Close', { duration: 3000 }); this.dialogRef.close(true); },
      error: () => { this.saving = false; this.snackBar.open('Failed to create issue', 'Close', { duration: 3000 }); }
    });
  }
}

// â•â•â• Resolve Stock Issue Dialog â•â•â•
@Component({
  selector: 'app-resolve-issue-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;" [style.color]="data.status === 'Resolved' ? '#16a34a' : '#64748b'">
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
    .ri-summary { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; margin-bottom: 14px; }
    .ri-code { font-family: monospace; background: #e2e8f0; border-radius: 6px; padding: 1px 7px; margin-left: 8px; font-size: 12px; }
    .ri-detail { font-size: 12.5px; color: #64748b; margin-top: 6px; }
    .ri-quick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .ri-chip { font-size: 11.5px !important; line-height: 28px !important; padding: 0 10px !important; border-radius: 999px !important; }
  `]
})
export class ResolveIssueDialog {
  resolution = '';
  saving = false;

  quickNotes: string[] = [];

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    public dialogRef: MatDialogRef<ResolveIssueDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.quickNotes = data.status === 'Resolved'
      ? ['Recount performed and balance corrected', 'GRV / receipt captured retrospectively', 'Data captured incorrectly â€” sheet corrected', 'Stock adjusted via stock take']
      : ['Known timing difference between sheets', 'Duplicate of another issue', 'Expected behaviour â€” not an error'];
  }

  save(): void {
    this.saving = true;
    this.http.put(`${environment.apiUrl}/logistics/stock-issues/${this.data.issue.id}/status`,
      { status: this.data.status, resolution: this.resolution.trim() }).subscribe({
      next: () => { this.snackBar.open(`Issue ${this.data.status.toLowerCase()}`, 'Close', { duration: 3000 }); this.dialogRef.close(true); },
      error: () => { this.saving = false; this.snackBar.open('Failed to update issue', 'Close', { duration: 3000 }); }
    });
  }
}

// â•â•â• Manual Movement Dialog (Receive / Return) â•â•â•
@Component({
  selector: 'app-manual-movement-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;" [style.color]="data.type === 'Scrap' ? '#dc2626' : '#16a34a'">{{ typeIcon() }}</mat-icon>
      {{ typeTitle() }}
    </h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width:100%;">
        <mat-label>Warehouse</mat-label>
        <mat-select [(ngModel)]="warehouseId" (ngModelChange)="selected = null">
          @for (w of data.warehouses; track w.id) { <mat-option [value]="w.id">{{ w.name }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" style="width:100%;">
        <mat-label>Search item</mat-label>
        <input matInput [(ngModel)]="search" placeholder="Code or description" (ngModelChange)="selected = null" [disabled]="!warehouseId">
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>
      @if (!selected) {
        <div class="mm-list">
          @for (r of matches(); track r.id) {
            <button class="mm-item" (click)="selected = r">
              <span class="mm-code">{{ r.commodityCode }}</span>
              <span class="mm-name">{{ r.commodityName }}</span>
              <span class="mm-qty">{{ r.quantityOnHand | number }} on hand</span>
            </button>
          } @empty { <div class="mm-empty">{{ warehouseId ? 'Type to search items at this warehouse' : 'Choose a warehouse first' }}</div> }
        </div>
      } @else {
        <div class="mm-selected">
          <div><b>{{ selected.commodityCode }}</b> â€” {{ selected.commodityName }}</div>
          <div class="mm-onhand">On hand: <b>{{ selected.quantityOnHand | number }}</b></div>
          <button mat-button (click)="selected = null"><mat-icon>swap_horiz</mat-icon> Change item</button>
        </div>
        <div class="mm-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ data.type === 'Adjustment' ? 'Adjustment (+/-)' : 'Quantity (' + (data.type === 'Receive' ? 'received' : (data.type === 'Scrap' ? 'scrapped' : 'returned')) + ')' }}</mat-label>
            <input matInput type="number" [min]="data.type === 'Adjustment' ? null : 1" [(ngModel)]="quantity">
            @if (selected && quantity) {
              <mat-hint>New balance: {{ selected.quantityOnHand + signedQty() | number }}</mat-hint>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ data.type === 'Receive' ? 'Supplier / GRV reference' : (data.type === 'Adjustment' ? 'Reference (count sheet, etc.)' : (data.type === 'Scrap' ? 'Reference (damage report, batch)' : 'Return reference (invoice, customer)')) }}</mat-label>
            <input matInput [(ngModel)]="reference">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" style="width:100%;">
          <mat-label>{{ (data.type === 'Adjustment' || data.type === 'Scrap') ? 'Reason (required)' : 'Notes (optional)' }}</mat-label>
          <input matInput [(ngModel)]="reason">
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button [color]="data.type === 'Scrap' ? 'warn' : 'primary'" [disabled]="!valid() || saving" (click)="save()">
        <mat-icon>check</mat-icon> {{ data.type === 'Adjustment' ? 'Adjust' : data.type }} {{ quantity || '' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .mm-list { max-height: 260px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .mm-item { display: flex; gap: 10px; align-items: center; width: 100%; text-align: left; padding: 9px 12px; border: 0; border-bottom: 1px solid #f1f5f9; background: #fff; cursor: pointer; }
    .mm-item:hover { background: #f0fdf4; }
    .mm-code { font-family: monospace; font-weight: 700; min-width: 110px; }
    .mm-name { flex: 1; font-size: 13px; color: #334155; }
    .mm-qty { font-size: 12px; color: #64748b; white-space: nowrap; }
    .mm-empty { padding: 20px; text-align: center; color: #94a3b8; }
    .mm-selected { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
    .mm-onhand { font-size: 13px; color: #475569; margin: 4px 0; }
    .mm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    mat-form-field { width: 100%; }
  `]
})
export class ManualMovementDialog {
  warehouseId: number | null = null;
  search = '';
  selected: any = null;
  quantity: number | null = null;
  reference = '';
  reason = '';
  saving = false;

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    public dialogRef: MatDialogRef<ManualMovementDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.warehouseId = data.warehouse?.id ?? null;
  }

  matches(): any[] {
    const t = this.search.trim().toLowerCase();
    if (!t || !this.warehouseId) return [];
    return (this.data.inventory || []).filter((r: any) =>
      r.warehouseId === this.warehouseId && (
      (r.commodityCode || '').toLowerCase().includes(t) ||
      (r.commodityName || '').toLowerCase().includes(t))).slice(0, 50);
  }

  typeIcon(): string {
    switch (this.data.type) { case 'Receive': return 'south_west'; case 'Adjustment': return 'tune'; case 'Scrap': return 'delete_sweep'; default: return 'undo'; }
  }
  typeTitle(): string {
    switch (this.data.type) { case 'Receive': return 'Receive Stock (GRV)'; case 'Adjustment': return 'Stock Adjustment'; case 'Scrap': return 'Scrap / Write-off'; default: return 'Return Stock'; }
  }
  signedQty(): number {
    const q = this.quantity || 0;
    return this.data.type === 'Scrap' ? -Math.abs(q) : q;
  }

  valid(): boolean {
    if (!this.warehouseId || !this.selected || !this.quantity || this.quantity === 0) return false;
    if (this.data.type === 'Adjustment' || this.data.type === 'Scrap') return !!this.reason.trim();
    return this.quantity > 0;
  }

  save(): void {
    this.saving = true;
    this.http.post(`${environment.apiUrl}/logistics/stock-movements`, {
      warehouseId: this.warehouseId,
      commodityId: this.selected.commodityId,
      movementType: this.data.type,
      quantity: this.quantity,
      reference: this.reference || null,
      reason: this.reason || null
    }).subscribe({
      next: (r: any) => {
        this.snackBar.open(`${this.data.type} recorded â€” new balance ${r?.balanceAfter ?? ''}`, 'Close', { duration: 3500 });
        this.dialogRef.close(true);
      },
      error: (e) => { this.saving = false; this.snackBar.open(e?.error?.message || 'Failed to record movement', 'Close', { duration: 4000 }); }
    });
  }
}

// â•â•â• Transfer Stock Dialog (warehouse â†’ warehouse) â•â•â•
@Component({
  selector: 'app-transfer-stock-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:#2563eb;">sync_alt</mat-icon>
      Transfer Stock Between Warehouses
    </h2>
    <mat-dialog-content>
      <div class="ts-row">
        <mat-form-field appearance="outline">
          <mat-label>From warehouse</mat-label>
          <mat-select [(ngModel)]="fromId" (ngModelChange)="selected = null; search = ''">
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
        <mat-label>Search item at source warehouse</mat-label>
        <input matInput [(ngModel)]="search" placeholder="Code or description" (ngModelChange)="selected = null">
        <mat-icon matPrefix>search</mat-icon>
      </mat-form-field>
      @if (!selected) {
        <div class="mm-list">
          @for (r of matches(); track r.id) {
            <button class="mm-item" (click)="selected = r">
              <span class="mm-code">{{ r.commodityCode }}</span>
              <span class="mm-name">{{ r.commodityName }}</span>
              <span class="mm-qty">{{ r.quantityOnHand | number }} on hand</span>
            </button>
          } @empty { <div class="mm-empty">Type to search items at the source warehouse</div> }
        </div>
      } @else {
        <div class="mm-selected">
          <div><b>{{ selected.commodityCode }}</b> â€” {{ selected.commodityName }}</div>
          <div class="mm-onhand">On hand at source: <b>{{ selected.quantityOnHand | number }}</b></div>
          <button mat-button (click)="selected = null"><mat-icon>swap_horiz</mat-icon> Change item</button>
        </div>
        <div class="ts-grid">
          <mat-form-field appearance="outline">
            <mat-label>Quantity to transfer</mat-label>
            <input matInput type="number" min="1" [(ngModel)]="quantity">
            @if (quantity && selected && quantity > selected.quantityOnHand) {
              <mat-hint style="color:#dc2626;">Exceeds on hand â€” a reason will be required</mat-hint>
            }
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Reference (optional)</mat-label>
            <input matInput [(ngModel)]="reference" placeholder="e.g. IBT number">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" style="width:100%;">
          <mat-label>Reason / notes {{ needsReason() ? '(required â€” stock goes negative)' : '(optional)' }}</mat-label>
          <input matInput [(ngModel)]="reason">
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!valid() || saving" (click)="save()">
        <mat-icon>sync_alt</mat-icon> Transfer {{ quantity || '' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .ts-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center; }
    .ts-arrow { color: #2563eb; margin-top: -18px; }
    .ts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .mm-list { max-height: 220px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .mm-item { display: flex; gap: 10px; align-items: center; width: 100%; text-align: left; padding: 9px 12px; border: 0; border-bottom: 1px solid #f1f5f9; background: #fff; cursor: pointer; }
    .mm-item:hover { background: #eff6ff; }
    .mm-code { font-family: monospace; font-weight: 700; min-width: 110px; }
    .mm-name { flex: 1; font-size: 13px; color: #334155; }
    .mm-qty { font-size: 12px; color: #64748b; white-space: nowrap; }
    .mm-empty { padding: 20px; text-align: center; color: #94a3b8; }
    .mm-selected { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 12px; margin-bottom: 12px; }
    .mm-onhand { font-size: 13px; color: #475569; margin: 4px 0; }
    mat-form-field { width: 100%; }
  `]
})
export class TransferStockDialog {
  fromId: number | null = null;
  toId: number | null = null;
  search = '';
  selected: any = null;
  quantity: number | null = null;
  reference = '';
  reason = '';
  saving = false;

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    public dialogRef: MatDialogRef<TransferStockDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.fromId = data.fromWarehouseId ?? data.warehouses?.[0]?.id ?? null;
  }

  matches(): any[] {
    const t = this.search.trim().toLowerCase();
    if (!t || !this.fromId) return [];
    return (this.data.inventory || []).filter((r: any) =>
      r.warehouseId === this.fromId &&
      ((r.commodityCode || '').toLowerCase().includes(t) ||
       (r.commodityName || '').toLowerCase().includes(t))).slice(0, 50);
  }

  needsReason(): boolean {
    return !!(this.selected && this.quantity && this.quantity > this.selected.quantityOnHand);
  }

  valid(): boolean {
    if (!this.fromId || !this.toId || this.fromId === this.toId) return false;
    if (!this.selected || !this.quantity || this.quantity <= 0) return false;
    if (this.needsReason() && !this.reason.trim()) return false;
    return true;
  }

  save(): void {
    this.saving = true;
    this.http.post(`${environment.apiUrl}/logistics/stock-movements/transfer`, {
      fromWarehouseId: this.fromId,
      toWarehouseId: this.toId,
      commodityId: this.selected.commodityId,
      quantity: this.quantity,
      reference: this.reference || null,
      reason: this.reason || null
    }).subscribe({
      next: () => {
        this.snackBar.open('Transfer recorded â€” two ledger entries written', 'Close', { duration: 3500 });
        this.dialogRef.close(true);
      },
      error: (e) => { this.saving = false; this.snackBar.open(e?.error?.message || 'Failed to transfer stock', 'Close', { duration: 4000 }); }
    });
  }
}

// â•â•â• Approve Dispatch Dialog (picking slip review â†’ stock deduction) â•â•â•
@Component({
  selector: 'app-approve-dispatch-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
            MatFormFieldModule, MatInputModule, MatTooltipModule],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="vertical-align:middle;margin-right:8px;color:#d97706;">fact_check</mat-icon>
      Approve Dispatch â€” {{ data.load.loadNumber }}
    </h2>
    <mat-dialog-content>
      <div class="ad-meta">
        <span><b>Warehouse:</b> {{ data.load.warehouseName }}</span>
        <span><b>Customer:</b> {{ data.load.customerName || 'â€”' }}</span>
        <span><b>Status:</b> {{ data.load.status }}</span>
      </div>
      @if (unmapped.length) {
        <div class="ad-empty" style="color:#b45309;">
          <b>{{ unmapped.length }} line(s) cannot be matched to a stock item and will NOT deduct stock:</b>
          <ul style="margin:6px 0 0 18px;">
            @for (u of unmapped; track $index) {
              <li>{{ u.name }} @if (u.code) { ({{ u.code }}) } â€” qty {{ u.planned | number }} @if (u.invoice) { Â· inv {{ u.invoice }} }</li>
            }
          </ul>
        </div>
      }
      @if (!lines.length) {
        <div class="ad-empty">No mappable commodity lines on this tripsheet.</div>
      } @else {
        <table class="ad-table">
          <thead><tr><th>Code</th><th>Description</th><th class="num">Planned</th><th class="num">On Hand</th><th class="num" style="width:130px;">Dispatch Qty</th><th></th></tr></thead>
          <tbody>
            @for (l of lines; track l.commodityId) {
              <tr>
                <td class="mono">{{ l.code }}</td>
                <td>{{ l.name }}</td>
                <td class="num">{{ l.planned | number }}</td>
                <td class="num" [style.color]="l.onHand < l.qty ? '#dc2626' : ''">{{ l.onHand | number }}</td>
                <td class="num"><input class="ad-qty" type="number" min="0" [(ngModel)]="l.qty"></td>
                <td>
                  @if (l.qty > l.onHand) { <mat-icon class="ad-warn" matTooltip="Will take stock negative â€” reason required">warning</mat-icon> }
                  @if (l.qty < l.planned) { <span class="ad-short" matTooltip="Short-pick: {{ l.planned - l.qty }} short">-{{ l.planned - l.qty }}</span> }
                </td>
              </tr>
            }
          </tbody>
        </table>
        @if (needsReason()) {
          <mat-form-field appearance="outline" style="width:100%;margin-top:10px;">
            <mat-label>Reason for dispatching more than on hand (required)</mat-label>
            <input matInput [(ngModel)]="negativeReason" placeholder="e.g. stock received but GRV not yet captured">
          </mat-form-field>
        }
        <p class="ad-note"><mat-icon>info</mat-icon> Approving deducts these quantities from stock on hand and writes ledger entries. Short-picks record the dispatched quantity only.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!canSave() || saving" (click)="save()">
        <mat-icon>inventory</mat-icon> Approve & Deduct Stock
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .ad-meta { display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px; color: #475569; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; }
    .ad-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .ad-table th { text-align: left; padding: 8px 10px; background: #f1f5f9; font-size: 11.5px; text-transform: uppercase; color: #475569; }
    .ad-table th.num, .ad-table td.num { text-align: right; }
    .ad-table td { padding: 7px 10px; border-top: 1px solid #f1f5f9; }
    .ad-table td.mono { font-family: monospace; font-weight: 600; }
    .ad-qty { width: 100px; padding: 6px 8px; border: 1px solid #cbd5e1; border-radius: 8px; text-align: right; font-weight: 700; }
    .ad-warn { color: #d97706; font-size: 20px; width: 20px; height: 20px; }
    .ad-short { color: #dc2626; font-weight: 700; font-size: 12px; }
    .ad-empty { padding: 24px; text-align: center; color: #94a3b8; }
    .ad-note { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #64748b; margin-top: 12px; }
    .ad-note mat-icon { font-size: 17px; width: 17px; height: 17px; color: #2563eb; }
  `]
})
export class ApproveDispatchDialog {
  lines: { commodityId: number; code: string; name: string; planned: number; qty: number; onHand: number }[] = [];
  /** Stop lines that have no commodity mapping and therefore cannot deduct stock */
  unmapped: { code: string; name: string; planned: number; invoice: string }[] = [];
  negativeReason = '';
  saving = false;

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

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
            code: c.commodityCode || '',
            name: c.commodityName || c.comment || 'Unnamed line',
            planned: c.quantity || 0,
            invoice: c.invoiceNumber || s.invoiceNumber || ''
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
    }));
  }

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
    this.http.post(`${environment.apiUrl}/logistics/stock-movements/approve-dispatch`, payload).subscribe({
      next: () => { this.snackBar.open(`Dispatch approved â€” stock deducted for ${this.data.load.loadNumber}`, 'Close', { duration: 4000 }); this.dialogRef.close(true); },
      error: (e) => { this.saving = false; this.snackBar.open(e?.error?.message || 'Failed to approve dispatch', 'Close', { duration: 5000 }); }
    });
  }
}



