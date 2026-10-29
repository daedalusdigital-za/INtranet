import { Component, OnInit, Output, EventEmitter, ViewChild, ElementRef, NgZone, AfterViewInit, inject } from '@angular/core';
import { GoogleMapsLoaderService } from '../../../services/google-maps-loader.service';
import { CommonModule, DecimalPipe, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { Inject } from '@angular/core';
import { SanitaryPadsService, PadsDashboard, StockReceived } from '../../../services/sanitary-pads.service';
import { SchoolDeliveryComponent } from '../school-delivery/school-delivery.component';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../ui/confirm.service';
import { ToastService } from '../../../ui/toast.service';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';

@Component({
  selector: 'app-sanitary-pads-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatTabsModule, MatSelectModule,
    MatFormFieldModule, MatTableModule, MatDividerModule,
    MatDialogModule, MatInputModule, MatDatepickerModule, MatNativeDateModule,
    MatMenuModule,
    SchoolDeliveryComponent, SkeletonRowsComponent, EmptyStateComponent
  ],
  template: `
    <div class="pads-dashboard">
      <!-- Header -->
      <div class="hero-header">
        <div class="hero-content">
          <button mat-stroked-button (click)="goBack.emit()" class="back-btn">
            <mat-icon>arrow_back</mat-icon> Back to Projects
          </button>
          <div class="hero-title-block">
            <div class="hero-icon-ring">
              <mat-icon>female</mat-icon>
            </div>
            <div class="hero-text">
              <h1>Sanitary Pads Project</h1>
              <p>National Department of Health — Stock tracking & analysis</p>
            </div>
          </div>
          <div class="hero-actions">
            <button mat-stroked-button (click)="showSchoolDelivery = true">
              <mat-icon>school</mat-icon> School Deliveries
            </button>
            <button mat-flat-button color="primary" (click)="showDeliveryPasswordPrompt()">
              <mat-icon>local_shipping</mat-icon> Request Delivery
            </button>
            <button mat-stroked-button (click)="loadDashboard()" matTooltip="Refresh data">
              <mat-icon>refresh</mat-icon> Refresh
            </button>
          </div>
        </div>
      </div>

      @if (showSchoolDelivery) {
        <app-school-delivery (goBack)="showSchoolDelivery = false"></app-school-delivery>
      } @else {
      @if (loading) {
        <div class="loading-state">
          <app-skeleton-rows [rows]="6" [avatar]="false"></app-skeleton-rows>
        </div>
      }

      @if (!loading && !dashboard) {
        <div class="loading-state">
          <app-empty-state icon="cloud_off" title="The project data could not be loaded"
                           message="Check your connection, then try again.">
            <button mat-stroked-button (click)="loadDashboard()"><mat-icon>refresh</mat-icon> Try again</button>
          </app-empty-state>
        </div>
      }

      @if (!loading && dashboard) {
      <div class="dashboard-content">

        <!-- KPI Cards -->
        <div class="kpi-row">
          <div class="kpi-card kpi-received">
            <div class="kpi-icon-wrap">
              <mat-icon>inventory_2</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-value">{{ dashboard.totalReceived | number }}</span>
              <span class="kpi-label">Total Received</span>
            </div>
            <span class="kpi-sub">{{ dashboard.grnCount }} GRN records</span>
          </div>

          <div class="kpi-card kpi-delivered">
            <div class="kpi-icon-wrap">
              <mat-icon>local_shipping</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-value">{{ dashboard.totalDelivered | number }}</span>
              <span class="kpi-label">Total Delivered</span>
            </div>
            <span class="kpi-sub">3 quarters</span>
          </div>

          <div class="kpi-card kpi-balance">
            <div class="kpi-icon-wrap">
              <mat-icon>account_balance</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-value">{{ dashboard.currentBalance | number }}</span>
              <span class="kpi-label">Current Balance</span>
            </div>
            <span class="kpi-sub">Boxes on hand</span>
          </div>

          <div class="kpi-card kpi-value">
            <div class="kpi-icon-wrap">
              <mat-icon>payments</mat-icon>
            </div>
            <div class="kpi-info">
              <span class="kpi-value">R{{ dashboard.totalValue | number:'1.0-0' }}</span>
              <span class="kpi-label">Total Value</span>
            </div>
            <span class="kpi-sub">Stock received value</span>
          </div>
        </div>

        <!-- Tabs -->
        <mat-tab-group class="main-tabs" animationDuration="200ms">

          <!-- TAB 1: Quarter Analysis -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">analytics</mat-icon> Quarter Analysis
            </ng-template>
            <div class="tab-content">
              <div class="quarters-grid">
                <div class="quarter-card" *ngFor="let q of dashboard.quarters">
                  <div class="quarter-header">
                    <h3>Quarter {{ q.quarter }}</h3>
                    <span class="q-badge">Q{{ q.quarter }}</span>
                  </div>
                  <div class="quarter-stats">
                    <div class="q-stat">
                      <mat-icon>arrow_downward</mat-icon>
                      <div>
                        <span class="q-val">{{ q.stockIn | number }}</span>
                        <span class="q-lbl">Stock In</span>
                      </div>
                    </div>
                    <div class="q-stat">
                      <mat-icon>arrow_upward</mat-icon>
                      <div>
                        <span class="q-val">{{ q.stockDelivered | number }}</span>
                        <span class="q-lbl">Delivered</span>
                      </div>
                    </div>
                    <div class="q-stat">
                      <mat-icon>inventory</mat-icon>
                      <div>
                        <span class="q-val" [class.negative]="q.balance < 0">{{ q.balance | number }}</span>
                        <span class="q-lbl">Balance</span>
                      </div>
                    </div>
                  </div>
                  <div class="quarter-value">
                    <span>Value: <strong>R{{ q.value | number:'1.0-0' }}</strong></span>
                  </div>
                  <!-- Visual bar -->
                  <div class="quarter-bar">
                    <div class="bar-in" [style.width.%]="getBarPercent(q.stockIn, q.stockIn + q.stockDelivered)"></div>
                    <div class="bar-out" [style.width.%]="getBarPercent(q.stockDelivered, q.stockIn + q.stockDelivered)"></div>
                  </div>
                  <div class="bar-legend">
                    <span class="legend-in"><i class="legend-dot"></i> In</span>
                    <span class="legend-out"><i class="legend-dot"></i> Out</span>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 2: Stock Received (GRN Table) -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">receipt_long</mat-icon> Stock Received
            </ng-template>
            <div class="tab-content">
              <div class="table-header">
                <div class="table-filters">
                  <select [(ngModel)]="filterQuarter" (change)="loadStockReceived()" class="filter-select">
                    <option value="">All Quarters</option>
                    <option value="1">Quarter 1</option>
                    <option value="2">Quarter 2</option>
                    <option value="3">Quarter 3</option>
                  </select>
                  <select [(ngModel)]="filterVendor" (change)="loadStockReceived()" class="filter-select">
                    <option value="">All Vendors</option>
                    <option *ngFor="let v of vendors" [value]="v">{{ v }}</option>
                  </select>
                </div>
                <button mat-flat-button color="primary" (click)="openAddGrnDialog()">
                  <mat-icon>add</mat-icon> Add GRN
                </button>
              </div>

              <div class="table-wrap">
                <table class="app-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>GRN #</th>
                      <th>Invoice #</th>
                      <th>Loc</th>
                      <th (click)="sortReceived('date')" class="sortable">
                        Date <mat-icon *ngIf="sortBy==='date'" class="sort-icon">{{ sortDir==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon>
                      </th>
                      <th>UOM</th>
                      <th (click)="sortReceived('qty')" class="sortable num">
                        Qty <mat-icon *ngIf="sortBy==='qty'" class="sort-icon">{{ sortDir==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon>
                      </th>
                      <th class="num">Unit Cost</th>
                      <th (click)="sortReceived('value')" class="sortable num">
                        Sub-Total <mat-icon *ngIf="sortBy==='value'" class="sort-icon">{{ sortDir==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon>
                      </th>
                      <th class="center">Q</th>
                      <th class="center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let r of stockReceivedList">
                      <td class="vendor-cell">{{ getShortVendor(r.vendorName) }}</td>
                      <td class="ref">{{ r.grnNumber }}</td>
                      <td class="ref">{{ r.invoiceNumber || '—' }}</td>
                      <td class="center">{{ r.location || '—' }}</td>
                      <td>{{ r.invoiceDate | date:'dd MMM yy' }}</td>
                      <td class="center">{{ r.uom }}</td>
                      <td class="num"><strong>{{ r.quantityReceived | number }}</strong></td>
                      <td class="num">R{{ r.unitCost | number:'1.2-2' }}</td>
                      <td class="num amount">R{{ r.subTotal | number:'1.0-0' }}</td>
                      <td class="center"><span class="q-badge" *ngIf="r.quarter">Q{{ r.quarter }}</span></td>
                      <td class="center">
                        <button aria-label="Actions" mat-icon-button [matMenuTriggerFor]="rowMenu" matTooltip="Actions">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #rowMenu="matMenu">
                          <button mat-menu-item (click)="deleteGrn(r.id)">
                            <mat-icon>delete</mat-icon> Delete
                          </button>
                        </mat-menu>
                      </td>
                    </tr>
                    <tr *ngIf="!stockReceivedList.length" class="empty-row">
                      <td colspan="11">
                        <app-empty-state *ngIf="filterQuarter || filterVendor" icon="filter_alt_off" title="No GRNs match these filters"
                                         message="No stock was received for this quarter and vendor.">
                          <button mat-stroked-button (click)="clearReceivedFilters()">Clear the filters</button>
                        </app-empty-state>
                        <app-empty-state *ngIf="!filterQuarter && !filterVendor" icon="receipt_long" title="No stock received yet"
                                         message="Goods received notes for the project appear here once they are captured.">
                          <button mat-stroked-button (click)="openAddGrnDialog()"><mat-icon>add</mat-icon> Add GRN</button>
                        </app-empty-state>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot *ngIf="stockReceivedList.length">
                    <tr>
                      <td colspan="6">Total</td>
                      <td class="num">{{ getTotalQty() | number }}</td>
                      <td></td>
                      <td class="num">R{{ getTotalValue() | number:'1.0-0' }}</td>
                      <td colspan="2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 3: Stock Delivered -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">local_shipping</mat-icon> Stock Delivered
            </ng-template>
            <div class="tab-content">
              <div class="table-wrap">
                <table class="app-table">
                  <thead>
                    <tr>
                      <th>Delivery Ref</th>
                      <th>Invoice #</th>
                      <th class="num">Qty Delivered</th>
                      <th class="center">UOM</th>
                      <th class="center">Quarter</th>
                      <th>Date</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let d of stockDeliveredList">
                      <td class="ref">{{ d.deliveryReference || '—' }}</td>
                      <td class="ref">{{ d.invoiceNumber || '—' }}</td>
                      <td class="num"><strong>{{ d.quantityDelivered | number }}</strong></td>
                      <td class="center">{{ d.uom }}</td>
                      <td class="center"><span class="q-badge">Q{{ d.quarter }}</span></td>
                      <td>{{ d.deliveryDate | date:'dd MMM yyyy' }}</td>
                      <td class="notes-cell">{{ d.notes || '—' }}</td>
                    </tr>
                    <tr *ngIf="!stockDeliveredList.length" class="empty-row">
                      <td colspan="7">
                        <app-empty-state icon="local_shipping" title="No deliveries recorded yet"
                                         message="Stock delivered from the project shows here by quarter."></app-empty-state>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot *ngIf="stockDeliveredList.length">
                    <tr>
                      <td colspan="2">Total Delivered</td>
                      <td class="num">{{ getTotalDelivered() | number }}</td>
                      <td colspan="4"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 4: Warehouse Stock -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">warehouse</mat-icon> Warehouse Stock
            </ng-template>
            <div class="tab-content">
              <div class="warehouse-grid">
                <!-- System Stock -->
                <div class="wh-section">
                  <h3><mat-icon>computer</mat-icon> System Stock</h3>
                  <div class="wh-cards">
                    <div class="wh-card" *ngFor="let w of getWarehouseByType('System')">
                      <div class="wh-name">{{ w.warehouse }}</div>
                      <div class="wh-qty">{{ w.quantity | number }}</div>
                      <div class="wh-uom">BOXES</div>
                    </div>
                    <div class="wh-card wh-total">
                      <div class="wh-name">Total System</div>
                      <div class="wh-qty">{{ dashboard.systemStock | number }}</div>
                      <div class="wh-uom">BOXES</div>
                    </div>
                  </div>
                </div>

                <!-- Physical Stock -->
                <div class="wh-section">
                  <h3><mat-icon>inventory</mat-icon> Physical Stock</h3>
                  <div class="wh-cards">
                    <div class="wh-card" *ngFor="let w of getWarehouseByType('Physical')" [class.damaged]="w.damaged > 0">
                      <div class="wh-name">{{ w.warehouse }}</div>
                      <div class="wh-qty">{{ w.quantity | number }}</div>
                      <div class="wh-uom">BOXES</div>
                      <div class="wh-damaged" *ngIf="w.damaged > 0">
                        <mat-icon>warning</mat-icon> {{ w.damaged }} damaged
                      </div>
                    </div>
                    <div class="wh-card wh-total">
                      <div class="wh-name">Total Physical</div>
                      <div class="wh-qty">{{ dashboard.physicalStock | number }}</div>
                      <div class="wh-uom">BOXES</div>
                    </div>
                  </div>
                </div>

                <!-- Variance -->
                <div class="wh-section variance-section">
                  <h3><mat-icon>compare_arrows</mat-icon> Stock Variance</h3>
                  <div class="variance-grid">
                    <div class="variance-item">
                      <span class="var-label">System Stock</span>
                      <span class="var-value">{{ dashboard.systemStock | number }}</span>
                    </div>
                    <div class="variance-item">
                      <span class="var-label">Physical Stock</span>
                      <span class="var-value">{{ dashboard.physicalStock | number }}</span>
                    </div>
                    <div class="variance-item">
                      <span class="var-label">Damaged Stock</span>
                      <span class="var-value warn">{{ dashboard.damagedStock | number }}</span>
                    </div>
                    <mat-divider></mat-divider>
                    <div class="variance-item highlight">
                      <span class="var-label">Stock Difference</span>
                      <span class="var-value" [class.negative]="dashboard.stockDifference > 0">{{ dashboard.stockDifference | number }} boxes</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 5: Vendors -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">store</mat-icon> Vendors
            </ng-template>
            <div class="tab-content">
              <div class="vendor-cards">
                <div class="vendor-card" *ngFor="let v of dashboard.byVendor; let i = index">
                  <div class="vendor-rank">#{{ i + 1 }}</div>
                  <div class="vendor-info">
                    <h4>{{ v.vendor }}</h4>
                    <div class="vendor-stats">
                      <div class="vs"><mat-icon>receipt</mat-icon> {{ v.grnCount }} GRNs</div>
                      <div class="vs"><mat-icon>inventory_2</mat-icon> {{ v.totalQty | number }} boxes</div>
                      <div class="vs"><mat-icon>payments</mat-icon> R{{ v.totalValue | number:'1.0-0' }}</div>
                    </div>
                  </div>
                  <div class="vendor-bar">
                    <div class="vb-fill" [style.width.%]="getVendorPercent(v.totalQty)"></div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

          <!-- TAB 6: Invoices & Credit Notes -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="tab-icon">description</mat-icon> Invoices & Credits
            </ng-template>
            <div class="tab-content">
              <div class="inv-credit-grid">
                <div class="ic-section">
                  <h3><mat-icon>receipt</mat-icon> Invoices Processed</h3>
                  <div class="ic-list">
                    <div class="ic-item" *ngFor="let inv of dashboard.invoicesProcessed">
                      <span class="ic-ref mono">{{ inv.invoiceReference }}</span>
                      <span class="ic-date">{{ inv.invoiceDate | date:'dd MMM yyyy' }}</span>
                      <span class="ic-desc">{{ inv.description || '' }}</span>
                    </div>
                    <app-empty-state *ngIf="!dashboard.invoicesProcessed?.length" [compact]="true" icon="receipt"
                                     title="No invoices processed yet" message="Invoices processed for the project are listed here."></app-empty-state>
                  </div>
                </div>

                <div class="ic-section credits">
                  <h3><mat-icon>money_off</mat-icon> Credit Notes</h3>
                  <div class="ic-list">
                    <div class="ic-item" *ngFor="let cn of dashboard.creditNotes">
                      <span class="ic-ref mono">{{ cn.creditNoteNumber }}</span>
                      <span class="ic-date">{{ cn.creditDate | date:'dd MMM yyyy' }}</span>
                      <span class="ic-desc">{{ cn.description || '' }}</span>
                    </div>
                    <app-empty-state *ngIf="!dashboard.creditNotes?.length" [compact]="true" icon="money_off"
                                     title="No credit notes" message="Credit notes raised against project invoices are listed here."></app-empty-state>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

        </mat-tab-group>
      </div>
      }

      <!-- ==================== DELIVERY PASSWORD DIALOG ==================== -->
      @if (showDeliveryPasswordDialog) {
        <div class="dlg-backdrop" (click)="cancelDeliveryPassword()"></div>
        <div class="pwd-dialog">
          <mat-icon class="pwd-lock-icon">lock</mat-icon>
          <h3>Password Required</h3>
          <p>Enter the delivery request password to continue</p>
          @if (deliveryPasswordError) {
            <div class="pwd-error">{{ deliveryPasswordError }}</div>
          }
          <mat-form-field appearance="outline" class="pwd-input">
            <mat-label>Password</mat-label>
            <input matInput type="password" [(ngModel)]="deliveryPasswordInput"
                   (keydown.enter)="verifyDeliveryPassword()"
                   placeholder="Enter password" autofocus>
          </mat-form-field>
          <div class="pwd-actions">
            <button mat-stroked-button (click)="cancelDeliveryPassword()">Cancel</button>
            <button mat-flat-button color="primary" (click)="verifyDeliveryPassword()">
              <mat-icon>lock_open</mat-icon> Verify
            </button>
          </div>
        </div>
      }

      <!-- ==================== REQUEST DELIVERY DIALOG ==================== -->
      @if (showDeliveryDialog) {
        <div class="dlg-backdrop" (click)="closeDeliveryDialog()"></div>
        <div class="dlg-panel">
          <div class="dlg-header">
            <div class="dlg-title-group">
              <div class="dlg-icon-ring">
                <mat-icon>local_shipping</mat-icon>
              </div>
              <div>
                <h2 class="dlg-title">Request Delivery</h2>
                <p class="dlg-subtitle">Submit a delivery request to logistics</p>
              </div>
            </div>
            <button aria-label="Close" class="dlg-close" (click)="closeDeliveryDialog()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="dlg-body">
            @if (deliverySuccess) {
              <div class="dlg-success">
                <div class="dlg-success-icon"><mat-icon>check_circle</mat-icon></div>
                <h3>Delivery Request Submitted!</h3>
                <p>{{ deliverySuccessMsg }}</p>
                <div class="dlg-success-actions">
                  <button mat-flat-button color="primary" (click)="resetDeliveryForm()">
                    <mat-icon>add</mat-icon> Request Another
                  </button>
                  <button mat-stroked-button (click)="closeDeliveryDialog()">
                    <mat-icon>close</mat-icon> Close
                  </button>
                </div>
              </div>
            } @else {
              @if (deliveryError) {
                <div class="dlg-error">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ deliveryError }}</span>
                </div>
              }

              <div class="dlg-form">
                <div class="dlg-row two-col">
                  <div class="dlg-field">
                    <label class="dlg-label">Description <span class="req">*</span></label>
                    <input type="text" class="dlg-input" [(ngModel)]="deliveryForm.description" placeholder="e.g. Deliver 200 boxes of sanitary pads to clinic">
                  </div>
                  <div class="dlg-field">
                    <label class="dlg-label">Priority</label>
                    <select class="dlg-select" [(ngModel)]="deliveryForm.priority">
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div class="dlg-row two-col">
                  <div class="dlg-field">
                    <label class="dlg-label">Quantity <span class="req">*</span></label>
                    <input type="number" class="dlg-input" [(ngModel)]="deliveryForm.quantity" placeholder="0" min="1">
                  </div>
                  <div class="dlg-field">
                    <label class="dlg-label">Unit of Measure</label>
                    <select class="dlg-select" [(ngModel)]="deliveryForm.unitOfMeasure">
                      <option value="BOXES">BOXES</option>
                      <option value="CASES">CASES</option>
                      <option value="UNITS">UNITS</option>
                    </select>
                  </div>
                </div>

                <div class="dlg-row two-col">
                  <div class="dlg-field">
                    <label class="dlg-label">Invoice Number <span class="opt">(optional)</span></label>
                    <input type="text" class="dlg-input" [(ngModel)]="deliveryForm.invoiceNumber" placeholder="e.g. INV-001234">
                  </div>
                  <div class="dlg-field">
                    <label class="dlg-label">GRN / Reference <span class="opt">(optional)</span></label>
                    <input type="text" class="dlg-input" [(ngModel)]="deliveryForm.reference" placeholder="e.g. GRV102411">
                  </div>
                </div>

                <div class="dlg-row">
                  <div class="dlg-field">
                    <label class="dlg-label">Delivery Address <span class="req">*</span></label>
                    <div class="address-input-wrap">
                      <mat-icon class="address-icon">location_on</mat-icon>
                      <input #addressInput type="text" class="dlg-input address-input" [(ngModel)]="deliveryForm.deliveryAddress" placeholder="Start typing an address..." autocomplete="off">
                      @if (addressVerified) {
                        <mat-icon class="address-verified" matTooltip="Address verified by Google">verified</mat-icon>
                      }
                    </div>
                    @if (addressVerified) {
                      <span class="address-confirm"><mat-icon>check_circle</mat-icon> {{ deliveryForm.deliveryAddress }}</span>
                    }
                  </div>
                </div>

                <div class="dlg-row">
                  <div class="dlg-field">
                    <label class="dlg-label">Notes <span class="opt">(optional)</span></label>
                    <input type="text" class="dlg-input" [(ngModel)]="deliveryForm.notes" placeholder="Any additional instructions...">
                  </div>
                </div>

                @if (deliveryForm.description && deliveryForm.quantity > 0) {
                  <div class="dlg-preview">
                    <mat-icon>local_shipping</mat-icon>
                    <span>
                      @if (deliveryForm.priority === 'Urgent') { <strong class="urgent-tag">Urgent:</strong> }
                      <strong>{{ deliveryForm.quantity }} {{ deliveryForm.unitOfMeasure }}</strong> —
                      {{ deliveryForm.description }}
                      @if (deliveryForm.deliveryAddress) { to {{ deliveryForm.deliveryAddress }} }
                    </span>
                  </div>
                }

                <div class="dlg-actions">
                  <button mat-stroked-button (click)="closeDeliveryDialog()" [disabled]="deliverySaving">Cancel</button>
                  <button mat-flat-button color="primary" class="btn-submit-delivery" (click)="submitDeliveryRequest()" [disabled]="deliverySaving || !isDeliveryFormValid()">
                    @if (deliverySaving) {
                      <mat-spinner diameter="18" strokeWidth="2"></mat-spinner>
                      Submitting...
                    } @else {
                      <mat-icon>send</mat-icon>
                      Submit Request
                    }
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pads-dashboard { max-width: 1440px; margin: 0 auto; padding: 0 24px 40px; }

    /* ── Header ── */
    .hero-header {
      margin-bottom: 24px;
    }
    .hero-content {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .hero-title-block {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 240px;
    }
    .hero-icon-ring {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--color-cat-pink-soft);
      color: var(--color-cat-pink);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .hero-icon-ring mat-icon {
      font-size: 22px;
      width: 22px;
      height: 22px;
    }
    .hero-text h1 {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.01em;
    }
    .hero-text p {
      margin: 2px 0 0;
      font-size: var(--text-sm);
      color: var(--color-text-3);
    }
    .hero-actions { display: flex; flex-wrap: wrap; gap: 8px; }

    /* ── Loading ── */
    .loading-state {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      overflow: hidden;
    }

    /* ── KPI Cards ── */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: 22px;
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--color-line);
      overflow: hidden;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .kpi-card:hover {
      border-color: var(--color-line-strong);
      box-shadow: var(--shadow-md);
    }
    .kpi-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    .kpi-received .kpi-icon-wrap { background: var(--color-cat-pink-soft); color: var(--color-cat-pink); }
    .kpi-delivered .kpi-icon-wrap { background: var(--color-cat-purple-soft); color: var(--color-cat-purple); }
    .kpi-balance .kpi-icon-wrap { background: var(--color-primary-soft); color: var(--color-primary); }
    .kpi-value .kpi-icon-wrap { background: var(--color-cat-teal-soft); color: var(--color-cat-teal); }
    .kpi-icon-wrap mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .kpi-info { display: flex; flex-direction: column; gap: 2px; }
    .kpi-info .kpi-value {
      font-size: var(--text-3xl);
      font-weight: 800;
      color: var(--color-text);
      line-height: 1.1;
      letter-spacing: -0.5px;
    }
    .kpi-label {
      font-size: var(--text-xs);
      color: var(--color-text-3);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .kpi-sub {
      font-size: var(--text-xs);
      color: var(--color-text-3);
      padding-top: 4px;
      border-top: 1px dashed var(--color-line);
    }

    /* ── Tabs ── */
    .main-tabs {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      border: 1px solid var(--color-line);
      overflow: hidden;
    }
    .tab-icon { margin-right: 6px; font-size: 18px; width: 18px; height: 18px; }
    .tab-content { padding: 24px; }

    /* ── Quarter Cards ── */
    .quarters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .quarter-card {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: 22px;
      border: 1px solid var(--color-line);
      box-shadow: var(--shadow-sm);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .quarter-card:hover {
      border-color: var(--color-line-strong);
      box-shadow: var(--shadow-md);
    }
    .quarter-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .quarter-header h3 { margin: 0; font-size: var(--text-xl); font-weight: 700; color: var(--color-text); }
    .quarter-stats { display: flex; gap: 20px; margin-bottom: 14px; }
    .q-stat { display: flex; align-items: center; gap: 8px; }
    .q-stat mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--color-text-3); }
    .q-stat div { display: flex; flex-direction: column; }
    .q-val { font-size: var(--text-xl); font-weight: 700; color: var(--color-text); font-variant-numeric: tabular-nums; }
    .q-val.negative { color: var(--color-danger); }
    .q-lbl { font-size: var(--text-xs); color: var(--color-text-3); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .quarter-value { font-size: var(--text-sm); color: var(--color-text-3); margin-bottom: 14px; }
    .quarter-bar { display: flex; height: 8px; border-radius: 6px; overflow: hidden; background: var(--color-surface-2); }
    .bar-in { background: var(--color-cat-pink); transition: width 0.6s cubic-bezier(.4,0,.2,1); }
    .bar-out { background: var(--color-cat-purple); transition: width 0.6s cubic-bezier(.4,0,.2,1); }
    .bar-legend { display: flex; gap: 16px; margin-top: 8px; font-size: var(--text-xs); color: var(--color-text-3); font-weight: 600; }
    .bar-legend span { display: inline-flex; align-items: center; gap: 6px; }
    .legend-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: currentColor; }
    .legend-in .legend-dot { background: var(--color-cat-pink); }
    .legend-out .legend-dot { background: var(--color-cat-purple); }

    /* ── Table ── */
    .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; }
    .table-filters { display: flex; gap: 10px; }
    .filter-select {
      padding: 10px 16px;
      border: 1px solid var(--color-line-strong);
      border-radius: var(--radius-control);
      font-size: var(--text-sm);
      color: var(--color-text);
      background: var(--color-surface);
      outline: none;
      font-family: inherit;
      cursor: pointer;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .filter-select:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }

    .table-wrap {
      overflow-x: auto;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-line);
    }
    .app-table .center { text-align: center; }
    .app-table .amount { font-weight: 700; }
    .app-table .vendor-cell { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .app-table .notes-cell { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-text-3); }
    .sortable { cursor: pointer; user-select: none; transition: color 0.15s; }
    .sortable:hover { color: var(--color-primary); }
    .sort-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; }
    .empty-row td { padding: 0; }
    .app-table tbody tr.empty-row:hover td { background: transparent; }
    .q-badge {
      display: inline-block;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      padding: 3px 10px;
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 700;
    }

    /* ── Warehouse ── */
    .warehouse-grid { display: flex; flex-direction: column; gap: 28px; }
    .wh-section h3 { display: flex; align-items: center; gap: 8px; font-size: var(--text-lg); font-weight: 700; color: var(--color-text); margin: 0 0 14px; }
    .wh-section h3 mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--color-text-3); }
    .wh-cards { display: flex; gap: 14px; flex-wrap: wrap; }
    .wh-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      padding: 20px 28px;
      min-width: 160px;
      text-align: center;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .wh-card:hover { border-color: var(--color-line-strong); box-shadow: var(--shadow-md); }
    .wh-card.damaged { border-color: var(--color-warn); background: var(--color-warn-soft); }
    .wh-card.wh-total {
      background: var(--color-surface-2);
      border-color: var(--color-line-strong);
    }
    .wh-name { font-size: var(--text-xs); color: var(--color-text-3); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .wh-qty { font-size: var(--text-4xl); font-weight: 800; color: var(--color-text); font-variant-numeric: tabular-nums; }
    .wh-uom { font-size: var(--text-xs); color: var(--color-text-3); font-weight: 600; }
    .wh-damaged { margin-top: 8px; display: flex; align-items: center; gap: 4px; font-size: var(--text-xs); color: var(--color-warn); justify-content: center; }
    .wh-damaged mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .variance-section {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: 24px;
      border: 1px solid var(--color-line);
      box-shadow: var(--shadow-sm);
    }
    .variance-grid { display: flex; flex-direction: column; gap: 12px; }
    .variance-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
    .variance-item.highlight { padding: 14px 0; }
    .var-label { font-size: var(--text-md); color: var(--color-text-2); font-weight: 500; }
    .var-value { font-size: var(--text-lg); font-weight: 800; color: var(--color-text); font-variant-numeric: tabular-nums; }
    .var-value.warn { color: var(--color-warn); }
    .var-value.negative { color: var(--color-danger); }

    /* ── Vendor Cards ── */
    .vendor-cards { display: flex; flex-direction: column; gap: 14px; }
    .vendor-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: 20px 24px;
      border: 1px solid var(--color-line);
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .vendor-card:hover { border-color: var(--color-line-strong); box-shadow: var(--shadow-md); }
    .vendor-rank {
      font-size: var(--text-2xl);
      font-weight: 800;
      min-width: 40px;
      text-align: center;
      color: var(--color-primary);
    }
    .vendor-info { flex: 1; }
    .vendor-info h4 { margin: 0 0 6px; font-size: var(--text-md); font-weight: 700; color: var(--color-text); }
    .vendor-stats { display: flex; gap: 20px; flex-wrap: wrap; }
    .vs { display: flex; align-items: center; gap: 4px; font-size: var(--text-sm); color: var(--color-text-2); }
    .vs mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--color-text-3); }
    .vendor-bar { width: 120px; height: 8px; background: var(--color-surface-2); border-radius: 6px; overflow: hidden; flex-shrink: 0; }
    .vb-fill { height: 100%; background: var(--color-primary); border-radius: 6px; transition: width 0.6s cubic-bezier(.4,0,.2,1); }

    /* ── Invoices & Credit Notes ── */
    .inv-credit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .ic-section h3 { display: flex; align-items: center; gap: 8px; font-size: var(--text-lg); font-weight: 700; color: var(--color-text); margin: 0 0 14px; }
    .ic-section h3 mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--color-text-3); }
    .ic-list { display: flex; flex-direction: column; gap: 8px; }
    .ic-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      background: var(--color-surface);
      border-radius: var(--radius-md);
      border: 1px solid var(--color-line);
      transition: background 0.15s;
    }
    .ic-item:hover { background: var(--color-surface-2); }
    .ic-ref { font-weight: 700; color: var(--color-text-2); min-width: 100px; }
    .mono { font-family: var(--font-mono); font-size: var(--text-xs); }
    .ic-date { font-size: var(--text-xs); color: var(--color-text-3); min-width: 100px; }
    .ic-desc { font-size: var(--text-xs); color: var(--color-text-3); flex: 1; }

    /* ── Delivery Dialog ── */
    .dlg-backdrop {
      position: fixed;
      inset: 0;
      background: var(--color-scrim);
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .dlg-panel {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 580px;
      max-width: 95vw;
      max-height: 90vh;
      overflow-y: auto;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      z-index: 1001;
      animation: slideUp 0.25s cubic-bezier(.4,0,.2,1);
    }
    @keyframes slideUp {
      from { transform: translate(-50%, -45%); opacity: 0; }
      to { transform: translate(-50%, -50%); opacity: 1; }
    }
    .dlg-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px 24px 16px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-line);
    }
    .dlg-title-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .dlg-icon-ring {
      width: 44px;
      height: 44px;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .dlg-icon-ring mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .dlg-title {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: 700;
      color: var(--color-text);
    }
    .dlg-subtitle {
      margin: 2px 0 0;
      font-size: var(--text-sm);
      color: var(--color-text-3);
    }
    .dlg-close {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-control);
      width: 36px;
      height: 36px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-text-2);
      transition: background 0.15s;
    }
    .dlg-close:hover { background: var(--color-surface-2); color: var(--color-text); }
    .dlg-close mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .dlg-body { padding: 24px; }

    /* ── Dialog Form ── */
    .dlg-form { display: flex; flex-direction: column; gap: 18px; }
    .dlg-row { display: flex; gap: 14px; }
    .dlg-row.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .dlg-row .dlg-field { flex: 1; }
    .dlg-field { display: flex; flex-direction: column; gap: 5px; }
    .dlg-label {
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--color-text-2);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dlg-label .req { color: var(--color-danger); }
    .dlg-label .opt { color: var(--color-text-3); font-weight: 500; text-transform: none; font-size: var(--text-xs); }
    .dlg-input, .dlg-select {
      padding: 10px 14px;
      border: 1px solid var(--color-line-strong);
      border-radius: var(--radius-control);
      font-size: var(--text-md);
      color: var(--color-text);
      background: var(--color-surface);
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .dlg-input:focus, .dlg-select:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-soft);
    }
    .dlg-input::placeholder { color: var(--color-text-3); }
    .dlg-select { cursor: pointer; appearance: auto; }

    /* ── Address Input ── */
    .address-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .address-icon {
      position: absolute;
      left: 12px;
      color: var(--color-text-3);
      font-size: 20px;
      width: 20px;
      height: 20px;
      z-index: 1;
    }
    .address-input {
      flex: 1;
      padding-left: 40px;
      padding-right: 40px;
    }
    .address-verified {
      position: absolute;
      right: 12px;
      color: var(--color-ok);
      font-size: 20px;
      width: 20px;
      height: 20px;
      animation: popIn 0.3s cubic-bezier(.4,0,.2,1);
    }
    @keyframes popIn {
      from { transform: scale(0); }
      to { transform: scale(1); }
    }
    .address-confirm {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--text-xs);
      color: var(--color-ok);
      font-weight: 600;
      margin-top: 4px;
    }
    .address-confirm mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* ── Dialog Preview ── */
    .dlg-preview {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      font-size: var(--text-sm);
      color: var(--color-text);
    }
    .dlg-preview mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--color-primary);
    }
    .urgent-tag { color: var(--color-danger); }

    /* ── Dialog Actions ── */
    .dlg-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--color-line);
    }
    .btn-submit-delivery mat-spinner {
      display: inline-block;
      vertical-align: middle;
      margin-right: 6px;
      --mdc-circular-progress-active-indicator-color: currentColor;
    }

    /* ── Dialog Success ── */
    .dlg-success {
      text-align: center;
      padding: 28px 0;
    }
    .dlg-success-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--color-ok-soft);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .dlg-success-icon mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: var(--color-ok);
    }
    .dlg-success h3 {
      color: var(--color-text);
      font-weight: 700;
      font-size: var(--text-xl);
      margin: 0 0 6px;
    }
    .dlg-success p {
      color: var(--color-text-3);
      margin: 0 0 20px;
      font-size: var(--text-md);
    }
    .dlg-success-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    /* ── Dialog Error ── */
    .dlg-error {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: var(--color-danger-soft);
      border-radius: var(--radius-control);
      color: var(--color-danger);
      font-size: var(--text-sm);
      margin-bottom: 14px;
    }
    .dlg-error mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
    }

    @media (max-width: 1100px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 768px) {
      .kpi-row { grid-template-columns: 1fr 1fr; }
      .quarters-grid { grid-template-columns: 1fr; }
      .inv-credit-grid { grid-template-columns: 1fr; }
      .quarter-stats { flex-direction: column; gap: 10px; }
      .hero-content { align-items: flex-start; }
    }
    @media (max-width: 480px) {
      .kpi-row { grid-template-columns: 1fr; }
      .pads-dashboard { padding: 0 12px 24px; }
    }

    /* Delivery Password Dialog */
    .pwd-dialog {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: var(--color-surface); border: 1px solid var(--color-line); border-radius: var(--radius-lg); padding: 32px; width: 380px; max-width: 90vw;
      text-align: center; box-shadow: var(--shadow-lg); z-index: 1200;
    }
    .pwd-lock-icon { font-size: 48px; width: 48px; height: 48px; color: var(--color-primary); margin-bottom: 12px; }
    .pwd-dialog h3 { margin: 0 0 8px 0; font-size: var(--text-2xl); color: var(--color-text); }
    .pwd-dialog p { margin: 0 0 20px 0; color: var(--color-text-2); font-size: var(--text-md); }
    .pwd-input { width: 100%; margin-bottom: 16px; }
    .pwd-actions { display: flex; gap: 12px; justify-content: center; }
    .pwd-error { color: var(--color-danger); font-size: var(--text-sm); margin: -8px 0 12px 0; }
  `]
})
export class SanitaryPadsDashboardComponent implements OnInit {
  @Output() goBack = new EventEmitter<void>();
  @ViewChild('addressInput') addressInputRef!: ElementRef<HTMLInputElement>;

