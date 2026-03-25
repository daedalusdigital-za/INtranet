import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { BooksService, BookDepartment } from '../../services/books.service';

@Component({
  selector: 'books-department-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatDialogModule, MatProgressSpinnerModule],
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

        <div *ngIf="loading" class="loading">
          <mat-spinner diameter="36"></mat-spinner>
          <span>Loading departments...</span>
        </div>

        <div *ngIf="!loading" class="dept-grid">
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
          <div class="header-icon-wrap password-icon">
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
            <button mat-icon-button class="toggle-pw" (click)="showPassword = !showPassword" type="button">
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
    .header-icon-wrap { width: 64px; height: 64px; border-radius: 20px; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; box-shadow: 0 4px 14px rgba(102,126,234,0.4); }
    .header-icon-wrap.password-icon { background: linear-gradient(135deg, #f59e0b, #ef6c00); box-shadow: 0 4px 14px rgba(245,158,11,0.4); }
    .header-icon-wrap mat-icon { color: white; font-size: 32px; width: 32px; height: 32px; }
    .dialog-header h2 { margin: 0 0 4px; font-size: 22px; font-weight: 700; color: #1a1a2e; }
    .dialog-header p { margin: 0; color: #6b7280; font-size: 14px; }

    .loading { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 40px; color: #6b7280; }

    .dept-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-height: 400px; overflow-y: auto; padding: 2px; }
    .dept-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1.5px solid #e5e7eb; border-radius: 14px; cursor: pointer; transition: all 0.2s; background: #f9fafb; }
    .dept-card:hover { border-color: #667eea; background: #f5f3ff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102,126,234,0.15); }
    .dept-icon { color: #667eea; font-size: 24px; width: 24px; height: 24px; }
    .dept-name { flex: 1; font-size: 14px; font-weight: 600; color: #374151; }
    .arrow-icon { color: #d1d5db; font-size: 20px; width: 20px; height: 20px; transition: color 0.2s; }
    .dept-card:hover .arrow-icon { color: #667eea; }

    .password-section { margin-bottom: 24px; }
    .password-input-wrap { position: relative; display: flex; align-items: center; border: 2px solid #e5e7eb; border-radius: 14px; padding: 4px 8px 4px 16px; transition: border-color 0.2s; background: #f9fafb; }
    .password-input-wrap:focus-within { border-color: #667eea; background: white; }
    .input-icon { color: #9ca3af; font-size: 22px; width: 22px; height: 22px; margin-right: 12px; }
    .password-input { flex: 1; border: none; outline: none; font-size: 16px; padding: 12px 0; background: transparent; font-family: inherit; letter-spacing: 2px; }
    .toggle-pw { color: #9ca3af; }

    .error-msg { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 10px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #ef4444; font-size: 13px; }
    .error-msg mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .dialog-footer { display: flex; justify-content: flex-end; gap: 10px; padding-top: 8px; border-top: 1px solid #f3f4f6; }
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
