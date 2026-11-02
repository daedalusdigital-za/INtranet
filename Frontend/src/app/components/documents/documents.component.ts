import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../services/auth.service';
import { DocumentsService, DepartmentInfo } from '../../services/documents.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatTooltipModule,
    NavbarComponent,
    PageHeaderComponent,
    EmptyStateComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="documents-container">
      <app-page-header class="header-section" [crumbs]="['Workspace', 'Documents']" title="Documents"
                       [subtitle]="departments.length + ' department libraries, ' + (totalDocuments | number) + ' documents'">
        <div class="search-box">
          <mat-icon aria-hidden="true">search</mat-icon>
          <input type="text"
                 placeholder="Search departments"
                 aria-label="Search departments"
                 [(ngModel)]="searchQuery"
                 (input)="filterDepartments()">
          @if (searchQuery) {
            <button aria-label="Clear search" mat-icon-button (click)="clearSearch()" class="clear-btn">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>
      </app-page-header>

      <!-- Departments Grid -->
      <div class="departments-section">
        <div class="departments-grid">
          <div class="department-card shared-card"
               routerLink="/documents/shared"
               matTooltip="View files and folders shared with you">
            <div class="card-content">
              <div class="icon-container" data-dept="shared">
                <mat-icon>folder_shared</mat-icon>
              </div>
              <h3>Shared with Me</h3>
              <div class="document-count">
                <mat-icon>share</mat-icon>
                <span>Files &amp; folders shared to you</span>
              </div>
              <div class="card-footer">
                <button mat-flat-button color="primary" class="access-btn">
                  <mat-icon>open_in_new</mat-icon>
                  Open
                </button>
              </div>
            </div>
            <div class="card-indicator"></div>
          </div>
          @for (dept of filteredDepartments; track dept.name) {
            <div class="department-card" 
                 [class.loading]="dept.documentCount === -1"
                 (click)="openPasswordDialog(dept)"
                 [matTooltip]="'Access ' + dept.name + ' Hub'">
              
              <div class="card-content">
                <div class="icon-container" [attr.data-dept]="dept.name.toLowerCase()">
                  <mat-icon>{{ dept.icon }}</mat-icon>
                </div>
                
                <h3>{{ dept.name }}</h3>
                
                <div class="document-count">
                  @if (dept.documentCount === -1) {
                    <div class="skeleton loading-skeleton"></div>
                  } @else {
                    <mat-icon>description</mat-icon>
                    <span>{{ dept.documentCount }} Documents</span>
                  }
                </div>

                <div class="card-footer">
                  <button mat-flat-button color="primary" class="access-btn">
                    <mat-icon>lock_open</mat-icon>
                    Access Hub
                  </button>
                </div>
              </div>

              <div class="card-indicator"></div>
            </div>
          }
        </div>

        @if (filteredDepartments.length === 0 && searchQuery) {
          <app-empty-state icon="search_off" title="No departments found" message="Nothing matches that search. Try a different term.">
            <button mat-stroked-button (click)="clearSearch()">Clear search</button>
          </app-empty-state>
        }
      </div>
    </div>
  `,
  styles: [`
    .documents-container {
      min-height: 100vh;
      padding: var(--space-5) var(--space-6) var(--space-8);
      position: relative;
      background: var(--color-canvas);
      overflow-x: hidden;
    }

    /* Page header: same width as the departments grid below */
    .header-section {
      max-width: 1400px;
      margin: 0 auto var(--space-5);
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      box-sizing: border-box;
      width: 280px;
      max-width: 100%;
      height: 36px;
      padding: 0 var(--space-1) 0 var(--space-3);
      background: var(--color-surface);
      border: 1px solid var(--color-line-strong);
      border-radius: var(--radius-control);
    }

    .search-box:focus-within {
      border-color: var(--color-primary);
    }

    .search-box mat-icon {
      color: var(--color-text-3);
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
    }

    .search-box input {
      flex: 1;
      min-width: 0;
      border: none;
      outline: none;
      font: inherit;
      font-size: var(--text-sm);
      background: transparent;
      color: var(--color-text);
    }

    .search-box input::placeholder {
      color: var(--color-text-3);
    }

    .clear-btn {
      --mdc-icon-button-state-layer-size: 28px;
      --mdc-icon-button-icon-size: 18px;
    }

    /* Departments Grid */
    .departments-section {
      max-width: 1400px;
      margin: 0 auto;
    }

    .departments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-5);
    }

    .department-card {
      position: relative;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
      box-shadow: var(--shadow-sm);
    }

    .department-card:hover {
      transform: translateY(-4px);
      border-color: var(--color-primary);
      box-shadow: var(--shadow-md);
    }

    .card-content {
      position: relative;
      padding: 32px 24px;
      text-align: center;
      z-index: 1;
    }

    .icon-container {
      width: 64px;
      height: 64px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-lg);
      background: var(--color-primary-soft);
      transition: transform 0.2s ease;
    }

    .department-card:hover .icon-container {
      transform: scale(1.06);
    }

    .icon-container[data-dept="shared"] { background: var(--color-cat-teal-soft); }
    .icon-container[data-dept="shared"] mat-icon { color: var(--color-cat-teal); }

    .icon-container mat-icon {
      font-size: var(--text-4xl);
      width: 32px;
      height: 32px;
      color: var(--color-primary);
    }

    .department-card h3 {
      margin: 0 0 12px;
      font-size: var(--text-2xl);
      font-weight: 600;
      color: var(--color-text);
    }

    .document-count {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 20px;
      color: var(--color-text-2);
      font-size: var(--text-md);
      min-height: 24px;
    }

    .document-count mat-icon {
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
      color: var(--color-text-3);
    }

    .loading-skeleton {
      width: 100px;
      height: 18px;
      border-radius: 4px;
    }

    .card-footer {
      margin-top: 8px;
    }

    .access-btn {
      width: 100%;
    }

    .access-btn mat-icon {
      margin-right: 8px;
    }

    .card-indicator {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--color-primary);
      transform: scaleX(0);
      transition: transform 0.3s;
    }

    .department-card:hover .card-indicator {
      transform: scaleX(1);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .documents-container {
        padding: var(--space-4) var(--space-4) var(--space-6);
      }

      .departments-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class DocumentsComponent implements OnInit {
  currentUser: any;
  departments: DepartmentInfo[] = [];
  filteredDepartments: DepartmentInfo[] = [];
  searchQuery = '';
  totalDocuments = 0;
  
  // Static department list for instant display
  private static readonly staticDepartments: DepartmentInfo[] = [
    { name: 'IT', icon: 'computer', documentCount: -1 },
    { name: 'Marketing', icon: 'campaign', documentCount: -1 },
    { name: 'Tender', icon: 'gavel', documentCount: -1 },
    { name: 'Projects', icon: 'engineering', documentCount: -1 },
    { name: 'Sales', icon: 'point_of_sale', documentCount: -1 },
    { name: 'Call Center', icon: 'headset_mic', documentCount: -1 },
    { name: 'Production', icon: 'precision_manufacturing', documentCount: -1 },
    { name: 'Human Resource', icon: 'people', documentCount: -1 },
    { name: 'Stock', icon: 'inventory_2', documentCount: -1 },
    { name: 'Logistics', icon: 'local_shipping', documentCount: -1 },
    { name: 'Finance', icon: 'account_balance', documentCount: -1 },
    { name: 'Managers', icon: 'supervisor_account', documentCount: -1 },
    { name: 'Paperless', icon: 'draw', documentCount: -1 }
  ];

  constructor(
    private authService: AuthService,
    private documentsService: DocumentsService,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.loadDepartments();
  }

  loadDepartments(): void {
    // Show static departments immediately with loading state
    this.departments = [...DocumentsComponent.staticDepartments];
    this.filteredDepartments = [...this.departments];
    
    // Try to load cached counts first for instant display
    const cachedCounts = localStorage.getItem('departmentCounts');
    if (cachedCounts) {
      try {
        const counts = JSON.parse(cachedCounts);
        this.departments = this.departments.map(dept => ({
          ...dept,
          documentCount: counts[dept.name] ?? -1
        }));
        this.filteredDepartments = [...this.departments];
        this.calculateTotalDocuments();
      } catch (e) {
        // Ignore cache parse errors
      }
    }
    
    // Load fresh counts from API in background
    this.documentsService.getDepartments().subscribe({
      next: (departments) => {
        // Update counts and cache them
        const counts: { [key: string]: number } = {};
        departments.forEach(d => counts[d.name] = d.documentCount);
        localStorage.setItem('departmentCounts', JSON.stringify(counts));
        
        // Merge API data with static departments
        this.departments = this.departments.map(dept => {
          const apiDept = departments.find(d => d.name === dept.name);
          return apiDept ? { ...dept, documentCount: apiDept.documentCount } : dept;
        });
        this.filterDepartments();
        this.calculateTotalDocuments();
      },
      error: (error) => {
        console.error('Error loading departments:', error);
        // Set counts to 0 on error
        this.departments = this.departments.map(d => ({ ...d, documentCount: d.documentCount === -1 ? 0 : d.documentCount }));
        this.filteredDepartments = [...this.departments];
        this.calculateTotalDocuments();
      }
    });
  }

  filterDepartments(): void {
    if (!this.searchQuery.trim()) {
      this.filteredDepartments = [...this.departments];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredDepartments = this.departments.filter(d => 
        d.name.toLowerCase().includes(query)
      );
    }
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filterDepartments();
  }

  calculateTotalDocuments(): void {
    this.totalDocuments = this.departments
      .filter(d => d.documentCount > 0)
      .reduce((sum, d) => sum + d.documentCount, 0);
  }

  openPasswordDialog(department: DepartmentInfo): void {
    const dialogRef = this.dialog.open(DepartmentPasswordDialogComponent, {
      width: '420px',
      panelClass: 'modern-dialog',
      data: { departmentName: department.name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        // Password was correct, navigate to department hub
        this.router.navigate(['/documents', department.name]);
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

// Password Dialog Component
@Component({
  selector: 'app-department-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormsModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="lock-icon">
          <mat-icon>lock</mat-icon>
        </div>
        <h2>Access {{ data.departmentName }} Hub</h2>
        <p class="info-text">This department hub is password protected</p>
      </div>

      <div class="dialog-body">
        <div class="input-group">
          <mat-icon class="input-icon">vpn_key</mat-icon>
          <input type="password"
                 [(ngModel)]="password"
                 (keyup.enter)="validatePassword()"
                 placeholder="Enter department password"
                 class="password-input"
                 [class.error]="errorMessage">
        </div>

        @if (errorMessage) {
          <div class="error-message">
            <mat-icon>error_outline</mat-icon>
            <span>{{ errorMessage }}</span>
          </div>
        }

        <p class="contact-hint">
          <mat-icon>info_outline</mat-icon>
          Contact the department head for access credentials
        </p>
      </div>

      <div class="dialog-actions">
        <button class="btn-cancel" (click)="onCancel()">
          Cancel
        </button>
        <button class="btn-access" (click)="validatePassword()" [disabled]="isValidating">
          @if (isValidating) {
            <div class="spinner"></div>
          } @else {
            <mat-icon>lock_open</mat-icon>
          }
          Access Hub
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .dialog-container {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: 32px;
      color: var(--color-text);
      min-width: 360px;
    }

    .dialog-header {
      text-align: center;
      margin-bottom: 28px;
    }

    .lock-icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-primary-soft);
      border-radius: 50%;
    }

    .lock-icon mat-icon {
      font-size: var(--text-4xl);
      width: 32px;
      height: 32px;
      color: var(--color-primary);
    }

    .dialog-header h2 {
      margin: 0 0 8px;
      font-size: var(--text-3xl);
      font-weight: 600;
      color: var(--color-text);
    }

    .info-text {
      margin: 0;
      font-size: var(--text-md);
      color: var(--color-text-3);
    }

    .dialog-body {
      margin-bottom: 24px;
    }

    .input-group {
      position: relative;
      margin-bottom: 16px;
    }

    .input-icon {
      position: absolute;
      left: 16px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-3);
      font-size: var(--text-2xl);
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 52px;
      background: var(--color-surface);
      border: 2px solid var(--color-line-strong);
      border-radius: var(--radius-control);
      color: var(--color-text);
      font-size: var(--text-lg);
      transition: border-color 0.2s, box-shadow 0.2s;
      box-sizing: border-box;
    }

    .password-input:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px var(--color-primary-soft);
    }

    .password-input.error {
      border-color: var(--color-danger);
    }

    .password-input::placeholder {
      color: var(--color-text-3);
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--color-danger-soft);
      border: 1px solid var(--color-danger);
      border-radius: var(--radius-control);
      color: var(--color-danger);
      font-size: var(--text-md);
      margin-bottom: 16px;
      animation: shake 0.4s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      75% { transform: translateX(8px); }
    }

    .error-message mat-icon {
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
    }

    .contact-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 0;
      font-size: var(--text-sm);
      color: var(--color-text-3);
    }

    .contact-hint mat-icon {
      font-size: var(--text-lg);
      width: 16px;
      height: 16px;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
    }

    .btn-cancel, .btn-access {
      flex: 1;
      padding: 12px 24px;
      border: none;
      border-radius: var(--radius-control);
      font-size: var(--text-md);
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s;
    }

    .btn-cancel {
      background: var(--color-surface);
      color: var(--color-text-2);
      border: 1px solid var(--color-line-strong);
    }

    .btn-cancel:hover {
      background: var(--color-surface-2);
      color: var(--color-text);
    }

    .btn-access {
      background: var(--color-primary);
      color: var(--color-on-primary);
    }

    .btn-access:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }

    .btn-access:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .btn-access mat-icon {
      font-size: var(--text-2xl);
      width: 20px;
      height: 20px;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--color-primary-soft);
      border-top-color: var(--color-on-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class DepartmentPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  isValidating: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<DepartmentPasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { departmentName: string },
    private documentsService: DocumentsService
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    this.isValidating = true;
    this.errorMessage = '';

    this.documentsService.validatePassword(this.data.departmentName, this.password).subscribe({
      next: (response) => {
        this.isValidating = false;
        if (response.success) {
          // Store token for this department session
          sessionStorage.setItem(`dept_token_${this.data.departmentName}`, response.token || '');
          this.dialogRef.close({ success: true });
        } else {
          this.errorMessage = 'Incorrect password. Please contact the department head.';
        }
      },
      error: (error) => {
        this.isValidating = false;
        this.errorMessage = 'Incorrect password. Please contact the department head.';
      }
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}



