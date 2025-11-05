import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule
  ],
  template: `
    <mat-toolbar color="primary">
      <span style="font-size: 20px; font-weight: 600;">Promed Intranet</span>
      <span style="margin: 0 32px;"></span>

      <button mat-button routerLink="/dashboard">
        <mat-icon>home</mat-icon> Home
      </button>
      <button mat-button routerLink="/crm">
        <mat-icon>people_outline</mat-icon> CRM
      </button>
      <button mat-button routerLink="/departments">
        <mat-icon>business</mat-icon> Project Management
      </button>
      <button mat-button routerLink="/people">
        <mat-icon>people</mat-icon> Human Resource
      </button>
      <button mat-button routerLink="/documents">
        <mat-icon>folder</mat-icon> Documents
      </button>
      <button mat-button routerLink="/support-ticket">
        <mat-icon>support_agent</mat-icon> Support Ticket
      </button>

      <span class="spacer"></span>

      <button mat-icon-button>
        <mat-icon>search</mat-icon>
      </button>

      <span style="margin-right: 16px;">{{ currentUser?.name }} ({{ currentUser?.role }})</span>
      <button mat-icon-button (click)="logout()">
        <mat-icon>logout</mat-icon>
      </button>
    </mat-toolbar>

    <div class="projects-container">
      <h1>Projects Overview</h1>

      @if (loading) {
        <div class="loading-container">
          <mat-spinner></mat-spinner>
        </div>
      } @else {
        <div class="projects-grid">
          @for (board of boards; track board.boardId) {
            <mat-card class="project-card" (click)="viewBoard(board.boardId)">
              <mat-card-header>
                <mat-card-title>{{ board.name }}</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="project-info">
                  <div class="info-item">
                    <mat-icon>business</mat-icon>
                    <span>{{ board.departmentName }}</span>
                  </div>
                  <div class="info-item">
                    <mat-icon>list</mat-icon>
                    <span>{{ board.listCount }} lists</span>
                  </div>
                  <div class="info-item">
                    <mat-icon>credit_card</mat-icon>
                    <span>{{ board.cardCount }} cards</span>
                  </div>
                  @if (board.description) {
                    <p class="description">{{ board.description }}</p>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          } @empty {
            <div class="empty-state">
              <mat-icon>folder_open</mat-icon>
              <h3>No projects found</h3>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .projects-container {
      padding: 24px;
      min-height: calc(100vh - 64px);
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

    h1 {
      color: white;
      margin-bottom: 24px;
      font-size: 32px;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 200px;
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }

    .project-card {
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      background: white;
      border-radius: 8px;
    }

    .project-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    mat-card-title {
      font-size: 18px;
      font-weight: 600;
      color: #00008B;
    }

    .project-info {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #666;
    }

    .info-item mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: #1e90ff;
    }

    .description {
      margin-top: 8px;
      color: #666;
      font-size: 14px;
      line-height: 1.4;
    }

    .empty-state {
      grid-column: 1 / -1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: white;
    }

    .empty-state mat-icon {
      font-size: 80px;
      width: 80px;
      height: 80px;
      margin-bottom: 16px;
      opacity: 0.7;
    }

    .empty-state h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 400;
    }

    .spacer {
      flex: 1 1 auto;
    }
  `]
})
export class ProjectsComponent implements OnInit {
  boards: any[] = [];
  loading = true;
  currentUser: any;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.loadAllBoards();
  }

  loadAllBoards(): void {
    this.loading = true;
    // Get all departments first
    this.apiService.getDepartments().subscribe({
      next: (departments) => {
        // For each department, get its boards
        const boardPromises = departments.map(dept =>
          this.apiService.getDepartment(dept.departmentId).toPromise()
        );

        Promise.all(boardPromises).then(results => {
          this.boards = results.flatMap(dept =>
            (dept as any)?.boards?.map((board: any) => ({
              ...board,
              departmentName: (dept as any)?.name
            })) || []
          );
          this.loading = false;
        });
      },
      error: (error) => {
        console.error('Error loading boards:', error);
        this.loading = false;
      }
    });
  }

  viewBoard(boardId: number): void {
    this.router.navigate(['/board', boardId]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
