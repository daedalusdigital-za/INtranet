import { Component, OnInit, OnDestroy, Output, EventEmitter, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  HBA1CService,
  HBA1CProjectDashboard,
  HBA1CTrainingSession,
  HBA1CInventoryItem,
  HBA1CSale,
  HBA1CCreditNote,
  HBA1CProvincialSalesData,
  HBA1CTopProduct,
  HBA1CProvinceBreakdown,
  HBA1CEquipmentDistribution,
  HBA1CTrainer
} from '../../../services/hba1c.service';

@Component({
  selector: 'app-hba1c-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatTableModule,
    MatSortModule,
    MatBadgeModule,
    MatDividerModule,
    FormsModule
  ],
  template: `
    <!-- Hero Header -->
    <div class="hero-header">
      <div class="hero-bg"></div>
      <div class="hero-content">
        <button mat-button (click)="goBack.emit()" class="back-btn">
          <mat-icon>arrow_back</mat-icon> Back to Projects
        </button>
        <div class="hero-title-block">
          <div class="hero-icon-ring">
            <mat-icon>biotech</mat-icon>
          </div>
          <div class="hero-text">
            <h1>HBA1C Medical Management</h1>
            <p>National training, inventory & sales dashboard</p>
          </div>
        </div>
        <div class="hero-actions">
          <div class="connection-pill" [class.connected]="isConnected" [class.error]="!isConnected && !loading">
            <span class="conn-dot"></span>
            <span>{{ loading ? 'Connecting...' : isConnected ? 'Live' : 'Offline' }}</span>
          </div>
          @if (!loading && isConnected) {
            <button mat-flat-button class="request-delivery-btn" (click)="openDeliveryDialog()">
              <mat-icon>local_shipping</mat-icon> Request Delivery
            </button>
            <button mat-flat-button class="refresh-btn" (click)="loadDashboard()" matTooltip="Refresh all data">
              <mat-icon>refresh</mat-icon> Refresh
            </button>
          }
        </div>
      </div>
    </div>

    @if (loading) {
      <div class="loading-state">
        <div class="loading-card">
          <div class="lc-icon-wrap pulse-ring">
            <mat-icon class="lc-icon">biotech</mat-icon>
          </div>
          <h3>Connecting to HBA1C API</h3>
          <p class="lc-subtitle">Fetching live data from the medical management system</p>

          <!-- Progress bar -->
          <div class="lc-progress-wrap">
            <div class="lc-progress-track">
              <div class="lc-progress-fill" [style.width.%]="loadingProgress"></div>
            </div>
            <div class="lc-progress-info">
              <span class="lc-progress-message">{{ loadingMessage }}</span>
              <span class="lc-progress-pct">{{ loadingProgress | number:'1.0-0' }}%</span>
            </div>
          </div>

          <!-- Step indicators -->
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
    } @else if (error) {
      <div class="error-state">
        <div class="error-card">
          <div class="error-icon-wrap">
            <mat-icon>cloud_off</mat-icon>
          </div>
          <h3>Unable to connect</h3>
          <p>{{ error }}</p>
          <button mat-flat-button color="primary" (click)="loadDashboard()">
            <mat-icon>refresh</mat-icon> Try Again
          </button>
        </div>
      </div>
    } @else {
      <!-- KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card kpi-blue clickable" (click)="openKpiDialog('training')">
          <div class="kpi-glow"></div>
          <div class="kpi-icon-wrap"><mat-icon>school</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.trainingStats?.totalSessions || 0 | number }}</span>
            <span class="kpi-label">Training Sessions</span>
          </div>
          <span class="kpi-sub">{{ dashboard?.trainingStats?.completedSessions || 0 }} completed</span>
        </div>
        <div class="kpi-card kpi-green clickable" (click)="openKpiDialog('participants')">
          <div class="kpi-glow"></div>
          <div class="kpi-icon-wrap"><mat-icon>groups</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.trainingStats?.totalParticipants || 0 | number }}</span>
            <span class="kpi-label">Participants</span>
          </div>
          <span class="kpi-sub">Across all provinces</span>
        </div>
        <div class="kpi-card kpi-orange clickable" (click)="openKpiDialog('trainers')">
          <div class="kpi-glow"></div>
          <div class="kpi-icon-wrap"><mat-icon>person</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.nationalTotals?.totalTrainers || 0 | number }}</span>
            <span class="kpi-label">Trainers</span>
          </div>
          <span class="kpi-sub">Active trainers</span>
        </div>
        <div class="kpi-card kpi-purple clickable" (click)="openKpiDialog('deliveries')">
          <div class="kpi-glow"></div>
          <div class="kpi-icon-wrap"><mat-icon>local_shipping</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.nationalTotals?.totalDeliveries || 0 | number }}</span>
            <span class="kpi-label">Deliveries</span>
          </div>
          <span class="kpi-sub">Equipment deliveries</span>
        </div>
        <div class="kpi-card kpi-teal clickable" (click)="openKpiDialog('revenue')">
          <div class="kpi-glow"></div>
          <div class="kpi-icon-wrap"><mat-icon>point_of_sale</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">R{{ dashboard?.salesStats?.totalRevenue || 0 | number:'1.0-0' }}</span>
            <span class="kpi-label">Total Revenue</span>
          </div>
          <span class="kpi-sub">{{ dashboard?.salesStats?.totalSales || 0 }} sales</span>
        </div>
        <div class="kpi-card kpi-red clickable" (click)="openKpiDialog('inventory')">
          <div class="kpi-glow"></div>
          <div class="kpi-icon-wrap"><mat-icon>inventory_2</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.inventoryStats?.totalItems || 0 | number }}</span>
            <span class="kpi-label">Inventory Items</span>
          </div>
          <span class="kpi-sub">{{ dashboard?.inventoryStats?.lowStockItems || 0 }} low stock</span>
        </div>
      </div>

      <!-- ==================== KPI DETAIL DIALOG ==================== -->
      @if (activeDialog) {
        <div class="dialog-backdrop" (click)="closeDialog()"></div>
        <div class="dialog-panel" [class]="'dialog-' + activeDialog">
          <div class="dialog-header" [class]="'dh-' + activeDialog">
            <div class="dialog-title-group">
              <div class="dialog-icon-ring">
                @switch (activeDialog) {
                  @case ('training') { <mat-icon>school</mat-icon> }
                  @case ('participants') { <mat-icon>groups</mat-icon> }
                  @case ('trainers') { <mat-icon>person</mat-icon> }
                  @case ('deliveries') { <mat-icon>local_shipping</mat-icon> }
                  @case ('revenue') { <mat-icon>point_of_sale</mat-icon> }
                  @case ('inventory') { <mat-icon>inventory_2</mat-icon> }
                }
              </div>
              <div>
                <h2 class="dialog-title">
                  @switch (activeDialog) {
                    @case ('training') { Training Sessions }
                    @case ('participants') { Participants }
                    @case ('trainers') { Trainers }
                    @case ('deliveries') { Deliveries }
                    @case ('revenue') { Revenue Breakdown }
                    @case ('inventory') { Inventory Items }
                  }
                </h2>
                <p class="dialog-subtitle">
                  @switch (activeDialog) {
                    @case ('training') { Breakdown by province and status }
                    @case ('participants') { Participants across all provinces }
                    @case ('trainers') { Active trainers and their assignments }
                    @case ('deliveries') { Equipment delivery overview }
                    @case ('revenue') { Sales revenue analysis }
                    @case ('inventory') { Stock levels and categories }
                  }
                </p>
              </div>
            </div>
            <button class="dialog-close" (click)="closeDialog()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <div class="dialog-body">
            @if (dialogLoading) {
              <div class="dialog-loading">
                <mat-spinner diameter="36" strokeWidth="3"></mat-spinner>
                <p>Loading data...</p>
              </div>
            } @else {

              <!-- ── Training Sessions Dialog ── -->
              @if (activeDialog === 'training') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat blue">
                    <span class="ds-val">{{ dashboard?.trainingStats?.totalSessions || 0 }}</span>
                    <span class="ds-lbl">Total Sessions</span>
                  </div>
                  <div class="dialog-stat green">
                    <span class="ds-val">{{ dashboard?.trainingStats?.completedSessions || 0 }}</span>
                    <span class="ds-lbl">Completed</span>
                  </div>
                  <div class="dialog-stat orange">
                    <span class="ds-val">{{ dashboard?.trainingStats?.inProgressSessions || 0 }}</span>
                    <span class="ds-lbl">In Progress</span>
                  </div>
                  <div class="dialog-stat purple">
                    <span class="ds-val">{{ dashboard?.trainingStats?.completionRate || 0 | number:'1.1-1' }}%</span>
                    <span class="ds-lbl">Completion Rate</span>
                  </div>
                </div>
                <h4 class="dialog-section-title"><mat-icon>map</mat-icon> By Province</h4>
                <div class="dialog-table-wrap">
                  <table class="dialog-table">
                    <thead><tr><th>Province</th><th class="right">Sessions</th><th class="right">Participants</th><th class="right">Trainers</th></tr></thead>
                    <tbody>
                      @for (p of dashboard?.provinceStats || []; track p.province) {
                        <tr>
                          <td class="primary-cell">{{ p.province }}</td>
                          <td class="right mono-text">{{ p.sessions }}</td>
                          <td class="right mono-text">{{ p.participants | number }}</td>
                          <td class="right mono-text">{{ p.trainers }}</td>
                        </tr>
                      }
                    </tbody>
                    <tfoot>
                      <tr class="total-row">
                        <td><strong>Total</strong></td>
                        <td class="right mono-text"><strong>{{ getTotalSessions() }}</strong></td>
                        <td class="right mono-text"><strong>{{ getTotalParticipants() | number }}</strong></td>
                        <td class="right mono-text"><strong>{{ dashboard?.nationalTotals?.totalTrainers || 0 }}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              }

              <!-- ── Participants Dialog ── -->
              @if (activeDialog === 'participants') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat green">
                    <span class="ds-val">{{ dashboard?.trainingStats?.totalParticipants || 0 | number }}</span>
                    <span class="ds-lbl">Total Participants</span>
                  </div>
                  <div class="dialog-stat blue">
                    <span class="ds-val">{{ dashboard?.trainingStats?.totalSessions || 0 }}</span>
                    <span class="ds-lbl">Sessions</span>
                  </div>
                  <div class="dialog-stat purple">
                    <span class="ds-val">{{ getAvgParticipants() | number:'1.0-0' }}</span>
                    <span class="ds-lbl">Avg per Session</span>
                  </div>
                </div>
                <h4 class="dialog-section-title"><mat-icon>bar_chart</mat-icon> By Province</h4>
                <div class="dialog-province-bars">
                  @for (p of dashboard?.provinceStats || []; track p.province) {
                    <div class="bar-row">
                      <span class="bar-label">{{ p.province }}</span>
                      <div class="bar-track">
                        <div class="bar-fill green-fill" [style.width.%]="getParticipantPercent(p.participants)"></div>
                      </div>
                      <span class="bar-value">{{ p.participants | number }}</span>
                    </div>
                  }
                </div>
              }

              <!-- ── Trainers Dialog ── -->
              @if (activeDialog === 'trainers') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat orange">
                    <span class="ds-val">{{ dialogTrainers.length || dashboard?.nationalTotals?.totalTrainers || 0 }}</span>
                    <span class="ds-lbl">Total Trainers</span>
                  </div>
                  <div class="dialog-stat blue">
                    <span class="ds-val">{{ dashboard?.trainingStats?.totalSessions || 0 }}</span>
                    <span class="ds-lbl">Total Sessions</span>
                  </div>
                  <div class="dialog-stat green">
                    <span class="ds-val">{{ getAvgSessionsPerTrainer() | number:'1.0-0' }}</span>
                    <span class="ds-lbl">Avg Sessions / Trainer</span>
                  </div>
                </div>
                @if (dialogTrainers.length) {
                  <h4 class="dialog-section-title"><mat-icon>badge</mat-icon> Trainer Directory</h4>
                  <div class="trainer-cards-grid">
                    @for (t of dialogTrainers; track t.id; let i = $index) {
                      <div class="trainer-card">
                        <div class="trainer-avatar" [class]="'ta-' + (i % 5)">
                          {{ (t.firstName || '?')[0] }}{{ (t.lastName || '?')[0] }}
                        </div>
                        <div class="trainer-info">
                          <span class="trainer-name">{{ t.firstName }} {{ t.lastName }}</span>
                          <span class="trainer-detail">{{ t.specialization || 'HBA1C Trainer' }}</span>
                          @if (t.email) { <span class="trainer-detail">{{ t.email }}</span> }
                          @if (t.phone) { <span class="trainer-detail">{{ t.phone }}</span> }
                        </div>
                        <div class="trainer-badge" [class.active]="t.isActive" [class.inactive]="!t.isActive">
                          {{ t.isActive ? 'Active' : 'Inactive' }}
                        </div>
                      </div>
                    }
                  </div>
                }
              }

              <!-- ── Deliveries Dialog ── -->
              @if (activeDialog === 'deliveries') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat purple">
                    <span class="ds-val">{{ dashboard?.nationalTotals?.totalDeliveries || 0 | number }}</span>
                    <span class="ds-lbl">Total Deliveries</span>
                  </div>
                  <div class="dialog-stat blue">
                    <span class="ds-val">{{ dashboard?.nationalTotals?.totalSales || 0 | number }}</span>
                    <span class="ds-lbl">Total Orders</span>
                  </div>
                </div>
                @if (dashboard?.equipmentStats?.length) {
                  <h4 class="dialog-section-title"><mat-icon>precision_manufacturing</mat-icon> Equipment Order Summary</h4>
                  <div class="dialog-table-wrap">
                    <table class="dialog-table">
                      <thead><tr><th>Equipment</th><th class="right">Orders</th><th class="right">Qty</th><th class="right">Value</th></tr></thead>
                      <tbody>
                        @for (e of dashboard?.equipmentStats || []; track e.equipmentType) {
                          <tr>
                            <td class="primary-cell">{{ e.equipmentType }}</td>
                            <td class="right mono-text">{{ e.totalOrdered | number }}</td>
                            <td class="right mono-text">{{ getItemBreakdownTotal(e, 'qty') | number }}</td>
                            <td class="right mono-text">R{{ e.totalOrderValue | number:'1.0-0' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                } @else {
                  <div class="dialog-empty"><mat-icon>local_shipping</mat-icon><p>No delivery data available</p></div>
                }
              }

              <!-- ── Revenue Dialog ── -->
              @if (activeDialog === 'revenue') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat teal">
                    <span class="ds-val">R{{ dashboard?.salesStats?.totalRevenue || 0 | number:'1.0-0' }}</span>
                    <span class="ds-lbl">Total Revenue</span>
                  </div>
                  <div class="dialog-stat blue">
                    <span class="ds-val">{{ dashboard?.salesStats?.totalSales || 0 | number }}</span>
                    <span class="ds-lbl">Total Sales</span>
                  </div>
                  <div class="dialog-stat green">
                    <span class="ds-val">R{{ dashboard?.salesStats?.averageOrderValue || 0 | number:'1.0-0' }}</span>
                    <span class="ds-lbl">Avg Order Value</span>
                  </div>
                  <div class="dialog-stat orange">
                    <span class="ds-val">R{{ dashboard?.salesStats?.monthlyRevenue || 0 | number:'1.0-0' }}</span>
                    <span class="ds-lbl">Monthly Revenue</span>
                  </div>
                </div>
                <div class="dialog-split">
                  <div class="dialog-split-half">
                    <h4 class="dialog-section-title"><mat-icon>emoji_events</mat-icon> Top Products</h4>
                    @for (tp of dashboard?.topProducts || []; track tp.productId; let i = $index) {
                      <div class="top-product-row">
                        <span class="tp-rank" [class]="'rank-' + (i < 3 ? i : 'rest')">{{ i + 1 }}</span>
                        <div class="tp-info">
                          <span class="tp-name">{{ tp.productName }}</span>
                          <span class="tp-sub">{{ tp.quantitySold | number }} units · {{ tp.orderCount }} orders</span>
                        </div>
                        <span class="tp-rev">R{{ tp.revenue | number:'1.0-0' }}</span>
                      </div>
                    }
                  </div>
                  <div class="dialog-split-half">
                    <h4 class="dialog-section-title"><mat-icon>pie_chart</mat-icon> Order Status</h4>
                    <div class="status-donut-row">
                      <div class="donut-stat">
                        <div class="donut-circle green-ring">{{ dashboard?.salesStats?.completedOrders || 0 }}</div>
                        <span>Completed</span>
                      </div>
                      <div class="donut-stat">
                        <div class="donut-circle orange-ring">{{ dashboard?.salesStats?.pendingOrders || 0 }}</div>
                        <span>Pending</span>
                      </div>
                    </div>
                  </div>
                </div>
              }

              <!-- ── Inventory Dialog ── -->
              @if (activeDialog === 'inventory') {
                <div class="dialog-stats-row">
                  <div class="dialog-stat red">
                    <span class="ds-val">{{ dashboard?.inventoryStats?.totalItems || 0 }}</span>
                    <span class="ds-lbl">Total Items</span>
                  </div>
                  <div class="dialog-stat green">
                    <span class="ds-val">{{ dashboard?.inventoryStats?.inStockItems || 0 }}</span>
                    <span class="ds-lbl">In Stock</span>
                  </div>
                  <div class="dialog-stat orange">
                    <span class="ds-val">{{ dashboard?.inventoryStats?.lowStockItems || 0 }}</span>
                    <span class="ds-lbl">Low Stock</span>
                  </div>
                  <div class="dialog-stat purple">
                    <span class="ds-val">R{{ dashboard?.inventoryStats?.totalValue || 0 | number:'1.0-0' }}</span>
                    <span class="ds-lbl">Total Value</span>
                  </div>
                </div>
                @if (dashboard?.inventoryStats?.categoryStats?.length) {
                  <h4 class="dialog-section-title"><mat-icon>category</mat-icon> By Category</h4>
                  <div class="dialog-table-wrap">
                    <table class="dialog-table">
                      <thead><tr><th>Category</th><th class="right">Items</th><th class="right">Value</th></tr></thead>
                      <tbody>
                        @for (c of dashboard?.inventoryStats?.categoryStats || []; track c.category) {
                          <tr>
                            <td class="primary-cell">{{ c.categoryName || 'Category ' + c.category }}</td>
                            <td class="right mono-text">{{ c.itemCount }}</td>
                            <td class="right mono-text">R{{ c.totalValue | number:'1.0-0' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
                @if (dashboard?.lowStockItems?.length) {
                  <h4 class="dialog-section-title warn-title"><mat-icon>warning</mat-icon> Low Stock Alerts</h4>
                  <div class="dialog-table-wrap">
                    <table class="dialog-table">
                      <thead><tr><th>Item</th><th>SKU</th><th class="right">Available</th><th class="right">Reorder Level</th></tr></thead>
                      <tbody>
                        @for (item of dashboard?.lowStockItems || []; track item.id) {
                          <tr class="low-stock-row">
                            <td class="primary-cell">{{ item.name }}</td>
                            <td class="mono-text">{{ item.sku }}</td>
                            <td class="right mono-text danger-val">{{ item.stockAvailable }}</td>
                            <td class="right mono-text">{{ item.reorderLevel }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }
            }
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
                    <input type="text" class="dlg-input" [(ngModel)]="deliveryForm.description" placeholder="e.g. HBA1C testing kits for Gauteng clinics">
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
                      <option value="KITS">KITS</option>
                    </select>
                  </div>
                </div>

                <div class="dlg-row two-col">
                  <div class="dlg-field">
                    <label class="dlg-label">Invoice Number <span class="opt">(optional)</span></label>
                    <input type="text" class="dlg-input" [(ngModel)]="deliveryForm.invoiceNumber" placeholder="e.g. INV-001234">
                  </div>
                  <div class="dlg-field">
                    <label class="dlg-label">Reference <span class="opt">(optional)</span></label>
                    <input type="text" class="dlg-input" [(ngModel)]="deliveryForm.reference" placeholder="e.g. PO-2026-001">
                  </div>
                </div>

                <div class="dlg-row">
                  <div class="dlg-field">
                    <label class="dlg-label">Delivery Address <span class="opt">(optional)</span></label>
                    <div class="address-input-wrap">
                      <mat-icon class="address-loc-icon">location_on</mat-icon>
                      <input #deliveryAddressInput type="text" class="dlg-input address-input"
                             [(ngModel)]="deliveryForm.deliveryAddress"
                             placeholder="Start typing an address..." autocomplete="off">
                      @if (addressVerified) {
                        <mat-icon class="address-verified">verified</mat-icon>
                      }
                    </div>
                    @if (addressVerified) {
                      <span class="address-confirmed-text">✓ Address verified via Google</span>
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
                      <strong>{{ deliveryForm.quantity }} {{ deliveryForm.unitOfMeasure }}</strong> &mdash;
                      {{ deliveryForm.description }}
                      @if (deliveryForm.invoiceNumber) { ({{ deliveryForm.invoiceNumber }}) }
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

      <!-- Tabs -->
      <div class="tabs-wrapper">

      <!-- ==================== CRUD EDIT DIALOG ==================== -->
      @if (showEditDialog) {
        <div class="dlg-backdrop" (click)="closeEditDialog()"></div>
        <div class="dlg-panel crud-panel">
          <div class="dlg-header">
            <div class="dlg-title-group">
              <div class="dlg-icon-ring">
                @switch (editEntity) {
                  @case ('training') { <mat-icon>school</mat-icon> }
                  @case ('inventory') { <mat-icon>inventory_2</mat-icon> }
                  @case ('sale') { <mat-icon>point_of_sale</mat-icon> }
                  @case ('creditNote') { <mat-icon>receipt</mat-icon> }
                }
              </div>
              <div>
                <h2 class="dlg-title">{{ editMode === 'create' ? 'Add' : 'Edit' }}
                  @switch (editEntity) {
                    @case ('training') { Training Session }
                    @case ('inventory') { Inventory Item }
                    @case ('sale') { Sale }
                    @case ('creditNote') { Credit Note }
                  }
                </h2>
                <p class="dlg-subtitle">{{ editMode === 'create' ? 'Create a new record' : 'Update existing record' }}</p>
              </div>
            </div>
            <button class="dlg-close" (click)="closeEditDialog()"><mat-icon>close</mat-icon></button>
          </div>

          <div class="dlg-body">
            @if (editError) {
              <div class="dlg-error"><mat-icon>error_outline</mat-icon><span>{{ editError }}</span></div>
            }

            @if (editSuccess) {
              <div class="dlg-success">
                <div class="dlg-success-icon"><mat-icon>check_circle</mat-icon></div>
                <h3>{{ editMode === 'create' ? 'Created' : 'Updated' }} Successfully!</h3>
                <p>The record has been saved.</p>
                <div class="dlg-success-actions">
                  <button mat-flat-button class="btn-another" (click)="closeEditDialog()"><mat-icon>close</mat-icon> Close</button>
                </div>
              </div>
            } @else {
              <div class="dlg-form">

                <!-- ── Training Form ── -->
                @if (editEntity === 'training') {
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Training Name <span class="req">*</span></label>
                      <input type="text" class="dlg-input" [(ngModel)]="trainingForm.trainingName" placeholder="e.g. HBA1C Level 1 Training">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Training Type <span class="req">*</span></label>
                      <select class="dlg-select" [(ngModel)]="trainingForm.trainingType">
                        <option value="">Select type...</option>
                        <option value="Initial">Initial</option>
                        <option value="Refresher">Refresher</option>
                        <option value="Advanced">Advanced</option>
                        <option value="Workshop">Workshop</option>
                      </select>
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Province <span class="req">*</span></label>
                      <select class="dlg-select" [(ngModel)]="trainingForm.provinceId">
                        <option [ngValue]="0">Select province...</option>
                        <option [ngValue]="1">Eastern Cape</option>
                        <option [ngValue]="2">Free State</option>
                        <option [ngValue]="3">Gauteng</option>
                        <option [ngValue]="4">KwaZulu-Natal</option>
                        <option [ngValue]="5">Limpopo</option>
                        <option [ngValue]="6">Mpumalanga</option>
                        <option [ngValue]="7">North West</option>
                        <option [ngValue]="8">Northern Cape</option>
                        <option [ngValue]="9">Western Cape</option>
                      </select>
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Start Date <span class="req">*</span></label>
                      <input type="date" class="dlg-input" [(ngModel)]="trainingForm.startDate">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Venue</label>
                      <input type="text" class="dlg-input" [(ngModel)]="trainingForm.venue" placeholder="Training venue">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Target Audience</label>
                      <input type="text" class="dlg-input" [(ngModel)]="trainingForm.targetAudience" placeholder="e.g. Healthcare Workers">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Participants <span class="req">*</span></label>
                      <input type="number" class="dlg-input" [(ngModel)]="trainingForm.numberOfParticipants" min="1">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Status</label>
                      <select class="dlg-select" [(ngModel)]="trainingForm.status">
                        <option [ngValue]="0">Scheduled</option>
                        <option [ngValue]="1">In Progress</option>
                        <option [ngValue]="2">Completed</option>
                        <option [ngValue]="3">Cancelled</option>
                      </select>
                    </div>
                  </div>
                }

                <!-- ── Inventory Form ── -->
                @if (editEntity === 'inventory') {
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Item Name <span class="req">*</span></label>
                      <input type="text" class="dlg-input" [(ngModel)]="inventoryForm.name" placeholder="e.g. HBA1C Test Strips">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">SKU</label>
                      <input type="text" class="dlg-input" [(ngModel)]="inventoryForm.sku" placeholder="e.g. HBA-TS-001">
                    </div>
                  </div>
                  <div class="dlg-row">
                    <div class="dlg-field">
                      <label class="dlg-label">Description</label>
                      <input type="text" class="dlg-input" [(ngModel)]="inventoryForm.description" placeholder="Item description">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Category</label>
                      <select class="dlg-select" [(ngModel)]="inventoryForm.category">
                        <option [ngValue]="0">Select category...</option>
                        <option [ngValue]="1">HemoglobinTesting</option>
                        <option [ngValue]="2">GlucoseTesting</option>
                        <option [ngValue]="3">General</option>
                      </select>
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Unit of Measure</label>
                      <input type="text" class="dlg-input" [(ngModel)]="inventoryForm.unitOfMeasure" placeholder="e.g. BOX, UNIT">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Unit Price <span class="req">*</span></label>
                      <input type="number" class="dlg-input" [(ngModel)]="inventoryForm.unitPrice" min="0" step="0.01">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Stock Available <span class="req">*</span></label>
                      <input type="number" class="dlg-input" [(ngModel)]="inventoryForm.stockAvailable" min="0">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Reorder Level</label>
                      <input type="number" class="dlg-input" [(ngModel)]="inventoryForm.reorderLevel" min="0">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Supplier</label>
                      <input type="text" class="dlg-input" [(ngModel)]="inventoryForm.supplier" placeholder="Supplier name">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Batch Number</label>
                      <input type="text" class="dlg-input" [(ngModel)]="inventoryForm.batchNumber" placeholder="Batch #">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Expiry Date</label>
                      <input type="date" class="dlg-input" [(ngModel)]="inventoryForm.expiryDate">
                    </div>
                  </div>
                }

                <!-- ── Sale Form ── -->
                @if (editEntity === 'sale') {
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Sale Number</label>
                      <input type="text" class="dlg-input" [(ngModel)]="saleForm.saleNumber" placeholder="e.g. SALE-001">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Sale Date <span class="req">*</span></label>
                      <input type="date" class="dlg-input" [(ngModel)]="saleForm.saleDate">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Customer Name <span class="req">*</span></label>
                      <input type="text" class="dlg-input" [(ngModel)]="saleForm.customerName" placeholder="Customer name">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Customer Phone</label>
                      <input type="text" class="dlg-input" [(ngModel)]="saleForm.customerPhone" placeholder="Phone number">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Total <span class="req">*</span></label>
                      <input type="number" class="dlg-input" [(ngModel)]="saleForm.total" min="0" step="0.01">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Notes</label>
                      <input type="text" class="dlg-input" [(ngModel)]="saleForm.notes" placeholder="Any notes...">
                    </div>
                  </div>
                }

                <!-- ── Credit Note Form ── -->
                @if (editEntity === 'creditNote') {
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Credit Note Number</label>
                      <input type="text" class="dlg-input" [(ngModel)]="creditNoteForm.creditNoteNumber" placeholder="e.g. CN-001">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Invoice Number <span class="req">*</span></label>
                      <input type="text" class="dlg-input" [(ngModel)]="creditNoteForm.invoiceNumber" placeholder="Invoice #">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Customer Name</label>
                      <input type="text" class="dlg-input" [(ngModel)]="creditNoteForm.customerName" placeholder="Customer name">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Status</label>
                      <select class="dlg-select" [(ngModel)]="creditNoteForm.status">
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                      </select>
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Original Amount <span class="req">*</span></label>
                      <input type="number" class="dlg-input" [(ngModel)]="creditNoteForm.originalAmount" min="0" step="0.01">
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Credit Amount <span class="req">*</span></label>
                      <input type="number" class="dlg-input" [(ngModel)]="creditNoteForm.creditAmount" min="0" step="0.01">
                    </div>
                  </div>
                  <div class="dlg-row">
                    <div class="dlg-field">
                      <label class="dlg-label">Reason <span class="req">*</span></label>
                      <input type="text" class="dlg-input" [(ngModel)]="creditNoteForm.reason" placeholder="Reason for credit note">
                    </div>
                  </div>
                  <div class="dlg-row">
                    <div class="dlg-field">
                      <label class="dlg-label">Notes</label>
                      <input type="text" class="dlg-input" [(ngModel)]="creditNoteForm.notes" placeholder="Additional notes...">
                    </div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label checkbox-label">
                        <input type="checkbox" [(ngModel)]="creditNoteForm.reverseStock"> Reverse Stock
                      </label>
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label checkbox-label">
                        <input type="checkbox" [(ngModel)]="creditNoteForm.reverseSale"> Reverse Sale
                      </label>
                    </div>
                  </div>
                }

                <div class="dlg-actions">
                  <button mat-stroked-button (click)="closeEditDialog()" [disabled]="editSaving">Cancel</button>
                  <button mat-flat-button class="btn-submit-delivery" (click)="saveEditForm()" [disabled]="editSaving">
                    @if (editSaving) {
                      <mat-spinner diameter="18" strokeWidth="2"></mat-spinner> Saving...
                    } @else {
                      <mat-icon>save</mat-icon> {{ editMode === 'create' ? 'Create' : 'Save Changes' }}
                    }
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- ==================== UPDATE STOCK DIALOG ==================== -->
      @if (showStockDialog) {
        <div class="dlg-backdrop" (click)="closeStockDialog()"></div>
        <div class="dlg-panel stock-panel">
          <div class="dlg-header stock-header">
            <div class="dlg-title-group">
              <div class="dlg-icon-ring stock-icon-ring"><mat-icon>sync</mat-icon></div>
              <div>
                <h2 class="dlg-title">Update Stock Levels</h2>
                <p class="dlg-subtitle">Adjust inventory quantities</p>
              </div>
            </div>
            <button class="dlg-close" (click)="closeStockDialog()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="dlg-body">
            @if (stockSuccess) {
              <div class="dlg-success">
                <div class="dlg-success-icon"><mat-icon>check_circle</mat-icon></div>
                <h3>Stock Updated!</h3>
                <p>{{ stockSuccessMsg }}</p>
                <div class="dlg-success-actions">
                  <button mat-flat-button class="btn-another" (click)="resetStockForm()"><mat-icon>sync</mat-icon> Update Another</button>
                  <button mat-stroked-button (click)="closeStockDialog()"><mat-icon>close</mat-icon> Close</button>
                </div>
              </div>
            } @else {
              @if (stockError) {
                <div class="dlg-error"><mat-icon>error_outline</mat-icon><span>{{ stockError }}</span></div>
              }
              <div class="dlg-form">
                <div class="dlg-field">
                  <label class="dlg-label">Select Item <span class="req">*</span></label>
                  <select class="dlg-select" [(ngModel)]="stockForm.itemId" (ngModelChange)="onStockItemChange()">
                    <option [ngValue]="0">-- Select an inventory item --</option>
                    @for (item of inventoryItems; track item.id) {
                      <option [ngValue]="item.id">{{ item.name }} ({{ item.sku }}) — Current: {{ item.stockAvailable }}</option>
                    }
                  </select>
                </div>
                @if (stockForm.itemId > 0) {
                  <div class="stock-current-info">
                    <div class="sci-item"><span class="sci-label">Item</span><span class="sci-value">{{ stockForm.itemName }}</span></div>
                    <div class="sci-item"><span class="sci-label">SKU</span><span class="sci-value mono-text">{{ stockForm.itemSku }}</span></div>
                    <div class="sci-item"><span class="sci-label">Current Stock</span><span class="sci-value" [class.danger-val]="stockForm.currentStock <= stockForm.reorderLevel">{{ stockForm.currentStock }}</span></div>
                    <div class="sci-item"><span class="sci-label">Reorder Level</span><span class="sci-value">{{ stockForm.reorderLevel }}</span></div>
                  </div>
                  <div class="dlg-row two-col">
                    <div class="dlg-field">
                      <label class="dlg-label">Adjustment Type</label>
                      <select class="dlg-select" [(ngModel)]="stockForm.adjustType">
                        <option value="set">Set to exact value</option>
                        <option value="add">Add to current stock</option>
                        <option value="subtract">Subtract from stock</option>
                      </select>
                    </div>
                    <div class="dlg-field">
                      <label class="dlg-label">Quantity <span class="req">*</span></label>
                      <input type="number" class="dlg-input" [(ngModel)]="stockForm.quantity" min="0" placeholder="0">
                    </div>
                  </div>
                  @if (stockForm.quantity >= 0) {
                    <div class="stock-preview">
                      <mat-icon>inventory_2</mat-icon>
                      <span>
                        <strong>{{ stockForm.itemName }}</strong>: {{ stockForm.currentStock }}
                        <mat-icon class="stock-arrow">arrow_forward</mat-icon>
                        <strong [class.danger-val]="getNewStockValue() < stockForm.reorderLevel" [class.good-val]="getNewStockValue() >= stockForm.reorderLevel">
                          {{ getNewStockValue() }}
                        </strong>
                        ({{ getStockDiff() }})
                      </span>
                    </div>
                  }
                }
                <div class="dlg-actions">
                  <button mat-stroked-button (click)="closeStockDialog()" [disabled]="stockSaving">Cancel</button>
                  <button mat-flat-button class="btn-stock-save" (click)="saveStockUpdate()" [disabled]="stockSaving || stockForm.itemId === 0">
                    @if (stockSaving) {
                      <mat-spinner diameter="18" strokeWidth="2"></mat-spinner> Saving...
                    } @else {
                      <mat-icon>save</mat-icon> Update Stock
                    }
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- ==================== DELETE CONFIRMATION DIALOG ==================== -->
      @if (showDeleteDialog) {
        <div class="dlg-backdrop" (click)="closeDeleteDialog()"></div>
        <div class="dlg-panel delete-panel">
          <div class="dlg-header delete-header">
            <div class="dlg-title-group">
              <div class="dlg-icon-ring delete-icon-ring"><mat-icon>warning</mat-icon></div>
              <div>
                <h2 class="dlg-title">Confirm Delete</h2>
                <p class="dlg-subtitle">This action cannot be undone</p>
              </div>
            </div>
            <button class="dlg-close" (click)="closeDeleteDialog()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="dlg-body">
            <p class="delete-message">Are you sure you want to delete <strong>{{ deleteItemName }}</strong>?</p>
            @if (editError) {
              <div class="dlg-error"><mat-icon>error_outline</mat-icon><span>{{ editError }}</span></div>
            }
            <div class="dlg-actions">
              <button mat-stroked-button (click)="closeDeleteDialog()" [disabled]="editSaving">Cancel</button>
              <button mat-flat-button class="btn-delete-confirm" (click)="confirmDelete()" [disabled]="editSaving">
                @if (editSaving) {
                  <mat-spinner diameter="18" strokeWidth="2"></mat-spinner> Deleting...
                } @else {
                  <mat-icon>delete</mat-icon> Delete
                }
              </button>
            </div>
          </div>
        </div>
      }
        <mat-tab-group class="dashboard-tabs" animationDuration="200ms" (selectedIndexChange)="onTabChange($event)">

          <!-- ==================== OVERVIEW TAB ==================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>dashboard</mat-icon>
              <span>Overview</span>
            </ng-template>

            <div class="tab-body">
              <!-- Provincial Breakdown -->
              <section class="panel">
                <div class="panel-header">
                  <div class="panel-title-group">
                    <div class="panel-icon blue"><mat-icon>map</mat-icon></div>
                    <div>
                      <h3>Provincial Breakdown</h3>
                      <p>Training activity across all 9 provinces</p>
                    </div>
                  </div>
                </div>
                <div class="province-grid">
                  @for (prov of dashboard?.provinceStats || []; track prov.province) {
                    <div class="province-card">
                      <div class="prov-header">
                        <mat-icon class="prov-map-icon">location_on</mat-icon>
                        <span class="province-name">{{ prov.province }}</span>
                      </div>
                      <div class="prov-metrics">
                        <div class="prov-metric">
                          <span class="prov-metric-val">{{ prov.sessions }}</span>
                          <span class="prov-metric-lbl">Sessions</span>
                        </div>
                        <div class="prov-metric">
                          <span class="prov-metric-val">{{ prov.participants | number }}</span>
                          <span class="prov-metric-lbl">Participants</span>
                        </div>
                        <div class="prov-metric">
                          <span class="prov-metric-val">{{ prov.trainers }}</span>
                          <span class="prov-metric-lbl">Trainers</span>
                        </div>
                        <div class="prov-metric">
                          <span class="prov-metric-val revenue">R{{ prov.revenue | number:'1.0-0' }}</span>
                          <span class="prov-metric-lbl">Revenue</span>
                        </div>
                      </div>
                    </div>
                  }
                  @if (!dashboard?.provinceStats?.length) {
                    <div class="empty-placeholder">
                      <mat-icon>map</mat-icon>
                      <p>No provincial data available</p>
                    </div>
                  }
                </div>
              </section>

              <!-- Equipment Distribution -->
              <section class="panel">
                <div class="panel-header">
                  <div class="panel-title-group">
                    <div class="panel-icon purple"><mat-icon>precision_manufacturing</mat-icon></div>
                    <div>
                      <h3>Equipment Distribution</h3>
                      <p>Delivery status, province breakdown &amp; item details</p>
                    </div>
                  </div>
                </div>

                <!-- Equipment Summary KPIs -->
                @if (dashboard?.equipmentStats?.length) {
                  <div class="equip-summary-strip">
                    <div class="ess-item">
                      <span class="ess-value">{{ dashboard!.equipmentTypesCount || dashboard!.equipmentStats!.length }}</span>
                      <span class="ess-label">Products</span>
                    </div>
                    <div class="ess-item">
                      <span class="ess-value">{{ (dashboard!.totalItemsOrdered || 0) | number }}</span>
                      <span class="ess-label">Total Orders</span>
                    </div>
                    <div class="ess-item">
                      <span class="ess-value">R{{ (dashboard!.totalEquipmentOrderValue || 0) | number:'1.0-0' }}</span>
                      <span class="ess-label">Total Value</span>
                    </div>
                  </div>
                }

                <div class="equip-grid">
                  @for (eq of dashboard?.equipmentStats || []; track eq.equipmentType; let i = $index) {
                    <div class="equip-card" [class.active]="expandedEquipment === eq.equipmentType" (click)="toggleEquipment(eq.equipmentType)">
                      <div class="ec-rank">{{ i + 1 }}</div>
                      <div class="ec-body">
                        <span class="ec-name" [title]="eq.equipmentType">{{ eq.equipmentType }}</span>
                        <div class="ec-metrics">
                          <span class="ec-metric"><mat-icon>shopping_cart</mat-icon> {{ eq.totalOrdered | number }}</span>
                          <span class="ec-metric ec-qty"><mat-icon>inventory_2</mat-icon> {{ getItemBreakdownTotal(eq, 'qty') | number }}</span>
                          <span class="ec-metric ec-val"><mat-icon>payments</mat-icon> R{{ eq.totalOrderValue | number:'1.0-0' }}</span>
                        </div>
                      </div>
                      @if (eq.category) {
                        <span class="ec-cat-dot" [title]="eq.category" [class.hemoglobin]="eq.category === 'HemoglobinTesting'" [class.glucose]="eq.category === 'GlucoseTesting'"></span>
                      }
                    </div>
                  }
                </div>

                <!-- Expanded Detail Panel (below grid) -->
                @if (expandedEquipment) {
                  @for (eq of dashboard?.equipmentStats || []; track eq.equipmentType) {
                    @if (expandedEquipment === eq.equipmentType) {
                      <div class="equip-detail-panel">
                        <div class="edp-header">
                          <mat-icon>precision_manufacturing</mat-icon>
                          <h4>{{ eq.equipmentType }}</h4>
                          @if (eq.category) {
                            <span class="equip-category-tag">{{ eq.category }}</span>
                          }
                          <button class="edp-close" (click)="expandedEquipment = null; $event.stopPropagation()"><mat-icon>close</mat-icon></button>
                        </div>
                        <div class="edp-stats">
                          <div class="edp-stat">
                            <span class="edp-stat-val">{{ eq.totalOrdered | number }}</span>
                            <span class="edp-stat-lbl">Orders</span>
                          </div>
                          <div class="edp-stat">
                            <span class="edp-stat-val">{{ getItemBreakdownTotal(eq, 'qty') | number }}</span>
                            <span class="edp-stat-lbl">Units</span>
                          </div>
                          <div class="edp-stat">
                            <span class="edp-stat-val">R{{ eq.totalOrderValue | number:'1.0-0' }}</span>
                            <span class="edp-stat-lbl">Value</span>
                          </div>
                        </div>

                        <!-- Item Breakdown -->
                        @if (eq.itemBreakdown?.length) {
                          <div class="equip-detail-section">
                            <h5 class="eds-title"><mat-icon>category</mat-icon> Item Breakdown</h5>
                            <div class="item-breakdown-grid">
                              @for (item of eq.itemBreakdown; track item.itemType) {
                                <div class="ib-card">
                                  <div class="ib-icon"><mat-icon>widgets</mat-icon></div>
                                  <div class="ib-info">
                                    <span class="ib-name">{{ item.itemType }}</span>
                                    <span class="ib-meta">{{ item.quantity | number }} units</span>
                                  </div>
                                  <span class="ib-value">R{{ item.value | number:'1.0-0' }}</span>
                                </div>
                              }
                            </div>
                          </div>
                        }

                        <!-- Province Distribution -->
                        @if (eq.provinceDistribution?.length) {
                          <div class="equip-detail-section">
                            <h5 class="eds-title"><mat-icon>map</mat-icon> Province Distribution</h5>
                            <div class="prov-dist-table-wrap">
                              <table class="dialog-table">
                                <thead>
                                  <tr>
                                    <th>Province</th>
                                    <th class="right">Ordered</th>
                                    <th class="right">Delivered</th>
                                    <th class="right">Value</th>
                                    <th class="right">Rate</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  @for (pd of eq.provinceDistribution; track pd.province) {
                                    <tr>
                                      <td class="primary-cell">{{ pd.province }}</td>
                                      <td class="right mono-text">{{ pd.ordered | number }}</td>
                                      <td class="right mono-text">{{ pd.delivered | number }}</td>
                                      <td class="right mono-text">{{ pd.orderValue > 0 ? 'R' + (pd.orderValue | number:'1.0-0') : '—' }}</td>
                                      <td class="right">
                                        <span class="rate-pill" [class.good]="pd.percentage >= 80" [class.mid]="pd.percentage >= 50 && pd.percentage < 80" [class.low]="pd.percentage < 50">
                                          {{ pd.percentage | number:'1.1-1' }}%
                                        </span>
                                      </td>
                                    </tr>
                                  }
                                </tbody>
                              </table>
                            </div>
                          </div>
                        }
                      </div>
                    }
                  }
                }
                  @if (!dashboard?.equipmentStats?.length) {
                    <div class="empty-placeholder">
                      <mat-icon>precision_manufacturing</mat-icon>
                      <p>No equipment data available</p>
                    </div>
                  }
              </section>

              <!-- National Summary -->
              <section class="panel">
                <div class="panel-header">
                  <div class="panel-title-group">
                    <div class="panel-icon teal"><mat-icon>analytics</mat-icon></div>
                    <div>
                      <h3>National Summary</h3>
                      <p>Aggregate totals across the programme</p>
                    </div>
                  </div>
                </div>
                <div class="national-grid">
                  <div class="natl-card">
                    <div class="natl-icon blue"><mat-icon>school</mat-icon></div>
                    <span class="natl-val">{{ dashboard?.nationalTotals?.totalTrainingSessions || 0 | number }}</span>
                    <span class="natl-lbl">Training Sessions</span>
                  </div>
                  <div class="natl-card">
                    <div class="natl-icon green"><mat-icon>person</mat-icon></div>
                    <span class="natl-val">{{ dashboard?.nationalTotals?.totalTrainers || 0 | number }}</span>
                    <span class="natl-lbl">Trainers</span>
                  </div>
                  <div class="natl-card">
                    <div class="natl-icon orange"><mat-icon>groups</mat-icon></div>
                    <span class="natl-val">{{ dashboard?.nationalTotals?.totalParticipants || 0 | number }}</span>
                    <span class="natl-lbl">Participants</span>
                  </div>
                  <div class="natl-card">
                    <div class="natl-icon purple"><mat-icon>shopping_cart</mat-icon></div>
                    <span class="natl-val">{{ dashboard?.nationalTotals?.totalSales || 0 | number }}</span>
                    <span class="natl-lbl">Total Sales</span>
                  </div>
                  <div class="natl-card">
                    <div class="natl-icon teal"><mat-icon>attach_money</mat-icon></div>
                    <span class="natl-val">R{{ dashboard?.nationalTotals?.totalRevenue || 0 | number:'1.0-0' }}</span>
                    <span class="natl-lbl">Total Revenue</span>
                  </div>
                  <div class="natl-card">
                    <div class="natl-icon red"><mat-icon>local_shipping</mat-icon></div>
                    <span class="natl-val">{{ dashboard?.nationalTotals?.totalDeliveries || 0 | number }}</span>
                    <span class="natl-lbl">Deliveries</span>
                  </div>
                </div>
              </section>
            </div>
          </mat-tab>

          <!-- ==================== TRAINING TAB ==================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>school</mat-icon>
              <span>Training</span>
              @if (dashboard?.trainingStats?.totalSessions) {
                <span class="tab-count">{{ dashboard?.trainingStats?.totalSessions }}</span>
              }
            </ng-template>

            <div class="tab-body">
              <!-- Training Mini KPIs -->
              <div class="stat-bar">
                <div class="stat-chip blue">
                  <mat-icon>check_circle</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">{{ dashboard?.trainingStats?.completedSessions || 0 }}</span>
                    <span class="sc-lbl">Completed</span>
                  </div>
                </div>
                <div class="stat-chip orange">
                  <mat-icon>pending</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">{{ dashboard?.trainingStats?.inProgressSessions || 0 }}</span>
                    <span class="sc-lbl">In Progress</span>
                  </div>
                </div>
                <div class="stat-chip green">
                  <mat-icon>groups</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">{{ dashboard?.trainingStats?.totalParticipants || 0 | number }}</span>
                    <span class="sc-lbl">Total Participants</span>
                  </div>
                </div>
                <div class="stat-chip purple">
                  <mat-icon>speed</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">{{ dashboard?.trainingStats?.completionRate || 0 | number:'1.0-0' }}%</span>
                    <span class="sc-lbl">Completion Rate</span>
                  </div>
                </div>
              </div>

              <!-- Training Sessions Table -->
              <section class="panel">
                <div class="panel-header">
                  <div class="panel-title-group">
                    <div class="panel-icon blue"><mat-icon>list_alt</mat-icon></div>
                    <div>
                      <h3>Training Sessions</h3>
                      <p>{{ trainingSessions.length }} sessions loaded</p>
                    </div>
                  </div>
                  <button mat-stroked-button class="panel-action" (click)="loadTraining()">
                    <mat-icon>refresh</mat-icon> Refresh
                  </button>
                  <button mat-flat-button class="panel-action add-btn" (click)="openCreateDialog('training')">
                    <mat-icon>add</mat-icon> Add Training
                  </button>
                </div>

                @if (trainingLoading) {
                  <div class="panel-loading"><mat-spinner diameter="32" strokeWidth="3"></mat-spinner></div>
                } @else {
                  <div class="table-wrap">
                    <table class="modern-table">
                      <thead>
                        <tr>
                          <th>Training Name</th>
                          <th>Province</th>
                          <th>Venue</th>
                          <th>Trainer</th>
                          <th>Date</th>
                          <th class="center">Participants</th>
                          <th class="center">Status</th>
                          <th class="center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (session of trainingSessions; track session.id) {
                          <tr>
                            <td class="primary-cell">{{ session.trainingName }}</td>
                            <td>
                              <span class="province-tag">{{ session.provinceName }}</span>
                            </td>
                            <td class="secondary-text">{{ session.venue }}</td>
                            <td class="secondary-text">{{ getTrainerName(session) }}</td>
                            <td class="mono-text">{{ session.startDate | date:'dd MMM yyyy' }}</td>
                            <td class="center">
                              <span class="num-badge blue">{{ session.numberOfParticipants }}</span>
                            </td>
                            <td class="center">
                              <span class="status-tag" [class]="'st-' + ('' + (session.statusText || 'unknown')).toLowerCase()">
                                {{ session.statusText || 'Unknown' }}
                              </span>
                            </td>
                            <td class="center actions-cell">
                              <button mat-icon-button class="action-edit" matTooltip="Edit" (click)="openEditDialog('training', session)">
                                <mat-icon>edit</mat-icon>
                              </button>
                              <button mat-icon-button class="action-delete" matTooltip="Delete" (click)="openDeleteDialog('training', session.id!, session.trainingName)">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </td>
                          </tr>
                        }
                        @if (!trainingSessions.length) {
                          <tr><td colspan="8" class="empty-row">No training sessions found</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </section>
            </div>
          </mat-tab>

          <!-- ==================== INVENTORY TAB ==================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>inventory_2</mat-icon>
              <span>Inventory</span>
              @if (dashboard?.inventoryStats?.lowStockItems) {
                <span class="tab-count warn">{{ dashboard?.inventoryStats?.lowStockItems }}</span>
              }
            </ng-template>

            <div class="tab-body">
              <!-- Inventory Stats -->
              <div class="stat-bar">
                <div class="stat-chip blue">
                  <mat-icon>category</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">{{ dashboard?.inventoryStats?.totalItems || 0 | number }}</span>
                    <span class="sc-lbl">Total Items</span>
                  </div>
                </div>
                <div class="stat-chip green">
                  <mat-icon>payments</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">R{{ dashboard?.inventoryStats?.totalValue || 0 | number:'1.0-0' }}</span>
                    <span class="sc-lbl">Total Value</span>
                  </div>
                </div>
                <div class="stat-chip orange">
                  <mat-icon>warning</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">{{ dashboard?.inventoryStats?.lowStockItems || 0 }}</span>
                    <span class="sc-lbl">Low Stock</span>
                  </div>
                </div>
                <div class="stat-chip red">
                  <mat-icon>error</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">{{ dashboard?.inventoryStats?.outOfStockItems || 0 }}</span>
                    <span class="sc-lbl">Out of Stock</span>
                  </div>
                </div>
              </div>

              <!-- Low Stock Alerts -->
              @if (dashboard?.lowStockItems?.length) {
                <section class="panel alert-panel">
                  <div class="panel-header">
                    <div class="panel-title-group">
                      <div class="panel-icon orange"><mat-icon>warning</mat-icon></div>
                      <div>
                        <h3>Low Stock Alerts</h3>
                        <p>{{ dashboard?.lowStockItems?.length }} items need attention</p>
                      </div>
                    </div>
                  </div>
                  <div class="alert-grid">
                    @for (item of dashboard?.lowStockItems || []; track item.id) {
                      <div class="alert-card">
                        <div class="alert-top">
                          <span class="alert-name">{{ item.name }}</span>
                          <span class="status-tag st-warning">Low Stock</span>
                        </div>
                        <div class="alert-meta">
                          <span>SKU: <strong>{{ item.sku }}</strong></span>
                          <span>Stock: <strong class="danger-val">{{ item.stockAvailable }}</strong> / Reorder: {{ item.reorderLevel }}</span>
                        </div>
                        <mat-progress-bar
                          mode="determinate"
                          [value]="item.reorderLevel > 0 ? (item.stockAvailable / item.reorderLevel) * 100 : 0"
                          color="warn"
                        ></mat-progress-bar>
                      </div>
                    }
                  </div>
                </section>
              }

              <!-- All Inventory -->
              <section class="panel">
                <div class="panel-header">
                  <div class="panel-title-group">
                    <div class="panel-icon purple"><mat-icon>list_alt</mat-icon></div>
                    <div>
                      <h3>All Inventory Items</h3>
                      <p>{{ inventoryItems.length }} items loaded</p>
                    </div>
                  </div>
                  <button mat-stroked-button class="panel-action" (click)="loadInventory()">
                    <mat-icon>refresh</mat-icon> Refresh
                  </button>
                  <button mat-flat-button class="panel-action update-stock-btn" (click)="openStockUpdateDialog()">
                    <mat-icon>sync</mat-icon> Update Stock
                  </button>
                  <button mat-flat-button class="panel-action add-btn" (click)="openCreateDialog('inventory')">
                    <mat-icon>add</mat-icon> Add Item
                  </button>
                </div>

                @if (inventoryLoading) {
                  <div class="panel-loading"><mat-spinner diameter="32" strokeWidth="3"></mat-spinner></div>
                } @else {
                  <div class="table-wrap">
                    <table class="modern-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>SKU</th>
                          <th>Category</th>
                          <th class="right">Stock</th>
                          <th class="right">Reorder</th>
                          <th class="right">Unit Price</th>
                          <th>Supplier</th>
                          <th class="center">Status</th>
                          <th class="center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of inventoryItems; track item.id) {
                          <tr [class.alert-row]="item.stockAvailable <= item.reorderLevel">
                            <td class="primary-cell">{{ item.name }}</td>
                            <td class="mono-text">{{ item.sku }}</td>
                            <td><span class="category-tag">{{ item.categoryText }}</span></td>
                            <td class="right" [class.danger-val]="item.stockAvailable <= item.reorderLevel">
                              {{ item.stockAvailable | number }}
                            </td>
                            <td class="right secondary-text">{{ item.reorderLevel | number }}</td>
                            <td class="right money-val">R{{ item.unitPrice | number:'1.2-2' }}</td>
                            <td class="secondary-text">{{ item.supplier }}</td>
                            <td class="center">
                              <span class="status-tag" [class]="item.stockAvailable <= item.reorderLevel ? 'st-warning' : 'st-ok'">
                                {{ item.statusText || (item.stockAvailable <= item.reorderLevel ? 'Low Stock' : 'In Stock') }}
                              </span>
                            </td>
                            <td class="center actions-cell">
                              <button mat-icon-button class="action-edit" matTooltip="Edit" (click)="openEditDialog('inventory', item)">
                                <mat-icon>edit</mat-icon>
                              </button>
                              <button mat-icon-button class="action-delete" matTooltip="Delete" (click)="openDeleteDialog('inventory', item.id!, item.name)">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </td>
                          </tr>
                        }
                        @if (!inventoryItems.length) {
                          <tr><td colspan="9" class="empty-row">No inventory items found</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </section>
            </div>
          </mat-tab>

          <!-- ==================== SALES TAB ==================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>point_of_sale</mat-icon>
              <span>Sales</span>
            </ng-template>

            <div class="tab-body">
              <!-- Sales Stats -->
              <div class="stat-bar">
                <div class="stat-chip blue">
                  <mat-icon>receipt_long</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">{{ dashboard?.salesStats?.totalSales || 0 | number }}</span>
                    <span class="sc-lbl">Total Sales</span>
                  </div>
                </div>
                <div class="stat-chip green">
                  <mat-icon>trending_up</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">R{{ dashboard?.salesStats?.totalRevenue || 0 | number:'1.0-0' }}</span>
                    <span class="sc-lbl">Revenue</span>
                  </div>
                </div>
                <div class="stat-chip teal">
                  <mat-icon>shopping_bag</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">R{{ dashboard?.salesStats?.averageOrderValue || 0 | number:'1.0-0' }}</span>
                    <span class="sc-lbl">Avg Order</span>
                  </div>
                </div>
                <div class="stat-chip orange">
                  <mat-icon>hourglass_empty</mat-icon>
                  <div class="sc-text">
                    <span class="sc-val">{{ dashboard?.salesStats?.pendingOrders || 0 }}</span>
                    <span class="sc-lbl">Pending</span>
                  </div>
                </div>
              </div>

              <!-- Provincial Sales -->
              <section class="panel">
                <div class="panel-header">
                  <div class="panel-title-group">
                    <div class="panel-icon blue"><mat-icon>map</mat-icon></div>
                    <div>
                      <h3>Sales by Province</h3>
                      <p>Revenue & delivery performance per province</p>
                    </div>
                  </div>
                </div>
                <div class="prov-sales-grid">
                  @for (prov of dashboard?.provincialData || []; track prov.province) {
                    <div class="prov-sale-card">
                      <div class="psc-top">
                        <span class="psc-province">{{ prov.province }}</span>
                        <span class="psc-revenue">R{{ prov.revenue | number:'1.0-0' }}</span>
                      </div>
                      <div class="psc-meta">
                        <span>{{ prov.orderCount | number }} orders</span>
                        <span>{{ prov.totalDelivered }}/{{ prov.totalOrdered }} delivered</span>
                      </div>
                      <div class="psc-bar-wrap">
                        <mat-progress-bar mode="determinate" [value]="prov.deliveryRate"></mat-progress-bar>
                        <span class="psc-rate">{{ prov.deliveryRate | number:'1.0-0' }}%</span>
                      </div>
                    </div>
                  }
                  @if (!dashboard?.provincialData?.length) {
                    <div class="empty-placeholder">
                      <mat-icon>point_of_sale</mat-icon>
                      <p>No provincial sales data</p>
                    </div>
                  }
                </div>
              </section>

              <!-- Top Products -->
              <section class="panel">
                <div class="panel-header">
                  <div class="panel-title-group">
                    <div class="panel-icon orange"><mat-icon>star</mat-icon></div>
                    <div>
                      <h3>Top Products</h3>
                      <p>Best selling products by revenue</p>
                    </div>
                  </div>
                </div>
                <div class="top-products">
                  @for (prod of dashboard?.topProducts || []; track prod.productName; let i = $index) {
                    <div class="tp-row">
                      <span class="tp-rank" [class]="'rank-' + (i < 3 ? i + 1 : 'other')">#{{ i + 1 }}</span>
                      <div class="tp-info">
                        <span class="tp-name">{{ prod.productName }}</span>
                        <span class="tp-meta">{{ prod.quantitySold | number }} units &middot; {{ prod.orderCount }} orders</span>
                      </div>
                      <span class="tp-revenue">R{{ prod.revenue | number:'1.0-0' }}</span>
                    </div>
                  }
                  @if (!dashboard?.topProducts?.length) {
                    <div class="empty-placeholder compact">
                      <mat-icon>star</mat-icon>
                      <p>No product data</p>
                    </div>
                  }
                </div>
              </section>

              <!-- Recent Sales Table -->
              <section class="panel">
                <div class="panel-header">
                  <div class="panel-title-group">
                    <div class="panel-icon green"><mat-icon>receipt_long</mat-icon></div>
                    <div>
                      <h3>Recent Sales</h3>
                      <p>{{ salesList.length }} sales loaded</p>
                    </div>
                  </div>
                  <button mat-stroked-button class="panel-action" (click)="loadSales()">
                    <mat-icon>refresh</mat-icon> Refresh
                  </button>
                  <button mat-flat-button class="panel-action add-btn" (click)="openCreateDialog('sale')">
                    <mat-icon>add</mat-icon> Add Sale
                  </button>
                </div>

                @if (salesLoading) {
                  <div class="panel-loading"><mat-spinner diameter="32" strokeWidth="3"></mat-spinner></div>
                } @else {
                  <div class="table-wrap">
                    <table class="modern-table">
                      <thead>
                        <tr>
                          <th>Sale #</th>
                          <th>Customer</th>
                          <th>Date</th>
                          <th class="center">Items</th>
                          <th class="right">Total</th>
                          <th class="center">Credit</th>
                          <th class="center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (sale of salesList; track sale.id) {
                          <tr>
                            <td class="mono-text">{{ sale.saleNumber }}</td>
                            <td class="primary-cell">{{ sale.customerName }}</td>
                            <td class="mono-text">{{ sale.saleDate | date:'dd MMM yyyy' }}</td>
                            <td class="center">
                              <span class="num-badge subtle">{{ sale.saleItems?.length || 0 }}</span>
                            </td>
                            <td class="right money-val">R{{ sale.total | number:'1.2-2' }}</td>
                            <td class="center">
                              @if (sale.hasCreditNote) {
                                <span class="status-tag st-warning">R{{ sale.creditedAmount || 0 | number:'1.2-2' }}</span>
                              } @else {
                                <span class="status-tag st-ok">OK</span>
                              }
                            </td>
                            <td class="center actions-cell">
                              <button mat-icon-button class="action-edit" matTooltip="Edit" (click)="openEditDialog('sale', sale)">
                                <mat-icon>edit</mat-icon>
                              </button>
                              <button mat-icon-button class="action-delete" matTooltip="Delete" (click)="openDeleteDialog('sale', sale.id!, sale.saleNumber)">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </td>
                          </tr>
                        }
                        @if (!salesList.length) {
                          <tr><td colspan="7" class="empty-row">No sales found</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </section>
            </div>
          </mat-tab>

          <!-- ==================== CREDIT NOTES TAB ==================== -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>receipt</mat-icon>
              <span>Credit Notes</span>
            </ng-template>

            <div class="tab-body">
              <section class="panel">
                <div class="panel-header">
                  <div class="panel-title-group">
                    <div class="panel-icon red"><mat-icon>receipt</mat-icon></div>
                    <div>
                      <h3>Credit Notes</h3>
                      <p>{{ creditNotes.length }} notes loaded</p>
                    </div>
                  </div>
                  <button mat-stroked-button class="panel-action" (click)="loadCreditNotes()">
                    <mat-icon>refresh</mat-icon> Refresh
                  </button>
                  <button mat-flat-button class="panel-action add-btn" (click)="openCreateDialog('creditNote')">
                    <mat-icon>add</mat-icon> Add Credit Note
                  </button>
                </div>

                @if (creditNotesLoading) {
                  <div class="panel-loading"><mat-spinner diameter="32" strokeWidth="3"></mat-spinner></div>
                } @else {
                  <div class="table-wrap">
                    <table class="modern-table">
                      <thead>
                        <tr>
                          <th>Credit Note #</th>
                          <th>Invoice #</th>
                          <th>Customer</th>
                          <th class="right">Original</th>
                          <th class="right">Credit</th>
                          <th>Reason</th>
                          <th>Created</th>
                          <th class="center">Status</th>
                          <th class="center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (cn of creditNotes; track cn.id) {
                          <tr>
                            <td class="mono-text">{{ cn.creditNoteNumber }}</td>
                            <td class="mono-text">{{ cn.invoiceNumber }}</td>
                            <td class="primary-cell">{{ cn.customerName }}</td>
                            <td class="right money-val">R{{ cn.originalAmount | number:'1.2-2' }}</td>
                            <td class="right danger-val">-R{{ cn.creditAmount | number:'1.2-2' }}</td>
                            <td class="secondary-text reason-cell">{{ cn.reason }}</td>
                            <td class="mono-text">{{ cn.createdDate | date:'dd MMM yyyy' }}</td>
                            <td class="center">
                              <span class="status-tag" [class]="'st-' + ('' + (cn.status || 'unknown')).toLowerCase()">
                                {{ cn.status }}
                              </span>
                            </td>
                            <td class="center actions-cell">
                              <button mat-icon-button class="action-edit" matTooltip="Edit" (click)="openEditDialog('creditNote', cn)">
                                <mat-icon>edit</mat-icon>
                              </button>
                              <button mat-icon-button class="action-delete" matTooltip="Delete" (click)="openDeleteDialog('creditNote', cn.id, cn.creditNoteNumber)">
                                <mat-icon>delete</mat-icon>
                              </button>
                            </td>
                          </tr>
                        }
                        @if (!creditNotes.length) {
                          <tr><td colspan="9" class="empty-row">No credit notes found</td></tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </section>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    }
  `,
  styles: [`
    /* ============================== */
    /*  VARIABLES & HOST              */
    /* ============================== */
    :host {
      display: block;
      --blue: #3b82f6; --blue-soft: #eff6ff; --blue-mid: #dbeafe;
      --green: #22c55e; --green-soft: #f0fdf4; --green-mid: #dcfce7;
      --orange: #f59e0b; --orange-soft: #fffbeb; --orange-mid: #fef3c7;
      --purple: #8b5cf6; --purple-soft: #f5f3ff; --purple-mid: #ede9fe;
      --teal: #14b8a6; --teal-soft: #f0fdfa; --teal-mid: #ccfbf1;
      --red: #ef4444; --red-soft: #fef2f2; --red-mid: #fee2e2;
      --text-primary: #0f172a;
      --text-secondary: #64748b;
      --text-muted: #94a3b8;
      --surface: #ffffff;
      --surface-hover: #f8fafc;
      --border: #e2e8f0;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-xl: 20px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      --shadow-md: 0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
      --shadow-lg: 0 10px 30px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04);
    }

    /* ============================== */
    /*  HERO HEADER                   */
    /* ============================== */
    .hero-header {
      position: relative;
      margin: -24px -24px 32px;
      padding: 32px 40px 36px;
      overflow: hidden;
    }
    .hero-bg {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #0d9488 0%, #0891b2 40%, #3b82f6 100%);
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
    .hero-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .refresh-btn {
      background: rgba(255,255,255,0.2) !important;
      color: white !important;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.2) !important;
      border-radius: 12px !important;
      font-weight: 600 !important;
    }
    .refresh-btn:hover { background: rgba(255,255,255,0.3) !important; }

    .connection-pill {
      display: flex; align-items: center; gap: 7px;
      padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 600;
      background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.8);
      backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2);
    }
    .conn-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(255,255,255,0.5); animation: pulse 2s infinite;
    }
    .connection-pill.connected { background: rgba(34,197,94,0.25); border-color: rgba(34,197,94,0.5); color: #bbf7d0; }
    .connection-pill.connected .conn-dot { background: #4ade80; }
    .connection-pill.error { background: rgba(239,68,68,0.25); border-color: rgba(239,68,68,0.5); color: #fca5a5; }
    .connection-pill.error .conn-dot { background: #f87171; animation: none; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ============================== */
    /*  LOADING / ERROR STATES        */
    /* ============================== */
    .loading-state, .error-state {
      display: flex; justify-content: center; padding: 80px 20px;
    }
    .loading-card, .error-card {
      background: var(--surface); border-radius: 24px;
      padding: 48px 56px; text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.06);
      border: 1px solid #f0f0f0;
      max-width: 520px; width: 100%;
    }
    .loading-card h3, .error-card h3 { color: var(--text-primary); margin: 16px 0 6px; font-size: 20px; font-weight: 800; }
    .loading-card p, .error-card p { color: var(--text-secondary); margin: 0 0 20px; font-size: 14px; line-height: 1.5; }

    /* Loading icon */
    .lc-icon-wrap {
      width: 72px; height: 72px; border-radius: 22px; margin: 0 auto;
      background: linear-gradient(135deg, #0d9488, #3b82f6);
      display: flex; align-items: center; justify-content: center;
    }
    .lc-icon-wrap.pulse-ring {
      animation: pulseRing 1.8s ease-in-out infinite;
    }
    @keyframes pulseRing {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(13,148,136,0.4); }
      50% { transform: scale(1.08); box-shadow: 0 0 0 16px rgba(13,148,136,0); }
    }
    .lc-icon { font-size: 36px; width: 36px; height: 36px; color: white; }
    .lc-subtitle { color: var(--text-muted) !important; font-size: 13px !important; }

    /* Progress bar */
    .lc-progress-wrap { margin: 8px 0 24px; }
    .lc-progress-track {
      height: 8px; border-radius: 4px; background: var(--bg-secondary);
      overflow: hidden; position: relative;
    }
    .lc-progress-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, #0d9488, #0891b2, #3b82f6);
      background-size: 200% 100%;
      animation: shimmer 2s ease-in-out infinite;
      transition: width 0.15s ease-out;
      position: relative;
    }
    .lc-progress-fill::after {
      content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 24px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4));
      border-radius: 0 4px 4px 0;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .lc-progress-info {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 10px; font-size: 12px;
    }
    .lc-progress-message {
      color: var(--text-secondary); font-weight: 500;
      transition: opacity 0.3s ease;
    }
    .lc-progress-pct {
      color: var(--teal); font-weight: 700; font-size: 13px;
      font-variant-numeric: tabular-nums;
    }

    /* Step indicators */
    .lc-steps {
      display: flex; justify-content: space-between; gap: 4px;
      padding-top: 4px; border-top: 1px solid var(--border-light);
    }
    .lc-step {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      flex: 1; padding-top: 16px; opacity: 0.35;
      transition: opacity 0.4s ease, transform 0.3s ease;
    }
    .lc-step.active { opacity: 1; transform: translateY(-2px); }
    .lc-step.done { opacity: 0.65; }
    .lc-step-dot {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--bg-secondary); display: flex; align-items: center; justify-content: center;
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .lc-step-dot mat-icon { font-size: 16px; width: 16px; height: 16px; color: var(--text-tertiary); transition: color 0.3s ease; }
    .lc-step.active .lc-step-dot {
      background: linear-gradient(135deg, #0d9488, #3b82f6);
      box-shadow: 0 2px 10px rgba(13, 148, 136, 0.3);
    }
    .lc-step.active .lc-step-dot mat-icon { color: #fff; }
    .lc-step.done .lc-step-dot { background: var(--green-soft); }
    .lc-step.done .lc-step-dot mat-icon { color: var(--green); }
    .lc-step-label { font-size: 11px; font-weight: 600; color: var(--text-muted); white-space: nowrap; }
    .lc-step.active .lc-step-label { color: var(--teal); }
    .lc-step.done .lc-step-label { color: var(--green); }
    .error-icon-wrap {
      width: 64px; height: 64px; border-radius: 50%; margin: 0 auto;
      background: var(--red-soft); display: flex; align-items: center; justify-content: center;
    }
    .error-icon-wrap mat-icon { font-size: 32px; width: 32px; height: 32px; color: var(--red); }

    /* ============================== */
    /*  KPI CARDS                     */
    /* ============================== */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px; margin-bottom: 28px;
    }
    .kpi-card {
      background: var(--surface); border-radius: 20px;
      padding: 24px; display: flex; flex-direction: column; gap: 14px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04); transition: all 0.25s cubic-bezier(.4,0,.2,1);
      position: relative; overflow: hidden; border: 1px solid #f0f0f0;
    }
    .kpi-card:hover { transform: translateY(-4px); box-shadow: 0 12px 28px rgba(0,0,0,0.08); }
    .kpi-glow {
      position: absolute; top: -40px; right: -40px;
      width: 100px; height: 100px; border-radius: 50%;
      opacity: 0.12; transition: opacity 0.3s;
    }
    .kpi-card:hover .kpi-glow { opacity: 0.2; }
    .kpi-blue .kpi-glow { background: var(--blue); }
    .kpi-green .kpi-glow { background: var(--green); }
    .kpi-orange .kpi-glow { background: var(--orange); }
    .kpi-purple .kpi-glow { background: var(--purple); }
    .kpi-teal .kpi-glow { background: var(--teal); }
    .kpi-red .kpi-glow { background: var(--red); }

    .kpi-icon-wrap {
      width: 48px; height: 48px; border-radius: 16px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .kpi-blue .kpi-icon-wrap { background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; }
    .kpi-green .kpi-icon-wrap { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; }
    .kpi-orange .kpi-icon-wrap { background: linear-gradient(135deg, #f59e0b, #d97706); color: white; }
    .kpi-purple .kpi-icon-wrap { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; }
    .kpi-teal .kpi-icon-wrap { background: linear-gradient(135deg, #14b8a6, #0d9488); color: white; }
    .kpi-red .kpi-icon-wrap { background: linear-gradient(135deg, #ef4444, #dc2626); color: white; }
    .kpi-icon-wrap mat-icon { font-size: 24px; width: 24px; height: 24px; }

    .kpi-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .kpi-number { font-size: 26px; font-weight: 800; color: var(--text-primary); line-height: 1.1; white-space: nowrap; letter-spacing: -0.5px; }
    .kpi-label { font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }
    .kpi-sub {
      font-size: 12px; color: #b0b8c4; padding-top: 4px;
      border-top: 1px dashed #f0f0f0;
    }

    /* ============================== */
    /*  TABS                          */
    /* ============================== */
    .tabs-wrapper {
      background: var(--surface); border-radius: 20px;
      box-shadow: 0 1px 6px rgba(0,0,0,0.05); overflow: hidden;
      border: 1px solid #f0f0f0;
    }
    .dashboard-tabs ::ng-deep .mat-mdc-tab-header { background: linear-gradient(135deg, #f0fdfa 0%, #f8fafc 100%); border-bottom: 1px solid #e2e8f0; }
    .dashboard-tabs ::ng-deep .mat-mdc-tab { min-width: 140px; }
    .dashboard-tabs ::ng-deep .mat-mdc-tab .mdc-tab__text-label {
      display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px;
    }
    .tab-count {
      background: var(--blue); color: white; font-size: 10px; font-weight: 700;
      padding: 2px 8px; border-radius: 10px; margin-left: 2px; line-height: 16px;
    }
    .tab-count.warn { background: var(--orange); }
    .tab-body { padding: 28px; }

    /* ============================== */
    /*  STAT BAR (mini KPIs in tabs)  */
    /* ============================== */
    .stat-bar {
      display: flex; gap: 14px; margin-bottom: 28px; flex-wrap: wrap;
    }
    .stat-chip {
      flex: 1; min-width: 160px; display: flex; align-items: center; gap: 12px;
      padding: 16px 18px; border-radius: var(--radius-md); border: 1px solid;
      transition: transform 0.2s;
    }
    .stat-chip:hover { transform: translateY(-2px); }
    .stat-chip mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .stat-chip.blue { background: var(--blue-soft); border-color: var(--blue-mid); color: var(--blue); }
    .stat-chip.green { background: var(--green-soft); border-color: var(--green-mid); color: var(--green); }
    .stat-chip.orange { background: var(--orange-soft); border-color: var(--orange-mid); color: var(--orange); }
    .stat-chip.purple { background: var(--purple-soft); border-color: var(--purple-mid); color: var(--purple); }
    .stat-chip.teal { background: var(--teal-soft); border-color: var(--teal-mid); color: var(--teal); }
    .stat-chip.red { background: var(--red-soft); border-color: var(--red-mid); color: var(--red); }
    .sc-text { display: flex; flex-direction: column; }
    .sc-val { font-size: 20px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
    .sc-lbl { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 500; }

    /* ============================== */
    /*  PANEL (section wrapper)       */
    /* ============================== */
    .panel {
      background: var(--surface); border: 1px solid #f0f0f0;
      border-radius: 20px; margin-bottom: 24px;
      overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.03);
    }
    .alert-panel { border-color: var(--orange-mid); background: var(--orange-soft); }

    .panel-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 24px; border-bottom: 1px solid var(--border);
    }
    .alert-panel .panel-header { border-bottom-color: var(--orange-mid); }

    .panel-title-group { display: flex; align-items: center; gap: 14px; }
    .panel-icon {
      width: 40px; height: 40px; border-radius: var(--radius-sm);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .panel-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .panel-icon.blue { background: var(--blue-soft); color: var(--blue); }
    .panel-icon.green { background: var(--green-soft); color: var(--green); }
    .panel-icon.orange { background: var(--orange-soft); color: var(--orange); }
    .panel-icon.purple { background: var(--purple-soft); color: var(--purple); }
    .panel-icon.teal { background: var(--teal-soft); color: var(--teal); }
    .panel-icon.red { background: var(--red-soft); color: var(--red); }
    .alert-panel .panel-icon.orange { background: rgba(245,158,11,0.2); }

    .panel-title-group h3 { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.2; }
    .panel-title-group p { font-size: 12px; color: var(--text-muted); margin: 3px 0 0; }
    .panel-action {
      font-size: 12px !important; border-color: var(--border) !important;
      color: var(--text-secondary) !important; border-radius: var(--radius-sm) !important;
    }
    .panel-action mat-icon { font-size: 16px; width: 16px; height: 16px; margin-right: 4px; }
    .panel-loading { display: flex; justify-content: center; padding: 48px; }

    /* ============================== */
    /*  PROVINCE GRID (Overview)      */
    /* ============================== */
    .province-grid {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 1px; background: var(--border);
    }
    .province-card {
      background: var(--surface); padding: 20px 24px;
      transition: background 0.2s, transform 0.2s;
    }
    .province-card:hover { background: #f0fdfa; transform: translateY(-1px); }
    .prov-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
    .prov-map-icon { font-size: 18px; width: 18px; height: 18px; color: var(--blue); }
    .province-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .prov-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .prov-metric { display: flex; flex-direction: column; }
    .prov-metric-val { font-size: 18px; font-weight: 700; color: var(--blue); }
    .prov-metric-val.revenue { color: var(--green); }
    .prov-metric-lbl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 500; }

    /* ============================== */
    /*  EQUIPMENT DISTRIBUTION        */
    /* ============================== */
    .equip-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 10px; padding: 20px;
    }
    .equip-card {
      display: flex; align-items: stretch; gap: 0;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 12px; cursor: pointer; overflow: hidden;
      transition: all 0.15s ease; position: relative;
    }
    .equip-card:hover { border-color: var(--teal-mid); box-shadow: 0 4px 16px rgba(0,0,0,0.06); transform: translateY(-2px); }
    .equip-card.active { border-color: var(--teal); box-shadow: 0 0 0 2px var(--teal-soft); }

    .ec-rank {
      display: flex; align-items: center; justify-content: center;
      min-width: 36px; background: var(--purple-soft); color: var(--purple);
      font-size: 13px; font-weight: 800; flex-shrink: 0;
      font-family: 'SF Mono', 'Cascadia Code', monospace;
    }
    .ec-body {
      flex: 1; padding: 10px 12px; min-width: 0; display: flex; flex-direction: column; gap: 6px;
    }
    .ec-name {
      font-size: 12px; font-weight: 700; color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      line-height: 1.2;
    }
    .ec-metrics {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .ec-metric {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11px; font-weight: 600; color: var(--text-secondary);
    }
    .ec-metric mat-icon { font-size: 13px; width: 13px; height: 13px; color: var(--blue); }
    .ec-qty mat-icon { color: var(--purple); }
    .ec-val { color: var(--teal); font-family: 'SF Mono', 'Cascadia Code', monospace; }
    .ec-val mat-icon { color: var(--teal); }

    .ec-cat-dot {
      position: absolute; top: 6px; right: 6px;
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--text-muted);
    }
    .ec-cat-dot.hemoglobin { background: var(--purple); }
    .ec-cat-dot.glucose { background: var(--blue); }

    /* Equipment Summary Strip */
    .equip-summary-strip {
      display: flex; flex-wrap: wrap; gap: 0; border-bottom: 1px solid var(--border);
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    }
    .ess-item {
      flex: 1; min-width: 120px; padding: 16px 20px;
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      border-right: 1px solid var(--border); text-align: center;
    }
    .ess-item:last-child { border-right: none; }
    .ess-value {
      font-size: 20px; font-weight: 800; color: var(--text-primary);
      font-family: 'SF Mono', 'Cascadia Code', monospace;
    }
    .ess-value.good { color: var(--green); }
    .ess-value.mid { color: var(--orange); }
    .ess-value.low { color: var(--red); }
    .ess-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }

    /* Expanded Detail Panel (below grid) */
    .equip-detail-panel {
      margin: 0 20px 20px; padding: 20px;
      background: #f8fafc; border-radius: 14px; border: 1px solid var(--border);
      animation: slideDown 0.25s ease;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .edp-header {
      display: flex; align-items: center; gap: 10px; margin-bottom: 16px;
    }
    .edp-header mat-icon { font-size: 22px; width: 22px; height: 22px; color: var(--purple); }
    .edp-header h4 { font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0; flex: 1; }
    .edp-close {
      background: none; border: none; cursor: pointer; padding: 4px;
      border-radius: 8px; color: var(--text-muted); display: flex;
      transition: all 0.15s;
    }
    .edp-close:hover { background: var(--border); color: var(--text-primary); }
    .edp-stats {
      display: flex; gap: 0; border-radius: 10px; overflow: hidden;
      border: 1px solid var(--border); margin-bottom: 16px;
    }
    .edp-stat {
      flex: 1; padding: 12px 16px; text-align: center;
      background: var(--surface); border-right: 1px solid var(--border);
      display: flex; flex-direction: column; gap: 2px;
    }
    .edp-stat:last-child { border-right: none; }
    .edp-stat-val { font-size: 18px; font-weight: 800; color: var(--text-primary); font-family: 'SF Mono', 'Cascadia Code', monospace; }
    .edp-stat-lbl { font-size: 10px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; }

    .equip-category-tag {
      display: inline-block; font-size: 10px; font-weight: 600;
      color: var(--purple); background: var(--purple-soft);
      padding: 2px 8px; border-radius: 10px;
      text-transform: uppercase; letter-spacing: 0.3px; width: fit-content;
    }

    .equip-detail-section {
      background: var(--surface); border-radius: 12px; padding: 16px 18px;
      margin-bottom: 12px; border: 1px solid var(--border);
    }
    .equip-detail-section:last-child { margin-bottom: 0; }

    .eds-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.3px;
      margin: 0 0 14px;
    }
    .eds-title mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .item-breakdown-grid {
      display: flex; flex-direction: column; gap: 8px;
    }
    .ib-card {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 16px; background: var(--surface); border-radius: 10px;
      border: 1px solid var(--border);
    }
    .ib-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--purple-soft); color: var(--purple);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .ib-icon mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .ib-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .ib-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .ib-meta { font-size: 12px; color: var(--text-secondary); }
    .ib-value {
      font-size: 14px; font-weight: 700; color: var(--teal);
      font-family: 'SF Mono', 'Cascadia Code', monospace; white-space: nowrap;
    }

    .ib-total-row {
      display: flex; align-items: center; justify-content: flex-end; gap: 24px;
      padding: 12px 16px 0; margin-top: 8px;
      border-top: 2px solid var(--border);
    }
    .ib-total-row span:first-child {
      margin-right: auto; font-size: 13px; font-weight: 700; color: var(--text-primary);
    }
    .ib-total-qty {
      font-size: 13px; font-weight: 700; color: var(--text-primary);
      font-family: 'SF Mono', 'Cascadia Code', monospace;
    }
    .ib-total-val {
      font-size: 14px; font-weight: 800; color: var(--teal);
      font-family: 'SF Mono', 'Cascadia Code', monospace;
    }

    .prov-dist-table-wrap { overflow-x: auto; border-radius: 10px; border: 1px solid var(--border); }

    .equip-detail-empty {
      display: flex; align-items: center; gap: 10px;
      padding: 20px; color: var(--text-muted); font-size: 13px;
    }
    .equip-detail-empty mat-icon { font-size: 18px; width: 18px; height: 18px; opacity: 0.5; }

    /* ============================== */
    /*  NATIONAL GRID                 */
    /* ============================== */
    .national-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1px; background: var(--border);
    }
    .natl-card {
      background: var(--surface); padding: 24px 20px;
      text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px;
    }
    .natl-icon {
      width: 44px; height: 44px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; margin-bottom: 4px;
    }
    .natl-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .natl-icon.blue { background: var(--blue-soft); color: var(--blue); }
    .natl-icon.green { background: var(--green-soft); color: var(--green); }
    .natl-icon.orange { background: var(--orange-soft); color: var(--orange); }
    .natl-icon.purple { background: var(--purple-soft); color: var(--purple); }
    .natl-icon.teal { background: var(--teal-soft); color: var(--teal); }
    .natl-icon.red { background: var(--red-soft); color: var(--red); }
    .natl-val { font-size: 24px; font-weight: 800; color: var(--text-primary); line-height: 1.1; }
    .natl-lbl { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 500; }

    /* ============================== */
    /*  PROVINCIAL SALES GRID         */
    /* ============================== */
    .prov-sales-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1px; background: var(--border);
    }
    .prov-sale-card {
      background: var(--surface); padding: 20px 24px;
    }
    .psc-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .psc-province { font-weight: 700; color: var(--text-primary); font-size: 14px; }
    .psc-revenue { font-weight: 800; color: var(--green); font-size: 16px; }
    .psc-meta { display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
    .psc-bar-wrap { display: flex; align-items: center; gap: 10px; }
    .psc-bar-wrap mat-progress-bar { flex: 1; }
    .psc-rate { font-size: 12px; font-weight: 700; color: var(--text-secondary); min-width: 36px; text-align: right; }

    /* ============================== */
    /*  TOP PRODUCTS                  */
    /* ============================== */
    .top-products { display: flex; flex-direction: column; }
    .tp-row {
      display: flex; align-items: center; gap: 16px;
      padding: 14px 24px; border-bottom: 1px solid var(--border);
      transition: background 0.15s;
    }
    .tp-row:last-child { border-bottom: none; }
    .tp-row:hover { background: var(--surface-hover); }
    .tp-rank {
      font-size: 14px; font-weight: 800; min-width: 32px; text-align: center;
      padding: 4px 0; border-radius: var(--radius-sm); color: var(--text-muted);
    }
    .rank-1 { color: #d97706; background: #fef3c7; }
    .rank-2 { color: #6b7280; background: #f3f4f6; }
    .rank-3 { color: #92400e; background: #fde68a33; }
    .tp-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .tp-name { font-weight: 600; color: var(--text-primary); font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tp-meta { font-size: 12px; color: var(--text-muted); }
    .tp-revenue { font-weight: 800; color: var(--green); font-size: 15px; white-space: nowrap; }

    /* ============================== */
    /*  LOW STOCK ALERTS              */
    /* ============================== */
    .alert-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 12px; padding: 20px 24px;
    }
    .alert-card {
      background: white; border-radius: var(--radius-md); padding: 16px;
      border: 1px solid var(--orange-mid); box-shadow: var(--shadow-sm);
    }
    .alert-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .alert-name { font-weight: 700; color: var(--text-primary); font-size: 14px; }
    .alert-meta { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; }

    /* ============================== */
    /*  MODERN TABLE                  */
    /* ============================== */
    .table-wrap { overflow-x: auto; }
    .modern-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      min-width: 700px;
    }
    .modern-table thead { background: linear-gradient(135deg, #f0fdfa 0%, #f0f9ff 100%); }
    .modern-table th {
      padding: 12px 18px; text-align: left; font-weight: 700;
      color: #0d9488; text-transform: uppercase; font-size: 11px;
      letter-spacing: 0.5px; border-bottom: 2px solid #ccfbf1;
      white-space: nowrap; position: sticky; top: 0; background: linear-gradient(135deg, #f0fdfa 0%, #f0f9ff 100%);
    }
    .modern-table th.center { text-align: center; }
    .modern-table th.right { text-align: right; }
    .modern-table td {
      padding: 13px 18px; border-bottom: 1px solid #f1f5f9;
      color: var(--text-secondary); vertical-align: middle;
    }
    .modern-table tbody tr { transition: background 0.15s; }
    .modern-table tbody tr:hover { background: #f0fdfa; }
    .modern-table tbody tr:last-child td { border-bottom: none; }

    .primary-cell { font-weight: 600; color: var(--text-primary) !important; }
    .secondary-text { color: var(--text-secondary); }
    .mono-text { font-family: 'JetBrains Mono', 'Fira Code', 'Roboto Mono', monospace; font-size: 12px; color: var(--text-secondary); }
    .money-val { font-weight: 700; color: var(--green) !important; font-family: 'JetBrains Mono', 'Fira Code', monospace; }
    .danger-val { color: var(--red) !important; font-weight: 700; }
    .center { text-align: center !important; }
    .right { text-align: right !important; }
    .reason-cell { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .num-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 28px; height: 24px; padding: 0 8px;
      border-radius: 12px; font-weight: 700; font-size: 12px;
    }
    .num-badge.blue { background: var(--blue-soft); color: var(--blue); }
    .num-badge.subtle { background: #f1f5f9; color: var(--text-secondary); }

    .province-tag {
      display: inline-block; padding: 3px 10px; border-radius: 6px;
      background: var(--blue-soft); color: var(--blue); font-size: 12px; font-weight: 600;
    }
    .category-tag {
      display: inline-block; padding: 3px 10px; border-radius: 6px;
      background: var(--purple-soft); color: var(--purple); font-size: 12px; font-weight: 600;
    }

    .alert-row { background: var(--orange-soft) !important; }
    .alert-row:hover { background: #fef3c7 !important; }

    .empty-row {
      text-align: center !important; color: var(--text-muted) !important;
      padding: 40px 18px !important; font-style: italic;
    }

    /* ============================== */
    /*  STATUS TAGS                   */
    /* ============================== */
    .status-tag {
      display: inline-block; padding: 4px 12px; border-radius: 20px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.3px;
      text-transform: capitalize; white-space: nowrap;
    }
    .st-completed, .st-paid, .st-approved, .st-ok, .st-active {
      background: var(--green-soft); color: #16a34a; border: 1px solid var(--green-mid);
    }
    .st-pending, .st-scheduled, .st-processing, .st-in.progress, .st-inprogress {
      background: var(--blue-soft); color: #2563eb; border: 1px solid var(--blue-mid);
    }
    .st-warning, .st-cancelled, .st-overdue, .st-low.stock {
      background: var(--orange-soft); color: #d97706; border: 1px solid var(--orange-mid);
    }
    .st-rejected, .st-failed {
      background: var(--red-soft); color: #dc2626; border: 1px solid var(--red-mid);
    }
    .st-draft, .st-unknown, .st-0, .st-1, .st-2, .st-3 {
      background: #f1f5f9; color: var(--text-secondary); border: 1px solid var(--border);
    }

    /* ============================== */
    /*  EMPTY STATES                  */
    /* ============================== */
    .empty-placeholder {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 48px 20px; color: var(--text-muted); grid-column: 1 / -1;
      background: var(--surface);
    }
    .empty-placeholder.compact { padding: 32px 20px; }
    .empty-placeholder mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; opacity: 0.5; }
    .empty-placeholder p { margin: 0; font-size: 14px; }

    /* ============================== */
    /*  KPI DIALOG OVERLAY            */
    /* ============================== */
    .kpi-card.clickable { cursor: pointer; }

    .dialog-backdrop {
      position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px); z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    .dialog-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: 94vw; max-width: 720px; max-height: 85vh;
      background: var(--surface); border-radius: 20px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.1);
      z-index: 1001; display: flex; flex-direction: column;
      animation: dialogSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes dialogSlideIn {
      from { opacity: 0; transform: translate(-50%, -45%) scale(0.96); }
      to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    }

    .dialog-header {
      padding: 24px 28px 20px; display: flex; align-items: center;
      justify-content: space-between; border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    .dh-training { background: linear-gradient(135deg, var(--blue-soft), var(--blue-mid)); }
    .dh-participants { background: linear-gradient(135deg, var(--green-soft), var(--green-mid)); }
    .dh-trainers { background: linear-gradient(135deg, var(--orange-soft), var(--orange-mid)); }
    .dh-deliveries { background: linear-gradient(135deg, var(--purple-soft), var(--purple-mid)); }
    .dh-revenue { background: linear-gradient(135deg, var(--teal-soft), var(--teal-mid)); }
    .dh-inventory { background: linear-gradient(135deg, var(--red-soft), var(--red-mid)); }

    .dialog-title-group { display: flex; align-items: center; gap: 14px; }
    .dialog-icon-ring {
      width: 46px; height: 46px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .dialog-training .dialog-icon-ring { background: var(--blue); color: white; }
    .dialog-participants .dialog-icon-ring { background: var(--green); color: white; }
    .dialog-trainers .dialog-icon-ring { background: var(--orange); color: white; }
    .dialog-deliveries .dialog-icon-ring { background: var(--purple); color: white; }
    .dialog-revenue .dialog-icon-ring { background: var(--teal); color: white; }
    .dialog-inventory .dialog-icon-ring { background: var(--red); color: white; }
    .dialog-icon-ring mat-icon { font-size: 24px; width: 24px; height: 24px; }

    .dialog-title { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; line-height: 1.2; }
    .dialog-subtitle { font-size: 12px; color: var(--text-secondary); margin: 3px 0 0; }

    .dialog-close {
      width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border);
      background: var(--surface); display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.15s; color: var(--text-secondary); flex-shrink: 0;
    }
    .dialog-close:hover { background: var(--red-soft); color: var(--red); border-color: var(--red-mid); }
    .dialog-close mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .dialog-body {
      padding: 24px 28px 28px; overflow-y: auto; flex: 1;
    }

    .dialog-loading {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 48px 20px; gap: 12px; color: var(--text-muted);
    }
    .dialog-loading p { margin: 0; font-size: 13px; }

    .dialog-empty {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 40px 20px; color: var(--text-muted);
    }
    .dialog-empty mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.4; margin-bottom: 8px; }
    .dialog-empty p { margin: 0; font-size: 14px; }

    /* Dialog Stats Row */
    .dialog-stats-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px; margin-bottom: 24px;
    }
    .dialog-stat {
      padding: 16px 18px; border-radius: 14px; text-align: center;
      display: flex; flex-direction: column; gap: 4px;
    }
    .dialog-stat.blue { background: var(--blue-soft); }
    .dialog-stat.green { background: var(--green-soft); }
    .dialog-stat.orange { background: var(--orange-soft); }
    .dialog-stat.purple { background: var(--purple-soft); }
    .dialog-stat.teal { background: var(--teal-soft); }
    .dialog-stat.red { background: var(--red-soft); }
    .ds-val { font-size: 22px; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
    .ds-lbl { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 600; }

    .dialog-section-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 14px; font-weight: 700; color: var(--text-primary);
      margin: 0 0 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
    }
    .dialog-section-title mat-icon { font-size: 18px; width: 18px; height: 18px; color: var(--text-secondary); }
    .dialog-section-title.warn-title { color: var(--orange); margin-top: 24px; }
    .dialog-section-title.warn-title mat-icon { color: var(--orange); }

    /* Dialog Table */
    .dialog-table-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid var(--border); }
    .dialog-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .dialog-table thead { background: #f8fafc; }
    .dialog-table th {
      padding: 10px 16px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.4px; color: var(--text-secondary);
      border-bottom: 1px solid var(--border); white-space: nowrap;
    }
    .dialog-table td {
      padding: 10px 16px; border-bottom: 1px solid #f1f5f9; color: var(--text-primary);
    }
    .dialog-table tbody tr:last-child td { border-bottom: none; }
    .dialog-table tbody tr:hover { background: #f0fdfa; }
    .dialog-table .right { text-align: right; }
    .dialog-table .mono-text { font-family: 'SF Mono', 'Cascadia Code', monospace; font-size: 13px; }
    .dialog-table .primary-cell { font-weight: 600; }
    .dialog-table .danger-val { color: var(--red); font-weight: 600; }
    .dialog-table tfoot td { border-top: 2px solid var(--border); background: #f8fafc; }
    .total-row td { font-size: 13px; }
    .low-stock-row { background: var(--red-soft) !important; }

    .rate-pill {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      font-size: 12px; font-weight: 700;
    }
    .rate-pill.good { background: var(--green-soft); color: var(--green); }
    .rate-pill.mid { background: var(--orange-soft); color: var(--orange); }
    .rate-pill.low { background: var(--red-soft); color: var(--red); }

    /* Participant Bars */
    .dialog-province-bars { display: flex; flex-direction: column; gap: 10px; }
    .bar-row { display: flex; align-items: center; gap: 12px; }
    .bar-label { width: 120px; font-size: 13px; font-weight: 600; color: var(--text-primary); text-align: right; flex-shrink: 0; }
    .bar-track { flex: 1; height: 26px; background: #f1f5f9; border-radius: 8px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 8px; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); min-width: 4px; }
    .bar-fill.green-fill { background: linear-gradient(90deg, var(--green), #4ade80); }
    .bar-value { width: 60px; font-size: 13px; font-weight: 700; color: var(--text-primary); font-family: 'SF Mono', monospace; }

    /* Trainer Cards */
    .trainer-cards-grid { display: flex; flex-direction: column; gap: 10px; }
    .trainer-card {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 18px; border-radius: 14px;
      border: 1px solid var(--border); background: var(--surface);
      transition: all 0.15s;
    }
    .trainer-card:hover { background: var(--surface-hover); box-shadow: var(--shadow-sm); }
    .trainer-avatar {
      width: 44px; height: 44px; border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; font-weight: 800; color: white; flex-shrink: 0;
      letter-spacing: 0.5px;
    }
    .ta-0 { background: linear-gradient(135deg, var(--blue), #60a5fa); }
    .ta-1 { background: linear-gradient(135deg, var(--green), #4ade80); }
    .ta-2 { background: linear-gradient(135deg, var(--orange), #fbbf24); }
    .ta-3 { background: linear-gradient(135deg, var(--purple), #a78bfa); }
    .ta-4 { background: linear-gradient(135deg, var(--teal), #2dd4bf); }
    .trainer-info { display: flex; flex-direction: column; flex: 1; min-width: 0; }
    .trainer-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .trainer-detail { font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .trainer-badge {
      padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; flex-shrink: 0;
    }
    .trainer-badge.active { background: var(--green-soft); color: var(--green); }
    .trainer-badge.inactive { background: var(--red-soft); color: var(--red); }

    /* Revenue Split Layout */
    .dialog-split { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .top-product-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 0; border-bottom: 1px solid #f1f5f9;
    }
    .top-product-row:last-child { border-bottom: none; }
    .tp-rank {
      width: 28px; height: 28px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800; flex-shrink: 0;
    }
    .tp-rank.rank-0 { background: linear-gradient(135deg, #fbbf24, #f59e0b); color: white; }
    .tp-rank.rank-1 { background: linear-gradient(135deg, #cbd5e1, #94a3b8); color: white; }
    .tp-rank.rank-2 { background: linear-gradient(135deg, #d97706, #b45309); color: white; }
    .tp-rank.rank-rest { background: #f1f5f9; color: var(--text-secondary); }
    .tp-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .tp-name { font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tp-sub { font-size: 11px; color: var(--text-muted); }
    .tp-rev { font-size: 13px; font-weight: 700; color: var(--teal); font-family: 'SF Mono', monospace; white-space: nowrap; }

    /* Order Status Donuts */
    .status-donut-row { display: flex; gap: 24px; justify-content: center; padding: 16px 0; }
    .donut-stat { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .donut-stat span { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
    .donut-circle {
      width: 64px; height: 64px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 800; color: var(--text-primary);
      border: 4px solid var(--border);
    }
    .donut-circle.green-ring { border-color: var(--green); background: var(--green-soft); }
    .donut-circle.orange-ring { border-color: var(--orange); background: var(--orange-soft); }

    /* ============================== */
    /*  RESPONSIVE                    */
    /* ============================== */
    /* ============================== */
    /*  REQUEST DELIVERY BUTTON        */
    /* ============================== */
    .request-delivery-btn {
      background: linear-gradient(135deg, #f59e0b, #ef4444) !important;
      color: white !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
      border-radius: 12px !important;
      font-weight: 700 !important;
      backdrop-filter: blur(8px);
      display: flex; align-items: center; gap: 6px;
    }
    .request-delivery-btn:hover {
      background: linear-gradient(135deg, #fbbf24, #f87171) !important;
      box-shadow: 0 4px 16px rgba(245,158,11,0.35) !important;
    }

    /* ============================== */
    /*  DELIVERY DIALOG                */
    /* ============================== */
    .dlg-backdrop {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.5);
      backdrop-filter: blur(4px);
      z-index: 1000;
      animation: fadeIn 0.2s ease;
    }
    .dlg-panel {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 94vw; max-width: 580px; max-height: 85vh;
      background: var(--surface); border-radius: 24px;
      box-shadow: 0 25px 60px rgba(0,0,0,0.25);
      z-index: 1001;
      display: flex; flex-direction: column;
      animation: dialogSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
    }
    .dlg-header {
      padding: 24px 28px 20px;
      background: linear-gradient(135deg, #0d9488, #0891b2, #3b82f6);
      display: flex; align-items: center; justify-content: space-between;
    }
    .dlg-title-group { display: flex; align-items: center; gap: 14px; }
    .dlg-icon-ring {
      width: 46px; height: 46px; border-radius: 14px;
      background: rgba(255,255,255,0.2);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.25);
      display: flex; align-items: center; justify-content: center;
    }
    .dlg-icon-ring mat-icon { color: white; font-size: 24px; width: 24px; height: 24px; }
    .dlg-title { font-size: 18px; font-weight: 700; color: white; margin: 0; }
    .dlg-subtitle { font-size: 12px; color: rgba(255,255,255,0.75); margin: 3px 0 0; }
    .dlg-close {
      width: 36px; height: 36px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(255,255,255,0.1);
      color: rgba(255,255,255,0.8);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.15s;
    }
    .dlg-close:hover { background: rgba(255,255,255,0.2); color: white; }
    .dlg-close mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .dlg-body { padding: 28px; overflow-y: auto; flex: 1; }

    .dlg-form { display: flex; flex-direction: column; gap: 18px; }
    .dlg-row { display: flex; gap: 16px; }
    .dlg-row.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .dlg-field { display: flex; flex-direction: column; gap: 6px; }
    .dlg-label {
      font-size: 12px; font-weight: 700; color: var(--text-secondary);
      text-transform: uppercase; letter-spacing: 0.4px;
    }
    .dlg-label .req { color: var(--red); }
    .dlg-label .opt { color: var(--text-muted); font-weight: 500; text-transform: none; letter-spacing: 0; }
    .dlg-input, .dlg-select {
      padding: 10px 14px; border: 1.5px solid var(--border);
      border-radius: 12px; font-size: 14px; color: var(--text-primary);
      background: var(--surface); outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .dlg-input:focus, .dlg-select:focus {
      border-color: #0d9488;
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
    }
    .dlg-input::placeholder { color: var(--text-muted); }

    /* Address Autocomplete */
    .address-input-wrap {
      position: relative; display: flex; align-items: center;
    }
    .address-loc-icon {
      position: absolute; left: 12px;
      font-size: 20px; width: 20px; height: 20px;
      color: #ef5350; z-index: 1; pointer-events: none;
    }
    .address-input {
      padding-left: 40px !important;
      padding-right: 40px !important;
    }
    .address-verified {
      position: absolute; right: 12px;
      font-size: 20px; width: 20px; height: 20px;
      color: #22c55e;
      animation: addrPopIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes addrPopIn {
      0% { transform: scale(0); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }
    .address-confirmed-text {
      display: block; font-size: 11px; color: #22c55e;
      font-weight: 600; margin-top: 4px; padding-left: 2px;
    }

    /* Preview */
    .dlg-preview {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-radius: 12px;
      background: #f0fdfa; border: 1px solid #ccfbf1;
      color: var(--text-secondary); font-size: 13px;
    }
    .dlg-preview mat-icon { color: var(--teal); font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }

    /* Actions */
    .dlg-actions {
      display: flex; justify-content: flex-end; gap: 12px; padding-top: 8px;
    }
    .btn-submit-delivery {
      background: linear-gradient(135deg, #0d9488, #3b82f6) !important;
      color: white !important; border-radius: 12px !important;
      font-weight: 700 !important; display: flex; align-items: center; gap: 6px;
    }
    .btn-submit-delivery:disabled { opacity: 0.5; }

    /* Success */
    .dlg-success {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; padding: 20px 0;
    }
    .dlg-success-icon {
      width: 64px; height: 64px; border-radius: 50%;
      background: #f0fdf4; display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
    }
    .dlg-success-icon mat-icon { font-size: 36px; width: 36px; height: 36px; color: #22c55e; }
    .dlg-success h3 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0 0 6px; }
    .dlg-success p { font-size: 14px; color: var(--text-secondary); margin: 0 0 20px; }
    .dlg-success-actions { display: flex; gap: 12px; }
    .btn-another {
      background: linear-gradient(135deg, #0d9488, #3b82f6) !important;
      color: white !important; border-radius: 12px !important; font-weight: 600 !important;
    }

    /* Error */
    .dlg-error {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-radius: 10px;
      background: #fef2f2; border: 1px solid #fecaca;
      color: #dc2626; font-size: 13px; font-weight: 600;
      margin-bottom: 16px;
    }
    .dlg-error mat-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }

    /* ============================== */
    /*  CRUD EDIT DIALOG & ACTIONS    */
    /* ============================== */
    .add-btn {
      background: linear-gradient(135deg, #0d9488, #3b82f6) !important;
      color: white !important; border-radius: 12px !important;
      font-weight: 600 !important; margin-left: 8px;
    }
    .actions-cell {
      white-space: nowrap;
    }
    .action-edit {
      color: var(--blue) !important;
      width: 32px !important; height: 32px !important;
    }
    .action-edit mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .action-delete {
      color: var(--red) !important;
      width: 32px !important; height: 32px !important;
    }
    .action-delete mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .crud-panel {
      max-width: 680px;
    }
    .delete-panel {
      max-width: 480px;
    }
    .delete-header {
      background: linear-gradient(135deg, #ef4444, #dc2626) !important;
    }
    .delete-icon-ring {
      background: rgba(255,255,255,0.2) !important;
    }
    .delete-icon-ring mat-icon {
      color: white !important;
    }
    .delete-message {
      font-size: 15px; color: var(--text-secondary);
      margin: 0 0 20px; line-height: 1.6;
    }
    .btn-delete-confirm {
      background: linear-gradient(135deg, #ef4444, #dc2626) !important;
      color: white !important; border-radius: 12px !important;
      font-weight: 700 !important; display: flex; align-items: center; gap: 6px;
    }
    .btn-delete-confirm:disabled { opacity: 0.5; }
    .checkbox-label {
      display: flex !important; align-items: center; gap: 8px;
      cursor: pointer; font-weight: 500 !important;
    }
    .checkbox-label input[type="checkbox"] {
      width: 18px; height: 18px; accent-color: #0d9488;
    }
    .panel-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px; flex-wrap: wrap;
    }

    /* Update Stock button & dialog */
    .update-stock-btn {
      background: linear-gradient(135deg, #f59e0b, #d97706) !important;
      color: white !important; border-radius: 12px !important;
      font-weight: 600 !important; margin-left: 8px;
    }
    .stock-panel { max-width: 600px; }
    .stock-header {
      background: linear-gradient(135deg, #f59e0b, #d97706) !important;
    }
    .stock-icon-ring {
      background: rgba(255,255,255,0.2) !important;
    }
    .stock-icon-ring mat-icon { color: white !important; }
    .stock-current-info {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
      padding: 14px 16px; border-radius: 12px;
      background: #fffbeb; border: 1px solid #fef3c7; margin-bottom: 16px;
    }
    .sci-item { display: flex; flex-direction: column; gap: 2px; }
    .sci-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 600; letter-spacing: 0.3px; }
    .sci-value { font-size: 15px; font-weight: 700; color: var(--text-primary); }
    .stock-preview {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-radius: 12px;
      background: #f0fdfa; border: 1px solid #ccfbf1;
      color: var(--text-secondary); font-size: 13px;
      margin-bottom: 8px;
    }
    .stock-preview mat-icon { color: var(--orange); font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; }
    .stock-arrow { font-size: 16px !important; width: 16px !important; height: 16px !important; vertical-align: middle; color: var(--text-muted); margin: 0 4px; }
    .good-val { color: var(--green) !important; }
    .btn-stock-save {
      background: linear-gradient(135deg, #f59e0b, #d97706) !important;
      color: white !important; border-radius: 12px !important;
      font-weight: 700 !important; display: flex; align-items: center; gap: 6px;
    }
    .btn-stock-save:disabled { opacity: 0.5; }

    @media (max-width: 1100px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
      .tab-body { padding: 20px; }
      .province-grid { grid-template-columns: repeat(2, 1fr); }
      .prov-sales-grid, .national-grid { grid-template-columns: 1fr; }
      .equip-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; padding: 14px; }
      .equip-summary-strip { gap: 0; }
      .ess-item { min-width: 100px; padding: 12px 14px; }
      .ess-value { font-size: 16px; }
      .edp-stats { flex-wrap: wrap; }
      .prov-metrics { grid-template-columns: repeat(2, 1fr); }
      .stat-bar { gap: 10px; }
      .stat-chip { min-width: 130px; padding: 12px 14px; }
      .dialog-split { grid-template-columns: 1fr; }
      .dialog-panel { max-width: 95vw; }
    }
    @media (max-width: 600px) {
      .kpi-grid { grid-template-columns: 1fr 1fr; }
      .hero-header { padding: 20px 24px; margin: -24px -24px 24px; }
      .hero-text h1 { font-size: 20px; }
      .dlg-panel { width: 100vw; max-height: 95vh; border-radius: 16px 16px 0 0;
        top: auto; bottom: 0; left: 0; transform: none; }
      .dlg-body { padding: 20px; }
      .dlg-row.two-col { grid-template-columns: 1fr; }
      .stat-bar { flex-direction: column; }
      .alert-grid { grid-template-columns: 1fr; }
      .province-grid { grid-template-columns: 1fr; }
      .dialog-panel { width: 100vw; max-height: 95vh; border-radius: 16px 16px 0 0;
        top: auto; bottom: 0; left: 0; transform: none; }
      .dialog-body { padding: 20px; }
      .dialog-header { padding: 18px 20px 16px; }
      .dialog-stats-row { grid-template-columns: repeat(2, 1fr); }
      .bar-label { width: 80px; font-size: 11px; }
      .dialog-split { grid-template-columns: 1fr; }
    }
  `]
})
export class HBA1CDashboardComponent implements OnInit, OnDestroy {
  @Output() goBack = new EventEmitter<void>();
  @ViewChild('deliveryAddressInput') deliveryAddressInputRef!: ElementRef<HTMLInputElement>;

