import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
import { User, CdrRecord, CdrQuery, CdrResponse, ExtensionStatus, Department } from '../../models/models';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { ToastService } from '../../ui/toast.service';

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
    MatTabsModule,
    MatTableModule,
    MatPaginatorModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule,
    MatTooltipModule,
    PageHeaderComponent,
    NavbarComponent,
    SkeletonRowsComponent
  ],
  template: `
    <app-navbar></app-navbar>
    <div class="profile-container">
      <app-page-header class="profile-header" [crumbs]="['Account']" title="Profile and password">
        <button aria-label="Back" mat-stroked-button (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
          Back
        </button>
      </app-page-header>

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
                <div class="profile-photo" (click)="triggerPhotoSelect()" title="Click to change photo">
                  <img *ngIf="user.profilePictureUrl" [src]="user.profilePictureUrl" alt="Profile Photo">
                  <mat-icon *ngIf="!user.profilePictureUrl" class="default-avatar">account_circle</mat-icon>
                  <div class="photo-overlay">
                    <mat-icon>{{ uploadingPhoto ? 'hourglass_top' : 'camera_alt' }}</mat-icon>
                  </div>
                </div>
                <input #photoInput type="file" accept="image/*" hidden (change)="onPhotoSelected($event)">
                <button mat-stroked-button color="primary" class="change-photo-btn" (click)="triggerPhotoSelect()" [disabled]="uploadingPhoto">
                  <mat-icon>camera_alt</mat-icon>
                  {{ uploadingPhoto ? 'Uploading...' : 'Change Photo' }}
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
                  <div class="info-value" *ngIf="!editingDetails">{{ user.title || 'Not Set' }}</div>
                  <div class="info-value" *ngIf="editingDetails">
                    <mat-form-field appearance="outline" class="edit-field">
                      <input matInput [(ngModel)]="editTitle" placeholder="Job title">
                    </mat-form-field>
                  </div>
                </div>

                <div class="info-row">
                  <div class="info-label">
                    <mat-icon>business</mat-icon>
                    <span>Department</span>
                  </div>
                  <div class="info-value" *ngIf="!editingDetails">{{ user.departmentName || 'Not Assigned' }}</div>
                  <div class="info-value" *ngIf="editingDetails">
                    <mat-form-field appearance="outline" class="edit-field">
                      <mat-select [(ngModel)]="editDepartmentId" placeholder="Select department">
                        <mat-option [value]="null">Not Assigned</mat-option>
                        <mat-option *ngFor="let d of departments" [value]="d.departmentId">{{ d.name }}</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </div>
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
                <!-- Edit details toggle -->
                <ng-container *ngIf="!editingDetails">
                  <button mat-stroked-button class="action-button" (click)="startEditDetails()">
                    <mat-icon>edit</mat-icon>
                    Edit Job Title & Department
                  </button>
                </ng-container>
                <ng-container *ngIf="editingDetails">
                  <button mat-flat-button color="primary" class="action-button" (click)="saveDetails()" [disabled]="savingDetails">
                    <mat-icon>save</mat-icon>
                    {{ savingDetails ? 'Saving...' : 'Save Changes' }}
                  </button>
                  <button mat-stroked-button class="action-button" (click)="cancelEditDetails()" [disabled]="savingDetails">
                    <mat-icon>close</mat-icon>
                    Cancel
                  </button>
                </ng-container>

                <!-- Change password toggle -->
                <button mat-stroked-button class="action-button" (click)="togglePasswordForm()" *ngIf="!showPasswordForm">
                  <mat-icon>lock</mat-icon>
                  Change Password
                </button>

                <div class="password-form" *ngIf="showPasswordForm">
                  <mat-form-field appearance="outline" class="pw-field">
                    <mat-label>Current Password</mat-label>
                    <input matInput type="password" [(ngModel)]="currentPassword" autocomplete="current-password">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="pw-field">
                    <mat-label>New Password</mat-label>
                    <input matInput type="password" [(ngModel)]="newPassword" autocomplete="new-password">
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="pw-field">
                    <mat-label>Confirm New Password</mat-label>
                    <input matInput type="password" [(ngModel)]="confirmPassword" autocomplete="new-password">
                  </mat-form-field>
                  <div class="pw-actions">
                    <button mat-flat-button color="primary" (click)="submitPasswordChange()" [disabled]="savingPassword">
                      <mat-icon>check</mat-icon>
                      {{ savingPassword ? 'Updating...' : 'Update Password' }}
                    </button>
                    <button mat-stroked-button (click)="togglePasswordForm()" [disabled]="savingPassword">
                      <mat-icon>close</mat-icon>
                      Cancel
                    </button>
                  </div>
                </div>

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
      <div class="profile-content" *ngIf="!user">
        <mat-card class="profile-card">
          <app-skeleton-rows [rows]="7" [avatar]="false"></app-skeleton-rows>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .profile-container {
      min-height: 100vh;
      padding: var(--space-5);
      position: relative;
      background: var(--color-canvas);
      overflow-x: hidden;
    }

    /* Page header: same width as the profile content below */
    .profile-header {
      max-width: 800px;
      margin: 0 auto var(--space-5);
    }

    .profile-content {
      max-width: 800px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .profile-card, .actions-card {
      border-radius: var(--radius-lg);
      padding: var(--space-5);
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
      background: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 16px;
      box-shadow: var(--shadow-md);
      position: relative;
      cursor: pointer;
    }

    .photo-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-scrim);
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .photo-overlay mat-icon {
      color: var(--color-on-dark);
      font-size: 40px;
      width: 40px;
      height: 40px;
    }

    .profile-photo:hover .photo-overlay {
      opacity: 1;
    }

    .edit-field {
      width: 220px;
    }

    .password-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 0;
    }

    .pw-field {
      width: 100%;
    }

    .pw-actions {
      display: flex;
      gap: 12px;
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
      color: var(--color-on-primary);
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
      border-bottom: 1px solid var(--color-line);
    }

    .info-row:last-child {
      border-bottom: none;
    }

    .info-label {
      display: flex;
      align-items: center;
      gap: 12px;
      color: var(--color-text-2);
      font-weight: 500;
      min-width: 150px;
    }

    .info-label mat-icon {
      color: var(--color-primary);
    }

    .info-value {
      color: var(--color-text);
      font-size: var(--text-lg);
      text-align: right;
      flex: 1;
    }

    .info-value.permissions {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
    }

    /* Chip colours go through Material's chip tokens; colouring the host directly left the
       label white on a white chip. */
    .permission-chip {
      --mdc-chip-elevated-container-color: var(--color-primary-soft);
      --mdc-chip-label-text-color: var(--color-primary);
      --mdc-chip-label-text-size: var(--text-xs);
    }
    .role-admin { --mdc-chip-elevated-container-color: var(--color-danger-soft); --mdc-chip-label-text-color: var(--color-danger); }
    .role-manager { --mdc-chip-elevated-container-color: var(--color-warn-soft); --mdc-chip-label-text-color: var(--color-warn); }
    .role-employee { --mdc-chip-elevated-container-color: var(--color-ok-soft); --mdc-chip-label-text-color: var(--color-ok); }

    .actions-card h3 {
      margin: 0 0 16px 0;
      color: var(--color-text);
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
      color: var(--color-danger);
      border-color: var(--color-danger);
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

    mat-tab-group {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      overflow: hidden;
    }

    ::ng-deep .mat-mdc-tab-body-wrapper {
      padding: 24px;
    }

    .not-set {
      color: var(--color-text-3);
      font-style: italic;
    }
  `]
})
export class ProfileComponent implements OnInit, OnDestroy {
  user: User | null = null;
  selectedTab = 0;

