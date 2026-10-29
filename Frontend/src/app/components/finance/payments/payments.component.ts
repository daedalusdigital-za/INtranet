import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FinanceService } from '../../../services/finance.service';
import { Payment } from '../../../models/finance.model';
import { ConfirmService } from '../../../ui/confirm.service';
import { ToastService } from '../../../ui/toast.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { DataTableComponent, RowAction, TableColumn, TableView, formatMoney } from '../../../ui/data-table/data-table.component';
import { ChipTone } from '../../../ui/status-chip/status-chip.component';

const STATUS_TONES: Record<string, ChipTone> = {
  'Pending': 'warn',
  'Processing': 'info',
  'Completed': 'ok',
  'Failed': 'danger',
  'Cancelled': 'neutral'
};

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule, NavbarComponent, PageHeaderComponent, DataTableComponent],
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.scss']
})
export class PaymentsComponent implements OnInit {
  payments: Payment[] = [];
  loading = false;

  readonly rowKey = (p: Payment) => p.id;

  readonly columns: TableColumn<Payment>[] = [
    { key: 'number', label: 'Payment', type: 'ref', value: p => p.paymentNumber, sub: p => this.getLinkedEntityInfo(p) },
    { key: 'payee', label: 'Payee', value: p => p.payee, sub: p => p.description },
    { key: 'amount', label: 'Amount', type: 'money', value: p => p.amount },
    { key: 'date', label: 'Paid on', type: 'date', value: p => p.paymentDate },
    { key: 'method', label: 'Method', value: p => p.paymentMethod, sub: p => p.paymentReference ? `Ref ${p.paymentReference}` : null },
    { key: 'status', label: 'Status', type: 'status', value: p => p.status, tone: p => STATUS_TONES[p.status] },
    { key: 'type', label: 'For', value: p => p.paymentType, hidden: true },
    { key: 'approvedBy', label: 'Approved by', value: p => p.approvedBy, hidden: true },
    { key: 'bankRef', label: 'Bank reference', type: 'ref', value: p => p.bankReference, hidden: true }
  ];

  readonly views: TableView<Payment>[] = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending', filter: p => p.status === 'Pending' || p.status === 'Processing' },
    { id: 'failed', label: 'Failed', filter: p => p.status === 'Failed' },
    { id: 'month', label: 'This month', filter: p => this.isThisMonth(p.paymentDate) },
    { id: 'done', label: 'Completed', filter: p => p.status === 'Completed' }
  ];

  readonly rowActions: RowAction<Payment>[] = [
    { label: 'Delete payment', icon: 'delete', danger: true, run: p => this.deletePayment(p) }
  ];

  constructor(
    private financeService: FinanceService,
    private readonly confirmDialog: ConfirmService,
    private readonly toast: ToastService
  ) {}

  /** "R 52 100,00 paid this month · 3 pending" for the header. */
  get summary(): string {
    if (!this.payments.length) return 'Payments and transactions';
    const month = this.payments
      .filter(p => p.status === 'Completed' && this.isThisMonth(p.paymentDate))
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const pending = this.payments.filter(p => p.status === 'Pending' || p.status === 'Processing').length;
    return `${formatMoney(month)} paid this month` + (pending ? ` · ${pending} pending` : '');
  }

  ngOnInit(): void {
    this.loadPayments();
  }

  loadPayments(): void {
    this.loading = true;
    this.financeService.getPayments().subscribe({
      next: (payments) => {
        this.payments = payments;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading payments:', error);
        this.toast.error("Couldn't load payments. Refresh the page to try again.");
        this.loading = false;
      }
    });
  }

  getLinkedEntityInfo(payment: Payment): string | null {
    if (payment.expenseNumber) return `Expense ${payment.expenseNumber}`;
    if (payment.purchaseOrderNumber) return `PO ${payment.purchaseOrderNumber}`;
    if (payment.bookInvoiceId) return `Invoice ${payment.bookInvoiceId}`;
    return null;
  }

  private isThisMonth(value: Date | string | undefined): boolean {
    if (!value) return false;
    const d = new Date(value), now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }

  async deletePayment(payment: Payment): Promise<void> {
    if (await this.confirmDialog.ask({
      title: `Delete payment ${payment.paymentNumber}?`,
      message: `The ${formatMoney(payment.amount || 0)} payment to ${payment.payee} is removed. This can't be undone.`,
      confirmText: 'Delete payment',
      cancelText: 'Keep it',
      danger: true
    })) {
      this.financeService.deletePayment(payment.id).subscribe({
        next: () => {
          this.toast.done(`Payment ${payment.paymentNumber} deleted`);
          this.loadPayments();
        },
        error: (error) => {
          console.error('Error deleting payment:', error);
          this.toast.error(`Couldn't delete ${payment.paymentNumber}. Try again.`);
        }
      });
    }
  }
}
