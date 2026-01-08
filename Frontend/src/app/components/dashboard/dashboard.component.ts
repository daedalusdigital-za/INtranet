import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Department } from '../../models/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatDialogModule,
    MatBadgeModule,
    MatTooltipModule,
    MatChipsModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatMenuModule
  ],
  template: `
    <mat-toolbar color="primary">
      <span style="font-size: 20px; font-weight: 600;">Promed Intranet</span>
      <span style="margin: 0 32px;"></span>

      <button mat-button routerLink="/dashboard">
        <mat-icon>home</mat-icon> Home
      </button>
      <button mat-button routerLink="/calendar">
        <mat-icon>calendar_month</mat-icon> Calendar
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
      <button mat-button routerLink="/stock-management">
        <mat-icon>inventory</mat-icon> Stock Management
      </button>
      <button mat-button routerLink="/documents">
        <mat-icon>folder</mat-icon> Documents
      </button>
      <button mat-button routerLink="/support-ticket">
        <mat-icon>support_agent</mat-icon> Support Ticket
      </button>

      <span class="spacer"></span>

      <button mat-icon-button [matBadge]="notificationCount" matBadgeColor="warn" [matBadgeHidden]="notificationCount === 0" (click)="toggleNotifications($event)" matTooltip="Notifications">
        <mat-icon>notifications</mat-icon>
      </button>

      <!-- Notification Dropdown -->
      @if (showNotifications) {
        <div class="notification-dropdown" (click)="$event.stopPropagation()">
          <div class="notification-header">
            <h3>Notifications</h3>
            <button mat-button color="primary" (click)="markAllAsRead()">
              <mat-icon>done_all</mat-icon>
              Mark All as Read
            </button>
          </div>

          <div class="notification-list">
            @if (notifications.length === 0) {
              <div class="no-notifications">
                <mat-icon>notifications_off</mat-icon>
                <p>No new notifications</p>
              </div>
            } @else {
              @for (notification of notifications; track notification.id) {
                <div class="notification-item" [class.unread]="!notification.read">
                  <div class="notification-icon">
                    <mat-icon [style.color]="notification.iconColor">{{ notification.icon }}</mat-icon>
                  </div>
                  <div class="notification-content">
                    <p class="notification-title">{{ notification.title }}</p>
                    <p class="notification-message">{{ notification.message }}</p>
                    <span class="notification-time">{{ notification.time }}</span>
                  </div>
                  @if (!notification.read) {
                    <button mat-icon-button (click)="markAsRead(notification.id)" matTooltip="Mark as read">
                      <mat-icon>check</mat-icon>
                    </button>
                  }
                </div>
              }
            }
          </div>

          <div class="notification-footer">
            <button mat-button color="primary" (click)="viewAllNotifications()">View All Notifications</button>
          </div>
        </div>
      }

      <button mat-icon-button [matMenuTriggerFor]="menu">
        <mat-icon>account_circle</mat-icon>
      </button>
      <mat-menu #menu="matMenu">
        <button mat-menu-item>
          <mat-icon>person</mat-icon>
          <span>Profile</span>
        </button>
        <button mat-menu-item>
          <mat-icon>settings</mat-icon>
          <span>Settings</span>
        </button>
        <button mat-menu-item (click)="logout()">
          <mat-icon>logout</mat-icon>
          <span>Logout</span>
        </button>
      </mat-menu>
    </mat-toolbar>

    <div class="dashboard-container">
      <h1>Project Management</h1>

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
              <mat-option value="planning">Planning</mat-option>
              <mat-option value="in-progress">In Progress</mat-option>
              <mat-option value="testing">Testing</mat-option>
              <mat-option value="deployment">Deployment</mat-option>
              <mat-option value="completed">Completed</mat-option>
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
            <mat-button-toggle value="grid" matTooltip="Grid View">
              <mat-icon>grid_view</mat-icon>
            </mat-button-toggle>
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
            <mat-spinner></mat-spinner>
          </div>
        } @else {
          <!-- Grid View -->
          @if (currentView === 'grid') {
            <div class="projects-grid">
              @for (project of filteredProjects; track project.id) {
                <mat-card class="project-card" [class]="'project-type-' + project.type">
                  <mat-card-header>
                    <div class="project-header">
                      <div class="project-type-badge" [style.background]="getProjectTypeColor(project.type)">
                        <mat-icon>{{ getProjectTypeIcon(project.type) }}</mat-icon>
                      </div>
                      <div>
                        <mat-card-title>{{ project.name }}</mat-card-title>
                        <mat-card-subtitle>{{ project.description }}</mat-card-subtitle>
                      </div>
                    </div>
                  </mat-card-header>

                  <mat-card-content>
                    <!-- Workflow Stage -->
                    <div class="workflow-indicator">
                      <mat-chip [style.background]="getWorkflowColor(project.workflow)">
                        {{ project.workflow }}
                      </mat-chip>
                      <mat-chip [style.background]="getStatusColor(project.status)">
                        {{ project.status }}
                      </mat-chip>
                    </div>

                    <!-- Progress Bar -->
                    <div class="progress-section">
                      <div class="progress-header">
                        <span>Progress</span>
                        <span class="progress-value">{{ project.progress }}%</span>
                      </div>
                      <mat-progress-bar
                        mode="determinate"
                        [value]="project.progress"
                        [color]="getProgressColor(project.progress)">
                      </mat-progress-bar>
                    </div>

                    <!-- Resource Tracking -->
                    <div class="resources">
                      <div class="resource-item">
                        <mat-icon>people</mat-icon>
                        <span>{{ project.teamSize }} members</span>
                      </div>
                      <div class="resource-item">
                        <mat-icon>attach_money</mat-icon>
                        <span>{{ project.budgetUsed }}% budget</span>
                      </div>
                      <div class="resource-item">
                        <mat-icon>schedule</mat-icon>
                        <span>{{ project.daysRemaining }} days left</span>
                      </div>
                    </div>

                    <!-- Milestones -->
                    <div class="milestones">
                      <div class="milestone-header">
                        <mat-icon>flag</mat-icon>
                        <span>Milestones: {{ project.milestonesCompleted }}/{{ project.totalMilestones }}</span>
                      </div>
                      <div class="milestone-progress">
                        @for (milestone of [].constructor(project.totalMilestones); track $index) {
                          <div class="milestone-dot" [class.completed]="$index < project.milestonesCompleted"></div>
                        }
                      </div>
                    </div>

                    <!-- Team Members -->
                    <div class="team-avatars">
                      @for (member of project.team; track member) {
                        <div class="avatar" [matTooltip]="member">
                          {{ member.charAt(0) }}
                        </div>
                      }
                    </div>
                  </mat-card-content>

                  <mat-card-actions>
                    <button mat-button color="primary" (click)="openPasswordDialog(project)">
                      <mat-icon>dashboard</mat-icon>
                      View Boards
                    </button>
                    <button mat-icon-button [matMenuTriggerFor]="projectMenu">
                      <mat-icon>more_vert</mat-icon>
                    </button>
                    <mat-menu #projectMenu="matMenu">
                      <button mat-menu-item>
                        <mat-icon>edit</mat-icon>
                        <span>Edit Project</span>
                      </button>
                      <button mat-menu-item>
                        <mat-icon>people</mat-icon>
                        <span>Manage Team</span>
                      </button>
                      <button mat-menu-item>
                        <mat-icon>assessment</mat-icon>
                        <span>View Reports</span>
                      </button>
                    </mat-menu>
                  </mat-card-actions>
                </mat-card>
              }
            </div>
          }

          <!-- List View -->
          @if (currentView === 'list') {
            <div class="projects-list">
              @for (project of filteredProjects; track project.id) {
                <mat-card class="project-list-item">
                  <div class="list-item-content">
                    <div class="list-item-main">
                      <div class="project-type-badge-small" [style.background]="getProjectTypeColor(project.type)">
                        <mat-icon>{{ getProjectTypeIcon(project.type) }}</mat-icon>
                      </div>
                      <div class="list-item-details">
                        <h3>{{ project.name }}</h3>
                        <p>{{ project.description }}</p>
                      </div>
                    </div>

                    <div class="list-item-meta">
                      <mat-chip [style.background]="getWorkflowColor(project.workflow)">
                        {{ project.workflow }}
                      </mat-chip>
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
                          <mat-chip [style.background]="getProjectTypeColor(project.type)" class="type-chip-small">
                            {{ project.type }}
                          </mat-chip>
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
                          <button mat-icon-button (click)="openPasswordDialog(project)">
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
              @for (project of filteredProjects; track project.id) {
                <div class="timeline-item">
                  <div class="timeline-marker" [style.background]="getStatusColor(project.status)"></div>
                  <mat-card class="timeline-card">
                    <div class="timeline-header">
                      <div>
                        <h3>{{ project.name }}</h3>
                        <p>{{ project.description }}</p>
                      </div>
                      <mat-chip [style.background]="getWorkflowColor(project.workflow)">
                        {{ project.workflow }}
                      </mat-chip>
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
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
    }

    .spacer {
      flex: 1 1 auto;
    }

    .dashboard-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    h1 {
      margin-bottom: 24px;
      color: #ffffff;
      font-size: 2.5rem;
      font-weight: 600;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }

    .loading-spinner ::ng-deep .mat-progress-spinner circle {
      stroke: #ffffff;
    }

    /* Controls Bar */
    .controls-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      background: rgba(255, 255, 255, 0.95);
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
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
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .view-controls ::ng-deep .mat-button-toggle {
      border: none;
    }

    .view-controls ::ng-deep .mat-button-toggle-checked {
      background: linear-gradient(135deg, #00008B 0%, #4169e1 100%);
      color: white;
    }

    /* Grid View */
    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
    }

    .project-card {
      transition: all 0.3s ease;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      overflow: hidden;
      border-left: 4px solid transparent;
    }

    .project-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    .project-card ::ng-deep .mat-mdc-card-header {
      padding: 20px;
      background: linear-gradient(135deg, rgba(0, 0, 139, 0.05) 0%, rgba(65, 105, 225, 0.05) 100%);
    }

    .project-card-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .project-type-badge {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .project-type-badge mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .project-info h3 {
      margin: 0 0 4px 0;
      font-size: 1.3rem;
      font-weight: 600;
      color: #333;
    }

    .project-info p {
      margin: 0;
      font-size: 0.9rem;
      color: #666;
      line-height: 1.4;
    }

    .workflow-indicator {
      display: flex;
      gap: 8px;
      margin: 16px 0;
      flex-wrap: wrap;
    }

    .workflow-indicator mat-chip {
      font-size: 12px;
      font-weight: 500;
    }

    .progress-section {
      margin: 20px 0;
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .progress-label {
      font-size: 14px;
      font-weight: 600;
      color: #333;
    }

    .progress-value {
      font-size: 14px;
      font-weight: 600;
      color: #4169e1;
    }

    .progress-section ::ng-deep .mat-mdc-progress-bar {
      height: 8px;
      border-radius: 4px;
    }

    .resources {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin: 16px 0;
    }

    .resource-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #666;
    }

    .resource-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #4169e1;
    }

    .resource-item strong {
      color: #333;
      font-weight: 600;
    }

    .milestones {
      margin: 16px 0;
    }

    .milestones-header {
      font-size: 13px;
      font-weight: 600;
      color: #666;
      margin-bottom: 8px;
    }

    .milestone-dots {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .milestone-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #e0e0e0;
      transition: all 0.2s ease;
    }

    .milestone-dot.completed {
      background: #4CAF50;
      box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.3);
    }

    .team-avatars {
      display: flex;
      gap: 8px;
      margin: 16px 0;
      flex-wrap: wrap;
    }

    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: transform 0.2s ease;
    }

    .avatar:hover {
      transform: scale(1.1);
    }

    .avatar:nth-child(2) {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .avatar:nth-child(3) {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .avatar:nth-child(4) {
      background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
    }

    .avatar:nth-child(5) {
      background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
    }

    .card-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
      margin-top: 16px;
    }

    /* List View */
    .projects-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }

    .project-list-item {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }

    .project-list-item:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateX(4px);
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
      font-size: 1.1rem;
      font-weight: 600;
      color: #333;
    }

    .list-item-main p {
      margin: 4px 0 0 0;
      font-size: 0.85rem;
      color: #666;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
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
    }

    .progress-inline-bar {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .progress-inline ::ng-deep .mat-mdc-progress-bar {
      height: 6px;
      border-radius: 3px;
      width: 100px;
    }

    .resource-inline {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #666;
    }

    .resource-inline div {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .resource-inline mat-icon {
      font-size: 16px;
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
      background: rgba(255, 255, 255, 0.9);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .column-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e0e0e0;
    }

    .column-header h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      color: #333;
      text-transform: capitalize;
    }

    .column-count {
      background: #e0e0e0;
      color: #666;
      font-size: 12px;
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
      background: white;
      border-radius: 8px;
      padding: 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      cursor: grab;
      transition: all 0.2s ease;
      border-left: 3px solid transparent;
    }

    .kanban-card:hover {
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-2px);
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
      font-size: 0.95rem;
      font-weight: 600;
      color: #333;
      flex: 1;
    }

    .kanban-type-badge {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .kanban-type-badge mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: white;
    }

    .kanban-progress {
      margin: 12px 0;
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
      border-top: 1px solid #e0e0e0;
    }

    .team-avatars-small {
      display: flex;
      gap: 4px;
    }

    .avatar-small {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 11px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
    }

    .avatar-small:nth-child(2) {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .avatar-small:nth-child(3) {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
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
      background: linear-gradient(180deg, #00008B 0%, #4169e1 100%);
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
      background: white;
      border: 4px solid #4169e1;
      box-shadow: 0 0 0 4px rgba(65, 105, 225, 0.2);
      z-index: 2;
    }

    .timeline-marker.on-track {
      border-color: #4CAF50;
      box-shadow: 0 0 0 4px rgba(76, 175, 80, 0.2);
    }

    .timeline-marker.at-risk {
      border-color: #FF9800;
      box-shadow: 0 0 0 4px rgba(255, 152, 0, 0.2);
    }

    .timeline-marker.delayed {
      border-color: #F44336;
      box-shadow: 0 0 0 4px rgba(244, 67, 54, 0.2);
    }

    .timeline-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;
    }

    .timeline-card:hover {
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
      transform: translateX(4px);
    }

    .timeline-card-header {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-bottom: 16px;
    }

    .timeline-card-header h3 {
      margin: 0;
      font-size: 1.2rem;
      font-weight: 600;
      color: #333;
      flex: 1;
    }

    .timeline-dates {
      display: flex;
      gap: 24px;
      margin: 12px 0;
      font-size: 13px;
      color: #666;
    }

    .date-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .date-item mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #4169e1;
    }

    /* Responsive Design */
    @media (max-width: 1400px) {
      .projects-grid {
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      }
    }

    @media (max-width: 1200px) {
      .projects-grid {
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      }

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

      .projects-grid {
        grid-template-columns: 1fr;
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

    mat-toolbar {
      background: linear-gradient(135deg, #00008B 0%, #1e90ff 50%, #4169e1 100%);
      color: white;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    mat-toolbar h2 {
      font-weight: 600;
      text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.2);
    }

    mat-toolbar button {
      color: white;
    }

    /* Notification Dropdown Styles */
    .notification-dropdown {
      position: absolute;
      top: 60px;
      right: 100px;
      width: 420px;
      max-height: 600px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .notification-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e0e0e0;
      background: #f5f5f5;
    }

    .notification-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }

    .notification-list {
      flex: 1;
      overflow-y: auto;
      max-height: 450px;
    }

    .no-notifications {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      color: #9e9e9e;
      text-align: center;
    }

    .no-notifications mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .notification-item {
      display: flex;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;
      transition: background-color 0.2s;
      cursor: pointer;
    }

    .notification-item:hover {
      background-color: #fafafa;
    }

    .notification-item.unread {
      background-color: #e3f2fd;
    }

    .notification-item.unread:hover {
      background-color: #d1e7f9;
    }

    .notification-icon {
      flex-shrink: 0;
    }

    .notification-icon mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .notification-content {
      flex: 1;
      min-width: 0;
    }

    .notification-title {
      font-weight: 600;
      font-size: 14px;
      color: #333;
      margin: 0 0 4px 0;
    }

    .notification-message {
      font-size: 13px;
      color: #666;
      margin: 0 0 8px 0;
      line-height: 1.4;
    }

    .notification-time {
      font-size: 12px;
      color: #999;
    }

    .notification-footer {
      padding: 12px 20px;
      border-top: 1px solid #e0e0e0;
      background: #f5f5f5;
      text-align: center;
    }

    /* Departments Section */
    .departments-section {
      margin-top: 48px;
      padding-top: 32px;
      border-top: 3px solid rgba(255, 255, 255, 0.2);
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 12px;
      color: white;
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 24px;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .section-title mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
    }

    .loading-spinner {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }

    .loading-spinner ::ng-deep .mat-progress-spinner circle {
      stroke: #ffffff;
    }
  `]
})
export class DashboardComponent implements OnInit {
  departments: Department[] = [];
  loading = true;
  currentUser: any;

