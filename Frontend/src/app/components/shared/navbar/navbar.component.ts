import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../services/auth.service';
import { MessageService, User, Conversation } from '../../../services/message.service';
import { NotificationService, UnifiedNotification } from '../../../services/notification.service';
import { ChatBubbleComponent } from '../../chat-bubble/chat-bubble.component';
import { UserSearchPopupComponent } from '../../user-search-popup/user-search-popup.component';
import { TodoDialogComponent } from '../../todo-dialog/todo-dialog.component';
import { RequestDialogComponent } from '../request-dialog/request-dialog.component';
import { QuickPrintDialogComponent } from '../quick-print-dialog/quick-print-dialog.component';
import { AnnouncementDialogComponent } from '../announcement-dialog/announcement-dialog.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    ChatBubbleComponent,
    UserSearchPopupComponent
  ],
  template: `
    <mat-toolbar color="primary">
      <span class="brand">Promed Intranet</span>
      <span class="nav-spacer"></span>

      <button mat-button routerLink="/dashboard" routerLinkActive="active-link">
        <mat-icon>home</mat-icon> Home
      </button>
      <button mat-button routerLink="/calendar" routerLinkActive="active-link">
        <mat-icon>calendar_month</mat-icon> Calendar
      </button>
      <button mat-button routerLink="/crm" routerLinkActive="active-link">
        <mat-icon>people_outline</mat-icon> CRM
      </button>
      <button mat-button routerLink="/departments" routerLinkActive="active-link">
        <mat-icon>business</mat-icon> Project Management
      </button>
      <button mat-button routerLink="/people" routerLinkActive="active-link">
        <mat-icon>people</mat-icon> Human Resource
      </button>
      <button mat-button routerLink="/stock-management" routerLinkActive="active-link">
        <mat-icon>inventory</mat-icon> Stock Management
      </button>
      <button mat-button routerLink="/logistics" routerLinkActive="active-link">
        <mat-icon>local_shipping</mat-icon> Logistics
      </button>
      <button mat-button routerLink="/documents" routerLinkActive="active-link">
        <mat-icon>folder</mat-icon> Documents
      </button>
      <button mat-button routerLink="/support-ticket" routerLinkActive="active-link">
        <mat-icon>support_agent</mat-icon> Support Ticket
      </button>

      <span class="spacer"></span>

      <!-- Messages Button -->
      <div class="dropdown-container">
        <button mat-icon-button 
                [matBadge]="unreadMessagesCount" 
                matBadgeColor="accent" 
                [matBadgeHidden]="unreadMessagesCount === 0" 
                (click)="toggleMessages($event)" 
                matTooltip="Messages">
          <mat-icon>mail</mat-icon>
        </button>

        @if (showMessages) {
          <div class="dropdown-panel messages-dropdown" (click)="$event.stopPropagation()">
            <div class="dropdown-header">
              <h3>Messages</h3>
              <button mat-icon-button (click)="showMessages = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="dropdown-content">
              @if (recentConversations.length === 0) {
                <div class="empty-state">
                  <mat-icon>chat_bubble_outline</mat-icon>
                  <p>No messages yet</p>
                </div>
              } @else {
                @for (conv of recentConversations; track conv.conversationId) {
                  <div class="message-item" (click)="openConversation(conv)">
                    <div class="message-avatar">
                      <mat-icon>person</mat-icon>
                    </div>
                    <div class="message-content">
                      <div class="message-sender">{{ getOtherParticipantName(conv) }}</div>
                      <div class="message-preview">{{ conv.lastMessage?.content || 'No messages' }}</div>
                    </div>
                    <div class="message-time">{{ formatMessageTime(conv.lastMessageAt) }}</div>
                  </div>
                }
              }
            </div>
            <div class="dropdown-footer">
              <button mat-button color="primary" (click)="startNewConversation()">
                <mat-icon>add</mat-icon> Start Conversation
              </button>
              <button mat-button color="primary" (click)="viewAllMessages()">View All Messages</button>
            </div>
          </div>
        }
      </div>

      <!-- Notifications Button -->
      <div class="dropdown-container">
        <button mat-icon-button 
                [matBadge]="totalUnreadCount" 
                matBadgeColor="warn" 
                [matBadgeHidden]="totalUnreadCount === 0"
                (click)="toggleNotifications($event)"
                matTooltip="Notifications">
          <mat-icon>notifications</mat-icon>
        </button>

        @if (showNotifications) {
          <div class="dropdown-panel notifications-dropdown" (click)="$event.stopPropagation()">
            <div class="dropdown-header">
              <h3>Notifications</h3>
              <div class="header-actions">
                @if (totalUnreadCount > 0) {
                  <button mat-button color="primary" (click)="markAllRead()">Mark all read</button>
                }
                <button mat-icon-button (click)="showNotifications = false">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
            <div class="dropdown-content">
              @if (notificationsLoading) {
                <div class="loading-state">
                  <mat-spinner diameter="32"></mat-spinner>
                </div>
              } @else if (notifications.length === 0) {
                <div class="empty-state">
                  <mat-icon>notifications_none</mat-icon>
                  <p>No notifications</p>
                </div>
              } @else {
                @for (notification of notifications; track notification.id) {
                  <div class="notification-item" 
                       [class.unread]="!notification.isRead"
                       (click)="handleNotificationClick(notification)">
                    <mat-icon [class]="'notification-icon ' + notification.iconClass">
                      {{ notification.icon }}
                    </mat-icon>
                    <div class="notification-content">
                      <div class="notification-title">{{ notification.title }}</div>
                      <div class="notification-message">{{ notification.message }}</div>
                      <div class="notification-meta">
                        <span class="notification-type">{{ getNotificationTypeLabel(notification.type) }}</span>
                        <span class="notification-time">{{ getTimeAgo(notification.timestamp) }}</span>
                      </div>
                    </div>
                    @if (notification.actions && notification.actions.length > 0) {
                      <div class="notification-actions" (click)="$event.stopPropagation()">
                        @for (action of notification.actions; track action.action) {
                          <button mat-icon-button 
                                  [color]="action.color"
                                  [matTooltip]="action.label"
                                  (click)="handleNotificationAction(notification, action.action)">
                            <mat-icon>{{ action.action === 'accept' ? 'check_circle' : 'cancel' }}</mat-icon>
                          </button>
                        }
                      </div>
                    }
                    @if (respondingTo === notification.id) {
                      <mat-spinner diameter="24"></mat-spinner>
                    }
                  </div>
                }
              }
            </div>
          </div>
        }
      </div>

      <!-- User Menu -->
      <button mat-icon-button [matMenuTriggerFor]="menu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <div class="user-info" mat-menu-item disabled>
          <strong>{{ currentUser?.name }} {{ currentUser?.surname }}</strong>
          <small>{{ currentUser?.email }}</small>
        </div>
        <mat-divider></mat-divider>
        <button mat-menu-item (click)="goToProfile()">
          <mat-icon>person</mat-icon>
          <span>Profile</span>
        </button>
        <button mat-menu-item (click)="openTodoDialog()">
          <mat-icon>checklist</mat-icon>
          <span>ToDo</span>
        </button>
        <button mat-menu-item (click)="openRequestDialog()">
          <mat-icon>assignment</mat-icon>
          <span>Request</span>
        </button>
        <button mat-menu-item (click)="openQuickPrintDialog()">
          <mat-icon>print</mat-icon>
          <span>Quick Print</span>
        </button>
        @if (isAdmin() || isManager()) {
          <mat-divider></mat-divider>
          <button mat-menu-item routerLink="/call-center">
            <mat-icon>call</mat-icon>
            <span>Call Center</span>
          </button>
        }
        @if (isAdmin()) {
          <button mat-menu-item routerLink="/settings">
            <mat-icon>admin_panel_settings</mat-icon>
            <span>Admin Settings</span>
          </button>
        }
        <mat-divider></mat-divider>
        <button mat-menu-item (click)="logout()">
          <mat-icon>logout</mat-icon>
          <span>Logout</span>
        </button>
      </mat-menu>
    </mat-toolbar>
    <div class="toolbar-spacer"></div>

    <!-- User Search Popup -->
    @if (showUserSearchPopup) {
      <app-user-search-popup 
        [currentUserId]="currentUserId"
        (close)="closeUserSearchPopup()"
        (userSelected)="onUserSelected($event)">
      </app-user-search-popup>
    }

    <!-- Chat Bubbles -->
    @for (chat of activeChatBubbles; track chat.conversationId; let i = $index) {
      <app-chat-bubble
        [conversation]="chat"
        [currentUserId]="currentUserId"
        [position]="i"
        (close)="closeChatBubble($event)">
      </app-chat-bubble>
    }
  `,
  styles: [`
    :host {
      display: block;
      position: relative;
      height: 64px;
      margin-bottom: 0;
    }

    mat-toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      padding: 0 16px;
      height: 64px;
    }

    .toolbar-spacer {
      display: none;
    }

    .brand {
      font-size: 20px;
      font-weight: 600;
    }

    .nav-spacer {
      margin: 0 32px;
    }

    .spacer {
      flex: 1;
    }

    .active-link {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    .dropdown-container {
      position: relative;
    }

    .dropdown-panel {
      position: absolute;
      top: 48px;
      right: 0;
      width: 360px;
      max-height: 480px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      overflow: hidden;
      z-index: 1001;
    }

    .dropdown-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid #eee;
      background: #f5f5f5;
    }

    .dropdown-header h3 {
      margin: 0;
      font-size: 16px;
      color: #333;
    }

    .dropdown-content {
      max-height: 360px;
      overflow-y: auto;
    }

    .dropdown-footer {
      padding: 12px 16px;
      border-top: 1px solid #eee;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .dropdown-footer button {
      background: #1a237e !important;
      color: white !important;
      border-radius: 8px;
      font-weight: 500;
      padding: 8px 16px;
    }

    .dropdown-footer button:hover {
      background: #0d1453 !important;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      color: #999;
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 8px;
    }

    /* Message Items */
    .message-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      transition: background 0.2s;
    }

    .message-item:hover {
      background: #f5f5f5;
    }

    .message-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }

    .message-avatar mat-icon {
      color: white;
    }

    .message-content {
      flex: 1;
      min-width: 0;
    }

    .message-sender {
      font-weight: 500;
      color: #333;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .message-preview {
      font-size: 13px;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .message-time {
      font-size: 12px;
      color: #999;
      margin-left: 8px;
    }

    /* Notification Items */
    .notification-item {
      display: flex;
      align-items: flex-start;
      padding: 12px 16px;
      border-bottom: 1px solid #f0f0f0;
    }

    .notification-item.unread {
      background: #f8f9ff;
    }

    .notification-icon {
      margin-right: 12px;
      margin-top: 2px;
    }

    .notification-icon.info { color: #2196F3; }
    .notification-icon.warning { color: #FF9800; }
    .notification-icon.success { color: #4CAF50; }
    .notification-icon.error { color: #F44336; }
    .notification-icon.icon-primary { color: #3f51b5; }
    .notification-icon.icon-warning { color: #FF9800; }
    .notification-icon.icon-success { color: #4CAF50; }
    .notification-icon.icon-error { color: #F44336; }
    .notification-icon.icon-info { color: #2196F3; }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .notification-message {
      font-size: 13px;
      color: #666;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .notification-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
    }

    .notification-type {
      font-size: 11px;
      color: #fff;
      background: #9e9e9e;
      padding: 2px 6px;
      border-radius: 10px;
      text-transform: capitalize;
    }

    .notification-item[class*="meeting"] .notification-type { background: #3f51b5; }
    .notification-item[class*="announcement"] .notification-type { background: #ff9800; }

    .notification-time {
      font-size: 12px;
      color: #999;
    }

    .notification-actions {
      display: flex;
      gap: 4px;
      margin-left: 8px;
    }

    .loading-state {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 40px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .user-info {
      display: flex;
      flex-direction: column;
      padding: 8px 16px;
    }

    .user-info small {
      color: #666;
      font-size: 12px;
    }

    mat-divider {
      margin: 8px 0;
    }
  `]
})
export class NavbarComponent implements OnInit, OnDestroy {
  currentUser: any = null;
  totalUnreadCount: number = 0;
  unreadMessagesCount: number = 0;
  showMessages: boolean = false;
  showNotifications: boolean = false;
  showUserSearchPopup: boolean = false;
  recentConversations: any[] = [];
  activeChatBubbles: Conversation[] = [];
  notifications: UnifiedNotification[] = [];
  notificationsLoading: boolean = false;
  respondingTo: string | null = null;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private notificationService: NotificationService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.loadRecentConversations();
    this.loadUnreadCount();
    
