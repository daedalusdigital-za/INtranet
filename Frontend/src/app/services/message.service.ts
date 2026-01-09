import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

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
  private apiUrl = '/api/messages';
  private usersApiUrl = '/api/profile';
  
  // Active chat bubbles
  private activeChatBubblesSubject = new BehaviorSubject<Conversation[]>([]);
  public activeChats$ = this.activeChatBubblesSubject.asObservable();

  constructor(private http: HttpClient) {}

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
    return this.http.get<User[]>(`${this.usersApiUrl}/users`,
      { headers: this.getHeaders() });
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
}
