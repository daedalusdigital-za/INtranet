import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface RequestCategory {
  name: string;
  icon: string;
  color: string;
  description: string;
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
        <p class="subtitle">Select a category for your request</p>
        
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
      grid-template-columns: repeat(2, 1fr);
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
      name: 'Marketing',
      icon: 'campaign',
      color: '#e91e63',
      description: 'Marketing & Branding requests'
    },
    {
      name: 'Finances',
      icon: 'account_balance',
      color: '#4caf50',
      description: 'Financial & Budget requests'
    },
    {
      name: 'HR',
      icon: 'people',
      color: '#ff9800',
      description: 'Human Resources requests'
    },
    {
      name: 'Meeting',
      icon: 'event',
      color: '#9c27b0',
      description: 'Meeting room & schedule requests'
    }
  ];

  constructor(private dialogRef: MatDialogRef<RequestDialogComponent>) {}

  selectCategory(category: RequestCategory): void {
    console.log('Selected category:', category.name);
    // For now, just close the dialog
    // Later this can navigate to a request form for that category
    this.dialogRef.close(category);
  }

  close(): void {
    this.dialogRef.close();
  }
}
