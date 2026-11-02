import { Component, OnInit, Inject, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { NavbarComponent } from '../shared/navbar/navbar.component';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../ui/toast.service';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';

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
  priority: string;
  category?: string;
  isSelfAssigned: boolean;
}

interface UserBirthday {
  userId: number;
  name: string;
  surname?: string;
  birthday: Date;
  departmentName?: string;
  profilePictureUrl?: string;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatCheckboxModule,
    MatTooltipModule,
    NavbarComponent,
    EmptyStateComponent
  ],
  template: `
    <app-navbar></app-navbar>

    <div class="calendar-container">
      <div class="calendar-header">
        <button aria-label="Previous" mat-icon-button (click)="previousMonth()">
          <mat-icon>chevron_left</mat-icon>
        </button>
        <h1>{{ monthNames[currentMonth] }} {{ currentYear }}</h1>
        <button aria-label="Next" mat-icon-button (click)="nextMonth()">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>

      <div class="calendar-grid">
        <div class="calendar-weekdays">
          <div class="weekday">Sun</div>
          <div class="weekday">Mon</div>
          <div class="weekday">Tue</div>
          <div class="weekday">Wed</div>
          <div class="weekday">Thu</div>
          <div class="weekday">Fri</div>
          <div class="weekday">Sat</div>
        </div>

        <div class="calendar-days">
          @for (day of calendarDays; track day.date) {
            <div class="calendar-day"
                 [class.other-month]="!day.isCurrentMonth"
                 [class.today]="day.isToday"
                 [class.has-events]="day.events.length > 0 || day.tasks.length > 0"
                 [class.clickable]="day.events.length > 0 || day.tasks.length > 0"
                 (click)="openDayEvents(day)">
              <div class="day-number">{{ day.day }}</div>
              <div class="day-events">
                @for (event of day.events; track event.id) {
                  <div class="event-indicator" [style.background]="event.color" [title]="event.title"></div>
                }
                @for (task of day.tasks; track task.id) {
                  <div class="task-indicator" 
                       [class.completed]="task.isCompleted"
                       [class.pending]="task.status === 'Pending'"
                       [title]="task.title">
                    <mat-icon>task_alt</mat-icon>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <div class="events-sidebar">
        <h2>Events & Tasks for {{ monthNames[currentMonth] }} {{ currentYear }}</h2>
        
        <!-- Birthdays Section -->
        @if (getCurrentMonthBirthdays().length > 0) {
          <h3 class="section-title birthday-title">
            <mat-icon>cake</mat-icon>
            Birthdays This Month
          </h3>
          <div class="birthdays-list">
            @for (birthday of getCurrentMonthBirthdays(); track birthday.userId) {
              <mat-card class="birthday-card">
                <mat-card-header>
                  <div class="birthday-avatar"><mat-icon>cake</mat-icon></div>
                  <div class="birthday-info">
                    <mat-card-title>{{ birthday.name }} {{ birthday.surname }}</mat-card-title>
                    <mat-card-subtitle>{{ getBirthdayDate(birthday.birthday) | date:'MMMM d' }}</mat-card-subtitle>
                  </div>
                </mat-card-header>
                <mat-card-content>
                  @if (birthday.departmentName) {
                    <span class="department-badge">{{ birthday.departmentName }}</span>
                  }
                </mat-card-content>
              </mat-card>
            }
          </div>
        }

        <!-- ToDo Tasks Section -->
        @if (getCurrentMonthTasks().length > 0) {
          <h3 class="section-title">
            <mat-icon>task_alt</mat-icon>
            ToDo Tasks
          </h3>
          <div class="tasks-list">
            @for (task of getCurrentMonthTasks(); track task.id) {
              <mat-card class="task-card" [class.completed]="task.isCompleted" [class.pending]="task.status === 'Pending'">
                <mat-card-header>
                  <mat-checkbox [checked]="task.isCompleted" 
                                [disabled]="task.status === 'Pending' || task.isCompleted"
                                (change)="completeTask(task)"
                                (click)="$event.stopPropagation()">
                  </mat-checkbox>
                  <div class="task-header-content">
                    <mat-card-title [class.completed-text]="task.isCompleted">{{ task.title }}</mat-card-title>
                    <mat-card-subtitle>Due: {{ task.dueDate | date:'MMM d, y' }}</mat-card-subtitle>
                  </div>
                  <span class="priority-badge" [class]="'priority-' + task.priority.toLowerCase()">{{ task.priority }}</span>
                </mat-card-header>
                <mat-card-content>
                  <div class="task-meta">
                    <span class="status-badge" [class]="'status-' + task.status.toLowerCase()">{{ task.status }}</span>
                    @if (!task.isSelfAssigned) {
                      <span class="assigned-by">From: {{ task.createdByUserName }}</span>
                    }
                  </div>
                  @if (task.description) {
                    <p class="task-description">{{ task.description }}</p>
                  }
                </mat-card-content>
              </mat-card>
            }
          </div>
        }

        <!-- Events Section -->
        <h3 class="section-title">
          <mat-icon>event</mat-icon>
          Events
        </h3>
        <div class="events-list">
          @for (event of getCurrentMonthEvents(); track event.id) {
            <mat-card class="event-card">
              <mat-card-header>
                <mat-card-title>{{ event.title }}</mat-card-title>
                <mat-card-subtitle>{{ event.date | date:'MMM d, y' }}</mat-card-subtitle>
              </mat-card-header>
              <mat-card-content>
                <div class="event-details">
                  <mat-icon>schedule</mat-icon>
                  <span>{{ event.time }}</span>
                </div>
                <div class="event-details">
                  <mat-icon>location_on</mat-icon>
                  <span>{{ event.location }}</span>
                </div>
                <p>{{ event.description }}</p>
              </mat-card-content>
            </mat-card>
          }
          @if (getCurrentMonthEvents().length === 0) {
            <app-empty-state icon="event_busy" title="No events this month" message="Public holidays, birthdays and meetings for {{ monthNames[currentMonth] }} will show up here."></app-empty-state>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .calendar-container {
      padding: 80px;
      min-height: calc(100vh - 64px);
      position: relative;
      background: var(--color-canvas);
      overflow-x: hidden;
    }

    .spacer {
      flex: 1;
    }

    .calendar-header {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 32px;
      padding: 32px 0;
      color: var(--color-text);
    }

    .calendar-header h1 {
      font-size: 2.5rem;
      font-weight: 600;
      margin: 0;
    }

    .calendar-header button {
      color: var(--color-text);
      background: var(--color-surface);
      border: 1px solid var(--color-line);
    }

    .calendar-header button:hover {
      background: var(--color-surface-2);
    }

    .calendar-header mat-icon {
      font-size: var(--text-4xl);
      width: 32px;
      height: 32px;
    }

    .calendar-grid {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0 24px;
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-md);
      overflow: hidden;
    }

    .calendar-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      background: var(--color-primary);
      color: var(--color-on-primary);
    }

    .weekday {
      padding: 16px;
      text-align: center;
      font-weight: 600;
      font-size: 1.1rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .calendar-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
      background: var(--color-line);
    }

    .calendar-day {
      background: var(--color-surface);
      min-height: 120px;
      padding: 12px;
      cursor: default;
      transition: all 0.3s ease;
      position: relative;
    }

    .calendar-day.clickable {
      cursor: pointer;
    }

    .calendar-day.clickable:hover {
      background: var(--color-surface-2);
      transform: scale(1.02);
      box-shadow: var(--shadow-md);
      z-index: 10;
    }

    .calendar-day.has-events {
      border-left: 4px solid var(--color-primary);
    }

    .calendar-day.other-month {
      background: var(--color-canvas);
      opacity: 0.5;
    }

    .calendar-day.today {
      background: var(--color-primary-soft);
      border: 2px solid var(--color-primary);
    }

    .calendar-day.today .day-number {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-radius: 50%;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .day-number {
      font-size: 1.2rem;
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 8px;
    }

    .day-events {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 8px;
    }

    .event-indicator {
      height: 6px;
      border-radius: 3px;
      transition: all 0.2s ease;
    }

    .task-indicator {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 6px;
      background: var(--color-primary-soft);
      border-radius: 4px;
      font-size: var(--text-xs);
      color: var(--color-primary);
    }

    .task-indicator mat-icon {
      font-size: var(--text-xs);
      width: 12px;
      height: 12px;
    }

    .task-indicator.completed {
      background: var(--color-ok-soft);
      color: var(--color-ok);
      text-decoration: line-through;
    }

    .task-indicator.pending {
      background: var(--color-warn-soft);
      color: var(--color-warn);
    }

    .calendar-day:hover .event-indicator {
      height: 8px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.3rem;
      margin: 24px 0 16px;
      color: var(--color-text);
    }

    .section-title.birthday-title mat-icon {
      color: var(--color-cat-pink);
    }

    .birthdays-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .birthday-card {
      background: var(--color-cat-pink-soft);
      border-radius: var(--radius-md);
      transition: all 0.3s ease;
      border-left: 4px solid var(--color-cat-pink);
    }

    .birthday-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
    }

    .birthday-card mat-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .birthday-avatar {
      font-size: var(--text-4xl);
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-surface);
      color: var(--color-cat-pink);
      border-radius: 50%;
    }

    .birthday-avatar mat-icon {
      font-size: var(--text-3xl);
      width: 24px;
      height: 24px;
    }

    .birthday-info {
      flex: 1;
    }

    .birthday-card mat-card-title {
      color: var(--color-text);
      font-size: 1.1rem;
      margin-bottom: 4px;
    }

    .birthday-card mat-card-subtitle {
      color: var(--color-text-2);
    }

    .department-badge {
      display: inline-block;
      padding: 4px 12px;
      background: var(--color-surface);
      border-radius: 12px;
      font-size: var(--text-xs);
      color: var(--color-cat-pink);
    }

    .tasks-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .task-card {
      background: var(--color-surface);
      border-radius: 12px;
      transition: all 0.3s ease;
    }

    .task-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
    }

    .task-card.completed {
      opacity: 0.7;
      background: var(--color-surface-2);
    }

    .task-card.pending {
      border-left: 4px solid var(--color-warn);
    }

    .task-card mat-card-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .task-header-content {
      flex: 1;
    }

    .task-card mat-card-title.completed-text {
      text-decoration: line-through;
      color: var(--color-text-3);
    }

    .task-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .priority-badge, .status-badge {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: var(--text-xs);
      font-weight: 500;
    }

    .priority-low { background: var(--color-primary-soft); color: var(--color-primary); }
    .priority-normal { background: var(--color-ok-soft); color: var(--color-ok); }
    .priority-high { background: var(--color-warn-soft); color: var(--color-warn); }
    .priority-urgent { background: var(--color-danger-soft); color: var(--color-danger); }

    .status-pending { background: var(--color-warn-soft); color: var(--color-warn); }
    .status-accepted { background: var(--color-primary-soft); color: var(--color-primary); }
    .status-completed { background: var(--color-ok-soft); color: var(--color-ok); }

    .assigned-by {
      font-size: var(--text-xs);
      color: var(--color-text-2);
    }

    .task-description {
      font-size: var(--text-sm);
      color: var(--color-text-2);
      margin-top: 8px;
    }

    .events-sidebar {
      max-width: 1400px;
      margin: 32px auto 0;
      padding: 0 24px;
      color: var(--color-text);
    }

    .events-sidebar h2 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 24px;
    }

    .events-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }

    .event-card {
      transition: all 0.3s ease;
    }

    .event-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
    }

    .event-card mat-card-title {
      font-size: 1.3rem;
      font-weight: 600;
      color: var(--color-primary);
    }

    .event-card mat-card-subtitle {
      color: var(--color-primary);
      font-size: 1rem;
      margin-top: 4px;
    }

    .event-details {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
      color: var(--color-text-2);
    }

    .event-details mat-icon {
      font-size: var(--text-2xl);
      width: 20px;
      height: 20px;
      color: var(--color-primary);
    }

    .event-card p {
      margin: 16px 0 0 0;
      color: var(--color-text-2);
      line-height: 1.6;
    }

    @media (max-width: 1024px) {
      .calendar-days {
        grid-template-columns: repeat(7, 1fr);
      }

      .calendar-day {
        min-height: 100px;
        padding: 8px;
      }

      .events-list {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .calendar-header h1 {
        font-size: 1.8rem;
      }

      .weekday {
        font-size: 0.9rem;
        padding: 12px 8px;
      }

      .calendar-day {
        min-height: 80px;
        padding: 6px;
      }

      .day-number {
        font-size: 1rem;
      }
    }
  `]
})
export class CalendarComponent implements OnInit {
  currentMonth: number;
  currentYear: number;
  calendarDays: any[] = [];
  notificationCount = 3;
  todoTasks: TodoTask[] = [];
  birthdays: UserBirthday[] = [];
  currentUserId: number = 0;

  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  upcomingEvents = [
    // South African Public Holidays 2026
    {
      id: 101,
      title: "New Year's Day",
      date: new Date(2026, 0, 1), // January 1, 2026 (Thursday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 102,
      title: 'Human Rights Day',
      date: new Date(2026, 2, 21), // March 21, 2026 (Saturday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 103,
      title: 'Good Friday',
      date: new Date(2026, 3, 3), // April 3, 2026 (Friday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 104,
      title: 'Family Day',
      date: new Date(2026, 3, 6), // April 6, 2026 (Monday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 105,
      title: 'Freedom Day',
      date: new Date(2026, 3, 27), // April 27, 2026 (Monday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 106,
      title: "Workers' Day",
      date: new Date(2026, 4, 1), // May 1, 2026 (Friday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 107,
      title: 'Youth Day',
      date: new Date(2026, 5, 16), // June 16, 2026 (Tuesday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 108,
      title: "National Women's Day",
      date: new Date(2026, 7, 9), // August 9, 2026 (Sunday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 109,
      title: "Public Holiday (Women's Day observed)",
      date: new Date(2026, 7, 10), // August 10, 2026 (Monday)
      time: 'All Day',
      location: 'Public Holiday',
      description: "Public Holiday observed for National Women's Day",
      color: 'var(--color-danger)'
    },
    {
      id: 110,
      title: 'Heritage Day',
      date: new Date(2026, 8, 24), // September 24, 2026 (Thursday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 111,
      title: 'Day of Reconciliation',
      date: new Date(2026, 11, 16), // December 16, 2026 (Wednesday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 112,
      title: 'Christmas Day',
      date: new Date(2026, 11, 25), // December 25, 2026 (Friday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    {
      id: 113,
      title: 'Day of Goodwill',
      date: new Date(2026, 11, 26), // December 26, 2026 (Saturday)
      time: 'All Day',
      location: 'Public Holiday',
      description: 'South African Public Holiday',
      color: 'var(--color-danger)'
    },
    // Regular events
    {
      id: 1,
      title: 'Team Meeting',
      date: new Date(2025, 10, 15),
      time: '10:00 AM - 11:00 AM',
      location: 'Conference Room A',
      description: 'Monthly team sync-up and planning session',
      color: 'var(--color-ok)'
    },
    {
      id: 2,
      title: 'Project Deadline',
      date: new Date(2025, 10, 20),
      time: '5:00 PM',
      location: 'Development Team',
      description: 'E-Commerce platform final delivery',
      color: 'var(--color-danger)'
    },
    {
      id: 3,
      title: 'Company Holiday',
      date: new Date(2025, 10, 28),
      time: 'All Day',
      location: 'Company-wide',
      description: 'Thanksgiving Day - Office Closed',
      color: 'var(--color-warn)'
    },
    {
      id: 4,
      title: 'Training Session',
      date: new Date(2025, 10, 18),
      time: '2:00 PM - 4:00 PM',
      location: 'Training Room',
      description: 'New software tools and best practices',
      color: 'var(--color-primary)'
    },
    {
      id: 5,
      title: 'Client Presentation',
      date: new Date(2025, 10, 22),
      time: '3:00 PM - 4:30 PM',
      location: 'Board Room',
      description: 'Q4 results and future roadmap',
      color: 'var(--color-cat-purple)'
    }
  ];

