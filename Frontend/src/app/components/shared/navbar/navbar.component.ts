import { Component, OnInit, OnDestroy, HostListener, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute, IsActiveMatchOptions } from '@angular/router';
import { environment } from '../../../../environments/environment';
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
import { WellyActivityService } from '../../../services/welly-activity.service';
import { PaperlessService } from '../../../services/paperless.service';
import { ChatBubbleComponent } from '../../chat-bubble/chat-bubble.component';
import { UserSearchPopupComponent } from '../../user-search-popup/user-search-popup.component';
import { TodoDialogComponent } from '../../todo-dialog/todo-dialog.component';
import { RequestDialogComponent } from '../request-dialog/request-dialog.component';
import { AssetRegisterDialogComponent } from '../../asset-register/asset-register-dialog.component';
import { AnnouncementDialogComponent } from '../announcement-dialog/announcement-dialog.component';
import { BooksDepartmentDialogComponent } from '../../books-department-dialog/books-department-dialog.component';
import { IHatePdfDialogComponent } from '../../i-hate-pdf/i-hate-pdf-dialog.component';
import { UploaderDialogComponent } from '../../uploader/uploader-dialog.component';
import { CommandPaletteComponent, PaletteCommand } from '../../../ui/command-palette/command-palette.component';
import { SubPage } from '../../../ui/sub-pages';
import { AppearanceService, Density, ThemeChoice } from '../../../ui/appearance.service';
import { LOGISTICS_SECTIONS } from '../../logistics/logistics-sections';
import { SALES_SECTIONS } from '../../sales/sales-sections';
import { STOCK_SECTIONS } from '../../stock-management/stock-sections';
import { Subscription } from 'rxjs';

