import { Component, Inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TenderService, ComplianceDocument } from '../../services/tender.service';
import { AuthService } from '../../services/auth.service';

interface DialogData {
  mode: 'create' | 'edit' | 'view';
  document?: ComplianceDocument;
  companies: { code: string; name: string; color: string }[];
  documentTypes: { value: string; label: string; icon: string }[];
  companyCode?: string;
  docType?: string;
}

@Component({
  selector: 'app-compliance-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatProgressBarModule,
    DatePipe
  ],
  template: `
    <div class="dialog-container">
      <div mat-dialog-title class="dialog-header">
        <h2>
          @if (data.mode === 'create') {
            Add Compliance Document
          } @else if (data.mode === 'edit') {
            Update Compliance Document
          } @else {
            Compliance Document Details
          }
        </h2>
        <button mat-icon-button (click)="dialogRef.close()"><mat-icon>close</mat-icon></button>
      </div>

      <mat-dialog-content>
        @if (data.mode === 'view' && data.document) {
          <!-- View Mode -->
          <div class="view-content">
            <div class="status-banner" [class]="data.document.computedStatus.toLowerCase()">
              @if (data.document.computedStatus === 'Valid') {
                <mat-icon>check_circle</mat-icon>
                <span>Valid - {{ data.document.daysLeft }} days remaining</span>
              } @else if (data.document.computedStatus === 'Expiring') {
                <mat-icon>schedule</mat-icon>
                <span>Expiring Soon - {{ data.document.daysLeft }} days remaining</span>
              } @else if (data.document.computedStatus === 'Warning') {
                <mat-icon>warning</mat-icon>
                <span>Warning - {{ data.document.daysLeft }} days remaining</span>
              } @else {
                <mat-icon>error</mat-icon>
                <span>Expired {{ Math.abs(data.document.daysLeft) }} days ago</span>
              }
            </div>

            <div class="info-grid">
              <div class="info-item">
                <mat-icon>business</mat-icon>
                <div>
                  <span class="label">Company</span>
                  <span class="value">
                    {{ getCompanyName(data.document.companyCode) }}
                    <span class="company-chip" [style.background-color]="getCompanyColor(data.document.companyCode)">
                      {{ data.document.companyCode }}
                    </span>
                  </span>
                </div>
              </div>

              <div class="info-item">
                <mat-icon>{{ getDocTypeIcon(data.document.documentType) }}</mat-icon>
                <div>
                  <span class="label">Document Type</span>
                  <span class="value">{{ getDocTypeLabel(data.document.documentType) }}</span>
                </div>
              </div>

              <div class="info-item">
                <mat-icon>tag</mat-icon>
                <div>
                  <span class="label">Document Number</span>
                  <span class="value">{{ data.document.documentNumber || 'N/A' }}</span>
                </div>
              </div>

              <div class="info-item">
                <mat-icon>account_balance</mat-icon>
                <div>
                  <span class="label">Issuing Authority</span>
                  <span class="value">{{ data.document.issuingAuthority || 'N/A' }}</span>
                </div>
              </div>

              <div class="info-item">
                <mat-icon>event</mat-icon>
                <div>
                  <span class="label">Issue Date</span>
                  <span class="value">{{ data.document.issueDate | date:'dd MMMM yyyy' }}</span>
                </div>
              </div>

              <div class="info-item">
                <mat-icon>event_busy</mat-icon>
                <div>
                  <span class="label">Expiry Date</span>
                  <span class="value" [class.expired]="data.document.daysLeft < 0">
                    {{ data.document.expiryDate | date:'dd MMMM yyyy' }}
                  </span>
                </div>
              </div>

              @if (data.document.fileName) {
                <div class="info-item full-width">
                  <mat-icon>attach_file</mat-icon>
                  <div>
                    <span class="label">Attached File</span>
                    <span class="value">
                      {{ data.document.fileName }}
                      <button mat-button color="primary" (click)="downloadFile()">
                        <mat-icon>download</mat-icon> Download
                      </button>
                    </span>
                  </div>
                </div>
              }

              @if (data.document.notes) {
                <div class="info-item full-width">
                  <mat-icon>notes</mat-icon>
                  <div>
                    <span class="label">Notes</span>
                    <span class="value">{{ data.document.notes }}</span>
                  </div>
                </div>
              }

              <div class="info-item">
                <mat-icon>person</mat-icon>
                <div>
                  <span class="label">Uploaded By</span>
                  <span class="value">{{ data.document.uploadedByUserName || 'Unknown' }}</span>
                </div>
              </div>

              <div class="info-item">
                <mat-icon>schedule</mat-icon>
                <div>
                  <span class="label">Uploaded At</span>
                  <span class="value">{{ data.document.uploadedAt | date:'dd MMM yyyy HH:mm' }}</span>
                </div>
              </div>
            </div>

            <!-- Expiry Progress -->
            <div class="expiry-progress">
              <h4>Document Validity</h4>
              <mat-progress-bar 
                mode="determinate" 
                [value]="getValidityPercent()"
                [color]="data.document.computedStatus === 'Valid' ? 'primary' : data.document.computedStatus === 'Expiring' ? 'accent' : 'warn'">
              </mat-progress-bar>
              <div class="progress-labels">
                <span>Issue: {{ data.document.issueDate | date:'dd MMM' }}</span>
                <span>Expiry: {{ data.document.expiryDate | date:'dd MMM' }}</span>
              </div>
            </div>

            <!-- Alert History -->
            <div class="alert-history">
              <h4>Alert Status</h4>
              <div class="alert-chips">
                <span class="alert-chip" [class.sent]="data.document.alert45DaysSent">
                  <mat-icon>{{ data.document.alert45DaysSent ? 'check' : 'schedule' }}</mat-icon>
                  45-Day Alert
                </span>
                <span class="alert-chip" [class.sent]="data.document.alert30DaysSent">
                  <mat-icon>{{ data.document.alert30DaysSent ? 'check' : 'schedule' }}</mat-icon>
                  30-Day Alert
                </span>
                <span class="alert-chip" [class.sent]="data.document.alert7DaysSent">
                  <mat-icon>{{ data.document.alert7DaysSent ? 'check' : 'schedule' }}</mat-icon>
                  7-Day Alert
                </span>
              </div>
            </div>
          </div>
        } @else {
          <!-- Create/Edit Form -->
          <form [formGroup]="complianceForm" class="compliance-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Company</mat-label>
              <mat-select formControlName="companyCode">
                @for (company of data.companies; track company.code) {
                  <mat-option [value]="company.code">
                    <span class="company-badge-sm" [style.background-color]="company.color"></span>
                    {{ company.name }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Document Type</mat-label>
              <mat-select formControlName="documentType">
                @for (type of data.documentTypes; track type.value) {
                  <mat-option [value]="type.value">
                    <mat-icon>{{ type.icon }}</mat-icon>
                    {{ type.label }}
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Document Number</mat-label>
              <input matInput formControlName="documentNumber" placeholder="e.g. CSD123456">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Issuing Authority</mat-label>
              <input matInput formControlName="issuingAuthority" placeholder="e.g. SARS, CSD, CIDB">
            </mat-form-field>

            <div class="date-row">
              <mat-form-field appearance="outline">
                <mat-label>Issue Date</mat-label>
                <input matInput [matDatepicker]="issuePicker" formControlName="issueDate">
                <mat-datepicker-toggle matSuffix [for]="issuePicker"></mat-datepicker-toggle>
                <mat-datepicker #issuePicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Expiry Date</mat-label>
                <input matInput [matDatepicker]="expiryPicker" formControlName="expiryDate">
                <mat-datepicker-toggle matSuffix [for]="expiryPicker"></mat-datepicker-toggle>
                <mat-datepicker #expiryPicker></mat-datepicker>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notes</mat-label>
              <textarea matInput formControlName="notes" rows="3"></textarea>
            </mat-form-field>

            <div class="file-upload">
              <p>Attach Document (PDF, Image)</p>
              <input type="file" #fileInput (change)="onFileSelected($event)" accept=".pdf,.jpg,.jpeg,.png">
              @if (selectedFile) {
                <div class="selected-file">
                  <mat-icon>attach_file</mat-icon>
                  <span>{{ selectedFile.name }}</span>
                  <button mat-icon-button (click)="clearFile()"><mat-icon>close</mat-icon></button>
                </div>
              }
            </div>
          </form>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close()">Close</button>
        @if (data.mode === 'view') {
          <button mat-raised-button color="primary" (click)="switchToEdit()">
            <mat-icon>edit</mat-icon> Update
          </button>
        } @else {
          <button mat-raised-button color="primary" (click)="save()" [disabled]="saving || !complianceForm.valid">
            @if (saving) {
              <mat-spinner diameter="20"></mat-spinner>
            } @else {
              <ng-container><mat-icon>save</mat-icon> {{ data.mode === 'create' ? 'Add Document' : 'Save Changes' }}</ng-container>
            }
          </button>
        }
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container { min-width: 500px; }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #E0E0E0;
    }

    mat-dialog-content {
      padding: 24px !important;
    }

    /* View Mode */
    .view-content { }

    .status-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .status-banner mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .status-banner span { font-size: 16px; font-weight: 500; }

    .status-banner.valid { background: #E8F5E9; color: #2E7D32; }
    .status-banner.expiring { background: #FFF3E0; color: #E65100; }
    .status-banner.warning { background: #FFEBEE; color: #C62828; }
    .status-banner.expired { background: #FAFAFA; color: #616161; }

    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .info-item {
      display: flex;
      align-items: flex-start;
    }
    .info-item.full-width { grid-column: 1 / -1; }
    .info-item mat-icon {
      margin-right: 12px;
      color: #666;
    }
    .info-item .label {
      display: block;
      font-size: 12px;
      color: #666;
    }
    .info-item .value {
      font-weight: 500;
    }
    .info-item .value.expired { color: #F44336; }

    .company-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      color: white;
      font-size: 11px;
      margin-left: 8px;
    }

    .expiry-progress {
      margin-top: 24px;
      padding: 16px;
      background: #FAFAFA;
      border-radius: 8px;
    }
    .expiry-progress h4 { margin: 0 0 12px 0; }
    .progress-labels {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 12px;
      color: #666;
    }

    .alert-history {
      margin-top: 24px;
    }
    .alert-history h4 { margin: 0 0 12px 0; }

    .alert-chips {
      display: flex;
      gap: 12px;
    }

    .alert-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 12px;
      background: #F5F5F5;
      border-radius: 20px;
      font-size: 12px;
      color: #666;
    }
    .alert-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .alert-chip.sent { background: #E8F5E9; color: #2E7D32; }

    /* Form */
    .compliance-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .full-width { width: 100%; }

    .date-row {
      display: flex;
      gap: 16px;
    }
    .date-row mat-form-field { flex: 1; }

    .company-badge-sm {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }

    .file-upload {
      border: 2px dashed #CCC;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .file-upload p {
      margin: 0 0 8px 0;
      color: #666;
    }

    .selected-file {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
      padding: 8px;
      background: #E3F2FD;
      border-radius: 4px;
    }

    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid #E0E0E0;
    }
  `]
})
export class ComplianceDialogComponent {
  complianceForm: FormGroup;
  saving = false;
  selectedFile: File | null = null;
  Math = Math;

