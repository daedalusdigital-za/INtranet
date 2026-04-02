import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FinanceService } from '../../../services/finance.service';
import { PurchaseOrder } from '../../../models/finance.model';

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatMenuModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './purchase-orders.component.html',
  styleUrls: ['./purchase-orders.component.scss']
})
export class PurchaseOrdersComponent implements OnInit {
  purchaseOrders: PurchaseOrder[] = [];
  loading = false;
  displayedColumns: string[] = ['orderNumber', 'supplier', 'orderDate', 'totalAmount', 'status', 'delivery', 'actions'];

  constructor(
    private financeService: FinanceService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPurchaseOrders();
  }

  loadPurchaseOrders(): void {
    this.loading = true;
    this.financeService.getPurchaseOrders().subscribe({
      next: (orders) => {
        this.purchaseOrders = orders;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading purchase orders:', error);
        this.snackBar.open('Failed to load purchase orders', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getStatusColor(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Draft': 'default',
      'Submitted': 'primary',
      'Approved': 'accent',
      'Ordered': 'primary',
      'Partially Received': 'warn',
      'Received': 'accent',
      'Completed': 'accent',
      'Cancelled': 'warn'
    };
    return statusMap[status] || 'default';
  }

  getDeliveryStatus(po: PurchaseOrder): string {
    if (!po.items || po.items.length === 0) return 'No items';
    
    const totalOrdered = po.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalReceived = po.items.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0);
    
    if (totalReceived === 0) return 'Pending';
    if (totalReceived < totalOrdered) return `${totalReceived}/${totalOrdered} received`;
    return 'Complete';
  }

  deletePurchaseOrder(po: PurchaseOrder): void {
    if (confirm(`Are you sure you want to delete purchase order "${po.poNumber}"?`)) {
      this.financeService.deletePurchaseOrder(po.id).subscribe({
        next: () => {
          this.snackBar.open('Purchase order deleted successfully', 'Close', { duration: 3000 });
          this.loadPurchaseOrders();
        },
        error: (error) => {
          console.error('Error deleting purchase order:', error);
          this.snackBar.open('Failed to delete purchase order', 'Close', { duration: 3000 });
        }
      });
    }
  }
}