interface NavItem {
  label: string;
  icon?: string;
  route?: string;
  query?: Record<string, string>;
  perm?: string;
  exact?: boolean;
  sub?: boolean;
  action?: 'paperless';
  badge?: 'messages';
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    MatDividerModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    ChatBubbleComponent,
    UserSearchPopupComponent,
    CommandPaletteComponent
  ],
  template: `
    <a class="skip-link" href="#" (click)="skipToContent($event)">Skip to main content</a>
    <aside class="sb" [class.sb-collapsed]="collapsed" [class.sb-open]="mobileOpen" aria-label="Main navigation">
      <a class="sb-brand" routerLink="/dashboard" (click)="mobileOpen = false">
        <span class="sb-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="sb-brand-text">Promed Intranet<small>Promed Technologies</small></span>
      </a>
      <nav class="sb-nav">
        @for (group of visibleNavGroups(); track group.label) {
          <div class="sb-group">{{ group.label }}</div>
          @for (item of group.items; track item.label) {
            @if (item.action === 'paperless') {
              <button type="button" class="sb-item" [class.active]="paperless.isOpen('right')"
                      (click)="paperless.toggle('right'); mobileOpen = false"
                      [matTooltip]="collapsed ? item.label : ''" matTooltipPosition="right">
                <mat-icon>{{ item.icon }}</mat-icon><span class="sb-label">{{ item.label }}</span>
              </button>
            } @else {
              <a class="sb-item" [class.sb-sub]="item.sub" [routerLink]="item.route" [queryParams]="item.query ?? null"
                 routerLinkActive="active" [routerLinkActiveOptions]="item.query || item.exact ? exactMatch : subsetMatch"
                 (click)="mobileOpen = false" [matTooltip]="collapsed ? item.label : ''" matTooltipPosition="right">
                @if (!item.sub) { <mat-icon>{{ item.icon }}</mat-icon> }
                <span class="sb-label">{{ item.label }}</span>
                @if (item.badge === 'messages' && unreadMessagesCount > 0) {
                  <span class="sb-count">{{ unreadMessagesCount }}</span>
                }
              </a>
            }
          }
        }
      </nav>
      <div class="sb-foot">
        @if (isAdmin()) {
          <a class="sb-item" routerLink="/settings" routerLinkActive="active" (click)="mobileOpen = false"
             [matTooltip]="collapsed ? 'Admin settings' : ''" matTooltipPosition="right">
            <mat-icon>settings</mat-icon><span class="sb-label">Admin settings</span>
          </a>
        }
        <button type="button" class="sb-item sb-collapse" (click)="toggleCollapsed()"
                [attr.aria-label]="collapsed ? 'Expand the sidebar' : 'Collapse the sidebar'">
          <mat-icon>{{ collapsed ? 'chevron_right' : 'chevron_left' }}</mat-icon><span class="sb-label">Collapse</span>
        </button>
      </div>
    </aside>
    @if (mobileOpen) {
      <div class="sb-scrim" (click)="mobileOpen = false"></div>
    }

    <header class="tb">
      <button mat-icon-button class="tb-menu" (click)="mobileOpen = !mobileOpen" aria-label="Open the navigation">
        <mat-icon>menu</mat-icon>
      </button>
      <!-- One search for pages, tools, people and Paperless lookups (Ctrl K) -->
      <button type="button" class="tb-search" [class.busy]="paperless.searching()" (click)="paletteOpen = true"
              aria-label="Search the intranet (Ctrl K)">
        <mat-icon>search</mat-icon>
        <span class="tb-search-text">Search pages, people, invoices or barcodes</span>
        <kbd>Ctrl K</kbd>
      </button>
      <span class="tb-spacer"></span>

      <!-- Global 'Welly is working…' indicator -->
      @if (wellyActivity.isBusy()) {
        <div class="welly-working" [matTooltip]="wellyTasksTooltip()" matTooltipClass="welly-tip">
          <span class="ww-orb">
            <mat-icon class="ww-spark">auto_awesome</mat-icon>
          </span>
          <span class="ww-label">Welly is working…</span>
          @if (wellyActivity.count() > 1) {
            <span class="ww-badge">{{ wellyActivity.count() }}</span>
          }
        </div>
      }

      <button mat-icon-button [matMenuTriggerFor]="toolsMenu" matTooltip="Tools" aria-label="Tools">
        <mat-icon>apps</mat-icon>
      </button>
      <mat-menu #toolsMenu="matMenu" class="shell-menu tools-menu" xPosition="before">
        <div class="sm-label">Write and plan</div>
        <button mat-menu-item routerLink="/docs"><mat-icon>description</mat-icon><span class="sm-text">Docs<small>Write and edit documents together</small></span></button>
        <button mat-menu-item (click)="openTodoDialog()"><mat-icon>checklist</mat-icon><span class="sm-text">To-do<small>Your tasks and reminders</small></span></button>
        <button mat-menu-item (click)="openRequestDialog()"><mat-icon>assignment</mat-icon><span class="sm-text">Requests<small>HR requests and meeting bookings</small></span></button>
        <div class="sm-label">Files</div>
        <button mat-menu-item (click)="openUploaderDialog()"><mat-icon>cloud_upload</mat-icon><span class="sm-text">Uploader<small>Import invoice sheets and PODs</small></span></button>
        <button mat-menu-item (click)="openIHatePdfDialog()"><mat-icon>picture_as_pdf</mat-icon><span class="sm-text">PDF tools<small>Merge, split and compress PDFs</small></span></button>
        <button mat-menu-item (click)="openBooksDialog()"><mat-icon>menu_book</mat-icon><span class="sm-text">Books<small>Each department's books</small></span></button>
        <button mat-menu-item routerLink="/archives"><mat-icon>inventory</mat-icon><span class="sm-text">Email archives<small>Search old company mailboxes</small></span></button>
        <div class="sm-label">This computer</div>
        <button mat-menu-item (click)="downloadNotifier()"><mat-icon>desktop_windows</mat-icon><span class="sm-text">Desktop notifier<small>Alerts on your Windows desktop</small></span></button>
      </mat-menu>

      @if (hasPermission('messaging')) {
        <div class="dropdown-container">
          <button aria-label="Messages" mat-icon-button 
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
                <button aria-label="Close" mat-icon-button class="dd-close-btn" (click)="showMessages = false">
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
              <button class="dd-footer-btn dd-footer-email" (click)="viewEmails()">
                <mat-icon>email</mat-icon> View Emails
              </button>
            </div>
          </div>
        }
      </div>
      }

      <!-- Notifications Button -->
      <div class="dropdown-container">
        <button aria-label="Notifications" mat-icon-button 
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
                <button aria-label="Close" mat-icon-button class="dd-close-btn" (click)="showNotifications = false">
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
                          <button [attr.aria-label]="action.label" class="notif-action-btn" 
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
      <mat-menu #menu="matMenu" class="shell-menu profile-menu-panel" xPosition="before">
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
        <button mat-menu-item class="pm-menu-item" (click)="goToProfile()">
          <mat-icon>person</mat-icon>
          <span>Profile and password</span>
        </button>
        @if (isAdmin()) {
          <button mat-menu-item class="pm-menu-item" routerLink="/settings">
            <mat-icon>settings</mat-icon>
            <span>Admin settings</span>
          </button>
        }
        <button mat-menu-item class="pm-menu-item" [matMenuTriggerFor]="appearanceMenu">
          <mat-icon>{{ appearance.dark() ? 'dark_mode' : 'light_mode' }}</mat-icon>
          <span>Appearance</span>
        </button>
        <div class="pm-divider"></div>
        <button mat-menu-item class="pm-menu-item pm-logout" (click)="logout()">
          <mat-icon>logout</mat-icon>
          <span>Sign out</span>
        </button>
      </mat-menu>
      <!-- Light or dark, and row density (design review D-04). Kept on this computer. -->
      <mat-menu #appearanceMenu="matMenu" class="shell-menu profile-menu-panel">
        <div class="pm-group" role="presentation">Theme</div>
        @for (t of themeChoices; track t.value) {
          <button mat-menu-item class="pm-menu-item" role="menuitemradio" [attr.aria-checked]="appearance.theme() === t.value"
                  (click)="appearance.setTheme(t.value); $event.stopPropagation()">
            <mat-icon>{{ appearance.theme() === t.value ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
            <span>{{ t.label }}</span>
          </button>
        }
        <div class="pm-divider"></div>
        <div class="pm-group" role="presentation">Rows</div>
        @for (d of densityChoices; track d.value) {
          <button mat-menu-item class="pm-menu-item" role="menuitemradio" [attr.aria-checked]="appearance.density() === d.value"
                  (click)="appearance.setDensity(d.value); $event.stopPropagation()">
            <mat-icon>{{ appearance.density() === d.value ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
            <span>{{ d.label }}</span>
          </button>
        }
      </mat-menu>
    </header>

    @if (paletteOpen) {
      <app-command-palette
        [commands]="paletteCommands()"
        [currentUserId]="currentUserId"
        (close)="paletteOpen = false"
        (messagePerson)="onUserSelected($event)"
        (lookup)="lookupInPaperless($event)">
      </app-command-palette>
    }

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
    /* App shell (design review D-05): fixed sidebar + top bar. The host is a spacer
       the height of the top bar; the sidebar offset is a body class (styles/_shell.scss). */
    :host {
      display: block;
      height: var(--shell-topbar-height);
    }

    /* ---------- Sidebar ---------- */
    .sb {
      position: fixed;
      inset: 0 auto 0 0;
      width: var(--shell-sidebar-width);
      z-index: 1001;
      display: flex;
      flex-direction: column;
      background: var(--nav-bg);
      color: var(--nav-text);
      padding: 14px 10px 10px;
      transition: width 0.18s ease, transform 0.2s ease;
    }
    .sb-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 2px 8px 14px;
      color: var(--color-on-dark);
      text-decoration: none;
      font-weight: 800;
      font-size: 15px;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }
    .sb-brand-text small {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: var(--nav-text-dim);
      letter-spacing: 0.02em;
    }
    /* Three hexagons, after the logo */
    .sb-mark { position: relative; width: 22px; height: 25px; flex: none; }
    .sb-mark i { position: absolute; width: 11px; height: 12.5px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); }
    .sb-mark i:nth-child(1) { left: 0; top: 0; background: var(--color-focus); }
    .sb-mark i:nth-child(2) { left: 11.5px; top: 0; background: #2167a8; }
    .sb-mark i:nth-child(3) { left: 5.75px; top: 10px; background: var(--color-surface); opacity: 0.9; }

    .sb-nav {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 2px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
    }
    .sb-group {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--nav-text-dim);
      padding: 14px 10px 6px;
      white-space: nowrap;
    }
    .sb-group:first-child { padding-top: 4px; }
    .sb-item {
      display: flex;
      align-items: center;
      gap: 11px;
      width: 100%;
      padding: 7px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--nav-text);
      font: 600 13.5px var(--font-body);
      text-align: left;
      text-decoration: none;
      white-space: nowrap;
      cursor: pointer;
    }
    .sb-item:hover { background: var(--nav-hover); color: var(--color-on-dark); }
    .sb-item:focus-visible { outline: 2px solid var(--color-focus); outline-offset: -2px; }
    .sb-item mat-icon { font-size: 20px; width: 20px; height: 20px; color: var(--nav-text-dim); flex: none; }
    .sb-item.active { background: var(--nav-active); color: var(--color-on-dark); }
    .sb-item.active mat-icon { color: var(--color-focus); }
    .sb-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .sb-count {
      font: 600 11px var(--font-mono);
      color: var(--color-on-dark);
      background: rgba(255, 255, 255, 0.16);
      padding: 1px 7px;
      border-radius: 999px;
    }
    /* Sub-items (company projects) hang off a thin rail */
    .sb-item.sb-sub {
      position: relative;
      padding: 5px 10px 5px 41px;
      font-size: 13px;
      color: var(--nav-text-dim);
    }
    .sb-item.sb-sub::before {
      content: '';
      position: absolute;
      left: 20px;
      top: 0;
      bottom: 0;
      width: 1px;
      background: rgba(255, 255, 255, 0.14);
    }
    .sb-item.sb-sub.active { color: var(--color-on-dark); }
    .sb-item.sb-sub.active::before { width: 2px; background: var(--color-focus); }
    .sb-foot {
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 8px;
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .sb-collapse { color: var(--nav-text-dim); }

    /* Collapsed: icons only */
    .sb.sb-collapsed { width: 68px; }
    .sb.sb-collapsed .sb-brand-text,
    .sb.sb-collapsed .sb-label,
    .sb.sb-collapsed .sb-count,
    .sb.sb-collapsed .sb-group,
    .sb.sb-collapsed .sb-sub { display: none; }
    .sb.sb-collapsed .sb-item { justify-content: center; padding: 9px 0; }
    .sb.sb-collapsed .sb-brand { justify-content: center; padding-inline: 0; }

    .sb-scrim { display: none; }

    /* ---------- Top bar ---------- */
    .tb {
      position: fixed;
      top: 0;
      right: 0;
      left: var(--shell-sidebar-width);
      height: var(--shell-topbar-height);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 0 16px 0 20px;
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-line);
      color: var(--color-text-2);
      transition: left 0.18s ease;
    }
    :host-context(body.shell-collapsed) .tb { left: 68px; }
    .tb-menu { display: none; }
    .tb-spacer { flex: 1; }
    .tb mat-icon { color: var(--color-text-2); }

    .tb-search {
      display: flex;
      align-items: center;
      gap: 8px;
      width: min(440px, 40vw);
      height: 36px;
      padding: 0 8px 0 12px;
      border-radius: 9px;
      background: var(--color-surface-2);
      border: 1px solid transparent;
      cursor: pointer;
      text-align: left;
      font: inherit;
    }
    .tb-search:hover { border-color: var(--color-line-strong); }
    .tb-search:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 1px; }
    .tb-search-text { flex: 1; min-width: 0; font: 500 13.5px var(--font-body); color: var(--color-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tb-search:focus-within { background: var(--color-surface); border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-soft); }
    .tb-search mat-icon { font-size: 19px; width: 19px; height: 19px; color: var(--color-text-3); }
    .tb-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: 500 13.5px var(--font-body); color: var(--color-text); }
    .tb-search input::placeholder { color: var(--color-text-3); }
    .tb-search input:focus { box-shadow: none; }
    .tb-search kbd { font: 500 11px var(--font-mono); color: var(--color-text-3); border: 1px solid var(--color-line-strong); border-radius: 5px; padding: 1px 6px; background: var(--color-surface); }
    .tb-search.busy { opacity: 0.7; }

    /* Welly working indicator */
    .welly-working {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 32px;
      padding: 0 12px 0 6px;
      margin-right: 6px;
      border-radius: 999px;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      white-space: nowrap;
      cursor: default;
    }
    .ww-orb { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--color-primary); }
    .ww-spark { font-size: 14px !important; width: 14px !important; height: 14px !important; color: var(--color-on-primary) !important; animation: ww-spin 2.4s linear infinite; }
    .ww-label { font-size: 13px; font-weight: 700; }
    .ww-badge { min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--color-primary); color: var(--color-on-primary); font: 700 11px var(--font-mono); display: inline-flex; align-items: center; justify-content: center; }
    @keyframes ww-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ww-spark { animation: none; } }

    /* Avatar button */
    .profile-trigger { margin-left: 4px; }
    .profile-avatar-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 800;
    }

    /* ---------- Messages and notifications dropdowns ---------- */
    .dropdown-container { position: relative; }
    .dropdown-panel { position: absolute; top: 46px; right: 0; z-index: 1002; }
    .modern-dropdown {
      width: 380px;
      max-height: 520px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: 12px;
      box-shadow: var(--shadow-lg);
      color: var(--color-text);
    }
    .dd-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px 12px 16px;
      border-bottom: 1px solid var(--color-line);
      flex-shrink: 0;
    }
    .dd-header-left { display: flex; align-items: center; gap: 8px; }
    .dd-header-icon { display: none; }
    .dd-header h3 { margin: 0; font-size: 14.5px; font-weight: 750; color: var(--color-text); }
    .dd-count-badge { font: 600 11px var(--font-mono); padding: 1px 7px; border-radius: 999px; background: var(--color-surface-2); color: var(--color-text-2); }
    .dd-header-actions { display: flex; align-items: center; gap: 4px; }
    .dd-mark-read-btn {
      display: inline-flex; align-items: center; gap: 4px;
      border: 0; background: transparent; color: var(--color-primary);
      font: 700 12px var(--font-body); padding: 4px 8px; border-radius: 6px; cursor: pointer;
    }
    .dd-mark-read-btn:hover { background: var(--color-primary-soft); }
    .dd-mark-read-btn mat-icon { font-size: 15px; width: 15px; height: 15px; color: var(--color-primary); }
    .dd-close-btn mat-icon { color: var(--color-text-3); }
    .dd-content { flex: 1; min-height: 0; max-height: 360px; overflow-y: auto; }
    .dd-empty { display: flex; flex-direction: column; align-items: center; padding: 32px 24px; text-align: center; gap: 4px; }
    .dd-empty-icon mat-icon { font-size: 28px; width: 28px; height: 28px; color: var(--color-text-3); }
    .dd-empty p { margin: 6px 0 0; font-size: 14px; font-weight: 700; color: var(--color-text); }
    .dd-empty span { font-size: 12.5px; color: var(--color-text-3); }
    .dd-loading { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px; color: var(--color-text-3); font-size: 12.5px; }
    .dd-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 11px 16px;
      cursor: pointer;
      border-bottom: 1px solid var(--color-line);
    }
    .dd-item:last-child { border-bottom: 0; }
    .dd-item:hover { background: var(--color-surface-2); }
    .dd-item-body { flex: 1; min-width: 0; }
    .dd-item-title { font-size: 13.5px; font-weight: 700; color: var(--color-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dd-item-subtitle { font-size: 12.5px; color: var(--color-text-3); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4; margin-top: 1px; }
    .dd-item-time { font-size: 11.5px; color: var(--color-text-3); white-space: nowrap; }
    .dd-item-avatar, .notif-icon-wrapper {
      width: 34px; height: 34px; min-width: 34px; border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      background: var(--color-surface-2);
    }
    .msg-avatar { border-radius: 50%; background: var(--color-primary-soft); }
    .dd-item-avatar mat-icon, .notif-icon-wrapper mat-icon { font-size: 19px; width: 19px; height: 19px; color: var(--color-text-2); }
    .msg-avatar mat-icon { color: var(--color-primary); }
    .msg-item { align-items: center; }
    .notif-item.unread { background: var(--color-primary-soft); }
    .notif-item.unread:hover { background: var(--color-surface-2); }
    .notif-icon-wrapper.info, .notif-icon-wrapper.icon-info, .notif-icon-wrapper.icon-primary { background: var(--color-primary-soft); }
    .notif-icon-wrapper.info mat-icon, .notif-icon-wrapper.icon-info mat-icon, .notif-icon-wrapper.icon-primary mat-icon { color: var(--color-primary); }
    .notif-icon-wrapper.warning, .notif-icon-wrapper.icon-warning { background: var(--color-warn-soft); }
    .notif-icon-wrapper.warning mat-icon, .notif-icon-wrapper.icon-warning mat-icon { color: var(--color-warn); }
    .notif-icon-wrapper.success, .notif-icon-wrapper.icon-success { background: var(--color-ok-soft); }
    .notif-icon-wrapper.success mat-icon, .notif-icon-wrapper.icon-success mat-icon { color: var(--color-ok); }
    .notif-icon-wrapper.error, .notif-icon-wrapper.icon-error { background: var(--color-danger-soft); }
    .notif-icon-wrapper.error mat-icon, .notif-icon-wrapper.icon-error mat-icon { color: var(--color-danger); }
    .notif-meta { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
    .notif-type-badge { font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; text-transform: capitalize; background: var(--color-surface-2); color: var(--color-text-2); }
    .notif-type-badge.info, .notif-type-badge.icon-info, .notif-type-badge.icon-primary { background: var(--color-primary-soft); color: var(--color-primary); }
    .notif-type-badge.warning, .notif-type-badge.icon-warning { background: var(--color-warn-soft); color: var(--color-warn); }
    .notif-type-badge.success, .notif-type-badge.icon-success { background: var(--color-ok-soft); color: var(--color-ok); }
    .notif-type-badge.error, .notif-type-badge.icon-error { background: var(--color-danger-soft); color: var(--color-danger); }
    .notif-time { display: flex; align-items: center; gap: 3px; font-size: 11.5px; color: var(--color-text-3); }
    .notif-time mat-icon { font-size: 13px; width: 13px; height: 13px; color: var(--color-text-3); }
    .notif-action-btns { display: flex; gap: 4px; }
    .notif-action-btn { width: 30px; height: 30px; border-radius: 7px; border: 1px solid var(--color-line-strong); background: var(--color-surface); display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .notif-action-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .notif-action-btn.accept mat-icon { color: var(--color-ok); }
    .notif-action-btn.decline mat-icon { color: var(--color-danger); }
    .notif-action-btn:hover { background: var(--color-surface-2); }
    .dd-footer { display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid var(--color-line); flex-shrink: 0; flex-wrap: wrap; }
    .dd-footer-btn {
      flex: 1;
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      height: 32px; padding: 0 10px; border-radius: 7px;
      border: 1px solid var(--color-line-strong); background: var(--color-surface); color: var(--color-text);
      font: 650 12.5px var(--font-body); cursor: pointer; white-space: nowrap;
    }
    .dd-footer-btn:first-child { flex-basis: 100%; background: var(--color-primary); border-color: var(--color-primary); color: var(--color-on-primary); }
    .dd-footer-btn:first-child mat-icon { color: var(--color-on-primary); }
    .dd-footer-btn mat-icon { font-size: 17px; width: 17px; height: 17px; }
    .dd-footer-btn:hover { filter: brightness(0.97); }

    /* ---------- Menus (overlay, so ::ng-deep) ---------- */
    ::ng-deep .shell-menu.mat-mdc-menu-panel {
      border-radius: 12px !important;
      border: 1px solid var(--color-line);
      box-shadow: var(--shadow-lg) !important;
      min-width: 240px !important;
      background: var(--color-surface) !important;
    }
    ::ng-deep .shell-menu .mat-mdc-menu-item { min-height: 40px; color: var(--color-text); }
    ::ng-deep .shell-menu .mat-mdc-menu-item .mat-icon { color: var(--color-text-2); margin-right: 12px; }
    ::ng-deep .shell-menu .sm-label {
      padding: 10px 16px 4px;
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-3);
    }
    ::ng-deep .tools-menu.mat-mdc-menu-panel { min-width: 300px !important; }
    ::ng-deep .tools-menu .mat-mdc-menu-item { min-height: 50px; }
    ::ng-deep .tools-menu .sm-text { display: flex; flex-direction: column; font-weight: 650; font-size: 13.5px; line-height: 1.3; }
    ::ng-deep .tools-menu .sm-text small { font-weight: 500; font-size: 12px; color: var(--color-text-3); }
    ::ng-deep .profile-menu-panel .pm-user-header.mat-mdc-menu-item { display: flex !important; align-items: center !important; gap: 12px; padding: 12px 16px !important; height: auto !important; opacity: 1 !important; cursor: default; }
    ::ng-deep .profile-menu-panel .pm-avatar { width: 38px; height: 38px; min-width: 38px; border-radius: 50%; background: var(--color-primary-soft); display: flex; align-items: center; justify-content: center; }
    ::ng-deep .profile-menu-panel .pm-avatar span { color: var(--color-primary); font-size: 13px; font-weight: 800; }
    ::ng-deep .profile-menu-panel .pm-user-details { display: flex; flex-direction: column; min-width: 0; }
    ::ng-deep .profile-menu-panel .pm-user-name { color: var(--color-text); font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    ::ng-deep .profile-menu-panel .pm-user-email { color: var(--color-text-3); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    ::ng-deep .profile-menu-panel .pm-divider { height: 1px; background: var(--color-line); margin: 4px 0; }
    ::ng-deep .profile-menu-panel .pm-group { padding: 8px 16px 2px; font-size: var(--text-xs); font-weight: 700; color: var(--color-text-3); }
    ::ng-deep .profile-menu-panel .pm-logout .mat-icon,
    ::ng-deep .profile-menu-panel .pm-logout .mdc-list-item__primary-text { color: var(--color-danger) !important; }

    /* ---------- Phones and small tablets: sidebar becomes a drawer ---------- */
    @media (max-width: 900px) {
      .sb { transform: translateX(-100%); width: min(280px, 85vw); box-shadow: var(--shadow-lg); }
      .sb.sb-open { transform: none; }
      .sb.sb-collapsed { width: min(280px, 85vw); }
      .sb.sb-collapsed .sb-brand-text, .sb.sb-collapsed .sb-label, .sb.sb-collapsed .sb-group { display: initial; }
      .sb.sb-collapsed .sb-sub { display: flex; }
      .sb.sb-collapsed .sb-item { justify-content: flex-start; padding: 7px 10px; }
      .sb-collapse { display: none; }
      .sb-scrim { display: block; position: fixed; inset: 0; z-index: 1000; background: rgba(26, 25, 54, 0.4); }
      .tb, :host-context(body.shell-collapsed) .tb { left: 0; padding: 0 8px; }
      .tb-menu { display: inline-flex; }
      /* min-width: 0 lets the search shrink (its text truncates) so the buttons on the
         right stay on screen on phones. */
      .tb-search { width: auto; flex: 1; min-width: 0; }
      .tb-search kbd, .ww-label { display: none; }
      .tb-spacer { display: none; }
      .modern-dropdown { width: min(380px, calc(100vw - 16px)); }
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

  /** Ctrl K command search (design review D-06). */
  paletteOpen = false;

  /** Sidebar state. See readCollapsed for the default; mobileOpen is the phone drawer. */
  collapsed = NavbarComponent.readCollapsed();
  mobileOpen = false;

  readonly exactMatch: IsActiveMatchOptions = { paths: 'exact', queryParams: 'exact', matrixParams: 'ignored', fragment: 'ignored' };
  readonly subsetMatch: IsActiveMatchOptions = { paths: 'subset', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored' };

  /** Navigation grouped by the work people do (design review D-05). */
  readonly navGroups: NavGroup[] = [
    { label: 'Workspace', items: [
      { label: 'Home', icon: 'home', route: '/dashboard', exact: true },
      { label: 'Calendar', icon: 'calendar_month', route: '/calendar' },
      { label: 'Messages', icon: 'forum', route: '/messages', perm: 'messaging', badge: 'messages' },
      { label: 'Documents', icon: 'folder_open', route: '/documents', perm: 'documents' },
      { label: 'Paperless', icon: 'draw', action: 'paperless' },
      { label: 'Project boards', icon: 'view_kanban', route: '/departments', perm: 'project_management' },
    ]},
    { label: 'Operations', items: [
      { label: 'Sales', icon: 'point_of_sale', route: '/sales', perm: 'sales' },
      { label: 'Logistics', icon: 'local_shipping', route: '/logistics', perm: 'logistics' },
      { label: 'Stock', icon: 'inventory_2', route: '/stock-management', perm: 'stock_management' },
      { label: 'Tenders', icon: 'gavel', route: '/tenders', perm: 'tenders' },
      { label: 'Company projects', icon: 'factory', route: '/company-projects', perm: 'company_projects', exact: true },
      { label: 'Condoms', route: '/company-projects', query: { project: 'condoms' }, perm: 'company_projects', sub: true },
      { label: 'Sanitary pads', route: '/company-projects', query: { project: 'sanitary-pads' }, perm: 'company_projects', sub: true },
      { label: 'HBA1C', route: '/company-projects', query: { project: 'hba1c' }, perm: 'company_projects', sub: true },
    ]},
    { label: 'People and money', items: [
      { label: 'People', icon: 'group', route: '/people', perm: 'human_resource' },
      { label: 'Finance', icon: 'account_balance', route: '/finance', perm: 'finance' },
    ]},
    { label: 'Oversight', items: [
      { label: 'Management', icon: 'insights', route: '/management', perm: 'management' },
      { label: 'Flows', icon: 'account_tree', route: '/flows', perm: 'flows' },
      { label: 'Support', icon: 'support_agent', route: '/support-ticket', perm: 'support_tickets' },
    ]},
  ];

  /** Groups with only the items this person may open; empty groups are dropped. */
  visibleNavGroups(): NavGroup[] {
    return this.navGroups
      .map(g => ({ ...g, items: g.items.filter(i => !i.perm || this.hasPermission(i.perm)) }))
      .filter(g => g.items.length > 0);
  }

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    try { localStorage.setItem('shell-collapsed', this.collapsed ? '1' : '0'); } catch { /* storage unavailable */ }
    document.body.classList.toggle('shell-collapsed', this.collapsed);
  }

  /**
   * The person's own choice if they've used Collapse/Expand; otherwise the sidebar opens
   * fully only on screens 1920px wide and up, and is the 68px icon rail below that.
   * Module pages were laid out for the whole window: their breakpoints ("3 columns below
   * 1400px") test the window width, so a 232px sidebar makes them squeeze their cards
   * instead of re-flowing. The rail is narrow enough not to.
   */
  private static readCollapsed(): boolean {
    let saved: string | null = null;
    try { saved = localStorage.getItem('shell-collapsed'); } catch { /* storage unavailable */ }
    if (saved === '1' || saved === '0') return saved === '1';
    return window.innerWidth < NavbarComponent.AUTO_COLLAPSE_BELOW;
  }

  private static readonly AUTO_COLLAPSE_BELOW = 1920;

  @HostListener('window:resize')
  onWindowResize(): void {
    const next = NavbarComponent.readCollapsed();
    if (next !== this.collapsed) {
      this.collapsed = next;
      document.body.classList.toggle('shell-collapsed', next);
    }
  }

  // Every page renders its own <app-navbar>, so during navigation one instance is
  // destroyed as the next is created. Count instances so the body offset is only
  // removed when no navbar is left (e.g. after signing out).
  private static instances = 0;

  readonly appearance = inject(AppearanceService);
  readonly themeChoices: { value: ThemeChoice; label: string }[] = [
    { value: 'system', label: 'Same as this computer' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' }
  ];
  readonly densityChoices: { value: Density; label: string }[] = [
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'compact', label: 'Compact' }
  ];

  private subscriptions: Subscription[] = [];

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService,
    private notificationService: NotificationService,
    private dialog: MatDialog,
    public wellyActivity: WellyActivityService,
    public paperless: PaperlessService,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  /** Paperless invoice / item / barcode lookup, from the command search. */
  lookupInPaperless(query: string): void {
    const q = (query || '').trim();
    if (q) this.paperless.search(q);
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.paletteOpen = !this.paletteOpen;
    }
  }

  /** Moves keyboard focus past the navigation to the page's heading or main content. */
  skipToContent(event: Event): void {
    event.preventDefault();
    const host = this.elementRef.nativeElement;
    const main = document.querySelector<HTMLElement>('main') ?? (host.nextElementSibling as HTMLElement | null);
    const target = main?.querySelector<HTMLElement>('h1') ?? main;
    if (!target) return;
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus();
  }

  /** Everything the command search can open: the pages this person may use, tools and account. */
  paletteCommands(): PaletteCommand[] {
    const pages: PaletteCommand[] = this.visibleNavGroups().flatMap(group =>
      group.items.map(item => ({
        group: 'Pages' as const,
        label: item.sub ? `Company projects: ${item.label}` : item.label,
        icon: item.icon || 'factory',
        hint: group.label,
        keywords: item.label === 'People' ? 'hr human resource leave attendance' : undefined,
        run: () => item.action === 'paperless'
          ? this.paperless.open('right')
          : this.router.navigate([item.route], { queryParams: item.query ?? {} })
      }))
    );
    pages.push({ group: 'Pages', label: 'Company news', icon: 'campaign', hint: 'Workspace', keywords: 'announcements birthdays welcome feed gallery', run: () => this.router.navigate(['/welcome']) });
    // Module sub-pages, so typing "back orders" or "POD" goes straight there. The first sub-page
    // is where the module itself opens, so it's already in the list above.
    const subPages: [string, string, string, readonly SubPage[]][] = [
      ['logistics', '/logistics', 'Logistics', LOGISTICS_SECTIONS],
      ['sales', '/sales', 'Sales', SALES_SECTIONS],
      ['stock_management', '/stock-management', 'Stock', STOCK_SECTIONS],
    ];
    for (const [perm, base, module, sections] of subPages) {
      if (!this.hasPermission(perm)) continue;
      for (const s of sections.slice(1)) {
        pages.push({ group: 'Pages', label: `${module}: ${s.label}`, icon: s.icon, hint: 'Operations', keywords: s.hint, run: () => this.router.navigate([base, s.slug]) });
      }
    }
    const tools: PaletteCommand[] = [
      { group: 'Tools', label: 'Docs', icon: 'description', hint: 'Write and edit documents together', run: () => this.router.navigate(['/docs']) },
      { group: 'Tools', label: 'To-do', icon: 'checklist', hint: 'Your tasks and reminders', keywords: 'todo tasks', run: () => this.openTodoDialog() },
      { group: 'Tools', label: 'Requests', icon: 'assignment', hint: 'HR requests and meeting bookings', keywords: 'meeting hr', run: () => this.openRequestDialog() },
      { group: 'Tools', label: 'Uploader', icon: 'cloud_upload', hint: 'Import invoice sheets and PODs', keywords: 'upload import pod', run: () => this.openUploaderDialog() },
      { group: 'Tools', label: 'PDF tools', icon: 'picture_as_pdf', hint: 'Merge, split and compress PDFs', keywords: 'i hate pdf merge split', run: () => this.openIHatePdfDialog() },
      { group: 'Tools', label: 'Books', icon: 'menu_book', hint: "Each department's books", run: () => this.openBooksDialog() },
      { group: 'Tools', label: 'Email archives', icon: 'inventory', hint: 'Search old company mailboxes', keywords: 'pst mail', run: () => this.router.navigate(['/archives']) },
      { group: 'Tools', label: 'Desktop notifier', icon: 'desktop_windows', hint: 'Alerts on your Windows desktop', keywords: 'download tray', run: () => this.downloadNotifier() },
    ];
    const account: PaletteCommand[] = [
      { group: 'Account', label: 'Profile and password', icon: 'person', run: () => this.goToProfile() },
      ...(this.isAdmin() ? [{ group: 'Account' as const, label: 'Admin settings', icon: 'settings', keywords: 'users permissions', run: () => this.router.navigate(['/settings']) }] : []),
      { group: 'Account', label: 'Sign out', icon: 'logout', run: () => this.logout() },
    ];
    return [...pages, ...tools, ...account];
  }

  /** Tooltip listing every active Welly task. */
  wellyTasksTooltip(): string {
    const tasks = this.wellyActivity.tasks();
    if (tasks.length === 0) return 'Welly is idle';
    return tasks.map(t => '• ' + t.label).join('\n');
  }

  /**
   * Check if user has permission to access a module
   */
  hasPermission(module: string): boolean {
    return this.authService.hasModulePermission(module as any);
  }

  ngOnInit(): void {
    NavbarComponent.instances++;
    document.body.classList.add('has-shell');
    document.body.classList.toggle('shell-collapsed', this.collapsed);
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
    this.subscriptions.push(
      this.messageService.activeChats$.subscribe((chats: Conversation[]) => {
        this.activeChatBubbles = chats;
      })
    );

    // App-wide real-time chat connection. The navbar is on every page, so
    // starting it here means new-message bubbles and badges work everywhere,
    // not only while the Messages page is open. startConnection is idempotent.
    if (this.currentUserId) {
      this.messageService.startConnection(this.currentUserId).catch(() => {});
    }

    // Keep the envelope badge in sync with the server-side unread count
    this.subscriptions.push(
      this.notificationService.unreadCount$.subscribe(count => {
        this.unreadMessagesCount = count;
      })
    );

    // Auto-pop a mini chat bubble when a new message arrives from someone else
    this.subscriptions.push(
      this.messageService.newMessage$.subscribe((message) => {
        if (!message || message.senderId === this.currentUserId) return;

        // Refresh the dropdown's recent list so the preview is current
        this.loadRecentConversations();

        // On the full Messages page the inbox already shows it; no bubble needed
        if (this.router.url.startsWith('/messages')) return;

        // If this conversation isn't already the open bubble, fetch it and open it
        const alreadyOpen = this.activeChatBubbles.some(
          c => c.conversationId === message.conversationId
        );
        if (!alreadyOpen) {
          this.messageService.getConversation(message.conversationId, this.currentUserId)
            .subscribe({
              next: (conv) => this.messageService.openChatBubble(conv),
              error: () => {}
            });
        }
      })
    );

    // Reconnected after a drop: re-sync the badge and recent list
    this.subscriptions.push(
      this.messageService.connectionState$.subscribe(connected => {
        if (connected) {
          this.loadUnreadCount();
          this.loadRecentConversations();
        }
      })
    );

    // Support deep-links from the desktop notifier, e.g. /dashboard?open=todo
    this.route.queryParams.subscribe(params => {
      if (params['open'] === 'todo') {
        setTimeout(() => this.openTodoDialog(), 300);
      }
      if (params['open'] === 'paperless') {
        setTimeout(() => this.paperless.open('right'), 300);
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    NavbarComponent.instances--;
    queueMicrotask(() => {
      if (NavbarComponent.instances === 0) document.body.classList.remove('has-shell', 'shell-collapsed');
    });
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
        this.notificationService.updateUnreadCount(count);
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

  viewEmails(): void {
    this.showMessages = false;
    this.router.navigate(['/emails']);
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

  openAssetRegisterDialog(): void {
    const ref = this.dialog.open(AssetRegisterDialogComponent, {
      width: '580px',
      maxWidth: '95vw',
      maxHeight: '80vh',
      panelClass: 'centered-dialog'
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        this.router.navigate(['/asset-register'], { queryParams: result });
      }
    });
  }

  openBooksDialog(): void {
    this.dialog.open(BooksDepartmentDialogComponent, {
      width: '500px',
      maxWidth: '95vw',
      panelClass: 'centered-dialog'
    });
  }

  openIHatePdfDialog(): void {
    this.dialog.open(IHatePdfDialogComponent, {
      width: '960px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      panelClass: 'ihp-dialog-panel'
    });
  }

  openUploaderDialog(): void {
    this.dialog.open(UploaderDialogComponent, {
      width: '760px',
      maxWidth: '96vw',
      maxHeight: '90vh',
      panelClass: 'centered-dialog'
    });
  }

  downloadNotifier(): void {
    const url = `${environment.apiUrl}/download/notifier`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'IntranetNotifier.exe';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
    const role = this.currentUser?.role?.toLowerCase() || '';
    return role === 'admin' || role === 'super admin';
  }

  isManager(): boolean {
    const role = this.currentUser?.role?.toLowerCase() || '';
    return role.includes('admin') || role.includes('manager');
  }

  logout(): void {
    // Close any open chat bubbles and the real-time connection before the
    // token is cleared so the socket doesn't try to reconnect unauthenticated.
    this.messageService.getActiveChatBubbles().forEach(c => this.messageService.closeChatBubble(c.conversationId));
    this.messageService.stopConnection();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}


