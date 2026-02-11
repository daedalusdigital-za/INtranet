import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService, Conversation, Message, Participant, MessageAttachment } from '../../services/message.service';
import { PickerComponent } from '@ctrl/ngx-emoji-mart';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chat-bubble',
  standalone: true,
  imports: [CommonModule, FormsModule, PickerComponent],
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
  
  private refreshInterval: any;

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {
    this.loadMessages();
    // Refresh messages every 5 seconds
    this.refreshInterval = setInterval(() => {
      if (this.isOpen && !this.isMinimized) {
        this.loadNewMessages();
      }
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
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
          // Mark as read
          this.messageService.markAsRead(this.conversation.conversationId, this.currentUserId).subscribe();
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
          if (messages.length > this.messages.length) {
            this.messages = messages;
            setTimeout(() => this.scrollToBottom(), 100);
            this.messageService.markAsRead(this.conversation.conversationId, this.currentUserId).subscribe();
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
          this.messages.push(message);
          this.newMessage = '';
          this.isSending = false;
          setTimeout(() => this.scrollToBottom(), 100);
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
    
    // Upload the file first
    this.messageService.uploadAttachment(
      this.conversation.conversationId,
      this.selectedFile,
      this.currentUserId
    ).subscribe({
      next: (attachment: MessageAttachment) => {
        // Send a message with the attachment reference
        this.messageService.sendMessage({
          conversationId: this.conversation.conversationId,
          content: this.newMessage.trim() || '',
          messageType: 'file',
          attachmentIds: [attachment.attachmentId]
        }, this.currentUserId).subscribe({
          next: (message: Message) => {
            this.messages.push(message);
            this.newMessage = '';
            this.selectedFile = null;
            this.isSending = false;
            setTimeout(() => this.scrollToBottom(), 100);
          },
          error: (err: any) => {
            console.error('Error sending file message:', err);
            this.isSending = false;
          }
        });
      },
      error: (err: any) => {
        console.error('Error uploading file:', err);
        this.isSending = false;
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
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
    }
  }

  triggerFileInput(): void {
    this.fileInput?.nativeElement?.click();
  }

  // Attachment helper methods
  isImageFile(mimeType: string): boolean {
    return mimeType?.startsWith('image/');
  }

  getAttachmentUrl(attachment: MessageAttachment): string {
    if (attachment.fileUrl?.startsWith('http')) {
      return attachment.fileUrl;
    }
    return `${environment.apiUrl}${attachment.fileUrl}`;
  }

  getFileIcon(mimeType: string): string {
    if (mimeType?.includes('pdf')) return 'bi-file-earmark-pdf';
    if (mimeType?.includes('word') || mimeType?.includes('document')) return 'bi-file-earmark-word';
    if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return 'bi-file-earmark-excel';
    if (mimeType?.includes('powerpoint') || mimeType?.includes('presentation')) return 'bi-file-earmark-ppt';
    if (mimeType?.includes('zip') || mimeType?.includes('rar') || mimeType?.includes('archive')) return 'bi-file-earmark-zip';
    if (mimeType?.includes('text')) return 'bi-file-earmark-text';
    return 'bi-file-earmark';
  }

  downloadAttachment(attachment: MessageAttachment): void {
    const url = this.getAttachmentUrl(attachment);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  previewAttachment(attachment: MessageAttachment): void {
    const url = this.getAttachmentUrl(attachment);
    window.open(url, '_blank');
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
