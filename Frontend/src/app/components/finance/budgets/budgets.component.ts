import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FinanceService } from '../../../services/finance.service';
import { Budget } from '../../../models/finance.model';

@Component({
  selector: 'app-budgets',
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
    MatProgressBarModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './budgets.component.html',
  styleUrls: ['./budgets.component.scss']
})
export class BudgetsComponent implements OnInit {
  budgets: Budget[] = [];
  loading = false;
  displayedColumns: string[] = ['name', 'fiscalYear', 'department', 'totalBudget', 'spent', 'remaining', 'status', 'actions'];

  constructor(
    private financeService: FinanceService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadBudgets();
  }

  loadBudgets(): void {
    this.loading = true;
    this.financeService.getBudgets().subscribe({
      next: (budgets) => {
        this.budgets = budgets;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading budgets:', error);
        this.snackBar.open('Failed to load budgets', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getStatusColor(status: string): string {
    const statusMap: { [key: string]: string } = {
      'Draft': 'default',
      'Active': 'primary',
      'Closed': 'accent',
      'OverBudget': 'warn'
    };
    return statusMap[status] || 'default';
  }

  getProgressPercentage(budget: Budget): number {
    return budget.totalBudget > 0 ? (budget.spentAmount / budget.totalBudget) * 100 : 0;
  }

  getProgressColor(percentage: number): string {
    if (percentage >= 90) return 'warn';
    if (percentage >= 75) return 'accent';
    return 'primary';
  }

  deleteBudget(budget: Budget): void {
    if (confirm(`Are you sure you want to delete budget "${budget.name}"?`)) {
      this.financeService.deleteBudget(budget.id).subscribe({
        next: () => {
          this.snackBar.open('Budget deleted successfully', 'Close', { duration: 3000 });
          this.loadBudgets();
        },
        error: (error) => {
          console.error('Error deleting budget:', error);
          this.snackBar.open('Failed to delete budget', 'Close', { duration: 3000 });
        }
      });
    }
  }
}