  private destroy$ = new Subject<void>();

  dashboard: HBA1CProjectDashboard | null = null;
  loading = true;
  error: string | null = null;
  isConnected = false;

  // Delivery Request
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

  trainingSessions: HBA1CTrainingSession[] = [];
  trainingLoading = false;

  inventoryItems: HBA1CInventoryItem[] = [];
  inventoryLoading = false;

  salesList: HBA1CSale[] = [];
  salesLoading = false;

  creditNotes: HBA1CCreditNote[] = [];
  creditNotesLoading = false;

  // Dialog state
  activeDialog: string | null = null;
  dialogLoading = false;
  dialogTrainers: HBA1CTrainer[] = [];

  // Loading progress state
  loadingProgress = 0;
  loadingStage = 0;
  loadingMessage = 'Initializing connection...';
  private progressInterval: any;
  readonly loadingSteps = [
    { icon: 'lock', label: 'Authenticating', detail: 'Securing API connection...' },
    { icon: 'cloud_download', label: 'Fetching Data', detail: 'Retrieving training & sales records...' },
    { icon: 'precision_manufacturing', label: 'Loading Equipment', detail: 'Processing inventory & orders...' },
    { icon: 'dashboard', label: 'Building Dashboard', detail: 'Assembling analytics & KPIs...' }
  ];

