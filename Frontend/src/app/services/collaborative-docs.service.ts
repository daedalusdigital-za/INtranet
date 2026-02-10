import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import {
  CollaborativeDocument,
  DocumentDetail,
  DocumentSnapshot,
  CreateDocumentDto,
  UpdateDocumentDto,
  SaveSnapshotDto,
  AddCollaboratorDto,
  UserPresence,
  DocumentUser
} from '../models/collaborative-doc.model';

@Injectable({
  providedIn: 'root'
})
export class CollaborativeDocsService {
  private apiUrl = `${environment.apiUrl}/collaborativedocs`;
  private hubConnection: signalR.HubConnection | null = null;
  private hubUrl = `${environment.apiUrl.replace('/api', '')}/hubs/collaborative-docs`;

  // SignalR event subjects
  private documentUpdateSubject = new Subject<string>();
  private userJoinedSubject = new Subject<{ connectionId: string; presence: UserPresence }>();
  private userLeftSubject = new Subject<string>();
  private presenceSyncSubject = new Subject<UserPresence[]>();
  private cursorUpdateSubject = new Subject<{ connectionId: string; presence: UserPresence }>();
  private syncRequestedSubject = new Subject<string>();
  private syncDataSubject = new Subject<string>();
  private awarenessUpdateSubject = new Subject<{ connectionId: string; state: string }>();
  private connectionStateSubject = new BehaviorSubject<string>('Disconnected');

  // Public observables
  documentUpdate$ = this.documentUpdateSubject.asObservable();
  userJoined$ = this.userJoinedSubject.asObservable();
  userLeft$ = this.userLeftSubject.asObservable();
  presenceSync$ = this.presenceSyncSubject.asObservable();
  cursorUpdate$ = this.cursorUpdateSubject.asObservable();
  syncRequested$ = this.syncRequestedSubject.asObservable();
  syncData$ = this.syncDataSubject.asObservable();
  awarenessUpdate$ = this.awarenessUpdateSubject.asObservable();
  connectionState$ = this.connectionStateSubject.asObservable();

  constructor(private http: HttpClient) {}

  // REST API Methods
  getDocuments(): Observable<CollaborativeDocument[]> {
    return this.http.get<CollaborativeDocument[]>(this.apiUrl);
  }

  getDocument(id: number): Observable<DocumentDetail> {
    return this.http.get<DocumentDetail>(`${this.apiUrl}/${id}`);
  }

  createDocument(dto: CreateDocumentDto): Observable<DocumentDetail> {
    return this.http.post<DocumentDetail>(this.apiUrl, dto);
  }

  updateDocument(id: number, dto: UpdateDocumentDto): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, dto);
  }

  deleteDocument(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  saveSnapshot(id: number, dto: SaveSnapshotDto): Observable<DocumentSnapshot> {
    return this.http.post<DocumentSnapshot>(`${this.apiUrl}/${id}/snapshot`, dto);
  }

  getLatestSnapshot(id: number): Observable<DocumentSnapshot> {
    return this.http.get<DocumentSnapshot>(`${this.apiUrl}/${id}/snapshot`);
  }

  addCollaborator(docId: number, dto: AddCollaboratorDto): Observable<any> {
    return this.http.post(`${this.apiUrl}/${docId}/collaborators`, dto);
  }

  removeCollaborator(docId: number, collaboratorId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${docId}/collaborators/${collaboratorId}`);
  }

  searchUsers(search?: string): Observable<DocumentUser[]> {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.http.get<DocumentUser[]>(`${this.apiUrl}/users${params}`);
  }

  // SignalR Methods
  async startConnection(token: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      return;
    }

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(this.hubUrl, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.setupHubEventHandlers();

    try {
      await this.hubConnection.start();
      this.connectionStateSubject.next('Connected');
      console.log('CollaborativeDocs SignalR Connected');
    } catch (error) {
      console.error('CollaborativeDocs SignalR Connection Error:', error);
      this.connectionStateSubject.next('Disconnected');
      // Don't throw - allow the editor to work offline
    }
  }

  private setupHubEventHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting(() => {
      this.connectionStateSubject.next('Reconnecting');
      console.log('CollaborativeDocs SignalR Reconnecting...');
    });

    this.hubConnection.onreconnected(() => {
      this.connectionStateSubject.next('Connected');
      console.log('CollaborativeDocs SignalR Reconnected');
    });

    this.hubConnection.onclose(() => {
      this.connectionStateSubject.next('Disconnected');
      console.log('CollaborativeDocs SignalR Disconnected');
    });

    // Document updates
    this.hubConnection.on('DocumentUpdate', (update: string) => {
      this.documentUpdateSubject.next(update);
    });

    // Presence events
    this.hubConnection.on('UserJoined', (connectionId: string, presence: UserPresence) => {
      this.userJoinedSubject.next({ connectionId, presence });
    });

    this.hubConnection.on('UserLeft', (connectionId: string) => {
      this.userLeftSubject.next(connectionId);
    });

    this.hubConnection.on('PresenceSync', (presence: UserPresence[]) => {
      this.presenceSyncSubject.next(presence);
    });

    this.hubConnection.on('CursorUpdate', (connectionId: string, presence: UserPresence) => {
      this.cursorUpdateSubject.next({ connectionId, presence });
    });

    // Sync events
    this.hubConnection.on('SyncRequested', (connectionId: string) => {
      this.syncRequestedSubject.next(connectionId);
    });

    this.hubConnection.on('SyncData', (yjsState: string) => {
      this.syncDataSubject.next(yjsState);
    });

    this.hubConnection.on('AwarenessUpdate', (connectionId: string, state: string) => {
      this.awarenessUpdateSubject.next({ connectionId, state });
    });

    this.hubConnection.on('Error', (message: string) => {
      console.error('CollaborativeDocs Hub Error:', message);
    });
  }

  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.connectionStateSubject.next('Disconnected');
    }
  }

  async joinDocument(documentId: number): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('JoinDocument', documentId);
    }
  }

  async leaveDocument(documentId: number): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('LeaveDocument', documentId);
    }
  }

  async broadcastUpdate(documentId: number, update: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('BroadcastUpdate', documentId, update);
    }
  }

  async updateCursor(documentId: number, from: number, to: number): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('UpdateCursor', documentId, from, to);
    }
  }

  async requestSync(documentId: number): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('RequestSync', documentId);
    }
  }

  async sendSyncData(targetConnectionId: string, yjsState: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('SendSyncData', targetConnectionId, yjsState);
    }
  }

  async updateAwareness(documentId: number, awarenessState: string): Promise<void> {
    if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
      await this.hubConnection.invoke('UpdateAwareness', documentId, awarenessState);
    }
  }

  isConnected(): boolean {
    return this.hubConnection?.state === signalR.HubConnectionState.Connected;
  }
}
