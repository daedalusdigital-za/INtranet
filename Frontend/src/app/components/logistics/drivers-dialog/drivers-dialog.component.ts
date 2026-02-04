import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Driver {
  id: number;
  firstName: string;
  lastName?: string;
  licenseNumber: string;
  licenseType: string;
  licenseExpiryDate?: string;
  hireDate?: string;
  status: string;
  totalTrips?: number;
  totalKmDriven?: number;
}

@Component({
  selector: 'app-drivers-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="drivers-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon>local_shipping</mat-icon>
          Driver Management
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <!-- Stats Summary -->
        <div class="stats-summary" *ngIf="!isLoading && drivers.length > 0">
          <div class="stat-card">
            <mat-icon>group</mat-icon>
            <div class="stat-content">
              <span class="stat-value">{{ drivers.length }}</span>
              <span class="stat-label">Total Drivers</span>
            </div>
          </div>
          <div class="stat-card">
            <mat-icon>check_circle</mat-icon>
            <div class="stat-content">
              <span class="stat-value">{{ getAvailableCount() }}</span>
              <span class="stat-label">Available</span>
            </div>
          </div>
          <div class="stat-card">
            <mat-icon>route</mat-icon>
            <div class="stat-content">
              <span class="stat-value">{{ getTotalTrips() | number }}</span>
              <span class="stat-label">Total Trips Delivered</span>
            </div>
          </div>
          <div class="stat-card">
            <mat-icon>speed</mat-icon>
            <div class="stat-content">
              <span class="stat-value">{{ getTotalKm() | number:'1.0-0' }} km</span>
              <span class="stat-label">Total KM Driven</span>
            </div>
          </div>
        </div>

        <!-- View Driver Details Panel -->
        <div class="driver-details-panel" *ngIf="viewingDriver">
          <div class="details-header">
            <h3><mat-icon>person</mat-icon> Driver Details</h3>
            <button mat-icon-button (click)="closeViewDriver()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="details-content">
            <div class="detail-row">
              <div class="detail-item">
                <span class="detail-label">Full Name</span>
                <span class="detail-value">{{ viewingDriver.firstName }} {{ viewingDriver.lastName || '' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Status</span>
                <span class="status-badge" [class]="viewingDriver.status?.toLowerCase()">{{ viewingDriver.status || 'Active' }}</span>
              </div>
            </div>
            <div class="detail-row">
              <div class="detail-item">
                <span class="detail-label">License Number</span>
                <span class="detail-value">{{ viewingDriver.licenseNumber }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">License Type</span>
                <span class="detail-value">{{ viewingDriver.licenseType }}</span>
              </div>
            </div>
            <div class="detail-row">
              <div class="detail-item">
                <span class="detail-label">License Expiry</span>
                <span class="detail-value">{{ viewingDriver.licenseExpiryDate ? (viewingDriver.licenseExpiryDate | date:'mediumDate') : 'Not set' }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Hire Date</span>
                <span class="detail-value">{{ viewingDriver.hireDate ? (viewingDriver.hireDate | date:'mediumDate') : 'Not set' }}</span>
              </div>
            </div>
            <div class="stats-row">
              <div class="stat-item">
                <mat-icon>route</mat-icon>
                <div class="stat-info">
                  <span class="stat-number">{{ viewingDriver.totalTrips || 0 }}</span>
                  <span class="stat-text">Trips Completed</span>
                </div>
              </div>
              <div class="stat-item">
                <mat-icon>speed</mat-icon>
                <div class="stat-info">
                  <span class="stat-number">{{ (viewingDriver.totalKmDriven || 0) | number:'1.0-0' }}</span>
                  <span class="stat-text">Total KM Driven</span>
                </div>
              </div>
              <div class="stat-item">
                <mat-icon>trending_up</mat-icon>
                <div class="stat-info">
                  <span class="stat-number">{{ getAvgKmPerTrip(viewingDriver) | number:'1.0-0' }}</span>
                  <span class="stat-text">Avg KM per Trip</span>
                </div>
              </div>
            </div>
          </div>
          <div class="details-actions">
            <button mat-raised-button (click)="closeViewDriver()">
              <mat-icon>arrow_back</mat-icon>
              Back to List
            </button>
            <button mat-raised-button color="primary" (click)="editFromView()">
              <mat-icon>edit</mat-icon>
              Edit Driver
            </button>
          </div>
        </div>

        <!-- Add/Edit Driver Form -->
        <div class="add-driver-section" *ngIf="showAddForm || editingDriver">
          <h3>{{ editingDriver ? 'Edit Driver' : 'Add New Driver' }}</h3>
          <form [formGroup]="driverForm" (ngSubmit)="editingDriver ? updateDriver() : addDriver()">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>First Name</mat-label>
                <input matInput formControlName="firstName" required>
                <mat-error *ngIf="driverForm.get('firstName')?.hasError('required')">
                  First name is required
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>License Number</mat-label>
                <input matInput formControlName="licenseNumber" required>
                <mat-error *ngIf="driverForm.get('licenseNumber')?.hasError('required')">
                  License number is required
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>License Type</mat-label>
                <mat-select formControlName="licenseType" required>
                  <mat-option value="Code 8">Code 8</mat-option>
                  <mat-option value="Code 10">Code 10</mat-option>
                  <mat-option value="Code 14">Code 14</mat-option>
                </mat-select>
                <mat-error *ngIf="driverForm.get('licenseType')?.hasError('required')">
                  License type is required
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>License Expiry Date</mat-label>
                <input matInput [matDatepicker]="expiryPicker" formControlName="licenseExpiryDate">
                <mat-datepicker-toggle matSuffix [for]="expiryPicker"></mat-datepicker-toggle>
                <mat-datepicker #expiryPicker></mat-datepicker>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Hire Date</mat-label>
                <input matInput [matDatepicker]="hirePicker" formControlName="hireDate">
                <mat-datepicker-toggle matSuffix [for]="hirePicker"></mat-datepicker-toggle>
                <mat-datepicker #hirePicker></mat-datepicker>
              </mat-form-field>
            </div>

            <div class="form-actions">
              <button mat-raised-button type="button" (click)="cancelAdd()">
                <mat-icon>cancel</mat-icon>
                Cancel
              </button>
              <button mat-raised-button color="primary" type="submit" [disabled]="!driverForm.valid || isLoading">
                <mat-icon>{{ editingDriver ? 'save' : 'add' }}</mat-icon>
                {{ editingDriver ? 'Save Changes' : 'Add Driver' }}
              </button>
            </div>
          </form>
        </div>

        <!-- Drivers List -->
        <div class="drivers-list">
          <div class="list-header">
            <h3>Current Drivers ({{ drivers.length }})</h3>
            <button mat-raised-button color="primary" (click)="toggleAddForm()" *ngIf="!showAddForm && !editingDriver">
              <mat-icon>add</mat-icon>
              Add Driver
            </button>
          </div>

          <div class="table-container">
            <div class="loading-spinner" *ngIf="isLoading">
              <mat-spinner diameter="40"></mat-spinner>
              <p>Loading drivers...</p>
            </div>

            <table mat-table [dataSource]="drivers" class="drivers-table" *ngIf="!isLoading && drivers.length > 0">
              <!-- Name Column -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Name</th>
                <td mat-cell *matCellDef="let driver">{{ driver.firstName }} {{ driver.lastName || '' }}</td>
              </ng-container>

              <!-- License Number Column -->
              <ng-container matColumnDef="licenseNumber">
                <th mat-header-cell *matHeaderCellDef>License #</th>
                <td mat-cell *matCellDef="let driver">{{ driver.licenseNumber }}</td>
              </ng-container>

              <!-- License Type Column -->
              <ng-container matColumnDef="licenseType">
                <th mat-header-cell *matHeaderCellDef>License Type</th>
                <td mat-cell *matCellDef="let driver">{{ driver.licenseType }}</td>
              </ng-container>

              <!-- Total Trips Column -->
              <ng-container matColumnDef="totalTrips">
                <th mat-header-cell *matHeaderCellDef>Trips</th>
                <td mat-cell *matCellDef="let driver">
                  <span class="stats-badge trips" [matTooltip]="'Total delivered trips'">
                    <mat-icon>route</mat-icon>
                    {{ driver.totalTrips || 0 }}
                  </span>
                </td>
              </ng-container>

              <!-- Total KM Column -->
              <ng-container matColumnDef="totalKm">
                <th mat-header-cell *matHeaderCellDef>Total KM</th>
                <td mat-cell *matCellDef="let driver">
                  <span class="stats-badge km" [matTooltip]="'Total kilometers driven'">
                    <mat-icon>speed</mat-icon>
                    {{ (driver.totalKmDriven || 0) | number:'1.0-0' }}
                  </span>
                </td>
              </ng-container>

              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let driver">
                  <span class="status-badge" [class]="driver.status?.toLowerCase()">
                    {{ driver.status || 'Active' }}
                  </span>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let driver">
                  <button mat-icon-button color="primary" (click)="editDriver(driver)" [disabled]="isLoading" matTooltip="Edit driver">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button mat-icon-button (click)="viewDriver(driver)" [disabled]="isLoading" matTooltip="View details">
                    <mat-icon>visibility</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="deleteDriver(driver)" [disabled]="isLoading" matTooltip="Delete driver">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>

            <div class="no-data" *ngIf="!isLoading && drivers.length === 0 && !errorMessage">
              <mat-icon>info</mat-icon>
              <p>No drivers found. Add your first driver above.</p>
            </div>

            <div class="error-message" *ngIf="errorMessage">
              <mat-icon>error</mat-icon>
              <p>{{ errorMessage }}</p>
            </div>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .drivers-dialog {
      width: 900px;
      max-width: 95vw;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);

      h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        font-size: 24px;
        font-weight: 500;
      }
    }

    mat-dialog-content {
      padding: 24px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .stats-summary {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;

      .stat-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 12px;
        color: white;

        mat-icon {
          font-size: 32px;
          width: 32px;
          height: 32px;
          opacity: 0.9;
        }

        .stat-content {
          display: flex;
          flex-direction: column;

          .stat-value {
            font-size: 24px;
            font-weight: 700;
            line-height: 1.2;
          }

          .stat-label {
            font-size: 12px;
            opacity: 0.9;
          }
        }

        &:nth-child(2) {
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
        }

        &:nth-child(3) {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }

        &:nth-child(4) {
          background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
      }
    }

    .driver-details-panel {
      background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ed 100%);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      border: 1px solid rgba(0, 0, 0, 0.08);

      .details-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);

        h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #333;
        }
      }

      .details-content {
        .detail-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-bottom: 16px;
        }

        .detail-item {
          .detail-label {
            display: block;
            font-size: 12px;
            color: rgba(0, 0, 0, 0.54);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .detail-value {
            font-size: 16px;
            font-weight: 500;
            color: #333;
          }
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);

          .stat-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background: white;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

            mat-icon {
              font-size: 28px;
              width: 28px;
              height: 28px;
              color: #667eea;
            }

            .stat-info {
              display: flex;
              flex-direction: column;

              .stat-number {
                font-size: 22px;
                font-weight: 700;
                color: #333;
              }

              .stat-text {
                font-size: 11px;
                color: rgba(0, 0, 0, 0.54);
                text-transform: uppercase;
              }
            }

            &:nth-child(2) mat-icon { color: #11998e; }
            &:nth-child(3) mat-icon { color: #f5576c; }
          }
        }
      }

      .details-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid rgba(0, 0, 0, 0.1);

        button {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
    }

    .add-driver-section {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 32px;

      h3 {
        margin-top: 0;
        margin-bottom: 20px;
        font-size: 18px;
        font-weight: 500;
      }

      .form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 16px;
      }

      mat-form-field {
        width: 100%;
      }

      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;

        button {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
    }

    .drivers-list {
      .list-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;

        h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 500;
        }

        button {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }

      .table-container {
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 8px;
        overflow: hidden;

        .drivers-table {
          width: 100%;

          th {
            background: #f5f5f5;
            font-weight: 600;
            color: rgba(0, 0, 0, 0.87);
          }

          td, th {
            padding: 12px 16px;
          }

          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            background: #e0e0e0;
            color: rgba(0, 0, 0, 0.6);

            &.active {
              background: #4caf50;
              color: white;
            }

            &.inactive {
              background: #9e9e9e;
              color: white;
            }

            &.on.leave, &.on-leave {
              background: #ff9800;
              color: white;
            }

            &.suspended {
              background: #f44336;
              color: white;
            }
          }

          .stats-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 16px;
            font-size: 13px;
            font-weight: 600;

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
            }

            &.trips {
              background: rgba(103, 126, 234, 0.15);
              color: #667eea;
            }

            &.km {
              background: rgba(79, 172, 254, 0.15);
              color: #4facfe;
            }
          }
        }

        .no-data {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          color: rgba(0, 0, 0, 0.38);

          mat-icon {
            font-size: 48px;
            width: 48px;
            height: 48px;
            margin-bottom: 16px;
          }

          p {
            margin: 0;
            font-size: 14px;
          }
        }

        .loading-spinner {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          color: rgba(0, 0, 0, 0.54);

          p {
            margin-top: 16px;
            font-size: 14px;
          }
        }

        .error-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          color: #f44336;

          mat-icon {
            font-size: 48px;
            width: 48px;
            height: 48px;
            margin-bottom: 16px;
          }

          p {
            margin: 0;
            font-size: 14px;
            text-align: center;
          }
        }
      }
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
    }
  `]
})
export class DriversDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<DriversDialogComponent>);

  drivers: Driver[] = [];
  displayedColumns = ['name', 'licenseNumber', 'licenseType', 'totalTrips', 'totalKm', 'status', 'actions'];
  showAddForm = false;
  isLoading = false;
  errorMessage = '';
  editingDriver: Driver | null = null;
  viewingDriver: Driver | null = null;

  driverForm: FormGroup;

  constructor() {
    this.driverForm = this.fb.group({
      firstName: ['', Validators.required],
      licenseNumber: ['', Validators.required],
      licenseType: ['', Validators.required],
      licenseExpiryDate: [null],
      hireDate: [null]
    });
  }

  ngOnInit() {
    this.loadDrivers();
  }

  loadDrivers() {
    this.isLoading = true;
    this.errorMessage = '';
    // Use the new endpoint that includes stats
    this.http.get<Driver[]>(`${environment.apiUrl}/logistics/drivers/with-stats`).subscribe({
      next: (data) => {
        this.drivers = data;
        this.isLoading = false;
        console.log('Drivers with stats loaded:', data);
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
        this.errorMessage = `Failed to load drivers: ${error.message || 'Unknown error'}`;
        this.isLoading = false;
      }
    });
  }

  // Stats helper methods
  getAvailableCount(): number {
    return this.drivers.filter(d => d.status?.toLowerCase() === 'active').length;
  }

  getTotalTrips(): number {
    return this.drivers.reduce((sum, d) => sum + (d.totalTrips || 0), 0);
  }

  getTotalKm(): number {
    return this.drivers.reduce((sum, d) => sum + (d.totalKmDriven || 0), 0);
  }

  getAvgKmPerTrip(driver: Driver): number {
    if (!driver.totalTrips || driver.totalTrips === 0) return 0;
    return (driver.totalKmDriven || 0) / driver.totalTrips;
  }

  viewDriver(driver: Driver) {
    this.viewingDriver = driver;
    this.showAddForm = false;
    this.editingDriver = null;
  }

  closeViewDriver() {
    this.viewingDriver = null;
  }

  editFromView() {
    if (this.viewingDriver) {
      const driver = this.viewingDriver;
      this.viewingDriver = null;
      this.editDriver(driver);
    }
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.driverForm.reset();
    }
  }

  cancelAdd() {
    this.showAddForm = false;
    this.editingDriver = null;
    this.viewingDriver = null;
    this.driverForm.reset();
  }

  addDriver() {
    if (this.driverForm.valid) {
      this.isLoading = true;
      this.http.post<Driver>(`${environment.apiUrl}/logistics/drivers`, this.driverForm.value).subscribe({
        next: (newDriver) => {
          this.drivers.push(newDriver);
          this.driverForm.reset();
          this.showAddForm = false;
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error adding driver:', error);
          this.isLoading = false;
        }
      });
    }
  }

  editDriver(driver: Driver) {
    this.editingDriver = driver;
    this.showAddForm = false;
    this.viewingDriver = null;
    this.driverForm.patchValue({
      firstName: driver.firstName,
      licenseNumber: driver.licenseNumber,
      licenseType: driver.licenseType,
      licenseExpiryDate: driver.licenseExpiryDate ? new Date(driver.licenseExpiryDate) : null,
      hireDate: driver.hireDate ? new Date(driver.hireDate) : null
    });
  }

  updateDriver() {
    if (this.driverForm.valid && this.editingDriver) {
      this.isLoading = true;
      this.http.put(`${environment.apiUrl}/logistics/drivers/${this.editingDriver.id}`, this.driverForm.value).subscribe({
        next: () => {
          // Update the driver in the local array
          const index = this.drivers.findIndex(d => d.id === this.editingDriver!.id);
          if (index !== -1) {
            this.drivers[index] = {
              ...this.drivers[index],
              ...this.driverForm.value
            };
          }
          this.driverForm.reset();
          this.editingDriver = null;
          this.isLoading = false;
          // Reload to get updated stats
          this.loadDrivers();
        },
        error: (error) => {
          console.error('Error updating driver:', error);
          this.isLoading = false;
        }
      });
    }
  }

  deleteDriver(driver: Driver) {
    if (confirm(`Are you sure you want to delete ${driver.firstName}?`)) {
      this.isLoading = true;
      this.http.delete(`${environment.apiUrl}/logistics/drivers/${driver.id}`).subscribe({
        next: () => {
          this.drivers = this.drivers.filter(d => d.id !== driver.id);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error deleting driver:', error);
          this.isLoading = false;
        }
      });
    }
  }
}
