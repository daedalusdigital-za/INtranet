import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="profile-container">
      <!-- Header with back button -->
      <div class="profile-header">
        <button mat-icon-button (click)="goBack()" class="back-button">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <h1>My Profile</h1>
      </div>

      <div class="profile-content" *ngIf="user">
        <!-- Profile Card -->
        <mat-card class="profile-card">
          <div class="profile-photo-section">
            <div class="profile-photo">
              <img *ngIf="user.profilePictureUrl" [src]="user.profilePictureUrl" alt="Profile Photo">
              <mat-icon *ngIf="!user.profilePictureUrl" class="default-avatar">account_circle</mat-icon>
            </div>
            <button mat-stroked-button color="primary" class="change-photo-btn">
              <mat-icon>camera_alt</mat-icon>
              Change Photo
            </button>
          </div>

          <mat-divider></mat-divider>

          <div class="profile-info">
            <div class="info-row">
              <div class="info-label">
                <mat-icon>person</mat-icon>
                <span>Full Name</span>
              </div>
              <div class="info-value">{{ user.name }} {{ user.surname }}</div>
            </div>

            <div class="info-row">
              <div class="info-label">
                <mat-icon>email</mat-icon>
                <span>Email</span>
              </div>
              <div class="info-value">{{ user.email }}</div>
            </div>

            <div class="info-row">
              <div class="info-label">
                <mat-icon>work</mat-icon>
                <span>Job Title</span>
              </div>
              <div class="info-value">{{ user.title || 'Not Set' }}</div>
            </div>

            <div class="info-row">
              <div class="info-label">
                <mat-icon>business</mat-icon>
                <span>Department</span>
              </div>
              <div class="info-value">{{ user.departmentName || 'Not Assigned' }}</div>
            </div>

            <div class="info-row">
              <div class="info-label">
                <mat-icon>badge</mat-icon>
                <span>Role</span>
              </div>
              <div class="info-value">
                <mat-chip-set>
                  <mat-chip [ngClass]="getRoleClass(user.role)">{{ user.role }}</mat-chip>
                </mat-chip-set>
              </div>
            </div>

            <div class="info-row" *ngIf="user.permissions">
              <div class="info-label">
                <mat-icon>security</mat-icon>
                <span>Permissions</span>
              </div>
              <div class="info-value permissions">
                <mat-chip-set>
                  <mat-chip *ngFor="let perm of getPermissions()" class="permission-chip">{{ perm }}</mat-chip>
                </mat-chip-set>
              </div>
            </div>

            <div class="info-row">
              <div class="info-label">
                <mat-icon>login</mat-icon>
                <span>Last Login</span>
              </div>
              <div class="info-value">{{ formatDate(user.lastLoginAt) }}</div>
            </div>
          </div>
        </mat-card>

        <!-- Actions Card -->
        <mat-card class="actions-card">
          <h3>Account Actions</h3>
          <mat-divider></mat-divider>
          <div class="actions-list">
            <button mat-stroked-button class="action-button" (click)="changePassword()">
              <mat-icon>lock</mat-icon>
              Change Password
            </button>
            <button mat-stroked-button class="action-button" (click)="editProfile()">
              <mat-icon>edit</mat-icon>
              Edit Profile
            </button>
            <button mat-stroked-button class="action-button logout" (click)="logout()">
              <mat-icon>logout</mat-icon>
              Logout
            </button>
          </div>
        </mat-card>
      </div>

      <!-- Loading State -->
      <div class="loading" *ngIf="!user">
        <mat-spinner diameter="50"></mat-spinner>
        <p>Loading profile...</p>
      </div>
    </div>
  `,
  styles: [`
    .profile-container {
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .profile-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      color: white;
    }

    .profile-header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 500;
    }

    .back-button {
      background: rgba(255,255,255,0.2);
      color: white;
    }

    .profile-content {
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .profile-card, .actions-card {
      border-radius: 16px;
      padding: 24px;
    }

    .profile-photo-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 0;
    }

    .profile-photo {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      overflow: hidden;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }

    .profile-photo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .profile-photo .default-avatar {
      font-size: 100px;
      width: 100px;
      height: 100px;
      color: white;
    }

    .change-photo-btn {
      margin-top: 8px;
    }

    .profile-info {
      padding: 24px 0;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 16px 0;
      border-bottom: 1px solid #eee;
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #666;
      font-weight: 500;
      min-width: 150px;
    }

    .info-label mat-icon {
      color: #667eea;
    }

    .info-value {
      color: #333;
      font-size: 16px;
      text-align: right;
      flex: 1;
    }

    .info-value.permissions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
    }

    .permission-chip {
      background: #e3f2fd !important;
      color: #1976d2 !important;
      font-size: 12px;
    }

    .role-admin {
      background: #f44336 !important;
      color: white !important;
    }

    .role-manager {
      background: #ff9800 !important;
      color: white !important;
    }

    .role-employee {
      background: #4caf50 !important;
      color: white !important;
    }

    .actions-card h3 {
      margin: 0 0 16px 0;
      color: #333;
    }

    .actions-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 16px;
    }

    .action-button {
      display: flex;
      align-items: center;
      gap: 12px;
      justify-content: flex-start;
      padding: 12px 16px;
      height: auto;
    }

    .action-button.logout {
      color: #f44336;
      border-color: #f44336;
    }

    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 50vh;
      color: white;
    }

    .loading p {
      margin-top: 16px;
      font-size: 16px;
    }

    @media (max-width: 600px) {
      .info-row {
        flex-direction: column;
        gap: 8px;
      }

      .info-value {
        text-align: left;
      }
    }
  `]
})
export class ProfileComponent implements OnInit {
  user: User | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.user = this.authService.currentUserValue;
    if (!this.user) {
      this.router.navigate(['/login']);
    }
  }

  goBack(): void {
    this.router.navigate(['/projects']);
  }

  getRoleClass(role: string): string {
    switch (role?.toLowerCase()) {
      case 'admin': return 'role-admin';
      case 'manager': return 'role-manager';
      default: return 'role-employee';
    }
  }

  getPermissions(): string[] {
    if (!this.user?.permissions) return [];
    return this.user.permissions.split(',').map(p => p.trim());
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-ZA', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  changePassword(): void {
    this.snackBar.open('Password change feature coming soon!', 'Close', { duration: 3000 });
  }

  editProfile(): void {
    this.snackBar.open('Edit profile feature coming soon!', 'Close', { duration: 3000 });
  }

  logout(): void {
    this.authService.logout();
  }
}


