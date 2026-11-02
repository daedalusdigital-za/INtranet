import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Department } from '../../models/models';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { ToastService } from '../../ui/toast.service';
import { StatusChipComponent } from '../../ui/status-chip/status-chip.component';
import { SkeletonRowsComponent } from '../../ui/skeleton-rows/skeleton-rows.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatChipsModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatMenuModule,
    NavbarComponent,
    StatusChipComponent,
    SkeletonRowsComponent,
    EmptyStateComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="dashboard-container">
      <div class="page-header">
        <h1>Project Management</h1>
        <button mat-flat-button color="primary" (click)="openCreateBoardDialog()">
          <mat-icon>add</mat-icon>
          Create New Board
        </button>
      </div>

      <!-- Filters and View Controls -->
      <div class="controls-bar">
        <div class="filters">
          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Department</mat-label>
            <mat-select [(value)]="selectedDepartment" (selectionChange)="filterProjects()">
              <mat-option value="all">All Departments</mat-option>
              @for (dept of departments; track dept.departmentId) {
                <mat-option [value]="dept.departmentId">{{ dept.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Workflow Stage</mat-label>
            <mat-select [(value)]="selectedWorkflow" (selectionChange)="filterProjects()">
              <mat-option value="all">All Stages</mat-option>
              <mat-option value="Planning">Planning</mat-option>
              <mat-option value="In Progress">In Progress</mat-option>
              <mat-option value="Testing">Testing</mat-option>
              <mat-option value="Completed">Completed</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-field">
            <mat-label>Status</mat-label>
            <mat-select [(value)]="selectedStatus" (selectionChange)="filterProjects()">
              <mat-option value="all">All Status</mat-option>
              <mat-option value="on-track">On Track</mat-option>
              <mat-option value="at-risk">At Risk</mat-option>
              <mat-option value="delayed">Delayed</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="view-controls">
          <mat-button-toggle-group [(value)]="currentView" (change)="changeView()">
            <mat-button-toggle value="list" matTooltip="List View">
              <mat-icon>view_list</mat-icon>
            </mat-button-toggle>
            <mat-button-toggle value="kanban" matTooltip="Kanban View">
              <mat-icon>view_kanban</mat-icon>
            </mat-button-toggle>
            <mat-button-toggle value="timeline" matTooltip="Timeline View">
              <mat-icon>timeline</mat-icon>
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>
      </div>

      <!-- Project Management Section -->
      <div class="projects-section">
        @if (loading) {
          <div class="loading-spinner">
            <app-skeleton-rows [rows]="5" [avatar]="false" />
          </div>
        } @else {
          <!-- List View -->
          @if (currentView === 'list') {
            <div class="projects-list">
              @if (filteredProjects.length === 0) {
                <app-empty-state icon="dashboard_customize" title="No boards to show"
                                 message="No boards match the filters, or none have been created yet." />
              }
              @for (project of filteredProjects; track project.id) {
                <mat-card class="project-list-item">
                  <div class="list-item-content">
                    <div class="list-item-main">
                      <div class="project-type-badge-small" [class]="'project-type-badge-small type-' + project.type">
                        <mat-icon>{{ getProjectTypeIcon(project.type) }}</mat-icon>
                      </div>
                      <div class="list-item-details">
                        <h3>{{ project.name }}</h3>
                        <p>{{ project.description }}</p>
                      </div>
                    </div>

                    <div class="list-item-meta">
                      <app-status-chip [status]="project.workflow" />
                      <div class="progress-inline">
                        <span>{{ project.progress }}%</span>
                        <mat-progress-bar mode="determinate" [value]="project.progress"></mat-progress-bar>
                      </div>
                      <div class="resource-inline">
                        <span><mat-icon>people</mat-icon> {{ project.teamSize }}</span>
                        <span><mat-icon>schedule</mat-icon> {{ project.daysRemaining }}d</span>
                      </div>
                      <button mat-raised-button color="primary" (click)="openPasswordDialog(project)">
                        View Boards
                      </button>
                    </div>
                  </div>
                </mat-card>
              }
            </div>
          }

          <!-- Kanban View -->
          @if (currentView === 'kanban') {
            <div class="kanban-board">
              @for (stage of workflowStages; track stage) {
                <div class="kanban-column">
                  <div class="column-header">
                    <h3>{{ stage }}</h3>
                    <span class="column-count">{{ getProjectsByWorkflow(stage).length }}</span>
                  </div>
                  <div class="column-content">
                    @for (project of getProjectsByWorkflow(stage); track project.id) {
                      <mat-card class="kanban-card">
                        <div class="kanban-card-header">
                          <h4>{{ project.name }}</h4>
                          <span [class]="'type-chip-small type-' + project.type">{{ project.type }}</span>
                        </div>
                        <p class="kanban-description">{{ project.description }}</p>
                        <div class="kanban-progress">
                          <span>{{ project.progress }}%</span>
                          <mat-progress-bar mode="determinate" [value]="project.progress"></mat-progress-bar>
                        </div>
                        <div class="kanban-footer">
                          <div class="team-avatars-small">
                            @for (member of project.team.slice(0, 3); track member) {
                              <div class="avatar-small">{{ member.charAt(0) }}</div>
                            }
                          </div>
                          <button aria-label="Forward" mat-icon-button (click)="openPasswordDialog(project)">
                            <mat-icon>arrow_forward</mat-icon>
                          </button>
                        </div>
                      </mat-card>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Timeline View -->
          @if (currentView === 'timeline') {
            <div class="timeline-view">
              @if (filteredProjects.length === 0) {
                <app-empty-state icon="timeline" title="No boards to show"
                                 message="No boards match the filters, or none have been created yet." />
              }
              @for (project of filteredProjects; track project.id) {
                <div class="timeline-item">
                  <div [class]="'timeline-marker ' + project.status"></div>
                  <mat-card class="timeline-card">
                    <div class="timeline-header">
                      <div>
                        <h3>{{ project.name }}</h3>
                        <p>{{ project.description }}</p>
                      </div>
                      <app-status-chip [status]="project.workflow" />
                    </div>
                    <div class="timeline-dates">
                      <div class="date-item">
                        <mat-icon>event</mat-icon>
                        <span>Start: {{ project.startDate }}</span>
                      </div>
                      <div class="date-item">
                        <mat-icon>event</mat-icon>
                        <span>End: {{ project.endDate }}</span>
                      </div>
                      <div class="date-item">
                        <mat-icon>schedule</mat-icon>
                        <span>{{ project.daysRemaining }} days remaining</span>
                      </div>
                    </div>
                    <div class="timeline-progress">
                      <mat-progress-bar mode="determinate" [value]="project.progress"></mat-progress-bar>
                      <span>{{ project.progress }}% Complete</span>
                    </div>
                  </mat-card>
                </div>
              }
            </div>
          }
        }

        @if (currentUser?.role === 'Admin') {
          <div class="admin-actions">
            <button mat-raised-button color="primary" (click)="openCreateDialog()">
              <mat-icon>add</mat-icon>
              Create New Project
            </button>
          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      position: relative;
      background: var(--color-canvas);
      overflow-x: hidden;
    }

    .dashboard-container {
      padding: 80px;
      max-width: 1400px;
      margin: 0 auto;
      min-height: calc(100vh - 64px);
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .page-header h1 {
      margin: 0;
      color: var(--color-text);
      font-size: var(--text-4xl);
      font-weight: 600;
    }

    .page-header button {
      height: 48px;
      font-size: var(--text-lg);
      font-weight: 600;
      border-radius: var(--radius-md);
      padding: 0 24px;
    }

    .loading-spinner {
      min-height: 400px;
    }

    /* Controls Bar */
    .controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      padding: 20px;
      border-radius: var(--radius-md);
    }

    .filters {
      display: flex;
      gap: 16px;
      flex: 1;
    }

    .filter-field {
      min-width: 200px;
    }

    .view-controls {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .view-controls ::ng-deep .mat-button-toggle-group {
      background: var(--color-surface);
      border-radius: var(--radius-control);
    }

    .view-controls ::ng-deep .mat-button-toggle {
      border: none;
    }

    .view-controls ::ng-deep .mat-button-toggle-checked {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    /* List View */
    .projects-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }

    .project-list-item {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 20px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s ease;
    }

    .project-list-item:hover {
      box-shadow: var(--shadow-md);
    }

    .list-item-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 24px;
    }

    .list-item-main {
      display: flex;
      gap: 16px;
      align-items: center;
      flex: 1;
      min-width: 0;
    }

    .list-item-main h3 {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--color-text);
    }

    .list-item-details {
      min-width: 0;
      flex: 1;
    }

    .list-item-main p {
      margin: 4px 0 0 0;
      font-size: var(--text-sm);
      color: var(--color-text-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .project-type-badge-small {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }

    .type-software { background: var(--color-primary-soft); color: var(--color-primary); }
    .type-infrastructure { background: var(--color-cat-purple-soft); color: var(--color-cat-purple); }
    .type-marketing { background: var(--color-cat-pink-soft); color: var(--color-cat-pink); }
    .type-research { background: var(--color-cat-teal-soft); color: var(--color-cat-teal); }
    .type-operations { background: var(--color-cat-amber-soft); color: var(--color-cat-amber); }

    .type-chip-small {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 9px;
      border-radius: 999px;
      font-size: var(--text-xs);
      font-weight: 700;
      text-transform: capitalize;
      white-space: nowrap;
    }

    .list-item-meta {
      display: flex;
      gap: 24px;
      align-items: center;
      flex-shrink: 0;
    }

    .progress-inline {
      display: flex;
      flex-direction: column;
      min-width: 150px;
      color: var(--color-text-2);
      font-size: var(--text-sm);
    }

    .progress-inline ::ng-deep .mat-mdc-progress-bar {
      height: 6px;
      border-radius: 3px;
      width: 100px;
    }

    .resource-inline {
      display: flex;
      gap: 16px;
      font-size: var(--text-sm);
      color: var(--color-text-2);
    }

    .resource-inline span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .resource-inline mat-icon {
      font-size: var(--text-lg);
      width: 16px;
      height: 16px;
    }

    /* Kanban View */
    .kanban-board {
      display: flex;
      gap: 16px;
      overflow-x: auto;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }

    .kanban-column {
      min-width: 320px;
      max-width: 320px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 16px;
    }

    .column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid var(--color-line);
    }

    .column-header h3 {
      margin: 0;
      font-size: var(--text-lg);
      font-weight: 600;
      color: var(--color-text);
      text-transform: capitalize;
    }

    .column-count {
      background: var(--color-line);
      color: var(--color-text-2);
      font-size: var(--text-xs);
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 12px;
    }

    .column-content {
      min-height: 400px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .kanban-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-control);
      padding: 16px;
      box-shadow: var(--shadow-sm);
      cursor: grab;
      transition: box-shadow 0.2s ease;
    }

    .kanban-card:hover {
      box-shadow: var(--shadow-md);
    }

    .kanban-card:active {
      cursor: grabbing;
    }

    .kanban-card-header {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .kanban-card-header h4 {
      margin: 0;
      font-size: var(--text-md);
      font-weight: 600;
      color: var(--color-text);
      flex: 1;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .kanban-description {
      font-size: var(--text-sm);
      color: var(--color-text-2);
      margin: 0 0 8px 0;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      word-wrap: break-word;
      overflow-wrap: break-word;
      line-height: 1.4;
    }

    .kanban-progress {
      margin: 12px 0;
      color: var(--color-text-2);
      font-size: var(--text-sm);
    }

    .kanban-progress ::ng-deep .mat-mdc-progress-bar {
      height: 6px;
      border-radius: 3px;
    }

    .kanban-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--color-line);
    }

    .team-avatars-small {
      display: flex;
      gap: 4px;
    }

    .avatar-small {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: var(--text-xs);
    }

    /* Timeline View */
    .timeline-view {
      position: relative;
      padding-left: 50px;
      margin-bottom: 24px;
    }

    .timeline-view::before {
      content: '';
      position: absolute;
      left: 24px;
      top: 30px;
      bottom: 30px;
      width: 3px;
      background: var(--color-line-strong);
      border-radius: 2px;
    }

    .timeline-item {
      position: relative;
      margin-bottom: 32px;
    }

    .timeline-marker {
      position: absolute;
      left: -34px;
      top: 28px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: var(--color-surface);
      border: 4px solid var(--color-primary);
      z-index: 2;
    }

    .timeline-marker.on-track {
      border-color: var(--color-ok);
    }

    .timeline-marker.at-risk {
      border-color: var(--color-warn);
    }

    .timeline-marker.delayed {
      border-color: var(--color-danger);
    }

    .timeline-card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-md);
      padding: 20px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s ease;
    }

    .timeline-card:hover {
      box-shadow: var(--shadow-md);
    }

    .timeline-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 16px;
      overflow: hidden;
    }

    .timeline-header h3 {
      margin: 0;
      font-size: var(--text-xl);
      font-weight: 600;
      color: var(--color-text);
    }

    .timeline-header > div {
      min-width: 0;
      flex: 1;
    }

    .timeline-header p {
      margin: 4px 0 0 0;
      font-size: var(--text-sm);
      color: var(--color-text-2);
      word-wrap: break-word;
      overflow-wrap: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.4;
    }

    .timeline-dates {
      display: flex;
      gap: 24px;
      margin: 12px 0;
      font-size: var(--text-sm);
      color: var(--color-text-2);
    }

    .timeline-progress {
      color: var(--color-text-2);
      font-size: var(--text-sm);
    }

    .date-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .date-item mat-icon {
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
      color: var(--color-primary);
    }

    /* Responsive Design */
    @media (max-width: 1200px) {
      .kanban-board {
        flex-wrap: wrap;
      }

      .kanban-column {
        min-width: 280px;
      }
    }

    @media (max-width: 768px) {
      .controls-bar {
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }

      .filters {
        flex-direction: column;
      }

      .filter-field {
        width: 100%;
      }

      .view-controls {
        justify-content: center;
      }

      .list-item-content {
        flex-direction: column;
        align-items: flex-start;
      }

      .list-item-meta {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .kanban-board {
        flex-direction: column;
      }

      .kanban-column {
        min-width: 100%;
        max-width: 100%;
      }

      .timeline-view {
        padding-left: 40px;
      }

      .timeline-view::before {
        left: 20px;
      }

      .timeline-marker {
        left: -30px;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  departments: Department[] = [];
  loading = true;
  currentUser: any;

  // View and Filter properties
  currentView: 'list' | 'kanban' | 'timeline' = 'list';
  selectedDepartment: string | number = 'all';
  selectedWorkflow: string = 'all';
  selectedStatus: string = 'all';

  workflowStages = ['Planning', 'In Progress', 'Testing', 'Completed'];

  // Projects data
  projects: any[] = [];
  filteredProjects: any[] = [];

  // Notification properties
  notificationCount: number = 3;
  showNotifications: boolean = false;
  notifications: any[] = [
    {
      id: 1,
      icon: 'campaign',
      iconColor: '#FF6B6B',
      title: 'New Company Announcement',
      message: 'Important policy update has been posted',
      time: '10 minutes ago',
      read: false
    },
    {
      id: 2,
      icon: 'cake',
      iconColor: '#f5576c',
      title: 'Birthday Today',
      message: 'Sarah Johnson from HR is celebrating today!',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      icon: 'group_add',
      iconColor: '#11998e',
      title: 'New Employee',
      message: 'Welcome Michael Brown to the Marketing team',
      time: '3 hours ago',
      read: false
    },
    {
      id: 4,
      icon: 'emoji_events',
      iconColor: '#FFD700',
      title: 'Employee of the Month',
      message: 'Jennifer Smith has been named Employee of the Month',
      time: '1 day ago',
      read: false
    },
    {
      id: 5,
      icon: 'support_agent',
      iconColor: '#4169e1',
      title: 'Support Ticket Resolved',
      message: 'Your IT support ticket #1234 has been resolved',
      time: '2 days ago',
      read: false
    }
  ];

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router,
    private dialog: MatDialog,
    private toast: ToastService
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadBoards();

    // Close notifications dropdown when clicking outside
    document.addEventListener('click', () => {
      this.showNotifications = false;
    });
  }

  loadBoards(): void {
    this.loading = true;
    this.apiService.getAllBoards().subscribe({
      next: (boards) => {
        // Map boards to project format for display
        this.projects = boards.map((board: any) => {
          // Calculate progress based on cards in Done/Completed list vs total
          const totalCards = board.lists?.reduce((sum: number, list: any) => sum + (list.cards?.length || 0), 0) || 0;
          const doneCards = board.lists
            ?.filter((l: any) => l.title?.toLowerCase().includes('done') || l.title?.toLowerCase().includes('complete'))
            .reduce((sum: number, list: any) => sum + (list.cards?.length || 0), 0) || 0;
          const progress = totalCards > 0 ? Math.round((doneCards / totalCards) * 100) : 0;
          
          return {
            id: board.boardId,
            name: board.title,
            description: board.description || 'No description',
            type: this.getProjectTypeFromDepartment(board.departmentName),
            workflow: this.getWorkflowFromProgress(progress),
            status: 'on-track',
            progress: progress,
            teamSize: board.lists?.reduce((sum: number, list: any) => {
              const assignees = new Set(list.cards?.map((c: any) => c.assignedToUserId).filter((id: number) => id));
              return sum + assignees.size;
            }, 0) || 0,
            budgetUsed: 0,
            daysRemaining: 30,
            milestonesCompleted: doneCards,
            totalMilestones: totalCards || 1,
            team: [],
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            departmentId: board.departmentId,
            departmentName: board.departmentName,
            lists: board.lists || [],
            isRealBoard: true // Flag to identify this is from database
          };
        });
        this.filteredProjects = [...this.projects];
        this.loading = false;
      },
      error: (error) => {
        this.initializeProjects(); // Show empty state on failure
        this.loading = false;
      }
    });
  }

  getProjectTypeFromDepartment(departmentName: string): string {
    const typeMap: {[key: string]: string} = {
      'production': 'operations',
      'quality assurance': 'research',
      'warehouse': 'infrastructure',
      'administration': 'software',
      'it': 'software',
      'marketing': 'marketing',
      'sales': 'marketing',
      'hr': 'operations'
    };
    const lowerName = departmentName?.toLowerCase() || '';
    for (const key of Object.keys(typeMap)) {
      if (lowerName.includes(key)) return typeMap[key];
    }
    return 'software';
  }

  getWorkflowFromProgress(progress: number): string {
    if (progress === 0) return 'Planning';
    if (progress < 50) return 'In Progress';
    if (progress < 80) return 'Testing';
    if (progress < 100) return 'In Progress';
    return 'Completed';
  }

  initializeProjects(): void {
    // On API failure, show an empty state instead of fabricated demo projects.
    // Never present invented data as if it were real.
    this.projects = [];
    this.filteredProjects = [];
  }

  filterProjects(): void {
    this.filteredProjects = this.projects.filter(project => {
      const deptMatch = this.selectedDepartment === 'all' || project.departmentId === this.selectedDepartment;
      const workflowMatch = this.selectedWorkflow === 'all' || project.workflow === this.selectedWorkflow;
      const statusMatch = this.selectedStatus === 'all' || project.status === this.selectedStatus;
      return deptMatch && workflowMatch && statusMatch;
    });
  }

  changeView(): void {
    // View changed, could add analytics here
  }

  getProjectsByWorkflow(workflow: string): any[] {
    return this.filteredProjects.filter(p => p.workflow === workflow);
  }

  getProjectTypeIcon(type: string): string {
    const icons: any = {
      'software': 'code',
      'infrastructure': 'dns',
      'marketing': 'campaign',
      'research': 'science',
      'operations': 'settings'
    };
    return icons[type] || 'folder';
  }

  getProgressColor(progress: number): string {
    if (progress >= 75) return 'primary';
    if (progress >= 50) return 'accent';
    return 'warn';
  }

  loadDepartments(): void {
    this.apiService.getDepartments().subscribe({
      next: (data) => {
        this.departments = data;
      },
      error: (error) => {
        console.error('Error loading departments:', error);
      }
    });
  }



  openPasswordDialog(project: any): void {
    // If it's a real board from database, navigate directly
    if (project.isRealBoard) {
      this.router.navigate(['/board', project.id]);
      return;
    }
    
    // For mock data, show password dialog
    const dialogRef = this.dialog.open(BoardPasswordDialogComponent, {
      width: '400px',
      data: { departmentName: project.name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.router.navigate(['/board', project.id]);
      }
    });
  }

  viewDepartment(id: number): void {
    this.router.navigate(['/board', id]);
  }

  openCreateBoardDialog(): void {
    const dialogRef = this.dialog.open(CreateBoardDialog, {
      width: '500px',
      data: { departments: this.departments }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.apiService.createBoard(result).subscribe({
          next: (newBoard) => {
            this.toast.done('Board created.');
            this.loadBoards();
          },
          error: (error) => {
            console.error('Error creating board:', error);
            this.toast.error('Could not create the board. Please try again.');
          }
        });
      }
    });
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CreateDepartmentDialog, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.apiService.createDepartment(result).subscribe({
          next: () => {
            this.toast.done('Department created.');
            this.loadDepartments();
          },
          error: (error) => {
            console.error('Error creating department:', error);
            this.toast.error('Could not create the department. Please try again.');
          }
        });
      }
    });
  }

  // Notification methods
  toggleNotifications(event: Event): void {
    event.stopPropagation();
    this.showNotifications = !this.showNotifications;
  }

  markAsRead(notificationId: number): void {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.updateNotificationCount();
    }
  }

  markAllAsRead(): void {
    this.notifications.forEach(n => n.read = true);
    this.updateNotificationCount();
  }

  updateNotificationCount(): void {
    this.notificationCount = this.notifications.filter(n => !n.read).length;
  }

  viewAllNotifications(): void {
    this.showNotifications = false;
  }

  logout(): void {
    this.authService.logout();
  }
}

