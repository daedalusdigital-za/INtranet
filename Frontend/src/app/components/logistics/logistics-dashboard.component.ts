import { Component, OnInit, signal, computed, AfterViewInit, OnDestroy, ViewChild, ElementRef, Inject, Injector, inject } from '@angular/core';
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
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatStepperModule } from '@angular/material/stepper';
import { CdkDragDrop, CdkDrag, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
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
  vehiclesInMaintenance: number;
  upcomingMaintenance: number;
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
  vehicleTypeName?: string;
  status: string;
  currentDriver: string;
  currentDriverId?: number;
  currentDriverName?: string;
  lastLocation: string;
  fuelLevel: number;
  fuelCapacity?: number;
  speed?: number;
  latitude?: number;
  longitude?: number;
  heading?: number;
  lastUpdate?: Date;
  liveStatus?: string;  // moving, stopped, idling, offline
  // CarTrack integration
  carTrackId?: string;
  isLinkedToCarTrack?: boolean;
  // TFN integration
  tfnVehicleId?: string;
  tfnSubAccountNumber?: string;
  tfnVirtualCardNumber?: string;
  tfnCreditLimit?: number;
  tfnCurrentBalance?: number;
  tfnLastSyncedAt?: Date;
  tankSize?: number;
  fuelType?: string;
  averageFuelConsumption?: number;
  isLinkedToTfn?: boolean;
  // Additional fields for edit
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  vinNumber?: string;
  vehicleTypeId?: number;
}

interface ImportedInvoice {
  id: number;
  transactionNumber: string;
  customerNumber: string;
  customerName: string;
  productCode: string;
  productDescription: string;
  transactionDate: Date;
  quantity: number;
  salesAmount: number;
  costOfSales: number;
  status: string;
  sourceSystem: string;
  deliveryProvince?: string;
  deliveryCity?: string;
  deliveryAddress?: string;
  importBatchId?: string;
  loadId?: number;
  importedAt: Date;
}

interface MaintenanceRecord {
  id: number;
  vehicleId: number;
  vehicleReg: string;
  vehicleType: string;
  maintenanceType: 'scheduled' | 'repair' | 'license' | 'inspection' | 'other';
  description: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  scheduledDate: Date;
  completedDate?: Date;
  estimatedCost?: number;
  actualCost?: number;
  assignedTo?: string;
  notes?: string;
  licenseExpiryDate?: Date;
  daysUntilExpiry?: number;
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
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDividerModule,
    FormsModule,
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
          <p class="subtitle">Fleet, Loads, Maintenance & Tracking</p>
        </div>
        <div class="header-actions">
          <button mat-raised-button color="accent" (click)="syncFromCarTrack()" [disabled]="syncing()">
            <mat-icon>{{ syncing() ? 'sync' : 'cloud_sync' }}</mat-icon> 
            {{ syncing() ? 'Syncing...' : 'Sync CarTrack' }}
          </button>
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

