import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Department } from '../../models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDialogModule
  ],
  template: `
    <mat-toolbar color="primary">
      <span style="font-size: 20px; font-weight: 600;">Promed Intranet</span>
      <span style="margin: 0 32px;"></span>

      <button mat-button routerLink="/dashboard">
        <mat-icon>home</mat-icon> Home
      </button>
      <button mat-button routerLink="/crm">
        <mat-icon>people_outline</mat-icon> CRM
      </button>
      <button mat-button routerLink="/departments">
        <mat-icon>business</mat-icon> Project Management
      </button>
      <button mat-button routerLink="/people">
        <mat-icon>people</mat-icon> Human Resource
      </button>
      <button mat-button routerLink="/documents">
        <mat-icon>folder</mat-icon> Documents
      </button>
      <button mat-button routerLink="/support-ticket">
        <mat-icon>support_agent</mat-icon> Support Ticket
      </button>

      <span class="spacer"></span>

      <button mat-icon-button>
        <mat-icon>search</mat-icon>
      </button>

      @if (currentUser?.role === 'Admin') {
        <button mat-raised-button (click)="openCreateDialog()" style="margin-right: 16px;">
          <mat-icon>add</mat-icon> New Department
        </button>
      }
      <span style="margin-right: 16px;">{{ currentUser?.name }} ({{ currentUser?.role }})</span>
      <button mat-icon-button (click)="logout()">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <div class="dashboard-container">
      <h1>Departments</h1>

      @if (loading) {
        <div class="loading-spinner">
          <mat-spinner></mat-spinner>
        </div>
      } @else {
        <div class="departments-grid">
          @for (dept of departments; track dept.departmentId) {
            <mat-card class="department-card" (click)="openPasswordDialog(dept)">
              <mat-card-header>
                <mat-card-title>{{ dept.name }}</mat-card-title>
                <mat-card-subtitle>{{ dept.managerName }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="stats">
                  <div class="stat">
                    <mat-icon>dashboard</mat-icon>
                    <span>{{ dept.boardCount }} Boards</span>
                  </div>
                  <div class="stat">
                    <mat-icon>people</mat-icon>
                    <span>{{ dept.userCount }} Users</span>
                  </div>
                </div>
              </mat-card-content>
              <mat-card-actions>
                <button mat-button color="primary">View Boards</button>
              </mat-card-actions>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

    .spacer {
      flex: 1 1 auto;
    }

    .dashboard-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      margin-bottom: 24px;
      color: #ffffff;
      font-size: 2.5rem;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }

    .loading-spinner ::ng-deep .mat-progress-spinner circle {
      stroke: #ffffff;
    }

    .departments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 24px;
    }

    .department-card {
      cursor: pointer;
      transition: all 0.3s ease;
      background: linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%);
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 2px 4px rgba(0, 0, 0, 0.06);
      overflow: hidden;
      position: relative;
    }

    .department-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

    .department-card:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15), 0 6px 12px rgba(0, 0, 0, 0.1);
    }

    .department-card ::ng-deep .mat-mdc-card-header {
      padding: 20px;
      background: linear-gradient(135deg, rgba(0, 0, 139, 0.1) 0%, rgba(65, 105, 225, 0.1) 100%);
    }

    .department-card ::ng-deep .mat-mdc-card-title {
      font-size: 1.5rem;
      font-weight: 600;
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }

    .department-card ::ng-deep .mat-mdc-card-subtitle {
      color: #1e90ff;
      font-size: 0.9rem;
    }

    .department-card ::ng-deep .mat-mdc-card-content {
      padding: 20px;
    }

    .stats {
      display: flex;
      gap: 20px;
      margin-top: 16px;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: linear-gradient(135deg, rgba(0, 0, 139, 0.15) 0%, rgba(65, 105, 225, 0.15) 100%);
      border-radius: 8px;
      transition: all 0.2s ease;
    }

    .stat:hover {
      background: linear-gradient(135deg, rgba(0, 0, 139, 0.25) 0%, rgba(65, 105, 225, 0.25) 100%);
      transform: scale(1.05);
    }

    .stat mat-icon {
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .stat span {
      font-size: 14px;
      font-weight: 500;
      color: #4a5568;
    }

    mat-toolbar {
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
      color: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    mat-toolbar h2 {
      font-weight: 600;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
    }

    mat-toolbar button {
      color: white;
    }
  `]
})
export class DashboardComponent implements OnInit {
  departments: Department[] = [];
  loading = true;
  currentUser: any;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.loadDepartments();
  }

  loadDepartments(): void {
    this.loading = true;
    this.apiService.getDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading departments:', error);
        this.loading = false;
      }
    });
  }

  openPasswordDialog(department: Department): void {
    const dialogRef = this.dialog.open(BoardPasswordDialogComponent, {
      width: '400px',
      data: { departmentName: department.name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.viewDepartment(department.departmentId);
      }
    });
  }

  viewDepartment(id: number): void {
    this.router.navigate(['/boards', id]);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CreateDepartmentDialog, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.apiService.createDepartment(result).subscribe({
          next: () => {
            this.snackBar.open('Department created successfully!', 'Close', { duration: 3000 });
            this.loadDepartments();
          },
          error: (error) => {
            console.error('Error creating department:', error);
            this.snackBar.open('Failed to create department', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}

// Board Password Dialog Component
@Component({
  selector: 'app-board-password-dialog',
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
      Access {{ data.departmentName }} Boards
    </h2>
    <mat-dialog-content>
      <p class="info-text">This department's boards are password protected.</p>
      <p class="contact-text">Contact the department manager for the password.</p>

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
        Access Boards
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #00008B;
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
export class BoardPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<BoardPasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { departmentName: string }
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact the department manager.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'create-department-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>Create New Department</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Department Name</mat-label>
          <input matInput formControlName="name" required>
          @if (form.get('name')?.hasError('required')) {
            <mat-error>Department name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Manager Name</mat-label>
          <input matInput formControlName="managerName" required>
          @if (form.get('managerName')?.hasError('required')) {
            <mat-error>Manager name is required</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="submit()">Create</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
  `]
})
export class CreateDepartmentDialog {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateDepartmentDialog>
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      managerName: ['', Validators.required]
    });
  }

  submit(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }
}