  // Equipment expand state
  expandedEquipment: string | null = null;

  // CRUD state
  showEditDialog = false;
  showDeleteDialog = false;
  editEntity: 'training' | 'inventory' | 'sale' | 'creditNote' = 'training';
  editMode: 'create' | 'edit' = 'create';
  editSaving = false;
  editError = '';
  editSuccess = false;
  editItemId: number | null = null;
  deleteItemName = '';

  trainingForm = {
    trainingName: '', trainingType: '', startDate: '', provinceId: 0,
    venue: '', targetAudience: '', numberOfParticipants: 0, status: 0
  };

  inventoryForm = {
    name: '', description: '', category: 0, sku: '', unitOfMeasure: '',
    unitPrice: 0, stockAvailable: 0, reorderLevel: 0, supplier: '',
    batchNumber: '', expiryDate: ''
  };

  saleForm = {
    saleNumber: '', saleDate: '', customerName: '', customerPhone: '',
    total: 0, notes: ''
  };

  creditNoteForm = {
    creditNoteNumber: '', invoiceNumber: '', customerName: '',
    originalAmount: 0, creditAmount: 0, reason: '', status: 'Pending',
    notes: '', reverseStock: false, reverseSale: false
  };

  // Stock update state
  showStockDialog = false;
  stockSaving = false;
  stockError = '';
  stockSuccess = false;
  stockSuccessMsg = '';
  stockForm = {
    itemId: 0, itemName: '', itemSku: '', currentStock: 0,
    reorderLevel: 0, adjustType: 'set' as 'set' | 'add' | 'subtract',
    quantity: 0
  };

