import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { ApiService } from '../../services/api.service';
import { SignalRService } from '../../services/signalr.service';
import { AuthService } from '../../services/auth.service';
import { Board, List, Card } from '../../models/models';
import { Subscription } from 'rxjs';
import { NavbarComponent } from '../shared/navbar/navbar.component';

@Component({
  selector: 'app-board',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    DragDropModule,
    NavbarComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="board-container">
      @if (board) {
        <div class="board-header">
          <h2>{{ board.departmentName }}</h2>
          <p>{{ board.description }}</p>
        </div>

        <div class="lists-container" cdkDropListGroup>
          @for (list of board.lists; track list.listId) {
            <div class="list-column">
              <div class="list-header">
                <h3>{{ list.title }}</h3>
                <span class="card-count">{{ list.cards.length }}</span>
              </div>

              <div
                class="cards-container"
                cdkDropList
                [cdkDropListData]="list.cards"
                [id]="'list-' + list.listId"
                (cdkDropListDropped)="onCardDrop($event)">

                @for (card of list.cards; track card.cardId) {
                  <mat-card class="card" cdkDrag>
                    <mat-card-header>
                      <mat-card-title>{{ card.title }}</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                      @if (card.description) {
                        <p class="card-description">{{ card.description }}</p>
                      }
                      @if (card.assignedToName) {
                        <div class="card-meta">
                          <mat-icon>person</mat-icon>
                          <span>{{ card.assignedToName }}</span>
                        </div>
                      }
                      @if (card.dueDate) {
                        <div class="card-meta">
                          <mat-icon>event</mat-icon>
                          <span>{{ card.dueDate | date }}</span>
                        </div>
                      }
                      <div class="card-footer">
                        @if (card.commentCount > 0) {
                          <div class="card-badge">
                            <mat-icon>comment</mat-icon>
                            <span>{{ card.commentCount }}</span>
                          </div>
                        }
                        @if (card.attachmentCount > 0) {
                          <div class="card-badge">
                            <mat-icon>attach_file</mat-icon>
                            <span>{{ card.attachmentCount }}</span>
                          </div>
                        }
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
              </div>

              <button mat-stroked-button class="add-card-btn" (click)="addCard(list.listId)">
                <mat-icon>add</mat-icon> Add Card
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .spacer {
      flex: 1 1 auto;
    }

    .board-container {
      padding: 80px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

    .board-header {
      margin-bottom: 24px;
      background: rgba(255, 255, 255, 0.95);
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .board-header h2 {
      margin: 0 0 8px 0;
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 600;
    }

    .board-header p {
      margin: 0;
      color: #666;
    }

    .lists-container {
      display: flex;
      gap: 20px;
      overflow-x: auto;
      padding-bottom: 16px;
    }

    .list-column {
      flex: 0 0 320px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 16px;
      max-height: calc(100vh - 200px);
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s;
    }

    .list-column:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }

    .list-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid transparent;
      border-image: linear-gradient(90deg, #00008B 0%, #4169e1 100%) 1;
    }

    .list-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .card-count {
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .cards-container {
      flex: 1;
      overflow-y: auto;
      min-height: 100px;
      padding: 4px;
    }

    .card {
      margin-bottom: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      border-left: 4px solid;
      border-image: linear-gradient(180deg, #00008B 0%, #4169e1 100%) 1;
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
    }

    .card:hover {
      transform: translateX(4px);
      box-shadow: 0 4px 12px rgba(0, 0, 139, 0.3);
    }

    .card.cdk-drag-animating {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .cdk-drag-placeholder {
      opacity: 0.4;
      border: 2px dashed;
      border-image: linear-gradient(135deg, #00008B 0%, #4169e1 100%) 1;
      background: rgba(0, 0, 139, 0.1);
    }

    .card-description {
      font-size: 14px;
      color: #666;
      margin: 8px 0;
    }

    .card-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 4px 0;
      font-weight: 500;
    }

    .card-meta mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #667eea;
    }

    .card-footer {
      display: flex;
      gap: 12px;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
    }

    .card-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #666;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 12px;
    }

    .card-badge mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .add-card-btn {
      width: 100%;
      margin-top: 8px;
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
      color: white;
      font-weight: 600;
    }

    .add-card-btn:hover {
      background: linear-gradient(135deg, #4169e1 0%, #00008B 100%);
    }
  `]
})
export class BoardComponent implements OnInit, OnDestroy {
  board?: Board;
  departmentId: number = 0;
  currentUser: any;
  private subscriptions: Subscription[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private signalRService: SignalRService,
    private authService: AuthService,
    private dialog: MatDialog
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.departmentId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadBoard();
    this.setupSignalR();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.board) {
      this.signalRService.leaveBoard(this.board.boardId.toString());
    }
  }

  loadBoard(): void {
    this.apiService.getBoardsByDepartment(this.departmentId).subscribe({
      next: (boards) => {
        if (boards && boards.length > 0) {
          this.board = boards[0]; // Get first board

          // Join SignalR board
          const token = this.authService.getToken();
          if (token) {
            this.signalRService.startConnection(token).then(() => {
              if (this.board) {
                this.signalRService.joinBoard(this.board.boardId.toString());
              }
            });
          }
        }
      },
      error: (error) => {
        console.error('Error loading board:', error);
      }
    });
  }

  setupSignalR(): void {
    const sub1 = this.signalRService.cardMoved$.subscribe(() => {
      this.loadBoard();
    });

    const sub2 = this.signalRService.cardCreated$.subscribe(() => {
      this.loadBoard();
    });

    const sub3 = this.signalRService.cardUpdated$.subscribe(() => {
      this.loadBoard();
    });

    const sub4 = this.signalRService.cardDeleted$.subscribe(() => {
      this.loadBoard();
    });

    this.subscriptions.push(sub1, sub2, sub3, sub4);
  }

  onCardDrop(event: CdkDragDrop<Card[]>): void {
    if (event.previousContainer === event.container) {
      // Same list - just reorder
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Different list - move card
      const card = event.previousContainer.data[event.previousIndex];
      const targetListId = Number(event.container.id.replace('list-', ''));

      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );

      // Update card position via API
      this.apiService.moveCard(card.cardId, {
        targetListId: targetListId,
        position: event.currentIndex
      }).subscribe({
        error: (error) => {
          console.error('Error moving card:', error);
          // Revert on error
          this.loadBoard();
        }
      });
    }
  }

  addCard(listId: number): void {
    // This would open a dialog to add a new card
    console.log('Add card to list:', listId);
  }

  notificationCount = 3;

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
