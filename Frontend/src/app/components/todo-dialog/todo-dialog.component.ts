import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, map, startWith } from 'rxjs';

interface TodoTask {
  id: number;
  title: string;
  description?: string;
  dueDate: Date;
  dueTime?: Date;
  createdByUserId: number;
  createdByUserName: string;
  assignedToUserId: number;
  assignedToUserName: string;
  status: string;
  isCompleted: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  priority: string;
  category?: string;
  isRecurring: boolean;
  recurrencePattern?: string;
  isSelfAssigned: boolean;
}

interface TodoNotification {
  id: number;
  todoTaskId: number;
  taskTitle: string;
  notificationType: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  readAt?: Date;
  assignedByUserName: string;
}

interface User {
  staffMemberId: number;
  firstName: string;
  lastName: string;
  email: string;
}

@Component({
  selector: 'app-todo-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatTabsModule,
    MatListModule,
    MatCheckboxModule,
    MatBadgeModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  template: `
    <div class="todo-dialog">
      <!-- Modern Gradient Header -->
      <div class="dialog-header">
        <div class="header-content">
          <div class="header-icon">
            <mat-icon>checklist</mat-icon>
          </div>
          <div class="header-text">
            <h2>ToDo Tasks</h2>
            <p class="header-subtitle">Manage your tasks and stay organized</p>
          </div>
        </div>
        <div class="header-stats">
          <div class="stat-item" *ngIf="pendingTasksCount > 0">
            <span class="stat-value">{{ pendingTasksCount }}</span>
            <span class="stat-label">Pending</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ myTasks.length }}</span>
            <span class="stat-label">Total Tasks</span>
          </div>
        </div>
        <button mat-icon-button class="close-btn" (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Modern Tab Navigation -->
      <div class="tab-navigation">
        <button class="tab-btn" [class.active]="selectedTab === 0" (click)="selectedTab = 0">
          <mat-icon>assignment</mat-icon>
          <span>My Tasks</span>
          <span class="tab-badge" *ngIf="pendingTasksCount > 0">{{ pendingTasksCount }}</span>
        </button>
        <button class="tab-btn" [class.active]="selectedTab === 1" (click)="selectedTab = 1">
          <mat-icon>assignment_ind</mat-icon>
          <span>Assigned by Me</span>
        </button>
        <button class="tab-btn" [class.active]="selectedTab === 2" (click)="selectedTab = 2">
          <mat-icon>add_task</mat-icon>
          <span>Create Task</span>
        </button>
        <button class="tab-btn" [class.active]="selectedTab === 3" (click)="selectedTab = 3">
          <mat-icon>notifications</mat-icon>
          <span>Notifications</span>
          <span class="tab-badge notification" *ngIf="unreadNotificationsCount > 0">{{ unreadNotificationsCount }}</span>
        </button>
      </div>

      <!-- Tab Content -->
      <div class="tab-content-wrapper">
        <!-- My Tasks Tab -->
        <div class="tab-content" *ngIf="selectedTab === 0">
          <div class="content-toolbar">
            <div class="filter-chips">
              <button class="filter-chip" [class.active]="filterStatus === 'all'" (click)="filterStatus = 'all'; applyFilter()">
                <mat-icon>list</mat-icon> All
              </button>
              <button class="filter-chip" [class.active]="filterStatus === 'Pending'" (click)="filterStatus = 'Pending'; applyFilter()">
                <mat-icon>hourglass_empty</mat-icon> Pending
              </button>
              <button class="filter-chip" [class.active]="filterStatus === 'Accepted'" (click)="filterStatus = 'Accepted'; applyFilter()">
                <mat-icon>check_circle</mat-icon> Accepted
              </button>
              <button class="filter-chip" [class.active]="filterStatus === 'Completed'" (click)="filterStatus = 'Completed'; applyFilter()">
                <mat-icon>task_alt</mat-icon> Completed
              </button>
            </div>
          </div>

          <div class="tasks-grid" *ngIf="filteredMyTasks.length > 0; else noTasks">
            <div class="task-card" *ngFor="let task of filteredMyTasks" 
                 [class.completed]="task.isCompleted"
                 [class.pending]="task.status === 'Pending'"
                 [class.priority-high]="task.priority === 'High'"
                 [class.priority-urgent]="task.priority === 'Urgent'">
              <div class="task-priority-indicator" [class]="'priority-' + task.priority.toLowerCase()"></div>
              <div class="task-content">
                <div class="task-header">
                  <mat-checkbox 
                    [checked]="task.isCompleted" 
                    [disabled]="task.status === 'Pending' || task.isCompleted"
                    (change)="toggleTaskComplete(task)"
                    class="task-checkbox">
                  </mat-checkbox>
                  <div class="task-info">
                    <div class="task-title" [class.completed-text]="task.isCompleted">{{ task.title }}</div>
                    <div class="task-description-preview" *ngIf="task.description">{{ task.description }}</div>
                  </div>
                </div>
                <div class="task-meta">
                  <div class="meta-left">
                    <span class="due-date" [class.overdue]="isOverdue(task)">
                      <mat-icon>schedule</mat-icon>
                      {{ task.dueDate | date:'MMM d' }}
                    </span>
                    <span class="priority-badge" [class]="'priority-' + task.priority.toLowerCase()">
                      {{ task.priority }}
                    </span>
                    <span class="status-badge" [class]="'status-' + task.status.toLowerCase()">
                      {{ task.status }}
                    </span>
                  </div>
                  <div class="task-actions">
                    <button mat-icon-button *ngIf="task.status === 'Pending' && !task.isSelfAssigned" 
                            matTooltip="Accept Task" class="action-accept" (click)="respondToTask(task, true)">
                      <mat-icon>check_circle</mat-icon>
                    </button>
                    <button mat-icon-button *ngIf="task.status === 'Pending' && !task.isSelfAssigned" 
                            matTooltip="Decline Task" class="action-decline" (click)="respondToTask(task, false)">
                      <mat-icon>cancel</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Delete Task" class="action-delete" (click)="deleteTask(task)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </div>
                <div class="task-footer" *ngIf="!task.isSelfAssigned">
                  <div class="assigned-by">
                    <mat-icon>person_outline</mat-icon>
                    <span>Assigned by {{ task.createdByUserName }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ng-template #noTasks>
            <div class="empty-state">
              <div class="empty-icon">
                <mat-icon>task_alt</mat-icon>
              </div>
              <h3>No tasks found</h3>
              <p>You're all caught up! Create a new task to get started.</p>
              <button mat-flat-button color="primary" (click)="selectedTab = 2">
                <mat-icon>add</mat-icon> Create Task
              </button>
            </div>
          </ng-template>
        </div>

        <!-- Assigned by Me Tab -->
        <div class="tab-content" *ngIf="selectedTab === 1">
          <div class="tasks-grid" *ngIf="assignedByMeTasks.length > 0; else noAssignedTasks">
            <div class="task-card assigned-card" *ngFor="let task of assignedByMeTasks" 
                 [class.completed]="task.isCompleted"
                 [class.declined]="task.status === 'Declined'">
              <div class="task-status-indicator" [class]="'status-' + task.status.toLowerCase()"></div>
              <div class="task-content">
                <div class="task-header">
                  <div class="status-icon" [class]="getStatusIconClass(task.status)">
                    <mat-icon>{{ getStatusIcon(task.status) }}</mat-icon>
                  </div>
                  <div class="task-info">
                    <div class="task-title" [class.completed-text]="task.isCompleted">{{ task.title }}</div>
                    <div class="assignee-info">
                      <mat-icon>person</mat-icon>
                      <span>Assigned to {{ task.assignedToUserName }}</span>
                    </div>
                  </div>
                </div>
                <div class="task-meta">
                  <div class="meta-left">
                    <span class="due-date" [class.overdue]="isOverdue(task)">
                      <mat-icon>schedule</mat-icon>
                      {{ task.dueDate | date:'MMM d' }}
                    </span>
                    <span class="status-badge" [class]="'status-' + task.status.toLowerCase()">
                      {{ task.status }}
                    </span>
                  </div>
                  <div class="task-actions">
                    <button mat-icon-button matTooltip="Delete Task" class="action-delete" (click)="deleteTask(task)">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ng-template #noAssignedTasks>
            <div class="empty-state">
              <div class="empty-icon assigned">
                <mat-icon>assignment_ind</mat-icon>
              </div>
              <h3>No assigned tasks</h3>
              <p>You haven't assigned any tasks to others yet.</p>
              <button mat-flat-button color="primary" (click)="selectedTab = 2">
                <mat-icon>add</mat-icon> Assign a Task
              </button>
            </div>
          </ng-template>
        </div>

        <!-- Create Task Tab -->
        <div class="tab-content create-task-tab" *ngIf="selectedTab === 2">
          <div class="create-form-container">
            <div class="form-header">
              <mat-icon>add_task</mat-icon>
              <h3>Create New Task</h3>
            </div>
            <form [formGroup]="taskForm" (ngSubmit)="createTask()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Task Title</mat-label>
                <input matInput formControlName="title" placeholder="What needs to be done?">
                <mat-icon matPrefix>title</mat-icon>
                <mat-error *ngIf="taskForm.get('title')?.hasError('required')">Title is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="3" placeholder="Add more details..."></textarea>
                <mat-icon matPrefix>description</mat-icon>
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Due Date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="dueDate">
                  <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                  <mat-icon matPrefix>event</mat-icon>
                  <mat-error *ngIf="taskForm.get('dueDate')?.hasError('required')">Due date is required</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select formControlName="priority">
                    <mat-option value="Low">
                      <span class="priority-option low">● Low</span>
                    </mat-option>
                    <mat-option value="Normal">
                      <span class="priority-option normal">● Normal</span>
                    </mat-option>
                    <mat-option value="High">
                      <span class="priority-option high">● High</span>
                    </mat-option>
                    <mat-option value="Urgent">
                      <span class="priority-option urgent">● Urgent</span>
                    </mat-option>
                  </mat-select>
                  <mat-icon matPrefix>flag</mat-icon>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Assign To</mat-label>
                <input matInput 
                       [matAutocomplete]="userAuto" 
                       formControlName="assigneeSearch"
                       placeholder="Search for a user or leave empty for self">
                <mat-icon matPrefix>person_add</mat-icon>
                <mat-autocomplete #userAuto="matAutocomplete" 
                                  [displayWith]="displayUser"
                                  (optionSelected)="onUserSelected($event)">
                  <mat-option *ngFor="let user of filteredUsers | async" [value]="user">
                    <div class="user-option">
                      <mat-icon>person</mat-icon>
                      <span>{{ user.firstName }} {{ user.lastName }}</span>
                      <span class="user-email">{{ user.email }}</span>
                    </div>
                  </mat-option>
                </mat-autocomplete>
                <mat-hint>Leave empty to assign to yourself</mat-hint>
              </mat-form-field>

              <div class="selected-assignee" *ngIf="selectedAssignee">
                <div class="assignee-chip">
                  <mat-icon>person</mat-icon>
                  <span>{{ selectedAssignee.firstName }} {{ selectedAssignee.lastName }}</span>
                  <button type="button" mat-icon-button (click)="removeAssignee()">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Category</mat-label>
                <mat-select formControlName="category">
                  <mat-option value="">None</mat-option>
                  <mat-option value="Work">🏢 Work</mat-option>
                  <mat-option value="Meeting">📅 Meeting</mat-option>
                  <mat-option value="Follow-up">📞 Follow-up</mat-option>
                  <mat-option value="Project">📊 Project</mat-option>
                  <mat-option value="Personal">👤 Personal</mat-option>
                </mat-select>
                <mat-icon matPrefix>category</mat-icon>
              </mat-form-field>

              <div class="form-actions">
                <button mat-flat-button type="button" (click)="resetForm()">
                  <mat-icon>refresh</mat-icon>
                  Reset
                </button>
                <button mat-flat-button color="primary" type="submit" [disabled]="taskForm.invalid || isSubmitting" class="create-btn">
                  <mat-icon>{{ isSubmitting ? 'hourglass_empty' : 'add_task' }}</mat-icon>
                  {{ isSubmitting ? 'Creating...' : 'Create Task' }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Notifications Tab -->
        <div class="tab-content" *ngIf="selectedTab === 3">
          <div class="notifications-toolbar" *ngIf="notifications.length > 0">
            <span class="notifications-count">{{ notifications.length }} notifications</span>
            <button mat-button class="mark-read-btn" (click)="markAllAsRead()">
              <mat-icon>done_all</mat-icon>
              Mark all as read
            </button>
          </div>

          <div class="notifications-list" *ngIf="notifications.length > 0; else noNotifications">
            <div class="notification-card" *ngFor="let notification of notifications" 
                 [class.unread]="!notification.isRead"
                 (click)="markNotificationAsRead(notification)">
              <div class="notification-icon" [class]="getNotificationIconClass(notification.notificationType)">
                <mat-icon>{{ getNotificationIcon(notification.notificationType) }}</mat-icon>
              </div>
              <div class="notification-content">
                <div class="notification-message">{{ notification.message }}</div>
                <div class="notification-time">
                  <mat-icon>schedule</mat-icon>
                  {{ notification.createdAt | date:'MMM d, y h:mm a' }}
                </div>
              </div>
              <div class="notification-indicator" *ngIf="!notification.isRead"></div>
            </div>
          </div>
          <ng-template #noNotifications>
            <div class="empty-state">
              <div class="empty-icon notifications">
                <mat-icon>notifications_none</mat-icon>
              </div>
              <h3>No notifications</h3>
              <p>You're all caught up! Check back later for updates.</p>
            </div>
          </ng-template>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .todo-dialog {
      width: 100%;
      min-width: 1100px;
      max-width: 100%;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-radius: 16px;
      overflow: hidden;
    }

    /* Modern Gradient Header */
    .dialog-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
      padding: 24px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
    }

    .dialog-header::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      opacity: 0.5;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 1;
    }

    .header-icon {
      width: 56px;
      height: 56px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.3);
    }

    .header-icon mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: white;
    }

    .header-text h2 {
      margin: 0;
      color: white;
      font-size: 24px;
      font-weight: 600;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .header-subtitle {
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.85);
      font-size: 14px;
    }

    .header-stats {
      display: flex;
      gap: 24px;
      z-index: 1;
    }

    .stat-item {
      text-align: center;
      padding: 8px 16px;
      background: rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .stat-value {
      display: block;
      font-size: 24px;
      font-weight: 700;
      color: white;
    }

    .stat-label {
      display: block;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.85);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .close-btn {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      z-index: 2;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Modern Tab Navigation */
    .tab-navigation {
      display: flex;
      gap: 8px;
      padding: 16px 24px;
      background: white;
      border-bottom: 1px solid #e2e8f0;
    }

    .tab-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border: none;
      background: #f1f5f9;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 14px;
      font-weight: 500;
      color: #64748b;
    }

    .tab-btn:hover {
      background: #e2e8f0;
      color: #475569;
    }

    .tab-btn.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }

    .tab-btn mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .tab-badge {
      background: #ef4444;
      color: white;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }

    .tab-btn.active .tab-badge {
      background: rgba(255, 255, 255, 0.3);
    }

    .tab-badge.notification {
      background: #f59e0b;
    }

    /* Tab Content */
    .tab-content-wrapper {
      flex: 1;
      overflow: hidden;
    }

    .tab-content {
      padding: 24px;
      max-height: calc(85vh - 200px);
      overflow-y: auto;
    }

    /* Filter Chips */
    .content-toolbar {
      margin-bottom: 20px;
    }

    .filter-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .filter-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border: 2px solid #e2e8f0;
      background: white;
      border-radius: 24px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-size: 13px;
      font-weight: 500;
      color: #64748b;
    }

    .filter-chip:hover {
      border-color: #667eea;
      color: #667eea;
    }

    .filter-chip.active {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-color: transparent;
      color: white;
    }

    .filter-chip mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Tasks Grid */
    .tasks-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .task-card {
      background: white;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      transition: all 0.3s ease;
      border: 1px solid #e2e8f0;
    }

    .task-card:hover {
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .task-card.completed {
      opacity: 0.7;
    }

    .task-priority-indicator {
      width: 5px;
      flex-shrink: 0;
    }

    .task-priority-indicator.priority-low { background: linear-gradient(180deg, #3b82f6, #60a5fa); }
    .task-priority-indicator.priority-normal { background: linear-gradient(180deg, #10b981, #34d399); }
    .task-priority-indicator.priority-high { background: linear-gradient(180deg, #f59e0b, #fbbf24); }
    .task-priority-indicator.priority-urgent { background: linear-gradient(180deg, #ef4444, #f87171); }

    .task-status-indicator {
      width: 5px;
      flex-shrink: 0;
    }

    .task-status-indicator.status-pending { background: linear-gradient(180deg, #f59e0b, #fbbf24); }
    .task-status-indicator.status-accepted { background: linear-gradient(180deg, #3b82f6, #60a5fa); }
    .task-status-indicator.status-declined { background: linear-gradient(180deg, #ef4444, #f87171); }
    .task-status-indicator.status-completed { background: linear-gradient(180deg, #10b981, #34d399); }

    .task-content {
      flex: 1;
      padding: 16px 20px;
    }

    .task-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .task-checkbox {
      margin-top: 2px;
    }

    .status-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .status-icon.icon-pending { background: #fef3c7; color: #d97706; }
    .status-icon.icon-accepted { background: #dbeafe; color: #2563eb; }
    .status-icon.icon-declined { background: #fee2e2; color: #dc2626; }
    .status-icon.icon-completed { background: #d1fae5; color: #059669; }

    .task-info {
      flex: 1;
      min-width: 0;
    }

    .task-title {
      font-weight: 600;
      font-size: 15px;
      color: #1e293b;
      margin-bottom: 4px;
    }

    .task-title.completed-text {
      text-decoration: line-through;
      color: #94a3b8;
    }

    .task-description-preview {
      font-size: 13px;
      color: #64748b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .assignee-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #64748b;
      margin-top: 4px;
    }

    .assignee-info mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .task-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #f1f5f9;
    }

    .meta-left {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }

    .due-date {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #64748b;
      padding: 4px 10px;
      background: #f1f5f9;
      border-radius: 6px;
    }

    .due-date mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .due-date.overdue {
      background: #fee2e2;
      color: #dc2626;
    }

    .priority-badge, .status-badge {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .priority-low { background: #dbeafe; color: #2563eb; }
    .priority-normal { background: #d1fae5; color: #059669; }
    .priority-high { background: #fef3c7; color: #d97706; }
    .priority-urgent { background: #fee2e2; color: #dc2626; }

    .status-pending { background: #fef3c7; color: #d97706; }
    .status-accepted { background: #dbeafe; color: #2563eb; }
    .status-declined { background: #fee2e2; color: #dc2626; }
    .status-completed { background: #d1fae5; color: #059669; }

    .task-actions {
      display: flex;
      gap: 4px;
    }

    .task-actions button {
      width: 32px;
      height: 32px;
      line-height: 32px;
    }

    .task-actions mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .action-accept { color: #10b981; }
    .action-accept:hover { background: #d1fae5; }
    .action-decline { color: #ef4444; }
    .action-decline:hover { background: #fee2e2; }
    .action-delete { color: #94a3b8; }
    .action-delete:hover { background: #f1f5f9; color: #ef4444; }

    .task-footer {
      margin-top: 12px;
    }

    .assigned-by {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #94a3b8;
    }

    .assigned-by mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 40px;
      text-align: center;
    }

    .empty-icon {
      width: 80px;
      height: 80px;
      border-radius: 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 24px;
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    }

    .empty-icon.assigned {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
    }

    .empty-icon.notifications {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      box-shadow: 0 10px 30px rgba(245, 158, 11, 0.3);
    }

    .empty-icon mat-icon {
      font-size: 40px;
      width: 40px;
      height: 40px;
      color: white;
    }

    .empty-state h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .empty-state p {
      margin: 0 0 24px 0;
      font-size: 14px;
      color: #64748b;
    }

    /* Create Task Form */
    .create-task-tab {
      padding: 24px 32px;
    }

    .create-form-container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      border-radius: 20px;
      padding: 32px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
    }

    .form-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #f1f5f9;
    }

    .form-header mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
      color: #667eea;
    }

    .form-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1e293b;
    }

    .full-width {
      width: 100%;
    }

    .form-row {
      display: flex;
      gap: 16px;
    }

    .form-row mat-form-field {
      flex: 1;
    }

    .priority-option.low { color: #2563eb; }
    .priority-option.normal { color: #059669; }
    .priority-option.high { color: #d97706; }
    .priority-option.urgent { color: #dc2626; }

    .user-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .user-option mat-icon {
      color: #64748b;
    }

    .user-email {
      font-size: 12px;
      color: #94a3b8;
      margin-left: auto;
    }

    .selected-assignee {
      margin-bottom: 16px;
    }

    .assignee-chip {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 24px;
      font-size: 14px;
    }

    .assignee-chip mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .assignee-chip button {
      width: 24px;
      height: 24px;
      line-height: 24px;
      color: white;
    }

    .assignee-chip button mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px solid #f1f5f9;
    }

    .form-actions button {
      padding: 0 24px;
      height: 44px;
      border-radius: 12px;
    }

    .create-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    }

    /* Notifications */
    .notifications-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .notifications-count {
      font-size: 14px;
      color: #64748b;
    }

    .mark-read-btn {
      color: #667eea;
    }

    .notifications-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .notification-card {
      display: flex;
      gap: 16px;
      padding: 16px 20px;
      background: white;
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.3s ease;
      border: 1px solid #e2e8f0;
      position: relative;
    }

    .notification-card:hover {
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
      transform: translateY(-1px);
    }

    .notification-card.unread {
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
      border-color: rgba(102, 126, 234, 0.3);
    }

    .notification-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .notification-icon.icon-assigned { background: #dbeafe; color: #2563eb; }
    .notification-icon.icon-accepted { background: #d1fae5; color: #059669; }
    .notification-icon.icon-declined { background: #fee2e2; color: #dc2626; }
    .notification-icon.icon-completed { background: #d1fae5; color: #059669; }

    .notification-content {
      flex: 1;
    }

    .notification-message {
      font-size: 14px;
      color: #1e293b;
      font-weight: 500;
    }

    .notification-time {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #94a3b8;
      margin-top: 6px;
    }

    .notification-time mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .notification-indicator {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.5);
    }

    /* Scrollbar */
    .tab-content::-webkit-scrollbar {
      width: 6px;
    }

    .tab-content::-webkit-scrollbar-track {
      background: transparent;
    }

    .tab-content::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 3px;
    }

    .tab-content::-webkit-scrollbar-thumb:hover {
      background: #94a3b8;
    }

    /* Form field styling */
    ::ng-deep .mat-mdc-form-field-icon-prefix {
      color: #94a3b8;
      margin-right: 8px;
    }
  `]
})
export class TodoDialogComponent implements OnInit {
  selectedTab = 0;
  taskForm: FormGroup;
  isSubmitting = false;

