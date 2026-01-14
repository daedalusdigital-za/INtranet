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
import { AuthService } from '../../services/auth.service';
import { DocumentsService, DepartmentInfo } from '../../services/documents.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="documents-container">
      <div class="header-section">
        <h1>
          <mat-icon>folder</mat-icon>
          Document Management
        </h1>
        <p class="subtitle">Departmental Document Hubs</p>
      </div>

      <div class="departments-grid">
        <mat-card class="department-card" *ngFor="let dept of departments">
          <mat-card-content>
            <div class="icon-container">
              <mat-icon class="department-icon">{{ dept.icon }}</mat-icon>
            </div>
            <h3>{{ dept.name }}</h3>
            <p class="document-count">{{ dept.documentCount }} Documents</p>
            <button mat-raised-button color="primary" class="access-button" (click)="openPasswordDialog(dept)">
              <mat-icon>folder_open</mat-icon>
              Access Hub
            </button>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .documents-container {
      padding: 80px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
    }

    .header-section {
      margin-bottom: 32px;
      text-align: center;
    }

    h1 {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: white;
      margin: 0 0 8px 0;
      font-size: 36px;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    h1 mat-icon {
      font-size: 42px;
      width: 42px;
      height: 42px;
    }

    .subtitle {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      margin: 0;
    }

    .departments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .department-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 16px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2) !important;
      transition: all 0.3s ease;
      cursor: pointer;
    }

    .department-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.3) !important;
    }

    .department-card mat-card-content {
      padding: 32px 24px !important;
      text-align: center;
    }

    .icon-container {
      margin-bottom: 16px;
    }

    .department-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #1e90ff;
    }

    .department-card h3 {
      color: #1e90ff;
      font-size: 22px;
      font-weight: 600;
      margin: 0 0 8px 0;
    }

    .document-count {
      color: #666;
      font-size: 14px;
      margin: 0 0 20px 0;
    }

    .access-button {
      width: 100%;
      padding: 8px 0 !important;
      font-size: 15px !important;
      font-weight: 500 !important;
    }

    .access-button mat-icon {
      margin-right: 8px;
    }

    .spacer {
      flex: 1 1 auto;
    }
  `]
})
export class DocumentsComponent implements OnInit {
  currentUser: any;
  notificationCount = 3;
  departments: DepartmentInfo[] = [];

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
    this.documentsService.getDepartments().subscribe({
      next: (departments) => {
        this.departments = departments;
      },
      error: (error) => {
        console.error('Error loading departments:', error);
        // Fallback to static data if API fails
        this.departments = [
          { name: 'IT', icon: 'computer', documentCount: 0 },
          { name: 'Marketing', icon: 'campaign', documentCount: 0 },
          { name: 'Tender', icon: 'gavel', documentCount: 0 },
          { name: 'Projects', icon: 'engineering', documentCount: 0 },
          { name: 'Sales', icon: 'point_of_sale', documentCount: 0 },
          { name: 'Call Center', icon: 'headset_mic', documentCount: 0 },
          { name: 'Production', icon: 'precision_manufacturing', documentCount: 0 },
          { name: 'Human Resource', icon: 'people', documentCount: 0 },
          { name: 'Stock', icon: 'inventory_2', documentCount: 0 },
          { name: 'Logistics', icon: 'local_shipping', documentCount: 0 },
          { name: 'Finance', icon: 'account_balance', documentCount: 0 }
        ];
      }
    });
  }

  openPasswordDialog(department: DepartmentInfo): void {
    const dialogRef = this.dialog.open(DepartmentPasswordDialogComponent, {
      width: '400px',
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
    <h2 mat-dialog-title>
      <mat-icon>lock</mat-icon>
      Access {{ data.departmentName }} Hub
    </h2>
    <mat-dialog-content>
      <p class="info-text">This department hub is password protected.</p>
      <p class="contact-text">Contact the department head for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Department Password</mat-label>
        <input matInput
               type="password"
               [(ngModel)]="password"
               (keyup.enter)="validatePassword()"
               placeholder="Enter password">
        <mat-icon matPrefix>vpn_key</mat-icon>
      </mat-form-field>

      @if (errorMessage) {
        <p class="error-message">
          <mat-icon>error</mat-icon>
          {{ errorMessage }}
        </p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="validatePassword()">
        <mat-icon>lock_open</mat-icon>
        Access Hub
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #1e90ff;
      margin: 0;
    }

    h2 mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .info-text {
      color: #333;
      font-size: 15px;
      margin: 0 0 8px 0;
    }

    .contact-text {
      color: #666;
      font-size: 14px;
      font-style: italic;
      margin: 0;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d32f2f;
      font-size: 14px;
      margin: 8px 0 0 0;
      padding: 8px;
      background: #ffebee;
      border-radius: 4px;
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      margin: 0 !important;
    }

    mat-dialog-actions button {
      margin-left: 8px;
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



