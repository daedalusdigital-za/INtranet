import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Subscription, interval } from 'rxjs';
import { MessageService, Conversation, Message, User, SendMessageRequest } from '../../services/message.service';
import { UserSearchPopupComponent } from '../user-search-popup/user-search-popup.component';
import { NavbarComponent } from '../shared/navbar/navbar.component';

@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatListModule,
    MatBadgeModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatCheckboxModule,
    UserSearchPopupComponent,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>
    
    <div class="messages-container">
      <!-- Sidebar - Conversations List -->
      <div class="conversations-sidebar">
        <div class="sidebar-header">
          <h2>Messages</h2>
          <button mat-icon-button color="primary" (click)="showNewConversation = true" matTooltip="New Message">
            <mat-icon>edit</mat-icon>
          </button>
        </div>
        
        <div class="search-box">
          <mat-form-field appearance="outline" class="full-width">
            <mat-icon matPrefix>search</mat-icon>
            <input matInput placeholder="Search conversations..." [(ngModel)]="searchQuery" (input)="filterConversations()">
          </mat-form-field>
        </div>

        <div class="conversations-list" *ngIf="!loading">
          <div 
            *ngFor="let conv of filteredConversations" 
            class="conversation-item"
            [class.active]="selectedConversation?.conversationId === conv.conversationId"
            [class.unread]="conv.unreadCount > 0"
            (click)="selectConversation(conv)">
            
            <div class="avatar">
              <img *ngIf="getConversationAvatar(conv)" [src]="getConversationAvatar(conv)" alt="Avatar">
              <mat-icon *ngIf="!getConversationAvatar(conv)">
                {{ conv.isGroupChat ? 'group' : 'person' }}
              </mat-icon>
            </div>
            
            <div class="conversation-info">
              <div class="conversation-header">
                <span class="name">{{ getConversationName(conv) }}</span>
                <span class="time">{{ formatTime(conv.lastMessageAt || conv.createdAt) }}</span>
              </div>
              <div class="last-message">
                {{ conv.lastMessage?.content || 'No messages yet' }}
              </div>
            </div>
            
            <div class="conversation-actions">
              <span *ngIf="conv.unreadCount > 0" class="unread-badge">{{ conv.unreadCount }}</span>
              <mat-checkbox 
                *ngIf="selectMode"
                [(ngModel)]="selectedForDelete[conv.conversationId]"
                (click)="$event.stopPropagation()">
              </mat-checkbox>
            </div>
          </div>

          <div *ngIf="filteredConversations.length === 0" class="empty-state">
            <mat-icon>chat_bubble_outline</mat-icon>
            <p>No conversations found</p>
          </div>
        </div>

        <div *ngIf="loading" class="loading-spinner">
          <mat-spinner diameter="40"></mat-spinner>
        </div>

        <!-- Bulk Actions -->
        <div class="sidebar-footer">
          <button mat-button (click)="toggleSelectMode()">
            <mat-icon>{{ selectMode ? 'close' : 'checklist' }}</mat-icon>
            {{ selectMode ? 'Cancel' : 'Select' }}
          </button>
          <button mat-button color="warn" *ngIf="selectMode && hasSelectedConversations()" (click)="deleteSelectedConversations()">
            <mat-icon>delete</mat-icon>
            Delete Selected
          </button>
        </div>
      </div>

      <!-- Main Chat Area -->
      <div class="chat-area">
        <div *ngIf="!selectedConversation" class="no-conversation-selected">
          <mat-icon>forum</mat-icon>
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the sidebar or start a new one</p>
          <button mat-raised-button color="primary" (click)="showNewConversation = true">
            <mat-icon>add</mat-icon>
            Start New Conversation
          </button>
        </div>

        <div *ngIf="selectedConversation" class="chat-content">
          <!-- Chat Header -->
          <div class="chat-header">
            <div class="chat-info">
              <div class="avatar">
                <img *ngIf="getConversationAvatar(selectedConversation)" [src]="getConversationAvatar(selectedConversation)" alt="Avatar">
                <mat-icon *ngIf="!getConversationAvatar(selectedConversation)">
                  {{ selectedConversation.isGroupChat ? 'group' : 'person' }}
                </mat-icon>
              </div>
              <div class="details">
                <h3>{{ getConversationName(selectedConversation) }}</h3>
                <span class="participants">
                  {{ getParticipantsText(selectedConversation) }}
                </span>
              </div>
            </div>
            <div class="chat-actions">
              <button mat-icon-button [matMenuTriggerFor]="chatMenu">
                <mat-icon>more_vert</mat-icon>
              </button>
              <mat-menu #chatMenu="matMenu">
                <button mat-menu-item (click)="deleteConversation(selectedConversation)">
                  <mat-icon color="warn">delete</mat-icon>
                  <span>Delete Conversation</span>
                </button>
              </mat-menu>
            </div>
          </div>

          <!-- Messages Area -->
          <div class="messages-area" #messagesContainer>
            <div *ngIf="loadingMessages" class="loading-messages">
              <mat-spinner diameter="30"></mat-spinner>
            </div>

            <div *ngFor="let message of messages" 
                 class="message"
                 [class.sent]="message.senderId === currentUserId"
                 [class.received]="message.senderId !== currentUserId"
                 [class.deleted]="message.isDeleted">
              
              <div class="message-avatar" *ngIf="message.senderId !== currentUserId">
                <img *ngIf="message.senderProfilePicture" [src]="message.senderProfilePicture" alt="Avatar">
                <mat-icon *ngIf="!message.senderProfilePicture">person</mat-icon>
              </div>
              
              <div class="message-content">
                <div class="message-sender" *ngIf="message.senderId !== currentUserId && selectedConversation?.isGroupChat">
                  {{ message.senderFullName || message.senderName }}
                </div>
                
                <div class="message-bubble">
                  <p>{{ message.content }}</p>
                  
                  <div class="message-meta">
                    <span class="time">{{ formatMessageTime(message.sentAt) }}</span>
                    <mat-icon *ngIf="message.isEdited" class="edited-icon" matTooltip="Edited">edit</mat-icon>
                    <mat-icon *ngIf="message.senderId === currentUserId && message.isRead" class="read-icon">done_all</mat-icon>
                  </div>
                </div>
                
                <button mat-icon-button class="message-menu-btn" [matMenuTriggerFor]="messageMenu" *ngIf="!message.isDeleted">
                  <mat-icon>more_horiz</mat-icon>
                </button>
                <mat-menu #messageMenu="matMenu">
                  <button mat-menu-item (click)="replyToMessage(message)">
                    <mat-icon>reply</mat-icon>
                    <span>Reply</span>
                  </button>
                  <button mat-menu-item (click)="deleteMessage(message)" *ngIf="message.senderId === currentUserId">
                    <mat-icon color="warn">delete</mat-icon>
                    <span>Delete</span>
                  </button>
                </mat-menu>
              </div>
            </div>

            <div *ngIf="messages.length === 0 && !loadingMessages" class="no-messages">
              <mat-icon>chat</mat-icon>
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>

          <!-- Reply Preview -->
          <div *ngIf="replyingTo" class="reply-preview">
            <div class="reply-content">
              <mat-icon>reply</mat-icon>
              <div class="reply-text">
                <span class="reply-sender">{{ replyingTo.senderFullName || replyingTo.senderName }}</span>
                <span class="reply-message">{{ replyingTo.content }}</span>
              </div>
            </div>
            <button mat-icon-button (click)="replyingTo = null">
              <mat-icon>close</mat-icon>
            </button>
          </div>

          <!-- Message Input -->
          <div class="message-input-area">
            <mat-form-field appearance="outline" class="message-input">
              <input matInput 
                     placeholder="Type a message..." 
                     [(ngModel)]="newMessage"
                     (keyup.enter)="sendMessage()">
            </mat-form-field>
            <button mat-fab color="primary" (click)="sendMessage()" [disabled]="!newMessage.trim()">
              <mat-icon>send</mat-icon>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- New Conversation Dialog -->
    <app-user-search-popup
      *ngIf="showNewConversation"
      [currentUserId]="currentUserId"
      (close)="showNewConversation = false"
      (userSelected)="startConversationWithUser($event)">
    </app-user-search-popup>
  `,
  styles: [`
    .messages-container {
      display: flex;
      height: calc(100vh - 64px);
      background: #f5f5f5;
    }

    .conversations-sidebar {
      width: 350px;
      background: white;
      border-right: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;

      h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 500;
      }
    }

    .search-box {
      padding: 12px 16px;
      
      .full-width {
        width: 100%;
      }

      mat-form-field {
        font-size: 14px;
      }

      ::ng-deep .mat-mdc-form-field-subscript-wrapper {
        display: none;
      }
    }

    .conversations-list {
      flex: 1;
      overflow-y: auto;
    }

    .conversation-item {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      cursor: pointer;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.2s;

      &:hover {
        background: #f5f5f5;
      }

      &.active {
        background: #e3f2fd;
        border-left: 3px solid #1976d2;
      }

      &.unread {
        background: #fff8e1;

        .name {
          font-weight: 600;
        }
      }

      .avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 12px;
        overflow: hidden;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        mat-icon {
          color: #757575;
        }
      }

      .conversation-info {
        flex: 1;
        min-width: 0;

        .conversation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;

          .name {
            font-weight: 500;
            color: #212121;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .time {
            font-size: 12px;
            color: #757575;
            white-space: nowrap;
          }
        }

        .last-message {
          font-size: 13px;
          color: #757575;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      }

      .conversation-actions {
        display: flex;
        align-items: center;
        gap: 8px;

        .unread-badge {
          background: #1976d2;
          color: white;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }
      }
    }

    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      color: #757575;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 16px;
      }
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #fafafa;
    }

    .no-conversation-selected {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #757575;

      mat-icon {
        font-size: 72px;
        width: 72px;
        height: 72px;
        margin-bottom: 16px;
        color: #bdbdbd;
      }

      h3 {
        margin: 0 0 8px;
        font-weight: 500;
      }

      p {
        margin: 0 0 24px;
      }
    }

    .chat-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 20px;
      background: white;
      border-bottom: 1px solid #e0e0e0;

      .chat-info {
        display: flex;
        align-items: center;

        .avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
          overflow: hidden;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
        }

        .details {
          h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
          }

          .participants {
            font-size: 13px;
            color: #757575;
          }
        }
      }
    }

    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .loading-messages {
      display: flex;
      justify-content: center;
      padding: 20px;
    }

    .message {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      max-width: 70%;

      &.sent {
        align-self: flex-end;
        flex-direction: row-reverse;

        .message-bubble {
          background: #1976d2;
          color: white;
          border-radius: 18px 18px 4px 18px;

          .message-meta {
            color: rgba(255, 255, 255, 0.7);
          }
        }

        .message-menu-btn {
          order: -1;
        }
      }

      &.received {
        align-self: flex-start;

        .message-bubble {
          background: white;
          color: #212121;
          border-radius: 18px 18px 18px 4px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
      }

      &.deleted {
        .message-bubble {
          background: #f5f5f5 !important;
          color: #9e9e9e !important;
          font-style: italic;
        }
      }

      .message-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #e0e0e0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        flex-shrink: 0;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        mat-icon {
          font-size: 18px;
          width: 18px;
          height: 18px;
          color: #757575;
        }
      }

      .message-content {
        display: flex;
        align-items: flex-end;
        gap: 4px;

        .message-sender {
          font-size: 12px;
          font-weight: 500;
          color: #1976d2;
          margin-bottom: 4px;
        }

        .message-bubble {
          padding: 10px 14px;
          max-width: 100%;

          p {
            margin: 0;
            word-wrap: break-word;
          }

          .message-meta {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 4px;
            margin-top: 4px;
            font-size: 11px;
            color: #757575;

            .edited-icon, .read-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
            }

            .read-icon {
              color: #4caf50;
            }
          }
        }

        .message-menu-btn {
          opacity: 0;
          transition: opacity 0.2s;
        }
      }

      &:hover .message-menu-btn {
        opacity: 1;
      }
    }

    .no-messages {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      color: #757575;

      mat-icon {
        font-size: 48px;
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        color: #bdbdbd;
      }
    }

    .reply-preview {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: #e3f2fd;
      border-left: 3px solid #1976d2;
      margin: 0 16px;

      .reply-content {
        display: flex;
        align-items: center;
        gap: 8px;

        mat-icon {
          color: #1976d2;
        }

        .reply-text {
          display: flex;
          flex-direction: column;

          .reply-sender {
            font-size: 12px;
            font-weight: 500;
            color: #1976d2;
          }

          .reply-message {
            font-size: 13px;
            color: #616161;
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
    }

    .message-input-area {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: white;
      border-top: 1px solid #e0e0e0;

      .message-input {
        flex: 1;

        ::ng-deep .mat-mdc-form-field-subscript-wrapper {
          display: none;
        }
      }

      button[mat-fab] {
        width: 48px;
        height: 48px;
      }
    }

    @media (max-width: 768px) {
      .conversations-sidebar {
        width: 100%;
        position: absolute;
        z-index: 10;
        left: 0;
        top: 64px;
        height: calc(100vh - 64px);
      }

      .chat-area {
        width: 100%;
      }

      .message {
        max-width: 85%;
      }
    }
  `]
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  conversations: Conversation[] = [];
  filteredConversations: Conversation[] = [];
  selectedConversation: Conversation | null = null;
  messages: Message[] = [];
  
  currentUserId: number = 0;
  searchQuery: string = '';
  newMessage: string = '';
  
  loading: boolean = false;
  loadingMessages: boolean = false;
  selectMode: boolean = false;
  selectedForDelete: { [key: number]: boolean } = {};
  showNewConversation: boolean = false;
  
  replyingTo: Message | null = null;
  
  private refreshSubscription?: Subscription;
  private signalRSubscriptions: Subscription[] = [];

  constructor(
    private messageService: MessageService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Try 'currentUser' first (correct key used by AuthService), then fallback to 'user'
    const userJson = localStorage.getItem('currentUser') || localStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      this.currentUserId = user.userId;
      
      // Start SignalR connection
      this.messageService.startConnection(this.currentUserId).then(() => {
        console.log('Connected to messaging hub');
      }).catch(err => {
        console.error('Failed to connect to messaging hub:', err);
        this.snackBar.open('Unable to connect to real-time messaging', 'Close', { duration: 3000 });
      });
      
      // Subscribe to real-time events
      this.setupSignalRSubscriptions();
      
      // Load conversations now that we have a valid userId
      this.loadConversations();
    } else {
      console.error('No user found in localStorage');
      this.snackBar.open('Please log in to view messages', 'Close', { duration: 3000 });
      this.router.navigate(['/login']);
      return;
    }
    
    // Refresh conversations every 30 seconds as backup
    this.refreshSubscription = interval(30000).subscribe(() => {
      this.loadConversations(false);
    });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
    this.signalRSubscriptions.forEach(sub => sub.unsubscribe());
    
    // Stop SignalR connection
    this.messageService.stopConnection();
  }

  private setupSignalRSubscriptions(): void {
    // New message received
    this.signalRSubscriptions.push(
      this.messageService.newMessage$.subscribe(message => {
        console.log('New message received:', message);
        
        // Add to messages if in the current conversation
        if (this.selectedConversation?.conversationId === message.conversationId) {
          // Check if message already exists (avoid duplicates)
          if (!this.messages.find(m => m.messageId === message.messageId)) {
            this.messages.push(message);
            this.scrollToBottom();
            
            // Mark as read if conversation is open
            this.messageService.markAsRead(message.conversationId, this.currentUserId).subscribe();
          }
        }
        
        // Update conversation in list
        const conv = this.conversations.find(c => c.conversationId === message.conversationId);
        if (conv) {
          conv.lastMessage = message;
          conv.lastMessageAt = message.sentAt;
          
          // Increment unread count if not in current conversation
          if (this.selectedConversation?.conversationId !== message.conversationId && message.senderId !== this.currentUserId) {
            conv.unreadCount = (conv.unreadCount || 0) + 1;
          }
          
          // Move conversation to top
          this.conversations = [conv, ...this.conversations.filter(c => c.conversationId !== conv.conversationId)];
          this.filterConversations();
        } else {
          // New conversation - reload list
          this.loadConversations(false);
        }
      })
    );

    // Message edited
    this.signalRSubscriptions.push(
      this.messageService.messageEdited$.subscribe(({ conversationId, messageId, content }) => {
        if (this.selectedConversation?.conversationId === conversationId) {
          const message = this.messages.find(m => m.messageId === messageId);
          if (message) {
            message.content = content;
            message.isEdited = true;
          }
        }
      })
    );

    // Message deleted
    this.signalRSubscriptions.push(
      this.messageService.messageDeleted$.subscribe(({ conversationId, messageId }) => {
        if (this.selectedConversation?.conversationId === conversationId) {
          const message = this.messages.find(m => m.messageId === messageId);
          if (message) {
            message.isDeleted = true;
            message.content = 'This message was deleted';
          }
        }
      })
    );

    // Conversation updated
    this.signalRSubscriptions.push(
      this.messageService.conversationUpdated$.subscribe(conversation => {
        const index = this.conversations.findIndex(c => c.conversationId === conversation.conversationId);
        if (index >= 0) {
          this.conversations[index] = conversation;
          this.filterConversations();
        }
      })
    );

    // User online status
    this.signalRSubscriptions.push(
      this.messageService.userOnline$.subscribe(({ userId, isOnline }) => {
        // Update participant online status in conversations
        this.conversations.forEach(conv => {
          const participant = conv.participants?.find(p => p.userId === userId);
          if (participant) {
            participant.isOnline = isOnline;
          }
        });
      })
    );
  }

  loadConversations(showLoading: boolean = true): void {
    if (showLoading) this.loading = true;
    
    this.messageService.getConversations(this.currentUserId).subscribe({
      next: (conversations) => {
        this.conversations = conversations;
        this.filterConversations();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading conversations:', err);
        this.loading = false;
        this.snackBar.open('Failed to load conversations', 'Close', { duration: 3000 });
      }
    });
  }

  filterConversations(): void {
    if (!this.searchQuery.trim()) {
      this.filteredConversations = this.conversations;
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredConversations = this.conversations.filter(conv => {
        const name = this.getConversationName(conv).toLowerCase();
        const lastMessage = conv.lastMessage?.content?.toLowerCase() || '';
        return name.includes(query) || lastMessage.includes(query);
      });
    }
  }

  selectConversation(conversation: Conversation): void {
    // Leave previous conversation
    if (this.selectedConversation) {
      this.messageService.leaveConversation(this.selectedConversation.conversationId);
    }
    
    this.selectedConversation = conversation;
    this.replyingTo = null;
    this.loadMessages();
    
    // Join new conversation via SignalR
    this.messageService.joinConversation(conversation.conversationId);
    
    // Mark as read
    this.messageService.markAsRead(conversation.conversationId, this.currentUserId).subscribe();
    conversation.unreadCount = 0;
  }

  loadMessages(): void {
    if (!this.selectedConversation) return;
    
    this.loadingMessages = true;
    this.messageService.getMessages(this.selectedConversation.conversationId, this.currentUserId).subscribe({
      next: (messages) => {
        this.messages = messages;
        this.loadingMessages = false;
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Error loading messages:', err);
        this.loadingMessages = false;
      }
    });
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedConversation) return;

    const request: SendMessageRequest = {
      conversationId: this.selectedConversation.conversationId,
      content: this.newMessage.trim(),
      replyToMessageId: this.replyingTo?.messageId
    };

    this.messageService.sendMessage(request, this.currentUserId).subscribe({
      next: (message) => {
        this.messages.push(message);
        this.newMessage = '';
        this.replyingTo = null;
        this.scrollToBottom();
        
        // Update conversation list
        if (this.selectedConversation) {
          this.selectedConversation.lastMessage = message;
          this.selectedConversation.lastMessageAt = message.sentAt;
        }
      },
      error: (err) => {
        console.error('Error sending message:', err);
        this.snackBar.open('Failed to send message', 'Close', { duration: 3000 });
      }
    });
  }

  replyToMessage(message: Message): void {
    this.replyingTo = message;
  }

  deleteMessage(message: Message): void {
    if (!confirm('Are you sure you want to delete this message?')) return;

    this.messageService.deleteMessage(message.messageId, this.currentUserId).subscribe({
      next: () => {
        message.isDeleted = true;
        message.content = 'This message was deleted';
        this.snackBar.open('Message deleted', 'Close', { duration: 2000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete message', 'Close', { duration: 3000 });
      }
    });
  }

  toggleSelectMode(): void {
    this.selectMode = !this.selectMode;
    if (!this.selectMode) {
      this.selectedForDelete = {};
    }
  }

  hasSelectedConversations(): boolean {
    return Object.values(this.selectedForDelete).some(v => v);
  }

  deleteSelectedConversations(): void {
    const selectedIds = Object.entries(this.selectedForDelete)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => parseInt(id));

    if (selectedIds.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} conversation(s)?`)) return;

    // For now, just remove from local list (would need backend endpoint to truly delete)
    this.conversations = this.conversations.filter(c => !selectedIds.includes(c.conversationId));
    this.filterConversations();
    
    if (this.selectedConversation && selectedIds.includes(this.selectedConversation.conversationId)) {
      this.selectedConversation = null;
      this.messages = [];
    }

    this.selectedForDelete = {};
    this.selectMode = false;
    this.snackBar.open('Conversations removed', 'Close', { duration: 2000 });
  }

  deleteConversation(conversation: Conversation): void {
    if (!confirm('Are you sure you want to delete this conversation?')) return;

    // Remove from local list
    this.conversations = this.conversations.filter(c => c.conversationId !== conversation.conversationId);
    this.filterConversations();
    
    if (this.selectedConversation?.conversationId === conversation.conversationId) {
      this.selectedConversation = null;
      this.messages = [];
    }

    this.snackBar.open('Conversation removed', 'Close', { duration: 2000 });
  }

  startConversationWithUser(user: User): void {
    this.showNewConversation = false;
    
    this.messageService.startChatWithUser(user, this.currentUserId).subscribe({
      next: (conversation) => {
        // Add to list if not exists
        if (!this.conversations.find(c => c.conversationId === conversation.conversationId)) {
          this.conversations.unshift(conversation);
          this.filterConversations();
        }
        this.selectConversation(conversation);
      },
      error: (err) => {
        console.error('Error starting conversation:', err);
        this.snackBar.open('Failed to start conversation', 'Close', { duration: 3000 });
      }
    });
  }

  getConversationName(conversation: Conversation): string {
    if (conversation.isGroupChat && conversation.groupName) {
      return conversation.groupName;
    }
    
    const otherParticipants = conversation.participants?.filter(p => p.userId !== this.currentUserId) || [];
    if (otherParticipants.length > 0) {
      return otherParticipants.map(p => p.fullName || `${p.name} ${p.surname}`).join(', ');
    }
    
    return conversation.subject || 'Conversation';
  }

  getConversationAvatar(conversation: Conversation): string | null {
    if (conversation.isGroupChat) return null;
    
    const otherParticipant = conversation.participants?.find(p => p.userId !== this.currentUserId);
    return otherParticipant?.profilePictureUrl || null;
  }

  getParticipantsText(conversation: Conversation): string {
    const count = conversation.participants?.length || 0;
    return `${count} participant${count !== 1 ? 's' : ''}`;
  }

  formatTime(date: Date | string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return d.toLocaleDateString([], { weekday: 'short' });
    } else {
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }

  formatMessageTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }
}
