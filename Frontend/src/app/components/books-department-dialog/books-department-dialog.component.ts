import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { BooksService, BookDepartment } from '../../services/books.service';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

@Component({
  selector: 'books-department-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogModule, SkeletonRowsComponent, EmptyStateComponent],
  template: `
    <div class="dept-dialog">
      <!-- Step 1: Select Department -->
      <div *ngIf="step === 'select'" class="step-content">
        <div class="dialog-header">
          <div class="header-icon-wrap">
            <mat-icon>menu_book</mat-icon>
          </div>
          <h2>Books</h2>
          <p>Select a department to access its books</p>
        </div>

        <app-skeleton-rows *ngIf="loading" [rows]="4" [avatar]="true"></app-skeleton-rows>

        <app-empty-state *ngIf="!loading && departments.length === 0" icon="menu_book" title="No departments to open"
                         message="No department books are set up for you yet. Ask an administrator to add your department."
                         [compact]="true"></app-empty-state>

        <div *ngIf="!loading && departments.length > 0" class="dept-grid">
          <div class="dept-card" *ngFor="let dept of departments" (click)="selectDepartment(dept)">
            <mat-icon class="dept-icon">{{ getDeptIcon(dept.departmentName) }}</mat-icon>
            <span class="dept-name">{{ dept.departmentName }}</span>
            <mat-icon class="arrow-icon">chevron_right</mat-icon>
          </div>
        </div>

        <div class="dialog-footer">
          <button mat-button (click)="dialogRef.close()">Cancel</button>
        </div>
      </div>

      <!-- Step 2: Enter Password -->
      <div *ngIf="step === 'password'" class="step-content">
        <div class="dialog-header">
          <div class="header-icon-wrap">
            <mat-icon>lock</mat-icon>
          </div>
          <h2>{{ selectedDept?.departmentName }}</h2>
          <p>Enter the department password to continue</p>
        </div>

        <div class="password-section">
          <div class="password-input-wrap">
            <mat-icon class="input-icon">vpn_key</mat-icon>
            <input 
              [type]="showPassword ? 'text' : 'password'" 
              [(ngModel)]="password" 
              placeholder="Enter password" 
              class="password-input"
              (keydown.enter)="verifyPassword()"
              maxlength="20"
              autofocus>
            <button [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'" mat-icon-button class="toggle-pw" (click)="showPassword = !showPassword" type="button">
              <mat-icon>{{ showPassword ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
          </div>

          <div *ngIf="error" class="error-msg">
            <mat-icon>error</mat-icon>
            <span>{{ error }}</span>
          </div>
        </div>

        <div class="dialog-footer">
          <button mat-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon> Back
          </button>
          <button mat-flat-button color="primary" [disabled]="!password || verifying" (click)="verifyPassword()" class="access-btn">
            <mat-icon>{{ verifying ? 'hourglass_empty' : 'lock_open' }}</mat-icon>
            {{ verifying ? 'Verifying...' : 'Access Books' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dept-dialog { padding: 0; overflow: hidden; }
    .step-content { padding: 28px; }

    .dialog-header { text-align: center; margin-bottom: 24px; }
    .header-icon-wrap { width: 64px; height: 64px; border-radius: 20px; background: var(--color-primary-soft); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .header-icon-wrap mat-icon { color: var(--color-primary); font-size: 32px; width: 32px; height: 32px; }
    .dialog-header h2 { margin: 0 0 4px; font-size: var(--text-2xl); font-weight: 700; color: var(--color-text); }
    .dialog-header p { margin: 0; color: var(--color-text-3); font-size: var(--text-md); }

    .dept-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-height: 400px; overflow-y: auto; padding: 2px; }
    .dept-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1.5px solid var(--color-line); border-radius: 14px; cursor: pointer; transition: all 0.2s; background: var(--color-canvas); }
    .dept-card:hover { border-color: var(--color-primary); background: var(--color-primary-soft); transform: translateY(-1px); box-shadow: var(--shadow-md); }
    .dept-icon { color: var(--color-primary); font-size: 24px; width: 24px; height: 24px; }
    .dept-name { flex: 1; font-size: var(--text-md); font-weight: 600; color: var(--color-text-2); }
    .arrow-icon { color: var(--color-line-strong); font-size: 20px; width: 20px; height: 20px; transition: color 0.2s; }
    .dept-card:hover .arrow-icon { color: var(--color-primary); }

    .password-section { margin-bottom: 24px; }
    .password-input-wrap { position: relative; display: flex; align-items: center; border: 2px solid var(--color-line); border-radius: 14px; padding: 4px 8px 4px 16px; transition: border-color 0.2s; background: var(--color-canvas); }
    .password-input-wrap:focus-within { border-color: var(--color-primary); background: var(--color-surface); }
    .input-icon { color: var(--color-text-3); font-size: 22px; width: 22px; height: 22px; margin-right: 12px; }
    .password-input { flex: 1; border: none; outline: none; font-size: var(--text-lg); padding: 12px 0; background: transparent; color: var(--color-text); font-family: inherit; letter-spacing: 2px; }
    .toggle-pw { color: var(--color-text-3); }

    .error-msg { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 16px; background: var(--color-danger-soft); border: 1px solid var(--color-danger); border-radius: 10px; color: var(--color-danger); font-size: var(--text-sm); }
    .error-msg mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .dialog-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; border-top: 1px solid var(--color-surface-2); }
    .dialog-footer button { border-radius: 10px; }
    .access-btn { height: 42px; padding: 0 20px; font-weight: 600; }

    @media (max-width: 500px) {
      .dept-grid { grid-template-columns: 1fr; }
    }
  `]
})
export class BooksDepartmentDialogComponent implements OnInit {
  departments: BookDepartment[] = [];
  loading = true;
  step: 'select' | 'password' = 'select';
  selectedDept: BookDepartment | null = null;
  password = '';
  showPassword = false;
  verifying = false;
  error = '';

