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
import { Expense } from '../../../models/finance.model';

@Component({
  selector: 'app-expenses',
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
  templateUrl: './expenses.component.html',
  styleUrls: ['./expenses.component.scss']
})
export class ExpensesComponent implements OnInit {
  expenses: Expense[] = [];
  loading = false;
  displayedColumns: string[] = ['expenseNumber', 'description', 'vendor', 'amount', 'expenseDate', 'status', 'actions'];

  constructor(
    private financeService: FinanceService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadExpenses();
  }

  loadExpenses(): void {
    this.loading = true;
    this.financeService.getExpenses().subscribe({
      next: (expenses) => {
        this.expenses = expenses;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading expenses:', error);
        this.snackBar.open('Failed to load expenses', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getStatusColor(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Pending': 'default',
      'Approved': 'primary',
      'Rejected': 'warn',
      'Paid': 'accent',
      'Reimbursed': 'accent'
    };
    return statusMap[status] || 'default';
  }

  deleteExpense(expense: Expense): void {
    if (confirm(`Are you sure you want to delete expense "${expense.expenseNumber}"?`)) {
      this.financeService.deleteExpense(expense.id).subscribe({
        next: () => {
          this.snackBar.open('Expense deleted successfully', 'Close', { duration: 3000 });
          this.loadExpenses();
        },
        error: (error) => {
          console.error('Error deleting expense:', error);
          this.snackBar.open('Failed to delete expense', 'Close', { duration: 3000 });
        }
      });
    }
  }
}
