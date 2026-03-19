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
    <!-- Header Bar -->
    <div class="dash-header">
      <button mat-icon-button class="back-btn" (click)="goBack.emit()" matTooltip="Back to Projects">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <div class="header-title-block">
        <div class="header-icon-wrap">
          <mat-icon>biotech</mat-icon>
        </div>
        <div>
          <h1>HBA1C Medical Management</h1>
          <p class="header-subtitle">National training, inventory & sales dashboard</p>
        </div>
      </div>
      <div class="header-actions">
        <div class="connection-pill" [class.connected]="isConnected" [class.error]="!isConnected && !loading">
          <span class="conn-dot"></span>
          <span>{{ loading ? 'Connecting...' : isConnected ? 'Live' : 'Offline' }}</span>
        </div>
        @if (!loading && isConnected) {
          <button mat-icon-button class="header-refresh" (click)="loadDashboard()" matTooltip="Refresh all data">
            <mat-icon>refresh</mat-icon>
          </button>
        }
      </div>
    </div>

    @if (loading) {
      <div class="loading-state">
        <div class="loading-card">
          <mat-spinner diameter="44" strokeWidth="4"></mat-spinner>
          <h3>Connecting to HBA1C API</h3>
          <p>Fetching live data from the medical management system...</p>
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
        <div class="kpi-card kpi-blue">
          <div class="kpi-icon-wrap"><mat-icon>school</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.trainingStats?.totalSessions || 0 | number }}</span>
            <span class="kpi-label">Training Sessions</span>
          </div>
          <div class="kpi-accent"></div>
        </div>
        <div class="kpi-card kpi-green">
          <div class="kpi-icon-wrap"><mat-icon>groups</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.trainingStats?.totalParticipants || 0 | number }}</span>
            <span class="kpi-label">Participants</span>
          </div>
          <div class="kpi-accent"></div>
        </div>
        <div class="kpi-card kpi-orange">
          <div class="kpi-icon-wrap"><mat-icon>person</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.nationalTotals?.totalTrainers || 0 | number }}</span>
            <span class="kpi-label">Trainers</span>
          </div>
          <div class="kpi-accent"></div>
        </div>
        <div class="kpi-card kpi-purple">
          <div class="kpi-icon-wrap"><mat-icon>local_shipping</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.nationalTotals?.totalDeliveries || 0 | number }}</span>
            <span class="kpi-label">Deliveries</span>
          </div>
          <div class="kpi-accent"></div>
        </div>
        <div class="kpi-card kpi-teal">
          <div class="kpi-icon-wrap"><mat-icon>point_of_sale</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">R{{ dashboard?.salesStats?.totalRevenue || 0 | number:'1.0-0' }}</span>
            <span class="kpi-label">Total Revenue</span>
          </div>
          <div class="kpi-accent"></div>
        </div>
        <div class="kpi-card kpi-red">
          <div class="kpi-icon-wrap"><mat-icon>inventory_2</mat-icon></div>
          <div class="kpi-body">
            <span class="kpi-number">{{ dashboard?.inventoryStats?.totalItems || 0 | number }}</span>
            <span class="kpi-label">Inventory Items</span>
          </div>
          <div class="kpi-accent"></div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-wrapper">
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
                      <p>Delivery status by equipment type</p>
                    </div>
                  </div>
                </div>
                <div class="equipment-grid">
                  @for (eq of dashboard?.equipmentStats || []; track eq.equipmentType) {
                    <div class="equip-card">
                      <div class="equip-name">{{ eq.equipmentType }}</div>
                      <div class="equip-numbers">
                        <div class="equip-num">
                          <span class="en-val delivered">{{ eq.totalDelivered | number }}</span>
                          <span class="en-lbl">Delivered</span>
                        </div>
                        <div class="equip-num">
                          <span class="en-val ordered">{{ eq.totalOrdered | number }}</span>
                          <span class="en-lbl">Ordered</span>
                        </div>
                      </div>
                      <div class="equip-bar-wrap">
                        <mat-progress-bar
                          mode="determinate"
                          [value]="eq.deliveryRate"
                          [color]="eq.deliveryRate >= 80 ? 'primary' : 'warn'"
                        ></mat-progress-bar>
                        <span class="equip-rate">{{ eq.deliveryRate | number:'1.0-0' }}%</span>
                      </div>
                    </div>
                  }
                  @if (!dashboard?.equipmentStats?.length) {
                    <div class="empty-placeholder">
                      <mat-icon>precision_manufacturing</mat-icon>
                      <p>No equipment data available</p>
                    </div>
                  }
                </div>
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
                          </tr>
                        }
                        @if (!trainingSessions.length) {
                          <tr><td colspan="7" class="empty-row">No training sessions found</td></tr>
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
                          </tr>
                        }
                        @if (!inventoryItems.length) {
                          <tr><td colspan="8" class="empty-row">No inventory items found</td></tr>
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
                          </tr>
                        }
                        @if (!salesList.length) {
                          <tr><td colspan="6" class="empty-row">No sales found</td></tr>
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
                          </tr>
                        }
                        @if (!creditNotes.length) {
                          <tr><td colspan="8" class="empty-row">No credit notes found</td></tr>
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
    /*  HEADER                        */
    /* ============================== */
    .dash-header {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 28px; flex-wrap: wrap;
    }
    .back-btn {
      background: rgba(255,255,255,0.15) !important;
      color: white !important;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.25) !important;
      transition: all 0.2s;
    }
    .back-btn:hover { background: rgba(255,255,255,0.25) !important; }

    .header-title-block {
      display: flex; align-items: center; gap: 14px; flex: 1;
    }
    .header-icon-wrap {
      width: 44px; height: 44px; border-radius: var(--radius-md);
      background: rgba(255,255,255,0.2); backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .header-icon-wrap mat-icon { color: white; font-size: 24px; width: 24px; height: 24px; }
    .header-title-block h1 {
      font-size: 22px; font-weight: 700; color: white; margin: 0;
      text-shadow: 0 1px 3px rgba(0,0,0,0.15); line-height: 1.2;
    }
    .header-subtitle {
      font-size: 13px; color: rgba(255,255,255,0.75); margin: 2px 0 0 0;
    }

    .header-actions { display: flex; align-items: center; gap: 8px; }
    .header-refresh {
      background: rgba(255,255,255,0.15) !important; color: white !important;
      backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.2) !important;
    }

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
    .connection-pill.connected { background: rgba(34,197,94,0.2); border-color: rgba(34,197,94,0.4); color: #bbf7d0; }
    .connection-pill.connected .conn-dot { background: #4ade80; }
    .connection-pill.error { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4); color: #fca5a5; }
    .connection-pill.error .conn-dot { background: #f87171; animation: none; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    /* ============================== */
    /*  LOADING / ERROR STATES        */
    /* ============================== */
    .loading-state, .error-state {
      display: flex; justify-content: center; padding: 60px 20px;
    }
    .loading-card, .error-card {
      background: var(--surface); border-radius: var(--radius-xl);
      padding: 48px 56px; text-align: center; box-shadow: var(--shadow-lg);
      max-width: 440px; width: 100%;
    }
    .loading-card h3, .error-card h3 { color: var(--text-primary); margin: 20px 0 8px; font-size: 18px; }
    .loading-card p, .error-card p { color: var(--text-secondary); margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
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
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 16px; margin-bottom: 28px;
    }
    .kpi-card {
      background: var(--surface); border-radius: var(--radius-lg);
      padding: 22px 20px; display: flex; align-items: center; gap: 16px;
      box-shadow: var(--shadow-sm); transition: all 0.25s ease;
      position: relative; overflow: hidden; border: 1px solid var(--border);
    }
    .kpi-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); }
    .kpi-accent {
      position: absolute; top: 0; left: 0; width: 4px; height: 100%;
      border-radius: 4px 0 0 4px;
    }
    .kpi-blue .kpi-accent { background: var(--blue); }
    .kpi-green .kpi-accent { background: var(--green); }
    .kpi-orange .kpi-accent { background: var(--orange); }
    .kpi-purple .kpi-accent { background: var(--purple); }
    .kpi-teal .kpi-accent { background: var(--teal); }
    .kpi-red .kpi-accent { background: var(--red); }

    .kpi-icon-wrap {
      width: 50px; height: 50px; border-radius: var(--radius-md);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .kpi-blue .kpi-icon-wrap { background: var(--blue-soft); color: var(--blue); }
    .kpi-green .kpi-icon-wrap { background: var(--green-soft); color: var(--green); }
    .kpi-orange .kpi-icon-wrap { background: var(--orange-soft); color: var(--orange); }
    .kpi-purple .kpi-icon-wrap { background: var(--purple-soft); color: var(--purple); }
    .kpi-teal .kpi-icon-wrap { background: var(--teal-soft); color: var(--teal); }
    .kpi-red .kpi-icon-wrap { background: var(--red-soft); color: var(--red); }
    .kpi-icon-wrap mat-icon { font-size: 26px; width: 26px; height: 26px; }

    .kpi-body { display: flex; flex-direction: column; min-width: 0; }
    .kpi-number { font-size: 22px; font-weight: 800; color: var(--text-primary); line-height: 1.2; white-space: nowrap; }
    .kpi-label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.4px; font-weight: 500; margin-top: 2px; }

    /* ============================== */
    /*  TABS                          */
    /* ============================== */
    .tabs-wrapper {
      background: var(--surface); border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg); overflow: hidden;
      border: 1px solid var(--border);
    }
    .dashboard-tabs ::ng-deep .mat-mdc-tab-header { background: #f8fafc; border-bottom: 1px solid var(--border); }
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
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius-lg); margin-bottom: 24px;
      overflow: hidden;
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
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1px; background: var(--border);
    }
    .province-card {
      background: var(--surface); padding: 20px 24px;
      transition: background 0.15s;
    }
    .province-card:hover { background: var(--surface-hover); }
    .prov-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
    .prov-map-icon { font-size: 18px; width: 18px; height: 18px; color: var(--blue); }
    .province-name { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .prov-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .prov-metric { display: flex; flex-direction: column; }
    .prov-metric-val { font-size: 18px; font-weight: 700; color: var(--blue); }
    .prov-metric-val.revenue { color: var(--green); }
    .prov-metric-lbl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 500; }

    /* ============================== */
    /*  EQUIPMENT GRID                */
    /* ============================== */
    .equipment-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1px; background: var(--border);
    }
    .equip-card {
      background: var(--surface); padding: 20px 24px;
    }
    .equip-name { font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 14px; }
    .equip-numbers { display: flex; gap: 24px; margin-bottom: 14px; }
    .equip-num { display: flex; flex-direction: column; }
    .en-val { font-size: 20px; font-weight: 700; }
    .en-val.delivered { color: var(--blue); }
    .en-val.ordered { color: var(--green); }
    .en-lbl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; font-weight: 500; }
    .equip-bar-wrap { display: flex; align-items: center; gap: 10px; }
    .equip-bar-wrap mat-progress-bar { flex: 1; }
    .equip-rate { font-size: 12px; font-weight: 700; color: var(--text-secondary); min-width: 36px; text-align: right; }

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
    .modern-table thead { background: #f8fafc; }
    .modern-table th {
      padding: 12px 18px; text-align: left; font-weight: 600;
      color: var(--text-muted); text-transform: uppercase; font-size: 11px;
      letter-spacing: 0.5px; border-bottom: 2px solid var(--border);
      white-space: nowrap; position: sticky; top: 0; background: #f8fafc;
    }
    .modern-table th.center { text-align: center; }
    .modern-table th.right { text-align: right; }
    .modern-table td {
      padding: 13px 18px; border-bottom: 1px solid #f1f5f9;
      color: var(--text-secondary); vertical-align: middle;
    }
    .modern-table tbody tr { transition: background 0.12s; }
    .modern-table tbody tr:hover { background: #f8fafc; }
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
    /*  RESPONSIVE                    */
    /* ============================== */
    @media (max-width: 900px) {
      .kpi-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
      .tab-body { padding: 20px; }
      .province-grid, .equipment-grid, .prov-sales-grid, .national-grid { grid-template-columns: 1fr; }
      .prov-metrics { grid-template-columns: repeat(2, 1fr); }
      .stat-bar { gap: 10px; }
      .stat-chip { min-width: 130px; padding: 12px 14px; }
    }
    @media (max-width: 600px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .dash-header { gap: 10px; }
      .header-title-block h1 { font-size: 18px; }
      .stat-bar { flex-direction: column; }
      .alert-grid { grid-template-columns: 1fr; }
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
