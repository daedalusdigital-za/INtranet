import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Vehicle {
  id: number;
  registrationNumber: string;
  make?: string;
  model?: string;
  year?: number;
  type?: string;
  vehicleTypeId?: number;
  vehicleTypeName?: string;
  status: string;
  liveStatus?: string;
  currentDriverId?: number;
  currentDriverName?: string;
  lastLocation?: string;
  latitude?: number;
  longitude?: number;
  lastUpdate?: string;
  fuelCapacity?: number;
  tankSize?: number;
  fuelType?: string;
  currentOdometer?: number;
  isActive?: boolean;
}

interface Driver {
  id: number;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  status?: string;
}

interface VehicleType {
  id: number;
  name: string;
}

@Component({
  selector: 'app-vehicles-dialog',
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
    MatSelectModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    MatSortModule,
    MatMenuModule,
    MatSnackBarModule
  ],
  template: `
    <div class="vehicles-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon>directions_car</mat-icon>
          Fleet Vehicles
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <!-- Filters -->
        <div class="filters-section">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="applyFilter()" placeholder="Registration, make, model...">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="statusFilter" (selectionChange)="applyFilter()">
              <mat-option value="all">All Statuses</mat-option>
              <mat-option value="Available">Available</mat-option>
              <mat-option value="In Use">In Use</mat-option>
              <mat-option value="Maintenance">Maintenance</mat-option>
              <mat-option value="Offline">Offline</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Vehicle Type</mat-label>
            <mat-select [(ngModel)]="typeFilter" (selectionChange)="applyFilter()">
              <mat-option value="all">All Types</mat-option>
              @for (type of vehicleTypes; track type) {
                <mat-option [value]="type">{{ type }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Stats Summary -->
        <div class="stats-summary">
          <div class="stat-chip available">
            <mat-icon>check_circle</mat-icon>
            <span>{{ availableCount }} Available</span>
          </div>
          <div class="stat-chip in-use">
            <mat-icon>local_shipping</mat-icon>
            <span>{{ inUseCount }} In Use</span>
          </div>
          <div class="stat-chip maintenance">
            <mat-icon>build</mat-icon>
            <span>{{ maintenanceCount }} Maintenance</span>
          </div>
          <div class="stat-chip total">
            <mat-icon>directions_car</mat-icon>
            <span>{{ vehicles().length }} Total</span>
          </div>
        </div>

        <!-- Vehicles List -->
        <div class="vehicles-list">
          <div class="loading-spinner" *ngIf="isLoading()">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Loading vehicles...</p>
          </div>

          <div class="table-container" *ngIf="!isLoading()">
            <table mat-table [dataSource]="filteredVehicles()" matSort (matSortChange)="sortData($event)" class="vehicles-table">
              <!-- Registration Column -->
              <ng-container matColumnDef="registrationNumber">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Registration</th>
                <td mat-cell *matCellDef="let vehicle">
                  <div class="registration-cell">
                    <mat-icon class="vehicle-icon">directions_car</mat-icon>
                    <strong>{{ vehicle.registrationNumber || 'N/A' }}</strong>
                  </div>
                </td>
              </ng-container>

              <!-- Make/Model Column -->
              <ng-container matColumnDef="makeModel">
                <th mat-header-cell *matHeaderCellDef mat-sort-header="make">Make/Model</th>
                <td mat-cell *matCellDef="let vehicle">
                  @if (vehicle.make || vehicle.model) {
                    {{ vehicle.make || '' }} {{ vehicle.model || '' }}
                  } @else {
                    <span class="no-data">Not set</span>
                  }
                </td>
              </ng-container>

              <!-- Type Column -->
              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Type</th>
                <td mat-cell *matCellDef="let vehicle">
                  {{ vehicle.vehicleTypeName || vehicle.type || '-' }}
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                <td mat-cell *matCellDef="let vehicle">
                  <span class="status-chip" [ngClass]="getStatusClass(vehicle.status)">
                    {{ vehicle.status || 'Unknown' }}
                  </span>
                </td>
              </ng-container>

              <!-- Driver Column -->
              <ng-container matColumnDef="driver">
                <th mat-header-cell *matHeaderCellDef>Current Driver</th>
                <td mat-cell *matCellDef="let vehicle">
                  @if (vehicle.currentDriverName) {
                    <div class="driver-cell">
                      <mat-icon>person</mat-icon>
                      {{ vehicle.currentDriverName }}
                    </div>
                  } @else {
                    <span class="no-driver">Unassigned</span>
                  }
                </td>
              </ng-container>

              <!-- Location Column -->
              <ng-container matColumnDef="location">
                <th mat-header-cell *matHeaderCellDef>Last Location</th>
                <td mat-cell *matCellDef="let vehicle">
                  @if (vehicle.lastLocation && vehicle.lastLocation !== 'Not tracked') {
                    <div class="location-cell" [matTooltip]="vehicle.lastLocation">
                      <mat-icon>location_on</mat-icon>
                      {{ truncateLocation(vehicle.lastLocation) }}
                    </div>
                  } @else {
                    <span class="no-location">-</span>
                  }
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let vehicle">
                  <button mat-icon-button [matMenuTriggerFor]="actionMenu" (click)="$event.stopPropagation()">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #actionMenu="matMenu">
                    <button mat-menu-item (click)="openEditDialog(vehicle)">
                      <mat-icon>edit</mat-icon>
                      <span>Edit Vehicle</span>
                    </button>
                    <button mat-menu-item (click)="assignDriver(vehicle)">
                      <mat-icon>person_add</mat-icon>
                      <span>Assign Driver</span>
                    </button>
                    @if (vehicle.status !== 'Maintenance') {
                      <button mat-menu-item (click)="moveToMaintenance(vehicle)">
                        <mat-icon>build</mat-icon>
                        <span>Move to Maintenance</span>
                      </button>
                    } @else {
                      <button mat-menu-item (click)="makeAvailable(vehicle)">
                        <mat-icon>check_circle</mat-icon>
                        <span>Mark Available</span>
                      </button>
                    }
                    <button mat-menu-item class="delete-action" (click)="confirmDelete(vehicle)">
                      <mat-icon color="warn">delete</mat-icon>
                      <span>Delete Vehicle</span>
                    </button>
                  </mat-menu>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" 
                  [class.available-row]="row.status === 'Available'"
                  [class.maintenance-row]="row.status === 'Maintenance'"></tr>
            </table>

            <div class="no-data-message" *ngIf="filteredVehicles().length === 0">
              <mat-icon>directions_car_filled</mat-icon>
              <p>No vehicles found matching your criteria</p>
            </div>
          </div>
        </div>

        <!-- Edit Vehicle Panel -->
        @if (editingVehicle) {
          <div class="edit-panel">
            <div class="edit-panel-header">
              <h3>
                <mat-icon>edit</mat-icon>
                Edit Vehicle: {{ editingVehicle.registrationNumber }}
              </h3>
              <button mat-icon-button (click)="cancelEdit()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="edit-panel-content">
              <div class="edit-form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Make</mat-label>
                  <input matInput [(ngModel)]="editForm.make" placeholder="e.g., Toyota">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Model</mat-label>
                  <input matInput [(ngModel)]="editForm.model" placeholder="e.g., Hilux">
                </mat-form-field>
              </div>
              <div class="edit-form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Year</mat-label>
                  <input matInput type="number" [(ngModel)]="editForm.year" placeholder="e.g., 2023">
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Status</mat-label>
                  <mat-select [(ngModel)]="editForm.status">
                    <mat-option value="Available">Available</mat-option>
                    <mat-option value="In Use">In Use</mat-option>
                    <mat-option value="Maintenance">Maintenance</mat-option>
                    <mat-option value="Offline">Offline</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="edit-form-row">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Assign Driver</mat-label>
                  <mat-select [(ngModel)]="editForm.currentDriverId">
                    <mat-option [value]="null">-- Unassigned --</mat-option>
                    @for (driver of drivers(); track driver.id) {
                      <mat-option [value]="driver.id">{{ driver.firstName }} {{ driver.lastName }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>
              <div class="edit-panel-actions">
                <button mat-button (click)="cancelEdit()">Cancel</button>
                <button mat-raised-button color="primary" (click)="saveVehicle()" [disabled]="isSaving()">
                  @if (isSaving()) {
                    <mat-spinner diameter="20"></mat-spinner>
                  } @else {
                    <mat-icon>save</mat-icon>
                    Save Changes
                  }
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Assign Driver Panel -->
        @if (assigningDriverTo) {
          <div class="edit-panel assign-panel">
            <div class="edit-panel-header">
              <h3>
                <mat-icon>person_add</mat-icon>
                Assign Driver to: {{ assigningDriverTo.registrationNumber }}
              </h3>
              <button mat-icon-button (click)="cancelAssign()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="edit-panel-content">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Select Driver</mat-label>
                <mat-select [(ngModel)]="selectedDriverId">
                  <mat-option [value]="null">-- Remove Driver --</mat-option>
                  @for (driver of drivers(); track driver.id) {
                    <mat-option [value]="driver.id">
                      {{ driver.firstName }} {{ driver.lastName }}
                      @if (driver.phoneNumber) {
                        <span class="driver-phone"> - {{ driver.phoneNumber }}</span>
                      }
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <div class="edit-panel-actions">
                <button mat-button (click)="cancelAssign()">Cancel</button>
                <button mat-raised-button color="primary" (click)="confirmAssignDriver()" [disabled]="isSaving()">
                  @if (isSaving()) {
                    <mat-spinner diameter="20"></mat-spinner>
                  } @else {
                    <mat-icon>check</mat-icon>
                    Assign Driver
                  }
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Delete Confirmation Panel -->
        @if (deletingVehicle) {
          <div class="edit-panel delete-panel">
            <div class="edit-panel-header delete-header">
              <h3>
                <mat-icon>warning</mat-icon>
                Confirm Delete
              </h3>
              <button mat-icon-button (click)="cancelDelete()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="edit-panel-content">
              <p class="delete-warning">
                Are you sure you want to delete vehicle <strong>{{ deletingVehicle.registrationNumber }}</strong>?
              </p>
              <p class="delete-note">This action cannot be undone.</p>
              <div class="edit-panel-actions">
                <button mat-button (click)="cancelDelete()">Cancel</button>
                <button mat-raised-button color="warn" (click)="deleteVehicle()" [disabled]="isSaving()">
                  @if (isSaving()) {
                    <mat-spinner diameter="20"></mat-spinner>
                  } @else {
                    <mat-icon>delete</mat-icon>
                    Delete Vehicle
                  }
                </button>
              </div>
            </div>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .vehicles-dialog {
      min-width: 1000px;
      max-width: 100%;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      color: white;
      margin: -24px -24px 0 -24px;

      h2 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 1.5rem;

        mat-icon {
          font-size: 28px;
          width: 28px;
          height: 28px;
        }
      }

      button {
        color: white;
      }
    }

    .filters-section {
      display: flex;
      gap: 16px;
      padding: 16px 0;
      flex-wrap: wrap;

      .search-field {
        flex: 1;
        min-width: 250px;
      }

      .filter-field {
        min-width: 150px;
      }
    }

    .stats-summary {
      display: flex;
      gap: 12px;
      padding: 12px 0;
      flex-wrap: wrap;

      .stat-chip {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.9rem;
        font-weight: 500;

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
        }

        &.available {
          background: #e8f5e9;
          color: #2e7d32;
        }

        &.in-use {
          background: #fff3e0;
          color: #ef6c00;
        }

        &.maintenance {
          background: #ffebee;
          color: #c62828;
        }

        &.total {
          background: #e3f2fd;
          color: #1565c0;
        }
      }
    }

    .vehicles-list {
      .loading-spinner {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        color: #666;

        p {
          margin-top: 16px;
        }
      }

      .table-container {
        max-height: 350px;
        overflow: auto;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
      }
    }

    .vehicles-table {
      width: 100%;

      th {
        background: #f5f5f5;
        font-weight: 600;
        color: #333;
      }

      td {
        padding: 12px 16px;
      }

      tr.mat-mdc-row {
        transition: background-color 0.2s;

        &:hover {
          background: #f5f5f5;
        }

        &.available-row {
          background: #f1f8e9;

          &:hover {
            background: #dcedc8;
          }
        }

        &.maintenance-row {
          background: #fff8e1;

          &:hover {
            background: #ffecb3;
          }
        }
      }
    }

    .registration-cell {
      display: flex;
      align-items: center;
      gap: 8px;

      .vehicle-icon {
        color: #1976d2;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
    }

    .status-chip {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 500;

      &.status-available {
        background: #e8f5e9;
        color: #2e7d32;
      }

      &.status-in-use {
        background: #fff3e0;
        color: #ef6c00;
      }

      &.status-maintenance {
        background: #ffebee;
        color: #c62828;
      }

      &.status-offline {
        background: #eceff1;
        color: #546e7a;
      }

      &.status-unknown {
        background: #f5f5f5;
        color: #757575;
      }
    }

    .driver-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #1976d2;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .no-driver, .no-data {
      color: #9e9e9e;
      font-style: italic;
    }

    .location-cell {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #666;
      max-width: 180px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
        color: #f44336;
      }
    }

    .no-location {
      color: #9e9e9e;
    }

    .no-data-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: #666;

      mat-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      p {
        margin: 0;
        font-size: 1.1rem;
      }
    }

    .delete-action {
      color: #c62828 !important;
    }

    /* Edit Panel Styles */
    .edit-panel {
      margin-top: 16px;
      border: 1px solid #1976d2;
      border-radius: 8px;
      overflow: hidden;
      animation: slideDown 0.2s ease-out;

      &.assign-panel {
        border-color: #2e7d32;

        .edit-panel-header {
          background: linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%);
        }
      }

      &.delete-panel {
        border-color: #c62828;

        .edit-panel-header {
          background: linear-gradient(135deg, #c62828 0%, #b71c1c 100%);
        }
      }
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .edit-panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      color: white;

      h3 {
        margin: 0;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 1.1rem;
      }

      button {
        color: white;
      }
    }

    .edit-panel-content {
      padding: 16px;
      background: #fafafa;
    }

    .edit-form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 8px;

      mat-form-field {
        flex: 1;
      }

      &:last-of-type {
        margin-bottom: 0;
      }
    }

    .full-width {
      width: 100%;
    }

    .edit-panel-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;

      button {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }

    .driver-phone {
      color: #666;
      font-size: 0.9em;
    }

    .delete-warning {
      font-size: 1.1rem;
      margin-bottom: 8px;
    }

    .delete-note {
      color: #666;
      font-size: 0.9rem;
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class VehiclesDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private dialogRef = inject(MatDialogRef<VehiclesDialogComponent>);
  private snackBar = inject(MatSnackBar);
  private apiUrl = environment.apiUrl;

  vehicles = signal<Vehicle[]>([]);
  filteredVehicles = signal<Vehicle[]>([]);
  drivers = signal<Driver[]>([]);
  isLoading = signal(true);
  isSaving = signal(false);

  searchTerm = '';
  statusFilter = 'all';
  typeFilter = 'all';
  vehicleTypes: string[] = [];

  displayedColumns = ['registrationNumber', 'makeModel', 'type', 'status', 'driver', 'location', 'actions'];

  // Edit state
  editingVehicle: Vehicle | null = null;
  editForm = {
    make: '',
    model: '',
    year: null as number | null,
    status: '',
    currentDriverId: null as number | null
  };

  // Assign driver state
  assigningDriverTo: Vehicle | null = null;
  selectedDriverId: number | null = null;

  // Delete state
  deletingVehicle: Vehicle | null = null;

  get availableCount(): number {
    return this.vehicles().filter(v => v.status === 'Available').length;
  }

  get inUseCount(): number {
    return this.vehicles().filter(v => v.status === 'In Use' || v.status === 'InUse').length;
  }

  get maintenanceCount(): number {
    return this.vehicles().filter(v => v.status === 'Maintenance').length;
  }

  ngOnInit(): void {
    this.loadVehicles();
    this.loadDrivers();
  }

  loadVehicles(): void {
    this.isLoading.set(true);
    this.http.get<Vehicle[]>(`${this.apiUrl}/fleet/vehicles`).subscribe({
      next: (vehicles) => {
        this.vehicles.set(vehicles);
        this.extractVehicleTypes(vehicles);
        this.applyFilter();
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Failed to load vehicles:', err);
        this.isLoading.set(false);
        this.vehicles.set([]);
        this.filteredVehicles.set([]);
        this.snackBar.open('Failed to load vehicles', 'Close', { duration: 3000 });
      }
    });
  }

  loadDrivers(): void {
    this.http.get<Driver[]>(`${this.apiUrl}/fleet/drivers`).subscribe({
      next: (drivers) => {
        this.drivers.set(drivers);
      },
      error: (err) => {
        console.error('Failed to load drivers:', err);
      }
    });
  }

  extractVehicleTypes(vehicles: Vehicle[]): void {
    const types = new Set<string>();
    vehicles.forEach(v => {
      const type = v.vehicleTypeName || v.type;
      if (type) types.add(type);
    });
    this.vehicleTypes = Array.from(types).sort();
  }

  applyFilter(): void {
    let filtered = [...this.vehicles()];

    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        (v.registrationNumber?.toLowerCase().includes(search)) ||
        (v.make?.toLowerCase().includes(search)) ||
        (v.model?.toLowerCase().includes(search)) ||
        (v.currentDriverName?.toLowerCase().includes(search))
      );
    }

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(v => v.status === this.statusFilter);
    }

    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(v => 
        (v.vehicleTypeName || v.type) === this.typeFilter
      );
    }

    this.filteredVehicles.set(filtered);
  }

  sortData(sort: Sort): void {
    const data = [...this.filteredVehicles()];
    if (!sort.active || sort.direction === '') {
      this.filteredVehicles.set(data);
      return;
    }

    const sorted = data.sort((a, b) => {
      const isAsc = sort.direction === 'asc';
      switch (sort.active) {
        case 'registrationNumber':
          return compare(a.registrationNumber, b.registrationNumber, isAsc);
        case 'make':
          return compare(a.make, b.make, isAsc);
        case 'type':
          return compare(a.vehicleTypeName || a.type, b.vehicleTypeName || b.type, isAsc);
        case 'status':
          return compare(a.status, b.status, isAsc);
        default:
          return 0;
      }
    });

    this.filteredVehicles.set(sorted);
  }

  getStatusClass(status: string): string {
    if (!status) return 'status-unknown';
    const normalized = status.toLowerCase().replace(/\s+/g, '-');
    return `status-${normalized}`;
  }

  truncateLocation(location: string): string {
    if (!location) return '';
    return location.length > 25 ? location.substring(0, 25) + '...' : location;
  }

  // Edit Vehicle
  openEditDialog(vehicle: Vehicle): void {
    this.cancelAssign();
    this.cancelDelete();
    this.editingVehicle = vehicle;
    this.editForm = {
      make: vehicle.make || '',
      model: vehicle.model || '',
      year: vehicle.year || null,
      status: vehicle.status || 'Available',
      currentDriverId: vehicle.currentDriverId || null
    };
  }

  cancelEdit(): void {
    this.editingVehicle = null;
  }

  saveVehicle(): void {
    if (!this.editingVehicle) return;

    this.isSaving.set(true);
    const payload: any = {};
    
    if (this.editForm.make) payload.make = this.editForm.make;
    if (this.editForm.model) payload.model = this.editForm.model;
    if (this.editForm.year) payload.year = this.editForm.year;
    if (this.editForm.status) payload.status = this.editForm.status;
    payload.currentDriverId = this.editForm.currentDriverId;

    this.http.put(`${this.apiUrl}/fleet/vehicles/${this.editingVehicle.id}`, payload).subscribe({
      next: () => {
        this.snackBar.open('Vehicle updated successfully', 'Close', { duration: 3000 });
        this.cancelEdit();
        this.loadVehicles();
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('Failed to update vehicle:', err);
        this.snackBar.open('Failed to update vehicle', 'Close', { duration: 3000 });
        this.isSaving.set(false);
      }
    });
  }

  // Assign Driver
  assignDriver(vehicle: Vehicle): void {
    this.cancelEdit();
    this.cancelDelete();
    this.assigningDriverTo = vehicle;
    this.selectedDriverId = vehicle.currentDriverId || null;
  }

  cancelAssign(): void {
    this.assigningDriverTo = null;
    this.selectedDriverId = null;
  }

  confirmAssignDriver(): void {
    if (!this.assigningDriverTo) return;

    this.isSaving.set(true);
    const payload = { currentDriverId: this.selectedDriverId };

    this.http.put(`${this.apiUrl}/fleet/vehicles/${this.assigningDriverTo.id}`, payload).subscribe({
      next: () => {
        const driverName = this.selectedDriverId 
          ? this.drivers().find(d => d.id === this.selectedDriverId)
          : null;
        const message = driverName 
          ? `Driver ${driverName.firstName} ${driverName.lastName} assigned`
          : 'Driver removed from vehicle';
        this.snackBar.open(message, 'Close', { duration: 3000 });
        this.cancelAssign();
        this.loadVehicles();
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('Failed to assign driver:', err);
        this.snackBar.open('Failed to assign driver', 'Close', { duration: 3000 });
        this.isSaving.set(false);
      }
    });
  }

  // Move to Maintenance
  moveToMaintenance(vehicle: Vehicle): void {
    this.isSaving.set(true);
    this.http.put(`${this.apiUrl}/fleet/vehicles/${vehicle.id}`, { status: 'Maintenance' }).subscribe({
      next: () => {
        this.snackBar.open(`${vehicle.registrationNumber} moved to maintenance`, 'Close', { duration: 3000 });
        this.loadVehicles();
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('Failed to update status:', err);
        this.snackBar.open('Failed to update vehicle status', 'Close', { duration: 3000 });
        this.isSaving.set(false);
      }
    });
  }

  // Mark Available
  makeAvailable(vehicle: Vehicle): void {
    this.isSaving.set(true);
    this.http.put(`${this.apiUrl}/fleet/vehicles/${vehicle.id}`, { status: 'Available' }).subscribe({
      next: () => {
        this.snackBar.open(`${vehicle.registrationNumber} marked as available`, 'Close', { duration: 3000 });
        this.loadVehicles();
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('Failed to update status:', err);
        this.snackBar.open('Failed to update vehicle status', 'Close', { duration: 3000 });
        this.isSaving.set(false);
      }
    });
  }

  // Delete Vehicle
  confirmDelete(vehicle: Vehicle): void {
    this.cancelEdit();
    this.cancelAssign();
    this.deletingVehicle = vehicle;
  }

  cancelDelete(): void {
    this.deletingVehicle = null;
  }

  deleteVehicle(): void {
    if (!this.deletingVehicle) return;

    this.isSaving.set(true);
    this.http.delete(`${this.apiUrl}/fleet/vehicles/${this.deletingVehicle.id}`).subscribe({
      next: () => {
        this.snackBar.open(`Vehicle ${this.deletingVehicle!.registrationNumber} deleted`, 'Close', { duration: 3000 });
        this.cancelDelete();
        this.loadVehicles();
        this.isSaving.set(false);
      },
      error: (err) => {
        console.error('Failed to delete vehicle:', err);
        this.snackBar.open('Failed to delete vehicle', 'Close', { duration: 3000 });
        this.isSaving.set(false);
      }
    });
  }
}

function compare(a: string | undefined, b: string | undefined, isAsc: boolean): number {
  const aVal = a || '';
  const bVal = b || '';
  return (aVal < bVal ? -1 : 1) * (isAsc ? 1 : -1);
}
