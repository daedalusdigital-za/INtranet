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
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Driver {
  id: number;
  firstName: string;
  licenseNumber: string;
  licenseType: string;
  licenseExpiryDate?: string;
  hireDate?: string;
  status: string;
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
    MatProgressSpinnerModule
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
        <!-- Add Driver Form -->
        <div class="add-driver-section" *ngIf="showAddForm">
          <h3>Add New Driver</h3>
          <form [formGroup]="driverForm" (ngSubmit)="addDriver()">
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
                <mat-icon>add</mat-icon>
                Add Driver
              </button>
            </div>
          </form>
        </div>

        <!-- Drivers List -->
        <div class="drivers-list">
          <div class="list-header">
            <h3>Current Drivers ({{ drivers.length }})</h3>
            <button mat-raised-button color="primary" (click)="toggleAddForm()" *ngIf="!showAddForm">
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
                <td mat-cell *matCellDef="let driver">{{ driver.firstName }}</td>
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

              <!-- License Expiry Column -->
              <ng-container matColumnDef="licenseExpiry">
                <th mat-header-cell *matHeaderCellDef>License Expiry</th>
                <td mat-cell *matCellDef="let driver">
                  {{ driver.licenseExpiryDate ? (driver.licenseExpiryDate | date: 'MMM d, y') : '-' }}
                </td>
              </ng-container>

              <!-- Hire Date Column -->
              <ng-container matColumnDef="hireDate">
                <th mat-header-cell *matHeaderCellDef>Hire Date</th>
                <td mat-cell *matCellDef="let driver">
                  {{ driver.hireDate ? (driver.hireDate | date: 'MMM d, y') : '-' }}
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let driver">
                  <button mat-icon-button color="warn" (click)="deleteDriver(driver)" [disabled]="isLoading">
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
  displayedColumns = ['name', 'licenseNumber', 'licenseType', 'licenseExpiry', 'hireDate', 'actions'];
  showAddForm = false;
  isLoading = false;
  errorMessage = '';

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
    this.http.get<Driver[]>(`${environment.apiUrl}/logistics/drivers`).subscribe({
      next: (data) => {
        this.drivers = data;
        this.isLoading = false;
        console.log('Drivers loaded:', data);
      },
      error: (error) => {
        console.error('Error loading drivers:', error);
        this.errorMessage = `Failed to load drivers: ${error.message || 'Unknown error'}`;
        this.isLoading = false;
      }
    });
  }

  toggleAddForm() {
    this.showAddForm = !this.showAddForm;
    if (!this.showAddForm) {
      this.driverForm.reset();
    }
  }

  cancelAdd() {
    this.showAddForm = false;
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