          <mat-card class="stat-card warning clickable" [class.warning]="tfnOrdersCount() > 5" (click)="openTfnOrdersDialog()">
            <mat-card-content>
              <div class="stat-icon tfn-orders">
                <mat-icon>local_gas_station</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ tfnOrdersCount() }}</span>
                <span class="stat-label">TFN Orders</span>
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

          <mat-card class="stat-card small clickable" (click)="scrollToMaintenanceTab()">
            <mat-card-content>
              <div class="stat-icon maintenance">
                <mat-icon>build</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ stats().vehiclesInMaintenance }}</span>
                <span class="stat-label">In Maintenance</span>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="stat-card small clickable" (click)="openDepotsMapDialog()">
            <mat-card-content>
              <div class="stat-icon depots">
                <mat-icon>local_gas_station</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ tfnDepotsCount() }}</span>
                <span class="stat-label">TFN Depots</span>
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
                <div class="fleet-toolbar">
                  <div class="fleet-stats">
                    <span class="stat-badge linked">
                      <mat-icon>link</mat-icon>
                      Linked: {{ getLinkedVehicleCount() }}
                    </span>
                    <span class="stat-badge unlinked">
                      <mat-icon>link_off</mat-icon>
                      Unlinked: {{ vehicles().length - getLinkedVehicleCount() }}
                    </span>
                  </div>
                  <div class="fleet-actions">
                    <button mat-stroked-button (click)="syncCarTrackVehicles()" [disabled]="carTrackSyncing()">
                      @if (carTrackSyncing()) {
                        <mat-spinner diameter="18"></mat-spinner>
                      } @else {
                        <mat-icon>gps_fixed</mat-icon>
                      }
                      Sync CarTrack
                    </button>
                    <button mat-stroked-button color="primary" (click)="syncTfnVehicles()" [disabled]="tfnSyncing()">
                      @if (tfnSyncing()) {
                        <mat-spinner diameter="18"></mat-spinner>
                      } @else {
                        <mat-icon>local_gas_station</mat-icon>
                      }
                      Sync TFN
                    </button>
                    <button mat-stroked-button (click)="loadVehiclesFromDatabase()">
                      <mat-icon>refresh</mat-icon>
                      Refresh
                    </button>
                    <button mat-raised-button color="primary" (click)="addVehicle()">
                      <mat-icon>add</mat-icon> Add Vehicle
                    </button>
                  </div>
                </div>
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
                              {{ vehicle.type || vehicle.vehicleTypeName || 'Vehicle' }}
                            }
                          </mat-card-subtitle>
                          <!-- Integration badges -->
                          <div class="integration-badges">
                            @if (vehicle.carTrackId || vehicle.isLinkedToCarTrack) {
                              <span class="badge cartrack-badge" matTooltip="Linked to CarTrack">
                                <mat-icon>gps_fixed</mat-icon> CT
                              </span>
                            }
                            @if (vehicle.tfnVehicleId || vehicle.isLinkedToTfn || vehicle.tankSize) {
                              <span class="badge tfn-badge" matTooltip="TruckFuelNet - Tank: {{ vehicle.tankSize || vehicle.fuelCapacity || '?' }}L">
                                <mat-icon>local_gas_station</mat-icon> TFN
                              </span>
                            }
                          </div>
                          <!-- Actions menu -->
                          <button mat-icon-button [matMenuTriggerFor]="vehicleMenu" class="vehicle-menu-btn" (click)="$event.stopPropagation()">
                            <mat-icon>more_vert</mat-icon>
                          </button>
                          <mat-menu #vehicleMenu="matMenu">
                            <button mat-menu-item (click)="viewVehicleDetails(vehicle)">
                              <mat-icon>visibility</mat-icon>
                              <span>View Details</span>
                            </button>
                            <button mat-menu-item (click)="editVehicle(vehicle)">
                              <mat-icon>edit</mat-icon>
                              <span>Edit Vehicle</span>
                            </button>
                            <button mat-menu-item (click)="assignDriver(vehicle)">
                              <mat-icon>person_add</mat-icon>
                              <span>Assign Driver</span>
                            </button>
                            <mat-divider></mat-divider>
                            @if (vehicle.carTrackId || vehicle.isLinkedToCarTrack) {
                              <button mat-menu-item (click)="unlinkCarTrack(vehicle)">
                                <mat-icon>link_off</mat-icon>
                                <span>Unlink CarTrack</span>
                              </button>
                            } @else {
                              <button mat-menu-item (click)="linkCarTrack(vehicle)">
                                <mat-icon>link</mat-icon>
                                <span>Link to CarTrack</span>
                              </button>
                            }
                            @if (vehicle.tfnVehicleId || vehicle.isLinkedToTfn) {
                              <button mat-menu-item (click)="unlinkTfn(vehicle)">
                                <mat-icon>link_off</mat-icon>
                                <span>Unlink TFN</span>
                              </button>
                            } @else {
                              <button mat-menu-item (click)="linkTfn(vehicle)">
                                <mat-icon>link</mat-icon>
                                <span>Link to TFN</span>
                              </button>
                            }
                            <mat-divider></mat-divider>
                            <button mat-menu-item (click)="trackVehicle(vehicle)">
                              <mat-icon>gps_fixed</mat-icon>
                              <span>Track Location</span>
                            </button>
                            <button mat-menu-item (click)="viewFuelHistory(vehicle)">
                              <mat-icon>local_gas_station</mat-icon>
                              <span>Fuel History</span>
                            </button>
                            <button mat-menu-item (click)="viewVehicleMaintenanceHistory(vehicle)">
                              <mat-icon>build</mat-icon>
                              <span>Maintenance History</span>
                            </button>
                            <mat-divider></mat-divider>
                            <button mat-menu-item class="delete-action" (click)="deleteVehicle(vehicle)">
                              <mat-icon color="warn">delete</mat-icon>
                              <span>Delete Vehicle</span>
                            </button>
                          </mat-menu>
                        </mat-card-header>
                        <mat-card-content>
                          <div class="vehicle-info">
                            <div class="info-row">
                              <mat-icon>person</mat-icon>
                              <span>{{ vehicle.currentDriver || vehicle.currentDriverName || 'No driver assigned' }}</span>
                            </div>
                            <div class="info-row">
                              <mat-icon>location_on</mat-icon>
                              <span class="location-text">{{ vehicle.lastLocation || 'Unknown location' }}</span>
                            </div>
                            <!-- Always show speed for CarTrack linked vehicles -->
                            @if (vehicle.carTrackId || vehicle.isLinkedToCarTrack) {
                              <div class="info-row speed-row">
                                <mat-icon>speed</mat-icon>
                                <span class="speed-value">{{ vehicle.speed ?? 0 }} km/h</span>
                                @if ((vehicle.speed ?? 0) > 0 || vehicle.liveStatus === 'moving') {
                                  <span class="moving-badge">MOVING</span>
                                } @else if (vehicle.liveStatus === 'idling') {
                                  <span class="idling-badge">IDLING</span>
                                } @else if (vehicle.liveStatus === 'offline') {
                                  <span class="offline-badge">OFFLINE</span>
                                } @else {
                                  <span class="stationary-badge">STATIONARY</span>
                                }
                              </div>
                            }
                            @if (vehicle.tankSize || vehicle.fuelCapacity) {
                              <div class="info-row">
                                <mat-icon>local_gas_station</mat-icon>
                                <span>Tank: {{ vehicle.tankSize || vehicle.fuelCapacity }} L</span>
                                @if (vehicle.fuelType) {
                                  <span class="fuel-type-badge">{{ vehicle.fuelType }}</span>
                                }
                              </div>
                            }
                            @if (vehicle.tfnCreditLimit && vehicle.tfnCurrentBalance !== undefined) {
                              <div class="info-row tfn-balance">
                                <mat-icon>account_balance_wallet</mat-icon>
                                <span>Balance: R{{ vehicle.tfnCurrentBalance | number:'1.2-2' }} / R{{ vehicle.tfnCreditLimit | number:'1.2-2' }}</span>
                              </div>
                            }
                            @if (vehicle.lastUpdate) {
                              <div class="info-row">
                                <mat-icon>schedule</mat-icon>
                                <span class="update-time">Updated: {{ formatLastUpdate(vehicle.lastUpdate) }}</span>
                              </div>
                            }
                          </div>
                          <div class="card-footer">
                            <mat-chip class="status-chip" [ngClass]="'status-' + vehicle.status.toLowerCase().replace(' ', '-')">
                              {{ vehicle.status }}
                            </mat-chip>
                            @if (vehicle.tfnVehicleId || vehicle.isLinkedToTfn) {
                              <div class="tfn-indicator" matTooltip="TruckFuelNet Integrated">
                                <mat-icon>local_gas_station</mat-icon>
                              </div>
                            }
                          </div>
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

            <!-- Maintenance Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>build</mat-icon>
                Maintenance
              </ng-template>
              <div class="tab-content">
                <div class="maintenance-header">
                  <div class="maintenance-stats-row">
                    <mat-card class="maintenance-stat-card critical">
                      <mat-icon>warning</mat-icon>
                      <div class="stat-info">
                        <span class="stat-value">{{ getMaintenanceByStatus('overdue').length }}</span>
                        <span class="stat-label">Overdue</span>
                      </div>
                    </mat-card>
                    <mat-card class="maintenance-stat-card in-progress">
                      <mat-icon>engineering</mat-icon>
                      <div class="stat-info">
                        <span class="stat-value">{{ getMaintenanceByStatus('in-progress').length }}</span>
                        <span class="stat-label">In Progress</span>
                      </div>
                    </mat-card>
                    <mat-card class="maintenance-stat-card scheduled">
                      <mat-icon>schedule</mat-icon>
                      <div class="stat-info">
                        <span class="stat-value">{{ getMaintenanceByStatus('scheduled').length }}</span>
                        <span class="stat-label">Scheduled</span>
                      </div>
                    </mat-card>
                    <mat-card class="maintenance-stat-card license">
                      <mat-icon>badge</mat-icon>
                      <div class="stat-info">
                        <span class="stat-value">{{ getExpiringLicenses().length }}</span>
                        <span class="stat-label">Licenses Expiring</span>
                      </div>
                    </mat-card>
                  </div>
                  <div class="maintenance-actions">
                    <button mat-raised-button color="primary" (click)="openAddMaintenanceDialog()">
                      <mat-icon>add</mat-icon>
                      Schedule Maintenance
                    </button>
                    <button mat-raised-button (click)="loadMaintenanceRecords()">
                      <mat-icon>refresh</mat-icon>
                      Refresh
                    </button>
                  </div>
                </div>

                @if (maintenanceRecords().length === 0) {
                  <div class="empty-state">
                    <mat-icon>build_circle</mat-icon>
                    <h3>No Maintenance Records</h3>
                    <p>No vehicles are currently scheduled for maintenance</p>
                    <button mat-raised-button color="primary" (click)="openAddMaintenanceDialog()">
                      <mat-icon>add</mat-icon> Schedule Maintenance
                    </button>
                  </div>
                } @else {
                  <!-- License Expiry Alerts -->
                  @if (getExpiringLicenses().length > 0) {
                    <div class="license-alerts">
                      <h4><mat-icon>notification_important</mat-icon> License Expiry Alerts</h4>
                      <div class="license-cards">
                        @for (record of getExpiringLicenses(); track record.id) {
                          <mat-card class="license-card" [class.critical]="record.daysUntilExpiry! <= 7" [class.warning]="record.daysUntilExpiry! > 7 && record.daysUntilExpiry! <= 30">
                            <div class="license-info">
                              <mat-icon>directions_car</mat-icon>
                              <div>
                                <span class="vehicle-reg">{{ record.vehicleReg }}</span>
                                <span class="expiry-text">
                                  @if (record.daysUntilExpiry! <= 0) {
                                    License EXPIRED!
                                  } @else {
                                    Expires in {{ record.daysUntilExpiry }} days
                                  }
                                </span>
                              </div>
                            </div>
                            <button mat-icon-button color="primary" matTooltip="Schedule License Renewal" (click)="scheduleLicenseRenewal(record)">
                              <mat-icon>event</mat-icon>
                            </button>
                          </mat-card>
                        }
                      </div>
                    </div>
                  }

                  <!-- Maintenance Grid -->
                  <div class="maintenance-grid">
                    @for (record of maintenanceRecords(); track record.id) {
                      <mat-card class="maintenance-card" [class]="'status-' + record.status">
                        <mat-card-header>
                          <div class="maintenance-icon" [class]="'type-' + record.maintenanceType">
                            @switch (record.maintenanceType) {
                              @case ('scheduled') { <mat-icon>event</mat-icon> }
                              @case ('repair') { <mat-icon>build</mat-icon> }
                              @case ('license') { <mat-icon>badge</mat-icon> }
                              @case ('inspection') { <mat-icon>fact_check</mat-icon> }
                              @default { <mat-icon>miscellaneous_services</mat-icon> }
                            }
                          </div>
                          <mat-card-title>{{ record.vehicleReg }}</mat-card-title>
                          <mat-card-subtitle>{{ record.vehicleType }}</mat-card-subtitle>
                        </mat-card-header>
                        <mat-card-content>
                          <div class="maintenance-type-badge" [class]="record.maintenanceType">
                            {{ record.maintenanceType | titlecase }}
                          </div>
                          <p class="maintenance-description">{{ record.description }}</p>
                          
                          <div class="maintenance-details">
                            <div class="detail-row">
                              <mat-icon>calendar_today</mat-icon>
                              <span>{{ record.scheduledDate | date:'dd MMM yyyy' }}</span>
                            </div>
                            @if (record.assignedTo) {
                              <div class="detail-row">
                                <mat-icon>person</mat-icon>
                                <span>{{ record.assignedTo }}</span>
                              </div>
                            }
                            @if (record.estimatedCost) {
                              <div class="detail-row">
                                <mat-icon>payments</mat-icon>
                                <span>Est: R{{ record.estimatedCost | number:'1.2-2' }}</span>
                              </div>
                            }
                          </div>

                          <div class="status-section">
                            <span class="status-badge" [class]="record.status">
                              @switch (record.status) {
                                @case ('scheduled') { <mat-icon>schedule</mat-icon> Scheduled }
                                @case ('in-progress') { <mat-icon>engineering</mat-icon> In Progress }
                                @case ('completed') { <mat-icon>check_circle</mat-icon> Completed }
                                @case ('overdue') { <mat-icon>warning</mat-icon> Overdue }
                              }
                            </span>
                            <span class="priority-badge" [class]="record.priority">
                              {{ record.priority | titlecase }}
                            </span>
                          </div>
                        </mat-card-content>
                        <mat-card-actions>
                          @if (record.status === 'scheduled') {
                            <button mat-button color="primary" (click)="startMaintenance(record)">
                              <mat-icon>play_arrow</mat-icon> Start
                            </button>
                          }
                          @if (record.status === 'in-progress') {
                            <button mat-button color="accent" (click)="completeMaintenance(record)">
                              <mat-icon>check</mat-icon> Complete
                            </button>
                          }
                          <button mat-icon-button [matMenuTriggerFor]="maintenanceMenu">
                            <mat-icon>more_vert</mat-icon>
                          </button>
                          <mat-menu #maintenanceMenu="matMenu">
                            <button mat-menu-item (click)="editMaintenance(record)">
                              <mat-icon>edit</mat-icon> Edit
                            </button>
                            <button mat-menu-item (click)="viewMaintenanceHistory(record)">
                              <mat-icon>history</mat-icon> View History
                            </button>
                            <button mat-menu-item class="delete-action" (click)="deleteMaintenance(record)">
                              <mat-icon>delete</mat-icon> Delete
                            </button>
                          </mat-menu>
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
                <div class="tracking-section">
                  <div class="tracking-header">
                    <h3><mat-icon>map</mat-icon> Live Vehicle Tracking</h3>
                    <p>Real-time GPS tracking integrated with CarTrack</p>
                  </div>
                  <div class="tracking-actions">
                    <button mat-raised-button color="primary" (click)="openFleetMap()">
                      <mat-icon>map</mat-icon>
                      Open Fleet Map
                    </button>
                    <button mat-raised-button (click)="refreshFleetLocations()">
                      <mat-icon>refresh</mat-icon>
                      Refresh Locations
                    </button>
                  </div>
                  
                  @if (vehicles().length > 0) {
                    <div class="vehicle-list-compact">
                      <h4>Quick Vehicle Status</h4>
                      <div class="vehicle-status-grid">
                        @for (vehicle of vehicles(); track vehicle.registrationNumber) {
                          <div class="vehicle-status-item" 
                               [class.moving]="vehicle.speed && vehicle.speed > 0"
                               [class.offline]="vehicle.status === 'offline'"
                               (click)="openSingleVehicleMap(vehicle)">
                            <mat-icon>{{ vehicle.speed && vehicle.speed > 0 ? 'local_shipping' : 'local_parking' }}</mat-icon>
                            <div class="vehicle-quick-info">
                              <strong>{{ vehicle.registrationNumber }}</strong>
                              <span class="speed-label">{{ vehicle.speed ? vehicle.speed + ' km/h' : 'Stationary' }}</span>
                            </div>
                            <button mat-icon-button color="primary" matTooltip="View on Map">
                              <mat-icon>place</mat-icon>
                            </button>
                          </div>
                        }
                      </div>
                    </div>
                  } @else {
                    <div class="tracking-placeholder">
                      <mat-icon>satellite_alt</mat-icon>
                      <h3>No Vehicle Data Available</h3>
                      <p>Connect to CarTrack to view vehicle locations</p>
                    </div>
                  }
                </div>
              </div>
            </mat-tab>

            <!-- Invoices Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon [matBadge]="stats().pendingInvoices" matBadgeColor="accent" 
                  [matBadgeHidden]="stats().pendingInvoices === 0">receipt</mat-icon>
                Invoices
              </ng-template>
              <div class="tab-content">
                <div class="invoices-section">
                  <div class="invoices-header">
                    <h3><mat-icon>receipt_long</mat-icon> Imported Invoices</h3>
                    <div class="invoices-actions">
                      <mat-form-field appearance="outline" class="search-field">
                        <mat-label>Search Invoices</mat-label>
                        <input matInput [value]="invoiceSearch()" (input)="invoiceSearch.set($any($event.target).value)" placeholder="Invoice #, customer, product...">
                        <mat-icon matSuffix>search</mat-icon>
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="filter-field">
                        <mat-label>Status</mat-label>
                        <mat-select [value]="invoiceStatusFilter()" (selectionChange)="invoiceStatusFilter.set($event.value)">
                          <mat-option value="all">All</mat-option>
                          <mat-option value="pending">Pending</mat-option>
                          <mat-option value="assigned">Assigned</mat-option>
                          <mat-option value="delivered">Delivered</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="filter-field">
                        <mat-label>Company</mat-label>
                        <mat-select [value]="invoiceSourceFilter()" (selectionChange)="invoiceSourceFilter.set($event.value)">
                          <mat-option value="all">All Sources</mat-option>
                          <mat-option value="Promed Technologies">Promed Technologies</mat-option>
                          <mat-option value="Access Medical">Access Medical</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="filter-field">
                        <mat-label>Province</mat-label>
                        <mat-select [value]="invoiceProvinceFilter()" (selectionChange)="invoiceProvinceFilter.set($event.value)">
                          <mat-option value="all">All Provinces</mat-option>
                          @for (province of uniqueProvinces(); track province) {
                            <mat-option [value]="province">{{ province }} ({{ getProvinceInvoiceCount(province) }})</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                      <button mat-raised-button color="accent" (click)="showSuggestedLoads()" 
                        [disabled]="pendingInvoiceCount() === 0">
                        <mat-icon>lightbulb</mat-icon> Suggested Loads
                      </button>
                      <button mat-raised-button color="primary" (click)="createTripsheetFromInvoices()" 
                        [disabled]="pendingInvoiceCount() === 0">
                        <mat-icon>add</mat-icon> Create Tripsheet
                      </button>
                      <button mat-icon-button (click)="loadImportedInvoices()" matTooltip="Refresh">
                        <mat-icon>refresh</mat-icon>
                      </button>
                    </div>
                  </div>

                  <div class="invoice-summary-cards">
                    <div class="summary-card">
                      <span class="value">{{ importedInvoices().length }}</span>
                      <span class="label">Total Invoices</span>
                    </div>
                    <div class="summary-card pending">
                      <span class="value">{{ pendingInvoiceCount() }}</span>
                      <span class="label">Pending</span>
                    </div>
                    <div class="summary-card assigned">
                      <span class="value">{{ assignedInvoiceCount() }}</span>
                      <span class="label">Assigned</span>
                    </div>
                    <div class="summary-card delivered">
                      <span class="value">{{ deliveredInvoiceCount() }}</span>
                      <span class="label">Delivered</span>
                    </div>
                  </div>

                  @if (filteredInvoices().length === 0) {
                    <div class="empty-state">
                      <mat-icon>receipt_long</mat-icon>
                      <h3>No Invoices Found</h3>
                      <p>Import invoices from ERP system to manage deliveries</p>
                    </div>
                  } @else {
                    <div class="table-container">
                      <table mat-table [dataSource]="filteredInvoices()" class="invoices-table">
                        <ng-container matColumnDef="transactionNumber">
                          <th mat-header-cell *matHeaderCellDef>Invoice #</th>
                          <td mat-cell *matCellDef="let inv">
                            <strong>{{ inv.transactionNumber }}</strong>
                          </td>
                        </ng-container>

                        <ng-container matColumnDef="date">
                          <th mat-header-cell *matHeaderCellDef>Date</th>
                          <td mat-cell *matCellDef="let inv">{{ inv.transactionDate | date:'dd/MM/yyyy' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="customer">
                          <th mat-header-cell *matHeaderCellDef>Customer</th>
                          <td mat-cell *matCellDef="let inv">
                            <div class="customer-cell">
                              <span class="customer-name">{{ inv.customerName }}</span>
                              <span class="customer-code">{{ inv.customerNumber }}</span>
                            </div>
                          </td>
                        </ng-container>

                        <ng-container matColumnDef="product">
                          <th mat-header-cell *matHeaderCellDef>Product</th>
                          <td mat-cell *matCellDef="let inv">
                            <div class="product-cell">
                              <span class="product-desc">{{ inv.productDescription }}</span>
                              <span class="product-code">{{ inv.productCode }}</span>
                            </div>
                          </td>
                        </ng-container>

                        <ng-container matColumnDef="quantity">
                          <th mat-header-cell *matHeaderCellDef>Qty</th>
                          <td mat-cell *matCellDef="let inv">{{ inv.quantity | number:'1.0-0' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="salesAmount">
                          <th mat-header-cell *matHeaderCellDef>Sales</th>
                          <td mat-cell *matCellDef="let inv">R{{ inv.salesAmount | number:'1.2-2' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="costOfSales">
                          <th mat-header-cell *matHeaderCellDef>Cost</th>
                          <td mat-cell *matCellDef="let inv">R{{ inv.costOfSales | number:'1.2-2' }}</td>
                        </ng-container>

                        <ng-container matColumnDef="status">
                          <th mat-header-cell *matHeaderCellDef>Status</th>
                          <td mat-cell *matCellDef="let inv">
                            <span class="status-chip" [ngClass]="getInvoiceStatusClass(inv.status)">
                              {{ inv.status }}
                            </span>
                          </td>
                        </ng-container>

                        <ng-container matColumnDef="actions">
                          <th mat-header-cell *matHeaderCellDef>Actions</th>
                          <td mat-cell *matCellDef="let inv">
                            <button mat-icon-button [matMenuTriggerFor]="invoiceMenu" matTooltip="Actions">
                              <mat-icon>more_vert</mat-icon>
                            </button>
                            <mat-menu #invoiceMenu="matMenu">
                              <button mat-menu-item (click)="viewInvoiceDetails(inv)">
                                <mat-icon>visibility</mat-icon>
                                <span>View Details</span>
                              </button>
                              @if (inv.status === 'Pending') {
                                <button mat-menu-item>
                                  <mat-icon>local_shipping</mat-icon>
                                  <span>Add to Load</span>
                                </button>
                              }
                            </mat-menu>
                          </td>
                        </ng-container>

                        <tr mat-header-row *matHeaderRowDef="invoiceColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: invoiceColumns;"></tr>
                      </table>
                    </div>
                  }
                </div>
              </div>
            </mat-tab>

            <!-- Tripsheets Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>description</mat-icon>
                Tripsheets
              </ng-template>
              <div class="tab-content">
                <div class="tripsheets-section">
                  <div class="tripsheets-header">
                    <h3><mat-icon>description</mat-icon> Trip Sheets</h3>
                    <div class="tripsheets-actions">
                      <button mat-raised-button color="primary" (click)="openCreateTripsheetDialog()">
                        <mat-icon>add</mat-icon>
                        Create Trip Sheet
                      </button>
                      <mat-form-field appearance="outline" class="search-field">
                        <mat-label>Search Tripsheets</mat-label>
                        <input matInput [(ngModel)]="tripsheetSearch" placeholder="Load #, driver, date...">
                        <mat-icon matSuffix>search</mat-icon>
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="filter-field">
                        <mat-label>Status</mat-label>
                        <mat-select [(ngModel)]="tripsheetStatusFilter">
                          <mat-option value="all">All</mat-option>
                          <mat-option value="pending">Pending</mat-option>
                          <mat-option value="in-progress">In Progress</mat-option>
                          <mat-option value="completed">Completed</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>
                  </div>

                  @if (filteredTripsheets().length === 0) {
                    <div class="empty-state">
                      <mat-icon>description</mat-icon>
                      <h3>No Tripsheets Found</h3>
                      <p>Tripsheets are generated when loads are dispatched</p>
                    </div>
                  } @else {
                    <table mat-table [dataSource]="filteredTripsheets()" class="tripsheets-table">
                      <ng-container matColumnDef="tripNumber">
                        <th mat-header-cell *matHeaderCellDef>Trip #</th>
                        <td mat-cell *matCellDef="let trip">
                          <strong>{{ trip.tripNumber }}</strong>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="loadNumber">
                        <th mat-header-cell *matHeaderCellDef>Load #</th>
                        <td mat-cell *matCellDef="let trip">{{ trip.loadNumber }}</td>
                      </ng-container>

                      <ng-container matColumnDef="driver">
                        <th mat-header-cell *matHeaderCellDef>Driver</th>
                        <td mat-cell *matCellDef="let trip">{{ trip.driverName }}</td>
                      </ng-container>

                      <ng-container matColumnDef="vehicle">
                        <th mat-header-cell *matHeaderCellDef>Vehicle</th>
                        <td mat-cell *matCellDef="let trip">{{ trip.vehicleReg }}</td>
                      </ng-container>

                      <ng-container matColumnDef="route">
                        <th mat-header-cell *matHeaderCellDef>Route</th>
                        <td mat-cell *matCellDef="let trip">
                          <div class="route-cell">
                            <span>{{ trip.origin }}</span>
                            <mat-icon>arrow_forward</mat-icon>
                            <span>{{ trip.destination }}</span>
                          </div>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="stops">
                        <th mat-header-cell *matHeaderCellDef>Stops</th>
                        <td mat-cell *matCellDef="let trip">{{ trip.totalStops }}</td>
                      </ng-container>

                      <ng-container matColumnDef="distance">
                        <th mat-header-cell *matHeaderCellDef>Distance</th>
                        <td mat-cell *matCellDef="let trip">{{ trip.totalDistance }} km</td>
                      </ng-container>

                      <ng-container matColumnDef="estTime">
                        <th mat-header-cell *matHeaderCellDef>Est. Time</th>
                        <td mat-cell *matCellDef="let trip">{{ trip.estimatedTime }}</td>
                      </ng-container>

                      <ng-container matColumnDef="date">
                        <th mat-header-cell *matHeaderCellDef>Date</th>
                        <td mat-cell *matCellDef="let trip">{{ trip.date | date:'dd MMM yyyy' }}</td>
                      </ng-container>

                      <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef>Status</th>
                        <td mat-cell *matCellDef="let trip">
                          <mat-chip [ngClass]="getTripStatusClass(trip.status)">
                            {{ trip.status }}
                          </mat-chip>
                        </td>
                      </ng-container>

                      <ng-container matColumnDef="actions">
                        <th mat-header-cell *matHeaderCellDef></th>
                        <td mat-cell *matCellDef="let trip">
                          <button mat-icon-button [matMenuTriggerFor]="tripMenu" matTooltip="Actions">
                            <mat-icon>more_vert</mat-icon>
                          </button>
                          <mat-menu #tripMenu="matMenu">
                            <button mat-menu-item (click)="viewTripsheet(trip)">
                              <mat-icon>visibility</mat-icon>
                              <span>View Details</span>
                            </button>
                            <button mat-menu-item (click)="printTripsheet(trip)">
                              <mat-icon>print</mat-icon>
                              <span>Print</span>
                            </button>
                            <button mat-menu-item (click)="downloadTripsheet(trip)">
                              <mat-icon>download</mat-icon>
                              <span>Download PDF</span>
                            </button>
                          </mat-menu>
                        </td>
                      </ng-container>

                      <tr mat-header-row *matHeaderRowDef="tripsheetColumns"></tr>
                      <tr mat-row *matRowDef="let row; columns: tripsheetColumns;"></tr>
                    </table>
                  }
                </div>
              </div>
            </mat-tab>

            <!-- Fuel Management Tab (TFN) -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>local_gas_station</mat-icon>
                Fuel Management
              </ng-template>
              <div class="tab-content">
                <div class="fuel-section">
                  <div class="fuel-header">
                    <h3><mat-icon>local_gas_station</mat-icon> TruckFuelNet Integration</h3>
                    <button mat-raised-button color="primary" (click)="syncFuelData()" [disabled]="syncingFuel()">
                      <mat-icon>{{ syncingFuel() ? 'sync' : 'cloud_sync' }}</mat-icon>
                      {{ syncingFuel() ? 'Syncing...' : 'Sync Fuel Data' }}
                    </button>
                  </div>

                  @if (fuelSummary()) {
                    <!-- Fuel Stats Cards -->
                    <div class="fuel-stats-grid">
                      <mat-card class="fuel-stat-card">
                        <mat-card-content>
                          <div class="fuel-stat-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
                            <mat-icon>attach_money</mat-icon>
                          </div>
                          <div class="fuel-stat-info">
                            <span class="fuel-stat-label">This Month Spend</span>
                            <span class="fuel-stat-value">R {{ fuelSummary().thisMonth?.totalCost?.toFixed(2) || '0.00' }}</span>
                            <span class="fuel-stat-change" 
                              [class.positive]="fuelSummary().thisMonth?.totalCost < fuelSummary().lastMonth?.totalCost"
                              [class.negative]="fuelSummary().thisMonth?.totalCost > fuelSummary().lastMonth?.totalCost">
                              {{ calculateFuelChange() }}% vs last month
                            </span>
                          </div>
                        </mat-card-content>
                      </mat-card>

                      <mat-card class="fuel-stat-card">
                        <mat-card-content>
                          <div class="fuel-stat-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
                            <mat-icon>speed</mat-icon>
                          </div>
                          <div class="fuel-stat-info">
                            <span class="fuel-stat-label">Avg Efficiency</span>
                            <span class="fuel-stat-value">{{ fuelSummary().thisMonth?.averageEfficiency?.toFixed(1) || '0.0' }} km/l</span>
                            <span class="fuel-stat-sub">{{ fuelSummary().thisMonth?.totalLitres?.toFixed(0) || '0' }} litres used</span>
                          </div>
                        </mat-card-content>
                      </mat-card>

                      <mat-card class="fuel-stat-card">
                        <mat-card-content>
                          <div class="fuel-stat-icon" style="background: linear-gradient(135deg, #fa709a, #fee140);">
                            <mat-icon>warning</mat-icon>
                          </div>
                          <div class="fuel-stat-info">
                            <span class="fuel-stat-label">Recent Anomalies</span>
                            <span class="fuel-stat-value">{{ fuelSummary().recentAnomalies?.length || 0 }}</span>
                            <span class="fuel-stat-sub">Last 7 days</span>
                          </div>
                        </mat-card-content>
                      </mat-card>

                      <mat-card class="fuel-stat-card">
                        <mat-card-content>
                          <div class="fuel-stat-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
                            <mat-icon>account_balance_wallet</mat-icon>
                          </div>
                          <div class="fuel-stat-info">
                            <span class="fuel-stat-label">Low Balance Alerts</span>
                            <span class="fuel-stat-value">{{ fuelSummary().lowBalanceVehicles?.length || 0 }}</span>
                            <span class="fuel-stat-sub">Vehicles < 20% credit</span>
                          </div>
                        </mat-card-content>
                      </mat-card>
                    </div>

                    <!-- Top Fuel Consumers -->
                    @if (fuelSummary().topConsumers?.length > 0) {
                      <mat-card class="fuel-card">
                        <mat-card-header>
                          <mat-card-title>
                            <mat-icon>trending_up</mat-icon>
                            Top Fuel Consumers (This Month)
                          </mat-card-title>
                        </mat-card-header>
                        <mat-card-content>
                          <div class="consumers-list">
                            @for (consumer of fuelSummary().topConsumers; track consumer.vehicle) {
                              <div class="consumer-item">
                                <div class="consumer-info">
                                  <mat-icon>local_shipping</mat-icon>
                                  <div>
                                    <strong>{{ consumer.vehicle }}</strong>
                                    <span class="consumer-meta">{{ consumer.transactionCount }} transactions</span>
                                  </div>
                                </div>
                                <div class="consumer-stats">
                                  <span class="litres">{{ consumer.totalLitres?.toFixed(0) }} L</span>
                                  <span class="cost">R {{ consumer.totalCost?.toFixed(2) }}</span>
                                </div>
                              </div>
                            }
                          </div>
                        </mat-card-content>
                      </mat-card>
                    }

                    <!-- Low Balance Warnings -->
                    @if (fuelSummary().lowBalanceVehicles?.length > 0) {
                      <mat-card class="fuel-card warning-card">
                        <mat-card-header>
                          <mat-card-title>
                            <mat-icon>warning</mat-icon>
                            Low Balance Warnings
                          </mat-card-title>
                        </mat-card-header>
                        <mat-card-content>
                          <div class="warnings-list">
                            @for (vehicle of fuelSummary().lowBalanceVehicles; track vehicle.vehicle) {
                              <div class="warning-item">
                                <div class="warning-info">
                                  <mat-icon>local_shipping</mat-icon>
                                  <strong>{{ vehicle.vehicle }}</strong>
                                </div>
                                <div class="warning-balance">
                                  <span class="balance-label">Available Credit:</span>
                                  <span class="balance-value" [class.critical]="vehicle.percentageRemaining < 10">
                                    R {{ vehicle.availableCredit?.toFixed(2) }} ({{ vehicle.percentageRemaining?.toFixed(0) }}%)
                                  </span>
                                  <mat-progress-bar mode="determinate" 
                                    [value]="vehicle.percentageRemaining"
                                    [color]="vehicle.percentageRemaining < 10 ? 'warn' : 'accent'">
                                  </mat-progress-bar>
                                </div>
                              </div>
                            }
                          </div>
                        </mat-card-content>
                      </mat-card>
                    }

                    <!-- Recent Anomalies -->
                    @if (fuelSummary().recentAnomalies?.length > 0) {
                      <mat-card class="fuel-card anomaly-card">
                        <mat-card-header>
                          <mat-card-title>
                            <mat-icon>report_problem</mat-icon>
                            Recent Fuel Anomalies
                          </mat-card-title>
                        </mat-card-header>
                        <mat-card-content>
                          <div class="anomalies-list">
                            @for (anomaly of fuelSummary().recentAnomalies; track $index) {
                              <div class="anomaly-item">
                                <div class="anomaly-header">
                                  <div class="anomaly-vehicle">
                                    <mat-icon>local_shipping</mat-icon>
                                    <strong>{{ anomaly.vehicle }}</strong>
                                    <span class="anomaly-driver">{{ anomaly.driver }}</span>
                                  </div>
                                  <span class="anomaly-date">{{ formatDate(anomaly.transactionDate) }}</span>
                                </div>
                                <div class="anomaly-details">
                                  <mat-chip class="anomaly-chip">{{ anomaly.anomalyReason }}</mat-chip>
                                  <span class="anomaly-amount">{{ anomaly.litres?.toFixed(1) }}L • R{{ anomaly.totalAmount?.toFixed(2) }}</span>
                                </div>
                              </div>
                            }
                          </div>
                        </mat-card-content>
                      </mat-card>
                    }
                  } @else {
                    <div class="empty-state">
                      <mat-icon>local_gas_station</mat-icon>
                      <h3>No Fuel Data Available</h3>
                      <p>Click "Sync Fuel Data" to import data from TruckFuelNet</p>
                      <button mat-raised-button color="primary" (click)="syncFuelData()">
                        <mat-icon>cloud_sync</mat-icon> Sync Now
                      </button>
                    </div>
                  }
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
    .stat-icon.tfn-orders { background: linear-gradient(135deg, #f093fb, #f5576c); }
    .stat-icon.vehicles { background: linear-gradient(135deg, #667eea, #764ba2); }
    .stat-icon.drivers { background: linear-gradient(135deg, #f093fb, #f5576c); }
    .stat-icon.maintenance { background: linear-gradient(135deg, #ff9800, #f57c00); }
    .stat-icon.stock { background: linear-gradient(135deg, #fa709a, #fee140); }
    .stat-icon.depots { background: linear-gradient(135deg, #11998e, #38ef7d); }

    .stat-card.clickable {
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .stat-card.clickable:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0,0,0,0.15);
    }

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

    /* Maintenance Tab Styles */
    .maintenance-header {
      margin-bottom: 24px;
    }

    .maintenance-stats-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .maintenance-stat-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      min-width: 160px;
      flex: 1;
    }

    .maintenance-stat-card mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .maintenance-stat-card.critical { background: linear-gradient(135deg, #ffebee, #ffcdd2); }
    .maintenance-stat-card.critical mat-icon { color: #c62828; }
    .maintenance-stat-card.in-progress { background: linear-gradient(135deg, #fff3e0, #ffe0b2); }
    .maintenance-stat-card.in-progress mat-icon { color: #ef6c00; }
    .maintenance-stat-card.scheduled { background: linear-gradient(135deg, #e3f2fd, #bbdefb); }
    .maintenance-stat-card.scheduled mat-icon { color: #1565c0; }
    .maintenance-stat-card.license { background: linear-gradient(135deg, #f3e5f5, #e1bee7); }
    .maintenance-stat-card.license mat-icon { color: #7b1fa2; }

    .maintenance-stat-card .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      display: block;
    }

    .maintenance-stat-card .stat-label {
      font-size: 0.75rem;
      color: #666;
    }

    .maintenance-actions {
      display: flex;
      gap: 12px;
    }

    .license-alerts {
      background: #fff3e0;
      border-left: 4px solid #ff9800;
      padding: 16px;
      margin-bottom: 24px;
      border-radius: 8px;
    }

    .license-alerts h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      color: #e65100;
    }

    .license-cards {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .license-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      min-width: 250px;
      background: white;
    }

    .license-card.critical {
      border-left: 4px solid #c62828;
    }

    .license-card.warning {
      border-left: 4px solid #ff9800;
    }

    .license-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .license-info mat-icon {
      color: #666;
    }

    .license-info .vehicle-reg {
      font-weight: 600;
      display: block;
    }

    .license-info .expiry-text {
      font-size: 0.8rem;
      color: #666;
    }

    .license-card.critical .expiry-text {
      color: #c62828;
      font-weight: 600;
    }

    .maintenance-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 24px;
      padding: 8px;
    }

    .maintenance-card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .maintenance-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }

    .maintenance-card.status-overdue {
      border-left: 4px solid #c62828;
    }

    .maintenance-card.status-in-progress {
      border-left: 4px solid #ff9800;
    }

    .maintenance-card.status-scheduled {
      border-left: 4px solid #1976d2;
    }

    .maintenance-card.status-completed {
      border-left: 4px solid #4caf50;
    }

    .maintenance-card mat-card-header {
      margin-bottom: 16px;
    }

    .maintenance-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }

    .maintenance-icon mat-icon {
      color: white;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .maintenance-icon.type-scheduled { background: linear-gradient(135deg, #1976d2, #1565c0); }
    .maintenance-icon.type-repair { background: linear-gradient(135deg, #ff9800, #f57c00); }
    .maintenance-icon.type-license { background: linear-gradient(135deg, #9c27b0, #7b1fa2); }
    .maintenance-icon.type-inspection { background: linear-gradient(135deg, #00bcd4, #0097a7); }
    .maintenance-icon.type-other { background: linear-gradient(135deg, #607d8b, #455a64); }

    .maintenance-type-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 12px;
    }

    .maintenance-type-badge.scheduled { background: #e3f2fd; color: #1565c0; }
    .maintenance-type-badge.repair { background: #fff3e0; color: #e65100; }
    .maintenance-type-badge.license { background: #f3e5f5; color: #7b1fa2; }
    .maintenance-type-badge.inspection { background: #e0f7fa; color: #00838f; }
    .maintenance-type-badge.other { background: #eceff1; color: #455a64; }

    .maintenance-description {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 16px;
      line-height: 1.4;
    }

    .maintenance-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .maintenance-details .detail-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.875rem;
      color: #555;
    }

    .maintenance-details .detail-row mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #888;
    }

    .status-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .status-badge.scheduled { background: #e3f2fd; color: #1565c0; }
    .status-badge.in-progress { background: #fff3e0; color: #e65100; }
    .status-badge.completed { background: #e8f5e9; color: #2e7d32; }
    .status-badge.overdue { background: #ffebee; color: #c62828; }

    .priority-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .priority-badge.low { background: #e8f5e9; color: #2e7d32; }
    .priority-badge.medium { background: #fff3e0; color: #e65100; }
    .priority-badge.high { background: #fbe9e7; color: #d84315; }
    .priority-badge.critical { background: #ffebee; color: #c62828; }

    .maintenance-card mat-card-actions {
      padding: 12px 16px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .delete-action {
      color: #c62828 !important;
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
      position: relative;
    }

    .vehicle-card.status-available { border-left-color: #4caf50; }
    .vehicle-card.status-onduty, .vehicle-card.status-on-duty { border-left-color: #2196f3; }
    .vehicle-card.status-maintenance { border-left-color: #ff9800; }

    /* Integration badges container */
    .integration-badges {
      display: flex;
      gap: 6px;
      margin-left: auto;
      margin-right: 8px;
    }

    /* Vehicle menu button */
    .vehicle-menu-btn {
      position: absolute;
      right: 8px;
      top: 8px;
      color: #666;
      transition: all 0.2s ease;
    }

    .vehicle-menu-btn:hover {
      color: #1976d2;
      background: rgba(25, 118, 210, 0.1);
    }

    .vehicle-card mat-card-header {
      position: relative;
      padding-right: 40px;
    }

    .delete-action {
      color: #f44336 !important;
    }

    .delete-action mat-icon {
      color: #f44336 !important;
    }

    .badge {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .cartrack-badge {
      background: linear-gradient(135deg, #2196f3, #1565c0);
      color: white;
    }

    .tfn-badge {
      background: linear-gradient(135deg, #4caf50, #2e7d32);
      color: white;
    }

    .fleet-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .fleet-stats {
      display: flex;
      gap: 16px;
    }

    .stat-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 500;
    }

    .stat-badge mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .stat-badge.linked {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.15), rgba(46, 125, 50, 0.15));
      color: #2e7d32;
    }

    .stat-badge.unlinked {
      background: linear-gradient(135deg, rgba(158, 158, 158, 0.15), rgba(97, 97, 97, 0.15));
      color: #616161;
    }

    .fleet-actions {
      display: flex;
      gap: 8px;
    }

    .fleet-actions button mat-spinner {
      margin-right: 8px;
    }

    .fuel-type-badge {
      background: #e3f2fd;
      color: #1565c0;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      margin-left: 8px;
    }

    .tfn-balance {
      background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(46, 125, 50, 0.1));
      padding: 6px 10px;
      border-radius: 8px;
      margin-top: 4px;
    }

    .tfn-balance mat-icon {
      color: #4caf50;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
    }

    .tfn-indicator {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: linear-gradient(135deg, #4caf50, #2e7d32);
      border-radius: 50%;
      color: white;
    }

    .tfn-indicator mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

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

    .speed-row {
      background: linear-gradient(135deg, rgba(33, 150, 243, 0.08), rgba(21, 101, 192, 0.08));
      padding: 8px 12px;
      border-radius: 8px;
      margin: 4px 0;
    }

    .speed-value {
      font-weight: 600;
      font-size: 14px;
      color: #1565c0;
    }

    .moving-badge {
      background: linear-gradient(135deg, #4caf50, #2e7d32);
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      animation: pulse 2s infinite;
      margin-left: auto;
    }

    .stationary-badge {
      background: linear-gradient(135deg, #9e9e9e, #616161);
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      margin-left: auto;
    }

    .idling-badge {
      background: linear-gradient(135deg, #ff9800, #f57c00);
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      margin-left: auto;
      animation: pulse-orange 2s infinite;
    }

    .offline-badge {
      background: linear-gradient(135deg, #f44336, #c62828);
      color: white;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      margin-left: auto;
    }

    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(76, 175, 80, 0); }
      100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
    }

    @keyframes pulse-orange {
      0% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.4); }
      70% { box-shadow: 0 0 0 8px rgba(255, 152, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0); }
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

    .tracking-section {
      padding: 16px;
    }

    .tracking-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .tracking-header h3 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 0 0 8px 0;
      font-size: 20px;
      color: #333;
    }

    .tracking-header p {
      margin: 0;
      color: #666;
    }

    .tracking-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .vehicle-list-compact h4 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 16px;
    }

    .vehicle-status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 12px;
    }

    .vehicle-status-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f5f5f5;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 4px solid #9e9e9e;
    }

    .vehicle-status-item:hover {
      background: #e3f2fd;
      transform: translateX(4px);
    }

    .vehicle-status-item.moving {
      border-left-color: #4caf50;
      background: #e8f5e9;
    }

    .vehicle-status-item.offline {
      border-left-color: #f44336;
      background: #ffebee;
    }

    .vehicle-status-item mat-icon:first-child {
      color: #1976d2;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .vehicle-status-item.moving mat-icon:first-child {
      color: #4caf50;
    }

    .vehicle-status-item.offline mat-icon:first-child {
      color: #f44336;
    }

    .vehicle-quick-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .vehicle-quick-info strong {
      font-size: 14px;
      color: #333;
    }

    .speed-label {
      font-size: 12px;
      color: #666;
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

    /* Imported Invoices Tab Styles */
    .invoices-section {
      padding: 16px 0;
    }

    .invoices-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
    }

    .invoices-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: #333;
    }

    .invoices-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .invoice-summary-cards {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .summary-card {
      background: #f5f5f5;
      padding: 16px 24px;
      border-radius: 8px;
      text-align: center;
      min-width: 120px;
    }

    .summary-card .value {
      display: block;
      font-size: 28px;
      font-weight: 600;
      color: #333;
    }

    .summary-card .label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }

    .summary-card.pending {
      background: #fff3e0;
    }

    .summary-card.pending .value {
      color: #f57c00;
    }

    .summary-card.assigned {
      background: #e3f2fd;
    }

    .summary-card.assigned .value {
      color: #1976d2;
    }

    .summary-card.delivered {
      background: #e8f5e9;
    }

    .summary-card.delivered .value {
      color: #388e3c;
    }

    .table-container {
      overflow-x: auto;
    }

    .invoices-table {
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .invoices-table th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }

    .invoices-table td, .invoices-table th {
      padding: 12px 16px;
    }

    .invoices-table tr:hover {
      background: #fafafa;
    }

    .customer-cell, .product-cell {
      display: flex;
      flex-direction: column;
    }

    .customer-name, .product-desc {
      font-weight: 500;
      color: #333;
    }

    .customer-code, .product-code {
      font-size: 11px;
      color: #999;
    }

    .positive-margin {
      color: #388e3c;
      font-weight: 500;
    }

    .negative-margin {
      color: #d32f2f;
      font-weight: 500;
    }

    .status-chip {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-chip.status-pending {
      background: #fff3e0;
      color: #f57c00;
    }

    .status-chip.status-in-transit {
      background: #e3f2fd;
      color: #1976d2;
    }

    .status-chip.status-delivered {
      background: #e8f5e9;
      color: #388e3c;
    }

    .status-chip.status-cancelled {
      background: #ffebee;
      color: #d32f2f;
    }

    /* Tripsheets Tab Styles */
    .tripsheets-section {
      padding: 16px 0;
    }

    .tripsheets-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 20px;
    }

    .tripsheets-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      color: #333;
    }

    .tripsheets-actions {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .search-field {
      width: 280px;
    }

    .filter-field {
      width: 150px;
    }

    .tripsheets-table {
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .tripsheets-table th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }

    .tripsheets-table td, .tripsheets-table th {
      padding: 12px 16px;
    }

    .tripsheets-table tr:hover {
      background: #fafafa;
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

      .tripsheets-actions {
        flex-wrap: wrap;
        width: 100%;
      }

      .search-field, .filter-field {
        width: 100%;
      }
    }

    /* Fuel Management Styles */
    .fuel-section {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .fuel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .fuel-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 20px;
      color: #333;
    }

    .fuel-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
    }

    .fuel-stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px !important;
    }

    .fuel-stat-icon {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .fuel-stat-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .fuel-stat-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .fuel-stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .fuel-stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #333;
    }

    .fuel-stat-sub, .fuel-stat-change {
      font-size: 12px;
      color: #999;
    }

    .fuel-stat-change.positive {
      color: #4caf50;
    }

    .fuel-stat-change.negative {
      color: #f44336;
    }

    .fuel-card {
      margin-top: 16px;
    }

    .fuel-card mat-card-header {
      margin-bottom: 16px;
    }

    .fuel-card mat-card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 18px;
    }

    .consumers-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .consumer-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .consumer-item:hover {
      background: #e0e0e0;
    }

    .consumer-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .consumer-info mat-icon {
      color: #1976d2;
    }

    .consumer-info div {
      display: flex;
      flex-direction: column;
    }

    .consumer-meta {
      font-size: 12px;
      color: #666;
    }

    .consumer-stats {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .consumer-stats .litres {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }

    .consumer-stats .cost {
      font-size: 18px;
      font-weight: 700;
      color: #333;
    }

    .warning-card {
      border-left: 4px solid #ff9800;
    }

    .warnings-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .warning-item {
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
    }

    .warning-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .warning-info mat-icon {
      color: #ff9800;
    }

    .warning-balance {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .balance-label {
      font-size: 12px;
      color: #666;
    }

    .balance-value {
      font-size: 16px;
      font-weight: 600;
      color: #ff9800;
    }

    .balance-value.critical {
      color: #f44336;
    }

    .anomaly-card {
      border-left: 4px solid #f44336;
    }

    .anomalies-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .anomaly-item {
      padding: 12px;
      background: #ffebee;
      border-radius: 8px;
    }

    .anomaly-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .anomaly-vehicle {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .anomaly-vehicle mat-icon {
      color: #f44336;
    }

    .anomaly-driver {
      font-size: 12px;
      color: #666;
      margin-left: 8px;
    }

    .anomaly-date {
      font-size: 12px;
      color: #999;
    }

    .anomaly-details {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .anomaly-chip {
      background: #f44336 !important;
      color: white !important;
      font-size: 11px;
    }

    .anomaly-amount {
      font-size: 14px;
      color: #666;
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
    vehiclesInMaintenance: 0,
    upcomingMaintenance: 0,
    pendingInvoices: 0,
    overdueInvoices: 0
  });

  activeLoads = signal<ActiveLoad[]>([]);
  vehicles = signal<Vehicle[]>([]);
  maintenanceRecords = signal<MaintenanceRecord[]>([]);
  drivers = signal<any[]>([]);
  customers = signal<any[]>([]);
  warehouses = signal<any[]>([]);
  syncing = signal(false);
  tfnSyncing = signal(false);
  carTrackSyncing = signal(false);

  // Tripsheets
  tripsheets = signal<any[]>([]);
  tripsheetSearch = '';
  tripsheetStatusFilter = 'all';
  tripsheetColumns = ['tripNumber', 'loadNumber', 'driver', 'vehicle', 'route', 'stops', 'distance', 'estTime', 'date', 'status', 'actions'];

  // Imported Invoices
  importedInvoices = signal<ImportedInvoice[]>([]);
  invoiceSearch = signal('');
  invoiceStatusFilter = signal('all');
  invoiceSourceFilter = signal('all');
  invoiceProvinceFilter = signal('all');
  invoiceColumns = ['transactionNumber', 'date', 'customer', 'product', 'quantity', 'salesAmount', 'costOfSales', 'status', 'actions'];

  loadColumns = ['loadNumber', 'customer', 'route', 'vehicle', 'driver', 'status', 'progress', 'actions'];

  // Fuel Management (TFN)
  fuelSummary = signal<any>(null);
  syncingFuel = signal(false);
  tfnOrdersCount = signal(0);
  tfnOrders = signal<any[]>([]);
  tfnDepotsCount = signal(0);
  tfnDepots = signal<any[]>([]);

  constructor(
    private http: HttpClient,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadTripsheets();
    this.loadImportedInvoices();
    this.loadFuelSummary();
    this.loadTfnOrders();
    this.loadTfnDepots();
    this.loadDrivers();
    this.loadCustomers();
    this.loadMaintenanceRecords();
    this.loadWarehouses();
  }

  loadWarehouses(): void {
    this.http.get<any[]>(`${this.apiUrl}/warehouses`).subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
      },
      error: () => {
        // Use fallback data
        this.warehouses.set([
          { id: 1, name: 'Durban Warehouse', code: 'DBN', latitude: -29.8587, longitude: 31.0218, address: 'Durban, KwaZulu-Natal' },
          { id: 2, name: 'Johannesburg Warehouse', code: 'JHB', latitude: -26.2041, longitude: 28.0473, address: 'Johannesburg, Gauteng' },
          { id: 3, name: 'Cape Town Warehouse', code: 'CPT', latitude: -33.9249, longitude: 18.4241, address: 'Cape Town, Western Cape' }
        ]);
      }
    });
  }

  loadDrivers(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/drivers`).subscribe({
      next: (drivers) => {
        this.drivers.set(drivers);
        this.stats.update(s => ({
          ...s,
          totalDrivers: drivers.length,
          availableDrivers: drivers.filter(d => d.status === 'Available' || !d.currentLoadId).length
        }));
      },
      error: () => {
        // Use sample data
        this.drivers.set([
          { id: 1, firstName: 'John', lastName: 'Smith', phoneNumber: '082-123-4567', licenseNumber: 'DL12345', status: 'Available' },
          { id: 2, firstName: 'Peter', lastName: 'Nkosi', phoneNumber: '083-456-7890', licenseNumber: 'DL23456', status: 'OnDuty' },
          { id: 3, firstName: 'Mike', lastName: 'Johnson', phoneNumber: '084-789-0123', licenseNumber: 'DL34567', status: 'Available' }
        ]);
      }
    });
  }

  loadCustomers(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/customers`).subscribe({
      next: (customers) => {
        this.customers.set(customers);
      },
      error: () => {
        this.customers.set([]);
      }
    });
  }

  // Maintenance Methods
  loadMaintenanceRecords(): void {
    this.http.get<MaintenanceRecord[]>(`${this.apiUrl}/logistics/maintenance`).subscribe({
      next: (records) => {
        this.maintenanceRecords.set(records);
        this.updateMaintenanceStats();
      },
      error: () => {
        // Load sample maintenance data
        this.loadSampleMaintenanceData();
      }
    });
  }

  private loadSampleMaintenanceData(): void {
    const sampleRecords: MaintenanceRecord[] = [
      {
        id: 1,
        vehicleId: 1,
        vehicleReg: 'GP 123 ABC',
        vehicleType: 'Truck - 8 Ton',
        maintenanceType: 'scheduled',
        description: 'Regular 50,000km service - oil change, filters, brake inspection',
        status: 'scheduled',
        priority: 'medium',
        scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        estimatedCost: 4500,
        assignedTo: 'Fleet Services'
      },
      {
        id: 2,
        vehicleId: 2,
        vehicleReg: 'GP 456 DEF',
        vehicleType: 'Truck - 14 Ton',
        maintenanceType: 'repair',
        description: 'Gearbox repair - difficulty shifting gears reported by driver',
        status: 'in-progress',
        priority: 'high',
        scheduledDate: new Date(),
        estimatedCost: 12000,
        assignedTo: 'Heavy Duty Repairs'
      },
      {
        id: 3,
        vehicleId: 3,
        vehicleReg: 'GP 789 GHI',
        vehicleType: 'Bakkie',
        maintenanceType: 'license',
        description: 'Vehicle license renewal',
        status: 'overdue',
        priority: 'critical',
        scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        licenseExpiryDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: -5
      },
      {
        id: 4,
        vehicleId: 4,
        vehicleReg: 'GP 321 JKL',
        vehicleType: 'Truck - 8 Ton',
        maintenanceType: 'inspection',
        description: 'Annual roadworthy certificate inspection',
        status: 'scheduled',
        priority: 'high',
        scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        estimatedCost: 1200,
        assignedTo: 'Testing Station'
      },
      {
        id: 5,
        vehicleId: 5,
        vehicleReg: 'GP 654 MNO',
        vehicleType: 'Truck - 14 Ton',
        maintenanceType: 'license',
        description: 'Vehicle license expiring soon',
        status: 'scheduled',
        priority: 'medium',
        scheduledDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        licenseExpiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        daysUntilExpiry: 14
      }
    ];
    this.maintenanceRecords.set(sampleRecords);
    this.updateMaintenanceStats();
  }

  private updateMaintenanceStats(): void {
    const records = this.maintenanceRecords();
    this.stats.update(s => ({
      ...s,
      vehiclesInMaintenance: records.filter(r => r.status === 'in-progress' || r.status === 'scheduled').length,
      upcomingMaintenance: records.filter(r => r.status === 'scheduled').length
    }));
  }

  getMaintenanceByStatus(status: string): MaintenanceRecord[] {
    return this.maintenanceRecords().filter(r => r.status === status);
  }

  getExpiringLicenses(): MaintenanceRecord[] {
    return this.maintenanceRecords()
      .filter(r => r.maintenanceType === 'license' && r.daysUntilExpiry !== undefined && r.daysUntilExpiry <= 30)
      .sort((a, b) => (a.daysUntilExpiry || 0) - (b.daysUntilExpiry || 0));
  }

  openAddMaintenanceDialog(): void {
    const dialogRef = this.dialog.open(AddMaintenanceDialog, {
      width: '600px',
      data: { vehicles: this.vehicles() }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.http.post<MaintenanceRecord>(`${this.apiUrl}/logistics/maintenance`, result).subscribe({
          next: (record) => {
            this.maintenanceRecords.update(records => [...records, record]);
            this.updateMaintenanceStats();
          },
          error: () => {
            // Add to local list with generated ID
            const newRecord: MaintenanceRecord = {
              ...result,
              id: Math.max(0, ...this.maintenanceRecords().map(r => r.id)) + 1
            };
            this.maintenanceRecords.update(records => [...records, newRecord]);
            this.updateMaintenanceStats();
          }
        });
      }
    });
  }

  startMaintenance(record: MaintenanceRecord): void {
    this.http.patch(`${this.apiUrl}/logistics/maintenance/${record.id}/start`, {}).subscribe({
      next: () => {
        this.maintenanceRecords.update(records =>
          records.map(r => r.id === record.id ? { ...r, status: 'in-progress' as const } : r)
        );
        this.updateMaintenanceStats();
      },
      error: () => {
        // Update locally
        this.maintenanceRecords.update(records =>
          records.map(r => r.id === record.id ? { ...r, status: 'in-progress' as const } : r)
        );
        this.updateMaintenanceStats();
      }
    });
  }

  completeMaintenance(record: MaintenanceRecord): void {
    this.http.patch(`${this.apiUrl}/logistics/maintenance/${record.id}/complete`, {}).subscribe({
      next: () => {
        this.maintenanceRecords.update(records =>
          records.map(r => r.id === record.id ? { ...r, status: 'completed' as const, completedDate: new Date() } : r)
        );
        this.updateMaintenanceStats();
      },
      error: () => {
        // Update locally
        this.maintenanceRecords.update(records =>
          records.map(r => r.id === record.id ? { ...r, status: 'completed' as const, completedDate: new Date() } : r)
        );
        this.updateMaintenanceStats();
      }
    });
  }

  editMaintenance(record: MaintenanceRecord): void {
    const dialogRef = this.dialog.open(AddMaintenanceDialog, {
      width: '600px',
      data: { vehicles: this.vehicles(), record }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.http.put<MaintenanceRecord>(`${this.apiUrl}/logistics/maintenance/${record.id}`, result).subscribe({
          next: (updated) => {
            this.maintenanceRecords.update(records =>
              records.map(r => r.id === record.id ? updated : r)
            );
          },
          error: () => {
            this.maintenanceRecords.update(records =>
              records.map(r => r.id === record.id ? { ...r, ...result } : r)
            );
          }
        });
      }
    });
  }

  deleteMaintenance(record: MaintenanceRecord): void {
    if (confirm(`Are you sure you want to delete this maintenance record for ${record.vehicleReg}?`)) {
      this.http.delete(`${this.apiUrl}/logistics/maintenance/${record.id}`).subscribe({
        next: () => {
          this.maintenanceRecords.update(records => records.filter(r => r.id !== record.id));
          this.updateMaintenanceStats();
        },
        error: () => {
          this.maintenanceRecords.update(records => records.filter(r => r.id !== record.id));
          this.updateMaintenanceStats();
        }
      });
    }
  }

  viewMaintenanceHistory(record: MaintenanceRecord): void {
    // Could open a dialog showing maintenance history for this vehicle
    console.log('View history for vehicle:', record.vehicleReg);
  }

  scheduleLicenseRenewal(record: MaintenanceRecord): void {
    // Quick action to schedule license renewal
    const renewalRecord: Partial<MaintenanceRecord> = {
      vehicleId: record.vehicleId,
      vehicleReg: record.vehicleReg,
      vehicleType: record.vehicleType,
      maintenanceType: 'license',
      description: 'License renewal',
      status: 'scheduled',
      priority: record.daysUntilExpiry! <= 7 ? 'critical' : 'high',
      scheduledDate: new Date()
    };
    this.openAddMaintenanceDialog();
  }

  scrollToMaintenanceTab(): void {
    // This would scroll to and select the maintenance tab
    // For now, just load the data
    this.loadMaintenanceRecords();
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

      // Load fleet data with live CarTrack + TFN data merged
      this.loadVehiclesFromDatabase();

      this.loading.set(false);
    } catch (error) {
      this.loadSampleData();
      this.loading.set(false);
    }
  }

  loadVehiclesFromDatabase(): void {
    // Use the live endpoint that merges database + CarTrack + TFN data
    this.http.get<any[]>(`${this.apiUrl}/fleet/vehicles/live`).subscribe({
      next: (fleet) => {
        const mappedVehicles = fleet.map(v => ({
          id: v.id,
          registrationNumber: v.registrationNumber,
          type: v.vehicleTypeName || 'Truck',
          vehicleTypeName: v.vehicleTypeName,
          status: v.status,
          currentDriver: v.currentDriverName || '',
          currentDriverName: v.currentDriverName,
          // Live tracking data from CarTrack
          lastLocation: v.lastLocation || 'Unknown',
          latitude: v.latitude,
          longitude: v.longitude,
          speed: v.speed ?? 0,
          heading: v.heading,
          lastUpdate: v.lastUpdate,
          liveStatus: v.liveStatus || 'offline',
          fuelLevel: 50,
          fuelCapacity: v.fuelCapacity,
          // CarTrack integration
          carTrackId: v.carTrackId,
          isLinkedToCarTrack: v.isLinkedToCarTrack,
          // TFN integration
          tfnVehicleId: v.tfnVehicleId,
          tfnSubAccountNumber: v.tfnSubAccountNumber,
          tfnVirtualCardNumber: v.tfnVirtualCardNumber,
          tfnCreditLimit: v.tfnCreditLimit,
          tfnCurrentBalance: v.tfnCurrentBalance,
          tfnLastSyncedAt: v.tfnLastSyncedAt,
          tankSize: v.tankSize,
          fuelType: v.fuelType,
          averageFuelConsumption: v.averageFuelConsumption,
          isLinkedToTfn: v.isLinkedToTfn
        }));
        
        // Sort: moving > idle > stationary/stopped > offline > unlinked
        mappedVehicles.sort((a, b) => {
          // First check if linked to CarTrack
          const aLinked = a.isLinkedToCarTrack || a.carTrackId ? 1 : 0;
          const bLinked = b.isLinkedToCarTrack || b.carTrackId ? 1 : 0;
          
          // Unlinked vehicles go to the bottom
          if (aLinked !== bLinked) return bLinked - aLinked;
          
          // For linked vehicles, sort by status: moving > idling > stopped > offline
          const statusOrder: Record<string, number> = { 'moving': 0, 'idling': 1, 'stopped': 2, 'offline': 3 };
          const aStatus = statusOrder[a.liveStatus] ?? 4;
          const bStatus = statusOrder[b.liveStatus] ?? 4;
          if (aStatus !== bStatus) return aStatus - bStatus;
          
          // Within same status, sort by speed (higher speed first)
          return (b.speed ?? 0) - (a.speed ?? 0);
        });
        
        this.vehicles.set(mappedVehicles);
        this.stats.update(s => ({
          ...s,
          totalVehicles: fleet.length,
          availableVehicles: fleet.filter(v => v.status === 'Available').length
        }));
      },
      error: () => {}
    });
  }

  // TFN Sync - Link vehicles by registration number
  syncTfnVehicles(): void {
    this.tfnSyncing.set(true);
    this.http.post<any>(`${this.apiUrl}/logistics/tfn/sync/vehicles`, {}).subscribe({
      next: (result) => {
        this.tfnSyncing.set(false);
        this.loadVehiclesFromDatabase();
        console.log('TFN sync completed:', result);
      },
      error: (err) => {
        this.tfnSyncing.set(false);
        console.error('TFN sync failed:', err);
      }
    });
  }

  // CarTrack Sync - Link vehicles by registration number
  syncCarTrackVehicles(): void {
    this.carTrackSyncing.set(true);
    this.http.post<any>(`${this.apiUrl}/fleet/sync/cartrack`, {}).subscribe({
      next: (result) => {
        this.carTrackSyncing.set(false);
        this.loadVehiclesFromDatabase();
        console.log('CarTrack sync completed:', result);
      },
      error: (err) => {
        this.carTrackSyncing.set(false);
        console.error('CarTrack sync failed:', err);
      }
    });
  }

  // Get count of vehicles linked to TFN or CarTrack
  getLinkedVehicleCount(): number {
    return this.vehicles().filter(v => v.isLinkedToTfn || v.isLinkedToCarTrack || v.tfnVehicleId || v.carTrackId).length;
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
      vehiclesInMaintenance: 2,
      upcomingMaintenance: 3,
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

  syncFromCarTrack(): void {
    this.syncing.set(true);
    
    this.http.post<any>(`${this.apiUrl}/fleet/sync-from-cartrack`, {}).subscribe({
      next: (result) => {
        this.syncing.set(false);
        if (result.success) {
          // Show success dialog
          this.dialog.open(SyncResultDialogComponent, {
            width: '500px',
            data: result
          });
          // Refresh the dashboard data
          this.loadDashboardData();
        } else {
          alert('Sync failed: ' + result.message);
        }
      },
      error: (err) => {
        this.syncing.set(false);
        console.error('CarTrack sync error:', err);
        alert('Failed to sync from CarTrack. Check console for details.');
      }
    });
  }

  createNewLoad(): void {
    const dialogRef = this.dialog.open(NewLoadDialogComponent, {
      width: '95vw',
      maxWidth: '1000px',
      minWidth: '800px',
      maxHeight: '90vh',
      disableClose: true,
      panelClass: 'wide-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Add the new load to the list
        const newLoad: ActiveLoad = {
          id: this.activeLoads().length + 1,
          loadNumber: 'LD-2026-' + String(this.activeLoads().length + 1).padStart(3, '0'),
          customerName: result.customerName,
          origin: result.origin,
          destination: result.destination,
          status: 'Pending',
          vehicleRegistration: result.vehicleRegistration || '',
          driverName: result.driverName || '',
          scheduledDelivery: new Date(result.scheduledDelivery),
          progress: 0
        };
        this.activeLoads.update(loads => [...loads, newLoad]);
      }
    });
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
    this.openVehicleDialog();
  }

  viewVehicleDetails(vehicle: Vehicle): void {
    console.log('View vehicle details', vehicle);
    this.openVehicleDialog(vehicle, 'view');
  }

  editVehicle(vehicle: Vehicle): void {
    console.log('Edit vehicle', vehicle);
    this.openVehicleDialog(vehicle, 'edit');
  }

  assignDriver(vehicle: Vehicle): void {
    console.log('Assign driver', vehicle);
    this.openAssignDriverDialog(vehicle);
  }

  linkCarTrack(vehicle: Vehicle): void {
    console.log('Link CarTrack', vehicle);
    this.openLinkDialog(vehicle, 'cartrack');
  }

  unlinkCarTrack(vehicle: Vehicle): void {
    if (confirm(`Unlink CarTrack from ${vehicle.registrationNumber}?`)) {
      this.http.post<any>(`${this.apiUrl}/fleet/vehicles/${vehicle.id}/unlink-cartrack`, {}).subscribe({
        next: () => {
          this.loadVehiclesFromDatabase();
        },
        error: (err) => console.error('Error unlinking CarTrack:', err)
      });
    }
  }

  linkTfn(vehicle: Vehicle): void {
    console.log('Link TFN', vehicle);
    this.openLinkDialog(vehicle, 'tfn');
  }

  unlinkTfn(vehicle: Vehicle): void {
    if (confirm(`Unlink TruckFuelNet from ${vehicle.registrationNumber}?`)) {
      this.http.post<any>(`${this.apiUrl}/fleet/vehicles/${vehicle.id}/unlink-tfn`, {}).subscribe({
        next: () => {
          this.loadVehiclesFromDatabase();
        },
        error: (err) => console.error('Error unlinking TFN:', err)
      });
    }
  }

  viewFuelHistory(vehicle: Vehicle): void {
    console.log('View fuel history', vehicle);
    // TODO: Open fuel history dialog
  }

  viewVehicleMaintenanceHistory(vehicle: Vehicle): void {
    console.log('View vehicle maintenance history', vehicle);
    // TODO: Open maintenance history dialog for vehicle
  }

  deleteVehicle(vehicle: Vehicle): void {
    if (confirm(`Are you sure you want to delete vehicle ${vehicle.registrationNumber}? This action cannot be undone.`)) {
      this.http.delete<any>(`${this.apiUrl}/fleet/vehicles/${vehicle.id}`).subscribe({
        next: () => {
          this.loadVehiclesFromDatabase();
        },
        error: (err) => console.error('Error deleting vehicle:', err)
      });
    }
  }

  openVehicleDialog(vehicle?: Vehicle, mode: 'view' | 'edit' | 'add' = 'add'): void {
    const dialogRef = this.dialog.open(VehicleDialogComponent, {
      width: '600px',
      maxHeight: '90vh',
      data: { vehicle, mode }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadVehiclesFromDatabase();
      }
    });
  }

  openAssignDriverDialog(vehicle: Vehicle): void {
    const dialogRef = this.dialog.open(AssignDriverDialogComponent, {
      width: '500px',
      data: { vehicle }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadVehiclesFromDatabase();
      }
    });
  }

  openLinkDialog(vehicle: Vehicle, type: 'cartrack' | 'tfn'): void {
    const dialogRef = this.dialog.open(LinkVehicleDialogComponent, {
      width: '500px',
      data: { vehicle, type }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadVehiclesFromDatabase();
      }
    });
  }

  trackVehicle(vehicle: Vehicle): void {
    console.log('Track vehicle', vehicle);
    this.openSingleVehicleMap(vehicle);
  }

  openFleetMap(): void {
    const vehiclesWithLocation = this.vehicles().filter(v => v.latitude && v.longitude);
    this.dialog.open(FleetMapDialogComponent, {
      width: '95vw',
      maxWidth: '1400px',
      height: '85vh',
      data: { vehicles: vehiclesWithLocation.length > 0 ? vehiclesWithLocation : this.vehicles() }
    });
  }

  openSingleVehicleMap(vehicle: Vehicle): void {
    this.dialog.open(FleetMapDialogComponent, {
      width: '95vw',
      maxWidth: '1200px',
      height: '80vh',
      data: { 
        vehicles: this.vehicles(),
        focusVehicle: vehicle 
      }
    });
  }

  refreshFleetLocations(): void {
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
            fuelLevel: 50,
            speed: v.speed,
            latitude: v.location?.latitude,
            longitude: v.location?.longitude,
            lastUpdate: v.lastUpdate
          })));
        }
      },
      error: (err) => {
        console.error('Error refreshing fleet locations:', err);
      }
    });
  }

  // South African provinces list
  southAfricanProvinces = [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
    'Western Cape'
  ];

  // Imported Invoice methods
  uniqueProvinces = computed(() => {
    // Return all SA provinces - the filter will handle showing which ones have invoices
    return this.southAfricanProvinces;
  });

  // Get count of invoices per province for display
  getProvinceInvoiceCount(province: string): number {
    return this.importedInvoices().filter(i => i.deliveryProvince === province).length;
  }

  filteredInvoices = computed(() => {
    let invoices = this.importedInvoices();
    const statusFilter = this.invoiceStatusFilter();
    const sourceFilter = this.invoiceSourceFilter();
    const provinceFilter = this.invoiceProvinceFilter();
    const searchTerm = this.invoiceSearch();
    
    if (statusFilter !== 'all') {
      invoices = invoices.filter(i => i.status.toLowerCase() === statusFilter);
    }
    
    if (sourceFilter !== 'all') {
      invoices = invoices.filter(i => i.sourceSystem === sourceFilter);
    }
    
    if (provinceFilter !== 'all') {
      invoices = invoices.filter(i => i.deliveryProvince === provinceFilter);
    }
    
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      invoices = invoices.filter(i => 
        i.transactionNumber?.toLowerCase().includes(search) ||
        i.customerNumber?.toLowerCase().includes(search) ||
        i.customerName?.toLowerCase().includes(search) ||
        i.productCode?.toLowerCase().includes(search) ||
        i.productDescription?.toLowerCase().includes(search)
      );
    }
    
    return invoices;
  });

  pendingInvoiceCount = computed(() => this.importedInvoices().filter(i => i.status === 'Pending').length);
  assignedInvoiceCount = computed(() => this.importedInvoices().filter(i => i.status === 'Assigned').length);
  deliveredInvoiceCount = computed(() => this.importedInvoices().filter(i => i.status === 'Delivered').length);

  loadImportedInvoices(): void {
    this.http.get<ImportedInvoice[]>(`${this.apiUrl}/logistics/importedinvoices?pageSize=1000`).subscribe({
      next: (invoices) => {
        this.importedInvoices.set(invoices);
        this.stats.update(s => ({
          ...s,
          pendingInvoices: invoices.filter(i => i.status === 'Pending').length,
          overdueInvoices: 0
        }));
      },
      error: (err) => {
        console.error('Failed to load invoices:', err);
      }
    });
  }

  getInvoiceStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'assigned': return 'status-in-transit';
      case 'delivered': return 'status-delivered';
      case 'cancelled': return 'status-cancelled';
      default: return '';
    }
  }

  calculateMargin(salesAmount: number, costOfSales: number): number {
    if (salesAmount === 0) return 0;
    return ((salesAmount - costOfSales) / salesAmount) * 100;
  }

  showSuggestedLoads(): void {
    this.dialog.open(SuggestedLoadsDialog, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      data: { apiUrl: this.apiUrl }
    }).afterClosed().subscribe(result => {
      if (result) {
        // Refresh invoices and tripsheets after load creation
        this.loadImportedInvoices();
        this.loadTripsheets();
      }
    });
  }

  createTripsheetFromInvoices(): void {
    const pendingInvoices = this.importedInvoices().filter(i => i.status === 'Pending');
    if (pendingInvoices.length === 0) {
      alert('No pending invoices to create tripsheet from');
      return;
    }
    
    // Group by customer for tripsheet creation
    const invoiceIds = pendingInvoices.map(i => i.id);
    
    this.http.post<any>(`${this.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
      invoiceIds: invoiceIds,
      notes: 'Auto-generated from imported invoices'
    }).subscribe({
      next: (result) => {
        alert(`Tripsheet ${result.load?.loadNumber} created with ${result.stopsCreated} stops!`);
        this.loadImportedInvoices();
        this.loadTripsheets();
      },
      error: (err) => {
        console.error('Failed to create tripsheet:', err);
        alert('Failed to create tripsheet: ' + (err.error?.message || err.message));
      }
    });
  }

  viewInvoiceDetails(invoice: ImportedInvoice): void {
    this.dialog.open(InvoiceDetailsDialog, {
      width: '600px',
      data: invoice
    });
  }

  // Tripsheet methods
  filteredTripsheets = computed(() => {
    let trips = this.tripsheets();
    
    if (this.tripsheetStatusFilter !== 'all') {
      trips = trips.filter(t => t.status.toLowerCase().replace(' ', '-') === this.tripsheetStatusFilter);
    }
    
    if (this.tripsheetSearch) {
      const search = this.tripsheetSearch.toLowerCase();
      trips = trips.filter(t => 
        t.tripNumber?.toLowerCase().includes(search) ||
        t.loadNumber?.toLowerCase().includes(search) ||
        t.driverName?.toLowerCase().includes(search) ||
        t.vehicleReg?.toLowerCase().includes(search)
      );
    }
    
    return trips;
  });

  loadTripsheets(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/tripsheet`).subscribe({
      next: (trips) => {
        this.tripsheets.set(trips);
      },
      error: () => {
        // Sample data for testing
        this.tripsheets.set([
          { id: 1, loadId: 1, tripNumber: 'TS-2026-001', loadNumber: 'LD-000001', driverName: 'John Smith', vehicleReg: 'GP 123-456', origin: 'JHB', destination: 'DBN', totalStops: 3, totalDistance: 580, estimatedTime: '9h 30m', date: new Date(), status: 'Completed' },
          { id: 2, loadId: 2, tripNumber: 'TS-2026-002', loadNumber: 'LD-000002', driverName: 'Peter Nkosi', vehicleReg: 'KZN 111-222', origin: 'DBN', destination: 'CPT', totalStops: 2, totalDistance: 1650, estimatedTime: '18h 0m', date: new Date(), status: 'In Progress' },
          { id: 3, loadId: 3, tripNumber: 'TS-2026-003', loadNumber: 'LD-000003', driverName: 'Mike Johnson', vehicleReg: 'WC 333-444', origin: 'CPT', destination: 'PE', totalStops: 4, totalDistance: 760, estimatedTime: '12h 0m', date: new Date(), status: 'Pending' }
        ]);
      }
    });
  }

  getTripStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'completed': return 'status-delivered';
      case 'in progress': return 'status-in-transit';
      case 'pending': return 'status-pending';
      default: return '';
    }
  }

  viewTripsheet(trip: any): void {
    // Open tripsheet preview dialog
    this.dialog.open(TripSheetPreviewDialog, {
      width: '900px',
      maxHeight: '90vh',
      data: { loadId: trip.loadId || trip.id }
    });
  }

  openCreateTripsheetDialog(): void {
    const dialogRef = this.dialog.open(CreateTripsheetDialog, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'create-tripsheet-dialog-panel',
      data: {
        invoices: this.importedInvoices(),
        drivers: this.drivers(),
        vehicles: this.vehicles(),
        warehouses: this.warehouses(),
        customers: this.customers(),
        apiUrl: this.apiUrl
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
        this.loadImportedInvoices();
      }
    });
  }

  printTripsheet(trip: any): void {
    // Open tripsheet in new window for printing
    const loadId = trip.loadId || trip.id;
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 500);
        }
      },
      error: (err) => {
        console.error('Failed to load tripsheet for printing:', err);
      }
    });
  }

  downloadTripsheet(trip: any): void {
    // Download tripsheet as PDF
    const loadId = trip.loadId || trip.id;
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        // Create a hidden iframe and use print to PDF
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          
          // Use the browser's print dialog with "Save as PDF" option
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
          }, 500);
        }
      },
      error: (err) => {
        console.error('Failed to download tripsheet:', err);
      }
    });
  }

  // Fuel Management Methods (TFN)
  loadFuelSummary(): void {
    this.http.get<any>(`${environment.apiUrl}/logistics/tfn/dashboard-summary`).subscribe({
      next: (data) => {
        this.fuelSummary.set(data);
      },
      error: (err) => {
        console.error('Failed to load fuel summary:', err);
        this.fuelSummary.set(null);
      }
    });
  }

  syncFuelData(): void {
    this.syncingFuel.set(true);
    this.http.post<any>(`${environment.apiUrl}/logistics/tfn/sync`, {}).subscribe({
      next: (result) => {
        console.log('Fuel sync result:', result);
        this.syncingFuel.set(false);
        // Reload fuel summary after sync
        this.loadFuelSummary();
        alert(`Fuel data synced successfully!\nVehicles: ${result.vehicles?.synced || 0}\nTransactions: ${result.transactions?.synced || 0}`);
      },
      error: (err) => {
        console.error('Failed to sync fuel data:', err);
        this.syncingFuel.set(false);
        alert('Failed to sync fuel data. Please check console for details.');
      }
    });
  }

  calculateFuelChange(): string {
    const summary = this.fuelSummary();
    if (!summary?.thisMonth?.totalCost || !summary?.lastMonth?.totalCost) {
      return '0';
    }
    const change = ((summary.thisMonth.totalCost - summary.lastMonth.totalCost) / summary.lastMonth.totalCost) * 100;
    return change > 0 ? `+${change.toFixed(1)}` : change.toFixed(1);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // TFN Orders Methods
  loadTfnOrders(): void {
    this.http.get<any[]>(`${environment.apiUrl}/logistics/tfn/orders`).subscribe({
      next: (orders) => {
        this.tfnOrders.set(orders);
        this.tfnOrdersCount.set(orders.length);
      },
      error: (err) => {
        console.error('Failed to load TFN orders:', err);
        this.tfnOrders.set([]);
        this.tfnOrdersCount.set(0);
      }
    });
  }

  openTfnOrdersDialog(): void {
    const dialogRef = this.dialog.open(TfnOrdersListDialog, {
      width: '95vw',
      maxWidth: '1400px',
      maxHeight: '90vh',
      panelClass: 'tfn-orders-dialog-panel',
      data: { orders: this.tfnOrders(), apiUrl: environment.apiUrl }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'refresh') {
        this.loadTfnOrders();
      }
    });
  }

  // TFN Depots Methods
  loadTfnDepots(): void {
    this.http.get<any[]>(`${environment.apiUrl}/logistics/tfn/depots`).subscribe({
      next: (depots) => {
        this.tfnDepots.set(depots);
        this.tfnDepotsCount.set(depots.length);
      },
      error: (err) => {
        console.error('Failed to load TFN depots:', err);
        this.tfnDepots.set([]);
        this.tfnDepotsCount.set(0);
      }
    });
  }

  openDepotsMapDialog(): void {
    this.dialog.open(TfnDepotsMapDialog, {
      width: '95vw',
      maxWidth: '1600px',
      height: '90vh',
      panelClass: 'tfn-depots-map-dialog-panel',
      data: { depots: this.tfnDepots() }
    });
  }
}

// Invoice Details Dialog Component
@Component({
  selector: 'app-invoice-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  template: `
    <div class="invoice-details-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>receipt_long</mat-icon>
          Invoice Details
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="invoice-content">
        <div class="invoice-header-info">
          <div class="invoice-number">
            <span class="label">Invoice #</span>
            <span class="value">{{ data.transactionNumber }}</span>
          </div>
          <div class="invoice-status" [ngClass]="getStatusClass()">
            {{ data.status }}
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>calendar_today</mat-icon> Transaction Info</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">Date</span>
              <span class="value">{{ data.transactionDate | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Type</span>
              <span class="value">{{ data.transactionType }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Year/Period</span>
              <span class="value">{{ data.year }}/{{ data.period }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Category</span>
              <span class="value">{{ data.category }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Location</span>
              <span class="value">{{ data.location }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Source</span>
              <span class="value">{{ data.sourceSystem || 'N/A' }}</span>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>business</mat-icon> Customer</h3>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <span class="label">Customer Name</span>
              <span class="value">{{ data.customerName }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Customer Code</span>
              <span class="value">{{ data.customerNumber }}</span>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>inventory_2</mat-icon> Product</h3>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <span class="label">Description</span>
              <span class="value">{{ data.productDescription }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Product Code</span>
              <span class="value">{{ data.productCode }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Quantity</span>
              <span class="value">{{ data.quantity | number:'1.0-0' }}</span>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>attach_money</mat-icon> Financials</h3>
          <div class="financial-summary">
            <div class="financial-item">
              <span class="label">Sales Amount</span>
              <span class="value sales">R{{ data.salesAmount | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">Cost of Sales</span>
              <span class="value cost">R{{ data.costOfSales | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">Gross Profit</span>
              <span class="value profit">R{{ data.grossProfit | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">Margin</span>
              <span class="value margin" [class.positive]="data.marginPercent > 0" [class.negative]="data.marginPercent < 0">
                {{ data.marginPercent | number:'1.2-2' }}%
              </span>
            </div>
          </div>
        </div>

        @if (data.loadNumber) {
          <mat-divider></mat-divider>
          <div class="detail-section">
            <h3><mat-icon>local_shipping</mat-icon> Assignment</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="label">Load Number</span>
                <span class="value">{{ data.loadNumber }}</span>
              </div>
            </div>
          </div>
        }

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>info</mat-icon> Import Info</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">Imported At</span>
              <span class="value">{{ data.importedAt | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Batch ID</span>
              <span class="value">{{ data.importBatchId || 'N/A' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Close</button>
      </div>
    </div>
  `,
  styles: [`
    .invoice-details-dialog {
      padding: 0;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1976d2, #1565c0);
      color: white;
    }

    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
    }

    .dialog-header button {
      color: white;
    }

    .invoice-content {
      padding: 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .invoice-header-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .invoice-number .label {
      display: block;
      font-size: 12px;
      color: #666;
    }

    .invoice-number .value {
      font-size: 24px;
      font-weight: 600;
      color: #1976d2;
    }

    .invoice-status {
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: 500;
      font-size: 14px;
    }

    .invoice-status.status-pending {
      background: #fff3e0;
      color: #f57c00;
    }

    .invoice-status.status-assigned {
      background: #e3f2fd;
      color: #1976d2;
    }

    .invoice-status.status-delivered {
      background: #e8f5e9;
      color: #388e3c;
    }

    .detail-section {
      margin: 20px 0;
    }

    .detail-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
    }

    .detail-section h3 mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
    }

    .detail-item.full-width {
      grid-column: 1 / -1;
    }

    .detail-item .label {
      font-size: 12px;
      color: #999;
      margin-bottom: 2px;
    }

    .detail-item .value {
      font-size: 14px;
      color: #333;
      font-weight: 500;
    }

    .financial-summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .financial-item {
      background: #f5f5f5;
      padding: 12px 16px;
      border-radius: 8px;
      text-align: center;
    }

    .financial-item .label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }

    .financial-item .value {
      font-size: 18px;
      font-weight: 600;
    }

    .financial-item .value.sales {
      color: #1976d2;
    }

    .financial-item .value.cost {
      color: #f57c00;
    }

    .financial-item .value.profit {
      color: #388e3c;
    }

    .financial-item .value.margin.positive {
      color: #388e3c;
    }

    .financial-item .value.margin.negative {
      color: #d32f2f;
    }

    .dialog-actions {
      padding: 16px 24px;
      display: flex;
      justify-content: flex-end;
      border-top: 1px solid #eee;
    }

    mat-divider {
      margin: 16px 0;
    }
  `]
})
export class InvoiceDetailsDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<InvoiceDetailsDialog>
  ) {}

  getStatusClass(): string {
    switch (this.data.status?.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'assigned': return 'status-assigned';
      case 'delivered': return 'status-delivered';
      default: return '';
    }
  }
}

// Fleet Map Dialog Component
@Component({
  selector: 'app-fleet-map-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="map-dialog">
      <div class="map-header">
        <h2>
          <mat-icon>map</mat-icon>
          Live Fleet Tracking
        </h2>
        <div class="header-controls">
          <mat-form-field appearance="outline" class="vehicle-select">
            <mat-label>Focus Vehicle</mat-label>
            <mat-select [(ngModel)]="selectedVehicle" (selectionChange)="focusOnVehicle()">
              <mat-option [value]="null">All Vehicles</mat-option>
              @for (v of data.vehicles; track v.registrationNumber) {
                <mat-option [value]="v">{{ v.registrationNumber }} {{ v.speed ? '(' + v.speed + ' km/h)' : '' }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-raised-button color="primary" 
                  (click)="findNearestTfnDepot()" 
                  [disabled]="!selectedVehicle || !selectedVehicle.latitude"
                  matTooltip="Find nearest TFN depot to selected vehicle"
                  class="nearest-tfn-btn">
            <mat-icon>local_shipping</mat-icon>
            Nearest TFN
          </button>
          <button mat-icon-button (click)="refreshMap()" matTooltip="Refresh">
            <mat-icon>refresh</mat-icon>
          </button>
          <button mat-icon-button mat-dialog-close matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="map-content">
        <div class="vehicle-sidebar">
          <h3>Vehicles ({{ data.vehicles.length }})</h3>
          <div class="vehicle-list">
            @for (vehicle of data.vehicles; track vehicle.registrationNumber) {
              <div class="sidebar-vehicle" 
                   [class.selected]="selectedVehicle === vehicle"
                   [class.moving]="vehicle.speed && vehicle.speed > 0"
                   [class.offline]="vehicle.status === 'offline'"
                   (click)="selectVehicle(vehicle)">
                <div class="vehicle-icon">
                  <mat-icon>{{ vehicle.speed && vehicle.speed > 0 ? 'local_shipping' : 'local_parking' }}</mat-icon>
                </div>
                <div class="vehicle-details">
                  <strong>{{ vehicle.registrationNumber }}</strong>
                  <span class="driver">{{ vehicle.currentDriver || 'No driver' }}</span>
                  <span class="status-info">
                    @if (vehicle.speed !== undefined) {
                      <mat-chip class="speed-chip" [class.moving]="vehicle.speed > 0">
                        {{ vehicle.speed }} km/h
                      </mat-chip>
                    }
                  </span>
                  <span class="location">{{ vehicle.lastLocation || 'Unknown location' }}</span>
                </div>
              </div>
            }
          </div>
        </div>

        <div class="map-container">
          @if (mapLoading) {
            <div class="map-loading">
              <mat-spinner diameter="50"></mat-spinner>
              <p>Loading map...</p>
            </div>
          }
          <div #mapElement class="google-map" [style.opacity]="mapLoading ? 0 : 1"></div>
        </div>
      </div>

      <div class="map-footer">
        <div class="legend">
          <span class="legend-item"><span class="dot moving"></span> Moving</span>
          <span class="legend-item"><span class="dot stopped"></span> Stopped</span>
          <span class="legend-item"><span class="dot offline"></span> Offline</span>
        </div>
        <span class="last-update">Last updated: {{ lastUpdate | date:'HH:mm:ss' }}</span>
      </div>
    </div>
  `,
  styles: [`
    .map-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
    }

    .map-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      color: white;
    }

    .map-header h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .vehicle-select {
      width: 220px;
    }

    .vehicle-select ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.9);
      border-radius: 4px;
    }

    .nearest-tfn-btn {
      background: #ff9800 !important;
      color: white !important;
      font-size: 12px;
      height: 36px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .nearest-tfn-btn:disabled {
      background: rgba(255, 255, 255, 0.3) !important;
      color: rgba(255, 255, 255, 0.5) !important;
    }

    .nearest-tfn-btn mat-icon {
      font-size: 18px;
      height: 18px;
      width: 18px;
    }

    .header-controls button {
      color: white;
    }

    .map-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .vehicle-sidebar {
      width: 300px;
      background: #f5f5f5;
      border-right: 1px solid #ddd;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .vehicle-sidebar h3 {
      padding: 16px;
      margin: 0;
      background: #e3e3e3;
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .vehicle-list {
      flex: 1;
      overflow-y: auto;
    }

    .sidebar-vehicle {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #e0e0e0;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .sidebar-vehicle:hover {
      background: #e3f2fd;
    }

    .sidebar-vehicle.selected {
      background: #bbdefb;
      border-left: 4px solid #1976d2;
    }

    .sidebar-vehicle.moving .vehicle-icon {
      color: #4caf50;
    }

    .sidebar-vehicle.offline .vehicle-icon {
      color: #f44336;
    }

    .vehicle-icon {
      color: #ff9800;
    }

    .vehicle-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .vehicle-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .vehicle-details strong {
      font-size: 14px;
      color: #333;
    }

    .vehicle-details .driver {
      font-size: 12px;
      color: #666;
    }

    .vehicle-details .location {
      font-size: 11px;
      color: #999;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-info {
      display: flex;
      gap: 4px;
      margin: 4px 0;
    }

    .speed-chip {
      font-size: 10px !important;
      min-height: 20px !important;
      padding: 0 8px !important;
    }

    .speed-chip.moving {
      background: #e8f5e9 !important;
      color: #2e7d32 !important;
    }

    .map-container {
      flex: 1;
      position: relative;
      background: #e0e0e0;
    }

    .map-loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      z-index: 10;
    }

    .google-map {
      width: 100%;
      height: 100%;
      transition: opacity 0.3s ease;
    }

    .map-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 24px;
      background: #f5f5f5;
      border-top: 1px solid #ddd;
    }

    .legend {
      display: flex;
      gap: 24px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #666;
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .dot.moving {
      background: #4caf50;
    }

    .dot.stopped {
      background: #ff9800;
    }

    .dot.offline {
      background: #f44336;
    }

    .last-update {
      font-size: 12px;
      color: #999;
    }

    @media (max-width: 768px) {
      .vehicle-sidebar {
        display: none;
      }
    }
  `]
})
export class FleetMapDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapElement') mapElement!: ElementRef;
  
  selectedVehicle: Vehicle | null = null;
  mapLoading = true;
  lastUpdate = new Date();
  
  private map: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private infoWindow: google.maps.InfoWindow | null = null;
  private mapInitialized = false;
  private depotMarker: google.maps.Marker | null = null;
  private depotLine: google.maps.Polyline | null = null;

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    public dialogRef: MatDialogRef<FleetMapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicles: Vehicle[], focusVehicle?: Vehicle }
  ) {
    if (data.focusVehicle) {
      this.selectedVehicle = data.focusVehicle;
    }
  }

  ngAfterViewInit(): void {
    this.loadGoogleMapsScript();
  }

  ngOnDestroy(): void {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    if (this.infoWindow) {
      this.infoWindow.close();
    }
    if (this.depotMarker) {
      this.depotMarker.setMap(null);
    }
    if (this.depotLine) {
      this.depotLine.setMap(null);
    }
  }

  private loadGoogleMapsScript(): void {
    const apiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
    
    if (typeof google !== 'undefined' && google.maps) {
      this.initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + apiKey + '&callback=initFleetMap';
    script.async = true;
    script.defer = true;
    
    (window as any).initFleetMap = () => {
      this.initializeMap();
    };
    
    document.head.appendChild(script);
  }

  private initializeMap(): void {
    if (this.mapInitialized || !this.mapElement?.nativeElement) return;
    
    // Default center (South Africa)
    const defaultCenter = { lat: -26.2041, lng: 28.0473 };
    
    this.map = new google.maps.Map(this.mapElement.nativeElement, {
      zoom: 6,
      center: defaultCenter,
      mapTypeId: 'roadmap',
      mapTypeControl: true,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scaleControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    } as any);

    this.infoWindow = new google.maps.InfoWindow();
    this.mapInitialized = true;
    this.mapLoading = false;
    
    this.addVehicleMarkers();
    
    if (this.selectedVehicle) {
      setTimeout(() => this.focusOnVehicle(), 500);
    }
  }

  private addVehicleMarkers(): void {
    if (!this.map) return;

    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    
    const bounds = new google.maps.LatLngBounds();
    let hasValidLocations = false;

    this.data.vehicles.forEach(vehicle => {
      if (vehicle.latitude && vehicle.longitude) {
        hasValidLocations = true;
        const position = { lat: vehicle.latitude, lng: vehicle.longitude };
        bounds.extend(position);

        const isMoving = vehicle.speed && vehicle.speed > 0;
        const isOffline = vehicle.status === 'offline';
        
        const marker = new google.maps.Marker({
          position,
          map: this.map,
          title: vehicle.registrationNumber,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: isMoving ? 8 : 6,
            fillColor: isOffline ? '#f44336' : (isMoving ? '#4caf50' : '#ff9800'),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            rotation: 0
          },
          animation: isMoving ? google.maps.Animation.BOUNCE : undefined
        });

        // Stop bounce animation after 2 seconds
        if (isMoving) {
          setTimeout(() => marker.setAnimation(null), 2000);
        }

        marker.addListener('click', () => {
          this.showVehicleInfo(vehicle, marker);
        });

        this.markers.push(marker);
      }
    });

    if (hasValidLocations && this.markers.length > 1 && !this.selectedVehicle) {
      this.map.fitBounds(bounds, 50);
    } else if (hasValidLocations && this.markers.length === 1) {
      this.map.setCenter(this.markers[0].getPosition()!);
      this.map.setZoom(14);
    }
  }

  private showVehicleInfo(vehicle: Vehicle, marker: google.maps.Marker): void {
    if (!this.infoWindow || !this.map) return;

    const statusColor = vehicle.speed && vehicle.speed > 0 ? '#4caf50' : '#ff9800';
    const statusText = vehicle.speed && vehicle.speed > 0 ? 'Moving' : 'Stationary';
    const lastUpdateHtml = vehicle.lastUpdate 
      ? '<p style="margin: 4px 0; font-size: 11px; color: #999;">Updated: ' + new Date(vehicle.lastUpdate).toLocaleTimeString() + '</p>' 
      : '';

    const content = '<div style="padding: 12px; min-width: 200px;">' +
      '<h3 style="margin: 0 0 8px 0; color: #1976d2; font-size: 16px;">' + vehicle.registrationNumber + '</h3>' +
      '<p style="margin: 4px 0; font-size: 13px;"><strong>Driver:</strong> ' + (vehicle.currentDriver || 'Not assigned') + '</p>' +
      '<p style="margin: 4px 0; font-size: 13px;"><strong>Speed:</strong> ' + (vehicle.speed || 0) + ' km/h</p>' +
      '<p style="margin: 4px 0; font-size: 13px;"><strong>Status:</strong> <span style="color: ' + statusColor + ';">' + statusText + '</span></p>' +
      '<p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>Location:</strong> ' + (vehicle.lastLocation || 'Unknown') + '</p>' +
      lastUpdateHtml +
      '<div style="margin-top: 12px;"><a href="https://www.google.com/maps/dir/?api=1&destination=' + vehicle.latitude + ',' + vehicle.longitude + '" target="_blank" style="color: #1976d2; text-decoration: none; font-size: 12px;">Get Directions →</a></div>' +
      '</div>';

    this.infoWindow.setContent(content);
    this.infoWindow.open(this.map, marker);
  }

  selectVehicle(vehicle: Vehicle): void {
    this.selectedVehicle = vehicle;
    this.focusOnVehicle();
  }

  focusOnVehicle(): void {
    if (!this.map || !this.selectedVehicle) {
      if (this.map && this.markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        this.markers.forEach(m => bounds.extend(m.getPosition()!));
        this.map.fitBounds(bounds, 50);
      }
      return;
    }

    const vehicle = this.selectedVehicle;
    if (vehicle.latitude && vehicle.longitude) {
      this.map.setCenter({ lat: vehicle.latitude, lng: vehicle.longitude });
      this.map.setZoom(15);

      const marker = this.markers.find(m => m.getTitle() === vehicle.registrationNumber);
      if (marker) {
        this.showVehicleInfo(vehicle, marker);
      }
    }
  }

  findNearestTfnDepot(): void {
    if (!this.selectedVehicle || !this.selectedVehicle.latitude || !this.selectedVehicle.longitude) {
      this.snackBar.open('Please select a vehicle with valid coordinates', 'Close', { duration: 3000 });
      return;
    }

    // Clear previous depot marker and line
    if (this.depotMarker) {
      this.depotMarker.setMap(null);
      this.depotMarker = null;
    }
    if (this.depotLine) {
      this.depotLine.setMap(null);
      this.depotLine = null;
    }

    const lat = this.selectedVehicle.latitude;
    const lng = this.selectedVehicle.longitude;

    this.http.get<any>(`/api/logistics/tfn/depots/nearest?lat=${lat}&lng=${lng}`).subscribe({
      next: (depot) => {
        // Show depot on map with info window
        if (this.map && depot.latitude && depot.longitude) {
          // Add a marker for the depot
          this.depotMarker = new google.maps.Marker({
            position: { lat: depot.latitude, lng: depot.longitude },
            map: this.map,
            title: depot.name,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"><path fill="#e65100" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
              ),
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 40)
            }
          });

          // Draw a line from vehicle to depot
          this.depotLine = new google.maps.Polyline({
            path: [
              { lat: lat, lng: lng },
              { lat: depot.latitude, lng: depot.longitude }
            ],
            geodesic: true,
            strokeColor: '#ff9800',
            strokeOpacity: 0.8,
            strokeWeight: 3,
            map: this.map
          });

          // Create bounds to show both vehicle and depot
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: lat, lng: lng });
          bounds.extend({ lat: depot.latitude, lng: depot.longitude });
          this.map.fitBounds(bounds, 80);

          // Show info window on depot
          const infoContent = `
            <div style="padding: 12px; min-width: 220px;">
              <h3 style="margin: 0 0 8px 0; color: #e65100; font-size: 16px;">
                <span style="font-size: 20px;">🏭</span> ${depot.name}
              </h3>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Code:</strong> ${depot.code || 'N/A'}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Distance:</strong> <span style="color: #1976d2; font-weight: bold;">${depot.distanceKm} km</span></p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>Address:</strong> ${depot.address || ''}</p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">${depot.city || ''}, ${depot.province || ''}</p>
              ${depot.contactPerson ? '<p style="margin: 8px 0 4px 0; font-size: 12px;"><strong>Contact:</strong> ' + depot.contactPerson + '</p>' : ''}
              ${depot.contactPhone ? '<p style="margin: 4px 0; font-size: 12px;"><strong>Phone:</strong> <a href="tel:' + depot.contactPhone + '">' + depot.contactPhone + '</a></p>' : ''}
              <div style="margin-top: 12px;">
                <a href="https://www.google.com/maps/dir/${lat},${lng}/${depot.latitude},${depot.longitude}" target="_blank" style="color: #e65100; text-decoration: none; font-size: 12px;">Get Directions →</a>
              </div>
            </div>
          `;

          if (this.infoWindow) {
            this.infoWindow.setContent(infoContent);
            this.infoWindow.open(this.map, this.depotMarker);
          }
        }

        this.snackBar.open(`Nearest TFN: ${depot.name} (${depot.distanceKm} km away)`, 'Close', { duration: 5000 });
      },
      error: (err) => {
        console.error('Error finding nearest depot:', err);
        this.snackBar.open('Failed to find nearest TFN depot', 'Close', { duration: 3000 });
      }
    });
  }

  refreshMap(): void {
    this.lastUpdate = new Date();
    this.addVehicleMarkers();
  }
}

// New Load Dialog Component with Multi-Stop Support
@Component({
  selector: 'app-new-load-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatChipsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    FormsModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="load-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>add_box</mat-icon>
          Create New Load
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        @if (loading) {
          <div class="loading-container">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Loading data...</p>
          </div>
        } @else {
          <div class="load-form">
            <!-- STEP 1: Load Info -->
            <div class="form-section">
              <div class="section-header">
                <mat-icon>info</mat-icon>
                <span>Load Information</span>
              </div>
              
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Customer Name</mat-label>
                  <input matInput [(ngModel)]="loadData.customerName" placeholder="Enter customer name">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Origin Warehouse</mat-label>
                  <mat-select [(ngModel)]="loadData.originWarehouseId" (selectionChange)="onWarehouseChange($event.value)">
                    @for (wh of warehouses; track wh.id) {
                      <mat-option [value]="wh.id">
                        <span class="wh-option">{{ wh.name }} ({{ wh.code }})</span>
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Vehicle</mat-label>
                  <mat-select [(ngModel)]="loadData.vehicleId">
                    <mat-option [value]="null">-- Not Assigned --</mat-option>
                    @for (v of vehicles; track v.id) {
                      <mat-option [value]="v.id">{{ v.registrationNumber }} ({{ v.type }})</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Driver</mat-label>
                  <mat-select [(ngModel)]="loadData.driverId">
                    <mat-option [value]="null">-- Not Assigned --</mat-option>
                    @for (d of drivers; track d.id) {
                      <mat-option [value]="d.id">{{ d.firstName }} {{ d.lastName }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Scheduled Date</mat-label>
                  <input matInput [matDatepicker]="picker" [(ngModel)]="loadData.scheduledDate">
                  <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select [(ngModel)]="loadData.priority">
                    <mat-option value="Low">Low</mat-option>
                    <mat-option value="Normal">Normal</mat-option>
                    <mat-option value="High">High</mat-option>
                    <mat-option value="Urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              @if (selectedWarehouse) {
                <div class="warehouse-info">
                  <mat-icon>warehouse</mat-icon>
                  <span>{{ selectedWarehouse.address }}, {{ selectedWarehouse.city }} • Manager: {{ selectedWarehouse.managerName }}</span>
                </div>
              }
            </div>

            <!-- STEP 2: Stops -->
            <div class="form-section">
              <div class="section-header">
                <mat-icon>pin_drop</mat-icon>
                <span>Delivery Stops ({{ stops.length }})</span>
                <button mat-stroked-button color="primary" class="add-stop-btn" (click)="addStop()">
                  <mat-icon>add_location</mat-icon>
                  Add Stop
                </button>
              </div>

              @if (stops.length === 0) {
                <div class="no-stops">
                  <mat-icon>add_location_alt</mat-icon>
                  <p>No stops added yet. Click "Add Stop" to add delivery destinations.</p>
                </div>
              }

              <mat-accordion class="stops-accordion">
                @for (stop of stops; track stop.id; let i = $index) {
                  <mat-expansion-panel [expanded]="stop.expanded">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <div class="stop-title">
                          <span class="stop-number">Stop {{ i + 1 }}</span>
                          <span class="stop-address">{{ stop.address || 'No address set' }}</span>
                        </div>
                      </mat-panel-title>
                      <mat-panel-description>
                        <span class="stop-commodities-count">
                          {{ stop.commodities.length }} item(s)
                        </span>
                        <button mat-icon-button color="warn" (click)="removeStop(i, $event)" matTooltip="Remove stop">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </mat-panel-description>
                    </mat-expansion-panel-header>

                    <div class="stop-content">
                      <!-- Stop Address -->
                      <div class="stop-address-section">
                        <mat-form-field appearance="outline" class="full-width">
                          <mat-label>Delivery Address</mat-label>
                          <input matInput 
                                 [(ngModel)]="stop.address"
                                 [id]="'stop-address-' + stop.id"
                                 placeholder="Enter or search address...">
                          <mat-icon matSuffix>place</mat-icon>
                        </mat-form-field>

                        <div class="stop-details-grid">
                          <mat-form-field appearance="outline">
                            <mat-label>Company/Location Name</mat-label>
                            <input matInput [(ngModel)]="stop.companyName" placeholder="Optional">
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Contact Person</mat-label>
                            <input matInput [(ngModel)]="stop.contactPerson" placeholder="Optional">
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Contact Phone</mat-label>
                            <input matInput [(ngModel)]="stop.contactPhone" placeholder="Optional">
                          </mat-form-field>
                        </div>
                      </div>

                      <!-- Stop Commodities -->
                      <div class="stop-commodities-section">
                        <div class="commodities-header">
                          <span><mat-icon>inventory_2</mat-icon> Commodities for this stop</span>
                        </div>

                        @if (loadingInventory) {
                          <div class="loading-inventory">
                            <mat-spinner diameter="20"></mat-spinner>
                            <span>Loading inventory...</span>
                          </div>
                        } @else if (warehouseInventory.length > 0) {
                          <div class="commodity-picker">
                            @for (item of warehouseInventory; track item.commodityId) {
                              <div class="commodity-item" [class.selected]="isItemInStop(stop, item.commodityId)">
                                <div class="commodity-info">
                                  <strong>{{ item.commodityName }}</strong>
                                  <small>Stock: {{ item.quantityOnHand }} {{ item.unitOfMeasure }}</small>
                                </div>
                                <div class="commodity-actions">
                                  <mat-form-field appearance="outline" class="qty-input">
                                    <input matInput type="number" min="0" [max]="item.quantityOnHand"
                                           [value]="getStopQuantity(stop, item.commodityId)"
                                           (input)="updateStopQuantity(stop, item, $event)"
                                           placeholder="0">
                                  </mat-form-field>
                                </div>
                              </div>
                            }
                          </div>

                          @if (stop.commodities.length > 0) {
                            <div class="selected-for-stop">
                              <strong>Selected ({{ stop.commodities.length }}):</strong>
                              <div class="chips-row">
                                @for (c of stop.commodities; track c.commodityId) {
                                  <mat-chip (removed)="removeCommodityFromStop(stop, c.commodityId)">
                                    {{ c.commodityName }} × {{ c.quantity }}
                                    <mat-icon matChipRemove>cancel</mat-icon>
                                  </mat-chip>
                                }
                              </div>
                            </div>
                          }
                        } @else {
                          <div class="no-inventory-msg">
                            <mat-icon>inventory</mat-icon>
                            <span>Select an origin warehouse first</span>
                          </div>
                        }
                      </div>

                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Notes for this stop</mat-label>
                        <textarea matInput [(ngModel)]="stop.notes" rows="2" placeholder="Delivery instructions..."></textarea>
                      </mat-form-field>
                    </div>
                  </mat-expansion-panel>
                }
              </mat-accordion>
            </div>

            <!-- Summary -->
            @if (stops.length > 0) {
              <div class="form-section summary-section">
                <div class="section-header">
                  <mat-icon>summarize</mat-icon>
                  <span>Load Summary</span>
                </div>
                <div class="summary-grid">
                  <div class="summary-item">
                    <mat-icon>pin_drop</mat-icon>
                    <span>{{ stops.length }} Stop(s)</span>
                  </div>
                  <div class="summary-item">
                    <mat-icon>inventory_2</mat-icon>
                    <span>{{ getTotalCommodities() }} Commodity Type(s)</span>
                  </div>
                  <div class="summary-item">
                    <mat-icon>scale</mat-icon>
                    <span>{{ getTotalQuantity() }} Total Units</span>
                  </div>
                </div>
                
                <!-- Distance & Time Calculation -->
                <div class="distance-time-section">
                  <div class="section-subheader">
                    <mat-icon>schedule</mat-icon>
                    <span>Estimated Route & Time</span>
                    <button mat-stroked-button color="primary" class="calculate-btn" 
                            (click)="calculateRouteTime()" 
                            [disabled]="calculatingRoute">
                      @if (calculatingRoute) {
                        <mat-spinner diameter="18"></mat-spinner>
                      } @else {
                        <mat-icon>calculate</mat-icon>
                      }
                      Calculate
                    </button>
                  </div>
                  
                  @if (routeEstimate) {
                    <div class="route-estimate-grid">
                      <div class="estimate-item">
                        <mat-icon>straighten</mat-icon>
                        <div class="estimate-details">
                          <span class="estimate-value">{{ routeEstimate.totalDistance }} km</span>
                          <span class="estimate-label">Total Distance</span>
                        </div>
                      </div>
                      <div class="estimate-item">
                        <mat-icon>drive_eta</mat-icon>
                        <div class="estimate-details">
                          <span class="estimate-value">{{ routeEstimate.drivingTime }}</span>
                          <span class="estimate-label">Driving Time</span>
                        </div>
                      </div>
                      <div class="estimate-item">
                        <mat-icon>inventory</mat-icon>
                        <div class="estimate-details">
                          <span class="estimate-value">{{ routeEstimate.offloadTime }}</span>
                          <span class="estimate-label">Offload Time ({{ stops.length }}h)</span>
                        </div>
                      </div>
                      <div class="estimate-item total">
                        <mat-icon>timer</mat-icon>
                        <div class="estimate-details">
                          <span class="estimate-value">{{ routeEstimate.totalTime }}</span>
                          <span class="estimate-label">Total Estimated Time</span>
                        </div>
                      </div>
                    </div>
                    <div class="route-breakdown">
                      <small>Breakdown: {{ routeEstimate.breakdown }}</small>
                    </div>
                  } @else {
                    <div class="no-estimate">
                      <mat-icon>info</mat-icon>
                      <span>Click "Calculate" to estimate route distance and time</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Notes -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>General Notes</mat-label>
              <textarea matInput [(ngModel)]="loadData.notes" rows="2" placeholder="Additional notes for the entire load..."></textarea>
            </mat-form-field>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" 
                [disabled]="!canSubmit()"
                (click)="submitLoad()">
          <mat-icon>local_shipping</mat-icon>
          Create Load
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .load-dialog {
      width: 100%;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    .dialog-header button { color: white; }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      gap: 16px;
    }

    mat-dialog-content {
      padding: 16px 24px !important;
      max-height: 75vh;
      overflow-y: auto;
    }

    .load-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-section {
      background: #fafafa;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e0e0e0;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1976d2;
      font-weight: 500;
      font-size: 15px;
      margin-bottom: 12px;
    }

    .section-header mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .add-stop-btn {
      margin-left: auto;
      font-size: 12px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .form-grid mat-form-field {
      width: 100%;
    }

    .warehouse-info {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #e8f5e9;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      color: #2e7d32;
      margin-top: 8px;
    }

    .warehouse-info mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .no-stops {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      color: #999;
      text-align: center;
    }

    .no-stops mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
      color: #ccc;
    }

    .stops-accordion {
      margin-top: 8px;
    }

    .stop-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stop-number {
      background: #1976d2;
      color: white;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .stop-address {
      font-size: 13px;
      color: #666;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stop-commodities-count {
      font-size: 12px;
      color: #666;
      margin-right: 8px;
    }

    .stop-content {
      padding-top: 8px;
    }

    .stop-address-section {
      margin-bottom: 16px;
    }

    .stop-details-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 8px;
    }

    .stop-commodities-section {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .commodities-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      font-size: 13px;
      color: #555;
      margin-bottom: 12px;
    }

    .commodities-header mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .commodity-picker {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
    }

    .commodity-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #f5f5f5;
      border-radius: 6px;
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .commodity-item:hover {
      background: #eeeeee;
    }

    .commodity-item.selected {
      background: #e3f2fd;
      border-color: #1976d2;
    }

    .commodity-info {
      display: flex;
      flex-direction: column;
    }

    .commodity-info strong {
      font-size: 13px;
    }

    .commodity-info small {
      font-size: 11px;
      color: #666;
    }

    .qty-input {
      width: 70px;
    }

    .qty-input ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .qty-input ::ng-deep .mat-mdc-text-field-wrapper {
      padding: 0 8px;
    }

    .selected-for-stop {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
    }

    .selected-for-stop strong {
      font-size: 12px;
      color: #666;
    }

    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .chips-row mat-chip {
      font-size: 12px;
    }

    .loading-inventory {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: #666;
      font-size: 13px;
    }

    .no-inventory-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: #999;
      font-size: 13px;
    }

    .summary-section {
      background: #e3f2fd;
      border-color: #1976d2;
    }

    .summary-grid {
      display: flex;
      gap: 24px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #1565c0;
    }

    .summary-item mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Distance & Time Calculation Styles */
    .distance-time-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(25, 118, 210, 0.3);
    }

    .section-subheader {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      font-size: 14px;
      color: #1565c0;
      margin-bottom: 12px;
    }

    .section-subheader mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .calculate-btn {
      margin-left: auto;
      font-size: 12px;
    }

    .calculate-btn mat-spinner {
      margin-right: 4px;
    }

    .route-estimate-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 12px;
    }

    .estimate-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: white;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #bbdefb;
    }

    .estimate-item mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #1976d2;
    }

    .estimate-item.total {
      background: #1976d2;
      border-color: #1565c0;
    }

    .estimate-item.total mat-icon,
    .estimate-item.total .estimate-value,
    .estimate-item.total .estimate-label {
      color: white;
    }

    .estimate-details {
      display: flex;
      flex-direction: column;
    }

    .estimate-value {
      font-size: 16px;
      font-weight: 600;
      color: #1565c0;
    }

    .estimate-label {
      font-size: 11px;
      color: #666;
    }

    .route-breakdown {
      background: rgba(255, 255, 255, 0.7);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      color: #666;
    }

    .no-estimate {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 6px;
      color: #666;
      font-size: 13px;
    }

    .no-estimate mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #1976d2;
    }

    .full-width {
      width: 100%;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      gap: 12px;
    }

    mat-dialog-actions button mat-icon {
      margin-right: 4px;
    }
  `]
})
export class NewLoadDialogComponent implements OnInit, OnDestroy {
  loading = true;
  loadingInventory = false;
  calculatingRoute = false;
  routeEstimate: RouteEstimate | null = null;
  
  // Load basic info
  loadData = {
    customerName: '',
    originWarehouseId: null as number | null,
    vehicleId: null as number | null,
    driverId: null as number | null,
    scheduledDate: new Date(),
    priority: 'Normal',
    notes: ''
  };

  // Reference data
  warehouses: any[] = [];
  vehicles: any[] = [];
  drivers: any[] = [];
  selectedWarehouse: any = null;
  warehouseInventory: any[] = [];

  // Stops with commodities
  stops: LoadStop[] = [];
  private stopIdCounter = 1;

  private apiUrl = environment.apiUrl;

  constructor(
    public dialogRef: MatDialogRef<NewLoadDialogComponent>,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadReferenceData();
  }

  ngOnDestroy(): void {}

  private loadReferenceData(): void {
    // Load warehouses, vehicles, and drivers in parallel
    const warehouses$ = this.http.get<any[]>(this.apiUrl + '/warehouses').pipe(
      catchError(() => of(this.getFallbackWarehouses()))
    );
    const vehicles$ = this.http.get<any[]>(this.apiUrl + '/vehicles').pipe(
      catchError(() => of(this.getFallbackVehicles()))
    );
    const drivers$ = this.http.get<any[]>(this.apiUrl + '/drivers').pipe(
      catchError(() => of(this.getFallbackDrivers()))
    );

    forkJoin([warehouses$, vehicles$, drivers$]).subscribe({
      next: ([warehouses, vehicles, drivers]) => {
        this.warehouses = warehouses;
        this.vehicles = vehicles;
        this.drivers = drivers;
        this.loading = false;
      },
      error: () => {
        this.warehouses = this.getFallbackWarehouses();
        this.vehicles = this.getFallbackVehicles();
        this.drivers = this.getFallbackDrivers();
        this.loading = false;
      }
    });
  }

  private getFallbackWarehouses(): any[] {
    return [
      { id: 1, name: 'KZN Distribution Centre', code: 'WH-KZN', city: 'Durban', province: 'KwaZulu-Natal', address: '123 Industrial Road, Pinetown', managerName: 'John Dlamini' },
      { id: 2, name: 'Gauteng Main Warehouse', code: 'WH-GP', city: 'Johannesburg', province: 'Gauteng', address: '456 Logistics Park, Midrand', managerName: 'Sarah Mokwena' },
      { id: 3, name: 'Cape Town Hub', code: 'WH-WC', city: 'Cape Town', province: 'Western Cape', address: '789 Harbour Drive, Paarden Eiland', managerName: 'Michael van der Berg' },
      { id: 4, name: 'Eastern Cape Depot', code: 'WH-EC', city: 'Gqeberha', province: 'Eastern Cape', address: '321 Port Road, Gqeberha', managerName: 'Nomsa Hendricks' }
    ];
  }

  private getFallbackVehicles(): any[] {
    return [
      { id: 1, registrationNumber: 'GP 123-456', type: 'Truck' },
      { id: 2, registrationNumber: 'GP 789-012', type: 'Truck' },
      { id: 3, registrationNumber: 'KZN 111-222', type: 'Van' },
      { id: 4, registrationNumber: 'WC 333-444', type: 'Truck' }
    ];
  }

  private getFallbackDrivers(): any[] {
    return [
      { id: 1, firstName: 'John', lastName: 'Smith' },
      { id: 2, firstName: 'Mike', lastName: 'Johnson' },
      { id: 3, firstName: 'Peter', lastName: 'Nkosi' },
      { id: 4, firstName: 'James', lastName: 'van der Merwe' }
    ];
  }

  onWarehouseChange(warehouseId: number): void {
    this.selectedWarehouse = this.warehouses.find(w => w.id === warehouseId);
    // Clear commodities from all stops when warehouse changes
    this.stops.forEach(stop => stop.commodities = []);
    this.loadWarehouseInventory(warehouseId);
  }

  private loadWarehouseInventory(warehouseId: number): void {
    this.loadingInventory = true;
    this.http.get<any[]>(this.apiUrl + '/warehouses/' + warehouseId + '/inventory').subscribe({
      next: (inventory) => {
        this.warehouseInventory = inventory;
        this.loadingInventory = false;
      },
      error: () => {
        // Fallback inventory
        this.warehouseInventory = [
          { commodityId: 1, commodityName: 'Paracetamol 500mg', category: 'Pharmaceuticals', quantityOnHand: 2500, unitOfMeasure: 'Box' },
          { commodityId: 2, commodityName: 'Ibuprofen 400mg', category: 'Pharmaceuticals', quantityOnHand: 1800, unitOfMeasure: 'Box' },
          { commodityId: 3, commodityName: 'Surgical Gloves', category: 'Medical Supplies', quantityOnHand: 3500, unitOfMeasure: 'Box' },
          { commodityId: 4, commodityName: 'Face Masks N95', category: 'Medical Supplies', quantityOnHand: 5000, unitOfMeasure: 'Box' },
          { commodityId: 5, commodityName: 'Blood Pressure Monitor', category: 'Equipment', quantityOnHand: 85, unitOfMeasure: 'Unit' },
          { commodityId: 6, commodityName: 'Syringes 5ml', category: 'Medical Supplies', quantityOnHand: 10000, unitOfMeasure: 'Box' }
        ];
        this.loadingInventory = false;
      }
    });
  }

  // Stop management
  addStop(): void {
    const newStop: LoadStop = {
      id: this.stopIdCounter++,
      sequence: this.stops.length + 1,
      address: '',
      companyName: '',
      contactPerson: '',
      contactPhone: '',
      notes: '',
      commodities: [],
      expanded: true
    };
    // Collapse other stops
    this.stops.forEach(s => s.expanded = false);
    this.stops.push(newStop);
  }

  removeStop(index: number, event: Event): void {
    event.stopPropagation();
    this.stops.splice(index, 1);
    // Re-sequence
    this.stops.forEach((s, i) => s.sequence = i + 1);
  }

  // Commodity management for stops
  isItemInStop(stop: LoadStop, commodityId: number): boolean {
    return stop.commodities.some(c => c.commodityId === commodityId);
  }

  getStopQuantity(stop: LoadStop, commodityId: number): number {
    const item = stop.commodities.find(c => c.commodityId === commodityId);
    return item?.quantity || 0;
  }

  updateStopQuantity(stop: LoadStop, item: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    const qty = parseInt(input.value, 10) || 0;

    if (qty > 0 && qty <= item.quantityOnHand) {
      const existing = stop.commodities.find(c => c.commodityId === item.commodityId);
      if (existing) {
        existing.quantity = qty;
      } else {
        stop.commodities.push({
          commodityId: item.commodityId,
          commodityName: item.commodityName,
          quantity: qty,
          unitOfMeasure: item.unitOfMeasure
        });
      }
    } else if (qty === 0) {
      stop.commodities = stop.commodities.filter(c => c.commodityId !== item.commodityId);
    }
  }

  removeCommodityFromStop(stop: LoadStop, commodityId: number): void {
    stop.commodities = stop.commodities.filter(c => c.commodityId !== commodityId);
  }

  // Summary calculations
  getTotalCommodities(): number {
    const uniqueCommodities = new Set<number>();
    this.stops.forEach(stop => {
      stop.commodities.forEach(c => uniqueCommodities.add(c.commodityId));
    });
    return uniqueCommodities.size;
  }

  getTotalQuantity(): number {
    return this.stops.reduce((total, stop) => {
      return total + stop.commodities.reduce((stopTotal, c) => stopTotal + c.quantity, 0);
    }, 0);
  }

  canSubmit(): boolean {
    return !!(
      this.loadData.customerName &&
      this.loadData.originWarehouseId &&
      this.stops.length > 0 &&
      this.stops.every(s => s.address && s.commodities.length > 0)
    );
  }

  submitLoad(): void {
    if (this.canSubmit()) {
      // Build the load data structure for the API
      const loadPayload = {
        warehouseId: this.loadData.originWarehouseId,
        customerId: null, // Can be set if you have customer management
        vehicleId: this.loadData.vehicleId,
        driverId: this.loadData.driverId,
        priority: this.loadData.priority,
        scheduledPickupDate: this.loadData.scheduledDate,
        notes: this.loadData.notes,
        estimatedDistance: this.routeEstimate?.totalDistance,
        estimatedTime: this.routeEstimate?.totalTime,
        stops: [
          // Pickup stop (from warehouse)
          {
            stopSequence: 0,
            stopType: 'Pickup',
            warehouseId: this.loadData.originWarehouseId,
            address: this.selectedWarehouse?.address || '',
            city: this.selectedWarehouse?.city || '',
            companyName: this.selectedWarehouse?.name || '',
            commodities: []
          },
          // Delivery stops
          ...this.stops.map((stop, index) => ({
            stopSequence: index + 1,
            stopType: index === this.stops.length - 1 ? 'Destination' : 'Stop',
            address: stop.address,
            companyName: stop.companyName,
            contactPerson: stop.contactPerson,
            contactPhone: stop.contactPhone,
            notes: stop.notes,
            commodities: stop.commodities.map(c => ({
              commodityId: c.commodityId,
              quantity: c.quantity,
              unitOfMeasure: c.unitOfMeasure
            }))
          }))
        ]
      };

      this.dialogRef.close(loadPayload);
    }
  }

  // Route & Time Calculation
  calculateRouteTime(): void {
    if (this.stops.length === 0 || !this.selectedWarehouse) {
      return;
    }

    this.calculatingRoute = true;

    // Build waypoints for route calculation
    const origin = this.selectedWarehouse.address + ', ' + this.selectedWarehouse.city + ', South Africa';
    const destinations = this.stops.map(s => s.address).filter(a => a);

    if (destinations.length === 0) {
      this.calculatingRoute = false;
      return;
    }

    // Use Google Maps Distance Matrix API
    this.calculateDistanceWithGoogle(origin, destinations);
  }

  private calculateDistanceWithGoogle(origin: string, destinations: string[]): void {
    // Check if Google Maps is loaded
    if (typeof google === 'undefined' || !google.maps) {
      // Fallback to estimated calculation
      this.calculateEstimatedRoute(destinations);
      return;
    }

    const service = new (google.maps as any).DistanceMatrixService();
    
    // Build waypoints - origin to first stop, then stop to stop
    const allPoints = [origin, ...destinations];
    
    // Calculate segments
    const requests: Promise<number>[] = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      requests.push(this.getSegmentDistance(service, allPoints[i], allPoints[i + 1]));
    }

    Promise.all(requests).then(distances => {
      const totalDistanceMeters = distances.reduce((sum, d) => sum + d, 0);
      const totalDistanceKm = Math.round(totalDistanceMeters / 1000);
      
      // Average speed 80 km/h for trucks
      const drivingHours = totalDistanceKm / 80;
      const offloadHours = this.stops.length * 1; // 1 hour per stop
      const totalHours = drivingHours + offloadHours;

      this.routeEstimate = {
        totalDistance: totalDistanceKm,
        drivingTime: this.formatDuration(drivingHours),
        offloadTime: this.formatDuration(offloadHours),
        totalTime: this.formatDuration(totalHours),
        breakdown: `${this.formatDuration(drivingHours)} driving + ${offloadHours}h offloading (${this.stops.length} stops × 1h)`
      };

      this.calculatingRoute = false;
    }).catch(() => {
      this.calculateEstimatedRoute(destinations);
    });
  }

  private getSegmentDistance(service: any, origin: string, dest: string): Promise<number> {
    return new Promise((resolve, reject) => {
      service.getDistanceMatrix({
        origins: [origin],
        destinations: [dest],
        travelMode: (google.maps as any).TravelMode.DRIVING,
        unitSystem: (google.maps as any).UnitSystem.METRIC
      }, (response: any, status: any) => {
        if (status === 'OK' && response?.rows[0]?.elements[0]?.distance) {
          resolve(response.rows[0].elements[0].distance.value);
        } else {
          reject(new Error('Distance calculation failed'));
        }
      });
    });
  }

  private calculateEstimatedRoute(destinations: string[]): void {
    // Fallback: Estimate based on typical SA distances
    // Average inter-city distance estimate: 300km per major stop
    const estimatedDistancePerStop = 300;
    const totalDistanceKm = destinations.length * estimatedDistancePerStop;
    
    const drivingHours = totalDistanceKm / 80; // 80 km/h average
    const offloadHours = this.stops.length * 1;
    const totalHours = drivingHours + offloadHours;

    this.routeEstimate = {
      totalDistance: totalDistanceKm,
      drivingTime: this.formatDuration(drivingHours),
      offloadTime: this.formatDuration(offloadHours),
      totalTime: this.formatDuration(totalHours),
      breakdown: `${this.formatDuration(drivingHours)} driving + ${offloadHours}h offloading (${this.stops.length} stops × 1h) [Estimated]`
    };

    this.calculatingRoute = false;
  }

  private formatDuration(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
}

// Interface for stops
interface LoadStop {
  id: number;
  sequence: number;
  address: string;
  companyName: string;
  contactPerson: string;
  contactPhone: string;
  notes: string;
  commodities: { commodityId: number; commodityName: string; quantity: number; unitOfMeasure: string }[];
  expanded: boolean;
}

// Interface for route estimate
interface RouteEstimate {
  totalDistance: number;
  drivingTime: string;
  offloadTime: string;
  totalTime: string;
  breakdown: string;
}

// Trip Sheet Preview Dialog Component
@Component({
  selector: 'app-tripsheet-preview-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  template: `
    <div class="tripsheet-preview-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>description</mat-icon>
          Trip Sheet Preview
        </h2>
        <div class="header-actions">
          <button mat-icon-button (click)="print()" matTooltip="Print">
            <mat-icon>print</mat-icon>
          </button>
          <button mat-icon-button (click)="download()" matTooltip="Download PDF">
            <mat-icon>download</mat-icon>
          </button>
          <button mat-icon-button mat-dialog-close matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      @if (loading) {
        <div class="loading-content">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading trip sheet...</p>
        </div>
      } @else if (tripSheet) {
        <div class="tripsheet-content">
          <!-- Header Section -->
          <div class="ts-header">
            <div class="ts-logo">
              <mat-icon class="truck-icon">local_shipping</mat-icon>
              <span class="company-name">TRIP SHEET</span>
            </div>
            <div class="ts-badges">
              <mat-chip class="load-chip">{{ tripSheet.loadNumber }}</mat-chip>
              <mat-chip [ngClass]="getStatusClass(tripSheet.status)">{{ tripSheet.status }}</mat-chip>
              <mat-chip class="value-chip">R {{ tripSheet.totalValue | number:'1.2-2' }}</mat-chip>
            </div>
          </div>

          <mat-divider></mat-divider>

          <!-- Info Grid -->
          <div class="ts-info-grid">
            <div class="info-card">
              <h4><mat-icon>place</mat-icon> Pickup</h4>
              <p><strong>{{ tripSheet.warehouseName || 'Warehouse' }}</strong></p>
              <p>{{ tripSheet.pickupLocation }}</p>
              <p>{{ tripSheet.pickupDate | date:'dd MMM yyyy' }} {{ tripSheet.pickupTime || '' }}</p>
            </div>
            <div class="info-card">
              <h4><mat-icon>flag</mat-icon> Delivery</h4>
              <p><strong>{{ tripSheet.deliveryLocation || 'Multiple Stops' }}</strong></p>
              <p>Distance: {{ tripSheet.estimatedDistance | number:'1.0-0' }} km</p>
              <p>Est. Time: {{ formatMinutes(tripSheet.estimatedTimeMinutes) }}</p>
            </div>
            <div class="info-card">
              <h4><mat-icon>person</mat-icon> Driver</h4>
              <p><strong>{{ tripSheet.driverName }}</strong></p>
              <p>{{ tripSheet.driverPhone || 'No phone' }}</p>
              <p>License: {{ tripSheet.driverLicenseNumber || 'N/A' }}</p>
            </div>
            <div class="info-card">
              <h4><mat-icon>local_shipping</mat-icon> Vehicle</h4>
              <p><strong>{{ tripSheet.vehicleRegistration }}</strong></p>
              <p>{{ tripSheet.vehicleType || 'N/A' }}</p>
            </div>
          </div>

          @if (tripSheet.specialInstructions || tripSheet.notes) {
            <div class="ts-instructions">
              <mat-icon>warning</mat-icon>
              <span><strong>Instructions:</strong> {{ tripSheet.specialInstructions || tripSheet.notes }}</span>
            </div>
          }

          <!-- Stops Section -->
          <div class="ts-stops">
            <h3><mat-icon>route</mat-icon> Delivery Stops ({{ deliveryStops.length }})</h3>
            
            @for (stop of deliveryStops; track stop.stopSequence; let i = $index) {
              <div class="stop-card">
                <div class="stop-header">
                  <span class="stop-num">Stop {{ i + 1 }}</span>
                  <span class="stop-name">{{ stop.customerName || stop.companyName }}</span>
                  <mat-chip class="stop-type-chip">{{ stop.stopType }}</mat-chip>
                </div>
                <div class="stop-body">
                  <div class="stop-info">
                    <p><mat-icon>location_on</mat-icon> {{ stop.address }}, {{ stop.city }}</p>
                    @if (stop.contactPerson) {
                      <p><mat-icon>person</mat-icon> {{ stop.contactPerson }} - {{ stop.contactPhone }}</p>
                    }
                    @if (stop.orderNumber) {
                      <p><mat-icon>receipt</mat-icon> Order: {{ stop.orderNumber }}</p>
                    }
                  </div>
                  
                  @if (stop.commodities && stop.commodities.length > 0) {
                    <table class="commodities-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Contract</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th class="text-right">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (com of stop.commodities; track com.commodityName) {
                          <tr>
                            <td>{{ com.commodityName }}</td>
                            <td>{{ com.contractNumber || '-' }}</td>
                            <td>{{ com.quantity }}</td>
                            <td>{{ com.unitOfMeasure || 'Unit' }}</td>
                            <td class="text-right">R {{ com.totalPrice | number:'1.2-2' }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }
                  
                  @if (stop.notes) {
                    <p class="stop-notes"><mat-icon>info</mat-icon> {{ stop.notes }}</p>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Manual Entry Section -->
          <div class="ts-manual">
            <h4>Driver Record (Manual Entry)</h4>
            <div class="manual-fields">
              <div class="manual-field">
                <label>Opening Mileage</label>
                <div class="input-line"></div>
              </div>
              <div class="manual-field">
                <label>Closing Mileage</label>
                <div class="input-line"></div>
              </div>
              <div class="manual-field">
                <label>Fuel Level</label>
                <div class="fuel-options">E ☐ ¼ ☐ ½ ☐ ¾ ☐ F ☐</div>
              </div>
            </div>
          </div>

          <!-- Signature Section -->
          <div class="ts-signatures">
            <div class="signature-block">
              <div class="signature-line"></div>
              <span>Driver Signature & Date</span>
            </div>
            <div class="signature-block">
              <div class="signature-line"></div>
              <span>Dispatch Signature & Date</span>
            </div>
          </div>

          <div class="ts-footer">
            <p>Generated: {{ tripSheet.generatedAt | date:'dd MMM yyyy HH:mm' }}</p>
          </div>
        </div>
      } @else {
        <div class="error-content">
          <mat-icon>error_outline</mat-icon>
          <p>Failed to load trip sheet</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .tripsheet-preview-dialog {
      max-height: 85vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: #1976d2;
      color: white;
    }
    .dialog-header h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 20px;
    }
    .header-actions {
      display: flex;
      gap: 4px;
    }
    .header-actions button {
      color: white;
    }
    
    .loading-content, .error-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: #666;
    }
    .error-content mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #f44336;
    }
    
    .tripsheet-content {
      padding: 20px;
      overflow-y: auto;
      background: #fafafa;
    }
    
    .ts-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .ts-logo {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .truck-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: #1976d2;
    }
    .company-name {
      font-size: 24px;
      font-weight: 600;
      color: #1976d2;
    }
    .ts-badges {
      display: flex;
      gap: 8px;
    }
    .load-chip { background: #1976d2 !important; color: white !important; }
    .value-chip { background: #4caf50 !important; color: white !important; }
    
    .ts-info-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin: 20px 0;
    }
    .info-card {
      background: white;
      padding: 16px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .info-card h4 {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 12px 0;
      color: #1976d2;
      font-size: 13px;
    }
    .info-card h4 mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .info-card p {
      margin: 4px 0;
      font-size: 13px;
      color: #333;
    }
    
    .ts-instructions {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #fff3e0;
      border-radius: 8px;
      margin: 16px 0;
      color: #e65100;
    }
    
    .ts-stops {
      margin: 20px 0;
    }
    .ts-stops h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1976d2;
      margin-bottom: 16px;
    }
    
    .stop-card {
      background: white;
      border-radius: 8px;
      margin-bottom: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stop-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #1976d2;
      color: white;
    }
    .stop-num {
      font-weight: 600;
    }
    .stop-name {
      flex: 1;
    }
    .stop-type-chip {
      background: rgba(255,255,255,0.2) !important;
      color: white !important;
      font-size: 11px !important;
    }
    .stop-body {
      padding: 16px;
    }
    .stop-info p {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 4px 0;
      font-size: 13px;
    }
    .stop-info mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #666;
    }
    
    .commodities-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      font-size: 12px;
    }
    .commodities-table th {
      background: #e3f2fd;
      padding: 8px;
      text-align: left;
      font-weight: 600;
      color: #1565c0;
    }
    .commodities-table td {
      padding: 8px;
      border-bottom: 1px solid #eee;
    }
    .text-right {
      text-align: right;
    }
    
    .stop-notes {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      padding: 8px;
      background: #fff3e0;
      border-radius: 4px;
      font-size: 12px;
      font-style: italic;
      color: #e65100;
    }
    .stop-notes mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    
    .ts-manual {
      background: white;
      padding: 16px;
      border-radius: 8px;
      margin: 20px 0;
      border: 2px dashed #ccc;
    }
    .ts-manual h4 {
      margin: 0 0 16px 0;
      color: #666;
    }
    .manual-fields {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
    .manual-field label {
      display: block;
      font-weight: 600;
      margin-bottom: 8px;
      color: #666;
      font-size: 12px;
    }
    .input-line {
      border-bottom: 1px solid #999;
      height: 30px;
    }
    .fuel-options {
      font-size: 12px;
      color: #666;
    }
    
    .ts-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin: 30px 0;
    }
    .signature-block {
      text-align: center;
    }
    .signature-line {
      border-bottom: 1px solid #333;
      height: 50px;
      margin-bottom: 8px;
    }
    .signature-block span {
      font-size: 11px;
      color: #666;
    }
    
    .ts-footer {
      text-align: center;
      font-size: 11px;
      color: #999;
      padding-top: 16px;
      border-top: 1px solid #ddd;
    }
    
    .status-pending { background: #ff9800 !important; color: white !important; }
    .status-scheduled { background: #2196f3 !important; color: white !important; }
    .status-in-transit { background: #00bcd4 !important; color: white !important; }
    .status-delivered { background: #4caf50 !important; color: white !important; }
    
    @media (max-width: 768px) {
      .ts-info-grid {
        grid-template-columns: repeat(2, 1fr);
      }
      .manual-fields {
        grid-template-columns: 1fr;
      }
      .ts-signatures {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class TripSheetPreviewDialog implements OnInit {
  loading = true;
  tripSheet: any = null;
  deliveryStops: any[] = [];
  
  private apiUrl = environment.apiUrl;
  
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { loadId: number },
    private dialogRef: MatDialogRef<TripSheetPreviewDialog>,
    private http: HttpClient
  ) {}
  
  ngOnInit(): void {
    this.loadTripSheet();
  }
  
  loadTripSheet(): void {
    this.http.get<any>(`${this.apiUrl}/logistics/tripsheet/${this.data.loadId}`).subscribe({
      next: (ts) => {
        this.tripSheet = ts;
        // Filter out pickup stops, show only delivery stops
        this.deliveryStops = ts.stops?.filter((s: any) => s.stopType !== 'Pickup') || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load trip sheet:', err);
        this.loading = false;
      }
    });
  }
  
  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'scheduled': return 'status-scheduled';
      case 'in transit': case 'intransit': return 'status-in-transit';
      case 'delivered': case 'completed': return 'status-delivered';
      default: return '';
    }
  }
  
  formatMinutes(minutes: number | null): string {
    if (!minutes) return 'N/A';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
  
  print(): void {
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${this.data.loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 500);
        }
      }
    });
  }
  
  download(): void {
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${this.data.loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
          }, 500);
        }
      }
    });
  }
}

// Sync Result Dialog Component
@Component({
  selector: 'app-sync-result-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule
  ],
  template: `
    <div class="sync-result-dialog">
      <div class="dialog-header" [class.success]="data.success" [class.error]="!data.success">
        <mat-icon>{{ data.success ? 'check_circle' : 'error' }}</mat-icon>
        <h2>{{ data.success ? 'Sync Complete' : 'Sync Failed' }}</h2>
      </div>
      
      <div mat-dialog-content class="dialog-content">
        <p class="message">{{ data.message }}</p>
        
        @if (data.success) {
          <div class="stats-grid">
            <div class="stat-box vehicles">
              <div class="stat-value">{{ data.vehiclesCreated }}</div>
              <div class="stat-label">Vehicles Created</div>
            </div>
            <div class="stat-box vehicles">
              <div class="stat-value">{{ data.vehiclesUpdated }}</div>
              <div class="stat-label">Vehicles Updated</div>
            </div>
            <div class="stat-box drivers">
              <div class="stat-value">{{ data.driversCreated }}</div>
              <div class="stat-label">Drivers Created</div>
            </div>
            <div class="stat-box drivers">
              <div class="stat-value">{{ data.driversUpdated }}</div>
              <div class="stat-label">Drivers Found</div>
            </div>
          </div>
          
          <div class="total-info">
            <mat-icon>cloud_download</mat-icon>
            <span>{{ data.totalCarTrackVehicles }} vehicles retrieved from CarTrack</span>
          </div>
          
          @if (data.syncedVehicles && data.syncedVehicles.length > 0) {
            <details class="sync-details">
              <summary>View Synced Vehicles ({{ data.syncedVehicles.length }})</summary>
              <div class="sync-list">
                @for (v of data.syncedVehicles; track v) {
                  <mat-chip>{{ v }}</mat-chip>
                }
              </div>
            </details>
          }
          
          @if (data.syncedDrivers && data.syncedDrivers.length > 0) {
            <details class="sync-details">
              <summary>View Drivers ({{ data.syncedDrivers.length }})</summary>
              <div class="sync-list">
                @for (d of data.syncedDrivers; track d) {
                  <mat-chip>{{ d }}</mat-chip>
                }
              </div>
            </details>
          }
        }
      </div>
      
      <div mat-dialog-actions align="end">
        <button mat-raised-button color="primary" mat-dialog-close>Close</button>
      </div>
    </div>
  `,
  styles: [`
    .sync-result-dialog {
      min-width: 400px;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      margin: -24px -24px 0 -24px;
      border-radius: 4px 4px 0 0;
    }
    .dialog-header.success {
      background: #4caf50;
      color: white;
    }
    .dialog-header.error {
      background: #f44336;
      color: white;
    }
    .dialog-header mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .dialog-header h2 {
      margin: 0;
      font-size: 20px;
    }
    .dialog-content {
      padding-top: 20px;
    }
    .message {
      font-size: 14px;
      color: #666;
      margin-bottom: 20px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-box {
      text-align: center;
      padding: 16px;
      border-radius: 8px;
      background: #f5f5f5;
    }
    .stat-box.vehicles {
      background: #e3f2fd;
    }
    .stat-box.drivers {
      background: #e8f5e9;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #1976d2;
    }
    .stat-box.drivers .stat-value {
      color: #4caf50;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    .total-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fff3e0;
      border-radius: 8px;
      margin-bottom: 16px;
      color: #e65100;
    }
    .sync-details {
      margin-top: 12px;
    }
    .sync-details summary {
      cursor: pointer;
      font-weight: 500;
      color: #1976d2;
      margin-bottom: 8px;
    }
    .sync-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 150px;
      overflow-y: auto;
      padding: 8px;
      background: #fafafa;
      border-radius: 4px;
    }
    .sync-list mat-chip {
      font-size: 11px;
    }
  `]
})
export class SyncResultDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<SyncResultDialogComponent>
  ) {}
}

// Suggested Loads Dialog Component
@Component({
  selector: 'app-suggested-loads-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatBadgeModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>lightbulb</mat-icon> AI-Suggested Optimized Loads
    </h2>
    
    <mat-dialog-content>
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="50"></mat-spinner>
          <p>Analyzing pending invoices and optimizing routes...</p>
        </div>
      } @else if (suggestedLoads.length === 0) {
        <div class="empty-state">
          <mat-icon>info</mat-icon>
          <h3>No Suggestions Available</h3>
          <p>There are no pending invoices to create loads from.</p>
        </div>
      } @else {
        <div class="suggestions-summary">
          <mat-icon>analytics</mat-icon>
          <span>Found <strong>{{suggestedLoads.length}}</strong> optimized load configurations covering <strong>{{totalInvoices}}</strong> invoices</span>
        </div>

        <div class="suggested-loads-list">
          @for (load of suggestedLoads; track load.loadSequence) {
            <mat-card class="load-card" [class.selected]="selectedLoad === load">
              <mat-card-header>
                <div class="load-header">
                  <div class="load-title">
                    <h3>{{load.suggestedLoadNumber}}</h3>
                    <mat-chip-set>
                      <mat-chip [class]="'priority-' + load.priority.toLowerCase()">
                        {{load.priority}}
                      </mat-chip>
                      <mat-chip>Score: {{load.optimizationScore | number:'1.0-0'}}</mat-chip>
                    </mat-chip-set>
                  </div>
                  <button mat-raised-button color="primary" (click)="createLoad(load)">
                    <mat-icon>add</mat-icon> Create This Load
                  </button>
                </div>
              </mat-card-header>
              
              <mat-card-content>
                <div class="load-stats">
                  <div class="stat">
                    <mat-icon>location_on</mat-icon>
                    <div>
                      <strong>{{load.province}}</strong>
                      <span>{{load.primaryCity}}</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>people</mat-icon>
                    <div>
                      <strong>{{load.uniqueCustomers}}</strong>
                      <span>Customers</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>description</mat-icon>
                    <div>
                      <strong>{{load.totalInvoices}}</strong>
                      <span>Invoices</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>attach_money</mat-icon>
                    <div>
                      <strong>R{{load.totalValue | number:'1.2-2'}}</strong>
                      <span>Total Value</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>local_shipping</mat-icon>
                    <div>
                      <strong>{{load.recommendedVehicleType}}</strong>
                      <span>Vehicle Type</span>
                    </div>
                  </div>
                </div>

                <mat-accordion>
                  <mat-expansion-panel>
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>people</mat-icon>
                        Customers ({{load.customers.length}})
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <div class="customers-list">
                      @for (customer of load.customers; track customer.customerNumber) {
                        <div class="customer-item">
                          <div>
                            <strong>{{customer.customerName}}</strong>
                            <span class="customer-code">{{customer.customerNumber}}</span>
                          </div>
                          <div class="customer-details">
                            <span>{{customer.city}}</span>
                            <mat-chip>{{customer.invoiceCount}} invoice(s)</mat-chip>
                            <strong>R{{customer.totalAmount | number:'1.2-2'}}</strong>
                          </div>
                        </div>
                      }
                    </div>
                  </mat-expansion-panel>

                  <mat-expansion-panel>
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>list</mat-icon>
                        Invoices ({{load.invoices.length}})
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <div class="invoices-list">
                      @for (invoice of load.invoices; track invoice.invoiceId) {
                        <div class="invoice-item">
                          <span class="invoice-number">{{invoice.transactionNumber}}</span>
                          <span class="customer-name">{{invoice.customerName}}</span>
                          <span class="product">{{invoice.productDescription}}</span>
                          <strong>R{{invoice.amount | number:'1.2-2'}}</strong>
                        </div>
                      }
                    </div>
                  </mat-expansion-panel>
                </mat-accordion>

                <div class="load-notes">
                  <mat-icon>info</mat-icon>
                  <span>{{load.notes}}</span>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="close()">Close</button>
      <button mat-raised-button color="accent" (click)="createAllLoads()" [disabled]="loading || suggestedLoads.length === 0">
        <mat-icon>playlist_add</mat-icon> Create All Suggested Loads
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      max-height: 70vh;
      padding: 0 24px;
    }
    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      color: #666;
    }
    .loading-state mat-icon, .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      color: #1976d2;
    }
    .suggestions-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .suggestions-summary mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .suggested-loads-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .load-card {
      border-left: 4px solid #1976d2;
    }
    .load-card.selected {
      border-left-color: #4caf50;
      background: #f1f8e9;
    }
    .load-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 8px 0;
    }
    .load-title {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .load-title h3 {
      margin: 0;
      font-size: 18px;
    }
    mat-chip.priority-urgent {
      background: #f44336 !important;
      color: white !important;
    }
    mat-chip.priority-high {
      background: #ff9800 !important;
      color: white !important;
    }
    mat-chip.priority-normal {
      background: #4caf50 !important;
      color: white !important;
    }
    .load-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 16px 0;
    }
    .stat {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .stat mat-icon {
      color: #1976d2;
    }
    .stat div {
      display: flex;
      flex-direction: column;
    }
    .stat strong {
      font-size: 16px;
      color: #333;
    }
    .stat span {
      font-size: 12px;
      color: #666;
    }
    .customers-list, .invoices-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    .customer-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #fafafa;
      border-radius: 4px;
      border-left: 3px solid #2196f3;
    }
    .customer-code {
      margin-left: 8px;
      padding: 2px 8px;
      background: #e3f2fd;
      border-radius: 12px;
      font-size: 11px;
      color: #1976d2;
    }
    .customer-details {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
    }
    .invoice-item {
      display: grid;
      grid-template-columns: 120px 1fr 2fr 120px;
      gap: 12px;
      align-items: center;
      padding: 8px 12px;
      background: #fafafa;
      border-radius: 4px;
      font-size: 13px;
    }
    .invoice-number {
      font-weight: 600;
      color: #1976d2;
    }
    .customer-name {
      color: #666;
    }
    .product {
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .load-notes {
      display: flex;
      align-items: start;
      gap: 8px;
      padding: 12px;
      background: #e3f2fd;
      border-radius: 8px;
      margin-top: 16px;
      color: #1565c0;
      font-size: 14px;
    }
    .load-notes mat-icon {
      color: #1976d2;
      flex-shrink: 0;
    }
    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class SuggestedLoadsDialog implements OnInit {
  loading = true;
  suggestedLoads: any[] = [];
  selectedLoad: any = null;
  totalInvoices = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { apiUrl: string },
    private dialogRef: MatDialogRef<SuggestedLoadsDialog>,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    this.http.get<any[]>(`${this.data.apiUrl}/logistics/importedinvoices/suggested-loads`).subscribe({
      next: (loads) => {
        this.suggestedLoads = loads;
        this.totalInvoices = loads.reduce((sum, load) => sum + load.totalInvoices, 0);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load suggested loads:', err);
        alert('Failed to load suggestions: ' + (err.error?.message || err.message));
        this.loading = false;
      }
    });
  }

  createLoad(load: any): void {
    this.selectedLoad = load;
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
      invoiceIds: load.invoiceIds,
      notes: load.notes
    }).subscribe({
      next: (result) => {
        alert(`Load ${result.loadNumber} created successfully with ${result.stops} stops!`);
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Failed to create load:', err);
        alert('Failed to create load: ' + (err.error?.message || err.message));
        this.selectedLoad = null;
      }
    });
  }

  createAllLoads(): void {
    if (!confirm(`Create all ${this.suggestedLoads.length} suggested loads?`)) {
      return;
    }

    let completed = 0;
    const total = this.suggestedLoads.length;

    this.suggestedLoads.forEach((load, index) => {
      setTimeout(() => {
        this.http.post<any>(`${this.data.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
          invoiceIds: load.invoiceIds,
          notes: load.notes
        }).subscribe({
          next: (result) => {
            completed++;
            if (completed === total) {
              alert(`Successfully created all ${total} loads!`);
              this.dialogRef.close(true);
            }
          },
          error: (err) => {
            console.error('Failed to create load:', err);
            completed++;
            if (completed === total) {
              alert(`Created ${total - this.suggestedLoads.length} of ${total} loads. Some failed.`);
              this.dialogRef.close(true);
            }
          }
        });
      }, index * 500); // Stagger requests
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}

// TFN Orders List Dialog Component
@Component({
  selector: 'app-tfn-orders-list-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule
  ],
  template: `
    <div class="tfn-orders-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>local_gas_station</mat-icon>
          TFN Fuel Orders
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <div class="search-bar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search orders...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="filterOrders()" placeholder="Search by order number, vehicle, or status">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          <div class="order-count">
            <span class="count">{{ filteredOrders.length }}</span> orders
          </div>
        </div>

        <div class="orders-list">
          @for (order of filteredOrders; track order.orderNumber) {
            <div class="order-item" (click)="viewOrderDetails(order)">
              <div class="order-main">
                <div class="order-number">
                  <mat-icon>receipt</mat-icon>
                  {{ order.orderNumber }}
                </div>
                <div class="order-vehicle">
                  <mat-icon>directions_car</mat-icon>
                  {{ order.vehicleRegistration || order.vehicle?.registrationNumber || 'No Vehicle' }}
                </div>
              </div>
              <div class="order-details">
                <div class="detail">
                  <span class="label">Fuel Type:</span>
                  <span class="value">{{ getProductName(order.productCode) }}</span>
                </div>
                <div class="detail">
                  <span class="label">Allocated:</span>
                  <span class="value">{{ order.allocatedLitres | number:'1.0-0' }} L</span>
                </div>
                <div class="detail">
                  <span class="label">Virtual Card:</span>
                  <span class="value">{{ order.virtualCardNumber || 'N/A' }}</span>
                </div>
                <div class="detail">
                  <span class="label">Valid Until:</span>
                  <span class="value">{{ formatDate(order.expiryDate) || 'N/A' }}</span>
                </div>
              </div>
              <div class="order-meta">
                <span class="status" [class]="getStatusClass(order.status)">
                  {{ order.status || 'Pending' }}
                </span>
                <span class="date">{{ formatDate(order.orderDate) }}</span>
              </div>
              <mat-icon class="chevron">chevron_right</mat-icon>
            </div>
          } @empty {
            <div class="no-orders">
              <mat-icon>inbox</mat-icon>
              <p>No orders found</p>
            </div>
          }
        </div>
      </div>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .tfn-orders-dialog {
      width: 100%;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 32px;
      background: linear-gradient(135deg, #f093fb, #f5576c);
      color: white;
      margin: -24px -24px 0 -24px;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      font-weight: 500;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      padding: 24px 8px;
      max-height: 65vh;
      overflow-y: auto;
      overflow-x: hidden;
    }
    .search-bar {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 0 0 20px 0;
    }
    .search-field {
      flex: 1;
      max-width: 400px;
    }
    .order-count {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      background: #f5f5f5;
      border-radius: 20px;
      font-size: 14px;
      white-space: nowrap;
    }
    .order-count .count {
      font-weight: 600;
      color: #f5576c;
    }
    .orders-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .order-item {
      display: grid;
      grid-template-columns: 200px 1fr 140px 40px;
      gap: 24px;
      align-items: center;
      padding: 20px 24px;
      background: #fafafa;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      border-left: 4px solid #f5576c;
    }
    .order-item:hover {
      background: #f0f0f0;
      transform: translateX(4px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .order-main {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .order-number {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      font-size: 15px;
      color: #333;
    }
    .order-number mat-icon {
      color: #f5576c;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }
    .order-vehicle {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      font-size: 13px;
    }
    .order-vehicle mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }
    .order-details {
      display: grid;
      grid-template-columns: repeat(4, minmax(100px, 1fr));
      gap: 20px;
    }
    .detail {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .detail .label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail .value {
      font-size: 15px;
      color: #333;
      font-weight: 500;
    }
    .detail .value.highlight {
      color: #4caf50;
      font-weight: 600;
    }
    .order-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      min-width: 120px;
    }
    .status {
      padding: 6px 14px;
      border-radius: 14px;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
    }
    .status-active, .status-complete { background: #e8f5e9; color: #2e7d32; }
    .status-pending, .status-not-started { background: #fff3e0; color: #e65100; }
    .status-expired { background: #ffebee; color: #c62828; }
    .status-cancelled { background: #f5f5f5; color: #757575; }
    .date {
      font-size: 12px;
      color: #999;
      white-space: nowrap;
    }
    .chevron {
      color: #ccc;
      flex-shrink: 0;
    }
    .no-orders {
      text-align: center;
      padding: 60px;
      color: #999;
    }
    .no-orders mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      margin-bottom: 16px;
    }
    mat-dialog-actions {
      padding: 16px 32px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class TfnOrdersListDialog {
  searchTerm = '';
  filteredOrders: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { orders: any[], apiUrl: string },
    private dialogRef: MatDialogRef<TfnOrdersListDialog>,
    private dialog: MatDialog
  ) {
    this.filteredOrders = [...this.data.orders];
  }

  filterOrders(): void {
    const term = this.searchTerm.toLowerCase();
    if (!term) {
      this.filteredOrders = [...this.data.orders];
      return;
    }
    this.filteredOrders = this.data.orders.filter(order =>
      order.orderNumber?.toLowerCase().includes(term) ||
      order.vehicleRegistration?.toLowerCase().includes(term) ||
      order.vehicle?.registrationNumber?.toLowerCase().includes(term) ||
      order.status?.toLowerCase().includes(term) ||
      order.virtualCardNumber?.toLowerCase().includes(term)
    );
  }

  viewOrderDetails(order: any): void {
    this.dialog.open(TfnOrderDetailsDialog, {
      width: '95vw',
      maxWidth: '900px',
      panelClass: 'tfn-order-details-dialog-panel',
      data: { order }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getProductName(code: string): string {
    if (!code) return 'N/A';
    const products: {[key: string]: string} = {
      'D0': 'Diesel 50ppm',
      'D1': 'Diesel 500ppm',
      'P0': 'Petrol 93',
      'P1': 'Petrol 95',
      'F2': 'Diesel (F2)',
      'OS': 'On-Site',
      'DIESEL': 'Diesel',
      'PETROL': 'Petrol'
    };
    return products[code.toUpperCase()] || code;
  }

  getStatusClass(status: string): string {
    if (!status) return 'status-pending';
    const s = status.toLowerCase();
    if (s.includes('complete')) return 'status-complete';
    if (s.includes('active')) return 'status-active';
    if (s.includes('not started')) return 'status-not-started';
    if (s.includes('expired')) return 'status-expired';
    if (s.includes('cancel') || s.includes('delete')) return 'status-cancelled';
    return 'status-pending';
  }
}

// TFN Order Details Dialog Component
@Component({
  selector: 'app-tfn-order-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  template: `
    <div class="tfn-order-details-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>receipt_long</mat-icon>
          Order Details
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content" id="printableOrder">
        <div class="order-header">
          <div class="order-title">
            <h3>{{ data.order.orderNumber }}</h3>
            <span class="status" [class]="getStatusClass(data.order.status)">
              {{ data.order.status || 'Pending' }}
            </span>
          </div>
          <div class="order-dates">
            <div class="date-item">
              <mat-icon>event</mat-icon>
              <span>Order Date: {{ formatDate(data.order.orderDate) }}</span>
            </div>
            @if (data.order.expiryDate) {
              <div class="date-item">
                <mat-icon>event_busy</mat-icon>
                <span>Expires: {{ formatDate(data.order.expiryDate) }}</span>
              </div>
            }
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="section">
          <h4><mat-icon>directions_car</mat-icon> Vehicle Information</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Registration</span>
              <span class="value">{{ data.order.vehicleRegistration || data.order.vehicle?.registrationNumber || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <span class="label">Virtual Card</span>
              <span class="value">{{ data.order.virtualCardNumber || 'N/A' }}</span>
            </div>
          </div>
        </div>

        @if (data.order.driver) {
          <div class="section">
            <h4><mat-icon>person</mat-icon> Driver Information</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Driver Name</span>
                <span class="value">{{ data.order.driver?.driverName || 'N/A' }}</span>
              </div>
            </div>
          </div>
        }

        <mat-divider></mat-divider>

        <div class="section">
          <h4><mat-icon>local_gas_station</mat-icon> Fuel Allocation</h4>
          <div class="fuel-stats">
            <div class="fuel-stat">
              <div class="stat-circle allocated">
                <span class="value">{{ data.order.allocatedLitres | number:'1.0-0' }}</span>
                <span class="unit">L</span>
              </div>
              <span class="label">Allocated</span>
            </div>
            <div class="fuel-stat">
              <div class="stat-circle used">
                <span class="value">{{ data.order.usedLitres | number:'1.0-0' }}</span>
                <span class="unit">L</span>
              </div>
              <span class="label">Used</span>
            </div>
            <div class="fuel-stat">
              <div class="stat-circle remaining">
                <span class="value">{{ data.order.remainingLitres | number:'1.0-0' }}</span>
                <span class="unit">L</span>
              </div>
              <span class="label">Remaining</span>
            </div>
          </div>
          <div class="info-grid" style="margin-top: 16px;">
            <div class="info-item">
              <span class="label">Fuel Type</span>
              <span class="value">{{ getProductName(data.order.productCode) }}</span>
            </div>
            @if (data.order.allocatedAmount) {
              <div class="info-item">
                <span class="label">Allocated Amount</span>
                <span class="value">R {{ data.order.allocatedAmount | number:'1.2-2' }}</span>
              </div>
            }
            @if (data.order.usedAmount) {
              <div class="info-item">
                <span class="label">Used Amount</span>
                <span class="value">R {{ data.order.usedAmount | number:'1.2-2' }}</span>
              </div>
            }
            @if (data.order.remainingAmount) {
              <div class="info-item">
                <span class="label">Remaining Amount</span>
                <span class="value highlight">R {{ data.order.remainingAmount | number:'1.2-2' }}</span>
              </div>
            }
          </div>
        </div>

        @if (data.order.load) {
          <mat-divider></mat-divider>
          <div class="section">
            <h4><mat-icon>local_shipping</mat-icon> Linked Load</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Load Number</span>
                <span class="value">{{ data.order.load.loadNumber }}</span>
              </div>
            </div>
          </div>
        }

        @if (data.order.notes) {
          <mat-divider></mat-divider>
          <div class="section">
            <h4><mat-icon>notes</mat-icon> Notes</h4>
            <p class="notes-text">{{ data.order.notes }}</p>
          </div>
        }
      </div>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
        <button mat-raised-button color="primary" (click)="printOrder()">
          <mat-icon>print</mat-icon>
          Print
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .tfn-order-details-dialog {
      width: 100%;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 32px;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      margin: -24px -24px 0 -24px;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      font-weight: 500;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      padding: 28px 8px;
      overflow-x: hidden;
    }
    .order-header {
      margin-bottom: 24px;
    }
    .order-title {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
    }
    .order-title h3 {
      margin: 0;
      font-size: 24px;
      color: #333;
    }
    .status {
      padding: 6px 16px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
    }
    .status-active, .status-complete { background: #e8f5e9; color: #2e7d32; }
    .status-pending, .status-not-started { background: #fff3e0; color: #e65100; }
    .status-expired { background: #ffebee; color: #c62828; }
    .status-cancelled { background: #f5f5f5; color: #757575; }
    .order-dates {
      display: flex;
      gap: 24px;
    }
    .date-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      font-size: 14px;
    }
    .date-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .section {
      padding: 20px 0;
    }
    .section h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
      color: #333;
      font-size: 16px;
    }
    .section h4 mat-icon {
      color: #667eea;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .info-item .label {
      font-size: 12px;
      color: #999;
      text-transform: uppercase;
    }
    .info-item .value {
      font-size: 15px;
      color: #333;
      font-weight: 500;
    }
    .info-item .value.highlight {
      color: #4caf50;
      font-weight: 600;
    }
    .fuel-stats {
      display: flex;
      justify-content: space-around;
      gap: 24px;
    }
    .fuel-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .stat-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .stat-circle.allocated { background: linear-gradient(135deg, #667eea, #764ba2); }
    .stat-circle.used { background: linear-gradient(135deg, #f093fb, #f5576c); }
    .stat-circle.remaining { background: linear-gradient(135deg, #11998e, #38ef7d); }
    .stat-circle .value {
      font-size: 22px;
      font-weight: 600;
      line-height: 1;
    }
    .stat-circle .unit {
      font-size: 12px;
      opacity: 0.9;
    }
    .fuel-stat .label {
      font-size: 13px;
      color: #666;
    }
    .notes-text {
      margin: 0;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }
    mat-divider {
      margin: 0;
    }
    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
    @media print {
      .dialog-header button, mat-dialog-actions {
        display: none !important;
      }
      .dialog-header {
        background: #667eea !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .stat-circle {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `]
})
export class TfnOrderDetailsDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { order: any },
    private dialogRef: MatDialogRef<TfnOrderDetailsDialog>
  ) {}

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getProductName(code: string): string {
    if (!code) return 'N/A';
    const products: {[key: string]: string} = {
      'D0': 'Diesel 50ppm',
      'D1': 'Diesel 500ppm',
      'P0': 'Petrol 93',
      'P1': 'Petrol 95',
      'F2': 'Diesel (F2)',
      'OS': 'On-Site',
      'DIESEL': 'Diesel',
      'PETROL': 'Petrol'
    };
    return products[code.toUpperCase()] || code;
  }

  getStatusClass(status: string): string {
    if (!status) return 'status-pending';
    const s = status.toLowerCase();
    if (s.includes('complete')) return 'status-complete';
    if (s.includes('active')) return 'status-active';
    if (s.includes('not started')) return 'status-not-started';
    if (s.includes('expired')) return 'status-expired';
    if (s.includes('cancel') || s.includes('delete')) return 'status-cancelled';
    return 'status-pending';
  }

  printOrder(): void {
    const printContent = document.getElementById('printableOrder');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the order');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>TFN Order - ${this.data.order.orderNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .print-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #667eea;
          }
          .print-header h1 {
            color: #667eea;
            margin: 0 0 8px 0;
          }
          .print-header p {
            color: #666;
            margin: 0;
          }
          .order-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 8px;
          }
          .order-number {
            font-size: 24px;
            font-weight: bold;
            color: #333;
          }
          .order-status {
            padding: 8px 16px;
            border-radius: 20px;
            background: #e8f5e9;
            color: #2e7d32;
            font-weight: 500;
          }
          .section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
          }
          .section h3 {
            margin: 0 0 15px 0;
            color: #667eea;
            font-size: 16px;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 8px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px dashed #eee;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            color: #666;
          }
          .info-value {
            font-weight: 500;
            color: #333;
          }
          .fuel-summary {
            display: flex;
            justify-content: space-around;
            text-align: center;
            padding: 20px 0;
          }
          .fuel-item {
            padding: 15px 25px;
            background: #f5f5f5;
            border-radius: 8px;
          }
          .fuel-item .value {
            font-size: 28px;
            font-weight: bold;
            color: #667eea;
          }
          .fuel-item .label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
          }
          .print-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>TFN Fuel Order</h1>
          <p>ProMed Technologies - Logistics Department</p>
        </div>
        
        <div class="order-info">
          <span class="order-number">${this.data.order.orderNumber}</span>
          <span class="order-status">${this.data.order.status || 'Pending'}</span>
        </div>
        
        <div class="section">
          <h3>Order Information</h3>
          <div class="info-row">
            <span class="info-label">Order Date</span>
            <span class="info-value">${this.formatDate(this.data.order.orderDate)}</span>
          </div>
          ${this.data.order.expiryDate ? `
          <div class="info-row">
            <span class="info-label">Expiry Date</span>
            <span class="info-value">${this.formatDate(this.data.order.expiryDate)}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Fuel Type</span>
            <span class="info-value">${this.getProductName(this.data.order.productCode)}</span>
          </div>
        </div>
        
        <div class="section">
          <h3>Vehicle Information</h3>
          <div class="info-row">
            <span class="info-label">Registration</span>
            <span class="info-value">${this.data.order.vehicleRegistration || this.data.order.vehicle?.registrationNumber || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Virtual Card</span>
            <span class="info-value">${this.data.order.virtualCardNumber || 'N/A'}</span>
          </div>
          ${this.data.order.driver ? `
          <div class="info-row">
            <span class="info-label">Driver</span>
            <span class="info-value">${this.data.order.driver.driverName || 'N/A'}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="section">
          <h3>Fuel Allocation</h3>
          <div class="fuel-summary">
            <div class="fuel-item">
              <div class="value">${this.data.order.allocatedLitres || 0}</div>
              <div class="label">Allocated (L)</div>
            </div>
            <div class="fuel-item">
              <div class="value">${this.data.order.usedLitres || 0}</div>
              <div class="label">Used (L)</div>
            </div>
            <div class="fuel-item">
              <div class="value">${this.data.order.remainingLitres || 0}</div>
              <div class="label">Remaining (L)</div>
            </div>
          </div>
          ${this.data.order.allocatedAmount ? `
          <div class="info-row">
            <span class="info-label">Allocated Amount</span>
            <span class="info-value">R ${this.data.order.allocatedAmount?.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>
        
        ${this.data.order.notes ? `
        <div class="section">
          <h3>Notes</h3>
          <p>${this.data.order.notes}</p>
        </div>
        ` : ''}
        
        <div class="print-footer">
          <p>Printed on ${new Date().toLocaleString('en-ZA')}</p>
          <p>TFN Integration - ProMed Technologies Intranet</p>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}

// TFN Depots Map Dialog Component
@Component({
  selector: 'app-tfn-depots-map-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    FormsModule
  ],
  template: `
    <div class="tfn-depots-map-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>local_gas_station</mat-icon>
          TFN Fuel Depots
        </h2>
        <div class="depot-count">
          <span class="count">{{ filteredDepots.length }}</span> / {{ data.depots.length }} depots
        </div>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <div class="controls-bar">
          <mat-form-field appearance="outline" class="province-filter">
            <mat-label>Filter by Province</mat-label>
            <mat-select [(ngModel)]="selectedProvince" (selectionChange)="filterByProvince()">
              <mat-option value="all">All Provinces</mat-option>
              @for (province of provinces; track province.name) {
                <mat-option [value]="province.name">{{ province.name }} ({{ province.count }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
          
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search depots...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="filterDepots()" placeholder="Search by name">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <button mat-raised-button color="accent" (click)="loadTripSheets()" [disabled]="loadingTrips">
            @if (loadingTrips) {
              <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
            } @else {
              <mat-icon>route</mat-icon>
            }
            {{ loadingTrips ? 'Loading...' : 'Load Trip Sheets' }}
          </button>

          <button mat-stroked-button (click)="resetView()">
            <mat-icon>zoom_out_map</mat-icon>
            Reset View
          </button>

          @if (tripRoutes.length > 0) {
            <button mat-stroked-button color="warn" (click)="clearTripRoutes()">
              <mat-icon>clear</mat-icon>
              Clear Routes
            </button>
          }
        </div>

        @if (tripRoutes.length > 0) {
          <div class="trip-routes-bar">
            <span class="routes-label"><mat-icon>route</mat-icon> Trip Routes ({{ tripRoutes.length }}):</span>
            <div class="route-chips">
              @for (route of tripRoutes; track route.loadNumber) {
                <mat-chip [style.background-color]="route.color" 
                          [class.selected]="selectedRoute?.loadNumber === route.loadNumber"
                          (click)="focusRoute(route)">
                  {{ route.loadNumber }} - {{ route.stops.length }} stops
                </mat-chip>
              }
            </div>
            @if (nearestDepots.length > 0) {
              <div class="nearest-depots">
                <span class="nearest-label">Nearest Depots:</span>
                @for (nd of nearestDepots.slice(0, 5); track nd.depot.id) {
                  <span class="nearest-item" (click)="focusDepot(nd.depot)">
                    {{ nd.depot.name }} ({{ nd.distance | number:'1.1-1' }} km)
                  </span>
                }
              </div>
            }
          </div>
        }

        <div class="map-container">
          <div id="depotMap" class="depot-map"></div>
          <div class="zoom-controls">
            <button mat-mini-fab color="primary" (click)="zoomIn()" matTooltip="Zoom In">
              <mat-icon>add</mat-icon>
            </button>
            <button mat-mini-fab color="primary" (click)="zoomOut()" matTooltip="Zoom Out">
              <mat-icon>remove</mat-icon>
            </button>
          </div>
          @if (selectedRoute) {
            <div class="route-info-panel">
              <h4>{{ selectedRoute.loadNumber }}</h4>
              <p><strong>Driver:</strong> {{ selectedRoute.driverName || 'N/A' }}</p>
              <p><strong>Vehicle:</strong> {{ selectedRoute.vehicleReg || 'N/A' }}</p>
              <p><strong>Stops:</strong> {{ selectedRoute.stops.length }}</p>
              <p><strong>Distance:</strong> {{ selectedRoute.totalDistance | number:'1.0-0' }} km</p>
              <button mat-stroked-button (click)="selectedRoute = null">Close</button>
            </div>
          }
        </div>

        <div class="depot-list">
          <div class="list-header">
            <span>Depot List</span>
            <mat-icon (click)="toggleList()">{{ showList ? 'expand_less' : 'expand_more' }}</mat-icon>
          </div>
          @if (showList) {
            <div class="list-content">
              @for (depot of filteredDepots.slice(0, 20); track depot.id) {
                <div class="depot-item" (click)="focusDepot(depot)" [class.nearest]="isNearestDepot(depot)">
                  <mat-icon class="fuel-icon">local_gas_station</mat-icon>
                  <div class="depot-info">
                    <span class="depot-name">{{ depot.name }}</span>
                    <span class="depot-coords">{{ depot.latitude?.toFixed(4) }}, {{ depot.longitude?.toFixed(4) }}</span>
                  </div>
                  @if (isNearestDepot(depot)) {
                    <mat-icon class="nearest-badge" matTooltip="Near trip route">star</mat-icon>
                  }
                </div>
              }
              @if (filteredDepots.length > 20) {
                <div class="more-depots">+ {{ filteredDepots.length - 20 }} more depots</div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .tfn-depots-map-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #11998e, #38ef7d);
      color: white;
      margin: -24px -24px 0 -24px;
      gap: 16px;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      font-weight: 500;
      flex: 1;
    }
    .depot-count {
      padding: 8px 16px;
      background: rgba(255,255,255,0.2);
      border-radius: 20px;
      font-size: 14px;
    }
    .depot-count .count {
      font-weight: 600;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 16px 0;
      overflow: hidden;
    }
    .controls-bar {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 0 0 16px 0;
      flex-wrap: wrap;
    }
    .province-filter {
      min-width: 220px;
    }
    .search-field {
      flex: 1;
      min-width: 200px;
      max-width: 300px;
    }
    .map-container {
      flex: 1;
      min-height: 400px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      position: relative;
    }
    .depot-map {
      width: 100%;
      height: 100%;
      background: #e5e3df;
    }
    .zoom-controls {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 1000;
    }
    .zoom-controls button {
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .depot-list {
      margin-top: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      overflow: hidden;
    }
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #e0e0e0;
      font-weight: 500;
      cursor: pointer;
    }
    .list-header mat-icon {
      cursor: pointer;
    }
    .list-content {
      max-height: 150px;
      overflow-y: auto;
      padding: 8px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 8px;
    }
    .depot-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .depot-item:hover {
      background: #e8f5e9;
      transform: translateX(4px);
    }
    .fuel-icon {
      color: #11998e;
      font-size: 20px;
    }
    .depot-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .depot-name {
      font-weight: 500;
      font-size: 13px;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .depot-coords {
      font-size: 11px;
      color: #999;
    }
    .more-depots {
      padding: 10px;
      text-align: center;
      color: #666;
      font-size: 13px;
      grid-column: 1 / -1;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    .trip-routes-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .routes-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: white;
      font-weight: 500;
      font-size: 13px;
    }
    .routes-label mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .route-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .route-chips mat-chip {
      color: white !important;
      font-size: 12px;
      cursor: pointer;
      border: 2px solid transparent;
    }
    .route-chips mat-chip.selected {
      border-color: white;
      box-shadow: 0 0 8px rgba(255,255,255,0.5);
    }
    .nearest-depots {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-left: auto;
    }
    .nearest-label {
      color: rgba(255,255,255,0.8);
      font-size: 12px;
    }
    .nearest-item {
      background: rgba(255,255,255,0.2);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      color: white;
      cursor: pointer;
      transition: background 0.2s;
    }
    .nearest-item:hover {
      background: rgba(255,255,255,0.3);
    }
    .route-info-panel {
      position: absolute;
      bottom: 16px;
      left: 16px;
      background: white;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      min-width: 200px;
      z-index: 1000;
    }
    .route-info-panel h4 {
      margin: 0 0 12px 0;
      color: #667eea;
      font-size: 16px;
    }
    .route-info-panel p {
      margin: 4px 0;
      font-size: 13px;
      color: #666;
    }
    .route-info-panel button {
      margin-top: 12px;
      width: 100%;
    }
    .depot-item.nearest {
      background: #fff3e0;
      border-left: 3px solid #ff9800;
    }
    .depot-item.nearest:hover {
      background: #ffe0b2;
    }
    .nearest-badge {
      color: #ff9800;
      margin-left: auto;
    }
  `]
})
export class TfnDepotsMapDialog implements AfterViewInit, OnDestroy {
  selectedProvince = 'all';
  searchTerm = '';
  filteredDepots: any[] = [];
  showList = true;
  mapLoading = true;
  loadingTrips = false;
  tripRoutes: any[] = [];
  selectedRoute: any = null;
  nearestDepots: { depot: any; distance: number }[] = [];
  private map: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private routePolylines: google.maps.Polyline[] = [];
  private stopMarkers: google.maps.Marker[] = [];
  private infoWindow: google.maps.InfoWindow | null = null;
  private mapInitialized = false;
  private http: HttpClient;

  // Route colors for different trips
  private routeColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12',
    '#1abc9c', '#e91e63', '#00bcd4', '#ff5722', '#795548'
  ];

  // South African provinces with approximate bounding boxes
  provinces = [
    { name: 'Gauteng', bounds: { south: -26.5, west: 27.5, north: -25.5, east: 28.5 }, count: 0 },
    { name: 'Western Cape', bounds: { south: -34.5, west: 18.0, north: -31.5, east: 20.5 }, count: 0 },
    { name: 'KwaZulu-Natal', bounds: { south: -31.0, west: 29.0, north: -27.0, east: 32.5 }, count: 0 },
    { name: 'Eastern Cape', bounds: { south: -34.0, west: 24.0, north: -30.5, east: 30.0 }, count: 0 },
    { name: 'Mpumalanga', bounds: { south: -26.5, west: 29.0, north: -24.5, east: 32.0 }, count: 0 },
    { name: 'Limpopo', bounds: { south: -25.0, west: 27.0, north: -22.0, east: 31.5 }, count: 0 },
    { name: 'Free State', bounds: { south: -30.5, west: 25.0, north: -27.0, east: 29.5 }, count: 0 },
    { name: 'North West', bounds: { south: -27.5, west: 24.0, north: -25.0, east: 28.0 }, count: 0 },
    { name: 'Northern Cape', bounds: { south: -32.5, west: 17.0, north: -26.5, east: 25.0 }, count: 0 }
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { depots: any[] },
    private dialogRef: MatDialogRef<TfnDepotsMapDialog>,
    private injector: Injector
  ) {
    this.http = this.injector.get(HttpClient);
    this.filteredDepots = [...this.data.depots];
    this.calculateProvinceCounts();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.loadGoogleMapsScript(), 100);
  }

  ngOnDestroy(): void {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    this.routePolylines.forEach(p => p.setMap(null));
    this.routePolylines = [];
    this.stopMarkers.forEach(m => m.setMap(null));
    this.stopMarkers = [];
    if (this.infoWindow) {
      this.infoWindow.close();
    }
  }

  calculateProvinceCounts(): void {
    this.provinces.forEach(province => {
      province.count = this.data.depots.filter(depot => 
        this.isInProvince(depot, province)
      ).length;
    });
    // Sort by count descending
    this.provinces.sort((a, b) => b.count - a.count);
  }

  isInProvince(depot: any, province: any): boolean {
    if (!depot.latitude || !depot.longitude) return false;
    const { south, west, north, east } = province.bounds;
    return depot.latitude >= south && depot.latitude <= north &&
           depot.longitude >= west && depot.longitude <= east;
  }

  private loadGoogleMapsScript(): void {
    const apiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
    
    if (typeof google !== 'undefined' && google.maps) {
      this.initializeMap();
      return;
    }

    const callbackName = 'initTfnDepotsMap' + Date.now();
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + apiKey + '&callback=' + callbackName;
    script.async = true;
    script.defer = true;
    
    (window as any)[callbackName] = () => {
      this.initializeMap();
      delete (window as any)[callbackName];
    };
    
    document.head.appendChild(script);
  }

  private initializeMap(): void {
    if (this.mapInitialized) return;
    
    const mapElement = document.getElementById('depotMap');
    if (!mapElement) return;

    // Center on South Africa
    const defaultCenter = { lat: -28.5, lng: 25.5 };
    
    this.map = new google.maps.Map(mapElement, {
      zoom: 5,
      center: defaultCenter,
      mapTypeId: 'roadmap',
      mapTypeControl: true,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scaleControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    } as any);

    this.infoWindow = new google.maps.InfoWindow();
    this.mapInitialized = true;
    this.mapLoading = false;
    
    this.addDepotMarkers();
  }

  private getFuelIconSvg(): string {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
      '<circle cx="20" cy="20" r="18" fill="url(#grad)" stroke="white" stroke-width="2"/>' +
      '<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" style="stop-color:#11998e"/>' +
      '<stop offset="100%" style="stop-color:#38ef7d"/>' +
      '</linearGradient></defs>' +
      '<path d="M26.77 14.23l.01-.01-2.72-2.72L23 12.56l1.61 1.61c-.64.36-1.11.96-1.11 1.83a2 2 0 002 2c.36 0 .69-.1 1-.25v5.25c0 .55-.45 1-1 1s-1-.45-1-1V19c0-1.1-.9-2-2-2h-1V12c0-1.1-.9-2-2-2H14c-1.1 0-2 .9-2 2v14h8v-6h1v4a2 2 0 004 0v-8c0-.5-.2-.95-.53-1.27-.3-.3-.7-.5-1.2-.5zM18 16h-4v-4h4v4zm7 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="white"/>' +
      '</svg>'
    );
  }

  private createInfoContent(depot: any): string {
    let html = '<div style="padding: 8px; min-width: 220px;">';
    html += '<h4 style="margin: 0 0 10px 0; color: #11998e; font-size: 15px; border-bottom: 2px solid #11998e; padding-bottom: 6px;">' + depot.name + '</h4>';
    html += '<p style="margin: 4px 0; font-size: 12px; color: #666;">';
    html += '<strong>Coordinates:</strong> ' + depot.latitude.toFixed(4) + ', ' + depot.longitude.toFixed(4);
    html += '</p>';
    if (depot.address) {
      html += '<p style="margin: 4px 0; font-size: 12px;"><strong>Address:</strong> ' + depot.address + '</p>';
    }
    if (depot.city) {
      html += '<p style="margin: 4px 0; font-size: 12px;"><strong>City:</strong> ' + depot.city + '</p>';
    }
    html += '<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #eee;">';
    html += '<a href="https://www.google.com/maps/dir/?api=1&destination=' + depot.latitude + ',' + depot.longitude + '" target="_blank" style="color: #11998e; text-decoration: none; font-size: 12px; font-weight: 500;">Get Directions →</a>';
    html += '</div></div>';
    return html;
  }

  private addDepotMarkers(): void {
    if (!this.map) return;

    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    
    const bounds = new google.maps.LatLngBounds();
    let hasValidLocations = false;
    const fuelIcon = this.getFuelIconSvg();

    this.filteredDepots.forEach(depot => {
      if (depot.latitude && depot.longitude) {
        hasValidLocations = true;
        const position = { lat: depot.latitude, lng: depot.longitude };
        bounds.extend(position);

        const marker = new google.maps.Marker({
          position,
          map: this.map,
          title: depot.name,
          icon: {
            url: fuelIcon,
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18)
          }
        });

        (marker as any).depotData = depot;

        marker.addListener('click', () => {
          if (this.infoWindow && this.map) {
            this.infoWindow.setContent(this.createInfoContent(depot));
            this.infoWindow.open(this.map, marker);
          }
        });

        this.markers.push(marker);
      }
    });

    if (hasValidLocations && this.markers.length > 1) {
      this.map.fitBounds(bounds, 50);
    } else if (hasValidLocations && this.markers.length === 1) {
      this.map.setCenter(this.markers[0].getPosition()!);
      this.map.setZoom(14);
    }
  }

  filterByProvince(): void {
    if (this.selectedProvince === 'all') {
      this.filteredDepots = [...this.data.depots];
      this.resetView();
    } else {
      const province = this.provinces.find(p => p.name === this.selectedProvince);
      if (province) {
        this.filteredDepots = this.data.depots.filter(depot => 
          this.isInProvince(depot, province)
        );
        // Zoom to province
        if (this.map) {
          const { south, west, north, east } = province.bounds;
          const bounds = new google.maps.LatLngBounds(
            { lat: south, lng: west },
            { lat: north, lng: east }
          );
          this.map.fitBounds(bounds);
        }
      }
    }
    this.addDepotMarkers();
  }

  filterDepots(): void {
    const term = this.searchTerm.toLowerCase();
    let depots = this.selectedProvince === 'all' 
      ? [...this.data.depots]
      : this.data.depots.filter(depot => {
          const province = this.provinces.find(p => p.name === this.selectedProvince);
          return province ? this.isInProvince(depot, province) : true;
        });
    
    if (term) {
      depots = depots.filter(depot => 
        depot.name?.toLowerCase().includes(term)
      );
    }
    
    this.filteredDepots = depots;
    this.addDepotMarkers();
  }

  resetView(): void {
    this.selectedProvince = 'all';
    this.searchTerm = '';
    this.filteredDepots = [...this.data.depots];
    this.addDepotMarkers();
    if (this.map) {
      this.map.setCenter({ lat: -28.5, lng: 25.5 });
      this.map.setZoom(5);
    }
  }

  focusDepot(depot: any): void {
    if (this.map && depot.latitude && depot.longitude) {
      this.map.setCenter({ lat: depot.latitude, lng: depot.longitude });
      this.map.setZoom(14);
      // Find and open the marker info window
      const marker = this.markers.find(m => (m as any).depotData?.id === depot.id);
      if (marker && this.infoWindow) {
        this.infoWindow.setContent(this.createInfoContent(depot));
        this.infoWindow.open(this.map, marker);
      }
    }
  }

  zoomIn(): void {
    if (this.map) {
      const currentZoom = this.map.getZoom() || 5;
      this.map.setZoom(currentZoom + 1);
    }
  }

  zoomOut(): void {
    if (this.map) {
      const currentZoom = this.map.getZoom() || 5;
      this.map.setZoom(Math.max(currentZoom - 1, 3));
    }
  }

  toggleList(): void {
    this.showList = !this.showList;
  }

  // Trip Sheet Methods
  loadTripSheets(): void {
    this.loadingTrips = true;
    const apiUrl = environment.apiUrl;
    
    // Fetch loads with stops that have coordinates
    this.http.get<any[]>(`${apiUrl}/logistics/loads`).subscribe({
      next: (loads) => {
        // Filter loads that have stops with coordinates
        const routesWithCoords = loads
          .filter(load => load.stops && load.stops.length > 0)
          .map((load, index) => {
            // Get stops that have coordinates, sorted by sequence
            const stopsWithCoords = load.stops
              .filter((stop: any) => stop.latitude && stop.longitude)
              .sort((a: any, b: any) => a.stopSequence - b.stopSequence);
            
            return {
              loadId: load.id,
              loadNumber: load.loadNumber,
              driverName: load.driverName,
              vehicleReg: load.vehicleRegistration,
              status: load.status,
              totalDistance: load.estimatedDistance || 0,
              color: this.routeColors[index % this.routeColors.length],
              stops: stopsWithCoords.map((stop: any) => ({
                sequence: stop.stopSequence,
                name: stop.companyName || stop.locationName || stop.customerName || 'Stop',
                address: stop.address,
                city: stop.city,
                lat: stop.latitude,
                lng: stop.longitude,
                type: stop.stopType
              }))
            };
          })
          .filter(route => route.stops.length >= 2); // Need at least 2 points for a route

        this.tripRoutes = routesWithCoords;
        this.loadingTrips = false;
        
        if (routesWithCoords.length > 0) {
          this.drawAllRoutes();
          this.calculateNearestDepots();
        } else {
          console.log('No routes with coordinates found');
        }
      },
      error: (err) => {
        console.error('Failed to load trips:', err);
        this.loadingTrips = false;
      }
    });
  }

  private drawAllRoutes(): void {
    if (!this.map) return;

    // Clear existing route markers and polylines
    this.routePolylines.forEach(p => p.setMap(null));
    this.routePolylines = [];
    this.stopMarkers.forEach(m => m.setMap(null));
    this.stopMarkers = [];

    const bounds = new google.maps.LatLngBounds();

    this.tripRoutes.forEach(route => {
      if (route.stops.length < 2) return;

      const path = route.stops.map((stop: any) => ({
        lat: stop.lat,
        lng: stop.lng
      }));

      // Add all points to bounds
      path.forEach((point: any) => bounds.extend(point));

      // Draw the route line
      const polyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: route.color,
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: this.map
      });

      polyline.addListener('click', () => {
        this.selectedRoute = route;
      });

      this.routePolylines.push(polyline);

      // Add stop markers
      route.stops.forEach((stop: any, index: number) => {
        const isFirst = index === 0;
        const isLast = index === route.stops.length - 1;
        
        const marker = new google.maps.Marker({
          position: { lat: stop.lat, lng: stop.lng },
          map: this.map,
          title: stop.name,
          icon: {
            path: isFirst ? google.maps.SymbolPath.CIRCLE : (isLast ? google.maps.SymbolPath.BACKWARD_CLOSED_ARROW : google.maps.SymbolPath.CIRCLE),
            scale: isFirst || isLast ? 10 : 6,
            fillColor: isFirst ? '#4caf50' : (isLast ? '#f44336' : route.color),
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2
          },
          zIndex: isFirst || isLast ? 100 : 50
        });

        marker.addListener('click', () => {
          if (this.infoWindow && this.map) {
            const content = `
              <div style="padding: 8px; min-width: 180px;">
                <h4 style="margin: 0 0 8px 0; color: ${route.color};">${stop.name}</h4>
                <p style="margin: 4px 0; font-size: 12px;"><strong>Route:</strong> ${route.loadNumber}</p>
                <p style="margin: 4px 0; font-size: 12px;"><strong>Stop:</strong> ${index + 1} of ${route.stops.length}</p>
                <p style="margin: 4px 0; font-size: 12px;"><strong>Type:</strong> ${stop.type}</p>
                <p style="margin: 4px 0; font-size: 12px;">${stop.address}${stop.city ? ', ' + stop.city : ''}</p>
              </div>
            `;
            this.infoWindow.setContent(content);
            this.infoWindow.open(this.map, marker);
          }
        });

        this.stopMarkers.push(marker);
      });
    });

    // Fit map to show all routes
    if (this.tripRoutes.length > 0) {
      this.map.fitBounds(bounds, 50);
    }
  }

  private calculateNearestDepots(): void {
    if (this.tripRoutes.length === 0) {
      this.nearestDepots = [];
      return;
    }

    // Collect all route points
    const routePoints: { lat: number; lng: number }[] = [];
    this.tripRoutes.forEach(route => {
      route.stops.forEach((stop: any) => {
        routePoints.push({ lat: stop.lat, lng: stop.lng });
      });
    });

    // Calculate distance from each depot to the nearest route point
    const depotDistances = this.data.depots
      .filter(depot => depot.latitude && depot.longitude)
      .map(depot => {
        let minDistance = Infinity;
        routePoints.forEach(point => {
          const distance = this.calculateDistance(
            depot.latitude, depot.longitude,
            point.lat, point.lng
          );
          if (distance < minDistance) {
            minDistance = distance;
          }
        });
        return { depot, distance: minDistance };
      })
      .filter(item => item.distance < 50) // Within 50km of route
      .sort((a, b) => a.distance - b.distance);

    this.nearestDepots = depotDistances.slice(0, 10);
  }

  // Haversine formula to calculate distance between two points
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  clearTripRoutes(): void {
    this.routePolylines.forEach(p => p.setMap(null));
    this.routePolylines = [];
    this.stopMarkers.forEach(m => m.setMap(null));
    this.stopMarkers = [];
    this.tripRoutes = [];
    this.selectedRoute = null;
    this.nearestDepots = [];
  }

  focusRoute(route: any): void {
    this.selectedRoute = route;
    if (!this.map || route.stops.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    route.stops.forEach((stop: any) => {
      bounds.extend({ lat: stop.lat, lng: stop.lng });
    });
    this.map.fitBounds(bounds, 50);
  }

  isNearestDepot(depot: any): boolean {
    return this.nearestDepots.some(nd => nd.depot.id === depot.id);
  }
}

// Create Trip Sheet Dialog Component
@Component({
  selector: 'app-create-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTableModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatStepperModule,
    MatDividerModule,
    FormsModule,
    ReactiveFormsModule,
    CdkDrag,
    CdkDropList
  ],
  template: `
    <div class="create-tripsheet-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>add_road</mat-icon>
          Create Trip Sheet
        </h2>
        <div class="header-info">
          @if (selectedStops.length > 0) {
            <mat-chip class="stop-count">{{ selectedStops.length }} stops</mat-chip>
          }
          @if (totalDistance > 0) {
            <mat-chip class="distance-chip">{{ totalDistance | number:'1.0-0' }} km</mat-chip>
          }
        </div>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <mat-stepper #stepper linear>
          <!-- Step 1: Select Invoices/Stops -->
          <mat-step [completed]="selectedStops.length > 0" label="Select Stops">
            <div class="step-content">
              <div class="source-panel">
                <div class="panel-header">
                  <h3><mat-icon>receipt_long</mat-icon> Available Invoices ({{ filteredInvoices().length }})</h3>
                  <div class="filter-controls">
                    <mat-form-field appearance="outline" class="province-filter">
                      <mat-label>Province</mat-label>
                      <mat-select [(ngModel)]="selectedProvince" (selectionChange)="onProvinceChange()">
                        <mat-option value="all">All Provinces</mat-option>
                        @for (province of provinces; track province.code) {
                          <mat-option [value]="province.code">
                            {{ province.name }} ({{ getProvinceInvoiceCount(province.code) }})
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="search-field">
                      <mat-label>Search invoices...</mat-label>
                      <input matInput [(ngModel)]="invoiceSearch" placeholder="Customer, invoice #...">
                      <mat-icon matSuffix>search</mat-icon>
                    </mat-form-field>
                  </div>
                </div>
                @if (loadingProvinces) {
                  <div class="loading-provinces">
                    <mat-spinner diameter="24"></mat-spinner>
                    <span>Loading province data...</span>
                  </div>
                }
                <div class="invoice-list">
                  @for (invoice of filteredInvoices(); track invoice.id) {
                    <div class="invoice-item" 
                         [class.selected]="isInvoiceSelected(invoice)"
                         (click)="toggleInvoiceSelection(invoice)">
                      <mat-checkbox [checked]="isInvoiceSelected(invoice)" (click)="$event.stopPropagation()"></mat-checkbox>
                      <div class="invoice-info">
                        <span class="invoice-number">{{ invoice.transactionNumber }}</span>
                        <span class="customer-name">{{ invoice.customerName }}</span>
                        @if (invoice.province) {
                          <span class="province-badge" [class]="'province-' + invoice.province.toLowerCase()">
                            {{ invoice.province }}
                          </span>
                        }
                      </div>
                      <div class="invoice-details">
                        <span class="product">{{ invoice.productDescription | slice:0:30 }}...</span>
                        <span class="amount">R {{ invoice.salesAmount | number:'1.2-2' }}</span>
                        @if (invoice.city) {
                          <span class="city">{{ invoice.city }}</span>
                        }
                      </div>
                      <mat-icon class="add-icon">add_circle</mat-icon>
                    </div>
                  }
                  @if (filteredInvoices().length === 0) {
                    <div class="empty-list">
                      <mat-icon>inventory_2</mat-icon>
                      <p>No pending invoices found{{ selectedProvince !== 'all' ? ' in ' + getProvinceName(selectedProvince) : '' }}</p>
                    </div>
                  }
                </div>
              </div>

              <div class="stops-panel">
                <div class="panel-header">
                  <h3><mat-icon>pin_drop</mat-icon> Selected Stops ({{ selectedStops.length }})</h3>
                  @if (selectedStops.length > 0) {
                    <button mat-stroked-button (click)="clearAllStops()">
                      <mat-icon>clear_all</mat-icon> Clear All
                    </button>
                  }
                </div>
                <div class="stops-list" cdkDropList (cdkDropListDropped)="dropStop($event)">
                  @for (stop of selectedStops; track stop.id; let i = $index) {
                    <div class="stop-item" cdkDrag>
                      <div class="stop-drag-handle" cdkDragHandle>
                        <mat-icon>drag_indicator</mat-icon>
                      </div>
                      <div class="stop-sequence">{{ i + 1 }}</div>
                      <div class="stop-info">
                        <span class="stop-customer">{{ stop.customerName }}</span>
                        <span class="stop-address">{{ stop.address || 'No address' }}</span>
                        <span class="stop-invoice">{{ stop.transactionNumber }}</span>
                      </div>
                      <div class="stop-value">
                        R {{ stop.salesAmount | number:'1.2-2' }}
                      </div>
                      <button mat-icon-button (click)="removeStop(i)" matTooltip="Remove stop">
                        <mat-icon>remove_circle</mat-icon>
                      </button>
                    </div>
                  }
                  @if (selectedStops.length === 0) {
                    <div class="empty-stops">
                      <mat-icon>add_location</mat-icon>
                      <p>Select invoices from the left to add stops</p>
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="step-actions">
              <button mat-button mat-dialog-close>Cancel</button>
              <button mat-raised-button color="primary" matStepperNext [disabled]="selectedStops.length === 0">
                Next <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </mat-step>

          <!-- Step 2: Route Optimization & Details -->
          <mat-step [completed]="tripForm.valid" label="Route Details">
            <div class="step-content route-step">
              <div class="route-config">
                <h3><mat-icon>route</mat-icon> Route Configuration</h3>
                
                <div class="config-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Pickup Warehouse</mat-label>
                    <mat-select [(ngModel)]="selectedWarehouse">
                      @for (wh of data.warehouses; track wh.id) {
                        <mat-option [value]="wh">{{ wh.name }} - {{ wh.city }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Driver</mat-label>
                    <mat-select [(ngModel)]="selectedDriver">
                      <mat-option [value]="null">-- Unassigned --</mat-option>
                      @for (driver of data.drivers; track driver.id) {
                        <mat-option [value]="driver">{{ driver.firstName }} {{ driver.lastName }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Vehicle</mat-label>
                    <mat-select [(ngModel)]="selectedVehicle">
                      <mat-option [value]="null">-- Unassigned --</mat-option>
                      @for (vehicle of data.vehicles; track vehicle.id) {
                        <mat-option [value]="vehicle">{{ vehicle.registrationNumber }} - {{ vehicle.make }} {{ vehicle.model }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Scheduled Date</mat-label>
                    <input matInput [matDatepicker]="picker" [(ngModel)]="scheduledDate">
                    <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                    <mat-datepicker #picker></mat-datepicker>
                  </mat-form-field>
                </div>

                <div class="optimize-section">
                  <button mat-raised-button color="accent" (click)="optimizeRoute()" [disabled]="optimizing || selectedStops.length < 2" matTooltip="Optimize route order using Google Routes API">
                    @if (optimizing) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>alt_route</mat-icon>
                    }
                    {{ optimizing ? 'Optimizing...' : 'Optimize Route (Google)' }}
                  </button>
                  <button mat-stroked-button (click)="calculateDistance()" [disabled]="calculating" matTooltip="Calculate accurate distance using Google Routes API">
                    @if (calculating) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>straighten</mat-icon>
                    }
                    {{ calculating ? 'Calculating...' : 'Calculate Distance' }}
                  </button>
                  <button mat-stroked-button color="primary" (click)="advancedOptimization()" [disabled]="advancedOptimizing || selectedStops.length < 2" matTooltip="Advanced optimization considering time windows and vehicle capacity">
                    @if (advancedOptimizing) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>auto_awesome</mat-icon>
                    }
                    {{ advancedOptimizing ? 'Analyzing...' : 'Smart Optimize' }}
                  </button>
                  <button mat-stroked-button color="warn" (click)="calculateDistanceMatrix()" [disabled]="calculatingMatrix || selectedStops.length < 2" matTooltip="Calculate distances between all stops using Google Distance Matrix API">
                    @if (calculatingMatrix) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>grid_on</mat-icon>
                    }
                    {{ calculatingMatrix ? 'Calculating Matrix...' : 'Distance Matrix' }}
                  </button>
                </div>

                @if (optimizationMessage) {
                  <div class="optimization-message" [class.success]="optimizationSuccess" [class.error]="!optimizationSuccess">
                    <mat-icon>{{ optimizationSuccess ? 'check_circle' : 'warning' }}</mat-icon>
                    {{ optimizationMessage }}
                  </div>
                }

                @if (showDistanceMatrix && distanceMatrix.length > 0) {
                  <div class="distance-matrix-container">
                    <div class="matrix-header">
                      <h4><mat-icon>grid_on</mat-icon> Distance Matrix (km / min)</h4>
                      <button mat-icon-button (click)="toggleDistanceMatrix()" matTooltip="Hide matrix">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                    <div class="matrix-scroll">
                      <table class="distance-matrix">
                        <thead>
                          <tr>
                            <th class="label-cell"></th>
                            @for (label of distanceMatrixLabels; track label; let i = $index) {
                              <th class="header-cell" [matTooltip]="label">{{ i === 0 ? 'WH' : i }}</th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (row of distanceMatrix; track $index; let i = $index) {
                            <tr>
                              <td class="label-cell" [matTooltip]="distanceMatrixLabels[i]">{{ i === 0 ? 'WH' : i }}</td>
                              @for (cell of row; track $index; let j = $index) {
                                <td class="matrix-cell" [class.diagonal]="i === j" [matTooltip]="distanceMatrixLabels[i] + ' → ' + distanceMatrixLabels[j]">
                                  @if (i === j) {
                                    <span class="diagonal-marker">-</span>
                                  } @else {
                                    <span class="distance">{{ cell.distanceKm }}</span>
                                    <span class="duration">{{ cell.durationMin }}m</span>
                                  }
                                </td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                    <div class="matrix-legend">
                      <span>WH = Warehouse</span>
                      <span>Numbers = Stop sequence</span>
                      <span>Top row: km | Bottom row: minutes</span>
                    </div>
                  </div>
                }

                @if (totalDistance > 0) {
                  <div class="route-summary">
                    <div class="summary-item">
                      <mat-icon>straighten</mat-icon>
                      <span class="label">Total Distance:</span>
                      <span class="value">{{ totalDistance | number:'1.0-0' }} km</span>
                    </div>
                    <div class="summary-item">
                      <mat-icon>schedule</mat-icon>
                      <span class="label">Est. Drive Time:</span>
                      <span class="value">{{ estimatedTime }}</span>
                    </div>
                    <div class="summary-item">
                      <mat-icon>payments</mat-icon>
                      <span class="label">Total Value:</span>
                      <span class="value">R {{ totalValue | number:'1.2-2' }}</span>
                    </div>
                    @if (fuelEstimate > 0) {
                      <div class="summary-item">
                        <mat-icon>local_gas_station</mat-icon>
                        <span class="label">Est. Fuel:</span>
                        <span class="value">{{ fuelEstimate | number:'1.0-0' }} L (R {{ fuelCost | number:'1.2-2' }})</span>
                      </div>
                    }
                  </div>
                }

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Special Instructions</mat-label>
                  <textarea matInput [(ngModel)]="specialInstructions" rows="3" placeholder="Any special instructions for the driver..."></textarea>
                </mat-form-field>
              </div>

              <div class="route-map-preview">
                <h3><mat-icon>map</mat-icon> Route Preview</h3>
                <div id="tripsheetRouteMap" class="route-map"></div>
              </div>
            </div>

            <div class="step-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-raised-button color="primary" matStepperNext [disabled]="!selectedWarehouse">
                Next <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </mat-step>

          <!-- Step 3: Review & Generate -->
          <mat-step label="Review & Generate">
            <div class="step-content review-step">
              <div class="review-section">
                <h3><mat-icon>fact_check</mat-icon> Trip Sheet Summary</h3>
                
                <div class="review-grid">
                  <div class="review-card">
                    <h4><mat-icon>warehouse</mat-icon> Pickup</h4>
                    <p class="main-value">{{ selectedWarehouse?.name || 'Not selected' }}</p>
                    <p class="sub-value">{{ selectedWarehouse?.address }}</p>
                    <p class="sub-value">{{ scheduledDate | date:'EEEE, dd MMM yyyy' }}</p>
                  </div>
                  
                  <div class="review-card">
                    <h4><mat-icon>person</mat-icon> Driver</h4>
                    <p class="main-value">{{ selectedDriver ? selectedDriver.firstName + ' ' + selectedDriver.lastName : 'Unassigned' }}</p>
                    <p class="sub-value">{{ selectedDriver?.phoneNumber || '' }}</p>
                  </div>

                  <div class="review-card">
                    <h4><mat-icon>local_shipping</mat-icon> Vehicle</h4>
                    <p class="main-value">{{ selectedVehicle?.registrationNumber || 'Unassigned' }}</p>
                    <p class="sub-value">{{ selectedVehicle ? selectedVehicle.make + ' ' + selectedVehicle.model : '' }}</p>
                  </div>

                  <div class="review-card">
                    <h4><mat-icon>route</mat-icon> Route Info</h4>
                    <p class="main-value">{{ selectedStops.length }} stops</p>
                    <p class="sub-value">{{ totalDistance | number:'1.0-0' }} km • {{ estimatedTime }}</p>
                    <p class="sub-value">Total: R {{ totalValue | number:'1.2-2' }}</p>
                  </div>
                </div>

                <div class="stops-summary">
                  <h4><mat-icon>pin_drop</mat-icon> Delivery Stops</h4>
                  <table class="stops-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Invoice</th>
                        <th>Product</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (stop of selectedStops; track stop.id; let i = $index) {
                        <tr>
                          <td>{{ i + 1 }}</td>
                          <td>{{ stop.customerName }}</td>
                          <td>{{ stop.transactionNumber }}</td>
                          <td>{{ stop.productDescription | slice:0:25 }}...</td>
                          <td>R {{ stop.salesAmount | number:'1.2-2' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="step-actions final-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <div class="action-buttons">
                <button mat-raised-button (click)="previewPdf()" [disabled]="creating">
                  <mat-icon>preview</mat-icon> Preview PDF
                </button>
                <button mat-raised-button color="primary" (click)="createTripsheet()" [disabled]="creating">
                  @if (creating) {
                    <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                  } @else {
                    <mat-icon>check</mat-icon>
                  }
                  {{ creating ? 'Creating...' : 'Create & Download' }}
                </button>
              </div>
            </div>
          </mat-step>
        </mat-stepper>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .create-tripsheet-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      gap: 16px;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      font-weight: 500;
    }
    .header-info {
      display: flex;
      gap: 12px;
      flex: 1;
      justify-content: flex-end;
      margin-right: 16px;
    }
    .header-info mat-chip {
      background: rgba(255,255,255,0.2) !important;
      color: white !important;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      flex: 1;
      padding: 24px;
      overflow: auto;
    }
    .step-content {
      display: flex;
      gap: 24px;
      min-height: 400px;
      padding: 16px 0;
    }
    .source-panel, .stops-panel {
      flex: 1;
      background: #f5f5f5;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: white;
      border-bottom: 1px solid #e0e0e0;
    }
    .panel-header h3 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      color: #333;
    }
    .search-field {
      width: 250px;
    }
    .invoice-list, .stops-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .invoice-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: white;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
    }
    .invoice-item:hover {
      background: #e3f2fd;
    }
    .invoice-item.selected {
      border-color: #667eea;
      background: #ede7f6;
    }
    .invoice-info {
      display: flex;
      flex-direction: column;
      min-width: 150px;
      gap: 2px;
    }
    .invoice-number {
      font-weight: 600;
      color: #333;
      font-size: 13px;
    }
    .customer-name {
      font-size: 14px;
      color: #1976d2;
    }
    .province-badge {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
      display: inline-block;
      width: fit-content;
      text-transform: uppercase;
      background: #e0e0e0;
      color: #555;
    }
    .province-gp, .province-gauteng { background: #e3f2fd; color: #1565c0; }
    .province-kzn, .province-kwazulu-natal { background: #fff3e0; color: #ef6c00; }
    .province-wc, .province-western-cape { background: #e8f5e9; color: #2e7d32; }
    .province-ec, .province-eastern-cape { background: #fce4ec; color: #c2185b; }
    .province-mp, .province-mpumalanga { background: #f3e5f5; color: #7b1fa2; }
    .province-lp, .province-limpopo { background: #e0f2f1; color: #00695c; }
    .province-fs, .province-free-state { background: #fff8e1; color: #f9a825; }
    .province-nw, .province-north-west { background: #efebe9; color: #5d4037; }
    .province-nc, .province-northern-cape { background: #fbe9e7; color: #d84315; }
    .filter-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .province-filter {
      min-width: 180px;
    }
    .loading-provinces {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #e3f2fd;
      color: #1565c0;
      font-size: 13px;
    }
    .city {
      font-size: 11px;
      color: #888;
    }
    .invoice-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .product {
      font-size: 12px;
      color: #666;
    }
    .amount {
      font-weight: 600;
      color: #4caf50;
    }
    .add-icon {
      color: #667eea;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .invoice-item:hover .add-icon {
      opacity: 1;
    }
    .stop-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: white;
      border-radius: 8px;
      margin-bottom: 8px;
      border-left: 4px solid #667eea;
    }
    .stop-drag-handle {
      cursor: move;
      color: #999;
    }
    .stop-sequence {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #667eea;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 13px;
    }
    .stop-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .stop-customer {
      font-weight: 600;
      color: #333;
    }
    .stop-address {
      font-size: 12px;
      color: #666;
    }
    .stop-invoice {
      font-size: 11px;
      color: #999;
    }
    .stop-value {
      font-weight: 600;
      color: #4caf50;
    }
    .empty-list, .empty-stops {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }
    .empty-list mat-icon, .empty-stops mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }
    .step-actions {
      display: flex;
      justify-content: space-between;
      padding: 16px 0;
      border-top: 1px solid #e0e0e0;
      margin-top: 16px;
    }
    .route-step {
      flex-direction: column;
    }
    .route-config {
      flex: 1;
    }
    .route-config h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .config-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .optimize-section {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    .route-summary {
      display: flex;
      gap: 24px;
      padding: 16px;
      background: #e8f5e9;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .summary-item mat-icon {
      color: #4caf50;
    }
    .summary-item .label {
      color: #666;
    }
    .summary-item .value {
      font-weight: 600;
      color: #333;
    }
    .full-width {
      width: 100%;
    }
    .route-map-preview {
      margin-top: 20px;
    }
    .route-map-preview h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .route-map {
      height: 300px;
      border-radius: 12px;
      background: #e5e3df;
    }
    .review-step {
      flex-direction: column;
    }
    .review-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
    }
    .review-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .review-card {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 12px;
    }
    .review-card h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      color: #667eea;
      font-size: 14px;
    }
    .review-card .main-value {
      font-weight: 600;
      font-size: 16px;
      margin: 0;
    }
    .review-card .sub-value {
      font-size: 13px;
      color: #666;
      margin: 4px 0 0 0;
    }
    .stops-summary {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 12px;
    }
    .stops-summary h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
    }
    .stops-table {
      width: 100%;
      border-collapse: collapse;
    }
    .stops-table th, .stops-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    .stops-table th {
      background: #e0e0e0;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
    }
    .stops-table tr:hover {
      background: #f0f0f0;
    }
    .final-actions {
      justify-content: space-between;
    }
    .action-buttons {
      display: flex;
      gap: 12px;
    }
    .cdk-drag-preview {
      box-shadow: 0 5px 20px rgba(0,0,0,0.2);
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .optimization-message {
      padding: 12px 16px;
      border-radius: 8px;
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .optimization-message.success {
      background: #e8f5e9;
      color: #2e7d32;
      border: 1px solid #a5d6a7;
    }
    .optimization-message.error {
      background: #ffebee;
      color: #c62828;
      border: 1px solid #ef9a9a;
    }
    .optimization-message.pending {
      background: #e3f2fd;
      color: #1565c0;
      border: 1px solid #90caf9;
    }
    .fuel-estimate {
      padding: 8px 12px;
      background: #fff3e0;
      border-radius: 8px;
      border: 1px solid #ffcc80;
      color: #e65100;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .distance-matrix-container {
      margin-top: 16px;
      background: #fafafa;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      overflow: hidden;
    }
    .matrix-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #667eea;
      color: white;
    }
    .matrix-header h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .matrix-header button {
      color: white;
    }
    .matrix-scroll {
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
    }
    .distance-matrix {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .distance-matrix th, .distance-matrix td {
      padding: 6px 8px;
      text-align: center;
      border: 1px solid #e0e0e0;
      min-width: 60px;
    }
    .distance-matrix thead th {
      background: #f5f5f5;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .distance-matrix .label-cell {
      background: #f5f5f5;
      font-weight: 600;
      position: sticky;
      left: 0;
      z-index: 1;
      min-width: 40px;
    }
    .distance-matrix .header-cell {
      max-width: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .distance-matrix .matrix-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      background: white;
    }
    .distance-matrix .matrix-cell.diagonal {
      background: #e0e0e0;
    }
    .distance-matrix .matrix-cell .distance {
      font-weight: 600;
      color: #1976d2;
    }
    .distance-matrix .matrix-cell .duration {
      font-size: 10px;
      color: #666;
    }
    .distance-matrix .diagonal-marker {
      color: #999;
    }
    .matrix-legend {
      display: flex;
      gap: 24px;
      padding: 8px 16px;
      background: #f5f5f5;
      font-size: 11px;
      color: #666;
      border-top: 1px solid #e0e0e0;
    }
    @media (max-width: 1200px) {
      .config-grid, .review-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class CreateTripsheetDialog implements AfterViewInit, OnDestroy {
  invoiceSearch = '';
  selectedStops: any[] = [];
  selectedWarehouse: any = null;
  selectedDriver: any = null;
  selectedVehicle: any = null;
  scheduledDate = new Date();
  specialInstructions = '';
  selectedProvince = 'all';
  loadingProvinces = false;
  
  // Google Maps API key
  private readonly googleMapsApiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
  
  // Optimization state
  advancedOptimizing = false;
  optimizationMessage = '';
  optimizationSuccess = false;
  fuelEstimate = 0;
  fuelCost = 0;
  private readonly fuelPricePerLiter = 22.50; // ZAR
  private readonly avgFuelConsumption = 12; // L/100km for delivery truck
  
  // Distance Matrix state
  distanceMatrix: any[][] = [];
  distanceMatrixLabels: string[] = [];
  calculatingMatrix = false;
  showDistanceMatrix = false;
  
  // South African provinces
  provinces = [
    { code: 'GP', name: 'Gauteng' },
    { code: 'KZN', name: 'KwaZulu-Natal' },
    { code: 'WC', name: 'Western Cape' },
    { code: 'EC', name: 'Eastern Cape' },
    { code: 'MP', name: 'Mpumalanga' },
    { code: 'LP', name: 'Limpopo' },
    { code: 'FS', name: 'Free State' },
    { code: 'NW', name: 'North West' },
    { code: 'NC', name: 'Northern Cape' }
  ];
  
  // Province keywords for address matching (expanded with more SA cities/towns and hospitals)
  private provinceKeywords: { [key: string]: string[] } = {
    'GP': ['gauteng', 'johannesburg', 'pretoria', 'sandton', 'randburg', 'centurion', 'midrand', 'soweto', 'benoni', 'boksburg', 'germiston', 'edenvale', 'alberton', 'kempton park', 'roodepoort', 'krugersdorp', 'vanderbijlpark', 'vereeniging', 'springs', 'nigel', 'bronkhorstspruit', 'fourways', 'bedfordview', 'modderfontein', 'isando', 'spartan', 'jet park', 'elandsfontein', 'tshwane', 'doornpoort', 'wonderboom', 'lyttelton', 'irene', 'hatfield', 'arcadia', 'sunnyside', 'menlyn', 'brooklyn', 'pholosong', 'tembisa', 'thelle mogoerane', 'natalspruit', 'far east rand', 'kalafong', 'steve biko', 'dr george mukhari', 'charlotte maxeke', 'chris hani baragwanath', 'helen joseph', 'rahima moosa', 'leratong', 'bheki mlangeni', 'kopanong', 'sebokeng', 'heidelberg', 'carletonville', '08-gp', 'gp1-', 'gp2-', 'gp-'],
    'KZN': ['kwazulu-natal', 'kwazulu natal', 'durban', 'pietermaritzburg', 'newcastle', 'richards bay', 'ladysmith', 'ballito', 'umhlanga', 'pinetown', 'westville', 'amanzimtoti', 'scottburgh', 'port shepstone', 'margate', 'tongaat', 'stanger', 'empangeni', 'eshowe', 'vryheid', 'verulam', 'phoenix', 'chatsworth', 'umlazi', 'kingsburgh', 'hillcrest', 'kloof', 'greytown', 'estcourt', 'mooi river', 'dundee', 'glencoe', 'dannhauser', 'utrecht', 'paulpietersburg', 'nongoma', 'ulundi', 'mtubatuba', 'hluhluwe', 'jozini', 'ingwavuma', 'kokstad', 'ixopo', 'harding', 'mount edgecombe', 'umkomaas', 'warner beach', 'hibberdene', 'pennington', 'umzinto', 'shelley beach', 'uvongo', 'ramsgate', 'southbroom', 'umtentweni', 'ozwatini', 'canelands', 'darnall', 'dalbridge', 'umbilo', 'wentworth', 'king cetshwayo', 'harry gwala', 'edendale', 'grey', 'g.j crookes', 'gj crookes', 'gjgm', 'mseleni', 'st margarets', 'ugu', 'ilembe', 'king dinuzulu', 'umgeni', 'inkosi albert luthuli', 'addington', 'prince mshiyeni', 'mahatma gandhi', 'r k khan', 'northdale', 'greys', 'edendale', '01-', 'kzn-'],
    'WC': ['western cape', 'cape town', 'stellenbosch', 'paarl', 'george', 'knysna', 'mossel bay', 'worcester', 'bellville', 'somerset west', 'strand', 'hermanus', 'franschhoek', 'wellington', 'malmesbury', 'saldanha', 'vredenburg', 'montagu', 'robertson', 'oudtshoorn', 'beaufort west', 'atlantis', 'milnerton', 'parow', 'goodwood', 'epping', 'durbanville', 'brackenfell', 'kraaifontein', 'kuilsriver', 'eerste river', 'mitchells plain', 'grassy park', 'retreat', 'fish hoek', 'simons town', 'muizenberg', 'tokai', 'constantia', 'camps bay', 'sea point', 'green point', 'waterfront', 'woodstock', 'observatory', 'rondebosch', 'newlands', 'claremont', 'kenilworth', 'wynberg', 'plumstead', 'diep river', 'groote schuur', 'tygerberg', 'red cross', 'khayelitsha', 'mitchells plain', '05-', 'wc-'],
    'EC': ['eastern cape', 'port elizabeth', 'gqeberha', 'east london', 'mthatha', 'uitenhage', 'grahamstown', 'makhanda', 'queenstown', 'king williams town', 'jeffreys bay', 'despatch', 'cradock', 'graaff-reinet', 'aliwal north', 'fort beaufort', 'bisho', 'bhisho', 'mdantsane', 'zwelitsha', 'alice', 'fort hare', 'stutterheim', 'komani', 'dordrecht', 'lady frere', 'cofimvaba', 'engcobo', 'ngcobo', 'libode', 'flagstaff', 'lusikisiki', 'port st johns', 'willowvale', 'centane', 'butterworth', 'idutywa', 'gcuwa', 'dutywa', 'willowmore', 'aberdeen', 'middelburg ec', 'steytlerville', 'humansdorp', 'st francis', 'colchester', 'addo', 'paterson', 'nanaga', 'kirkwood', 'sundays river', 'bathurst', 'port alfred', 'kenton', 'lukhanji', 'frere', 'cecilia makiwane', 'dora nginza', 'livingstone', 'settlers', 'frontier', 'nelson mandela bay', '06-', 'ec-', 'ech-'],
    'MP': ['mpumalanga', 'nelspruit', 'mbombela', 'witbank', 'emalahleni', 'middelburg', 'secunda', 'ermelo', 'standerton', 'barberton', 'white river', 'hazyview', 'piet retief', 'bethal', 'lydenburg', 'sabie', 'graskop', 'komatipoort', 'malelane', 'kaapmuiden', 'matsulu', 'kabokweni', 'kanyamazane', 'nsikazi', 'bushbuckridge', 'acornhoek', 'hoedspruit', 'phalaborwa mp', 'delmas', 'ogies', 'kriel', 'trichardt', 'evander', 'leandra', 'kinross', 'charl cilliers', 'morgenzon', 'volksrust', 'wakkerstroom', 'amsterdam', 'carolina', 'badplaas', 'chrissiesmeer', 'dullstroom', 'machadodorp', 'waterval boven', 'waterval onder', 'schoemanskloof', 'rob ferreira', 'themba', 'mapulaneng', 'matikwana', 'shongwe', 'tintswalo', 'mmametlhake', '09-', 'mp-'],
    'LP': ['limpopo', 'polokwane', 'pietersburg', 'tzaneen', 'louis trichardt', 'makhado', 'thohoyandou', 'mokopane', 'potgietersrus', 'phalaborwa', 'bela-bela', 'warmbaths', 'modimolle', 'nylstroom', 'lephalale', 'ellisras', 'musina', 'messina', 'groblersdal', 'lebowakgomo', 'seshego', 'mankweng', 'turfloop', 'burgersfort', 'steelpoort', 'jane furse', 'nebo', 'marble hall', 'roedtan', 'settlers', 'naboomspruit', 'mookgophong', 'vaalwater', 'thabazimbi', 'northam', 'gilead', 'senwabarwana', 'bochum', 'dendron', 'botlokwa', 'morebeng', 'soekmekaar', 'duiwelskloof', 'modjadjiskloof', 'giyani', 'malamulele', 'elim', 'levubu', 'sibasa', 'vuwani', 'mutale', 'masisi', 'alldays', 'waterpoort', 'vivo', 'mara', 'namakgale', 'hoedspruit', 'maphutha malatji', 'letaba', 'st ritas', 'voortrekker', 'mokopane', 'tshilidzini', 'donald fraser', 'elim', 'louis trichardt', 'siloam', 'lppd', '02-', 'lp-'],
    'FS': ['free state', 'bloemfontein', 'welkom', 'bethlehem', 'kroonstad', 'sasolburg', 'parys', 'phuthaditjhaba', 'harrismith', 'virginia', 'bothaville', 'ladybrand', 'ficksburg', 'zastron', 'mangaung', 'botshabelo', 'thaba nchu', 'dewetsdorp', 'wepener', 'hobhouse', 'senekal', 'marquard', 'clocolan', 'fouriesburg', 'clarens', 'golden gate', 'paul roux', 'rosendal', 'memel', 'vrede', 'frankfort', 'villiers', 'cornelia', 'reitz', 'lindley', 'heilbron', 'petrus steyn', 'edenville', 'steynsrus', 'hennenman', 'ventersburg', 'theunissen', 'brandfort', 'winburg', 'verkeerdevlei', 'soutpan', 'bultfontein', 'wesselsbron', 'hoopstad', 'dealesville', 'boshof', 'hertzogville', 'jacobsdal', 'koffiefontein', 'jagersfontein', 'fauresmith', 'trompsburg', 'philippolis', 'springfontein', 'edenburg', 'reddersburg', 'excelsior', 'tweespruit', 'pelonomi', 'universitas', 'national', 'boitumelo', 'bongani', 'dihlabeng', 'fsh-', 'fs health', '04-'],
    'NW': ['north west', 'rustenburg', 'potchefstroom', 'klerksdorp', 'mafikeng', 'mahikeng', 'brits', 'hartbeespoort', 'vryburg', 'lichtenburg', 'orkney', 'stilfontein', 'zeerust', 'koster', 'coligny', 'mogwase', 'sun city', 'pilanesberg', 'phokeng', 'tlhabane', 'moruleng', 'swartruggens', 'groot marico', 'madibogo', 'mmabatho', 'montshioa', 'rooigrond', 'stella', 'schweizer-reneke', 'bloemhof', 'christiana', 'warrenton', 'jan kempdorp', 'pampierstad', 'hartswater', 'taung', 'ventersdorp', 'tlokwe', 'potch', 'mooirivier', 'fochville', 'carletonville', 'westonaria', 'merafong', 'oberholzer', 'randfontein', 'mogale', 'kagiso', 'munsieville', 'mooinooi', 'marikana', 'job shimankana', 'tshepong', 'klerksdorp', 'potchefstroom', '03-', 'nw-'],
    'NC': ['northern cape', 'kimberley', 'upington', 'springbok', 'kathu', 'de aar', 'kuruman', 'colesberg', 'carnarvon', 'calvinia', 'port nolloth', 'sutherland', 'prieska', 'victoria west', 'hanover', 'richmond', 'middelburg nc', 'graaff reinet', 'nieu bethesda', 'graaf reinet', 'britstown', 'hopetown', 'strydenburg', 'petrusville', 'philipstown', 'douglas', 'griekwastad', 'campbell', 'danielskuil', 'postmasburg', 'olifantshoek', 'hotazel', 'black rock', 'sishen', 'dingleton', 'askham', 'mier', 'rietfontein', 'noenieput', 'twee rivieren', 'nababeep', 'okiep', 'concordia', 'bulletrap', 'komaggas', 'steinkopf', 'vioolsdrif', 'pofadder', 'aggeneys', 'pella', 'onseepkans', 'kakamas', 'keimoes', 'kenhardt', 'brandvlei', 'vanwyksvlei', 'loeriesfontein', 'nieuwoudtville', 'garies', 'kamieskroon', 'hondeklipbaai', 'robert mangaliso', 'pixley ka seme', 'pixley ke seme', 'nc health', 'nch-', '07-']
  };
  
  // Cache for customer provinces
  private customerProvinceCache: Map<string, { province: string, city: string }> = new Map();
  
  totalDistance = 0;
  estimatedTime = '';
  totalValue = 0;
  
  optimizing = false;
  calculating = false;
  creating = false;
  
  tripForm = new FormGroup({});
  
  private map: google.maps.Map | null = null;
  private routePolyline: google.maps.Polyline | null = null;
  private stopMarkers: google.maps.Marker[] = [];
  private http: HttpClient;
  private mapInitialized = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { 
      invoices: any[], 
      drivers: any[], 
      vehicles: any[], 
      warehouses: any[],
      customers: any[],
      apiUrl: string
    },
    private dialogRef: MatDialogRef<CreateTripsheetDialog>,
    private injector: Injector
  ) {
    this.http = this.injector.get(HttpClient);
    // Set first warehouse as default
    if (data.warehouses && data.warehouses.length > 0) {
      this.selectedWarehouse = data.warehouses[0];
    }
    // Initialize province data for invoices
    this.initializeProvinceData();
  }

  ngAfterViewInit(): void {
    // Map will be initialized when step 2 is active
  }

  ngOnDestroy(): void {
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
    }
    this.stopMarkers.forEach(m => m.setMap(null));
  }

  // Initialize province data for all invoices based on customer addresses
  private initializeProvinceData(): void {
    this.loadingProvinces = true;
    
    const invoicesToGeocode: any[] = [];
    
    // First pass: try to match using keywords from address data and customer name
    this.data.invoices.forEach(invoice => {
      // Find customer by customerCode or name
      const customer = this.data.customers?.find(c => 
        c.customerCode === invoice.customerNumber || 
        c.name === invoice.customerName ||
        c.shortName === invoice.customerName
      );
      
      const cacheKey = invoice.customerNumber || invoice.customerName;
      
      // Check cache first
      if (this.customerProvinceCache.has(cacheKey)) {
        const cached = this.customerProvinceCache.get(cacheKey)!;
        invoice.province = cached.province;
        invoice.city = cached.city;
        return;
      }
      
      // Build address string from multiple sources
      let addressParts: string[] = [];
      
      // Add customer name (often contains location like "DURBAN HOSPITAL")
      if (invoice.customerName) addressParts.push(invoice.customerName);
      
      if (customer) {
        // Use addressLines array if available
        if (customer.addressLines && Array.isArray(customer.addressLines)) {
          addressParts = [...addressParts, ...customer.addressLines];
        }
        
        // Also add other address fields
        if (customer.physicalAddress) addressParts.push(customer.physicalAddress);
        if (customer.deliveryAddress) addressParts.push(customer.deliveryAddress);
        if (customer.deliveryCity) addressParts.push(customer.deliveryCity);
        if (customer.city) addressParts.push(customer.city);
        if (customer.province) addressParts.push(customer.province);
        if (customer.deliveryProvince) addressParts.push(customer.deliveryProvince);
        if (customer.name) addressParts.push(customer.name);
      }
      
      const fullAddress = addressParts.join(' ').toLowerCase();
      const provinceData = this.detectProvinceFromAddress(fullAddress);
      
      if (provinceData.province) {
        invoice.province = provinceData.province;
        invoice.city = provinceData.city || (customer?.deliveryCity) || (customer?.city) || '';
        
        // Cache the result
        this.customerProvinceCache.set(cacheKey, { 
          province: provinceData.province, 
          city: invoice.city 
        });
      } else {
        // Queue for geocoding
        invoicesToGeocode.push(invoice);
      }
    });
    
    // Second pass: use Google Maps Geocoding for unmatched invoices
    if (invoicesToGeocode.length > 0) {
      this.geocodeInvoices(invoicesToGeocode);
    } else {
      this.loadingProvinces = false;
    }
  }
  
  // Geocode invoices using Google Maps API
  private async geocodeInvoices(invoices: any[]): Promise<void> {
    const geocodeUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < invoices.length; i += batchSize) {
      const batch = invoices.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (invoice) => {
        const cacheKey = invoice.customerNumber || invoice.customerName;
        
        // Skip if already cached
        if (this.customerProvinceCache.has(cacheKey)) {
          const cached = this.customerProvinceCache.get(cacheKey)!;
          invoice.province = cached.province;
          invoice.city = cached.city;
          return;
        }
        
        // Build search query
        const customer = this.data.customers?.find(c => 
          c.customerCode === invoice.customerNumber || 
          c.name === invoice.customerName
        );
        
        let searchQuery = invoice.customerName + ' South Africa';
        if (customer?.addressLines?.length) {
          searchQuery = customer.addressLines.join(', ') + ', South Africa';
        }
        
        try {
          const response = await fetch(
            `${geocodeUrl}?address=${encodeURIComponent(searchQuery)}&key=${this.googleMapsApiKey}&components=country:ZA`
          );
          const data = await response.json();
          
          if (data.status === 'OK' && data.results?.length > 0) {
            const result = data.results[0];
            const addressComponents = result.address_components || [];
            
            // Find province from address components
            const provinceComponent = addressComponents.find((c: any) => 
              c.types.includes('administrative_area_level_1')
            );
            const cityComponent = addressComponents.find((c: any) => 
              c.types.includes('locality') || c.types.includes('sublocality')
            );
            
            if (provinceComponent) {
              const provinceName = provinceComponent.long_name.toLowerCase();
              const provinceCode = this.getProvinceCodeFromName(provinceName);
              
              if (provinceCode) {
                invoice.province = provinceCode;
                invoice.city = cityComponent?.long_name || '';
                
                // Cache the result
                this.customerProvinceCache.set(cacheKey, {
                  province: provinceCode,
                  city: invoice.city
                });
              }
            }
          }
        } catch (error) {
          console.warn('Geocoding failed for:', searchQuery, error);
        }
      }));
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < invoices.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.loadingProvinces = false;
  }
  
  // Get province code from province name
  private getProvinceCodeFromName(provinceName: string): string {
    const lower = provinceName.toLowerCase();
    const mapping: { [key: string]: string } = {
      'gauteng': 'GP',
      'kwazulu-natal': 'KZN',
      'kwazulu natal': 'KZN',
      'kwa-zulu natal': 'KZN',
      'western cape': 'WC',
      'eastern cape': 'EC',
      'mpumalanga': 'MP',
      'limpopo': 'LP',
      'free state': 'FS',
      'north west': 'NW',
      'north-west': 'NW',
      'northern cape': 'NC'
    };
    
    for (const [name, code] of Object.entries(mapping)) {
      if (lower.includes(name)) {
        return code;
      }
    }
    return '';
  }

  // Detect province from address using keyword matching
  private detectProvinceFromAddress(address: string): { province: string, city: string } {
    const lowerAddress = address.toLowerCase();
    
    // Check each province's keywords
    for (const [provinceCode, keywords] of Object.entries(this.provinceKeywords)) {
      for (const keyword of keywords) {
        if (lowerAddress.includes(keyword)) {
          // Try to extract city from the matched keyword
          const city = this.capitalizeWords(keyword);
          return { province: provinceCode, city };
        }
      }
    }
    
    return { province: '', city: '' };
  }

  private capitalizeWords(str: string): string {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  // Get province name from code
  getProvinceName(code: string): string {
    const province = this.provinces.find(p => p.code === code);
    return province?.name || code;
  }

  // Get count of invoices for a province
  getProvinceInvoiceCount(provinceCode: string): number {
    return this.data.invoices.filter(inv => 
      inv.status === 'Pending' && 
      !this.isInvoiceSelected(inv) && 
      inv.province === provinceCode
    ).length;
  }

  // Handle province selection change
  onProvinceChange(): void {
    this.invoiceSearch = ''; // Clear search when province changes
  }

  filteredInvoices(): any[] {
    let invoices = this.data.invoices.filter(inv => 
      inv.status === 'Pending' && !this.isInvoiceSelected(inv)
    );
    
    // Filter by province
    if (this.selectedProvince !== 'all') {
      invoices = invoices.filter(inv => inv.province === this.selectedProvince);
    }
    
    // Filter by search term
    if (this.invoiceSearch) {
      const search = this.invoiceSearch.toLowerCase();
      invoices = invoices.filter(inv =>
        inv.transactionNumber?.toLowerCase().includes(search) ||
        inv.customerName?.toLowerCase().includes(search) ||
        inv.productDescription?.toLowerCase().includes(search) ||
        inv.city?.toLowerCase().includes(search)
      );
    }
    
    return invoices;
  }

  isInvoiceSelected(invoice: any): boolean {
    return this.selectedStops.some(s => s.id === invoice.id);
  }

  toggleInvoiceSelection(invoice: any): void {
    if (this.isInvoiceSelected(invoice)) {
      this.removeStopByInvoice(invoice);
    } else {
      this.addStop(invoice);
    }
  }

  addStop(invoice: any): void {
    // Find customer details for address
    const customer = this.data.customers?.find(c => 
      c.accountNumber === invoice.customerNumber || c.name === invoice.customerName
    );
    
    this.selectedStops.push({
      ...invoice,
      address: customer?.physicalAddress || customer?.deliveryAddress || 'Address not available',
      latitude: customer?.latitude,
      longitude: customer?.longitude
    });
    
    this.calculateTotalValue();
  }

  removeStop(index: number): void {
    this.selectedStops.splice(index, 1);
    this.calculateTotalValue();
  }

  removeStopByInvoice(invoice: any): void {
    const index = this.selectedStops.findIndex(s => s.id === invoice.id);
    if (index > -1) {
      this.removeStop(index);
    }
  }

  clearAllStops(): void {
    this.selectedStops = [];
    this.totalDistance = 0;
    this.estimatedTime = '';
    this.totalValue = 0;
  }

  dropStop(event: CdkDragDrop<any[]>): void {
    moveItemInArray(this.selectedStops, event.previousIndex, event.currentIndex);
  }

  calculateTotalValue(): void {
    this.totalValue = this.selectedStops.reduce((sum, stop) => sum + (stop.salesAmount || 0), 0);
  }

  optimizeRoute(): void {
    if (this.selectedStops.length < 2) return;
    
    this.optimizing = true;
    
    // Get stops with coordinates
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    
    if (stopsWithCoords.length < 2) {
      // Fallback to simple sort if no coordinates
      this.selectedStops.sort((a, b) => a.customerName.localeCompare(b.customerName));
      this.optimizing = false;
      return;
    }
    
    // Use Google Routes API via backend for optimal route
    const origin = {
      latitude: this.selectedWarehouse?.latitude || -29.8587, // Default to Durban
      longitude: this.selectedWarehouse?.longitude || 31.0218,
      label: this.selectedWarehouse?.name || 'Warehouse'
    };
    
    const waypoints = this.selectedStops
      .filter(s => s.latitude && s.longitude)
      .map(s => ({
        latitude: s.latitude,
        longitude: s.longitude,
        label: s.customerName,
        referenceId: s.id
      }));
    
    // Use the last stop as destination, rest as waypoints
    const destination = waypoints.pop();
    
    const routeRequest = {
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      optimizeWaypoints: true,
      departureTime: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/calculate-route`, routeRequest).subscribe({
      next: (result) => {
        if (result.success && result.optimizedWaypointOrder) {
          // Reorder stops based on optimized order
          const optimizedStops: any[] = [];
          const originalStops = [...this.selectedStops.filter(s => s.latitude && s.longitude)];
          const stopsWithoutCoords = this.selectedStops.filter(s => !s.latitude || !s.longitude);
          
          // Build optimized order: first the waypoints, then the destination
          result.optimizedWaypointOrder.forEach((index: number) => {
            if (index < originalStops.length - 1) {
              optimizedStops.push(originalStops[index]);
            }
          });
          // Add the destination (last stop)
          optimizedStops.push(originalStops[originalStops.length - 1]);
          
          // Add any stops without coordinates at the end
          optimizedStops.push(...stopsWithoutCoords);
          
          this.selectedStops = optimizedStops;
          
          // Update distance and time from API response
          this.totalDistance = Math.round(result.distanceMeters / 1000);
          const totalMins = Math.round(result.durationSeconds / 60);
          const hours = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          this.estimatedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          
          // Update map
          this.updateRouteMap();
        } else {
          // Fallback to local nearest neighbor algorithm
          this.optimizeRouteLocally();
        }
        this.optimizing = false;
      },
      error: (err) => {
        console.warn('Google Routes API failed, using local optimization:', err);
        this.optimizeRouteLocally();
        this.optimizing = false;
      }
    });
  }
  
  // Fallback local optimization using nearest neighbor
  private optimizeRouteLocally(): void {
    const start = this.selectedWarehouse;
    const startLat = start?.latitude || -29.8587;
    const startLng = start?.longitude || 31.0218;
    
    const optimized: any[] = [];
    const remaining = [...this.selectedStops];
    
    let currentLat = startLat;
    let currentLng = startLng;
    
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      
      remaining.forEach((stop, index) => {
        if (stop.latitude && stop.longitude) {
          const dist = this.haversineDistance(currentLat, currentLng, stop.latitude, stop.longitude);
          if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestIndex = index;
          }
        }
      });
      
      const nearest = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nearest);
      
      if (nearest.latitude && nearest.longitude) {
        currentLat = nearest.latitude;
        currentLng = nearest.longitude;
      }
    }
    
    this.selectedStops = optimized;
    this.calculateDistanceLocally();
  }

  calculateDistance(): void {
    this.calculating = true;
    
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    
    if (stopsWithCoords.length < 1) {
      this.calculating = false;
      return;
    }
    
    // Use Google Routes API for accurate distance
    const origin = {
      latitude: this.selectedWarehouse?.latitude || -29.8587,
      longitude: this.selectedWarehouse?.longitude || 31.0218,
      label: this.selectedWarehouse?.name || 'Warehouse'
    };
    
    const waypoints = stopsWithCoords.slice(0, -1).map(s => ({
      latitude: s.latitude,
      longitude: s.longitude,
      label: s.customerName
    }));
    
    const lastStop = stopsWithCoords[stopsWithCoords.length - 1];
    const destination = {
      latitude: lastStop.latitude,
      longitude: lastStop.longitude,
      label: lastStop.customerName
    };
    
    const routeRequest = {
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      optimizeWaypoints: false, // Keep current order
      departureTime: new Date(Date.now() + 3600000).toISOString()
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/calculate-route`, routeRequest).subscribe({
      next: (result) => {
        if (result.success) {
          this.totalDistance = Math.round(result.distanceMeters / 1000);
          
          // Add service time at each stop (15 min)
          const driveTimeSeconds = result.durationSeconds;
          const serviceTimeSeconds = this.selectedStops.length * 15 * 60;
          const totalSeconds = driveTimeSeconds + serviceTimeSeconds;
          
          const totalMins = Math.round(totalSeconds / 60);
          const hours = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          this.estimatedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        } else {
          // Fallback to local calculation
          this.calculateDistanceLocally();
        }
        this.calculating = false;
        this.updateRouteMap();
      },
      error: (err) => {
        console.warn('Google Routes API failed, using local calculation:', err);
        this.calculateDistanceLocally();
        this.calculating = false;
      }
    });
  }
  
  // Fallback local distance calculation
  private calculateDistanceLocally(): void {
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    
    if (stopsWithCoords.length < 1) return;
    
    // Start from warehouse
    const startLat = this.selectedWarehouse?.latitude || -29.8587;
    const startLng = this.selectedWarehouse?.longitude || 31.0218;
    
    let totalDist = 0;
    let prevLat = startLat;
    let prevLng = startLng;
    
    stopsWithCoords.forEach(stop => {
      totalDist += this.haversineDistance(prevLat, prevLng, stop.latitude, stop.longitude);
      prevLat = stop.latitude;
      prevLng = stop.longitude;
    });
    
    // Add 25% for road vs straight line (more realistic)
    this.totalDistance = Math.round(totalDist * 1.25);
    
    // Estimate time: 55km/h average (accounting for traffic) + 15min per stop
    const driveTimeMinutes = (this.totalDistance / 55) * 60;
    const stopTimeMinutes = this.selectedStops.length * 15;
    const totalMinutes = Math.round(driveTimeMinutes + stopTimeMinutes);
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    this.estimatedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    this.updateRouteMap();
  }

  // Advanced route optimization using Google Route Optimization API
  advancedOptimization(): void {
    if (this.selectedStops.length < 2) {
      this.optimizationMessage = 'Need at least 2 stops to optimize';
      this.optimizationSuccess = false;
      return;
    }
    
    this.advancedOptimizing = true;
    this.optimizationMessage = 'Running Google AI route optimization...';
    this.optimizationSuccess = false;
    
    // Build list of invoice IDs for optimization
    const invoiceIds = this.selectedStops.map(s => s.invoiceId || s.id);
    
    // Get departure time (scheduled date + 8am)
    const departureDate = new Date(this.scheduledDate);
    departureDate.setHours(8, 0, 0, 0);
    
    const optimizationRequest = {
      invoiceIds: invoiceIds,
      depotLatitude: this.selectedWarehouse?.latitude || -29.8587,
      depotLongitude: this.selectedWarehouse?.longitude || 31.0218,
      departureTime: departureDate.toISOString(),
      vehicleCapacity: this.selectedVehicle?.capacity || 10000,
      maxDrivingHours: 10,
      serviceTimeMinutes: 15
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/optimize-invoices`, optimizationRequest).subscribe({
      next: (result) => {
        if (result.success) {
          // Reorder stops based on optimized sequence
          const optimizedStops: any[] = [];
          
          result.optimizedStops?.forEach((optStop: any) => {
            const matchingStop = this.selectedStops.find(s => 
              (s.invoiceId || s.id) === optStop.invoiceId ||
              s.customerName?.toLowerCase().includes(optStop.customerName?.toLowerCase()) ||
              optStop.customerName?.toLowerCase().includes(s.customerName?.toLowerCase())
            );
            if (matchingStop && !optimizedStops.includes(matchingStop)) {
              optimizedStops.push(matchingStop);
            }
          });
          
          // Add any stops that weren't in the optimization result
          this.selectedStops.forEach(s => {
            if (!optimizedStops.includes(s)) {
              optimizedStops.push(s);
            }
          });
          
          this.selectedStops = optimizedStops;
          
          // Update metrics
          this.totalDistance = Math.round(result.totalDistanceKm);
          
          const totalMins = Math.round((result.totalDurationMinutes || 0));
          const hours = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          this.estimatedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          
          // Calculate fuel estimates
          this.fuelEstimate = Math.round((this.totalDistance / 100) * this.avgFuelConsumption);
          this.fuelCost = Math.round(this.fuelEstimate * this.fuelPricePerLiter);
          
          this.optimizationMessage = `✓ Route optimized: ${this.totalDistance}km, ${this.estimatedTime}, ~R${this.fuelCost} fuel`;
          this.optimizationSuccess = true;
          
          // Update map
          this.updateRouteMap();
        } else {
          this.optimizationMessage = 'Optimization failed: ' + (result.message || 'Unknown error');
          this.optimizationSuccess = false;
        }
        this.advancedOptimizing = false;
      },
      error: (err) => {
        console.error('Route optimization error:', err);
        this.optimizationMessage = 'Optimization failed: ' + (err.error?.message || err.message || 'API error');
        this.optimizationSuccess = false;
        this.advancedOptimizing = false;
      }
    });
  }

  // Calculate distance matrix between all stops using Google Distance Matrix API
  calculateDistanceMatrix(): void {
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    
    if (stopsWithCoords.length < 2) {
      this.optimizationMessage = 'Need at least 2 stops with coordinates for distance matrix';
      this.optimizationSuccess = false;
      return;
    }
    
    this.calculatingMatrix = true;
    this.optimizationMessage = 'Calculating distance matrix using Google API...';
    
    // Build origins and destinations (warehouse + all stops)
    const locations: any[] = [];
    
    // Add warehouse as first location
    const warehouseLoc = {
      latitude: this.selectedWarehouse?.latitude || -29.8587,
      longitude: this.selectedWarehouse?.longitude || 31.0218,
      label: this.selectedWarehouse?.name || 'Warehouse'
    };
    locations.push(warehouseLoc);
    
    // Add all stops
    stopsWithCoords.forEach(s => {
      locations.push({
        latitude: s.latitude,
        longitude: s.longitude,
        label: s.customerName?.substring(0, 20) || `Stop ${locations.length}`
      });
    });
    
    const matrixRequest = {
      origins: locations,
      destinations: locations
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/distance-matrix`, matrixRequest).subscribe({
      next: (result) => {
        if (result.success && result.rows) {
          // Build matrix data
          this.distanceMatrixLabels = locations.map(l => l.label);
          this.distanceMatrix = result.rows.map((row: any) => 
            row.elements.map((el: any) => ({
              distanceKm: Math.round(el.distanceMeters / 1000 * 10) / 10,
              durationMin: Math.round(el.durationSeconds / 60),
              durationText: this.formatDuration(el.durationSeconds)
            }))
          );
          
          this.showDistanceMatrix = true;
          this.optimizationMessage = `✓ Distance matrix calculated: ${locations.length}x${locations.length} (${locations.length * locations.length} routes)`;
          this.optimizationSuccess = true;
        } else {
          this.optimizationMessage = 'Matrix calculation failed: ' + (result.error || 'Unknown error');
          this.optimizationSuccess = false;
        }
        this.calculatingMatrix = false;
      },
      error: (err) => {
        console.error('Distance matrix error:', err);
        this.optimizationMessage = 'Matrix calculation failed: ' + (err.error?.message || err.message || 'API error');
        this.optimizationSuccess = false;
        this.calculatingMatrix = false;
      }
    });
  }
  
  private formatDuration(seconds: number): string {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }
  
  toggleDistanceMatrix(): void {
    this.showDistanceMatrix = !this.showDistanceMatrix;
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private initializeMap(): void {
    const mapElement = document.getElementById('tripsheetRouteMap');
    if (!mapElement || this.mapInitialized) return;

    const apiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
    
    if (typeof google !== 'undefined' && google.maps) {
      this.createMap(mapElement);
      return;
    }

    const callbackName = 'initTripsheetMap' + Date.now();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${callbackName}`;
    script.async = true;
    
    (window as any)[callbackName] = () => {
      this.createMap(mapElement);
      delete (window as any)[callbackName];
    };
    
    document.head.appendChild(script);
  }

  private createMap(element: HTMLElement): void {
    this.map = new google.maps.Map(element, {
      zoom: 6,
      center: { lat: -28.5, lng: 25.5 },
      mapTypeId: 'roadmap',
      mapTypeControl: true,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scaleControl: true
    } as any);
    this.mapInitialized = true;
    this.updateRouteMap();
  }

  updateRouteMap(): void {
    setTimeout(() => this.initializeMap(), 100);
    
    if (!this.map) return;
    
    // Clear existing
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
    }
    this.stopMarkers.forEach(m => m.setMap(null));
    this.stopMarkers = [];
    
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    if (stopsWithCoords.length === 0) return;
    
    const bounds = new google.maps.LatLngBounds();
    
    // Add warehouse as start point
    const startLat = this.selectedWarehouse?.latitude || -26.2041;
    const startLng = this.selectedWarehouse?.longitude || 28.0473;
    
    const path = [{ lat: startLat, lng: startLng }];
    bounds.extend(path[0]);
    
    // Add warehouse marker
    const warehouseMarker = new google.maps.Marker({
      position: path[0],
      map: this.map,
      title: this.selectedWarehouse?.name || 'Warehouse',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#4caf50',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2
      }
    });
    this.stopMarkers.push(warehouseMarker);
    
    // Add stop markers
    stopsWithCoords.forEach((stop, index) => {
      const pos = { lat: stop.latitude, lng: stop.longitude };
      path.push(pos);
      bounds.extend(pos);
      
      const marker = new google.maps.Marker({
        position: pos,
        map: this.map,
        title: stop.customerName,
        label: {
          text: (index + 1).toString(),
          color: 'white',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#667eea',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        }
      });
      this.stopMarkers.push(marker);
    });
    
    // Draw route line
    this.routePolyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: '#667eea',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: this.map
    });
    
    this.map.fitBounds(bounds, 50);
  }

  previewPdf(): void {
    // Create a preview window with trip sheet HTML
    const html = this.generateTripsheetHtml();
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(html);
      previewWindow.document.close();
    }
  }

  createTripsheet(): void {
    this.creating = true;
    
    // Build the load/tripsheet payload
    const payload = {
      warehouseId: this.selectedWarehouse?.id,
      driverId: this.selectedDriver?.id,
      vehicleId: this.selectedVehicle?.id,
      scheduledPickupDate: this.scheduledDate,
      specialInstructions: this.specialInstructions,
      estimatedDistance: this.totalDistance,
      estimatedTimeMinutes: Math.round(this.totalDistance * 1.2), // rough estimate
      priority: 'Normal',
      stops: this.selectedStops.map((stop, index) => ({
        stopSequence: index + 1,
        stopType: index === this.selectedStops.length - 1 ? 'Destination' : 'Delivery',
        customerId: stop.customerId,
        companyName: stop.customerName,
        address: stop.address || 'Unknown',
        latitude: stop.latitude,
        longitude: stop.longitude,
        orderNumber: stop.transactionNumber,
        invoiceNumber: stop.transactionNumber,
        commodities: [{
          commodityName: stop.productDescription,
          commodityCode: stop.productCode,
          quantity: stop.quantity || 1,
          unitPrice: stop.salesAmount,
          totalPrice: stop.salesAmount
        }]
      })),
      invoiceIds: this.selectedStops.map(s => s.id)
    };
    
    this.http.post(`${environment.apiUrl}/logistics/loads`, payload).subscribe({
      next: (result: any) => {
        // Download the PDF
        this.http.get(`${environment.apiUrl}/logistics/tripsheet/${result.id}/pdf`, { responseType: 'text' }).subscribe({
          next: (html) => {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(html);
              printWindow.document.close();
              setTimeout(() => printWindow.print(), 500);
            }
            
            this.creating = false;
            this.dialogRef.close({ created: true, loadId: result.id });
          },
          error: () => {
            this.creating = false;
            this.dialogRef.close({ created: true, loadId: result.id });
          }
        });
      },
      error: (err) => {
        console.error('Failed to create tripsheet:', err);
        this.creating = false;
      }
    });
  }

  private generateTripsheetHtml(): string {
    const date = new Date().toLocaleDateString('en-ZA', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    let stopsHtml = '';
    this.selectedStops.forEach((stop, i) => {
      stopsHtml += `
        <tr>
          <td style="text-align: center; font-weight: bold;">${i + 1}</td>
          <td>${stop.customerName}</td>
          <td>${stop.address || 'N/A'}</td>
          <td>${stop.transactionNumber}</td>
          <td>${stop.productDescription?.substring(0, 40) || ''}...</td>
          <td style="text-align: right;">R ${stop.salesAmount?.toFixed(2) || '0.00'}</td>
          <td style="text-align: center;">☐</td>
        </tr>
      `;
    });
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trip Sheet - ${date}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #667eea; padding-bottom: 20px; }
          .header h1 { color: #667eea; margin: 0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f5f5f5; padding: 15px; border-radius: 8px; }
          .info-box h3 { margin: 0 0 10px 0; color: #667eea; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 10px; border: 1px solid #ddd; }
          th { background: #667eea; color: white; text-align: left; }
          tr:nth-child(even) { background: #f9f9f9; }
          .summary { margin-top: 30px; text-align: right; font-size: 18px; }
          .signature { margin-top: 50px; display: flex; justify-content: space-between; }
          .signature-box { width: 200px; text-align: center; }
          .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚛 TRIP SHEET</h1>
          <p>${date}</p>
        </div>
        
        <div class="info-grid">
          <div class="info-box">
            <h3>📍 Pickup Location</h3>
            <p><strong>${this.selectedWarehouse?.name || 'Warehouse'}</strong></p>
            <p>${this.selectedWarehouse?.address || ''}</p>
          </div>
          <div class="info-box">
            <h3>🚗 Vehicle & Driver</h3>
            <p><strong>Driver:</strong> ${this.selectedDriver ? this.selectedDriver.firstName + ' ' + this.selectedDriver.lastName : 'Unassigned'}</p>
            <p><strong>Vehicle:</strong> ${this.selectedVehicle?.registrationNumber || 'Unassigned'}</p>
          </div>
          <div class="info-box">
            <h3>📊 Route Info</h3>
            <p><strong>Stops:</strong> ${this.selectedStops.length}</p>
            <p><strong>Distance:</strong> ${this.totalDistance} km</p>
            <p><strong>Est. Time:</strong> ${this.estimatedTime}</p>
          </div>
          <div class="info-box">
            <h3>💰 Financial</h3>
            <p><strong>Total Value:</strong> R ${this.totalValue.toFixed(2)}</p>
          </div>
        </div>
        
        ${this.specialInstructions ? `<div class="info-box"><h3>⚠️ Special Instructions</h3><p>${this.specialInstructions}</p></div>` : ''}
        
        <h2>📦 Delivery Stops</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Address</th>
              <th>Invoice #</th>
              <th>Product</th>
              <th>Amount</th>
              <th>✓</th>
            </tr>
          </thead>
          <tbody>
            ${stopsHtml}
          </tbody>
        </table>
        
        <div class="summary">
          <strong>Total: R ${this.totalValue.toFixed(2)}</strong>
        </div>
        
        <div class="signature">
          <div class="signature-box">
            <div class="signature-line">Driver Signature</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">Dispatcher Signature</div>
          </div>
          <div class="signature-box">
            <div class="signature-line">Date & Time Out</div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

// Add Maintenance Dialog
@Component({
  selector: 'add-maintenance-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>build</mat-icon>
      {{ data.record ? 'Edit' : 'Schedule' }} Maintenance
    </h2>
    <mat-dialog-content>
      <form class="maintenance-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vehicle</mat-label>
          <mat-select [(ngModel)]="formData.vehicleId" name="vehicleId" required (selectionChange)="onVehicleChange($event)">
            @for (vehicle of data.vehicles; track vehicle.id) {
              <mat-option [value]="vehicle.id">
                {{ vehicle.registrationNumber }} - {{ vehicle.type || 'Vehicle' }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Maintenance Type</mat-label>
          <mat-select [(ngModel)]="formData.maintenanceType" name="maintenanceType" required>
            <mat-option value="scheduled">Scheduled Service</mat-option>
            <mat-option value="repair">Repair</mat-option>
            <mat-option value="license">License Renewal</mat-option>
            <mat-option value="inspection">Inspection/Roadworthy</mat-option>
            <mat-option value="other">Other</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput [(ngModel)]="formData.description" name="description" rows="3" required
                    placeholder="Describe the maintenance required..."></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Scheduled Date</mat-label>
            <input matInput [matDatepicker]="picker" [(ngModel)]="formData.scheduledDate" name="scheduledDate" required>
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="formData.priority" name="priority" required>
              <mat-option value="low">Low</mat-option>
              <mat-option value="medium">Medium</mat-option>
              <mat-option value="high">High</mat-option>
              <mat-option value="critical">Critical</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Estimated Cost (R)</mat-label>
            <input matInput type="number" [(ngModel)]="formData.estimatedCost" name="estimatedCost" placeholder="0.00">
            <span matPrefix>R&nbsp;</span>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Assigned To</mat-label>
            <input matInput [(ngModel)]="formData.assignedTo" name="assignedTo" placeholder="Service provider or technician">
          </mat-form-field>
        </div>

        @if (formData.maintenanceType === 'license') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>License Expiry Date</mat-label>
            <input matInput [matDatepicker]="expiryPicker" [(ngModel)]="formData.licenseExpiryDate" name="licenseExpiryDate">
            <mat-datepicker-toggle matSuffix [for]="expiryPicker"></mat-datepicker-toggle>
            <mat-datepicker #expiryPicker></mat-datepicker>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notes</mat-label>
          <textarea matInput [(ngModel)]="formData.notes" name="notes" rows="2" placeholder="Additional notes..."></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!isValid()">
        <mat-icon>{{ data.record ? 'save' : 'add' }}</mat-icon>
        {{ data.record ? 'Save Changes' : 'Schedule' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .maintenance-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 500px;
    }
    .full-width {
      width: 100%;
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .form-row mat-form-field {
      flex: 1;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon {
      color: #ff9800;
    }
  `]
})
export class AddMaintenanceDialog {
  formData: Partial<MaintenanceRecord> = {
    maintenanceType: 'scheduled',
    status: 'scheduled',
    priority: 'medium',
    scheduledDate: new Date()
  };

  constructor(
    public dialogRef: MatDialogRef<AddMaintenanceDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicles: any[], record?: MaintenanceRecord }
  ) {
    if (data.record) {
      this.formData = { ...data.record };
    }
  }

  onVehicleChange(event: any): void {
    const vehicle = this.data.vehicles.find(v => v.id === event.value);
    if (vehicle) {
      this.formData.vehicleReg = vehicle.registrationNumber;
      this.formData.vehicleType = vehicle.type || 'Vehicle';
    }
  }

  isValid(): boolean {
    return !!(
      this.formData.vehicleId &&
      this.formData.maintenanceType &&
      this.formData.description &&
      this.formData.scheduledDate &&
      this.formData.priority
    );
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.isValid()) {
      // Calculate days until expiry for license type
      if (this.formData.maintenanceType === 'license' && this.formData.licenseExpiryDate) {
        const today = new Date();
        const expiryDate = new Date(this.formData.licenseExpiryDate);
        this.formData.daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
      this.dialogRef.close(this.formData);
    }
  }
}

// Vehicle Dialog Component - View/Edit/Add vehicle
@Component({
  selector: 'app-vehicle-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDividerModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data.mode === 'add' ? 'add' : data.mode === 'edit' ? 'edit' : 'visibility' }}</mat-icon>
      {{ data.mode === 'add' ? 'Add Vehicle' : data.mode === 'edit' ? 'Edit Vehicle' : 'Vehicle Details' }}
    </h2>
    <mat-dialog-content>
      <form class="vehicle-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Registration Number</mat-label>
          <input matInput [(ngModel)]="formData.registrationNumber" name="registrationNumber" 
                 [readonly]="data.mode === 'view'" placeholder="e.g., ABC123GP">
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Make</mat-label>
            <input matInput [(ngModel)]="formData.make" name="make" [readonly]="data.mode === 'view'">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Model</mat-label>
            <input matInput [(ngModel)]="formData.model" name="model" [readonly]="data.mode === 'view'">
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Year</mat-label>
            <input matInput type="number" [(ngModel)]="formData.year" name="year" [readonly]="data.mode === 'view'">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Color</mat-label>
            <input matInput [(ngModel)]="formData.color" name="color" [readonly]="data.mode === 'view'">
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>VIN Number</mat-label>
          <input matInput [(ngModel)]="formData.vinNumber" name="vinNumber" [readonly]="data.mode === 'view'">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vehicle Type</mat-label>
          <mat-select [(ngModel)]="formData.vehicleTypeId" name="vehicleTypeId" [disabled]="data.mode === 'view'">
            <mat-option [value]="1">Truck</mat-option>
            <mat-option [value]="2">Van</mat-option>
            <mat-option [value]="3">Car</mat-option>
            <mat-option [value]="4">Motorcycle</mat-option>
          </mat-select>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Tank Size (L)</mat-label>
            <input matInput type="number" [(ngModel)]="formData.tankSize" name="tankSize" [readonly]="data.mode === 'view'">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Fuel Type</mat-label>
            <mat-select [(ngModel)]="formData.fuelType" name="fuelType" [disabled]="data.mode === 'view'">
              <mat-option value="Diesel">Diesel</mat-option>
              <mat-option value="Petrol">Petrol</mat-option>
              <mat-option value="LPG">LPG</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="formData.status" name="status" [disabled]="data.mode === 'view'">
            <mat-option value="Available">Available</mat-option>
            <mat-option value="In Use">In Use</mat-option>
            <mat-option value="Maintenance">Maintenance</mat-option>
            <mat-option value="Inactive">Inactive</mat-option>
          </mat-select>
        </mat-form-field>

        @if (data.mode === 'view' && data.vehicle) {
          <mat-divider></mat-divider>
          <div class="integration-info">
            <h4>Integration Status</h4>
            <div class="integration-row">
              <span class="label">CarTrack:</span>
              <span [class.linked]="data.vehicle.carTrackId">
                {{ data.vehicle.carTrackId ? 'Linked (' + data.vehicle.carTrackId + ')' : 'Not Linked' }}
              </span>
            </div>
            <div class="integration-row">
              <span class="label">TFN:</span>
              <span [class.linked]="data.vehicle.tfnVehicleId">
                {{ data.vehicle.tfnVehicleId ? 'Linked' : 'Not Linked' }}
              </span>
            </div>
            @if (data.vehicle.lastLocation) {
              <div class="integration-row">
                <span class="label">Last Location:</span>
                <span>{{ data.vehicle.lastLocation }}</span>
              </div>
            }
            @if (data.vehicle.lastUpdate) {
              <div class="integration-row">
                <span class="label">Last Update:</span>
                <span>{{ data.vehicle.lastUpdate | date:'medium' }}</span>
              </div>
            }
          </div>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">{{ data.mode === 'view' ? 'Close' : 'Cancel' }}</button>
      @if (data.mode !== 'view') {
        <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!isValid()">
          <mat-icon>{{ data.mode === 'add' ? 'add' : 'save' }}</mat-icon>
          {{ data.mode === 'add' ? 'Add Vehicle' : 'Save Changes' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .vehicle-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 500px;
    }
    .full-width { width: 100%; }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .form-row mat-form-field { flex: 1; }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon { color: #1976d2; }
    .integration-info {
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-top: 16px;
    }
    .integration-info h4 {
      margin: 0 0 12px 0;
      color: #666;
    }
    .integration-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .integration-row:last-child { border-bottom: none; }
    .label { font-weight: 500; color: #666; }
    .linked { color: #4caf50; font-weight: 500; }
  `]
})
export class VehicleDialogComponent {
  formData: any = {};
  
  constructor(
    public dialogRef: MatDialogRef<VehicleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicle?: Vehicle, mode: 'view' | 'edit' | 'add' },
    private http: HttpClient
  ) {
    if (data.vehicle) {
      this.formData = { ...data.vehicle };
    } else {
      this.formData = { status: 'Available', vehicleTypeId: 1 };
    }
  }

  isValid(): boolean {
    return !!this.formData.registrationNumber;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.isValid()) {
      const apiUrl = 'http://192.168.10.151:5143/api';
      if (this.data.mode === 'add') {
        this.http.post(`${apiUrl}/fleet/vehicles`, this.formData).subscribe({
          next: () => this.dialogRef.close(true),
          error: (err) => console.error('Error adding vehicle:', err)
        });
      } else {
        this.http.put(`${apiUrl}/fleet/vehicles/${this.formData.id}`, this.formData).subscribe({
          next: () => this.dialogRef.close(true),
          error: (err) => console.error('Error updating vehicle:', err)
        });
      }
    }
  }
}

// Assign Driver Dialog Component
@Component({
  selector: 'app-assign-driver-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatInputModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>person_add</mat-icon>
      Assign Driver to {{ data.vehicle.registrationNumber }}
    </h2>
    <mat-dialog-content>
      <div class="assign-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Select Driver</mat-label>
          <mat-select [(ngModel)]="selectedDriverId" name="driverId">
            <mat-option [value]="null">No Driver (Unassign)</mat-option>
            @for (driver of drivers; track driver.id) {
              <mat-option [value]="driver.id">
                {{ driver.name }} {{ driver.surname }} - {{ driver.licenseNumber || 'No License' }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (data.vehicle.currentDriverName) {
          <div class="current-driver">
            <mat-icon>info</mat-icon>
            <span>Currently assigned to: <strong>{{ data.vehicle.currentDriverName }}</strong></span>
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()">
        <mat-icon>check</mat-icon>
        {{ selectedDriverId ? 'Assign Driver' : 'Unassign Driver' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .assign-form {
      min-width: 400px;
    }
    .full-width { width: 100%; }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon { color: #1976d2; }
    .current-driver {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fff3e0;
      border-radius: 8px;
      margin-top: 8px;
    }
    .current-driver mat-icon { color: #ff9800; }
  `]
})
export class AssignDriverDialogComponent implements OnInit {
  selectedDriverId: number | null = null;
  drivers: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<AssignDriverDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicle: Vehicle },
    private http: HttpClient
  ) {
    if (data.vehicle.currentDriverId) {
      this.selectedDriverId = data.vehicle.currentDriverId;
    }
  }

  ngOnInit(): void {
    this.loadDrivers();
  }

  loadDrivers(): void {
    const apiUrl = 'http://192.168.10.151:5143/api';
    this.http.get<any[]>(`${apiUrl}/logistics/drivers`).subscribe({
      next: (drivers) => this.drivers = drivers,
      error: () => this.drivers = []
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    const apiUrl = 'http://192.168.10.151:5143/api';
    this.http.post(`${apiUrl}/fleet/vehicles/${this.data.vehicle.id}/assign-driver`, {
      driverId: this.selectedDriverId
    }).subscribe({
      next: () => this.dialogRef.close(true),
      error: (err) => console.error('Error assigning driver:', err)
    });
  }
}

// Link Vehicle Dialog Component - Link to CarTrack or TFN
@Component({
  selector: 'app-link-vehicle-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatInputModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>link</mat-icon>
      Link {{ data.vehicle.registrationNumber }} to {{ data.type === 'cartrack' ? 'CarTrack' : 'TruckFuelNet' }}
    </h2>
    <mat-dialog-content>
      <div class="link-form">
        @if (loading) {
          <div class="loading">
            <mat-spinner diameter="40"></mat-spinner>
            <span>Loading available {{ data.type === 'cartrack' ? 'CarTrack' : 'TFN' }} vehicles...</span>
          </div>
        } @else {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Select {{ data.type === 'cartrack' ? 'CarTrack' : 'TFN' }} Vehicle</mat-label>
            <mat-select [(ngModel)]="selectedExternalId" name="externalId">
              @for (item of availableItems; track item.id) {
                <mat-option [value]="item.id">
                  {{ item.name || item.registrationNumber }} 
                  @if (item.description) {
                    - {{ item.description }}
                  }
                </mat-option>
              }
            </mat-select>
            <mat-hint>{{ availableItems.length }} unlinked vehicles available</mat-hint>
          </mat-form-field>

          @if (data.type === 'cartrack') {
            <div class="manual-entry">
              <span>Or enter CarTrack ID manually:</span>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>CarTrack ID</mat-label>
                <input matInput [(ngModel)]="manualId" name="manualId" placeholder="e.g., 339321264">
              </mat-form-field>
            </div>
          }
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!selectedExternalId && !manualId">
        <mat-icon>link</mat-icon>
        Link Vehicle
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .link-form {
      min-width: 450px;
    }
    .full-width { width: 100%; }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon { color: #1976d2; }
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
    }
    .manual-entry {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }
    .manual-entry span {
      display: block;
      margin-bottom: 8px;
      color: #666;
      font-size: 13px;
    }
  `]
})
export class LinkVehicleDialogComponent implements OnInit {
  selectedExternalId: string | null = null;
  manualId: string = '';
  availableItems: any[] = [];
  loading = true;

  constructor(
    public dialogRef: MatDialogRef<LinkVehicleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicle: Vehicle, type: 'cartrack' | 'tfn' },
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadAvailableItems();
  }

  loadAvailableItems(): void {
    const apiUrl = 'http://192.168.10.151:5143/api';
    const endpoint = this.data.type === 'cartrack' 
      ? `${apiUrl}/cartrack/vehicles/unlinked`
      : `${apiUrl}/logistics/tfn/vehicles/unlinked`;

    this.http.get<any[]>(endpoint).subscribe({
      next: (items) => {
        this.availableItems = items;
        this.loading = false;
      },
      error: () => {
        this.availableItems = [];
        this.loading = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    const apiUrl = 'http://192.168.10.151:5143/api';
    const externalId = this.selectedExternalId || this.manualId;
    
    const endpoint = this.data.type === 'cartrack'
      ? `${apiUrl}/fleet/vehicles/${this.data.vehicle.id}/link-cartrack`
      : `${apiUrl}/fleet/vehicles/${this.data.vehicle.id}/link-tfn`;

    this.http.post(endpoint, { externalId }).subscribe({
      next: () => this.dialogRef.close(true),
      error: (err) => console.error('Error linking vehicle:', err)
    });
  }
}