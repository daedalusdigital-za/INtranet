import { Component, OnInit, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatListModule } from '@angular/material/list';
import { SelectionModel } from '@angular/cdk/collections';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SohImportDialogComponent, SohImportDialogData, SohImportDialogResult } from '../shared/soh-import-dialog/soh-import-dialog.component';
import { environment } from '../../../environments/environment';

interface WarehouseSummary {
  id: number;
  name: string;
  location: string;
  managerName: string;
  totalItems: number;
  totalStockValue: number;
  capacityPercent: number;
  totalCapacity: number;
  availableCapacity: number;
  status: string;
}

interface WarehouseInventory {
  id: number;
  warehouseId: number;
  warehouseName: string;
  commodityId: number;
  commodityName: string;
  quantityOnHand: number;
  reorderLevel: number;
  maximumLevel: number;
  binLocation: string;
  lastCountDate: string;
  lastRestockDate: string;
}

@Component({
  selector: 'app-stock-management',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatDialogModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatMenuModule,
    MatTooltipModule,
    NavbarComponent,
    MatListModule
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="container">
      <div class="page-header">
        <div class="header-text">
          <h1>Stock Management</h1>
          <p class="subtitle">{{ selectedWarehouse ? selectedWarehouse.name : 'Select a warehouse to begin' }}</p>
        </div>
        <div class="header-actions">
          @if (selectedWarehouse) {
            <button mat-raised-button (click)="clearSelection()">
              <mat-icon>arrow_back</mat-icon>
              Back to Warehouses
            </button>
          }
          <button mat-raised-button color="accent" (click)="openSohImportDialog()" matTooltip="Import Stock on Hand from Excel">
            <mat-icon>upload_file</mat-icon>
            Import SOH
          </button>
        </div>
      </div>

      @if (selectedWarehouse && !showInventorySubmenu) {
        <div class="operations-grid">
          <div class="operation-block depot-block" (click)="selectOperation('inventory')">
            <div class="block-icon">
              <mat-icon>inventory_2</mat-icon>
            </div>
            <h3>Inventory Management</h3>
            <p>View & manage stock levels</p>
          </div>

          <div class="operation-block dispatch-block" (click)="selectOperation('dispatch')">
            <div class="block-icon">
              <mat-icon>local_shipping</mat-icon>
            </div>
            <h3>Order Accept & Dispatch</h3>
            <p>Process orders & dispatch</p>
          </div>

          <div class="operation-block transfer-block" (click)="selectOperation('transfer')">
            <div class="block-icon">
              <mat-icon>swap_horiz</mat-icon>
            </div>
            <h3>Transfer & Returns</h3>
            <p>Inter-warehouse transfers</p>
          </div>

          <div class="operation-block grv-block" (click)="selectOperation('grv')">
            <div class="block-icon">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <h3>Goods Received</h3>
            <p>Record incoming deliveries</p>
          </div>
        </div>
      }

      @if (showInventorySubmenu) {
        <div class="submenu-header">
          <button mat-icon-button (click)="backToOperations()">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <h2>Inventory Management</h2>
        </div>

        <div class="operations-grid">
          <div class="operation-block inventory-block" (click)="openInventoryView()">
            <div class="block-icon">
              <mat-icon>view_list</mat-icon>
            </div>
            <h3>Inventory Management</h3>
            <p>View all stock items</p>
          </div>

          <div class="operation-block scrap-block" (click)="openScrap()">
            <div class="block-icon">
              <mat-icon>delete_sweep</mat-icon>
            </div>
            <h3>Scrap</h3>
            <p>Record damaged items</p>
          </div>

          <div class="operation-block stocktake-block" (click)="openStockTake()">
            <div class="block-icon">
              <mat-icon>fact_check</mat-icon>
            </div>
            <h3>Stock Take</h3>
            <p>Physical count verification</p>
          </div>

          <div class="operation-block repack-block" (click)="openRepackaging()">
            <div class="block-icon">
              <mat-icon>inventory</mat-icon>
            </div>
            <h3>Repackaging</h3>
            <p>Change item packaging</p>
          </div>
        </div>
      }

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="50"></mat-spinner>
          <p>Loading warehouses...</p>
        </div>
      } @else if (warehouses.length === 0) {
        <div class="empty-state">
          <mat-icon>warehouse</mat-icon>
          <h3>No Warehouses Found</h3>
          <p>No warehouses have been configured yet.</p>
        </div>
      } @else if (!selectedWarehouse) {
        <div class="warehouses-grid">
          @for (warehouse of warehouses; track warehouse.id) {
            <mat-card class="warehouse-card" (click)="selectWarehouse(warehouse)">
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
                      <div class="stat-value">{{ warehouse.totalItems | number }}</div>
                      <div class="stat-label">Total Items</div>
                    </div>
                  </div>
                  <div class="stat">
                    <mat-icon>category</mat-icon>
                    <div>
                      <div class="stat-value">R{{ warehouse.totalStockValue | number:'1.0-0' }}</div>
                      <div class="stat-label">Value</div>
                    </div>
                  </div>
                </div>
                <div class="warehouse-capacity">
                  <div class="capacity-label">
                    <span>Capacity</span>
                    <span>{{ warehouse.capacityPercent }}%</span>
                  </div>
                  <div class="capacity-bar">
                    <div class="capacity-fill" [style.width.%]="warehouse.capacityPercent" [class.high]="warehouse.capacityPercent > 80"></div>
                  </div>
                </div>
              </mat-card-content>
              <mat-card-actions>
                <button mat-button color="primary" (click)="selectWarehouse(warehouse); $event.stopPropagation()">
                  <mat-icon>visibility</mat-icon>
                  View Operations
                </button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .spacer {
      flex: 1 1 auto;
    }

    .container {
      padding: 80px;
      max-width: 1400px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 32px;
    }

    .header-text {
      text-align: left;
    }

    .header-actions {
      display: flex;
      gap: 12px;
    }

    .header-actions button {
      font-weight: 500;
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
      margin: 0;
    }

    .warehouses-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 32px;
    }

    .warehouse-card {
      cursor: pointer;
      transition: all 0.3s ease;
      padding: 24px;
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
      font-size: 1.25rem;
      font-weight: 700;
      color: #333;
      white-space: nowrap;
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

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
      color: white;
    }

    .loading-container p {
      margin-top: 16px;
      font-size: 1.1rem;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      color: white;
    }

    .empty-state mat-icon {
      font-size: 72px;
      width: 72px;
      height: 72px;
      margin-bottom: 16px;
      opacity: 0.8;
    }

    .empty-state h3 {
      font-size: 1.5rem;
      margin: 0 0 8px 0;
    }

    .empty-state p {
      opacity: 0.8;
      margin: 0;
    }

    .operations-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-bottom: 32px;
      animation: slideUp 0.4s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .operation-block {
      position: relative;
      cursor: pointer;
      padding: 32px 24px;
      border-radius: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-align: center;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      min-height: 180px;
      background: white;
    }

    .operation-block::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .operation-block:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    }

    .operation-block:hover::before {
      opacity: 1;
    }

    .operation-block:active {
      transform: translateY(-4px) scale(0.98);
    }

    .block-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.9);
      margin-bottom: 8px;
      transition: all 0.3s ease;
    }

    .operation-block:hover .block-icon {
      transform: scale(1.1) rotate(5deg);
      background: white;
    }

    .block-icon mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }

    .operation-block h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      z-index: 1;
    }

    .operation-block p {
      margin: 0;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.95);
      font-weight: 500;
      z-index: 1;
    }

    .depot-block {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .depot-block .block-icon mat-icon {
      color: #667eea;
    }

    .dispatch-block {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .dispatch-block .block-icon mat-icon {
      color: #f5576c;
    }

    .transfer-block {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .transfer-block .block-icon mat-icon {
      color: #4facfe;
    }

    .grv-block {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    .grv-block .block-icon mat-icon {
      color: #43e97b;
    }

    .inventory-block {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .inventory-block .block-icon mat-icon {
      color: #667eea;
    }

    .scrap-block {
      background: linear-gradient(135deg, #fc6767 0%, #ec008c 100%);
    }

    .scrap-block .block-icon mat-icon {
      color: #fc6767;
    }

    .stocktake-block {
      background: linear-gradient(135deg, #f77062 0%, #fe5196 100%);
    }

    .stocktake-block .block-icon mat-icon {
      color: #f77062;
    }

    .repack-block {
      background: linear-gradient(135deg, #fccb90 0%, #d57eeb 100%);
    }

    .repack-block .block-icon mat-icon {
      color: #d57eeb;
    }

    .submenu-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      animation: slideUp 0.3s ease-out;
    }

    .submenu-header button {
      color: white;
    }

    .submenu-header h2 {
      margin: 0;
      color: white;
      font-size: 1.5rem;
      font-weight: 600;
    }
  `]
})
export class StockManagementComponent implements OnInit {
  warehouses: WarehouseSummary[] = [];
  loading = true;
  notificationCount = 3;
  selectedWarehouse: any = null;
  showInventorySubmenu = false;

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadWarehouses();
  }

  loadWarehouses(): void {
    this.loading = true;
    this.http.get<WarehouseSummary[]>(`${environment.apiUrl}/warehouses/summary`).subscribe({
      next: (data) => {
        this.warehouses = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading warehouses:', error);
        this.loading = false;
      }
    });
  }

  selectWarehouse(warehouse: any): void {
    this.selectedWarehouse = warehouse;
    this.showInventorySubmenu = false;
  }

  clearSelection(): void {
    this.selectedWarehouse = null;
    this.showInventorySubmenu = false;
  }

  selectOperation(operation: string): void {
    if (operation === 'inventory') {
      this.showInventorySubmenu = true;
    } else if (operation === 'dispatch') {
      this.openDispatchDialog();
    } else if (operation === 'transfer') {
      this.openTransferDialog();
    } else if (operation === 'grv') {
      this.openGRVDialog();
    }
  }

  backToOperations(): void {
    this.showInventorySubmenu = false;
  }

  openInventoryView(): void {
    this.dialog.open(WarehouseDetailsDialog, {
      width: '90%',
      maxWidth: '1200px',
      data: this.selectedWarehouse
    });
  }

  openScrap(): void {
    this.dialog.open(ScrapDialog, {
      width: '800px',
      maxWidth: '90vw',
      data: this.selectedWarehouse
    });
  }

  openStockTake(): void {
    this.dialog.open(StockTakeDialog, {
      width: '900px',
      maxWidth: '90vw',
      data: this.selectedWarehouse
    });
  }

  openRepackaging(): void {
    this.dialog.open(RepackagingDialog, {
      width: '700px',
      maxWidth: '90vw',
      data: this.selectedWarehouse
    });
  }

  openDispatchDialog(): void {
    this.dialog.open(DispatchDialog, {
      width: '1000px',
      maxWidth: '90vw',
      data: this.selectedWarehouse
    });
  }

  openTransferDialog(): void {
    const detailsDialog = this.dialog.open(WarehouseDetailsDialog, {
      width: '90%',
      maxWidth: '1200px',
      data: this.selectedWarehouse
    });
    setTimeout(() => {
      if (detailsDialog.componentInstance) {
        detailsDialog.componentInstance.openTransferDialog();
      }
    }, 500);
  }

  openGRVDialog(): void {
    const grvDialog = this.dialog.open(WarehouseDetailsDialog, {
      width: '90%',
      maxWidth: '1200px',
      data: this.selectedWarehouse
    });
    setTimeout(() => {
      if (grvDialog.componentInstance) {
        grvDialog.componentInstance.openGRVDialog();
      }
    }, 500);
  }

  viewWarehouseDetails(warehouse: any): void {
    this.dialog.open(WarehouseOperationsDialog, {
      width: '700px',
      maxWidth: '90vw',
      data: warehouse
    });
  }

  openWarehouseInventory(warehouse: any): void {
    this.dialog.open(WarehouseDetailsDialog, {
      width: '90%',
      maxWidth: '1200px',
      data: warehouse
    });
  }

  openWarehouse(warehouse: any): void {
    // Navigate to warehouse detail page (to be created)
    this.router.navigate(['/stock-management/warehouse', warehouse.id]);
  }

  openSohImportDialog(): void {
    const dialogRef = this.dialog.open(SohImportDialogComponent, {
      width: '95vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      disableClose: true,
      data: {
        apiUrl: environment.apiUrl
      } as SohImportDialogData
    });

    dialogRef.afterClosed().subscribe((result: SohImportDialogResult) => {
      if (result?.success && result?.committed) {
        this.snackBar.open(result.message || 'Stock on Hand data imported successfully!', 'Close', { duration: 5000 });
        // Optionally refresh warehouse data
        this.loadWarehouses();
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

// Warehouse Details Dialog Component
@Component({
  selector: 'warehouse-details-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="modern-dialog">
      <div class="dialog-header">
        <div class="header-content">
          <div class="icon-wrapper">
            <mat-icon>warehouse</mat-icon>
          </div>
          <div class="header-text">
            <h2>{{ data.name }}</h2>
            <p class="location-subtitle">
              <mat-icon>place</mat-icon>
              {{ data.location }}
            </p>
          </div>
        </div>
        <button mat-icon-button mat-dialog-close class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <!-- Summary Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <mat-icon>inventory_2</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ sohTotalItems > 0 ? sohTotalItems : data.totalItems }}</div>
              <div class="stat-label">Total Items</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
              <mat-icon>category</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">R{{ sohTotalValue > 0 ? (sohTotalValue | number:'1.0-0') : (data.totalStockValue | number:'1.0-0') }}</div>
              <div class="stat-label">Value</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
              <mat-icon>person</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ data.manager }}</div>
              <div class="stat-label">Manager</div>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);">
              <mat-icon>storage</mat-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ data.capacity }}%</div>
              <div class="stat-label">Capacity Used</div>
            </div>
          </div>
        </div>

        <!-- SOH Info Banner -->
        @if (sohAsAtDate) {
          <div class="soh-info-banner">
            <div class="soh-info-item">
              <mat-icon>calendar_today</mat-icon>
              <span>Stock as at: <strong>{{ sohAsAtDate }}</strong></span>
            </div>
            <div class="soh-info-item">
              <mat-icon>inventory_2</mat-icon>
              <span>{{ sohTotalItems | number }} items</span>
            </div>
            <div class="soh-info-item">
              <mat-icon>attach_money</mat-icon>
              <span>Total Value: <strong>R {{ sohTotalValue | number:'1.2-2' }}</strong></span>
            </div>
            @if (sohLocations.length > 0) {
              <div class="soh-info-item locations">
                <mat-icon>warehouse</mat-icon>
                <span>Locations: {{ sohLocations.join(', ') }}</span>
              </div>
            }
          </div>
        }

        <!-- Inventory Table -->
        <div class="table-section">
          <div class="table-header">
            <h3>
              <mat-icon>list_alt</mat-icon>
              Inventory Items
            </h3>
            <div class="search-box">
              <mat-form-field appearance="outline" class="search-field">
                <mat-label>Search inventory</mat-label>
                <input matInput [(ngModel)]="searchQuery" (ngModelChange)="filterInventory()" placeholder="Search by name, Item Code, or company">
                <mat-icon matPrefix>search</mat-icon>
                @if (searchQuery) {
                  <button matSuffix mat-icon-button (click)="clearSearch()">
                    <mat-icon>close</mat-icon>
                  </button>
                }
              </mat-form-field>
            </div>
          </div>

          <table mat-table [dataSource]="filteredInventoryData" class="modern-table">
            <!-- Checkbox Column -->
            <ng-container matColumnDef="select">
              <th mat-header-cell *matHeaderCellDef>
                <mat-checkbox
                  (change)="$event ? toggleAllRows() : null"
                  [checked]="selection.hasValue() && isAllSelected()"
                  [indeterminate]="selection.hasValue() && !isAllSelected()">
                </mat-checkbox>
              </th>
              <td mat-cell *matCellDef="let item">
                <mat-checkbox
                  (click)="$event.stopPropagation()"
                  (change)="$event ? selection.toggle(item) : null"
                  [checked]="selection.isSelected(item)">
                </mat-checkbox>
              </td>
            </ng-container>

            <!-- Item Description Column -->
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Item Description</th>
              <td mat-cell *matCellDef="let item">
                <div class="item-name">
                  <mat-icon [style.color]="getCategoryColor(item.category)">{{ getCategoryIcon(item.category) }}</mat-icon>
                  <span>{{ item.name }}</span>
                </div>
              </td>
            </ng-container>

            <!-- Item Code Column -->
            <ng-container matColumnDef="sku">
              <th mat-header-cell *matHeaderCellDef>Item Code</th>
              <td mat-cell *matCellDef="let item">
                <span class="sku-badge">{{ item.sku }}</span>
              </td>
            </ng-container>

            <!-- Company Column -->
            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef>Company</th>
              <td mat-cell *matCellDef="let item">
                <mat-chip [style.background]="getCategoryColor(item.category)" style="color: white;">
                  {{ item.category }}
                </mat-chip>
              </td>
            </ng-container>

            <!-- Quantity Column -->
            <ng-container matColumnDef="quantity">
              <th mat-header-cell *matHeaderCellDef>Quantity</th>
              <td mat-cell *matCellDef="let item">
                <span class="quantity-value">{{ item.quantity }}</span>
              </td>
            </ng-container>

            <!-- UOM Column -->
            <ng-container matColumnDef="unitPrice">
              <th mat-header-cell *matHeaderCellDef>UOM</th>
              <td mat-cell *matCellDef="let item">
                <span class="price-value">R{{ item.unitPrice.toLocaleString() }}</span>
              </td>
            </ng-container>

            <!-- Stock Value Column -->
            <ng-container matColumnDef="totalValue">
              <th mat-header-cell *matHeaderCellDef>Stock Value</th>
              <td mat-cell *matCellDef="let item">
                <span class="total-value">R{{ (item.quantity * item.unitPrice).toLocaleString() }}</span>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let item">
                <mat-chip [class]="'status-chip ' + item.status.toLowerCase()">
                  <mat-icon>{{ getStatusIcon(item.status) }}</mat-icon>
                  {{ item.status }}
                </mat-chip>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="table-row"></tr>
          </table>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions>
        <button mat-flat-button color="accent" (click)="exportToExcel()" class="export-btn">
          <mat-icon>file_download</mat-icon>
          Export to Excel
        </button>
        <button mat-flat-button (click)="openGRVDialog()" class="grv-btn">
          <mat-icon>add_box</mat-icon>
          GRV
        </button>
        <button mat-flat-button (click)="openTransferDialog()" [disabled]="!selection.hasValue()" class="transfer-btn">
          <mat-icon>swap_horiz</mat-icon>
          Transfer ({{ selection.selected.length }})
        </button>
        <button mat-flat-button color="primary" mat-dialog-close>
          <mat-icon>check_circle</mat-icon>
          Close
        </button>
      </mat-dialog-actions>

      <!-- Transfer Dialog Overlay -->
      @if (showTransferDialog) {
        <div class="transfer-overlay" (click)="closeTransferDialog()">
          <div class="transfer-dialog" (click)="$event.stopPropagation()">
            <div class="transfer-header">
              <h3>Transfer Items</h3>
              <button mat-icon-button (click)="closeTransferDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="transfer-content">
              <p class="transfer-info">
                <mat-icon>info</mat-icon>
                You are about to transfer <strong>{{ selection.selected.length }}</strong> item(s)
              </p>

              <div class="selected-items">
                <h4>Selected Items:</h4>
                <div class="item-list-detailed">
                  @for (item of selection.selected; track item.sku) {
                    <div class="item-row">
                      <div class="item-info">
                        <mat-icon [style.color]="getCategoryColor(item.category)">inventory_2</mat-icon>
                        <div class="item-details">
                          <span class="item-name-text">{{ item.name }}</span>
                          <span class="item-sku">{{ item.sku }}</span>
                          <span class="available-qty">Available: {{ item.quantity }}</span>
                        </div>
                      </div>
                      <mat-form-field appearance="outline" class="quantity-field">
                        <mat-label>Quantity</mat-label>
                        <input
                          matInput
                          type="number"
                          min="1"
                          [max]="item.quantity"
                          [(ngModel)]="transferQuantities[item.sku]"
                          (ngModelChange)="setTransferQuantity(item.sku, $event, item.quantity)">
                        <span matSuffix>/ {{ item.quantity }}</span>
                      </mat-form-field>
                    </div>
                  }
                </div>
              </div>

              <mat-form-field appearance="outline" class="warehouse-select">
                <mat-label>Select Destination Warehouse</mat-label>
                <mat-select [(ngModel)]="selectedWarehouse">
                  @for (warehouse of warehouses; track warehouse) {
                    @if (warehouse !== data.name) {
                      <mat-option [value]="warehouse">{{ warehouse }}</mat-option>
                    }
                  }
                </mat-select>
                <mat-icon matPrefix>warehouse</mat-icon>
              </mat-form-field>
            </div>

            <div class="transfer-actions">
              <button mat-stroked-button (click)="closeTransferDialog()">
                <mat-icon>cancel</mat-icon>
                Cancel
              </button>
              <button mat-flat-button color="primary" (click)="confirmTransfer()" [disabled]="!selectedWarehouse">
                <mat-icon>check_circle</mat-icon>
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      }

      <!-- GRV Dialog Overlay -->
      @if (showGRVDialog) {
        <div class="transfer-overlay" (click)="closeGRVDialog()">
          <div class="transfer-dialog" (click)="$event.stopPropagation()">
            <div class="transfer-header">
              <h3>GRV - Goods Received Voucher</h3>
              <button mat-icon-button (click)="closeGRVDialog()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div class="transfer-content">
              <p class="transfer-info">
                <mat-icon>info</mat-icon>
                Add stock to <strong>{{ data.name }}</strong>
              </p>

              <!-- Search for Items -->
              <mat-form-field appearance="outline" class="warehouse-select">
                <mat-label>Search for Item</mat-label>
                <input
                  matInput
                  [(ngModel)]="grvSearchQuery"
                  (ngModelChange)="filterGRVItems()"
                  placeholder="Search by name or item code">
                <mat-icon matPrefix>search</mat-icon>
              </mat-form-field>

              <!-- Filtered Items List -->
              @if (grvSearchQuery && filteredGRVItems.length > 0) {
                <div class="grv-items-dropdown">
                  <div class="grv-item-option"
                       *ngFor="let item of filteredGRVItems.slice(0, 5)"
                       (click)="selectGRVItem(item)">
                    <mat-icon [style.color]="getCategoryColor(item.category)">inventory_2</mat-icon>
                    <div class="grv-option-details">
                      <span class="grv-option-name">{{ item.name }}</span>
                      <span class="grv-option-sku">{{ item.sku }}</span>
                    </div>
                  </div>
                </div>
              }

              <!-- Selected Items for GRV -->
              @if (selectedGRVItems.length > 0) {
                <div class="selected-items">
                  <h4>Items to Receive:</h4>
                  <div class="item-list-detailed">
                    @for (item of selectedGRVItems; track item.sku) {
                      <div class="item-row">
                        <div class="item-info">
                          <mat-icon [style.color]="getCategoryColor(item.category)">inventory_2</mat-icon>
                          <div class="item-details">
                            <span class="item-name-text">{{ item.name }}</span>
                            <span class="item-sku">{{ item.sku }}</span>
                            <span class="available-qty">Current Stock: {{ item.quantity }}</span>
                          </div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                          <mat-form-field appearance="outline" class="quantity-field">
                            <mat-label>Qty to Add</mat-label>
                            <input
                              matInput
                              type="number"
                              min="1"
                              [(ngModel)]="grvQuantities[item.sku]">
                          </mat-form-field>
                          <button mat-icon-button (click)="removeGRVItem(item.sku)" color="warn">
                            <mat-icon>delete</mat-icon>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="transfer-actions">
              <button mat-stroked-button (click)="closeGRVDialog()">
                <mat-icon>cancel</mat-icon>
                Cancel
              </button>
              <button mat-flat-button color="primary" (click)="confirmGRV()" [disabled]="selectedGRVItems.length === 0">
                <mat-icon>check_circle</mat-icon>
                Confirm Receipt
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .modern-dialog {
      background: linear-gradient(135deg, #f8f9ff 0%, #ffffff 100%);
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 32px 32px 24px 32px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      border-radius: 12px 12px 0 0;
      position: relative;
      overflow: hidden;
    }

    .dialog-header::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -10%;
      width: 300px;
      height: 300px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 20px;
      position: relative;
      z-index: 1;
    }

    .icon-wrapper {
      width: 64px;
      height: 64px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .icon-wrapper mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .header-text h2 {
      margin: 0;
      font-size: 2rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .location-subtitle {
      margin: 8px 0 0 0;
      font-size: 1rem;
      opacity: 0.95;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .location-subtitle mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      position: relative;
      z-index: 1;
      transition: all 0.3s ease;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: rotate(90deg);
    }

    mat-dialog-content {
      padding: 32px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
      transition: transform 0.3s ease;
    }

    .stat-card:hover {
      transform: translateY(-4px);
    }

    .stat-icon {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .stat-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .stat-info {
      flex: 1;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: #1a1a1a;
      line-height: 1;
      margin-bottom: 4px;
    }

    .stat-label {
      font-size: 0.875rem;
      color: #666;
      font-weight: 500;
    }

    .soh-info-banner {
      background: linear-gradient(135deg, #e8f5e9, #c8e6c9);
      border-radius: 12px;
      padding: 16px 24px;
      margin-bottom: 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 24px;
      align-items: center;
      border-left: 4px solid #4caf50;
    }

    .soh-info-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #2e7d32;
      font-size: 14px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: #388e3c;
      }

      strong {
        font-weight: 600;
      }

      &.locations {
        flex: 1;
        min-width: 200px;
      }
    }

    .table-section {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    .table-section h3 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a1a1a;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .table-section h3 mat-icon {
      color: #667eea;
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      gap: 24px;
      flex-wrap: wrap;
    }

    .search-box {
      flex: 1;
      min-width: 300px;
      max-width: 500px;
    }

    .search-field {
      width: 100%;
    }

    .search-field ::ng-deep .mat-mdc-form-field-wrapper {
      padding-bottom: 0;
    }

    .search-field ::ng-deep .mat-mdc-text-field-wrapper {
      background: white;
      border-radius: 12px;
    }

    .search-field ::ng-deep .mat-mdc-form-field-focus-overlay {
      background: rgba(102, 126, 234, 0.05);
    }

    .modern-table {
      width: 100%;
      background: transparent;
    }

    .modern-table th {
      background: linear-gradient(135deg, #f5f7fa 0%, #e8ebf1 100%);
      color: #333;
      font-weight: 700;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 16px 12px;
    }

    .modern-table td {
      padding: 16px 12px;
      border-bottom: 1px solid #f0f0f0;
    }

    .table-row:hover {
      background: #f8f9ff;
    }

    .item-name {
      display: flex;
      align-items: center;
      gap: 12px;
      font-weight: 600;
    }

    .item-name mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .sku-badge {
      background: #f0f0f0;
      padding: 6px 12px;
      border-radius: 8px;
      font-family: 'Courier New', monospace;
      font-weight: 600;
      font-size: 0.875rem;
      color: #555;
    }

    mat-chip {
      font-weight: 600;
      font-size: 0.875rem;
    }

    .quantity-value {
      font-weight: 700;
      font-size: 1.1rem;
      color: #333;
    }

    .price-value {
      font-weight: 600;
      color: #555;
    }

    .total-value {
      font-weight: 700;
      font-size: 1.1rem;
      color: #667eea;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-weight: 600;
    }

    .status-chip mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .status-chip.in-stock {
      background: #43e97b !important;
      color: white !important;
    }

    .status-chip.low-stock {
      background: #ffa502 !important;
      color: white !important;
    }

    .status-chip.out-of-stock {
      background: #f5576c !important;
      color: white !important;
    }

    mat-dialog-actions {
      padding: 24px 32px;
      background: linear-gradient(180deg, transparent 0%, #f8f9ff 100%);
      margin: 0 -24px -24px -24px;
      display: flex;
      justify-content: center;
      gap: 16px;
      border-top: 1px solid #e0e0e0;
    }

    mat-dialog-actions button {
      min-width: 160px;
      height: 48px;
      font-weight: 700;
      font-size: 1rem;
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    mat-dialog-actions button:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    }

    .export-btn {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%) !important;
      color: white !important;
    }

    .grv-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      color: white !important;
    }

    .transfer-btn {
      background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%) !important;
      color: white !important;
    }

    .transfer-btn:disabled {
      background: #ccc !important;
      color: #666 !important;
      cursor: not-allowed;
      opacity: 0.6;
    }

    /* GRV Dropdown Styles */
    .grv-items-dropdown {
      position: relative;
      margin-top: -8px;
      margin-bottom: 16px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      max-height: 300px;
      overflow-y: auto;
      z-index: 100;
    }

    .grv-item-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s ease;
      border-bottom: 1px solid #f0f0f0;
    }

    .grv-item-option:last-child {
      border-bottom: none;
    }

    .grv-item-option:hover {
      background: #f5f5f5;
    }

    .grv-item-option mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .grv-option-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .grv-option-name {
      font-weight: 600;
      color: #333;
      font-size: 0.95rem;
    }

    .grv-option-sku {
      font-size: 0.85rem;
      color: #666;
      font-family: monospace;
    }

    /* Transfer Dialog Overlay */
    .transfer-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    }

    .transfer-dialog {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .transfer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 16px 16px 0 0;
    }

    .transfer-header h3 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 700;
    }

    .transfer-header button {
      color: white;
    }

    .transfer-content {
      padding: 24px;
    }

    .transfer-info {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: #e3f2fd;
      border-radius: 12px;
      margin-bottom: 24px;
      color: #1976d2;
    }

    .transfer-info mat-icon {
      color: #1976d2;
    }

    .selected-items {
      margin-bottom: 24px;
    }

    .selected-items h4 {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 1.1rem;
    }

    .item-list-detailed {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
      padding: 12px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 12px;
      transition: all 0.2s ease;
    }

    .item-row:hover {
      border-color: #667eea;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
    }

    .item-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .item-info mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .item-details {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .item-name-text {
      font-weight: 600;
      color: #333;
      font-size: 0.95rem;
    }

    .item-sku {
      font-size: 0.85rem;
      color: #666;
      font-family: monospace;
    }

    .available-qty {
      font-size: 0.8rem;
      color: #999;
    }

    .quantity-field {
      width: 140px;
      margin-bottom: -1.25em;
    }

    .quantity-field input {
      text-align: center;
      font-weight: 600;
      font-size: 1.1rem;
    }

    .item-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
      padding: 8px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .item-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: white;
      border: 1px solid #ddd;
      border-radius: 20px;
      font-size: 0.9rem;
    }

    .item-chip mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #667eea;
    }

    .warehouse-select {
      width: 100%;
    }

    .transfer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 24px;
      border-top: 1px solid #e0e0e0;
    }

    .transfer-actions button {
      min-width: 140px;
      height: 44px;
      font-weight: 600;
      border-radius: 8px;
    }

    .export-btn:hover {
      box-shadow: 0 8px 30px rgba(67, 233, 123, 0.4) !important;
    }

    mat-dialog-actions button mat-icon {
      margin-right: 8px;
    }

    ::-webkit-scrollbar {
      width: 10px;
    }

    ::-webkit-scrollbar-track {
      background: #f0f0f0;
      border-radius: 10px;
    }

    ::-webkit-scrollbar-thumb {
      background: #667eea;
      border-radius: 10px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #764ba2;
    }
  `]
})
export class WarehouseDetailsDialog implements OnInit {
  displayedColumns: string[] = ['select', 'name', 'sku', 'category', 'quantity', 'status'];
  searchQuery: string = '';
  selection = new SelectionModel<any>(true, []);
  showTransferDialog = false;
  selectedWarehouse: string = '';
  transferQuantities: { [key: string]: number } = {};
  loading = true;

  // GRV properties
  showGRVDialog = false;
  grvSearchQuery: string = '';
  filteredGRVItems: any[] = [];
  selectedGRVItems: any[] = [];
  grvQuantities: { [key: string]: number } = {};

  warehouses: string[] = [];
  inventoryData: any[] = [];
  filteredInventoryData: any[] = [];
  
  // SOH data
  sohAsAtDate: string | null = null;
  sohTotalItems: number = 0;
  sohTotalValue: number = 0;
  sohLocations: string[] = [];

  private http = inject(HttpClient);

  constructor(
    public dialogRef: MatDialogRef<WarehouseDetailsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngOnInit(): void {
    this.loadInventory();
    this.loadAllWarehouses();
  }

  loadInventory(): void {
    this.loading = true;
    // Try to load from SOH snapshots first
    this.http.get<any>(`${environment.apiUrl}/warehouses/${this.data.id}/soh`).subscribe({
      next: (data) => {
        if (data.items && data.items.length > 0) {
          // Use SOH data
          this.sohAsAtDate = data.asAtDate;
          this.sohTotalItems = data.totalItems;
          this.sohTotalValue = data.totalStockValue;
          this.sohLocations = data.locations || [];
          
          this.inventoryData = data.items.map((item: any) => ({
            id: item.id,
            name: item.itemDescription || item.itemCode,
            sku: item.itemCode,
            category: item.companyName || 'Unknown',
            location: item.location,
            quantity: item.qtyOnHand || 0,
            reorderLevel: null,
            binLocation: item.uom,
            totalCost: item.totalCost,
            unitCost: item.unitCost,
            qtyOnPO: item.qtyOnPO,
            qtyOnSO: item.qtyOnSO,
            stockAvailable: item.stockAvailable,
            status: this.getStockStatus(item.qtyOnHand || 0, null)
          }));
          this.filteredInventoryData = [...this.inventoryData];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading SOH inventory:', error);
        // Fallback to legacy inventory
        this.loadLegacyInventory();
      }
    });
  }

  loadLegacyInventory(): void {
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/${this.data.id}/inventory`).subscribe({
      next: (data) => {
        this.inventoryData = data.map(item => ({
          id: item.id,
          name: item.commodityName,
          sku: `COM-${item.commodityId.toString().padStart(3, '0')}`,
          category: 'General',
          quantity: item.quantityOnHand,
          reorderLevel: item.reorderLevel,
          binLocation: item.binLocation,
          status: this.getStockStatus(item.quantityOnHand, item.reorderLevel)
        }));
        this.filteredInventoryData = [...this.inventoryData];
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading inventory:', error);
        this.loading = false;
      }
    });
  }

  loadAllWarehouses(): void {
    this.http.get<any[]>(`${environment.apiUrl}/warehouses/summary`).subscribe({
      next: (data) => {
        this.warehouses = data
          .filter(w => w.id !== this.data.id)
          .map(w => w.name);
      },
      error: (error) => console.error('Error loading warehouses:', error)
    });
  }

  getStockStatus(quantity: number, reorderLevel: number | null): string {
    if (quantity === 0) return 'Out of Stock';
    if (reorderLevel && quantity <= reorderLevel) return 'Low Stock';
    return 'In Stock';
  }

  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.filteredInventoryData.length;
    return numSelected === numRows;
  }

  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
      return;
    }
    this.selection.select(...this.filteredInventoryData);
  }

  openTransferDialog() {
    this.showTransferDialog = true;
    // Initialize transfer quantities to 1 for each selected item
    this.selection.selected.forEach(item => {
      this.transferQuantities[item.sku] = 1;
    });
  }

  closeTransferDialog() {
    this.showTransferDialog = false;
    this.selectedWarehouse = '';
    this.transferQuantities = {};
  }

  getTransferQuantity(sku: string): number {
    return this.transferQuantities[sku] || 1;
  }

  setTransferQuantity(sku: string, quantity: number, maxQuantity: number) {
    // Ensure quantity is between 1 and available quantity
    if (quantity < 1) {
      this.transferQuantities[sku] = 1;
    } else if (quantity > maxQuantity) {
      this.transferQuantities[sku] = maxQuantity;
    } else {
      this.transferQuantities[sku] = quantity;
    }
  }

  confirmTransfer() {
    if (this.selectedWarehouse && this.selection.selected.length > 0) {
      const transferDetails = this.selection.selected.map(item =>
        `${item.name} - Quantity: ${this.transferQuantities[item.sku]}`
      ).join('\n');
      alert(`Transferring ${this.selection.selected.length} item(s) to ${this.selectedWarehouse}:\n\n${transferDetails}`);
      this.selection.clear();
      this.closeTransferDialog();
    }
  }

  // GRV Methods
  openGRVDialog() {
    this.showGRVDialog = true;
    this.grvSearchQuery = '';
    this.filteredGRVItems = [];
    this.selectedGRVItems = [];
    this.grvQuantities = {};
  }

  closeGRVDialog() {
    this.showGRVDialog = false;
    this.grvSearchQuery = '';
    this.filteredGRVItems = [];
    this.selectedGRVItems = [];
    this.grvQuantities = {};
  }

  filterGRVItems() {
    const query = this.grvSearchQuery.toLowerCase().trim();

    if (!query) {
      this.filteredGRVItems = [];
      return;
    }

    // Filter items that haven't been selected yet
    this.filteredGRVItems = this.inventoryData.filter(item => {
      const isNotSelected = !this.selectedGRVItems.find(selected => selected.sku === item.sku);
      const matchesQuery = item.name.toLowerCase().includes(query) ||
                          item.sku.toLowerCase().includes(query);
      return isNotSelected && matchesQuery;
    });
  }

  selectGRVItem(item: any) {
    // Add item to selected list if not already there
    if (!this.selectedGRVItems.find(selected => selected.sku === item.sku)) {
      this.selectedGRVItems.push(item);
      this.grvQuantities[item.sku] = 1; // Default quantity
    }
    // Clear search
    this.grvSearchQuery = '';
    this.filteredGRVItems = [];
  }

  removeGRVItem(sku: string) {
    this.selectedGRVItems = this.selectedGRVItems.filter(item => item.sku !== sku);
    delete this.grvQuantities[sku];
  }

  confirmGRV() {
    if (this.selectedGRVItems.length > 0) {
      const grvDetails = this.selectedGRVItems.map(item => {
        const qtyToAdd = this.grvQuantities[item.sku] || 1;
        const newTotal = item.quantity + qtyToAdd;
        return `${item.name} (${item.sku})\n  Adding: ${qtyToAdd} units\n  New Total: ${newTotal} units`;
      }).join('\n\n');

      alert(`GRV Confirmation for ${this.data.name}:\n\n${grvDetails}`);

      // Update inventory quantities (in real app, this would be API call)
      this.selectedGRVItems.forEach(item => {
        const qtyToAdd = this.grvQuantities[item.sku] || 1;
        const inventoryItem = this.inventoryData.find(i => i.sku === item.sku);
        if (inventoryItem) {
          inventoryItem.quantity += qtyToAdd;
          // Update status based on new quantity
          if (inventoryItem.quantity === 0) {
            inventoryItem.status = 'Out of Stock';
          } else if (inventoryItem.quantity < 10) {
            inventoryItem.status = 'Low Stock';
          } else {
            inventoryItem.status = 'In Stock';
          }
        }
      });

      // Refresh filtered data
      this.filteredInventoryData = [...this.inventoryData];
      this.closeGRVDialog();
    }
  }

  filterInventory(): void {
    const query = this.searchQuery.toLowerCase().trim();

    if (!query) {
      this.filteredInventoryData = [...this.inventoryData];
      return;
    }

    this.filteredInventoryData = this.inventoryData.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterInventory();
  }

  getCategoryColor(category: string): string {
    const colors: any = {
      'Access': '#667eea',
      'Promed': '#f5576c',
      'Pharama': '#4facfe',
      'Sebenzani': '#43e97b'
    };
    return colors[category] || '#999';
  }

  getCategoryIcon(category: string): string {
    const icons: any = {
      'Access': 'business',
      'Promed': 'medical_services',
      'Pharama': 'local_pharmacy',
      'Sebenzani': 'store'
    };
    return icons[category] || 'inventory_2';
  }

  getStatusIcon(status: string): string {
    const icons: any = {
      'In Stock': 'check_circle',
      'Low Stock': 'warning',
      'Out of Stock': 'cancel'
    };
    return icons[status] || 'help';
  }

  exportToExcel(): void {
    // Create CSV data
    const headers = ['Item Description', 'Item Code', 'Company', 'Quantity', 'UOM (R)', 'Stock Value (R)', 'Status'];
    const rows = this.filteredInventoryData.map(item => [
      item.name,
      item.sku,
      item.category,
      item.quantity,
      item.unitPrice,
      item.quantity * item.unitPrice,
      item.status
    ]);

    // Convert to CSV format
    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(cell => {
        // Escape cells containing commas or quotes
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',') + '\n';
    });

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const filename = `${this.data.name.replace(/\s+/g, '_')}_Inventory_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// Warehouse Operations Menu Dialog
@Component({
  selector: 'warehouse-operations-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="operations-dialog">
      <div class="dialog-header">
        <h2>{{ data.name }}</h2>
        <button mat-icon-button (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <div class="dialog-content">
        <p class="warehouse-info">
          <mat-icon>location_on</mat-icon>
          {{ data.location }}
        </p>

        <div class="operations-grid">
          <div class="operation-block depot-block" (click)="selectOperation('depot')">
            <div class="block-icon">
              <mat-icon>warehouse</mat-icon>
            </div>
            <h3>Depot Management</h3>
            <p>View inventory & stock levels</p>
          </div>

          <div class="operation-block dispatch-block" (click)="selectOperation('dispatch')">
            <div class="block-icon">
              <mat-icon>local_shipping</mat-icon>
            </div>
            <h3>Order Accept & Dispatch</h3>
            <p>Process orders & dispatch</p>
          </div>

          <div class="operation-block transfer-block" (click)="selectOperation('transfer')">
            <div class="block-icon">
              <mat-icon>swap_horiz</mat-icon>
            </div>
            <h3>Transfer & Returns</h3>
            <p>Inter-warehouse transfers</p>
          </div>

          <div class="operation-block grv-block" (click)="selectOperation('grv')">
            <div class="block-icon">
              <mat-icon>receipt_long</mat-icon>
            </div>
            <h3>Goods Received</h3>
            <p>Record incoming deliveries</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .operations-dialog {
      font-family: 'Roboto', sans-serif;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: -24px -24px 0 -24px;
      border-radius: 4px 4px 0 0;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
    }

    .warehouse-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 24px 0;
      padding: 12px 16px;
      background: rgba(102, 126, 234, 0.08);
      border-radius: 12px;
      color: #667eea;
      font-size: 0.95rem;
      font-weight: 500;
      border: 1px solid rgba(102, 126, 234, 0.2);
    }

    .warehouse-info mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #667eea;
    }

    .operations-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding: 8px 0;
    }

    .operation-block {
      position: relative;
      cursor: pointer;
      padding: 32px 24px;
      border-radius: 16px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-align: center;
      overflow: hidden;
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .operation-block::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0) 100%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .operation-block:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    }

    .operation-block:hover::before {
      opacity: 1;
    }

    .operation-block:active {
      transform: translateY(-4px) scale(0.98);
    }

    .block-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.9);
      margin-bottom: 8px;
      transition: all 0.3s ease;
    }

    .operation-block:hover .block-icon {
      transform: scale(1.1) rotate(5deg);
      background: white;
    }

    .block-icon mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
    }

    .operation-block h3 {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: white;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      z-index: 1;
    }

    .operation-block p {
      margin: 0;
      font-size: 0.85rem;
      color: rgba(255, 255, 255, 0.95);
      font-weight: 500;
      z-index: 1;
    }

    .depot-block {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .depot-block .block-icon mat-icon {
      color: #667eea;
    }

    .dispatch-block {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .dispatch-block .block-icon mat-icon {
      color: #f5576c;
    }

    .transfer-block {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .transfer-block .block-icon mat-icon {
      color: #4facfe;
    }

    .grv-block {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    .grv-block .block-icon mat-icon {
      color: #43e97b;
    }
  `]
})
export class WarehouseOperationsDialog {
  constructor(
    public dialogRef: MatDialogRef<WarehouseOperationsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialog: MatDialog
  ) {}

  selectOperation(operation: string): void {
    this.dialogRef.close();
    
    switch (operation) {
      case 'depot':
        // Open depot management (inventory view)
        this.dialog.open(WarehouseDetailsDialog, {
          width: '90%',
          maxWidth: '1200px',
          data: this.data
        });
        break;
      
      case 'dispatch':
        // TODO: Open dispatch dialog
        alert(`Order Accept & Dispatch for ${this.data.name}\nComing soon!`);
        break;
      
      case 'transfer':
        // Open transfer dialog (will open with transfer mode)
        const detailsDialog = this.dialog.open(WarehouseDetailsDialog, {
          width: '90%',
          maxWidth: '1200px',
          data: this.data
        });
        // Auto-open transfer after dialog loads
        setTimeout(() => {
          if (detailsDialog.componentInstance) {
            detailsDialog.componentInstance.openTransferDialog();
          }
        }, 500);
        break;
      
      case 'grv':
        // Open GRV dialog (goods received)
        const grvDialog = this.dialog.open(WarehouseDetailsDialog, {
          width: '90%',
          maxWidth: '1200px',
          data: this.data
        });
        // Auto-open GRV after dialog loads
        setTimeout(() => {
          if (grvDialog.componentInstance) {
            grvDialog.componentInstance.openGRVDialog();
          }
        }, 500);
        break;
    }
  }
}

// Dispatch Dialog Component
@Component({
  selector: 'dispatch-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-header">
      <h2>Order Accept & Dispatch - {{ data.name }}</h2>
      <button mat-icon-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="dialog-content">
      <div class="info-banner">
        <mat-icon>local_shipping</mat-icon>
        <span>Select orders to dispatch from {{ data.name }}</span>
      </div>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading pending orders...</p>
        </div>
      } @else {
        <div class="orders-section">
          <div class="section-header">
            <h3>Pending Orders ({{ pendingOrders.length }})</h3>
            <mat-form-field class="search-field">
              <mat-label>Search orders</mat-label>
              <input matInput [(ngModel)]="searchQuery" (input)="filterOrders()" placeholder="Order number, customer...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
          </div>

          <div class="orders-list">
            @for (order of filteredOrders; track order.id) {
              <div class="order-card" [class.selected]="order.selected">
                <mat-checkbox [(ngModel)]="order.selected" (change)="updateSelection()"></mat-checkbox>
                <div class="order-info">
                  <div class="order-number">{{ order.orderNumber }}</div>
                  <div class="order-customer">{{ order.customerName }}</div>
                  <div class="order-items">{{ order.itemCount }} items</div>
                </div>
                <div class="order-details">
                  <div class="order-date">{{ order.orderDate }}</div>
                  <div class="order-priority" [class.urgent]="order.priority === 'Urgent'">{{ order.priority }}</div>
                </div>
              </div>
            }
            @if (filteredOrders.length === 0) {
              <div class="empty-state">
                <mat-icon>inbox</mat-icon>
                <p>No pending orders found</p>
              </div>
            }
          </div>
        </div>

        @if (selectedCount > 0) {
          <div class="dispatch-section">
            <h3>Dispatch Details</h3>
            <div class="dispatch-form">
              <mat-form-field class="full-width">
                <mat-label>Assign to Vehicle</mat-label>
                <mat-select [(ngModel)]="selectedVehicle">
                  <mat-option value="">Select Vehicle</mat-option>
                  <mat-option value="V001">BK31KFZN - Truck</mat-option>
                  <mat-option value="V002">CT11SJZN - Van</mat-option>
                  <mat-option value="V003">DJ25NRZN - Truck</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field class="full-width">
                <mat-label>Assign to Driver</mat-label>
                <mat-select [(ngModel)]="selectedDriver">
                  <mat-option value="">Select Driver</mat-option>
                  <mat-option value="D001">John Doe</mat-option>
                  <mat-option value="D002">Jane Smith</mat-option>
                  <mat-option value="D003">Mike Johnson</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field class="full-width">
                <mat-label>Dispatch Notes</mat-label>
                <textarea matInput [(ngModel)]="dispatchNotes" rows="3" placeholder="Enter any special instructions..."></textarea>
              </mat-form-field>
            </div>
          </div>
        }
      }
    </div>

    <div class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="selectedCount === 0 || !selectedVehicle || !selectedDriver" (click)="confirmDispatch()">
        <mat-icon>send</mat-icon>
        Dispatch {{ selectedCount }} Order{{ selectedCount !== 1 ? 's' : '' }}
      </button>
    </div>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: rgba(240, 147, 251, 0.1);
      border-left: 4px solid #f093fb;
      border-radius: 8px;
      margin-bottom: 24px;
      color: #f5576c;
      font-weight: 500;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .section-header h3 {
      margin: 0;
      color: #333;
      font-size: 1.1rem;
    }

    .search-field {
      width: 300px;
    }

    .orders-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      max-height: 400px;
      overflow-y: auto;
    }

    .order-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border: 2px solid #e0e0e0;
      border-radius: 12px;
      transition: all 0.2s ease;
      background: white;
    }

    .order-card:hover {
      border-color: #f093fb;
      box-shadow: 0 2px 8px rgba(240, 147, 251, 0.2);
    }

    .order-card.selected {
      border-color: #f5576c;
      background: rgba(245, 87, 108, 0.05);
    }

    .order-info {
      flex: 1;
    }

    .order-number {
      font-weight: 700;
      font-size: 1.1rem;
      color: #333;
    }

    .order-customer {
      color: #666;
      margin-top: 4px;
    }

    .order-items {
      color: #999;
      font-size: 0.9rem;
      margin-top: 4px;
    }

    .order-details {
      text-align: right;
    }

    .order-date {
      color: #666;
      font-size: 0.9rem;
    }

    .order-priority {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 8px;
      background: #e3f2fd;
      color: #2196f3;
    }

    .order-priority.urgent {
      background: #ffebee;
      color: #f44336;
    }

    .dispatch-section {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 2px solid #e0e0e0;
    }

    .dispatch-section h3 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .dispatch-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
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
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      gap: 16px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }
  `]
})
export class DispatchDialog implements OnInit {
  loading = true;
  searchQuery = '';
  pendingOrders: any[] = [];
  filteredOrders: any[] = [];
  selectedCount = 0;
  selectedVehicle = '';
  selectedDriver = '';
  dispatchNotes = '';

  constructor(
    public dialogRef: MatDialogRef<DispatchDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPendingOrders();
  }

  loadPendingOrders(): void {
    // Simulate loading pending orders
    setTimeout(() => {
      this.pendingOrders = [
        { id: 1, orderNumber: 'ORD-2026-001', customerName: 'Acme Corp', itemCount: 5, orderDate: '2026-02-10', priority: 'Normal', selected: false },
        { id: 2, orderNumber: 'ORD-2026-002', customerName: 'Tech Solutions', itemCount: 3, orderDate: '2026-02-11', priority: 'Urgent', selected: false },
        { id: 3, orderNumber: 'ORD-2026-003', customerName: 'Medical Supplies Ltd', itemCount: 8, orderDate: '2026-02-11', priority: 'Normal', selected: false },
      ];
      this.filteredOrders = [...this.pendingOrders];
      this.loading = false;
    }, 1000);
  }

  filterOrders(): void {
    const query = this.searchQuery.toLowerCase();
    this.filteredOrders = this.pendingOrders.filter(order =>
      order.orderNumber.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query)
    );
  }

  updateSelection(): void {
    this.selectedCount = this.pendingOrders.filter(o => o.selected).length;
  }

  confirmDispatch(): void {
    const selectedOrders = this.pendingOrders.filter(o => o.selected).map(o => o.orderNumber).join(', ');
    this.snackBar.open(`Dispatched orders: ${selectedOrders} to vehicle ${this.selectedVehicle}`, 'Close', { duration: 5000 });
    this.dialogRef.close({ dispatched: true });
  }
}

// Scrap Dialog Component
@Component({
  selector: 'scrap-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule
  ],
  template: `
    <div class="dialog-header scrap-header">
      <h2>Scrap Items - {{ data.name }}</h2>
      <button mat-icon-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="dialog-content">
      <div class="info-banner scrap-banner">
        <mat-icon>warning</mat-icon>
        <span>Record damaged or unusable items to remove from inventory</span>
      </div>

      <div class="form-section">
        <mat-form-field class="full-width">
          <mat-label>Search Item</mat-label>
          <input matInput [(ngModel)]="searchQuery" (input)="filterItems()" placeholder="Item code, description...">
          <mat-icon matSuffix>search</mat-icon>
        </mat-form-field>

        @if (filteredItems.length > 0 && searchQuery) {
          <div class="items-dropdown">
            @for (item of filteredItems.slice(0, 5); track item.sku) {
              <div class="item-option" (click)="selectItem(item)">
                <div class="item-name">{{ item.name }}</div>
                <div class="item-sku">{{ item.sku }}</div>
              </div>
            }
          </div>
        }

        @if (selectedItem) {
          <div class="selected-item-card">
            <div class="item-details">
              <h3>{{ selectedItem.name }}</h3>
              <p>SKU: {{ selectedItem.sku }} | Available: {{ selectedItem.quantity }} units</p>
            </div>
            <button mat-icon-button (click)="clearItem()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <mat-form-field class="full-width">
            <mat-label>Quantity to Scrap</mat-label>
            <input matInput type="number" [(ngModel)]="scrapQuantity" min="1" [max]="selectedItem.quantity">
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Reason for Scrapping</mat-label>
            <mat-select [(ngModel)]="scrapReason">
              <mat-option value="damaged">Damaged in Transit</mat-option>
              <mat-option value="expired">Expired</mat-option>
              <mat-option value="defective">Manufacturing Defect</mat-option>
              <mat-option value="contaminated">Contaminated</mat-option>
              <mat-option value="obsolete">Obsolete</mat-option>
              <mat-option value="other">Other</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="full-width">
            <mat-label>Additional Notes</mat-label>
            <textarea matInput [(ngModel)]="notes" rows="3" placeholder="Enter any additional details..."></textarea>
          </mat-form-field>

          <div class="summary-box">
            <h4>Scrap Summary</h4>
            <div class="summary-row">
              <span>Item:</span>
              <strong>{{ selectedItem.name }}</strong>
            </div>
            <div class="summary-row">
              <span>Quantity:</span>
              <strong>{{ scrapQuantity }} units</strong>
            </div>
            <div class="summary-row">
              <span>New Balance:</span>
              <strong>{{ selectedItem.quantity - scrapQuantity }} units</strong>
            </div>
          </div>
        }
      </div>
    </div>

    <div class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="warn" [disabled]="!selectedItem || scrapQuantity <= 0 || !scrapReason" (click)="confirmScrap()">
        <mat-icon>delete_sweep</mat-icon>
        Record Scrap
      </button>
    </div>
  `,
  styles: [`
    .scrap-header {
      background: linear-gradient(135deg, #fc6767 0%, #ec008c 100%) !important;
    }

    .scrap-banner {
      background: rgba(252, 103, 103, 0.1) !important;
      border-left-color: #fc6767 !important;
      color: #ec008c !important;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 500;
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .items-dropdown {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      max-height: 200px;
      overflow-y: auto;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .item-option {
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
    }

    .item-option:hover {
      background: #f5f5f5;
    }

    .item-name {
      font-weight: 600;
      color: #333;
    }

    .item-sku {
      font-size: 0.9rem;
      color: #666;
      margin-top: 4px;
    }

    .selected-item-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border: 2px solid #fc6767;
    }

    .item-details h3 {
      margin: 0 0 8px 0;
      color: #333;
    }

    .item-details p {
      margin: 0;
      color: #666;
      font-size: 0.9rem;
    }

    .summary-box {
      padding: 16px;
      background: #fff3e0;
      border-radius: 8px;
      border-left: 4px solid #ff9800;
    }

    .summary-box h4 {
      margin: 0 0 12px 0;
      color: #f57c00;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #ffe0b2;
    }

    .summary-row:last-child {
      border-bottom: none;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class ScrapDialog implements OnInit {
  searchQuery = '';
  selectedItem: any = null;
  scrapQuantity = 1;
  scrapReason = '';
  notes = '';
  filteredItems: any[] = [];
  allItems: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<ScrapDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Load items from warehouse
    this.allItems = [
      { sku: 'ITM-001', name: 'Medical Gloves Box', quantity: 150 },
      { sku: 'ITM-002', name: 'Surgical Masks (50pk)', quantity: 200 },
      { sku: 'ITM-003', name: 'Hand Sanitizer 500ml', quantity: 85 },
    ];
  }

  filterItems(): void {
    const query = this.searchQuery.toLowerCase();
    if (!query) {
      this.filteredItems = [];
      return;
    }
    this.filteredItems = this.allItems.filter(item =>
      item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query)
    );
  }

  selectItem(item: any): void {
    this.selectedItem = item;
    this.searchQuery = item.name;
    this.filteredItems = [];
    this.scrapQuantity = 1;
  }

  clearItem(): void {
    this.selectedItem = null;
    this.searchQuery = '';
    this.scrapQuantity = 1;
  }

  confirmScrap(): void {
    this.snackBar.open(
      `Scrapped ${this.scrapQuantity} units of ${this.selectedItem.name}. Reason: ${this.scrapReason}`,
      'Close',
      { duration: 5000 }
    );
    this.dialogRef.close({ scrapped: true });
  }
}

// Stock Take Dialog Component
@Component({
  selector: 'stock-take-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule
  ],
  template: `
    <div class="dialog-header stocktake-header">
      <h2>Stock Take - {{ data.name }}</h2>
      <button mat-icon-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="dialog-content">
      <div class="info-banner stocktake-banner">
        <mat-icon>fact_check</mat-icon>
        <span>Perform physical count and compare with system inventory</span>
      </div>

      <div class="stocktake-table">
        <table mat-table [dataSource]="items" class="full-width-table">
          <ng-container matColumnDef="sku">
            <th mat-header-cell *matHeaderCellDef>SKU</th>
            <td mat-cell *matCellDef="let item">{{ item.sku }}</td>
          </ng-container>

          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Item Name</th>
            <td mat-cell *matCellDef="let item">{{ item.name }}</td>
          </ng-container>

          <ng-container matColumnDef="systemQty">
            <th mat-header-cell *matHeaderCellDef>System Qty</th>
            <td mat-cell *matCellDef="let item">{{ item.systemQty }}</td>
          </ng-container>

          <ng-container matColumnDef="countedQty">
            <th mat-header-cell *matHeaderCellDef>Counted Qty</th>
            <td mat-cell *matCellDef="let item">
              <mat-form-field class="qty-field">
                <input matInput type="number" [(ngModel)]="item.countedQty" (input)="calculateVariance(item)" min="0">
              </mat-form-field>
            </td>
          </ng-container>

          <ng-container matColumnDef="variance">
            <th mat-header-cell *matHeaderCellDef>Variance</th>
            <td mat-cell *matCellDef="let item">
              <span [class]="getVarianceClass(item.variance)">
                {{ item.variance > 0 ? '+' : '' }}{{ item.variance }}
              </span>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
        </table>
      </div>

      @if (hasVariances()) {
        <div class="summary-section">
          <h3>Stock Take Summary</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">{{ getTotalItems() }}</div>
              <div class="stat-label">Items Counted</div>
            </div>
            <div class="stat-card positive">
              <div class="stat-value">{{ getPositiveVariances() }}</div>
              <div class="stat-label">Overages</div>
            </div>
            <div class="stat-card negative">
              <div class="stat-value">{{ getNegativeVariances() }}</div>
              <div class="stat-label">Shortages</div>
            </div>
          </div>
        </div>
      }
    </div>

    <div class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!hasVariances()" (click)="submitStockTake()">
        <mat-icon>save</mat-icon>
        Submit Stock Take
      </button>
    </div>
  `,
  styles: [`
    .stocktake-header {
      background: linear-gradient(135deg, #f77062 0%, #fe5196 100%) !important;
    }

    .stocktake-banner {
      background: rgba(247, 112, 98, 0.1) !important;
      border-left-color: #f77062 !important;
      color: #fe5196 !important;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
      max-height: 70vh;
      overflow-y: auto;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 500;
    }

    .stocktake-table {
      margin-bottom: 24px;
    }

    .full-width-table {
      width: 100%;
    }

    .qty-field {
      width: 100px;
      margin-bottom: -1.25em;
    }

    .qty-field input {
      text-align: center;
      font-weight: 600;
    }

    .variance-positive {
      color: #4caf50;
      font-weight: 700;
    }

    .variance-negative {
      color: #f44336;
      font-weight: 700;
    }

    .variance-zero {
      color: #999;
    }

    .summary-section {
      padding: 20px;
      background: #f5f5f5;
      border-radius: 12px;
    }

    .summary-section h3 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    .stat-card {
      padding: 16px;
      background: white;
      border-radius: 8px;
      text-align: center;
      border: 2px solid #e0e0e0;
    }

    .stat-card.positive {
      border-color: #4caf50;
      background: #f1f8f4;
    }

    .stat-card.negative {
      border-color: #f44336;
      background: #fef1f1;
    }

    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #333;
    }

    .stat-label {
      font-size: 0.9rem;
      color: #666;
      margin-top: 4px;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class StockTakeDialog implements OnInit {
  displayedColumns = ['sku', 'name', 'systemQty', 'countedQty', 'variance'];
  items: any[] = [];

  constructor(
    public dialogRef: MatDialogRef<StockTakeDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.items = [
      { sku: 'ITM-001', name: 'Medical Gloves Box', systemQty: 150, countedQty: 150, variance: 0 },
      { sku: 'ITM-002', name: 'Surgical Masks (50pk)', systemQty: 200, countedQty: 200, variance: 0 },
      { sku: 'ITM-003', name: 'Hand Sanitizer 500ml', systemQty: 85, countedQty: 85, variance: 0 },
      { sku: 'ITM-004', name: 'Disposable Gowns', systemQty: 120, countedQty: 120, variance: 0 },
    ];
  }

  calculateVariance(item: any): void {
    item.variance = (item.countedQty || 0) - item.systemQty;
  }

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'variance-positive';
    if (variance < 0) return 'variance-negative';
    return 'variance-zero';
  }

  hasVariances(): boolean {
    return this.items.some(item => item.variance !== 0);
  }

  getTotalItems(): number {
    return this.items.filter(item => item.countedQty !== null && item.countedQty !== item.systemQty).length;
  }

  getPositiveVariances(): number {
    return this.items.filter(item => item.variance > 0).length;
  }

  getNegativeVariances(): number {
    return this.items.filter(item => item.variance < 0).length;
  }

  submitStockTake(): void {
    this.snackBar.open(`Stock take completed. ${this.getTotalItems()} items adjusted.`, 'Close', { duration: 5000 });
    this.dialogRef.close({ submitted: true });
  }
}

// Repackaging Dialog Component
@Component({
  selector: 'repackaging-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  template: `
    <div class="dialog-header repack-header">
      <h2>Repackaging - {{ data.name }}</h2>
      <button mat-icon-button (click)="dialogRef.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <div class="dialog-content">
      <div class="info-banner repack-banner">
        <mat-icon>inventory</mat-icon>
        <span>Change item packaging or split bulk items into smaller units</span>
      </div>

      <div class="form-section">
        <mat-form-field class="full-width">
          <mat-label>Select Item to Repackage</mat-label>
          <mat-select [(ngModel)]="selectedItem" (selectionChange)="onItemSelect()">
            <mat-option [value]="null">-- Select Item --</mat-option>
            @for (item of items; track item.sku) {
              <mat-option [value]="item">{{ item.name }} ({{ item.sku }})</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (selectedItem) {
          <div class="current-package-card">
            <h3>Current Package</h3>
            <div class="package-details">
              <div class="detail-row">
                <span>Item:</span>
                <strong>{{ selectedItem.name }}</strong>
              </div>
              <div class="detail-row">
                <span>Current Qty:</span>
                <strong>{{ selectedItem.quantity }} {{ selectedItem.unit }}</strong>
              </div>
              <div class="detail-row">
                <span>Package Size:</span>
                <strong>{{ selectedItem.packageSize }} {{ selectedItem.unit }}/package</strong>
              </div>
            </div>
          </div>

          <div class="repackage-section">
            <h3>New Packaging</h3>
            
            <mat-form-field class="full-width">
              <mat-label>Repackage Type</mat-label>
              <mat-select [(ngModel)]="repackType">
                <mat-option value="split">Split into Smaller Units</mat-option>
                <mat-option value="combine">Combine into Larger Units</mat-option>
                <mat-option value="repack">Change Package Size</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>New Package Size</mat-label>
              <input matInput type="number" [(ngModel)]="newPackageSize" min="1">
              <span matSuffix>{{ selectedItem.unit }}/package</span>
            </mat-form-field>

            <mat-form-field class="full-width">
              <mat-label>Number of Units to Repackage</mat-label>
              <input matInput type="number" [(ngModel)]="unitsToRepack" min="1" [max]="selectedItem.quantity">
              <span matSuffix>{{ selectedItem.unit }}</span>
            </mat-form-field>

            <div class="calculation-card">
              <h4>Repackaging Result</h4>
              <div class="calc-row">
                <span>Original Packages:</span>
                <strong>{{ getOriginalPackages() }}</strong>
              </div>
              <div class="calc-row">
                <span>New Packages:</span>
                <strong class="highlight">{{ getNewPackages() }}</strong>
              </div>
              <div class="calc-row">
                <span>Remaining Units:</span>
                <strong>{{ getRemainingUnits() }} {{ selectedItem.unit }}</strong>
              </div>
            </div>
          </div>
        }
      </div>
    </div>

    <div class="dialog-actions">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-raised-button color="primary" [disabled]="!selectedItem || !newPackageSize || !unitsToRepack" (click)="confirmRepackage()">
        <mat-icon>published_with_changes</mat-icon>
        Confirm Repackaging
      </button>
    </div>
  `,
  styles: [`
    .repack-header {
      background: linear-gradient(135deg, #fccb90 0%, #d57eeb 100%) !important;
    }

    .repack-banner {
      background: rgba(252, 203, 144, 0.1) !important;
      border-left-color: #fccb90 !important;
      color: #d57eeb !important;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      color: white;
      margin: -24px -24px 0 -24px;
    }

    .dialog-header h2 {
      margin: 0;
      font-size: 1.3rem;
      font-weight: 600;
    }

    .dialog-header button {
      color: white;
    }

    .dialog-content {
      padding: 24px;
    }

    .info-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 24px;
      font-weight: 500;
    }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .full-width {
      width: 100%;
    }

    .current-package-card {
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      border-left: 4px solid #fccb90;
    }

    .current-package-card h3 {
      margin: 0 0 12px 0;
      color: #333;
      font-size: 1rem;
    }

    .package-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }

    .detail-row span {
      color: #666;
    }

    .repackage-section h3 {
      margin: 16px 0 12px 0;
      color: #333;
      font-size: 1rem;
    }

    .calculation-card {
      padding: 16px;
      background: linear-gradient(135deg, rgba(252, 203, 144, 0.1) 0%, rgba(213, 126, 235, 0.1) 100%);
      border-radius: 8px;
      border: 2px solid #d57eeb;
    }

    .calculation-card h4 {
      margin: 0 0 12px 0;
      color: #d57eeb;
    }

    .calc-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(213, 126, 235, 0.2);
    }

    .calc-row:last-child {
      border-bottom: none;
    }

    .calc-row .highlight {
      color: #d57eeb;
      font-size: 1.2rem;
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e0e0e0;
    }
  `]
})
export class RepackagingDialog implements OnInit {
  items: any[] = [];
  selectedItem: any = null;
  repackType = '';
  newPackageSize = 0;
  unitsToRepack = 0;

  constructor(
    public dialogRef: MatDialogRef<RepackagingDialog>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.items = [
      { sku: 'ITM-001', name: 'Medical Gloves', quantity: 1000, unit: 'pairs', packageSize: 100 },
      { sku: 'ITM-002', name: 'Surgical Masks', quantity: 5000, unit: 'units', packageSize: 50 },
      { sku: 'ITM-003', name: 'Hand Sanitizer', quantity: 500, unit: 'ml', packageSize: 500 },
    ];
  }

  onItemSelect(): void {
    this.newPackageSize = this.selectedItem?.packageSize || 0;
    this.unitsToRepack = 0;
  }

  getOriginalPackages(): number {
    if (!this.selectedItem || !this.unitsToRepack) return 0;
    return Math.floor(this.unitsToRepack / this.selectedItem.packageSize);
  }

  getNewPackages(): number {
    if (!this.selectedItem || !this.unitsToRepack || !this.newPackageSize) return 0;
    return Math.floor(this.unitsToRepack / this.newPackageSize);
  }

  getRemainingUnits(): number {
    if (!this.selectedItem || !this.unitsToRepack || !this.newPackageSize) return 0;
    return this.unitsToRepack % this.newPackageSize;
  }

  confirmRepackage(): void {
    this.snackBar.open(
      `Repackaged ${this.unitsToRepack} ${this.selectedItem.unit} of ${this.selectedItem.name} into ${this.getNewPackages()} packages`,
      'Close',
      { duration: 5000 }
    );
    this.dialogRef.close({ repackaged: true });
  }
}


