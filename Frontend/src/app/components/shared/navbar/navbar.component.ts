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
import { AuthService, MODULE_PERMISSIONS } from '../../../services/auth.service';
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
      @if (hasPermission('sales')) {
        <button mat-button routerLink="/sales" routerLinkActive="active-link">
          <mat-icon>point_of_sale</mat-icon> Sales
        </button>
      }
      @if (hasPermission('logistics')) {
        <button mat-button routerLink="/logistics" routerLinkActive="active-link">
          <mat-icon>local_shipping</mat-icon> Logistics
        </button>
      }
      @if (hasPermission('tenders')) {
        <button mat-button routerLink="/tenders" routerLinkActive="active-link">
          <mat-icon>gavel</mat-icon> Tenders
        </button>
      }
      @if (hasPermission('human_resource')) {
        <button mat-button routerLink="/people" routerLinkActive="active-link">
          <mat-icon>people</mat-icon> Human Resource
        </button>
      }
      @if (hasPermission('stock_management')) {
        <button mat-button routerLink="/stock-management" routerLinkActive="active-link">
          <mat-icon>inventory</mat-icon> Stock Management
        </button>
      }
      <button mat-button routerLink="/company-projects" routerLinkActive="active-link">
        <mat-icon>assignment</mat-icon> Projects
      </button>
      @if (hasPermission('documents')) {
        <button mat-button routerLink="/documents" routerLinkActive="active-link">
          <mat-icon>folder</mat-icon> Documents
        </button>
      }
      @if (hasPermission('support_tickets')) {
        <button mat-button routerLink="/support-ticket" routerLinkActive="active-link">
          <mat-icon>support_agent</mat-icon> Support Ticket
        </button>
      }

      <span class="spacer"></span>

      <!-- Messages Button -->
      @if (hasPermission('messaging')) {
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
            <div class="dropdown-panel modern-dropdown messages-dropdown" (click)="$event.stopPropagation()">
              <div class="dd-header">
                <div class="dd-header-left">
                  <mat-icon class="dd-header-icon">mail</mat-icon>
                  <h3>Messages</h3>
                  @if (unreadMessagesCount > 0) {
                    <span class="dd-count-badge">{{ unreadMessagesCount }}</span>
                  }
                </div>
                <button mat-icon-button class="dd-close-btn" (click)="showMessages = false">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <div class="dd-content">
              @if (recentConversations.length === 0) {
                <div class="dd-empty">
                  <div class="dd-empty-icon">
                    <mat-icon>chat_bubble_outline</mat-icon>
                  </div>
                  <p>No messages yet</p>
                  <span>Start a conversation with a colleague</span>
                </div>
              } @else {
                @for (conv of recentConversations; track conv.conversationId) {
                  <div class="dd-item msg-item" (click)="openConversation(conv)">
                    <div class="dd-item-avatar msg-avatar">
                      <mat-icon>person</mat-icon>
                    </div>
                    <div class="dd-item-body">
                      <div class="dd-item-title">{{ getOtherParticipantName(conv) }}</div>
                      <div class="dd-item-subtitle">{{ conv.lastMessage?.content || 'No messages' }}</div>
                    </div>
                    <div class="dd-item-time">{{ formatMessageTime(conv.lastMessageAt) }}</div>
                  </div>
                }
              }
            </div>
            <div class="dd-footer">
              <button class="dd-footer-btn" (click)="startNewConversation()">
                <mat-icon>add_circle_outline</mat-icon> New Conversation
              </button>
              <button class="dd-footer-btn dd-footer-secondary" (click)="viewAllMessages()">
                View All Messages
              </button>
            </div>
          </div>
        }
      </div>
      }

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
          <div class="dropdown-panel modern-dropdown notifications-dropdown" (click)="$event.stopPropagation()">
            <div class="dd-header">
              <div class="dd-header-left">
                <mat-icon class="dd-header-icon">notifications</mat-icon>
                <h3>Notifications</h3>
                @if (totalUnreadCount > 0) {
                  <span class="dd-count-badge">{{ totalUnreadCount }}</span>
                }
              </div>
              <div class="dd-header-actions">
                @if (totalUnreadCount > 0) {
                  <button class="dd-mark-read-btn" (click)="markAllRead()">
                    <mat-icon>done_all</mat-icon>
                    Mark all read
                  </button>
                }
                <button mat-icon-button class="dd-close-btn" (click)="showNotifications = false">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
            <div class="dd-content">
              @if (notificationsLoading) {
                <div class="dd-loading">
                  <mat-spinner diameter="32"></mat-spinner>
                  <span>Loading notifications...</span>
                </div>
              } @else if (notifications.length === 0) {
                <div class="dd-empty">
                  <div class="dd-empty-icon">
                    <mat-icon>notifications_none</mat-icon>
                  </div>
                  <p>All caught up!</p>
                  <span>No new notifications</span>
                </div>
              } @else {
                @for (notification of notifications; track notification.id) {
                  <div class="dd-item notif-item" 
                       [class.unread]="!notification.isRead"
                       (click)="handleNotificationClick(notification)">
                    <div class="notif-icon-wrapper" [ngClass]="notification.iconClass">
                      <mat-icon>{{ notification.icon }}</mat-icon>
                    </div>
                    <div class="dd-item-body">
                      <div class="dd-item-title">{{ notification.title }}</div>
                      <div class="dd-item-subtitle">{{ notification.message }}</div>
                      <div class="notif-meta">
                        <span class="notif-type-badge" [ngClass]="notification.iconClass">
                          {{ getNotificationTypeLabel(notification.type) }}
                        </span>
                        <span class="notif-time">
                          <mat-icon>schedule</mat-icon>
                          {{ getTimeAgo(notification.timestamp) }}
                        </span>
                      </div>
                    </div>
                    @if (notification.actions && notification.actions.length > 0) {
                      <div class="notif-action-btns" (click)="$event.stopPropagation()">
                        @for (action of notification.actions; track action.action) {
                          <button class="notif-action-btn" 
                                  [class.accept]="action.action === 'accept'"
                                  [class.decline]="action.action !== 'accept'"
                                  [matTooltip]="action.label"
                                  (click)="handleNotificationAction(notification, action.action)">
                            <mat-icon>{{ action.action === 'accept' ? 'check_circle' : 'cancel' }}</mat-icon>
                          </button>
                        }
                      </div>
                    }
                    @if (respondingTo === notification.id) {
                      <mat-spinner diameter="20"></mat-spinner>
                    }
                  </div>
                }
              }
            </div>
          </div>
        }
      </div>

      <!-- User Menu -->
      <button mat-icon-button [matMenuTriggerFor]="menu" class="profile-trigger">
        <div class="profile-avatar-btn">
          {{ currentUser?.name?.charAt(0) || 'U' }}{{ currentUser?.surname?.charAt(0) || '' }}
        </div>
      </button>
      <mat-menu #menu="matMenu" class="profile-menu-panel">
        <!-- User header -->
        <div class="pm-user-header" mat-menu-item disabled>
          <div class="pm-avatar">
            <span>{{ currentUser?.name?.charAt(0) || 'U' }}{{ currentUser?.surname?.charAt(0) || '' }}</span>
          </div>
          <div class="pm-user-details">
            <span class="pm-user-name">{{ currentUser?.name }} {{ currentUser?.surname }}</span>
            <span class="pm-user-email">{{ currentUser?.email }}</span>
          </div>
        </div>
        <div class="pm-divider"></div>
        <div class="pm-section-label">Account</div>
        <button mat-menu-item class="pm-menu-item" (click)="goToProfile()">
          <mat-icon class="pm-icon-blue">person</mat-icon>
          <span>Profile</span>
        </button>
        @if (hasPermission('project_management')) {
          <button mat-menu-item class="pm-menu-item" routerLink="/departments">
            <mat-icon class="pm-icon-purple">business</mat-icon>
            <span>Project Management</span>
          </button>
        }
        <div class="pm-divider"></div>
        <div class="pm-section-label">Tools</div>
        <button mat-menu-item class="pm-menu-item" (click)="openTodoDialog()">
          <mat-icon class="pm-icon-green">checklist</mat-icon>
          <span>ToDo</span>
        </button>
        <button mat-menu-item class="pm-menu-item" (click)="openRequestDialog()">
          <mat-icon class="pm-icon-amber">assignment</mat-icon>
          <span>Request</span>
        </button>
        <button mat-menu-item class="pm-menu-item" (click)="openQuickPrintDialog()">
          <mat-icon class="pm-icon-teal">print</mat-icon>
          <span>Quick Print</span>
        </button>
        @if (isAdmin() || isManager()) {
          <div class="pm-divider"></div>
          <div class="pm-section-label">Administration</div>
          <button mat-menu-item class="pm-menu-item" routerLink="/call-center">
            <mat-icon class="pm-icon-green">call</mat-icon>
            <span>Call Center</span>
          </button>
        }
        @if (isAdmin()) {
          <button mat-menu-item class="pm-menu-item" routerLink="/settings">
            <mat-icon class="pm-icon-red">admin_panel_settings</mat-icon>
            <span>Admin Settings</span>
          </button>
        }
        <div class="pm-divider"></div>
        <button mat-menu-item class="pm-menu-item" routerLink="/docs">
          <mat-icon class="pm-icon-blue">description</mat-icon>
          <span>Docs</span>
        </button>
        <div class="pm-divider"></div>
        <button mat-menu-item class="pm-menu-item pm-logout" (click)="logout()">
          <mat-icon class="pm-icon-red">logout</mat-icon>
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
      z-index: 1001;
    }

    /* =========== Modern Dropdown (shared) =========== */
    .modern-dropdown {
      width: 380px;
      max-height: 520px;
      background: linear-gradient(180deg, #1a1f2e 0%, #151922 100%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55), 0 0 40px rgba(102, 126, 234, 0.08);
      overflow: hidden;
      backdrop-filter: blur(24px);
      animation: ddSlideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes ddSlideIn {
      from { opacity: 0; transform: translateY(-8px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* Header */
    .dd-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.08) 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .dd-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .dd-header-icon {
      color: #667eea;
      font-size: 22px;
      width: 22px;
      height: 22px;
    }

    .dd-header h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      letter-spacing: 0.3px;
    }

    .dd-count-badge {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
      min-width: 20px;
      text-align: center;
      line-height: 16px;
    }

    .dd-header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .dd-mark-read-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(102, 126, 234, 0.15);
      border: 1px solid rgba(102, 126, 234, 0.25);
      color: #90a4f7;
      border-radius: 8px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .dd-mark-read-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .dd-mark-read-btn:hover {
      background: rgba(102, 126, 234, 0.25);
      color: white;
    }

    .dd-close-btn {
      color: rgba(255, 255, 255, 0.4) !important;
      transition: color 0.2s !important;
    }

    .dd-close-btn:hover {
      color: rgba(255, 255, 255, 0.85) !important;
    }

    /* Scrollable content */
    .dd-content {
      max-height: 380px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }

    .dd-content::-webkit-scrollbar {
      width: 5px;
    }
    .dd-content::-webkit-scrollbar-track {
      background: transparent;
    }
    .dd-content::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
    }

    /* Empty state */
    .dd-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      text-align: center;
    }

    .dd-empty-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(102, 126, 234, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
    }

    .dd-empty-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: rgba(102, 126, 234, 0.6);
    }

    .dd-empty p {
      margin: 0 0 4px;
      font-size: 14px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
    }

    .dd-empty span {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.3);
    }

    /* Loading */
    .dd-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px;
      color: rgba(255, 255, 255, 0.4);
      font-size: 12px;
    }

    /* ---- Shared item row ---- */
    .dd-item {
      display: flex;
      align-items: flex-start;
      padding: 12px 14px;
      cursor: pointer;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .dd-item:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .dd-item:last-child {
      border-bottom: none;
    }

    .dd-item-body {
      flex: 1;
      min-width: 0;
    }

    .dd-item-title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.88);
      margin-bottom: 3px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .dd-item-subtitle {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.42);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      line-height: 1.4;
    }

    .dd-item-time {
      font-size: 10.5px;
      color: rgba(255, 255, 255, 0.28);
      margin-left: 10px;
      white-space: nowrap;
      margin-top: 2px;
    }

    /* ---- Message items ---- */
    .dd-item-avatar {
      width: 38px;
      height: 38px;
      min-width: 38px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }

    .msg-avatar {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      box-shadow: 0 3px 10px rgba(102, 126, 234, 0.3);
    }

    .msg-avatar mat-icon {
      color: white;
      font-size: 20px;
    }

    .msg-item {
      align-items: center;
    }

    /* ---- Notification items ---- */
    .notif-item.unread {
      background: rgba(102, 126, 234, 0.06);
      border-left: 3px solid #667eea;
    }

    .notif-item.unread:hover {
      background: rgba(102, 126, 234, 0.1);
    }

    .notif-icon-wrapper {
      width: 36px;
      height: 36px;
      min-width: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      margin-top: 1px;
      transition: transform 0.2s;
    }

    .dd-item:hover .notif-icon-wrapper {
      transform: scale(1.08);
    }

    .notif-icon-wrapper mat-icon {
      font-size: 19px;
      width: 19px;
      height: 19px;
    }

    /* Icon wrapper colors */
    .notif-icon-wrapper.info,
    .notif-icon-wrapper.icon-info {
      background: rgba(33, 150, 243, 0.12);
    }
    .notif-icon-wrapper.info mat-icon,
    .notif-icon-wrapper.icon-info mat-icon { color: #42a5f5; }

    .notif-icon-wrapper.warning,
    .notif-icon-wrapper.icon-warning {
      background: rgba(255, 152, 0, 0.12);
    }
    .notif-icon-wrapper.warning mat-icon,
    .notif-icon-wrapper.icon-warning mat-icon { color: #ffa726; }

    .notif-icon-wrapper.success,
    .notif-icon-wrapper.icon-success {
      background: rgba(76, 175, 80, 0.12);
    }
    .notif-icon-wrapper.success mat-icon,
    .notif-icon-wrapper.icon-success mat-icon { color: #66bb6a; }

    .notif-icon-wrapper.error,
    .notif-icon-wrapper.icon-error {
      background: rgba(244, 67, 54, 0.12);
    }
    .notif-icon-wrapper.error mat-icon,
    .notif-icon-wrapper.icon-error mat-icon { color: #ef5350; }

    .notif-icon-wrapper.icon-primary {
      background: rgba(63, 81, 181, 0.12);
    }
    .notif-icon-wrapper.icon-primary mat-icon { color: #7986cb; }

    /* Notification meta row */
    .notif-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 6px;
    }

    .notif-type-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 6px;
      text-transform: capitalize;
      letter-spacing: 0.3px;
    }

    .notif-type-badge.info, .notif-type-badge.icon-info {
      background: rgba(33, 150, 243, 0.12); color: #64b5f6;
    }
    .notif-type-badge.warning, .notif-type-badge.icon-warning {
      background: rgba(255, 152, 0, 0.12); color: #ffb74d;
    }
    .notif-type-badge.success, .notif-type-badge.icon-success {
      background: rgba(76, 175, 80, 0.12); color: #81c784;
    }
    .notif-type-badge.error, .notif-type-badge.icon-error {
      background: rgba(244, 67, 54, 0.12); color: #e57373;
    }
    .notif-type-badge.icon-primary {
      background: rgba(63, 81, 181, 0.12); color: #9fa8da;
    }

    .notif-time {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 10.5px;
      color: rgba(255, 255, 255, 0.28);
    }

    .notif-time mat-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
    }

    /* Action buttons */
    .notif-action-btns {
      display: flex;
      gap: 4px;
      margin-left: 8px;
    }

    .notif-action-btn {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .notif-action-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .notif-action-btn.accept {
      background: rgba(76, 175, 80, 0.12);
      color: #66bb6a;
    }
    .notif-action-btn.accept:hover {
      background: rgba(76, 175, 80, 0.25);
      transform: scale(1.1);
    }

    .notif-action-btn.decline {
      background: rgba(244, 67, 54, 0.1);
      color: #ef5350;
    }
    .notif-action-btn.decline:hover {
      background: rgba(244, 67, 54, 0.2);
      transform: scale(1.1);
    }

    /* ---- Footer ---- */
    .dd-footer {
      padding: 10px 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .dd-footer-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
      padding: 9px 16px;
      border: none;
      border-radius: 10px;
      font-size: 12.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .dd-footer-btn mat-icon {
      font-size: 17px;
      width: 17px;
      height: 17px;
    }

    .dd-footer-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(102, 126, 234, 0.35);
    }

    .dd-footer-secondary {
      background: rgba(255, 255, 255, 0.06) !important;
      color: rgba(255, 255, 255, 0.6) !important;
    }

    .dd-footer-secondary:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      color: rgba(255, 255, 255, 0.85) !important;
      box-shadow: none !important;
    }

    /* =========== Profile Trigger Button =========== */
    .profile-trigger {
      margin-left: 4px;
    }

    .profile-avatar-btn {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      border: 2px solid rgba(255,255,255,0.3);
      transition: all 0.25s ease;
    }

    .profile-trigger:hover .profile-avatar-btn {
      border-color: rgba(255,255,255,0.7);
      transform: scale(1.08);
      box-shadow: 0 0 12px rgba(102, 126, 234, 0.5);
    }

    /* =========== Profile Menu Panel (::ng-deep for overlay) =========== */
    ::ng-deep .profile-menu-panel.mat-mdc-menu-panel {
      background: linear-gradient(180deg, #1a1f2e 0%, #151922 100%) !important;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px !important;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55), 0 0 40px rgba(102, 126, 234, 0.1) !important;
      padding: 6px 0 !important;
      min-width: 260px !important;
      overflow: hidden;
      backdrop-filter: blur(24px);
    }

    ::ng-deep .profile-menu-panel .mat-mdc-menu-content {
      padding: 4px 0 !important;
    }

    /* User header card */
    ::ng-deep .profile-menu-panel .pm-user-header.mat-mdc-menu-item {
      display: flex !important;
      align-items: center !important;
      gap: 12px;
      padding: 14px 16px !important;
      height: auto !important;
      opacity: 1 !important;
      cursor: default;
    }

    ::ng-deep .profile-menu-panel .pm-user-header:hover {
      background: transparent !important;
    }

    ::ng-deep .profile-menu-panel .pm-avatar {
      width: 42px;
      height: 42px;
      min-width: 42px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);
    }

    ::ng-deep .profile-menu-panel .pm-avatar span {
      color: white;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    ::ng-deep .profile-menu-panel .pm-user-details {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }

    ::ng-deep .profile-menu-panel .pm-user-name {
      color: rgba(255, 255, 255, 0.92) !important;
      font-size: 14px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    ::ng-deep .profile-menu-panel .pm-user-email {
      color: rgba(255, 255, 255, 0.4) !important;
      font-size: 11.5px;
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Section labels */
    ::ng-deep .profile-menu-panel .pm-section-label {
      padding: 8px 16px 4px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: rgba(255, 255, 255, 0.3);
      user-select: none;
    }

    /* Dividers */
    ::ng-deep .profile-menu-panel .pm-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.07), transparent);
      margin: 4px 14px;
    }

    /* Menu items */
    ::ng-deep .profile-menu-panel .pm-menu-item.mat-mdc-menu-item {
      color: rgba(255, 255, 255, 0.82) !important;
      border-radius: 8px;
      margin: 2px 6px;
      padding: 0 12px;
      height: 40px;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    ::ng-deep .profile-menu-panel .pm-menu-item.mat-mdc-menu-item:hover {
      background: rgba(255, 255, 255, 0.07) !important;
      transform: translateX(3px);
    }

    ::ng-deep .profile-menu-panel .pm-menu-item .mdc-list-item__primary-text {
      color: rgba(255, 255, 255, 0.82) !important;
    }

    ::ng-deep .profile-menu-panel .pm-menu-item .mat-icon {
      margin-right: 12px;
      font-size: 20px;
      width: 20px;
      height: 20px;
      line-height: 20px;
    }

    ::ng-deep .profile-menu-panel .pm-menu-item span {
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.2px;
    }

    /* Icon color classes */
    ::ng-deep .profile-menu-panel .pm-icon-blue   { color: #42a5f5 !important; }
    ::ng-deep .profile-menu-panel .pm-icon-purple { color: #ab47bc !important; }
    ::ng-deep .profile-menu-panel .pm-icon-green  { color: #66bb6a !important; }
    ::ng-deep .profile-menu-panel .pm-icon-teal   { color: #26a69a !important; }
    ::ng-deep .profile-menu-panel .pm-icon-amber  { color: #ffa726 !important; }
    ::ng-deep .profile-menu-panel .pm-icon-red    { color: #ef5350 !important; }

    /* Logout highlight */
    ::ng-deep .profile-menu-panel .pm-logout.mat-mdc-menu-item {
      color: rgba(239, 83, 80, 0.9) !important;
    }
    ::ng-deep .profile-menu-panel .pm-logout.mat-mdc-menu-item:hover {
      background: rgba(239, 83, 80, 0.1) !important;
    }
    ::ng-deep .profile-menu-panel .pm-logout .mdc-list-item__primary-text {
      color: rgba(239, 83, 80, 0.9) !important;
    }

    /* Hide the default mat-divider in this menu */
    ::ng-deep .profile-menu-panel .mat-divider {
      display: none;
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

  /**
   * Check if user has permission to access a module
   */
  hasPermission(module: string): boolean {
    return this.authService.hasModulePermission(module as any);
  }

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
    const token = localStorage.getItem('token');
    fetch(`${environment.apiUrl}/messages/conversations?userId=${this.currentUserId}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
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
    const token = localStorage.getItem('token');
    fetch(`${environment.apiUrl}/messages/unread-count?userId=${this.currentUserId}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
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


