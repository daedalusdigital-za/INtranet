import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Subscription, interval } from 'rxjs';
import { MessageService, Conversation, Message, User, SendMessageRequest, MessageAttachment } from '../../services/message.service';
import { WellyActivityService } from '../../services/welly-activity.service';
import { UserSearchPopupComponent } from '../user-search-popup/user-search-popup.component';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { ToastService } from '../../ui/toast.service';
import { environment } from '../../../environments/environment';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { SecureSrcDirective } from '../../directives/secure-src.directive';
import { ConfirmService } from '../../ui/confirm.service';

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
    MatCheckboxModule,
    UserSearchPopupComponent,
    NavbarComponent,
    PageHeaderComponent,
    EmptyStateComponent,
    SkeletonRowsComponent,
    PickerComponent,
    SecureSrcDirective
  ],
  template: `
    <app-navbar></app-navbar>
    
    <div class="messages-page">
      <app-page-header [crumbs]="['Workspace', 'Messages']" title="Messages"></app-page-header>

      <div class="messages-container">
        <!-- Sidebar - Conversations List -->
        <div class="conversations-sidebar">
          <div class="sidebar-header">
            <h2>Conversations</h2>
            <button aria-label="New Message" mat-mini-fab class="new-chat-btn" (click)="showNewConversation = true" matTooltip="New Message">
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

            <app-empty-state *ngIf="filteredConversations.length === 0"
                             icon="chat_bubble_outline"
                             title="No conversations found"
                             [message]="searchQuery ? 'No conversation matches your search.' : 'Start a chat with a colleague and it will show up here.'"
                             [compact]="true">
              <button mat-flat-button color="primary" (click)="showNewConversation = true">
                <mat-icon>add</mat-icon> Start new chat
              </button>
            </app-empty-state>
          </div>

          <div *ngIf="loading" class="loading-spinner">
            <app-skeleton-rows [rows]="6"></app-skeleton-rows>
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
            <app-empty-state icon="forum"
                             title="Select a conversation"
                             message="Choose a conversation from the sidebar or start a new one.">
              <button mat-flat-button color="primary" (click)="showNewConversation = true">
                <mat-icon>add</mat-icon>
                Start new conversation
              </button>
            </app-empty-state>
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
                <button aria-label="Voice Call" mat-icon-button matTooltip="Voice Call" class="action-btn">
                  <mat-icon>call</mat-icon>
                </button>
                <button aria-label="Video Call" mat-icon-button matTooltip="Video Call" class="action-btn">
                  <mat-icon>videocam</mat-icon>
                </button>
                <button aria-label="More actions" mat-icon-button [matMenuTriggerFor]="chatMenu" class="action-btn">
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
                <app-skeleton-rows [rows]="3" [avatar]="false"></app-skeleton-rows>
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
                          <img [appSecureSrc]="getAttachmentUrl(attachment)" [alt]="attachment.fileName" (click)="previewAttachment(attachment)" class="attachment-image" loading="lazy">
                          <div class="attachment-overlay">
                            <button aria-label="Download" mat-mini-fab (click)="downloadAttachment(attachment); $event.stopPropagation()" matTooltip="Download">
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
                          <button aria-label="Download" mat-mini-fab (click)="downloadAttachment(attachment); $event.stopPropagation()" matTooltip="Download" class="download-btn">
                            <mat-icon>download</mat-icon>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div class="message-meta">
                      <span class="time">{{ formatMessageTime(message.sentAt) }}</span>
                      <mat-icon *ngIf="message.isEdited" class="edited-icon" matTooltip="Edited">edit</mat-icon>
                      <mat-icon *ngIf="message.senderId === currentUserId" class="read-icon" [class.read]="readStatus(message) === 'read'" [matTooltip]="readTooltip(message)">{{ readStatus(message) === 'sent' ? 'done' : 'done_all' }}</mat-icon>
                    </div>
                  </div>
                  
                  <button aria-label="More actions" mat-icon-button class="message-menu-btn" [matMenuTriggerFor]="messageMenu" *ngIf="!message.isDeleted">
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
                <app-empty-state icon="chat" title="No messages yet" message="Say hello to start the conversation."></app-empty-state>
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
              <button aria-label="Close" mat-icon-button (click)="replyingTo = null">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <!-- Pending Attachments Preview -->
            <div *ngIf="pendingAttachments.length > 0" class="pending-attachments">
              <div *ngFor="let file of pendingAttachments; let i = index" class="pending-file">
                <mat-icon>{{ getFileIconByName(file.name) }}</mat-icon>
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
                <button aria-label="Close" mat-icon-button (click)="removePendingAttachment(i)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>

            <!-- Message Input -->
            <div class="message-input-area">
              <input type="file" #fileInput hidden multiple (change)="onFilesSelected($event)" 
                     accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.txt,.csv">
              <button aria-label="Attach file" mat-icon-button class="input-action" (click)="fileInput.click()" matTooltip="Attach file">
                <mat-icon>attach_file</mat-icon>
              </button>
              <button aria-label="Add emoji" mat-icon-button class="input-action" (click)="toggleEmojiPicker()" matTooltip="Add emoji" [class.active]="showEmojiPicker">
                <mat-icon>sentiment_satisfied_alt</mat-icon>
              </button>
              <button aria-label="Ask Welly AI" mat-icon-button class="input-action welly-msg-btn" [matMenuTriggerFor]="wellyMsgMenu" matTooltip="Ask Welly AI">
                <mat-icon class="welly-sparkle-icon">auto_awesome</mat-icon>
              </button>
              <mat-menu #wellyMsgMenu="matMenu">
                <button mat-menu-item (click)="wellyDraftMessage()">
                  <mat-icon>edit_note</mat-icon>
                  <span>Draft a Message</span>
                </button>
                <button mat-menu-item (click)="wellyTranslateMessage()" [disabled]="!newMessage.trim()">
                  <mat-icon>translate</mat-icon>
                  <span>Translate Message</span>
                </button>
                <button mat-menu-item (click)="wellySummarizeConversation()" [disabled]="messages.length === 0">
                  <mat-icon>summarize</mat-icon>
                  <span>Summarize Conversation</span>
                </button>
              </mat-menu>
              <div class="message-input-wrapper">
                <input type="text"
                       #messageInput
                       placeholder="Type a message..." 
                       [(ngModel)]="newMessage"
                       (keyup.enter)="sendMessage()">
              </div>
              <button aria-label="Send" mat-fab class="send-btn" (click)="sendMessage()" [disabled]="!newMessage.trim() && pendingAttachments.length === 0">
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

    <!-- Welly AI Message Assistant Panel -->
    <div *ngIf="showWellyPanel" class="welly-panel-overlay" (click)="showWellyPanel = false">
      <div class="welly-panel" (click)="$event.stopPropagation()">
        <div class="welly-panel-header">
          <div class="welly-panel-title">
            <mat-icon class="welly-sparkle">auto_awesome</mat-icon>
            <h3>Welly Message Assistant</h3>
          </div>
          <button aria-label="Close" mat-icon-button (click)="showWellyPanel = false">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <div class="welly-panel-body">
          <div *ngIf="wellyLoading" class="welly-loading">
            <mat-spinner diameter="36"></mat-spinner>
            <p>{{ wellyActionLabel }}</p>
          </div>
          <div *ngIf="!wellyLoading && wellyResult" class="welly-result">
            <div class="welly-result-text">{{ wellyResult }}</div>
            <div class="welly-result-actions">
              <button mat-raised-button color="primary" (click)="useWellyDraft()" *ngIf="wellyLastAction === 'draft' || wellyLastAction === 'translate'">
                <mat-icon>check</mat-icon> Use This
              </button>
              <button mat-button (click)="copyWellyResult()">
                <mat-icon>content_copy</mat-icon> Copy
              </button>
            </div>
          </div>
          <div *ngIf="!wellyLoading && !wellyResult && wellyLastAction === 'draft'" class="welly-draft-form">
            <p>Describe the message you'd like Welly to draft:</p>
            <textarea [(ngModel)]="wellyDraftPrompt" placeholder="e.g., Let the team know the meeting has been moved to 3pm..." rows="3"></textarea>
            <div class="welly-draft-form-actions">
              <button mat-raised-button color="primary" (click)="submitWellyDraft()" [disabled]="!wellyDraftPrompt.trim()">
                <mat-icon>auto_fix_high</mat-icon> Draft
              </button>
            </div>
          </div>
          <div *ngIf="!wellyLoading && !wellyResult && wellyLastAction === 'translate'" class="welly-translate-form">
            <p>Translate to:</p>
            <div class="welly-lang-buttons">
              <button mat-raised-button (click)="submitWellyTranslate('Afrikaans')">Afrikaans</button>
              <button mat-raised-button (click)="submitWellyTranslate('Zulu')">Zulu</button>
              <button mat-raised-button (click)="submitWellyTranslate('Xhosa')">Xhosa</button>
              <button mat-raised-button (click)="submitWellyTranslate('Sotho')">Sotho</button>
              <button mat-raised-button (click)="submitWellyTranslate('French')">French</button>
              <button mat-raised-button (click)="submitWellyTranslate('Portuguese')">Portuguese</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Attachment Preview Overlay -->
    <div *ngIf="previewingAttachment" class="attachment-preview-overlay" (click)="closePreview()">
      <div class="preview-container" (click)="$event.stopPropagation()">
        <div class="preview-header">
          <h3>{{ previewingAttachment.fileName }}</h3>
          <div class="preview-actions">
            <button aria-label="Download" mat-icon-button (click)="downloadAttachment(previewingAttachment)" matTooltip="Download">
              <mat-icon>download</mat-icon>
            </button>
            <button aria-label="Close" mat-icon-button (click)="closePreview()" matTooltip="Close">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>
        <div class="preview-content">
          <!-- Image Preview -->
          <img *ngIf="isImageFile(previewingAttachment.mimeType)" [appSecureSrc]="getAttachmentUrl(previewingAttachment)" [alt]="previewingAttachment.fileName">
          
          <!-- PDF Preview -->
          <iframe *ngIf="isPdfFile(previewingAttachment.mimeType)" [appSecureSrc]="getAttachmentUrl(previewingAttachment)" frameborder="0"></iframe>
          
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
    /* Main Page Layout: fills the window below the top bar. The header takes its natural
       height and the chat container takes the rest, so there is no page scrollbar. */
    .messages-page {
      box-sizing: border-box;
      height: calc(100vh - var(--shell-topbar-height));
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-5);
      background: var(--color-canvas);
    }

    /* Messages Container */
    .messages-container {
      /* The phone layout lays the conversation list over this panel (position: absolute). */
      position: relative;
      display: flex;
      flex: 1;
      min-height: 320px;
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }

    /* Sidebar */
    .conversations-sidebar {
      width: 360px;
      background: var(--color-surface);
      display: flex;
      flex-direction: column;
      border-right: 1px solid var(--color-line);
    }

    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: var(--color-surface-2);
      border-bottom: 1px solid var(--color-line);

      h2 {
        margin: 0;
        font-size: var(--text-xl);
        font-weight: 600;
        color: var(--color-text);
      }
    }

    .new-chat-btn {
      background: var(--color-primary);
      color: var(--color-on-primary);
      box-shadow: var(--shadow-sm);
    }

    .search-box {
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--color-surface-2);

      .search-icon {
        color: var(--color-text-3);
      }

      input {
        flex: 1;
        border: none;
        background: var(--color-surface);
        color: var(--color-text);
        padding: 12px 16px;
        border-radius: 12px;
        font-size: var(--text-md);
        border: 1px solid var(--color-line);
        transition: all 0.3s ease;

        &:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px var(--color-primary-soft);
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
      border-bottom: 1px solid var(--color-surface-2);
      transition: all 0.2s ease;

      &:hover {
        background: var(--color-surface-2);
      }

      &.active {
        background: var(--color-primary-soft);
        border-left: 4px solid var(--color-primary);
      }

      &.unread {
        background: var(--color-surface-2);

        .name {
          font-weight: 600;
          color: var(--color-primary);
        }
      }

      .avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--color-primary);
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
          color: var(--color-on-primary);
          font-size: var(--text-2xl);
        }

        &.online::after {
          content: '';
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 12px;
          height: 12px;
          background: var(--color-ok);
          border-radius: 50%;
          border: 2px solid var(--color-surface);
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
            color: var(--color-text);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .time {
            font-size: var(--text-xs);
            color: var(--color-text-3);
            white-space: nowrap;
          }
        }

        .last-message {
          font-size: var(--text-sm);
          color: var(--color-text-3);
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
          background: var(--color-primary);
          color: var(--color-on-primary);
          font-size: var(--text-xs);
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
      border-top: 1px solid var(--color-line);
      display: flex;
      justify-content: space-between;
      gap: 8px;
      background: var(--color-surface-2);

      .select-btn {
        color: var(--color-text-3);
      }

      .delete-btn {
        color: var(--color-danger);
      }
    }

    .loading-spinner {
      flex: 1;
      overflow: hidden;
    }

    /* Chat Area */
    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--color-surface);
    }

    .no-conversation-selected {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px;
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
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-line);
      box-shadow: var(--shadow-sm);

      .chat-info {
        display: flex;
        align-items: center;

        .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: var(--color-primary);
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
            color: var(--color-on-primary);
          }

          &.online::after {
            content: '';
            position: absolute;
            bottom: 2px;
            right: 2px;
            width: 12px;
            height: 12px;
            background: var(--color-ok);
            border-radius: 50%;
            border: 2px solid var(--color-surface);
          }
        }

        .details {
          h3 {
            margin: 0;
            font-size: var(--text-lg);
            font-weight: 600;
            color: var(--color-text);
          }

          .participants {
            font-size: var(--text-sm);
            color: var(--color-text-3);
          }
        }
      }

      .chat-actions {
        display: flex;
        gap: 4px;

        .action-btn {
          color: var(--color-text-3);
          transition: all 0.2s ease;

          &:hover {
            color: var(--color-primary);
            background: var(--color-primary-soft);
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
      background: var(--color-canvas);
    }

    .loading-messages {
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
          background: var(--color-primary);
          color: var(--color-on-primary);
          border-radius: 20px 20px 6px 20px;
          box-shadow: var(--shadow-sm);

          .message-meta {
            color: var(--color-on-primary);
            opacity: 0.8;
          }
        }

        .message-menu-btn {
          order: -1;
        }
      }

      &.received {
        align-self: flex-start;

        .message-bubble {
          background: var(--color-surface);
          color: var(--color-text);
          border-radius: 20px 20px 20px 6px;
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--color-line);
        }
      }

      &.deleted {
        .message-bubble {
          background: var(--color-surface-2);
          color: var(--color-text-3);
          font-style: italic;
          box-shadow: none;
        }
      }

      .message-avatar {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--color-primary);
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
          font-size: var(--text-xl);
          width: 18px;
          height: 18px;
          color: var(--color-on-primary);
        }
      }

      .message-content {
        display: flex;
        align-items: flex-end;
        gap: 6px;

        .message-sender {
          font-size: var(--text-xs);
          font-weight: 600;
          color: var(--color-primary);
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
            font-size: var(--text-xs);
            color: var(--color-text-3);

            .edited-icon, .read-icon {
              font-size: var(--text-md);
              width: 14px;
              height: 14px;
            }

            .read-icon {
              color: var(--color-text-3);
              opacity: 0.8;

              &.read {
                color: #34B7F1; // WhatsApp blue
                opacity: 1;
              }
            }
          }
        }

        .message-menu-btn {
          opacity: 0;
          transition: opacity 0.2s;
          color: var(--color-text-3);
        }
      }

      &:hover .message-menu-btn {
        opacity: 1;
      }
    }

    .no-messages {
      display: flex;
      align-items: center;
      justify-content: center;
      flex: 1;
      padding: 40px;
    }

    /* Reply Preview */
    .reply-preview {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: var(--color-primary-soft);
      border-left: 4px solid var(--color-primary);
      margin: 0 20px;
      border-radius: 0 8px 8px 0;

      .reply-content {
        display: flex;
        align-items: center;
        gap: 12px;

        mat-icon {
          color: var(--color-primary);
        }

        .reply-text {
          display: flex;
          flex-direction: column;

          .reply-sender {
            font-size: var(--text-xs);
            font-weight: 600;
            color: var(--color-primary);
          }

          .reply-message {
            font-size: var(--text-sm);
            color: var(--color-text-3);
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
      background: var(--color-surface);
      border-top: 1px solid var(--color-line);
      position: relative;

      .input-action {
        color: var(--color-text-3);
        transition: all 0.2s ease;

        &:hover, &.active {
          color: var(--color-primary);
          background: var(--color-primary-soft);
        }
      }

      .message-input-wrapper {
        flex: 1;

        input {
          width: 100%;
          padding: 14px 20px;
          border: 1px solid var(--color-line);
          border-radius: 24px;
          font-size: var(--text-md);
          background: var(--color-surface-2);
          color: var(--color-text);
          transition: all 0.3s ease;

          &:focus {
            outline: none;
            border-color: var(--color-primary);
            background: var(--color-surface);
            box-shadow: 0 0 0 3px var(--color-primary-soft);
          }
        }
      }

      .send-btn {
        width: 48px;
        height: 48px;
        background: var(--color-primary);
        color: var(--color-on-primary);
        box-shadow: var(--shadow-sm);

        &:disabled {
          background: var(--color-line);
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
      box-shadow: var(--shadow-lg);
      border-radius: 12px;
      overflow: hidden;
      background: var(--color-surface);
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
          background: var(--color-primary);
          color: var(--color-on-primary);
          box-shadow: var(--shadow-md);
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
      background: var(--color-surface-2);
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s;
      border: 1px solid var(--color-line);

      &:hover {
        background: var(--color-primary-soft);
      }

      .file-icon {
        font-size: var(--text-3xl);
        width: 24px;
        height: 24px;
        color: var(--color-primary);
      }

      .file-info {
        display: flex;
        flex-direction: column;
        min-width: 0;
        flex: 1;

        .file-name {
          font-size: var(--text-sm);
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .file-size {
          font-size: var(--text-xs);
          color: var(--color-text-3);
        }
      }

      .download-btn {
        width: 36px;
        height: 36px;
        background: var(--color-primary);
        color: var(--color-on-primary);
      }
    }

    .sent .attachment-file {
      color: var(--color-text);
    }

    /* Pending Attachments */
    .pending-attachments {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 12px 20px;
      background: var(--color-surface-2);
      border-top: 1px solid var(--color-line);
    }

    .pending-file {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--color-surface);
      border-radius: 20px;
      border: 1px solid var(--color-line);

      mat-icon {
        font-size: var(--text-xl);
        width: 18px;
        height: 18px;
        color: var(--color-primary);
      }

      .file-name {
        font-size: var(--text-sm);
        max-width: 150px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .file-size {
        font-size: var(--text-xs);
        color: var(--color-text-3);
      }
    }

    /* Preview Overlay */
    .attachment-preview-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-scrim);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-container {
      background: var(--color-surface);
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
      background: var(--color-primary);

      h3 {
        margin: 0;
        font-size: var(--text-lg);
        font-weight: 500;
        color: var(--color-on-primary);
        max-width: 400px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .preview-actions {
        display: flex;
        gap: 4px;

        button {
          color: var(--color-on-primary);
        }
      }
    }

    .preview-content {
      flex: 1;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface-2);
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
        background: var(--color-surface);
      }

      .no-preview {
        text-align: center;
        padding: 40px;
        color: var(--color-text);

        mat-icon {
          font-size: 72px;
          width: 72px;
          height: 72px;
          margin-bottom: 16px;
          color: var(--color-text-3);
        }

        h4 {
          margin: 0 0 8px;
          font-weight: 500;
        }

        p {
          margin: 0 0 8px;
          color: var(--color-text-3);
        }

        .file-size {
          font-size: var(--text-sm);
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
      background: var(--color-line-strong);
      border-radius: 3px;
    }

    .conversations-list::-webkit-scrollbar-thumb:hover,
    .messages-area::-webkit-scrollbar-thumb:hover {
      background: var(--color-text-3);
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

      .messages-page {
        padding: var(--space-3);
        gap: var(--space-3);
      }
    }

    /* Welly Message Assistant Styles */
    .welly-msg-btn .welly-sparkle-icon {
      color: var(--color-primary);
    }

    .welly-msg-btn:hover {
      background: var(--color-primary-soft);
    }

    .welly-panel-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--color-scrim);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .welly-panel {
      background: var(--color-surface);
      border-radius: 16px;
      width: 520px;
      max-width: 90vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }

    .welly-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: var(--color-primary);
      color: var(--color-on-primary);
    }

    .welly-panel-title {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .welly-panel-title h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 600;
    }

    .welly-sparkle {
      color: var(--color-on-primary);
    }

    .welly-panel-header button {
      color: var(--color-on-primary);
    }

    .welly-panel-body {
      padding: 24px;
      overflow-y: auto;
      max-height: 60vh;
    }

    .welly-loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 32px;
    }

    .welly-loading p {
      color: var(--color-text-2);
      font-size: var(--text-md);
    }

    .welly-result-text {
      background: var(--color-canvas);
      border: 1px solid var(--color-line);
      border-radius: 10px;
      padding: 16px;
      font-size: var(--text-md);
      line-height: 1.6;
      white-space: pre-wrap;
      max-height: 40vh;
      overflow-y: auto;
      margin-bottom: 16px;
    }

    .welly-result-actions {
      display: flex;
      gap: 8px;
    }

    .welly-draft-form, .welly-translate-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .welly-draft-form p, .welly-translate-form p {
      margin: 0;
      color: var(--color-text-2);
      font-size: var(--text-md);
    }

    .welly-draft-form textarea {
      width: 100%;
      border: 1px solid var(--color-line);
      border-radius: 8px;
      padding: 12px;
      font-size: var(--text-md);
      font-family: inherit;
      background: var(--color-surface);
      color: var(--color-text);
      resize: vertical;
      outline: none;
    }

    .welly-draft-form textarea:focus {
      border-color: var(--color-primary);
    }

    .welly-draft-form-actions {
      display: flex;
      justify-content: flex-end;
    }

    .welly-lang-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .welly-lang-buttons button {
      flex: 0 0 auto;
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
    private toast: ToastService,
    private router: Router,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private wellyActivity: WellyActivityService,
    private readonly confirmDialog: ConfirmService
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
        this.toast.error('Unable to connect to real-time messaging. New messages may be delayed.');
      });
      
      // Subscribe to real-time events
      this.setupSignalRSubscriptions();
      
      // Load conversations now that we have a valid userId
      this.loadConversations();
    } else {
      console.error('No user found in localStorage');
      this.toast.warn('Please log in to view messages.');
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
    if (this.selectedConversation) {
      this.messageService.leaveConversation(this.selectedConversation.conversationId);
    }
    // The hub connection is app-wide (owned by the navbar) so that new-message
    // bubbles and badges keep working on every page. Do not stop it here.
  }

  private upsertMessage(message: Message): void {
    const idx = this.messages.findIndex(m => m.messageId === message.messageId);
    if (idx >= 0) {
      this.messages[idx] = message;
    } else {
      this.messages.push(message);
      this.messages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
      this.scrollToBottom();
    }
  }

  private setupSignalRSubscriptions(): void {
    // New message received
    this.signalRSubscriptions.push(
      this.messageService.newMessage$.subscribe(message => {
        // Add to messages if in the current conversation
        if (this.selectedConversation?.conversationId === message.conversationId) {
          const existed = this.messages.some(m => m.messageId === message.messageId);
          this.upsertMessage(message);
          if (!existed && message.senderId !== this.currentUserId) {
            // Mark as read if conversation is open
            this.messageService.markAsRead(message.conversationId, this.currentUserId).subscribe({
              next: () => this.messageService.refreshUnreadCount(this.currentUserId),
              error: () => {}
            });
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

    // Message replaced (attachment finished uploading)
    this.signalRSubscriptions.push(
      this.messageService.messageUpdated$.subscribe(message => {
        if (this.selectedConversation?.conversationId === message.conversationId) {
          this.upsertMessage(message);
        }
        const conv = this.conversations.find(c => c.conversationId === message.conversationId);
        if (conv && conv.lastMessage?.messageId === message.messageId) {
          conv.lastMessage = message;
        }
      })
    );

    // Other participant read our messages
    this.signalRSubscriptions.push(
      this.messageService.messagesRead$.subscribe(({ conversationId, userId, messageIds, readAt }) => {
        if (userId === this.currentUserId || this.selectedConversation?.conversationId !== conversationId) return;
        const ids = new Set(messageIds);
        this.messages.forEach(m => {
          if (ids.has(m.messageId) && !m.readReceipts?.some(r => r.userId === userId)) {
            m.readReceipts = [...(m.readReceipts || []), { userId, userName: '', readAt }];
          }
        });
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
        this.toast.error('Conversations could not be loaded. Try again.');
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
        this.upsertMessage(message);
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
        this.toast.error('The message could not be sent. Try again.');
      }
    });
  }

  replyToMessage(message: Message): void {
    this.replyingTo = message;
  }

  async deleteMessage(message: Message): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: 'Delete this message?',
      message: 'It will show as "This message was deleted" in the conversation.',
      confirmText: 'Delete message',
      danger: true
    }))) return;

    this.messageService.deleteMessage(message.messageId, this.currentUserId).subscribe({
      next: () => {
        message.isDeleted = true;
        message.content = 'This message was deleted';
        this.toast.done('Message deleted.');
      },
      error: () => {
        this.toast.error('The message could not be deleted. Try again.');
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

  async deleteSelectedConversations(): Promise<void> {
    const selectedIds = Object.entries(this.selectedForDelete)
      .filter(([_, selected]) => selected)
      .map(([id, _]) => parseInt(id));

    if (selectedIds.length === 0) return;

    if (!(await this.confirmDialog.ask({
      title: `Permanently delete ${selectedIds.length} ${selectedIds.length === 1 ? 'conversation' : 'conversations'}?`,
      message: 'All messages in them will be lost.',
      confirmText: selectedIds.length === 1 ? 'Delete conversation' : 'Delete conversations',
      danger: true
    }))) return;

    let completed = 0;
    let failed = 0;
    selectedIds.forEach(id => {
      this.messageService.deleteConversation(id, this.currentUserId).subscribe({
        next: () => {
          completed++;
          this.conversations = this.conversations.filter(c => c.conversationId !== id);
          this.filterConversations();
          if (this.selectedConversation?.conversationId === id) {
            this.selectedConversation = null;
            this.messages = [];
          }
          if (completed + failed === selectedIds.length) {
            this.selectedForDelete = {};
            this.selectMode = false;
            this.toast.done(`${completed} conversation(s) deleted.`);
          }
        },
        error: () => {
          failed++;
          if (completed + failed === selectedIds.length) {
            this.selectedForDelete = {};
            this.selectMode = false;
            this.toast.warn(`${completed} deleted, ${failed} failed.`);
          }
        }
      });
    });
  }

  async deleteConversation(conversation: Conversation): Promise<void> {
    if (!(await this.confirmDialog.ask({
      title: `Permanently delete the conversation with ${this.getConversationName(conversation)}?`,
      message: 'All messages will be lost.',
      confirmText: 'Delete conversation',
      danger: true
    }))) return;

    this.messageService.deleteConversation(conversation.conversationId, this.currentUserId).subscribe({
      next: () => {
        this.conversations = this.conversations.filter(c => c.conversationId !== conversation.conversationId);
        this.filterConversations();
        if (this.selectedConversation?.conversationId === conversation.conversationId) {
          this.selectedConversation = null;
          this.messages = [];
        }
        this.toast.done('Conversation deleted.');
      },
      error: () => {
        this.toast.error('The conversation could not be deleted. Try again.');
      }
    });
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
        this.toast.error('The conversation could not be started. Try again.');
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

  readStatus(message: Message): 'sent' | 'partial' | 'read' {
    return this.messageService.getReadStatus(message, this.currentUserId, this.selectedConversation?.participants);
  }

  readTooltip(message: Message): string {
    return this.messageService.getReadTooltip(message, this.currentUserId, this.selectedConversation?.participants);
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
          this.toast.warn('File "' + file.name + '" is too large. Maximum size is 10MB.');
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
    return this.messageService.getAttachmentUrl(attachment);
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
    this.messageService.downloadAttachment(attachment).catch(() => {
      this.toast.error('Could not download ' + attachment.fileName + '.');
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
        message.attachments = message.attachments || [];
        this.upsertMessage(message);
        // Upload attachments to this message
        for (const file of this.pendingAttachments) {
          try {
            const att = await this.uploadFileAsAttachment(message.messageId, file);
            if (att) {
              message.attachments = [...message.attachments, att];
              this.upsertMessage({ ...message });
            }
          } catch (err) {
            console.error('Error uploading attachment:', err);
            this.toast.error('Failed to upload ' + file.name + '.');
          }
        }
        if (this.selectedConversation) {
          this.selectedConversation.lastMessage = message;
          this.selectedConversation.lastMessageAt = message.sentAt;
        }
      }
      
      this.newMessage = '';
      this.pendingAttachments = [];
      this.replyingTo = null;
      
    } catch (err) {
      console.error('Error sending message:', err);
      this.toast.error('The message could not be sent. Try again.');
    }
  }

  private async uploadFileAsAttachment(messageId: number, file: File): Promise<MessageAttachment | undefined> {
    // Stream the file to disk-backed storage (multipart) instead of base64 in the DB.
    return await this.messageService.uploadFileToMessage(messageId, file, this.currentUserId).toPromise();
  }

  // ═══════════════════════════════════════════
  // Welly AI Message Assistant
  // ═══════════════════════════════════════════

  showWellyPanel = false;
  wellyLoading = false;
  wellyResult = '';
  wellyLastAction = '';
  wellyActionLabel = '';
  wellyDraftPrompt = '';
  private wellyActivityId: number | null = null;

  wellyDraftMessage(): void {
    this.wellyLastAction = 'draft';
    this.wellyResult = '';
    this.wellyDraftPrompt = '';
    this.wellyLoading = false;
    this.showWellyPanel = true;
  }

  submitWellyDraft(): void {
    if (!this.wellyDraftPrompt.trim()) return;
    this.wellyLoading = true;
    this.wellyActionLabel = 'Welly is drafting your message...';
    this.wellyActivityId = this.wellyActivity.start('Messages: Drafting message');

    const context = this.selectedConversation
      ? `Conversation with: ${this.selectedConversation.participants?.map(p => p.fullName).join(', ') || 'colleague'}\n\n`
      : '';

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: 'draft-message',
      content: context + this.wellyDraftPrompt
    }).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      },
      error: () => {
        this.toast.error('Welly could not draft the message. Please try again.');
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      }
    });
  }

  wellyTranslateMessage(): void {
    if (!this.newMessage.trim()) return;
    this.wellyLastAction = 'translate';
    this.wellyResult = '';
    this.wellyLoading = false;
    this.showWellyPanel = true;
  }

  submitWellyTranslate(language: string): void {
    this.wellyLoading = true;
    this.wellyActionLabel = `Welly is translating to ${language}...`;
    this.wellyActivityId = this.wellyActivity.start(`Messages: Translating to ${language}`);

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: 'translate-message',
      content: this.newMessage,
      targetLanguage: language
    }).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      },
      error: () => {
        this.toast.error('Welly could not translate the message. Please try again.');
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      }
    });
  }

  wellySummarizeConversation(): void {
    if (this.messages.length === 0) return;
    this.wellyLastAction = 'summarize';
    this.wellyResult = '';
    this.wellyLoading = true;
    this.wellyActionLabel = 'Welly is summarizing the conversation...';
    this.showWellyPanel = true;
    this.wellyActivityId = this.wellyActivity.start('Messages: Summarizing conversation');

    const msgThread = this.messages.slice(-50).map(m =>
      `${m.senderFullName || m.senderName}: ${m.content}`
    ).join('\n');

    this.http.post<{ result: string }>(`${environment.apiUrl}/aichat/welly-assist`, {
      assistType: 'summarize-messages',
      content: msgThread
    }).subscribe({
      next: (res) => {
        this.wellyResult = res.result;
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      },
      error: () => {
        this.toast.error('Welly could not summarize the conversation. Please try again.');
        this.wellyLoading = false;
        if (this.wellyActivityId !== null) { this.wellyActivity.stop(this.wellyActivityId); this.wellyActivityId = null; }
      }
    });
  }

  useWellyDraft(): void {
    this.newMessage = this.wellyResult;
    this.showWellyPanel = false;
    this.toast.done('Message inserted.');
    setTimeout(() => this.messageInput?.nativeElement?.focus(), 100);
  }

  copyWellyResult(): void {
    navigator.clipboard.writeText(this.wellyResult).then(() => {
      this.toast.done('Copied to clipboard.');
    });
  }
}
