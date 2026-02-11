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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../services/auth.service';
import { DocumentsService, DepartmentInfo } from '../../services/documents.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';

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
    MatProgressSpinnerModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="documents-container">
      <!-- Modern Header -->
      <div class="header-section">
        <div class="header-content">
          <div class="title-area">
            <div class="icon-wrapper">
              <mat-icon>folder_special</mat-icon>
            </div>
            <div class="title-text">
              <h1>Document Management</h1>
              <p class="subtitle">Access departmental document hubs securely</p>
            </div>
          </div>
          <div class="header-stats">
            <div class="stat-card">
              <mat-icon>business</mat-icon>
              <div class="stat-info">
                <span class="stat-value">{{ departments.length }}</span>
                <span class="stat-label">Departments</span>
              </div>
            </div>
            <div class="stat-card">
              <mat-icon>description</mat-icon>
              <div class="stat-info">
                <span class="stat-value">{{ totalDocuments }}</span>
                <span class="stat-label">Total Documents</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="search-section">
          <div class="search-box">
            <mat-icon>search</mat-icon>
            <input type="text" 
                   placeholder="Search departments..." 
                   [(ngModel)]="searchQuery"
                   (input)="filterDepartments()">
            @if (searchQuery) {
              <button mat-icon-button (click)="clearSearch()" class="clear-btn">
                <mat-icon>close</mat-icon>
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Departments Grid -->
      <div class="departments-section">
        <div class="departments-grid">
          @for (dept of filteredDepartments; track dept.name) {
            <div class="department-card" 
                 [class.loading]="dept.documentCount === -1"
                 (click)="openPasswordDialog(dept)"
                 [matTooltip]="'Access ' + dept.name + ' Hub'">
              
              <div class="card-glow"></div>
              
              <div class="card-content">
                <div class="icon-container" [attr.data-dept]="dept.name.toLowerCase()">
                  <mat-icon>{{ dept.icon }}</mat-icon>
                </div>
                
                <h3>{{ dept.name }}</h3>
                
                <div class="document-count">
                  @if (dept.documentCount === -1) {
                    <div class="loading-skeleton"></div>
                  } @else {
                    <mat-icon>description</mat-icon>
                    <span>{{ dept.documentCount }} Documents</span>
                  }
                </div>

                <div class="card-footer">
                  <button mat-flat-button class="access-btn">
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
          <div class="no-results">
            <mat-icon>search_off</mat-icon>
            <h3>No departments found</h3>
            <p>Try a different search term</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .documents-container {
      min-height: 100vh;
      padding: 80px 32px 48px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 50%, #1a5fb4 100%);
    }

    /* Header Section */
    .header-section {
      max-width: 1400px;
      margin: 0 auto 40px;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 24px;
      margin-bottom: 24px;
    }

    .title-area {
      display: flex;
      align-items: center;
      gap: 20px;
    }

    .icon-wrapper {
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    .icon-wrapper mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: white;
    }

    .title-text h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      color: white;
      letter-spacing: -0.5px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }

    .subtitle {
      margin: 4px 0 0;
      font-size: 16px;
      color: rgba(255, 255, 255, 0.9);
    }

    .header-stats {
      display: flex;
      gap: 16px;
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }

    .stat-card mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .stat-info {
      display: flex;
      flex-direction: column;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: white;
    }

    .stat-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Search Section */
    .search-section {
      display: flex;
      justify-content: center;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      max-width: 500px;
      padding: 14px 20px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    .search-box mat-icon {
      color: #1e90ff;
      font-size: 24px;
    }

    .search-box input {
      flex: 1;
      border: none;
      outline: none;
      font-size: 16px;
      background: transparent;
      color: #333;
    }

    .search-box input::placeholder {
      color: #999;
    }

    .clear-btn {
      width: 32px;
      height: 32px;
    }

    /* Departments Grid */
    .departments-section {
      max-width: 1400px;
      margin: 0 auto;
    }

    .departments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
    }

    .department-card {
      position: relative;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 20px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    }

    .department-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
    }

    .card-glow {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 100%;
      background: linear-gradient(135deg, rgba(30, 144, 255, 0.1) 0%, rgba(65, 105, 225, 0.05) 100%);
      opacity: 0;
      transition: opacity 0.4s;
    }

    .department-card:hover .card-glow {
      opacity: 1;
    }

    .card-content {
      position: relative;
      padding: 32px 24px;
      text-align: center;
      z-index: 1;
    }

    .icon-container {
      width: 80px;
      height: 80px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 20px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      box-shadow: 0 8px 24px rgba(30, 144, 255, 0.4);
      transition: all 0.4s;
    }

    .department-card:hover .icon-container {
      transform: scale(1.1);
      box-shadow: 0 12px 32px rgba(30, 144, 255, 0.5);
    }

    /* Department-specific icon colors - blue theme variations */
    .icon-container[data-dept="it"] { background: linear-gradient(135deg, #00b4db 0%, #0083b0 100%); box-shadow: 0 8px 24px rgba(0, 180, 219, 0.4); }
    .icon-container[data-dept="marketing"] { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); box-shadow: 0 8px 24px rgba(255, 107, 107, 0.4); }
    .icon-container[data-dept="tender"] { background: linear-gradient(135deg, #ffa726 0%, #fb8c00 100%); box-shadow: 0 8px 24px rgba(255, 167, 38, 0.4); }
    .icon-container[data-dept="projects"] { background: linear-gradient(135deg, #7c4dff 0%, #651fff 100%); box-shadow: 0 8px 24px rgba(124, 77, 255, 0.4); }
    .icon-container[data-dept="sales"] { background: linear-gradient(135deg, #26a69a 0%, #00897b 100%); box-shadow: 0 8px 24px rgba(38, 166, 154, 0.4); }
    .icon-container[data-dept="call center"] { background: linear-gradient(135deg, #42a5f5 0%, #1e88e5 100%); box-shadow: 0 8px 24px rgba(66, 165, 245, 0.4); }
    .icon-container[data-dept="production"] { background: linear-gradient(135deg, #ef5350 0%, #e53935 100%); box-shadow: 0 8px 24px rgba(239, 83, 80, 0.4); }
    .icon-container[data-dept="human resource"] { background: linear-gradient(135deg, #5c6bc0 0%, #3f51b5 100%); box-shadow: 0 8px 24px rgba(92, 107, 192, 0.4); }
    .icon-container[data-dept="stock"] { background: linear-gradient(135deg, #8d6e63 0%, #6d4c41 100%); box-shadow: 0 8px 24px rgba(141, 110, 99, 0.4); }
    .icon-container[data-dept="logistics"] { background: linear-gradient(135deg, #29b6f6 0%, #039be5 100%); box-shadow: 0 8px 24px rgba(41, 182, 246, 0.4); }
    .icon-container[data-dept="finance"] { background: linear-gradient(135deg, #66bb6a 0%, #43a047 100%); box-shadow: 0 8px 24px rgba(102, 187, 106, 0.4); }
    .icon-container[data-dept="managers"] { background: linear-gradient(135deg, #ab47bc 0%, #8e24aa 100%); box-shadow: 0 8px 24px rgba(171, 71, 188, 0.4); }

    .icon-container mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: white;
    }

    .department-card h3 {
      margin: 0 0 12px;
      font-size: 20px;
      font-weight: 600;
      color: #1e90ff;
    }

    .document-count {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-bottom: 20px;
      color: #666;
      font-size: 14px;
      min-height: 24px;
    }

    .document-count mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #888;
    }

    .loading-skeleton {
      width: 100px;
      height: 18px;
      background: linear-gradient(90deg, #e0e0e0 25%, #f5f5f5 50%, #e0e0e0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .card-footer {
      margin-top: 8px;
    }

    .access-btn {
      width: 100%;
      padding: 10px 24px !important;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%) !important;
      color: white !important;
      font-weight: 500 !important;
      border-radius: 12px !important;
      transition: all 0.3s !important;
      box-shadow: 0 4px 12px rgba(30, 144, 255, 0.3) !important;
    }

    .department-card:hover .access-btn {
      box-shadow: 0 6px 20px rgba(30, 144, 255, 0.4) !important;
      transform: translateY(-2px);
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
      background: linear-gradient(90deg, #1e90ff 0%, #4169e1 100%);
      transform: scaleX(0);
      transition: transform 0.4s;
    }

    .department-card:hover .card-indicator {
      transform: scaleX(1);
    }

    /* No Results */
    .no-results {
      text-align: center;
      padding: 60px;
      color: rgba(255, 255, 255, 0.9);
    }

    .no-results mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .no-results h3 {
      margin: 0 0 8px;
      color: white;
    }

    .no-results p {
      margin: 0;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .documents-container {
        padding: 80px 16px 32px;
      }

      .header-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .title-area {
        flex-direction: column;
        align-items: flex-start;
        text-align: left;
      }

      .title-text h1 {
        font-size: 24px;
      }

      .header-stats {
        width: 100%;
      }

      .stat-card {
        flex: 1;
        justify-content: center;
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
    { name: 'Managers', icon: 'supervisor_account', documentCount: -1 }
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
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      border-radius: 20px;
      padding: 32px;
      color: white;
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
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    }

    .lock-icon mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      color: white;
    }

    .dialog-header h2 {
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 600;
      color: white;
    }

    .info-text {
      margin: 0;
      font-size: 14px;
      color: rgba(255, 255, 255, 0.7);
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
      color: rgba(255, 255, 255, 0.5);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .password-input {
      width: 100%;
      padding: 16px 16px 16px 52px;
      background: rgba(255, 255, 255, 0.1);
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      color: white;
      font-size: 16px;
      transition: all 0.3s;
      box-sizing: border-box;
    }

    .password-input:focus {
      outline: none;
      border-color: rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.15);
      box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.1);
    }

    .password-input.error {
      border-color: #ff6b6b;
    }

    .password-input::placeholder {
      color: rgba(255, 255, 255, 0.4);
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: rgba(255, 107, 107, 0.15);
      border: 1px solid rgba(255, 107, 107, 0.3);
      border-radius: 10px;
      color: #ff6b6b;
      font-size: 14px;
      margin-bottom: 16px;
      animation: shake 0.4s ease-in-out;
    }

    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-8px); }
      75% { transform: translateX(8px); }
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .contact-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 0;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.5);
    }

    .contact-hint mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .dialog-actions {
      display: flex;
      gap: 12px;
    }

    .btn-cancel, .btn-access {
      flex: 1;
      padding: 14px 24px;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.3s;
    }

    .btn-cancel {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .btn-cancel:hover {
      background: rgba(255, 255, 255, 0.15);
      color: white;
    }

    .btn-access {
      background: rgba(255, 255, 255, 0.95);
      color: #1e90ff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    }

    .btn-access:hover:not(:disabled) {
      transform: translateY(-2px);
      background: white;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
    }

    .btn-access:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .btn-access mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
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



