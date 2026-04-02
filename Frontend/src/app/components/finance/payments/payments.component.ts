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
import { Payment } from '../../../models/finance.model';

@Component({
  selector: 'app-payments',
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
  templateUrl: './payments.component.html',
  styleUrls: ['./payments.component.scss']
})
export class PaymentsComponent implements OnInit {
  payments: Payment[] = [];
  loading = false;
  displayedColumns: string[] = ['paymentNumber', 'payee', 'amount', 'paymentDate', 'method', 'status', 'actions'];

  constructor(
    private financeService: FinanceService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

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
        this.snackBar.open('Failed to load payments', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getStatusColor(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Pending': 'default',
      'Processing': 'primary',
      'Completed': 'accent',
      'Failed': 'warn',
      'Cancelled': 'warn'
    };
    return statusMap[status] || 'default';
  }

  getLinkedEntityInfo(payment: Payment): string {
    if (payment.expenseNumber) return `Expense: ${payment.expenseNumber}`;
    if (payment.purchaseOrderNumber) return `PO: ${payment.purchaseOrderNumber}`;
    if (payment.bookInvoiceId) return `Invoice: ${payment.bookInvoiceId}`;
    return 'No linked entity';
  }

  deletePayment(payment: Payment): void {
    if (confirm(`Are you sure you want to delete payment "${payment.paymentNumber}"?`)) {
      this.financeService.deletePayment(payment.id).subscribe({
        next: () => {
          this.snackBar.open('Payment deleted successfully', 'Close', { duration: 3000 });
          this.loadPayments();
        },
        error: (error) => {
          console.error('Error deleting payment:', error);
          this.snackBar.open('Failed to delete payment', 'Close', { duration: 3000 });
        }
      });
    }
  }
}