  loading = true;
  showSchoolDelivery = false;
  dashboard: PadsDashboard | null = null;
  stockReceivedList: StockReceived[] = [];
  stockDeliveredList: any[] = [];
  vendors: string[] = [];

  filterQuarter = '';
  filterVendor = '';
  sortBy = 'date';
  sortDir = 'asc';

  // Delivery request
  showDeliveryDialog = false;
  deliverySaving = false;
  deliveryError = '';
  deliverySuccess = false;
  deliverySuccessMsg = '';
  // Delivery password gate
  showDeliveryPasswordDialog = false;
  deliveryPasswordInput = '';
  deliveryPasswordError = '';
  private readonly DELIVERY_PASSWORD = '0000';
  addressVerified = false;
  private autocomplete: google.maps.places.Autocomplete | null = null;
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  private readonly confirmDialog = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  deliveryForm = {
    description: '',
    priority: 'Normal',
    quantity: 0,
    unitOfMeasure: 'BOXES',
    invoiceNumber: '',
    reference: '',
    deliveryAddress: '',
    notes: ''
  };

  constructor(
    private padsService: SanitaryPadsService,
    private dialog: MatDialog,
    private http: HttpClient,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
    this.loadStockReceived();
    this.loadStockDelivered();
  }

  loadDashboard(): void {
    this.loading = true;
    this.padsService.getDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.vendors = data.byVendor.map(v => v.vendor);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Failed to load dashboard');
      }
    });
  }

  loadStockReceived(): void {
    this.padsService.getStockReceived({
      quarter: this.filterQuarter ? +this.filterQuarter : undefined,
      vendor: this.filterVendor || undefined,
      sortBy: this.sortBy,
      sortDir: this.sortDir
    }).subscribe({
      next: (res) => this.stockReceivedList = res.items,
      error: () => this.toast.error('Failed to load stock received')
    });
  }

  loadStockDelivered(): void {
    this.padsService.getStockDelivered().subscribe({
      next: (res) => this.stockDeliveredList = res.items,
      error: () => {}
    });
  }

  clearReceivedFilters(): void {
    this.filterQuarter = '';
    this.filterVendor = '';
    this.loadStockReceived();
  }

  sortReceived(col: string): void {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = 'asc';
    }
    this.loadStockReceived();
  }

  getTotalQty(): number {
    return this.stockReceivedList.reduce((sum, r) => sum + r.quantityReceived, 0);
  }

  getTotalValue(): number {
    return this.stockReceivedList.reduce((sum, r) => sum + r.subTotal, 0);
  }

  getTotalDelivered(): number {
    return this.stockDeliveredList.reduce((sum, d) => sum + d.quantityDelivered, 0);
  }

  getShortVendor(name: string): string {
    if (name.includes('KOG')) return 'KOG Trading';
    if (name.includes('PHARMATECH')) return 'Promed Pharmatech';
    if (name.includes('PHARMACARE')) return 'Promed Pharmacare';
    return name;
  }

  getBarPercent(value: number, total: number): number {
    return total > 0 ? (value / total) * 100 : 0;
  }

  getVendorPercent(qty: number): number {
    if (!this.dashboard) return 0;
    const max = Math.max(...this.dashboard.byVendor.map(v => v.totalQty));
    return max > 0 ? (qty / max) * 100 : 0;
  }

  getWarehouseByType(type: string): any[] {
    return this.dashboard?.warehouseBreakdown.filter(w => w.stockType === type) || [];
  }

  // ── Delivery Request Methods ──

  showDeliveryPasswordPrompt(): void {
    this.deliveryPasswordInput = '';
    this.deliveryPasswordError = '';
    this.showDeliveryPasswordDialog = true;
  }

  verifyDeliveryPassword(): void {
    if (this.deliveryPasswordInput === this.DELIVERY_PASSWORD) {
      this.showDeliveryPasswordDialog = false;
      this.deliveryPasswordInput = '';
      this.deliveryPasswordError = '';
      this.openDeliveryDialog();
    } else {
      this.deliveryPasswordError = 'Incorrect password. Please try again.';
      this.deliveryPasswordInput = '';
    }
  }

  cancelDeliveryPassword(): void {
    this.showDeliveryPasswordDialog = false;
    this.deliveryPasswordInput = '';
    this.deliveryPasswordError = '';
  }

  openDeliveryDialog(): void {
    this.resetDeliveryForm();
    this.showDeliveryDialog = true;
    // Init Google Places after DOM renders the input
    setTimeout(() => this.initGooglePlaces(), 100);
  }

  closeDeliveryDialog(): void {
    this.showDeliveryDialog = false;
    this.deliveryError = '';
    this.deliverySuccess = false;
    this.autocomplete = null;
  }

  resetDeliveryForm(): void {
    this.deliveryForm = {
      description: '',
      priority: 'Normal',
      quantity: 0,
      unitOfMeasure: 'BOXES',
      invoiceNumber: '',
      reference: '',
      deliveryAddress: '',
      notes: ''
    };
    this.deliveryError = '';
    this.deliverySuccess = false;
    this.deliverySuccessMsg = '';
    this.deliverySaving = false;
    this.addressVerified = false;
    // Re-init Google Places if dialog still open
    setTimeout(() => this.initGooglePlaces(), 100);
  }

  isDeliveryFormValid(): boolean {
    return !!(this.deliveryForm.description.trim() && this.deliveryForm.quantity > 0 && this.deliveryForm.deliveryAddress.trim());
  }

  private async initGooglePlaces(): Promise<void> {
    try { await this.mapsLoader.load(); } catch { return; } // key fetched from the API, script injected once
    if (!this.addressInputRef?.nativeElement) return;
    if (typeof google === 'undefined' || !google.maps?.places) return;

    this.autocomplete = new google.maps.places.Autocomplete(
      this.addressInputRef.nativeElement,
      {
        types: ['address'],
        componentRestrictions: { country: 'za' },
        fields: ['formatted_address', 'geometry', 'name']
      }
    );

    this.autocomplete.addListener('place_changed', () => {
      this.ngZone.run(() => {
        const place = this.autocomplete!.getPlace();
        if (place && place.formatted_address) {
          this.deliveryForm.deliveryAddress = place.formatted_address;
          this.addressVerified = true;
        } else if (place && place.name) {
          this.deliveryForm.deliveryAddress = place.name;
          this.addressVerified = true;
        }
      });
    });
  }

  submitDeliveryRequest(): void {
    if (!this.isDeliveryFormValid()) return;

    this.deliverySaving = true;
    this.deliveryError = '';

    const payload = {
      department: 'Sanitary Pads',
      description: this.deliveryForm.description.trim(),
      quantity: this.deliveryForm.quantity,
      uom: this.deliveryForm.unitOfMeasure || 'BOXES',
      invoiceNumber: this.deliveryForm.invoiceNumber?.trim() || null,
      batchCode: this.deliveryForm.reference?.trim() || null,
      deliveryAddress: this.deliveryForm.deliveryAddress?.trim() || null,
      notes: this.deliveryForm.notes?.trim() || null,
      priority: this.deliveryForm.priority || 'Normal'
    };

    this.http.post<any>(`${environment.apiUrl}/condomproject/delivery-requests`, payload).subscribe({
      next: (res) => {
        this.deliverySaving = false;
        this.deliverySuccess = true;
        this.deliverySuccessMsg = `Delivery request ${res.referenceNumber || ''} submitted to logistics.`;
      },
      error: (err) => {
        this.deliverySaving = false;
        this.deliveryError = err.error?.error || err.error?.message || 'Failed to submit delivery request. Please try again.';
      }
    });
  }

  openAddGrnDialog(): void {
    const dialogRef = this.dialog.open(AddGrnDialog, {
      width: '600px',
      data: { vendors: this.vendors }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadDashboard();
        this.loadStockReceived();
      }
    });
  }

  async deleteGrn(id: number): Promise<void> {
    const grnNumber = this.stockReceivedList.find(r => r.id === id)?.grnNumber;
    if (!(await this.confirmDialog.ask({
      title: grnNumber ? `Delete GRN ${grnNumber}?` : 'Delete this GRN record?',
      message: 'The stock received record is removed from the dashboard.',
      confirmText: 'Delete GRN',
      danger: true
    }))) return;
    this.padsService.deleteStockReceived(id).subscribe({
      next: () => {
        this.toast.done('GRN deleted');
        this.loadDashboard();
        this.loadStockReceived();
      },
      error: () => this.toast.error('Failed to delete')
    });
  }
}

