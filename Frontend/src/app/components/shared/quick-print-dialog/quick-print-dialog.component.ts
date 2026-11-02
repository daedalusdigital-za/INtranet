import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { PrintUploadDialogComponent } from '../print-upload-dialog/print-upload-dialog.component';

export interface Printer {
  name: string;
  ip: string;
  icon: string;
}

@Component({
  selector: 'app-quick-print-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <div class="quick-print-dialog">
      <div class="dialog-header">
        <h2>Quick Print</h2>
        <button aria-label="Close" mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div class="dialog-content">
        <p class="subtitle">Select a Ricoh printer to send your document</p>
        
        <div class="printers-grid">
          @for (printer of printers; track printer.name) {
            <div 
              class="printer-box" 
              (click)="selectPrinter(printer)">
              <mat-icon class="printer-icon">{{ printer.icon }}</mat-icon>
              <span class="printer-name">{{ printer.name }}</span>
              <span class="printer-ip">{{ printer.ip }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .quick-print-dialog {
      padding: 0;
      min-width: 600px;
    }

    .dialog-header {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px 24px;
      background: var(--color-surface);
      color: var(--color-text);
      border-bottom: 1px solid var(--color-line);
      margin: -24px -24px 0 -24px;
      position: relative;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: var(--text-3xl);
      font-weight: 500;
      text-align: center;
    }

    .dialog-header button {
      color: var(--color-text-2);
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
    }

    .dialog-content {
      padding: 24px;
    }

    .subtitle {
      text-align: center;
      color: var(--color-text-2);
      margin-bottom: 24px;
      font-size: var(--text-lg);
    }

    .printers-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .printer-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px 16px;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-line);
      background: var(--color-surface);
      cursor: pointer;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      color: var(--color-text);
      min-height: 120px;
      text-align: center;
    }

    .printer-box:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-md);
    }

    .printer-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      margin-bottom: 8px;
      color: var(--color-primary);
    }

    .printer-name {
      font-size: var(--text-lg);
      font-weight: 600;
      margin-bottom: 4px;
    }

    .printer-ip {
      font-size: var(--text-xs);
      color: var(--color-text-2);
      font-family: var(--font-mono);
    }
  `]
})
export class QuickPrintDialogComponent {
  printers: Printer[] = [
    { name: 'Admin Printer', ip: '192.168.10.134', icon: 'print' },
    { name: 'Finance Printer', ip: '192.168.10.103', icon: 'print' },
    { name: 'Condom Printer', ip: '192.168.10.161', icon: 'print' },
    { name: 'HR Printer', ip: '192.168.10.130', icon: 'print' },
    { name: 'Sales Printer', ip: '192.168.10.104', icon: 'print' },
    { name: 'Pharmatech Printer', ip: '192.168.10.136', icon: 'print' },
    { name: 'Logistics Printer', ip: '192.168.10.248', icon: 'print' },
    { name: 'Projects Printer', ip: '192.168.10.5', icon: 'print' },
    { name: 'Tender Printer', ip: '192.168.10.128', icon: 'print' }
  ];

  constructor(
    private dialogRef: MatDialogRef<QuickPrintDialogComponent>,
    private dialog: MatDialog
  ) {}

  selectPrinter(printer: Printer): void {
    // Open the upload dialog for this printer
    this.dialog.open(PrintUploadDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      data: { printer }
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
