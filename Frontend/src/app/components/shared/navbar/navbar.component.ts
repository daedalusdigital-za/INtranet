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
import { AuthService } from '../../../services/auth.service';
import { MessageService, User, Conversation } from '../../../services/message.service';
import { ChatBubbleComponent } from '../../chat-bubble/chat-bubble.component';
import { UserSearchPopupComponent } from '../../user-search-popup/user-search-popup.component';
import { TodoDialogComponent } from '../../todo-dialog/todo-dialog.component';
import { RequestDialogComponent } from '../request-dialog/request-dialog.component';

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
                [matBadge]="notificationCount" 
                matBadgeColor="warn" 
                [matBadgeHidden]="notificationCount === 0"
                (click)="toggleNotifications($event)"
                matTooltip="Notifications">
          <mat-icon>notifications</mat-icon>
        </button>

        @if (showNotifications) {
          <div class="dropdown-panel notifications-dropdown" (click)="$event.stopPropagation()">
            <div class="dropdown-header">
              <h3>Notifications</h3>
              <button mat-icon-button (click)="showNotifications = false">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="dropdown-content">
              @if (notifications.length === 0) {
                <div class="empty-state">
                  <mat-icon>notifications_none</mat-icon>
                  <p>No notifications</p>
                </div>
              } @else {
                @for (notification of notifications; track notification.id) {
                  <div class="notification-item" [class.unread]="!notification.read">
                    <mat-icon [class]="'notification-icon ' + notification.type">{{ getNotificationIcon(notification.type) }}</mat-icon>
                    <div class="notification-content">
                      <div class="notification-title">{{ notification.title }}</div>
                      <div class="notification-message">{{ notification.message }}</div>
                      <div class="notification-time">{{ notification.time }}</div>
                    </div>
                  </div>
                }
              }
            </div>
            <div class="dropdown-footer">
              <button mat-button color="primary" (click)="viewAllNotifications()">View All Notifications</button>
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
        @if (isAdmin()) {
          <button mat-menu-item routerLink="/user-management">
            <mat-icon>admin_panel_settings</mat-icon>
            <span>User Management</span>
          </button>
        }
        <button mat-menu-item (click)="openTodoDialog()">
          <mat-icon>checklist</mat-icon>
          <span>ToDo</span>
        </button>
        <button mat-menu-item (click)="openRequestDialog()">
          <mat-icon>assignment</mat-icon>
          <span>Request</span>
        </button>
        <button mat-menu-item>
          <mat-icon>settings</mat-icon>
          <span>Settings</span>
        </button>
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

    .notification-content {
      flex: 1;
    }

    .notification-title {
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
    }

    .notification-message {
      font-size: 13px;
      color: #666;
    }

    .notification-time {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
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
  notificationCount: number = 3;
  unreadMessagesCount: number = 0;
  showMessages: boolean = false;
  showNotifications: boolean = false;
  showUserSearchPopup: boolean = false;
  recentConversations: any[] = [];
  activeChatBubbles: Conversation[] = [];
  
  notifications: any[] = [
    {
      id: 1,
      type: 'info',
      title: 'New Task Assigned',
      message: 'You have been assigned a new task in the Development board.',
      time: '5 min ago',
      read: false
    },
    {
      id: 2,
      type: 'success',
      title: 'Project Completed',
      message: 'The Marketing Campaign project has been marked as complete.',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      type: 'warning',
      title: 'Deadline Approaching',
      message: 'The Q4 Report is due in 2 days.',
      time: '2 hours ago',
      read: true
    }
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private messageService: MessageService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.currentUser = this.authService.currentUserValue;
    this.loadRecentConversations();
    this.loadUnreadCount();
    
    // Subscribe to active chat bubbles
    this.messageService.activeChats$.subscribe((chats: Conversation[]) => {
      this.activeChatBubbles = chats;
    });
  }

  ngOnDestroy(): void {}

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

  viewAllNotifications(): void {
    this.showNotifications = false;
    console.log('View all notifications');
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

  isAdmin(): boolean {
    return this.currentUser?.role === 'Admin' || this.currentUser?.role === 'Super Admin';
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}