  constructor(
    public dialogRef: MatDialogRef<BooksDepartmentDialogComponent>,
    private booksService: BooksService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.booksService.getDepartments().subscribe({
      next: (depts) => {
        this.departments = depts;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getDeptIcon(name: string): string {
    const lower = name.toLowerCase();
    if (lower.includes('market')) return 'campaign';
    if (lower.includes('it')) return 'computer';
    if (lower.includes('sale')) return 'point_of_sale';
    if (lower.includes('hr') || lower.includes('human')) return 'people';
    if (lower.includes('finance') || lower.includes('account')) return 'account_balance';
    if (lower.includes('factory') || lower.includes('production') || lower.includes('condom')) return 'factory';
    if (lower.includes('stock') || lower.includes('warehouse')) return 'inventory_2';
    if (lower.includes('logistics') || lower.includes('transport')) return 'local_shipping';
    if (lower.includes('reception')) return 'meeting_room';
    if (lower.includes('training')) return 'school';
    return 'business';
  }

  selectDepartment(dept: BookDepartment): void {
    this.selectedDept = dept;
    this.password = '';
    this.error = '';
    this.step = 'password';
  }

  goBack(): void {
    this.step = 'select';
    this.password = '';
    this.error = '';
  }

  verifyPassword(): void {
    if (!this.password || !this.selectedDept) return;
    this.verifying = true;
    this.error = '';

    this.booksService.verifyPassword(this.selectedDept.departmentId, this.password).subscribe({
      next: (res) => {
        this.verifying = false;
        this.dialogRef.close();
        this.router.navigate(['/books'], {
          queryParams: {
            departmentId: this.selectedDept!.departmentId,
            departmentName: this.selectedDept!.departmentName
          }
        });
      },
      error: (err) => {
        this.verifying = false;
        this.error = err.error?.error || 'Incorrect password. Please try again.';
      }
    });
  }
}
