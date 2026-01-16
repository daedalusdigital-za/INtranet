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
  
  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.user = this.authService.currentUserValue;
    if (!this.user) {
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadCallHistory();
    this.loadExtension();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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


