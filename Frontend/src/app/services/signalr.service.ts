import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection?: signalR.HubConnection;
  private apiUrl = 'http://localhost:5143';

  public cardMoved$ = new Subject<any>();
  public cardCreated$ = new Subject<any>();
  public cardUpdated$ = new Subject<any>();
  public cardDeleted$ = new Subject<number>();
  public commentAdded$ = new Subject<any>();

  constructor() {}

  startConnection(token: string): Promise<void> {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/hubs/board`, {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.registerHandlers();

    return this.hubConnection.start()
      .then(() => console.log('SignalR Connected'))
      .catch(err => console.error('Error connecting to SignalR:', err));
  }

  stopConnection(): void {
    if (this.hubConnection) {
      this.hubConnection.stop();
    }
  }

  joinBoard(boardId: string): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return this.hubConnection.invoke('JoinBoard', boardId);
    }
    console.warn('SignalR connection not ready. State:', this.hubConnection?.state);
    return Promise.reject('Hub connection not established');
  }

  leaveBoard(boardId: string): Promise<void> {
    if (this.hubConnection && this.hubConnection.state === signalR.HubConnectionState.Connected) {
      return this.hubConnection.invoke('LeaveBoard', boardId);
    }
    return Promise.reject('Hub connection not established');
  }

  private registerHandlers(): void {
    if (this.hubConnection) {
      this.hubConnection.on('CardMoved', (data) => {
        this.cardMoved$.next(data);
      });

      this.hubConnection.on('CardCreated', (data) => {
        this.cardCreated$.next(data);
      });

      this.hubConnection.on('CardUpdated', (data) => {
        this.cardUpdated$.next(data);
      });

      this.hubConnection.on('CardDeleted', (cardId) => {
        this.cardDeleted$.next(cardId);
      });

      this.hubConnection.on('CommentAdded', (data) => {
        this.commentAdded$.next(data);
      });
    }
  }
}
