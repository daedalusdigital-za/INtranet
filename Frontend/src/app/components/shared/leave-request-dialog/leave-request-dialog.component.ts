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
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

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
              <mat-option value="Annual Leave">Annual Leave</mat-option>
              <mat-option value="Sick Leave">Sick Leave</mat-option>
              <mat-option value="Family Responsibility">Family Responsibility Leave</mat-option>
              <mat-option value="Maternity Leave">Maternity Leave</mat-option>
              <mat-option value="Paternity Leave">Paternity Leave</mat-option>
              <mat-option value="Study Leave">Study Leave</mat-option>
              <mat-option value="Unpaid Leave">Unpaid Leave</mat-option>
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

          @if (myPastRequests.length > 0) {
            <div class="past-requests">
              <p class="past-title"><mat-icon>history</mat-icon> Your Recent Requests</p>
              @for (r of myPastRequests; track r.leaveRequestId) {
                <div class="past-item">
                  <span class="leave-type-label">{{r.leaveType}}</span>
                  <span class="date-range">{{r.startDate | date:'d MMM'}} – {{r.endDate | date:'d MMM yyyy'}}</span>
                  <span class="status-pill" [class]="'status-' + r.status.toLowerCase()">{{r.status}}</span>
                </div>
              }
            </div>
          }
        </div>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="close()">Cancel</button>
          <button mat-raised-button color="primary" type="submit"
                  [disabled]="leaveForm.invalid || isSubmitting">
            @if (isSubmitting) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <ng-container><mat-icon>send</mat-icon> Submit Request</ng-container>
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

    .past-requests { margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px; }
    .past-title { display:flex; align-items:center; gap:6px; font-size:13px; color:#555; font-weight:600; margin-bottom:8px; }
    .past-title mat-icon { font-size:16px; width:16px; height:16px; }
    .past-item { display:flex; align-items:center; gap:10px; padding:7px 10px; border-radius:8px; background:#f9fafb; margin-bottom:6px; font-size:13px; }
    .leave-type-label { font-weight:600; color:#333; flex:1; }
    .date-range { color:#666; white-space:nowrap; }
    .status-pill { padding:2px 10px; border-radius:10px; font-size:11px; font-weight:700; }
    .status-pending { background:#fff3cd; color:#856404; }
    .status-approved { background:#d1fae5; color:#065f46; }
    .status-rejected { background:#fee2e2; color:#991b1b; }
  `]
})
export class LeaveRequestDialogComponent implements OnInit {
  leaveForm!: FormGroup;
  isSubmitting = false;
  myPastRequests: any[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<LeaveRequestDialogComponent>,
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {}

  private headers(): HttpHeaders {
    const t = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    return new HttpHeaders({ Authorization: `Bearer ${t}` });
  }

  ngOnInit(): void {
    this.leaveForm = this.fb.group({
      leaveType: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      reason: [''],
      contactNumber: ['']
    });
    this.loadMyRequests();
  }

  loadMyRequests(): void {
    this.http.get<any[]>(`${environment.apiUrl}/leave-requests/my`, { headers: this.headers() })
      .subscribe({ next: r => this.myPastRequests = r.slice(0, 5), error: () => {} });
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
      const v = this.leaveForm.value;
      const payload = {
        leaveType: v.leaveType,
        startDate: v.startDate,
        endDate: v.endDate,
        reason: v.reason || null,
        contactNumber: v.contactNumber || null
      };
      this.http.post(`${environment.apiUrl}/leave-requests`, payload, { headers: this.headers() }).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.snackBar.open('Leave request submitted successfully!', 'Close', {
            duration: 3000, horizontalPosition: 'center', verticalPosition: 'top'
          });
          this.dialogRef.close(true);
        },
        error: () => {
          this.isSubmitting = false;
          this.snackBar.open('Failed to submit request. Please try again.', 'Close', { duration: 3000 });
        }
      });
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
