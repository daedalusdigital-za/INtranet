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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-private-meeting-request-dialog',
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
    MatCheckboxModule,
    MatRadioModule,
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="meeting-request-dialog">
      <div class="dialog-header">
        <mat-icon class="header-icon">meeting_room</mat-icon>
        <h2>Private Meeting Request</h2>
        <button mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="meetingForm" (ngSubmit)="submitRequest()">
        <div class="dialog-content">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Meeting With</mat-label>
            <mat-select formControlName="meetingWith" required>
              <mat-option value="hr">Human Resources (HR)</mat-option>
              <mat-option value="manager">Direct Manager</mat-option>
              <mat-option value="supervisor">Supervisor</mat-option>
              <mat-option value="director">Director</mat-option>
              <mat-option value="ceo">CEO / Executive</mat-option>
            </mat-select>
            <mat-error *ngIf="meetingForm.get('meetingWith')?.hasError('required')">
              Please select who you want to meet with
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Meeting Subject</mat-label>
            <mat-select formControlName="subject" required>
              <mat-option value="personal">Personal Matter</mat-option>
              <mat-option value="performance">Performance Discussion</mat-option>
              <mat-option value="career">Career Development</mat-option>
              <mat-option value="salary">Salary / Compensation</mat-option>
              <mat-option value="grievance">Grievance / Complaint</mat-option>
              <mat-option value="training">Training Request</mat-option>
              <mat-option value="other">Other</mat-option>
            </mat-select>
            <mat-error *ngIf="meetingForm.get('subject')?.hasError('required')">
              Please select a subject
            </mat-error>
          </mat-form-field>

          <div class="date-time-row">
            <mat-form-field appearance="outline">
              <mat-label>Preferred Date</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="preferredDate" 
                     [min]="minDate" required>
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
              <mat-error *ngIf="meetingForm.get('preferredDate')?.hasError('required')">
                Date is required
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Preferred Time</mat-label>
              <mat-select formControlName="preferredTime" required>
                <mat-option value="08:00">08:00 AM</mat-option>
                <mat-option value="09:00">09:00 AM</mat-option>
                <mat-option value="10:00">10:00 AM</mat-option>
                <mat-option value="11:00">11:00 AM</mat-option>
                <mat-option value="12:00">12:00 PM</mat-option>
                <mat-option value="13:00">01:00 PM</mat-option>
                <mat-option value="14:00">02:00 PM</mat-option>
                <mat-option value="15:00">03:00 PM</mat-option>
                <mat-option value="16:00">04:00 PM</mat-option>
              </mat-select>
              <mat-error *ngIf="meetingForm.get('preferredTime')?.hasError('required')">
                Time is required
              </mat-error>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Estimated Duration</mat-label>
            <mat-select formControlName="duration" required>
              <mat-option value="15">15 minutes</mat-option>
              <mat-option value="30">30 minutes</mat-option>
              <mat-option value="45">45 minutes</mat-option>
              <mat-option value="60">1 hour</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Brief Description</mat-label>
            <textarea matInput formControlName="description" rows="4" 
                      placeholder="Please provide a brief description of what you'd like to discuss (this will be kept confidential)..."
                      required></textarea>
            <mat-error *ngIf="meetingForm.get('description')?.hasError('required')">
              Please provide a brief description
            </mat-error>
          </mat-form-field>

          <div class="urgency-section">
            <label class="urgency-label">Urgency Level</label>
            <mat-radio-group formControlName="urgency" class="urgency-group">
              <mat-radio-button value="normal" color="primary">
                <span class="urgency-option">
                  <mat-icon>schedule</mat-icon>
                  Normal
                </span>
              </mat-radio-button>
              <mat-radio-button value="soon" color="accent">
                <span class="urgency-option">
                  <mat-icon>priority_high</mat-icon>
                  Within a week
                </span>
              </mat-radio-button>
              <mat-radio-button value="urgent" color="warn">
                <span class="urgency-option">
                  <mat-icon>warning</mat-icon>
                  Urgent
                </span>
              </mat-radio-button>
            </mat-radio-group>
          </div>

          <div class="confidential-notice">
            <mat-icon>lock</mat-icon>
            <span>This request will be treated as confidential. Only the selected person will be notified.</span>
          </div>
        </div>

        <div class="dialog-actions">
          <button mat-button type="button" (click)="close()">Cancel</button>
          <button mat-raised-button color="primary" type="submit" 
                  [disabled]="meetingForm.invalid || isSubmitting">
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
    .meeting-request-dialog {
      width: 100%;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%);
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

    .date-time-row {
      display: flex;
      gap: 16px;
    }

    .date-time-row mat-form-field {
      flex: 1;
    }

    .urgency-section {
      margin-bottom: 16px;
    }

    .urgency-label {
      display: block;
      margin-bottom: 12px;
      font-size: 0.9rem;
      color: #666;
    }

    .urgency-group {
      display: flex;
      gap: 24px;
    }

    .urgency-option {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .urgency-option mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .confidential-notice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #f3e5f5;
      border-radius: 8px;
      color: #7b1fa2;
      font-size: 0.9rem;
      line-height: 1.4;
    }

    .confidential-notice mat-icon {
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
export class PrivateMeetingRequestDialogComponent implements OnInit {
  meetingForm!: FormGroup;
  isSubmitting = false;
  minDate = new Date();

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<PrivateMeetingRequestDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.meetingForm = this.fb.group({
      meetingWith: ['', Validators.required],
      subject: ['', Validators.required],
      preferredDate: ['', Validators.required],
      preferredTime: ['', Validators.required],
      duration: ['30', Validators.required],
      description: ['', Validators.required],
      urgency: ['normal']
    });
  }

  submitRequest(): void {
    if (this.meetingForm.valid) {
      this.isSubmitting = true;
      
      // Simulate API call
      setTimeout(() => {
        this.isSubmitting = false;
        this.snackBar.open('Private meeting request submitted successfully!', 'Close', {
          duration: 3000,
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
        this.dialogRef.close(this.meetingForm.value);
      }, 1500);
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