  myTasks: TodoTask[] = [];
  filteredMyTasks: TodoTask[] = [];
  assignedByMeTasks: TodoTask[] = [];
  notifications: TodoNotification[] = [];
  users: User[] = [];
  filteredUsers!: Observable<User[]>;
  selectedAssignee: User | null = null;

  filterStatus = 'all';
  currentUserId: number;

  get pendingTasksCount(): number {
    return this.myTasks.filter(t => t.status === 'Pending' && !t.isSelfAssigned).length;
  }

  get unreadNotificationsCount(): number {
    return this.notifications.filter(n => !n.isRead).length;
  }

  constructor(
    private dialogRef: MatDialogRef<TodoDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { userId: number },
    private fb: FormBuilder,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) {
    this.currentUserId = data.userId;
    this.taskForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      dueDate: [new Date(), Validators.required],
      priority: ['Normal'],
      assigneeSearch: [''],
      category: ['']
    });
  }

  ngOnInit(): void {
    this.loadMyTasks();
    this.loadAssignedByMeTasks();
    this.loadNotifications();
    this.loadUsers();
  }

  loadMyTasks(): void {
    this.http.get<TodoTask[]>(`${environment.apiUrl}/todo/my-tasks/${this.currentUserId}`)
      .subscribe({
        next: (tasks) => {
          this.myTasks = tasks;
          this.applyFilter();
        },
        error: (err) => console.error('Error loading tasks:', err)
      });
  }

  loadAssignedByMeTasks(): void {
    this.http.get<TodoTask[]>(`${environment.apiUrl}/todo/assigned-by/${this.currentUserId}`)
      .subscribe({
        next: (tasks) => this.assignedByMeTasks = tasks,
        error: (err) => console.error('Error loading assigned tasks:', err)
      });
  }

  loadNotifications(): void {
    this.http.get<TodoNotification[]>(`${environment.apiUrl}/todo/notifications/${this.currentUserId}`)
      .subscribe({
        next: (notifications) => this.notifications = notifications,
        error: (err) => console.error('Error loading notifications:', err)
      });
  }

  loadUsers(): void {
    this.http.get<User[]>(`${environment.apiUrl}/users`)
      .subscribe({
        next: (users) => {
          this.users = users;
          this.setupUserAutocomplete();
        },
        error: (err) => console.error('Error loading users:', err)
      });
  }

  setupUserAutocomplete(): void {
    this.filteredUsers = this.taskForm.get('assigneeSearch')!.valueChanges.pipe(
      startWith(''),
      map(value => {
        const searchValue = typeof value === 'string' ? value : '';
        return this.filterUsers(searchValue);
      })
    );
  }

  filterUsers(search: string): User[] {
    const filterValue = search.toLowerCase();
    return this.users.filter(user =>
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(filterValue) ||
      user.email.toLowerCase().includes(filterValue)
    );
  }

  displayUser(user: User): string {
    return user ? `${user.firstName} ${user.lastName}` : '';
  }

  onUserSelected(event: any): void {
    this.selectedAssignee = event.option.value;
    this.taskForm.patchValue({ assigneeSearch: '' });
  }

  removeAssignee(): void {
    this.selectedAssignee = null;
  }

  resetForm(): void {
    this.taskForm.reset({ dueDate: new Date(), priority: 'Normal' });
    this.selectedAssignee = null;
  }

  applyFilter(): void {
    if (this.filterStatus === 'all') {
      this.filteredMyTasks = this.myTasks;
    } else {
      this.filteredMyTasks = this.myTasks.filter(t => t.status === this.filterStatus);
    }
  }

  isOverdue(task: TodoTask): boolean {
    if (task.isCompleted) return false;
    return new Date(task.dueDate) < new Date();
  }

  createTask(): void {
    if (this.taskForm.invalid) return;

    this.isSubmitting = true;
    const formValue = this.taskForm.value;

    const payload = {
      title: formValue.title,
      description: formValue.description,
      dueDate: formValue.dueDate,
      priority: formValue.priority,
      assignedToUserId: this.selectedAssignee?.staffMemberId || this.currentUserId,
      category: formValue.category || null
    };

    this.http.post(`${environment.apiUrl}/todo`, payload, {
      headers: { 'X-User-Id': this.currentUserId.toString() }
    }).subscribe({
      next: () => {
        this.snackBar.open('Task created successfully!', 'Close', { duration: 3000 });
        this.taskForm.reset({ dueDate: new Date(), priority: 'Normal' });
        this.selectedAssignee = null;
        this.loadMyTasks();
        this.loadAssignedByMeTasks();
        this.selectedTab = 0;
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Error creating task:', err);
        this.snackBar.open('Error creating task', 'Close', { duration: 3000 });
        this.isSubmitting = false;
      }
    });
  }

  toggleTaskComplete(task: TodoTask): void {
    if (task.status === 'Pending' || task.isCompleted) return;

    this.http.post(`${environment.apiUrl}/todo/${task.id}/complete`, {}).subscribe({
      next: () => {
        this.snackBar.open('Task completed!', 'Close', { duration: 3000 });
        this.loadMyTasks();
      },
      error: (err) => {
        console.error('Error completing task:', err);
        this.snackBar.open('Error completing task', 'Close', { duration: 3000 });
      }
    });
  }

  respondToTask(task: TodoTask, accept: boolean): void {
    this.http.post(`${environment.apiUrl}/todo/${task.id}/respond`, { accept }, {
      headers: { 'X-User-Id': this.currentUserId.toString() }
    }).subscribe({
      next: () => {
        this.snackBar.open(accept ? 'Task accepted!' : 'Task declined', 'Close', { duration: 3000 });
        this.loadMyTasks();
      },
      error: (err) => {
        console.error('Error responding to task:', err);
        this.snackBar.open('Error responding to task', 'Close', { duration: 3000 });
      }
    });
  }

  deleteTask(task: TodoTask): void {
    if (!confirm('Are you sure you want to delete this task?')) return;

    this.http.delete(`${environment.apiUrl}/todo/${task.id}`).subscribe({
      next: () => {
        this.snackBar.open('Task deleted', 'Close', { duration: 3000 });
        this.loadMyTasks();
        this.loadAssignedByMeTasks();
      },
      error: (err) => {
        console.error('Error deleting task:', err);
        this.snackBar.open('Error deleting task', 'Close', { duration: 3000 });
      }
    });
  }

  markNotificationAsRead(notification: TodoNotification): void {
    if (notification.isRead) return;

    this.http.post(`${environment.apiUrl}/todo/notifications/${notification.id}/read`, {}).subscribe({
      next: () => {
        notification.isRead = true;
      },
      error: (err) => console.error('Error marking notification as read:', err)
    });
  }

  markAllAsRead(): void {
    this.http.post(`${environment.apiUrl}/todo/notifications/read-all/${this.currentUserId}`, {}).subscribe({
      next: () => {
        this.notifications.forEach(n => n.isRead = true);
        this.snackBar.open('All notifications marked as read', 'Close', { duration: 3000 });
      },
      error: (err) => console.error('Error marking all as read:', err)
    });
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Pending': return 'hourglass_empty';
      case 'Accepted': return 'check_circle_outline';
      case 'Declined': return 'cancel';
      case 'Completed': return 'task_alt';
      default: return 'help_outline';
    }
  }

  getStatusIconClass(status: string): string {
    switch (status) {
      case 'Pending': return 'icon-pending';
      case 'Accepted': return 'icon-accepted';
      case 'Declined': return 'icon-declined';
      case 'Completed': return 'icon-completed';
      default: return '';
    }
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'TaskAssigned': return 'assignment';
      case 'TaskAccepted': return 'check_circle';
      case 'TaskDeclined': return 'cancel';
      case 'TaskCompleted': return 'task_alt';
      default: return 'notifications';
    }
  }

  getNotificationIconClass(type: string): string {
    switch (type) {
      case 'TaskAssigned': return 'icon-assigned';
      case 'TaskAccepted': return 'icon-accepted';
      case 'TaskDeclined': return 'icon-declined';
      case 'TaskCompleted': return 'icon-completed';
      default: return '';
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