  constructor(
    private hba1cService: HBA1CService,
    private http: HttpClient,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopLoadingProgress();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = null;
    this.startLoadingProgress();

    this.hba1cService.getDashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.finishLoadingProgress(() => {
            this.dashboard = data;
            this.isConnected = true;
            this.loading = false;
            if (data.recentTrainings) {
              this.trainingSessions = data.recentTrainings;
            }
            if (data.recentSales) {
              this.salesList = data.recentSales;
            }
          });
        },
        error: (err) => {
          this.stopLoadingProgress();
          this.loading = false;
          this.isConnected = false;
          this.error = err.error?.message || err.message || 'Failed to connect to HBA1C API.';
          console.error('HBA1C Dashboard error:', err);
        }
      });
  }

  private startLoadingProgress(): void {
    this.loadingProgress = 0;
    this.loadingStage = 0;
    this.loadingMessage = this.loadingSteps[0].detail;
    let tick = 0;
    this.progressInterval = setInterval(() => {
      tick++;
      // Slow down as we get higher — never exceeds 88% until real data arrives
      const maxBeforeData = 88;
      if (this.loadingProgress < maxBeforeData) {
        const increment = Math.max(0.3, (maxBeforeData - this.loadingProgress) * 0.06);
        this.loadingProgress = Math.min(maxBeforeData, this.loadingProgress + increment);
      }
      // Update stage based on progress
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
    // Animate quickly to 100%
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

  onTabChange(index: number): void {
    switch (index) {
      case 1:
        if (!this.trainingSessions.length || this.trainingSessions.length <= 10) this.loadTraining();
        break;
      case 2:
        if (!this.inventoryItems.length) this.loadInventory();
        break;
      case 3:
        if (!this.salesList.length || this.salesList.length <= 10) this.loadSales();
        break;
      case 4:
        if (!this.creditNotes.length) this.loadCreditNotes();
        break;
    }
  }

  loadTraining(): void {
    this.trainingLoading = true;
    this.hba1cService.getAllTraining()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.trainingSessions = data || []; this.trainingLoading = false; },
        error: () => { this.trainingLoading = false; }
      });
  }

  loadInventory(): void {
    this.inventoryLoading = true;
    this.hba1cService.getAllInventory()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.inventoryItems = data || []; this.inventoryLoading = false; },
        error: () => { this.inventoryLoading = false; }
      });
  }

  loadSales(): void {
    this.salesLoading = true;
    this.hba1cService.getAllSales()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.salesList = data || []; this.salesLoading = false; },
        error: () => { this.salesLoading = false; }
      });
  }

  loadCreditNotes(): void {
    this.creditNotesLoading = true;
    this.hba1cService.getCreditNotes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.creditNotes = data || []; this.creditNotesLoading = false; },
        error: () => { this.creditNotesLoading = false; }
      });
  }

  getTrainerName(session: HBA1CTrainingSession): string {
    if (session.trainer) {
      return `${session.trainer.firstName || ''} ${session.trainer.lastName || ''}`.trim();
    }
    return 'N/A';
  }

  // ── KPI Dialog Methods ──

  openKpiDialog(type: string): void {
    this.activeDialog = type;
    this.dialogLoading = false;

    // Load extra data for trainers dialog
    if (type === 'trainers' && !this.dialogTrainers.length) {
      this.dialogLoading = true;
      this.hba1cService.getTrainers()
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (data) => { this.dialogTrainers = data || []; this.dialogLoading = false; },
          error: () => { this.dialogLoading = false; }
        });
    }
  }

  closeDialog(): void {
    this.activeDialog = null;
  }

  getTotalSessions(): number {
    return (this.dashboard?.provinceStats || []).reduce((sum, p) => sum + p.sessions, 0);
  }

  getTotalParticipants(): number {
    return this.dashboard?.trainingStats?.totalParticipants || 0;
  }

  getAvgParticipants(): number {
    const total = this.dashboard?.trainingStats?.totalParticipants || 0;
    const sessions = this.dashboard?.trainingStats?.totalSessions || 1;
    return total / sessions;
  }

  getParticipantPercent(participants: number): number {
    const max = Math.max(...(this.dashboard?.provinceStats || []).map(p => p.participants), 1);
    return (participants / max) * 100;
  }

  getAvgSessionsPerTrainer(): number {
    const sessions = this.dashboard?.trainingStats?.totalSessions || 0;
    const trainers = this.dashboard?.nationalTotals?.totalTrainers || 1;
    return sessions / trainers;
  }

  // ── Delivery Request Methods ──

  openDeliveryDialog(): void {
    this.resetDeliveryForm();
    this.showDeliveryDialog = true;
    setTimeout(() => this.initAddressAutocomplete(), 150);
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
    setTimeout(() => this.initAddressAutocomplete(), 150);
  }

  isDeliveryFormValid(): boolean {
    return !!(this.deliveryForm.description.trim() && this.deliveryForm.quantity > 0);
  }

  submitDeliveryRequest(): void {
    if (!this.isDeliveryFormValid()) return;
    this.deliverySaving = true;
    this.deliveryError = '';

    const payload = {
      department: 'HBA1C',
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

  private initAddressAutocomplete(): void {
    if (!this.deliveryAddressInputRef?.nativeElement) return;
    if (typeof google === 'undefined' || !google.maps?.places) return;
    this.autocomplete = new google.maps.places.Autocomplete(
      this.deliveryAddressInputRef.nativeElement,
      { types: ['address'], componentRestrictions: { country: 'za' } }
    );
    this.autocomplete.addListener('place_changed', () => {
      this.ngZone.run(() => {
        const place = this.autocomplete!.getPlace();
        if (place?.formatted_address) {
          this.deliveryForm.deliveryAddress = place.formatted_address;
          this.addressVerified = true;
        } else if (place?.name) {
          this.deliveryForm.deliveryAddress = place.name;
          this.addressVerified = true;
        }
      });
    });
  }

  // ── Stock Update Methods ──

  openStockUpdateDialog(): void {
    this.resetStockForm();
    this.showStockDialog = true;
    // If inventory not loaded yet, load it
    if (!this.inventoryItems.length) this.loadInventory();
  }

  closeStockDialog(): void {
    this.showStockDialog = false;
    this.stockError = '';
    this.stockSuccess = false;
    this.stockSaving = false;
  }

  resetStockForm(): void {
    this.stockForm = {
      itemId: 0, itemName: '', itemSku: '', currentStock: 0,
      reorderLevel: 0, adjustType: 'set', quantity: 0
    };
    this.stockError = '';
    this.stockSuccess = false;
    this.stockSuccessMsg = '';
    this.stockSaving = false;
  }

  onStockItemChange(): void {
    const item = this.inventoryItems.find(i => i.id === this.stockForm.itemId);
    if (item) {
      this.stockForm.itemName = item.name;
      this.stockForm.itemSku = item.sku;
      this.stockForm.currentStock = item.stockAvailable;
      this.stockForm.reorderLevel = item.reorderLevel;
      this.stockForm.quantity = item.stockAvailable;
    }
  }

  getNewStockValue(): number {
    const { adjustType, quantity, currentStock } = this.stockForm;
    if (adjustType === 'set') return quantity;
    if (adjustType === 'add') return currentStock + quantity;
    return Math.max(0, currentStock - quantity);
  }

  getStockDiff(): string {
    const diff = this.getNewStockValue() - this.stockForm.currentStock;
    if (diff === 0) return 'no change';
    return diff > 0 ? `+${diff}` : `${diff}`;
  }

  saveStockUpdate(): void {
    if (this.stockForm.itemId === 0) return;
    this.stockSaving = true;
    this.stockError = '';

    const newStock = this.getNewStockValue();
    const item = this.inventoryItems.find(i => i.id === this.stockForm.itemId);
    if (!item) { this.stockSaving = false; this.stockError = 'Item not found'; return; }

    const payload: any = {
      name: item.name,
      description: item.description,
      category: item.category,
      sku: item.sku,
      unitOfMeasure: item.unitOfMeasure,
      unitPrice: item.unitPrice,
      stockAvailable: newStock,
      reorderLevel: item.reorderLevel,
      supplier: item.supplier,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate
    };

    this.hba1cService.updateInventoryItem(this.stockForm.itemId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.stockSaving = false;
          this.stockSuccess = true;
          const diff = newStock - this.stockForm.currentStock;
          const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
          this.stockSuccessMsg = `${this.stockForm.itemName}: ${this.stockForm.currentStock} → ${newStock} (${diffStr})`;
          this.loadInventory();
        },
        error: (err) => {
          this.stockSaving = false;
          this.stockError = err.error?.message || 'Failed to update stock level';
        }
      });
  }

  // ── Equipment Methods ──

  toggleEquipment(equipmentType: string): void {
    this.expandedEquipment = this.expandedEquipment === equipmentType ? null : equipmentType;
  }

  getEquipTotalOrdered(eq: HBA1CEquipmentDistribution): number {
    if (eq.totalOrdered > 0) return eq.totalOrdered;
    return (eq.itemBreakdown || []).reduce((sum, item) => sum + item.quantity, 0);
  }

  getEquipRate(eq: HBA1CEquipmentDistribution): number {
    if (eq.deliveryRate > 0) return eq.deliveryRate;
    const ordered = this.getEquipTotalOrdered(eq);
    if (ordered === 0) return 0;
    return (eq.totalDelivered / ordered) * 100;
  }

  getItemBreakdownTotal(eq: HBA1CEquipmentDistribution, type: 'qty' | 'val'): number {
    return (eq.itemBreakdown || []).reduce(
      (sum, item) => sum + (type === 'qty' ? item.quantity : item.value), 0
    );
  }

  // ── CRUD Methods ──

  openCreateDialog(entity: 'training' | 'inventory' | 'sale' | 'creditNote'): void {
    this.editEntity = entity;
    this.editMode = 'create';
    this.editItemId = null;
    this.editError = '';
    this.editSuccess = false;
    this.resetEditForms();
    this.showEditDialog = true;
  }

  openEditDialog(entity: 'training' | 'inventory' | 'sale' | 'creditNote', item: any): void {
    this.editEntity = entity;
    this.editMode = 'edit';
    this.editError = '';
    this.editSuccess = false;

    if (entity === 'training') {
      this.editItemId = item.id;
      this.trainingForm = {
        trainingName: item.trainingName || '',
        trainingType: item.trainingType || '',
        startDate: item.startDate ? item.startDate.substring(0, 10) : '',
        provinceId: item.provinceId || 0,
        venue: item.venue || '',
        targetAudience: item.targetAudience || '',
        numberOfParticipants: item.numberOfParticipants || 0,
        status: item.status ?? 0
      };
    } else if (entity === 'inventory') {
      this.editItemId = item.id;
      this.inventoryForm = {
        name: item.name || '',
        description: item.description || '',
        category: item.category || 0,
        sku: item.sku || '',
        unitOfMeasure: item.unitOfMeasure || '',
        unitPrice: item.unitPrice || 0,
        stockAvailable: item.stockAvailable || 0,
        reorderLevel: item.reorderLevel || 0,
        supplier: item.supplier || '',
        batchNumber: item.batchNumber || '',
        expiryDate: item.expiryDate ? item.expiryDate.substring(0, 10) : ''
      };
    } else if (entity === 'sale') {
      this.editItemId = item.id;
      this.saleForm = {
        saleNumber: item.saleNumber || '',
        saleDate: item.saleDate ? item.saleDate.substring(0, 10) : '',
        customerName: item.customerName || '',
        customerPhone: item.customerPhone || '',
        total: item.total || 0,
        notes: item.notes || ''
      };
    } else if (entity === 'creditNote') {
      this.editItemId = item.id;
      this.creditNoteForm = {
        creditNoteNumber: item.creditNoteNumber || '',
        invoiceNumber: item.invoiceNumber || '',
        customerName: item.customerName || '',
        originalAmount: item.originalAmount || 0,
        creditAmount: item.creditAmount || 0,
        reason: item.reason || '',
        status: item.status || 'Pending',
        notes: item.notes || '',
        reverseStock: item.reverseStock || false,
        reverseSale: item.reverseSale || false
      };
    }

    this.showEditDialog = true;
  }

  closeEditDialog(): void {
    this.showEditDialog = false;
    this.editError = '';
    this.editSuccess = false;
    this.editSaving = false;
  }

  openDeleteDialog(entity: 'training' | 'inventory' | 'sale' | 'creditNote', id: number, name: string): void {
    this.editEntity = entity;
    this.editItemId = id;
    this.deleteItemName = name;
    this.editError = '';
    this.editSaving = false;
    this.showDeleteDialog = true;
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog = false;
    this.editError = '';
    this.editSaving = false;
  }

  private resetEditForms(): void {
    this.trainingForm = {
      trainingName: '', trainingType: '', startDate: '', provinceId: 0,
      venue: '', targetAudience: '', numberOfParticipants: 0, status: 0
    };
    this.inventoryForm = {
      name: '', description: '', category: 0, sku: '', unitOfMeasure: '',
      unitPrice: 0, stockAvailable: 0, reorderLevel: 0, supplier: '',
      batchNumber: '', expiryDate: ''
    };
    this.saleForm = {
      saleNumber: '', saleDate: '', customerName: '', customerPhone: '',
      total: 0, notes: ''
    };
    this.creditNoteForm = {
      creditNoteNumber: '', invoiceNumber: '', customerName: '',
      originalAmount: 0, creditAmount: 0, reason: '', status: 'Pending',
      notes: '', reverseStock: false, reverseSale: false
    };
  }

  saveEditForm(): void {
    this.editSaving = true;
    this.editError = '';

    if (this.editEntity === 'training') {
      const payload: any = { ...this.trainingForm };
      if (this.editMode === 'create') {
        this.hba1cService.createTraining(payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => { this.editSaving = false; this.editSuccess = true; this.loadTraining(); },
          error: (err) => { this.editSaving = false; this.editError = err.error?.message || 'Failed to create training session'; }
        });
      } else {
        this.hba1cService.updateTraining(this.editItemId!, payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => { this.editSaving = false; this.editSuccess = true; this.loadTraining(); },
          error: (err) => { this.editSaving = false; this.editError = err.error?.message || 'Failed to update training session'; }
        });
      }
    } else if (this.editEntity === 'inventory') {
      const payload: any = { ...this.inventoryForm };
      if (payload.expiryDate === '') payload.expiryDate = null;
      if (this.editMode === 'create') {
        this.hba1cService.createInventoryItem(payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => { this.editSaving = false; this.editSuccess = true; this.loadInventory(); },
          error: (err) => { this.editSaving = false; this.editError = err.error?.message || 'Failed to create inventory item'; }
        });
      } else {
        this.hba1cService.updateInventoryItem(this.editItemId!, payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => { this.editSaving = false; this.editSuccess = true; this.loadInventory(); },
          error: (err) => { this.editSaving = false; this.editError = err.error?.message || 'Failed to update inventory item'; }
        });
      }
    } else if (this.editEntity === 'sale') {
      const payload: any = { ...this.saleForm };
      if (this.editMode === 'create') {
        this.hba1cService.createSale(payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => { this.editSaving = false; this.editSuccess = true; this.loadSales(); },
          error: (err) => { this.editSaving = false; this.editError = err.error?.message || 'Failed to create sale'; }
        });
      } else {
        this.hba1cService.updateSale(this.editItemId!, payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => { this.editSaving = false; this.editSuccess = true; this.loadSales(); },
          error: (err) => { this.editSaving = false; this.editError = err.error?.message || 'Failed to update sale'; }
        });
      }
    } else if (this.editEntity === 'creditNote') {
      const payload: any = { ...this.creditNoteForm };
      if (this.editMode === 'create') {
        this.hba1cService.createCreditNote(payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => { this.editSaving = false; this.editSuccess = true; this.loadCreditNotes(); },
          error: (err) => { this.editSaving = false; this.editError = err.error?.message || 'Failed to create credit note'; }
        });
      } else {
        this.hba1cService.updateCreditNote(this.editItemId!, payload).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => { this.editSaving = false; this.editSuccess = true; this.loadCreditNotes(); },
          error: (err) => { this.editSaving = false; this.editError = err.error?.message || 'Failed to update credit note'; }
        });
      }
    }
  }

  confirmDelete(): void {
    if (!this.editItemId) return;
    this.editSaving = true;
    this.editError = '';

    let obs;
    if (this.editEntity === 'training') {
      obs = this.hba1cService.deleteTraining(this.editItemId);
    } else if (this.editEntity === 'inventory') {
      obs = this.hba1cService.deleteInventoryItem(this.editItemId);
    } else if (this.editEntity === 'sale') {
      obs = this.hba1cService.deleteSale(this.editItemId);
    } else {
      obs = this.hba1cService.deleteCreditNote(this.editItemId);
    }

    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.editSaving = false;
        this.closeDeleteDialog();
        // Reload the relevant list
        if (this.editEntity === 'training') this.loadTraining();
        else if (this.editEntity === 'inventory') this.loadInventory();
        else if (this.editEntity === 'sale') this.loadSales();
        else this.loadCreditNotes();
      },
      error: (err) => {
        this.editSaving = false;
        this.editError = err.error?.message || 'Failed to delete record';
      }
    });
  }
}