    // Subscribe to unified notifications
    this.subscriptions.push(
      this.notificationService.notifications$.subscribe(notifications => {
        this.notifications = notifications;
      }),
      this.notificationService.totalUnread$.subscribe(count => {
        this.totalUnreadCount = count;
      }),
      this.notificationService.loading$.subscribe(loading => {
        this.notificationsLoading = loading;
      })
    );
    
    // Load notifications initially
    this.notificationService.loadAllNotifications();
    
    // Subscribe to active chat bubbles
    this.messageService.activeChats$.subscribe((chats: Conversation[]) => {
      this.activeChatBubbles = chats;
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    this.showMessages = false;
    this.showNotifications = false;
  }

  get currentUserId(): number {
    return this.authService.currentUserValue?.userId || 0;
  }

  toggleMessages(event: Event): void {
    event.stopPropagation();
    this.showMessages = !this.showMessages;
    this.showNotifications = false;
    if (this.showMessages) {
      this.loadRecentConversations();
    }
  }

  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.showNotifications = !this.showNotifications;
    this.showMessages = false;
    if (this.showNotifications) {
      this.notificationService.loadAllNotifications();
    }
  }

  loadRecentConversations(): void {
    if (this.currentUserId === 0) return;
    
    fetch(`${environment.apiUrl}/messages/conversations?userId=${this.currentUserId}`)
      .then(response => response.json())
      .then(data => {
        this.recentConversations = data.slice(0, 5);
      })
      .catch(error => {
        console.error('Error loading conversations:', error);
        this.recentConversations = [];
      });
  }

