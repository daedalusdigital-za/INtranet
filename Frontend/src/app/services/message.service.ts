import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { NotificationService } from './notification.service';

export interface User {
  userId: number;
  name: string;
  surname: string;
  email: string;
  profilePictureUrl?: string;
  profilePictureData?: string;
  profilePictureMimeType?: string;
  title?: string;
  position?: string; // alias for title
  department?: string;
  departmentId?: number;
  isOnline?: boolean;
}

export interface Conversation {
  conversationId: number;
  subject?: string;
  isGroupChat: boolean;
  groupName?: string;
  createdAt: Date;
  lastMessageAt?: Date;
  participants: Participant[];
  lastMessage?: Message;
  unreadCount: number;
}

export interface Participant {
  userId: number;
  name: string;
  surname: string;
  fullName: string;
  profilePictureUrl?: string;
  isAdmin: boolean;
  isOnline: boolean;
  lastReadAt?: Date;
}

export interface Message {
  messageId: number;
  conversationId: number;
  senderId: number;
  senderName: string;
  senderFullName: string;
  senderProfilePicture?: string;
  content: string;
  messageType: string;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  replyToMessageId?: number;
  replyToMessage?: Message;
  sentAt: Date;
  attachments: MessageAttachment[];
  readReceipts: ReadReceipt[];
  isRead: boolean;
}

export interface MessageAttachment {
  attachmentId: number;
  fileName: string;
  mimeType: string;  // Match backend API field name
  fileType?: string; // Alias for backwards compatibility
  fileSize: number;
  fileUrl: string;
  thumbnailUrl?: string;
  uploadedAt?: Date;
}

export interface ReadReceipt {
  userId: number;
  userName: string;
  readAt: Date;
}

export interface CreateConversationRequest {
  participantUserIds: number[];
  isGroupChat: boolean;
  groupName?: string;
  subject?: string;
  initialMessage?: string;
}

export interface SendMessageRequest {
  conversationId: number;
  content: string;
  messageType?: string;
  replyToMessageId?: number;
  attachmentIds?: number[];
}

export interface SendDirectMessageRequest {
  recipientUserId: number;
  content: string;
  subject?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private apiUrl = `${environment.apiUrl}/messages`;
  private usersApiUrl = `${environment.apiUrl}/profile`;
  
  // SignalR Hub Connection
  private hubConnection: signalR.HubConnection | null = null;
  private isConnected = false;
  private currentUserId: number | null = null;
  
  // Active chat bubbles
  private activeChatBubblesSubject = new BehaviorSubject<Conversation[]>([]);
  public activeChats$ = this.activeChatBubblesSubject.asObservable();
  
  // Real-time message updates
  private newMessageSubject = new Subject<Message>();
  public newMessage$ = this.newMessageSubject.asObservable();
  
  private messageEditedSubject = new Subject<{ conversationId: number; messageId: number; content: string }>();
  public messageEdited$ = this.messageEditedSubject.asObservable();
  
  private messageDeletedSubject = new Subject<{ conversationId: number; messageId: number }>();
  public messageDeleted$ = this.messageDeletedSubject.asObservable();

  // Full message replaced (e.g. attachment finished uploading)
  private messageUpdatedSubject = new Subject<Message>();
  public messageUpdated$ = this.messageUpdatedSubject.asObservable();

  // Another participant read messages
  private messagesReadSubject = new Subject<{ conversationId: number; userId: number; messageIds: number[]; readAt: Date }>();
  public messagesRead$ = this.messagesReadSubject.asObservable();

  // Typing indicator
  private typingSubject = new Subject<{ conversationId: number; userId: number; userName: string; isTyping: boolean }>();
  public typing$ = this.typingSubject.asObservable();

  // Connection state
  private connectionStateSubject = new BehaviorSubject<boolean>(false);
  public connectionState$ = this.connectionStateSubject.asObservable();
  private connectPromise: Promise<void> | null = null;
  
  private conversationUpdatedSubject = new Subject<Conversation>();
  public conversationUpdated$ = this.conversationUpdatedSubject.asObservable();
  
  private userOnlineSubject = new Subject<{ userId: number; isOnline: boolean }>();
  public userOnline$ = this.userOnlineSubject.asObservable();

  // Attention pulse: emits the conversationId of a bubble that should shake/glow
  private bubbleAttentionSubject = new Subject<number>();
  public bubbleAttention$ = this.bubbleAttentionSubject.asObservable();

