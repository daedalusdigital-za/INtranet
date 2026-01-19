import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NavbarComponent } from '../shared/navbar/navbar.component';

interface DashboardStats {
  activeLoads: number;
  inTransit: number;
  delivered: number;
  pending: number;
  totalVehicles: number;
  availableVehicles: number;
  totalDrivers: number;
  availableDrivers: number;
  totalWarehouses: number;
  lowStockItems: number;
  pendingInvoices: number;
  overdueInvoices: number;
}

interface ActiveLoad {
  id: number;
  loadNumber: string;
  customerName: string;
  origin: string;
  destination: string;
  status: string;
  vehicleRegistration: string;
  driverName: string;
  scheduledDelivery: Date;
  progress: number;
}

interface Vehicle {
  id: number;
  registrationNumber: string;
  type: string;
  status: string;
  currentDriver: string;
  lastLocation: string;
  fuelLevel: number;
  speed?: number;
  latitude?: number;
  longitude?: number;
  lastUpdate?: Date;
}

interface WarehouseSummary {
  id: number;
  name: string;
  location: string;
  managerName: string;
  totalItems: number;
  categories: number;
  capacityPercent: number;
  totalCapacity: number;
  availableCapacity: number;
  status: string;
}

@Component({
  selector: 'app-logistics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatBadgeModule,
    MatMenuModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="logistics-dashboard">
      <div class="dashboard-header">
        <div class="header-left">
          <h1>
            <mat-icon>local_shipping</mat-icon>
            Logistics Management
          </h1>
          <p class="subtitle">Fleet, Loads, Warehouses & Tracking</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="primary" (click)="createNewLoad()">
            <mat-icon>add</mat-icon> New Load
          </button>
          <button mat-raised-button (click)="refreshData()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-container">
          <mat-spinner></mat-spinner>
          <p>Loading logistics data...</p>
        </div>
      } @else {
        <!-- Stats Cards -->
        <div class="stats-grid">
          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon loads">
                <mat-icon>assignment</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ stats().activeLoads }}</span>
                <span class="stat-label">Active Loads</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon transit">
                <mat-icon>local_shipping</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ stats().inTransit }}</span>
                <span class="stat-label">In Transit</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card">
            <mat-card-content>
              <div class="stat-icon delivered">
                <mat-icon>check_circle</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ stats().delivered }}</span>
                <span class="stat-label">Delivered Today</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card warning" [class.warning]="stats().pending > 5">
            <mat-card-content>
              <div class="stat-icon pending">
                <mat-icon>pending</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ stats().pending }}</span>
                <span class="stat-label">Pending</span>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Second Row Stats -->
        <div class="stats-grid secondary">
          <mat-card class="stat-card small">
            <mat-card-content>
              <div class="stat-icon vehicles">
                <mat-icon>directions_car</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ stats().availableVehicles }}/{{ stats().totalVehicles }}</span>
                <span class="stat-label">Available Vehicles</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card small">
            <mat-card-content>
              <div class="stat-icon drivers">
                <mat-icon>person</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ stats().availableDrivers }}/{{ stats().totalDrivers }}</span>
                <span class="stat-label">Available Drivers</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card small">
            <mat-card-content>
              <div class="stat-icon warehouses">
                <mat-icon>warehouse</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ stats().totalWarehouses }}</span>
                <span class="stat-label">Warehouses</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card small" [class.warning]="stats().lowStockItems > 0">
            <mat-card-content>
              <div class="stat-icon stock">
                <mat-icon>inventory_2</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ stats().lowStockItems }}</span>
                <span class="stat-label">Low Stock Items</span>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Main Content Tabs -->
        <mat-card class="main-content">
          <mat-tab-group>
            <!-- Active Loads Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>assignment</mat-icon>
                Active Loads
              </ng-template>
              <div class="tab-content">
                @if (activeLoads().length === 0) {
                  <div class="empty-state">
                    <mat-icon>local_shipping</mat-icon>
                    <h3>No Active Loads</h3>
                    <p>Create a new load to get started</p>
                    <button mat-raised-button color="primary" (click)="createNewLoad()">
                      <mat-icon>add</mat-icon> Create Load
                    </button>
                  </div>
                } @else {
                  <table mat-table [dataSource]="activeLoads()" class="loads-table">
                    <ng-container matColumnDef="loadNumber">
                      <th mat-header-cell *matHeaderCellDef>Load #</th>
                      <td mat-cell *matCellDef="let load">
                        <strong>{{ load.loadNumber }}</strong>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="customer">
                      <th mat-header-cell *matHeaderCellDef>Customer</th>
                      <td mat-cell *matCellDef="let load">{{ load.customerName }}</td>
                    </ng-container>

                    <ng-container matColumnDef="route">
                      <th mat-header-cell *matHeaderCellDef>Route</th>
                      <td mat-cell *matCellDef="let load">
                        <div class="route-cell">
                          <span>{{ load.origin }}</span>
                          <mat-icon>arrow_forward</mat-icon>
                          <span>{{ load.destination }}</span>
                        </div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="vehicle">
                      <th mat-header-cell *matHeaderCellDef>Vehicle</th>
                      <td mat-cell *matCellDef="let load">{{ load.vehicleRegistration || 'Unassigned' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="driver">
                      <th mat-header-cell *matHeaderCellDef>Driver</th>
                      <td mat-cell *matCellDef="let load">{{ load.driverName || 'Unassigned' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Status</th>
                      <td mat-cell *matCellDef="let load">
                        <mat-chip [ngClass]="getStatusClass(load.status)">
                          {{ load.status }}
                        </mat-chip>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="progress">
                      <th mat-header-cell *matHeaderCellDef>Progress</th>
                      <td mat-cell *matCellDef="let load">
                        <div class="progress-cell">
                          <mat-progress-bar mode="determinate" [value]="load.progress"></mat-progress-bar>
                          <span>{{ load.progress }}%</span>
                        </div>
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let load">
                        <button mat-icon-button [matMenuTriggerFor]="loadMenu" matTooltip="Actions">
                          <mat-icon>more_vert</mat-icon>
                        </button>
                        <mat-menu #loadMenu="matMenu">
                          <button mat-menu-item (click)="viewLoadDetails(load)">
                            <mat-icon>visibility</mat-icon>
                            <span>View Details</span>
                          </button>
                          <button mat-menu-item (click)="trackLoad(load)">
                            <mat-icon>gps_fixed</mat-icon>
                            <span>Track</span>
                          </button>
                          <button mat-menu-item (click)="updateLoadStatus(load)">
                            <mat-icon>edit</mat-icon>
                            <span>Update Status</span>
                          </button>
                        </mat-menu>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="loadColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: loadColumns;"></tr>
                  </table>
                }
              </div>
            </mat-tab>

            <!-- Fleet Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>directions_car</mat-icon>
                Fleet (Live)
              </ng-template>
              <div class="tab-content">
                @if (vehicles().length === 0) {
                  <div class="empty-state">
                    <mat-icon>directions_car</mat-icon>
                    <h3>No Vehicles</h3>
                    <p>Add vehicles to your fleet or check CarTrack connection</p>
                    <button mat-raised-button color="primary" (click)="addVehicle()">
                      <mat-icon>add</mat-icon> Add Vehicle
                    </button>
                  </div>
                } @else {
                  <div class="fleet-grid">
                    @for (vehicle of vehicles(); track vehicle.registrationNumber) {
                      <mat-card class="vehicle-card" [ngClass]="'status-' + vehicle.status.toLowerCase().replace(' ', '-')">
                        <mat-card-header>
                          <mat-icon mat-card-avatar>local_shipping</mat-icon>
                          <mat-card-title>{{ vehicle.registrationNumber }}</mat-card-title>
                          <mat-card-subtitle>
                            @if (vehicle.speed !== undefined && vehicle.speed > 0) {
                              <span class="speed-indicator">{{ vehicle.speed }} km/h</span>
                            } @else {
                              {{ vehicle.type || 'Vehicle' }}
                            }
                          </mat-card-subtitle>
                        </mat-card-header>
                        <mat-card-content>
                          <div class="vehicle-info">
                            <div class="info-row">
                              <mat-icon>person</mat-icon>
                              <span>{{ vehicle.currentDriver || 'No driver assigned' }}</span>
                            </div>
                            <div class="info-row">
                              <mat-icon>location_on</mat-icon>
                              <span class="location-text">{{ vehicle.lastLocation || 'Unknown location' }}</span>
                            </div>
                            @if (vehicle.speed !== undefined) {
                              <div class="info-row">
                                <mat-icon>speed</mat-icon>
                                <span>{{ vehicle.speed }} km/h</span>
                                @if (vehicle.speed > 0) {
                                  <span class="moving-badge">MOVING</span>
                                } @else {
                                  <span class="stationary-badge">STATIONARY</span>
                                }
                              </div>
                            }
                            @if (vehicle.lastUpdate) {
                              <div class="info-row">
                                <mat-icon>schedule</mat-icon>
                                <span class="update-time">Updated: {{ formatLastUpdate(vehicle.lastUpdate) }}</span>
                              </div>
                            }
                          </div>
                          <mat-chip class="status-chip" [ngClass]="'status-' + vehicle.status.toLowerCase().replace(' ', '-')">
                            {{ vehicle.status }}
                          </mat-chip>
                        </mat-card-content>
                        <mat-card-actions>
                          <button mat-button color="primary" (click)="viewVehicleDetails(vehicle)">
                            <mat-icon>visibility</mat-icon> Details
                          </button>
                          <button mat-button (click)="trackVehicle(vehicle)">
                            <mat-icon>gps_fixed</mat-icon> Track
                          </button>
                        </mat-card-actions>
                      </mat-card>
                    }
                  </div>
                }
              </div>
            </mat-tab>

            <!-- Warehouses Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>warehouse</mat-icon>
                Warehouses
              </ng-template>
              <div class="tab-content">
                @if (warehouses().length === 0) {
                  <div class="empty-state">
                    <mat-icon>warehouse</mat-icon>
                    <h3>No Warehouses Found</h3>
                    <p>No warehouses have been configured yet</p>
                    <button mat-raised-button color="primary">
                      <mat-icon>add</mat-icon> Add Warehouse
                    </button>
                  </div>
                } @else {
                  <div class="warehouses-grid">
                    @for (warehouse of warehouses(); track warehouse.id) {
                      <mat-card class="warehouse-card">
                        <mat-card-header>
                          <div class="warehouse-icon">
                            <mat-icon>warehouse</mat-icon>
                          </div>
                          <mat-card-title>{{ warehouse.name }}</mat-card-title>
                          <mat-card-subtitle>
                            <mat-icon class="location-icon">place</mat-icon>
                            {{ warehouse.location }}
                          </mat-card-subtitle>
                        </mat-card-header>
                        <mat-card-content>
                          <div class="warehouse-stats-row">
                            <div class="warehouse-stat">
                              <mat-icon>inventory_2</mat-icon>
                              <div>
                                <span class="stat-number">{{ warehouse.totalItems | number }}</span>
                                <span class="stat-text">Items</span>
                              </div>
                            </div>
                            <div class="warehouse-stat">
                              <mat-icon>category</mat-icon>
                              <div>
                                <span class="stat-number">{{ warehouse.categories }}</span>
                                <span class="stat-text">Categories</span>
                              </div>
                            </div>
                          </div>
                          <div class="capacity-section">
                            <div class="capacity-header">
                              <span>Capacity</span>
                              <span class="capacity-percent" [class.high]="warehouse.capacityPercent > 80">{{ warehouse.capacityPercent }}%</span>
                            </div>
                            <mat-progress-bar 
                              mode="determinate" 
                              [value]="warehouse.capacityPercent"
                              [color]="warehouse.capacityPercent > 80 ? 'warn' : 'primary'">
                            </mat-progress-bar>
                          </div>
                          @if (warehouse.managerName) {
                            <div class="manager-info">
                              <mat-icon>person</mat-icon>
                              <span>{{ warehouse.managerName }}</span>
                            </div>
                          }
                        </mat-card-content>
                        <mat-card-actions>
                          <button mat-button color="primary" routerLink="/stock-management">
                            <mat-icon>visibility</mat-icon>
                            View Inventory
                          </button>
                        </mat-card-actions>
                      </mat-card>
                    }
                  </div>
                }
              </div>
            </mat-tab>

            <!-- Tracking Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>gps_fixed</mat-icon>
                Live Tracking
              </ng-template>
              <div class="tab-content">
                <div class="tracking-placeholder">
                  <mat-icon>map</mat-icon>
                  <h3>Live Vehicle Tracking</h3>
                  <p>Real-time GPS tracking integrated with CarTrack</p>
                  <p class="hint">Select a vehicle or load to view its location</p>
                </div>
              </div>
            </mat-tab>

            <!-- Invoices Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon [matBadge]="stats().overdueInvoices" matBadgeColor="warn" 
                  [matBadgeHidden]="stats().overdueInvoices === 0">receipt</mat-icon>
                Invoices
              </ng-template>
              <div class="tab-content">
                <div class="empty-state">
                  <mat-icon>receipt_long</mat-icon>
                  <h3>Invoice Management</h3>
                  <p>Track and manage delivery invoices</p>
                  <div class="invoice-stats">
                    <div class="invoice-stat">
                      <span class="value">{{ stats().pendingInvoices }}</span>
                      <span class="label">Pending</span>
                    </div>
                    <div class="invoice-stat overdue">
                      <span class="value">{{ stats().overdueInvoices }}</span>
                      <span class="label">Overdue</span>
                    </div>
                  </div>
                  <button mat-raised-button color="primary">
                    <mat-icon>add</mat-icon> Create Invoice
                  </button>
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .logistics-dashboard {
      padding: 24px;
      padding-top: 88px;
      max-width: 1600px;
      margin: 0 auto;
    }

    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .header-left h1 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 28px;
      font-weight: 500;
      color: white;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .header-left h1 mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .subtitle {
      margin: 4px 0 0 48px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 14px;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
      color: white;
    }

    .loading-container p {
      margin-top: 16px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 16px;
    }

    .stats-grid.secondary {
      margin-bottom: 24px;
    }

    .stat-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }

    .stat-card.warning .stat-value {
      color: #f44336;
    }

    .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px !important;
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .stat-card.small .stat-icon {
      width: 48px;
      height: 48px;
    }

    .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .stat-icon.loads { background: linear-gradient(135deg, #667eea, #764ba2); }
    .stat-icon.transit { background: linear-gradient(135deg, #4facfe, #00f2fe); }
    .stat-icon.delivered { background: linear-gradient(135deg, #11998e, #38ef7d); }
    .stat-icon.pending { background: linear-gradient(135deg, #fa709a, #fee140); }
    .stat-icon.vehicles { background: linear-gradient(135deg, #667eea, #764ba2); }
    .stat-icon.drivers { background: linear-gradient(135deg, #f093fb, #f5576c); }
    .stat-icon.warehouses { background: linear-gradient(135deg, #4facfe, #00f2fe); }
    .stat-icon.stock { background: linear-gradient(135deg, #fa709a, #fee140); }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      line-height: 1.2;
    }

    .stat-card.small .stat-value {
      font-size: 22px;
    }

    .stat-label {
      font-size: 14px;
      color: #666;
    }

    .main-content {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      overflow: hidden;
    }

    .tab-content {
      padding: 24px;
      min-height: 400px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      color: #666;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #bbb;
      margin-bottom: 16px;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .empty-state p {
      margin: 0 0 24px 0;
    }

    /* Warehouses Grid */
    .warehouses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
      padding: 8px;
    }

    .warehouse-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .warehouse-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }

    .warehouse-card mat-card-header {
      margin-bottom: 16px;
    }

    .warehouse-card .warehouse-icon {
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }

    .warehouse-card .warehouse-icon mat-icon {
      color: white;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .warehouse-card mat-card-subtitle {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
    }

    .warehouse-card .location-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .warehouse-stats-row {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
    }

    .warehouse-stat {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #f5f5f5;
      border-radius: 8px;
      flex: 1;
    }

    .warehouse-stat mat-icon {
      color: #1e90ff;
    }

    .warehouse-stat .stat-number {
      font-size: 1.25rem;
      font-weight: 700;
      display: block;
    }

    .warehouse-stat .stat-text {
      font-size: 0.75rem;
      color: #666;
    }

    .capacity-section {
      margin-bottom: 16px;
    }

    .capacity-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.875rem;
    }

    .capacity-percent {
      font-weight: 600;
      color: #1e90ff;
    }

    .capacity-percent.high {
      color: #f44336;
    }

    .manager-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #e3f2fd;
      border-radius: 8px;
      font-size: 0.875rem;
      color: #1976d2;
    }

    .manager-info mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .warehouse-card mat-card-actions {
      padding: 16px;
      border-top: 1px solid #eee;
    }

    .loads-table {
      width: 100%;
    }

    .route-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .route-cell mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #666;
    }

    .progress-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 120px;
    }

    .progress-cell mat-progress-bar {
      flex: 1;
    }

    .progress-cell span {
      font-size: 12px;
      color: #666;
      min-width: 35px;
    }

    .status-pending { background-color: #fff3e0 !important; color: #e65100 !important; }
    .status-intransit, .status-in-transit { background-color: #e3f2fd !important; color: #1565c0 !important; }
    .status-delivered { background-color: #e8f5e9 !important; color: #2e7d32 !important; }
    .status-available { background-color: #e8f5e9 !important; color: #2e7d32 !important; }
    .status-onduty, .status-on-duty { background-color: #e3f2fd !important; color: #1565c0 !important; }
    .status-maintenance { background-color: #fff3e0 !important; color: #e65100 !important; }

    .fleet-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
    }

    .vehicle-card {
      border-left: 4px solid #1976d2;
    }

    .vehicle-card.status-available { border-left-color: #4caf50; }
    .vehicle-card.status-onduty, .vehicle-card.status-on-duty { border-left-color: #2196f3; }
    .vehicle-card.status-maintenance { border-left-color: #ff9800; }

    .vehicle-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .vehicle-title {
      margin: 0 !important;
      font-size: 16px;
      font-weight: 600;
    }

    .moving-badge {
      background: linear-gradient(135deg, #4caf50, #2e7d32);
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      animation: pulse 2s infinite;
    }

    .stationary-badge {
      background: linear-gradient(135deg, #9e9e9e, #616161);
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(76, 175, 80, 0); }
      100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
    }

    .speed-indicator {
      display: flex;
      align-items: center;
      gap: 6px;
      background: linear-gradient(135deg, #e3f2fd, #bbdefb);
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 12px;
    }

    .speed-indicator mat-icon {
      color: #1976d2;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .speed-indicator strong {
      font-size: 18px;
      color: #1565c0;
    }

    .speed-indicator span {
      color: #666;
      font-size: 12px;
    }

    .location-text {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .location-text mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #f44336;
      flex-shrink: 0;
    }

    .update-time {
      font-size: 11px;
      color: #999;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .update-time mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    .vehicle-info {
      margin: 16px 0;
    }

    .info-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .info-row mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #666;
    }

    .fuel-bar {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .fuel-bar mat-progress-bar {
      flex: 1;
    }

    .fuel-bar span {
      font-size: 12px;
      color: #666;
    }

    .status-chip {
      font-size: 11px;
    }

    .tracking-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      background: #f5f5f5;
      border-radius: 12px;
      text-align: center;
    }

    .tracking-placeholder mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #1976d2;
      margin-bottom: 16px;
    }

    .tracking-placeholder h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .tracking-placeholder p {
      margin: 0;
      color: #666;
    }

    .tracking-placeholder .hint {
      margin-top: 8px;
      font-size: 12px;
      color: #999;
    }

    .invoice-stats {
      display: flex;
      gap: 32px;
      margin-bottom: 24px;
    }

    .invoice-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .invoice-stat .value {
      font-size: 32px;
      font-weight: 600;
      color: #1976d2;
    }

    .invoice-stat.overdue .value {
      color: #f44336;
    }

    .invoice-stat .label {
      font-size: 12px;
      color: #666;
    }

    @media (max-width: 1200px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .dashboard-header {
        flex-direction: column;
      }

      .header-actions {
        width: 100%;
        justify-content: stretch;
      }

      .header-actions button {
        flex: 1;
      }
    }
  `]
})
export class LogisticsDashboardComponent implements OnInit {
  private apiUrl = environment.apiUrl;

  loading = signal(true);
  stats = signal<DashboardStats>({
    activeLoads: 0,
    inTransit: 0,
    delivered: 0,
    pending: 0,
    totalVehicles: 0,
    availableVehicles: 0,
    totalDrivers: 0,
    availableDrivers: 0,
    totalWarehouses: 0,
    lowStockItems: 0,
    pendingInvoices: 0,
    overdueInvoices: 0
  });

  activeLoads = signal<ActiveLoad[]>([]);
  vehicles = signal<Vehicle[]>([]);
  warehouses = signal<WarehouseSummary[]>([]);

  loadColumns = ['loadNumber', 'customer', 'route', 'vehicle', 'driver', 'status', 'progress', 'actions'];

  constructor(
    private http: HttpClient,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  async loadDashboardData(): Promise<void> {
    this.loading.set(true);

    try {
      // Load active loads from tracking controller
      this.http.get<any[]>(`${this.apiUrl}/tracking/active-loads`).subscribe({
        next: (loads) => {
          this.activeLoads.set(loads.map(l => ({
            ...l,
            progress: this.calculateProgress(l.status)
          })));
          this.stats.update(s => ({
            ...s,
            activeLoads: loads.length,
            inTransit: loads.filter(l => l.status === 'InTransit').length,
            pending: loads.filter(l => l.status === 'Pending' || l.status === 'Scheduled').length
          }));
        },
        error: () => {
          // Use sample data if API fails
          this.loadSampleData();
        }
      });

      // Load fleet data from CarTrack via tracking controller
      this.http.get<any>(`${this.apiUrl}/tracking/fleet-status`).subscribe({
        next: (fleetStatus) => {
          if (fleetStatus?.vehicles) {
            this.vehicles.set(fleetStatus.vehicles.map((v: any) => ({
              id: v.localVehicleId || 0,
              registrationNumber: v.registrationNumber || v.vehicleName,
              type: 'Vehicle',
              status: v.status || 'Unknown',
              currentDriver: v.currentDriverName || '',
              lastLocation: v.location?.address || 'Unknown',
              fuelLevel: 50, // CarTrack doesn't provide fuel level
              speed: v.speed,
              latitude: v.location?.latitude,
              longitude: v.location?.longitude,
              lastUpdate: v.lastUpdate
            })));
            this.stats.update(s => ({
              ...s,
              totalVehicles: fleetStatus.totalVehicles || fleetStatus.vehicles.length,
              availableVehicles: fleetStatus.stationaryCount || 0
            }));
          }
        },
        error: (err) => {
          console.error('Fleet status error:', err);
          // Fall back to database vehicles
          this.loadVehiclesFromDatabase();
        }
      });

      // Load warehouses
      this.http.get<WarehouseSummary[]>(`${this.apiUrl}/warehouses/summary`).subscribe({
        next: (data) => {
          this.warehouses.set(data);
          this.stats.update(s => ({
            ...s,
            totalWarehouses: data.length,
            lowStockItems: data.reduce((sum, w) => sum + (w.totalItems < 100 ? 1 : 0), 0)
          }));
        },
        error: (err) => {
          console.error('Warehouses error:', err);
        }
      });

      this.loading.set(false);
    } catch (error) {
      this.loadSampleData();
      this.loading.set(false);
    }
  }

  loadVehiclesFromDatabase(): void {
    this.http.get<any[]>(`${this.apiUrl}/fleet/vehicles`).subscribe({
      next: (fleet) => {
        this.vehicles.set(fleet.map(v => ({
          id: v.id,
          registrationNumber: v.registrationNumber,
          type: v.vehicleTypeName || 'Truck',
          status: v.status,
          currentDriver: v.currentDriverName || '',
          lastLocation: 'Unknown',
          fuelLevel: 50
        })));
        this.stats.update(s => ({
          ...s,
          totalVehicles: fleet.length,
          availableVehicles: fleet.filter(v => v.status === 'Available').length
        }));
      },
      error: () => {}
    });
  }

  loadSampleData(): void {
    // Sample data for demo
    this.stats.set({
      activeLoads: 12,
      inTransit: 5,
      delivered: 8,
      pending: 4,
      totalVehicles: 15,
      availableVehicles: 6,
      totalDrivers: 12,
      availableDrivers: 4,
      totalWarehouses: 3,
      lowStockItems: 2,
      pendingInvoices: 15,
      overdueInvoices: 3
    });

    this.activeLoads.set([
      { id: 1, loadNumber: 'LD-2026-001', customerName: 'ABC Logistics', origin: 'Johannesburg', destination: 'Cape Town', status: 'InTransit', vehicleRegistration: 'GP 123-456', driverName: 'John Smith', scheduledDelivery: new Date(), progress: 65 },
      { id: 2, loadNumber: 'LD-2026-002', customerName: 'XYZ Transport', origin: 'Durban', destination: 'Pretoria', status: 'Pending', vehicleRegistration: '', driverName: '', scheduledDelivery: new Date(), progress: 0 },
      { id: 3, loadNumber: 'LD-2026-003', customerName: 'FastFreight', origin: 'Port Elizabeth', destination: 'Johannesburg', status: 'InTransit', vehicleRegistration: 'GP 789-012', driverName: 'Mike Johnson', scheduledDelivery: new Date(), progress: 35 },
    ]);

    this.vehicles.set([
      { id: 1, registrationNumber: 'GP 123-456', type: 'Flatbed Truck', status: 'OnDuty', currentDriver: 'John Smith', lastLocation: 'N1 Highway', fuelLevel: 75 },
      { id: 2, registrationNumber: 'GP 789-012', type: '10-Ton Truck', status: 'OnDuty', currentDriver: 'Mike Johnson', lastLocation: 'N2 Highway', fuelLevel: 45 },
      { id: 3, registrationNumber: 'GP 345-678', type: 'Delivery Van', status: 'Available', currentDriver: '', lastLocation: 'Johannesburg Depot', fuelLevel: 90 },
      { id: 4, registrationNumber: 'GP 901-234', type: 'Refrigerated Truck', status: 'Maintenance', currentDriver: '', lastLocation: 'Workshop', fuelLevel: 20 },
    ]);

    this.loading.set(false);
  }

  calculateProgress(status: string): number {
    switch (status) {
      case 'Pending': return 0;
      case 'Scheduled': return 10;
      case 'Loading': return 25;
      case 'InTransit': return 50;
      case 'Arrived': return 85;
      case 'Delivered': return 100;
      default: return 0;
    }
  }

  getStatusClass(status: string): string {
    return 'status-' + status.toLowerCase().replace(/\s+/g, '-');
  }

  formatLastUpdate(date: Date | string | undefined): string {
    if (!date) return 'Unknown';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return d.toLocaleDateString();
  }

  refreshData(): void {
    this.loadDashboardData();
  }

  createNewLoad(): void {
    console.log('Create new load');
  }

  viewLoadDetails(load: ActiveLoad): void {
    console.log('View load details', load);
  }

  trackLoad(load: ActiveLoad): void {
    console.log('Track load', load);
  }

  updateLoadStatus(load: ActiveLoad): void {
    console.log('Update load status', load);
  }

  addVehicle(): void {
    console.log('Add vehicle');
  }

  viewVehicleDetails(vehicle: Vehicle): void {
    console.log('View vehicle details', vehicle);
  }

  trackVehicle(vehicle: Vehicle): void {
    console.log('Track vehicle', vehicle);
    if (vehicle.latitude && vehicle.longitude) {
      window.open(`https://www.google.com/maps?q=${vehicle.latitude},${vehicle.longitude}`, '_blank');
    }
  }
}
