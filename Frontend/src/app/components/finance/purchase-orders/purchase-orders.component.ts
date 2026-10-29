import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FinanceService } from '../../../services/finance.service';
import { PurchaseOrder } from '../../../models/finance.model';
import { ConfirmService } from '../../../ui/confirm.service';
import { ToastService } from '../../../ui/toast.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { DataTableComponent, RowAction, TableColumn, TableView, formatMoney } from '../../../ui/data-table/data-table.component';
import { ChipTone } from '../../../ui/status-chip/status-chip.component';

const STATUS_TONES: Record<string, ChipTone> = {
  'Draft': 'neutral',
  'Submitted': 'warn',
  'Approved': 'ok',
  'Ordered': 'info',
  'Partially Received': 'warn',
  'Received': 'ok',
  'Completed': 'ok',
  'Cancelled': 'danger'
};

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule, NavbarComponent, PageHeaderComponent, DataTableComponent],
  templateUrl: './purchase-orders.component.html',
  styleUrls: ['./purchase-orders.component.scss']
})
export class PurchaseOrdersComponent implements OnInit {
  purchaseOrders: PurchaseOrder[] = [];
  loading = false;

  readonly rowKey = (po: PurchaseOrder) => po.id;

  readonly columns: TableColumn<PurchaseOrder>[] = [
    { key: 'po', label: 'PO number', type: 'ref', value: po => po.poNumber },
    { key: 'supplier', label: 'Supplier', value: po => po.supplierName, sub: po => po.department },
    { key: 'category', label: 'Category', value: po => po.categoryName, hidden: true },
    { key: 'ordered', label: 'Ordered', type: 'date', value: po => po.orderDate },
    { key: 'due', label: 'Delivery due', type: 'date', value: po => po.expectedDeliveryDate },
    { key: 'total', label: 'Total', type: 'money', value: po => po.total,
      sub: po => po.items?.length ? `${po.items.length} item${po.items.length === 1 ? '' : 's'}` : null },
    { key: 'status', label: 'Status', type: 'status', value: po => po.status, tone: po => STATUS_TONES[po.status] },
    { key: 'delivery', label: 'Received', value: po => this.getDeliveryStatus(po) },
    { key: 'requestedBy', label: 'Requested by', value: po => po.requestedBy, hidden: true }
  ];

  readonly views: TableView<PurchaseOrder>[] = [
    { id: 'all', label: 'All' },
    { id: 'approval', label: 'Waiting for approval', filter: po => po.status === 'Draft' || po.status === 'Submitted' },
    { id: 'open', label: 'Ordered, not received', filter: po => po.status === 'Ordered' || po.status === 'Partially Received' },
    { id: 'late', label: 'Delivery overdue', filter: po => this.isLate(po) },
    { id: 'done', label: 'Received', filter: po => po.status === 'Received' || po.status === 'Completed' }
  ];

  readonly rowActions: RowAction<PurchaseOrder>[] = [
    { label: 'Delete purchase order', icon: 'delete', danger: true, run: po => this.deletePurchaseOrder(po) }
  ];

  constructor(
    private financeService: FinanceService,
    private readonly confirmDialog: ConfirmService,
    private readonly toast: ToastService
  ) {}

  /** "12 open orders worth R 184 300,00" for the header. */
  get summary(): string {
    const open = this.purchaseOrders.filter(po => !['Received', 'Completed', 'Cancelled'].includes(po.status));
    if (!this.purchaseOrders.length) return 'Supplier purchase orders';
    const value = open.reduce((sum, po) => sum + (po.total || 0), 0);
    return `${open.length} open ${open.length === 1 ? 'order' : 'orders'} worth ${formatMoney(value)}`;
  }

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
        this.toast.error("Couldn't load purchase orders. Refresh the page to try again.");
        this.loading = false;
      }
    });
  }

  getDeliveryStatus(po: PurchaseOrder): string {
    if (!po.items || po.items.length === 0) return 'No items';

    const totalOrdered = po.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalReceived = po.items.reduce((sum, item) => sum + (item.receivedQuantity || 0), 0);

    if (totalReceived === 0) return 'Nothing yet';
    if (totalReceived < totalOrdered) return `${totalReceived} of ${totalOrdered}`;
    return 'All';
  }

  private isLate(po: PurchaseOrder): boolean {
    if (!po.expectedDeliveryDate || ['Received', 'Completed', 'Cancelled'].includes(po.status)) return false;
    const due = new Date(po.expectedDeliveryDate);
    due.setHours(23, 59, 59, 999);
    return due < new Date();
  }

  async deletePurchaseOrder(po: PurchaseOrder): Promise<void> {
    if (await this.confirmDialog.ask({
      title: `Delete purchase order ${po.poNumber}?`,
      message: `The order to ${po.supplierName} for ${formatMoney(po.total || 0)} is removed. This can't be undone.`,
      confirmText: 'Delete purchase order',
      cancelText: 'Keep it',
      danger: true
    })) {
      this.financeService.deletePurchaseOrder(po.id).subscribe({
        next: () => {
          this.toast.done(`Purchase order ${po.poNumber} deleted`);
          this.loadPurchaseOrders();
        },
        error: (error) => {
          console.error('Error deleting purchase order:', error);
          this.toast.error(`Couldn't delete ${po.poNumber}. Try again.`);
        }
      });
    }
  }
}
