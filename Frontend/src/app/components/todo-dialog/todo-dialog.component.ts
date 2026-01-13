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
      <div class="dialog-header">
        <h2>ToDo Tasks</h2>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-tab-group [(selectedIndex)]="selectedTab">
        <!-- My Tasks Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>assignment</mat-icon>
            <span>My Tasks</span>
            <span class="badge" *ngIf="pendingTasksCount > 0">{{ pendingTasksCount }}</span>
          </ng-template>

          <div class="tab-content">
            <div class="task-filters">
              <mat-form-field appearance="outline" class="filter-field">
                <mat-label>Filter by Status</mat-label>
                <mat-select [(value)]="filterStatus" (selectionChange)="applyFilter()">
                  <mat-option value="all">All</mat-option>
                  <mat-option value="Pending">Pending</mat-option>
                  <mat-option value="Accepted">Accepted</mat-option>
                  <mat-option value="Completed">Completed</mat-option>
                </mat-select>
              </mat-form-field>
            </div>

            <div class="tasks-list" *ngIf="filteredMyTasks.length > 0; else noTasks">
              <div class="task-card" *ngFor="let task of filteredMyTasks" 
                   [class.completed]="task.isCompleted"
                   [class.pending]="task.status === 'Pending'"
                   [class.priority-high]="task.priority === 'High'"
                   [class.priority-urgent]="task.priority === 'Urgent'">
                <div class="task-header">
                  <mat-checkbox 
                    [checked]="task.isCompleted" 
                    [disabled]="task.status === 'Pending' || task.isCompleted"
                    (change)="toggleTaskComplete(task)">
                  </mat-checkbox>
                  <div class="task-info">
                    <div class="task-title" [class.completed-text]="task.isCompleted">{{ task.title }}</div>
                    <div class="task-meta">
                      <span class="due-date" [class.overdue]="isOverdue(task)">
                        <mat-icon>event</mat-icon>
                        {{ task.dueDate | date:'MMM d, y' }}
                      </span>
                      <span class="priority-badge" [class]="'priority-' + task.priority.toLowerCase()">
                        {{ task.priority }}
                      </span>
                      <span class="status-badge" [class]="'status-' + task.status.toLowerCase()">
                        {{ task.status }}
                      </span>
                    </div>
                  </div>
                  <div class="task-actions">
                    <button mat-icon-button *ngIf="task.status === 'Pending' && !task.isSelfAssigned" 
                            matTooltip="Accept Task" (click)="respondToTask(task, true)">
                      <mat-icon>check_circle</mat-icon>
                    </button>
                    <button mat-icon-button *ngIf="task.status === 'Pending' && !task.isSelfAssigned" 
                            matTooltip="Decline Task" (click)="respondToTask(task, false)">
                      <mat-icon>cancel</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Delete Task" (click)="deleteTask(task)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
                <div class="task-description" *ngIf="task.description">
                  {{ task.description }}
                </div>
                <div class="task-footer" *ngIf="!task.isSelfAssigned">
                  <span class="assigned-by">Assigned by: {{ task.createdByUserName }}</span>
                </div>
              </div>
            </div>
            <ng-template #noTasks>
              <div class="no-tasks">
                <mat-icon>task_alt</mat-icon>
                <p>No tasks found</p>
              </div>
            </ng-template>
          </div>
        </mat-tab>

        <!-- Assigned by Me Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>assignment_ind</mat-icon>
            <span>Assigned by Me</span>
          </ng-template>

          <div class="tab-content">
            <div class="tasks-list" *ngIf="assignedByMeTasks.length > 0; else noAssignedTasks">
              <div class="task-card" *ngFor="let task of assignedByMeTasks" 
                   [class.completed]="task.isCompleted"
                   [class.declined]="task.status === 'Declined'">
                <div class="task-header">
                  <mat-icon [class]="getStatusIconClass(task.status)">{{ getStatusIcon(task.status) }}</mat-icon>
                  <div class="task-info">
                    <div class="task-title" [class.completed-text]="task.isCompleted">{{ task.title }}</div>
                    <div class="task-meta">
                      <span class="assigned-to">
                        <mat-icon>person</mat-icon>
                        {{ task.assignedToUserName }}
                      </span>
                      <span class="due-date" [class.overdue]="isOverdue(task)">
                        <mat-icon>event</mat-icon>
                        {{ task.dueDate | date:'MMM d, y' }}
                      </span>
                      <span class="status-badge" [class]="'status-' + task.status.toLowerCase()">
                        {{ task.status }}
                      </span>
                    </div>
                  </div>
                  <div class="task-actions">
                    <button mat-icon-button matTooltip="Delete Task" (click)="deleteTask(task)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <ng-template #noAssignedTasks>
              <div class="no-tasks">
                <mat-icon>assignment_ind</mat-icon>
                <p>You haven't assigned any tasks to others</p>
              </div>
            </ng-template>
          </div>
        </mat-tab>

        <!-- Create Task Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>add_task</mat-icon>
            <span>Create Task</span>
          </ng-template>

          <div class="tab-content create-task-tab">
            <form [formGroup]="taskForm" (ngSubmit)="createTask()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Task Title</mat-label>
                <input matInput formControlName="title" placeholder="What needs to be done?">
                <mat-error *ngIf="taskForm.get('title')?.hasError('required')">Title is required</mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Description</mat-label>
                <textarea matInput formControlName="description" rows="3" placeholder="Add more details..."></textarea>
              </mat-form-field>

              <div class="form-row">
                <mat-form-field appearance="outline">
                  <mat-label>Due Date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="dueDate">
                  <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
                  <mat-datepicker #picker></mat-datepicker>
                  <mat-error *ngIf="taskForm.get('dueDate')?.hasError('required')">Due date is required</mat-error>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select formControlName="priority">
                    <mat-option value="Low">Low</mat-option>
                    <mat-option value="Normal">Normal</mat-option>
                    <mat-option value="High">High</mat-option>
                    <mat-option value="Urgent">Urgent</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Assign To</mat-label>
                <input matInput 
                       [matAutocomplete]="userAuto" 
                       formControlName="assigneeSearch"
                       placeholder="Search for a user or leave empty for self">
                <mat-autocomplete #userAuto="matAutocomplete" 
                                  [displayWith]="displayUser"
                                  (optionSelected)="onUserSelected($event)">
                  <mat-option *ngFor="let user of filteredUsers | async" [value]="user">
                    {{ user.firstName }} {{ user.lastName }} ({{ user.email }})
                  </mat-option>
                </mat-autocomplete>
                <mat-hint>Leave empty to assign to yourself</mat-hint>
              </mat-form-field>

              <div class="selected-assignee" *ngIf="selectedAssignee">
                <mat-chip-row (removed)="removeAssignee()">
                  <mat-icon matChipAvatar>person</mat-icon>
                  {{ selectedAssignee.firstName }} {{ selectedAssignee.lastName }}
                  <button matChipRemove>
                    <mat-icon>cancel</mat-icon>
                  </button>
                </mat-chip-row>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Category</mat-label>
                <mat-select formControlName="category">
                  <mat-option value="">None</mat-option>
                  <mat-option value="Work">Work</mat-option>
                  <mat-option value="Meeting">Meeting</mat-option>
                  <mat-option value="Follow-up">Follow-up</mat-option>
                  <mat-option value="Project">Project</mat-option>
                  <mat-option value="Personal">Personal</mat-option>
                </mat-select>
              </mat-form-field>

              <div class="form-actions">
                <button mat-raised-button color="primary" type="submit" [disabled]="taskForm.invalid || isSubmitting">
                  <mat-icon>add</mat-icon>
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </mat-tab>

        <!-- Notifications Tab -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon>notifications</mat-icon>
            <span>Notifications</span>
            <span class="badge" *ngIf="unreadNotificationsCount > 0">{{ unreadNotificationsCount }}</span>
          </ng-template>

          <div class="tab-content">
            <div class="notifications-header" *ngIf="notifications.length > 0">
              <button mat-button color="primary" (click)="markAllAsRead()">
                <mat-icon>done_all</mat-icon>
                Mark all as read
              </button>
            </div>

            <div class="notifications-list" *ngIf="notifications.length > 0; else noNotifications">
              <div class="notification-item" *ngFor="let notification of notifications" 
                   [class.unread]="!notification.isRead"
                   (click)="markNotificationAsRead(notification)">
                <mat-icon [class]="getNotificationIconClass(notification.notificationType)">
                  {{ getNotificationIcon(notification.notificationType) }}
                </mat-icon>
                <div class="notification-content">
                  <div class="notification-message">{{ notification.message }}</div>
                  <div class="notification-time">{{ notification.createdAt | date:'MMM d, y h:mm a' }}</div>
                </div>
              </div>
            </div>
            <ng-template #noNotifications>
              <div class="no-tasks">
                <mat-icon>notifications_none</mat-icon>
                <p>No notifications</p>
              </div>
            </ng-template>
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .todo-dialog {
      width: 100%;
      min-width: 1100px;
      max-width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      border-bottom: 1px solid #e0e0e0;
    }

    .dialog-header h2 {
      margin: 0;
      color: #333;
    }

    .tab-content {
      padding: 16px;
      max-height: 60vh;
      overflow-y: auto;
    }

    .task-filters {
      margin-bottom: 16px;
    }

    .filter-field {
      width: 200px;
    }

    .tasks-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .task-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 12px 16px;
      transition: all 0.2s ease;
    }

    .task-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .task-card.completed {
      background: #f5f5f5;
      opacity: 0.8;
    }

    .task-card.pending {
      border-left: 4px solid #ff9800;
    }

    .task-card.declined {
      border-left: 4px solid #f44336;
      opacity: 0.7;
    }

    .task-card.priority-high {
      border-left: 4px solid #ff5722;
    }

    .task-card.priority-urgent {
      border-left: 4px solid #d32f2f;
    }

    .task-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .task-info {
      flex: 1;
    }

    .task-title {
      font-weight: 500;
      font-size: 15px;
      color: #333;
    }

    .task-title.completed-text {
      text-decoration: line-through;
      color: #999;
    }

    .task-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
      font-size: 12px;
      color: #666;
    }

    .task-meta span {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .task-meta mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .due-date.overdue {
      color: #f44336;
    }

    .priority-badge, .status-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .priority-low { background: #e3f2fd; color: #1976d2; }
    .priority-normal { background: #e8f5e9; color: #388e3c; }
    .priority-high { background: #fff3e0; color: #f57c00; }
    .priority-urgent { background: #ffebee; color: #d32f2f; }

    .status-pending { background: #fff3e0; color: #f57c00; }
    .status-accepted { background: #e3f2fd; color: #1976d2; }
    .status-declined { background: #ffebee; color: #d32f2f; }
    .status-completed { background: #e8f5e9; color: #388e3c; }

    .task-actions {
      display: flex;
      gap: 4px;
    }

    .task-actions mat-icon {
      font-size: 20px;
    }

    .task-description {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #f0f0f0;
      font-size: 13px;
      color: #666;
    }

    .task-footer {
      margin-top: 8px;
      font-size: 12px;
      color: #999;
    }

    .no-tasks {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      color: #999;
    }

    .no-tasks mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    .create-task-tab {
      padding: 24px;
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

    .selected-assignee {
      margin-bottom: 16px;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }

    .badge {
      background: #f44336;
      color: white;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      margin-left: 8px;
    }

    .notifications-header {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 16px;
    }

    .notifications-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .notification-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .notification-item:hover {
      background: #f5f5f5;
    }

    .notification-item.unread {
      background: #e3f2fd;
      border-color: #90caf9;
    }

    .notification-content {
      flex: 1;
    }

    .notification-message {
      font-size: 14px;
      color: #333;
    }

    .notification-time {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }

    .icon-assigned { color: #1976d2; }
    .icon-accepted { color: #388e3c; }
    .icon-declined { color: #d32f2f; }
    .icon-completed { color: #388e3c; }

    ::ng-deep .mat-mdc-tab-body-wrapper {
      flex: 1;
    }

    ::ng-deep .mat-mdc-tab-labels {
      background: #fafafa;
    }

    ::ng-deep .mat-mdc-tab-label {
      gap: 8px;
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
