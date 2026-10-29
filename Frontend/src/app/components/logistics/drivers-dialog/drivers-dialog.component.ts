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
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../ui/confirm.service';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';
import { StatusChipComponent, ChipTone } from '../../../ui/status-chip/status-chip.component';

interface Driver {
  id: number;
  firstName: string;
  lastName?: string;
  licenseNumber: string;
  licenseType: string;
  licenseExpiryDate?: string;
  hireDate?: string;
  status: string;
  idNumber?: string;
  passportNumber?: string;
  nationality?: string;
  employeeNumber?: string;
  dateOfBirth?: string;
  phoneNumber?: string;
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
    MatTooltipModule,
    SkeletonRowsComponent,
    EmptyStateComponent,
    StatusChipComponent
  ],
  template: `
    <div class="drivers-dialog">
      <div class="dialog-header">
        <h2 mat-dialog-title>
          <mat-icon>local_shipping</mat-icon>
          Driver Management
        </h2>
        <button aria-label="Close" mat-icon-button mat-dialog-close>
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
            <button aria-label="Close" mat-icon-button (click)="closeViewDriver()">
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
                <app-status-chip [status]="viewingDriver.status || 'Active'" [tone]="getStatusTone(viewingDriver.status || 'Active')"></app-status-chip>
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
                <mat-label>Last Name</mat-label>
                <input matInput formControlName="lastName">
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Nationality</mat-label>
                <mat-select formControlName="nationality">
                  <mat-option value="South African">South African</mat-option>
                  <mat-option value="Mozambican">Mozambican</mat-option>
                  <mat-option value="Zimbabwean">Zimbabwean</mat-option>
                  <mat-option value="Malawian">Malawian</mat-option>
                  <mat-option value="Swazi">Swazi</mat-option>
                  <mat-option value="Lesotho">Lesotho</mat-option>
                  <mat-option value="Zambian">Zambian</mat-option>
                  <mat-option value="Tanzanian">Tanzanian</mat-option>
                  <mat-option value="Other">Other</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>{{ driverForm.get('nationality')?.value === 'South African' ? 'SA ID Number (13 digits)' : 'National ID Number' }}</mat-label>
                <input matInput formControlName="idNumber">
              </mat-form-field>
            </div>

            <div class="form-row" *ngIf="driverForm.get('nationality')?.value !== 'South African'">
              <mat-form-field appearance="outline">
                <mat-label>Passport Number</mat-label>
                <input matInput formControlName="passportNumber">
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>License Number</mat-label>
                <input matInput formControlName="licenseNumber" required>
                <mat-error *ngIf="driverForm.get('licenseNumber')?.hasError('required')">
                  License number is required
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>License Type</mat-label>
                <mat-select formControlName="licenseType" required>
                  <mat-option value="B Code 8">B Code 8</mat-option>
                  <mat-option value="C1 Code 10">C1 Code 10</mat-option>
                  <mat-option value="EC Code 14">EC Code 14</mat-option>
                </mat-select>
                <mat-error *ngIf="driverForm.get('licenseType')?.hasError('required')">
                  License type is required
                </mat-error>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>License Expiry Date</mat-label>
                <input matInput [matDatepicker]="expiryPicker" formControlName="licenseExpiryDate">
                <mat-datepicker-toggle matSuffix [for]="expiryPicker"></mat-datepicker-toggle>
                <mat-datepicker #expiryPicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Date of Birth</mat-label>
                <input matInput [matDatepicker]="dobPicker" formControlName="dateOfBirth">
                <mat-datepicker-toggle matSuffix [for]="dobPicker"></mat-datepicker-toggle>
                <mat-datepicker #dobPicker></mat-datepicker>
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Phone Number</mat-label>
                <input matInput formControlName="phoneNumber">
              </mat-form-field>

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
            <app-skeleton-rows *ngIf="isLoading" [rows]="6" [avatar]="false"></app-skeleton-rows>

            <table mat-table [dataSource]="drivers" class="drivers-table" *ngIf="!isLoading && drivers.length > 0">
              <!-- Rank Column -->
              <ng-container matColumnDef="rank">
                <th mat-header-cell *matHeaderCellDef>Rank</th>
                <td mat-cell *matCellDef="let driver">
                  <span class="rank-badge" [class.medal]="getRank(driver) <= 3 && isActive(driver)" [attr.data-rank]="getRank(driver)"
                        [matTooltip]="isActive(driver) ? ('Ranked #' + getRank(driver) + ' by trips & distance') : 'Not ranked (inactive)'">
                    <ng-container *ngIf="isActive(driver) && getRank(driver) <= 3"><mat-icon aria-hidden="true">military_tech</mat-icon>{{ getRank(driver) }}</ng-container>
                    <ng-container *ngIf="!isActive(driver) || getRank(driver) > 3">{{ isActive(driver) ? getRank(driver) : '—' }}</ng-container>
                  </span>
                </td>
              </ng-container>

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
                  <app-status-chip [status]="driver.status || 'Active'" [tone]="getStatusTone(driver.status)"></app-status-chip>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Actions</th>
                <td mat-cell *matCellDef="let driver">
                  <button aria-label="Edit driver" mat-icon-button color="primary" (click)="editDriver(driver)" [disabled]="isLoading" matTooltip="Edit driver">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button aria-label="View details" mat-icon-button (click)="viewDriver(driver)" [disabled]="isLoading" matTooltip="View details">
                    <mat-icon>visibility</mat-icon>
                  </button>
                  <button aria-label="Delete driver" mat-icon-button color="warn" (click)="deleteDriver(driver)" [disabled]="isLoading" matTooltip="Delete driver">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>

            <app-empty-state *ngIf="!isLoading && drivers.length === 0 && !errorMessage" icon="badge"
                             title="No drivers yet"
                             message="Add your first driver to start tracking their trips and distance.">
              <button mat-stroked-button (click)="toggleAddForm()" *ngIf="!showAddForm && !editingDriver">
                <mat-icon>add</mat-icon>
                Add Driver
              </button>
            </app-empty-state>

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
      border-bottom: 1px solid var(--color-line);

      h2 {
        display: flex;
        align-items: center;
        gap: 12px;
        margin: 0;
        font-size: var(--text-2xl);
        font-weight: 700;
        color: var(--color-text);

        mat-icon {
          color: var(--color-primary);
        }
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
        background: var(--color-surface);
        border: 1px solid var(--color-line);
        border-radius: var(--radius-md);
        color: var(--color-text);

        mat-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: none;
          font-size: 22px;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: var(--color-primary-soft);
          color: var(--color-primary);
        }

        .stat-content {
          display: flex;
          flex-direction: column;

          .stat-value {
            font-size: var(--text-3xl);
            font-weight: 700;
            line-height: 1.2;
          }

          .stat-label {
            font-size: var(--text-xs);
            color: var(--color-text-2);
          }
        }

        &:nth-child(2) mat-icon {
          background: var(--color-ok-soft);
          color: var(--color-ok);
        }

        &:nth-child(3) mat-icon {
          background: var(--color-cat-purple-soft);
          color: var(--color-cat-purple);
        }

        &:nth-child(4) mat-icon {
          background: var(--color-cat-teal-soft);
          color: var(--color-cat-teal);
        }
      }
    }

    .driver-details-panel {
      background: var(--color-surface-2);
      border-radius: var(--radius-lg);
      padding: 24px;
      margin-bottom: 24px;
      border: 1px solid var(--color-line);

      .details-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--color-line);

        h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: var(--text-lg);
          font-weight: 700;
          color: var(--color-text);

          mat-icon {
            color: var(--color-primary);
          }
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
            font-size: var(--text-xs);
            color: var(--color-text-3);
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }

          .detail-value {
            font-size: var(--text-lg);
            font-weight: 500;
            color: var(--color-text);
          }
        }

        .stats-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--color-line);

          .stat-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px;
            background: var(--color-surface);
            border: 1px solid var(--color-line);
            border-radius: var(--radius-md);
            box-shadow: var(--shadow-sm);

            mat-icon {
              font-size: 28px;
              width: 28px;
              height: 28px;
              color: var(--color-cat-purple);
            }

            .stat-info {
              display: flex;
              flex-direction: column;

              .stat-number {
                font-size: var(--text-2xl);
                font-weight: 700;
                color: var(--color-text);
              }

              .stat-text {
                font-size: var(--text-xs);
                color: var(--color-text-3);
                text-transform: uppercase;
              }
            }

            &:nth-child(2) mat-icon { color: var(--color-cat-teal); }
            &:nth-child(3) mat-icon { color: var(--color-cat-pink); }
          }
        }
      }

      .details-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--color-line);

        button {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }
    }

    .add-driver-section {
      background: var(--color-surface-2);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 32px;

      h3 {
        margin-top: 0;
        margin-bottom: 20px;
        font-size: var(--text-xl);
        font-weight: 600;
        color: var(--color-text);
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
          font-size: var(--text-xl);
          font-weight: 600;
          color: var(--color-text);
        }

        button {
          display: flex;
          align-items: center;
          gap: 8px;
        }
      }

      .table-container {
        border: 1px solid var(--color-line);
        border-radius: 8px;
        overflow: hidden;

        .drivers-table {
          width: 100%;

          th {
            background: var(--color-surface-2);
            font-weight: 600;
            color: var(--color-text-2);
          }

          td, th {
            padding: var(--row-pad-y) 16px;
          }

          td {
            color: var(--color-text);
          }

          .stats-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 16px;
            font-size: var(--text-sm);
            font-weight: 600;
            font-variant-numeric: tabular-nums;

            mat-icon {
              font-size: 16px;
              width: 16px;
              height: 16px;
            }

            &.trips {
              background: var(--color-cat-purple-soft);
              color: var(--color-cat-purple);
            }

            &.km {
              background: var(--color-cat-teal-soft);
              color: var(--color-cat-teal);
            }
          }

          .rank-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 30px;
            height: 30px;
            padding: 0 6px;
            border-radius: 50%;
            font-size: var(--text-md);
            font-weight: 700;
            color: var(--color-text-3);
            background: var(--color-surface-2);
          }
          .rank-badge.medal {
            gap: 2px;
            padding: 0 10px 0 6px;
            border-radius: 999px;
            color: var(--color-cat-amber);
            background: var(--color-cat-amber-soft);

            mat-icon {
              font-size: 18px;
              width: 18px;
              height: 18px;
            }
          }
        }

        .error-message {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px;
          color: var(--color-danger);

          mat-icon {
            font-size: 48px;
            width: 48px;
            height: 48px;
            margin-bottom: 16px;
          }

          p {
            margin: 0;
            font-size: var(--text-md);
            text-align: center;
          }
        }
      }
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid var(--color-line);
    }
  `]
})
export class DriversDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<DriversDialogComponent>);
  private readonly confirmDialog = inject(ConfirmService);

  drivers: Driver[] = [];
  displayedColumns = ['rank', 'name', 'licenseNumber', 'licenseType', 'totalTrips', 'totalKm', 'status', 'actions'];
  showAddForm = false;
  isLoading = false;
  errorMessage = '';
  editingDriver: Driver | null = null;
  viewingDriver: Driver | null = null;

  driverForm: FormGroup;

  constructor() {
    this.driverForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: [''],
      licenseNumber: ['', Validators.required],
      licenseType: ['', Validators.required],
      licenseExpiryDate: [null],
      nationality: ['South African'],
      idNumber: [''],
      passportNumber: [''],
      phoneNumber: [''],
      dateOfBirth: [null],
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
        this.drivers = data.sort((a, b) => {
          // Active drivers ranked first, everyone else after
          const aActive = a.status?.toLowerCase() === 'active' ? 0 : 1;
          const bActive = b.status?.toLowerCase() === 'active' ? 0 : 1;
          if (aActive !== bActive) return aActive - bActive;
          // Ranking: most trips first, then most km, then name as a tiebreaker
          const tripsDiff = (b.totalTrips || 0) - (a.totalTrips || 0);
          if (tripsDiff !== 0) return tripsDiff;
          const kmDiff = (b.totalKmDriven || 0) - (a.totalKmDriven || 0);
          if (kmDiff !== 0) return kmDiff;
          return (a.firstName || '').localeCompare(b.firstName || '');
        });
        this.isLoading = false;
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

  isActive(driver: Driver): boolean {
    return driver.status?.toLowerCase() === 'active';
  }

  getStatusTone(status: string | undefined): ChipTone {
    switch ((status || '').toLowerCase().replace(/[\s_-]+/g, ' ')) {
      case 'active': return 'ok';
      case 'on leave': return 'warn';
      case 'suspended': return 'danger';
      default: return 'neutral';
    }
  }

  // Rank among active drivers (1-based) by trips then km. Because the list is
  // already sorted active-first then by trips/km, the rank is the driver's
  // position within the active subset.
  getRank(driver: Driver): number {
    const activeDrivers = this.drivers.filter(d => this.isActive(d));
    const idx = activeDrivers.indexOf(driver);
    return idx >= 0 ? idx + 1 : 0;
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
      lastName: driver.lastName || '',
      licenseNumber: driver.licenseNumber,
      licenseType: driver.licenseType,
      licenseExpiryDate: driver.licenseExpiryDate ? new Date(driver.licenseExpiryDate) : null,
      nationality: driver.nationality || 'South African',
      idNumber: driver.idNumber || '',
      passportNumber: driver.passportNumber || '',
      phoneNumber: driver.phoneNumber || '',
      dateOfBirth: driver.dateOfBirth ? new Date(driver.dateOfBirth) : null,
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

  async deleteDriver(driver: Driver) {
    if (await this.confirmDialog.ask({
      title: `Delete driver ${driver.firstName}?`,
      message: 'The driver is deleted and removed from this list.',
      confirmText: 'Delete driver',
      danger: true
    })) {
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
