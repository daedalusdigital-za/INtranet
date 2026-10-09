// ============================================================
// Logistics dialog components — extracted verbatim from the
// former 36k-line logistics-dashboard.component.ts. Each dialog
// is an independent standalone component opened via MatDialog.
// Shared domain interfaces live in ./logistics.models.
// ============================================================
import { Component, OnInit, signal, computed, AfterViewInit, OnDestroy, ViewChild, ElementRef, Inject, Injector, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatStepperModule } from '@angular/material/stepper';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CdkDragDrop, CdkDrag, CdkDropList, CdkDragHandle, moveItemInArray } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, of, Subject, firstValueFrom } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { WellyActivityService } from '../../services/welly-activity.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { GoogleMapsModule } from '@angular/google-maps';
import { ControllerMonitoringComponent } from './controller-monitoring.component';
import { PumaGarageDialog } from './puma-garage-dialog.component';
import { OpenMapComponent } from './open-map.component';
import { OpenMapDialogComponent } from './open-map-dialog.component';
import { LogisticsReportsComponent } from './logistics-reports.component';
import { AssetTrackingService, ResolveResult } from '../../services/asset-tracking.service';
import { DashboardStats, ActiveLoad, Vehicle, ImportedInvoice, MaintenanceRecord, DeliveryRequest, DeliveryRequestSummary } from './logistics.models';

@Component({
  selector: 'app-upload-pod-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    FormsModule
  ],
  template: `
    <div class="upload-pod-dialog">
      <div class="dialog-header">
        <h2><mat-icon>upload_file</mat-icon> Upload Proof of Delivery</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>
      
      <div class="dialog-content">
        <div class="trip-info">
          <h3>{{ data.loadNumber }}</h3>
          <p>Upload POD document (PDF, Image, or ZIP file)</p>
        </div>

        <div class="upload-area" 
             [class.drag-over]="dragOver"
             (drop)="onDrop($event)"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (click)="fileInput.click()">
          <input #fileInput type="file" hidden 
                 accept=".pdf,.jpg,.jpeg,.png,.zip"
                 (change)="onFileSelected($event)">
          
          @if (!selectedFile) {
            <mat-icon>cloud_upload</mat-icon>
            <p>Click or drag file here</p>
            <span class="file-types">PDF, JPG, PNG, ZIP</span>
          } @else {
            <mat-icon color="primary">description</mat-icon>
            <p>{{ selectedFile.name }}</p>
            <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
            <button mat-icon-button (click)="removeFile($event)">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notes (optional)</mat-label>
          <textarea matInput [(ngModel)]="notes" rows="3" 
                    placeholder="Add any notes about the delivery..."></textarea>
        </mat-form-field>

        @if (uploading) {
          <div class="upload-progress">
            <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
            <p>Uploading...</p>
          </div>
        }

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" 
                [disabled]="!selectedFile || uploading"
                (click)="upload()">
          <mat-icon>upload</mat-icon>
          Upload POD
        </button>
      </div>
    </div>
  `,
  styles: [`
    .upload-pod-dialog {
      .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px 24px 16px;
        border-bottom: 1px solid #e0e0e0;

        h2 {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0;
          font-size: 20px;
          font-weight: 600;

          mat-icon {
            color: #1976d2;
          }
        }
      }

      .dialog-content {
        padding: 24px;

        .trip-info {
          text-align: center;
          margin-bottom: 24px;

          h3 {
            margin: 0 0 8px 0;
            color: #1a237e;
            font-size: 18px;
          }

          p {
            margin: 0;
            color: #666;
            font-size: 14px;
          }
        }

        .upload-area {
          border: 2px dashed #ccc;
          border-radius: 8px;
          padding: 40px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;
          margin-bottom: 24px;

          &:hover, &.drag-over {
            border-color: #1976d2;
            background-color: #f5f5f5;
          }

          mat-icon {
            font-size: 48px;
            width: 48px;
            height: 48px;
            margin-bottom: 12px;
          }

          p {
            margin: 8px 0;
            font-size: 16px;
            color: #333;
          }

          .file-types, .file-size {
            font-size: 12px;
            color: #999;
          }
        }

        .upload-progress {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px;

          p {
            margin: 0;
            color: #666;
          }
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background-color: #ffebee;
          border-radius: 4px;
          color: #c62828;
          margin-top: 16px;

          mat-icon {
            font-size: 20px;
            width: 20px;
            height: 20px;
          }
        }
      }

      .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 16px 24px;
        border-top: 1px solid #e0e0e0;
      }
    }
  `]
})
export class UploadPODDialog {
  selectedFile: File | null = null;
  notes = '';
  uploading = false;
  dragOver = false;
  errorMessage = '';

  constructor(
    public dialogRef: MatDialogRef<UploadPODDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.processFile(files[0]);
    }
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.processFile(file);
    }
  }

  processFile(file: File): void {
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'application/zip', 'application/x-zip-compressed'];
    if (!allowedTypes.includes(file.type)) {
      this.errorMessage = 'Invalid file type. Please upload PDF, JPG, PNG, or ZIP file.';
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      this.errorMessage = 'File size exceeds 10MB limit.';
      return;
    }

    this.selectedFile = file;
    this.errorMessage = '';
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile = null;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  upload(): void {
    if (!this.selectedFile) return;

    this.uploading = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('loadId', this.data.loadId.toString());
    if (this.notes) {
      formData.append('notes', this.notes);
    }

    const apiUrl = environment.apiUrl || 'http://localhost:5143/api';
    this.http.post(`${apiUrl}/logistics/loads/${this.data.loadId}/pod`, formData).subscribe({
      next: () => {
        this.uploading = false;
        this.dialogRef.close({ uploaded: true });
      },
      error: (err) => {
        this.uploading = false;
        this.errorMessage = err.error?.message || 'Failed to upload POD';
        console.error('POD upload failed:', err);
      }
    });
  }
}

// Upload POD Document Dialog (for standalone POD documents tab)
@Component({
  selector: 'app-upload-pod-document-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    FormsModule
  ],
  template: `
    <div class="upload-pod-doc-dialog">
      <div class="dialog-header">
        <h2><mat-icon>upload_file</mat-icon> Upload POD Document</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>
      
      <div class="dialog-content">
        @if (!uploadedPodId) {
        <div class="form-row">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Driver Name</mat-label>
            <mat-select [(ngModel)]="driverName">
              @for (d of data.drivers; track d) {
                <mat-option [value]="d">{{ d }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row two-cols">
          <mat-form-field appearance="outline">
            <mat-label>Delivery Date</mat-label>
            <input matInput [matDatepicker]="podDatePicker" [(ngModel)]="deliveryDate">
            <mat-datepicker-toggle matSuffix [for]="podDatePicker"></mat-datepicker-toggle>
            <mat-datepicker #podDatePicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Region</mat-label>
            <mat-select [(ngModel)]="region">
              <mat-option value="GP">GP - Gauteng</mat-option>
              <mat-option value="KZN">KZN - KwaZulu-Natal</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="upload-area" 
             [class.drag-over]="dragOver"
             (drop)="onDrop($event)"
             (dragover)="onDragOver($event)"
             (dragleave)="onDragLeave($event)"
             (click)="fileInput.click()">
          <input #fileInput type="file" hidden 
                 accept=".pdf,.jpg,.jpeg,.png,.xlsx"
                 (change)="onFileSelected($event)">
          
          @if (!selectedFile) {
            <mat-icon>cloud_upload</mat-icon>
            <p>Click or drag file here</p>
            <span class="file-types">PDF, JPG, PNG, XLSX</span>
          } @else {
            <mat-icon color="primary">description</mat-icon>
            <p>{{ selectedFile.name }}</p>
            <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
            <button mat-icon-button (click)="removeFile($event)"><mat-icon>close</mat-icon></button>
          }
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notes (optional)</mat-label>
          <textarea matInput [(ngModel)]="notes" rows="2" placeholder="Additional notes..."></textarea>
        </mat-form-field>

        @if (uploading) {
          <div class="upload-progress">
            <mat-progress-spinner mode="indeterminate" diameter="36"></mat-progress-spinner>
            <p>Uploading...</p>
          </div>
        }

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }
        } @else {
          <!-- ─── Welly invoice detection review ─── -->
          <div class="detect-phase">
            <div class="detect-uploaded">
              <mat-icon>check_circle</mat-icon>
              <span>POD uploaded{{ uploadedPodNumber ? ' (' + uploadedPodNumber + ')' : '' }}. Welly is now finding invoice numbers.</span>
            </div>

            @if (detecting) {
              <div class="detect-loading">
                <mat-progress-spinner mode="indeterminate" diameter="40"></mat-progress-spinner>
                <p>{{ detectStatus }}</p>
                <span class="detect-hint">Deep scan auto-rotates upside-down / sideways pages.</span>
              </div>
            } @else {
              <div class="detect-status" [class.none]="detected.length === 0">
                <mat-icon>{{ detected.length > 0 ? 'auto_awesome' : 'info' }}</mat-icon>
                <span>{{ detectStatus }}</span>
              </div>

              <div class="detect-chips">
                @for (item of detected; track item.number) {
                  <span class="inv-chip" [class.matched]="item.matched" [class.unmatched]="!item.matched"
                        [matTooltip]="item.matched ? (item.customerName || 'Matches a known invoice') : 'Not found in the system — will not be linked'">
                    <mat-icon class="chip-state">{{ item.matched ? 'verified' : 'help_outline' }}</mat-icon>
                    {{ item.number }}
                    <button class="chip-remove" (click)="removeInvoice(item)" matTooltip="Remove"><mat-icon>close</mat-icon></button>
                  </span>
                }
                @if (detected.length === 0) {
                  <span class="detect-empty">No invoice numbers yet — add them below.</span>
                }
              </div>

              <div class="detect-add">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Add invoice number</mat-label>
                  <input matInput [(ngModel)]="newInvoiceInput" placeholder="e.g. IN123456"
                         (keyup.enter)="addInvoiceNumber()">
                  <button matSuffix mat-icon-button (click)="addInvoiceNumber()" [disabled]="!newInvoiceInput.trim()">
                    <mat-icon>add</mat-icon>
                  </button>
                </mat-form-field>
              </div>

              <div class="detect-summary">
                <mat-icon>link</mat-icon>
                <span>{{ matchedCount() }} of {{ detected.length }} will be linked (matched to real invoices).</span>
              </div>

              @if (!detecting && detectRan) {
                <button mat-stroked-button class="rescan-btn" (click)="runDetection()">
                  <mat-icon>refresh</mat-icon> Re-scan document
                </button>
              }
            }

            @if (errorMessage) {
              <div class="error-message">
                <mat-icon>error</mat-icon>
                <span>{{ errorMessage }}</span>
              </div>
            }
          </div>
        }
      </div>

      <div class="dialog-actions">
        @if (!uploadedPodId) {
          <button mat-button mat-dialog-close>Cancel</button>
          <button mat-raised-button color="primary" 
                  [disabled]="!selectedFile || !driverName || !deliveryDate || !region || uploading"
                  (click)="upload()">
            <mat-icon>upload</mat-icon> Upload POD
          </button>
        } @else {
          <button mat-button (click)="skipDetection()" [disabled]="detecting || savingLinks">Skip</button>
          <button mat-raised-button color="primary"
                  [disabled]="detecting || savingLinks || matchedCount() === 0"
                  (click)="saveDetectedLinks()">
            @if (savingLinks) {
              <mat-progress-spinner mode="indeterminate" diameter="18"></mat-progress-spinner>
            } @else {
              <mat-icon>link</mat-icon>
            }
            Link {{ matchedCount() }} Invoice{{ matchedCount() === 1 ? '' : 's' }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .upload-pod-doc-dialog {
      .dialog-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 20px 24px 12px; border-bottom: 1px solid #e0e0e0;
        h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 18px; font-weight: 600;
          mat-icon { color: #1976d2; }
        }
      }
      .dialog-content {
        padding: 20px 24px;
        .form-row { margin-bottom: 8px; }
        .two-cols { display: flex; gap: 16px;
          mat-form-field { flex: 1; }
        }
        .full-width { width: 100%; }
        .upload-area {
          border: 2px dashed #ccc; border-radius: 8px; padding: 32px; text-align: center;
          cursor: pointer; margin-bottom: 16px; transition: all 0.2s;
          &:hover, &.drag-over { border-color: #1976d2; background: #f5f5f5; }
          mat-icon { font-size: 40px; width: 40px; height: 40px; margin-bottom: 8px; }
          p { margin: 6px 0; font-size: 14px; color: #333; }
          .file-types, .file-size { font-size: 12px; color: #999; }
        }
        .upload-progress { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px; p { margin: 0; color: #666; } }
        .error-message { display: flex; align-items: center; gap: 8px; padding: 10px; background: #ffebee; border-radius: 4px; color: #c62828; margin-top: 8px;
          mat-icon { font-size: 18px; width: 18px; height: 18px; }
        }
        .detect-phase {
          .detect-uploaded { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #e8f5e9;
            border-radius: 8px; color: #2e7d32; font-size: 13px; margin-bottom: 16px;
            mat-icon { color: #2e7d32; }
          }
          .detect-loading { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 12px;
            p { margin: 0; color: #444; font-size: 14px; text-align: center; }
            .detect-hint { font-size: 12px; color: #999; }
          }
          .detect-status { display: flex; align-items: flex-start; gap: 8px; padding: 8px 0; font-size: 13px; color: #333;
            mat-icon { color: #7b1fa2; font-size: 20px; width: 20px; height: 20px; }
            &.none mat-icon { color: #f9a825; }
          }
          .detect-chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; min-height: 32px;
            .detect-empty { color: #999; font-size: 13px; font-style: italic; }
            .inv-chip {
              display: inline-flex; align-items: center; gap: 4px; padding: 4px 4px 4px 8px; border-radius: 16px;
              font-size: 13px; font-family: monospace; font-weight: 600; border: 1px solid transparent;
              .chip-state { font-size: 15px; width: 15px; height: 15px; }
              .chip-remove { width: 20px; height: 20px; line-height: 20px; padding: 0;
                mat-icon { font-size: 14px; width: 14px; height: 14px; }
              }
              &.matched { background: #e3f2fd; color: #1565c0; border-color: #90caf9;
                .chip-state { color: #2e7d32; }
              }
              &.unmatched { background: #fff3e0; color: #e65100; border-color: #ffcc80;
                .chip-state { color: #ef6c00; }
              }
            }
          }
          .detect-add { margin-top: 4px; .full-width { width: 100%; } }
          .detect-summary { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #666; margin-top: 4px;
            mat-icon { font-size: 16px; width: 16px; height: 16px; color: #1976d2; }
          }
          .rescan-btn { margin-top: 12px; border-radius: 8px !important;
            mat-icon { margin-right: 4px; font-size: 18px; width: 18px; height: 18px; }
          }
        }
      }
      .dialog-actions { display: flex; justify-content: flex-end; gap: 12px; padding: 12px 24px; border-top: 1px solid #e0e0e0;
        mat-progress-spinner { display: inline-block; }
      }
    }
  `]
})
export class UploadPodDocumentDialog {
  selectedFile: File | null = null;
  driverName = '';
  deliveryDate: Date | null = null;
  region = 'GP';
  notes = '';
  uploading = false;
  dragOver = false;
  errorMessage = '';

  // ─── Post-upload Welly invoice detection ───
  uploadedPodId: number | null = null;
  uploadedPodNumber = '';
  detecting = false;
  detectStatus = '';
  detectProgress = 0;
  detected: { number: string; id: number | null; matched: boolean; customerName?: string }[] = [];
  newInvoiceInput = '';
  savingLinks = false;
  detectRan = false;

  constructor(
    public dialogRef: MatDialogRef<UploadPodDocumentDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient
  ) {}

  onDragOver(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.dragOver = true; }
  onDragLeave(e: DragEvent) { e.preventDefault(); e.stopPropagation(); this.dragOver = false; }
  
  onDrop(e: DragEvent) {
    e.preventDefault(); e.stopPropagation(); this.dragOver = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) this.processFile(files[0]);
  }

  onFileSelected(e: any) {
    const file = e.target.files[0];
    if (file) this.processFile(file);
  }

  processFile(file: File) {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowed.includes(file.type)) { this.errorMessage = 'Invalid file type.'; return; }
    if (file.size > 20 * 1024 * 1024) { this.errorMessage = 'File too large (max 20MB).'; return; }
    this.selectedFile = file;
    this.errorMessage = '';
  }

  removeFile(e: Event) { e.stopPropagation(); this.selectedFile = null; }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  get apiUrl(): string { return environment.apiUrl || 'http://localhost:5143/api'; }

  upload() {
    if (!this.selectedFile || !this.driverName || !this.deliveryDate || !this.region) return;
    this.uploading = true;
    this.errorMessage = '';

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('driverName', this.driverName);
    formData.append('region', this.region);
    formData.append('deliveryDate', this.deliveryDate.toISOString());
    if (this.notes) formData.append('notes', this.notes);

    this.http.post<any>(`${this.apiUrl}/PodDocuments/upload`, formData).subscribe({
      next: (res) => {
        this.uploading = false;
        this.uploadedPodId = res?.id ?? res?.Id ?? null;
        this.uploadedPodNumber = res?.podNumber ?? res?.PodNumber ?? '';
        // Kick off Welly detection automatically. If we can't (e.g. no id), just finish.
        if (this.uploadedPodId) {
          this.runDetection();
        } else {
          this.dialogRef.close({ uploaded: true });
        }
      },
      error: (err) => {
        this.uploading = false;
        this.errorMessage = err.error?.message || err.error || 'Upload failed';
      }
    });
  }

  /** Ask Welly (server-side OCR, auto-rotates the page) to read invoice numbers off the POD. */
  runDetection() {
    if (!this.uploadedPodId) return;
    this.detecting = true;
    this.detectRan = false;
    this.detectStatus = 'Welly is reading the document (auto-rotating & scanning)…';
    this.detectProgress = 0;

    this.http.post<any>(`${this.apiUrl}/PodDocuments/${this.uploadedPodId}/server-ocr`, {}).subscribe({
      next: (res) => {
        this.detecting = false;
        this.detectRan = true;
        const map = new Map<string, { number: string; id: number | null; matched: boolean; customerName?: string }>();
        // Matched invoices (exist in the system)
        for (const m of (res?.matches || [])) {
          const num = m.transactionNumber || m.TransactionNumber;
          if (num) map.set(num.toUpperCase(), { number: num, id: m.id ?? m.Id ?? null, matched: true, customerName: m.customerName || m.CustomerName });
        }
        // Raw candidates that didn't match a known invoice — still show them for the user to confirm/edit.
        for (const c of (res?.candidates || [])) {
          const key = (c || '').toUpperCase();
          if (key && !map.has(key)) map.set(key, { number: c, id: null, matched: false });
        }
        this.detected = Array.from(map.values());
        this.detectStatus = this.detected.length > 0
          ? `Welly detected ${this.detected.length} invoice number${this.detected.length === 1 ? '' : 's'}. Review, correct, add or remove below.`
          : 'Welly could not read any invoice numbers. Add them manually below if needed.';
      },
      error: (err) => {
        this.detecting = false;
        this.detectRan = true;
        this.detectStatus = err?.status === 503
          ? 'Auto-detection engine unavailable. Add invoice numbers manually below.'
          : 'Welly could not scan this document. Add invoice numbers manually below.';
      }
    });
  }

  addInvoiceNumber() {
    let val = (this.newInvoiceInput || '').trim().toUpperCase();
    if (!val) return;
    if (!val.startsWith('IN') && /^\d{6}$/.test(val)) val = 'IN' + val;
    if (this.detected.some(d => d.number.toUpperCase() === val)) { this.newInvoiceInput = ''; return; }
    this.detected.push({ number: val, id: null, matched: false });
    this.newInvoiceInput = '';
    // Re-validate the just-added number against real invoices.
    this.validateNumbers([val]);
  }

  removeInvoice(item: { number: string }) {
    this.detected = this.detected.filter(d => d.number !== item.number);
  }

  /** Check a set of numbers against the DB so manually-added ones get a real invoice id. */
  private validateNumbers(numbers: string[]) {
    if (numbers.length === 0) return;
    this.http.post<any>(`${this.apiUrl}/PodDocuments/match-invoice-numbers`, { candidates: numbers }).subscribe({
      next: (res) => {
        for (const m of (res?.matches || [])) {
          const num = (m.transactionNumber || m.TransactionNumber || '').toUpperCase();
          const target = this.detected.find(d => d.number.toUpperCase() === num);
          if (target) { target.id = m.id ?? m.Id ?? null; target.matched = true; target.customerName = m.customerName || m.CustomerName; }
        }
      },
      error: () => { /* leave as unmatched */ }
    });
  }

  matchedCount(): number { return this.detected.filter(d => d.matched && d.id).length; }

  /** Link the matched detected invoices to the uploaded POD, then close. */
  saveDetectedLinks() {
    const ids = this.detected.filter(d => d.matched && d.id).map(d => d.id as number);
    if (ids.length === 0) {
      // Nothing matched — just finish the upload.
      this.dialogRef.close({ uploaded: true });
      return;
    }
    this.savingLinks = true;
    this.http.put<any>(`${this.apiUrl}/PodDocuments/${this.uploadedPodId}/link-invoices`, { invoiceIds: ids }).subscribe({
      next: (res) => {
        this.savingLinks = false;
        this.dialogRef.close({ uploaded: true, linkedInvoiceCount: res?.linkedInvoiceCount ?? ids.length, loadNumber: res?.loadNumber });
      },
      error: () => {
        this.savingLinks = false;
        this.errorMessage = 'Failed to link the detected invoices.';
      }
    });
  }

  skipDetection() {
    this.dialogRef.close({ uploaded: true });
  }
}

// Link to Tripsheet Dialog
@Component({
  selector: 'app-link-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    FormsModule
  ],
  template: `
    <div class="link-tripsheet-dialog">
      <div class="dialog-header">
        <h2><mat-icon>link</mat-icon> Link to Tripsheet</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-content">
        <div class="pod-info">
          <mat-icon>picture_as_pdf</mat-icon>
          <div>
            <strong>{{ data.pod.driverName }}</strong>
            <span>{{ data.pod.deliveryDate | date:'dd MMM yyyy' }} · {{ data.pod.region }}</span>
          </div>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Search Tripsheet</mat-label>
          <input matInput [(ngModel)]="searchTerm" (ngModelChange)="searchLoads()" placeholder="Type load number or customer name...">
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>

        @if (searching) {
          <div class="search-loading">
            <mat-progress-spinner mode="indeterminate" diameter="24"></mat-progress-spinner>
            <span>Searching...</span>
          </div>
        }

        @if (searchResults.length > 0) {
          <div class="search-results">
            @for (load of searchResults; track load.id) {
              <div class="load-option" [class.selected]="selectedLoadId === load.id" (click)="selectLoad(load)">
                <div class="load-option-main">
                  <span class="load-number">{{ load.loadNumber }}</span>
                  <span class="load-status" [ngClass]="'status-' + load.status?.toLowerCase()">{{ load.status }}</span>
                </div>
                <div class="load-option-detail">
                  @if (load.customerName) { <span>{{ load.customerName }}</span> }
                  @if (load.driverName) { <span>· {{ load.driverName }}</span> }
                  @if (load.scheduledDeliveryDate) { <span>· {{ load.scheduledDeliveryDate | date:'dd MMM yyyy' }}</span> }
                </div>
              </div>
            }
          </div>
        } @else if (searchTerm && !searching) {
          <div class="no-results">
            <mat-icon>search_off</mat-icon>
            <span>No tripsheets found</span>
          </div>
        }
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="!selectedLoadId || linking" (click)="linkPod()">
          @if (linking) {
            <mat-progress-spinner mode="indeterminate" diameter="18"></mat-progress-spinner>
          } @else {
            <mat-icon>link</mat-icon>
          }
          Link
        </button>
      </div>
    </div>
  `,
  styles: [`
    .link-tripsheet-dialog {
      .dialog-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 20px 24px 12px; border-bottom: 1px solid #e0e0e0;
        h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 18px; font-weight: 600;
          mat-icon { color: #1976d2; }
        }
      }
      .dialog-content {
        padding: 20px 24px; max-height: 450px; overflow-y: auto;
        .full-width { width: 100%; }
      }
      .pod-info {
        display: flex; align-items: center; gap: 12px; padding: 12px; background: #f5f8ff;
        border-radius: 8px; margin-bottom: 16px;
        mat-icon { color: #e53935; font-size: 28px; width: 28px; height: 28px; }
        div { display: flex; flex-direction: column; gap: 2px;
          strong { font-size: 14px; color: #1a1a2e; }
          span { font-size: 12px; color: #888; }
        }
      }
      .search-loading {
        display: flex; align-items: center; gap: 8px; padding: 12px; color: #666;
      }
      .search-results {
        display: flex; flex-direction: column; gap: 4px;
      }
      .load-option {
        padding: 10px 12px; border-radius: 8px; cursor: pointer; border: 1px solid #e0e0e0;
        transition: all 0.2s;
        &:hover { border-color: #1976d2; background: #f5f8ff; }
        &.selected { border-color: #1976d2; background: #e3f2fd; }
        .load-option-main {
          display: flex; justify-content: space-between; align-items: center;
          .load-number { font-weight: 600; font-size: 14px; color: #1a1a2e; }
          .load-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500;
            &.status-available { background: #e3f2fd; color: #1565c0; }
            &.status-assigned { background: #fff3e0; color: #e65100; }
            &.status-intransit { background: #f3e5f5; color: #7b1fa2; }
            &.status-delivered { background: #e8f5e9; color: #2e7d32; }
          }
        }
        .load-option-detail { font-size: 12px; color: #888; margin-top: 4px; }
      }
      .no-results {
        display: flex; align-items: center; gap: 8px; padding: 16px; color: #999; justify-content: center;
      }
      .dialog-actions {
        display: flex; justify-content: flex-end; gap: 12px; padding: 12px 24px; border-top: 1px solid #e0e0e0;
        button mat-progress-spinner { display: inline-block; }
      }
    }
  `]
})
export class LinkTripsheetDialog {
  searchTerm = '';
  searchResults: any[] = [];
  selectedLoadId: number | null = null;
  selectedLoadNumber = '';
  searching = false;
  linking = false;
  private searchTimeout: any;

  constructor(
    public dialogRef: MatDialogRef<LinkTripsheetDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient
  ) {
    // Load recent tripsheets on open
    this.searchLoads();
  }

  searchLoads(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.searching = true;
      const apiUrl = environment.apiUrl || 'http://localhost:5143/api';
      const params = this.searchTerm ? `?search=${encodeURIComponent(this.searchTerm)}&limit=20` : '?limit=20';
      this.http.get<any[]>(`${apiUrl}/PodDocuments/search-loads${params}`).subscribe({
        next: (results) => {
          this.searchResults = results;
          this.searching = false;
        },
        error: () => {
          this.searchResults = [];
          this.searching = false;
        }
      });
    }, 300);
  }

  selectLoad(load: any): void {
    this.selectedLoadId = load.id;
    this.selectedLoadNumber = load.loadNumber;
  }

  linkPod(): void {
    if (!this.selectedLoadId) return;
    this.linking = true;
    const apiUrl = environment.apiUrl || 'http://localhost:5143/api';
    this.http.put(`${apiUrl}/PodDocuments/${this.data.pod.id}/link`, { loadId: this.selectedLoadId }).subscribe({
      next: () => {
        this.linking = false;
        this.dialogRef.close({ linked: true, loadNumber: this.selectedLoadNumber });
      },
      error: (err) => {
        this.linking = false;
        console.error('Failed to link POD:', err);
      }
    });
  }
}

// Edit POD Details Dialog
@Component({
  selector: 'app-edit-pod-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatProgressSpinnerModule,
    FormsModule
  ],
  template: `
    <div class="edit-pod-dialog">
      <div class="dialog-header">
        <h2><mat-icon>edit</mat-icon> Edit POD Details</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-content">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Driver Name</mat-label>
          <mat-select [(ngModel)]="driverName">
            @for (d of data.drivers; track d) {
              <mat-option [value]="d">{{ d }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="form-row two-cols">
          <mat-form-field appearance="outline">
            <mat-label>Delivery Date</mat-label>
            <input matInput [matDatepicker]="editDatePicker" [(ngModel)]="deliveryDate">
            <mat-datepicker-toggle matSuffix [for]="editDatePicker"></mat-datepicker-toggle>
            <mat-datepicker #editDatePicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Region</mat-label>
            <mat-select [(ngModel)]="region">
              <mat-option value="GP">GP - Gauteng</mat-option>
              <mat-option value="KZN">KZN - KwaZulu-Natal</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notes</mat-label>
          <textarea matInput [(ngModel)]="notes" rows="3" placeholder="Additional notes..."></textarea>
        </mat-form-field>
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="saving" (click)="save()">
          @if (saving) {
            <mat-progress-spinner mode="indeterminate" diameter="18"></mat-progress-spinner>
          } @else {
            <mat-icon>save</mat-icon>
          }
          Save Changes
        </button>
      </div>
    </div>
  `,
  styles: [`
    .edit-pod-dialog {
      .dialog-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 20px 24px 12px; border-bottom: 1px solid #e0e0e0;
        h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 18px; font-weight: 600;
          mat-icon { color: #1976d2; }
        }
      }
      .dialog-content {
        padding: 20px 24px;
        .full-width { width: 100%; }
        .form-row.two-cols { display: flex; gap: 16px;
          mat-form-field { flex: 1; }
        }
      }
      .dialog-actions {
        display: flex; justify-content: flex-end; gap: 12px; padding: 12px 24px; border-top: 1px solid #e0e0e0;
        button mat-progress-spinner { display: inline-block; }
      }
    }
  `]
})
export class EditPodDialog {
  driverName: string;
  deliveryDate: Date;
  region: string;
  notes: string;
  saving = false;

  constructor(
    public dialogRef: MatDialogRef<EditPodDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient
  ) {
    this.driverName = data.pod.driverName || '';
    this.deliveryDate = data.pod.deliveryDate ? new Date(data.pod.deliveryDate) : new Date();
    this.region = data.pod.region || 'GP';
    this.notes = data.pod.notes || '';
  }

  save(): void {
    this.saving = true;
    const apiUrl = environment.apiUrl || 'http://localhost:5143/api';
    this.http.put(`${apiUrl}/PodDocuments/${this.data.pod.id}`, {
      driverName: this.driverName,
      deliveryDate: this.deliveryDate,
      region: this.region,
      notes: this.notes
    }).subscribe({
      next: () => {
        this.saving = false;
        this.dialogRef.close({ updated: true });
      },
      error: (err) => {
        this.saving = false;
        console.error('Failed to update POD:', err);
      }
    });
  }
}

// Link to Invoice Dialog
@Component({
  selector: 'app-link-invoice-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    FormsModule
  ],
  template: `
    <div class="link-invoice-dialog">
      <div class="dialog-header">
        <h2><mat-icon>receipt</mat-icon> Link to Invoice(s)</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-content">
        <div class="pod-info">
          <mat-icon>picture_as_pdf</mat-icon>
          <div>
            <strong>{{ data.pod.driverName }}</strong>
            <span>{{ data.pod.deliveryDate | date:'dd MMM yyyy' }} · {{ data.pod.region }}</span>
          </div>
        </div>

        <div class="link-note">
          <mat-icon>info</mat-icon>
          <span>Select one or more invoices to link. Linked invoices will be marked as <strong>Delivered</strong>.</span>
        </div>

        @if (selectedInvoiceIds.size > 0) {
          <div class="selected-count">
            <mat-icon>check_circle</mat-icon>
            <span>{{ selectedInvoiceIds.size }} invoice(s) selected</span>
          </div>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Search Invoice</mat-label>
          <input matInput [(ngModel)]="searchTerm" (ngModelChange)="searchInvoices()" placeholder="Type invoice number or customer name...">
          <mat-icon matPrefix>search</mat-icon>
        </mat-form-field>

        @if (searching) {
          <div class="search-loading">
            <mat-progress-spinner mode="indeterminate" diameter="24"></mat-progress-spinner>
            <span>Searching...</span>
          </div>
        }

        @if (searchResults.length > 0) {
          <div class="search-results">
            @for (inv of searchResults; track inv.id) {
              <div class="invoice-option" [class.selected]="isSelected(inv.id)" (click)="toggleInvoice(inv)">
                <div class="invoice-selection-checkbox">
                  <mat-icon>{{ isSelected(inv.id) ? 'check_box' : 'check_box_outline_blank' }}</mat-icon>
                </div>
                <div class="invoice-option-content">
                  <div class="invoice-option-main">
                    <span class="invoice-number">{{ inv.transactionNumber }}</span>
                    <span class="invoice-status" [ngClass]="'status-' + inv.status?.toLowerCase()">{{ inv.status }}</span>
                  </div>
                  <div class="invoice-option-detail">
                    <span class="invoice-customer">{{ inv.customerName }}</span>
                    <span class="invoice-amount">R{{ inv.salesAmount | number:'1.2-2' }}</span>
                  </div>
                  <div class="invoice-option-sub">
                    <span>{{ inv.productDescription }}</span>
                    <span>Qty: {{ inv.quantity | number:'1.0-0' }}</span>
                    @if (inv.transactionDate) { <span>{{ inv.transactionDate | date:'dd MMM yyyy' }}</span> }
                  </div>
                </div>
              </div>
            }
          </div>
        } @else if (searchTerm && !searching) {
          <div class="no-results">
            <mat-icon>search_off</mat-icon>
            <span>No invoices found</span>
          </div>
        }
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="selectedInvoiceIds.size === 0 || linking" (click)="linkInvoice()">
          @if (linking) {
            <mat-progress-spinner mode="indeterminate" diameter="18"></mat-progress-spinner>
          } @else {
            <mat-icon>receipt</mat-icon>
          }
          Link {{ selectedInvoiceIds.size > 0 ? selectedInvoiceIds.size : '' }} Invoice(s)
        </button>
      </div>
    </div>
  `,
  styles: [`
    .link-invoice-dialog {
      .dialog-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 20px 24px 12px; border-bottom: 1px solid #e0e0e0;
        h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 18px; font-weight: 600;
          mat-icon { color: #283593; }
        }
      }
      .dialog-content {
        padding: 20px 24px; max-height: 500px; overflow-y: auto;
        .full-width { width: 100%; }
      }
      .pod-info {
        display: flex; align-items: center; gap: 12px; padding: 12px; background: #f5f8ff;
        border-radius: 8px; margin-bottom: 12px;
        mat-icon { color: #e53935; font-size: 28px; width: 28px; height: 28px; }
        div { display: flex; flex-direction: column; gap: 2px;
          strong { font-size: 14px; color: #1a1a2e; }
          span { font-size: 12px; color: #888; }
        }
      }
      .link-note {
        display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #e8eaf6;
        border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #283593;
        mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      }
      .selected-count {
        display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: #e8f5e9;
        border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: #2e7d32; font-weight: 600;
        mat-icon { font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }
      }
      .search-loading {
        display: flex; align-items: center; gap: 8px; padding: 12px; color: #666;
      }
      .search-results {
        display: flex; flex-direction: column; gap: 4px;
      }
      .invoice-option {
        display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; 
        cursor: pointer; border: 1px solid #e0e0e0; transition: all 0.2s;
        &:hover { border-color: #283593; background: #f5f6ff; }
        &.selected { border-color: #283593; background: #e8eaf6; 
          .invoice-selection-checkbox mat-icon { color: #283593; }
        }
        .invoice-selection-checkbox {
          mat-icon { font-size: 22px; width: 22px; height: 22px; color: #999; }
        }
        .invoice-option-content {
          flex: 1;
          .invoice-option-main {
            display: flex; justify-content: space-between; align-items: center;
            .invoice-number { font-weight: 600; font-size: 14px; color: #1a1a2e; }
            .invoice-status { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500;
              &.status-pending { background: #fff3e0; color: #e65100; }
              &.status-assigned { background: #e3f2fd; color: #1565c0; }
              &.status-inprogress { background: #f3e5f5; color: #7b1fa2; }
              &.status-delivered { background: #e8f5e9; color: #2e7d32; }
            }
          }
          .invoice-option-detail {
            display: flex; justify-content: space-between; align-items: center; margin-top: 4px;
            .invoice-customer { font-size: 13px; color: #333; }
            .invoice-amount { font-size: 13px; font-weight: 600; color: #2e7d32; }
          }
          .invoice-option-sub { font-size: 11px; color: #999; margin-top: 2px; display: flex; gap: 8px; }
        }
      }
      .no-results {
        display: flex; align-items: center; gap: 8px; padding: 16px; color: #999; justify-content: center;
      }
      .dialog-actions {
        display: flex; justify-content: flex-end; gap: 12px; padding: 12px 24px; border-top: 1px solid #e0e0e0;
        button mat-progress-spinner { display: inline-block; }
      }
    }
  `]
})
export class LinkInvoiceDialog {
  searchTerm = '';
  searchResults: any[] = [];
  selectedInvoiceIds: Set<number> = new Set();
  selectedInvoiceNumbers: string[] = [];
  searching = false;
  linking = false;
  private searchTimeout: any;

  constructor(
    public dialogRef: MatDialogRef<LinkInvoiceDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient
  ) {
    // Load recent invoices on open and initialize with existing links
    if (this.data.pod.invoiceLinks && this.data.pod.invoiceLinks.length > 0) {
      this.data.pod.invoiceLinks.forEach((link: any) => {
        this.selectedInvoiceIds.add(link.invoiceId);
        if (link.invoiceNumber) {
          this.selectedInvoiceNumbers.push(link.invoiceNumber);
        }
      });
    }
    this.searchInvoices();
  }

  searchInvoices(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.searching = true;
      const apiUrl = environment.apiUrl || 'http://localhost:5143/api';
      const params = this.searchTerm ? `?search=${encodeURIComponent(this.searchTerm)}&limit=20` : '?limit=20';
      this.http.get<any[]>(`${apiUrl}/PodDocuments/search-invoices${params}`).subscribe({
        next: (results) => {
          this.searchResults = results;
          this.searching = false;
        },
        error: () => {
          this.searchResults = [];
          this.searching = false;
        }
      });
    }, 300);
  }

  toggleInvoice(inv: any): void {
    if (this.selectedInvoiceIds.has(inv.id)) {
      this.selectedInvoiceIds.delete(inv.id);
      this.selectedInvoiceNumbers = this.selectedInvoiceNumbers.filter(n => n !== inv.transactionNumber);
    } else {
      this.selectedInvoiceIds.add(inv.id);
      this.selectedInvoiceNumbers.push(inv.transactionNumber);
    }
  }

  isSelected(invoiceId: number): boolean {
    return this.selectedInvoiceIds.has(invoiceId);
  }

  linkInvoice(): void {
    if (this.selectedInvoiceIds.size === 0) return;
    this.linking = true;
    const apiUrl = environment.apiUrl || 'http://localhost:5143/api';
    const invoiceIds = Array.from(this.selectedInvoiceIds);
    this.http.put(`${apiUrl}/PodDocuments/${this.data.pod.id}/link-invoices`, { invoiceIds }).subscribe({
      next: (response: any) => {
        this.linking = false;
        this.dialogRef.close({ 
          linked: true, 
          linkedInvoiceCount: response.linkedInvoiceCount,
          invoiceNumbers: response.invoiceNumbers 
        });
      },
      error: (err) => {
        this.linking = false;
        console.error('Failed to link invoices:', err);
      }
    });
  }
}

// Invoice Details Dialog Component
@Component({
  selector: 'app-invoice-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  template: `
    <div class="invoice-details-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>receipt_long</mat-icon>
          Invoice Details
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="invoice-content">
        <div class="invoice-header-info">
          <div class="invoice-number">
            <span class="label">Invoice #</span>
            <span class="value">{{ data.transactionNumber }}</span>
          </div>
          <div class="invoice-status" [ngClass]="getStatusClass()">
            {{ data.status }}
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>calendar_today</mat-icon> Transaction Info</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">Date</span>
              <span class="value">{{ data.transactionDate | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Type</span>
              <span class="value">{{ data.transactionType }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Year/Period</span>
              <span class="value">{{ data.year }}/{{ data.period }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Category</span>
              <span class="value">{{ data.category }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Location</span>
              <span class="value">{{ data.location }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Source</span>
              <span class="value">{{ data.sourceSystem || 'N/A' }}</span>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>business</mat-icon> Customer</h3>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <span class="label">Customer Name</span>
              <span class="value">{{ data.customerName }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Customer Code</span>
              <span class="value">{{ data.customerNumber }}</span>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>inventory_2</mat-icon> Product</h3>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <span class="label">Description</span>
              <span class="value">{{ data.productDescription }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Product Code</span>
              <span class="value">{{ data.productCode }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Quantity</span>
              <span class="value">{{ data.quantity | number:'1.0-0' }}</span>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>attach_money</mat-icon> Financials</h3>
          <div class="financial-summary">
            <div class="financial-item">
              <span class="label">Sales Amount (excl. VAT)</span>
              <span class="value">R{{ data.salesAmount | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">VAT (15%)</span>
              <span class="value">R{{ data.salesAmount * 0.15 | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">Total (incl. VAT)</span>
              <span class="value sales">R{{ data.salesAmount * 1.15 | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">Cost of Sales</span>
              <span class="value cost">R{{ data.costOfSales | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">Gross Profit</span>
              <span class="value profit">R{{ data.grossProfit | number:'1.2-2' }}</span>
            </div>
            <div class="financial-item">
              <span class="label">Margin</span>
              <span class="value margin" [class.positive]="data.marginPercent > 0" [class.negative]="data.marginPercent < 0">
                {{ data.marginPercent | number:'1.2-2' }}%
              </span>
            </div>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>location_on</mat-icon> Delivery Information</h3>
          <div class="detail-grid">
            <div class="detail-item full-width">
              <span class="label">Address</span>
              <span class="value">{{ data.deliveryAddress || 'Not set' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">City</span>
              <span class="value">{{ data.deliveryCity || 'Not set' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Province</span>
              <span class="value">{{ data.deliveryProvince || 'Not set' }}</span>
            </div>
          </div>
        </div>

        @if (data.loadNumber) {
          <mat-divider></mat-divider>
          <div class="detail-section">
            <h3><mat-icon>local_shipping</mat-icon> Assignment</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="label">Load Number</span>
                <span class="value">{{ data.loadNumber }}</span>
              </div>
            </div>
          </div>
        }

        <mat-divider></mat-divider>

        <div class="detail-section">
          <h3><mat-icon>info</mat-icon> Import Info</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">Imported At</span>
              <span class="value">{{ data.importedAt | date:'dd/MM/yyyy HH:mm' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Batch ID</span>
              <span class="value">{{ data.importBatchId || 'N/A' }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Close</button>
      </div>
    </div>
  `,
  styles: [`
    .invoice-details-dialog {
      padding: 0;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1976d2, #1565c0);
      color: white;
    }

    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
    }

    .dialog-header button {
      color: white;
    }

    .invoice-content {
      padding: 24px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .invoice-header-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .invoice-number .label {
      display: block;
      font-size: 12px;
      color: #666;
    }

    .invoice-number .value {
      font-size: 24px;
      font-weight: 600;
      color: #1976d2;
    }

    .invoice-status {
      padding: 6px 16px;
      border-radius: 20px;
      font-weight: 500;
      font-size: 14px;
    }

    .invoice-status.status-pending {
      background: #fff3e0;
      color: #f57c00;
    }

    .invoice-status.status-assigned {
      background: #e3f2fd;
      color: #1976d2;
    }

    .invoice-status.status-delivered {
      background: #e8f5e9;
      color: #388e3c;
    }

    .detail-section {
      margin: 20px 0;
    }

    .detail-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
    }

    .detail-section h3 mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
    }

    .detail-item.full-width {
      grid-column: 1 / -1;
    }

    .detail-item .label {
      font-size: 12px;
      color: #999;
      margin-bottom: 2px;
    }

    .detail-item .value {
      font-size: 14px;
      color: #333;
      font-weight: 500;
    }

    .financial-summary {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .financial-item {
      background: #f5f5f5;
      padding: 12px 16px;
      border-radius: 8px;
      text-align: center;
    }

    .financial-item .label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }

    .financial-item .value {
      font-size: 18px;
      font-weight: 600;
    }

    .financial-item .value.sales {
      color: #1976d2;
    }

    .financial-item .value.cost {
      color: #f57c00;
    }

    .financial-item .value.profit {
      color: #388e3c;
    }

    .financial-item .value.margin.positive {
      color: #388e3c;
    }

    .financial-item .value.margin.negative {
      color: #d32f2f;
    }

    .dialog-actions {
      padding: 16px 24px;
      display: flex;
      justify-content: flex-end;
      border-top: 1px solid #eee;
    }

    mat-divider {
      margin: 16px 0;
    }
  `]
})
export class InvoiceDetailsDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<InvoiceDetailsDialog>
  ) {}

  getStatusClass(): string {
    switch (this.data.status?.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'assigned': return 'status-assigned';
      case 'delivered': return 'status-delivered';
      default: return '';
    }
  }
}

// Fleet Map Dialog Component
@Component({
  selector: 'app-fleet-map-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    FormsModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="map-dialog">
      <div class="map-header">
        <h2>
          <mat-icon>map</mat-icon>
          Live Fleet Tracking
        </h2>
        <div class="header-controls">
          <mat-form-field appearance="outline" class="vehicle-select">
            <mat-label>Focus Vehicle</mat-label>
            <mat-select [(ngModel)]="selectedVehicle" (selectionChange)="focusOnVehicle()">
              <mat-option [value]="null">All Vehicles</mat-option>
              @for (v of data.vehicles; track $index) {
                <mat-option [value]="v">{{ v.registrationNumber }} {{ v.speed ? '(' + v.speed + ' km/h)' : '' }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <button mat-raised-button color="primary" 
                  (click)="findNearestTfnDepot()" 
                  [disabled]="!selectedVehicle || !selectedVehicle.latitude"
                  matTooltip="Find nearest TFN depot to selected vehicle"
                  class="nearest-tfn-btn">
            <mat-icon>local_shipping</mat-icon>
            Nearest TFN
          </button>
          <button mat-raised-button color="accent"
                  (click)="printMap()"
                  matTooltip="Print the current map view"
                  class="print-map-btn">
            <mat-icon>print</mat-icon>
            Print
          </button>
          <button mat-icon-button (click)="refreshMap()" matTooltip="Refresh">
            <mat-icon>refresh</mat-icon>
          </button>
          <button mat-icon-button mat-dialog-close matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <div class="map-content">
        <div class="vehicle-sidebar">
          <h3>Vehicles ({{ filteredVehicles.length }}<span *ngIf="filteredVehicles.length !== data.vehicles.length"> of {{ data.vehicles.length }}</span>)</h3>
          <div class="vehicle-search">
            <mat-icon>search</mat-icon>
            <input type="text" [(ngModel)]="vehicleSearch"
                   placeholder="Search reg, driver, location..." aria-label="Search vehicles" />
            @if (vehicleSearch) {
              <button type="button" class="clear-search" (click)="vehicleSearch = ''" aria-label="Clear search">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>
          <div class="vehicle-list">
            @for (vehicle of filteredVehicles; track $index) {
              <div class="sidebar-vehicle" 
                   [class.selected]="selectedVehicle === vehicle"
                   [class.moving]="vehicle.speed && vehicle.speed > 0"
                   [class.offline]="vehicle.status === 'offline'"
                   (click)="selectVehicle(vehicle)">
                <div class="vehicle-icon">
                  <mat-icon>{{ vehicle.speed && vehicle.speed > 0 ? 'local_shipping' : 'local_parking' }}</mat-icon>
                </div>
                <div class="vehicle-details">
                  <strong>{{ vehicle.registrationNumber }}</strong>
                  <span class="driver">{{ vehicle.currentDriver || 'No driver' }}</span>
                  <span class="status-info">
                    @if (vehicle.speed !== undefined) {
                      <mat-chip class="speed-chip" [class.moving]="vehicle.speed > 0">
                        {{ vehicle.speed }} km/h
                      </mat-chip>
                    }
                  </span>
                  <span class="location">{{ vehicle.lastLocation || 'Unknown location' }}</span>
                </div>
              </div>
            }
            @if (filteredVehicles.length === 0) {
              <div class="no-vehicles-found">
                <mat-icon>search_off</mat-icon>
                <span>No vehicles match “{{ vehicleSearch }}”</span>
              </div>
            }
          </div>
        </div>

        <div class="map-container">
          @if (mapLoading) {
            <div class="map-loading">
              <mat-spinner diameter="50"></mat-spinner>
              <p>Loading map...</p>
            </div>
          }
          <div #mapElement class="google-map" [style.opacity]="mapLoading ? 0 : 1"></div>
        </div>
      </div>

      <div class="map-footer">
        <div class="legend">
          <span class="legend-item"><span class="dot moving"></span> Moving</span>
          <span class="legend-item"><span class="dot stopped"></span> Stopped</span>
          <span class="legend-item"><span class="dot offline"></span> Offline</span>
        </div>
        <span class="last-update">Last updated: {{ lastUpdate | date:'HH:mm:ss' }}</span>
      </div>
    </div>
  `,
  styles: [`
    .map-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
    }

    .map-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      color: white;
    }

    .map-header h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    .header-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .vehicle-select {
      width: 220px;
    }

    .vehicle-select ::ng-deep .mat-mdc-text-field-wrapper {
      background: rgba(255,255,255,0.9);
      border-radius: 4px;
    }

    .nearest-tfn-btn {
      background: #ff9800 !important;
      color: white !important;
      font-size: 12px;
      height: 36px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .nearest-tfn-btn:disabled {
      background: rgba(255, 255, 255, 0.3) !important;
      color: rgba(255, 255, 255, 0.5) !important;
    }

    .nearest-tfn-btn mat-icon {
      font-size: 18px;
      height: 18px;
      width: 18px;
    }

    .print-map-btn {
      background: #1976d2 !important;
      color: white !important;
      font-size: 12px;
      height: 36px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .print-map-btn mat-icon {
      font-size: 18px;
      height: 18px;
      width: 18px;
    }

    .header-controls button {
      color: white;
    }

    .map-content {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .vehicle-sidebar {
      width: 300px;
      background: #f5f5f5;
      border-right: 1px solid #ddd;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .vehicle-sidebar h3 {
      padding: 16px;
      margin: 0;
      background: #e3e3e3;
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .vehicle-search {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
    }
    .vehicle-search mat-icon {
      font-size: 18px; width: 18px; height: 18px; color: #90a4ae; flex-shrink: 0;
    }
    .vehicle-search input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 13px; color: #263238; min-width: 0;
    }
    .vehicle-search input::placeholder { color: #b0bec5; }
    .vehicle-search .clear-search {
      border: none; background: transparent; cursor: pointer; padding: 0;
      display: flex; align-items: center; color: #90a4ae;
    }
    .vehicle-search .clear-search mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .vehicle-search .clear-search:hover { color: #546e7a; }

    .no-vehicles-found {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px; padding: 32px 16px; color: #90a4ae; text-align: center; font-size: 13px;
    }
    .no-vehicles-found mat-icon { font-size: 32px; width: 32px; height: 32px; opacity: .6; }

    .vehicle-list {
      flex: 1;
      overflow-y: auto;
    }

    .sidebar-vehicle {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid #e0e0e0;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .sidebar-vehicle:hover {
      background: #e3f2fd;
    }

    .sidebar-vehicle.selected {
      background: #bbdefb;
      border-left: 4px solid #1976d2;
    }

    .sidebar-vehicle.moving .vehicle-icon {
      color: #4caf50;
    }

    .sidebar-vehicle.offline .vehicle-icon {
      color: #f44336;
    }

    .vehicle-icon {
      color: #ff9800;
    }

    .vehicle-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .vehicle-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    .vehicle-details strong {
      font-size: 14px;
      color: #333;
    }

    .vehicle-details .driver {
      font-size: 12px;
      color: #666;
    }

    .vehicle-details .location {
      font-size: 11px;
      color: #999;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .status-info {
      display: flex;
      gap: 4px;
      margin: 4px 0;
    }

    .speed-chip {
      font-size: 10px !important;
      min-height: 20px !important;
      padding: 0 8px !important;
    }

    .speed-chip.moving {
      background: #e8f5e9 !important;
      color: #2e7d32 !important;
    }

    .map-container {
      flex: 1;
      position: relative;
      background: #e0e0e0;
    }

    .map-loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      z-index: 10;
    }

    .google-map {
      width: 100%;
      height: 100%;
      transition: opacity 0.3s ease;
    }

    .map-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 24px;
      background: #f5f5f5;
      border-top: 1px solid #ddd;
    }

    .legend {
      display: flex;
      gap: 24px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #666;
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .dot.moving {
      background: #4caf50;
    }

    .dot.stopped {
      background: #ff9800;
    }

    .dot.offline {
      background: #f44336;
    }

    .last-update {
      font-size: 12px;
      color: #999;
    }

    @media (max-width: 768px) {
      .vehicle-sidebar {
        display: none;
      }
    }
  `]
})
export class FleetMapDialogComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapElement') mapElement!: ElementRef;
  
  selectedVehicle: Vehicle | null = null;
  mapLoading = true;
  lastUpdate = new Date();
  vehicleSearch = '';

  /** Vehicles filtered by the sidebar search box (reg, driver, location). */
  get filteredVehicles(): Vehicle[] {
    const q = this.vehicleSearch.trim().toLowerCase();
    if (!q) return this.data.vehicles;
    return this.data.vehicles.filter(v =>
      (v.registrationNumber || '').toLowerCase().includes(q) ||
      (v.currentDriver || '').toLowerCase().includes(q) ||
      (v.lastLocation || '').toLowerCase().includes(q)
    );
  }
  
  private map: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private speedRings: google.maps.Marker[] = [];  // speedometer gauge rings behind vehicle markers
  private readonly maxSpeedKmh = 120;             // full-scale of the gauge
  private infoWindow: google.maps.InfoWindow | null = null;
  private mapInitialized = false;
  private depotMarker: google.maps.Marker | null = null;
  private depotLine: google.maps.Polyline | null = null;
  private depotDirectionsRenderer: google.maps.DirectionsRenderer | null = null;
  private lastDepotInfo: any = null;

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    public dialogRef: MatDialogRef<FleetMapDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicles: Vehicle[], focusVehicle?: Vehicle }
  ) {
    if (data.focusVehicle) {
      this.selectedVehicle = data.focusVehicle;
    }
  }

  ngAfterViewInit(): void {
    this.loadGoogleMapsScript();
  }

  ngOnDestroy(): void {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    if (this.infoWindow) {
      this.infoWindow.close();
    }
    if (this.depotMarker) {
      this.depotMarker.setMap(null);
    }
    if (this.depotLine) {
      this.depotLine.setMap(null);
    }
  }

  private loadGoogleMapsScript(): void {
    const apiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
    
    if (typeof google !== 'undefined' && google.maps) {
      this.initializeMap();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + apiKey + '&callback=initFleetMap';
    script.async = true;
    script.defer = true;
    
    (window as any).initFleetMap = () => {
      this.initializeMap();
    };
    
    document.head.appendChild(script);
  }

  private initializeMap(): void {
    if (this.mapInitialized || !this.mapElement?.nativeElement) return;
    
    // Default center (South Africa)
    const defaultCenter = { lat: -26.2041, lng: 28.0473 };
    
    this.map = new google.maps.Map(this.mapElement.nativeElement, {
      zoom: 6,
      center: defaultCenter,
      mapTypeId: 'roadmap',
      mapTypeControl: true,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scaleControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    } as any);

    this.infoWindow = new google.maps.InfoWindow();
    this.mapInitialized = true;
    this.mapLoading = false;
    
    this.addVehicleMarkers();
    
    if (this.selectedVehicle) {
      setTimeout(() => this.focusOnVehicle(), 500);
    }
  }

  private addVehicleMarkers(): void {
    if (!this.map) return;

    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    this.speedRings.forEach(r => r.setMap(null));
    this.speedRings = [];
    
    const bounds = new google.maps.LatLngBounds();
    let hasValidLocations = false;

    this.data.vehicles.forEach(vehicle => {
      if (vehicle.latitude && vehicle.longitude) {
        hasValidLocations = true;
        const position = { lat: vehicle.latitude, lng: vehicle.longitude };
        bounds.extend(position);

        const isMoving = vehicle.speed && vehicle.speed > 0;
        const isOffline = vehicle.status === 'offline';

        // Speedometer gauge ring drawn beneath the vehicle marker.
        const ring = new google.maps.Marker({
          position,
          map: this.map,
          clickable: false,
          zIndex: 1,
          icon: {
            url: this.buildSpeedRingSvg(vehicle.speed || 0, isOffline),
            scaledSize: new google.maps.Size(46, 46),
            anchor: new google.maps.Point(23, 23)
          }
        });
        this.speedRings.push(ring);

        const marker = new google.maps.Marker({
          position,
          map: this.map,
          title: vehicle.registrationNumber,
          zIndex: 2,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: isMoving ? 8 : 6,
            fillColor: isOffline ? '#f44336' : (isMoving ? '#4caf50' : '#ff9800'),
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            rotation: 0
          },
          animation: isMoving ? google.maps.Animation.BOUNCE : undefined
        });

        // Stop bounce animation after 2 seconds
        if (isMoving) {
          setTimeout(() => marker.setAnimation(null), 2000);
        }

        marker.addListener('click', () => {
          this.showVehicleInfo(vehicle, marker);
        });

        this.markers.push(marker);
      }
    });

    if (hasValidLocations && this.markers.length > 1 && !this.selectedVehicle) {
      this.map.fitBounds(bounds, 50);
    } else if (hasValidLocations && this.markers.length === 1) {
      this.map.setCenter(this.markers[0].getPosition()!);
      this.map.setZoom(14);
    }
  }

  /**
   * Builds a speedometer-style gauge ring as an SVG data-URL: a 270° track with
   * a coloured arc that fills in proportion to speed (green → amber → red).
   * Fixed pixel size so it reads clearly at any zoom for every vehicle.
   */
  private buildSpeedRingSvg(speedKmh: number, offline: boolean): string {
    const size = 46, cx = 23, cy = 23, r = 18;
    const startDeg = 135, sweep = 270;                 // gap at the bottom
    const speed = Math.max(0, speedKmh || 0);
    const frac = Math.min(speed / this.maxSpeedKmh, 1);
    const endDeg = startDeg + sweep * frac;

    let arcColor = '#22c55e';                          // green  ≤ 40
    if (speed > 80) arcColor = '#ef4444';              // red    > 80
    else if (speed > 40) arcColor = '#f59e0b';         // amber  40–80
    if (offline) arcColor = '#94a3b8';

    const polar = (deg: number) => {
      const rad = (deg * Math.PI) / 180;
      return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    };
    const arcPath = (a0: number, a1: number) => {
      const s = polar(a0), e = polar(a1);
      const large = (a1 - a0) > 180 ? 1 : 0;
      return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
    };

    const track = arcPath(startDeg, startDeg + sweep);
    const fill = speed > 0 ? arcPath(startDeg, endDeg) : '';
    const tip = polar(endDeg);

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <path d="${track}" fill="none" stroke="#0f172a" stroke-opacity="0.25" stroke-width="4" stroke-linecap="round"/>
      ${fill ? `<path d="${fill}" fill="none" stroke="${arcColor}" stroke-width="4" stroke-linecap="round"/>` : ''}
      ${speed > 0 ? `<circle cx="${tip.x.toFixed(2)}" cy="${tip.y.toFixed(2)}" r="2.6" fill="${arcColor}" stroke="#ffffff" stroke-width="1"/>` : ''}
    </svg>`;

    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }


  private showVehicleInfo(vehicle: Vehicle, marker: google.maps.Marker): void {
    if (!this.infoWindow || !this.map) return;

    const statusColor = vehicle.speed && vehicle.speed > 0 ? '#4caf50' : '#ff9800';
    const statusText = vehicle.speed && vehicle.speed > 0 ? 'Moving' : 'Stationary';
    const lastUpdateHtml = vehicle.lastUpdate 
      ? '<p style="margin: 4px 0; font-size: 11px; color: #999;">Updated: ' + new Date(vehicle.lastUpdate).toLocaleTimeString() + '</p>' 
      : '';

    const content = '<div style="padding: 12px; min-width: 200px;">' +
      '<h3 style="margin: 0 0 8px 0; color: #1976d2; font-size: 16px;">' + vehicle.registrationNumber + '</h3>' +
      '<p style="margin: 4px 0; font-size: 13px;"><strong>Driver:</strong> ' + (vehicle.currentDriver || 'Not assigned') + '</p>' +
      '<p style="margin: 4px 0; font-size: 13px;"><strong>Speed:</strong> ' + (vehicle.speed || 0) + ' km/h</p>' +
      '<p style="margin: 4px 0; font-size: 13px;"><strong>Status:</strong> <span style="color: ' + statusColor + ';">' + statusText + '</span></p>' +
      '<p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>Location:</strong> ' + (vehicle.lastLocation || 'Unknown') + '</p>' +
      lastUpdateHtml +
      '<div style="margin-top: 12px;"><a href="https://www.google.com/maps/dir/?api=1&destination=' + vehicle.latitude + ',' + vehicle.longitude + '" target="_blank" style="color: #1976d2; text-decoration: none; font-size: 12px;">Get Directions  > </a></div>' +
      '</div>';

    this.infoWindow.setContent(content);
    this.infoWindow.open(this.map, marker);
  }

  selectVehicle(vehicle: Vehicle): void {
    this.selectedVehicle = vehicle;
    this.focusOnVehicle();
  }

  focusOnVehicle(): void {
    if (!this.map || !this.selectedVehicle) {
      if (this.map && this.markers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        this.markers.forEach(m => bounds.extend(m.getPosition()!));
        this.map.fitBounds(bounds, 50);
      }
      return;
    }

    const vehicle = this.selectedVehicle;
    if (vehicle.latitude && vehicle.longitude) {
      this.map.setCenter({ lat: vehicle.latitude, lng: vehicle.longitude });
      this.map.setZoom(15);

      const marker = this.markers.find(m => m.getTitle() === vehicle.registrationNumber);
      if (marker) {
        this.showVehicleInfo(vehicle, marker);
      }
    }
  }

  findNearestTfnDepot(): void {
    if (!this.selectedVehicle || !this.selectedVehicle.latitude || !this.selectedVehicle.longitude) {
      this.snackBar.open('Please select a vehicle with valid coordinates', 'Close', { duration: 3000 });
      return;
    }

    // Clear previous depot marker and line
    if (this.depotMarker) {
      this.depotMarker.setMap(null);
      this.depotMarker = null;
    }
    if (this.depotLine) {
      this.depotLine.setMap(null);
      this.depotLine = null;
    }
    if (this.depotDirectionsRenderer) {
      this.depotDirectionsRenderer.setMap(null);
      this.depotDirectionsRenderer = null;
    }

    const lat = this.selectedVehicle.latitude;
    const lng = this.selectedVehicle.longitude;

    this.http.get<any>(`/api/logistics/tfn/depots/nearest?lat=${lat}&lng=${lng}`).subscribe({
      next: (depot) => {
        // Show depot on map with info window
        if (this.map && depot.latitude && depot.longitude) {
          // Add a marker for the depot
          this.depotMarker = new google.maps.Marker({
            position: { lat: depot.latitude, lng: depot.longitude },
            map: this.map,
            title: depot.name,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"><path fill="#e65100" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>'
              ),
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 40)
            }
          });

          // Draw a road-based route from vehicle to depot using the Directions API
          const directionsService = new google.maps.DirectionsService();
          this.depotDirectionsRenderer = new google.maps.DirectionsRenderer({
            map: this.map,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: {
              strokeColor: '#ff9800',
              strokeOpacity: 0.9,
              strokeWeight: 5
            }
          });

          directionsService.route({
            origin: { lat: lat, lng: lng },
            destination: { lat: depot.latitude, lng: depot.longitude },
            travelMode: google.maps.TravelMode.DRIVING
          }, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              this.depotDirectionsRenderer!.setDirections(result);
              // Update snackbar with real road distance/time
              const leg = result.routes?.[0]?.legs?.[0];
              if (leg) {
                this.snackBar.open(`Nearest TFN: ${depot.name} — ${leg.distance?.text} by road (${leg.duration?.text})`, 'Close', { duration: 6000 });
                this.lastDepotInfo = { ...this.lastDepotInfo, roadDistance: leg.distance?.text, roadDuration: leg.duration?.text };
              }
              // Encode the route path for a printable static map
              try {
                const overview = result.routes?.[0]?.overview_path;
                const enc = (google.maps as any).geometry?.encoding;
                if (overview && enc) {
                  this.lastDepotInfo = { ...this.lastDepotInfo, encodedPath: enc.encodePath(overview) };
                }
              } catch { /* geometry lib not available */ }
            } else {
              // Fallback: straight dashed line if Directions fails
              console.warn('Directions request failed:', status);
              this.depotDirectionsRenderer?.setMap(null);
              this.depotDirectionsRenderer = null;
              this.depotLine = new google.maps.Polyline({
                path: [ { lat: lat, lng: lng }, { lat: depot.latitude, lng: depot.longitude } ],
                geodesic: true,
                strokeColor: '#ff9800',
                strokeOpacity: 0.6,
                strokeWeight: 3,
                map: this.map!,
                icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '15px' }]
              });
            }
          });

          // Remember depot for print
          this.lastDepotInfo = {
            name: depot.name,
            code: depot.code,
            distanceKm: depot.distanceKm,
            address: depot.address,
            city: depot.city,
            province: depot.province,
            vehicleReg: this.selectedVehicle?.registrationNumber,
            vehicleLat: lat,
            vehicleLng: lng,
            depotLat: depot.latitude,
            depotLng: depot.longitude
          };

          // Create bounds to show both vehicle and depot
          const bounds = new google.maps.LatLngBounds();
          bounds.extend({ lat: lat, lng: lng });
          bounds.extend({ lat: depot.latitude, lng: depot.longitude });
          this.map.fitBounds(bounds, 80);

          // Show info window on depot
          const infoContent = `
            <div style="padding: 12px; min-width: 220px;">
              <h3 style="margin: 0 0 8px 0; color: #e65100; font-size: 16px;">
                <span style="font-size: 20px;">🏭</span> ${depot.name}
              </h3>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Code:</strong> ${depot.code || 'N/A'}</p>
              <p style="margin: 4px 0; font-size: 13px;"><strong>Distance:</strong> <span style="color: #1976d2; font-weight: bold;">${depot.distanceKm} km</span></p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;"><strong>Address:</strong> ${depot.address || ''}</p>
              <p style="margin: 4px 0; font-size: 12px; color: #666;">${depot.city || ''}, ${depot.province || ''}</p>
              ${depot.contactPerson ? '<p style="margin: 8px 0 4px 0; font-size: 12px;"><strong>Contact:</strong> ' + depot.contactPerson + '</p>' : ''}
              ${depot.contactPhone ? '<p style="margin: 4px 0; font-size: 12px;"><strong>Phone:</strong> <a href="tel:' + depot.contactPhone + '">' + depot.contactPhone + '</a></p>' : ''}
              <div style="margin-top: 12px;">
                <a href="https://www.google.com/maps/dir/${lat},${lng}/${depot.latitude},${depot.longitude}" target="_blank" style="color: #e65100; text-decoration: none; font-size: 12px;">Get Directions  > </a>
              </div>
            </div>
          `;

          if (this.infoWindow) {
            this.infoWindow.setContent(infoContent);
            this.infoWindow.open(this.map, this.depotMarker);
          }
        }

        this.snackBar.open(`Nearest TFN: ${depot.name} (${depot.distanceKm} km away)`, 'Close', { duration: 5000 });
      },
      error: (err) => {
        console.error('Error finding nearest depot:', err);
        this.snackBar.open('Failed to find nearest TFN depot', 'Close', { duration: 3000 });
      }
    });
  }

  refreshMap(): void {
    this.lastUpdate = new Date();
    this.addVehicleMarkers();
  }

  async printMap(): Promise<void> {
    const d = this.lastDepotInfo;
    const now = new Date();

    // Snapshot the live Google map (with markers + road route) using html2canvas.
    // This avoids depending on the Static Maps API, which is not enabled for this key.
    let mapImgDataUrl = '';
    const mapNode: HTMLElement | null = this.mapElement?.nativeElement || null;
    if (mapNode) {
      try {
        const html2canvas = (await import('html2canvas')).default;
        const canvas = await html2canvas(mapNode, {
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#e5e3df',
          scale: 2
        });
        mapImgDataUrl = canvas.toDataURL('image/png');
      } catch (err) {
        console.error('Map snapshot failed', err);
      }
    }

    const summary = d ? `
      <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:13px;">
        <tr><td style="padding:4px 8px; font-weight:bold; width:170px;">Vehicle</td><td style="padding:4px 8px;">${d.vehicleReg || '—'}</td></tr>
        <tr><td style="padding:4px 8px; font-weight:bold;">Nearest TFN Depot</td><td style="padding:4px 8px;">${d.name || '—'} ${d.code ? '(' + d.code + ')' : ''}</td></tr>
        <tr><td style="padding:4px 8px; font-weight:bold;">Straight-line Distance</td><td style="padding:4px 8px;">${d.distanceKm ?? '—'} km</td></tr>
        ${d.roadDistance ? `<tr><td style="padding:4px 8px; font-weight:bold;">Road Distance</td><td style="padding:4px 8px;">${d.roadDistance} (${d.roadDuration})</td></tr>` : ''}
        <tr><td style="padding:4px 8px; font-weight:bold;">Depot Address</td><td style="padding:4px 8px;">${[d.address, d.city, d.province].filter(Boolean).join(', ') || '—'}</td></tr>
      </table>` : '<p style="font-size:13px; color:#666;">Tip: click <b>Nearest TFN</b> first to include the vehicle, depot and route on the printout.</p>';

    const mapBlock = mapImgDataUrl
      ? `<img src="${mapImgDataUrl}" style="width:100%; max-width:800px; border:1px solid #ccc; border-radius:8px;" alt="Route map" />
         <div style="font-size:11px; color:#888; margin-top:6px;">Blue = Vehicle &nbsp;•&nbsp; Orange = TFN Depot &nbsp;•&nbsp; Route follows roads</div>`
      : '<p style="color:#b00; font-size:13px;">Could not capture the map. Make sure the map is fully loaded and try again.</p>';

    const printWindow = window.open('', '_blank', 'width=960,height=820');
    if (!printWindow) {
      this.snackBar.open('Unable to open print window (popup blocked?)', 'Close', { duration: 4000 });
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Fleet Route - ${now.toLocaleString()}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color:#111; }
            h1 { font-size: 20px; margin: 0 0 4px 0; color:#e65100; }
            .meta { font-size: 12px; color:#666; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <h1>Nearest TFN Depot Route</h1>
          <div class="meta">Printed ${now.toLocaleString()}</div>
          ${summary}
          ${mapBlock}
          <script>
            var img = document.querySelector('img');
            function go(){ window.focus(); window.print(); }
            if (img) { img.onload = function(){ setTimeout(go, 300); }; img.onerror = go; setTimeout(go, 3000); }
            else { setTimeout(go, 400); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
}

// New Load Dialog Component with Multi-Stop Support
@Component({
  selector: 'app-new-load-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatChipsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    FormsModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="load-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>add_box</mat-icon>
          Create New Load
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        @if (loading) {
          <div class="loading-container">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Loading data...</p>
          </div>
        } @else {
          <div class="load-form">
            <!-- STEP 1: Load Info -->
            <div class="form-section">
              <div class="section-header">
                <mat-icon>info</mat-icon>
                <span>Load Information</span>
              </div>
              
              <div class="form-grid">
                <mat-form-field appearance="outline">
                  <mat-label>Customer Name</mat-label>
                  <input matInput [(ngModel)]="loadData.customerName" placeholder="Enter customer name">
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Origin Warehouse</mat-label>
                  <mat-select [(ngModel)]="loadData.originWarehouseId" (selectionChange)="onWarehouseChange($event.value)">
                    @for (wh of warehouses; track wh.id) {
                      <mat-option [value]="wh.id">
                        <span class="wh-option">{{ wh.name }} ({{ wh.code }})</span>
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Vehicle</mat-label>
                  <mat-select [(ngModel)]="loadData.vehicleId">
                    <mat-option [value]="null">-- Not Assigned --</mat-option>
                    @for (v of vehicles; track v.id) {
                      @if (v.status === 'Available' || v.status === 'In Use' || !v.status) {
                        <mat-option [value]="v.id">{{ v.registrationNumber }} ({{ v.type }})</mat-option>
                      }
                    }
                  </mat-select>
                  <mat-hint>Only available vehicles shown</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Driver</mat-label>
                  <mat-select [(ngModel)]="loadData.driverId">
                    <mat-option [value]="null">-- Not Assigned --</mat-option>
                    @for (d of drivers; track d.id) {
                      <mat-option [value]="d.id">{{ d.firstName }} {{ d.lastName }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Scheduled Date</mat-label>
                  <input matInput [matDatepicker]="picker" [(ngModel)]="loadData.scheduledDate">
                  <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select [(ngModel)]="loadData.priority">
                    <mat-option value="Low">Low</mat-option>
                    <mat-option value="Normal">Normal</mat-option>
                    <mat-option value="High">High</mat-option>
                    <mat-option value="Urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              @if (selectedWarehouse) {
                <div class="warehouse-info">
                  <mat-icon>warehouse</mat-icon>
                  <span>{{ selectedWarehouse.address }}, {{ selectedWarehouse.city }} • Manager: {{ selectedWarehouse.managerName }}</span>
                </div>
              }
            </div>

            <!-- STEP 2: Stops -->
            <div class="form-section">
              <div class="section-header">
                <mat-icon>pin_drop</mat-icon>
                <span>Delivery Stops ({{ stops.length }})</span>
                <button mat-stroked-button color="primary" class="add-stop-btn" (click)="addStop()">
                  <mat-icon>add_location</mat-icon>
                  Add Stop
                </button>
              </div>

              @if (stops.length === 0) {
                <div class="no-stops">
                  <mat-icon>add_location_alt</mat-icon>
                  <p>No stops added yet. Click "Add Stop" to add delivery destinations.</p>
                </div>
              }

              <mat-accordion class="stops-accordion">
                @for (stop of stops; track stop.id; let i = $index) {
                  <mat-expansion-panel [expanded]="stop.expanded">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <div class="stop-title">
                          <span class="stop-number">Stop {{ i + 1 }}</span>
                          <span class="stop-address">{{ stop.address || 'No address set' }}</span>
                        </div>
                      </mat-panel-title>
                      <mat-panel-description>
                        <span class="stop-commodities-count">
                          {{ stop.commodities.length }} item(s)
                        </span>
                        <button mat-icon-button color="warn" (click)="removeStop(i, $event)" matTooltip="Remove stop">
                          <mat-icon>delete</mat-icon>
                        </button>
                      </mat-panel-description>
                    </mat-expansion-panel-header>

                    <div class="stop-content">
                      <!-- Stop Address -->
                      <div class="stop-address-section">
                        <mat-form-field appearance="outline" class="full-width">
                          <mat-label>Delivery Address</mat-label>
                          <input matInput 
                                 [(ngModel)]="stop.address"
                                 [id]="'stop-address-' + stop.id"
                                 placeholder="Enter or search address...">
                          <mat-icon matSuffix>place</mat-icon>
                        </mat-form-field>

                        <div class="stop-details-grid">
                          <mat-form-field appearance="outline">
                            <mat-label>Company/Location Name</mat-label>
                            <input matInput [(ngModel)]="stop.companyName" placeholder="Optional">
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Contact Person</mat-label>
                            <input matInput [(ngModel)]="stop.contactPerson" placeholder="Optional">
                          </mat-form-field>
                          <mat-form-field appearance="outline">
                            <mat-label>Contact Phone</mat-label>
                            <input matInput [(ngModel)]="stop.contactPhone" placeholder="Optional">
                          </mat-form-field>
                        </div>
                      </div>

                      <!-- Stop Commodities -->
                      <div class="stop-commodities-section">
                        <div class="commodities-header">
                          <span><mat-icon>inventory_2</mat-icon> Commodities for this stop</span>
                        </div>

                        @if (loadingInventory) {
                          <div class="loading-inventory">
                            <mat-spinner diameter="20"></mat-spinner>
                            <span>Loading inventory...</span>
                          </div>
                        } @else if (warehouseInventory.length > 0) {
                          <div class="commodity-picker">
                            @for (item of warehouseInventory; track $index) {
                              <div class="commodity-item" [class.selected]="isItemInStop(stop, item.commodityId)">
                                <div class="commodity-info">
                                  <strong>{{ item.commodityName }}</strong>
                                  <small>Stock: {{ item.quantityOnHand }} {{ item.unitOfMeasure }}</small>
                                </div>
                                <div class="commodity-actions">
                                  <mat-form-field appearance="outline" class="qty-input">
                                    <input matInput type="number" min="0" [max]="item.quantityOnHand"
                                           [value]="getStopQuantity(stop, item.commodityId)"
                                           (input)="updateStopQuantity(stop, item, $event)"
                                           placeholder="0">
                                  </mat-form-field>
                                </div>
                              </div>
                            }
                          </div>

                          @if (stop.commodities.length > 0) {
                            <div class="selected-for-stop">
                              <strong>Selected ({{ stop.commodities.length }}):</strong>
                              <div class="chips-row">
                                @for (c of stop.commodities; track $index) {
                                  <mat-chip (removed)="removeCommodityFromStop(stop, c.commodityId)">
                                    {{ c.commodityName }} × {{ c.quantity }}
                                    <mat-icon matChipRemove>cancel</mat-icon>
                                  </mat-chip>
                                }
                              </div>
                            </div>
                          }
                        } @else {
                          <div class="no-inventory-msg">
                            <mat-icon>inventory</mat-icon>
                            <span>Select an origin warehouse first</span>
                          </div>
                        }
                      </div>

                      <mat-form-field appearance="outline" class="full-width">
                        <mat-label>Notes for this stop</mat-label>
                        <textarea matInput [(ngModel)]="stop.notes" rows="2" placeholder="Delivery instructions..."></textarea>
                      </mat-form-field>
                    </div>
                  </mat-expansion-panel>
                }
              </mat-accordion>
            </div>

            <!-- Summary -->
            @if (stops.length > 0) {
              <div class="form-section summary-section">
                <div class="section-header">
                  <mat-icon>summarize</mat-icon>
                  <span>Load Summary</span>
                </div>
                <div class="summary-grid">
                  <div class="summary-item">
                    <mat-icon>pin_drop</mat-icon>
                    <span>{{ stops.length }} Stop(s)</span>
                  </div>
                  <div class="summary-item">
                    <mat-icon>inventory_2</mat-icon>
                    <span>{{ getTotalCommodities() }} Commodity Type(s)</span>
                  </div>
                  <div class="summary-item">
                    <mat-icon>scale</mat-icon>
                    <span>{{ getTotalQuantity() }} Total Units</span>
                  </div>
                </div>
                
                <!-- Distance & Time Calculation -->
                <div class="distance-time-section">
                  <div class="section-subheader">
                    <mat-icon>schedule</mat-icon>
                    <span>Estimated Route & Time</span>
                    <button mat-stroked-button color="primary" class="calculate-btn" 
                            (click)="calculateRouteTime()" 
                            [disabled]="calculatingRoute">
                      @if (calculatingRoute) {
                        <mat-spinner diameter="18"></mat-spinner>
                      } @else {
                        <mat-icon>calculate</mat-icon>
                      }
                      Calculate
                    </button>
                  </div>
                  
                  @if (routeEstimate) {
                    <div class="route-estimate-grid">
                      <div class="estimate-item">
                        <mat-icon>straighten</mat-icon>
                        <div class="estimate-details">
                          <span class="estimate-value">{{ routeEstimate.totalDistance }} km</span>
                          <span class="estimate-label">Total Distance</span>
                        </div>
                      </div>
                      <div class="estimate-item">
                        <mat-icon>drive_eta</mat-icon>
                        <div class="estimate-details">
                          <span class="estimate-value">{{ routeEstimate.drivingTime }}</span>
                          <span class="estimate-label">Driving Time</span>
                        </div>
                      </div>
                      <div class="estimate-item">
                        <mat-icon>inventory</mat-icon>
                        <div class="estimate-details">
                          <span class="estimate-value">{{ routeEstimate.offloadTime }}</span>
                          <span class="estimate-label">Offload Time ({{ stops.length }}h)</span>
                        </div>
                      </div>
                      <div class="estimate-item total">
                        <mat-icon>timer</mat-icon>
                        <div class="estimate-details">
                          <span class="estimate-value">{{ routeEstimate.totalTime }}</span>
                          <span class="estimate-label">Total Estimated Time</span>
                        </div>
                      </div>
                    </div>
                    <div class="route-breakdown">
                      <small>Breakdown: {{ routeEstimate.breakdown }}</small>
                    </div>
                  } @else {
                    <div class="no-estimate">
                      <mat-icon>info</mat-icon>
                      <span>Click "Calculate" to estimate route distance and time</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Notes -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>General Notes</mat-label>
              <textarea matInput [(ngModel)]="loadData.notes" rows="2" placeholder="Additional notes for the entire load..."></textarea>
            </mat-form-field>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" 
                [disabled]="!canSubmit()"
                (click)="submitLoad()">
          <mat-icon>local_shipping</mat-icon>
          Create Load
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .load-dialog {
      width: 100%;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%);
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      font-size: 20px;
      font-weight: 500;
    }

    .dialog-header button { color: white; }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      gap: 16px;
    }

    mat-dialog-content {
      padding: 16px 24px !important;
      max-height: 75vh;
      overflow-y: auto;
    }

    .load-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-section {
      background: #fafafa;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e0e0e0;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1976d2;
      font-weight: 500;
      font-size: 15px;
      margin-bottom: 12px;
    }

    .section-header mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .add-stop-btn {
      margin-left: auto;
      font-size: 12px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .form-grid mat-form-field {
      width: 100%;
    }

    .warehouse-info {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #e8f5e9;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 13px;
      color: #2e7d32;
      margin-top: 8px;
    }

    .warehouse-info mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .no-stops {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 32px;
      color: #999;
      text-align: center;
    }

    .no-stops mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
      color: #ccc;
    }

    .stops-accordion {
      margin-top: 8px;
    }

    .stop-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stop-number {
      background: #1976d2;
      color: white;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .stop-address {
      font-size: 13px;
      color: #666;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stop-commodities-count {
      font-size: 12px;
      color: #666;
      margin-right: 8px;
    }

    .stop-content {
      padding-top: 8px;
    }

    .stop-address-section {
      margin-bottom: 16px;
    }

    .stop-details-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 8px;
    }

    .stop-commodities-section {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    .commodities-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      font-size: 13px;
      color: #555;
      margin-bottom: 12px;
    }

    .commodities-header mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .commodity-picker {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
    }

    .commodity-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #f5f5f5;
      border-radius: 6px;
      border: 1px solid transparent;
      transition: all 0.2s;
    }

    .commodity-item:hover {
      background: #eeeeee;
    }

    .commodity-item.selected {
      background: #e3f2fd;
      border-color: #1976d2;
    }

    .commodity-info {
      display: flex;
      flex-direction: column;
    }

    .commodity-info strong {
      font-size: 13px;
    }

    .commodity-info small {
      font-size: 11px;
      color: #666;
    }

    .qty-input {
      width: 70px;
    }

    .qty-input ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .qty-input ::ng-deep .mat-mdc-text-field-wrapper {
      padding: 0 8px;
    }

    .selected-for-stop {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
    }

    .selected-for-stop strong {
      font-size: 12px;
      color: #666;
    }

    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }

    .chips-row mat-chip {
      font-size: 12px;
    }

    .loading-inventory {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: #666;
      font-size: 13px;
    }

    .no-inventory-msg {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      color: #999;
      font-size: 13px;
    }

    .summary-section {
      background: #e3f2fd;
      border-color: #1976d2;
    }

    .summary-grid {
      display: flex;
      gap: 24px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #1565c0;
    }

    .summary-item mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Distance & Time Calculation Styles */
    .distance-time-section {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(25, 118, 210, 0.3);
    }

    .section-subheader {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      font-size: 14px;
      color: #1565c0;
      margin-bottom: 12px;
    }

    .section-subheader mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .calculate-btn {
      margin-left: auto;
      font-size: 12px;
    }

    .calculate-btn mat-spinner {
      margin-right: 4px;
    }

    .route-estimate-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 12px;
    }

    .estimate-item {
      display: flex;
      align-items: center;
      gap: 10px;
      background: white;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #bbdefb;
    }

    .estimate-item mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: #1976d2;
    }

    .estimate-item.total {
      background: #1976d2;
      border-color: #1565c0;
    }

    .estimate-item.total mat-icon,
    .estimate-item.total .estimate-value,
    .estimate-item.total .estimate-label {
      color: white;
    }

    .estimate-details {
      display: flex;
      flex-direction: column;
    }

    .estimate-value {
      font-size: 16px;
      font-weight: 600;
      color: #1565c0;
    }

    .estimate-label {
      font-size: 11px;
      color: #666;
    }

    .route-breakdown {
      background: rgba(255, 255, 255, 0.7);
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      color: #666;
    }

    .no-estimate {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: 6px;
      color: #666;
      font-size: 13px;
    }

    .no-estimate mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #1976d2;
    }

    .full-width {
      width: 100%;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      gap: 12px;
    }

    mat-dialog-actions button mat-icon {
      margin-right: 4px;
    }
  `]
})
export class NewLoadDialogComponent implements OnInit, OnDestroy {
  loading = true;
  loadingInventory = false;
  calculatingRoute = false;
  routeEstimate: RouteEstimate | null = null;
  
  // Load basic info
  loadData = {
    customerName: '',
    originWarehouseId: null as number | null,
    vehicleId: null as number | null,
    driverId: null as number | null,
    scheduledDate: new Date(),
    priority: 'Normal',
    notes: ''
  };

  // Reference data
  warehouses: any[] = [];
  vehicles: any[] = [];
  drivers: any[] = [];
  selectedWarehouse: any = null;
  warehouseInventory: any[] = [];

  // Stops with commodities
  stops: LoadStop[] = [];
  private stopIdCounter = 1;

  private apiUrl = environment.apiUrl;

  constructor(
    public dialogRef: MatDialogRef<NewLoadDialogComponent>,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadReferenceData();
  }

  ngOnDestroy(): void {}

  private loadReferenceData(): void {
    // Load warehouses, vehicles, and drivers in parallel
    const warehouses$ = this.http.get<any[]>(this.apiUrl + '/warehouses').pipe(
      catchError(() => of(this.getFallbackWarehouses()))
    );
    const vehicles$ = this.http.get<any[]>(this.apiUrl + '/vehicles').pipe(
      catchError(() => of(this.getFallbackVehicles()))
    );
    const drivers$ = this.http.get<any[]>(this.apiUrl + '/drivers').pipe(
      catchError(() => of(this.getFallbackDrivers()))
    );

    forkJoin([warehouses$, vehicles$, drivers$]).subscribe({
      next: ([warehouses, vehicles, drivers]) => {
        this.warehouses = warehouses;
        this.vehicles = vehicles;
        this.drivers = drivers;
        this.loading = false;
      },
      error: () => {
        this.warehouses = this.getFallbackWarehouses();
        this.vehicles = this.getFallbackVehicles();
        this.drivers = this.getFallbackDrivers();
        this.loading = false;
      }
    });
  }

  private getFallbackWarehouses(): any[] {
    return [
      { id: 1, name: 'KZN Distribution Centre', code: 'WH-KZN', city: 'Durban', province: 'KwaZulu-Natal', address: '123 Industrial Road, Pinetown', managerName: 'John Dlamini' },
      { id: 2, name: 'Gauteng Main Warehouse', code: 'WH-GP', city: 'Johannesburg', province: 'Gauteng', address: '456 Logistics Park, Midrand', managerName: 'Sarah Mokwena' },
      { id: 3, name: 'Cape Town Hub', code: 'WH-WC', city: 'Cape Town', province: 'Western Cape', address: '789 Harbour Drive, Paarden Eiland', managerName: 'Michael van der Berg' },
      { id: 4, name: 'Eastern Cape Depot', code: 'WH-EC', city: 'Gqeberha', province: 'Eastern Cape', address: '321 Port Road, Gqeberha', managerName: 'Nomsa Hendricks' }
    ];
  }

  private getFallbackVehicles(): any[] {
    return [
      { id: 1, registrationNumber: 'GP 123-456', type: 'Truck' },
      { id: 2, registrationNumber: 'GP 789-012', type: 'Truck' },
      { id: 3, registrationNumber: 'KZN 111-222', type: 'Van' },
      { id: 4, registrationNumber: 'WC 333-444', type: 'Truck' }
    ];
  }

  private getFallbackDrivers(): any[] {
    return [
      { id: 1, firstName: 'John', lastName: 'Smith' },
      { id: 2, firstName: 'Mike', lastName: 'Johnson' },
      { id: 3, firstName: 'Peter', lastName: 'Nkosi' },
      { id: 4, firstName: 'James', lastName: 'van der Merwe' }
    ];
  }

  onWarehouseChange(warehouseId: number): void {
    this.selectedWarehouse = this.warehouses.find(w => w.id === warehouseId);
    // Clear commodities from all stops when warehouse changes
    this.stops.forEach(stop => stop.commodities = []);
    this.loadWarehouseInventory(warehouseId);
  }

  private loadWarehouseInventory(warehouseId: number): void {
    this.loadingInventory = true;
    this.http.get<any[]>(this.apiUrl + '/warehouses/' + warehouseId + '/inventory').subscribe({
      next: (inventory) => {
        this.warehouseInventory = inventory;
        this.loadingInventory = false;
      },
      error: () => {
        // Fallback inventory
        this.warehouseInventory = [
          { commodityId: 1, commodityName: 'Paracetamol 500mg', category: 'Pharmaceuticals', quantityOnHand: 2500, unitOfMeasure: 'Box' },
          { commodityId: 2, commodityName: 'Ibuprofen 400mg', category: 'Pharmaceuticals', quantityOnHand: 1800, unitOfMeasure: 'Box' },
          { commodityId: 3, commodityName: 'Surgical Gloves', category: 'Medical Supplies', quantityOnHand: 3500, unitOfMeasure: 'Box' },
          { commodityId: 4, commodityName: 'Face Masks N95', category: 'Medical Supplies', quantityOnHand: 5000, unitOfMeasure: 'Box' },
          { commodityId: 5, commodityName: 'Blood Pressure Monitor', category: 'Equipment', quantityOnHand: 85, unitOfMeasure: 'Unit' },
          { commodityId: 6, commodityName: 'Syringes 5ml', category: 'Medical Supplies', quantityOnHand: 10000, unitOfMeasure: 'Box' }
        ];
        this.loadingInventory = false;
      }
    });
  }

  // Stop management
  addStop(): void {
    const newStop: LoadStop = {
      id: this.stopIdCounter++,
      sequence: this.stops.length + 1,
      address: '',
      companyName: '',
      contactPerson: '',
      contactPhone: '',
      notes: '',
      commodities: [],
      expanded: true
    };
    // Collapse other stops
    this.stops.forEach(s => s.expanded = false);
    this.stops.push(newStop);
  }

  removeStop(index: number, event: Event): void {
    event.stopPropagation();
    this.stops.splice(index, 1);
    // Re-sequence
    this.stops.forEach((s, i) => s.sequence = i + 1);
  }

  // Commodity management for stops
  isItemInStop(stop: LoadStop, commodityId: number): boolean {
    return stop.commodities.some(c => c.commodityId === commodityId);
  }

  getStopQuantity(stop: LoadStop, commodityId: number): number {
    const item = stop.commodities.find(c => c.commodityId === commodityId);
    return item?.quantity || 0;
  }

  updateStopQuantity(stop: LoadStop, item: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    const qty = parseInt(input.value, 10) || 0;

    if (qty > 0 && qty <= item.quantityOnHand) {
      const existing = stop.commodities.find(c => c.commodityId === item.commodityId);
      if (existing) {
        existing.quantity = qty;
      } else {
        stop.commodities.push({
          commodityId: item.commodityId,
          commodityName: item.commodityName,
          quantity: qty,
          unitOfMeasure: item.unitOfMeasure
        });
      }
    } else if (qty === 0) {
      stop.commodities = stop.commodities.filter(c => c.commodityId !== item.commodityId);
    }
  }

  removeCommodityFromStop(stop: LoadStop, commodityId: number): void {
    stop.commodities = stop.commodities.filter(c => c.commodityId !== commodityId);
  }

  // Summary calculations
  getTotalCommodities(): number {
    const uniqueCommodities = new Set<number>();
    this.stops.forEach(stop => {
      stop.commodities.forEach(c => uniqueCommodities.add(c.commodityId));
    });
    return uniqueCommodities.size;
  }

  getTotalQuantity(): number {
    return this.stops.reduce((total, stop) => {
      return total + stop.commodities.reduce((stopTotal, c) => stopTotal + c.quantity, 0);
    }, 0);
  }

  canSubmit(): boolean {
    return !!(
      this.loadData.customerName &&
      this.loadData.originWarehouseId &&
      this.stops.length > 0 &&
      this.stops.every(s => s.address && s.commodities.length > 0)
    );
  }

  submitLoad(): void {
    if (this.canSubmit()) {
      // Build the load data structure for the API
      const loadPayload = {
        warehouseId: this.loadData.originWarehouseId,
        customerId: null, // Can be set if you have customer management
        vehicleId: this.loadData.vehicleId,
        driverId: this.loadData.driverId,
        priority: this.loadData.priority,
        scheduledPickupDate: this.loadData.scheduledDate,
        notes: this.loadData.notes,
        estimatedDistance: this.routeEstimate?.totalDistance,
        estimatedTime: this.routeEstimate?.totalTime,
        stops: [
          // Pickup stop (from warehouse)
          {
            stopSequence: 0,
            stopType: 'Pickup',
            warehouseId: this.loadData.originWarehouseId,
            address: this.selectedWarehouse?.address || '',
            city: this.selectedWarehouse?.city || '',
            companyName: this.selectedWarehouse?.name || '',
            commodities: []
          },
          // Delivery stops
          ...this.stops.map((stop, index) => ({
            stopSequence: index + 1,
            stopType: index === this.stops.length - 1 ? 'Destination' : 'Stop',
            address: stop.address,
            companyName: stop.companyName,
            contactPerson: stop.contactPerson,
            contactPhone: stop.contactPhone,
            notes: stop.notes,
            commodities: stop.commodities.map(c => ({
              commodityId: c.commodityId,
              quantity: c.quantity,
              unitOfMeasure: c.unitOfMeasure
            }))
          }))
        ]
      };

      this.dialogRef.close(loadPayload);
    }
  }

  // Route & Time Calculation
  calculateRouteTime(): void {
    if (this.stops.length === 0 || !this.selectedWarehouse) {
      return;
    }

    this.calculatingRoute = true;

    // Build waypoints for route calculation
    const origin = this.selectedWarehouse.address + ', ' + this.selectedWarehouse.city + ', South Africa';
    const destinations = this.stops.map(s => s.address).filter(a => a);

    if (destinations.length === 0) {
      this.calculatingRoute = false;
      return;
    }

    // Use Google Maps Distance Matrix API
    this.calculateDistanceWithGoogle(origin, destinations);
  }

  private calculateDistanceWithGoogle(origin: string, destinations: string[]): void {
    // Check if Google Maps is loaded
    if (typeof google === 'undefined' || !google.maps) {
      // Fallback to estimated calculation
      this.calculateEstimatedRoute(destinations);
      return;
    }

    const service = new (google.maps as any).DistanceMatrixService();
    
    // Build waypoints - origin to first stop, then stop to stop
    const allPoints = [origin, ...destinations];
    
    // Calculate segments
    const requests: Promise<number>[] = [];
    for (let i = 0; i < allPoints.length - 1; i++) {
      requests.push(this.getSegmentDistance(service, allPoints[i], allPoints[i + 1]));
    }

    Promise.all(requests).then(distances => {
      const totalDistanceMeters = distances.reduce((sum, d) => sum + d, 0);
      const totalDistanceKm = Math.round(totalDistanceMeters / 1000);
      
      // Average speed 80 km/h for trucks
      const drivingHours = totalDistanceKm / 80;
      const offloadHours = this.stops.length * 1; // 1 hour per stop
      const totalHours = drivingHours + offloadHours;

      this.routeEstimate = {
        totalDistance: totalDistanceKm,
        drivingTime: this.formatDuration(drivingHours),
        offloadTime: this.formatDuration(offloadHours),
        totalTime: this.formatDuration(totalHours),
        breakdown: `${this.formatDuration(drivingHours)} driving + ${offloadHours}h offloading (${this.stops.length} stops × 1h)`
      };

      this.calculatingRoute = false;
    }).catch(() => {
      this.calculateEstimatedRoute(destinations);
    });
  }

  private getSegmentDistance(service: any, origin: string, dest: string): Promise<number> {
    return new Promise((resolve, reject) => {
      service.getDistanceMatrix({
        origins: [origin],
        destinations: [dest],
        travelMode: (google.maps as any).TravelMode.DRIVING,
        unitSystem: (google.maps as any).UnitSystem.METRIC
      }, (response: any, status: any) => {
        if (status === 'OK' && response?.rows[0]?.elements[0]?.distance) {
          resolve(response.rows[0].elements[0].distance.value);
        } else {
          reject(new Error('Distance calculation failed'));
        }
      });
    });
  }

  private calculateEstimatedRoute(destinations: string[]): void {
    // Fallback: Estimate based on typical SA distances
    // Average inter-city distance estimate: 300km per major stop
    const estimatedDistancePerStop = 300;
    const totalDistanceKm = destinations.length * estimatedDistancePerStop;
    
    const drivingHours = totalDistanceKm / 80; // 80 km/h average
    const offloadHours = this.stops.length * 1;
    const totalHours = drivingHours + offloadHours;

    this.routeEstimate = {
      totalDistance: totalDistanceKm,
      drivingTime: this.formatDuration(drivingHours),
      offloadTime: this.formatDuration(offloadHours),
      totalTime: this.formatDuration(totalHours),
      breakdown: `${this.formatDuration(drivingHours)} driving + ${offloadHours}h offloading (${this.stops.length} stops × 1h) [Estimated]`
    };

    this.calculatingRoute = false;
  }

  private formatDuration(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
}

// Interface for stops
interface LoadStop {
  id: number;
  sequence: number;
  address: string;
  companyName: string;
  contactPerson: string;
  contactPhone: string;
  notes: string;
  commodities: { commodityId: number; commodityName: string; quantity: number; unitOfMeasure: string }[];
  expanded: boolean;
}

// Interface for route estimate
interface RouteEstimate {
  totalDistance: number;
  drivingTime: string;
  offloadTime: string;
  totalTime: string;
  breakdown: string;
}

// POD Invoices Dialog Component (Logistics) — lists all invoice numbers on a POD
@Component({
  selector: 'app-logistics-pod-invoices-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatDialogModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title style="display: flex; align-items: center; gap: 8px;">
      <mat-icon style="color:#1a237e;">receipt_long</mat-icon>
      {{ data.pod.podNumber || ('POD' + data.pod.id) }} — Invoices
    </h2>
    <mat-dialog-content style="min-width: 380px;">
      @if (invoices.length > 0) {
        <div style="color:#666; font-size:13px; margin-bottom:8px;">
          {{ invoices.length }} invoice{{ invoices.length === 1 ? '' : 's' }} linked to this POD
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          @for (inv of invoices; track inv) {
            <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; background:#f5f6fa; border-radius:8px;">
              <mat-icon style="color:#3f51b5; font-size:20px; width:20px; height:20px;">receipt</mat-icon>
              <span style="font-family:monospace; font-weight:600;">{{ inv }}</span>
            </div>
          }
        </div>
      } @else {
        <div style="color:#888; padding:16px 0; text-align:center;">
          <mat-icon style="font-size:32px; width:32px; height:32px; opacity:.4;">receipt</mat-icon>
          <div>No invoice numbers recorded on this POD.</div>
        </div>
      }

      @if (data.pod.loadId) {
        <mat-divider style="margin:16px 0;"></mat-divider>
        <div style="display:flex; align-items:center; gap:10px; padding:10px 12px; background:#e8f5e9; border-radius:8px;">
          <mat-icon style="color:#2e7d32;">local_shipping</mat-icon>
          <div>
            <div style="font-size:12px; color:#666;">Linked Tripsheet</div>
            <div style="font-weight:600; color:#1b5e20;">{{ data.pod.loadNumber || ('Load #' + data.pod.loadId) }}</div>
          </div>
        </div>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `
})
export class LogisticsPodInvoicesDialog {
  invoices: string[] = [];

  constructor(@Inject(MAT_DIALOG_DATA) public data: { pod: any }) {
    const set = new Set<string>();
    if (Array.isArray(this.data.pod?.invoiceLinks)) {
      this.data.pod.invoiceLinks.forEach((l: any) => {
        if (l?.invoiceNumber) set.add(l.invoiceNumber);
      });
    }
    if (this.data.pod?.invoiceNumber) set.add(this.data.pod.invoiceNumber);
    this.invoices = Array.from(set);
  }
}

// Trip Sheet Preview Dialog Component
@Component({
  selector: 'app-tripsheet-preview-dialog',
  standalone: true,
  imports: [    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatDividerModule
  ],
  template: `
    <div class="tripsheet-preview-dialog landscape">
      <div class="dialog-header">
        <h2>
          <mat-icon>description</mat-icon>
          Trip Sheet
        </h2>
        <div class="header-actions">
          <button mat-icon-button (click)="print()" matTooltip="Print">
            <mat-icon>print</mat-icon>
          </button>
          <button mat-icon-button (click)="download()" matTooltip="Download PDF">
            <mat-icon>download</mat-icon>
          </button>
          <button mat-icon-button mat-dialog-close matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      @if (loading) {
        <div class="loading-content">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading trip sheet...</p>
        </div>
      } @else if (tripSheet) {
        <div class="tripsheet-content">
          <!-- Trip Header Section -->
          <div class="ts-header-section">
            <div class="ts-title">
              <h1>TRIP SHEET</h1>
              <span class="ts-number">{{ tripSheet.loadNumber }}</span>
            </div>
            <div class="ts-meta-row">
              <div class="meta-item">
                <label>DRIVER NAME:</label>
                <span class="meta-value">{{ tripSheet.driverName || 'UNASSIGNED' }}</span>
              </div>
              <div class="meta-item">
                <label>DATE:</label>
                <span class="meta-value">{{ tripSheet.tripDate | date:'dd.MM.yyyy' }}</span>
              </div>
              <div class="meta-item">
                <label>REG NUMBER:</label>
                <span class="meta-value">{{ tripSheet.vehicleRegNumber || tripSheet.vehicleRegistration || 'N/A' }}</span>
              </div>
              <div class="meta-item">
                <label>TOTAL:</label>
                <span class="meta-value value">R {{ tripSheet.totalValue | number:'1.2-2' }}</span>
              </div>
            </div>
          </div>

          <!-- Line Items Table -->
          <div class="ts-table-container">
            <table class="ts-table">
              <thead>
                <tr>
                  <th class="col-no">No</th>
                  <th class="col-inv">Inv No</th>
                  <th class="col-customer">Customer Name</th>
                  <th class="col-product">Product Description</th>
                  <th class="col-brand">Brand</th>
                  <th class="col-qty">Qty</th>
                  <th class="col-time">Time Dispatched</th>
                  <th class="col-order">Order No</th>
                  <th class="col-start">Start</th>
                  <th class="col-end">End</th>
                  <th class="col-km">KM</th>
                  <th class="col-value">Value</th>
                </tr>
              </thead>
              <tbody>
                @for (item of tripSheet.lineItems; track $index; let i = $index) {
                  <tr>
                    <td class="col-no">{{ item.no || (i + 1) }}</td>
                    <td class="col-inv">{{ item.invNo }}</td>
                    <td class="col-customer">{{ item.customerName }}</td>
                    <td class="col-product">{{ item.productDescription }}</td>
                    <td class="col-brand">{{ item.productBrand || '-' }}</td>
                    <td class="col-qty">{{ item.qty }}</td>
                    <td class="col-time">{{ item.timeDispatched || '' }}</td>
                    <td class="col-order">{{ item.orderNo || '' }}</td>
                    <td class="col-start editable"></td>
                    <td class="col-end editable"></td>
                    <td class="col-km editable"></td>
                    <td class="col-value">R {{ item.value | number:'1.2-2' }}</td>
                  </tr>
                }
                @if (!tripSheet.lineItems || tripSheet.lineItems.length === 0) {
                  <!-- Show old stops format as fallback -->
                  @for (stop of deliveryStops; track $index; let i = $index) {
                    @for (com of stop.commodities; track $index; let j = $index) {
                      <tr>
                        <td class="col-no">{{ i + 1 }}.{{ j + 1 }}</td>
                        <td class="col-inv">{{ stop.invoiceNumber || '-' }}</td>
                        <td class="col-customer">{{ stop.customerName || stop.companyName }}</td>
                        <td class="col-product">{{ com.commodityName || com.description }}</td>
                        <td class="col-brand">{{ com.commodityCode || '-' }}</td>
                        <td class="col-qty">{{ com.quantity }}</td>
                        <td class="col-time">{{ stop.scheduledArrival | date:'HH:mm' }}</td>
                        <td class="col-order">{{ stop.orderNumber || '' }}</td>
                        <td class="col-start editable"></td>
                        <td class="col-end editable"></td>
                        <td class="col-km editable"></td>
                        <td class="col-value">R {{ com.totalPrice | number:'1.2-2' }}</td>
                      </tr>
                    }
                  }
                }
                <!-- Empty rows for manual entry -->
                @for (row of emptyRows; track row) {
                  <tr class="empty-row">
                    <td class="col-no"></td>
                    <td class="col-inv"></td>
                    <td class="col-customer"></td>
                    <td class="col-product"></td>
                    <td class="col-brand"></td>
                    <td class="col-qty"></td>
                    <td class="col-time"></td>
                    <td class="col-order"></td>
                    <td class="col-start editable"></td>
                    <td class="col-end editable"></td>
                    <td class="col-km editable"></td>
                    <td class="col-value"></td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr class="totals-row">
                  <td colspan="5" class="totals-label">TOTAL</td>
                  <td class="col-qty">{{ getTotalQty() }}</td>
                  <td colspan="5"></td>
                  <td class="col-value total-value">R {{ tripSheet.totalValue | number:'1.2-2' }}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Footer Section -->
          <div class="ts-footer-section">
            <div class="footer-row">
              <div class="odometer-section">
                <div class="odo-field">
                  <label>Opening KM:</label>
                  <div class="odo-box"></div>
                </div>
                <div class="odo-field">
                  <label>Closing KM:</label>
                  <div class="odo-box"></div>
                </div>
              </div>
              <div class="fuel-section">
                <label>Fuel Level:</label>
                <div class="fuel-gauge">
                  <span>E</span>
                  <span class="fuel-box">&#9744;</span>
                  <span>&#188;</span>
                  <span class="fuel-box">&#9744;</span>
                  <span>&#189;</span>
                  <span class="fuel-box">&#9744;</span>
                  <span>&#190;</span>
                  <span class="fuel-box">&#9744;</span>
                  <span>F</span>
                </div>
              </div>
            </div>
            <div class="signatures-row">
              <div class="signature-block">
                <div class="signature-line"></div>
                <span>Driver Signature</span>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <span>Dispatch Signature</span>
              </div>
              <div class="signature-block">
                <div class="signature-line"></div>
                <span>Date</span>
              </div>
            </div>
            <div class="ts-generated">
              Generated: {{ tripSheet.generatedAt | date:'dd MMM yyyy HH:mm' }}
            </div>
          </div>
        </div>
      } @else {
        <div class="error-content">
          <mat-icon>error_outline</mat-icon>
          <p>Failed to load trip sheet</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .tripsheet-preview-dialog.landscape {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: white;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 20px;
      background: #1976d2;
      color: white;
      flex-shrink: 0;
    }
    .dialog-header h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
    }
    .header-actions {
      display: flex;
      gap: 4px;
    }
    .header-actions button {
      color: white;
    }
    
    .loading-content, .error-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      color: #666;
      flex: 1;
    }
    .error-content mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #f44336;
    }
    
    .tripsheet-content {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      padding: 16px 24px;
      font-family: Arial, sans-serif;
    }
    
    /* Header Section */
    .ts-header-section {
      border: 2px solid #333;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .ts-title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ccc;
    }
    .ts-title h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 2px;
    }
    .ts-number {
      font-size: 18px;
      font-weight: 600;
      color: #1976d2;
    }
    .ts-meta-row {
      display: flex;
      gap: 32px;
      flex-wrap: wrap;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta-item label {
      font-size: 11px;
      font-weight: 600;
      color: #555;
      text-transform: uppercase;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 600;
      color: #000;
    }
    .meta-value.value {
      color: #2e7d32;
    }
    
    /* Table Container */
    .ts-table-container {
      flex: 1;
      overflow-x: auto;
      border: 2px solid #333;
    }
    .ts-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .ts-table thead {
      background: #1976d2;
      color: white;
    }
    .ts-table th {
      padding: 8px 6px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      white-space: nowrap;
      border-right: 1px solid rgba(255,255,255,0.3);
    }
    .ts-table th:last-child {
      border-right: none;
    }
    .ts-table tbody tr {
      border-bottom: 1px solid #ddd;
    }
    .ts-table tbody tr:nth-child(even) {
      background: #f9f9f9;
    }
    .ts-table td {
      padding: 6px;
      vertical-align: middle;
      border-right: 1px solid #eee;
    }
    .ts-table td:last-child {
      border-right: none;
    }
    
    /* Column widths */
    .col-no { width: 35px; text-align: center; }
    .col-inv { width: 70px; }
    .col-customer { min-width: 140px; }
    .col-product { min-width: 160px; }
    .col-brand { width: 80px; }
    .col-qty { width: 45px; text-align: center; }
    .col-time { width: 70px; text-align: center; }
    .col-order { width: 70px; }
    .col-start { width: 55px; text-align: center; }
    .col-end { width: 55px; text-align: center; }
    .col-km { width: 50px; text-align: right; }
    .col-value { width: 80px; text-align: right; font-weight: 500; }
    .col-vat { width: 70px; text-align: right; color: #666; font-size: 11px; }
    .col-total { width: 85px; text-align: right; font-weight: 600; color: #2e7d32; }
    
    /* Editable cells */
    td.editable {
      background: #fffde7;
      border: 1px dashed #ccc;
    }
    
    /* Empty rows for manual entry */
    .empty-row td {
      height: 28px;
    }
    
    /* Totals row */
    .ts-table tfoot {
      background: #e8f5e9;
      font-weight: 600;
    }
    .totals-row td {
      padding: 10px 6px;
      border-top: 2px solid #333;
    }
    .totals-label {
      text-align: right;
      font-weight: 700;
      font-size: 12px;
    }
    .total-value {
      color: #2e7d32;
      font-size: 13px;
    }
    
    /* Footer Section */
    .ts-footer-section {
      border: 2px solid #333;
      border-top: none;
      padding: 12px 16px;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .odometer-section {
      display: flex;
      gap: 24px;
    }
    .odo-field {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .odo-field label {
      font-size: 11px;
      font-weight: 600;
    }
    .odo-box {
      width: 80px;
      height: 24px;
      border: 1px solid #333;
      background: #fafafa;
    }
    .fuel-section {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .fuel-section label {
      font-size: 11px;
      font-weight: 600;
    }
    .fuel-gauge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
    }
    .fuel-box {
      font-size: 16px;
    }
    
    .signatures-row {
      display: flex;
      gap: 40px;
      padding-top: 12px;
      border-top: 1px dashed #ccc;
    }
    .signature-block {
      flex: 1;
      text-align: center;
    }
    .signature-line {
      border-bottom: 1px solid #333;
      height: 40px;
      margin-bottom: 4px;
    }
    .signature-block span {
      font-size: 10px;
      color: #666;
      text-transform: uppercase;
    }
    
    .ts-generated {
      text-align: right;
      font-size: 9px;
      color: #999;
      margin-top: 8px;
    }
  `]
})
export class TripSheetPreviewDialog implements OnInit {
  loading = true;
  tripSheet: any = null;
  deliveryStops: any[] = [];
  emptyRows: number[] = [1, 2, 3, 4, 5]; // Empty rows for manual entries
  
  private apiUrl = environment.apiUrl;
  
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { loadId: number },
    private dialogRef: MatDialogRef<TripSheetPreviewDialog>,
    private http: HttpClient
  ) {}
  
  ngOnInit(): void {
    this.loadTripSheet();
  }
  
  loadTripSheet(): void {
    this.http.get<any>(`${this.apiUrl}/logistics/tripsheet/${this.data.loadId}`).subscribe({
      next: (ts) => {
        this.tripSheet = ts;
        // Filter out pickup stops, show only delivery stops
        this.deliveryStops = ts.stops?.filter((s: any) => s.stopType !== 'Pickup') || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load trip sheet:', err);
        this.loading = false;
      }
    });
  }
  
  getTotalQty(): number {
    if (this.tripSheet?.lineItems?.length > 0) {
      return this.tripSheet.lineItems.reduce((sum: number, item: any) => sum + (item.qty || 0), 0);
    }
    // Fallback to old stops format
    let total = 0;
    this.deliveryStops.forEach(stop => {
      stop.commodities?.forEach((com: any) => {
        total += com.quantity || 0;
      });
    });
    return total;
  }
  
  getStatusClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'pending': return 'status-pending';
      case 'scheduled': return 'status-scheduled';
      case 'in transit': case 'intransit': return 'status-in-transit';
      case 'delivered': case 'completed': return 'status-delivered';
      default: return '';
    }
  }
  
  formatMinutes(minutes: number | null): string {
    if (!minutes) return 'N/A';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
  
  print(): void {
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${this.data.loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          setTimeout(() => printWindow.print(), 500);
        }
      }
    });
  }
  
  download(): void {
    this.http.get(`${this.apiUrl}/logistics/tripsheet/${this.data.loadId}/pdf`, { responseType: 'text' }).subscribe({
      next: (html) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
          }, 500);
        }
      }
    });
  }
}

// Sync Result Dialog Component
@Component({
  selector: 'app-maintenance-export-scope-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="export-scope-dialog">
      <div class="dialog-header">
        <mat-icon>file_download</mat-icon>
        <h2>Export Maintenance to Excel</h2>
      </div>
      <div mat-dialog-content class="dialog-content">
        <p>Choose what you would like to export:</p>
        <button type="button" class="scope-option"
                [class.disabled]="!data.hasActiveFilters"
                [disabled]="!data.hasActiveFilters"
                (click)="choose('filtered')">
          <mat-icon>filter_alt</mat-icon>
          <div class="scope-text">
            <span class="scope-title">Filtered view</span>
            <span class="scope-sub">
              {{ data.hasActiveFilters ? (data.filteredCount + ' record(s) matching current filters') : 'No filters applied' }}
            </span>
          </div>
        </button>
        <button type="button" class="scope-option" (click)="choose('all')">
          <mat-icon>list_alt</mat-icon>
          <div class="scope-text">
            <span class="scope-title">All records</span>
            <span class="scope-sub">Export every maintenance record ({{ data.totalCount }})</span>
          </div>
        </button>
      </div>
      <div mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
      </div>
    </div>
  `,
  styles: [`
    .export-scope-dialog { min-width: 360px; }
    .dialog-header {
      display: flex; align-items: center; gap: 12px;
      padding: 16px 24px; margin: -24px -24px 0 -24px;
      background: #3949ab; color: white; border-radius: 4px 4px 0 0;
    }
    .dialog-header h2 { margin: 0; font-size: 18px; }
    .dialog-content { padding-top: 20px; }
    .dialog-content > p { margin: 0 0 12px; color: #555; font-size: 14px; }
    .scope-option {
      display: flex; align-items: center; gap: 14px; width: 100%;
      text-align: left; padding: 14px 16px; margin-bottom: 10px;
      border: 1px solid #d0d0d0; border-radius: 8px; background: #fafafa;
      cursor: pointer; transition: all .15s ease;
    }
    .scope-option:hover:not(.disabled) { border-color: #3949ab; background: #eef1fb; }
    .scope-option.disabled { opacity: .5; cursor: not-allowed; }
    .scope-option mat-icon { color: #3949ab; font-size: 26px; width: 26px; height: 26px; }
    .scope-text { display: flex; flex-direction: column; }
    .scope-title { font-weight: 600; font-size: 14px; color: #222; }
    .scope-sub { font-size: 12px; color: #777; }
  `]
})
export class MaintenanceExportScopeDialog {
  constructor(
    public dialogRef: MatDialogRef<MaintenanceExportScopeDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { hasActiveFilters: boolean; filteredCount: number; totalCount: number }
  ) {}

  choose(scope: 'all' | 'filtered'): void {
    this.dialogRef.close(scope);
  }
}

@Component({
  selector: 'app-sync-result-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule
  ],
  template: `
    <div class="sync-result-dialog">
      <div class="dialog-header" [class.success]="data.success" [class.error]="!data.success">
        <mat-icon>{{ data.success ? 'check_circle' : 'error' }}</mat-icon>
        <h2>{{ data.success ? 'Sync Complete' : 'Sync Failed' }}</h2>
      </div>
      
      <div mat-dialog-content class="dialog-content">
        <p class="message">{{ data.message }}</p>
        
        @if (data.success) {
          <div class="stats-grid">
            <div class="stat-box vehicles">
              <div class="stat-value">{{ data.vehiclesCreated }}</div>
              <div class="stat-label">Vehicles Created</div>
            </div>
            <div class="stat-box vehicles">
              <div class="stat-value">{{ data.vehiclesUpdated }}</div>
              <div class="stat-label">Vehicles Updated</div>
            </div>
            <div class="stat-box drivers">
              <div class="stat-value">{{ data.driversCreated }}</div>
              <div class="stat-label">Drivers Created</div>
            </div>
            <div class="stat-box drivers">
              <div class="stat-value">{{ data.driversUpdated }}</div>
              <div class="stat-label">Drivers Found</div>
            </div>
          </div>
          
          <div class="total-info">
            <mat-icon>cloud_download</mat-icon>
            <span>{{ data.totalCarTrackVehicles }} vehicles retrieved from CarTrack</span>
          </div>
          
          @if (data.syncedVehicles && data.syncedVehicles.length > 0) {
            <details class="sync-details">
              <summary>View Synced Vehicles ({{ data.syncedVehicles.length }})</summary>
              <div class="sync-list">
                @for (v of data.syncedVehicles; track v) {
                  <mat-chip>{{ v }}</mat-chip>
                }
              </div>
            </details>
          }
          
          @if (data.syncedDrivers && data.syncedDrivers.length > 0) {
            <details class="sync-details">
              <summary>View Drivers ({{ data.syncedDrivers.length }})</summary>
              <div class="sync-list">
                @for (d of data.syncedDrivers; track d) {
                  <mat-chip>{{ d }}</mat-chip>
                }
              </div>
            </details>
          }
        }
      </div>
      
      <div mat-dialog-actions align="end">
        <button mat-raised-button color="primary" mat-dialog-close>Close</button>
      </div>
    </div>
  `,
  styles: [`
    .sync-result-dialog {
      min-width: 400px;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      margin: -24px -24px 0 -24px;
      border-radius: 4px 4px 0 0;
    }
    .dialog-header.success {
      background: #4caf50;
      color: white;
    }
    .dialog-header.error {
      background: #f44336;
      color: white;
    }
    .dialog-header mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .dialog-header h2 {
      margin: 0;
      font-size: 20px;
    }
    .dialog-content {
      padding-top: 20px;
    }
    .message {
      font-size: 14px;
      color: #666;
      margin-bottom: 20px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .stat-box {
      text-align: center;
      padding: 16px;
      border-radius: 8px;
      background: #f5f5f5;
    }
    .stat-box.vehicles {
      background: #e3f2fd;
    }
    .stat-box.drivers {
      background: #e8f5e9;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #1976d2;
    }
    .stat-box.drivers .stat-value {
      color: #4caf50;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    .total-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fff3e0;
      border-radius: 8px;
      margin-bottom: 16px;
      color: #e65100;
    }
    .sync-details {
      margin-top: 12px;
    }
    .sync-details summary {
      cursor: pointer;
      font-weight: 500;
      color: #1976d2;
      margin-bottom: 8px;
    }
    .sync-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      max-height: 150px;
      overflow-y: auto;
      padding: 8px;
      background: #fafafa;
      border-radius: 4px;
    }
    .sync-list mat-chip {
      font-size: 11px;
    }
  `]
})
export class SyncResultDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<SyncResultDialogComponent>
  ) {}
}

// Suggested Trips Dialog Component
@Component({
  selector: 'app-suggested-trips-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatExpansionModule,
    MatBadgeModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>lightbulb</mat-icon> AI-Suggested Optimized Trips
    </h2>
    
    <mat-dialog-content>
      @if (loading) {
        <div class="loading-state">
          <mat-spinner diameter="50"></mat-spinner>
          <p>Analyzing pending invoices and optimizing routes...</p>
        </div>
      } @else if (suggestedTrips.length === 0) {
        <div class="empty-state">
          <mat-icon>info</mat-icon>
          <h3>No Suggestions Available</h3>
          <p>There are no pending invoices to create trips from.</p>
        </div>
      } @else {
        <div class="suggestions-summary">
          <mat-icon>analytics</mat-icon>
          <span>Found <strong>{{suggestedTrips.length}}</strong> optimized trip configurations covering <strong>{{totalInvoices}}</strong> invoices</span>
        </div>

        <div class="suggested-trips-list">
          @for (trip of suggestedTrips; track $index) {
            <mat-card class="trip-card" [class.selected]="selectedTrip === trip">
              <mat-card-header>
                <div class="trip-header">
                  <div class="trip-title">
                    <h3>{{trip.suggestedLoadNumber}}</h3>
                    <mat-chip-set>
                      <mat-chip [class]="'priority-' + trip.priority.toLowerCase()">
                        {{trip.priority}}
                      </mat-chip>
                      <mat-chip>Score: {{trip.optimizationScore | number:'1.0-0'}}</mat-chip>
                    </mat-chip-set>
                  </div>
                  <button mat-raised-button color="primary" (click)="createTrip(trip)">
                    <mat-icon>add</mat-icon> Create This Trip
                  </button>
                </div>
              </mat-card-header>
              
              <mat-card-content>
                <div class="trip-stats">
                  <div class="stat">
                    <mat-icon>location_on</mat-icon>
                    <div>
                      <strong>{{trip.province}}</strong>
                      <span>{{trip.primaryCity}}</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>people</mat-icon>
                    <div>
                      <strong>{{trip.uniqueCustomers}}</strong>
                      <span>Customers</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>description</mat-icon>
                    <div>
                      <strong>{{trip.totalInvoices}}</strong>
                      <span>Invoices</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>attach_money</mat-icon>
                    <div>
                      <strong>R{{ (trip.totalWithVat || trip.totalValue * 1.15) | number:'1.2-2'}}</strong>
                      <span>Total (incl. VAT)</span>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>local_shipping</mat-icon>
                    <div>
                      <strong>{{trip.recommendedVehicleType}}</strong>
                      <span>Vehicle Type</span>
                    </div>
                  </div>
                </div>

                <mat-accordion>
                  <mat-expansion-panel>
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>people</mat-icon>
                        Customers ({{trip.customers.length}})
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <div class="customers-list">
                      @for (customer of trip.customers; track $index) {
                        <div class="customer-item">
                          <div>
                            <strong>{{customer.customerName}}</strong>
                            <span class="customer-code">{{customer.customerNumber}}</span>
                          </div>
                          <div class="customer-details">
                            <span>{{customer.city}}</span>
                            <mat-chip>{{customer.invoiceCount}} invoice(s)</mat-chip>
                            <strong>R{{customer.totalAmount * 1.15 | number:'1.2-2'}}</strong>
                          </div>
                        </div>
                      }
                    </div>
                  </mat-expansion-panel>

                  <mat-expansion-panel>
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>list</mat-icon>
                        Invoices ({{trip.invoices.length}})
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <div class="invoices-list">
                      @for (invoice of trip.invoices; track $index) {
                        <div class="invoice-item">
                          <span class="invoice-number">{{invoice.transactionNumber}}</span>
                          <span class="customer-name">{{invoice.customerName}}</span>
                          <span class="product">{{invoice.productDescription}}</span>
                          <strong>R{{invoice.amount * 1.15 | number:'1.2-2'}}</strong>
                        </div>
                      }
                    </div>
                  </mat-expansion-panel>
                </mat-accordion>

                <div class="trip-notes">
                  <mat-icon>info</mat-icon>
                  <span>{{trip.notes}}</span>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="close()">Close</button>
      <button mat-raised-button color="accent" (click)="createAllTrips()" [disabled]="loading || suggestedTrips.length === 0">
        <mat-icon>playlist_add</mat-icon> Create All Suggested Trips
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      max-height: 70vh;
      padding: 0 24px;
    }
    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      text-align: center;
      color: #666;
    }
    .loading-state mat-icon, .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      color: #1976d2;
    }
    .suggestions-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
      border-radius: 8px;
      margin-bottom: 24px;
    }
    .suggestions-summary mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .suggested-trips-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .trip-card {
      border-left: 4px solid #1976d2;
    }
    .trip-card.selected {
      border-left-color: #4caf50;
      background: #f1f8e9;
    }
    .trip-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 8px 0;
    }
    .trip-title {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .trip-title h3 {
      margin: 0;
      font-size: 18px;
    }
    mat-chip.priority-urgent {
      background: #f44336 !important;
      color: white !important;
    }
    mat-chip.priority-high {
      background: #ff9800 !important;
      color: white !important;
    }
    mat-chip.priority-normal {
      background: #4caf50 !important;
      color: white !important;
    }
    .trip-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin: 16px 0;
    }
    .stat {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .stat mat-icon {
      color: #1976d2;
    }
    .stat div {
      display: flex;
      flex-direction: column;
    }
    .stat strong {
      font-size: 16px;
      color: #333;
    }
    .stat span {
      font-size: 12px;
      color: #666;
    }
    .customers-list, .invoices-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    .customer-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: #fafafa;
      border-radius: 4px;
      border-left: 3px solid #2196f3;
    }
    .customer-code {
      margin-left: 8px;
      padding: 2px 8px;
      background: #e3f2fd;
      border-radius: 12px;
      font-size: 11px;
      color: #1976d2;
    }
    .customer-details {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
    }
    .invoice-item {
      display: grid;
      grid-template-columns: 120px 1fr 2fr 120px;
      gap: 12px;
      align-items: center;
      padding: 8px 12px;
      background: #fafafa;
      border-radius: 4px;
      font-size: 13px;
    }
    .invoice-number {
      font-weight: 600;
      color: #1976d2;
    }
    .customer-name {
      color: #666;
    }
    .product {
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .trip-notes {
      display: flex;
      align-items: start;
      gap: 8px;
      padding: 12px;
      background: #e3f2fd;
      border-radius: 8px;
      margin-top: 16px;
      color: #1565c0;
      font-size: 14px;
    }
    .trip-notes mat-icon {
      color: #1976d2;
      flex-shrink: 0;
    }
    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class SuggestedTripsDialog implements OnInit {
  loading = true;
  suggestedTrips: any[] = [];
  selectedTrip: any = null;
  totalInvoices = 0;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { apiUrl: string },
    private dialogRef: MatDialogRef<SuggestedTripsDialog>,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    this.http.get<any[]>(`${this.data.apiUrl}/logistics/importedinvoices/suggested-loads`).subscribe({
      next: (trips) => {
        this.suggestedTrips = trips;
        this.totalInvoices = trips.reduce((sum, trip) => sum + trip.totalInvoices, 0);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load suggested trips:', err);
        alert('Failed to load suggestions: ' + (err.error?.message || err.message));
        this.loading = false;
      }
    });
  }

  createTrip(trip: any): void {
    this.selectedTrip = trip;
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
      invoiceIds: trip.invoiceIds,
      notes: trip.notes
    }).subscribe({
      next: (result) => {
        alert(`Trip ${result.loadNumber} created successfully with ${result.stops} stops!`);
        this.dialogRef.close(true);
      },
      error: (err) => {
        console.error('Failed to create trip:', err);
        alert('Failed to create trip: ' + (err.error?.message || err.message));
        this.selectedTrip = null;
      }
    });
  }

  createAllTrips(): void {
    if (!confirm(`Create all ${this.suggestedTrips.length} suggested trips?`)) {
      return;
    }

    let completed = 0;
    const total = this.suggestedTrips.length;

    this.suggestedTrips.forEach((trip, index) => {
      setTimeout(() => {
        this.http.post<any>(`${this.data.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
          invoiceIds: trip.invoiceIds,
          notes: trip.notes
        }).subscribe({
          next: (result) => {
            completed++;
            if (completed === total) {
              alert(`Successfully created all ${total} trips!`);
              this.dialogRef.close(true);
            }
          },
          error: (err) => {
            console.error('Failed to create trip:', err);
            completed++;
            if (completed === total) {
              alert(`Created ${completed} of ${total} trips. Some failed.`);
              this.dialogRef.close(true);
            }
          }
        });
      }, index * 500); // Stagger requests
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}

// TFN Orders List Dialog Component
@Component({
  selector: 'app-tfn-orders-list-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    FormsModule
  ],
  template: `
    <div class="tfn-orders-dialog">
      <!-- Header -->
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-wrap">
            <mat-icon>local_gas_station</mat-icon>
          </div>
          <div class="header-text">
            <h2>TFN Fuel Orders</h2>
            <span class="header-sub">{{ data.orders.length }} total orders · Last synced just now</span>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Summary Stats -->
      <div class="summary-strip">
        <div class="summary-stat">
          <div class="summary-icon total"><mat-icon>receipt_long</mat-icon></div>
          <div class="summary-info">
            <span class="summary-value">{{ data.orders.length }}</span>
            <span class="summary-label">Total</span>
          </div>
        </div>
        <div class="summary-stat">
          <div class="summary-icon complete"><mat-icon>check_circle</mat-icon></div>
          <div class="summary-info">
            <span class="summary-value">{{ getStatusCount('complete') }}</span>
            <span class="summary-label">Complete</span>
          </div>
        </div>
        <div class="summary-stat">
          <div class="summary-icon active"><mat-icon>play_circle</mat-icon></div>
          <div class="summary-info">
            <span class="summary-value">{{ getStatusCount('active') }}</span>
            <span class="summary-label">Active</span>
          </div>
        </div>
        <div class="summary-stat">
          <div class="summary-icon pending"><mat-icon>pending</mat-icon></div>
          <div class="summary-info">
            <span class="summary-value">{{ getStatusCount('pending') }}</span>
            <span class="summary-label">Pending</span>
          </div>
        </div>
        <div class="summary-stat fuel">
          <div class="summary-icon fuel-icon"><mat-icon>opacity</mat-icon></div>
          <div class="summary-info">
            <span class="summary-value">{{ getTotalLitres() | number:'1.0-0' }}L</span>
            <span class="summary-label">Total Allocated</span>
          </div>
        </div>
      </div>

      <div class="dialog-content">
        <!-- Search & Filters -->
        <div class="toolbar">
          <div class="search-wrap">
            <mat-icon class="search-icon">search</mat-icon>
            <input class="search-input" [(ngModel)]="searchTerm" (input)="filterOrders()" placeholder="Search orders, vehicles, cards...">
            @if (searchTerm) {
              <button class="clear-btn" (click)="searchTerm = ''; filterOrders()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>
          <div class="filter-chips">
            <button class="chip" [class.active]="activeFilter === 'all'" (click)="setFilter('all')">
              All <span class="chip-count">{{ data.orders.length }}</span>
            </button>
            <button class="chip" [class.active]="activeFilter === 'complete'" (click)="setFilter('complete')">
              Complete <span class="chip-count">{{ getStatusCount('complete') }}</span>
            </button>
            <button class="chip" [class.active]="activeFilter === 'active'" (click)="setFilter('active')">
              Active <span class="chip-count">{{ getStatusCount('active') }}</span>
            </button>
            <button class="chip" [class.active]="activeFilter === 'pending'" (click)="setFilter('pending')">
              Pending <span class="chip-count">{{ getStatusCount('pending') }}</span>
            </button>
          </div>
          <div class="results-badge">
            <mat-icon>filter_list</mat-icon>
            {{ filteredOrders.length }} result{{ filteredOrders.length !== 1 ? 's' : '' }}
          </div>
        </div>

        <!-- Orders Grid -->
        <div class="orders-grid">
          @for (order of filteredOrders; track $index) {
            <div class="order-card" (click)="viewOrderDetails(order)" [class]="'card-' + getStatusKey(order.status)">
              <!-- Card Header -->
              <div class="card-header">
                <div class="card-order-id">
                  <mat-icon>receipt</mat-icon>
                  <span>{{ getShortOrderNumber(order.orderNumber) }}</span>
                </div>
                <span class="status-badge" [class]="getStatusClass(order.status)">
                  <span class="status-dot"></span>
                  {{ getShortStatus(order.status) }}
                </span>
              </div>

              <!-- Vehicle Row -->
              <div class="card-vehicle">
                <div class="vehicle-plate">
                  <mat-icon>directions_car</mat-icon>
                  <span class="plate-text">{{ order.vehicleRegistration || order.vehicle?.registrationNumber || '—' }}</span>
                </div>
                @if (order.virtualCardNumber) {
                  <span class="virtual-card">
                    <mat-icon>credit_card</mat-icon>
                    {{ order.virtualCardNumber | slice:0:12 }}{{ order.virtualCardNumber?.length > 12 ? '...' : '' }}
                  </span>
                }
              </div>

              <!-- Fuel Gauge -->
              <div class="fuel-gauge-section">
                <div class="gauge-header">
                  <span class="fuel-type-badge">{{ getProductName(order.productCode) }}</span>
                  <span class="fuel-amount">{{ order.allocatedLitres | number:'1.0-0' }}L allocated</span>
                </div>
                <div class="fuel-gauge-bar">
                  <div class="gauge-fill" [style.width.%]="getUsagePercent(order)"
                       [class.low]="getUsagePercent(order) < 30"
                       [class.mid]="getUsagePercent(order) >= 30 && getUsagePercent(order) < 70"
                       [class.high]="getUsagePercent(order) >= 70">
                  </div>
                </div>
                <div class="gauge-labels">
                  <span class="used-label">{{ order.usedLitres | number:'1.0-0' }}L used</span>
                  <span class="remaining-label">{{ order.remainingLitres | number:'1.0-0' }}L left</span>
                </div>
              </div>

              <!-- Card Footer -->
              <div class="card-footer">
                <div class="date-info">
                  <mat-icon>calendar_today</mat-icon>
                  <span>{{ formatDate(order.orderDate) }}</span>
                </div>
                <mat-icon class="card-arrow">arrow_forward</mat-icon>
              </div>
            </div>
          } @empty {
            <div class="no-orders">
              <div class="empty-illustration">
                <mat-icon>local_gas_station</mat-icon>
              </div>
              <h3>No orders found</h3>
              <p>Try adjusting your search or filter criteria</p>
            </div>
          }
        </div>
      </div>

      <mat-dialog-actions align="end">
        <span class="dialog-footer-info">Data from TFN · {{ data.orders.length }} orders loaded</span>
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .tfn-orders-dialog { width: 100%; overflow: hidden; }

    /* ── Header ─────────────────────────────────────────────── */
    .dialog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 24px 32px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      color: white; margin: -24px -24px 0 -24px; position: relative; overflow: hidden;
    }
    .dialog-header::before {
      content: ''; position: absolute; top: -50%; right: -10%; width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(245,87,108,0.15) 0%, transparent 70%);
      border-radius: 50%;
    }
    .dialog-header::after {
      content: ''; position: absolute; bottom: -60%; left: 20%; width: 200px; height: 200px;
      background: radial-gradient(circle, rgba(240,147,251,0.1) 0%, transparent 70%);
      border-radius: 50%;
    }
    .header-left { display: flex; align-items: center; gap: 16px; position: relative; z-index: 1; }
    .header-icon-wrap {
      width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #f5576c, #60a5fa); box-shadow: 0 4px 15px rgba(245,87,108,0.4);
    }
    .header-icon-wrap mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .header-text h2 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: -0.3px; }
    .header-sub { font-size: 13px; opacity: 0.7; }
    .close-btn { color: rgba(255,255,255,0.7); position: relative; z-index: 1; }
    .close-btn:hover { color: white; }

    /* ── Summary Strip ──────────────────────────────────────── */
    .summary-strip {
      display: flex; gap: 0; padding: 0; margin: 0 -24px;
      background: #f8f9fc; border-bottom: 1px solid #eef0f5;
    }
    .summary-stat {
      flex: 1; display: flex; align-items: center; gap: 12px; padding: 16px 20px;
      border-right: 1px solid #eef0f5; transition: background 0.2s;
    }
    .summary-stat:last-child { border-right: none; }
    .summary-stat:hover { background: #f0f2f8; }
    .summary-icon {
      width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center;
    }
    .summary-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .summary-icon.total { background: #e8eaf6; color: #3f51b5; }
    .summary-icon.complete { background: #e8f5e9; color: #2e7d32; }
    .summary-icon.active { background: #e3f2fd; color: #1565c0; }
    .summary-icon.pending { background: #fff3e0; color: #e65100; }
    .summary-icon.fuel-icon { background: linear-gradient(135deg, #e0f7fa, #b2ebf2); color: #00838f; }
    .summary-info { display: flex; flex-direction: column; }
    .summary-value { font-size: 18px; font-weight: 700; color: #1a1a2e; }
    .summary-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }

    /* ── Content ────────────────────────────────────────────── */
    .dialog-content { padding: 20px 8px; max-height: 60vh; overflow-y: auto; overflow-x: hidden; }

    /* ── Toolbar ────────────────────────────────────────────── */
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding-bottom: 20px; }
    .search-wrap {
      display: flex; align-items: center; gap: 8px; flex: 1; min-width: 220px; max-width: 360px;
      background: #f5f6fa; border: 2px solid transparent; border-radius: 12px;
      padding: 0 14px; height: 44px; transition: all 0.2s;
    }
    .search-wrap:focus-within { border-color: #f5576c; background: white; box-shadow: 0 0 0 4px rgba(245,87,108,0.1); }
    .search-icon { color: #aaa; font-size: 20px; width: 20px; height: 20px; }
    .search-input {
      flex: 1; border: none; outline: none; background: transparent; font-size: 14px; color: #333;
    }
    .search-input::placeholder { color: #bbb; }
    .clear-btn {
      background: none; border: none; cursor: pointer; padding: 2px; display: flex; color: #999;
    }
    .clear-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip {
      display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 20px;
      border: 1.5px solid #e0e0e0; background: white; cursor: pointer; font-size: 13px;
      color: #666; transition: all 0.2s; font-weight: 500;
    }
    .chip:hover { border-color: #f5576c; color: #f5576c; }
    .chip.active { background: linear-gradient(135deg, #f5576c, #60a5fa); color: white; border-color: transparent; box-shadow: 0 2px 8px rgba(245,87,108,0.3); }
    .chip.active .chip-count { background: rgba(255,255,255,0.25); color: white; }
    .chip-count {
      font-size: 11px; background: #f0f0f0; padding: 1px 7px; border-radius: 10px;
      font-weight: 600; color: #999;
    }
    .results-badge {
      display: flex; align-items: center; gap: 4px; font-size: 13px; color: #999;
      margin-left: auto; white-space: nowrap;
    }
    .results-badge mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* ── Orders Grid ────────────────────────────────────────── */
    .orders-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px;
    }

    /* ── Order Card ─────────────────────────────────────────── */
    .order-card {
      background: white; border-radius: 16px; padding: 20px; cursor: pointer;
      border: 1px solid #eef0f5; transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative; overflow: hidden;
    }
    .order-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, #f5576c, #60a5fa); opacity: 0; transition: opacity 0.25s;
    }
    .order-card:hover {
      transform: translateY(-3px); box-shadow: 0 8px 30px rgba(0,0,0,0.08);
      border-color: rgba(245,87,108,0.2);
    }
    .order-card:hover::before { opacity: 1; }
    .card-complete::before { background: linear-gradient(90deg, #2e7d32, #66bb6a); }
    .card-active::before { background: linear-gradient(90deg, #1565c0, #42a5f5); }

    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .card-order-id { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; color: #1a1a2e; }
    .card-order-id mat-icon { font-size: 18px; width: 18px; height: 18px; color: #f5576c; }
    .status-badge {
      display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px;
      font-size: 12px; font-weight: 600; letter-spacing: 0.3px;
    }
    .status-dot { width: 7px; height: 7px; border-radius: 50%; }
    .status-active { background: #e3f2fd; color: #1565c0; }
    .status-active .status-dot { background: #1565c0; }
    .status-complete { background: #e8f5e9; color: #2e7d32; }
    .status-complete .status-dot { background: #2e7d32; }
    .status-pending, .status-not-started { background: #fff3e0; color: #e65100; }
    .status-pending .status-dot, .status-not-started .status-dot { background: #e65100; }
    .status-expired { background: #ffebee; color: #c62828; }
    .status-expired .status-dot { background: #c62828; }
    .status-cancelled { background: #f5f5f5; color: #757575; }
    .status-cancelled .status-dot { background: #757575; }
    .status-planned { background: #ede7f6; color: #5e35b1; }
    .status-planned .status-dot { background: #5e35b1; }

    /* Vehicle Row */
    .card-vehicle { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 8px; }
    .vehicle-plate {
      display: flex; align-items: center; gap: 8px; padding: 5px 12px;
      background: #f5f6fa; border-radius: 8px; font-weight: 600; color: #333; font-size: 14px;
    }
    .vehicle-plate mat-icon { font-size: 16px; width: 16px; height: 16px; color: #666; }
    .virtual-card {
      display: flex; align-items: center; gap: 4px; font-size: 12px; color: #999;
    }
    .virtual-card mat-icon { font-size: 14px; width: 14px; height: 14px; }

    /* Fuel Gauge */
    .fuel-gauge-section { margin-bottom: 14px; }
    .gauge-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .fuel-type-badge {
      padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
      background: linear-gradient(135deg, #fff8e1, #ffecb3); color: #f57f17; letter-spacing: 0.3px;
    }
    .fuel-amount { font-size: 12px; color: #999; font-weight: 500; }
    .fuel-gauge-bar {
      width: 100%; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden;
    }
    .gauge-fill {
      height: 100%; border-radius: 4px; transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      min-width: 2px;
    }
    .gauge-fill.low { background: linear-gradient(90deg, #e8f5e9, #66bb6a); }
    .gauge-fill.mid { background: linear-gradient(90deg, #fff3e0, #ffa726); }
    .gauge-fill.high { background: linear-gradient(90deg, #ffebee, #ef5350); }
    .gauge-labels { display: flex; justify-content: space-between; margin-top: 4px; }
    .used-label, .remaining-label { font-size: 11px; color: #aaa; font-weight: 500; }
    .remaining-label { color: #66bb6a; }

    /* Card Footer */
    .card-footer {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 12px; border-top: 1px solid #f5f5f5;
    }
    .date-info { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #999; }
    .date-info mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .card-arrow { color: #ddd; font-size: 18px; width: 18px; height: 18px; transition: all 0.2s; }
    .order-card:hover .card-arrow { color: #f5576c; transform: translateX(3px); }

    /* ── Empty State ────────────────────────────────────────── */
    .no-orders { grid-column: 1 / -1; text-align: center; padding: 60px 20px; }
    .empty-illustration {
      width: 80px; height: 80px; margin: 0 auto 16px; border-radius: 50%;
      background: linear-gradient(135deg, #f5f6fa, #eef0f5); display: flex;
      align-items: center; justify-content: center;
    }
    .empty-illustration mat-icon { font-size: 36px; width: 36px; height: 36px; color: #ccc; }
    .no-orders h3 { margin: 0 0 8px; color: #333; font-size: 18px; }
    .no-orders p { margin: 0; color: #999; font-size: 14px; }

    /* ── Dialog Footer ──────────────────────────────────────── */
    mat-dialog-actions { padding: 14px 28px; border-top: 1px solid #eef0f5; }
    .dialog-footer-info { font-size: 12px; color: #bbb; margin-right: auto; }

    /* ── Responsive ─────────────────────────────────────────── */
    @media (max-width: 900px) {
      .summary-strip { flex-wrap: wrap; }
      .summary-stat { min-width: calc(50% - 1px); }
      .orders-grid { grid-template-columns: 1fr; }
      .toolbar { flex-direction: column; align-items: stretch; }
      .search-wrap { max-width: none; }
      .filter-chips { overflow-x: auto; flex-wrap: nowrap; }
      .results-badge { margin-left: 0; }
    }
  `]
})
export class TfnOrdersListDialog {
  searchTerm = '';
  activeFilter = 'all';
  filteredOrders: any[] = [];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { orders: any[], apiUrl: string },
    private dialogRef: MatDialogRef<TfnOrdersListDialog>,
    private dialog: MatDialog
  ) {
    this.filteredOrders = [...this.data.orders];
  }

  filterOrders(): void {
    let orders = [...this.data.orders];

    // Apply status filter
    if (this.activeFilter !== 'all') {
      orders = orders.filter(o => this.getStatusKey(o.status) === this.activeFilter);
    }

    // Apply search
    const term = this.searchTerm.toLowerCase();
    if (term) {
      orders = orders.filter(order =>
        order.orderNumber?.toLowerCase().includes(term) ||
        order.vehicleRegistration?.toLowerCase().includes(term) ||
        order.vehicle?.registrationNumber?.toLowerCase().includes(term) ||
        order.status?.toLowerCase().includes(term) ||
        order.virtualCardNumber?.toLowerCase().includes(term)
      );
    }
    this.filteredOrders = orders;
  }

  setFilter(filter: string): void {
    this.activeFilter = filter;
    this.filterOrders();
  }

  getStatusCount(key: string): number {
    return this.data.orders.filter(o => this.getStatusKey(o.status) === key).length;
  }

  getTotalLitres(): number {
    return this.data.orders.reduce((sum: number, o: any) => sum + (o.allocatedLitres || 0), 0);
  }

  getUsagePercent(order: any): number {
    if (!order.allocatedLitres || order.allocatedLitres === 0) return 0;
    return Math.min(100, ((order.usedLitres || 0) / order.allocatedLitres) * 100);
  }

  getShortOrderNumber(orderNumber: string): string {
    if (!orderNumber) return 'N/A';
    // Show just the last part: ORD/01/5373/03879  >  03879
    const parts = orderNumber.split('/');
    return parts.length > 1 ? parts[parts.length - 1] : orderNumber;
  }

  getShortStatus(status: string): string {
    if (!status) return 'Pending';
    if (status.length > 20) return status.substring(0, 18) + '…';
    return status;
  }

  getStatusKey(status: string): string {
    if (!status) return 'pending';
    const s = status.toLowerCase();
    if (s.includes('complete')) return 'complete';
    if (s.includes('active')) return 'active';
    if (s.includes('planned')) return 'pending';
    if (s.includes('not started')) return 'pending';
    if (s.includes('expired')) return 'expired';
    if (s.includes('cancel') || s.includes('delete')) return 'cancelled';
    return 'pending';
  }

  viewOrderDetails(order: any): void {
    this.dialog.open(TfnOrderDetailsDialog, {
      width: '95vw',
      maxWidth: '900px',
      panelClass: 'tfn-order-details-dialog-panel',
      data: { order }
    });
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getProductName(code: string): string {
    if (!code) return 'N/A';
    const products: {[key: string]: string} = {
      'D0': 'Diesel 50ppm',
      'D1': 'Diesel 500ppm',
      'P0': 'Petrol 93',
      'P1': 'Petrol 95',
      'F2': 'Diesel (F2)',
      'OS': 'On-Site',
      'DIESEL': 'Diesel',
      'PETROL': 'Petrol'
    };
    return products[code.toUpperCase()] || code;
  }

  getStatusClass(status: string): string {
    if (!status) return 'status-pending';
    const s = status.toLowerCase();
    if (s.includes('complete')) return 'status-complete';
    if (s.includes('active')) return 'status-active';
    if (s.includes('planned')) return 'status-planned';
    if (s.includes('not started')) return 'status-not-started';
    if (s.includes('expired')) return 'status-expired';
    if (s.includes('cancel') || s.includes('delete')) return 'status-cancelled';
    return 'status-pending';
  }
}

// TFN Order Details Dialog Component
@Component({
  selector: 'app-tfn-order-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule
  ],
  template: `
    <div class="tfn-order-details-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>receipt_long</mat-icon>
          Order Details
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content" id="printableOrder">
        <div class="order-header">
          <div class="order-title">
            <h3>{{ data.order.orderNumber }}</h3>
            <span class="status" [class]="getStatusClass(data.order.status)">
              {{ data.order.status || 'Pending' }}
            </span>
          </div>
          <div class="order-dates">
            <div class="date-item">
              <mat-icon>event</mat-icon>
              <span>Order Date: {{ formatDate(data.order.orderDate) }}</span>
            </div>
            @if (data.order.expiryDate) {
              <div class="date-item">
                <mat-icon>event_busy</mat-icon>
                <span>Expires: {{ formatDate(data.order.expiryDate) }}</span>
              </div>
            }
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="section">
          <h4><mat-icon>directions_car</mat-icon> Vehicle Information</h4>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Registration</span>
              <span class="value">{{ data.order.vehicleRegistration || data.order.vehicle?.registrationNumber || 'N/A' }}</span>
            </div>
            <div class="info-item">
              <span class="label">Virtual Card</span>
              <span class="value">{{ data.order.virtualCardNumber || 'N/A' }}</span>
            </div>
          </div>
        </div>

        @if (data.order.driver) {
          <div class="section">
            <h4><mat-icon>person</mat-icon> Driver Information</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Driver Name</span>
                <span class="value">{{ data.order.driver?.driverName || 'N/A' }}</span>
              </div>
            </div>
          </div>
        }

        <mat-divider></mat-divider>

        <div class="section">
          <h4><mat-icon>local_gas_station</mat-icon> Fuel Allocation</h4>
          <div class="fuel-stats">
            <div class="fuel-stat">
              <div class="stat-circle allocated">
                <span class="value">{{ data.order.allocatedLitres | number:'1.0-0' }}</span>
                <span class="unit">L</span>
              </div>
              <span class="label">Allocated</span>
            </div>
            <div class="fuel-stat">
              <div class="stat-circle used">
                <span class="value">{{ data.order.usedLitres | number:'1.0-0' }}</span>
                <span class="unit">L</span>
              </div>
              <span class="label">Used</span>
            </div>
            <div class="fuel-stat">
              <div class="stat-circle remaining">
                <span class="value">{{ data.order.remainingLitres | number:'1.0-0' }}</span>
                <span class="unit">L</span>
              </div>
              <span class="label">Remaining</span>
            </div>
          </div>
          <div class="info-grid" style="margin-top: 16px;">
            <div class="info-item">
              <span class="label">Fuel Type</span>
              <span class="value">{{ getProductName(data.order.productCode) }}</span>
            </div>
            @if (data.order.allocatedAmount) {
              <div class="info-item">
                <span class="label">Allocated Amount</span>
                <span class="value">R {{ data.order.allocatedAmount | number:'1.2-2' }}</span>
              </div>
            }
            @if (data.order.usedAmount) {
              <div class="info-item">
                <span class="label">Used Amount</span>
                <span class="value">R {{ data.order.usedAmount | number:'1.2-2' }}</span>
              </div>
            }
            @if (data.order.remainingAmount) {
              <div class="info-item">
                <span class="label">Remaining Amount</span>
                <span class="value highlight">R {{ data.order.remainingAmount | number:'1.2-2' }}</span>
              </div>
            }
          </div>
        </div>

        @if (data.order.load) {
          <mat-divider></mat-divider>
          <div class="section">
            <h4><mat-icon>local_shipping</mat-icon> Linked Load</h4>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">Load Number</span>
                <span class="value">{{ data.order.load.loadNumber }}</span>
              </div>
            </div>
          </div>
        }

        @if (data.order.notes) {
          <mat-divider></mat-divider>
          <div class="section">
            <h4><mat-icon>notes</mat-icon> Notes</h4>
            <p class="notes-text">{{ data.order.notes }}</p>
          </div>
        }
      </div>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
        <button mat-raised-button color="primary" (click)="printOrder()">
          <mat-icon>print</mat-icon>
          Print
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .tfn-order-details-dialog {
      width: 100%;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 32px;
      background: linear-gradient(135deg, #2563eb, #1e40af);
      color: white;
      margin: -24px -24px 0 -24px;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      font-weight: 500;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      padding: 28px 8px;
      overflow-x: hidden;
    }
    .order-header {
      margin-bottom: 24px;
    }
    .order-title {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 12px;
    }
    .order-title h3 {
      margin: 0;
      font-size: 24px;
      color: #333;
    }
    .status {
      padding: 6px 16px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;
    }
    .status-active, .status-complete { background: #e8f5e9; color: #2e7d32; }
    .status-pending, .status-not-started { background: #fff3e0; color: #e65100; }
    .status-expired { background: #ffebee; color: #c62828; }
    .status-cancelled { background: #f5f5f5; color: #757575; }
    .order-dates {
      display: flex;
      gap: 24px;
    }
    .date-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
      font-size: 14px;
    }
    .date-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .section {
      padding: 20px 0;
    }
    .section h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
      color: #333;
      font-size: 16px;
    }
    .section h4 mat-icon {
      color: #2563eb;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .info-item .label {
      font-size: 12px;
      color: #999;
      text-transform: uppercase;
    }
    .info-item .value {
      font-size: 15px;
      color: #333;
      font-weight: 500;
    }
    .info-item .value.highlight {
      color: #4caf50;
      font-weight: 600;
    }
    .fuel-stats {
      display: flex;
      justify-content: space-around;
      gap: 24px;
    }
    .fuel-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .stat-circle {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .stat-circle.allocated { background: linear-gradient(135deg, #2563eb, #1e40af); }
    .stat-circle.used { background: linear-gradient(135deg, #60a5fa, #f5576c); }
    .stat-circle.remaining { background: linear-gradient(135deg, #11998e, #38ef7d); }
    .stat-circle .value {
      font-size: 22px;
      font-weight: 600;
      line-height: 1;
    }
    .stat-circle .unit {
      font-size: 12px;
      opacity: 0.9;
    }
    .fuel-stat .label {
      font-size: 13px;
      color: #666;
    }
    .notes-text {
      margin: 0;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
      color: #666;
      font-size: 14px;
      line-height: 1.5;
    }
    mat-divider {
      margin: 0;
    }
    mat-dialog-actions {
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
    @media print {
      .dialog-header button, mat-dialog-actions {
        display: none !important;
      }
      .dialog-header {
        background: #2563eb !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .stat-circle {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `]
})
export class TfnOrderDetailsDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { order: any },
    private dialogRef: MatDialogRef<TfnOrderDetailsDialog>
  ) {}

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getProductName(code: string): string {
    if (!code) return 'N/A';
    const products: {[key: string]: string} = {
      'D0': 'Diesel 50ppm',
      'D1': 'Diesel 500ppm',
      'P0': 'Petrol 93',
      'P1': 'Petrol 95',
      'F2': 'Diesel (F2)',
      'OS': 'On-Site',
      'DIESEL': 'Diesel',
      'PETROL': 'Petrol'
    };
    return products[code.toUpperCase()] || code;
  }

  getStatusClass(status: string): string {
    if (!status) return 'status-pending';
    const s = status.toLowerCase();
    if (s.includes('complete')) return 'status-complete';
    if (s.includes('active')) return 'status-active';
    if (s.includes('not started')) return 'status-not-started';
    if (s.includes('expired')) return 'status-expired';
    if (s.includes('cancel') || s.includes('delete')) return 'status-cancelled';
    return 'status-pending';
  }

  printOrder(): void {
    const printContent = document.getElementById('printableOrder');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the order');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>TFN Order - ${this.data.order.orderNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .print-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #2563eb;
          }
          .print-header h1 {
            color: #2563eb;
            margin: 0 0 8px 0;
          }
          .print-header p {
            color: #666;
            margin: 0;
          }
          .order-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 15px;
            background: #f5f5f5;
            border-radius: 8px;
          }
          .order-number {
            font-size: 24px;
            font-weight: bold;
            color: #333;
          }
          .order-status {
            padding: 8px 16px;
            border-radius: 20px;
            background: #e8f5e9;
            color: #2e7d32;
            font-weight: 500;
          }
          .section {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
          }
          .section h3 {
            margin: 0 0 15px 0;
            color: #2563eb;
            font-size: 16px;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 8px;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px dashed #eee;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .info-label {
            color: #666;
          }
          .info-value {
            font-weight: 500;
            color: #333;
          }
          .fuel-summary {
            display: flex;
            justify-content: space-around;
            text-align: center;
            padding: 20px 0;
          }
          .fuel-item {
            padding: 15px 25px;
            background: #f5f5f5;
            border-radius: 8px;
          }
          .fuel-item .value {
            font-size: 28px;
            font-weight: bold;
            color: #2563eb;
          }
          .fuel-item .label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
          }
          .print-footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <h1>TFN Fuel Order</h1>
          <p>ProMed Technologies - Logistics Department</p>
        </div>
        
        <div class="order-info">
          <span class="order-number">${this.data.order.orderNumber}</span>
          <span class="order-status">${this.data.order.status || 'Pending'}</span>
        </div>
        
        <div class="section">
          <h3>Order Information</h3>
          <div class="info-row">
            <span class="info-label">Order Date</span>
            <span class="info-value">${this.formatDate(this.data.order.orderDate)}</span>
          </div>
          ${this.data.order.expiryDate ? `
          <div class="info-row">
            <span class="info-label">Expiry Date</span>
            <span class="info-value">${this.formatDate(this.data.order.expiryDate)}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Fuel Type</span>
            <span class="info-value">${this.getProductName(this.data.order.productCode)}</span>
          </div>
        </div>
        
        <div class="section">
          <h3>Vehicle Information</h3>
          <div class="info-row">
            <span class="info-label">Registration</span>
            <span class="info-value">${this.data.order.vehicleRegistration || this.data.order.vehicle?.registrationNumber || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Virtual Card</span>
            <span class="info-value">${this.data.order.virtualCardNumber || 'N/A'}</span>
          </div>
          ${this.data.order.driver ? `
          <div class="info-row">
            <span class="info-label">Driver</span>
            <span class="info-value">${this.data.order.driver.driverName || 'N/A'}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="section">
          <h3>Fuel Allocation</h3>
          <div class="fuel-summary">
            <div class="fuel-item">
              <div class="value">${this.data.order.allocatedLitres || 0}</div>
              <div class="label">Allocated (L)</div>
            </div>
            <div class="fuel-item">
              <div class="value">${this.data.order.usedLitres || 0}</div>
              <div class="label">Used (L)</div>
            </div>
            <div class="fuel-item">
              <div class="value">${this.data.order.remainingLitres || 0}</div>
              <div class="label">Remaining (L)</div>
            </div>
          </div>
          ${this.data.order.allocatedAmount ? `
          <div class="info-row">
            <span class="info-label">Allocated Amount</span>
            <span class="info-value">R ${this.data.order.allocatedAmount?.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>
        
        ${this.data.order.notes ? `
        <div class="section">
          <h3>Notes</h3>
          <p>${this.data.order.notes}</p>
        </div>
        ` : ''}
        
        <div class="print-footer">
          <p>Printed on ${new Date().toLocaleString('en-ZA')}</p>
          <p>TFN Integration - ProMed Technologies Intranet</p>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}

// Incoming Delivery Requests Dialog Component
@Component({
  selector: 'app-incoming-requests-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatTooltipModule,
    FormsModule
  ],
  template: `
    <div class="requests-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>move_to_inbox</mat-icon>
          Incoming Delivery Requests
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Summary Cards -->
        <div class="summary-cards">
          <div class="summary-card pending">
            <span class="count">{{ getSummaryCount('Pending') }}</span>
            <span class="label">Pending</span>
          </div>
          <div class="summary-card approved">
            <span class="count">{{ getSummaryCount('Approved') }}</span>
            <span class="label">Approved</span>
          </div>
          <div class="summary-card in-transit">
            <span class="count">{{ getSummaryCount('In Transit') }}</span>
            <span class="label">In Transit</span>
          </div>
          <div class="summary-card delivered">
            <span class="count">{{ getSummaryCount('Delivered') }}</span>
            <span class="label">Delivered</span>
          </div>
        </div>

        <div class="toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="filterRequests()" placeholder="Search by reference, invoice, department">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="statusFilter" (selectionChange)="filterRequests()">
              <mat-option value="all">All Active</mat-option>
              <mat-option value="Pending">Pending</mat-option>
              <mat-option value="Approved">Approved</mat-option>
              <mat-option value="In Transit">In Transit</mat-option>
              <mat-option value="Delivered">Delivered</mat-option>
              <mat-option value="Cancelled">Cancelled</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Department</mat-label>
            <mat-select [(ngModel)]="departmentFilter" (selectionChange)="filterRequests()">
              <mat-option value="all">All Departments</mat-option>
              @for (dept of departments; track dept) {
                <mat-option [value]="dept">{{ dept }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="priorityFilter" (selectionChange)="filterRequests()">
              <mat-option value="all">All</mat-option>
              <mat-option value="Urgent">Urgent</mat-option>
              <mat-option value="Normal">Normal</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Requests List -->
        <div class="requests-list">
          @for (req of filteredRequests; track req.id) {
            <div class="request-card" [class.urgent]="req.priority === 'Urgent'"
                 [class.status-pending]="req.status === 'Pending'"
                 [class.status-approved]="req.status === 'Approved'"
                 [class.status-in-transit]="req.status === 'In Transit'"
                 [class.status-delivered]="req.status === 'Delivered'"
                 [class.status-cancelled]="req.status === 'Cancelled'">
              <div class="request-header">
                <div class="request-ref">
                  <span class="ref-number">{{ req.referenceNumber }}</span>
                  @if (req.priority === 'Urgent') {
                    <span class="priority-badge urgent">
                      <mat-icon>priority_high</mat-icon> URGENT
                    </span>
                  }
                </div>
                <span class="dept-badge" [class]="'dept-' + req.department.toLowerCase().replace(' ', '-')">
                  {{ req.department }}
                </span>
              </div>

              <div class="request-body">
                <div class="request-info">
                  @if (req.description) {
                    <div class="info-row">
                      <mat-icon>description</mat-icon>
                      <span>{{ req.description }}</span>
                    </div>
                  }
                  @if (req.invoiceNumber) {
                    <div class="info-row">
                      <mat-icon>receipt</mat-icon>
                      <span>Invoice: {{ req.invoiceNumber }}</span>
                    </div>
                  }
                  <div class="info-row">
                    <mat-icon>inventory_2</mat-icon>
                    <span>{{ req.quantity }} {{ req.unitOfMeasure }}</span>
                    @if (req.scent) { <span class="detail-chip">{{ req.scent }}</span> }
                    @if (req.type) { <span class="detail-chip">{{ req.type }}</span> }
                  </div>
                  @if (req.deliveryAddress) {
                    <div class="info-row">
                      <mat-icon>location_on</mat-icon>
                      <span>{{ req.deliveryAddress }}</span>
                    </div>
                  }
                  @if (req.notes) {
                    <div class="info-row notes">
                      <mat-icon>notes</mat-icon>
                      <span>{{ req.notes }}</span>
                    </div>
                  }
                </div>

                <div class="request-meta">
                  <div class="meta-item">
                    <mat-icon>schedule</mat-icon>
                    <span>Requested: {{ formatDate(req.requestedDate) }}</span>
                  </div>
                  @if (req.requestedBy) {
                    <div class="meta-item">
                      <mat-icon>person</mat-icon>
                      <span>By: {{ req.requestedBy }}</span>
                    </div>
                  }
                  @if (req.handledBy) {
                    <div class="meta-item">
                      <mat-icon>local_shipping</mat-icon>
                      <span>{{ req.handledBy }}</span>
                    </div>
                  }
                </div>
              </div>

              <div class="request-actions">
                <span class="status-badge" [class]="'status-' + req.status.toLowerCase().replace(' ', '-')">
                  {{ req.status }}
                </span>

                @if (req.status === 'Pending') {
                  <button mat-icon-button color="primary" (click)="updateStatus(req, 'Approved')" matTooltip="Approve">
                    <mat-icon>check_circle</mat-icon>
                  </button>
                  <button mat-icon-button color="warn" (click)="updateStatus(req, 'Cancelled')" matTooltip="Cancel Request">
                    <mat-icon>cancel</mat-icon>
                  </button>
                }
                @if (req.status === 'Approved') {
                  <button mat-icon-button color="accent" (click)="updateStatus(req, 'In Transit')" matTooltip="Mark In Transit">
                    <mat-icon>local_shipping</mat-icon>
                  </button>
                }
                @if (req.status === 'In Transit') {
                  <button mat-icon-button color="primary" (click)="updateStatus(req, 'Delivered')" matTooltip="Mark Delivered">
                    <mat-icon>check_circle_outline</mat-icon>
                  </button>
                }
              </div>
            </div>
          } @empty {
            <div class="no-data">
              <mat-icon>move_to_inbox</mat-icon>
              <p>No delivery requests found</p>
              <span class="hint">Requests will appear here when departments submit delivery requests</span>
            </div>
          }
        </div>
      </div>

      <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close('refresh')">Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .requests-dialog { width: 100%; overflow: hidden; }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 32px;
      background: linear-gradient(135deg, #ff6b6b, #ee5a24);
      color: white;
      margin: -24px -24px 0 -24px;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
    }
    .dialog-header button { color: white; }
    .dialog-content {
      padding: 24px;
      max-height: 65vh;
      overflow-y: auto;
    }
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .summary-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      border-radius: 12px;
      background: #f5f5f5;
    }
    .summary-card .count { font-size: 28px; font-weight: 700; }
    .summary-card .label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-card.pending { background: #fff3e0; }
    .summary-card.pending .count { color: #e65100; }
    .summary-card.approved { background: #e8f5e9; }
    .summary-card.approved .count { color: #2e7d32; }
    .summary-card.in-transit { background: #e3f2fd; }
    .summary-card.in-transit .count { color: #1565c0; }
    .summary-card.delivered { background: #f3e5f5; }
    .summary-card.delivered .count { color: #7b1fa2; }
    .toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .search-field { flex: 1; min-width: 200px; }
    .filter-field { width: 150px; }
    .requests-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .request-card {
      padding: 16px 20px;
      background: #fafafa;
      border-radius: 12px;
      border-left: 4px solid #ccc;
      transition: all 0.2s;
    }
    .request-card:hover {
      background: #f0f0f0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .request-card.urgent { border-left-width: 6px; }
    .request-card.status-pending { border-left-color: #ff9800; }
    .request-card.status-approved { border-left-color: #4caf50; }
    .request-card.status-in-transit { border-left-color: #2196f3; }
    .request-card.status-delivered { border-left-color: #9c27b0; }
    .request-card.status-cancelled { border-left-color: #9e9e9e; opacity: 0.7; }
    .request-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .request-ref {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ref-number {
      font-weight: 600;
      font-size: 14px;
      color: #333;
      font-family: monospace;
    }
    .priority-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .priority-badge.urgent {
      background: #ffebee;
      color: #c62828;
    }
    .priority-badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .dept-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      background: #e8eaf6;
      color: #283593;
    }
    .dept-badge.dept-condoms { background: #fce4ec; color: #880e4f; }
    .dept-badge.dept-sanitary-pads { background: #f3e5f5; color: #6a1b9a; }
    .dept-badge.dept-warehouse { background: #e8f5e9; color: #2e7d32; }
    .dept-badge.dept-general { background: #e3f2fd; color: #1565c0; }
    .request-body {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 20px;
    }
    .request-info {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .info-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #555;
    }
    .info-row mat-icon { font-size: 16px; width: 16px; height: 16px; color: #888; }
    .info-row.notes { font-style: italic; color: #888; }
    .detail-chip {
      padding: 2px 8px;
      background: #f0f0f0;
      border-radius: 8px;
      font-size: 11px;
      color: #666;
    }
    .request-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-end;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #888;
    }
    .meta-item mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .request-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed #e0e0e0;
    }
    .status-badge {
      padding: 6px 14px;
      border-radius: 14px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }
    .status-pending { background: #fff3e0; color: #e65100; }
    .status-approved { background: #e8f5e9; color: #2e7d32; }
    .status-in-transit { background: #e3f2fd; color: #1565c0; }
    .status-delivered { background: #f3e5f5; color: #7b1fa2; }
    .status-cancelled { background: #f5f5f5; color: #757575; }
    .no-data {
      text-align: center;
      padding: 60px;
      color: #999;
    }
    .no-data mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      margin-bottom: 16px;
    }
    .no-data .hint { font-size: 13px; color: #bbb; }
    mat-dialog-actions {
      padding: 16px 32px;
      border-top: 1px solid #e0e0e0;
    }
    @media (max-width: 768px) {
      .summary-cards { grid-template-columns: repeat(2, 1fr); }
      .request-body { grid-template-columns: 1fr; }
      .toolbar { flex-direction: column; align-items: stretch; }
      .request-meta { align-items: flex-start; }
    }
  `]
})
export class IncomingRequestsDialog {
  searchTerm = '';
  statusFilter = 'all';
  departmentFilter = 'all';
  priorityFilter = 'all';
  filteredRequests: DeliveryRequest[] = [];
  departments: string[] = [];

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { requests: DeliveryRequest[], apiUrl: string },
    public dialogRef: MatDialogRef<IncomingRequestsDialog>
  ) {
    this.filteredRequests = [...this.data.requests];
    this.departments = [...new Set(this.data.requests.map(r => r.department))];
  }

  filterRequests(): void {
    let filtered = [...this.data.requests];

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === this.statusFilter);
    }

    if (this.departmentFilter !== 'all') {
      filtered = filtered.filter(r => r.department === this.departmentFilter);
    }

    if (this.priorityFilter !== 'all') {
      filtered = filtered.filter(r => r.priority === this.priorityFilter);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.referenceNumber?.toLowerCase().includes(term) ||
        r.invoiceNumber?.toLowerCase().includes(term) ||
        r.department?.toLowerCase().includes(term) ||
        r.description?.toLowerCase().includes(term) ||
        r.requestedBy?.toLowerCase().includes(term)
      );
    }

    this.filteredRequests = filtered;
  }

  updateStatus(req: DeliveryRequest, newStatus: string): void {
    const action = newStatus === 'Cancelled' ? 'cancel' : 'update to ' + newStatus;
    if (!confirm(`Are you sure you want to ${action} request ${req.referenceNumber}?`)) {
      return;
    }

    this.http.put(`${this.data.apiUrl}/logistics/delivery-requests/${req.id}/status`, {
      status: newStatus,
      handledBy: 'Logistics'
    }).subscribe({
      next: () => {
        this.snackBar.open(`Request ${req.referenceNumber} updated to ${newStatus}`, 'Close', { duration: 3000 });
        this.refreshList();
      },
      error: (err) => {
        this.snackBar.open('Failed to update: ' + (err.error?.error || err.message), 'Close', { duration: 5000 });
      }
    });
  }

  private refreshList(): void {
    this.http.get<DeliveryRequest[]>(`${this.data.apiUrl}/logistics/delivery-requests`).subscribe({
      next: (requests) => {
        this.data.requests = requests;
        this.departments = [...new Set(requests.map(r => r.department))];
        this.filterRequests();
      }
    });
  }

  getSummaryCount(status: string): number {
    return this.data.requests.filter(r => r.status === status).length;
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

// Address Issues Dialog Component
interface CustomerAddressIssue {
  id: number;
  customerCode: string | null;
  name: string;
  shortName: string | null;
  address: string | null;
  physicalAddress: string | null;
  deliveryAddress: string | null;
  city: string | null;
  deliveryCity: string | null;
  province: string | null;
  deliveryProvince: string | null;
  postalCode: string | null;
  deliveryPostalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  hasMissingAddress: boolean;
  hasMissingCity: boolean;
  hasMissingProvince: boolean;
  hasMissingCoordinates: boolean;
}

@Component({
  selector: 'app-address-issues-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTableModule,
    MatTabsModule,
    MatBadgeModule,
    MatSlideToggleModule,
    FormsModule
  ],
  template: `
    <div class="address-issues-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>local_post_office</mat-icon>
          Address Issues
        </h2>
        <button mat-icon-button (click)="dialogRef.close()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="toolbar">
        <mat-form-field appearance="outline" class="search-field">
          <mat-label>Search customers</mat-label>
          <input matInput [(ngModel)]="searchTerm" (ngModelChange)="loadCustomers()" placeholder="Search by name or code...">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>
        <div class="total-count">
          <mat-icon>people</mat-icon>
          {{ totalCount }} total issues
        </div>
      </div>

      <mat-tab-group class="issue-tabs" (selectedIndexChange)="onTabChange($event)" [selectedIndex]="selectedTab">
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>home</mat-icon>
            <span>No Address</span>
            <span class="tab-badge address" *ngIf="getCountByType('address') > 0">{{ getCountByType('address') }}</span>
          </ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>location_city</mat-icon>
            <span>No City</span>
            <span class="tab-badge city" *ngIf="getCountByType('city') > 0">{{ getCountByType('city') }}</span>
          </ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>map</mat-icon>
            <span>No Province</span>
            <span class="tab-badge province" *ngIf="getCountByType('province') > 0">{{ getCountByType('province') }}</span>
          </ng-template>
        </mat-tab>
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>gps_off</mat-icon>
            <span>No GPS</span>
            <span class="tab-badge gps" *ngIf="getCountByType('coordinates') > 0">{{ getCountByType('coordinates') }}</span>
          </ng-template>
        </mat-tab>
      </mat-tab-group>

      <div class="content" *ngIf="!loading; else loadingTpl">
        <div class="tab-info">
          <span class="showing">Showing {{ filteredCustomers.length }} customers</span>
          <button class="welly-fix-btn" (click)="wellyFixAll()" [disabled]="wellyLoading || showWellyReview">
            @if (wellyLoading) {
              <mat-spinner diameter="16"></mat-spinner>
              <span>Welly is analyzing...</span>
            } @else {
              <span>🤖</span>
              <span>Ask Welly to Fix All</span>
            }
          </button>
        </div>

        <!-- Welly Review Panel -->
        @if (showWellyReview) {
          <div class="welly-review-panel">
            <div class="welly-review-header">
              <div class="welly-avatar">🤖</div>
              <div>
                <h3>Welly's Suggested Fixes</h3>
                <p>Review each suggestion below. Toggle off any you don't want to apply.</p>
              </div>
              <div class="welly-review-actions-header">
                <button mat-button (click)="toggleAllFixes(true)">
                  <mat-icon>check_box</mat-icon> Select All
                </button>
                <button mat-button (click)="toggleAllFixes(false)">
                  <mat-icon>check_box_outline_blank</mat-icon> Deselect All
                </button>
              </div>
            </div>
            <div class="welly-review-list">
              @for (fix of wellyFixes; track fix.customerId) {
                <div class="welly-review-item" [class.failed]="!fix.success" [class.rejected]="!fix.approved">
                  <div class="welly-review-toggle">
                    @if (fix.success) {
                      <mat-slide-toggle [(ngModel)]="fix.approved" color="primary"></mat-slide-toggle>
                    } @else {
                      <mat-icon class="fix-failed-icon">error_outline</mat-icon>
                    }
                  </div>
                  <div class="welly-review-info">
                    <div class="welly-review-name">
                      <strong>{{ fix.customerName }}</strong>
                      <span class="code">{{ fix.customerCode }}</span>
                    </div>
                    @if (fix.success) {
                      <div class="welly-review-suggestion">
                        <mat-icon>arrow_forward</mat-icon>
                        <span>{{ fix.suggestedFormattedAddress }}</span>
                      </div>
                      <div class="welly-review-details">
                        @if (fix.suggestedProvince) {
                          <span class="welly-chip province">{{ fix.suggestedProvince }}</span>
                        }
                        @if (fix.suggestedCity) {
                          <span class="welly-chip city">{{ fix.suggestedCity }}</span>
                        }
                        @if (fix.suggestedPostalCode) {
                          <span class="welly-chip postal">{{ fix.suggestedPostalCode }}</span>
                        }
                        @if (fix.suggestedLatitude && fix.suggestedLongitude) {
                          <span class="welly-chip gps">📍 GPS</span>
                        }
                      </div>
                    } @else {
                      <div class="welly-review-error">{{ fix.error }}</div>
                    }
                  </div>
                </div>
              }
            </div>
            <div class="welly-review-actions">
              <button mat-stroked-button (click)="cancelWellyReview()">
                <mat-icon>close</mat-icon> Cancel
              </button>
              <button mat-raised-button color="primary" (click)="applyWellyFixes()"
                      [disabled]="wellyApplying || approvedFixCount === 0">
                @if (wellyApplying) {
                  <mat-spinner diameter="18"></mat-spinner> Applying...
                } @else {
                  <mat-icon>check_circle</mat-icon>
                  Apply {{ approvedFixCount }} Fixes
                }
              </button>
            </div>
          </div>
        }

        <div class="customers-list">
          @for (customer of filteredCustomers; track customer.id) {
            <div class="customer-card" [class.editing]="editingCustomerId === customer.id">
              <div class="customer-header">
                <div class="customer-info">
                  <span class="customer-code">{{ customer.customerCode || 'N/A' }}</span>
                  <span class="customer-name">{{ customer.name }}</span>
                  @if (customer.shortName) {
                    <span class="short-name">({{ customer.shortName }})</span>
                  }
                </div>
                <div class="issue-badges">
                  @if (customer.hasMissingAddress) {
                    <mat-chip class="issue-chip address">No Address</mat-chip>
                  }
                  @if (customer.hasMissingCity) {
                    <mat-chip class="issue-chip city">No City</mat-chip>
                  }
                  @if (customer.hasMissingProvince) {
                    <mat-chip class="issue-chip province">No Province</mat-chip>
                  }
                  @if (customer.hasMissingCoordinates) {
                    <mat-chip class="issue-chip gps">No GPS</mat-chip>
                  }
                </div>
                <button mat-icon-button (click)="toggleEdit(customer)" [matTooltip]="editingCustomerId === customer.id ? 'Cancel' : 'Edit Address'">
                  <mat-icon>{{ editingCustomerId === customer.id ? 'close' : 'edit' }}</mat-icon>
                </button>
              </div>

              <div class="current-address" *ngIf="editingCustomerId !== customer.id">
                <div class="address-line" *ngIf="customer.deliveryAddress || customer.address || customer.physicalAddress">
                  <mat-icon>location_on</mat-icon>
                  <span>{{ customer.deliveryAddress || customer.address || customer.physicalAddress }}</span>
                </div>
                <div class="address-details" *ngIf="customer.city || customer.deliveryCity || customer.province || customer.deliveryProvince">
                  <span *ngIf="customer.city || customer.deliveryCity">{{ customer.deliveryCity || customer.city }}</span>
                  <span *ngIf="customer.province || customer.deliveryProvince">, {{ customer.deliveryProvince || customer.province }}</span>
                  <span *ngIf="customer.postalCode || customer.deliveryPostalCode"> {{ customer.deliveryPostalCode || customer.postalCode }}</span>
                </div>
                <div class="gps-coords" *ngIf="customer.latitude && customer.longitude">
                  <mat-icon>gps_fixed</mat-icon>
                  <span>{{ customer.latitude.toFixed(6) }}, {{ customer.longitude.toFixed(6) }}</span>
                </div>
              </div>

              <!-- Edit Form -->
              <div class="edit-form" *ngIf="editingCustomerId === customer.id">
                <div class="form-row">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Delivery Address</mat-label>
                    <input matInput [(ngModel)]="editForm.deliveryAddress" placeholder="Street address">
                  </mat-form-field>
                </div>
                <div class="form-row three-col">
                  <mat-form-field appearance="outline">
                    <mat-label>City</mat-label>
                    <input matInput [(ngModel)]="editForm.deliveryCity" placeholder="City">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Province</mat-label>
                    <mat-select [(ngModel)]="editForm.deliveryProvince">
                      <mat-option value="">Select Province</mat-option>
                      <mat-option value="Gauteng">Gauteng</mat-option>
                      <mat-option value="Western Cape">Western Cape</mat-option>
                      <mat-option value="KwaZulu-Natal">KwaZulu-Natal</mat-option>
                      <mat-option value="Eastern Cape">Eastern Cape</mat-option>
                      <mat-option value="Free State">Free State</mat-option>
                      <mat-option value="Limpopo">Limpopo</mat-option>
                      <mat-option value="Mpumalanga">Mpumalanga</mat-option>
                      <mat-option value="North West">North West</mat-option>
                      <mat-option value="Northern Cape">Northern Cape</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Postal Code</mat-label>
                    <input matInput [(ngModel)]="editForm.deliveryPostalCode" placeholder="Postal code">
                  </mat-form-field>
                </div>
                <div class="form-row two-col">
                  <mat-form-field appearance="outline">
                    <mat-label>Latitude</mat-label>
                    <input matInput type="number" step="0.000001" [(ngModel)]="editForm.latitude" placeholder="-26.2041">
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Longitude</mat-label>
                    <input matInput type="number" step="0.000001" [(ngModel)]="editForm.longitude" placeholder="28.0473">
                  </mat-form-field>
                </div>
                <div class="form-actions">
                  <button mat-stroked-button (click)="cancelEdit()">Cancel</button>
                  <button mat-raised-button color="primary" (click)="saveAddress(customer)" [disabled]="saving">
                    <mat-icon>save</mat-icon>
                    {{ saving ? 'Saving...' : 'Save Address' }}
                  </button>
                </div>
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <mat-icon>check_circle</mat-icon>
              <h3>No Issues in This Category</h3>
              <p>All customers have this information filled in.</p>
            </div>
          }
        </div>
      </div>

      <ng-template #loadingTpl>
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading customers with address issues...</p>
        </div>
      </ng-template>

      <mat-dialog-actions align="end">
        <button mat-button (click)="dialogRef.close()">Close</button>
        <button mat-raised-button color="primary" (click)="dialogRef.close('refresh')">
          <mat-icon>refresh</mat-icon>
          Done
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .address-issues-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 85vh;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px;
    }
    .close-btn { color: white; }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 24px;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
    }
    .search-field { flex: 1; min-width: 250px; margin-bottom: -20px; }
    .total-count {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      color: #666;
      background: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
    }
    .total-count mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .issue-tabs {
      background: #fafafa;
    }
    ::ng-deep .issue-tabs .mat-mdc-tab-labels {
      justify-content: center;
    }
    ::ng-deep .issue-tabs .mat-mdc-tab {
      min-width: 140px;
    }
    ::ng-deep .issue-tabs .mat-mdc-tab .mdc-tab__content {
      gap: 8px;
    }
    .tab-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      margin-left: 4px;
    }
    .tab-badge.address { background: #ffebee; color: #c62828; }
    .tab-badge.city { background: #fff3e0; color: #e65100; }
    .tab-badge.province { background: #e3f2fd; color: #1565c0; }
    .tab-badge.gps { background: #f3e5f5; color: #7b1fa2; }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
    }
    .tab-info {
      margin-bottom: 12px;
      color: #666;
      font-size: 13px;
    }
    .customers-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .customer-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      transition: all 0.2s;
    }
    .customer-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .customer-card.editing {
      border-color: #2563eb;
      box-shadow: 0 2px 12px rgba(37, 99, 235, 0.2);
    }
    .customer-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .customer-info {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .customer-code {
      font-weight: 600;
      color: #2563eb;
      background: #f0f2ff;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .customer-name {
      font-weight: 500;
      font-size: 15px;
    }
    .short-name {
      color: #888;
      font-size: 13px;
    }
    .issue-badges {
      display: flex;
      gap: 6px;
    }
    .issue-chip {
      font-size: 11px !important;
      height: 22px !important;
      padding: 0 8px !important;
    }
    .issue-chip.address { background: #ffebee !important; color: #c62828 !important; }
    .issue-chip.city { background: #fff3e0 !important; color: #e65100 !important; }
    .issue-chip.province { background: #e3f2fd !important; color: #1565c0 !important; }
    .issue-chip.gps { background: #f3e5f5 !important; color: #7b1fa2 !important; }
    .current-address {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px dashed #e0e0e0;
    }
    .address-line {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: #333;
    }
    .address-line mat-icon {
      color: #2563eb;
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .address-details {
      margin-left: 26px;
      color: #666;
      font-size: 13px;
    }
    .gps-coords {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      color: #888;
      font-size: 12px;
    }
    .gps-coords mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .edit-form {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }
    .form-row {
      display: grid;
      gap: 12px;
      margin-bottom: 8px;
    }
    .form-row.three-col { grid-template-columns: 1fr 1fr 1fr; }
    .form-row.two-col { grid-template-columns: 1fr 1fr; }
    .full-width { width: 100%; }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: #666;
    }
    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #4caf50;
      margin-bottom: 16px;
    }
    .empty-state h3 { margin: 0 0 8px; }
    .empty-state p { margin: 0; color: #888; }
    mat-dialog-actions {
      padding: 12px 24px;
      border-top: 1px solid #e0e0e0;
    }
    /* Welly Fix Styles */
    .tab-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .welly-fix-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 20px;
      border: none;
      border-radius: 24px;
      background: linear-gradient(135deg, #2563eb, #1e40af);
      color: white;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.3);
    }
    .welly-fix-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4);
    }
    .welly-fix-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .welly-review-panel {
      background: #f8f6ff;
      border: 2px solid #2563eb;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .welly-review-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e0d8f5;
    }
    .welly-avatar {
      font-size: 32px;
      line-height: 1;
    }
    .welly-review-header h3 {
      margin: 0 0 4px;
      color: #4a3b8f;
      font-size: 16px;
    }
    .welly-review-header p {
      margin: 0;
      color: #666;
      font-size: 13px;
    }
    .welly-review-actions-header {
      margin-left: auto;
      display: flex;
      gap: 4px;
    }
    .welly-review-actions-header button {
      font-size: 12px;
    }
    .welly-review-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 400px;
      overflow-y: auto;
      margin-bottom: 16px;
    }
    .welly-review-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px;
      background: white;
      border-radius: 8px;
      border: 1px solid #e8e0f5;
      transition: all 0.2s;
    }
    .welly-review-item.failed {
      background: #fff8f8;
      border-color: #fdd;
    }
    .welly-review-item.rejected {
      opacity: 0.5;
    }
    .welly-review-toggle {
      display: flex;
      align-items: center;
      padding-top: 2px;
    }
    .fix-failed-icon {
      color: #f44336;
    }
    .welly-review-info {
      flex: 1;
      min-width: 0;
    }
    .welly-review-name {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 4px;
    }
    .welly-review-name strong {
      font-size: 14px;
    }
    .welly-review-name .code {
      font-size: 11px;
      color: #2563eb;
      background: #f0f2ff;
      padding: 1px 6px;
      border-radius: 4px;
    }
    .welly-review-suggestion {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #555;
      font-size: 13px;
      margin-bottom: 6px;
    }
    .welly-review-suggestion mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #2563eb;
    }
    .welly-review-details {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .welly-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .welly-chip.province {
      background: #e3f2fd;
      color: #1565c0;
    }
    .welly-chip.city {
      background: #fff3e0;
      color: #e65100;
    }
    .welly-chip.postal {
      background: #f3e5f5;
      color: #7b1fa2;
    }
    .welly-chip.gps {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .welly-review-error {
      font-size: 12px;
      color: #d32f2f;
      font-style: italic;
    }
    .welly-review-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0d8f5;
    }
    @media (max-width: 768px) {
      .form-row.three-col, .form-row.two-col { grid-template-columns: 1fr; }
      .customer-header { flex-wrap: wrap; }
      .issue-badges { width: 100%; margin-top: 8px; }
      .toolbar { flex-direction: column; align-items: stretch; }
      ::ng-deep .issue-tabs .mat-mdc-tab { min-width: 80px; }
    }
  `]
})
export class AddressIssuesDialog {
  searchTerm = '';
  selectedTab = 0;
  loading = true;
  saving = false;
  totalCount = 0;
  customers: CustomerAddressIssue[] = [];
  filteredCustomers: CustomerAddressIssue[] = [];
  editingCustomerId: number | null = null;
  editForm = {
    deliveryAddress: '',
    deliveryCity: '',
    deliveryProvince: '',
    deliveryPostalCode: '',
    latitude: null as number | null,
    longitude: null as number | null
  };

  // Welly Fix properties
  wellyFixes: any[] = [];
  wellyLoading = false;
  wellyApplying = false;
  showWellyReview = false;

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);
  private wellyActivity = inject(WellyActivityService);
  private wellyActivityId: number | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { apiUrl: string },
    public dialogRef: MatDialogRef<AddressIssuesDialog>
  ) {
    this.loadCustomers();
  }

  get approvedFixCount(): number {
    return this.wellyFixes.filter(f => f.approved && f.success).length;
  }

  wellyFixAll(): void {
    this.wellyLoading = true;
    this.showWellyReview = false;
    this.wellyFixes = [];
    this.wellyActivityId = this.wellyActivity.start('Logistics: Welly Fix All addresses');

    // Send the customer IDs from the current filtered list
    const customerIds = this.filteredCustomers.map(c => c.id);

    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/welly-suggest-customer-fixes`, customerIds).subscribe({
      next: (response) => {
        this.wellyFixes = (response.suggestions || []).map((s: any) => ({
          ...s,
          approved: s.success
        }));
        this.wellyLoading = false;
        this.showWellyReview = true;

        const fixable = this.wellyFixes.filter(f => f.success).length;
        this.snackBar.open(
          `Welly found fixes for ${fixable} of ${this.wellyFixes.length} customers`,
          'Close', { duration: 4000 }
        );
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      },
      error: (err) => {
        this.wellyLoading = false;
        console.error('Welly fix error:', err);
        this.snackBar.open('Welly could not analyze customers. Please try again.', 'Close', { duration: 3000 });
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      }
    });
  }

  applyWellyFixes(): void {
    const approved = this.wellyFixes.filter(f => f.approved && f.success);
    if (approved.length === 0) {
      this.snackBar.open('No fixes approved to apply', 'Close', { duration: 2000 });
      return;
    }

    this.wellyApplying = true;
    const fixes = approved.map(f => ({
      customerId: f.customerId,
      province: f.suggestedProvince,
      city: f.suggestedCity,
      postalCode: f.suggestedPostalCode,
      latitude: f.suggestedLatitude,
      longitude: f.suggestedLongitude,
      formattedAddress: f.suggestedFormattedAddress
    }));

    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/welly-apply-customer-fixes`, fixes).subscribe({
      next: (result) => {
        this.wellyApplying = false;
        this.showWellyReview = false;
        this.wellyFixes = [];
        this.snackBar.open(
          `✅ Welly updated ${result.applied} customer locations` + (result.failed > 0 ? ` (${result.failed} failed)` : ''),
          'Close', { duration: 4000 }
        );
        // Reload the customers list to reflect changes
        this.loadCustomers();
      },
      error: () => {
        this.wellyApplying = false;
        this.snackBar.open('Failed to apply fixes. Please try again.', 'Close', { duration: 3000 });
      }
    });
  }

  cancelWellyReview(): void {
    this.showWellyReview = false;
    this.wellyFixes = [];
  }

  toggleAllFixes(approved: boolean): void {
    this.wellyFixes.forEach(f => {
      if (f.success) f.approved = approved;
    });
  }

  loadCustomers(): void {
    this.loading = true;
    const params: any = { pageSize: 5000 };
    if (this.searchTerm) {
      params.search = this.searchTerm;
    }

    this.http.get<{ customers: CustomerAddressIssue[], totalCount: number }>(
      `${this.data.apiUrl}/logistics/customers/address-issues`,
      { params }
    ).subscribe({
      next: (response) => {
        this.customers = response.customers;
        this.totalCount = response.totalCount;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load address issues:', err);
        this.customers = [];
        this.filteredCustomers = [];
        this.loading = false;
        this.snackBar.open('Failed to load customers with address issues', 'Close', { duration: 5000 });
      }
    });
  }

  onTabChange(index: number): void {
    this.selectedTab = index;
    this.applyFilter();
    this.cancelEdit();
  }

  getCountByType(type: string): number {
    switch (type) {
      case 'address': return this.customers.filter(c => c.hasMissingAddress).length;
      case 'city': return this.customers.filter(c => c.hasMissingCity).length;
      case 'province': return this.customers.filter(c => c.hasMissingProvince).length;
      case 'coordinates': return this.customers.filter(c => c.hasMissingCoordinates).length;
      default: return 0;
    }
  }

  applyFilter(): void {
    switch (this.selectedTab) {
      case 0: // No Address
        this.filteredCustomers = this.customers.filter(c => c.hasMissingAddress);
        break;
      case 1: // No City
        this.filteredCustomers = this.customers.filter(c => c.hasMissingCity);
        break;
      case 2: // No Province
        this.filteredCustomers = this.customers.filter(c => c.hasMissingProvince);
        break;
      case 3: // No GPS
        this.filteredCustomers = this.customers.filter(c => c.hasMissingCoordinates);
        break;
      default:
        this.filteredCustomers = [...this.customers];
    }
  }

  toggleEdit(customer: CustomerAddressIssue): void {
    if (this.editingCustomerId === customer.id) {
      this.cancelEdit();
    } else {
      this.editingCustomerId = customer.id;
      this.editForm = {
        deliveryAddress: customer.deliveryAddress || customer.address || customer.physicalAddress || '',
        deliveryCity: customer.deliveryCity || customer.city || '',
        deliveryProvince: customer.deliveryProvince || customer.province || '',
        deliveryPostalCode: customer.deliveryPostalCode || customer.postalCode || '',
        latitude: customer.latitude,
        longitude: customer.longitude
      };
    }
  }

  cancelEdit(): void {
    this.editingCustomerId = null;
    this.editForm = {
      deliveryAddress: '',
      deliveryCity: '',
      deliveryProvince: '',
      deliveryPostalCode: '',
      latitude: null,
      longitude: null
    };
  }

  saveAddress(customer: CustomerAddressIssue): void {
    this.saving = true;

    const payload: any = {};
    if (this.editForm.deliveryAddress) payload.deliveryAddress = this.editForm.deliveryAddress;
    if (this.editForm.deliveryCity) payload.deliveryCity = this.editForm.deliveryCity;
    if (this.editForm.deliveryProvince) payload.deliveryProvince = this.editForm.deliveryProvince;
    if (this.editForm.deliveryPostalCode) payload.deliveryPostalCode = this.editForm.deliveryPostalCode;
    if (this.editForm.latitude !== null) payload.latitude = this.editForm.latitude;
    if (this.editForm.longitude !== null) payload.longitude = this.editForm.longitude;

    // Also set regular city/province if delivery ones are set
    if (this.editForm.deliveryCity && !customer.city) payload.city = this.editForm.deliveryCity;
    if (this.editForm.deliveryProvince && !customer.province) payload.province = this.editForm.deliveryProvince;
    if (this.editForm.deliveryPostalCode && !customer.postalCode) payload.postalCode = this.editForm.deliveryPostalCode;

    this.http.patch(`${this.data.apiUrl}/logistics/customers/${customer.id}/address`, payload).subscribe({
      next: () => {
        this.snackBar.open(`Address updated for ${customer.name}`, 'Close', { duration: 3000 });
        // Update local data
        Object.assign(customer, {
          deliveryAddress: this.editForm.deliveryAddress,
          deliveryCity: this.editForm.deliveryCity,
          deliveryProvince: this.editForm.deliveryProvince,
          deliveryPostalCode: this.editForm.deliveryPostalCode,
          latitude: this.editForm.latitude,
          longitude: this.editForm.longitude,
          hasMissingAddress: !this.editForm.deliveryAddress,
          hasMissingCity: !this.editForm.deliveryCity && !customer.city,
          hasMissingProvince: !this.editForm.deliveryProvince && !customer.province,
          hasMissingCoordinates: this.editForm.latitude === null || this.editForm.longitude === null
        });
        this.cancelEdit();
        this.saving = false;
        // Remove from current filtered list if issue is resolved
        this.applyFilter();
      },
      error: (err) => {
        this.snackBar.open('Failed to update address: ' + (err.error?.error || err.message), 'Close', { duration: 5000 });
        this.saving = false;
      }
    });
  }
}

// TFN Depots Map Dialog Component
@Component({
  selector: 'app-tfn-depots-map-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    FormsModule
  ],
  template: `
    <div class="tfn-depots-map-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>local_gas_station</mat-icon>
          TFN Fuel Depots
        </h2>
        <div class="depot-count">
          <span class="count">{{ filteredDepots.length }}</span> / {{ data.depots.length }} depots
        </div>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <div class="controls-bar">
          <mat-form-field appearance="outline" class="province-filter">
            <mat-label>Filter by Province</mat-label>
            <mat-select [(ngModel)]="selectedProvince" (selectionChange)="filterByProvince()">
              <mat-option value="all">All Provinces</mat-option>
              @for (province of provinces; track province.name) {
                <mat-option [value]="province.name">{{ province.name }} ({{ province.count }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
          
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search depots...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (input)="filterDepots()" placeholder="Search by name">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <button mat-raised-button color="accent" (click)="loadTripSheets()" [disabled]="loadingTrips || loadingActiveLoads">
            @if (loadingTrips) {
              <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
            } @else {
              <mat-icon>route</mat-icon>
            }
            {{ loadingTrips ? 'Loading...' : 'Load Trip Sheets' }}
          </button>

          <button mat-raised-button class="active-loads-btn" (click)="loadActiveLoads()" [disabled]="loadingTrips || loadingActiveLoads">
            @if (loadingActiveLoads) {
              <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
            } @else {
              <mat-icon>local_shipping</mat-icon>
            }
            {{ loadingActiveLoads ? 'Loading...' : 'Active Loads' }}
          </button>

          <button mat-stroked-button (click)="resetView()">
            <mat-icon>zoom_out_map</mat-icon>
            Reset View
          </button>

          @if (tripRoutes.length > 0) {
            <button mat-stroked-button color="warn" (click)="clearTripRoutes()">
              <mat-icon>clear</mat-icon>
              Clear Routes
            </button>
          }
        </div>

        @if (tripRoutes.length > 0) {
          <div class="trip-routes-bar">
            <span class="routes-label"><mat-icon>route</mat-icon> Trip Routes ({{ tripRoutes.length }}):</span>
            <div class="route-chips">
              @for (route of tripRoutes; track $index) {
                <mat-chip [style.background-color]="route.color" 
                          [class.selected]="selectedRoute?.loadNumber === route.loadNumber"
                          (click)="focusRoute(route)">
                  {{ route.loadNumber }} - {{ route.stops.length }} stops
                </mat-chip>
              }
            </div>
            @if (nearestDepots.length > 0) {
              <div class="nearest-depots">
                <span class="nearest-label">Nearest Depots:</span>
                @for (nd of nearestDepots.slice(0, 5); track nd.depot.id) {
                  <span class="nearest-item" (click)="focusDepot(nd.depot)">
                    {{ nd.depot.name }} ({{ nd.distance | number:'1.1-1' }} km)
                  </span>
                }
              </div>
            }
          </div>
        }

        <div class="map-container">
          <div id="depotMap" class="depot-map"></div>
          <div class="zoom-controls">
            <button mat-mini-fab color="primary" (click)="zoomIn()" matTooltip="Zoom In">
              <mat-icon>add</mat-icon>
            </button>
            <button mat-mini-fab color="primary" (click)="zoomOut()" matTooltip="Zoom Out">
              <mat-icon>remove</mat-icon>
            </button>
          </div>
          @if (selectedRoute) {
            <div class="route-info-panel">
              <h4>{{ selectedRoute.loadNumber }}</h4>
              <p><strong>Driver:</strong> {{ selectedRoute.driverName || 'N/A' }}</p>
              <p><strong>Vehicle:</strong> {{ selectedRoute.vehicleReg || 'N/A' }}</p>
              <p><strong>Stops:</strong> {{ selectedRoute.stops.length }}</p>
              <p><strong>Distance:</strong> {{ selectedRoute.totalDistance | number:'1.0-0' }} km</p>
              <button mat-stroked-button (click)="selectedRoute = null">Close</button>
            </div>
          }
        </div>

        <div class="depot-list">
          <div class="list-header">
            <span>Depot List</span>
            <mat-icon (click)="toggleList()">{{ showList ? 'expand_less' : 'expand_more' }}</mat-icon>
          </div>
          @if (showList) {
            <div class="list-content">
              @for (depot of filteredDepots.slice(0, 20); track depot.id) {
                <div class="depot-item" (click)="focusDepot(depot)" [class.nearest]="isNearestDepot(depot)">
                  <mat-icon class="fuel-icon">local_gas_station</mat-icon>
                  <div class="depot-info">
                    <span class="depot-name">{{ depot.name }}</span>
                    <span class="depot-coords">{{ depot.latitude?.toFixed(4) }}, {{ depot.longitude?.toFixed(4) }}</span>
                  </div>
                  @if (isNearestDepot(depot)) {
                    <mat-icon class="nearest-badge" matTooltip="Near trip route">star</mat-icon>
                  }
                </div>
              }
              @if (filteredDepots.length > 20) {
                <div class="more-depots">+ {{ filteredDepots.length - 20 }} more depots</div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .tfn-depots-map-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #11998e, #38ef7d);
      color: white;
      margin: -24px -24px 0 -24px;
      gap: 16px;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      font-weight: 500;
      flex: 1;
    }
    .depot-count {
      padding: 8px 16px;
      background: rgba(255,255,255,0.2);
      border-radius: 20px;
      font-size: 14px;
    }
    .depot-count .count {
      font-weight: 600;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 16px 0;
      overflow: hidden;
    }
    .controls-bar {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 0 0 16px 0;
      flex-wrap: wrap;
    }
    .province-filter {
      min-width: 220px;
    }
    .search-field {
      flex: 1;
      min-width: 200px;
      max-width: 300px;
    }
    .map-container {
      flex: 1;
      min-height: 400px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      position: relative;
    }
    .depot-map {
      width: 100%;
      height: 100%;
      background: #e5e3df;
    }
    .zoom-controls {
      position: absolute;
      top: 12px;
      right: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 1000;
    }
    .zoom-controls button {
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .depot-list {
      margin-top: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      overflow: hidden;
    }
    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #e0e0e0;
      font-weight: 500;
      cursor: pointer;
    }
    .list-header mat-icon {
      cursor: pointer;
    }
    .list-content {
      max-height: 150px;
      overflow-y: auto;
      padding: 8px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 8px;
    }
    .depot-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      background: white;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .depot-item:hover {
      background: #e8f5e9;
      transform: translateX(4px);
    }
    .fuel-icon {
      color: #11998e;
      font-size: 20px;
    }
    .depot-info {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .depot-name {
      font-weight: 500;
      font-size: 13px;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .depot-coords {
      font-size: 11px;
      color: #999;
    }
    .more-depots {
      padding: 10px;
      text-align: center;
      color: #666;
      font-size: 13px;
      grid-column: 1 / -1;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    .active-loads-btn {
      background: linear-gradient(135deg, #11998e, #38ef7d) !important;
      color: white !important;
      font-weight: 500;
    }
    .active-loads-btn:hover:not([disabled]) {
      background: linear-gradient(135deg, #0d7d74, #2ecc71) !important;
      box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
    }
    .active-loads-btn:disabled {
      background: #e0e0e0 !important;
      color: #999 !important;
    }
    .active-routes-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
      border-radius: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .trip-routes-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      border-radius: 8px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .routes-label {
      display: flex;
      align-items: center;
      gap: 6px;
      color: white;
      font-weight: 500;
      font-size: 13px;
    }
    .routes-label mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .route-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .route-chips mat-chip {
      color: white !important;
      font-size: 12px;
      cursor: pointer;
      border: 2px solid transparent;
    }
    .route-chips mat-chip.selected {
      border-color: white;
      box-shadow: 0 0 8px rgba(255,255,255,0.5);
    }
    .nearest-depots {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-left: auto;
    }
    .nearest-label {
      color: rgba(255,255,255,0.8);
      font-size: 12px;
    }
    .nearest-item {
      background: rgba(255,255,255,0.2);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      color: white;
      cursor: pointer;
      transition: background 0.2s;
    }
    .nearest-item:hover {
      background: rgba(255,255,255,0.3);
    }
    .route-info-panel {
      position: absolute;
      bottom: 16px;
      left: 16px;
      background: white;
      padding: 16px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      min-width: 200px;
      z-index: 1000;
    }
    .route-info-panel h4 {
      margin: 0 0 12px 0;
      color: #2563eb;
      font-size: 16px;
    }
    .route-info-panel p {
      margin: 4px 0;
      font-size: 13px;
      color: #666;
    }
    .route-info-panel button {
      margin-top: 12px;
      width: 100%;
    }
    .depot-item.nearest {
      background: #fff3e0;
      border-left: 3px solid #ff9800;
    }
    .depot-item.nearest:hover {
      background: #ffe0b2;
    }
    .nearest-badge {
      color: #ff9800;
      margin-left: auto;
    }
  `]
})
export class TfnDepotsMapDialog implements AfterViewInit, OnDestroy {
  selectedProvince = 'all';
  searchTerm = '';
  filteredDepots: any[] = [];
  showList = true;
  mapLoading = true;
  loadingTrips = false;
  loadingActiveLoads = false;
  tripRoutes: any[] = [];
  activeLoadRoutes: any[] = [];
  selectedRoute: any = null;
  nearestDepots: { depot: any; distance: number }[] = [];
  private map: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private warehouseMarkers: google.maps.Marker[] = [];
  private routePolylines: google.maps.Polyline[] = [];
  private directionsRenderers: google.maps.DirectionsRenderer[] = [];
  private stopMarkers: google.maps.Marker[] = [];
  private infoWindow: google.maps.InfoWindow | null = null;
  private directionsService: google.maps.DirectionsService | null = null;
  private mapInitialized = false;
  private http: HttpClient;

  // Route colors for different trips
  private routeColors = [
    '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12',
    '#1abc9c', '#e91e63', '#00bcd4', '#ff5722', '#795548'
  ];

  // Green-themed colors for active/assigned loads
  private activeLoadColors = [
    '#11998e', '#38ef7d', '#2ecc71', '#27ae60', '#1abc9c',
    '#16a085', '#00b894', '#55efc4', '#00cec9', '#81ecec'
  ];

  // South African provinces with approximate bounding boxes
  provinces = [
    { name: 'Gauteng', bounds: { south: -26.5, west: 27.5, north: -25.5, east: 28.5 }, count: 0 },
    { name: 'Western Cape', bounds: { south: -34.5, west: 18.0, north: -31.5, east: 20.5 }, count: 0 },
    { name: 'KwaZulu-Natal', bounds: { south: -31.0, west: 29.0, north: -27.0, east: 32.5 }, count: 0 },
    { name: 'Eastern Cape', bounds: { south: -34.0, west: 24.0, north: -30.5, east: 30.0 }, count: 0 },
    { name: 'Mpumalanga', bounds: { south: -26.5, west: 29.0, north: -24.5, east: 32.0 }, count: 0 },
    { name: 'Limpopo', bounds: { south: -25.0, west: 27.0, north: -22.0, east: 31.5 }, count: 0 },
    { name: 'Free State', bounds: { south: -30.5, west: 25.0, north: -27.0, east: 29.5 }, count: 0 },
    { name: 'North West', bounds: { south: -27.5, west: 24.0, north: -25.0, east: 28.0 }, count: 0 },
    { name: 'Northern Cape', bounds: { south: -32.5, west: 17.0, north: -26.5, east: 25.0 }, count: 0 }
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { depots: any[], warehouses: any[] },
    private dialogRef: MatDialogRef<TfnDepotsMapDialog>,
    private injector: Injector
  ) {
    this.http = this.injector.get(HttpClient);
    this.filteredDepots = [...this.data.depots];
    this.calculateProvinceCounts();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.loadGoogleMapsScript(), 100);
  }

  ngOnDestroy(): void {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    this.warehouseMarkers.forEach(m => m.setMap(null));
    this.warehouseMarkers = [];
    this.routePolylines.forEach(p => p.setMap(null));
    this.routePolylines = [];
    this.directionsRenderers.forEach(r => r.setMap(null));
    this.directionsRenderers = [];
    this.stopMarkers.forEach(m => m.setMap(null));
    this.stopMarkers = [];
    if (this.infoWindow) {
      this.infoWindow.close();
    }
  }

  calculateProvinceCounts(): void {
    this.provinces.forEach(province => {
      province.count = this.data.depots.filter(depot => 
        this.isInProvince(depot, province)
      ).length;
    });
    // Sort by count descending
    this.provinces.sort((a, b) => b.count - a.count);
  }

  isInProvince(depot: any, province: any): boolean {
    if (!depot.latitude || !depot.longitude) return false;
    const { south, west, north, east } = province.bounds;
    return depot.latitude >= south && depot.latitude <= north &&
           depot.longitude >= west && depot.longitude <= east;
  }

  private loadGoogleMapsScript(): void {
    const apiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
    
    if (typeof google !== 'undefined' && google.maps) {
      this.initializeMap();
      return;
    }

    const callbackName = 'initTfnDepotsMap' + Date.now();
    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + apiKey + '&callback=' + callbackName;
    script.async = true;
    script.defer = true;
    
    (window as any)[callbackName] = () => {
      this.initializeMap();
      delete (window as any)[callbackName];
    };
    
    document.head.appendChild(script);
  }

  private initializeMap(): void {
    if (this.mapInitialized) return;
    
    const mapElement = document.getElementById('depotMap');
    if (!mapElement) return;

    // Center on South Africa
    const defaultCenter = { lat: -28.5, lng: 25.5 };
    
    this.map = new google.maps.Map(mapElement, {
      zoom: 5,
      center: defaultCenter,
      mapTypeId: 'roadmap',
      mapTypeControl: true,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scaleControl: true,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    } as any);

    this.infoWindow = new google.maps.InfoWindow();
    this.directionsService = new google.maps.DirectionsService();
    this.mapInitialized = true;
    this.mapLoading = false;
    
    this.addDepotMarkers();
    this.addWarehouseMarkers();
  }

  private getWarehouseIconSvg(): string {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">' +
      '<circle cx="22" cy="22" r="20" fill="#2196F3" stroke="white" stroke-width="2.5"/>' +
      '<path d="M22 10L10 20v12h8v-8h8v8h8V20L22 10z" fill="white"/>' +
      '<rect x="18" y="24" width="8" height="8" fill="#2196F3"/>' +
      '<rect x="20" y="28" width="4" height="4" fill="white" rx="0.5"/>' +
      '</svg>'
    );
  }

  private getFuelIconSvg(): string {
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
      '<circle cx="20" cy="20" r="18" fill="url(#grad)" stroke="white" stroke-width="2"/>' +
      '<defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">' +
      '<stop offset="0%" style="stop-color:#11998e"/>' +
      '<stop offset="100%" style="stop-color:#38ef7d"/>' +
      '</linearGradient></defs>' +
      '<path d="M26.77 14.23l.01-.01-2.72-2.72L23 12.56l1.61 1.61c-.64.36-1.11.96-1.11 1.83a2 2 0 002 2c.36 0 .69-.1 1-.25v5.25c0 .55-.45 1-1 1s-1-.45-1-1V19c0-1.1-.9-2-2-2h-1V12c0-1.1-.9-2-2-2H14c-1.1 0-2 .9-2 2v14h8v-6h1v4a2 2 0 004 0v-8c0-.5-.2-.95-.53-1.27-.3-.3-.7-.5-1.2-.5zM18 16h-4v-4h4v4zm7 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="white"/>' +
      '</svg>'
    );
  }

  private createInfoContent(depot: any): string {
    let html = '<div style="padding: 8px; min-width: 220px;">';
    html += '<h4 style="margin: 0 0 10px 0; color: #11998e; font-size: 15px; border-bottom: 2px solid #11998e; padding-bottom: 6px;">' + depot.name + '</h4>';
    html += '<p style="margin: 4px 0; font-size: 12px; color: #666;">';
    html += '<strong>Coordinates:</strong> ' + depot.latitude.toFixed(4) + ', ' + depot.longitude.toFixed(4);
    html += '</p>';
    if (depot.address) {
      html += '<p style="margin: 4px 0; font-size: 12px;"><strong>Address:</strong> ' + depot.address + '</p>';
    }
    if (depot.city) {
      html += '<p style="margin: 4px 0; font-size: 12px;"><strong>City:</strong> ' + depot.city + '</p>';
    }
    html += '<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid #eee;">';
    html += '<a href="https://www.google.com/maps/dir/?api=1&destination=' + depot.latitude + ',' + depot.longitude + '" target="_blank" style="color: #11998e; text-decoration: none; font-size: 12px; font-weight: 500;">Get Directions  > </a>';
    html += '</div></div>';
    return html;
  }

  private addDepotMarkers(): void {
    if (!this.map) return;

    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    
    const bounds = new google.maps.LatLngBounds();
    let hasValidLocations = false;
    const fuelIcon = this.getFuelIconSvg();

    this.filteredDepots.forEach(depot => {
      if (depot.latitude && depot.longitude) {
        hasValidLocations = true;
        const position = { lat: depot.latitude, lng: depot.longitude };
        bounds.extend(position);

        const marker = new google.maps.Marker({
          position,
          map: this.map,
          title: depot.name,
          icon: {
            url: fuelIcon,
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18)
          }
        });

        (marker as any).depotData = depot;

        marker.addListener('click', () => {
          if (this.infoWindow && this.map) {
            this.infoWindow.setContent(this.createInfoContent(depot));
            this.infoWindow.open(this.map, marker);
          }
        });

        this.markers.push(marker);
      }
    });

    if (hasValidLocations && this.markers.length > 1) {
      this.map.fitBounds(bounds, 50);
    } else if (hasValidLocations && this.markers.length === 1) {
      this.map.setCenter(this.markers[0].getPosition()!);
      this.map.setZoom(14);
    }
  }

  private addWarehouseMarkers(): void {
    if (!this.map || !this.data.warehouses) return;

    // Clear existing warehouse markers
    this.warehouseMarkers.forEach(m => m.setMap(null));
    this.warehouseMarkers = [];

    const warehouseIcon = this.getWarehouseIconSvg();

    this.data.warehouses.forEach(warehouse => {
      if (warehouse.latitude && warehouse.longitude) {
        const position = { lat: warehouse.latitude, lng: warehouse.longitude };

        const marker = new google.maps.Marker({
          position,
          map: this.map,
          title: warehouse.name,
          icon: {
            url: warehouseIcon,
            scaledSize: new google.maps.Size(44, 44),
            anchor: new google.maps.Point(22, 22)
          },
          zIndex: 1000 // Ensure warehouses appear on top
        });

        (marker as any).warehouseData = warehouse;

        marker.addListener('click', () => {
          if (this.infoWindow && this.map) {
            this.infoWindow.setContent(this.createWarehouseInfoContent(warehouse));
            this.infoWindow.open(this.map, marker);
          }
        });

        this.warehouseMarkers.push(marker);
      }
    });
  }

  private createWarehouseInfoContent(warehouse: any): string {
    let html = '<div style="padding: 10px; min-width: 240px;">';
    html += '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 3px solid #1565c0;">';
    html += '<div style="width: 36px; height: 36px; background: linear-gradient(135deg, #1565c0, #42a5f5); border-radius: 50%; display: flex; align-items: center; justify-content: center;">';
    html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3zm0 2.84L18 10v10h-2v-6H8v6H6V10l6-4.16z"/></svg>';
    html += '</div>';
    html += '<h4 style="margin: 0; color: #1565c0; font-size: 16px; font-weight: 600;">' + warehouse.name + '</h4>';
    html += '</div>';
    if (warehouse.code) {
      html += '<p style="margin: 6px 0; font-size: 13px;"><strong>Code:</strong> ' + warehouse.code + '</p>';
    }
    if (warehouse.city) {
      html += '<p style="margin: 6px 0; font-size: 13px;"><strong>City:</strong> ' + warehouse.city + '</p>';
    }
    if (warehouse.address) {
      html += '<p style="margin: 6px 0; font-size: 13px;"><strong>Address:</strong> ' + warehouse.address + '</p>';
    }
    html += '<p style="margin: 6px 0; font-size: 12px; color: #666;">';
    html += '<strong>Coordinates:</strong> ' + warehouse.latitude.toFixed(4) + ', ' + warehouse.longitude.toFixed(4);
    html += '</p>';
    html += '<div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid #eee;">';
    html += '<a href="https://www.google.com/maps/dir/?api=1&destination=' + warehouse.latitude + ',' + warehouse.longitude + '" target="_blank" style="color: #1565c0; text-decoration: none; font-size: 12px; font-weight: 500;">Get Directions  > </a>';
    html += '</div></div>';
    return html;
  }

  filterByProvince(): void {
    if (this.selectedProvince === 'all') {
      this.filteredDepots = [...this.data.depots];
      this.resetView();
    } else {
      const province = this.provinces.find(p => p.name === this.selectedProvince);
      if (province) {
        this.filteredDepots = this.data.depots.filter(depot => 
          this.isInProvince(depot, province)
        );
        // Zoom to province
        if (this.map) {
          const { south, west, north, east } = province.bounds;
          const bounds = new google.maps.LatLngBounds(
            { lat: south, lng: west },
            { lat: north, lng: east }
          );
          this.map.fitBounds(bounds);
        }
      }
    }
    this.addDepotMarkers();
  }

  filterDepots(): void {
    const term = this.searchTerm.toLowerCase();
    let depots = this.selectedProvince === 'all' 
      ? [...this.data.depots]
      : this.data.depots.filter(depot => {
          const province = this.provinces.find(p => p.name === this.selectedProvince);
          return province ? this.isInProvince(depot, province) : true;
        });
    
    if (term) {
      depots = depots.filter(depot => 
        depot.name?.toLowerCase().includes(term)
      );
    }
    
    this.filteredDepots = depots;
    this.addDepotMarkers();
  }

  resetView(): void {
    this.selectedProvince = 'all';
    this.searchTerm = '';
    this.filteredDepots = [...this.data.depots];
    this.addDepotMarkers();
    if (this.map) {
      this.map.setCenter({ lat: -28.5, lng: 25.5 });
      this.map.setZoom(5);
    }
  }

  focusDepot(depot: any): void {
    if (this.map && depot.latitude && depot.longitude) {
      this.map.setCenter({ lat: depot.latitude, lng: depot.longitude });
      this.map.setZoom(14);
      // Find and open the marker info window
      const marker = this.markers.find(m => (m as any).depotData?.id === depot.id);
      if (marker && this.infoWindow) {
        this.infoWindow.setContent(this.createInfoContent(depot));
        this.infoWindow.open(this.map, marker);
      }
    }
  }

  zoomIn(): void {
    if (this.map) {
      const currentZoom = this.map.getZoom() || 5;
      this.map.setZoom(currentZoom + 1);
    }
  }

  zoomOut(): void {
    if (this.map) {
      const currentZoom = this.map.getZoom() || 5;
      this.map.setZoom(Math.max(currentZoom - 1, 3));
    }
  }

  toggleList(): void {
    this.showList = !this.showList;
  }

  // Trip Sheet Methods
  loadTripSheets(): void {
    this.loadingTrips = true;
    const apiUrl = environment.apiUrl;
    
    // Fetch loads with stops that have coordinates
    this.http.get<any[]>(`${apiUrl}/logistics/loads`).subscribe({
      next: (loads) => {
        // Filter loads that have stops with coordinates
        const routesWithCoords = loads
          .filter(load => load.stops && load.stops.length > 0)
          .map((load, index) => {
            // Get stops that have coordinates, sorted by sequence
            const stopsWithCoords = load.stops
              .filter((stop: any) => stop.latitude && stop.longitude)
              .sort((a: any, b: any) => a.stopSequence - b.stopSequence);
            
            return {
              loadId: load.id,
              loadNumber: load.loadNumber,
              driverName: load.driverName,
              vehicleReg: load.vehicleRegistration,
              status: load.status,
              totalDistance: load.estimatedDistance || 0,
              color: this.routeColors[index % this.routeColors.length],
              stops: stopsWithCoords.map((stop: any) => ({
                sequence: stop.stopSequence,
                name: stop.companyName || stop.locationName || stop.customerName || 'Stop',
                address: stop.address,
                city: stop.city,
                lat: stop.latitude,
                lng: stop.longitude,
                type: stop.stopType
              }))
            };
          })
          .filter(route => route.stops.length >= 2); // Need at least 2 points for a route

        this.tripRoutes = routesWithCoords;
        this.loadingTrips = false;
        
        if (routesWithCoords.length > 0) {
          this.drawAllRoutes();
          this.calculateNearestDepots();
        } else {
        }
      },
      error: (err) => {
        console.error('Failed to load trips:', err);
        this.loadingTrips = false;
      }
    });
  }

  // Load Active/Assigned Loads - Green colored routes
  loadActiveLoads(): void {
    this.loadingActiveLoads = true;
    const apiUrl = environment.apiUrl;
    
    // Fetch loads and filter for assigned/active status
    this.http.get<any[]>(`${apiUrl}/logistics/loads`).subscribe({
      next: (loads) => {
        // Filter loads that are Assigned status and have stops with coordinates
        const assignedLoads = loads
          .filter(load => {
            const status = load.status?.toLowerCase();
            // Include loads that are assigned, in transit, or dispatched (active loads)
            return (status === 'assigned' || status === 'in transit' || status === 'intransit' || status === 'dispatched') && 
                   load.stops && load.stops.length > 0;
          })
          .map((load, index) => {
            // Get stops that have coordinates, sorted by sequence
            const stopsWithCoords = load.stops
              .filter((stop: any) => stop.latitude && stop.longitude)
              .sort((a: any, b: any) => a.stopSequence - b.stopSequence);
            
            return {
              loadId: load.id,
              loadNumber: load.loadNumber,
              driverName: load.driverName,
              vehicleReg: load.vehicleRegistration,
              status: load.status,
              totalDistance: load.estimatedDistance || 0,
              color: this.activeLoadColors[index % this.activeLoadColors.length],
              isActiveLoad: true,
              stops: stopsWithCoords.map((stop: any) => ({
                sequence: stop.stopSequence,
                name: stop.companyName || stop.locationName || stop.customerName || 'Stop',
                address: stop.address,
                city: stop.city,
                lat: stop.latitude,
                lng: stop.longitude,
                type: stop.stopType
              }))
            };
          })
          .filter(route => route.stops.length >= 2);

        this.activeLoadRoutes = assignedLoads;
        this.tripRoutes = assignedLoads; // Use same display mechanism
        this.loadingActiveLoads = false;
        
        if (assignedLoads.length > 0) {
          this.drawAllRoutes();
          this.calculateNearestDepots();
        } else {
          console.warn('No active loads with sufficient GPS coordinates to display routes');
        }
      },
      error: (err) => {
        console.error('Failed to load active loads:', err);
        this.loadingActiveLoads = false;
      }
    });
  }

  private drawAllRoutes(): void {
    if (!this.map) return;

    // Clear existing route markers, polylines, and direction renderers
    this.routePolylines.forEach(p => p.setMap(null));
    this.routePolylines = [];
    this.directionsRenderers.forEach(r => r.setMap(null));
    this.directionsRenderers = [];
    this.stopMarkers.forEach(m => m.setMap(null));
    this.stopMarkers = [];

    const bounds = new google.maps.LatLngBounds();

    // Process each route
    this.tripRoutes.forEach((route, routeIndex) => {
      if (route.stops.length < 2) return;

      // Add all stops to bounds
      route.stops.forEach((stop: any) => {
        bounds.extend({ lat: stop.lat, lng: stop.lng });
      });

      // Use Directions API for proper road routes
      this.drawRouteWithDirections(route, routeIndex);

      // Add stop markers
      route.stops.forEach((stop: any, index: number) => {
        const isFirst = index === 0;
        const isLast = index === route.stops.length - 1;
        
        const marker = new google.maps.Marker({
          position: { lat: stop.lat, lng: stop.lng },
          map: this.map,
          title: stop.name,
          icon: {
            path: isFirst ? google.maps.SymbolPath.CIRCLE : (isLast ? google.maps.SymbolPath.BACKWARD_CLOSED_ARROW : google.maps.SymbolPath.CIRCLE),
            scale: isFirst || isLast ? 10 : 6,
            fillColor: isFirst ? '#4caf50' : (isLast ? '#f44336' : route.color),
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2
          },
          zIndex: isFirst || isLast ? 100 : 50
        });

        marker.addListener('click', () => {
          if (this.infoWindow && this.map) {
            const content = `
              <div style="padding: 8px; min-width: 180px;">
                <h4 style="margin: 0 0 8px 0; color: ${route.color};">${stop.name}</h4>
                <p style="margin: 4px 0; font-size: 12px;"><strong>Route:</strong> ${route.loadNumber}</p>
                <p style="margin: 4px 0; font-size: 12px;"><strong>Stop:</strong> ${index + 1} of ${route.stops.length}</p>
                <p style="margin: 4px 0; font-size: 12px;"><strong>Type:</strong> ${stop.type}</p>
                <p style="margin: 4px 0; font-size: 12px;">${stop.address}${stop.city ? ', ' + stop.city : ''}</p>
              </div>
            `;
            this.infoWindow.setContent(content);
            this.infoWindow.open(this.map, marker);
          }
        });

        this.stopMarkers.push(marker);
      });
    });

    // Fit map to show all routes
    if (this.tripRoutes.length > 0) {
      this.map.fitBounds(bounds, 50);
    }
  }

  // Draw route using Google Directions API for proper road paths
  private drawRouteWithDirections(route: any, routeIndex: number): void {
    if (!this.map || !this.directionsService || route.stops.length < 2) return;

    const stops = route.stops;
    const origin = { lat: stops[0].lat, lng: stops[0].lng };
    const destination = { lat: stops[stops.length - 1].lat, lng: stops[stops.length - 1].lng };
    
    // Build waypoints for intermediate stops (max 23 waypoints allowed by Google)
    const waypoints: google.maps.DirectionsWaypoint[] = [];
    if (stops.length > 2) {
      const intermediateStops = stops.slice(1, -1).slice(0, 23); // Skip first and last, limit to 23
      intermediateStops.forEach((stop: any) => {
        waypoints.push({
          location: new google.maps.LatLng(stop.lat, stop.lng),
          stopover: true
        });
      });
    }

    const request: google.maps.DirectionsRequest = {
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      travelMode: google.maps.TravelMode.DRIVING,
      optimizeWaypoints: false // Keep original order
    };

    this.directionsService.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        // Create a custom DirectionsRenderer with the route color
        const renderer = new google.maps.DirectionsRenderer({
          map: this.map,
          directions: result,
          suppressMarkers: true, // We add our own markers
          polylineOptions: {
            strokeColor: route.color,
            strokeOpacity: 0.8,
            strokeWeight: 5
          }
        });
        
        renderer.addListener('click', () => {
          this.selectedRoute = route;
        });

        this.directionsRenderers.push(renderer);

        // Update route with actual distance from directions
        if (result.routes[0]?.legs) {
          let totalDistance = 0;
          result.routes[0].legs.forEach(leg => {
            totalDistance += leg.distance?.value || 0;
          });
          route.totalDistance = Math.round(totalDistance / 1000); // Convert to km
        }
      } else {
        // Fallback to straight lines if Directions API fails
        console.warn(`Directions request failed for route ${route.loadNumber}: ${status}`);
        this.drawFallbackPolyline(route);
      }
    });
  }

  // Fallback to straight lines when Directions API fails
  private drawFallbackPolyline(route: any): void {
    if (!this.map) return;

    const path = route.stops.map((stop: any) => ({
      lat: stop.lat,
      lng: stop.lng
    }));

    // Create dashed line using icons
    const lineSymbol = {
      path: 'M 0,-1 0,1',
      strokeOpacity: 1,
      scale: 3
    };

    const polyline = new google.maps.Polyline({
      path: path,
      geodesic: true,
      strokeColor: route.color,
      strokeOpacity: 0,
      strokeWeight: 3,
      icons: [{
        icon: lineSymbol,
        offset: '0',
        repeat: '15px'
      }],
      map: this.map
    });

    polyline.addListener('click', () => {
      this.selectedRoute = route;
    });

    this.routePolylines.push(polyline);
  }

  private calculateNearestDepots(): void {
    if (this.tripRoutes.length === 0) {
      this.nearestDepots = [];
      return;
    }

    // Collect all route points
    const routePoints: { lat: number; lng: number }[] = [];
    this.tripRoutes.forEach(route => {
      route.stops.forEach((stop: any) => {
        routePoints.push({ lat: stop.lat, lng: stop.lng });
      });
    });

    // Calculate distance from each depot to the nearest route point
    const depotDistances = this.data.depots
      .filter(depot => depot.latitude && depot.longitude)
      .map(depot => {
        let minDistance = Infinity;
        routePoints.forEach(point => {
          const distance = this.calculateDistance(
            depot.latitude, depot.longitude,
            point.lat, point.lng
          );
          if (distance < minDistance) {
            minDistance = distance;
          }
        });
        return { depot, distance: minDistance };
      })
      .filter(item => item.distance < 50) // Within 50km of route
      .sort((a, b) => a.distance - b.distance);

    this.nearestDepots = depotDistances.slice(0, 10);
  }

  // Haversine formula to calculate distance between two points
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  clearTripRoutes(): void {
    this.routePolylines.forEach(p => p.setMap(null));
    this.routePolylines = [];
    this.directionsRenderers.forEach(r => r.setMap(null));
    this.directionsRenderers = [];
    this.stopMarkers.forEach(m => m.setMap(null));
    this.stopMarkers = [];
    this.tripRoutes = [];
    this.activeLoadRoutes = [];
    this.selectedRoute = null;
    this.nearestDepots = [];
  }

  focusRoute(route: any): void {
    this.selectedRoute = route;
    if (!this.map || route.stops.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    route.stops.forEach((stop: any) => {
      bounds.extend({ lat: stop.lat, lng: stop.lng });
    });
    this.map.fitBounds(bounds, 50);
  }

  isNearestDepot(depot: any): boolean {
    return this.nearestDepots.some(nd => nd.depot.id === depot.id);
  }
}

// Add Delivery Note Dialog Component
@Component({
  selector: 'app-add-delivery-note-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule
  ],
  template: `
    <div class="add-delivery-note-dialog">
      <div class="dialog-header">
        <h2><mat-icon>note_add</mat-icon> Add Delivery Note</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <div class="dialog-content">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Delivery Note Number</mat-label>
          <input matInput [(ngModel)]="deliveryNoteNumber" placeholder="e.g. DN001, DEL-2026-001">
          <mat-hint>Can contain letters and numbers</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Customer Name</mat-label>
          <input matInput [(ngModel)]="customerName" placeholder="Enter customer name">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Delivery Address</mat-label>
          <textarea matInput [(ngModel)]="address" rows="2" placeholder="Enter delivery address"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Product Description</mat-label>
          <textarea matInput [(ngModel)]="productDescription" rows="2" placeholder="Enter product description"></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Quantity</mat-label>
            <input matInput type="number" [(ngModel)]="quantity" min="1" placeholder="0">
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Value (R)</mat-label>
            <input matInput type="number" [(ngModel)]="value" min="0" step="0.01" placeholder="0.00">
          </mat-form-field>
        </div>
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" [disabled]="!isValid()" (click)="add()">
          <mat-icon>add</mat-icon> Add to Trip Sheet
        </button>
      </div>
    </div>
  `,
  styles: [`
    .add-delivery-note-dialog {
      width: 500px;
      .dialog-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 20px 24px 12px; border-bottom: 1px solid #e0e0e0;
        h2 { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 18px; font-weight: 600;
          mat-icon { color: #ff9800; }
        }
      }
      .dialog-content {
        padding: 20px 24px;
        .full-width { width: 100%; }
        .form-row { display: flex; gap: 16px;
          mat-form-field { flex: 1; }
        }
      }
      .dialog-actions {
        display: flex; justify-content: flex-end; gap: 12px; padding: 12px 24px; border-top: 1px solid #e0e0e0;
      }
    }
  `]
})
export class AddDeliveryNoteDialog {
  deliveryNoteNumber = '';
  customerName = '';
  address = '';
  productDescription = '';
  quantity = 1;
  value = 0;

  constructor(
    public dialogRef: MatDialogRef<AddDeliveryNoteDialog>
  ) {}

  isValid(): boolean {
    return !!(this.deliveryNoteNumber && this.customerName);
  }

  add(): void {
    const deliveryNote = {
      id: Date.now(), // Temporary unique ID
      transactionNumber: this.deliveryNoteNumber,
      customerName: this.customerName,
      address: this.address,
      deliveryAddress: this.address,
      productDescription: this.productDescription,
      quantity: this.quantity,
      salesAmount: this.value,
      totalAmount: this.value,
      isDeliveryNote: true // Flag to identify delivery notes
    };
    this.dialogRef.close(deliveryNote);
  }
}

// Create Trip Sheet Dialog Component
@Component({
  selector: 'app-create-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTableModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatStepperModule,
    MatDividerModule,
    MatAutocompleteModule,
    FormsModule,
    ReactiveFormsModule,
    ScrollingModule,
    CdkDrag,
    CdkDropList,
    CdkDragHandle
  ],
  template: `
    <div class="create-tripsheet-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>{{ data.isEditMode ? 'edit' : 'add_road' }}</mat-icon>
          {{ data.isEditMode ? 'Edit Trip Sheet' : 'Create Trip Sheet' }}
        </h2>
        <div class="header-info">
          @if (data.isEditMode && data.existingTripsheet?.loadNumber) {
            <mat-chip class="edit-badge">{{ data.existingTripsheet.loadNumber }}</mat-chip>
          }
          @if (selectedStops.length > 0) {
            <mat-chip class="stop-count">{{ selectedStops.length }} stops</mat-chip>
          }
          @if (totalDistance > 0) {
            <mat-chip class="distance-chip">{{ totalDistance | number:'1.0-0' }} km</mat-chip>
          }
        </div>
        <button mat-icon-button (click)="onCloseDialog()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <mat-stepper #stepper linear (selectionChange)="onStepChange($event)">
          <!-- Step 1: Select Invoices/Stops -->
          <mat-step [completed]="selectedStops.length > 0" label="Select Stops">
            <div class="step-content">
              <div class="source-panel">
                <div class="panel-header">
                  <h3><mat-icon>receipt_long</mat-icon> Available Invoices ({{ totalFilteredCount }})</h3>
                  <div class="filter-controls">
                    <mat-form-field appearance="outline" class="province-filter">
                      <mat-label>Province</mat-label>
                      <mat-select [(ngModel)]="selectedProvince" (selectionChange)="onProvinceChange()">
                        <mat-option value="all">All Provinces</mat-option>
                        @for (province of provinces; track province.code) {
                          <mat-option [value]="province.code">
                            {{ province.name }} ({{ getProvinceInvoiceCount(province.code) }})
                          </mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="search-field">
                      <mat-label>Search invoices...</mat-label>
                      <input matInput [ngModel]="invoiceSearch" (ngModelChange)="onSearchInput($event)" placeholder="Customer, invoice #...">
                      <mat-icon matSuffix>search</mat-icon>
                    </mat-form-field>
                  </div>
                </div>
                @if (loadingProvinces) {
                  <div class="loading-provinces">
                    <mat-spinner diameter="24"></mat-spinner>
                    <span>Loading province data...</span>
                  </div>
                }
                <cdk-virtual-scroll-viewport itemSize="72" class="invoice-list">
                  @if (totalFilteredCount > 200) {
                    <div class="scroll-hint">
                      <mat-icon>info</mat-icon>
                      Showing first 200 of {{ totalFilteredCount }} invoices. Use search to filter.
                    </div>
                  }
                  @for (invoice of displayedInvoices; track invoice.id) {
                    <div class="invoice-item" 
                         [class.selected]="isInvoiceSelected(invoice)"
                         [class.part-delivery-marked]="partDeliveryMap.get(invoice.id)">
                      <div class="invoice-info">
                        <span class="invoice-number">{{ invoice.transactionNumber }}</span>
                        <span class="customer-name">{{ invoice.customerName }}</span>
                        @if (invoice.province) {
                          <span class="province-badge" [class]="'province-' + invoice.province.toLowerCase()">
                            {{ invoice.province }}
                          </span>
                        }
                      </div>
                      <div class="invoice-details">
                        <span class="product">{{ invoice.productDescription | slice:0:30 }}...</span>
                        <span class="amount">R {{ invoice.salesAmount | number:'1.2-2' }}</span>
                        @if (invoice.city) {
                          <span class="city">{{ invoice.city }}</span>
                        }
                        @if (invoice.quantity) {
                          <span class="quantity">Qty: {{ invoice.quantity }}</span>
                        }
                      </div>
                      <div class="part-delivery-toggle" (click)="$event.stopPropagation()">
                        <mat-checkbox 
                          [checked]="partDeliveryMap.get(invoice.id) || false"
                          (change)="togglePartDelivery(invoice.id, $event.checked)"
                          color="warn"
                          matTooltip="Mark as Part Delivery - partial quantity will be delivered">
                          <span class="part-delivery-label">Part</span>
                        </mat-checkbox>
                      </div>
                      <button mat-icon-button class="add-btn" (click)="addStopWithPartDelivery(invoice); $event.stopPropagation()" matTooltip="Add to trip sheet">
                        <mat-icon class="add-icon">add_circle</mat-icon>
                      </button>
                    </div>
                  }
                  @if (totalFilteredCount === 0) {
                    <div class="empty-list">
                      <mat-icon>inventory_2</mat-icon>
                      <p>No pending invoices found{{ selectedProvince !== 'all' ? ' in ' + getProvinceName(selectedProvince) : '' }}</p>
                    </div>
                  }
                </cdk-virtual-scroll-viewport>
              </div>

              <div class="stops-panel">
                <div class="panel-header">
                  <h3><mat-icon>pin_drop</mat-icon> Selected Stops ({{ selectedStops.length }})</h3>
                  <div class="panel-actions">
                    <button mat-stroked-button color="accent" (click)="openAddDeliveryNoteDialog()">
                      <mat-icon>note_add</mat-icon> Add Delivery Note
                    </button>
                    @if (selectedStops.length > 0) {
                      <button mat-stroked-button (click)="clearAllStops()">
                        <mat-icon>clear_all</mat-icon> Clear All
                      </button>
                    }
                  </div>
                </div>
                <div class="stops-list" cdkDropList (cdkDropListDropped)="dropStop($event)">
                  @for (stop of selectedStops; track stop.id; let i = $index) {
                    <div class="stop-item" [class.part-delivery]="stop.isPartDelivery" [class.delivery-note]="stop.isDeliveryNote" cdkDrag>
                      <div class="stop-drag-handle" cdkDragHandle>
                        <mat-icon>drag_indicator</mat-icon>
                      </div>
                      <div class="stop-sequence">{{ i + 1 }}</div>
                      <div class="stop-info">
                        <span class="stop-customer">{{ stop.customerName }}</span>
                        <span class="stop-address">{{ stop.address || 'No address' }}</span>
                        <span class="stop-invoice">{{ stop.transactionNumber }}</span>
                        @if (stop.isDeliveryNote) {
                          <span class="delivery-note-badge">
                            <mat-icon>note_add</mat-icon> Delivery Note
                          </span>
                        }
                        @if (stop.isPartDelivery) {
                          <span class="part-delivery-badge">
                            <mat-icon>splitscreen</mat-icon> Part Delivery
                          </span>
                        }
                      </div>
                      @if (stop.isPartDelivery) {
                        <div class="part-delivery-qty">
                          <mat-form-field appearance="outline" class="qty-field">
                            <mat-label>Qty</mat-label>
                            <input matInput type="number" 
                                   [(ngModel)]="stop.partialQuantity" 
                                   [max]="stop.originalQuantity"
                                   min="1"
                                   (change)="onPartialQuantityChange(stop)">
                            <mat-hint>of {{ stop.originalQuantity }}</mat-hint>
                          </mat-form-field>
                        </div>
                      } @else {
                        <div class="stop-value">
                          R {{ stop.salesAmount | number:'1.2-2' }}
                        </div>
                      }
                      <button mat-icon-button (click)="removeStop(i)" matTooltip="Remove stop">
                        <mat-icon>remove_circle</mat-icon>
                      </button>
                    </div>
                  }
                  @if (selectedStops.length === 0) {
                    <div class="empty-stops">
                      <mat-icon>add_location</mat-icon>
                      <p>Select invoices from the left to add stops</p>
                    </div>
                  }
                </div>
              </div>
            </div>

            <div class="step-actions">
              <button mat-button mat-dialog-close>Cancel</button>
              <button mat-raised-button color="primary" matStepperNext [disabled]="selectedStops.length === 0">
                Next <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </mat-step>

          <!-- Step 2: Route Optimization & Details -->
          <mat-step [completed]="tripForm.valid" label="Route Details">
            <div class="step-content route-step">
              <!-- Side by Side Layout: Config on left, Map on right -->
              <div class="route-layout-container">
                <!-- Left Side: Route Configuration -->
                <div class="route-left-panel">
                  <div class="route-config">
                    <h3><mat-icon>route</mat-icon> Route Configuration</h3>
                    
                    @if (!data.warehouses.length && !data.drivers.length && !data.vehicles.length) {
                      <div class="config-loading">
                        <mat-spinner diameter="20"></mat-spinner>
                        <span>Loading configuration data...</span>
                      </div>
                    }

                    <div class="config-grid-compact">
                      <mat-form-field appearance="outline" class="warehouse-field">
                        <mat-label>Pickup Warehouse</mat-label>
                        <mat-select [(ngModel)]="selectedWarehouse" (selectionChange)="onWarehouseSelected()">
                          @for (wh of data.warehouses; track wh.id) {
                            <mat-option [value]="wh">{{ wh.name }} - {{ wh.city }}</mat-option>
                          }
                        </mat-select>
                        <mat-icon matSuffix>warehouse</mat-icon>
                      </mat-form-field>
                    </div>

                    <!-- Delivery Stops live directly under the pickup warehouse and can be dragged up/down (Google-style itinerary) -->
                    @if (groupedStops.length > 0) {
                      <div class="stops-address-section under-config">
                        <div class="section-header">
                          <h3><mat-icon>place</mat-icon> Delivery Stops ({{ groupedStops.length }} locations, {{ selectedStops.length }} invoices)</h3>
                          <div class="header-actions">
                            <span class="coord-status">
                              <mat-icon [class.success]="stopsHaveCoords()" [class.warning]="!stopsHaveCoords()">
                                {{ stopsHaveCoords() ? 'check_circle' : 'warning' }}
                              </mat-icon>
                              {{ getStopsWithCoords() }}/{{ groupedStops.length }} geocoded
                            </span>
                            <button mat-stroked-button color="accent" (click)="aiMatchAddresses()" [disabled]="matchingAddresses" matTooltip="Use AI to match customer names to delivery addresses">
                              @if (matchingAddresses) {
                                <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                              } @else {
                                <mat-icon>auto_fix_high</mat-icon>
                              }
                              {{ matchingAddresses ? 'Matching...' : 'AI Address Match' }}
                            </button>
                            <button mat-stroked-button color="primary" (click)="matchAddressesFromDatabase()" matTooltip="Fill missing delivery addresses from the customer database">
                              <mat-icon>contacts</mat-icon>
                              Match from Customer DB
                            </button>
                            <button mat-stroked-button color="primary" (click)="geocodeAllStops()" [disabled]="geocodingAllStops" matTooltip="Geocode all stops missing coordinates">
                              @if (geocodingAllStops) {
                                <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                              } @else {
                                <mat-icon>my_location</mat-icon>
                              }
                              {{ geocodingAllStops ? 'Geocoding...' : 'Geocode All' }}
                            </button>
                          </div>
                        </div>
                        <p class="drag-hint"><mat-icon>drag_indicator</mat-icon> Drag stops by the handle to change the delivery order</p>
                        <div class="stops-list" cdkDropList (cdkDropListDropped)="dropGroupedStop($event)">
                          @for (group of groupedStops; track $index; let i = $index) {
                            <div class="stop-item" cdkDrag cdkDragLockAxis="y" [class.missing-coords]="!isStopResolved(group)" [class.collapsed]="group.isCollapsed && isStopResolved(group)">
                              <button class="stop-drag-grip" cdkDragHandle matTooltip="Drag to reorder">
                                <mat-icon>drag_indicator</mat-icon>
                              </button>
                              <div class="stop-drag-preview" *cdkDragPreview>
                                <mat-icon>place</mat-icon> {{ group.customerName || group.deliveryAddress || ('Stop ' + (i + 1)) }}
                              </div>
                              <div class="stop-number">{{ i + 1 }}</div>
                              <div class="stop-details">
                                <div class="stop-header" (click)="toggleStopCollapse(group)">
                                  <div class="customer-info">
                                    <span class="customer-name">{{ group.customerName }}</span>
                                    @if (group.invoices.length > 1) {
                                      <mat-chip class="invoice-count">{{ group.invoices.length }} invoices</mat-chip>
                                    } @else {
                                      <span class="invoice-number">{{ group.invoices[0].invoiceNumber }}</span>
                                    }
                                  </div>
                                  <div class="stop-status">
                                    @if (isStopResolved(group)) {
                                      <mat-icon class="coord-icon success" matTooltip="Coordinates: {{ group.latitude }}, {{ group.longitude }}">location_on</mat-icon>
                                    } @else if (group.addressApproximate) {
                                      <mat-icon class="coord-icon warning" matTooltip="Address too vague — enter a full street address">wrong_location</mat-icon>
                                    } @else if (isBlankAddress(group.deliveryAddress)) {
                                      <mat-icon class="coord-icon warning" matTooltip="Delivery address missing — match from customer DB or enter it">location_off</mat-icon>
                                    } @else {
                                      <mat-icon class="coord-icon warning" matTooltip="Missing coordinates - geocode this address">location_off</mat-icon>
                                    }
                                    <mat-icon class="collapse-icon">{{ group.isCollapsed ? 'expand_more' : 'expand_less' }}</mat-icon>
                                  </div>
                                </div>
                                @if (!group.isCollapsed || !isStopResolved(group)) {
                                  @if (group.addressApproximate) {
                                    <div class="address-warning-banner">
                                      <mat-icon>wrong_location</mat-icon>
                                      <span>This address only matched a general area (not a real delivery point). Enter a full street address so it can be placed on the map.</span>
                                    </div>
                                  } @else if (isBlankAddress(group.deliveryAddress)) {
                                    <div class="address-warning-banner missing">
                                      <mat-icon>location_off</mat-icon>
                                      <span><strong>Delivery address missing.</strong> Click <em>"Match from Customer DB"</em> above to pull it from the customer record, or enter it manually below.</span>
                                    </div>
                                  } @else if (group.addressFromCustomerDb) {
                                    <div class="address-info-banner">
                                      <mat-icon>contacts</mat-icon>
                                      <span>Address filled from the customer database — verify it's correct.</span>
                                    </div>
                                  }
                                  <!-- Saved Addresses Dropdown -->
                                  @if (getSavedAddresses(group).length > 0) {
                                    <div class="saved-addresses-row">
                                      <mat-form-field appearance="outline" class="saved-address-select">
                                        <mat-label>Saved Addresses</mat-label>
                                        <mat-select (selectionChange)="onSavedAddressSelected(group, $event.value)">
                                          @for (addr of getSavedAddresses(group); track addr.id) {
                                            <mat-option [value]="addr">
                                              <div class="saved-addr-option">
                                                <span class="addr-label">{{ addr.addressLabel || 'Address' }}</span>
                                                <span class="addr-text">{{ addr.address }}</span>
                                                @if (addr.usageCount > 1) {
                                                  <span class="addr-usage">(used {{ addr.usageCount }}x)</span>
                                                }
                                              </div>
                                            </mat-option>
                                          }
                                        </mat-select>
                                        <mat-hint>Select a previously used address</mat-hint>
                                      </mat-form-field>
                                      <span class="or-divider">OR</span>
                                    </div>
                                  }
                                  <div class="stop-address-row">
                                    <mat-form-field appearance="outline" class="address-field">
                                      <mat-label>Delivery Address</mat-label>
                                      <input matInput
                                             [(ngModel)]="group.deliveryAddress"
                                             [matAutocomplete]="autoAddress"
                                             (input)="onAddressInput(group, $event)"
                                             (focus)="onAddressFocus(group)"
                                             placeholder="Start typing address...">
                                      <mat-autocomplete #autoAddress="matAutocomplete" (optionSelected)="onAddressSelected(group, $event)">
                                        @for (prediction of addressPredictions; track $index) {
                                          <mat-option [value]="prediction.description">
                                            <mat-icon>place</mat-icon>
                                            <span>{{ prediction.description }}</span>
                                          </mat-option>
                                        }
                                      </mat-autocomplete>
                                      <mat-hint *ngIf="!group.latitude && group.deliveryAddress">Select from suggestions or geocode</mat-hint>
                                    </mat-form-field>
                                    <button mat-icon-button color="primary" (click)="geocodeGroupAddress(group)" [disabled]="geocodingStop === group || !group.deliveryAddress" matTooltip="Geocode this address">
                                      @if (geocodingStop === group) {
                                        <mat-spinner diameter="20"></mat-spinner>
                                      } @else {
                                        <mat-icon>my_location</mat-icon>
                                      }
                                    </button>
                                    <button mat-icon-button color="accent" (click)="saveAddressForCustomer(group)"
                                            [disabled]="!group.deliveryAddress || !group.latitude"
                                            matTooltip="Save this address for future use">
                                      <mat-icon>bookmark_add</mat-icon>
                                    </button>
                                  </div>
                                  @if (group.city || group.province) {
                                    <div class="stop-location-info">
                                      <mat-icon>info_outline</mat-icon>
                                      <span>{{ group.city }}{{ group.province ? ', ' + group.province : '' }}</span>
                                    </div>
                                  }
                                  @if (group.invoices.length > 1) {
                                    <div class="grouped-invoices">
                                      <span class="invoices-label">Invoices at this location:</span>
                                      <div class="invoice-chips">
                                        @for (inv of group.invoices; track inv.id) {
                                          <mat-chip>{{ inv.invoiceNumber }} - R{{ inv.totalAmount | number:'1.2-2' }}</mat-chip>
                                        }
                                      </div>
                                    </div>
                                  }
                                } @else {
                                  <div class="collapsed-info">
                                    <mat-icon>check_circle</mat-icon>
                                    <span>{{ group.deliveryAddress }}</span>
                                  </div>
                                }
                              </div>
                              <div class="stop-value">R {{ group.totalValue | number:'1.2-2' }}</div>
                            </div>
                          }
                        </div>
                      </div>
                    }

                <div class="optimize-section">
                  <button mat-raised-button color="accent" (click)="optimizeRoute()" [disabled]="optimizing || selectedStops.length < 2" matTooltip="Optimize route order using Google Routes API">
                    @if (optimizing) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>alt_route</mat-icon>
                    }
                    {{ optimizing ? 'Optimizing...' : 'Optimize Route (Google)' }}
                  </button>
                  <button mat-stroked-button (click)="calculateDistance()" [disabled]="calculating" matTooltip="Calculate accurate distance using Google Routes API">
                    @if (calculating) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>straighten</mat-icon>
                    }
                    {{ calculating ? 'Calculating...' : 'Calculate Distance' }}
                  </button>
                </div>

                @if (optimizationMessage) {
                  <div class="optimization-message" [class.success]="optimizationSuccess" [class.error]="!optimizationSuccess">
                    <mat-icon>{{ optimizationSuccess ? 'check_circle' : 'warning' }}</mat-icon>
                    {{ optimizationMessage }}
                  </div>
                }

                @if (showDistanceMatrix && distanceMatrix.length > 0) {
                  <div class="distance-matrix-container">
                    <div class="matrix-header">
                      <h4><mat-icon>grid_on</mat-icon> Distance Matrix (km / min)</h4>
                      <button mat-icon-button (click)="toggleDistanceMatrix()" matTooltip="Hide matrix">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                    <div class="matrix-scroll">
                      <table class="distance-matrix">
                        <thead>
                          <tr>
                            <th class="label-cell"></th>
                            @for (label of distanceMatrixLabels; track label; let i = $index) {
                              <th class="header-cell" [matTooltip]="label">{{ i === 0 ? 'WH' : i }}</th>
                            }
                          </tr>
                        </thead>
                        <tbody>
                          @for (row of distanceMatrix; track $index; let i = $index) {
                            <tr>
                              <td class="label-cell" [matTooltip]="distanceMatrixLabels[i]">{{ i === 0 ? 'WH' : i }}</td>
                              @for (cell of row; track $index; let j = $index) {
                                <td class="matrix-cell" [class.diagonal]="i === j" [matTooltip]="distanceMatrixLabels[i] + '  >  ' + distanceMatrixLabels[j]">
                                  @if (i === j) {
                                    <span class="diagonal-marker">-</span>
                                  } @else {
                                    <span class="distance">{{ cell.distanceKm }}</span>
                                    <span class="duration">{{ cell.durationMin }}m</span>
                                  }
                                </td>
                              }
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                    <div class="matrix-legend">
                      <span>WH = Warehouse</span>
                      <span>Numbers = Stop sequence</span>
                      <span>Top row: km | Bottom row: minutes</span>
                    </div>
                  </div>
                }

                @if (totalDistance > 0) {
                  <div class="route-summary">
                    <div class="summary-item">
                      <mat-icon>straighten</mat-icon>
                      <span class="label">Total Distance:</span>
                      <span class="value">{{ totalDistance | number:'1.0-0' }} km</span>
                    </div>
                    <div class="summary-item">
                      <mat-icon>schedule</mat-icon>
                      <span class="label">Est. Drive Time:</span>
                      <span class="value">{{ estimatedTime }}</span>
                    </div>
                    <div class="summary-item highlight">
                      <mat-icon>payments</mat-icon>
                      <span class="label">Total:</span>
                      <span class="value">R {{ totalValue | number:'1.2-2' }}</span>
                    </div>
                    @if (fuelEstimate > 0) {
                      <div class="summary-item">
                        <mat-icon>local_gas_station</mat-icon>
                        <span class="label">Est. Fuel:</span>
                        <span class="value">{{ fuelEstimate | number:'1.0-0' }} L (R {{ fuelCost | number:'1.2-2' }})</span>
                      </div>
                    }
                  </div>
                }
                  </div><!-- end route-config -->
                </div><!-- end route-left-panel -->

                <!-- Right Side: Assignments + Route Preview Map -->
                <div class="route-right-panel">
                  <!-- Driver, vehicle & scheduled date sit above the route preview -->
                  <div class="trip-assign-grid">
                    <mat-form-field appearance="outline">
                      <mat-label>Driver</mat-label>
                      <input matInput
                             [(ngModel)]="driverSearchText"
                             [matAutocomplete]="driverAuto"
                             (input)="filterDrivers()"
                             (focus)="filterDrivers()"
                             placeholder="Type to search drivers...">
                      <mat-autocomplete #driverAuto="matAutocomplete"
                                        [displayWith]="displayDriver.bind(this)"
                                        (optionSelected)="onDriverAutocompleteSelected($event)">
                        <mat-option [value]="null">-- Unassigned --</mat-option>
                        @for (driver of filteredDrivers; track driver.id) {
                          <mat-option [value]="driver">{{ driver.firstName }} {{ driver.lastName }}</mat-option>
                        }
                      </mat-autocomplete>
                      <mat-icon matSuffix>person</mat-icon>
                      <mat-hint>{{ data.drivers.length || 0 }} drivers available</mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Vehicle</mat-label>
                      <input matInput
                             [(ngModel)]="vehicleSearchText"
                             [matAutocomplete]="vehicleAuto"
                             (input)="filterVehicles()"
                             (focus)="filterVehicles()"
                             placeholder="Type to search vehicles...">
                      <mat-autocomplete #vehicleAuto="matAutocomplete"
                                        [displayWith]="displayVehicle.bind(this)"
                                        (optionSelected)="onVehicleAutocompleteSelected($event)">
                        <mat-option [value]="null">-- Unassigned --</mat-option>
                        @for (vehicle of filteredVehicles; track vehicle.id) {
                          <mat-option [value]="vehicle">{{ vehicle.registrationNumber }} - {{ vehicle.make }} {{ vehicle.model }}</mat-option>
                        }
                      </mat-autocomplete>
                      <mat-icon matSuffix>local_shipping</mat-icon>
                      <mat-hint>{{ data.vehicles.length || 0 }} vehicles available</mat-hint>
                    </mat-form-field>

                    <mat-form-field appearance="outline">
                      <mat-label>Scheduled Date</mat-label>
                      <input matInput [matDatepicker]="picker" [(ngModel)]="scheduledDate">
                      <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
                      <mat-datepicker #picker></mat-datepicker>
                    </mat-form-field>
                  </div>

                  <div class="route-map-preview">
                    <div class="map-header">
                      <h3><mat-icon>map</mat-icon> Route Preview</h3>
                      <div class="map-actions">
                        <button mat-stroked-button color="primary" (click)="loadTfnDepots()" matTooltip="Show TFN depot locations on the map">
                          <mat-icon>store</mat-icon> TFN Depots
                        </button>
                        <button mat-icon-button (click)="refreshMap()" matTooltip="Refresh map">
                          <mat-icon>refresh</mat-icon>
                        </button>
                      </div>
                    </div>
                    <div id="tripsheetRouteMap" class="route-map"></div>
                    @if (selectedStops.length > 0) {
                      <div class="map-legend">
                        <span class="legend-item"><span class="marker warehouse"></span> Warehouse</span>
                        <span class="legend-item"><span class="marker stop"></span> Delivery Stop</span>
                        @if (tfnDepotsLoaded) {
                          <span class="legend-item"><span class="marker depot"></span> TFN Depot</span>
                        }
                      </div>
                    }
                    @if (selectedStops.length > 0 && !stopsHaveCoords()) {
                      <div class="map-warning">
                        <mat-icon>warning</mat-icon>
                        <span>Some stops are missing coordinates. Click "Geocode All"</span>
                      </div>
                    }
                  </div>
                </div><!-- end route-right-panel -->
              </div><!-- end route-layout-container -->

              <!-- Delivery stops now render inside the left route-config panel (draggable) -->
            </div>

            @if (routeStepBlockReason()) {
              <div class="route-block-reason">
                <mat-icon>error_outline</mat-icon>
                <span>{{ routeStepBlockReason() }}</span>
              </div>
            }

            <div class="step-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-raised-button color="primary" matStepperNext [disabled]="!canProceedToReview()"
                      [matTooltip]="routeStepBlockReason()">
                Next <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </mat-step>

          <!-- Step 3: Review & Generate -->
          <mat-step label="Review & Generate">
            <div class="step-content review-step">
              <div class="review-section">
                <h3><mat-icon>fact_check</mat-icon> Trip Sheet Summary</h3>
                
                <div class="review-grid">
                  <div class="review-card">
                    <h4><mat-icon>warehouse</mat-icon> Pickup</h4>
                    <p class="main-value">{{ selectedWarehouse?.name || 'Not selected' }}</p>
                    <p class="sub-value">{{ selectedWarehouse?.address }}</p>
                    <p class="sub-value">{{ scheduledDate | date:'EEEE, dd MMM yyyy' }}</p>
                  </div>
                  
                  <div class="review-card">
                    <h4><mat-icon>person</mat-icon> Driver</h4>
                    <p class="main-value">{{ selectedDriver ? (selectedDriver.firstName || '') + ' ' + (selectedDriver.lastName || '') : 'Unassigned' }}</p>
                    <p class="sub-value">{{ selectedDriver?.phoneNumber || '' }}</p>
                  </div>

                  <div class="review-card">
                    <h4><mat-icon>local_shipping</mat-icon> Vehicle</h4>
                    <p class="main-value">{{ selectedVehicle?.registrationNumber || 'Unassigned' }}</p>
                    <p class="sub-value">{{ selectedVehicle ? selectedVehicle.make + ' ' + selectedVehicle.model : '' }}</p>
                  </div>

                  <div class="review-card">
                    <h4><mat-icon>route</mat-icon> Route Info</h4>
                    <p class="main-value">{{ selectedStops.length }} stops</p>
                    <p class="sub-value">{{ totalDistance | number:'1.0-0' }} km • {{ estimatedTime }}</p>
                    <p class="sub-value">Total: R {{ totalValue | number:'1.2-2' }}</p>
                  </div>
                </div>

                <div class="stops-summary">
                  <h4><mat-icon>pin_drop</mat-icon> Delivery Stops</h4>
                  <table class="stops-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Customer</th>
                        <th>Invoice</th>
                        <th>Product</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (stop of selectedStops; track stop.id; let i = $index) {
                        <tr>
                          <td>{{ i + 1 }}</td>
                          <td>{{ stop.customerName }}</td>
                          <td>{{ stop.transactionNumber }}</td>
                          <td>{{ stop.productDescription | slice:0:25 }}...</td>
                          <td>R {{ stop.salesAmount | number:'1.2-2' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="step-actions final-actions">
              <button mat-button matStepperPrevious>
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              @if (data.salesMode) {
                <div class="action-buttons">
                  <button mat-raised-button (click)="previewPdf()" [disabled]="creating">
                    <mat-icon>preview</mat-icon> Preview PDF
                  </button>
                  <button mat-raised-button color="accent" (click)="createTripsheet(true)" [disabled]="creating"
                          matTooltip="Generate the trip sheet and email the signer to sign it off">
                    @if (creating) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>drive_file_rename_outline</mat-icon>
                    }
                    {{ creating ? 'Generating...' : 'Generate & Send to Sign' }}
                  </button>
                  <button mat-raised-button color="primary" (click)="createTripsheet(false)" [disabled]="creating"
                          matTooltip="Generate the trip sheet and route it straight to the approver">
                    @if (creating) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>how_to_reg</mat-icon>
                    }
                    {{ creating ? 'Generating...' : 'Generate & Wait for Approval' }}
                  </button>
                </div>
              } @else {
                <div class="action-buttons">
                  <button mat-raised-button (click)="previewPdf()" [disabled]="creating">
                    <mat-icon>preview</mat-icon> Preview PDF
                  </button>
                  <button mat-raised-button color="accent" (click)="createAndEmail()" [disabled]="creating">
                    @if (creating) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>email</mat-icon>
                    }
                    {{ creating ? 'Sending...' : (data.isEditMode ? 'Update & Email' : 'Create & Email') }}
                  </button>
                  <button mat-raised-button color="primary" (click)="createTripsheet()" [disabled]="creating">
                    @if (creating) {
                      <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
                    } @else {
                      <mat-icon>{{ data.isEditMode ? 'save' : 'check' }}</mat-icon>
                    }
                    {{ creating ? (data.isEditMode ? 'Updating...' : 'Creating...') : (data.isEditMode ? 'Update & Download' : 'Create & Download') }}
                  </button>
                </div>
              }
            </div>
          </mat-step>
        </mat-stepper>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .create-tripsheet-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      gap: 16px;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
      font-weight: 500;
    }
    .header-info {
      display: flex;
      gap: 12px;
      flex: 1;
      justify-content: flex-end;
      margin-right: 16px;
    }
    .header-info mat-chip {
      background: rgba(255,255,255,0.2) !important;
      color: white !important;
    }
    .header-info .draft-badge {
      background: #1976d2 !important;
      color: white !important;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .header-info .draft-badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .header-info .saving-badge {
      background: #2196f3 !important;
      color: white !important;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      flex: 1;
      padding: 24px;
      overflow: auto;
    }
    .step-content {
      display: flex;
      gap: 24px;
      min-height: 520px;
      padding: 16px 0;
    }
    .step-content.route-step {
      display: flex;
      flex-direction: column;
      gap: 20px;
      min-height: auto;
      max-height: none;
      overflow: visible;
    }
    /* Side-by-side layout for Route Details */
    .route-layout-container {
      display: flex;
      gap: 20px;
      min-height: 550px;
    }
    .route-left-panel {
      flex: 1 1 50%;
      min-width: 460px;
      max-width: none;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }
    .route-right-panel {
      flex: 1 1 50%;
      min-width: 420px;
      max-width: 760px;
      display: flex;
      flex-direction: column;
    }
    .route-left-panel .route-config {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .route-left-panel .route-config h3 {
      font-size: 14px;
      margin-bottom: 12px;
    }
    .route-right-panel .route-map-preview {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .route-right-panel .route-map {
      flex: 1;
      min-height: 420px;
    }
    .config-grid-compact {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    .config-grid-compact mat-form-field {
      font-size: 13px;
    }
    .config-grid-compact mat-form-field ::ng-deep .mat-mdc-form-field-infix {
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .config-grid-compact mat-form-field {
      width: 100%;
    }
    .source-panel, .stops-panel {
      flex: 1;
      background: #f5f5f5;
      border-radius: 12px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      max-height: 100%;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: white;
      border-bottom: 1px solid #e0e0e0;
    }
    .panel-header h3 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      color: #333;
    }
    .panel-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .search-field {
      width: 250px;
    }
    .invoice-list, .stops-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      height: 400px; /* Required for virtual scroll */
    }
    .invoice-list {
      contain: strict; /* Performance optimization */
    }
    .scroll-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: #fff3e0;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 12px;
      color: #e65100;
    }
    .scroll-hint mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .invoice-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: white;
      border-radius: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
    }
    .invoice-item:hover {
      background: #e3f2fd;
    }
    .invoice-item.selected {
      border-color: #2563eb;
      background: #ede7f6;
    }
    .invoice-info {
      display: flex;
      flex-direction: column;
      min-width: 150px;
      gap: 2px;
    }
    .invoice-number {
      font-weight: 600;
      color: #333;
      font-size: 13px;
    }
    .customer-name {
      font-size: 14px;
      color: #1976d2;
    }
    .province-badge {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
      display: inline-block;
      width: fit-content;
      text-transform: uppercase;
      background: #e0e0e0;
      color: #555;
    }
    .province-gp, .province-gauteng { background: #e3f2fd; color: #1565c0; }
    .province-kzn, .province-kwazulu-natal { background: #fff3e0; color: #ef6c00; }
    .province-wc, .province-western-cape { background: #e8f5e9; color: #2e7d32; }
    .province-ec, .province-eastern-cape { background: #fce4ec; color: #c2185b; }
    .province-mp, .province-mpumalanga { background: #f3e5f5; color: #7b1fa2; }
    .province-lp, .province-limpopo { background: #e0f2f1; color: #00695c; }
    .province-fs, .province-free-state { background: #fff8e1; color: #f9a825; }
    .province-nw, .province-north-west { background: #efebe9; color: #5d4037; }
    .province-nc, .province-northern-cape { background: #fbe9e7; color: #d84315; }
    .filter-controls {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .province-filter {
      min-width: 180px;
    }
    .loading-provinces {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #e3f2fd;
      color: #1565c0;
      font-size: 13px;
    }
    .city {
      font-size: 11px;
      color: #888;
    }
    .invoice-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .product {
      font-size: 12px;
      color: #666;
    }
    .amount {
      font-weight: 600;
      color: #4caf50;
    }
    .add-icon {
      color: #2563eb;
      opacity: 0;
      transition: opacity 0.2s;
    }
    .invoice-item:hover .add-icon {
      opacity: 1;
    }
    .stop-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: white;
      border-radius: 8px;
      margin-bottom: 8px;
      border-left: 4px solid #2563eb;
    }
    .stop-drag-handle {
      cursor: move;
      color: #999;
    }
    .stop-sequence {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #2563eb;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 13px;
    }
    .stop-info {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
    .stop-customer {
      font-weight: 600;
      color: #333;
    }
    .stop-address {
      font-size: 12px;
      color: #666;
    }
    .stop-invoice {
      font-size: 11px;
      color: #999;
    }
    .stop-value {
      font-weight: 600;
      color: #4caf50;
    }
    
    /* Part Delivery Styles */
    .part-delivery-toggle {
      display: flex;
      align-items: center;
      margin-left: auto;
    }
    .part-delivery-toggle mat-checkbox {
      transform: scale(0.9);
    }
    .part-delivery-label {
      font-size: 11px;
      font-weight: 500;
      color: #f57c00;
    }
    .invoice-item.part-delivery-marked {
      border-color: #ff9800;
      background: #fff8e1;
    }
    .invoice-item.part-delivery-marked:hover {
      background: #ffecb3;
    }
    .add-btn {
      margin-left: 4px;
    }
    .add-btn .add-icon {
      opacity: 1 !important;
      color: #2563eb;
    }
    .invoice-item .quantity {
      font-size: 11px;
      color: #1976d2;
      font-weight: 500;
    }
    .stop-item.part-delivery {
      border-left-color: #ff9800;
      background: #fffde7;
    }
    .part-delivery-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 12px;
      background: #ff9800;
      color: white;
      font-weight: 600;
      margin-top: 4px;
    }
    .part-delivery-badge mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }
    .stop-item.delivery-note {
      border-left-color: #4caf50;
      background: #e8f5e9;
    }
    .delivery-note-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 12px;
      background: #4caf50;
      color: white;
      font-weight: 600;
      margin-top: 4px;
    }
    .delivery-note-badge mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }
    .part-delivery-qty {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .qty-field {
      width: 80px;
    }
    .qty-field input {
      text-align: center;
    }
    .qty-field .mat-mdc-form-field-hint {
      font-size: 10px;
      color: #888;
    }
    .empty-list, .empty-stops {
      text-align: center;
      padding: 40px 20px;
      color: #999;
    }
    .empty-list mat-icon, .empty-stops mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }
    .step-actions {
      display: flex;
      justify-content: space-between;
      padding: 16px 0;
      border-top: 1px solid #e0e0e0;
      margin-top: 16px;
    }
    .route-config {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      border: 1px solid #e0e0e0;
      margin-bottom: 20px;
    }
    .route-config h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
      color: #1976d2;
    }
    .config-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
      margin-bottom: 16px;
      color: #e65100;
    }
    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .config-grid mat-form-field {
      width: 100%;
    }
    .optimize-section {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    .optimize-section button {
      font-size: 12px;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    .route-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      padding: 12px;
      background: #e8f5e9;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .route-summary .summary-item {
      min-width: fit-content;
      font-size: 13px;
    }
    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .summary-item mat-icon {
      color: #4caf50;
    }
    .summary-item .label {
      color: #666;
    }
    .summary-item .value {
      font-weight: 600;
      color: #333;
    }
    .full-width {
      width: 100%;
    }
    .route-map-preview {
      margin-bottom: 24px;
      background: #f8f9fa;
      border-radius: 12px;
      padding: 16px;
    }
    .map-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .map-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
    }
    .map-actions {
      display: flex;
      gap: 8px;
    }
    .route-map {
      height: 350px;
      border-radius: 12px;
      background: #e5e3df;
      border: 1px solid #ddd;
    }
    .map-legend {
      display: flex;
      gap: 16px;
      margin-top: 12px;
      padding: 8px 12px;
      background: #fff;
      border-radius: 8px;
      font-size: 12px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend-item .marker {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    }
    .legend-item .marker.warehouse {
      background: #4caf50;
    }
    .legend-item .marker.stop {
      background: #2563eb;
    }
    .legend-item .marker.depot {
      background: #ff9800;
    }
    .map-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      padding: 10px 14px;
      background: #fff3cd;
      color: #856404;
      border-radius: 8px;
      font-size: 13px;
    }
    .map-warning mat-icon {
      color: #e65100;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    /* Stops Address Section */
    .stops-address-section {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 16px;
      margin-top: 20px;
    }
    .stops-address-section .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .stops-address-section .section-header h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: 16px;
      color: #333;
    }
    .stops-address-section .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stops-address-section .coord-status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #666;
    }
    .coord-status mat-icon.success { color: #4caf50; }
    .coord-status mat-icon.warning { color: #ff9800; }

    /* Assignments (driver/vehicle/date) above the route preview map */
    .trip-assign-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 12px;
      margin-bottom: 14px;
    }
    @media (max-width: 900px) { .trip-assign-grid { grid-template-columns: 1fr; } }

    /* Stops relocated under the pickup warehouse in the left config panel */
    .stops-address-section.under-config {
      margin-top: 16px;
      padding: 12px;
      background: #f8fafc;
      border: 1px solid #e5e9f0;
    }
    .stops-address-section.under-config .header-actions { flex-wrap: wrap; }
    /* Keep the relocated stops list scrollable within the config panel */
    .stops-address-section.under-config .stops-list {
      max-height: 46vh;
      overflow-y: auto;
    }
    .drag-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 10px;
      font-size: 12px;
      color: #64748b;
    }
    .drag-hint mat-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; }

    /* Drag handle + drag states for the Google-style itinerary */
    .stop-drag-grip {
      align-self: center;
      border: none;
      background: transparent;
      color: #94a3b8;
      cursor: grab;
      padding: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .stop-drag-grip:hover { color: #475569; }
    .stop-drag-grip:active { cursor: grabbing; }
    .stop-item.cdk-drag-preview,
    .stop-drag-preview {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #1976d2;
      color: #fff;
      padding: 10px 16px;
      border-radius: 10px;
      font-weight: 600;
      font-size: 13.5px;
      box-shadow: 0 12px 28px rgba(25,118,210,.35);
    }
    .stop-drag-preview mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .stop-item.cdk-drag-placeholder { opacity: .35; }
    .stops-list.cdk-drop-list-dragging .stop-item:not(.cdk-drag-placeholder) {
      transition: transform .2s cubic-bezier(0,0,.2,1);
    }

    .stops-list {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #eee;
      border-radius: 8px;
    }
    .stop-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px;
      border-bottom: 1px solid #f0f0f0;
      transition: all 0.2s;
    }
    .stop-item:last-child { border-bottom: none; }
    .stop-item:hover { background: #f9f9f9; }
    .stop-item.missing-coords {
      background: #fff8e1;
      border-left: 3px solid #ff9800;
    }
    .stop-item.collapsed {
      padding: 10px 14px;
      background: #f8fdf8;
      border-left: 3px solid #4caf50;
    }
    .stop-number {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2563eb, #1e40af);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 13px;
      flex-shrink: 0;
    }
    .stop-details {
      flex: 1;
      min-width: 0;
    }
    .stop-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      cursor: pointer;
      padding: 4px 0;
    }
    .stop-header .customer-info {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }
    .stop-header .customer-name {
      font-weight: 500;
      color: #333;
    }
    .stop-header .invoice-number {
      font-size: 12px;
      color: #888;
      background: #f0f0f0;
      padding: 2px 8px;
      border-radius: 4px;
    }
    .stop-header .invoice-count {
      font-size: 11px;
      background: #e3f2fd !important;
      color: #1976d2 !important;
    }
    .stop-header .stop-status {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .stop-header .coord-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .stop-header .coord-icon.success { color: #4caf50; }
    .stop-header .coord-icon.warning { color: #ff9800; }
    .stop-header .collapse-icon {
      color: #999;
      transition: transform 0.2s;
    }
    
    .saved-addresses-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 8px 0;
    }
    .saved-address-select {
      flex: 1;
      max-width: 400px;
    }
    .saved-addr-option {
      display: flex;
      flex-direction: column;
      padding: 4px 0;
    }
    .saved-addr-option .addr-label {
      font-weight: 500;
      font-size: 13px;
      color: #333;
    }
    .saved-addr-option .addr-text {
      font-size: 12px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 350px;
    }
    .saved-addr-option .addr-usage {
      font-size: 11px;
      color: #888;
      font-style: italic;
    }
    .or-divider {
      color: #999;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
    }
    
    .stop-address-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .stop-address-row .address-field {
      flex: 1;
    }
    .stop-address-row .address-field .mat-mdc-form-field-subscript-wrapper {
      height: 16px;
    }
    .stop-location-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #666;
      margin-top: 6px;
    }
    .address-warning-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fff3e0;
      border: 1px solid #ffb74d;
      color: #e65100;
      border-radius: 6px;
      padding: 8px 12px;
      margin: 8px 0;
      font-size: 12.5px;
    }
    .address-warning-banner mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #f57c00;
    }
    .address-warning-banner.missing {
      background: #ffebee;
      border-color: #ef9a9a;
      color: #c62828;
    }
    .address-warning-banner.missing mat-icon { color: #e53935; }
    .address-info-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #e3f2fd;
      border: 1px solid #90caf9;
      color: #1565c0;
      border-radius: 6px;
      padding: 8px 12px;
      margin: 8px 0;
      font-size: 12.5px;
    }
    .address-info-banner mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #1976d2;
    }
    .route-block-reason {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffebee;
      border: 1px solid #ef9a9a;
      color: #c62828;
      border-radius: 6px;
      padding: 10px 14px;
      margin: 12px 0 4px;
      font-size: 13px;
      font-weight: 500;
    }
    .route-block-reason mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #e53935;
    }
    .stop-location-info mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: #888;
    }
    
    .collapsed-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #4caf50;
      margin-top: 4px;
    }
    .collapsed-info mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .collapsed-info span {
      color: #666;
      font-size: 12px;
    }
    
    .grouped-invoices {
      margin-top: 12px;
      padding: 10px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .grouped-invoices .invoices-label {
      display: block;
      font-size: 11px;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .grouped-invoices .invoice-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .grouped-invoices .invoice-chips mat-chip {
      font-size: 11px;
      min-height: 24px;
      padding: 0 10px;
    }
    
    .stop-value {
      font-weight: 600;
      color: #4caf50;
      white-space: nowrap;
      padding-top: 4px;
      font-size: 14px;
    }
    .stops-actions {
      display: flex;
      gap: 12px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #eee;
    }
    
    .review-step {
      flex-direction: column;
    }
    .review-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 20px;
    }
    .review-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .review-card {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 12px;
    }
    .review-card h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 12px 0;
      color: #2563eb;
      font-size: 14px;
    }
    .review-card .main-value {
      font-weight: 600;
      font-size: 16px;
      margin: 0;
    }
    .review-card .sub-value {
      font-size: 13px;
      color: #666;
      margin: 4px 0 0 0;
    }
    .stops-summary {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 12px;
    }
    .stops-summary h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px 0;
    }
    .stops-table {
      width: 100%;
      border-collapse: collapse;
    }
    .stops-table th, .stops-table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    .stops-table th {
      background: #e0e0e0;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
    }
    .stops-table tr:hover {
      background: #f0f0f0;
    }
    .final-actions {
      justify-content: space-between;
    }
    .action-buttons {
      display: flex;
      gap: 12px;
    }
    .cdk-drag-preview {
      box-shadow: 0 5px 20px rgba(0,0,0,0.2);
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
    .cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }
    .optimization-message {
      padding: 12px 16px;
      border-radius: 8px;
      margin-top: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .optimization-message.success {
      background: #e8f5e9;
      color: #2e7d32;
      border: 1px solid #a5d6a7;
    }
    .optimization-message.error {
      background: #ffebee;
      color: #c62828;
      border: 1px solid #ef9a9a;
    }
    .optimization-message.pending {
      background: #e3f2fd;
      color: #1565c0;
      border: 1px solid #90caf9;
    }
    mat-checkbox.mat-mdc-checkbox {
      margin-left: 8px;
    }
    mat-checkbox .checkbox-icon {
      font-size: 18px;
      height: 18px;
      width: 18px;
      margin-right: 4px;
      vertical-align: middle;
    }
    .fuel-estimate {
      padding: 8px 12px;
      background: #fff3e0;
      border-radius: 8px;
      border: 1px solid #ffcc80;
      color: #e65100;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .distance-matrix-container {
      margin-top: 16px;
      background: #fafafa;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      overflow: hidden;
    }
    .matrix-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #2563eb;
      color: white;
    }
    .matrix-header h4 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }
    .matrix-header button {
      color: white;
    }
    .matrix-scroll {
      overflow-x: auto;
      max-height: 300px;
      overflow-y: auto;
    }
    .distance-matrix {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .distance-matrix th, .distance-matrix td {
      padding: 6px 8px;
      text-align: center;
      border: 1px solid #e0e0e0;
      min-width: 60px;
    }
    .distance-matrix thead th {
      background: #f5f5f5;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .distance-matrix .label-cell {
      background: #f5f5f5;
      font-weight: 600;
      position: sticky;
      left: 0;
      z-index: 1;
      min-width: 40px;
    }
    .distance-matrix .header-cell {
      max-width: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .distance-matrix .matrix-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      background: white;
    }
    .distance-matrix .matrix-cell.diagonal {
      background: #e0e0e0;
    }
    .distance-matrix .matrix-cell .distance {
      font-weight: 600;
      color: #1976d2;
    }
    .distance-matrix .matrix-cell .duration {
      font-size: 10px;
      color: #666;
    }
    .distance-matrix .diagonal-marker {
      color: #999;
    }
    .matrix-legend {
      display: flex;
      gap: 24px;
      padding: 8px 16px;
      background: #f5f5f5;
      font-size: 11px;
      color: #666;
      border-top: 1px solid #e0e0e0;
    }
    @media (max-width: 1200px) {
      .config-grid, .review-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class CreateTripsheetDialog implements AfterViewInit, OnDestroy {
  invoiceSearch = '';
  selectedStops: any[] = [];
  selectedWarehouse: any = null;
  selectedDriver: any = null;
  selectedVehicle: any = null;
  scheduledDate = new Date();
  specialInstructions = '';
  selectedProvince = 'all';
  loadingProvinces = false;
  
  // Draft auto-save tracking
  draftId: number | null = null;
  autoSaving = false;
  lastAutoSaved: Date | null = null;
  
  // Performance optimization: Set for O(1) lookup
  private selectedStopIds = new Set<number>();
  
  // Performance optimization: Cached filtered invoices
  private _cachedFilteredInvoices: any[] = [];
  private _lastSearchTerm = '';
  private _lastProvince = 'all';
  private _cacheValid = false;
  
  // Debounced search subject
  private searchSubject = new Subject<string>();
  private searchSubscription: any;
  
  // Searchable dropdown filters
  warehouseSearchText = '';
  driverSearchText = '';
  vehicleSearchText = '';
  filteredWarehouses: any[] = [];
  filteredDrivers: any[] = [];
  filteredVehicles: any[] = [];
  
  // Part Delivery tracking - stores invoice IDs that are marked as part delivery
  partDeliveryMap: Map<number, boolean> = new Map();
  
  // Saved delivery addresses for customers
  customerSavedAddresses: Map<string, any[]> = new Map(); // Map customer name/code to saved addresses
  loadingSavedAddresses = false;
  
  // Google Maps API key
  private readonly googleMapsApiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
  
  // Optimization state
  advancedOptimizing = false;
  optimizationMessage = '';
  optimizationSuccess = false;
  fuelEstimate = 0;
  fuelCost = 0;
  private readonly fuelPricePerLiter = 22.50; // ZAR
  private readonly avgFuelConsumption = 12; // L/100km for delivery truck
  
  // Distance Matrix state
  distanceMatrix: any[][] = [];
  distanceMatrixLabels: string[] = [];
  calculatingMatrix = false;
  showDistanceMatrix = false;
  
  // South African provinces
  provinces = [
    { code: 'GP', name: 'Gauteng' },
    { code: 'KZN', name: 'KwaZulu-Natal' },
    { code: 'WC', name: 'Western Cape' },
    { code: 'EC', name: 'Eastern Cape' },
    { code: 'MP', name: 'Mpumalanga' },
    { code: 'LP', name: 'Limpopo' },
    { code: 'FS', name: 'Free State' },
    { code: 'NW', name: 'North West' },
    { code: 'NC', name: 'Northern Cape' }
  ];
  
  // Province keywords for address matching (expanded with more SA cities/towns and hospitals)
  private provinceKeywords: { [key: string]: string[] } = {
    'GP': ['gauteng', 'johannesburg', 'pretoria', 'sandton', 'randburg', 'centurion', 'midrand', 'soweto', 'benoni', 'boksburg', 'germiston', 'edenvale', 'alberton', 'kempton park', 'roodepoort', 'krugersdorp', 'vanderbijlpark', 'vereeniging', 'springs', 'nigel', 'bronkhorstspruit', 'fourways', 'bedfordview', 'modderfontein', 'isando', 'spartan', 'jet park', 'elandsfontein', 'tshwane', 'doornpoort', 'wonderboom', 'lyttelton', 'irene', 'hatfield', 'arcadia', 'sunnyside', 'menlyn', 'brooklyn', 'pholosong', 'tembisa', 'thelle mogoerane', 'natalspruit', 'far east rand', 'kalafong', 'steve biko', 'dr george mukhari', 'charlotte maxeke', 'chris hani baragwanath', 'helen joseph', 'rahima moosa', 'leratong', 'bheki mlangeni', 'kopanong', 'sebokeng', 'heidelberg', 'carletonville', '08-gp', 'gp1-', 'gp2-', 'gp-'],
    'KZN': ['kwazulu-natal', 'kwazulu natal', 'durban', 'pietermaritzburg', 'newcastle', 'richards bay', 'ladysmith', 'ballito', 'umhlanga', 'pinetown', 'westville', 'amanzimtoti', 'scottburgh', 'port shepstone', 'margate', 'tongaat', 'stanger', 'empangeni', 'eshowe', 'vryheid', 'verulam', 'phoenix', 'chatsworth', 'umlazi', 'kingsburgh', 'hillcrest', 'kloof', 'greytown', 'estcourt', 'mooi river', 'dundee', 'glencoe', 'dannhauser', 'utrecht', 'paulpietersburg', 'nongoma', 'ulundi', 'mtubatuba', 'hluhluwe', 'jozini', 'ingwavuma', 'kokstad', 'ixopo', 'harding', 'mount edgecombe', 'umkomaas', 'warner beach', 'hibberdene', 'pennington', 'umzinto', 'shelley beach', 'uvongo', 'ramsgate', 'southbroom', 'umtentweni', 'ozwatini', 'canelands', 'darnall', 'dalbridge', 'umbilo', 'wentworth', 'king cetshwayo', 'harry gwala', 'edendale', 'grey', 'g.j crookes', 'gj crookes', 'gjgm', 'mseleni', 'st margarets', 'ugu', 'ilembe', 'king dinuzulu', 'umgeni', 'inkosi albert luthuli', 'addington', 'prince mshiyeni', 'mahatma gandhi', 'r k khan', 'northdale', 'greys', 'edendale', '01-', 'kzn-'],
    'WC': ['western cape', 'cape town', 'stellenbosch', 'paarl', 'george', 'knysna', 'mossel bay', 'worcester', 'bellville', 'somerset west', 'strand', 'hermanus', 'franschhoek', 'wellington', 'malmesbury', 'saldanha', 'vredenburg', 'montagu', 'robertson', 'oudtshoorn', 'beaufort west', 'atlantis', 'milnerton', 'parow', 'goodwood', 'epping', 'durbanville', 'brackenfell', 'kraaifontein', 'kuilsriver', 'eerste river', 'mitchells plain', 'grassy park', 'retreat', 'fish hoek', 'simons town', 'muizenberg', 'tokai', 'constantia', 'camps bay', 'sea point', 'green point', 'waterfront', 'woodstock', 'observatory', 'rondebosch', 'newlands', 'claremont', 'kenilworth', 'wynberg', 'plumstead', 'diep river', 'groote schuur', 'tygerberg', 'red cross', 'khayelitsha', 'mitchells plain', '05-', 'wc-'],
    'EC': ['eastern cape', 'port elizabeth', 'gqeberha', 'east london', 'mthatha', 'uitenhage', 'grahamstown', 'makhanda', 'queenstown', 'king williams town', 'jeffreys bay', 'despatch', 'cradock', 'graaff-reinet', 'aliwal north', 'fort beaufort', 'bisho', 'bhisho', 'mdantsane', 'zwelitsha', 'alice', 'fort hare', 'stutterheim', 'komani', 'dordrecht', 'lady frere', 'cofimvaba', 'engcobo', 'ngcobo', 'libode', 'flagstaff', 'lusikisiki', 'port st johns', 'willowvale', 'centane', 'butterworth', 'idutywa', 'gcuwa', 'dutywa', 'willowmore', 'aberdeen', 'middelburg ec', 'steytlerville', 'humansdorp', 'st francis', 'colchester', 'addo', 'paterson', 'nanaga', 'kirkwood', 'sundays river', 'bathurst', 'port alfred', 'kenton', 'lukhanji', 'frere', 'cecilia makiwane', 'dora nginza', 'livingstone', 'settlers', 'frontier', 'nelson mandela bay', '06-', 'ec-', 'ech-'],
    'MP': ['mpumalanga', 'nelspruit', 'mbombela', 'witbank', 'emalahleni', 'middelburg', 'secunda', 'ermelo', 'standerton', 'barberton', 'white river', 'hazyview', 'piet retief', 'bethal', 'lydenburg', 'sabie', 'graskop', 'komatipoort', 'malelane', 'kaapmuiden', 'matsulu', 'kabokweni', 'kanyamazane', 'nsikazi', 'bushbuckridge', 'acornhoek', 'hoedspruit', 'phalaborwa mp', 'delmas', 'ogies', 'kriel', 'trichardt', 'evander', 'leandra', 'kinross', 'charl cilliers', 'morgenzon', 'volksrust', 'wakkerstroom', 'amsterdam', 'carolina', 'badplaas', 'chrissiesmeer', 'dullstroom', 'machadodorp', 'waterval boven', 'waterval onder', 'schoemanskloof', 'rob ferreira', 'themba', 'mapulaneng', 'matikwana', 'shongwe', 'tintswalo', 'mmametlhake', '09-', 'mp-'],
    'LP': ['limpopo', 'polokwane', 'pietersburg', 'tzaneen', 'louis trichardt', 'makhado', 'thohoyandou', 'mokopane', 'potgietersrus', 'phalaborwa', 'bela-bela', 'warmbaths', 'modimolle', 'nylstroom', 'lephalale', 'ellisras', 'musina', 'messina', 'groblersdal', 'lebowakgomo', 'seshego', 'mankweng', 'turfloop', 'burgersfort', 'steelpoort', 'jane furse', 'nebo', 'marble hall', 'roedtan', 'settlers', 'naboomspruit', 'mookgophong', 'vaalwater', 'thabazimbi', 'northam', 'gilead', 'senwabarwana', 'bochum', 'dendron', 'botlokwa', 'morebeng', 'soekmekaar', 'duiwelskloof', 'modjadjiskloof', 'giyani', 'malamulele', 'elim', 'levubu', 'sibasa', 'vuwani', 'mutale', 'masisi', 'alldays', 'waterpoort', 'vivo', 'mara', 'namakgale', 'hoedspruit', 'maphutha malatji', 'letaba', 'st ritas', 'voortrekker', 'mokopane', 'tshilidzini', 'donald fraser', 'elim', 'louis trichardt', 'siloam', 'lppd', '02-', 'lp-'],
    'FS': ['free state', 'bloemfontein', 'welkom', 'bethlehem', 'kroonstad', 'sasolburg', 'parys', 'phuthaditjhaba', 'harrismith', 'virginia', 'bothaville', 'ladybrand', 'ficksburg', 'zastron', 'mangaung', 'botshabelo', 'thaba nchu', 'dewetsdorp', 'wepener', 'hobhouse', 'senekal', 'marquard', 'clocolan', 'fouriesburg', 'clarens', 'golden gate', 'paul roux', 'rosendal', 'memel', 'vrede', 'frankfort', 'villiers', 'cornelia', 'reitz', 'lindley', 'heilbron', 'petrus steyn', 'edenville', 'steynsrus', 'hennenman', 'ventersburg', 'theunissen', 'brandfort', 'winburg', 'verkeerdevlei', 'soutpan', 'bultfontein', 'wesselsbron', 'hoopstad', 'dealesville', 'boshof', 'hertzogville', 'jacobsdal', 'koffiefontein', 'jagersfontein', 'fauresmith', 'trompsburg', 'philippolis', 'springfontein', 'edenburg', 'reddersburg', 'excelsior', 'tweespruit', 'pelonomi', 'universitas', 'national', 'boitumelo', 'bongani', 'dihlabeng', 'fsh-', 'fs health', '04-'],
    'NW': ['north west', 'rustenburg', 'potchefstroom', 'klerksdorp', 'mafikeng', 'mahikeng', 'brits', 'hartbeespoort', 'vryburg', 'lichtenburg', 'orkney', 'stilfontein', 'zeerust', 'koster', 'coligny', 'mogwase', 'sun city', 'pilanesberg', 'phokeng', 'tlhabane', 'moruleng', 'swartruggens', 'groot marico', 'madibogo', 'mmabatho', 'montshioa', 'rooigrond', 'stella', 'schweizer-reneke', 'bloemhof', 'christiana', 'warrenton', 'jan kempdorp', 'pampierstad', 'hartswater', 'taung', 'ventersdorp', 'tlokwe', 'potch', 'mooirivier', 'fochville', 'carletonville', 'westonaria', 'merafong', 'oberholzer', 'randfontein', 'mogale', 'kagiso', 'munsieville', 'mooinooi', 'marikana', 'job shimankana', 'tshepong', 'klerksdorp', 'potchefstroom', '03-', 'nw-'],
    'NC': ['northern cape', 'kimberley', 'upington', 'springbok', 'kathu', 'de aar', 'kuruman', 'colesberg', 'carnarvon', 'calvinia', 'port nolloth', 'sutherland', 'prieska', 'victoria west', 'hanover', 'richmond', 'middelburg nc', 'graaff reinet', 'nieu bethesda', 'graaf reinet', 'britstown', 'hopetown', 'strydenburg', 'petrusville', 'philipstown', 'douglas', 'griekwastad', 'campbell', 'danielskuil', 'postmasburg', 'olifantshoek', 'hotazel', 'black rock', 'sishen', 'dingleton', 'askham', 'mier', 'rietfontein', 'noenieput', 'twee rivieren', 'nababeep', 'okiep', 'concordia', 'bulletrap', 'komaggas', 'steinkopf', 'vioolsdrif', 'pofadder', 'aggeneys', 'pella', 'onseepkans', 'kakamas', 'keimoes', 'kenhardt', 'brandvlei', 'vanwyksvlei', 'loeriesfontein', 'nieuwoudtville', 'garies', 'kamieskroon', 'hondeklipbaai', 'robert mangaliso', 'pixley ka seme', 'pixley ke seme', 'nc health', 'nch-', '07-']
  };
  
  // Cache for customer provinces and coordinates
  private customerProvinceCache: Map<string, { 
    province: string; 
    city: string; 
    latitude?: number; 
    longitude?: number;
    formattedAddress?: string;
  }> = new Map();
  
  totalDistance = 0;
  estimatedTime = '';
  totalValue = 0;
  returnDistance = 0;
  returnTime = '';
  
  optimizing = false;
  calculating = false;
  creating = false;
  
  // TFN Depot markers
  tfnDepotsLoaded = false;
  private tfnDepotMarkers: google.maps.Marker[] = [];
  private tfnDepots = [
    { name: 'TFN Depot - Johannesburg', code: 'JHB', province: 'GP', latitude: -26.1496, longitude: 28.2381, address: 'Isando, Johannesburg' },
    { name: 'TFN Depot - Durban', code: 'DBN', province: 'KZN', latitude: -29.8115, longitude: 30.9622, address: 'Pinetown, Durban' },
    { name: 'TFN Depot - Cape Town', code: 'CPT', province: 'WC', latitude: -33.9416, longitude: 18.6006, address: 'Epping, Cape Town' },
    { name: 'TFN Depot - Port Elizabeth', code: 'PE', province: 'EC', latitude: -33.8688, longitude: 25.5701, address: 'Deal Party, Gqeberha' },
    { name: 'TFN Depot - Bloemfontein', code: 'BFN', province: 'FS', latitude: -29.1211, longitude: 26.2140, address: 'Bloemfontein' },
    { name: 'TFN Depot - Polokwane', code: 'PLK', province: 'LP', latitude: -23.9045, longitude: 29.4530, address: 'Polokwane' },
    { name: 'TFN Depot - Nelspruit', code: 'NLP', province: 'MP', latitude: -25.4753, longitude: 30.9694, address: 'Mbombela' },
    { name: 'TFN Depot - Rustenburg', code: 'RST', province: 'NW', latitude: -25.6674, longitude: 27.2421, address: 'Rustenburg' }
  ];
  
  // Geocoding state
  geocodingStop: any = null;
  
  // Grouped stops (same customer address = 1 stop)
  groupedStops: any[] = [];
  
  // Google Places Autocomplete
  addressPredictions: any[] = [];
  private autocompleteService: any = null;
  private placesService: any = null;
  private addressInputSubject = new Subject<{group: any, query: string}>();
  private ngZone: NgZone;
  
  tripForm = new FormGroup({});
  
  private map: google.maps.Map | null = null;
  private routePolyline: google.maps.Polyline | null = null;
  private directionsRenderer: any = null;
  private directionsService: any = null;
  private stopMarkers: google.maps.Marker[] = [];
  private http: HttpClient;
  private mapInitialized = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { 
      invoices: any[], 
      drivers: any[], 
      vehicles: any[], 
      warehouses: any[],
      customers: any[],
      apiUrl: string,
      isImport?: boolean,
      batchId?: string,
      preSelectedInvoices?: any[],
      // Edit mode fields
      isEditMode?: boolean,
      editLoadId?: number,
      existingTripsheet?: any,
      preSelectedWarehouse?: any,
      preSelectedDriver?: any,
      preSelectedVehicle?: any,
      preScheduledDate?: Date,
      preSpecialInstructions?: string,
      preTotalDistance?: number,
      preEstimatedTime?: string,
      // Sales mode — create a Sales Trip Sheet pending two-person approval instead of a live load
      salesMode?: boolean,
      routeArea?: string,
      createdByName?: string | null,
      signerUserId?: number | null,
      signerName?: string | null,
      approverUserId?: number | null,
      approverName?: string | null,
      isManualTripsheet?: boolean
    },
    private dialogRef: MatDialogRef<CreateTripsheetDialog>,
    private injector: Injector,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {
    this.http = this.injector.get(HttpClient);
    this.ngZone = this.injector.get(NgZone);
    
    // Initialize filtered arrays for searchable dropdowns
    this.filteredWarehouses = [...(data.warehouses || [])];
    this.filteredDrivers = [...(data.drivers || [])];
    this.filteredVehicles = [...(data.vehicles || [])];
    
    // Handle edit mode pre-population
    if (data.isEditMode) {
      // Set pre-selected values
      if (data.preSelectedWarehouse) {
        this.selectedWarehouse = data.preSelectedWarehouse;
        this.warehouseSearchText = data.preSelectedWarehouse.name || '';
      } else if (data.warehouses?.length > 0) {
        this.selectedWarehouse = data.warehouses[0];
        this.warehouseSearchText = data.warehouses[0].name || '';
      }
      if (data.preSelectedDriver) {
        this.selectedDriver = data.preSelectedDriver;
        this.driverSearchText = `${data.preSelectedDriver.firstName || ''} ${data.preSelectedDriver.lastName || ''}`.trim();
      }
      if (data.preSelectedVehicle) {
        this.selectedVehicle = data.preSelectedVehicle;
        this.vehicleSearchText = data.preSelectedVehicle.registrationNumber || '';
      }
      if (data.preScheduledDate) {
        this.scheduledDate = data.preScheduledDate;
      }
      if (data.preSpecialInstructions) {
        this.specialInstructions = data.preSpecialInstructions;
      }
      if (data.preTotalDistance) {
        this.totalDistance = data.preTotalDistance;
      }
      if (data.preEstimatedTime) {
        this.estimatedTime = data.preEstimatedTime;
      }
    } else {
      // Set first warehouse as default for new tripsheets
      if (data.warehouses && data.warehouses.length > 0) {
        this.selectedWarehouse = data.warehouses[0];
        this.warehouseSearchText = data.warehouses[0].name || '';
      }
    }
    
    // Initialize province data for invoices
    this.initializeProvinceData();
    
    // If coming from import or edit mode with pre-selected invoices, auto-add them to stops
    if ((data.isImport || data.isEditMode) && data.preSelectedInvoices?.length) {
      // For EDIT MODE: Add stops synchronously so stepper navigation works immediately
      if (data.isEditMode) {
        data.preSelectedInvoices!.forEach(invoice => {
          this.addStopSync(invoice);
        });
        // Update grouped stops synchronously
        this.updateGroupedStops();
      } else {
        // For import mode: use setTimeout to allow UI to render first
        setTimeout(() => {
          data.preSelectedInvoices!.forEach(invoice => {
            this.addStop(invoice);
          });
          // After adding all stops, trigger route calculation
          if (this.selectedStops.length > 0) {
            setTimeout(() => this.calculateDistance(), 500);
          }
        }, 100);
      }
    }
    
    // Setup address autocomplete debounce
    this.addressInputSubject.pipe(
      debounceTime(300),
      distinctUntilChanged((prev, curr) => prev.query === curr.query)
    ).subscribe(({group, query}) => {
      this.searchAddresses(query);
    });
    
    // Setup invoice search debounce for performance
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.invoiceSearch = searchTerm;
      this._cacheValid = false; // Invalidate cache when search changes
    });
    
    // Pre-filter invoices to only pending ones (performance optimization)
    this._pendingInvoices = (data.invoices || []).filter((inv: any) => inv.status === 'Pending');
  }
  
  // Pre-filtered pending invoices (computed once)
  private _pendingInvoices: any[] = [];

  ngAfterViewInit(): void {
    // Map will be initialized when step 2 is active
  }

  onStepChange(event: any): void {
    // When step 2 (Route & Schedule) becomes active, initialize the map
    if (event.selectedIndex === 1) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        this.initializeMap();
      }, 300);
    }
  }
  
  // Auto-save draft removed - was causing duplicate tripsheet creation due to race conditions
  
  // Handle dialog close - just close without creating draft loads
  onCloseDialog(): void {
    if (this.selectedStops.length > 0 && !this.data.isEditMode) {
      const confirmClose = confirm(
        'You have stops selected that haven\'t been saved as a tripsheet yet.\n\n' +
        'Click OK to close and discard, or Cancel to go back.'
      );
      if (!confirmClose) return;
    }
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    // Cleanup search subscription
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
    }
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
    }
    this.stopMarkers.forEach(m => m.setMap(null));
  }

  // Initialize province data for all invoices based on customer addresses
  private initializeProvinceData(): void {
    this.loadingProvinces = true;
    
    const invoicesToGeocode: any[] = [];
    
    // First pass: try to match using keywords from address data and customer name
    this.data.invoices.forEach(invoice => {
      // Find customer by customerCode or name
      const customer = this.data.customers?.find(c => 
        c.customerCode === invoice.customerNumber || 
        c.name === invoice.customerName ||
        c.shortName === invoice.customerName
      );
      
      const cacheKey = invoice.customerNumber || invoice.customerName;
      
      // Check cache first
      if (this.customerProvinceCache.has(cacheKey)) {
        const cached = this.customerProvinceCache.get(cacheKey)!;
        invoice.province = cached.province;
        invoice.city = cached.city;
        return;
      }
      
      // Build address string from multiple sources
      let addressParts: string[] = [];
      
      // Add customer name (often contains location like "DURBAN HOSPITAL")
      if (invoice.customerName) addressParts.push(invoice.customerName);
      
      if (customer) {
        // Use addressLines array if available
        if (customer.addressLines && Array.isArray(customer.addressLines)) {
          addressParts = [...addressParts, ...customer.addressLines];
        }
        
        // Also add other address fields
        if (customer.physicalAddress) addressParts.push(customer.physicalAddress);
        if (customer.deliveryAddress) addressParts.push(customer.deliveryAddress);
        if (customer.deliveryCity) addressParts.push(customer.deliveryCity);
        if (customer.city) addressParts.push(customer.city);
        if (customer.province) addressParts.push(customer.province);
        if (customer.deliveryProvince) addressParts.push(customer.deliveryProvince);
        if (customer.name) addressParts.push(customer.name);
      }
      
      const fullAddress = addressParts.join(' ').toLowerCase();
      const provinceData = this.detectProvinceFromAddress(fullAddress);
      
      if (provinceData.province) {
        invoice.province = provinceData.province;
        invoice.city = provinceData.city || (customer?.deliveryCity) || (customer?.city) || '';
        
        // Cache the result
        this.customerProvinceCache.set(cacheKey, { 
          province: provinceData.province, 
          city: invoice.city 
        });
      } else {
        // Queue for geocoding
        invoicesToGeocode.push(invoice);
      }
    });
    
    // Second pass: Skip geocoding - keyword matching is sufficient and instant
    // Google Maps geocoding was causing severe lag on large invoice sets
    // Unmatched invoices will show under "All Provinces" filter
    if (invoicesToGeocode.length > 0) {
      // Province detection: keyword-matched invoices vs unmatched (geocoding disabled for performance)
    }
    this.loadingProvinces = false;
  }
  
  // Geocode invoices using Google Maps API
  private async geocodeInvoices(invoices: any[]): Promise<void> {
    const geocodeUrl = 'https://maps.googleapis.com/maps/api/geocode/json';
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < invoices.length; i += batchSize) {
      const batch = invoices.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (invoice) => {
        const cacheKey = invoice.customerNumber || invoice.customerName;
        
        // Skip if already cached
        if (this.customerProvinceCache.has(cacheKey)) {
          const cached = this.customerProvinceCache.get(cacheKey)!;
          invoice.province = cached.province;
          invoice.city = cached.city;
          invoice.latitude = cached.latitude;
          invoice.longitude = cached.longitude;
          invoice.formattedAddress = cached.formattedAddress;
          return;
        }
        
        // Build search query
        const customer = this.data.customers?.find(c => 
          c.customerCode === invoice.customerNumber || 
          c.name === invoice.customerName
        );
        
        // Prefer the address actually parsed/entered on the invoice/stop (imported rows),
        // then a matched customer's saved address, and only fall back to the customer name.
        const ownAddress = (invoice.deliveryAddress || invoice.address || '').trim();
        let searchQuery: string;
        if (ownAddress) {
          const parts = [ownAddress, invoice.city, invoice.province].filter(Boolean).join(', ');
          searchQuery = parts + ', South Africa';
        } else if (customer?.addressLines?.length) {
          searchQuery = customer.addressLines.join(', ') + ', South Africa';
        } else if ((invoice.customerName || '').trim() && invoice.customerName !== 'Unknown Customer') {
          searchQuery = invoice.customerName + ' South Africa';
        } else {
          // Nothing to geocode reliably — skip so we don't drop a pin on the country centroid
          return;
        }
        
        try {
          const response = await fetch(
            `${geocodeUrl}?address=${encodeURIComponent(searchQuery)}&key=${this.googleMapsApiKey}&components=country:ZA`
          );
          const data = await response.json();
          
          if (data.status === 'OK' && data.results?.length > 0) {
            const result = data.results[0];
            const addressComponents = result.address_components || [];

            // Reject coarse matches (country/province centroid or APPROXIMATE precision):
            // these are NOT real delivery points and must not be shown as "located".
            const topTypes: string[] = result.types || [];
            const locationType: string = result.geometry?.location_type || '';
            const coarseOnly = topTypes.length > 0 && topTypes.every((t: string) =>
              ['country', 'administrative_area_level_1', 'administrative_area_level_2', 'political'].includes(t));
            const isApproximate = locationType === 'APPROXIMATE' || coarseOnly ||
              /^south africa$/i.test((result.formatted_address || '').trim());
            if (isApproximate) {
              // Leave invoice without coordinates so the UI flags it as needing an address.
              invoice.addressApproximate = true;
              return;
            }
            
            // Extract coordinates from geocoding result
            const location = result.geometry?.location;
            if (location) {
              invoice.latitude = location.lat;
              invoice.longitude = location.lng;
              invoice.formattedAddress = result.formatted_address;
              invoice.addressApproximate = false;
            }
            
            // Find province from address components
            const provinceComponent = addressComponents.find((c: any) => 
              c.types.includes('administrative_area_level_1')
            );
            const cityComponent = addressComponents.find((c: any) => 
              c.types.includes('locality') || c.types.includes('sublocality')
            );
            
            if (provinceComponent) {
              const provinceName = provinceComponent.long_name.toLowerCase();
              const provinceCode = this.getProvinceCodeFromName(provinceName);
              
              if (provinceCode) {
                invoice.province = provinceCode;
                invoice.city = cityComponent?.long_name || '';
                
                // Cache the result with coordinates
                this.customerProvinceCache.set(cacheKey, {
                  province: provinceCode,
                  city: invoice.city,
                  latitude: invoice.latitude,
                  longitude: invoice.longitude,
                  formattedAddress: invoice.formattedAddress
                });
              }
            }
          }
        } catch (error) {
          console.warn('Geocoding failed for:', searchQuery, error);
        }
      }));
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < invoices.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    this.loadingProvinces = false;
  }
  
  // Get province code from province name
  private getProvinceCodeFromName(provinceName: string): string {
    const lower = provinceName.toLowerCase();
    const mapping: { [key: string]: string } = {
      'gauteng': 'GP',
      'kwazulu-natal': 'KZN',
      'kwazulu natal': 'KZN',
      'kwa-zulu natal': 'KZN',
      'western cape': 'WC',
      'eastern cape': 'EC',
      'mpumalanga': 'MP',
      'limpopo': 'LP',
      'free state': 'FS',
      'north west': 'NW',
      'north-west': 'NW',
      'northern cape': 'NC'
    };
    
    for (const [name, code] of Object.entries(mapping)) {
      if (lower.includes(name)) {
        return code;
      }
    }
    return '';
  }

  // Detect province from address using keyword matching
  private detectProvinceFromAddress(address: string): { province: string, city: string } {
    const lowerAddress = address.toLowerCase();
    
    // Check each province's keywords
    for (const [provinceCode, keywords] of Object.entries(this.provinceKeywords)) {
      for (const keyword of keywords) {
        if (lowerAddress.includes(keyword)) {
          // Try to extract city from the matched keyword
          const city = this.capitalizeWords(keyword);
          return { province: provinceCode, city };
        }
      }
    }
    
    return { province: '', city: '' };
  }

  private capitalizeWords(str: string): string {
    return str.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  // Get province name from code
  getProvinceName(code: string): string {
    const province = this.provinces.find(p => p.code === code);
    return province?.name || code;
  }

  // Get count of invoices for a province (cached for performance)
  private _provinceCountCache: Map<string, number> = new Map();
  private _provinceCountCacheValid = false;
  
  getProvinceInvoiceCount(provinceCode: string): number {
    if (!this._provinceCountCacheValid) {
      this._provinceCountCache.clear();
      for (const inv of this._pendingInvoices) {
        if (!this.selectedStopIds.has(inv.id) && inv.province) {
          const count = this._provinceCountCache.get(inv.province) || 0;
          this._provinceCountCache.set(inv.province, count + 1);
        }
      }
      this._provinceCountCacheValid = true;
    }
    return this._provinceCountCache.get(provinceCode) || 0;
  }

  // Handle province selection change
  onProvinceChange(): void {
    this.invoiceSearch = ''; // Clear search when province changes
    this._cacheValid = false; // Invalidate filtered cache
  }
  
  // Debounced search handler - call this from template
  onSearchInput(value: string): void {
    this.searchSubject.next(value);
  }

  // Optimized filtered invoices with caching and limit for virtual scroll
  filteredInvoices(): any[] {
    // Check if cache is still valid
    if (this._cacheValid && 
        this._lastSearchTerm === this.invoiceSearch && 
        this._lastProvince === this.selectedProvince) {
      return this._cachedFilteredInvoices;
    }
    
    // Use pre-filtered pending invoices and Set for O(1) lookup
    let invoices = this._pendingInvoices.filter(inv => !this.selectedStopIds.has(inv.id));
    
    // Filter by province
    if (this.selectedProvince !== 'all') {
      invoices = invoices.filter(inv => inv.province === this.selectedProvince);
    }
    
    // Filter by search term
    if (this.invoiceSearch) {
      const search = this.invoiceSearch.toLowerCase();
      invoices = invoices.filter(inv =>
        inv.transactionNumber?.toLowerCase().includes(search) ||
        inv.customerName?.toLowerCase().includes(search) ||
        inv.productDescription?.toLowerCase().includes(search) ||
        inv.city?.toLowerCase().includes(search)
      );
    }
    
    // Cache the results
    this._cachedFilteredInvoices = invoices;
    this._lastSearchTerm = this.invoiceSearch;
    this._lastProvince = this.selectedProvince;
    this._cacheValid = true;
    
    return invoices;
  }
  
  // Get limited invoices for virtual scrolling display (max 100 visible at a time)
  get displayedInvoices(): any[] {
    return this.filteredInvoices().slice(0, 200);
  }
  
  // Total count for display
  get totalFilteredCount(): number {
    return this.filteredInvoices().length;
  }

  // O(1) lookup using Set
  isInvoiceSelected(invoice: any): boolean {
    return this.selectedStopIds.has(invoice.id);
  }

  toggleInvoiceSelection(invoice: any): void {
    if (this.isInvoiceSelected(invoice)) {
      this.removeStopByInvoice(invoice);
    } else {
      this.addStop(invoice);
    }
  }

  addStop(invoice: any): void {
    // Find customer details for address
    const customer = this.data.customers?.find(c => 
      c.accountNumber === invoice.customerNumber || c.name === invoice.customerName
    );
    
    // Use coordinates from invoice (geocoded) or customer record
    const latitude = invoice.latitude || customer?.latitude;
    const longitude = invoice.longitude || customer?.longitude;
    // Use empty string if no address found - placeholder will guide user
    const address = invoice.formattedAddress || customer?.physicalAddress || customer?.deliveryAddress || '';
    
    this.selectedStops.push({
      ...invoice,
      address: address,
      deliveryAddress: address,
      latitude: latitude,
      longitude: longitude
    });
    
    // Update Set for O(1) lookup
    this.selectedStopIds.add(invoice.id);
    this._cacheValid = false; // Invalidate filtered cache
    this._provinceCountCacheValid = false; // Invalidate province counts
    
    this.calculateTotalValue();
    this.updateGroupedStops();
    
    // Update the map if already initialized
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  // Synchronous version of addStop for edit mode initialization (no map updates)
  addStopSync(invoice: any): void {
    // Find customer details for address
    const customer = this.data.customers?.find(c => 
      c.accountNumber === invoice.customerNumber || c.name === invoice.customerName
    );
    
    // Use coordinates from invoice (geocoded) or customer record
    const latitude = invoice.latitude || customer?.latitude;
    const longitude = invoice.longitude || customer?.longitude;
    // Use empty string if no address found
    const address = invoice.formattedAddress || invoice.address || invoice.deliveryAddress || customer?.physicalAddress || customer?.deliveryAddress || '';
    
    this.selectedStops.push({
      ...invoice,
      address: address,
      deliveryAddress: address,
      latitude: latitude,
      longitude: longitude
    });
    
    // Update Set for O(1) lookup
    this.selectedStopIds.add(invoice.id);
    
    this.calculateTotalValue();
    // Note: No updateGroupedStops or map updates here - done after all stops added
  }

  // Toggle part delivery flag for an invoice
  togglePartDelivery(invoiceId: number, checked: boolean): void {
    if (checked) {
      this.partDeliveryMap.set(invoiceId, true);
    } else {
      this.partDeliveryMap.delete(invoiceId);
    }
  }

  // Add stop with part delivery tracking
  addStopWithPartDelivery(invoice: any): void {
    if (this.isInvoiceSelected(invoice)) {
      // Already selected, remove it
      this.removeStopByInvoice(invoice);
      return;
    }
    
    // Find customer details for address
    const customer = this.data.customers?.find(c => 
      c.accountNumber === invoice.customerNumber || c.name === invoice.customerName
    );
    
    // Use coordinates from invoice (geocoded) or customer record
    const latitude = invoice.latitude || customer?.latitude;
    const longitude = invoice.longitude || customer?.longitude;
    // Use empty string if no address found - placeholder will guide user
    const address = invoice.formattedAddress || customer?.physicalAddress || customer?.deliveryAddress || '';
    
    // Check if part delivery is marked for this invoice
    const isPartDelivery = this.partDeliveryMap.get(invoice.id) || false;
    const originalQuantity = invoice.quantity || 1;
    
    this.selectedStops.push({
      ...invoice,
      address: address,
      deliveryAddress: address,
      latitude: latitude,
      longitude: longitude,
      isPartDelivery: isPartDelivery,
      originalQuantity: originalQuantity,
      partialQuantity: isPartDelivery ? Math.ceil(originalQuantity / 2) : originalQuantity // Default to half for part delivery
    });
    
    this.calculateTotalValue();
    this.updateGroupedStops();
    
    // Update the map if already initialized
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  // Handle partial quantity change for part deliveries
  onPartialQuantityChange(stop: any): void {
    if (stop.partialQuantity < 1) {
      stop.partialQuantity = 1;
    }
    if (stop.partialQuantity > stop.originalQuantity) {
      stop.partialQuantity = stop.originalQuantity;
    }
    // Recalculate value based on partial quantity if needed
    if (stop.isPartDelivery && stop.originalQuantity > 0) {
      const unitPrice = stop.salesAmount / stop.originalQuantity;
      stop.partialSalesAmount = unitPrice * stop.partialQuantity;
    }
  }

  removeStop(index: number): void {
    const removed = this.selectedStops[index];
    this.selectedStops.splice(index, 1);
    
    // Update Set for O(1) lookup
    if (removed?.id) {
      this.selectedStopIds.delete(removed.id);
    }
    this._cacheValid = false; // Invalidate filtered cache
    this._provinceCountCacheValid = false; // Invalidate province counts
    
    this.calculateTotalValue();
    this.updateGroupedStops();
    
    // Update the map if already initialized
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  removeStopByInvoice(invoice: any): void {
    const index = this.selectedStops.findIndex(s => s.id === invoice.id);
    if (index > -1) {
      this.removeStop(index);
    }
  }

  clearAllStops(): void {
    this.selectedStops = [];
    this.selectedStopIds.clear(); // Clear the Set
    this._cacheValid = false; // Invalidate filtered cache
    this._provinceCountCacheValid = false; // Invalidate province counts
    this.groupedStops = [];
    this.totalDistance = 0;
    this.estimatedTime = '';
    this.returnDistance = 0;
    this.returnTime = '';
    this.totalValue = 0;
    
    // Update the map if already initialized
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  // Open Add Delivery Note dialog
  openAddDeliveryNoteDialog(): void {
    const dialogRef = this.dialog.open(AddDeliveryNoteDialog, {
      width: '520px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // Add the delivery note as a stop
        this.selectedStops.push(result);
        this.selectedStopIds.add(result.id); // Update Set
        this._cacheValid = false;
        this._provinceCountCacheValid = false;
        this.calculateTotalValue();
        this.updateGroupedStops();
        
        // Update the map if already initialized
        if (this.mapInitialized) {
          this.updateRouteMap();
        }
      }
    });
  }

  // Group stops by customer name (same customer = same delivery location)
  updateGroupedStops(): void {
    const groups = new Map<string, any>();
    
    this.selectedStops.forEach(stop => {
      const key = stop.customerName || stop.customerNumber;
      
      if (groups.has(key)) {
        const group = groups.get(key);
        group.invoices.push(stop);
        group.totalValue += stop.salesAmount || stop.totalAmount || 0;
      } else {
        // Resolve a usable delivery address. If the imported/parsed row has no real
        // address (blank, "Unknown", or just "South Africa"), pull it straight from
        // the customer database so routing has a proper street address to work with.
        let addr = (stop.deliveryAddress || stop.address || '').trim();
        let lat = stop.latitude;
        let lng = stop.longitude;
        let city = stop.city;
        let province = stop.province;
        if (this.isBlankAddress(addr)) {
          const resolved = this.resolveAddressFromCustomer(stop);
          if (resolved) {
            addr = resolved.address || addr;
            city = city || resolved.city;
            province = province || resolved.province;
            if ((!lat || !lng) && resolved.latitude && resolved.longitude) {
              lat = resolved.latitude;
              lng = resolved.longitude;
            }
            // Propagate back onto the stop so save/geocode use the resolved address too
            stop.deliveryAddress = addr;
            stop.address = addr;
            stop.city = city;
            stop.province = province;
            if (resolved.latitude && resolved.longitude) {
              stop.latitude = lat;
              stop.longitude = lng;
            }
            stop.addressFromCustomerDb = true;
          }
        }

        groups.set(key, {
          customerName: stop.customerName,
          customerNumber: stop.customerNumber,
          deliveryAddress: this.isBlankAddress(addr) ? '' : addr,
          latitude: lat,
          longitude: lng,
          city: city,
          province: province,
          addressFromCustomerDb: stop.addressFromCustomerDb || false,
          invoices: [stop],
          totalValue: stop.salesAmount || stop.totalAmount || 0,
          isCollapsed: !!(lat && lng && !this.isBlankAddress(addr)) // Auto-collapse only when address is real
        });
      }
    });
    
    this.groupedStops = Array.from(groups.values());
    // Load saved addresses for the customers in the grouped stops
    if (this.groupedStops.length > 0) {
      this.loadSavedAddressesForCustomers();
    }
  }

  /** True when an address string is empty or just a country/placeholder (not a real delivery point). */
  isBlankAddress(addr: string | null | undefined): boolean {
    const a = (addr || '').toString().trim();
    if (!a) return true;
    if (/^south africa$/i.test(a)) return true;
    if (/^(unknown|n\/?a|none|-)$/i.test(a)) return true;
    return false;
  }

  /** Find the matching customer in the loaded customer database for a stop. */
  private findCustomerForStop(stop: any): any {
    const customers = this.data.customers || [];
    if (!customers.length) return null;
    const num = (stop.customerNumber || '').toString().trim().toLowerCase();
    const name = (stop.customerName || '').toString().trim().toLowerCase();

    if (num) {
      const byCode = customers.find((c: any) =>
        (c.customerCode || '').toString().trim().toLowerCase() === num);
      if (byCode) return byCode;
    }
    if (name) {
      const byName = customers.find((c: any) =>
        (c.name || '').toString().trim().toLowerCase() === name);
      if (byName) return byName;
      // Fuzzy contains match as a fallback
      const fuzzy = customers.find((c: any) => {
        const cn = (c.name || '').toString().trim().toLowerCase();
        return cn && (cn.includes(name) || name.includes(cn));
      });
      if (fuzzy) return fuzzy;
    }
    return null;
  }

  /** Pull a usable delivery address (and coords) for a stop from the customer database. */
  private resolveAddressFromCustomer(stop: any): { address: string; city?: string; province?: string; latitude?: number; longitude?: number } | null {
    const c = this.findCustomerForStop(stop);
    if (!c) return null;

    const candidates = [
      c.deliveryAddress,
      c.physicalAddress,
      c.address,
      (c.addressLines && c.addressLines.length ? c.addressLines.join(', ') : '')
    ];
    const address = (candidates.find((a: string) => !this.isBlankAddress(a)) || '').toString().trim();

    // If the customer already has coordinates we can use them even if the text is thin
    const hasCoords = !!(c.latitude && c.longitude);
    if (this.isBlankAddress(address) && !hasCoords) return null;

    return {
      address,
      city: c.deliveryCity || c.city,
      province: c.deliveryProvince || c.province,
      latitude: c.latitude,
      longitude: c.longitude
    };
  }

  /**
   * Fill any missing delivery addresses from the customer database, then geocode
   * whatever was resolved. This is the explicit "Match from Customer DB" action.
   */
  async matchAddressesFromDatabase(): Promise<void> {
    const before = this.groupedStops.filter(g => this.isBlankAddress(g.deliveryAddress)).length;

    if (!(this.data.customers && this.data.customers.length)) {
      this.snackBar.open('Customer database is still loading — please try again in a moment.', 'Close', { duration: 3500 });
      return;
    }

    // Re-run grouping which now resolves addresses (and coords) from the customer DB
    this.updateGroupedStops();

    const after = this.groupedStops.filter(g => this.isBlankAddress(g.deliveryAddress)).length;
    const matched = Math.max(0, before - after);

    if (matched > 0) {
      this.snackBar.open(`Matched ${matched} address${matched === 1 ? '' : 'es'} from the customer database.`, 'Close', { duration: 3500 });
      // Geocode the newly-filled stops that still need coordinates
      await this.geocodeAllStops();
    } else if (after > 0) {
      this.snackBar.open(`${after} stop${after === 1 ? '' : 's'} could not be matched — no address on file. Please enter them manually.`, 'Close', { duration: 5000 });
    } else {
      this.snackBar.open('All stops already have a delivery address.', 'Close', { duration: 3000 });
    }
    this.updateRouteMap();
  }

  // Toggle collapse state of a stop
  toggleStopCollapse(group: any): void {
    // Only allow collapse if it has coordinates
    if (group.latitude && group.longitude) {
      group.isCollapsed = !group.isCollapsed;
    }
  }

  dropStop(event: CdkDragDrop<any[]>): void {
    moveItemInArray(this.selectedStops, event.previousIndex, event.currentIndex);
  }

  /** Reorder the grouped delivery stops via drag & drop (Google-style itinerary). */
  dropGroupedStop(event: CdkDragDrop<any[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    moveItemInArray(this.groupedStops, event.previousIndex, event.currentIndex);
    // Refresh the map so marker numbers follow the new stop order.
    this.updateRouteMap();
  }

  calculateTotalValue(): void {
    this.totalValue = this.selectedStops.reduce((sum, stop) => sum + (stop.salesAmount || 0), 0);
  }

  optimizeRoute(): void {
    if (this.selectedStops.length < 2) return;
    
    this.optimizing = true;
    
    // Get stops with coordinates
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    
    if (stopsWithCoords.length < 2) {
      // Fallback to simple sort if no coordinates
      this.selectedStops.sort((a, b) => a.customerName.localeCompare(b.customerName));
      this.optimizing = false;
      return;
    }
    
    // Use Google Routes API via backend for optimal route
    const origin = {
      latitude: this.selectedWarehouse?.latitude || -29.8587, // Default to Durban
      longitude: this.selectedWarehouse?.longitude || 31.0218,
      label: this.selectedWarehouse?.name || 'Warehouse'
    };
    
    const waypoints = this.selectedStops
      .filter(s => s.latitude && s.longitude)
      .map(s => ({
        latitude: s.latitude,
        longitude: s.longitude,
        label: s.customerName,
        referenceId: s.id
      }));
    
    // Use the last stop as destination, rest as waypoints
    const destination = waypoints.pop();
    
    const routeRequest = {
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      optimizeWaypoints: true,
      departureTime: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/calculate-route`, routeRequest).subscribe({
      next: (result) => {
        if (result.success && result.optimizedWaypointOrder) {
          // Reorder stops based on optimized order
          const optimizedStops: any[] = [];
          const originalStops = [...this.selectedStops.filter(s => s.latitude && s.longitude)];
          const stopsWithoutCoords = this.selectedStops.filter(s => !s.latitude || !s.longitude);
          
          // Build optimized order: first the waypoints, then the destination
          result.optimizedWaypointOrder.forEach((index: number) => {
            if (index < originalStops.length - 1) {
              optimizedStops.push(originalStops[index]);
            }
          });
          // Add the destination (last stop)
          optimizedStops.push(originalStops[originalStops.length - 1]);
          
          // Add any stops without coordinates at the end
          optimizedStops.push(...stopsWithoutCoords);
          
          this.selectedStops = optimizedStops;
          
          // Update distance and time from API response + offload time
          this.totalDistance = Math.round(result.distanceMeters / 1000);
          const driveTimeMins = Math.round(result.durationSeconds / 60);
          const offloadMins = this.getUniqueCustomerOffloadTime();
          const totalMins = driveTimeMins + offloadMins;
          const hours = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          this.estimatedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          
          // Update map
          this.updateRouteMap();
        } else {
          // Fallback to local nearest neighbor algorithm
          this.optimizeRouteLocally();
        }
        this.optimizing = false;
      },
      error: (err) => {
        console.warn('Google Routes API failed, using local optimization:', err);
        this.optimizeRouteLocally();
        this.optimizing = false;
      }
    });
  }
  
  // Fallback local optimization using nearest neighbor
  private optimizeRouteLocally(): void {
    const start = this.selectedWarehouse;
    const startLat = start?.latitude || -29.8587;
    const startLng = start?.longitude || 31.0218;
    
    const optimized: any[] = [];
    const remaining = [...this.selectedStops];
    
    let currentLat = startLat;
    let currentLng = startLng;
    
    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;
      
      remaining.forEach((stop, index) => {
        if (stop.latitude && stop.longitude) {
          const dist = this.haversineDistance(currentLat, currentLng, stop.latitude, stop.longitude);
          if (dist < nearestDistance) {
            nearestDistance = dist;
            nearestIndex = index;
          }
        }
      });
      
      const nearest = remaining.splice(nearestIndex, 1)[0];
      optimized.push(nearest);
      
      if (nearest.latitude && nearest.longitude) {
        currentLat = nearest.latitude;
        currentLng = nearest.longitude;
      }
    }
    
    this.selectedStops = optimized;
    this.calculateDistanceLocally();
  }

  calculateDistance(): void {
    this.calculating = true;
    
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    
    if (stopsWithCoords.length < 1) {
      this.calculating = false;
      return;
    }
    
    // Use Google Routes API for accurate distance
    const origin = {
      latitude: this.selectedWarehouse?.latitude || -29.8587,
      longitude: this.selectedWarehouse?.longitude || 31.0218,
      label: this.selectedWarehouse?.name || 'Warehouse'
    };
    
    const waypoints = stopsWithCoords.slice(0, -1).map(s => ({
      latitude: s.latitude,
      longitude: s.longitude,
      label: s.customerName
    }));
    
    const lastStop = stopsWithCoords[stopsWithCoords.length - 1];
    const destination = {
      latitude: lastStop.latitude,
      longitude: lastStop.longitude,
      label: lastStop.customerName
    };
    
    const routeRequest = {
      origin: origin,
      destination: destination,
      waypoints: waypoints,
      optimizeWaypoints: false, // Keep current order
      departureTime: new Date(Date.now() + 3600000).toISOString()
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/calculate-route`, routeRequest).subscribe({
      next: (result) => {
        if (result.success) {
          this.totalDistance = Math.round(result.distanceMeters / 1000);
          
          // Calculate return trip from last stop back to warehouse
          this.calculateReturnTrip(lastStop, origin);
          
          // Add offload time: 1 hour per unique customer (not per stop)
          const driveTimeSeconds = result.durationSeconds;
          const offloadMinutes = this.getUniqueCustomerOffloadTime();
          const totalSeconds = driveTimeSeconds + (offloadMinutes * 60);
          
          const totalMins = Math.round(totalSeconds / 60);
          const hours = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          this.estimatedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        } else {
          // Fallback to local calculation
          this.calculateDistanceLocally();
        }
        this.calculating = false;
        this.updateRouteMap();
      },
      error: (err) => {
        console.warn('Google Routes API failed, using local calculation:', err);
        this.calculateDistanceLocally();
        this.calculating = false;
      }
    });
  }
  
  // Calculate return trip from last stop back to warehouse
  private calculateReturnTrip(lastStop: any, warehouse: any): void {
    if (!lastStop?.latitude || !warehouse?.latitude) {
      this.returnDistance = 0;
      this.returnTime = '0m';
      return;
    }
    
    const returnRequest = {
      origin: { latitude: lastStop.latitude, longitude: lastStop.longitude, label: lastStop.customerName || 'Last Stop' },
      destination: { latitude: warehouse.latitude, longitude: warehouse.longitude, label: warehouse.label || 'Warehouse' },
      waypoints: [],
      optimizeWaypoints: false,
      departureTime: new Date(Date.now() + 3600000).toISOString()
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/calculate-route`, returnRequest).subscribe({
      next: (result) => {
        if (result.success) {
          this.returnDistance = Math.round(result.distanceMeters / 1000);
          const returnMins = Math.round(result.durationSeconds / 60);
          const hours = Math.floor(returnMins / 60);
          const mins = returnMins % 60;
          this.returnTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        } else {
          // Fallback to haversine
          const dist = this.haversineDistance(lastStop.latitude, lastStop.longitude, warehouse.latitude, warehouse.longitude);
          this.returnDistance = Math.round(dist * 1.25);
          const returnMins = Math.round((this.returnDistance / 55) * 60);
          const hours = Math.floor(returnMins / 60);
          const mins = returnMins % 60;
          this.returnTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        }
      },
      error: () => {
        // Fallback to haversine
        const dist = this.haversineDistance(lastStop.latitude, lastStop.longitude, warehouse.latitude, warehouse.longitude);
        this.returnDistance = Math.round(dist * 1.25);
        const returnMins = Math.round((this.returnDistance / 55) * 60);
        const hours = Math.floor(returnMins / 60);
        const mins = returnMins % 60;
        this.returnTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
      }
    });
  }
  
  // Fallback local distance calculation
  private calculateDistanceLocally(): void {
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    
    if (stopsWithCoords.length < 1) return;
    
    // Start from warehouse
    const startLat = this.selectedWarehouse?.latitude || -29.8587;
    const startLng = this.selectedWarehouse?.longitude || 31.0218;
    
    let totalDist = 0;
    let prevLat = startLat;
    let prevLng = startLng;
    
    stopsWithCoords.forEach(stop => {
      totalDist += this.haversineDistance(prevLat, prevLng, stop.latitude, stop.longitude);
      prevLat = stop.latitude;
      prevLng = stop.longitude;
    });
    
    // Add 25% for road vs straight line (more realistic)
    this.totalDistance = Math.round(totalDist * 1.25);
    
    // Calculate return distance from last stop back to warehouse
    const lastStopWithCoords = stopsWithCoords[stopsWithCoords.length - 1];
    if (lastStopWithCoords) {
      const returnDist = this.haversineDistance(lastStopWithCoords.latitude, lastStopWithCoords.longitude, startLat, startLng);
      this.returnDistance = Math.round(returnDist * 1.25);
      // Return time at 55km/h average
      const returnMinutes = Math.round((this.returnDistance / 55) * 60);
      const returnHours = Math.floor(returnMinutes / 60);
      const returnMins = returnMinutes % 60;
      this.returnTime = returnHours > 0 ? `${returnHours}h ${returnMins}m` : `${returnMins}m`;
    } else {
      this.returnDistance = 0;
      this.returnTime = '0m';
    }
    
    // Estimate time: 55km/h average (accounting for traffic) + 1 hour per unique customer for offloading
    const driveTimeMinutes = (this.totalDistance / 55) * 60;
    const offloadMinutes = this.getUniqueCustomerOffloadTime();
    const totalMinutes = Math.round(driveTimeMinutes + offloadMinutes);
    
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    this.estimatedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    this.updateRouteMap();
  }

  // Calculate offload time: 1 hour per unique customer (not per stop)
  private getUniqueCustomerOffloadTime(): number {
    const uniqueCustomers = new Set<string>();
    this.selectedStops.forEach(stop => {
      const customerName = (stop.customerName || stop.companyName || '').toLowerCase().trim();
      if (customerName) {
        uniqueCustomers.add(customerName);
      }
    });
    // 60 minutes per unique customer
    return uniqueCustomers.size * 60;
  }

  // Advanced route optimization using Google Route Optimization API
  advancedOptimization(): void {
    if (this.selectedStops.length < 2) {
      this.optimizationMessage = 'Need at least 2 stops to optimize';
      this.optimizationSuccess = false;
      return;
    }
    
    this.advancedOptimizing = true;
    this.optimizationMessage = 'Running Google AI route optimization...';
    this.optimizationSuccess = false;
    
    // Build list of invoice IDs for optimization
    const invoiceIds = this.selectedStops.map(s => s.invoiceId || s.id);
    
    // Get departure time (scheduled date + 8am)
    const departureDate = new Date(this.scheduledDate);
    departureDate.setHours(8, 0, 0, 0);
    
    const optimizationRequest = {
      invoiceIds: invoiceIds,
      depotLatitude: this.selectedWarehouse?.latitude || -29.8587,
      depotLongitude: this.selectedWarehouse?.longitude || 31.0218,
      departureTime: departureDate.toISOString(),
      vehicleCapacity: this.selectedVehicle?.capacity || 10000,
      maxDrivingHours: 10,
      serviceTimeMinutes: 15
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/optimize-invoices`, optimizationRequest).subscribe({
      next: (result) => {
        if (result.success) {
          // Reorder stops based on optimized sequence
          const optimizedStops: any[] = [];
          
          result.optimizedStops?.forEach((optStop: any) => {
            const matchingStop = this.selectedStops.find(s => 
              (s.invoiceId || s.id) === optStop.invoiceId ||
              s.customerName?.toLowerCase().includes(optStop.customerName?.toLowerCase()) ||
              optStop.customerName?.toLowerCase().includes(s.customerName?.toLowerCase())
            );
            if (matchingStop && !optimizedStops.includes(matchingStop)) {
              optimizedStops.push(matchingStop);
            }
          });
          
          // Add any stops that weren't in the optimization result
          this.selectedStops.forEach(s => {
            if (!optimizedStops.includes(s)) {
              optimizedStops.push(s);
            }
          });
          
          this.selectedStops = optimizedStops;
          
          // Update metrics + offload time
          this.totalDistance = Math.round(result.totalDistanceKm);
          
          const driveMins = Math.round((result.totalDurationMinutes || 0));
          const offloadMins = this.getUniqueCustomerOffloadTime();
          const totalMins = driveMins + offloadMins;
          const hours = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          this.estimatedTime = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          
          // Calculate fuel estimates
          this.fuelEstimate = Math.round((this.totalDistance / 100) * this.avgFuelConsumption);
          this.fuelCost = Math.round(this.fuelEstimate * this.fuelPricePerLiter);
          
          this.optimizationMessage = `✓ Route optimized: ${this.totalDistance}km, ${this.estimatedTime}, ~R${this.fuelCost} fuel`;
          this.optimizationSuccess = true;
          
          // Update map
          this.updateRouteMap();
        } else {
          this.optimizationMessage = 'Optimization failed: ' + (result.message || 'Unknown error');
          this.optimizationSuccess = false;
        }
        this.advancedOptimizing = false;
      },
      error: (err) => {
        console.error('Route optimization error:', err);
        this.optimizationMessage = 'Optimization failed: ' + (err.error?.message || err.message || 'API error');
        this.optimizationSuccess = false;
        this.advancedOptimizing = false;
      }
    });
  }

  // Calculate distance matrix between all stops using Google Distance Matrix API
  calculateDistanceMatrix(): void {
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    
    if (stopsWithCoords.length < 2) {
      this.optimizationMessage = 'Need at least 2 stops with coordinates for distance matrix';
      this.optimizationSuccess = false;
      return;
    }
    
    this.calculatingMatrix = true;
    this.optimizationMessage = 'Calculating distance matrix using Google API...';
    
    // Build origins and destinations (warehouse + all stops)
    const locations: any[] = [];
    
    // Add warehouse as first location
    const warehouseLoc = {
      latitude: this.selectedWarehouse?.latitude || -29.8587,
      longitude: this.selectedWarehouse?.longitude || 31.0218,
      label: this.selectedWarehouse?.name || 'Warehouse'
    };
    locations.push(warehouseLoc);
    
    // Add all stops
    stopsWithCoords.forEach(s => {
      locations.push({
        latitude: s.latitude,
        longitude: s.longitude,
        label: s.customerName?.substring(0, 20) || `Stop ${locations.length}`
      });
    });
    
    const matrixRequest = {
      origins: locations,
      destinations: locations
    };
    
    this.http.post<any>(`${this.data.apiUrl}/logistics/googlemaps/distance-matrix`, matrixRequest).subscribe({
      next: (result) => {
        if (result.success && result.rows) {
          // Build matrix data
          this.distanceMatrixLabels = locations.map(l => l.label);
          this.distanceMatrix = result.rows.map((row: any) => 
            row.elements.map((el: any) => ({
              distanceKm: Math.round(el.distanceMeters / 1000 * 10) / 10,
              durationMin: Math.round(el.durationSeconds / 60),
              durationText: this.formatDuration(el.durationSeconds)
            }))
          );
          
          this.showDistanceMatrix = true;
          this.optimizationMessage = `✓ Distance matrix calculated: ${locations.length}x${locations.length} (${locations.length * locations.length} routes)`;
          this.optimizationSuccess = true;
        } else {
          this.optimizationMessage = 'Matrix calculation failed: ' + (result.error || 'Unknown error');
          this.optimizationSuccess = false;
        }
        this.calculatingMatrix = false;
      },
      error: (err) => {
        console.error('Distance matrix error:', err);
        this.optimizationMessage = 'Matrix calculation failed: ' + (err.error?.message || err.message || 'API error');
        this.optimizationSuccess = false;
        this.calculatingMatrix = false;
      }
    });
  }
  
  private formatDuration(seconds: number): string {
    if (!seconds) return '-';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }
  
  toggleDistanceMatrix(): void {
    this.showDistanceMatrix = !this.showDistanceMatrix;
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  private initializeMap(): void {
    const mapElement = document.getElementById('tripsheetRouteMap');
    if (!mapElement || this.mapInitialized) return;

    const apiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
    
    if (typeof google !== 'undefined' && google.maps) {
      this.createMap(mapElement);
      // Initialize autocomplete service if Places is loaded
      if ((google.maps as any).places) {
        this.autocompleteService = new (google.maps as any).places.AutocompleteService();
      }
      return;
    }

    const callbackName = 'initTripsheetMap' + Date.now();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    
    (window as any)[callbackName] = () => {
      this.createMap(mapElement);
      // Initialize autocomplete service
      if ((google.maps as any).places) {
        this.autocompleteService = new (google.maps as any).places.AutocompleteService();
      }
      delete (window as any)[callbackName];
    };
    
    document.head.appendChild(script);
  }

  private createMap(element: HTMLElement): void {
    this.map = new google.maps.Map(element, {
      zoom: 6,
      center: { lat: -28.5, lng: 25.5 },
      mapTypeId: 'roadmap',
      mapTypeControl: true,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scaleControl: true
    } as any);
    this.mapInitialized = true;
    this.updateRouteMap();
  }

  updateRouteMap(): void {
    setTimeout(() => this.initializeMap(), 100);
    
    if (!this.map) {
      return;
    }
    
    // Clear existing
    if (this.routePolyline) {
      this.routePolyline.setMap(null);
    }
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
    }
    this.stopMarkers.forEach(m => m.setMap(null));
    this.stopMarkers = [];
    
    const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
    // Always show warehouse marker even if no stops
    const bounds = new google.maps.LatLngBounds();
    
    // Add warehouse as start point
    const startLat = this.selectedWarehouse?.latitude || -25.6963;
    const startLng = this.selectedWarehouse?.longitude || 28.7023;
    const origin = { lat: startLat, lng: startLng };
    bounds.extend(origin);
    
    // Add warehouse marker
    const warehouseMarker = new google.maps.Marker({
      position: origin,
      map: this.map,
      title: this.selectedWarehouse?.name || 'Warehouse',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 12,
        fillColor: '#4caf50',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 2
      }
    });
    this.stopMarkers.push(warehouseMarker);
    
    // If no stops with coordinates, just show warehouse and return
    if (stopsWithCoords.length === 0) {
      this.map.setCenter({ lat: startLat, lng: startLng });
      this.map.setZoom(10);
      return;
    }
    
    // Add stop markers
    stopsWithCoords.forEach((stop, index) => {
      const pos = { lat: stop.latitude, lng: stop.longitude };
      bounds.extend(pos);
      
      const marker = new google.maps.Marker({
        position: pos,
        map: this.map,
        title: stop.customerName,
        label: {
          text: (index + 1).toString(),
          color: 'white',
          fontWeight: 'bold'
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: '#2563eb',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        }
      });
      this.stopMarkers.push(marker);
    });
    
    // Use Directions API to draw actual road route
    if (!this.directionsService) {
      this.directionsService = new (google.maps as any).DirectionsService();
    }
    if (!this.directionsRenderer) {
      this.directionsRenderer = new (google.maps as any).DirectionsRenderer({
        map: this.map,
        suppressMarkers: true, // We already have our own markers
        polylineOptions: {
          strokeColor: '#2563eb',
          strokeOpacity: 0.8,
          strokeWeight: 5
        }
      });
    } else {
      (this.directionsRenderer as any).setMap(this.map);
    }
    
    // Build waypoints (all stops except the last one which is the destination)
    const destination = stopsWithCoords[stopsWithCoords.length - 1];
    const waypoints = stopsWithCoords.slice(0, -1).map(stop => ({
      location: { lat: stop.latitude, lng: stop.longitude },
      stopover: true
    }));
    
    // Request directions using promise-based API
    (this.directionsService as any).route({
      origin: origin,
      destination: { lat: destination.latitude, lng: destination.longitude },
      waypoints: waypoints,
      travelMode: 'DRIVING',
      optimizeWaypoints: false // Keep user's order
    }).then((result: any) => {
      this.directionsRenderer?.setDirections(result);
    }).catch((error: any) => {
      console.warn('Directions API failed:', error, '- falling back to straight lines');
      // Fallback to straight line polyline if Directions API fails
      const path = [origin, ...stopsWithCoords.map(s => ({ lat: s.latitude, lng: s.longitude }))];
      this.routePolyline = new google.maps.Polyline({
        path: path,
        geodesic: true,
        strokeColor: '#2563eb',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: this.map
      });
    });
    
    this.map.fitBounds(bounds, 50);
  }

  // Check if stops have coordinates
  stopsHaveCoords(): boolean {
    if (this.groupedStops.length === 0) return false;
    return this.groupedStops.some(s => this.isStopResolved(s));
  }

  // Get count of stops with coordinates
  getStopsWithCoords(): number {
    return this.groupedStops.filter(s => this.isStopResolved(s)).length;
  }

  // A stop is only "green"/resolved when it has a real (non-blank) address AND
  // real coordinates that are not an approximate (country/area centroid) match.
  isStopResolved(group: any): boolean {
    if (!group) return false;
    if (this.isBlankAddress(group.deliveryAddress)) return false;
    if (group.addressApproximate) return false;
    return !!(group.latitude && group.longitude);
  }

  // Every delivery stop must be fully resolved before routing can continue.
  allStopsResolved(): boolean {
    return this.groupedStops.length > 0 && this.groupedStops.every(s => this.isStopResolved(s));
  }

  // Gate for leaving the Route Details step. Driver + vehicle are mandatory,
  // a valid scheduled date is required, and every stop must be resolved.
  canProceedToReview(): boolean {
    return !this.routeStepBlockReason();
  }

  // Returns a human-readable reason the routing step is blocked, or '' if OK.
  routeStepBlockReason(): string {
    if (!this.selectedWarehouse) return 'Select a pickup warehouse to continue.';
    if (!this.selectedDriver) return 'Assign a driver \u2014 a trip sheet cannot leave a driver unassigned.';
    if (!this.selectedVehicle) return 'Assign a vehicle \u2014 a trip sheet cannot leave a vehicle unassigned.';
    if (!this.isScheduledDateValid()) return 'Choose a valid scheduled date.';
    if (this.groupedStops.length === 0) return 'Add at least one delivery stop.';
    const unresolved = this.groupedStops.filter(s => !this.isStopResolved(s)).length;
    if (unresolved > 0) {
      return `${unresolved} stop${unresolved > 1 ? 's' : ''} still need a valid delivery address. Use "Match from Customer DB", pick a Google suggestion, or fix the address (shown in red).`;
    }
    return '';
  }

  // Validate the scheduled date is a real, parseable date.
  isScheduledDateValid(): boolean {
    const d = this.scheduledDate ? new Date(this.scheduledDate) : null;
    return !!(d && !isNaN(d.getTime()));
  }


  // Handle stop address change - NOT USED with autocomplete
  onStopAddressChanged(stop: any): void {
  }

  // Google Places Autocomplete - Input handler
  onAddressInput(group: any, event: any): void {
    const query = event.target.value;
    if (query && query.length > 2) {
      this.addressInputSubject.next({group, query});
    } else {
      this.addressPredictions = [];
    }
  }

  // Google Places Autocomplete - Focus handler
  onAddressFocus(group: any): void {
    if (group.deliveryAddress && group.deliveryAddress.length > 2) {
      this.searchAddresses(group.deliveryAddress);
    }
  }

  // Search addresses using Google Places Autocomplete
  searchAddresses(query: string): void {
    // Check if Places library is available
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
      console.warn('Google Places API not loaded yet. Loading now...');
      this.loadPlacesLibrary().then(() => {
        this.doSearchAddresses(query);
      });
      return;
    }

    if (!this.autocompleteService) {
      this.autocompleteService = new (google.maps.places as any).AutocompleteService();
    }

    this.doSearchAddresses(query);
  }

  // Load Google Places library if not available
  private loadPlacesLibrary(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        resolve();
        return;
      }

      const apiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';
      const callbackName = 'initPlacesLib' + Date.now();
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
      script.async = true;
      
      (window as any)[callbackName] = () => {
        this.autocompleteService = new (google.maps.places as any).AutocompleteService();
        delete (window as any)[callbackName];
        resolve();
      };
      
      document.head.appendChild(script);
    });
  }

  // Perform the actual address search
  private doSearchAddresses(query: string): void {
    if (!this.autocompleteService) {
      if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        this.autocompleteService = new (google.maps.places as any).AutocompleteService();
      } else {
        console.warn('Google Places API still not loaded');
        return;
      }
    }

    this.autocompleteService.getPlacePredictions({
      input: query,
      componentRestrictions: { country: 'za' }
      // No types restriction - includes addresses, establishments (hospitals, businesses), and other places
    }, (predictions: any, status: any) => {
      this.ngZone.run(() => {
        if (status === (google.maps.places as any).PlacesServiceStatus.OK && predictions) {
          this.addressPredictions = predictions;
        } else {
          this.addressPredictions = [];
        }
      });
    });
  }

  // Handle autocomplete selection
  onAddressSelected(group: any, event: any): void {
    const selectedAddress = event.option.value;
    group.deliveryAddress = selectedAddress;
    this.addressPredictions = [];
    
    // Update all invoices in this group with the new address
    group.invoices?.forEach((inv: any) => {
      inv.deliveryAddress = selectedAddress;
      inv.address = selectedAddress;
      // Also update in selectedStops
      const stop = this.selectedStops.find(s => s.id === inv.id);
      if (stop) {
        stop.deliveryAddress = selectedAddress;
        stop.address = selectedAddress;
      }
    });
    
    // Auto-geocode the selected address
    this.geocodeGroupAddress(group);
  }

  // Geocode a grouped stop's address
  geocodingAllStops = false;
  matchingAddresses = false;
  
  geocodeGroupAddress(group: any): void {
    if (!group.deliveryAddress) {
      console.warn('No address to geocode');
      return;
    }

    this.geocodingStop = group;
    const address = group.deliveryAddress;
    this.http.get<any>(`${this.data.apiUrl}/logistics/googlemaps/geocode`, {
      params: { address }
    }).subscribe({
      next: (result) => {
        if (result.latitude && result.longitude && !result.isApproximate) {
          group.latitude = result.latitude;
          group.longitude = result.longitude;
          group.city = result.city;
          group.province = result.province;
          group.addressApproximate = false;
          group.isCollapsed = true; // Collapse after successful geocoding
          
          // Update all invoices in this group with coordinates
          group.invoices.forEach((inv: any) => {
            inv.latitude = result.latitude;
            inv.longitude = result.longitude;
            inv.city = result.city;
            inv.province = result.province;
            inv.deliveryAddress = group.deliveryAddress;
            inv.address = group.deliveryAddress;
            
            // Also update in selectedStops
            const stop = this.selectedStops.find(s => s.id === inv.id);
            if (stop) {
              stop.latitude = result.latitude;
              stop.longitude = result.longitude;
              stop.city = result.city;
              stop.province = result.province;
              stop.deliveryAddress = group.deliveryAddress;
              stop.address = group.deliveryAddress;
            }
          });
          
          this.updateRouteMap();
        } else {
          // Address only resolved to a country/province centroid — NOT a real delivery point.
          // Clear any coordinates so the stop is clearly flagged as needing a proper address.
          group.latitude = null;
          group.longitude = null;
          group.addressApproximate = true;
          group.isCollapsed = false;
          this.snackBar.open(
            `"${group.customerName}" — that address is too vague to place on the map. Please enter a full street address.`,
            'OK', { duration: 5000 });
        }
        this.geocodingStop = null;
      },
      error: (err) => {
        console.error('Geocoding error:', err);
        this.geocodingStop = null;
      }
    });
  }

  geocodeStopAddress(stop: any): void {
    const raw = (stop.deliveryAddress || stop.address || '').trim();
    // Ignore empty or country-only addresses so we don't pin the centre of South Africa
    if (!raw || /^south africa$/i.test(raw)) {
      console.warn('No usable street address to geocode for stop', stop.customerName || stop.companyName);
      return;
    }

    this.geocodingStop = stop;
    const parts = [raw, stop.city, stop.province].filter(Boolean).join(', ');
    const address = parts + ', South Africa';
    this.http.get<any>(`${this.data.apiUrl}/logistics/googlemaps/geocode`, {
      params: { address }
    }).subscribe({
      next: (result) => {
        if (result.latitude && result.longitude) {
          stop.latitude = result.latitude;
          stop.longitude = result.longitude;
          stop.city = result.city;
          stop.province = result.province;
          this.updateRouteMap();
        } else {
          console.warn('No coordinates in geocode result');
        }
        this.geocodingStop = null;
      },
      error: (err) => {
        console.error('Geocoding error:', err);
        this.geocodingStop = null;
      }
    });
  }

  // Geocode all grouped stops that are missing coordinates
  async geocodeAllStops(): Promise<void> {
    const groupsToGeocode = this.groupedStops.filter(g => !g.latitude && g.deliveryAddress);
    
    if (groupsToGeocode.length === 0) {
      return;
    }

    this.geocodingAllStops = true;
    for (const group of groupsToGeocode) {
      try {
        const address = group.deliveryAddress;
        const result = await this.http.get<any>(`${this.data.apiUrl}/logistics/googlemaps/geocode`, {
          params: { address }
        }).toPromise();

        if (result?.latitude && result?.longitude && !result.isApproximate) {
          group.latitude = result.latitude;
          group.longitude = result.longitude;
          group.city = result.city;
          group.province = result.province;
          group.addressApproximate = false;
          group.isCollapsed = true;
          
          // Update all invoices in this group
          group.invoices.forEach((inv: any) => {
            inv.latitude = result.latitude;
            inv.longitude = result.longitude;
            const stop = this.selectedStops.find(s => s.id === inv.id);
            if (stop) {
              stop.latitude = result.latitude;
              stop.longitude = result.longitude;
            }
          });
        } else if (result?.isApproximate) {
          // Coarse match — flag it, don't pretend it's located
          group.latitude = null;
          group.longitude = null;
          group.addressApproximate = true;
          group.isCollapsed = false;
        }
      } catch (err) {
        console.error('Failed to geocode group:', group.customerName, err);
      }
    }

    this.geocodingAllStops = false;
    this.updateRouteMap();
  }

  // Use AI to match customer names to addresses
  async aiMatchAddresses(): Promise<void> {
    // Get stops missing coordinates or delivery address
    const groupsToMatch = this.groupedStops.filter(g => !g.latitude || !g.deliveryAddress);
    
    if (groupsToMatch.length === 0) {
      this.snackBar.open('All stops already have addresses/coordinates', 'Close', { duration: 3000 });
      return;
    }

    this.matchingAddresses = true;
    try {
      // Collect customer names to match
      const customerNames = groupsToMatch.map(g => g.customerName).filter(n => n);
      
      if (customerNames.length === 0) {
        this.snackBar.open('No customer names to match', 'Close', { duration: 3000 });
        this.matchingAddresses = false;
        return;
      }

      // Call the backend AI match endpoint
      const results = await this.http.post<any[]>(
        `${this.data.apiUrl}/logistics/customers/match-addresses-ai`,
        customerNames
      ).toPromise();

      if (!results || results.length === 0) {
        this.snackBar.open('No matches found by AI', 'Close', { duration: 3000 });
        this.matchingAddresses = false;
        return;
      }
      // Apply the matches to grouped stops
      let matchCount = 0;
      for (const result of results) {
        const group = this.groupedStops.find(g => 
          g.customerName?.toLowerCase() === result.customerName?.toLowerCase()
        );

        if (group && result.deliveryAddress) {
          // Update the group with matched address
          if (!group.deliveryAddress) {
            group.deliveryAddress = result.deliveryAddress;
          }
          if (result.city && !group.city) {
            group.city = result.city;
          }
          if (result.province && !group.province) {
            group.province = result.province;
          }
          if (result.latitude && result.longitude) {
            group.latitude = result.latitude;
            group.longitude = result.longitude;
            group.isCollapsed = true;
            
            // Update all invoices in this group
            group.invoices.forEach((inv: any) => {
              inv.latitude = result.latitude;
              inv.longitude = result.longitude;
              if (!inv.deliveryAddress) {
                inv.deliveryAddress = result.deliveryAddress;
              }
              const stop = this.selectedStops.find((s: any) => s.id === inv.id);
              if (stop) {
                stop.latitude = result.latitude;
                stop.longitude = result.longitude;
                if (!stop.deliveryAddress) {
                  stop.deliveryAddress = result.deliveryAddress;
                }
              }
            });
          }
          
          matchCount++;
        }
      }

      // After matching, auto-geocode any stops that got addresses but no coordinates
      const needsGeocoding = this.groupedStops.filter(g => g.deliveryAddress && !g.latitude);
      if (needsGeocoding.length > 0) {
        this.snackBar.open(`Matched ${matchCount} stops. Geocoding ${needsGeocoding.length} addresses...`, 'Close', { duration: 3000 });
        await this.geocodeAllStops();
      } else {
        this.snackBar.open(`AI matched ${matchCount} of ${groupsToMatch.length} stops (all have coordinates)`, 'Close', { duration: 4000 });
      }
      
      // Update the map with new coordinates
      this.updateRouteMap();
      
    } catch (error) {
      console.error('Error in AI address matching:', error);
      this.snackBar.open('Failed to match addresses with AI', 'Close', { duration: 3000 });
    }

    this.matchingAddresses = false;
  }

  // ============ SAVED DELIVERY ADDRESSES ============
  
  // Get saved addresses for a customer group
  getSavedAddresses(group: any): any[] {
    const key = group.customerNumber || group.customerName;
    return this.customerSavedAddresses.get(key) || [];
  }

  // Load saved addresses for customers in the selected stops
  loadSavedAddressesForCustomers(): void {
    const customerIds = new Set<number>();
    const customerKeys = new Set<string>();
    
    // Collect customer IDs and names from grouped stops
    this.groupedStops.forEach(group => {
      // Try to find customer in the customers list
      const customer = this.data.customers?.find((c: any) => 
        c.customerCode === group.customerNumber || 
        c.name === group.customerName ||
        c.shortName === group.customerName
      );
      
      if (customer?.id) {
        customerIds.add(customer.id);
      }
      customerKeys.add(group.customerNumber || group.customerName);
    });

    if (customerIds.size === 0) {
      return;
    }

    this.loadingSavedAddresses = true;
    const idsArray = Array.from(customerIds);

    this.http.get<any>(`${this.data.apiUrl}/logistics/customers/delivery-addresses/batch`, {
      params: { customerIds: idsArray.join(',') }
    }).subscribe({
      next: (result) => {
        // Map the results by customer code/name for easy lookup
        this.customerSavedAddresses.clear();
        
        // Result is a dictionary with customerId as key
        Object.entries(result).forEach(([customerId, addresses]) => {
          // Find the customer to get the name/code
          const customer = this.data.customers?.find((c: any) => c.id === parseInt(customerId));
          if (customer) {
            const key = customer.customerCode || customer.name;
            this.customerSavedAddresses.set(key, addresses as any[]);
            // Also set by name if different
            if (customer.name && customer.name !== key) {
              this.customerSavedAddresses.set(customer.name, addresses as any[]);
            }
          }
        });
        
        this.loadingSavedAddresses = false;
      },
      error: (err) => {
        console.error('Failed to load saved addresses:', err);
        this.loadingSavedAddresses = false;
      }
    });
  }

  // Handle selection of a saved address
  onSavedAddressSelected(group: any, savedAddress: any): void {
    if (!savedAddress) return;

    // Update the group with the saved address data
    group.deliveryAddress = savedAddress.formattedAddress || savedAddress.address;
    group.latitude = savedAddress.latitude;
    group.longitude = savedAddress.longitude;
    group.city = savedAddress.city;
    group.province = savedAddress.province;
    group.isCollapsed = !!(savedAddress.latitude && savedAddress.longitude);

    // Update all invoices in this group
    group.invoices?.forEach((inv: any) => {
      inv.deliveryAddress = group.deliveryAddress;
      inv.address = group.deliveryAddress;
      inv.latitude = savedAddress.latitude;
      inv.longitude = savedAddress.longitude;
      inv.city = savedAddress.city;
      inv.province = savedAddress.province;

      // Also update in selectedStops
      const stop = this.selectedStops.find(s => s.id === inv.id);
      if (stop) {
        stop.deliveryAddress = group.deliveryAddress;
        stop.address = group.deliveryAddress;
        stop.latitude = savedAddress.latitude;
        stop.longitude = savedAddress.longitude;
        stop.city = savedAddress.city;
        stop.province = savedAddress.province;
      }
    });

    // Record usage of this address
    this.http.post(`${this.data.apiUrl}/logistics/customers/delivery-addresses/${savedAddress.id}/use`, {}).subscribe({
      next: () => {},
      error: (err) => console.error('Failed to record address usage:', err)
    });

    // Update the map
    if (this.mapInitialized) {
      this.updateRouteMap();
    }

    // Show snackbar notification
    this.snackBar.open(
      `✓ Applied saved address for ${group.customerName}`,
      'OK',
      { duration: 2000, panelClass: ['info-snackbar'] }
    );
  }

  // Save the current address for a customer
  saveAddressForCustomer(group: any): void {
    if (!group.deliveryAddress) {
      console.warn('No address to save');
      return;
    }

    // Find the customer
    const customer = this.data.customers?.find((c: any) => 
      c.customerCode === group.customerNumber || 
      c.name === group.customerName ||
      c.shortName === group.customerName
    );

    const payload = {
      customerId: customer?.id || 0,
      customerName: group.customerName,
      customerCode: group.customerNumber,
      address: group.deliveryAddress,
      city: group.city,
      province: group.province,
      latitude: group.latitude,
      longitude: group.longitude,
      formattedAddress: group.deliveryAddress
    };

    this.http.post<any>(`${this.data.apiUrl}/logistics/customers/delivery-addresses/save`, payload).subscribe({
      next: (result) => {
        // Add to local cache
        const key = group.customerNumber || group.customerName;
        const existing = this.customerSavedAddresses.get(key) || [];
        
        // Check if already in cache
        const existingIndex = existing.findIndex(a => a.id === result.id);
        if (existingIndex >= 0) {
          existing[existingIndex] = result;
        } else {
          existing.unshift(result); // Add to beginning
        }
        
        this.customerSavedAddresses.set(key, existing);
        
        // Show success snackbar notification
        this.snackBar.open(
          `✓ Address saved for ${group.customerName}`,
          'OK',
          { duration: 3000, panelClass: ['success-snackbar'] }
        );
      },
      error: (err) => {
        console.error('Failed to save address:', err);
        this.snackBar.open(
          `✗ Failed to save address: ${err.error?.message || 'Unknown error'}`,
          'Dismiss',
          { duration: 5000, panelClass: ['error-snackbar'] }
        );
      }
    });
  }

  // Save all addresses when creating tripsheet
  saveAllAddresses(): void {
    const addressesToSave: any[] = [];

    this.groupedStops.forEach(group => {
      if (group.deliveryAddress && group.latitude && group.longitude) {
        const customer = this.data.customers?.find((c: any) => 
          c.customerCode === group.customerNumber || 
          c.name === group.customerName
        );

        addressesToSave.push({
          customerId: customer?.id || 0,
          customerName: group.customerName,
          customerCode: group.customerNumber,
          address: group.deliveryAddress,
          city: group.city,
          province: group.province,
          latitude: group.latitude,
          longitude: group.longitude,
          formattedAddress: group.deliveryAddress
        });
      }
    });

    if (addressesToSave.length === 0) {
      return;
    }

    this.http.post<any>(`${this.data.apiUrl}/logistics/customers/delivery-addresses/batch-save`, {
      addresses: addressesToSave
    }).subscribe({
      next: (result) => {
        const savedCount = result.saved?.length || 0;
        const errorCount = result.errors?.length || 0;
        if (savedCount > 0) {
          this.snackBar.open(
            `✓ ${savedCount} address${savedCount > 1 ? 'es' : ''} saved for future use`,
            'OK',
            { duration: 4000, panelClass: ['success-snackbar'] }
          );
        }
      },
      error: (err) => {
        console.error('Failed to batch save addresses:', err);
        // Don't show error for batch save - it's a background operation
      }
    });
  }

  // ============ END SAVED DELIVERY ADDRESSES ============

  // Refresh map
  refreshMap(): void {
    if (this.mapInitialized) {
      this.updateRouteMap();
    } else {
      this.initializeMap();
    }
  }

  // When warehouse is selected, update the map
  onWarehouseSelected(): void {
    if (this.mapInitialized) {
      this.updateRouteMap();
    }
  }

  // Searchable dropdown filter methods
  filterWarehouses(): void {
    const searchValue = this.warehouseSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    if (!search) {
      this.filteredWarehouses = [...(this.data.warehouses || [])];
    } else {
      this.filteredWarehouses = (this.data.warehouses || []).filter(wh => 
        wh.name?.toLowerCase().includes(search) ||
        wh.city?.toLowerCase().includes(search) ||
        wh.code?.toLowerCase().includes(search)
      );
    }
  }

  filterDrivers(): void {
    const searchValue = this.driverSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    if (!search) {
      this.filteredDrivers = [...(this.data.drivers || [])];
    } else {
      this.filteredDrivers = (this.data.drivers || []).filter(d => 
        d.firstName?.toLowerCase().includes(search) ||
        d.lastName?.toLowerCase().includes(search) ||
        `${d.firstName} ${d.lastName}`.toLowerCase().includes(search)
      );
    }
  }

  filterVehicles(): void {
    const searchValue = this.vehicleSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    if (!search) {
      this.filteredVehicles = [...(this.data.vehicles || [])];
    } else {
      this.filteredVehicles = (this.data.vehicles || []).filter(v => 
        v.registrationNumber?.toLowerCase().includes(search) ||
        v.make?.toLowerCase().includes(search) ||
        v.model?.toLowerCase().includes(search) ||
        `${v.registrationNumber} ${v.make} ${v.model}`.toLowerCase().includes(search)
      );
    }
  }

  displayWarehouse(wh: any): string {
    return wh ? `${wh.name} - ${wh.city}` : '';
  }

  displayDriver(driver: any): string {
    if (!driver) return '';
    if (typeof driver === 'string') return driver;
    return `${driver.firstName || ''} ${driver.lastName || ''}`.trim();
  }

  displayVehicle(vehicle: any): string {
    if (!vehicle) return '';
    if (typeof vehicle === 'string') return vehicle;
    return `${vehicle.registrationNumber || ''} - ${vehicle.make || ''} ${vehicle.model || ''}`.trim();
  }

  onWarehouseAutocompleteSelected(event: any): void {
    this.selectedWarehouse = event.option.value;
    this.onWarehouseSelected();
  }

  onDriverAutocompleteSelected(event: any): void {
    this.selectedDriver = event.option.value;
  }

  onVehicleAutocompleteSelected(event: any): void {
    this.selectedVehicle = event.option.value;
  }

  // Load TFN depot locations on the map
  // Map province names to province codes
  getProvinceCode(provinceName: string): string {
    const mapping: { [key: string]: string } = {
      'gauteng': 'GP',
      'kwazulu-natal': 'KZN',
      'kwa-zulu natal': 'KZN',
      'western cape': 'WC',
      'eastern cape': 'EC',
      'free state': 'FS',
      'limpopo': 'LP',
      'mpumalanga': 'MP',
      'north west': 'NW',
      'northern cape': 'NC'
    };
    return mapping[provinceName?.toLowerCase()] || '';
  }

  loadTfnDepots(): void {
    if (!this.map) {
      console.warn('Map not initialized yet');
      return;
    }

    // Clear existing depot markers
    this.tfnDepotMarkers.forEach(m => m.setMap(null));
    this.tfnDepotMarkers = [];

    // Get the warehouse province code
    const warehouseProvinceCode = this.getProvinceCode(this.selectedWarehouse?.province || '');
    // Filter depots by province if warehouse has a province
    const depotsToShow = warehouseProvinceCode 
      ? this.tfnDepots.filter(d => d.province === warehouseProvinceCode)
      : this.tfnDepots;

    // Add depot markers
    depotsToShow.forEach(depot => {
      const marker = new google.maps.Marker({
        position: { lat: depot.latitude, lng: depot.longitude },
        map: this.map,
        title: depot.name,
        icon: {
          path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#ff9800',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2
        }
      } as any);

      // Add info window
      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding: 8px; font-family: Arial;"><strong>${depot.name}</strong><br>${depot.address}<br><small>Code: ${depot.code}</small></div>`
      });

      marker.addListener('click', () => {
        infoWindow.open(this.map, marker);
      });

      this.tfnDepotMarkers.push(marker);
    });

    this.tfnDepotsLoaded = true;

    // Fit bounds to show all markers including depots
    if (this.tfnDepotMarkers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      
      // Include warehouse
      if (this.selectedWarehouse?.latitude && this.selectedWarehouse?.longitude) {
        bounds.extend({ lat: this.selectedWarehouse.latitude, lng: this.selectedWarehouse.longitude });
      }
      
      // Include stops
      this.selectedStops.forEach(s => {
        if (s.latitude && s.longitude) {
          bounds.extend({ lat: s.latitude, lng: s.longitude });
        }
      });
      
      // Include filtered depots only
      depotsToShow.forEach(d => {
        bounds.extend({ lat: d.latitude, lng: d.longitude });
      });
      
      this.map.fitBounds(bounds, 50);
    }
  }

  previewPdf(): void {
    // Create a preview window with trip sheet HTML
    const html = this.generateTripsheetHtml();
    const previewWindow = window.open('', '_blank');
    if (previewWindow) {
      previewWindow.document.write(html);
      previewWindow.document.close();
    }
  }

  /**
   * Convert the picked scheduled date to a local (non-UTC) ISO string so the
   * chosen calendar day is preserved. Using the raw Date / toISOString() would
   * shift the day backwards for UTC+ timezones (e.g. SAST/UTC+2), causing e.g.
   * "29 Sep" to be stored and displayed as "28 Sep".
   */
  private toLocalScheduledIso(value: any): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    d.setHours(12, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00`;
  }

  createTripsheet(sendToSign: boolean = false): void {
    // Hard guard: never allow generating a trip sheet with missing driver/vehicle,
    // an invalid date, or unresolved delivery addresses.
    const blockReason = this.routeStepBlockReason();
    if (blockReason) {
      this.snackBar.open(blockReason, 'Close', { duration: 5000 });
      return;
    }

    this.creating = true;
    
    // Save all delivery addresses for future use
    this.saveAllAddresses();
    
    // Use groupedStops (grouped by customer) instead of raw selectedStops
    const stopsToUse = this.groupedStops.length > 0 ? this.groupedStops : this.selectedStops;

    // --- Sales mode: create a Sales Trip Sheet pending two-person approval instead of a live load ---
    if (this.data?.salesMode) {
      const lines: any[] = [];
      stopsToUse.forEach((stop: any) => {
        const invoices = stop.invoices && stop.invoices.length ? stop.invoices : [stop];
        invoices.forEach((inv: any) => {
          lines.push({
            customerName: stop.customerName || stop.companyName || inv.customerName || null,
            invoiceNumber: stop.transactionNumber || inv.transactionNumber || inv.invoiceNumber || null,
            address: stop.deliveryAddress || stop.address || inv.deliveryAddress || null,
            city: stop.city || inv.city || null,
            province: stop.province || inv.province || null,
            contactPerson: stop.contactPerson || inv.contactPerson || null,
            contactPhone: stop.contactPhone || inv.contactPhone || null,
            productDescription: inv.productDescription || stop.productDescription || null,
            quantity: Number(inv.quantity ?? stop.quantity ?? 0) || 0,
            value: Number(inv.salesAmount ?? stop.salesAmount ?? 0) || 0
          });
        });
      });

      const salesPayload: any = {
        warehouseCode: this.selectedWarehouse?.code || this.selectedWarehouse?.name || null,
        warehouseId: this.selectedWarehouse?.id || null,
        routeArea: this.data.routeArea || (this.selectedProvince !== 'all' ? this.selectedProvince : null),
        scheduledDate: this.toLocalScheduledIso(this.scheduledDate),
        notes: this.specialInstructions || null,
        estimatedDistance: this.totalDistance || null,
        driverName: this.selectedDriver ? `${this.selectedDriver.firstName || ''} ${this.selectedDriver.lastName || ''}`.trim() : null,
        vehicleRegistration: this.selectedVehicle?.registrationNumber || null,
        createdByName: this.data.createdByName || null,
        signerUserId: this.data.signerUserId ?? null,
        signerName: this.data.signerName || null,
        approverUserId: this.data.approverUserId ?? null,
        approverName: this.data.approverName || null,
        sendToSign: !!sendToSign,
        lines
      };

      this.http.post(`${environment.apiUrl}/logistics/sales-tripsheets`, salesPayload).subscribe({
        next: () => {
          this.creating = false;
          this.dialogRef.close({ created: true, salesMode: true, sentToSign: !!sendToSign });
        },
        error: (err) => {
          this.creating = false;
          this.snackBar.open('Failed to create trip sheet: ' + (err.error?.error || err.error?.message || err.message || 'Unknown error'), 'Close', { duration: 5000 });
        }
      });
      return;
    }
    
    // Determine if this is an update or create
    // IMPORTANT: Also check draftId - if auto-save created a draft, update it instead of creating a duplicate
    const isUpdate = (this.data.isEditMode && this.data.editLoadId) || this.draftId !== null;
    
    // Build the load/tripsheet payload
    // When updating (especially from draft), set status to Assigned/Available
    const payload: any = {
      warehouseId: this.selectedWarehouse?.id,
      driverId: this.selectedDriver?.id,
      vehicleId: this.selectedVehicle?.id,
      scheduledPickupDate: this.toLocalScheduledIso(this.scheduledDate),
      specialInstructions: this.specialInstructions,
      estimatedDistance: this.totalDistance,
      estimatedTimeMinutes: Math.round(this.totalDistance * 1.2), // rough estimate
      priority: 'Normal',
      stops: stopsToUse.map((stop, index) => ({
        stopSequence: index + 1,
        stopType: index === stopsToUse.length - 1 ? 'Destination' : 'Delivery',
        customerId: stop.customerId || null,
        companyName: stop.customerName || stop.companyName || 'Unknown',
        address: stop.deliveryAddress || stop.address || 'Unknown Address',
        city: stop.city || null,
        province: stop.province || null,
        latitude: stop.latitude || null,
        longitude: stop.longitude || null,
        orderNumber: stop.transactionNumber || stop.invoices?.[0]?.transactionNumber || null,
        invoiceNumber: stop.transactionNumber || stop.invoices?.[0]?.transactionNumber || null,
        commodities: stop.invoices 
          ? stop.invoices.map((inv: any) => ({
              commodityName: inv.productDescription || 'Product',
              commodityCode: inv.productCode || null,
              quantity: inv.quantity || 1,
              unitPrice: inv.quantity ? (inv.salesAmount / inv.quantity) : (inv.salesAmount || 0),
              totalPrice: inv.salesAmount || 0
            }))
          : [{
              commodityName: stop.productDescription || 'Product',
              commodityCode: stop.productCode || null,
              quantity: stop.quantity || 1,
              unitPrice: stop.quantity ? (stop.salesAmount / stop.quantity) : (stop.salesAmount || 0),
              totalPrice: stop.salesAmount || 0
            }]
      })),
      invoiceIds: this.selectedStops
        .map(s => s.id)
        .filter(id => id != null && id !== undefined)
        .map(id => typeof id === 'string' ? parseInt(id, 10) : id)
        .filter(id => !isNaN(id))
    };
    
    // When completing a tripsheet (creating or updating from draft), set proper status
    if (isUpdate) {
      // Update: set status to Assigned if driver selected, otherwise Available
      payload.status = this.selectedDriver?.id ? 'Assigned' : 'Available';
    }
    
    const loadIdToUpdate = this.data.editLoadId || this.draftId;
    const apiUrl = isUpdate 
      ? `${environment.apiUrl}/logistics/loads/${loadIdToUpdate}`
      : `${environment.apiUrl}/logistics/loads`;
    const httpMethod = isUpdate ? this.http.put.bind(this.http) : this.http.post.bind(this.http);
    
    httpMethod(apiUrl, payload).subscribe({
      next: (result: any) => {
        const loadId = isUpdate ? loadIdToUpdate : result.id;
        // Download the PDF
        this.http.get(`${environment.apiUrl}/logistics/tripsheet/${loadId}/pdf`, { responseType: 'text' }).subscribe({
          next: (html) => {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
              printWindow.document.write(html);
              printWindow.document.close();
              setTimeout(() => printWindow.print(), 500);
            }
            
            this.creating = false;
            this.dialogRef.close({ created: !isUpdate, updated: isUpdate, loadId: loadId });
          },
          error: () => {
            this.creating = false;
            this.dialogRef.close({ created: !isUpdate, updated: isUpdate, loadId: loadId });
          }
        });
      },
      error: (err) => {
        console.error('Failed to ' + (isUpdate ? 'update' : 'create') + ' tripsheet:', err);
        this.snackBar.open('Failed to ' + (isUpdate ? 'update' : 'create') + ' tripsheet: ' + (err.error?.message || err.message || 'Unknown error'), 'Close', { duration: 5000 });
        this.creating = false;
      }
    });
  }
  
  // Create tripsheet and email it to the driver/customer
  createAndEmail(): void {
    // First ask who to email the trip sheet to
    let userEmail = '';
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) userEmail = JSON.parse(stored)?.email || '';
    } catch { /* ignore */ }

    const recipientsRef = this.dialog.open(TripsheetEmailRecipientsDialog, {
      width: '540px',
      data: {
        loadNumber: this.data.existingTripsheet?.loadNumber,
        userEmail
      }
    });

    recipientsRef.afterClosed().subscribe((recipientResult: { emails: string[]; ccSelf: boolean; attachPickingSlip: boolean } | undefined) => {
      if (!recipientResult || recipientResult.emails.length === 0) {
        return; // Cancelled
      }
      this.doCreateAndEmail(recipientResult.emails, recipientResult.ccSelf, recipientResult.attachPickingSlip);
    });
  }

  private doCreateAndEmail(recipientEmails: string[], ccSelf: boolean, attachPickingSlip: boolean): void {
    this.creating = true;
    
    // Save all delivery addresses for future use
    this.saveAllAddresses();
    
    // Use groupedStops (grouped by customer) instead of raw selectedStops
    const stopsToUse = this.groupedStops.length > 0 ? this.groupedStops : this.selectedStops;
    
    // Build the load/tripsheet payload
    const payload = {
      warehouseId: this.selectedWarehouse?.id,
      driverId: this.selectedDriver?.id,
      vehicleId: this.selectedVehicle?.id,
      scheduledPickupDate: this.toLocalScheduledIso(this.scheduledDate),
      specialInstructions: this.specialInstructions,
      estimatedDistance: this.totalDistance,
      estimatedTimeMinutes: Math.round(this.totalDistance * 1.2),
      priority: 'Normal',
      stops: stopsToUse.map((stop, index) => ({
        stopSequence: index + 1,
        stopType: index === stopsToUse.length - 1 ? 'Destination' : 'Delivery',
        customerId: stop.customerId || null,
        companyName: stop.customerName || stop.companyName || 'Unknown',
        address: stop.deliveryAddress || stop.address || 'Unknown Address',
        city: stop.city || null,
        province: stop.province || null,
        latitude: stop.latitude || null,
        longitude: stop.longitude || null,
        orderNumber: stop.transactionNumber || stop.invoices?.[0]?.transactionNumber || null,
        invoiceNumber: stop.transactionNumber || stop.invoices?.[0]?.transactionNumber || null,
        commodities: stop.invoices 
          ? stop.invoices.map((inv: any) => ({
              commodityName: inv.productDescription || 'Product',
              commodityCode: inv.productCode || null,
              quantity: inv.quantity || 1,
              unitPrice: inv.quantity ? (inv.salesAmount / inv.quantity) : (inv.salesAmount || 0),
              totalPrice: inv.salesAmount || 0
            }))
          : [{
              commodityName: stop.productDescription || 'Product',
              commodityCode: stop.productCode || null,
              quantity: stop.quantity || 1,
              unitPrice: stop.quantity ? (stop.salesAmount / stop.quantity) : (stop.salesAmount || 0),
              totalPrice: stop.salesAmount || 0
            }]
      })),
      invoiceIds: this.selectedStops.map(s => s.id).filter(id => id != null)
    };
    
    // Determine if this is an update or create
    // IMPORTANT: Also check draftId - if auto-save created a draft, update it instead of creating a duplicate
    const isUpdate = (this.data.isEditMode && this.data.editLoadId) || this.draftId !== null;
    const loadIdToUpdate = this.data.editLoadId || this.draftId;
    const apiUrl = isUpdate 
      ? `${environment.apiUrl}/logistics/loads/${loadIdToUpdate}`
      : `${environment.apiUrl}/logistics/loads`;
    const httpMethod = isUpdate ? this.http.put.bind(this.http) : this.http.post.bind(this.http);
    
    httpMethod(apiUrl, payload).subscribe({
      next: (result: any) => {
        const loadId = isUpdate ? loadIdToUpdate : result.id;
        
        // Send email with the tripsheet
        this.http.post(`${environment.apiUrl}/logistics/tripsheet/${loadId}/email`, {
          recipientEmails: recipientEmails,
          ccSelf: ccSelf,
          attachPickingSlip: attachPickingSlip
        }).subscribe({
          next: (emailResult: any) => {
            this.creating = false;
            const sentTo = emailResult?.recipients?.join(', ') || recipientEmails.join(', ');
            this.snackBar.open(`Tripsheet created and emailed to ${sentTo}`, 'Close', { duration: 5000 });
            this.dialogRef.close({ created: !isUpdate, updated: isUpdate, loadId: loadId, emailed: true });
          },
          error: (emailErr) => {
            console.error('Failed to email tripsheet:', emailErr);
            this.creating = false;
            this.snackBar.open('Tripsheet created but email failed: ' + (emailErr.error?.error || emailErr.message), 'Close', { duration: 6000 });
            this.dialogRef.close({ created: !isUpdate, updated: isUpdate, loadId: loadId, emailed: false });
          }
        });
      },
      error: (err) => {
        console.error('Failed to ' + (isUpdate ? 'update' : 'create') + ' tripsheet:', err);
        this.snackBar.open('Failed to create tripsheet: ' + (err.error?.message || err.message), 'Close', { duration: 5000 });
        this.creating = false;
      }
    });
  }

  private generateTripsheetHtml(): string {
    const date = new Date().toLocaleDateString('en-ZA', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    });
    
    // Calculate unique customers for offload time
    const uniqueCustomers = new Set<string>();
    this.selectedStops.forEach(stop => {
      const customerName = (stop.customerName || stop.companyName || '').toLowerCase().trim();
      if (customerName) uniqueCustomers.add(customerName);
    });
    const uniqueCustomerCount = uniqueCustomers.size;
    
    // Calculate return distance if not already calculated
    let returnDistKm = this.returnDistance;
    let returnTimeStr = this.returnTime;
    
    if (returnDistKm === 0 && this.selectedStops.length > 0) {
      // Calculate return distance from last stop to warehouse using haversine
      const stopsWithCoords = this.selectedStops.filter(s => s.latitude && s.longitude);
      if (stopsWithCoords.length > 0) {
        const lastStop = stopsWithCoords[stopsWithCoords.length - 1];
        const warehouseLat = this.selectedWarehouse?.latitude || -29.8587;
        const warehouseLng = this.selectedWarehouse?.longitude || 31.0218;
        
        if (lastStop?.latitude && lastStop?.longitude) {
          const dist = this.haversineDistance(lastStop.latitude, lastStop.longitude, warehouseLat, warehouseLng);
          returnDistKm = Math.round(dist * 1.25); // Add 25% for roads
          const returnMins = Math.round((returnDistKm / 55) * 60);
          const hours = Math.floor(returnMins / 60);
          const mins = returnMins % 60;
          returnTimeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        }
      }
    }
    
    let stopsHtml = '';
    let totalQty = 0;
    this.selectedStops.forEach((stop, i) => {
      const qty = stop.quantity || stop.qty || 1;
      totalQty += qty;
      stopsHtml += `
        <tr>
          <td class="center"><span class="stop-num">${i + 1}</span></td>
          <td>${stop.transactionNumber}</td>
          <td class="customer">${stop.customerName}</td>
          <td class="address">${stop.deliveryAddress || stop.address || 'N/A'}</td>
          <td class="product">${stop.productDescription?.substring(0, 30) || 'Product'}${stop.productDescription?.length > 30 ? '...' : ''}</td>
          <td class="center"><strong>${qty}</strong></td>
          <td class="right">R ${stop.netSales?.toFixed(2) || stop.salesAmount?.toFixed(2) || '0.00'}</td>
          <td class="center"><span class="checkbox"></span></td>
        </tr>
      `;
    });
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trip Sheet - ${date}</title>
        <style>
          @page { size: landscape; margin: 8mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; line-height: 1.3; padding: 10px; background: white; }
          .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 3px solid #033142; margin-bottom: 10px; }
          .header-left { display: flex; align-items: center; gap: 12px; }
          .logo { font-size: 21px; font-weight: bold; color: #033142; }
          .trip-badge { background: #033142; color: white; padding: 5px 15px; border-radius: 15px; font-size: 15px; font-weight: bold; }
          .company { text-align: right; font-size: 14px; font-weight: bold; color: #333; }
          .info-strip { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; padding: 6px 10px; background: linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 100%); border-radius: 5px; border: 1px solid #ddd; }
          .info-item { display: flex; align-items: center; gap: 4px; padding: 2px 8px; background: white; border-radius: 4px; border: 1px solid #e0e0e0; font-size: 11px; }
          .info-item strong { color: #333; }
          .info-sub { color: #666; font-size: 10px; }
          .route-map-section { margin: 8px 0; text-align: center; page-break-inside: avoid; }
          .route-map-section h4 { font-size: 12px; color: #033142; margin-bottom: 6px; display: flex; align-items: center; justify-content: center; gap: 5px; }
          .route-map-section img { max-width: 100%; height: auto; border: 2px solid #033142; border-radius: 5px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #033142; color: white; padding: 6px 4px; text-align: left; font-weight: 600; font-size: 11px; white-space: nowrap; }
          th.center, td.center { text-align: center; }
          th.right, td.right { text-align: right; }
          td { padding: 5px 4px; border-bottom: 1px solid #e0e0e0; vertical-align: middle; }
          tr:nth-child(even) { background: #f9f9f9; }
          .stop-num { background: #033142; color: white; width: 21px; height: 21px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; }
          .customer { font-weight: 600; color: #333; font-size: 11px; }
          .address { color: #666; font-size: 10px; max-width: 150px; }
          .product { font-size: 10px; }
          .checkbox { width: 17px; height: 17px; border: 2px solid #033142; border-radius: 2px; display: inline-block; }
          .totals td { background: #e0ecf0; font-weight: bold; border-top: 2px solid #033142; }
          .bottom-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px; }
          .section-box { border: 1px solid #ddd; border-radius: 5px; padding: 8px; }
          .section-box h4 { font-size: 12px; color: #033142; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e0e0e0; }
          .km-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 6px; }
          .km-field label { display: block; font-size: 10px; color: #666; margin-bottom: 2px; }
          .input-box { border: 1px solid #ccc; border-radius: 3px; height: 21px; background: white; }
          .sig-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .sig-box { text-align: center; }
          .sig-line { border-bottom: 1px solid #333; height: 28px; margin-bottom: 3px; }
          .sig-label { font-size: 10px; color: #666; text-transform: uppercase; }
          .footer { margin-top: 8px; text-align: center; font-size: 10px; color: #999; padding-top: 6px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <span class="logo">🚛 TRIP SHEET</span>
            <span class="trip-badge">LOAD-${Date.now().toString().slice(-6)}</span>
          </div>
          <div class="company">Rocket Freight<br/><span style="color: #666; font-size: 8px;">Logistics Division</span></div>
        </div>
        
        <div class="info-strip">
          <div class="info-item"><span>👤</span> <strong>${this.selectedDriver ? (this.selectedDriver.firstName || '') + ' ' + (this.selectedDriver.lastName || '') : 'UNASSIGNED'}</strong></div>
          <div class="info-item"><span>🚛</span> <strong>${this.selectedVehicle?.registrationNumber || 'N/A'}</strong> <span class="info-sub">${this.selectedVehicle?.type || ''}</span></div>
          <div class="info-item"><span>📅</span> <strong>${new Date().toLocaleDateString('en-ZA')}</strong></div>
          <div class="info-item"><span>📍</span> <strong>${this.selectedWarehouse?.name || 'Warehouse'}</strong> <span class="info-sub">${this.selectedWarehouse?.city || ''}</span></div>
          <div class="info-item"><span>🚚</span> <strong>${this.selectedStops.length} Stops</strong> <span class="info-sub">(${uniqueCustomerCount} customers)</span></div>
          <div class="info-item"><span>⏱️</span> <strong>${this.totalDistance}km</strong> <span class="info-sub">${this.estimatedTime} (incl. ${uniqueCustomerCount}h offload)</span></div>
          <div class="info-item" style="background: #fff3e0; border-color: #ff9800;"><span>🔄</span> <strong>Return:</strong> <span class="info-sub">${returnDistKm}km • ${returnTimeStr}</span></div>
          <div class="info-item"><span>💰</span> <strong>R ${this.totalValue.toFixed(2)}</strong></div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th class="center" style="width: 35px;">NO</th>
              <th style="width: 80px;">INV NO</th>
              <th style="width: 160px;">CUSTOMER NAME</th>
              <th>DELIVERY ADDRESS</th>
              <th style="width: 140px;">PRODUCT</th>
              <th class="center" style="width: 45px;">QTY</th>
              <th class="right" style="width: 70px;">VALUE</th>
              <th class="center" style="width: 35px;">✓</th>
            </tr>
          </thead>
          <tbody>
            ${stopsHtml}
            <tr class="totals">
              <td colspan="5" style="text-align: right;">TOTALS:</td>
              <td class="center">${totalQty}</td>
              <td class="right">R ${this.totalValue.toFixed(2)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        
        <div class="bottom-section">
          <div class="section-box">
            <h4>📊 VEHICLE RECORD</h4>
            <div class="km-grid">
              <div class="km-field"><label>Opening KM:</label><div class="input-box"></div></div>
              <div class="km-field"><label>Closing KM:</label><div class="input-box"></div></div>
            </div>
          </div>
          <div class="section-box">
            <h4>✍️ SIGNATURES</h4>
            <div class="sig-grid">
              <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Driver</div></div>
              <div class="sig-box"><div class="sig-line"></div><div class="sig-label">Dispatch</div></div>
            </div>
          </div>
        </div>
        
        <div class="footer">Generated ${new Date().toLocaleString('en-ZA')} | Rocket Freight Logistics</div>
      </body>
      </html>
    `;
  }
}

// Tripsheet Type Selection Dialog
@Component({
  selector: 'tripsheet-type-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  template: `
    <div class="tripsheet-type-dialog">
      <div class="dialog-header">
        <h2><mat-icon>add_road</mat-icon> Create Trip Sheet</h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div class="dialog-content">
        <p class="subtitle">Select the type of trip sheet you want to create:</p>
        
        <div class="type-grid">
          <div class="type-card" (click)="selectType('import')" matTooltip="Import trip sheet data from an Excel file">
            <div class="type-icon import">
              <mat-icon>upload_file</mat-icon>
            </div>
            <h3>Import Tripsheet</h3>
            <p>Upload an Excel file with invoice and delivery data</p>
          </div>
          
          <div class="type-card" (click)="selectType('pad')" matTooltip="Import a DN Tripsheet Excel — invoices are linked where found, delivery notes accepted as-is">
            <div class="type-icon automatic">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <h3>DN Tripsheet</h3>
            <p>Import a tripsheet with delivery notes &amp; invoices mixed &mdash; invoices we recognise get linked, the rest are accepted as-is</p>
          </div>
          
          <div class="type-card" (click)="selectType('manual')" matTooltip="Manually enter invoice and delivery details">
            <div class="type-icon manual">
              <mat-icon>edit_note</mat-icon>
            </div>
            <h3>Manual Tripsheet</h3>
            <p>Enter invoice numbers, customers, and products manually</p>
          </div>
          
          <div class="type-card" (click)="selectType('transfer')" matTooltip="Create an internal stock transfer between warehouses">
            <div class="type-icon transfer">
              <mat-icon>swap_horiz</mat-icon>
            </div>
            <h3>Internal Transfer</h3>
            <p>Move stock between warehouses</p>
          </div>
          
          <div class="type-card welly-card" (click)="selectType('ai-builder')" matTooltip="Pick a warehouse & vehicle, then let AI group invoices into ready-to-go loads">
            <div class="type-icon welly">
              <mat-icon>smart_toy</mat-icon>
            </div>
            <h3>AI Powered Tripsheets</h3>
            <p>Choose warehouse &amp; vehicle, then AI groups invoices by location into loads &mdash; or build one by invoice number</p>
            <span class="ai-badge">AI Powered</span>
          </div>
          
          <div class="type-card suggests-card" (click)="selectType('welly-suggests')" matTooltip="Welly analyzes all pending invoices and suggests optimal tripsheet groupings by warehouse">
            <div class="type-icon suggests">
              <mat-icon>lightbulb</mat-icon>
            </div>
            <h3>Welly Suggests</h3>
            <p>AI batches pending invoices by warehouse &amp; region into ready-to-create tripsheets</p>
            <span class="ai-badge suggests-badge">Smart Batching</span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tripsheet-type-dialog {
      min-width: 750px;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #1976d2, #1565c0);
      color: white;
      margin: -24px -24px 0;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 22px;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      padding: 32px 8px;
    }
    .subtitle {
      text-align: center;
      color: #666;
      margin: 0 0 28px;
      font-size: 15px;
    }
    .type-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
    }
    .type-card {
      border: 2px solid #e0e0e0;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      min-height: 180px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .type-card:hover {
      border-color: #1976d2;
      background: #f5f9ff;
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(25, 118, 210, 0.2);
    }
    .type-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    .type-icon mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: white;
    }
    .type-icon.import {
      background: linear-gradient(135deg, #4caf50, #43a047);
    }
    .type-icon.automatic {
      background: linear-gradient(135deg, #2196f3, #1976d2);
    }
    .type-icon.manual {
      background: linear-gradient(135deg, #ff9800, #f57c00);
    }
    .type-icon.transfer {
      background: linear-gradient(135deg, #9c27b0, #7b1fa2);
    }
    .type-icon.welly {
      background: linear-gradient(135deg, #00bcd4, #0097a7);
    }
    .type-icon.suggests {
      background: linear-gradient(135deg, #ff6f00, #e65100);
    }
    .suggests-card {
      border-color: #ffe0b2;
      background: linear-gradient(135deg, #fff3e0, #fff);
    }
    .suggests-card:hover {
      border-color: #ff6f00 !important;
      background: linear-gradient(135deg, #ffe0b2, #fff3e0) !important;
      box-shadow: 0 6px 16px rgba(255, 111, 0, 0.3) !important;
    }
    .suggests-badge {
      background: linear-gradient(135deg, #ff6f00, #e65100) !important;
    }
    .welly-card {
      border-color: #b2ebf2;
      background: linear-gradient(135deg, #e0f7fa, #fff);
    }
    .welly-card:hover {
      border-color: #00bcd4 !important;
      background: linear-gradient(135deg, #b2ebf2, #e0f7fa) !important;
      box-shadow: 0 6px 16px rgba(0, 188, 212, 0.3) !important;
    }
    .ai-badge {
      display: inline-block;
      background: linear-gradient(135deg, #00bcd4, #0097a7);
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 12px;
      margin-top: 8px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .type-card h3 {
      margin: 0 0 8px;
      font-size: 16px;
      color: #333;
    }
    .type-card p {
      margin: 0;
      font-size: 13px;
      color: #666;
      line-height: 1.4;
    }
  `]
})
export class TripsheetTypeDialog {
  constructor(
    public dialogRef: MatDialogRef<TripsheetTypeDialog>
  ) {}

  selectType(type: 'import' | 'pad' | 'manual' | 'transfer' | 'welly' | 'welly-suggests' | 'ai-builder'): void {
    this.dialogRef.close({ type });
  }
}

// Manual Tripsheet Dialog - Create tripsheet without linking to system invoices
@Component({
  selector: 'manual-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatAutocompleteModule
  ],
  template: `
    <div class="manual-tripsheet-dialog">
      <div class="dialog-header">
        <h2><mat-icon>edit_note</mat-icon> Manual Trip Sheet</h2>
        <span class="subtitle">Create a trip sheet without linking to system invoices</span>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Route Configuration -->
        <div class="config-section">
          <h3><mat-icon>route</mat-icon> Route Configuration</h3>
          <div class="config-grid">
            <mat-form-field appearance="outline">
              <mat-label>Pickup Warehouse</mat-label>
              <input matInput 
                     [(ngModel)]="warehouseSearchText"
                     [matAutocomplete]="warehouseAuto"
                     (input)="filterWarehouses()"
                     (focus)="filterWarehouses()"
                     placeholder="Type to search warehouses..."
                     required>
              <mat-autocomplete #warehouseAuto="matAutocomplete" 
                               [displayWith]="displayWarehouse.bind(this)"
                               (optionSelected)="onWarehouseAutocompleteSelected($event)">
                @for (wh of filteredWarehouses; track wh.id) {
                  <mat-option [value]="wh">{{ wh.name }} - {{ wh.city }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>warehouse</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Driver</mat-label>
              <input matInput 
                     [(ngModel)]="driverSearchText"
                     [matAutocomplete]="driverAuto"
                     (input)="filterDrivers()"
                     (focus)="filterDrivers()"
                     placeholder="Type to search drivers...">
              <mat-autocomplete #driverAuto="matAutocomplete" 
                               [displayWith]="displayDriver.bind(this)"
                               (optionSelected)="onDriverAutocompleteSelected($event)">
                <mat-option [value]="null">-- Unassigned --</mat-option>
                @for (driver of filteredDrivers; track driver.id) {
                  <mat-option [value]="driver">{{ driver.firstName }} {{ driver.lastName }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>person</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Vehicle</mat-label>
              <input matInput 
                     [(ngModel)]="vehicleSearchText"
                     [matAutocomplete]="vehicleAuto"
                     (input)="filterVehicles()"
                     (focus)="filterVehicles()"
                     placeholder="Type to search vehicles...">
              <mat-autocomplete #vehicleAuto="matAutocomplete" 
                               [displayWith]="displayVehicle.bind(this)"
                               (optionSelected)="onVehicleAutocompleteSelected($event)">
                <mat-option [value]="null">-- Unassigned --</mat-option>
                @for (vehicle of filteredVehicles; track vehicle.id) {
                  <mat-option [value]="vehicle">{{ vehicle.registrationNumber }} - {{ vehicle.make }} {{ vehicle.model }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>local_shipping</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Scheduled Date</mat-label>
              <input matInput [matDatepicker]="picker" [(ngModel)]="scheduledDate">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Manual Line Items -->
        <div class="items-section">
          <div class="section-header">
            <h3><mat-icon>list_alt</mat-icon> Delivery Items ({{ lineItems.length }})</h3>
            <button mat-raised-button color="primary" (click)="addLineItem()">
              <mat-icon>add</mat-icon> Add Item
            </button>
          </div>

          <div class="items-list">
            @for (item of lineItems; track item.id; let i = $index) {
              <div class="line-item">
                <div class="item-number">{{ i + 1 }}</div>
                <div class="item-fields">
                  <mat-form-field appearance="outline" class="field-invoice">
                    <mat-label>Invoice Number</mat-label>
                    <input matInput [(ngModel)]="item.invoiceNumber" placeholder="e.g., INV-001">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-customer">
                    <mat-label>Customer Name</mat-label>
                    <input matInput [(ngModel)]="item.customerName" 
                           [matAutocomplete]="autoCustomer"
                           (input)="filterCustomers(item, $event)"
                           placeholder="Start typing...">
                    <mat-autocomplete #autoCustomer="matAutocomplete" (optionSelected)="onCustomerSelected(item, $event)">
                      @for (customer of filteredCustomers; track customer.id) {
                        <mat-option [value]="customer.name">{{ customer.name }}</mat-option>
                      }
                    </mat-autocomplete>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-address">
                    <mat-label>Delivery Address</mat-label>
                    <input matInput [(ngModel)]="item.deliveryAddress" placeholder="Full address">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-product">
                    <mat-label>Product/Commodity</mat-label>
                    <input matInput [(ngModel)]="item.productDescription" placeholder="e.g., Medical Supplies">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-qty">
                    <mat-label>Qty</mat-label>
                    <input matInput type="number" [(ngModel)]="item.quantity" min="1">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-value">
                    <mat-label>Value (R)</mat-label>
                    <input matInput type="number" [(ngModel)]="item.value" min="0" step="0.01">
                  </mat-form-field>
                </div>
                <button mat-icon-button color="warn" (click)="removeLineItem(i)" matTooltip="Remove item">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }

            @if (lineItems.length === 0) {
              <div class="empty-items">
                <mat-icon>inventory_2</mat-icon>
                <p>No items added yet. Click "Add Item" to add delivery items.</p>
              </div>
            }
          </div>
        </div>

        <!-- Summary -->
        @if (lineItems.length > 0) {
          <div class="summary-section">
            <div class="summary-item">
              <span class="label">Total Items:</span>
              <span class="value">{{ lineItems.length }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Total Quantity:</span>
              <span class="value">{{ getTotalQuantity() }}</span>
            </div>
            <div class="summary-item highlight">
              <span class="label">Total:</span>
              <span class="value">R {{ getTotalValue() | number:'1.2-2' }}</span>
            </div>
          </div>
        }

        <!-- Special Instructions -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Special Instructions</mat-label>
          <textarea matInput [(ngModel)]="specialInstructions" rows="2" placeholder="Any special delivery instructions..."></textarea>
        </mat-form-field>
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" 
                (click)="createTripsheet()" 
                [matTooltip]="validationReason()"
                [disabled]="creating || !isValid()">
          @if (creating) {
            <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
          }
          {{ creating ? 'Creating...' : 'Create Trip Sheet' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .manual-tripsheet-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #ff9800, #f57c00);
      color: white;
      margin: -24px -24px 0;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
    }
    .dialog-header .subtitle {
      flex: 1;
      font-size: 13px;
      opacity: 0.9;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }
    .config-section, .items-section {
      margin-bottom: 24px;
    }
    .config-section h3, .items-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      color: #1976d2;
    }
    .config-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .section-header h3 {
      margin: 0;
    }
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .line-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    .item-number {
      width: 32px;
      height: 32px;
      background: #1976d2;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      flex-shrink: 0;
    }
    .item-fields {
      flex: 1;
      display: grid;
      grid-template-columns: 120px 1fr 1fr 1fr 80px 100px;
      gap: 12px;
      align-items: start;
    }
    .item-fields mat-form-field {
      width: 100%;
    }
    .empty-items {
      text-align: center;
      padding: 48px;
      color: #999;
    }
    .empty-items mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }
    .summary-section {
      display: flex;
      gap: 32px;
      padding: 16px;
      background: #e3f2fd;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .summary-item {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .summary-item .label {
      color: #666;
    }
    .summary-item .value {
      font-weight: 600;
      color: #1976d2;
    }
    .full-width {
      width: 100%;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      margin: 0 -24px -24px;
      background: #fafafa;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    mat-divider {
      margin: 24px 0;
    }
  `]
})
export class ManualTripsheetDialog {
  selectedWarehouse: any = null;
  selectedDriver: any = null;
  selectedVehicle: any = null;
  scheduledDate: Date = new Date();
  specialInstructions = '';
  creating = false;
  
  lineItems: any[] = [];
  filteredCustomers: any[] = [];
  
  // Searchable dropdown properties
  warehouseSearchText = '';
  driverSearchText = '';
  vehicleSearchText = '';
  filteredWarehouses: any[] = [];
  filteredDrivers: any[] = [];
  filteredVehicles: any[] = [];
  
  private itemIdCounter = 0;

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<ManualTripsheetDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {
      drivers: any[],
      vehicles: any[],
      warehouses: any[],
      customers: any[],
      apiUrl: string
    }
  ) {
    // Initialize filtered arrays for searchable dropdowns
    this.filteredWarehouses = [...(data.warehouses || [])];
    this.filteredDrivers = [...(data.drivers || [])];
    this.filteredVehicles = [...(data.vehicles || [])];
    
    // Set default warehouse
    if (data.warehouses?.length > 0) {
      this.selectedWarehouse = data.warehouses[0];
      this.warehouseSearchText = data.warehouses[0].name || '';
    }
    // Add one empty line item to start
    this.addLineItem();
  }
  
  // Filter methods for searchable dropdowns
  filterWarehouses(): void {
    const searchValue = this.warehouseSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredWarehouses = search 
      ? (this.data.warehouses || []).filter(wh => 
          wh.name?.toLowerCase().includes(search) || 
          wh.city?.toLowerCase().includes(search)
        )
      : [...(this.data.warehouses || [])];
  }

  filterDrivers(): void {
    const searchValue = this.driverSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredDrivers = search 
      ? (this.data.drivers || []).filter(d => 
          d.firstName?.toLowerCase().includes(search) || 
          d.lastName?.toLowerCase().includes(search) ||
          `${d.firstName} ${d.lastName}`.toLowerCase().includes(search)
        )
      : [...(this.data.drivers || [])];
  }

  filterVehicles(): void {
    const searchValue = this.vehicleSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredVehicles = search 
      ? (this.data.vehicles || []).filter(v => 
          v.registrationNumber?.toLowerCase().includes(search) || 
          v.make?.toLowerCase().includes(search) ||
          v.model?.toLowerCase().includes(search)
        )
      : [...(this.data.vehicles || [])];
  }

  displayWarehouse(warehouse: any): string {
    return warehouse ? `${warehouse.name} - ${warehouse.city}` : '';
  }

  displayDriver(driver: any): string {
    if (!driver) return '';
    if (typeof driver === 'string') return driver;
    return `${driver.firstName || ''} ${driver.lastName || ''}`.trim();
  }

  displayVehicle(vehicle: any): string {
    if (!vehicle) return '';
    if (typeof vehicle === 'string') return vehicle;
    return `${vehicle.registrationNumber || ''} - ${vehicle.make || ''} ${vehicle.model || ''}`.trim();
  }

  onWarehouseAutocompleteSelected(event: any): void {
    this.selectedWarehouse = event.option.value;
  }

  onDriverAutocompleteSelected(event: any): void {
    this.selectedDriver = event.option.value;
  }

  onVehicleAutocompleteSelected(event: any): void {
    this.selectedVehicle = event.option.value;
  }

  addLineItem(): void {
    this.lineItems.push({
      id: ++this.itemIdCounter,
      invoiceNumber: '',
      customerName: '',
      deliveryAddress: '',
      productDescription: '',
      quantity: 1,
      value: 0
    });
  }

  removeLineItem(index: number): void {
    this.lineItems.splice(index, 1);
  }

  filterCustomers(item: any, event: any): void {
    const query = event.target.value?.toLowerCase() || '';
    if (query.length < 2) {
      this.filteredCustomers = [];
      return;
    }
    this.filteredCustomers = (this.data.customers || [])
      .filter(c => c.name?.toLowerCase().includes(query))
      .slice(0, 10);
  }

  onCustomerSelected(item: any, event: any): void {
    const customer = this.data.customers?.find(c => c.name === event.option.value);
    if (customer) {
      item.customerName = customer.name;
      item.deliveryAddress = customer.address || customer.deliveryAddress || '';
    }
  }

  getTotalQuantity(): number {
    return this.lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }

  getTotalValue(): number {
    return this.lineItems.reduce((sum, item) => sum + (item.value || 0), 0);
  }

  isValid(): boolean {
    return !this.validationReason();
  }

  // Human-readable reason the manual trip sheet cannot be created yet.
  validationReason(): string {
    if (!this.selectedWarehouse) return 'Select a pickup warehouse.';
    if (this.lineItems.length === 0 || !this.lineItems.some(item => item.customerName || item.invoiceNumber)) {
      return 'Add at least one line item with a customer or invoice number.';
    }
    if (!this.selectedDriver) return 'Assign a driver \u2014 a trip sheet cannot leave a driver unassigned.';
    if (!this.selectedVehicle) return 'Assign a vehicle \u2014 a trip sheet cannot leave a vehicle unassigned.';
    const d = this.scheduledDate ? new Date(this.scheduledDate) : null;
    if (!d || isNaN(d.getTime())) return 'Choose a valid scheduled date.';
    const missingAddr = this.lineItems.filter(item => (item.customerName || item.invoiceNumber) && !((item.deliveryAddress || '').toString().trim())).length;
    if (missingAddr > 0) return `${missingAddr} line item${missingAddr > 1 ? 's' : ''} still need a delivery address.`;
    return '';
  }

  /**
   * Convert the picked scheduled date to a local (non-UTC) ISO string so the
   * chosen calendar day is preserved. Using the raw Date / toISOString() would
   * shift the day backwards for UTC+ timezones (e.g. SAST/UTC+2), causing e.g.
   * "29 Sep" to be stored and displayed as "28 Sep".
   */
  private toLocalScheduledIso(value: any): string | null {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    // Anchor to midday so no timezone rendering can cross a day boundary.
    d.setHours(12, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T12:00:00`;
  }

  createTripsheet(): void {
    const reason = this.validationReason();
    if (reason) {
      this.snackBar.open(reason, 'Close', { duration: 5000 });
      return;
    }    
    this.creating = true;
    
    const tripsheetData = {
      warehouseId: this.selectedWarehouse?.id,
      origin: this.selectedWarehouse?.name,
      driverId: this.selectedDriver?.id,
      vehicleId: this.selectedVehicle?.id,
      scheduledDate: this.toLocalScheduledIso(this.scheduledDate),
      specialInstructions: this.specialInstructions,
      isManual: true,
      lineItems: this.lineItems.map((item, index) => ({
        sequence: index + 1,
        invoiceNumber: item.invoiceNumber || `MAN-${Date.now()}-${index + 1}`,
        customerName: item.customerName,
        deliveryAddress: item.deliveryAddress,
        productDescription: item.productDescription,
        quantity: item.quantity,
        value: item.value
      }))
    };

    this.http.post(`${this.data.apiUrl}/logistics/tripsheet/manual`, tripsheetData).subscribe({
      next: (response: any) => {
        this.creating = false;
        this.dialogRef.close({ created: true, tripsheetId: response.loadId });
      },
      error: (error) => {
        console.error('Error creating manual tripsheet:', error);
        this.creating = false;
        // For now, close with success anyway (API might not exist yet)
        this.dialogRef.close({ created: true });
      }
    });
  }
}

// Internal Transfer Dialog - Warehouse to Warehouse stock movement
@Component({
  selector: 'internal-transfer-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatAutocompleteModule
  ],
  template: `
    <div class="transfer-dialog">
      <div class="dialog-header">
        <h2><mat-icon>swap_horiz</mat-icon> Internal Stock Transfer</h2>
        <span class="subtitle">Move stock between warehouses</span>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <!-- Transfer Route -->
        <div class="transfer-route">
          <div class="route-point">
            <div class="point-icon from">
              <mat-icon>warehouse</mat-icon>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>From Warehouse</mat-label>
              <input matInput 
                     [(ngModel)]="fromWarehouseSearchText"
                     [matAutocomplete]="fromWarehouseAuto"
                     (input)="filterFromWarehouses()"
                     (focus)="filterFromWarehouses()"
                     placeholder="Type to search..."
                     required>
              <mat-autocomplete #fromWarehouseAuto="matAutocomplete" 
                               [displayWith]="displayWarehouse.bind(this)"
                               (optionSelected)="onFromWarehouseSelected($event)">
                @for (wh of filteredFromWarehouses; track wh.id) {
                  <mat-option [value]="wh">{{ wh.name }} - {{ wh.city }}</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          </div>

          <div class="route-arrow">
            <mat-icon>arrow_forward</mat-icon>
          </div>

          <div class="route-point">
            <div class="point-icon to">
              <mat-icon>warehouse</mat-icon>
            </div>
            <mat-form-field appearance="outline">
              <mat-label>To Warehouse</mat-label>
              <input matInput 
                     [(ngModel)]="toWarehouseSearchText"
                     [matAutocomplete]="toWarehouseAuto"
                     (input)="filterToWarehouses()"
                     (focus)="filterToWarehouses()"
                     placeholder="Type to search..."
                     required>
              <mat-autocomplete #toWarehouseAuto="matAutocomplete" 
                               [displayWith]="displayWarehouse.bind(this)"
                               (optionSelected)="onToWarehouseSelected($event)">
                @for (wh of filteredToWarehouses; track wh.id) {
                  <mat-option [value]="wh">{{ wh.name }} - {{ wh.city }}</mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Assignment -->
        <div class="assignment-section">
          <h3><mat-icon>local_shipping</mat-icon> Transport Assignment</h3>
          <div class="assignment-grid">
            <mat-form-field appearance="outline">
              <mat-label>Driver</mat-label>
              <input matInput 
                     [(ngModel)]="driverSearchText"
                     [matAutocomplete]="driverAuto"
                     (input)="filterDrivers()"
                     (focus)="filterDrivers()"
                     placeholder="Type to search drivers...">
              <mat-autocomplete #driverAuto="matAutocomplete" 
                               [displayWith]="displayDriver.bind(this)"
                               (optionSelected)="onDriverAutocompleteSelected($event)">
                <mat-option [value]="null">-- Unassigned --</mat-option>
                @for (driver of filteredDrivers; track driver.id) {
                  <mat-option [value]="driver">{{ driver.firstName }} {{ driver.lastName }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>person</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Vehicle</mat-label>
              <input matInput 
                     [(ngModel)]="vehicleSearchText"
                     [matAutocomplete]="vehicleAuto"
                     (input)="filterVehicles()"
                     (focus)="filterVehicles()"
                     placeholder="Type to search vehicles...">
              <mat-autocomplete #vehicleAuto="matAutocomplete" 
                               [displayWith]="displayVehicle.bind(this)"
                               (optionSelected)="onVehicleAutocompleteSelected($event)">
                <mat-option [value]="null">-- Unassigned --</mat-option>
                @for (vehicle of filteredVehicles; track vehicle.id) {
                  <mat-option [value]="vehicle">{{ vehicle.registrationNumber }} - {{ vehicle.make }} {{ vehicle.model }}</mat-option>
                }
              </mat-autocomplete>
              <mat-icon matSuffix>local_shipping</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Transfer Date</mat-label>
              <input matInput [matDatepicker]="picker" [(ngModel)]="transferDate">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Transfer Reference</mat-label>
              <input matInput [(ngModel)]="transferReference" placeholder="e.g., TRF-001">
            </mat-form-field>
          </div>
        </div>

        <mat-divider></mat-divider>

        <!-- Transfer Items -->
        <div class="items-section">
          <div class="section-header">
            <h3><mat-icon>inventory</mat-icon> Transfer Items ({{ transferItems.length }})</h3>
            <button mat-raised-button color="primary" (click)="addTransferItem()">
              <mat-icon>add</mat-icon> Add Item
            </button>
          </div>

          <div class="items-list">
            @for (item of transferItems; track item.id; let i = $index) {
              <div class="transfer-item">
                <div class="item-number">{{ i + 1 }}</div>
                <div class="item-fields">
                  <mat-form-field appearance="outline" class="field-code">
                    <mat-label>Item Code/SKU</mat-label>
                    <input matInput [(ngModel)]="item.itemCode" placeholder="e.g., MED-001">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-desc">
                    <mat-label>Description</mat-label>
                    <input matInput [(ngModel)]="item.description" placeholder="Item description">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-qty">
                    <mat-label>Quantity</mat-label>
                    <input matInput type="number" [(ngModel)]="item.quantity" min="1">
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="field-uom">
                    <mat-label>UOM</mat-label>
                    <mat-select [(ngModel)]="item.uom">
                      <mat-option value="EA">EA (Each)</mat-option>
                      <mat-option value="BOX">BOX</mat-option>
                      <mat-option value="CS">CS (Case)</mat-option>
                      <mat-option value="PAL">PAL (Pallet)</mat-option>
                      <mat-option value="KG">KG</mat-option>
                      <mat-option value="L">L (Liters)</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
                <button mat-icon-button color="warn" (click)="removeTransferItem(i)" matTooltip="Remove item">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            }

            @if (transferItems.length === 0) {
              <div class="empty-items">
                <mat-icon>inventory_2</mat-icon>
                <p>No items added yet. Click "Add Item" to add stock items for transfer.</p>
              </div>
            }
          </div>
        </div>

        <!-- Notes -->
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Transfer Notes</mat-label>
          <textarea matInput [(ngModel)]="notes" rows="2" placeholder="Any notes about this transfer..."></textarea>
        </mat-form-field>
      </div>

      <div class="dialog-actions">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" 
                (click)="createTransfer()" 
                [disabled]="creating || !isValid()">
          @if (creating) {
            <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
          }
          {{ creating ? 'Creating...' : 'Create Transfer' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .transfer-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #9c27b0, #7b1fa2);
      color: white;
      margin: -24px -24px 0;
    }
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 20px;
    }
    .dialog-header .subtitle {
      flex: 1;
      font-size: 13px;
      opacity: 0.9;
    }
    .dialog-header button {
      color: white;
    }
    .dialog-content {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
    }
    .transfer-route {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 24px;
      background: #f5f5f5;
      border-radius: 12px;
      margin-bottom: 24px;
    }
    .route-point {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .point-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .point-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }
    .point-icon.from {
      background: linear-gradient(135deg, #f44336, #d32f2f);
    }
    .point-icon.to {
      background: linear-gradient(135deg, #4caf50, #388e3c);
    }
    .route-arrow {
      display: flex;
      align-items: center;
      padding: 0 16px;
    }
    .route-arrow mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #9c27b0;
    }
    .route-point mat-form-field {
      width: 250px;
    }
    .assignment-section, .items-section {
      margin-bottom: 24px;
    }
    .assignment-section h3, .items-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 16px;
      color: #9c27b0;
    }
    .assignment-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .section-header h3 {
      margin: 0;
    }
    .items-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .transfer-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    .item-number {
      width: 32px;
      height: 32px;
      background: #9c27b0;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      flex-shrink: 0;
    }
    .item-fields {
      flex: 1;
      display: grid;
      grid-template-columns: 150px 1fr 100px 120px;
      gap: 12px;
      align-items: start;
    }
    .item-fields mat-form-field {
      width: 100%;
    }
    .empty-items {
      text-align: center;
      padding: 48px;
      color: #999;
    }
    .empty-items mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }
    .full-width {
      width: 100%;
    }
    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
      margin: 0 -24px -24px;
      background: #fafafa;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    mat-divider {
      margin: 24px 0;
    }
  `]
})
export class InternalTransferDialog {
  fromWarehouse: any = null;
  toWarehouse: any = null;
  selectedDriver: any = null;
  selectedVehicle: any = null;
  transferDate: Date = new Date();
  transferReference = '';
  notes = '';
  creating = false;
  
  transferItems: any[] = [];
  
  // Searchable dropdown properties
  fromWarehouseSearchText = '';
  toWarehouseSearchText = '';
  driverSearchText = '';
  vehicleSearchText = '';
  filteredFromWarehouses: any[] = [];
  filteredToWarehouses: any[] = [];
  filteredDrivers: any[] = [];
  filteredVehicles: any[] = [];
  
  private itemIdCounter = 0;

  constructor(
    private http: HttpClient,
    public dialogRef: MatDialogRef<InternalTransferDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {
      drivers: any[],
      vehicles: any[],
      warehouses: any[],
      apiUrl: string
    }
  ) {
    // Initialize filtered arrays
    this.filteredFromWarehouses = [...(data.warehouses || [])];
    this.filteredToWarehouses = [...(data.warehouses || [])];
    this.filteredDrivers = [...(data.drivers || [])];
    this.filteredVehicles = [...(data.vehicles || [])];
    
    // Set default warehouses if available
    if (data.warehouses?.length >= 2) {
      this.fromWarehouse = data.warehouses[0];
      this.fromWarehouseSearchText = `${data.warehouses[0].name} - ${data.warehouses[0].city}`;
      this.toWarehouse = data.warehouses[1];
      this.toWarehouseSearchText = `${data.warehouses[1].name} - ${data.warehouses[1].city}`;
    }
    // Generate transfer reference
    this.transferReference = `TRF-${Date.now().toString().slice(-6)}`;
    // Add one empty line item
    this.addTransferItem();
  }

  // Filter methods for searchable dropdowns
  filterFromWarehouses(): void {
    const searchValue = this.fromWarehouseSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredFromWarehouses = search 
      ? (this.data.warehouses || []).filter(wh => 
          (wh.name?.toLowerCase().includes(search) || 
          wh.city?.toLowerCase().includes(search)) && 
          wh.id !== this.toWarehouse?.id
        )
      : (this.data.warehouses || []).filter(wh => wh.id !== this.toWarehouse?.id);
  }

  filterToWarehouses(): void {
    const searchValue = this.toWarehouseSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredToWarehouses = search 
      ? (this.data.warehouses || []).filter(wh => 
          (wh.name?.toLowerCase().includes(search) || 
          wh.city?.toLowerCase().includes(search)) && 
          wh.id !== this.fromWarehouse?.id
        )
      : (this.data.warehouses || []).filter(wh => wh.id !== this.fromWarehouse?.id);
  }

  filterDrivers(): void {
    const searchValue = this.driverSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredDrivers = search 
      ? (this.data.drivers || []).filter(d => 
          d.firstName?.toLowerCase().includes(search) || 
          d.lastName?.toLowerCase().includes(search) ||
          `${d.firstName} ${d.lastName}`.toLowerCase().includes(search)
        )
      : [...(this.data.drivers || [])];
  }

  filterVehicles(): void {
    const searchValue = this.vehicleSearchText;
    const search = typeof searchValue === 'string' ? searchValue.toLowerCase() : '';
    this.filteredVehicles = search 
      ? (this.data.vehicles || []).filter(v => 
          v.registrationNumber?.toLowerCase().includes(search) || 
          v.make?.toLowerCase().includes(search) ||
          v.model?.toLowerCase().includes(search)
        )
      : [...(this.data.vehicles || [])];
  }

  displayWarehouse(warehouse: any): string {
    return warehouse ? `${warehouse.name} - ${warehouse.city}` : '';
  }

  displayDriver(driver: any): string {
    if (!driver) return '';
    if (typeof driver === 'string') return driver;
    return `${driver.firstName || ''} ${driver.lastName || ''}`.trim();
  }

  displayVehicle(vehicle: any): string {
    if (!vehicle) return '';
    if (typeof vehicle === 'string') return vehicle;
    return `${vehicle.registrationNumber || ''} - ${vehicle.make || ''} ${vehicle.model || ''}`.trim();
  }

  onFromWarehouseSelected(event: any): void {
    this.fromWarehouse = event.option.value;
    this.filterToWarehouses(); // Update to-warehouse list
  }

  onToWarehouseSelected(event: any): void {
    this.toWarehouse = event.option.value;
    this.filterFromWarehouses(); // Update from-warehouse list
  }

  onDriverAutocompleteSelected(event: any): void {
    this.selectedDriver = event.option.value;
  }

  onVehicleAutocompleteSelected(event: any): void {
    this.selectedVehicle = event.option.value;
  }

  onFromWarehouseChange(): void {
    // Clear toWarehouse if same as fromWarehouse
    if (this.toWarehouse?.id === this.fromWarehouse?.id) {
      this.toWarehouse = null;
      this.toWarehouseSearchText = '';
    }
  }

  addTransferItem(): void {
    this.transferItems.push({
      id: ++this.itemIdCounter,
      itemCode: '',
      description: '',
      quantity: 1,
      uom: 'EA'
    });
  }

  removeTransferItem(index: number): void {
    this.transferItems.splice(index, 1);
  }

  isValid(): boolean {
    return this.fromWarehouse && 
           this.toWarehouse && 
           this.fromWarehouse.id !== this.toWarehouse.id &&
           this.transferItems.length > 0 &&
           this.transferItems.some(item => item.itemCode || item.description);
  }

  createTransfer(): void {
    if (!this.isValid()) return;
    
    this.creating = true;
    
    const transferData = {
      fromWarehouseId: this.fromWarehouse?.id,
      toWarehouseId: this.toWarehouse?.id,
      fromWarehouseName: this.fromWarehouse?.name,
      toWarehouseName: this.toWarehouse?.name,
      driverId: this.selectedDriver?.id,
      vehicleId: this.selectedVehicle?.id,
      transferDate: this.transferDate,
      transferReference: this.transferReference,
      notes: this.notes,
      isInternalTransfer: true,
      items: this.transferItems.map((item, index) => ({
        sequence: index + 1,
        itemCode: item.itemCode,
        description: item.description,
        quantity: item.quantity,
        uom: item.uom
      }))
    };

    this.http.post(`${this.data.apiUrl}/logistics/tripsheet/transfer`, transferData).subscribe({
      next: (response: any) => {
        this.creating = false;
        this.dialogRef.close({ created: true, transferId: response.loadId });
      },
      error: (error) => {
        console.error('Error creating internal transfer:', error);
        this.creating = false;
        // For now, close with success anyway (API might not exist yet)
        this.dialogRef.close({ created: true });
      }
    });
  }
}

// Import Tripsheet Dialog with Smart Matching
@Component({
  selector: 'import-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    MatSelectModule,
    MatChipsModule,
    MatBadgeModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data.padMode ? 'receipt_long' : 'upload_file' }}</mat-icon>
      {{ data.padMode ? 'Import DN Tripsheet from Excel' : 'Import Tripsheet from Excel' }}
    </h2>
    <mat-dialog-content>
      <div class="import-container">
        <!-- Step 1: Upload -->
        @if (step === 'upload') {
          <div class="upload-section" [class.has-file]="selectedFile">
            <div class="drop-zone" 
                 (dragover)="onDragOver($event)" 
                 (dragleave)="onDragLeave($event)" 
                 (drop)="onDrop($event)"
                 [class.drag-over]="isDragOver"
                 (click)="fileInput.click()">
              @if (!selectedFile) {
                <mat-icon class="upload-icon">cloud_upload</mat-icon>
                <p class="upload-text">Drag & drop an Excel file here</p>
                <p class="upload-hint">or click to browse</p>
                <p class="file-types">Supported format: .xlsx (max 10MB)</p>
              } @else {
                <mat-icon class="file-icon">description</mat-icon>
                <p class="file-name">{{ selectedFile.name }}</p>
                <p class="file-size">{{ formatFileSize(selectedFile.size) }}</p>
                <button mat-icon-button class="remove-file" (click)="removeFile($event)">
                  <mat-icon>close</mat-icon>
                </button>
              }
            </div>
            <input #fileInput type="file" accept=".xlsx" (change)="onFileSelected($event)" hidden>
          </div>

          @if (uploading) {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            <p class="uploading-text">Analyzing Excel file and matching records...</p>
          }

          @if (uploadError) {
            <div class="error-message">
              <mat-icon>error</mat-icon>
              {{ uploadError }}
            </div>
          }

          <div class="info-section">
            <h4><mat-icon>info</mat-icon> Supported Trip Sheet Formats</h4>
            <p class="info-text">The system will automatically detect invoice rows (e.g., IN161765) and extract delivery information including customer name, address, product details, and amounts.</p>
            <div class="column-list">
              <div class="column-item required">
                <span class="column-name">INV NO.</span>
                <span class="column-desc">Invoice number (required)</span>
              </div>
              <div class="column-item required">
                <span class="column-name">CUSTOMER NAME</span>
                <span class="column-desc">Customer/Company name</span>
              </div>
              <div class="column-item required">
                <span class="column-name">Address</span>
                <span class="column-desc">Delivery address (can be multi-line)</span>
              </div>
              <div class="column-item">
                <span class="column-name">PRODUCT</span>
                <span class="column-desc">Product description</span>
              </div>
              <div class="column-item">
                <span class="column-name">QTY</span>
                <span class="column-desc">Quantity</span>
              </div>
              <div class="column-item">
                <span class="column-name">VALUE</span>
                <span class="column-desc">Invoice amount</span>
              </div>
            </div>
          </div>
        }

        <!-- Step 2: Preview & Review -->
        @if (step === 'preview' && previewResponse) {
          <div class="preview-header">
            <div class="preview-summary">
              <h3>Import Preview: {{ previewResponse.fileName }}</h3>
              @if (data.padMode) {
                <div class="manual-tripsheet-notice" style="background:#e8f5e9; border-color:#4caf50;">
                  <mat-icon>receipt_long</mat-icon>
                  <span><strong>DN Trip Sheet</strong> &mdash;
                    @if (previewResponse.matchedCount > 0 || previewResponse.partialMatchCount > 0) {
                      {{ previewResponse.matchedCount + previewResponse.partialMatchCount }} invoice(s) linked to the system, {{ previewResponse.unmatchedCount }} delivery note(s)/unmatched row(s) accepted as-is. All will go on the truck.
                    } @else {
                      No system invoices found &mdash; all {{ previewResponse.unmatchedCount }} rows accepted as delivery notes. Fill in addresses &amp; driver after import.
                    }
                  </span>
                </div>
              } @else if (isManualTripsheet()) {
                <div class="manual-tripsheet-notice">
                  <mat-icon>edit_note</mat-icon>
                  <span><strong>Manual Trip Sheet</strong> - No matching invoices found in system. This will create a manual tripsheet with the imported data.</span>
                </div>
              }
              <div class="summary-badges">
                <span class="badge matched" [matBadge]="previewResponse.matchedCount" matBadgeColor="primary">
                  <mat-icon>check_circle</mat-icon> Matched
                </span>
                <span class="badge partial" [matBadge]="previewResponse.partialMatchCount" matBadgeColor="accent">
                  <mat-icon>help</mat-icon> Review
                </span>
                <span class="badge unmatched" [matBadge]="previewResponse.unmatchedCount" matBadgeColor="warn">
                  <mat-icon>edit_note</mat-icon> Manual
                </span>
                @if (previewResponse.errorCount > 0) {
                  <span class="badge error" [matBadge]="previewResponse.errorCount" matBadgeColor="warn">
                    <mat-icon>error</mat-icon> Errors
                  </span>
                }
              </div>
            </div>
            <button mat-button (click)="step = 'upload'; previewResponse = null;">
              <mat-icon>arrow_back</mat-icon> Back
            </button>
          </div>

          <div class="preview-table-container">
            <table class="preview-table">
              <thead>
                <tr>
                  <th class="status-col">Status</th>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Address</th>
                  <th>Amount</th>
                  <th class="actions-col">Match</th>
                </tr>
              </thead>
              <tbody>
                @for (row of previewResponse.rows; track row.rowIndex) {
                  <tr [class.error-row]="row.status === 'Error'" 
                      [class.matched-row]="row.status === 'Matched'"
                      [class.partial-row]="row.status === 'PartialMatch'"
                      [class.unmatched-row]="row.status === 'Unmatched'">
                    <td class="status-col">
                      @switch (row.status) {
                        @case ('Matched') {
                          <mat-icon class="status-icon matched" matTooltip="Auto-matched to existing invoice">check_circle</mat-icon>
                        }
                        @case ('PartialMatch') {
                          <mat-icon class="status-icon partial" matTooltip="Needs review">help</mat-icon>
                        }
                        @case ('Unmatched') {
                          <mat-icon class="status-icon unmatched" matTooltip="Manual entry - no matching invoice in system">edit_note</mat-icon>
                        }
                        @case ('Error') {
                          <mat-icon class="status-icon error" matTooltip="{{ row.validationErrors?.join(', ') }}">error</mat-icon>
                        }
                      }
                    </td>
                    <td class="invoice-cell">{{ row.data?.invoiceNumber || '-' }}</td>
                    <td class="customer-cell">
                      {{ row.data?.customerName || '-' }}
                      @if (row.matchedCustomerId) {
                        <span class="match-badge">ID: {{ row.matchedCustomerId }}</span>
                      }
                    </td>
                    <td class="address-cell" [matTooltip]="row.data?.deliveryAddress || ''">
                      {{ (row.data?.deliveryAddress || '-') | slice:0:40 }}{{ (row.data?.deliveryAddress?.length || 0) > 40 ? '...' : '' }}
                    </td>
                    <td class="amount-cell">
                      @if (row.data?.salesAmount) {
                        R {{ row.data.salesAmount.toFixed(2) }}
                      } @else {
                        -
                      }
                    </td>
                    <td class="actions-col">
                      @if (row.status === 'PartialMatch' && row.suggestedCustomers?.length) {
                        <mat-form-field appearance="outline" class="match-select">
                          <mat-select [(value)]="row.selectedCustomerId" placeholder="Select match">
                            <mat-option [value]="null">Create New</mat-option>
                            @for (suggestion of row.suggestedCustomers; track suggestion.id) {
                              <mat-option [value]="suggestion.id">
                                {{ suggestion.displayName }} ({{ (suggestion.score * 100).toFixed(0) }}%)
                              </mat-option>
                            }
                          </mat-select>
                        </mat-form-field>
                      } @else if (row.confidenceScore) {
                        <span class="confidence">{{ (row.confidenceScore * 100).toFixed(0) }}%</span>
                      }
                    </td>
                  </tr>
                  @if (row.validationErrors?.length || row.warnings?.length) {
                    <tr class="message-row">
                      <td colspan="6">
                        @for (error of row.validationErrors || []; track error) {
                          <span class="validation-error"><mat-icon>error</mat-icon> {{ error }}</span>
                        }
                        @for (warning of row.warnings || []; track warning) {
                          <span class="validation-warning"><mat-icon>warning</mat-icon> {{ warning }}</span>
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (step === 'upload') {
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="previewFile()" 
                [disabled]="!selectedFile || uploading">
          <mat-icon>search</mat-icon>
          Preview Import
        </button>
      }
      @if (step === 'preview') {
        <button mat-button (click)="step = 'upload'">Back</button>
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button color="primary" (click)="proceedToCreateTripsheet()" 
                [disabled]="!hasValidRows()">
          <mat-icon>{{ isManualTripsheet() ? 'edit_note' : 'arrow_forward' }}</mat-icon>
          {{ isManualTripsheet() ? 'Create Manual Trip Sheet' : 'Create Trip Sheet' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .import-container {
      min-width: 800px;
      max-width: 1000px;
      padding: 16px 0;
    }
    .upload-section {
      margin-bottom: 16px;
    }
    .drop-zone {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;
    }
    .drop-zone:hover, .drop-zone.drag-over {
      border-color: #1976d2;
      background: #e3f2fd;
    }
    .upload-section.has-file .drop-zone {
      border-style: solid;
      border-color: #4caf50;
      background: #e8f5e9;
    }
    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #9e9e9e;
    }
    .drop-zone:hover .upload-icon, .drop-zone.drag-over .upload-icon {
      color: #1976d2;
    }
    .upload-text {
      margin: 8px 0 4px;
      font-size: 16px;
      color: #333;
    }
    .upload-hint {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .file-types {
      margin-top: 12px;
      font-size: 12px;
      color: #999;
    }
    .file-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #4caf50;
    }
    .file-name {
      margin: 8px 0 4px;
      font-size: 16px;
      font-weight: 500;
      color: #333;
    }
    .file-size {
      margin: 0;
      font-size: 14px;
      color: #666;
    }
    .remove-file {
      position: absolute;
      top: 8px;
      right: 8px;
    }
    .uploading-text {
      text-align: center;
      color: #666;
      margin-top: 8px;
    }
    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #ffebee;
      color: #c62828;
      border-radius: 4px;
      margin: 16px 0;
    }
    .info-section {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
    }
    .info-section h4 {
      margin: 0 0 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #1976d2;
    }
    .info-text {
      margin: 0 0 12px;
      font-size: 13px;
      color: #666;
    }
    .column-list {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .column-item {
      display: flex;
      flex-direction: column;
      padding: 8px;
      background: white;
      border-radius: 4px;
      border-left: 3px solid #e0e0e0;
    }
    .column-item.required {
      border-left-color: #f44336;
    }
    .column-name {
      font-family: monospace;
      font-weight: 600;
      font-size: 12px;
      color: #333;
    }
    .column-desc {
      font-size: 11px;
      color: #666;
    }
    
    /* Preview styles */
    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .preview-summary h3 {
      margin: 0 0 8px;
      font-size: 16px;
    }
    .manual-tripsheet-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
      border: 1px solid #2196f3;
      border-radius: 8px;
      margin-bottom: 12px;
      color: #1565c0;
    }
    .manual-tripsheet-notice mat-icon {
      color: #1976d2;
      font-size: 24px;
      width: 24px;
      height: 24px;
    }
    .manual-tripsheet-notice span {
      font-size: 13px;
      line-height: 1.4;
    }
    .summary-badges {
      display: flex;
      gap: 16px;
    }
    .badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      background: #f5f5f5;
    }
    .badge mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }
    .badge.matched mat-icon { color: #4caf50; }
    .badge.partial mat-icon { color: #ff9800; }
    .badge.unmatched mat-icon { color: #2196f3; }
    .badge.error mat-icon { color: #f44336; }
    
    .unmatched-row {
      background: #e3f2fd;
    }
    
    .preview-table-container {
      max-height: 400px;
      overflow-y: auto;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      margin-bottom: 16px;
    }
    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .preview-table th, .preview-table td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    .preview-table th {
      background: #f5f5f5;
      font-weight: 600;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .preview-table tr.error-row {
      background: #ffebee;
    }
    .preview-table tr.matched-row {
      background: #e8f5e9;
    }
    .preview-table tr.partial-row {
      background: #fff3e0;
    }
    .status-col {
      width: 50px;
      text-align: center;
    }
    .actions-col {
      width: 150px;
    }
    .status-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .status-icon.matched { color: #4caf50; }
    .status-icon.partial { color: #ff9800; }
    .status-icon.unmatched { color: #2196f3; }
    .status-icon.error { color: #f44336; }
    
    .invoice-cell {
      font-family: monospace;
      font-weight: 600;
    }
    .customer-cell {
      max-width: 200px;
    }
    .address-cell {
      max-width: 250px;
      font-size: 12px;
      color: #666;
    }
    .amount-cell {
      font-family: monospace;
      text-align: right;
    }
    .match-badge {
      display: inline-block;
      font-size: 10px;
      padding: 2px 6px;
      background: #e3f2fd;
      color: #1976d2;
      border-radius: 4px;
      margin-left: 4px;
    }
    .match-select {
      width: 100%;
      font-size: 12px;
    }
    .match-select ::ng-deep .mat-mdc-form-field-infix {
      padding: 4px 0 !important;
      min-height: 32px;
    }
    .confidence {
      font-size: 12px;
      color: #4caf50;
      font-weight: 600;
    }
    .message-row td {
      padding: 4px 12px !important;
      background: #fafafa;
    }
    .validation-error, .validation-warning {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      margin-right: 12px;
    }
    .validation-error {
      color: #c62828;
    }
    .validation-error mat-icon, .validation-warning mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }
    .validation-warning {
      color: #f57c00;
    }
    
    /* Success styles */
    .success-section {
      text-align: center;
      padding: 32px;
    }
    .success-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #4caf50;
    }
    .success-section h3 {
      margin: 16px 0 8px;
      font-size: 20px;
    }
    .success-message {
      color: #666;
      margin-bottom: 24px;
    }
    .result-stats {
      display: flex;
      justify-content: center;
      gap: 32px;
    }
    .stat {
      text-align: center;
    }
    .stat-value {
      display: block;
      font-size: 32px;
      font-weight: 600;
      color: #4caf50;
    }
    .stat.error .stat-value {
      color: #f44336;
    }
    .stat-label {
      font-size: 12px;
      color: #666;
    }
    .error-list {
      margin-top: 24px;
      text-align: left;
      background: #ffebee;
      padding: 12px;
      border-radius: 4px;
    }
    .error-list h4 {
      margin: 0 0 8px;
      color: #c62828;
    }
    .error-item {
      margin: 4px 0;
      font-size: 12px;
      color: #c62828;
    }
    
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon {
      color: #4caf50;
    }

    /* Assignment section styles */
    .assignment-section {
      padding: 16px 0;
    }
    .assignment-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 8px;
      font-size: 18px;
      color: #1976d2;
    }
    .assignment-info {
      margin: 0 0 16px;
      color: #666;
      font-size: 14px;
    }
    .assignment-form {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }
    .assignment-form .full-width {
      width: 100%;
    }
    .assignment-form mat-form-field {
      width: 100%;
    }
    .available-badge {
      display: inline-block;
      font-size: 10px;
      padding: 2px 6px;
      background: #e8f5e9;
      color: #4caf50;
      border-radius: 10px;
      margin-left: 8px;
    }
    .summary-card {
      background: #f5f5f5;
      border-radius: 8px;
      padding: 16px;
      border: 1px solid #e0e0e0;
    }
    .summary-card h4 {
      margin: 0 0 12px;
      font-size: 14px;
      color: #333;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .summary-row:last-child {
      border-bottom: none;
    }
    .summary-row span {
      color: #666;
    }
    .summary-row strong {
      color: #1976d2;
    }
  `]
})
export class ImportTripsheetDialog {
  step: 'upload' | 'preview' = 'upload';
  selectedFile: File | null = null;
  isDragOver = false;
  uploading = false;
  uploadError = '';
  previewResponse: any = null;

  constructor(
    private http: HttpClient,
    public dialogRef: MatDialogRef<ImportTripsheetDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { apiUrl: string; padMode?: boolean }
  ) {}

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver = false;
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  handleFile(file: File): void {
    if (!file.name.match(/\.xlsx$/i)) {
      this.uploadError = 'Please select an Excel file (.xlsx)';
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError = 'File size exceeds 10MB limit';
      return;
    }
    
    this.selectedFile = file;
    this.uploadError = '';
    this.previewResponse = null;
  }

  removeFile(event: Event): void {
    event.stopPropagation();
    this.selectedFile = null;
    this.previewResponse = null;
    this.uploadError = '';
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  previewFile(): void {
    if (!this.selectedFile) return;
    
    this.uploading = true;
    this.uploadError = '';
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    
    const url = `${this.data.apiUrl}/logistics/tripsheet/preview-import` +
      (this.data.padMode ? '?skipMatching=true' : '');
    this.http.post<any>(url, formData).subscribe({
      next: (response) => {
        this.previewResponse = response;
        // Initialize selectedCustomerId for partial matches
        if (response.rows) {
          response.rows.forEach((row: any) => {
            if (row.status === 'PartialMatch' && row.suggestedCustomers?.length) {
              row.selectedCustomerId = row.suggestedCustomers[0].id;
            } else if (row.matchedCustomerId) {
              row.selectedCustomerId = row.matchedCustomerId;
            }
          });
        }
        this.step = 'preview';
        this.uploading = false;
      },
      error: (err) => {
        this.uploadError = err.error?.message || 'Failed to parse Excel file';
        this.uploading = false;
      }
    });
  }

  hasValidRows(): boolean {
    return this.previewResponse?.rows?.some((r: any) => r.status !== 'Error') || false;
  }

  getValidRowCount(): number {
    return this.previewResponse?.rows?.filter((r: any) => r.status !== 'Error').length || 0;
  }

  getTotalValue(): number {
    if (!this.previewResponse?.rows) return 0;
    return this.previewResponse.rows
      .filter((r: any) => r.status !== 'Error')
      .reduce((sum: number, row: any) => sum + (row.data?.salesAmount || 0), 0);
  }

  // Check if this is a manual tripsheet (no matched invoices found in system)
  isManualTripsheet(): boolean {
    // DN Tripsheets may contain a mixture of real invoices and delivery notes —
    // if any rows matched, treat it as a normal (linked) tripsheet.
    if (!this.previewResponse) return this.data.padMode === true;
    // Manual tripsheet if no matched invoices AND we have unmatched rows
    return this.previewResponse.matchedCount === 0 && 
           this.previewResponse.partialMatchCount === 0 && 
           this.previewResponse.unmatchedCount > 0;
  }

  proceedToCreateTripsheet(): void {
    // Flag whether this is a manual tripsheet
    const isManual = this.isManualTripsheet();
    
    // Convert parsed rows to invoice-like objects for CreateTripsheetDialog
    const invoices = this.previewResponse.rows
      .filter((r: any) => r.status !== 'Error')
      .map((row: any, index: number) => ({
        id: `import-${index}`,  // Temporary ID for tracking
        transactionNumber: row.data?.invoiceNumber || `MAN-${index + 1}`,
        customerName: row.data?.customerName || 'Unknown Customer',
        customerNumber: row.data?.customerNumber,
        deliveryAddress: row.data?.deliveryAddress || '',
        address: row.data?.deliveryAddress || '',
        city: row.data?.city || '',
        province: row.data?.province || '',
        productDescription: row.data?.productDescription || 'Imported Product',
        productCode: row.data?.productCode,
        quantity: row.data?.quantity || 1,
        salesAmount: row.data?.salesAmount || 0,
        netSales: row.data?.salesAmount || 0,
        totalAmount: row.data?.salesAmount || 0,
        status: 'Pending',
        matchedCustomerId: row.selectedCustomerId || row.matchedCustomerId,
        contactPerson: row.data?.contactPerson,
        contactPhone: row.data?.contactPhone,
        // Source tracking
        isImported: true,
        isManualEntry: isManual || row.status === 'Unmatched',
        batchId: this.previewResponse.batchId,
        rowIndex: row.rowIndex
      }));
    
    // Close dialog and pass the converted data to open CreateTripsheetDialog
    this.dialogRef.close({
      openCreateDialog: true,
      invoices: invoices,
      batchId: this.previewResponse.batchId,
      fileName: this.previewResponse.fileName,
      isManualTripsheet: isManual
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

// Add Maintenance Dialog
@Component({
  selector: 'add-maintenance-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatAutocompleteModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>build</mat-icon>
      {{ data.record ? 'Edit' : 'Schedule' }} Maintenance
    </h2>
    <mat-dialog-content>
      <form class="maintenance-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vehicle</mat-label>
          <input matInput 
                 [matAutocomplete]="vehicleAuto" 
                 [formControl]="vehicleSearchControl"
                 placeholder="Type to search vehicle...">
          <mat-icon matSuffix>search</mat-icon>
          <mat-autocomplete #vehicleAuto="matAutocomplete" 
                           [displayWith]="displayVehicle.bind(this)"
                           (optionSelected)="onVehicleSelected($event)">
            @for (vehicle of filteredVehicles; track vehicle.id) {
              <mat-option [value]="vehicle">
                {{ vehicle.registrationNumber }} - {{ vehicle.type || vehicle.make || 'Vehicle' }}
              </mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Maintenance Type</mat-label>
          <mat-select [(ngModel)]="formData.maintenanceType" name="maintenanceType" required>
            <mat-option value="scheduled">Scheduled Service</mat-option>
            <mat-option value="repair">Repair</mat-option>
            <mat-option value="spares">Spares</mat-option>
            <mat-option value="license">License Renewal</mat-option>
            <mat-option value="inspection">Inspection/Roadworthy</mat-option>
            <mat-option value="other">Other</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput [(ngModel)]="formData.description" name="description" rows="3" required
                    placeholder="Describe the maintenance required..."></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Scheduled Date</mat-label>
            <input matInput [matDatepicker]="picker" [(ngModel)]="formData.scheduledDate" name="scheduledDate" required>
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="formData.priority" name="priority" required>
              <mat-option value="low">Low</mat-option>
              <mat-option value="medium">Medium</mat-option>
              <mat-option value="high">High</mat-option>
              <mat-option value="critical">Critical</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Target Date</mat-label>
            <input matInput [matDatepicker]="targetPicker" [(ngModel)]="formData.targetDate" name="targetDate">
            <mat-datepicker-toggle matSuffix [for]="targetPicker"></mat-datepicker-toggle>
            <mat-datepicker #targetPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Date Stood</mat-label>
            <input matInput [matDatepicker]="stoodPicker" [(ngModel)]="formData.dateStood" name="dateStood">
            <mat-datepicker-toggle matSuffix [for]="stoodPicker"></mat-datepicker-toggle>
            <mat-datepicker #stoodPicker></mat-datepicker>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Estimated Cost (R)</mat-label>
            <input matInput type="number" [(ngModel)]="formData.estimatedCost" name="estimatedCost" placeholder="0.00">
            <span matPrefix>R&nbsp;</span>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Assigned To</mat-label>
            <input matInput [(ngModel)]="formData.assignedTo" name="assignedTo" placeholder="Service provider or technician">
          </mat-form-field>
        </div>

        @if (formData.maintenanceType === 'license') {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>License Expiry Date</mat-label>
            <input matInput [matDatepicker]="expiryPicker" [(ngModel)]="formData.licenseExpiryDate" name="licenseExpiryDate">
            <mat-datepicker-toggle matSuffix [for]="expiryPicker"></mat-datepicker-toggle>
            <mat-datepicker #expiryPicker></mat-datepicker>
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Notes</mat-label>
          <textarea matInput [(ngModel)]="formData.notes" name="notes" rows="2" placeholder="Additional notes..."></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!isValid()">
        <mat-icon>{{ data.record ? 'save' : 'add' }}</mat-icon>
        {{ data.record ? 'Save Changes' : 'Schedule' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .maintenance-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 500px;
    }
    .full-width {
      width: 100%;
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .form-row mat-form-field {
      flex: 1;
    }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon {
      color: #ff9800;
    }
  `]
})
export class AddMaintenanceDialog implements OnInit {
  formData: Partial<MaintenanceRecord> = {
    maintenanceType: 'scheduled',
    status: 'scheduled',
    priority: 'medium',
    scheduledDate: new Date()
  };

  vehicleSearchControl = new FormControl('');
  filteredVehicles: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<AddMaintenanceDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicles: any[], record?: MaintenanceRecord }
  ) {}

  ngOnInit(): void {
    // Initialize filtered vehicles first
    this.filteredVehicles = [...(this.data.vehicles || [])];
    
    if (this.data.record) {
      this.formData = { ...this.data.record };
      // Ensure vehicleId is set from record
      if (this.data.record.vehicleId) {
        this.formData.vehicleId = this.data.record.vehicleId;
      }
      // Datepickers need real Date objects (API returns ISO strings)
      if (this.formData.scheduledDate) this.formData.scheduledDate = new Date(this.formData.scheduledDate);
      if (this.formData.targetDate) this.formData.targetDate = new Date(this.formData.targetDate);
      if (this.formData.dateStood) this.formData.dateStood = new Date(this.formData.dateStood);
      if (this.formData.licenseExpiryDate) this.formData.licenseExpiryDate = new Date(this.formData.licenseExpiryDate);
      // Set the vehicle search control to display the selected vehicle
      const selectedVehicle = (this.data.vehicles || []).find(v => v.id === this.data.record?.vehicleId);
      if (selectedVehicle) {
        this.vehicleSearchControl.setValue(selectedVehicle, { emitEvent: false });
      }
    }
    
    // Subscribe to search changes
    this.vehicleSearchControl.valueChanges.subscribe(value => {
      this.filterVehicles(value);
    });
  }

  filterVehicles(value: any): void {
    const vehicles = this.data.vehicles || [];
    if (!value || typeof value === 'object') {
      this.filteredVehicles = [...vehicles];
      return;
    }
    const filterValue = value.toLowerCase();
    this.filteredVehicles = vehicles.filter(vehicle => 
      vehicle.registrationNumber?.toLowerCase().includes(filterValue) ||
      vehicle.make?.toLowerCase().includes(filterValue) ||
      vehicle.model?.toLowerCase().includes(filterValue) ||
      vehicle.type?.toLowerCase().includes(filterValue)
    );
  }

  displayVehicle(vehicle: any): string {
    if (!vehicle) return '';
    return `${vehicle.registrationNumber} - ${vehicle.type || vehicle.make || 'Vehicle'}`;
  }

  onVehicleSelected(event: any): void {
    const vehicle = event.option.value;
    if (vehicle) {
      this.formData.vehicleId = vehicle.id;
      this.formData.vehicleReg = vehicle.registrationNumber;
      this.formData.vehicleType = vehicle.type || 'Vehicle';
    }
  }

  onVehicleChange(event: any): void {
    const vehicle = this.data.vehicles.find(v => v.id === event.value);
    if (vehicle) {
      this.formData.vehicleReg = vehicle.registrationNumber;
      this.formData.vehicleType = vehicle.type || 'Vehicle';
    }
  }

  isValid(): boolean {
    return !!(
      this.formData.vehicleId &&
      this.formData.maintenanceType &&
      this.formData.description &&
      this.formData.scheduledDate &&
      this.formData.priority
    );
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.isValid()) {
      // Calculate days until expiry for license type
      if (this.formData.maintenanceType === 'license' && this.formData.licenseExpiryDate) {
        const today = new Date();
        const expiryDate = new Date(this.formData.licenseExpiryDate);
        this.formData.daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
      this.dialogRef.close(this.formData);
    }
  }
}

// Vehicle Dialog Component - View/Edit/Add vehicle
@Component({
  selector: 'app-vehicle-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDividerModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ data.mode === 'add' ? 'add' : data.mode === 'edit' ? 'edit' : 'visibility' }}</mat-icon>
      {{ data.mode === 'add' ? 'Add Vehicle' : data.mode === 'edit' ? 'Edit Vehicle' : 'Vehicle Details' }}
    </h2>
    <mat-dialog-content>
      <form class="vehicle-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Registration Number</mat-label>
          <input matInput [(ngModel)]="formData.registrationNumber" name="registrationNumber" 
                 [readonly]="data.mode === 'view'" placeholder="e.g., ABC123GP">
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Make</mat-label>
            <input matInput [(ngModel)]="formData.make" name="make" [readonly]="data.mode === 'view'">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Model</mat-label>
            <input matInput [(ngModel)]="formData.model" name="model" [readonly]="data.mode === 'view'">
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Year</mat-label>
            <input matInput type="number" [(ngModel)]="formData.year" name="year" [readonly]="data.mode === 'view'">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Color</mat-label>
            <input matInput [(ngModel)]="formData.color" name="color" [readonly]="data.mode === 'view'">
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>VIN Number</mat-label>
          <input matInput [(ngModel)]="formData.vinNumber" name="vinNumber" [readonly]="data.mode === 'view'">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vehicle Type</mat-label>
          <mat-select [(ngModel)]="formData.vehicleTypeId" name="vehicleTypeId" [disabled]="data.mode === 'view'">
            @for (vt of vehicleTypes; track vt.id) {
              <mat-option [value]="vt.id">{{ vt.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>Tank Size (L)</mat-label>
            <input matInput type="number" [(ngModel)]="formData.tankSize" name="tankSize" [readonly]="data.mode === 'view'">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Fuel Type</mat-label>
            <mat-select [(ngModel)]="formData.fuelType" name="fuelType" [disabled]="data.mode === 'view'">
              <mat-option value="Diesel">Diesel</mat-option>
              <mat-option value="Petrol">Petrol</mat-option>
              <mat-option value="LPG">LPG</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="formData.status" name="status" [disabled]="data.mode === 'view'">
            <mat-option value="Available">Available</mat-option>
            <mat-option value="In Use">In Use</mat-option>
            <mat-option value="Maintenance">Maintenance</mat-option>
            <mat-option value="Inactive">Inactive</mat-option>
          </mat-select>
        </mat-form-field>

        @if (data.mode === 'view' && data.vehicle) {
          <mat-divider></mat-divider>
          <div class="integration-info">
            <h4>Integration Status</h4>
            <div class="integration-row">
              <span class="label">CarTrack:</span>
              <span [class.linked]="data.vehicle.carTrackId">
                {{ data.vehicle.carTrackId ? 'Linked (' + data.vehicle.carTrackId + ')' : 'Not Linked' }}
              </span>
            </div>
            <div class="integration-row">
              <span class="label">TFN:</span>
              <span [class.linked]="data.vehicle.tfnVehicleId">
                {{ data.vehicle.tfnVehicleId ? 'Linked' : 'Not Linked' }}
              </span>
            </div>
            @if (data.vehicle.lastLocation) {
              <div class="integration-row">
                <span class="label">Last Location:</span>
                <span>{{ data.vehicle.lastLocation }}</span>
              </div>
            }
            @if (data.vehicle.lastUpdate) {
              <div class="integration-row">
                <span class="label">Last Update:</span>
                <span>{{ data.vehicle.lastUpdate | date:'medium' }}</span>
              </div>
            }
          </div>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">{{ data.mode === 'view' ? 'Close' : 'Cancel' }}</button>
      @if (data.mode !== 'view') {
        <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!isValid()">
          <mat-icon>{{ data.mode === 'add' ? 'add' : 'save' }}</mat-icon>
          {{ data.mode === 'add' ? 'Add Vehicle' : 'Save Changes' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    .vehicle-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 500px;
    }
    .full-width { width: 100%; }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .form-row mat-form-field { flex: 1; }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon { color: #1976d2; }
    .integration-info {
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-top: 16px;
    }
    .integration-info h4 {
      margin: 0 0 12px 0;
      color: #666;
    }
    .integration-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e0e0e0;
    }
    .integration-row:last-child { border-bottom: none; }
    .label { font-weight: 500; color: #666; }
    .linked { color: #4caf50; font-weight: 500; }
  `]
})
export class VehicleDialogComponent {
  formData: any = {};
  vehicleTypes: { id: number; name: string }[] = [];
  
  constructor(
    public dialogRef: MatDialogRef<VehicleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicle?: Vehicle, mode: 'view' | 'edit' | 'add' },
    private http: HttpClient
  ) {
    if (data.vehicle) {
      this.formData = { ...data.vehicle };
    } else {
      this.formData = { status: 'Available', vehicleTypeId: 1 };
    }
    this.loadVehicleTypes();
  }

  loadVehicleTypes(): void {
    const apiUrl = environment.apiUrl;
    this.http.get<{ id: number; name: string }[]>(`${apiUrl}/fleet/vehicle-types`).subscribe({
      next: (types) => { this.vehicleTypes = types || []; },
      error: (err) => {
        console.error('Error loading vehicle types:', err);
        // Fallback so the dropdown is never empty
        this.vehicleTypes = [
          { id: 1, name: 'Truck' }, { id: 2, name: 'Van' },
          { id: 3, name: 'Car' }, { id: 4, name: 'Motorcycle' }
        ];
      }
    });
  }

  isValid(): boolean {
    return !!this.formData.registrationNumber;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.isValid()) {
      const apiUrl = environment.apiUrl;
      if (this.data.mode === 'add') {
        this.http.post(`${apiUrl}/fleet/vehicles`, this.formData).subscribe({
          next: () => this.dialogRef.close(true),
          error: (err) => console.error('Error adding vehicle:', err)
        });
      } else {
        this.http.put(`${apiUrl}/fleet/vehicles/${this.formData.id}`, this.formData).subscribe({
          next: () => this.dialogRef.close(true),
          error: (err) => console.error('Error updating vehicle:', err)
        });
      }
    }
  }
}

// Assign Driver Dialog Component
@Component({
  selector: 'app-assign-driver-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatInputModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>person_add</mat-icon>
      Assign Driver to {{ data.vehicle.registrationNumber }}
    </h2>
    <mat-dialog-content>
      <div class="assign-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Select Driver</mat-label>
          <mat-select [(ngModel)]="selectedDriverId" name="driverId">
            <mat-option [value]="null">No Driver (Unassign)</mat-option>
            @for (driver of drivers; track driver.id) {
              <mat-option [value]="driver.id">
                {{ driver.name }} {{ driver.surname }} - {{ driver.licenseNumber || 'No License' }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (data.vehicle.currentDriverName) {
          <div class="current-driver">
            <mat-icon>info</mat-icon>
            <span>Currently assigned to: <strong>{{ data.vehicle.currentDriverName }}</strong></span>
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()">
        <mat-icon>check</mat-icon>
        {{ selectedDriverId ? 'Assign Driver' : 'Unassign Driver' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .assign-form {
      min-width: 400px;
    }
    .full-width { width: 100%; }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon { color: #1976d2; }
    .current-driver {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background: #fff3e0;
      border-radius: 8px;
      margin-top: 8px;
    }
    .current-driver mat-icon { color: #ff9800; }
  `]
})
export class AssignDriverDialogComponent implements OnInit {
  selectedDriverId: number | null = null;
  drivers: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<AssignDriverDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicle: Vehicle },
    private http: HttpClient
  ) {
    if (data.vehicle.currentDriverId) {
      this.selectedDriverId = data.vehicle.currentDriverId;
    }
  }

  ngOnInit(): void {
    this.loadDrivers();
  }

  loadDrivers(): void {
    const apiUrl = environment.apiUrl;
    this.http.get<any[]>(`${apiUrl}/logistics/drivers`).subscribe({
      next: (drivers) => this.drivers = drivers,
      error: () => this.drivers = []
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    const apiUrl = environment.apiUrl;
    this.http.post(`${apiUrl}/fleet/vehicles/${this.data.vehicle.id}/assign-driver`, {
      driverId: this.selectedDriverId
    }).subscribe({
      next: () => this.dialogRef.close(true),
      error: (err) => console.error('Error assigning driver:', err)
    });
  }
}

// Link Vehicle Dialog Component - Link to CarTrack or TFN
@Component({
  selector: 'app-link-vehicle-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatSelectModule, MatInputModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>link</mat-icon>
      Link {{ data.vehicle.registrationNumber }} to {{ data.type === 'cartrack' ? 'CarTrack' : 'TruckFuelNet' }}
    </h2>
    <mat-dialog-content>
      <div class="link-form">
        @if (loading) {
          <div class="loading">
            <mat-spinner diameter="40"></mat-spinner>
            <span>Loading available {{ data.type === 'cartrack' ? 'CarTrack' : 'TFN' }} vehicles...</span>
          </div>
        } @else {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Select {{ data.type === 'cartrack' ? 'CarTrack' : 'TFN' }} Vehicle</mat-label>
            <mat-select [(ngModel)]="selectedExternalId" name="externalId">
              @for (item of availableItems; track item.id) {
                <mat-option [value]="item.id">
                  {{ item.name || item.registrationNumber }} 
                  @if (item.description) {
                    - {{ item.description }}
                  }
                </mat-option>
              }
            </mat-select>
            <mat-hint>{{ availableItems.length }} unlinked vehicles available</mat-hint>
          </mat-form-field>

          @if (data.type === 'cartrack') {
            <div class="manual-entry">
              <span>Or enter CarTrack ID manually:</span>
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>CarTrack ID</mat-label>
                <input matInput [(ngModel)]="manualId" name="manualId" placeholder="e.g., 339321264">
              </mat-form-field>
            </div>
          }
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="!selectedExternalId && !manualId">
        <mat-icon>link</mat-icon>
        Link Vehicle
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .link-form {
      min-width: 450px;
    }
    .full-width { width: 100%; }
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    h2 mat-icon { color: #1976d2; }
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
    }
    .manual-entry {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }
    .manual-entry span {
      display: block;
      margin-bottom: 8px;
      color: #666;
      font-size: 13px;
    }
  `]
})
export class LinkVehicleDialogComponent implements OnInit {
  selectedExternalId: string | null = null;
  manualId: string = '';
  availableItems: any[] = [];
  loading = true;

  constructor(
    public dialogRef: MatDialogRef<LinkVehicleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicle: Vehicle, type: 'cartrack' | 'tfn' },
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadAvailableItems();
  }

  loadAvailableItems(): void {
    const apiUrl = environment.apiUrl;
    const endpoint = this.data.type === 'cartrack' 
      ? `${apiUrl}/cartrack/vehicles/unlinked`
      : `${apiUrl}/logistics/tfn/vehicles/unlinked`;

    this.http.get<any[]>(endpoint).subscribe({
      next: (items) => {
        this.availableItems = items;
        this.loading = false;
      },
      error: () => {
        this.availableItems = [];
        this.loading = false;
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSubmit(): void {
    const apiUrl = environment.apiUrl;
    const externalId = this.selectedExternalId || this.manualId;
    
    const endpoint = this.data.type === 'cartrack'
      ? `${apiUrl}/fleet/vehicles/${this.data.vehicle.id}/link-cartrack`
      : `${apiUrl}/fleet/vehicles/${this.data.vehicle.id}/link-tfn`;

    this.http.post(endpoint, { externalId }).subscribe({
      next: () => this.dialogRef.close(true),
      error: (err) => console.error('Error linking vehicle:', err)
    });
  }
}

// Assign Tripsheet Dialog - for assigning driver and vehicle to an existing tripsheet
@Component({
  selector: 'assign-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    FormsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>person_add</mat-icon>
      Assign Driver & Vehicle
    </h2>
    <mat-dialog-content>
      <div class="assign-form">
        <div class="tripsheet-info">
          <p><strong>TripSheet:</strong> {{ data.tripsheet.loadNumber || data.tripsheet.tripNumber }}</p>
          <p><strong>Status:</strong> {{ data.tripsheet.status }}</p>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Driver</mat-label>
          <mat-select [(ngModel)]="selectedDriverId">
            <mat-option [value]="null">-- Not Assigned --</mat-option>
            @for (driver of data.drivers; track driver.id) {
              <mat-option [value]="driver.id">
                {{ driver.firstName }} {{ driver.lastName }}
                @if (driver.status === 'On Duty') {
                  <span class="on-duty">(On Duty)</span>
                }
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Vehicle</mat-label>
          <mat-select [(ngModel)]="selectedVehicleId">
            <mat-option [value]="null">-- Not Assigned --</mat-option>
            @for (vehicle of data.vehicles; track vehicle.id) {
              <mat-option [value]="vehicle.id">
                {{ vehicle.registrationNumber }} - {{ vehicle.type || vehicle.vehicleTypeName }}
                @if (vehicle.status === 'Available') {
                  <span class="available">(Available)</span>
                }
              </mat-option>
            }
          </mat-select>
          <mat-hint>Only available vehicles shown</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Scheduled Date</mat-label>
          <input matInput [matDatepicker]="picker" [(ngModel)]="scheduledDate">
          <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onAssign()" [disabled]="!selectedDriverId && !selectedVehicleId">
        <mat-icon>check</mat-icon>
        Assign
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .assign-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 400px;
      padding: 16px 0;
    }
    .tripsheet-info {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .tripsheet-info p {
      margin: 4px 0;
    }
    .full-width {
      width: 100%;
    }
    .on-duty {
      color: #4caf50;
      font-size: 12px;
      margin-left: 8px;
    }
    .available {
      color: #2196f3;
      font-size: 12px;
      margin-left: 8px;
    }
    mat-dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class AssignTripsheetDialog {
  selectedDriverId: number | null = null;
  selectedVehicleId: number | null = null;
  scheduledDate: Date = new Date();

  constructor(
    public dialogRef: MatDialogRef<AssignTripsheetDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { 
      tripsheet: any, 
      drivers: any[], 
      vehicles: any[] 
    }
  ) {
    // Pre-fill if already assigned
    if (data.tripsheet.driverId) {
      this.selectedDriverId = data.tripsheet.driverId;
    }
    if (data.tripsheet.vehicleId) {
      this.selectedVehicleId = data.tripsheet.vehicleId;
    }
    if (data.tripsheet.date) {
      this.scheduledDate = new Date(data.tripsheet.date);
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onAssign(): void {
    this.dialogRef.close({
      assigned: true,
      driverId: this.selectedDriverId,
      vehicleId: this.selectedVehicleId,
      scheduledDate: this.scheduledDate
    });
  }
}

// Complete Maintenance Dialog - Mark maintenance as complete with file uploads
@Component({
  selector: 'complete-maintenance-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatDividerModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>check_circle</mat-icon>
      Complete Maintenance
    </h2>
    <mat-dialog-content>
      <div class="complete-form">
        <div class="maintenance-info">
          <p><strong>Vehicle:</strong> {{ data.record.vehicleReg }}</p>
          <p><strong>Type:</strong> {{ data.record.maintenanceType | titlecase }}</p>
          <p><strong>Description:</strong> {{ data.record.description }}</p>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Odometer Reading (km)</mat-label>
          <input matInput type="number" [(ngModel)]="formData.odometerReading" 
                 placeholder="Enter current odometer reading">
          <mat-icon matSuffix>speed</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Actual Cost (R)</mat-label>
          <input matInput type="number" step="0.01" [(ngModel)]="formData.cost" 
                 placeholder="Enter actual cost">
          <mat-icon matSuffix>attach_money</mat-icon>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Completion Notes</mat-label>
          <textarea matInput [(ngModel)]="formData.notes" rows="3"
                    placeholder="Enter any notes about the work completed..."></textarea>
        </mat-form-field>

        <mat-divider></mat-divider>

        <div class="file-upload-section">
          <h4><mat-icon>attach_file</mat-icon> Attachments</h4>
          
          <div class="file-upload">
            <label class="file-label">
              <mat-icon>description</mat-icon>
              <span>Proof of Work (Invoice, Work Order, etc.)</span>
            </label>
            <input type="file" (change)="onProofOfWorkSelected($event)" 
                   accept="image/*,.pdf,.doc,.docx" #proofOfWorkInput>
            <button mat-stroked-button (click)="proofOfWorkInput.click()">
              <mat-icon>upload_file</mat-icon>
              {{ formData.proofOfWorkFile?.name || 'Choose File' }}
            </button>
            @if (formData.proofOfWorkFile) {
              <button mat-icon-button color="warn" (click)="clearProofOfWork()" 
                      matTooltip="Remove file">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>

          <div class="file-upload">
            <label class="file-label">
              <mat-icon>receipt_long</mat-icon>
              <span>Proof of Payment (Receipt, EFT Confirmation, etc.)</span>
            </label>
            <input type="file" (change)="onProofOfPaymentSelected($event)" 
                   accept="image/*,.pdf,.doc,.docx" #proofOfPaymentInput>
            <button mat-stroked-button (click)="proofOfPaymentInput.click()">
              <mat-icon>upload_file</mat-icon>
              {{ formData.proofOfPaymentFile?.name || 'Choose File' }}
            </button>
            @if (formData.proofOfPaymentFile) {
              <button mat-icon-button color="warn" (click)="clearProofOfPayment()" 
                      matTooltip="Remove file">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="accent" (click)="onComplete()">
        <mat-icon>check_circle</mat-icon>
        Mark Complete
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .complete-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 850px;
      padding: 8px 0;
    }
    .maintenance-info {
      background: #e3f2fd;
      padding: 12px;
      border-radius: 8px;
      border-left: 4px solid #2196f3;
    }
    .maintenance-info p {
      margin: 4px 0;
      font-size: 14px;
    }
    .full-width {
      width: 100%;
    }
    .file-upload-section {
      margin-top: 8px;
    }
    .file-upload-section h4 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0 16px 0;
      color: #666;
      font-size: 14px;
      font-weight: 500;
    }
    .file-upload {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
    }
    .file-label {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      font-size: 13px;
      color: #666;
    }
    .file-label mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #ff9800;
    }
    input[type="file"] {
      display: none;
    }
    button[mat-stroked-button] {
      min-width: 150px;
    }
    mat-dialog-title {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    mat-dialog-title mat-icon {
      color: #4caf50;
    }
  `]
})
export class CompleteMaintenanceDialog {
  formData: {
    odometerReading?: number;
    cost?: number;
    notes?: string;
    proofOfWorkFile?: File;
    proofOfPaymentFile?: File;
  } = {};

  constructor(
    public dialogRef: MatDialogRef<CompleteMaintenanceDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { record: MaintenanceRecord }
  ) {}

  onProofOfWorkSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.formData.proofOfWorkFile = file;
    }
  }

  onProofOfPaymentSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.formData.proofOfPaymentFile = file;
    }
  }

  clearProofOfWork(): void {
    this.formData.proofOfWorkFile = undefined;
  }

  clearProofOfPayment(): void {
    this.formData.proofOfPaymentFile = undefined;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onComplete(): void {
    this.dialogRef.close({
      odometerReading: this.formData.odometerReading,
      cost: this.formData.cost,
      notes: this.formData.notes,
      proofOfWork: this.formData.proofOfWorkFile,
      proofOfPayment: this.formData.proofOfPaymentFile
    });
  }
}

// Update Load Status Dialog
@Component({
  selector: 'update-load-status-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    FormsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>edit</mat-icon>
      Update Load Status
    </h2>
    <mat-dialog-content>
      <p class="load-info">
        <strong>{{ data.load.loadNumber }}</strong><br>
        {{ data.load.customerName }}<br>
        {{ data.load.origin }}  >  {{ data.load.destination }}
      </p>

      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Status</mat-label>
        <mat-select [(ngModel)]="selectedStatus" required>
          <mat-option value="Available">Available</mat-option>
          <mat-option value="Assigned">Assigned</mat-option>
          <mat-option value="InTransit">In Transit</mat-option>
          <mat-option value="Delivered">Delivered</mat-option>
          <mat-option value="Cancelled">Cancelled</mat-option>
        </mat-select>
      </mat-form-field>

      <div class="status-descriptions">
        <div class="status-desc" *ngIf="selectedStatus === 'Available'">
          <mat-icon>info</mat-icon>
          <span>Load is ready but not yet assigned to driver/vehicle</span>
        </div>
        <div class="status-desc" *ngIf="selectedStatus === 'Assigned'">
          <mat-icon>info</mat-icon>
          <span>Load is assigned to driver/vehicle but not yet started</span>
        </div>
        <div class="status-desc" *ngIf="selectedStatus === 'InTransit'">
          <mat-icon>info</mat-icon>
          <span>Driver is currently on the road with this load</span>
        </div>
        <div class="status-desc" *ngIf="selectedStatus === 'Delivered'">
          <mat-icon>info</mat-icon>
          <span>Load has been successfully delivered</span>
        </div>
        <div class="status-desc" *ngIf="selectedStatus === 'Cancelled'">
          <mat-icon>info</mat-icon>
          <span>Load has been cancelled and will not be delivered</span>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onUpdate()" [disabled]="!selectedStatus">
        <mat-icon>check</mat-icon>
        Update Status
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .load-info {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      margin-bottom: 20px;
      line-height: 1.6;
    }

    .full-width {
      width: 100%;
    }

    .status-descriptions {
      margin-top: 16px;
    }

    .status-desc {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      background: #e3f2fd;
      border-radius: 4px;
      font-size: 0.9rem;
      color: #1565c0;
    }

    .status-desc mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    mat-dialog-content {
      min-width: 400px;
    }

    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class UpdateLoadStatusDialog {
  selectedStatus: string;

  constructor(
    public dialogRef: MatDialogRef<UpdateLoadStatusDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { load: any }
  ) {
    this.selectedStatus = data.load.status || 'Available';
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onUpdate(): void {
    this.dialogRef.close({ status: this.selectedStatus });
  }
}

// ===========================
// VIEW LOAD DETAILS DIALOG
// ===========================
@Component({
  selector: 'view-load-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatChipsModule,
    MatTabsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>local_shipping</mat-icon>
      Load Details: {{ data.loadNumber }}
    </h2>
    
    <mat-dialog-content class="load-details-content">
      <mat-tab-group>
        <!-- Overview Tab -->
        <mat-tab label="Overview">
          <div class="details-section">
            <div class="detail-row">
              <span class="detail-label">Load Number:</span>
              <span class="detail-value">{{ data.loadNumber }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <mat-chip class="status-chip" [class]="'status-' + data.status?.toLowerCase()">
                {{ data.status }}
              </mat-chip>
            </div>
            <div class="detail-row">
              <span class="detail-label">Priority:</span>
              <mat-chip class="priority-chip" [class]="'priority-' + data.priority?.toLowerCase()">
                {{ data.priority || 'Normal' }}
              </mat-chip>
            </div>
            <div class="detail-row" *ngIf="data.customer">
              <span class="detail-label">Customer:</span>
              <span class="detail-value">{{ data.customer.name }}</span>
            </div>
            <div class="detail-row" *ngIf="data.driver">
              <span class="detail-label">Driver:</span>
              <span class="detail-value">{{ data.driver.firstName }} {{ data.driver.lastName }}</span>
            </div>
            <div class="detail-row" *ngIf="data.vehicle">
              <span class="detail-label">Vehicle:</span>
              <span class="detail-value">{{ data.vehicle.registrationNumber }} ({{ data.vehicle.make }} {{ data.vehicle.model }})</span>
            </div>
            <div class="detail-row" *ngIf="data.warehouse">
              <span class="detail-label">Origin Warehouse:</span>
              <span class="detail-value">{{ data.warehouse.name }}</span>
            </div>
            <div class="detail-row" *ngIf="data.scheduledPickupDate">
              <span class="detail-label">Scheduled Pickup:</span>
              <span class="detail-value">{{ data.scheduledPickupDate | date:'medium' }}</span>
            </div>
            <div class="detail-row" *ngIf="data.estimatedDistance">
              <span class="detail-label">Estimated Distance:</span>
              <span class="detail-value">{{ data.estimatedDistance }} km</span>
            </div>
            <div class="detail-row" *ngIf="data.estimatedTimeMinutes">
              <span class="detail-label">Estimated Time:</span>
              <span class="detail-value">{{ data.estimatedTimeMinutes }} minutes</span>
            </div>
            <div class="detail-row" *ngIf="data.specialInstructions">
              <span class="detail-label">Special Instructions:</span>
              <span class="detail-value">{{ data.specialInstructions }}</span>
            </div>
            <div class="detail-row" *ngIf="data.notes">
              <span class="detail-label">Notes:</span>
              <span class="detail-value">{{ data.notes }}</span>
            </div>
          </div>
        </mat-tab>

        <!-- Stops Tab -->
        <mat-tab label="Stops ({{ data.stops?.length || 0 }})">
          <div class="stops-section" *ngIf="data.stops && data.stops.length > 0">
            <div class="stop-card" *ngFor="let stop of data.stops; let i = index">
              <div class="stop-header">
                <div class="stop-sequence">
                  <mat-icon>place</mat-icon>
                  <span>Stop {{ stop.stopSequence }}</span>
                </div>
                <mat-chip class="stop-type-chip">{{ stop.stopType }}</mat-chip>
              </div>
              
              <div class="stop-details">
                <div class="detail-row">
                  <span class="detail-label">Company:</span>
                  <span class="detail-value">{{ stop.companyName }}</span>
                </div>
                <div class="detail-row" *ngIf="stop.address">
                  <span class="detail-label">Address:</span>
                  <span class="detail-value">{{ stop.address }}<span *ngIf="stop.city">, {{ stop.city }}</span></span>
                </div>
                <div class="detail-row" *ngIf="stop.contactPerson">
                  <span class="detail-label">Contact:</span>
                  <span class="detail-value">{{ stop.contactPerson }}<span *ngIf="stop.contactPhone"> - {{ stop.contactPhone }}</span></span>
                </div>
                <div class="detail-row" *ngIf="stop.orderNumber">
                  <span class="detail-label">Order #:</span>
                  <span class="detail-value">{{ stop.orderNumber }}</span>
                </div>
                <div class="detail-row" *ngIf="stop.invoiceNumber">
                  <span class="detail-label">Invoice #:</span>
                  <span class="detail-value">{{ stop.invoiceNumber }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Status:</span>
                  <mat-chip class="stop-status-chip">{{ stop.status || 'Pending' }}</mat-chip>
                </div>

                <!-- Commodities -->
                <div class="commodities-section" *ngIf="stop.commodities && stop.commodities.length > 0">
                  <mat-divider></mat-divider>
                  <h4>Items:</h4>
                  <div class="commodity-item" *ngFor="let commodity of stop.commodities">
                    <div class="commodity-row">
                      <span class="commodity-name">{{ commodity.commodity?.name || commodity.comment }}</span>
                      <span class="commodity-qty">Qty: {{ commodity.quantity }}</span>
                    </div>
                    <div class="commodity-details" *ngIf="commodity.unitPrice || commodity.totalPrice">
                      <span *ngIf="commodity.unitPrice">Unit Price: R{{ commodity.unitPrice | number:'1.2-2' }}</span>
                      <span *ngIf="commodity.totalPrice">Total: R{{ commodity.totalPrice | number:'1.2-2' }}</span>
                    </div>
                    <div class="commodity-details" *ngIf="commodity.weight || commodity.volume">
                      <span *ngIf="commodity.weight">Weight: {{ commodity.weight }} kg</span>
                      <span *ngIf="commodity.volume">Volume: {{ commodity.volume }} m³</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="empty-state" *ngIf="!data.stops || data.stops.length === 0">
            <mat-icon>info</mat-icon>
            <p>No stops defined for this load</p>
          </div>
        </mat-tab>

        <!-- Timeline Tab -->
        <mat-tab label="Timeline">
          <div class="timeline-section">
            <div class="timeline-item">
              <mat-icon class="timeline-icon">add_circle</mat-icon>
              <div class="timeline-content">
                <div class="timeline-title">Load Created</div>
                <div class="timeline-date">{{ data.createdAt | date:'medium' }}</div>
              </div>
            </div>
            <div class="timeline-item" *ngIf="data.actualPickupDate">
              <mat-icon class="timeline-icon">local_shipping</mat-icon>
              <div class="timeline-content">
                <div class="timeline-title">Picked Up</div>
                <div class="timeline-date">{{ data.actualPickupDate | date:'medium' }}</div>
              </div>
            </div>
            <div class="timeline-item" *ngIf="data.actualDeliveryDate">
              <mat-icon class="timeline-icon">check_circle</mat-icon>
              <div class="timeline-content">
                <div class="timeline-title">Delivered</div>
                <div class="timeline-date">{{ data.actualDeliveryDate | date:'medium' }}</div>
              </div>
            </div>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onClose()">Close</button>
      <button mat-raised-button color="primary" *ngIf="data.id">
        <mat-icon>print</mat-icon>
        Print TripSheet
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .load-details-content {
      min-height: 400px;
      padding: 0;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #1976d2;
    }

    .details-section {
      padding: 20px;
    }

    .detail-row {
      display: flex;
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
      align-items: center;
    }

    .detail-label {
      font-weight: 600;
      color: #666;
      width: 200px;
      flex-shrink: 0;
    }

    .detail-value {
      color: #333;
      flex: 1;
    }

    .status-chip, .priority-chip, .stop-type-chip, .stop-status-chip {
      font-size: 12px;
      height: 24px;
      font-weight: 600;
    }

    .status-available { background-color: #90caf9; color: #0d47a1; }
    .status-assigned { background-color: #fff59d; color: #f57f17; }
    .status-intransit { background-color: #ffcc80; color: #e65100; }
    .status-delivered { background-color: #a5d6a7; color: #1b5e20; }
    .status-cancelled { background-color: #ef9a9a; color: #b71c1c; }

    .priority-low { background-color: #e0e0e0; color: #424242; }
    .priority-normal { background-color: #90caf9; color: #0d47a1; }
    .priority-high { background-color: #ffab91; color: #bf360c; }
    .priority-urgent { background-color: #ef5350; color: #fff; }

    .stops-section {
      padding: 20px;
    }

    .stop-card {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }

    .stop-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .stop-sequence {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #1976d2;
    }

    .stop-details .detail-row {
      padding: 6px 0;
      border: none;
    }

    .stop-details .detail-label {
      width: 120px;
      font-size: 14px;
    }

    .commodities-section {
      margin-top: 12px;
      padding-top: 12px;
    }

    .commodities-section h4 {
      margin: 12px 0 8px 0;
      color: #666;
      font-size: 14px;
    }

    .commodity-item {
      background: white;
      padding: 10px;
      margin: 8px 0;
      border-radius: 4px;
      border-left: 3px solid #1976d2;
    }

    .commodity-row {
      display: flex;
      justify-content: space-between;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .commodity-details {
      display: flex;
      gap: 20px;
      font-size: 12px;
      color: #666;
    }

    .timeline-section {
      padding: 20px;
    }

    .timeline-item {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      padding: 16px 0;
      border-left: 2px solid #e0e0e0;
      padding-left: 20px;
      margin-left: 12px;
      position: relative;
    }

    .timeline-item:last-child {
      border-left: none;
    }

    .timeline-icon {
      color: #1976d2;
      background: white;
      border: 2px solid #1976d2;
      border-radius: 50%;
      padding: 8px;
      position: absolute;
      left: -21px;
    }

    .timeline-content {
      padding-left: 40px;
    }

    .timeline-title {
      font-weight: 600;
      font-size: 16px;
      color: #333;
    }

    .timeline-date {
      color: #666;
      font-size: 14px;
      margin-top: 4px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    mat-tab-group {
      margin-top: 16px;
    }
  `]
})
export class ViewLoadDetailsDialog {
  constructor(
    public dialogRef: MatDialogRef<ViewLoadDetailsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }
}

// ViewRouteMapDialog Component
@Component({
  selector: 'view-route-map-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    GoogleMapsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>map</mat-icon>
      Route Map - {{ data.load.loadNumber }}
    </h2>

    <mat-dialog-content>
      <div class="route-info">
        <div class="info-item">
              <strong>Driver:</strong> {{ data.load.driverName || 'N/A' }}
            </div>
            <div class="info-item">
              <strong>Vehicle:</strong> {{ data.load.vehicleRegistration || 'N/A' }}
            </div>
            <div class="info-item">
              <strong>Origin:</strong> {{ data.load.warehouseName || 'N/A' }}
          <strong>Stops:</strong> {{ data.load.stops?.length || 0 }}
        </div>
      </div>

      @if (isLoadingMap) {
        <div class="loading-container">
          <mat-spinner diameter="50"></mat-spinner>
          <p>Loading map and geocoding stops...</p>
        </div>
      } @else if (geocodingError) {
        <div class="error-container">
          <mat-icon color="warn">error</mat-icon>
          <p>{{ geocodingError }}</p>
        </div>
      } @else {
        <google-map
          [options]="mapOptions"
          [center]="mapCenter"
          [zoom]="mapZoom"
          width="100%"
          height="600px">
          
          <!-- Warehouse marker -->
          @if (warehousePosition) {
            <map-marker
              [position]="warehousePosition"
              [options]="warehouseMarkerOptions"
              [title]="'Origin: ' + (data.load.warehouseName || data.load.warehouse?.name || 'Warehouse')">
            </map-marker>
          }

          <!-- Stop markers -->
          @for (stop of geocodedStops; track stop.id) {
            <map-marker
              [position]="stop.position"
              [label]="stop.label"
              [title]="stop.title"
              [options]="stopMarkerOptions">
            </map-marker>
          }

          <!-- Route polyline -->
          @if (routePath.length > 0) {
            <map-polyline
              [path]="routePath"
              [options]="polylineOptions">
            </map-polyline>
          }

          <!-- Live vehicle position marker -->
          @if (vehiclePosition) {
            <map-marker
              [position]="vehiclePosition"
              [options]="vehicleMarkerOptions"
              [title]="'Vehicle: ' + (trackingInfo?.vehicleRegistration || data.load.vehicleRegistration || 'Unknown')">
            </map-marker>
          }
        </google-map>

        <!-- Live tracking info banner -->
        @if (trackingInfo) {
          <div class="tracking-banner">
            <mat-icon>gps_fixed</mat-icon>
            <div class="tracking-details">
              <strong>Live Tracking</strong>
              <span>{{ trackingInfo.vehicleRegistration }} · {{ trackingInfo.currentLocation?.status || 'Unknown' }}
                @if (trackingInfo.currentLocation?.speed > 0) {
                  · {{ trackingInfo.currentLocation.speed }} km/h
                }
              </span>
              @if (trackingInfo.distanceToNextStop) {
                <span>Next stop: {{ trackingInfo.distanceToNextStop | number:'1.1-1' }} km away</span>
              }
            </div>
          </div>
        }

        <div class="stops-legend">
          <h3>Stops Details ({{ data.load.stops?.length || 0 }} stop{{ (data.load.stops?.length || 0) === 1 ? '' : 's' }})</h3>
          @if ((data.load.stops?.length || 0) === 1) {
            <p class="group-note">
              <mat-icon>info</mat-icon>
              Invoices to the same customer are grouped into one stop.
            </p>
          }
          @for (stop of data.load.stops; track stop.id; let i = $index) {
            <div class="stop-item">
              <div class="stop-number">{{ i + 1 }}</div>
              <div class="stop-details">
                <strong>{{ stop.companyName || stop.customerName || 'Stop ' + (i + 1) }}</strong>
                <div>{{ stop.address }}{{ stop.city ? ', ' + stop.city : '' }}</div>
                @if (stop.invoiceNumber) {
                  <div class="invoice-line"><mat-icon>receipt</mat-icon> {{ stop.invoiceNumber }}</div>
                }
                @if (stop.notes) {
                  <div class="stop-notes">{{ stop.notes }}</div>
                }
                @if (stop.stopCommodities && stop.stopCommodities.length > 0) {
                  <div class="commodities">
                    @for (commodity of stop.stopCommodities; track commodity.id) {
                      <span class="commodity-chip">
                        {{ commodity.commodity?.name }} ({{ commodity.quantity }} {{ commodity.commodity?.unit }})
                      </span>
                    }
                  </div>
                }
                @if (stop.commodities && stop.commodities.length > 0) {
                  <div class="commodities">
                    @for (commodity of stop.commodities; track commodity.id) {
                      <span class="commodity-chip">
                        {{ commodity.commodityName }} ({{ commodity.quantity }} {{ commodity.unitOfMeasure || '' }})
                        @if (commodity.invoiceNumber) { · {{ commodity.invoiceNumber }} }
                      </span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onClose()">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      min-width: 90vw;
      max-width: 1400px;
      padding: 20px;
    }

    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 16px 24px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
      color: white;
    }

    .route-info {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 16px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .info-item strong {
      color: #666;
      font-size: 12px;
      text-transform: uppercase;
    }

    .loading-container,
    .error-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      gap: 16px;
    }

    .error-container mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    google-map {
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .stops-legend {
      margin-top: 24px;
      padding: 16px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .stops-legend h3 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 18px;
    }

    .stop-item {
      display: flex;
      gap: 16px;
      padding: 12px;
      margin-bottom: 8px;
      background: #f9f9f9;
      border-radius: 8px;
      border-left: 4px solid #2563eb;
    }

    .stop-number {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: #2563eb;
      color: white;
      border-radius: 50%;
      font-weight: bold;
      flex-shrink: 0;
    }

    .stop-details {
      flex: 1;
    }

    .stop-details strong {
      display: block;
      margin-bottom: 4px;
      color: #333;
    }

    .stop-details > div {
      color: #666;
      font-size: 14px;
      margin-bottom: 4px;
    }

    .commodities {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }

    .commodity-chip {
      display: inline-block;
      padding: 4px 12px;
      background: #e3f2fd;
      color: #1976d2;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .group-note {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #666;
      background: #fff8e1;
      border-radius: 6px;
      padding: 8px 12px;
      margin: 0 0 12px 0;
    }
    .group-note mat-icon { font-size: 18px; width: 18px; height: 18px; color: #f9a825; }

    .invoice-line {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #1976d2 !important;
      font-weight: 500;
    }
    .invoice-line mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .stop-notes {
      font-size: 12px;
      color: #888 !important;
      white-space: pre-wrap;
      margin-top: 4px;
    }

    .tracking-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      margin-top: 12px;
      background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
      border-radius: 8px;
      border-left: 4px solid #4caf50;
    }

    .tracking-banner mat-icon {
      color: #4caf50;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .tracking-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .tracking-details strong {
      color: #2e7d32;
      font-size: 14px;
    }

    .tracking-details span {
      color: #555;
      font-size: 13px;
    }

    mat-dialog-actions {
      padding: 16px 24px;
      margin: 0;
    }
  `]
})
export class ViewRouteMapDialog implements OnInit {
  isLoadingMap = true;
  geocodingError: string | null = null;
  
  warehousePosition: google.maps.LatLngLiteral | null = null;
  geocodedStops: Array<{
    id: number;
    position: google.maps.LatLngLiteral;
    label: string;
    title: string;
  }> = [];
  routePath: google.maps.LatLngLiteral[] = [];

  mapOptions: google.maps.MapOptions = {
    mapTypeId: 'roadmap',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
  };

  mapCenter: google.maps.LatLngLiteral = { lat: -28.7, lng: 25.5 }; // Center of South Africa
  mapZoom = 6;

  warehouseMarkerOptions: google.maps.MarkerOptions = {
    icon: {
      url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
      scaledSize: new google.maps.Size(40, 40),
    },
  };

  stopMarkerOptions: google.maps.MarkerOptions = {
    icon: {
      url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
      scaledSize: new google.maps.Size(32, 32),
    },
  };

  polylineOptions: google.maps.PolylineOptions = {
    strokeColor: '#2563eb',
    strokeOpacity: 0.8,
    strokeWeight: 4,
  };

  vehiclePosition: google.maps.LatLngLiteral | null = null;
  vehicleMarkerOptions: google.maps.MarkerOptions = {
    icon: {
      url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
      scaledSize: new google.maps.Size(44, 44),
    },
  };
  trackingInfo: any = null;

  constructor(
    public dialogRef: MatDialogRef<ViewRouteMapDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { load: any; liveTracking?: any },
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // If live tracking data is provided, set vehicle position
    if (this.data.liveTracking?.currentLocation?.location) {
      const loc = this.data.liveTracking.currentLocation.location;
      this.vehiclePosition = { lat: loc.latitude, lng: loc.longitude };
      this.trackingInfo = this.data.liveTracking;
    }
    this.initializeMap();
  }

  async initializeMap(): Promise<void> {
    try {
      const geocoder = new google.maps.Geocoder();
      const load = this.data.load;

      // 1) Resolve warehouse/origin position from available sources
      if (load.warehouse?.latitude && load.warehouse?.longitude) {
        this.warehousePosition = { lat: load.warehouse.latitude, lng: load.warehouse.longitude };
      } else if (load.pickupLatitude && load.pickupLongitude) {
        this.warehousePosition = { lat: load.pickupLatitude, lng: load.pickupLongitude };
      } else {
        // Check for a Pickup-type stop with coordinates
        const pickupStop = (load.stops || []).find((s: any) =>
          s.stopType === 'Pickup' && s.latitude && s.longitude);
        if (pickupStop) {
          this.warehousePosition = { lat: pickupStop.latitude, lng: pickupStop.longitude };
        } else if (load.warehouseId) {
          // Fetch warehouse coordinates from API
          try {
            const warehouses = await firstValueFrom(
              this.http.get<any[]>(`${environment.apiUrl}/warehouses`));
            const wh = warehouses?.find(w => w.id === load.warehouseId);
            if (wh?.latitude && wh?.longitude) {
              this.warehousePosition = { lat: wh.latitude, lng: wh.longitude };
              load.warehouse = wh;
            } else if (wh?.address || wh?.name) {
              // Last resort: geocode the warehouse address
              const result = await this.geocodeAddress(
                geocoder, [wh.address, wh.city, wh.province, 'South Africa'].filter(Boolean).join(', '))
                .catch(() => null);
              if (result) { this.warehousePosition = result; load.warehouse = wh; }
            }
          } catch (e) {
            console.warn('Failed to resolve warehouse coordinates:', e);
          }
        }
      }
      if (this.warehousePosition) {
        this.mapCenter = this.warehousePosition;
      }

      // 2) Place delivery stops - use stored coordinates first, geocode as fallback
      if (load.stops && load.stops.length > 0) {
        const sortedStops = [...load.stops]
          .filter((s: any) => s.stopType !== 'Pickup')
          .sort((a, b) => a.stopSequence - b.stopSequence);
        let seq = 0;
        for (const stop of sortedStops) {
          seq++;
          const title = `Stop ${seq}: ${stop.companyName || stop.customerName || stop.locationName || 'Delivery'}`;
          // Use saved coordinates when available
          if (stop.latitude && stop.longitude) {
            this.geocodedStops.push({
              id: stop.id,
              position: { lat: stop.latitude, lng: stop.longitude },
              label: seq.toString(),
              title,
            });
            continue;
          }
          // Fallback: geocode from the best available address text
          const addressText = [stop.address, stop.city, stop.province, 'South Africa']
            .filter((p: any) => p && String(p).trim()).join(', ');
          const fallbackText = [stop.companyName || stop.customerName, stop.city, stop.province, 'South Africa']
            .filter((p: any) => p && String(p).trim()).join(', ');
          try {
            let result: google.maps.LatLngLiteral | null = null;
            if (stop.address && String(stop.address).trim()) {
              result = await this.geocodeAddress(geocoder, addressText).catch(() => null);
            }
            if (!result && fallbackText) {
              result = await this.geocodeAddress(geocoder, fallbackText).catch(() => null);
            }
            if (result) {
              this.geocodedStops.push({
                id: stop.id,
                position: result,
                label: seq.toString(),
                title,
              });
            } else {
              console.warn(`Could not locate stop ${seq} (${title}) - no coordinates or geocodable address`);
            }
          } catch (error) {
            console.warn(`Failed to geocode stop ${seq}:`, error);
          }
        }
      }

      // Get actual road route using Directions API
      if (this.geocodedStops.length > 0) {
        await this.calculateRoute();
      } else if (this.warehousePosition) {
        // Only warehouse, no stops
        this.routePath.push(this.warehousePosition);
      }

      // Adjust map bounds to fit all markers
      const bounds = new google.maps.LatLngBounds();
      let hasPoints = false;

      if (this.warehousePosition) {
        bounds.extend(this.warehousePosition);
        hasPoints = true;
      }
      this.geocodedStops.forEach(s => { bounds.extend(s.position); hasPoints = true; });
      if (this.vehiclePosition) {
        bounds.extend(this.vehiclePosition);
        hasPoints = true;
      }
      this.routePath.forEach(p => bounds.extend(p));

      if (hasPoints) {
        this.mapCenter = bounds.getCenter().toJSON();
        // Use a generous zoom that fits SA routes; fitBounds via @ViewChild is better
        // but for now, pick zoom based on bounds span
        const latSpan = bounds.toJSON().north - bounds.toJSON().south;
        const lngSpan = bounds.toJSON().east - bounds.toJSON().west;
        const maxSpan = Math.max(latSpan, lngSpan);
        if (maxSpan < 0.05) this.mapZoom = 14;
        else if (maxSpan < 0.5) this.mapZoom = 11;
        else if (maxSpan < 2) this.mapZoom = 9;
        else if (maxSpan < 5) this.mapZoom = 7;
        else this.mapZoom = 6;
      }

      this.isLoadingMap = false;
    } catch (error) {
      console.error('Error initializing map:', error);
      this.geocodingError = 'Failed to load map. Please try again.';
      this.isLoadingMap = false;
    }
  }

  private async calculateRoute(): Promise<void> {
    if (this.geocodedStops.length === 0) {
      return;
    }
    // Origin = warehouse if known, otherwise the first stop
    const origin = this.warehousePosition ?? this.geocodedStops[0].position;
    const routeStops = this.warehousePosition ? this.geocodedStops : this.geocodedStops.slice(1);
    if (routeStops.length === 0) {
      this.routePath = [origin];
      return;
    }

    const directionsService = new google.maps.DirectionsService();

    // Build waypoints for all stops except the last one
    const waypoints: google.maps.DirectionsWaypoint[] = routeStops
      .slice(0, -1)
      .map((stop) => {
        return {
          location: stop.position,
          stopover: true
        };
      });

    const request: google.maps.DirectionsRequest = {
      origin: origin,
      destination: routeStops[routeStops.length - 1].position,
      waypoints: waypoints,
      optimizeWaypoints: false, // Keep original sequence
      travelMode: google.maps.TravelMode.DRIVING,
    };
    try {
      const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route(request, (result, status) => {
          if (status === 'OK' && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });

      // Extract route path from directions result
      this.routePath = [];
      const route = result.routes[0];
      route.legs.forEach((leg, legIndex) => {
        leg.steps.forEach(step => {
          const path = step.path;
          path.forEach(point => {
            this.routePath.push(point.toJSON());
          });
        });
      });
    } catch (error) {
      console.warn('Failed to get directions, falling back to straight lines:', error);
      // Fallback to straight line if directions fail
      this.routePath = [origin, ...routeStops.map(s => s.position)];
    }
  }

  private geocodeAddress(
    geocoder: google.maps.Geocoder,
    address: string
  ): Promise<google.maps.LatLngLiteral | null> {
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          resolve(results[0].geometry.location.toJSON());
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  }

  onClose(): void {
    this.dialogRef.close();
  }
}

// ================================
// Logistics Reports Dialog
// ================================
@Component({
  selector: 'app-logistics-reports-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatTooltipModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatInputModule,
    FormsModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="reports-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>local_shipping</mat-icon>
          </div>
          <div class="header-text">
            <h2>Daily Dispatch Report</h2>
            <span class="header-subtitle">Fleet dispatch overview and analytics</span>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <div class="report-controls">
          <div class="date-picker-wrapper">
            <mat-icon class="control-icon">calendar_today</mat-icon>
            <mat-form-field appearance="outline">
              <mat-label>Select Date</mat-label>
              <input matInput [matDatepicker]="picker" [(ngModel)]="selectedDate" (dateChange)="loadReport()">
              <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
            </mat-form-field>
          </div>
          <div class="control-spacer"></div>
          <button mat-flat-button class="export-btn" (click)="exportToExcel()" [disabled]="loading">
            <mat-icon>file_download</mat-icon>
            <span>Export Excel</span>
          </button>
          <button mat-flat-button class="refresh-btn" (click)="loadReport()" [disabled]="loading">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>

        @if (loading) {
          <div class="loading-state">
            <div class="loading-spinner">
              <mat-spinner diameter="48"></mat-spinner>
            </div>
            <p>Fetching dispatch data...</p>
          </div>
        }

        @if (!loading && reportData) {
          <div class="report-summary">
            <div class="summary-card daily">
              <div class="card-icon">
                <mat-icon>today</mat-icon>
              </div>
              <div class="card-content">
                <span class="card-label">Daily Revenue</span>
                <span class="card-value">{{ reportData.grandTotal | currency: 'R ' }}</span>
                <span class="card-date">{{ reportData.reportDate | date: 'EEEE, dd MMM yyyy' }}</span>
              </div>
            </div>
            <div class="summary-card monthly">
              <div class="card-icon">
                <mat-icon>date_range</mat-icon>
              </div>
              <div class="card-content">
                <span class="card-label">Monthly Revenue</span>
                <span class="card-value">{{ reportData.monthlyTotal | currency: 'R ' }}</span>
                <span class="card-date">{{ reportData.monthStart | date: 'MMMM yyyy' }}</span>
              </div>
            </div>
            <div class="summary-card vehicles">
              <div class="card-icon">
                <mat-icon>local_shipping</mat-icon>
              </div>
              <div class="card-content">
                <span class="card-label">Fleet Dispatched</span>
                <span class="card-value">{{ reportData.dispatchedCount || 0 }}</span>
                <span class="card-date">of {{ reportData.totalVehicles }} vehicles</span>
              </div>
            </div>
          </div>

          <div class="provinces-section">
            <div class="section-header">
              <mat-icon>map</mat-icon>
              <h3>Provincial Breakdown</h3>
            </div>
            <div class="province-grid">
              @for (province of reportData.dailySummary; track province.province) {
                <div class="province-card">
                  <div class="province-icon">
                    <mat-icon>location_on</mat-icon>
                  </div>
                  <div class="province-info">
                    <span class="province-name">{{ province.province }}</span>
                    <span class="province-value">{{ province.dailyTotal | currency: 'R ' }}</span>
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="table-section">
            <div class="section-header">
              <mat-icon>table_chart</mat-icon>
              <h3>Vehicle Dispatch Details</h3>
              <span class="record-count">{{ reportData.dispatchedCount || 0 }} dispatched / {{ reportData.totalVehicles }} total</span>
            </div>
            <div class="vehicles-table-container">
              <table class="vehicles-table">
                <thead>
                  <tr>
                    <th>Province</th>
                    <th>#</th>
                    <th>Type</th>
                    <th>Registration</th>
                    <th>Driver</th>
                    <th>Date</th>
                    <th>Value</th>
                    <th>Route</th>
                    <th>Stops</th>
                    <th>Notes</th>
                    <th>MTD Value</th>
                  </tr>
                </thead>
                <tbody>
                  @for (vehicle of reportData.vehicles; track vehicle.no) {
                    <tr>
                      <td><span class="province-badge">{{ vehicle.province }}</span></td>
                      <td class="center">{{ vehicle.no }}</td>
                      <td><span class="vehicle-type">{{ vehicle.vehicleType }}</span></td>
                      <td class="mono">{{ vehicle.registration }}</td>
                      <td>{{ vehicle.driver || '—' }}</td>
                      <td class="date-cell">{{ vehicle.dispatchDate }}</td>
                      <td class="currency">{{ vehicle.value | currency: 'R ' }}</td>
                      <td class="route-cell" [title]="vehicle.route || ''">{{ vehicle.route || '—' }}</td>
                      <td class="center">{{ vehicle.stops || '—' }}</td>
                      <td class="notes-cell">{{ vehicle.comment || '—' }}</td>
                      <td class="currency mtd">{{ vehicle.monthlyValue | currency: 'R ' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions>
        <span class="footer-info">
          <mat-icon>info_outline</mat-icon>
          Data refreshed at {{ currentTime }}
        </span>
        <button mat-stroked-button mat-dialog-close>
          <mat-icon>close</mat-icon>
          Close
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .reports-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-width: 1200px;
      background: #f8fafc;
    }

    /* Header Styles */
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 28px;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
      color: white;
      position: relative;
      overflow: hidden;
    }

    .dialog-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -20%;
      width: 400px;
      height: 400px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
      pointer-events: none;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 1;
    }

    .header-icon {
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    .header-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .header-text h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: -0.5px;
    }

    .header-subtitle {
      font-size: 13px;
      color: rgba(255,255,255,0.7);
      margin-top: 2px;
      display: block;
    }

    .close-btn {
      color: rgba(255,255,255,0.8);
      transition: all 0.2s;
      z-index: 1;
    }

    .close-btn:hover {
      color: white;
      background: rgba(255,255,255,0.1);
    }

    /* Content Area */
    mat-dialog-content {
      flex: 1;
      padding: 28px;
      overflow-y: auto;
      background: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%);
    }

    /* Controls Bar */
    .report-controls {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
      padding: 16px 20px;
      background: white;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
    }

    .date-picker-wrapper {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .control-icon {
      color: #64748b;
      font-size: 22px;
    }

    .report-controls mat-form-field {
      width: 200px;
    }

    .control-spacer {
      flex: 1;
    }

    .export-btn {
      background: linear-gradient(135deg, #10b981, #059669) !important;
      color: white !important;
      padding: 0 20px;
      height: 42px;
      border-radius: 10px !important;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }

    .export-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
    }

    .refresh-btn {
      background: #f1f5f9 !important;
      color: #475569 !important;
      min-width: 42px !important;
      width: 42px;
      height: 42px;
      border-radius: 10px !important;
      padding: 0 !important;
    }

    .refresh-btn:hover {
      background: #e2e8f0 !important;
    }

    /* Loading State */
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
      background: white;
      border-radius: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    .loading-spinner {
      position: relative;
    }

    .loading-state p {
      margin-top: 20px;
      color: #64748b;
      font-size: 15px;
      font-weight: 500;
    }

    /* Summary Cards */
    .report-summary {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-bottom: 28px;
    }

    .summary-card {
      background: white;
      padding: 24px;
      border-radius: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
      display: flex;
      align-items: flex-start;
      gap: 16px;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .summary-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }

    .summary-card .card-icon {
      width: 56px;
      height: 56px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .summary-card .card-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .summary-card.daily .card-icon {
      background: linear-gradient(135deg, #dbeafe, #bfdbfe);
      color: #2563eb;
    }

    .summary-card.monthly .card-icon {
      background: linear-gradient(135deg, #fae8ff, #f5d0fe);
      color: #a855f7;
    }

    .summary-card.vehicles .card-icon {
      background: linear-gradient(135deg, #d1fae5, #a7f3d0);
      color: #059669;
    }

    .card-content {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .card-label {
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .card-value {
      font-size: 32px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
      margin: 6px 0;
    }

    .card-date {
      font-size: 12px;
      color: #94a3b8;
    }

    /* Provinces Section */
    .provinces-section {
      background: white;
      padding: 24px;
      border-radius: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
      margin-bottom: 28px;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }

    .section-header mat-icon {
      color: #3b82f6;
      font-size: 24px;
    }

    .section-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #0f172a;
    }

    .record-count {
      margin-left: auto;
      font-size: 13px;
      color: #64748b;
      background: #f1f5f9;
      padding: 4px 12px;
      border-radius: 20px;
    }

    .province-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .province-card {
      background: linear-gradient(135deg, #f8fafc, #f1f5f9);
      padding: 18px 20px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      gap: 14px;
      border: 1px solid #e2e8f0;
      transition: all 0.2s;
    }

    .province-card:hover {
      border-color: #3b82f6;
      background: linear-gradient(135deg, #eff6ff, #dbeafe);
    }

    .province-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }

    .province-icon mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .province-info {
      display: flex;
      flex-direction: column;
    }

    .province-name {
      font-weight: 600;
      color: #334155;
      font-size: 14px;
    }

    .province-value {
      font-weight: 700;
      color: #0f172a;
      font-size: 18px;
    }

    /* Table Section */
    .table-section {
      background: white;
      border-radius: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
      overflow: hidden;
    }

    .table-section .section-header {
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
      margin-bottom: 0;
    }

    .vehicles-table-container {
      overflow-x: auto;
    }

    .vehicles-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .vehicles-table thead {
      background: #f8fafc;
    }

    .vehicles-table th {
      padding: 14px 16px;
      text-align: left;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
    }

    .vehicles-table tbody tr {
      border-bottom: 1px solid #f1f5f9;
      transition: background 0.15s;
    }

    .vehicles-table tbody tr:hover {
      background: #f8fafc;
    }

    .vehicles-table td {
      padding: 14px 16px;
      vertical-align: middle;
      color: #334155;
    }

    .province-badge {
      background: linear-gradient(135deg, #eff6ff, #dbeafe);
      color: #1d4ed8;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .vehicle-type {
      background: #f1f5f9;
      color: #475569;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }

    .mono {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 12px;
      color: #0f172a;
      font-weight: 500;
    }

    .date-cell {
      color: #64748b;
      white-space: nowrap;
    }

    .vehicles-table td.currency {
      font-weight: 600;
      color: #059669;
      text-align: right;
      white-space: nowrap;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    .vehicles-table td.currency.mtd {
      color: #7c3aed;
    }

    .vehicles-table td.center {
      text-align: center;
    }

    .route-cell {
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #64748b;
    }

    .notes-cell {
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #94a3b8;
      font-style: italic;
    }

    /* Dialog Actions */
    mat-dialog-actions {
      padding: 16px 28px;
      background: white;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .footer-info {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #94a3b8;
    }

    .footer-info mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    mat-dialog-actions button {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  `]
})
export class LogisticsReportsDialog implements OnInit {
  selectedDate = new Date();
  loading = true;
  reportData: any = null;
  currentTime = new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    public dialogRef: MatDialogRef<LogisticsReportsDialog>
  ) {}

  ngOnInit(): void {
    this.loadReport();
  }

  loadReport(): void {
    this.loading = true;
    const apiUrl = environment.apiUrl;
    const dateStr = this.selectedDate.toISOString().split('T')[0];

    this.http.get(`${apiUrl}/logistics/reports/daily-dispatch?reportDate=${dateStr}`)
      .subscribe({
        next: (data: any) => {
          this.reportData = data;
          this.loading = false;
          this.currentTime = new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
        },
        error: (err) => {
          this.loading = false;
          this.snackBar.open('Failed to load report', 'Close', { duration: 3000 });
        }
      });
  }

  exportToExcel(): void {
    const apiUrl = environment.apiUrl;
    const dateStr = this.selectedDate.toISOString().split('T')[0];
    const url = `${apiUrl}/logistics/reports/daily-dispatch/export?reportDate=${dateStr}`;
    window.open(url, '_blank');
  }
}

// Live Streaming Dialog Component (CarTrack Vision)
@Component({
  selector: 'app-livestreaming-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    FormsModule
  ],
  template: `
    <div class="livestream-dialog">
      <div class="dialog-header">
        <h2>
          <mat-icon>videocam</mat-icon>
          Live Camera Streaming
          <span class="live-badge">
            <mat-icon class="live-dot">fiber_manual_record</mat-icon>
            LIVE
          </span>
        </h2>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <div class="vehicle-selector">
          <mat-form-field appearance="outline" class="vehicle-select">
            <mat-label>Select Vehicle</mat-label>
            <mat-select [(ngModel)]="selectedVehicle" (selectionChange)="onVehicleSelected()">
              @for (vehicle of vehicles; track vehicle.vehicleId) {
                <mat-option [value]="vehicle">
                  <mat-icon>directions_car</mat-icon>
                  {{ vehicle.registration }} 
                  @if (vehicle.vehicleName && vehicle.vehicleName !== vehicle.registration) {
                    - {{ vehicle.vehicleName }}
                  }
                </mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (selectedVehicle) {
            <div class="camera-chips">
              <span class="camera-label">Cameras:</span>
              @for (cameraId of availableCameras; track cameraId) {
                <mat-chip-option 
                  [selected]="selectedCameras.includes(cameraId)"
                  (click)="toggleCamera(cameraId)"
                  [class.selected]="selectedCameras.includes(cameraId)">
                  <mat-icon>{{ getCameraIcon(cameraId) }}</mat-icon>
                  {{ getCameraName(cameraId) }}
                </mat-chip-option>
              }
            </div>
            
            <button mat-raised-button color="primary" 
                    [disabled]="selectedCameras.length === 0 || loading" 
                    (click)="startStreaming()">
              @if (loading) {
                <mat-spinner diameter="20"></mat-spinner>
              } @else {
                <mat-icon>play_circle</mat-icon>
              }
              {{ streaming ? 'Refresh Streams' : 'Start Streaming' }}
            </button>
          }
        </div>

        @if (loading) {
          <div class="loading-container">
            <mat-spinner diameter="48"></mat-spinner>
            <p>Requesting live streams...</p>
          </div>
        }

        @if (error) {
          <div class="error-container">
            <mat-icon>error_outline</mat-icon>
            <p>{{ error }}</p>
            <button mat-raised-button color="primary" (click)="retryStreaming()">
              <mat-icon>refresh</mat-icon> Retry
            </button>
          </div>
        }

        @if (streaming && streams.length > 0) {
          <div class="streams-grid" [class.single]="streams.length === 1" [class.dual]="streams.length === 2">
            @for (stream of streams; track stream.cameraId) {
              <div class="stream-container">
                <div class="stream-header">
                  <span class="camera-name">
                    <mat-icon>{{ getCameraIcon(stream.cameraId) }}</mat-icon>
                    {{ stream.cameraName }}
                  </span>
                  <span class="live-indicator">
                    <mat-icon>fiber_manual_record</mat-icon>
                    LIVE
                  </span>
                </div>
                <div class="video-wrapper">
                  @if (stream.streamUrl) {
                    <video 
                      [src]="stream.streamUrl" 
                      autoplay 
                      muted 
                      playsinline
                      controls
                      (error)="onVideoError(stream)"
                      (loadeddata)="onVideoLoaded(stream)">
                      Your browser does not support video streaming.
                    </video>
                  } @else {
                    <div class="no-stream">
                      <mat-icon>videocam_off</mat-icon>
                      <p>Stream unavailable</p>
                    </div>
                  }
                  @if (stream.loading) {
                    <div class="video-loading">
                      <mat-spinner diameter="32"></mat-spinner>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }

        @if (!streaming && !loading && !error) {
          <div class="placeholder">
            <mat-icon>live_tv</mat-icon>
            <h3>CarTrack Vision Live Streaming</h3>
            <p>Select a vehicle and cameras to start live streaming</p>
            <div class="features">
              <div class="feature">
                <mat-icon>hd</mat-icon>
                <span>HD Quality</span>
              </div>
              <div class="feature">
                <mat-icon>speed</mat-icon>
                <span>Real-time</span>
              </div>
              <div class="feature">
                <mat-icon>security</mat-icon>
                <span>Secure</span>
              </div>
            </div>
          </div>
        }

        @if (vehicles.length === 0 && !loadingVehicles) {
          <div class="no-vehicles">
            <mat-icon>warning</mat-icon>
            <p>No Vision-enabled vehicles found</p>
            <span>Contact CarTrack to enable Vision on your fleet</span>
          </div>
        }
      </div>

      <mat-dialog-actions align="end">
        @if (streaming) {
          <button mat-button color="warn" (click)="stopStreaming()">
            <mat-icon>stop</mat-icon> Stop Streaming
          </button>
        }
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .livestream-dialog { width: 100%; overflow: hidden; }
    
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 32px;
      background: linear-gradient(135deg, #ff416c, #ff4b2b);
      color: white;
      margin: -24px -24px 0 -24px;
    }
    
    .dialog-header h2 {
      margin: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 22px;
    }
    
    .dialog-header button { color: white; }
    
    .live-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(255,255,255,0.2);
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      margin-left: 12px;
    }
    
    .live-dot {
      font-size: 12px !important;
      width: 12px !important;
      height: 12px !important;
      animation: pulse-live 1.5s infinite;
    }
    
    @keyframes pulse-live {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    
    .dialog-content {
      padding: 24px;
      min-height: 400px;
    }
    
    .vehicle-selector {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e0e0e0;
    }
    
    .vehicle-select {
      min-width: 280px;
    }
    
    .camera-chips {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      flex: 1;
    }
    
    .camera-label {
      font-weight: 500;
      color: #666;
      margin-right: 8px;
    }
    
    mat-chip-option {
      cursor: pointer;
    }
    
    mat-chip-option.selected {
      background: #ff416c !important;
      color: white !important;
    }
    
    mat-chip-option mat-icon {
      font-size: 18px;
      margin-right: 4px;
    }
    
    .streams-grid {
      display: grid;
      gap: 20px;
      grid-template-columns: repeat(2, 1fr);
    }
    
    .streams-grid.single {
      grid-template-columns: 1fr;
      max-width: 800px;
      margin: 0 auto;
    }
    
    .streams-grid.dual {
      grid-template-columns: repeat(2, 1fr);
    }
    
    .stream-container {
      background: #1a1a1a;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    
    .stream-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: #2a2a2a;
      color: white;
    }
    
    .camera-name {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    
    .camera-name mat-icon {
      font-size: 20px;
    }
    
    .stream-header .live-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #ff4444;
      font-size: 12px;
      font-weight: 600;
    }
    
    .stream-header .live-indicator mat-icon {
      font-size: 10px;
      width: 10px;
      height: 10px;
      animation: pulse-live 1.5s infinite;
    }
    
    .video-wrapper {
      position: relative;
      aspect-ratio: 16/9;
      background: #000;
    }
    
    .video-wrapper video {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    
    .video-loading {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.7);
    }
    
    .no-stream {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #666;
    }
    
    .no-stream mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }
    
    .loading-container,
    .error-container,
    .placeholder,
    .no-vehicles {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      text-align: center;
      color: #666;
    }
    
    .loading-container mat-spinner {
      margin-bottom: 16px;
    }
    
    .error-container mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #f44336;
      margin-bottom: 16px;
    }
    
    .error-container button {
      margin-top: 16px;
    }
    
    .placeholder mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #ff416c;
      margin-bottom: 16px;
    }
    
    .placeholder h3 {
      margin: 0 0 8px 0;
      color: #333;
    }
    
    .placeholder p {
      margin: 0 0 24px 0;
    }
    
    .features {
      display: flex;
      gap: 32px;
    }
    
    .feature {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    
    .feature mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #ff416c;
    }
    
    .feature span {
      font-size: 12px;
      font-weight: 500;
    }
    
    .no-vehicles mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #ff9800;
      margin-bottom: 16px;
    }
    
    mat-dialog-actions {
      padding: 16px 32px;
      border-top: 1px solid #e0e0e0;
    }
    
    @media (max-width: 768px) {
      .vehicle-selector {
        flex-direction: column;
        align-items: stretch;
      }
      .vehicle-select {
        min-width: 100%;
      }
      .streams-grid {
        grid-template-columns: 1fr;
      }
      .features {
        flex-direction: column;
        gap: 16px;
      }
    }
  `]
})
export class LiveStreamingDialog implements OnInit {
  vehicles: VisionVehicle[] = [];
  selectedVehicle: VisionVehicle | null = null;
  selectedCameras: number[] = [1, 2]; // Default front and rear
  availableCameras = [1, 2, 3, 4, 5, 6, 7, 8];
  streams: StreamInfo[] = [];
  loading = false;
  loadingVehicles = true;
  streaming = false;
  error: string | null = null;

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { apiUrl: string },
    public dialogRef: MatDialogRef<LiveStreamingDialog>
  ) {}

  ngOnInit(): void {
    this.loadVehicles();
  }

  loadVehicles(): void {
    this.loadingVehicles = true;
    this.http.get<VisionVehicle[]>(`${this.data.apiUrl}/fleet/vision/vehicles`)
      .subscribe({
        next: (vehicles) => {
          this.vehicles = vehicles;
          this.loadingVehicles = false;
        },
        error: (err) => {
          console.error('Failed to load Vision vehicles:', err);
          this.loadingVehicles = false;
          this.snackBar.open('Failed to load vehicles', 'Close', { duration: 3000 });
        }
      });
  }

  onVehicleSelected(): void {
    this.streaming = false;
    this.streams = [];
    this.error = null;
  }

  toggleCamera(cameraId: number): void {
    const index = this.selectedCameras.indexOf(cameraId);
    if (index > -1) {
      this.selectedCameras.splice(index, 1);
    } else {
      this.selectedCameras.push(cameraId);
    }
    this.selectedCameras.sort((a, b) => a - b);
  }

  getCameraName(cameraId: number): string {
    const names: { [key: number]: string } = {
      1: 'Front',
      2: 'Rear',
      3: 'Driver',
      4: 'Cabin',
      5: 'Left',
      6: 'Right',
      7: 'Cargo',
      8: 'Aux'
    };
    return names[cameraId] || `Cam ${cameraId}`;
  }

  getCameraIcon(cameraId: number): string {
    const icons: { [key: number]: string } = {
      1: 'videocam',
      2: 'flip_camera_ios',
      3: 'person',
      4: 'airline_seat_recline_normal',
      5: 'chevron_left',
      6: 'chevron_right',
      7: 'inventory_2',
      8: 'camera_alt'
    };
    return icons[cameraId] || 'videocam';
  }

  startStreaming(): void {
    if (!this.selectedVehicle || this.selectedCameras.length === 0) return;

    this.loading = true;
    this.error = null;
    this.streams = this.selectedCameras.map(id => ({
      cameraId: id,
      cameraName: this.getCameraName(id),
      streamUrl: '',
      loading: true
    }));

    this.http.post<LivestreamResponse>(
      `${this.data.apiUrl}/fleet/vision/livestream/${this.selectedVehicle.registration}`,
      { cameras: this.selectedCameras }
    ).subscribe({
      next: (response) => {
        this.loading = false;
        this.streaming = true;
        
        if (response.streams && response.streams.length > 0) {
          this.streams = response.streams.map(s => ({
            cameraId: s.cameraId,
            cameraName: s.cameraName,
            streamUrl: s.streamUrl,
            thumbnailUrl: s.thumbnailUrl,
            loading: true
          }));
        } else {
          this.error = 'No streams available for this vehicle';
          this.streaming = false;
        }
      },
      error: (err) => {
        this.loading = false;
        this.streaming = false;
        console.error('Failed to start streaming:', err);
        
        if (err.status === 403) {
          this.error = err.error?.message || 'CarTrack Vision API is not enabled for your account. Please contact your CarTrack sales representative to enable this feature.';
        } else if (err.status === 404) {
          this.error = 'Vehicle not found or Vision not available for this vehicle.';
        } else {
          this.error = err.error?.message || 'Failed to start streaming. Please try again.';
        }
      }
    });
  }

  stopStreaming(): void {
    this.streaming = false;
    this.streams = [];
  }

  retryStreaming(): void {
    this.error = null;
    this.startStreaming();
  }

  onVideoLoaded(stream: StreamInfo): void {
    stream.loading = false;
  }

  onVideoError(stream: StreamInfo): void {
    stream.loading = false;
    console.error(`Video error for camera ${stream.cameraId}`);
  }
}

// ===========================
// REASSIGN LOAD DIALOG
// ===========================
@Component({
  selector: 'reassign-load-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>swap_horiz</mat-icon>
      Reassign Load: {{ data.load.loadNumber }}
    </h2>
    <mat-dialog-content style="min-height: 200px; padding-top: 20px;">
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Vehicle</mat-label>
          <mat-select [(ngModel)]="selectedVehicleId">
            <mat-option [value]="null">Unassigned</mat-option>
            @for (vehicle of data.vehicles; track vehicle.id) {
              <mat-option [value]="vehicle.id">
                {{ vehicle.registrationNumber }} - {{ vehicle.type || vehicle.vehicleTypeName }}
                @if (vehicle.currentDriver || vehicle.currentDriverName) {
                  <span style="color: #666; font-size: 0.85em;"> ({{ vehicle.currentDriver || vehicle.currentDriverName }})</span>
                }
              </mat-option>
            }
          </mat-select>
          <mat-hint>Current: {{ data.load.vehicleRegistration || 'Unassigned' }}</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Driver</mat-label>
          <mat-select [(ngModel)]="selectedDriverId">
            <mat-option [value]="null">Unassigned</mat-option>
            @for (driver of data.drivers; track driver.id) {
              <mat-option [value]="driver.id">
                {{ driver.firstName }} {{ driver.lastName }}
                @if (driver.status) {
                  <span [style.color]="driver.status === 'Available' ? '#4caf50' : '#ff9800'" style="font-size: 0.85em;"> ({{ driver.status }})</span>
                }
              </mat-option>
            }
          </mat-select>
          <mat-hint>Current: {{ data.load.driverName || 'Unassigned' }}</mat-hint>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onReassign()" [disabled]="!hasChanges()">
        <mat-icon>check</mat-icon>
        Reassign
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      overflow-y: visible;
    }
    
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class ReassignLoadDialog {
  selectedVehicleId: number | null = null;
  selectedDriverId: number | null = null;

  constructor(
    public dialogRef: MatDialogRef<ReassignLoadDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { load: any, vehicles: any[], drivers: any[] }
  ) {
    // Set initial values based on current assignments
    // Note: We'll need to match by name since we may not have IDs in ActiveLoad
  }

  hasChanges(): boolean {
    return this.selectedVehicleId !== null || this.selectedDriverId !== null;
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onReassign(): void {
    this.dialogRef.close({ 
      vehicleId: this.selectedVehicleId,
      driverId: this.selectedDriverId
    });
  }
}

// ===========================
// RESCHEDULE TRIPSHEET DIALOG
// ===========================
@Component({
  selector: 'reschedule-tripsheet-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatDatepickerModule,
    MatInputModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon style="color: #7b1fa2;">schedule</mat-icon>
      Reschedule: {{ data.tripNumber }}
    </h2>
    <mat-dialog-content style="min-height: 220px; padding-top: 16px;">
      <div style="display: flex; flex-direction: column; gap: 16px;">
        <!-- Current schedule info -->
        <div style="background: #f5f5f5; border-radius: 8px; padding: 12px; margin-bottom: 4px;">
          <div style="font-size: 12px; color: #666; font-weight: 500; margin-bottom: 6px;">CURRENT SCHEDULE</div>
          <div style="display: flex; gap: 20px; font-size: 13px;">
            <div><strong>Pickup:</strong> {{ data.currentPickupDate ? (data.currentPickupDate | date:'dd MMM yyyy') : 'Not set' }}
              {{ data.currentPickupTime ? formatTime(data.currentPickupTime) : '' }}</div>
            <div><strong>Delivery:</strong> {{ data.currentDeliveryDate ? (data.currentDeliveryDate | date:'dd MMM yyyy') : 'Not set' }}
              {{ data.currentDeliveryTime ? formatTime(data.currentDeliveryTime) : '' }}</div>
          </div>
        </div>

        <!-- New Pickup Date & Time -->
        <div style="display: flex; gap: 12px;">
          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>New Pickup Date</mat-label>
            <input matInput [matDatepicker]="pickupPicker" [(ngModel)]="newPickupDate">
            <mat-datepicker-toggle matSuffix [for]="pickupPicker"></mat-datepicker-toggle>
            <mat-datepicker #pickupPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline" style="flex: 0.7;">
            <mat-label>Time</mat-label>
            <input matInput type="time" [(ngModel)]="newPickupTime">
          </mat-form-field>
        </div>

        <!-- New Delivery Date & Time -->
        <div style="display: flex; gap: 12px;">
          <mat-form-field appearance="outline" style="flex: 1;">
            <mat-label>New Delivery Date</mat-label>
            <input matInput [matDatepicker]="deliveryPicker" [(ngModel)]="newDeliveryDate">
            <mat-datepicker-toggle matSuffix [for]="deliveryPicker"></mat-datepicker-toggle>
            <mat-datepicker #deliveryPicker></mat-datepicker>
          </mat-form-field>

          <mat-form-field appearance="outline" style="flex: 0.7;">
            <mat-label>Time</mat-label>
            <input matInput type="time" [(ngModel)]="newDeliveryTime">
          </mat-form-field>
        </div>

        <!-- Reason -->
        <mat-form-field appearance="outline" style="width: 100%;">
          <mat-label>Reason for Reschedule</mat-label>
          <input matInput [(ngModel)]="reason" placeholder="e.g. Driver unavailable, vehicle in maintenance...">
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onReschedule()" [disabled]="!hasChanges()">
        <mat-icon>schedule</mat-icon>
        Reschedule
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { overflow-y: visible; }
    h2 { display: flex; align-items: center; gap: 8px; }
    h2 mat-icon { font-size: 28px; width: 28px; height: 28px; }
  `]
})
export class RescheduleTripsheetDialog {
  newPickupDate: Date | null = null;
  newDeliveryDate: Date | null = null;
  newPickupTime: string = '';
  newDeliveryTime: string = '';
  reason: string = '';

  constructor(
    public dialogRef: MatDialogRef<RescheduleTripsheetDialog>,
    @Inject(MAT_DIALOG_DATA) public data: {
      tripNumber: string;
      currentPickupDate: string | null;
      currentPickupTime: string | null;
      currentDeliveryDate: string | null;
      currentDeliveryTime: string | null;
    }
  ) {
    // Pre-populate with current values
    if (data.currentPickupDate) this.newPickupDate = new Date(data.currentPickupDate);
    if (data.currentDeliveryDate) this.newDeliveryDate = new Date(data.currentDeliveryDate);
    if (data.currentPickupTime) this.newPickupTime = this.extractTime(data.currentPickupTime);
    if (data.currentDeliveryTime) this.newDeliveryTime = this.extractTime(data.currentDeliveryTime);
    // Remember original calendar days so we only send fields the user actually changes.
    this.origPickupDay = this.newPickupDate ? this.dayKey(this.newPickupDate) : '';
    this.origDeliveryDay = this.newDeliveryDate ? this.dayKey(this.newDeliveryDate) : '';
  }

  private origPickupDay = '';
  private origDeliveryDay = '';

  private dayKey(d: Date): string {
    const x = new Date(d);
    return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
  }

  extractTime(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    } catch {
      return '';
    }
  }

  formatTime(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  hasChanges(): boolean {
    return this.newPickupDate !== null || this.newDeliveryDate !== null ||
           this.newPickupTime !== '' || this.newDeliveryTime !== '';
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onReschedule(): void {
    const result: any = { reason: this.reason };

    // Build a local ISO string (no UTC conversion) so the picked calendar day
    // is preserved. Using toISOString() would shift the date backwards for
    // UTC+ timezones (e.g. SAST/UTC+2), causing "28th" to be stored as "27th".
    const toLocalIso = (date: Date, time?: string): string => {
      const d = new Date(date);
      if (time) {
        const [h, m] = time.split(':');
        d.setHours(parseInt(h), parseInt(m), 0, 0);
      } else {
        // Default to midday to keep the day stable across any timezone rendering.
        d.setHours(12, 0, 0, 0);
      }
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    };

    // Only emit a date if the user actually changed its calendar day. This lets
    // the caller mirror a single changed date onto both pickup & delivery so the
    // two never diverge (which previously caused the two views to disagree).
    const pickupChanged = this.newPickupDate && this.dayKey(this.newPickupDate) !== this.origPickupDay;
    const deliveryChanged = this.newDeliveryDate && this.dayKey(this.newDeliveryDate) !== this.origDeliveryDay;

    if (pickupChanged) {
      result.scheduledPickupDate = toLocalIso(this.newPickupDate!, this.newPickupTime || undefined);
    }
    if (this.newPickupTime) {
      const base = this.newPickupDate ? new Date(this.newPickupDate) : new Date();
      result.scheduledPickupTime = toLocalIso(base, this.newPickupTime);
    }
    if (deliveryChanged) {
      result.scheduledDeliveryDate = toLocalIso(this.newDeliveryDate!, this.newDeliveryTime || undefined);
    }
    if (this.newDeliveryTime) {
      const base = this.newDeliveryDate ? new Date(this.newDeliveryDate) : new Date();
      result.scheduledDeliveryTime = toLocalIso(base, this.newDeliveryTime);
    }

    this.dialogRef.close(result);
  }
}

interface VisionVehicle {
  vehicleId: string;
  registration: string;
  vehicleName?: string;
  hasVision: boolean;
  availableCameras: number[];
}

interface StreamInfo {
  cameraId: number;
  cameraName: string;
  streamUrl: string;
  thumbnailUrl?: string;
  loading?: boolean;
}

interface LivestreamResponse {
  vehicleRegistration: string;
  streams: {
    cameraId: number;
    cameraName: string;
    streamUrl: string;
    thumbnailUrl?: string;
  }[];
}

// Reassign Province Dialog Component
@Component({
  selector: 'reassign-province-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatSelectModule,
    MatFormFieldModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>place</mat-icon>
      Reassign Province: {{ data.vehicle.registrationNumber }}
    </h2>
    <mat-dialog-content style="min-height: 150px; padding-top: 20px;">
      <mat-form-field appearance="outline" style="width: 100%;">
        <mat-label>Province (Warehouse Location)</mat-label>
        <mat-select [(ngModel)]="selectedProvince">
          <mat-option value="Gauteng">Gauteng (GP)</mat-option>
          <mat-option value="KwaZulu-Natal">KwaZulu-Natal (KZN)</mat-option>
          <mat-option value="Western Cape">Western Cape (CPT)</mat-option>
          <mat-option value="Eastern Cape">Eastern Cape (EC)</mat-option>
        </mat-select>
        <mat-hint>Current: {{ data.vehicle.province || 'Not Set' }}</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="onAssign()" [disabled]="!selectedProvince">
        <mat-icon>check</mat-icon>
        Assign
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content {
      overflow-y: visible;
    }
    
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `]
})
export class ReassignProvinceDialog {
  selectedProvince: string = '';

  constructor(
    public dialogRef: MatDialogRef<ReassignProvinceDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicle: any }
  ) {
    this.selectedProvince = data.vehicle.province || '';
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onAssign(): void {
    this.dialogRef.close({ province: this.selectedProvince });
  }
}

// ===========================
// VEHICLE STATUS DIALOG
// ===========================
@Component({
  selector: 'vehicle-status-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule
  ],
  template: `
    <h2 mat-dialog-title class="vs-title">
      <mat-icon style="color: #1e88e5;">directions_car</mat-icon>
      Fleet Status Overview
      <span class="vs-total">{{ data.vehicles.length }} vehicles</span>
    </h2>
    <mat-dialog-content class="vs-content">
      <!-- Search -->
      <mat-form-field appearance="outline" class="vs-search">
        <mat-label>Search vehicles...</mat-label>
        <input matInput [(ngModel)]="searchTerm" (ngModelChange)="filterVehicles()" placeholder="Registration, type, driver...">
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>

      <!-- Summary chips -->
      <div class="vs-summary">
        <div class="vs-chip available" (click)="filterByStatus('Available')">
          <mat-icon>check_circle</mat-icon>
          <span>Available: {{ statusCounts.available }}</span>
        </div>
        <div class="vs-chip maintenance" (click)="filterByStatus('Under Maintenance')">
          <mat-icon>build</mat-icon>
          <span>Maintenance: {{ statusCounts.maintenance }}</span>
        </div>
        <div class="vs-chip assigned" (click)="filterByStatus('In Use')">
          <mat-icon>local_shipping</mat-icon>
          <span>In Use: {{ statusCounts.inUse }}</span>
        </div>
        <div class="vs-chip decommissioned" (click)="filterByStatus('Decommissioned')">
          <mat-icon>block</mat-icon>
          <span>Decommissioned: {{ statusCounts.decommissioned }}</span>
        </div>
        <div class="vs-chip unavailable" (click)="filterByStatus('Unavailable')">
          <mat-icon>cancel</mat-icon>
          <span>Unavailable: {{ statusCounts.unavailable }}</span>
        </div>
        @if (activeFilter) {
          <div class="vs-chip clear" (click)="clearFilter()">
            <mat-icon>clear</mat-icon>
            <span>Clear Filter</span>
          </div>
        }
      </div>

      <!-- Vehicle list -->
      <div class="vs-list">
        @for (vehicle of filteredVehicles; track vehicle.id) {
          <div class="vs-vehicle-row" [class]="'status-' + getStatusClass(vehicle.status)">
            <div class="vs-status-indicator" [class]="'bg-' + getStatusClass(vehicle.status)"></div>
            <div class="vs-vehicle-info">
              <div class="vs-reg">{{ vehicle.registrationNumber }}</div>
              <div class="vs-details">
                {{ vehicle.type || vehicle.vehicleTypeName || 'Unknown Type' }}
                @if (vehicle.currentDriverName || vehicle.currentDriver) {
                  <span class="vs-driver">
                    <mat-icon class="vs-mini-icon">person</mat-icon>
                    {{ vehicle.currentDriverName || vehicle.currentDriver }}
                  </span>
                }
              </div>
            </div>
            <div class="vs-vehicle-meta">
              @if (vehicle.province) {
                <span class="vs-province">{{ vehicle.province }}</span>
              }
              <span class="vs-status-badge" [class]="'badge-' + getStatusClass(vehicle.status)">
                {{ vehicle.status }}
              </span>
            </div>
          </div>
        }
        @if (filteredVehicles.length === 0) {
          <div class="vs-empty">
            <mat-icon>search_off</mat-icon>
            <span>No vehicles match your search</span>
          </div>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .vs-title {
      display: flex; align-items: center; gap: 8px; margin: 0; font-size: 20px;
    }
    .vs-total {
      margin-left: auto; font-size: 13px; color: #888; font-weight: 400;
    }
    .vs-content {
      padding: 0 4px !important; max-height: 70vh;
    }
    .vs-search {
      width: 100%; margin-bottom: 8px;
    }
    .vs-summary {
      display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;
    }
    .vs-chip {
      display: flex; align-items: center; gap: 4px; padding: 6px 12px;
      border-radius: 20px; font-size: 12px; font-weight: 500; cursor: pointer;
      transition: all 0.2s; border: 1px solid transparent;
    }
    .vs-chip:hover { transform: scale(1.05); }
    .vs-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .vs-chip.available { background: #e8f5e9; color: #2e7d32; }
    .vs-chip.maintenance { background: #fff3e0; color: #e65100; }
    .vs-chip.assigned { background: #e3f2fd; color: #1565c0; }
    .vs-chip.decommissioned { background: #fce4ec; color: #c62828; }
    .vs-chip.unavailable { background: #f3e5f5; color: #6a1b9a; }
    .vs-chip.clear { background: #eceff1; color: #455a64; }

    .vs-list {
      display: flex; flex-direction: column; gap: 4px;
    }
    .vs-vehicle-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border-radius: 8px; background: #fafafa; transition: all 0.2s;
      border-left: 4px solid transparent;
    }
    .vs-vehicle-row:hover { background: #f0f0f0; }
    .vs-vehicle-row.status-available { border-left-color: #4caf50; }
    .vs-vehicle-row.status-maintenance { border-left-color: #ff9800; }
    .vs-vehicle-row.status-inuse { border-left-color: #2196f3; }
    .vs-vehicle-row.status-decommissioned { border-left-color: #f44336; }
    .vs-vehicle-row.status-unavailable { border-left-color: #9c27b0; }

    .vs-status-indicator {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
    }
    .bg-available { background: #4caf50; }
    .bg-maintenance { background: #ff9800; }
    .bg-inuse { background: #2196f3; }
    .bg-decommissioned { background: #f44336; }
    .bg-unavailable { background: #9c27b0; }

    .vs-vehicle-info { flex: 1; min-width: 0; }
    .vs-reg { font-weight: 600; font-size: 14px; color: #212121; }
    .vs-details { font-size: 12px; color: #666; display: flex; align-items: center; gap: 8px; }
    .vs-driver { display: inline-flex; align-items: center; gap: 2px; color: #1565c0; }
    .vs-mini-icon { font-size: 14px !important; width: 14px !important; height: 14px !important; }

    .vs-vehicle-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .vs-province { font-size: 11px; color: #888; background: #f5f5f5; padding: 2px 8px; border-radius: 10px; }
    .vs-status-badge {
      font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 12px;
    }
    .badge-available { background: #e8f5e9; color: #2e7d32; }
    .badge-maintenance { background: #fff3e0; color: #e65100; }
    .badge-inuse { background: #e3f2fd; color: #1565c0; }
    .badge-decommissioned { background: #fce4ec; color: #c62828; }
    .badge-unavailable { background: #f3e5f5; color: #6a1b9a; }

    .vs-empty {
      display: flex; flex-direction: column; align-items: center; gap: 8px;
      padding: 32px; color: #999;
    }
    .vs-empty mat-icon { font-size: 40px; width: 40px; height: 40px; opacity: 0.5; }
  `]
})
export class VehicleStatusDialog {
  searchTerm = '';
  activeFilter = '';
  filteredVehicles: any[] = [];
  statusCounts = { available: 0, maintenance: 0, inUse: 0, decommissioned: 0, unavailable: 0 };

  constructor(
    public dialogRef: MatDialogRef<VehicleStatusDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { vehicles: any[] }
  ) {
    this.computeCounts();
    this.filteredVehicles = this.sortVehicles([...data.vehicles]);
  }

  computeCounts(): void {
    const v = this.data.vehicles;
    this.statusCounts = {
      available: v.filter(x => x.status === 'Available').length,
      maintenance: v.filter(x => x.status === 'Under Maintenance').length,
      inUse: v.filter(x => x.status === 'In Use' || x.status === 'Assigned' || x.status === 'In Transit').length,
      decommissioned: v.filter(x => x.status === 'Decommissioned').length,
      unavailable: v.filter(x => x.status === 'Unavailable').length
    };
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Available': return 'available';
      case 'Under Maintenance': return 'maintenance';
      case 'In Use': case 'Assigned': case 'In Transit': return 'inuse';
      case 'Decommissioned': return 'decommissioned';
      default: return 'unavailable';
    }
  }

  filterByStatus(status: string): void {
    if (this.activeFilter === status) {
      this.clearFilter();
      return;
    }
    this.activeFilter = status;
    this.applyFilters();
  }

  clearFilter(): void {
    this.activeFilter = '';
    this.applyFilters();
  }

  filterVehicles(): void {
    this.applyFilters();
  }

  private applyFilters(): void {
    let result = [...this.data.vehicles];

    if (this.activeFilter) {
      if (this.activeFilter === 'In Use') {
        result = result.filter(v => v.status === 'In Use' || v.status === 'Assigned' || v.status === 'In Transit');
      } else {
        result = result.filter(v => v.status === this.activeFilter);
      }
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(v =>
        (v.registrationNumber || '').toLowerCase().includes(term) ||
        (v.type || v.vehicleTypeName || '').toLowerCase().includes(term) ||
        (v.currentDriverName || v.currentDriver || '').toLowerCase().includes(term) ||
        (v.province || '').toLowerCase().includes(term) ||
        (v.status || '').toLowerCase().includes(term)
      );
    }

    this.filteredVehicles = this.sortVehicles(result);
  }

  private sortVehicles(vehicles: any[]): any[] {
    const order: Record<string, number> = {
      'Available': 0, 'In Use': 1, 'Assigned': 1, 'In Transit': 1,
      'Under Maintenance': 2, 'Unavailable': 3, 'Decommissioned': 4
    };
    return vehicles.sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Welly AI Tripsheet Wizard Dialog
// Multi-step wizard: Upload  >  Analysis  >  Warehouse  >  Addresses  >  Driver/Vehicle  >  Confirm
// ═══════════════════════════════════════════════════════════════════════
@Component({
  selector: 'welly-tripsheet-wizard-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatAutocompleteModule
  ],
  template: `
    <div class="welly-wizard">
      <!-- Header -->
      <div class="wizard-header">
        <div class="header-left">
          <div class="welly-avatar">
            <mat-icon>smart_toy</mat-icon>
          </div>
          <div>
            <h2>Welly's Tripsheet Wizard</h2>
            <p class="header-sub">{{ stepDescriptions[currentStep] }}</p>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Step indicator -->
      <div class="step-bar">
        @for (step of steps; track step.id; let i = $index) {
          <div class="step-dot" [class.active]="i === currentStep" [class.completed]="i < currentStep"
               [matTooltip]="step.label">
            <span class="dot">
              @if (i < currentStep) { <mat-icon>check</mat-icon> }
              @else { {{ i + 1 }} }
            </span>
            <span class="step-label">{{ step.label }}</span>
          </div>
          @if (i < steps.length - 1) {
            <div class="step-line" [class.completed]="i < currentStep"></div>
          }
        }
      </div>

      <!-- Content Area -->
      <div class="wizard-content">

        <!-- STEP 0: Upload -->
        @if (currentStep === 0) {
          <div class="step-upload">
            <div class="welly-says">
              <mat-icon class="welly-icon">smart_toy</mat-icon>
              <div class="bubble">
                Hi! Upload your Excel file and I'll analyze it — finding customers, matching invoices,
                resolving addresses, and setting up an optimized tripsheet for you. 🚛
              </div>
            </div>
            <div class="upload-zone" (click)="fileInput.click()"
                 (dragover)="onDragOver($event)" (drop)="onDrop($event)"
                 [class.has-file]="selectedFile">
              <input #fileInput type="file" accept=".xlsx" (change)="onFileSelected($event)" hidden>
              @if (!selectedFile) {
                <mat-icon class="upload-icon">cloud_upload</mat-icon>
                <h3>Drop your Excel file here</h3>
                <p>or click to browse — .xlsx files up to 10MB</p>
              } @else {
                <mat-icon class="upload-icon done">description</mat-icon>
                <h3>{{ selectedFile.name }}</h3>
                <p>{{ (selectedFile.size / 1024).toFixed(1) }} KB — Ready to analyze</p>
              }
            </div>
            <div class="step-actions">
              <button mat-button mat-dialog-close>Cancel</button>
              <button mat-raised-button color="primary" (click)="analyzeExcel()" [disabled]="!selectedFile || analyzing">
                @if (analyzing) {
                  <mat-spinner diameter="20"></mat-spinner> Welly is analyzing...
                } @else {
                  <mat-icon>auto_awesome</mat-icon> Analyze with Welly
                }
              </button>
            </div>
          </div>
        }

        <!-- STEP 1: Analysis Results -->
        @if (currentStep === 1) {
          <div class="step-analysis">
            <div class="welly-says">
              <mat-icon class="welly-icon">smart_toy</mat-icon>
              <div class="bubble">
                I found <strong>{{ analysisResult.totalRows }}</strong> delivery rows!
                <span class="badge ok">{{ analysisResult.matched }} matched</span>
                @if (analysisResult.partialMatch > 0) {
                  <span class="badge warn">{{ analysisResult.partialMatch }} partial</span>
                }
                @if (analysisResult.unmatched > 0) {
                  <span class="badge err">{{ analysisResult.unmatched }} unmatched</span>
                }
                @if (analysisResult.errors > 0) {
                  <span class="badge err">{{ analysisResult.errors }} errors</span>
                }
                — Review below and I'll handle the rest!
              </div>
            </div>

            <div class="analysis-table-wrap">
              <table class="analysis-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Address</th>
                    <th>City</th>
                    <th>Qty</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of analysisResult.rows; track row.rowIndex) {
                    <tr [class.error-row]="row.status === 'Error'" [class.warn-row]="row.status === 'PartialMatch' || row.status === 'Unmatched'">
                      <td>
                        @if (row.status === 'Matched') { <mat-icon class="s-ok">check_circle</mat-icon> }
                        @else if (row.status === 'PartialMatch') { <mat-icon class="s-warn">help</mat-icon> }
                        @else if (row.status === 'Unmatched') { <mat-icon class="s-warn">warning</mat-icon> }
                        @else { <mat-icon class="s-err">error</mat-icon> }
                      </td>
                      <td>{{ row.data?.invoiceNumber || '—' }}</td>
                      <td>{{ row.data?.customerName || '—' }}</td>
                      <td class="addr-cell">{{ row.data?.deliveryAddress || '—' }}</td>
                      <td>{{ row.data?.city || '—' }}</td>
                      <td class="num">{{ row.data?.quantity || 0 }}</td>
                      <td class="num">R{{ (row.data?.salesAmount || 0) | number:'1.2-2' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <div class="step-actions">
              <button mat-button (click)="currentStep = 0">
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-raised-button color="primary" (click)="proceedToWarehouse()">
                Next: Select Warehouse <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        }

        <!-- STEP 2: Warehouse Selection -->
        @if (currentStep === 2) {
          <div class="step-warehouse">
            <div class="welly-says">
              <mat-icon class="welly-icon">smart_toy</mat-icon>
              <div class="bubble">
                @if (analysisResult.suggestedWarehouseId) {
                  Based on the delivery locations, I suggest dispatching from
                  <strong>{{ getWarehouseName(analysisResult.suggestedWarehouseId) }}</strong>.
                  You can change this if needed.
                } @else {
                  Which warehouse should these deliveries originate from?
                }
              </div>
            </div>

            <div class="warehouse-cards">
              @for (wh of analysisResult.warehouses; track wh.id) {
                <div class="wh-card" [class.selected]="selectedWarehouseId === wh.id"
                     (click)="selectedWarehouseId = wh.id">
                  <mat-icon>warehouse</mat-icon>
                  <div class="wh-info">
                    <strong>{{ wh.name }}</strong>
                    <span>{{ wh.city }}, {{ wh.province }}</span>
                    <span class="wh-mgr">Manager: {{ wh.managerName || 'N/A' }}</span>
                  </div>
                  @if (selectedWarehouseId === wh.id) {
                    <mat-icon class="wh-check">check_circle</mat-icon>
                  }
                </div>
              }
            </div>

            <div class="step-actions">
              <button mat-button (click)="currentStep = 1">
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-raised-button color="primary" (click)="proceedToAddresses()" [disabled]="!selectedWarehouseId">
                Next: Check Addresses <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        }

        <!-- STEP 3: Address Resolution -->
        @if (currentStep === 3) {
          <div class="step-addresses">
            <div class="welly-says">
              <mat-icon class="welly-icon">smart_toy</mat-icon>
              <div class="bubble">
                @if (addressIssueRows.length === 0) {
                  All addresses look good! ✅ No issues found.
                } @else {
                  I found <strong>{{ addressIssueRows.length }}</strong> rows with missing or unclear addresses.
                  Please fill in the correct addresses below so I can include them in the route.
                }
              </div>
            </div>

            @if (addressIssueRows.length > 0) {
              <div class="address-fix-list">
                @for (row of addressIssueRows; track row.rowIndex) {
                  <div class="address-fix-card">
                    <div class="afc-header">
                      <mat-icon class="s-warn">location_off</mat-icon>
                      <strong>{{ row.data?.customerName || 'Unknown' }}</strong>
                      <span class="inv-chip">{{ row.data?.invoiceNumber || '—' }}</span>
                    </div>
                    <div class="afc-fields">
                      <mat-form-field appearance="outline" class="addr-field">
                        <mat-label>Delivery Address</mat-label>
                        <input matInput [(ngModel)]="row.data.deliveryAddress" 
                               [matAutocomplete]="wizardAddrAuto"
                               (input)="onWizardAddressInput(row, $event)"
                               placeholder="Start typing address...">
                        <mat-autocomplete #wizardAddrAuto="matAutocomplete" (optionSelected)="onWizardAddressSelected(row, $event)">
                          @for (prediction of wizardAddressPredictions; track $index) {
                            <mat-option [value]="prediction.description">
                              <mat-icon>place</mat-icon>
                              <span>{{ prediction.description }}</span>
                            </mat-option>
                          }
                        </mat-autocomplete>
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="city-field">
                        <mat-label>City</mat-label>
                        <input matInput [(ngModel)]="row.data.city" placeholder="e.g. Durban">
                      </mat-form-field>
                      <mat-form-field appearance="outline" class="prov-field">
                        <mat-label>Province</mat-label>
                        <mat-select [(ngModel)]="row.data.province">
                          <mat-option value="Gauteng">Gauteng</mat-option>
                          <mat-option value="KwaZulu-Natal">KwaZulu-Natal</mat-option>
                          <mat-option value="Western Cape">Western Cape</mat-option>
                          <mat-option value="Eastern Cape">Eastern Cape</mat-option>
                          <mat-option value="Free State">Free State</mat-option>
                          <mat-option value="Limpopo">Limpopo</mat-option>
                          <mat-option value="Mpumalanga">Mpumalanga</mat-option>
                          <mat-option value="North West">North West</mat-option>
                          <mat-option value="Northern Cape">Northern Cape</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>
                  </div>
                }
              </div>
            }

            <div class="step-actions">
              <button mat-button (click)="currentStep = 2">
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-raised-button color="primary" (click)="proceedToDriverVehicle()">
                Next: Driver &amp; Vehicle <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        }

        <!-- STEP 4: Driver & Vehicle Assignment -->
        @if (currentStep === 4) {
          <div class="step-driver-vehicle">
            <div class="welly-says">
              <mat-icon class="welly-icon">smart_toy</mat-icon>
              <div class="bubble">
                @if (analysisResult.suggestedDriverId || analysisResult.suggestedVehicleId) {
                  I've pre-selected the least busy driver and vehicle for you. Feel free to change them!
                } @else {
                  Pick a driver and vehicle for this tripsheet, or leave blank to assign later.
                }
              </div>
            </div>

            <div class="dv-grid">
              <div class="dv-section">
                <h4><mat-icon>person</mat-icon> Driver</h4>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Select Driver</mat-label>
                  <mat-select [(ngModel)]="selectedDriverId">
                    <mat-option [value]="null">— Assign Later —</mat-option>
                    @for (d of analysisResult.drivers; track d.id) {
                      <mat-option [value]="d.id">
                        {{ d.name }} ({{ d.licenseType }}) {{ d.activeLoads === 0 ? '✅' : '⚠️ ' + d.activeLoads + ' active' }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="dv-section">
                <h4><mat-icon>local_shipping</mat-icon> Vehicle</h4>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Select Vehicle</mat-label>
                  <mat-select [(ngModel)]="selectedVehicleId">
                    <mat-option [value]="null">— Assign Later —</mat-option>
                    @for (v of analysisResult.vehicles; track v.id) {
                      <mat-option [value]="v.id">
                        {{ v.registrationNumber }} — {{ v.type }} ({{ v.make }} {{ v.model }}) {{ v.activeLoads === 0 ? '✅' : '⚠️' }}
                      </mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="dv-section">
                <h4><mat-icon>event</mat-icon> Schedule</h4>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Scheduled Date</mat-label>
                  <input matInput [matDatepicker]="schedulePicker" [(ngModel)]="scheduledDate">
                  <mat-datepicker-toggle matIconSuffix [for]="schedulePicker"></mat-datepicker-toggle>
                  <mat-datepicker #schedulePicker></mat-datepicker>
                </mat-form-field>
              </div>

              <div class="dv-section">
                <h4><mat-icon>notes</mat-icon> Notes</h4>
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Special Instructions</mat-label>
                  <textarea matInput [(ngModel)]="tripNotes" rows="3" placeholder="Any special instructions..."></textarea>
                </mat-form-field>
              </div>
            </div>

            <div class="step-actions">
              <button mat-button (click)="currentStep = 3">
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-raised-button color="primary" (click)="proceedToConfirm()">
                Next: Review &amp; Confirm <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        }

        <!-- STEP 5: Confirmation -->
        @if (currentStep === 5) {
          <div class="step-confirm">
            <div class="welly-says">
              <mat-icon class="welly-icon">smart_toy</mat-icon>
              <div class="bubble">
                Here's your tripsheet summary. Review everything and hit <strong>Create Tripsheet</strong> when you're happy!
                If I got something wrong, go back and fix it — I'll learn from your corrections. 🧠
              </div>
            </div>

            <div class="confirm-summary">
              <div class="summary-card">
                <mat-icon>description</mat-icon>
                <div><strong>{{ validRows.length }}</strong><span>Deliveries</span></div>
              </div>
              <div class="summary-card">
                <mat-icon>people</mat-icon>
                <div><strong>{{ uniqueCustomers }}</strong><span>Customers (Stops)</span></div>
              </div>
              <div class="summary-card">
                <mat-icon>payments</mat-icon>
                <div><strong>R{{ totalValue | number:'1.2-2' }}</strong><span>Total Value</span></div>
              </div>
              <div class="summary-card">
                <mat-icon>warehouse</mat-icon>
                <div><strong>{{ getWarehouseName(selectedWarehouseId) }}</strong><span>Warehouse</span></div>
              </div>
              <div class="summary-card">
                <mat-icon>person</mat-icon>
                <div><strong>{{ getDriverName(selectedDriverId) }}</strong><span>Driver</span></div>
              </div>
              <div class="summary-card">
                <mat-icon>local_shipping</mat-icon>
                <div><strong>{{ getVehicleName(selectedVehicleId) }}</strong><span>Vehicle</span></div>
              </div>
            </div>

            <div class="step-actions">
              <button mat-button (click)="currentStep = 4">
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-raised-button color="primary" (click)="createTripsheet()" [disabled]="creating"
                      class="create-btn">
                @if (creating) {
                  <mat-spinner diameter="20"></mat-spinner> Creating...
                } @else {
                  <mat-icon>rocket_launch</mat-icon> Create Tripsheet
                }
              </button>
            </div>
          </div>
        }

        <!-- STEP 6: Done -->
        @if (currentStep === 6) {
          <div class="step-done">
            <div class="done-icon">
              <mat-icon>check_circle</mat-icon>
            </div>
            <h2>Tripsheet Created! 🎉</h2>
            <p class="done-number">{{ createdTripsheetNumber }}</p>
            <p>{{ createdMessage }}</p>

            <div class="welly-says" style="margin-top: 24px;">
              <mat-icon class="welly-icon">smart_toy</mat-icon>
              <div class="bubble">
                Did I get everything right? If you made any corrections along the way, I've already noted them.
                I'll use those to do even better next time! 💪
              </div>
            </div>

            <div class="step-actions">
              <button mat-raised-button color="primary" (click)="dialogRef.close({ created: true })">
                <mat-icon>done</mat-icon> Done
              </button>
            </div>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .welly-wizard { display: flex; flex-direction: column; height: 100%; }
    .wizard-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px;
      background: linear-gradient(135deg, #00bcd4, #0097a7);
      color: white; margin: -24px -24px 0;
    }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .welly-avatar {
      width: 48px; height: 48px; border-radius: 50%;
      background: rgba(255,255,255,0.2); display: flex;
      align-items: center; justify-content: center;
    }
    .welly-avatar mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .wizard-header h2 { margin: 0; font-size: 20px; }
    .header-sub { margin: 2px 0 0; font-size: 13px; opacity: 0.9; }
    .wizard-header button { color: white; }

    .step-bar {
      display: flex; align-items: center; justify-content: center;
      padding: 20px 16px 12px; gap: 0;
    }
    .step-dot {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      min-width: 60px;
    }
    .dot {
      width: 32px; height: 32px; border-radius: 50%;
      background: #e0e0e0; color: #999; display: flex;
      align-items: center; justify-content: center;
      font-size: 13px; font-weight: 600; transition: all 0.3s;
    }
    .step-dot.active .dot { background: #00bcd4; color: white; }
    .step-dot.completed .dot { background: #4caf50; color: white; }
    .step-dot.completed .dot mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .step-label { font-size: 10px; color: #999; text-align: center; }
    .step-dot.active .step-label { color: #00bcd4; font-weight: 600; }
    .step-dot.completed .step-label { color: #4caf50; }
    .step-line {
      flex: 1; height: 2px; background: #e0e0e0;
      min-width: 20px; max-width: 60px; margin: 0 4px;
      margin-bottom: 18px; transition: background 0.3s;
    }
    .step-line.completed { background: #4caf50; }

    .wizard-content { flex: 1; overflow-y: auto; padding: 0 24px 24px; }

    .welly-says {
      display: flex; gap: 12px; align-items: flex-start; margin-bottom: 20px;
    }
    .welly-icon {
      color: #00bcd4; background: #e0f7fa; border-radius: 50%;
      padding: 8px; font-size: 24px; width: 24px; height: 24px;
      flex-shrink: 0;
    }
    .bubble {
      background: #f5f5f5; border-radius: 12px; padding: 12px 16px;
      font-size: 14px; line-height: 1.5; flex: 1;
      border: 1px solid #e0e0e0;
    }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; font-weight: 600; margin-left: 4px; }
    .badge.ok { background: #e8f5e9; color: #2e7d32; }
    .badge.warn { background: #fff3e0; color: #e65100; }
    .badge.err { background: #ffebee; color: #c62828; }

    /* Upload */
    .upload-zone {
      border: 2px dashed #bdbdbd; border-radius: 16px; padding: 48px 24px;
      text-align: center; cursor: pointer; transition: all 0.2s;
      margin: 16px 0;
    }
    .upload-zone:hover { border-color: #00bcd4; background: #e0f7fa; }
    .upload-zone.has-file { border-color: #4caf50; background: #e8f5e9; }
    .upload-icon { font-size: 48px !important; width: 48px !important; height: 48px !important; color: #bdbdbd; }
    .upload-icon.done { color: #4caf50; }
    .upload-zone h3 { margin: 12px 0 4px; color: #333; }
    .upload-zone p { margin: 0; color: #666; font-size: 13px; }

    .step-actions {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 16px; border-top: 1px solid #e0e0e0; margin-top: 16px;
    }
    .step-actions button mat-icon { margin-right: 4px; }

    /* Analysis table */
    .analysis-table-wrap { max-height: 350px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 8px; }
    .analysis-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .analysis-table th { background: #fafafa; padding: 8px 10px; text-align: left; font-weight: 600; position: sticky; top: 0; border-bottom: 2px solid #e0e0e0; }
    .analysis-table td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
    .analysis-table .s-ok { color: #4caf50; font-size: 18px; }
    .analysis-table .s-warn { color: #ff9800; font-size: 18px; }
    .analysis-table .s-err { color: #f44336; font-size: 18px; }
    .analysis-table .num { text-align: right; font-family: monospace; }
    .analysis-table .addr-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .error-row { background: #fff5f5; }
    .warn-row { background: #fffbf0; }

    /* Warehouse cards */
    .warehouse-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin: 8px 0; }
    .wh-card {
      display: flex; align-items: center; gap: 12px;
      border: 2px solid #e0e0e0; border-radius: 12px; padding: 16px;
      cursor: pointer; transition: all 0.2s;
    }
    .wh-card:hover { border-color: #00bcd4; background: #e0f7fa; }
    .wh-card.selected { border-color: #4caf50; background: #e8f5e9; }
    .wh-card mat-icon:first-child { font-size: 32px; width: 32px; height: 32px; color: #78909c; }
    .wh-info { display: flex; flex-direction: column; flex: 1; }
    .wh-info strong { font-size: 15px; }
    .wh-info span { font-size: 12px; color: #666; }
    .wh-mgr { font-style: italic; }
    .wh-check { color: #4caf50; }

    /* Address fixes */
    .address-fix-list { display: flex; flex-direction: column; gap: 12px; max-height: 400px; overflow-y: auto; }
    .address-fix-card { border: 1px solid #ffe0b2; border-radius: 10px; padding: 12px 16px; background: #fffbf0; }
    .afc-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .afc-header .s-warn { color: #ff9800; }
    .inv-chip { background: #e0e0e0; padding: 2px 8px; border-radius: 8px; font-size: 11px; margin-left: auto; }
    .afc-fields { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 8px; }
    .afc-fields mat-form-field { font-size: 13px; }

    /* Driver / Vehicle */
    .dv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .dv-section h4 { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; color: #333; }
    .full-width { width: 100%; }

    /* Confirm */
    .confirm-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 8px 0; }
    .summary-card {
      display: flex; align-items: center; gap: 12px;
      border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px;
      background: #fafafa;
    }
    .summary-card mat-icon { font-size: 28px; width: 28px; height: 28px; color: #00bcd4; }
    .summary-card div { display: flex; flex-direction: column; }
    .summary-card strong { font-size: 16px; color: #333; }
    .summary-card span { font-size: 11px; color: #999; }
    .create-btn { font-size: 15px !important; padding: 8px 24px !important; }

    /* Done */
    .step-done { text-align: center; padding: 32px 0; }
    .done-icon mat-icon { font-size: 72px; width: 72px; height: 72px; color: #4caf50; }
    .done-number { font-size: 28px; font-weight: 700; color: #00bcd4; margin: 8px 0; }
  `]
})
export class WellyTripsheetWizardDialog {
  steps = [
    { id: 0, label: 'Upload' },
    { id: 1, label: 'Analysis' },
    { id: 2, label: 'Warehouse' },
    { id: 3, label: 'Addresses' },
    { id: 4, label: 'Driver' },
    { id: 5, label: 'Confirm' },
    { id: 6, label: 'Done' }
  ];

  stepDescriptions = [
    'Upload your Excel file',
    'Review extracted data',
    'Select origin warehouse',
    'Resolve missing addresses',
    'Assign driver & vehicle',
    'Review & confirm',
    'Tripsheet created!'
  ];

  currentStep = 0;
  selectedFile: File | null = null;
  analyzing = false;
  creating = false;
  analysisResult: any = { rows: [], warehouses: [], drivers: [], vehicles: [] };
  addressIssueRows: any[] = [];

  selectedWarehouseId: number | null = null;
  selectedDriverId: number | null = null;
  selectedVehicleId: number | null = null;
  scheduledDate: Date = new Date();
  tripNotes = '';

  createdTripsheetNumber = '';
  createdMessage = '';
  corrections: any[] = [];

  // Google Places Autocomplete for address fields
  wizardAddressPredictions: any[] = [];
  private autocompleteService: any = null;
  private ngZone = inject(NgZone);

  private http = inject(HttpClient);

  constructor(
    public dialogRef: MatDialogRef<WellyTripsheetWizardDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    // Initialize Google Places autocomplete service
    this.initPlacesService();
  }

  private initPlacesService(): void {
    if (typeof google !== 'undefined' && google.maps && (google.maps as any).places) {
      this.autocompleteService = new (google.maps as any).places.AutocompleteService();
    }
  }

  // Google Places address input handler
  onWizardAddressInput(row: any, event: any): void {
    const query = event.target.value;
    if (query && query.length > 2) {
      this.searchWizardAddresses(query);
    } else {
      this.wizardAddressPredictions = [];
    }
  }

  // Search addresses using Google Places Autocomplete
  private searchWizardAddresses(query: string): void {
    if (!this.autocompleteService) {
      if (typeof google !== 'undefined' && google.maps && (google.maps as any).places) {
        this.autocompleteService = new (google.maps as any).places.AutocompleteService();
      } else {
        return;
      }
    }

    this.autocompleteService.getPlacePredictions({
      input: query,
      componentRestrictions: { country: 'za' }
    }, (predictions: any, status: any) => {
      this.ngZone.run(() => {
        if (status === (google.maps as any).places.PlacesServiceStatus.OK && predictions) {
          this.wizardAddressPredictions = predictions;
        } else {
          this.wizardAddressPredictions = [];
        }
      });
    });
  }

  // Handle autocomplete selection - parse address into components
  onWizardAddressSelected(row: any, event: any): void {
    const selectedAddress = event.option.value;
    row.data.deliveryAddress = selectedAddress;
    this.wizardAddressPredictions = [];

    // Try to extract city from the address
    const parts = selectedAddress.split(',').map((p: string) => p.trim());
    if (parts.length >= 2) {
      // Usually: "Street, Suburb, City, Province, Country"
      // Try to find the city (typically 2nd or 3rd from end before country)
      const cityCandidate = parts.length >= 3 ? parts[parts.length - 3] : parts[parts.length - 2];
      if (cityCandidate && !row.data.city) {
        row.data.city = cityCandidate;
      }
    }

    // Try to extract province
    const provinceMap: Record<string, string> = {
      'gauteng': 'Gauteng', 'gp': 'Gauteng',
      'kwazulu-natal': 'KwaZulu-Natal', 'kzn': 'KwaZulu-Natal',
      'western cape': 'Western Cape', 'wc': 'Western Cape',
      'eastern cape': 'Eastern Cape', 'ec': 'Eastern Cape',
      'free state': 'Free State', 'fs': 'Free State',
      'limpopo': 'Limpopo', 'lp': 'Limpopo',
      'mpumalanga': 'Mpumalanga', 'mp': 'Mpumalanga',
      'north west': 'North West', 'nw': 'North West',
      'northern cape': 'Northern Cape', 'nc': 'Northern Cape'
    };

    const addressLower = selectedAddress.toLowerCase();
    for (const [key, value] of Object.entries(provinceMap)) {
      if (addressLower.includes(key)) {
        if (!row.data.province) {
          row.data.province = value;
        }
        break;
      }
    }
  }

  // --- Upload ---
  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      this.selectedFile = file;
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      this.selectedFile = file;
    }
  }

  // --- Analyze ---
  analyzeExcel(): void {
    if (!this.selectedFile) return;
    this.analyzing = true;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    this.http.post<any>(`${this.data.apiUrl}/logistics/tripsheet/welly-analyze-excel`, formData).subscribe({
      next: (result) => {
        this.analysisResult = result;
        this.selectedWarehouseId = result.suggestedWarehouseId || null;
        this.selectedDriverId = result.suggestedDriverId || null;
        this.selectedVehicleId = result.suggestedVehicleId || null;

        // Build address issue rows
        this.addressIssueRows = (result.rows || []).filter((r: any) =>
          r.status !== 'Error' &&
          (!r.data?.deliveryAddress || r.data.deliveryAddress.trim() === '') &&
          (!r.data?.city || r.data.city.trim() === '')
        );

        this.analyzing = false;
        this.currentStep = 1;
      },
      error: (err) => {
        this.analyzing = false;
        alert('Analysis failed: ' + (err.error?.message || err.message));
      }
    });
  }

  // --- Navigation ---
  proceedToWarehouse(): void {
    this.currentStep = 2;
  }

  proceedToAddresses(): void {
    this.currentStep = 3;
  }

  proceedToDriverVehicle(): void {
    this.currentStep = 4;
  }

  proceedToConfirm(): void {
    this.currentStep = 5;
  }

  // --- Helpers ---
  get validRows(): any[] {
    return (this.analysisResult.rows || []).filter((r: any) => r.status !== 'Error');
  }

  get uniqueCustomers(): number {
    const names = new Set(this.validRows.map((r: any) => (r.data?.customerName || '').toLowerCase().trim()));
    return names.size;
  }

  get totalValue(): number {
    return this.validRows.reduce((sum: number, r: any) => sum + (r.data?.salesAmount || 0), 0);
  }

  getWarehouseName(id: number | null): string {
    if (!id) return 'Not selected';
    const wh = (this.analysisResult.warehouses || []).find((w: any) => w.id === id);
    return wh ? wh.name : 'Unknown';
  }

  getDriverName(id: number | null): string {
    if (!id) return 'Assign later';
    const d = (this.analysisResult.drivers || []).find((x: any) => x.id === id);
    return d ? d.name : 'Unknown';
  }

  getVehicleName(id: number | null): string {
    if (!id) return 'Assign later';
    const v = (this.analysisResult.vehicles || []).find((x: any) => x.id === id);
    return v ? v.registrationNumber : 'Unknown';
  }

  // --- Create ---
  createTripsheet(): void {
    this.creating = true;

    const body = {
      batchId: this.analysisResult.batchId,
      warehouseId: this.selectedWarehouseId,
      driverId: this.selectedDriverId,
      vehicleId: this.selectedVehicleId,
      scheduledDate: this.scheduledDate?.toISOString(),
      notes: this.tripNotes,
      optimizeRoute: true,
      rows: this.validRows.map((r: any) => ({
        rowIndex: r.rowIndex,
        customerName: r.data?.customerName,
        customerNumber: r.data?.customerNumber,
        deliveryAddress: r.data?.deliveryAddress,
        city: r.data?.city,
        province: r.data?.province,
        invoiceNumber: r.data?.invoiceNumber,
        productDescription: r.data?.productDescription,
        quantity: r.data?.quantity,
        salesAmount: r.data?.salesAmount,
        contactPerson: r.data?.contactPerson,
        contactPhone: r.data?.contactPhone,
        confirmedCustomerId: r.matchedCustomerId || null,
        confirmedInvoiceId: r.matchedInvoiceId || null,
        createNewCustomer: !r.matchedCustomerId
      }))
    };

    this.http.post<any>(`${this.data.apiUrl}/logistics/tripsheet/welly-create-tripsheet`, body).subscribe({
      next: (result) => {
        this.creating = false;
        this.createdTripsheetNumber = result.tripSheetNumber;
        this.createdMessage = result.message;
        this.currentStep = 6;

        // Send any corrections as feedback for learning
        this.sendFeedback(result.tripSheetNumber);
      },
      error: (err) => {
        this.creating = false;
        alert('Failed to create tripsheet: ' + (err.error?.message || err.message));
      }
    });
  }

  private sendFeedback(tripSheetNumber: string): void {
    // Collect corrections: address fixes the user entered
    const corrections: any[] = [];

    for (const row of this.addressIssueRows) {
      if (row.data?.deliveryAddress && row.data.deliveryAddress.trim() !== '') {
        corrections.push({
          type: 'address',
          original: 'Missing address',
          corrected: `${row.data.deliveryAddress}, ${row.data.city || ''}, ${row.data.province || ''}`,
          context: `Customer: ${row.data?.customerName || 'Unknown'}, Invoice: ${row.data?.invoiceNumber || 'N/A'}`
        });
      }
    }

    // Track warehouse selection if different from suggestion
    if (this.selectedWarehouseId !== this.analysisResult.suggestedWarehouseId) {
      corrections.push({
        type: 'warehouse',
        original: this.getWarehouseName(this.analysisResult.suggestedWarehouseId),
        corrected: this.getWarehouseName(this.selectedWarehouseId),
        context: `User changed warehouse from Welly suggestion`
      });
    }

    // Track driver change
    if (this.selectedDriverId !== this.analysisResult.suggestedDriverId) {
      corrections.push({
        type: 'driver',
        original: this.getDriverName(this.analysisResult.suggestedDriverId),
        corrected: this.getDriverName(this.selectedDriverId),
        context: `User changed driver from Welly suggestion`
      });
    }

    // Track vehicle change
    if (this.selectedVehicleId !== this.analysisResult.suggestedVehicleId) {
      corrections.push({
        type: 'vehicle',
        original: this.getVehicleName(this.analysisResult.suggestedVehicleId),
        corrected: this.getVehicleName(this.selectedVehicleId),
        context: `User changed vehicle from Welly suggestion`
      });
    }

    if (corrections.length > 0) {
      this.http.post(`${this.data.apiUrl}/logistics/tripsheet/welly-feedback`, {
        tripSheetNumber,
        corrections
      }).subscribe();
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// Welly Suggests Dialog — AI-batched tripsheet suggestions by warehouse
// ════════════════════════════════════════════════════════════════════════════════
@Component({
  selector: 'welly-suggests-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    MatCheckboxModule,
    MatBadgeModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatTabsModule
  ],
  template: `
    <div class="welly-suggests-dialog">
      <div class="dialog-header">
        <div class="header-left">
          <div class="welly-avatar">
            <mat-icon>lightbulb</mat-icon>
          </div>
          <div>
            <h2>Welly Suggests</h2>
            <span class="subtitle" *ngIf="!loading && suggestions">
              {{ suggestions.totalPending }} pending invoices across {{ suggestions.totalWarehouses }} warehouse(s)
            </span>
            <span class="subtitle" *ngIf="loading">Analyzing pending invoices...</span>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close>
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Welly Speech Bubble -->
      <div class="welly-speech" *ngIf="!loading && suggestions?.warehouses?.length">
        <div class="speech-bubble">
          <strong>🧠 Hey! I've analyzed all {{ suggestions.totalPending }} pending invoices</strong> and grouped them
          into <strong>{{ getTotalSuggestedTrips() }} optimized tripsheets</strong> across
          {{ suggestions.totalWarehouses }} warehouse(s). Each batch groups nearby customers
          by province and city for efficient routes. Review the suggestions below and hit
          <strong>Create Tripsheet</strong> on any batch you'd like to action!
        </div>
      </div>

      <div class="dialog-content" *ngIf="loading">
        <div class="loading-state">
          <mat-spinner diameter="48"></mat-spinner>
          <p>Welly is analyzing {{ data.invoices?.length || '...' }} invoices and batching by warehouse...</p>
        </div>
      </div>

      <div class="dialog-content" *ngIf="!loading && error">
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <h3>Something went wrong</h3>
          <p>{{ error }}</p>
          <button mat-raised-button color="primary" (click)="loadSuggestions()">
            <mat-icon>refresh</mat-icon> Try Again
          </button>
        </div>
      </div>

      <div class="dialog-content" *ngIf="!loading && !error && suggestions?.warehouses?.length === 0">
        <div class="empty-state">
          <mat-icon>check_circle</mat-icon>
          <h3>All caught up!</h3>
          <p>No pending invoices need tripsheet assignment. Great work! 🎉</p>
        </div>
      </div>

      <div class="dialog-content" *ngIf="!loading && !error && suggestions?.warehouses?.length">
        <!-- Warehouse Tabs -->
        <mat-tab-group animationDuration="200ms" (selectedTabChange)="onTabChange($event)">
          <mat-tab *ngFor="let wh of suggestions.warehouses; let whIdx = index">
            <ng-template mat-tab-label>
              <div class="warehouse-tab-label">
                <mat-icon>warehouse</mat-icon>
                <span>{{ wh.warehouseName }}</span>
                <span class="tab-badge">{{ wh.suggestedTripsheets.length }}</span>
              </div>
            </ng-template>

            <!-- Warehouse Summary Banner -->
            <div class="warehouse-banner">
              <div class="banner-stats">
                <div class="stat">
                  <span class="stat-value">{{ wh.totalPendingInvoices }}</span>
                  <span class="stat-label">Invoices</span>
                </div>
                <div class="stat">
                  <span class="stat-value">{{ wh.suggestedTripsheets.length }}</span>
                  <span class="stat-label">Suggested Trips</span>
                </div>
                <div class="stat">
                  <span class="stat-value">R{{ formatMoney(wh.totalValue) }}</span>
                  <span class="stat-label">Total Value</span>
                </div>
                <div class="stat">
                  <span class="stat-value">{{ wh.sourceCompanies?.join(', ') }}</span>
                  <span class="stat-label">Divisions</span>
                </div>
              </div>
              <p class="banner-summary">{{ wh.summary }}</p>
            </div>

            <!-- Suggested Tripsheets -->
            <div class="suggestions-list">
              <div *ngFor="let batch of wh.suggestedTripsheets; let bIdx = index"
                   class="suggestion-card"
                   [class.selected]="isSelected(whIdx, bIdx)"
                   [class.created]="isCreated(whIdx, bIdx)">

                <div class="card-header" (click)="toggleExpand(whIdx, bIdx)">
                  <div class="card-check">
                    <mat-checkbox
                      [checked]="isSelected(whIdx, bIdx)"
                      [disabled]="isCreated(whIdx, bIdx)"
                      (change)="toggleSelect(whIdx, bIdx, $event)"
                      (click)="$event.stopPropagation()">
                    </mat-checkbox>
                  </div>
                  <div class="card-route">
                    <div class="route-label">
                      <mat-icon class="route-icon">route</mat-icon>
                      <strong>{{ batch.province }}</strong>
                      <span class="route-sep">→</span>
                      <span>{{ batch.city }}</span>
                    </div>
                    <div class="route-meta">
                      <span class="meta-chip invoices"><mat-icon>receipt</mat-icon> {{ batch.totalInvoices }} invoices</span>
                      <span class="meta-chip customers"><mat-icon>people</mat-icon> {{ batch.uniqueCustomers }} customers</span>
                      <span class="meta-chip value"><mat-icon>payments</mat-icon> R{{ formatMoney(batch.totalValue) }}</span>
                      <span class="meta-chip priority" [class]="'priority-' + batch.highestPriority?.toLowerCase()">
                        {{ batch.highestPriority }}
                      </span>
                      <span class="meta-chip vehicle"><mat-icon>local_shipping</mat-icon> {{ batch.recommendedVehicle }}</span>
                    </div>
                  </div>
                  <div class="card-actions">
                    <span class="created-badge" *ngIf="isCreated(whIdx, bIdx)">
                      <mat-icon>check_circle</mat-icon> Created
                    </span>
                    <button mat-raised-button color="primary"
                            *ngIf="!isCreated(whIdx, bIdx)"
                            (click)="createTripsheet(whIdx, bIdx, wh, batch); $event.stopPropagation()"
                            [disabled]="creatingMap[whIdx + '-' + bIdx]">
                      <mat-spinner *ngIf="creatingMap[whIdx + '-' + bIdx]" diameter="18"></mat-spinner>
                      <mat-icon *ngIf="!creatingMap[whIdx + '-' + bIdx]">add_road</mat-icon>
                      {{ creatingMap[whIdx + '-' + bIdx] ? 'Creating...' : 'Create Tripsheet' }}
                    </button>
                    <button mat-icon-button (click)="toggleExpand(whIdx, bIdx); $event.stopPropagation()">
                      <mat-icon>{{ isExpanded(whIdx, bIdx) ? 'expand_less' : 'expand_more' }}</mat-icon>
                    </button>
                  </div>
                </div>

                <!-- Expanded Customer Details -->
                <div class="card-details" *ngIf="isExpanded(whIdx, bIdx)">
                  <table class="customer-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Code</th>
                        <th>City</th>
                        <th>Invoices</th>
                        <th class="right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let cust of batch.customers">
                        <td class="customer-name">{{ cust.customerName }}</td>
                        <td class="customer-code">{{ cust.customerNumber }}</td>
                        <td>{{ cust.city || '—' }}</td>
                        <td>{{ cust.invoiceCount }}</td>
                        <td class="right">R{{ formatMoney(cust.totalAmount) }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div class="details-footer">
                    <span *ngIf="batch.oldestDays >= 7" class="age-warning">
                      <mat-icon>warning</mat-icon> Oldest invoice: {{ batch.oldestDays }} days in system
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>

      <!-- Bottom Action Bar -->
      <div class="dialog-actions" *ngIf="!loading && suggestions?.warehouses?.length">
        <div class="selection-info">
          <span *ngIf="getSelectedCount() > 0">
            {{ getSelectedCount() }} batch(es) selected · {{ getSelectedInvoiceCount() }} invoices
          </span>
        </div>
        <button mat-button mat-dialog-close>Close</button>
        <button mat-raised-button color="accent"
                [disabled]="getSelectedCount() === 0 || creatingBulk"
                (click)="createSelectedTripsheets()">
          <mat-spinner *ngIf="creatingBulk" diameter="18"></mat-spinner>
          <mat-icon *ngIf="!creatingBulk">playlist_add_check</mat-icon>
          {{ creatingBulk ? 'Creating...' : 'Create Selected (' + getSelectedCount() + ')' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .welly-suggests-dialog { display: flex; flex-direction: column; height: 100%; }
    .dialog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #ff6f00, #e65100); color: white;
      margin: -24px -24px 0;
    }
    .header-left { display: flex; align-items: center; gap: 14px; }
    .welly-avatar {
      width: 48px; height: 48px; border-radius: 50%;
      background: rgba(255,255,255,0.2); display: flex;
      align-items: center; justify-content: center;
    }
    .welly-avatar mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .dialog-header h2 { margin: 0; font-size: 20px; }
    .dialog-header .subtitle { font-size: 13px; opacity: 0.9; }
    .dialog-header button { color: white; }
    .welly-speech { padding: 16px 24px 0; }
    .speech-bubble {
      background: #fff3e0; border: 1px solid #ffe0b2; border-radius: 12px;
      padding: 14px 18px; font-size: 13.5px; line-height: 1.5; color: #333;
      position: relative;
    }
    .dialog-content { flex: 1; overflow-y: auto; padding: 0 16px 16px; }
    .loading-state, .error-state, .empty-state {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; height: 300px; gap: 16px; color: #666;
    }
    .error-state mat-icon, .empty-state mat-icon { font-size: 56px; width: 56px; height: 56px; }
    .error-state mat-icon { color: #f44336; }
    .empty-state mat-icon { color: #4caf50; }
    .warehouse-tab-label { display: flex; align-items: center; gap: 8px; }
    .tab-badge {
      background: #ff6f00; color: white; border-radius: 10px;
      padding: 1px 8px; font-size: 11px; font-weight: 600; min-width: 20px; text-align: center;
    }
    .warehouse-banner {
      background: linear-gradient(135deg, #fff8e1, #fff3e0);
      border: 1px solid #ffe0b2; border-radius: 12px;
      padding: 16px 20px; margin: 16px 0;
    }
    .banner-stats { display: flex; gap: 32px; flex-wrap: wrap; }
    .stat { display: flex; flex-direction: column; }
    .stat-value { font-size: 20px; font-weight: 700; color: #e65100; }
    .stat-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
    .banner-summary { margin: 10px 0 0; font-size: 13px; color: #666; }
    .suggestions-list { display: flex; flex-direction: column; gap: 12px; padding-bottom: 16px; }
    .suggestion-card {
      border: 2px solid #e0e0e0; border-radius: 12px; overflow: hidden;
      transition: all 0.2s ease; background: white;
    }
    .suggestion-card:hover { border-color: #ff6f00; box-shadow: 0 2px 8px rgba(255,111,0,0.12); }
    .suggestion-card.selected { border-color: #ff6f00; background: #fff8e1; }
    .suggestion-card.created { border-color: #4caf50; background: #f1f8e9; opacity: 0.7; }
    .card-header {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; cursor: pointer;
    }
    .card-check { flex-shrink: 0; }
    .card-route { flex: 1; min-width: 0; }
    .route-label { display: flex; align-items: center; gap: 6px; font-size: 15px; flex-wrap: wrap; }
    .route-icon { color: #ff6f00; font-size: 20px; width: 20px; height: 20px; }
    .route-sep { color: #bbb; }
    .route-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .meta-chip {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: 11.5px; color: #666; background: #f5f5f5;
      padding: 2px 8px; border-radius: 8px;
    }
    .meta-chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .meta-chip.value { color: #2e7d32; background: #e8f5e9; font-weight: 600; }
    .meta-chip.priority { font-weight: 600; }
    .priority-critical { background: #ffebee; color: #c62828; }
    .priority-urgent { background: #fff3e0; color: #e65100; }
    .priority-high { background: #fff8e1; color: #f57f17; }
    .priority-normal { background: #e8f5e9; color: #2e7d32; }
    .priority-low { background: #f5f5f5; color: #757575; }
    .card-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .created-badge {
      display: flex; align-items: center; gap: 4px;
      color: #4caf50; font-size: 13px; font-weight: 600;
    }
    .created-badge mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .card-details { border-top: 1px solid #eee; padding: 16px; background: #fafafa; }
    .customer-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .customer-table th {
      text-align: left; padding: 8px 10px; color: #666; font-weight: 600;
      border-bottom: 2px solid #e0e0e0; font-size: 11px; text-transform: uppercase;
    }
    .customer-table td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
    .customer-table .right { text-align: right; }
    .customer-name { font-weight: 500; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .customer-code { color: #999; font-size: 12px; }
    .details-footer { margin-top: 10px; }
    .age-warning {
      display: inline-flex; align-items: center; gap: 4px;
      color: #e65100; font-size: 12px; font-weight: 500;
    }
    .age-warning mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .dialog-actions {
      display: flex; justify-content: flex-end; align-items: center; gap: 12px;
      padding: 12px 24px; border-top: 1px solid #e0e0e0; background: #fafafa;
      margin: 0 -24px -24px;
    }
    .selection-info { flex: 1; font-size: 13px; color: #666; }
  `]
})
export class WellySuggestsDialog implements OnInit {
  suggestions: any = null;
  loading = true;
  error = '';
  creatingBulk = false;

  expandedMap: { [key: string]: boolean } = {};
  selectedMap: { [key: string]: boolean } = {};
  createdMap: { [key: string]: boolean } = {};
  creatingMap: { [key: string]: boolean } = {};

  constructor(
    public dialogRef: MatDialogRef<WellySuggestsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadSuggestions();
  }

  loadSuggestions(): void {
    this.loading = true;
    this.error = '';
    this.http.get(`${this.data.apiUrl}/logistics/importedinvoices/welly-suggest-tripsheets`)
      .subscribe({
        next: (res: any) => {
          this.suggestions = res;
          this.loading = false;
        },
        error: (err) => {
          this.error = err.error?.error || 'Failed to load suggestions. Please try again.';
          this.loading = false;
        }
      });
  }

  getTotalSuggestedTrips(): number {
    return this.suggestions?.warehouses?.reduce(
      (sum: number, wh: any) => sum + (wh.suggestedTripsheets?.length || 0), 0
    ) || 0;
  }

  onTabChange(event: any): void { /* Tab changed */ }

  toggleExpand(whIdx: number, bIdx: number): void {
    const key = `${whIdx}-${bIdx}`;
    this.expandedMap[key] = !this.expandedMap[key];
  }

  isExpanded(whIdx: number, bIdx: number): boolean {
    return !!this.expandedMap[`${whIdx}-${bIdx}`];
  }

  toggleSelect(whIdx: number, bIdx: number, event: any): void {
    const key = `${whIdx}-${bIdx}`;
    this.selectedMap[key] = event.checked;
  }

  isSelected(whIdx: number, bIdx: number): boolean {
    return !!this.selectedMap[`${whIdx}-${bIdx}`];
  }

  isCreated(whIdx: number, bIdx: number): boolean {
    return !!this.createdMap[`${whIdx}-${bIdx}`];
  }

  getSelectedCount(): number {
    return Object.values(this.selectedMap).filter(v => v).length;
  }

  getSelectedInvoiceCount(): number {
    let count = 0;
    for (const [key, selected] of Object.entries(this.selectedMap)) {
      if (!selected) continue;
      const [whIdx, bIdx] = key.split('-').map(Number);
      const wh = this.suggestions?.warehouses?.[whIdx];
      const batch = wh?.suggestedTripsheets?.[bIdx];
      if (batch) count += batch.totalInvoices;
    }
    return count;
  }

  formatMoney(value: number): string {
    if (!value) return '0.00';
    return value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  createTripsheet(whIdx: number, bIdx: number, warehouse: any, batch: any): void {
    const key = `${whIdx}-${bIdx}`;
    if (this.creatingMap[key] || this.createdMap[key]) return;
    this.creatingMap[key] = true;

    const payload = {
      invoiceIds: batch.invoiceIds,
      warehouseId: warehouse.warehouseId,
      notes: `Welly Suggests: ${batch.province} → ${batch.city} (${batch.uniqueCustomers} customers, R${this.formatMoney(batch.totalValue)})`
    };

    this.http.post(`${this.data.apiUrl}/logistics/importedinvoices/create-tripsheet`, payload)
      .subscribe({
        next: (res: any) => {
          this.creatingMap[key] = false;
          this.createdMap[key] = true;
          this.selectedMap[key] = false;
          this.snackBar.open(
            `Tripsheet ${res.loadNumber || ''} created! ${batch.totalInvoices} invoices assigned.`,
            'OK', { duration: 4000 }
          );
        },
        error: (err) => {
          this.creatingMap[key] = false;
          this.snackBar.open(
            '❌ Failed to create tripsheet: ' + (err.error?.error || 'Unknown error'),
            'OK', { duration: 5000 }
          );
        }
      });
  }

  async createSelectedTripsheets(): Promise<void> {
    this.creatingBulk = true;
    const selected = Object.entries(this.selectedMap).filter(([_, v]) => v);
    let created = 0;
    let failed = 0;

    for (const [key] of selected) {
      const [whIdx, bIdx] = key.split('-').map(Number);
      if (this.createdMap[key]) continue;

      const wh = this.suggestions?.warehouses?.[whIdx];
      const batch = wh?.suggestedTripsheets?.[bIdx];
      if (!wh || !batch) continue;

      try {
        await this.http.post(`${this.data.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
          invoiceIds: batch.invoiceIds,
          warehouseId: wh.warehouseId,
          notes: `Welly Suggests: ${batch.province} → ${batch.city} (${batch.uniqueCustomers} customers)`
        }).toPromise();

        this.createdMap[key] = true;
        this.selectedMap[key] = false;
        created++;
      } catch {
        failed++;
      }
    }

    this.creatingBulk = false;
    const msg = failed > 0
      ? `Created ${created} tripsheet(s), ${failed} failed.`
      : `Successfully created ${created} tripsheet(s)!`;
    this.snackBar.open(msg, 'OK', { duration: 5000 });

    if (created > 0) {
      this.dialogRef.close({ created: true });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Powered Tripsheets — warehouse → vehicle → grouped invoices builder
// ═══════════════════════════════════════════════════════════════════════════
@Component({
  selector: 'ai-tripsheet-builder-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatDividerModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  template: `
    <div class="ai-builder">
      <!-- Header -->
      <div class="ab-header">
        <div class="ab-header-left">
          <div class="ab-avatar"><mat-icon>smart_toy</mat-icon></div>
          <div>
            <h2>AI Powered Tripsheets</h2>
            <span class="ab-subtitle">{{ headerSubtitle() }}</span>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <!-- Stepper -->
      <div class="ab-steps">
        <div class="ab-step" [class.active]="step === 1" [class.done]="step > 1" (click)="goToStep(1)">
          <div class="ab-step-num"><mat-icon *ngIf="step > 1">check</mat-icon><span *ngIf="step <= 1">1</span></div>
          <span class="ab-step-label">Warehouse</span>
        </div>
        <div class="ab-connector" [class.filled]="step > 1"></div>
        <div class="ab-step" [class.active]="step === 2" [class.done]="step > 2" (click)="goToStep(2)">
          <div class="ab-step-num"><mat-icon *ngIf="step > 2">check</mat-icon><span *ngIf="step <= 2">2</span></div>
          <span class="ab-step-label">Vehicle</span>
        </div>
        <div class="ab-connector" [class.filled]="step > 2"></div>
        <div class="ab-step" [class.active]="step === 3" [class.done]="step > 3" (click)="goToStep(3)">
          <div class="ab-step-num"><mat-icon *ngIf="step > 3">check</mat-icon><span *ngIf="step <= 3">3</span></div>
          <span class="ab-step-label">Build Load</span>
        </div>
        <div class="ab-connector" [class.filled]="step > 3"></div>
        <div class="ab-step" [class.active]="step === 4" [class.done]="step > 4" (click)="goToStep(4)">
          <div class="ab-step-num"><mat-icon *ngIf="step > 4">check</mat-icon><span *ngIf="step <= 4">4</span></div>
          <span class="ab-step-label">Route Details</span>
        </div>
        <div class="ab-connector" [class.filled]="step > 4"></div>
        <div class="ab-step" [class.active]="step === 5">
          <div class="ab-step-num"><span>5</span></div>
          <span class="ab-step-label">Review</span>
        </div>
      </div>

      <div class="ab-body">
        <!-- Loading -->
        <div class="ab-center" *ngIf="loading">
          <mat-spinner diameter="44"></mat-spinner>
          <p>Analysing pending invoices…</p>
        </div>

        <!-- Error -->
        <div class="ab-center" *ngIf="!loading && error">
          <mat-icon class="err">error_outline</mat-icon>
          <h3>Something went wrong</h3>
          <p>{{ error }}</p>
          <button mat-raised-button color="primary" (click)="loadSuggestions()">
            <mat-icon>refresh</mat-icon> Try again
          </button>
        </div>

        <!-- ─── STEP 1: WAREHOUSE ─── -->
        <div class="ab-panel" *ngIf="!loading && !error && step === 1">
          <h3 class="ab-q">Where would you like to create tripsheets?</h3>
          <p class="ab-hint">Pick a warehouse to see AI-grouped loads &mdash; or choose Custom / Welly Suggest. Click a card to continue.</p>
          <div class="wh-grid">
            <div class="wh-card" *ngFor="let wh of warehouseCards"
                 [class.selected]="selectedWarehouse?.code === wh.code"
                 [class.special]="wh.special"
                 [style.--wh-color]="wh.color"
                 (click)="selectWarehouse(wh)">
              <div class="wh-icon"><mat-icon>{{ wh.icon }}</mat-icon></div>
              <div class="wh-badge" *ngIf="!wh.special" [class.zero]="pendingFor(wh) === 0">{{ pendingFor(wh) }}</div>
              <h4>{{ wh.short }}</h4>
              <span class="wh-name">{{ wh.name }}</span>
              <span class="wh-city" *ngIf="!wh.special"><mat-icon>place</mat-icon>{{ wh.city }}</span>
              <span class="wh-city" *ngIf="wh.special">{{ wh.tagline }}</span>
              <div class="wh-meta" *ngIf="!wh.special">
                <span>{{ pendingFor(wh) }} pending</span>
                <span class="dot">•</span>
                <span>R {{ formatMoney(valueFor(wh)) }}</span>
              </div>
              <div class="wh-meta" *ngIf="wh.code === 'CUSTOM'">
                <span>{{ totalPendingAll() }} pending</span>
                <span class="dot">•</span>
                <span>all provinces</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── STEP 2: VEHICLE ─── -->
        <div class="ab-panel" *ngIf="!loading && !error && step === 2">
          <h3 class="ab-q">Which vehicle would you like to build loads for?</h3>
          <p class="ab-hint">This helps size the load so it fits your truck. Click a vehicle to continue.</p>
          <div class="veh-grid">
            <div class="veh-card" *ngFor="let v of vehicleTypes"
                 [class.selected]="selectedVehicle?.ton === v.ton"
                 (click)="selectVehicle(v)">
              <div class="veh-icon"><mat-icon>local_shipping</mat-icon></div>
              <h4>{{ v.label }}</h4>
              <span class="veh-desc">{{ v.desc }}</span>
              <div class="veh-cap">
                <span><mat-icon>inventory_2</mat-icon>{{ v.pallets }}</span>
                <span><mat-icon>receipt_long</mat-icon>up to {{ v.maxInvoices }} drops</span>
              </div>
              <mat-icon class="veh-check" *ngIf="selectedVehicle?.ton === v.ton">check_circle</mat-icon>
            </div>
          </div>
        </div>

        <!-- ─── STEP 3: BUILD LOAD ─── -->
        <div class="ab-panel" *ngIf="!loading && !error && step === 3">
          <div class="build-context">
            <span class="ctx-chip"><mat-icon>warehouse</mat-icon>{{ selectedWarehouse?.short }} — {{ selectedWarehouse?.name }}</span>
            <span class="ctx-chip veh"><mat-icon>local_shipping</mat-icon>{{ selectedVehicle?.label }}</span>
          </div>

          <!-- Current Load summary -->
          <div class="cur-load" [class.empty]="!loadInvoices.length">
            <div class="cl-left">
              <mat-icon>{{ loadInvoices.length ? 'shopping_cart' : 'remove_shopping_cart' }}</mat-icon>
              <div>
                <strong>Current load</strong>
                <span *ngIf="loadInvoices.length">{{ loadInvoices.length }} invoice(s) · {{ loadCustomerCount() }} customer(s) · R {{ formatMoney(loadValue()) }}</span>
                <span *ngIf="!loadInvoices.length">Tick invoices below or add by number to start building</span>
              </div>
            </div>
            <div class="cl-right" *ngIf="loadInvoices.length">
              <span class="cap-flag" [class.over]="loadInvoices.length > selectedVehicle?.maxInvoices">
                <mat-icon>{{ loadInvoices.length > selectedVehicle?.maxInvoices ? 'warning' : 'check_circle' }}</mat-icon>
                {{ loadInvoices.length > selectedVehicle?.maxInvoices ? 'Over ' + selectedVehicle?.label : 'Fits ' + selectedVehicle?.label }}
              </span>
              <button mat-stroked-button color="warn" (click)="clearLoad()">Clear</button>
            </div>
          </div>

          <!-- Manual invoice entry -->
          <div class="manual-box">
            <div class="manual-head">
              <mat-icon>search</mat-icon>
              <div>
                <strong>Add a specific invoice by number</strong>
                <span>Type an invoice number to add it straight into the load.</span>
              </div>
            </div>
            <div class="manual-row">
              <mat-form-field appearance="outline" class="manual-field">
                <mat-label>Invoice number</mat-label>
                <input matInput [(ngModel)]="invoiceSearch" (keyup.enter)="addByInvoiceNumber()" placeholder="e.g. INV0012345">
              </mat-form-field>
              <button mat-raised-button color="primary" (click)="addByInvoiceNumber()" [disabled]="!invoiceSearch.trim()">
                <mat-icon>add</mat-icon> Add
              </button>
            </div>
            <span class="manual-err" *ngIf="manualError">{{ manualError }}</span>
          </div>

          <mat-divider class="sec-div"></mat-divider>

          <!-- AI suggested groups -->
          <div class="ai-groups-head">
            <h3><mat-icon>auto_awesome</mat-icon>{{ selectedWarehouse?.code === 'CUSTOM' ? 'All batches — every province' : 'AI-grouped loads for ' + selectedWarehouse?.name }}</h3>
            <span *ngIf="batches.length">{{ batches.length }} batch(es)</span>
          </div>

          <div class="ab-center small" *ngIf="!batches.length">
            <mat-icon class="empty">inventory</mat-icon>
            <h3>No pending invoices here</h3>
            <p>There are no unassigned invoices for {{ selectedWarehouse?.name }} right now.</p>
          </div>

          <div class="groups-list">
            <div class="group-card" *ngFor="let b of batches; let i = index">
              <div class="group-header">
                <mat-checkbox class="gc-check"
                  [checked]="batchAllIn(b)"
                  [indeterminate]="batchSomeIn(b)"
                  (change)="toggleBatchAll(b, $event)"
                  (click)="$event.stopPropagation()"
                  matTooltip="Select / clear all invoices in this batch"></mat-checkbox>
                <div class="gc-route" (click)="expandedMap[i] = !expandedMap[i]">
                  <div class="gc-title">
                    <mat-icon>route</mat-icon>
                    <strong>{{ b.province || 'Unknown' }}</strong>
                    <span class="sep">→</span>
                    <span>{{ b.city }}</span>
                  </div>
                  <div class="gc-meta">
                    <span class="mchip"><mat-icon>receipt</mat-icon>{{ b.totalInvoices }} invoices</span>
                    <span class="mchip"><mat-icon>people</mat-icon>{{ b.uniqueCustomers }} customers</span>
                    <span class="mchip val"><mat-icon>payments</mat-icon>R {{ formatMoney(b.totalValue) }}</span>
                    <span class="mchip sel" *ngIf="batchSelectedCount(b) > 0"><mat-icon>check</mat-icon>{{ batchSelectedCount(b) }} in load</span>
                  </div>
                </div>
                <div class="gc-actions">
                  <button mat-icon-button (click)="expandedMap[i] = !expandedMap[i]">
                    <mat-icon>{{ expandedMap[i] ? 'expand_less' : 'expand_more' }}</mat-icon>
                  </button>
                </div>
              </div>
              <div class="group-details" *ngIf="expandedMap[i]">
                <div class="inv-row" *ngFor="let inv of batchInvoices(b)"
                     [class.picked]="isInLoad(inv.id)"
                     (click)="toggleInvoice(inv)">
                  <mat-checkbox [checked]="isInLoad(inv.id)" (click)="$event.stopPropagation()" (change)="toggleInvoice(inv)"></mat-checkbox>
                  <div class="iv-main">
                    <span class="iv-num">{{ inv.transactionNumber }}</span>
                    <span class="iv-cust">{{ inv.customerName }}</span>
                  </div>
                  <div class="iv-mid">
                    <span class="iv-prod" [matTooltip]="inv.productDescription">
                      <mat-icon>inventory_2</mat-icon>{{ inv.productDescription || 'No product description' }}
                    </span>
                    <span class="iv-city"><mat-icon>place</mat-icon>{{ inv.deliveryCity || '—' }}</span>
                  </div>
                  <div class="iv-side">
                    <span class="iv-qty">{{ inv.quantity }}x</span>
                    <span class="iv-amt">R {{ formatMoney(inv.salesAmount) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── STEP 4: ROUTE DETAILS ─── -->
        <div class="ab-panel" *ngIf="!loading && !error && step === 4">
          <h3 class="ab-q">Route details &amp; stops</h3>
          <p class="ab-hint">Confirm each drop-off, set the order, and assign a driver &amp; vehicle.</p>

          <div class="route-config">
            <mat-form-field appearance="outline">
              <mat-label>Scheduled date</mat-label>
              <input matInput [matDatepicker]="rdPicker" [(ngModel)]="scheduledDate">
              <mat-datepicker-toggle matSuffix [for]="rdPicker"></mat-datepicker-toggle>
              <mat-datepicker #rdPicker></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Driver</mat-label>
              <mat-select [(ngModel)]="driverId">
                <mat-option [value]="null">Assign later</mat-option>
                <mat-option *ngFor="let d of data.drivers" [value]="d.id">{{ d.firstName }} {{ d.lastName }}</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Vehicle ({{ selectedVehicle?.label }})</mat-label>
              <mat-select [(ngModel)]="vehicleId">
                <mat-option [value]="null">Assign later</mat-option>
                <mat-option *ngFor="let v of data.vehicles" [value]="v.id">{{ v.registrationNumber }}<span *ngIf="v.vehicleTypeName"> — {{ v.vehicleTypeName }}</span></mat-option>
              </mat-select>
            </mat-form-field>
          </div>

          <div class="stops-head">
            <h4><mat-icon>pin_drop</mat-icon>{{ stops.length }} stop(s) · {{ loadInvoices.length }} invoice(s)</h4>
          </div>

          <div class="stops-list">
            <div class="stop-card" *ngFor="let s of stops; let i = index">
              <div class="stop-seq">{{ i + 1 }}</div>
              <div class="stop-body">
                <div class="stop-title">
                  <strong>{{ s.customerName }}</strong>
                  <span class="stop-code">{{ s.customerNumber }}</span>
                  <span class="stop-chip">{{ s.invoiceCount }} inv · R {{ formatMoney(s.amount) }}</span>
                </div>
                <div class="stop-fields">
                  <mat-form-field appearance="outline" class="sf-addr">
                    <mat-label>Delivery address</mat-label>
                    <input matInput [(ngModel)]="s.address" placeholder="Street address">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="sf-city">
                    <mat-label>City</mat-label>
                    <input matInput [(ngModel)]="s.city">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="sf-prov">
                    <mat-label>Province</mat-label>
                    <input matInput [(ngModel)]="s.province">
                  </mat-form-field>
                </div>
              </div>
              <div class="stop-move">
                <button mat-icon-button [disabled]="i === 0" (click)="moveStop(i, -1)"><mat-icon>arrow_upward</mat-icon></button>
                <button mat-icon-button [disabled]="i === stops.length - 1" (click)="moveStop(i, 1)"><mat-icon>arrow_downward</mat-icon></button>
              </div>
            </div>
          </div>
        </div>

        <!-- ─── STEP 5: REVIEW & GENERATE ─── -->
        <div class="ab-panel" *ngIf="!loading && !error && step === 5">
          <h3 class="ab-q">Review &amp; generate tripsheet</h3>
          <p class="ab-hint">Check everything looks right, then generate the tripsheet.</p>

          <div class="review-grid">
            <div class="rv-card"><span class="rv-k">Origin warehouse</span><span class="rv-v">{{ selectedWarehouse?.code === 'CUSTOM' ? 'Custom (mixed)' : selectedWarehouse?.name }}</span></div>
            <div class="rv-card"><span class="rv-k">Vehicle type</span><span class="rv-v">{{ selectedVehicle?.label }}</span></div>
            <div class="rv-card"><span class="rv-k">Assigned vehicle</span><span class="rv-v">{{ vehicleName() }}</span></div>
            <div class="rv-card"><span class="rv-k">Driver</span><span class="rv-v">{{ driverName() }}</span></div>
            <div class="rv-card"><span class="rv-k">Scheduled date</span><span class="rv-v">{{ scheduledDate | date:'dd MMM yyyy' }}</span></div>
            <div class="rv-card"><span class="rv-k">Stops</span><span class="rv-v">{{ stops.length }}</span></div>
            <div class="rv-card"><span class="rv-k">Invoices</span><span class="rv-v">{{ loadInvoices.length }}</span></div>
            <div class="rv-card total"><span class="rv-k">Total value</span><span class="rv-v">R {{ formatMoney(loadValue()) }}</span></div>
          </div>

          <div class="cap-banner" *ngIf="loadInvoices.length > selectedVehicle?.maxInvoices">
            <mat-icon>warning</mat-icon>
            This load has {{ loadInvoices.length }} drops which exceeds the recommended {{ selectedVehicle?.maxInvoices }} for a {{ selectedVehicle?.label }}. You can still proceed.
          </div>

          <div class="review-stops">
            <h4><mat-icon>route</mat-icon>Stop order</h4>
            <div class="rs-row" *ngFor="let s of stops; let i = index">
              <span class="rs-seq">{{ i + 1 }}</span>
              <span class="rs-name">{{ s.customerName }}</span>
              <span class="rs-loc">{{ s.city || '—' }}<span *ngIf="s.province">, {{ s.province }}</span></span>
              <span class="rs-amt">R {{ formatMoney(s.amount) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="ab-footer" *ngIf="!loading && !error">
        <button mat-button *ngIf="step > 1" (click)="goToStep(step - 1)">
          <mat-icon>arrow_back</mat-icon> Back
        </button>
        <span class="ab-spacer"></span>
        <span class="foot-info" *ngIf="step === 3 && loadInvoices.length">
          {{ loadInvoices.length }} invoice(s) in load
        </span>
        <button mat-button mat-dialog-close *ngIf="step <= 2">Cancel</button>
        <button mat-raised-button color="primary" *ngIf="step === 3"
                [disabled]="!loadInvoices.length" (click)="goToStep(4)">
          Route Details <mat-icon>arrow_forward</mat-icon>
        </button>
        <button mat-raised-button color="primary" *ngIf="step === 4"
                (click)="goToStep(5)">
          Review <mat-icon>arrow_forward</mat-icon>
        </button>
        <button mat-raised-button color="accent" *ngIf="step === 5"
                [disabled]="creating || !loadInvoices.length" (click)="generate()">
          <mat-spinner *ngIf="creating" diameter="18"></mat-spinner>
          <mat-icon *ngIf="!creating">check_circle</mat-icon>
          Generate Tripsheet
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ai-builder { display: flex; flex-direction: column; height: 100%; }
    .ab-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; margin: -24px -24px 0;
      background: linear-gradient(135deg, #6a11cb, #2575fc); color: #fff;
    }
    .ab-header-left { display: flex; align-items: center; gap: 14px; }
    .ab-avatar {
      width: 46px; height: 46px; border-radius: 50%;
      background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center;
    }
    .ab-avatar mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .ab-header h2 { margin: 0; font-size: 20px; }
    .ab-subtitle { font-size: 13px; opacity: .9; }
    .ab-header button { color: #fff; }

    .ab-steps { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 18px 24px 6px; }
    .ab-step { display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; }
    .ab-step-num {
      width: 34px; height: 34px; border-radius: 50%; background: #e0e0e0; color: #757575;
      display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px;
      transition: all .2s;
    }
    .ab-step-num mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .ab-step.active .ab-step-num { background: #2575fc; color: #fff; }
    .ab-step.done .ab-step-num { background: #4caf50; color: #fff; }
    .ab-step-label { font-size: 12px; color: #757575; font-weight: 600; }
    .ab-step.active .ab-step-label { color: #2575fc; }
    .ab-connector { width: 60px; height: 3px; background: #e0e0e0; border-radius: 2px; margin-bottom: 20px; }
    .ab-connector.filled { background: #4caf50; }

    .ab-body { flex: 1; overflow-y: auto; padding: 8px 24px 16px; }
    .ab-center { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 320px; gap: 14px; color: #666; }
    .ab-center.small { height: 220px; }
    .ab-center .err { font-size: 52px; width: 52px; height: 52px; color: #f44336; }
    .ab-center .empty { font-size: 52px; width: 52px; height: 52px; color: #bbb; }

    .ab-panel { animation: fade .25s ease; }
    @keyframes fade { from { opacity: 0; transform: translateY(6px);} to {opacity:1; transform:none;} }
    .ab-q { margin: 8px 0 2px; font-size: 20px; color: #263238; text-align: center; }
    .ab-hint { margin: 0 0 20px; text-align: center; color: #888; font-size: 13.5px; }

    /* Warehouse cards */
    .wh-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; max-width: 760px; margin: 0 auto; }
    @media (max-width: 600px) { .wh-grid { grid-template-columns: 1fr; } }
    .wh-card {
      position: relative; border: 2px solid #e6e6e6; border-radius: 16px; padding: 20px 16px;
      display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer;
      transition: all .2s; background: #fff; text-align: center;
    }
    .wh-card:hover { border-color: var(--wh-color); box-shadow: 0 6px 18px rgba(0,0,0,.10); transform: translateY(-3px); }
    .wh-card.selected { border-color: var(--wh-color); background: color-mix(in srgb, var(--wh-color) 8%, white); }
    .wh-card.special { border-style: dashed; }
    .wh-icon {
      width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--wh-color) 14%, white); color: var(--wh-color);
    }
    .wh-icon mat-icon { font-size: 30px; width: 30px; height: 30px; }
    .wh-badge {
      position: absolute; top: 12px; right: 12px; min-width: 24px; height: 24px; padding: 0 7px;
      border-radius: 12px; background: var(--wh-color); color: #fff; font-size: 12px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .wh-badge.zero { background: #cfcfcf; }
    .wh-card h4 { margin: 6px 0 0; font-size: 22px; color: #263238; }
    .wh-name { font-size: 13px; color: #555; }
    .wh-city { display: inline-flex; align-items: center; gap: 3px; font-size: 12px; color: #999; }
    .wh-city mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .wh-meta { margin-top: 6px; font-size: 12px; color: #666; display: flex; gap: 6px; }
    .wh-meta .dot { color: #ccc; }
    .wh-check { position: absolute; top: 12px; left: 12px; color: var(--wh-color); }

    /* Vehicle cards */
    .veh-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; max-width: 780px; margin: 0 auto; }
    @media (max-width: 720px) { .veh-grid { grid-template-columns: 1fr; } }
    .veh-card {
      position: relative; border: 2px solid #e6e6e6; border-radius: 16px; padding: 26px 18px;
      display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer;
      transition: all .2s; background: #fff; text-align: center;
    }
    .veh-card:hover { border-color: #2575fc; box-shadow: 0 6px 18px rgba(37,117,252,.15); transform: translateY(-3px); }
    .veh-card.selected { border-color: #2575fc; background: #f0f6ff; }
    .veh-icon {
      width: 64px; height: 64px; border-radius: 16px; background: #eef3ff; color: #2575fc;
      display: flex; align-items: center; justify-content: center;
    }
    .veh-icon mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .veh-card h4 { margin: 4px 0 0; font-size: 22px; color: #263238; }
    .veh-desc { font-size: 13px; color: #777; }
    .veh-cap { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
    .veh-cap span { display: inline-flex; align-items: center; gap: 5px; font-size: 12.5px; color: #666; }
    .veh-cap mat-icon { font-size: 16px; width: 16px; height: 16px; color: #2575fc; }
    .veh-check { position: absolute; top: 12px; right: 12px; color: #2575fc; }

    /* Build step */
    .build-context { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
    .ctx-chip {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px;
      background: #ede7f6; color: #5e35b1; font-size: 13px; font-weight: 600;
    }
    .ctx-chip.veh { background: #e3f2fd; color: #1565c0; }
    .ctx-chip mat-icon { font-size: 17px; width: 17px; height: 17px; }

    .manual-box { border: 1px solid #e0e0e0; border-radius: 14px; padding: 16px 18px; background: #fafbff; }
    .manual-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
    .manual-head mat-icon { color: #2575fc; }
    .manual-head strong { display: block; font-size: 14px; color: #263238; }
    .manual-head span { font-size: 12.5px; color: #888; }
    .manual-row { display: flex; gap: 10px; align-items: flex-start; }
    .manual-field { flex: 1; }
    .manual-field ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .manual-err { color: #e53935; font-size: 12.5px; }

    .basket { margin-top: 12px; border-top: 1px dashed #d5d5e5; padding-top: 12px; }
    .basket-head { display: flex; justify-content: space-between; font-size: 13px; color: #444; margin-bottom: 8px; }
    .basket-head span { color: #2e7d32; font-weight: 700; }
    .basket-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 10px; border-radius: 10px; background: #fff; border: 1px solid #eee; margin-bottom: 6px;
    }
    .bi-main { display: flex; flex-direction: column; }
    .bi-num { font-weight: 700; font-size: 13px; color: #2575fc; }
    .bi-cust { font-size: 12.5px; color: #555; }
    .bi-side { display: flex; align-items: center; gap: 10px; }
    .bi-city { font-size: 12px; color: #999; }
    .bi-amt { font-size: 13px; font-weight: 600; color: #2e7d32; }
    .basket-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }

    .sec-div { margin: 20px 0; }
    .ai-groups-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .ai-groups-head h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; color: #263238; }
    .ai-groups-head h3 mat-icon { color: #7b1fa2; }
    .ai-groups-head span { font-size: 13px; color: #888; }

    .groups-list { display: flex; flex-direction: column; gap: 12px; }
    .group-card { border: 2px solid #e6e6e6; border-radius: 12px; overflow: hidden; background: #fff; transition: all .2s; }
    .group-card:hover { border-color: #2575fc; box-shadow: 0 2px 10px rgba(37,117,252,.10); }
    .group-card.selected { border-color: #2575fc; background: #f5f9ff; }
    .group-card.created { border-color: #4caf50; background: #f1f8e9; opacity: .75; }
    .group-header { display: flex; align-items: center; gap: 12px; padding: 12px 14px; }
    .gc-check { flex-shrink: 0; }
    .gc-route { flex: 1; min-width: 0; cursor: pointer; }
    .gc-title { display: flex; align-items: center; gap: 6px; font-size: 15px; flex-wrap: wrap; }
    .gc-title mat-icon { color: #2575fc; font-size: 20px; width: 20px; height: 20px; }
    .gc-title .sep { color: #bbb; }
    .gc-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
    .mchip { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; color: #666; background: #f3f3f3; padding: 2px 8px; border-radius: 8px; }
    .mchip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .mchip.val { color: #2e7d32; background: #e8f5e9; font-weight: 600; }
    .mchip.cap { color: #2e7d32; background: #e8f5e9; font-weight: 600; }
    .mchip.cap.over { color: #e65100; background: #fff3e0; }
    .gc-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .created-tag { display: flex; align-items: center; gap: 4px; color: #4caf50; font-weight: 600; font-size: 13px; }
    .created-tag mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .group-details { border-top: 1px solid #eee; padding: 14px; background: #fafafa; }
    .cust-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .cust-table th { text-align: left; padding: 8px 10px; color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #e0e0e0; }
    .cust-table td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
    .cust-table .r { text-align: right; }
    .cust-table .cn { font-weight: 500; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cust-table .cc { color: #999; font-size: 12px; }

    .ab-footer { display: flex; align-items: center; gap: 12px; padding: 12px 24px;
      border-top: 1px solid #e0e0e0; background: #fafafa; margin: 0 -24px -24px; }
    .ab-spacer { flex: 1; }
    .foot-info { font-size: 13px; color: #666; }
    .ab-footer mat-spinner { display: inline-block; margin-right: 6px; }

    /* Current load bar */
    .cur-load { display: flex; align-items: center; justify-content: space-between;
      border: 2px solid #2575fc; border-radius: 12px; padding: 12px 16px; background: #f0f6ff; margin-bottom: 14px; }
    .cur-load.empty { border-color: #e0e0e0; border-style: dashed; background: #fafafa; }
    .cl-left { display: flex; align-items: center; gap: 12px; }
    .cl-left mat-icon { color: #2575fc; }
    .cur-load.empty .cl-left mat-icon { color: #aaa; }
    .cl-left strong { display: block; font-size: 14px; color: #263238; }
    .cl-left span { font-size: 12.5px; color: #666; }
    .cl-right { display: flex; align-items: center; gap: 10px; }
    .cap-flag { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600;
      color: #2e7d32; background: #e8f5e9; padding: 4px 10px; border-radius: 16px; }
    .cap-flag.over { color: #e65100; background: #fff3e0; }
    .cap-flag mat-icon { font-size: 16px; width: 16px; height: 16px; }

    /* Invoice rows in batch */
    .inv-row { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 8px;
      cursor: pointer; border: 1px solid transparent; transition: all .15s; }
    .inv-row:hover { background: #f5f9ff; }
    .inv-row.picked { background: #eaf3ff; border-color: #bcdcff; }
    .iv-main { display: flex; flex-direction: column; min-width: 150px; }
    .iv-num { font-weight: 700; font-size: 13px; color: #2575fc; }
    .iv-cust { font-size: 12.5px; color: #444; }
    .iv-mid { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .iv-city { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; color: #999; }
    .iv-city mat-icon { font-size: 13px; width: 13px; height: 13px; }
    .iv-prod { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: #37474f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 340px; }
    .iv-prod mat-icon { font-size: 15px; width: 15px; height: 15px; color: #7b1fa2; flex-shrink: 0; }
    .iv-side { display: flex; flex-direction: column; align-items: flex-end; }
    .iv-qty { font-size: 11.5px; color: #888; }
    .iv-amt { font-size: 13px; font-weight: 600; color: #2e7d32; }
    .mchip.sel { color: #1565c0; background: #e3f2fd; font-weight: 600; }

    /* Route details */
    .route-config { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 8px; }
    @media (max-width: 720px) { .route-config { grid-template-columns: 1fr; } }
    .route-config mat-form-field { width: 100%; }
    .stops-head { margin: 8px 0 10px; }
    .stops-head h4 { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 15px; color: #263238; }
    .stops-head mat-icon { color: #2575fc; }
    .stops-list { display: flex; flex-direction: column; gap: 10px; }
    .stop-card { display: flex; align-items: flex-start; gap: 12px; border: 1px solid #e6e6e6;
      border-radius: 12px; padding: 12px 14px; background: #fff; }
    .stop-seq { width: 30px; height: 30px; border-radius: 50%; background: #2575fc; color: #fff;
      display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0; margin-top: 4px; }
    .stop-body { flex: 1; min-width: 0; }
    .stop-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 6px; }
    .stop-title strong { font-size: 14px; color: #263238; }
    .stop-code { font-size: 12px; color: #999; }
    .stop-chip { font-size: 11.5px; color: #2e7d32; background: #e8f5e9; padding: 2px 8px; border-radius: 8px; }
    .stop-fields { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px; }
    @media (max-width: 720px) { .stop-fields { grid-template-columns: 1fr; } }
    .stop-fields mat-form-field { width: 100%; }
    .stop-fields ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
    .stop-move { display: flex; flex-direction: column; }

    /* Review */
    .review-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    @media (max-width: 900px) { .review-grid { grid-template-columns: repeat(2, 1fr); } }
    .rv-card { border: 1px solid #e6e6e6; border-radius: 12px; padding: 12px 14px; background: #fafbff;
      display: flex; flex-direction: column; gap: 4px; }
    .rv-card.total { background: #e8f5e9; border-color: #c8e6c9; }
    .rv-k { font-size: 11px; text-transform: uppercase; letter-spacing: .4px; color: #999; }
    .rv-v { font-size: 15px; font-weight: 600; color: #263238; }
    .cap-banner { display: flex; align-items: center; gap: 8px; background: #fff3e0; color: #e65100;
      border: 1px solid #ffe0b2; border-radius: 10px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
    .review-stops h4 { display: flex; align-items: center; gap: 6px; font-size: 15px; color: #263238; margin: 0 0 10px; }
    .review-stops h4 mat-icon { color: #2575fc; }
    .rs-row { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
    .rs-seq { width: 24px; height: 24px; border-radius: 50%; background: #eef3ff; color: #2575fc;
      display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }
    .rs-name { flex: 1; font-size: 13.5px; color: #333; }
    .rs-loc { font-size: 12.5px; color: #888; }
    .rs-amt { font-size: 13.5px; font-weight: 600; color: #2e7d32; min-width: 90px; text-align: right; }
  `]
})
export class AiTripsheetBuilderDialog implements OnInit {
  step = 1;
  loading = true;
  error = '';
  suggestions: any = null;

  warehouseCards = [
    { code: 'WH-KZN', name: 'KwaZulu-Natal', short: 'KZN', city: 'Verulam', color: '#00897b', icon: 'warehouse', special: false },
    { code: 'WH-GP',  name: 'Gauteng',       short: 'GP',  city: 'Johannesburg', color: '#3949ab', icon: 'warehouse', special: false },
    { code: 'WH-WC',  name: 'Western Cape',  short: 'CPT', city: 'Cape Town', color: '#e53935', icon: 'warehouse', special: false },
    { code: 'WH-EC',  name: 'Eastern Cape',  short: 'PE',  city: 'Gqeberha', color: '#fb8c00', icon: 'warehouse', special: false },
    { code: 'CUSTOM', name: 'Custom Load',   short: 'Custom', tagline: 'Pick from every province', color: '#5e35b1', icon: 'tune', special: true },
    { code: 'WELLY',  name: 'Welly Suggest', short: 'Welly', tagline: 'Auto-batched suggestions', color: '#ff6f00', icon: 'lightbulb', special: true }
  ];
  // Province aliases for matching batches to a region card
  private regionProvinces: Record<string, string[]> = {
    'WH-KZN': ['kwazulu-natal', 'kwazulu natal', 'kzn'],
    'WH-GP':  ['gauteng', 'gp'],
    'WH-WC':  ['western cape', 'wc', 'cape town'],
    'WH-EC':  ['eastern cape', 'ec', 'gqeberha', 'port elizabeth']
  };
  selectedWarehouse: any = null;

  vehicleTypes = [
    { ton: 4,  label: '4 Ton',  desc: 'City runs & lighter loads',   pallets: '≈ 6 pallets',  maxInvoices: 12 },
    { ton: 8,  label: '8 Ton',  desc: 'Regional multi-drop routes',  pallets: '≈ 12 pallets', maxInvoices: 20 },
    { ton: 10, label: '10 Ton', desc: 'Bulk & long-haul deliveries', pallets: '≈ 16 pallets', maxInvoices: 30 }
  ];
  selectedVehicle: any = null;

  batches: any[] = [];
  expandedMap: { [k: number]: boolean } = {};

  // Invoice data
  pendingInvoices: any[] = [];
  private invoiceMap = new Map<number, any>();
  invoiceSearch = '';
  manualError = '';

  // The single load being built
  loadInvoices: any[] = [];

  // Route details
  stops: any[] = [];
  scheduledDate: Date = new Date();
  driverId: number | null = null;
  vehicleId: number | null = null;

  creating = false;

  private http = inject(HttpClient);
  private snackBar = inject(MatSnackBar);

  constructor(
    public dialogRef: MatDialogRef<AiTripsheetBuilderDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    this.loadSuggestions();
    this.loadPendingInvoices();
  }

  headerSubtitle(): string {
    switch (this.step) {
      case 1: return 'Step 1 of 5 — choose a warehouse';
      case 2: return 'Step 2 of 5 — choose a vehicle';
      case 3: return 'Step 3 of 5 — build the load';
      case 4: return 'Step 4 of 5 — route details & stops';
      default: return 'Step 5 of 5 — review & generate';
    }
  }

  loadSuggestions(): void {
    this.loading = true;
    this.error = '';
    this.http.get(`${this.data.apiUrl}/logistics/importedinvoices/welly-suggest-tripsheets`).subscribe({
      next: (res: any) => { this.suggestions = res; this.loading = false; },
      error: (err) => { this.error = err.error?.error || 'Failed to load suggestions.'; this.loading = false; }
    });
  }

  loadPendingInvoices(): void {
    this.http.get<any[]>(`${this.data.apiUrl}/logistics/tripsheet/pending-invoices`).subscribe({
      next: (res) => {
        this.pendingInvoices = res || [];
        this.invoiceMap.clear();
        for (const inv of this.pendingInvoices) this.invoiceMap.set(inv.id, inv);
      },
      error: () => { this.pendingInvoices = []; }
    });
  }

  // ── All batches flattened across every warehouse group ──
  private allBatches(): any[] {
    const out: any[] = [];
    for (const wh of (this.suggestions?.warehouses || [])) {
      for (const b of (wh.suggestedTripsheets || [])) out.push(b);
    }
    return out;
  }

  private normalize(s: string): string { return (s || '').toString().trim().toLowerCase(); }

  // Filter flattened batches by the region a card represents
  private batchesForRegion(code: string): any[] {
    const all = this.allBatches();
    if (code === 'CUSTOM') return all;
    const provs = this.regionProvinces[code] || [];
    return all.filter(b => {
      const p = this.normalize(b.province);
      const c = this.normalize(b.city);
      return provs.some(x => p.includes(x) || x.includes(p) || c.includes(x));
    });
  }

  pendingFor(wh: any): number {
    if (wh.special) return 0;
    return this.batchesForRegion(wh.code).reduce((s, b) => s + (b.totalInvoices || 0), 0);
  }
  valueFor(wh: any): number {
    if (wh.special) return 0;
    return this.batchesForRegion(wh.code).reduce((s, b) => s + (b.totalValue || 0), 0);
  }
  totalPendingAll(): number {
    return this.suggestions?.totalPending || this.allBatches().reduce((s, b) => s + (b.totalInvoices || 0), 0);
  }

  private resolveWarehouseId(code: string): number | null {
    const match = (this.data.warehouses || []).find((w: any) => (w.code || '').toUpperCase() === code.toUpperCase());
    return match?.id ?? null;
  }

  selectWarehouse(wh: any): void {
    // Welly Suggest → hand off to the existing suggestions dialog
    if (wh.code === 'WELLY') {
      this.dialogRef.close({ openWellySuggests: true });
      return;
    }
    this.selectedWarehouse = { ...wh, warehouseId: wh.code === 'CUSTOM' ? null : this.resolveWarehouseId(wh.code) };
    // Auto-advance
    this.step = 2;
  }

  selectVehicle(v: any): void {
    this.selectedVehicle = v;
    // Auto-advance
    this.prepareBatches();
    this.step = 3;
  }

  goToStep(s: number): void {
    if (s === 2 && !this.selectedWarehouse) return;
    if (s === 3 && (!this.selectedWarehouse || !this.selectedVehicle)) return;
    if (s === 4) {
      if (!this.loadInvoices.length) return;
      this.buildStops();
    }
    if (s === 5 && !this.loadInvoices.length) return;
    this.step = s;
  }

  private prepareBatches(): void {
    this.batches = this.batchesForRegion(this.selectedWarehouse.code);
    this.expandedMap = {};
  }

  formatMoney(v: number): string {
    if (!v) return '0.00';
    return v.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Batch → invoice rows ──
  batchInvoices(b: any): any[] {
    // Prefer invoice rows embedded in the batch from the backend
    if (b.invoices && b.invoices.length) {
      // Make sure each row is registered so manual-add / stops can find it
      for (const inv of b.invoices) {
        if (!this.invoiceMap.has(inv.id)) this.invoiceMap.set(inv.id, inv);
      }
      return b.invoices;
    }
    // Fallback to the pending-invoices map
    return (b.invoiceIds || []).map((id: number) => this.invoiceMap.get(id)).filter((x: any) => !!x);
  }

  isInLoad(id: number): boolean { return this.loadInvoices.some(i => i.id === id); }

  toggleInvoice(inv: any): void {
    if (this.isInLoad(inv.id)) this.loadInvoices = this.loadInvoices.filter(i => i.id !== inv.id);
    else this.loadInvoices = [...this.loadInvoices, inv];
  }

  batchSelectedCount(b: any): number {
    const ids = new Set(b.invoiceIds || []);
    return this.loadInvoices.filter(i => ids.has(i.id)).length;
  }
  batchAllIn(b: any): boolean {
    const rows = this.batchInvoices(b);
    return rows.length > 0 && rows.every((r: any) => this.isInLoad(r.id));
  }
  batchSomeIn(b: any): boolean {
    const c = this.batchSelectedCount(b);
    return c > 0 && !this.batchAllIn(b);
  }
  toggleBatchAll(b: any, event: any): void {
    const rows = this.batchInvoices(b);
    if (event.checked) {
      const toAdd = rows.filter((r: any) => !this.isInLoad(r.id));
      this.loadInvoices = [...this.loadInvoices, ...toAdd];
    } else {
      const ids = new Set(rows.map((r: any) => r.id));
      this.loadInvoices = this.loadInvoices.filter(i => !ids.has(i.id));
    }
  }

  loadValue(): number { return this.loadInvoices.reduce((s, i) => s + (i.salesAmount || 0), 0); }
  loadCustomerCount(): number {
    return new Set(this.loadInvoices.map(i => (i.customerNumber || i.customerName || '').toString())).size;
  }
  clearLoad(): void { this.loadInvoices = []; }

  // ── Manual invoice entry ──
  addByInvoiceNumber(): void {
    this.manualError = '';
    const term = this.normalize(this.invoiceSearch);
    if (!term) return;
    const matches = this.pendingInvoices.filter(inv => {
      const t = this.normalize(inv.transactionNumber);
      return t === term || t.includes(term);
    });
    if (!matches.length) {
      this.manualError = `No pending invoice found matching "${this.invoiceSearch}". It may already be assigned.`;
      return;
    }
    let added = 0;
    for (const m of matches) {
      if (!this.isInLoad(m.id)) { this.loadInvoices = [...this.loadInvoices, m]; added++; }
    }
    if (added === 0) this.manualError = 'That invoice is already in the load.';
    else this.snackBar.open(`Added ${added} invoice(s) to the load.`, 'OK', { duration: 2500 });
    this.invoiceSearch = '';
  }

  // ── Route details ──
  private buildStops(): void {
    const groups = new Map<string, any>();
    for (const inv of this.loadInvoices) {
      const key = (inv.customerNumber || inv.customerName || 'unknown').toString();
      if (!groups.has(key)) {
        groups.set(key, {
          customerName: inv.customerName || 'Unknown customer',
          customerNumber: inv.customerNumber || '',
          address: inv.deliveryAddress || '',
          city: inv.deliveryCity || '',
          province: inv.deliveryProvince || '',
          contactPerson: inv.contactPerson || '',
          contactPhone: inv.contactPhone || '',
          invoiceCount: 0,
          amount: 0
        });
      }
      const g = groups.get(key);
      g.invoiceCount++;
      g.amount += inv.salesAmount || 0;
      if (!g.address && inv.deliveryAddress) g.address = inv.deliveryAddress;
      if (!g.city && inv.deliveryCity) g.city = inv.deliveryCity;
      if (!g.province && inv.deliveryProvince) g.province = inv.deliveryProvince;
    }
    // Preserve any existing edits when re-entering the step
    const prev = new Map(this.stops.map(s => [s.customerNumber + '|' + s.customerName, s]));
    this.stops = Array.from(groups.values()).map(s => {
      const p = prev.get(s.customerNumber + '|' + s.customerName);
      return p ? { ...s, address: p.address, city: p.city, province: p.province } : s;
    });
  }

  moveStop(i: number, dir: number): void {
    const j = i + dir;
    if (j < 0 || j >= this.stops.length) return;
    const arr = [...this.stops];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    this.stops = arr;
  }

  driverName(): string {
    if (!this.driverId) return 'Assign later';
    const d = (this.data.drivers || []).find((x: any) => x.id === this.driverId);
    return d ? `${d.firstName} ${d.lastName}` : 'Unknown';
  }
  vehicleName(): string {
    if (!this.vehicleId) return 'Assign later';
    const v = (this.data.vehicles || []).find((x: any) => x.id === this.vehicleId);
    return v ? v.registrationNumber : 'Unknown';
  }

  private toLocalIso(d: Date | null): string | null {
    if (!d) return null;
    // Anchor to midday to avoid UTC roll-back in SAST (UTC+2)
    const local = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    return local.toISOString();
  }

  // ── Generate ──
  generate(): void {
    if (!this.loadInvoices.length || this.creating) return;
    this.creating = true;

    // Order invoice ids by the stop order so backend stops follow the route
    const stopOrder = new Map<string, number>();
    this.stops.forEach((s, idx) => stopOrder.set((s.customerNumber || s.customerName || '').toString(), idx));
    const ordered = [...this.loadInvoices].sort((a, b) => {
      const ka = (a.customerNumber || a.customerName || '').toString();
      const kb = (b.customerNumber || b.customerName || '').toString();
      return (stopOrder.get(ka) ?? 0) - (stopOrder.get(kb) ?? 0);
    });

    const region = this.selectedWarehouse?.code === 'CUSTOM' ? 'Custom' : this.selectedWarehouse?.name;
    const notes = `AI Powered Tripsheet — ${this.selectedVehicle?.label} · ${region} · ${this.stops.length} stop(s), ${ordered.length} invoice(s)`;

    this.http.post(`${this.data.apiUrl}/logistics/importedinvoices/create-tripsheet`, {
      invoiceIds: ordered.map(i => i.id),
      warehouseId: this.selectedWarehouse?.warehouseId,
      driverId: this.driverId,
      vehicleId: this.vehicleId,
      scheduledPickupDate: this.toLocalIso(this.scheduledDate),
      notes
    }).subscribe({
      next: (res: any) => {
        this.creating = false;
        this.snackBar.open(`Tripsheet ${res.loadNumber || ''} generated — ${ordered.length} invoices across ${this.stops.length} stops.`, 'OK', { duration: 5000 });
        this.dialogRef.close({ created: true });
      },
      error: (err) => {
        this.creating = false;
        this.snackBar.open('Failed to generate tripsheet: ' + (err.error?.error || 'Unknown error'), 'OK', { duration: 5000 });
      }
    });
  }
}

// ==========================================
// Fuel History Dialog
// ==========================================
@Component({
  selector: 'app-fuel-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatChipsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule
  ],
  template: `
    <div class="fuel-history-dialog">
      <div class="dialog-header">
        <div class="header-info">
          <h2>
            <mat-icon>local_gas_station</mat-icon>
            Fuel History — {{ data.vehicle.registrationNumber }}
          </h2>
          <div class="vehicle-meta">
            @if (data.vehicle.make) {
              <span class="meta-tag">{{ data.vehicle.make }} {{ data.vehicle.model }}</span>
            }
            @if (data.vehicle.vehicleTypeName) {
              <span class="meta-tag type">{{ data.vehicle.vehicleTypeName }}</span>
            }
            @if (data.vehicle.province) {
              <span class="meta-tag province">{{ data.vehicle.province }}</span>
            }
          </div>
        </div>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        @if (loading) {
          <div class="loading-center">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Loading fuel history...</p>
          </div>
        } @else if (transactions.length === 0) {
          <div class="empty-center">
            <mat-icon>local_gas_station</mat-icon>
            <h3>No Fuel History</h3>
            <p>No fuel transactions found for this vehicle.</p>
          </div>
        } @else {
          <!-- Summary Cards -->
          <div class="summary-row">
            <div class="summary-card">
              <mat-icon>receipt</mat-icon>
              <div class="summary-info">
                <span class="summary-value">{{ transactions.length }}</span>
                <span class="summary-label">Transactions</span>
              </div>
            </div>
            <div class="summary-card">
              <mat-icon>opacity</mat-icon>
              <div class="summary-info">
                <span class="summary-value">{{ totalLitres | number:'1.0-0' }}L</span>
                <span class="summary-label">Total Litres</span>
              </div>
            </div>
            <div class="summary-card">
              <mat-icon>payments</mat-icon>
              <div class="summary-info">
                <span class="summary-value">R {{ totalAmount | number:'1.2-2' }}</span>
                <span class="summary-label">Total Spent</span>
              </div>
            </div>
            <div class="summary-card">
              <mat-icon>speed</mat-icon>
              <div class="summary-info">
                <span class="summary-value">R {{ avgCostPerLitre | number:'1.2-2' }}/L</span>
                <span class="summary-label">Avg Cost</span>
              </div>
            </div>
            <div class="summary-card">
              <mat-icon>ev_station</mat-icon>
              <div class="summary-info">
                <span class="summary-value">{{ avgLitresPerFill | number:'1.0-0' }}L</span>
                <span class="summary-label">Avg Per Fill</span>
              </div>
            </div>
          </div>

          <!-- Transactions Table -->
          <div class="table-container">
            <table mat-table [dataSource]="transactions" class="fuel-tx-table">
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Date & Time</th>
                <td mat-cell *matCellDef="let t">{{ t.transactionDate | date:'dd MMM yyyy HH:mm' }}</td>
              </ng-container>
              <ng-container matColumnDef="depot">
                <th mat-header-cell *matHeaderCellDef>Depot</th>
                <td mat-cell *matCellDef="let t">{{ t.depotName }}</td>
              </ng-container>
              <ng-container matColumnDef="allocation">
                <th mat-header-cell *matHeaderCellDef>Allocation</th>
                <td mat-cell *matCellDef="let t">{{ t.allocationLitres | number:'1.0-0' }}L</td>
              </ng-container>
              <ng-container matColumnDef="litres">
                <th mat-header-cell *matHeaderCellDef>Litres Used</th>
                <td mat-cell *matCellDef="let t">
                  <strong>{{ t.litresUsed | number:'1.2-2' }}L</strong>
                </td>
              </ng-container>
              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef>Amount</th>
                <td mat-cell *matCellDef="let t">
                  <strong>R {{ t.amountSpent | number:'1.2-2' }}</strong>
                </td>
              </ng-container>
              <ng-container matColumnDef="costPerLitre">
                <th mat-header-cell *matHeaderCellDef>R/Litre</th>
                <td mat-cell *matCellDef="let t">R {{ (t.litresUsed > 0 ? t.amountSpent / t.litresUsed : 0) | number:'1.2-2' }}</td>
              </ng-container>
              <ng-container matColumnDef="assignment">
                <th mat-header-cell *matHeaderCellDef>Group</th>
                <td mat-cell *matCellDef="let t">
                  <span class="assignment-badge">{{ t.depotAssignment }}</span>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .fuel-history-dialog {
      max-height: 85vh;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 24px 16px;
      border-bottom: 1px solid #eee;
    }

    .header-info h2 {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .header-info h2 mat-icon {
      color: #ff9800;
    }

    .vehicle-meta {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }

    .meta-tag {
      font-size: 12px;
      padding: 2px 10px;
      border-radius: 12px;
      background: #f0f0f0;
      color: #555;
    }

    .meta-tag.type {
      background: rgba(33,150,243,0.1);
      color: #1565c0;
    }

    .meta-tag.province {
      background: rgba(76,175,80,0.1);
      color: #2e7d32;
    }

    .dialog-body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    }

    .loading-center, .empty-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px;
      color: #888;
    }

    .empty-center mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #ccc;
      margin-bottom: 12px;
    }

    .empty-center h3 {
      margin: 0 0 8px;
      color: #555;
    }

    .summary-row {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .summary-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #f8f9fa;
      border: 1px solid #e9ecef;
      border-radius: 10px;
      flex: 1;
      min-width: 160px;
    }

    .summary-card mat-icon {
      color: #1e90ff;
      font-size: 24px;
    }

    .summary-info {
      display: flex;
      flex-direction: column;
    }

    .summary-value {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .summary-label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .table-container {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid #e9ecef;
    }

    .fuel-tx-table {
      width: 100%;
    }

    .fuel-tx-table th {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      font-weight: 600;
      color: #1a1a2e;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .fuel-tx-table td {
      color: #333;
      font-size: 13px;
    }

    .fuel-tx-table tr:hover td {
      background: rgba(30,144,255,0.04);
    }

    .assignment-badge {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 8px;
      background: rgba(33,150,243,0.1);
      color: #1565c0;
      white-space: nowrap;
    }
  `]
})
export class FuelHistoryDialog {
  loading = true;
  transactions: any[] = [];
  totalLitres = 0;
  totalAmount = 0;
  avgCostPerLitre = 0;
  avgLitresPerFill = 0;
  displayedColumns = ['date', 'depot', 'allocation', 'litres', 'amount', 'costPerLitre', 'assignment'];

  private http = inject(HttpClient);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<FuelHistoryDialog>
  ) {
    this.loadFuelHistory();
  }

  loadFuelHistory(): void {
    this.http.get<any[]>(`${this.data.apiUrl}/fuelhistory/vehicle/${this.data.vehicle.id}`).subscribe({
      next: (txns) => {
        this.transactions = txns;
        this.totalLitres = txns.reduce((sum, t) => sum + t.litresUsed, 0);
        this.totalAmount = txns.reduce((sum, t) => sum + t.amountSpent, 0);
        this.avgCostPerLitre = this.totalLitres > 0 ? this.totalAmount / this.totalLitres : 0;
        this.avgLitresPerFill = txns.length > 0 ? this.totalLitres / txns.length : 0;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load fuel history:', err);
        this.loading = false;
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}

// ==========================================
// Vehicle Maintenance History Dialog
// ==========================================
@Component({
  selector: 'app-vehicle-maintenance-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    FormsModule
  ],
  template: `
    <div class="maint-history-dialog">
      <div class="dialog-header">
        <div class="header-info">
          <h2>
            <mat-icon>build_circle</mat-icon>
            Maintenance History — {{ data.vehicle.registrationNumber }}
          </h2>
          <div class="vehicle-meta">
            @if (data.vehicle.make) {
              <span class="meta-tag">{{ data.vehicle.make }} {{ data.vehicle.model }}</span>
            }
            @if (data.vehicle.vehicleTypeName || data.vehicle.type) {
              <span class="meta-tag type">{{ data.vehicle.vehicleTypeName || data.vehicle.type }}</span>
            }
            @if (data.vehicle.province) {
              <span class="meta-tag province">{{ data.vehicle.province }}</span>
            }
          </div>
        </div>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-body">
        @if (loading) {
          <div class="loading-center">
            <mat-spinner diameter="40"></mat-spinner>
            <p>Loading maintenance history...</p>
          </div>
        } @else if (records.length === 0) {
          <div class="empty-center">
            <mat-icon>build_circle</mat-icon>
            <h3>No Maintenance History</h3>
            <p>No maintenance records found for this vehicle.</p>
          </div>
        } @else {
          <!-- Summary Cards -->
          <div class="summary-row">
            <div class="summary-card">
              <mat-icon>assignment</mat-icon>
              <div class="summary-info">
                <span class="summary-value">{{ records.length }}</span>
                <span class="summary-label">Total Records</span>
              </div>
            </div>
            <div class="summary-card completed">
              <mat-icon>check_circle</mat-icon>
              <div class="summary-info">
                <span class="summary-value">{{ completedCount }}</span>
                <span class="summary-label">Completed</span>
              </div>
            </div>
            <div class="summary-card scheduled">
              <mat-icon>schedule</mat-icon>
              <div class="summary-info">
                <span class="summary-value">{{ scheduledCount }}</span>
                <span class="summary-label">Scheduled</span>
              </div>
            </div>
            <div class="summary-card in-progress">
              <mat-icon>autorenew</mat-icon>
              <div class="summary-info">
                <span class="summary-value">{{ inProgressCount }}</span>
                <span class="summary-label">In Progress</span>
              </div>
            </div>
            <div class="summary-card cost">
              <mat-icon>payments</mat-icon>
              <div class="summary-info">
                <span class="summary-value">R {{ totalCost | number:'1.2-2' }}</span>
                <span class="summary-label">Total Cost</span>
              </div>
            </div>
          </div>

          <!-- Filter -->
          <div class="filter-row">
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter" (selectionChange)="applyFilter()">
                <mat-option value="all">All Statuses</mat-option>
                <mat-option value="scheduled">Scheduled</mat-option>
                <mat-option value="in-progress">In Progress</mat-option>
                <mat-option value="completed">Completed</mat-option>
                <mat-option value="overdue">Overdue</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" class="filter-field">
              <mat-label>Type</mat-label>
              <mat-select [(ngModel)]="typeFilter" (selectionChange)="applyFilter()">
                <mat-option value="all">All Types</mat-option>
                @for (type of uniqueTypes; track type) {
                  <mat-option [value]="type">{{ type | titlecase }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          <!-- Records Table -->
          <div class="table-container">
            <table mat-table [dataSource]="filteredRecords" class="maint-table">
              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef>Type</th>
                <td mat-cell *matCellDef="let r">
                  <span class="type-badge" [ngClass]="'type-' + r.maintenanceType">
                    {{ r.maintenanceType | titlecase }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Description</th>
                <td mat-cell *matCellDef="let r">{{ r.description || '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let r">
                  <span class="status-chip" [ngClass]="'status-' + r.status">
                    {{ r.status | titlecase }}
                  </span>
                </td>
              </ng-container>
              <ng-container matColumnDef="priority">
                <th mat-header-cell *matHeaderCellDef>Priority</th>
                <td mat-cell *matCellDef="let r">
                  <span class="priority-dot" [ngClass]="'priority-' + r.priority"></span>
                  {{ r.priority | titlecase }}
                </td>
              </ng-container>
              <ng-container matColumnDef="scheduledDate">
                <th mat-header-cell *matHeaderCellDef>Scheduled</th>
                <td mat-cell *matCellDef="let r">{{ r.scheduledDate | date:'dd MMM yyyy' }}</td>
              </ng-container>
              <ng-container matColumnDef="completedDate">
                <th mat-header-cell *matHeaderCellDef>Completed</th>
                <td mat-cell *matCellDef="let r">
                  @if (r.completedDate) {
                    {{ r.completedDate | date:'dd MMM yyyy' }}
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="cost">
                <th mat-header-cell *matHeaderCellDef>Cost</th>
                <td mat-cell *matCellDef="let r">
                  @if (r.cost || r.actualCost) {
                    <strong>R {{ (r.actualCost || r.cost) | number:'1.2-2' }}</strong>
                  } @else if (r.estimatedCost) {
                    <span class="muted">~R {{ r.estimatedCost | number:'1.2-2' }}</span>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="serviceProvider">
                <th mat-header-cell *matHeaderCellDef>Service Provider</th>
                <td mat-cell *matCellDef="let r">{{ r.serviceProvider || r.assignedTo || '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="odometer">
                <th mat-header-cell *matHeaderCellDef>Odometer</th>
                <td mat-cell *matCellDef="let r">
                  @if (r.odometerReading) {
                    {{ r.odometerReading | number:'1.0-0' }} km
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" [ngClass]="getRowClass(row)"></tr>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .maint-history-dialog {
      max-height: 85vh;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 24px 16px;
      border-bottom: 1px solid #e9ecef;
      background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
    }

    .header-info h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #1a1a2e;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-info h2 mat-icon {
      color: #ff9800;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .vehicle-meta {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .meta-tag {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 12px;
      background: rgba(0,0,0,0.06);
      color: #555;
      font-weight: 500;
    }

    .meta-tag.type {
      background: rgba(33,150,243,0.1);
      color: #1565c0;
    }

    .meta-tag.province {
      background: rgba(76,175,80,0.1);
      color: #2e7d32;
    }

    .dialog-body {
      padding: 20px 24px;
      overflow-y: auto;
      max-height: calc(85vh - 100px);
    }

    .loading-center, .empty-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #999;
    }

    .empty-center mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #ddd;
      margin-bottom: 16px;
    }

    .empty-center h3 {
      margin: 0 0 8px;
      color: #666;
    }

    .summary-row {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .summary-card {
      flex: 1;
      min-width: 140px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 12px;
      background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);
      border: 1px solid #e9ecef;
    }

    .summary-card mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #1e90ff;
    }

    .summary-card.completed mat-icon { color: #4caf50; }
    .summary-card.scheduled mat-icon { color: #ff9800; }
    .summary-card.in-progress mat-icon { color: #2196f3; }
    .summary-card.cost mat-icon { color: #9c27b0; }

    .summary-info {
      display: flex;
      flex-direction: column;
    }

    .summary-value {
      font-size: 16px;
      font-weight: 700;
      color: #1a1a2e;
    }

    .summary-label {
      font-size: 11px;
      color: #999;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .filter-row {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }

    .filter-field {
      width: 180px;
    }

    .filter-field ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }

    .table-container {
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid #e9ecef;
    }

    .maint-table {
      width: 100%;
    }

    .maint-table th {
      background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
      font-weight: 600;
      color: #1a1a2e;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .maint-table td {
      color: #333;
      font-size: 13px;
    }

    .maint-table tr:hover td {
      background: rgba(255,152,0,0.04);
    }

    .maint-table tr.row-overdue td {
      background: rgba(244,67,54,0.04);
    }

    .maint-table tr.row-in-progress td {
      background: rgba(33,150,243,0.04);
    }

    .type-badge {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 10px;
      font-weight: 600;
      white-space: nowrap;
    }

    .type-badge.type-scheduled { background: rgba(255,152,0,0.12); color: #e65100; }
    .type-badge.type-repair { background: rgba(244,67,54,0.12); color: #c62828; }
    .type-badge.type-inspection { background: rgba(33,150,243,0.12); color: #1565c0; }
    .type-badge.type-license { background: rgba(156,39,176,0.12); color: #7b1fa2; }
    .type-badge.type-tire { background: rgba(121,85,72,0.12); color: #4e342e; }
    .type-badge.type-body { background: rgba(0,150,136,0.12); color: #00695c; }
    .type-badge.type-electrical { background: rgba(255,193,7,0.12); color: #f57f17; }
    .type-badge.type-preventive { background: rgba(76,175,80,0.12); color: #2e7d32; }

    .status-chip {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 10px;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-chip.status-completed { background: rgba(76,175,80,0.12); color: #2e7d32; }
    .status-chip.status-scheduled { background: rgba(255,152,0,0.12); color: #e65100; }
    .status-chip.status-in-progress { background: rgba(33,150,243,0.12); color: #1565c0; }
    .status-chip.status-overdue { background: rgba(244,67,54,0.12); color: #c62828; }

    .priority-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
    }

    .priority-dot.priority-critical { background: #f44336; }
    .priority-dot.priority-high { background: #ff9800; }
    .priority-dot.priority-medium { background: #2196f3; }
    .priority-dot.priority-low { background: #4caf50; }

    .muted {
      color: #bbb;
    }
  `]
})
export class VehicleMaintenanceHistoryDialog {
  loading = true;
  records: any[] = [];
  filteredRecords: any[] = [];
  statusFilter = 'all';
  typeFilter = 'all';
  uniqueTypes: string[] = [];

  completedCount = 0;
  scheduledCount = 0;
  inProgressCount = 0;
  totalCost = 0;

  displayedColumns = ['type', 'description', 'status', 'priority', 'scheduledDate', 'completedDate', 'cost', 'serviceProvider', 'odometer'];

  private http = inject(HttpClient);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<VehicleMaintenanceHistoryDialog>
  ) {
    this.loadMaintenanceHistory();
  }

  loadMaintenanceHistory(): void {
    const vehicleId = this.data.vehicle.id;
    this.http.get<any[]>(`${this.data.apiUrl}/logistics/maintenance?vehicleId=${vehicleId}`).subscribe({
      next: (records) => {
        this.records = records.map(r => ({
          ...r,
          vehicleReg: r.vehicleRegistration || r.vehicleReg || '',
          status: (r.status || '').toLowerCase().replace(/\s+/g, '-'),
          priority: r.priority || 'medium',
          assignedTo: r.assignedTo || r.serviceProvider || ''
        }));
        // Sort by date descending (most recent first)
        this.records.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime());
        this.calculateSummary();
        this.uniqueTypes = [...new Set(this.records.map(r => r.maintenanceType).filter(Boolean))].sort();
        this.filteredRecords = [...this.records];
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load maintenance history:', err);
        this.loading = false;
      }
    });
  }

  calculateSummary(): void {
    this.completedCount = this.records.filter(r => r.status === 'completed').length;
    this.scheduledCount = this.records.filter(r => r.status === 'scheduled').length;
    this.inProgressCount = this.records.filter(r => r.status === 'in-progress').length;
    this.totalCost = this.records.reduce((sum, r) => sum + (r.actualCost || r.cost || 0), 0);
  }

  applyFilter(): void {
    let filtered = [...this.records];
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(r => r.status === this.statusFilter);
    }
    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(r => r.maintenanceType === this.typeFilter);
    }
    this.filteredRecords = filtered;
  }

  getRowClass(record: any): string {
    if (record.status === 'overdue') return 'row-overdue';
    if (record.status === 'in-progress') return 'row-in-progress';
    return '';
  }

  close(): void {
    this.dialogRef.close();
  }
}

// ==========================================
// Today's Trip History Dialog — Map View
// ==========================================
@Component({
  selector: 'app-today-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatMenuModule
  ],
  template: `
    <div class="trip-history-dialog">
      <div class="dialog-header">
        <div class="header-info">
          <h2>
            <mat-icon>timeline</mat-icon>
            Movement History — {{ data.vehicle.registrationNumber }}
          </h2>
          <div class="vehicle-meta">
            @if (data.vehicle.make) {
              <span class="meta-tag">{{ data.vehicle.make }} {{ data.vehicle.model }}</span>
            }
            @if (data.vehicle.currentDriver || data.vehicle.currentDriverName) {
              <span class="meta-tag driver">
                <mat-icon>person</mat-icon>
                {{ data.vehicle.currentDriver || data.vehicle.currentDriverName }}
              </span>
            }
          </div>
        </div>
        <div class="header-actions">
          <div class="date-nav">
            <button mat-icon-button matTooltip="Previous day" (click)="changeDay(-1)" class="header-btn">
              <mat-icon>chevron_left</mat-icon>
            </button>
            <input type="date" class="date-input" [ngModel]="selectedDate" (ngModelChange)="onDateChange($event)" [max]="maxDate" />
            <button mat-icon-button matTooltip="Next day" (click)="changeDay(1)" class="header-btn" [disabled]="isToday">
              <mat-icon>chevron_right</mat-icon>
            </button>
            <button mat-stroked-button class="today-btn" (click)="goToToday()" [disabled]="isToday">Today</button>
          </div>
          <button mat-icon-button matTooltip="Refresh live from CarTrack" (click)="refreshFromCarTrack()" class="header-btn" [disabled]="refreshing || loading">
            <mat-icon [class.spin]="refreshing">refresh</mat-icon>
          </button>
          @if (trips.length > 0) {
            <button mat-icon-button matTooltip="Export…" [matMenuTriggerFor]="exportMenu" class="header-btn">
              <mat-icon>download</mat-icon>
            </button>
            <mat-menu #exportMenu="matMenu">
              <button mat-menu-item (click)="exportToExcel()">
                <mat-icon>today</mat-icon>
                <span>Today's / selected day movements</span>
              </button>
              <button mat-menu-item (click)="exportDateRange()">
                <mat-icon>date_range</mat-icon>
                <span>Date range…</span>
              </button>
              <button mat-menu-item (click)="exportMonthlyKm()">
                <mat-icon>insights</mat-icon>
                <span>Vehicle km average (this month)</span>
              </button>
            </mat-menu>
          }
          <button mat-icon-button (click)="close()" class="header-btn">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      @if (loading) {
        <mat-progress-bar mode="indeterminate" class="top-progress"></mat-progress-bar>
        <div class="loading-center">
          <mat-spinner diameter="40"></mat-spinner>
          <p>{{ loadingMessage }}</p>
        </div>
      } @else if (!isLinked) {
        <div class="empty-center">
          <mat-icon>link_off</mat-icon>
          <h3>Not Linked to CarTrack</h3>
          <p>This vehicle is not linked to CarTrack. Link it first to view movement history.</p>
        </div>
      } @else if (trips.length === 0 && fuelEvents.length === 0) {
        @if (liveStatus?.isMoving) {
          <div class="empty-center live">
            <div class="live-pulse"><mat-icon>my_location</mat-icon></div>
            <h3>On the move now</h3>
            <p>
              This vehicle is currently driving at <strong>{{ liveStatus.speed | number:'1.0-0' }} km/h</strong>{{ liveStatus.address ? ' near ' + liveStatus.address : '' }}.
            </p>
            <p class="live-note">
              CarTrack only records a trip once it ends, so the current trip will appear here after the vehicle stops.
              <span *ngIf="liveStatus.lastUpdate"> Last update {{ formatTime(liveStatus.lastUpdate) }}.</span>
            </p>
            <button mat-stroked-button (click)="loadTripHistory(true)" [disabled]="refreshing">
              <mat-icon>refresh</mat-icon> Check for completed trips
            </button>
          </div>
        } @else {
          <div class="empty-center">
            <mat-icon>directions_car</mat-icon>
            <h3>No Movement</h3>
            <p>No trip or fuel data recorded for this vehicle on {{ displayDate }}.</p>
          </div>
        }
      } @else {
        @if (refreshing) {
          <mat-progress-bar mode="indeterminate" class="top-progress"></mat-progress-bar>
        }
        <!-- Summary Strip -->
        <div class="summary-strip">
          @if (liveStatus?.isMoving) {
            <div class="summary-chip live-chip">
              <span class="dot"></span>
              <span>LIVE · <strong>{{ liveStatus.speed | number:'1.0-0' }}</strong> km/h now</span>
            </div>
          }
          <div class="summary-chip distance">
            <mat-icon>straighten</mat-icon>
            <span><strong>{{ totalDistanceKm }}</strong> km</span>
          </div>
          <div class="summary-chip">
            <mat-icon>route</mat-icon>
            <span><strong>{{ trips.length }}</strong> trips</span>
          </div>
          <div class="summary-chip">
            <mat-icon>schedule</mat-icon>
            <span><strong>{{ totalDurationFormatted }}</strong> driving</span>
          </div>
          <div class="summary-chip speed">
            <mat-icon>speed</mat-icon>
            <span><strong>{{ maxSpeed }}</strong> km/h max</span>
          </div>
          <div class="summary-chip">
            <mat-icon>hourglass_empty</mat-icon>
            <span><strong>{{ totalIdleFormatted }}</strong> idle</span>
          </div>
          @if (totalHarshEvents > 0) {
            <div class="summary-chip warning">
              <mat-icon>warning</mat-icon>
              <span><strong>{{ totalHarshEvents }}</strong> harsh events</span>
            </div>
          }
          @if (fuelEvents.length > 0) {
            <div class="summary-chip fuel">
              <mat-icon>local_gas_station</mat-icon>
              <span><strong>{{ fuelEvents.length }}</strong> fuel · {{ totalFuelLitres | number:'1.0-0' }}L · R{{ totalFuelAmount | number:'1.0-0' }}</span>
            </div>
          }
          <div class="export-btn-wrap">
            <button mat-raised-button class="fuel-health-btn" (click)="openFuelHealth()" matTooltip="Fuel health & irregularity score">
              <mat-icon>local_gas_station</mat-icon>
              Fuel Health Score
            </button>
            <button mat-raised-button class="export-btn" (click)="exportToExcel()">
              <mat-icon>download</mat-icon>
              Export
            </button>
          </div>
        </div>

        <!-- Main Content: Sidebar + Map -->
        <div class="main-content">
          <!-- Trip List Sidebar -->
          <div class="trip-sidebar">
            @if (fuelEvents.length > 0) {
              <div class="sidebar-header fuel-header">
                <mat-icon>local_gas_station</mat-icon> Refuelling ({{ fuelEvents.length }})
              </div>
              <div class="fuel-list">
                @for (fuel of fuelEvents; track $index) {
                  <div class="fuel-item">
                    <div class="fuel-icon"><mat-icon>local_gas_station</mat-icon></div>
                    <div class="fuel-details">
                      <div class="fuel-time">{{ formatTime(fuel.timestamp) }}</div>
                      <div class="fuel-loc">{{ fuel.depotName || fuel.depotAssignment || 'Fuel station' }}</div>
                      <div class="fuel-stats">
                        <span>{{ fuel.litres | number:'1.0-1' }} L</span>
                        <span class="dot-sep">·</span>
                        <span>R{{ fuel.amount | number:'1.2-2' }}</span>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
            <div class="sidebar-header">
              <span>Trips</span>
            </div>
            <div class="trip-list">
              @for (trip of trips; track trip.tripId; let i = $index) {
                <div class="trip-item" [class.active]="selectedTripIndex === i" (click)="selectTrip(i)">
                  <div class="trip-number">{{ i + 1 }}</div>
                  <div class="trip-details">
                    <div class="trip-time">
                      {{ formatTime(trip.startTimestamp) }} → {{ formatTime(trip.endTimestamp) }}
                    </div>
                    <div class="trip-locations">
                      <span class="loc-from">{{ trip.startGeofence || trip.startLocation || 'Unknown' }}</span>
                      <mat-icon class="arrow-icon">arrow_forward</mat-icon>
                      <span class="loc-to">{{ trip.endGeofence || trip.endLocation || 'Unknown' }}</span>
                    </div>
                    <div class="trip-stats">
                      <span>{{ (trip.tripDistance / 1000).toFixed(1) }} km</span>
                      <span class="dot-sep">·</span>
                      <span>{{ trip.tripDuration || formatDuration(trip.tripDurationSeconds) }}</span>
                      <span class="dot-sep">·</span>
                      <span [class.speed-warning]="trip.maxSpeed > 120">{{ trip.maxSpeed | number:'1.0-0' }} km/h</span>
                      @if (trip.harshBrakingEvents + trip.harshCorneringEvents + trip.harshAccelerationEvents > 0) {
                        <span class="dot-sep">·</span>
                        <span class="harsh-count" matTooltip="Harsh events">⚠ {{ trip.harshBrakingEvents + trip.harshCorneringEvents + trip.harshAccelerationEvents }}</span>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- Map Area -->
          <div class="map-area">
            <div #tripMapElement class="trip-map"></div>
            @if (mapLoading) {
              <div class="map-loading-overlay">
                <mat-spinner diameter="36"></mat-spinner>
                <p>Loading map...</p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .trip-history-dialog {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #fff;
      border-radius: 16px;
      overflow: hidden;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 20px 24px 14px;
      background: linear-gradient(135deg, #00838f 0%, #00acc1 100%);
      color: #fff;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      color: #fff;
    }

    .dialog-header h2 mat-icon {
      font-size: 24px; width: 24px; height: 24px;
    }

    .header-actions {
      display: flex;
      gap: 4px;
    }

    .header-btn { color: rgba(255,255,255,0.85); }

    .header-btn .spin {
      animation: mh-spin 1s linear infinite;
    }

    @keyframes mh-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .vehicle-meta {
      display: flex;
      gap: 6px;
      margin-top: 6px;
      flex-wrap: wrap;
    }

    .meta-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(255,255,255,0.2);
      color: #fff;
    }

    .meta-tag mat-icon {
      font-size: 13px; width: 13px; height: 13px;
    }

    /* Loading / Empty states */
    .loading-center, .empty-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 60px 20px;
      color: #999;
    }

    .empty-center mat-icon {
      font-size: 56px; width: 56px; height: 56px;
      color: #ccc; margin-bottom: 16px;
    }

    .empty-center h3 { color: #555; margin: 0 0 8px; }

    /* Summary Strip */
    .summary-strip {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
      flex-wrap: wrap;
    }

    .summary-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-size: 12px;
      color: #555;
      padding: 4px 10px;
      border-radius: 16px;
      background: #fff;
      border: 1px solid #e0e0e0;
    }

    .summary-chip mat-icon {
      font-size: 16px; width: 16px; height: 16px; color: #00838f;
    }

    .summary-chip.speed mat-icon { color: #e53935; }
    .summary-chip.warning mat-icon { color: #ff8f00; }
    .summary-chip.warning { background: #fff8e1; border-color: #ffe082; }
    .summary-chip.distance { background: #e0f7fa; border-color: #80deea; }
    .summary-chip.fuel { background: #e8f5e9; border-color: #a5d6a7; }
    .summary-chip.fuel mat-icon { color: #2e7d32; }

    /* Live "on the move now" styling */
    .top-progress { position: sticky; top: 0; z-index: 5; }
    .summary-chip.live-chip { background: #ffebee; border-color: #ef9a9a; color: #c62828; font-weight: 600; }
    .summary-chip.live-chip .dot {
      width: 9px; height: 9px; border-radius: 50%; background: #e53935; display: inline-block;
      margin-right: 2px; animation: live-blink 1.1s ease-in-out infinite;
    }
    @keyframes live-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
    .empty-center.live h3 { color: #c62828; }
    .empty-center.live .live-note { font-size: 12.5px; color: #777; max-width: 420px; }
    .empty-center.live button { margin-top: 12px; }
    .live-pulse {
      width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: rgba(229,57,53,0.12); color: #e53935; margin-bottom: 8px;
      animation: live-ring 1.6s ease-out infinite;
    }
    .live-pulse mat-icon { font-size: 32px; width: 32px; height: 32px; }
    @keyframes live-ring {
      0% { box-shadow: 0 0 0 0 rgba(229,57,53,0.35); }
      100% { box-shadow: 0 0 0 18px rgba(229,57,53,0); }
    }

    /* Fuel-theft / anomaly banner */
    .fuel-risk-banner {
      margin: 8px 12px; padding: 10px 14px; background: #fff;
      border: 1px solid #eee; border-left: 4px solid #d32f2f; border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .fuel-risk-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .fuel-risk-head mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .fuel-risk-title { font-weight: 700; font-size: 14px; }
    .fuel-risk-score { font-size: 12px; color: #777; }
    .fuel-risk-econ { font-size: 12px; color: #555; margin-left: auto; background: #f5f5f5; padding: 2px 8px; border-radius: 10px; }
    .fuel-risk-list { margin: 8px 0 0; padding: 0; list-style: none; }
    .fuel-risk-list li { display: flex; align-items: flex-start; gap: 6px; font-size: 12.5px; color: #444; padding: 3px 0; }
    .fuel-risk-list li.high { color: #b71c1c; font-weight: 600; }
    .fuel-risk-list li mat-icon { font-size: 16px; width: 16px; height: 16px; margin-top: 1px; color: #999; }
    .fuel-risk-list li.high mat-icon { color: #d32f2f; }

    /* Date navigation */
    .date-nav {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-right: 8px;
    }

    .date-input {
      background: rgba(255,255,255,0.9);
      border: none;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      color: #1a1a2e;
      cursor: pointer;
    }

    .today-btn {
      color: #fff !important;
      border-color: rgba(255,255,255,0.6) !important;
      font-size: 11px;
      height: 28px;
      line-height: 28px;
      min-width: 0;
      padding: 0 10px;
    }

    .today-btn:disabled {
      opacity: 0.4;
      color: rgba(255,255,255,0.5) !important;
    }

    /* Fuel section in sidebar */
    .fuel-header {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #2e7d32 !important;
      background: #f1f8e9 !important;
    }

    .fuel-header mat-icon {
      font-size: 16px; width: 16px; height: 16px;
    }

    .fuel-list {
      border-bottom: 2px solid #e0e0e0;
    }

    .fuel-item {
      display: flex;
      gap: 10px;
      padding: 10px 16px;
      border-bottom: 1px solid #f0f0f0;
      background: #fbfffb;
    }

    .fuel-icon {
      width: 26px; height: 26px;
      border-radius: 50%;
      background: #2e7d32;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .fuel-icon mat-icon {
      font-size: 16px; width: 16px; height: 16px;
    }

    .fuel-details { flex: 1; min-width: 0; }
    .fuel-time { font-size: 13px; font-weight: 600; color: #1a1a2e; }
    .fuel-loc {
      font-size: 11px; color: #666; margin-top: 2px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .fuel-stats {
      display: flex; align-items: center; gap: 4px;
      margin-top: 3px; font-size: 11px; color: #2e7d32; font-weight: 600;
    }

    .summary-chip strong {
      font-weight: 700;
      color: #1a1a2e;
    }

    .export-btn-wrap {
      margin-left: auto;
      display: flex;
      gap: 8px;
    }

    .fuel-health-btn {
      background: #ef6c00 !important;
      color: #fff !important;
      font-size: 12px;
    }

    .export-btn {
      background: #00838f !important;
      color: #fff !important;
      font-size: 12px;
      height: 32px;
      line-height: 32px;
      padding: 0 14px;
    }

    .export-btn mat-icon {
      font-size: 16px; width: 16px; height: 16px; margin-right: 4px;
    }

    /* Main Content Layout */
    .main-content {
      display: flex;
      flex: 1;
      min-height: 0;
      overflow: hidden;
    }

    /* Sidebar */
    .trip-sidebar {
      width: 320px;
      min-width: 320px;
      border-right: 1px solid #e9ecef;
      display: flex;
      flex-direction: column;
      background: #fff;
    }

    .sidebar-header {
      padding: 12px 16px;
      font-size: 13px;
      font-weight: 600;
      color: #333;
      border-bottom: 1px solid #e9ecef;
      background: #fafafa;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .trip-list {
      flex: 1;
      overflow-y: auto;
    }

    .trip-item {
      display: flex;
      gap: 10px;
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.15s;
    }

    .trip-item:hover { background: #f5f9ff; }
    .trip-item.active {
      background: #e3f2fd;
      border-left: 3px solid #00838f;
    }

    .trip-number {
      width: 26px; height: 26px;
      border-radius: 50%;
      background: #00838f;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .trip-details {
      flex: 1;
      min-width: 0;
    }

    .trip-time {
      font-size: 13px;
      font-weight: 600;
      color: #1a1a2e;
    }

    .trip-locations {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 3px;
      font-size: 11px;
      color: #666;
    }

    .loc-from, .loc-to {
      max-width: 100px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .arrow-icon {
      font-size: 12px !important;
      width: 12px !important;
      height: 12px !important;
      color: #bbb;
    }

    .trip-stats {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      font-size: 11px;
      color: #888;
    }

    .dot-sep { color: #ccc; }
    .speed-warning { color: #e53935; font-weight: 600; }
    .harsh-count { color: #ff8f00; font-weight: 600; }

    /* Map Area */
    .map-area {
      flex: 1;
      position: relative;
      min-height: 0;
    }

    .trip-map {
      width: 100%;
      height: 100%;
    }

    .map-loading-overlay {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #999;
    }

    @media (max-width: 768px) {
      .trip-sidebar { display: none; }
      .summary-strip { padding: 8px 12px; gap: 6px; }
    }
  `]
})
export class TodayHistoryDialog implements AfterViewInit, OnDestroy {
  @ViewChild('tripMapElement') mapElement!: ElementRef;

  loading = true;
  isLinked = true;
  mapLoading = true;
  trips: any[] = [];
  totalDistanceKm = 0;
  totalDurationFormatted = '';
  maxSpeed = 0;
  totalIdleFormatted = '';
  totalHarshEvents = 0;
  todayDate = '';
  selectedTripIndex = -1;

  // Fuel events for the selected day (from TFN)
  fuelEvents: any[] = [];
  totalFuelLitres = 0;
  totalFuelAmount = 0;

  // Live status for today (from CarTrack real-time feed) — shows in-progress movement
  liveStatus: any = null;
  loadingMessage = 'Loading movement history…';

  // Fuel-theft / anomaly analysis (rolling window)
  fuelAnalysis: any = null;
  fuelAnalysisLoading = false;
  fuelAnalysisDays = 30;

  // Selected date (yyyy-MM-dd) — supports back-dating
  selectedDate = '';
  maxDate = '';

  // Where the currently shown data came from: 'database' | 'cartrack-live' | 'cartrack-refresh'
  dataSource = 'database';
  refreshing = false;

  get isToday(): boolean {
    return this.selectedDate === this.maxDate;
  }

  get displayDate(): string {
    if (!this.selectedDate) return '';
    const d = new Date(this.selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  private map: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private polylines: google.maps.Polyline[] = [];
  private infoWindow: google.maps.InfoWindow | null = null;
  private directionsService: google.maps.DirectionsService | null = null;
  private mapInitialized = false;

  private http = inject(HttpClient);
  private dialog = inject(MatDialog);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<TodayHistoryDialog>
  ) {
    const today = new Date().toISOString().split('T')[0];
    this.selectedDate = today;
    this.maxDate = today;
    this.todayDate = new Date().toLocaleDateString('en-ZA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    this.loadTripHistory();
  }

  ngAfterViewInit(): void {
    // Map will be initialized after data loads
  }

  ngOnDestroy(): void {
    this.clearMapOverlays();
    if (this.infoWindow) this.infoWindow.close();
  }

  private clearMapOverlays(): void {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
    this.polylines.forEach(p => p.setMap(null));
    this.polylines = [];
  }

  loadTripHistory(refresh = false): void {
    const vehicle = this.data.vehicle;

    if (!vehicle.carTrackId && !vehicle.isLinkedToCarTrack) {
      this.isLinked = false;
      this.loading = false;
      return;
    }

    const reg = vehicle.registrationNumber;
    const targetDate = this.selectedDate;
    if (refresh) { this.refreshing = true; this.loadingMessage = 'Syncing live data from CarTrack…'; }
    else { this.loading = true; this.loadingMessage = 'Loading movement history…'; }

    const url = `${this.data.apiUrl}/fleet/vehicles/${encodeURIComponent(reg)}/trip-history?date=${targetDate}&refresh=${refresh}`;
    this.http.get<any>(url).subscribe({
      next: (response) => {
        this.trips = response.trips || [];
        this.dataSource = response.source || 'database';
        this.totalDistanceKm = response.totalDistanceKm || 0;
        this.maxSpeed = response.maxSpeed || 0;
        this.totalHarshEvents = (response.totalHarshBraking || 0) + (response.totalHarshCornering || 0) + (response.totalHarshAcceleration || 0);
        this.totalDurationFormatted = this.formatDuration((response.totalDurationMinutes || 0) * 60);
        this.totalIdleFormatted = this.formatDuration((response.totalIdleMinutes || 0) * 60);

        // Fuel events for the day (from TFN)
        this.fuelEvents = response.fuelEvents || [];
        this.totalFuelLitres = response.totalFuelLitres || 0;
        this.totalFuelAmount = response.totalFuelAmount || 0;

        // Live status (today) — vehicle may be mid-trip with no completed trips yet
        this.liveStatus = response.liveStatus || null;

        this.loading = false;
        this.refreshing = false;

        if (this.trips.length > 0 || this.fuelEvents.length > 0 || this.liveStatus?.isMoving) {
          setTimeout(() => this.initMap(), 100);
        }
      },
      error: (err) => {
        console.error('Failed to load movement history:', err);
        this.loading = false;
        this.refreshing = false;
      }
    });
  }

  onDateChange(newDate: string): void {
    if (!newDate) return;
    // Guard against future dates
    if (newDate > this.maxDate) newDate = this.maxDate;
    this.selectedDate = newDate;
    this.resetForReload();
    this.loadTripHistory();
  }

  changeDay(delta: number): void {
    const d = new Date(this.selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().split('T')[0];
    if (newDate > this.maxDate) return;
    this.selectedDate = newDate;
    this.resetForReload();
    this.loadTripHistory();
  }

  goToToday(): void {
    if (this.isToday) return;
    this.selectedDate = this.maxDate;
    this.resetForReload();
    this.loadTripHistory();
  }

  private resetForReload(): void {
    this.clearMapOverlays();
    this.mapInitialized = false;
    this.map = null;
    this.selectedTripIndex = -1;
    this.trips = [];
    this.fuelEvents = [];
    this.liveStatus = null;
  }

  // Force a live pull from CarTrack for the selected day and persist it to our DB.
  refreshFromCarTrack(): void {
    if (this.refreshing) return;
    this.resetForReload();
    this.loadTripHistory(true);
  }

  // Rolling fuel-theft / anomaly analysis for this vehicle.
  loadFuelAnalysis(): void {
    const vehicle = this.data.vehicle;
    const reg = vehicle?.registrationNumber;
    if (!reg) return;
    this.fuelAnalysisLoading = true;
    const url = `${this.data.apiUrl}/fleet/vehicles/${encodeURIComponent(reg)}/fuel-analysis?days=${this.fuelAnalysisDays}`;
    this.http.get<any>(url).subscribe({
      next: (res) => { this.fuelAnalysis = res; this.fuelAnalysisLoading = false; },
      error: (err) => { console.error('Fuel analysis failed:', err); this.fuelAnalysisLoading = false; }
    });
  }

  // Open the detailed Fuel Health Score dialog (90-day window with per-fill breakdown).
  openFuelHealth(): void {
    const vehicle = this.data.vehicle;
    this.dialog.open(FuelHealthDialog, {
      width: '760px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { vehicle, apiUrl: this.data.apiUrl }
    });
  }

  get riskColor(): string {
    const lvl = this.fuelAnalysis?.riskLevel;
    if (lvl === 'high') return '#d32f2f';
    if (lvl === 'watch') return '#f57c00';
    return '#388e3c';
  }

  get riskLabel(): string {
    const lvl = this.fuelAnalysis?.riskLevel;
    if (lvl === 'high') return 'High risk';
    if (lvl === 'watch') return 'Watch';
    if (lvl === 'unknown') return 'No data';
    return 'Normal';
  }

  private initMap(): void {
    if (this.mapInitialized || !this.mapElement?.nativeElement) return;

    const apiKey = 'AIzaSyCqVfKPCFqCsGEzAe3ofunRDtuNLb7aV7k';

    if (typeof google !== 'undefined' && google.maps) {
      this.createMap();
      return;
    }

    const cbName = 'initTripHistoryMap_' + Date.now();
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=${cbName}`;
    script.async = true;
    script.defer = true;
    (window as any)[cbName] = () => {
      this.createMap();
      delete (window as any)[cbName];
    };
    document.head.appendChild(script);
  }

  private createMap(): void {
    if (this.mapInitialized) return;

    this.map = new google.maps.Map(this.mapElement.nativeElement, {
      zoom: 10,
      center: { lat: -26.2041, lng: 28.0473 },
      mapTypeId: 'roadmap',
      mapTypeControl: true,
      zoomControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      scaleControl: true,
      styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }]
    } as any);

    this.infoWindow = new google.maps.InfoWindow();
    this.directionsService = new google.maps.DirectionsService();
    this.mapInitialized = true;
    this.mapLoading = false;

    this.plotAllTrips();
  }

  private plotAllTrips(): void {
    if (!this.map) return;
    this.clearMapOverlays();
    this.mapLoading = true;

    const bounds = new google.maps.LatLngBounds();
    const colors = ['#00838f', '#5c6bc0', '#43a047', '#e53935', '#ff8f00', '#8e24aa', '#00acc1', '#d81b60', '#6d4c41', '#546e7a'];

    // Collect all markers and route data first (don't add to map yet)
    const pendingMarkers: { marker: google.maps.Marker }[] = [];
    const routeRequests: { index: number; origin: any; destination: any; color: string }[] = [];

    this.trips.forEach((trip, i) => {
      const color = colors[i % colors.length];
      const startLat = trip.startLatitude;
      const startLng = trip.startLongitude;
      const endLat = trip.endLatitude;
      const endLng = trip.endLongitude;

      if (startLat && startLng) {
        const startPos = { lat: startLat, lng: startLng };
        bounds.extend(startPos);

        const startMarker = new google.maps.Marker({
          position: startPos,
          title: `Trip ${i + 1} Start`,
          label: { text: String(i + 1), color: '#fff', fontSize: '11px', fontWeight: '700' },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 14,
            fillColor: color,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2
          }
        });

        startMarker.addListener('click', () => {
          this.showStopInfo(trip, i, 'start', startMarker);
          this.selectedTripIndex = i;
        });

        pendingMarkers.push({ marker: startMarker });
      }

      if (endLat && endLng) {
        const endPos = { lat: endLat, lng: endLng };
        bounds.extend(endPos);

        const endMarker = new google.maps.Marker({
          position: endPos,
          title: `Trip ${i + 1} End`,
          icon: {
            path: 'M 0,-8 8,0 0,8 -8,0 Z',
            scale: 1.4,
            fillColor: color,
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2
          }
        });

        endMarker.addListener('click', () => {
          this.showStopInfo(trip, i, 'end', endMarker);
          this.selectedTripIndex = i;
        });

        pendingMarkers.push({ marker: endMarker });
      }

      if (startLat && startLng && endLat && endLng) {
        routeRequests.push({
          index: i,
          origin: { lat: startLat, lng: startLng },
          destination: { lat: endLat, lng: endLng },
          color: color
        });
      }
    });

    // Fetch all routes with staggered requests, then render everything at once
    const routeResults: { path: any[]; color: string; isFallback: boolean }[] = [];
    let completedCount = 0;
    const totalRoutes = routeRequests.length;

    const renderAll = () => {
      // Add all markers to map
      pendingMarkers.forEach(m => {
        m.marker.setMap(this.map);
        this.markers.push(m.marker);
      });

      // Add all route lines to map
      routeResults.forEach(r => {
        const line = new google.maps.Polyline({
          path: r.path,
          strokeColor: r.color,
          strokeOpacity: r.isFallback ? 0.5 : 0.8,
          strokeWeight: r.isFallback ? 3 : 4,
          map: this.map
        });
        this.polylines.push(line);
      });

      // Add fuel-station markers (placed at the vehicle's location at fill time)
      this.plotFuelMarkers(bounds);

      // Add a live marker if the vehicle is currently on the move
      this.plotLiveMarker(bounds);

      if (pendingMarkers.length > 0) {
        this.map!.fitBounds(bounds, 60);
      }
      this.mapLoading = false;
    };

    if (totalRoutes === 0) {
      renderAll();
      return;
    }

    // Stagger requests at 150ms intervals to avoid rate limiting
    routeRequests.forEach((req, idx) => {
      setTimeout(() => {
        if (!this.directionsService) {
          routeResults.push({ path: [req.origin, req.destination], color: req.color, isFallback: true });
          completedCount++;
          if (completedCount >= totalRoutes) renderAll();
          return;
        }

        this.directionsService.route(
          { origin: req.origin, destination: req.destination, travelMode: google.maps.TravelMode.DRIVING },
          (result: any, status: any) => {
            if (status === google.maps.DirectionsStatus.OK && result) {
              routeResults.push({ path: result.routes[0].overview_path, color: req.color, isFallback: false });
            } else {
              // Fallback to straight line
              routeResults.push({ path: [req.origin, req.destination], color: req.color, isFallback: true });
            }
            completedCount++;
            if (completedCount >= totalRoutes) renderAll();
          }
        );
      }, idx * 150);
    });
  }

  // Estimate the vehicle's lat/lng at a given time by interpolating the trip that
  // was active then (or snapping to the nearest trip endpoint by time).
  private estimateLocationAt(timeMs: number): { lat: number; lng: number } | null {
    if (!this.trips || this.trips.length === 0) return null;

    let best: { lat: number; lng: number } | null = null;
    let bestGap = Number.POSITIVE_INFINITY;

    for (const t of this.trips) {
      const s = Date.parse(t.startTimestamp);
      const e = Date.parse(t.endTimestamp);
      if (isNaN(s) || isNaN(e)) continue;

      if (timeMs >= s && timeMs <= e && e > s && t.startLatitude && t.endLatitude) {
        const f = (timeMs - s) / (e - s);
        return {
          lat: t.startLatitude + (t.endLatitude - t.startLatitude) * f,
          lng: t.startLongitude + (t.endLongitude - t.startLongitude) * f
        };
      }

      const gapS = Math.abs(timeMs - s);
      const gapE = Math.abs(timeMs - e);
      if (gapS < bestGap && t.startLatitude) { bestGap = gapS; best = { lat: t.startLatitude, lng: t.startLongitude }; }
      if (gapE < bestGap && t.endLatitude) { bestGap = gapE; best = { lat: t.endLatitude, lng: t.endLongitude }; }
    }
    return best;
  }

  // Drop a fuel-pump marker for each refuelling event at the vehicle's estimated
  // location at fill time, with litres/amount/time in the info window.
  private plotFuelMarkers(bounds: google.maps.LatLngBounds): void {
    if (!this.map || !this.fuelEvents || this.fuelEvents.length === 0) return;

    this.fuelEvents.forEach((fuel) => {
      const t = Date.parse(fuel.timestamp);
      const pos = isNaN(t) ? null : this.estimateLocationAt(t);
      if (!pos) return;

      bounds.extend(pos);

      const marker = new google.maps.Marker({
        position: pos,
        title: `Fuel: ${Number(fuel.litres).toFixed(0)}L`,
        zIndex: 999,
        icon: {
          path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
          fillColor: '#2e7d32',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
          scale: 1.6,
          anchor: new google.maps.Point(12, 22),
          labelOrigin: new google.maps.Point(12, 9)
        } as any,
        label: { text: '\u26FD', color: '#fff', fontSize: '12px' }
      });

      marker.addListener('click', () => {
        if (!this.infoWindow || !this.map) return;
        const content = `
          <div style="padding:12px;min-width:200px;">
            <h3 style="margin:0 0 6px;font-size:15px;color:#2e7d32;">\u26FD Refuelling</h3>
            <p style="margin:4px 0;font-size:13px;"><strong>${fuel.depotName || fuel.depotAssignment || 'Fuel station'}</strong></p>
            <p style="margin:4px 0;font-size:12px;color:#666;"><strong>Time:</strong> ${this.formatTime(fuel.timestamp)}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:8px 0;">
            <p style="margin:4px 0;font-size:12px;"><strong>Litres:</strong> ${Number(fuel.litres).toFixed(1)} L</p>
            <p style="margin:4px 0;font-size:12px;"><strong>Amount:</strong> R${Number(fuel.amount).toFixed(2)}</p>
          </div>`;
        this.infoWindow.setContent(content);
        this.infoWindow.open(this.map, marker);
      });

      marker.setMap(this.map);
      this.markers.push(marker);
    });
  }

  // Drops a pulsing "live" marker at the vehicle's current CarTrack position when it
  // is on the move now. Complements completed trips already drawn on the map.
  private plotLiveMarker(bounds: google.maps.LatLngBounds): void {
    if (!this.map || !this.liveStatus || !this.liveStatus.isMoving) return;
    const lat = Number(this.liveStatus.latitude);
    const lng = Number(this.liveStatus.longitude);
    if (!lat || !lng) return;

    const pos = { lat, lng };
    bounds.extend(pos);

    const marker = new google.maps.Marker({
      position: pos,
      title: `Live: ${Number(this.liveStatus.speed).toFixed(0)} km/h`,
      zIndex: 1000,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#e53935',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 3,
        scale: 8
      } as any
    });

    marker.addListener('click', () => {
      if (!this.infoWindow || !this.map) return;
      const content = `
        <div style="padding:12px;min-width:200px;">
          <h3 style="margin:0 0 6px;font-size:15px;color:#e53935;">\u25CF Live position</h3>
          <p style="margin:4px 0;font-size:13px;"><strong>${this.liveStatus.address || 'On the move'}</strong></p>
          <p style="margin:4px 0;font-size:12px;"><strong>Speed:</strong> ${Number(this.liveStatus.speed).toFixed(0)} km/h</p>
          ${this.liveStatus.driverName ? `<p style="margin:4px 0;font-size:12px;"><strong>Driver:</strong> ${this.liveStatus.driverName}</p>` : ''}
          ${this.liveStatus.lastUpdate ? `<p style="margin:4px 0;font-size:12px;color:#666;"><strong>Updated:</strong> ${this.formatTime(this.liveStatus.lastUpdate)}</p>` : ''}
        </div>`;
      this.infoWindow.setContent(content);
      this.infoWindow.open(this.map, marker);
    });

    marker.setMap(this.map);
    this.markers.push(marker);
  }

  private showStopInfo(trip: any, index: number, type: 'start' | 'end', marker: google.maps.Marker): void {
    if (!this.infoWindow || !this.map) return;

    const loc = type === 'start'
      ? (trip.startGeofence || trip.startLocation || 'Unknown')
      : (trip.endGeofence || trip.endLocation || 'Unknown');
    const time = this.formatTime(type === 'start' ? trip.startTimestamp : trip.endTimestamp);
    const distKm = (trip.tripDistance / 1000).toFixed(1);
    const dur = trip.tripDuration || this.formatDuration(trip.tripDurationSeconds);
    const harsh = trip.harshBrakingEvents + trip.harshCorneringEvents + trip.harshAccelerationEvents;
    const harshHtml = harsh > 0
      ? `<p style="margin:4px 0;font-size:12px;color:#ff8f00;"><strong>⚠ ${harsh} harsh events</strong></p>`
      : '';

    const content = `
      <div style="padding:12px;min-width:220px;max-width:300px;">
        <h3 style="margin:0 0 6px;font-size:15px;color:#00838f;">
          Trip ${index + 1} — ${type === 'start' ? 'Start' : 'End'}
        </h3>
        <p style="margin:4px 0;font-size:13px;"><strong>📍 ${loc}</strong></p>
        <p style="margin:4px 0;font-size:12px;color:#666;"><strong>Time:</strong> ${time}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:8px 0;">
        <p style="margin:4px 0;font-size:12px;"><strong>Distance:</strong> ${distKm} km</p>
        <p style="margin:4px 0;font-size:12px;"><strong>Duration:</strong> ${dur}</p>
        <p style="margin:4px 0;font-size:12px;"><strong>Max Speed:</strong> <span style="color:${trip.maxSpeed > 120 ? '#e53935' : '#333'};">${Math.round(trip.maxSpeed)} km/h</span></p>
        ${harshHtml}
      </div>
    `;

    this.infoWindow.setContent(content);
    this.infoWindow.open(this.map, marker);
  }

  selectTrip(index: number): void {
    this.selectedTripIndex = index;
    const trip = this.trips[index];
    if (!this.map) return;

    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;

    if (trip.startLatitude && trip.startLongitude) {
      bounds.extend({ lat: trip.startLatitude, lng: trip.startLongitude });
      hasBounds = true;
    }
    if (trip.endLatitude && trip.endLongitude) {
      bounds.extend({ lat: trip.endLatitude, lng: trip.endLongitude });
      hasBounds = true;
    }

    if (hasBounds) {
      this.map.fitBounds(bounds, 80);
      // Open info on the start marker
      const startMarker = this.markers[index * 2];
      if (startMarker) {
        this.showStopInfo(trip, index, 'start', startMarker);
      }
    }
  }

  exportToExcel(): void {
    const vehicle = this.data.vehicle;
    const today = this.selectedDate;

    // Build CSV content
    const headers = ['Trip #', 'Start Time', 'End Time', 'Duration', 'From', 'To', 'Distance (km)', 'Max Speed (km/h)', 'Harsh Braking', 'Harsh Cornering', 'Harsh Acceleration', 'Idle Time (min)'];
    const rows = this.trips.map((trip, i) => [
      i + 1,
      trip.startTimestamp || '',
      trip.endTimestamp || '',
      trip.tripDuration || this.formatDuration(trip.tripDurationSeconds),
      (trip.startGeofence || trip.startLocation || 'Unknown').replace(/,/g, ';'),
      (trip.endGeofence || trip.endLocation || 'Unknown').replace(/,/g, ';'),
      (trip.tripDistance / 1000).toFixed(1),
      Math.round(trip.maxSpeed),
      trip.harshBrakingEvents,
      trip.harshCorneringEvents,
      trip.harshAccelerationEvents,
      Math.round(trip.idleTimeSeconds / 60)
    ]);

    // Fuel events
    if (this.fuelEvents.length > 0) {
      rows.push([]);
      rows.push(['Refuelling']);
      rows.push(['Time', 'Location', 'Litres', 'Amount (R)']);
      this.fuelEvents.forEach(f => {
        rows.push([
          f.timestamp || '',
          (f.depotName || f.depotAssignment || 'Fuel station').replace(/,/g, ';'),
          Number(f.litres).toFixed(1),
          Number(f.amount).toFixed(2)
        ]);
      });
    }

    // Summary row
    rows.push([]);
    rows.push(['Summary']);
    rows.push(['Total Distance (km)', this.totalDistanceKm]);
    rows.push(['Total Trips', this.trips.length]);
    rows.push(['Max Speed (km/h)', this.maxSpeed]);
    rows.push(['Total Harsh Events', this.totalHarshEvents]);
    rows.push(['Total Fuel (L)', this.totalFuelLitres]);
    rows.push(['Total Fuel Cost (R)', this.totalFuelAmount]);
    rows.push(['Vehicle', vehicle.registrationNumber]);
    rows.push(['Driver', vehicle.currentDriver || vehicle.currentDriverName || 'N/A']);
    rows.push(['Date', today]);

    const allRows = [headers, ...rows];
    const csvContent = allRows.map(r => (r as any[]).map(cell => {
      const s = cell === null || cell === undefined ? '' : String(cell);
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',')).join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Movement_History_${vehicle.registrationNumber}_${today}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // Prompt for a start/end date and export a daily km breakdown for that range.
  exportDateRange(): void {
    const today = this.selectedDate || this.maxDate;
    const monthStart = today.substring(0, 8) + '01';
    const from = window.prompt('Export FROM date (yyyy-MM-dd):', monthStart);
    if (!from) return;
    const to = window.prompt('Export TO date (yyyy-MM-dd):', today);
    if (!to) return;
    this.fetchKmSummaryAndExport(from, to, `Range_${from}_to_${to}`);
  }

  // Export this month's daily kms plus a worked-out monthly average.
  exportMonthlyKm(): void {
    const today = this.selectedDate || this.maxDate;
    const monthStart = today.substring(0, 8) + '01';
    this.fetchKmSummaryAndExport(monthStart, today, `KmAverage_${today.substring(0, 7)}`);
  }

  private fetchKmSummaryAndExport(from: string, to: string, suffix: string): void {
    const vehicle = this.data.vehicle;
    const reg = vehicle.registrationNumber;
    const url = `${this.data.apiUrl}/fleet/vehicles/${encodeURIComponent(reg)}/km-summary?from=${from}&to=${to}`;
    this.http.get<any>(url).subscribe({
      next: (res) => {
        const rows: any[] = [];
        rows.push(['Vehicle', reg]);
        rows.push(['Driver', vehicle.currentDriver || vehicle.currentDriverName || 'N/A']);
        rows.push(['Period', `${res.from} to ${res.to}`]);
        rows.push([]);
        rows.push(['Date', 'Day', 'Distance (km)', 'Trips', 'Max Speed (km/h)']);
        (res.days || []).forEach((d: any) => {
          rows.push([d.date, d.dayOfWeek, d.km, d.trips, d.maxSpeed]);
        });
        rows.push([]);
        rows.push(['Summary']);
        rows.push(['Total distance (km)', res.totalKm]);
        rows.push(['Calendar days in period', res.calendarDays]);
        rows.push(['Days with movement', res.daysWithMovement]);
        rows.push(['Average km / calendar day (month so far)', res.avgKmPerCalendarDay]);
        rows.push(['Average km / active day', res.avgKmPerActiveDay]);

        const csvContent = rows.map(r => (r as any[]).map(cell => {
          const s = cell === null || cell === undefined ? '' : String(cell);
          return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',')).join('\r\n');
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Vehicle_${reg}_${suffix}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      },
      error: (err) => {
        console.error('Failed to build km summary:', err);
        window.alert('Could not build the km summary. Please try again.');
      }
    });
  }

  formatTime(timestamp: string): string {
    if (!timestamp) return '—';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      const parts = timestamp.split(' ');
      return parts.length > 1 ? parts[1].substring(0, 5) : timestamp;
    }
  }

  formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  }

  close(): void {
    this.dialogRef.close();
  }
}

// ==========================================
// Fuel Health Score Dialog — per-fill irregularity analysis
// ==========================================
@Component({
  selector: 'app-fuel-health-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="fh-dialog">
      <div class="fh-header">
        <div class="fh-title">
          <mat-icon>local_gas_station</mat-icon>
          <div>
            <h2>Fuel Health Score</h2>
            <span class="fh-sub">{{ data.vehicle?.registrationNumber }}<span *ngIf="data.vehicle?.make"> · {{ data.vehicle.make }} {{ data.vehicle.model }}</span></span>
          </div>
        </div>
        <div class="fh-controls">
          <select [(ngModel)]="days" (ngModelChange)="load()" class="fh-range">
            <option [ngValue]="30">Last 30 days</option>
            <option [ngValue]="60">Last 60 days</option>
            <option [ngValue]="90">Last 90 days</option>
            <option [ngValue]="180">Last 6 months</option>
          </select>
          <button mat-icon-button (click)="close()"><mat-icon>close</mat-icon></button>
        </div>
      </div>

      @if (loading) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
        <div class="fh-center"><mat-spinner diameter="40"></mat-spinner><p>Analysing fuel history…</p></div>
      } @else if (!result) {
        <div class="fh-center"><mat-icon>error_outline</mat-icon><p>Could not load fuel analysis.</p></div>
      } @else {
        <div class="fh-body">
          <!-- Score gauge -->
          <div class="fh-score-card" [style.borderColor]="scoreColor">
            <div class="fh-gauge" [style.background]="gaugeGradient">
              <div class="fh-gauge-inner">
                <span class="fh-score" [style.color]="scoreColor">{{ result.riskScore }}</span>
                <span class="fh-score-max">/100</span>
              </div>
            </div>
            <div class="fh-score-label">
              <span class="fh-badge" [style.background]="scoreColor">{{ riskLabel }}</span>
              <p class="fh-score-desc">{{ scoreDescription }}</p>
            </div>
          </div>

          <!-- Key stats -->
          <div class="fh-stats">
            <div class="fh-stat">
              <span class="fh-stat-val">{{ result.totalDistanceKm | number:'1.0-0' }}</span>
              <span class="fh-stat-lbl">km driven</span>
            </div>
            <div class="fh-stat">
              <span class="fh-stat-val">{{ result.totalLitres | number:'1.0-0' }} L</span>
              <span class="fh-stat-lbl">fuel drawn</span>
            </div>
            <div class="fh-stat">
              <span class="fh-stat-val">{{ result.actualKmPerLitre ? (result.actualKmPerLitre | number:'1.1-1') : '—' }}</span>
              <span class="fh-stat-lbl">actual km/L</span>
            </div>
            <div class="fh-stat">
              <span class="fh-stat-val">{{ result.baselineKmPerLitre ? (result.baselineKmPerLitre | number:'1.1-1') : '—' }}</span>
              <span class="fh-stat-lbl">baseline km/L<span *ngIf="result.baselineSource==='self-learned'"> (learned)</span></span>
            </div>
            <div class="fh-stat">
              <span class="fh-stat-val">{{ result.tankSizeLitres ? (result.tankSizeLitres | number:'1.0-0') + ' L' : '—' }}</span>
              <span class="fh-stat-lbl">tank size</span>
            </div>
            <div class="fh-stat">
              <span class="fh-stat-val">{{ result.fillCount }}</span>
              <span class="fh-stat-lbl">fill-ups</span>
            </div>
          </div>

          <!-- Findings -->
          @if (result.findings?.length) {
            <div class="fh-section">
              <h3><mat-icon>warning_amber</mat-icon> Irregularities found</h3>
              <ul class="fh-findings">
                @for (f of result.findings; track $index) {
                  <li [class.high]="f.severity === 'high'">
                    <mat-icon>{{ f.severity === 'high' ? 'priority_high' : 'info' }}</mat-icon>
                    {{ f.message }}
                  </li>
                }
              </ul>
            </div>
          } @else {
            <div class="fh-ok"><mat-icon>check_circle</mat-icon> No irregularities detected in this period.</div>
          }

          <!-- Notes (data quality) -->
          @if (result.notes?.length) {
            <div class="fh-notes">
              @for (n of result.notes; track $index) { <div><mat-icon>info</mat-icon> {{ n }}</div> }
            </div>
          }

          <!-- Per-fill breakdown -->
          <div class="fh-section">
            <h3><mat-icon>format_list_bulleted</mat-icon> Fill-up history &amp; distance between fills</h3>
            @if (result.fills?.length) {
              <div class="fh-table-wrap">
                <table class="fh-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Depot</th>
                      <th class="num">Litres</th>
                      <th class="num">Amount</th>
                      <th class="num">km since last</th>
                      <th class="num">Expected L</th>
                      <th class="num">% of tank</th>
                      <th>Flag</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (fill of result.fills; track $index) {
                      <tr [class.flagged]="fill.flag" [class.flagged-high]="fill.severity === 'high'">
                        <td>{{ fill.date | date:'d MMM yyyy' }}</td>
                        <td>{{ fill.depotName || '—' }}</td>
                        <td class="num">{{ fill.litres | number:'1.0-1' }}</td>
                        <td class="num">R{{ fill.amount | number:'1.0-0' }}</td>
                        <td class="num" [class.muted]="!fill.hasMovementData && $index > 0">
                          {{ fill.kmSinceLastFill != null ? (fill.kmSinceLastFill | number:'1.0-0') : ($index === 0 ? '—' : 'no data') }}
                        </td>
                        <td class="num">{{ fill.expectedLitresForLeg != null ? (fill.expectedLitresForLeg | number:'1.0-1') : '—' }}</td>
                        <td class="num" [class.over]="fill.fillVsTankPercent > 100">{{ fill.fillVsTankPercent != null ? fill.fillVsTankPercent + '%' : '—' }}</td>
                        <td class="flag-cell">
                          <span *ngIf="fill.flag" class="flag-pill" [class.high]="fill.severity === 'high'"><mat-icon>error</mat-icon> {{ fill.flag }}</span>
                          <span *ngIf="!fill.flag && $index > 0 && fill.hasMovementData" class="ok-tick">✓</span>
                          <span *ngIf="!fill.flag && (!fill.hasMovementData && $index > 0)" class="muted">—</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="fh-empty">No fill-ups recorded in this period.</p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .fh-dialog { display: flex; flex-direction: column; background: #fff; }
    .fh-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 20px; background: linear-gradient(135deg, #e65100 0%, #ef6c00 100%); color: #fff;
    }
    .fh-title { display: flex; align-items: center; gap: 12px; }
    .fh-title mat-icon { font-size: 30px; width: 30px; height: 30px; }
    .fh-title h2 { margin: 0; font-size: 18px; }
    .fh-sub { font-size: 12.5px; opacity: 0.9; }
    .fh-controls { display: flex; align-items: center; gap: 6px; }
    .fh-range { border: none; border-radius: 6px; padding: 6px 8px; font-size: 12.5px; }
    .fh-center { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px; color: #777; }
    .fh-center mat-icon { font-size: 40px; width: 40px; height: 40px; }
    .fh-body { padding: 20px; overflow-y: auto; }

    .fh-score-card {
      display: flex; align-items: center; gap: 20px; padding: 16px; border: 2px solid #ccc;
      border-radius: 12px; margin-bottom: 16px;
    }
    .fh-gauge {
      width: 96px; height: 96px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .fh-gauge-inner {
      width: 78px; height: 78px; border-radius: 50%; background: #fff; display: flex; align-items: baseline; justify-content: center; gap: 1px;
    }
    .fh-score { font-size: 30px; font-weight: 800; line-height: 1; }
    .fh-score-max { font-size: 13px; color: #999; }
    .fh-badge { color: #fff; padding: 3px 12px; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .fh-score-desc { margin: 8px 0 0; font-size: 13px; color: #555; }

    .fh-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 18px; }
    .fh-stat { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 10px 12px; text-align: center; }
    .fh-stat-val { display: block; font-size: 18px; font-weight: 700; color: #1a1a2e; }
    .fh-stat-lbl { font-size: 11.5px; color: #888; }

    .fh-section { margin-bottom: 18px; }
    .fh-section h3 { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #333; margin: 0 0 8px; }
    .fh-section h3 mat-icon { font-size: 18px; width: 18px; height: 18px; color: #ef6c00; }
    .fh-findings { list-style: none; margin: 0; padding: 0; }
    .fh-findings li { display: flex; align-items: flex-start; gap: 6px; font-size: 13px; color: #555; padding: 5px 0; }
    .fh-findings li.high { color: #c62828; font-weight: 600; }
    .fh-findings li mat-icon { font-size: 17px; width: 17px; height: 17px; color: #999; margin-top: 1px; }
    .fh-findings li.high mat-icon { color: #d32f2f; }
    .fh-ok { display: flex; align-items: center; gap: 8px; color: #2e7d32; font-size: 13.5px; background: #e8f5e9; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; }
    .fh-notes { background: #fff8e1; border: 1px solid #ffe082; border-radius: 8px; padding: 8px 12px; margin-bottom: 16px; }
    .fh-notes div { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #8d6e00; padding: 2px 0; }
    .fh-notes mat-icon { font-size: 15px; width: 15px; height: 15px; }

    .fh-table-wrap { overflow-x: auto; border: 1px solid #eee; border-radius: 8px; }
    .fh-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .fh-table th, .fh-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #f0f0f0; white-space: nowrap; }
    .fh-table th { background: #fafafa; font-weight: 600; color: #666; }
    .fh-table td.num, .fh-table th.num { text-align: right; }
    .fh-table td.over { color: #c62828; font-weight: 700; }
    .fh-table td.muted, .fh-table .muted { color: #bbb; font-style: italic; }
    .fh-table tr.flagged { background: #fff5f5; }
    .fh-table tr.flagged-high { background: #ffebee; }
    .flag-pill { display: inline-flex; align-items: center; gap: 4px; background: #fff3e0; color: #e65100; padding: 2px 8px; border-radius: 10px; font-size: 11.5px; font-weight: 600; }
    .flag-pill.high { background: #ffebee; color: #c62828; }
    .flag-pill mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .ok-tick { color: #2e7d32; font-weight: 700; }
    .fh-empty { color: #999; font-size: 13px; }
  `]
})
export class FuelHealthDialog {
  days = 90;
  loading = true;
  result: any = null;

  private http = inject(HttpClient);

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<FuelHealthDialog>
  ) {
    this.load();
  }

  load(): void {
    const reg = this.data.vehicle?.registrationNumber;
    if (!reg) { this.loading = false; return; }
    this.loading = true;
    const url = `${this.data.apiUrl}/fleet/vehicles/${encodeURIComponent(reg)}/fuel-analysis?days=${this.days}`;
    this.http.get<any>(url).subscribe({
      next: (res) => { this.result = res; this.loading = false; },
      error: (err) => { console.error('Fuel health load failed:', err); this.loading = false; }
    });
  }

  get scoreColor(): string {
    const lvl = this.result?.riskLevel;
    if (lvl === 'high') return '#d32f2f';
    if (lvl === 'watch') return '#f57c00';
    if (lvl === 'unknown') return '#9e9e9e';
    return '#388e3c';
  }

  get gaugeGradient(): string {
    const score = this.result?.riskScore || 0;
    const c = this.scoreColor;
    const deg = Math.round((score / 100) * 360);
    return `conic-gradient(${c} ${deg}deg, #eeeeee ${deg}deg)`;
  }

  get riskLabel(): string {
    const lvl = this.result?.riskLevel;
    if (lvl === 'high') return 'High risk';
    if (lvl === 'watch') return 'Watch';
    if (lvl === 'unknown') return 'No data';
    return 'Healthy';
  }

  get scoreDescription(): string {
    const lvl = this.result?.riskLevel;
    if (lvl === 'high') return 'Strong signs of fuel loss or a vehicle problem. Investigate the flagged fill-ups below.';
    if (lvl === 'watch') return 'Some irregularities worth keeping an eye on.';
    if (lvl === 'unknown') return 'Not enough data (tank size / expected economy) to score this vehicle.';
    return 'Fuel usage lines up with distance travelled and tank capacity.';
  }

  close(): void { this.dialogRef.close(); }
}

/**
 * Quick barcode lookup pop-up — shows the tripsheet(s), stock item, invoices,
 * asset and recent scans linked to a scanned/typed barcode number.
 */
@Component({
  selector: 'app-barcode-lookup-dialog',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatDialogModule, MatButtonModule],
  template: `
  <div class="bl">
    <div class="bl__head">
      <mat-icon>qr_code_scanner</mat-icon>
      <div class="bl__title">
        <h2>Barcode lookup</h2>
        <span class="bl__code">{{ data.code }}</span>
      </div>
      <button class="bl__x" (click)="close()"><mat-icon>close</mat-icon></button>
    </div>

    <div class="bl__body">
      @if (!data.found) {
        <div class="bl__empty">
          <mat-icon>help_outline</mat-icon>
          <p>{{ data.message || 'This barcode is not linked to anything yet.' }}</p>
        </div>
      }

      @if (data.tag) {
        <div class="bl__block">
          <div class="bl__bt"><mat-icon>sell</mat-icon> Tag</div>
          <div class="bl__kv"><span>Type</span><b>{{ data.tag.tagType }}</b></div>
          @if (data.tag.label) { <div class="bl__kv"><span>Label</span><b>{{ data.tag.label }}</b></div> }
          <div class="bl__kv"><span>Status</span><b>{{ data.tag.status }}</b></div>
        </div>
      }

      @if (data.tripSheets?.length) {
        <div class="bl__block">
          <div class="bl__bt"><mat-icon>local_shipping</mat-icon> Active loads / tripsheets ({{ data.tripSheets.length }})</div>
          @for (l of data.tripSheets; track l.id) {
            <div class="bl__row" (click)="openLoad(l.id)">
              <div>
                <b>{{ l.loadNumber }}</b>
                <div class="bl__sub">{{ l.customerName || 'No customer' }}@if (l.driver) { · {{ l.driver }} }@if (l.vehicle) { · {{ l.vehicle }} }</div>
              </div>
              <span class="bl__chip">{{ l.status }}</span>
            </div>
          }
        </div>
      }

      @if (data.inventory?.length) {
        <div class="bl__block">
          <div class="bl__bt"><mat-icon>inventory_2</mat-icon> Live stock</div>
          @for (b of data.inventory; track b.id) {
            <div class="bl__row">
              <div><b>{{ b.itemCode }}</b><div class="bl__sub">{{ b.itemDescription || 'No description' }} · {{ b.uom }}</div></div>
              <div class="bl__qty"><b>{{ b.quantityOnHand }}</b><span>on hand</span></div>
            </div>
          }
        </div>
      }

      @if (data.invoices?.length) {
        <div class="bl__block">
          <div class="bl__bt"><mat-icon>receipt_long</mat-icon> Invoices ({{ data.invoices.length }})</div>
          @for (i of data.invoices; track i.id) {
            <div class="bl__row">
              <div><b>{{ i.transactionNumber }}</b><div class="bl__sub">{{ i.customerName }} · {{ i.productDescription }} · Qty {{ i.quantity }}</div></div>
              <span class="bl__chip">{{ i.status }}</span>
            </div>
          }
        </div>
      }

      @if (data.asset) {
        <div class="bl__block">
          <div class="bl__bt"><mat-icon>chair</mat-icon> Fixed asset</div>
          <div class="bl__kv"><span>Code</span><b>{{ data.asset.assetCode || '—' }}</b></div>
          <div class="bl__kv"><span>Category</span><b>{{ data.asset.category }}</b></div>
          @if (data.asset.assignedTo) { <div class="bl__kv"><span>Assigned to</span><b>{{ data.asset.assignedTo }}</b></div> }
        </div>
      }

      @if (data.recentScans?.length) {
        <div class="bl__block">
          <div class="bl__bt"><mat-icon>history</mat-icon> Recent scans</div>
          @for (s of data.recentScans; track s.id) {
            <div class="bl__scan"><mat-icon>bolt</mat-icon><div><b>{{ s.action }}</b> — {{ s.scannedByName || 'Unknown' }}<div class="bl__sub">{{ s.scannedAt | date:'d MMM, HH:mm' }}</div></div></div>
          }
        </div>
      }
    </div>

    <div class="bl__foot">
      <button mat-stroked-button (click)="openScanPage()"><mat-icon>open_in_new</mat-icon> Full Scan &amp; Track</button>
      <button mat-flat-button color="primary" (click)="close()">Close</button>
    </div>
  </div>
  `,
  styles: [`
    .bl { display:flex; flex-direction:column; max-height:82vh; }
    .bl__head { display:flex; align-items:center; gap:12px; padding:18px 20px; background:linear-gradient(135deg,#4f46e5,#6366f1); color:#fff; }
    .bl__head > mat-icon { font-size:30px; width:30px; height:30px; }
    .bl__title h2 { margin:0; font-size:1.1rem; }
    .bl__code { font-family:monospace; font-size:0.8rem; opacity:0.9; }
    .bl__x { margin-left:auto; background:rgba(255,255,255,0.15); border:none; color:#fff; width:34px; height:34px; border-radius:10px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
    .bl__body { padding:16px 20px; overflow:auto; display:flex; flex-direction:column; gap:14px; }
    .bl__empty { text-align:center; color:#94a3b8; padding:24px; }
    .bl__empty mat-icon { font-size:44px; width:44px; height:44px; }
    .bl__block { border:1px solid #e2e8f0; border-radius:12px; padding:12px; }
    .bl__bt { display:flex; align-items:center; gap:6px; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.5px; color:#64748b; font-weight:700; margin-bottom:8px; }
    .bl__bt mat-icon { font-size:16px; width:16px; height:16px; color:#4f46e5; }
    .bl__kv { display:flex; justify-content:space-between; font-size:0.84rem; padding:3px 0; }
    .bl__kv span { color:#64748b; }
    .bl__row { display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-top:1px dashed #e2e8f0; }
    .bl__row:first-of-type { border-top:none; }
    .bl__sub { font-size:0.74rem; color:#64748b; margin-top:2px; }
    .bl__qty { text-align:right; } .bl__qty b { font-size:1.05rem; } .bl__qty span { display:block; font-size:0.66rem; color:#64748b; }
    .bl__chip { font-size:0.68rem; font-weight:700; padding:3px 9px; border-radius:999px; background:#eef0f6; color:#475569; text-transform:capitalize; }
    .bl__scan { display:flex; gap:8px; align-items:center; padding:5px 0; font-size:0.82rem; }
    .bl__scan mat-icon { font-size:17px; width:17px; height:17px; color:#4f46e5; }
    .bl__foot { display:flex; justify-content:flex-end; gap:8px; padding:14px 20px; border-top:1px solid #e2e8f0; }
  `]
})
export class BarcodeLookupDialog {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ResolveResult,
    private dialogRef: MatDialogRef<BarcodeLookupDialog>,
    private router: Router
  ) {}

  openLoad(loadId: number): void {
    this.dialogRef.close();
    this.router.navigate(['/logistics'], { queryParams: { loadId } });
  }

  openScanPage(): void {
    this.dialogRef.close();
    this.router.navigate(['/logistics/scan']);
  }

  close(): void { this.dialogRef.close(); }
}

// ================================
// Tripsheet Email Recipients Dialog
// ================================
@Component({
  selector: 'app-tripsheet-email-recipients-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatCheckboxModule,
    MatTooltipModule,
    FormsModule
  ],
  template: `
    <div class="email-recipients-dialog">
      <div class="dialog-header">
        <h2><mat-icon>outgoing_mail</mat-icon> Email Trip Sheet</h2>
        <button mat-icon-button mat-dialog-close><mat-icon>close</mat-icon></button>
      </div>

      <mat-dialog-content>
        <p class="hint-text">
          The trip sheet PDF{{ data.loadNumber ? ' for ' + data.loadNumber : '' }} will be attached.
          Add one or more recipient email addresses:
        </p>

        <div class="email-input-row">
          <mat-form-field appearance="outline" class="email-field">
            <mat-label>Recipient Email</mat-label>
            <input matInput
                   type="email"
                   [(ngModel)]="emailInput"
                   (keydown.enter)="addEmail(); $event.preventDefault()"
                   placeholder="name@company.co.za">
            <mat-icon matSuffix>alternate_email</mat-icon>
            @if (inputError) {
              <mat-hint class="error-hint">{{ inputError }}</mat-hint>
            }
          </mat-form-field>
          <button mat-mini-fab color="primary" (click)="addEmail()" matTooltip="Add recipient" [disabled]="!emailInput.trim()">
            <mat-icon>add</mat-icon>
          </button>
        </div>

        @if (emails.length > 0) {
          <div class="chips-area">
            @for (email of emails; track email) {
              <span class="email-chip">
                <mat-icon>person</mat-icon>
                {{ email }}
                <button class="remove-chip" (click)="removeEmail(email)" title="Remove">
                  <mat-icon>cancel</mat-icon>
                </button>
              </span>
            }
          </div>
        } @else {
          <div class="no-emails">
            <mat-icon>contact_mail</mat-icon>
            <span>No recipients added yet</span>
          </div>
        }

        <mat-checkbox [(ngModel)]="ccSelf" color="primary" class="cc-checkbox">
          CC me ({{ data.userEmail || 'my account email' }}) so I receive a copy
        </mat-checkbox>

        <mat-checkbox [(ngModel)]="attachPickingSlip" color="primary" class="cc-checkbox">
          Also attach a <strong>Picking Slip</strong> PDF for the warehouse team
        </mat-checkbox>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-raised-button color="primary" (click)="send()" [disabled]="emails.length === 0">
          <mat-icon>send</mat-icon>
          Send to {{ emails.length }} recipient{{ emails.length === 1 ? '' : 's' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .email-recipients-dialog { min-width: 480px; }
    .dialog-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 24px; margin: -24px -24px 0 -24px;
      background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white;
    }
    .dialog-header h2 { margin: 0; display: flex; align-items: center; gap: 10px; font-size: 18px; }
    .dialog-header button { color: white; }
    mat-dialog-content { padding-top: 20px !important; }
    .hint-text { color: #666; font-size: 13px; margin: 0 0 12px; }
    .email-input-row { display: flex; align-items: center; gap: 12px; }
    .email-field { flex: 1; }
    .error-hint { color: #d32f2f; }
    .chips-area { display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 16px; }
    .email-chip {
      display: inline-flex; align-items: center; gap: 6px;
      background: #e3f2fd; color: #1565c0; border-radius: 16px;
      padding: 5px 6px 5px 12px; font-size: 13px; font-weight: 500;
    }
    .email-chip mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .remove-chip {
      background: none; border: none; cursor: pointer; padding: 0;
      display: flex; align-items: center; color: #90a4ae;
    }
    .remove-chip:hover { color: #d32f2f; }
    .remove-chip mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .no-emails {
      display: flex; align-items: center; gap: 8px; color: #999;
      padding: 12px; background: #fafafa; border-radius: 8px; margin-bottom: 16px; font-size: 13px;
    }
    .quick-add { margin-bottom: 16px; font-size: 12px; }
    .quick-add mat-icon { margin-right: 4px; }
    .cc-checkbox { display: block; margin-bottom: 8px; }
    mat-dialog-actions { padding: 12px 24px 16px; }
  `]
})
export class TripsheetEmailRecipientsDialog {
  emailInput = '';
  inputError: string | null = null;
  emails: string[] = [];
  ccSelf = true;
  attachPickingSlip = true;

  constructor(
    public dialogRef: MatDialogRef<TripsheetEmailRecipientsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { loadNumber?: string; warehouseEmail?: string; userEmail?: string }
  ) {}

  addEmail(): void {
    this.inputError = null;
    const value = this.emailInput.trim().toLowerCase();
    if (!value) return;
    // Support comma/semicolon separated paste
    const parts = value.split(/[,;\s]+/).filter(p => p);
    const invalid: string[] = [];
    for (const part of parts) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)) {
        invalid.push(part);
        continue;
      }
      if (!this.emails.includes(part)) this.emails.push(part);
    }
    if (invalid.length > 0) {
      this.inputError = `Invalid email: ${invalid.join(', ')}`;
      this.emailInput = invalid.join(', ');
    } else {
      this.emailInput = '';
    }
  }

  quickAdd(email: string): void {
    const e = email.trim().toLowerCase();
    if (e && !this.emails.includes(e)) this.emails.push(e);
  }

  removeEmail(email: string): void {
    this.emails = this.emails.filter(e => e !== email);
  }

  send(): void {
    // Include anything still typed in the input
    if (this.emailInput.trim()) this.addEmail();
    if (this.inputError || this.emails.length === 0) return;
    this.dialogRef.close({ emails: this.emails, ccSelf: this.ccSelf, attachPickingSlip: this.attachPickingSlip });
  }
}

// ============================================================
// Trip Sheet / Picking Slip Document Preview Dialog
// Renders the EXACT backend-generated document (same format as
// the printed/emailed trip sheet) inside an iframe, with a
// toggle to switch between Trip Sheet and Picking Slip views.
// ============================================================
@Component({
  selector: 'app-tripsheet-document-preview-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, MatButtonToggleModule, FormsModule],
  template: `
    <div class="ts-doc-preview">
      <div class="doc-header">
        <h2>
          <mat-icon>{{ modeIcon() }}</mat-icon>
          {{ modeLabel() }}
          @if (loadNumber) { <span class="doc-number">{{ loadNumber }}</span> }
        </h2>
        <div class="header-actions">
          <mat-button-toggle-group [value]="mode" (change)="switchMode($event.value)" class="mode-toggle">
            <mat-button-toggle value="tripsheet">
              <mat-icon>description</mat-icon> Trip Sheet
            </mat-button-toggle>
            <mat-button-toggle value="picking">
              <mat-icon>inventory_2</mat-icon> Picking Slip
            </mat-button-toggle>
            <mat-button-toggle value="invoice">
              <mat-icon>receipt_long</mat-icon> Tax Invoices
            </mat-button-toggle>
            <mat-button-toggle value="delivery-note">
              <mat-icon>receipt</mat-icon> Delivery Notes
            </mat-button-toggle>
          </mat-button-toggle-group>
          <button mat-icon-button (click)="print()" matTooltip="Print" [disabled]="loading">
            <mat-icon>print</mat-icon>
          </button>
          <button mat-icon-button (click)="downloadPdf()" matTooltip="Download PDF" [disabled]="loading">
            <mat-icon>download</mat-icon>
          </button>
          <button mat-icon-button mat-dialog-close matTooltip="Close">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      @if (loading) {
        <div class="doc-loading">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading {{ modeLabel().toLowerCase() }}...</p>
        </div>
      } @else if (error) {
        <div class="doc-error">
          <mat-icon>error_outline</mat-icon>
          <p>{{ error }}</p>
          <button mat-stroked-button color="primary" (click)="loadDocument()">Retry</button>
        </div>
      } @else {
        <iframe class="doc-frame" [srcdoc]="safeHtml" sandbox="allow-same-origin"></iframe>
      }
    </div>
  `,
  styles: [`
    .ts-doc-preview {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #525659;
    }
    .doc-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 20px; background: #1976d2; color: white; flex-shrink: 0;
      gap: 12px; flex-wrap: wrap;
    }
    .doc-header h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 16px; }
    .doc-number {
      background: rgba(255,255,255,0.2); border-radius: 12px;
      padding: 2px 12px; font-size: 13px; font-weight: 600;
    }
    .header-actions { display: flex; align-items: center; gap: 6px; }
    .header-actions button { color: white; }
    .mode-toggle {
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.35);
      border-radius: 6px; margin-right: 8px; height: 36px;
    }
    .mode-toggle ::ng-deep .mat-button-toggle { color: rgba(255,255,255,0.75); background: transparent; font-size: 12px; }
    .mode-toggle ::ng-deep .mat-button-toggle-checked { background: rgba(255,255,255,0.95); color: #1976d2; font-weight: 600; }
    .mode-toggle ::ng-deep .mat-button-toggle-label-content { line-height: 34px; padding: 0 10px; display: flex; align-items: center; gap: 4px; }
    .mode-toggle mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .doc-loading, .doc-error {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; color: #eee;
    }
    .doc-selector {
      display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
      padding: 8px 20px; background: #37474f; flex-shrink: 0;
      max-height: 96px; overflow-y: auto;
    }
    .sel-label { color: #b0bec5; font-size: 12px; font-weight: 600; margin-right: 4px; text-transform: uppercase; }
    .sel-chip {
      background: rgba(255,255,255,0.1); color: #cfd8dc;
      border: 1px solid rgba(255,255,255,0.25); border-radius: 14px;
      padding: 3px 12px; font-size: 12px; cursor: pointer; font-weight: 500;
    }
    .sel-chip:hover { background: rgba(255,255,255,0.22); }
    .sel-chip.active { background: #fff; color: #1976d2; border-color: #fff; font-weight: 700; }
    .doc-error mat-icon { font-size: 48px; width: 48px; height: 48px; color: #ef5350; }
    .doc-frame { flex: 1; width: 100%; border: none; background: white; }
  `]
})
export class TripsheetDocumentPreviewDialog implements OnInit {
  loading = true;
  error: string | null = null;
  mode: 'tripsheet' | 'picking' | 'invoice' | 'delivery-note' = 'tripsheet';
  safeHtml: SafeHtml | null = null;
  loadNumber: string | null = null;
  invoiceList: Array<{ transactionNumber: string; company: string; customerName: string; lineCount: number; total: number }> = [];
  selectedTxn: string | null = null;
  private rawHtml = '';
  private apiUrl = environment.apiUrl;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { loadId: number; loadNumber?: string; mode?: 'tripsheet' | 'picking' | 'invoice' | 'delivery-note' },
    private dialogRef: MatDialogRef<TripsheetDocumentPreviewDialog>,
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private snackBar: MatSnackBar
  ) {
    this.mode = data.mode || 'tripsheet';
    this.loadNumber = data.loadNumber || null;
  }

  modeLabel(): string {
    switch (this.mode) {
      case 'picking': return 'Picking Slip';
      case 'invoice': return 'Tax Invoices';
      case 'delivery-note': return 'Delivery Notes';
      default: return 'Trip Sheet';
    }
  }

  modeIcon(): string {
    switch (this.mode) {
      case 'picking': return 'inventory_2';
      case 'invoice': return 'receipt_long';
      case 'delivery-note': return 'receipt';
      default: return 'description';
    }
  }

  ngOnInit(): void {
    this.loadDocument();
    this.loadInvoiceList();
  }

  loadInvoiceList(): void {
    this.http.get<any[]>(`${this.apiUrl}/document-templates/for-load/${this.data.loadId}/invoices`).subscribe({
      next: (list) => this.invoiceList = list || [],
      error: () => this.invoiceList = []
    });
  }

  selectTxn(txn: string | null): void {
    if (this.selectedTxn === txn) return;
    this.selectedTxn = txn;
    this.loadDocument();
  }

  switchMode(mode: 'tripsheet' | 'picking' | 'invoice' | 'delivery-note'): void {
    if (mode === this.mode) return;
    this.mode = mode;
    this.loadDocument();
  }

  loadDocument(): void {
    this.loading = true;
    this.error = null;
    const txnParam = this.selectedTxn ? `?txn=${encodeURIComponent(this.selectedTxn)}` : '';
    let url: string;
    switch (this.mode) {
      case 'picking':
        url = `${this.apiUrl}/logistics/tripsheet/${this.data.loadId}/picking-slip/html`;
        break;
      case 'invoice':
        url = `${this.apiUrl}/document-templates/for-load/${this.data.loadId}/invoice${txnParam}`;
        break;
      case 'delivery-note':
        url = `${this.apiUrl}/document-templates/for-load/${this.data.loadId}/delivery-note${txnParam}`;
        break;
      default:
        url = `${this.apiUrl}/logistics/tripsheet/${this.data.loadId}/pdf`;
    }
    this.http.get(url, { responseType: 'text' }).subscribe({
      next: (html) => {
        this.rawHtml = html;
        this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(html);
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load document:', err);
        if ((this.mode === 'invoice' || this.mode === 'delivery-note') && err?.status === 404) {
          this.error = 'No system invoices are linked to this load — documents can only be generated for matched invoices.';
        } else {
          this.error = `Failed to load ${this.modeLabel().toLowerCase()}. Please try again.`;
        }
        this.loading = false;
      }
    });
  }

  print(): void {
    if (!this.rawHtml) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(this.rawHtml);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
  }

  downloadPdf(): void {
    let pdfUrl: string | null = null;
    let fileName = '';
    const refName = this.loadNumber || this.data.loadId;
    const txnParam = this.selectedTxn ? `&txn=${encodeURIComponent(this.selectedTxn)}` : '';
    const suffix = this.selectedTxn ? `_${this.selectedTxn}` : `_${refName}`;
    if (this.mode === 'picking') {
      pdfUrl = `${this.apiUrl}/logistics/tripsheet/${this.data.loadId}/picking-slip/pdf`;
      fileName = `PickingSlip_${refName}.pdf`;
    } else if (this.mode === 'invoice') {
      pdfUrl = `${this.apiUrl}/document-templates/for-load/${this.data.loadId}/invoice?format=pdf${txnParam}`;
      fileName = `TaxInvoice${suffix}.pdf`;
    } else if (this.mode === 'delivery-note') {
      pdfUrl = `${this.apiUrl}/document-templates/for-load/${this.data.loadId}/delivery-note?format=pdf${txnParam}`;
      fileName = `DeliveryNote${suffix}.pdf`;
    }

    if (pdfUrl) {
      this.http.get(pdfUrl, { responseType: 'blob' }).subscribe({
        next: (blob) => {
          if (blob.type.includes('pdf')) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(url);
          } else {
            // Server fell back to HTML — use print-to-PDF instead
            this.print();
          }
        },
        error: () => this.snackBar.open(`Failed to download ${this.modeLabel()} PDF`, 'Close', { duration: 4000 })
      });
    } else {
      // Trip sheet: print-to-PDF via the print flow
      this.print();
    }
  }
}

