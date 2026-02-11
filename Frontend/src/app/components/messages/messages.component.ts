import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
import { MessageService, Conversation, Message, User, SendMessageRequest, MessageAttachment } from '../../services/message.service';
import { UserSearchPopupComponent } from '../user-search-popup/user-search-popup.component';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';

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
    NavbarComponent,
    PickerComponent
  ],
  template: `
    <app-navbar></app-navbar>
    
    <div class="messages-page">
      <!-- Modern Header -->
      <div class="page-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>forum</mat-icon>
          </div>
          <div class="header-text">
            <h1>Messages</h1>
            <p>Stay connected with your team</p>
          </div>
        </div>
        <div class="header-stats">
          <div class="stat-card">
            <span class="stat-value">{{ conversations.length }}</span>
            <span class="stat-label">Conversations</span>
          </div>
          <div class="stat-card">
            <span class="stat-value">{{ getTotalUnread() }}</span>
            <span class="stat-label">Unread</span>
          </div>
        </div>
      </div>

      <div class="messages-container">
        <!-- Sidebar - Conversations List -->
        <div class="conversations-sidebar">
          <div class="sidebar-header">
            <h2>Conversations</h2>
            <button mat-mini-fab class="new-chat-btn" (click)="showNewConversation = true" matTooltip="New Message">
              <mat-icon>edit</mat-icon>
            </button>
          </div>
          
          <div class="search-box">
            <mat-icon class="search-icon">search</mat-icon>
            <input type="text" placeholder="Search conversations..." [(ngModel)]="searchQuery" (input)="filterConversations()">
          </div>

          <div class="conversations-list" *ngIf="!loading">
            <div 
              *ngFor="let conv of filteredConversations" 
              class="conversation-item"
              [class.active]="selectedConversation?.conversationId === conv.conversationId"
              [class.unread]="conv.unreadCount > 0"
              (click)="selectConversation(conv)">
              
              <div class="avatar" [class.online]="isUserOnline(conv)">
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
              <div class="empty-icon">
                <mat-icon>chat_bubble_outline</mat-icon>
              </div>
              <p>No conversations found</p>
              <button mat-flat-button class="start-chat-btn" (click)="showNewConversation = true">
                <mat-icon>add</mat-icon> Start New Chat
              </button>
            </div>
          </div>

          <div *ngIf="loading" class="loading-spinner">
            <mat-spinner diameter="40"></mat-spinner>
          </div>

          <!-- Bulk Actions -->
          <div class="sidebar-footer">
            <button mat-button class="select-btn" (click)="toggleSelectMode()">
              <mat-icon>{{ selectMode ? 'close' : 'checklist' }}</mat-icon>
              {{ selectMode ? 'Cancel' : 'Select' }}
            </button>
            <button mat-button class="delete-btn" *ngIf="selectMode && hasSelectedConversations()" (click)="deleteSelectedConversations()">
              <mat-icon>delete</mat-icon>
              Delete
            </button>
          </div>
        </div>

        <!-- Main Chat Area -->
        <div class="chat-area">
          <div *ngIf="!selectedConversation" class="no-conversation-selected">
            <div class="welcome-illustration">
              <mat-icon>forum</mat-icon>
            </div>
            <h3>Select a conversation</h3>
            <p>Choose a conversation from the sidebar or start a new one</p>
            <button mat-flat-button class="primary-btn" (click)="showNewConversation = true">
              <mat-icon>add</mat-icon>
              Start New Conversation
            </button>
          </div>

          <div *ngIf="selectedConversation" class="chat-content">
            <!-- Chat Header -->
            <div class="chat-header">
              <div class="chat-info">
                <div class="avatar" [class.online]="isUserOnline(selectedConversation)">
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
                <button mat-icon-button matTooltip="Voice Call" class="action-btn">
                  <mat-icon>call</mat-icon>
                </button>
                <button mat-icon-button matTooltip="Video Call" class="action-btn">
                  <mat-icon>videocam</mat-icon>
                </button>
                <button mat-icon-button [matMenuTriggerFor]="chatMenu" class="action-btn">
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
                    <p *ngIf="message.content">{{ message.content }}</p>
                    
                    <!-- Attachments Display -->
                    <div class="message-attachments" *ngIf="message.attachments && message.attachments.length > 0">
                      <div *ngFor="let attachment of message.attachments" class="attachment-item">
                        <!-- Image Preview -->
                        <div *ngIf="isImageFile(attachment.mimeType)" class="attachment-image-container">
                          <img [src]="getAttachmentUrl(attachment)" [alt]="attachment.fileName" (click)="previewAttachment(attachment)" class="attachment-image">
                          <div class="attachment-overlay">
                            <button mat-mini-fab (click)="downloadAttachment(attachment); $event.stopPropagation()" matTooltip="Download">
                              <mat-icon>download</mat-icon>
                            </button>
                          </div>
                        </div>
                        
                        <!-- PDF/Document Preview -->
                        <div *ngIf="!isImageFile(attachment.mimeType)" class="attachment-file" (click)="previewAttachment(attachment)">
                          <mat-icon class="file-icon">{{ getFileIcon(attachment.mimeType) }}</mat-icon>
                          <div class="file-info">
                            <span class="file-name">{{ attachment.fileName }}</span>
                            <span class="file-size">{{ formatFileSize(attachment.fileSize) }}</span>
                          </div>
                          <button mat-mini-fab (click)="downloadAttachment(attachment); $event.stopPropagation()" matTooltip="Download" class="download-btn">
                            <mat-icon>download</mat-icon>
                          </button>
                        </div>
                      </div>
                    </div>
                    
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
                <div class="no-messages-icon">
                  <mat-icon>chat</mat-icon>
                </div>
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

            <!-- Pending Attachments Preview -->
            <div *ngIf="pendingAttachments.length > 0" class="pending-attachments">
              <div *ngFor="let file of pendingAttachments; let i = index" class="pending-file">
                <mat-icon>{{ getFileIconByName(file.name) }}</mat-icon>
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
                <button mat-icon-button (click)="removePendingAttachment(i)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <!-- Message Input -->
            <div class="message-input-area">
              <input type="file" #fileInput hidden multiple (change)="onFilesSelected($event)" 
                     accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv">
              <button mat-icon-button class="input-action" (click)="fileInput.click()" matTooltip="Attach file">
                <mat-icon>attach_file</mat-icon>
              </button>
              <button mat-icon-button class="input-action" (click)="toggleEmojiPicker()" matTooltip="Add emoji" [class.active]="showEmojiPicker">
                <mat-icon>sentiment_satisfied_alt</mat-icon>
              </button>
              <div class="message-input-wrapper">
                <input type="text"
                       #messageInput
                       placeholder="Type a message..." 
                       [(ngModel)]="newMessage"
                       (keyup.enter)="sendMessage()">
              </div>
              <button mat-fab class="send-btn" (click)="sendMessage()" [disabled]="!newMessage.trim() && pendingAttachments.length === 0">
                <mat-icon>send</mat-icon>
              </button>
            </div>

            <!-- Emoji Picker -->
            <div class="emoji-picker-container" *ngIf="showEmojiPicker">
              <emoji-mart 
                (emojiClick)="addEmoji($event)" 
                [darkMode]="false"
                title="Pick your emoji"
                emoji="point_up">
              </emoji-mart>
            </div>
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

    <!-- Attachment Preview Overlay -->
    <div *ngIf="previewingAttachment" class="attachment-preview-overlay" (click)="closePreview()">
      <div class="preview-container" (click)="$event.stopPropagation()">
        <div class="preview-header">
          <h3>{{ previewingAttachment.fileName }}</h3>
          <div class="preview-actions">
            <button mat-icon-button (click)="downloadAttachment(previewingAttachment)" matTooltip="Download">
              <mat-icon>download</mat-icon>
            </button>
            <button mat-icon-button (click)="closePreview()" matTooltip="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
        <div class="preview-content">
          <!-- Image Preview -->
          <img *ngIf="isImageFile(previewingAttachment.mimeType)" [src]="getAttachmentUrl(previewingAttachment)" [alt]="previewingAttachment.fileName">
          
          <!-- PDF Preview -->
          <iframe *ngIf="isPdfFile(previewingAttachment.mimeType)" [src]="getSafeUrl(previewingAttachment)" frameborder="0"></iframe>
          
          <!-- Excel/Other Files - Show download prompt -->
          <div *ngIf="!isImageFile(previewingAttachment.mimeType) && !isPdfFile(previewingAttachment.mimeType)" class="no-preview">
            <mat-icon>{{ getFileIcon(previewingAttachment.mimeType) }}</mat-icon>
            <h4>{{ previewingAttachment.fileName }}</h4>
            <p>Preview not available for this file type</p>
            <p class="file-size">Size: {{ formatFileSize(previewingAttachment.fileSize) }}</p>
            <button mat-raised-button color="primary" (click)="downloadAttachment(previewingAttachment)">
              <mat-icon>download</mat-icon>
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Main Page Layout */
    .messages-page {
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #e8f4fc 0%, #d1e8f5 50%, #c5dff0 100%);
    }

    /* Modern Gradient Header */
    .page-header {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 50%, #1a5fb4 100%);
      padding: 24px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .page-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      opacity: 0.5;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 1;
    }

    .header-icon {
      width: 56px;
      height: 56px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .header-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .header-text h1 {
      margin: 0;
      color: white;
      font-size: 24px;
      font-weight: 600;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .header-text p {
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.85);
      font-size: 14px;
    }

    .header-stats {
      display: flex;
      gap: 16px;
      z-index: 1;
    }

    .stat-card {
      text-align: center;
      padding: 12px 20px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
      min-width: 100px;
    }

    .stat-value {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: white;
    }

    .stat-label {
      display: block;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.85);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Messages Container */
    .messages-container {
      display: flex;
      height: calc(100vh - 64px - 104px);
      margin: 20px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(30, 144, 255, 0.15);
    }

    /* Sidebar */
    .conversations-sidebar {
      width: 360px;
      background: white;
      display: flex;
      flex-direction: column;
      border-right: 1px solid #e8f4fc;
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: linear-gradient(135deg, #f8fbff 0%, #eef6fc 100%);
      border-bottom: 1px solid #e8f4fc;

      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1a5fb4;
      }
    }

    .new-chat-btn {
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(30, 144, 255, 0.3);
    }

    .search-box {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f8fbff;

      .search-icon {
        color: #94a3b8;
      }

      input {
        flex: 1;
        border: none;
        background: white;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 14px;
        border: 1px solid #e8f4fc;
        transition: all 0.3s ease;

        &:focus {
          outline: none;
          border-color: #1e90ff;
          box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
        }
      }
    }

    .conversations-list {
      flex: 1;
      overflow-y: auto;
    }

    .conversation-item {
      display: flex;
      align-items: center;
      padding: 14px 20px;
      cursor: pointer;
      border-bottom: 1px solid #f1f5f9;
      transition: all 0.2s ease;

      &:hover {
        background: #f8fbff;
      }

      &.active {
        background: linear-gradient(90deg, rgba(30, 144, 255, 0.1) 0%, rgba(30, 144, 255, 0.05) 100%);
        border-left: 4px solid #1e90ff;
      }

      &.unread {
        background: rgba(30, 144, 255, 0.05);

        .name {
          font-weight: 600;
          color: #1a5fb4;
        }
      }

      .avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 14px;
        overflow: hidden;
        position: relative;
        flex-shrink: 0;

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        mat-icon {
          color: white;
          font-size: 22px;
        }

        &.online::after {
          content: '';
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          background: #22c55e;
          border-radius: 50%;
          border: 2px solid white;
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
            color: #1e293b;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .time {
            font-size: 11px;
            color: #94a3b8;
            white-space: nowrap;
          }
        }

        .last-message {
          font-size: 13px;
          color: #64748b;
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
          background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
          color: white;
          font-size: 11px;
          padding: 3px 8px;
          border-radius: 12px;
          min-width: 20px;
          text-align: center;
          font-weight: 600;
        }
      }
    }

    .sidebar-footer {
      padding: 12px 16px;
      border-top: 1px solid #e8f4fc;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      background: #f8fbff;

      .select-btn {
        color: #64748b;
      }

      .delete-btn {
        color: #ef4444;
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #64748b;

      .empty-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e8f4fc 0%, #d1e8f5 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;

        mat-icon {
          font-size: 36px;
          width: 36px;
          height: 36px;
          color: #1e90ff;
        }
      }

      p {
        margin: 0 0 20px;
        font-size: 14px;
      }

      .start-chat-btn {
        background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
        color: white;
        border-radius: 12px;
        padding: 0 24px;
        height: 44px;
      }
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      padding: 40px;
    }

    /* Chat Area */
    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
    }

    .no-conversation-selected {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #64748b;
      padding: 40px;

      .welcome-illustration {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e8f4fc 0%, #d1e8f5 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 24px;

        mat-icon {
          font-size: 56px;
          width: 56px;
          height: 56px;
          color: #1e90ff;
        }
      }

      h3 {
        margin: 0 0 8px;
        font-weight: 600;
        color: #1e293b;
        font-size: 20px;
      }

      p {
        margin: 0 0 24px;
        font-size: 14px;
      }

      .primary-btn {
        background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
        color: white;
        border-radius: 12px;
        padding: 0 28px;
        height: 48px;
        font-weight: 500;
        box-shadow: 0 4px 15px rgba(30, 144, 255, 0.3);
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
      padding: 16px 24px;
      background: white;
      border-bottom: 1px solid #e8f4fc;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);

      .chat-info {
        display: flex;
        align-items: center;

        .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 14px;
          overflow: hidden;
          position: relative;

          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          mat-icon {
            color: white;
          }

          &.online::after {
            content: '';
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 12px;
            height: 12px;
            background: #22c55e;
            border-radius: 50%;
            border: 2px solid white;
          }
        }

        .details {
          h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            color: #1e293b;
          }

          .participants {
            font-size: 13px;
            color: #64748b;
          }
        }
      }

      .chat-actions {
        display: flex;
        gap: 4px;

        .action-btn {
          color: #64748b;
          transition: all 0.2s ease;

          &:hover {
            color: #1e90ff;
            background: rgba(30, 144, 255, 0.1);
          }
        }
      }
    }

    /* Messages Area */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: linear-gradient(180deg, #f8fbff 0%, #ffffff 50%, #f8fbff 100%);
    }

    .loading-messages {
      display: flex;
      justify-content: center;
      padding: 20px;
    }

    .message {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      max-width: 70%;

      &.sent {
        align-self: flex-end;
        flex-direction: row-reverse;

        .message-bubble {
          background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
          color: white;
          border-radius: 20px 20px 6px 20px;
          box-shadow: 0 4px 15px rgba(30, 144, 255, 0.25);

          .message-meta {
            color: rgba(255, 255, 255, 0.75);
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
          color: #1e293b;
          border-radius: 20px 20px 20px 6px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
          border: 1px solid #e8f4fc;
        }
      }

      &.deleted {
        .message-bubble {
          background: #f1f5f9 !important;
          color: #94a3b8 !important;
          font-style: italic;
          box-shadow: none !important;
        }
      }

      .message-avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
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
          color: white;
        }
      }

      .message-content {
        display: flex;
        align-items: flex-end;
        gap: 6px;

        .message-sender {
          font-size: 12px;
          font-weight: 600;
          color: #1e90ff;
          margin-bottom: 4px;
        }

        .message-bubble {
          padding: 12px 16px;
          max-width: 100%;

          p {
            margin: 0;
            word-wrap: break-word;
            line-height: 1.5;
          }

          .message-meta {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 4px;
            margin-top: 6px;
            font-size: 11px;
            color: #94a3b8;

            .edited-icon, .read-icon {
              font-size: 14px;
              width: 14px;
              height: 14px;
            }

            .read-icon {
              color: #22c55e;
            }
          }
        }

        .message-menu-btn {
          opacity: 0;
          transition: opacity 0.2s;
          color: #94a3b8;
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
      color: #64748b;
      padding: 40px;

      .no-messages-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #e8f4fc 0%, #d1e8f5 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 16px;

        mat-icon {
          font-size: 36px;
          width: 36px;
          height: 36px;
          color: #1e90ff;
        }
      }

      p {
        margin: 0;
        font-size: 14px;
      }
    }

    /* Reply Preview */
    .reply-preview {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: linear-gradient(90deg, rgba(30, 144, 255, 0.1) 0%, rgba(30, 144, 255, 0.05) 100%);
      border-left: 4px solid #1e90ff;
      margin: 0 20px;
      border-radius: 0 8px 8px 0;

      .reply-content {
        display: flex;
        align-items: center;
        gap: 12px;

        mat-icon {
          color: #1e90ff;
        }

        .reply-text {
          display: flex;
          flex-direction: column;

          .reply-sender {
            font-size: 12px;
            font-weight: 600;
            color: #1e90ff;
          }

          .reply-message {
            font-size: 13px;
            color: #64748b;
            max-width: 300px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        }
      }
    }

    /* Message Input */
    .message-input-area {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: white;
      border-top: 1px solid #e8f4fc;
      position: relative;

      .input-action {
        color: #64748b;
        transition: all 0.2s ease;

        &:hover, &.active {
          color: #1e90ff;
          background: rgba(30, 144, 255, 0.1);
        }
      }

      .message-input-wrapper {
        flex: 1;

        input {
          width: 100%;
          padding: 14px 20px;
          border: 1px solid #e8f4fc;
          border-radius: 24px;
          font-size: 14px;
          background: #f8fbff;
          transition: all 0.3s ease;

          &:focus {
            outline: none;
            border-color: #1e90ff;
            background: white;
            box-shadow: 0 0 0 3px rgba(30, 144, 255, 0.1);
          }
        }
      }

      .send-btn {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
        box-shadow: 0 4px 15px rgba(30, 144, 255, 0.3);

        &:disabled {
          background: #e2e8f0;
          box-shadow: none;
        }
      }
    }

    /* Emoji Picker */
    .emoji-picker-container {
      position: absolute;
      bottom: 80px;
      left: 24px;
      z-index: 1000;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
      border-radius: 12px;
      overflow: hidden;
      background: white;
    }

    /* Attachment Styles */
    .message-attachments {
      margin-top: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .attachment-item {
      position: relative;
    }

    .attachment-image-container {
      position: relative;
      width: 100%;
      max-width: 250px;
      cursor: pointer;
      border-radius: 12px;
      overflow: hidden;

      .attachment-image {
        width: 100%;
        display: block;
        max-height: 200px;
        object-fit: cover;
      }

      .attachment-overlay {
        position: absolute;
        top: 8px;
        right: 8px;
        opacity: 0;
        transition: opacity 0.2s;

        button {
          background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
          width: 36px;
          height: 36px;
        }
      }

      &:hover .attachment-overlay {
        opacity: 1;
      }
    }

    .attachment-file {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: rgba(30, 144, 255, 0.05);
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s;
      border: 1px solid rgba(30, 144, 255, 0.1);

      &:hover {
        background: rgba(30, 144, 255, 0.1);
      }

      .file-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: #1e90ff;
      }

      .file-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;

        .file-name {
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-size {
          font-size: 11px;
          color: #64748b;
        }
      }

      .download-btn {
        width: 36px;
        height: 36px;
        background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);
      }
    }

    .sent .attachment-file {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.2);

      .file-icon {
        color: rgba(255, 255, 255, 0.9);
      }

      .file-info .file-size {
        color: rgba(255, 255, 255, 0.75);
      }
    }

    /* Pending Attachments */
    .pending-attachments {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 20px;
      background: #f8fbff;
      border-top: 1px solid #e8f4fc;
    }

    .pending-file {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: white;
      border-radius: 20px;
      border: 1px solid #e8f4fc;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
        color: #1e90ff;
      }

      .file-name {
        font-size: 13px;
        max-width: 150px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-size {
        font-size: 11px;
        color: #64748b;
      }
    }

    /* Preview Overlay */
    .attachment-preview-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-container {
      background: white;
      border-radius: 16px;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: linear-gradient(135deg, #1e90ff 0%, #4169e1 100%);

      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        color: white;
        max-width: 400px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .preview-actions {
        display: flex;
        gap: 4px;

        button {
          color: white;
        }
      }
    }

    .preview-content {
      flex: 1;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #1e293b;
      min-width: 400px;
      min-height: 300px;

      img {
        max-width: 100%;
        max-height: 80vh;
        object-fit: contain;
      }

      iframe {
        width: 80vw;
        height: 80vh;
        background: white;
      }

      .no-preview {
        text-align: center;
        padding: 40px;
        color: white;

        mat-icon {
          font-size: 72px;
          width: 72px;
          height: 72px;
          margin-bottom: 16px;
          color: #64748b;
        }

        h4 {
          margin: 0 0 8px;
          font-weight: 500;
        }

        p {
          margin: 0 0 8px;
          color: #94a3b8;
        }

        .file-size {
          font-size: 13px;
          margin-bottom: 24px;
        }
      }
    }

    /* Scrollbar */
    .conversations-list::-webkit-scrollbar,
    .messages-area::-webkit-scrollbar {
      width: 6px;
    }

    .conversations-list::-webkit-scrollbar-track,
    .messages-area::-webkit-scrollbar-track {
      background: transparent;
    }

    .conversations-list::-webkit-scrollbar-thumb,
    .messages-area::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }

    .conversations-list::-webkit-scrollbar-thumb:hover,
    .messages-area::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    @media (max-width: 768px) {
      .conversations-sidebar {
        width: 100%;
        position: absolute;
        z-index: 10;
        left: 0;
        top: 0;
        height: 100%;
      }

      .messages-container {
        margin: 10px;
        height: calc(100vh - 64px - 104px - 20px);
      }
    }
  `]
})
export class MessagesComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer?: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;

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
  showEmojiPicker: boolean = false;
  
  replyingTo: Message | null = null;
  
  // Attachment properties
  pendingAttachments: File[] = [];
  previewingAttachment: MessageAttachment | null = null;
  
  private refreshSubscription?: Subscription;
  private signalRSubscriptions: Subscription[] = [];

  constructor(
    private messageService: MessageService,
    private snackBar: MatSnackBar,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    // Try 'currentUser' first (correct key used by AuthService), then fallback to 'user'
    const userJson = localStorage.getItem('currentUser') || localStorage.getItem('user');
    if (userJson) {
      const user = JSON.parse(userJson);
      this.currentUserId = user.userId;
      
      // Start SignalR connection
      this.messageService.startConnection(this.currentUserId).then(() => {
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

  getTotalUnread(): number {
    return this.conversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0);
  }

  isUserOnline(conversation: Conversation | null): boolean {
    if (!conversation || !conversation.participants) return false;
    const otherParticipant = conversation.participants.find(p => p.userId !== this.currentUserId);
    return otherParticipant?.isOnline ?? false;
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
    // If there are pending attachments, use the upload flow
    if (this.pendingAttachments.length > 0) {
      this.uploadAttachmentsAndSend();
      return;
    }
    
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
        this.showEmojiPicker = false; // Close emoji picker after sending
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

    if (!confirm('Are you sure you want to delete ' + selectedIds.length + ' conversation(s)?')) return;

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
      return otherParticipants.map(p => p.fullName || (p.name + ' ' + p.surname)).join(', ');
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
    return count + ' participant' + (count !== 1 ? 's' : '');
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

  // ============================================
  // Emoji Picker Methods
  // ============================================

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(event: any): void {
    const emoji = event.emoji.native;
    const cursorPos = this.messageInput?.nativeElement?.selectionStart || this.newMessage.length;
    
    // Insert emoji at cursor position
    this.newMessage = 
      this.newMessage.slice(0, cursorPos) + 
      emoji + 
      this.newMessage.slice(cursorPos);
    
    // Focus back on input and set cursor position
    setTimeout(() => {
      if (this.messageInput?.nativeElement) {
        this.messageInput.nativeElement.focus();
        const newCursorPos = cursorPos + emoji.length;
        this.messageInput.nativeElement.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  }

  // ============================================
  // Attachment Methods
  // ============================================

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const files = Array.from(input.files);
      const maxSize = 10 * 1024 * 1024; // 10MB limit
      
      for (const file of files) {
        if (file.size > maxSize) {
          this.snackBar.open('File "' + file.name + '" is too large. Maximum size is 10MB.', 'Close', { duration: 3000 });
          continue;
        }
        this.pendingAttachments.push(file);
      }
      
      // Clear input so same file can be selected again
      input.value = '';
    }
  }

  removePendingAttachment(index: number): void {
    this.pendingAttachments.splice(index, 1);
  }

  isImageFile(mimeType: string): boolean {
    return mimeType?.startsWith('image/') || false;
  }

  isPdfFile(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  getFileIcon(mimeType: string): string {
    if (!mimeType) return 'insert_drive_file';
    
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'picture_as_pdf';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'application/vnd.ms-excel' || mimeType.includes('sheet')) return 'table_chart';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'description';
    if (mimeType.includes('text')) return 'article';
    if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'folder_zip';
    
    return 'insert_drive_file';
  }

  getFileIconByName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
      case 'bmp':
        return 'image';
      case 'pdf':
        return 'picture_as_pdf';
      case 'xls':
      case 'xlsx':
      case 'csv':
        return 'table_chart';
      case 'doc':
      case 'docx':
        return 'description';
      case 'txt':
        return 'article';
      case 'zip':
      case 'rar':
      case '7z':
        return 'folder_zip';
      default:
        return 'insert_drive_file';
    }
  }

  formatFileSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  getAttachmentUrl(attachment: MessageAttachment): string {
    if (attachment.fileUrl) {
      // If it starts with /api, prepend the base URL
      if (attachment.fileUrl.startsWith('/api')) {
        return environment.apiUrl.replace('/api', '') + attachment.fileUrl;
      }
      return attachment.fileUrl;
    }
    return environment.apiUrl + '/messages/attachments/' + attachment.attachmentId;
  }

  getSafeUrl(attachment: MessageAttachment): SafeResourceUrl {
    const url = this.getAttachmentUrl(attachment);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  previewAttachment(attachment: MessageAttachment): void {
    this.previewingAttachment = attachment;
  }

  closePreview(): void {
    this.previewingAttachment = null;
  }

  downloadAttachment(attachment: MessageAttachment): void {
    const url = this.getAttachmentUrl(attachment);
    
    // Create a temporary anchor element to trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.fileName;
    a.target = '_blank';
    
    // For cross-origin requests, we need to fetch and create a blob
    fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + (localStorage.getItem('token') || '')
      }
    })
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      a.href = blobUrl;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    })
    .catch(() => {
      // Fallback: just open in new tab
      window.open(url, '_blank');
    });
  }

  async uploadAttachmentsAndSend(): Promise<void> {
    if (!this.selectedConversation || (this.pendingAttachments.length === 0 && !this.newMessage.trim())) {
      return;
    }

    // First send the message
    const request: SendMessageRequest = {
      conversationId: this.selectedConversation.conversationId,
      content: this.newMessage.trim() || (this.pendingAttachments.length > 0 ? 'Sent ' + this.pendingAttachments.length + ' attachment(s)' : ''),
      replyToMessageId: this.replyingTo?.messageId
    };

    try {
      const message = await this.messageService.sendMessage(request, this.currentUserId).toPromise();
      
      if (message) {
        // Upload attachments to this message
        for (const file of this.pendingAttachments) {
          try {
            await this.uploadFileAsAttachment(message.messageId, file);
          } catch (err) {
            console.error('Error uploading attachment:', err);
            this.snackBar.open('Failed to upload ' + file.name, 'Close', { duration: 3000 });
          }
        }
        
        // Reload messages to show attachments
        this.loadMessages();
      }
      
      this.newMessage = '';
      this.pendingAttachments = [];
      this.replyingTo = null;
      
    } catch (err) {
      console.error('Error sending message:', err);
      this.snackBar.open('Failed to send message', 'Close', { duration: 3000 });
    }
  }

  private async uploadFileAsAttachment(messageId: number, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        
        try {
          await this.messageService.addAttachmentToMessage(messageId, {
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            base64Data: base64
          }, this.currentUserId).toPromise();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