  // View and Filter properties
  currentView: 'grid' | 'list' | 'kanban' | 'timeline' = 'grid';
  selectedDepartment: string | number = 'all';
  selectedWorkflow: string = 'all';
  selectedStatus: string = 'all';

  workflowStages = ['planning', 'in-progress', 'testing', 'deployment', 'completed'];

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
    private snackBar: MatSnackBar
  ) {
    this.currentUser = this.authService.currentUserValue;
  }

  ngOnInit(): void {
    this.loadDepartments();
    this.initializeProjects();

    // Close notifications dropdown when clicking outside
    document.addEventListener('click', () => {
      this.showNotifications = false;
    });
  }

  initializeProjects(): void {
    // Mock project data with enhanced features
    this.projects = [
      {
        id: 1,
        name: 'E-Commerce Platform',
        description: 'Building new online shopping platform',
        type: 'software',
        workflow: 'in-progress',
        status: 'on-track',
        progress: 65,
        teamSize: 8,
        budgetUsed: 58,
        daysRemaining: 45,
        milestonesCompleted: 4,
        totalMilestones: 6,
        team: ['John D', 'Sarah M', 'Mike Chen', 'Lisa Wang'],
        startDate: '2025-01-15',
        endDate: '2025-12-30',
        departmentId: 1
      },
      {
        id: 2,
        name: 'Network Upgrade',
        description: 'Modernizing IT infrastructure',
        type: 'infrastructure',
        workflow: 'testing',
        status: 'on-track',
        progress: 78,
        teamSize: 5,
        budgetUsed: 82,
        daysRemaining: 15,
        milestonesCompleted: 5,
        totalMilestones: 6,
        team: ['Tom Hardy', 'Emma Watson', 'Chris Evans'],
        startDate: '2025-02-01',
        endDate: '2025-11-25',
        departmentId: 2
      },
      {
        id: 3,
        name: 'Brand Refresh Campaign',
        description: 'Complete brand identity redesign',
        type: 'marketing',
        workflow: 'planning',
        status: 'on-track',
        progress: 25,
        teamSize: 6,
        budgetUsed: 15,
        daysRemaining: 90,
        milestonesCompleted: 1,
        totalMilestones: 5,
        team: ['Anna Lee', 'Bob Smith', 'Carol Davis'],
        startDate: '2025-10-01',
        endDate: '2026-02-28',
        departmentId: 3
      },
      {
        id: 4,
        name: 'AI Research Project',
        description: 'Developing machine learning models',
        type: 'research',
        workflow: 'in-progress',
        status: 'at-risk',
        progress: 42,
        teamSize: 10,
        budgetUsed: 68,
        daysRemaining: 60,
        milestonesCompleted: 3,
        totalMilestones: 8,
        team: ['Dr. Smith', 'Jane Foster', 'Peter Parker', 'Tony Stark'],
        startDate: '2025-03-01',
        endDate: '2026-01-10',
        departmentId: 4
      },
      {
        id: 5,
        name: 'Supply Chain Optimization',
        description: 'Streamlining logistics operations',
        type: 'operations',
        workflow: 'deployment',
        status: 'on-track',
        progress: 92,
        teamSize: 7,
        budgetUsed: 95,
        daysRemaining: 8,
        milestonesCompleted: 6,
        totalMilestones: 6,
        team: ['David Lee', 'Emily Brown', 'Frank Miller'],
        startDate: '2025-04-01',
        endDate: '2025-11-18',
        departmentId: 5
      },
      {
        id: 6,
        name: 'Mobile App Development',
        description: 'iOS and Android native apps',
        type: 'software',
        workflow: 'in-progress',
        status: 'delayed',
        progress: 38,
        teamSize: 9,
        budgetUsed: 72,
        daysRemaining: 75,
        milestonesCompleted: 2,
        totalMilestones: 7,
        team: ['Alex Johnson', 'Maria Garcia', 'Sam Wilson', 'Nina Patel'],
        startDate: '2025-05-01',
        endDate: '2026-01-25',
        departmentId: 1
      },
      {
        id: 7,
        name: 'Data Center Migration',
        description: 'Moving to cloud infrastructure',
        type: 'infrastructure',
        workflow: 'planning',
        status: 'on-track',
        progress: 18,
        teamSize: 12,
        budgetUsed: 22,
        daysRemaining: 120,
        milestonesCompleted: 1,
        totalMilestones: 9,
        team: ['Kevin Hart', 'Rachel Green', 'Ross Geller'],
        startDate: '2025-11-01',
        endDate: '2026-03-31',
        departmentId: 2
      },
      {
        id: 8,
        name: 'Customer Loyalty Program',
        description: 'Rewards and engagement platform',
        type: 'marketing',
        workflow: 'completed',
        status: 'on-track',
        progress: 100,
        teamSize: 4,
        budgetUsed: 98,
        daysRemaining: 0,
        milestonesCompleted: 4,
        totalMilestones: 4,
        team: ['Monica Bing', 'Chandler Bing'],
        startDate: '2025-01-01',
        endDate: '2025-10-15',
        departmentId: 3
      }
    ];

    this.filteredProjects = [...this.projects];
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

  getProjectTypeColor(type: string): string {
    const colors: any = {
      'software': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'infrastructure': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'marketing': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'research': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'operations': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
    };
    return colors[type] || '#cccccc';
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

  getWorkflowColor(workflow: string): string {
    const colors: any = {
      'planning': '#9E9E9E',
      'in-progress': '#2196F3',
      'testing': '#FF9800',
      'deployment': '#9C27B0',
      'completed': '#4CAF50'
    };
    return colors[workflow] || '#cccccc';
  }

  getStatusColor(status: string): string {
    const colors: any = {
      'on-track': '#4CAF50',
      'at-risk': '#FF9800',
      'delayed': '#F44336'
    };
    return colors[status] || '#cccccc';
  }

  getProgressColor(progress: number): string {
    if (progress >= 75) return 'primary';
    if (progress >= 50) return 'accent';
    return 'warn';
  }

  loadDepartments(): void {
    this.loading = true;
    this.apiService.getDepartments().subscribe({
      next: (data) => {
        this.departments = data;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading departments:', error);
        this.loading = false;
      }
    });
  }

  openPasswordDialog(department: Department): void {
    const dialogRef = this.dialog.open(BoardPasswordDialogComponent, {
      width: '400px',
      data: { departmentName: department.name }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && result.success) {
        this.viewDepartment(department.departmentId);
      }
    });
  }

  viewDepartment(id: number): void {
    this.router.navigate(['/board', id]);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(CreateDepartmentDialog, {
      width: '500px'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.apiService.createDepartment(result).subscribe({
          next: () => {
            this.snackBar.open('Department created successfully!', 'Close', { duration: 3000 });
            this.loadDepartments();
          },
          error: (error) => {
            console.error('Error creating department:', error);
            this.snackBar.open('Failed to create department', 'Close', { duration: 3000 });
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
      color: #00008B;
      margin: 0;
    }

    h2 mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .info-text {
      color: #333;
      font-size: 15px;
      margin: 0 0 8px 0;
    }

    .contact-text {
      color: #666;
      font-size: 14px;
      font-style: italic;
      margin: 0;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d32f2f;
      font-size: 14px;
      margin: 8px 0 0 0;
      padding: 8px;
      background: #ffebee;
      border-radius: 4px;
    }

    .error-message mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    mat-dialog-actions {
      padding: 16px 24px !important;
      margin: 0 !important;
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
    MatButtonModule,
    MatSnackBarModule
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
