import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Printer } from '../quick-print-dialog/quick-print-dialog.component';

@Component({
  selector: 'app-print-upload-dialog',
  standalone: true,
  imports: [
    CommonModule, 
    MatDialogModule, 
    MatIconModule, 
    MatButtonModule, 
    MatProgressBarModule,
    MatSnackBarModule
  ],
  template: `
    <div class="print-upload-dialog">
      <div class="dialog-header" [style.background]="data.printer.color">
        <h2>{{ data.printer.name }}</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div class="dialog-content">
        <div class="printer-info">
          <mat-icon>print</mat-icon>
          <div>
            <span class="printer-label">Ricoh Printer</span>
            <span class="printer-ip">IP: {{ data.printer.ip }}</span>
          </div>
          <div class="printer-status" [class]="printerStatus">
            @if (statusChecking) {
              <mat-icon class="spin">sync</mat-icon>
              <span>Checking...</span>
            } @else if (printerStatus === 'online') {
              <mat-icon>check_circle</mat-icon>
              <span>Online</span>
            } @else if (printerStatus === 'offline') {
              <mat-icon>error</mat-icon>
              <span>Offline</span>
            } @else {
              <mat-icon>help</mat-icon>
              <span>Unknown</span>
            }
          </div>
        </div>

        <div 
          class="upload-zone"
          [class.drag-over]="isDragOver"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()">
          
          <input 
            #fileInput 
            type="file" 
            hidden 
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
            (change)="onFileSelected($event)">
          
          @if (!selectedFile) {
            <mat-icon class="upload-icon">cloud_upload</mat-icon>
            <p class="upload-text">Drag & drop a file here</p>
            <p class="upload-hint">or click to browse</p>
            <p class="upload-formats">PDF, Word, Excel, PowerPoint, Images</p>
          } @else {
            <mat-icon class="file-icon">description</mat-icon>
            <p class="file-name">{{ selectedFile.name }}</p>
            <p class="file-size">{{ formatFileSize(selectedFile.size) }}</p>
          }
        </div>

        @if (isUploading) {
          <mat-progress-bar mode="indeterminate" color="primary"></mat-progress-bar>
          <p class="uploading-text">Sending to printer...</p>
        }

        <div class="dialog-actions">
          <button mat-button (click)="close()">Cancel</button>
          <button 
            mat-raised-button 
            color="primary" 
            [disabled]="!selectedFile || isUploading"
            (click)="sendToPrinter()">
            <mat-icon>print</mat-icon>
            Print Document
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .print-upload-dialog {
      padding: 0;
      min-width: 450px;
    }

    .dialog-header {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px 24px;
      color: white;
      margin: -24px -24px 0 -24px;
      position: relative;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 500;
      text-align: center;
    }

    .dialog-header button {
      color: white;
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
    }

    .dialog-content {
      padding: 24px;
    }

    .printer-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 20px;
    }

    .printer-info mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #666;
    }

    .printer-info div {
      display: flex;
      flex-direction: column;
    }

    .printer-label {
      font-weight: 600;
      color: #333;
    }

    .printer-ip {
      font-size: 0.85rem;
      color: #666;
      font-family: monospace;
    }

    .printer-status {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-left: auto;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .printer-status mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .printer-status.online {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .printer-status.offline {
      background: #ffebee;
      color: #c62828;
    }

    .printer-status.unknown {
      background: #fff3e0;
      color: #ef6c00;
    }

    .printer-status .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    .upload-zone {
      border: 2px dashed #ccc;
      border-radius: 12px;
      padding: 40px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background: #fafafa;
      margin-bottom: 20px;
    }

    .upload-zone:hover {
      border-color: #1e90ff;
      background: #f0f8ff;
    }

    .upload-zone.drag-over {
      border-color: #1e90ff;
      background: #e3f2fd;
    }

    .upload-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #1e90ff;
      margin-bottom: 12px;
    }

    .file-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #4caf50;
      margin-bottom: 12px;
    }

    .upload-text {
      font-size: 1.1rem;
      color: #333;
      margin: 0 0 4px 0;
    }

    .upload-hint {
      font-size: 0.9rem;
      color: #666;
      margin: 0 0 8px 0;
    }

    .upload-formats {
      font-size: 0.8rem;
      color: #999;
      margin: 0;
    }

    .file-name {
      font-size: 1rem;
      font-weight: 600;
      color: #333;
      margin: 0 0 4px 0;
      word-break: break-all;
    }

    .file-size {
      font-size: 0.85rem;
      color: #666;
      margin: 0;
    }

    .uploading-text {
      text-align: center;
      color: #1e90ff;
      margin: 12px 0 0 0;
      font-size: 0.9rem;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .dialog-actions button mat-icon {
      margin-right: 8px;
    }
  `]
})
export class PrintUploadDialogComponent {
  selectedFile: File | null = null;
  isDragOver = false;
  isUploading = false;
  printerStatus: 'unknown' | 'online' | 'offline' = 'unknown';
  statusChecking = false;

  constructor(
    private dialogRef: MatDialogRef<PrintUploadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { printer: Printer },
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) {
    // Check printer status on open
    this.checkPrinterStatus();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  checkPrinterStatus(): void {
    this.statusChecking = true;
    const printerKey = this.getPrinterKey();
    
    this.http.get<any>(`${environment.apiUrl}/print/printers/${printerKey}/status`, 
      { headers: this.getHeaders() }
    ).subscribe({
      next: (result) => {
        this.printerStatus = result.online ? 'online' : 'offline';
        this.statusChecking = false;
      },
      error: () => {
        this.printerStatus = 'unknown';
        this.statusChecking = false;
      }
    });
  }

  private getPrinterKey(): string {
    // Extract key from printer name (e.g., "Admin Printer" -> "admin")
    return this.data.printer.name.split(' ')[0].toLowerCase();
  }

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
      this.selectedFile = files[0];
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  sendToPrinter(): void {
    if (!this.selectedFile) return;

    this.isUploading = true;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    const printerKey = this.getPrinterKey();

    this.http.post<any>(
      `${environment.apiUrl}/print/send/${printerKey}`, 
      formData,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (response) => {
        this.isUploading = false;
        this.snackBar.open(
          response.message || `Document sent to ${this.data.printer.name}`,
          'Close',
          { duration: 5000, panelClass: ['success-snackbar'] }
        );
        this.dialogRef.close({ success: true, printer: this.data.printer });
      },
      error: (err) => {
        this.isUploading = false;
        const errorMessage = err.error?.error || err.error?.message || 'Failed to send document to printer';
        this.snackBar.open(errorMessage, 'Close', { 
          duration: 7000, 
          panelClass: ['error-snackbar'] 
        });
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