  loadUnreadCount(): void {
    if (this.currentUserId === 0) return;
    
    fetch(`${environment.apiUrl}/messages/unread-count?userId=${this.currentUserId}`)
      .then(response => response.json())
      .then(count => {
        this.unreadMessagesCount = count;
      })
      .catch(error => {
        console.error('Error loading unread count:', error);
        this.unreadMessagesCount = 0;
      });
  }

  getOtherParticipantName(conv: any): string {
    const otherParticipant = conv.participants?.find((p: any) => p.userId !== this.currentUserId);
    return otherParticipant ? `${otherParticipant.name} ${otherParticipant.surname || ''}`.trim() : 'Unknown';
  }

  formatMessageTime(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'info': return 'info';
      case 'warning': return 'warning';
      case 'success': return 'check_circle';
      case 'error': return 'error';
      default: return 'notifications';
    }
  }

  getNotificationTypeLabel(type: string): string {
    switch (type) {
      case 'meeting': return 'Meeting';
      case 'announcement': return 'Announcement';
      case 'task': return 'Task';
      case 'message': return 'Message';
      case 'system': return 'System';
      default: return type;
    }
  }

  getTimeAgo(date: Date): string {
    return this.notificationService.getTimeAgo(date);
  }

  handleNotificationClick(notification: UnifiedNotification): void {
    // Mark as read
    this.notificationService.markNotificationAsRead(notification.id);
    
    // Handle navigation based on type
    if (notification.type === 'meeting') {
      this.showNotifications = false;
      this.router.navigate(['/calendar']);
    } else if (notification.type === 'announcement') {
      this.showNotifications = false;
      this.router.navigate(['/dashboard']);
    }
  }

  handleNotificationAction(notification: UnifiedNotification, action: string): void {
    if (notification.type === 'meeting') {
      this.respondingTo = notification.id;
      const response = action === 'accept' ? 'Accepted' : 'Declined';
      this.notificationService.respondToMeetingNotification(notification.id, response).subscribe({
        next: () => {
          this.respondingTo = null;
        },
        error: () => {
          this.respondingTo = null;
        }
      });
    }
  }

  markAllRead(): void {
    this.notificationService.markAllNotificationsAsRead();
  }

  openConversation(conv: any): void {
    this.showMessages = false;
    // Open as chat bubble
    this.messageService.openChatBubble(conv as Conversation);
  }

  viewAllMessages(): void {
    this.showMessages = false;
    this.router.navigate(['/messages']);
  }

  startNewConversation(): void {
    this.showMessages = false;
    this.showUserSearchPopup = true;
  }

  closeUserSearchPopup(): void {
    this.showUserSearchPopup = false;
  }

  onUserSelected(user: User): void {
    this.showUserSearchPopup = false;
    
    // Start a conversation with this user
    this.messageService.startChatWithUser(user, this.currentUserId).subscribe({
      next: (conversation: Conversation) => {
        this.messageService.openChatBubble(conversation);
      },
      error: (err: any) => {
        console.error('Error starting conversation:', err);
      }
    });
  }

  closeChatBubble(conversationId: number): void {
    this.messageService.closeChatBubble(conversationId);
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  openTodoDialog(): void {
    this.dialog.open(TodoDialogComponent, {
      width: '1200px',
      maxWidth: '95vw',
      maxHeight: '85vh',
      data: { userId: this.currentUserId }
    });
  }

  openRequestDialog(): void {
    this.dialog.open(RequestDialogComponent, {
      width: '550px',
      maxWidth: '95vw',
      panelClass: 'centered-dialog'
    });
  }

  openQuickPrintDialog(): void {
    this.dialog.open(QuickPrintDialogComponent, {
      width: '650px',
      maxWidth: '95vw',
      panelClass: 'centered-dialog'
    });
  }

  openAnnouncementDialog(): void {
    this.dialog.open(AnnouncementDialogComponent, {
      width: '600px',
      maxWidth: '95vw',
      panelClass: 'centered-dialog'
    }).afterClosed().subscribe(result => {
      if (result) {
        // Announcement created successfully
        console.log('Announcement created:', result);
      }
    });
  }

  isAdmin(): boolean {
    return this.currentUser?.role === 'Admin' || this.currentUser?.role === 'Super Admin';
  }

  isManager(): boolean {
    const role = this.currentUser?.role?.toLowerCase() || '';
    return role.includes('admin') || role.includes('manager');
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}


