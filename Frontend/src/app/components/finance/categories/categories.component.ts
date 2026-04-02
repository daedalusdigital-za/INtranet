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
import { FinanceCategory } from '../../../models/finance.model';

@Component({
  selector: 'app-categories',
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
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {
  categories: FinanceCategory[] = [];
  loading = false;
  displayedColumns: string[] = ['name', 'code', 'type', 'status', 'actions'];

  constructor(
    private financeService: FinanceService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.loading = true;
    this.financeService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading categories:', error);
        this.snackBar.open('Failed to load categories', 'Close', { duration: 3000 });
        this.loading = false;
      }
    });
  }

  getTypeColor(type: string): string {
    const typeMap: { [key: string]: string } = {
      'income': 'accent',
      'expense': 'warn',
      'both': 'primary'
    };
    return typeMap[type.toLowerCase()] || 'default';
  }

  deleteCategory(category: FinanceCategory): void {
    if (confirm(`Are you sure you want to delete category "${category.name}"?`)) {
      this.financeService.deleteCategory(category.id).subscribe({
        next: () => {
          this.snackBar.open('Category deleted successfully', 'Close', { duration: 3000 });
          this.loadCategories();
        },
        error: (error) => {
          console.error('Error deleting category:', error);
          this.snackBar.open('Failed to delete category', 'Close', { duration: 3000 });
        }
      });
    }
  }
}
