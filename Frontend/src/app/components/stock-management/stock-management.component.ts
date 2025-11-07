import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-stock-management',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatDialogModule
  ],
  template: `
    <mat-toolbar color="primary">
      <span style="font-size: 20px; font-weight: 600;">Promed Intranet</span>
      <span style="margin: 0 32px;"></span>

      <button mat-button routerLink="/dashboard">
        <mat-icon>home</mat-icon> Home
      </button>
      <button mat-button routerLink="/crm">
        <mat-icon>people_outline</mat-icon> CRM
      </button>
      <button mat-button routerLink="/departments">
        <mat-icon>business</mat-icon> Project Management
      </button>
      <button mat-button routerLink="/people">
        <mat-icon>people</mat-icon> Human Resource
      </button>
      <button mat-button routerLink="/stock-management">
        <mat-icon>inventory</mat-icon> Stock Management
      </button>
      <button mat-button routerLink="/documents">
        <mat-icon>folder</mat-icon> Documents
      </button>
      <button mat-button routerLink="/support-ticket">
        <mat-icon>support_agent</mat-icon> Support Ticket
      </button>

      <span class="spacer"></span>
    </mat-toolbar>

    <div class="container">
      <h1>Stock Management</h1>
      <p class="subtitle">Manage your warehouses and inventory</p>

      <div class="warehouses-grid">
        @for (warehouse of warehouses; track warehouse.id) {
          <mat-card class="warehouse-card" (click)="openWarehouse(warehouse)">
            <mat-card-header>
              <div class="warehouse-icon">
                <mat-icon>warehouse</mat-icon>
              </div>
              <mat-card-title>{{ warehouse.name }}</mat-card-title>
              <mat-card-subtitle>{{ warehouse.location }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="warehouse-stats">
                <div class="stat">
                  <mat-icon>inventory_2</mat-icon>
                  <div>
                    <div class="stat-value">{{ warehouse.totalItems }}</div>
                    <div class="stat-label">Total Items</div>
                  </div>
                </div>
                <div class="stat">
                  <mat-icon>category</mat-icon>
                  <div>
                    <div class="stat-value">{{ warehouse.categories }}</div>
                    <div class="stat-label">Categories</div>
                  </div>
                </div>
              </div>
              <div class="warehouse-capacity">
                <div class="capacity-label">
                  <span>Capacity</span>
                  <span>{{ warehouse.capacity }}%</span>
                </div>
                <div class="capacity-bar">
                  <div class="capacity-fill" [style.width.%]="warehouse.capacity" [class.high]="warehouse.capacity > 80"></div>
                </div>
              </div>
            </mat-card-content>
            <mat-card-actions>
              <button mat-button color="primary">
                <mat-icon>visibility</mat-icon>
                View Details
              </button>
            </mat-card-actions>
          </mat-card>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .spacer {
      flex: 1 1 auto;
    }

    .container {
      padding: 40px;
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      color: white;
      font-size: 2.5rem;
      font-weight: 600;
      margin-bottom: 8px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 1.1rem;
      margin-bottom: 32px;
    }

    .warehouses-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }

    .warehouse-card {
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .warehouse-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }

    .warehouse-icon {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
    }

    .warehouse-icon mat-icon {
      color: white;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    mat-card-header {
      margin-bottom: 16px;
    }

    mat-card-title {
      font-size: 1.5rem;
      font-weight: 600;
    }

    mat-card-subtitle {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
    }

    .warehouse-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      margin-bottom: 20px;
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
      color: #667eea;
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .stat-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: #333;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #666;
    }

    .warehouse-capacity {
      margin-top: 16px;
    }

    .capacity-label {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #666;
    }

    .capacity-bar {
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }

    .capacity-fill {
      height: 100%;
      background: linear-gradient(90deg, #4caf50 0%, #8bc34a 100%);
      transition: width 0.3s ease;
    }

    .capacity-fill.high {
      background: linear-gradient(90deg, #f44336 0%, #ff9800 100%);
    }

    mat-card-actions {
      padding: 16px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class StockManagementComponent implements OnInit {
  warehouses = [
    {
      id: 1,
      name: 'Main Warehouse',
      location: 'Bangkok Central',
      totalItems: 12450,
      categories: 45,
      capacity: 78,
      manager: 'John Smith'
    },
    {
      id: 2,
      name: 'North Distribution Center',
      location: 'Chiang Mai',
      totalItems: 8320,
      categories: 32,
      capacity: 65,
      manager: 'Sarah Johnson'
    },
    {
      id: 3,
      name: 'South Warehouse',
      location: 'Phuket',
      totalItems: 5680,
      categories: 28,
      capacity: 45,
      manager: 'Mike Chen'
    },
    {
      id: 4,
      name: 'East Regional Hub',
      location: 'Rayong',
      totalItems: 9870,
      categories: 38,
      capacity: 85,
      manager: 'Lisa Wang'
    },
    {
      id: 5,
      name: 'West Storage Facility',
      location: 'Kanchanaburi',
      totalItems: 4200,
      categories: 22,
      capacity: 52,
      manager: 'David Lee'
    },
    {
      id: 6,
      name: 'Northeast Depot',
      location: 'Khon Kaen',
      totalItems: 7150,
      categories: 35,
      capacity: 70,
      manager: 'Emma Brown'
    }
  ];

  constructor(
    private router: Router,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
  }

  openWarehouse(warehouse: any): void {
    // Navigate to warehouse detail page (to be created)
    this.router.navigate(['/stock-management/warehouse', warehouse.id]);
  }
}
