import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FinanceService } from '../../../services/finance.service';
import { FinanceCategory } from '../../../models/finance.model';
import { ConfirmService } from '../../../ui/confirm.service';
import { ToastService } from '../../../ui/toast.service';
import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { DataTableComponent, RowAction, TableColumn, TableView } from '../../../ui/data-table/data-table.component';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [RouterModule, MatButtonModule, MatIconModule, NavbarComponent, PageHeaderComponent, DataTableComponent],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {
  categories: FinanceCategory[] = [];
  loading = false;

  readonly rowKey = (c: FinanceCategory) => c.id;

  readonly columns: TableColumn<FinanceCategory>[] = [
    { key: 'name', label: 'Name', value: c => c.name, sub: c => c.description },
    { key: 'code', label: 'Code', type: 'ref', value: c => c.code },
    { key: 'type', label: 'Type', value: c => this.typeLabel(c.type) },
    { key: 'status', label: 'Status', type: 'status', value: c => c.isActive ? 'Active' : 'Inactive', tone: c => c.isActive ? 'ok' : 'neutral' }
  ];

  readonly views: TableView<FinanceCategory>[] = [
    { id: 'all', label: 'All' },
    { id: 'income', label: 'Income', filter: c => c.type?.toLowerCase() === 'income' },
    { id: 'expense', label: 'Expense', filter: c => c.type?.toLowerCase() === 'expense' },
    { id: 'inactive', label: 'Inactive', filter: c => !c.isActive }
  ];

  readonly rowActions: RowAction<FinanceCategory>[] = [
    { label: 'Delete category', icon: 'delete', danger: true, run: c => this.deleteCategory(c) }
  ];

  constructor(
    private financeService: FinanceService,
    private readonly confirmDialog: ConfirmService,
    private readonly toast: ToastService
  ) {}

  /** "12 categories · 2 inactive" for the header. */
  get summary(): string {
    if (!this.categories.length) return 'Income and expense categories';
    const inactive = this.categories.filter(c => !c.isActive).length;
    return `${this.categories.length} ${this.categories.length === 1 ? 'category' : 'categories'}` + (inactive ? ` · ${inactive} inactive` : '');
  }

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
        this.toast.error("Couldn't load categories. Refresh the page to try again.");
        this.loading = false;
      }
    });
  }

  private typeLabel(type: string): string {
    return type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : '';
  }

  async deleteCategory(category: FinanceCategory): Promise<void> {
    if (await this.confirmDialog.ask({
      title: `Delete category "${category.name}"?`,
      confirmText: 'Delete category',
      danger: true
    })) {
      this.financeService.deleteCategory(category.id).subscribe({
        next: () => {
          this.toast.done(`Category "${category.name}" deleted`);
          this.loadCategories();
        },
        error: (error) => {
          console.error('Error deleting category:', error);
          this.toast.error(`Couldn't delete "${category.name}". Try again.`);
        }
      });
    }
  }
}