  constructor(
    private router: Router,
    private authService: AuthService,
    private dialog: MatDialog,
    private http: HttpClient,
    private toast: ToastService
  ) {
    const today = new Date();
    this.currentMonth = today.getMonth();
    this.currentYear = today.getFullYear();
  }

  ngOnInit(): void {
    this.currentUserId = this.authService.currentUserValue?.userId || 0;
    this.loadTasks();
    this.loadBirthdays();
    this.loadMeetings();
    this.generateCalendar();
  }

  loadTasks(): void {
    if (this.currentUserId === 0) return;
    
    this.http.get<TodoTask[]>(`${environment.apiUrl}/todo/calendar/${this.currentUserId}?month=${this.currentMonth + 1}&year=${this.currentYear}`)
      .subscribe({
        next: (tasks) => {
          this.todoTasks = tasks;
          this.generateCalendar(); // Regenerate calendar with tasks
        },
        error: (err) => console.error('Error loading tasks:', err)
      });
  }

  loadBirthdays(): void {
    this.http.get<UserBirthday[]>(`${environment.apiUrl}/users/birthdays?month=${this.currentMonth + 1}`)
      .subscribe({
        next: (birthdays) => {
          this.birthdays = birthdays;
          this.generateBirthdayEvents();
          this.generateCalendar(); // Regenerate calendar with birthdays
        },
        error: (err) => console.error('Error loading birthdays:', err)
      });
  }

