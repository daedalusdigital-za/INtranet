import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AnnouncementService, CreateAnnouncementDto } from '../../../services/announcement.service';

@Component({
  selector: 'app-announcement-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="announcement-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <mat-icon class="header-icon">campaign</mat-icon>
          <h2>Create Announcement</h2>
        </div>
        <button mat-icon-button (click)="onCancel()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <form [formGroup]="announcementForm" (ngSubmit)="onSubmit()">
        <div class="dialog-content">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Title</mat-label>
            <input matInput formControlName="title" placeholder="Enter announcement title" maxlength="200">
            <mat-hint align="end">{{announcementForm.get('title')?.value?.length || 0}}/200</mat-hint>
            <mat-error *ngIf="announcementForm.get('title')?.hasError('required')">
              Title is required
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Content</mat-label>
            <textarea 
              matInput 
              formControlName="content" 
              placeholder="Enter announcement content"
              rows="6"
              class="content-textarea"></textarea>
            <mat-error *ngIf="announcementForm.get('content')?.hasError('required')">
              Content is required
            </mat-error>
          </mat-form-field>

          <div class="form-row">
            <mat-form-field appearance="outline" class="form-field-half">
              <mat-label>Priority</mat-label>
              <mat-select formControlName="priority">
                <mat-option value="Low">
                  <mat-icon class="priority-icon low">arrow_downward</mat-icon>
                  Low
                </mat-option>
                <mat-option value="Normal">
                  <mat-icon class="priority-icon normal">remove</mat-icon>
                  Normal
                </mat-option>
                <mat-option value="High">
                  <mat-icon class="priority-icon high">arrow_upward</mat-icon>
                  High
                </mat-option>
                <mat-option value="Urgent">
                  <mat-icon class="priority-icon urgent">priority_high</mat-icon>
                  Urgent
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="form-field-half">
              <mat-label>Category</mat-label>
              <mat-select formControlName="category">
                <mat-option value="">None</mat-option>
                <mat-option value="General">General</mat-option>
                <mat-option value="Important">Important</mat-option>
                <mat-option value="HR">HR</mat-option>
                <mat-option value="IT">IT</mat-option>
                <mat-option value="Finance">Finance</mat-option>
                <mat-option value="Operations">Operations</mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Expires At (Optional)</mat-label>
            <input 
              matInput 
              [matDatepicker]="picker" 
              formControlName="expiresAt"
              [min]="minDate"
              placeholder="Select expiration date">
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
            <mat-hint>Leave blank for no expiration</mat-hint>
          </mat-form-field>
        </div>

        <div class="dialog-actions">
          <button 
            mat-button 
            type="button" 
            (click)="onCancel()"
            [disabled]="isSubmitting">
            Cancel
          </button>
          <button 
            mat-raised-button 
            color="primary" 
            type="submit"
            [disabled]="!announcementForm.valid || isSubmitting">
            <mat-spinner *ngIf="isSubmitting" diameter="20"></mat-spinner>
            <span *ngIf="!isSubmitting">Create Announcement</span>
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .announcement-dialog {
      width: 600px;
      max-width: 90vw;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px 24px 16px;
      border-bottom: 1px solid #e0e0e0;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-icon {
      color: #1976d2;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 500;
      color: #333;
    }

    .close-btn {
      color: #666;
    }

    .dialog-content {
      padding: 24px;
    }

    .full-width {
      width: 100%;
    }

    .form-row {
      display: flex;
      gap: 16px;
      width: 100%;
    }

    .form-field-half {
      flex: 1;
    }

    .content-textarea {
      font-family: inherit;
      resize: vertical;
      min-height: 120px;
    }

    .priority-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 8px;
      vertical-align: middle;
    }

    .priority-icon.low {
      color: #4caf50;
    }

    .priority-icon.normal {
      color: #2196f3;
    }

    .priority-icon.high {
      color: #ff9800;
    }

    .priority-icon.urgent {
      color: #f44336;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }

    .dialog-actions button mat-spinner {
      display: inline-block;
      margin-right: 8px;
    }

    mat-form-field {
      margin-bottom: 8px;
    }
  `]
})
export class AnnouncementDialogComponent implements OnInit {
  announcementForm!: FormGroup;
  isSubmitting = false;
  minDate = new Date();

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<AnnouncementDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private announcementService: AnnouncementService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.announcementForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(200)]],
      content: ['', Validators.required],
      priority: ['Normal', Validators.required],
      category: [''],
      expiresAt: [null]
    });
  }

  onSubmit(): void {
    if (this.announcementForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      const formValue = this.announcementForm.value;
      const announcement: CreateAnnouncementDto = {
        title: formValue.title,
        content: formValue.content,
        priority: formValue.priority,
        category: formValue.category || undefined,
        expiresAt: formValue.expiresAt || undefined
      };

      this.announcementService.createAnnouncement(announcement).subscribe({
        next: (result) => {
          this.snackBar.open('Announcement created successfully!', 'Close', {
            duration: 3000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['success-snackbar']
          });
          this.dialogRef.close(result);
        },
        error: (error) => {
          console.error('Error creating announcement:', error);
          this.snackBar.open('Failed to create announcement. Please try again.', 'Close', {
            duration: 5000,
            horizontalPosition: 'end',
            verticalPosition: 'top',
            panelClass: ['error-snackbar']
          });
          this.isSubmitting = false;
        }
      });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