// Board Password Dialog Component
@Component({
  selector: 'app-board-password-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    FormsModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>lock</mat-icon>
      Access {{ data.departmentName }} Boards
    </h2>
    <mat-dialog-content>
      <p class="info-text">This department's boards are password protected.</p>
      <p class="contact-text">Contact the department manager for the password.</p>

      <mat-form-field appearance="outline" style="width: 100%; margin-top: 16px;">
        <mat-label>Department Password</mat-label>
        <input matInput
               type="password"
               [(ngModel)]="password"
               (keyup.enter)="validatePassword()"
               placeholder="Enter password">
        <mat-icon matPrefix>vpn_key</mat-icon>
      </mat-form-field>

      @if (errorMessage) {
        <p class="error-message">
          <mat-icon>error</mat-icon>
          {{ errorMessage }}
        </p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="validatePassword()">
        <mat-icon>lock_open</mat-icon>
        Access Boards
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-primary);
      margin: 0;
    }

    h2 mat-icon {
      font-size: var(--text-3xl);
      width: 28px;
      height: 28px;
    }

    .info-text {
      color: var(--color-text);
      font-size: var(--text-md);
      margin: 0 0 8px 0;
    }

    .contact-text {
      color: var(--color-text-2);
      font-size: var(--text-md);
      font-style: italic;
      margin: 0;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--color-danger);
      font-size: var(--text-md);
      margin: 8px 0 0 0;
      padding: 8px;
      background: var(--color-danger-soft);
      border-radius: var(--radius-sm);
    }

    .error-message mat-icon {
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
    }

    mat-dialog-actions {
      padding: 16px 24px;
      margin: 0;
    }

    mat-dialog-actions button {
      margin-left: 8px;
    }
  `]
})
export class BoardPasswordDialogComponent {
  password: string = '';
  errorMessage: string = '';
  private readonly DEFAULT_PASSWORD = '0000';

  constructor(
    public dialogRef: MatDialogRef<BoardPasswordDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { departmentName: string }
  ) {}

  validatePassword(): void {
    if (!this.password || this.password.trim() === '') {
      this.errorMessage = 'Please enter a password';
      return;
    }

    if (this.password === this.DEFAULT_PASSWORD) {
      this.dialogRef.close({ success: true });
    } else {
      this.errorMessage = 'Incorrect password. Please contact the department manager.';
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}

@Component({
  selector: 'create-department-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>Create New Department</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Department Name</mat-label>
          <input matInput formControlName="name" required>
          @if (form.get('name')?.hasError('required')) {
            <mat-error>Department name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Manager Name</mat-label>
          <input matInput formControlName="managerName" required>
          @if (form.get('managerName')?.hasError('required')) {
            <mat-error>Manager name is required</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="submit()">Create</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
  `]
})
export class CreateDepartmentDialog {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateDepartmentDialog>
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      managerName: ['', Validators.required]
    });
  }

  submit(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }
}

@Component({
  selector: 'create-board-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  template: `
    <h2 mat-dialog-title>Create New Board</h2>
    <mat-dialog-content>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Board Title</mat-label>
          <input matInput formControlName="title" required placeholder="Enter board title">
          @if (form.get('title')?.hasError('required')) {
            <mat-error>Board title is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Department</mat-label>
          <mat-select formControlName="departmentId" required>
            @for (dept of data.departments; track dept.departmentId) {
              <mat-option [value]="dept.departmentId">{{ dept.name }}</mat-option>
            }
          </mat-select>
          @if (form.get('departmentId')?.hasError('required')) {
            <mat-error>Department is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Description</mat-label>
          <textarea matInput formControlName="description" rows="3" placeholder="Enter board description (optional)"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid" (click)="submit()">Create Board</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    mat-dialog-content {
      min-width: 400px;
    }
  `]
})
export class CreateBoardDialog {
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<CreateBoardDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { departments: any[] }
  ) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      departmentId: ['', Validators.required],
      description: ['']
    });
  }

  submit(): void {
    if (this.form.valid) {
      this.dialogRef.close(this.form.value);
    }
  }
}