  generateBirthdayEvents(): void {
    // Remove existing birthday events
    this.upcomingEvents = this.upcomingEvents.filter(e => !e.title.includes('Birthday'));
    
    // Add birthday events for the current year
    this.birthdays.forEach((birthday, index) => {
      const birthDate = new Date(birthday.birthday);
      this.upcomingEvents.push({
        id: 2000 + index,
        title: `${birthday.name} ${birthday.surname || ''}'s Birthday`,
        date: new Date(this.currentYear, birthDate.getMonth(), birthDate.getDate()),
        time: 'All Day',
        location: birthday.departmentName || 'Company',
        description: `Happy Birthday to ${birthday.name} ${birthday.surname || ''}!`,
        color: 'var(--color-cat-pink)'
      });
    });
  }

  loadMeetings(): void {
    const startDate = new Date(this.currentYear, this.currentMonth, 1);
    const endDate = new Date(this.currentYear, this.currentMonth + 2, 0);
    
    this.http.get<any[]>(`${environment.apiUrl}/meetings/calendar?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
      .subscribe({
        next: (meetings) => {
          // Remove existing meeting events
          this.upcomingEvents = this.upcomingEvents.filter(e => e.id < 3000);
          
          // Add meeting events
          meetings.forEach((meeting, index) => {
            const meetingDate = new Date(meeting.start);
            this.upcomingEvents.push({
              id: 3000 + index,
              title: meeting.title,
              date: meetingDate,
              time: meetingDate.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
              location: meeting.location,
              description: `Meeting - ${meeting.responseStatus}`,
              color: meeting.color
            });
          });
          
          this.generateCalendar(); // Regenerate calendar with meetings
        },
        error: (err) => console.error('Error loading meetings:', err)
      });
  }

  generateCalendar(): void {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const prevLastDay = new Date(this.currentYear, this.currentMonth, 0);
    const today = new Date();

    this.calendarDays = [];

    // Previous month days
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevLastDay.getDate() - i;
      this.calendarDays.push({
        day,
        date: new Date(this.currentYear, this.currentMonth - 1, day),
        isCurrentMonth: false,
        isToday: false,
        events: [],
        tasks: []
      });
    }

    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(this.currentYear, this.currentMonth, day);
      const isToday = date.toDateString() === today.toDateString();
      const dayEvents = this.upcomingEvents.filter(event =>
        event.date.toDateString() === date.toDateString()
      );
      const dayTasks = this.todoTasks.filter(task => {
        const taskDate = new Date(task.dueDate);
        return taskDate.toDateString() === date.toDateString();
      });

      this.calendarDays.push({
        day,
        date,
        isCurrentMonth: true,
        isToday,
        events: dayEvents,
        tasks: dayTasks
      });
    }

    // Next month days
    const remainingDays = 42 - this.calendarDays.length;
    for (let day = 1; day <= remainingDays; day++) {
      this.calendarDays.push({
        day,
        date: new Date(this.currentYear, this.currentMonth + 1, day),
        isCurrentMonth: false,
        isToday: false,
        events: [],
        tasks: []
      });
    }
  }

  previousMonth(): void {
    if (this.currentMonth === 0) {
      this.currentMonth = 11;
      this.currentYear--;
    } else {
      this.currentMonth--;
    }
    this.loadTasks();
    this.loadBirthdays();
    this.loadMeetings();
  }

  nextMonth(): void {
    if (this.currentMonth === 11) {
      this.currentMonth = 0;
      this.currentYear++;
    } else {
      this.currentMonth++;
    }
    this.loadTasks();
    this.loadBirthdays();
    this.loadMeetings();
  }

  getCurrentMonthEvents(): any[] {
    return this.upcomingEvents.filter(event => 
      event.date.getMonth() === this.currentMonth && 
      event.date.getFullYear() === this.currentYear
    ).sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  getCurrentMonthTasks(): TodoTask[] {
    return this.todoTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  getCurrentMonthBirthdays(): UserBirthday[] {
    return this.birthdays.filter(b => {
      const birthDate = new Date(b.birthday);
      return birthDate.getMonth() === this.currentMonth;
    }).sort((a, b) => {
      const aDay = new Date(a.birthday).getDate();
      const bDay = new Date(b.birthday).getDate();
      return aDay - bDay;
    });
  }

  getBirthdayDate(birthday: Date): Date {
    const d = new Date(birthday);
    return new Date(this.currentYear, d.getMonth(), d.getDate());
  }

  completeTask(task: TodoTask): void {
    if (task.status === 'Pending' || task.isCompleted) return;

    this.http.post(`${environment.apiUrl}/todo/${task.id}/complete`, {}).subscribe({
      next: () => {
        this.toast.done('Task completed.');
        this.loadTasks();
      },
      error: (err) => {
        console.error('Error completing task:', err);
        this.toast.error('The task could not be completed. Try again.');
      }
    });
  }

  openDayEvents(day: any): void {
    if (day.events.length > 0 || day.tasks.length > 0) {
      const dialogRef = this.dialog.open(DayEventsDialogComponent, {
        width: '650px',
        data: {
          date: day.date,
          events: day.events,
          tasks: day.tasks
        }
      });
      dialogRef.componentInstance.taskCompleted.subscribe(() => {
        this.loadTasks();
      });
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}

// Dialog Component for showing day events and tasks
@Component({
  selector: 'app-day-events-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatCheckboxModule
  ],
  template: `
    <div class="modern-dialog-container">
      <div class="dialog-header">
        <div class="header-content">
          <div class="icon-wrapper">
            <mat-icon>event_note</mat-icon>
          </div>
          <div class="header-text">
            <h2>{{ data.date | date:'EEEE' }}</h2>
            <p class="date-subtitle">{{ data.date | date:'MMMM d, yyyy' }}</p>
          </div>
        </div>
        <button aria-label="Close" mat-icon-button mat-dialog-close class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content>
        <!-- Tasks Section -->
        @if (data.tasks && data.tasks.length > 0) {
          <div class="events-count tasks-count">
            <mat-icon>task_alt</mat-icon>
            <span>{{ data.tasks.length }} {{ data.tasks.length === 1 ? 'Task' : 'Tasks' }}</span>
          </div>

          <div class="events-container" style="margin-bottom: 24px;">
            @for (task of data.tasks; track task.id) {
              <div class="event-card task-card-dialog" 
                   [class.task-completed]="task.isCompleted"
                   [style.--event-color]="getTaskColor(task)">
                <div class="event-header">
                  <div class="event-badge" [style.background]="getTaskColor(task)">
                    <mat-icon>{{ task.isCompleted ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                  </div>
                  <div class="event-title-section">
                    <h3 [class.completed-title]="task.isCompleted">{{ task.title }}</h3>
                    <div class="task-badges">
                      <span class="task-priority-badge" [class]="'priority-' + task.priority.toLowerCase()">{{ task.priority }}</span>
                      <span class="task-status-badge" [class]="'status-' + task.status.toLowerCase()">{{ task.status }}</span>
                    </div>
                  </div>
                </div>

                <div class="event-details">
                  @if (task.description) {
                    <div class="detail-row">
                      <div class="detail-icon">
                        <mat-icon>notes</mat-icon>
                      </div>
                      <div class="detail-content">
                        <span class="detail-label">Description</span>
                        <span class="detail-value">{{ task.description }}</span>
                      </div>
                    </div>
                  }

                  @if (!task.isSelfAssigned) {
                    <div class="detail-row">
                      <div class="detail-icon">
                        <mat-icon>person</mat-icon>
                      </div>
                      <div class="detail-content">
                        <span class="detail-label">Assigned By</span>
                        <span class="detail-value">{{ task.createdByUserName }}</span>
                      </div>
                    </div>
                  }

                  @if (task.category) {
                    <div class="detail-row">
                      <div class="detail-icon">
                        <mat-icon>label</mat-icon>
                      </div>
                      <div class="detail-content">
                        <span class="detail-label">Category</span>
                        <span class="detail-value">{{ task.category }}</span>
                      </div>
                    </div>
                  }

                  @if (!task.isCompleted && task.status !== 'Pending') {
                    <div class="task-action">
                      <button mat-flat-button class="complete-task-btn" (click)="onCompleteTask(task)">
                        <mat-icon>check</mat-icon>
                        Mark Complete
                      </button>
                    </div>
                  }
                  @if (task.status === 'Pending') {
                    <div class="task-pending-note">
                      <mat-icon>hourglass_empty</mat-icon>
                      <span>Waiting to be accepted</span>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- Events Section -->
        @if (data.events && data.events.length > 0) {
          <div class="events-count">
            <mat-icon>event_available</mat-icon>
            <span>{{ data.events.length }} {{ data.events.length === 1 ? 'Event' : 'Events' }} Scheduled</span>
          </div>

          <div class="events-container">
            @for (event of data.events; track event.id) {
              <div class="event-card" [style.--event-color]="event.color">
                <div class="event-header">
                  <div class="event-badge" [style.background]="event.color">
                    <mat-icon>calendar_today</mat-icon>
                  </div>
                  <div class="event-title-section">
                    <h3>{{ event.title }}</h3>
                    <span class="event-time">
                      <mat-icon>schedule</mat-icon>
                      {{ event.time }}
                    </span>
                  </div>
                </div>

                <div class="event-details">
                  <div class="detail-row">
                    <div class="detail-icon">
                      <mat-icon>place</mat-icon>
                    </div>
                    <div class="detail-content">
                      <span class="detail-label">Location</span>
                      <span class="detail-value">{{ event.location }}</span>
                    </div>
                  </div>

                  <div class="detail-row">
                    <div class="detail-icon">
                      <mat-icon>description</mat-icon>
                    </div>
                    <div class="detail-content">
                      <span class="detail-label">Details</span>
                      <span class="detail-value">{{ event.description }}</span>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </mat-dialog-content>

      <mat-dialog-actions>
        <button mat-flat-button color="primary" mat-dialog-close class="modern-close-btn">
          <mat-icon>check_circle</mat-icon>
          Got it
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .modern-dialog-container {
      position: relative;
      background: var(--color-surface);
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 32px 32px 24px 32px;
      background: var(--color-surface);
      color: var(--color-text);
      border-bottom: 1px solid var(--color-line);
      margin: -24px -24px 0 -24px;
      border-radius: 12px 12px 0 0;
      position: relative;
      overflow: hidden;
    }

    .header-content {
      display: flex;
      align-items: center;
      gap: 20px;
      position: relative;
      z-index: 1;
    }

    .icon-wrapper {
      width: 56px;
      height: 56px;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      border-radius: var(--radius-md);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .icon-wrapper mat-icon {
      font-size: var(--text-4xl);
      width: 32px;
      height: 32px;
    }

    .header-text h2 {
      margin: 0;
      font-size: 1.8rem;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .date-subtitle {
      margin: 4px 0 0 0;
      font-size: 0.95rem;
      opacity: 0.9;
      font-weight: 400;
    }

    .close-btn {
      color: var(--color-text-2);
      position: relative;
      z-index: 1;
    }

    .close-btn:hover {
      background: var(--color-surface-2);
    }

    mat-dialog-content {
      padding: 28px 32px;
      max-height: 65vh;
      overflow-y: auto;
    }

    .events-count {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: var(--color-primary-soft);
      border-radius: var(--radius-md);
      margin-bottom: 24px;
      border-left: 4px solid var(--color-primary);
    }

    .events-count mat-icon {
      color: var(--color-primary);
      font-size: var(--text-3xl);
      width: 24px;
      height: 24px;
    }

    .events-count span {
      font-weight: 600;
      color: var(--color-text);
      font-size: 1rem;
    }

    .events-container {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .event-card {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-sm);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      border: 2px solid transparent;
      position: relative;
      overflow: hidden;
    }

    .event-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: var(--event-color);
    }

    .event-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
      border-color: var(--event-color);
    }

    .event-header {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
      align-items: flex-start;
    }

    .event-badge {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-on-primary);
      flex-shrink: 0;
    }

    .event-badge mat-icon {
      font-size: var(--text-3xl);
      width: 24px;
      height: 24px;
    }

    .event-title-section {
      flex: 1;
      min-width: 0;
    }

    .event-title-section h3 {
      margin: 0 0 8px 0;
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.3px;
    }

    .event-time {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--color-surface-2);
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--color-text-2);
    }

    .event-time mat-icon {
      font-size: var(--text-xl);
      width: 18px;
      height: 18px;
    }

    .event-details {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 20px;
      border-top: 2px dashed var(--color-line);
    }

    .detail-row {
      display: flex;
      gap: 16px;
    }

    .detail-icon {
      width: 40px;
      height: 40px;
      background: var(--color-surface-2);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .detail-icon mat-icon {
      font-size: var(--text-2xl);
      width: 20px;
      height: 20px;
      color: var(--color-text-2);
    }

    .detail-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .detail-label {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--color-text-3);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-value {
      font-size: 1rem;
      color: var(--color-text);
      line-height: 1.5;
      font-weight: 500;
    }

    mat-dialog-actions {
      padding: 24px 32px;
      background: var(--color-surface);
      margin: 0 -24px -24px -24px;
      display: flex;
      justify-content: center;
      border-top: 1px solid var(--color-line);
    }

    .modern-close-btn {
      min-width: 160px;
      height: 48px;
      font-weight: 700;
      font-size: 1rem;
      border-radius: var(--radius-md);
    }

    .modern-close-btn mat-icon {
      margin-right: 8px;
    }

    ::-webkit-scrollbar {
      width: 10px;
    }

    ::-webkit-scrollbar-track {
      background: var(--color-surface-2);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
      background: var(--color-primary);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--color-primary);
    }

    /* Task-specific styles */
    .tasks-count {
      border-left-color: var(--color-primary);
      background: var(--color-primary-soft);
    }

    .tasks-count mat-icon {
      color: var(--color-primary);
    }

    .task-card-dialog.task-completed {
      opacity: 0.65;
    }

    .task-card-dialog.task-completed h3.completed-title {
      text-decoration: line-through;
      color: var(--color-text-3);
    }

    .task-badges {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .task-priority-badge, .task-status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .task-priority-badge.priority-low { background: var(--color-primary-soft); color: var(--color-primary); }
    .task-priority-badge.priority-normal { background: var(--color-ok-soft); color: var(--color-ok); }
    .task-priority-badge.priority-high { background: var(--color-warn-soft); color: var(--color-warn); }
    .task-priority-badge.priority-urgent { background: var(--color-danger-soft); color: var(--color-danger); }

    .task-status-badge.status-pending { background: var(--color-warn-soft); color: var(--color-warn); }
    .task-status-badge.status-accepted { background: var(--color-primary-soft); color: var(--color-primary); }
    .task-status-badge.status-completed { background: var(--color-ok-soft); color: var(--color-ok); }
    .task-status-badge.status-inprogress { background: var(--color-surface-3); color: var(--color-primary); }

    .task-action {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 2px dashed var(--color-line);
    }

    .complete-task-btn {
      background: var(--color-ok);
      color: var(--color-on-primary);
      border-radius: var(--radius-md);
      font-weight: 600;
      padding: 0 20px;
      height: 40px;
      transition: all 0.3s ease;
    }

    .complete-task-btn:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
    }

    .complete-task-btn mat-icon {
      margin-right: 6px;
      font-size: var(--text-2xl);
      width: 20px;
      height: 20px;
    }

    .task-pending-note {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px 16px;
      background: var(--color-warn-soft);
      border-radius: 10px;
      color: var(--color-warn);
      font-size: 0.9rem;
      font-weight: 500;
    }

    .task-pending-note mat-icon {
      font-size: var(--text-2xl);
      width: 20px;
      height: 20px;
    }
  `]
})
export class DayEventsDialogComponent {
  taskCompleted = new EventEmitter<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { date: Date; events: any[]; tasks: TodoTask[] },
    private http: HttpClient,
    private toast: ToastService
  ) {}

  getTaskColor(task: TodoTask): string {
    if (task.isCompleted) return 'var(--color-ok)';
    switch (task.priority.toLowerCase()) {
      case 'urgent': return 'var(--color-danger)';
      case 'high': return 'var(--color-warn)';
      case 'normal': return 'var(--color-primary)';
      case 'low': return 'var(--color-text-3)';
      default: return 'var(--color-primary)';
    }
  }

  onCompleteTask(task: TodoTask): void {
    this.http.post(`${environment.apiUrl}/todo/${task.id}/complete`, {}).subscribe({
      next: () => {
        task.isCompleted = true;
        task.status = 'Completed';
        this.toast.done('Task completed.');
        this.taskCompleted.emit();
      },
      error: () => {
        this.toast.error('The task could not be completed. Try again.');
      }
    });
  }
}


