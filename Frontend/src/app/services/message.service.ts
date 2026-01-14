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
  fileType: string;
  fileSize: number;
  fileUrl: string;
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
  
  private conversationUpdatedSubject = new Subject<Conversation>();
  public conversationUpdated$ = this.conversationUpdatedSubject.asObservable();
  
  private userOnlineSubject = new Subject<{ userId: number; isOnline: boolean }>();
  public userOnline$ = this.userOnlineSubject.asObservable();

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

  // Chat bubble management
  openChatBubble(conversation: Conversation): void {
    const currentChats = this.activeChatBubblesSubject.value;
    if (!currentChats.find((c: Conversation) => c.conversationId === conversation.conversationId)) {
      // Keep max 3 chat bubbles open
      const updatedChats = [...currentChats, conversation].slice(-3);
      this.activeChatBubblesSubject.next(updatedChats);
    }
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
  async startConnection(userId: number): Promise<void> {
    if (this.isConnected && this.currentUserId === userId) {
      return;
    }

    this.currentUserId = userId;
    const token = localStorage.getItem('token');
    
    // Use signalRUrl if available, otherwise derive from apiUrl
    const hubUrl = environment.signalRUrl || environment.apiUrl.replace('/api', '');
    
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubUrl}/hubs/chat`, {
        accessTokenFactory: () => token || '',
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.ServerSentEvents | signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Set up event handlers
    this.setupSignalRHandlers();

    try {
      await this.hubConnection.start();
      console.log('SignalR Connected');
      this.isConnected = true;
      
      // Register user
      await this.hubConnection.invoke('RegisterUser', userId);
      
      // Load initial unread count
      this.updateUnreadCount(userId);
    } catch (err) {
      console.error('Error connecting to SignalR:', err);
      this.isConnected = false;
      // Retry connection after delay
      setTimeout(() => this.startConnection(userId), 5000);
    }

    // Handle reconnection
    this.hubConnection.onreconnected(() => {
      console.log('SignalR Reconnected');
      this.isConnected = true;
      if (this.currentUserId) {
        this.hubConnection?.invoke('RegisterUser', this.currentUserId);
      }
    });

    this.hubConnection.onreconnecting(() => {
      console.log('SignalR Reconnecting...');
      this.isConnected = false;
    });

    this.hubConnection.onclose(() => {
      console.log('SignalR Disconnected');
      this.isConnected = false;
      // Attempt to reconnect
      setTimeout(() => {
        if (this.currentUserId) {
          this.startConnection(this.currentUserId);
        }
      }, 5000);
    });
  }

  private setupSignalRHandlers(): void {
    if (!this.hubConnection) return;

    // Receive new message
    this.hubConnection.on('ReceiveMessage', (message: Message) => {
      console.log('Received message via SignalR:', message);
      this.newMessageSubject.next(message);
      
      // Show notification if message is from someone else
      if (message.senderId !== this.currentUserId) {
        this.notificationService.showMessageNotification(
          message.senderFullName || message.senderName,
          message.content
        );
        this.notificationService.incrementUnreadCount();
      }
    });

    // ToDo notification
    this.hubConnection.on('TodoNotification', (notification: any) => {
      console.log('Received ToDo notification via SignalR:', notification);
      this.notificationService.showTodoNotification(notification);
    });

    // Message edited
    this.hubConnection.on('MessageEdited', (conversationId: number, messageId: number, newContent: string) => {
      console.log('Message edited:', conversationId, messageId);
      this.messageEditedSubject.next({ conversationId, messageId, content: newContent });
    });

    // Message deleted
    this.hubConnection.on('MessageDeleted', (conversationId: number, messageId: number) => {
      console.log('Message deleted:', conversationId, messageId);
      this.messageDeletedSubject.next({ conversationId, messageId });
    });

    // Conversation updated
    this.hubConnection.on('ConversationUpdated', (conversation: Conversation) => {
      console.log('Conversation updated:', conversation);
      this.conversationUpdatedSubject.next(conversation);
    });

    // User online status
    this.hubConnection.on('UserOnline', (status: { userId: number; isOnline: boolean }) => {
      console.log('User online status:', status);
      this.userOnlineSubject.next(status);
    });

    // Typing indicator
    this.hubConnection.on('UserTyping', (data: { conversationId: number; userId: number; userName: string; isTyping: boolean }) => {
      console.log('User typing:', data);
      // Can be used to show "User is typing..." indicator
    });
  }

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      try {
        await this.hubConnection.stop();
        this.isConnected = false;
        this.currentUserId = null;
        console.log('SignalR connection stopped');
      } catch (err) {
        console.error('Error stopping SignalR connection:', err);
      }
    }
  }

  async joinConversation(conversationId: number): Promise<void> {
    if (this.hubConnection && this.isConnected) {
      try {
        await this.hubConnection.invoke('JoinConversation', conversationId);
        console.log(`Joined conversation ${conversationId}`);
      } catch (err) {
        console.error('Error joining conversation:', err);
      }
    }
  }

  async leaveConversation(conversationId: number): Promise<void> {
    if (this.hubConnection && this.isConnected) {
      try {
        await this.hubConnection.invoke('LeaveConversation', conversationId);
        console.log(`Left conversation ${conversationId}`);
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
