import { Component, OnInit, Output, EventEmitter, ViewChild, ElementRef, NgZone, AfterViewInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { Inject } from '@angular/core';
import { SanitaryPadsService, PadsDashboard, StockReceived } from '../../../services/sanitary-pads.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-sanitary-pads-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
    MatTooltipModule, MatChipsModule, MatTabsModule, MatSelectModule,
    MatFormFieldModule, MatTableModule, MatDividerModule, MatSnackBarModule,
    MatDialogModule, MatInputModule, MatDatepickerModule, MatNativeDateModule,
    MatMenuModule
  ],
  template: `
    <div class="pads-dashboard">
      <!-- Hero Header -->
      <div class="hero-header">
        <div class="hero-bg"></div>
        <div class="hero-content">
          <button mat-button (click)="goBack.emit()" class="back-btn">
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
            <button mat-flat-button class="request-delivery-btn" (click)="openDeliveryDialog()">
              <mat-icon>local_shipping</mat-icon> Request Delivery
            </button>
            <button mat-flat-button class="refresh-btn" (click)="loadDashboard()" matTooltip="Refresh data">
              <mat-icon>refresh</mat-icon> Refresh
            </button>
          </div>
        </div>
      </div>

      @if (loading) {
        <div class="loading-state">
          <div class="loading-card">
            <div class="loading-icon-ring pulse">
              <mat-icon>female</mat-icon>
            </div>
            <h3>Loading Project Data</h3>
            <p class="loading-sub">Fetching stock records & analytics...</p>
            <div class="loading-bar-track">
              <div class="loading-bar-fill"></div>
            </div>
          </div>
        </div>
      }

      @if (!loading && dashboard) {
      <div class="dashboard-content">

        <!-- KPI Cards -->
        <div class="kpi-row">
          <div class="kpi-card kpi-received">
            <div class="kpi-glow"></div>
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
            <div class="kpi-glow"></div>
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
            <div class="kpi-glow"></div>
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
            <div class="kpi-glow"></div>
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
                    <mat-chip class="q-chip">Q{{ q.quarter }}</mat-chip>
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
                    <span class="legend-in">● In</span>
                    <span class="legend-out">● Out</span>
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
                <table class="data-table">
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
                      <th (click)="sortReceived('qty')" class="sortable">
                        Qty <mat-icon *ngIf="sortBy==='qty'" class="sort-icon">{{ sortDir==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon>
                      </th>
                      <th>Unit Cost</th>
                      <th (click)="sortReceived('value')" class="sortable">
                        Sub-Total <mat-icon *ngIf="sortBy==='value'" class="sort-icon">{{ sortDir==='asc'?'arrow_upward':'arrow_downward' }}</mat-icon>
                      </th>
                      <th>Q</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let r of stockReceivedList">
                      <td class="vendor-cell">{{ getShortVendor(r.vendorName) }}</td>
                      <td><span class="mono">{{ r.grnNumber }}</span></td>
                      <td><span class="mono">{{ r.invoiceNumber || '—' }}</span></td>
                      <td class="center">{{ r.location || '—' }}</td>
                      <td>{{ r.invoiceDate | date:'dd MMM yy' }}</td>
                      <td class="center">{{ r.uom }}</td>
                      <td class="right"><strong>{{ r.quantityReceived | number }}</strong></td>
                      <td class="right">R{{ r.unitCost | number:'1.2-2' }}</td>
                      <td class="right amount">R{{ r.subTotal | number:'1.0-0' }}</td>
                      <td class="center"><span class="q-badge" *ngIf="r.quarter">Q{{ r.quarter }}</span></td>
                      <td class="center">
                        <button mat-icon-button [matMenuTriggerFor]="rowMenu" matTooltip="Actions">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #rowMenu="matMenu">
                          <button mat-menu-item (click)="deleteGrn(r.id)">
                            <mat-icon>delete</mat-icon> Delete
                          </button>
                        </mat-menu>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="total-row">
                      <td colspan="6"><strong>Total</strong></td>
                      <td class="right"><strong>{{ getTotalQty() | number }}</strong></td>
                      <td></td>
                      <td class="right amount"><strong>R{{ getTotalValue() | number:'1.0-0' }}</strong></td>
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
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Delivery Ref</th>
                      <th>Invoice #</th>
                      <th>Qty Delivered</th>
                      <th>UOM</th>
                      <th>Quarter</th>
                      <th>Date</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let d of stockDeliveredList">
                      <td><span class="mono">{{ d.deliveryReference || '—' }}</span></td>
                      <td><span class="mono">{{ d.invoiceNumber || '—' }}</span></td>
                      <td class="right"><strong>{{ d.quantityDelivered | number }}</strong></td>
                      <td class="center">{{ d.uom }}</td>
                      <td class="center"><span class="q-badge">Q{{ d.quarter }}</span></td>
                      <td>{{ d.deliveryDate | date:'dd MMM yyyy' }}</td>
                      <td class="notes-cell">{{ d.notes || '—' }}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr class="total-row">
                      <td colspan="2"><strong>Total Delivered</strong></td>
                      <td class="right"><strong>{{ getTotalDelivered() | number }}</strong></td>
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
                    <div class="ic-empty" *ngIf="!dashboard.invoicesProcessed?.length">No invoices</div>
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
                    <div class="ic-empty" *ngIf="!dashboard.creditNotes?.length">No credit notes</div>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>

        </mat-tab-group>
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
            <button class="dlg-close" (click)="closeDeliveryDialog()">
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
                  <button mat-flat-button class="btn-another" (click)="resetDeliveryForm()">
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
                      <option value="Urgent">🔴 Urgent</option>
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
                      @if (deliveryForm.priority === 'Urgent') { 🔴 }
                      <strong>{{ deliveryForm.quantity }} {{ deliveryForm.unitOfMeasure }}</strong> —
                      {{ deliveryForm.description }}
                      @if (deliveryForm.deliveryAddress) { → {{ deliveryForm.deliveryAddress }} }
                    </span>
                  </div>
                }

                <div class="dlg-actions">
                  <button mat-stroked-button (click)="closeDeliveryDialog()" [disabled]="deliverySaving">Cancel</button>
                  <button mat-flat-button class="btn-submit-delivery" (click)="submitDeliveryRequest()" [disabled]="deliverySaving || !isDeliveryFormValid()">
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
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pads-dashboard { max-width: 1440px; margin: 0 auto; padding: 0 24px 40px; }

    /* ── Hero Header ── */
    .hero-header {
      position: relative;
      margin: 0 -24px 32px;
      padding: 32px 40px 36px;
      overflow: hidden;
    }
    .hero-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #e91e63 0%, #9c27b0 50%, #673ab7 100%);
      z-index: 0;
    }
    .hero-bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    .hero-content {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }
    .back-btn {
      color: rgba(255,255,255,0.9) !important;
      border-radius: 12px !important;
      font-weight: 500 !important;
    }
    .back-btn:hover { background: rgba(255,255,255,0.15) !important; }
    .hero-title-block {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .hero-icon-ring {
      width: 56px;
      height: 56px;
      border-radius: 18px;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(12px);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.25);
      flex-shrink: 0;
    }
    .hero-icon-ring mat-icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
      color: white;
    }
    .hero-text h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      color: white;
      letter-spacing: -0.3px;
    }
    .hero-text p {
      margin: 4px 0 0;
      font-size: 14px;
      color: rgba(255,255,255,0.75);
    }
    .hero-actions { display: flex; gap: 10px; }
    .refresh-btn {
      background: rgba(255,255,255,0.2) !important;
      color: white !important;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.2) !important;
      border-radius: 12px !important;
      font-weight: 600 !important;
    }
    .refresh-btn:hover { background: rgba(255,255,255,0.3) !important; }

    /* ── Loading ── */
    .loading-state {
      display: flex;
      justify-content: center;
      padding: 80px 0;
    }
    .loading-card {
      text-align: center;
      background: white;
      border-radius: 24px;
      padding: 48px 56px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      border: 1px solid #f0f0f0;
    }
    .loading-icon-ring {
      width: 72px;
      height: 72px;
      border-radius: 22px;
      background: linear-gradient(135deg, #e91e63, #9c27b0);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .loading-icon-ring.pulse {
      animation: pulse-ring 1.8s ease-in-out infinite;
    }
    @keyframes pulse-ring {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(233,30,99,0.4); }
      50% { transform: scale(1.08); box-shadow: 0 0 0 16px rgba(233,30,99,0); }
    }
    .loading-icon-ring mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: white;
    }
    .loading-card h3 {
      margin: 0 0 6px;
      font-size: 18px;
      font-weight: 700;
      color: #1a1a2e;
    }
    .loading-sub {
      margin: 0 0 24px;
      font-size: 14px;
      color: #9ca3af;
    }
    .loading-bar-track {
      width: 220px;
      height: 4px;
      background: #f0f0f0;
      border-radius: 2px;
      margin: 0 auto;
      overflow: hidden;
    }
    .loading-bar-fill {
      width: 40%;
      height: 100%;
      background: linear-gradient(90deg, #e91e63, #9c27b0);
      border-radius: 2px;
      animation: shimmer 1.5s ease-in-out infinite;
    }
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(350%); }
    }

    /* ── KPI Cards ── */
    .kpi-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 18px;
      margin-bottom: 28px;
    }
    .kpi-card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: white;
      border-radius: 20px;
      padding: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
      border: 1px solid #f0f0f0;
      overflow: hidden;
      transition: transform 0.25s cubic-bezier(.4,0,.2,1), box-shadow 0.25s;
    }
    .kpi-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 28px rgba(0,0,0,0.08);
    }
    .kpi-glow {
      position: absolute;
      top: -40px;
      right: -40px;
      width: 100px;
      height: 100px;
      border-radius: 50%;
      opacity: 0.12;
      transition: opacity 0.3s;
    }
    .kpi-card:hover .kpi-glow { opacity: 0.2; }
    .kpi-received .kpi-glow { background: #e91e63; }
    .kpi-delivered .kpi-glow { background: #9c27b0; }
    .kpi-balance .kpi-glow { background: #4facfe; }
    .kpi-value .kpi-glow { background: #43e97b; }
    .kpi-icon-wrap {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .kpi-received .kpi-icon-wrap { background: linear-gradient(135deg, #e91e63, #ad1457); }
    .kpi-delivered .kpi-icon-wrap { background: linear-gradient(135deg, #9c27b0, #6a1b9a); }
    .kpi-balance .kpi-icon-wrap { background: linear-gradient(135deg, #4facfe, #00b4d8); }
    .kpi-value .kpi-icon-wrap { background: linear-gradient(135deg, #43e97b, #38f9d7); }
    .kpi-icon-wrap mat-icon {
      color: white;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .kpi-info { display: flex; flex-direction: column; gap: 2px; }
    .kpi-info .kpi-value {
      font-size: 26px;
      font-weight: 800;
      color: #1a1a2e;
      line-height: 1.1;
      letter-spacing: -0.5px;
    }
    .kpi-label {
      font-size: 13px;
      color: #6b7280;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .kpi-sub {
      font-size: 12px;
      color: #b0b8c4;
      padding-top: 4px;
      border-top: 1px dashed #f0f0f0;
    }

    /* ── Tabs ── */
    .main-tabs {
      background: white;
      border-radius: 20px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.05);
      border: 1px solid #f0f0f0;
      overflow: hidden;
    }
    .tab-icon { margin-right: 6px; font-size: 18px; width: 18px; height: 18px; }
    .tab-content { padding: 28px; }

    /* ── Quarter Cards ── */
    .quarters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .quarter-card {
      background: white;
      border-radius: 18px;
      padding: 22px;
      border: 1px solid #eee;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .quarter-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.07);
    }
    .quarter-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .quarter-header h3 { margin: 0; font-size: 18px; font-weight: 800; color: #1a1a2e; }
    .q-chip {
      font-size: 12px !important;
      font-weight: 700 !important;
      background: linear-gradient(135deg, #e91e63, #9c27b0) !important;
      color: white !important;
      padding: 2px 12px !important;
      border-radius: 10px !important;
    }
    .quarter-stats { display: flex; gap: 20px; margin-bottom: 14px; }
    .q-stat { display: flex; align-items: center; gap: 8px; }
    .q-stat mat-icon { font-size: 18px; width: 18px; height: 18px; color: #9ca3af; }
    .q-stat div { display: flex; flex-direction: column; }
    .q-val { font-size: 18px; font-weight: 700; color: #1a1a2e; }
    .q-val.negative { color: #ef4444; }
    .q-lbl { font-size: 11px; color: #b0b8c4; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
    .quarter-value { font-size: 13px; color: #6b7280; margin-bottom: 14px; }
    .quarter-bar { display: flex; height: 8px; border-radius: 6px; overflow: hidden; background: #f0f0f0; }
    .bar-in { background: linear-gradient(90deg, #e91e63, #f48fb1); transition: width 0.6s cubic-bezier(.4,0,.2,1); }
    .bar-out { background: linear-gradient(90deg, #9c27b0, #ce93d8); transition: width 0.6s cubic-bezier(.4,0,.2,1); }
    .bar-legend { display: flex; gap: 16px; margin-top: 8px; font-size: 11px; color: #b0b8c4; font-weight: 600; }
    .legend-in { color: #e91e63; }
    .legend-out { color: #9c27b0; }

    /* ── Table ── */
    .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; flex-wrap: wrap; gap: 12px; }
    .table-filters { display: flex; gap: 10px; }
    .filter-select {
      padding: 10px 16px;
      border: 1.5px solid #e5e7eb;
      border-radius: 12px;
      font-size: 13px;
      background: white;
      outline: none;
      font-family: inherit;
      cursor: pointer;
      transition: border-color 0.2s;
    }
    .filter-select:focus { border-color: #e91e63; }

    .table-wrap {
      overflow-x: auto;
      border-radius: 16px;
      border: 1px solid #eee;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
    }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table thead { background: linear-gradient(180deg, #fafafa, #f5f5f5); }
    .data-table th {
      padding: 12px 14px;
      text-align: left;
      font-weight: 700;
      color: #374151;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 2px solid #eee;
      white-space: nowrap;
    }
    .data-table td { padding: 12px 14px; border-bottom: 1px solid #f5f5f5; color: #374151; }
    .data-table tbody tr { transition: background 0.15s; }
    .data-table tbody tr:hover { background: #fef2f7; }
    .data-table .right { text-align: right; }
    .data-table .center { text-align: center; }
    .data-table .amount { font-weight: 700; color: #059669; }
    .data-table .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .data-table .vendor-cell { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .data-table .notes-cell { max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #6b7280; font-size: 12px; }
    .total-row { background: #fdf2f8; font-weight: 600; }
    .total-row td { border-top: 2px solid #fce7f3; padding: 14px; }
    .sortable { cursor: pointer; user-select: none; transition: color 0.15s; }
    .sortable:hover { color: #e91e63; }
    .sort-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; }
    .q-badge {
      background: linear-gradient(135deg, #fce4ec, #f8bbd0);
      color: #880e4f;
      padding: 3px 10px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
    }

    /* ── Warehouse ── */
    .warehouse-grid { display: flex; flex-direction: column; gap: 28px; }
    .wh-section h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; color: #1a1a2e; margin: 0 0 14px; }
    .wh-section h3 mat-icon { font-size: 20px; width: 20px; height: 20px; color: #e91e63; }
    .wh-cards { display: flex; gap: 14px; flex-wrap: wrap; }
    .wh-card {
      background: white;
      border: 1px solid #eee;
      border-radius: 18px;
      padding: 20px 28px;
      min-width: 160px;
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .wh-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .wh-card.damaged { border-color: #fbbf24; background: #fffbeb; }
    .wh-card.wh-total {
      background: linear-gradient(135deg, #fce4ec, #f3e5f5);
      border-color: #f8bbd0;
    }
    .wh-name { font-size: 12px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .wh-qty { font-size: 30px; font-weight: 800; color: #1a1a2e; }
    .wh-uom { font-size: 11px; color: #b0b8c4; font-weight: 600; }
    .wh-damaged { margin-top: 8px; display: flex; align-items: center; gap: 4px; font-size: 12px; color: #d97706; justify-content: center; }
    .wh-damaged mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .variance-section {
      background: white;
      border-radius: 18px;
      padding: 24px;
      border: 1px solid #eee;
      box-shadow: 0 1px 4px rgba(0,0,0,0.03);
    }
    .variance-grid { display: flex; flex-direction: column; gap: 12px; }
    .variance-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; }
    .variance-item.highlight { padding: 14px 0; }
    .var-label { font-size: 14px; color: #374151; font-weight: 500; }
    .var-value { font-size: 17px; font-weight: 800; color: #1a1a2e; }
    .var-value.warn { color: #d97706; }
    .var-value.negative { color: #ef4444; }

    /* ── Vendor Cards ── */
    .vendor-cards { display: flex; flex-direction: column; gap: 14px; }
    .vendor-card {
      display: flex;
      align-items: center;
      gap: 16px;
      background: white;
      border-radius: 18px;
      padding: 20px 24px;
      border: 1px solid #eee;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .vendor-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .vendor-rank {
      font-size: 22px;
      font-weight: 800;
      min-width: 40px;
      text-align: center;
      background: linear-gradient(135deg, #e91e63, #9c27b0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .vendor-info { flex: 1; }
    .vendor-info h4 { margin: 0 0 6px; font-size: 15px; font-weight: 700; color: #1a1a2e; }
    .vendor-stats { display: flex; gap: 20px; flex-wrap: wrap; }
    .vs { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #6b7280; }
    .vs mat-icon { font-size: 16px; width: 16px; height: 16px; color: #b0b8c4; }
    .vendor-bar { width: 120px; height: 8px; background: #f0f0f0; border-radius: 6px; overflow: hidden; flex-shrink: 0; }
    .vb-fill { height: 100%; background: linear-gradient(90deg, #e91e63, #9c27b0); border-radius: 6px; transition: width 0.6s cubic-bezier(.4,0,.2,1); }

    /* ── Invoices & Credit Notes ── */
    .inv-credit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .ic-section h3 { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 800; color: #1a1a2e; margin: 0 0 14px; }
    .ic-section h3 mat-icon { font-size: 20px; width: 20px; height: 20px; color: #e91e63; }
    .ic-section.credits h3 mat-icon { color: #ef4444; }
    .ic-list { display: flex; flex-direction: column; gap: 8px; }
    .ic-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      background: white;
      border-radius: 14px;
      border: 1px solid #eee;
      transition: background 0.15s, transform 0.15s;
    }
    .ic-item:hover { background: #fef2f7; transform: translateX(2px); }
    .ic-ref { font-weight: 700; color: #374151; min-width: 100px; }
    .ic-date { font-size: 12px; color: #6b7280; min-width: 100px; }
    .ic-desc { font-size: 12px; color: #b0b8c4; flex: 1; }
    .ic-empty { color: #b0b8c4; font-size: 13px; padding: 20px; text-align: center; }

    /* ── Request Delivery Button ── */
    .request-delivery-btn {
      background: linear-gradient(135deg, #ff6b6b, #ee5a24) !important;
      color: white !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      border-radius: 12px !important;
      font-weight: 700 !important;
      transition: all 0.2s !important;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .request-delivery-btn:hover {
      background: linear-gradient(135deg, #ff8787, #f0631a) !important;
      transform: translateY(-1px);
      box-shadow: 0 4px 14px rgba(238,90,36,0.4) !important;
    }

    /* ── Delivery Dialog ── */
    .dlg-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(4px);
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
      background: white;
      border-radius: 24px;
      box-shadow: 0 24px 80px rgba(0,0,0,0.18);
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
      padding: 24px 28px;
      background: linear-gradient(135deg, #e91e63, #9c27b0);
      border-radius: 24px 24px 0 0;
    }
    .dlg-title-group {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .dlg-icon-ring {
      width: 48px;
      height: 48px;
      border-radius: 16px;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .dlg-icon-ring mat-icon {
      color: white;
      font-size: 26px;
      width: 26px;
      height: 26px;
    }
    .dlg-title {
      margin: 0;
      font-size: 20px;
      font-weight: 800;
      color: white;
    }
    .dlg-subtitle {
      margin: 2px 0 0;
      font-size: 13px;
      color: rgba(255,255,255,0.7);
    }
    .dlg-close {
      background: rgba(255,255,255,0.15);
      border: none;
      border-radius: 12px;
      width: 40px;
      height: 40px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s;
    }
    .dlg-close:hover { background: rgba(255,255,255,0.25); }
    .dlg-close mat-icon { color: white; }
    .dlg-body { padding: 28px; }

    /* ── Dialog Form ── */
    .dlg-form { display: flex; flex-direction: column; gap: 18px; }
    .dlg-row { display: flex; gap: 14px; }
    .dlg-row.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .dlg-row .dlg-field { flex: 1; }
    .dlg-field { display: flex; flex-direction: column; gap: 5px; }
    .dlg-label {
      font-size: 11px;
      font-weight: 700;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .dlg-label .req { color: #ef4444; }
    .dlg-label .opt { color: #b0b8c4; font-weight: 500; text-transform: none; font-size: 11px; }
    .dlg-input, .dlg-select {
      padding: 11px 16px;
      border: 1.5px solid #e5e7eb;
      border-radius: 12px;
      font-size: 14px;
      color: #1a1a2e;
      background: white;
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .dlg-input:focus, .dlg-select:focus {
      border-color: #e91e63;
      box-shadow: 0 0 0 3px rgba(233,30,99,0.08);
    }
    .dlg-input::placeholder { color: #b0b8c4; }
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
      color: #b0b8c4;
      font-size: 20px;
      width: 20px;
      height: 20px;
      z-index: 1;
    }
    .address-input {
      padding-left: 40px !important;
      padding-right: 40px !important;
    }
    .address-verified {
      position: absolute;
      right: 12px;
      color: #10b981;
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
      font-size: 12px;
      color: #10b981;
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
      background: #fef2f7;
      border: 1px solid #fce4ec;
      border-radius: 14px;
      font-size: 13px;
      color: #1a1a2e;
    }
    .dlg-preview mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #e91e63;
    }

    /* ── Dialog Actions ── */
    .dlg-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid #f0f0f0;
    }
    .dlg-actions button { border-radius: 12px !important; font-weight: 600 !important; }
    .btn-submit-delivery {
      background: linear-gradient(135deg, #e91e63, #9c27b0) !important;
      color: white !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 8px 22px !important;
    }
    .btn-submit-delivery:disabled { opacity: 0.5 !important; }

    /* ── Dialog Success ── */
    .dlg-success {
      text-align: center;
      padding: 28px 0;
    }
    .dlg-success-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 16px;
    }
    .dlg-success-icon mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: #4caf50;
    }
    .dlg-success h3 {
      color: #1a1a2e;
      font-weight: 700;
      font-size: 18px;
      margin: 0 0 6px;
    }
    .dlg-success p {
      color: #6b7280;
      margin: 0 0 20px;
      font-size: 14px;
    }
    .dlg-success-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
    }
    .btn-another {
      background: linear-gradient(135deg, #e91e63, #9c27b0) !important;
      color: white !important;
      border-radius: 12px !important;
      font-weight: 700 !important;
    }

    /* ── Dialog Error ── */
    .dlg-error {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 12px;
      color: #ef4444;
      font-size: 13px;
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
      .hero-header { padding: 20px 24px; }
      .hero-text h1 { font-size: 20px; }
    }
    @media (max-width: 480px) {
      .kpi-row { grid-template-columns: 1fr; }
      .pads-dashboard { padding: 0 12px 24px; }
    }
  `]
})
export class SanitaryPadsDashboardComponent implements OnInit {
  @Output() goBack = new EventEmitter<void>();
  @ViewChild('addressInput') addressInputRef!: ElementRef<HTMLInputElement>;

