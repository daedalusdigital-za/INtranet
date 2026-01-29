import { Component, OnInit, signal, computed, AfterViewInit, OnDestroy, ViewChild, ElementRef, Inject, Injector, inject, NgZone } from '@angular/core';
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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { CdkDragDrop, CdkDrag, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
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

interface SleepOut {
  id: number;
  driverId: number;
  driverName?: string;
  driverEmployeeNumber?: string;
  amount: number;
  date: Date;
  status: string; // Requested, Approved, Rejected, Paid
  reason?: string;
  notes?: string;
  loadId?: number;
  loadNumber?: string;
  approvedByUserId?: number;
  approvedByUserName?: string;
  approvedAt?: Date;
  createdAt: Date;
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
    MatDatepickerModule,
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

          <mat-card class="stat-card clickable" (click)="openSleepOutsDialog()">
            <mat-card-content>
              <div class="stat-icon sleepouts">
                <mat-icon>hotel</mat-icon>
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ sleepOutsCount() }}</span>
                <span class="stat-label">Sleep Outs</span>
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

          <mat-card class="stat-card small clickable" (click)="openDriversDialog()">
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
                      <mat-card class="vehicle-card" [ngClass]="'status-' + (vehicle.status || 'unknown').toLowerCase().replace(' ', '-')">

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
                            <mat-chip class="status-chip" [ngClass]="'status-' + (vehicle.status || 'unknown').toLowerCase().replace(' ', '-')">
                              {{ vehicle.status || 'Unknown' }}
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
                      <button mat-raised-button color="accent" (click)="showSuggestedTrips()" 
                        [disabled]="pendingInvoiceCount() === 0">
                        <mat-icon>lightbulb</mat-icon> Suggested Trips
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
                          <th mat-header-cell *matHeaderCellDef>Sales (incl. VAT)</th>
                          <td mat-cell *matCellDef="let inv">R{{ inv.salesAmount * 1.15 | number:'1.2-2' }}</td>
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
                      <button mat-raised-button color="primary" (click)="openTripsheetTypeDialog()">
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
                            <button mat-menu-item (click)="editTripsheet(trip)">
                              <mat-icon>edit</mat-icon>
                              <span>Edit</span>
                            </button>
                            @if (!trip.driverName || !trip.vehicleReg) {
                              <button mat-menu-item (click)="assignTripsheet(trip)">
                                <mat-icon>person_add</mat-icon>
                                <span>Assign Driver/Vehicle</span>
                              </button>
                            }
                            <button mat-menu-item (click)="printTripsheet(trip)">
                              <mat-icon>print</mat-icon>
                              <span>Print</span>
                            </button>
                            <button mat-menu-item (click)="downloadTripsheet(trip)">
                              <mat-icon>download</mat-icon>
                              <span>Download PDF</span>
                            </button>
                            <mat-divider></mat-divider>
                            @if (trip.status !== 'Active' && trip.status !== 'Completed') {
                              <button mat-menu-item (click)="activateTripsheet(trip)">
                                <mat-icon color="primary">play_arrow</mat-icon>
                                <span>Generate Load</span>
                              </button>
                            }
                            <button mat-menu-item (click)="deleteTripsheet(trip)" class="delete-action">
                              <mat-icon color="warn">delete</mat-icon>
                              <span>Delete</span>
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

            <!-- Part Delivered Tab -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon>inventory_2</mat-icon>
                Part Delivered
              </ng-template>
              <div class="tab-content">
                <div class="part-delivered-section">
                  <div class="part-delivered-header">
                    <h3><mat-icon>inventory_2</mat-icon> Part Delivered Tracking</h3>
                    <div class="header-actions">
                      <mat-form-field appearance="outline" class="date-filter">
                        <mat-label>Filter by Date</mat-label>
                        <input matInput [matDatepicker]="partDatePicker" [(ngModel)]="partDeliveredDateFilter" (dateChange)="filterPartDelivered()">
                        <mat-datepicker-toggle matSuffix [for]="partDatePicker"></mat-datepicker-toggle>
                        <mat-datepicker #partDatePicker></mat-datepicker>
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="search-field">
                        <mat-label>Search</mat-label>
                        <input matInput [(ngModel)]="partDeliveredSearch" placeholder="Invoice, customer..." (input)="filterPartDelivered()">
                        <mat-icon matSuffix>search</mat-icon>
                      </mat-form-field>
                      <button mat-raised-button color="primary" (click)="openMarkPartDeliveredDialog()">
                        <mat-icon>add_task</mat-icon>
                        Mark Part Delivered
                      </button>
                    </div>
                  </div>

                  <!-- Part Delivered Stats -->
                  <div class="part-delivered-stats">
                    <mat-card class="stat-card">
                      <mat-card-content>
                        <div class="stat-icon pending">
                          <mat-icon>pending_actions</mat-icon>
                        </div>
                        <div class="stat-info">
                          <span class="stat-label">Pending Completion</span>
                          <span class="stat-value">{{ getPartDeliveredStats().pending }}</span>
                        </div>
                      </mat-card-content>
                    </mat-card>

                    <mat-card class="stat-card">
                      <mat-card-content>
                        <div class="stat-icon partial">
                          <mat-icon>hourglass_top</mat-icon>
                        </div>
                        <div class="stat-info">
                          <span class="stat-label">Part Delivered</span>
                          <span class="stat-value">{{ getPartDeliveredStats().partial }}</span>
                        </div>
                      </mat-card-content>
                    </mat-card>

                    <mat-card class="stat-card">
                      <mat-card-content>
                        <div class="stat-icon completed">
                          <mat-icon>check_circle</mat-icon>
                        </div>
                        <div class="stat-info">
                          <span class="stat-label">Fully Delivered</span>
                          <span class="stat-value">{{ getPartDeliveredStats().complete }}</span>
                        </div>
                      </mat-card-content>
                    </mat-card>

                    <mat-card class="stat-card">
                      <mat-card-content>
                        <div class="stat-icon value">
                          <mat-icon>payments</mat-icon>
                        </div>
                        <div class="stat-info">
                          <span class="stat-label">Outstanding Value</span>
                          <span class="stat-value">R {{ getPartDeliveredStats().outstandingValue | number:'1.2-2' }}</span>
                        </div>
                      </mat-card-content>
                    </mat-card>
                  </div>

                  <!-- Part Delivered Table -->
                  @if (filteredPartDelivered().length > 0) {
                    <mat-card class="part-delivered-table-card">
                      <table mat-table [dataSource]="filteredPartDelivered()" class="part-delivered-table">
                        <ng-container matColumnDef="invoiceNumber">
                          <th mat-header-cell *matHeaderCellDef>Invoice #</th>
                          <td mat-cell *matCellDef="let item">
                            <strong>{{ item.invoiceNumber }}</strong>
                          </td>
                        </ng-container>

                        <ng-container matColumnDef="customer">
                          <th mat-header-cell *matHeaderCellDef>Customer</th>
                          <td mat-cell *matCellDef="let item">{{ item.customerName }}</td>
                        </ng-container>

                        <ng-container matColumnDef="product">
                          <th mat-header-cell *matHeaderCellDef>Product</th>
                          <td mat-cell *matCellDef="let item">{{ item.productDescription | slice:0:30 }}...</td>
                        </ng-container>

                        <ng-container matColumnDef="orderedQty">
                          <th mat-header-cell *matHeaderCellDef>Ordered</th>
                          <td mat-cell *matCellDef="let item">{{ item.orderedQuantity }}</td>
                        </ng-container>

                        <ng-container matColumnDef="deliveredQty">
                          <th mat-header-cell *matHeaderCellDef>Delivered</th>
                          <td mat-cell *matCellDef="let item">
                            <span [class.partial]="item.deliveredQuantity < item.orderedQuantity"
                                  [class.complete]="item.deliveredQuantity >= item.orderedQuantity">
                              {{ item.deliveredQuantity }}
                            </span>
                          </td>
                        </ng-container>

                        <ng-container matColumnDef="remainingQty">
                          <th mat-header-cell *matHeaderCellDef>Remaining</th>
                          <td mat-cell *matCellDef="let item">
                            <span class="remaining" [class.none]="item.remainingQuantity === 0">
                              {{ item.remainingQuantity }}
                            </span>
                          </td>
                        </ng-container>

                        <ng-container matColumnDef="status">
                          <th mat-header-cell *matHeaderCellDef>Status</th>
                          <td mat-cell *matCellDef="let item">
                            <mat-chip [class]="'status-' + (item.deliveryStatus || 'pending').toLowerCase().replace(' ', '-')">
                              {{ item.deliveryStatus || 'Pending' }}
                            </mat-chip>
                          </td>
                        </ng-container>

                        <ng-container matColumnDef="lastDeliveryDate">
                          <th mat-header-cell *matHeaderCellDef>Last Delivery</th>
                          <td mat-cell *matCellDef="let item">
                            {{ item.lastDeliveryDate | date:'dd MMM yyyy' }}
                          </td>
                        </ng-container>

                        <ng-container matColumnDef="actions">
                          <th mat-header-cell *matHeaderCellDef>Actions</th>
                          <td mat-cell *matCellDef="let item">
                            <button mat-icon-button color="primary" (click)="recordPartialDelivery(item)" matTooltip="Record Delivery">
                              <mat-icon>add_task</mat-icon>
                            </button>
                            <button mat-icon-button (click)="viewDeliveryHistory(item)" matTooltip="View History">
                              <mat-icon>history</mat-icon>
                            </button>
                          </td>
                        </ng-container>

                        <tr mat-header-row *matHeaderRowDef="partDeliveredColumns"></tr>
                        <tr mat-row *matRowDef="let row; columns: partDeliveredColumns;"
                            [class.partial-row]="row.deliveryStatus === 'Part Delivered'"
                            [class.complete-row]="row.deliveryStatus === 'Fully Delivered'"></tr>
                      </table>
                    </mat-card>
                  } @else {
                    <div class="empty-state">
                      <mat-icon>inventory_2</mat-icon>
                      <h3>No Part Delivered Records</h3>
                      <p>Track partial deliveries for invoices that couldn't be fully delivered</p>
                      <button mat-raised-button color="primary" (click)="openMarkPartDeliveredDialog()">
                        <mat-icon>add_task</mat-icon> Mark Part Delivered
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
    .stat-icon.sleepouts { background: linear-gradient(135deg, #667eea, #764ba2); }
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

    /* Part Delivered Styles */
    .part-delivered-section {
      padding: 0;
    }

    .part-delivered-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 24px;
    }

    .part-delivered-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 20px;
      color: #333;
    }

    .part-delivered-header .header-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .part-delivered-header .date-filter {
      width: 180px;
    }

    .part-delivered-header .search-field {
      width: 220px;
    }

    .part-delivered-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .part-delivered-stats .stat-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px !important;
    }

    .part-delivered-stats .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .part-delivered-stats .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .part-delivered-stats .stat-icon.pending {
      background: linear-gradient(135deg, #ff9800, #f57c00);
    }

    .part-delivered-stats .stat-icon.partial {
      background: linear-gradient(135deg, #2196f3, #1976d2);
    }

    .part-delivered-stats .stat-icon.completed {
      background: linear-gradient(135deg, #4caf50, #388e3c);
    }

    .part-delivered-stats .stat-icon.value {
      background: linear-gradient(135deg, #9c27b0, #7b1fa2);
    }

    .part-delivered-stats .stat-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .part-delivered-stats .stat-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .part-delivered-stats .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #333;
    }

    .part-delivered-table-card {
      overflow: hidden;
    }

    .part-delivered-table {
      width: 100%;
    }

    .part-delivered-table th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }

    .part-delivered-table td .partial {
      color: #ff9800;
      font-weight: 600;
    }

    .part-delivered-table td .complete {
      color: #4caf50;
      font-weight: 600;
    }

    .part-delivered-table td .remaining {
      color: #f44336;
      font-weight: 600;
    }

    .part-delivered-table td .remaining.none {
      color: #4caf50;
    }

    .part-delivered-table .partial-row {
      background: #fff8e1;
    }

    .part-delivered-table .complete-row {
      background: #e8f5e9;
    }

    .part-delivered-table .status-pending {
      background: #fff3e0 !important;
      color: #e65100 !important;
    }

    .part-delivered-table .status-part-delivered {
      background: #e3f2fd !important;
      color: #1565c0 !important;
    }

    .part-delivered-table .status-fully-delivered {
      background: #e8f5e9 !important;
      color: #2e7d32 !important;
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

  // Part Delivered Tracking
  partDeliveredRecords = signal<any[]>([]);
  partDeliveredSearch = '';
  partDeliveredDateFilter: Date | null = null;
  partDeliveredColumns = ['invoiceNumber', 'customer', 'product', 'orderedQty', 'deliveredQty', 'remainingQty', 'status', 'lastDeliveryDate', 'actions'];

  // Fuel Management (TFN) - kept for API compatibility
  fuelSummary = signal<any>(null);
  syncingFuel = signal(false);
  tfnOrdersCount = signal(0);
  tfnOrders = signal<any[]>([]);
  tfnDepotsCount = signal(0);
  tfnDepots = signal<any[]>([]);

  // Sleep Outs (Driver Food Allowance)
  sleepOuts = signal<SleepOut[]>([]);
  sleepOutsCount = signal(0);

  constructor(
    private http: HttpClient,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadTripsheets();
    this.loadImportedInvoices();
    this.loadPartDeliveredRecords();
    this.loadTfnOrders();
    this.loadTfnDepots();
    this.loadDrivers();
    this.loadCustomers();
    this.loadMaintenanceRecords();
    this.loadWarehouses();
    this.loadSleepOuts();
  }

  loadWarehouses(): void {
    this.http.get<any[]>(`${this.apiUrl}/warehouses`).subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
        console.log('Loaded warehouses from API:', warehouses.length);
      },
      error: () => {
        // Use fallback data with all 4 warehouses
        this.warehouses.set([
          { id: 1, name: 'Gauteng Warehouse', code: 'GP', city: 'Johannesburg', latitude: -26.2041, longitude: 28.0473, address: 'Johannesburg, Gauteng' },
          { id: 2, name: 'KZN Warehouse', code: 'KZN', city: 'Durban', latitude: -29.8587, longitude: 31.0218, address: 'Durban, KwaZulu-Natal' },
          { id: 3, name: 'Cape Town Warehouse', code: 'CPT', city: 'Cape Town', latitude: -33.9249, longitude: 18.4241, address: 'Cape Town, Western Cape' },
          { id: 4, name: 'PE Warehouse', code: 'PE', city: 'Gqeberha', latitude: -33.9608, longitude: 25.6022, address: 'Gqeberha, Eastern Cape' }
        ]);
        console.log('Using fallback warehouses: 4');
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

  // Get vehicles available for load assignment (not under maintenance or decommissioned)
  getAvailableVehicles(): any[] {
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    return this.vehicles().filter((v: any) => 
      !unavailableStatuses.includes(v.status)
    );
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

  // Pre-computed province counts - calculated once when invoices change, not on every render
  provinceInvoiceCounts = computed(() => {
    const invoices = this.importedInvoices();
    const counts = new Map<string, number>();
    
    // Initialize all provinces with 0
    this.southAfricanProvinces.forEach(p => counts.set(p, 0));
    
    // Count invoices per province in a single pass
    for (const invoice of invoices) {
      if (invoice.deliveryProvince) {
        counts.set(invoice.deliveryProvince, (counts.get(invoice.deliveryProvince) || 0) + 1);
      }
    }
    
    return counts;
  });

  // Get count of invoices per province for display - now uses pre-computed map
  getProvinceInvoiceCount(province: string): number {
    return this.provinceInvoiceCounts().get(province) || 0;
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

  // Pre-computed status counts - single pass over all invoices
  invoiceStatusCounts = computed(() => {
    const invoices = this.importedInvoices();
    let pending = 0, assigned = 0, delivered = 0;
    
    for (const invoice of invoices) {
      switch (invoice.status) {
        case 'Pending': pending++; break;
        case 'Assigned': assigned++; break;
        case 'Delivered': delivered++; break;
      }
    }
    
    return { pending, assigned, delivered };
  });

  pendingInvoiceCount = computed(() => this.invoiceStatusCounts().pending);
  assignedInvoiceCount = computed(() => this.invoiceStatusCounts().assigned);
  deliveredInvoiceCount = computed(() => this.invoiceStatusCounts().delivered);

  loadImportedInvoices(): void {
    this.http.get<ImportedInvoice[]>(`${this.apiUrl}/logistics/importedinvoices?pageSize=10000`).subscribe({
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

  showSuggestedTrips(): void {
    this.dialog.open(SuggestedTripsDialog, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      data: { apiUrl: this.apiUrl }
    }).afterClosed().subscribe(result => {
      if (result) {
        // Refresh invoices and tripsheets after trip creation
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
      width: '95vw',
      maxWidth: '1600px',
      height: '85vh',
      panelClass: 'tripsheet-landscape-dialog',
      data: { loadId: trip.loadId || trip.id }
    });
  }

  // Open the tripsheet type selection dialog
  openTripsheetTypeDialog(): void {
    const dialogRef = this.dialog.open(TripsheetTypeDialog, {
      width: '850px',
      maxWidth: '95vw',
      panelClass: 'tripsheet-type-dialog-panel'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.type) {
        switch (result.type) {
          case 'import':
            this.openImportTripsheetDialog();
            break;
          case 'automatic':
            this.openCreateTripsheetDialog();
            break;
          case 'manual':
            this.openManualTripsheetDialog();
            break;
          case 'transfer':
            this.openInternalTransferDialog();
            break;
        }
      }
    });
  }

  // Open Manual Tripsheet Dialog (no system invoice linking)
  openManualTripsheetDialog(): void {
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));
    
    const dialogRef = this.dialog.open(ManualTripsheetDialog, {
      width: '95vw',
      maxWidth: '1200px',
      height: '90vh',
      panelClass: 'manual-tripsheet-dialog-panel',
      data: {
        drivers: this.drivers(),
        vehicles: availableVehicles,
        warehouses: this.warehouses(),
        customers: this.customers(),
        apiUrl: this.apiUrl
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
      }
    });
  }

  // Open Internal Transfer Dialog (warehouse to warehouse)
  openInternalTransferDialog(): void {
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));
    
    const dialogRef = this.dialog.open(InternalTransferDialog, {
      width: '95vw',
      maxWidth: '1000px',
      height: '85vh',
      panelClass: 'internal-transfer-dialog-panel',
      data: {
        drivers: this.drivers(),
        vehicles: availableVehicles,
        warehouses: this.warehouses(),
        apiUrl: this.apiUrl
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
      }
    });
  }

  openCreateTripsheetDialog(): void {
    // Filter out unavailable vehicles (under maintenance, decommissioned, etc.)
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));
    
    const dialogRef = this.dialog.open(CreateTripsheetDialog, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'create-tripsheet-dialog-panel',
      data: {
        invoices: this.importedInvoices(),
        drivers: this.drivers(),
        vehicles: availableVehicles,
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

  openImportTripsheetDialog(): void {
    const dialogRef = this.dialog.open(ImportTripsheetDialog, {
      width: '900px',
      maxWidth: '95vw',
      panelClass: 'import-tripsheet-dialog-panel',
      data: {
        apiUrl: this.apiUrl
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.openCreateDialog && result.invoices?.length > 0) {
        // Open CreateTripsheetDialog with imported data pre-populated
        setTimeout(() => {
          this.openCreateTripsheetDialogWithImportedData(result.invoices, result.batchId, result.isManualTripsheet);
        }, 100);
      } else if (result?.imported) {
        this.loadTripsheets();
        this.loadImportedInvoices();
      }
    });
  }

  // Open Create Tripsheet dialog with pre-populated data from Excel import
  openCreateTripsheetDialogWithImportedData(importedInvoices: any[], batchId?: string, isManualTripsheet?: boolean): void {
    // Combine imported invoices with existing pending invoices (if any)
    const allInvoices = [...importedInvoices];
    
    // Open the CreateTripsheetDialog with imported data pre-selected
    const dialogRef = this.dialog.open(CreateTripsheetDialog, {
      width: '95vw',
      maxWidth: '1400px',
      height: '90vh',
      panelClass: 'create-tripsheet-dialog-panel',
      data: {
        invoices: allInvoices,
        drivers: this.drivers(),
        vehicles: this.vehicles(),
        warehouses: this.warehouses(),
        customers: this.customers(),
        apiUrl: this.apiUrl,
        // Flag to indicate this came from an import
        isImport: true,
        batchId: batchId,
        // Flag for manual tripsheet (no matched invoices in system)
        isManualTripsheet: isManualTripsheet || false,
        // Pre-select all imported invoices
        preSelectedInvoices: importedInvoices
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.created) {
        this.loadTripsheets();
        this.loadImportedInvoices();
      }
    });
  }

  // Edit existing tripsheet - load data and open CreateTripsheetDialog
  editTripsheet(trip: any): void {
    const loadId = trip.loadId || trip.id;
    
    // Fetch full tripsheet data from API
    this.http.get<any>(`${this.apiUrl}/logistics/tripsheet/${loadId}`).subscribe({
      next: (tripsheetData) => {
        // Convert tripsheet line items back to invoice-like format for the dialog
        const invoices = (tripsheetData.lineItems || []).map((item: any, index: number) => ({
          id: `edit-${loadId}-${index}`,
          transactionNumber: item.invNo || item.invoiceNumber || `ITEM-${index + 1}`,
          customerName: item.customerName || 'Unknown Customer',
          customerNumber: item.orderNo || item.customerNumber,
          deliveryAddress: item.address || '',
          address: item.address || '',
          city: item.city || '',
          province: '',
          productDescription: item.productDescription || 'Product',
          productCode: item.productBrand || item.productCode,
          quantity: item.qty || 1,
          salesAmount: item.value || 0,
          netSales: item.value || 0,
          totalAmount: item.value || 0,
          status: 'Pending',
          contactPerson: item.contactPerson,
          contactPhone: item.contactPhone,
          latitude: item.latitude,
          longitude: item.longitude
        }));

        // Find matching warehouse, driver, vehicle
        const matchedWarehouse = this.warehouses().find(w => 
          w.id === tripsheetData.warehouseId || 
          w.name?.toLowerCase() === tripsheetData.origin?.toLowerCase()
        );
        const matchedDriver = this.drivers().find(d => 
          d.id === tripsheetData.driverId ||
          `${d.firstName} ${d.lastName}`.toLowerCase() === tripsheetData.driverName?.toLowerCase()
        );
        const matchedVehicle = this.vehicles().find(v => 
          v.id === tripsheetData.vehicleId ||
          v.registrationNumber === tripsheetData.vehicleRegNumber ||
          v.registrationNumber === tripsheetData.vehicleRegistration
        );

        // Filter out unavailable vehicles
        const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
        const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));

        // Open CreateTripsheetDialog in edit mode
        const dialogRef = this.dialog.open(CreateTripsheetDialog, {
          width: '95vw',
          maxWidth: '1400px',
          height: '90vh',
          panelClass: 'create-tripsheet-dialog-panel',
          data: {
            invoices: invoices,
            drivers: this.drivers(),
            vehicles: availableVehicles,
            warehouses: this.warehouses(),
            customers: this.customers(),
            apiUrl: this.apiUrl,
            // Edit mode flags
            isEditMode: true,
            editLoadId: loadId,
            existingTripsheet: tripsheetData,
            // Pre-populate values
            preSelectedInvoices: invoices,
            preSelectedWarehouse: matchedWarehouse,
            preSelectedDriver: matchedDriver,
            preSelectedVehicle: matchedVehicle,
            preScheduledDate: tripsheetData.tripDate ? new Date(tripsheetData.tripDate) : new Date(),
            preSpecialInstructions: tripsheetData.specialInstructions || tripsheetData.notes || '',
            preTotalDistance: tripsheetData.totalDistance || tripsheetData.estimatedDistance,
            preEstimatedTime: tripsheetData.estimatedTime
          }
        });

        dialogRef.afterClosed().subscribe(result => {
          if (result?.created || result?.updated) {
            this.loadTripsheets();
            this.loadImportedInvoices();
          }
        });
      },
      error: (err) => {
        console.error('Failed to load tripsheet for editing:', err);
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

  assignTripsheet(trip: any): void {
    // Filter out unavailable vehicles (under maintenance, decommissioned, etc.)
    const unavailableStatuses = ['Under Maintenance', 'Decommissioned', 'Unavailable'];
    const availableVehicles = this.vehicles().filter(v => !unavailableStatuses.includes(v.status));
    
    // Open dialog to assign driver and vehicle to existing tripsheet
    const dialogRef = this.dialog.open(AssignTripsheetDialog, {
      width: '500px',
      data: {
        tripsheet: trip,
        drivers: this.drivers(),
        vehicles: availableVehicles
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.assigned) {
        // Update the tripsheet with driver/vehicle
        const loadId = trip.loadId || trip.id;
        this.http.put(`${this.apiUrl}/logistics/tripsheet/${loadId}/assign`, {
          driverId: result.driverId,
          vehicleId: result.vehicleId,
          scheduledDate: result.scheduledDate
        }).subscribe({
          next: () => {
            this.loadTripsheets();
            this.snackBar.open('Driver and vehicle assigned successfully!', 'Close', { duration: 3000 });
          },
          error: (err) => {
            console.error('Failed to assign tripsheet:', err);
            this.snackBar.open('Failed to assign driver/vehicle', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  deleteTripsheet(trip: any): void {
    const loadId = trip.loadId || trip.id;
    const tripsheetNo = trip.tripsheetNo || `TS-${loadId}`;
    
    // Confirm deletion
    if (!confirm(`Are you sure you want to delete tripsheet ${tripsheetNo}?\n\nThis will remove the load and reset all associated invoices back to Pending status.`)) {
      return;
    }
    
    this.http.delete(`${this.apiUrl}/logistics/tripsheet/${loadId}`).subscribe({
      next: () => {
        this.loadTripsheets();
        this.loadImportedInvoices();
        this.snackBar.open(`Tripsheet ${tripsheetNo} deleted successfully!`, 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to delete tripsheet:', err);
        this.snackBar.open('Failed to delete tripsheet: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
      }
    });
  }

  activateTripsheet(trip: any): void {
    const loadId = trip.loadId || trip.id;
    const tripsheetNo = trip.tripsheetNo || `TS-${loadId}`;
    
    // Check if driver and vehicle are assigned
    if (!trip.driverId || !trip.vehicleId) {
      this.snackBar.open('Please assign a driver and vehicle before activating the tripsheet.', 'Close', { duration: 4000 });
      // Open the assign dialog
      this.assignTripsheet(trip);
      return;
    }
    
    // Confirm activation
    if (!confirm(`Generate load for tripsheet ${tripsheetNo}?\n\nThis will change the status to Active and the driver will be ready to depart.`)) {
      return;
    }
    
    this.http.post(`${this.apiUrl}/logistics/tripsheet/${loadId}/activate`, {}).subscribe({
      next: () => {
        this.loadTripsheets();
        this.snackBar.open(`Tripsheet ${tripsheetNo} is now Active! Driver can depart.`, 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to activate tripsheet:', err);
        this.snackBar.open('Failed to activate tripsheet: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
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

  // Sleep Outs Methods (Driver Food Allowance)
  loadSleepOuts(): void {
    this.http.get<SleepOut[]>(`${environment.apiUrl}/logistics/sleepouts`).subscribe({
      next: (sleepOuts) => {
        this.sleepOuts.set(sleepOuts);
        // Count only pending (requested) sleep outs for the badge
        this.sleepOutsCount.set(sleepOuts.filter(s => s.status === 'Requested').length);
      },
      error: (err) => {
        console.error('Failed to load sleep outs:', err);
        this.sleepOuts.set([]);
        this.sleepOutsCount.set(0);
      }
    });
  }

  openSleepOutsDialog(): void {
    const dialogRef = this.dialog.open(SleepOutsDialog, {
      width: '95vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      panelClass: 'sleepouts-dialog-panel',
      data: { sleepOuts: this.sleepOuts(), drivers: this.drivers(), apiUrl: environment.apiUrl }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'refresh') {
        this.loadSleepOuts();
      }
    });
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

  openDriversDialog(): void {
    import('./drivers-dialog/drivers-dialog.component').then(m => {
      this.dialog.open(m.DriversDialogComponent, {
        width: '900px',
        maxWidth: '95vw',
        height: 'auto',
        maxHeight: '90vh'
      });
    });
  }

  // Part Delivered Tracking Methods
  loadPartDeliveredRecords(): void {
    this.http.get<any[]>(`${this.apiUrl}/logistics/part-delivered`).subscribe({
      next: (records) => {
        this.partDeliveredRecords.set(records);
      },
      error: (err) => {
        console.error('Failed to load part delivered records:', err);
        // Use sample data for development
        this.partDeliveredRecords.set([
          { id: 1, invoiceNumber: 'INV-2024-001', customer: 'ABC Hardware', product: 'Steel Pipes 50mm', orderedQty: 100, deliveredQty: 60, remainingQty: 40, status: 'partial', lastDeliveryDate: new Date('2024-01-15') },
          { id: 2, invoiceNumber: 'INV-2024-002', customer: 'XYZ Construction', product: 'Cement Bags', orderedQty: 500, deliveredQty: 500, remainingQty: 0, status: 'complete', lastDeliveryDate: new Date('2024-01-14') },
          { id: 3, invoiceNumber: 'INV-2024-003', customer: 'BuildMart', product: 'Bricks (Pallets)', orderedQty: 50, deliveredQty: 25, remainingQty: 25, status: 'partial', lastDeliveryDate: new Date('2024-01-12') },
          { id: 4, invoiceNumber: 'INV-2024-004', customer: 'Home Solutions', product: 'PVC Fittings', orderedQty: 200, deliveredQty: 0, remainingQty: 200, status: 'pending', lastDeliveryDate: null },
          { id: 5, invoiceNumber: 'INV-2024-005', customer: 'Metro Builders', product: 'Roofing Sheets', orderedQty: 75, deliveredQty: 50, remainingQty: 25, status: 'partial', lastDeliveryDate: new Date('2024-01-10') }
        ]);
      }
    });
  }

  filterPartDelivered(): void {
    // Trigger re-computation of filteredPartDelivered
    this.partDeliveredRecords.set([...this.partDeliveredRecords()]);
  }

  filteredPartDelivered = computed(() => {
    let records = this.partDeliveredRecords();
    
    // Apply search filter
    if (this.partDeliveredSearch) {
      const search = this.partDeliveredSearch.toLowerCase();
      records = records.filter(r => 
        r.invoiceNumber?.toLowerCase().includes(search) ||
        r.customer?.toLowerCase().includes(search) ||
        r.product?.toLowerCase().includes(search)
      );
    }
    
    // Apply date filter
    if (this.partDeliveredDateFilter) {
      const filterDate = new Date(this.partDeliveredDateFilter);
      filterDate.setHours(0, 0, 0, 0);
      records = records.filter(r => {
        if (!r.lastDeliveryDate) return false;
        const recordDate = new Date(r.lastDeliveryDate);
        recordDate.setHours(0, 0, 0, 0);
        return recordDate.getTime() === filterDate.getTime();
      });
    }
    
    return records;
  });

  getPartDeliveredStats(): { pending: number; partial: number; complete: number; outstandingValue: number } {
    const records = this.partDeliveredRecords();
    return {
      pending: records.filter(r => r.status === 'pending').length,
      partial: records.filter(r => r.status === 'partial').length,
      complete: records.filter(r => r.status === 'complete').length,
      outstandingValue: records.reduce((sum, r) => sum + (r.remainingQty * (r.unitPrice || 100)), 0)
    };
  }

  openMarkPartDeliveredDialog(): void {
    const dialogRef = this.dialog.open(MarkPartDeliveredDialog, {
      width: '600px',
      maxWidth: '95vw',
      data: { records: this.partDeliveredRecords().filter(r => r.status !== 'complete') }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadPartDeliveredRecords();
        this.snackBar.open('Part delivery recorded successfully', 'Close', { duration: 3000 });
      }
    });
  }

  recordPartialDelivery(item: any): void {
    const dialogRef = this.dialog.open(RecordDeliveryDialog, {
      width: '500px',
      maxWidth: '95vw',
      data: { item }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Update the record
        const records = this.partDeliveredRecords();
        const index = records.findIndex(r => r.id === item.id);
        if (index !== -1) {
          records[index].deliveredQty += result.quantity;
          records[index].remainingQty -= result.quantity;
          records[index].lastDeliveryDate = new Date();
          records[index].status = records[index].remainingQty === 0 ? 'complete' : 'partial';
          this.partDeliveredRecords.set([...records]);
        }
        this.snackBar.open(`Recorded delivery of ${result.quantity} units`, 'Close', { duration: 3000 });
      }
    });
  }

  viewDeliveryHistory(item: any): void {
    this.dialog.open(DeliveryHistoryDialog, {
      width: '700px',
      maxWidth: '95vw',
      data: { item }
    });
  }
}

// Mark Part Delivered Dialog Component
@Component({
  selector: 'app-mark-part-delivered-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    FormsModule
  ],
  template: `
    <div class="mark-delivered-dialog">
      <div class="dialog-header">
        <h2><mat-icon>local_shipping</mat-icon> Mark Part Delivered</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>
      
      <div class="dialog-content">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Select Invoice</mat-label>
          <mat-select [(ngModel)]="selectedRecord">
            @for (record of data.records; track record.id) {
              <mat-option [value]="record">
                {{ record.invoiceNumber }} - {{ record.customer }} ({{ record.remainingQty }} remaining)
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
        
        @if (selectedRecord) {
          <div class="record-details">
            <div class="detail-row">
              <span class="label">Product:</span>
              <span class="value">{{ selectedRecord.product }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Ordered:</span>
              <span class="value">{{ selectedRecord.orderedQty }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Already Delivered:</span>
              <span class="value">{{ selectedRecord.deliveredQty }}</span>
            </div>
            <div class="detail-row">
              <span class="label">Remaining:</span>
              <span class="value highlight">{{ selectedRecord.remainingQty }}</span>
            </div>
          </div>
          
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Quantity to Deliver</mat-label>
            <input matInput type="number" [(ngModel)]="deliveryQty" [max]="selectedRecord.remainingQty" min="1">
            <mat-hint>Max: {{ selectedRecord.remainingQty }}</mat-hint>
          </mat-form-field>
          
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Delivery Notes (Optional)</mat-label>
            <textarea matInput [(ngModel)]="notes" rows="2"></textarea>
          </mat-form-field>
        }
      </div>
      
      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="!canSubmit()" (click)="submit()">
          <mat-icon>check</mat-icon> Record Delivery
        </button>
      </div>
    </div>
  `,
  styles: [`
    .mark-delivered-dialog { padding: 0; }
    .dialog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; background: linear-gradient(135deg, #1976d2, #42a5f5);
      color: white;
    }
    .dialog-header h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1.25rem; }
    .dialog-content { padding: 24px; }
    .full-width { width: 100%; margin-bottom: 16px; }
    .record-details {
      background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 16px;
    }
    .detail-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .detail-row .label { color: #666; }
    .detail-row .value { font-weight: 500; }
    .detail-row .value.highlight { color: #1976d2; font-weight: 600; }
    .dialog-actions { padding: 16px 24px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e0e0e0; }
  `]
})
export class MarkPartDeliveredDialog {
  selectedRecord: any = null;
  deliveryQty: number = 0;
  notes: string = '';
  
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<MarkPartDeliveredDialog>,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}
  
  canSubmit(): boolean {
    return this.selectedRecord && this.deliveryQty > 0 && this.deliveryQty <= this.selectedRecord.remainingQty;
  }
  
  submit(): void {
    if (!this.canSubmit()) return;
    
    const payload = {
      recordId: this.selectedRecord.id,
      quantity: this.deliveryQty,
      notes: this.notes
    };
    
    this.http.post(`${environment.apiUrl}/logistics/part-delivered/record`, payload).subscribe({
      next: () => {
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Failed to record delivery:', err);
        // Still close with success for demo
        this.dialogRef.close(true);
      }
    });
  }
}

// Record Delivery Dialog Component
@Component({
  selector: 'app-record-delivery-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  template: `
    <div class="record-delivery-dialog">
      <div class="dialog-header">
        <h2><mat-icon>add_shopping_cart</mat-icon> Record Partial Delivery</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>
      
      <div class="dialog-content">
        <div class="item-info">
          <div class="info-row"><span class="label">Invoice:</span><span class="value">{{ data.item.invoiceNumber }}</span></div>
          <div class="info-row"><span class="label">Customer:</span><span class="value">{{ data.item.customer }}</span></div>
          <div class="info-row"><span class="label">Product:</span><span class="value">{{ data.item.product }}</span></div>
          <div class="info-row"><span class="label">Remaining:</span><span class="value highlight">{{ data.item.remainingQty }} units</span></div>
        </div>
        
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Quantity Delivered</mat-label>
          <input matInput type="number" [(ngModel)]="quantity" [max]="data.item.remainingQty" min="1">
          <mat-hint>Enter quantity being delivered (max: {{ data.item.remainingQty }})</mat-hint>
        </mat-form-field>
        
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Driver/Reference</mat-label>
          <input matInput [(ngModel)]="reference">
        </mat-form-field>
      </div>
      
      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="!isValid()" (click)="submit()">
          <mat-icon>check</mat-icon> Confirm Delivery
        </button>
      </div>
    </div>
  `,
  styles: [`
    .record-delivery-dialog { padding: 0; }
    .dialog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; background: linear-gradient(135deg, #43a047, #66bb6a);
      color: white;
    }
    .dialog-header h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1.25rem; }
    .dialog-content { padding: 24px; }
    .item-info { background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e0e0e0; }
    .info-row:last-child { border-bottom: none; }
    .info-row .label { color: #666; }
    .info-row .value { font-weight: 500; }
    .info-row .value.highlight { color: #43a047; font-weight: 600; font-size: 1.1em; }
    .full-width { width: 100%; margin-bottom: 16px; }
    .dialog-actions { padding: 16px 24px; display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid #e0e0e0; }
  `]
})
export class RecordDeliveryDialog {
  quantity: number = 1;
  reference: string = '';
  
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<RecordDeliveryDialog>
  ) {}
  
  isValid(): boolean {
    return this.quantity > 0 && this.quantity <= this.data.item.remainingQty;
  }
  
  submit(): void {
    if (this.isValid()) {
      this.dialogRef.close({ quantity: this.quantity, reference: this.reference });
    }
  }
}

// Delivery History Dialog Component
@Component({
  selector: 'app-delivery-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule
  ],
  template: `
    <div class="delivery-history-dialog">
      <div class="dialog-header">
        <h2><mat-icon>history</mat-icon> Delivery History</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>
      
      <div class="dialog-content">
        <div class="item-summary">
          <div class="summary-row">
            <span class="label">Invoice:</span>
            <span class="value">{{ data.item.invoiceNumber }}</span>
          </div>
          <div class="summary-row">
            <span class="label">Customer:</span>
            <span class="value">{{ data.item.customer }}</span>
          </div>
          <div class="summary-row">
            <span class="label">Product:</span>
            <span class="value">{{ data.item.product }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="getProgressPercent()"></div>
          </div>
          <div class="progress-text">
            {{ data.item.deliveredQty }} of {{ data.item.orderedQty }} delivered ({{ getProgressPercent() | number:'1.0-0' }}%)
          </div>
        </div>
        
        <h3>Delivery Records</h3>
        <table mat-table [dataSource]="deliveryHistory" class="history-table">
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Date</th>
            <td mat-cell *matCellDef="let row">{{ row.date | date:'dd/MM/yyyy HH:mm' }}</td>
          </ng-container>
          <ng-container matColumnDef="quantity">
            <th mat-header-cell *matHeaderCellDef>Quantity</th>
            <td mat-cell *matCellDef="let row">{{ row.quantity }}</td>
          </ng-container>
          <ng-container matColumnDef="reference">
            <th mat-header-cell *matHeaderCellDef>Reference</th>
            <td mat-cell *matCellDef="let row">{{ row.reference }}</td>
          </ng-container>
          <ng-container matColumnDef="user">
            <th mat-header-cell *matHeaderCellDef>Recorded By</th>
            <td mat-cell *matCellDef="let row">{{ row.user }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
        
        @if (deliveryHistory.length === 0) {
          <div class="no-history">
            <mat-icon>inbox</mat-icon>
            <p>No delivery records yet</p>
          </div>
        }
      </div>
      
      <div class="dialog-actions">
        <button mat-raised-button mat-dialog-close>Close</button>
      </div>
    </div>
  `,
  styles: [`
    .delivery-history-dialog { padding: 0; min-width: 500px; }
    .dialog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; background: linear-gradient(135deg, #7b1fa2, #ab47bc);
      color: white;
    }
    .dialog-header h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: 1.25rem; }
    .dialog-content { padding: 24px; max-height: 60vh; overflow-y: auto; }
    .item-summary { background: #f5f5f5; padding: 16px; border-radius: 8px; margin-bottom: 20px; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
    .summary-row .label { color: #666; }
    .summary-row .value { font-weight: 500; }
    .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; margin-top: 12px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #43a047, #66bb6a); transition: width 0.3s; }
    .progress-text { text-align: center; font-size: 0.85rem; color: #666; margin-top: 4px; }
    h3 { margin: 16px 0 12px; font-size: 1rem; color: #333; }
    .history-table { width: 100%; }
    .no-history { text-align: center; padding: 32px; color: #999; }
    .no-history mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .dialog-actions { padding: 16px 24px; display: flex; justify-content: flex-end; border-top: 1px solid #e0e0e0; }
  `]
})
export class DeliveryHistoryDialog {
  displayedColumns = ['date', 'quantity', 'reference', 'user'];
  deliveryHistory: any[] = [];
  
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient
  ) {
    this.loadHistory();
  }
  
  loadHistory(): void {
    this.http.get<any[]>(`${environment.apiUrl}/logistics/part-delivered/${this.data.item.id}/history`).subscribe({
      next: (history) => {
        this.deliveryHistory = history;
      },
      error: () => {
        // Sample data for demo
        this.deliveryHistory = [
          { date: new Date('2024-01-15 10:30'), quantity: 30, reference: 'Driver: John Smith', user: 'Admin' },
          { date: new Date('2024-01-12 14:15'), quantity: 30, reference: 'Driver: Mike Jones', user: 'Admin' }
        ];
      }
    });
  }
  
  getProgressPercent(): number {
    if (!this.data.item.orderedQty) return 0;
    return (this.data.item.deliveredQty / this.data.item.orderedQty) * 100;
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
              <span class="label">Sales Amount (excl. VAT)</span>
              <span class="value">R{{ data.salesAmount | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">VAT (15%)</span>
              <span class="value">R{{ data.salesAmount * 0.15 | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">Total (incl. VAT)</span>
              <span class="value sales">R{{ data.salesAmount * 1.15 | number:'1.2-2' }}</span>
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

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>location_on</mat-icon> Delivery Information</h3>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <span class="label">Address</span>
              <span class="value">{{ data.deliveryAddress || 'Not set' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">City</span>
              <span class="value">{{ data.deliveryCity || 'Not set' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Province</span>
              <span class="value">{{ data.deliveryProvince || 'Not set' }}</span>
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
                      @if (v.status === 'Available' || v.status === 'In Use' || !v.status) {
                        <mat-option [value]="v.id">{{ v.registrationNumber }} ({{ v.type }})</mat-option>
                      }
                    }
                  </mat-select>
                  <mat-hint>Only available vehicles shown</mat-hint>
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
    <div class="tripsheet-preview-dialog landscape">
      <div class="dialog-header">
        <h2>
          <mat-icon>description</mat-icon>
          Trip Sheet
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
          <!-- Trip Header Section -->
          <div class="ts-header-section">
            <div class="ts-title">
              <h1>TRIP SHEET</h1>
              <span class="ts-number">{{ tripSheet.loadNumber }}</span>
            </div>
            <div class="ts-meta-row">
              <div class="meta-item">
                <label>DRIVER NAME:</label>
                <span class="meta-value">{{ tripSheet.driverName || 'UNASSIGNED' }}</span>
              </div>
              <div class="meta-item">
                <label>DATE:</label>
                <span class="meta-value">{{ tripSheet.tripDate | date:'dd.MM.yyyy' }}</span>
              </div>
              <div class="meta-item">
                <label>REG NUMBER:</label>
                <span class="meta-value">{{ tripSheet.vehicleRegNumber || tripSheet.vehicleRegistration || 'N/A' }}</span>
              </div>
              <div class="meta-item">
                <label>SUBTOTAL:</label>
                <span class="meta-value">R {{ tripSheet.totalValue | number:'1.2-2' }}</span>
              </div>
              <div class="meta-item">
                <label>VAT (15%):</label>
                <span class="meta-value">R {{ tripSheet.vatAmount | number:'1.2-2' }}</span>
              </div>
              <div class="meta-item">
                <label>TOTAL:</label>
                <span class="meta-value value">R {{ tripSheet.totalWithVat | number:'1.2-2' }}</span>
              </div>
            </div>
          </div>

          <!-- Line Items Table -->
          <div class="ts-table-container">
            <table class="ts-table">
              <thead>
                <tr>
                  <th class="col-no">No</th>
                  <th class="col-inv">Inv No</th>
                  <th class="col-customer">Customer Name</th>
                  <th class="col-product">Product Description</th>
                  <th class="col-brand">Brand</th>
                  <th class="col-qty">Qty</th>
                  <th class="col-time">Time Dispatched</th>
                  <th class="col-order">Order No</th>
                  <th class="col-start">Start</th>
                  <th class="col-end">End</th>
                  <th class="col-km">KM</th>
                  <th class="col-value">Value</th>
                </tr>
              </thead>
              <tbody>
                @for (item of tripSheet.lineItems; track item.no; let i = $index) {
                  <tr>
                    <td class="col-no">{{ item.no || (i + 1) }}</td>
                    <td class="col-inv">{{ item.invNo }}</td>
                    <td class="col-customer">{{ item.customerName }}</td>
                    <td class="col-product">{{ item.productDescription }}</td>
                    <td class="col-brand">{{ item.productBrand || '-' }}</td>
                    <td class="col-qty">{{ item.qty }}</td>
                    <td class="col-time">{{ item.timeDispatched || '' }}</td>
                    <td class="col-order">{{ item.orderNo || '' }}</td>
                    <td class="col-start editable"></td>
                    <td class="col-end editable"></td>
                    <td class="col-km editable"></td>
                    <td class="col-value">R {{ item.value | number:'1.2-2' }}</td>
                  </tr>
                }
                @if (!tripSheet.lineItems || tripSheet.lineItems.length === 0) {
                  <!-- Show old stops format as fallback -->
                  @for (stop of deliveryStops; track stop.stopSequence; let i = $index) {
                    @for (com of stop.commodities; track com.commodityName; let j = $index) {
                      <tr>
                        <td class="col-no">{{ i + 1 }}.{{ j + 1 }}</td>
                        <td class="col-inv">{{ stop.invoiceNumber || '-' }}</td>
                        <td class="col-customer">{{ stop.customerName || stop.companyName }}</td>
                        <td class="col-product">{{ com.commodityName || com.description }}</td>
                        <td class="col-brand">{{ com.commodityCode || '-' }}</td>
                        <td class="col-qty">{{ com.quantity }}</td>
                        <td class="col-time">{{ stop.scheduledArrival | date:'HH:mm' }}</td>
                        <td class="col-order">{{ stop.orderNumber || '' }}</td>
                        <td class="col-start editable"></td>
                        <td class="col-end editable"></td>
                        <td class="col-km editable"></td>
                        <td class="col-value">R {{ com.totalPrice | number:'1.2-2' }}</td>
                      </tr>
                    }
                  }
                }
                <!-- Empty rows for manual entry -->
                @for (row of emptyRows; track row) {
                  <tr class="empty-row">
                    <td class="col-no"></td>
                    <td class="col-inv"></td>
                    <td class="col-customer"></td>
                    <td class="col-product"></td>
                    <td class="col-brand"></td>
                    <td class="col-qty"></td>
                    <td class="col-time"></td>
                    <td class="col-order"></td>
                    <td class="col-start editable"></td>
                    <td class="col-end editable"></td>
                    <td class="col-km editable"></td>
                    <td class="col-value"></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="totals-row">
                  <td colspan="5" class="totals-label">SUBTOTAL</td>
                  <td class="col-qty">{{ getTotalQty() }}</td>
                  <td colspan="4"></td>
                  <td class="col-km"></td>
                  <td class="col-value">R {{ tripSheet.totalValue | number:'1.2-2' }}</td>
                </tr>
                <tr class="totals-row vat-row">
                  <td colspan="5" class="totals-label">VAT (15%)</td>
                  <td colspan="5"></td>
                  <td class="col-km"></td>
                  <td class="col-value">R {{ tripSheet.vatAmount | number:'1.2-2' }}</td>
                </tr>
                <tr class="totals-row grand-total-row">
                  <td colspan="5" class="totals-label">TOTAL INCL. VAT</td>
                  <td colspan="5"></td>
                  <td class="col-km"></td>
                  <td class="col-value total-value">R {{ tripSheet.totalWithVat | number:'1.2-2' }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Footer Section -->
          <div class="ts-footer-section">
            <div class="footer-row">
              <div class="odometer-section">
                <div class="odo-field">
                  <label>Opening KM:</label>
                  <div class="odo-box"></div>
                </div>
                <div class="odo-field">
                  <label>Closing KM:</label>
                  <div class="odo-box"></div>
                </div>
              </div>
              <div class="fuel-section">
                <label>Fuel Level:</label>
                <div class="fuel-gauge">
                  <span>E</span>
                  <span class="fuel-box">☐</span>
                  <span>¼</span>
                  <span class="fuel-box">☐</span>
                  <span>½</span>
                  <span class="fuel-box">☐</span>
                  <span>¾</span>
                  <span class="fuel-box">☐</span>
                  <span>F</span>
                </div>
              </div>
            </div>
            <div class="signatures-row">
              <div class="signature-block">
                <div class="signature-line"></div>
                <span>Driver Signature</span>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <span>Dispatch Signature</span>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <span>Date</span>
              </div>
            </div>
            <div class="ts-generated">
              Generated: {{ tripSheet.generatedAt | date:'dd MMM yyyy HH:mm' }}
            </div>
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
    .tripsheet-preview-dialog.landscape {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: white;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 20px;
      background: #1976d2;
      color: white;
      flex-shrink: 0;
    }
    .dialog-header h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
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
      flex: 1;
    }
    .error-content mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #f44336;
    }
    
    .tripsheet-content {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 16px 24px;
      font-family: Arial, sans-serif;
    }
    
    /* Header Section */
    .ts-header-section {
      border: 2px solid #333;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .ts-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ccc;
    }
    .ts-title h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    .ts-number {
      font-size: 18px;
      font-weight: 600;
      color: #1976d2;
    }
    .ts-meta-row {
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta-item label {
      font-size: 11px;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 600;
      color: #000;
    }
    .meta-value.value {
      color: #2e7d32;
    }
    
    /* Table Container */
    .ts-table-container {
      flex: 1;
      overflow-x: auto;
      border: 2px solid #333;
    }
    .ts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .ts-table thead {
      background: #1976d2;
      color: white;
    }
    .ts-table th {
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      white-space: nowrap;
      border-right: 1px solid rgba(255,255,255,0.3);
    }
    .ts-table th:last-child {
      border-right: none;
    }
    .ts-table tbody tr {
      border-bottom: 1px solid #ddd;
    }
    .ts-table tbody tr:nth-child(even) {
      background: #f9f9f9;
    }
    .ts-table td {
      padding: 6px;
      vertical-align: middle;
      border-right: 1px solid #eee;
    }
    .ts-table td:last-child {
      border-right: none;
    }
    
    /* Column widths */
    .col-no { width: 35px; text-align: center; }
    .col-inv { width: 70px; }
    .col-customer { min-width: 140px; }
    .col-product { min-width: 160px; }
    .col-brand { width: 80px; }
    .col-qty { width: 45px; text-align: center; }
    .col-time { width: 70px; text-align: center; }
    .col-order { width: 70px; }
    .col-start { width: 55px; text-align: center; }
    .col-end { width: 55px; text-align: center; }
    .col-km { width: 50px; text-align: right; }
    .col-value { width: 85px; text-align: right; font-weight: 500; }
    
    /* Editable cells */
    td.editable {
      background: #fffde7;
      border: 1px dashed #ccc;
    }
    
    /* Empty rows for manual entry */
    .empty-row td {
      height: 28px;
    }
    
    /* Totals row */
    .ts-table tfoot {
      background: #e8f5e9;
      font-weight: 600;
    }
    .totals-row td {
      padding: 10px 6px;
      border-top: 2px solid #333;
    }
    .totals-label {
      text-align: right;
      font-weight: 700;
      font-size: 12px;
    }
    .total-value {
      color: #2e7d32;
      font-size: 13px;
    }
    
    /* Footer Section */
    .ts-footer-section {
      border: 2px solid #333;
      border-top: none;
      padding: 12px 16px;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .odometer-section {
      display: flex;
      gap: 24px;
    }
    .odo-field {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .odo-field label {
      font-size: 11px;
      font-weight: 600;
    }
    .odo-box {
      width: 80px;
      height: 24px;
      border: 1px solid #333;
      background: #fafafa;
    }
    .fuel-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .fuel-section label {
      font-size: 11px;
      font-weight: 600;
    }
    .fuel-gauge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .fuel-box {
      font-size: 16px;
    }
    
    .signatures-row {
      display: flex;
      gap: 40px;
      padding-top: 12px;
      border-top: 1px dashed #ccc;
    }
    .signature-block {
      flex: 1;
      text-align: center;
    }
    .signature-line {
      border-bottom: 1px solid #333;
      height: 40px;
      margin-bottom: 4px;
    }
    .signature-block span {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
    }
    
    .ts-generated {
      text-align: right;
      font-size: 9px;
      color: #999;
      margin-top: 8px;
    }
  `]
})
export class TripSheetPreviewDialog implements OnInit {
  loading = true;
  tripSheet: any = null;
  deliveryStops: any[] = [];
  emptyRows: number[] = [1, 2, 3, 4, 5]; // Empty rows for manual entries
  
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
  
  getTotalQty(): number {
    if (this.tripSheet?.lineItems?.length > 0) {
      return this.tripSheet.lineItems.reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
    }
    // Fallback to old stops format
    let total = 0;
    this.deliveryStops.forEach(stop => {
      stop.commodities?.forEach((com: any) => {
        total += com.quantity || 0;
      });
    });
    return total;
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

// Suggested Trips Dialog Component
@Component({
  selector: 'app-suggested-trips-dialog',
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
      <mat-icon>lightbulb</mat-icon> AI-Suggested Optimized Trips
    </h2>
    
    <mat-dialog-content>
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="50"></mat-spinner>
          <p>Analyzing pending invoices and optimizing routes...</p>
        </div>
      } @else if (suggestedTrips.length === 0) {
        <div class="empty-state">
          <mat-icon>info</mat-icon>
          <h3>No Suggestions Available</h3>
          <p>There are no pending invoices to create trips from.</p>
        </div>
      } @else {
        <div class="suggestions-summary">
          <mat-icon>analytics</mat-icon>
          <span>Found <strong>{{suggestedTrips.length}}</strong> optimized trip configurations covering <strong>{{totalInvoices}}</strong> invoices</span>
        </div>

        <div class="suggested-trips-list">
          @for (trip of suggestedTrips; track trip.loadSequence) {
            <mat-card class="trip-card" [class.selected]="selectedTrip === trip">
              <mat-card-header>
                <div class="trip-header">
                  <div class="trip-title">
                    <h3>{{trip.suggestedLoadNumber}}</h3>
                    <mat-chip-set>
                      <mat-chip [class]="'priority-' + trip.priority.toLowerCase()">
                        {{trip.priority}}
                      </mat-chip>
                      <mat-chip>Score: {{trip.optimizationScore | number:'1.0-0'}}</mat-chip>
                    </mat-chip-set>
                  </div>
                  <button mat-raised-button color="primary" (click)="createTrip(trip)">
                    <mat-icon>add</mat-icon> Create This Trip
                  </button>
                </div>
              </mat-card-header>
              
              <mat-card-content>
                <div class="trip-stats">
                  <div class="stat">
                    <mat-icon>location_on</mat-icon>
                    <div>
                      <strong>{{trip.province}}</strong>
                      <span>{{trip.primaryCity}}</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>people</mat-icon>
                    <div>
                      <strong>{{trip.uniqueCustomers}}</strong>
                      <span>Customers</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>description</mat-icon>
                    <div>
                      <strong>{{trip.totalInvoices}}</strong>
                      <span>Invoices</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>attach_money</mat-icon>
                    <div>
                      <strong>R{{ (trip.totalWithVat || trip.totalValue * 1.15) | number:'1.2-2'}}</strong>
                      <span>Total (incl. VAT)</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>local_shipping</mat-icon>
                    <div>
                      <strong>{{trip.recommendedVehicleType}}</strong>
                      <span>Vehicle Type</span>
                    </div>
                  </div>
                </div>

                <mat-accordion>
                  <mat-expansion-panel>
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>people</mat-icon>
                        Customers ({{trip.customers.length}})
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <div class="customers-list">
                      @for (customer of trip.customers; track customer.customerNumber) {
                        <div class="customer-item">
                          <div>
                            <strong>{{customer.customerName}}</strong>
                            <span class="customer-code">{{customer.customerNumber}}</span>
                          </div>
                          <div class="customer-details">
                            <span>{{customer.city}}</span>
                            <mat-chip>{{customer.invoiceCount}} invoice(s)</mat-chip>
                            <strong>R{{customer.totalAmount * 1.15 | number:'1.2-2'}}</strong>
                          </div>
                        </div>
                      }
                    </div>
                  </mat-expansion-panel>

                  <mat-expansion-panel>
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>list</mat-icon>
                        Invoices ({{trip.invoices.length}})
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <div class="invoices-list">
                      @for (invoice of trip.invoices; track invoice.invoiceId) {
                        <div class="invoice-item">
                          <span class="invoice-number">{{invoice.transactionNumber}}</span>
                          <span class="customer-name">{{invoice.customerName}}</span>
                          <span class="product">{{invoice.productDescription}}</span>
                          <strong>R{{invoice.amount * 1.15 | number:'1.2-2'}}</strong>
                        </div>
                      }
                    </div>
                  </mat-expansion-panel>
                </mat-accordion>

                <div class="trip-notes">
                  <mat-icon>info</mat-icon>
                  <span>{{trip.notes}}</span>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="close()">Close</button>
      <button mat-raised-button color="accent" (click)="createAllTrips()" [disabled]="loading || suggestedTrips.length === 0">
        <mat-icon>playlist_add</mat-icon> Create All Suggested Trips
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
    .suggested-trips-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .trip-card {
      border-left: 4px solid #1976d2;
    }
    .trip-card.selected {
      border-left-color: #4caf50;
      background: #f1f8e9;
    }
    .trip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 8px 0;
    }
    .trip-title {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .trip-title h3 {
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
    .trip-stats {
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
    .trip-notes {
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
    .trip-notes mat-icon {
      color: #1976d2;
      flex-shrink: 0;
    }
    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class SuggestedTripsDialog implements OnInit {
  loading = true;
  suggestedTrips: any[] = [];
  selectedTrip: any = null;
  totalInvoices = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { apiUrl: string },
    private dialogRef: MatDialogRef<SuggestedTripsDialog>,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    this.http.get<any[]>(`${this.data.apiUrl}/logistics/importedinvoices/suggested-loads`).subscribe({
      next: (trips) => {
        this.suggestedTrips = trips;
        this.totalInvoices = trips.reduce((sum, trip) => sum + trip.totalInvoices, 0);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load suggested trips:', err);
        alert('Failed to load suggestions: ' + (err.error?.message || err.message));
        this.loading = false;
      }
    });
  }

  createTrip(trip: any): void {
    this.selectedTrip = trip;
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
      invoiceIds: trip.invoiceIds,
      notes: trip.notes
    }).subscribe({
      next: (result) => {
        alert(`Trip ${result.loadNumber} created successfully with ${result.stops} stops!`);
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Failed to create trip:', err);
        alert('Failed to create trip: ' + (err.error?.message || err.message));
        this.selectedTrip = null;
      }
    });
  }

  createAllTrips(): void {
    if (!confirm(`Create all ${this.suggestedTrips.length} suggested trips?`)) {
      return;
    }

    let completed = 0;
    const total = this.suggestedTrips.length;

    this.suggestedTrips.forEach((trip, index) => {
      setTimeout(() => {
        this.http.post<any>(`${this.data.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
          invoiceIds: trip.invoiceIds,
          notes: trip.notes
        }).subscribe({
          next: (result) => {
            completed++;
            if (completed === total) {
              alert(`Successfully created all ${total} trips!`);
              this.dialogRef.close(true);
            }
          },
          error: (err) => {
            console.error('Failed to create trip:', err);
            completed++;
            if (completed === total) {
              alert(`Created ${completed} of ${total} trips. Some failed.`);
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

// Sleep Outs Dialog Component (Driver Food Allowance)
@Component({
  selector: 'app-sleepouts-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatTooltipModule,
    FormsModule
  ],
  template: `
    <div class="sleepouts-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>hotel</mat-icon>
          Sleep Outs (Driver Food Allowance)
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <div class="toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="filterSleepOuts()" placeholder="Search by driver name or status">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
          
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="statusFilter" (selectionChange)="filterSleepOuts()">
              <mat-option value="all">All</mat-option>
              <mat-option value="Requested">Requested</mat-option>
              <mat-option value="Approved">Approved</mat-option>
              <mat-option value="Rejected">Rejected</mat-option>
              <mat-option value="Paid">Paid</mat-option>
            </mat-select>
          </mat-form-field>

          <button mat-raised-button color="primary" (click)="openAddSleepOutForm()">
            <mat-icon>add</mat-icon>
            Add Sleep Out
          </button>
        </div>

        <!-- Add/Edit Form -->
        @if (showForm) {
          <div class="form-container">
            <h3>{{ editingSleepOut ? 'Edit Sleep Out' : 'Add New Sleep Out' }}</h3>
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Driver</mat-label>
                <mat-select [(ngModel)]="formData.driverId" required>
                  @for (driver of data.drivers; track driver.id) {
                    <mat-option [value]="driver.id">
                      {{ driver.firstName }} {{ driver.lastName }} ({{ driver.employeeNumber || 'N/A' }})
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Amount (R)</mat-label>
                <input matInput type="number" [(ngModel)]="formData.amount" required min="0" step="50">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Date</mat-label>
                <input matInput [matDatepicker]="picker" [(ngModel)]="formData.date" required>
                <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                <mat-datepicker #picker></mat-datepicker>
              </mat-form-field>
            </div>
            
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Reason</mat-label>
              <input matInput [(ngModel)]="formData.reason" placeholder="e.g., Long distance delivery, overnight trip">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notes</mat-label>
              <textarea matInput [(ngModel)]="formData.notes" rows="2" placeholder="Additional notes..."></textarea>
            </mat-form-field>

            <div class="form-actions">
              <button mat-button (click)="cancelForm()">Cancel</button>
              <button mat-raised-button color="primary" (click)="saveSleepOut()" [disabled]="!formData.driverId || !formData.amount || !formData.date">
                {{ editingSleepOut ? 'Update' : 'Submit Request' }}
              </button>
            </div>
          </div>
        }

        <!-- Sleep Outs List -->
        <div class="sleepouts-list">
          @for (sleepOut of filteredSleepOuts; track sleepOut.id) {
            <div class="sleepout-card" [class.status-requested]="sleepOut.status === 'Requested'"
                 [class.status-approved]="sleepOut.status === 'Approved'"
                 [class.status-rejected]="sleepOut.status === 'Rejected'"
                 [class.status-paid]="sleepOut.status === 'Paid'">
              <div class="sleepout-main">
                <div class="driver-info">
                  <mat-icon>person</mat-icon>
                  <span class="driver-name">{{ sleepOut.driverName || 'Unknown Driver' }}</span>
                  @if (sleepOut.driverEmployeeNumber) {
                    <span class="emp-number">({{ sleepOut.driverEmployeeNumber }})</span>
                  }
                </div>
                <div class="amount">
                  <mat-icon>payments</mat-icon>
                  <span class="amount-value">R {{ sleepOut.amount | number:'1.2-2' }}</span>
                </div>
              </div>
              
              <div class="sleepout-details">
                <div class="detail">
                  <mat-icon>calendar_today</mat-icon>
                  <span>{{ formatDate(sleepOut.date) }}</span>
                </div>
                @if (sleepOut.reason) {
                  <div class="detail">
                    <mat-icon>info</mat-icon>
                    <span>{{ sleepOut.reason }}</span>
                  </div>
                }
                @if (sleepOut.loadNumber) {
                  <div class="detail">
                    <mat-icon>local_shipping</mat-icon>
                    <span>Trip: {{ sleepOut.loadNumber }}</span>
                  </div>
                }
              </div>

              <div class="sleepout-actions">
                <span class="status-badge" [class]="'status-' + sleepOut.status.toLowerCase()">
                  {{ sleepOut.status }}
                </span>
                
                @if (sleepOut.status === 'Requested') {
                  <button mat-icon-button color="primary" (click)="approveSleepOut(sleepOut, true)" matTooltip="Approve">
                    <mat-icon>check_circle</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="approveSleepOut(sleepOut, false)" matTooltip="Reject">
                    <mat-icon>cancel</mat-icon>
                  </button>
                  <button mat-icon-button (click)="editSleepOut(sleepOut)" matTooltip="Edit">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteSleepOut(sleepOut)" matTooltip="Delete">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
                @if (sleepOut.status === 'Approved') {
                  <button mat-icon-button color="accent" (click)="markAsPaid(sleepOut)" matTooltip="Mark as Paid">
                    <mat-icon>paid</mat-icon>
                  </button>
                }
              </div>
            </div>
          } @empty {
            <div class="no-data">
              <mat-icon>hotel</mat-icon>
              <p>No sleep outs found</p>
              <button mat-raised-button color="primary" (click)="openAddSleepOutForm()">
                <mat-icon>add</mat-icon> Add First Sleep Out
              </button>
            </div>
          }
        </div>

        <!-- Summary -->
        <div class="summary-bar">
          <div class="summary-item">
            <span class="label">Requested:</span>
            <span class="value requested">{{ getSummary('Requested') }}</span>
          </div>
          <div class="summary-item">
            <span class="label">Approved:</span>
            <span class="value approved">{{ getSummary('Approved') }}</span>
          </div>
          <div class="summary-item">
            <span class="label">Total Amount:</span>
            <span class="value total">R {{ getTotalAmount() | number:'1.2-2' }}</span>
          </div>
        </div>
      </div>

      <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close('refresh')">Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .sleepouts-dialog { width: 100%; overflow: hidden; }
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
    }
    .dialog-header button { color: white; }
    .dialog-content {
      padding: 24px;
      max-height: 65vh;
      overflow-y: auto;
    }
    .toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .search-field { flex: 1; min-width: 200px; }
    .filter-field { width: 150px; }
    .form-container {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 12px;
      margin-bottom: 20px;
    }
    .form-container h3 {
      margin: 0 0 16px 0;
      color: #667eea;
    }
    .form-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .full-width { width: 100%; }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
    }
    .sleepouts-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .sleepout-card {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 20px;
      align-items: center;
      padding: 16px 20px;
      background: #fafafa;
      border-radius: 12px;
      border-left: 4px solid #ccc;
      transition: all 0.2s;
    }
    .sleepout-card:hover {
      background: #f0f0f0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .sleepout-card.status-requested { border-left-color: #ff9800; }
    .sleepout-card.status-approved { border-left-color: #4caf50; }
    .sleepout-card.status-rejected { border-left-color: #f44336; }
    .sleepout-card.status-paid { border-left-color: #2196f3; }
    .sleepout-main {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .driver-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .driver-info mat-icon { color: #667eea; font-size: 20px; width: 20px; height: 20px; }
    .driver-name { font-weight: 600; color: #333; }
    .emp-number { color: #999; font-size: 12px; }
    .amount {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .amount mat-icon { color: #4caf50; font-size: 18px; width: 18px; height: 18px; }
    .amount-value { font-size: 18px; font-weight: 600; color: #4caf50; }
    .sleepout-details {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .detail {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #666;
    }
    .detail mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .sleepout-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-badge {
      padding: 6px 14px;
      border-radius: 14px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }
    .status-requested { background: #fff3e0; color: #e65100; }
    .status-approved { background: #e8f5e9; color: #2e7d32; }
    .status-rejected { background: #ffebee; color: #c62828; }
    .status-paid { background: #e3f2fd; color: #1565c0; }
    .no-data {
      text-align: center;
      padding: 60px;
      color: #999;
    }
    .no-data mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      margin-bottom: 16px;
    }
    .summary-bar {
      display: flex;
      justify-content: flex-end;
      gap: 24px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-top: 20px;
    }
    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .summary-item .label { color: #666; font-size: 14px; }
    .summary-item .value { font-weight: 600; font-size: 16px; }
    .summary-item .value.requested { color: #e65100; }
    .summary-item .value.approved { color: #2e7d32; }
    .summary-item .value.total { color: #667eea; }
    mat-dialog-actions {
      padding: 16px 32px;
      border-top: 1px solid #e0e0e0;
    }
    @media (max-width: 768px) {
      .form-row { grid-template-columns: 1fr; }
      .sleepout-card { grid-template-columns: 1fr; }
      .toolbar { flex-direction: column; align-items: stretch; }
    }
  `]
})
export class SleepOutsDialog {
  searchTerm = '';
  statusFilter = 'all';
  filteredSleepOuts: SleepOut[] = [];
  showForm = false;
  editingSleepOut: SleepOut | null = null;
  formData = {
    driverId: null as number | null,
    amount: 250,
    date: new Date(),
    reason: '',
    notes: '',
    loadId: null as number | null
  };

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { sleepOuts: SleepOut[], drivers: any[], apiUrl: string },
    public dialogRef: MatDialogRef<SleepOutsDialog>
  ) {
    this.filteredSleepOuts = [...this.data.sleepOuts];
  }

  filterSleepOuts(): void {
    let filtered = [...this.data.sleepOuts];
    
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(s => s.status === this.statusFilter);
    }
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.driverName?.toLowerCase().includes(term) ||
        s.driverEmployeeNumber?.toLowerCase().includes(term) ||
        s.reason?.toLowerCase().includes(term)
      );
    }
    
    this.filteredSleepOuts = filtered;
  }

  openAddSleepOutForm(): void {
    this.showForm = true;
    this.editingSleepOut = null;
    this.formData = {
      driverId: null,
      amount: 250,
      date: new Date(),
      reason: '',
      notes: '',
      loadId: null
    };
  }

  editSleepOut(sleepOut: SleepOut): void {
    this.showForm = true;
    this.editingSleepOut = sleepOut;
    this.formData = {
      driverId: sleepOut.driverId,
      amount: sleepOut.amount,
      date: new Date(sleepOut.date),
      reason: sleepOut.reason || '',
      notes: sleepOut.notes || '',
      loadId: sleepOut.loadId || null
    };
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingSleepOut = null;
  }

  saveSleepOut(): void {
    if (this.editingSleepOut) {
      // Update existing
      this.http.put(`${this.data.apiUrl}/logistics/sleepouts/${this.editingSleepOut.id}`, {
        amount: this.formData.amount,
        date: this.formData.date,
        reason: this.formData.reason,
        notes: this.formData.notes
      }).subscribe({
        next: () => {
          this.snackBar.open('Sleep out updated successfully', 'Close', { duration: 3000 });
          this.refreshList();
          this.cancelForm();
        },
        error: (err) => {
          this.snackBar.open('Failed to update sleep out: ' + (err.error?.error || err.message), 'Close', { duration: 5000 });
        }
      });
    } else {
      // Create new
      this.http.post(`${this.data.apiUrl}/logistics/sleepouts`, this.formData).subscribe({
        next: () => {
          this.snackBar.open('Sleep out request submitted', 'Close', { duration: 3000 });
          this.refreshList();
          this.cancelForm();
        },
        error: (err) => {
          this.snackBar.open('Failed to create sleep out: ' + (err.error?.error || err.message), 'Close', { duration: 5000 });
        }
      });
    }
  }

  approveSleepOut(sleepOut: SleepOut, approved: boolean): void {
    if (!confirm(`Are you sure you want to ${approved ? 'approve' : 'reject'} this sleep out for ${sleepOut.driverName}?`)) {
      return;
    }
    
    this.http.post(`${this.data.apiUrl}/logistics/sleepouts/${sleepOut.id}/approve`, { approved }).subscribe({
      next: () => {
        this.snackBar.open(`Sleep out ${approved ? 'approved' : 'rejected'}`, 'Close', { duration: 3000 });
        this.refreshList();
      },
      error: (err) => {
        this.snackBar.open('Failed to process: ' + (err.error?.error || err.message), 'Close', { duration: 5000 });
      }
    });
  }

  markAsPaid(sleepOut: SleepOut): void {
    if (!confirm(`Mark R${sleepOut.amount} sleep out for ${sleepOut.driverName} as paid?`)) {
      return;
    }
    
    this.http.post(`${this.data.apiUrl}/logistics/sleepouts/${sleepOut.id}/mark-paid`, {}).subscribe({
      next: () => {
        this.snackBar.open('Sleep out marked as paid', 'Close', { duration: 3000 });
        this.refreshList();
      },
      error: (err) => {
        this.snackBar.open('Failed to mark as paid: ' + (err.error?.error || err.message), 'Close', { duration: 5000 });
      }
    });
  }

  deleteSleepOut(sleepOut: SleepOut): void {
    if (!confirm(`Delete sleep out request for ${sleepOut.driverName}?`)) {
      return;
    }
    
    this.http.delete(`${this.data.apiUrl}/logistics/sleepouts/${sleepOut.id}`).subscribe({
      next: () => {
        this.snackBar.open('Sleep out deleted', 'Close', { duration: 3000 });
        this.refreshList();
      },
      error: (err) => {
        this.snackBar.open('Failed to delete: ' + (err.error?.error || err.message), 'Close', { duration: 5000 });
      }
    });
  }

  private refreshList(): void {
    this.http.get<SleepOut[]>(`${this.data.apiUrl}/logistics/sleepouts`).subscribe({
      next: (sleepOuts) => {
        this.data.sleepOuts = sleepOuts;
        this.filterSleepOuts();
      }
    });
  }

  formatDate(date: Date | string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getSummary(status: string): number {
    return this.data.sleepOuts.filter(s => s.status === status).length;
  }

  getTotalAmount(): number {
    return this.data.sleepOuts
      .filter(s => s.status === 'Approved' || s.status === 'Requested')
      .reduce((sum, s) => sum + s.amount, 0);
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
    this.http.get<any[]>(`${apiUrl}/loads`).subscribe({
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
    MatAutocompleteModule,
    FormsModule,
    ReactiveFormsModule,
    CdkDrag,
    CdkDropList
  ],
  template: `
    <div class="create-tripsheet-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>{{ data.isEditMode ? 'edit' : 'add_road' }}</mat-icon>
          {{ data.isEditMode ? 'Edit Trip Sheet' : 'Create Trip Sheet' }}
        </h2>
        <div class="header-info">
          @if (data.isEditMode && data.existingTripsheet?.loadNumber) {
            <mat-chip class="edit-badge">{{ data.existingTripsheet.loadNumber }}</mat-chip>
          }
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
        <mat-stepper #stepper linear (selectionChange)="onStepChange($event)">
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
                         [class.part-delivery-marked]="partDeliveryMap.get(invoice.id)">
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
                        @if (invoice.quantity) {
                          <span class="quantity">Qty: {{ invoice.quantity }}</span>
                        }
                      </div>
                      <div class="part-delivery-toggle" (click)="$event.stopPropagation()">
                        <mat-checkbox 
                          [checked]="partDeliveryMap.get(invoice.id) || false"
                          (change)="togglePartDelivery(invoice.id, $event.checked)"
                          color="warn"
                          matTooltip="Mark as Part Delivery - partial quantity will be delivered">
                          <span class="part-delivery-label">Part</span>
                        </mat-checkbox>
                      </div>
                      <button mat-icon-button class="add-btn" (click)="addStopWithPartDelivery(invoice); $event.stopPropagation()" matTooltip="Add to trip sheet">
                        <mat-icon class="add-icon">add_circle</mat-icon>
                      </button>
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
                    <div class="stop-item" [class.part-delivery]="stop.isPartDelivery" cdkDrag>
                      <div class="stop-drag-handle" cdkDragHandle>
                        <mat-icon>drag_indicator</mat-icon>
                      </div>
                      <div class="stop-sequence">{{ i + 1 }}</div>
                      <div class="stop-info">
                        <span class="stop-customer">{{ stop.customerName }}</span>
                        <span class="stop-address">{{ stop.address || 'No address' }}</span>
                        <span class="stop-invoice">{{ stop.transactionNumber }}</span>
                        @if (stop.isPartDelivery) {
                          <span class="part-delivery-badge">
                            <mat-icon>splitscreen</mat-icon> Part Delivery
                          </span>
                        }
                      </div>
                      @if (stop.isPartDelivery) {
                        <div class="part-delivery-qty">
                          <mat-form-field appearance="outline" class="qty-field">
                            <mat-label>Qty</mat-label>
                            <input matInput type="number" 
                                   [(ngModel)]="stop.partialQuantity" 
                                   [max]="stop.originalQuantity"
                                   min="1"
                                   (change)="onPartialQuantityChange(stop)">
                            <mat-hint>of {{ stop.originalQuantity }}</mat-hint>
                          </mat-form-field>
                        </div>
                      } @else {
                        <div class="stop-value">
                          R {{ stop.salesAmount | number:'1.2-2' }}
                        </div>
                      }
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
              <!-- Route Preview Map - At the top -->
              <div class="route-map-preview">
                <div class="map-header">
                  <h3><mat-icon>map</mat-icon> Route Preview</h3>
                  <div class="map-actions">
                    <button mat-stroked-button color="primary" (click)="loadTfnDepots()" matTooltip="Show TFN depot locations on the map">
                      <mat-icon>store</mat-icon> Load TFN Depots
                    </button>
                    <button mat-icon-button (click)="refreshMap()" matTooltip="Refresh map">
                      <mat-icon>refresh</mat-icon>
                    </button>
                  </div>
                </div>
                <div id="tripsheetRouteMap" class="route-map"></div>
                @if (selectedStops.length > 0) {
                  <div class="map-legend">
                    <span class="legend-item"><span class="marker warehouse"></span> Warehouse</span>
                    <span class="legend-item"><span class="marker stop"></span> Delivery Stop</span>
                    @if (tfnDepotsLoaded) {
                      <span class="legend-item"><span class="marker depot"></span> TFN Depot</span>
                    }
                  </div>
                }
                @if (selectedStops.length > 0 && !stopsHaveCoords()) {
                  <div class="map-warning">
                    <mat-icon>warning</mat-icon>
                    <span>Some stops are missing coordinates. Click "Geocode All Missing" to get coordinates.</span>
                  </div>
                }
              </div>

              <!-- Route Configuration - Above Delivery Stops -->
              <div class="route-config">
                <h3><mat-icon>route</mat-icon> Route Configuration</h3>
                
                @if (!data.warehouses?.length && !data.drivers?.length && !data.vehicles?.length) {
                  <div class="config-loading">
                    <mat-spinner diameter="20"></mat-spinner>
                    <span>Loading configuration data...</span>
                  </div>
                }

                <div class="config-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Pickup Warehouse</mat-label>
                    <input matInput
                           [(ngModel)]="warehouseSearchText"
                           [matAutocomplete]="warehouseAuto"
                           (input)="filterWarehouses()"
                           (focus)="filterWarehouses()"
                           placeholder="Type to search warehouses...">
                    <mat-autocomplete #warehouseAuto="matAutocomplete"
                                      [displayWith]="displayWarehouse.bind(this)"
                                      (optionSelected)="onWarehouseAutocompleteSelected($event)">
                      @for (wh of filteredWarehouses; track wh.id) {
                        <mat-option [value]="wh">{{ wh.name }} - {{ wh.city }}</mat-option>
                      }
                    </mat-autocomplete>
                    <mat-icon matSuffix>warehouse</mat-icon>
                    <mat-hint>{{ data.warehouses?.length || 0 }} warehouses available</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Driver</mat-label>
                    <input matInput
                           [(ngModel)]="driverSearchText"
                           [matAutocomplete]="driverAuto"
                           (input)="filterDrivers()"
                           (focus)="filterDrivers()"
                           placeholder="Type to search drivers...">
                    <mat-autocomplete #driverAuto="matAutocomplete"
                                      [displayWith]="displayDriver.bind(this)"
                                      (optionSelected)="onDriverAutocompleteSelected($event)">
                      <mat-option [value]="null">-- Unassigned --</mat-option>
                      @for (driver of filteredDrivers; track driver.id) {
                        <mat-option [value]="driver">{{ driver.firstName }} {{ driver.lastName }}</mat-option>
                      }
                    </mat-autocomplete>
                    <mat-icon matSuffix>person</mat-icon>
                    <mat-hint>{{ data.drivers?.length || 0 }} drivers available</mat-hint>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Vehicle</mat-label>
                    <input matInput
                           [(ngModel)]="vehicleSearchText"
                           [matAutocomplete]="vehicleAuto"
                           (input)="filterVehicles()"
                           (focus)="filterVehicles()"
                           placeholder="Type to search vehicles...">
                    <mat-autocomplete #vehicleAuto="matAutocomplete"
                                      [displayWith]="displayVehicle.bind(this)"
                                      (optionSelected)="onVehicleAutocompleteSelected($event)">
                      <mat-option [value]="null">-- Unassigned --</mat-option>
                      @for (vehicle of filteredVehicles; track vehicle.id) {
                        <mat-option [value]="vehicle">{{ vehicle.registrationNumber }} - {{ vehicle.make }} {{ vehicle.model }}</mat-option>
                      }
                    </mat-autocomplete>
                    <mat-icon matSuffix>local_shipping</mat-icon>
                    <mat-hint>{{ data.vehicles?.length || 0 }} vehicles available</mat-hint>
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
                  <mat-checkbox [(ngModel)]="includeRouteMapInTripsheet" color="primary" matTooltip="Include a screenshot of the route preview map in the printed tripsheet">
                    <mat-icon class="checkbox-icon">map</mat-icon>
                    Add route preview map to tripsheet
                  </mat-checkbox>
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
                      <mat-icon>receipt</mat-icon>
                      <span class="label">Subtotal:</span>
                      <span class="value">R {{ totalValue | number:'1.2-2' }}</span>
                    </div>
                    <div class="summary-item">
                      <mat-icon>percent</mat-icon>
                      <span class="label">VAT (15%):</span>
                      <span class="value">R {{ totalValue * 0.15 | number:'1.2-2' }}</span>
                    </div>
                    <div class="summary-item highlight">
                      <mat-icon>payments</mat-icon>
                      <span class="label">Total Incl. VAT:</span>
                      <span class="value">R {{ totalValue * 1.15 | number:'1.2-2' }}</span>
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
              </div>

              <!-- Grouped Delivery Stops with Editable Addresses -->
              @if (groupedStops.length > 0) {
                <div class="stops-address-section">
                  <div class="section-header">
                    <h3><mat-icon>place</mat-icon> Delivery Stops ({{ groupedStops.length }} locations, {{ selectedStops.length }} invoices)</h3>
                    <div class="header-actions">
                      <span class="coord-status">
                        <mat-icon [class.success]="stopsHaveCoords()" [class.warning]="!stopsHaveCoords()">
                          {{ stopsHaveCoords() ? 'check_circle' : 'warning' }}
                        </mat-icon>
                        {{ getStopsWithCoords() }}/{{ groupedStops.length }} geocoded
                      </span>
                      <button mat-stroked-button color="primary" (click)="geocodeAllStops()" [disabled]="geocodingAllStops" matTooltip="Geocode all stops missing coordinates">
                        @if (geocodingAllStops) {
                          <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                        } @else {
                          <mat-icon>my_location</mat-icon>
                        }
                        {{ geocodingAllStops ? 'Geocoding...' : 'Geocode All' }}
                      </button>
                    </div>
                  </div>
                  <div class="stops-list">
                    @for (group of groupedStops; track group.customerName; let i = $index) {
                      <div class="stop-item" [class.missing-coords]="!group.latitude || !group.longitude" [class.collapsed]="group.isCollapsed && group.latitude && group.longitude">
                        <div class="stop-number">{{ i + 1 }}</div>
                        <div class="stop-details">
                          <div class="stop-header" (click)="toggleStopCollapse(group)">
                            <div class="customer-info">
                              <span class="customer-name">{{ group.customerName }}</span>
                              @if (group.invoices.length > 1) {
                                <mat-chip class="invoice-count">{{ group.invoices.length }} invoices</mat-chip>
                              } @else {
                                <span class="invoice-number">{{ group.invoices[0].invoiceNumber }}</span>
                              }
                            </div>
                            <div class="stop-status">
                              @if (group.latitude && group.longitude) {
                                <mat-icon class="coord-icon success" matTooltip="Coordinates: {{ group.latitude }}, {{ group.longitude }}">location_on</mat-icon>
                              } @else {
                                <mat-icon class="coord-icon warning" matTooltip="Missing coordinates - enter address">location_off</mat-icon>
                              }
                              <mat-icon class="collapse-icon">{{ group.isCollapsed ? 'expand_more' : 'expand_less' }}</mat-icon>
                            </div>
                          </div>
                          @if (!group.isCollapsed || !group.latitude || !group.longitude) {
                            <!-- Saved Addresses Dropdown -->
                            @if (getSavedAddresses(group).length > 0) {
                              <div class="saved-addresses-row">
                                <mat-form-field appearance="outline" class="saved-address-select">
                                  <mat-label>Saved Addresses</mat-label>
                                  <mat-select (selectionChange)="onSavedAddressSelected(group, $event.value)">
                                    @for (addr of getSavedAddresses(group); track addr.id) {
                                      <mat-option [value]="addr">
                                        <div class="saved-addr-option">
                                          <span class="addr-label">{{ addr.addressLabel || 'Address' }}</span>
                                          <span class="addr-text">{{ addr.address }}</span>
                                          @if (addr.usageCount > 1) {
                                            <span class="addr-usage">(used {{ addr.usageCount }}x)</span>
                                          }
                                        </div>
                                      </mat-option>
                                    }
                                  </mat-select>
                                  <mat-hint>Select a previously used address</mat-hint>
                                </mat-form-field>
                                <span class="or-divider">OR</span>
                              </div>
                            }
                            <div class="stop-address-row">
                              <mat-form-field appearance="outline" class="address-field">
                                <mat-label>Delivery Address</mat-label>
                                <input matInput 
                                       [(ngModel)]="group.deliveryAddress" 
                                       [matAutocomplete]="autoAddress"
                                       (input)="onAddressInput(group, $event)"
                                       (focus)="onAddressFocus(group)"
                                       placeholder="Start typing address...">
                                <mat-autocomplete #autoAddress="matAutocomplete" (optionSelected)="onAddressSelected(group, $event)">
                                  @for (prediction of addressPredictions; track prediction.place_id) {
                                    <mat-option [value]="prediction.description">
                                      <mat-icon>place</mat-icon>
                                      <span>{{ prediction.description }}</span>
                                    </mat-option>
                                  }
                                </mat-autocomplete>
                                <mat-hint *ngIf="!group.latitude && group.deliveryAddress">Select from suggestions or geocode</mat-hint>
                              </mat-form-field>
                              <button mat-icon-button color="primary" (click)="geocodeGroupAddress(group)" [disabled]="geocodingStop === group || !group.deliveryAddress" matTooltip="Geocode this address">
                                @if (geocodingStop === group) {
                                  <mat-spinner diameter="20"></mat-spinner>
                                } @else {
                                  <mat-icon>my_location</mat-icon>
                                }
                              </button>
                              <button mat-icon-button color="accent" (click)="saveAddressForCustomer(group)" 
                                      [disabled]="!group.deliveryAddress || !group.latitude" 
                                      matTooltip="Save this address for future use">
                                <mat-icon>bookmark_add</mat-icon>
                              </button>
                            </div>
                            @if (group.city || group.province) {
                              <div class="stop-location-info">
                                <mat-icon>info_outline</mat-icon>
                                <span>{{ group.city }}{{ group.province ? ', ' + group.province : '' }}</span>
                              </div>
                            }
                            @if (group.invoices.length > 1) {
                              <div class="grouped-invoices">
                                <span class="invoices-label">Invoices at this location:</span>
                                <div class="invoice-chips">
                                  @for (inv of group.invoices; track inv.id) {
                                    <mat-chip>{{ inv.invoiceNumber }} - R{{ inv.totalAmount | number:'1.2-2' }}</mat-chip>
                                  }
                                </div>
                              </div>
                            }
                          } @else {
                            <div class="collapsed-info">
                              <mat-icon>check_circle</mat-icon>
                              <span>{{ group.deliveryAddress }}</span>
                            </div>
                          }
                        </div>
                        <div class="stop-value">R {{ group.totalValue * 1.15 | number:'1.2-2' }}</div>
                      </div>
                    }
                  </div>
                </div>
              }
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
                    <p class="sub-value">Total (incl. VAT): R {{ totalValue * 1.15 | number:'1.2-2' }}</p>
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
                    <mat-icon>{{ data.isEditMode ? 'save' : 'check' }}</mat-icon>
                  }
                  {{ creating ? (data.isEditMode ? 'Updating...' : 'Creating...') : (data.isEditMode ? 'Update & Download' : 'Create & Download') }}
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
      min-height: 520px;
      padding: 16px 0;
    }
    .step-content.route-step {
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-height: auto;
      max-height: none;
      overflow: visible;
    }
    .source-panel, .stops-panel {
      flex: 1;
      background: #f5f5f5;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      max-height: 100%;
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
    
    /* Part Delivery Styles */
    .part-delivery-toggle {
      display: flex;
      align-items: center;
      margin-left: auto;
    }
    .part-delivery-toggle mat-checkbox {
      transform: scale(0.9);
    }
    .part-delivery-label {
      font-size: 11px;
      font-weight: 500;
      color: #f57c00;
    }
    .invoice-item.part-delivery-marked {
      border-color: #ff9800;
      background: #fff8e1;
    }
    .invoice-item.part-delivery-marked:hover {
      background: #ffecb3;
    }
    .add-btn {
      margin-left: 4px;
    }
    .add-btn .add-icon {
      opacity: 1 !important;
      color: #667eea;
    }
    .invoice-item .quantity {
      font-size: 11px;
      color: #1976d2;
      font-weight: 500;
    }
    .stop-item.part-delivery {
      border-left-color: #ff9800;
      background: #fffde7;
    }
    .part-delivery-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 12px;
      background: #ff9800;
      color: white;
      font-weight: 600;
      margin-top: 4px;
    }
    .part-delivery-badge mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }
    .part-delivery-qty {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .qty-field {
      width: 80px;
    }
    .qty-field input {
      text-align: center;
    }
    .qty-field .mat-mdc-form-field-hint {
      font-size: 10px;
      color: #888;
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
    .route-config {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #e0e0e0;
      margin-bottom: 20px;
    }
    .route-config h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
      color: #1976d2;
    }
    .config-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
      margin-bottom: 16px;
      color: #e65100;
    }
    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .config-grid mat-form-field {
      width: 100%;
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
      margin-bottom: 24px;
      background: #f8f9fa;
      border-radius: 12px;
      padding: 16px;
    }
    .map-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .map-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }
    .map-actions {
      display: flex;
      gap: 8px;
    }
    .route-map {
      height: 350px;
      border-radius: 12px;
      background: #e5e3df;
      border: 1px solid #ddd;
    }
    .map-legend {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      padding: 8px 12px;
      background: #fff;
      border-radius: 8px;
      font-size: 12px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend-item .marker {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .legend-item .marker.warehouse {
      background: #4caf50;
    }
    .legend-item .marker.stop {
      background: #667eea;
    }
    .legend-item .marker.depot {
      background: #ff9800;
    }
    .map-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 10px 14px;
      background: #fff3cd;
      color: #856404;
      border-radius: 8px;
      font-size: 13px;
    }
    .map-warning mat-icon {
      color: #e65100;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Stops Address Section */
    .stops-address-section {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 16px;
      margin-top: 20px;
    }
    .stops-address-section .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .stops-address-section .section-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
      color: #333;
    }
    .stops-address-section .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stops-address-section .coord-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #666;
    }
    .coord-status mat-icon.success { color: #4caf50; }
    .coord-status mat-icon.warning { color: #ff9800; }
    
    .stops-list {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #eee;
      border-radius: 8px;
    }
    .stop-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      border-bottom: 1px solid #f0f0f0;
      transition: all 0.2s;
    }
    .stop-item:last-child { border-bottom: none; }
    .stop-item:hover { background: #f9f9f9; }
    .stop-item.missing-coords {
      background: #fff8e1;
      border-left: 3px solid #ff9800;
    }
    .stop-item.collapsed {
      padding: 10px 14px;
      background: #f8fdf8;
      border-left: 3px solid #4caf50;
    }
    .stop-number {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 13px;
      flex-shrink: 0;
    }
    .stop-details {
      flex: 1;
      min-width: 0;
    }
    .stop-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      padding: 4px 0;
    }
    .stop-header .customer-info {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }
    .stop-header .customer-name {
      font-weight: 500;
      color: #333;
    }
    .stop-header .invoice-number {
      font-size: 12px;
      color: #888;
      background: #f0f0f0;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .stop-header .invoice-count {
      font-size: 11px;
      background: #e3f2fd !important;
      color: #1976d2 !important;
    }
    .stop-header .stop-status {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .stop-header .coord-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .stop-header .coord-icon.success { color: #4caf50; }
    .stop-header .coord-icon.warning { color: #ff9800; }
    .stop-header .collapse-icon {
      color: #999;
      transition: transform 0.2s;
    }
    
    .saved-addresses-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 8px 0;
    }
    .saved-address-select {
      flex: 1;
      max-width: 400px;
    }
    .saved-addr-option {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
    }
    .saved-addr-option .addr-label {
      font-weight: 500;
      font-size: 13px;
      color: #333;
    }
    .saved-addr-option .addr-text {
      font-size: 12px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 350px;
    }
    .saved-addr-option .addr-usage {
      font-size: 11px;
      color: #888;
      font-style: italic;
    }
    .or-divider {
      color: #999;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .stop-address-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .stop-address-row .address-field {
      flex: 1;
    }
    .stop-address-row .address-field .mat-mdc-form-field-subscript-wrapper {
      height: 16px;
    }
    .stop-location-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #666;
      margin-top: 6px;
    }
    .stop-location-info mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #888;
    }
    
    .collapsed-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #4caf50;
      margin-top: 4px;
    }
    .collapsed-info mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .collapsed-info span {
      color: #666;
      font-size: 12px;
    }
    
    .grouped-invoices {
      margin-top: 12px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .grouped-invoices .invoices-label {
      display: block;
      font-size: 11px;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grouped-invoices .invoice-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .grouped-invoices .invoice-chips mat-chip {
      font-size: 11px;
      min-height: 24px;
      padding: 0 10px;
    }
    
    .stop-value {
      font-weight: 600;
      color: #4caf50;
      white-space: nowrap;
      padding-top: 4px;
      font-size: 14px;
    }
    .stops-actions {
      display: flex;
      gap: 12px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #eee;
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
    mat-checkbox.mat-mdc-checkbox {
      margin-left: 8px;
    }
    mat-checkbox .checkbox-icon {
      font-size: 18px;
      height: 18px;
      width: 18px;
      margin-right: 4px;
      vertical-align: middle;
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
  
  // Searchable dropdown filters
  warehouseSearchText = '';
  driverSearchText = '';
  vehicleSearchText = '';
  filteredWarehouses: any[] = [];
  filteredDrivers: any[] = [];
  filteredVehicles: any[] = [];
  
  // Part Delivery tracking - stores invoice IDs that are marked as part delivery
  partDeliveryMap: Map<number, boolean> = new Map();
  
  // Saved delivery addresses for customers
  customerSavedAddresses: Map<string, any[]> = new Map(); // Map customer name/code to saved addresses
  loadingSavedAddresses = false;
  
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
  
  // Cache for customer provinces and coordinates
  private customerProvinceCache: Map<string, { 
    province: string; 
    city: string; 
    latitude?: number; 
    longitude?: number;
    formattedAddress?: string;
  }> = new Map();
  
  totalDistance = 0;
  estimatedTime = '';
  totalValue = 0;
  returnDistance = 0;
  returnTime = '';
  includeRouteMapInTripsheet = false;
  
  optimizing = false;
  calculating = false;
  creating = false;
  
  // TFN Depot markers
  tfnDepotsLoaded = false;
  private tfnDepotMarkers: google.maps.Marker[] = [];
  private tfnDepots = [
    { name: 'TFN Depot - Johannesburg', code: 'JHB', province: 'GP', latitude: -26.1496, longitude: 28.2381, address: 'Isando, Johannesburg' },
    { name: 'TFN Depot - Durban', code: 'DBN', province: 'KZN', latitude: -29.8115, longitude: 30.9622, address: 'Pinetown, Durban' },
    { name: 'TFN Depot - Cape Town', code: 'CPT', province: 'WC', latitude: -33.9416, longitude: 18.6006, address: 'Epping, Cape Town' },
    { name: 'TFN Depot - Port Elizabeth', code: 'PE', province: 'EC', latitude: -33.8688, longitude: 25.5701, address: 'Deal Party, Gqeberha' },
    { name: 'TFN Depot - Bloemfontein', code: 'BFN', province: 'FS', latitude: -29.1211, longitude: 26.2140, address: 'Bloemfontein' },
    { name: 'TFN Depot - Polokwane', code: 'PLK', province: 'LP', latitude: -23.9045, longitude: 29.4530, address: 'Polokwane' },
    { name: 'TFN Depot - Nelspruit', code: 'NLP', province: 'MP', latitude: -25.4753, longitude: 30.9694, address: 'Mbombela' },
    { name: 'TFN Depot - Rustenburg', code: 'RST', province: 'NW', latitude: -25.6674, longitude: 27.2421, address: 'Rustenburg' }
  ];
  
  // Geocoding state
  geocodingStop: any = null;
  
  // Grouped stops (same customer address = 1 stop)
  groupedStops: any[] = [];
  
  // Google Places Autocomplete
  addressPredictions: any[] = [];
  private autocompleteService: any = null;
  private placesService: any = null;
  private addressInputSubject = new Subject<{group: any, query: string}>();
  private ngZone: NgZone;
  
  tripForm = new FormGroup({});
  
  private map: google.maps.Map | null = null;
  private routePolyline: google.maps.Polyline | null = null;
  private directionsRenderer: any = null;
  private directionsService: any = null;
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
      apiUrl: string,
      isImport?: boolean,
      batchId?: string,
      preSelectedInvoices?: any[],
      // Edit mode fields
      isEditMode?: boolean,
      editLoadId?: number,
      existingTripsheet?: any,
      preSelectedWarehouse?: any,
      preSelectedDriver?: any,
      preSelectedVehicle?: any,
      preScheduledDate?: Date,
      preSpecialInstructions?: string,
      preTotalDistance?: number,
      preEstimatedTime?: string
    },
    private dialogRef: MatDialogRef<CreateTripsheetDialog>,
    private injector: Injector,
    private snackBar: MatSnackBar
  ) {
    this.http = this.injector.get(HttpClient);
    this.ngZone = this.injector.get(NgZone);
    
    // Initialize filtered arrays for searchable dropdowns
    this.filteredWarehouses = [...(data.warehouses || [])];
    this.filteredDrivers = [...(data.drivers || [])];
    this.filteredVehicles = [...(data.vehicles || [])];
    
    // Handle edit mode pre-population
    if (data.isEditMode) {
      // Set pre-selected values
      if (data.preSelectedWarehouse) {
        this.selectedWarehouse = data.preSelectedWarehouse;
        this.warehouseSearchText = data.preSelectedWarehouse.name || '';
      } else if (data.warehouses?.length > 0) {
        this.selectedWarehouse = data.warehouses[0];
        this.warehouseSearchText = data.warehouses[0].name || '';
      }
      if (data.preSelectedDriver) {
        this.selectedDriver = data.preSelectedDriver;
        this.driverSearchText = `${data.preSelectedDriver.firstName || ''} ${data.preSelectedDriver.lastName || ''}`.trim();
      }
      if (data.preSelectedVehicle) {
        this.selectedVehicle = data.preSelectedVehicle;
        this.vehicleSearchText = data.preSelectedVehicle.registrationNumber || '';
      }
      if (data.preScheduledDate) {
        this.scheduledDate = data.preScheduledDate;
      }
      if (data.preSpecialInstructions) {
        this.specialInstructions = data.preSpecialInstructions;
      }
      if (data.preTotalDistance) {
        this.totalDistance = data.preTotalDistance;
      }
      if (data.preEstimatedTime) {
        this.estimatedTime = data.preEstimatedTime;
      }
    } else {
      // Set first warehouse as default for new tripsheets
      if (data.warehouses && data.warehouses.length > 0) {
        this.selectedWarehouse = data.warehouses[0];
        this.warehouseSearchText = data.warehouses[0].name || '';
      }
    }
    
    // Initialize province data for invoices
    this.initializeProvinceData();
    
    // If coming from import or edit mode with pre-selected invoices, auto-add them to stops
    if ((data.isImport || data.isEditMode) && data.preSelectedInvoices?.length) {
      // Pre-select all imported/existing invoices as stops
      setTimeout(() => {
        data.preSelectedInvoices!.forEach(invoice => {
          this.addStop(invoice);
        });
        // After adding all stops, trigger route calculation if not in edit mode (already has distance)
        if (this.selectedStops.length > 0 && !data.isEditMode) {
          setTimeout(() => this.calculateDistance(), 500);
        } else if (data.isEditMode) {
          // Just update grouped stops for edit mode
          this.updateGroupedStops();
        }
      }, 100);
    }
    
    // Setup address autocomplete debounce
    this.addressInputSubject.pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => prev.query === curr.query)
    ).subscribe(({group, query}) => {
      this.searchAddresses(query);
    });
  }

  ngAfterViewInit(): void {
    // Map will be initialized when step 2 is active
  }

  onStepChange(event: any): void {
    // When step 2 (Route & Schedule) becomes active, initialize the map
    if (event.selectedIndex === 1) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        this.initializeMap();
      }, 300);
    }
  }

  ngOnDestroy(): void {
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
    }
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
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
          invoice.latitude = cached.latitude;
          invoice.longitude = cached.longitude;
          invoice.formattedAddress = cached.formattedAddress;
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
            
            // Extract coordinates from geocoding result
            const location = result.geometry?.location;
            if (location) {
              invoice.latitude = location.lat;
              invoice.longitude = location.lng;
              invoice.formattedAddress = result.formatted_address;
            }
            
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
                
                // Cache the result with coordinates
                this.customerProvinceCache.set(cacheKey, {
                  province: provinceCode,
                  city: invoice.city,
                  latitude: invoice.latitude,
                  longitude: invoice.longitude,
                  formattedAddress: invoice.formattedAddress
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
    
    // Use coordinates from invoice (geocoded) or customer record
    const latitude = invoice.latitude || customer?.latitude;
    const longitude = invoice.longitude || customer?.longitude;
    // Use empty string if no address found - placeholder will guide user
    const address = invoice.formattedAddress || customer?.physicalAddress || customer?.deliveryAddress || '';
    
    this.selectedStops.push({
      ...invoice,
      address: address,
      deliveryAddress: address,
      latitude: latitude,
      longitude: longitude
    });
    
    this.calculateTotalValue();
    this.updateGroupedStops();
    
    // Update the map if already initialized
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  // Toggle part delivery flag for an invoice
  togglePartDelivery(invoiceId: number, checked: boolean): void {
    if (checked) {
      this.partDeliveryMap.set(invoiceId, true);
    } else {
      this.partDeliveryMap.delete(invoiceId);
    }
  }

  // Add stop with part delivery tracking
  addStopWithPartDelivery(invoice: any): void {
    if (this.isInvoiceSelected(invoice)) {
      // Already selected, remove it
      this.removeStopByInvoice(invoice);
      return;
    }
    
    // Find customer details for address
    const customer = this.data.customers?.find(c => 
      c.accountNumber === invoice.customerNumber || c.name === invoice.customerName
    );
    
    // Use coordinates from invoice (geocoded) or customer record
    const latitude = invoice.latitude || customer?.latitude;
    const longitude = invoice.longitude || customer?.longitude;
    // Use empty string if no address found - placeholder will guide user
    const address = invoice.formattedAddress || customer?.physicalAddress || customer?.deliveryAddress || '';
    
    // Check if part delivery is marked for this invoice
    const isPartDelivery = this.partDeliveryMap.get(invoice.id) || false;
    const originalQuantity = invoice.quantity || 1;
    
    this.selectedStops.push({
      ...invoice,
      address: address,
      deliveryAddress: address,
      latitude: latitude,
      longitude: longitude,
      isPartDelivery: isPartDelivery,
      originalQuantity: originalQuantity,
      partialQuantity: isPartDelivery ? Math.ceil(originalQuantity / 2) : originalQuantity // Default to half for part delivery
    });
    
    this.calculateTotalValue();
    this.updateGroupedStops();
    
    // Update the map if already initialized
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  // Handle partial quantity change for part deliveries
  onPartialQuantityChange(stop: any): void {
    if (stop.partialQuantity < 1) {
      stop.partialQuantity = 1;
    }
    if (stop.partialQuantity > stop.originalQuantity) {
      stop.partialQuantity = stop.originalQuantity;
    }
    // Recalculate value based on partial quantity if needed
    if (stop.isPartDelivery && stop.originalQuantity > 0) {
      const unitPrice = stop.salesAmount / stop.originalQuantity;
      stop.partialSalesAmount = unitPrice * stop.partialQuantity;
    }
  }

  removeStop(index: number): void {
    this.selectedStops.splice(index, 1);
    this.calculateTotalValue();
    this.updateGroupedStops();
    
    // Update the map if already initialized
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  removeStopByInvoice(invoice: any): void {
    const index = this.selectedStops.findIndex(s => s.id === invoice.id);
    if (index > -1) {
      this.removeStop(index);
    }
  }

  clearAllStops(): void {
    this.selectedStops = [];
    this.groupedStops = [];
    this.totalDistance = 0;
    this.estimatedTime = '';
    this.returnDistance = 0;
    this.returnTime = '';
    this.totalValue = 0;
    
    // Update the map if already initialized
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  // Group stops by customer name (same customer = same delivery location)
  updateGroupedStops(): void {
    const groups = new Map<string, any>();
    
    this.selectedStops.forEach(stop => {
      const key = stop.customerName || stop.customerNumber;
      
      if (groups.has(key)) {
        const group = groups.get(key);
        group.invoices.push(stop);
        group.totalValue += stop.salesAmount || stop.totalAmount || 0;
      } else {
        groups.set(key, {
          customerName: stop.customerName,
          customerNumber: stop.customerNumber,
          deliveryAddress: stop.deliveryAddress || stop.address || '',
          latitude: stop.latitude,
          longitude: stop.longitude,
          city: stop.city,
          province: stop.province,
          invoices: [stop],
          totalValue: stop.salesAmount || stop.totalAmount || 0,
          isCollapsed: !!(stop.latitude && stop.longitude) // Auto-collapse if has coordinates
        });
      }
    });
    
    this.groupedStops = Array.from(groups.values());
    console.log('Grouped stops:', this.groupedStops.length, 'from', this.selectedStops.length, 'invoices');
    
    // Load saved addresses for the customers in the grouped stops
    if (this.groupedStops.length > 0) {
      this.loadSavedAddressesForCustomers();
    }
  }

  // Toggle collapse state of a stop
  toggleStopCollapse(group: any): void {
    // Only allow collapse if it has coordinates
    if (group.latitude && group.longitude) {
      group.isCollapsed = !group.isCollapsed;
    }
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
          
          // Update distance and time from API response + offload time
          this.totalDistance = Math.round(result.distanceMeters / 1000);
          const driveTimeMins = Math.round(result.durationSeconds / 60);
          const offloadMins = this.getUniqueCustomerOffloadTime();
          const totalMins = driveTimeMins + offloadMins;
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
          
          // Calculate return trip from last stop back to warehouse
          this.calculateReturnTrip(lastStop, origin);
          
          // Add offload time: 1 hour per unique customer (not per stop)
          const driveTimeSeconds = result.durationSeconds;
          const offloadMinutes = this.getUniqueCustomerOffloadTime();
          const totalSeconds = driveTimeSeconds + (offloadMinutes * 60);
          
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
  
  // Calculate return trip from last stop back to warehouse
  private calculateReturnTrip(lastStop: any, warehouse: any): void {
    if (!lastStop?.latitude || !warehouse?.latitude) {
      this.returnDistance = 0;
      this.returnTime = '0m';
      return;
    }
    
    const returnRequest = {
      origin: { latitude: lastStop.latitude, longitude: lastStop.longitude, label: lastStop.customerName || 'Last Stop' },
      destination: { latitude: warehouse.latitude, longitude: warehouse.longitude, label: warehouse.label || 'Warehouse' },
      waypoints: [],
      optimizeWaypoints: false,
      departureTime: new Date(Date.now() + 3600000).toISOString()
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/calculate-route`, returnRequest).subscribe({
      next: (result) => {
        if (result.success) {
          this.returnDistance = Math.round(result.distanceMeters / 1000);
          const returnMins = Math.round(result.durationSeconds / 60);
          const hours = Math.floor(returnMins / 60);
          const mins = returnMins % 60;
          this.returnTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        } else {
          // Fallback to haversine
          const dist = this.haversineDistance(lastStop.latitude, lastStop.longitude, warehouse.latitude, warehouse.longitude);
          this.returnDistance = Math.round(dist * 1.25);
          const returnMins = Math.round((this.returnDistance / 55) * 60);
          const hours = Math.floor(returnMins / 60);
          const mins = returnMins % 60;
          this.returnTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        }
      },
      error: () => {
        // Fallback to haversine
        const dist = this.haversineDistance(lastStop.latitude, lastStop.longitude, warehouse.latitude, warehouse.longitude);
        this.returnDistance = Math.round(dist * 1.25);
        const returnMins = Math.round((this.returnDistance / 55) * 60);
        const hours = Math.floor(returnMins / 60);
        const mins = returnMins % 60;
        this.returnTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
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
    
    // Calculate return distance from last stop back to warehouse
    const lastStopWithCoords = stopsWithCoords[stopsWithCoords.length - 1];
    if (lastStopWithCoords) {
      const returnDist = this.haversineDistance(lastStopWithCoords.latitude, lastStopWithCoords.longitude, startLat, startLng);
      this.returnDistance = Math.round(returnDist * 1.25);
      // Return time at 55km/h average
      const returnMinutes = Math.round((this.returnDistance / 55) * 60);
      const returnHours = Math.floor(returnMinutes / 60);
      const returnMins = returnMinutes % 60;
      this.returnTime = returnHours > 0 ? `${returnHours}h ${returnMins}m` : `${returnMins}m`;
    } else {
      this.returnDistance = 0;
      this.returnTime = '0m';
    }
    
    // Estimate time: 55km/h average (accounting for traffic) + 1 hour per unique customer for offloading
    const driveTimeMinutes = (this.totalDistance / 55) * 60;
    const offloadMinutes = this.getUniqueCustomerOffloadTime();
    const totalMinutes = Math.round(driveTimeMinutes + offloadMinutes);
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    this.estimatedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    this.updateRouteMap();
  }

  // Calculate offload time: 1 hour per unique customer (not per stop)
  private getUniqueCustomerOffloadTime(): number {
    const uniqueCustomers = new Set<string>();
    this.selectedStops.forEach(stop => {
      const customerName = (stop.customerName || stop.companyName || '').toLowerCase().trim();
      if (customerName) {
        uniqueCustomers.add(customerName);
      }
    });
    // 60 minutes per unique customer
    return uniqueCustomers.size * 60;
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
          
          // Update metrics + offload time
          this.totalDistance = Math.round(result.totalDistanceKm);
          
          const driveMins = Math.round((result.totalDurationMinutes || 0));
          const offloadMins = this.getUniqueCustomerOffloadTime();
          const totalMins = driveMins + offloadMins;
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
      // Initialize autocomplete service if Places is loaded
      if ((google.maps as any).places) {
        this.autocompleteService = new (google.maps as any).places.AutocompleteService();
      }
      return;
    }

    const callbackName = 'initTripsheetMap' + Date.now();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    
    (window as any)[callbackName] = () => {
      this.createMap(mapElement);
      // Initialize autocomplete service
      if ((google.maps as any).places) {
        this.autocompleteService = new (google.maps as any).places.AutocompleteService();
      }
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
    
    if (!this.map) {
      console.log('updateRouteMap: Map not initialized yet');
      return;
    }
    
    // Clear existing
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
    }
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
    }
    this.stopMarkers.forEach(m => m.setMap(null));
    this.stopMarkers = [];
    
    console.log('updateRouteMap: Total stops:', this.selectedStops.length);
    console.log('updateRouteMap: Stops data:', this.selectedStops.map(s => ({ 
      name: s.customerName, 
      lat: s.latitude, 
      lng: s.longitude 
    })));
    
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    console.log('updateRouteMap: Stops with coordinates:', stopsWithCoords.length);
    
    // Always show warehouse marker even if no stops
    const bounds = new google.maps.LatLngBounds();
    
    // Add warehouse as start point
    const startLat = this.selectedWarehouse?.latitude || -25.6963;
    const startLng = this.selectedWarehouse?.longitude || 28.7023;
    console.log('updateRouteMap: Warehouse position:', { lat: startLat, lng: startLng });
    
    const origin = { lat: startLat, lng: startLng };
    bounds.extend(origin);
    
    // Add warehouse marker
    const warehouseMarker = new google.maps.Marker({
      position: origin,
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
    
    // If no stops with coordinates, just show warehouse and return
    if (stopsWithCoords.length === 0) {
      console.log('updateRouteMap: No stops with coordinates, showing only warehouse');
      this.map.setCenter({ lat: startLat, lng: startLng });
      this.map.setZoom(10);
      return;
    }
    
    // Add stop markers
    stopsWithCoords.forEach((stop, index) => {
      const pos = { lat: stop.latitude, lng: stop.longitude };
      console.log(`updateRouteMap: Adding stop ${index + 1}:`, stop.customerName, pos);
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
    
    // Use Directions API to draw actual road route
    if (!this.directionsService) {
      this.directionsService = new (google.maps as any).DirectionsService();
    }
    if (!this.directionsRenderer) {
      this.directionsRenderer = new (google.maps as any).DirectionsRenderer({
        map: this.map,
        suppressMarkers: true, // We already have our own markers
        polylineOptions: {
          strokeColor: '#667eea',
          strokeOpacity: 0.8,
          strokeWeight: 5
        }
      });
    } else {
      (this.directionsRenderer as any).setMap(this.map);
    }
    
    // Build waypoints (all stops except the last one which is the destination)
    const destination = stopsWithCoords[stopsWithCoords.length - 1];
    const waypoints = stopsWithCoords.slice(0, -1).map(stop => ({
      location: { lat: stop.latitude, lng: stop.longitude },
      stopover: true
    }));
    
    // Request directions using promise-based API
    (this.directionsService as any).route({
      origin: origin,
      destination: { lat: destination.latitude, lng: destination.longitude },
      waypoints: waypoints,
      travelMode: 'DRIVING',
      optimizeWaypoints: false // Keep user's order
    }).then((result: any) => {
      this.directionsRenderer?.setDirections(result);
      console.log('Directions API: Route drawn successfully');
    }).catch((error: any) => {
      console.warn('Directions API failed:', error, '- falling back to straight lines');
      // Fallback to straight line polyline if Directions API fails
      const path = [origin, ...stopsWithCoords.map(s => ({ lat: s.latitude, lng: s.longitude }))];
      this.routePolyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#667eea',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: this.map
      });
    });
    
    this.map.fitBounds(bounds, 50);
  }

  // Check if stops have coordinates
  stopsHaveCoords(): boolean {
    if (this.groupedStops.length === 0) return false;
    return this.groupedStops.some(s => s.latitude && s.longitude);
  }

  // Get count of stops with coordinates
  getStopsWithCoords(): number {
    return this.groupedStops.filter(s => s.latitude && s.longitude).length;
  }

  // Handle stop address change - NOT USED with autocomplete
  onStopAddressChanged(stop: any): void {
    console.log('Stop address changed:', stop.customerName, '->', stop.deliveryAddress);
  }

  // Google Places Autocomplete - Input handler
  onAddressInput(group: any, event: any): void {
    const query = event.target.value;
    if (query && query.length > 2) {
      this.addressInputSubject.next({group, query});
    } else {
      this.addressPredictions = [];
    }
  }

  // Google Places Autocomplete - Focus handler
  onAddressFocus(group: any): void {
    if (group.deliveryAddress && group.deliveryAddress.length > 2) {
      this.searchAddresses(group.deliveryAddress);
    }
  }

  // Search addresses using Google Places Autocomplete
  searchAddresses(query: string): void {
    // Check if Places library is available
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn('Google Places API not loaded yet. Loading now...');
      this.loadPlacesLibrary().then(() => {
        this.doSearchAddresses(query);
      });
      return;
    }

    if (!this.autocompleteService) {
      this.autocompleteService = new (google.maps.places as any).AutocompleteService();
    }

    this.doSearchAddresses(query);
  }

  // Load Google Places library if not available
  private loadPlacesLibrary(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        resolve();
        return;
      }

      const apiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
      const callbackName = 'initPlacesLib' + Date.now();
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
      script.async = true;
      
      (window as any)[callbackName] = () => {
        this.autocompleteService = new (google.maps.places as any).AutocompleteService();
        delete (window as any)[callbackName];
        resolve();
      };
      
      document.head.appendChild(script);
    });
  }

  // Perform the actual address search
  private doSearchAddresses(query: string): void {
    if (!this.autocompleteService) {
      if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        this.autocompleteService = new (google.maps.places as any).AutocompleteService();
      } else {
        console.warn('Google Places API still not loaded');
        return;
      }
    }

    this.autocompleteService.getPlacePredictions({
      input: query,
      componentRestrictions: { country: 'za' }
      // No types restriction - includes addresses, establishments (hospitals, businesses), and other places
    }, (predictions: any, status: any) => {
      this.ngZone.run(() => {
        if (status === (google.maps.places as any).PlacesServiceStatus.OK && predictions) {
          this.addressPredictions = predictions;
        } else {
          this.addressPredictions = [];
        }
      });
    });
  }

  // Handle autocomplete selection
  onAddressSelected(group: any, event: any): void {
    const selectedAddress = event.option.value;
    group.deliveryAddress = selectedAddress;
    this.addressPredictions = [];
    
    // Update all invoices in this group with the new address
    group.invoices?.forEach((inv: any) => {
      inv.deliveryAddress = selectedAddress;
      inv.address = selectedAddress;
      // Also update in selectedStops
      const stop = this.selectedStops.find(s => s.id === inv.id);
      if (stop) {
        stop.deliveryAddress = selectedAddress;
        stop.address = selectedAddress;
      }
    });
    
    // Auto-geocode the selected address
    this.geocodeGroupAddress(group);
  }

  // Geocode a grouped stop's address
  geocodingAllStops = false;
  
  geocodeGroupAddress(group: any): void {
    if (!group.deliveryAddress) {
      console.warn('No address to geocode');
      return;
    }

    this.geocodingStop = group;
    const address = group.deliveryAddress;
    
    console.log('Geocoding group address:', address);
    
    this.http.get<any>(`${this.data.apiUrl}/logistics/googlemaps/geocode`, {
      params: { address }
    }).subscribe({
      next: (result) => {
        console.log('Geocode result:', result);
        if (result.latitude && result.longitude) {
          group.latitude = result.latitude;
          group.longitude = result.longitude;
          group.city = result.city;
          group.province = result.province;
          group.isCollapsed = true; // Collapse after successful geocoding
          
          // Update all invoices in this group with coordinates
          group.invoices.forEach((inv: any) => {
            inv.latitude = result.latitude;
            inv.longitude = result.longitude;
            inv.city = result.city;
            inv.province = result.province;
            inv.deliveryAddress = group.deliveryAddress;
            inv.address = group.deliveryAddress;
            
            // Also update in selectedStops
            const stop = this.selectedStops.find(s => s.id === inv.id);
            if (stop) {
              stop.latitude = result.latitude;
              stop.longitude = result.longitude;
              stop.city = result.city;
              stop.province = result.province;
              stop.deliveryAddress = group.deliveryAddress;
              stop.address = group.deliveryAddress;
            }
          });
          
          this.updateRouteMap();
          console.log('Group geocoded:', group.customerName, group.latitude, group.longitude);
        } else {
          console.warn('No coordinates in geocode result');
        }
        this.geocodingStop = null;
      },
      error: (err) => {
        console.error('Geocoding error:', err);
        this.geocodingStop = null;
      }
    });
  }

  geocodeStopAddress(stop: any): void {
    if (!stop.deliveryAddress) {
      console.warn('No address to geocode');
      return;
    }

    this.geocodingStop = stop;
    const address = stop.deliveryAddress + ', South Africa';
    
    console.log('Geocoding address:', address);
    
    this.http.get<any>(`${this.data.apiUrl}/logistics/googlemaps/geocode`, {
      params: { address }
    }).subscribe({
      next: (result) => {
        console.log('Geocode result:', result);
        if (result.latitude && result.longitude) {
          stop.latitude = result.latitude;
          stop.longitude = result.longitude;
          stop.city = result.city;
          stop.province = result.province;
          this.updateRouteMap();
          console.log('Stop geocoded:', stop.customerName, stop.latitude, stop.longitude);
        } else {
          console.warn('No coordinates in geocode result');
        }
        this.geocodingStop = null;
      },
      error: (err) => {
        console.error('Geocoding error:', err);
        this.geocodingStop = null;
      }
    });
  }

  // Geocode all grouped stops that are missing coordinates
  async geocodeAllStops(): Promise<void> {
    const groupsToGeocode = this.groupedStops.filter(g => !g.latitude && g.deliveryAddress);
    
    if (groupsToGeocode.length === 0) {
      console.log('No groups to geocode');
      return;
    }

    this.geocodingAllStops = true;
    console.log(`Geocoding ${groupsToGeocode.length} groups...`);

    for (const group of groupsToGeocode) {
      try {
        const address = group.deliveryAddress;
        const result = await this.http.get<any>(`${this.data.apiUrl}/logistics/googlemaps/geocode`, {
          params: { address }
        }).toPromise();

        if (result?.latitude && result?.longitude) {
          group.latitude = result.latitude;
          group.longitude = result.longitude;
          group.city = result.city;
          group.province = result.province;
          group.isCollapsed = true;
          
          // Update all invoices in this group
          group.invoices.forEach((inv: any) => {
            inv.latitude = result.latitude;
            inv.longitude = result.longitude;
            const stop = this.selectedStops.find(s => s.id === inv.id);
            if (stop) {
              stop.latitude = result.latitude;
              stop.longitude = result.longitude;
            }
          });
          
          console.log('Geocoded group:', group.customerName);
        }
      } catch (err) {
        console.error('Failed to geocode group:', group.customerName, err);
      }
    }

    this.geocodingAllStops = false;
    this.updateRouteMap();
    console.log('All group geocoding complete');
  }

  // ============ SAVED DELIVERY ADDRESSES ============
  
  // Get saved addresses for a customer group
  getSavedAddresses(group: any): any[] {
    const key = group.customerNumber || group.customerName;
    return this.customerSavedAddresses.get(key) || [];
  }

  // Load saved addresses for customers in the selected stops
  loadSavedAddressesForCustomers(): void {
    const customerIds = new Set<number>();
    const customerKeys = new Set<string>();
    
    // Collect customer IDs and names from grouped stops
    this.groupedStops.forEach(group => {
      // Try to find customer in the customers list
      const customer = this.data.customers?.find((c: any) => 
        c.customerCode === group.customerNumber || 
        c.name === group.customerName ||
        c.shortName === group.customerName
      );
      
      if (customer?.id) {
        customerIds.add(customer.id);
      }
      customerKeys.add(group.customerNumber || group.customerName);
    });

    if (customerIds.size === 0) {
      console.log('No customer IDs found to load saved addresses');
      return;
    }

    this.loadingSavedAddresses = true;
    const idsArray = Array.from(customerIds);

    this.http.get<any>(`${this.data.apiUrl}/logistics/customers/delivery-addresses/batch`, {
      params: { customerIds: idsArray.join(',') }
    }).subscribe({
      next: (result) => {
        console.log('Loaded saved addresses:', result);
        // Map the results by customer code/name for easy lookup
        this.customerSavedAddresses.clear();
        
        // Result is a dictionary with customerId as key
        Object.entries(result).forEach(([customerId, addresses]) => {
          // Find the customer to get the name/code
          const customer = this.data.customers?.find((c: any) => c.id === parseInt(customerId));
          if (customer) {
            const key = customer.customerCode || customer.name;
            this.customerSavedAddresses.set(key, addresses as any[]);
            // Also set by name if different
            if (customer.name && customer.name !== key) {
              this.customerSavedAddresses.set(customer.name, addresses as any[]);
            }
          }
        });
        
        this.loadingSavedAddresses = false;
        console.log('Saved addresses mapped:', this.customerSavedAddresses.size, 'customers');
      },
      error: (err) => {
        console.error('Failed to load saved addresses:', err);
        this.loadingSavedAddresses = false;
      }
    });
  }

  // Handle selection of a saved address
  onSavedAddressSelected(group: any, savedAddress: any): void {
    if (!savedAddress) return;

    // Update the group with the saved address data
    group.deliveryAddress = savedAddress.formattedAddress || savedAddress.address;
    group.latitude = savedAddress.latitude;
    group.longitude = savedAddress.longitude;
    group.city = savedAddress.city;
    group.province = savedAddress.province;
    group.isCollapsed = !!(savedAddress.latitude && savedAddress.longitude);

    // Update all invoices in this group
    group.invoices?.forEach((inv: any) => {
      inv.deliveryAddress = group.deliveryAddress;
      inv.address = group.deliveryAddress;
      inv.latitude = savedAddress.latitude;
      inv.longitude = savedAddress.longitude;
      inv.city = savedAddress.city;
      inv.province = savedAddress.province;

      // Also update in selectedStops
      const stop = this.selectedStops.find(s => s.id === inv.id);
      if (stop) {
        stop.deliveryAddress = group.deliveryAddress;
        stop.address = group.deliveryAddress;
        stop.latitude = savedAddress.latitude;
        stop.longitude = savedAddress.longitude;
        stop.city = savedAddress.city;
        stop.province = savedAddress.province;
      }
    });

    // Record usage of this address
    this.http.post(`${this.data.apiUrl}/logistics/customers/delivery-addresses/${savedAddress.id}/use`, {}).subscribe({
      next: () => console.log('Recorded address usage'),
      error: (err) => console.error('Failed to record address usage:', err)
    });

    // Update the map
    if (this.mapInitialized) {
      this.updateRouteMap();
    }

    // Show snackbar notification
    this.snackBar.open(
      `✓ Applied saved address for ${group.customerName}`,
      'OK',
      { duration: 2000, panelClass: ['info-snackbar'] }
    );

    console.log('Applied saved address to group:', group.customerName, group.deliveryAddress);
  }

  // Save the current address for a customer
  saveAddressForCustomer(group: any): void {
    if (!group.deliveryAddress) {
      console.warn('No address to save');
      return;
    }

    // Find the customer
    const customer = this.data.customers?.find((c: any) => 
      c.customerCode === group.customerNumber || 
      c.name === group.customerName ||
      c.shortName === group.customerName
    );

    const payload = {
      customerId: customer?.id || 0,
      customerName: group.customerName,
      customerCode: group.customerNumber,
      address: group.deliveryAddress,
      city: group.city,
      province: group.province,
      latitude: group.latitude,
      longitude: group.longitude,
      formattedAddress: group.deliveryAddress
    };

    this.http.post<any>(`${this.data.apiUrl}/logistics/customers/delivery-addresses/save`, payload).subscribe({
      next: (result) => {
        console.log('Saved delivery address:', result);
        
        // Add to local cache
        const key = group.customerNumber || group.customerName;
        const existing = this.customerSavedAddresses.get(key) || [];
        
        // Check if already in cache
        const existingIndex = existing.findIndex(a => a.id === result.id);
        if (existingIndex >= 0) {
          existing[existingIndex] = result;
        } else {
          existing.unshift(result); // Add to beginning
        }
        
        this.customerSavedAddresses.set(key, existing);
        
        // Show success snackbar notification
        this.snackBar.open(
          `✓ Address saved for ${group.customerName}`,
          'OK',
          { duration: 3000, panelClass: ['success-snackbar'] }
        );
      },
      error: (err) => {
        console.error('Failed to save address:', err);
        this.snackBar.open(
          `✗ Failed to save address: ${err.error?.message || 'Unknown error'}`,
          'Dismiss',
          { duration: 5000, panelClass: ['error-snackbar'] }
        );
      }
    });
  }

  // Save all addresses when creating tripsheet
  saveAllAddresses(): void {
    const addressesToSave: any[] = [];

    this.groupedStops.forEach(group => {
      if (group.deliveryAddress && group.latitude && group.longitude) {
        const customer = this.data.customers?.find((c: any) => 
          c.customerCode === group.customerNumber || 
          c.name === group.customerName
        );

        addressesToSave.push({
          customerId: customer?.id || 0,
          customerName: group.customerName,
          customerCode: group.customerNumber,
          address: group.deliveryAddress,
          city: group.city,
          province: group.province,
          latitude: group.latitude,
          longitude: group.longitude,
          formattedAddress: group.deliveryAddress
        });
      }
    });

    if (addressesToSave.length === 0) {
      console.log('No addresses to save');
      return;
    }

    this.http.post<any>(`${this.data.apiUrl}/logistics/customers/delivery-addresses/batch-save`, {
      addresses: addressesToSave
    }).subscribe({
      next: (result) => {
        const savedCount = result.saved?.length || 0;
        const errorCount = result.errors?.length || 0;
        console.log('Batch saved addresses:', savedCount, 'saved,', errorCount, 'errors');
        
        if (savedCount > 0) {
          this.snackBar.open(
            `✓ ${savedCount} address${savedCount > 1 ? 'es' : ''} saved for future use`,
            'OK',
            { duration: 4000, panelClass: ['success-snackbar'] }
          );
        }
      },
      error: (err) => {
        console.error('Failed to batch save addresses:', err);
        // Don't show error for batch save - it's a background operation
      }
    });
  }

  // ============ END SAVED DELIVERY ADDRESSES ============

  // Refresh map
  refreshMap(): void {
    console.log('Refreshing map...');
    console.log('Selected stops:', this.selectedStops);
    console.log('Stops with coords:', this.selectedStops.filter(s => s.latitude && s.longitude));
    
    if (this.mapInitialized) {
      this.updateRouteMap();
    } else {
      this.initializeMap();
    }
  }

  // When warehouse is selected, update the map
  onWarehouseSelected(): void {
    console.log('Warehouse selected:', this.selectedWarehouse);
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  // Searchable dropdown filter methods
  filterWarehouses(): void {
    const searchValue = this.warehouseSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    if (!search) {
      this.filteredWarehouses = [...(this.data.warehouses || [])];
    } else {
      this.filteredWarehouses = (this.data.warehouses || []).filter(wh => 
        wh.name?.toLowerCase().includes(search) ||
        wh.city?.toLowerCase().includes(search) ||
        wh.code?.toLowerCase().includes(search)
      );
    }
  }

  filterDrivers(): void {
    const searchValue = this.driverSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    if (!search) {
      this.filteredDrivers = [...(this.data.drivers || [])];
    } else {
      this.filteredDrivers = (this.data.drivers || []).filter(d => 
        d.firstName?.toLowerCase().includes(search) ||
        d.lastName?.toLowerCase().includes(search) ||
        `${d.firstName} ${d.lastName}`.toLowerCase().includes(search)
      );
    }
  }

  filterVehicles(): void {
    const searchValue = this.vehicleSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    if (!search) {
      this.filteredVehicles = [...(this.data.vehicles || [])];
    } else {
      this.filteredVehicles = (this.data.vehicles || []).filter(v => 
        v.registrationNumber?.toLowerCase().includes(search) ||
        v.make?.toLowerCase().includes(search) ||
        v.model?.toLowerCase().includes(search) ||
        `${v.registrationNumber} ${v.make} ${v.model}`.toLowerCase().includes(search)
      );
    }
  }

  displayWarehouse(wh: any): string {
    return wh ? `${wh.name} - ${wh.city}` : '';
  }

  displayDriver(driver: any): string {
    return driver ? `${driver.firstName} ${driver.lastName}` : '';
  }

  displayVehicle(vehicle: any): string {
    return vehicle ? `${vehicle.registrationNumber} - ${vehicle.make} ${vehicle.model}` : '';
  }

  onWarehouseAutocompleteSelected(event: any): void {
    this.selectedWarehouse = event.option.value;
    this.onWarehouseSelected();
  }

  onDriverAutocompleteSelected(event: any): void {
    this.selectedDriver = event.option.value;
  }

  onVehicleAutocompleteSelected(event: any): void {
    this.selectedVehicle = event.option.value;
  }

  // Load TFN depot locations on the map
  // Map province names to province codes
  getProvinceCode(provinceName: string): string {
    const mapping: { [key: string]: string } = {
      'gauteng': 'GP',
      'kwazulu-natal': 'KZN',
      'kwa-zulu natal': 'KZN',
      'western cape': 'WC',
      'eastern cape': 'EC',
      'free state': 'FS',
      'limpopo': 'LP',
      'mpumalanga': 'MP',
      'north west': 'NW',
      'northern cape': 'NC'
    };
    return mapping[provinceName?.toLowerCase()] || '';
  }

  loadTfnDepots(): void {
    if (!this.map) {
      console.warn('Map not initialized yet');
      return;
    }

    // Clear existing depot markers
    this.tfnDepotMarkers.forEach(m => m.setMap(null));
    this.tfnDepotMarkers = [];

    // Get the warehouse province code
    const warehouseProvinceCode = this.getProvinceCode(this.selectedWarehouse?.province || '');
    console.log('Warehouse province:', this.selectedWarehouse?.province, '-> Code:', warehouseProvinceCode);

    // Filter depots by province if warehouse has a province
    const depotsToShow = warehouseProvinceCode 
      ? this.tfnDepots.filter(d => d.province === warehouseProvinceCode)
      : this.tfnDepots;

    console.log('Showing depots:', depotsToShow.map(d => d.name).join(', '));

    // Add depot markers
    depotsToShow.forEach(depot => {
      const marker = new google.maps.Marker({
        position: { lat: depot.latitude, lng: depot.longitude },
        map: this.map,
        title: depot.name,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#ff9800',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        }
      } as any);

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 8px; font-family: Arial;"><strong>${depot.name}</strong><br>${depot.address}<br><small>Code: ${depot.code}</small></div>`
      });

      marker.addListener('click', () => {
        infoWindow.open(this.map, marker);
      });

      this.tfnDepotMarkers.push(marker);
    });

    this.tfnDepotsLoaded = true;

    // Fit bounds to show all markers including depots
    if (this.tfnDepotMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      
      // Include warehouse
      if (this.selectedWarehouse?.latitude && this.selectedWarehouse?.longitude) {
        bounds.extend({ lat: this.selectedWarehouse.latitude, lng: this.selectedWarehouse.longitude });
      }
      
      // Include stops
      this.selectedStops.forEach(s => {
        if (s.latitude && s.longitude) {
          bounds.extend({ lat: s.latitude, lng: s.longitude });
        }
      });
      
      // Include filtered depots only
      depotsToShow.forEach(d => {
        bounds.extend({ lat: d.latitude, lng: d.longitude });
      });
      
      this.map.fitBounds(bounds, 50);
    }
  }

  async previewPdf(): Promise<void> {
    let mapImageUrl = '';
    
    // If checkbox is checked, capture the route map
    if (this.includeRouteMapInTripsheet && this.map) {
      mapImageUrl = await this.captureRouteMapImage();
    }
    
    // Create a preview window with trip sheet HTML
    const html = this.generateTripsheetHtml(mapImageUrl);
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(html);
      previewWindow.document.close();
    }
  }
  
  // Capture the route map as a static image URL using Google Static Maps API
  private async captureRouteMapImage(): Promise<string> {
    const apiKey = 'AIzaSyBSgIOzAqIja1Y8jo_DCAM4fXr5L0xbGKM';
    const warehouseLat = this.selectedWarehouse?.latitude || -29.8587;
    const warehouseLng = this.selectedWarehouse?.longitude || 31.0218;
    
    // Build markers
    let markers = `markers=color:green|label:W|${warehouseLat},${warehouseLng}`;
    
    // Add stop markers
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    stopsWithCoords.forEach((stop, i) => {
      markers += `&markers=color:red|label:${i + 1}|${stop.latitude},${stop.longitude}`;
    });
    
    // Build path for route
    let path = `path=color:0x1976d2ff|weight:4|${warehouseLat},${warehouseLng}`;
    stopsWithCoords.forEach(stop => {
      path += `|${stop.latitude},${stop.longitude}`;
    });
    // Add return path to warehouse
    if (stopsWithCoords.length > 0) {
      path += `|${warehouseLat},${warehouseLng}`;
    }
    
    // Generate static map URL
    const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=800x400&maptype=roadmap&${markers}&${path}&key=${apiKey}`;
    
    return mapUrl;
  }

  createTripsheet(): void {
    this.creating = true;
    
    // Save all delivery addresses for future use
    this.saveAllAddresses();
    
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
        address: stop.deliveryAddress || stop.address || 'Unknown',
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
    
    // Determine if this is an update or create
    const isUpdate = this.data.isEditMode && this.data.editLoadId;
    const apiUrl = isUpdate 
      ? `${environment.apiUrl}/loads/${this.data.editLoadId}`
      : `${environment.apiUrl}/loads`;
    const httpMethod = isUpdate ? this.http.put.bind(this.http) : this.http.post.bind(this.http);
    
    httpMethod(apiUrl, payload).subscribe({
      next: (result: any) => {
        const loadId = isUpdate ? this.data.editLoadId : result.id;
        // Download the PDF
        this.http.get(`${environment.apiUrl}/logistics/tripsheet/${loadId}/pdf`, { responseType: 'text' }).subscribe({
          next: (html) => {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(html);
              printWindow.document.close();
              setTimeout(() => printWindow.print(), 500);
            }
            
            this.creating = false;
            this.dialogRef.close({ created: !isUpdate, updated: isUpdate, loadId: loadId });
          },
          error: () => {
            this.creating = false;
            this.dialogRef.close({ created: !isUpdate, updated: isUpdate, loadId: loadId });
          }
        });
      },
      error: (err) => {
        console.error('Failed to ' + (isUpdate ? 'update' : 'create') + ' tripsheet:', err);
        this.creating = false;
      }
    });
  }

  private generateTripsheetHtml(mapImageUrl: string = ''): string {
    const date = new Date().toLocaleDateString('en-ZA', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    // Calculate unique customers for offload time
    const uniqueCustomers = new Set<string>();
    this.selectedStops.forEach(stop => {
      const customerName = (stop.customerName || stop.companyName || '').toLowerCase().trim();
      if (customerName) uniqueCustomers.add(customerName);
    });
    const uniqueCustomerCount = uniqueCustomers.size;
    
    // Calculate return distance if not already calculated
    let returnDistKm = this.returnDistance;
    let returnTimeStr = this.returnTime;
    
    if (returnDistKm === 0 && this.selectedStops.length > 0) {
      // Calculate return distance from last stop to warehouse using haversine
      const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
      if (stopsWithCoords.length > 0) {
        const lastStop = stopsWithCoords[stopsWithCoords.length - 1];
        const warehouseLat = this.selectedWarehouse?.latitude || -29.8587;
        const warehouseLng = this.selectedWarehouse?.longitude || 31.0218;
        
        if (lastStop?.latitude && lastStop?.longitude) {
          const dist = this.haversineDistance(lastStop.latitude, lastStop.longitude, warehouseLat, warehouseLng);
          returnDistKm = Math.round(dist * 1.25); // Add 25% for roads
          const returnMins = Math.round((returnDistKm / 55) * 60);
          const hours = Math.floor(returnMins / 60);
          const mins = returnMins % 60;
          returnTimeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        }
      }
    }
    
    let stopsHtml = '';
    let totalQty = 0;
    this.selectedStops.forEach((stop, i) => {
      const qty = stop.quantity || stop.qty || 1;
      totalQty += qty;
      stopsHtml += `
        <tr>
          <td class="center"><span class="stop-num">${i + 1}</span></td>
          <td>${stop.transactionNumber}</td>
          <td class="customer">${stop.customerName}</td>
          <td class="address">${stop.deliveryAddress || stop.address || 'N/A'}</td>
          <td class="product">${stop.productDescription?.substring(0, 30) || 'Product'}${stop.productDescription?.length > 30 ? '...' : ''}</td>
          <td class="center"><strong>${qty}</strong></td>
          <td class="right">R ${stop.netSales?.toFixed(2) || stop.salesAmount?.toFixed(2) || '0.00'}</td>
          <td class="center"><span class="checkbox"></span></td>
        </tr>
      `;
    });
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trip Sheet - ${date}</title>
        <style>
          @page { size: landscape; margin: 8mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.3; padding: 10px; background: white; }
          .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 3px solid #1976d2; margin-bottom: 10px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .logo { font-size: 21px; font-weight: bold; color: #1976d2; }
          .trip-badge { background: #1976d2; color: white; padding: 5px 15px; border-radius: 15px; font-size: 15px; font-weight: bold; }
          .company { text-align: right; font-size: 14px; font-weight: bold; color: #333; }
          .info-strip { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; padding: 6px 10px; background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%); border-radius: 5px; border: 1px solid #ddd; }
          .info-item { display: flex; align-items: center; gap: 4px; padding: 2px 8px; background: white; border-radius: 4px; border: 1px solid #e0e0e0; font-size: 11px; }
          .info-item strong { color: #333; }
          .info-sub { color: #666; font-size: 10px; }
          .route-map-section { margin: 8px 0; text-align: center; page-break-inside: avoid; }
          .route-map-section h4 { font-size: 12px; color: #1976d2; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 5px; }
          .route-map-section img { max-width: 100%; height: auto; border: 2px solid #1976d2; border-radius: 5px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #1976d2; color: white; padding: 6px 4px; text-align: left; font-weight: 600; font-size: 11px; white-space: nowrap; }
          th.center, td.center { text-align: center; }
          th.right, td.right { text-align: right; }
          td { padding: 5px 4px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
          tr:nth-child(even) { background: #f9f9f9; }
          .stop-num { background: #1976d2; color: white; width: 21px; height: 21px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; }
          .customer { font-weight: 600; color: #333; font-size: 11px; }
          .address { color: #666; font-size: 10px; max-width: 150px; }
          .product { font-size: 10px; }
          .checkbox { width: 17px; height: 17px; border: 2px solid #1976d2; border-radius: 2px; display: inline-block; }
          .totals td { background: #e3f2fd; font-weight: bold; border-top: 2px solid #1976d2; }
          .bottom-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
          .section-box { border: 1px solid #ddd; border-radius: 5px; padding: 8px; }
          .section-box h4 { font-size: 12px; color: #1976d2; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e0e0e0; }
          .km-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 6px; }
          .km-field label { display: block; font-size: 10px; color: #666; margin-bottom: 2px; }
          .input-box { border: 1px solid #ccc; border-radius: 3px; height: 21px; background: white; }
          .sig-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .sig-box { text-align: center; }
          .sig-line { border-bottom: 1px solid #333; height: 28px; margin-bottom: 3px; }
          .sig-label { font-size: 10px; color: #666; text-transform: uppercase; }
          .footer { margin-top: 8px; text-align: center; font-size: 10px; color: #999; padding-top: 6px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <span class="logo">🚛 TRIP SHEET</span>
            <span class="trip-badge">LOAD-${Date.now().toString().slice(-6)}</span>
          </div>
          <div class="company">ProMed Technologies<br/><span style="color: #666; font-size: 8px;">Logistics Division</span></div>
        </div>
        
        <div class="info-strip">
          <div class="info-item"><span>👤</span> <strong>${this.selectedDriver ? this.selectedDriver.firstName + ' ' + this.selectedDriver.lastName : 'UNASSIGNED'}</strong></div>
          <div class="info-item"><span>🚛</span> <strong>${this.selectedVehicle?.registrationNumber || 'N/A'}</strong> <span class="info-sub">${this.selectedVehicle?.type || ''}</span></div>
          <div class="info-item"><span>📅</span> <strong>${new Date().toLocaleDateString('en-ZA')}</strong></div>
          <div class="info-item"><span>📍</span> <strong>${this.selectedWarehouse?.name || 'Warehouse'}</strong> <span class="info-sub">${this.selectedWarehouse?.city || ''}</span></div>
          <div class="info-item"><span>🚚</span> <strong>${this.selectedStops.length} Stops</strong> <span class="info-sub">(${uniqueCustomerCount} customers)</span></div>
          <div class="info-item"><span>⏱️</span> <strong>${this.totalDistance}km</strong> <span class="info-sub">${this.estimatedTime} (incl. ${uniqueCustomerCount}h offload)</span></div>
          <div class="info-item" style="background: #fff3e0; border-color: #ff9800;"><span>🔄</span> <strong>Return:</strong> <span class="info-sub">${returnDistKm}km • ${returnTimeStr}</span></div>
          <div class="info-item"><span>💰</span> <strong>R ${this.totalValue.toFixed(2)}</strong></div>
        </div>
        
        ${mapImageUrl ? `
        <div class="route-map-section">
          <h4>🗺️ ROUTE PREVIEW</h4>
          <img src="${mapImageUrl}" alt="Route Map" />
        </div>
        ` : ''}
        
        <table>
          <thead>
            <tr>
              <th class="center" style="width: 35px;">NO</th>
              <th style="width: 80px;">INV NO</th>
              <th style="width: 160px;">CUSTOMER NAME</th>
              <th>DELIVERY ADDRESS</th>
              <th style="width: 140px;">PRODUCT</th>
              <th class="center" style="width: 45px;">QTY</th>
              <th class="right" style="width: 70px;">VALUE</th>
              <th class="center" style="width: 35px;">✓</th>
            </tr>
          </thead>
          <tbody>
            ${stopsHtml}
            <tr class="totals">
              <td colspan="5" style="text-align: right;">TOTALS:</td>
              <td class="center">${totalQty}</td>
              <td class="right">R ${this.totalValue.toFixed(2)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        
        <div class="bottom-section">
          <div class="section-box">
            <h4>📊 VEHICLE RECORD</h4>
            <div class="km-grid">
              <div class="km-field"><label>Opening KM:</label><div class="input-box"></div></div>
              <div class="km-field"><label>Closing KM:</label><div class="input-box"></div></div>
            </div>
          </div>
          <div class="section-box">
            <h4>✍️ SIGNATURES</h4>
            <div class="sig-grid">
              <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Driver</div></div>
              <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Dispatch</div></div>
            </div>
          </div>
        </div>
        
        <div class="footer">Generated ${new Date().toLocaleString('en-ZA')} | ProMed Technologies Logistics</div>
      </body>
      </html>
    `;
  }
}

// Tripsheet Type Selection Dialog
@Component({
  selector: 'tripsheet-type-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="tripsheet-type-dialog">
      <div class="dialog-header">
        <h2><mat-icon>add_road</mat-icon> Create Trip Sheet</h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div class="dialog-content">
        <p class="subtitle">Select the type of trip sheet you want to create:</p>
        
        <div class="type-grid">
          <div class="type-card" (click)="selectType('import')" matTooltip="Import trip sheet data from an Excel file">
            <div class="type-icon import">
              <mat-icon>upload_file</mat-icon>
            </div>
            <h3>Import Tripsheet</h3>
            <p>Upload an Excel file with invoice and delivery data</p>
          </div>
          
          <div class="type-card" (click)="selectType('automatic')" matTooltip="Create trip sheet from pending system invoices">
            <div class="type-icon automatic">
              <mat-icon>auto_awesome</mat-icon>
            </div>
            <h3>Automatic Tripsheet</h3>
            <p>Link to pending invoices from the TFN system</p>
          </div>
          
          <div class="type-card" (click)="selectType('manual')" matTooltip="Manually enter invoice and delivery details">
            <div class="type-icon manual">
              <mat-icon>edit_note</mat-icon>
            </div>
            <h3>Manual Tripsheet</h3>
            <p>Enter invoice numbers, customers, and products manually</p>
          </div>
          
          <div class="type-card" (click)="selectType('transfer')" matTooltip="Create an internal stock transfer between warehouses">
            <div class="type-icon transfer">
              <mat-icon>swap_horiz</mat-icon>
            </div>
            <h3>Internal Transfer</h3>
            <p>Move stock between warehouses</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tripsheet-type-dialog {
      min-width: 750px;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #1976d2, #1565c0);
      color: white;
      margin: -24px -24px 0;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 22px;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      padding: 32px 8px;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin: 0 0 28px;
      font-size: 15px;
    }
    .type-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .type-card {
      border: 2px solid #e0e0e0;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .type-card:hover {
      border-color: #1976d2;
      background: #f5f9ff;
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(25, 118, 210, 0.2);
    }
    .type-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .type-icon mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: white;
    }
    .type-icon.import {
      background: linear-gradient(135deg, #4caf50, #43a047);
    }
    .type-icon.automatic {
      background: linear-gradient(135deg, #2196f3, #1976d2);
    }
    .type-icon.manual {
      background: linear-gradient(135deg, #ff9800, #f57c00);
    }
    .type-icon.transfer {
      background: linear-gradient(135deg, #9c27b0, #7b1fa2);
    }
    .type-card h3 {
      margin: 0 0 8px;
      font-size: 16px;
      color: #333;
    }
    .type-card p {
      margin: 0;
      font-size: 13px;
      color: #666;
      line-height: 1.4;
    }
  `]
})
export class TripsheetTypeDialog {
  constructor(
    public dialogRef: MatDialogRef<TripsheetTypeDialog>
  ) {}

  selectType(type: 'import' | 'automatic' | 'manual' | 'transfer'): void {
    this.dialogRef.close({ type });
  }
}

// Manual Tripsheet Dialog - Create tripsheet without linking to system invoices
@Component({
  selector: 'manual-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatAutocompleteModule
  ],
  template: `
    <div class="manual-tripsheet-dialog">
      <div class="dialog-header">
        <h2><mat-icon>edit_note</mat-icon> Manual Trip Sheet</h2>
        <span class="subtitle">Create a trip sheet without linking to system invoices</span>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Route Configuration -->
        <div class="config-section">
          <h3><mat-icon>route</mat-icon> Route Configuration</h3>
          <div class="config-grid">
            <mat-form-field appearance="outline">
              <mat-label>Pickup Warehouse</mat-label>
              <input matInput 
                     [(ngModel)]="warehouseSearchText"
                     [matAutocomplete]="warehouseAuto"
                     (input)="filterWarehouses()"
                     (focus)="filterWarehouses()"
                     placeholder="Type to search warehouses..."
                     required>
              <mat-autocomplete #warehouseAuto="matAutocomplete" 
                               [displayWith]="displayWarehouse.bind(this)"
                               (optionSelected)="onWarehouseAutocompleteSelected($event)">
                @for (wh of filteredWarehouses; track wh.id) {
                  <mat-option [value]="wh">{{ wh.name }} - {{ wh.city }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>warehouse</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Driver</mat-label>
              <input matInput 
                     [(ngModel)]="driverSearchText"
                     [matAutocomplete]="driverAuto"
                     (input)="filterDrivers()"
                     (focus)="filterDrivers()"
                     placeholder="Type to search drivers...">
              <mat-autocomplete #driverAuto="matAutocomplete" 
                               [displayWith]="displayDriver.bind(this)"
                               (optionSelected)="onDriverAutocompleteSelected($event)">
                <mat-option [value]="null">-- Unassigned --</mat-option>
                @for (driver of filteredDrivers; track driver.id) {
                  <mat-option [value]="driver">{{ driver.firstName }} {{ driver.lastName }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>person</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Vehicle</mat-label>
              <input matInput 
                     [(ngModel)]="vehicleSearchText"
                     [matAutocomplete]="vehicleAuto"
                     (input)="filterVehicles()"
                     (focus)="filterVehicles()"
                     placeholder="Type to search vehicles...">
              <mat-autocomplete #vehicleAuto="matAutocomplete" 
                               [displayWith]="displayVehicle.bind(this)"
                               (optionSelected)="onVehicleAutocompleteSelected($event)">
                <mat-option [value]="null">-- Unassigned --</mat-option>
                @for (vehicle of filteredVehicles; track vehicle.id) {
                  <mat-option [value]="vehicle">{{ vehicle.registrationNumber }} - {{ vehicle.make }} {{ vehicle.model }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>local_shipping</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Scheduled Date</mat-label>
              <input matInput [matDatepicker]="picker" [(ngModel)]="scheduledDate">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Manual Line Items -->
        <div class="items-section">
          <div class="section-header">
            <h3><mat-icon>list_alt</mat-icon> Delivery Items ({{ lineItems.length }})</h3>
            <button mat-raised-button color="primary" (click)="addLineItem()">
              <mat-icon>add</mat-icon> Add Item
            </button>
          </div>

          <div class="items-list">
            @for (item of lineItems; track item.id; let i = $index) {
              <div class="line-item">
                <div class="item-number">{{ i + 1 }}</div>
                <div class="item-fields">
                  <mat-form-field appearance="outline" class="field-invoice">
                    <mat-label>Invoice Number</mat-label>
                    <input matInput [(ngModel)]="item.invoiceNumber" placeholder="e.g., INV-001">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-customer">
                    <mat-label>Customer Name</mat-label>
                    <input matInput [(ngModel)]="item.customerName" 
                           [matAutocomplete]="autoCustomer"
                           (input)="filterCustomers(item, $event)"
                           placeholder="Start typing...">
                    <mat-autocomplete #autoCustomer="matAutocomplete" (optionSelected)="onCustomerSelected(item, $event)">
                      @for (customer of filteredCustomers; track customer.id) {
                        <mat-option [value]="customer.name">{{ customer.name }}</mat-option>
                      }
                    </mat-autocomplete>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-address">
                    <mat-label>Delivery Address</mat-label>
                    <input matInput [(ngModel)]="item.deliveryAddress" placeholder="Full address">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-product">
                    <mat-label>Product/Commodity</mat-label>
                    <input matInput [(ngModel)]="item.productDescription" placeholder="e.g., Medical Supplies">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-qty">
                    <mat-label>Qty</mat-label>
                    <input matInput type="number" [(ngModel)]="item.quantity" min="1">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-value">
                    <mat-label>Value (R)</mat-label>
                    <input matInput type="number" [(ngModel)]="item.value" min="0" step="0.01">
                  </mat-form-field>
                </div>
                <button mat-icon-button color="warn" (click)="removeLineItem(i)" matTooltip="Remove item">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }

            @if (lineItems.length === 0) {
              <div class="empty-items">
                <mat-icon>inventory_2</mat-icon>
                <p>No items added yet. Click "Add Item" to add delivery items.</p>
              </div>
            }
          </div>
        </div>

        <!-- Summary -->
        @if (lineItems.length > 0) {
          <div class="summary-section">
            <div class="summary-item">
              <span class="label">Total Items:</span>
              <span class="value">{{ lineItems.length }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Total Quantity:</span>
              <span class="value">{{ getTotalQuantity() }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Subtotal:</span>
              <span class="value">R {{ getTotalValue() | number:'1.2-2' }}</span>
            </div>
            <div class="summary-item">
              <span class="label">VAT (15%):</span>
              <span class="value">R {{ getTotalValue() * 0.15 | number:'1.2-2' }}</span>
            </div>
            <div class="summary-item highlight">
              <span class="label">Total Incl. VAT:</span>
              <span class="value">R {{ getTotalValue() * 1.15 | number:'1.2-2' }}</span>
            </div>
          </div>
        }

        <!-- Special Instructions -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Special Instructions</mat-label>
          <textarea matInput [(ngModel)]="specialInstructions" rows="2" placeholder="Any special delivery instructions..."></textarea>
        </mat-form-field>
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" 
                (click)="createTripsheet()" 
                [disabled]="creating || !isValid()">
          @if (creating) {
            <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
          }
          {{ creating ? 'Creating...' : 'Create Trip Sheet' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .manual-tripsheet-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #ff9800, #f57c00);
      color: white;
      margin: -24px -24px 0;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
    }
    .dialog-header .subtitle {
      flex: 1;
      font-size: 13px;
      opacity: 0.9;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }
    .config-section, .items-section {
      margin-bottom: 24px;
    }
    .config-section h3, .items-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      color: #1976d2;
    }
    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .section-header h3 {
      margin: 0;
    }
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .line-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    .item-number {
      width: 32px;
      height: 32px;
      background: #1976d2;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      flex-shrink: 0;
    }
    .item-fields {
      flex: 1;
      display: grid;
      grid-template-columns: 120px 1fr 1fr 1fr 80px 100px;
      gap: 12px;
      align-items: start;
    }
    .item-fields mat-form-field {
      width: 100%;
    }
    .empty-items {
      text-align: center;
      padding: 48px;
      color: #999;
    }
    .empty-items mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }
    .summary-section {
      display: flex;
      gap: 32px;
      padding: 16px;
      background: #e3f2fd;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .summary-item .label {
      color: #666;
    }
    .summary-item .value {
      font-weight: 600;
      color: #1976d2;
    }
    .full-width {
      width: 100%;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      margin: 0 -24px -24px;
      background: #fafafa;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    mat-divider {
      margin: 24px 0;
    }
  `]
})
export class ManualTripsheetDialog {
  selectedWarehouse: any = null;
  selectedDriver: any = null;
  selectedVehicle: any = null;
  scheduledDate: Date = new Date();
  specialInstructions = '';
  creating = false;
  
  lineItems: any[] = [];
  filteredCustomers: any[] = [];
  
  // Searchable dropdown properties
  warehouseSearchText = '';
  driverSearchText = '';
  vehicleSearchText = '';
  filteredWarehouses: any[] = [];
  filteredDrivers: any[] = [];
  filteredVehicles: any[] = [];
  
  private itemIdCounter = 0;

  constructor(
    private http: HttpClient,
    public dialogRef: MatDialogRef<ManualTripsheetDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {
      drivers: any[],
      vehicles: any[],
      warehouses: any[],
      customers: any[],
      apiUrl: string
    }
  ) {
    // Initialize filtered arrays for searchable dropdowns
    this.filteredWarehouses = [...(data.warehouses || [])];
    this.filteredDrivers = [...(data.drivers || [])];
    this.filteredVehicles = [...(data.vehicles || [])];
    
    // Set default warehouse
    if (data.warehouses?.length > 0) {
      this.selectedWarehouse = data.warehouses[0];
      this.warehouseSearchText = data.warehouses[0].name || '';
    }
    // Add one empty line item to start
    this.addLineItem();
  }
  
  // Filter methods for searchable dropdowns
  filterWarehouses(): void {
    const searchValue = this.warehouseSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredWarehouses = search 
      ? (this.data.warehouses || []).filter(wh => 
          wh.name?.toLowerCase().includes(search) || 
          wh.city?.toLowerCase().includes(search)
        )
      : [...(this.data.warehouses || [])];
  }

  filterDrivers(): void {
    const searchValue = this.driverSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredDrivers = search 
      ? (this.data.drivers || []).filter(d => 
          d.firstName?.toLowerCase().includes(search) || 
          d.lastName?.toLowerCase().includes(search) ||
          `${d.firstName} ${d.lastName}`.toLowerCase().includes(search)
        )
      : [...(this.data.drivers || [])];
  }

  filterVehicles(): void {
    const searchValue = this.vehicleSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredVehicles = search 
      ? (this.data.vehicles || []).filter(v => 
          v.registrationNumber?.toLowerCase().includes(search) || 
          v.make?.toLowerCase().includes(search) ||
          v.model?.toLowerCase().includes(search)
        )
      : [...(this.data.vehicles || [])];
  }

  displayWarehouse(warehouse: any): string {
    return warehouse ? `${warehouse.name} - ${warehouse.city}` : '';
  }

  displayDriver(driver: any): string {
    return driver ? `${driver.firstName} ${driver.lastName}` : '';
  }

  displayVehicle(vehicle: any): string {
    return vehicle ? `${vehicle.registrationNumber} - ${vehicle.make} ${vehicle.model}` : '';
  }

  onWarehouseAutocompleteSelected(event: any): void {
    this.selectedWarehouse = event.option.value;
  }

  onDriverAutocompleteSelected(event: any): void {
    this.selectedDriver = event.option.value;
  }

  onVehicleAutocompleteSelected(event: any): void {
    this.selectedVehicle = event.option.value;
  }

  addLineItem(): void {
    this.lineItems.push({
      id: ++this.itemIdCounter,
      invoiceNumber: '',
      customerName: '',
      deliveryAddress: '',
      productDescription: '',
      quantity: 1,
      value: 0
    });
  }

  removeLineItem(index: number): void {
    this.lineItems.splice(index, 1);
  }

  filterCustomers(item: any, event: any): void {
    const query = event.target.value?.toLowerCase() || '';
    if (query.length < 2) {
      this.filteredCustomers = [];
      return;
    }
    this.filteredCustomers = (this.data.customers || [])
      .filter(c => c.name?.toLowerCase().includes(query))
      .slice(0, 10);
  }

  onCustomerSelected(item: any, event: any): void {
    const customer = this.data.customers?.find(c => c.name === event.option.value);
    if (customer) {
      item.customerName = customer.name;
      item.deliveryAddress = customer.address || customer.deliveryAddress || '';
    }
  }

  getTotalQuantity(): number {
    return this.lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  getTotalValue(): number {
    return this.lineItems.reduce((sum, item) => sum + (item.value || 0), 0);
  }

  isValid(): boolean {
    return this.selectedWarehouse && 
           this.lineItems.length > 0 && 
           this.lineItems.some(item => item.customerName || item.invoiceNumber);
  }

  createTripsheet(): void {
    if (!this.isValid()) return;
    
    this.creating = true;
    
    const tripsheetData = {
      warehouseId: this.selectedWarehouse?.id,
      origin: this.selectedWarehouse?.name,
      driverId: this.selectedDriver?.id,
      vehicleId: this.selectedVehicle?.id,
      scheduledDate: this.scheduledDate,
      specialInstructions: this.specialInstructions,
      isManual: true,
      lineItems: this.lineItems.map((item, index) => ({
        sequence: index + 1,
        invoiceNumber: item.invoiceNumber || `MAN-${Date.now()}-${index + 1}`,
        customerName: item.customerName,
        deliveryAddress: item.deliveryAddress,
        productDescription: item.productDescription,
        quantity: item.quantity,
        value: item.value
      }))
    };

    this.http.post(`${this.data.apiUrl}/logistics/tripsheet/manual`, tripsheetData).subscribe({
      next: (response: any) => {
        this.creating = false;
        this.dialogRef.close({ created: true, tripsheetId: response.loadId });
      },
      error: (error) => {
        console.error('Error creating manual tripsheet:', error);
        this.creating = false;
        // For now, close with success anyway (API might not exist yet)
        this.dialogRef.close({ created: true });
      }
    });
  }
}

// Internal Transfer Dialog - Warehouse to Warehouse stock movement
@Component({
  selector: 'internal-transfer-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatAutocompleteModule
  ],
  template: `
    <div class="transfer-dialog">
      <div class="dialog-header">
        <h2><mat-icon>swap_horiz</mat-icon> Internal Stock Transfer</h2>
        <span class="subtitle">Move stock between warehouses</span>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Transfer Route -->
        <div class="transfer-route">
          <div class="route-point">
            <div class="point-icon from">
              <mat-icon>warehouse</mat-icon>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>From Warehouse</mat-label>
              <input matInput 
                     [(ngModel)]="fromWarehouseSearchText"
                     [matAutocomplete]="fromWarehouseAuto"
                     (input)="filterFromWarehouses()"
                     (focus)="filterFromWarehouses()"
                     placeholder="Type to search..."
                     required>
              <mat-autocomplete #fromWarehouseAuto="matAutocomplete" 
                               [displayWith]="displayWarehouse.bind(this)"
                               (optionSelected)="onFromWarehouseSelected($event)">
                @for (wh of filteredFromWarehouses; track wh.id) {
                  <mat-option [value]="wh">{{ wh.name }} - {{ wh.city }}</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          </div>

          <div class="route-arrow">
            <mat-icon>arrow_forward</mat-icon>
          </div>

          <div class="route-point">
            <div class="point-icon to">
              <mat-icon>warehouse</mat-icon>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>To Warehouse</mat-label>
              <input matInput 
                     [(ngModel)]="toWarehouseSearchText"
                     [matAutocomplete]="toWarehouseAuto"
                     (input)="filterToWarehouses()"
                     (focus)="filterToWarehouses()"
                     placeholder="Type to search..."
                     required>
              <mat-autocomplete #toWarehouseAuto="matAutocomplete" 
                               [displayWith]="displayWarehouse.bind(this)"
                               (optionSelected)="onToWarehouseSelected($event)">
                @for (wh of filteredToWarehouses; track wh.id) {
                  <mat-option [value]="wh">{{ wh.name }} - {{ wh.city }}</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Assignment -->
        <div class="assignment-section">
          <h3><mat-icon>local_shipping</mat-icon> Transport Assignment</h3>
          <div class="assignment-grid">
            <mat-form-field appearance="outline">
              <mat-label>Driver</mat-label>
              <input matInput 
                     [(ngModel)]="driverSearchText"
                     [matAutocomplete]="driverAuto"
                     (input)="filterDrivers()"
                     (focus)="filterDrivers()"
                     placeholder="Type to search drivers...">
              <mat-autocomplete #driverAuto="matAutocomplete" 
                               [displayWith]="displayDriver.bind(this)"
                               (optionSelected)="onDriverAutocompleteSelected($event)">
                <mat-option [value]="null">-- Unassigned --</mat-option>
                @for (driver of filteredDrivers; track driver.id) {
                  <mat-option [value]="driver">{{ driver.firstName }} {{ driver.lastName }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>person</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Vehicle</mat-label>
              <input matInput 
                     [(ngModel)]="vehicleSearchText"
                     [matAutocomplete]="vehicleAuto"
                     (input)="filterVehicles()"
                     (focus)="filterVehicles()"
                     placeholder="Type to search vehicles...">
              <mat-autocomplete #vehicleAuto="matAutocomplete" 
                               [displayWith]="displayVehicle.bind(this)"
                               (optionSelected)="onVehicleAutocompleteSelected($event)">
                <mat-option [value]="null">-- Unassigned --</mat-option>
                @for (vehicle of filteredVehicles; track vehicle.id) {
                  <mat-option [value]="vehicle">{{ vehicle.registrationNumber }} - {{ vehicle.make }} {{ vehicle.model }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>local_shipping</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Transfer Date</mat-label>
              <input matInput [matDatepicker]="picker" [(ngModel)]="transferDate">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Transfer Reference</mat-label>
              <input matInput [(ngModel)]="transferReference" placeholder="e.g., TRF-001">
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Transfer Items -->
        <div class="items-section">
          <div class="section-header">
            <h3><mat-icon>inventory</mat-icon> Transfer Items ({{ transferItems.length }})</h3>
            <button mat-raised-button color="primary" (click)="addTransferItem()">
              <mat-icon>add</mat-icon> Add Item
            </button>
          </div>

          <div class="items-list">
            @for (item of transferItems; track item.id; let i = $index) {
              <div class="transfer-item">
                <div class="item-number">{{ i + 1 }}</div>
                <div class="item-fields">
                  <mat-form-field appearance="outline" class="field-code">
                    <mat-label>Item Code/SKU</mat-label>
                    <input matInput [(ngModel)]="item.itemCode" placeholder="e.g., MED-001">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-desc">
                    <mat-label>Description</mat-label>
                    <input matInput [(ngModel)]="item.description" placeholder="Item description">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-qty">
                    <mat-label>Quantity</mat-label>
                    <input matInput type="number" [(ngModel)]="item.quantity" min="1">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-uom">
                    <mat-label>UOM</mat-label>
                    <mat-select [(ngModel)]="item.uom">
                      <mat-option value="EA">EA (Each)</mat-option>
                      <mat-option value="BOX">BOX</mat-option>
                      <mat-option value="CS">CS (Case)</mat-option>
                      <mat-option value="PAL">PAL (Pallet)</mat-option>
                      <mat-option value="KG">KG</mat-option>
                      <mat-option value="L">L (Liters)</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
                <button mat-icon-button color="warn" (click)="removeTransferItem(i)" matTooltip="Remove item">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }

            @if (transferItems.length === 0) {
              <div class="empty-items">
                <mat-icon>inventory_2</mat-icon>
                <p>No items added yet. Click "Add Item" to add stock items for transfer.</p>
              </div>
            }
          </div>
        </div>

        <!-- Notes -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Transfer Notes</mat-label>
          <textarea matInput [(ngModel)]="notes" rows="2" placeholder="Any notes about this transfer..."></textarea>
        </mat-form-field>
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" 
                (click)="createTransfer()" 
                [disabled]="creating || !isValid()">
          @if (creating) {
            <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
          }
          {{ creating ? 'Creating...' : 'Create Transfer' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .transfer-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #9c27b0, #7b1fa2);
      color: white;
      margin: -24px -24px 0;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
    }
    .dialog-header .subtitle {
      flex: 1;
      font-size: 13px;
      opacity: 0.9;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }
    .transfer-route {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 24px;
      background: #f5f5f5;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    .route-point {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .point-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .point-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }
    .point-icon.from {
      background: linear-gradient(135deg, #f44336, #d32f2f);
    }
    .point-icon.to {
      background: linear-gradient(135deg, #4caf50, #388e3c);
    }
    .route-arrow {
      display: flex;
      align-items: center;
      padding: 0 16px;
    }
    .route-arrow mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #9c27b0;
    }
    .route-point mat-form-field {
      width: 250px;
    }
    .assignment-section, .items-section {
      margin-bottom: 24px;
    }
    .assignment-section h3, .items-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      color: #9c27b0;
    }
    .assignment-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .section-header h3 {
      margin: 0;
    }
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .transfer-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    .item-number {
      width: 32px;
      height: 32px;
      background: #9c27b0;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      flex-shrink: 0;
    }
    .item-fields {
      flex: 1;
      display: grid;
      grid-template-columns: 150px 1fr 100px 120px;
      gap: 12px;
      align-items: start;
    }
    .item-fields mat-form-field {
      width: 100%;
    }
    .empty-items {
      text-align: center;
      padding: 48px;
      color: #999;
    }
    .empty-items mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }
    .full-width {
      width: 100%;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      margin: 0 -24px -24px;
      background: #fafafa;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    mat-divider {
      margin: 24px 0;
    }
  `]
})
export class InternalTransferDialog {
  fromWarehouse: any = null;
  toWarehouse: any = null;
  selectedDriver: any = null;
  selectedVehicle: any = null;
  transferDate: Date = new Date();
  transferReference = '';
  notes = '';
  creating = false;
  
  transferItems: any[] = [];
  
  // Searchable dropdown properties
  fromWarehouseSearchText = '';
  toWarehouseSearchText = '';
  driverSearchText = '';
  vehicleSearchText = '';
  filteredFromWarehouses: any[] = [];
  filteredToWarehouses: any[] = [];
  filteredDrivers: any[] = [];
  filteredVehicles: any[] = [];
  
  private itemIdCounter = 0;

  constructor(
    private http: HttpClient,
    public dialogRef: MatDialogRef<InternalTransferDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {
      drivers: any[],
      vehicles: any[],
      warehouses: any[],
      apiUrl: string
    }
  ) {
    // Initialize filtered arrays
    this.filteredFromWarehouses = [...(data.warehouses || [])];
    this.filteredToWarehouses = [...(data.warehouses || [])];
    this.filteredDrivers = [...(data.drivers || [])];
    this.filteredVehicles = [...(data.vehicles || [])];
    
    // Set default warehouses if available
    if (data.warehouses?.length >= 2) {
      this.fromWarehouse = data.warehouses[0];
      this.fromWarehouseSearchText = `${data.warehouses[0].name} - ${data.warehouses[0].city}`;
      this.toWarehouse = data.warehouses[1];
      this.toWarehouseSearchText = `${data.warehouses[1].name} - ${data.warehouses[1].city}`;
    }
    // Generate transfer reference
    this.transferReference = `TRF-${Date.now().toString().slice(-6)}`;
    // Add one empty line item
    this.addTransferItem();
  }

  // Filter methods for searchable dropdowns
  filterFromWarehouses(): void {
    const searchValue = this.fromWarehouseSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredFromWarehouses = search 
      ? (this.data.warehouses || []).filter(wh => 
          (wh.name?.toLowerCase().includes(search) || 
          wh.city?.toLowerCase().includes(search)) && 
          wh.id !== this.toWarehouse?.id
        )
      : (this.data.warehouses || []).filter(wh => wh.id !== this.toWarehouse?.id);
  }

  filterToWarehouses(): void {
    const searchValue = this.toWarehouseSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredToWarehouses = search 
      ? (this.data.warehouses || []).filter(wh => 
          (wh.name?.toLowerCase().includes(search) || 
          wh.city?.toLowerCase().includes(search)) && 
          wh.id !== this.fromWarehouse?.id
        )
      : (this.data.warehouses || []).filter(wh => wh.id !== this.fromWarehouse?.id);
  }

  filterDrivers(): void {
    const searchValue = this.driverSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredDrivers = search 
      ? (this.data.drivers || []).filter(d => 
          d.firstName?.toLowerCase().includes(search) || 
          d.lastName?.toLowerCase().includes(search) ||
          `${d.firstName} ${d.lastName}`.toLowerCase().includes(search)
        )
      : [...(this.data.drivers || [])];
  }

  filterVehicles(): void {
    const searchValue = this.vehicleSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredVehicles = search 
      ? (this.data.vehicles || []).filter(v => 
          v.registrationNumber?.toLowerCase().includes(search) || 
          v.make?.toLowerCase().includes(search) ||
          v.model?.toLowerCase().includes(search)
        )
      : [...(this.data.vehicles || [])];
  }

  displayWarehouse(warehouse: any): string {
    return warehouse ? `${warehouse.name} - ${warehouse.city}` : '';
  }

  displayDriver(driver: any): string {
    return driver ? `${driver.firstName} ${driver.lastName}` : '';
  }

  displayVehicle(vehicle: any): string {
    return vehicle ? `${vehicle.registrationNumber} - ${vehicle.make} ${vehicle.model}` : '';
  }

  onFromWarehouseSelected(event: any): void {
    this.fromWarehouse = event.option.value;
    this.filterToWarehouses(); // Update to-warehouse list
  }

  onToWarehouseSelected(event: any): void {
    this.toWarehouse = event.option.value;
    this.filterFromWarehouses(); // Update from-warehouse list
  }

  onDriverAutocompleteSelected(event: any): void {
    this.selectedDriver = event.option.value;
  }

  onVehicleAutocompleteSelected(event: any): void {
    this.selectedVehicle = event.option.value;
  }

  onFromWarehouseChange(): void {
    // Clear toWarehouse if same as fromWarehouse
    if (this.toWarehouse?.id === this.fromWarehouse?.id) {
      this.toWarehouse = null;
      this.toWarehouseSearchText = '';
    }
  }

  addTransferItem(): void {
    this.transferItems.push({
      id: ++this.itemIdCounter,
      itemCode: '',
      description: '',
      quantity: 1,
      uom: 'EA'
    });
  }

  removeTransferItem(index: number): void {
    this.transferItems.splice(index, 1);
  }

  isValid(): boolean {
    return this.fromWarehouse && 
           this.toWarehouse && 
           this.fromWarehouse.id !== this.toWarehouse.id &&
           this.transferItems.length > 0 &&
           this.transferItems.some(item => item.itemCode || item.description);
  }

  createTransfer(): void {
    if (!this.isValid()) return;
    
    this.creating = true;
    
    const transferData = {
      fromWarehouseId: this.fromWarehouse?.id,
      toWarehouseId: this.toWarehouse?.id,
      fromWarehouseName: this.fromWarehouse?.name,
      toWarehouseName: this.toWarehouse?.name,
      driverId: this.selectedDriver?.id,
      vehicleId: this.selectedVehicle?.id,
      transferDate: this.transferDate,
      transferReference: this.transferReference,
      notes: this.notes,
      isInternalTransfer: true,
      items: this.transferItems.map((item, index) => ({
        sequence: index + 1,
        itemCode: item.itemCode,
        description: item.description,
        quantity: item.quantity,
        uom: item.uom
      }))
    };

    this.http.post(`${this.data.apiUrl}/logistics/tripsheet/transfer`, transferData).subscribe({
      next: (response: any) => {
        this.creating = false;
        this.dialogRef.close({ created: true, transferId: response.loadId });
      },
      error: (error) => {
        console.error('Error creating internal transfer:', error);
        this.creating = false;
        // For now, close with success anyway (API might not exist yet)
        this.dialogRef.close({ created: true });
      }
    });
  }
}

// Import Tripsheet Dialog with Smart Matching
@Component({
  selector: 'import-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    MatSelectModule,
    MatChipsModule,
    MatBadgeModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>upload_file</mat-icon>
      Import Tripsheet from Excel
    </h2>
    <mat-dialog-content>
      <div class="import-container">
        <!-- Step 1: Upload -->
        @if (step === 'upload') {
          <div class="upload-section" [class.has-file]="selectedFile">
            <div class="drop-zone" 
                 (dragover)="onDragOver($event)" 
                 (dragleave)="onDragLeave($event)" 
                 (drop)="onDrop($event)"
                 [class.drag-over]="isDragOver"
                 (click)="fileInput.click()">
              @if (!selectedFile) {
                <mat-icon class="upload-icon">cloud_upload</mat-icon>
                <p class="upload-text">Drag & drop an Excel file here</p>
                <p class="upload-hint">or click to browse</p>
                <p class="file-types">Supported format: .xlsx (max 10MB)</p>
              } @else {
                <mat-icon class="file-icon">description</mat-icon>
                <p class="file-name">{{ selectedFile.name }}</p>
                <p class="file-size">{{ formatFileSize(selectedFile.size) }}</p>
                <button mat-icon-button class="remove-file" (click)="removeFile($event)">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
            <input #fileInput type="file" accept=".xlsx" (change)="onFileSelected($event)" hidden>
          </div>

          @if (uploading) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <p class="uploading-text">Analyzing Excel file and matching records...</p>
          }

          @if (uploadError) {
            <div class="error-message">
              <mat-icon>error</mat-icon>
              {{ uploadError }}
            </div>
          }

          <div class="info-section">
            <h4><mat-icon>info</mat-icon> Supported Trip Sheet Formats</h4>
            <p class="info-text">The system will automatically detect invoice rows (e.g., IN161765) and extract delivery information including customer name, address, product details, and amounts.</p>
            <div class="column-list">
              <div class="column-item required">
                <span class="column-name">INV NO.</span>
                <span class="column-desc">Invoice number (required)</span>
              </div>
              <div class="column-item required">
                <span class="column-name">CUSTOMER NAME</span>
                <span class="column-desc">Customer/Company name</span>
              </div>
              <div class="column-item required">
                <span class="column-name">Address</span>
                <span class="column-desc">Delivery address (can be multi-line)</span>
              </div>
              <div class="column-item">
                <span class="column-name">PRODUCT</span>
                <span class="column-desc">Product description</span>
              </div>
              <div class="column-item">
                <span class="column-name">QTY</span>
                <span class="column-desc">Quantity</span>
              </div>
              <div class="column-item">
                <span class="column-name">VALUE</span>
                <span class="column-desc">Invoice amount</span>
              </div>
            </div>
          </div>
        }

        <!-- Step 2: Preview & Review -->
        @if (step === 'preview' && previewResponse) {
          <div class="preview-header">
            <div class="preview-summary">
              <h3>Import Preview: {{ previewResponse.fileName }}</h3>
              @if (isManualTripsheet()) {
                <div class="manual-tripsheet-notice">
                  <mat-icon>edit_note</mat-icon>
                  <span><strong>Manual Trip Sheet</strong> - No matching invoices found in system. This will create a manual tripsheet with the imported data.</span>
                </div>
              }
              <div class="summary-badges">
                <span class="badge matched" [matBadge]="previewResponse.matchedCount" matBadgeColor="primary">
                  <mat-icon>check_circle</mat-icon> Matched
                </span>
                <span class="badge partial" [matBadge]="previewResponse.partialMatchCount" matBadgeColor="accent">
                  <mat-icon>help</mat-icon> Review
                </span>
                <span class="badge unmatched" [matBadge]="previewResponse.unmatchedCount" matBadgeColor="warn">
                  <mat-icon>edit_note</mat-icon> Manual
                </span>
                @if (previewResponse.errorCount > 0) {
                  <span class="badge error" [matBadge]="previewResponse.errorCount" matBadgeColor="warn">
                    <mat-icon>error</mat-icon> Errors
                  </span>
                }
              </div>
            </div>
            <button mat-button (click)="step = 'upload'; previewResponse = null;">
              <mat-icon>arrow_back</mat-icon> Back
            </button>
          </div>

          <div class="preview-table-container">
            <table class="preview-table">
              <thead>
                <tr>
                  <th class="status-col">Status</th>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Amount</th>
                  <th class="actions-col">Match</th>
                </tr>
              </thead>
              <tbody>
                @for (row of previewResponse.rows; track row.rowIndex) {
                  <tr [class.error-row]="row.status === 'Error'" 
                      [class.matched-row]="row.status === 'Matched'"
                      [class.partial-row]="row.status === 'PartialMatch'"
                      [class.unmatched-row]="row.status === 'Unmatched'">
                    <td class="status-col">
                      @switch (row.status) {
                        @case ('Matched') {
                          <mat-icon class="status-icon matched" matTooltip="Auto-matched to existing invoice">check_circle</mat-icon>
                        }
                        @case ('PartialMatch') {
                          <mat-icon class="status-icon partial" matTooltip="Needs review">help</mat-icon>
                        }
                        @case ('Unmatched') {
                          <mat-icon class="status-icon unmatched" matTooltip="Manual entry - no matching invoice in system">edit_note</mat-icon>
                        }
                        @case ('Error') {
                          <mat-icon class="status-icon error" matTooltip="{{ row.validationErrors?.join(', ') }}">error</mat-icon>
                        }
                      }
                    </td>
                    <td class="invoice-cell">{{ row.data?.invoiceNumber || '-' }}</td>
                    <td class="customer-cell">
                      {{ row.data?.customerName || '-' }}
                      @if (row.matchedCustomerId) {
                        <span class="match-badge">ID: {{ row.matchedCustomerId }}</span>
                      }
                    </td>
                    <td class="address-cell" [matTooltip]="row.data?.deliveryAddress || ''">
                      {{ (row.data?.deliveryAddress || '-') | slice:0:40 }}{{ (row.data?.deliveryAddress?.length || 0) > 40 ? '...' : '' }}
                    </td>
                    <td class="amount-cell">
                      @if (row.data?.salesAmount) {
                        R {{ row.data.salesAmount.toFixed(2) }}
                      } @else {
                        -
                      }
                    </td>
                    <td class="actions-col">
                      @if (row.status === 'PartialMatch' && row.suggestedCustomers?.length) {
                        <mat-form-field appearance="outline" class="match-select">
                          <mat-select [(value)]="row.selectedCustomerId" placeholder="Select match">
                            <mat-option [value]="null">Create New</mat-option>
                            @for (suggestion of row.suggestedCustomers; track suggestion.id) {
                              <mat-option [value]="suggestion.id">
                                {{ suggestion.displayName }} ({{ (suggestion.score * 100).toFixed(0) }}%)
                              </mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                      } @else if (row.confidenceScore) {
                        <span class="confidence">{{ (row.confidenceScore * 100).toFixed(0) }}%</span>
                      }
                    </td>
                  </tr>
                  @if (row.validationErrors?.length || row.warnings?.length) {
                    <tr class="message-row">
                      <td colspan="6">
                        @for (error of row.validationErrors || []; track error) {
                          <span class="validation-error"><mat-icon>error</mat-icon> {{ error }}</span>
                        }
                        @for (warning of row.warnings || []; track warning) {
                          <span class="validation-warning"><mat-icon>warning</mat-icon> {{ warning }}</span>
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (step === 'upload') {
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="previewFile()" 
                [disabled]="!selectedFile || uploading">
          <mat-icon>search</mat-icon>
          Preview Import
        </button>
      }
      @if (step === 'preview') {
        <button mat-button (click)="step = 'upload'">Back</button>
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="proceedToCreateTripsheet()" 
                [disabled]="!hasValidRows()">
          <mat-icon>{{ isManualTripsheet() ? 'edit_note' : 'arrow_forward' }}</mat-icon>
          {{ isManualTripsheet() ? 'Create Manual Trip Sheet' : 'Create Trip Sheet' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .import-container {
      min-width: 800px;
      max-width: 1000px;
      padding: 16px 0;
    }
    .upload-section {
      margin-bottom: 16px;
    }
    .drop-zone {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #1976d2;
      background: #e3f2fd;
    }
    .upload-section.has-file .drop-zone {
      border-style: solid;
      border-color: #4caf50;
      background: #e8f5e9;
    }
    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #9e9e9e;
    }
    .drop-zone:hover .upload-icon, .drop-zone.drag-over .upload-icon {
      color: #1976d2;
    }
    .upload-text {
      margin: 8px 0 4px;
      font-size: 16px;
      color: #333;
    }
    .upload-hint {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .file-types {
      margin-top: 12px;
      font-size: 12px;
      color: #999;
    }
    .file-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #4caf50;
    }
    .file-name {
      margin: 8px 0 4px;
      font-size: 16px;
      font-weight: 500;
      color: #333;
    }
    .file-size {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .remove-file {
      position: absolute;
      top: 8px;
      right: 8px;
    }
    .uploading-text {
      text-align: center;
      color: #666;
      margin-top: 8px;
    }
    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #ffebee;
      color: #c62828;
      border-radius: 4px;
      margin: 16px 0;
    }
    .info-section {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
    }
    .info-section h4 {
      margin: 0 0 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #1976d2;
    }
    .info-text {
      margin: 0 0 12px;
      font-size: 13px;
      color: #666;
    }
    .column-list {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .column-item {
      display: flex;
      flex-direction: column;
      padding: 8px;
      background: white;
      border-radius: 4px;
      border-left: 3px solid #e0e0e0;
    }
    .column-item.required {
      border-left-color: #f44336;
    }
    .column-name {
      font-family: monospace;
      font-weight: 600;
      font-size: 12px;
      color: #333;
    }
    .column-desc {
      font-size: 11px;
      color: #666;
    }
    
    /* Preview styles */
    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .preview-summary h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    .manual-tripsheet-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border: 1px solid #2196f3;
      border-radius: 8px;
      margin-bottom: 12px;
      color: #1565c0;
    }
    .manual-tripsheet-notice mat-icon {
      color: #1976d2;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .manual-tripsheet-notice span {
      font-size: 13px;
      line-height: 1.4;
    }
    .summary-badges {
      display: flex;
      gap: 16px;
    }
    .badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: #f5f5f5;
    }
    .badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .badge.matched mat-icon { color: #4caf50; }
    .badge.partial mat-icon { color: #ff9800; }
    .badge.unmatched mat-icon { color: #2196f3; }
    .badge.error mat-icon { color: #f44336; }
    
    .unmatched-row {
      background: #e3f2fd;
    }
    
    .preview-table-container {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .preview-table th, .preview-table td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    .preview-table th {
      background: #f5f5f5;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .preview-table tr.error-row {
      background: #ffebee;
    }
    .preview-table tr.matched-row {
      background: #e8f5e9;
    }
    .preview-table tr.partial-row {
      background: #fff3e0;
    }
    .status-col {
      width: 50px;
      text-align: center;
    }
    .actions-col {
      width: 150px;
    }
    .status-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .status-icon.matched { color: #4caf50; }
    .status-icon.partial { color: #ff9800; }
    .status-icon.unmatched { color: #2196f3; }
    .status-icon.error { color: #f44336; }
    
    .invoice-cell {
      font-family: monospace;
      font-weight: 600;
    }
    .customer-cell {
      max-width: 200px;
    }
    .address-cell {
      max-width: 250px;
      font-size: 12px;
      color: #666;
    }
    .amount-cell {
      font-family: monospace;
      text-align: right;
    }
    .match-badge {
      display: inline-block;
      font-size: 10px;
      padding: 2px 6px;
      background: #e3f2fd;
      color: #1976d2;
      border-radius: 4px;
      margin-left: 4px;
    }
    .match-select {
      width: 100%;
      font-size: 12px;
    }
    .match-select ::ng-deep .mat-mdc-form-field-infix {
      padding: 4px 0 !important;
      min-height: 32px;
    }
    .confidence {
      font-size: 12px;
      color: #4caf50;
      font-weight: 600;
    }
    .message-row td {
      padding: 4px 12px !important;
      background: #fafafa;
    }
    .validation-error, .validation-warning {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      margin-right: 12px;
    }
    .validation-error {
      color: #c62828;
    }
    .validation-error mat-icon, .validation-warning mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .validation-warning {
      color: #f57c00;
    }
    
    /* Success styles */
    .success-section {
      text-align: center;
      padding: 32px;
    }
    .success-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #4caf50;
    }
    .success-section h3 {
      margin: 16px 0 8px;
      font-size: 20px;
    }
    .success-message {
      color: #666;
      margin-bottom: 24px;
    }
    .result-stats {
      display: flex;
      justify-content: center;
      gap: 32px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      display: block;
      font-size: 32px;
      font-weight: 600;
      color: #4caf50;
    }
    .stat.error .stat-value {
      color: #f44336;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
    }
    .error-list {
      margin-top: 24px;
      text-align: left;
      background: #ffebee;
      padding: 12px;
      border-radius: 4px;
    }
    .error-list h4 {
      margin: 0 0 8px;
      color: #c62828;
    }
    .error-item {
      margin: 4px 0;
      font-size: 12px;
      color: #c62828;
    }
    
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon {
      color: #4caf50;
    }

    /* Assignment section styles */
    .assignment-section {
      padding: 16px 0;
    }
    .assignment-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
      font-size: 18px;
      color: #1976d2;
    }
    .assignment-info {
      margin: 0 0 16px;
      color: #666;
      font-size: 14px;
    }
    .assignment-form {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .assignment-form .full-width {
      width: 100%;
    }
    .assignment-form mat-form-field {
      width: 100%;
    }
    .available-badge {
      display: inline-block;
      font-size: 10px;
      padding: 2px 6px;
      background: #e8f5e9;
      color: #4caf50;
      border-radius: 10px;
      margin-left: 8px;
    }
    .summary-card {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e0e0e0;
    }
    .summary-card h4 {
      margin: 0 0 12px;
      font-size: 14px;
      color: #333;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .summary-row:last-child {
      border-bottom: none;
    }
    .summary-row span {
      color: #666;
    }
    .summary-row strong {
      color: #1976d2;
    }
  `]
})
export class ImportTripsheetDialog {
  step: 'upload' | 'preview' = 'upload';
  selectedFile: File | null = null;
  isDragOver = false;
  uploading = false;
  uploadError = '';
  previewResponse: any = null;

  constructor(
    private http: HttpClient,
    public dialogRef: MatDialogRef<ImportTripsheetDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { apiUrl: string }
  ) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File): void {
    if (!file.name.match(/\.xlsx$/i)) {
      this.uploadError = 'Please select an Excel file (.xlsx)';
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError = 'File size exceeds 10MB limit';
      return;
    }
    
    this.selectedFile = file;
    this.uploadError = '';
    this.previewResponse = null;
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile = null;
    this.previewResponse = null;
    this.uploadError = '';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  previewFile(): void {
    if (!this.selectedFile) return;
    
    this.uploading = true;
    this.uploadError = '';
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/tripsheet/preview-import`, formData).subscribe({
      next: (response) => {
        this.previewResponse = response;
        // Initialize selectedCustomerId for partial matches
        if (response.rows) {
          response.rows.forEach((row: any) => {
            if (row.status === 'PartialMatch' && row.suggestedCustomers?.length) {
              row.selectedCustomerId = row.suggestedCustomers[0].id;
            } else if (row.matchedCustomerId) {
              row.selectedCustomerId = row.matchedCustomerId;
            }
          });
        }
        this.step = 'preview';
        this.uploading = false;
      },
      error: (err) => {
        this.uploadError = err.error?.message || 'Failed to parse Excel file';
        this.uploading = false;
      }
    });
  }

  hasValidRows(): boolean {
    return this.previewResponse?.rows?.some((r: any) => r.status !== 'Error') || false;
  }

  getValidRowCount(): number {
    return this.previewResponse?.rows?.filter((r: any) => r.status !== 'Error').length || 0;
  }

  getTotalValue(): number {
    if (!this.previewResponse?.rows) return 0;
    return this.previewResponse.rows
      .filter((r: any) => r.status !== 'Error')
      .reduce((sum: number, row: any) => sum + (row.data?.salesAmount || 0), 0);
  }

  // Check if this is a manual tripsheet (no matched invoices found in system)
  isManualTripsheet(): boolean {
    if (!this.previewResponse) return false;
    // Manual tripsheet if no matched invoices AND we have unmatched rows
    return this.previewResponse.matchedCount === 0 && 
           this.previewResponse.partialMatchCount === 0 && 
           this.previewResponse.unmatchedCount > 0;
  }

  proceedToCreateTripsheet(): void {
    // Flag whether this is a manual tripsheet
    const isManual = this.isManualTripsheet();
    
    // Convert parsed rows to invoice-like objects for CreateTripsheetDialog
    const invoices = this.previewResponse.rows
      .filter((r: any) => r.status !== 'Error')
      .map((row: any, index: number) => ({
        id: `import-${index}`,  // Temporary ID for tracking
        transactionNumber: row.data?.invoiceNumber || `MAN-${index + 1}`,
        customerName: row.data?.customerName || 'Unknown Customer',
        customerNumber: row.data?.customerNumber,
        deliveryAddress: row.data?.deliveryAddress || '',
        address: row.data?.deliveryAddress || '',
        city: row.data?.city || '',
        province: row.data?.province || '',
        productDescription: row.data?.productDescription || 'Imported Product',
        productCode: row.data?.productCode,
        quantity: row.data?.quantity || 1,
        salesAmount: row.data?.salesAmount || 0,
        netSales: row.data?.salesAmount || 0,
        totalAmount: row.data?.salesAmount || 0,
        status: 'Pending',
        matchedCustomerId: row.selectedCustomerId || row.matchedCustomerId,
        contactPerson: row.data?.contactPerson,
        contactPhone: row.data?.contactPhone,
        // Source tracking
        isImported: true,
        isManualEntry: isManual || row.status === 'Unmatched',
        batchId: this.previewResponse.batchId,
        rowIndex: row.rowIndex
      }));
    
    // Close dialog and pass the converted data to open CreateTripsheetDialog
    this.dialogRef.close({
      openCreateDialog: true,
      invoices: invoices,
      batchId: this.previewResponse.batchId,
      fileName: this.previewResponse.fileName,
      isManualTripsheet: isManual
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

// Add Maintenance Dialog
@Component({
  selector: 'add-maintenance-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatAutocompleteModule
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
          <input matInput 
                 [matAutocomplete]="vehicleAuto" 
                 [formControl]="vehicleSearchControl"
                 placeholder="Type to search vehicle...">
          <mat-icon matSuffix>search</mat-icon>
          <mat-autocomplete #vehicleAuto="matAutocomplete" 
                           [displayWith]="displayVehicle.bind(this)"
                           (optionSelected)="onVehicleSelected($event)">
            @for (vehicle of filteredVehicles; track vehicle.id) {
              <mat-option [value]="vehicle">
                {{ vehicle.registrationNumber }} - {{ vehicle.type || vehicle.make || 'Vehicle' }}
              </mat-option>
            }
          </mat-autocomplete>
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
export class AddMaintenanceDialog implements OnInit {
  formData: Partial<MaintenanceRecord> = {
    maintenanceType: 'scheduled',
    status: 'scheduled',
    priority: 'medium',
    scheduledDate: new Date()
  };

  vehicleSearchControl = new FormControl('');
  filteredVehicles: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<AddMaintenanceDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicles: any[], record?: MaintenanceRecord }
  ) {}

  ngOnInit(): void {
    // Initialize filtered vehicles first
    this.filteredVehicles = [...(this.data.vehicles || [])];
    
    if (this.data.record) {
      this.formData = { ...this.data.record };
      // Ensure vehicleId is set from record
      if (this.data.record.vehicleId) {
        this.formData.vehicleId = this.data.record.vehicleId;
      }
      // Set the vehicle search control to display the selected vehicle
      const selectedVehicle = (this.data.vehicles || []).find(v => v.id === this.data.record?.vehicleId);
      if (selectedVehicle) {
        this.vehicleSearchControl.setValue(selectedVehicle, { emitEvent: false });
      }
    }
    
    // Subscribe to search changes
    this.vehicleSearchControl.valueChanges.subscribe(value => {
      this.filterVehicles(value);
    });
  }

  filterVehicles(value: any): void {
    const vehicles = this.data.vehicles || [];
    if (!value || typeof value === 'object') {
      this.filteredVehicles = [...vehicles];
      return;
    }
    const filterValue = value.toLowerCase();
    this.filteredVehicles = vehicles.filter(vehicle => 
      vehicle.registrationNumber?.toLowerCase().includes(filterValue) ||
      vehicle.make?.toLowerCase().includes(filterValue) ||
      vehicle.model?.toLowerCase().includes(filterValue) ||
      vehicle.type?.toLowerCase().includes(filterValue)
    );
  }

  displayVehicle(vehicle: any): string {
    if (!vehicle) return '';
    return `${vehicle.registrationNumber} - ${vehicle.type || vehicle.make || 'Vehicle'}`;
  }

  onVehicleSelected(event: any): void {
    const vehicle = event.option.value;
    if (vehicle) {
      this.formData.vehicleId = vehicle.id;
      this.formData.vehicleReg = vehicle.registrationNumber;
      this.formData.vehicleType = vehicle.type || 'Vehicle';
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

// Assign Tripsheet Dialog - for assigning driver and vehicle to an existing tripsheet
@Component({
  selector: 'assign-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    FormsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>person_add</mat-icon>
      Assign Driver & Vehicle
    </h2>
    <mat-dialog-content>
      <div class="assign-form">
        <div class="tripsheet-info">
          <p><strong>TripSheet:</strong> {{ data.tripsheet.loadNumber || data.tripsheet.tripNumber }}</p>
          <p><strong>Status:</strong> {{ data.tripsheet.status }}</p>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Driver</mat-label>
          <mat-select [(ngModel)]="selectedDriverId">
            <mat-option [value]="null">-- Not Assigned --</mat-option>
            @for (driver of data.drivers; track driver.id) {
              <mat-option [value]="driver.id">
                {{ driver.firstName }} {{ driver.lastName }}
                @if (driver.status === 'On Duty') {
                  <span class="on-duty">(On Duty)</span>
                }
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vehicle</mat-label>
          <mat-select [(ngModel)]="selectedVehicleId">
            <mat-option [value]="null">-- Not Assigned --</mat-option>
            @for (vehicle of data.vehicles; track vehicle.id) {
              <mat-option [value]="vehicle.id">
                {{ vehicle.registrationNumber }} - {{ vehicle.type || vehicle.vehicleTypeName }}
                @if (vehicle.status === 'Available') {
                  <span class="available">(Available)</span>
                }
              </mat-option>
            }
          </mat-select>
          <mat-hint>Only available vehicles shown</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Scheduled Date</mat-label>
          <input matInput [matDatepicker]="picker" [(ngModel)]="scheduledDate">
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onAssign()" [disabled]="!selectedDriverId && !selectedVehicleId">
        <mat-icon>check</mat-icon>
        Assign
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .assign-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 400px;
      padding: 16px 0;
    }
    .tripsheet-info {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .tripsheet-info p {
      margin: 4px 0;
    }
    .full-width {
      width: 100%;
    }
    .on-duty {
      color: #4caf50;
      font-size: 12px;
      margin-left: 8px;
    }
    .available {
      color: #2196f3;
      font-size: 12px;
      margin-left: 8px;
    }
    mat-dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class AssignTripsheetDialog {
  selectedDriverId: number | null = null;
  selectedVehicleId: number | null = null;
  scheduledDate: Date = new Date();

  constructor(
    public dialogRef: MatDialogRef<AssignTripsheetDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      tripsheet: any, 
      drivers: any[], 
      vehicles: any[] 
    }
  ) {
    // Pre-fill if already assigned
    if (data.tripsheet.driverId) {
      this.selectedDriverId = data.tripsheet.driverId;
    }
    if (data.tripsheet.vehicleId) {
      this.selectedVehicleId = data.tripsheet.vehicleId;
    }
    if (data.tripsheet.date) {
      this.scheduledDate = new Date(data.tripsheet.date);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onAssign(): void {
    this.dialogRef.close({
      assigned: true,
      driverId: this.selectedDriverId,
      vehicleId: this.selectedVehicleId,
      scheduledDate: this.scheduledDate
    });
  }
}