  @ViewChild('photoInput') photoInput!: ElementRef<HTMLInputElement>;

  // Profile picture upload
  uploadingPhoto = false;

  // Edit job title & department
  editingDetails = false;
  savingDetails = false;
  editTitle = '';
  editDepartmentId: number | null = null;
  departments: Department[] = [];

  // Change password
  showPasswordForm = false;
  savingPassword = false;
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  
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
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.user = this.authService.currentUserValue;
    if (!this.user) {
      this.router.navigate(['/login']);
      return;
    }
    
    this.loadCallHistory();
    this.loadExtension();
    this.loadDepartments();
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
    this.togglePasswordForm();
  }

  editProfile(): void {
    this.startEditDetails();
  }

  // ── Departments ──
  loadDepartments(): void {
    this.subscriptions.add(
      this.apiService.getDepartments().subscribe({
        next: (depts) => { this.departments = depts || []; },
        error: (err) => { console.error('Failed to load departments:', err); }
      })
    );
  }

  // ── Profile picture upload ──
  triggerPhotoSelect(): void {
    if (this.uploadingPhoto) return;
    this.photoInput?.nativeElement?.click();
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toast.warn('Please select an image file.');
      return;
    }

    this.uploadingPhoto = true;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Resize to a max of 256px (keeps data URL small) and export as JPEG.
        const maxSize = 256;
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          this.uploadingPhoto = false;
          this.toast.error('Could not process image.');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        this.savePhoto(dataUrl);
      };
      img.onerror = () => {
        this.uploadingPhoto = false;
        this.toast.error('Could not read image.');
      };
      img.src = reader.result as string;
    };
    reader.onerror = () => {
      this.uploadingPhoto = false;
      this.toast.error('Could not read file.');
    };
    reader.readAsDataURL(file);

    // Reset input so the same file can be re-selected later
    input.value = '';
  }

  private savePhoto(dataUrl: string): void {
    if (!this.user) { this.uploadingPhoto = false; return; }
    this.subscriptions.add(
      this.apiService.updateProfile(this.user.userId, { profilePictureUrl: dataUrl }).subscribe({
        next: () => {
          if (this.user) {
            this.user.profilePictureUrl = dataUrl;
          }
          this.authService.refreshUserData(this.user!.userId);
          this.uploadingPhoto = false;
          this.toast.done('Profile picture updated.');
        },
        error: (err) => {
          console.error('Failed to update photo:', err);
          this.uploadingPhoto = false;
          this.toast.error('Failed to update profile picture.');
        }
      })
    );
  }

  // ── Edit job title & department ──
  startEditDetails(): void {
    this.editTitle = this.user?.title || '';
    this.editDepartmentId = this.user?.departmentId ?? null;
    this.editingDetails = true;
  }

  cancelEditDetails(): void {
    this.editingDetails = false;
  }

  saveDetails(): void {
    if (!this.user) return;
    this.savingDetails = true;
    this.subscriptions.add(
      this.apiService.updateProfile(this.user.userId, {
        title: this.editTitle,
        departmentId: this.editDepartmentId ?? 0
      }).subscribe({
        next: () => {
          if (this.user) {
            this.user.title = this.editTitle;
            this.user.departmentId = this.editDepartmentId ?? undefined;
            const dept = this.departments.find(d => d.departmentId === this.editDepartmentId);
            this.user.departmentName = dept ? dept.name : undefined;
          }
          this.authService.refreshUserData(this.user!.userId);
          this.savingDetails = false;
          this.editingDetails = false;
          this.toast.done('Profile updated.');
        },
        error: (err) => {
          console.error('Failed to update profile:', err);
          this.savingDetails = false;
          this.toast.error('Failed to update profile.');
        }
      })
    );
  }

  // ── Change password ──
  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }

  submitPasswordChange(): void {
    if (!this.user) return;
    if (!this.currentPassword || !this.newPassword) {
      this.toast.warn('Please fill in all password fields.');
      return;
    }
    if (this.newPassword.length < 8) {
      this.toast.warn('New password must be at least 8 characters.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.toast.warn('New passwords do not match.');
      return;
    }
    this.savingPassword = true;
    this.subscriptions.add(
      this.apiService.changePassword(this.user.userId, {
        currentPassword: this.currentPassword,
        newPassword: this.newPassword
      }).subscribe({
        next: () => {
          this.savingPassword = false;
          this.showPasswordForm = false;
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.toast.done('Password changed successfully.');
        },
        error: (err) => {
          console.error('Failed to change password:', err);
          this.savingPassword = false;
          const msg = err?.error?.message || 'Failed to change password.';
          this.toast.error(msg);
        }
      })
    );
  }

  logout(): void {
    this.authService.logout();
  }
}