  constructor(
    public dialogRef: MatDialogRef<ComplianceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private fb: FormBuilder,
    private tenderService: TenderService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {
    this.complianceForm = this.fb.group({
      companyCode: [data.companyCode || data.document?.companyCode || 'PMT', Validators.required],
      documentType: [data.docType || data.document?.documentType || 'CSD', Validators.required],
      documentNumber: [data.document?.documentNumber || ''],
      issuingAuthority: [data.document?.issuingAuthority || ''],
      issueDate: [data.document?.issueDate ? new Date(data.document.issueDate) : null, Validators.required],
      expiryDate: [data.document?.expiryDate ? new Date(data.document.expiryDate) : null, Validators.required],
      notes: [data.document?.notes || '']
    });
  }

  getCompanyName(code: string): string {
    return this.data.companies.find(c => c.code === code)?.name || code;
  }

  getCompanyColor(code: string): string {
    return this.data.companies.find(c => c.code === code)?.color || '#666';
  }

  getDocTypeLabel(type: string): string {
    return this.data.documentTypes.find(t => t.value === type)?.label || type;
  }

  getDocTypeIcon(type: string): string {
    return this.data.documentTypes.find(t => t.value === type)?.icon || 'description';
  }

  getValidityPercent(): number {
    if (!this.data.document) return 0;
    const issue = new Date(this.data.document.issueDate).getTime();
    const expiry = new Date(this.data.document.expiryDate).getTime();
    const now = new Date().getTime();
    const total = expiry - issue;
    const elapsed = now - issue;
    const remaining = 100 - (elapsed / total * 100);
    return Math.max(0, Math.min(100, remaining));
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  clearFile(): void {
    this.selectedFile = null;
  }

  downloadFile(): void {
    if (!this.data.document) return;
    this.tenderService.downloadComplianceDocument(this.data.document.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.data.document?.fileName || 'document';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('Error downloading document', 'Close', { duration: 3000 })
    });
  }

  switchToEdit(): void {
    this.data.mode = 'edit';
  }

  save(): void {
    if (!this.complianceForm.valid) return;

    this.saving = true;
    const formValue = this.complianceForm.value;
    const currentUser = this.authService.currentUserValue;

    if (this.data.mode === 'create') {
      const formData = new FormData();
      formData.append('companyCode', formValue.companyCode);
      formData.append('documentType', formValue.documentType);
      if (formValue.documentNumber) formData.append('documentNumber', formValue.documentNumber);
      if (formValue.issuingAuthority) formData.append('issuingAuthority', formValue.issuingAuthority);
      formData.append('issueDate', formValue.issueDate.toISOString());
      formData.append('expiryDate', formValue.expiryDate.toISOString());
      if (formValue.notes) formData.append('notes', formValue.notes);
      if (currentUser?.userId) formData.append('uploadedByUserId', currentUser.userId.toString());
      if (currentUser) formData.append('uploadedByUserName', `${currentUser.name} ${currentUser.surname}`);
      if (this.selectedFile) formData.append('file', this.selectedFile);

      this.tenderService.createComplianceDocument(formData).subscribe({
        next: () => {
          this.snackBar.open('Document added successfully', 'Close', { duration: 2000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving = false;
          this.snackBar.open('Error adding document', 'Close', { duration: 3000 });
        }
      });
    } else {
      this.tenderService.updateComplianceDocument(this.data.document!.id, {
        documentNumber: formValue.documentNumber,
        issuingAuthority: formValue.issuingAuthority,
        issueDate: formValue.issueDate,
        expiryDate: formValue.expiryDate,
        notes: formValue.notes
      }).subscribe({
        next: () => {
          if (this.selectedFile) {
            this.tenderService.uploadComplianceFile(this.data.document!.id, this.selectedFile).subscribe({
              next: () => {
                this.snackBar.open('Document updated successfully', 'Close', { duration: 2000 });
                this.dialogRef.close(true);
              },
              error: () => {
                this.snackBar.open('Document updated but file upload failed', 'Close', { duration: 3000 });
                this.dialogRef.close(true);
              }
            });
          } else {
            this.snackBar.open('Document updated successfully', 'Close', { duration: 2000 });
            this.dialogRef.close(true);
          }
        },
        error: () => {
          this.saving = false;
          this.snackBar.open('Error updating document', 'Close', { duration: 3000 });
        }
      });
    }
  }
}
