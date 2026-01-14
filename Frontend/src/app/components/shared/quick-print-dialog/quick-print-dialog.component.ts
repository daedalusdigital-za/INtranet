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
  color: string;
}

@Component({
  selector: 'app-quick-print-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <div class="quick-print-dialog">
      <div class="dialog-header">
        <h2>Quick Print</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div class="dialog-content">
        <p class="subtitle">Select a Ricoh printer to send your document</p>
        
        <div class="printers-grid">
          @for (printer of printers; track printer.name) {
            <div 
              class="printer-box" 
              [style.background]="printer.color"
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
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      position: relative;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.5rem;
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

    .subtitle {
      text-align: center;
      color: #666;
      margin-bottom: 24px;
      font-size: 1rem;
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
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      color: white;
      min-height: 120px;
      text-align: center;
    }

    .printer-box:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    .printer-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      margin-bottom: 8px;
    }

    .printer-name {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .printer-ip {
      font-size: 0.75rem;
      opacity: 0.85;
      font-family: monospace;
    }
  `]
})
export class QuickPrintDialogComponent {
  printers: Printer[] = [
    { name: 'Admin Printer', ip: '192.168.10.134', icon: 'print', color: '#3f51b5' },
    { name: 'Finance Printer', ip: '192.168.10.103', icon: 'print', color: '#4caf50' },
    { name: 'Condom Printer', ip: '192.168.10.161', icon: 'print', color: '#e91e63' },
    { name: 'HR Printer', ip: '192.168.10.130', icon: 'print', color: '#ff9800' },
    { name: 'Sales Printer', ip: '192.168.10.104', icon: 'print', color: '#9c27b0' },
    { name: 'Pharmatech Printer', ip: '192.168.10.136', icon: 'print', color: '#00bcd4' },
    { name: 'Logistics Printer', ip: '192.168.10.248', icon: 'print', color: '#795548' },
    { name: 'Projects Printer', ip: '192.168.10.5', icon: 'print', color: '#607d8b' },
    { name: 'Tender Printer', ip: '192.168.10.128', icon: 'print', color: '#f44336' }
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