// ============================================================================
// Add GRN Dialog
// ============================================================================
@Component({
  selector: 'add-grn-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogModule, MatInputModule, MatFormFieldModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule, MatDividerModule],
  template: `
    <div class="grn-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">receipt_long</mat-icon>
        <h2>Add Stock Received (GRN)</h2>
      </div>
      <div class="form-grid">
        <div class="form-group full-width">
          <label>Vendor Name *</label>
          <input type="text" [(ngModel)]="form.vendorName" class="form-input" placeholder="e.g. PROMED PHARMACARE (PTY) LTD">
        </div>
        <div class="form-group">
          <label>GRN Number *</label>
          <input type="text" [(ngModel)]="form.grnNumber" class="form-input" placeholder="e.g. GRV102411">
        </div>
        <div class="form-group">
          <label>Invoice Number</label>
          <input type="text" [(ngModel)]="form.invoiceNumber" class="form-input" placeholder="e.g. IN302606">
        </div>
        <div class="form-group">
          <label>Invoice Date *</label>
          <input type="date" [(ngModel)]="form.invoiceDate" class="form-input">
        </div>
        <div class="form-group">
          <label>Location</label>
          <input type="text" [(ngModel)]="form.location" class="form-input" placeholder="e.g. 01, 04">
        </div>
        <div class="form-group">
          <label>Quantity *</label>
          <input type="number" [(ngModel)]="form.quantityReceived" class="form-input" placeholder="0">
        </div>
        <div class="form-group">
          <label>Unit Cost (R) *</label>
          <input type="number" [(ngModel)]="form.unitCost" class="form-input" step="0.01" placeholder="0.00">
        </div>
        <div class="form-group">
          <label>Quarter</label>
          <select [(ngModel)]="form.quarter" class="form-input">
            <option [ngValue]="null">Select...</option>
            <option [ngValue]="1">Quarter 1</option>
            <option [ngValue]="2">Quarter 2</option>
            <option [ngValue]="3">Quarter 3</option>
            <option [ngValue]="4">Quarter 4</option>
          </select>
        </div>
        <div class="form-group">
          <label>Reference</label>
          <input type="text" [(ngModel)]="form.reference" class="form-input" placeholder="Reference">
        </div>
        <div class="form-group">
          <label>Item Code</label>
          <input type="text" [(ngModel)]="form.itemCode" class="form-input" placeholder="PAD02WC" value="PAD02WC">
        </div>
      </div>
      <div class="dialog-actions">
        <button mat-button (click)="dialogRef.close(false)" [disabled]="saving">Cancel</button>
        <button mat-flat-button color="primary" [disabled]="!form.vendorName || !form.grnNumber || !form.quantityReceived || saving" (click)="save()">
          <mat-icon>save</mat-icon> {{ saving ? 'Saving...' : 'Save GRN' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .grn-dialog { padding: 24px; background: var(--color-surface); color: var(--color-text); }
    .dialog-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .header-icon {
      font-size: 24px; width: 44px; height: 44px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-md);
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    .dialog-header h2 { margin: 0; font-size: var(--text-xl); font-weight: 700; color: var(--color-text); }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group.full-width { grid-column: 1 / -1; }
    .form-group label { font-size: var(--text-xs); font-weight: 700; color: var(--color-text-2); text-transform: uppercase; letter-spacing: 0.5px; }
    .form-input {
      padding: 10px 14px; border: 1px solid var(--color-line-strong); border-radius: var(--radius-control);
      font-size: var(--text-md); color: var(--color-text); outline: none; background: var(--color-surface); font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .form-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 12px; border-top: 1px solid var(--color-line); }
  `]
})
export class AddGrnDialog {
  form: any = {
    vendorName: '',
    grnNumber: '',
    itemCode: 'PAD02WC',
    invoiceNumber: '',
    invoiceDate: '',
    location: '',
    quantityReceived: null,
    unitCost: null,
    quarter: null,
    reference: ''
  };
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<AddGrnDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private padsService: SanitaryPadsService
  ) {}

  save(): void {
    this.saving = true;
    this.padsService.addStockReceived({
      ...this.form,
      invoiceDate: this.form.invoiceDate || undefined
    }).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving = false;
      }
    });
  }
}
