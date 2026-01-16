import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-payslip-request-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="payslip-request-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">receipt_long</mat-icon>
        <h2>Payslip Request</h2>
        <button mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="payslipForm" (ngSubmit)="submitRequest()">
        <div class="dialog-content">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Request Type</mat-label>
            <mat-select formControlName="requestType" required>
              <mat-option value="current">Current Month Payslip</mat-option>
              <mat-option value="previous">Previous Month Payslip</mat-option>
              <mat-option value="specific">Specific Month Payslip</mat-option>
              <mat-option value="ytd">Year-to-Date Statement</mat-option>
              <mat-option value="irp5">IRP5 Certificate</mat-option>
            </mat-select>
            <mat-error *ngIf="payslipForm.get('requestType')?.hasError('required')">
              Please select a request type
            </mat-error>
          </mat-form-field>

          @if (payslipForm.get('requestType')?.value === 'specific') {
            <div class="month-year-row">
              <mat-form-field appearance="outline">
                <mat-label>Month</mat-label>
                <mat-select formControlName="month">
                  <mat-option *ngFor="let month of months; let i = index" [value]="i + 1">
                    {{ month }}
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Year</mat-label>
                <mat-select formControlName="year">
                  <mat-option *ngFor="let year of years" [value]="year">
                    {{ year }}
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          }

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Delivery Method</mat-label>
            <mat-select formControlName="deliveryMethod" required>
              <mat-option value="email">Email (to registered email)</mat-option>
              <mat-option value="print">Print Copy (collect from HR)</mat-option>
              <mat-option value="both">Both Email and Print</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason / Additional Notes</mat-label>
            <textarea matInput formControlName="reason" rows="3" 
                      placeholder="Optional - provide any additional details..."></textarea>
          </mat-form-field>

          <div class="info-box">
            <mat-icon>info</mat-icon>
            <span>Payslip requests are typically processed within 2 business days. You will receive an email notification once your request is ready.</span>
          </div>
        </div>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="close()">Cancel</button>
          <button mat-raised-button color="primary" type="submit" 
                  [disabled]="payslipForm.invalid || isSubmitting">
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
    .payslip-request-dialog {
      width: 100%;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
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

    .month-year-row {
      display: flex;
      gap: 16px;
    }

    .month-year-row mat-form-field {
      flex: 1;
    }

    .info-box {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #e3f2fd;
      border-radius: 8px;
      color: #1565c0;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .info-box mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 2px;
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
export class PayslipRequestDialogComponent implements OnInit {
  payslipForm!: FormGroup;
  isSubmitting = false;
  
  months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  years: number[] = [];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<PayslipRequestDialogComponent>,
    private snackBar: MatSnackBar
  ) {
    // Generate last 5 years
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
      this.years.push(currentYear - i);
    }
  }

  ngOnInit(): void {
    this.payslipForm = this.fb.group({
      requestType: ['', Validators.required],
      month: [new Date().getMonth() + 1],
      year: [new Date().getFullYear()],
      deliveryMethod: ['email', Validators.required],
      reason: ['']
    });
  }

  submitRequest(): void {
    if (this.payslipForm.valid) {
      this.isSubmitting = true;
      
      // Simulate API call
      setTimeout(() => {
        this.isSubmitting = false;
        this.snackBar.open('Payslip request submitted successfully!', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.dialogRef.close(this.payslipForm.value);
      }, 1500);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
