import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
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
import { Subject, takeUntil } from 'rxjs';
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
  HBA1CEquipmentDistribution
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
    MatDividerModule
  ],
  template: `
    <!-- Back button -->
    <div class="detail-header">
      <button mat-raised-button class="back-btn" (click)="goBack.emit()">
        <mat-icon>arrow_back</mat-icon>
        Back to Projects
      </button>
      <h2>
        <mat-icon class="header-icon">biotech</mat-icon>
        HBA1C Medical Management
      </h2>
      <div class="connection-status" [class.connected]="isConnected" [class.disconnected]="!isConnected && !loading">
        <mat-icon>{{ loading ? 'sync' : isConnected ? 'cloud_done' : 'cloud_off' }}</mat-icon>
        <span>{{ loading ? 'Connecting...' : isConnected ? 'Live Data' : 'Disconnected' }}</span>
      </div>
    </div>

    @if (loading) {
      <div class="loading-overlay">
        <mat-spinner diameter="48"></mat-spinner>
        <p>Loading HBA1C dashboard data...</p>
      </div>
    } @else if (error) {
      <div class="error-banner">
        <mat-icon>error_outline</mat-icon>
        <div>
          <h3>Unable to connect to HBA1C API</h3>
          <p>{{ error }}</p>
          <button mat-raised-button color="primary" (click)="loadDashboard()">
            <mat-icon>refresh</mat-icon> Retry
          </button>
        </div>
      </div>
    } @else {
      <!-- KPI Stats Row -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-icon" style="background: rgba(33,150,243,0.15); color: #2196f3;">
            <mat-icon>school</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-value">{{ dashboard?.trainingStats?.totalSessions || 0 }}</span>
            <span class="kpi-label">Training Sessions</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background: rgba(76,175,80,0.15); color: #4caf50;">
            <mat-icon>groups</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-value">{{ dashboard?.trainingStats?.totalParticipants || 0 | number }}</span>
            <span class="kpi-label">Total Participants</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background: rgba(255,152,0,0.15); color: #ff9800;">
            <mat-icon>person</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-value">{{ dashboard?.nationalTotals?.totalTrainers || 0 | number }}</span>
            <span class="kpi-label">Trainers</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background: rgba(156,39,176,0.15); color: #9c27b0;">
            <mat-icon>local_shipping</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-value">{{ dashboard?.nationalTotals?.totalDeliveries || 0 | number }}</span>
            <span class="kpi-label">Total Deliveries</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background: rgba(0,150,136,0.15); color: #009688;">
            <mat-icon>point_of_sale</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-value">R{{ dashboard?.salesStats?.totalRevenue || 0 | number:'1.0-0' }}</span>
            <span class="kpi-label">Total Revenue</span>
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="background: rgba(244,67,54,0.15); color: #f44336;">
            <mat-icon>inventory_2</mat-icon>
          </div>
          <div class="kpi-info">
            <span class="kpi-value">{{ dashboard?.inventoryStats?.totalItems || 0 | number }}</span>
            <span class="kpi-label">Inventory Items</span>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <mat-tab-group class="dashboard-tabs" animationDuration="200ms" (selectedIndexChange)="onTabChange($event)">

        <!-- Overview Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>dashboard</mat-icon>
            <span>Overview</span>
          </ng-template>

          <div class="tab-content">
            <!-- Provincial Breakdown -->
            <div class="section">
              <h3 class="section-title">
                <mat-icon>map</mat-icon> Provincial Breakdown
              </h3>
              <div class="province-grid">
                @for (prov of dashboard?.provinceStats || []; track prov.province) {
                  <div class="province-card">
                    <div class="province-name">{{ prov.province }}</div>
                    <div class="province-stats">
                      <div class="prov-stat">
                        <span class="prov-val">{{ prov.sessions }}</span>
                        <span class="prov-lbl">Sessions</span>
                      </div>
                      <div class="prov-stat">
                        <span class="prov-val">{{ prov.participants | number }}</span>
                        <span class="prov-lbl">Participants</span>
                      </div>
                      <div class="prov-stat">
                        <span class="prov-val">{{ prov.trainers }}</span>
                        <span class="prov-lbl">Trainers</span>
                      </div>
                      <div class="prov-stat">
                        <span class="prov-val">R{{ prov.revenue | number:'1.0-0' }}</span>
                        <span class="prov-lbl">Revenue</span>
                      </div>
                    </div>
                  </div>
                }
                @if (!dashboard?.provinceStats?.length) {
                  <div class="empty-state">
                    <mat-icon>map</mat-icon>
                    <p>No provincial data available</p>
                  </div>
                }
              </div>
            </div>

            <!-- Equipment Stats -->
            <div class="section">
              <h3 class="section-title">
                <mat-icon>precision_manufacturing</mat-icon> Equipment Distribution
              </h3>
              <div class="equipment-grid">
                @for (eq of dashboard?.equipmentStats || []; track eq.equipmentType) {
                  <div class="equipment-card">
                    <div class="equip-type">{{ eq.equipmentType }}</div>
                    <div class="equip-stats">
                      <div class="equip-stat delivered">
                        <span class="equip-val">{{ eq.totalDelivered }}</span>
                        <span class="equip-lbl">Delivered</span>
                      </div>
                      <div class="equip-stat ordered">
                        <span class="equip-val">{{ eq.totalOrdered }}</span>
                        <span class="equip-lbl">Ordered</span>
                      </div>
                    </div>
                    <mat-progress-bar
                      mode="determinate"
                      [value]="eq.deliveryRate"
                      [color]="eq.deliveryRate > 80 ? 'primary' : 'warn'"
                    ></mat-progress-bar>
                    <span class="equip-usage">{{ eq.deliveryRate | number:'1.0-0' }}% delivery rate</span>
                  </div>
                }
                @if (!dashboard?.equipmentStats?.length) {
                  <div class="empty-state">
                    <mat-icon>precision_manufacturing</mat-icon>
                    <p>No equipment data available</p>
                  </div>
                }
              </div>
            </div>

            <!-- National Totals -->
            <div class="section">
              <h3 class="section-title">
                <mat-icon>analytics</mat-icon> National Summary
              </h3>
              <div class="national-grid">
                <div class="national-card">
                  <mat-icon style="color: #2196f3;">school</mat-icon>
                  <span class="nat-val">{{ dashboard?.nationalTotals?.totalTrainingSessions || 0 | number }}</span>
                  <span class="nat-lbl">Training Sessions</span>
                </div>
                <div class="national-card">
                  <mat-icon style="color: #4caf50;">person</mat-icon>
                  <span class="nat-val">{{ dashboard?.nationalTotals?.totalTrainers || 0 | number }}</span>
                  <span class="nat-lbl">Trainers</span>
                </div>
                <div class="national-card">
                  <mat-icon style="color: #ff9800;">groups</mat-icon>
                  <span class="nat-val">{{ dashboard?.nationalTotals?.totalParticipants || 0 | number }}</span>
                  <span class="nat-lbl">Participants</span>
                </div>
                <div class="national-card">
                  <mat-icon style="color: #9c27b0;">shopping_cart</mat-icon>
                  <span class="nat-val">{{ dashboard?.nationalTotals?.totalSales || 0 | number }}</span>
                  <span class="nat-lbl">Total Sales</span>
                </div>
                <div class="national-card">
                  <mat-icon style="color: #009688;">attach_money</mat-icon>
                  <span class="nat-val">R{{ dashboard?.nationalTotals?.totalRevenue || 0 | number:'1.0-0' }}</span>
                  <span class="nat-lbl">Total Revenue</span>
                </div>
                <div class="national-card">
                  <mat-icon style="color: #ff5722;">local_shipping</mat-icon>
                  <span class="nat-val">{{ dashboard?.nationalTotals?.totalDeliveries || 0 | number }}</span>
                  <span class="nat-lbl">Total Deliveries</span>
                </div>
              </div>
            </div>
          </div>
        </mat-tab>

        <!-- Training Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>school</mat-icon>
            <span>Training</span>
            @if (dashboard?.trainingStats?.totalSessions) {
              <span class="tab-badge">{{ dashboard?.trainingStats?.totalSessions }}</span>
            }
          </ng-template>

          <div class="tab-content">
            <!-- Training KPIs -->
            <div class="mini-kpi-row">
              <div class="mini-kpi">
                <span class="mkpi-val">{{ dashboard?.trainingStats?.completedSessions || 0 }}</span>
                <span class="mkpi-lbl">Completed</span>
              </div>
              <div class="mini-kpi">
                <span class="mkpi-val">{{ dashboard?.trainingStats?.inProgressSessions || 0 }}</span>
                <span class="mkpi-lbl">In Progress</span>
              </div>
              <div class="mini-kpi">
                <span class="mkpi-val">{{ dashboard?.trainingStats?.totalParticipants || 0 | number }}</span>
                <span class="mkpi-lbl">Total Participants</span>
              </div>
              <div class="mini-kpi">
                <span class="mkpi-val">{{ dashboard?.trainingStats?.completionRate || 0 | number:'1.0-0' }}%</span>
                <span class="mkpi-lbl">Completion Rate</span>
              </div>
            </div>

            <!-- Training Sessions Table -->
            <div class="section">
              <div class="section-header">
                <h3 class="section-title">
                  <mat-icon>list</mat-icon> Training Sessions
                </h3>
                <button mat-stroked-button class="refresh-btn" (click)="loadTraining()">
                  <mat-icon>refresh</mat-icon> Refresh
                </button>
              </div>

              @if (trainingLoading) {
                <div class="section-loading">
                  <mat-spinner diameter="32"></mat-spinner>
                </div>
              } @else {
                <div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Training Name</th>
                        <th>Province</th>
                        <th>Venue</th>
                        <th>Trainer</th>
                        <th>Date</th>
                        <th>Participants</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (session of trainingSessions; track session.id) {
                        <tr>
                          <td class="title-cell">{{ session.trainingName }}</td>
                          <td>{{ session.provinceName }}</td>
                          <td>{{ session.venue }}</td>
                          <td>{{ getTrainerName(session) }}</td>
                          <td>{{ session.startDate | date:'dd MMM yyyy' }}</td>
                          <td>
                            <span class="attendee-count">{{ session.numberOfParticipants }}</span>
                          </td>
                          <td>
                            <mat-chip [class]="'status-' + ('' + (session.statusText || 'unknown')).toLowerCase()" size="small">
                              {{ session.statusText || 'Unknown' }}
                            </mat-chip>
                          </td>
                        </tr>
                      }
                      @if (!trainingSessions.length) {
                        <tr>
                          <td colspan="7" class="empty-row">No training sessions found</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        </mat-tab>

        <!-- Inventory Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>inventory_2</mat-icon>
            <span>Inventory</span>
            @if (dashboard?.inventoryStats?.lowStockItems) {
              <span class="tab-badge warn">{{ dashboard?.inventoryStats?.lowStockItems }}</span>
            }
          </ng-template>

          <div class="tab-content">
            <!-- Inventory KPIs -->
            <div class="mini-kpi-row">
              <div class="mini-kpi">
                <span class="mkpi-val">{{ dashboard?.inventoryStats?.totalItems || 0 | number }}</span>
                <span class="mkpi-lbl">Total Items</span>
              </div>
              <div class="mini-kpi">
                <span class="mkpi-val">R{{ dashboard?.inventoryStats?.totalValue || 0 | number:'1.0-0' }}</span>
                <span class="mkpi-lbl">Total Value</span>
              </div>
              <div class="mini-kpi warn">
                <span class="mkpi-val">{{ dashboard?.inventoryStats?.lowStockItems || 0 }}</span>
                <span class="mkpi-lbl">Low Stock</span>
              </div>
              <div class="mini-kpi danger">
                <span class="mkpi-val">{{ dashboard?.inventoryStats?.outOfStockItems || 0 }}</span>
                <span class="mkpi-lbl">Out of Stock</span>
              </div>
            </div>

            <!-- Low Stock Alerts -->
            @if (dashboard?.lowStockItems?.length) {
              <div class="section">
                <h3 class="section-title warn-title">
                  <mat-icon>warning</mat-icon> Low Stock Alerts
                </h3>
                <div class="low-stock-grid">
                  @for (item of dashboard?.lowStockItems || []; track item.id) {
                    <div class="low-stock-card">
                      <div class="ls-header">
                        <span class="ls-name">{{ item.name }}</span>
                        <mat-chip class="status-warning" size="small">Low Stock</mat-chip>
                      </div>
                      <div class="ls-details">
                        <span>SKU: {{ item.sku }}</span>
                        <span>Qty: <strong class="danger-text">{{ item.stockAvailable }}</strong> / Reorder: {{ item.reorderLevel }}</span>
                      </div>
                      <mat-progress-bar
                        mode="determinate"
                        [value]="item.reorderLevel > 0 ? (item.stockAvailable / item.reorderLevel) * 100 : 0"
                        color="warn"
                      ></mat-progress-bar>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Full Inventory Table -->
            <div class="section">
              <div class="section-header">
                <h3 class="section-title">
                  <mat-icon>list</mat-icon> All Inventory Items
                </h3>
                <button mat-stroked-button class="refresh-btn" (click)="loadInventory()">
                  <mat-icon>refresh</mat-icon> Refresh
                </button>
              </div>

              @if (inventoryLoading) {
                <div class="section-loading">
                  <mat-spinner diameter="32"></mat-spinner>
                </div>
              } @else {
                <div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>SKU</th>
                        <th>Category</th>
                        <th>Stock</th>
                        <th>Reorder Level</th>
                        <th>Unit Price</th>
                        <th>Supplier</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (item of inventoryItems; track item.id) {
                        <tr [class.low-stock-row]="item.stockAvailable <= item.reorderLevel">
                          <td class="title-cell">{{ item.name }}</td>
                          <td class="mono">{{ item.sku }}</td>
                          <td>{{ item.categoryText }}</td>
                          <td [class.danger-text]="item.stockAvailable <= item.reorderLevel">{{ item.stockAvailable | number }}</td>
                          <td>{{ item.reorderLevel | number }}</td>
                          <td>R{{ item.unitPrice | number:'1.2-2' }}</td>
                          <td>{{ item.supplier }}</td>
                          <td>
                            <mat-chip [class]="item.stockAvailable <= item.reorderLevel ? 'status-warning' : 'status-ok'" size="small">
                              {{ item.statusText || (item.stockAvailable <= item.reorderLevel ? 'Low Stock' : 'In Stock') }}
                            </mat-chip>
                          </td>
                        </tr>
                      }
                      @if (!inventoryItems.length) {
                        <tr>
                          <td colspan="8" class="empty-row">No inventory items found</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        </mat-tab>

        <!-- Sales Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>point_of_sale</mat-icon>
            <span>Sales</span>
          </ng-template>

          <div class="tab-content">
            <!-- Sales KPIs -->
            <div class="mini-kpi-row">
              <div class="mini-kpi">
                <span class="mkpi-val">{{ dashboard?.salesStats?.totalSales || 0 | number }}</span>
                <span class="mkpi-lbl">Total Sales</span>
              </div>
              <div class="mini-kpi">
                <span class="mkpi-val">R{{ dashboard?.salesStats?.totalRevenue || 0 | number:'1.0-0' }}</span>
                <span class="mkpi-lbl">Total Revenue</span>
              </div>
              <div class="mini-kpi">
                <span class="mkpi-val">R{{ dashboard?.salesStats?.averageOrderValue || 0 | number:'1.0-0' }}</span>
                <span class="mkpi-lbl">Avg Order Value</span>
              </div>
              <div class="mini-kpi">
                <span class="mkpi-val">{{ dashboard?.salesStats?.pendingOrders || 0 }}</span>
                <span class="mkpi-lbl">Pending Orders</span>
              </div>
            </div>

            <!-- Provincial Sales -->
            <div class="section">
              <h3 class="section-title">
                <mat-icon>map</mat-icon> Sales by Province
              </h3>
              <div class="provincial-sales-grid">
                @for (prov of dashboard?.provincialData || []; track prov.province) {
                  <div class="prov-sales-card">
                    <div class="ps-header">
                      <span class="ps-province">{{ prov.province }}</span>
                      <span class="ps-revenue">R{{ prov.revenue | number:'1.0-0' }}</span>
                    </div>
                    <div class="ps-details">
                      <span>{{ prov.orderCount }} orders</span>
                      <span>{{ prov.totalDelivered }}/{{ prov.totalOrdered }} delivered</span>
                    </div>
                    <mat-progress-bar
                      mode="determinate"
                      [value]="prov.deliveryRate"
                    ></mat-progress-bar>
                    <span class="delivery-rate">{{ prov.deliveryRate | number:'1.0-0' }}% delivery rate</span>
                  </div>
                }
                @if (!dashboard?.provincialData?.length) {
                  <div class="empty-state">
                    <mat-icon>point_of_sale</mat-icon>
                    <p>No provincial sales data available</p>
                  </div>
                }
              </div>
            </div>

            <!-- Top Products -->
            <div class="section">
              <h3 class="section-title">
                <mat-icon>star</mat-icon> Top Products
              </h3>
              <div class="top-products-grid">
                @for (prod of dashboard?.topProducts || []; track prod.productName; let i = $index) {
                  <div class="top-product-card">
                    <span class="tp-rank">#{{ i + 1 }}</span>
                    <div class="tp-info">
                      <span class="tp-name">{{ prod.productName }}</span>
                      <span class="tp-details">{{ prod.quantitySold | number }} units &middot; {{ prod.orderCount }} orders</span>
                    </div>
                    <span class="tp-revenue">R{{ prod.revenue | number:'1.0-0' }}</span>
                  </div>
                }
                @if (!dashboard?.topProducts?.length) {
                  <div class="empty-state">
                    <mat-icon>star</mat-icon>
                    <p>No product data available</p>
                  </div>
                }
              </div>
            </div>

            <!-- Recent Sales Table -->
            <div class="section">
              <div class="section-header">
                <h3 class="section-title">
                  <mat-icon>receipt_long</mat-icon> Recent Sales
                </h3>
                <button mat-stroked-button class="refresh-btn" (click)="loadSales()">
                  <mat-icon>refresh</mat-icon> Refresh
                </button>
              </div>

              @if (salesLoading) {
                <div class="section-loading">
                  <mat-spinner diameter="32"></mat-spinner>
                </div>
              } @else {
                <div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Sale #</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Credit Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (sale of salesList; track sale.id) {
                        <tr>
                          <td class="mono">{{ sale.saleNumber }}</td>
                          <td class="title-cell">{{ sale.customerName }}</td>
                          <td>{{ sale.saleDate | date:'dd MMM yyyy' }}</td>
                          <td>{{ sale.saleItems?.length || 0 }} items</td>
                          <td class="amount-cell">R{{ sale.total | number:'1.2-2' }}</td>
                          <td>
                            @if (sale.hasCreditNote) {
                              <mat-chip class="status-warning" size="small">
                                Credited R{{ sale.creditedAmount || 0 | number:'1.2-2' }}
                              </mat-chip>
                            } @else {
                              <mat-chip class="status-ok" size="small">OK</mat-chip>
                            }
                          </td>
                        </tr>
                      }
                      @if (!salesList.length) {
                        <tr>
                          <td colspan="6" class="empty-row">No sales found</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        </mat-tab>

        <!-- Credit Notes Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>receipt</mat-icon>
            <span>Credit Notes</span>
          </ng-template>

          <div class="tab-content">
            <div class="section">
              <div class="section-header">
                <h3 class="section-title">
                  <mat-icon>receipt</mat-icon> Credit Notes
                </h3>
                <button mat-stroked-button class="refresh-btn" (click)="loadCreditNotes()">
                  <mat-icon>refresh</mat-icon> Refresh
                </button>
              </div>

              @if (creditNotesLoading) {
                <div class="section-loading">
                  <mat-spinner diameter="32"></mat-spinner>
                </div>
              } @else {
                <div class="table-container">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>Credit Note #</th>
                        <th>Invoice #</th>
                        <th>Customer</th>
                        <th>Original Amt</th>
                        <th>Credit Amt</th>
                        <th>Reason</th>
                        <th>Created</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (cn of creditNotes; track cn.id) {
                        <tr>
                          <td class="mono">{{ cn.creditNoteNumber }}</td>
                          <td class="mono">{{ cn.invoiceNumber }}</td>
                          <td class="title-cell">{{ cn.customerName }}</td>
                          <td class="amount-cell">R{{ cn.originalAmount | number:'1.2-2' }}</td>
                          <td class="amount-cell danger-text">R{{ cn.creditAmount | number:'1.2-2' }}</td>
                          <td>{{ cn.reason }}</td>
                          <td>{{ cn.createdDate | date:'dd MMM yyyy' }}</td>
                          <td>
                            <mat-chip [class]="'status-' + ('' + (cn.status || 'unknown')).toLowerCase()" size="small">
                              {{ cn.status }}
                            </mat-chip>
                          </td>
                        </tr>
                      }
                      @if (!creditNotes.length) {
                        <tr>
                          <td colspan="8" class="empty-row">No credit notes found</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    }
  `,
  styles: [`
    :host { display: block; }
    .detail-header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .detail-header h2 { font-size: 24px; font-weight: 700; color: white; margin: 0; flex: 1; display: flex; align-items: center; gap: 10px; text-shadow: 1px 1px 3px rgba(0,0,0,0.2); }
    .header-icon { font-size: 28px; width: 28px; height: 28px; }
    .back-btn { background: rgba(255,255,255,0.2) !important; color: white !important; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.3) !important; }
    .connection-status { display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; backdrop-filter: blur(10px); }
    .connection-status.connected { background: rgba(76,175,80,0.25); color: #a5d6a7; border: 1px solid rgba(76,175,80,0.4); }
    .connection-status.disconnected { background: rgba(244,67,54,0.25); color: #ef9a9a; border: 1px solid rgba(244,67,54,0.4); }
    .connection-status mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .loading-overlay { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 16px; }
    .loading-overlay p { color: rgba(255,255,255,0.9); font-size: 16px; }
    .error-banner { display: flex; align-items: flex-start; gap: 16px; background: rgba(244,67,54,0.15); border: 1px solid rgba(244,67,54,0.4); border-radius: 16px; padding: 24px; backdrop-filter: blur(10px); }
    .error-banner mat-icon { font-size: 40px; width: 40px; height: 40px; color: #ef9a9a; }
    .error-banner h3 { color: white; margin: 0 0 8px 0; font-size: 16px; }
    .error-banner p { color: rgba(255,255,255,0.8); margin: 0 0 12px 0; font-size: 14px; }
    .kpi-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .kpi-card { background: rgba(255,255,255,0.95); border-radius: 16px; padding: 20px; display: flex; align-items: center; gap: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.12); transition: transform 0.2s; }
    .kpi-card:hover { transform: translateY(-2px); }
    .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .kpi-icon mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .kpi-info { display: flex; flex-direction: column; }
    .kpi-value { font-size: 22px; font-weight: 700; color: #1a1a2e; line-height: 1.2; }
    .kpi-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.3px; }
    .dashboard-tabs { background: rgba(255,255,255,0.95); border-radius: 20px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
    .dashboard-tabs ::ng-deep .mat-mdc-tab-labels { background: #f8f9fa; }
    .dashboard-tabs ::ng-deep .mat-mdc-tab { min-width: 130px; }
    .dashboard-tabs ::ng-deep .mat-mdc-tab .mdc-tab__text-label { display: flex; align-items: center; gap: 6px; font-weight: 600; }
    .tab-badge { background: #2196f3; color: white; font-size: 10px; padding: 2px 7px; border-radius: 10px; margin-left: 4px; font-weight: 700; }
    .tab-badge.warn { background: #ff9800; }
    .tab-content { padding: 24px; }
    .section { margin-bottom: 28px; }
    .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1a1a2e; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px; }
    .section-header .section-title { margin-bottom: 0; }
    .section-title mat-icon { font-size: 20px; width: 20px; height: 20px; color: #5c6bc0; }
    .warn-title mat-icon { color: #ff9800 !important; }
    .refresh-btn { border-color: rgba(0,0,0,0.12) !important; font-size: 12px; }
    .section-loading { display: flex; justify-content: center; padding: 40px; }
    .mini-kpi-row { display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
    .mini-kpi { flex: 1; min-width: 140px; background: #f8f9ff; border-radius: 12px; padding: 16px; text-align: center; border: 1px solid #e8eaf6; }
    .mini-kpi.warn { background: #fff8e1; border-color: #ffecb3; }
    .mini-kpi.danger { background: #fce4ec; border-color: #f8bbd0; }
    .mkpi-val { display: block; font-size: 24px; font-weight: 700; color: #1a1a2e; }
    .mkpi-lbl { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .province-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .province-card { background: #f8f9ff; border-radius: 12px; padding: 16px; border: 1px solid #e8eaf6; transition: transform 0.2s; }
    .province-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .province-name { font-size: 15px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
    .province-stats { display: flex; gap: 16px; flex-wrap: wrap; }
    .prov-stat { display: flex; flex-direction: column; }
    .prov-val { font-size: 18px; font-weight: 700; color: #5c6bc0; }
    .prov-lbl { font-size: 10px; color: #999; text-transform: uppercase; }
    .equipment-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .equipment-card { background: #f8f9ff; border-radius: 12px; padding: 16px; border: 1px solid #e8eaf6; }
    .equip-type { font-size: 14px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; }
    .equip-stats { display: flex; gap: 16px; margin-bottom: 12px; }
    .equip-stat { display: flex; flex-direction: column; }
    .equip-val { font-size: 18px; font-weight: 700; }
    .equip-stat.delivered .equip-val { color: #2196f3; }
    .equip-stat.ordered .equip-val { color: #4caf50; }
    .equip-lbl { font-size: 10px; color: #999; text-transform: uppercase; }
    .equip-usage, .delivery-rate { display: block; text-align: right; font-size: 11px; color: #888; margin-top: 4px; }
    .national-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
    .national-card { background: #f8f9ff; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e8eaf6; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .national-card mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .nat-val { font-size: 28px; font-weight: 700; color: #1a1a2e; }
    .nat-lbl { font-size: 12px; color: #888; text-transform: uppercase; }
    .provincial-sales-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .prov-sales-card { background: #f8f9ff; border-radius: 12px; padding: 16px; border: 1px solid #e8eaf6; }
    .ps-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .ps-province { font-weight: 700; color: #1a1a2e; }
    .ps-revenue { font-weight: 700; color: #4caf50; font-size: 16px; }
    .ps-details { display: flex; gap: 16px; font-size: 12px; color: #888; margin-bottom: 10px; }
    .top-products-grid { display: flex; flex-direction: column; gap: 8px; }
    .top-product-card { display: flex; align-items: center; gap: 14px; background: #f8f9ff; border-radius: 10px; padding: 12px 16px; border: 1px solid #e8eaf6; }
    .tp-rank { font-size: 16px; font-weight: 800; color: #5c6bc0; min-width: 30px; }
    .tp-info { flex: 1; display: flex; flex-direction: column; }
    .tp-name { font-weight: 600; color: #1a1a2e; font-size: 14px; }
    .tp-details { font-size: 12px; color: #888; }
    .tp-revenue { font-weight: 700; color: #4caf50; font-size: 16px; }
    .low-stock-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
    .low-stock-card { background: #fff8e1; border-radius: 10px; padding: 14px; border: 1px solid #ffecb3; }
    .ls-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .ls-name { font-weight: 700; color: #1a1a2e; font-size: 14px; }
    .ls-details { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #666; margin-bottom: 8px; }
    .danger-text { color: #f44336 !important; font-weight: 700; }
    .table-container { overflow-x: auto; border-radius: 12px; border: 1px solid #e8eaf6; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { background: #f5f6fa; padding: 12px 14px; text-align: left; font-weight: 700; color: #555; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; border-bottom: 2px solid #e8eaf6; white-space: nowrap; }
    .data-table td { padding: 10px 14px; border-bottom: 1px solid #f0f0f0; color: #333; }
    .data-table tbody tr:hover { background: #f8f9ff; }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .title-cell { font-weight: 600; color: #1a1a2e; }
    .mono { font-family: 'Roboto Mono', monospace; font-size: 12px; }
    .amount-cell { font-weight: 600; color: #2e7d32; }
    .attendee-count { font-weight: 600; color: #5c6bc0; }
    .low-stock-row { background: #fff8e1 !important; }
    .empty-row { text-align: center; color: #999; padding: 32px !important; font-style: italic; }
    .status-completed, .status-paid, .status-approved, .status-ok, .status-active { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .status-pending, .status-scheduled, .status-processing { background: #e3f2fd !important; color: #1565c0 !important; }
    .status-warning, .status-cancelled, .status-overdue { background: #fff3e0 !important; color: #ef6c00 !important; }
    .status-rejected, .status-failed { background: #fce4ec !important; color: #c62828 !important; }
    .status-draft, .status-unknown { background: #f5f5f5 !important; color: #757575 !important; }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; color: #bbb; grid-column: 1 / -1; }
    .empty-state mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; }
    @media (max-width: 768px) {
      .kpi-row { grid-template-columns: repeat(2, 1fr); }
      .mini-kpi-row { flex-direction: column; }
      .province-grid, .equipment-grid, .provincial-sales-grid, .low-stock-grid { grid-template-columns: 1fr; }
      .detail-header { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class HBA1CDashboardComponent implements OnInit, OnDestroy {
  @Output() goBack = new EventEmitter<void>();

  private destroy$ = new Subject<void>();

  dashboard: HBA1CProjectDashboard | null = null;
  loading = true;
  error: string | null = null;
  isConnected = false;

  trainingSessions: HBA1CTrainingSession[] = [];
  trainingLoading = false;

  inventoryItems: HBA1CInventoryItem[] = [];
  inventoryLoading = false;

  salesList: HBA1CSale[] = [];
  salesLoading = false;

  creditNotes: HBA1CCreditNote[] = [];
  creditNotesLoading = false;

  constructor(private hba1cService: HBA1CService) {}

  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDashboard(): void {
    this.loading = true;
    this.error = null;

    this.hba1cService.getDashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.dashboard = data;
          this.isConnected = true;
          this.loading = false;
          if (data.recentTrainings) {
            this.trainingSessions = data.recentTrainings;
          }
          if (data.recentSales) {
            this.salesList = data.recentSales;
          }
        },
        error: (err) => {
          this.loading = false;
          this.isConnected = false;
          this.error = err.error?.message || err.message || 'Failed to connect to HBA1C API.';
          console.error('HBA1C Dashboard error:', err);
        }
      });
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
}
