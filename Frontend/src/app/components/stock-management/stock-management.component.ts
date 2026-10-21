import { Component, OnInit, OnDestroy, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { MatTabsModule } from '@angular/material/tabs';
import { SelectionModel } from '@angular/cdk/collections';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { AuthService } from '../../services/auth.service';
import { WellyActivityService } from '../../services/welly-activity.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { EmptyStateComponent } from '../shared/ui/empty-state.component';
import { LoadingComponent } from '../shared/ui/loading.component';
import { environment } from '../../../environments/environment';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
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
    RouterLink,
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
    LoadingComponent,
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
            <p class="subtitle">{{ selectedWarehouse ? selectedWarehouse.name : 'Select a warehouse to begin' }}</p>
          </div>
        </div>
        <div class="header-actions">
          @if (selectedWarehouse) {
            <button mat-raised-button class="welly-stock-btn" (click)="wellyAnalyzeStock()" matTooltip="Ask Welly to analyze stock levels">
              <mat-icon class="welly-sparkle">auto_awesome</mat-icon>
              Ask Welly to Analyze
            </button>
            <button mat-raised-button (click)="clearSelection()">
              <mat-icon>arrow_back</mat-icon>
              Back to Warehouses
            </button>
          } @else if (showFulfillment) {
            <button mat-raised-button (click)="closeFulfillment()">
              <mat-icon>arrow_back</mat-icon>
              Back to Warehouses
            </button>
          } @else {
            <button mat-raised-button class="fulfillment-btn" (click)="openFulfillment()" matTooltip="Match invoices to current stock">
              <mat-icon>fact_check</mat-icon>
              Invoice Fulfillment
            </button>
          }
        </div>
      </div>

      @if (selectedWarehouse && !showInventorySubmenu) {
        <div class="operations-grid">
          <div class="operation-block depot-block" (click)="selectOperation('inventory')"
               role="button" tabindex="0" (keydown.enter)="selectOperation('inventory')" aria-label="Inventory Management">
            <div class="block-icon">
              <mat-icon>inventory_2</mat-icon>
            </div>
            <h3>Inventory Management</h3>
            <p>View & manage stock levels</p>
            <div class="operation-stats">
              <div class="stat-row">
                <span class="stat-label">Items Tracked</span>
                <span class="stat-value">{{ selectedWarehouse.totalItems | number }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Stock Value</span>
                <span class="stat-value">{{ formatValue(selectedWarehouse.totalStockValue) }}</span>
              </div>
              <mat-progress-bar mode="determinate" [value]="75" color="primary" class="operation-progress"></mat-progress-bar>
              <button mat-raised-button class="operation-btn">
                <mat-icon>arrow_forward</mat-icon>
                View Operations
              </button>
            </div>
          </div>

          <div class="operation-block dispatch-block" (click)="selectOperation('dispatch')"
               role="button" tabindex="0" (keydown.enter)="selectOperation('dispatch')" aria-label="Order Accept and Dispatch">
            <div class="block-icon">
              <mat-icon>local_shipping</mat-icon>
            </div>
            <h3>Order Accept & Dispatch</h3>
            <p>Process orders & dispatch</p>
            <div class="operation-stats">
              <div class="stat-row">
                <span class="stat-label">Pending Orders</span>
                <span class="stat-value">12</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Ready to Ship</span>
                <span class="stat-value">8</span>
              </div>
              <mat-progress-bar mode="determinate" [value]="67" color="primary" class="operation-progress"></mat-progress-bar>
              <button mat-raised-button class="operation-btn">
                <mat-icon>arrow_forward</mat-icon>
                View Operations
              </button>
            </div>
          </div>

          <div class="operation-block transfer-block" (click)="selectOperation('transfer')">
            <div class="block-icon">
              <mat-icon>swap_horiz</mat-icon>
            </div>
            <h3>Transfer & Returns</h3>
            <p>Inter-warehouse transfers</p>
            <div class="operation-stats">
              <div class="stat-row">
                <span class="stat-label">Active Transfers</span>
                <span class="stat-value">5</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Pending Returns</span>
                <span class="stat-value">3</span>
              </div>
              <mat-progress-bar mode="determinate" [value]="40" color="primary" class="operation-progress"></mat-progress-bar>
              <button mat-raised-button class="operation-btn">
                <mat-icon>arrow_forward</mat-icon>
                View Operations
              </button>
            </div>
          </div>

          <div class="operation-block grv-block" (click)="selectOperation('grv')">
            <div class="block-icon">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <h3>Goods Received</h3>
            <p>Record incoming deliveries</p>
            <div class="operation-stats">
              <div class="stat-row">
                <span class="stat-label">Expected Deliveries</span>
                <span class="stat-value">7</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Received Today</span>
                <span class="stat-value">4</span>
              </div>
              <mat-progress-bar mode="determinate" [value]="57" color="primary" class="operation-progress"></mat-progress-bar>
              <button mat-raised-button class="operation-btn">
                <mat-icon>arrow_forward</mat-icon>
                View Operations
              </button>
            </div>
          </div>
        </div>
      }

      @if (showInventorySubmenu) {
        <div class="submenu-header">
          <button mat-icon-button (click)="backToOperations()">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h2>Inventory Management</h2>
        </div>

        <div class="operations-grid">
          <div class="operation-block inventory-block" (click)="openInventoryView()">
            <div class="block-icon">
              <mat-icon>view_list</mat-icon>
            </div>
            <h3>Inventory Management</h3>
            <p>View all stock items</p>
          </div>

          <div class="operation-block scrap-block" (click)="openScrap()">
            <div class="block-icon">
              <mat-icon>delete_sweep</mat-icon>
            </div>
            <h3>Scrap</h3>
            <p>Record damaged items</p>
          </div>

          <div class="operation-block stocktake-block" (click)="openStockTake()">
            <div class="block-icon">
              <mat-icon>fact_check</mat-icon>
            </div>
            <h3>Stock Take</h3>
            <p>Physical count verification</p>
          </div>

          <div class="operation-block repack-block" (click)="openRepackaging()">
            <div class="block-icon">
              <mat-icon>inventory</mat-icon>
            </div>
            <h3>Repackaging</h3>
            <p>Change item packaging</p>
          </div>
        </div>
      }

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
      } @else if (showFulfillment) {
        <div class="fulfillment-view">
          <div class="ff-header">
            <div>
              <h2>Invoice Fulfillment</h2>
              <p class="ff-sub">Outstanding invoice demand matched against current stock (by product code)</p>
            </div>
            <mat-form-field appearance="outline" class="ff-search">
              <mat-label>Search product code / description</mat-label>
              <input matInput [(ngModel)]="ffSearch" (ngModelChange)="applyFfSearch()" placeholder="e.g. 4010239">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>

          @if (ffLoading) {
            <div class="ff-loading">
              <mat-spinner diameter="40"></mat-spinner>
              <p>Matching invoices to stock...</p>
            </div>
          } @else if (ffAnalysis) {
            <div class="ff-summary-grid">
              <div class="ff-card ff-can">
                <mat-icon>check_circle</mat-icon>
                <div><span class="ff-val">{{ ffAnalysis.summary.fullyFulfillable | number }}</span><span class="ff-lbl">Fully Fulfillable</span></div>
              </div>
              <div class="ff-card ff-partial">
                <mat-icon>hourglass_bottom</mat-icon>
                <div><span class="ff-val">{{ ffAnalysis.summary.partiallyFulfillable | number }}</span><span class="ff-lbl">Partial</span></div>
              </div>
              <div class="ff-card ff-out">
                <mat-icon>cancel</mat-icon>
                <div><span class="ff-val">{{ ffAnalysis.summary.outOfStock | number }}</span><span class="ff-lbl">Out of Stock</span></div>
              </div>
              <div class="ff-card ff-total">
                <mat-icon>inventory_2</mat-icon>
                <div><span class="ff-val">{{ ffAnalysis.summary.totalProductCodes | number }}</span><span class="ff-lbl">Matched Codes</span></div>
              </div>
            </div>

            <div class="ff-table-wrap">
              <table class="ff-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Product Code</th>
                    <th>Description</th>
                    <th class="num">Demand</th>
                    <th class="num">Available</th>
                    <th class="num">Can Fulfill</th>
                    <th class="num">Shortfall</th>
                    <th class="num">Orders</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of ffFiltered; track line.productCode) {
                    <tr class="ff-row" (click)="toggleInvoices(line)">
                      <td class="expand-cell">
                        <mat-icon>{{ ffExpanded === line.productCode ? 'expand_more' : 'chevron_right' }}</mat-icon>
                      </td>
                      <td class="mono">{{ line.productCode }}</td>
                      <td class="desc">{{ line.productDescription }}</td>
                      <td class="num">{{ line.demandQty | number }}</td>
                      <td class="num">{{ line.availableQty | number }}</td>
                      <td class="num">{{ line.canFulfillQty | number }}</td>
                      <td class="num" [class.short]="line.shortfallQty > 0">{{ line.shortfallQty | number }}</td>
                      <td class="num">{{ line.orderLines | number }}</td>
                      <td>
                        <span class="ff-badge"
                          [class.b-can]="line.status === 'CanFulfill'"
                          [class.b-partial]="line.status === 'Partial'"
                          [class.b-out]="line.status === 'OutOfStock'">
                          {{ ffStatusLabel(line.status) }}
                        </span>
                      </td>
                    </tr>
                    @if (ffExpanded === line.productCode) {
                      <tr class="ff-detail-row">
                        <td colspan="9">
                          @if (ffInvLoading) {
                            <div class="ff-inv-loading"><mat-spinner diameter="24"></mat-spinner> Loading invoices...</div>
                          } @else {
                            <table class="ff-inv-table">
                              <thead>
                                <tr>
                                  <th>Invoice #</th>
                                  <th>Date</th>
                                  <th>Customer</th>
                                  <th class="num">Order Qty</th>
                                  <th class="num">Can Fulfill</th>
                                  <th class="num">Shortfall</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (inv of ffInvoices; track inv.id) {
                                  <tr>
                                    <td class="mono">{{ inv.invoiceNumber }}</td>
                                    <td>{{ inv.invoiceDate | date:'yyyy-MM-dd' }}</td>
                                    <td class="desc">{{ inv.customerName }}</td>
                                    <td class="num">{{ inv.demandQty | number }}</td>
                                    <td class="num">{{ inv.canFulfillQty | number }}</td>
                                    <td class="num" [class.short]="inv.shortfallQty > 0">{{ inv.shortfallQty | number }}</td>
                                    <td>
                                      <span class="ff-badge"
                                        [class.b-can]="inv.status === 'CanFulfill'"
                                        [class.b-partial]="inv.status === 'Partial'"
                                        [class.b-out]="inv.status === 'None'">
                                        {{ inv.status === 'CanFulfill' ? 'Fulfillable' : (inv.status === 'Partial' ? 'Partial' : 'No Stock') }}
                                      </span>
                                    </td>
                                  </tr>
                                } @empty {
                                  <tr><td colspan="7" class="ff-empty">No invoices found for this product.</td></tr>
                                }
                              </tbody>
                            </table>
                          }
                        </td>
                      </tr>
                    }
                  } @empty {
                    <tr><td colspan="9" class="ff-empty">No matching invoice/stock lines found.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      } @else if (warehouses.length === 0) {
        <app-empty-state icon="warehouse" title="No Warehouses Found"
          message="No warehouses have been configured yet."></app-empty-state>
      } @else if (!selectedWarehouse) {

        <!-- ═══ KPI CARDS ═══ -->
        <div class="stk-kpi-grid">
          <div class="stk-kpi k-blue">
            <mat-icon>inventory_2</mat-icon>
            <div class="stk-kpi-val">{{ kpiSkus | number }}</div>
            <div class="stk-kpi-lbl">Total SKUs</div>
          </div>
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
          <div class="stk-kpi k-amber">
            <mat-icon>swap_horiz</mat-icon>
            <div class="stk-kpi-val">{{ movements.length | number }}</div>
            <div class="stk-kpi-lbl">Recent Movements</div>
          </div>
          <div class="stk-kpi k-slate">
            <mat-icon>delete_sweep</mat-icon>
            <div class="stk-kpi-val">{{ scrapRecords.length | number }}</div>
            <div class="stk-kpi-lbl">Scrap Records</div>
          </div>
        </div>

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
                <button mat-icon-button class="stk-wh-ops" matTooltip="Open operations (dispatch, GRV, transfers, stock take)"
                        (click)="selectWarehouse(warehouse); $event.stopPropagation()">
                  <mat-icon>open_in_new</mat-icon>
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

        <!-- ═══ TABS ═══ -->
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
                <button mat-stroked-button (click)="exportSoh()"><mat-icon>file_download</mat-icon> Export</button>
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
                          <td><span class="stk-chip">{{ r.category || '—' }}</span></td>
                          <td>{{ r.warehouseName }}</td>
                          <td>{{ r.unitOfMeasure || 'Each' }}</td>
                          <td class="num"><b>{{ r.quantityOnHand | number }}</b></td>
                          <td class="num">{{ r.unitPrice ? ('R' + (r.unitPrice | number:'1.2-2')) : '—' }}</td>
                          <td class="num">{{ r.lineValue ? ('R' + (r.lineValue | number:'1.0-0')) : '—' }}</td>
                          <td><span class="stk-badge" [class.b-in]="r.quantityOnHand > 0" [class.b-out]="r.quantityOnHand === 0" [class.b-neg]="r.quantityOnHand < 0">
                            {{ r.quantityOnHand > 0 ? 'In stock' : (r.quantityOnHand < 0 ? 'Negative' : 'Out of stock') }}</span></td>
                        </tr>
                      } @empty { <tr><td colspan="9" class="stk-empty">No stock items found</td></tr> }
                    </tbody>
                  </table>
                  @if (sohRows.length > 400) { <div class="stk-more">Showing first 400 — refine your search to narrow down ({{ sohRows.length | number }} matches)</div> }
                </div>
              }
            </div>
          </mat-tab>

          <!-- STOCK COUNTS -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">fact_check</mat-icon> Stock Counts</ng-template>
            <div class="stk-tab-body">
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
                        <td>{{ w.lastCountDate ? (w.lastCountDate | date:'dd MMM yyyy') : '—' }}</td>
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
              <p class="stk-note"><mat-icon>info</mat-icon> Counts come from the consolidated stock imports. Use a warehouse card's <b>Operations</b> button to run a new stock take.</p>
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
                        <td><span class="stk-chip">{{ r.category || '—' }}</span></td>
                        <td>{{ r.warehouseName }}</td>
                        <td class="num"><b>{{ r.quantityOnHand | number }}</b></td>
                        <td><span class="stk-badge" [class.b-out]="excMode === 'out'" [class.b-neg]="excMode === 'neg'" [class.b-warn]="excMode === 'unpriced'">
                          {{ excMode === 'out' ? 'Out of stock' : (excMode === 'neg' ? 'Negative stock' : 'No sales price') }}</span></td>
                      </tr>
                    } @empty { <tr><td colspan="6" class="stk-empty">No exceptions — all good 🎉</td></tr> }
                  </tbody>
                </table>
              </div>
            </div>
          </mat-tab>

          <!-- MOVEMENTS -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">swap_horiz</mat-icon> Movements</ng-template>
            <div class="stk-tab-body">
              @if (movLoading) { <div class="stk-loading"><mat-spinner diameter="32"></mat-spinner> Loading movements...</div> }
              @else {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr><th>Date</th><th>Type</th><th>Item</th><th>Description</th><th class="num">Qty</th><th>From → To</th><th>Reference</th><th>By</th></tr></thead>
                    <tbody>
                      @for (m of movements; track m.id) {
                        <tr>
                          <td>{{ m.createdAt | date:'dd MMM yyyy HH:mm' }}</td>
                          <td><span class="stk-chip">{{ m.movementType }}</span></td>
                          <td class="mono">{{ m.itemCode }}</td>
                          <td class="desc">{{ m.itemDescription }}</td>
                          <td class="num"><b>{{ m.quantity | number }}</b></td>
                          <td>{{ m.fromBuildingCode || '—' }} → {{ m.toBuildingCode || '—' }}</td>
                          <td class="mono">{{ m.reference }}</td>
                          <td>{{ m.createdByName }}</td>
                        </tr>
                      } @empty { <tr><td colspan="8" class="stk-empty">No stock movements recorded yet</td></tr> }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </mat-tab>

          <!-- DISPATCH -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">local_shipping</mat-icon> Dispatch</ng-template>
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <span class="stk-count">Inter-warehouse transfers & dispatches</span>
                <span class="stk-spacer"></span>
                <button mat-raised-button color="primary" [disabled]="!whFilterId" (click)="openDispatchForFilter()"
                        [matTooltip]="whFilterId ? 'New dispatch from ' + whFilterName : 'Select a warehouse card above first'">
                  <mat-icon>local_shipping</mat-icon> New Dispatch</button>
              </div>
              @if (trLoading) { <div class="stk-loading"><mat-spinner diameter="32"></mat-spinner> Loading transfers...</div> }
              @else {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr><th>Transfer #</th><th>From</th><th>To</th><th>Commodity</th><th class="num">Qty</th><th>Status</th><th>Requested</th></tr></thead>
                    <tbody>
                      @for (t of transfers; track t.id) {
                        <tr>
                          <td class="mono">{{ t.transferNumber }}</td>
                          <td>{{ t.fromWarehouseName }}</td>
                          <td>{{ t.toWarehouseName }}</td>
                          <td class="desc">{{ t.commodityName }}</td>
                          <td class="num"><b>{{ t.quantity | number }}</b></td>
                          <td><span class="stk-badge" [class.b-in]="t.status === 'Completed'" [class.b-warn]="t.status === 'Pending' || t.status === 'InTransit'">{{ t.status }}</span></td>
                          <td>{{ t.requestedDate | date:'dd MMM yyyy' }}</td>
                        </tr>
                      } @empty { <tr><td colspan="7" class="stk-empty">No transfers recorded yet</td></tr> }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </mat-tab>

          <!-- SCRAP -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">delete_sweep</mat-icon> Scrap</ng-template>
            <div class="stk-tab-body">
              <div class="stk-toolbar">
                <span class="stk-count">Damaged / written-off stock</span>
                <span class="stk-spacer"></span>
                <button mat-raised-button color="warn" [disabled]="!whFilterId" (click)="openScrapForFilter()"
                        [matTooltip]="whFilterId ? 'Record scrap at ' + whFilterName : 'Select a warehouse card above first'">
                  <mat-icon>delete_sweep</mat-icon> Record Scrap</button>
              </div>
              @if (scrapLoading) { <div class="stk-loading"><mat-spinner diameter="32"></mat-spinner> Loading scrap records...</div> }
              @else {
                <div class="stk-table-wrap">
                  <table class="stk-table">
                    <thead><tr><th>Date</th><th>Warehouse</th><th>Commodity</th><th class="num">Qty</th><th>Reason</th><th>Notes</th><th>By</th></tr></thead>
                    <tbody>
                      @for (s of scrapScoped; track s.id) {
                        <tr>
                          <td>{{ s.scrapDate | date:'dd MMM yyyy' }}</td>
                          <td>{{ s.warehouseName }}</td>
                          <td class="desc">{{ s.commodityName }}</td>
                          <td class="num"><b>{{ s.quantity | number }}</b></td>
                          <td>{{ s.reason }}</td>
                          <td class="desc">{{ s.notes }}</td>
                          <td>{{ s.recordedBy }}</td>
                        </tr>
                      } @empty { <tr><td colspan="7" class="stk-empty">No scrap recorded{{ whFilterName }}</td></tr> }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </mat-tab>

          <!-- REPORTS -->
          <mat-tab>
            <ng-template mat-tab-label><mat-icon class="tab-ico">summarize</mat-icon> Reports</ng-template>
            <div class="stk-tab-body">
              <div class="stk-reports-grid">
                <div class="stk-report-card" (click)="exportSoh()">
                  <mat-icon>inventory_2</mat-icon>
                  <h4>Stock on Hand</h4>
                  <p>Full SOH listing with quantities, sales-derived unit prices and values{{ whFilterName }}</p>
                  <button mat-stroked-button><mat-icon>file_download</mat-icon> Excel</button>
                </div>
                <div class="stk-report-card" (click)="exportValuation()">
                  <mat-icon>payments</mat-icon>
                  <h4>Valuation Summary</h4>
                  <p>Per-warehouse and per-company stock valuation at sales price and cost</p>
                  <button mat-stroked-button><mat-icon>file_download</mat-icon> Excel</button>
                </div>
                <div class="stk-report-card" (click)="exportExceptions()">
                  <mat-icon>report_problem</mat-icon>
                  <h4>Exceptions</h4>
                  <p>Out-of-stock, negative and unpriced items needing attention</p>
                  <button mat-stroked-button><mat-icon>file_download</mat-icon> Excel</button>
                </div>
                <div class="stk-report-card" (click)="exportMovements()">
                  <mat-icon>swap_horiz</mat-icon>
                  <h4>Movements</h4>
                  <p>Recent stock movements, transfers and adjustments audit trail</p>
                  <button mat-stroked-button><mat-icon>file_download</mat-icon> Excel</button>
                </div>
              </div>
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

    .warehouses-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 32px;
    }

    @media (max-width: 820px) {
      .warehouses-grid { grid-template-columns: 1fr; }
    }

    .warehouse-card-modern {
      position: relative;
      border-radius: 16px;
      padding: 24px;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      background: #ffffff;
      border: 1px solid var(--line);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.05);
    }

    .warehouse-gradient-bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      z-index: 0;
      background: var(--accent);
    }

    .warehouse-card-modern.warehouse-1 .warehouse-gradient-bg { background: #4f46e5; }
    .warehouse-card-modern.warehouse-2 .warehouse-gradient-bg { background: #0ea5e9; }
    .warehouse-card-modern.warehouse-3 .warehouse-gradient-bg { background: #10b981; }
    .warehouse-card-modern.warehouse-4 .warehouse-gradient-bg { background: #f59e0b; }
    .warehouse-card-modern.warehouse-5 .warehouse-gradient-bg { background: #ec4899; }
    .warehouse-card-modern.warehouse-6 .warehouse-gradient-bg { background: #8b5cf6; }

    .warehouse-card-modern:hover {
      transform: translateY(-3px);
      border-color: #cbd5e1;
      box-shadow: 0 12px 28px rgba(16, 24, 40, 0.10);
    }

    .warehouse-content {
      position: relative;
      z-index: 2;
      display: flex;
      flex-direction: column;
      height: 100%;
      color: var(--ink);
    }

    .warehouse-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 20px;
    }

    .warehouse-icon-modern {
      background: var(--accent-soft);
      border-radius: 12px;
      width: 52px;
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .warehouse-icon-modern mat-icon {
      color: var(--accent);
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .warehouse-title-section {
      flex: 1;
    }

    .warehouse-title-section h2 {
      font-size: 1.2rem;
      font-weight: 700;
      margin: 0 0 4px 0;
      color: var(--ink);
      letter-spacing: -0.01em;
    }

    .warehouse-location {
      display: flex;
      align-items: center;
      gap: 5px;
      margin: 0;
      color: var(--muted);
      font-size: 0.86rem;
      font-weight: 500;
    }

    .warehouse-location mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .warehouse-stats-modern {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 18px;
    }

    .stat-modern {
      background: #f8fafc;
      border-radius: 12px;
      padding: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid var(--line);
    }

    .stat-icon-wrapper {
      background: var(--accent-soft);
      border-radius: 9px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .stat-icon-wrapper mat-icon {
      color: var(--accent);
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .stat-details {
      flex: 1;
    }

    .stat-modern .stat-value {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--ink);
      line-height: 1.2;
    }

    .stat-modern .stat-label {
      font-size: 0.75rem;
      color: var(--muted);
      margin-top: 2px;
      font-weight: 500;
    }

    .warehouse-capacity-modern {
      background: #f8fafc;
      border-radius: 12px;
      padding: 14px;
      border: 1px solid var(--line);
      margin-bottom: auto;
    }

    .capacity-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .capacity-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--muted);
    }

    .capacity-percentage {
      font-size: 1rem;
      font-weight: 700;
      color: var(--ink);
    }

    .warehouse-progress-bar {
      height: 8px;
      border-radius: 4px;
      margin-bottom: 8px;
      overflow: hidden;
      background: #e5e7eb !important;
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

    .capacity-info {
      font-size: 0.78rem;
      color: var(--muted);
      text-align: right;
      font-weight: 500;
    }

    .warehouse-footer {
      margin-top: 18px;
      padding-top: 16px;
      border-top: 1px solid var(--line);
    }

    .view-operations-btn {
      width: 100%;
      background: var(--accent) !important;
      color: white !important;
      font-weight: 600 !important;
      font-size: 0.9rem !important;
      padding: 11px 20px !important;
      border-radius: 10px !important;
      border: none !important;
      transition: background 0.2s ease, box-shadow 0.2s ease !important;
      letter-spacing: 0;
    }

    .view-operations-btn:hover {
      background: #4338ca !important;
      box-shadow: 0 6px 16px rgba(79, 70, 229, 0.28) !important;
    }

    .view-operations-btn mat-icon {
      margin-left: 6px;
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

    .operations-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 32px;
      animation: slideUp 0.35s ease-out;
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

    .operation-block {
      position: relative;
      cursor: pointer;
      padding: 24px 22px;
      border-radius: 16px;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      text-align: left;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
      border: 1px solid var(--line);
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.05);
      background: #ffffff;
    }

    .operation-block:hover {
      transform: translateY(-3px);
      border-color: #cbd5e1;
      box-shadow: 0 12px 28px rgba(16, 24, 40, 0.10);
    }

    .operation-block:active {
      transform: translateY(-1px);
    }

    .block-icon {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--accent-soft);
      margin-bottom: 6px;
      transition: transform 0.2s ease;
    }

    .operation-block:hover .block-icon {
      transform: translateY(-1px);
    }

    .block-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: var(--accent);
    }

    .operation-block h3 {
      margin: 0;
      font-size: 1.02rem;
      font-weight: 700;
      color: var(--ink);
      letter-spacing: -0.01em;
      z-index: 1;
    }

    .operation-block p {
      margin: 0;
      font-size: 0.85rem;
      color: var(--muted);
      font-weight: 500;
      z-index: 1;
    }

    .operation-stats {
      width: 100%;
      margin-top: auto;
      padding-top: 16px;
      border-top: 1px solid var(--line);
      z-index: 1;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .stat-label {
      font-size: 0.78rem;
      color: var(--muted);
      font-weight: 500;
    }

    .stat-value {
      font-size: 0.9rem;
      color: var(--ink);
      font-weight: 700;
    }

    .operation-progress {
      height: 6px;
      border-radius: 3px;
      margin-top: 12px;
      background: #e5e7eb !important;
    }

    .operation-progress ::ng-deep .mdc-linear-progress__bar-inner {
      border-top-width: 6px;
    }

    .operation-progress ::ng-deep .mdc-linear-progress__buffer-bar {
      background-color: #e5e7eb !important;
    }

    .operation-btn {
      width: 100%;
      margin-top: 14px;
      background: #f8fafc !important;
      color: var(--accent) !important;
      font-weight: 600 !important;
      border: 1px solid var(--line) !important;
      transition: background 0.2s ease, border-color 0.2s ease;
      padding: 9px 16px !important;
    }

    .operation-btn:hover {
      background: var(--accent-soft) !important;
      border-color: #c7d2fe !important;
    }

    .operation-btn mat-icon {
      margin-right: 6px;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .depot-block .block-icon { background: #eef2ff; }
    .depot-block .block-icon mat-icon { color: #4f46e5; }

    .dispatch-block .block-icon { background: #ecfeff; }
    .dispatch-block .block-icon mat-icon { color: #0891b2; }

    .transfer-block .block-icon { background: #eff6ff; }
    .transfer-block .block-icon mat-icon { color: #2563eb; }

    .grv-block .block-icon { background: #ecfdf5; }
    .grv-block .block-icon mat-icon { color: #059669; }

    .inventory-block .block-icon { background: #eef2ff; }
    .inventory-block .block-icon mat-icon { color: #4f46e5; }

    .scrap-block .block-icon { background: #fef2f2; }
    .scrap-block .block-icon mat-icon { color: #dc2626; }

    .stocktake-block .block-icon { background: #fdf2f8; }
    .stocktake-block .block-icon mat-icon { color: #db2777; }

    .repack-block .block-icon { background: #f5f3ff; }
    .repack-block .block-icon mat-icon { color: #7c3aed; }

    .submenu-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: #ffffff;
      border: 1px solid var(--line);
      border-radius: 12px;
      animation: slideUp 0.3s ease-out;
    }

    .submenu-header button {
      color: var(--ink);
    }

    .submenu-header h2 {
      margin: 0;
      color: var(--ink);
      font-size: 1.2rem;
      font-weight: 700;
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

    /* ===== Invoice Fulfillment ===== */
    .fulfillment-btn {
      background: #0d9488;
      color: #fff;
    }
    .fulfillment-view { padding: 24px; background: #fff; border: 1px solid var(--line); border-radius: 16px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06), 0 4px 12px rgba(15, 23, 42, 0.05); }
    .ff-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .ff-header h2 { margin: 0; font-size: 22px; color: #1e293b; }
    .ff-sub { margin: 4px 0 0; color: #64748b; font-size: 13px; }
    .ff-search { min-width: 320px; }
    .ff-loading {
      display: flex; flex-direction: column; align-items: center;
      gap: 16px; padding: 60px 0; color: #64748b;
    }
    .ff-summary-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px; margin-bottom: 24px;
    }
    .ff-card {
      display: flex; align-items: center; gap: 14px;
      padding: 18px; border-radius: 14px; background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-left: 4px solid #cbd5e1;
    }
    .ff-card mat-icon { font-size: 30px; height: 30px; width: 30px; }
    .ff-card .ff-val { display: block; font-size: 24px; font-weight: 700; color: #1e293b; }
    .ff-card .ff-lbl { display: block; font-size: 12px; color: #64748b; }
    .ff-card.ff-can { border-left-color: #16a34a; }
    .ff-card.ff-can mat-icon { color: #16a34a; }
    .ff-card.ff-partial { border-left-color: #f59e0b; }
    .ff-card.ff-partial mat-icon { color: #f59e0b; }
    .ff-card.ff-out { border-left-color: #dc2626; }
    .ff-card.ff-out mat-icon { color: #dc2626; }
    .ff-card.ff-total { border-left-color: #0d9488; }
    .ff-card.ff-total mat-icon { color: #0d9488; }

    .ff-table-wrap {
      background: #fff; border-radius: 14px; overflow: auto;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .ff-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .ff-table thead th {
      text-align: left; padding: 12px 14px; background: #f8fafc;
      color: #475569; font-weight: 600; border-bottom: 2px solid #e2e8f0;
      position: sticky; top: 0; z-index: 1;
    }
    .ff-table th.num, .ff-table td.num { text-align: right; }
    .ff-table tbody td {
      padding: 10px 14px; border-bottom: 1px solid #f1f5f9; color: #334155;
    }
    .ff-table tbody tr:hover { background: #f8fafc; }
    .ff-table td.mono { font-family: monospace; font-weight: 600; color: #0f172a; }
    .ff-table td.desc { max-width: 320px; }
    .ff-table td.num.short { color: #dc2626; font-weight: 600; }
    .ff-empty { text-align: center; padding: 30px; color: #94a3b8; }
    .ff-badge {
      display: inline-block; padding: 3px 10px; border-radius: 999px;
      font-size: 11px; font-weight: 600; background: #e2e8f0; color: #475569;
    }
    .ff-badge.b-can { background: #dcfce7; color: #166534; }
    .ff-badge.b-partial { background: #fef3c7; color: #92400e; }
    .ff-badge.b-out { background: #fee2e2; color: #991b1b; }

    .ff-row { cursor: pointer; }
    .ff-row:hover { background: #f1f5f9; }
    .expand-cell { width: 34px; text-align: center; color: #64748b; }
    .expand-cell mat-icon { font-size: 20px; height: 20px; width: 20px; vertical-align: middle; }
    .ff-detail-row > td { background: #f8fafc; padding: 8px 14px 16px 46px; }
    .ff-inv-loading { display: flex; align-items: center; gap: 10px; padding: 14px; color: #64748b; }
    .ff-inv-table { width: 100%; border-collapse: collapse; font-size: 12.5px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .ff-inv-table thead th { text-align: left; padding: 8px 12px; background: #eef2f7; color: #475569; font-weight: 600; }
    .ff-inv-table th.num, .ff-inv-table td.num { text-align: right; }
    .ff-inv-table tbody td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .ff-inv-table tbody tr:last-child td { border-bottom: none; }

    .stat-sub { font-size: 0.65em; color: #94a3b8; font-weight: 500; }
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

    /* ═══ Dashboard redesign ═══ */
    .stk-kpi-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 12px; margin-bottom: 18px; }
    @media (max-width: 1400px) { .stk-kpi-grid { grid-template-columns: repeat(4, 1fr); } }
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
    .k-blue { border-color: #2563eb; } .k-blue mat-icon { color: #2563eb; }
    .k-indigo { border-color: #6366f1; } .k-indigo mat-icon { color: #6366f1; }
    .k-green { border-color: #16a34a; } .k-green mat-icon { color: #16a34a; }
    .k-teal { border-color: #0d9488; } .k-teal mat-icon { color: #0d9488; }
    .k-emerald { border-color: #10b981; } .k-emerald mat-icon { color: #10b981; }
    .k-red { border-color: #dc2626; } .k-red mat-icon { color: #dc2626; }
    .k-amber { border-color: #d97706; } .k-amber mat-icon { color: #d97706; }
    .k-slate { border-color: #64748b; } .k-slate mat-icon { color: #64748b; }

    .stk-wh-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
    @media (max-width: 1200px) { .stk-wh-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 700px) { .stk-wh-grid { grid-template-columns: 1fr; } }
    .stk-wh-card {
      background: #fff; border-radius: 16px; padding: 18px; cursor: pointer;
      box-shadow: 0 10px 34px rgba(2,6,23,0.28); border: 2px solid transparent; transition: all .25s ease;
    }
    .stk-wh-card:hover { box-shadow: 0 22px 52px rgba(2,6,23,0.38); transform: translateY(-4px); }
    .stk-wh-card.active { border-color: #2563eb; background: #eff6ff; }
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

    /* Company filter chips — same design as Sales History */
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
    .stk-count { font-size: 12.5px; color: #64748b; font-weight: 600; }
    .stk-spacer { flex: 1; }
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
    .stk-more { text-align: center; padding: 10px; font-size: 12px; color: #64748b; background: #f8fafc; }
    .stk-note { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12.5px; color: #64748b; }
    .stk-note mat-icon { font-size: 17px; width: 17px; height: 17px; color: #2563eb; }

    .stk-reports-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    @media (max-width: 1100px) { .stk-reports-grid { grid-template-columns: repeat(2, 1fr); } }
    .stk-report-card {
      border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; text-align: center; cursor: pointer;
      transition: all .15s ease;
    }
    .stk-report-card:hover { box-shadow: 0 6px 16px rgba(15,23,42,0.1); border-color: #93c5fd; }
    .stk-report-card mat-icon { font-size: 34px; width: 34px; height: 34px; color: #2563eb; }
    .stk-report-card h4 { margin: 8px 0 4px; color: #0f172a; }
    .stk-report-card p { font-size: 12px; color: #64748b; min-height: 48px; }
  `]
})
export class StockManagementComponent implements OnInit {
  warehouses: WarehouseSummary[] = [];
  loading = true;
  notificationCount = 3;
  selectedWarehouse: any = null;
  showInventorySubmenu = false;

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
  movements: any[] = [];
  movLoading = true;
  transfers: any[] = [];
  trLoading = true;
  scrapRecords: any[] = [];
  scrapLoading = true;

  get kpiSkus(): number { return this.warehouses.reduce((s, w) => s + (w.totalItems || 0), 0); }
  get kpiUnits(): number { return this.warehouses.reduce((s, w) => s + (w.totalQuantityOnHand || 0), 0); }
  get kpiValue(): number { return this.warehouses.reduce((s, w) => s + (w.totalStockValue || 0), 0); }
  get kpiCost(): number { return this.warehouses.reduce((s, w) => s + (w.totalCostValue || 0), 0); }
  get kpiIn(): number { return this.warehouses.reduce((s, w) => s + (w.itemsInStock || 0), 0); }
  get kpiOut(): number { return this.warehouses.reduce((s, w) => s + (w.itemsOutOfStock || 0), 0); }

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

  get scrapScoped(): any[] {
    return this.whFilterId ? this.scrapRecords.filter(s => s.warehouseId === this.whFilterId) : this.scrapRecords;
  }

  loadDashboardData(): void {
    this.invLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/inventory`).subscribe({
      next: d => { this.allInventory = d || []; this.invLoading = false; },
      error: () => { this.allInventory = []; this.invLoading = false; }
    });
    this.movLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/inventory/movements?limit=200`).subscribe({
      next: d => { this.movements = d || []; this.movLoading = false; },
      error: () => { this.movements = []; this.movLoading = false; }
    });
    this.trLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/stock-transfers`).subscribe({
      next: d => { this.transfers = d || []; this.trLoading = false; },
      error: () => { this.transfers = []; this.trLoading = false; }
    });
    this.scrapLoading = true;
    this.http.get<any[]>(`${environment.apiUrl}/logistics/scrap`).subscribe({
      next: d => { this.scrapRecords = d || []; this.scrapLoading = false; },
      error: () => { this.scrapRecords = []; this.scrapLoading = false; }
    });
  }

  openDispatchForFilter(): void {
    const w = this.warehouses.find(x => x.id === this.whFilterId);
    if (!w) return;
    this.dialog.open(DispatchDialog, { width: '1000px', maxWidth: '90vw', data: w });
  }

  openScrapForFilter(): void {
    const w = this.warehouses.find(x => x.id === this.whFilterId);
    if (!w) return;
    const ref = this.dialog.open(ScrapDialog, { width: '800px', maxWidth: '90vw', data: w });
    ref.afterClosed().subscribe(() => this.loadDashboardData());
  }

  // ═══ Excel exports ═══
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
    const rows = this.movements.map(m => ({
      'Date': m.createdAt ? String(m.createdAt).replace('T', ' ').substring(0, 16) : '',
      'Type': m.movementType, 'Item': m.itemCode, 'Description': m.itemDescription,
      'Qty': m.quantity, 'From': m.fromBuildingCode || '', 'To': m.toBuildingCode || '',
      'Reference': m.reference || '', 'By': m.createdByName || ''
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
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadDashboardData();
  }

  // ===== Invoice Fulfillment =====
  showFulfillment = false;
  ffLoading = false;
  ffAnalysis: any = null;
  ffFiltered: any[] = [];
  ffSearch = '';
  ffExpanded: string | null = null;
  ffInvoices: any[] = [];
  ffInvLoading = false;

  openFulfillment(): void {
    this.ffExpanded = null;
    this.ffInvoices = [];
    this.showFulfillment = true;
    this.ffLoading = true;
    this.ffAnalysis = null;
    this.ffFiltered = [];
    this.http.get<any>(`${environment.apiUrl}/stock-fulfillment/analysis?status=Pending&onlyMatched=true`).subscribe({
      next: (data) => {
        this.ffAnalysis = data;
        this.ffFiltered = data.lines || [];
        this.ffLoading = false;
      },
      error: (err) => {
        console.error('Error loading fulfillment analysis:', err);
        this.ffLoading = false;
        this.snackBar.open('Failed to load fulfillment analysis', 'Close', { duration: 4000 });
      }
    });
  }

  closeFulfillment(): void {
    this.showFulfillment = false;
    this.ffSearch = '';
  }

  applyFfSearch(): void {
    if (!this.ffAnalysis) { this.ffFiltered = []; return; }
    const term = this.ffSearch.trim().toLowerCase();
    if (!term) { this.ffFiltered = this.ffAnalysis.lines; return; }
    this.ffFiltered = this.ffAnalysis.lines.filter((l: any) =>
      (l.productCode || '').toLowerCase().includes(term) ||
      (l.productDescription || '').toLowerCase().includes(term));
  }

  ffStatusLabel(status: string): string {
    switch (status) {
      case 'CanFulfill': return 'Fulfillable';
      case 'Partial': return 'Partial';
      case 'OutOfStock': return 'Out of Stock';
      default: return status;
    }
  }

  toggleInvoices(line: any): void {
    if (this.ffExpanded === line.productCode) {
      this.ffExpanded = null;
      this.ffInvoices = [];
      return;
    }
    this.ffExpanded = line.productCode;
    this.ffInvoices = [];
    this.ffInvLoading = true;
    this.http.get<any>(`${environment.apiUrl}/stock-fulfillment/invoices/${encodeURIComponent(line.productCode)}?status=Pending`).subscribe({
      next: (data) => {
        this.ffInvoices = data.invoices || [];
        this.ffInvLoading = false;
      },
      error: (err) => {
        console.error('Error loading invoices for product:', err);
        this.ffInvLoading = false;
        this.snackBar.open('Failed to load invoices', 'Close', { duration: 4000 });
      }
    });
  }

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

  selectWarehouse(warehouse: any): void {
    this.selectedWarehouse = warehouse;
    this.showInventorySubmenu = false;
  }

  clearSelection(): void {
    this.selectedWarehouse = null;
    this.showInventorySubmenu = false;
  }

  selectOperation(operation: string): void {
    if (operation === 'inventory') {
      this.showInventorySubmenu = true;
    } else if (operation === 'dispatch') {
      this.openDispatchDialog();
    } else if (operation === 'transfer') {
      this.openTransferDialog();
    } else if (operation === 'grv') {
      this.openGRVDialog();
    }
  }

  backToOperations(): void {
    this.showInventorySubmenu = false;
  }

  openInventoryView(): void {
    this.dialog.open(WarehouseDetailsDialog, {
      width: '90%',
      maxWidth: '1200px',
      data: this.selectedWarehouse
    });
  }

  openScrap(): void {
    this.dialog.open(ScrapDialog, {
      width: '800px',
      maxWidth: '90vw',
      data: this.selectedWarehouse
    });
  }

  openStockTake(): void {
    this.dialog.open(StockTakeDialog, {
      width: '1200px',
      maxWidth: '95vw',
      data: this.selectedWarehouse
    });
  }

  openRepackaging(): void {
    this.dialog.open(RepackagingDialog, {
      width: '700px',
      maxWidth: '90vw',
      data: this.selectedWarehouse
    });
  }

  openDispatchDialog(): void {
    this.dialog.open(DispatchDialog, {
      width: '1000px',
      maxWidth: '90vw',
      data: this.selectedWarehouse
    });
  }

  openTransferDialog(): void {
    const detailsDialog = this.dialog.open(WarehouseDetailsDialog, {
      width: '90%',
      maxWidth: '1200px',
      data: this.selectedWarehouse
    });
    setTimeout(() => {
      if (detailsDialog.componentInstance) {
        detailsDialog.componentInstance.openTransferDialog();
      }
    }, 500);
  }

  openGRVDialog(): void {
    const grvDialog = this.dialog.open(WarehouseDetailsDialog, {
      width: '90%',
      maxWidth: '1200px',
      data: this.selectedWarehouse
    });
    setTimeout(() => {
      if (grvDialog.componentInstance) {
        grvDialog.componentInstance.openGRVDialog();
      }
    }, 500);
  }

  viewWarehouseDetails(warehouse: any): void {
    this.dialog.open(WarehouseOperationsDialog, {
      width: '700px',
      maxWidth: '90vw',
      data: warehouse
    });
  }

  openWarehouseInventory(warehouse: any): void {
    this.dialog.open(WarehouseDetailsDialog, {
      width: '90%',
      maxWidth: '1200px',
      data: warehouse
    });
  }

  openWarehouse(warehouse: any): void {
    // Navigate to warehouse detail page (to be created)
    this.router.navigate(['/stock-management/warehouse', warehouse.id]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
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
      this.snackBar.open('PDF downloaded ✓', 'Close', { duration: 2000 });
    } catch (err) {
      console.error('PDF generation error:', err);
      this.snackBar.open('Failed to generate PDF. Please try again.', 'Close', { duration: 3000 });
    }
  }

  copyWellyResult(): void {
    navigator.clipboard.writeText(this.wellyResult).then(() => {
      this.snackBar.open('Copied to clipboard ✓', 'Close', { duration: 2000 });
    });
  }
}

// Warehouse Details Dialog Component
@Component({
  selector: 'warehouse-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    ScrollingModule
  ],
  template: `
    <div class="modern-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <div class="icon-wrapper">
            <mat-icon>warehouse</mat-icon>
          </div>
          <div class="header-text">
            <h2>{{ data.name }}</h2>
            <p class="location-subtitle">
              <mat-icon>place</mat-icon>
              {{ data.location }}
            </p>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <!-- Summary Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);">
              <mat-icon>inventory_2</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ sohTotalItems > 0 ? sohTotalItems : data.totalItems }}</div>
              <div class="stat-label">Total Items</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #60a5fa 0%, #f5576c 100%);">
              <mat-icon>category</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">R{{ sohTotalValue > 0 ? (sohTotalValue | number:'1.0-0') : (data.totalStockValue | number:'1.0-0') }}</div>
              <div class="stat-label">Value</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <mat-icon>person</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ data.manager }}</div>
              <div class="stat-label">Manager</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
              <mat-icon>storage</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ data.capacity }}%</div>
              <div class="stat-label">Capacity Used</div>
            </div>
          </div>
        </div>

        <!-- SOH Info Banner -->
        @if (sohAsAtDate) {
          <div class="soh-info-banner">
            <div class="soh-info-item">
              <mat-icon>calendar_today</mat-icon>
              <span>Stock as at: <strong>{{ sohAsAtDate }}</strong></span>
            </div>
            <div class="soh-info-item">
              <mat-icon>inventory_2</mat-icon>
              <span>{{ sohTotalItems | number }} items</span>
            </div>
            <div class="soh-info-item">
              <mat-icon>attach_money</mat-icon>
              <span>Total Value: <strong>R {{ sohTotalValue | number:'1.2-2' }}</strong></span>
            </div>
            @if (sohLocations.length > 0) {
              <div class="soh-info-item locations">
                <mat-icon>warehouse</mat-icon>
                <span>Locations: {{ sohLocations.join(', ') }}</span>
              </div>
            }
          </div>
        }

        <!-- Inventory Table -->
        <div class="table-section">
          <div class="table-header">
            <div class="header-left">
              <h3>
                <mat-icon>list_alt</mat-icon>
                Inventory Items
              </h3>
              <span class="item-count">{{ filteredInventoryData.length }} of {{ inventoryData.length }} items</span>
            </div>
            <div class="search-box">
              <mat-form-field appearance="outline" class="search-field">
                <mat-label>Search inventory</mat-label>
                <input matInput [(ngModel)]="searchQuery" (ngModelChange)="onSearchChange($event)" placeholder="Search by name, item code, or company">
                <mat-icon matPrefix>search</mat-icon>
                @if (searchQuery) {
                  <button matSuffix mat-icon-button (click)="clearSearch()">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </mat-form-field>
            </div>
          </div>

          <cdk-virtual-scroll-viewport itemSize="72" style="height: 500px;" class="table-container">
          <table mat-table [dataSource]="filteredInventoryData" class="modern-table">
            <!-- Checkbox Column -->
            <ng-container matColumnDef="select">
              <th mat-header-cell *matHeaderCellDef>
                <mat-checkbox
                  (change)="$event ? toggleAllRows() : null"
                  [checked]="selection.hasValue() && isAllSelected()"
                  [indeterminate]="selection.hasValue() && !isAllSelected()">
                </mat-checkbox>
              </th>
              <td mat-cell *matCellDef="let item">
                <mat-checkbox
                  (click)="$event.stopPropagation()"
                  (change)="$event ? selection.toggle(item) : null"
                  [checked]="selection.isSelected(item)">
                </mat-checkbox>
              </td>
            </ng-container>

            <!-- Item Description Column -->
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Item Description</th>
              <td mat-cell *matCellDef="let item">
                <div class="item-name">
                  <mat-icon [style.color]="getCategoryColor(item.category)">{{ getCategoryIcon(item.category) }}</mat-icon>
                  <span>{{ item.name }}</span>
                </div>
              </td>
            </ng-container>

            <!-- Item Code Column -->
            <ng-container matColumnDef="sku">
              <th mat-header-cell *matHeaderCellDef>Item Code</th>
              <td mat-cell *matCellDef="let item">
                <span class="sku-badge">{{ item.sku }}</span>
              </td>
            </ng-container>

            <!-- Division Column -->
            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef>Division</th>
              <td mat-cell *matCellDef="let item">
                <mat-chip [style.background]="getCategoryColor(item.category)" style="color: white;">
                  {{ item.category }}
                </mat-chip>
              </td>
            </ng-container>

            <!-- Quantity Column -->
            <ng-container matColumnDef="quantity">
              <th mat-header-cell *matHeaderCellDef>Quantity</th>
              <td mat-cell *matCellDef="let item">
                <span class="quantity-value">{{ item.quantity }}</span>
              </td>
            </ng-container>

            <!-- Unit Price Column -->
            <ng-container matColumnDef="unitPrice">
              <th mat-header-cell *matHeaderCellDef>Unit Price</th>
              <td mat-cell *matCellDef="let item">
                @if (item.unitPrice) {
                  <span class="price-value">R{{ item.unitPrice | number:'1.2-2' }}</span>
                } @else {
                  <span class="price-value" style="color:#94a3b8;">—</span>
                }
              </td>
            </ng-container>

            <!-- Stock Value Column -->
            <ng-container matColumnDef="totalValue">
              <th mat-header-cell *matHeaderCellDef>Stock Value</th>
              <td mat-cell *matCellDef="let item">
                @if (item.unitPrice) {
                  <span class="total-value">R{{ (item.lineValue || item.quantity * item.unitPrice) | number:'1.0-0' }}</span>
                } @else {
                  <span class="total-value" style="color:#94a3b8;">—</span>
                }
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let item">
                <mat-chip [class]="'status-chip ' + item.status.toLowerCase()">
                  <mat-icon>{{ getStatusIcon(item.status) }}</mat-icon>
                  {{ item.status }}
                </mat-chip>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns" class="sticky-header"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
          </table>
          </cdk-virtual-scroll-viewport>

          @if (filteredInventoryData.length === 0) {
            <div class="empty-state">
              <mat-icon>inventory_2</mat-icon>
              <h4>No items found</h4>
              <p>Try adjusting your search criteria</p>
            </div>
          }
        </div>
      </mat-dialog-content>

      <mat-dialog-actions>
        <div class="actions-left">
          <button mat-flat-button color="accent" (click)="exportToExcel()" class="export-btn">
            <mat-icon>file_download</mat-icon>
            Export
          </button>
          <button mat-flat-button (click)="openGRVDialog()" class="grv-btn">
            <mat-icon>add_box</mat-icon>
            GRV
          </button>
          <button mat-flat-button (click)="openTransferDialog()" [disabled]="!selection.hasValue()" class="transfer-btn">
            <mat-icon>swap_horiz</mat-icon>
            Transfer @if (selection.hasValue()) { <span class="badge">{{ selection.selected.length }}</span> }
          </button>
          <button mat-flat-button (click)="open3DPlanning()" class="planning-3d-btn">
            <mat-icon>view_in_ar</mat-icon>
            3D Planning
          </button>
        </div>
        <button mat-flat-button color="primary" mat-dialog-close class="close-action-btn">
          <mat-icon>check_circle</mat-icon>
          Close
        </button>
      </mat-dialog-actions>

      <!-- Transfer Dialog Overlay -->
      @if (showTransferDialog) {
        <div class="transfer-overlay" (click)="closeTransferDialog()">
          <div class="transfer-dialog" (click)="$event.stopPropagation()">
            <div class="transfer-header">
              <h3>Transfer Items</h3>
              <button mat-icon-button (click)="closeTransferDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="transfer-content">
              <p class="transfer-info">
                <mat-icon>info</mat-icon>
                You are about to transfer <strong>{{ selection.selected.length }}</strong> item(s)
              </p>

              <div class="selected-items">
                <h4>Selected Items:</h4>
                <div class="item-list-detailed">
                  @for (item of selection.selected; track item.sku) {
                    <div class="item-row">
                      <div class="item-info">
                        <mat-icon [style.color]="getCategoryColor(item.category)">inventory_2</mat-icon>
                        <div class="item-details">
                          <span class="item-name-text">{{ item.name }}</span>
                          <span class="item-sku">{{ item.sku }}</span>
                          <span class="available-qty">Available: {{ item.quantity }}</span>
                        </div>
                      </div>
                      <mat-form-field appearance="outline" class="quantity-field">
                        <mat-label>Quantity</mat-label>
                        <input
                          matInput
                          type="number"
                          min="1"
                          [max]="item.quantity"
                          [(ngModel)]="transferQuantities[item.sku]"
                          (ngModelChange)="setTransferQuantity(item.sku, $event, item.quantity)">
                        <span matSuffix>/ {{ item.quantity }}</span>
                      </mat-form-field>
                    </div>
                  }
                </div>
              </div>

              <mat-form-field appearance="outline" class="warehouse-select">
                <mat-label>Select Destination Warehouse</mat-label>
                <mat-select [(ngModel)]="selectedWarehouse">
                  @for (warehouse of warehouses; track warehouse) {
                    @if (warehouse !== data.name) {
                      <mat-option [value]="warehouse">{{ warehouse }}</mat-option>
                    }
                  }
                </mat-select>
                <mat-icon matPrefix>warehouse</mat-icon>
              </mat-form-field>
            </div>

            <div class="transfer-actions">
              <button mat-stroked-button (click)="closeTransferDialog()">
                <mat-icon>cancel</mat-icon>
                Cancel
              </button>
              <button mat-flat-button color="primary" (click)="confirmTransfer()" [disabled]="!selectedWarehouse">
                <mat-icon>check_circle</mat-icon>
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      }

      <!-- GRV Dialog Overlay -->
      @if (showGRVDialog) {
        <div class="transfer-overlay" (click)="closeGRVDialog()">
          <div class="transfer-dialog" (click)="$event.stopPropagation()">
            <div class="transfer-header">
              <h3>GRV - Goods Received Voucher</h3>
              <button mat-icon-button (click)="closeGRVDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="transfer-content">
              <p class="transfer-info">
                <mat-icon>info</mat-icon>
                Add stock to <strong>{{ data.name }}</strong>
              </p>

              <!-- Search for Items -->
              <mat-form-field appearance="outline" class="warehouse-select">
                <mat-label>Search for Item</mat-label>
                <input
                  matInput
                  [(ngModel)]="grvSearchQuery"
                  (ngModelChange)="filterGRVItems()"
                  placeholder="Search by name or item code">
                <mat-icon matPrefix>search</mat-icon>
              </mat-form-field>

              <!-- Filtered Items List -->
              @if (grvSearchQuery && filteredGRVItems.length > 0) {
                <div class="grv-items-dropdown">
                  <div class="grv-item-option"
                       *ngFor="let item of filteredGRVItems.slice(0, 5)"
                       (click)="selectGRVItem(item)">
                    <mat-icon [style.color]="getCategoryColor(item.category)">inventory_2</mat-icon>
                    <div class="grv-option-details">
                      <span class="grv-option-name">{{ item.name }}</span>
                      <span class="grv-option-sku">{{ item.sku }}</span>
                    </div>
                  </div>
                </div>
              }

              <!-- Selected Items for GRV -->
              @if (selectedGRVItems.length > 0) {
                <div class="selected-items">
                  <h4>Items to Receive:</h4>
                  <div class="item-list-detailed">
                    @for (item of selectedGRVItems; track item.sku) {
                      <div class="item-row">
                        <div class="item-info">
                          <mat-icon [style.color]="getCategoryColor(item.category)">inventory_2</mat-icon>
                          <div class="item-details">
                            <span class="item-name-text">{{ item.name }}</span>
                            <span class="item-sku">{{ item.sku }}</span>
                            <span class="available-qty">Current Stock: {{ item.quantity }}</span>
                          </div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                          <mat-form-field appearance="outline" class="quantity-field">
                            <mat-label>Qty to Add</mat-label>
                            <input
                              matInput
                              type="number"
                              min="1"
                              [(ngModel)]="grvQuantities[item.sku]">
                          </mat-form-field>
                          <button mat-icon-button (click)="removeGRVItem(item.sku)" color="warn">
                            <mat-icon>delete</mat-icon>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="transfer-actions">
              <button mat-stroked-button (click)="closeGRVDialog()">
                <mat-icon>cancel</mat-icon>
                Cancel
              </button>
              <button mat-flat-button color="primary" (click)="confirmGRV()" [disabled]="selectedGRVItems.length === 0">
                <mat-icon>check_circle</mat-icon>
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .modern-dialog {
      background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 32px 32px 24px 32px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      border-radius: 12px 12px 0 0;
      position: relative;
      overflow: hidden;
    }

    .dialog-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 300px;
      height: 300px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 20px;
      position: relative;
      z-index: 1;
    }

    .icon-wrapper {
      width: 64px;
      height: 64px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .icon-wrapper mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .header-text h2 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .location-subtitle {
      margin: 8px 0 0 0;
      font-size: 1rem;
      opacity: 0.95;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .location-subtitle mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      position: relative;
      z-index: 1;
      transition: all 0.3s ease;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: rotate(90deg);
    }

    mat-dialog-content {
      padding: 32px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      transition: transform 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-4px);
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .stat-info {
      flex: 1;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1a1a1a;
      line-height: 1;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #666;
      font-weight: 500;
    }

    .soh-info-banner {
      background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
      border-radius: 12px;
      padding: 16px 24px;
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: center;
      border-left: 4px solid #4caf50;
    }

    .soh-info-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #2e7d32;
      font-size: 14px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #388e3c;
      }

      strong {
        font-weight: 600;
      }

      &.locations {
        flex: 1;
        min-width: 200px;
      }
    }

    .table-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      position: relative;
    }

    .table-container {
      max-height: 500px;
      overflow-y: auto;
      border-radius: 12px;
      border: 1px solid #f0f0f0;
      margin-top: 16px;
    }

    .sticky-header {
      position: sticky;
      top: 0;
      z-index: 10;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ddd;
      margin-bottom: 16px;
    }

    .empty-state h4 {
      margin: 0 0 8px 0;
      font-size: 1.25rem;
      color: #666;
    }

    .empty-state p {
      margin: 0;
      font-size: 0.875rem;
    }

    .table-section h3 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .table-section h3 mat-icon {
      color: #2563eb;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    .header-left {
      display: flex;
      align-items: baseline;
      gap: 16px;
    }

    .item-count {
      font-size: 0.875rem;
      color: #666;
      font-weight: 500;
      background: #f5f7fa;
      padding: 4px 12px;
      border-radius: 12px;
    }

    .search-box {
      flex: 1;
      min-width: 300px;
      max-width: 500px;
    }

    .search-field {
      width: 100%;
    }

    .search-field ::ng-deep .mat-mdc-form-field-wrapper {
      padding-bottom: 0;
    }

    .search-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: white;
      border-radius: 12px;
    }

    .search-field ::ng-deep .mat-mdc-form-field-focus-overlay {
      background: rgba(37, 99, 235, 0.05);
    }

    .modern-table {
      width: 100%;
      background: transparent;
    }

    .modern-table th {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
      font-weight: 700;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 16px 12px;
      border: none;
    }

    .modern-table td {
      padding: 16px 12px;
      border-bottom: 1px solid #f0f0f0;
    }

    .table-row {
      transition: all 0.2s ease;
    }

    .table-row:hover {
      background: linear-gradient(90deg, #f8f9ff 0%, #fff 100%);
      transform: scale(1.01);
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
    }

    .item-name {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
    }

    .item-name mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .sku-badge {
      background: #f0f0f0;
      padding: 6px 12px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-weight: 600;
      font-size: 0.875rem;
      color: #555;
    }

    mat-chip {
      font-weight: 600;
      font-size: 0.875rem;
    }

    .quantity-value {
      font-weight: 700;
      font-size: 1.1rem;
      color: #333;
    }

    .price-value {
      font-weight: 600;
      color: #555;
    }

    .total-value {
      font-weight: 700;
      font-size: 1.1rem;
      color: #2563eb;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .status-chip mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .status-chip.in-stock {
      background: #43e97b !important;
      color: white !important;
    }

    .status-chip.low-stock {
      background: #ffa502 !important;
      color: white !important;
    }

    .status-chip.out-of-stock {
      background: #f5576c !important;
      color: white !important;
    }

    mat-dialog-actions {
      padding: 24px 32px;
      background: linear-gradient(180deg, rgba(248, 249, 255, 0.5) 0%, #f8f9ff 100%);
      margin: 0 -24px -24px -24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      border-top: 1px solid #e0e0e0;
      flex-wrap: wrap;
      backdrop-filter: blur(10px);
    }

    .actions-left {
      display: flex;
      gap: 12px;
      flex: 1;
    }

    .actions-right {
      display: flex;
      gap: 12px;
    }

    mat-dialog-actions button {
      height: 48px;
      font-weight: 600;
      font-size: 0.95rem;
      border-radius: 12px;
      transition: all 0.3s ease;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    mat-dialog-actions button mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    mat-dialog-actions button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    }

    .badge {
      background: rgba(255, 255, 255, 0.3);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 700;
      margin-left: 4px;
    }

    .export-btn {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%) !important;
      color: white !important;
    }

    .grv-btn {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%) !important;
      color: white !important;
    }

    .transfer-btn {
      background: linear-gradient(135deg, #f5576c 0%, #60a5fa 100%) !important;
      color: white !important;
    }

    .planning-3d-btn {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%) !important;
      color: white !important;
    }

    .transfer-btn:disabled {
      background: #ccc !important;
      color: #666 !important;
      cursor: not-allowed;
      opacity: 0.6;
    }

    /* GRV Dropdown Styles */
    .grv-items-dropdown {
      position: relative;
      margin-top: -8px;
      margin-bottom: 16px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      max-height: 300px;
      overflow-y: auto;
      z-index: 100;
    }

    .grv-item-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s ease;
      border-bottom: 1px solid #f0f0f0;
    }

    .grv-item-option:last-child {
      border-bottom: none;
    }

    .grv-item-option:hover {
      background: #f5f5f5;
    }

    .grv-item-option mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .grv-option-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .grv-option-name {
      font-weight: 600;
      color: #333;
      font-size: 0.95rem;
    }

    .grv-option-sku {
      font-size: 0.85rem;
      color: #666;
      font-family: monospace;
    }

    /* Transfer Dialog Overlay */
    .transfer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    }

    .transfer-dialog {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .transfer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
      border-radius: 16px 16px 0 0;
    }

    .transfer-header h3 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .transfer-header button {
      color: white;
    }

    .transfer-content {
      padding: 24px;
    }

    .transfer-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #e3f2fd;
      border-radius: 12px;
      margin-bottom: 24px;
      color: #1976d2;
    }

    .transfer-info mat-icon {
      color: #1976d2;
    }

    .selected-items {
      margin-bottom: 24px;
    }

    .selected-items h4 {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 1.1rem;
    }

    .item-list-detailed {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 12px;
      transition: all 0.2s ease;
    }

    .item-row:hover {
      border-color: #2563eb;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
    }

    .item-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .item-info mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .item-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .item-name-text {
      font-weight: 600;
      color: #333;
      font-size: 0.95rem;
    }

    .item-sku {
      font-size: 0.85rem;
      color: #666;
      font-family: monospace;
    }

    .available-qty {
      font-size: 0.8rem;
      color: #999;
    }

    .quantity-field {
      width: 140px;
      margin-bottom: -1.25em;
    }

    .quantity-field input {
      text-align: center;
      font-weight: 600;
      font-size: 1.1rem;
    }

    .item-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .item-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 20px;
      font-size: 0.9rem;
    }

    .item-chip mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #2563eb;
    }

    .warehouse-select {
      width: 100%;
    }

    .transfer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 24px;
      border-top: 1px solid #e0e0e0;
    }

    .transfer-actions button {
      min-width: 140px;
      height: 44px;
      font-weight: 600;
      border-radius: 8px;
    }

    .export-btn:hover {
      box-shadow: 0 8px 30px rgba(67, 233, 123, 0.4) !important;
    }

    mat-dialog-actions button mat-icon {
      margin-right: 8px;
    }

    ::-webkit-scrollbar {
      width: 10px;
    }

    ::-webkit-scrollbar-track {
      background: #f0f0f0;
      border-radius: 10px;
    }

    ::-webkit-scrollbar-thumb {
      background: #2563eb;
      border-radius: 10px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #1e40af;
    }
  `]
})
export class WarehouseDetailsDialog implements OnInit, OnDestroy {
  displayedColumns: string[] = ['select', 'name', 'sku', 'category', 'quantity', 'unitPrice', 'totalValue', 'status'];
  searchQuery: string = '';
  selection = new SelectionModel<any>(true, []);
  showTransferDialog = false;
  selectedWarehouse: string = '';
  transferQuantities: { [key: string]: number } = {};
  loading = true;

  // GRV properties
  showGRVDialog = false;
  grvSearchQuery: string = '';
  filteredGRVItems: any[] = [];
  selectedGRVItems: any[] = [];
  grvQuantities: { [key: string]: number } = {};

  warehouses: string[] = [];
  inventoryData: any[] = [];
  filteredInventoryData: any[] = [];
  
  // SOH data
  sohAsAtDate: string | null = null;
  sohTotalItems: number = 0;
  sohTotalValue: number = 0;
  sohLocations: string[] = [];

  // Performance optimization
  private searchSubject = new Subject<string>();

  private http = inject(HttpClient);
  private router = inject(Router);

  constructor(
    public dialogRef: MatDialogRef<WarehouseDetailsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    this.loadInventory();
    this.loadAllWarehouses();
    
    // Set up debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(query => {
      this.performFilter(query);
    });
  }
  
  ngOnDestroy(): void {
    // Clean up the search subject
    this.searchSubject.complete();
  }
  
  performFilter(query: string): void {
    const searchTerm = query.toLowerCase().trim();

    if (!searchTerm) {
      this.filteredInventoryData = [...this.inventoryData];
      return;
    }

    this.filteredInventoryData = this.inventoryData.filter(item =>
      item.name.toLowerCase().includes(searchTerm) ||
      item.sku.toLowerCase().includes(searchTerm) ||
      item.category.toLowerCase().includes(searchTerm)
    );
  }
  
  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  loadInventory(): void {
    this.loading = true;
    // Primary: live WarehouseInventory with sales-derived pricing
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/${this.data.id}/inventory`).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.inventoryData = data.map(item => ({
            id: item.id,
            commodityId: item.commodityId,
            name: item.commodityName,
            sku: item.commodityCode || `COM-${item.commodityId.toString().padStart(3, '0')}`,
            category: item.category || 'General',
            quantity: item.quantityOnHand,
            reorderLevel: item.reorderLevel,
            binLocation: item.binLocation,
            uom: item.unitOfMeasure || 'Each',
            unitPrice: item.unitPrice || 0,
            unitCost: item.unitCost || 0,
            lineValue: item.lineValue || 0,
            lastCountDate: item.lastCountDate,
            status: this.getStockStatus(item.quantityOnHand, item.reorderLevel)
          }));
          this.filteredInventoryData = [...this.inventoryData];
          this.sohTotalItems = this.inventoryData.length;
          this.sohTotalValue = this.inventoryData.reduce((s, i) => s + (i.lineValue || 0), 0);
          const dates = this.inventoryData.map(i => i.lastCountDate).filter(Boolean).sort();
          this.sohAsAtDate = dates.length ? dates[dates.length - 1] : null;
          this.sohLocations = [];
          this.loading = false;
        } else {
          this.loadBuildingInventory();
        }
      },
      error: () => this.loadBuildingInventory()
    });
  }

  loadBuildingInventory(): void {
    // Fallback: legacy BuildingInventory
    this.http.get<any>(`${environment.apiUrl}/warehouses/${this.data.id}/building-inventory`).subscribe({
      next: (data) => {
        if (data.items && data.items.length > 0) {
          this.sohAsAtDate = new Date().toISOString().split('T')[0]; // Live data
          this.sohTotalItems = data.totalItems;
          this.sohTotalValue = data.totalStockValue;
          this.sohLocations = data.buildings?.map((b: any) => b.name) || [];

          this.inventoryData = data.items.map((item: any) => ({
            id: item.id,
            name: item.itemDescription || item.itemCode,
            sku: item.itemCode,
            category: item.buildingName || 'Unknown',
            location: item.buildingName,
            quantity: item.qtyOnHand || 0,
            reorderLevel: item.reorderLevel,
            binLocation: item.binLocation,
            uom: item.uom || 'Each',
            unitPrice: 0,
            totalCost: item.totalCost,
            unitCost: item.unitCost,
            qtyOnPO: item.qtyOnOrder,
            qtyOnSO: item.qtyReserved,
            stockAvailable: item.qtyAvailable,
            status: this.getStockStatus(item.qtyOnHand || 0, item.reorderLevel)
          }));
          this.filteredInventoryData = [...this.inventoryData];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading building inventory:', error);
        // Fallback to legacy inventory
        this.loadLegacyInventory();
      }
    });
  }

  loadLegacyInventory(): void {
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/${this.data.id}/inventory`).subscribe({
      next: (data) => {
        this.inventoryData = data.map(item => ({
          id: item.id,
          name: item.commodityName,
          sku: `COM-${item.commodityId.toString().padStart(3, '0')}`,
          category: 'General',
          quantity: item.quantityOnHand,
          reorderLevel: item.reorderLevel,
          binLocation: item.binLocation,
          status: this.getStockStatus(item.quantityOnHand, item.reorderLevel)
        }));
        this.filteredInventoryData = [...this.inventoryData];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading inventory:', error);
        this.loading = false;
      }
    });
  }

  loadAllWarehouses(): void {
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/summary`).subscribe({
      next: (data) => {
        this.warehouses = data
          .filter(w => w.id !== this.data.id)
          .map(w => w.name);
      },
      error: (error) => console.error('Error loading warehouses:', error)
    });
  }

  getStockStatus(quantity: number, reorderLevel: number | null): string {
    if (quantity === 0) return 'Out of Stock';
    if (reorderLevel && quantity <= reorderLevel) return 'Low Stock';
    return 'In Stock';
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.filteredInventoryData.length;
    return numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.filteredInventoryData);
  }

  openTransferDialog() {
    this.showTransferDialog = true;
    // Initialize transfer quantities to 1 for each selected item
    this.selection.selected.forEach(item => {
      this.transferQuantities[item.sku] = 1;
    });
  }

  closeTransferDialog() {
    this.showTransferDialog = false;
    this.selectedWarehouse = '';
    this.transferQuantities = {};
  }

  getTransferQuantity(sku: string): number {
    return this.transferQuantities[sku] || 1;
  }

  setTransferQuantity(sku: string, quantity: number, maxQuantity: number) {
    // Ensure quantity is between 1 and available quantity
    if (quantity < 1) {
      this.transferQuantities[sku] = 1;
    } else if (quantity > maxQuantity) {
      this.transferQuantities[sku] = maxQuantity;
    } else {
      this.transferQuantities[sku] = quantity;
    }
  }

  confirmTransfer() {
    if (this.selectedWarehouse && this.selection.selected.length > 0) {
      const transferDetails = this.selection.selected.map(item =>
        `${item.name} - Quantity: ${this.transferQuantities[item.sku]}`
      ).join('\n');
      alert(`Transferring ${this.selection.selected.length} item(s) to ${this.selectedWarehouse}:\n\n${transferDetails}`);
      this.selection.clear();
      this.closeTransferDialog();
    }
  }

  // 3D Planning
  open3DPlanning() {
    // Close dialog and navigate to 3D view
    const warehouseId = this.data?.id || 1;
    this.dialogRef.close();
    setTimeout(() => {
      this.router.navigate(['/warehouse-3d'], { 
        queryParams: { warehouseId: warehouseId } 
      });
    }, 100);
  }

  // GRV Methods
  openGRVDialog() {
    this.showGRVDialog = true;
    this.grvSearchQuery = '';
    this.filteredGRVItems = [];
    this.selectedGRVItems = [];
    this.grvQuantities = {};
  }

  closeGRVDialog() {
    this.showGRVDialog = false;
    this.grvSearchQuery = '';
    this.filteredGRVItems = [];
    this.selectedGRVItems = [];
    this.grvQuantities = {};
  }

  filterGRVItems() {
    const query = this.grvSearchQuery.toLowerCase().trim();

    if (!query) {
      this.filteredGRVItems = [];
      return;
    }

    // Filter items that haven't been selected yet
    this.filteredGRVItems = this.inventoryData.filter(item => {
      const isNotSelected = !this.selectedGRVItems.find(selected => selected.sku === item.sku);
      const matchesQuery = item.name.toLowerCase().includes(query) ||
                          item.sku.toLowerCase().includes(query);
      return isNotSelected && matchesQuery;
    });
  }

  selectGRVItem(item: any) {
    // Add item to selected list if not already there
    if (!this.selectedGRVItems.find(selected => selected.sku === item.sku)) {
      this.selectedGRVItems.push(item);
      this.grvQuantities[item.sku] = 1; // Default quantity
    }
    // Clear search
    this.grvSearchQuery = '';
    this.filteredGRVItems = [];
  }

  removeGRVItem(sku: string) {
    this.selectedGRVItems = this.selectedGRVItems.filter(item => item.sku !== sku);
    delete this.grvQuantities[sku];
  }

  confirmGRV() {
    if (this.selectedGRVItems.length > 0) {
      const grvDetails = this.selectedGRVItems.map(item => {
        const qtyToAdd = this.grvQuantities[item.sku] || 1;
        const newTotal = item.quantity + qtyToAdd;
        return `${item.name} (${item.sku})\n  Adding: ${qtyToAdd} units\n  New Total: ${newTotal} units`;
      }).join('\n\n');

      alert(`GRV Confirmation for ${this.data.name}:\n\n${grvDetails}`);

      // Update inventory quantities (in real app, this would be API call)
      this.selectedGRVItems.forEach(item => {
        const qtyToAdd = this.grvQuantities[item.sku] || 1;
        const inventoryItem = this.inventoryData.find(i => i.sku === item.sku);
        if (inventoryItem) {
          inventoryItem.quantity += qtyToAdd;
          // Update status based on new quantity
          if (inventoryItem.quantity === 0) {
            inventoryItem.status = 'Out of Stock';
          } else if (inventoryItem.quantity < 10) {
            inventoryItem.status = 'Low Stock';
          } else {
            inventoryItem.status = 'In Stock';
          }
        }
      });

      // Refresh filtered data
      this.filteredInventoryData = [...this.inventoryData];
      this.closeGRVDialog();
    }
  }

  filterInventory(): void {
    // Deprecated - replaced by performFilter with debouncing
    // Kept for backwards compatibility if called elsewhere
    this.performFilter(this.searchQuery);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.performFilter('');
  }

  trackByItem(index: number, item: any): any {
    return item.id || item.sku || index;
  }

  getCategoryColor(category: string): string {
    const colors: any = {
      'Access': '#2563eb',
      'ProMed': '#f5576c',
      'Promed': '#f5576c',
      'SEB': '#43e97b',
      'Sebenzani': '#43e97b',
      'KOG': '#ff6b35',
      'Pharama': '#4facfe'
    };
    return colors[category] || '#999';
  }

  getCategoryIcon(category: string): string {
    const icons: any = {
      'Access': 'business',
      'ProMed': 'medical_services',
      'Promed': 'medical_services',
      'SEB': 'store',
      'Sebenzani': 'store',
      'KOG': 'local_shipping',
      'Pharama': 'local_pharmacy'
    };
    return icons[category] || 'inventory_2';
  }

  getStatusIcon(status: string): string {
    const icons: any = {
      'In Stock': 'check_circle',
      'Low Stock': 'warning',
      'Out of Stock': 'cancel'
    };
    return icons[status] || 'help';
  }

  exportToExcel(): void {
    // Create CSV data
    const headers = ['Item Description', 'Item Code', 'Company', 'Quantity', 'UOM (R)', 'Stock Value (R)', 'Status'];
    const rows = this.filteredInventoryData.map(item => [
      item.name,
      item.sku,
      item.category,
      item.quantity,
      item.unitPrice,
      item.quantity * item.unitPrice,
      item.status
    ]);

    // Convert to CSV format
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => {
        // Escape cells containing commas or quotes
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',') + '\n';
    });

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filename = `${this.data.name.replace(/\s+/g, '_')}_Inventory_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Warehouse Operations Menu Dialog
@Component({
  selector: 'warehouse-operations-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="operations-dialog">
      <div class="dialog-header">
        <h2>{{ data.name }}</h2>
        <button mat-icon-button (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <p class="warehouse-info">
          <mat-icon>location_on</mat-icon>
          {{ data.location }}
        </p>

        <div class="operations-grid">
          <div class="operation-block depot-block" (click)="selectOperation('depot')">
            <div class="block-icon">
              <mat-icon>warehouse</mat-icon>
            </div>
            <h3>Depot Management</h3>
            <p>View inventory & stock levels</p>
          </div>

          <!-- Order Accept & Dispatch hidden until implemented -->
          <div class="operation-block dispatch-block" (click)="selectOperation('dispatch')" style="display:none">
            <div class="block-icon">
              <mat-icon>local_shipping</mat-icon>
            </div>
            <h3>Order Accept & Dispatch</h3>
            <p>Process orders & dispatch</p>
          </div>

          <div class="operation-block transfer-block" (click)="selectOperation('transfer')">
            <div class="block-icon">
              <mat-icon>swap_horiz</mat-icon>
            </div>
            <h3>Transfer & Returns</h3>
            <p>Inter-warehouse transfers</p>
          </div>

          <div class="operation-block grv-block" (click)="selectOperation('grv')">
            <div class="block-icon">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <h3>Goods Received</h3>
            <p>Record incoming deliveries</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .operations-dialog {
      font-family: 'Roboto', sans-serif;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      border-radius: 4px 4px 0 0;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
    }

    .warehouse-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 24px 0;
      padding: 12px 16px;
      background: rgba(37, 99, 235, 0.08);
      border-radius: 12px;
      color: #2563eb;
      font-size: 0.95rem;
      font-weight: 500;
      border: 1px solid rgba(37, 99, 235, 0.2);
    }

    .warehouse-info mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #2563eb;
    }

    .operations-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding: 8px 0;
    }

    .operation-block {
      position: relative;
      cursor: pointer;
      padding: 32px 24px;
      border-radius: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-align: center;
      overflow: hidden;
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .operation-block::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .operation-block:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    }

    .operation-block:hover::before {
      opacity: 1;
    }

    .operation-block:active {
      transform: translateY(-4px) scale(0.98);
    }

    .block-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.9);
      margin-bottom: 8px;
      transition: all 0.3s ease;
    }

    .operation-block:hover .block-icon {
      transform: scale(1.1) rotate(5deg);
      background: white;
    }

    .block-icon mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }

    .operation-block h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      z-index: 1;
    }

    .operation-block p {
      margin: 0;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.95);
      font-weight: 500;
      z-index: 1;
    }

    .depot-block {
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
    }

    .depot-block .block-icon mat-icon {
      color: #2563eb;
    }

    .dispatch-block {
      background: linear-gradient(135deg, #60a5fa 0%, #f5576c 100%);
    }

    .dispatch-block .block-icon mat-icon {
      color: #f5576c;
    }

    .transfer-block {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .transfer-block .block-icon mat-icon {
      color: #4facfe;
    }

    .grv-block {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    .grv-block .block-icon mat-icon {
      color: #43e97b;
    }
  `]
})
export class WarehouseOperationsDialog {
  constructor(
    public dialogRef: MatDialogRef<WarehouseOperationsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialog: MatDialog
  ) {}

  selectOperation(operation: string): void {
    this.dialogRef.close();
    
    switch (operation) {
      case 'depot':
        // Open depot management (inventory view)
        this.dialog.open(WarehouseDetailsDialog, {
          width: '90%',
          maxWidth: '1200px',
          data: this.data
        });
        break;
      
      case 'dispatch':
        // TODO: Open dispatch dialog
        alert(`Order Accept & Dispatch for ${this.data.name}\nComing soon!`);
        break;
      
      case 'transfer':
        // Open transfer dialog (will open with transfer mode)
        const detailsDialog = this.dialog.open(WarehouseDetailsDialog, {
          width: '90%',
          maxWidth: '1200px',
          data: this.data
        });
        // Auto-open transfer after dialog loads
        setTimeout(() => {
          if (detailsDialog.componentInstance) {
            detailsDialog.componentInstance.openTransferDialog();
          }
        }, 500);
        break;
      
      case 'grv':
        // Open GRV dialog (goods received)
        const grvDialog = this.dialog.open(WarehouseDetailsDialog, {
          width: '90%',
          maxWidth: '1200px',
          data: this.data
        });
        // Auto-open GRV after dialog loads
        setTimeout(() => {
          if (grvDialog.componentInstance) {
            grvDialog.componentInstance.openGRVDialog();
          }
        }, 500);
        break;
    }
  }
}

// Dispatch Dialog Component
@Component({
  selector: 'dispatch-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTabsModule
  ],
  template: `
    <div class="dialog-header">
      <h2>Order Accept & Dispatch - {{ data.name }}</h2>
      <button mat-icon-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="dialog-content">
      <div class="info-banner">
        <mat-icon>description</mat-icon>
        <span>Process tripsheets from logistics - Generate picking slips and confirm stock availability</span>
      </div>

      <mat-tab-group class="tripsheet-tabs" [(selectedIndex)]="selectedTabIndex">
        <mat-tab label="Pending Tripsheets">
          <ng-template matTabContent>
            @if (loading) {
              <div class="loading-container">
                <mat-spinner diameter="40"></mat-spinner>
                <p>Loading tripsheets...</p>
              </div>
            } @else {
              <div class="tripsheets-section">
                <div class="section-header">
                  <h3>Pending Tripsheets ({{ pendingTripsheets.length }})</h3>
                  <mat-form-field class="search-field">
                    <mat-label>Search tripsheets</mat-label>
                    <input matInput [(ngModel)]="searchQuery" (input)="filterTripsheets()" placeholder="Tripsheet number, customer...">
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                </div>

                <div class="tripsheets-list">
                  @for (tripsheet of filteredPendingTripsheets; track tripsheet.id) {
                    <div class="tripsheet-card" [class.expanded]="tripsheet.expanded">
                      <div class="tripsheet-header" (click)="toggleTripsheet(tripsheet)">
                        <div class="tripsheet-info">
                          <div class="tripsheet-number">{{ tripsheet.tripsheetNumber }}</div>
                          <div class="tripsheet-customer">{{ tripsheet.customerName }}</div>
                          <div class="tripsheet-items">{{ tripsheet.items.length }} items requested</div>
                        </div>
                        <div class="tripsheet-details">
                          <div class="tripsheet-date">{{ tripsheet.deliveryDate }}</div>
                          <div class="tripsheet-status" [class]="tripsheet.status.toLowerCase()">
                            {{ tripsheet.status }}
                          </div>
                        </div>
                        <mat-icon>{{ tripsheet.expanded ? 'expand_less' : 'expand_more' }}</mat-icon>
                      </div>

                      @if (tripsheet.expanded) {
                        <div class="tripsheet-body">
                          <div class="items-table">
                            <table>
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th>Requested</th>
                                  <th>Available</th>
                                  <th>To Pick</th>
                                  <th>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                @for (item of tripsheet.items; track item.id) {
                                  <tr [class.shortage]="item.available < item.requested">
                                    <td>{{ item.name }}</td>
                                    <td>{{ item.requested }}</td>
                                    <td>{{ item.available }}</td>
                                    <td>
                                      <input type="number" 
                                             [(ngModel)]="item.toPick" 
                                             [max]="item.available" 
                                             min="0"
                                             class="pick-input"
                                             (change)="updatePickingStatus(tripsheet)">
                                    </td>
                                    <td>
                                      @if (item.toPick >= item.requested) {
                                        <span class="status-badge fulfilled">✓ Fulfilled</span>
                                      } @else if (item.toPick > 0) {
                                        <span class="status-badge partial">⚠ Partial</span>
                                      } @else {
                                        <span class="status-badge unavailable">✗ Unavailable</span>
                                      }
                                    </td>
                                  </tr>
                                }
                              </tbody>
                            </table>
                          </div>

                          <div class="tripsheet-actions">
                            <button mat-raised-button color="accent" (click)="generatePickingSlip(tripsheet)">
                              <mat-icon>list_alt</mat-icon>
                              Generate Picking Slip
                            </button>
                            
                            @if (tripsheet.canFulfill) {
                              <button mat-raised-button color="primary" (click)="generateDispatchSlip(tripsheet)">
                                <mat-icon>local_shipping</mat-icon>
                                Generate Dispatch Slip
                              </button>
                            } @else {
                              <button mat-raised-button color="warn" (click)="markPartialFulfillment(tripsheet)">
                                <mat-icon>report_problem</mat-icon>
                                Mark Partial/Unfulfilled
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                  @if (filteredPendingTripsheets.length === 0) {
                    <div class="empty-state">
                      <mat-icon>inbox</mat-icon>
                      <p>No pending tripsheets found</p>
                    </div>
                  }
                </div>
              </div>
            }
          </ng-template>
        </mat-tab>

        <mat-tab label="Picking Slips">
          <ng-template matTabContent>
            <div class="tripsheets-section">
              <div class="section-header">
                <h3>Picking Slips ({{ pickingSlips.length }})</h3>
                <mat-form-field class="search-field">
                  <mat-label>Search picking slips</mat-label>
                  <input matInput [(ngModel)]="pickingSearchQuery" (input)="filterPickingSlips()" placeholder="Slip number, customer...">
                  <mat-icon matSuffix>search</mat-icon>
                </mat-form-field>
              </div>

              <div class="tripsheets-list">
                @for (slip of filteredPickingSlips; track slip.id) {
                  <div class="tripsheet-card picking-slip-card">
                    <div class="tripsheet-header">
                      <div class="tripsheet-info">
                        <div class="tripsheet-number">{{ slip.slipNumber }}</div>
                        <div class="tripsheet-customer">{{ slip.customerName }}</div>
                        <div class="tripsheet-items">{{ slip.items.length }} items to pick</div>
                      </div>
                      <div class="tripsheet-details">
                        <div class="tripsheet-date">{{ slip.generatedDate }}</div>
                        <div class="tripsheet-status completed">
                          Generated
                        </div>
                      </div>
                      <div class="slip-actions">
                        <button mat-icon-button (click)="downloadPickingSlipPDF(slip)" matTooltip="Download PDF">
                          <mat-icon>download</mat-icon>
                        </button>
                        <button mat-icon-button (click)="printPickingSlip(slip)" matTooltip="Print">
                          <mat-icon>print</mat-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                }
                @if (filteredPickingSlips.length === 0) {
                  <div class="empty-state">
                    <mat-icon>list_alt</mat-icon>
                    <p>No picking slips generated yet</p>
                  </div>
                }
              </div>
            </div>
          </ng-template>
        </mat-tab>

        <mat-tab label="Dispatch Slips">
          <ng-template matTabContent>
            <div class="tripsheets-section">
              <div class="section-header">
                <h3>Dispatch Slips ({{ dispatchSlips.length }})</h3>
                <mat-form-field class="search-field">
                  <mat-label>Search dispatch slips</mat-label>
                  <input matInput [(ngModel)]="dispatchSearchQuery" (input)="filterDispatchSlips()" placeholder="Slip number, customer...">
                  <mat-icon matSuffix>search</mat-icon>
                </mat-form-field>
              </div>

              <div class="tripsheets-list">
                @for (slip of filteredDispatchSlips; track slip.id) {
                  <div class="tripsheet-card dispatch-slip-card">
                    <div class="tripsheet-header">
                      <div class="tripsheet-info">
                        <div class="tripsheet-number">{{ slip.slipNumber }}</div>
                        <div class="tripsheet-customer">{{ slip.customerName }}</div>
                        <div class="tripsheet-items">{{ slip.items.length }} items dispatched</div>
                      </div>
                      <div class="tripsheet-details">
                        <div class="tripsheet-date">{{ slip.dispatchedDate }}</div>
                        <div class="tripsheet-status completed">
                          Dispatched
                        </div>
                      </div>
                      <div class="slip-actions">
                        <button mat-icon-button (click)="downloadDispatchSlipPDF(slip)" matTooltip="Download PDF">
                          <mat-icon>download</mat-icon>
                        </button>
                        <button mat-icon-button (click)="printDispatchSlip(slip)" matTooltip="Print">
                          <mat-icon>print</mat-icon>
                        </button>
                      </div>
                    </div>
                  </div>
                }
                @if (filteredDispatchSlips.length === 0) {
                  <div class="empty-state">
                    <mat-icon>local_shipping</mat-icon>
                    <p>No dispatch slips generated yet</p>
                  </div>
                }
              </div>
            </div>
          </ng-template>
        </mat-tab>
      </mat-tab-group>
    </div>

    <div class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">Close</button>
    </div>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: linear-gradient(135deg, #60a5fa 0%, #f5576c 100%);
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
      max-height: 75vh;
      overflow-y: auto;
    }

    .tripsheet-tabs {
      margin-top: 20px;
    }

    .tripsheet-tabs ::ng-deep .mat-mdc-tab-labels {
      background: #f5f5f5;
      border-radius: 8px 8px 0 0;
    }

    .tripsheet-tabs ::ng-deep .mat-mdc-tab-label {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .tripsheet-tabs ::ng-deep .mat-mdc-tab-body-wrapper {
      padding-top: 20px;
    }

    .picking-slip-card,
    .dispatch-slip-card {
      border-left: 4px solid #4caf50;
    }

    .dispatch-slip-card {
      border-left-color: #2196f3;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: rgba(240, 147, 251, 0.1);
      border-left: 4px solid #60a5fa;
      border-radius: 8px;
      margin-bottom: 24px;
      color: #f5576c;
      font-weight: 500;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .section-header h3 {
      margin: 0;
      color: #333;
      font-size: 1.1rem;
    }

    .search-field {
      width: 300px;
    }

    .tripsheets-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .tripsheet-card {
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.3s ease;
      background: white;
    }

    .tripsheet-card.expanded {
      border-color: #60a5fa;
      box-shadow: 0 4px 16px rgba(240, 147, 251, 0.2);
    }

    .tripsheet-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .tripsheet-header:hover {
      background: rgba(240, 147, 251, 0.05);
    }

    .slip-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .slip-actions button {
      transition: all 0.3s ease;
    }

    .slip-actions button:hover {
      transform: scale(1.1);
      background: rgba(103, 126, 234, 0.1);
    }

    .tripsheet-info {
      flex: 1;
    }

    .tripsheet-number {
      font-weight: 700;
      font-size: 1.1rem;
      color: #333;
    }

    .tripsheet-customer {
      color: #666;
      margin-top: 4px;
    }

    .tripsheet-items {
      color: #999;
      font-size: 0.9rem;
      margin-top: 4px;
    }

    .tripsheet-details {
      text-align: right;
    }

    .tripsheet-date {
      color: #666;
      font-size: 0.9rem;
    }

    .tripsheet-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 8px;
    }

    .tripsheet-status.pending {
      background: #fff3e0;
      color: #f57c00;
    }

    .tripsheet-status.confirmed {
      background: #e3f2fd;
      color: #2196f3;
    }

    .tripsheet-body {
      border-top: 2px solid #f0f0f0;
      padding: 20px;
      background: #fafafa;
    }

    .items-table {
      margin-bottom: 20px;
      overflow-x: auto;
    }

    .items-table table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }

    .items-table th {
      background: linear-gradient(135deg, #60a5fa 0%, #f5576c 100%);
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }

    .items-table td {
      padding: 12px;
      border-bottom: 1px solid #e0e0e0;
    }

    .items-table tr:last-child td {
      border-bottom: none;
    }

    .items-table tr.shortage {
      background: rgba(255, 152, 0, 0.05);
    }

    .pick-input {
      width: 80px;
      padding: 6px 10px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: 600;
      text-align: center;
      transition: border-color 0.2s ease;
    }

    .pick-input:focus {
      outline: none;
      border-color: #60a5fa;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .status-badge.fulfilled {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .status-badge.partial {
      background: #fff3e0;
      color: #f57c00;
    }

    .status-badge.unavailable {
      background: #ffebee;
      color: #c62828;
    }

    .tripsheet-actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #e0e0e0;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      gap: 16px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }
  `]
})
export class DispatchDialog implements OnInit {
  loading = true;
  selectedTabIndex = 0;
  
  // Pending Tripsheets
  searchQuery = '';
  tripsheets: any[] = [];
  filteredTripsheets: any[] = [];
  pendingTripsheets: any[] = [];
  filteredPendingTripsheets: any[] = [];
  
  // Picking Slips
  pickingSearchQuery = '';
  pickingSlips: any[] = [];
  filteredPickingSlips: any[] = [];
  
  // Dispatch Slips
  dispatchSearchQuery = '';
  dispatchSlips: any[] = [];
  filteredDispatchSlips: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<DispatchDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadTripsheets();
    this.loadPickingSlips();
    this.loadDispatchSlips();
  }

  loadTripsheets(): void {
    this.loading = true;
    const warehouseId = this.data.id;
    
    // Load pending tripsheets (only Available, Assigned, InTransit statuses - not Delivered/Completed)
    this.http.get<any[]>(`${environment.apiUrl}/logistics/loads?warehouseId=${warehouseId}`)
      .subscribe({
        next: (loads) => {
          // Filter to only show non-delivered loads in pending tab
          const pendingLoads = loads.filter(load => 
            load.status !== 'Delivered' && load.status !== 'Completed'
          );
          
          this.tripsheets = pendingLoads.map(load => ({
            id: load.id,
            tripsheetNumber: load.loadNumber,
            customerName: this.getCustomerName(load),
            deliveryDate: load.scheduledDeliveryDate ? new Date(load.scheduledDeliveryDate).toLocaleDateString() : 'Not scheduled',
            status: load.status === 'Delivered' ? 'Completed' : (load.status === 'Assigned' || load.status === 'InTransit' ? 'Confirmed' : 'Pending'),
            originalStatus: load.status,
            expanded: false,
            canFulfill: true,
            items: this.mapLoadItems(load)
          }));
          this.pendingTripsheets = [...this.tripsheets];
          this.filteredTripsheets = [...this.tripsheets];
          this.filteredPendingTripsheets = [...this.tripsheets];
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading tripsheets:', error);
          this.snackBar.open('Failed to load tripsheets', 'Close', { duration: 3000 });
          this.tripsheets = [];
          this.filteredTripsheets = [];
          this.loading = false;
        }
      });
  }

  getCustomerName(load: any): string {
    // Try customerName field from API first
    if (load.customerName) {
      return load.customerName;
    }
    // Fall back to first stop's company name
    if (load.stops && load.stops.length > 0 && load.stops[0].companyName) {
      return load.stops[0].companyName;
    }
    // Last resort
    return 'Unknown Customer';
  }

  mapLoadItems(load: any): any[] {
    const items: any[] = [];
    
    // Map items from LoadItems (API returns items, not loadItems)
    if (load.items && load.items.length > 0) {
      load.items.forEach((item: any) => {
        items.push({
          id: item.id,
          name: item.commodityName || item.description || 'Unknown Item',
          requested: item.quantity || 0,
          available: 0, // Will be populated from SOH
          toPick: item.quantity || 0,
          unit: item.unitOfMeasure || 'units'
        });
      });
    }
    
    // Map items from Stops -> Commodities
    if (load.stops && load.stops.length > 0) {
      load.stops.forEach((stop: any) => {
        if (stop.commodities && stop.commodities.length > 0) {
          stop.commodities.forEach((sc: any) => {
            // Use commodityName if available, otherwise use comment field, then fallback to 'Unknown Item'
            const itemName = sc.commodityName || sc.comment || 'Unknown Item';
            const existingItem = items.find(i => i.name === itemName);
            if (existingItem) {
              existingItem.requested += sc.quantity || 0;
              existingItem.toPick += sc.quantity || 0;
            } else {
              items.push({
                id: sc.id,
                name: itemName,
                requested: sc.quantity || 0,
                available: 0, // Will be populated from SOH
                toPick: sc.quantity || 0,
                unit: sc.unitOfMeasure || 'units'
              });
            }
          });
        }
      });
    }
    
    // Available stock is not yet wired to a live SOH endpoint for this warehouse.
    // Until that integration exists, treat the requested quantity as pickable rather
    // than inventing random availability (which produced misleading fluctuating stock).
    // TODO: Replace with a real SOH lookup per warehouse + item.
    items.forEach(item => {
      item.available = item.requested;
      item.toPick = Math.min(item.toPick, item.available);
    });
    
    return items;
  }

  filterTripsheets(): void {
    const query = this.searchQuery.toLowerCase();
    this.filteredPendingTripsheets = this.pendingTripsheets.filter(ts =>
      ts.tripsheetNumber.toLowerCase().includes(query) ||
      ts.customerName.toLowerCase().includes(query)
    );
  }

  filterPickingSlips(): void {
    const query = this.pickingSearchQuery.toLowerCase();
    this.filteredPickingSlips = this.pickingSlips.filter(slip =>
      slip.slipNumber.toLowerCase().includes(query) ||
      slip.customerName.toLowerCase().includes(query)
    );
  }

  filterDispatchSlips(): void {
    const query = this.dispatchSearchQuery.toLowerCase();
    this.filteredDispatchSlips = this.dispatchSlips.filter(slip =>
      slip.slipNumber.toLowerCase().includes(query) ||
      slip.customerName.toLowerCase().includes(query)
    );
  }

  loadPickingSlips(): void {
    const warehouseId = this.data.id;
    
    // Load delivered/completed loads and convert to picking slips
    this.http.get<any[]>(`${environment.apiUrl}/logistics/loads?warehouseId=${warehouseId}`)
      .subscribe({
        next: (loads) => {
          // Filter to delivered or completed loads
          const deliveredLoads = loads.filter(load => 
            load.status === 'Delivered' || load.status === 'Completed'
          );
          
          this.pickingSlips = deliveredLoads.map(load => ({
            id: load.id,
            slipNumber: load.loadNumber,
            tripsheetNumber: load.loadNumber,
            customerName: this.getCustomerName(load),
            generatedDate: load.scheduledDeliveryDate ? new Date(load.scheduledDeliveryDate).toLocaleDateString() : new Date().toLocaleDateString(),
            items: this.mapLoadItems(load)
          }));
          
          this.filteredPickingSlips = [...this.pickingSlips];
        },
        error: (error) => {
          console.error('Error loading picking slips:', error);
          this.pickingSlips = [];
          this.filteredPickingSlips = [];
        }
      });
  }

  loadDispatchSlips(): void {
    const warehouseId = this.data.id;
    
    // Load delivered/completed loads and convert to dispatch slips
    this.http.get<any[]>(`${environment.apiUrl}/logistics/loads?warehouseId=${warehouseId}`)
      .subscribe({
        next: (loads) => {
          // Filter to delivered or completed loads
          const deliveredLoads = loads.filter(load => 
            load.status === 'Delivered' || load.status === 'Completed'
          );
          
          this.dispatchSlips = deliveredLoads.map(load => ({
            id: load.id,
            slipNumber: load.loadNumber,
            tripsheetNumber: load.loadNumber,
            customerName: this.getCustomerName(load),
            dispatchedDate: load.scheduledDeliveryDate ? new Date(load.scheduledDeliveryDate).toLocaleDateString() : new Date().toLocaleDateString(),
            items: this.mapLoadItems(load)
          }));
          
          this.filteredDispatchSlips = [...this.dispatchSlips];
        },
        error: (error) => {
          console.error('Error loading dispatch slips:', error);
          this.dispatchSlips = [];
          this.filteredDispatchSlips = [];
        }
      });
  }

  downloadPickingSlipPDF(slip: any): void {
    const pdf = this.generatePickingSlipPDF(slip);
    pdf.save(`Picking-Slip-${slip.slipNumber}.pdf`);
    this.snackBar.open(`Picking slip ${slip.slipNumber} downloaded`, 'Close', { duration: 2000 });
  }

  downloadDispatchSlipPDF(slip: any): void {
    const pdf = this.generateDispatchSlipPDF(slip);
    pdf.save(`Dispatch-Slip-${slip.slipNumber}.pdf`);
    this.snackBar.open(`Dispatch slip ${slip.slipNumber} downloaded`, 'Close', { duration: 2000 });
  }

  printPickingSlip(slip: any): void {
    const pdf = this.generatePickingSlipPDF(slip);
    pdf.autoPrint();
    window.open(pdf.output('bloburl'), '_blank');
    this.snackBar.open(`Printing picking slip ${slip.slipNumber}`, 'Close', { duration: 2000 });
  }

  printDispatchSlip(slip: any): void {
    const pdf = this.generateDispatchSlipPDF(slip);
    pdf.autoPrint();
    window.open(pdf.output('bloburl'), '_blank');
    this.snackBar.open(`Printing dispatch slip ${slip.slipNumber}`, 'Close', { duration: 2000 });
  }

  private generatePickingSlipPDF(slip: any): any {
    // Dynamic import to avoid bundling jsPDF if not used
    const jsPDF = (window as any).jspdf?.jsPDF;
    if (!jsPDF) {
      console.error('jsPDF not loaded');
      this.snackBar.open('PDF library not loaded. Please refresh the page.', 'Close', { duration: 3000 });
      return null;
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Header
    pdf.setFillColor(63, 81, 181); // Material Indigo
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PICKING SLIP', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Slip #: ${slip.slipNumber}`, pageWidth / 2, 30, { align: 'center' });
    
    // Document Info
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    let yPos = 50;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Customer:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(slip.customerName, 55, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Generated Date:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(slip.generatedDate, 55, yPos);
    
    if (slip.tripsheetNumber) {
      yPos += 7;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Tripsheet #:', 20, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(slip.tripsheetNumber, 55, yPos);
    }
    
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Total Items:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${slip.items.length}`, 55, yPos);
    
    // Items Table
    yPos += 15;
    const tableStartY = yPos;
    
    // Table Header
    pdf.setFillColor(240, 240, 240);
    pdf.rect(20, yPos - 5, pageWidth - 40, 10, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('#', 25, yPos);
    pdf.text('Item Name', 35, yPos);
    pdf.text('Quantity', 130, yPos);
    pdf.text('Unit', 160, yPos);
    pdf.text('Picked ☐', pageWidth - 30, yPos);
    
    yPos += 10;
    
    // Table Rows
    pdf.setFont('helvetica', 'normal');
    slip.items.forEach((item: any, index: number) => {
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = 20;
      }
      
      // Alternate row background
      if (index % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(20, yPos - 5, pageWidth - 40, 8, 'F');
      }
      
      pdf.text(`${index + 1}`, 25, yPos);
      pdf.text(item.name || 'Unknown Item', 35, yPos);
      pdf.text(`${item.quantity || item.toPick || 0}`, 130, yPos);
      pdf.text(item.unit || 'units', 160, yPos);
      
      // Checkbox
      pdf.rect(pageWidth - 32, yPos - 4, 5, 5);
      
      yPos += 8;
    });
    
    // Footer
    const footerY = pageHeight - 20;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, footerY - 5, pageWidth - 20, footerY - 5);
    
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text(`Picker Signature: _______________________`, 20, footerY);
    pdf.text(`Date: _____________`, pageWidth - 60, footerY);
    
    pdf.setFontSize(7);
    pdf.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 7, { align: 'center' });
    
    return pdf;
  }

  private generateDispatchSlipPDF(slip: any): any {
    const jsPDF = (window as any).jspdf?.jsPDF;
    if (!jsPDF) {
      console.error('jsPDF not loaded');
      this.snackBar.open('PDF library not loaded. Please refresh the page.', 'Close', { duration: 3000 });
      return null;
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Header
    pdf.setFillColor(76, 175, 80); // Material Green
    pdf.rect(0, 0, pageWidth, 40, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('DISPATCH SLIP', pageWidth / 2, 20, { align: 'center' });
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Slip #: ${slip.slipNumber}`, pageWidth / 2, 30, { align: 'center' });
    
    // Document Info
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    let yPos = 50;
    
    pdf.setFont('helvetica', 'bold');
    pdf.text('Customer:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(slip.customerName, 55, yPos);
    
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Dispatch Date:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(slip.dispatchedDate, 55, yPos);
    
    if (slip.tripsheetNumber) {
      yPos += 7;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Tripsheet #:', 20, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(slip.tripsheetNumber, 55, yPos);
    }
    
    yPos += 7;
    pdf.setFont('helvetica', 'bold');
    pdf.text('Total Items:', 20, yPos);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${slip.items.length}`, 55, yPos);
    
    // Items Table
    yPos += 15;
    
    // Table Header
    pdf.setFillColor(240, 240, 240);
    pdf.rect(20, yPos - 5, pageWidth - 40, 10, 'F');
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('#', 25, yPos);
    pdf.text('Item Name', 35, yPos);
    pdf.text('Quantity', 130, yPos);
    pdf.text('Unit', 160, yPos);
    
    yPos += 10;
    
    // Table Rows
    pdf.setFont('helvetica', 'normal');
    let totalQuantity = 0;
    
    slip.items.forEach((item: any, index: number) => {
      if (yPos > pageHeight - 40) {
        pdf.addPage();
        yPos = 20;
      }
      
      // Alternate row background
      if (index % 2 === 0) {
        pdf.setFillColor(250, 250, 250);
        pdf.rect(20, yPos - 5, pageWidth - 40, 8, 'F');
      }
      
      const quantity = item.quantity || item.toPick || 0;
      totalQuantity += quantity;
      
      pdf.text(`${index + 1}`, 25, yPos);
      pdf.text(item.name || 'Unknown Item', 35, yPos);
      pdf.text(`${quantity}`, 130, yPos);
      pdf.text(item.unit || 'units', 160, yPos);
      
      yPos += 8;
    });
    
    // Total
    yPos += 5;
    pdf.setDrawColor(0, 0, 0);
    pdf.line(120, yPos - 3, pageWidth - 20, yPos - 3);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Total:', 100, yPos);
    pdf.text(`${totalQuantity}`, 130, yPos);
    
    // Footer with signatures
    const footerY = pageHeight - 35;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(20, footerY - 5, pageWidth - 20, footerY - 5);
    
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    pdf.text('Dispatcher Signature: _______________________', 20, footerY);
    pdf.text('Date: _____________', 20, footerY + 7);
    
    pdf.text('Driver Signature: _______________________', pageWidth - 90, footerY);
    pdf.text('Date: _____________', pageWidth - 90, footerY + 7);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Customer Acknowledgement:', 20, footerY + 17);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('Received By: _______________________ Signature: _______________________ Date: _____________', 20, footerY + 23);
    
    pdf.setFontSize(7);
    pdf.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    return pdf;
  }

  toggleTripsheet(tripsheet: any): void {
    tripsheet.expanded = !tripsheet.expanded;
  }

  updatePickingStatus(tripsheet: any): void {
    // Check if all items can be fulfilled
    tripsheet.canFulfill = tripsheet.items.every((item: any) => 
      item.toPick >= item.requested
    );
  }

  generatePickingSlip(tripsheet: any): void {
    const itemsToPick = tripsheet.items.filter((item: any) => item.toPick > 0);
    
    const newPickingSlip = {
      id: this.pickingSlips.length + 1,
      slipNumber: `PS-2026-${String(this.pickingSlips.length + 1).padStart(3, '0')}`,
      customerName: tripsheet.customerName,
      tripsheetNumber: tripsheet.tripsheetNumber,
      generatedDate: new Date().toLocaleDateString(),
      items: itemsToPick.map((item: any) => ({
        name: item.name,
        quantity: item.toPick,
        unit: item.unit
      }))
    };
    
    this.pickingSlips.unshift(newPickingSlip);
    this.filteredPickingSlips = [...this.pickingSlips];
    
    this.snackBar.open(
      `Picking slip ${newPickingSlip.slipNumber} generated for ${tripsheet.tripsheetNumber}`,
      'View',
      { duration: 5000 }
    ).onAction().subscribe(() => {
      this.selectedTabIndex = 1; // Switch to Picking Slips tab
    });
  }

  generateDispatchSlip(tripsheet: any): void {
    const newDispatchSlip = {
      id: this.dispatchSlips.length + 1,
      slipNumber: `DS-2026-${String(this.dispatchSlips.length + 1).padStart(3, '0')}`,
      customerName: tripsheet.customerName,
      tripsheetNumber: tripsheet.tripsheetNumber,
      dispatchedDate: new Date().toLocaleDateString(),
      items: tripsheet.items.map((item: any) => ({
        name: item.name,
        quantity: item.toPick,
        unit: item.unit
      }))
    };
    
    this.dispatchSlips.unshift(newDispatchSlip);
    this.filteredDispatchSlips = [...this.dispatchSlips];
    
    // Remove from pending tripsheets
    const index = this.pendingTripsheets.findIndex(ts => ts.id === tripsheet.id);
    if (index > -1) {
      this.pendingTripsheets.splice(index, 1);
      this.filteredPendingTripsheets = [...this.pendingTripsheets];
    }
    
    this.snackBar.open(
      `Dispatch slip ${newDispatchSlip.slipNumber} generated - ${tripsheet.tripsheetNumber} ready for dispatch`,
      'View',
      { duration: 5000 }
    ).onAction().subscribe(() => {
      this.selectedTabIndex = 2; // Switch to Dispatch Slips tab
    });
  }

  markPartialFulfillment(tripsheet: any): void {
    const unfulfilled = tripsheet.items.filter((item: any) => item.toPick < item.requested);
    const unfulfilledList = unfulfilled.map((item: any) => 
      `${item.name}: ${item.requested - item.toPick} short`
    ).join(', ');
    
    this.snackBar.open(
      `Partial fulfillment noted for ${tripsheet.tripsheetNumber}. Short: ${unfulfilledList}`,
      'Close',
      { duration: 6000 }
    );
  }
}

// Scrap Dialog Component
@Component({
  selector: 'scrap-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="dialog-header scrap-header">
      <h2>Scrap Items - {{ data.name }}</h2>
      <button mat-icon-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="dialog-content">
      <div class="info-banner scrap-banner">
        <mat-icon>warning</mat-icon>
        <span>Record damaged or unusable items to remove from inventory</span>
      </div>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading inventory...</p>
        </div>
      } @else {
        <div class="form-section">
          <mat-form-field class="full-width">
            <mat-label>Search Item</mat-label>
            <input matInput [(ngModel)]="searchQuery" (input)="filterItems()" placeholder="Item code, description...">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          @if (filteredItems.length > 0 && searchQuery) {
            <div class="items-dropdown">
              @for (item of filteredItems.slice(0, 5); track item.sku) {
                <div class="item-option" (click)="selectItem(item)">
                  <div class="item-name">{{ item.name }}</div>
                  <div class="item-sku">{{ item.sku }}</div>
                </div>
              }
            </div>
          }

        @if (selectedItem) {
          <div class="selected-item-card">
            <div class="item-details">
              <h3>{{ selectedItem.name }}</h3>
              <p>SKU: {{ selectedItem.sku }} | Available: {{ selectedItem.quantity }} units</p>
            </div>
            <button mat-icon-button (click)="clearItem()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <mat-form-field class="full-width">
            <mat-label>Quantity to Scrap</mat-label>
            <input matInput type="number" [(ngModel)]="scrapQuantity" min="1" [max]="selectedItem.quantity">
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Reason for Scrapping</mat-label>
            <mat-select [(ngModel)]="scrapReason">
              <mat-option value="damaged">Damaged in Transit</mat-option>
              <mat-option value="expired">Expired</mat-option>
              <mat-option value="defective">Manufacturing Defect</mat-option>
              <mat-option value="contaminated">Contaminated</mat-option>
              <mat-option value="obsolete">Obsolete</mat-option>
              <mat-option value="other">Other</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Additional Notes</mat-label>
            <textarea matInput [(ngModel)]="notes" rows="3" placeholder="Enter any additional details..."></textarea>
          </mat-form-field>

          <div class="summary-box">
            <h4>Scrap Summary</h4>
            <div class="summary-row">
              <span>Item:</span>
              <strong>{{ selectedItem.name }}</strong>
            </div>
            <div class="summary-row">
              <span>Quantity:</span>
              <strong>{{ scrapQuantity }} units</strong>
            </div>
            <div class="summary-row">
              <span>New Balance:</span>
              <strong>{{ selectedItem.quantity - scrapQuantity }} units</strong>
            </div>
          </div>
        }
        </div>
      }
    </div>

    <div class="dialog-actions">
      <button mat-button (click)="dialogRef.close()" [disabled]="submitting">Cancel</button>
      <button mat-raised-button color="warn" [disabled]="!selectedItem || scrapQuantity <= 0 || !scrapReason || submitting" (click)="confirmScrap()">
        @if (submitting) {
          <mat-spinner diameter="20" style="display: inline-block; margin-right: 8px;"></mat-spinner>
        } @else {
          <mat-icon>delete_sweep</mat-icon>
        }
        {{ submitting ? 'Recording...' : 'Record Scrap' }}
      </button>
    </div>
  `,
  styles: [`
    .scrap-header {
      background: linear-gradient(135deg, #fc6767 0%, #ec008c 100%) !important;
    }

    .scrap-banner {
      background: rgba(252, 103, 103, 0.1) !important;
      border-left-color: #fc6767 !important;
      color: #ec008c !important;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      gap: 16px;
    }

    .loading-container p {
      color: #666;
      margin: 0;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 500;
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .items-dropdown {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      max-height: 200px;
      overflow-y: auto;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .item-option {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
    }

    .item-option:hover {
      background: #f5f5f5;
    }

    .item-name {
      font-weight: 600;
      color: #333;
    }

    .item-sku {
      font-size: 0.9rem;
      color: #666;
      margin-top: 4px;
    }

    .selected-item-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border: 2px solid #fc6767;
    }

    .item-details h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .item-details p {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }

    .summary-box {
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
      border-left: 4px solid #ff9800;
    }

    .summary-box h4 {
      margin: 0 0 12px 0;
      color: #f57c00;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #ffe0b2;
    }

    .summary-row:last-child {
      border-bottom: none;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class ScrapDialog implements OnInit {
  searchQuery = '';
  selectedItem: any = null;
  scrapQuantity = 1;
  scrapReason = '';
  notes = '';
  filteredItems: any[] = [];
  allItems: any[] = [];
  loading = false;
  submitting = false;

  constructor(
    public dialogRef: MatDialogRef<ScrapDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadWarehouseInventory();
  }

  loadWarehouseInventory(): void {
    this.loading = true;
    const warehouseId = this.data.id;
    
    this.http.get<any[]>(`${environment.apiUrl}/logistics/warehouses/${warehouseId}/inventory`)
      .subscribe({
        next: (inventory) => {
          this.allItems = inventory.map(item => ({
            id: item.id,
            commodityId: item.commodityId,
            sku: item.commodityCode || `COM-${item.commodityId}`,
            name: item.commodityName,
            quantity: item.quantityOnHand,
            binLocation: item.binLocation
          }));
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading warehouse inventory:', error);
          this.snackBar.open('Failed to load warehouse inventory', 'Close', { duration: 3000 });
          this.allItems = [];
          this.loading = false;
        }
      });
  }

  filterItems(): void {
    const query = this.searchQuery.toLowerCase();
    if (!query) {
      this.filteredItems = [];
      return;
    }
    this.filteredItems = this.allItems.filter(item =>
      item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query)
    );
  }

  selectItem(item: any): void {
    this.selectedItem = item;
    this.searchQuery = item.name;
    this.filteredItems = [];
    this.scrapQuantity = 1;
  }

  clearItem(): void {
    this.selectedItem = null;
    this.searchQuery = '';
    this.scrapQuantity = 1;
  }

  confirmScrap(): void {
    if (!this.selectedItem || this.scrapQuantity <= 0 || !this.scrapReason) {
      this.snackBar.open('Please fill in all required fields', 'Close', { duration: 3000 });
      return;
    }

    if (this.scrapQuantity > this.selectedItem.quantity) {
      this.snackBar.open('Scrap quantity exceeds available inventory', 'Close', { duration: 3000 });
      return;
    }

    this.submitting = true;
    const scrapData = {
      warehouseId: this.data.id,
      commodityId: this.selectedItem.commodityId,
      quantity: this.scrapQuantity,
      reason: this.scrapReason,
      notes: this.notes || null
    };

    this.http.post(`${environment.apiUrl}/logistics/scrap`, scrapData)
      .subscribe({
        next: (response: any) => {
          this.snackBar.open(
            `Scrapped ${this.scrapQuantity} units of ${this.selectedItem.name}. New balance: ${response.newInventoryBalance}`,
            'Close',
            { duration: 5000 }
          );
          this.dialogRef.close({ scrapped: true, response });
        },
        error: (error) => {
          console.error('Error recording scrap:', error);
          const errorMessage = error.error?.message || 'Failed to record scrap';
          this.snackBar.open(errorMessage, 'Close', { duration: 5000 });
          this.submitting = false;
        }
      });
  }
}

// Stock Take Dialog Component
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
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-header stocktake-header">
      <h2>Stock Take - {{ data.name }}</h2>
      <button mat-icon-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="dialog-content">
      <div class="info-banner stocktake-banner">
        <mat-icon>fact_check</mat-icon>
        <span>Perform physical count and compare with system inventory ({{ items.length }} items)</span>
      </div>

      @if (loading) {
        <div style="text-align: center; padding: 40px;">
          <mat-progress-spinner mode="indeterminate" diameter="40" style="margin: 0 auto;"></mat-progress-spinner>
          <p style="margin-top: 12px; color: #666;">Loading inventory items...</p>
        </div>
      } @else {
        <!-- Search -->
        <mat-form-field style="width: 100%; margin-bottom: 12px;">
          <mat-label>Search items</mat-label>
          <input matInput [(ngModel)]="searchQuery" (input)="filterItems()" placeholder="Search by SKU, name, or category...">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        <div class="stocktake-table">
          <table mat-table [dataSource]="filteredItems" class="full-width-table">
            <ng-container matColumnDef="sku">
              <th mat-header-cell *matHeaderCellDef>SKU</th>
              <td mat-cell *matCellDef="let item">{{ item.sku }}</td>
            </ng-container>

            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Item Name</th>
              <td mat-cell *matCellDef="let item">{{ item.name }}</td>
            </ng-container>

            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef>Location</th>
              <td mat-cell *matCellDef="let item">
                <span style="font-size: 12px; background: #e3f2fd; color: #1565c0; padding: 2px 8px; border-radius: 10px;">{{ item.category }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="uom">
              <th mat-header-cell *matHeaderCellDef>UOM</th>
              <td mat-cell *matCellDef="let item">{{ item.uom }}</td>
            </ng-container>

            <ng-container matColumnDef="systemQty">
              <th mat-header-cell *matHeaderCellDef>System Qty</th>
              <td mat-cell *matCellDef="let item">{{ item.systemQty }}</td>
            </ng-container>

            <ng-container matColumnDef="countedQty">
              <th mat-header-cell *matHeaderCellDef>Counted Qty</th>
              <td mat-cell *matCellDef="let item">
                <mat-form-field class="qty-field">
                  <input matInput type="number" [(ngModel)]="item.countedQty" (input)="calculateVariance(item)" min="0">
                </mat-form-field>
              </td>
            </ng-container>

            <ng-container matColumnDef="variance">
              <th mat-header-cell *matHeaderCellDef>Variance</th>
              <td mat-cell *matCellDef="let item">
                <span [class]="getVarianceClass(item.variance)">
                  {{ item.variance > 0 ? '+' : '' }}{{ item.variance }}
                </span>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
          </table>
        </div>

        @if (filteredItems.length === 0 && !loading) {
          <div style="text-align: center; padding: 32px; color: #999;">
            <mat-icon style="font-size: 48px; width: 48px; height: 48px;">inventory_2</mat-icon>
            <p>{{ searchQuery ? 'No items match your search' : 'No inventory items found for this warehouse' }}</p>
          </div>
        }

        @if (hasVariances()) {
          <div class="summary-section">
            <h3>Stock Take Summary</h3>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">{{ getTotalItems() }}</div>
                <div class="stat-label">Items with Variance</div>
              </div>
              <div class="stat-card positive">
                <div class="stat-value">{{ getPositiveVariances() }}</div>
                <div class="stat-label">Overages</div>
              </div>
              <div class="stat-card negative">
                <div class="stat-value">{{ getNegativeVariances() }}</div>
                <div class="stat-label">Shortages</div>
              </div>
            </div>
          </div>
        }
      }
    </div>

    <div class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!hasVariances()" (click)="submitStockTake()">
        <mat-icon>save</mat-icon>
        Submit Stock Take
      </button>
    </div>
  `,
  styles: [`
    .stocktake-header {
      background: linear-gradient(135deg, #f77062 0%, #fe5196 100%) !important;
    }

    .stocktake-banner {
      background: rgba(247, 112, 98, 0.1) !important;
      border-left-color: #f77062 !important;
      color: #fe5196 !important;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 500;
    }

    .stocktake-table {
      margin-bottom: 24px;
    }

    .full-width-table {
      width: 100%;
    }

    .qty-field {
      width: 100px;
      margin-bottom: -1.25em;
    }

    .qty-field input {
      text-align: center;
      font-weight: 600;
    }

    .variance-positive {
      color: #4caf50;
      font-weight: 700;
    }

    .variance-negative {
      color: #f44336;
      font-weight: 700;
    }

    .variance-zero {
      color: #999;
    }

    .summary-section {
      padding: 20px;
      background: #f5f5f5;
      border-radius: 12px;
    }

    .summary-section h3 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .stat-card {
      padding: 16px;
      background: white;
      border-radius: 8px;
      text-align: center;
      border: 2px solid #e0e0e0;
    }

    .stat-card.positive {
      border-color: #4caf50;
      background: #f1f8f4;
    }

    .stat-card.negative {
      border-color: #f44336;
      background: #fef1f1;
    }

    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #333;
    }

    .stat-label {
      font-size: 0.9rem;
      color: #666;
      margin-top: 4px;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class StockTakeDialog implements OnInit {
  displayedColumns = ['sku', 'name', 'category', 'uom', 'systemQty', 'countedQty', 'variance'];
  items: any[] = [];
  filteredItems: any[] = [];
  loading = true;
  searchQuery = '';
  private http = inject(HttpClient);

  constructor(
    public dialogRef: MatDialogRef<StockTakeDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadInventoryItems();
  }

  loadInventoryItems(): void {
    this.loading = true;
    // Load from live BuildingInventory API - same source as the inventory view
    this.http.get<any>(`${environment.apiUrl}/warehouses/${this.data.id}/building-inventory`).subscribe({
      next: (response) => {
        if (response.items && response.items.length > 0) {
          this.items = response.items.map((item: any) => ({
            id: item.id,
            sku: item.itemCode,
            name: item.itemDescription || item.itemCode,
            category: item.buildingName || 'Unknown',
            uom: item.uom || 'Each',
            systemQty: item.qtyOnHand || 0,
            countedQty: item.qtyOnHand || 0,
            variance: 0
          }));
        } else {
          // Fallback to legacy inventory
          this.loadLegacyInventory();
          return;
        }
        this.filteredItems = [...this.items];
        this.loading = false;
      },
      error: () => {
        // Fallback to legacy inventory
        this.loadLegacyInventory();
      }
    });
  }

  private loadLegacyInventory(): void {
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/${this.data.id}/inventory`).subscribe({
      next: (data) => {
        this.items = data.map(item => ({
          id: item.id,
          sku: `COM-${item.commodityId?.toString().padStart(3, '0') || '000'}`,
          name: item.commodityName,
          category: 'General',
          uom: 'Each',
          systemQty: item.quantityOnHand || 0,
          countedQty: item.quantityOnHand || 0,
          variance: 0
        }));
        this.filteredItems = [...this.items];
        this.loading = false;
      },
      error: () => {
        this.items = [];
        this.filteredItems = [];
        this.loading = false;
        this.snackBar.open('Failed to load inventory items', 'Close', { duration: 3000 });
      }
    });
  }

  filterItems(): void {
    const query = this.searchQuery.toLowerCase().trim();
    if (!query) {
      this.filteredItems = [...this.items];
      return;
    }
    this.filteredItems = this.items.filter(item =>
      item.sku.toLowerCase().includes(query) ||
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }

  calculateVariance(item: any): void {
    item.variance = (item.countedQty || 0) - item.systemQty;
  }

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'variance-positive';
    if (variance < 0) return 'variance-negative';
    return 'variance-zero';
  }

  hasVariances(): boolean {
    return this.filteredItems.some(item => item.variance !== 0);
  }

  getTotalItems(): number {
    return this.filteredItems.filter(item => item.variance !== 0).length;
  }

  getPositiveVariances(): number {
    return this.filteredItems.filter(item => item.variance > 0).length;
  }

  getNegativeVariances(): number {
    return this.filteredItems.filter(item => item.variance < 0).length;
  }

  submitStockTake(): void {
    const adjustedItems = this.items.filter(item => item.variance !== 0);
    this.snackBar.open(`Stock take completed. ${adjustedItems.length} items with variances recorded.`, 'Close', { duration: 5000 });
    this.dialogRef.close({ submitted: true, adjustedItems });
  }
}

// Repackaging Dialog Component
@Component({
  selector: 'repackaging-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <div class="dialog-header repack-header">
      <h2>Repackaging - {{ data.name }}</h2>
      <button mat-icon-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="dialog-content">
      <div class="info-banner repack-banner">
        <mat-icon>inventory</mat-icon>
        <span>Change item packaging or split bulk items into smaller units</span>
      </div>

      <div class="form-section">
        <mat-form-field class="full-width">
          <mat-label>Select Item to Repackage</mat-label>
          <mat-select [(ngModel)]="selectedItem" (selectionChange)="onItemSelect()">
            <mat-option [value]="null">-- Select Item --</mat-option>
            @for (item of items; track item.sku) {
              <mat-option [value]="item">{{ item.name }} ({{ item.sku }})</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (selectedItem) {
          <div class="current-package-card">
            <h3>Current Package</h3>
            <div class="package-details">
              <div class="detail-row">
                <span>Item:</span>
                <strong>{{ selectedItem.name }}</strong>
              </div>
              <div class="detail-row">
                <span>Current Qty:</span>
                <strong>{{ selectedItem.quantity }} {{ selectedItem.unit }}</strong>
              </div>
              <div class="detail-row">
                <span>Package Size:</span>
                <strong>{{ selectedItem.packageSize }} {{ selectedItem.unit }}/package</strong>
              </div>
            </div>
          </div>

          <div class="repackage-section">
            <h3>New Packaging</h3>
            
            <mat-form-field class="full-width">
              <mat-label>Repackage Type</mat-label>
              <mat-select [(ngModel)]="repackType">
                <mat-option value="split">Split into Smaller Units</mat-option>
                <mat-option value="combine">Combine into Larger Units</mat-option>
                <mat-option value="repack">Change Package Size</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>New Package Size</mat-label>
              <input matInput type="number" [(ngModel)]="newPackageSize" min="1">
              <span matSuffix>{{ selectedItem.unit }}/package</span>
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>Number of Units to Repackage</mat-label>
              <input matInput type="number" [(ngModel)]="unitsToRepack" min="1" [max]="selectedItem.quantity">
              <span matSuffix>{{ selectedItem.unit }}</span>
            </mat-form-field>

            <div class="calculation-card">
              <h4>Repackaging Result</h4>
              <div class="calc-row">
                <span>Original Packages:</span>
                <strong>{{ getOriginalPackages() }}</strong>
              </div>
              <div class="calc-row">
                <span>New Packages:</span>
                <strong class="highlight">{{ getNewPackages() }}</strong>
              </div>
              <div class="calc-row">
                <span>Remaining Units:</span>
                <strong>{{ getRemainingUnits() }} {{ selectedItem.unit }}</strong>
              </div>
            </div>
          </div>
        }
      </div>
    </div>

    <div class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!selectedItem || !newPackageSize || !unitsToRepack" (click)="confirmRepackage()">
        <mat-icon>published_with_changes</mat-icon>
        Confirm Repackaging
      </button>
    </div>
  `,
  styles: [`
    .repack-header {
      background: linear-gradient(135deg, #fccb90 0%, #d57eeb 100%) !important;
    }

    .repack-banner {
      background: rgba(252, 203, 144, 0.1) !important;
      border-left-color: #fccb90 !important;
      color: #d57eeb !important;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 500;
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .current-package-card {
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border-left: 4px solid #fccb90;
    }

    .current-package-card h3 {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 1rem;
    }

    .package-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }

    .detail-row span {
      color: #666;
    }

    .repackage-section h3 {
      margin: 16px 0 12px 0;
      color: #333;
      font-size: 1rem;
    }

    .calculation-card {
      padding: 16px;
      background: linear-gradient(135deg, rgba(252, 203, 144, 0.1) 0%, rgba(213, 126, 235, 0.1) 100%);
      border-radius: 8px;
      border: 2px solid #d57eeb;
    }

    .calculation-card h4 {
      margin: 0 0 12px 0;
      color: #d57eeb;
    }

    .calc-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(213, 126, 235, 0.2);
    }

    .calc-row:last-child {
      border-bottom: none;
    }

    .calc-row .highlight {
      color: #d57eeb;
      font-size: 1.2rem;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class RepackagingDialog implements OnInit {
  items: any[] = [];
  selectedItem: any = null;
  repackType = '';
  newPackageSize = 0;
  unitsToRepack = 0;

  constructor(
    public dialogRef: MatDialogRef<RepackagingDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.items = [
      { sku: 'ITM-001', name: 'Medical Gloves', quantity: 1000, unit: 'pairs', packageSize: 100 },
      { sku: 'ITM-002', name: 'Surgical Masks', quantity: 5000, unit: 'units', packageSize: 50 },
      { sku: 'ITM-003', name: 'Hand Sanitizer', quantity: 500, unit: 'ml', packageSize: 500 },
    ];
  }

  onItemSelect(): void {
    this.newPackageSize = this.selectedItem?.packageSize || 0;
    this.unitsToRepack = 0;
  }

  getOriginalPackages(): number {
    if (!this.selectedItem || !this.unitsToRepack) return 0;
    return Math.floor(this.unitsToRepack / this.selectedItem.packageSize);
  }

  getNewPackages(): number {
    if (!this.selectedItem || !this.unitsToRepack || !this.newPackageSize) return 0;
    return Math.floor(this.unitsToRepack / this.newPackageSize);
  }

  getRemainingUnits(): number {
    if (!this.selectedItem || !this.unitsToRepack || !this.newPackageSize) return 0;
    return this.unitsToRepack % this.newPackageSize;
  }

  confirmRepackage(): void {
    this.snackBar.open(
      `Repackaged ${this.unitsToRepack} ${this.selectedItem.unit} of ${this.selectedItem.name} into ${this.getNewPackages()} packages`,
      'Close',
      { duration: 5000 }
    );
    this.dialogRef.close({ repackaged: true });
  }
}


