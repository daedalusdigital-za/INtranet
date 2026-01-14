import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { LeaveRequestDialogComponent } from '../leave-request-dialog/leave-request-dialog.component';
import { PayslipRequestDialogComponent } from '../payslip-request-dialog/payslip-request-dialog.component';
import { PrivateMeetingRequestDialogComponent } from '../private-meeting-request-dialog/private-meeting-request-dialog.component';

interface RequestCategory {
  name: string;
  icon: string;
  color: string;
  description: string;
  type: string;
}

@Component({
  selector: 'app-request-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatIconModule, MatButtonModule],
  template: `
    <div class="request-dialog">
      <div class="dialog-header">
        <h2>Submit a Request</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      
      <div class="dialog-content">
        <p class="subtitle">Select the type of request you want to submit</p>
        
        <div class="categories-grid">
          @for (category of categories; track category.name) {
            <div 
              class="category-box" 
              [style.background]="category.color"
              (click)="selectCategory(category)">
              <mat-icon class="category-icon">{{ category.icon }}</mat-icon>
              <span class="category-name">{{ category.name }}</span>
              <span class="category-desc">{{ category.description }}</span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .request-dialog {
      padding: 0;
      min-width: 500px;
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

    .categories-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .category-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      border-radius: 12px;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      color: white;
      min-height: 140px;
      text-align: center;
    }

    .category-box:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    }

    .category-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    .category-name {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .category-desc {
      font-size: 0.85rem;
      opacity: 0.9;
    }
  `]
})
export class RequestDialogComponent {
  categories: RequestCategory[] = [
    {
      name: 'Leave Request',
      icon: 'event_busy',
      color: '#4caf50',
      description: 'Apply for annual, sick, or other leave',
      type: 'leave'
    },
    {
      name: 'Payslip Request',
      icon: 'receipt_long',
      color: '#2196f3',
      description: 'Request your payslip or salary info',
      type: 'payslip'
    },
    {
      name: 'Private Meeting',
      icon: 'meeting_room',
      color: '#9c27b0',
      description: 'Request a private meeting with HR/Manager',
      type: 'private-meeting'
    }
  ];

  constructor(
    private dialogRef: MatDialogRef<RequestDialogComponent>,
    private dialog: MatDialog
  ) {}

  selectCategory(category: RequestCategory): void {
    console.log('Selected category:', category.name);
    this.dialogRef.close();
    
    switch (category.type) {
      case 'leave':
        this.dialog.open(LeaveRequestDialogComponent, {
          width: '600px',
          maxHeight: '90vh'
        });
        break;
      case 'payslip':
        this.dialog.open(PayslipRequestDialogComponent, {
          width: '500px',
          maxHeight: '90vh'
        });
        break;
      case 'private-meeting':
        this.dialog.open(PrivateMeetingRequestDialogComponent, {
          width: '600px',
          maxHeight: '90vh'
        });
        break;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