  loading = true;
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
  addressVerified = false;
  private autocomplete: google.maps.places.Autocomplete | null = null;
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
    private snackBar: MatSnackBar,
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
        this.snackBar.open('Failed to load dashboard', 'Close', { duration: 3000 });
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
      error: () => this.snackBar.open('Failed to load stock received', 'Close', { duration: 3000 })
    });
  }

  loadStockDelivered(): void {
    this.padsService.getStockDelivered().subscribe({
      next: (res) => this.stockDeliveredList = res.items,
      error: () => {}
    });
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

  private initGooglePlaces(): void {
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

  deleteGrn(id: number): void {
    if (!confirm('Delete this GRN record?')) return;
    this.padsService.deleteStockReceived(id).subscribe({
      next: () => {
        this.snackBar.open('GRN deleted', 'Close', { duration: 2000 });
        this.loadDashboard();
        this.loadStockReceived();
      },
      error: () => this.snackBar.open('Failed to delete', 'Close', { duration: 3000 })
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
    .grn-dialog { padding: 32px; }
    .dialog-header { text-align: center; margin-bottom: 24px; }
    .header-icon {
      font-size: 40px; width: 40px; height: 40px;
      background: linear-gradient(135deg, #e91e63, #9c27b0);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .dialog-header h2 { margin: 10px 0 0; font-size: 22px; font-weight: 800; color: #1a1a2e; }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group.full-width { grid-column: 1 / -1; }
    .form-group label { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.5px; }
    .form-input {
      padding: 11px 16px; border: 1.5px solid #e5e7eb; border-radius: 12px;
      font-size: 14px; outline: none; background: white; font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .form-input:focus { border-color: #e91e63; box-shadow: 0 0 0 3px rgba(233,30,99,0.08); }
    .dialog-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 8px; border-top: 1px solid #f0f0f0; }
    .dialog-actions button { border-radius: 12px !important; font-weight: 600 !important; }
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