  constructor(
    private http: HttpClient,
    private notificationService: NotificationService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    });
  }

  // Get all conversations for a user
  getConversations(userId: number): Observable<Conversation[]> {
    return this.http.get<Conversation[]>(`${this.apiUrl}/conversations?userId=${userId}`, 
      { headers: this.getHeaders() });
  }

  // Get a specific conversation
  getConversation(conversationId: number, userId: number): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.apiUrl}/conversations/${conversationId}?userId=${userId}`,
      { headers: this.getHeaders() });
  }

  // Get messages for a conversation
  getMessages(conversationId: number, userId: number, page: number = 1, pageSize: number = 50): Observable<Message[]> {
    return this.http.get<Message[]>(
      `${this.apiUrl}/conversations/${conversationId}/messages?userId=${userId}&page=${page}&pageSize=${pageSize}`,
      { headers: this.getHeaders() }
    );
  }

  // Create a new conversation
  createConversation(request: CreateConversationRequest, userId: number): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.apiUrl}/conversations?userId=${userId}`, request,
      { headers: this.getHeaders() });
  }

  // Send a message
  sendMessage(request: SendMessageRequest, userId: number): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/send?userId=${userId}`, request,
      { headers: this.getHeaders() });
  }

  // Send a direct message (creates conversation if needed)
  sendDirectMessage(request: SendDirectMessageRequest, userId: number): Observable<Message> {
    return this.http.post<Message>(`${this.apiUrl}/send-direct?userId=${userId}`, request,
      { headers: this.getHeaders() });
  }

  // Delete a message
  deleteMessage(messageId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${messageId}?userId=${userId}`,
      { headers: this.getHeaders() });
  }

  // Delete an entire conversation
  deleteConversation(conversationId: number, userId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/conversations/${conversationId}?userId=${userId}`,
      { headers: this.getHeaders() });
  }

  // Get unread message count
  getUnreadCount(userId: number): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/unread-count?userId=${userId}`,
      { headers: this.getHeaders() });
  }

  // Mark messages as read
  markAsRead(conversationId: number, userId: number): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/mark-read?userId=${userId}`, 
      { conversationId },
      { headers: this.getHeaders() });
  }

  // Search users
  searchUsers(query: string, excludeUserId?: number): Observable<User[]> {
    const excludeParam = excludeUserId ? `&excludeUserId=${excludeUserId}` : '';
    return this.http.get<User[]>(`${this.apiUrl}/users/search?query=${encodeURIComponent(query)}${excludeParam}`,
      { headers: this.getHeaders() }).pipe(
        map((users: User[]) => users.map((u: User) => ({
          ...u,
          position: u.title // Map title to position for consistency
        })))
      );
  }

  // Get all users (for user picker)
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users/search`,
      { headers: this.getHeaders() }).pipe(
        map((users: User[]) => users.map((u: User) => ({
          ...u,
          position: u.title
        })))
      );
  }

  // Upload attachment
  uploadAttachment(conversationId: number, file: File, userId: number): Observable<MessageAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    
    return this.http.post<MessageAttachment>(
      `${this.apiUrl}/conversations/${conversationId}/attachments?userId=${userId}`,
      formData,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }) }
    );
  }

  // Add attachment to an existing message (streamed multipart -> disk storage)
  uploadFileToMessage(messageId: number, file: File, userId: number): Observable<MessageAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MessageAttachment>(
      `${this.apiUrl}/${messageId}/attachments/upload?userId=${userId}`,
      formData,
      { headers: new HttpHeaders({ 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }) }
    );
  }

  // Add attachment to an existing message
  addAttachmentToMessage(messageId: number, attachment: { fileName: string; mimeType: string; base64Data: string }, userId: number): Observable<MessageAttachment> {
    return this.http.post<MessageAttachment>(
      `${this.apiUrl}/${messageId}/attachments?userId=${userId}`,
      attachment,
      { headers: this.getHeaders() }
    );
  }

  /** Absolute URL for an attachment (requires Authorization header to fetch). */
  getAttachmentUrl(attachment: MessageAttachment, download = false): string {
    let url: string;
    if (attachment.fileUrl) {
      url = attachment.fileUrl.startsWith('/api')
        ? environment.apiUrl.replace(/\/api$/, '') + attachment.fileUrl
        : attachment.fileUrl;
    } else {
      url = `${this.apiUrl}/attachments/${attachment.attachmentId}`;
    }
    return download ? `${url}${url.includes('?') ? '&' : '?'}download=true` : url;
  }

  /** Fetch an attachment with auth and return a blob. */
  fetchAttachmentBlob(attachment: MessageAttachment, download = false): Observable<Blob> {
    const token = localStorage.getItem('token') || '';
    return this.http.get(this.getAttachmentUrl(attachment, download), {
      headers: new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {}),
      responseType: 'blob'
    });
  }

  /** Download an attachment to disk using the browser's save dialog. */
  downloadAttachment(attachment: MessageAttachment): Promise<void> {
    return new Promise((resolve, reject) => {
      this.fetchAttachmentBlob(attachment, true).subscribe({
        next: blob => {
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = attachment.fileName || 'attachment';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
          resolve();
        },
        error: err => reject(err)
      });
    });
  }

  /** Open an attachment in a new tab (image / PDF preview). */
  openAttachment(attachment: MessageAttachment): Promise<void> {
    return new Promise((resolve, reject) => {
      this.fetchAttachmentBlob(attachment).subscribe({
        next: blob => {
          const typed = blob.type ? blob : new Blob([blob], { type: attachment.mimeType });
          const blobUrl = URL.createObjectURL(typed);
          window.open(blobUrl, '_blank');
          resolve();
        },
        error: err => reject(err)
      });
    });
  }

  // Chat bubble management
  openChatBubble(conversation: Conversation): void {
    const currentChats = this.activeChatBubblesSubject.value;
    // If this chat is already open, keep only it (bring to front / avoid duplicates)
    if (currentChats.find((c: Conversation) => c.conversationId === conversation.conversationId)) {
      this.activeChatBubblesSubject.next([conversation]);
      return;
    }
    // Single-bubble mode: opening a chat closes any other open bubbles to avoid conflicts
    this.activeChatBubblesSubject.next([conversation]);
  }

  closeChatBubble(conversationId: number): void {
    const currentChats = this.activeChatBubblesSubject.value;
    this.activeChatBubblesSubject.next(currentChats.filter((c: Conversation) => c.conversationId !== conversationId));
  }

  getActiveChatBubbles(): Conversation[] {
    return this.activeChatBubblesSubject.value;
  }

  // Start a new chat with a user
  startChatWithUser(targetUser: User, currentUserId: number): Observable<Conversation> {
    const request: CreateConversationRequest = {
      participantUserIds: [targetUser.userId],
      isGroupChat: false,
      subject: `Chat with ${targetUser.name} ${targetUser.surname}`
    };
    return this.createConversation(request, currentUserId);
  }

  // SignalR Connection Management
  // Safe to call from many components: it is idempotent per user and an
  // in-flight connect is shared rather than duplicated.
  async startConnection(userId: number): Promise<void> {
    if (!userId) return;
    if (this.isConnected && this.currentUserId === userId) {
      return;
    }
    if (this.connectPromise && this.currentUserId === userId) {
      return this.connectPromise;
    }
    // Switching user: tear down the old connection first.
    if (this.hubConnection && this.currentUserId !== userId) {
      try { await this.hubConnection.stop(); } catch { /* ignore */ }
      this.hubConnection = null;
      this.isConnected = false;
    }

    this.connectPromise = this.connectInternal(userId).finally(() => { this.connectPromise = null; });
    return this.connectPromise;
  }

  private async connectInternal(userId: number): Promise<void> {
    this.currentUserId = userId;
    
    // Use signalRUrl if available, otherwise derive from apiUrl
    const hubUrl = environment.signalRUrl || environment.apiUrl.replace('/api', '');
    
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubUrl}/hubs/chat`, {
        // Read the token lazily so a refreshed token is used on reconnect.
        accessTokenFactory: () => localStorage.getItem('token') || '',
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    // Set up event handlers
    this.setupSignalRHandlers();

    // Handle reconnection (register before start so no event is missed)
    this.hubConnection.onreconnected(() => {
      this.isConnected = true;
      this.connectionStateSubject.next(true);
      if (this.currentUserId) {
        this.hubConnection?.invoke('RegisterUser', this.currentUserId).catch(() => {});
        this.updateUnreadCount(this.currentUserId);
      }
    });

    this.hubConnection.onreconnecting(() => {
      this.isConnected = false;
      this.connectionStateSubject.next(false);
    });

    this.hubConnection.onclose(() => {
      this.isConnected = false;
      this.connectionStateSubject.next(false);
      // Attempt to reconnect unless we were stopped on purpose
      setTimeout(() => {
        if (this.currentUserId && localStorage.getItem('token')) {
          this.startConnection(this.currentUserId);
        }
      }, 5000);
    });

    try {
      await this.hubConnection.start();
      this.isConnected = true;
      this.connectionStateSubject.next(true);
      
      // Register user
      await this.hubConnection.invoke('RegisterUser', userId);
      
      // Load initial unread count
      this.updateUnreadCount(userId);
    } catch (err) {
      console.error('Error connecting to SignalR:', err);
      this.isConnected = false;
      this.connectionStateSubject.next(false);
      // Retry connection after delay
      setTimeout(() => {
        if (this.currentUserId === userId && localStorage.getItem('token')) {
          this.startConnection(userId);
        }
      }, 5000);
    }
  }

  private lastSeenMessageIds = new Set<number>();

  private setupSignalRHandlers(): void {
    if (!this.hubConnection) return;

    // Receive new message
    this.hubConnection.on('ReceiveMessage', (message: Message) => {
      // Dedupe: the server can deliver once per group membership.
      if (message?.messageId && this.lastSeenMessageIds.has(message.messageId)) return;
      if (message?.messageId) {
        this.lastSeenMessageIds.add(message.messageId);
        if (this.lastSeenMessageIds.size > 500) {
          const first = this.lastSeenMessageIds.values().next().value;
          if (first !== undefined) this.lastSeenMessageIds.delete(first);
        }
      }

      this.newMessageSubject.next(message);
      
      // Show notification if message is from someone else
      if (message.senderId !== this.currentUserId) {
        const preview = message.content?.trim()
          || (message.attachments?.length ? `📎 ${message.attachments[0].fileName}` : 'Sent an attachment');
        this.notificationService.showMessageNotification(
          message.senderFullName || message.senderName,
          preview
        );
        this.notificationService.incrementUnreadCount();
        // Trigger the mini chat-bubble attention pulse (shake + red glow)
        this.bubbleAttentionSubject.next(message.conversationId);
      }
    });

    // Message replaced (attachment finished uploading, etc.)
    this.hubConnection.on('MessageUpdated', (message: Message) => {
      this.messageUpdatedSubject.next(message);
    });

    // Read receipts from other participants
    this.hubConnection.on('MessagesRead', (data: { conversationId: number; userId: number; messageIds: number[]; readAt: Date }) => {
      this.messagesReadSubject.next(data);
    });

    // ToDo notification
    this.hubConnection.on('TodoNotification', (notification: any) => {
      this.notificationService.showTodoNotification(notification);
    });

    // Message edited
    this.hubConnection.on('MessageEdited', (conversationId: number, messageId: number, newContent: string) => {
      this.messageEditedSubject.next({ conversationId, messageId, content: newContent });
    });

    // Message deleted
    this.hubConnection.on('MessageDeleted', (conversationId: number, messageId: number) => {
      this.messageDeletedSubject.next({ conversationId, messageId });
    });

    // Conversation updated
    this.hubConnection.on('ConversationUpdated', (conversation: Conversation) => {
      this.conversationUpdatedSubject.next(conversation);
    });

    // User online status
    this.hubConnection.on('UserOnline', (status: { userId: number; isOnline: boolean }) => {
      this.userOnlineSubject.next(status);
    });

    // Typing indicator
    this.hubConnection.on('UserTyping', (data: { conversationId: number; userId: number; userName: string; isTyping: boolean }) => {
      this.typingSubject.next(data);
    });
  }

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      try {
        this.currentUserId = null; // prevents the onclose auto-reconnect
        await this.hubConnection.stop();
        this.isConnected = false;
        this.connectionStateSubject.next(false);
        this.hubConnection = null;
      } catch (err) {
        console.error('Error stopping SignalR connection:', err);
      }
    }
  }

  async joinConversation(conversationId: number): Promise<void> {
    if (this.hubConnection && this.isConnected) {
      try {
        await this.hubConnection.invoke('JoinConversation', conversationId);
      } catch (err) {
        console.error('Error joining conversation:', err);
      }
    }
  }

  async leaveConversation(conversationId: number): Promise<void> {
    if (this.hubConnection && this.isConnected) {
      try {
        await this.hubConnection.invoke('LeaveConversation', conversationId);
      } catch (err) {
        console.error('Error leaving conversation:', err);
      }
    }
  }

  async sendTypingIndicator(conversationId: number, isTyping: boolean): Promise<void> {
    if (this.hubConnection && this.isConnected) {
      try {
        await this.hubConnection.invoke('SendTypingIndicator', conversationId, isTyping);
      } catch (err) {
        console.error('Error sending typing indicator:', err);
      }
    }
  }

  /** Re-sync the unread badge with the server. */
  refreshUnreadCount(userId?: number): void {
    const id = userId || this.currentUserId;
    if (id) this.updateUnreadCount(id);
  }

  private updateUnreadCount(userId: number): void {
    this.getUnreadCount(userId).subscribe({
      next: (count) => {
        this.notificationService.updateUnreadCount(count);
      },
      error: (err) => {
        console.error('Error getting unread count:', err);
      }
    });
  }

  getConnectionState(): boolean {
    return this.isConnected;
  }
}
