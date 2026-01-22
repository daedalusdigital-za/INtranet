import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'danger' | 'info';
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="confirm-dialog">
      <div class="dialog-header" [class]="data.type || 'info'">
        <mat-icon>{{ getIcon() }}</mat-icon>
        <h2>{{ data.title }}</h2>
      </div>
      
      <div class="dialog-content">
        <p [innerHTML]="formatMessage(data.message)"></p>
      </div>
      
      <div class="dialog-actions">
        <button mat-button (click)="onCancel()">
          {{ data.cancelText || 'Cancel' }}
        </button>
        <button mat-raised-button [color]="getButtonColor()" (click)="onConfirm()">
          {{ data.confirmText || 'Confirm' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .confirm-dialog {
      min-width: 350px;
      max-width: 450px;
    }

    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
      
      &.warning {
        background-color: #fff3e0;
        mat-icon { color: #f57c00; }
      }
      
      &.danger {
        background-color: #ffebee;
        mat-icon { color: #d32f2f; }
      }
      
      &.info {
        background-color: #e3f2fd;
        mat-icon { color: #1976d2; }
      }
      
      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
      
      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 500;
      }
    }

    .dialog-content {
      padding: 24px;
      
      p {
        margin: 0;
        font-size: 14px;
        line-height: 1.6;
        color: rgba(0, 0, 0, 0.7);
        white-space: pre-line;
      }
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 8px 16px 16px;
    }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  getIcon(): string {
    switch (this.data.type) {
      case 'warning': return 'warning';
      case 'danger': return 'error';
      default: return 'info';
    }
  }

  getButtonColor(): string {
    switch (this.data.type) {
      case 'danger': return 'warn';
      default: return 'primary';
    }
  }

  formatMessage(message: string): string {
    return message.replace(/\n/g, '<br>');
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
