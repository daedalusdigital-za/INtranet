import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MessageService, Conversation, Message, Participant, MessageAttachment } from '../../services/message.service';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { SecureSrcDirective } from '../../directives/secure-src.directive';
import { MatIconModule } from '@angular/material/icon';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerComponent, SecureSrcDirective, MatIconModule, SkeletonRowsComponent, EmptyStateComponent],
  templateUrl: './chat-bubble.component.html',
  styleUrls: ['./chat-bubble.component.scss']
})
export class ChatBubbleComponent implements OnInit, OnDestroy {
  @Input() conversation!: Conversation;
  @Input() currentUserId!: number;
  @Input() position: number = 0; // Position from right (0, 1, 2...)
  @Output() close = new EventEmitter<number>();
  
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('fileInput') fileInput!: ElementRef;

  isOpen = true;
  isMinimized = false;
  messages: Message[] = [];
  newMessage = '';
  isLoading = false;
  isSending = false;
  selectedFile: File | null = null;
  showEmojiPicker = false;
  attention = false;
  /** True while there are unread incoming messages the user has not opened yet (keeps the round bubble pulsing). */
  pendingRead = false;
  typingUser: string | null = null;
  uploadError: string | null = null;

  private refreshInterval: any;
  private subs: Subscription[] = [];
  private attentionTimeout: any;
  private typingTimeout: any;
  private typingSentAt = 0;
  private visibilityHandler: (() => void) | null = null;

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {
    // Auto-popped for an incoming message: start as a round bubble that keeps pulsing until opened and read.
    if (this.conversation?.popMinimized) {
      this.isMinimized = true;
      this.pendingRead = true;
      this.conversation.popMinimized = false;
    }
    this.loadMessages();
    if (this.conversation?.conversationId) {
      this.messageService.joinConversation(this.conversation.conversationId);
    }

    // Slow fallback poll in case the socket drops; real-time path is below.
    this.refreshInterval = setInterval(() => {
      if (this.isOpen && !this.isMinimized && !this.messageService.getConnectionState()) {
        this.loadNewMessages();
      }
    }, 15000);

    // Shake + red glow when a new message arrives for this conversation
    this.subs.push(this.messageService.bubbleAttention$.subscribe((conversationId) => {
      if (conversationId === this.conversation?.conversationId) {
        this.triggerAttention();
      }
    }));

    // Live message stream
    this.subs.push(this.messageService.newMessage$.subscribe((m) => {
      if (m?.conversationId !== this.conversation?.conversationId) return;
      this.upsertMessage(m);
      if (m.senderId !== this.currentUserId) {
        if (!this.isMinimized && document.visibilityState === 'visible') {
          this.markRead();
        } else {
          this.pendingRead = true;
          if (this.conversation) this.conversation.unreadCount = (this.conversation.unreadCount || 0) + 1;
        }
      }
    }));
    // Blue ticks: another participant read our messages
    this.subs.push(this.messageService.messagesRead$.subscribe(({ conversationId, userId, messageIds, readAt }) => {
      if (conversationId !== this.conversation?.conversationId || userId === this.currentUserId) return;
      const ids = new Set(messageIds || []);
      for (const msg of this.messages) {
        if (ids.has(msg.messageId) && !msg.readReceipts?.some(r => r.userId === userId)) {
          msg.readReceipts = [...(msg.readReceipts || []), { userId, userName: '', readAt }];
        }
      }
    }));
    // If the tab regains focus while the window is open, mark as read then
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && !this.isMinimized && this.pendingRead) this.markRead();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.subs.push(this.messageService.messageUpdated$.subscribe((m) => {
      if (m?.conversationId === this.conversation?.conversationId) this.upsertMessage(m);
    }));
    this.subs.push(this.messageService.messageEdited$.subscribe(({ conversationId, messageId, content }) => {
      if (conversationId !== this.conversation?.conversationId) return;
      const msg = this.messages.find(x => x.messageId === messageId);
      if (msg) { msg.content = content; msg.isEdited = true; }
    }));
    this.subs.push(this.messageService.messageDeleted$.subscribe(({ conversationId, messageId }) => {
      if (conversationId !== this.conversation?.conversationId) return;
      const msg = this.messages.find(x => x.messageId === messageId);
      if (msg) { msg.isDeleted = true; msg.content = 'This message was deleted'; }
    }));
    this.subs.push(this.messageService.typing$.subscribe((t) => {
      if (t.conversationId !== this.conversation?.conversationId || t.userId === this.currentUserId) return;
      this.typingUser = t.isTyping ? t.userName : null;
      if (this.typingTimeout) clearTimeout(this.typingTimeout);
      if (t.isTyping) this.typingTimeout = setTimeout(() => (this.typingUser = null), 4000);
    }));
  }

  private upsertMessage(m: Message): void {
    const idx = this.messages.findIndex(x => x.messageId === m.messageId);
    if (idx >= 0) {
      this.messages[idx] = m;
    } else {
      this.messages.push(m);
      this.messages.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    }
    setTimeout(() => this.scrollToBottom(), 50);
  }

  private markRead(): void {
    if (!this.conversation?.conversationId) return;
    this.messageService.markAsRead(this.conversation.conversationId, this.currentUserId).subscribe({
      next: () => {
        if (this.conversation) this.conversation.unreadCount = 0;
        this.pendingRead = false;
        this.messageService.refreshUnreadCount(this.currentUserId);
      },
      error: () => {}
    });
  }

  triggerAttention(): void {
    // Shake + glow. If the user has it minimized we keep it as a round bubble (it will pulse until opened).
    this.attention = false;
    // Restart the animation on repeated messages
    setTimeout(() => { this.attention = true; }, 20);
    if (this.attentionTimeout) clearTimeout(this.attentionTimeout);
    this.attentionTimeout = setTimeout(() => { this.attention = false; }, 1600);
  }

  readStatus(message: Message): 'sent' | 'partial' | 'read' {
    return this.messageService.getReadStatus(message, this.currentUserId, this.conversation?.participants);
  }

  readTooltip(message: Message): string {
    return this.messageService.getReadTooltip(message, this.currentUserId, this.conversation?.participants);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    if (this.attentionTimeout) clearTimeout(this.attentionTimeout);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.subs.forEach(s => s.unsubscribe());
    if (this.conversation?.conversationId) {
      this.messageService.leaveConversation(this.conversation.conversationId);
    }
  }

  getOtherParticipant(): Participant | undefined {
    return this.conversation?.participants?.find(p => p.userId !== this.currentUserId);
  }

  getProfileImage(): string {
    const other = this.getOtherParticipant();
    if (other?.profilePictureUrl) {
      return other.profilePictureUrl;
    }
    return '';
  }

  getInitials(): string {
    const other = this.getOtherParticipant();
    if (other) {
      return `${other.name?.charAt(0) || ''}${other.surname?.charAt(0) || ''}`.toUpperCase();
    }
    return '?';
  }

  getChatTitle(): string {
    if (this.conversation?.isGroupChat) {
      return this.conversation.groupName || 'Group Chat';
    }
    const other = this.getOtherParticipant();
    return other ? `${other.name} ${other.surname}` : 'Chat';
  }

  getBubblePosition(): number {
    // Each bubble is 320px wide + 16px gap, plus offset from right for AI chatbot (80px)
    return 90 + (this.position * 340);
  }

  loadMessages(): void {
    if (!this.conversation?.conversationId) return;
    
    this.isLoading = true;
    this.messageService.getMessages(this.conversation.conversationId, this.currentUserId)
      .subscribe({
        next: (messages: Message[]) => {
          this.messages = messages;
          this.isLoading = false;
          setTimeout(() => this.scrollToBottom(), 100);
          if (!this.isMinimized) this.markRead();
        },
        error: (err: any) => {
          console.error('Error loading messages:', err);
          this.isLoading = false;
        }
      });
  }

  loadNewMessages(): void {
    if (!this.conversation?.conversationId) return;
    
    this.messageService.getMessages(this.conversation.conversationId, this.currentUserId)
      .subscribe({
        next: (messages: Message[]) => {
          if (messages.length !== this.messages.length) {
            this.messages = messages;
            setTimeout(() => this.scrollToBottom(), 100);
            if (!this.isMinimized) this.markRead();
          }
        }
      });
  }

  sendMessage(): void {
    if (!this.newMessage.trim() && !this.selectedFile) return;
    
    this.isSending = true;
    
    if (this.selectedFile) {
      // Upload file first, then send message with reference
      this.uploadAndSend();
    } else {
      this.messageService.sendMessage({
        conversationId: this.conversation.conversationId,
        content: this.newMessage.trim(),
        messageType: 'text'
      }, this.currentUserId).subscribe({
        next: (message: Message) => {
          this.upsertMessage(message);
          this.newMessage = '';
          this.isSending = false;
          this.sendTyping(false);
        },
        error: (err: any) => {
          console.error('Error sending message:', err);
          this.isSending = false;
        }
      });
    }
  }

  uploadAndSend(): void {
    if (!this.selectedFile) return;

    const file = this.selectedFile;
    this.uploadError = null;
    // Send the message first, then stream the file to it (disk-backed storage).
    this.messageService.sendMessage({
      conversationId: this.conversation.conversationId,
      content: this.newMessage.trim() || '',
      messageType: 'file'
    }, this.currentUserId).subscribe({
      next: (message: Message) => {
        this.messageService.uploadFileToMessage(message.messageId, file, this.currentUserId).subscribe({
          next: (attachment: MessageAttachment) => {
            message.attachments = [...(message.attachments || []), attachment];
            this.upsertMessage(message);
            this.newMessage = '';
            this.removeSelectedFile();
            this.isSending = false;
          },
          error: (err: any) => {
            console.error('Error uploading file:', err);
            this.uploadError = `Could not upload ${file.name}`;
            this.upsertMessage(message);
            this.isSending = false;
          }
        });
      },
      error: (err: any) => {
        console.error('Error sending file message:', err);
        this.uploadError = 'Could not send message';
        this.isSending = false;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const maxSize = 200 * 1024 * 1024;
      if (file.size > maxSize) {
        this.uploadError = `${file.name} is larger than 200 MB`;
        input.value = '';
        return;
      }
      this.uploadError = null;
      this.selectedFile = file;
    }
  }

  onPaste(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const named = new File([file], `pasted-image-${Date.now()}.${(item.type.split('/')[1] || 'png')}`, { type: item.type });
          this.selectedFile = named;
          event.preventDefault();
          return;
        }
      }
    }
  }

  removeSelectedFile(): void {
    this.selectedFile = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  toggleMinimize(): void {
    this.isMinimized = !this.isMinimized;
    if (!this.isMinimized) {
      setTimeout(() => this.scrollToBottom(), 100);
      this.markRead();
    }
  }

  closeChat(): void {
    this.close.emit(this.conversation.conversationId);
  }

  scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    }
  }

  isOwnMessage(message: Message): boolean {
    return message.senderId === this.currentUserId;
  }

  formatTime(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (d.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  onKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
      return;
    }
    this.sendTyping(true);
  }

  private sendTyping(isTyping: boolean): void {
    const now = Date.now();
    if (isTyping && now - this.typingSentAt < 2500) return; // throttle
    this.typingSentAt = isTyping ? now : 0;
    this.messageService.sendTypingIndicator(this.conversation.conversationId, isTyping);
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement?.click();
  }

  // Attachment helper methods
  isImageFile(mimeType: string): boolean {
    return mimeType?.startsWith('image/');
  }

  getAttachmentUrl(attachment: MessageAttachment): string {
    return this.messageService.getAttachmentUrl(attachment);
  }

  getFileIcon(mimeType: string): string {
    if (mimeType?.includes('pdf')) return 'picture_as_pdf';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return 'description';
    if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return 'table_chart';
    if (mimeType?.includes('powerpoint') || mimeType?.includes('presentation')) return 'slideshow';
    if (mimeType?.includes('zip') || mimeType?.includes('rar') || mimeType?.includes('archive')) return 'folder_zip';
    if (mimeType?.includes('text')) return 'article';
    return 'insert_drive_file';
  }

  downloadAttachment(attachment: MessageAttachment): void {
    this.messageService.downloadAttachment(attachment).catch(() => {
      this.uploadError = `Could not download ${attachment.fileName}`;
    });
  }

  previewAttachment(attachment: MessageAttachment): void {
    const previewable = this.isImageFile(attachment.mimeType) || attachment.mimeType === 'application/pdf';
    const action = previewable
      ? this.messageService.openAttachment(attachment)
      : this.messageService.downloadAttachment(attachment);
    action.catch(() => {
      this.uploadError = `Could not open ${attachment.fileName}`;
    });
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(event: any): void {
    if (event.emoji?.native) {
      this.newMessage += event.emoji.native;
    }
  }
}
