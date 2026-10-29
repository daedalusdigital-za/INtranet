import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FinanceService } from '../../../services/finance.service';
import { Budget } from '../../../models/finance.model';
import { ConfirmService } from '../../../ui/confirm.service';
import { ToastService } from '../../../ui/toast.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { SkeletonRowsComponent } from '../../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../../ui/empty-state/empty-state.component';
import { ChipTone, StatusChipComponent } from '../../../ui/status-chip/status-chip.component';
import { formatMoney } from '../../../ui/data-table/data-table.component';

const STATUS_TONES: Record<string, ChipTone> = {
  'Draft': 'neutral',
  'Active': 'ok',
  'Closed': 'neutral',
  'OverBudget': 'danger'
};

@Component({
  selector: 'app-budgets',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatMenuModule,
    MatProgressBarModule,
    NavbarComponent,
    PageHeaderComponent,
    SkeletonRowsComponent,
    EmptyStateComponent,
    StatusChipComponent
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
    private readonly confirmDialog: ConfirmService,
    private readonly toast: ToastService
  ) {}

  /** "R 1 200 000,00 budgeted · R 640 000,00 spent · 1 over budget" for the header. */
  get summary(): string {
    if (!this.budgets.length) return 'Fiscal year budgets and allocations';
    const total = this.budgets.reduce((sum, b) => sum + (b.totalBudget || 0), 0);
    const spent = this.budgets.reduce((sum, b) => sum + (b.spentAmount || 0), 0);
    const over = this.budgets.filter(b => b.remainingAmount < 0).length;
    return `${formatMoney(total)} budgeted · ${formatMoney(spent)} spent` + (over ? ` · ${over} over budget` : '');
  }

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
        this.toast.error("Couldn't load budgets. Refresh the page to try again.");
        this.loading = false;
      }
    });
  }

  getStatusTone(status: string): ChipTone | undefined {
    return STATUS_TONES[status];
  }

  getProgressPercentage(budget: Budget): number {
    return budget.totalBudget > 0 ? (budget.spentAmount / budget.totalBudget) * 100 : 0;
  }

  getProgressColor(percentage: number): string {
    if (percentage >= 90) return 'warn';
    if (percentage >= 75) return 'accent';
    return 'primary';
  }

  async deleteBudget(budget: Budget): Promise<void> {
    if (await this.confirmDialog.ask({
      title: `Delete budget "${budget.name}"?`,
      confirmText: 'Delete budget',
      danger: true
    })) {
      this.financeService.deleteBudget(budget.id).subscribe({
        next: () => {
          this.toast.done(`Budget "${budget.name}" deleted`);
          this.loadBudgets();
        },
        error: (error) => {
          console.error('Error deleting budget:', error);
          this.toast.error(`Couldn't delete "${budget.name}". Try again.`);
        }
      });
    }
  }
}
