import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { FinanceService } from '../../services/finance.service';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule
  ],
  templateUrl: './finance.component.html',
  styleUrls: ['./finance.component.scss']
})
export class FinanceComponent implements OnInit {
  stats = {
    totalBudget: 0,
    totalSpent: 0,
    pendingExpenses: 0,
    pendingPayments: 0
  };

  constructor(private financeService: FinanceService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    // Load summary statistics
    this.financeService.getBudgets().subscribe(budgets => {
      this.stats.totalBudget = budgets.reduce((sum, b) => sum + b.totalBudget, 0);
      this.stats.totalSpent = budgets.reduce((sum, b) => sum + b.spentAmount, 0);
    });

    this.financeService.getExpenses('Pending').subscribe(expenses => {
      this.stats.pendingExpenses = expenses.length;
    });

    this.financeService.getPayments('Pending').subscribe(payments => {
      this.stats.pendingPayments = payments.length;
    });
  }
}
