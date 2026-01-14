import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MeetingService, MeetingNotification } from '../../../services/meeting.service';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-meeting-notifications',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <button 
      mat-icon-button 
      [matMenuTriggerFor]="notificationMenu"
      (menuOpened)="onMenuOpened()">
      <mat-icon 
        [matBadge]="unreadCount > 0 ? unreadCount : null" 
        matBadgeColor="warn"
        matBadgeSize="small">
        notifications
      </mat-icon>
    </button>

    <mat-menu #notificationMenu="matMenu" class="notification-menu">
      <div class="notification-header" (click)="$event.stopPropagation()">
        <span>Meeting Notifications</span>
        @if (unreadCount > 0) {
          <button mat-button color="primary" (click)="markAllRead()">
            Mark all read
          </button>
        }
      </div>
      
      <mat-divider></mat-divider>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner diameter="30"></mat-spinner>
        </div>
      } @else if (notifications.length === 0) {
        <div class="empty-state">
          <mat-icon>notifications_none</mat-icon>
          <span>No notifications</span>
        </div>
      } @else {
        <div class="notification-list">
          @for (notification of notifications; track notification.id) {
            <div 
              class="notification-item" 
              [class.unread]="!notification.isRead"
              (click)="handleNotificationClick(notification, $event)">
              <div class="notification-icon" [ngClass]="getNotificationClass(notification)">
                <mat-icon>{{ getNotificationIcon(notification) }}</mat-icon>
              </div>
              <div class="notification-content">
                <p class="notification-message">{{ notification.message }}</p>
                <div class="notification-details">
                  <span class="meeting-title">{{ notification.meetingTitle }}</span>
                  <span class="meeting-time">
                    {{ formatDate(notification.meetingDate) }} at {{ notification.startTime }}
                  </span>
                </div>
                <span class="notification-time">{{ getTimeAgo(notification.createdAt) }}</span>
              </div>
              
              @if (notification.notificationType === 'Invitation' && !respondingTo.includes(notification.id)) {
                <div class="response-actions" (click)="$event.stopPropagation()">
                  <button 
                    mat-icon-button 
                    color="primary" 
                    matTooltip="Accept"
                    (click)="respondToMeeting(notification, 'Accepted')">
                    <mat-icon>check_circle</mat-icon>
                  </button>
                  <button 
                    mat-icon-button 
                    color="warn" 
                    matTooltip="Decline"
                    (click)="respondToMeeting(notification, 'Declined')">
                    <mat-icon>cancel</mat-icon>
                  </button>
                </div>
              }
              
              @if (respondingTo.includes(notification.id)) {
                <mat-spinner diameter="24"></mat-spinner>
              }
            </div>
          }
        </div>
      }
    </mat-menu>
  `,
  styles: [`
    :host {
      display: inline-block;
    }

    ::ng-deep .notification-menu {
      width: 380px;
      max-height: 500px;
    }

    .notification-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      font-weight: 600;
      color: #333;
    }

    .notification-header button {
      font-size: 0.8rem;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 40px 20px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    .notification-list {
      max-height: 400px;
      overflow-y: auto;
    }

    .notification-item {
      display: flex;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;
      border-bottom: 1px solid #f0f0f0;
    }

    .notification-item:hover {
      background: #f5f5f5;
    }

    .notification-item.unread {
      background: #e3f2fd;
    }

    .notification-item.unread:hover {
      background: #bbdefb;
    }

    .notification-icon {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .notification-icon mat-icon {
      color: white;
    }

    .notification-icon.invitation {
      background: #2196f3;
    }

    .notification-icon.response {
      background: #4caf50;
    }

    .notification-icon.update {
      background: #ff9800;
    }

    .notification-icon.cancellation {
      background: #f44336;
    }

    .notification-icon.reminder {
      background: #9c27b0;
    }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-message {
      margin: 0 0 4px 0;
      font-size: 0.9rem;
      color: #333;
      line-height: 1.4;
    }

    .notification-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 4px;
    }

    .meeting-title {
      font-weight: 500;
      font-size: 0.85rem;
      color: #1976d2;
    }

    .meeting-time {
      font-size: 0.8rem;
      color: #666;
    }

    .notification-time {
      font-size: 0.75rem;
      color: #999;
    }

    .response-actions {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .response-actions button {
      width: 32px;
      height: 32px;
    }

    .response-actions button mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
  `]
})
export class MeetingNotificationsComponent implements OnInit, OnDestroy {
  notifications: MeetingNotification[] = [];
  unreadCount = 0;
  loading = false;
  respondingTo: number[] = [];
  
  private refreshSubscription?: Subscription;

  constructor(
    private meetingService: MeetingService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.refreshUnreadCount();
    
    // Refresh count every 30 seconds
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.refreshUnreadCount();
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  refreshUnreadCount(): void {
    this.meetingService.getUnreadCount().subscribe({
      next: (result) => {
        this.unreadCount = result.count;
      }
    });
  }

  onMenuOpened(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.loading = true;
    this.meetingService.getNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  getNotificationIcon(notification: MeetingNotification): string {
    switch (notification.notificationType) {
      case 'Invitation': return 'mail';
      case 'Response': return 'how_to_reg';
      case 'Update': return 'update';
      case 'Cancellation': return 'cancel';
      case 'Reminder': return 'alarm';
      default: return 'notifications';
    }
  }

  getNotificationClass(notification: MeetingNotification): string {
    return notification.notificationType.toLowerCase();
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (d.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
    }
  }

  getTimeAgo(date: Date | string): string {
    const now = new Date();
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  }

  handleNotificationClick(notification: MeetingNotification, event: Event): void {
    if (!notification.isRead) {
      this.meetingService.markNotificationRead(notification.id).subscribe({
        next: () => {
          notification.isRead = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
      });
    }
  }

  respondToMeeting(notification: MeetingNotification, response: 'Accepted' | 'Declined'): void {
    this.respondingTo.push(notification.id);
    
    this.meetingService.respondToMeeting(notification.meetingId, response).subscribe({
      next: () => {
        this.respondingTo = this.respondingTo.filter(id => id !== notification.id);
        this.snackBar.open(
          `Meeting ${response.toLowerCase()}!`,
          'Close',
          { duration: 3000, panelClass: response === 'Accepted' ? 'success-snackbar' : 'warn-snackbar' }
        );
        
        // Mark as read and refresh
        if (!notification.isRead) {
          notification.isRead = true;
          this.unreadCount = Math.max(0, this.unreadCount - 1);
        }
        
        // Remove from list after response
        this.notifications = this.notifications.filter(n => n.id !== notification.id);
      },
      error: (err) => {
        this.respondingTo = this.respondingTo.filter(id => id !== notification.id);
        this.snackBar.open(
          err.error?.error || 'Failed to respond',
          'Close',
          { duration: 3000, panelClass: 'error-snackbar' }
        );
      }
    });
  }

  markAllRead(): void {
    this.meetingService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => n.isRead = true);
        this.unreadCount = 0;
      }
    });
  }
}
