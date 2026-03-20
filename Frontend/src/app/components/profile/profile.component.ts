import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { User, CdrRecord, CdrQuery, CdrResponse, ExtensionStatus } from '../../models/models';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTooltipModule
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
        <!-- Tab Group -->
        <mat-tab-group animationDuration="0ms" [(selectedIndex)]="selectedTab">
          <!-- Profile Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>person</mat-icon>
              <span class="tab-label">Profile</span>
            </ng-template>
            
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
                    <mat-icon>phone</mat-icon>
                    <span>Extension</span>
                  </div>
                  <div class="info-value">
                    <span *ngIf="getUserExtension()">{{ getUserExtension() }}</span>
                    <span *ngIf="!getUserExtension()" class="not-set">Not Assigned</span>
                  </div>
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
          </mat-tab>
        </mat-tab-group>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="!user">
        <div class="loading-card">
          <div class="lc-icon-wrap">
            <mat-icon class="lc-icon pulse-icon">person</mat-icon>
          </div>
          <h3>Loading Your Profile</h3>
          <p class="lc-subtitle">Fetching account details and preferences</p>
          <div class="lc-progress-wrap">
            <div class="lc-progress-track">
              <div class="lc-progress-fill" [style.width.%]="loadingProgress"></div>
            </div>
            <div class="lc-progress-info">
              <span class="lc-progress-message">{{ loadingMessage }}</span>
              <span class="lc-progress-pct">{{ loadingProgress | number:'1.0-0' }}%</span>
            </div>
          </div>
          <div class="lc-steps">
            <div class="lc-step" *ngFor="let step of loadingSteps; let i = index" [class.active]="loadingStage === i" [class.done]="loadingStage > i">
              <div class="lc-step-dot">
                <mat-icon *ngIf="loadingStage > i">check</mat-icon>
                <mat-icon *ngIf="loadingStage <= i">{{ step.icon }}</mat-icon>
              </div>
              <span class="lc-step-label">{{ step.label }}</span>
            </div>
          </div>
        </div>
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

    .loading-state {
      display: flex; justify-content: center; padding: 60px 20px; min-height: 50vh; align-items: center;
    }
    .loading-card {
      background: rgba(255,255,255,0.97); border-radius: 20px;
      padding: 48px 56px; text-align: center; box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      max-width: 520px; width: 100%;
    }
    .loading-card h3 { color: #1a1a2e; margin: 16px 0 6px; font-size: 20px; font-weight: 700; }
    .loading-card p { color: #64748b; margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
    .lc-icon-wrap {
      width: 72px; height: 72px; border-radius: 50%; margin: 0 auto;
      background: linear-gradient(135deg, rgba(102,126,234,0.15), rgba(118,75,162,0.12));
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(102,126,234,0.15);
    }
    .lc-icon { font-size: 36px; width: 36px; height: 36px; color: #667eea; }
    .pulse-icon { animation: pulseGlow 2s ease-in-out infinite; }
    @keyframes pulseGlow { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.08); } }
    .lc-subtitle { color: #94a3b8 !important; font-size: 13px !important; }
    .lc-progress-wrap { margin: 8px 0 24px; }
    .lc-progress-track { height: 8px; border-radius: 4px; background: #f1f5f9; overflow: hidden; position: relative; }
    .lc-progress-fill {
      height: 100%; border-radius: 4px;
      background: linear-gradient(90deg, #667eea, #818cf8, #764ba2);
      background-size: 200% 100%; animation: shimmer 2s ease-in-out infinite;
      transition: width 0.15s ease-out; position: relative;
    }
    .lc-progress-fill::after {
      content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 24px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4)); border-radius: 0 4px 4px 0;
    }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
    .lc-progress-info { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; font-size: 12px; }
    .lc-progress-message { color: #64748b; font-weight: 500; }
    .lc-progress-pct { color: #667eea; font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; }
    .lc-steps { display: flex; justify-content: space-between; gap: 4px; padding-top: 4px; border-top: 1px solid #e2e8f0; }
    .lc-step {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      flex: 1; padding-top: 16px; opacity: 0.35; transition: opacity 0.4s ease, transform 0.3s ease;
    }
    .lc-step.active { opacity: 1; transform: translateY(-2px); }
    .lc-step.done { opacity: 0.65; }
    .lc-step-dot {
      width: 32px; height: 32px; border-radius: 50%; background: #f1f5f9;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.3s ease, box-shadow 0.3s ease;
    }
    .lc-step-dot mat-icon { font-size: 16px; width: 16px; height: 16px; color: #94a3b8; transition: color 0.3s ease; }
    .lc-step.active .lc-step-dot { background: linear-gradient(135deg, #667eea, #764ba2); box-shadow: 0 2px 10px rgba(102,126,234,0.3); }
    .lc-step.active .lc-step-dot mat-icon { color: #fff; }
    .lc-step.done .lc-step-dot { background: #dcfce7; }
    .lc-step.done .lc-step-dot mat-icon { color: #16a34a; }
    .lc-step-label { font-size: 11px; font-weight: 600; color: #94a3b8; white-space: nowrap; }
    .lc-step.active .lc-step-label { color: #667eea; }
    .lc-step.done .lc-step-label { color: #16a34a; }

    @media (max-width: 600px) {
      .info-row {
        flex-direction: column;
        gap: 8px;
      }

      .info-value {
        text-align: left;
      }
    }

    /* Tab styles */
    .tab-label {
      margin-left: 8px;
    }

    .badge {
      background: #667eea;
      color: white;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 11px;
      margin-left: 8px;
    }

    mat-tab-group {
      background: white;
      border-radius: 16px;
      overflow: hidden;
    }

    ::ng-deep .mat-mdc-tab-body-wrapper {
      padding: 24px;
    }

    /* Call History Styles */
    .call-history-card {
      border-radius: 0;
      box-shadow: none;
      padding: 0;
    }

    .call-history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;
    }

    .call-history-header h2 {
      margin: 0;
      color: #333;
    }

    .call-stats {
      display: flex;
      gap: 24px;
    }

    .call-stats .stat {
      display: flex;
      align-items: center;
      gap: 6px;
      color: #666;
      font-size: 14px;
    }

    .call-stats .stat mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .filters-row {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      align-items: center;
    }

    .date-field {
      width: 180px;
    }

    .table-container {
      overflow-x: auto;
    }

    .call-table {
      width: 100%;
      border-collapse: collapse;
    }

    .call-table th,
    .call-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #eee;
    }

    .call-table th {
      background: #f5f5f5;
      font-weight: 600;
      color: #333;
    }

    .call-table tr:hover {
      background: #fafafa;
    }

    .call-table .no-data {
      text-align: center;
      color: #999;
      padding: 40px;
    }

    .call-outbound mat-icon { color: #4caf50; }
    .call-inbound mat-icon { color: #2196f3; }
    .call-missed mat-icon { color: #f44336; }

    .status-answered { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .status-noanswer, .status-busy { background: #ffebee !important; color: #c62828 !important; }
    .status-failed { background: #fce4ec !important; color: #ad1457 !important; }

    .loading-calls {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px;
      color: #666;
    }

    /* Extension Styles */
    .extension-card {
      border-radius: 0;
      box-shadow: none;
      padding: 0;
    }

    .extension-header {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
    }

    .extension-header h2 {
      margin: 0;
      color: #333;
    }

    .extension-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #667eea;
    }

    .extension-details {
      text-align: center;
    }

    .extension-number {
      margin-bottom: 16px;
    }

    .extension-number .label {
      display: block;
      color: #666;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .extension-number .value {
      font-size: 48px;
      font-weight: 600;
      color: #667eea;
    }

    .extension-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 500;
      margin-bottom: 24px;
    }

    .extension-status.status-available {
      background: #e8f5e9;
      color: #2e7d32;
    }

    .extension-status.status-busy {
      background: #fff3e0;
      color: #ef6c00;
    }

    .extension-status.status-ringing {
      background: #e3f2fd;
      color: #1565c0;
    }

    .extension-status.status-offline {
      background: #fafafa;
      color: #757575;
    }

    .extension-info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 24px 0;
      text-align: left;
    }

    .extension-info-grid .info-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .extension-info-grid .info-item mat-icon {
      color: #667eea;
      margin-top: 2px;
    }

    .extension-info-grid .label {
      display: block;
      color: #666;
      font-size: 12px;
    }

    .extension-info-grid .value {
      display: block;
      color: #333;
      font-weight: 500;
    }

    .quick-actions {
      padding-top: 24px;
    }

    .quick-actions h3 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 16px;
    }

    .action-buttons {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .no-extension {
      text-align: center;
      padding: 60px 20px;
      color: #666;
    }

    .no-extension mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      color: #ccc;
    }

    .no-extension h3 {
      margin: 16px 0 8px;
      color: #333;
    }

    .loading-extension {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px;
      color: #666;
    }

    .not-set {
      color: #999;
      font-style: italic;
    }
  `]
})
export class ProfileComponent implements OnInit, OnDestroy {
  user: User | null = null;
  selectedTab = 0;
  
  // Call History
  callHistory: CdrRecord[] = [];
  totalCalls = 0;
  outboundCalls = 0;
  inboundCalls = 0;
  missedCalls = 0;
  loadingCalls = false;
  startDate: Date = new Date(new Date().setMonth(new Date().getMonth() - 1));
  endDate: Date = new Date();
  pageSize = 10;
  pageIndex = 0;
  
  // Extension
  myExtension: ExtensionStatus | null = null;
  loadingExtension = false;

  // Loading progress
  loadingProgress = 0;
  loadingStage = 0;
  loadingMessage = 'Initializing...';
  private progressInterval: any;
  readonly loadingSteps = [
    { icon: 'lock', label: 'Authenticating', detail: 'Verifying credentials...' },
    { icon: 'person', label: 'Profile', detail: 'Loading profile data...' },
    { icon: 'badge', label: 'Details', detail: 'Fetching account details...' },
    { icon: 'dashboard', label: 'Ready', detail: 'Preparing your profile...' }
  ];
  
  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.startLoadingProgress();
    this.user = this.authService.currentUserValue;
    if (!this.user) {
      this.stopLoadingProgress();
      this.router.navigate(['/login']);
      return;
    }
    this.finishLoadingProgress(() => {});
    
    this.loadCallHistory();
    this.loadExtension();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.stopLoadingProgress();
  }

  private startLoadingProgress(): void {
    this.loadingProgress = 0;
    this.loadingStage = 0;
    this.loadingMessage = this.loadingSteps[0].detail;
    this.progressInterval = setInterval(() => {
      const max = 88;
      if (this.loadingProgress < max) {
        const increment = Math.max(0.3, (max - this.loadingProgress) * 0.06);
        this.loadingProgress = Math.min(max, this.loadingProgress + increment);
      }
      const newStage = this.loadingProgress < 20 ? 0 : this.loadingProgress < 45 ? 1 : this.loadingProgress < 70 ? 2 : 3;
      if (newStage !== this.loadingStage) {
        this.loadingStage = newStage;
        this.loadingMessage = this.loadingSteps[newStage].detail;
      }
    }, 120);
  }

  private finishLoadingProgress(callback: () => void): void {
    clearInterval(this.progressInterval);
    this.loadingStage = 3;
    this.loadingMessage = 'Almost there...';
    const finish = setInterval(() => {
      this.loadingProgress = Math.min(100, this.loadingProgress + 4);
      if (this.loadingProgress >= 100) {
        clearInterval(finish);
        this.loadingMessage = 'Complete!';
        setTimeout(() => callback(), 300);
      }
    }, 30);
  }

  private stopLoadingProgress(): void {
    clearInterval(this.progressInterval);
    this.loadingProgress = 0;
    this.loadingStage = 0;
  }

  loadCallHistory(): void {
    this.loadingCalls = true;
    const query: CdrQuery = {
      startDate: this.startDate,
      endDate: this.endDate,
      page: this.pageIndex + 1,
      pageSize: this.pageSize
    };
    
    // If user has extension, filter by it
    const userExt = this.getUserExtension();
    if (userExt) {
      query.extension = userExt;
    }
    
    this.subscriptions.add(
      this.apiService.getCallHistory(query).subscribe({
        next: (response: CdrResponse) => {
          this.callHistory = response.records || [];
          this.totalCalls = response.totalRecords || 0;
          this.calculateCallStats();
          this.loadingCalls = false;
        },
        error: (err: any) => {
          console.error('Failed to load call history:', err);
          this.loadingCalls = false;
          this.callHistory = [];
        }
      })
    );
  }

  calculateCallStats(): void {
    const userExt = this.getUserExtension();
    this.outboundCalls = this.callHistory.filter(c => 
      c.direction === 'outbound' || c.callerNumber === userExt || c.source === userExt || c.callerIdNum === userExt
    ).length;
    this.inboundCalls = this.callHistory.filter(c => 
      c.direction === 'inbound' || c.calleeNumber === userExt || c.destination === userExt
    ).length;
    this.missedCalls = this.callHistory.filter(c => 
      (c.disposition === 'NO ANSWER' || c.disposition === 'NOANSWER' || c.status === 'MISSED') && 
      (c.calleeNumber === userExt || c.destination === userExt)
    ).length;
  }

  loadExtension(): void {
    this.loadingExtension = true;
    this.subscriptions.add(
      this.apiService.getExtensionStatuses().subscribe({
        next: (extensions) => {
          // Find user's extension
          const userExt = this.getUserExtension();
          if (userExt) {
            this.myExtension = extensions.find(e => e.extension === userExt) || null;
          }
          this.loadingExtension = false;
        },
        error: (err) => {
          console.error('Failed to load extension:', err);
          this.loadingExtension = false;
        }
      })
    );
  }

  getUserExtension(): string | null {
    if (!this.user) return null;
    // Check primaryExtension first, then phoneExtension, then first extension in array
    return this.user.primaryExtension || 
           this.user.phoneExtension || 
           (this.user.extensions && this.user.extensions.length > 0 ? this.user.extensions[0].extensionNumber : null);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadCallHistory();
  }

  getCallTypeIcon(call: CdrRecord): string {
    const userExt = this.getUserExtension();
    if (call.direction === 'outbound' || call.callerNumber === userExt || call.source === userExt || call.callerIdNum === userExt) {
      return 'call_made';
    }
    if (call.disposition === 'NO ANSWER' || call.disposition === 'NOANSWER' || call.status === 'MISSED') {
      return 'call_missed';
    }
    return 'call_received';
  }

  getCallTypeClass(call: CdrRecord): string {
    const userExt = this.getUserExtension();
    if (call.direction === 'outbound' || call.callerNumber === userExt || call.source === userExt || call.callerIdNum === userExt) {
      return 'call-outbound';
    }
    if (call.disposition === 'NO ANSWER' || call.disposition === 'NOANSWER' || call.status === 'MISSED') {
      return 'call-missed';
    }
    return 'call-inbound';
  }

  getStatusClass(status: string | undefined): string {
    if (!status) return '';
    const s = status.toUpperCase();
    if (s === 'ANSWERED' || s === 'CONNECTED') return 'status-answered';
    if (s === 'NO ANSWER' || s === 'NOANSWER' || s === 'BUSY') return 'status-noanswer';
    if (s === 'FAILED') return 'status-failed';
    return '';
  }

  formatCallDate(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-ZA', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  getExtensionStatusClass(status: string | undefined): string {
    if (!status) return 'status-offline';
    const s = status.toLowerCase();
    if (s === 'available' || s === 'idle' || s === 'registered') return 'status-available';
    if (s === 'busy' || s === 'in use' || s === 'inuse') return 'status-busy';
    if (s === 'ringing') return 'status-ringing';
    return 'status-offline';
  }

  getExtensionStatusIcon(status: string | undefined): string {
    if (!status) return 'phone_disabled';
    const s = status.toLowerCase();
    if (s === 'available' || s === 'idle' || s === 'registered') return 'phone_enabled';
    if (s === 'busy' || s === 'in use' || s === 'inuse') return 'phone_in_talk';
    if (s === 'ringing') return 'ring_volume';
    return 'phone_disabled';
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


