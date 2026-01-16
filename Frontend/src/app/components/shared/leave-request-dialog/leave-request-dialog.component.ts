import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-leave-request-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="leave-request-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">event_busy</mat-icon>
        <h2>Leave Request</h2>
        <button mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="leaveForm" (ngSubmit)="submitRequest()">
        <div class="dialog-content">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Leave Type</mat-label>
            <mat-select formControlName="leaveType" required>
              <mat-option value="annual">Annual Leave</mat-option>
              <mat-option value="sick">Sick Leave</mat-option>
              <mat-option value="family">Family Responsibility Leave</mat-option>
              <mat-option value="maternity">Maternity Leave</mat-option>
              <mat-option value="paternity">Paternity Leave</mat-option>
              <mat-option value="study">Study Leave</mat-option>
              <mat-option value="unpaid">Unpaid Leave</mat-option>
            </mat-select>
            <mat-error *ngIf="leaveForm.get('leaveType')?.hasError('required')">
              Please select a leave type
            </mat-error>
          </mat-form-field>

          <div class="date-row">
            <mat-form-field appearance="outline">
              <mat-label>Start Date</mat-label>
              <input matInput [matDatepicker]="startPicker" formControlName="startDate" required>
              <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
              <mat-error *ngIf="leaveForm.get('startDate')?.hasError('required')">
                Start date is required
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>End Date</mat-label>
              <input matInput [matDatepicker]="endPicker" formControlName="endDate" required>
              <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
              <mat-datepicker #endPicker></mat-datepicker>
              <mat-error *ngIf="leaveForm.get('endDate')?.hasError('required')">
                End date is required
              </mat-error>
            </mat-form-field>
          </div>

          <div class="days-info" *ngIf="calculateDays() > 0">
            <mat-icon>info</mat-icon>
            <span>Total days requested: <strong>{{ calculateDays() }}</strong></span>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason</mat-label>
            <textarea matInput formControlName="reason" rows="4" 
                      placeholder="Please provide a reason for your leave request..."></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Contact Number (while on leave)</mat-label>
            <input matInput formControlName="contactNumber" placeholder="Optional">
            <mat-icon matPrefix>phone</mat-icon>
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="close()">Cancel</button>
          <button mat-raised-button color="primary" type="submit" 
                  [disabled]="leaveForm.invalid || isSubmitting">
            @if (isSubmitting) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <mat-icon>send</mat-icon>
              Submit Request
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .leave-request-dialog {
      width: 100%;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      position: relative;
    }

    .header-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.5rem;
      text-align: center;
    }

    .close-btn {
      color: white;
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
    }

    .dialog-content {
      padding: 24px 0;
    }

    .full-width {
      width: 100%;
    }

    .date-row {
      display: flex;
      gap: 16px;
    }

    .date-row mat-form-field {
      flex: 1;
    }

    .days-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: #e8f5e9;
      border-radius: 8px;
      margin-bottom: 16px;
      color: #2e7d32;
    }

    .days-info mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .dialog-actions button mat-spinner {
      display: inline-block;
    }

    .dialog-actions button mat-icon {
      margin-right: 8px;
    }
  `]
})
export class LeaveRequestDialogComponent implements OnInit {
  leaveForm!: FormGroup;
  isSubmitting = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<LeaveRequestDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.leaveForm = this.fb.group({
      leaveType: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      reason: [''],
      contactNumber: ['']
    });
  }

  calculateDays(): number {
    const start = this.leaveForm.get('startDate')?.value;
    const end = this.leaveForm.get('endDate')?.value;
    
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 0;
    }
    return 0;
  }

  submitRequest(): void {
    if (this.leaveForm.valid) {
      this.isSubmitting = true;
      
      // Simulate API call
      setTimeout(() => {
        this.isSubmitting = false;
        this.snackBar.open('Leave request submitted successfully!', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.dialogRef.close(this.leaveForm.value);
      }, 1500);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
